// Parity guard: the TS compute mirror must reproduce the Python backend's golden
// values exactly (same dataset + same scenario => identical numbers). This is the
// keystone of the hybrid cascade model.
import { describe, expect, it } from "vitest";
import dataset from "@shared/dataset.json";
import scenario from "@shared/golden/scenario.json";
import expected from "@shared/golden/expected.json";
import type { Dataset, ScenarioState } from "@/types";
import { computeForecast, computeFunnel, computeSites } from "./index";

const ds = dataset as unknown as Dataset;
const sc = scenario as unknown as ScenarioState;

describe("client/server parity (golden fixture)", () => {
  it("funnel eligible pool + biggest constraint match", () => {
    const res = computeFunnel(sc.criteria, ds.totalUniverse, ds.distributions);
    expect(res.eligiblePool).toBe(expected.funnel.eligiblePool);
    expect(res.biggestConstraintId).toBe(expected.funnel.biggestConstraintId);
  });

  it("every funnel step matches", () => {
    const res = computeFunnel(sc.criteria, ds.totalUniverse, ds.distributions);
    expected.funnel.steps.forEach((exp, i) => {
      expect(res.steps[i].criterionId).toBe(exp.criterionId);
      expect(res.steps[i].remaining).toBe(exp.remaining);
      expect(res.steps[i].removed).toBe(exp.removed);
      expect(res.steps[i].reductionPct).toBe(exp.reductionPct);
    });
  });

  it("top 5 sites match (id, eligible, score)", () => {
    const pool = computeFunnel(sc.criteria, ds.totalUniverse, ds.distributions).eligiblePool;
    const res = computeSites(ds.sites, pool, sc.siteFilters);
    expected.sitesTop5.forEach((exp, i) => {
      expect(res.sites[i].id).toBe(exp.id);
      expect(res.sites[i].eligiblePatients).toBe(exp.eligiblePatients);
      expect(res.sites[i].score).toBe(exp.score);
    });
  });

  it("forecast base LPI + sites-needed match", () => {
    const pool = computeFunnel(sc.criteria, ds.totalUniverse, ds.distributions).eligiblePool;
    const fc = computeForecast(sc.forecast, pool);
    const base = fc.scenarios.find((s) => s.id === "base")!;
    expect(base.lpiDate).toBe(expected.forecastBase.lpiDate);
    expect(base.onTrack).toBe(expected.forecastBase.onTrack);
    expect(fc.sitesNeededForTarget).toBe(expected.forecastBase.sitesNeededForTarget);
  });
});
