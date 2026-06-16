"""Offline ZIP-code -> lat/lng geocoder.

Source: US Census 2020 ZCTA5 Gazetteer (public domain, bundled in
`geo_ref/2020_Gaz_zcta_national.txt`). Tab-delimited with a header; we read GEOID
(5-digit ZCTA, zero-padded) + INTPTLAT/INTPTLONG (internal-point lat/lng).

ZCTA != USPS ZIP, so some PO-box / unique ZIPs miss. We provide a layered lookup:
exact ZIP5 -> ZIP3 centroid (mean of all ZCTAs sharing the 3-digit prefix) so every
provider still plots, with provenance returned by `geocode`.
"""
from __future__ import annotations

import pathlib
from functools import lru_cache

GEO_REF = pathlib.Path(__file__).resolve().parent / "geo_ref"
GAZETTEER = GEO_REF / "2020_Gaz_zcta_national.txt"


@lru_cache(maxsize=1)
def _tables() -> tuple[dict[str, tuple[float, float]], dict[str, tuple[float, float]]]:
    """Return (zip5 -> (lat,lng), zip3 -> (lat,lng) centroid)."""
    zip5: dict[str, tuple[float, float]] = {}
    zip3_acc: dict[str, list[tuple[float, float]]] = {}
    if not GAZETTEER.exists():
        return zip5, {}
    with GAZETTEER.open(encoding="utf-8") as f:
        next(f, None)  # header
        for line in f:
            parts = line.rstrip("\n").split("\t")
            if len(parts) < 7:
                continue
            geoid = parts[0].strip().zfill(5)
            try:
                lat = float(parts[5].strip())
                lng = float(parts[6].strip())
            except ValueError:
                continue
            zip5[geoid] = (lat, lng)
            zip3_acc.setdefault(geoid[:3], []).append((lat, lng))
    zip3 = {
        z3: (sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts))
        for z3, pts in zip3_acc.items()
    }
    return zip5, zip3


def geocode(zip_code: str | None) -> tuple[float | None, float | None, str | None]:
    """(lat, lng, source) for a 5-digit ZIP; falls back to its ZIP3 centroid."""
    if not zip_code:
        return None, None, None
    z = str(zip_code).strip()
    if len(z) < 3 or not z[:3].isdigit():
        return None, None, None
    z5, z3 = _tables()
    z = z.zfill(5)[:5]
    if z in z5:
        lat, lng = z5[z]
        return lat, lng, "zcta"
    if z[:3] in z3:
        lat, lng = z3[z[:3]]
        return lat, lng, "zip3"
    return None, None, None
