import { useState } from "react";
import type { Criterion, CriterionAction, FieldChange, PlanCriteriaResponse } from "@/types";
import { useStore } from "@/state/store";
import { api } from "@/lib/api";
import { Badge, Button, Callout, Slider, Spinner, Toggle, cn } from "@/design/primitives";

function CriterionRow({ c }: { c: Criterion }) {
  const toggle = useStore((s) => s.toggleCriterion);
  const setParam = useStore((s) => s.setCriterionParam);
  const removeCriterion = useStore((s) => s.removeCriterion);
  const isAnchor = c.baseReductionPct === 0 && c.paramSlope === 0;
  const isAi = c.category === "ai-generated";

  return (
    <div className={cn("py-2.5 border-t border-inset first:border-t-0", !c.enabled && "opacity-55")}>
      <div className="flex items-center gap-2.5">
        <Toggle checked={c.enabled} onChange={() => toggle(c.id)} disabled={isAnchor} />
        <span className="flex-1 text-sm text-ink leading-tight">{c.label}</span>
        {isAi && <Badge variant="info">AI</Badge>}
        {c.isProxy && <Badge variant="warning">proxy · {c.confidence}</Badge>}
        {isAnchor && <Badge variant="neutral">anchor</Badge>}
        {isAi && (
          <button
            type="button"
            onClick={() => removeCriterion(c.id)}
            aria-label="Remove criterion"
            className="text-text-faint hover:text-error-text text-sm leading-none px-1"
          >
            ✕
          </button>
        )}
      </div>
      {c.param && c.enabled && (
        <div className="mt-2 pl-11 pr-1">
          <Slider
            label={c.param.name}
            value={c.param.value}
            min={c.param.min}
            max={c.param.max}
            step={c.param.step}
            unit={c.param.unit ? ` ${c.param.unit}` : ""}
            onChange={(v) => setParam(c.id, v)}
          />
        </div>
      )}
      {isAi && c.dataSource && (
        <div className="mt-1 pl-11 text-[11px] text-text-faint">
          {c.dataSource} · removes {c.baseReductionPct}% of the remaining pool
        </div>
      )}
    </div>
  );
}

function changeText(ch: FieldChange): string {
  switch (ch.field) {
    case "paramValue": return `max age ${Number(ch.oldValue)} → ${Number(ch.newValue)}`;
    case "baseReductionPct": return `reduction ${ch.oldValue}% → ${ch.newValue}%`;
    case "label": return `rename “${ch.oldValue}” → “${ch.newValue}”`;
    case "enabled": return ch.newValue ? "enable" : "disable";
    case "type": return `type → ${ch.newValue}`;
    default: return `${ch.field} → ${ch.newValue}`;
  }
}

function PlanActionRow({ a, labelOf }: { a: CriterionAction; labelOf: (id?: string | null) => string }) {
  if (a.op === "add" && a.criterion) {
    return (
      <li className="text-xs py-1.5 border-t border-inset first:border-t-0">
        <div className="flex items-baseline gap-2">
          <span className="text-success-text font-semibold">+ Add</span>
          <span className="text-ink font-medium">{a.criterion.label}</span>
          <span className="text-text-faint">· removes {a.criterion.baseReductionPct}% of remaining</span>
        </div>
        {a.reason && <div className="text-[11px] text-text-muted mt-0.5">{a.reason}</div>}
      </li>
    );
  }
  const name = labelOf(a.targetId);
  const verb = a.op === "enable" ? "Enable" : a.op === "disable" ? "Disable" : "Modify";
  const detail = a.op === "modify" ? a.changes.map(changeText).join(", ") : "";
  return (
    <li className="text-xs py-1.5 border-t border-inset first:border-t-0">
      <div className="flex items-baseline gap-2">
        <span className="text-primary font-semibold">~ {verb}</span>
        <span className="text-ink font-medium">{name}</span>
        {detail && <span className="text-text-faint">· {detail}</span>}
      </div>
      {a.reason && <div className="text-[11px] text-text-muted mt-0.5">{a.reason}</div>}
    </li>
  );
}

function AiCriterionComposer() {
  const criteria = useStore((s) => s.scenarios[s.activeId].criteria);
  const applyPlan = useStore((s) => s.applyPlan);
  const restoreCriteria = useStore((s) => s.restoreCriteria);

  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [type, setType] = useState<"inclusion" | "exclusion">("inclusion");
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<PlanCriteriaResponse | null>(null);
  const [plannedSig, setPlannedSig] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [undoSnapshot, setUndoSnapshot] = useState<Criterion[] | null>(null);

  const labelOf = (id?: string | null) => criteria.find((c) => c.id === id)?.label ?? id ?? "?";
  // signature of the criteria the plan was built against (ids + enabled + param value)
  const sig = (cs: Criterion[]) => cs.map((c) => `${c.id}:${c.enabled ? 1 : 0}:${c.param?.value ?? ""}`).join("|");

  const reset = () => { setPlan(null); setPlannedSig(null); setError(null); setUndoSnapshot(null); };

  const submit = async () => {
    const t = text.trim();
    if (!t) return;
    setLoading(true);
    reset();
    try {
      setPlan(await api.planCriteria(t, type, criteria));
      setPlannedSig(sig(criteria));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const apply = () => {
    if (!plan?.actions.length) return;
    // refuse to apply a plan built against a now-changed criteria set (the preview
    // would no longer match reality — e.g. a targeted criterion was edited/removed)
    if (plannedSig !== null && sig(criteria) !== plannedSig) {
      setError("Criteria changed since this plan was generated — please re-plan.");
      setPlan(null);
      setPlannedSig(null);
      return;
    }
    setUndoSnapshot(structuredClone(criteria)); // capture inverse before mutating
    applyPlan(plan.actions);
    setText("");
    setPlan(null);
    setPlannedSig(null);
  };

  const undo = () => {
    if (undoSnapshot) restoreCriteria(undoSnapshot);
    setUndoSnapshot(null);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 w-full rounded-md border border-dashed border-border-strong text-sm font-semibold text-primary py-2 hover:bg-primary/5 transition-colors"
      >
        + Add or adjust criteria with AI
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-md border border-inset bg-muted/40 p-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="label-caps text-text-subtle">Describe a change</span>
        <div className="flex rounded-md border border-border overflow-hidden">
          {(["inclusion", "exclusion"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setType(v)}
              className={cn(
                "px-2.5 py-1 text-xs font-semibold capitalize",
                type === v ? "bg-primary text-white" : "bg-surface text-text-muted hover:bg-hover",
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(); }}
        rows={2}
        placeholder='e.g. "female with age 40" — adjusts the age criterion and adds Female'
        className="w-full resize-none bg-surface border border-border rounded-sm px-2 py-1.5 text-sm text-ink-plain focus:outline-none focus:ring-2 focus:ring-primary/30"
      />

      <div className="flex items-center gap-2">
        <Button variant="primary" onClick={submit} disabled={loading || !text.trim()}>
          {loading ? <><Spinner /> Planning…</> : "Plan with AI"}
        </Button>
        <button
          type="button"
          onClick={() => { setOpen(false); setText(""); reset(); }}
          className="text-xs text-text-muted hover:text-ink font-semibold"
        >
          Close
        </button>
        <span className="text-[11px] text-text-faint ml-auto">
          Adds new or adjusts existing · age, sex, payer, race, region/state & plan
        </span>
      </div>

      {error && <Callout variant="error" title="Request failed">{error}</Callout>}

      {/* unavailable */}
      {plan && !plan.available && (
        <Callout variant="warning" title={`Data not available${plan.missingData ? `: ${plan.missingData}` : ""}`}>
          {plan.explanation}
        </Callout>
      )}

      {/* proposed plan preview (not yet applied) */}
      {plan && plan.available && plan.actions.length > 0 && (
        <div className="rounded-md border border-border bg-surface p-2.5">
          <div className="text-xs text-text-muted mb-1">{plan.explanation}</div>
          <ul className="mb-2">
            {plan.actions.map((a, i) => <PlanActionRow key={i} a={a} labelOf={labelOf} />)}
          </ul>
          <div className="flex items-center gap-2">
            <Button variant="primary" onClick={apply}>Apply plan</Button>
            <button type="button" onClick={reset} className="text-xs text-text-muted hover:text-ink font-semibold">
              Discard
            </button>
          </div>
        </div>
      )}

      {/* applied → offer undo */}
      {undoSnapshot && (
        <Callout variant="success" title="Plan applied — funnel recomputed">
          <button type="button" onClick={undo} className="underline font-semibold hover:opacity-80">
            Undo
          </button>{" "}
          to restore the previous criteria.
        </Callout>
      )}

      {plan && (
        <div className="text-[11px] text-text-faint">
          {plan.usedLlm
            ? "Planned by ChatGPT (gpt-5.2)"
            : "Planned by the built-in engine — set OPENAI_API_KEY to route this through ChatGPT 5.2"}
        </div>
      )}
    </div>
  );
}

export function CriteriaPanel() {
  const scenario = useStore((s) => s.scenarios[s.activeId]);
  const inclusions = scenario.criteria.filter((c) => c.type === "inclusion");
  const exclusions = scenario.criteria.filter((c) => c.type === "exclusion");

  return (
    <div>
      <div className="label-caps text-text-subtle mb-1">Inclusion criteria</div>
      <div className="mb-4">
        {inclusions.map((c) => <CriterionRow key={c.id} c={c} />)}
      </div>
      <div className="label-caps text-text-subtle mb-1">Exclusion criteria</div>
      <div>
        {exclusions.map((c) => <CriterionRow key={c.id} c={c} />)}
      </div>
      <AiCriterionComposer />
    </div>
  );
}
