import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MODELS, getModel, modelsByType, planLabel, TYPE_LABEL } from "../catalog";

const SITE = "https://pervagans.com";

export function generateStaticParams() {
  return MODELS.map((m) => ({ slug: m.slug }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params;
  const m = getModel(slug);
  if (!m) return { title: "Model not found" };
  const title = `${m.name} online, in Pervagans`;
  const description = `Use ${m.name} by ${m.maker} in Pervagans, the bilingual (EN/AR) AI workspace. ${m.taglineEn} ${m.plan === "free" ? "Included free." : `Available on ${planLabel(m.plan)}.`} One shared credit pool with every other model.`;
  return {
    title,
    description,
    alternates: {
      canonical: `/models/${m.slug}`,
      languages: { en: `/models/${m.slug}`, ar: `/ar/models/${m.slug}`, "x-default": `/models/${m.slug}` },
    },
    openGraph: { title, description, url: `${SITE}/models/${m.slug}`, type: "website" },
  };
}

export default async function ModelPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const m = getModel(slug);
  if (!m) notFound();

  const related = modelsByType(m.type).filter((x) => x.slug !== m.slug).slice(0, 3);
  const isFree = m.plan === "free";

  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
          { "@type": "ListItem", position: 2, name: "Models", item: `${SITE}/models` },
          { "@type": "ListItem", position: 3, name: m.name, item: `${SITE}/models/${m.slug}` },
        ],
      },
      {
        "@type": "SoftwareApplication",
        name: `${m.name} in Pervagans`,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web, iOS, Android",
        description: `${m.taglineEn} ${m.introEn}`,
        offers: {
          "@type": "Offer",
          price: isFree ? "0" : "20",
          priceCurrency: "USD",
          url: `${SITE}/pricing`,
        },
        brand: { "@type": "Brand", name: m.maker },
      },
      {
        "@type": "FAQPage",
        mainEntity: [
          {
            "@type": "Question",
            name: `How do I use ${m.name}?`,
            acceptedAnswer: {
              "@type": "Answer",
              text: `Sign in to Pervagans, open a chat, Space or feature, and select ${m.name} from the model picker. You can switch models any time and they all draw from the same shared credit pool.`,
            },
          },
          {
            "@type": "Question",
            name: `Is ${m.name} free?`,
            acceptedAnswer: {
              "@type": "Answer",
              text: isFree
                ? `Yes. ${m.name} is included in the Pervagans Free plan with 200 monthly credits, no credit card required.`
                : `${m.name} is available on the Pervagans ${planLabel(m.plan)} plan. The Free plan ($0) lets you try the core models first, then upgrade when you need ${m.name}.`,
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
            <span className="mkt-eyebrow">{TYPE_LABEL[m.type].en}</span>
            <span className="mkt-eyebrow">{m.maker}</span>
            <span className="mkt-eyebrow" style={{ color: "var(--green)" }}>{planLabel(m.plan)}</span>
          </p>
          <h1 className="mkt-h1" style={{ maxWidth: "20ch" }}>{m.name}</h1>
          <p className="mkt-lede">{m.taglineEn}</p>
          <p className="mkt-sub" style={{ marginTop: 14 }}>{m.introEn}</p>
          <div className="mkt-cta-row">
            <Link href="/" className="mkt-btn mkt-btn-primary">{isFree ? "Use it free" : "Start free"}</Link>
            <Link href="/models" className="mkt-btn mkt-btn-ghost">All models</Link>
          </div>
        </div>
      </section>

      {/* Best for + highlights */}
      <section className="mkt-section" style={{ paddingTop: 0 }}>
        <div className="mkt-wrap">
          <div className="mkt-row">
            <div>
              <h2 className="mkt-h3" style={{ fontSize: 24 }}>What {m.name} is best for</h2>
              <ul className="mkt-list">
                {m.bestForEn.map((b, i) => <li key={i}>{b}</li>)}
              </ul>
            </div>
            <div className="mkt-row-media" style={{ flexDirection: "column", gap: 12, alignItems: "flex-start", minHeight: 0, padding: 28 }}>
              <h3 className="mkt-h3" style={{ margin: 0 }}>Highlights</h3>
              <ul className="mkt-list" style={{ margin: 0 }}>
                {m.highlightsEn.map((h, i) => <li key={i}>{h}</li>)}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* How to use in Pervagans */}
      <section className="mkt-section" style={{ paddingTop: 0 }}>
        <div className="mkt-wrap">
          <div className="mkt-center">
            <span className="mkt-eyebrow">In Pervagans</span>
            <h2 className="mkt-h2">Use {m.name} without juggling tools</h2>
            <p className="mkt-sub">
              {m.name} lives in the same workspace as every other model. Pick it from the model
              picker in any chat, Space or feature, and switch the moment another model fits better.
              Everything runs on one shared credit pool, so there is nothing extra to manage.
            </p>
          </div>
          <div className="mkt-grid mkt-grid--3" style={{ marginTop: 28 }}>
            <div className="mkt-card">
              <h3 className="mkt-h3">One shared credit pool</h3>
              <p>No separate subscription. {m.name} draws from the same monthly credits as chat, image, video and agent runs.</p>
            </div>
            <div className="mkt-card">
              <h3 className="mkt-h3">Switch any time</h3>
              <p>Compare {m.name} against other models on the same task and keep the result you like best.</p>
            </div>
            <div className="mkt-card">
              <h3 className="mkt-h3">Bilingual EN / AR</h3>
              <p>Work and read answers in English or Arabic, with full right-to-left support.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Related models */}
      {related.length > 0 && (
        <section className="mkt-section" style={{ paddingTop: 0 }}>
          <div className="mkt-wrap">
            <h2 className="mkt-h3" style={{ fontSize: 22, marginBottom: 16 }}>Other {TYPE_LABEL[m.type].en.toLowerCase()}s in Pervagans</h2>
            <div className="mkt-grid">
              {related.map((r) => (
                <Link key={r.slug} href={`/models/${r.slug}`} className="mkt-card" style={{ textDecoration: "none" }}>
                  <h3 className="mkt-h3">{r.name}</h3>
                  <p style={{ marginBottom: 8 }}>{r.taglineEn}</p>
                  <span className="mkt-eyebrow" style={{ marginTop: "auto", padding: "3px 9px", fontSize: 11 }}>{r.maker}</span>
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
            <h2 className="mkt-h2">{isFree ? `Start with ${m.name} free` : `Get ${m.name} in Pervagans`}</h2>
            <p className="mkt-sub" style={{ marginInline: "auto" }}>
              {isFree
                ? `${m.name} is included free. Create your account in seconds, no credit card required.`
                : `Start free with the core models, then upgrade to ${planLabel(m.plan)} for ${m.name}. One workspace, one shared credit pool.`}
            </p>
            <div className="mkt-cta-row">
              <Link href="/" className="mkt-btn mkt-btn-primary">Start free</Link>
              <Link href="/pricing" className="mkt-btn mkt-btn-ghost">See pricing</Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
