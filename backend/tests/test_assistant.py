"""Assistant fallback (no-LLM) behavior: grounded, returns viz + audit, never empty numbers."""
from __future__ import annotations

import pytest

from app.assistant import agent as agent_mod
from app.assistant.agent import answer


@pytest.fixture(autouse=True)
def _force_fallback(monkeypatch):
    """These tests cover the deterministic (no-LLM) router — force it regardless of
    any OPENAI_API_KEY in the dev environment so they stay hermetic and fast."""
    class _Stub:
        llm_enabled = False
    monkeypatch.setattr(agent_mod, "get_settings", lambda: _Stub())


def test_funnel_query(dataset, base_scenario):
    r = answer(dataset, base_scenario, "What is my eligible pool and biggest constraint?")
    assert r["usedLlm"] is False
    assert r["toolCalls"] == ["eligibility_funnel"]
    assert r["viz"]["type"] == "funnel"
    assert any(a.get("term") == "Eligible pool" for a in r["audit"])


def test_washout_whatif_query(dataset, base_scenario):
    r = answer(dataset, base_scenario, "What happens if I extend the antipsychotic washout to four weeks?")
    assert r["toolCalls"] == ["criterion_impact"]
    vals = {d["label"]: d["value"] for d in r["viz"]["data"]}
    assert vals["After"] < vals["Before"]  # longer washout -> smaller pool


def test_proxy_query_surfaces_proxy(dataset, base_scenario):
    r = answer(dataset, base_scenario, "What proxy are you using for severity?")
    assert r["toolCalls"] == ["explain_proxy"]
    assert any("proxy" in a for a in r["audit"])


def test_sites_query_returns_table(dataset, base_scenario):
    r = answer(dataset, base_scenario, "Show me sites in the Southeast with high Black representation")
    assert r["toolCalls"] == ["rank_sites"]
    assert r["viz"]["type"] == "table"


def test_forecast_query(dataset, base_scenario):
    r = answer(dataset, base_scenario, "Show the forecast if screen fail rises to 35%")
    assert r["toolCalls"] == ["forecast_enrollment"]
    assert r["viz"]["type"] == "line"


def test_region_exclude_whatif(dataset, base_scenario):
    r = answer(dataset, base_scenario, "what if I don't recruit in the West?")
    assert r["toolCalls"] == ["region_impact"]
    assert r["viz"]["type"] == "bar"
    assert "West" in r["text"] and "retain" in r["text"].lower()


def test_region_focus_whatif(dataset, base_scenario):
    r = answer(dataset, base_scenario, "what if we only run in the Southeast?")
    assert r["toolCalls"] == ["region_impact"]
    assert "Southeast" in r["text"]
