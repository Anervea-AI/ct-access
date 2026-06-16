import type { EligibilityFunnelResult } from "@/types";
import { fmtInt } from "@/lib/format";
import { cn } from "@/design/primitives";

export function FunnelBars({
  result, highlightId,
}: {
  result: EligibilityFunnelResult;
  highlightId?: string | null;
}) {
  const { steps, totalUniverse } = result;
  const biggest = highlightId ?? result.biggestConstraintId;
  return (
    <div className="space-y-1.5">
      {steps.map((s) => {
        const pct = (s.remaining / totalUniverse) * 100;
        const isBiggest = s.criterionId === biggest;
        const isExcl = s.type === "exclusion";
        return (
          <div key={s.criterionId} className="group">
            <div className="flex items-center justify-between text-xs mb-0.5">
              <span className={cn("truncate pr-2", isBiggest ? "text-accent font-semibold" : "text-ink")}>
                {s.label}
                {isExcl && <span className="ml-1 text-text-faint">(excl.)</span>}
              </span>
              <span className="font-mono text-text-muted shrink-0">
                {fmtInt(s.remaining)} · {pct.toFixed(1)}%
              </span>
            </div>
            <div className="h-5 bg-inset rounded-sm overflow-hidden relative">
              <div
                className={cn(
                  "h-full rounded-sm transition-all duration-200",
                  isBiggest ? "bg-accent" : isExcl ? "bg-primary-deep" : "bg-primary",
                )}
                style={{ width: `${Math.max(1, pct)}%` }}
              />
              {s.reductionPct > 0 && (
                <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-text-muted">
                  −{s.reductionPct.toFixed(1)}%
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
