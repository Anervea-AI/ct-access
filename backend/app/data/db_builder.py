"""DB-backed dataset builder — assembles the SAME Pydantic `Dataset` contract the
synthetic generator produces, but filled from the real RWD warehouse (`alfadev.db`).

Everything here is deterministic (stable SQL ordering, no RNG) so the shipped
`dataset.json` is byte-stable and the TS parity mirror stays in lock-step.

Where the RWD genuinely lacks a field (I/E clinical proxies, screen-fail /
enrollment benchmarks), we keep the synthetic/assumption value and flag it — real
numbers where they exist, labeled proxies where they don't.
"""
from __future__ import annotations

import math
from functools import lru_cache

import networkx as nx
import pandas as pd

from app.data import db
from app.data.generator import _build_criteria  # reuse the domain I/E set
from app.data.geo import STATE_CENTROID, region_for_state
from app.models.schemas import (
    AgeBand,
    Benchmarks,
    Criterion,
    Dataset,
    Demographics,
    Distributions,
    IndicationOpportunity,
    Kol,
    KolEdge,
    KolSignals,
    SaturationStat,
    Site,
    TrialSummary,
    UntappedPI,
    WhitespaceRegion,
)

DATA_VERSION = "2026-06-rwd-01"
PROGRAM = "Bipolar I Depression (US) — RWD-backed"
N_KOLS = 40
N_TRIALS = 100
N_UNTAPPED = 30
OVERCOMMIT_THRESHOLD = 3  # trials per investigator above which they're "over-committed"


# --------------------------------------------------------------------------- #
# helpers
# --------------------------------------------------------------------------- #


def _na(v):
    """NaN/empty → None (pandas reads missing string cells as float NaN)."""
    if v is None:
        return None
    if isinstance(v, float) and math.isnan(v):
        return None
    if isinstance(v, str) and not v.strip():
        return None
    return v


def _num(v, default: float) -> float:
    if v is None or (isinstance(v, float) and math.isnan(v)):
        return default
    return float(v)


def _norm_series(values: dict[int, float]) -> dict[int, float]:
    """Max-normalize a {key: value} map to 0..1 (stable, deterministic)."""
    if not values:
        return {}
    hi = max(values.values()) or 1.0
    return {k: round(v / hi, 4) for k, v in values.items()}


def _specialty_fit(specialty) -> float:
    s = (specialty if isinstance(specialty, str) else "").lower()
    if "psychiatr" in s:
        return 1.0
    if "neuro" in s or "psycholog" in s or "mental health" in s:
        return 0.75
    if "addiction" in s or "counsel" in s or "social worker" in s:
        return 0.6
    return 0.4


def _short_specialty(specialty) -> str:
    s = specialty if isinstance(specialty, str) and specialty.strip() else "Unknown"
    # source uses "X-Y" compound specialty strings; keep the leading concept
    return s.split("-")[0].strip() or "Unknown"


def _year(date_str) -> int | None:
    if not date_str or not isinstance(date_str, str):
        return None
    try:
        return int(date_str[:4])
    except ValueError:
        return None


def _primary_condition(mesh) -> str:
    if not isinstance(mesh, str) or not mesh.strip():
        return "Unspecified"
    first = mesh.split(";")[0].strip()
    return first or "Unspecified"


# --------------------------------------------------------------------------- #
# distributions / universe
# --------------------------------------------------------------------------- #


def _build_distributions(eng) -> tuple[Distributions, int]:
    geo = pd.read_sql("SELECT * FROM patient_geo", eng)
    universe = int(geo["patient_count"].fillna(0).sum())

    age = pd.read_sql("SELECT * FROM patient_age WHERE patient_count > 0", eng)
    bands: list[AgeBand] = []
    for _, r in age.iterrows():
        band = str(r["age_band"])
        if "+" in band:
            lo = int(band.replace("+", ""))
            hi = 99
        elif "-" in band:
            a, b = band.split("-")
            lo, hi = int(a), int(b)
        else:
            continue
        bands.append(AgeBand(band=band, lo=lo, hi=hi, count=int(r["patient_count"])))
    bands.sort(key=lambda x: x.lo)

    gen = pd.read_sql("SELECT * FROM patient_gender", eng)
    gtot = gen["patient_count"].sum() or 1
    gender_split = {str(r["gender"]): round(r["patient_count"] / gtot, 4) for _, r in gen.iterrows()}

    pay = pd.read_sql("SELECT * FROM patient_payer", eng)
    ptot = pay["patient_count"].sum() or 1
    payer_mix = {str(r["payer_channel"]): round(r["patient_count"] / ptot, 4) for _, r in pay.iterrows()}

    race_cols = ["white", "black", "asian", "hispanic", "other", "unknown"]
    race_sums = {c: float(geo[c].fillna(0).sum()) for c in race_cols}
    rtot = sum(race_sums.values()) or 1
    geo_demo = {c: round(v / rtot, 4) for c, v in race_sums.items()}

    return Distributions(
        ageHistogram=bands, genderSplit=gender_split,
        payerMix=payer_mix, geoDemographics=geo_demo,
    ), universe


# --------------------------------------------------------------------------- #
# criteria (reuse domain set, tag age as data-backed)
# --------------------------------------------------------------------------- #


def _build_criteria_db() -> list[Criterion]:
    criteria = _build_criteria()
    by_id = {c.id: c for c in criteria}
    if "inc_age" in by_id:
        by_id["inc_age"].dataSource = "age_histogram"
        by_id["inc_age"].proxyNote = "Reduction computed from the real RWD age histogram."
    return criteria


# --------------------------------------------------------------------------- #
# sites (real ILLUMINATE1 footprint)
# --------------------------------------------------------------------------- #


def _state_demographics(geo: pd.DataFrame, female_frac: float) -> dict[str, Demographics]:
    out: dict[str, Demographics] = {}
    grp = geo.groupby("state")[["white", "black", "asian", "hispanic", "other", "unknown"]].sum()
    for st, row in grp.iterrows():
        classified = row[["white", "black", "asian", "hispanic"]].sum() or 1
        out[st] = Demographics(
            blackPct=round(row["black"] / classified * 100, 1),
            hispanicPct=round(row["hispanic"] / classified * 100, 1),
            asianPct=round(row["asian"] / classified * 100, 1),
            whitePct=round(row["white"] / classified * 100, 1),
            femalePct=round(female_frac * 100, 1),
            ruralPct=0.0,  # not in RWD — flagged proxy (kept 0)
        )
    return out


def _build_sites(eng, universe: int, female_frac: float) -> list[Site]:
    sites_df = pd.read_sql("SELECT * FROM illuminate_site ORDER BY id", eng)
    geo = pd.read_sql("SELECT * FROM patient_geo", eng)
    state_density = geo.groupby("state")["patient_count"].sum().to_dict()
    demo_by_state = _state_demographics(geo, female_frac)

    # real trial activity by state
    th = pd.read_sql("SELECT trial_id, npi, facility_state FROM trial_hcp", eng)
    ct = pd.read_sql("SELECT trial_id, status FROM clinical_trial", eng)
    th = th.merge(ct, on="trial_id", how="left")
    trials_in_state = th.groupby("facility_state")["trial_id"].nunique().to_dict()
    active = th[th["status"].fillna("").str.lower().isin(["open", "recruiting", "active"])]
    active_in_state = active.groupby("facility_state")["trial_id"].nunique().to_dict()
    investigators_in_state = th.groupby("facility_state")["npi"].nunique().to_dict()

    # indication Rx volume proxy = total HCP patient volume in state
    hcp = pd.read_sql("SELECT primary_hco_state st, patient_count FROM hcp", eng)
    rx_by_state = hcp.groupby("st")["patient_count"].sum().to_dict()

    sites_in_state = sites_df["state"].value_counts().to_dict()

    default_demo = Demographics(blackPct=15.0, hispanicPct=15.0, asianPct=5.0,
                                whitePct=60.0, femalePct=round(female_frac * 100, 1), ruralPct=0.0)
    out: list[Site] = []
    for i, row in enumerate(sites_df.itertuples(index=False)):
        st = row.state
        n_sites = sites_in_state.get(st, 1) or 1
        st_density = state_density.get(st, 0)
        # per-site catchment share of the universe (≈15% of the state's patients,
        # split across its sites), clamped to a realistic single-site fraction
        raw_share = (st_density / universe / n_sites * 0.15) if universe else 0.0
        base_share = round(min(max(raw_share, 0.0004), 0.04), 5)
        lat = _num(row.lat, STATE_CENTROID.get(st, (39.5, -98.35))[0])
        lng = _num(row.lng, STATE_CENTROID.get(st, (39.5, -98.35))[1])
        out.append(Site(
            id=f"site_{i + 1:03d}",
            name=_na(row.facility) or f"Site {i + 1}",
            lat=round(lat, 4), lng=round(lng, 4),
            region=region_for_state(st), state=st or "—",
            baseShare=base_share,
            piExperienceTrials=int(investigators_in_state.get(st, 0)),
            indicationRxVolume=int(rx_by_state.get(st, 0) or 0),
            competingTrials=int(active_in_state.get(st, 0)),
            specialties=["Psychiatry"],
            demographics=demo_by_state.get(st, default_demo),
            npi=None,
            address=None,  # street address not in the ILLUMINATE1 source
            city=_na(row.city), status=_na(row.status),
            primaryContact=_na(row.primary_contact), phone=_na(row.phone), email=_na(row.email),
        ))
    return out


# --------------------------------------------------------------------------- #
# referral graph + KOLs
# --------------------------------------------------------------------------- #


def _referral_graph(eng) -> tuple[nx.DiGraph, dict[int, float]]:
    ref = pd.read_sql(
        "SELECT hcp_npi, connected_hcp_npi, share_outbound, share_inbound "
        "FROM hcp_referral WHERE hcp_npi IS NOT NULL AND connected_hcp_npi IS NOT NULL", eng)
    g = nx.DiGraph()
    weighted_degree: dict[int, float] = {}
    for r in ref.itertuples(index=False):
        u, v = int(r.hcp_npi), int(r.connected_hcp_npi)
        w = float(r.share_outbound) if r.share_outbound and not math.isnan(r.share_outbound) else 0.01
        if g.has_edge(u, v):
            g[u][v]["weight"] += w
        else:
            g.add_edge(u, v, weight=w)
        wi = float(r.share_inbound) if r.share_inbound and not math.isnan(r.share_inbound) else 0.0
        weighted_degree[u] = weighted_degree.get(u, 0.0) + w
        weighted_degree[v] = weighted_degree.get(v, 0.0) + wi
    return g, weighted_degree


def _build_kols(eng, graph: nx.DiGraph, weighted_degree: dict[int, float]) -> tuple[list[Kol], list[KolEdge]]:
    hcp = pd.read_sql(
        "SELECT npi, first_name, last_name, specialty, primary_hco_state st, "
        "primary_hco_name hco, decile, patient_count "
        "FROM hcp WHERE decile >= 7 ORDER BY patient_count DESC, npi ASC LIMIT ?",
        eng, params=(N_KOLS,))
    npis = [int(n) for n in hcp["npi"].tolist()]
    npi_set = set(npis)

    # trial leadership / recency from trial_hcp
    th = pd.read_sql("SELECT npi, trial_id FROM trial_hcp WHERE npi IS NOT NULL", eng)
    ct = pd.read_sql("SELECT trial_id, start_date, end_date FROM clinical_trial", eng)
    th = th.merge(ct, on="trial_id", how="left")
    trials_per_npi = th.groupby("npi")["trial_id"].nunique().to_dict()
    recent_year_per_npi: dict[int, int] = {}
    for r in th.itertuples(index=False):
        y = _year(r.end_date) or _year(r.start_date)
        if y is None:
            continue
        npi = int(r.npi)
        recent_year_per_npi[npi] = max(recent_year_per_npi.get(npi, 0), y)

    # PageRank over the full referral graph (real "reach")
    pagerank = nx.pagerank(graph, alpha=0.85, weight="weight") if graph.number_of_nodes() else {}

    # normalize signals across the selected cohort
    vol = {int(r.npi): float(r.patient_count or 0) for r in hcp.itertuples(index=False)}
    cen = {n: weighted_degree.get(n, 0.0) for n in npis}
    reach = {n: pagerank.get(n, 0.0) for n in npis}
    lead = {n: float(trials_per_npi.get(n, 0)) for n in npis}
    years = [y for y in recent_year_per_npi.values()] or [2026]
    ymin, ymax = min(years), max(years)
    rec = {n: ((recent_year_per_npi.get(n, ymin) - ymin) / (ymax - ymin)) if ymax > ymin else 0.0 for n in npis}

    vol_n, cen_n, reach_n, lead_n = _norm_series(vol), _norm_series(cen), _norm_series(reach), _norm_series(lead)

    competing_per_state = pd.read_sql(
        "SELECT facility_state st, COUNT(DISTINCT trial_id) n FROM trial_hcp GROUP BY facility_state", eng)
    comp_state = {r.st: int(r.n) for r in competing_per_state.itertuples(index=False)}

    kols: list[Kol] = []
    npi_to_kid: dict[int, str] = {}
    for i, r in enumerate(hcp.itertuples(index=False)):
        npi = int(r.npi)
        kid = f"kol_{i + 1:03d}"
        npi_to_kid[npi] = kid
        fit = _specialty_fit(r.specialty)
        sig = KolSignals(
            patientVolume=vol_n.get(npi, 0.0),
            referralCentrality=cen_n.get(npi, 0.0),
            referralReach=reach_n.get(npi, 0.0),
            trialLeadership=lead_n.get(npi, 0.0),
            trialRecency=round(rec.get(npi, 0.0), 4),
            specialtyFit=fit,
        )
        # derive segment from real trial history: multi-trial leaders are
        # "established"; single-trial PIs are "rising_star"; high-volume providers
        # with no trial leadership are reach/referral "dol"s.
        tc = int(trials_per_npi.get(npi, 0))
        if tc >= 2:
            segment = "established"
        elif tc == 1:
            segment = "rising_star"
        else:
            segment = "dol"
        fn = (_na(r.first_name) or "").title()
        ln = (_na(r.last_name) or "").title()
        name = f"Dr. {fn} {ln}".strip()
        kols.append(Kol(
            id=kid, name=name or f"HCP {npi}",
            region=region_for_state(_na(r.st)),
            specialty=_short_specialty(r.specialty),
            segment=segment, signals=sig, linkedSiteIds=[],
            npi=npi, trialCount=int(trials_per_npi.get(npi, 0)),
            competingTrials=int(comp_state.get(r.st, 0)),
        ))

    # edges: real referral edges among the selected KOLs
    edges: list[KolEdge] = []
    seen: set[tuple[str, str]] = set()
    ref = pd.read_sql(
        "SELECT hcp_npi, connected_hcp_npi, share_outbound FROM hcp_referral "
        "WHERE hcp_npi IS NOT NULL AND connected_hcp_npi IS NOT NULL", eng)
    for r in ref.itertuples(index=False):
        u, v = int(r.hcp_npi), int(r.connected_hcp_npi)
        if u in npi_set and v in npi_set and u != v:
            key = (npi_to_kid[u], npi_to_kid[v])
            if key in seen:
                continue
            seen.add(key)
            w = float(r.share_outbound) if r.share_outbound and not math.isnan(r.share_outbound) else 0.1
            edges.append(KolEdge(source=npi_to_kid[u], target=npi_to_kid[v],
                                 kind="referral", weight=round(min(w, 1.0), 3)))

    # co-investigator edges: KOLs sharing a trial
    th_kol = th[th["npi"].isin(npi_set)][["npi", "trial_id"]].dropna()
    by_trial: dict[str, list[int]] = {}
    for r in th_kol.itertuples(index=False):
        by_trial.setdefault(r.trial_id, []).append(int(r.npi))
    for members in by_trial.values():
        uniq = sorted(set(members))
        for a in range(len(uniq)):
            for b in range(a + 1, len(uniq)):
                ka, kb = npi_to_kid[uniq[a]], npi_to_kid[uniq[b]]
                key = tuple(sorted((ka, kb)))
                if key in seen:
                    continue
                seen.add(key)
                edges.append(KolEdge(source=ka, target=kb, kind="coinvestigator", weight=0.6))

    return kols, edges


# --------------------------------------------------------------------------- #
# indications
# --------------------------------------------------------------------------- #


def _build_indications(eng, universe: int, payer_treated: int) -> list[IndicationOpportunity]:
    ct = pd.read_sql("SELECT trial_id, condition_mesh_terms FROM clinical_trial", eng)
    ct["cond"] = ct["condition_mesh_terms"].map(_primary_condition)
    counts = ct.groupby("cond")["trial_id"].nunique().sort_values(ascending=False)
    max_count = int(counts.iloc[0]) if len(counts) else 1

    # anchor = bipolar I depression; match the bipolar/depressive-episode trial set
    BIPOLAR_TERMS = ("bipolar", "manic", "mania", "mood")
    anchor_trials = int(ct[ct["cond"].str.lower().str.contains("|".join(BIPOLAR_TERMS), na=False)]["trial_id"].nunique())
    anchor_density = round(min(anchor_trials / max_count, 1.0), 2) if max_count else 0.5
    # exclude the anchor's own space AND generic depression/MDD from the adjacent list
    # (this program is bipolar-only; MDD/depression is out of scope for now)
    ADJACENT_EXCLUDE = BIPOLAR_TERMS + ("depress", "mdd")

    out: list[IndicationOpportunity] = [
        IndicationOpportunity(
            id="bipolar1_depression", label="Bipolar I depression",
            diagnosed=universe, treated=payer_treated,
            trialEligible=int(universe * 0.12),
            competingTrialDensity=anchor_density,
            feasibilityScore=round(max(0.3, 1.0 - anchor_density * 0.5), 2),
            region="National",
        )
    ]
    # adjacent indications from real trial conditions (proxy population sizes, flagged)
    added = 0
    for cond, n in counts.items():
        if added >= 4:
            break
        if any(t in cond.lower() for t in ADJACENT_EXCLUDE) or cond == "Unspecified":
            continue
        density = round(min(int(n) / max_count, 1.0), 2)
        scale = int(n) / max_count
        out.append(IndicationOpportunity(
            id=f"adj_{cond.lower().replace(' ', '_')[:24]}",
            label=cond,
            diagnosed=int(universe * (0.6 + 0.8 * scale)),
            treated=int(universe * (0.35 + 0.5 * scale)),
            trialEligible=int(universe * 0.08 * (0.5 + scale)),
            competingTrialDensity=density,
            feasibilityScore=round(max(0.3, 1.0 - density * 0.5), 2),
            region="National",
        ))
        added += 1
    return out


# --------------------------------------------------------------------------- #
# insight collections (trials, untapped PIs, saturation, whitespace)
# --------------------------------------------------------------------------- #


def _build_trials(eng) -> list[TrialSummary]:
    ct = pd.read_sql("SELECT * FROM clinical_trial", eng)
    th = pd.read_sql("SELECT trial_id, npi, facility_state FROM trial_hcp", eng)
    inv = th.groupby("trial_id")["npi"].nunique().to_dict()
    states = th.groupby("trial_id")["facility_state"].agg(
        lambda s: sorted({x for x in s if isinstance(x, str)})).to_dict()
    ct["investigators"] = ct["trial_id"].map(lambda t: int(inv.get(t, 0)))
    ct = ct.sort_values(["investigators", "trial_id"], ascending=[False, True]).head(N_TRIALS)
    out: list[TrialSummary] = []
    for r in ct.itertuples(index=False):
        out.append(TrialSummary(
            id=r.trial_id, title=(_na(r.title) or "")[:300],
            phase=_na(r.phase) or "", sponsor=_na(r.lead_sponsor) or "",
            sponsorClass=_na(r.lead_sponsor_class) or "",
            condition=_primary_condition(r.condition_mesh_terms),
            status=_na(r.status) or "",
            startDate=_na(r.start_date), endDate=_na(r.end_date),
            investigators=int(r.investigators),
            states=states.get(r.trial_id, []),
        ))
    return out


def _build_untapped(eng) -> list[UntappedPI]:
    # high-volume HCPs with NO trial history (anti-join)
    q = """
        SELECT h.npi, h.first_name, h.last_name, h.specialty, h.primary_hco_state st,
               h.primary_hco_name hco, h.decile, h.patient_count
        FROM hcp h
        LEFT JOIN (SELECT DISTINCT npi FROM trial_hcp WHERE npi IS NOT NULL) t
          ON h.npi = t.npi
        WHERE t.npi IS NULL
        ORDER BY h.patient_count DESC, h.npi ASC
        LIMIT ?
    """
    df = pd.read_sql(q, eng, params=(N_UNTAPPED,))
    out: list[UntappedPI] = []
    for r in df.itertuples(index=False):
        fn = (_na(r.first_name) or "").title()
        ln = (_na(r.last_name) or "").title()
        name = f"Dr. {fn} {ln}".strip()
        out.append(UntappedPI(
            npi=int(r.npi), name=name or f"HCP {int(r.npi)}",
            specialty=_short_specialty(r.specialty),
            state=_na(r.st) or "—", region=region_for_state(_na(r.st)),
            patientCount=int(r.patient_count or 0), decile=int(r.decile or 0),
            hcoName=_na(r.hco), referralCentrality=0.0,
        ))
    return out


def _build_saturation(eng) -> list[SaturationStat]:
    th = pd.read_sql("SELECT trial_id, npi, facility_state FROM trial_hcp", eng)
    ct = pd.read_sql("SELECT trial_id, condition_mesh_terms FROM clinical_trial", eng)
    out: list[SaturationStat] = []

    # by state
    by_state = th.groupby("facility_state").agg(
        trials=("trial_id", "nunique"), investigators=("npi", "nunique")).reset_index()
    max_state = int(by_state["trials"].max()) if len(by_state) else 1
    load = th.dropna(subset=["npi"]).groupby(["facility_state", "npi"])["trial_id"].nunique().reset_index()
    over_by_state = (load[load["trial_id"] > OVERCOMMIT_THRESHOLD]
                     .groupby("facility_state")["npi"].nunique().to_dict())
    for r in by_state.sort_values("trials", ascending=False).itertuples(index=False):
        if not isinstance(r.facility_state, str):
            continue
        out.append(SaturationStat(
            key=r.facility_state, dimension="state",
            trials=int(r.trials), investigators=int(r.investigators),
            competingDensity=round(int(r.trials) / max_state, 3),
            overCommitted=int(over_by_state.get(r.facility_state, 0)),
        ))

    # by condition
    ct["cond"] = ct["condition_mesh_terms"].map(_primary_condition)
    cond_counts = ct.groupby("cond")["trial_id"].nunique().sort_values(ascending=False).head(10)
    max_cond = int(cond_counts.iloc[0]) if len(cond_counts) else 1
    for cond, n in cond_counts.items():
        out.append(SaturationStat(
            key=cond, dimension="condition", trials=int(n), investigators=0,
            competingDensity=round(int(n) / max_cond, 3), overCommitted=0,
        ))
    return out


def _build_whitespace(eng, sites: list[Site]) -> list[WhitespaceRegion]:
    geo = pd.read_sql("SELECT * FROM patient_geo", eng)
    grp = geo.groupby("state").agg(
        pc=("patient_count", "sum"),
        white=("white", "sum"), black=("black", "sum"),
        asian=("asian", "sum"), hispanic=("hispanic", "sum"), other=("other", "sum")).reset_index()
    sites_by_state: dict[str, int] = {}
    for s in sites:
        sites_by_state[s.state] = sites_by_state.get(s.state, 0) + 1
    max_pc = int(grp["pc"].max()) if len(grp) else 1
    out: list[WhitespaceRegion] = []
    for r in grp.sort_values("pc", ascending=False).itertuples(index=False):
        st = r.state
        if not isinstance(st, str):
            continue
        classified = (r.white + r.black + r.asian + r.hispanic) or 1
        non_white = round((r.black + r.asian + r.hispanic) / classified, 3)
        n_sites = sites_by_state.get(st, 0)
        density_n = int(r.pc) / max_pc
        # whitespace = high density, low/no coverage
        score = round(density_n * (1.0 if n_sites == 0 else 0.3), 3)
        out.append(WhitespaceRegion(
            state=st, region=region_for_state(st),
            patientDensity=int(r.pc), siteCount=n_sites, hasSite=n_sites > 0,
            diversityIndex=non_white, whitespaceScore=score,
        ))
    return out


# --------------------------------------------------------------------------- #
# top-level builder
# --------------------------------------------------------------------------- #


@lru_cache
def build_dataset() -> Dataset:
    eng = db.ENGINE
    distributions, universe = _build_distributions(eng)
    female_frac = distributions.genderSplit.get("F", 0.58)

    # treated proxy = patients with an identifiable payer channel (excl. Unknown)
    pay = pd.read_sql("SELECT payer_channel, patient_count FROM patient_payer", eng)
    payer_treated = int(pay[~pay["payer_channel"].str.lower().eq("unknown")]["patient_count"].sum())

    sites = _build_sites(eng, universe, female_frac)
    graph, weighted_degree = _referral_graph(eng)
    kols, edges = _build_kols(eng, graph, weighted_degree)
    indications = _build_indications(eng, universe, payer_treated)
    trials = _build_trials(eng)
    untapped = _build_untapped(eng)
    saturation = _build_saturation(eng)
    whitespace = _build_whitespace(eng, sites)

    return Dataset(
        seed=0,
        dataVersion=DATA_VERSION,
        program=PROGRAM,
        totalUniverse=universe,
        criteria=_build_criteria_db(),
        sites=sites,
        kols=kols,
        kolEdges=edges,
        indications=indications,
        regions=["Northeast", "Southeast", "Midwest", "Southwest", "West"],
        benchmarks=Benchmarks(
            # screen-fail / per-site rate are NOT in RWD — labeled assumptions
            avgScreenFailRate=0.28,
            avgPerSiteRatePerMonth=1.4,
            avgActivationMonths=3,
        ),
        dataSource="db",
        trials=trials,
        untappedPIs=untapped,
        saturation=saturation,
        whitespace=whitespace,
        distributions=distributions,
    )
