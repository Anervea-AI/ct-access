import { useEffect, useRef, useState, type ReactNode } from "react";
import { useStore } from "@/state/store";
import { Slider, cn } from "@/design/primitives";
import { ChevronDown, SlidersIcon } from "@/design/icons";

const SPECIALTIES = ["Psychiatry", "Neurology", "Primary Care", "Research Center"];

/* ----- popover: a pill trigger + a click-outside dropdown panel ----- */
function Popover({
  label, summary, active, width = "18rem", children,
}: {
  label: string;
  summary: string;
  active: boolean;
  width?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
          active
            ? "bg-primary/10 text-primary border-primary/40"
            : "bg-surface text-text-muted border-border hover:bg-hover",
        )}
      >
        <span className="text-text-faint font-semibold uppercase tracking-wide text-[10px]">{label}</span>
        <span className={cn("font-semibold", active ? "text-primary" : "text-ink")}>{summary}</span>
        <ChevronDown size={13} className={cn("transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div
          className="absolute z-30 mt-2 rounded-lg border border-border bg-surface p-4 shadow-pop"
          style={{ width }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

function ChipToggle({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-2.5 py-1 text-xs font-semibold border transition-colors",
        active ? "bg-primary text-white border-primary" : "bg-surface text-text-muted border-border hover:bg-hover",
      )}
    >
      {label}
    </button>
  );
}

export function SitesToolbar() {
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

  const black = f.diversityTargets.blackPct ?? 0;
  const hispanic = f.diversityTargets.hispanicPct ?? 0;
  const divActive = black > 0 || hispanic > 0 || f.diversityWeight > 0;

  // dirty vs defaults (see compute/defaults.ts)
  const supplyActive = f.catchmentRadiusMiles !== 50 || f.minEligible !== 0 || f.piExperienceMin !== 0;
  const dirty =
    supplyActive || f.regions.length > 0 || f.specialties.length > 0 || divActive;

  const reset = () =>
    updateActive((s) => {
      s.siteFilters.catchmentRadiusMiles = 50;
      s.siteFilters.minEligible = 0;
      s.siteFilters.piExperienceMin = 0;
      s.siteFilters.regions = [];
      s.siteFilters.specialties = [];
      s.siteFilters.diversityWeight = 0;
      s.siteFilters.diversityTargets = {};
    });

  return (
    <div className="sticky top-0 z-20 mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface/95 px-3 py-2 shadow-sm backdrop-blur">
      <span className="inline-flex items-center gap-1.5 text-text-faint pr-1">
        <SlidersIcon size={15} className="text-accent" />
        <span className="label-caps">Filters</span>
      </span>

      {/* Catchment & supply */}
      <Popover
        label="Catchment"
        summary={
          supplyActive
            ? `${f.catchmentRadiusMiles} mi · ≥${f.minEligible} · ≥${f.piExperienceMin}t`
            : `${f.catchmentRadiusMiles} mi`
        }
        active={supplyActive}
        width="20rem"
      >
        <div className="space-y-3">
          <Slider
            label="Catchment radius" value={f.catchmentRadiusMiles}
            min={10} max={150} step={5} unit=" mi"
            onChange={(v) => updateActive((s) => { s.siteFilters.catchmentRadiusMiles = v; })}
          />
          <Slider
            label="Min eligible patients" value={f.minEligible}
            min={0} max={400} step={10}
            onChange={(v) => updateActive((s) => { s.siteFilters.minEligible = v; })}
          />
          <Slider
            label="PI experience (min trials)" value={f.piExperienceMin}
            min={0} max={12} step={1}
            onChange={(v) => updateActive((s) => { s.siteFilters.piExperienceMin = v; })}
          />
        </div>
      </Popover>

      {/* Regions */}
      <Popover
        label="Regions"
        summary={f.regions.length === 0 ? "All" : `${f.regions.length} selected`}
        active={f.regions.length > 0}
      >
        <div className="flex flex-wrap gap-1.5">
          {ds.regions.map((r) => (
            <ChipToggle key={r} label={r} active={f.regions.includes(r)} onClick={() => toggleRegion(r)} />
          ))}
        </div>
        <p className="mt-2 text-[11px] text-text-faint">
          {f.regions.length === 0 ? "All regions included." : `${f.regions.length} selected.`}
        </p>
      </Popover>

      {/* Specialties */}
      <Popover
        label="Specialties"
        summary={
          f.specialties.length === 0
            ? "Any"
            : f.specialties.length === 1
              ? f.specialties[0]
              : `${f.specialties[0]} +${f.specialties.length - 1}`
        }
        active={f.specialties.length > 0}
      >
        <div className="flex flex-wrap gap-1.5">
          {SPECIALTIES.map((sp) => (
            <ChipToggle key={sp} label={sp} active={f.specialties.includes(sp)} onClick={() => toggleSpecialty(sp)} />
          ))}
        </div>
        <p className="mt-2 text-[11px] text-text-faint">
          {f.specialties.length === 0 ? "Any specialty." : `${f.specialties.length} required.`}
        </p>
      </Popover>

      {/* Diversity */}
      <Popover
        label="Diversity"
        summary={divActive ? `${black}% / ${hispanic}% · w${Math.round(f.diversityWeight * 100)}%` : "Off"}
        active={divActive}
        width="20rem"
      >
        <div className="space-y-3">
          <Slider
            label="Black representation target" value={black}
            min={0} max={100} step={1} unit="%"
            onChange={(v) => updateActive((s) => { s.siteFilters.diversityTargets.blackPct = v; })}
          />
          <Slider
            label="Hispanic representation target" value={hispanic}
            min={0} max={100} step={1} unit="%"
            onChange={(v) => updateActive((s) => { s.siteFilters.diversityTargets.hispanicPct = v; })}
          />
          <Slider
            label="Diversity weight in score" value={Math.round(f.diversityWeight * 100)}
            min={0} max={100} step={5} unit="%"
            onChange={(v) => updateActive((s) => { s.siteFilters.diversityWeight = v / 100; })}
          />
        </div>
        <p className="mt-2 text-[11px] text-text-faint">
          Targets reward sites whose demographics meet the goal; weight controls how much that shifts the ranking.
        </p>
      </Popover>

      <div className="flex-1" />

      <button
        type="button"
        onClick={reset}
        disabled={!dirty}
        className="rounded-md px-3 py-1.5 text-xs font-semibold text-text-muted hover:bg-hover hover:text-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Reset
      </button>
    </div>
  );
}
