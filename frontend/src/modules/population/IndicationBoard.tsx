import type { IndicationOpportunity } from "@/types";
import { Badge } from "@/design/primitives";
import { fmtInt, fmtScore } from "@/lib/format";

export function IndicationBoard({ indications }: { indications: IndicationOpportunity[] }) {
  const maxDiag = Math.max(1, ...indications.map((i) => i.diagnosed));
  return (
    <div className="space-y-4">
      {indications.map((ind) => {
        const treatedPct = (ind.treated / ind.diagnosed) * 100;
        const eligPct = (ind.trialEligible / ind.diagnosed) * 100;
        const widthPct = (ind.diagnosed / maxDiag) * 100;
        return (
          <div key={ind.id}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-semibold text-ink">{ind.label}</span>
              <div className="flex items-center gap-1.5">
                <Badge variant="info">feas {fmtScore(ind.feasibilityScore)}</Badge>
                <Badge variant={ind.competingTrialDensity > 0.6 ? "error" : "neutral"}>
                  comp {fmtScore(ind.competingTrialDensity)}
                </Badge>
              </div>
            </div>
            {/* nested funnel bar: diagnosed (track) -> treated -> trial-eligible */}
            <div className="h-6 bg-inset rounded-sm overflow-hidden relative" style={{ width: `${Math.max(20, widthPct)}%` }}>
              <div className="absolute inset-y-0 left-0 bg-primary-deep/30" style={{ width: "100%" }} title={`Diagnosed ${fmtInt(ind.diagnosed)}`} />
              <div className="absolute inset-y-0 left-0 bg-primary/60" style={{ width: `${treatedPct}%` }} title={`Treated ${fmtInt(ind.treated)}`} />
              <div className="absolute inset-y-0 left-0 bg-accent" style={{ width: `${eligPct}%` }} title={`Trial-eligible ${fmtInt(ind.trialEligible)}`} />
            </div>
            <div className="flex gap-4 text-[11px] text-text-muted mt-0.5 font-mono">
              <span>dx {fmtInt(ind.diagnosed)}</span>
              <span className="text-primary">tx {fmtInt(ind.treated)}</span>
              <span className="text-accent">elig {fmtInt(ind.trialEligible)}</span>
            </div>
          </div>
        );
      })}
      <div className="flex gap-4 text-[10px] text-text-muted border-t border-inset pt-2">
        <span className="flex items-center gap-1"><span className="w-3 h-2 inline-block rounded-sm bg-primary-deep/30" /> diagnosed</span>
        <span className="flex items-center gap-1"><span className="w-3 h-2 inline-block rounded-sm bg-primary/60" /> treated</span>
        <span className="flex items-center gap-1"><span className="w-3 h-2 inline-block rounded-sm bg-accent" /> trial-eligible</span>
      </div>
    </div>
  );
}
