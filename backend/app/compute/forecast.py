"""Module 03 — enrollment forecasting. Consumes eligible pool + site list (cascade)."""
from __future__ import annotations

from app.compute.rounding import clamp, r0, r1
from app.models.inputs import ForecastInput
from app.models.schemas import CurvePoint, ForecastResult, ForecastScenarioResult

MAX_HORIZON = 60  # months


def month_index(ym: str) -> int:
    y, m = ym.split("-")
    return int(y) * 12 + (int(m) - 1)


def index_to_month(idx: int) -> str:
    y, m = divmod(idx, 12)
    return f"{y:04d}-{m + 1:02d}"


def _simulate(
    num_sites: int,
    activation_months: int,
    per_site_rate: float,
    screen_fail: float,
    drag: float,
    target_enrollment: int,
    eligible_pool: int,
    start_idx: int,
    band: float,
) -> tuple[list[CurvePoint], int | None]:
    curve: list[CurvePoint] = []
    cumulative = 0.0
    lpi_idx: int | None = None
    enrolled_per_site = per_site_rate * (1 - screen_fail) * (1 - drag)
    for m in range(MAX_HORIZON):
        ramp = clamp((m + 1) / max(1, activation_months), 0, 1)
        active = num_sites * ramp
        monthly = active * enrolled_per_site
        cumulative = min(eligible_pool, cumulative + monthly)
        curve.append(
            CurvePoint(
                month=index_to_month(start_idx + m),
                cumulative=r0(cumulative),
                lower=r0(cumulative * (1 - band)),
                upper=r0(min(eligible_pool, cumulative * (1 + band))),
            )
        )
        if lpi_idx is None and cumulative >= target_enrollment:
            lpi_idx = start_idx + m
        # keep two months past LPI for the chart, then stop; also stop if saturated
        if lpi_idx is not None and (start_idx + m) >= lpi_idx + 2:
            break
        if cumulative >= eligible_pool:
            break
    return curve, lpi_idx


def _scenario(
    sid: str, label: str, inp: ForecastInput, eligible_pool: int,
    rate_mult: float, sf_mult: float, drag_mult: float, band: float,
) -> ForecastScenarioResult:
    start_idx = month_index(inp.startMonth)
    target_idx = month_index(inp.targetDate)
    per_site = inp.perSiteRatePerMonth * rate_mult
    sf = clamp(inp.screenFailRate * sf_mult, 0, 0.95)
    drag = clamp(inp.competingDrag * drag_mult, 0, 0.9)
    curve, lpi_idx = _simulate(
        inp.numSites, inp.activationMonths, per_site, sf, drag,
        inp.targetEnrollment, eligible_pool, start_idx, band,
    )
    lpi_date = index_to_month(lpi_idx) if lpi_idx is not None else None
    on_track = lpi_idx is not None and lpi_idx <= target_idx
    months_to_target = (lpi_idx - start_idx) if lpi_idx is not None else None
    return ForecastScenarioResult(
        id=sid, label=label, numSites=inp.numSites, screenFailRate=r1(sf),
        perSiteRatePerMonth=r1(per_site), competingDrag=r1(drag),
        activationMonths=inp.activationMonths, targetEnrollment=inp.targetEnrollment,
        curve=curve, lpiDate=lpi_date, targetDate=inp.targetDate,
        onTrack=on_track, monthsToTarget=months_to_target,
    )


def _sites_needed(inp: ForecastInput, eligible_pool: int) -> tuple[int | None, bool]:
    target_idx = month_index(inp.targetDate)
    start_idx = month_index(inp.startMonth)
    for n in range(1, 401):
        trial = inp.model_copy(update={"numSites": n})
        _, lpi_idx = _simulate(
            n, inp.activationMonths, inp.perSiteRatePerMonth, inp.screenFailRate,
            inp.competingDrag, inp.targetEnrollment, eligible_pool, start_idx, 0.0,
        )
        if lpi_idx is not None and lpi_idx <= target_idx:
            return n, True
    return None, False


def compute_forecast(inp: ForecastInput, eligible_pool: int) -> ForecastResult:
    scenarios = [
        _scenario("base", "Base", inp, eligible_pool, 1.0, 1.0, 1.0, 0.15),
        _scenario("optimistic", "Optimistic", inp, eligible_pool, 1.25, 0.8, 0.5, 0.12),
        _scenario("conservative", "Conservative", inp, eligible_pool, 0.8, 1.2, 1.5, 0.2),
    ]
    sites_needed, feasible = _sites_needed(inp, eligible_pool)
    return ForecastResult(
        scenarios=scenarios,
        sitesNeededForTarget=sites_needed,
        feasibleByTarget=feasible,
    )
