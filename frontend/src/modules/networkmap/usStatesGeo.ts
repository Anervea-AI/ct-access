// Offline US-states base layer for Leaflet — reuses the already-installed
// us-atlas topojson (no tiles, no API key). Converted once to GeoJSON.
import statesTopo from "us-atlas/states-10m.json";
import { feature } from "topojson-client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const topo = statesTopo as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const US_STATES_GEOJSON = feature(topo, topo.objects.states) as any;

// Continental-US framing bounds [[south, west], [north, east]]
export const US_BOUNDS: [[number, number], [number, number]] = [
  [24.4, -125.0],
  [49.4, -66.9],
];
