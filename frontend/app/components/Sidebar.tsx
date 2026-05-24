"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import React from "react";
import { I } from "../icons";
import { useAuth } from "../lib/auth-context";
import { useUI } from "../lib/ui-context";

// Sidebar — extracted from the Dashboard page so it can live in the
// app-wide AppShell and persist across navigations (Claude-style).
//
// Local state (open popovers) stays per-instance, but the surrounding
// theme/locale/collapsed state comes from the UIContext provider mounted
// by AppShell — that's why a theme toggle on /mcps takes effect on
// /spaces too without a remount.
export function Sidebar() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { locale, setLocale, theme, setTheme, effectiveTheme, toggleCollapsed, s } = useUI();

  const displayName = user?.displayName || user?.email?.split("@")[0] || s.user;
  const initials = (user?.displayName || user?.email || "AR")
    .split(/\s+|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("") || "AR";

  function cycleTheme() {
    const next = theme === "dark" ? "light" : theme === "light" ? "system" : "dark";
    setTheme(next);
  }
  function toggleLocale() { setLocale(locale === "en" ? "ar" : "en"); }

  function startNewChat() {
    // Today "New" just navigates home with a hard refresh so all per-message
    // composer state resets. When chat persistence lands this becomes
    // /chat/new.
    router.push("/");
    if (typeof window !== "undefined") window.location.reload();
  }

  const themeIcon = effectiveTheme === "light" ? I.sun : I.moon;
  const themeLabel = theme === "system" ? s.themeSystem : theme === "light" ? s.themeLight : s.themeDark;

  return (
    <aside className="sidebar" aria-label="Sidebar">
      <div className="sb-head">
        <Link className="sb-brand" href="/">
          {I.discLogo}
          <span className="wm">
            <span className="b1">Babage</span>
            <span className="b2">Med</span>
            <span className="b3">AI</span>
          </span>
        </Link>
        <button className="sb-collapse" onClick={toggleCollapsed} aria-label="Collapse sidebar">
          {I.sidebar}
        </button>
      </div>

      <div className="sb-body">
        <button className="sb-new" type="button" title={s.new} onClick={startNewChat}>
          {I.plus}
          <span className="lbl">{s.new}</span>
          <span className="kbd">⌘ K</span>
        </button>

        <Link href="/spaces" className="sb-row" style={{ textDecoration: "none" }}>
          {I.spaces}
          <span className="lbl">{s.spaces}</span>
          <span className="trail-chev">{I.chevR}</span>
        </Link>
        <button className="sb-row" type="button" disabled title={s.recent} style={{ opacity: 0.6, cursor: "not-allowed" }}>
          {I.history}
          <span className="lbl">{s.recent}</span>
          <span className="trail-chev">{I.chevR}</span>
        </button>
        <Link href="/mcps" className="sb-row" style={{ textDecoration: "none" }}>
          {I.connectors}
          <span className="lbl">{s.connectors}</span>
          <span className="trail-chev">{I.chevR}</span>
        </Link>
      </div>

      <div className="sb-foot sb-foot-flat">
        {user ? (
          <Link
            href="/billing"
            className="sb-account"
            title={`${displayName} · ${user.plan} plan`}
            style={{ textDecoration: "none" }}
          >
            <span className="av">{initials}</span>
            <span className="who">
              <span className="nm">{displayName}</span>
              <span className="pl">{user.plan} plan</span>
            </span>
          </Link>
        ) : (
          <div style={{ display: "flex", gap: 6 }}>
            <Link
              href="/login"
              className="sb-row"
              style={{
                flex: 1, justifyContent: "center", textDecoration: "none",
                border: "1px solid var(--border)",
              }}
            ><span className="lbl">Sign in</span></Link>
            <Link
              href="/signup"
              className="sb-row"
              style={{
                flex: 1, justifyContent: "center", textDecoration: "none",
                background: "var(--cyan-soft)", color: "var(--cyan)",
                border: "1px solid var(--cyan-line)",
              }}
            ><span className="lbl">Sign up</span></Link>
          </div>
        )}

        <button className="sb-row" type="button" onClick={cycleTheme} title={`${s.appearance}: ${themeLabel}`}>
          <span className="swatch-square">{themeIcon}</span>
          <span className="lbl">{themeLabel}</span>
        </button>
        <button className="sb-row" type="button" onClick={toggleLocale} title={`${s.language}: ${locale === "en" ? s.langEN : s.langAR}`}>
          <span className="swatch-square">{I.globe}</span>
          <span className="lbl">{locale === "en" ? s.langEN : s.langAR}</span>
        </button>
        <Link href="/admin" className="sb-row" style={{ textDecoration: "none" }} title={s.settings}>
          <span className="swatch-square">{I.gear}</span>
          <span className="lbl">{s.settings}</span>
        </Link>
        <Link href="/billing" className="sb-row" style={{ textDecoration: "none" }} title={s.plans}>
          <span className="swatch-square y">{I.bolt}</span>
          <span className="lbl">{s.plans}</span>
        </Link>
        {user && (
          <button
            className="sb-row"
            type="button"
            onClick={async () => { await signOut(); router.push("/"); }}
            title={s.logout}
          >
            <span className="swatch-square p">{I.logout}</span>
            <span className="lbl">{s.logout}</span>
          </button>
        )}
      </div>
    </aside>
  );
}
