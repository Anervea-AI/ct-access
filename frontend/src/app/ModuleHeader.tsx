import type { ReactNode } from "react";
import { useUi } from "@/state/ui";
import { Badge } from "@/design/primitives";
import { SparkleIcon } from "@/design/icons";

export function ModuleHeader({
  code, title, blurb, priority, actions,
}: {
  code: string;
  title: string;
  blurb: string;
  priority?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-6 mb-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-mono text-xs text-text-faint">Module {code}</span>
          {priority && <Badge variant={priority === "Demo" ? "primary" : "neutral"}>{priority}</Badge>}
        </div>
        <div className="flex items-baseline gap-4 flex-wrap">
          <h1 className="font-display font-bold text-2xl text-ink leading-tight shrink-0">{title}</h1>
          {blurb && <p className="text-sm text-text-muted max-w-2xl">{blurb}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">{actions}</div>
    </div>
  );
}

export function AskChip({ query, label }: { query: string; label?: string }) {
  const open = useUi((s) => s.openAssistant);
  return (
    <button
      onClick={() => open(query)}
      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-primary hover:bg-hover transition-colors"
    >
      <SparkleIcon size={13} className="text-accent" />
      {label ?? "Ask the assistant"}
    </button>
  );
}
