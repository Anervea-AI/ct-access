import type { RiskLevel, SiteStatus } from "@/types";
import { Badge, cn } from "@/design/primitives";
import { fmtInt } from "@/lib/format";

const RISK_META: Record<RiskLevel, { label: string; variant: "success" | "info" | "warning" | "error" }> = {
  on_track: { label: "On track", variant: "success" },
  watch: { label: "Watch", variant: "info" },
  at_risk: { label: "At risk", variant: "warning" },
  critical: { label: "Critical", variant: "error" },
};

export function RiskBadge({ risk }: { risk: RiskLevel }) {
  const m = RISK_META[risk];
  return <Badge variant={m.variant}>{m.label}</Badge>;
}

export function RiskTable({
  sites, selectedId, onSelect,
}: {
  sites: SiteStatus[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            {["Site", "Region", "Planned", "Actual", "Forecast", "Risk", "Shortfall"].map((c) => (
              <th key={c} className="bg-muted text-text-subtle label-caps text-left px-3 py-2 whitespace-nowrap">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sites.map((s) => (
            <tr
              key={s.siteId}
              onClick={() => onSelect(s.siteId)}
              className={cn("border-t border-inset cursor-pointer hover:bg-muted/60", selectedId === s.siteId && "bg-muted")}
            >
              <td className="px-3 py-2 text-primary font-medium whitespace-nowrap">{s.name}</td>
              <td className="px-3 py-2 text-ink">{s.region}</td>
              <td className="px-3 py-2 font-mono text-text-muted">{fmtInt(s.planned)}</td>
              <td className="px-3 py-2 font-mono text-ink">{fmtInt(s.actual)}</td>
              <td className="px-3 py-2 font-mono text-ink">{fmtInt(s.forecast)}</td>
              <td className="px-3 py-2"><RiskBadge risk={s.risk} /></td>
              <td className={cn("px-3 py-2 font-mono", s.predictedShortfall > 0 ? "text-error-text" : "text-text-faint")}>
                {s.predictedShortfall > 0 ? `−${fmtInt(s.predictedShortfall)}` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
