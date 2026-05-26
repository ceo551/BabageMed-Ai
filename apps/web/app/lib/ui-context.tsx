"use client";

import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { STR, type Locale, type LocaleStrings } from "../i18n";
import { usePrefs, prefs } from "./store";

// Persisted in localStorage so a reload keeps the user's pick. Without this
// setLocale("ar") would update state, then window.location.reload() would
// drop the state and useState would re-init back to the "en" default.
const LS_LOCALE = "babagemed:locale";
const LS_THEME  = "babagemed:theme";

function readLocale(): Locale {
  if (typeof window === "undefined") return "en";
  const v = window.localStorage.getItem(LS_LOCALE);
  return v === "ar" || v === "en" ? v : "en";
}
function readTheme(): "light" | "dark" | "system" {
  if (typeof window === "undefined") return "system";
  const v = window.localStorage.getItem(LS_THEME);
  return v === "light" || v === "dark" || v === "system" ? v : "system";
}

// UIContext — global UX state that needs to survive page navigation: chosen
// locale, theme preference, sidebar collapse. Mounted by AppShell (root
// layout), consumed by Sidebar + any page that needs the locale string
// table (e.g. the dashboard composer).

export type Theme = "light" | "dark" | "system";

export type UIContextValue = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
  effectiveTheme: "light" | "dark";
  collapsed: boolean;
  toggleCollapsed: () => void;
  s: LocaleStrings;
};

const UIContext = createContext<UIContextValue | null>(null);

export function useUI(): UIContextValue {
  const ctx = useContext(UIContext);
  if (!ctx) {
    // Render-safe fallback so a stray page that mounts outside AppShell
    // (auth pages) still has sane defaults instead of throwing.
    return {
      locale: "en",
      setLocale: () => {},
      theme: "system",
      setTheme: () => {},
      effectiveTheme: "dark",
      collapsed: false,
      toggleCollapsed: () => {},
      s: STR.en,
    };
  }
  return ctx;
}

export function UIProvider({ children }: { children: React.ReactNode }) {
  // SSR can't read localStorage, so we render with the defaults and rehydrate
  // on the client immediately after mount. The first paint may flash "en/dark"
  // for a frame; for a hard fix we'd inject a tiny inline script in <head>.
  const [locale, setLocaleState] = useState<Locale>("en");
  const [theme, setThemeState] = useState<Theme>("system");
  const [systemTheme, setSystemTheme] = useState<"light" | "dark">("dark");
  // Sidebar collapse lives in the global prefs store so a reload restores
  // the user's pick (previously useState reset to false on every reload).
  const { sidebarCollapsed: collapsed } = usePrefs();
  const hydrated = useRef(false);

  const effectiveTheme = theme === "system" ? systemTheme : theme;
  const s = STR[locale];

  // One-shot rehydration from localStorage on mount.
  useEffect(() => {
    const stored = readLocale();
    if (stored !== locale) setLocaleState(stored);
    const t = readTheme();
    if (t !== theme) setThemeState(t);
    hydrated.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Setters that ALSO persist to localStorage so the pick survives a reload.
  function setLocale(l: Locale) {
    setLocaleState(l);
    if (typeof window !== "undefined") window.localStorage.setItem(LS_LOCALE, l);
  }
  function setTheme(t: Theme) {
    setThemeState(t);
    if (typeof window !== "undefined") window.localStorage.setItem(LS_THEME, t);
  }

  // Track the OS-level colour-scheme preference so "system" is meaningful.
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    setSystemTheme(mq.matches ? "light" : "dark");
    const handler = (e: MediaQueryListEvent) => setSystemTheme(e.matches ? "light" : "dark");
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, []);

  // Reflect locale + theme on <html> so CSS selectors (dir=rtl,
  // data-theme=light) and font fallbacks work everywhere.
  useEffect(() => {
    const r = document.documentElement;
    r.setAttribute("lang", locale);
    r.setAttribute("dir", s.dir);
    r.setAttribute("data-theme", effectiveTheme);
  }, [locale, effectiveTheme, s.dir]);

  const value: UIContextValue = {
    locale, setLocale,
    theme, setTheme,
    effectiveTheme,
    collapsed,
    toggleCollapsed: prefs.toggleSidebar,
    s,
  };

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}
