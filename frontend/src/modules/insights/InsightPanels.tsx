// New-insight panels (real RWD): untapped high-volume PIs, competing-trial
// saturation, and geographic whitespace + diversity gap. All read from the
// dataset the backend ships (db builder precomputes these collections).
import { useMemo } from "react";
import { useStore } from "@/state/store";
import { Callout, SectionLabel } from "@/design/primitives";
import { AskChip } from "@/app/ModuleHeader";
import { fmtInt, fmtPct } from "@/lib/format";

function isReal(dataSource: string | undefined) {
  return dataSource === "db";
}

export function UntappedPIsPanel({ limit = 10 }: { limit?: number }) {
  const ds = useStore((s) => s.dataset)!;
  const rows = useMemo(
    () => [...(ds.untappedPIs ?? [])].sort((a, b) => b.patientCount - a.patientCount).slice(0, limit),
    [ds.untappedPIs, limit],
  );

  if (!isReal(ds.dataSource) || !rows.length) {
    return (
      <Callout variant="info" title="Untapped PIs need the real dataset">
        Build the RWD database (<code>python -m app.data.etl</code>) to surface high-volume
        providers with no trial history.
      </Callout>
    );
  }

  return (
    <div>
      <p className="text-xs text-text-muted mb-2">
        High-volume providers (top deciles) with <b>no clinical-trial history</b> — net-new PI
        candidates, ranked by patient volume. Source: NPI decile counts ⋈ ClinicalTrials.gov (anti-join).
      </p>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="bg-muted text-text-subtle label-caps text-left px-3 py-2">Provider</th>
              <th className="bg-muted text-text-subtle label-caps text-left px-3 py-2">Specialty</th>
              <th className="bg-muted text-text-subtle label-caps text-left px-3 py-2">State</th>
              <th className="bg-muted text-text-subtle label-caps text-right px-3 py-2">Patients</th>
              <th className="bg-muted text-text-subtle label-caps text-right px-3 py-2">Decile</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.npi} className="border-t border-inset hover:bg-muted/60">
                <td className="px-3 py-2 whitespace-nowrap font-medium text-primary">{p.name}</td>
                <td className="px-3 py-2 text-text-muted">{p.specialty}</td>
                <td className="px-3 py-2 text-ink">{p.state}</td>
                <td className="px-3 py-2 text-right font-mono text-ink">{fmtInt(p.patientCount)}</td>
                <td className="px-3 py-2 text-right font-mono text-text-muted">{p.decile}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function SaturationPanel({ limit = 10 }: { limit?: number }) {
  const ds = useStore((s) => s.dataset)!;
  const rows = useMemo(
    () => (ds.saturation ?? []).filter((s) => s.dimension === "state").slice(0, limit),
    [ds.saturation, limit],
  );
  const overCommitted = useMemo(
    () => (ds.saturation ?? []).filter((s) => s.dimension === "state").reduce((a, s) => a + s.overCommitted, 0),
    [ds.saturation],
  );

  if (!isReal(ds.dataSource) || !rows.length) {
    return (
      <Callout variant="info" title="Saturation needs the real dataset">
        Build the RWD database to analyze competing-trial density and investigator load.
      </Callout>
    );
  }

  return (
    <div>
      <p className="text-xs text-text-muted mb-2">
        Competing-trial density and investigator load by state.{" "}
        <b>{overCommitted}</b> investigators are over-committed (&gt;3 concurrent trials).
        Source: ClinicalTrials.gov investigator rows.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="bg-muted text-text-subtle label-caps text-left px-3 py-2">State</th>
              <th className="bg-muted text-text-subtle label-caps text-right px-3 py-2">Trials</th>
              <th className="bg-muted text-text-subtle label-caps text-right px-3 py-2">Investigators</th>
              <th className="bg-muted text-text-subtle label-caps text-right px-3 py-2">Over-committed</th>
              <th className="bg-muted text-text-subtle label-caps text-left px-3 py-2">Density</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.key} className="border-t border-inset hover:bg-muted/60">
                <td className="px-3 py-2 font-medium text-ink">{s.key}</td>
                <td className="px-3 py-2 text-right font-mono text-ink">{s.trials}</td>
                <td className="px-3 py-2 text-right font-mono text-text-muted">{s.investigators}</td>
                <td className="px-3 py-2 text-right font-mono text-accent">{s.overCommitted || "—"}</td>
                <td className="px-3 py-2">
                  <div className="h-2 bg-inset rounded-sm overflow-hidden w-24">
                    <div className="h-full bg-primary" style={{ width: `${s.competingDensity * 100}%` }} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MiniBars({ data, fmt }: { data: [string, number][]; fmt: (n: number) => string }) {
  const max = Math.max(1, ...data.map(([, v]) => v));
  return (
    <div className="space-y-1.5">
      {data.map(([label, v]) => (
        <div key={label}>
          <div className="flex justify-between text-xs mb-0.5">
            <span className="text-ink">{label}</span>
            <span className="font-mono text-text-muted">{fmt(v)}</span>
          </div>
          <div className="h-2 bg-inset rounded-sm overflow-hidden">
            <div className="h-full bg-primary" style={{ width: `${(v / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function DistributionsPanel() {
  const ds = useStore((s) => s.dataset)!;
  const dist = ds.distributions;
  if (!dist) {
    return (
      <Callout variant="info" title="Distributions need the dataset">
        No real distribution data is loaded.
      </Callout>
    );
  }
  const age: [string, number][] = dist.ageHistogram.filter((b) => b.count > 0).map((b) => [b.band, b.count]);
  const gender: [string, number][] = Object.entries(dist.genderSplit).sort((a, b) => b[1] - a[1]);
  const payer: [string, number][] = Object.entries(dist.payerMix).sort((a, b) => b[1] - a[1]);
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
      <div>
        <SectionLabel className="mb-2">Age band {isReal(ds.dataSource) && <span className="text-text-faint normal-case">· RWD</span>}</SectionLabel>
        <MiniBars data={age} fmt={fmtInt} />
      </div>
      <div>
        <SectionLabel className="mb-2">Gender</SectionLabel>
        <MiniBars data={gender} fmt={(v) => fmtPct(v * 100)} />
      </div>
      <div>
        <SectionLabel className="mb-2">Payer mix</SectionLabel>
        <MiniBars data={payer} fmt={(v) => fmtPct(v * 100)} />
      </div>
    </div>
  );
}

export function WhitespaceInsight({ limit = 8 }: { limit?: number }) {
  const ds = useStore((s) => s.dataset)!;
  const uncovered = useMemo(
    () => (ds.whitespace ?? []).filter((w) => !w.hasSite).sort((a, b) => b.whitespaceScore - a.whitespaceScore).slice(0, limit),
    [ds.whitespace, limit],
  );
  // weighted diversity in covered vs uncovered states
  const gap = useMemo(() => {
    const all = ds.whitespace ?? [];
    const wavg = (rows: typeof all) => {
      const tot = rows.reduce((a, w) => a + w.patientDensity, 0);
      return tot ? rows.reduce((a, w) => a + w.diversityIndex * w.patientDensity, 0) / tot : 0;
    };
    const cov = wavg(all.filter((w) => w.hasSite));
    const unc = wavg(all.filter((w) => !w.hasSite));
    return { cov, unc, gap: unc - cov };
  }, [ds.whitespace]);

  if (!isReal(ds.dataSource) || !uncovered.length) {
    return (
      <Callout variant="info" title="Whitespace needs the real dataset">
        Build the RWD database to overlay patient density against the 26-site footprint.
      </Callout>
    );
  }

  return (
    <div>
      <p className="text-xs text-text-muted mb-2">
        High-density states with <b>no current site</b> — expansion candidates. Diversity in
        uncovered states is{" "}
        <b className={gap.gap >= 0 ? "text-success-text" : "text-text-muted"}>
          {fmtPct(Math.abs(gap.gap) * 100)} {gap.gap >= 0 ? "higher" : "lower"}
        </b>{" "}
        than covered states.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="bg-muted text-text-subtle label-caps text-left px-3 py-2">State</th>
              <th className="bg-muted text-text-subtle label-caps text-left px-3 py-2">Region</th>
              <th className="bg-muted text-text-subtle label-caps text-right px-3 py-2">Patients</th>
              <th className="bg-muted text-text-subtle label-caps text-right px-3 py-2">Diversity</th>
            </tr>
          </thead>
          <tbody>
            {uncovered.map((w) => (
              <tr key={w.state} className="border-t border-inset hover:bg-muted/60">
                <td className="px-3 py-2 font-medium text-primary">{w.state}</td>
                <td className="px-3 py-2 text-text-muted">{w.region}</td>
                <td className="px-3 py-2 text-right font-mono text-ink">{fmtInt(w.patientDensity)}</td>
                <td className="px-3 py-2 text-right font-mono text-text-muted">{fmtPct(w.diversityIndex * 100)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
