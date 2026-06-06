import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { USE_CASES, getUseCase } from "../catalog";

const SITE = "https://pervagans.com";

export function generateStaticParams() {
  return USE_CASES.map((u) => ({ slug: u.slug }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params;
  const u = getUseCase(slug);
  if (!u) return { title: "Use case not found" };
  const title = `AI for ${u.nameEn} | Pervagans`;
  const description = u.introEn.trim();
  return {
    title,
    description,
    alternates: {
      canonical: `/use-cases/${u.slug}`,
      languages: {
        en: `/use-cases/${u.slug}`,
        ar: `/ar/use-cases/${u.slug}`,
        "x-default": `/use-cases/${u.slug}`,
      },
    },
    openGraph: { title, description, url: `${SITE}/use-cases/${u.slug}`, type: "website" },
  };
}

export default async function UseCasePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const u = getUseCase(slug);
  if (!u) notFound();

  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
          { "@type": "ListItem", position: 2, name: "Use cases", item: `${SITE}/use-cases` },
          { "@type": "ListItem", position: 3, name: u.nameEn, item: `${SITE}/use-cases/${u.slug}` },
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: [
          {
            "@type": "Question",
            name: `Can Pervagans help with ${u.nameEn}?`,
            acceptedAnswer: {
              "@type": "Answer",
              text: `Yes. ${u.introEn} Everything runs in one bilingual workspace on a single shared credit pool.`,
            },
          },
          {
            "@type": "Question",
            name: "Is it bilingual?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Yes. Pervagans works in both English and Arabic, with full right-to-left support, so you can read, write and switch languages without leaving the workspace.",
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
          <p style={{ margin: 0 }}>
            <span className="mkt-eyebrow">Use case</span>
          </p>
          <h1 className="mkt-h1" style={{ maxWidth: "20ch" }}>{u.nameEn}</h1>
          <p className="mkt-lede">{u.taglineEn}</p>
          <p className="mkt-sub" style={{ marginTop: 14 }}>{u.introEn}</p>
          <div className="mkt-cta-row">
            <Link href="/" className="mkt-btn mkt-btn-primary">Start free</Link>
            <Link href="/use-cases" className="mkt-btn mkt-btn-ghost">All use cases</Link>
          </div>
        </div>
      </section>

      {/* What you can do + Built for this */}
      <section className="mkt-section" style={{ paddingTop: 0 }}>
        <div className="mkt-wrap">
          <div className="mkt-row">
            <div>
              <h2 className="mkt-h3" style={{ fontSize: 24 }}>What you can do</h2>
              <ul className="mkt-list">
                {u.jobsEn.map((j, i) => <li key={i}>{j}</li>)}
              </ul>
            </div>
            <div className="mkt-row-media" style={{ flexDirection: "column", gap: 12, alignItems: "flex-start", minHeight: 0, padding: 28 }}>
              <h3 className="mkt-h3" style={{ margin: 0 }}>Built for this</h3>
              <ul className="mkt-list" style={{ margin: 0 }}>
                {u.featuresEn.map((f, i) => <li key={i}>{f}</li>)}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* How it works in Pervagans */}
      <section className="mkt-section" style={{ paddingTop: 0 }}>
        <div className="mkt-wrap">
          <div className="mkt-center">
            <span className="mkt-eyebrow">In Pervagans</span>
            <h2 className="mkt-h2">Built for {u.nameEn.toLowerCase()}, in one workspace</h2>
            <p className="mkt-sub">
              Everything you need lives in the same workspace. Pick the model that fits the task,
              work in English or Arabic, and let it all run on one shared credit pool with nothing
              extra to manage.
            </p>
          </div>
          <div className="mkt-grid mkt-grid--3" style={{ marginTop: 28 }}>
            <div className="mkt-card">
              <h3 className="mkt-h3">One workspace</h3>
              <p>Chat, image, video, research and agent runs sit side by side, so {u.nameEn.toLowerCase()} move from idea to result in one place.</p>
            </div>
            <div className="mkt-card">
              <h3 className="mkt-h3">Bilingual EN / AR</h3>
              <p>Work and read answers in English or Arabic, with full right-to-left support throughout.</p>
            </div>
            <div className="mkt-card">
              <h3 className="mkt-h3">One shared credit pool</h3>
              <p>No separate subscriptions. Every model and feature draws from the same monthly credits.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mkt-section" style={{ paddingTop: 0 }}>
        <div className="mkt-wrap">
          <div className="mkt-cta-band">
            <h2 className="mkt-h2">Start with Pervagans free</h2>
            <p className="mkt-sub" style={{ marginInline: "auto" }}>
              Create your account in seconds, no credit card required. One workspace, one shared
              credit pool, English and Arabic from day one.
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
