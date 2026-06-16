import { useState } from "react";
import { useStore } from "@/state/store";
import { useUi } from "@/state/ui";
import { ScenarioBar } from "./ScenarioBar";
import { ChatIcon } from "@/design/icons";
import { Badge } from "@/design/primitives";

// Brand logo. Uses the uploaded raster at /alfa-dev-logo.png when present;
// falls back to an on-brand inline recreation (gradient "A" mark + wordmark)
// so the header never breaks if the file isn't there yet.
function Logo() {
  const [imgOk, setImgOk] = useState(true);
  if (imgOk) {
    return (
      <img
        src="/alfa-dev-logo.png"
        alt="alfadev"
        className="h-8 w-auto"
        onError={() => setImgOk(false)}
      />
    );
  }
  return (
    <div className="flex items-center gap-2">
      <svg width="30" height="30" viewBox="0 0 40 40" aria-hidden className="shrink-0">
        <defs>
          <linearGradient id="alfaMark" x1="8" y1="6" x2="30" y2="36" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#fbbf24" />
            <stop offset="0.5" stopColor="#fb923c" />
            <stop offset="1" stopColor="#ea580c" />
          </linearGradient>
        </defs>
        <path
          d="M7 35 L18.6 9 a1.6 1.6 0 0 1 2.8 0 L33 35"
          fill="none" stroke="url(#alfaMark)" strokeWidth="6.2"
          strokeLinecap="round" strokeLinejoin="round"
        />
      </svg>
      <div className="font-display font-bold text-[22px] leading-none tracking-tight flex items-start">
        <span className="text-ink">alfa</span>
        <span className="text-accent">dev</span>
        <span className="text-accent text-[10px] leading-none ml-0.5">™</span>
      </div>
    </div>
  );
}

export function TopBar() {
  const program = useStore((s) => s.dataset?.program);
  const dataSource = useStore((s) => s.dataset?.dataSource);
  const health = useStore((s) => s.health);
  const openAssistant = useUi((s) => s.openAssistant);

  return (
    <header className="h-14 shrink-0 bg-surface border-b border-border flex items-center px-4 gap-4">
      <Logo />
      <div className="hidden lg:block text-xs text-text-muted border-l border-border pl-4 max-w-[22rem] truncate">
        {program}
      </div>
      <div className="flex-1" />
      <ScenarioBar />
      <div className="flex items-center gap-2 ml-2 border-l border-border pl-3">
        {dataSource && (
          <Badge variant={dataSource === "db" ? "primary" : "neutral"}>
            {dataSource === "db" ? "Real RWD" : "Synthetic"}
          </Badge>
        )}
        {health && (
          <Badge variant={health.llmEnabled ? "success" : "neutral"}>
            {health.llmEnabled ? `LLM: ${health.model}` : "LLM: stub"}
          </Badge>
        )}
        <button
          onClick={() => openAssistant()}
          className="inline-flex items-center gap-2 rounded-md bg-primary text-white px-3 py-1.5 text-sm font-semibold hover:bg-primary-deep"
        >
          <ChatIcon size={16} /> Assistant
        </button>
      </div>
    </header>
  );
}
