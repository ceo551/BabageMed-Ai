import Link from "next/link";
import "../(marketing)/marketing.css";

// Arabic (RTL) chrome for the public Arabic marketing surface (/ar/models …).
// Lives OUTSIDE the (marketing) route group so it does not inherit the English
// LTR marketing layout — it provides its own dir="rtl", Arabic nav + footer.
// Server component (no client JS) so the full Arabic copy ships in the initial
// HTML for crawlers. AppShell skips the app sidebar for /ar (MARKETING_ROUTE).
export default function ArabicMarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mkt" dir="rtl" lang="ar">
      <header className="mkt-nav">
        <nav className="mkt-nav-inner" aria-label="رئيسي">
          <Link href="/ar/models" className="mkt-brand">
            <img src="/pervagans-icon.png" alt="" width={26} height={26} />
            Pervagans
          </Link>
          <div className="mkt-nav-links">
            <Link href="/ar/models">النماذج</Link>
            <Link href="/ar/effects">التأثيرات</Link>
            <Link href="/ar/use-cases">حالات الاستخدام</Link>
            <Link href="/pricing">الأسعار</Link>
          </div>
          <span className="mkt-nav-spacer" />
          <div className="mkt-nav-cta">
            <Link href="/models" className="mkt-nav-links" style={{ marginInlineStart: 0 }}>English</Link>
            <Link href="/" className="mkt-btn mkt-btn-primary mkt-btn-sm">ابدأ مجانًا</Link>
          </div>
        </nav>
      </header>

      <main className="mkt-main">{children}</main>

      <footer className="mkt-footer" aria-label="تذييل">
        <div className="mkt-footer-inner">
          <div className="mkt-foot-col" style={{ maxWidth: 280 }}>
            <Link href="/ar/models" className="mkt-brand" style={{ marginBottom: 6 }}>
              <img src="/pervagans-icon.png" alt="" width={24} height={24} />
              Pervagans
            </Link>
            <p style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.7, margin: 0 }}>
              مساعد ومساحة عمل بالذكاء الاصطناعي ثنائية اللغة (عربي/إنجليزي). تحدّث مع أفضل النماذج، ثم اربط كل مهمة بتعليماتك وملفاتك ومهاراتك وموصّلاتك.
            </p>
          </div>
          <div className="mkt-foot-col">
            <h4>المنتج</h4>
            <Link href="/ar/models">النماذج</Link>
            <Link href="/ar/effects">التأثيرات</Link>
            <Link href="/ar/use-cases">حالات الاستخدام</Link>
            <Link href="/pricing">الأسعار</Link>
          </div>
          <div className="mkt-foot-col">
            <h4>ابدأ الآن</h4>
            <Link href="/">ابدأ مجانًا</Link>
            <Link href="/models">English</Link>
          </div>
        </div>
        <div className="mkt-foot-legal">© {2026} Pervagans · pervagans.com · مساعد ومساحة عمل بالذكاء الاصطناعي</div>
      </footer>
    </div>
  );
}
