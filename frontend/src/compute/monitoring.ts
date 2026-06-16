// Mirror of backend/app/compute/monitoring.py
import type {
  ForecastInput, MonitoringControls, MonitoringResult, RiskLevel, Site, SiteStatus,
} from "@/types";
import { hash01, r0 } from "./rounding";

const ELAPSED_FRACTION = 0.45;
const ROOT_CAUSES = [
  "Patient flow thinning in catchment",
  "Competing trial opened nearby",
  "Screen-fail spike",
  "Slow site activation",
  "Referral network gap",
];

function siteIdx(siteId: string): number {
  const tail = siteId.split("_").pop() ?? "";
  const n = parseInt(tail, 10);
  return Number.isNaN(n) ? 0 : n;
}

function risk(ratio: number, c: MonitoringControls): RiskLevel {
  if (ratio < c.criticalThreshold) return "critical";
  if (ratio < c.atRiskThreshold) return "at_risk";
  if (ratio < c.watchThreshold) return "watch";
  return "on_track";
}

export function computeMonitoring(
  sites: Site[],
  eligiblePool: number,
  forecast: ForecastInput,
  controls: MonitoringControls,
): MonitoringResult {
  const enriched = sites.map((s) => ({ ...s, eligiblePatients: r0(s.baseShare * eligiblePool) }));
  enriched.sort((a, b) => b.eligiblePatients - a.eligiblePatients);
  const topIds = new Set(enriched.slice(0, Math.min(forecast.numSites, enriched.length)).map((s) => s.id));
  controls.rescueSiteIds.forEach((id) => topIds.add(id));
  const active = enriched.filter((s) => topIds.has(s.id));

  const totalShare = active.reduce((acc, s) => acc + s.eligiblePatients, 0) || 1;
  const statuses: SiteStatus[] = [];
  let studyPlanned = 0, studyActual = 0, studyForecast = 0, atRisk = 0;
  for (const s of active) {
    const share = s.eligiblePatients / totalShare;
    const finalTarget = r0(forecast.targetEnrollment * share);
    const planned = r0(finalTarget * ELAPSED_FRACTION);
    const isRescue = controls.rescueSiteIds.includes(s.id);
    let perf = 0.5 + hash01(siteIdx(s.id) + 1) * 0.95;
    if (isRescue) perf = Math.max(perf, 1.05);
    const actual = r0(planned * perf);
    const projected = ELAPSED_FRACTION > 0 ? r0(actual / ELAPSED_FRACTION) : actual;
    const ratio = finalTarget ? projected / finalTarget : 1;
    const rk = risk(ratio, controls);
    const shortfall = Math.max(0, finalTarget - projected);
    const cause = rk !== "on_track" ? ROOT_CAUSES[siteIdx(s.id) % ROOT_CAUSES.length] : "—";
    if (rk === "at_risk" || rk === "critical") atRisk++;
    statuses.push({
      siteId: s.id, name: s.name, region: s.region,
      planned, actual, forecast: projected, risk: rk,
      predictedShortfall: shortfall, rootCause: cause,
    });
    studyPlanned += planned;
    studyActual += actual;
    studyForecast += projected;
  }
  statuses.sort((a, b) => b.predictedShortfall - a.predictedShortfall);
  return {
    studyPlanned, studyActual, studyForecast, sites: statuses, atRiskCount: atRisk,
  };
}
