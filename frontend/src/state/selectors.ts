// Cascade selectors — pure derivations from (dataset, scenario). The cascade wiring
// lives here: site ranking and forecast both consume the funnel's eligible pool.
import type { Dataset, ScenarioState } from "@/types";
import {
  computeForecast, computeFunnel, computeKol, computeMonitoring, computePopulation, computeSites,
} from "@/compute";

export function deriveCascade(ds: Dataset, sc: ScenarioState) {
  const funnel = computeFunnel(sc.criteria, ds.totalUniverse, ds.distributions);
  const sites = computeSites(ds.sites, funnel.eligiblePool, sc.siteFilters);
  const forecast = computeForecast(sc.forecast, funnel.eligiblePool);
  return { funnel, sites, forecast };
}

export function deriveFunnel(ds: Dataset, sc: ScenarioState) {
  return computeFunnel(sc.criteria, ds.totalUniverse, ds.distributions);
}

export function deriveSites(ds: Dataset, sc: ScenarioState) {
  const pool = computeFunnel(sc.criteria, ds.totalUniverse, ds.distributions).eligiblePool;
  return computeSites(ds.sites, pool, sc.siteFilters);
}

export function deriveForecast(ds: Dataset, sc: ScenarioState) {
  const pool = computeFunnel(sc.criteria, ds.totalUniverse, ds.distributions).eligiblePool;
  return computeForecast(sc.forecast, pool);
}

export function deriveKol(ds: Dataset, sc: ScenarioState) {
  return computeKol(ds.kols, ds.kolEdges, sc.kol);
}

export function deriveMonitoring(ds: Dataset, sc: ScenarioState) {
  const pool = computeFunnel(sc.criteria, ds.totalUniverse, ds.distributions).eligiblePool;
  return computeMonitoring(ds.sites, pool, sc.forecast, sc.monitoring);
}

export function derivePopulation(ds: Dataset, sc: ScenarioState) {
  return computePopulation(ds.indications, sc.cohort);
}
