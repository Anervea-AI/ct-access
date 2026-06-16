"""Module 06 — population sizing & indication prioritization."""
from __future__ import annotations

from app.compute.rounding import clamp, r0, r2
from app.models.inputs import CohortControls
from app.models.schemas import IndicationOpportunity, PopulationResult


def compute_population(
    indications: list[IndicationOpportunity], cohort: CohortControls
) -> PopulationResult:
    # Cohort edits scale every indication's funnel at once (PRD: counts update across
    # all indications simultaneously). Narrower age band -> smaller treated/eligible.
    age_span = clamp((cohort.maxAge - cohort.minAge) / (65 - 18), 0.2, 1.3)
    out: list[IndicationOpportunity] = []
    for ind in indications:
        treated = r0(ind.treated * age_span)
        eligible = r0(ind.trialEligible * age_span)
        diagnosed = ind.diagnosed if not cohort.treatedOnly else r0(ind.diagnosed * clamp(age_span, 0.3, 1.0))
        feas = clamp(ind.feasibilityScore * (0.85 + 0.15 * age_span), 0, 1)
        out.append(
            ind.model_copy(update={
                "diagnosed": diagnosed,
                "treated": treated,
                "trialEligible": eligible,
                "feasibilityScore": r2(feas),
                "region": cohort.region,
            })
        )
    return PopulationResult(indications=out)
