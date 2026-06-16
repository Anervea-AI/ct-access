"""Interactive map endpoints (real RWD geography).

DB-only (like insights) — these read the SQLite warehouse directly rather than the
curated 40-KOL `Dataset`, because the map needs raw provider geography:
  - all 26 sites with real lat/lng
  - geocoded HCPs (ZIP-centroid), filtered/paged so we never ship all ~9k at once
  - HCPs within N miles of a site (haversine)
  - a clicked HCP's referral network (nodes + directed edges)
  - a full HCP profile (HCO, volume, decile, referral degree, trial history)
"""
from __future__ import annotations

import math
from functools import lru_cache
from typing import Optional

import numpy as np
import pandas as pd
from fastapi import APIRouter, HTTPException

from app.data import db
from app.data.etl import _geocode_hcp  # deterministic geocode + per-NPI jitter
from app.data.geo import region_for_state
from app.models.schemas import (
    HcpProfile,
    MapHcp,
    MapSiteOut,
    ReferralEdgeOut,
    ReferralNetwork,
    TrialSummary,
)

router = APIRouter(prefix="/api/map")


def _s(v) -> Optional[str]:
    if v is None or (isinstance(v, float) and math.isnan(v)):
        return None
    s = str(v).strip()
    return s or None


def _title(v) -> str:
    s = _s(v)
    return s.title() if s else ""


def _short_specialty(v) -> str:
    s = _s(v)
    return (s.split("-")[0].strip() if s else "") or ""


def _require_db() -> None:
    if not db.db_exists():
        raise HTTPException(status_code=503, detail="RWD database not built. Run: python -m app.data.etl")


# --------------------------------------------------------------------------- #
# cached warehouse reads
# --------------------------------------------------------------------------- #


@lru_cache(maxsize=1)
def _hcp_frame() -> pd.DataFrame:
    return pd.read_sql(
        "SELECT npi, first_name, last_name, specialty, primary_hco_name hco, "
        "primary_hco_city city, primary_hco_state state, decile, patient_count, "
        "lat, lng, geo_source FROM hcp WHERE lat IS NOT NULL AND lng IS NOT NULL",
        db.ENGINE,
    )


@lru_cache(maxsize=1)
def _hcp_index() -> dict:
    return {int(r.npi): r for r in _hcp_frame().itertuples(index=False)}


@lru_cache(maxsize=1)
def _referral_npis() -> set[int]:
    """All NPIs that appear in the referral graph (as referrer or connected)."""
    df = pd.read_sql(
        "SELECT hcp_npi AS npi FROM hcp_referral WHERE hcp_npi IS NOT NULL "
        "UNION SELECT connected_hcp_npi FROM hcp_referral WHERE connected_hcp_npi IS NOT NULL",
        db.ENGINE)
    return {int(n) for n in df["npi"].tolist()}


@lru_cache(maxsize=1)
def _site_list() -> list[MapSiteOut]:
    df = pd.read_sql("SELECT * FROM illuminate_site ORDER BY id", db.ENGINE)
    out: list[MapSiteOut] = []
    for i, r in enumerate(df.itertuples(index=False)):
        if r.lat is None or r.lng is None or (isinstance(r.lat, float) and math.isnan(r.lat)):
            continue
        out.append(MapSiteOut(
            id=f"site_{i + 1:03d}", name=_s(r.facility) or f"Site {i + 1}",
            lat=float(r.lat), lng=float(r.lng),
            city=_s(r.city), state=_s(r.state), status=_s(r.status),
        ))
    return out


def _row_to_maphcp(r) -> MapHcp:
    name = f"Dr. {_title(r.first_name)} {_title(r.last_name)}".strip()
    npi = int(r.npi)
    return MapHcp(
        npi=npi, name=name or f"HCP {npi}",
        specialty=_short_specialty(r.specialty), lat=float(r.lat), lng=float(r.lng),
        decile=int(r.decile or 0), patientCount=int(r.patient_count or 0),
        hcoName=_s(r.hco), city=_s(r.city), state=_s(r.state), geoSource=_s(r.geo_source),
        hasReferrals=npi in _referral_npis(),
    )


# --------------------------------------------------------------------------- #
# endpoints
# --------------------------------------------------------------------------- #


@router.get("/sites", response_model=list[MapSiteOut])
def map_sites() -> list[MapSiteOut]:
    _require_db()
    return _site_list()


@router.get("/hcps", response_model=list[MapHcp])
def map_hcps(decileMin: int = 7, specialty: Optional[str] = None, limit: int = 2000) -> list[MapHcp]:
    """Base HCP layer — filtered + capped so Leaflet stays responsive."""
    _require_db()
    df = _hcp_frame()
    df = df[df["decile"].fillna(0) >= decileMin]
    if specialty:
        df = df[df["specialty"].fillna("").str.contains(specialty, case=False, na=False)]
    df = df.sort_values("patient_count", ascending=False).head(max(1, min(limit, 5000)))
    return [_row_to_maphcp(r) for r in df.itertuples(index=False)]


@router.get("/nearby", response_model=list[MapHcp])
def nearby_hcps(siteId: str, radius: float = 50, decileMin: int = 0,
                specialty: Optional[str] = None, limit: int = 400) -> list[MapHcp]:
    """HCPs within `radius` miles of a site (haversine, bbox-prefiltered)."""
    _require_db()
    site = next((s for s in _site_list() if s.id == siteId), None)
    if site is None:
        raise HTTPException(status_code=404, detail=f"Unknown site {siteId}")
    df = _hcp_frame()
    if decileMin:
        df = df[df["decile"].fillna(0) >= decileMin]
    if specialty:
        df = df[df["specialty"].fillna("").str.contains(specialty, case=False, na=False)]
    lat0, lng0 = site.lat, site.lng
    dlat = radius / 69.0
    dlng = radius / (69.0 * max(0.1, math.cos(math.radians(lat0))))
    sub = df[df["lat"].between(lat0 - dlat, lat0 + dlat)
             & df["lng"].between(lng0 - dlng, lng0 + dlng)].copy()
    if sub.empty:
        return []
    R = 3958.8  # earth radius, miles
    la1, lo1 = math.radians(lat0), math.radians(lng0)
    la2 = np.radians(sub["lat"].to_numpy())
    lo2 = np.radians(sub["lng"].to_numpy())
    h = np.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * np.cos(la2) * np.sin((lo2 - lo1) / 2) ** 2
    sub["dist_mi"] = 2 * R * np.arcsin(np.sqrt(h))
    sub = sub[sub["dist_mi"] <= radius].sort_values(["patient_count"], ascending=False).head(limit)
    return [_row_to_maphcp(r) for r in sub.itertuples(index=False)]


@router.get("/hcp/{npi}/network", response_model=ReferralNetwork)
def hcp_network(npi: int, limit: int = 60) -> ReferralNetwork:
    """The clicked HCP's referral network: connected providers + directed edges.

    Connected providers are placed from the hcp table when present, else geocoded
    from the referral file's own connected-HCO ZIP, so the network isn't limited
    to decile-table providers.
    """
    _require_db()
    idx = _hcp_index()
    ref = pd.read_sql(
        "SELECT hcp_npi, connected_hcp_npi, share_outbound, share_inbound, "
        "connected_specialty, connected_hco_name, connected_hco_city, "
        "connected_hco_state, connected_hco_zip FROM hcp_referral "
        "WHERE hcp_npi = ? OR connected_hcp_npi = ?",
        db.ENGINE, params=(npi, npi))
    if ref.empty and npi not in idx:
        raise HTTPException(status_code=404, detail=f"No referral data for NPI {npi}")

    # center node
    nodes: dict[int, MapHcp] = {}
    if npi in idx:
        nodes[npi] = _row_to_maphcp(idx[npi])
    else:
        # geocode the center from any row that carries its geo (as connected)
        crow = ref[ref["connected_hcp_npi"] == npi].head(1)
        lat = lng = None
        if not crow.empty:
            lat, lng, _ = _geocode_hcp(npi, _s(crow.iloc[0]["connected_hco_zip"]), _s(crow.iloc[0]["connected_hco_state"]))
        if lat is None:
            raise HTTPException(status_code=404, detail=f"NPI {npi} cannot be placed on the map")
        nodes[npi] = MapHcp(npi=npi, name=f"NPI {npi}", lat=lat, lng=lng, hasReferrals=True)

    ref = ref.sort_values("share_outbound", ascending=False).head(limit)
    edges: list[ReferralEdgeOut] = []
    for r in ref.itertuples(index=False):
        src, tgt = int(r.hcp_npi), int(r.connected_hcp_npi)
        other = tgt if src == npi else src
        if other not in nodes:
            if other in idx:
                nodes[other] = _row_to_maphcp(idx[other])
            else:
                lat, lng, src = _geocode_hcp(other, _s(r.connected_hco_zip), _s(r.connected_hco_state))
                if lat is None:
                    continue  # cannot place this connected provider
                nodes[other] = MapHcp(
                    npi=other, name=_s(r.connected_hco_name) or f"NPI {other}",
                    specialty=_short_specialty(r.connected_specialty),
                    lat=lat, lng=lng, hcoName=_s(r.connected_hco_name),
                    city=_s(r.connected_hco_city), state=_s(r.connected_hco_state),
                    geoSource=src or "zcta", hasReferrals=True,
                )
        if src in nodes and tgt in nodes:
            edges.append(ReferralEdgeOut(
                source=src, target=tgt,
                shareOut=float(r.share_outbound) if r.share_outbound and not math.isnan(r.share_outbound) else 0.0,
                shareIn=float(r.share_inbound) if r.share_inbound and not math.isnan(r.share_inbound) else 0.0,
            ))
    return ReferralNetwork(center=npi, nodes=list(nodes.values()), edges=edges)


@router.get("/hcp/{npi}/profile", response_model=HcpProfile)
def hcp_profile(npi: int) -> HcpProfile:
    _require_db()
    row = pd.read_sql("SELECT * FROM hcp WHERE npi = ?", db.ENGINE, params=(npi,))
    if row.empty:
        raise HTTPException(status_code=404, detail=f"Unknown HCP NPI {npi}")
    r = row.iloc[0]

    out_cnt = pd.read_sql(
        "SELECT COUNT(DISTINCT connected_hcp_npi) n FROM hcp_referral WHERE hcp_npi = ?",
        db.ENGINE, params=(npi,)).iloc[0]["n"]
    in_cnt = pd.read_sql(
        "SELECT COUNT(DISTINCT hcp_npi) n FROM hcp_referral WHERE connected_hcp_npi = ?",
        db.ENGINE, params=(npi,)).iloc[0]["n"]
    top = pd.read_sql(
        "SELECT connected_hcp_npi, connected_specialty, connected_hco_name, "
        "share_outbound, share_inbound, num_outbound FROM hcp_referral "
        "WHERE hcp_npi = ? ORDER BY num_outbound DESC LIMIT 8",
        db.ENGINE, params=(npi,))
    idx = _hcp_index()
    top_referrals = []
    for t in top.itertuples(index=False):
        cn = int(t.connected_hcp_npi)
        nm = (f"Dr. {_title(idx[cn].first_name)} {_title(idx[cn].last_name)}".strip()
              if cn in idx else _s(t.connected_hco_name) or f"NPI {cn}")
        top_referrals.append({
            "npi": cn, "name": nm,
            "specialty": _short_specialty(t.connected_specialty),
            "hco": _s(t.connected_hco_name),
            "shareOut": float(t.share_outbound) if t.share_outbound and not math.isnan(t.share_outbound) else 0.0,
            "shareIn": float(t.share_inbound) if t.share_inbound and not math.isnan(t.share_inbound) else 0.0,
        })

    trials_df = pd.read_sql(
        "SELECT c.trial_id, c.title, c.phase, c.lead_sponsor, c.lead_sponsor_class, "
        "c.condition_mesh_terms, c.status, c.start_date, c.end_date "
        "FROM trial_hcp t JOIN clinical_trial c ON t.trial_id = c.trial_id "
        "WHERE t.npi = ?", db.ENGINE, params=(npi,))
    trials: list[TrialSummary] = []
    for t in trials_df.drop_duplicates("trial_id").itertuples(index=False):
        cond = (_s(t.condition_mesh_terms) or "").split(";")[0].strip()
        trials.append(TrialSummary(
            id=t.trial_id, title=(_s(t.title) or "")[:300], phase=_s(t.phase) or "",
            sponsor=_s(t.lead_sponsor) or "", sponsorClass=_s(t.lead_sponsor_class) or "",
            condition=cond or "Unspecified", status=_s(t.status) or "",
            startDate=_s(t.start_date), endDate=_s(t.end_date),
        ))

    name = f"Dr. {_title(r['first_name'])} {_title(r['last_name'])}".strip()
    return HcpProfile(
        npi=npi, name=name or f"HCP {npi}",
        firstName=_s(r["first_name"]), lastName=_s(r["last_name"]),
        specialty=_short_specialty(r["specialty"]),
        decile=int(r["decile"]) if pd.notna(r["decile"]) else 0,
        patientCount=int(r["patient_count"]) if pd.notna(r["patient_count"]) else 0,
        primaryHcoNpi=int(r["primary_hco_npi"]) if pd.notna(r["primary_hco_npi"]) else None,
        primaryHcoName=_s(r["primary_hco_name"]),
        primaryHcoClassification=_s(r["primary_hco_classification"]),
        primaryHcoFacilityType=_s(r["primary_hco_facility_type"]),
        primaryHcoAddress=_s(r["primary_hco_address"]),
        primaryHcoCity=_s(r["primary_hco_city"]),
        primaryHcoState=_s(r["primary_hco_state"]),
        primaryHcoZip=_s(r["primary_hco_zip"]),
        lat=float(r["lat"]) if pd.notna(r["lat"]) else None,
        lng=float(r["lng"]) if pd.notna(r["lng"]) else None,
        region=region_for_state(_s(r["primary_hco_state"])),
        outboundConnections=int(out_cnt), inboundConnections=int(in_cnt),
        referralDegree=int(out_cnt) + int(in_cnt),
        topReferrals=top_referrals, trials=trials,
    )
