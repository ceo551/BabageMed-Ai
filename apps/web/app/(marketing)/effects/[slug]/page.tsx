import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EFFECTS, getEffect, effectsByCategory, CATEGORY_LABEL, effectHref } from "../catalog";

const SITE = "https://pervagans.com";

export function generateStaticParams() {
  return EFFECTS.map((e) => ({ slug: e.slug }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params;
  const e = getEffect(slug);
  if (!e) return { title: "Effect not found" };
  const title = `${e.nameEn} generator, in Pervagans`;
  const description = `${e.descEn} in Pervagans, the bilingual (EN/AR) AI workspace.`;
  return {
    title,
    description,
    alternates: {
      canonical: `/effects/${e.slug}`,
      languages: { en: `/effects/${e.slug}`, ar: `/ar/effects/${e.slug}`, "x-default": `/effects/${e.slug}` },
    },
    openGraph: { title, description, url: `${SITE}/effects/${e.slug}`, type: "website" },
  };
}

export default async function EffectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const e = getEffect(slug);
  if (!e) notFound();

  const related = effectsByCategory(e.category).filter((x) => x.slug !== e.slug).slice(0, 3);
  const kindLabel = e.type === "video" ? "Video" : "Image";

  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
          { "@type": "ListItem", position: 2, name: "Effects", item: `${SITE}/effects` },
          { "@type": "ListItem", position: 3, name: e.nameEn, item: `${SITE}/effects/${e.slug}` },
        ],
      },
      {
        "@type": "HowTo",
        name: `How to use the ${e.nameEn} effect in Pervagans`,
        description: `${e.taglineEn} ${e.descEn}`,
        step: [
          {
            "@type": "HowToStep",
            position: 1,
            name: "Pick the effect",
            text: `Open the ${e.nameEn} effect in Pervagans.`,
          },
          {
            "@type": "HowToStep",
            position: 2,
            name: "Add your details",
            text: e.promptHintEn,
          },
          {
            "@type": "HowToStep",
            position: 3,
            name: "Generate",
            text: `Generate your ${kindLabel.toLowerCase()} on the ${e.model} model, using your shared credits.`,
          },
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: [
          {
            "@type": "Question",
            name: `How do I use the ${e.nameEn} effect?`,
            acceptedAnswer: {
              "@type": "Answer",
              text: `Sign in to Pervagans, open the ${e.nameEn} effect, add your details (${e.promptHintEn}), and generate. It runs on the ${e.model} model and your shared credit pool.`,
            },
          },
          {
            "@type": "Question",
            name: "Is it free?",
            acceptedAnswer: {
              "@type": "Answer",
              text: `Yes. The Pervagans Free plan gives you 200 monthly credits, no credit card required, and every effect draws from the same shared credit pool. Upgrade only when you need more credits.`,
            },
          },
        ],
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />

      {/* Hero */}
      <section className="mkt-section mkt-hero">
        <div className="mkt-wrap">
          <p style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: 0 }}>
            <span className="mkt-eyebrow">{CATEGORY_LABEL[e.category].en}</span>
            <span className="mkt-eyebrow">{kindLabel}</span>
            <span className="mkt-eyebrow">Model: {e.model}</span>
          </p>
          <h1 className="mkt-h1" style={{ maxWidth: "20ch" }}>{e.nameEn}</h1>
          <p className="mkt-lede">{e.taglineEn}</p>
          <p className="mkt-sub" style={{ marginTop: 14 }}>{e.descEn}</p>
          <div className="mkt-cta-row">
            <Link href={effectHref(e)} className="mkt-btn mkt-btn-primary">Try this effect</Link>
            <Link href="/effects" className="mkt-btn mkt-btn-ghost">All effects</Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mkt-section" style={{ paddingTop: 0 }}>
        <div className="mkt-wrap">
          <div className="mkt-center">
            <span className="mkt-eyebrow">How it works</span>
            <h2 className="mkt-h2">A preset that does the heavy lifting</h2>
            <p className="mkt-sub">{e.promptHintEn}</p>
            <p className="mkt-sub" style={{ marginTop: 14 }}>
              Pick this effect, add your details, and generate. Runs on the {e.model} model and your shared credits.
            </p>
          </div>
          <div style={{ marginTop: 24, display: "flex", justifyContent: "center" }}>
            <Link href={effectHref(e)} className="mkt-btn mkt-btn-primary">Try this effect</Link>
          </div>
        </div>
      </section>

      {/* Why it lives in Pervagans */}
      <section className="mkt-section" style={{ paddingTop: 0 }}>
        <div className="mkt-wrap">
          <div className="mkt-center">
            <span className="mkt-eyebrow">In Pervagans</span>
            <h2 className="mkt-h2">One workspace, every effect</h2>
            <p className="mkt-sub">
              The {e.nameEn} effect lives in the same workspace as chat, every other effect and
              every model. Use it, then switch to another the moment a different look fits better.
              Everything runs on one shared credit pool, so there is nothing extra to manage.
            </p>
          </div>
          <div className="mkt-grid mkt-grid--3" style={{ marginTop: 28 }}>
            <div className="mkt-card">
              <h3 className="mkt-h3">One shared credit pool</h3>
              <p>No separate subscription. The {e.nameEn} effect draws from the same monthly credits as chat, image, video and agent runs.</p>
            </div>
            <div className="mkt-card">
              <h3 className="mkt-h3">Switch any time</h3>
              <p>Try this effect, compare it against other presets on the same idea, and keep the result you like best.</p>
            </div>
            <div className="mkt-card">
              <h3 className="mkt-h3">Bilingual EN / AR</h3>
              <p>Work and read in English or Arabic, with full right-to-left support.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Related effects */}
      {related.length > 0 && (
        <section className="mkt-section" style={{ paddingTop: 0 }}>
          <div className="mkt-wrap">
            <h2 className="mkt-h3" style={{ fontSize: 22, marginBottom: 16 }}>More {CATEGORY_LABEL[e.category].en.toLowerCase()} effects in Pervagans</h2>
            <div className="mkt-grid">
              {related.map((r) => (
                <Link key={r.slug} href={`/effects/${r.slug}`} className="mkt-card" style={{ textDecoration: "none" }}>
                  <h3 className="mkt-h3">{r.nameEn}</h3>
                  <p style={{ marginBottom: 8 }}>{r.taglineEn}</p>
                  <span className="mkt-eyebrow" style={{ marginTop: "auto", padding: "3px 9px", fontSize: 11 }}>{r.type === "video" ? "Video" : "Image"}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="mkt-section" style={{ paddingTop: 0 }}>
        <div className="mkt-wrap">
          <div className="mkt-cta-band">
            <h2 className="mkt-h2">Try the {e.nameEn} effect free</h2>
            <p className="mkt-sub" style={{ marginInline: "auto" }}>
              Create your account in seconds, no credit card required. One workspace, one shared credit pool, every effect and model included.
            </p>
            <div className="mkt-cta-row">
              <Link href={effectHref(e)} className="mkt-btn mkt-btn-primary">Try this effect</Link>
              <Link href="/pricing" className="mkt-btn mkt-btn-ghost">See pricing</Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
