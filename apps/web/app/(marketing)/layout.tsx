import Link from "next/link";
import "./marketing.css";
import { MarketingNav } from "./MarketingNav";

// Shared chrome for the PUBLIC marketing pages (/product, /pricing, /about).
// These render chrome-free of the app sidebar (AppShell skips its shell for
// these routes) and get their own marketing nav + footer instead. Server
// component — no client JS — so the full marketed copy is in the initial HTML
// for crawlers.
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mkt">
      <MarketingNav locale="en" />

      <main className="mkt-main">{children}</main>

      <footer className="mkt-footer" aria-label="Footer">
        <div className="mkt-footer-inner">
          <div className="mkt-foot-col" style={{ maxWidth: 280 }}>
            <Link href="/" className="mkt-brand" style={{ marginBottom: 6 }}>
              <img src="/pervagans-icon.png" alt="" width={24} height={24} />
              Pervagans
            </Link>
            <p style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.55, margin: 0 }}>
              A bilingual (EN/AR) AI assistant and workspace. Chat with the best models, then ground every workflow in your own instructions, files, skills and connectors.
            </p>
          </div>
          <div className="mkt-foot-col">
            <h4>Product</h4>
            <Link href="/product">Overview</Link>
            <Link href="/models">Models</Link>
            <Link href="/effects">Effects</Link>
            <Link href="/pricing">Pricing</Link>
            <Link href="/use-cases">Use cases</Link>
          </div>
          <div className="mkt-foot-col">
            <h4>Company</h4>
            <Link href="/about">About</Link>
            <Link href="/company">Company</Link>
          </div>
          <div className="mkt-foot-col">
            <h4>Legal</h4>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/refund">Refund</Link>
          </div>
          <div className="mkt-foot-col">
            <h4>Get started</h4>
            <Link href="/">Start free</Link>
          </div>
        </div>
        <div className="mkt-foot-legal">© {2026} Pervagans · pervagans.com · AI assistant &amp; workspace</div>
      </footer>
    </div>
  );
}
