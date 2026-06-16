"""US geography helpers — backend equivalent of the FIPS→region map in
`frontend/src/charts/USMap.tsx`. Keeps region assignment identical on both sides.
"""
from __future__ import annotations

# State abbreviation -> our 5 analytic regions. Mirrors FIPS_REGION in USMap.tsx.
STATE_REGION: dict[str, str] = {
    # Northeast
    "CT": "Northeast", "ME": "Northeast", "MA": "Northeast", "NH": "Northeast",
    "RI": "Northeast", "VT": "Northeast", "NJ": "Northeast", "NY": "Northeast",
    "PA": "Northeast",
    # Midwest
    "IL": "Midwest", "IN": "Midwest", "MI": "Midwest", "OH": "Midwest", "WI": "Midwest",
    "IA": "Midwest", "KS": "Midwest", "MN": "Midwest", "MO": "Midwest", "NE": "Midwest",
    "ND": "Midwest", "SD": "Midwest",
    # Southeast
    "AL": "Southeast", "AR": "Southeast", "DE": "Southeast", "DC": "Southeast",
    "FL": "Southeast", "GA": "Southeast", "KY": "Southeast", "LA": "Southeast",
    "MD": "Southeast", "MS": "Southeast", "NC": "Southeast", "SC": "Southeast",
    "TN": "Southeast", "VA": "Southeast", "WV": "Southeast",
    # Southwest
    "OK": "Southwest", "TX": "Southwest", "AZ": "Southwest", "NM": "Southwest",
    # West
    "CO": "West", "ID": "West", "MT": "West", "NV": "West", "UT": "West", "WY": "West",
    "AK": "West", "CA": "West", "HI": "West", "OR": "West", "WA": "West",
}

REGIONS = ["Northeast", "Southeast", "Midwest", "Southwest", "West"]

# Full state name -> 2-letter abbreviation (ILLUMINATE1 XLSX uses full names).
STATE_NAME_TO_ABBR: dict[str, str] = {
    "alabama": "AL", "alaska": "AK", "arizona": "AZ", "arkansas": "AR",
    "california": "CA", "colorado": "CO", "connecticut": "CT", "delaware": "DE",
    "district of columbia": "DC", "florida": "FL", "georgia": "GA", "hawaii": "HI",
    "idaho": "ID", "illinois": "IL", "indiana": "IN", "iowa": "IA", "kansas": "KS",
    "kentucky": "KY", "louisiana": "LA", "maine": "ME", "maryland": "MD",
    "massachusetts": "MA", "michigan": "MI", "minnesota": "MN", "mississippi": "MS",
    "missouri": "MO", "montana": "MT", "nebraska": "NE", "nevada": "NV",
    "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY",
    "north carolina": "NC", "north dakota": "ND", "ohio": "OH", "oklahoma": "OK",
    "oregon": "OR", "pennsylvania": "PA", "rhode island": "RI", "south carolina": "SC",
    "south dakota": "SD", "tennessee": "TN", "texas": "TX", "utah": "UT",
    "vermont": "VT", "virginia": "VA", "washington": "WA", "west virginia": "WV",
    "wisconsin": "WI", "wyoming": "WY",
}

# Approximate state centroids (lat, lng) — fallback geocoding for sites/HCOs that
# only resolve to a state. Real ILLUMINATE1 sites carry exact lat/lng.
STATE_CENTROID: dict[str, tuple[float, float]] = {
    "AL": (32.806, -86.791), "AK": (61.370, -152.404), "AZ": (33.729, -111.431),
    "AR": (34.970, -92.373), "CA": (36.116, -119.682), "CO": (39.060, -105.311),
    "CT": (41.598, -72.755), "DE": (39.319, -75.507), "DC": (38.897, -77.026),
    "FL": (27.766, -81.687), "GA": (33.040, -83.643), "HI": (21.094, -157.498),
    "ID": (44.240, -114.478), "IL": (40.349, -88.986), "IN": (39.849, -86.258),
    "IA": (42.011, -93.210), "KS": (38.526, -96.726), "KY": (37.668, -84.670),
    "LA": (31.169, -91.867), "ME": (44.693, -69.381), "MD": (39.064, -76.802),
    "MA": (42.230, -71.530), "MI": (43.326, -84.536), "MN": (45.694, -93.900),
    "MS": (32.741, -89.678), "MO": (38.456, -92.288), "MT": (46.921, -110.454),
    "NE": (41.125, -98.268), "NV": (38.313, -117.055), "NH": (43.452, -71.564),
    "NJ": (40.298, -74.521), "NM": (34.840, -106.248), "NY": (42.166, -74.948),
    "NC": (35.630, -79.806), "ND": (47.528, -99.784), "OH": (40.388, -82.764),
    "OK": (35.565, -96.929), "OR": (44.572, -122.071), "PA": (40.590, -77.209),
    "RI": (41.680, -71.511), "SC": (33.856, -80.945), "SD": (44.299, -99.438),
    "TN": (35.747, -86.692), "TX": (31.054, -97.563), "UT": (40.150, -111.862),
    "VT": (44.045, -72.710), "VA": (37.769, -78.170), "WA": (47.400, -121.490),
    "WV": (38.491, -80.954), "WI": (44.268, -89.616), "WY": (42.756, -107.302),
}


def region_for_state(abbr: str | None) -> str:
    if not abbr:
        return "National"
    return STATE_REGION.get(abbr.upper(), "National")


def normalize_state(value: str | None) -> str | None:
    """Normalize 'US-MI' / 'Michigan' / 'mi' → 'MI'. Returns None if unknown."""
    if not value:
        return None
    v = str(value).strip()
    if v.upper().startswith("US-"):
        v = v[3:]
    if len(v) == 2 and v.upper() in STATE_REGION:
        return v.upper()
    key = v.lower()
    if key in STATE_NAME_TO_ABBR:
        return STATE_NAME_TO_ABBR[key]
    if v.upper() in STATE_REGION:
        return v.upper()
    return None
