// Mirror of backend/app/compute/sites.py
import type { Site, SiteFilters, SiteRankingResult } from "@/types";
import { clamp, r0, r2 } from "./rounding";

const DEFAULT_RADIUS = 50;
export const DISEASE_DISTRIBUTION: Record<string, number> = {
  blackPct: 13,
  hispanicPct: 18,
  asianPct: 6,
  femalePct: 58,
};

function norm(value: number, lo: number, hi: number): number {
  if (hi <= lo) return 0.5;
  return clamp((value - lo) / (hi - lo), 0, 1);
}

function diversityFit(site: Site, targets: Record<string, number>): number {
  const active = Object.entries(targets).filter(([, v]) => v > 0);
  if (active.length === 0) return 0;
  let total = 0;
  for (const [key, target] of active) {
    const achieved = (site.demographics as unknown as Record<string, number>)[key] ?? 0;
    total += clamp(achieved / target, 0, 1);
  }
  return total / active.length;
}

export function computeSites(
  sites: Site[],
  eligiblePool: number,
  filters: SiteFilters,
): SiteRankingResult {
  const radiusFactor = clamp(filters.catchmentRadiusMiles / DEFAULT_RADIUS, 0.2, 3);

  const enriched: Site[] = sites.map((s) => ({
    ...s,
    eligiblePatients: r0(s.baseShare * eligiblePool * radiusFactor),
  }));

  const passes = (s: Site): boolean => {
    if (s.eligiblePatients < filters.minEligible) return false;
    if (filters.regions.length && !filters.regions.includes(s.region)) return false;
    if (filters.piExperienceMin && s.piExperienceTrials < filters.piExperienceMin) return false;
    if (filters.specialties.length && !filters.specialties.some((sp) => s.specialties.includes(sp)))
      return false;
    return true;
  };
  const filtered = enriched.filter(passes);

  let scored: Site[] = [];
  if (filtered.length) {
    const eligVals = filtered.map((s) => s.eligiblePatients);
    const expVals = filtered.map((s) => s.piExperienceTrials);
    const rxVals = filtered.map((s) => s.indicationRxVolume);
    const compVals = filtered.map((s) => s.competingTrials);
    const eligLo = Math.min(...eligVals), eligHi = Math.max(...eligVals);
    const expLo = Math.min(...expVals), expHi = Math.max(...expVals);
    const rxLo = Math.min(...rxVals), rxHi = Math.max(...rxVals);
    const compLo = Math.min(...compVals), compHi = Math.max(...compVals);
    const w = filters.weights;
    const wsum = w.catchment + w.experience + w.rxVolume || 1;
    scored = filtered.map((s) => {
      const base =
        (w.catchment * norm(s.eligiblePatients, eligLo, eligHi) +
          w.experience * norm(s.piExperienceTrials, expLo, expHi) +
          w.rxVolume * norm(s.indicationRxVolume, rxLo, rxHi)) /
        wsum;
      // normalized competing penalty (real counts span e.g. 3..147)
      const competingPenalty = 0.25 * norm(s.competingTrials, compLo, compHi);
      const dfit = diversityFit(s, filters.diversityTargets);
      const score = clamp(base - competingPenalty + filters.diversityWeight * dfit, 0, 1);
      return { ...s, score: r2(score), diversityFit: r2(dfit) };
    });
    scored.sort((a, b) => b.score - a.score);
  }

  const representativeness: Record<string, number> = {};
  const totalElig = scored.reduce((acc, s) => acc + s.eligiblePatients, 0);
  if (totalElig > 0) {
    for (const key of ["blackPct", "hispanicPct", "asianPct", "femalePct"]) {
      const weighted =
        scored.reduce(
          (acc, s) =>
            acc + (s.demographics as unknown as Record<string, number>)[key] * s.eligiblePatients,
          0,
        ) / totalElig;
      representativeness[key] = r2(weighted);
    }
  }

  return { sites: scored, representativeness, diseaseDistribution: DISEASE_DISTRIBUTION };
}
