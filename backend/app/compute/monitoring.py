"""Module 05 — in-flight monitoring & rescue (actual vs forecast, risk, what-if)."""
from __future__ import annotations

from app.compute.rounding import clamp, hash01, r0
from app.models.inputs import ForecastInput, MonitoringControls
from app.models.schemas import MonitoringResult, RiskLevel, Site, SiteStatus

ELAPSED_FRACTION = 0.45  # assume the running trial is ~45% through its timeline
ROOT_CAUSES = [
    "Patient flow thinning in catchment",
    "Competing trial opened nearby",
    "Screen-fail spike",
    "Slow site activation",
    "Referral network gap",
]


def _site_idx(site_id: str) -> int:
    try:
        return int(site_id.split("_")[-1])
    except ValueError:
        return abs(hash(site_id)) % 1000


def _risk(ratio: float, c: MonitoringControls) -> RiskLevel:
    if ratio < c.criticalThreshold:
        return "critical"
    if ratio < c.atRiskThreshold:
        return "at_risk"
    if ratio < c.watchThreshold:
        return "watch"
    return "on_track"


def compute_monitoring(
    sites: list[Site], eligible_pool: int, forecast: ForecastInput, controls: MonitoringControls
) -> MonitoringResult:
    enriched = [
        s.model_copy(update={"eligiblePatients": r0(s.baseShare * eligible_pool)})
        for s in sites
    ]
    enriched.sort(key=lambda s: s.eligiblePatients, reverse=True)
    active = enriched[: min(forecast.numSites, len(enriched))]
    active_ids = {s.id for s in active} | set(controls.rescueSiteIds)
    active = [s for s in enriched if s.id in active_ids]

    total_share = sum(s.eligiblePatients for s in active) or 1
    statuses: list[SiteStatus] = []
    study_planned = study_actual = study_forecast = 0
    at_risk = 0
    for s in active:
        share = s.eligiblePatients / total_share
        final_target = r0(forecast.targetEnrollment * share)
        planned = r0(final_target * ELAPSED_FRACTION)
        is_rescue = s.id in controls.rescueSiteIds
        perf = 0.5 + hash01(_site_idx(s.id) + 1) * 0.95  # 0.5 .. 1.45
        if is_rescue:
            perf = max(perf, 1.05)  # rescue sites are chosen for healthy flow
        actual = r0(planned * perf)
        projected = r0(actual / ELAPSED_FRACTION) if ELAPSED_FRACTION > 0 else actual
        ratio = (projected / final_target) if final_target else 1.0
        risk = _risk(ratio, controls)
        shortfall = max(0, final_target - projected)
        cause = ROOT_CAUSES[_site_idx(s.id) % len(ROOT_CAUSES)] if risk != "on_track" else "—"
        if risk in ("at_risk", "critical"):
            at_risk += 1
        statuses.append(
            SiteStatus(
                siteId=s.id, name=s.name, region=s.region,
                planned=planned, actual=actual, forecast=projected,
                risk=risk, predictedShortfall=shortfall, rootCause=cause,
            )
        )
        study_planned += planned
        study_actual += actual
        study_forecast += projected

    statuses.sort(key=lambda x: x.predictedShortfall, reverse=True)
    return MonitoringResult(
        studyPlanned=study_planned, studyActual=study_actual, studyForecast=study_forecast,
        sites=statuses, atRiskCount=at_risk,
    )
