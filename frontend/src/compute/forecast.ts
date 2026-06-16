// Mirror of backend/app/compute/forecast.py
import type { CurvePoint, ForecastInput, ForecastResult, ForecastScenarioResult } from "@/types";
import { clamp, r0, r1 } from "./rounding";

const MAX_HORIZON = 60;

export function monthIndex(ym: string): number {
  const [y, m] = ym.split("-");
  return parseInt(y, 10) * 12 + (parseInt(m, 10) - 1);
}

export function indexToMonth(idx: number): string {
  const y = Math.floor(idx / 12);
  const m = idx % 12;
  return `${String(y).padStart(4, "0")}-${String(m + 1).padStart(2, "0")}`;
}

function simulate(
  numSites: number,
  activationMonths: number,
  perSiteRate: number,
  screenFail: number,
  drag: number,
  targetEnrollment: number,
  eligiblePool: number,
  startIdx: number,
  band: number,
): { curve: CurvePoint[]; lpiIdx: number | null } {
  const curve: CurvePoint[] = [];
  let cumulative = 0;
  let lpiIdx: number | null = null;
  const enrolledPerSite = perSiteRate * (1 - screenFail) * (1 - drag);
  for (let m = 0; m < MAX_HORIZON; m++) {
    const ramp = clamp((m + 1) / Math.max(1, activationMonths), 0, 1);
    const active = numSites * ramp;
    const monthly = active * enrolledPerSite;
    cumulative = Math.min(eligiblePool, cumulative + monthly);
    curve.push({
      month: indexToMonth(startIdx + m),
      cumulative: r0(cumulative),
      lower: r0(cumulative * (1 - band)),
      upper: r0(Math.min(eligiblePool, cumulative * (1 + band))),
    });
    if (lpiIdx === null && cumulative >= targetEnrollment) lpiIdx = startIdx + m;
    if (lpiIdx !== null && startIdx + m >= lpiIdx + 2) break;
    if (cumulative >= eligiblePool) break;
  }
  return { curve, lpiIdx };
}

function scenario(
  sid: string,
  label: string,
  inp: ForecastInput,
  eligiblePool: number,
  rateMult: number,
  sfMult: number,
  dragMult: number,
  band: number,
): ForecastScenarioResult {
  const startIdx = monthIndex(inp.startMonth);
  const targetIdx = monthIndex(inp.targetDate);
  const perSite = inp.perSiteRatePerMonth * rateMult;
  const sf = clamp(inp.screenFailRate * sfMult, 0, 0.95);
  const drag = clamp(inp.competingDrag * dragMult, 0, 0.9);
  const { curve, lpiIdx } = simulate(
    inp.numSites, inp.activationMonths, perSite, sf, drag,
    inp.targetEnrollment, eligiblePool, startIdx, band,
  );
  const lpiDate = lpiIdx !== null ? indexToMonth(lpiIdx) : null;
  const onTrack = lpiIdx !== null && lpiIdx <= targetIdx;
  const monthsToTarget = lpiIdx !== null ? lpiIdx - startIdx : null;
  return {
    id: sid, label, numSites: inp.numSites, screenFailRate: r1(sf),
    perSiteRatePerMonth: r1(perSite), competingDrag: r1(drag),
    activationMonths: inp.activationMonths, targetEnrollment: inp.targetEnrollment,
    curve, lpiDate, targetDate: inp.targetDate, onTrack, monthsToTarget,
  };
}

function sitesNeeded(inp: ForecastInput, eligiblePool: number): { needed: number | null; feasible: boolean } {
  const targetIdx = monthIndex(inp.targetDate);
  const startIdx = monthIndex(inp.startMonth);
  for (let n = 1; n <= 400; n++) {
    const { lpiIdx } = simulate(
      n, inp.activationMonths, inp.perSiteRatePerMonth, inp.screenFailRate,
      inp.competingDrag, inp.targetEnrollment, eligiblePool, startIdx, 0,
    );
    if (lpiIdx !== null && lpiIdx <= targetIdx) return { needed: n, feasible: true };
  }
  return { needed: null, feasible: false };
}

export function computeForecast(inp: ForecastInput, eligiblePool: number): ForecastResult {
  const scenarios = [
    scenario("base", "Base", inp, eligiblePool, 1.0, 1.0, 1.0, 0.15),
    scenario("optimistic", "Optimistic", inp, eligiblePool, 1.25, 0.8, 0.5, 0.12),
    scenario("conservative", "Conservative", inp, eligiblePool, 0.8, 1.2, 1.5, 0.2),
  ];
  const { needed, feasible } = sitesNeeded(inp, eligiblePool);
  return { scenarios, sitesNeededForTarget: needed, feasibleByTarget: feasible };
}
