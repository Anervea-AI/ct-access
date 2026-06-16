# AlfaDev Platform — Design & Build Spec (Phase 0)

**Date:** 2026-06-15
**Source PRD:** `AlfaDev_Requirements_v1.md`
**Design system:** `DESIGN_SYSTEM.md` + `design-tokens.json`
**Status:** Approved — building.

---

## Decisions (locked)

| Decision | Choice |
|---|---|
| Build scope | Full platform, **staged** — all six module screens + assistant on synthetic data. Module 02 (feasibility funnel) built deepest first. |
| LLM provider | **OpenAI** via LangChain (`langchain-openai`), key from `.env`. |
| Data & cascade | **Hybrid** — Python backend owns the canonical synthetic dataset + semantic layer/assistant tools and ships the dataset to the client; React runs the cascade client-side for <300ms; assistant computes server-side with the same definitions. |
| Auth | **None** (single implied user). Optional non-auth "view as role" selector only if trivial. |

## Stack

- **Frontend:** Vite + React + TypeScript SPA. Charts: Recharts. Map: `d3-geo` + `us-atlas` (offline, no API key). KOL graph: `react-force-graph-2d`. State: Zustand. Styling: Tailwind v4 `@theme` from `design-tokens.json`. Fonts: Fraunces (display) + Inter (body).
- **Backend:** FastAPI + Uvicorn, Pydantic, LangChain + `langchain-openai`.

## Repo layout (monorepo at `CT-Access/`)

```
backend/   FastAPI — synthetic data generator, semantic layer,
           authoritative compute formulas, LangChain (OpenAI) assistant
frontend/  Vite+React+TS — design system, app shell, Zustand scenario
           store, TS compute mirror, six module screens, assistant dock
shared/    Canonical JSON contracts: dataset + scenario schema, golden fixtures
docs/superpowers/specs/   design docs
```

## Cascade & hybrid parity model (the crux)

1. On load, frontend fetches `GET /api/dataset` — a deterministic, seeded synthetic bundle (criteria, sites, KOLs, indications, benchmarks for a neuropsychiatric program: bipolar I depression + adjunctive MDD) → hydrates Zustand.
2. Input change → Zustand scenario update → TS compute selectors recompute locally → re-render (<300ms, no network).
3. Cascade: scenario is one shared object. Module 02 criterion change → `eligiblePool` → Module 01 ranking + Module 03 forecast selectors recompute.
4. Assistant: chat posts `message + current scenario` to `POST /api/chat`. LangChain OpenAI agent calls tool functions wrapping the authoritative Python compute over the same dataset + scenario; returns text + viz spec + audit payload (definition, filters, open/closed source, proxy + params). "How did you get this?" expands the audit.
5. **Parity discipline:** formulas are simple deterministic reductions, mirrored in TS + Python. Golden-fixture parity test in `shared/` asserts identical results. Keystone guard against UI/assistant divergence.

## Backend components

- `data/generator.py` — seeded synthetic RWD matching PRD mock schemas (Criterion, Site, EnrollmentScenario, KOL, IndicationOpportunity).
- `semantic/dictionary.py` — business term → field/definition/code-set. `semantic/proxies.py` — psychiatry proxy layer (severity, current-episode, suicidality, SUD) with definition + adjustable strictness + confidence note.
- `compute/` — authoritative formulas: funnel, sites, forecast, kol, monitoring, population.
- `assistant/` — LangChain OpenAI agent; tools wrap compute + semantic layer; `audit.py` builds "reveal the work" payloads; guardrails (tool-only numbers, refuse PII/out-of-scope, flag low-confidence proxies).
- API: `/api/dataset`, `/api/compute/*`, `/api/chat`, `/api/export/pdf`, `/api/health`.

## Frontend components

- Design system: Tailwind theme from tokens + primitives (Button, Card, KPI/stat, Badge/Pill, Table, Input/Select, Sidebar, ChatBubble, DropZone) per design-system §8.
- App shell: left sidebar nav (six modules + assistant), warm top bar, scenario selector (create/name/save/duplicate/compare A/B), dockable assistant panel + full-screen.
- `state/` Zustand scenario store + cascade selectors; `compute/` TS formula mirror; `lib/` API client + export (CSV/PNG client; PDF via backend).

## Module 02 — Feasibility (centerpiece, built first & deepest)

Live horizontal eligibility funnel (per-step counts + %), auto-flagged biggest constraint, A/B scenario compare (eligible-pool + site-count deltas), geographic sensitivity (regions unlocked when a criterion relaxes), proxy-transparency panel (definition + strictness slider + confidence note). I/E criteria as toggles; numeric criteria as sliders; protocol A/B selector. Assistant wiring + audit-ready export.

## Other modules (built on the same patterns)

- **01 Sites & PI** (MVP): ranked leaderboard, choropleth + point map, diversity layer, shortlist + compare, export rationale. Consumes eligible pool from 02; feeds site list to 03/05.
- **03 Enrollment forecast** (MVP): curve simulator + confidence band, LPI markers, base/optimistic/conservative overlays, milestone vs target, per-site allocation table. Consumes 01 + 02.
- **04 KOL mapping** (P2): force-directed influence graph, multi-signal scoring with weight sliders, segment toggle (established/rising/DOL), KOL profile panel.
- **05 In-flight monitoring** (P2): actual-vs-forecast dashboard, risk flags + predicted shortfall, root-cause drill-down, rescue finder what-if. Consumes 03 + 01.
- **06 Population sizing** (P3): indication comparison board, diagnosed→treated→eligible funnels, cohort builder, prioritization matrix. Seeds a cohort into 02.

## Cross-cutting (Phase 0)

- Export: CSV/PNG everywhere; PDF audit summary (Module 02 first).
- Accessibility: WCAG 2.1 AA structure (keyboard nav, chart aria labels) baked in, not exhaustively audited.
- Theming: light warm-editorial fully built; dark scaffolded as a token swap.
- Testing: TDD with golden fixtures shared between pytest (backend) + vitest (frontend); parity test is the keystone.

## Staged implementation plan

1. **Foundation** — repo scaffold, backend (FastAPI, dataset generator, semantic layer, compute, API), shared contracts + golden fixtures, frontend (Vite, Tailwind theme, design-system primitives, app shell, Zustand store, TS compute mirror, API client). Runnable end-to-end.
2. **Module 02** — full feasibility module + assistant wiring + export.
3. **Modules 01 + 03** — sites/map + forecast (MVP set).
4. **Modules 04 + 05 + 06** — KOL, monitoring, population.

Each stage reuses the foundation. Parallelizable leaf work (independent module screens) is fanned out only after the shared primitives + contracts are stable.
