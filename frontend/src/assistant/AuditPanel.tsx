import { useState } from "react";
import type { AuditBlock } from "@/types";
import { Badge } from "@/design/primitives";

export function AuditPanel({ audit }: { audit: AuditBlock[] }) {
  const [open, setOpen] = useState(false);
  if (!audit.length) return null;

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen((o) => !o)}
        className="text-[11px] font-semibold text-primary hover:underline"
      >
        {open ? "▾ Hide the work" : "▸ How did you get this?"}
      </button>
      {open && (
        <div className="mt-1.5 space-y-2 border-l-2 border-border pl-3">
          {audit.map((a, i) => (
            <div key={i} className="text-xs text-ink">
              {a.term && (
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-primary">{a.term}</span>
                  {a.source && <Badge variant="info">{a.source}</Badge>}
                </div>
              )}
              {a.definition && <p className="text-text-muted mt-0.5 leading-snug">{a.definition}</p>}
              {a.codeSets && a.codeSets.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {a.codeSets.map((c) => (
                    <span key={c} className="bg-inset text-primary font-mono text-[10px] px-1.5 py-0.5 rounded-sm">
                      {c}
                    </span>
                  ))}
                </div>
              )}
              {a.notes && <p className="text-text-faint mt-0.5 italic">{a.notes}</p>}
              {a.proxy && (
                <div className="mt-1.5 bg-warning-bg/60 border border-[#fed7aa] rounded-md p-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="warning">Modeled proxy</Badge>
                    <span className="font-semibold text-warning-text">confidence: {a.proxy.confidence}</span>
                  </div>
                  <p className="text-text-muted mt-1"><b>Approach:</b> {a.proxy.proxyApproach}</p>
                  <p className="text-text-muted"><b>Parameter:</b> {a.proxy.parameter}</p>
                  <p className="text-text-faint italic mt-0.5"><b>Limitation:</b> {a.proxy.limitation}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
