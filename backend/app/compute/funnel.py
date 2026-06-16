"""Module 02 — eligibility funnel (the cascade master).

Each enabled criterion removes a fraction of the *remaining* pool. The fraction is
the criterion's base reduction adjusted by its parameter (for parametric/proxy
criteria). Deliberately simple so it mirrors exactly in TypeScript.
"""
from __future__ import annotations

from typing import Optional

from app.compute.rounding import clamp, r0, r1
from app.models.schemas import (
    Criterion,
    Distributions,
    EligibilityFunnelResult,
    FunnelStep,
)


def _age_reduction_pct(crit: Criterion, distributions: Distributions) -> float:
    """Data-backed: % of patients OUTSIDE [18, maxAge] per the real age histogram.

    Identical float arithmetic in the TS mirror so parity holds. Bands are treated
    as continuous [lo, hi+1); straddled bands contribute their overlap fraction.
    """
    hist = distributions.ageHistogram if distributions else []
    total = float(sum(b.count for b in hist))
    if total <= 0:
        return crit.baseReductionPct
    min_age = 18.0
    max_age = float(crit.param.value) if crit.param is not None else 65.0
    included = 0.0
    for b in hist:
        lo = float(b.lo)
        hi = float(b.hi) + 1.0
        span = hi - lo
        if span <= 0:
            continue
        overlap = min(hi, max_age + 1.0) - max(lo, min_age)
        if overlap < 0:
            overlap = 0.0
        included += (overlap / span) * b.count
    frac_excluded = 1.0 - included / total
    return clamp(frac_excluded * 100.0, 0.0, 97.0)


def effective_reduction_pct(
    crit: Criterion, distributions: Optional[Distributions] = None
) -> float:
    """Reduction (% of remaining removed) at the criterion's current parameter value."""
    if crit.dataSource == "age_histogram" and distributions is not None:
        return _age_reduction_pct(crit, distributions)
    base = crit.baseReductionPct
    if base <= 0 and crit.paramSlope == 0:
        return 0.0  # anchor criterion (defines the universe) removes nothing
    raw = base
    if crit.param is not None and crit.paramSlope != 0:
        p = crit.param
        rng = (p.max - p.min) or 1
        norm = (p.value - p.min) / rng
        norm_default = (p.default - p.min) / rng
        raw = base + crit.paramSlope * (norm - norm_default)
    if raw <= 0:
        return 0.0
    return clamp(raw, 0.5, 97.0)


def compute_funnel(
    criteria: list[Criterion],
    total_universe: int,
    distributions: Optional[Distributions] = None,
) -> EligibilityFunnelResult:
    steps: list[FunnelStep] = []
    remaining = float(total_universe)
    for crit in criteria:
        if not crit.enabled:
            continue
        red = effective_reduction_pct(crit, distributions) / 100.0
        before = remaining
        removed = before * red
        remaining = before - removed
        steps.append(
            FunnelStep(
                criterionId=crit.id,
                label=crit.label,
                type=crit.type,
                remaining=r0(remaining),
                removed=r0(removed),
                pct=r1(remaining / total_universe * 100),
                reductionPct=r1(red * 100),
            )
        )
    eligible = r0(remaining)

    biggest = None
    for s in steps:
        if biggest is None or s.removed > biggest.removed:
            biggest = s

    return EligibilityFunnelResult(
        totalUniverse=total_universe,
        steps=steps,
        eligiblePool=eligible,
        biggestConstraintId=biggest.criterionId if biggest else None,
        biggestConstraintLabel=biggest.label if biggest else None,
        biggestConstraintRemoved=biggest.removed if biggest else 0,
        biggestConstraintRemovedPct=r1(biggest.removed / total_universe * 100) if biggest else 0,
    )
