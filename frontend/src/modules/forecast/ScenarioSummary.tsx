import type { ForecastScenarioResult } from "@/types";
import { Badge, cn } from "@/design/primitives";
import { monthLabel } from "@/lib/format";

export function ScenarioSummary({ scenarios }: { scenarios: ForecastScenarioResult[] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="label-caps text-text-subtle">
          <th className="text-left font-semibold py-1">Scenario</th>
          <th className="text-right font-semibold py-1">Per-site / mo</th>
          <th className="text-right font-semibold py-1">Projected LPI</th>
          <th className="text-right font-semibold py-1">Months</th>
          <th className="text-right font-semibold py-1">Status</th>
        </tr>
      </thead>
      <tbody>
        {scenarios.map((sc) => (
          <tr key={sc.id} className="border-t border-inset">
            <td className={cn("py-2", sc.id === "base" ? "text-primary font-semibold" : "text-ink")}>
              {sc.label}
            </td>
            <td className="py-2 text-right font-mono text-text-muted">
              {sc.perSiteRatePerMonth.toFixed(1)}
            </td>
            <td className="py-2 text-right font-mono text-ink">{monthLabel(sc.lpiDate)}</td>
            <td className="py-2 text-right font-mono text-text-muted">
              {sc.monthsToTarget == null ? "—" : sc.monthsToTarget}
            </td>
            <td className="py-2 text-right">
              <Badge variant={sc.lpiDate == null ? "neutral" : sc.onTrack ? "success" : "error"}>
                {sc.lpiDate == null ? "Unreached" : sc.onTrack ? "On track" : "Behind"}
              </Badge>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
