"""Conversational assistant: LangChain + OpenAI tool-calling, with a deterministic
fallback router so the platform is fully demoable without an API key (PRD §10.2
explicitly allows a stubbed LLM).
"""
from __future__ import annotations

import json
import re
from typing import Any

from app.assistant.tools import TOOL_IMPL, AssistantContext, build_structured_tools
from app.core.config import Settings, get_settings
from app.models.inputs import ScenarioState
from app.models.schemas import Dataset

SYSTEM_PROMPT = """You are AlfaDev's clinical-trial feasibility assistant.

RULES (non-negotiable):
- You MUST obtain every number by calling a tool. NEVER invent or estimate figures.
- All tools compute over the user's CURRENT scenario; do not assume default values.
- For any modeled psychiatric criterion (severity, current episode, substance use,
  suicidality), state that it is a proxy and call explain_proxy to surface the
  approach, parameters, and confidence.
- Refuse anything requiring patient-identifiable data; all data is de-identified and
  aggregated. Flag low-confidence answers.
- Cite the data source/proxy for material claims (the tools return this in 'audit').
- Be concise and conversational: answer the user's ACTUAL question in a short paragraph,
  then let the tool's visual carry the detail.
- For what-if questions, call the matching tool and explain the before→after in plain
  language: geographic what-ifs (don't recruit in / only run in a region) -> region_impact;
  parameter/criterion changes -> criterion_impact; enrollment changes -> forecast_enrollment.
- Be AGENTIC: decompose multi-part questions and call AS MANY tools as needed (in one turn
  or across turns), then synthesize ONE coherent answer from all the results. Examples:
  "if I drop the West, how does enrollment change?" -> region_impact AND forecast_enrollment;
  "rank sites and tell me who the top KOLs there are" -> rank_sites AND rank_kols. Don't stop
  at the first tool if the question has more parts.
- Format the answer in clean Markdown (bold for key figures, bullet lists, tables when
  comparing); use LaTeX ($...$) only for actual formulas.

REGIONS: Northeast, Southeast, Midwest, Southwest, West.
"""

MAX_TOOL_ROUNDS = 6


def _aggregate(tool_results: list[dict]) -> tuple[list[dict], list[dict]]:
    """Collect EVERY tool's viz (deduped by type+title, capped) and all audit blocks,
    so a multi-tool answer can show multiple charts/tables."""
    vizzes: list[dict] = []
    seen: set = set()
    audit: list[dict] = []
    for r in tool_results:
        v = r.get("viz")
        if v:
            key = (v.get("type"), str(v.get("title", "")))
            if key not in seen:
                seen.add(key)
                vizzes.append(v)
        for a in r.get("audit", []):
            if a:
                audit.append(a)
    return vizzes[:3], audit


# --------------------------------------------------------------------------- #
# LLM path
# --------------------------------------------------------------------------- #


def _make_llm(settings: Settings):
    """Build the chat model. GPT-5 / o-series reasoning models take reasoning_effort
    and reject `temperature`, so we omit it for them (see LangChain issue #35423)."""
    from langchain_openai import ChatOpenAI

    kwargs: dict[str, Any] = {
        "model": settings.openai_model,
        "api_key": settings.openai_api_key,
        "timeout": 60,
        "max_retries": 2,
    }
    if settings.is_reasoning_model:
        if settings.openai_reasoning_effort:
            kwargs["reasoning_effort"] = settings.openai_reasoning_effort
    else:
        kwargs["temperature"] = 0
    return ChatOpenAI(**kwargs)


def _run_llm(ctx: AssistantContext, message: str, history: list[dict]) -> dict:
    from langchain_core.messages import (
        AIMessage, HumanMessage, SystemMessage, ToolMessage,
    )

    settings = get_settings()
    tools = build_structured_tools(ctx)
    tool_map = {t.name: t for t in tools}
    llm = _make_llm(settings).bind_tools(tools)

    messages: list[Any] = [SystemMessage(content=SYSTEM_PROMPT)]
    for h in history[-6:]:
        if h.get("role") == "user":
            messages.append(HumanMessage(content=h.get("content", "")))
        elif h.get("role") == "assistant":
            messages.append(AIMessage(content=h.get("content", "")))
    messages.append(HumanMessage(content=message))

    tool_results: list[dict] = []
    tool_names: list[str] = []
    final_text = ""
    for _ in range(MAX_TOOL_ROUNDS):
        ai = llm.invoke(messages)
        messages.append(ai)
        if not ai.tool_calls:
            final_text = ai.content if isinstance(ai.content, str) else str(ai.content)
            break
        for call in ai.tool_calls:
            name = call["name"]
            args = call.get("args", {}) or {}
            tool_names.append(name)
            tool = tool_map.get(name)
            # StructuredTool validates args against the Pydantic schema, then runs
            # the same authoritative compute the UI uses and returns text/data/viz/audit.
            result = tool.invoke(args) if tool is not None else {
                "text": "Unknown tool.", "data": {}, "viz": None, "audit": [],
            }
            tool_results.append(result)
            messages.append(ToolMessage(
                content=json.dumps({"text": result["text"], "data": result.get("data", {})}, default=str),
                tool_call_id=call["id"],
            ))
    else:
        # ran out of rounds; summarize from last tool result
        final_text = tool_results[-1]["text"] if tool_results else "I wasn't able to complete that."

    vizzes, audit = _aggregate(tool_results)
    return {"text": final_text, "viz": (vizzes[0] if vizzes else None), "vizzes": vizzes,
            "audit": audit, "toolCalls": tool_names, "usedLlm": True}


# --------------------------------------------------------------------------- #
# Deterministic fallback router (no API key)
# --------------------------------------------------------------------------- #

REGIONS = ["Northeast", "Southeast", "Midwest", "Southwest", "West"]
REGIONS_ABBR = {
    "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA", "HI", "ID", "IL",
    "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE",
    "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD",
    "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
}


def _find_region(text: str) -> str | None:
    for r in REGIONS:
        if r.lower() in text:
            return r
    if "south east" in text:
        return "Southeast"
    return None


WORD_NUMS = {
    "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7,
    "eight": 8, "nine": 9, "ten": 10, "eleven": 11, "twelve": 12,
}


def _find_int(pattern: str, text: str) -> float | None:
    m = re.search(pattern, text)
    return float(m.group(1)) if m else None


def _find_qty(unit: str, text: str) -> float | None:
    """Find a quantity before a unit, accepting digits or words ('four weeks')."""
    m = re.search(r"(\d+)\s*" + unit, text)
    if m:
        return float(m.group(1))
    words = "|".join(WORD_NUMS)
    m = re.search(r"(" + words + r")\s*" + unit, text)
    return float(WORD_NUMS[m.group(1)]) if m else None


def _run_fallback(ctx: AssistantContext, message: str) -> dict:
    t = message.lower()
    region = _find_region(t)

    def wrap(result: dict, names: list[str]) -> dict:
        vizzes, audit = _aggregate([result])
        return {"text": result["text"], "viz": (vizzes[0] if vizzes else None), "vizzes": vizzes,
                "audit": audit, "toolCalls": names, "usedLlm": False}

    # geographic what-if: exclude a region ("don't recruit in the West") or focus on one
    # ("only run in the Southeast"). Checked early so it isn't swallowed by the funnel default.
    if region:
        if any(k in t for k in ["don't recruit", "dont recruit", "do not recruit", "not recruit", "stop recruit",
                                "exclude", "without", "drop ", "remove ", "skip ", "avoid ", "leave out",
                                "no site", "not in the", "outside", "pull out"]):
            return wrap(TOOL_IMPL["region_impact"](ctx, {"region": region, "mode": "exclude"}), ["region_impact"])
        if any(k in t for k in ["only", "focus", "concentrate", "solely", "exclusively", "restrict",
                                "limit to", "exclusive", "just the", "just in", "just run"]):
            return wrap(TOOL_IMPL["region_impact"](ctx, {"region": region, "mode": "focus"}), ["region_impact"])

    # explicit eligible-pool / funnel question -> funnel (reports pool AND biggest constraint)
    if any(k in t for k in ["eligible pool", "recruitable", "funnel", "how many patients", "eligible patients"]) \
            and "site" not in t:
        return wrap(TOOL_IMPL["eligibility_funnel"](ctx, {}), ["eligibility_funnel"])

    # proxy / explain
    if any(k in t for k in ["proxy", "how did you get", "what proxy", "methodology", "how do you"]):
        if "severity" in t or "madrs" in t:
            return wrap(TOOL_IMPL["explain_proxy"](ctx, {"criterionId": "inc_severity"}), ["explain_proxy"])
        if "substance" in t:
            return wrap(TOOL_IMPL["explain_proxy"](ctx, {"criterionId": "exc_substance"}), ["explain_proxy"])
        if "suicid" in t:
            return wrap(TOOL_IMPL["explain_proxy"](ctx, {"criterionId": "exc_suicidality"}), ["explain_proxy"])
        if "episode" in t or "current" in t:
            return wrap(TOOL_IMPL["explain_proxy"](ctx, {"criterionId": "inc_current_mde"}), ["explain_proxy"])
        return wrap(TOOL_IMPL["eligibility_funnel"](ctx, {}), ["eligibility_funnel"])

    # washout what-if
    if "washout" in t:
        weeks = _find_qty("week", t)
        days = _find_qty("day", t)
        val = (weeks * 7) if weeks else days
        return wrap(TOOL_IMPL["criterion_impact"](ctx, {"criterionId": "exc_antipsychotic_washout", "paramValue": val}),
                    ["criterion_impact"])

    # screen-fail what-if / forecast
    if "screen" in t and "fail" in t:
        pct = _find_int(r"(\d+(?:\.\d+)?)\s*%", t)
        return wrap(TOOL_IMPL["forecast_enrollment"](ctx, {"screenFailRate": pct / 100 if pct else None}),
                    ["forecast_enrollment"])
    if any(k in t for k in ["forecast", "enroll", "last patient", "lpi", "how fast", "how many sites"]):
        td = None
        m = re.search(r"(20\d{2})[-/ ]?(\d{1,2})?", t)
        # detect "march 2027" style
        months = {"january": 1, "february": 2, "march": 3, "april": 4, "may": 5, "june": 6,
                  "july": 7, "august": 8, "september": 9, "october": 10, "november": 11, "december": 12}
        mon = next((months[k] for k in months if k in t), None)
        yr = re.search(r"(20\d{2})", t)
        if mon and yr:
            td = f"{yr.group(1)}-{mon:02d}"
        return wrap(TOOL_IMPL["forecast_enrollment"](ctx, {"targetDate": td}), ["forecast_enrollment"])

    # untapped PIs (high-volume providers with no trial history)
    if any(k in t for k in ["untapped", "never run", "no trial", "new pi", "net-new", "new investigator"]):
        state = None
        m = re.search(r"\b([A-Z]{2})\b", message)
        if m and m.group(1) in REGIONS_ABBR:
            state = m.group(1)
        return wrap(TOOL_IMPL["untapped_pis"](ctx, {"region": region, "state": state}), ["untapped_pis"])

    # competing-trial saturation
    if any(k in t for k in ["saturat", "competing", "over-committed", "overcommitted", "too many trials", "crowded"]):
        dim = "condition" if "condition" in t or "indication" in t else "state"
        return wrap(TOOL_IMPL["trial_saturation"](ctx, {"dimension": dim}), ["trial_saturation"])

    # referral-network influence ("which HCP has the most referrals / is most connected")
    if any(k in t for k in ["refer", "pagerank", "network", "most connected", "central", "hub"]) \
            or (any(h in t for h in ["hcp", "physician", "provider", "doctor", "prescriber"])
                and any(k in t for k in ["most", "top", "best", "influen", "connect", "rank"])):
        return wrap(TOOL_IMPL["referral_centrality"](ctx, {"region": region}), ["referral_centrality"])

    # whitespace / coverage gap
    if any(k in t for k in ["whitespace", "white space", "no site", "uncovered", "coverage gap", "expansion"]):
        return wrap(TOOL_IMPL["rank_sites"](ctx, {"region": region}), ["rank_sites"])

    # KOL
    if any(k in t for k in ["kol", "opinion leader", "investigator", "rising star", "dol", "influenc"]):
        seg = None
        if "rising" in t:
            seg = "rising_star"
        elif "digital" in t or "dol" in t:
            seg = "dol"
        elif "established" in t:
            seg = "established"
        return wrap(TOOL_IMPL["rank_kols"](ctx, {"segment": seg, "region": region}), ["rank_kols"])

    # population / indication
    if any(k in t for k in ["indication", "population", "addressable", "prioriti", "portfolio"]):
        return wrap(TOOL_IMPL["population_sizing"](ctx, {}), ["population_sizing"])

    # sites
    if any(k in t for k in ["site", "where", "rank", "catchment", "diversity", "black", "hispanic"]):
        targets: dict[str, float] = {}
        if "black" in t:
            targets["blackPct"] = 15
        if "hispanic" in t:
            targets["hispanicPct"] = 20
        min_elig = _find_int(r"(\d+)\+?\s*eligible", t)
        return wrap(TOOL_IMPL["rank_sites"](ctx, {
            "region": region, "diversityTargets": targets or None,
            "minEligible": int(min_elig) if min_elig else None,
        }), ["rank_sites"])

    # criterion impact (which exclusion costs the most)
    if any(k in t for k in ["constraint", "costs me", "biggest", "which criterion", "most patients"]):
        return wrap(TOOL_IMPL["criterion_impact"](ctx, {}), ["criterion_impact"])

    # default: funnel
    return wrap(TOOL_IMPL["eligibility_funnel"](ctx, {}), ["eligibility_funnel"])


# --------------------------------------------------------------------------- #
# Entry point
# --------------------------------------------------------------------------- #


def _llm_error_hint(exc: Exception) -> str:
    """Turn an OpenAI/LangChain failure into a short, actionable reason for the user."""
    s = str(exc).lower()
    if ("not found" in s or "does not exist" in s or "404" in s) and "model" in s:
        return "the configured OPENAI_MODEL wasn't found — verify it (e.g. gpt-5.2) in backend/.env"
    if "401" in s or "invalid api key" in s or "incorrect api key" in s or "authentication" in s:
        return "the OpenAI API key was rejected — check OPENAI_API_KEY"
    if "429" in s or "rate limit" in s or "quota" in s:
        return "OpenAI rate limit / quota hit — try again shortly"
    if "timeout" in s or "timed out" in s or "connection" in s:
        return "the OpenAI call timed out / couldn't connect"
    return "the OpenAI call failed"


def answer(dataset: Dataset, scenario: ScenarioState, message: str, history: list[dict] | None = None) -> dict:
    ctx = AssistantContext(dataset=dataset, scenario=scenario)
    settings = get_settings()
    history = history or []
    if settings.llm_enabled:
        try:
            return _run_llm(ctx, message, history)
        except Exception as exc:  # pragma: no cover - network/credential failure
            fb = _run_fallback(ctx, message)
            hint = _llm_error_hint(exc)
            # Grounded answer is still correct; the note tells the user how to re-enable the LLM.
            fb["text"] = f"(Answered with the grounded engine — {hint}.) {fb['text']}"
            fb["error"] = str(exc)
            return fb
    return _run_fallback(ctx, message)
