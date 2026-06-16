import type { MapHcp, ReferralNetwork } from "@/types";

export type MapMode = "idle" | "site" | "hcp";

export interface MapState {
  mode: MapMode;
  selectedSiteId: string | null;
  selectedHcpNpi: number | null;
  decileMin: number;          // base HCP layer density (map-only display option)
  nearbyHcps: MapHcp[];        // site mode
  network: ReferralNetwork | null; // hcp mode
  profileNpi: number | null;   // drawer open when non-null
  loading: boolean;
}

export const initialMapState: MapState = {
  mode: "idle",
  selectedSiteId: null,
  selectedHcpNpi: null,
  decileMin: 7,
  nearbyHcps: [],
  network: null,
  profileNpi: null,
  loading: false,
};

export type MapAction =
  | { t: "SELECT_SITE"; id: string }
  | { t: "SELECT_HCP"; npi: number }
  | { t: "SET_DECILE"; v: number }
  | { t: "OPEN_PROFILE"; npi: number }
  | { t: "CLOSE_PROFILE" }
  | { t: "CLEAR" }
  | { t: "LOADING"; v: boolean }
  | { t: "NEARBY_LOADED"; hcps: MapHcp[] }
  | { t: "NETWORK_LOADED"; data: ReferralNetwork };

export function mapReducer(s: MapState, a: MapAction): MapState {
  switch (a.t) {
    case "SELECT_SITE":
      return { ...s, mode: "site", selectedSiteId: a.id, selectedHcpNpi: null, network: null, nearbyHcps: [], loading: true };
    case "SELECT_HCP":
      return { ...s, mode: "hcp", selectedHcpNpi: a.npi, selectedSiteId: null, nearbyHcps: [], network: null, loading: true };
    case "SET_DECILE":
      return { ...s, decileMin: a.v };
    case "OPEN_PROFILE":
      return { ...s, profileNpi: a.npi };
    case "CLOSE_PROFILE":
      return { ...s, profileNpi: null };
    case "CLEAR":
      return { ...s, mode: "idle", selectedSiteId: null, selectedHcpNpi: null, nearbyHcps: [], network: null, loading: false };
    case "LOADING":
      return { ...s, loading: a.v };
    case "NEARBY_LOADED":
      return { ...s, nearbyHcps: a.hcps, loading: false };
    case "NETWORK_LOADED":
      return { ...s, network: a.data, loading: false };
    default:
      return s;
  }
}
