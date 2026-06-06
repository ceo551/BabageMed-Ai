import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MODELS, getModel, modelsByType, planLabel } from "../../../(marketing)/models/catalog";

const SITE = "https://pervagans.com";

export function generateStaticParams() {
  return MODELS.map((m) => ({ slug: m.slug }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params;
  const m = getModel(slug);
  if (!m) return { title: "النموذج غير موجود" };
  const title = `${m.name} أونلاين في Pervagans`;
  const description = `استخدم ${m.name} من ${m.maker} في Pervagans، مساحة العمل ثنائية اللغة (عربي/إنجليزي). ${m.taglineAr} ${m.plan === "free" ? "متاح مجانًا." : `متاح على خطة ${planLabel(m.plan, "ar")}.`} رصيد credits مشترك مع باقي النماذج.`;
  return {
    title,
    description,
    alternates: {
      canonical: `/ar/models/${m.slug}`,
      languages: { en: `/models/${m.slug}`, ar: `/ar/models/${m.slug}`, "x-default": `/models/${m.slug}` },
    },
    openGraph: { title, description, url: `${SITE}/ar/models/${m.slug}`, type: "website" },
  };
}

export default async function ArabicModelPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const m = getModel(slug);
  if (!m) notFound();

  const related = modelsByType(m.type).filter((x) => x.slug !== m.slug).slice(0, 3);
  const isFree = m.plan === "free";
  const typeAr = m.type === "chat" ? "نموذج نصّي" : m.type === "image" ? "نموذج صور" : "نموذج فيديو";

  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "الرئيسية", item: `${SITE}/` },
          { "@type": "ListItem", position: 2, name: "النماذج", item: `${SITE}/ar/models` },
          { "@type": "ListItem", position: 3, name: m.name, item: `${SITE}/ar/models/${m.slug}` },
        ],
      },
      {
        "@type": "SoftwareApplication",
        name: `${m.name} في Pervagans`,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web, iOS, Android",
        inLanguage: "ar",
        description: `${m.taglineAr} ${m.introAr}`,
        offers: { "@type": "Offer", price: isFree ? "0" : "20", priceCurrency: "USD", url: `${SITE}/pricing` },
        brand: { "@type": "Brand", name: m.maker },
      },
      {
        "@type": "FAQPage",
        inLanguage: "ar",
        mainEntity: [
          {
            "@type": "Question",
            name: `إزاي أستخدم ${m.name}؟`,
            acceptedAnswer: {
              "@type": "Answer",
              text: `سجّل الدخول في Pervagans، افتح أي شات أو Space أو ميزة، واختر ${m.name} من قائمة النماذج. تقدر تبدّل النماذج في أي وقت وكلها بتسحب من نفس رصيد الـ credits المشترك.`,
            },
          },
          {
            "@type": "Question",
            name: `هل ${m.name} مجاني؟`,
            acceptedAnswer: {
              "@type": "Answer",
              text: isFree
                ? `أيوه. ${m.name} ضمن خطة Pervagans المجانية بـ 200 رصيد شهري، بدون بطاقة.`
                : `${m.name} متاح على خطة ${planLabel(m.plan, "ar")} في Pervagans. الخطة المجانية ($0) بتخليك تجرّب النماذج الأساسية الأول، وتترقّى لما تحتاج ${m.name}.`,
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
            <span className="mkt-eyebrow">{typeAr}</span>
            <span className="mkt-eyebrow">{m.maker}</span>
            <span className="mkt-eyebrow" style={{ color: "var(--green)" }}>{planLabel(m.plan, "ar")}</span>
          </p>
          <h1 className="mkt-h1" style={{ maxWidth: "20ch" }}>{m.name}</h1>
          <p className="mkt-lede">{m.taglineAr}</p>
          <p className="mkt-sub" style={{ marginTop: 14 }}>{m.introAr}</p>
          <div className="mkt-cta-row">
            <Link href="/" className="mkt-btn mkt-btn-primary">{isFree ? "استخدمه مجانًا" : "ابدأ مجانًا"}</Link>
            <Link href="/ar/models" className="mkt-btn mkt-btn-ghost">كل النماذج</Link>
          </div>
        </div>
      </section>

      {/* Best for + highlights */}
      <section className="mkt-section" style={{ paddingTop: 0 }}>
        <div className="mkt-wrap">
          <div className="mkt-row">
            <div>
              <h2 className="mkt-h3" style={{ fontSize: 24 }}>أفضل استخدام لـ {m.name}</h2>
              <ul className="mkt-list">
                {m.bestForAr.map((b, i) => <li key={i}>{b}</li>)}
              </ul>
            </div>
            <div className="mkt-row-media" style={{ flexDirection: "column", gap: 12, alignItems: "flex-start", minHeight: 0, padding: 28 }}>
              <h3 className="mkt-h3" style={{ margin: 0 }}>أبرز المميزات</h3>
              <ul className="mkt-list" style={{ margin: 0 }}>
                {m.highlightsAr.map((h, i) => <li key={i}>{h}</li>)}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* How to use */}
      <section className="mkt-section" style={{ paddingTop: 0 }}>
        <div className="mkt-wrap">
          <div className="mkt-center">
            <span className="mkt-eyebrow">في Pervagans</span>
            <h2 className="mkt-h2">استخدم {m.name} من غير ما تنقّل بين الأدوات</h2>
            <p className="mkt-sub">
              {m.name} موجود في نفس مساحة العمل مع باقي النماذج. اختاره من قائمة النماذج في أي شات أو
              Space أو ميزة، وبدّل لحظة ما يبقى نموذج تاني أنسب. كله بيشتغل على رصيد credits مشترك واحد،
              فمفيش حاجة زيادة تديرها.
            </p>
          </div>
          <div className="mkt-grid mkt-grid--3" style={{ marginTop: 28 }}>
            <div className="mkt-card">
              <h3 className="mkt-h3">رصيد مشترك واحد</h3>
              <p>بدون اشتراك منفصل. {m.name} بيسحب من نفس الرصيد الشهري بتاع المحادثة والصور والفيديو وتشغيلات الـ agent.</p>
            </div>
            <div className="mkt-card">
              <h3 className="mkt-h3">بدّل في أي وقت</h3>
              <p>قارن {m.name} مع نماذج تانية على نفس المهمة واحتفظ بالنتيجة اللي عجبتك.</p>
            </div>
            <div className="mkt-card">
              <h3 className="mkt-h3">ثنائي اللغة عربي/إنجليزي</h3>
              <p>اشتغل واقرأ الإجابات بالعربي أو الإنجليزي، بدعم كامل للكتابة من اليمين لليسار.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Related */}
      {related.length > 0 && (
        <section className="mkt-section" style={{ paddingTop: 0 }}>
          <div className="mkt-wrap">
            <h2 className="mkt-h3" style={{ fontSize: 22, marginBottom: 16 }}>{typeAr === "نموذج نصّي" ? "نماذج نصوص" : typeAr === "نموذج صور" ? "نماذج صور" : "نماذج فيديو"} تانية في Pervagans</h2>
            <div className="mkt-grid">
              {related.map((r) => (
                <Link key={r.slug} href={`/ar/models/${r.slug}`} className="mkt-card" style={{ textDecoration: "none" }}>
                  <h3 className="mkt-h3">{r.name}</h3>
                  <p style={{ marginBottom: 8 }}>{r.taglineAr}</p>
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
            <h2 className="mkt-h2">{isFree ? `ابدأ بـ ${m.name} مجانًا` : `احصل على ${m.name} في Pervagans`}</h2>
            <p className="mkt-sub" style={{ marginInline: "auto" }}>
              {isFree
                ? `${m.name} متاح مجانًا. أنشئ حسابك في ثوانٍ، بدون بطاقة.`
                : `ابدأ مجانًا بالنماذج الأساسية، وبعدين ترقّى لـ ${planLabel(m.plan, "ar")} عشان ${m.name}. مساحة عمل واحدة، رصيد مشترك واحد.`}
            </p>
            <div className="mkt-cta-row">
              <Link href="/" className="mkt-btn mkt-btn-primary">ابدأ مجانًا</Link>
              <Link href="/pricing" className="mkt-btn mkt-btn-ghost">شوف الأسعار</Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
