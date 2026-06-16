# AlfaDev — Clinical-Trial Feasibility Platform (Phase 0)

An AI-native clinical-trial feasibility & operations workspace built from
[`AlfaDev_Requirements_v1.md`](./AlfaDev_Requirements_v1.md) on the Anervea
warm-editorial design system ([`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md)).

Phase 0: all six module screens + a platform-wide conversational assistant, fully
interactive on a **real, de-identified RWD** dataset (SQLite-backed) with a
synthetic generator kept as a fallback. Not for clinical use.

> **Reference program:** Bipolar I depression (US).

## What's inside

| Module | What it answers |
|---|---|
| 01 · Site & PI | Where to run, who runs it — ranked sites (26 real ILLUMINATE1 sites), US map, diversity fit, **untapped high-volume PIs**, **geographic whitespace** map layer |
| **02 · Feasibility** (centerpiece) | Is the protocol recruitable? Live eligibility funnel, biggest constraint, A/B, geo sensitivity, psychiatry proxy transparency |
| 03 · Enrollment forecast | How fast will it enroll? Curve simulator, LPI, sites-needed |
| 04 · KOL mapping | Influential physicians — real referral network (networkx PageRank/centrality), RWD signal-weighted scoring |
| 05 · Monitoring & rescue | Actual vs forecast, risk flags, rescue what-if, **competing-trial saturation** |
| 06 · Population sizing | Indication prioritization board + matrix |

Two product principles run throughout:

1. **Everything is a live object.** Every number/chart recomputes from inputs you
   change. Inputs cascade across modules through one shared **scenario** state
   (a relaxed criterion in 02 updates the eligible pool → re-ranks sites in 01 →
   shifts the forecast in 03).
2. **One assistant spans the platform.** It answers with charts/tables and can
   *reveal the work* — definition, data source (open/closed claims), and the
   **proxy + parameters** behind any modeled psychiatric figure. It never invents
   numbers (tool-calling over a semantic layer; OpenAI via LangChain, with a
   grounded deterministic fallback when no API key is set).

## Architecture (hybrid)

- **Backend** (`backend/`, FastAPI + Python): owns the deterministic seeded
  synthetic dataset, the semantic layer / data dictionary, the **authoritative
  compute formulas**, and the LangChain (OpenAI) assistant.
- **Frontend** (`frontend/`, Vite + React + TS): runs a **TypeScript mirror** of
  the compute formulas client-side for <300 ms interactivity (Zustand scenario
  store), and renders the warm-editorial UI.
- **Parity** (`shared/`): a golden fixture asserts the TS mirror and the Python
  backend produce *identical* numbers — the guard against UI/assistant divergence.

```
backend/   FastAPI · data generator · semantic+proxy layer · compute · assistant
frontend/  Vite+React+TS · design system · scenario store · compute mirror · 6 modules · assistant
shared/    dataset.json + golden parity fixtures (used by both test suites)
```

## Run it

Two terminals. **Python 3.13 + [uv](https://github.com/astral-sh/uv); Node 20+.**

### 1) Backend

```bash
cd backend
uv venv .venv
# install (already done if you ran the build):
VIRTUAL_ENV=.venv uv pip install -r requirements.txt
# optional: enable the OpenAI-backed assistant
cp .env.example .env        # then set OPENAI_API_KEY=...  (works without it too)
./.venv/Scripts/python.exe -m uvicorn app.main:app --reload --port 8000
```

Backend at http://localhost:8000 (`/docs` for OpenAPI). Without an `OPENAI_API_KEY`
the assistant uses a deterministic, grounded tool-routing fallback.

#### Real RWD database (SQLite)

The app is backed by a **real RWD dataset** (HCP/HCO decile files, referral network,
clinical-trial history, patient-count breakdowns, and the real ILLUMINATE1 site
locations) loaded into a SQLite warehouse. Build it once:

```bash
cd backend && PYTHONPATH=. ./.venv/Scripts/python.exe -m app.data.etl
```

This writes `backend/app/data/alfadev.db` (gitignored) and prints row-count
assertions + a data-quality report (cleaned ZIPs, normalized states, HCP→HCO
fuzzy-match rate). `DATA_SOURCE` (in `.env`) selects the source:

- `auto` (default) — use the DB if `alfadev.db` exists, else the synthetic generator
- `db` — force the real RWD builder · `synthetic` — force the seeded generator

Where the RWD genuinely lacks a field (clinical I/E proxies, screen-fail/enrollment
benchmarks, publications/congress/digital KOL signals) the app stays **hybrid and
honest** — real numbers where they exist, clearly-labeled proxies/assumptions where
they don't.

### 2) Frontend

```bash
cd frontend
npm install
npm run dev
```

App at http://localhost:5173. (Set `VITE_API_BASE` in `frontend/.env` if the
backend isn't on `localhost:8000`.)

## Tests

```bash
# backend formulas + golden regression + assistant fallback
cd backend && PYTHONPATH=. ./.venv/Scripts/python.exe -m pytest -q

# client/server parity (TS mirror == Python backend, golden fixture)
cd frontend && npm test
```

Regenerate the shared dataset + golden fixtures after changing any formula:

```bash
cd backend && PYTHONPATH=. ./.venv/Scripts/python.exe scripts/dump_shared.py
```

## Notes / scope

- Synthetic data only; geography uses real US city coordinates for realism.
- Auth is intentionally omitted in Phase 0 (single implied user).
- Light warm-editorial theme is fully built; dark mode is scaffolded via tokens.
- See [`docs/superpowers/specs/2026-06-15-alfadev-platform-design.md`](./docs/superpowers/specs/2026-06-15-alfadev-platform-design.md) for the design spec.
