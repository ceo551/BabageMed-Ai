"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, setOn401Handler, type User } from "./api";
// Static imports for the local state stores. The previous version used
// dynamic import("./store") inside signOut — that produces a separate
// code-split chunk whose URL goes stale after a deploy, so signOut
// would throw ChunkLoadError on the first post-deploy logout and the
// previous user's drafts / connectors leaked into the next session.
import { prefs, session } from "./store";

type AuthState = {
  user: User | null;
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthState>({
  user: null,
  loading: true,
  refresh: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  // In-flight refresh singleton — two concurrent refresh() calls (e.g.
  // tab focus + storage event firing simultaneously) used to both hit
  // /auth/me and could race so the second setUser stomped the first.
  // Dedupe via a Promise ref so concurrent callers await the same
  // network response.
  const refreshInFlight = useRef<Promise<void> | null>(null);
  // Mirror of `user` for the on401 watchdog: only force-redirect to /login when
  // a REAL session expires (we HAD a user, then a call 401'd) — never for an
  // anonymous visitor on the now-public home, whose auth-gated fetches
  // (spaces/connectors) 401 by design.
  const userRef = useRef<User | null>(null);
  useEffect(() => { userRef.current = user; }, [user]);

  const refresh = useCallback(async () => {
    if (refreshInFlight.current) return refreshInFlight.current;
    const p = (async () => {
      try {
        const r = await auth.me();
        setUser(r.user);
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
    refreshInFlight.current = p;
    try {
      await p;
    } finally {
      refreshInFlight.current = null;
    }
  }, []);

  const signOut = useCallback(async () => {
    // Server-side first: clear the session row + cookie so a stolen token
    // is invalidated. If the call fails, we still wipe local state below
    // so the next signed-in user doesn't inherit the previous user's
    // drafts / preferences / active connectors.
    let serverOk = true;
    // Set user=null BEFORE the network call so the UI flips immediately;
    // any component watching `user` won't see a race where they read the
    // previous user between logout()'s resolve and our setUser(null).
    setUser(null);
    try { await auth.logout(); } catch { serverOk = false; }
    if (typeof window !== "undefined") {
      try {
        // Wipe app-namespaced keys but leave generic browser data alone.
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const k = localStorage.key(i);
          if (k && k.startsWith("pervagans:")) {
            localStorage.removeItem(k);
          }
        }
        sessionStorage.clear();
      } catch { /* private-mode storage quotas */ }
      // Wipe the in-memory module-level singletons too — localStorage
      // alone leaves the prev user's draft, active connectors, sidebar
      // widths in memory, and they'd leak to user B on next signin.
      // prefs / session are statically imported above so we can't
      // ChunkLoadError-out of the cleanup.
      try {
        prefs.reset();
        session.resetForNewChat();
        session.clearDraft();
      } catch { /* tolerated */ }
    }
    if (!serverOk) {
      // Surface failure so the user can retry. Throwing here lets the
      // calling button render an error toast.
      throw new Error("Logout reached this device but the server didn't confirm. Try again.");
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Wire the global 401 watchdog so an expired session cookie clears
  // the in-memory user the moment any backend call returns 401. Without
  // this, the sidebar account chip stays "signed in" while every chat
  // /file load 401s silently. Excluded paths (/api/auth/*) are filtered
  // inside setOn401Handler's call site in api.ts.
  useEffect(() => {
    setOn401Handler(() => {
      // Only a session that WAS authenticated and just 401'd is a real expiry.
      // An anonymous visitor (never had a user) hitting a gated endpoint must
      // NOT be force-routed off the public home.
      const hadUser = userRef.current !== null;
      setUser(null);
      if (!hadUser) return;
      // A mid-session 401 means the cookie expired/was revoked. Clearing
      // the user (above) flips the sidebar chip, but the page kept
      // silently 401ing because nothing navigated. Bounce to /login —
      // guarded so we never loop on the auth pages themselves. We do NOT
      // add a blanket "redirect when user===null" route guard: the
      // dashboard is intentionally usable signed-out, and on401 only
      // fires for real authenticated-call 401s (the /api/auth/* probe
      // paths are excluded at the api.ts call site), so anonymous
      // visitors are never force-routed here.
      if (typeof window !== "undefined") {
        const p = window.location.pathname;
        const onAuthPage = /^\/(login|signup|forgot-password|reset-password|verify-email)/.test(p);
        if (!onAuthPage) {
          // Preserve where they were so login bounces them back, mirroring
          // the middleware gate's ?next behaviour.
          const here = p + window.location.search;
          const q = p !== "/" ? `?next=${encodeURIComponent(here)}` : "";
          router.replace(`/login${q}`);
        }
      }
    });
    return () => setOn401Handler(null);
  }, [router]);

  // Periodic re-check so a session that expires on the server side
  // (e.g. operator revoked the session row from /admin) drops the
  // signed-in state on the next interval even if no other API call
  // fires. 5 min is a reasonable middle between "fast feedback" and
  // "extra /me load per tab".
  useEffect(() => {
    const t = setInterval(() => {
      // Skip when the tab is hidden — saves a /me round-trip every
      // 5 min for backgrounded tabs. The visibilitychange listener
      // below catches the focus-back case so we don't drift further
      // than necessary.
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        refresh();
      }
    }, 5 * 60 * 1000);
    const onFocus = () => { if (document.visibilityState === "visible") refresh(); };
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", onFocus);
    return () => {
      clearInterval(t);
      if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onFocus);
    };
  }, [refresh]);

  return <Ctx.Provider value={{ user, loading, refresh, signOut }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
