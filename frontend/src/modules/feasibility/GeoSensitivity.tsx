import { useMemo } from "react";
import { useStore } from "@/state/store";
import { deriveFunnel, deriveSites } from "@/state/selectors";
import { fmtInt } from "@/lib/format";

export function GeoSensitivity() {
  const ds = useStore((s) => s.dataset)!;
  const scenario = useStore((s) => s.scenarios[s.activeId]);

  const { rows, max } = useMemo(() => {
    const funnel = deriveFunnel(ds, scenario);
    const current = deriveSites(ds, scenario);

    // relax the biggest constraint to see which regions "unlock"
    const relaxed = structuredClone(scenario);
    const bc = relaxed.criteria.find((c) => c.id === funnel.biggestConstraintId);
    if (bc) bc.enabled = false;
    const relaxedSites = deriveSites(ds, relaxed);

    const agg = (sites: typeof current.sites) => {
      const m = new Map<string, number>();
      for (const s of sites) m.set(s.region, (m.get(s.region) ?? 0) + s.eligiblePatients);
      return m;
    };
    const cur = agg(current.sites);
    const rel = agg(relaxedSites.sites);
    const regions = ds.regions;
    const rows = regions.map((r) => {
      const c = cur.get(r) ?? 0;
      const unlock = Math.max(0, (rel.get(r) ?? 0) - c);
      return { region: r, current: c, unlock };
    });
    const max = Math.max(1, ...rows.map((r) => r.current + r.unlock));
    return { rows, max };
  }, [ds, scenario]);

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-3 text-[10px] text-text-muted">
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-2 bg-primary rounded-sm" /> current eligible</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-2 bg-gold rounded-sm" /> unlocked if biggest constraint relaxed</span>
      </div>
      {rows.map((r) => (
        <div key={r.region}>
          <div className="flex justify-between text-xs mb-0.5">
            <span className="text-ink">{r.region}</span>
            <span className="font-mono text-text-muted">
              {fmtInt(r.current)}{r.unlock > 0 && <span className="text-[#92400e]"> (+{fmtInt(r.unlock)})</span>}
            </span>
          </div>
          <div className="h-4 bg-inset rounded-sm overflow-hidden flex">
            <div className="h-full bg-primary" style={{ width: `${(r.current / max) * 100}%` }} />
            <div className="h-full bg-gold" style={{ width: `${(r.unlock / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
