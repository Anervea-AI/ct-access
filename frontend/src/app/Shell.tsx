import type { ReactNode } from "react";
import { TopBar } from "./TopBar";
import { Sidebar } from "./Sidebar";
import { AssistantPanel } from "@/assistant/AssistantPanel";
import { useUi } from "@/state/ui";

export function Shell({ children }: { children: ReactNode }) {
  const open = useUi((s) => s.assistantOpen);
  const fullscreen = useUi((s) => s.assistantFullscreen);

  return (
    <div className="flex h-full flex-col">
      <TopBar />
      <div className="flex flex-1 min-h-0">
        <Sidebar />
        <main className="flex-1 min-w-0 overflow-y-auto">
          <div className="mx-auto max-w-[100rem] px-6 py-4 xl:px-8">{children}</div>
        </main>
        {open && !fullscreen && (
          <aside className="w-[26rem] shrink-0 border-l border-border bg-surface flex flex-col">
            <AssistantPanel />
          </aside>
        )}
      </div>
      {open && fullscreen && (
        <div className="fixed inset-0 z-40 bg-cream/95 backdrop-blur-sm flex flex-col">
          <div className="mx-auto w-full max-w-[60rem] flex-1 min-h-0 flex flex-col p-4">
            <AssistantPanel />
          </div>
        </div>
      )}
    </div>
  );
}
