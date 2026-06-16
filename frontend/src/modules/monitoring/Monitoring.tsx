import { useMemo, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { useStore } from "@/state/store";
import { deriveMonitoring } from "@/state/selectors";
import { ModuleHeader, AskChip } from "@/app/ModuleHeader";
import { Button, Card, SectionLabel, Kpi, Callout, cn } from "@/design/primitives";
import { ActivityIcon, DownloadIcon } from "@/design/icons";
import { downloadCsv } from "@/lib/export";
import { fmtInt, fmtDelta } from "@/lib/format";
import { MonitoringControls } from "./MonitoringControls";
import { RiskTable, RiskBadge } from "./RiskTable";
import { RescuePanel } from "./RescuePanel";
import { SaturationPanel } from "@/modules/insights/InsightPanels";

export function Monitoring() {
  const ds = useStore((s) => s.dataset)!;
  const scenario = useStore((s) => s.scenarios[s.activeId]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const result = useMemo(() => deriveMonitoring(ds, scenario), [ds, scenario]);
  // recovery what-if: same scenario with rescue sites removed
  const baseline = useMemo(() => {
    const s = structuredClone(scenario);
    s.monitoring.rescueSiteIds = [];
    return deriveMonitoring(ds, s);
  }, [ds, scenario]);

  const recovery = result.studyForecast - baseline.studyForecast;
  const selected = selectedId ? result.sites.find((s) => s.siteId === selectedId) ?? null : null;

  const chartData = result.sites.slice(0, 12).map((s) => ({
    name: s.name.split(" ")[0], planned: s.planned, actual: s.actual, forecast: s.forecast,
  }));

  const exportCsv = () =>
    downloadCsv("monitoring-status.csv", result.sites.map((s) => ({
      site: s.name, region: s.region, planned: s.planned, actual: s.actual,
      forecast: s.forecast, risk: s.risk, predictedShortfall: s.predictedShortfall, rootCause: s.rootCause,
    })));

  return (
    <>
      <ModuleHeader
        code="05"
        priority="P2"
        title="In-flight monitoring & rescue"
        blurb="Is the running trial on track, and how do we fix at-risk sites? Risk flags fire on projected shortfall; simulate rescue sites to recover the timeline."
        actions={
          <>
            <AskChip query="Which sites are most likely to miss target next month, and what's driving it?" label="Try a query" />
            <Button variant="secondary" onClick={exportCsv}><DownloadIcon /> CSV</Button>
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[20rem_1fr] gap-5">
        <div className="space-y-4">
          <Card>
            <SectionLabel className="mb-3">Alert thresholds</SectionLabel>
            <MonitoringControls />
          </Card>
          <Card>
            <div className="flex items-center justify-between mb-3">
              <SectionLabel>Rescue finder</SectionLabel>
              <AskChip query="Simulate adding two sites in Texas — does it recover the timeline?" label="Ask" />
            </div>
            <RescuePanel />
          </Card>
        </div>

        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Kpi label="Planned to date" value={fmtInt(result.studyPlanned)} accent="info" />
            <Kpi label="Actual to date" value={fmtInt(result.studyActual)} accent="primary" />
            <Kpi label="Projected final" value={fmtInt(result.studyForecast)} accent="accent" />
            <Kpi label="At-risk sites" value={result.atRiskCount} accent={result.atRiskCount > 0 ? "accent" : "success"} />
          </div>

          {recovery > 0 && (
            <Callout variant="success" title="Rescue what-if">
              Adding {scenario.monitoring.rescueSiteIds.length} rescue site(s) lifts projected final
              enrollment by <b>{fmtDelta(recovery)}</b> patients (to {fmtInt(result.studyForecast)}).
            </Callout>
          )}

          <Card>
            <div className="flex items-center justify-between mb-3">
              <SectionLabel><span className="inline-flex items-center gap-1.5"><ActivityIcon size={15} className="text-accent" /> Actual vs forecast by site</span></SectionLabel>
              <span className="text-xs text-text-faint">top {chartData.length} by shortfall</span>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 4 }}>
                <CartesianGrid stroke="#f3ecdf" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#94a3b8" }} interval={0} angle={-25} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} width={40} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e7dcc9" }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="planned" name="Planned" fill="#94a3b8" radius={[3, 3, 0, 0]} />
                <Bar dataKey="actual" name="Actual" fill="#c2410c" radius={[3, 3, 0, 0]} />
                <Bar dataKey="forecast" name="Projected" fill="#ffb74d" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card>
            <div className="flex items-center justify-between mb-3">
              <SectionLabel>Competing-trial saturation</SectionLabel>
              <AskChip query="Which states are most saturated with competing trials, and where are investigators over-committed?" label="Ask" />
            </div>
            <SaturationPanel limit={10} />
          </Card>

          <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-5">
            <Card>
              <SectionLabel className="mb-3">Site status</SectionLabel>
              <RiskTable sites={result.sites} selectedId={selectedId} onSelect={setSelectedId} />
            </Card>
            <Card>
              <SectionLabel className="mb-3">Root-cause drill-down</SectionLabel>
              {selected ? (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-display font-bold text-ink">{selected.name}</h4>
                    <RiskBadge risk={selected.risk} />
                  </div>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <Kpi label="Planned" value={fmtInt(selected.planned)} accent="info" />
                    <Kpi label="Actual" value={fmtInt(selected.actual)} accent="primary" />
                    <Kpi label="Projected" value={fmtInt(selected.forecast)} accent="accent" />
                  </div>
                  {selected.predictedShortfall > 0 ? (
                    <Callout variant="warning" title={`Predicted shortfall: ${fmtInt(selected.predictedShortfall)}`}>
                      Likely driver: <b>{selected.rootCause}</b>.
                    </Callout>
                  ) : (
                    <Callout variant="success" title="On track">No predicted shortfall at current pace.</Callout>
                  )}
                </div>
              ) : (
                <p className="text-sm text-text-muted">Select a site in the status table to see its predicted shortfall and likely root cause.</p>
              )}
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
