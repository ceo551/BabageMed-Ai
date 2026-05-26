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
};

const PREFS_DEFAULT: Prefs = {
  model: "opus-4.7",
  mode: "bedside",
  sidebarCollapsed: false,
};

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
