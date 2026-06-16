"""Compute formula tests + the golden regression guard (parity anchor with the frontend)."""
from __future__ import annotations

from app.compute.forecast import compute_forecast
from app.compute.funnel import compute_funnel
from app.compute.sites import compute_sites


def test_funnel_anchor_removes_nothing(base_scenario, dataset):
    res = compute_funnel(base_scenario.criteria, dataset.totalUniverse, dataset.distributions)
    # first step is the diagnosis anchor -> 0 reduction
    assert res.steps[0].reductionPct == 0
    assert res.steps[0].remaining == dataset.totalUniverse
    assert 0 < res.eligiblePool < dataset.totalUniverse


def test_biggest_constraint_is_current_mde(base_scenario, dataset):
    res = compute_funnel(base_scenario.criteria, dataset.totalUniverse, dataset.distributions)
    assert res.biggestConstraintId == "inc_current_mde"


def test_disabling_a_criterion_grows_pool(base_scenario, dataset):
    before = compute_funnel(base_scenario.criteria, dataset.totalUniverse, dataset.distributions).eligiblePool
    for c in base_scenario.criteria:
        if c.id == "exc_antipsychotic_washout":
            c.enabled = False
    after = compute_funnel(base_scenario.criteria, dataset.totalUniverse, dataset.distributions).eligiblePool
    assert after > before


def test_washout_whatif_monotonic(base_scenario, dataset):
    """Longer washout excludes more patients -> smaller pool."""
    pools = []
    for days in (7, 14, 28, 42):
        crit = [c.model_copy(deep=True) for c in base_scenario.criteria]
        for c in crit:
            if c.id == "exc_antipsychotic_washout":
                c.param.value = days
        pools.append(compute_funnel(crit, dataset.totalUniverse, dataset.distributions).eligiblePool)
    assert pools == sorted(pools, reverse=True)


def test_sites_cascade_scales_with_pool(base_scenario, dataset):
    funnel = compute_funnel(base_scenario.criteria, dataset.totalUniverse, dataset.distributions)
    full = compute_sites(dataset.sites, funnel.eligiblePool, base_scenario.siteFilters)
    half = compute_sites(dataset.sites, funnel.eligiblePool // 2, base_scenario.siteFilters)
    # same top site, ~half the eligible patients
    top = full.sites[0]
    top_half = next(s for s in half.sites if s.id == top.id)
    assert abs(top_half.eligiblePatients * 2 - top.eligiblePatients) <= 2


def test_golden_funnel_matches(golden_scenario, golden_expected, dataset):
    res = compute_funnel(golden_scenario.criteria, dataset.totalUniverse, dataset.distributions)
    assert res.eligiblePool == golden_expected["funnel"]["eligiblePool"]
    assert res.biggestConstraintId == golden_expected["funnel"]["biggestConstraintId"]
    for got, exp in zip(res.steps, golden_expected["funnel"]["steps"]):
        assert got.criterionId == exp["criterionId"]
        assert got.remaining == exp["remaining"]
        assert got.removed == exp["removed"]


def test_golden_forecast_matches(golden_scenario, golden_expected, dataset):
    pool = compute_funnel(golden_scenario.criteria, dataset.totalUniverse, dataset.distributions).eligiblePool
    fc = compute_forecast(golden_scenario.forecast, pool)
    base = next(s for s in fc.scenarios if s.id == "base")
    assert base.lpiDate == golden_expected["forecastBase"]["lpiDate"]
    assert fc.sitesNeededForTarget == golden_expected["forecastBase"]["sitesNeededForTarget"]
