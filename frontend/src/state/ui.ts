import { create } from "zustand";

const SIDEBAR_KEY = "alfadev.sidebarCollapsed";
const readCollapsed = () => {
  try {
    return localStorage.getItem(SIDEBAR_KEY) === "1";
  } catch {
    return false;
  }
};

interface UiState {
  assistantOpen: boolean;
  assistantFullscreen: boolean;
  pendingQuery: string | null;
  sidebarCollapsed: boolean;
  openAssistant: (query?: string) => void;
  closeAssistant: () => void;
  toggleFullscreen: () => void;
  toggleSidebar: () => void;
  consumePending: () => string | null;
}

export const useUi = create<UiState>((set, get) => ({
  assistantOpen: false,
  assistantFullscreen: false,
  pendingQuery: null,
  sidebarCollapsed: readCollapsed(),
  openAssistant: (query) => set({ assistantOpen: true, pendingQuery: query ?? null }),
  closeAssistant: () => set({ assistantOpen: false, assistantFullscreen: false }),
  toggleFullscreen: () => set({ assistantFullscreen: !get().assistantFullscreen, assistantOpen: true }),
  toggleSidebar: () => {
    const next = !get().sidebarCollapsed;
    try {
      localStorage.setItem(SIDEBAR_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
    set({ sidebarCollapsed: next });
  },
  consumePending: () => {
    const q = get().pendingQuery;
    if (q) set({ pendingQuery: null });
    return q;
  },
}));
