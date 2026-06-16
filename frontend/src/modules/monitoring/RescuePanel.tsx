import { useMemo, useState } from "react";
import { useStore } from "@/state/store";
import { deriveFunnel } from "@/state/selectors";
import { Badge, Button, Select, cn } from "@/design/primitives";
import { r0 } from "@/compute";
import { fmtInt } from "@/lib/format";

export function RescuePanel() {
  const ds = useStore((s) => s.dataset)!;
  const scenario = useStore((s) => s.scenarios[s.activeId]);
  const updateActive = useStore((s) => s.updateActive);
  const [region, setRegion] = useState("");

  const { candidates, activeIds } = useMemo(() => {
    const pool = deriveFunnel(ds, scenario).eligiblePool;
    const ranked = ds.sites
      .map((s) => ({ ...s, eligiblePatients: r0(s.baseShare * pool) }))
      .sort((a, b) => b.eligiblePatients - a.eligiblePatients);
    const active = new Set(ranked.slice(0, scenario.forecast.numSites).map((s) => s.id));
    const rest = ranked
      .filter((s) => !active.has(s.id) && !scenario.monitoring.rescueSiteIds.includes(s.id))
      .filter((s) => !region || s.region === region)
      .slice(0, 8);
    return { candidates: rest, activeIds: active };
  }, [ds, scenario, region]);

  const rescues = scenario.monitoring.rescueSiteIds;

  const addRescue = (id: string) =>
    updateActive((s) => { if (!s.monitoring.rescueSiteIds.includes(id)) s.monitoring.rescueSiteIds.push(id); });
  const removeRescue = (id: string) =>
    updateActive((s) => { s.monitoring.rescueSiteIds = s.monitoring.rescueSiteIds.filter((x) => x !== id); });

  return (
    <div>
      {rescues.length > 0 && (
        <div className="mb-3">
          <div className="label-caps text-text-subtle mb-1">Added rescue sites</div>
          <div className="flex flex-wrap gap-1.5">
            {rescues.map((id) => {
              const s = ds.sites.find((x) => x.id === id);
              return (
                <button key={id} onClick={() => removeRescue(id)} className="inline-flex items-center gap-1 rounded-full bg-success-bg text-success-text px-2 py-0.5 text-xs">
                  {s?.name ?? id} ✕
                </button>
              );
            })}
          </div>
        </div>
      )}
      <div className="flex items-center gap-2 mb-2">
        <span className="label-caps text-text-subtle">Find in</span>
        <Select
          value={region}
          onChange={setRegion}
          options={[{ value: "", label: "All regions" }, ...ds.regions.map((r) => ({ value: r, label: r }))]}
        />
      </div>
      <div className="space-y-1.5">
        {candidates.map((s) => (
          <div key={s.id} className="flex items-center justify-between gap-2 bg-muted/50 rounded-md px-2.5 py-1.5">
            <div className="min-w-0">
              <div className="text-sm text-ink truncate">{s.name}</div>
              <div className="text-[11px] text-text-muted">{s.region} · {fmtInt(s.eligiblePatients)} eligible · {s.competingTrials} competing</div>
            </div>
            <Button variant="secondary" className="px-2 py-1 text-xs" onClick={() => addRescue(s.id)}>Add</Button>
          </div>
        ))}
        {candidates.length === 0 && <p className="text-xs text-text-muted">No more candidate sites in this region.</p>}
      </div>
    </div>
  );
}
