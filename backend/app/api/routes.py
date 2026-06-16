"""HTTP API: dataset, compute service, chat. Cascade math lives in app.compute."""
from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.assistant.agent import answer
from app.compute import insights
from app.compute.forecast import compute_forecast
from app.compute.funnel import compute_funnel
from app.compute.kol import compute_kol
from app.compute.monitoring import compute_monitoring
from app.compute.population import compute_population
from app.compute.sites import compute_sites
from app.core.config import get_settings
from app.data.store import get_dataset
from app.models.inputs import ScenarioState
from app.models.schemas import (
    Dataset, EligibilityFunnelResult, ForecastResult, KolGraphResult,
    MonitoringResult, PopulationResult, SaturationStat, SiteRankingResult,
    UntappedPI, WhitespaceRegion,
)

router = APIRouter(prefix="/api")


@router.get("/health")
def health() -> dict:
    s = get_settings()
    ds = get_dataset()
    return {"status": "ok", "llmEnabled": s.llm_enabled, "model": s.openai_model if s.llm_enabled else None,
            "dataVersion": ds.dataVersion, "seed": ds.seed}


@router.get("/dataset", response_model=Dataset)
def dataset() -> Dataset:
    return get_dataset()


# ---- compute service (also callable directly per PRD §10.1) ---------------- #


class ScenarioRequest(BaseModel):
    scenario: ScenarioState


@router.post("/compute/funnel", response_model=EligibilityFunnelResult)
def funnel(req: ScenarioRequest) -> EligibilityFunnelResult:
    ds = get_dataset()
    return compute_funnel(req.scenario.criteria, ds.totalUniverse, ds.distributions)


@router.post("/compute/sites", response_model=SiteRankingResult)
def sites(req: ScenarioRequest) -> SiteRankingResult:
    ds = get_dataset()
    pool = compute_funnel(req.scenario.criteria, ds.totalUniverse, ds.distributions).eligiblePool
    return compute_sites(ds.sites, pool, req.scenario.siteFilters)


@router.post("/compute/forecast", response_model=ForecastResult)
def forecast(req: ScenarioRequest) -> ForecastResult:
    ds = get_dataset()
    pool = compute_funnel(req.scenario.criteria, ds.totalUniverse, ds.distributions).eligiblePool
    return compute_forecast(req.scenario.forecast, pool)


@router.post("/compute/kol", response_model=KolGraphResult)
def kol(req: ScenarioRequest) -> KolGraphResult:
    ds = get_dataset()
    return compute_kol(ds.kols, ds.kolEdges, req.scenario.kol)


@router.post("/compute/monitoring", response_model=MonitoringResult)
def monitoring(req: ScenarioRequest) -> MonitoringResult:
    ds = get_dataset()
    pool = compute_funnel(req.scenario.criteria, ds.totalUniverse, ds.distributions).eligiblePool
    return compute_monitoring(ds.sites, pool, req.scenario.forecast, req.scenario.monitoring)


@router.post("/compute/population", response_model=PopulationResult)
def population(req: ScenarioRequest) -> PopulationResult:
    ds = get_dataset()
    return compute_population(ds.indications, req.scenario.cohort)


# ---- new-insight endpoints (real RWD) -------------------------------------- #


@router.get("/insights/untapped-pis", response_model=list[UntappedPI])
def untapped_pis(region: str | None = None, state: str | None = None, limit: int = 20) -> list[UntappedPI]:
    return insights.untapped_pis(get_dataset(), region=region, state=state, limit=limit)


@router.get("/insights/saturation", response_model=list[SaturationStat])
def saturation(dimension: str = "state", limit: int = 15) -> list[SaturationStat]:
    return insights.saturation(get_dataset(), dimension=dimension, limit=limit)


@router.get("/insights/whitespace", response_model=list[WhitespaceRegion])
def whitespace(uncoveredOnly: bool = False, limit: int = 15) -> list[WhitespaceRegion]:
    return insights.whitespace(get_dataset(), uncovered_only=uncoveredOnly, limit=limit)


@router.get("/insights/diversity-gap")
def diversity_gap() -> dict:
    return insights.diversity_gap(get_dataset())


# ---- chat ------------------------------------------------------------------ #


class ChatRequest(BaseModel):
    message: str
    scenario: ScenarioState
    history: list[dict] = Field(default_factory=list)


@router.post("/chat")
def chat(req: ChatRequest) -> dict:
    ds = get_dataset()
    return answer(ds, req.scenario, req.message, req.history)
