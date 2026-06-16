import type {
  ChatResponse, Criterion, Dataset, HcpProfile, MapHcp, MapSiteOut, ParseCriterionResponse,
  PlanCriteriaResponse, ReferralNetwork, ScenarioState,
} from "@/types";

export const API_BASE =
  (import.meta.env.VITE_API_BASE as string | undefined) ?? "http://localhost:8000";

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} on ${path}`);
  return (await res.json()) as T;
}

export const api = {
  health: () => http<{ status: string; llmEnabled: boolean; model: string | null; dataVersion: string }>("/api/health"),
  dataset: () => http<Dataset>("/api/dataset"),
  chat: (message: string, scenario: ScenarioState, history: { role: string; content: string }[]) =>
    http<ChatResponse>("/api/chat", {
      method: "POST",
      body: JSON.stringify({ message, scenario, history }),
    }),
  // --- AI-assisted criterion builder ---
  parseCriterion: (text: string, type: "inclusion" | "exclusion") =>
    http<ParseCriterionResponse>("/api/feasibility/parse-criterion", {
      method: "POST",
      body: JSON.stringify({ text, type }),
    }),
  // agentic editor: returns a plan of add/modify actions over the current criteria
  planCriteria: (text: string, type: "inclusion" | "exclusion", criteria: Criterion[]) =>
    http<PlanCriteriaResponse>("/api/feasibility/plan-criteria", {
      method: "POST",
      body: JSON.stringify({
        text,
        type,
        criteria: criteria.map((c) => ({
          id: c.id, type: c.type, label: c.label, enabled: c.enabled,
          category: c.category, baseReductionPct: c.baseReductionPct,
          dataSource: c.dataSource ?? null, param: c.param ?? null,
        })),
      }),
    }),
  // --- interactive map ---
  mapSites: () => http<MapSiteOut[]>("/api/map/sites"),
  mapHcps: (decileMin = 7, specialty?: string | null, limit = 1500) =>
    http<MapHcp[]>(
      `/api/map/hcps?decileMin=${decileMin}&limit=${limit}` +
        (specialty ? `&specialty=${encodeURIComponent(specialty)}` : ""),
    ),
  nearbyHcps: (siteId: string, radius: number, decileMin = 0, specialty?: string | null) =>
    http<MapHcp[]>(
      `/api/map/nearby?siteId=${encodeURIComponent(siteId)}&radius=${radius}&decileMin=${decileMin}` +
        (specialty ? `&specialty=${encodeURIComponent(specialty)}` : ""),
    ),
  hcpNetwork: (npi: number, limit = 60) =>
    http<ReferralNetwork>(`/api/map/hcp/${npi}/network?limit=${limit}`),
  hcpProfile: (npi: number) => http<HcpProfile>(`/api/map/hcp/${npi}/profile`),
  exportPdf: async (scenario: ScenarioState, title: string): Promise<Blob> => {
    const res = await fetch(`${API_BASE}/api/export/pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenario, title }),
    });
    if (!res.ok) throw new Error(`PDF export failed: ${res.status}`);
    return await res.blob();
  },
};
