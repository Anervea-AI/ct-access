import { useEffect, useMemo, useRef } from "react";
import { Circle, GeoJSON, MapContainer, Marker, Polyline, Popup, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import type { MapHcp, MapSiteOut, ReferralNetwork } from "@/types";
import type { MapMode } from "./mapState";
import { hcpIcon, MILES_TO_METERS, siteIcon } from "./mapIcons";
import { US_BOUNDS, US_STATES_GEOJSON } from "./usStatesGeo";

interface Props {
  sites: MapSiteOut[];
  baseHcps: MapHcp[];
  nearbyHcps: MapHcp[];
  network: ReferralNetwork | null;
  mode: MapMode;
  selectedSiteId: string | null;
  selectedHcpNpi: number | null;
  radiusMiles: number;
  onSelectSite: (id: string) => void;
  onSelectHcp: (npi: number) => void;
  onOpenProfile: (npi: number) => void;
  onClear: () => void;
}

const STATE_STYLE = { fillColor: "#fffdfa", color: "#e7dcc9", weight: 0.75, fillOpacity: 1 } as const;

function MapClickHandler({ onClear }: { onClear: () => void }) {
  useMapEvents({ click: () => onClear() });
  return null;
}

// Cap the fit zoom: with no map tiles (just state polygons), zooming past this just
// shows empty background, so a tiny/single-city cluster shouldn't zoom to street level.
const MAX_FIT_ZOOM = 10;

// Fit `bounds`. plusOne=true lands one zoom step tighter than plain fitBounds; callers
// pass false so site/HCP/overview fits use the plain fit (no extra +1 tightening).
function flyFit(map: L.Map, bounds: L.LatLngBounds, plusOne = true) {
  if (!bounds.isValid()) return;
  const padded = bounds.pad(0.12);
  const z = Math.min(map.getMaxZoom(), MAX_FIT_ZOOM, map.getBoundsZoom(padded) + (plusOne ? 1 : 0));
  map.flyTo(padded.getCenter(), z, { duration: 0.6 });
}

function MapController({ mode, site, radiusMiles, network }: {
  mode: MapMode; site: MapSiteOut | null; radiusMiles: number; network: ReferralNetwork | null;
}) {
  const map = useMap();
  useEffect(() => {
    if (mode === "site" && site) {
      const dLat = radiusMiles / 69;
      const dLng = radiusMiles / (69 * Math.max(0.1, Math.cos((site.lat * Math.PI) / 180)));
      flyFit(map, L.latLngBounds(
        [site.lat - dLat, site.lng - dLng], [site.lat + dLat, site.lng + dLng],
      ), false);
    } else if (mode === "hcp" && network && network.nodes.length) {
      const pts = network.nodes.map((n) => [n.lat, n.lng] as [number, number]);
      if (pts.length === 1) map.flyTo(pts[0], 10, { duration: 0.6 });
      else flyFit(map, L.latLngBounds(pts), false);
    } else if (mode === "idle") {
      map.flyToBounds(US_BOUNDS, { duration: 0.6 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, site?.id, radiusMiles, network?.center]);
  return null;
}

export function InteractiveMap(p: Props) {
  const selectedSite = useMemo(
    () => p.sites.find((s) => s.id === p.selectedSiteId) ?? null,
    [p.sites, p.selectedSiteId],
  );

  // HCP layer depends on mode
  const hcpLayer: MapHcp[] = p.mode === "hcp" ? (p.network?.nodes ?? [])
    : p.mode === "site" ? p.nearbyHcps
      : p.baseHcps;

  const nodeById = useMemo(() => {
    const m = new Map<number, MapHcp>();
    for (const n of p.network?.nodes ?? []) m.set(n.npi, n);
    return m;
  }, [p.network]);

  const mapRef = useRef<L.Map | null>(null);

  // Re-fit the viewport to whatever is currently visible (network / catchment / all sites),
  // landing one zoom step tighter than a plain fit.
  const fitToView = () => {
    const map = mapRef.current;
    if (!map) return;
    const pts: [number, number][] = [];
    // No +1 tightening on any fit — plain fitBounds. (The idle overview never used it.)
    if (p.mode === "hcp") {
      for (const n of p.network?.nodes ?? []) pts.push([n.lat, n.lng]);
    } else if (p.mode === "site" && selectedSite) {
      const dLat = p.radiusMiles / 69;
      const dLng = p.radiusMiles / (69 * Math.max(0.1, Math.cos((selectedSite.lat * Math.PI) / 180)));
      pts.push([selectedSite.lat - dLat, selectedSite.lng - dLng]);
      pts.push([selectedSite.lat + dLat, selectedSite.lng + dLng]);
      for (const h of p.nearbyHcps) pts.push([h.lat, h.lng]);
    } else {
      for (const s of p.sites) pts.push([s.lat, s.lng]);
      for (const h of p.baseHcps) pts.push([h.lat, h.lng]);
    }
    if (pts.length === 0) { map.flyToBounds(US_BOUNDS, { duration: 0.5 }); return; }
    if (pts.length === 1) { map.flyTo(pts[0], 10, { duration: 0.5 }); return; }
    flyFit(map, L.latLngBounds(pts), false);
  };

  return (
    <div style={{ position: "relative", height: "100%", width: "100%" }}>
    <MapContainer
      ref={mapRef}
      center={[39.5, -98.35]}
      zoom={4}
      scrollWheelZoom
      style={{ height: "100%", width: "100%", background: "#faf5ee", borderRadius: "0.5rem" }}
      attributionControl={false}
    >
      <GeoJSON data={US_STATES_GEOJSON} style={() => STATE_STYLE} interactive={false} />
      <MapClickHandler onClear={p.onClear} />
      <MapController mode={p.mode} site={selectedSite} radiusMiles={p.radiusMiles} network={p.network} />

      {/* catchment radius */}
      {p.mode === "site" && selectedSite && (
        <Circle
          center={[selectedSite.lat, selectedSite.lng]}
          radius={p.radiusMiles * MILES_TO_METERS}
          pathOptions={{ color: "#c2410c", weight: 1.5, fillColor: "#ea580c", fillOpacity: 0.06, dashArray: "5 5" }}
        />
      )}

      {/* sites — hidden in hcp mode */}
      {p.mode !== "hcp" && p.sites.map((s) => {
        const dim = p.mode === "site" && s.id !== p.selectedSiteId;
        return (
          <Marker
            key={s.id}
            position={[s.lat, s.lng]}
            icon={siteIcon(dim)}
            opacity={dim ? 0.45 : 1}
            zIndexOffset={dim ? 0 : 500}
            eventHandlers={{ click: () => p.onSelectSite(s.id) }}
          >
            <Popup>
              <div style={{ minWidth: 180 }}>
                <div style={{ fontWeight: 700, color: "#9a3412" }}>{s.name}</div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>
                  {[s.city, s.state].filter(Boolean).join(", ")}
                </div>
                {s.status && (
                  <div style={{ marginTop: 4, fontSize: 11, fontWeight: 600, color: "#15803d" }}>
                    {s.status}
                  </div>
                )}
                <div style={{ marginTop: 6, fontSize: 11, color: "#9ca3af" }}>
                  Showing HCPs within {p.radiusMiles} mi
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}

      {/* network edges (hcp mode) */}
      {p.mode === "hcp" && (p.network?.edges ?? []).map((e, i) => {
        const a = nodeById.get(e.source);
        const b = nodeById.get(e.target);
        if (!a || !b) return null;
        const w = 1 + Math.min(3, (e.shareOut + e.shareIn) * 3);
        return (
          <Polyline
            key={`${e.source}-${e.target}-${i}`}
            positions={[[a.lat, a.lng], [b.lat, b.lng]]}
            pathOptions={{ color: "#2563eb", weight: w, opacity: 0.5, dashArray: "4 4" }}
          />
        );
      })}

      {/* HCP markers */}
      {hcpLayer.map((h) => {
        const isCenter = p.mode === "hcp" && h.npi === p.network?.center;
        const isSelected = h.npi === p.selectedHcpNpi;
        return (
          <Marker
            key={h.npi}
            position={[h.lat, h.lng]}
            icon={hcpIcon({ selected: isSelected, center: isCenter, hasReferrals: h.hasReferrals })}
            zIndexOffset={isCenter ? 800 : 100}
            eventHandlers={{ click: () => p.onSelectHcp(h.npi) }}
          >
            <Popup>
              <div style={{ minWidth: 190 }}>
                <div style={{ fontWeight: 700, color: "#9a3412" }}>{h.name}</div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>
                  {h.specialty}{h.specialty && (h.city || h.state) ? " · " : ""}
                  {[h.city, h.state].filter(Boolean).join(", ")}
                </div>
                {h.hcoName && <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{h.hcoName}</div>}
                <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
                  {h.patientCount.toLocaleString()} patients · decile {h.decile}
                </div>
                <button
                  type="button"
                  onClick={() => p.onOpenProfile(h.npi)}
                  style={{
                    marginTop: 8, width: "100%", padding: "5px 8px", fontSize: 12, fontWeight: 600,
                    color: "#ffffff", background: "#9a3412", border: "none", borderRadius: 6, cursor: "pointer",
                  }}
                >
                  View profile
                </button>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>

      <button
        type="button"
        onClick={fitToView}
        title="Fit map to current view"
        aria-label="Fit map to current view"
        className="absolute bottom-3 right-3 z-[1000] inline-flex items-center gap-1.5 rounded-md border border-border bg-surface/95 px-2.5 py-1.5 text-xs font-semibold text-text-muted shadow-sm hover:bg-muted hover:text-primary"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M8 3H5a2 2 0 0 0-2 2v3" />
          <path d="M16 3h3a2 2 0 0 1 2 2v3" />
          <path d="M8 21H5a2 2 0 0 1-2-2v-3" />
          <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
        </svg>
        Fit
      </button>
    </div>
  );
}
