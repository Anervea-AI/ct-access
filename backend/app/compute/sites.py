"""Module 01 — site ranking. Consumes the eligible pool from the funnel (cascade)."""
from __future__ import annotations

from app.compute.rounding import clamp, r0, r2
from app.models.inputs import SiteFilters
from app.models.schemas import Site, SiteRankingResult

DEFAULT_RADIUS = 50.0
# true disease demographic distribution (target for representativeness)
DISEASE_DISTRIBUTION = {"blackPct": 13.0, "hispanicPct": 18.0, "asianPct": 6.0, "femalePct": 58.0}


def _norm(value: float, lo: float, hi: float) -> float:
    if hi <= lo:
        return 0.5
    return clamp((value - lo) / (hi - lo), 0, 1)


def _diversity_fit(site: Site, targets: dict[str, float]) -> float:
    active = {k: v for k, v in targets.items() if v > 0}
    if not active:
        return 0.0
    total = 0.0
    for key, target in active.items():
        achieved = getattr(site.demographics, key, 0.0)
        total += clamp(achieved / target, 0, 1.0)
    return total / len(active)


def compute_sites(sites: list[Site], eligible_pool: int, filters: SiteFilters) -> SiteRankingResult:
    radius_factor = clamp(filters.catchmentRadiusMiles / DEFAULT_RADIUS, 0.2, 3.0)

    # 1) eligible patients per site (cascade: scales with the funnel's eligible pool)
    enriched: list[Site] = []
    for s in sites:
        eligible_patients = r0(s.baseShare * eligible_pool * radius_factor)
        enriched.append(s.model_copy(update={"eligiblePatients": eligible_patients}))

    # 2) apply filters
    def passes(s: Site) -> bool:
        if s.eligiblePatients < filters.minEligible:
            return False
        if filters.regions and s.region not in filters.regions:
            return False
        if filters.piExperienceMin and s.piExperienceTrials < filters.piExperienceMin:
            return False
        if filters.specialties and not (set(filters.specialties) & set(s.specialties)):
            return False
        return True

    filtered = [s for s in enriched if passes(s)]

    # 3) normalize attributes across the filtered set, then score
    if filtered:
        elig_vals = [s.eligiblePatients for s in filtered]
        exp_vals = [s.piExperienceTrials for s in filtered]
        rx_vals = [s.indicationRxVolume for s in filtered]
        comp_vals = [s.competingTrials for s in filtered]
        elig_lo, elig_hi = min(elig_vals), max(elig_vals)
        exp_lo, exp_hi = min(exp_vals), max(exp_vals)
        rx_lo, rx_hi = min(rx_vals), max(rx_vals)
        comp_lo, comp_hi = min(comp_vals), max(comp_vals)
        w = filters.weights
        wsum = (w.catchment + w.experience + w.rxVolume) or 1
        scored: list[Site] = []
        for s in filtered:
            base = (
                w.catchment * _norm(s.eligiblePatients, elig_lo, elig_hi)
                + w.experience * _norm(s.piExperienceTrials, exp_lo, exp_hi)
                + w.rxVolume * _norm(s.indicationRxVolume, rx_lo, rx_hi)
            ) / wsum
            # competing-trial penalty: normalized across the filtered set so dense
            # markets (real counts span e.g. 3..147) stay rankable instead of clamping.
            competing_penalty = 0.25 * _norm(s.competingTrials, comp_lo, comp_hi)
            dfit = _diversity_fit(s, filters.diversityTargets)
            score = clamp(base - competing_penalty + filters.diversityWeight * dfit, 0, 1)
            scored.append(s.model_copy(update={"score": r2(score), "diversityFit": r2(dfit)}))
        scored.sort(key=lambda s: s.score, reverse=True)
    else:
        scored = []

    # 4) representativeness of the filtered set (eligible-weighted)
    representativeness: dict[str, float] = {}
    total_elig = sum(s.eligiblePatients for s in scored)
    if total_elig > 0:
        for key in ("blackPct", "hispanicPct", "asianPct", "femalePct"):
            weighted = sum(getattr(s.demographics, key) * s.eligiblePatients for s in scored) / total_elig
            representativeness[key] = r2(weighted)

    return SiteRankingResult(
        sites=scored,
        representativeness=representativeness,
        diseaseDistribution=DISEASE_DISTRIBUTION,
    )
