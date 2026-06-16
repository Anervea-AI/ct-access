import { useMemo, useState } from "react";
import { useStore } from "@/state/store";
import { derivePopulation } from "@/state/selectors";
import { ModuleHeader, AskChip } from "@/app/ModuleHeader";
import { Button, Card, SectionLabel, Kpi } from "@/design/primitives";
import { DownloadIcon, LayersIcon } from "@/design/icons";
import { downloadCsv } from "@/lib/export";
import { fmtInt } from "@/lib/format";
import { PopulationControls } from "./PopulationControls";
import { IndicationBoard } from "./IndicationBoard";
import { PrioritizationMatrix } from "./PrioritizationMatrix";
import { DistributionsPanel } from "@/modules/insights/InsightPanels";

export function Population() {
  const ds = useStore((s) => s.dataset)!;
  const scenario = useStore((s) => s.scenarios[s.activeId]);
  const cohort = scenario.cohort;

  const result = useMemo(() => derivePopulation(ds, scenario), [ds, scenario]);
  const inds = result.indications;

  const totalDx = inds.reduce((a, i) => a + i.diagnosed, 0);
  const totalTx = inds.reduce((a, i) => a + i.treated, 0);
  const totalElig = inds.reduce((a, i) => a + i.trialEligible, 0);

  const exportCsv = () =>
    downloadCsv("population-sizing.csv", inds.map((i) => ({
      indication: i.label, diagnosed: i.diagnosed, treated: i.treated,
      trialEligible: i.trialEligible, competingTrialDensity: i.competingTrialDensity,
      feasibilityScore: i.feasibilityScore, region: i.region,
    })));

  return (
    <>
      <ModuleHeader
        code="06"
        priority="P3"
        title="Population sizing & indication prioritization"
        blurb="Which indications should the portfolio pursue, and how big is each opportunity? Edit the cohort once — every indication's funnel updates simultaneously."
        actions={
          <>
            <AskChip query="Rank these indications by population size and inverse trial competition" label="Try a query" />
            <Button variant="secondary" onClick={exportCsv}><DownloadIcon /> CSV</Button>
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[20rem_1fr] gap-5">
        <div className="space-y-4">
          <Card>
            <SectionLabel className="mb-3">Cohort & axes</SectionLabel>
            <PopulationControls />
          </Card>
        </div>

        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Kpi label="Indications" value={inds.length} accent="primary" />
            <Kpi label="Total diagnosed" value={fmtInt(totalDx)} accent="accent" />
            <Kpi label="Total treated" value={fmtInt(totalTx)} accent="info" />
            <Kpi label="Total trial-eligible" value={fmtInt(totalElig)} accent="success" sub={`cohort ${cohort.minAge}–${cohort.maxAge}, ${cohort.region}`} />
          </div>

          <Card>
            <div className="flex items-center justify-between mb-3">
              <SectionLabel><span className="inline-flex items-center gap-1.5"><LayersIcon size={15} className="text-accent" /> Indication comparison</span></SectionLabel>
              <AskChip query="Compare treated addressable population across indications for bipolar I depression by region" label="Compare" />
            </div>
            <IndicationBoard indications={inds} />
          </Card>

          <Card>
            <div className="flex items-center justify-between mb-3">
              <SectionLabel>Prioritization matrix</SectionLabel>
              <span className="text-xs text-text-faint">bubble size = diagnosed population</span>
            </div>
            <PrioritizationMatrix indications={inds} xKey={cohort.matrixX} yKey={cohort.matrixY} />
          </Card>

          <Card>
            <div className="flex items-center justify-between mb-3">
              <SectionLabel>Cohort distributions</SectionLabel>
              <AskChip query="What is the real age and payer breakdown of the diagnosed population?" label="Ask" />
            </div>
            <DistributionsPanel />
          </Card>
        </div>
      </div>
    </>
  );
}
