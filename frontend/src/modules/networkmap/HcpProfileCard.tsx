// Inline HCP profile, rendered in the Site & PI "scorecard" slot when an HCP is
// selected on the map (the site scorecard shows site details otherwise). Clicking a
// top-referral connection re-selects that HCP (which also re-centers the map network).
import { useEffect, useState } from "react";
import type { HcpProfile } from "@/types";
import { api } from "@/lib/api";
import { Badge, Kpi, SectionLabel, Spinner } from "@/design/primitives";
import { fmtInt } from "@/lib/format";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (value == null || value === "") return null;
  return (
    <div className="flex justify-between gap-3 text-xs py-0.5">
      <span className="text-text-muted">{label}</span>
      <span className="text-ink text-right">{value}</span>
    </div>
  );
}

export function HcpProfileCard({ npi, onSelectHcp, onClose }: {
  npi: number;
  onSelectHcp: (npi: number) => void;
  onClose: () => void;
}) {
  const [profile, setProfile] = useState<HcpProfile | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setProfile(null);
    api.hcpProfile(npi)
      .then((p) => { if (alive) setProfile(p); })
      .catch(() => { if (alive) setProfile(null); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [npi]);

  if (loading) {
    return <div className="py-10 flex items-center justify-center gap-2 text-text-muted text-sm"><Spinner /> Loading profile…</div>;
  }
  if (!profile) {
    return <p className="text-sm text-text-muted py-6">Couldn't load this provider's profile.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-display font-bold text-ink text-lg leading-tight">{profile.name}</h3>
          <div className="text-xs text-text-muted mt-0.5">
            {profile.specialty}{profile.specialty ? " · " : ""}{profile.region}
          </div>
          <div className="text-[11px] font-mono text-text-faint mt-0.5">NPI {profile.npi}</div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-xs font-semibold text-primary hover:text-primary-deep shrink-0"
        >
          ← Back to site
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Kpi label="Patient volume" value={fmtInt(profile.patientCount)} accent="primary" />
        <Kpi label="Decile" value={profile.decile} accent="accent" />
        <Kpi label="Referral degree" value={profile.referralDegree} accent="info" sub={`${profile.outboundConnections} out · ${profile.inboundConnections} in`} />
        <Kpi label="Trials" value={profile.trials.length} accent={profile.trials.length ? "success" : "info"} />
      </div>

      <div>
        <SectionLabel className="mb-1.5">Affiliation <span className="normal-case text-text-faint">· NPPES / RWD</span></SectionLabel>
        <div className="bg-muted rounded-md px-3 py-2">
          <Row label="HCO" value={profile.primaryHcoName} />
          <Row label="Type" value={profile.primaryHcoFacilityType} />
          <Row label="Classification" value={profile.primaryHcoClassification} />
          <Row label="Address" value={profile.primaryHcoAddress} />
          <Row label="City/State" value={[profile.primaryHcoCity, profile.primaryHcoState].filter(Boolean).join(", ")} />
          <Row label="ZIP" value={profile.primaryHcoZip} />
          <Row label="HCO NPI" value={profile.primaryHcoNpi} />
        </div>
      </div>

      {profile.topReferrals.length > 0 && (
        <div>
          <SectionLabel className="mb-1.5">Top referral connections</SectionLabel>
          <div className="space-y-1">
            {profile.topReferrals.map((r) => (
              <button
                key={r.npi}
                type="button"
                onClick={() => onSelectHcp(r.npi)}
                className="w-full text-left bg-muted hover:bg-inset rounded-md px-3 py-1.5 transition-colors"
              >
                <div className="flex justify-between items-center gap-2">
                  <span className="text-xs font-medium text-primary truncate">{r.name}</span>
                  <span className="text-[11px] font-mono text-text-muted shrink-0">{(r.shareOut * 100).toFixed(0)}%→</span>
                </div>
                {r.specialty && <div className="text-[11px] text-text-muted">{r.specialty}</div>}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <SectionLabel className="mb-1.5">Trial history <span className="normal-case text-text-faint">· ClinicalTrials.gov</span></SectionLabel>
        {profile.trials.length === 0 ? (
          <p className="text-xs text-text-muted bg-muted rounded-md px-3 py-2">
            No clinical-trial investigator history — a net-new (untapped) PI candidate.
          </p>
        ) : (
          <div className="space-y-1.5">
            {profile.trials.map((t) => (
              <div key={t.id} className="bg-muted rounded-md px-3 py-2">
                <div className="text-xs text-ink line-clamp-2">{t.title || t.id}</div>
                <div className="flex items-center gap-1.5 mt-1">
                  {t.phase && <Badge variant="neutral">{t.phase}</Badge>}
                  {t.status && <Badge variant={t.status.toLowerCase().includes("recruit") || t.status.toLowerCase() === "open" ? "success" : "neutral"}>{t.status}</Badge>}
                  <span className="text-[11px] font-mono text-text-faint">{t.id}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
