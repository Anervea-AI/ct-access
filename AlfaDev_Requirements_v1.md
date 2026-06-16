# AlfaDev — Product Requirements Document (v1)

**Product:** AlfaDev — AI-native clinical-trial feasibility and operations platform
**Owner:** Anervea
**Status:** Draft for engineering / build-platform handoff
**Primary reference scenario:** A late-stage neuropsychiatric biopharma (e.g., a bipolar I depression and adjunctive MDD program) planning and running US clinical trials.

---

## 0. How to read this document

This PRD is written so it can be handed directly to a software engineering team **or** pasted into an AI build platform (Lovable, Bolt, v0, Replit Agent, etc.).

- Sections 1–6 are context and cross-cutting requirements that apply to the whole product.
- Section 7 specifies the six functional modules (use cases), each with the same template: purpose, inputs, features, visualizations, interactions, assistant queries, data dependencies, acceptance criteria, priority.
- Section 10 gives a suggested stack and mock-data schemas so a prototype can be built **before** real data is connected.
- Section 11 defines build phases. **For a first prototype, build Phase 0 only** (all screens, synthetic data, full client-side interactivity).

Two product principles run through everything and must not be treated as per-module features:

1. **Everything is a live object, not a static report.** Every number, chart, map, and list is the output of a calculation over inputs the user can change. When an input changes, all dependent views recompute and re-render. Inputs cascade across modules (see §6.1).
2. **One conversational assistant spans the whole platform.** It answers in charts/tables, *and* it can explain the logic and reveal the underlying data or proxy behind any number (auditability, not just answers). See §6.2 and §8.

---

## 1. Product overview

AlfaDev turns a clinical trial protocol into defensible, data-backed feasibility decisions — which sites to use, whether the protocol is recruitable, how fast it will enroll, which investigators and KOLs matter, how enrollment is tracking, and which indications to prioritize — using US real-world patient data (claims-based patient journeys) plus reference and operational data.

The platform replaces slow, questionnaire-based feasibility with an interactive workspace where users manipulate protocol criteria, site parameters, and forecasting assumptions and watch the consequences update in real time, and where a conversational assistant can answer and audit any question against the same data.

---

## 2. Goals and non-goals

### Goals
- Let a user go from a protocol to a ranked, defensible site/investigator list in days.
- Quantify, in real patient counts, how each eligibility criterion affects the recruitable population.
- Forecast enrollment and monitor it against actuals during the trial.
- Provide a single conversational interface for analysis and verification across all modules.
- Be auditable: every output can be traced to its data source, definition, and (for modeled values) its proxy logic.

### Non-goals (v1)
- Not an EDC, CTMS, or eTMF; AlfaDev integrates with them but does not replace them.
- Not a commercialization / marketing-CI product (that is a separate platform; AlfaDev is clinical-development only).
- Not a regulatory submission system.
- Not a source of patient-identifiable data; all patient-level data is de-identified.

---

## 3. Users and personas

- **Clinical Operations / Feasibility Lead** — primary user. Runs feasibility, selects sites, forecasts enrollment, monitors trials.
- **Clinical Development / Medical** — protocol design, KOL strategy, indication prioritization.
- **Biostatistics / Data Science** — validates definitions and proxies; uses the assistant for checking.
- **Portfolio / Strategy** — uses population sizing and indication prioritization.
- **Executive / Sponsor stakeholder** — consumes dashboards and exported summaries.

Access is role-based; all roles share the same data backbone with different default views.

---

## 4. Domain glossary (for engineers unfamiliar with the domain)

- **Protocol** — the trial design document; contains eligibility criteria, endpoints, schedule.
- **Inclusion/Exclusion (I/E) criteria** — rules a patient must meet (inclusion) or must not meet (exclusion) to be eligible.
- **Eligible pool** — number of real patients estimated to meet all I/E criteria.
- **Eligibility funnel / pyramid** — sequential application of each criterion showing how the pool shrinks step by step.
- **Site** — a clinical location (clinic/hospital) running the trial.
- **PI (Principal Investigator)** — lead physician at a site.
- **Catchment** — the geographic area a site draws patients from (radius or drive-time).
- **KOL (Key Opinion Leader)** — an influential physician/researcher. **DOL** = Digital Opinion Leader (influence via digital/social channels). **Rising star** = KOL with fast-growing influence trajectory.
- **Enrollment curve** — projected/actual cumulative patients enrolled over time. **LPI** = last patient in.
- **Screen fail** — a patient who is screened but found ineligible.
- **Closed claims** — complete, linkable patient journeys across care settings. **Open claims** — broader but partial journeys.
- **SDOH** — social determinants of health (socioeconomic/lifestyle factors).
- **Proxy** — a measurable signal used to approximate something not directly in the data (e.g., approximating depression severity from treatment intensity).

---

## 5. Data architecture and sources

> For a prototype (Phase 0), **all of this is replaced by synthetic mock data** (see §10.3). Real data wiring begins in Phase 1.

### 5.1 Core data layer — patient journeys (RWD)
US claims-based **longitudinal patient journeys** (reference provider: Komodo Health Healthcare Map; ~330M patient journeys, open + closed claims, ~160M closed linkable lives/year, refreshed monthly). De-identified, patient-level. Each journey contributes:

- Diagnoses (ICD-10-CM) with dates
- Medications — pharmacy (NDC) and medical-benefit drugs (J-codes)
- Procedures (CPT/HCPCS)
- Provider identifiers (NPI), specialty taxonomy, facility/HCO, place of service
- Payer / plan type (commercial, Medicare, Medicaid)
- Encounters and the longitudinal sequence (enables "current episode", washout, line-of-therapy, switching)
- Demographics (age, sex, geography) and mortality (via linkage)
- **Open vs closed flag** — closed used for eligibility/sequencing precision; open used for breadth of site/provider coverage.

**Geographic granularity:** patient geography resolves to ~3-digit ZIP / region (de-identification constraint). Provider locations are granular via the public NPI registry. Site catchments are built from precise provider locations overlaid on ZIP3-level patient density.

### 5.2 Reference and operational data (beyond RWD)
- **Protocol documents** (sponsor-provided) → NLP extraction to structured I/E criteria.
- **Medical ontologies / crosswalks:** ICD-10, NDC, RxNorm/ATC, CPT/HCPCS, LOINC, SNOMED, NUCC provider taxonomy.
- **Provider/HCO reference:** NPPES NPI registry, specialty, affiliations, addresses (geocoding).
- **Trial registry:** ClinicalTrials.gov (and ex-US registries) for competing-trial saturation and historical investigator/site performance.
- **Investigator/site benchmarks:** past enrollment rates, GCP history, screen-fail rates.
- **Geographic/denominator reference:** ZIP/MSA/region boundaries, drive-time models, Census.
- **SDOH enrichment:** socioeconomic/lifestyle (e.g., Experian) for diversity/access.
- **EHR enrichment (optional):** linked EHR (e.g., Veradigm) for labs/vitals depth.
- **KOL signals:** publications, congress/abstract activity, trial leadership, digital/social footprint.

### 5.3 Psychiatry-specific proxy layer (critical)
Claims do not contain several psychiatric trial criteria. These must be modeled via documented proxies, and the proxy must be surfaced to the user (see §6.2 auditability):

| Criterion not in claims | Proxy approach |
|---|---|
| Severity scales (MADRS, YMRS, HAM-D, CGI) | Treatment intensity, polypharmacy, hospitalization, ECT, prior therapy lines |
| "Current" depressive episode timing | Claim recency + treatment changes |
| Suicidality | Self-harm / ideation ICD codes, ER encounters (understates true rate) |
| Substance use disorder | ICD codes (under-captured) |
| Diagnostic accuracy | Coded label, not clinician-confirmed; expect bipolar↔MDD misclassification |

Every modeled criterion carries: the proxy definition, an adjustable strictness parameter, and a confidence note.

---

## 6. Cross-cutting platform requirements

### 6.1 Interactivity and cascade model (must-have)
- All inputs are first-class controls (toggles, sliders, dropdowns, map selections, editable fields).
- Changing an input recomputes all dependent outputs and re-renders without a page reload, ideally < 300 ms on the prototype dataset.
- **Inputs cascade across modules via a shared "scenario" state.** Example: relaxing a criterion in Feasibility (Module 02) updates the eligible pool, which updates the site ranking (01) and the enrollment forecast (03).
- Users can create, name, save, duplicate, and compare **scenarios** (A/B). A scenario captures the full set of inputs across modules.
- All displayed numbers are rounded appropriately (integers for counts, 1–2 decimals for rates/percentages, thousands separators for large counts).

### 6.2 Conversational assistant (must-have, platform-wide)
A single assistant available from every module (docked panel + full-screen). It must:
- Accept natural-language questions and return charts, tables, maps, and short text.
- Operate over the same data and definitions the modules use (a shared semantic layer / data dictionary) — it must not invent numbers.
- **Reveal the work:** for any answer, the user can ask "how did you get this?" and see the definition, filters, data source (open/closed), and — for modeled values — the proxy and its parameters.
- Drill down to underlying (de-identified, aggregated) records where permitted.
- Apply the current scenario's inputs by default, and optionally run a one-off scenario from the question itself.
- Cite the data source/proxy for each material claim in its answer.
- Refuse or flag questions that would require patient-identifiable data.

### 6.3 Other cross-cutting requirements
- **Export:** every view exports to CSV/XLSX (data), PNG/SVG (charts/maps), and PDF (a defensible, audit-ready summary with definitions and timestamps).
- **Audit trail:** every scenario records who changed what and when; outputs are timestamped and tied to a data-refresh version.
- **Auth & RBAC:** SSO/SAML; roles per §3; row/column-level data permissions where applicable.
- **Accessibility:** WCAG 2.1 AA; keyboard navigable; screen-reader labels on all charts/maps.
- **Theming:** light/dark mode; configurable brand palette.
- **Multi-study & multi-indication:** users switch between studies/indications; data scoped accordingly.

---

## 7. Functional modules (the six use cases)

Each module follows the same template. Priority key: **MVP** (Phase 1), **P2** (Phase 2), **P3** (Phase 3). All six are built as screens in Phase 0 on mock data.

---

### Module 01 — Site & PI identification (geography + diversity)  · Priority: MVP

**Purpose / question answered:** Where should we run this trial, and who should run it? Locate, rank, and map sites and investigators by real patient catchment, trial-readiness, and diversity fit.

**Primary user:** Clinical Ops / Feasibility Lead.

**Inputs the user manipulates:**
- Catchment radius / drive-time (slider).
- Minimum eligible patients per site (slider).
- Required specialty mix (multi-select).
- PI experience threshold (slider/toggle: prior trials, indication experience).
- Diversity / SDOH targets (set demographic or socioeconomic representation goals).
- Region/state filters (map selection or list).

**Core features:**
- Ranked, filterable, sortable site/PI leaderboard scored on eligible-patient catchment, prior trial experience, and indication prescribing volume.
- Interactive US map: pan/zoom, click a region to drill into sites; toggleable layers (patient density, provider density, eligible-pool overlay).
- Diversity layer: re-optimizes the site set toward demographic/SDOH targets and shows representativeness vs the disease's true distribution; updates as targets change.
- Shortlist builder with side-by-side site comparison.
- One-click exportable site-selection rationale (audit-ready).

**Visualizations / UI:** choropleth + point map; ranked table; site detail panel (scorecard); diversity representativeness bars.

**Interactions / cascade:** consumes the eligible pool from Module 02; feeds the selected site list to Modules 03 (forecast) and 05 (monitoring). Changing catchment/filters re-ranks instantly.

**Assistant queries (examples):**
- "Sites in the Southeast with 150+ eligible patients and above-average Black and Hispanic representation."
- "Why is site #12 ranked above site #7?"

**Data dependencies:** RWD patient journeys; NPI/NPPES; HCO affiliations; geocoding/boundaries; SDOH; trial registry (PI history).

**Acceptance criteria:**
- Given a cohort definition, the map and leaderboard populate and re-rank within the performance budget when any filter changes.
- Diversity targets visibly change the recommended site set and the representativeness chart.
- A site shortlist exports with a rationale containing definitions and a data-version timestamp.

---

### Module 02 — Protocol feasibility stress-testing  · Priority: MVP (build first — demo centerpiece)

**Purpose / question answered:** Is this protocol recruitable, and which criterion is hurting us most?

**Inputs the user manipulates:**
- Each I/E criterion as a toggle (on/off).
- Each numeric criterion as a slider (age range, washout days, prior-line count, severity-proxy strictness).
- Protocol version selector (A/B).

**Core features:**
- Live eligibility funnel/pyramid: each criterion applied sequentially; final eligible count recomputes on every change.
- Auto-flagged "biggest constraint" (single criterion that removes the most patients, with %).
- Scenario A/B comparison: eligible-pool and site-count deltas side by side.
- Geographic sensitivity: which regions "unlock" when a criterion is relaxed.
- Proxy-transparency panel for psychiatry criteria: shows the proxy used and lets the user tune strictness.

**Visualizations / UI:** horizontal funnel with per-step counts and %, biggest-constraint callout, geographic breakdown bars, A/B compare view.

**Interactions / cascade:** the master upstream module — its eligible pool drives Modules 01 and 03. Each criterion toggle/slider triggers full recompute.

**Assistant queries (examples):**
- "What happens to my eligible pool if I extend the antipsychotic washout from two to four weeks?"
- "Which exclusion criterion costs me the most patients, and what proxy are you using for severity?"

**Data dependencies:** RWD (diagnoses, drugs, procedures, demographics, temporal sequence); ontologies/crosswalks; psychiatry proxy layer; protocol NLP extraction.

**Acceptance criteria:**
- Toggling/sliding any criterion recomputes the funnel and final count within the performance budget.
- The biggest-constraint flag updates correctly when criteria change.
- Every modeled (proxy) criterion exposes its definition and an adjustable strictness parameter.
- A/B scenarios can be saved and compared.

---

### Module 03 — Enrollment forecasting  · Priority: MVP

**Purpose / question answered:** How fast will this enroll, and what does it take to hit a target date?

**Inputs the user manipulates:**
- Number of sites; site activation schedule.
- Screen-fail rate; per-site enrollment rate.
- Competing-trial drag factor.
- "Add N sites in [region]" control.
- Per-site target allocation (editable).
- Scenario selector: base / optimistic / conservative.

**Core features:**
- Enrollment-curve simulator with confidence band and projected first/last-patient-in dates.
- Levers update the curve and LPI date live.
- Scenarios overlaid on one chart.
- Milestone status vs the sponsor's target date (red/green).

**Visualizations / UI:** cumulative enrollment line chart with band; LPI markers; scenario overlays; milestone indicator; per-site allocation table.

**Interactions / cascade:** consumes the site list (01) and eligible pool (02). Changing sites upstream changes the forecast.

**Assistant queries (examples):**
- "If I need last-patient-in by March 2027, how many sites do I need and where?"
- "Show the forecast if screen-fail rises to 35%."

**Data dependencies:** eligible-patient density per catchment; historical/benchmark enrollment & screen-fail rates; competing-trial load.

**Acceptance criteria:**
- Adjusting any lever updates the curve and LPI date live.
- A target date can be entered and the tool returns the sites needed (or flags infeasibility).
- Three scenarios render on one chart with clear differentiation.

---

### Module 04 — KOL mapping (incl. rising stars + DOLs)  · Priority: P2

**Purpose / question answered:** Who are the influential physicians/researchers for this indication, including emerging and digital leaders?

**Inputs the user manipulates:**
- Signal-weight sliders (patient volume, referral centrality, publications, congress activity, trial leadership, digital reach, rising-star momentum).
- Segment toggle: established KOL / rising star / DOL.
- Geography and specialty filters.

**Core features:**
- Interactive influence network graph (zoom; nodes = KOLs; edges = referral / co-authorship / co-investigator ties; click for profile).
- Multi-signal scoring blending RWD with publication, congress, trial, and digital signals.
- Ranking and graph re-sort live as signal weights change.
- Layer mapping KOLs to sites/HCOs (links to Module 01).

**Visualizations / UI:** force-directed network graph; ranked KOL table; KOL profile panel; signal-weight control panel.

**Interactions / cascade:** can feed candidate investigators into Module 01.

**Assistant queries (examples):**
- "Top 10 rising-star bipolar KOLs in the Midwest by trial activity and social reach."
- "What signals make Dr. X rank highly?"

**Data dependencies:** RWD (volume, referral centrality); publications; congress/abstracts; trial registry (leadership); digital/social signals; NPI reference.

**Acceptance criteria:**
- Adjusting signal weights re-sorts the ranking and graph live.
- Each KOL profile shows the contributing signals and a source for each.
- Segment toggle correctly filters established vs rising vs digital leaders.

---

### Module 05 — In-flight enrollment monitoring & rescue  · Priority: P2

**Purpose / question answered:** Is the running trial on track, and how do we fix at-risk sites?

**Inputs the user manipulates:**
- Alert thresholds (risk levels).
- Rescue-site search filters (region, min eligible flow).
- "Add rescue site" what-if control.

**Core features:**
- Live actual-vs-forecast enrollment dashboard, per study and per site, refreshing on data update.
- Early risk flags with predicted shortfall (before a site stalls), color-coded.
- Root-cause drill-down per flagged site (patient flow thinning, competing trial opening in catchment, screen-fail spike).
- Configurable alerts/notifications.
- Rescue finder: surfaces replacement sites with current eligible flow; what-if simulates adding them and shows the projected curve correction live.

**Visualizations / UI:** study/site status dashboard; actual-vs-forecast charts; risk flags; root-cause panel; rescue-site map/list.

**Interactions / cascade:** consumes the forecast (03) and site list (01); the rescue what-if writes back a revised forecast.

**Assistant queries (examples):**
- "Which sites are most likely to miss target next month, and what's driving it?"
- "Simulate adding two sites in Texas — does it recover the timeline?"

**Data dependencies:** ongoing enrollment actuals (CTMS/EDC integration or upload); RWD for current eligible flow; trial registry for competing trials.

**Acceptance criteria:**
- The dashboard reflects uploaded/integrated actuals and compares to forecast.
- Risk flags trigger at configured thresholds with a predicted shortfall.
- A simulated rescue site updates the projected curve live.

---

### Module 06 — Population sizing & indication prioritization  · Priority: P3

**Purpose / question answered:** Which indications should the portfolio pursue, and how big is each opportunity?

**Inputs the user manipulates:**
- Cohort definition editor (codes, treatment status, age) applied across indications at once.
- Prioritization matrix axis selectors (e.g., population size vs competitive trial density vs feasibility score).
- Region/time-window filters.

**Core features:**
- Indication comparison board: addressable diagnosed and treated populations across indications side by side (e.g., bipolar I depression, adjunctive MDD, negative-symptom schizophrenia, Alzheimer's psychosis/agitation).
- Diagnosed → treated → trial-eligible funnel per indication with drill-down.
- Interactive cohort builder updating counts across all indications simultaneously.
- Prioritization matrix (drag metrics to re-plot); population trend-over-time.

**Visualizations / UI:** comparison bars/cards per indication; per-indication funnels; scatter/bubble prioritization matrix; trend lines.

**Interactions / cascade:** a selected indication seeds a cohort definition into Module 02.

**Assistant queries (examples):**
- "Compare treated addressable population for adjunctive MDD vs bipolar I depression by region."
- "Rank these four indications by population size and inverse trial competition."

**Data dependencies:** RWD (diagnosis/treatment prevalence by geography/time); trial registry (competition); feasibility outputs.

**Acceptance criteria:**
- Editing the cohort definition updates counts for all indications at once.
- The prioritization matrix re-plots when axes/metrics change.

---

## 8. Conversational assistant — detailed spec

- **UI:** dockable side panel on every module + a full-screen mode; message history per scenario.
- **Capabilities:** query (return chart/table/map), explain (definitions, methodology), audit (data source, filters, proxy + parameters behind any number), drill-down (de-identified aggregates), export answer.
- **Grounding:** must use a shared semantic layer / data dictionary mapping business terms → data fields, definitions, and code sets. The assistant generates queries against this layer (function/tool calling), not free-form fabricated numbers.
- **Scenario awareness:** defaults to the active scenario's inputs; can run a one-off scenario described in the question without overwriting saved scenarios.
- **Safety:** never returns patient-identifiable data; flags out-of-scope or low-confidence answers; states the proxy and its limitations for modeled psychiatric criteria.
- **Output format:** concise text + the relevant visual; each material figure annotated with its source/proxy.

---

## 9. Non-functional requirements

- **Performance:** interactive recompute < 300 ms on prototype data; < 2 s on production aggregates for common queries.
- **Security & compliance:** all patient data de-identified (HIPAA Safe Harbor / Expert Determination); encryption in transit and at rest; full audit logging; data-use-agreement constraints enforced; SOC 2 alignment.
- **Reliability:** monthly data-refresh pipeline with versioning; outputs tied to a refresh version.
- **Scalability:** support multiple concurrent studies/indications and users.
- **Accessibility:** WCAG 2.1 AA.
- **Observability:** logging, metrics, error tracking.

---

## 10. Suggested technical approach (for the build team / AI platform)

### 10.1 Stack (suggested, not mandatory)
- **Frontend:** React + Next.js (TypeScript). Charts: Recharts or visx/D3. Maps: Mapbox GL / deck.gl (or Leaflet for prototype). State: a shared scenario store (Zustand or Redux Toolkit) to drive the cascade model.
- **Backend:** API layer in Python (FastAPI) or Node; a compute/query service over a cloud data warehouse (Snowflake / BigQuery / Databricks) for production data.
- **Conversational layer:** an LLM with function/tool calling into the query service; a semantic layer / data dictionary; retrieval over methodology and proxy documentation; guardrails to prevent fabricated numbers and PII exposure.
- **Data/ETL:** warehouse holding the RWD extract + reference data; monthly refresh; an ontology/crosswalk service.
- **Auth:** SSO/SAML + RBAC.

### 10.2 Notes for AI build platforms (Lovable / Bolt / v0 / Replit)
- Build **Phase 0 only** first: all six module screens + the assistant panel, fully interactive, on **synthetic in-browser data** (no external data calls). Do not attempt to connect to real RWD/Komodo or call external MCP/API endpoints in the prototype.
- Implement the cascade model client-side: a single scenario state object; module views are pure functions of that state; changing a control mutates state and re-renders.
- The assistant in the prototype can be a constrained query interface over the mock dataset (and/or a stubbed LLM) that demonstrates query + audit behavior.
- Prioritize Module 02 (feasibility funnel) as the flagship interactive demo.

### 10.3 Mock data schemas (for the prototype)

```json
// Criterion (Module 02)
{ "id": "inc_current_mde", "type": "inclusion", "label": "Current depressive episode",
  "enabled": true, "isProxy": true, "proxyNote": "Approximated from claim recency + treatment change",
  "param": { "name": "lookbackDays", "value": 90, "min": 30, "max": 365 },
  "appliesReductionPct": 61 }

// EligibilityFunnelResult (derived, recomputed)
{ "totalUniverse": 1200000, "steps": [
  { "criterionId": "dx_bipolar1", "remaining": 1200000, "pct": 100 },
  { "criterionId": "inc_current_mde", "remaining": 468000, "pct": 39 }
], "eligiblePool": 88000, "biggestConstraintId": "inc_current_mde" }

// Site (Module 01)
{ "id": "site_012", "name": "Sunrise Clinical Research", "lat": 28.5, "lng": -81.4,
  "region": "Southeast", "eligiblePatients": 184, "piExperienceTrials": 7,
  "indicationRxVolume": 320, "competingTrials": 2,
  "demographics": { "blackPct": 18, "hispanicPct": 22 }, "score": 0.87 }

// EnrollmentScenario (Module 03)
{ "id": "base", "numSites": 30, "screenFailRate": 0.28, "perSiteRatePerMonth": 1.4,
  "competingDrag": 0.1, "curve": [{ "month": "2026-06", "cumulative": 0 }],
  "lpiDate": "2027-04", "targetDate": "2027-03", "onTrack": false }

// KOL (Module 04)
{ "id": "kol_45", "name": "Dr. A. Rivera", "region": "Midwest",
  "signals": { "patientVolume": 0.8, "referralCentrality": 0.6, "publications": 0.9,
    "congress": 0.7, "trialLeadership": 0.85, "digitalReach": 0.4, "risingStar": 0.9 },
  "segment": "rising_star", "score": 0.82, "linkedSiteIds": ["site_012"] }

// IndicationOpportunity (Module 06)
{ "id": "bipolar1_depression", "label": "Bipolar I depression",
  "diagnosed": 1200000, "treated": 640000, "trialEligible": 88000,
  "competingTrialDensity": 0.6, "feasibilityScore": 0.72 }
```

---

## 11. Build phases

- **Phase 0 — Interactive prototype:** all six module screens + assistant panel, synthetic data, full client-side cascade interactivity. Goal: demo-able product, Module 02 as centerpiece.
- **Phase 1 — MVP (real data):** wire Modules 02, 01, 03 to real RWD + reference data; assistant over those modules; auth; export; audit trail.
- **Phase 2:** Modules 04 and 05; alerts/notifications; CTMS/EDC integration for actuals; fuller assistant.
- **Phase 3:** Module 06; advanced diversity optimization; multi-country data; API/CTMS write-back; advanced scenario management.

---

## 12. Out of scope (v1) and future
- Commercialization/marketing CI (separate product).
- Patient-identifiable data and direct patient recruitment.
- Automated regulatory submissions.
- Ex-US patient-journey data (Phase 3+ where licensed).

---

## 13. Assumptions and open questions

**Assumptions**
- Real-world patient data is US-only at launch; geographic resolution for patients is ZIP3/region.
- Enrollment actuals arrive via integration or manual upload in Phase 2.
- The sponsor provides protocols for NLP extraction.

**Open questions (to resolve before Phase 1)**
- Which warehouse and which RWD contract/fields are licensed for use?
- Benchmark source for historical enrollment/screen-fail rates?
- Required compliance certifications for the target customers (SOC 2, HIPAA attestation scope)?
- Which CTMS/EDC systems must be integrated first?
- Approved LLM provider and data-handling constraints for the assistant?
