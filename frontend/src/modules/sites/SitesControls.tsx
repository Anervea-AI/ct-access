import { useStore } from "@/state/store";
import { SectionLabel, Slider, cn } from "@/design/primitives";

const SPECIALTIES = ["Psychiatry", "Neurology", "Primary Care", "Research Center"];

function ChipToggle({
  label, active, onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-2.5 py-1 text-xs font-semibold border transition-colors",
        active
          ? "bg-primary text-white border-primary"
          : "bg-surface text-text-muted border-border hover:bg-hover",
      )}
    >
      {label}
    </button>
  );
}

export function SitesControls() {
  const ds = useStore((s) => s.dataset)!;
  const scenario = useStore((s) => s.scenarios[s.activeId]);
  const updateActive = useStore((s) => s.updateActive);
  const f = scenario.siteFilters;

  const toggleRegion = (r: string) =>
    updateActive((s) => {
      const set = s.siteFilters.regions;
      const i = set.indexOf(r);
      if (i >= 0) set.splice(i, 1);
      else set.push(r);
    });

  const toggleSpecialty = (sp: string) =>
    updateActive((s) => {
      const set = s.siteFilters.specialties;
      const i = set.indexOf(sp);
      if (i >= 0) set.splice(i, 1);
      else set.push(sp);
    });

  return (
    <div className="space-y-5">
      <div>
        <SectionLabel className="mb-2">Catchment & supply</SectionLabel>
        <div className="space-y-3">
          <Slider
            label="Catchment radius"
            value={f.catchmentRadiusMiles}
            min={10}
            max={150}
            step={5}
            unit=" mi"
            onChange={(v) => updateActive((s) => { s.siteFilters.catchmentRadiusMiles = v; })}
          />
          <Slider
            label="Min eligible patients"
            value={f.minEligible}
            min={0}
            max={400}
            step={10}
            onChange={(v) => updateActive((s) => { s.siteFilters.minEligible = v; })}
          />
          <Slider
            label="PI experience (min trials)"
            value={f.piExperienceMin}
            min={0}
            max={12}
            step={1}
            onChange={(v) => updateActive((s) => { s.siteFilters.piExperienceMin = v; })}
          />
        </div>
      </div>

      <div className="pt-4 border-t border-inset">
        <SectionLabel className="mb-2">Regions</SectionLabel>
        <div className="flex flex-wrap gap-1.5">
          {ds.regions.map((r) => (
            <ChipToggle
              key={r}
              label={r}
              active={f.regions.includes(r)}
              onClick={() => toggleRegion(r)}
            />
          ))}
        </div>
        <p className="text-[11px] text-text-faint mt-1.5">
          {f.regions.length === 0 ? "All regions included." : `${f.regions.length} selected.`}
        </p>
      </div>

      <div className="pt-4 border-t border-inset">
        <SectionLabel className="mb-2">Specialties</SectionLabel>
        <div className="flex flex-wrap gap-1.5">
          {SPECIALTIES.map((sp) => (
            <ChipToggle
              key={sp}
              label={sp}
              active={f.specialties.includes(sp)}
              onClick={() => toggleSpecialty(sp)}
            />
          ))}
        </div>
        <p className="text-[11px] text-text-faint mt-1.5">
          {f.specialties.length === 0 ? "Any specialty." : `${f.specialties.length} required.`}
        </p>
      </div>

      <div className="pt-4 border-t border-inset">
        <SectionLabel className="mb-2">Diversity targets</SectionLabel>
        <div className="space-y-3">
          <Slider
            label="Black representation target"
            value={f.diversityTargets.blackPct ?? 0}
            min={0}
            max={100}
            step={1}
            unit="%"
            onChange={(v) => updateActive((s) => { s.siteFilters.diversityTargets.blackPct = v; })}
          />
          <Slider
            label="Hispanic representation target"
            value={f.diversityTargets.hispanicPct ?? 0}
            min={0}
            max={100}
            step={1}
            unit="%"
            onChange={(v) => updateActive((s) => { s.siteFilters.diversityTargets.hispanicPct = v; })}
          />
          <Slider
            label="Diversity weight in score"
            value={Math.round(f.diversityWeight * 100)}
            min={0}
            max={100}
            step={5}
            unit="%"
            onChange={(v) => updateActive((s) => { s.siteFilters.diversityWeight = v / 100; })}
          />
        </div>
        <p className="text-[11px] text-text-faint mt-1.5">
          Targets reward sites whose demographics meet the goal; weight controls how much that
          shifts the ranking.
        </p>
      </div>
    </div>
  );
}
