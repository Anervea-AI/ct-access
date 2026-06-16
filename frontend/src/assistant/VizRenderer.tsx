import {
  Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { EligibilityFunnelResult, ForecastScenarioResult, VizSpec } from "@/types";
import { FunnelBars } from "@/charts/FunnelBars";
import { EnrollmentChart } from "@/charts/EnrollmentChart";
import { DataTable } from "@/design/primitives";

export function VizRenderer({ viz }: { viz: VizSpec }) {
  if (viz.type === "funnel") {
    const result = viz.result as EligibilityFunnelResult;
    return (
      <div className="mt-2 p-3 bg-muted/50 rounded-md">
        <FunnelBars result={result} />
      </div>
    );
  }

  if (viz.type === "bar") {
    const data = (viz.data as { label: string; value: number }[]) ?? [];
    const title = viz.title ? String(viz.title) : null;
    return (
      <div className="mt-2">
        {title ? <div className="label-caps text-text-subtle mb-1">{title}</div> : null}
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 4 }}>
            <CartesianGrid stroke="#f3ecdf" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#6b7280" }} />
            <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} width={48} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e7dcc9" }} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {data.map((_, i) => (
                <Cell key={i} fill={i === 0 ? "#94a3b8" : "#c2410c"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (viz.type === "table") {
    const columns = (viz.columns as string[]) ?? [];
    const rows = ((viz.rows as Record<string, string | number>[]) ?? []).map((r) =>
      columns.map((c) => r[c]),
    );
    return (
      <div className="mt-2 border border-border rounded-md overflow-hidden">
        <DataTable columns={columns} rows={rows} />
      </div>
    );
  }

  if (viz.type === "line") {
    const scenarios = (viz.scenarios as ForecastScenarioResult[]) ?? [];
    return (
      <div className="mt-2">
        <EnrollmentChart scenarios={scenarios} targetEnrollment={Number(viz.targetEnrollment ?? 0)} height={240} showBand />
      </div>
    );
  }

  return null;
}
