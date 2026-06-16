"""ETL: load the dropped real RWD files into `alfadev.db`.

Run:  cd backend && PYTHONPATH=. ./.venv/Scripts/python.exe -m app.data.etl

Idempotent — drops and recreates every table on each run. Reads the CSVs with
pandas and the ILLUMINATE1 site list with openpyxl, cleans (state normalization,
ZIP repair, decimal→int counts, NPI dedupe across decile files, NULL-key drops),
fuzzy-matches each HCP's primary HCO name→HCO NPI, then bulk-loads via to_sql.
Prints row-count assertions + a data-quality report.
"""
from __future__ import annotations

import re

import pandas as pd

from app.data import db
from app.data.geo import STATE_CENTROID, normalize_state
from app.data.zip_geocode import geocode as geocode_zip

DATA = db.DATA_DIR


def _geocode_hcp(npi, zip_code, state) -> tuple[float | None, float | None, str | None]:
    """Layered geocode + deterministic per-NPI jitter so co-located pins don't stack.

    Jitter is seeded from the NPI (stable across runs) and scaled by source
    precision: tiny for ZCTA centroids, larger for coarse ZIP3/state fallbacks.
    """
    lat, lng, src = geocode_zip(zip_code)
    if lat is None and state and state in STATE_CENTROID:
        lat, lng = STATE_CENTROID[state]
        src = "state"
    if lat is None:
        return None, None, None
    try:
        n = int(npi)
    except (ValueError, TypeError):
        n = 0
    amp = {"zcta": 0.012, "zip3": 0.06, "state": 0.5}.get(src, 0.02)
    jx = ((n % 100000) / 100000.0 - 0.5)
    jy = ((n // 100000 % 100000) / 100000.0 - 0.5)
    return round(lat + jy * amp, 5), round(lng + jx * amp, 5), src


# --------------------------------------------------------------------------- #
# Cleaning helpers
# --------------------------------------------------------------------------- #


def clean_zip(value) -> str | None:
    """Digits only; collapse malformed 6+ digit ZIPs (e.g. 922845) to first 5."""
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    digits = re.sub(r"\D", "", str(value))
    if not digits:
        return None
    if len(digits) >= 5:
        return digits[:5]
    return digits.zfill(5) if len(digits) == 4 else digits


def clean_zip3(value) -> str | None:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    digits = re.sub(r"\D", "", str(value))
    return digits.zfill(3)[:3] if digits else None


def to_int(value) -> int | None:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    try:
        return int(round(float(value)))
    except (ValueError, TypeError):
        return None


def to_bigint(value) -> int | None:
    """NPIs: keep as int, drop non-numeric / null."""
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    try:
        n = int(float(value))
        return n if n > 0 else None
    except (ValueError, TypeError):
        return None


_SUFFIXES = re.compile(
    r"\b(LLC|L L C|INC|INCORPORATED|LLP|LP|PLLC|PC|PA|CORP|CORPORATION|CO|LTD|"
    r"GROUP|ASSOCIATES|ASSOC|CENTER|CENTRE|CLINIC|HOSPITAL|HEALTH|HEALTHCARE|"
    r"SERVICES|SYSTEM|MEDICAL|THE|OF|AND)\b"
)


def norm_name(value) -> str:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return ""
    s = str(value).upper()
    s = re.sub(r"[^A-Z0-9 ]", " ", s)
    s = _SUFFIXES.sub(" ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


# --------------------------------------------------------------------------- #
# Loaders (return cleaned DataFrames with columns matching db.py models)
# --------------------------------------------------------------------------- #


def load_hco() -> pd.DataFrame:
    df = pd.read_csv(DATA / "HCO Data Decile 6-10.csv", dtype=str)
    df = df.rename(columns={
        "HCO Rank": "rank", "Decile": "decile", "HCO NPI": "npi", "HCO Name": "name",
        "HCO Classification": "classification", "HCO Facility Type": "facility_type",
        "HCO Address": "address", "HCO City": "city", "HCO State": "state",
        "HCO Zip": "zip", "Patient Counts": "patient_count",
    })
    df["npi"] = df["npi"].map(to_bigint)
    df = df.dropna(subset=["npi"]).drop_duplicates(subset=["npi"], keep="first")
    df["rank"] = df["rank"].map(to_int)
    df["decile"] = df["decile"].map(to_int)
    df["patient_count"] = df["patient_count"].map(to_int)
    df["state"] = df["state"].map(normalize_state)
    df["zip"] = df["zip"].map(clean_zip)
    for c in ["name", "classification", "facility_type", "address", "city"]:
        df[c] = df[c].astype("string").str.strip()
    return df[["npi", "rank", "decile", "name", "classification", "facility_type",
               "address", "city", "state", "zip", "patient_count"]]


def load_hcp(hco_df: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    files = ["HCP Data Decile 7-10.csv", "HCP Data Decile 6.csv"]
    frames = [pd.read_csv(DATA / f, dtype=str) for f in files]
    df = pd.concat(frames, ignore_index=True)
    df = df.rename(columns={
        "HCP Rank": "rank", "Decile": "decile", "HCP NPI": "npi",
        "HCP First Name": "first_name", "HCP Last Name": "last_name",
        "HCP Specialty": "specialty", "Primary HCO Name": "primary_hco_name",
        "Primary HCO Classification": "primary_hco_classification",
        "Primary HCO Facility Type": "primary_hco_facility_type",
        "Primary HCO Address": "primary_hco_address",
        "Primary HCO City": "primary_hco_city",
        "Primary HCO State": "primary_hco_state",
        "Primary HCO Zip ": "primary_hco_zip",  # note trailing space in source header
        "Patient Counts": "patient_count",
    })
    df["npi"] = df["npi"].map(to_bigint)
    df = df.dropna(subset=["npi"])
    # dedupe NPIs across decile files — keep the highest-decile (most prolific) row
    df["decile"] = df["decile"].map(to_int)
    df = df.sort_values("decile", ascending=False, na_position="last")
    df = df.drop_duplicates(subset=["npi"], keep="first")
    df["rank"] = df["rank"].map(to_int)
    df["patient_count"] = df["patient_count"].map(to_int)
    df["primary_hco_state"] = df["primary_hco_state"].map(normalize_state)
    df["primary_hco_zip"] = df["primary_hco_zip"].map(clean_zip)
    for c in ["first_name", "last_name", "specialty", "primary_hco_name",
              "primary_hco_classification", "primary_hco_facility_type",
              "primary_hco_address", "primary_hco_city"]:
        df[c] = df[c].astype("string").str.strip()

    # --- fuzzy match Primary HCO Name + city + state -> hco.npi --------------- #
    hco_idx_full: dict[tuple, int] = {}
    hco_idx_state: dict[tuple, int] = {}
    for _, h in hco_df.iterrows():
        nn = norm_name(h["name"])
        if not nn:
            continue
        city = (h["city"] or "").upper().strip() if pd.notna(h["city"]) else ""
        st = h["state"] or ""
        hco_idx_full.setdefault((nn, city, st), int(h["npi"]))
        hco_idx_state.setdefault((nn, st), int(h["npi"]))

    def match(row) -> int | None:
        nn = norm_name(row["primary_hco_name"])
        if not nn:
            return None
        city = (row["primary_hco_city"] or "").upper().strip() if pd.notna(row["primary_hco_city"]) else ""
        st = row["primary_hco_state"] or ""
        return hco_idx_full.get((nn, city, st)) or hco_idx_state.get((nn, st))

    df["primary_hco_npi"] = df.apply(match, axis=1).astype("Int64")
    matched = int(df["primary_hco_npi"].notna().sum())
    total = len(df)

    # --- geocode each HCP: ZIP5 ZCTA -> ZIP3 centroid -> state centroid --------- #
    geo = df.apply(lambda r: _geocode_hcp(r["npi"], r["primary_hco_zip"], r["primary_hco_state"]), axis=1)
    df["lat"] = [g[0] for g in geo]
    df["lng"] = [g[1] for g in geo]
    df["geo_source"] = [g[2] for g in geo]
    geocoded = int(df["lat"].notna().sum())
    src_counts = df["geo_source"].value_counts(dropna=True).to_dict()
    report = {"hcp_total": total, "hcp_hco_matched": matched,
              "hcp_hco_match_rate": round(matched / total, 4) if total else 0.0,
              "hcp_geocoded": geocoded,
              "hcp_geocode_rate": round(geocoded / total, 4) if total else 0.0,
              "hcp_geo_sources": {str(k): int(v) for k, v in src_counts.items()}}

    cols = ["npi", "rank", "decile", "first_name", "last_name", "specialty",
            "primary_hco_name", "primary_hco_classification", "primary_hco_facility_type",
            "primary_hco_address", "primary_hco_city", "primary_hco_state",
            "primary_hco_zip", "patient_count", "primary_hco_npi", "lat", "lng", "geo_source"]
    return df[cols], report


def load_referral() -> pd.DataFrame:
    df = pd.read_csv(DATA / "HCP Referral.csv", dtype=str)
    df = df.rename(columns={
        "HCP NPI": "hcp_npi", "Number of Outbound Patients": "num_outbound",
        "Share of Outbound Patients": "share_outbound",
        "Connected HCP NPI": "connected_hcp_npi",
        "Number of Inbound Patients": "num_inbound",
        "Share of Inbound Patients": "share_inbound",
        "Connected HCP Specialty": "connected_specialty",
        "Connected HCP Primary HCO Classification": "connected_hco_classification",
        "Connected HCP Primary HCO Name": "connected_hco_name",
        "Connected HCP Primary HCO Address": "connected_hco_address",
        "Connected HCP Primary HCO City": "connected_hco_city",
        "Connected HCP Primary HCO Facility Type": "connected_hco_facility_type",
        "Connected HCP Primary HCO Zip": "connected_hco_zip",
        "Connected HCP Primary HCO State": "connected_hco_state",
    })
    df["hcp_npi"] = df["hcp_npi"].map(to_bigint)
    df["connected_hcp_npi"] = df["connected_hcp_npi"].map(to_bigint)
    df = df.dropna(subset=["hcp_npi", "connected_hcp_npi"])
    df["num_outbound"] = df["num_outbound"].map(to_int)
    df["num_inbound"] = df["num_inbound"].map(to_int)
    df["share_outbound"] = pd.to_numeric(df["share_outbound"], errors="coerce")
    df["share_inbound"] = pd.to_numeric(df["share_inbound"], errors="coerce")
    df["connected_hco_state"] = df["connected_hco_state"].map(normalize_state)
    df["connected_hco_zip"] = df["connected_hco_zip"].map(clean_zip)
    for c in ["connected_specialty", "connected_hco_classification", "connected_hco_name",
              "connected_hco_address", "connected_hco_city", "connected_hco_facility_type"]:
        df[c] = df[c].astype("string").str.strip()
    cols = ["hcp_npi", "num_outbound", "share_outbound", "connected_hcp_npi",
            "num_inbound", "share_inbound", "connected_specialty",
            "connected_hco_classification", "connected_hco_name", "connected_hco_address",
            "connected_hco_city", "connected_hco_facility_type", "connected_hco_zip",
            "connected_hco_state"]
    return df[cols]


def load_trials() -> tuple[pd.DataFrame, pd.DataFrame]:
    df = pd.read_csv(DATA / "HCP Clinical Trial.csv", dtype=str)
    df = df.rename(columns={
        "Trial ID": "trial_id", "NPI": "npi", "HCP First Name": "first_name",
        "HCP Last Name": "last_name", "Trial Title": "title",
        "Trial Status": "status", "Trial Detailed Status": "detailed_status",
        "Trial Start Date": "start_date", "Trial End Date": "end_date",
        "Phase": "phase", "Lead Sponsor": "lead_sponsor",
        "Lead Sponsor Class": "lead_sponsor_class",
        "Condition Mesh Terms": "condition_mesh_terms",
        "Facility City": "facility_city", "Facility State": "facility_state",
        "Facility Zip": "facility_zip",
    })
    df = df.dropna(subset=["trial_id"])
    df["npi"] = df["npi"].map(to_bigint).astype("Int64")
    df["facility_state"] = df["facility_state"].map(normalize_state)
    df["facility_zip"] = df["facility_zip"].map(clean_zip)
    for c in ["first_name", "last_name", "title", "status", "detailed_status",
              "start_date", "end_date", "phase", "lead_sponsor", "lead_sponsor_class",
              "condition_mesh_terms", "facility_city"]:
        df[c] = df[c].astype("string").str.strip()

    trial_hcp = df[["trial_id", "npi", "first_name", "last_name",
                    "facility_city", "facility_state", "facility_zip"]].copy()

    trials = (df.sort_values("trial_id")
                .drop_duplicates(subset=["trial_id"], keep="first")
                [["trial_id", "title", "status", "detailed_status", "start_date",
                  "end_date", "phase", "lead_sponsor", "lead_sponsor_class",
                  "condition_mesh_terms"]].copy())
    return trials, trial_hcp


def load_sites() -> pd.DataFrame:
    import openpyxl

    wb = openpyxl.load_workbook(DATA / "ILLUMINATE1_Site_Locations.xlsx",
                                read_only=True, data_only=True)
    ws = wb["Site List"]
    rows = list(ws.iter_rows(values_only=True))
    # row index 2 is the header (#, Facility, City, ...); data follows
    header = [str(h).strip() if h is not None else "" for h in rows[2]]
    data = [r for r in rows[3:] if r and r[0] is not None]
    raw = pd.DataFrame(data, columns=header)
    df = pd.DataFrame({
        "facility": raw["Facility"].astype("string").str.strip(),
        "city": raw["City"].astype("string").str.strip(),
        "state": raw["State"].map(normalize_state),
        "zip": raw["ZIP"].map(clean_zip),
        "status": raw["Status"].astype("string").str.strip(),
        "primary_contact": raw["Primary Contact"].astype("string").str.strip(),
        "phone": raw["Phone"].astype("string").str.strip(),
        "email": raw["Email"].astype("string").str.strip(),
        "lat": pd.to_numeric(raw["Latitude"], errors="coerce"),
        "lng": pd.to_numeric(raw["Longitude"], errors="coerce"),
    })
    return df


def load_patient_breakdowns() -> dict[str, pd.DataFrame]:
    geo = pd.read_csv(DATA / "Patient Count By State & ZIP3.csv")
    geo = pd.DataFrame({
        "state": geo["Patient State"].map(normalize_state),
        "zip3": geo["Patient ZIP-3"].map(clean_zip3),
        "patient_count": geo["Cohort Patient Count or %"].map(to_int),
        "white": geo["White"].map(to_int),
        "black": geo["Black or African American"].map(to_int),
        "asian": geo["Asian or Pacific Islander"].map(to_int),
        "hispanic": geo["Hispanic or Latino"].map(to_int),
        "other": geo["Other"].map(to_int),
        "unknown": geo["Unknown"].map(to_int),
    })

    age = pd.read_csv(DATA / "Patient Count By Age.csv")
    age = pd.DataFrame({"age_band": age["PATIENT_AGE"].astype(str).str.strip(),
                        "patient_count": age["Cohort Patient Count or %"].map(to_int)})

    gen = pd.read_csv(DATA / "Patient Count By Gender.csv")
    gen = pd.DataFrame({"gender": gen.iloc[:, 0].astype(str).str.strip(),
                        "patient_count": gen.iloc[:, 1].map(to_int)})

    pay = pd.read_csv(DATA / "Patient Count By Payer Channel.csv")
    pay = pd.DataFrame({"payer_channel": pay.iloc[:, 0].astype(str).str.strip(),
                        "patient_count": pay.iloc[:, 1].map(to_int)})

    plan = pd.read_csv(DATA / "Patient Count By Plan.csv")
    plan = pd.DataFrame({"payer_name": plan.iloc[:, 0].astype(str).str.strip(),
                         "patient_count": plan.iloc[:, 1].map(to_int)})
    plan = plan.dropna(subset=["payer_name"]).drop_duplicates(subset=["payer_name"], keep="first")

    return {"patient_geo": geo, "patient_age": age, "patient_gender": gen,
            "patient_payer": pay, "patient_plan": plan}


# --------------------------------------------------------------------------- #
# Orchestration
# --------------------------------------------------------------------------- #


def run() -> dict:
    print("ETL: loading + cleaning source files…")
    hco = load_hco()
    hcp, match_report = load_hcp(hco)
    referral = load_referral()
    trials, trial_hcp = load_trials()
    sites = load_sites()
    breakdowns = load_patient_breakdowns()

    print("ETL: rebuilding schema…")
    db.drop_all()
    db.create_all()

    eng = db.ENGINE
    hco.to_sql("hco", eng, if_exists="append", index=False)
    hcp.to_sql("hcp", eng, if_exists="append", index=False)
    referral.to_sql("hcp_referral", eng, if_exists="append", index=False)
    trials.to_sql("clinical_trial", eng, if_exists="append", index=False)
    trial_hcp.to_sql("trial_hcp", eng, if_exists="append", index=False)
    sites.to_sql("illuminate_site", eng, if_exists="append", index=False)
    for name, frame in breakdowns.items():
        frame.to_sql(name, eng, if_exists="append", index=False)

    counts = {
        "hcp": len(hcp), "hco": len(hco), "hcp_referral": len(referral),
        "clinical_trial": len(trials), "trial_hcp": len(trial_hcp),
        "illuminate_site": len(sites),
        "patient_geo": len(breakdowns["patient_geo"]),
        "patient_age": len(breakdowns["patient_age"]),
        "patient_gender": len(breakdowns["patient_gender"]),
        "patient_payer": len(breakdowns["patient_payer"]),
        "patient_plan": len(breakdowns["patient_plan"]),
    }
    universe = int(breakdowns["patient_geo"]["patient_count"].sum())

    print("\n=== ROW COUNTS ===")
    for k, v in counts.items():
        print(f"  {k:18s} {v:>8,}")
    print("\n=== DATA QUALITY ===")
    print(f"  total patient universe (sum ZIP3): {universe:,}")
    print(f"  HCP→HCO fuzzy match rate: {match_report['hcp_hco_match_rate']:.1%} "
          f"({match_report['hcp_hco_matched']:,}/{match_report['hcp_total']:,})")
    print(f"  HCP geocoded: {match_report['hcp_geocode_rate']:.1%} "
          f"({match_report['hcp_geocoded']:,}/{match_report['hcp_total']:,}) "
          f"by source {match_report['hcp_geo_sources']}")
    print(f"  sites with lat/lng: {int(sites['lat'].notna().sum())}/{len(sites)}")
    print(f"  HCPs with null primary_hco_state: "
          f"{int(hcp['primary_hco_state'].isna().sum()):,}")

    # row-count assertions (approximate expected volumes)
    assert counts["illuminate_site"] == 26, f"expected 26 sites, got {counts['illuminate_site']}"
    assert 10_000 <= counts["hcp"] <= 11_000, counts["hcp"]
    assert 1_700 <= counts["hco"] <= 1_900, counts["hco"]
    assert 95_000 <= counts["hcp_referral"] <= 101_000, counts["hcp_referral"]
    assert 1_300 <= counts["trial_hcp"] <= 1_500, counts["trial_hcp"]
    print("\nETL complete. assertions passed ->", db.DB_PATH)
    return {"counts": counts, "universe": universe, **match_report}


if __name__ == "__main__":
    run()
