import { useStore } from "@/state/store";
import { Slider, Badge } from "@/design/primitives";

export function ProxyPanel() {
  const scenario = useStore((s) => s.scenarios[s.activeId]);
  const setParam = useStore((s) => s.setCriterionParam);
  const proxies = scenario.criteria.filter((c) => c.isProxy);

  return (
    <div className="space-y-3">
      {proxies.map((c) => (
        <div key={c.id} className="bg-warning-bg/40 border border-[#fed7aa] rounded-md p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-ink">{c.label}</span>
            <Badge variant="warning">confidence: {c.confidence}</Badge>
          </div>
          <p className="text-xs text-text-muted mt-1 leading-snug">{c.proxyNote}</p>
          {c.param && (
            <div className="mt-2">
              <Slider
                label={`strictness — ${c.param.name}`}
                value={c.param.value}
                min={c.param.min}
                max={c.param.max}
                step={c.param.step}
                unit={c.param.unit ? ` ${c.param.unit}` : ""}
                onChange={(v) => setParam(c.id, v)}
                disabled={!c.enabled}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
