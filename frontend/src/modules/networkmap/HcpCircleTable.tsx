// Detail table for the HCPs inside a selected site's catchment circle.
//
// Mirrors the KOL workbook's schema, but ~20 columns won't fit one row, so:
//   • the HCP identity column is PINNED (sticky-left) and always visible, and
//   • the metric columns are split into 3 segmented views so each view stays
//     narrow enough to read without horizontal scrolling.
// Real columns are RWD-backed; KOL-signal columns are illustrative sample data
// (see hcpDetail.ts). Sortable; a row opens the existing HCP profile drawer.
import { useMemo, useState, type ReactNode } from "react";
import type { MapHcp, MapSiteOut } from "@/types";
import { Badge, SectionLabel, Spinner, cn } from "@/design/primitives";
import { fmtInt } from "@/lib/format";
import { buildHcpDetailRows, type HcpDetailRow } from "./hcpDetail";

type ColKey =
  | "kolScore" | "qualifications" | "position" | "areas" | "institution"
  | "location" | "distanceMi" | "decile" | "patientCount" | "publications"
  | "congress" | "conferences" | "societyRoles" | "editorialBoards"
  | "guidelines" | "clinicalTrials" | "disclosures" | "grants" | "awards" | "patents";
type SortKey = ColKey | "name";

interface Col {
  label: string;
  numeric: boolean;
  title?: string;
  sortVal: (d: HcpDetailRow) => number | string;
  cell: (d: HcpDetailRow) => ReactNode;
}

const n = (v: number) => <span className="font-mono text-ink">{fmtInt(v)}</span>;

const COL: Record<ColKey, Col> = {
  kolScore: {
    label: "KOL score", numeric: true, title: "Composite influence (0–100), illustrative",
    sortVal: (d) => d.kolScore,
    cell: (d) => (
      <div className="flex items-center gap-1.5 justify-end">
        <div className="h-1.5 w-12 rounded-full bg-inset overflow-hidden">
          <div className="h-full bg-primary" style={{ width: `${d.kolScore}%` }} />
        </div>
        <span className="font-mono font-semibold text-ink w-6 text-right">{d.kolScore}</span>
      </div>
    ),
  },
  qualifications: {
    label: "Qualifications", numeric: false,
    sortVal: (d) => d.qualifications,
    cell: (d) => <span className="whitespace-nowrap text-ink">{d.qualifications}</span>,
  },
  position: {
    label: "Position", numeric: false,
    sortVal: (d) => d.position,
    cell: (d) => <span className="whitespace-nowrap text-ink">{d.position}</span>,
  },
  areas: {
    label: "Areas of interest", numeric: false,
    sortVal: (d) => d.areasOfInterest.join(", "),
    cell: (d) => (
      <span
        className="text-text-muted max-w-[14rem] truncate inline-block align-bottom"
        title={d.areasOfInterest.join(", ")}
      >
        {d.areasOfInterest.join(", ")}
      </span>
    ),
  },
  institution: {
    label: "Institution", numeric: false,
    sortVal: (d) => d.institution.toLowerCase(),
    cell: (d) => (
      <span className="text-ink max-w-[15rem] truncate inline-block align-bottom" title={d.institution}>
        {d.institution}
      </span>
    ),
  },
  location: {
    label: "Location", numeric: false,
    sortVal: (d) => `${d.state} ${d.city}`,
    cell: (d) => (
      <span className="whitespace-nowrap text-ink">
        {[d.city, d.state].filter(Boolean).join(", ") || "—"}
      </span>
    ),
  },
  distanceMi: {
    label: "Distance", numeric: true, title: "Miles from the selected site",
    sortVal: (d) => d.distanceMi ?? Number.POSITIVE_INFINITY,
    cell: (d) => (
      <span className="font-mono text-text-muted">
        {d.distanceMi == null ? "—" : `${d.distanceMi.toFixed(0)} mi`}
      </span>
    ),
  },
  decile: {
    label: "Decile", numeric: true, title: "RWD prescribing decile",
    sortVal: (d) => d.decile, cell: (d) => n(d.decile),
  },
  patientCount: {
    label: "Patients", numeric: true, title: "RWD patient volume",
    sortVal: (d) => d.patientCount, cell: (d) => n(d.patientCount),
  },
  publications: {
    label: "Publications", numeric: true,
    sortVal: (d) => d.publications, cell: (d) => n(d.publications),
  },
  congress: {
    label: "Congress", numeric: true, title: "Congress abstracts / presentations",
    sortVal: (d) => d.congress, cell: (d) => n(d.congress),
  },
  conferences: {
    label: "Conferences", numeric: true, title: "Conference participations / faculty",
    sortVal: (d) => d.conferences, cell: (d) => n(d.conferences),
  },
  societyRoles: {
    label: "Society roles", numeric: true,
    sortVal: (d) => d.societyRoles, cell: (d) => n(d.societyRoles),
  },
  editorialBoards: {
    label: "Ed. boards", numeric: true, title: "Editorial board memberships",
    sortVal: (d) => d.editorialBoards, cell: (d) => n(d.editorialBoards),
  },
  guidelines: {
    label: "Guidelines", numeric: true, title: "Guideline authorships",
    sortVal: (d) => d.guidelines, cell: (d) => n(d.guidelines),
  },
  clinicalTrials: {
    label: "Clinical trials", numeric: true,
    sortVal: (d) => d.clinicalTrials, cell: (d) => n(d.clinicalTrials),
  },
  disclosures: {
    label: "Disclosures", numeric: true, title: "Industry disclosures",
    sortVal: (d) => d.disclosures, cell: (d) => n(d.disclosures),
  },
  grants: {
    label: "Grants", numeric: true,
    sortVal: (d) => d.grants, cell: (d) => n(d.grants),
  },
  awards: {
    label: "Awards", numeric: true,
    sortVal: (d) => d.awards, cell: (d) => n(d.awards),
  },
  patents: {
    label: "Patents", numeric: true,
    sortVal: (d) => d.patents, cell: (d) => n(d.patents),
  },
};

type ViewKey = "profile" | "research" | "influence";
const VIEWS: { key: ViewKey; label: string; cols: ColKey[] }[] = [
  { key: "profile", label: "Profile & RWD", cols: ["qualifications", "position", "areas", "institution", "location", "distanceMi", "decile", "patientCount"] },
  { key: "research", label: "Research output", cols: ["kolScore", "publications", "congress", "conferences", "guidelines", "editorialBoards"] },
  { key: "influence", label: "Influence & trials", cols: ["kolScore", "societyRoles", "clinicalTrials", "disclosures", "grants", "awards", "patents"] },
];

function sortValue(d: HcpDetailRow, key: SortKey): number | string {
  return key === "name" ? d.name.toLowerCase() : COL[key].sortVal(d);
}

export function HcpCircleTable({
  hcps, site, radiusMiles, loading, onOpenProfile,
}: {
  hcps: MapHcp[];
  site: MapSiteOut | null;
  radiusMiles: number;
  loading: boolean;
  onOpenProfile: (npi: number) => void;
}) {
  const [view, setView] = useState<ViewKey>("research");
  // sortKey "rank" handled implicitly via initial order; explicit sorts use a real column
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean } | null>(null);

  const rows = useMemo(() => buildHcpDetailRows(hcps, site), [hcps, site]);
  const activeCols = VIEWS.find((v) => v.key === view)!.cols;

  const sorted = useMemo(() => {
    if (!sort) return [...rows].sort((a, b) => a.rank - b.rank); // default: influence rank
    const arr = [...rows].sort((a, b) => {
      const va = sortValue(a, sort.key);
      const vb = sortValue(b, sort.key);
      const cmp = typeof va === "number" && typeof vb === "number"
        ? va - vb
        : String(va).localeCompare(String(vb));
      return sort.asc ? cmp : -cmp;
    });
    return arr;
  }, [rows, sort]);

  const onSort = (key: SortKey, numeric: boolean) => {
    setSort((cur) =>
      cur && cur.key === key
        ? { key, asc: !cur.asc }
        // numeric columns most useful high→low first; distance & text low→high
        : { key, asc: !numeric || key === "distanceMi" },
    );
  };

  const sortMark = (key: SortKey) => (sort?.key === key ? (sort.asc ? " ▲" : " ▼") : "");

  return (
    <div className="mt-5 border-t border-inset pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
        <SectionLabel>
          HCPs in catchment
          {site ? <span className="normal-case text-text-faint"> · {site.name}</span> : null}
        </SectionLabel>
        <div className="flex items-center gap-3">
          <span className="text-xs text-text-faint">
            {loading
              ? "loading…"
              : `${rows.length} within ${radiusMiles} mi · click a row for the full profile`}
          </span>
          {/* segmented view switcher keeps each view narrow enough to fit */}
          <div className="inline-flex rounded-md border border-border overflow-hidden">
            {VIEWS.map((v) => (
              <button
                key={v.key}
                type="button"
                onClick={() => setView(v.key)}
                className={cn(
                  "px-2.5 py-1 text-xs font-semibold transition-colors border-l border-border first:border-l-0",
                  view === v.key ? "bg-primary text-white" : "bg-surface text-text-muted hover:bg-muted",
                )}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading && rows.length === 0 ? (
        <div className="flex items-center gap-2 text-text-muted text-sm py-6 justify-center">
          <Spinner /> loading HCPs…
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-text-muted bg-muted rounded-md px-3 py-4 text-center">
          No HCPs within {radiusMiles} mi of this site. Widen the catchment radius.
        </p>
      ) : (
        <>
          <div className="overflow-auto max-h-[440px] rounded-md border border-inset min-w-0">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  {/* pinned identity header (sticky both top & left) */}
                  <th
                    onClick={() => onSort("name", false)}
                    className="sticky top-0 left-0 z-30 bg-muted text-text-subtle label-caps text-left px-3 py-2 cursor-pointer select-none hover:text-ink border-r border-inset min-w-[15rem]"
                  >
                    HCP{sortMark("name")}
                  </th>
                  {activeCols.map((key) => {
                    const c = COL[key];
                    return (
                      <th
                        key={key}
                        title={c.title}
                        onClick={() => onSort(key, c.numeric)}
                        className={cn(
                          "sticky top-0 z-20 bg-muted text-text-subtle label-caps px-3 py-2 whitespace-nowrap cursor-pointer select-none hover:text-ink",
                          c.numeric ? "text-right" : "text-left",
                          sort?.key === key && "text-primary",
                        )}
                      >
                        {c.label}{sortMark(key)}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {sorted.map((d) => (
                  <tr
                    key={d.npi}
                    onClick={() => onOpenProfile(d.npi)}
                    className="group border-t border-inset cursor-pointer hover:bg-muted/60"
                  >
                    {/* pinned identity cell: rank chip + name + specialty */}
                    <td className="sticky left-0 z-10 bg-surface group-hover:bg-muted/60 px-3 py-2 border-r border-inset">
                      <div className="flex items-center gap-2">
                        <Badge variant={d.rank <= 3 ? "gold" : "neutral"}>{d.rank}</Badge>
                        <div className="min-w-0">
                          <div className="text-primary font-medium truncate">{d.name}</div>
                          <div className="text-[11px] text-text-muted truncate">{d.specialty}</div>
                        </div>
                      </div>
                    </td>
                    {activeCols.map((key) => {
                      const c = COL[key];
                      return (
                        <td key={key} className={cn("px-3 py-2", c.numeric ? "text-right" : "text-left")}>
                          {c.cell(d)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-text-faint mt-2">
            Real fields (HCP, specialty, institution, location, decile, patients) are RWD-backed.
            KOL-signal columns (KOL score, publications, congress, conferences, society roles,
            editorial boards, guidelines, trials, disclosures, grants, awards, patents) mirror the
            KOL profile schema and are <span className="italic">illustrative sample data</span>.
          </p>
        </>
      )}
    </div>
  );
}
