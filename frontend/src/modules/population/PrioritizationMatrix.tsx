import {
  CartesianGrid, Cell, ResponsiveContainer, Scatter, ScatterChart, Tooltip,
  XAxis, YAxis, ZAxis, LabelList,
} from "recharts";
import type { IndicationOpportunity } from "@/types";
import { METRICS } from "./PopulationControls";

const COLORS = ["#c2410c", "#ffb74d", "#9a3412", "#7c2d12", "#6366f1"];

function metricLabel(key: string): string {
  return METRICS.find((m) => m.value === key)?.label ?? key;
}

export function PrioritizationMatrix({
  indications, xKey, yKey,
}: {
  indications: IndicationOpportunity[];
  xKey: string;
  yKey: string;
}) {
  const data = indications.map((ind, i) => {
    const rec = ind as unknown as Record<string, number>;
    return {
      x: rec[xKey], y: rec[yKey], z: ind.diagnosed,
      label: ind.label, color: COLORS[i % COLORS.length],
    };
  });

  return (
    <ResponsiveContainer width="100%" height={320}>
      <ScatterChart margin={{ top: 16, right: 24, bottom: 28, left: 8 }}>
        <CartesianGrid stroke="#f3ecdf" />
        <XAxis
          type="number" dataKey="x" name={metricLabel(xKey)}
          tick={{ fontSize: 10, fill: "#94a3b8" }}
          label={{ value: metricLabel(xKey), position: "insideBottom", offset: -16, fontSize: 11, fill: "#6b7280" }}
        />
        <YAxis
          type="number" dataKey="y" name={metricLabel(yKey)}
          tick={{ fontSize: 10, fill: "#94a3b8" }} width={56}
          label={{ value: metricLabel(yKey), angle: -90, position: "insideLeft", fontSize: 11, fill: "#6b7280" }}
        />
        <ZAxis type="number" dataKey="z" range={[120, 900]} />
        <Tooltip
          cursor={{ strokeDasharray: "3 3" }}
          contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e7dcc9" }}
          formatter={(v: number, n: string) => [typeof v === "number" ? v.toLocaleString() : v, n]}
        />
        <Scatter data={data}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.color} fillOpacity={0.75} />
          ))}
          <LabelList dataKey="label" position="top" style={{ fontSize: 10, fill: "#2c2118" }} />
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  );
}
