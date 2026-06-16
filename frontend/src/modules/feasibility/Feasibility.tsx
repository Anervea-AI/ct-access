import { useMemo, useState } from "react";
import { useStore } from "@/state/store";
import { deriveFunnel } from "@/state/selectors";
import { ModuleHeader, AskChip } from "@/app/ModuleHeader";
import { Button, Card, Callout, Kpi, SectionLabel, cn } from "@/design/primitives";
import { DownloadIcon } from "@/design/icons";
import { FunnelBars } from "@/charts/FunnelBars";
import { fmtInt, fmtPct } from "@/lib/format";
import { downloadCsv } from "@/lib/export";
import { api } from "@/lib/api";
import { CriteriaPanel } from "./CriteriaPanel";
import { ProxyPanel } from "./ProxyPanel";
import { GeoSensitivity } from "./GeoSensitivity";
import { ABCompare } from "./ABCompare";

export function Feasibility() {
  const ds = useStore((s) => s.dataset)!;
  const scenario = useStore((s) => s.scenarios[s.activeId]);
  const setProtocol = useStore((s) => s.setProtocol);
  const [exporting, setExporting] = useState(false);

  const funnel = useMemo(() => deriveFunnel(ds, scenario), [ds, scenario]);
  const enabledCount = scenario.criteria.filter((c) => c.enabled).length;
  const poolPct = (funnel.eligiblePool / funnel.totalUniverse) * 100;

  const exportCsv = () => {
    downloadCsv(
      "feasibility-funnel.csv",
      funnel.steps.map((s) => ({
        criterion: s.label, type: s.type, reductionPct: s.reductionPct,
        remaining: s.remaining, pctOfUniverse: s.pct,
      })),
    );
  };

  const exportPdf = async () => {
    setExporting(true);
    try {
      const blob = await api.exportPdf(scenario, "Feasibility Summary");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "alfadev-feasibility-summary.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <ModuleHeader
        code="02"
        priority="Demo"
        title="Protocol feasibility stress-testing"
        blurb="Is this protocol recruitable, and which criterion is hurting us most? Toggle and tune criteria — everything recomputes live."
        actions={
          <>
            <Button variant="secondary" onClick={exportCsv}><DownloadIcon /> CSV</Button>
            <Button variant="primary" onClick={exportPdf} disabled={exporting}>
              <DownloadIcon /> {exporting ? "Exporting…" : "PDF"}
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[20rem_1fr] gap-5">
        {/* Controls */}
        <div className="space-y-4">
          <Card>
            <div className="flex items-center justify-between mb-3">
              <SectionLabel>Protocol version</SectionLabel>
              <div className="flex rounded-md border border-border overflow-hidden">
                {["A", "B"].map((v) => (
                  <button
                    key={v}
                    onClick={() => setProtocol(v)}
                    className={cn(
                      "px-3 py-1 text-sm font-semibold",
                      scenario.protocolVersion === v ? "bg-primary text-white" : "bg-surface text-text-muted hover:bg-hover",
                    )}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
            <CriteriaPanel />
          </Card>
        </div>

        {/* Results */}
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Kpi label="Eligible pool" value={fmtInt(funnel.eligiblePool)} accent="primary" sub={`${fmtPct(poolPct)} of universe`} />
            <Kpi label="Diagnosed universe" value={fmtInt(funnel.totalUniverse)} accent="accent" />
            <Kpi label="Enabled criteria" value={enabledCount} accent="info" />
            <Kpi label="Biggest cut" value={fmtInt(funnel.biggestConstraintRemoved)} accent="accent" sub={fmtPct(funnel.biggestConstraintRemovedPct)} />
          </div>

          <Callout variant="warning" title="Biggest constraint">
            <div className="flex items-center justify-between gap-3">
              <span>
                <b>{funnel.biggestConstraintLabel}</b> removes the most patients
                ({fmtInt(funnel.biggestConstraintRemoved)}, {fmtPct(funnel.biggestConstraintRemovedPct)} of the universe).
              </span>
              <AskChip query={`Which exclusion criterion costs me the most patients, and what proxy are you using?`} label="Explain" />
            </div>
          </Callout>

          <Card>
            <div className="flex items-center justify-between mb-3">
              <SectionLabel>Eligibility funnel</SectionLabel>
              <span className="text-xs text-text-faint">{funnel.steps.length} steps applied sequentially</span>
            </div>
            <FunnelBars result={funnel} />
          </Card>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <Card>
              <div className="flex items-center justify-between mb-3">
                <SectionLabel>Geographic sensitivity</SectionLabel>
                <AskChip query="Which regions unlock if I relax the antipsychotic washout?" label="Ask" />
              </div>
              <GeoSensitivity />
            </Card>

            <Card>
              <SectionLabel className="mb-3">Proxy transparency (psychiatry)</SectionLabel>
              <ProxyPanel />
            </Card>
          </div>

          <Card>
            <SectionLabel className="mb-3">Scenario A / B comparison</SectionLabel>
            <ABCompare />
          </Card>
        </div>
      </div>
    </>
  );
}
