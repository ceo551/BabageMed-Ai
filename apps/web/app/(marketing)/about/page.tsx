import type { Metadata } from "next";
import Link from "next/link";
import { MktIcon } from "../mkt-icons";

export const metadata: Metadata = {
  title: "About: The bilingual EN/AR AI assistant & workspace",
  description:
    "About Pervagans: a bilingual (English/Arabic) AI workspace built to give everyone the best models, real context and real tools. Privacy-first, with your data staying yours.",
  alternates: { canonical: "/about" },
  openGraph: {
    title: "About Pervagans: The bilingual EN/AR AI assistant & workspace",
    description:
      "Why we built Pervagans: one calm, bilingual Arabic-English AI workspace where anyone can do real work with the best models, their own context and their own tools.",
    url: "https://pervagans.com/about",
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
        { "@type": "ListItem", position: 2, name: "About", item: "https://pervagans.com/about" },
      ],
    },
    {
      "@type": "Organization",
      name: "Pervagans",
      url: "https://pervagans.com/",
      description:
        "A bilingual (English/Arabic) AI assistant and workspace with multi-model chat, Spaces, focused workspaces, expert skills, MCP connectors, image and video generation, deep research and agent mode.",
      brand: { "@type": "Brand", name: "Pervagans" },
    },
  ],
};

export default function AboutPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(SCHEMA) }}
      />

      {/* Hero */}
      <section className="mkt-section mkt-hero">
        <div className="mkt-wrap">
          <span className="mkt-eyebrow">About Pervagans</span>
          <h1 className="mkt-h1">A bilingual AI workspace for real work</h1>
          <p className="mkt-lede">
            Pervagans is a bilingual AI assistant and workspace, built for English and Arabic from
            day one, with full right-to-left support. Our mission is simple: give everyone one calm
            place to do their best work with the best AI models, grounded in their own context, their
            own files and their own tools. Privacy-first, and your data stays yours.
          </p>
          <div className="mkt-cta-row">
            <Link href="/" className="mkt-btn mkt-btn-primary">
              Start free
            </Link>
            <Link href="/product" className="mkt-btn mkt-btn-ghost">
              See the product
            </Link>
          </div>
          <p className="mkt-trust">
            Web &amp; desktop · English &amp; العربية · Cited answers · Free plan with 200 monthly
            credits
          </p>
        </div>
      </section>

      {/* What we believe / what makes us different */}
      <section className="mkt-section">
        <div className="mkt-wrap">
          <div className="mkt-center">
            <span className="mkt-eyebrow">What we believe</span>
            <h2 className="mkt-h2">Five convictions that shape Pervagans</h2>
            <p className="mkt-sub">
              We did not set out to build another chatbox. We set out to build the workspace we
              wished existed, one that takes language, context, tools and trust seriously.
            </p>
          </div>

          <div className="mkt-grid mkt-grid--3" style={{ marginTop: 28 }}>
            <div className="mkt-card">
              <span className="mkt-card-ic">{MktIcon.layers}</span>
              <h3 className="mkt-h3">One model isn&rsquo;t enough</h3>
              <p>
                No single model is best at everything. Pervagans brings the leading models together,
                including Claude Opus 4.8 and Sonnet 4.6, GPT 5.5/5.4, Gemini Pro 3.1, GLM 5.1,
                DeepSeek V4 Pro and Qwen 3.7 Max, so you can pick the right one for each task without
                switching tools or logins.
              </p>
            </div>
            <div className="mkt-card">
              <span className="mkt-card-ic">{MktIcon.folder}</span>
              <h3 className="mkt-h3">Context is everything</h3>
              <p>
                Great answers come from understanding your situation. Spaces give every project its
                own pinned model, custom instructions, uploaded files and persistent memory, so the
                assistant stays in context and you stop re-explaining yourself.
              </p>
            </div>
            <div className="mkt-card">
              <span className="mkt-card-ic">{MktIcon.connectors}</span>
              <h3 className="mkt-h3">Real work needs real tools</h3>
              <p>
                A chat that can&rsquo;t touch your world is just talk. With one-click MCP connectors
                for Notion, Slack, GitHub, Linear, Google Drive and more, plus Agent Mode, the
                assistant reads and acts on your real data to finish multi-step work.
              </p>
            </div>
            <div className="mkt-card">
              <span className="mkt-card-ic">{MktIcon.globe}</span>
              <h3 className="mkt-h3">Bilingual from day one</h3>
              <p>
                Arabic was never an afterthought. Pervagans is genuinely bilingual English and Arabic,
                with full right-to-left layout. It is an Arabic-English AI workspace that feels native
                in both directions, on web and desktop.
              </p>
            </div>
            <div className="mkt-card">
              <span className="mkt-card-ic">{MktIcon.shield}</span>
              <h3 className="mkt-h3">Privacy-first</h3>
              <p>
                Trust is the product. Connectors are inert until you choose to connect them, answers
                are cited so you can verify them, and your Spaces, files and Gallery stay with you.
                Your data stays yours.
              </p>
            </div>
            <div className="mkt-card">
              <span className="mkt-card-ic">{MktIcon.compass}</span>
              <h3 className="mkt-h3">Calm by design</h3>
              <p>
                Power should not mean clutter. Eight focused workspaces, a curated catalog of 58
                expert skills and a single pool of credits keep the experience simple, so the tool
                gets out of your way and the work gets done.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Mission / story */}
      <section className="mkt-section">
        <div className="mkt-wrap">
          <div className="mkt-center">
            <span className="mkt-eyebrow">Our mission</span>
            <h2 className="mkt-h2">One calm workspace for the best AI</h2>
          </div>

          <div style={{ maxWidth: "68ch", margin: "24px auto 0" }}>
            <p className="mkt-sub" style={{ margin: "0 0 16px" }}>
              The last few years gave us extraordinary AI models, and a tangle of disconnected tabs
              to use them in. One window for chat, another for images, a third for research, and yet
              another for the document you are actually trying to finish. For millions of people who
              think and work in Arabic as well as English, even the basics (right-to-left text and
              proper bilingual context) were too often missing. We thought it should be simpler than
              that.
            </p>
            <p className="mkt-sub" style={{ margin: "0 0 16px" }}>
              So we built Pervagans: a single, calm workspace where anyone, in English or Arabic,
              can do real work with the best AI. You choose the model that fits the task, give each
              project its own Space with the instructions and files it needs, switch on the expert
              skills that sharpen the output, and connect the tools where your real data already
              lives. Then Deep Research, Agent Mode, image and video generation, and a Canvas for
              long documents are all there when you need them, in one place, in your language.
            </p>
            <p className="mkt-sub" style={{ margin: 0 }}>
              We are building Pervagans for students and researchers, writers and translators,
              analysts, founders and finance teams. It is for anyone who wants the leading models
              without the chaos, and who expects their assistant to respect both their language and
              their privacy. It is still early, and we ship constantly. The principles, though, will
              not change: the best models, your context, your tools, and your data staying yours.
            </p>
          </div>

          <div className="mkt-cta-row mkt-center" style={{ marginTop: 28 }}>
            <Link href="/use-cases" className="mkt-btn mkt-btn-ghost">
              See use cases
            </Link>
            <Link href="/pricing" className="mkt-btn mkt-btn-ghost">
              View pricing
            </Link>
          </div>
        </div>
      </section>

      {/* At-a-glance stats */}
      <section className="mkt-section mkt-section--tight">
        <div className="mkt-wrap">
          <div className="mkt-center" style={{ marginBottom: 8 }}>
            <span className="mkt-eyebrow">At a glance</span>
          </div>
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
              <div className="mkt-stat-n">2</div>
              <div className="mkt-stat-l">languages: EN &amp; AR</div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="mkt-section">
        <div className="mkt-wrap">
          <div className="mkt-cta-band">
            <h2 className="mkt-h2">Come do real work with the best AI</h2>
            <p className="mkt-sub">
              Create your account in seconds and put a full bilingual AI workspace to work today.
              The Free plan includes 200 monthly credits and no credit card to begin.
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
        </div>
      </section>
    </>
  );
}
