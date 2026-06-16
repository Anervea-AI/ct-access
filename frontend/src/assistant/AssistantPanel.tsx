import { useEffect, useRef, useState } from "react";
import { useStore } from "@/state/store";
import { useUi } from "@/state/ui";
import { api } from "@/lib/api";
import type { AuditBlock, VizSpec } from "@/types";
import { VizRenderer } from "./VizRenderer";
import { AuditPanel } from "./AuditPanel";
import { Spinner, cn } from "@/design/primitives";
import { CloseIcon, ExpandIcon, SendIcon, SparkleIcon } from "@/design/icons";

interface Msg {
  role: "user" | "assistant";
  content: string;
  viz?: VizSpec | null;
  audit?: AuditBlock[];
  toolCalls?: string[];
  usedLlm?: boolean;
  error?: string;
}

const SUGGESTIONS = [
  "What is my eligible pool and biggest constraint?",
  "What happens if I extend the antipsychotic washout to four weeks?",
  "Sites in the Southeast with above-average Black and Hispanic representation",
  "Show the forecast if screen-fail rises to 35%",
  "What proxy are you using for severity?",
];

export function AssistantPanel() {
  const active = useStore((s) => s.scenarios[s.activeId]);
  const closeAssistant = useUi((s) => s.closeAssistant);
  const toggleFullscreen = useUi((s) => s.toggleFullscreen);
  const consumePending = useUi((s) => s.consumePending);

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || loading) return;
    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, { role: "user", content: q }]);
    setInput("");
    setLoading(true);
    try {
      const res = await api.chat(q, active, history);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant", content: res.text, viz: res.viz, audit: res.audit,
          toolCalls: res.toolCalls, usedLlm: res.usedLlm, error: res.error,
        },
      ]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `I couldn't reach the compute service. ${e instanceof Error ? e.message : ""}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // auto-send a query passed in from a module ("ask the assistant" chips)
  useEffect(() => {
    const pending = consumePending();
    if (pending) void send(pending);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  return (
    <div className="flex h-full flex-col bg-surface">
      <div className="h-12 shrink-0 flex items-center gap-2 px-3 border-b border-border">
        <SparkleIcon size={18} className="text-accent" />
        <span className="font-display font-semibold text-ink flex-1">Assistant</span>
        <button onClick={toggleFullscreen} title="Full screen" className="p-1.5 rounded-md text-text-muted hover:bg-hover hover:text-primary">
          <ExpandIcon />
        </button>
        <button onClick={closeAssistant} title="Close" className="p-1.5 rounded-md text-text-muted hover:bg-hover hover:text-primary">
          <CloseIcon />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-sm text-text-muted">
            <p className="mb-2">
              Ask about eligibility, sites, enrollment, KOLs, or population — grounded in the current
              scenario. Every figure can reveal its definition, source, and proxy.
            </p>
            <div className="space-y-1.5 mt-3">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="block w-full text-left text-xs bg-muted hover:bg-hover rounded-md px-3 py-2 text-ink transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            {m.role === "user" ? (
              <div className="bg-primary text-white rounded-2xl rounded-br-sm px-3.5 py-2 text-sm max-w-[85%]">
                {m.content}
              </div>
            ) : (
              <div className="bg-surface border border-border rounded-2xl rounded-bl-sm px-3.5 py-2.5 text-sm text-ink max-w-[92%] w-full">
                <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                {m.viz && <VizRenderer viz={m.viz} />}
                {m.audit && <AuditPanel audit={m.audit} />}
                {m.toolCalls && m.toolCalls.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {m.toolCalls.map((t, j) => (
                      <span key={j} className="bg-inset text-primary font-mono text-[10px] px-1.5 py-0.5 rounded-sm">
                        {t}
                      </span>
                    ))}
                    <span className="text-[10px] text-text-faint ml-1 self-center">
                      {m.usedLlm ? "via OpenAI" : "grounded stub"}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-text-muted text-sm">
            <Spinner /> computing…
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-border p-2.5">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
          className="flex items-end gap-2"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(input);
              }
            }}
            rows={1}
            placeholder="Ask about this scenario…"
            className="flex-1 resize-none bg-surface border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 max-h-28"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="rounded-md bg-primary text-white p-2.5 hover:bg-primary-deep disabled:opacity-50"
          >
            <SendIcon />
          </button>
        </form>
      </div>
    </div>
  );
}
