"""Pydantic data contracts shared across the backend.

These mirror the TypeScript types in `frontend/src/types.ts`. Keep them in sync.
Compute formulas are deliberately simple, deterministic reductions so the same
math can be mirrored exactly on the client (see `frontend/src/compute`).
"""
from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field

# --------------------------------------------------------------------------- #
# Module 02 — Feasibility / eligibility criteria
# --------------------------------------------------------------------------- #

CriterionType = Literal["inclusion", "exclusion"]
Confidence = Literal["high", "medium", "low"]


class ParamSpec(BaseModel):
    name: str
    value: float
    min: float
    max: float
    step: float = 1
    default: float
    unit: str = ""


class Criterion(BaseModel):
    id: str
    type: CriterionType
    label: str
    category: str = "general"
    enabled: bool = True
    isProxy: bool = False
    proxyNote: Optional[str] = None
    confidence: Optional[Confidence] = None
    codes: list[str] = Field(default_factory=list)
    # reduction (% of the *remaining* pool removed) at the default param value
    baseReductionPct: float = 0
    param: Optional[ParamSpec] = None
    # change in reductionPct per unit of normalized param change (signed)
    paramSlope: float = 0
    # when set, the reduction is computed from a real distribution shipped in the
    # dataset (e.g. "age_histogram") instead of baseReductionPct/paramSlope.
    dataSource: Optional[str] = None


class FunnelStep(BaseModel):
    criterionId: str
    label: str
    type: CriterionType
    remaining: int
    removed: int
    pct: float  # remaining as % of total universe
    reductionPct: float  # % of the prior remaining removed by this step


class EligibilityFunnelResult(BaseModel):
    totalUniverse: int
    steps: list[FunnelStep]
    eligiblePool: int
    biggestConstraintId: Optional[str] = None
    biggestConstraintLabel: Optional[str] = None
    biggestConstraintRemoved: int = 0
    biggestConstraintRemovedPct: float = 0


# --------------------------------------------------------------------------- #
# Module 01 — Sites & PI
# --------------------------------------------------------------------------- #


class Demographics(BaseModel):
    blackPct: float
    hispanicPct: float
    asianPct: float
    whitePct: float
    femalePct: float
    ruralPct: float


class Site(BaseModel):
    id: str
    name: str
    lat: float
    lng: float
    region: str
    state: str
    # fixed fraction of the eligible universe this site can draw — drives cascade
    baseShare: float
    piExperienceTrials: int
    indicationRxVolume: int
    competingTrials: int
    specialties: list[str] = Field(default_factory=list)
    demographics: Demographics
    # real-site provenance (ILLUMINATE1 site list) — optional so synthetic still validates
    npi: Optional[int] = None
    address: Optional[str] = None
    city: Optional[str] = None
    status: Optional[str] = None
    primaryContact: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    # computed fields (filled by compute.sites)
    eligiblePatients: int = 0
    score: float = 0
    diversityFit: float = 0


class SiteWeights(BaseModel):
    catchment: float = 0.5
    experience: float = 0.3
    rxVolume: float = 0.2


class DiversityTargets(BaseModel):
    blackPct: float = 0
    hispanicPct: float = 0


class SiteRankingResult(BaseModel):
    sites: list[Site]
    representativeness: dict[str, float]  # demographic -> achieved % in selected set
    diseaseDistribution: dict[str, float]  # demographic -> true disease % (target)


# --------------------------------------------------------------------------- #
# Module 03 — Enrollment forecast
# --------------------------------------------------------------------------- #


class CurvePoint(BaseModel):
    month: str  # "YYYY-MM"
    cumulative: float
    lower: float
    upper: float


class ForecastScenarioResult(BaseModel):
    id: str
    label: str
    numSites: int
    screenFailRate: float
    perSiteRatePerMonth: float
    competingDrag: float
    activationMonths: int
    targetEnrollment: int
    curve: list[CurvePoint]
    lpiDate: Optional[str]
    targetDate: str
    onTrack: bool
    monthsToTarget: Optional[int]


class ForecastResult(BaseModel):
    scenarios: list[ForecastScenarioResult]
    # sites needed to hit target date with current per-site assumptions
    sitesNeededForTarget: Optional[int] = None
    feasibleByTarget: bool = True


# --------------------------------------------------------------------------- #
# Module 04 — KOL
# --------------------------------------------------------------------------- #

KolSegment = Literal["established", "rising_star", "dol"]


class KolSignals(BaseModel):
    """Real, RWD-derived KOL signals (publications/congress/digital are NOT in RWD).

    All normalized 0..1 across the cohort.
    """
    patientVolume: float       # decile patient counts
    referralCentrality: float  # weighted referral degree (in + out shares)
    referralReach: float       # PageRank over the referral graph
    trialLeadership: float     # number of trials led (investigator rows)
    trialRecency: float        # recency of most recent trial activity
    specialtyFit: float        # alignment of specialty with the indication


class Kol(BaseModel):
    id: str
    name: str
    region: str
    specialty: str
    segment: KolSegment
    signals: KolSignals
    linkedSiteIds: list[str] = Field(default_factory=list)
    score: float = 0
    # real provenance
    npi: Optional[int] = None
    trialCount: int = 0
    competingTrials: int = 0


class KolEdge(BaseModel):
    source: str
    target: str
    kind: Literal["referral", "coauthor", "coinvestigator"]
    weight: float


class KolGraphResult(BaseModel):
    nodes: list[Kol]
    edges: list[KolEdge]


# --------------------------------------------------------------------------- #
# Module 05 — In-flight monitoring
# --------------------------------------------------------------------------- #

RiskLevel = Literal["on_track", "watch", "at_risk", "critical"]


class SiteStatus(BaseModel):
    siteId: str
    name: str
    region: str
    planned: int
    actual: int
    forecast: int
    risk: RiskLevel
    predictedShortfall: int
    rootCause: str


class MonitoringResult(BaseModel):
    studyPlanned: int
    studyActual: int
    studyForecast: int
    sites: list[SiteStatus]
    atRiskCount: int


# --------------------------------------------------------------------------- #
# Module 06 — Population sizing
# --------------------------------------------------------------------------- #


class IndicationOpportunity(BaseModel):
    id: str
    label: str
    diagnosed: int
    treated: int
    trialEligible: int
    competingTrialDensity: float
    feasibilityScore: float
    region: str = "National"


class PopulationResult(BaseModel):
    indications: list[IndicationOpportunity]


# --------------------------------------------------------------------------- #
# Dataset bundle (shipped to the client on load)
# --------------------------------------------------------------------------- #


class Benchmarks(BaseModel):
    avgScreenFailRate: float
    avgPerSiteRatePerMonth: float
    avgActivationMonths: int


# --------------------------------------------------------------------------- #
# New-insight models (real RWD)
# --------------------------------------------------------------------------- #


class TrialSummary(BaseModel):
    id: str  # NCT id
    title: str
    phase: str = ""
    sponsor: str = ""
    sponsorClass: str = ""
    condition: str = ""
    status: str = ""
    startDate: Optional[str] = None
    endDate: Optional[str] = None
    investigators: int = 0
    states: list[str] = Field(default_factory=list)


class UntappedPI(BaseModel):
    """High-volume provider with NO clinical-trial history (anti-join)."""
    npi: int
    name: str
    specialty: str = ""
    state: str = ""
    region: str = "National"
    patientCount: int = 0
    decile: int = 0
    hcoName: Optional[str] = None
    referralCentrality: float = 0


class SaturationStat(BaseModel):
    """Competing-trial density + investigator load by state or condition."""
    key: str
    dimension: Literal["state", "condition", "investigator"]
    trials: int = 0
    investigators: int = 0
    competingDensity: float = 0  # 0..1 normalized
    overCommitted: int = 0       # # investigators above trial-load threshold


class WhitespaceRegion(BaseModel):
    """Patient density vs site coverage + diversity gap, by state."""
    state: str
    region: str = "National"
    patientDensity: int = 0   # diagnosed patients in the state
    siteCount: int = 0
    hasSite: bool = False
    diversityIndex: float = 0  # non-white share of patients (0..1)
    whitespaceScore: float = 0  # high density + no/low coverage


class AgeBand(BaseModel):
    band: str
    lo: int
    hi: int
    count: int


class Distributions(BaseModel):
    ageHistogram: list[AgeBand] = Field(default_factory=list)
    genderSplit: dict[str, float] = Field(default_factory=dict)      # fractions
    payerMix: dict[str, float] = Field(default_factory=dict)         # fractions
    geoDemographics: dict[str, float] = Field(default_factory=dict)  # race -> national fraction


class Dataset(BaseModel):
    seed: int
    dataVersion: str
    program: str
    totalUniverse: int
    criteria: list[Criterion]
    sites: list[Site]
    kols: list[Kol]
    kolEdges: list[KolEdge]
    indications: list[IndicationOpportunity]
    regions: list[str]
    benchmarks: Benchmarks
    # new real-data fields (optional/defaulted so the synthetic fallback still validates)
    dataSource: str = "synthetic"  # "db" | "synthetic"
    trials: list[TrialSummary] = Field(default_factory=list)
    untappedPIs: list[UntappedPI] = Field(default_factory=list)
    saturation: list[SaturationStat] = Field(default_factory=list)
    whitespace: list[WhitespaceRegion] = Field(default_factory=list)
    distributions: Optional[Distributions] = None


# --------------------------------------------------------------------------- #
# Interactive map models (HCP + site geography; served by /api/map/*)
# --------------------------------------------------------------------------- #


class MapSiteOut(BaseModel):
    id: str
    name: str
    lat: float
    lng: float
    city: Optional[str] = None
    state: Optional[str] = None
    status: Optional[str] = None


class MapHcp(BaseModel):
    npi: int
    name: str
    specialty: str = ""
    lat: float
    lng: float
    decile: int = 0
    patientCount: int = 0
    hcoName: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    geoSource: Optional[str] = None
    hasReferrals: bool = False  # appears in the referral graph (as source or target)


class ReferralEdgeOut(BaseModel):
    source: int   # hcp_npi
    target: int   # connected_hcp_npi
    shareOut: float = 0
    shareIn: float = 0


class ReferralNetwork(BaseModel):
    center: int
    nodes: list[MapHcp] = Field(default_factory=list)
    edges: list[ReferralEdgeOut] = Field(default_factory=list)


class HcpProfile(BaseModel):
    npi: int
    name: str
    firstName: Optional[str] = None
    lastName: Optional[str] = None
    specialty: Optional[str] = None
    decile: int = 0
    patientCount: int = 0
    primaryHcoNpi: Optional[int] = None
    primaryHcoName: Optional[str] = None
    primaryHcoClassification: Optional[str] = None
    primaryHcoFacilityType: Optional[str] = None
    primaryHcoAddress: Optional[str] = None
    primaryHcoCity: Optional[str] = None
    primaryHcoState: Optional[str] = None
    primaryHcoZip: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    region: str = "National"
    outboundConnections: int = 0
    inboundConnections: int = 0
    referralDegree: int = 0
    topReferrals: list[dict] = Field(default_factory=list)  # {npi,name,specialty,shareOut,shareIn}
    trials: list[TrialSummary] = Field(default_factory=list)
