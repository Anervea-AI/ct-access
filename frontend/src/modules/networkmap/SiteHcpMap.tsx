// Embeddable interactive map for the Site & PI module. Driven entirely by the
// module's own filters (the sticky SitesToolbar): the SITES shown are the already-
// filtered ranking set, the catchment radius is the toolbar's "Catchment radius", and
// the region filter also narrows the HCP layer. The map's only local control is the
// base-layer HCP density (decile), which has no toolbar equivalent.
import { useEffect, useMemo, useReducer, useState } from "react";
import { Button, Callout, Select, Spinner, cn } from "@/design/primitives";
import { api } from "@/lib/api";
import type { MapHcp, MapSiteOut, Site } from "@/types";
import { InteractiveMap } from "./InteractiveMap";
import { HcpCircleTable } from "./HcpCircleTable";
import { initialMapState, mapReducer } from "./mapState";
import { regionForState } from "./stateRegion";

const DECILE_OPTS = [
  { value: "10", label: "Decile 10" },
  { value: "9", label: "Decile 9+" },
  { value: "8", label: "Decile 8+" },
  { value: "7", label: "Decile 7+" },
  { value: "6", label: "Decile 6+" },
];

function LegendDot({ color, label, ring }: { color: string; label: string; ring?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-text-muted whitespace-nowrap">
      <span className="inline-block w-3 h-3 rounded-full"
        style={{ background: color, boxShadow: ring ? "0 0 0 1.5px #fff, 0 0 0 2.5px #9a3412" : "none" }} />
      {label}
    </span>
  );
}

function inRegions(state: string | null | undefined, regions: string[]): boolean {
  return regions.length === 0 || regions.includes(regionForState(state));
}

export function SiteHcpMap({ sites, radiusMiles, regions, onSiteSelected, onHcpSelected, focusHcpNpi }: {
  sites: Site[];            // already-filtered ranking set from the module
  radiusMiles: number;       // the single left-rail "Catchment radius"
  regions: string[];         // left-rail region filter
  onSiteSelected?: (id: string | null) => void;
  onHcpSelected?: (npi: number | null) => void;  // notify the module's scorecard
  focusHcpNpi?: number | null;                    // external command to select an HCP
}) {
  const [st, dispatch] = useReducer(mapReducer, initialMapState);
  const [baseHcps, setBaseHcps] = useState<MapHcp[]>([]);
  const [showHcps, setShowHcps] = useState(true);  // toggle for the idle HCP base layer
  const [bootError, setBootError] = useState<string | null>(null);

  // Site markers come straight from the filtered ranking set, so EVERY left-rail
  // filter (region, min-eligible, PI experience, specialty, diversity) affects them.
  const mapSites: MapSiteOut[] = useMemo(
    () => sites.map((s) => ({
      id: s.id, name: s.name, lat: s.lat, lng: s.lng,
      city: s.city ?? null, state: s.state, status: s.status ?? null,
    })),
    [sites],
  );

  // base HCP layer (idle), filtered by the region filter
  useEffect(() => {
    let alive = true;
    api.mapHcps(st.decileMin, null, 1500)
      .then((h) => alive && setBaseHcps(h))
      .catch((e) => alive && setBootError(String(e)));
    return () => { alive = false; };
  }, [st.decileMin]);

  const baseFiltered = useMemo(
    () => baseHcps.filter((h) => inRegions(h.state, regions)),
    [baseHcps, regions],
  );

  // site mode: nearby HCPs within the (single) catchment radius — refires on radius change
  useEffect(() => {
    if (st.mode !== "site" || !st.selectedSiteId) return;
    let alive = true;
    api.nearbyHcps(st.selectedSiteId, radiusMiles, 0, null)
      .then((h) => alive && dispatch({ t: "NEARBY_LOADED", hcps: h }))
      .catch(() => alive && dispatch({ t: "NEARBY_LOADED", hcps: [] }));
    return () => { alive = false; };
  }, [st.mode, st.selectedSiteId, radiusMiles]);

  // hcp mode: referral network
  useEffect(() => {
    if (st.mode !== "hcp" || !st.selectedHcpNpi) return;
    let alive = true;
    api.hcpNetwork(st.selectedHcpNpi, 60)
      .then((n) => alive && dispatch({ t: "NETWORK_LOADED", data: n }))
      .catch(() => alive && dispatch({ t: "CLEAR" }));
    return () => { alive = false; };
  }, [st.mode, st.selectedHcpNpi]);

  // clicking a site always reveals the HCPs in its radius (and enables the toggle)
  const selectSite = (id: string) => { dispatch({ t: "SELECT_SITE", id }); setShowHcps(true); onSiteSelected?.(id); onHcpSelected?.(null); };
  const selectHcp = (npi: number) => { dispatch({ t: "SELECT_HCP", npi }); onHcpSelected?.(npi); };
  const clear = () => { dispatch({ t: "CLEAR" }); onSiteSelected?.(null); onHcpSelected?.(null); };

  // external select command (e.g. clicking a referral connection in the scorecard)
  useEffect(() => {
    if (focusHcpNpi != null && focusHcpNpi !== st.selectedHcpNpi) {
      dispatch({ t: "SELECT_HCP", npi: focusHcpNpi });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusHcpNpi]);

  const networkSize = st.network ? st.network.nodes.length : 0;

  if (bootError) {
    return (
      <Callout variant="warning" title="Map data unavailable">
        Could not load map data ({bootError}). Ensure the RWD database is built
        (<code>python -m app.data.etl</code>) and the backend is running.
      </Callout>
    );
  }

  return (
    <div>
      {/* compact toolbar — only the map-specific HCP density control + status */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-3">
        <button
          type="button"
          onClick={() => setShowHcps((v) => !v)}
          aria-pressed={showHcps}
          title={showHcps ? "Hide HCPs (show sites only)" : "Show HCPs on the map"}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
            showHcps ? "bg-primary text-white border-primary" : "bg-surface text-text-muted border-border hover:bg-muted",
          )}
        >
          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: showHcps ? "#ffb74d" : "#cbd5e1" }} />
          HCPs {showHcps ? "on" : "off"}
        </button>
        <div className="flex items-center gap-2">
          <span className="label-caps text-text-subtle">HCP density</span>
          <Select value={String(st.decileMin)} onChange={(v) => dispatch({ t: "SET_DECILE", v: parseInt(v, 10) })}
            options={DECILE_OPTS} />
        </div>
        <Button variant="secondary" onClick={clear} disabled={st.mode === "idle"}>Clear selection</Button>
        <span className="text-xs text-text-faint ml-auto">
          {st.mode === "idle" && `Click a site → HCPs within ${radiusMiles} mi · click an HCP → referral network`}
          {st.mode === "site" && `Site mode · ${st.nearbyHcps.length} HCPs within ${radiusMiles} mi (set radius in the filter rail)`}
          {st.mode === "hcp" && `Network mode · ${networkSize} providers connected`}
        </span>
      </div>

      <div className="relative rounded-lg overflow-hidden border border-inset">
        {st.loading && (
          <div className="absolute top-3 right-3 z-[1000] bg-surface/90 rounded-md px-2 py-1 text-xs text-text-muted flex items-center gap-1.5 shadow-sm">
            <Spinner /> loading…
          </div>
        )}
        <div className={cn("h-[560px] w-full")}>
          <InteractiveMap
            sites={mapSites}
            baseHcps={showHcps ? baseFiltered : []}
            nearbyHcps={st.nearbyHcps}
            network={st.network}
            mode={st.mode}
            selectedSiteId={st.selectedSiteId}
            selectedHcpNpi={st.selectedHcpNpi}
            radiusMiles={radiusMiles}
            onSelectSite={selectSite}
            onSelectHcp={selectHcp}
            onOpenProfile={selectHcp}
            onClear={clear}
          />
        </div>
      </div>

      {/* legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2.5">
        <LegendDot color="#9a3412" label="Trial site" />
        <LegendDot color="#ffb74d" label="HCP" />
        <LegendDot color="#9a3412" label="Selected HCP (network center)" ring />
        <span className="inline-flex items-center gap-1.5 text-xs text-text-muted">
          <span className="inline-block w-5 border-t-2 border-dashed" style={{ borderColor: "#2563eb" }} />
          Referral connection
        </span>
      </div>

      {/* detail table of the HCPs inside the selected site's catchment circle */}
      {st.mode === "site" && st.selectedSiteId && (
        <HcpCircleTable
          hcps={st.nearbyHcps}
          site={mapSites.find((s) => s.id === st.selectedSiteId) ?? null}
          radiusMiles={radiusMiles}
          loading={st.loading}
          onOpenProfile={selectHcp}
        />
      )}
    </div>
  );
}
