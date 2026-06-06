import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Company: Pervagans, behind your bilingual AI workspace",
  description:
    "The Pervagans company hub: jump to the product, pricing, about and use cases, read our privacy, terms and refund policies, or get in touch. Pervagans is a bilingual (EN/AR) AI assistant and workspace.",
  alternates: { canonical: "/company" },
  openGraph: {
    title: "Company: Pervagans, behind your bilingual AI workspace",
    description:
      "Meet the company behind Pervagans, the bilingual (English/Arabic) AI assistant and workspace. Explore the product, pricing, use cases, legal policies and how to reach us.",
    url: "https://pervagans.com/company",
    type: "website",
  },
};

const SCHEMA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://pervagans.com/" },
        { "@type": "ListItem", position: 2, name: "Company", item: "https://pervagans.com/company" },
      ],
    },
    {
      "@type": "Organization",
      name: "Pervagans",
      url: "https://pervagans.com/",
      email: "support@pervagans.com",
      description:
        "Pervagans is a bilingual (English/Arabic) AI assistant and workspace: multi-model chat, Spaces, a 58-skill catalog, MCP connectors, AI image and video generation, deep research with citations and an Agent Mode.",
      brand: { "@type": "Brand", name: "Pervagans" },
    },
  ],
};

// Cards point at the primary marketing pages. The whole card is a link, so we
// style the <Link> with the card class and strip its default anchor styling.
const cardLink: React.CSSProperties = { textDecoration: "none", color: "inherit" };

export default function CompanyPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(SCHEMA) }}
      />

      {/* Hero */}
      <section className="mkt-section mkt-hero">
        <div className="mkt-wrap">
          <span className="mkt-eyebrow">Company</span>
          <h1 className="mkt-h1">Pervagans, the company behind your AI workspace</h1>
          <p className="mkt-lede">
            Pervagans builds a bilingual (English &amp; Arabic) AI assistant and workspace, sold as a
            subscription on web and desktop. We bring the leading models together with Spaces, expert
            skills, real connectors and an Agent Mode. It is one calm place to do real work in your
            language. This is the hub for everything public about the company.
          </p>
          <div className="mkt-cta-row">
            <Link href="/" className="mkt-btn mkt-btn-primary">
              Start free
            </Link>
            <Link href="/product" className="mkt-btn mkt-btn-ghost">
              Explore the product
            </Link>
          </div>
          <p className="mkt-trust">
            Web &amp; desktop · English &amp; العربية · Free plan with 500 monthly credits · No card
            to begin
          </p>
        </div>
      </section>

      {/* Explore — links to the main marketing pages */}
      <section className="mkt-section">
        <div className="mkt-wrap">
          <div className="mkt-center">
            <span className="mkt-eyebrow">Explore Pervagans</span>
            <h2 className="mkt-h2">Everything about the company, in one place</h2>
            <p className="mkt-sub">
              Start with the product and pricing, learn why we built Pervagans, or see how people put
              it to work every day.
            </p>
          </div>

          <div className="mkt-grid mkt-grid--3" style={{ marginTop: 28 }}>
            <Link href="/product" className="mkt-card" style={cardLink}>
              <span className="mkt-card-ic">✨</span>
              <h3 className="mkt-h3">Product</h3>
              <p>
                Multi-model chat, Spaces, a 58-skill catalog, MCP connectors, image &amp; video
                generation, deep research and Agent Mode: everything Pervagans can do.
              </p>
            </Link>
            <Link href="/pricing" className="mkt-card" style={cardLink}>
              <span className="mkt-card-ic">💳</span>
              <h3 className="mkt-h3">Pricing</h3>
              <p>
                Simple plans: Free with 500 monthly credits, Pro at $20/mo, and Max at $60/mo with
                200,000 credits. One pool of credits across every feature.
              </p>
            </Link>
            <Link href="/about" className="mkt-card" style={cardLink}>
              <span className="mkt-card-ic">🧭</span>
              <h3 className="mkt-h3">About</h3>
              <p>
                The story and convictions behind Pervagans, and why we built a privacy-first,
                genuinely bilingual workspace where your context, tools and data stay yours.
              </p>
            </Link>
            <Link href="/use-cases" className="mkt-card" style={cardLink}>
              <span className="mkt-card-ic">🎯</span>
              <h3 className="mkt-h3">Use cases</h3>
              <p>
                How students, researchers, writers, analysts, founders and teams use Pervagans to
                research, write, build and ship, in English and Arabic.
              </p>
            </Link>
          </div>
        </div>
      </section>

      {/* What we do */}
      <section className="mkt-section">
        <div className="mkt-wrap">
          <div className="mkt-center">
            <span className="mkt-eyebrow">What we do</span>
            <h2 className="mkt-h2">One workspace for the best AI</h2>
          </div>

          <div style={{ maxWidth: "68ch", margin: "24px auto 0" }}>
            <p className="mkt-sub" style={{ margin: "0 0 16px" }}>
              Pervagans is a single, calm workspace where anyone, in English or Arabic, can do real
              work with the best AI. You choose the model that fits the task (Claude, GPT, Gemini and
              more), give each project its own Space with custom instructions, files and memory,
              switch on the expert skills that sharpen the output, and connect the tools where your
              real data already lives, such as Notion, Slack, GitHub, Google and others.
            </p>
            <p className="mkt-sub" style={{ margin: 0 }}>
              From there, deep research with citations, AI image and video generation, and an Agent
              Mode that takes multi-step actions are all built in, on web and desktop, with full
              right-to-left support. We sell Pervagans as a straightforward subscription, and we ship
              constantly while keeping the principles fixed: the best models, your context, your
              tools, and your data, all yours.
            </p>
          </div>

          <div className="mkt-cta-row mkt-center" style={{ marginTop: 28 }}>
            <Link href="/product" className="mkt-btn mkt-btn-ghost">
              See the product
            </Link>
            <Link href="/use-cases" className="mkt-btn mkt-btn-ghost">
              Browse use cases
            </Link>
          </div>
        </div>
      </section>

      {/* Legal & policies */}
      <section className="mkt-section">
        <div className="mkt-wrap">
          <div className="mkt-center">
            <span className="mkt-eyebrow">Legal &amp; policies</span>
            <h2 className="mkt-h2">The fine print, in plain language</h2>
            <p className="mkt-sub">
              Payments are processed by Paddle.com as our Merchant of Record. Paddle handles
              checkout, billing and taxes/VAT as the seller of record.
            </p>
          </div>

          <div className="mkt-grid mkt-grid--3" style={{ marginTop: 28 }}>
            <Link href="/privacy" className="mkt-card" style={cardLink}>
              <span className="mkt-card-ic">🔒</span>
              <h3 className="mkt-h3">Privacy Policy</h3>
              <p>What we collect, how we use it, and the choices you have over your data.</p>
            </Link>
            <Link href="/terms" className="mkt-card" style={cardLink}>
              <span className="mkt-card-ic">📄</span>
              <h3 className="mkt-h3">Terms of Service</h3>
              <p>The terms that govern your use of Pervagans and your subscription.</p>
            </Link>
            <Link href="/refund" className="mkt-card" style={cardLink}>
              <span className="mkt-card-ic">↩️</span>
              <h3 className="mkt-h3">Refund Policy</h3>
              <p>How refunds work, handled through Paddle as our Merchant of Record.</p>
            </Link>
          </div>
        </div>
      </section>

      {/* Contact + final CTA */}
      <section className="mkt-section">
        <div className="mkt-wrap">
          <div className="mkt-cta-band">
            <span className="mkt-eyebrow">Get in touch</span>
            <h2 className="mkt-h2">Questions about Pervagans?</h2>
            <p className="mkt-sub">
              We&rsquo;d love to hear from you. Reach the team any time at{" "}
              <a href="mailto:support@pervagans.com">support@pervagans.com</a>, or create your
              account and start exploring with the Free plan.
            </p>
            <div className="mkt-cta-row">
              <Link href="/" className="mkt-btn mkt-btn-primary">
                Start free
              </Link>
              <Link href="/pricing" className="mkt-btn mkt-btn-ghost">
                View pricing
              </Link>
            </div>
            <p className="mkt-trust" style={{ marginTop: 18 }}>
              Pervagans · support@pervagans.com · Last updated June 2026
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
