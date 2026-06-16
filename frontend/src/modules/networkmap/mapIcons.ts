import L from "leaflet";

// Two visually distinct markers: SITE = terracotta teardrop pin; HCP = small dot.
// Warm-palette colors match the design system / KolGraph.
const SITE = "#9a3412";
const SITE_DIM = "#c89a86";
const HCP = "#ffb74d";
const HCP_SEL = "#c2410c";
const CENTER = "#9a3412";

export function siteIcon(dimmed = false): L.DivIcon {
  const fill = dimmed ? SITE_DIM : SITE;
  return L.divIcon({
    className: "alfadev-site-pin",
    html: `<svg width="26" height="32" viewBox="0 0 26 32" xmlns="http://www.w3.org/2000/svg">
      <path d="M13 1C6.4 1 1 6.2 1 12.6 1 21 13 31 13 31s12-10 12-18.4C25 6.2 19.6 1 13 1z"
        fill="${fill}" stroke="#ffffff" stroke-width="1.5"/>
      <circle cx="13" cy="12.5" r="5.2" fill="#ffffff"/>
      <path d="M13 9.3v6.4M9.8 12.5h6.4" stroke="${fill}" stroke-width="1.8" stroke-linecap="round"/>
    </svg>`,
    iconSize: [26, 32],
    iconAnchor: [13, 31],
    popupAnchor: [0, -28],
  });
}

const REFERRAL = "#2563eb"; // matches the referral-edge color

// HCPs that participate in the referral graph are filled BLUE; ordinary HCPs stay gold.
// (selection / network-center states still take visual priority.)
export function hcpIcon(opts: { selected?: boolean; center?: boolean; hasReferrals?: boolean } = {}): L.DivIcon {
  const r = opts.center ? 9 : 6;
  const hasRef = !!opts.hasReferrals && !opts.center && !opts.selected;
  const fill = opts.center ? CENTER : opts.selected ? HCP_SEL : hasRef ? REFERRAL : HCP;
  const stroke = opts.center ? "#ffffff" : hasRef ? "#1e40af" : "#9a3412";
  const size = (r + 3) * 2;
  const c = size / 2;
  return L.divIcon({
    className: "alfadev-hcp-pin",
    html: `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${c}" cy="${c}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>
    </svg>`,
    iconSize: [size, size],
    iconAnchor: [c, c],
    popupAnchor: [0, -r - 2],
  });
}

export const MILES_TO_METERS = 1609.34;
