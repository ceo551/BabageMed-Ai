import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Pricing — Plans for the bilingual AI workspace",
  description:
    "Pervagans pricing: a Free plan with 500 monthly credits, Pro at $20/mo, and Max at $60/mo with 200,000 credits. All models, image, video, deep research and agent mode.",
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: "Pervagans Pricing — Plans for the bilingual AI workspace",
    description:
      "Simple AI assistant pricing that scales with you. Start free with 500 monthly credits, upgrade to Pro ($20/mo) or Max ($60/mo) for higher limits, all models and every feature.",
    url: "https://pervagans.com/pricing",
    type: "website",
  },
};

const FAQ = [
  {
    q: "Is there a free plan?",
    a: "Yes. The Free plan costs $0 and includes 500 credits every month, with access to the core Pervagans experience: multi-model chat, Spaces, the 8 focused workspaces, the skills catalog and one-click connectors. It is a real product, not a time-limited trial — use it for as long as you like and upgrade only when you need more.",
  },
  {
    q: "What is a credit?",
    a: "A credit is the unit we use to meter AI usage. Each message, image, video or deep-research run consumes credits based on the model and how much work it does — a quick chat with a fast model costs very little, while a long agent run or a high-resolution video costs more. Free includes 500 credits a month and Max includes 200,000, so heavier users always have room to work.",
  },
  {
    q: "Can I change plans later?",
    a: "Absolutely. You can upgrade, downgrade or switch between monthly and annual billing at any time from your account settings. Upgrades take effect immediately so you get the higher limits right away, and any change is prorated so you are never double-charged.",
  },
  {
    q: "What payment methods do you accept?",
    a: "Paid plans are billed securely by card (Visa, Mastercard and American Express) through our payment processor. You can choose monthly or annual billing, and annual billing saves roughly two months compared to paying month to month.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. There are no lock-in contracts. Cancel whenever you want and you keep paid access until the end of your current billing period, after which your account simply returns to the Free plan. Your Spaces, files and Gallery stay with you — your data stays yours.",
  },
];

const SCHEMA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://pervagans.com/" },
        { "@type": "ListItem", position: 2, name: "Pricing", item: "https://pervagans.com/pricing" },
      ],
    },
    {
      "@type": "Product",
      name: "Pervagans",
      description:
        "A bilingual (English/Arabic) AI assistant and workspace: multi-model chat, Spaces, focused workspaces, expert skills, MCP connectors, image and video generation, deep research and agent mode.",
      brand: { "@type": "Brand", name: "Pervagans" },
      url: "https://pervagans.com/pricing",
      offers: [
        {
          "@type": "Offer",
          name: "Free",
          price: "0",
          priceCurrency: "USD",
          url: "https://pervagans.com/pricing",
          availability: "https://schema.org/InStock",
        },
        {
          "@type": "Offer",
          name: "Pro",
          price: "20",
          priceCurrency: "USD",
          url: "https://pervagans.com/pricing",
          availability: "https://schema.org/InStock",
        },
        {
          "@type": "Offer",
          name: "Max",
          price: "60",
          priceCurrency: "USD",
          url: "https://pervagans.com/pricing",
          availability: "https://schema.org/InStock",
        },
      ],
    },
    {
      "@type": "FAQPage",
      mainEntity: FAQ.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ],
};

export default function PricingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(SCHEMA) }}
      />

      {/* Hero */}
      <section className="mkt-section mkt-hero">
        <div className="mkt-wrap">
          <span className="mkt-eyebrow">Pricing</span>
          <h1 className="mkt-h1">Simple pricing that scales with you</h1>
          <p className="mkt-lede">
            One bilingual AI assistant and workspace, three plans. Start free with 500 monthly
            credits, then upgrade when you are ready for higher limits, every model and the full
            toolkit — image and video generation, deep research and agent mode. No lock-in, cancel
            anytime, and your data stays yours.
          </p>
          <div className="mkt-cta-row">
            <Link href="/" className="mkt-btn mkt-btn-primary">
              Start free
            </Link>
            <Link href="/product" className="mkt-btn mkt-btn-ghost">
              See the product
            </Link>
          </div>
        </div>
      </section>

      {/* Plans */}
      <section className="mkt-section">
        <div className="mkt-wrap">
          <div className="mkt-pricing">
            {/* Free */}
            <div className="mkt-plan">
              <div className="mkt-plan-name">Free</div>
              <div className="mkt-price">
                $0<small>/mo</small>
              </div>
              <p className="mkt-sub" style={{ marginTop: 4 }}>
                Everything you need to try a serious AI workspace.
              </p>
              <Link href="/" className="mkt-btn mkt-btn-ghost">
                Start free
              </Link>
              <ul className="mkt-plan-features">
                <li>500 credits every month</li>
                <li>Multi-model chat across leading AI models</li>
                <li>Spaces — projects with pinned model and memory</li>
                <li>All 8 focused workspaces</li>
                <li>Skills catalog (58 expert skills)</li>
                <li>One-click MCP connectors</li>
                <li>Canvas / Artifacts editor</li>
              </ul>
            </div>

            {/* Pro — featured */}
            <div className="mkt-plan mkt-plan--featured">
              <span className="mkt-plan-badge">Most popular</span>
              <div className="mkt-plan-name">Pro</div>
              <div className="mkt-price">
                $20<small>/mo</small>
              </div>
              <p className="mkt-sub" style={{ marginTop: 4 }}>
                The full toolkit for everyday professional work.
              </p>
              <Link href="/" className="mkt-btn mkt-btn-primary">
                Start Pro
              </Link>
              <ul className="mkt-plan-features">
                <li>Everything in Free, plus:</li>
                <li>Far higher monthly credits</li>
                <li>Access to every model (Opus 4.8, GPT 5.5, Gemini Pro 3.1 and more)</li>
                <li>Image &amp; video generation with a saved Gallery</li>
                <li>Deep Research with numbered citations</li>
                <li>Agent Mode over your connected tools</li>
                <li>All connectors and skills enabled</li>
              </ul>
            </div>

            {/* Max */}
            <div className="mkt-plan">
              <div className="mkt-plan-name">Max</div>
              <div className="mkt-price">
                $60<small>/mo</small>
              </div>
              <p className="mkt-sub" style={{ marginTop: 4 }}>
                Highest limits for power users and heavy automation.
              </p>
              <Link href="/login" className="mkt-btn mkt-btn-ghost">
                Get Max
              </Link>
              <ul className="mkt-plan-features">
                <li>Everything in Pro, plus:</li>
                <li>200,000 credits every month</li>
                <li>Highest usage limits across all features</li>
                <li>Priority access during peak demand</li>
                <li>Room for long agent runs and big research reports</li>
                <li>High-volume image &amp; video generation</li>
              </ul>
            </div>
          </div>

          <p className="mkt-sub mkt-center" style={{ marginTop: 24 }}>
            Pro and Max can be billed monthly or annually — choose annual billing and you save
            roughly two months versus paying month to month. Prices shown in USD.
          </p>
        </div>
      </section>

      {/* Stats band */}
      <section className="mkt-section mkt-section--tight">
        <div className="mkt-wrap">
          <div className="mkt-stats">
            <div className="mkt-stat">
              <div className="mkt-stat-n">7+</div>
              <div className="mkt-stat-l">leading models</div>
            </div>
            <div className="mkt-stat">
              <div className="mkt-stat-n">8</div>
              <div className="mkt-stat-l">focused workspaces</div>
            </div>
            <div className="mkt-stat">
              <div className="mkt-stat-n">58</div>
              <div className="mkt-stat-l">expert skills</div>
            </div>
            <div className="mkt-stat">
              <div className="mkt-stat-n">200k</div>
              <div className="mkt-stat-l">credits on Max</div>
            </div>
          </div>
        </div>
      </section>

      {/* What's included / credit explainer */}
      <section className="mkt-section">
        <div className="mkt-wrap">
          <div className="mkt-center">
            <span className="mkt-eyebrow">Credits, explained</span>
            <h2 className="mkt-h2">One simple unit for all your AI usage</h2>
            <p className="mkt-sub">
              Instead of juggling separate meters for chat, images and research, Pervagans uses a
              single pool of credits — so you always know where you stand.
            </p>
          </div>

          <div className="mkt-grid mkt-grid--3" style={{ marginTop: 28 }}>
            <div className="mkt-card">
              <span className="mkt-card-ic">💬</span>
              <h3 className="mkt-h3">Pay for work, not seats</h3>
              <p>
                Every message, generated image, rendered video and deep-research run draws from the
                same monthly credit balance. A quick chat with a fast model costs very little; a long
                agent run or a high-resolution video costs more. You only spend on the work you
                actually do.
              </p>
            </div>
            <div className="mkt-card">
              <span className="mkt-card-ic">📊</span>
              <h3 className="mkt-h3">Predictable by design</h3>
              <p>
                Free includes 500 credits a month and Max includes 200,000, with Pro sitting
                comfortably in between. Your balance refreshes each billing cycle, so you can plan
                your usage with confidence and never get a surprise bill.
              </p>
            </div>
            <div className="mkt-card">
              <span className="mkt-card-ic">🚀</span>
              <h3 className="mkt-h3">Every feature, every plan</h3>
              <p>
                Multi-model chat, Spaces, the 8 workspaces, the skills catalog and connectors are
                part of the core experience. Upgrading raises your limits and unlocks the full
                creative and autonomous toolkit — image, video, Deep Research and Agent Mode.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* What you get deep-dive */}
      <section className="mkt-section">
        <div className="mkt-wrap">
          <div className="mkt-center">
            <span className="mkt-eyebrow">What every plan shares</span>
            <h2 className="mkt-h2">A complete AI workspace, not just a chatbox</h2>
          </div>

          <div className="mkt-rows" style={{ marginTop: 28 }}>
            <div className="mkt-row">
              <div>
                <h3 className="mkt-h3">Multi-model chat and Spaces</h3>
                <p className="mkt-sub">
                  Talk to the best AI models in one place and keep every project grounded in its own
                  context — no more re-explaining yourself across tabs.
                </p>
                <ul className="mkt-list">
                  <li>Claude Opus 4.8, Sonnet 4.6, GPT 5.5/5.4, Gemini Pro 3.1, GLM 5.1, DeepSeek V4 Pro, Qwen 3.7 Max</li>
                  <li>Spaces pin a model, custom instructions, files and persistent memory per project</li>
                  <li>Bilingual English / Arabic with full right-to-left support</li>
                </ul>
              </div>
              <div className="mkt-row-media">
                Pick the right model per task — switch without losing your thread.
              </div>
            </div>

            <div className="mkt-row">
              <div>
                <h3 className="mkt-h3">Skills, connectors and Agent Mode</h3>
                <p className="mkt-sub">
                  Inject real expert guidance and connect your real data, then let the assistant plan
                  and execute multi-step work on your behalf.
                </p>
                <ul className="mkt-list">
                  <li>58 reusable expert skills you toggle on per workspace</li>
                  <li>One-click OAuth connectors over MCP — Notion, Slack, GitHub, Linear, Google Drive and more</li>
                  <li>Agent Mode plans steps, calls your tools, then writes a clear final answer</li>
                </ul>
              </div>
              <div className="mkt-row-media">
                Read and act on your real data — securely, only when you connect it.
              </div>
            </div>

            <div className="mkt-row">
              <div>
                <h3 className="mkt-h3">Create and research</h3>
                <p className="mkt-sub">
                  Generate visuals, run autonomous research and edit long documents side-by-side with
                  the chat.
                </p>
                <ul className="mkt-list">
                  <li>Image (GPT Image, Qwen-Image, Wan) and video (Sora, Happy Horse) with a saved Gallery</li>
                  <li>Deep Research returns a structured, cited report with numbered citations</li>
                  <li>Canvas / Artifacts for editing documents and code beside the conversation</li>
                </ul>
              </div>
              <div className="mkt-row-media">
                Privacy-first and cited by default — your data stays yours.
              </div>
            </div>
          </div>

          <div className="mkt-cta-row mkt-center" style={{ marginTop: 28 }}>
            <Link href="/product" className="mkt-btn mkt-btn-ghost">
              Explore the product
            </Link>
            <Link href="/use-cases" className="mkt-btn mkt-btn-ghost">
              See use cases
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mkt-section">
        <div className="mkt-wrap">
          <div className="mkt-center">
            <span className="mkt-eyebrow">FAQ</span>
            <h2 className="mkt-h2">Pricing questions, answered</h2>
            <p className="mkt-sub">
              Still deciding? Learn more <Link href="/about">about Pervagans</Link> or just{" "}
              <Link href="/">start free</Link>.
            </p>
          </div>

          <div className="mkt-faq" style={{ marginTop: 24 }}>
            {FAQ.map((f) => (
              <details className="mkt-faq-item" key={f.q}>
                <summary>{f.q}</summary>
                <div>{f.a}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="mkt-section">
        <div className="mkt-wrap">
          <div className="mkt-cta-band">
            <h2 className="mkt-h2">Start free, upgrade when you grow</h2>
            <p className="mkt-sub">
              Create your account in seconds and put a full bilingual AI workspace to work today —
              no credit card required to begin.
            </p>
            <div className="mkt-cta-row">
              <Link href="/" className="mkt-btn mkt-btn-primary">
                Start free
              </Link>
              <Link href="/login" className="mkt-btn mkt-btn-ghost">
                Sign in
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
