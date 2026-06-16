import type { ComponentType } from "react";
import {
  ActivityIcon, FunnelIcon, LayersIcon, LineChartIcon, MapPinIcon, NetworkIcon,
} from "@/design/icons";

export interface NavItem {
  path: string;
  label: string;
  code: string;
  priority: string;
  Icon: ComponentType<{ size?: number; className?: string }>;
  blurb: string;
}

export const NAV: NavItem[] = [
  { path: "sites", label: "Site & PI", code: "01", priority: "Demo", Icon: MapPinIcon,
    blurb: "Where should we run this trial, and who should run it?" },
  { path: "feasibility", label: "Feasibility", code: "02", priority: "Demo", Icon: FunnelIcon,
    blurb: "Is this protocol recruitable, and which criterion hurts most?" },
  { path: "forecast", label: "Enrollment", code: "03", priority: "Demo", Icon: LineChartIcon,
    blurb: "How fast will this enroll, and what hits the target date?" },
  { path: "kol", label: "KOL Mapping", code: "04", priority: "P2", Icon: NetworkIcon,
    blurb: "Who are the influential physicians for this indication?" },
  { path: "monitoring", label: "Monitoring", code: "05", priority: "P2", Icon: ActivityIcon,
    blurb: "Is the running trial on track, and how do we rescue it?" },
  { path: "population", label: "Population", code: "06", priority: "P3", Icon: LayersIcon,
    blurb: "Which indications should the portfolio pursue?" },
];

export const DEFAULT_PATH = "feasibility";
