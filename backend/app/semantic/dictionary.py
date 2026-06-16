"""Semantic layer / data dictionary.

Maps business terms -> definitions, data fields, code sets, and the data source
(open vs closed claims). The assistant grounds every material figure in an entry
here so it can "reveal the work" (PRD §6.2, §8) instead of inventing numbers.
"""
from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class TermDefinition(BaseModel):
    term: str
    definition: str
    fields: list[str]
    codeSets: list[str] = []
    source: str  # "closed claims" | "open claims" | "reference" | "modeled (proxy)"
    notes: Optional[str] = None


DATA_DICTIONARY: dict[str, TermDefinition] = {
    "eligible_pool": TermDefinition(
        term="Eligible pool",
        definition="Estimated number of de-identified patients meeting all enabled inclusion criteria and no enabled exclusion criteria, computed by sequentially applying each criterion's reduction to the diagnosed universe.",
        fields=["diagnoses", "medications", "procedures", "demographics", "temporal_sequence"],
        codeSets=["ICD-10-CM", "NDC", "CPT/HCPCS"],
        source="claims-derived RWD",
        notes="Diagnosed universe (Σ ZIP3 patient counts ≈ 437k). Age reduction is data-backed from the real age histogram; clinical/severity criteria remain labeled proxies.",
    ),
    "diagnosed_universe": TermDefinition(
        term="Diagnosed universe",
        definition="Unique patients with at least one qualifying diagnosis code for the indication in the analysis window.",
        fields=["diagnoses"],
        codeSets=["ICD-10-CM F31.x"],
        source="open claims",
        notes="Open claims used for breadth of coverage.",
    ),
    "eligible_patients_site": TermDefinition(
        term="Eligible patients (per site)",
        definition="Eligible-pool patients estimated to fall within a site's catchment, computed as the site's catchment share of the current eligible pool.",
        fields=["provider_location", "patient_zip3", "drive_time"],
        codeSets=["NPI/NPPES"],
        source="open claims",
        notes="Patient geography resolves to ZIP3/region (de-identification constraint).",
    ),
    "site_score": TermDefinition(
        term="Site score",
        definition="Weighted composite of normalized eligible-patient catchment, prior-trial experience, and indication prescribing volume, minus a competing-trial penalty, plus a diversity-fit bonus.",
        fields=["eligiblePatients", "piExperienceTrials", "indicationRxVolume", "competingTrials", "demographics"],
        codeSets=["NPI/NPPES", "ClinicalTrials.gov"],
        source="reference",
    ),
    "enrollment_curve": TermDefinition(
        term="Enrollment curve",
        definition="Projected cumulative patients enrolled over time given active sites, per-site monthly enrollment rate, screen-fail rate, and competing-trial drag.",
        fields=["site_activation", "perSiteRate", "screenFailRate", "competingDrag"],
        codeSets=["benchmark enrollment rates"],
        source="reference",
    ),
    "screen_fail_rate": TermDefinition(
        term="Screen-fail rate",
        definition="Fraction of screened patients found ineligible at screening; reduces net enrolled per screened patient.",
        fields=["screenFailRate"],
        source="reference",
        notes="Benchmark-derived; adjustable per scenario.",
    ),
    "kol_score": TermDefinition(
        term="KOL score",
        definition="Weighted blend of REAL RWD signals: patient volume (decile counts), referral centrality (weighted referral degree), referral reach (PageRank over the referral graph), trial leadership (investigator history), trial recency, and specialty fit. Publications/congress/digital signals are NOT in the RWD and are intentionally excluded.",
        fields=["patient_count", "referral_shares", "trial_history", "specialty"],
        codeSets=["NPI/NPPES", "ClinicalTrials.gov"],
        source="claims-derived RWD",
    ),
    "referral_centrality": TermDefinition(
        term="Referral centrality / reach",
        definition="Centrality = weighted referral degree (sum of inbound + outbound patient shares) for a provider. Reach = PageRank over the directed referral network — a provider is high-reach if highly-connected providers refer to them.",
        fields=["share_outbound", "share_inbound", "connected_hcp_npi"],
        codeSets=["NPI/NPPES"],
        source="claims-derived RWD",
        notes="Computed with networkx over the real HCP referral network.",
    ),
    "untapped_pi": TermDefinition(
        term="Untapped high-volume PI",
        definition="A top-decile provider (high diagnosed-patient volume) with NO clinical-trial investigator history — a net-new PI candidate, found by anti-joining the provider table against ClinicalTrials.gov investigator rows.",
        fields=["patient_count", "decile", "trial_history"],
        codeSets=["NPI/NPPES", "ClinicalTrials.gov"],
        source="claims-derived RWD",
    ),
    "trial_saturation": TermDefinition(
        term="Competing-trial saturation",
        definition="Density of competing trials by state/condition and per-investigator trial load. Over-committed investigators run more than 3 concurrent trials.",
        fields=["trial_id", "npi", "facility_state", "condition_mesh_terms", "status"],
        codeSets=["ClinicalTrials.gov", "MeSH"],
        source="ClinicalTrials.gov",
    ),
    "geographic_whitespace": TermDefinition(
        term="Geographic whitespace",
        definition="States with high diagnosed-patient density but no current trial site — expansion candidates. Diversity gap compares the non-white patient share of uncovered vs covered states.",
        fields=["patient_count", "white", "black", "asian", "hispanic", "site_state"],
        codeSets=["ZIP3", "Census race/ethnicity"],
        source="claims-derived RWD",
    ),
    "representativeness": TermDefinition(
        term="Diversity representativeness",
        definition="Demographic composition of the selected site set's eligible patients, compared to the indication's true disease distribution.",
        fields=["demographics", "eligiblePatients"],
        codeSets=["SDOH", "Census"],
        source="reference",
    ),
    "trial_eligible": TermDefinition(
        term="Trial-eligible population",
        definition="Treated patients estimated to meet a representative protocol's eligibility for the indication.",
        fields=["diagnoses", "medications", "demographics"],
        codeSets=["ICD-10-CM", "NDC"],
        source="closed claims",
    ),
}


def lookup(term_key: str) -> Optional[TermDefinition]:
    return DATA_DICTIONARY.get(term_key)
