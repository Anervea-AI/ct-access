// State abbreviation -> analytic region. Mirrors backend app/data/geo.py STATE_REGION
// so the Site & PI region filter can be applied to the HCP map layer client-side.
export const STATE_REGION: Record<string, string> = {
  CT: "Northeast", ME: "Northeast", MA: "Northeast", NH: "Northeast", RI: "Northeast",
  VT: "Northeast", NJ: "Northeast", NY: "Northeast", PA: "Northeast",
  IL: "Midwest", IN: "Midwest", MI: "Midwest", OH: "Midwest", WI: "Midwest",
  IA: "Midwest", KS: "Midwest", MN: "Midwest", MO: "Midwest", NE: "Midwest",
  ND: "Midwest", SD: "Midwest",
  AL: "Southeast", AR: "Southeast", DE: "Southeast", DC: "Southeast", FL: "Southeast",
  GA: "Southeast", KY: "Southeast", LA: "Southeast", MD: "Southeast", MS: "Southeast",
  NC: "Southeast", SC: "Southeast", TN: "Southeast", VA: "Southeast", WV: "Southeast",
  OK: "Southwest", TX: "Southwest", AZ: "Southwest", NM: "Southwest",
  CO: "West", ID: "West", MT: "West", NV: "West", UT: "West", WY: "West",
  AK: "West", CA: "West", HI: "West", OR: "West", WA: "West",
};

export function regionForState(abbr: string | null | undefined): string {
  if (!abbr) return "National";
  return STATE_REGION[abbr.toUpperCase()] ?? "National";
}
