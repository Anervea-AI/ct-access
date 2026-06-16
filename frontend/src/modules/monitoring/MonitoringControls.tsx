import { useStore } from "@/state/store";
import { Slider } from "@/design/primitives";

export function MonitoringControls() {
  const m = useStore((s) => s.scenarios[s.activeId].monitoring);
  const updateActive = useStore((s) => s.updateActive);

  return (
    <div className="space-y-3">
      <div className="label-caps text-text-subtle">Alert thresholds (projected / target)</div>
      <Slider
        label="Watch below" value={m.watchThreshold} min={0.7} max={1} step={0.01}
        onChange={(v) => updateActive((s) => { s.monitoring.watchThreshold = v; })}
      />
      <Slider
        label="At-risk below" value={m.atRiskThreshold} min={0.5} max={0.95} step={0.01}
        onChange={(v) => updateActive((s) => { s.monitoring.atRiskThreshold = v; })}
      />
      <Slider
        label="Critical below" value={m.criticalThreshold} min={0.3} max={0.8} step={0.01}
        onChange={(v) => updateActive((s) => { s.monitoring.criticalThreshold = v; })}
      />
      <p className="text-[11px] text-text-faint border-t border-inset pt-2">
        A site flags when its projected final enrollment falls below the target by these ratios.
        Add rescue sites in the panel on the right to simulate timeline recovery.
      </p>
    </div>
  );
}
