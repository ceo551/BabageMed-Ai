"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { auth, type User } from "./api";

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

  const refresh = useCallback(async () => {
    try {
      const r = await auth.me();
      setUser(r.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    // Server-side first: clear the session row + cookie so a stolen token
    // is invalidated. If the call fails, we still wipe local state below
    // so the next signed-in user doesn't inherit the previous user's
    // drafts / preferences / active connectors.
    let serverOk = true;
    try { await auth.logout(); } catch { serverOk = false; }
    setUser(null);
    if (typeof window !== "undefined") {
      try {
        // Wipe app-namespaced keys but leave generic browser data alone.
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const k = localStorage.key(i);
          if (k && (k.startsWith("babagemed:") || k.startsWith("babbage:"))) {
            localStorage.removeItem(k);
          }
        }
        sessionStorage.clear();
      } catch { /* private-mode storage quotas */ }
    }
    if (!serverOk) {
      // Surface failure so the user can retry. Throwing here lets the
      // calling button render an error toast.
      throw new Error("Logout reached this device but the server didn't confirm. Try again.");
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return <Ctx.Provider value={{ user, loading, refresh, signOut }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
