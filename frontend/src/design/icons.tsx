// Minimal inline line icons (currentColor, 1.75 stroke) — avoids an icon-lib dep.
type P = { size?: number; className?: string };
const base = (size: number, className?: string) => ({
  width: size, height: size, viewBox: "0 0 24 24", fill: "none",
  stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const, className,
});

export const FunnelIcon = ({ size = 18, className }: P) => (
  <svg {...base(size, className)}><path d="M3 4h18l-7 8v7l-4 2v-9z" /></svg>
);
export const MapPinIcon = ({ size = 18, className }: P) => (
  <svg {...base(size, className)}><path d="M12 21s7-6.4 7-11a7 7 0 1 0-14 0c0 4.6 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></svg>
);
export const LineChartIcon = ({ size = 18, className }: P) => (
  <svg {...base(size, className)}><path d="M4 19V5" /><path d="M4 19h16" /><path d="M7 15l4-5 3 3 4-6" /></svg>
);
export const NetworkIcon = ({ size = 18, className }: P) => (
  <svg {...base(size, className)}><circle cx="6" cy="6" r="2.5" /><circle cx="18" cy="7" r="2.5" /><circle cx="12" cy="18" r="2.5" /><path d="M7.8 7.6 10.5 16M16.2 8.7 13 16M8 6.4l7.5.4" /></svg>
);
export const ActivityIcon = ({ size = 18, className }: P) => (
  <svg {...base(size, className)}><path d="M3 12h4l3 8 4-16 3 8h4" /></svg>
);
export const LayersIcon = ({ size = 18, className }: P) => (
  <svg {...base(size, className)}><path d="M12 3 3 8l9 5 9-5-9-5z" /><path d="M3 13l9 5 9-5" /></svg>
);
export const ChatIcon = ({ size = 18, className }: P) => (
  <svg {...base(size, className)}><path d="M21 12a8 8 0 0 1-11.5 7.2L4 20l1-4.5A8 8 0 1 1 21 12z" /></svg>
);
export const SparkleIcon = ({ size = 18, className }: P) => (
  <svg {...base(size, className)}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.3 6.3l2.5 2.5M15.2 15.2l2.5 2.5M17.7 6.3l-2.5 2.5M8.8 15.2l-2.5 2.5" /></svg>
);
export const PlusIcon = ({ size = 16, className }: P) => (
  <svg {...base(size, className)}><path d="M12 5v14M5 12h14" /></svg>
);
export const CopyIcon = ({ size = 16, className }: P) => (
  <svg {...base(size, className)}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h8" /></svg>
);
export const DownloadIcon = ({ size = 16, className }: P) => (
  <svg {...base(size, className)}><path d="M12 3v12m0 0 4-4m-4 4-4-4M4 21h16" /></svg>
);
export const CloseIcon = ({ size = 16, className }: P) => (
  <svg {...base(size, className)}><path d="M6 6l12 12M18 6 6 18" /></svg>
);
export const ChevronRight = ({ size = 16, className }: P) => (
  <svg {...base(size, className)}><path d="M9 6l6 6-6 6" /></svg>
);
export const ChevronDown = ({ size = 16, className }: P) => (
  <svg {...base(size, className)}><path d="M6 9l6 6 6-6" /></svg>
);
export const SlidersIcon = ({ size = 16, className }: P) => (
  <svg {...base(size, className)}><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" /><circle cx="15" cy="6" r="2" /><circle cx="9" cy="12" r="2" /><circle cx="17" cy="18" r="2" /></svg>
);
export const SendIcon = ({ size = 16, className }: P) => (
  <svg {...base(size, className)}><path d="M4 12 20 4l-6 16-3-7-7-1z" /></svg>
);
export const ExpandIcon = ({ size = 16, className }: P) => (
  <svg {...base(size, className)}><path d="M4 9V4h5M20 15v5h-5M15 4h5v5M9 20H4v-5" /></svg>
);
export const PanelLeftIcon = ({ size = 18, className }: P) => (
  <svg {...base(size, className)}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16" /></svg>
);
export const ChevronsLeft = ({ size = 16, className }: P) => (
  <svg {...base(size, className)}><path d="M11 6l-6 6 6 6M18 6l-6 6 6 6" /></svg>
);
