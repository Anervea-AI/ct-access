import { useMemo } from "react";
import { useStore } from "@/state/store";
import { deriveForecast, deriveFunnel, deriveSites } from "@/state/selectors";
import { ModuleHeader, AskChip } from "@/app/ModuleHeader";
import { Button, Card, SectionLabel, Callout } from "@/design/primitives";
import { DownloadIcon, LineChartIcon } from "@/design/icons";
import { EnrollmentChart } from "@/charts/EnrollmentChart";
import { fmtInt, monthLabel } from "@/lib/format";
import { downloadCsv } from "@/lib/export";
import { ForecastControls } from "./ForecastControls";
import { ForecastKpis } from "./ForecastKpis";
import { ScenarioSummary } from "./ScenarioSummary";
import { SiteAllocation } from "./SiteAllocation";

export function Forecast() {
  const ds = useStore((s) => s.dataset)!;
  const scenario = useStore((s) => s.scenarios[s.activeId]);

  const forecast = useMemo(() => deriveForecast(ds, scenario), [ds, scenario]);
  const funnel = useMemo(() => deriveFunnel(ds, scenario), [ds, scenario]);
  const sites = useMemo(() => deriveSites(ds, scenario), [ds, scenario]);

  const base = forecast.scenarios.find((s) => s.id === "base")!;
  const sitesNeeded = forecast.sitesNeededForTarget;

  const exportCurveCsv = () => {
    downloadCsv(
      "forecast-base-curve.csv",
      base.curve.map((p) => ({
        month: p.month,
        cumulative: p.cumulative,
        lower: p.lower,
        upper: p.upper,
      })),
    );
  };

  return (
    <>
      <ModuleHeader
        code="03"
        priority="Demo"
        title="Enrollment forecasting"
        blurb="Will this trial finish on time, and how many sites does it take? Tune the recruitment plan — base, optimistic, and conservative curves recompute live."
        actions={
          <>
            <AskChip
              query="Show the forecast if screen-fail rises to 35%"
              label="Screen-fail 35%"
            />
            <Button variant="secondary" onClick={exportCurveCsv}>
              <DownloadIcon /> Curve CSV
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[20rem_1fr] gap-5">
        {/* Controls */}
        <div className="space-y-4">
          <Card>
            <SectionLabel className="mb-3">Recruitment plan</SectionLabel>
            <ForecastControls />
          </Card>
        </div>

        {/* Results */}
        <div className="space-y-5">
          <ForecastKpis forecast={forecast} funnel={funnel} />

          <Card>
            <div className="flex items-center justify-between mb-3">
              <SectionLabel>
                <span className="inline-flex items-center gap-1.5">
                  <LineChartIcon size={15} className="text-accent" /> Enrollment projection
                </span>
              </SectionLabel>
              <span className="text-xs text-text-faint">
                base · optimistic · conservative + confidence band
              </span>
            </div>
            <EnrollmentChart
              scenarios={forecast.scenarios}
              targetEnrollment={base.targetEnrollment}
              showBand
              height={320}
            />
          </Card>

          <Callout
            variant={sitesNeeded == null ? "error" : sitesNeeded <= base.numSites ? "success" : "warning"}
            title="Sites needed to hit the target date"
          >
            <div className="flex items-center justify-between gap-3">
              <span>
                {sitesNeeded == null ? (
                  <>
                    No site count up to the search ceiling reaches{" "}
                    <b>{fmtInt(base.targetEnrollment)}</b> by <b>{monthLabel(base.targetDate)}</b> —
                    the eligible pool or per-site rate is the binding constraint.
                  </>
                ) : (
                  <>
                    You need <b>{fmtInt(sitesNeeded)}</b> sites to reach{" "}
                    <b>{fmtInt(base.targetEnrollment)}</b> by <b>{monthLabel(base.targetDate)}</b>.
                    Your plan currently activates <b>{fmtInt(base.numSites)}</b>.
                  </>
                )}
              </span>
              <AskChip
                query="If I need last-patient-in by March 2027, how many sites do I need and where?"
                label="Plan sites"
              />
            </div>
          </Callout>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <Card>
              <SectionLabel className="mb-3">Scenario comparison</SectionLabel>
              <ScenarioSummary scenarios={forecast.scenarios} />
            </Card>

            <Card>
              <div className="flex items-center justify-between mb-3">
                <SectionLabel>Eligible pool context</SectionLabel>
              </div>
              <p className="text-sm text-text-muted">
                The forecast draws from a cascaded eligible pool of{" "}
                <b className="text-ink">{fmtInt(funnel.eligiblePool)}</b> patients (from the
                feasibility funnel). Cumulative enrollment is capped by this pool, so tightening
                criteria upstream directly lowers the ceiling on every curve.
              </p>
              <div className="mt-3">
                <AskChip
                  query="How does my eligible pool limit the enrollment curve?"
                  label="Explain the cap"
                />
              </div>
            </Card>
          </div>

          <Card>
            <SectionLabel className="mb-3">Per-site allocation</SectionLabel>
            <SiteAllocation
              rankedSites={sites.sites}
              numSites={scenario.forecast.numSites}
              targetEnrollment={base.targetEnrollment}
            />
          </Card>
        </div>
      </div>
    </>
  );
}
