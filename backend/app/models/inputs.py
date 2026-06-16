"""Scenario input models (the mutable controls the user manipulates).

These are sent from the client with chat/compute requests so the server computes
over the user's current scenario — never a stale default."""
from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field

from app.models.schemas import Criterion, SiteWeights


class SiteFilters(BaseModel):
    minEligible: int = 0
    regions: list[str] = Field(default_factory=list)  # empty = all
    specialties: list[str] = Field(default_factory=list)  # empty = all
    piExperienceMin: int = 0
    catchmentRadiusMiles: float = 50
    weights: SiteWeights = Field(default_factory=SiteWeights)
    diversityWeight: float = 0
    diversityTargets: dict[str, float] = Field(default_factory=dict)  # e.g. {"blackPct": 15}


class ForecastInput(BaseModel):
    startMonth: str = "2026-07"
    numSites: int = 30
    activationMonths: int = 4
    screenFailRate: float = 0.28
    perSiteRatePerMonth: float = 1.9  # patients screened per active site per month
    competingDrag: float = 0.1
    targetEnrollment: int = 300
    targetDate: str = "2027-09"


class KolControls(BaseModel):
    weights: dict[str, float] = Field(
        default_factory=lambda: {
            "patientVolume": 0.25, "referralCentrality": 0.2, "referralReach": 0.15,
            "trialLeadership": 0.2, "trialRecency": 0.1, "specialtyFit": 0.1,
        }
    )
    segment: Optional[str] = None  # None = all
    region: Optional[str] = None
    specialty: Optional[str] = None


class MonitoringControls(BaseModel):
    watchThreshold: float = 0.9   # actual/forecast below -> watch
    atRiskThreshold: float = 0.75
    criticalThreshold: float = 0.55
    rescueSiteIds: list[str] = Field(default_factory=list)


class CohortControls(BaseModel):
    minAge: int = 18
    maxAge: int = 65
    treatedOnly: bool = True
    region: str = "National"
    matrixX: str = "trialEligible"   # axis metric keys
    matrixY: str = "competingTrialDensity"


class ScenarioState(BaseModel):
    """Full cross-module scenario — the shared cascade state."""
    id: str = "base"
    name: str = "Base scenario"
    protocolVersion: str = "A"
    criteria: list[Criterion]  # current enabled + param values
    siteFilters: SiteFilters = Field(default_factory=SiteFilters)
    forecast: ForecastInput = Field(default_factory=ForecastInput)
    kol: KolControls = Field(default_factory=KolControls)
    monitoring: MonitoringControls = Field(default_factory=MonitoringControls)
    cohort: CohortControls = Field(default_factory=CohortControls)
