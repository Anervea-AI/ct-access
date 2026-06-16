// Mirror of backend/app/compute/population.py
import type { CohortControls, IndicationOpportunity, PopulationResult } from "@/types";
import { clamp, r0, r2 } from "./rounding";

export function computePopulation(
  indications: IndicationOpportunity[],
  cohort: CohortControls,
): PopulationResult {
  const ageSpan = clamp((cohort.maxAge - cohort.minAge) / (65 - 18), 0.2, 1.3);
  const out = indications.map((ind) => {
    const treated = r0(ind.treated * ageSpan);
    const eligible = r0(ind.trialEligible * ageSpan);
    const diagnosed = cohort.treatedOnly
      ? r0(ind.diagnosed * clamp(ageSpan, 0.3, 1.0))
      : ind.diagnosed;
    const feas = clamp(ind.feasibilityScore * (0.85 + 0.15 * ageSpan), 0, 1);
    return {
      ...ind,
      diagnosed,
      treated,
      trialEligible: eligible,
      feasibilityScore: r2(feas),
      region: cohort.region,
    };
  });
  return { indications: out };
}
