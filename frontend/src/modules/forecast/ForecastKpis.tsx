import type { ForecastResult, EligibilityFunnelResult } from "@/types";
import { Kpi, Badge, Callout } from "@/design/primitives";
import { AskChip } from "@/app/ModuleHeader";
import { fmtInt, monthLabel } from "@/lib/format";

export function ForecastKpis({
  forecast,
  funnel,
}: {
  forecast: ForecastResult;
  funnel: EligibilityFunnelResult;
}) {
  const base = forecast.scenarios.find((s) => s.id === "base")!;
  const sitesNeeded = forecast.sitesNeededForTarget;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Kpi
          label="Projected LPI (base)"
          value={monthLabel(base.lpiDate)}
          accent="primary"
          sub={base.lpiDate ? `${fmtInt(base.targetEnrollment)} enrolled` : "target not reached"}
        />
        <Kpi
          label="Status vs target"
          value={
            <Badge variant={base.onTrack ? "success" : "error"}>
              {base.onTrack ? "On track" : "Behind"}
            </Badge>
          }
          accent={base.onTrack ? "success" : "accent"}
          sub={`target ${monthLabel(base.targetDate)}`}
        />
        <Kpi
          label="Sites needed for target"
          value={sitesNeeded == null ? "Infeasible" : fmtInt(sitesNeeded)}
          accent="info"
          sub={
            sitesNeeded == null
              ? "no site count hits date"
              : `vs ${fmtInt(base.numSites)} planned`
          }
        />
        <Kpi
          label="Eligible pool"
          value={fmtInt(funnel.eligiblePool)}
          accent="accent"
          sub="cascaded from feasibility"
        />
      </div>

      <MilestoneCallout forecast={forecast} />
    </div>
  );
}

function MilestoneCallout({ forecast }: { forecast: ForecastResult }) {
  const base = forecast.scenarios.find((s) => s.id === "base")!;
  const target = monthLabel(base.targetDate);

  if (!base.lpiDate) {
    return (
      <Callout variant="error" title="Target enrollment not reached">
        <div className="flex items-center justify-between gap-3">
          <span>
            At the current plan, the eligible pool is exhausted before reaching{" "}
            <b>{fmtInt(base.targetEnrollment)}</b> patients. Add sites, lower screen-fail, or relax
            criteria upstream.
          </span>
          <AskChip
            query="Why can't I reach my target enrollment, and what would unlock it?"
            label="Diagnose"
          />
        </div>
      </Callout>
    );
  }

  const lpi = monthLabel(base.lpiDate);
  const months = base.monthsToTarget;

  if (base.onTrack) {
    return (
      <Callout variant="success" title="On track to hit last-patient-in">
        <div className="flex items-center justify-between gap-3">
          <span>
            Base scenario reaches <b>{fmtInt(base.targetEnrollment)}</b> by <b>{lpi}</b>
            {months != null && <> ({months} months from open)</>}, ahead of the <b>{target}</b>{" "}
            target.
          </span>
          <AskChip
            query="What's the buffer on my enrollment timeline, and where is the risk?"
            label="Stress-test"
          />
        </div>
      </Callout>
    );
  }

  return (
    <Callout variant="error" title="Behind the target date">
      <div className="flex items-center justify-between gap-3">
        <span>
          Base scenario does not reach <b>{fmtInt(base.targetEnrollment)}</b> until <b>{lpi}</b>,
          after the <b>{target}</b> target. Add sites or improve per-site recruitment to pull it in.
        </span>
        <AskChip
          query="How do I pull my last-patient-in date earlier to hit the target?"
          label="Recover"
        />
      </div>
    </Callout>
  );
}
