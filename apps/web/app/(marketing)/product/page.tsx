import type { Metadata } from "next";
import Link from "next/link";
import { MktIcon } from "../mkt-icons";

export const metadata: Metadata = {
  title: "AI Assistant & Workspace: Chat, Agents, Connectors",
  description:
    "Pervagans is a bilingual EN/AR AI workspace: chat with Claude, GPT, Gemini & more, run agents, connect your tools via MCP, and generate images and video.",
  alternates: { canonical: "/product" },
  openGraph: {
    title: "AI Assistant & Workspace: Chat, Agents, Connectors",
    description:
      "Pervagans is a bilingual EN/AR AI workspace: chat with Claude, GPT, Gemini & more, run agents, connect your tools via MCP, and generate images and video.",
    url: "https://pervagans.com/product",
    type: "website",
  },
};

const SCHEMA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Home",
          item: "https://pervagans.com/",
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Product",
          item: "https://pervagans.com/product",
        },
      ],
    },
    {
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "What is Pervagans?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Pervagans is a bilingual (English and Arabic) AI assistant and workspace, available on web and desktop. You chat with leading AI models in one place, organize work into Spaces with pinned models and memory, enable expert Skills, connect your own tools through MCP connectors, run an AI agent that executes multi-step tasks, and generate images and video, all in a single privacy-first subscription.",
          },
        },
        {
          "@type": "Question",
          name: "Which AI models can I use in Pervagans?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "You can chat with Claude Opus 4.8, Claude Sonnet 4.6, GPT 5.5 and 5.4, Gemini Pro 3.1, GLM 5.1, DeepSeek V4 Pro, and Qwen 3.7 Max. Switch between them per task so you always use the right model for the job, with no separate subscriptions to manage.",
          },
        },
        {
          "@type": "Question",
          name: "Is Pervagans free to use?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. The Free plan includes 200 monthly credits so you can try multi-model chat, Skills and connectors at no cost. When you need more, paid plans run from Go at $20/month up to Max at $100/month, with 1,000 to 5,000 monthly credits and more models at each tier. Annual billing saves roughly two months.",
          },
        },
        {
          "@type": "Question",
          name: "What are MCP connectors?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Connectors use the Model Context Protocol (MCP) to securely link external tools to the assistant with one-click OAuth, such as Notion, Slack, GitHub, Linear, Google Drive, Gmail, Calendar and more. Once connected, Agent Mode can read and act on your real data to complete tasks for you.",
          },
        },
        {
          "@type": "Question",
          name: "Does Pervagans support Arabic?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. Pervagans is fully bilingual with a complete right-to-left (RTL) Arabic interface and English. You can work, chat and read cited answers in either language, making it a true bilingual AI assistant for Arabic and English speakers.",
          },
        },
        {
          "@type": "Question",
          name: "Is my data private?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Pervagans is privacy-first: your data stays yours. Files, instructions and memory live inside your own Spaces, connectors are authorized by you through OAuth, and answers come back with numbered citations so you can verify every claim.",
          },
        },
      ],
    },
  ],
};

export default function ProductPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(SCHEMA) }}
      />

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="mkt-section mkt-hero">
        <div className="mkt-wrap mkt-center">
          <span className="mkt-eyebrow">Bilingual AI workspace · EN / AR</span>
          <h1 className="mkt-h1">One AI workspace for every workflow</h1>
          <p className="mkt-lede">
            Pervagans is a bilingual AI assistant and workspace. Chat with the
            best models, including Claude, GPT, Gemini and more, then ground
            every project in your own instructions, files, skills and
            connectors. Run an AI agent, generate images and video, and get
            cited answers, all in one place.
          </p>
          <div className="mkt-cta-row">
            <Link href="/" className="mkt-btn mkt-btn-primary">
              Start free
            </Link>
            <Link href="/pricing" className="mkt-btn mkt-btn-ghost">
              See pricing
            </Link>
          </div>
          <p className="mkt-trust">
            Free plan with 200 monthly credits · No credit card to start ·
            Web &amp; desktop
          </p>
        </div>
      </section>

      {/* ── Capabilities grid ─────────────────────────────────────────── */}
      <section className="mkt-section">
        <div className="mkt-wrap">
          <div className="mkt-center">
            <span className="mkt-eyebrow">Everything in one place</span>
            <h2 className="mkt-h2">A complete AI workspace, not just a chatbot</h2>
            <p className="mkt-sub">
              From multi-model chat to autonomous agents and media generation,
              the capabilities that usually need five different tools, unified
              under one bilingual subscription.
            </p>
          </div>

          <div className="mkt-grid" style={{ marginTop: 36 }}>
            <div className="mkt-card">
              <span className="mkt-card-ic">{MktIcon.chat}</span>
              <h3 className="mkt-h3">Multi-model chat</h3>
              <p>
                Talk to Claude Opus 4.8, Sonnet 4.6, GPT 5.5/5.4, Gemini Pro
                3.1, GLM 5.1, DeepSeek V4 Pro and Qwen 3.7 Max, then pick the
                right model for each task.
              </p>
            </div>
            <div className="mkt-card">
              <span className="mkt-card-ic">{MktIcon.spaces}</span>
              <h3 className="mkt-h3">Spaces</h3>
              <p>
                Give each project its own pinned model, custom instructions,
                uploaded files and persistent memory so the assistant stays in
                context.
              </p>
            </div>
            <div className="mkt-card">
              <span className="mkt-card-ic">{MktIcon.skills}</span>
              <h3 className="mkt-h3">Skills</h3>
              <p>
                Toggle on expert Skills from a catalog of 58, such as
                copywriting, deep research, data science, SEO and design, to
                inject real expert guidance into the model.
              </p>
            </div>
            <div className="mkt-card">
              <span className="mkt-card-ic">{MktIcon.connectors}</span>
              <h3 className="mkt-h3">Connectors (MCP)</h3>
              <p>
                Connect Notion, Slack, GitHub, Linear, Google Drive, Gmail and
                more with one-click OAuth so the assistant works on your real
                data.
              </p>
            </div>
            <div className="mkt-card">
              <span className="mkt-card-ic">{MktIcon.media}</span>
              <h3 className="mkt-h3">Image &amp; video</h3>
              <p>
                Generate images with GPT Image, Qwen-Image and Wan, and video
                with Sora and Happy Horse, with aspect, seed and negative-prompt
                controls and a saved Gallery.
              </p>
            </div>
            <div className="mkt-card">
              <span className="mkt-card-ic">{MktIcon.research}</span>
              <h3 className="mkt-h3">Deep Research</h3>
              <p>
                Autonomous multi-source research that returns a structured report
                with numbered citations you can trust and verify.
              </p>
            </div>
            <div className="mkt-card">
              <span className="mkt-card-ic">{MktIcon.agent}</span>
              <h3 className="mkt-h3">Agent Mode</h3>
              <p>
                An AI agent that plans and executes multi-step tasks by calling
                your connected tools, then writes a clear, final answer.
              </p>
            </div>
            <div className="mkt-card">
              <span className="mkt-card-ic">{MktIcon.globe}</span>
              <h3 className="mkt-h3">Bilingual EN / AR</h3>
              <p>
                A fully bilingual experience with complete right-to-left Arabic
                support. Work and read cited answers in English or Arabic.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats band ────────────────────────────────────────────────── */}
      <section className="mkt-section mkt-section--tight">
        <div className="mkt-wrap">
          <div className="mkt-stats">
            <div className="mkt-stat">
              <div className="mkt-stat-n">7+</div>
              <div className="mkt-stat-l">leading AI models</div>
            </div>
            <div className="mkt-stat">
              <div className="mkt-stat-n">58</div>
              <div className="mkt-stat-l">expert skills</div>
            </div>
            <div className="mkt-stat">
              <div className="mkt-stat-n">8</div>
              <div className="mkt-stat-l">focused workspaces</div>
            </div>
            <div className="mkt-stat">
              <div className="mkt-stat-n">2</div>
              <div className="mkt-stat-l">languages (EN / AR)</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Feature deep-dives ────────────────────────────────────────── */}
      <section className="mkt-section">
        <div className="mkt-wrap">
          <div className="mkt-center">
            <span className="mkt-eyebrow">How it works</span>
            <h2 className="mkt-h2">Built to do real work, end to end</h2>
            <p className="mkt-sub">
              Each capability is designed to compound: chat picks the model,
              Spaces hold the context, Skills add expertise, and connectors let
              the agent act.
            </p>
          </div>

          <div className="mkt-rows" style={{ marginTop: 44 }}>
            {/* Multi-model chat */}
            <div className="mkt-row">
              <div>
                <h3 className="mkt-h3" style={{ fontSize: 26 }}>
                  Chat with Claude, GPT, Gemini and more
                </h3>
                <p className="mkt-sub" style={{ marginTop: 12 }}>
                  Stop juggling subscriptions and browser tabs. Pervagans puts
                  every frontier model behind one chat box, so you can choose the
                  best brain for each task and compare answers instantly.
                </p>
                <ul className="mkt-list">
                  <li>
                    Claude Opus 4.8 &amp; Sonnet 4.6, GPT 5.5/5.4, Gemini Pro
                    3.1, GLM 5.1, DeepSeek V4 Pro, Qwen 3.7 Max
                  </li>
                  <li>Switch models mid-project without losing your context</li>
                  <li>Answers come back with numbered, verifiable citations</li>
                  <li>Canvas / Artifacts to edit long documents and code beside the chat</li>
                </ul>
                <div className="mkt-cta-row">
                  <Link href="/" className="mkt-btn mkt-btn-primary mkt-btn-sm">
                    Try multi-model chat
                  </Link>
                  <Link href="/use-cases" className="mkt-btn mkt-btn-ghost mkt-btn-sm">
                    See use cases
                  </Link>
                </div>
              </div>
              <div className="mkt-row-media">
                7+ frontier models · one chat · cited answers
              </div>
            </div>

            {/* Spaces + Skills */}
            <div className="mkt-row">
              <div>
                <h3 className="mkt-h3" style={{ fontSize: 26 }}>
                  Spaces and Skills that keep the AI in context
                </h3>
                <p className="mkt-sub" style={{ marginTop: 12 }}>
                  Organize work into Spaces, projects that remember. Pin a model,
                  add instructions and files, and switch on the right expert
                  Skills so every reply is grounded in how you actually work.
                </p>
                <ul className="mkt-list">
                  <li>Per-project pinned model, custom instructions and persistent memory</li>
                  <li>Upload files once; the assistant keeps them in context</li>
                  <li>58 reusable expert Skills you toggle on per workspace</li>
                  <li>8 focused workspaces: Education, Writing, Translation, Data, Business, Financial, Image, Video</li>
                </ul>
                <div className="mkt-cta-row">
                  <Link href="/" className="mkt-btn mkt-btn-primary mkt-btn-sm">
                    Create a Space
                  </Link>
                </div>
              </div>
              <div className="mkt-row-media">
                Pinned model + instructions + files + memory, per project
              </div>
            </div>

            {/* Connectors + Agent Mode */}
            <div className="mkt-row">
              <div>
                <h3 className="mkt-h3" style={{ fontSize: 26 }}>
                  Connectors and an AI agent that gets things done
                </h3>
                <p className="mkt-sub" style={{ marginTop: 12 }}>
                  Connect your real tools with one-click OAuth over the Model
                  Context Protocol, then let Agent Mode plan and execute
                  multi-step tasks against your data, and report back clearly.
                </p>
                <ul className="mkt-list">
                  <li>MCP connectors for Notion, Slack, GitHub, Linear, Google Drive, Gmail, Calendar and more</li>
                  <li>One-click OAuth, so you authorize each connection</li>
                  <li>Agent Mode plans, calls your tools, and writes a final answer</li>
                  <li>Deep Research and Agent Mode combine for sourced, actionable output</li>
                </ul>
                <div className="mkt-cta-row">
                  <Link href="/" className="mkt-btn mkt-btn-primary mkt-btn-sm">
                    Connect your tools
                  </Link>
                  <Link href="/about" className="mkt-btn mkt-btn-ghost mkt-btn-sm">
                    Why Pervagans
                  </Link>
                </div>
              </div>
              <div className="mkt-row-media">
                Authorize → agent plans → calls your tools → final answer
              </div>
            </div>

            {/* Image/Video + Deep Research */}
            <div className="mkt-row">
              <div>
                <h3 className="mkt-h3" style={{ fontSize: 26 }}>
                  Generate media and research, all in one workspace
                </h3>
                <p className="mkt-sub" style={{ marginTop: 12 }}>
                  Create on-brand images and video without leaving the chat, and
                  run autonomous Deep Research that hands you a structured, cited
                  report instead of a wall of links.
                </p>
                <ul className="mkt-list">
                  <li>AI image generation with GPT Image, Qwen-Image and Wan</li>
                  <li>AI video generation with Sora and Happy Horse</li>
                  <li>Aspect, seed and negative-prompt controls, plus a saved Gallery</li>
                  <li>Deep Research returns a structured report with numbered citations</li>
                </ul>
                <div className="mkt-cta-row">
                  <Link href="/" className="mkt-btn mkt-btn-primary mkt-btn-sm">
                    Generate &amp; research
                  </Link>
                </div>
              </div>
              <div className="mkt-row-media">
                Image · video · Gallery · cited research reports
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────────────── */}
      <section className="mkt-section">
        <div className="mkt-wrap">
          <div className="mkt-center">
            <span className="mkt-eyebrow">FAQ</span>
            <h2 className="mkt-h2">Questions, answered</h2>
            <p className="mkt-sub">
              The essentials on models, pricing, connectors, Arabic support and
              privacy. See full plans on the{" "}
              <Link href="/pricing" style={{ color: "var(--cyan)" }}>
                pricing page
              </Link>
              .
            </p>
          </div>

          <div className="mkt-faq" style={{ marginTop: 32 }}>
            <details className="mkt-faq-item">
              <summary>What is Pervagans?</summary>
              <div>
                Pervagans is a bilingual (English and Arabic) AI assistant and
                workspace, available on web and desktop. You chat with leading AI
                models in one place, organize work into Spaces with pinned models
                and memory, enable expert Skills, connect your own tools through
                MCP connectors, run an AI agent that executes multi-step tasks,
                and generate images and video, all in a single privacy-first
                subscription.
              </div>
            </details>
            <details className="mkt-faq-item">
              <summary>Which AI models can I use in Pervagans?</summary>
              <div>
                You can chat with Claude Opus 4.8, Claude Sonnet 4.6, GPT 5.5 and
                5.4, Gemini Pro 3.1, GLM 5.1, DeepSeek V4 Pro, and Qwen 3.7 Max.
                Switch between them per task so you always use the right model
                for the job, with no separate subscriptions to manage.
              </div>
            </details>
            <details className="mkt-faq-item">
              <summary>Is Pervagans free to use?</summary>
              <div>
                Yes. The Free plan includes 200 monthly credits so you can try
                multi-model chat, Skills and connectors at no cost. When you need
                more, paid plans run from Go at $20/month up to Max at $100/month,
                with 1,000 to 5,000 monthly credits and more models at each tier.
                Annual billing saves roughly two months. Compare plans on
                the <Link href="/pricing" style={{ color: "var(--cyan)" }}>pricing page</Link>.
              </div>
            </details>
            <details className="mkt-faq-item">
              <summary>What are MCP connectors?</summary>
              <div>
                Connectors use the Model Context Protocol (MCP) to securely link
                external tools to the assistant with one-click OAuth, such as
                Notion, Slack, GitHub, Linear, Google Drive, Gmail, Calendar and
                more. Once connected, Agent Mode can read and act on your real
                data to complete tasks for you.
              </div>
            </details>
            <details className="mkt-faq-item">
              <summary>Does Pervagans support Arabic?</summary>
              <div>
                Yes. Pervagans is fully bilingual with a complete right-to-left
                (RTL) Arabic interface and English. You can work, chat and read
                cited answers in either language, making it a true bilingual AI
                assistant for Arabic and English speakers.
              </div>
            </details>
            <details className="mkt-faq-item">
              <summary>Is my data private?</summary>
              <div>
                Pervagans is privacy-first: your data stays yours. Files,
                instructions and memory live inside your own Spaces, connectors
                are authorized by you through OAuth, and answers come back with
                numbered citations so you can verify every claim.
              </div>
            </details>
          </div>
        </div>
      </section>

      {/* ── Final CTA band ────────────────────────────────────────────── */}
      <section className="mkt-section">
        <div className="mkt-wrap">
          <div className="mkt-cta-band">
            <h2 className="mkt-h2">Start building with one AI workspace</h2>
            <p className="mkt-sub" style={{ marginInline: "auto" }}>
              Chat with the best models, connect your tools, and put an AI agent
              to work, free to start, in English or Arabic.
            </p>
            <div className="mkt-cta-row">
              <Link href="/" className="mkt-btn mkt-btn-primary">
                Start free
              </Link>
              <Link href="/pricing" className="mkt-btn mkt-btn-ghost">
                Compare plans
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
