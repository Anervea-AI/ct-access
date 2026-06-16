"""Dump the canonical dataset + a golden parity fixture to ../shared.

The frontend's vitest parity test loads these and asserts its TypeScript compute
mirror produces identical results to this backend.

Run:  ./.venv/Scripts/python.exe scripts/dump_shared.py
"""
from __future__ import annotations

import json
import pathlib

from app.compute.forecast import compute_forecast
from app.compute.funnel import compute_funnel
from app.compute.sites import compute_sites
from app.data.store import get_dataset
from app.models.inputs import ScenarioState

SHARED = pathlib.Path(__file__).resolve().parents[2] / "shared"
GOLDEN = SHARED / "golden"


def build_golden_scenario(ds) -> ScenarioState:
    criteria = [c.model_copy(deep=True) for c in ds.criteria]
    by_id = {c.id: c for c in criteria}
    # exercise params + a toggle
    by_id["exc_antipsychotic_washout"].param.value = 28
    by_id["inc_severity"].param.value = 70
    by_id["inc_age"].param.value = 70
    by_id["exc_pregnancy"].enabled = False
    sc = ScenarioState(id="golden", name="Golden parity scenario", criteria=criteria)
    sc.forecast.numSites = 25
    sc.forecast.screenFailRate = 0.30
    return sc


def main() -> None:
    SHARED.mkdir(exist_ok=True)
    GOLDEN.mkdir(exist_ok=True)
    ds = get_dataset()
    (SHARED / "dataset.json").write_text(ds.model_dump_json(indent=2), encoding="utf-8")

    sc = build_golden_scenario(ds)
    (GOLDEN / "scenario.json").write_text(sc.model_dump_json(indent=2), encoding="utf-8")

    funnel = compute_funnel(sc.criteria, ds.totalUniverse, ds.distributions)
    site_res = compute_sites(ds.sites, funnel.eligiblePool, sc.siteFilters)
    forecast = compute_forecast(sc.forecast, funnel.eligiblePool)
    base = next(s for s in forecast.scenarios if s.id == "base")
    expected = {
        "funnel": {
            "eligiblePool": funnel.eligiblePool,
            "biggestConstraintId": funnel.biggestConstraintId,
            "steps": [{"criterionId": s.criterionId, "remaining": s.remaining,
                       "removed": s.removed, "reductionPct": s.reductionPct} for s in funnel.steps],
        },
        "sitesTop5": [{"id": s.id, "eligiblePatients": s.eligiblePatients, "score": s.score}
                      for s in site_res.sites[:5]],
        "forecastBase": {"lpiDate": base.lpiDate, "onTrack": base.onTrack,
                         "sitesNeededForTarget": forecast.sitesNeededForTarget},
    }
    (GOLDEN / "expected.json").write_text(json.dumps(expected, indent=2), encoding="utf-8")
    print("Wrote:")
    print(" ", SHARED / "dataset.json")
    print(" ", GOLDEN / "scenario.json")
    print(" ", GOLDEN / "expected.json")
    print("eligiblePool:", expected["funnel"]["eligiblePool"], "| LPI:", base.lpiDate,
          "| sitesNeeded:", forecast.sitesNeededForTarget)


if __name__ == "__main__":
    main()
