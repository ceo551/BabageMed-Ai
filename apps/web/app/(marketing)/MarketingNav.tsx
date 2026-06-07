"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

// Interactive top nav for the public marketing pages: nav links, a light/dark
// theme toggle, a language (EN/AR) switch, the Start-free CTA, and a working
// hamburger menu on mobile (the old server-rendered nav just hid its links
// below 640px with no way to reach them). Theme + locale are persisted under
// the same keys the app + pre-paint bootstrap use (pervagans:theme /
// pervagans:locale) so the choice carries into the app.

type Loc = "en" | "ar";

const NAV: Record<Loc, { href: string; label: string }[]> = {
  en: [
    { href: "/product", label: "Product" },
    { href: "/models", label: "Models" },
    { href: "/effects", label: "Effects" },
    { href: "/pricing", label: "Pricing" },
    { href: "/about", label: "About" },
  ],
  ar: [
    { href: "/ar/models", label: "النماذج" },
    { href: "/ar/effects", label: "التأثيرات" },
    { href: "/ar/use-cases", label: "حالات الاستخدام" },
    { href: "/pricing", label: "الأسعار" },
  ],
};

const SunIcon = (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="4" /><path d="M12 2v2" /><path d="M12 20v2" /><path d="m4.93 4.93 1.41 1.41" /><path d="m17.66 17.66 1.41 1.41" /><path d="M2 12h2" /><path d="M20 12h2" /><path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" />
  </svg>
);
const MoonIcon = (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
  </svg>
);
const MenuIcon = (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
    <path d="M3 6h18" /><path d="M3 12h18" /><path d="M3 18h18" />
  </svg>
);
const CloseIcon = (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
    <path d="M18 6 6 18" /><path d="m6 6 12 12" />
  </svg>
);

export function MarketingNav({ locale }: { locale: Loc }) {
  const pathname = usePathname() || "/";
  const links = NAV[locale];
  const home = locale === "ar" ? "/ar/models" : "/";
  const startFree = locale === "ar" ? "ابدأ مجانًا" : "Start free";

  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    setTheme(document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark");
  }, []);

  // Close the mobile menu on route change.
  useEffect(() => { setOpen(false); }, [pathname]);

  // Lock body scroll + close on Escape while the drawer is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [open]);

  function toggleTheme() {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("pervagans:theme", next); } catch { /* storage off */ }
  }

  // Switch language: go to the other language's equivalent page (the pages that
  // exist in both), else the other language's entry, and remember the choice.
  const other: Loc = locale === "ar" ? "en" : "ar";
  function langTarget(): string {
    const has = (seg: string) => pathname.includes(`/${seg}`);
    if (locale === "en") {
      if (has("effects")) return "/ar/effects";
      if (has("use-cases")) return "/ar/use-cases";
      if (has("models")) return "/ar/models";
      return "/ar/models";
    }
    if (has("effects")) return "/effects";
    if (has("use-cases")) return "/use-cases";
    if (has("models")) return "/models";
    return "/models";
  }
  function switchLang() {
    try { localStorage.setItem("pervagans:locale", other); } catch { /* storage off */ }
    // Full navigation so the pre-paint bootstrap re-applies <html lang/dir>.
    window.location.href = langTarget();
  }
  const langLabel = other === "ar" ? "العربية" : "English";
  const themeLabel = theme === "light" ? (locale === "ar" ? "الوضع الداكن" : "Dark mode") : (locale === "ar" ? "الوضع الفاتح" : "Light mode");

  return (
    <header className="mkt-nav">
      <nav className="mkt-nav-inner" aria-label={locale === "ar" ? "رئيسي" : "Primary"}>
        <Link href={home} className="mkt-brand">
          <img src="/pervagans-icon.png" alt="" width={26} height={26} />
          Pervagans
        </Link>

        <div className="mkt-nav-links mkt-nav-links--desktop">
          {links.map((l) => (
            <Link key={l.href} href={l.href}>{l.label}</Link>
          ))}
        </div>

        <span className="mkt-nav-spacer" />

        <div className="mkt-nav-cta">
          <button type="button" className="mkt-icon-btn" onClick={toggleTheme} aria-label={themeLabel} title={themeLabel}>
            {theme === "light" ? MoonIcon : SunIcon}
          </button>
          <button type="button" className="mkt-lang-btn" onClick={switchLang} aria-label={langLabel} title={langLabel}>
            {langLabel}
          </button>
          <Link href={home === "/ar/models" ? "/" : "/"} className="mkt-btn mkt-btn-primary mkt-btn-sm mkt-nav-links--desktop">{startFree}</Link>
          <button
            type="button"
            className="mkt-icon-btn mkt-nav-burger"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? CloseIcon : MenuIcon}
          </button>
        </div>
      </nav>

      {mounted && open && createPortal(
        <>
          <div className="mkt-drawer-backdrop" onClick={() => setOpen(false)} aria-hidden="true" />
          <aside className="mkt-drawer" dir={locale === "ar" ? "rtl" : "ltr"} role="dialog" aria-modal="true" aria-label={locale === "ar" ? "القائمة" : "Menu"}>
            <div className="mkt-drawer-head">
              <Link href={home} className="mkt-brand" onClick={() => setOpen(false)}>
                <img src="/pervagans-icon.png" alt="" width={24} height={24} />
                Pervagans
              </Link>
              <button type="button" className="mkt-icon-btn" onClick={() => setOpen(false)} aria-label={locale === "ar" ? "إغلاق" : "Close"}>
                {CloseIcon}
              </button>
            </div>
            <nav className="mkt-drawer-links" aria-label={locale === "ar" ? "روابط" : "Links"}>
              {links.map((l) => (
                <Link key={l.href} href={l.href} className="mkt-drawer-link" onClick={() => setOpen(false)}>{l.label}</Link>
              ))}
            </nav>
            <div className="mkt-drawer-foot">
              <button type="button" className="mkt-drawer-link mkt-drawer-theme" onClick={toggleTheme}>
                <span>{theme === "light" ? MoonIcon : SunIcon}</span>
                {themeLabel}
              </button>
              <Link href="/" className="mkt-btn mkt-btn-primary" onClick={() => setOpen(false)}>{startFree}</Link>
            </div>
          </aside>
        </>,
        document.body,
      )}
    </header>
  );
}
