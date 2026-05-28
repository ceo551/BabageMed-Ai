"use client";

// Lightweight client-side stores backed by useSyncExternalStore.
//
// We deliberately don't reach for zustand / redux / jotai — the surface area
// is small and adding a runtime dep means another `npm install` layer in the
// frontend image. The pattern below is what zustand does internally: a
// module-level value + a Set of subscribers + a snapshot getter.
//
// Two stores live here:
//
//   usePrefs    — persisted to localStorage. Survives reload. Holds picks
//                 the user expects to keep across sessions (model, mode,
//                 sidebar collapsed).
//   useSession  — in-memory only. Survives intra-app navigation (/, /mcps,
//                 /spaces, …) so a draft message or a chosen connector chip
//                 doesn't get wiped when you tab away and back. Lost on a
//                 hard reload, which is the desired behaviour for a chat
//                 composer where reloading should give you a clean slate.
//
// Why not Context: Context re-renders every consumer on any change. A
// composer that updates draftText on every keystroke would force the
// entire sidebar tree to re-render. useSyncExternalStore + selector-style
// getters keeps each subscriber pinned to the slice it actually reads.

import { useSyncExternalStore } from "react";

// ─── usePrefs ────────────────────────────────────────────────────────────────
// Persisted user preferences. Reads localStorage once on first access.

export type Prefs = {
  model: string;
  mode: string;
  sidebarCollapsed: boolean;
  // Feature-page left rail (per-feature sub-sidebar) collapse + resize state.
  // Mirrors the main sidebar surface so users can shrink either independently
  // — handy on mid-size monitors where the 3-column feat-shell-3col is tight.
  subSidebarCollapsed: boolean;
  sidebarWidth: number;     // px; clamped 200..360 by setters
  subSidebarWidth: number;  // px; clamped 200..340 by setters
  // Right rail (Instructions / Files / Skills / Connectors panel on each
  // feature page). Same collapse+width pattern.
  railCollapsed: boolean;
  railWidth: number;        // px; clamped 260..480 by setters
};

const PREFS_DEFAULT: Prefs = {
  model: "opus-4.7",
  mode: "bedside",
  sidebarCollapsed: false,
  subSidebarCollapsed: false,
  sidebarWidth: 280,
  subSidebarWidth: 240,
  railCollapsed: false,
  railWidth: 340,
};

// Width bounds shared by the resize handles + the setters. Kept here so a
// future refactor that moves the drag logic can't drift.
const SIDEBAR_MIN = 200, SIDEBAR_MAX = 360;
const SUBSIDEBAR_MIN = 200, SUBSIDEBAR_MAX = 340;
const RAIL_MIN = 260, RAIL_MAX = 480;
function clampN(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

const PREFS_KEY = "babagemed:prefs";

function readPrefs(): Prefs {
  if (typeof window === "undefined") return PREFS_DEFAULT;
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (!raw) return PREFS_DEFAULT;
    const parsed = JSON.parse(raw) as Partial<Prefs>;
    return { ...PREFS_DEFAULT, ...parsed };
  } catch {
    return PREFS_DEFAULT;
  }
}

function createPrefsStore() {
  let state: Prefs = PREFS_DEFAULT;
  let hydrated = false;
  const listeners = new Set<() => void>();

  function hydrate() {
    if (hydrated || typeof window === "undefined") return;
    state = readPrefs();
    hydrated = true;
  }

  function get(): Prefs {
    hydrate();
    return state;
  }

  function set(patch: Partial<Prefs>) {
    hydrate();
    state = { ...state, ...patch };
    if (typeof window !== "undefined") {
      try { window.localStorage.setItem(PREFS_KEY, JSON.stringify(state)); } catch {}
    }
    listeners.forEach((l) => l());
  }

  function subscribe(l: () => void) {
    listeners.add(l);
    return () => { listeners.delete(l); };
  }

  // Server snapshot: SSR can't read localStorage so it always sees defaults.
  // First client render will rehydrate via hydrate() and re-notify.
  function getServerSnapshot(): Prefs { return PREFS_DEFAULT; }

  return { get, set, subscribe, getServerSnapshot };
}

const prefsStore = createPrefsStore();

export function usePrefs(): Prefs {
  return useSyncExternalStore(prefsStore.subscribe, prefsStore.get, prefsStore.getServerSnapshot);
}

export const prefs = {
  setModel: (m: string) => prefsStore.set({ model: m }),
  setMode: (m: string) => prefsStore.set({ mode: m }),
  setSidebarCollapsed: (v: boolean) => prefsStore.set({ sidebarCollapsed: v }),
  toggleSidebar: () => prefsStore.set({ sidebarCollapsed: !prefsStore.get().sidebarCollapsed }),
  setSubSidebarCollapsed: (v: boolean) => prefsStore.set({ subSidebarCollapsed: v }),
  toggleSubSidebar: () => prefsStore.set({ subSidebarCollapsed: !prefsStore.get().subSidebarCollapsed }),
  setSidebarWidth: (v: number) => prefsStore.set({ sidebarWidth: clampN(v, SIDEBAR_MIN, SIDEBAR_MAX) }),
  setSubSidebarWidth: (v: number) => prefsStore.set({ subSidebarWidth: clampN(v, SUBSIDEBAR_MIN, SUBSIDEBAR_MAX) }),
  setRailCollapsed: (v: boolean) => prefsStore.set({ railCollapsed: v }),
  toggleRail: () => prefsStore.set({ railCollapsed: !prefsStore.get().railCollapsed }),
  setRailWidth: (v: number) => prefsStore.set({ railWidth: clampN(v, RAIL_MIN, RAIL_MAX) }),
};

export const PREFS_BOUNDS = {
  sidebar:    { min: SIDEBAR_MIN,    max: SIDEBAR_MAX },
  subSidebar: { min: SUBSIDEBAR_MIN, max: SUBSIDEBAR_MAX },
  rail:       { min: RAIL_MIN,       max: RAIL_MAX },
};

// ─── useSession ──────────────────────────────────────────────────────────────
// In-memory session state. Survives page navigation, lost on reload.

export type Session = {
  draftText: string;
  activeSpaceId: string;
  activeConnectorIds: string[];
};

const SESSION_DEFAULT: Session = {
  draftText: "",
  activeSpaceId: "",
  activeConnectorIds: [],
};

function createSessionStore() {
  let state: Session = SESSION_DEFAULT;
  const listeners = new Set<() => void>();

  function get(): Session { return state; }

  function set(patch: Partial<Session>) {
    state = { ...state, ...patch };
    listeners.forEach((l) => l());
  }

  function subscribe(l: () => void) {
    listeners.add(l);
    return () => { listeners.delete(l); };
  }

  function getServerSnapshot(): Session { return SESSION_DEFAULT; }

  return { get, set, subscribe, getServerSnapshot };
}

const sessionStore = createSessionStore();

export function useSession(): Session {
  return useSyncExternalStore(sessionStore.subscribe, sessionStore.get, sessionStore.getServerSnapshot);
}

export const session = {
  setDraftText: (v: string) => sessionStore.set({ draftText: v }),
  setActiveSpaceId: (id: string) => sessionStore.set({ activeSpaceId: id }),
  setActiveConnectorIds: (ids: string[]) => sessionStore.set({ activeConnectorIds: ids }),
  // Helpers used when starting/loading a chat — connectors + space are
  // per-conversation, draft is per-tab so we keep that and only reset the
  // conversation-scoped bits.
  resetForNewChat: () => sessionStore.set({
    activeSpaceId: "",
    activeConnectorIds: [],
  }),
  // Full clear — used by "New" button after a send.
  clearDraft: () => sessionStore.set({ draftText: "" }),
};
