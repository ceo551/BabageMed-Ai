import type { Metadata } from "next";
import Link from "next/link";

const PATH = "/use-cases";
const URL = `https://pervagans.com${PATH}`;

export const metadata: Metadata = {
  title: "AI Use Cases: Writing, Research, Coding & Data",
  description:
    "See what people do with Pervagans: AI for writing, research, coding, and data analysis, plus an Arabic AI assistant, business workflows, and AI image generation.",
  alternates: { canonical: PATH },
  openGraph: {
    title: "AI Use Cases: Writing, Research, Coding & Data",
    description:
      "See what people do with Pervagans: AI for writing, research, coding, and data analysis, plus an Arabic AI assistant, business workflows, and AI image generation.",
    url: URL,
    type: "website",
  },
};

const FAQ = [
  {
    q: "Is Pervagans good for academic research?",
    a: "Yes. Deep Research runs an autonomous, multi-source investigation and returns a structured report with numbered citations, so you can verify every claim against its source. Pair it with the Education & Research workspace: pin a strong reasoning model, upload your papers, and toggle on the deep-research skill for grounded, referenced answers.",
  },
  {
    q: "Can Pervagans help me write code?",
    a: "Yes. Choose a top coding model such as Claude Opus 4.8, GPT 5.5, or DeepSeek V4 Pro, then use Canvas / Artifacts to edit code side-by-side with the chat. Connect GitHub, Linear, or your other tools through MCP connectors so Agent Mode can read issues and act on your real repositories.",
  },
  {
    q: "Does Pervagans work in Arabic?",
    a: "Fully. Pervagans is bilingual English and Arabic with complete right-to-left support across the entire interface. You can chat, translate, research, and generate content in Arabic, and switch between languages mid-conversation without losing context.",
  },
  {
    q: "Can I analyze spreadsheets and CSV files?",
    a: "Yes. Upload your Excel or CSV files to the Data Analysis workspace, enable the data-science skill, and ask in plain language for trends, summaries, pivots, or charts. The assistant keeps your files in the workspace memory so follow-up questions stay in context.",
  },
];

const SCHEMA = [
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://pervagans.com/" },
      { "@type": "ListItem", position: 2, name: "Use cases", item: URL },
    ],
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  },
];

export default function UseCasesPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(SCHEMA) }}
      />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="mkt-section mkt-hero">
        <div className="mkt-wrap mkt-center">
          <span className="mkt-eyebrow">Use cases</span>
          <h1 className="mkt-h1">What can you do with Pervagans?</h1>
          <p className="mkt-lede">
            Pervagans is one bilingual workspace for the work you already do, including writing,
            research, coding, data analysis, business, translation, and image &amp; video
            creation. Bring the best AI models, your own files, expert skills, and connectors
            together, then let the assistant do the heavy lifting.
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
            Free plan includes 500 monthly credits, no credit card required.
          </p>
        </div>
      </section>

      {/* ── Stats band ───────────────────────────────────────────────────── */}
      <section className="mkt-section mkt-section--tight">
        <div className="mkt-wrap">
          <div className="mkt-stats">
            <div className="mkt-stat">
              <div className="mkt-stat-n">7+</div>
              <div className="mkt-stat-l">leading AI models</div>
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
              <div className="mkt-stat-n">EN/AR</div>
              <div className="mkt-stat-l">bilingual &amp; full RTL</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Use-case card grid ───────────────────────────────────────────── */}
      <section className="mkt-section">
        <div className="mkt-wrap">
          <div className="mkt-center">
            <h2 className="mkt-h2">Real workflows, not just a chatbox</h2>
            <p className="mkt-sub">
              Each use case below is a complete way of working. Pick a model, turn on the
              right skills, connect your tools, and Pervagans handles the task end to end.
            </p>
          </div>

          <div className="mkt-grid" style={{ marginTop: 36 }}>
            <div className="mkt-card">
              <span className="mkt-card-ic">✍️</span>
              <h3 className="mkt-h3">Writing &amp; content</h3>
              <p>
                AI for writing that actually sounds like you. Open the Writing workspace, toggle
                on copywriting and SEO skills, and draft articles, landing pages, emails, and
                scripts. Edit long pieces in Canvas / Artifacts beside the chat until every
                paragraph lands.
              </p>
            </div>

            <div className="mkt-card">
              <span className="mkt-card-ic">💻</span>
              <h3 className="mkt-h3">Coding &amp; development</h3>
              <p>
                AI for coding with the strongest models, such as Claude Opus 4.8, GPT 5.5, or DeepSeek
                V4 Pro. Write, refactor, and debug in Canvas, then connect GitHub and Linear via
                MCP so Agent Mode can read issues and act on your real repositories.
              </p>
            </div>

            <div className="mkt-card">
              <span className="mkt-card-ic">🔬</span>
              <h3 className="mkt-h3">Research &amp; academia</h3>
              <p>
                AI for research that you can trust. Deep Research investigates multiple sources
                and returns a structured report with numbered citations. Use the Education &amp;
                Research workspace, upload your papers, and keep everything in context.
              </p>
            </div>

            <div className="mkt-card">
              <span className="mkt-card-ic">📊</span>
              <h3 className="mkt-h3">Data analysis</h3>
              <p>
                AI for data analysis on your own spreadsheets. Drop an Excel or CSV file into the
                Data Analysis workspace, enable the data-science skill, and ask in plain language
                for trends, pivots, summaries, and charts.
              </p>
            </div>

            <div className="mkt-card">
              <span className="mkt-card-ic">📈</span>
              <h3 className="mkt-h3">Business &amp; marketing</h3>
              <p>
                AI for business that takes you from idea to plan. The Business and Financial workspaces help
                you draft strategy, model numbers, write proposals, and build campaigns, each with
                its own instructions, files, and skills.
              </p>
            </div>

            <div className="mkt-card">
              <span className="mkt-card-ic">🌍</span>
              <h3 className="mkt-h3">Translation &amp; bilingual EN/AR</h3>
              <p>
                A true Arabic AI assistant with full right-to-left support. The Translation
                workspace renders fluent English↔Arabic, preserving tone and terminology, and
                you can switch languages mid-chat without losing context.
              </p>
            </div>

            <div className="mkt-card">
              <span className="mkt-card-ic">🎨</span>
              <h3 className="mkt-h3">Image &amp; video creation</h3>
              <p>
                A built-in AI image generator and video studio. Create images with GPT Image,
                Qwen-Image, and Wan, or video with Sora and Happy Horse, all with aspect, seed, and
                negative-prompt controls and a saved Gallery.
              </p>
            </div>

            <div className="mkt-card">
              <span className="mkt-card-ic">🔗</span>
              <h3 className="mkt-h3">Team &amp; customer work</h3>
              <p>
                Connect Notion, Slack, GitHub, Linear, and Google Drive, Gmail, and Calendar with
                one-click OAuth. In Agent Mode, Pervagans plans and executes multi-step tasks
                across your real tools, then writes a clear final answer.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Deep-dive rows ───────────────────────────────────────────────── */}
      <section className="mkt-section">
        <div className="mkt-wrap">
          <div className="mkt-rows">
            <div className="mkt-row">
              <div>
                <span className="mkt-eyebrow">Research</span>
                <h2 className="mkt-h2" style={{ marginTop: 14 }}>
                  Deep Research you can cite
                </h2>
                <p className="mkt-sub">
                  Ask a hard question and let Pervagans run an autonomous, multi-source
                  investigation. It reads widely, weighs what it finds, and returns a structured
                  report with numbered citations, so AI for research means evidence, not guesses.
                </p>
                <ul className="mkt-list">
                  <li>Numbered citations on every claim, traceable to the source</li>
                  <li>Structured reports you can drop straight into a paper or brief</li>
                  <li>Pin a strong reasoning model and add your own PDFs for context</li>
                  <li>Toggle expert skills like deep research and data science per workspace</li>
                </ul>
              </div>
              <div className="mkt-row-media">
                A cited Deep Research report with sources [1]…[12], built automatically
              </div>
            </div>

            <div className="mkt-row">
              <div>
                <span className="mkt-eyebrow">Bilingual</span>
                <h2 className="mkt-h2" style={{ marginTop: 14 }}>
                  An Arabic AI assistant, end to end
                </h2>
                <p className="mkt-sub">
                  Pervagans is bilingual by design. Every page, control, and conversation works
                  in English and Arabic with full right-to-left layout, so translation,
                  research, and writing in Arabic feel native, not bolted on.
                </p>
                <ul className="mkt-list">
                  <li>Complete EN/AR interface with proper RTL across the whole app</li>
                  <li>Fluent English↔Arabic translation that keeps tone and terminology</li>
                  <li>Switch languages mid-conversation without losing the thread</li>
                  <li>Privacy-first, so your data stays yours, with cited answers</li>
                </ul>
              </div>
              <div className="mkt-row-media">
                Right-to-left chat with English and Arabic side by side, in context
              </div>
            </div>

            <div className="mkt-row">
              <div>
                <span className="mkt-eyebrow">Data</span>
                <h2 className="mkt-h2" style={{ marginTop: 14 }}>
                  Talk to your spreadsheets
                </h2>
                <p className="mkt-sub">
                  AI for data analysis without writing a formula. Upload Excel or CSV files to the
                  Data Analysis workspace, turn on the data-science skill, and ask plain-language
                  questions. Your files stay in the workspace memory for every follow-up.
                </p>
                <ul className="mkt-list">
                  <li>Upload Excel and CSV, then ask for trends, pivots, and summaries</li>
                  <li>Persistent workspace memory keeps your data in context</li>
                  <li>Custom instructions tailor the assistant to your reporting style</li>
                  <li>Pick the right model per task across 7+ leading models</li>
                </ul>
              </div>
              <div className="mkt-row-media">
                Drop a CSV → ask in plain language → get charts and clear answers
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <section className="mkt-section">
        <div className="mkt-wrap">
          <div className="mkt-center">
            <h2 className="mkt-h2">Frequently asked questions</h2>
            <p className="mkt-sub">
              More about how Pervagans handles your day-to-day work. See the{" "}
              <Link href="/product">product overview</Link> or compare{" "}
              <Link href="/pricing">plans and pricing</Link>.
            </p>
          </div>

          <div className="mkt-faq" style={{ marginTop: 32 }}>
            {FAQ.map((f) => (
              <details className="mkt-faq-item" key={f.q}>
                <summary>{f.q}</summary>
                <div>{f.a}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA band ─────────────────────────────────────────────────────── */}
      <section className="mkt-section">
        <div className="mkt-wrap">
          <div className="mkt-cta-band">
            <h2 className="mkt-h2">Put Pervagans to work today</h2>
            <p className="mkt-sub" style={{ marginInline: "auto" }}>
              Start free with 500 monthly credits, and bring your models, skills, files, and
              connectors into one bilingual workspace.
            </p>
            <div className="mkt-cta-row">
              <Link href="/" className="mkt-btn mkt-btn-primary">
                Start free
              </Link>
              <Link href="/pricing" className="mkt-btn mkt-btn-ghost">
                See pricing
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
