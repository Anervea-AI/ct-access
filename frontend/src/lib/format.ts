export const fmtInt = (n: number | null | undefined): string =>
  n == null ? "—" : Math.round(n).toLocaleString("en-US");

export const fmtPct = (n: number | null | undefined, digits = 1): string =>
  n == null ? "—" : `${n.toFixed(digits)}%`;

export const fmtRate = (n: number, digits = 2): string => n.toFixed(digits);

export const fmtScore = (n: number): string => n.toFixed(2);

export const fmtDelta = (n: number): string =>
  `${n >= 0 ? "+" : "−"}${Math.abs(Math.round(n)).toLocaleString("en-US")}`;

export const monthLabel = (ym: string | null): string => {
  if (!ym) return "—";
  const [y, m] = ym.split("-");
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${names[parseInt(m, 10) - 1]} ${y}`;
};

export const titleCase = (s: string): string =>
  s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
