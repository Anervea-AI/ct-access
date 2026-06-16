// KOL-style detail rows for the "HCPs in the circle" table.
//
// We deliberately do NOT read the KOL workbook (Ipsen_RD - 150 KOL Profiles…).
// We only mirror its *columns* — the kind of KOL/HCP intelligence collected
// across its 18 sheets (Expert Details, Expert Focus, Society Roles, Ed Board,
// Guidelines, Congress, Publications, ClinicalTrials.gov, Disclosure, Grants,
// Award, Patents…) — and synthesize believable DUMMY values for the fields the
// RWD warehouse doesn't carry.
//
// Real fields (name, specialty, institution/HCO, city/state, decile, patient
// volume, lat/lng) come straight from the map's RWD `MapHcp`. Everything else is
// illustrative sample data, seeded by NPI so a given HCP always renders the same
// values across re-renders, radius changes, and re-sorts.
import type { MapHcp } from "@/types";

export interface HcpDetail {
  npi: number;
  // ---- real (RWD warehouse) ----
  name: string;
  specialty: string;
  institution: string;
  city: string;
  state: string;
  decile: number;
  patientCount: number;
  distanceMi: number | null; // computed from the selected site
  // ---- dummy (mirrors the KOL workbook columns) ----
  kolScore: number; // 0..100 composite influence
  qualifications: string;
  position: string;
  country: string;
  areasOfInterest: string[];
  publications: number;
  congress: number;
  conferences: number;
  societyRoles: number;
  editorialBoards: number;
  guidelines: number;
  clinicalTrials: number;
  disclosures: number;
  grants: number;
  awards: number;
  patents: number;
}

export type HcpDetailRow = HcpDetail & { rank: number };

// mulberry32 — tiny deterministic PRNG seeded from a 32-bit integer.
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const QUALIFICATIONS = [
  "MD", "MD, PhD", "MD, MPH", "DO", "MD, FACP",
  "MD, FACG", "MBBS, MD", "MD, MSc", "PharmD, PhD",
];
const POSITIONS = [
  "Professor of Medicine", "Director", "Department Chair", "Chief of Service",
  "Attending Physician", "Associate Professor", "Principal Investigator",
  "Program Director", "Section Head",
];
const INTERESTS = [
  "Clinical trials", "Translational research", "Biomarkers", "Real-world evidence",
  "Precision medicine", "Patient registries", "Health outcomes", "Disease management",
  "Comparative effectiveness", "Pharmacovigilance", "Genomics", "Digital health",
];

function haversineMi(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function pickOne<T>(arr: T[], r: number): T {
  return arr[Math.min(arr.length - 1, Math.floor(r * arr.length))];
}

function pickSome<T>(arr: T[], n: number, next: () => number): T[] {
  const pool = [...arr];
  const out: T[] = [];
  for (let i = 0; i < n && pool.length; i++) {
    out.push(pool.splice(Math.floor(next() * pool.length), 1)[0]);
  }
  return out;
}

/** Build a KOL-style detail record for one circle HCP. `site` adds distance. */
export function buildHcpDetail(h: MapHcp, site?: { lat: number; lng: number } | null): HcpDetail {
  const next = rng(h.npi);
  const dec = h.decile || 6;
  // influence factor: deciles run 6..10 in this dataset → ~0.2..1.0
  const f = Math.max(0, Math.min(1, (dec - 5) / 5));
  const ri = (lo: number, hi: number) => lo + next() * (hi - lo);

  const publications = Math.round(ri(8, 70) + f * ri(40, 540));
  const congress = Math.round(ri(2, 18) + f * ri(8, 120));
  const conferences = Math.round(ri(1, 7) + f * ri(2, 34));
  const societyRoles = Math.round(ri(0, 2) + f * ri(0, 7));
  const editorialBoards = Math.round(f * ri(0, 6));
  const guidelines = Math.round(f * ri(0, 5));
  const clinicalTrials = Math.round(ri(0, 3) + f * ri(0, 22));
  const disclosures = Math.round(ri(0, 3) + f * ri(0, 14));
  const grants = Math.round(f * ri(0, 12));
  const awards = Math.round(f * ri(0, 6));
  const patents = Math.round(f * ri(0, 4));

  const raw =
    publications * 0.1 + congress * 0.2 + conferences * 0.15 + societyRoles * 3 +
    editorialBoards * 2.5 + guidelines * 3 + clinicalTrials * 1.2 + disclosures * 0.5 +
    grants + awards * 1.5 + patents * 1.5 + dec * 2;
  const kolScore = Math.min(100, Math.round(raw / 2.4));

  const qualifications = pickOne(QUALIFICATIONS, next());
  const position = pickOne(POSITIONS, next());
  const interestCount = 2 + Math.floor(next() * 2); // 2..3
  const areasOfInterest = pickSome(INTERESTS, interestCount, next);

  return {
    npi: h.npi,
    name: h.name,
    specialty: h.specialty || "—",
    institution: h.hcoName || "—",
    city: h.city || "",
    state: h.state || "",
    decile: dec,
    patientCount: h.patientCount,
    distanceMi: site ? haversineMi(site.lat, site.lng, h.lat, h.lng) : null,
    kolScore,
    qualifications,
    position,
    country: "USA",
    areasOfInterest,
    publications,
    congress,
    conferences,
    societyRoles,
    editorialBoards,
    guidelines,
    clinicalTrials,
    disclosures,
    grants,
    awards,
    patents,
  };
}

/** Build every circle HCP's detail and assign an influence rank (1 = top KOL score). */
export function buildHcpDetailRows(
  hcps: MapHcp[],
  site?: { lat: number; lng: number } | null,
): HcpDetailRow[] {
  const details = hcps.map((h) => buildHcpDetail(h, site));
  const rankByNpi = new Map<number, number>();
  [...details]
    .sort((a, b) => b.kolScore - a.kolScore)
    .forEach((d, i) => rankByNpi.set(d.npi, i + 1));
  return details.map((d) => ({ ...d, rank: rankByNpi.get(d.npi)! }));
}
