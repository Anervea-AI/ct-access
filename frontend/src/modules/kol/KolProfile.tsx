import type { Kol } from "@/types";
import { useStore } from "@/state/store";
import { Badge } from "@/design/primitives";
import { titleCase, fmtScore } from "@/lib/format";

const SIGNAL_KEYS = [
  "patientVolume", "referralCentrality", "referralReach",
  "trialLeadership", "trialRecency", "specialtyFit",
] as const;

const SIGNAL_LABEL: Record<string, string> = {
  patientVolume: "Patient volume",
  referralCentrality: "Referral centrality",
  referralReach: "Referral reach (PageRank)",
  trialLeadership: "Trial leadership",
  trialRecency: "Trial recency",
  specialtyFit: "Specialty fit",
};

const SEGMENT_LABEL: Record<string, string> = {
  established: "Established KOL",
  rising_star: "Rising star",
  dol: "Digital opinion leader",
};

export function KolProfile({ kol }: { kol: Kol | null }) {
  const ds = useStore((s) => s.dataset)!;
  if (!kol) {
    return <p className="text-sm text-text-muted">Select a node in the network or a row in the table to see the KOL profile and contributing signals.</p>;
  }
  const signals = kol.signals as unknown as Record<string, number>;
  const top = [...SIGNAL_KEYS].sort((a, b) => signals[b] - signals[a]).slice(0, 3);
  const linkedSites = ds.sites.filter((s) => kol.linkedSiteIds.includes(s.id));

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-1">
        <h4 className="font-display font-bold text-ink">{kol.name}</h4>
        <span className="kpi-number text-2xl text-primary">{fmtScore(kol.score)}</span>
      </div>
      <div className="flex items-center gap-2 mb-3">
        <Badge variant={kol.segment === "rising_star" ? "warning" : kol.segment === "dol" ? "gold" : "primary"}>
          {SEGMENT_LABEL[kol.segment]}
        </Badge>
        <span className="text-xs text-text-muted">{kol.specialty} · {kol.region}</span>
      </div>
      {(kol.npi || kol.trialCount > 0) && (
        <div className="text-xs text-text-muted mb-3 -mt-2">
          {kol.npi ? <span className="font-mono">NPI {kol.npi}</span> : null}
          {kol.npi && kol.trialCount > 0 ? " · " : ""}
          {kol.trialCount > 0 ? `${kol.trialCount} trial${kol.trialCount > 1 ? "s" : ""} led` : ""}
        </div>
      )}

      <div className="label-caps text-text-subtle mb-1.5">Signal profile</div>
      <div className="space-y-1.5">
        {SIGNAL_KEYS.map((k) => (
          <div key={k}>
            <div className="flex justify-between text-xs mb-0.5">
              <span className={top.includes(k) ? "text-primary font-semibold" : "text-ink"}>{SIGNAL_LABEL[k] ?? titleCase(k)}</span>
              <span className="font-mono text-text-muted">{signals[k].toFixed(2)}</span>
            </div>
            <div className="h-2 bg-inset rounded-sm overflow-hidden">
              <div className={top.includes(k) ? "h-full bg-accent" : "h-full bg-primary"} style={{ width: `${signals[k] * 100}%` }} />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 text-xs text-text-muted">
        <span className="label-caps text-text-subtle">Top signals: </span>
        {top.map((t) => SIGNAL_LABEL[t] ?? titleCase(t)).join(", ")}
      </div>

      {linkedSites.length > 0 && (
        <div className="mt-3 border-t border-inset pt-2">
          <div className="label-caps text-text-subtle mb-1">Linked sites (→ Module 01)</div>
          <div className="flex flex-wrap gap-1">
            {linkedSites.map((s) => <Badge key={s.id} variant="neutral">{s.name}</Badge>)}
          </div>
        </div>
      )}
    </div>
  );
}
