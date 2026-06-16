// Mirror of backend/app/compute/funnel.py
import type { Criterion, Distributions, EligibilityFunnelResult, FunnelStep } from "@/types";
import { clamp, r0, r1 } from "./rounding";

function ageReductionPct(c: Criterion, distributions: Distributions): number {
  const hist = distributions?.ageHistogram ?? [];
  const total = hist.reduce((acc, b) => acc + b.count, 0);
  if (total <= 0) return c.baseReductionPct;
  const minAge = 18;
  const maxAge = c.param ? c.param.value : 65;
  let included = 0;
  for (const b of hist) {
    const lo = b.lo;
    const hi = b.hi + 1;
    const span = hi - lo;
    if (span <= 0) continue;
    let overlap = Math.min(hi, maxAge + 1) - Math.max(lo, minAge);
    if (overlap < 0) overlap = 0;
    included += (overlap / span) * b.count;
  }
  const fracExcluded = 1 - included / total;
  return clamp(fracExcluded * 100, 0, 97);
}

export function effectiveReductionPct(c: Criterion, distributions?: Distributions | null): number {
  if (c.dataSource === "age_histogram" && distributions) return ageReductionPct(c, distributions);
  const base = c.baseReductionPct;
  if (base <= 0 && c.paramSlope === 0) return 0;
  let raw = base;
  if (c.param && c.paramSlope !== 0) {
    const p = c.param;
    const rng = p.max - p.min || 1;
    const norm = (p.value - p.min) / rng;
    const normDefault = (p.default - p.min) / rng;
    raw = base + c.paramSlope * (norm - normDefault);
  }
  if (raw <= 0) return 0;
  return clamp(raw, 0.5, 97);
}

export function computeFunnel(
  criteria: Criterion[],
  totalUniverse: number,
  distributions?: Distributions | null,
): EligibilityFunnelResult {
  const steps: FunnelStep[] = [];
  let remaining = totalUniverse;
  for (const c of criteria) {
    if (!c.enabled) continue;
    const red = effectiveReductionPct(c, distributions) / 100;
    const before = remaining;
    const removed = before * red;
    remaining = before - removed;
    steps.push({
      criterionId: c.id,
      label: c.label,
      type: c.type,
      remaining: r0(remaining),
      removed: r0(removed),
      pct: r1((remaining / totalUniverse) * 100),
      reductionPct: r1(red * 100),
    });
  }
  const eligible = r0(remaining);
  let biggest: FunnelStep | null = null;
  for (const s of steps) if (!biggest || s.removed > biggest.removed) biggest = s;

  return {
    totalUniverse,
    steps,
    eligiblePool: eligible,
    biggestConstraintId: biggest ? biggest.criterionId : null,
    biggestConstraintLabel: biggest ? biggest.label : null,
    biggestConstraintRemoved: biggest ? biggest.removed : 0,
    biggestConstraintRemovedPct: biggest ? r1((biggest.removed / totalUniverse) * 100) : 0,
  };
}
