import {
  Area, CartesianGrid, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import type { ForecastScenarioResult } from "@/types";
import { monthLabel } from "@/lib/format";

const COLORS: Record<string, string> = {
  base: "#c2410c",
  optimistic: "#16a34a",
  conservative: "#7c2d12",
};

export function EnrollmentChart({
  scenarios, targetEnrollment, showBand = true, height = 320,
}: {
  scenarios: ForecastScenarioResult[];
  targetEnrollment: number;
  showBand?: boolean;
  height?: number;
}) {
  // merge curves on month
  const months = new Map<string, Record<string, number | string>>();
  for (const sc of scenarios) {
    for (const p of sc.curve) {
      const row = months.get(p.month) ?? { month: p.month };
      row[sc.id] = p.cumulative;
      if (sc.id === "base") {
        row.baseLower = p.lower;
        row.baseUpper = p.upper;
      }
      months.set(p.month, row);
    }
  }
  const data = [...months.values()].sort((a, b) => String(a.month).localeCompare(String(b.month)));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
        <CartesianGrid stroke="#f3ecdf" vertical={false} />
        <XAxis dataKey="month" tickFormatter={(m) => monthLabel(String(m))} tick={{ fontSize: 10, fill: "#94a3b8" }} minTickGap={24} />
        <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} width={44} />
        <Tooltip
          labelFormatter={(m) => monthLabel(String(m))}
          contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e7dcc9" }}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {showBand && (
          <Area type="monotone" dataKey="baseUpper" stroke="none" fill="#c2410c" fillOpacity={0.08} name="Confidence band" legendType="none" />
        )}
        {showBand && (
          <Area type="monotone" dataKey="baseLower" stroke="none" fill="#ffffff" fillOpacity={1} legendType="none" name="" />
        )}
        <ReferenceLine y={targetEnrollment} stroke="#1d4ed8" strokeDasharray="4 4" label={{ value: `Target ${targetEnrollment}`, position: "insideTopRight", fontSize: 10, fill: "#1d4ed8" }} />
        {scenarios.map((sc) => (
          <Line
            key={sc.id}
            type="monotone"
            dataKey={sc.id}
            name={sc.label}
            stroke={COLORS[sc.id] ?? "#9a3412"}
            strokeWidth={sc.id === "base" ? 2.5 : 1.5}
            dot={false}
          />
        ))}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
