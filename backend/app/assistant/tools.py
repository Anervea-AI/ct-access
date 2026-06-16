"""Assistant tools — the ONLY way the agent produces numbers.

Each tool computes over the current scenario + dataset using the same authoritative
formulas the UI uses, and returns a structured payload: human text, a viz spec the
frontend renders, and an audit block ("reveal the work" — definition, source,
proxy + parameters). The agent never fabricates figures (PRD §6.2, §8).
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable, Literal, Optional

from langchain_core.tools import StructuredTool
from pydantic import BaseModel, Field

from app.compute import insights
from app.compute.forecast import compute_forecast
from app.compute.funnel import compute_funnel, effective_reduction_pct
from app.compute.kol import compute_kol
from app.compute.population import compute_population
from app.compute.sites import compute_sites
from app.models.inputs import ScenarioState
from app.models.schemas import Dataset
from app.semantic.dictionary import lookup
from app.semantic.proxies import get_proxy


@dataclass
class AssistantContext:
    dataset: Dataset
    scenario: ScenarioState


def _audit(term_key: str, criterion_id: str | None = None) -> dict[str, Any]:
    td = lookup(term_key)
    block: dict[str, Any] = {}
    if td:
        block = {
            "term": td.term, "definition": td.definition, "source": td.source,
            "fields": td.fields, "codeSets": td.codeSets, "notes": td.notes,
        }
    if criterion_id:
        proxy = get_proxy(criterion_id)
        if proxy:
            block["proxy"] = proxy.model_dump()
    return block


# --------------------------------------------------------------------------- #
# Tool implementations (closures get the request context)
# --------------------------------------------------------------------------- #


def tool_eligibility_funnel(ctx: AssistantContext, args: dict) -> dict:
    res = compute_funnel(ctx.scenario.criteria, ctx.dataset.totalUniverse, ctx.dataset.distributions)
    proxies_used = [c.id for c in ctx.scenario.criteria if c.enabled and c.isProxy]
    return {
        "text": (
            f"The current protocol yields an eligible pool of {res.eligiblePool:,} patients "
            f"out of a {res.totalUniverse:,} diagnosed universe. The biggest single constraint "
            f"is '{res.biggestConstraintLabel}', removing {res.biggestConstraintRemoved:,} patients."
        ),
        "data": res.model_dump(),
        "viz": {"type": "funnel", "result": res.model_dump()},
        "audit": [
            _audit("eligible_pool"),
            *([_audit("", p) for p in proxies_used]),
        ],
    }


def tool_criterion_impact(ctx: AssistantContext, args: dict) -> dict:
    cid = args.get("criterionId")
    param_value = args.get("paramValue")
    criteria = [c.model_copy(deep=True) for c in ctx.scenario.criteria]

    baseline = compute_funnel(ctx.scenario.criteria, ctx.dataset.totalUniverse, ctx.dataset.distributions)
    target = next((c for c in criteria if c.id == cid), None)
    if target is None:
        # default to current biggest constraint
        cid = baseline.biggestConstraintId
        target = next((c for c in criteria if c.id == cid), None)
    if target is None:
        return {"text": "I couldn't find that criterion.", "data": {}, "viz": None, "audit": []}

    if param_value is not None and target.param is not None:
        # what-if: change the criterion's parameter
        old = target.param.value
        target.param.value = float(param_value)
        after = compute_funnel(criteria, ctx.dataset.totalUniverse, ctx.dataset.distributions)
        delta = after.eligiblePool - baseline.eligiblePool
        red = effective_reduction_pct(target, ctx.dataset.distributions)
        direction = "gain" if delta >= 0 else "loss"
        text = (
            f"Changing '{target.label}' {target.param.name} from {old:g} to {float(param_value):g} "
            f"{target.param.unit}: it now removes {red:.1f}% of the pool. The eligible pool moves from "
            f"{baseline.eligiblePool:,} to {after.eligiblePool:,} — a {direction} of {abs(delta):,} patients."
        )
    else:
        # cost of the criterion: how many patients does keeping it cost (i.e. disabling it gains)
        target.enabled = False
        after = compute_funnel(criteria, ctx.dataset.totalUniverse, ctx.dataset.distributions)
        delta = after.eligiblePool - baseline.eligiblePool
        red = effective_reduction_pct(target, ctx.dataset.distributions)
        text = (
            f"Criterion '{target.label}' costs {delta:,} patients: it removes {red:.1f}% of the pool, so "
            f"disabling it would raise the eligible pool from {baseline.eligiblePool:,} to {after.eligiblePool:,}."
        )
    return {
        "text": text,
        "data": {
            "criterionId": target.id, "label": target.label,
            "reductionPct": red,
            "before": baseline.eligiblePool, "after": after.eligiblePool, "delta": delta,
            "isProxy": target.isProxy,
        },
        "viz": {
            "type": "bar", "title": "Eligible pool — before vs after", "valueLabel": "patients",
            "data": [
                {"label": "Before", "value": baseline.eligiblePool},
                {"label": "After", "value": after.eligiblePool},
            ],
        },
        "audit": [_audit("eligible_pool", target.id if target.isProxy else None)],
    }


def tool_rank_sites(ctx: AssistantContext, args: dict) -> dict:
    filters = ctx.scenario.siteFilters.model_copy(deep=True)
    if args.get("region"):
        filters.regions = [args["region"]]
    if args.get("minEligible") is not None:
        filters.minEligible = int(args["minEligible"])
    if args.get("diversityTargets"):
        filters.diversityTargets = args["diversityTargets"]
        filters.diversityWeight = max(filters.diversityWeight, 0.25)
    funnel = compute_funnel(ctx.scenario.criteria, ctx.dataset.totalUniverse, ctx.dataset.distributions)
    res = compute_sites(ctx.dataset.sites, funnel.eligiblePool, filters)
    top = res.sites[: int(args.get("limit", 10))]
    rows = [
        {"Rank": i + 1, "Site": s.name, "Region": s.region,
         "Eligible": s.eligiblePatients, "PI trials": s.piExperienceTrials,
         "Competing": s.competingTrials, "Score": s.score}
        for i, s in enumerate(top)
    ]
    return {
        "text": f"Top {len(top)} sites by score for the current scenario "
                f"(eligible pool {funnel.eligiblePool:,}).",
        "data": {"sites": [s.model_dump() for s in top],
                 "representativeness": res.representativeness,
                 "diseaseDistribution": res.diseaseDistribution},
        "viz": {"type": "table",
                "columns": ["Rank", "Site", "Region", "Eligible", "PI trials", "Competing", "Score"],
                "rows": rows},
        "audit": [_audit("site_score"), _audit("eligible_patients_site")],
    }


def tool_region_impact(ctx: AssistantContext, args: dict) -> dict:
    """Geographic what-if: dropping a region (exclude) or recruiting only there (focus)."""
    region = args.get("region")
    mode = (args.get("mode") or "exclude").lower()
    filters = ctx.scenario.siteFilters.model_copy(deep=True)
    filters.regions = []  # evaluate across ALL regions for a clean geographic split
    funnel = compute_funnel(ctx.scenario.criteria, ctx.dataset.totalUniverse, ctx.dataset.distributions)
    res = compute_sites(ctx.dataset.sites, funnel.eligiblePool, filters)
    in_region = [s for s in res.sites if s.region == region]
    out_region = [s for s in res.sites if s.region != region]
    elig_in = sum(s.eligiblePatients for s in in_region)
    elig_out = sum(s.eligiblePatients for s in out_region)
    total = (elig_in + elig_out) or 1

    def plural(n: int) -> str:
        return "" if n == 1 else "s"

    if mode == "focus":
        kept = in_region
        text = (
            f"Recruiting only in the {region}: {len(in_region)} site{plural(len(in_region))} covering "
            f"~{elig_in:,} of the {total:,} site-covered eligible patients ({elig_in / total * 100:.0f}%). "
            f"You'd forgo {len(out_region)} site{plural(len(out_region))} (~{elig_out:,}) in the other regions."
        )
        bars = [{"label": f"{region} (kept)", "value": elig_in}, {"label": "Other regions (forgone)", "value": elig_out}]
        kept_lbl = f"{region} only"
    else:
        kept = out_region
        text = (
            f"Not recruiting in the {region} drops {len(in_region)} site{plural(len(in_region))} and "
            f"~{elig_in:,} site-covered eligible patients ({elig_in / total * 100:.0f}% of the {total:,} total). "
            f"You'd retain {len(out_region)} site{plural(len(out_region))} across the other regions, covering ~{elig_out:,}."
        )
        bars = [{"label": "Retained", "value": elig_out}, {"label": f"Dropped ({region})", "value": elig_in}]
        kept_lbl = f"without {region}"

    rows = [
        {"Rank": i + 1, "Site": s.name, "Region": s.region, "Eligible": s.eligiblePatients,
         "PI trials": s.piExperienceTrials, "Score": s.score}
        for i, s in enumerate(kept[:10])
    ]
    return {
        "text": text,
        "data": {
            "region": region, "mode": mode,
            "eligibleInRegion": elig_in, "eligibleOtherRegions": elig_out,
            "sitesInRegion": len(in_region), "sitesOtherRegions": len(out_region),
            "keptSites": [s.model_dump() for s in kept[:10]],
        },
        "viz": {"type": "bar", "title": f"Site-covered eligible patients — {kept_lbl}",
                "valueLabel": "eligible patients", "data": bars},
        "audit": [_audit("eligible_patients_site")],
    }


def tool_forecast_enrollment(ctx: AssistantContext, args: dict) -> dict:
    inp = ctx.scenario.forecast.model_copy(deep=True)
    if args.get("screenFailRate") is not None:
        inp.screenFailRate = float(args["screenFailRate"])
    if args.get("numSites") is not None:
        inp.numSites = int(args["numSites"])
    if args.get("targetDate"):
        inp.targetDate = args["targetDate"]
    funnel = compute_funnel(ctx.scenario.criteria, ctx.dataset.totalUniverse, ctx.dataset.distributions)
    res = compute_forecast(inp, funnel.eligiblePool)
    base = next(s for s in res.scenarios if s.id == "base")
    needed = res.sitesNeededForTarget
    needed_txt = (f"To hit {inp.targetDate}, you need about {needed} sites."
                  if res.feasibleByTarget and needed else
                  f"Target {inp.targetDate} looks infeasible within 400 sites at these assumptions.")
    return {
        "text": (
            f"Base scenario projects last-patient-in around {base.lpiDate} "
            f"({'on track' if base.onTrack else 'behind target'} for {inp.targetDate}). {needed_txt}"
        ),
        "data": res.model_dump(),
        "viz": {"type": "line", "title": "Cumulative enrollment", "scenarios": [s.model_dump() for s in res.scenarios],
                "targetEnrollment": inp.targetEnrollment},
        "audit": [_audit("enrollment_curve"), _audit("screen_fail_rate")],
    }


def tool_rank_kols(ctx: AssistantContext, args: dict) -> dict:
    controls = ctx.scenario.kol.model_copy(deep=True)
    if args.get("segment"):
        controls.segment = args["segment"]
    if args.get("region"):
        controls.region = args["region"]
    res = compute_kol(ctx.dataset.kols, ctx.dataset.kolEdges, controls)
    top = res.nodes[: int(args.get("limit", 10))]
    rows = [{"Rank": i + 1, "KOL": k.name, "Segment": k.segment, "Region": k.region, "Score": k.score}
            for i, k in enumerate(top)]
    return {
        "text": f"Top {len(top)} KOLs for the current signal weights"
                + (f" (segment: {controls.segment})" if controls.segment else "") + ".",
        "data": {"kols": [k.model_dump() for k in top]},
        "viz": {"type": "table", "columns": ["Rank", "KOL", "Segment", "Region", "Score"], "rows": rows},
        "audit": [_audit("kol_score")],
    }


def tool_population_sizing(ctx: AssistantContext, args: dict) -> dict:
    res = compute_population(ctx.dataset.indications, ctx.scenario.cohort)
    rows = [{"Indication": i.label, "Diagnosed": i.diagnosed, "Treated": i.treated,
             "Trial-eligible": i.trialEligible, "Competition": i.competingTrialDensity,
             "Feasibility": i.feasibilityScore} for i in res.indications]
    return {
        "text": "Addressable population across indications for the current cohort definition.",
        "data": res.model_dump(),
        "viz": {"type": "table",
                "columns": ["Indication", "Diagnosed", "Treated", "Trial-eligible", "Competition", "Feasibility"],
                "rows": rows},
        "audit": [_audit("trial_eligible")],
    }


def tool_explain_proxy(ctx: AssistantContext, args: dict) -> dict:
    cid = args.get("criterionId", "")
    proxy = get_proxy(cid)
    if not proxy:
        crit = next((c for c in ctx.scenario.criteria if c.id == cid), None)
        if crit and not crit.isProxy:
            return {"text": f"'{crit.label}' is taken directly from coded claims — it is not a modeled proxy.",
                    "data": {}, "viz": None, "audit": [_audit("eligible_pool")]}
        return {"text": "No proxy is defined for that criterion.", "data": {}, "viz": None, "audit": []}
    return {
        "text": (f"'{proxy.criterion}' is modeled, not directly in claims. Proxy: {proxy.proxyApproach} "
                 f"Adjustable via {proxy.parameter}. Confidence: {proxy.confidence}. "
                 f"Limitation: {proxy.limitation}"),
        "data": proxy.model_dump(),
        "viz": None,
        "audit": [_audit("eligible_pool", cid)],
    }


def tool_untapped_pis(ctx: AssistantContext, args: dict) -> dict:
    rows = insights.untapped_pis(ctx.dataset, region=args.get("region"),
                                 state=args.get("state"), limit=int(args.get("limit", 10)))
    table = [{"Provider": p.name, "Specialty": p.specialty, "State": p.state,
              "Patients": p.patientCount, "Decile": p.decile, "HCO": p.hcoName or "—"} for p in rows]
    where = f" in {args['region']}" if args.get("region") else (f" in {args['state']}" if args.get("state") else "")
    return {
        "text": (f"{len(rows)} high-volume providers{where} have no clinical-trial history — net-new PI "
                 f"candidates ranked by patient volume (top: {rows[0].name} in {rows[0].state}, "
                 f"{rows[0].patientCount:,} patients)." if rows else "No untapped PIs match that filter."),
        "data": {"untappedPIs": [p.model_dump() for p in rows]},
        "viz": {"type": "table", "columns": ["Provider", "Specialty", "State", "Patients", "Decile", "HCO"], "rows": table},
        "audit": [_audit("untapped_pi")],
    }


def tool_trial_saturation(ctx: AssistantContext, args: dict) -> dict:
    dim = args.get("dimension", "state")
    rows = insights.saturation(ctx.dataset, dimension=dim, limit=int(args.get("limit", 10)))
    over = insights.over_committed_investigators(ctx.dataset)
    table = [{"Key": s.key, "Trials": s.trials, "Investigators": s.investigators,
              "Over-committed": s.overCommitted, "Density": round(s.competingDensity, 2)} for s in rows]
    return {
        "text": (f"Most-saturated {dim}s by competing-trial count (top: {rows[0].key}, {rows[0].trials} trials). "
                 f"{over} investigators are over-committed (>3 concurrent trials)." if rows
                 else "No saturation data for that dimension."),
        "data": {"saturation": [s.model_dump() for s in rows], "overCommittedInvestigators": over},
        "viz": {"type": "table", "columns": ["Key", "Trials", "Investigators", "Over-committed", "Density"], "rows": table},
        "audit": [_audit("trial_saturation")],
    }


def tool_referral_centrality(ctx: AssistantContext, args: dict) -> dict:
    controls = ctx.scenario.kol.model_copy(deep=True)
    # rank purely by real network reach + centrality
    controls.weights = {"referralReach": 0.6, "referralCentrality": 0.4}
    if args.get("region"):
        controls.region = args["region"]
    res = compute_kol(ctx.dataset.kols, ctx.dataset.kolEdges, controls)
    top = res.nodes[: int(args.get("limit", 10))]
    rows = [{"Rank": i + 1, "Provider": k.name, "Region": k.region, "NPI": k.npi,
             "Reach": round(k.signals.referralReach, 2), "Centrality": round(k.signals.referralCentrality, 2),
             "Score": k.score} for i, k in enumerate(top)]
    return {
        "text": (f"Top {len(top)} providers by real referral-network influence (PageRank reach + weighted "
                 f"centrality over the HCP referral graph)."),
        "data": {"kols": [k.model_dump() for k in top]},
        "viz": {"type": "table", "columns": ["Rank", "Provider", "Region", "NPI", "Reach", "Centrality", "Score"], "rows": rows},
        "audit": [_audit("referral_centrality")],
    }


# --------------------------------------------------------------------------- #
# Tool argument schemas (Pydantic) — the modern LangChain way: bind_tools derives
# the OpenAI function/JSON schema from these, with validation, instead of a
# hand-maintained schema dict that can drift from the implementations.
# --------------------------------------------------------------------------- #

Region = Literal["Northeast", "Southeast", "Midwest", "Southwest", "West"]


class NoArgs(BaseModel):
    """No arguments."""


class CriterionImpactArgs(BaseModel):
    criterionId: Optional[str] = Field(
        None, description="Criterion id, e.g. exc_antipsychotic_washout, inc_current_mde, inc_severity. Omit to use the current biggest constraint.")
    paramValue: Optional[float] = Field(
        None, description="New parameter value for a what-if (e.g. washout days, max age). Omit to measure the cost of keeping the criterion.")


class RankSitesArgs(BaseModel):
    region: Optional[Region] = Field(None, description="Restrict to one region.")
    minEligible: Optional[int] = Field(None, description="Minimum eligible patients per site.")
    diversityTargets: Optional[dict[str, float]] = Field(
        None, description="Representation goals, e.g. {\"blackPct\": 15, \"hispanicPct\": 20}.")
    limit: Optional[int] = Field(None, description="Max sites to return (default 10).")


class RegionImpactArgs(BaseModel):
    region: Region = Field(..., description="The region to analyze.")
    mode: Literal["exclude", "focus"] = Field(
        "exclude",
        description="'exclude' = what if we do NOT recruit there (the default for 'don't recruit in X'); "
                    "'focus' = recruit ONLY there.")


class ForecastArgs(BaseModel):
    screenFailRate: Optional[float] = Field(None, description="Fraction 0-1, e.g. 0.35.")
    numSites: Optional[int] = Field(None, description="Number of active sites.")
    targetDate: Optional[str] = Field(None, description="Target date as YYYY-MM.")


class RankKolsArgs(BaseModel):
    segment: Optional[Literal["established", "rising_star", "dol"]] = Field(None, description="KOL segment filter.")
    region: Optional[str] = Field(None, description="Region filter.")
    limit: Optional[int] = Field(None, description="Max KOLs to return (default 10).")


class ExplainProxyArgs(BaseModel):
    criterionId: str = Field(..., description="Criterion id of a modeled psychiatric proxy (e.g. inc_severity, exc_substance, exc_suicidality, inc_current_mde).")


class UntappedArgs(BaseModel):
    region: Optional[Region] = Field(None, description="Region filter.")
    state: Optional[str] = Field(None, description="2-letter state abbr, e.g. TX.")
    limit: Optional[int] = Field(None, description="Max providers to return (default 10).")


class SaturationArgs(BaseModel):
    dimension: Literal["state", "condition"] = Field("state", description="Aggregate competing-trial density by state or by condition.")
    limit: Optional[int] = Field(None, description="Max rows to return (default 10).")


class ReferralCentralityArgs(BaseModel):
    region: Optional[str] = Field(None, description="Region filter.")
    limit: Optional[int] = Field(None, description="Max providers to return (default 10).")


# name -> (description, args schema, implementation). One source of truth for both
# the LLM tool list (build_structured_tools) and the deterministic fallback (TOOL_IMPL).
TOOL_REGISTRY: list[tuple[str, str, type[BaseModel], Callable[[AssistantContext, dict], dict]]] = [
    ("eligibility_funnel",
     "Compute the eligibility funnel and eligible pool for the current protocol/scenario. Use for 'how many patients are eligible', 'recruitable population', biggest constraint.",
     NoArgs, tool_eligibility_funnel),
    ("criterion_impact",
     "Quantify how one eligibility criterion affects the pool, optionally with a what-if parameter change (e.g. extend washout, change lookback). Returns before/after eligible pool.",
     CriterionImpactArgs, tool_criterion_impact),
    ("rank_sites",
     "Rank trial sites for the current scenario, with optional region / minEligible / diversityTargets filters.",
     RankSitesArgs, tool_rank_sites),
    ("region_impact",
     "Geographic what-if: the impact of NOT recruiting in a region (mode=exclude) or recruiting ONLY in a region "
     "(mode=focus) — sites and eligible patients dropped vs retained. Use for 'what if we don't recruit in the West', "
     "'only run in the Southeast', 'drop the Midwest'.",
     RegionImpactArgs, tool_region_impact),
    ("forecast_enrollment",
     "Forecast enrollment and last-patient-in, with what-ifs for screenFailRate, numSites, targetDate. Also returns sites needed to hit the target date.",
     ForecastArgs, tool_forecast_enrollment),
    ("rank_kols",
     "Rank KOLs for the current signal weights, optionally filtered by segment or region.",
     RankKolsArgs, tool_rank_kols),
    ("population_sizing",
     "Compare diagnosed/treated/trial-eligible populations across indications for the current cohort.",
     NoArgs, tool_population_sizing),
    ("explain_proxy",
     "Explain the proxy + parameters + confidence + limitation behind a modeled psychiatric criterion (severity, current episode, substance use, suicidality).",
     ExplainProxyArgs, tool_explain_proxy),
    ("untapped_pis",
     "Find high-volume providers (top deciles) with NO clinical-trial history — net-new PI candidates. Real RWD anti-join (NPI deciles vs ClinicalTrials.gov). Optional region/state filter.",
     UntappedArgs, tool_untapped_pis),
    ("trial_saturation",
     "Competing-trial saturation: density of competing trials by state or condition, plus over-committed investigators (>3 concurrent trials). Real ClinicalTrials.gov data.",
     SaturationArgs, tool_trial_saturation),
    ("referral_centrality",
     "Rank providers by REAL referral-network influence (PageRank reach + weighted centrality over the HCP referral graph). Optional region filter.",
     ReferralCentralityArgs, tool_referral_centrality),
]

# Implementations keyed by name — used by the deterministic fallback router.
TOOL_IMPL: dict[str, Callable[[AssistantContext, dict], dict]] = {
    name: impl for name, _desc, _args, impl in TOOL_REGISTRY
}


def build_structured_tools(ctx: AssistantContext) -> list[StructuredTool]:
    """Per-request LangChain tools bound to the current dataset+scenario.

    Each StructuredTool validates the LLM's arguments against the Pydantic
    args schema, then runs the same authoritative compute the UI uses and returns
    the full payload (text/data/viz/audit) for the agent loop to aggregate.
    """
    tools: list[StructuredTool] = []
    for name, desc, args_model, impl in TOOL_REGISTRY:
        def _run(_impl=impl, **kwargs: Any) -> dict:
            return _impl(ctx, kwargs)
        tools.append(StructuredTool.from_function(
            func=_run, name=name, description=desc, args_schema=args_model,
        ))
    return tools
