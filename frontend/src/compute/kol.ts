// Mirror of backend/app/compute/kol.py
import type { Kol, KolControls, KolEdge, KolGraphResult } from "@/types";
import { r2 } from "./rounding";

export const SIGNAL_KEYS = [
  "patientVolume", "referralCentrality", "referralReach",
  "trialLeadership", "trialRecency", "specialtyFit",
];

export function scoreKol(kol: Kol, weights: Record<string, number>): number {
  let wsum = 0;
  for (const k of SIGNAL_KEYS) wsum += Math.max(0, weights[k] ?? 0);
  if (wsum === 0) wsum = 1;
  let total = 0;
  const sig = kol.signals as unknown as Record<string, number>;
  for (const k of SIGNAL_KEYS) total += Math.max(0, weights[k] ?? 0) * sig[k];
  return r2(total / wsum);
}

export function computeKol(kols: Kol[], edges: KolEdge[], controls: KolControls): KolGraphResult {
  const passes = (k: Kol): boolean => {
    if (controls.segment && k.segment !== controls.segment) return false;
    if (controls.region && k.region !== controls.region) return false;
    if (controls.specialty && k.specialty !== controls.specialty) return false;
    return true;
  };
  const scored = kols
    .filter(passes)
    .map((k) => ({ ...k, score: scoreKol(k, controls.weights) }));
  scored.sort((a, b) => b.score - a.score);
  const ids = new Set(scored.map((k) => k.id));
  const keptEdges = edges.filter((e) => ids.has(e.source) && ids.has(e.target));
  return { nodes: scored, edges: keptEdges };
}
