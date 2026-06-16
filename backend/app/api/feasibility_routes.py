"""AI-assisted criterion builder for the Feasibility module.

A user types a free-text eligibility criterion (e.g. "female of age 40 or more")
and picks inclusion/exclusion; we parse it into a structured, data-backed
``Criterion`` that drops straight into the eligibility funnel.

Design follows the standard NL→structured-filter playbook (schema-aware parsing
+ post-validation against the real schema + recompute every number from data,
never trust the model for figures):

  • The "schema" is built from what the warehouse ACTUALLY carries — patient
    distributions by age, sex, payer channel, race/ethnicity, US region/state
    (patient_geo) and named insurance plan (patient_plan). It is discovered at
    request time, so the prompt is never hardcoded to a fixed field list.
  • If the text maps to those fields, we compute the implied reduction from the
    real distributions and return a working criterion.
  • If it needs data we don't have (e.g. "mother of 2+ children" → parity), we
    return available=False with a message telling the user to add that data.

When OPENAI_API_KEY is set, ChatGPT (settings.openai_model, default "gpt-5.2")
does the extraction against the discovered schema; the deterministic parser is
the always-on fallback so the feature works with the stubbed LLM too. The model
never produces a number or invents a field/value — we recompute and re-validate.
"""
from __future__ import annotations

import hashlib
import json
import re
from functools import lru_cache
from typing import Literal, Optional

import pandas as pd
from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.core.config import get_settings
from app.data import db
from app.data.geo import region_for_state
from app.data.store import get_dataset
from app.models.schemas import Criterion, CriterionType, Distributions, ParamSpec

router = APIRouter(prefix="/api/feasibility")

REGIONS = ["Northeast", "Southeast", "Midwest", "Southwest", "West"]


# --------------------------------------------------------------------------- #
# request / response
# --------------------------------------------------------------------------- #


class ParseCriterionRequest(BaseModel):
    text: str
    type: CriterionType  # "inclusion" | "exclusion"


class ParsedClause(BaseModel):
    field: str        # age | sex | payer | race | region | state | plan
    label: str        # human label, e.g. "Age ≥ 40"
    matchFrac: float   # fraction of the universe that matches this clause


class ParseCriterionResponse(BaseModel):
    available: bool
    criterion: Optional[Criterion] = None
    explanation: str = ""
    clauses: list[ParsedClause] = []
    missingData: Optional[str] = None
    usedLlm: bool = False


# ---- agentic plan models (add / modify / enable / disable over the set) ---- #

OpType = Literal["add", "modify", "enable", "disable"]
# only runtime-safe fields may be edited (per funnel.py / funnel.ts):
FieldName = Literal["enabled", "paramValue", "baseReductionPct", "label", "type"]


class FieldChange(BaseModel):
    field: FieldName
    oldValue: float | str | bool | None = None   # backend-filled from the criterion
    newValue: float | str | bool | None = None   # backend-computed (never the LLM)


class CriterionAction(BaseModel):
    op: OpType
    targetId: Optional[str] = None               # required for modify/enable/disable
    reason: str = ""                             # one-line rationale for the diff
    criterion: Optional[Criterion] = None        # populated for op == "add"
    changes: list[FieldChange] = Field(default_factory=list)  # for op == "modify"
    clauses: list[ParsedClause] = Field(default_factory=list)  # backing the action


class PlanCriteriaResponse(BaseModel):
    available: bool
    actions: list[CriterionAction] = Field(default_factory=list)
    explanation: str = ""
    missingData: Optional[str] = None
    usedLlm: bool = False


class CurrentCriterion(BaseModel):
    """Slim projection of a scenario criterion the frontend sends for planning."""
    id: str
    type: CriterionType
    label: str
    enabled: bool = True
    category: str = "general"
    baseReductionPct: float = 0
    dataSource: Optional[str] = None
    param: Optional[ParamSpec] = None


class PlanCriteriaRequest(BaseModel):
    text: str
    type: CriterionType                          # default direction for NEW criteria
    criteria: list[CurrentCriterion] = Field(default_factory=list)


# --------------------------------------------------------------------------- #
# schema discovery  (read straight from the warehouse, like map_routes)
# --------------------------------------------------------------------------- #


@lru_cache(maxsize=1)
def _geo_distributions() -> tuple[dict[str, float], dict[str, float]]:
    """(region_frac, state_frac) from patient_geo, or ({}, {}) if unavailable."""
    if not db.db_exists():
        return {}, {}
    try:
        geo = pd.read_sql("SELECT state, patient_count FROM patient_geo WHERE state IS NOT NULL", db.ENGINE)
    except Exception:
        return {}, {}
    tot = float(geo["patient_count"].sum()) or 1.0
    state_frac: dict[str, float] = {}
    region_acc: dict[str, float] = {}
    for st, pc in geo.groupby("state")["patient_count"].sum().items():
        frac = float(pc) / tot
        state_frac[str(st).upper()] = frac
        region_acc[region_for_state(str(st))] = region_acc.get(region_for_state(str(st)), 0.0) + frac
    region_frac = {r: region_acc[r] for r in REGIONS if r in region_acc}
    return region_frac, state_frac


@lru_cache(maxsize=1)
def _plan_distributions() -> dict[str, float]:
    """planName(upper) -> fraction from patient_plan, or {} if unavailable."""
    if not db.db_exists():
        return {}
    try:
        plan = pd.read_sql("SELECT payer_name, patient_count FROM patient_plan", db.ENGINE)
    except Exception:
        return {}
    tot = float(plan["patient_count"].sum()) or 1.0
    return {str(r.payer_name).upper(): float(r.patient_count) / tot for r in plan.itertuples()}


# --------------------------------------------------------------------------- #
# distribution math  (every number comes from real data)
# --------------------------------------------------------------------------- #


def _age_frac(dist: Distributions, lo: int, hi: int) -> float:
    hist = dist.ageHistogram or []
    total = sum(b.count for b in hist) or 1
    inc = 0.0
    for b in hist:
        blo, bhi = b.lo, b.hi + 1
        span = bhi - blo
        if span <= 0:
            continue
        overlap = min(bhi, hi + 1) - max(blo, lo)
        if overlap > 0:
            inc += (overlap / span) * b.count
    return max(0.0, min(1.0, inc / total))


def _payer_label(key: str) -> str:
    """Title-case payer keys but keep short acronyms (VA) upper-case."""
    return key if len(key) <= 3 else key.title()


def _plan_match(value: str, plan: dict[str, float]) -> Optional[tuple[str, float]]:
    """Match a plan phrase to one or more plan rows (aggregating e.g. all BCBS)."""
    v = value.upper().strip()
    if not v or not plan:
        return None
    if v in plan:
        return value.title(), min(1.0, plan[v])
    hits = [(k, f) for k, f in plan.items() if v in k]
    if not hits:
        return None
    frac = min(1.0, sum(f for _, f in hits))
    label = value.title() if len(hits) > 1 else hits[0][0].title()
    return label, frac


# --------------------------------------------------------------------------- #
# schema-aware deterministic parser
# --------------------------------------------------------------------------- #

# Concepts we KNOW we cannot satisfy → friendly name for the "add this data" note.
UNAVAILABLE_CONCEPTS: list[tuple[str, str]] = [
    (r"\b(children|child|kids?|parity|gravida|para\b|offspring)\b", "number of children / parity"),
    (r"\bmother of\b|\bfather of\b|\bparent of\b", "number of children / parity"),
    (r"\b(disease|comorbidit|diagnos|condition|illness|disorder history)\b", "diagnosis / comorbidity history"),
    (r"\bbmi\b|\bbody mass\b|\bobes", "BMI / body-mass index"),
    (r"\bweight\b|\bkg\b|\blbs?\b", "body weight"),
    (r"\bheight\b", "height"),
    (r"\bsmok|\btobacco\b|\bnicotine\b", "smoking / tobacco use"),
    (r"\bdiabet|\bhba1c\b|\ba1c\b|\bglucose\b", "diabetes / HbA1c"),
    (r"\b(creatinine|egfr|gfr|renal function)\b", "renal labs (eGFR / creatinine)"),
    (r"\bblood pressure\b|\bhypertens|\bsystolic\b|\bdiastolic\b", "blood pressure"),
    (r"\bincome\b|\bsalary\b|\bsocioeconomic\b", "income / socioeconomic status"),
    (r"\b(employ|occupation|unemploy)\b", "employment status"),
    (r"\beducation\b|\bdegree\b", "education level"),
    (r"\b(marital|married|divorced|widowed)\b", "marital status"),
    (r"\b(prior therapy|treatment naive|treatment-naive|line of therapy)\b", "treatment / therapy history"),
    (r"\bgenotype\b|\bmutation\b|\bbiomarker\b|\bhla\b", "genomic / biomarker data"),
]

SEX_TERMS = {
    "F": [r"\bfemale[s]?\b", r"\bwom[ae]n\b", r"\bgirls?\b"],
    "M": [r"\bmale[s]?\b", r"\bmen\b", r"\bman\b", r"\bboys?\b"],
}
SEX_LABEL = {"F": "Female", "M": "Male", "U": "Unknown sex"}

# payer phrase -> distribution-key candidates (keep whichever exists in the data)
PAYER_TERMS: list[tuple[str, list[str]]] = [
    (r"\bmedicaid\b", ["MEDICAID"]),
    (r"\bmedicare\b", ["MEDICARE"]),
    (r"\b(commercial|private|employer)\b", ["COMMERCIAL"]),
    (r"\b(va|veterans? affairs|veterans?)\b", ["VA"]),
    (r"\b(workers?\s*comp\w*|workman)\b", ["WORKERS COMPENSATION", "WORKERS COMP"]),
    (r"\b(cash|self[\s-]?pay|uninsured|out[\s-]?of[\s-]?pocket)\b", ["CASH", "OTHER"]),
]
RACE_TERMS: list[tuple[str, str]] = [
    (r"\b(black|african[\s-]?american)\b", "black"),
    (r"\b(hispanic|latino|latina|latinx)\b", "hispanic"),
    (r"\b(white|caucasian)\b", "white"),
    (r"\basian\b", "asian"),
]
# common plan phrases -> canonical substring to match against patient_plan keys
PLAN_TERMS: list[tuple[str, str]] = [
    (r"\bunited\s?health\w*\b", "UNITEDHEALTHCARE"),
    (r"\bhumana\b", "HUMANA"),
    (r"\bcigna\b", "CIGNA"),
    (r"\baetna\b", "AETNA"),
    (r"\banthem\b", "ANTHEM"),
    (r"\bmolina\b", "MOLINA"),
    (r"\bwellpoint\b|\bamerigroup\b", "WELLPOINT"),
    (r"\b(blue\s?cross|blue\s?shield|bcbs)\b", "BLUE CROSS"),
    (r"\bmedicare\s?ffs\b", "MEDICARE FFS"),
]


def _parse_age(t: str) -> Optional[tuple[int, int]]:
    """Return (lo, hi) age bounds, or None. hi=120 means open-ended upper bound."""
    has_age_ctx = any(k in t for k in ("age", "aged", "year", "yr", "yo", "old", "between"))
    m = re.search(r"(?:between\s+)?(\d{1,3})\s*(?:-|–|to|and)\s*(\d{1,3})", t)
    if m and has_age_ctx and "older" not in m.group(0) and "above" not in m.group(0):
        lo, hi = int(m.group(1)), int(m.group(2))
        return (min(lo, hi), max(lo, hi))
    m = re.search(r"(\d{1,3})\s*\+", t) or re.search(
        r"(\d{1,3})\s*(?:years?|yrs?|yo)?\s*(?:or\s*(?:more|older|above|over)|and\s*(?:older|above|over|up)|plus)", t)
    if m:
        return (int(m.group(1)), 120)
    m = re.search(r"(?:older than|over|above|at least|greater than|>=?|≥|minimum age(?: of)?|min age)\s*(\d{1,3})", t)
    if m:
        return (int(m.group(1)), 120)
    m = re.search(r"(?:younger than|under|below|at most|less than|<=?|≤|up to|maximum age(?: of)?|max age)\s*(\d{1,3})", t)
    if m:
        return (0, int(m.group(1)))
    # bare "age 40" / "aged 40" / "age of 40" / "40 years old" — no comparator.
    # Treated as an UPPER bound (max age N) so it maps onto the existing max-age
    # slider; an explicit lower bound needs "or more / older / N+".
    m = re.search(r"\bage(?:d|\s+of)?\s*(\d{1,3})\b", t) or re.search(r"\b(\d{1,3})\s*(?:years?\s*old|yo)\b", t)
    if m:
        return (0, int(m.group(1)))
    return None


def _extract_clauses(text: str, dist: Distributions) -> tuple[list[ParsedClause], Optional[str]]:
    """Return (clauses, missing). If `missing` is set, the criterion is unsatisfiable."""
    t = " " + text.lower().strip() + " "
    region_frac, state_frac = _geo_distributions()
    plan = _plan_distributions()

    # 1) hard stop: an explicitly-unavailable concept anywhere in the text
    for pat, friendly in UNAVAILABLE_CONCEPTS:
        if re.search(pat, t):
            return [], friendly

    clauses: list[ParsedClause] = []

    # 2) sex
    for code, pats in SEX_TERMS.items():
        if any(re.search(p, t) for p in pats):
            frac = float(dist.genderSplit.get(code, 0.0))
            if frac > 0:
                clauses.append(ParsedClause(field="sex", label=SEX_LABEL[code], matchFrac=frac))
            break

    # 3) age
    age = _parse_age(t)
    if age:
        lo, hi = age
        label = f"Age ≥ {lo}" if hi >= 120 else f"Age ≤ {hi}" if lo <= 0 else f"Age {lo}–{hi}"
        clauses.append(ParsedClause(field="age", label=label, matchFrac=_age_frac(dist, lo, hi)))

    # 4) payer channel
    for pat, keys in PAYER_TERMS:
        if re.search(pat, t):
            key = next((k for k in keys if k in dist.payerMix), None)
            if key:
                clauses.append(ParsedClause(field="payer", label=_payer_label(key), matchFrac=float(dist.payerMix[key])))
            break

    # 5) race / ethnicity
    for pat, key in RACE_TERMS:
        if re.search(pat, t) and key in dist.geoDemographics:
            clauses.append(ParsedClause(field="race", label=key.title(), matchFrac=float(dist.geoDemographics[key])))
            break

    # 6) US region
    if region_frac:
        reg = next((r for r in REGIONS if r.lower() in t), None) or ("Southeast" if "south east" in t else None)
        if reg and reg in region_frac:
            clauses.append(ParsedClause(field="region", label=f"{reg} region", matchFrac=region_frac[reg]))

    # 7) US state (explicit "in XX" / "state XX" to avoid matching stray 2-letter words)
    if state_frac:
        m = re.search(r"\b(?:in|state|from|within)\s+([A-Za-z]{2})\b", text)
        if m and m.group(1).upper() in state_frac:
            st = m.group(1).upper()
            clauses.append(ParsedClause(field="state", label=f"State {st}", matchFrac=state_frac[st]))

    # 8) named insurance plan
    if plan:
        for pat, canonical in PLAN_TERMS:
            if re.search(pat, t):
                hit = _plan_match(canonical, plan)
                if hit:
                    clauses.append(ParsedClause(field="plan", label=hit[0], matchFrac=hit[1]))
                break

    if not clauses:
        return [], None  # nothing matched, but no known-unavailable concept either
    return clauses, None


# --------------------------------------------------------------------------- #
# primary LLM extractor (OpenAI gpt-5.2) — schema discovered from the data
# --------------------------------------------------------------------------- #


def _build_system_prompt(dist: Distributions) -> str:
    region_frac, state_frac = _geo_distributions()
    plan = _plan_distributions()
    payers = ", ".join(sorted(k.lower() for k in dist.payerMix if k.lower() != "unknown")) or "medicaid, medicare, commercial"
    races = ", ".join(k for k in dist.geoDemographics if k != "unknown") or "white, black, hispanic, asian"

    fields = [
        '- "age": numeric years; use ageLo / ageHi (inclusive). Open-ended upper bound = 120, lower bound = 0.',
        '- "sex": value "female" or "male".',
        f'- "payer": value one of [{payers}].',
        f'- "race": value one of [{races}].',
    ]
    if region_frac:
        fields.append(f'- "region": value one of [{", ".join(region_frac)}].')
    if state_frac:
        fields.append('- "state": US 2-letter state code (e.g. CA, TX, FL).')
    if plan:
        top = sorted(plan.items(), key=lambda kv: kv[1], reverse=True)[:6]
        examples = ", ".join(k.title() for k, _ in top)
        fields.append(f'- "plan": named insurance plan, e.g. {examples}.')

    return (
        "You extract a clinical-trial eligibility criterion into structured filters over ONLY "
        "these available patient-data fields:\n"
        + "\n".join(fields)
        + "\n\nReturn STRICT JSON only, no prose:\n"
        '{"clauses":[{"field":"...","value":"<for sex/payer/race/region/state/plan>",'
        '"ageLo":<int|null>,"ageHi":<int|null>}],'
        '"unavailable":"<short name of any data concept NOT in the field list, else empty>"}\n\n'
        "If ANY part of the criterion needs data outside the fields above (e.g. number of children, "
        "BMI, lab values, smoking, diagnosis/comorbidity, prior therapy), set \"unavailable\" to a "
        "short name of that data and return an empty \"clauses\" list."
    )


def _llm_extract(text: str, dist: Distributions) -> Optional[tuple[list[ParsedClause], Optional[str]]]:
    """ChatGPT structured extraction, validated against the discovered schema.

    Returns (clauses, missing) — `missing` set means unsatisfiable. Returns None
    if the LLM is disabled or the call/parse fails (so the caller falls back)."""
    settings = get_settings()
    if not settings.llm_enabled:
        return None
    region_frac, state_frac = _geo_distributions()
    plan = _plan_distributions()
    try:
        from langchain_core.messages import HumanMessage, SystemMessage
        from langchain_openai import ChatOpenAI

        kwargs: dict = {"model": settings.openai_model, "api_key": settings.openai_api_key,
                        "timeout": 30, "max_retries": 1}
        if settings.is_reasoning_model:
            if settings.openai_reasoning_effort:
                kwargs["reasoning_effort"] = settings.openai_reasoning_effort
        else:
            kwargs["temperature"] = 0
        llm = ChatOpenAI(**kwargs)
        out = llm.invoke([SystemMessage(content=_build_system_prompt(dist)), HumanMessage(content=text)])
        raw = (out.content if isinstance(out.content, str) else str(out.content)).strip()
        raw = raw.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        obj = json.loads(raw)

        missing = str(obj.get("unavailable", "") or "").strip()
        if missing:
            return [], missing

        clauses: list[ParsedClause] = []
        for cl in obj.get("clauses", []):
            field = str(cl.get("field", "")).lower().strip()
            value = str(cl.get("value", "") or "").strip()
            if field == "age":
                lo = int(cl.get("ageLo") or 0)
                hi = int(cl.get("ageHi") or 120)
                lo, hi = max(0, min(lo, hi)), max(lo, hi)
                label = f"Age ≥ {lo}" if hi >= 120 else f"Age ≤ {hi}" if lo <= 0 else f"Age {lo}–{hi}"
                clauses.append(ParsedClause(field="age", label=label, matchFrac=_age_frac(dist, lo, hi)))
            elif field == "sex":
                code = "F" if value.lower().startswith("f") else "M" if value.lower().startswith("m") else None
                frac = float(dist.genderSplit.get(code, 0.0)) if code else 0.0
                if not code or frac <= 0:
                    return [], f"sex: {value}"
                clauses.append(ParsedClause(field="sex", label=SEX_LABEL[code], matchFrac=frac))
            elif field == "payer":
                key = next((k for k in dist.payerMix if k.lower() == value.lower()), None)
                if not key:
                    return [], f"payer channel: {value}"
                clauses.append(ParsedClause(field="payer", label=_payer_label(key), matchFrac=float(dist.payerMix[key])))
            elif field == "race":
                key = value.lower()
                if key not in dist.geoDemographics:
                    return [], f"race/ethnicity: {value}"
                clauses.append(ParsedClause(field="race", label=key.title(), matchFrac=float(dist.geoDemographics[key])))
            elif field == "region":
                reg = next((r for r in region_frac if r.lower() == value.lower()), None)
                if not reg:
                    return [], f"region: {value}"
                clauses.append(ParsedClause(field="region", label=f"{reg} region", matchFrac=region_frac[reg]))
            elif field == "state":
                st = value.upper()
                if st not in state_frac:
                    return [], f"state: {value}"
                clauses.append(ParsedClause(field="state", label=f"State {st}", matchFrac=state_frac[st]))
            elif field == "plan":
                hit = _plan_match(value, plan)
                if not hit:
                    return [], f"insurance plan: {value}"
                clauses.append(ParsedClause(field="plan", label=hit[0], matchFrac=hit[1]))
            else:
                return [], f"unsupported field: {field or value or 'unknown'}"
        return clauses, None
    except Exception:
        return None


# --------------------------------------------------------------------------- #
# endpoint
# --------------------------------------------------------------------------- #


def _clamp_round(pct: float) -> float:
    return round(max(0.5, min(97.0, pct)), 1)


def _available_fields_human(dist: Distributions) -> str:
    region_frac, state_frac = _geo_distributions()
    plan = _plan_distributions()
    parts = ["age", "sex", "payer channel", "race/ethnicity"]
    if region_frac or state_frac:
        parts.append("US region/state")
    if plan:
        parts.append("insurance plan")
    return ", ".join(parts)


# --------------------------------------------------------------------------- #
# agentic planner: add new criteria AND/OR modify existing ones
# --------------------------------------------------------------------------- #


def _ai_fields(data_source: Optional[str]) -> list[str]:
    """Fields encoded in an AI criterion's dataSource suffix ('AI · sex, age')."""
    if data_source and data_source.startswith("AI · "):
        return [f.strip() for f in data_source[len("AI · "):].split(",") if f.strip()]
    return []


def _find_age_criterion(current: list[CurrentCriterion]) -> Optional[CurrentCriterion]:
    for c in current:
        if (c.id == "inc_age" or c.dataSource == "age_histogram"
                or (c.param and c.param.name == "maxAge") or "age" in _ai_fields(c.dataSource)):
            return c
    return None


def _find_ai_field_criterion(current: list[CurrentCriterion], field: str) -> Optional[CurrentCriterion]:
    """An AI criterion that already covers exactly one given field (sex/payer/…)."""
    for c in current:
        if c.category == "ai-generated" and _ai_fields(c.dataSource) == [field]:
            return c
    return None


def _reduction_for(clauses: list[ParsedClause], ctype: str) -> float:
    match = 1.0
    for c in clauses:
        match *= c.matchFrac
    removed = (1.0 - match) if ctype == "inclusion" else match
    return _clamp_round(removed * 100)


def _build_add_criterion(clauses: list[ParsedClause], ctype: str) -> Criterion:
    label = ", ".join(c.label for c in clauses)
    fields = ", ".join(dict.fromkeys(c.field for c in clauses))
    cid = "ai_" + ctype[:3] + "_" + hashlib.md5(f"{ctype}:{label}".encode()).hexdigest()[:6]
    return Criterion(
        id=cid, type=ctype, label=label, category="ai-generated",
        enabled=True, isProxy=False, codes=[],
        baseReductionPct=_reduction_for(clauses, ctype), param=None, paramSlope=0,
        dataSource=f"AI · {fields}",
    )


def _clause_from_spec(field: str, value: str, age_lo, age_hi,
                      dist: Distributions) -> tuple[Optional[ParsedClause], Optional[str]]:
    """Resolve one (field,value) spec into a data-backed clause, or a 'missing' name."""
    region_frac, state_frac = _geo_distributions()
    plan = _plan_distributions()
    field = (field or "").lower().strip()
    value = (value or "").strip()
    if field == "age":
        try:
            lo = int(age_lo or 0)
            hi = int(age_hi if age_hi is not None else 120)
        except (ValueError, TypeError):
            return None, "age (non-numeric bound)"
        lo, hi = max(0, min(lo, hi)), max(lo, hi)
        label = f"Age ≥ {lo}" if hi >= 120 else f"Age ≤ {hi}" if lo <= 0 else f"Age {lo}–{hi}"
        return ParsedClause(field="age", label=label, matchFrac=_age_frac(dist, lo, hi)), None
    if field == "sex":
        code = "F" if value.lower().startswith("f") else "M" if value.lower().startswith("m") else None
        frac = float(dist.genderSplit.get(code, 0.0)) if code else 0.0
        if not code or frac <= 0:
            return None, f"sex: {value}"
        return ParsedClause(field="sex", label=SEX_LABEL[code], matchFrac=frac), None
    if field == "payer":
        key = next((k for k in dist.payerMix if k.lower() == value.lower()), None)
        if not key:
            return None, f"payer channel: {value}"
        return ParsedClause(field="payer", label=_payer_label(key), matchFrac=float(dist.payerMix[key])), None
    if field == "race":
        if value.lower() not in dist.geoDemographics:
            return None, f"race/ethnicity: {value}"
        return ParsedClause(field="race", label=value.lower().title(),
                            matchFrac=float(dist.geoDemographics[value.lower()])), None
    if field == "region":
        reg = next((r for r in region_frac if r.lower() == value.lower()), None)
        if not reg:
            return None, f"region: {value}"
        return ParsedClause(field="region", label=f"{reg} region", matchFrac=region_frac[reg]), None
    if field == "state":
        st = value.upper()
        if st not in state_frac:
            return None, f"state: {value}"
        return ParsedClause(field="state", label=f"State {st}", matchFrac=state_frac[st]), None
    if field == "plan":
        hit = _plan_match(value, plan)
        if not hit:
            return None, f"insurance plan: {value}"
        return ParsedClause(field="plan", label=hit[0], matchFrac=hit[1]), None
    return None, f"unsupported field: {field or value or 'unknown'}"


def _modify_field_action(target: CurrentCriterion, clause: ParsedClause) -> CriterionAction:
    """Replace an existing single-field AI criterion's clause (recomputing reduction)."""
    new_red = _reduction_for([clause], target.type)
    changes = [FieldChange(field="baseReductionPct", oldValue=target.baseReductionPct, newValue=new_red)]
    if target.label != clause.label:
        changes.append(FieldChange(field="label", oldValue=target.label, newValue=clause.label))
    return CriterionAction(
        op="modify", targetId=target.id, changes=changes, clauses=[clause],
        reason=f"Updated the existing {clause.field} criterion to “{clause.label}”.",
    )


def _plan_from_clauses(clauses: list[ParsedClause], ctype: str, current: list[CurrentCriterion],
                       text: str, dist: Distributions) -> list[CriterionAction]:
    """Block → match → decide: turn resolved clauses into add/modify actions."""
    actions: list[CriterionAction] = []
    unmatched: list[ParsedClause] = []
    tl = " " + text.lower().strip() + " "
    for cl in clauses:
        if cl.field == "age":
            lo, hi = _parse_age(tl) or (0, 120)
            age_crit = _find_age_criterion(current)
            if hi < 120 and age_crit and age_crit.param:
                old = age_crit.param.value
                actions.append(CriterionAction(
                    op="modify", targetId=age_crit.id, clauses=[cl],
                    changes=[FieldChange(field="paramValue", oldValue=old, newValue=float(hi))],
                    reason=f"Set the existing age criterion’s max age to {hi} (was {int(round(float(old)))}).",
                ))
                if lo > 0:  # a range also carries a lower bound → add it as a new criterion
                    unmatched.append(ParsedClause(field="age", label=f"Age ≥ {lo}", matchFrac=_age_frac(dist, lo, 120)))
            else:
                unmatched.append(cl)  # pure lower bound, or no age criterion to modify → add
        else:
            same = _find_ai_field_criterion(current, cl.field)
            if same:
                actions.append(_modify_field_action(same, cl))
            else:
                unmatched.append(cl)
    if unmatched:
        crit = _build_add_criterion(unmatched, ctype)
        actions.append(CriterionAction(
            op="add", criterion=crit, clauses=unmatched,
            reason=f"Added a new {ctype} criterion: {crit.label} (removes {crit.baseReductionPct}% of the remaining pool).",
        ))
    return actions


def _plan_actions(text: str, ctype: str, current: list[CurrentCriterion],
                  dist: Distributions) -> tuple[bool, list[CriterionAction], Optional[str]]:
    """Deterministic planner (always available). Returns (available, actions, missing)."""
    clauses, missing = _extract_clauses(text, dist)
    if missing:
        return False, [], missing
    if not clauses:
        return False, [], None
    actions = _plan_from_clauses(clauses, ctype, current, text, dist)
    return (len(actions) > 0), actions, None


def _build_plan_prompt(dist: Distributions, current: list[CurrentCriterion]) -> str:
    region_frac, state_frac = _geo_distributions()
    plan = _plan_distributions()
    payers = ", ".join(sorted(k.lower() for k in dist.payerMix if k.lower() != "unknown")) or "medicaid, medicare, commercial"
    races = ", ".join(k for k in dist.geoDemographics if k != "unknown") or "white, black, hispanic, asian"
    fields = ["age (years; ageLo/ageHi)", "sex (female/male)", f"payer ({payers})", f"race ({races})"]
    if region_frac:
        fields.append(f"region ({', '.join(region_frac)})")
    if state_frac:
        fields.append("state (2-letter code)")
    if plan:
        fields.append("plan (named insurance plan)")
    lines = []
    for c in current:
        extra = f", maxAge={int(c.param.value)}" if (c.param and c.param.name == "maxAge") else ""
        lines.append(f'  - id="{c.id}", type={c.type}, enabled={str(c.enabled).lower()}, label="{c.label}"{extra}')
    crit_block = "\n".join(lines) or "  (none)"
    return (
        "You EDIT a clinical-trial eligibility criteria set. Available patient-data fields (ONLY these):\n"
        + "; ".join(fields)
        + "\n\nCURRENT criteria (target existing ones by id — never invent an id):\n" + crit_block
        + "\n\nReturn STRICT JSON only:\n"
        '{"explanation":"<one sentence>","unavailable":"<data concept not in the fields, else empty>","actions":[ ... ]}\n'
        "Each action is one of:\n"
        '  {"op":"modify","targetId":"<id>","intent":"set_max_age","ageHi":<int>,"reason":"..."}\n'
        '  {"op":"modify","targetId":"<id>","intent":"replace_clause","field":"<field>","value":"<v>","reason":"..."}\n'
        '  {"op":"add","type":"inclusion|exclusion","clauses":[{"field":"...","value":"...","ageLo":<int|null>,"ageHi":<int|null>}],"reason":"..."}\n'
        '  {"op":"enable"|"disable","targetId":"<id>","reason":"..."}\n'
        "RULES:\n"
        "- If a field already has a criterion the user restates, MODIFY it; never ADD a duplicate.\n"
        "- 'age N' / 'age at most N' / 'younger than N' → modify the existing age criterion (set_max_age, ageHi=N).\n"
        "- 'age N or more' / 'N+' / 'older than N' → ADD a new criterion (the age criterion models only an upper bound).\n"
        "- Never output any percentage/number for reductions — the backend computes all numbers.\n"
        '- If ANY part needs data outside the fields above, set "unavailable" and return an empty actions list.'
    )


def _llm_plan(text: str, ctype: str, current: list[CurrentCriterion],
              dist: Distributions) -> Optional[tuple[bool, list[CriterionAction], Optional[str]]]:
    """ChatGPT action-plan generation, fully re-validated. None → caller falls back."""
    settings = get_settings()
    if not settings.llm_enabled:
        return None
    ids = {c.id: c for c in current}
    try:
        from langchain_core.messages import HumanMessage, SystemMessage
        from langchain_openai import ChatOpenAI

        kwargs: dict = {"model": settings.openai_model, "api_key": settings.openai_api_key,
                        "timeout": 30, "max_retries": 1}
        if settings.is_reasoning_model:
            if settings.openai_reasoning_effort:
                kwargs["reasoning_effort"] = settings.openai_reasoning_effort
        else:
            kwargs["temperature"] = 0
        llm = ChatOpenAI(**kwargs)
        out = llm.invoke([SystemMessage(content=_build_plan_prompt(dist, current)), HumanMessage(content=text)])
        raw = (out.content if isinstance(out.content, str) else str(out.content)).strip()
        raw = raw.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        obj = json.loads(raw)

        missing = str(obj.get("unavailable", "") or "").strip()
        if missing:
            return False, [], missing

        actions: list[CriterionAction] = []
        for a in obj.get("actions", []):
            op = str(a.get("op", "")).lower().strip()
            tid = a.get("targetId")
            if op in ("enable", "disable"):
                if tid not in ids:
                    return None
                actions.append(CriterionAction(op=op, targetId=tid,
                                               reason=a.get("reason") or f"{op.title()} criterion."))
            elif op == "modify":
                if tid not in ids:
                    return None
                target = ids[tid]
                intent = str(a.get("intent", "")).lower()
                if intent == "set_max_age":
                    if not (target.param and target.param.name == "maxAge") or a.get("ageHi") is None:
                        return None
                    try:
                        hi = int(a["ageHi"])
                    except (ValueError, TypeError):
                        return None
                    actions.append(CriterionAction(
                        op="modify", targetId=tid,
                        changes=[FieldChange(field="paramValue", oldValue=target.param.value, newValue=float(hi))],
                        clauses=[ParsedClause(field="age", label=f"Age ≤ {hi}", matchFrac=_age_frac(dist, 0, hi))],
                        reason=a.get("reason") or f"Set max age to {hi}."))
                elif intent == "replace_clause":
                    clause, miss = _clause_from_spec(a.get("field", ""), a.get("value", ""),
                                                     a.get("ageLo"), a.get("ageHi"), dist)
                    if miss or clause is None:
                        return None
                    actions.append(_modify_field_action(target, clause))
                else:
                    return None
            elif op == "add":
                resolved: list[ParsedClause] = []
                for sc in a.get("clauses", []):
                    clause, miss = _clause_from_spec(sc.get("field", ""), sc.get("value", ""),
                                                     sc.get("ageLo"), sc.get("ageHi"), dist)
                    if miss or clause is None:
                        return None
                    resolved.append(clause)
                if not resolved:
                    return None
                add_type = str(a.get("type", ctype)).lower()
                if add_type not in ("inclusion", "exclusion"):
                    add_type = ctype
                crit = _build_add_criterion(resolved, add_type)
                actions.append(CriterionAction(op="add", criterion=crit, clauses=resolved,
                                               reason=a.get("reason") or f"Added {crit.label}."))
            else:
                return None
        return (len(actions) > 0), actions, None
    except Exception:
        return None


@router.post("/plan-criteria", response_model=PlanCriteriaResponse)
def plan_criteria(req: PlanCriteriaRequest) -> PlanCriteriaResponse:
    ds = get_dataset()
    dist = ds.distributions or Distributions()
    text = req.text.strip()
    fields_human = _available_fields_human(dist)

    # Primary: ChatGPT action plan (when a key is set). Fallback: deterministic planner.
    used_llm = False
    res = _llm_plan(text, req.type, req.criteria, dist)
    if res is not None:
        used_llm = True
        available, actions, missing = res
        if not actions and not missing:  # odd/empty LLM output → deterministic backstop
            available, actions, missing = _plan_actions(text, req.type, req.criteria, dist)
    else:
        available, actions, missing = _plan_actions(text, req.type, req.criteria, dist)

    if missing:
        return PlanCriteriaResponse(
            available=False, missingData=missing, usedLlm=used_llm,
            explanation=(f"Data not available: {missing}. The current dataset only covers "
                         f"{fields_human}. Please add the {missing} data to the database to use this criterion."))
    if not actions:
        return PlanCriteriaResponse(
            available=False, missingData="unrecognised criterion", usedLlm=used_llm,
            explanation=(f"Couldn't map “{text}” to any available data field. Available fields are "
                         f"{fields_human} — please rephrase, or add the required data to the database."))

    n_add = sum(1 for a in actions if a.op == "add")
    n_edit = sum(1 for a in actions if a.op in ("modify", "enable", "disable"))
    bits = []
    if n_edit:
        bits.append(f"adjust {n_edit} existing criteri{'on' if n_edit == 1 else 'a'}")
    if n_add:
        bits.append(f"add {n_add} new criteri{'on' if n_add == 1 else 'a'}")
    explanation = "Proposed plan — " + " and ".join(bits) + ". Review the changes below, then apply."
    return PlanCriteriaResponse(available=True, actions=actions, explanation=explanation, usedLlm=used_llm)


@router.post("/parse-criterion", response_model=ParseCriterionResponse)
def parse_criterion(req: ParseCriterionRequest) -> ParseCriterionResponse:
    ds = get_dataset()
    dist = ds.distributions or Distributions()
    text = req.text.strip()
    fields_human = _available_fields_human(dist)

    # Primary path: ChatGPT structured extraction (when a key is set).
    # Fallback: deterministic schema-aware parser (always available).
    used_llm = False
    llm = _llm_extract(text, dist)
    if llm is not None:
        used_llm = True
        clauses, missing = llm
        if not clauses and not missing:  # empty/odd LLM output → deterministic backstop
            clauses, missing = _extract_clauses(text, dist)
    else:
        clauses, missing = _extract_clauses(text, dist)

    if missing:
        return ParseCriterionResponse(
            available=False, missingData=missing, usedLlm=used_llm,
            explanation=(
                f"Data not available: {missing}. The current dataset only covers "
                f"{fields_human}. Please add the {missing} data to the database to use "
                f"this criterion."
            ),
        )
    if not clauses:
        return ParseCriterionResponse(
            available=False, missingData="unrecognised criterion", usedLlm=used_llm,
            explanation=(
                f"Couldn't map “{text}” to any available data field. Available fields are "
                f"{fields_human} — please rephrase, or add the required data to the database."
            ),
        )

    # combine clauses assuming independence
    match = 1.0
    for c in clauses:
        match *= c.matchFrac
    if req.type == "inclusion":
        removed = 1.0 - match           # keep matchers, drop the rest
        kept_desc = f"keeps {match * 100:.1f}% of the universe"
    else:
        removed = match                  # drop the matchers
        kept_desc = f"removes the {match * 100:.1f}% who match"
    reduction = _clamp_round(removed * 100)

    label = ", ".join(c.label for c in clauses)
    fields = ", ".join(dict.fromkeys(c.field for c in clauses))  # unique, ordered
    cid = "ai_" + req.type[:3] + "_" + hashlib.md5(f"{req.type}:{label}".encode()).hexdigest()[:6]

    criterion = Criterion(
        id=cid, type=req.type, label=label, category="ai-generated",
        enabled=True, isProxy=False, codes=[],
        baseReductionPct=reduction, param=None, paramSlope=0,
        dataSource=f"AI · {fields}",
    )
    explanation = (
        f"Mapped to {fields} → {label}. As a{'n' if req.type[0] in 'aeiou' else ''} "
        f"{req.type} criterion it {kept_desc}, i.e. removes {reduction:.1f}% of the "
        f"remaining pool. Toggle it like any other criterion; the funnel recomputes live."
    )
    return ParseCriterionResponse(
        available=True, criterion=criterion, clauses=clauses,
        explanation=explanation, usedLlm=used_llm,
    )
