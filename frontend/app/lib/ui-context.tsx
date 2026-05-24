"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { STR, type Locale, type LocaleStrings } from "../i18n";

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
  const [locale, setLocale] = useState<Locale>("en");
  const [theme, setTheme] = useState<Theme>("system");
  const [systemTheme, setSystemTheme] = useState<"light" | "dark">("dark");
  const [collapsed, setCollapsed] = useState(false);

  const effectiveTheme = theme === "system" ? systemTheme : theme;
  const s = STR[locale];

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
    toggleCollapsed: () => setCollapsed((v) => !v),
    s,
  };

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}
