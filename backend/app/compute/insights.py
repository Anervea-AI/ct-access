"""New-insight compute — filtered/ranked views over the real RWD dataset.

These operate on the precomputed insight collections the DB builder ships in the
`Dataset` (untappedPIs, saturation, whitespace, trials). They are real-data panels,
NOT part of the TS↔Py parity cascade, so they live server-side only.
"""
from __future__ import annotations

from typing import Optional

from app.models.schemas import (
    Dataset,
    SaturationStat,
    TrialSummary,
    UntappedPI,
    WhitespaceRegion,
)


def untapped_pis(
    ds: Dataset, region: Optional[str] = None, state: Optional[str] = None, limit: int = 20
) -> list[UntappedPI]:
    """High-volume providers with no trial history, optionally filtered by geography."""
    rows = ds.untappedPIs
    if region:
        rows = [p for p in rows if p.region == region]
    if state:
        rows = [p for p in rows if p.state == state]
    rows = sorted(rows, key=lambda p: p.patientCount, reverse=True)
    return rows[:limit]


def saturation(
    ds: Dataset, dimension: str = "state", limit: int = 15
) -> list[SaturationStat]:
    rows = [s for s in ds.saturation if s.dimension == dimension]
    rows = sorted(rows, key=lambda s: s.trials, reverse=True)
    return rows[:limit]


def over_committed_investigators(ds: Dataset) -> int:
    """Total over-committed investigators across states (trial-load above threshold)."""
    return sum(s.overCommitted for s in ds.saturation if s.dimension == "state")


def whitespace(
    ds: Dataset, uncovered_only: bool = False, limit: int = 15
) -> list[WhitespaceRegion]:
    rows = ds.whitespace
    if uncovered_only:
        rows = [w for w in rows if not w.hasSite]
    rows = sorted(rows, key=lambda w: w.whitespaceScore, reverse=True)
    return rows[:limit]


def diversity_gap(ds: Dataset) -> dict[str, float]:
    """Diversity of patients in covered (has-site) states vs uncovered states.

    A positive gap means uncovered states are MORE diverse — i.e. expanding there
    would improve representativeness.
    """
    covered = [w for w in ds.whitespace if w.hasSite]
    uncovered = [w for w in ds.whitespace if not w.hasSite]

    def _wavg(rows: list[WhitespaceRegion]) -> float:
        tot = sum(w.patientDensity for w in rows)
        if tot <= 0:
            return 0.0
        return sum(w.diversityIndex * w.patientDensity for w in rows) / tot

    cov = round(_wavg(covered), 3)
    unc = round(_wavg(uncovered), 3)
    return {"coveredDiversity": cov, "uncoveredDiversity": unc, "gap": round(unc - cov, 3)}


def trials_in_state(ds: Dataset, state: str, limit: int = 20) -> list[TrialSummary]:
    rows = [t for t in ds.trials if state in t.states]
    rows = sorted(rows, key=lambda t: t.investigators, reverse=True)
    return rows[:limit]
