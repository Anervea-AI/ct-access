// Default scenario factory — MUST match backend/app/models/inputs.py defaults.
import type { Dataset, ScenarioState } from "@/types";

export function defaultScenario(
  ds: Dataset,
  id = "base",
  name = "Base scenario",
): ScenarioState {
  return {
    id,
    name,
    protocolVersion: "A",
    criteria: ds.criteria.map((c) => structuredClone(c)),
    siteFilters: {
      minEligible: 0,
      regions: [],
      specialties: [],
      piExperienceMin: 0,
      catchmentRadiusMiles: 50,
      weights: { catchment: 0.5, experience: 0.3, rxVolume: 0.2 },
      diversityWeight: 0,
      diversityTargets: {},
    },
    forecast: {
      startMonth: "2026-07",
      numSites: 30,
      activationMonths: 4,
      screenFailRate: 0.28,
      perSiteRatePerMonth: 1.9,
      competingDrag: 0.1,
      targetEnrollment: 300,
      targetDate: "2027-09",
    },
    kol: {
      weights: {
        patientVolume: 0.25,
        referralCentrality: 0.2,
        referralReach: 0.15,
        trialLeadership: 0.2,
        trialRecency: 0.1,
        specialtyFit: 0.1,
      },
      segment: null,
      region: null,
      specialty: null,
    },
    monitoring: {
      watchThreshold: 0.9,
      atRiskThreshold: 0.75,
      criticalThreshold: 0.55,
      rescueSiteIds: [],
    },
    cohort: {
      minAge: 18,
      maxAge: 65,
      treatedOnly: true,
      region: "National",
      matrixX: "trialEligible",
      matrixY: "competingTrialDensity",
    },
  };
}
