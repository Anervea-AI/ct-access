import { create } from "zustand";
import type { Criterion, CriterionAction, Dataset, ScenarioState } from "@/types";
import { defaultScenario } from "@/compute";
import { api } from "@/lib/api";

export interface HealthInfo {
  status: string;
  llmEnabled: boolean;
  model: string | null;
  dataVersion: string;
}

interface AppState {
  dataset: Dataset | null;
  health: HealthInfo | null;
  status: "loading" | "ready" | "error";
  error?: string;

  scenarios: Record<string, ScenarioState>;
  order: string[];
  activeId: string;
  compareId: string | null;

  load: () => Promise<void>;
  active: () => ScenarioState;
  compare: () => ScenarioState | null;

  updateActive: (mutator: (s: ScenarioState) => void) => void;
  toggleCriterion: (id: string) => void;
  setCriterionParam: (id: string, value: number) => void;
  addCriterion: (c: Criterion) => void;
  removeCriterion: (id: string) => void;
  setCriterionFields: (id: string, patch: Partial<Pick<Criterion, "label" | "type" | "baseReductionPct" | "enabled">>) => void;
  applyPlan: (actions: CriterionAction[]) => void;
  restoreCriteria: (criteria: Criterion[]) => void;
  setProtocol: (v: string) => void;

  createScenario: (name?: string) => string;
  duplicateActive: (name?: string) => string;
  renameActive: (name: string) => void;
  setActive: (id: string) => void;
  setCompare: (id: string | null) => void;
}

function clone(s: ScenarioState): ScenarioState {
  return structuredClone(s);
}

let counter = 1;

export const useStore = create<AppState>((set, get) => ({
  dataset: null,
  health: null,
  status: "loading",
  scenarios: {},
  order: [],
  activeId: "base",
  compareId: null,

  load: async () => {
    set({ status: "loading" });
    try {
      const [dataset, health] = await Promise.all([api.dataset(), api.health().catch(() => null)]);
      const base = defaultScenario(dataset, "base", "Base scenario");
      set({
        dataset,
        health,
        status: "ready",
        scenarios: { base },
        order: ["base"],
        activeId: "base",
      });
    } catch (e) {
      set({ status: "error", error: e instanceof Error ? e.message : String(e) });
    }
  },

  active: () => get().scenarios[get().activeId],
  compare: () => {
    const id = get().compareId;
    return id ? get().scenarios[id] ?? null : null;
  },

  updateActive: (mutator) => {
    const id = get().activeId;
    const next = clone(get().scenarios[id]);
    mutator(next);
    set({ scenarios: { ...get().scenarios, [id]: next } });
  },

  toggleCriterion: (cid) =>
    get().updateActive((s) => {
      const c = s.criteria.find((x) => x.id === cid);
      if (c) c.enabled = !c.enabled;
    }),

  setCriterionParam: (cid, value) =>
    get().updateActive((s) => {
      const c = s.criteria.find((x) => x.id === cid);
      if (c && c.param) c.param.value = value;
    }),

  addCriterion: (c) =>
    get().updateActive((s) => {
      const i = s.criteria.findIndex((x) => x.id === c.id);
      if (i >= 0) s.criteria[i] = c;   // replace if the same parse was added before
      else s.criteria.push(c);
    }),

  removeCriterion: (cid) =>
    get().updateActive((s) => {
      s.criteria = s.criteria.filter((x) => x.id !== cid);
    }),

  setCriterionFields: (cid, patch) =>
    get().updateActive((s) => {
      const c = s.criteria.find((x) => x.id === cid);
      if (!c) return;
      if (patch.label !== undefined) c.label = patch.label;
      if (patch.type !== undefined) c.type = patch.type;
      if (patch.baseReductionPct !== undefined) c.baseReductionPct = patch.baseReductionPct;
      if (patch.enabled !== undefined) c.enabled = patch.enabled;
    }),

  // Apply a whole plan atomically (one clone / one recompute). Unknown targetIds
  // are skipped, never thrown. paramValue changes widen the slider bounds so a
  // requested value outside the current min/max is still representable & applied.
  applyPlan: (actions) =>
    get().updateActive((s) => {
      for (const a of actions) {
        if (a.op === "add" && a.criterion) {
          const i = s.criteria.findIndex((c) => c.id === a.criterion!.id);
          if (i >= 0) s.criteria[i] = a.criterion!;
          else s.criteria.push(a.criterion!);
          continue;
        }
        if (!a.targetId) continue;
        const c = s.criteria.find((x) => x.id === a.targetId);
        if (!c) continue; // stale/unknown id → skip
        if (a.op === "enable") { c.enabled = true; continue; }
        if (a.op === "disable") { c.enabled = false; continue; }
        for (const ch of a.changes) {
          if (ch.field === "paramValue" && c.param) {
            const v = Number(ch.newValue);
            if (Number.isNaN(v)) continue;
            if (c.dataSource === "age_histogram") {
              // histogram reduction uses param.value directly — min/max are only UI
              // bounds, so widen them to make the requested value representable.
              c.param.min = Math.min(c.param.min, v);
              c.param.max = Math.max(c.param.max, v);
              c.param.value = v;
            } else {
              // slope-based param: min/max feed the reduction normalization, so do
              // NOT widen them — clamp the value into the existing range instead.
              c.param.value = Math.max(c.param.min, Math.min(c.param.max, v));
            }
          } else if (ch.field === "enabled") {
            c.enabled = Boolean(ch.newValue);
          } else if (ch.field === "baseReductionPct") {
            const nr = Number(ch.newValue);
            if (!Number.isNaN(nr)) c.baseReductionPct = nr;
          } else if (ch.field === "label") {
            c.label = String(ch.newValue);
          } else if (ch.field === "type") {
            if (ch.newValue === "inclusion" || ch.newValue === "exclusion") {
              c.type = ch.newValue;
            }
          }
        }
      }
    }),

  restoreCriteria: (criteria) =>
    get().updateActive((s) => { s.criteria = criteria; }),

  setProtocol: (v) => get().updateActive((s) => { s.protocolVersion = v; }),

  createScenario: (name) => {
    const ds = get().dataset!;
    const id = `scn_${counter++}`;
    const sc = defaultScenario(ds, id, name ?? `Scenario ${counter}`);
    set({ scenarios: { ...get().scenarios, [id]: sc }, order: [...get().order, id], activeId: id });
    return id;
  },

  duplicateActive: (name) => {
    const src = get().active();
    const id = `scn_${counter++}`;
    const sc = clone(src);
    sc.id = id;
    sc.name = name ?? `${src.name} (copy)`;
    set({ scenarios: { ...get().scenarios, [id]: sc }, order: [...get().order, id], activeId: id });
    return id;
  },

  renameActive: (name) => get().updateActive((s) => { s.name = name; }),

  setActive: (id) => set({ activeId: id }),
  setCompare: (id) => set({ compareId: id }),
}));
