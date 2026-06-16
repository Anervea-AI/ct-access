import { useMemo } from "react";
import { geoAlbersUsa, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import statesTopo from "us-atlas/states-10m.json";

// Census-division → our 5 regions, keyed by state FIPS id (us-atlas uses FIPS strings)
const FIPS_REGION: Record<string, string> = {
  "09": "Northeast", "23": "Northeast", "25": "Northeast", "33": "Northeast", "44": "Northeast",
  "50": "Northeast", "34": "Northeast", "36": "Northeast", "42": "Northeast",
  "17": "Midwest", "18": "Midwest", "26": "Midwest", "39": "Midwest", "55": "Midwest",
  "19": "Midwest", "20": "Midwest", "27": "Midwest", "29": "Midwest", "31": "Midwest",
  "38": "Midwest", "46": "Midwest",
  "01": "Southeast", "05": "Southeast", "10": "Southeast", "11": "Southeast", "12": "Southeast",
  "13": "Southeast", "21": "Southeast", "22": "Southeast", "24": "Southeast", "28": "Southeast",
  "37": "Southeast", "45": "Southeast", "47": "Southeast", "51": "Southeast", "54": "Southeast",
  "40": "Southwest", "48": "Southwest", "04": "Southwest", "35": "Southwest",
  "08": "West", "16": "West", "30": "West", "32": "West", "49": "West", "56": "West",
  "02": "West", "06": "West", "15": "West", "41": "West", "53": "West",
};

// FIPS id → 2-letter abbr (for state-level overlays e.g. whitespace)
const FIPS_ABBR: Record<string, string> = {
  "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO", "09": "CT",
  "10": "DE", "11": "DC", "12": "FL", "13": "GA", "15": "HI", "16": "ID", "17": "IL",
  "18": "IN", "19": "IA", "20": "KS", "21": "KY", "22": "LA", "23": "ME", "24": "MD",
  "25": "MA", "26": "MI", "27": "MN", "28": "MS", "29": "MO", "30": "MT", "31": "NE",
  "32": "NV", "33": "NH", "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND",
  "39": "OH", "40": "OK", "41": "OR", "42": "PA", "44": "RI", "45": "SC", "46": "SD",
  "47": "TN", "48": "TX", "49": "UT", "50": "VT", "51": "VA", "53": "WA", "54": "WV",
  "55": "WI", "56": "WY",
};

export interface MapSite {
  id: string;
  name: string;
  lat: number;
  lng: number;
  value: number;
  selected?: boolean;
  region?: string;
}

// cream -> accent terracotta interpolation
function intensityColor(t: number): string {
  const c0 = [250, 245, 238];
  const c1 = [194, 65, 12];
  const m = (i: number) => Math.round(c0[i] + (c1[i] - c0[i]) * Math.max(0, Math.min(1, t)));
  return `rgb(${m(0)}, ${m(1)}, ${m(2)})`;
}

const WIDTH = 960;
const HEIGHT = 560;

export function USMap({
  sites = [],
  regionValues = {},
  stateValues,
  onSelect,
  showChoropleth = true,
}: {
  sites?: MapSite[];
  regionValues?: Record<string, number>;
  // when provided, the choropleth shades individual states (keyed by 2-letter abbr)
  // instead of regions — used for the geographic-whitespace overlay
  stateValues?: Record<string, number>;
  onSelect?: (id: string) => void;
  showChoropleth?: boolean;
}) {
  const { paths, points, maxVal } = useMemo(() => {
    const fc = feature(statesTopo as never, (statesTopo as never as { objects: { states: unknown } }).objects.states as never) as unknown as {
      features: { id: string; geometry: unknown; properties: unknown }[];
    };
    const projection = geoAlbersUsa().fitSize([WIDTH, HEIGHT], fc as never);
    const pathGen = geoPath(projection);
    const maxRegion = Math.max(1, ...Object.values(regionValues));
    const maxState = stateValues ? Math.max(1, ...Object.values(stateValues)) : 1;
    const paths = fc.features.map((f) => {
      let fill = "#fffdfa";
      if (stateValues) {
        const v = stateValues[FIPS_ABBR[f.id] ?? ""] ?? 0;
        fill = intensityColor((v / maxState) * 0.9);
      } else if (showChoropleth) {
        const region = FIPS_REGION[f.id] ?? "";
        const v = regionValues[region] ?? 0;
        fill = intensityColor((v / maxRegion) * 0.85);
      }
      return { id: f.id, d: pathGen(f as never) ?? "", fill };
    });
    const maxVal = Math.max(1, ...sites.map((s) => s.value));
    const points = sites
      .map((s) => {
        const xy = projection([s.lng, s.lat]);
        if (!xy) return null;
        return { ...s, x: xy[0], y: xy[1], r: 3 + Math.sqrt(s.value / maxVal) * 14 };
      })
      .filter(Boolean) as (MapSite & { x: number; y: number; r: number })[];
    return { paths, points, maxVal };
  }, [sites, regionValues, stateValues, showChoropleth]);

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full h-auto" role="img" aria-label="US site map">
      <g>
        {paths.map((p) => (
          <path key={p.id} d={p.d} fill={p.fill} stroke="#e7dcc9" strokeWidth={0.75} />
        ))}
      </g>
      <g>
        {points.map((p) => (
          <circle
            key={p.id}
            cx={p.x}
            cy={p.y}
            r={p.r}
            fill={p.selected ? "#9a3412" : "#c2410c"}
            fillOpacity={p.selected ? 0.95 : 0.7}
            stroke={p.selected ? "#7c2d12" : "#ffffff"}
            strokeWidth={p.selected ? 2 : 1}
            className={onSelect ? "cursor-pointer" : ""}
            onClick={() => onSelect?.(p.id)}
          >
            <title>{`${p.name} — ${Math.round(p.value).toLocaleString()} eligible`}</title>
          </circle>
        ))}
      </g>
    </svg>
  );
}

export { intensityColor };
