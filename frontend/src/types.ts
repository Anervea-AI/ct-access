// TypeScript mirror of backend/app/models/schemas.py + inputs.py. Keep in sync.

export type CriterionType = "inclusion" | "exclusion";
export type Confidence = "high" | "medium" | "low";

export interface ParamSpec {
  name: string;
  value: number;
  min: number;
  max: number;
  step: number;
  default: number;
  unit: string;
}

export interface Criterion {
  id: string;
  type: CriterionType;
  label: string;
  category: string;
  enabled: boolean;
  isProxy: boolean;
  proxyNote?: string | null;
  confidence?: Confidence | null;
  codes: string[];
  baseReductionPct: number;
  param?: ParamSpec | null;
  paramSlope: number;
  dataSource?: string | null;
}

// ---- AI-assisted criterion builder (served by /api/feasibility/parse-criterion) ---- //
export interface ParsedClause {
  field: string;
  label: string;
  matchFrac: number;
}

export interface ParseCriterionResponse {
  available: boolean;
  criterion?: Criterion | null;
  explanation: string;
  clauses: ParsedClause[];
  missingData?: string | null;
  usedLlm: boolean;
}

// ---- agentic plan (served by /api/feasibility/plan-criteria) ---- //
export type CriterionOp = "add" | "modify" | "enable" | "disable";
export type CriterionFieldName = "enabled" | "paramValue" | "baseReductionPct" | "label" | "type";

export interface FieldChange {
  field: CriterionFieldName;
  oldValue?: number | string | boolean | null;
  newValue?: number | string | boolean | null;
}

export interface CriterionAction {
  op: CriterionOp;
  targetId?: string | null;
  reason: string;
  criterion?: Criterion | null;
  changes: FieldChange[];
  clauses: ParsedClause[];
}

export interface PlanCriteriaResponse {
  available: boolean;
  actions: CriterionAction[];
  explanation: string;
  missingData?: string | null;
  usedLlm: boolean;
}

export interface FunnelStep {
  criterionId: string;
  label: string;
  type: CriterionType;
  remaining: number;
  removed: number;
  pct: number;
  reductionPct: number;
}

export interface EligibilityFunnelResult {
  totalUniverse: number;
  steps: FunnelStep[];
  eligiblePool: number;
  biggestConstraintId?: string | null;
  biggestConstraintLabel?: string | null;
  biggestConstraintRemoved: number;
  biggestConstraintRemovedPct: number;
}

export interface Demographics {
  blackPct: number;
  hispanicPct: number;
  asianPct: number;
  whitePct: number;
  femalePct: number;
  ruralPct: number;
}

export interface Site {
  id: string;
  name: string;
  lat: number;
  lng: number;
  region: string;
  state: string;
  baseShare: number;
  piExperienceTrials: number;
  indicationRxVolume: number;
  competingTrials: number;
  specialties: string[];
  demographics: Demographics;
  npi?: number | null;
  address?: string | null;
  city?: string | null;
  status?: string | null;
  primaryContact?: string | null;
  phone?: string | null;
  email?: string | null;
  eligiblePatients: number;
  score: number;
  diversityFit: number;
}

export interface SiteWeights {
  catchment: number;
  experience: number;
  rxVolume: number;
}

export interface SiteRankingResult {
  sites: Site[];
  representativeness: Record<string, number>;
  diseaseDistribution: Record<string, number>;
}

export interface CurvePoint {
  month: string;
  cumulative: number;
  lower: number;
  upper: number;
}

export interface ForecastScenarioResult {
  id: string;
  label: string;
  numSites: number;
  screenFailRate: number;
  perSiteRatePerMonth: number;
  competingDrag: number;
  activationMonths: number;
  targetEnrollment: number;
  curve: CurvePoint[];
  lpiDate: string | null;
  targetDate: string;
  onTrack: boolean;
  monthsToTarget: number | null;
}

export interface ForecastResult {
  scenarios: ForecastScenarioResult[];
  sitesNeededForTarget: number | null;
  feasibleByTarget: boolean;
}

export type KolSegment = "established" | "rising_star" | "dol";

export interface KolSignals {
  patientVolume: number;
  referralCentrality: number;
  referralReach: number;
  trialLeadership: number;
  trialRecency: number;
  specialtyFit: number;
}

export interface Kol {
  id: string;
  name: string;
  region: string;
  specialty: string;
  segment: KolSegment;
  signals: KolSignals;
  linkedSiteIds: string[];
  score: number;
  npi?: number | null;
  trialCount: number;
  competingTrials: number;
}

export interface KolEdge {
  source: string;
  target: string;
  kind: "referral" | "coauthor" | "coinvestigator";
  weight: number;
}

export interface KolGraphResult {
  nodes: Kol[];
  edges: KolEdge[];
}

export type RiskLevel = "on_track" | "watch" | "at_risk" | "critical";

export interface SiteStatus {
  siteId: string;
  name: string;
  region: string;
  planned: number;
  actual: number;
  forecast: number;
  risk: RiskLevel;
  predictedShortfall: number;
  rootCause: string;
}

export interface MonitoringResult {
  studyPlanned: number;
  studyActual: number;
  studyForecast: number;
  sites: SiteStatus[];
  atRiskCount: number;
}

export interface IndicationOpportunity {
  id: string;
  label: string;
  diagnosed: number;
  treated: number;
  trialEligible: number;
  competingTrialDensity: number;
  feasibilityScore: number;
  region: string;
}

export interface PopulationResult {
  indications: IndicationOpportunity[];
}

export interface Benchmarks {
  avgScreenFailRate: number;
  avgPerSiteRatePerMonth: number;
  avgActivationMonths: number;
}

export interface TrialSummary {
  id: string;
  title: string;
  phase: string;
  sponsor: string;
  sponsorClass: string;
  condition: string;
  status: string;
  startDate?: string | null;
  endDate?: string | null;
  investigators: number;
  states: string[];
}

export interface UntappedPI {
  npi: number;
  name: string;
  specialty: string;
  state: string;
  region: string;
  patientCount: number;
  decile: number;
  hcoName?: string | null;
  referralCentrality: number;
}

export interface SaturationStat {
  key: string;
  dimension: "state" | "condition" | "investigator";
  trials: number;
  investigators: number;
  competingDensity: number;
  overCommitted: number;
}

export interface WhitespaceRegion {
  state: string;
  region: string;
  patientDensity: number;
  siteCount: number;
  hasSite: boolean;
  diversityIndex: number;
  whitespaceScore: number;
}

export interface AgeBand {
  band: string;
  lo: number;
  hi: number;
  count: number;
}

export interface Distributions {
  ageHistogram: AgeBand[];
  genderSplit: Record<string, number>;
  payerMix: Record<string, number>;
  geoDemographics: Record<string, number>;
}

export interface Dataset {
  seed: number;
  dataVersion: string;
  program: string;
  totalUniverse: number;
  criteria: Criterion[];
  sites: Site[];
  kols: Kol[];
  kolEdges: KolEdge[];
  indications: IndicationOpportunity[];
  regions: string[];
  benchmarks: Benchmarks;
  dataSource: string;
  trials: TrialSummary[];
  untappedPIs: UntappedPI[];
  saturation: SaturationStat[];
  whitespace: WhitespaceRegion[];
  distributions?: Distributions | null;
}

// ---- interactive map (served by /api/map/*) ---- //

export interface MapSiteOut {
  id: string;
  name: string;
  lat: number;
  lng: number;
  city?: string | null;
  state?: string | null;
  status?: string | null;
}

export interface MapHcp {
  npi: number;
  name: string;
  specialty: string;
  lat: number;
  lng: number;
  decile: number;
  patientCount: number;
  hcoName?: string | null;
  city?: string | null;
  state?: string | null;
  geoSource?: string | null;
  hasReferrals?: boolean;
}

export interface ReferralEdgeOut {
  source: number;
  target: number;
  shareOut: number;
  shareIn: number;
}

export interface ReferralNetwork {
  center: number;
  nodes: MapHcp[];
  edges: ReferralEdgeOut[];
}

export interface HcpReferralRef {
  npi: number;
  name: string;
  specialty: string;
  hco?: string | null;
  shareOut: number;
  shareIn: number;
}

export interface HcpProfile {
  npi: number;
  name: string;
  firstName?: string | null;
  lastName?: string | null;
  specialty?: string | null;
  decile: number;
  patientCount: number;
  primaryHcoNpi?: number | null;
  primaryHcoName?: string | null;
  primaryHcoClassification?: string | null;
  primaryHcoFacilityType?: string | null;
  primaryHcoAddress?: string | null;
  primaryHcoCity?: string | null;
  primaryHcoState?: string | null;
  primaryHcoZip?: string | null;
  lat?: number | null;
  lng?: number | null;
  region: string;
  outboundConnections: number;
  inboundConnections: number;
  referralDegree: number;
  topReferrals: HcpReferralRef[];
  trials: TrialSummary[];
}

// ---- scenario inputs (mutable controls) ---- //

export interface SiteFilters {
  minEligible: number;
  regions: string[];
  specialties: string[];
  piExperienceMin: number;
  catchmentRadiusMiles: number;
  weights: SiteWeights;
  diversityWeight: number;
  diversityTargets: Record<string, number>;
}

export interface ForecastInput {
  startMonth: string;
  numSites: number;
  activationMonths: number;
  screenFailRate: number;
  perSiteRatePerMonth: number;
  competingDrag: number;
  targetEnrollment: number;
  targetDate: string;
}

export interface KolControls {
  weights: Record<string, number>;
  segment: string | null;
  region: string | null;
  specialty: string | null;
}

export interface MonitoringControls {
  watchThreshold: number;
  atRiskThreshold: number;
  criticalThreshold: number;
  rescueSiteIds: string[];
}

export interface CohortControls {
  minAge: number;
  maxAge: number;
  treatedOnly: boolean;
  region: string;
  matrixX: string;
  matrixY: string;
}

export interface ScenarioState {
  id: string;
  name: string;
  protocolVersion: string;
  criteria: Criterion[];
  siteFilters: SiteFilters;
  forecast: ForecastInput;
  kol: KolControls;
  monitoring: MonitoringControls;
  cohort: CohortControls;
}

// ---- assistant ---- //

export interface AuditBlock {
  term?: string;
  definition?: string;
  source?: string;
  fields?: string[];
  codeSets?: string[];
  notes?: string | null;
  proxy?: {
    criterion: string;
    proxyApproach: string;
    parameter: string;
    confidence: string;
    limitation: string;
  };
}

export interface VizSpec {
  type: "funnel" | "bar" | "table" | "line";
  [key: string]: unknown;
}

export interface ChatResponse {
  text: string;
  viz: VizSpec | null;
  audit: AuditBlock[];
  toolCalls: string[];
  usedLlm: boolean;
  error?: string;
}
