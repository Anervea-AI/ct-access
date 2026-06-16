"""Deterministic synthetic RWD generator.

Produces an internally-consistent dataset for a US neuropsychiatric program
(bipolar I depression). Seeded, so the same seed always yields
byte-identical data — this is what lets the client cascade and the server-side
assistant agree on every number.

NOTE: this is synthetic data for a Phase-0 prototype. No real patient data.
"""
from __future__ import annotations

import random

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
    ParamSpec,
    Site,
)

DATA_VERSION = "2026-06-refresh-01"
PROGRAM = "Bipolar I Depression (US)"
TOTAL_UNIVERSE = 1_200_000

REGIONS = ["Northeast", "Southeast", "Midwest", "Southwest", "West"]

# (city, state, region, lat, lng) — real coordinates so the map reads realistically
CITIES: list[tuple[str, str, str, float, float]] = [
    ("Boston", "MA", "Northeast", 42.3601, -71.0589),
    ("New York", "NY", "Northeast", 40.7128, -74.0060),
    ("Philadelphia", "PA", "Northeast", 39.9526, -75.1652),
    ("Pittsburgh", "PA", "Northeast", 40.4406, -79.9959),
    ("Baltimore", "MD", "Northeast", 39.2904, -76.6122),
    ("Hartford", "CT", "Northeast", 41.7658, -72.6734),
    ("Newark", "NJ", "Northeast", 40.7357, -74.1724),
    ("Atlanta", "GA", "Southeast", 33.7490, -84.3880),
    ("Miami", "FL", "Southeast", 25.7617, -80.1918),
    ("Orlando", "FL", "Southeast", 28.5383, -81.3792),
    ("Tampa", "FL", "Southeast", 27.9506, -82.4572),
    ("Charlotte", "NC", "Southeast", 35.2271, -80.8431),
    ("Nashville", "TN", "Southeast", 36.1627, -86.7816),
    ("New Orleans", "LA", "Southeast", 29.9511, -90.0715),
    ("Birmingham", "AL", "Southeast", 33.5186, -86.8104),
    ("Chicago", "IL", "Midwest", 41.8781, -87.6298),
    ("Detroit", "MI", "Midwest", 42.3314, -83.0458),
    ("Minneapolis", "MN", "Midwest", 44.9778, -93.2650),
    ("Columbus", "OH", "Midwest", 39.9612, -82.9988),
    ("Cleveland", "OH", "Midwest", 41.4993, -81.6944),
    ("St. Louis", "MO", "Midwest", 38.6270, -90.1994),
    ("Kansas City", "MO", "Midwest", 39.0997, -94.5786),
    ("Indianapolis", "IN", "Midwest", 39.7684, -86.1581),
    ("Milwaukee", "WI", "Midwest", 43.0389, -87.9065),
    ("Houston", "TX", "Southwest", 29.7604, -95.3698),
    ("Dallas", "TX", "Southwest", 32.7767, -96.7970),
    ("San Antonio", "TX", "Southwest", 29.4241, -98.4936),
    ("Austin", "TX", "Southwest", 30.2672, -97.7431),
    ("Phoenix", "AZ", "Southwest", 33.4484, -112.0740),
    ("Albuquerque", "NM", "Southwest", 35.0844, -106.6504),
    ("Las Vegas", "NV", "Southwest", 36.1699, -115.1398),
    ("Los Angeles", "CA", "West", 34.0522, -118.2437),
    ("San Francisco", "CA", "West", 37.7749, -122.4194),
    ("San Diego", "CA", "West", 32.7157, -117.1611),
    ("Seattle", "WA", "West", 47.6062, -122.3321),
    ("Portland", "OR", "West", 45.5152, -122.6784),
    ("Denver", "CO", "West", 39.7392, -104.9903),
    ("Sacramento", "CA", "West", 38.5816, -121.4944),
    ("Salt Lake City", "UT", "West", 40.7608, -111.8910),
    ("San Jose", "CA", "West", 37.3382, -121.8863),
]

SPECIALTIES = ["Psychiatry", "Neurology", "Primary Care", "Research Center"]

# regional demographic skews (true-ish disease distribution by region)
REGION_DEMO = {
    "Northeast": dict(black=16, hispanic=14, asian=8),
    "Southeast": dict(black=26, hispanic=15, asian=4),
    "Midwest": dict(black=14, hispanic=9, asian=4),
    "Southwest": dict(black=10, hispanic=34, asian=5),
    "West": dict(black=8, hispanic=29, asian=14),
}


def _build_criteria() -> list[Criterion]:
    """The bipolar I depression trial I/E set. Reductions are % of the remaining
    pool removed at the default parameter value. Proxy criteria expose a strictness
    parameter and a confidence note (PRD §5.3)."""
    return [
        Criterion(
            id="dx_bipolar1", type="inclusion", category="diagnosis",
            label="Bipolar I disorder diagnosis", codes=["ICD-10 F31.1x", "F31.2x", "F31.6x"],
            baseReductionPct=0,
            proxyNote=None,
        ),
        Criterion(
            id="inc_current_mde", type="inclusion", category="episode",
            label="Current major depressive episode", isProxy=True, confidence="medium",
            codes=["F31.3x", "F31.4", "F31.5"],
            proxyNote="Approximated from claim recency + a treatment change within the lookback window.",
            baseReductionPct=55,
            param=ParamSpec(name="lookbackDays", value=90, min=30, max=365, step=15, default=90, unit="days"),
            paramSlope=-25,
        ),
        Criterion(
            id="inc_age", type="inclusion", category="demographic",
            label="Age 18 to upper limit", codes=["—"],
            baseReductionPct=12,
            # cohort is [18, maxAge]; the slider sets the UPPER limit, so its lower
            # bound is the fixed 18-year floor the funnel uses (was 55, which read as
            # if 55 were the minimum age). age_histogram path ignores min/max for the
            # math — they're UI bounds only — so this is numerically inert in RWD mode.
            param=ParamSpec(name="maxAge", value=65, min=18, max=80, step=1, default=65, unit="years"),
            paramSlope=-10,
        ),
        Criterion(
            id="inc_severity", type="inclusion", category="severity",
            label="Moderate-to-severe depression (MADRS ≥ 20)", isProxy=True, confidence="low",
            codes=["proxy"],
            proxyNote="No MADRS in claims. Approximated from treatment intensity, polypharmacy, recent hospitalization, and ECT.",
            baseReductionPct=35,
            param=ParamSpec(name="severityStrictness", value=50, min=0, max=100, step=5, default=50, unit="index"),
            paramSlope=30,
        ),
        Criterion(
            id="inc_treatment_stable", type="inclusion", category="treatment",
            label="Stable mood stabilizer / antipsychotic", codes=["NDC mood stabilizers"],
            baseReductionPct=25,
            param=ParamSpec(name="stableWeeks", value=4, min=2, max=12, step=1, default=4, unit="weeks"),
            paramSlope=15,
        ),
        Criterion(
            id="exc_psychosis", type="exclusion", category="psychiatric",
            label="Active psychotic features", codes=["F31.2x with psychosis"],
            baseReductionPct=10,
        ),
        Criterion(
            id="exc_substance", type="exclusion", category="substance",
            label="Substance use disorder", isProxy=True, confidence="low",
            codes=["F10-F19"],
            proxyNote="Claims under-capture SUD. Approximated from coded diagnoses + MAT prescriptions.",
            baseReductionPct=18,
            param=ParamSpec(name="sudStrictness", value=50, min=0, max=100, step=5, default=50, unit="index"),
            paramSlope=10,
        ),
        Criterion(
            id="exc_suicidality", type="exclusion", category="safety",
            label="Recent suicidality / self-harm", isProxy=True, confidence="low",
            codes=["R45.851", "T14.91", "Z91.5"],
            proxyNote="Self-harm / ideation ICD codes + ER encounters. Understates true rate.",
            baseReductionPct=8,
        ),
        Criterion(
            id="exc_antipsychotic_washout", type="exclusion", category="washout",
            label="Antipsychotic washout", codes=["NDC antipsychotics"],
            baseReductionPct=22,
            param=ParamSpec(name="washoutDays", value=14, min=7, max=42, step=7, default=14, unit="days"),
            paramSlope=20,
        ),
        Criterion(
            id="exc_renal_hepatic", type="exclusion", category="comorbidity",
            label="Significant renal/hepatic impairment", codes=["N18.x", "K70-K77"],
            baseReductionPct=6,
        ),
        Criterion(
            id="exc_pregnancy", type="exclusion", category="safety",
            label="Pregnancy / breastfeeding", codes=["Z33.1", "O09.x", "Z39.1"],
            baseReductionPct=4,
        ),
        Criterion(
            id="exc_recent_trial", type="exclusion", category="washout",
            label="Other investigational trial < 30 days", codes=["—"],
            baseReductionPct=5,
        ),
    ]


def _build_sites(rng: random.Random) -> list[Site]:
    sites: list[Site] = []
    for i, (city, state, region, lat, lng) in enumerate(CITIES):
        demo = REGION_DEMO[region]
        # jitter coordinates slightly so co-located sites do not overlap
        jlat = lat + rng.uniform(-0.05, 0.05)
        jlng = lng + rng.uniform(-0.05, 0.05)
        base_share = round(rng.uniform(0.0006, 0.0042), 5)
        black = max(2.0, round(demo["black"] + rng.uniform(-6, 6), 1))
        hispanic = max(2.0, round(demo["hispanic"] + rng.uniform(-6, 6), 1))
        asian = max(1.0, round(demo["asian"] + rng.uniform(-3, 3), 1))
        white = round(max(20.0, 100 - black - hispanic - asian - rng.uniform(2, 8)), 1)
        n_spec = rng.randint(1, 3)
        specialties = rng.sample(SPECIALTIES, n_spec)
        if "Psychiatry" not in specialties and rng.random() < 0.7:
            specialties[0] = "Psychiatry"
        sites.append(
            Site(
                id=f"site_{i + 1:03d}",
                name=f"{city} {rng.choice(['Clinical Research', 'Neuroscience Institute', 'Behavioral Health', 'Psychiatric Associates', 'Research Center'])}",
                lat=round(jlat, 4), lng=round(jlng, 4),
                region=region, state=state,
                baseShare=base_share,
                piExperienceTrials=rng.randint(0, 12),
                indicationRxVolume=rng.randint(40, 620),
                competingTrials=rng.randint(0, 5),
                specialties=specialties,
                demographics=Demographics(
                    blackPct=black, hispanicPct=hispanic, asianPct=asian,
                    whitePct=white, femalePct=round(rng.uniform(52, 64), 1),
                    ruralPct=round(rng.uniform(3, 38), 1),
                ),
            )
        )
    return sites


def _build_kols(rng: random.Random, sites: list[Site]) -> tuple[list[Kol], list[KolEdge]]:
    first = ["A.", "J.", "M.", "S.", "R.", "L.", "K.", "D.", "P.", "T.", "E.", "C."]
    last = ["Rivera", "Chen", "Patel", "Johnson", "Nguyen", "Kim", "Garcia", "Smith",
            "Okafor", "Becker", "Alvarez", "Wong", "Murphy", "Singh", "Cohen", "Diaz",
            "Foster", "Hughes", "Ito", "Klein", "Lopez", "Mehta", "Novak", "Park"]
    segments = ["established", "rising_star", "dol"]
    kols: list[Kol] = []
    n = 30
    for i in range(n):
        seg = rng.choices(segments, weights=[0.45, 0.35, 0.20])[0]
        region = rng.choice(REGIONS)
        # signal profiles vary by segment (real signal set: no publications/congress/digital)
        if seg == "established":
            sig = KolSignals(
                patientVolume=round(rng.uniform(0.6, 1.0), 2),
                referralCentrality=round(rng.uniform(0.6, 1.0), 2),
                referralReach=round(rng.uniform(0.6, 1.0), 2),
                trialLeadership=round(rng.uniform(0.6, 1.0), 2),
                trialRecency=round(rng.uniform(0.4, 0.9), 2),
                specialtyFit=round(rng.uniform(0.7, 1.0), 2),
            )
        elif seg == "rising_star":
            sig = KolSignals(
                patientVolume=round(rng.uniform(0.4, 0.8), 2),
                referralCentrality=round(rng.uniform(0.3, 0.7), 2),
                referralReach=round(rng.uniform(0.3, 0.7), 2),
                trialLeadership=round(rng.uniform(0.4, 0.85), 2),
                trialRecency=round(rng.uniform(0.7, 1.0), 2),
                specialtyFit=round(rng.uniform(0.5, 0.9), 2),
            )
        else:  # dol
            sig = KolSignals(
                patientVolume=round(rng.uniform(0.3, 0.7), 2),
                referralCentrality=round(rng.uniform(0.2, 0.6), 2),
                referralReach=round(rng.uniform(0.2, 0.6), 2),
                trialLeadership=round(rng.uniform(0.2, 0.6), 2),
                trialRecency=round(rng.uniform(0.3, 0.7), 2),
                specialtyFit=round(rng.uniform(0.4, 0.8), 2),
            )
        linked = [s.id for s in rng.sample(sites, rng.randint(0, 2))]
        kols.append(
            Kol(
                id=f"kol_{i + 1:02d}",
                name=f"Dr. {rng.choice(first)} {rng.choice(last)}",
                region=region,
                specialty=rng.choice(["Psychiatry", "Psychiatry", "Neurology", "Neuropsychiatry"]),
                segment=seg, signals=sig, linkedSiteIds=linked,
                trialCount=rng.randint(0, 14), competingTrials=rng.randint(0, 6),
            )
        )
    # edges: each KOL connects to a few others
    edges: list[KolEdge] = []
    kinds = ["referral", "coauthor", "coinvestigator"]
    seen: set[tuple[str, str]] = set()
    for k in kols:
        for _ in range(rng.randint(1, 3)):
            other = rng.choice(kols)
            if other.id == k.id:
                continue
            key = tuple(sorted((k.id, other.id)))
            if key in seen:
                continue
            seen.add(key)
            edges.append(
                KolEdge(source=k.id, target=other.id,
                        kind=rng.choice(kinds), weight=round(rng.uniform(0.2, 1.0), 2))
            )
    return kols, edges


def _build_indications() -> list[IndicationOpportunity]:
    return [
        IndicationOpportunity(id="bipolar1_depression", label="Bipolar I depression",
                              diagnosed=1_200_000, treated=640_000, trialEligible=105_000,
                              competingTrialDensity=0.62, feasibilityScore=0.72),
        IndicationOpportunity(id="neg_symptom_schizophrenia", label="Negative-symptom schizophrenia",
                              diagnosed=1_050_000, treated=720_000, trialEligible=64_000,
                              competingTrialDensity=0.44, feasibilityScore=0.66),
        IndicationOpportunity(id="alzheimers_agitation", label="Alzheimer's agitation/psychosis",
                              diagnosed=2_300_000, treated=980_000, trialEligible=78_000,
                              competingTrialDensity=0.39, feasibilityScore=0.69),
        IndicationOpportunity(id="ptsd", label="PTSD",
                              diagnosed=3_600_000, treated=1_700_000, trialEligible=190_000,
                              competingTrialDensity=0.55, feasibilityScore=0.61),
    ]


def generate_dataset(seed: int) -> Dataset:
    rng = random.Random(seed)
    criteria = _build_criteria()
    sites = _build_sites(rng)
    kols, edges = _build_kols(rng, sites)
    indications = _build_indications()
    distributions = Distributions(
        ageHistogram=[
            AgeBand(band="18-24", lo=18, hi=24, count=int(TOTAL_UNIVERSE * 0.12)),
            AgeBand(band="25-44", lo=25, hi=44, count=int(TOTAL_UNIVERSE * 0.45)),
            AgeBand(band="45-64", lo=45, hi=64, count=int(TOTAL_UNIVERSE * 0.40)),
            AgeBand(band="65-88", lo=65, hi=88, count=int(TOTAL_UNIVERSE * 0.03)),
        ],
        genderSplit={"F": 0.66, "M": 0.33, "U": 0.01},
        payerMix={"MEDICAID": 0.39, "COMMERCIAL": 0.38, "MEDICARE": 0.20, "OTHER": 0.03},
        geoDemographics={"white": 0.55, "black": 0.18, "hispanic": 0.14, "asian": 0.05, "other": 0.08},
    )
    return Dataset(
        seed=seed,
        dataVersion=DATA_VERSION,
        program=PROGRAM,
        totalUniverse=TOTAL_UNIVERSE,
        criteria=criteria,
        sites=sites,
        kols=kols,
        kolEdges=edges,
        indications=indications,
        regions=REGIONS,
        benchmarks=Benchmarks(
            avgScreenFailRate=0.28,
            avgPerSiteRatePerMonth=1.4,
            avgActivationMonths=3,
        ),
        dataSource="synthetic",
        distributions=distributions,
    )
