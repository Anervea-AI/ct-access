import type { ReactNode } from "react";

export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

// ---- Button --------------------------------------------------------------- //
type BtnVariant = "primary" | "secondary" | "ghost" | "danger";
export function Button({
  children, variant = "primary", className, ...rest
}: {
  children: ReactNode;
  variant?: BtnVariant;
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const variants: Record<BtnVariant, string> = {
    primary: "bg-primary text-white hover:bg-primary-deep border border-transparent",
    secondary: "bg-transparent text-primary border border-primary hover:bg-primary hover:text-white",
    ghost: "bg-transparent text-ink hover:bg-hover border border-transparent",
    danger: "bg-error-bg text-error-text border border-transparent hover:brightness-95",
  };
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold",
        "transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
        variants[variant],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

// ---- Card ----------------------------------------------------------------- //
export function Card({
  children, className, header, padded = true,
}: {
  children: ReactNode;
  className?: string;
  header?: ReactNode;
  padded?: boolean;
}) {
  return (
    <div className={cn("bg-surface border border-border rounded-lg shadow-sm overflow-hidden", className)}>
      {header && (
        <div className="px-5 py-3 bg-gradient-to-r from-primary-deep to-accent-strong text-white font-display font-semibold text-sm">
          {header}
        </div>
      )}
      <div className={padded ? "p-5" : ""}>{children}</div>
    </div>
  );
}

export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("label-caps text-text-subtle", className)}>{children}</div>;
}

export function Heading({ children, className }: { children: ReactNode; className?: string }) {
  return <h3 className={cn("font-display font-bold text-base text-ink", className)}>{children}</h3>;
}

// ---- KPI ------------------------------------------------------------------ //
export function Kpi({
  label, value, sub, accent = "primary",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  accent?: "primary" | "accent" | "info" | "success";
}) {
  const colors = {
    primary: "text-primary border-t-primary",
    accent: "text-accent border-t-accent",
    info: "text-info-text border-t-[#2563eb]",
    success: "text-success-text border-t-[#16a34a]",
  } as const;
  return (
    <div className={cn("bg-surface border border-border rounded-lg px-4 py-2.5 border-t-2", colors[accent].split(" ")[1])}>
      <div className="label-caps text-text-subtle">{label}</div>
      <div className={cn("kpi-number text-2xl", colors[accent].split(" ")[0])}>{value}</div>
      {sub && <div className="text-[11px] text-text-muted mt-0.5">{sub}</div>}
    </div>
  );
}

// ---- Badge ---------------------------------------------------------------- //
type BadgeVariant = "neutral" | "primary" | "info" | "success" | "warning" | "error" | "gold";
export function Badge({ children, variant = "neutral" }: { children: ReactNode; variant?: BadgeVariant }) {
  const variants: Record<BadgeVariant, string> = {
    neutral: "bg-inset text-ink",
    primary: "bg-primary/10 text-primary",
    info: "bg-info-bg text-info-text",
    success: "bg-success-bg text-success-text",
    warning: "bg-warning-bg text-warning-text",
    error: "bg-error-bg text-error-text",
    gold: "bg-gold/25 text-[#92400e]",
  };
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold", variants[variant])}>
      {children}
    </span>
  );
}

// ---- Toggle --------------------------------------------------------------- //
export function Toggle({
  checked, onChange, disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
        checked ? "bg-primary" : "bg-border-strong",
        disabled && "opacity-50",
      )}
    >
      <span className={cn("inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform", checked ? "translate-x-4" : "translate-x-0.5")} />
    </button>
  );
}

// ---- Slider --------------------------------------------------------------- //
export function Slider({
  label, value, min, max, step = 1, unit = "", onChange, disabled,
}: {
  label?: ReactNode;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className={disabled ? "opacity-50" : ""}>
      {label && (
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-text-muted">{label}</span>
          <span className="text-xs font-semibold text-primary font-mono">{value}{unit}</span>
        </div>
      )}
      <input
        type="range"
        className="w-full"
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </div>
  );
}

// ---- Select / Input ------------------------------------------------------- //
export function Select({
  value, onChange, options, className,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "bg-surface border border-border rounded-sm px-2 py-1.5 text-sm text-ink-plain",
        "focus:outline-none focus:ring-2 focus:ring-primary/30",
        className,
      )}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

export function TextInput({ className, ...rest }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "bg-surface border border-border rounded-sm px-2 py-1.5 text-sm text-ink-plain",
        "focus:outline-none focus:ring-2 focus:ring-primary/30",
        className,
      )}
      {...rest}
    />
  );
}

// ---- Callout -------------------------------------------------------------- //
export function Callout({
  variant = "info", title, children,
}: {
  variant?: "info" | "warning" | "success" | "error";
  title?: ReactNode;
  children: ReactNode;
}) {
  const styles = {
    info: "bg-info-bg text-info-text border-[#bfdbfe]",
    warning: "bg-warning-bg text-warning-text border-[#fed7aa]",
    success: "bg-success-bg text-success-text border-[#bbf7d0]",
    error: "bg-error-bg text-error-text border-[#fecaca]",
  } as const;
  return (
    <div className={cn("rounded-md border p-3 text-sm", styles[variant])}>
      {title && <div className="font-semibold mb-0.5">{title}</div>}
      {children}
    </div>
  );
}

// ---- Table ---------------------------------------------------------------- //
export function DataTable({
  columns, rows, firstColPrimary = true,
}: {
  columns: string[];
  rows: (string | number)[][];
  firstColPrimary?: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c} className="bg-muted text-text-subtle label-caps text-left px-4 py-2 whitespace-nowrap">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-inset hover:bg-muted/60">
              {row.map((cell, j) => (
                <td
                  key={j}
                  className={cn(
                    "px-4 py-2 whitespace-nowrap",
                    firstColPrimary && j === 0 ? "text-primary font-medium" : "text-ink",
                  )}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <div
      className={cn("inline-block h-4 w-4 animate-spin rounded-full border-2 border-border border-t-primary", className)}
      style={{ animationDuration: "800ms" }}
    />
  );
}
