import type { Site } from "@/types";
import { Badge, SectionLabel, Heading, cn } from "@/design/primitives";
import { PlusIcon, MapPinIcon } from "@/design/icons";
import { AskChip } from "@/app/ModuleHeader";
import { fmtInt, fmtPct, fmtScore } from "@/lib/format";

const DEMO_ROWS: { key: keyof Site["demographics"]; label: string }[] = [
  { key: "blackPct", label: "Black" },
  { key: "hispanicPct", label: "Hispanic" },
  { key: "asianPct", label: "Asian" },
  { key: "whitePct", label: "White" },
  { key: "femalePct", label: "Female" },
  { key: "ruralPct", label: "Rural" },
];

function Stat({ label, value, mono = true }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="bg-muted rounded-md px-3 py-2">
      <div className="label-caps text-text-subtle">{label}</div>
      <div className={cn("text-base text-ink mt-0.5", mono && "font-mono font-semibold")}>{value}</div>
    </div>
  );
}

export function SiteDetail({
  site, rank, inShortlist, onToggleShortlist,
}: {
  site: Site | null;
  rank: number | null;
  inShortlist: boolean;
  onToggleShortlist: (id: string) => void;
}) {
  if (!site) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-10 text-text-muted">
        <MapPinIcon size={26} className="text-border-strong mb-2" />
        <p className="text-sm">Select a site on the map or in the leaderboard to inspect its scorecard.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            {rank != null && <Badge variant={rank <= 3 ? "gold" : "neutral"}>#{rank}</Badge>}
            <span className="text-xs text-text-muted">{site.state} · {site.region}</span>
          </div>
          <Heading>{site.name}</Heading>
          {(site.status || site.city) && (
            <div className="flex items-center gap-2 mt-1">
              {site.status && (
                <Badge variant={site.status.toLowerCase() === "recruiting" ? "success" : "neutral"}>
                  {site.status}
                </Badge>
              )}
              {site.city && <span className="text-xs text-text-muted">{site.city}, {site.state}</span>}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => onToggleShortlist(site.id)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold shrink-0 transition-colors",
            inShortlist
              ? "bg-primary text-white border-primary"
              : "bg-surface text-primary border-primary hover:bg-primary hover:text-white",
          )}
        >
          <PlusIcon size={13} />{inShortlist ? "Shortlisted" : "Shortlist"}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Stat label="Composite score" value={fmtScore(site.score)} />
        <Stat label="Eligible patients" value={fmtInt(site.eligiblePatients)} />
        <Stat label="PI experience" value={`${site.piExperienceTrials} trials`} />
        <Stat label="Indication Rx volume" value={fmtInt(site.indicationRxVolume)} />
        <Stat label="Competing trials" value={site.competingTrials} />
        <Stat label="Diversity fit" value={fmtPct(site.diversityFit * 100)} />
      </div>

      <div>
        <SectionLabel className="mb-1.5">Specialties</SectionLabel>
        <div className="flex flex-wrap gap-1.5">
          {site.specialties.map((sp) => <Badge key={sp} variant="info">{sp}</Badge>)}
        </div>
      </div>

      <div>
        <SectionLabel className="mb-1.5">Catchment demographics</SectionLabel>
        <div className="grid grid-cols-3 gap-x-4 gap-y-1.5">
          {DEMO_ROWS.map((d) => (
            <div key={d.key} className="flex items-center justify-between text-xs">
              <span className="text-text-muted">{d.label}</span>
              <span className="font-mono text-ink">{fmtPct(site.demographics[d.key])}</span>
            </div>
          ))}
        </div>
      </div>

      {(site.primaryContact || site.phone || site.email || site.npi) && (
        <div className="border-t border-inset pt-2">
          <SectionLabel className="mb-1.5">Site contact <span className="text-text-faint normal-case">· ClinicalTrials.gov</span></SectionLabel>
          <div className="space-y-0.5 text-xs">
            {site.primaryContact && <div className="text-ink">{site.primaryContact}</div>}
            {site.phone && <div className="text-text-muted font-mono">{site.phone}</div>}
            {site.email && <div className="text-text-muted">{site.email}</div>}
            {site.npi && <div className="text-text-faint font-mono">NPI {site.npi}</div>}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 pt-1">
        <span className="text-[11px] text-text-faint">Composite of catchment, PI experience, Rx volume — minus competing-trial drag.</span>
        <AskChip query={`Why is ${site.name} ranked where it is, and what would move it up?`} label="Explain rank" />
      </div>
    </div>
  );
}
