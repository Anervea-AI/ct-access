import { useMemo } from "react";
import type { Site } from "@/types";
import { DataTable, Button } from "@/design/primitives";
import { DownloadIcon } from "@/design/icons";
import { fmtInt } from "@/lib/format";
import { downloadCsv } from "@/lib/export";

export interface AllocationRow {
  rank: number;
  site: Site;
  allocation: number;
}

// Allocate `target` across sites proportional to eligiblePatients share, using the
// largest-remainder (Hamilton) method so integer allocations sum exactly to target.
export function allocate(sites: Site[], target: number): AllocationRow[] {
  const totalEligible = sites.reduce((sum, s) => sum + s.eligiblePatients, 0);
  if (totalEligible <= 0 || sites.length === 0) {
    return sites.map((site, i) => ({ rank: i + 1, site, allocation: 0 }));
  }
  const raw = sites.map((s) => (s.eligiblePatients / totalEligible) * target);
  const floors = raw.map((v) => Math.floor(v));
  let remainder = Math.round(target) - floors.reduce((a, b) => a + b, 0);
  const order = raw
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);
  const alloc = [...floors];
  for (let k = 0; k < order.length && remainder > 0; k++) {
    alloc[order[k].i] += 1;
    remainder -= 1;
  }
  return sites.map((site, i) => ({ rank: i + 1, site, allocation: alloc[i] }));
}

export function SiteAllocation({
  rankedSites,
  numSites,
  targetEnrollment,
}: {
  rankedSites: Site[];
  numSites: number;
  targetEnrollment: number;
}) {
  const cap = Math.min(numSites, rankedSites.length);
  const top = useMemo(() => rankedSites.slice(0, cap), [rankedSites, cap]);
  const rows = useMemo(() => allocate(top, targetEnrollment), [top, targetEnrollment]);

  const totalEligible = rows.reduce((sum, r) => sum + r.site.eligiblePatients, 0);
  const totalAlloc = rows.reduce((sum, r) => sum + r.allocation, 0);

  const tableRows: (string | number)[][] = rows.map((r) => [
    `#${r.rank}`,
    r.site.name,
    r.site.region,
    fmtInt(r.site.eligiblePatients),
    fmtInt(r.allocation),
  ]);
  tableRows.push(["", "Total", "", fmtInt(totalEligible), fmtInt(totalAlloc)]);

  const exportCsv = () => {
    downloadCsv(
      "forecast-site-allocation.csv",
      rows.map((r) => ({
        rank: r.rank,
        site: r.site.name,
        region: r.site.region,
        eligiblePatients: r.site.eligiblePatients,
        allocationTarget: r.allocation,
      })),
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs text-text-muted">
          Top {cap} sites by rank · target {fmtInt(targetEnrollment)} allocated by eligible-patient
          share
        </div>
        <Button variant="ghost" onClick={exportCsv} className="text-xs px-2 py-1">
          <DownloadIcon size={14} /> CSV
        </Button>
      </div>
      <DataTable
        columns={["Rank", "Site", "Region", "Eligible", "Allocation"]}
        rows={tableRows}
      />
    </div>
  );
}
