import { useMemo, useState } from "react";
import type { Site } from "@/types";
import { Badge, cn } from "@/design/primitives";
import { PlusIcon } from "@/design/icons";
import { fmtInt, fmtScore } from "@/lib/format";

type SortKey = "score" | "eligiblePatients" | "piExperienceTrials" | "indicationRxVolume" | "competingTrials";

const COLUMNS: { key: SortKey | "rank" | "name" | "region"; label: string; numeric: boolean; sortable: boolean }[] = [
  { key: "rank", label: "Rank", numeric: false, sortable: false },
  { key: "name", label: "Site", numeric: false, sortable: false },
  { key: "region", label: "Region", numeric: false, sortable: false },
  { key: "eligiblePatients", label: "Eligible", numeric: true, sortable: true },
  { key: "piExperienceTrials", label: "PI trials", numeric: true, sortable: true },
  { key: "indicationRxVolume", label: "Rx volume", numeric: true, sortable: true },
  { key: "competingTrials", label: "Competing", numeric: true, sortable: true },
  { key: "score", label: "Score", numeric: true, sortable: true },
];

export function SiteLeaderboard({
  sites, selectedId, onSelect, shortlist, onToggleShortlist, limit = 15,
}: {
  sites: Site[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  shortlist: Set<string>;
  onToggleShortlist: (id: string) => void;
  limit?: number;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("score");

  // rank is by the canonical score order coming from the selector
  const rankById = useMemo(() => {
    const m = new Map<string, number>();
    sites.forEach((s, i) => m.set(s.id, i + 1));
    return m;
  }, [sites]);

  const rows = useMemo(() => {
    const sorted = [...sites].sort((a, b) => b[sortKey] - a[sortKey]);
    return sorted.slice(0, limit);
  }, [sites, sortKey, limit]);

  if (!sites.length) {
    return <p className="text-sm text-text-muted">No sites match the current filters. Loosen the eligible-patient or PI-experience thresholds.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            {COLUMNS.map((c) => (
              <th
                key={c.key}
                onClick={c.sortable ? () => setSortKey(c.key as SortKey) : undefined}
                className={cn(
                  "bg-muted text-text-subtle label-caps px-3 py-2 whitespace-nowrap",
                  c.numeric ? "text-right" : "text-left",
                  c.sortable && "cursor-pointer select-none hover:text-primary",
                  c.sortable && sortKey === c.key && "text-primary",
                )}
              >
                {c.label}{c.sortable && sortKey === c.key ? " ↓" : ""}
              </th>
            ))}
            <th className="bg-muted px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => {
            const rank = rankById.get(s.id) ?? 0;
            const isSel = s.id === selectedId;
            const inList = shortlist.has(s.id);
            return (
              <tr
                key={s.id}
                onClick={() => onSelect(s.id)}
                className={cn(
                  "border-t border-inset cursor-pointer transition-colors",
                  isSel ? "bg-primary/5" : "hover:bg-muted/60",
                )}
              >
                <td className="px-3 py-2 whitespace-nowrap">
                  {rank <= 3
                    ? <Badge variant="gold">#{rank}</Badge>
                    : <span className="text-text-muted font-mono">{rank}</span>}
                </td>
                <td className={cn("px-3 py-2 whitespace-nowrap font-medium", isSel ? "text-primary" : "text-ink")}>{s.name}</td>
                <td className="px-3 py-2 whitespace-nowrap text-text-muted">{s.region}</td>
                <td className="px-3 py-2 whitespace-nowrap text-right font-mono text-ink">{fmtInt(s.eligiblePatients)}</td>
                <td className="px-3 py-2 whitespace-nowrap text-right font-mono text-ink">{s.piExperienceTrials}</td>
                <td className="px-3 py-2 whitespace-nowrap text-right font-mono text-ink">{fmtInt(s.indicationRxVolume)}</td>
                <td className="px-3 py-2 whitespace-nowrap text-right font-mono text-ink">{s.competingTrials}</td>
                <td className="px-3 py-2 whitespace-nowrap text-right font-mono font-semibold text-primary">{fmtScore(s.score)}</td>
                <td className="px-3 py-2 whitespace-nowrap text-right">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onToggleShortlist(s.id); }}
                    title={inList ? "Remove from shortlist" : "Add to shortlist"}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold transition-colors",
                      inList
                        ? "bg-primary text-white border-primary"
                        : "bg-surface text-primary border-primary hover:bg-primary hover:text-white",
                    )}
                  >
                    <PlusIcon size={12} />{inList ? "Added" : "Shortlist"}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
