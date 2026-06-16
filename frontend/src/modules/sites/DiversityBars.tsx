import { cn } from "@/design/primitives";
import { fmtPct } from "@/lib/format";

const ROWS: { key: string; label: string }[] = [
  { key: "blackPct", label: "Black" },
  { key: "hispanicPct", label: "Hispanic" },
  { key: "asianPct", label: "Asian" },
  { key: "femalePct", label: "Female" },
];

export function DiversityBars({
  representativeness, diseaseDistribution,
}: {
  representativeness: Record<string, number>;
  diseaseDistribution: Record<string, number>;
}) {
  const max = Math.max(
    1,
    ...ROWS.flatMap((r) => [representativeness[r.key] ?? 0, diseaseDistribution[r.key] ?? 0]),
  );

  const hasData = Object.keys(representativeness).length > 0;

  if (!hasData) {
    return <p className="text-sm text-text-muted">No sites in the current set — adjust filters to see representativeness.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 text-[10px] text-text-muted">
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-2 bg-primary rounded-sm" /> selected set (enrollment-weighted)</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-2 bg-gold rounded-sm" /> disease prevalence target</span>
      </div>
      {ROWS.map((r) => {
        const rep = representativeness[r.key] ?? 0;
        const target = diseaseDistribution[r.key] ?? 0;
        const gap = rep - target;
        const meets = rep >= target;
        return (
          <div key={r.key}>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-ink">{r.label}</span>
              <span className="font-mono text-text-muted">
                {fmtPct(rep)} vs {fmtPct(target)}
                <span className={cn("ml-1", meets ? "text-success-text" : "text-error-text")}>
                  ({gap >= 0 ? "+" : "−"}{Math.abs(gap).toFixed(1)}pt)
                </span>
              </span>
            </div>
            <div className="space-y-1">
              <div className="h-2.5 bg-inset rounded-sm overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${(rep / max) * 100}%` }} />
              </div>
              <div className="h-2.5 bg-inset rounded-sm overflow-hidden">
                <div className="h-full bg-gold" style={{ width: `${(target / max) * 100}%` }} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
