import { useStore } from "@/state/store";
import { Slider, Select, Toggle } from "@/design/primitives";

export const METRICS = [
  { value: "trialEligible", label: "Trial-eligible" },
  { value: "diagnosed", label: "Diagnosed population" },
  { value: "treated", label: "Treated population" },
  { value: "competingTrialDensity", label: "Competing trial density" },
  { value: "feasibilityScore", label: "Feasibility score" },
];

export function PopulationControls() {
  const ds = useStore((s) => s.dataset)!;
  const cohort = useStore((s) => s.scenarios[s.activeId].cohort);
  const updateActive = useStore((s) => s.updateActive);

  return (
    <div className="space-y-4">
      <div>
        <div className="label-caps text-text-subtle mb-2">Cohort definition (applies to all indications)</div>
        <div className="space-y-3">
          <Slider label="Min age" value={cohort.minAge} min={18} max={64} step={1} unit=" yr"
            onChange={(v) => updateActive((s) => { s.cohort.minAge = Math.min(v, s.cohort.maxAge - 1); })} />
          <Slider label="Max age" value={cohort.maxAge} min={19} max={80} step={1} unit=" yr"
            onChange={(v) => updateActive((s) => { s.cohort.maxAge = Math.max(v, s.cohort.minAge + 1); })} />
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-muted">Treated patients only</span>
            <Toggle checked={cohort.treatedOnly} onChange={(v) => updateActive((s) => { s.cohort.treatedOnly = v; })} />
          </div>
          <div>
            <div className="label-caps text-text-subtle mb-1">Region</div>
            <Select value={cohort.region}
              onChange={(v) => updateActive((s) => { s.cohort.region = v; })}
              options={[{ value: "National", label: "National" }, ...ds.regions.map((r) => ({ value: r, label: r }))]}
              className="w-full" />
          </div>
        </div>
      </div>
      <div className="border-t border-inset pt-3">
        <div className="label-caps text-text-subtle mb-2">Prioritization matrix axes</div>
        <div className="space-y-2">
          <div>
            <div className="text-xs text-text-muted mb-1">X axis</div>
            <Select value={cohort.matrixX} onChange={(v) => updateActive((s) => { s.cohort.matrixX = v; })} options={METRICS} className="w-full" />
          </div>
          <div>
            <div className="text-xs text-text-muted mb-1">Y axis</div>
            <Select value={cohort.matrixY} onChange={(v) => updateActive((s) => { s.cohort.matrixY = v; })} options={METRICS} className="w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
