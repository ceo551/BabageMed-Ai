import type { Metadata } from "next";
import type { ReactElement } from "react";
import Link from "next/link";
import {
  EFFECTS,
  effectsByCategory,
  EFFECT_CATEGORIES,
  CATEGORY_LABEL,
  type EffectEntry,
} from "./catalog";
import { MktIcon } from "../mkt-icons";

export const metadata: Metadata = {
  title: "AI Effects: one-tap image and video presets",
  description:
    "Pervagans ships ready-made AI effects: pick a preset, tweak the prompt, generate. Ghibli art, Pixar characters, Arabic calligraphy, product photos, cinematic b-roll and more, all in one bilingual workspace on one shared credit pool.",
  alternates: {
    canonical: "/effects",
    languages: { en: "/effects", ar: "/ar/effects", "x-default": "/effects" },
  },
  openGraph: {
    title: "AI Effects in Pervagans: one-tap image and video presets",
    description:
      "Ready-made AI effects for image and video. Pick a preset, tweak the prompt, generate. One bilingual (EN/AR) workspace, one shared credit pool.",
    url: "https://pervagans.com/effects",
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
        { "@type": "ListItem", position: 2, name: "Effects", item: "https://pervagans.com/effects" },
      ],
    },
    {
      "@type": "ItemList",
      name: "AI effects available in Pervagans",
      itemListElement: EFFECTS.map((e, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: e.nameEn,
        url: `https://pervagans.com/effects/${e.slug}`,
      })),
    },
  ],
};

const ICON: Record<EffectEntry["type"], ReactElement> = {
  image: MktIcon.media,
  video: MktIcon.media,
};

function Group({ category }: { category: EffectEntry["category"] }) {
  const list = effectsByCategory(category);
  if (list.length === 0) return null;
  return (
    <div style={{ marginTop: 40 }}>
      <h2 className="mkt-h3" style={{ fontSize: 22, marginBottom: 16 }}>
        {CATEGORY_LABEL[category].en}
      </h2>
      <div className="mkt-grid">
        {list.map((e: EffectEntry) => (
          <Link key={e.slug} href={`/effects/${e.slug}`} className="mkt-card" style={{ textDecoration: "none" }}>
            <span className="mkt-card-ic">{ICON[e.type]}</span>
            <h3 className="mkt-h3">{e.nameEn}</h3>
            <p style={{ marginBottom: 8 }}>{e.taglineEn}</p>
            <span style={{ marginTop: "auto", display: "inline-flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span className="mkt-eyebrow" style={{ padding: "3px 9px", fontSize: 11 }}>{CATEGORY_LABEL[e.category].en}</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function EffectsPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(SCHEMA) }} />

      <section className="mkt-section mkt-hero">
        <div className="mkt-wrap mkt-center">
          <span className="mkt-eyebrow">One-tap AI effects</span>
          <h1 className="mkt-h1">One-tap AI image and video effects</h1>
          <p className="mkt-lede">
            Skip the blank canvas. Pervagans ships ready-made effects: pick a preset, tweak the
            prompt in plain words, then generate. From Ghibli art and Arabic calligraphy to product
            photos and cinematic b-roll, every effect runs in one bilingual (EN/AR) workspace on one
            shared credit pool.
          </p>
          <div className="mkt-cta-row">
            <Link href="/" className="mkt-btn mkt-btn-primary">Start free</Link>
            <Link href="/pricing" className="mkt-btn mkt-btn-ghost">See pricing</Link>
          </div>
          <p className="mkt-trust">
            {EFFECTS.length} ready-made effects · One shared credit pool
          </p>
        </div>
      </section>

      <section className="mkt-section" style={{ paddingTop: 0 }}>
        <div className="mkt-wrap">
          {EFFECT_CATEGORIES.map((cat) => (
            <Group key={cat} category={cat} />
          ))}
        </div>
      </section>

      <section className="mkt-section">
        <div className="mkt-wrap">
          <div className="mkt-cta-band">
            <h2 className="mkt-h2">Ready-made results, no prompt-writing degree</h2>
            <p className="mkt-sub" style={{ marginInline: "auto" }}>
              Every effect is a tuned preset on the best image and video models. Pick one, add a few
              words, and get a finished result. All in one place, in English or Arabic, on one shared
              credit pool.
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
