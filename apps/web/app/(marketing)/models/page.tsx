import type { Metadata } from "next";
import type { ReactElement } from "react";
import Link from "next/link";
import { MODELS, modelsByType, planLabel, TYPE_LABEL, type ModelEntry } from "./catalog";
import { MktIcon } from "../mkt-icons";

export const metadata: Metadata = {
  title: "AI Models: every top model in one workspace",
  description:
    "Pervagans gives you Claude, GPT, Gemini, DeepSeek, Qwen, GLM plus image and video models (GPT Image 2, Qwen Image, Wan, Happy Horse) in one bilingual workspace and one shared credit pool. Browse every model.",
  alternates: {
    canonical: "/models",
    languages: { en: "/models", ar: "/ar/models", "x-default": "/models" },
  },
  openGraph: {
    title: "AI Models in Pervagans: every top model, one subscription",
    description:
      "Claude, GPT, Gemini, DeepSeek, Qwen and GLM for chat, plus image and video models, all in one bilingual (EN/AR) workspace with one shared credit pool.",
    url: "https://pervagans.com/models",
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
        { "@type": "ListItem", position: 2, name: "Models", item: "https://pervagans.com/models" },
      ],
    },
    {
      "@type": "ItemList",
      name: "AI models available in Pervagans",
      itemListElement: MODELS.map((m, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: m.name,
        url: `https://pervagans.com/models/${m.slug}`,
      })),
    },
  ],
};

const ICON: Record<string, ReactElement> = {
  chat: MktIcon.chat,
  image: MktIcon.media,
  video: MktIcon.media,
};

function Group({ type }: { type: "chat" | "image" | "video" }) {
  const list = modelsByType(type);
  if (list.length === 0) return null;
  return (
    <div style={{ marginTop: 40 }}>
      <h2 className="mkt-h3" style={{ fontSize: 22, marginBottom: 16 }}>
        {TYPE_LABEL[type].en}s
      </h2>
      <div className="mkt-grid">
        {list.map((m: ModelEntry) => (
          <Link key={m.slug} href={`/models/${m.slug}`} className="mkt-card" style={{ textDecoration: "none" }}>
            <span className="mkt-card-ic">{ICON[m.type]}</span>
            <h3 className="mkt-h3">{m.name}</h3>
            <p style={{ marginBottom: 8 }}>{m.taglineEn}</p>
            <span style={{ marginTop: "auto", display: "inline-flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span className="mkt-eyebrow" style={{ padding: "3px 9px", fontSize: 11 }}>{m.maker}</span>
              <span className="mkt-eyebrow" style={{ padding: "3px 9px", fontSize: 11, color: "var(--green)", borderColor: "var(--green-line, var(--border))", background: "transparent" }}>{planLabel(m.plan)}</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function ModelsPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(SCHEMA) }} />

      <section className="mkt-section mkt-hero">
        <div className="mkt-wrap mkt-center">
          <span className="mkt-eyebrow">Every top model, one place</span>
          <h1 className="mkt-h1">All the best AI models, one workspace</h1>
          <p className="mkt-lede">
            Stop paying for and switching between separate tools. Pervagans brings the leading chat,
            image and video models together in one bilingual (EN/AR) workspace, on one shared credit
            pool. Pick the right model for each task, then switch any time.
          </p>
          <div className="mkt-cta-row">
            <Link href="/" className="mkt-btn mkt-btn-primary">Start free</Link>
            <Link href="/pricing" className="mkt-btn mkt-btn-ghost">See pricing</Link>
          </div>
          <p className="mkt-trust">
            {MODELS.length} models · One shared credit pool · No credit card to start
          </p>
        </div>
      </section>

      <section className="mkt-section" style={{ paddingTop: 0 }}>
        <div className="mkt-wrap">
          <Group type="chat" />
          <Group type="image" />
          <Group type="video" />
        </div>
      </section>

      <section className="mkt-section">
        <div className="mkt-wrap">
          <div className="mkt-cta-band">
            <h2 className="mkt-h2">One subscription instead of five</h2>
            <p className="mkt-sub" style={{ marginInline: "auto" }}>
              Chat, images and video from the best models, plus Spaces, skills, connectors and an AI
              agent. All in one place, in English or Arabic, on one shared credit pool.
            </p>
            <div className="mkt-cta-row">
              <Link href="/" className="mkt-btn mkt-btn-primary">Start free</Link>
              <Link href="/pricing" className="mkt-btn mkt-btn-ghost">Compare plans</Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
