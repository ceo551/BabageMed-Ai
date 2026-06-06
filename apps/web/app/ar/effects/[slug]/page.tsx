import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EFFECTS, getEffect, effectsByCategory, CATEGORY_LABEL, effectHref } from "../../../(marketing)/effects/catalog";

const SITE = "https://pervagans.com";

export function generateStaticParams() {
  return EFFECTS.map((e) => ({ slug: e.slug }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params;
  const e = getEffect(slug);
  if (!e) return { title: "التأثير غير موجود" };
  const title = `مولّد ${e.nameAr} في Pervagans`;
  const description = `${e.taglineAr} ${e.descAr} كله جوه Pervagans، مساحة العمل ثنائية اللغة (عربي/إنجليزي)، برصيد credits مشترك واحد.`;
  return {
    title,
    description,
    alternates: {
      canonical: `/ar/effects/${e.slug}`,
      languages: { en: `/effects/${e.slug}`, ar: `/ar/effects/${e.slug}`, "x-default": `/effects/${e.slug}` },
    },
    openGraph: { title, description, url: `${SITE}/ar/effects/${e.slug}`, type: "website" },
  };
}

export default async function ArabicEffectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const e = getEffect(slug);
  if (!e) notFound();

  const catLabel = CATEGORY_LABEL[e.category].ar;
  const typeAr = e.type === "video" ? "تأثير فيديو" : "تأثير صورة";
  const related = effectsByCategory(e.category).filter((x) => x.slug !== e.slug).slice(0, 3);

  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "الرئيسية", item: `${SITE}/` },
          { "@type": "ListItem", position: 2, name: "التأثيرات", item: `${SITE}/ar/effects` },
          { "@type": "ListItem", position: 3, name: e.nameAr, item: `${SITE}/ar/effects/${e.slug}` },
        ],
      },
      {
        "@type": "SoftwareApplication",
        name: `مولّد ${e.nameAr} في Pervagans`,
        applicationCategory: "MultimediaApplication",
        operatingSystem: "Web, iOS, Android",
        inLanguage: "ar",
        description: `${e.taglineAr} ${e.descAr}`,
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD", url: `${SITE}/pricing` },
        brand: { "@type": "Brand", name: "Pervagans" },
      },
      {
        "@type": "FAQPage",
        inLanguage: "ar",
        mainEntity: [
          {
            "@type": "Question",
            name: `إزاي أستخدم تأثير ${e.nameAr}؟`,
            acceptedAnswer: {
              "@type": "Answer",
              text: `سجّل الدخول في Pervagans واضغط على تأثير ${e.nameAr}، وهيفتحلك المؤلّف بالإعداد جاهز. ${e.promptHintAr} بعدين اضغط توليد وهتطلع النتيجة في ثوانٍ، وتقدر تعدّل أي تفصيلة وتعيد التوليد.`,
            },
          },
          {
            "@type": "Question",
            name: `هل تأثير ${e.nameAr} مجاني؟`,
            acceptedAnswer: {
              "@type": "Answer",
              text: `أيوه. تأثير ${e.nameAr} متاح ضمن خطة Pervagans المجانية بـ 200 رصيد شهري، بدون بطاقة. كل التأثيرات بتسحب من نفس رصيد الـ credits المشترك بتاع المحادثة والصور والفيديو.`,
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
            <span className="mkt-eyebrow">{catLabel}</span>
            <span className="mkt-eyebrow" style={{ color: "var(--green)" }}>متاح مجانًا</span>
          </p>
          <h1 className="mkt-h1" style={{ maxWidth: "20ch" }}>{e.nameAr}</h1>
          <p className="mkt-lede">{e.taglineAr}</p>
          <p className="mkt-sub" style={{ marginTop: 14 }}>{e.descAr}</p>
          <div className="mkt-cta-row">
            <Link href={effectHref(e, "ar")} className="mkt-btn mkt-btn-primary">جرّب التأثير ده</Link>
            <Link href="/ar/effects" className="mkt-btn mkt-btn-ghost">كل التأثيرات</Link>
          </div>
        </div>
      </section>

      {/* What to type + highlights */}
      <section className="mkt-section" style={{ paddingTop: 0 }}>
        <div className="mkt-wrap">
          <div className="mkt-row">
            <div>
              <h2 className="mkt-h3" style={{ fontSize: 24 }}>إيه اللي تكتبه</h2>
              <ul className="mkt-list">
                <li>{e.promptHintAr}</li>
                <li>التأثير محمّل مسبقًا بأفضل إعداد، فمحتاج بس تكتب فكرتك.</li>
                <li>عدّل أي تفصيلة وأعد التوليد لحد ما توصل للنتيجة اللي عايزها.</li>
              </ul>
            </div>
            <div className="mkt-row-media" style={{ flexDirection: "column", gap: 12, alignItems: "flex-start", minHeight: 0, padding: 28 }}>
              <h3 className="mkt-h3" style={{ margin: 0 }}>ليه التأثير ده</h3>
              <ul className="mkt-list" style={{ margin: 0 }}>
                <li>نتيجة جاهزة بضغطة واحدة، من غير ضبط إعدادات.</li>
                <li>{e.type === "video" ? "مقاطع فيديو قصيرة جاهزة للسوشيال." : "صور بجودة عالية جاهزة للمشاركة."}</li>
                <li>بيشتغل على رصيد credits مشترك واحد مع باقي المميزات.</li>
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
            <h2 className="mkt-h2">استخدم تأثير {e.nameAr} من غير ما تنقّل بين الأدوات</h2>
            <p className="mkt-sub">
              تأثير {e.nameAr} موجود في نفس مساحة العمل مع باقي التأثيرات والنماذج. اضغط عليه عشان يفتحلك
              المؤلّف بالإعداد جاهز، اكتب فكرتك واضغط توليد. كله بيشتغل على رصيد credits مشترك واحد، فمفيش
              حاجة زيادة تديرها.
            </p>
          </div>
          <div className="mkt-grid mkt-grid--3" style={{ marginTop: 28 }}>
            <div className="mkt-card">
              <h3 className="mkt-h3">إعداد جاهز بضغطة</h3>
              <p>اضغط على تأثير {e.nameAr} وهيتفتح المؤلّف بالوصف والإعدادات المضبوطة، فتبدأ على طول.</p>
            </div>
            <div className="mkt-card">
              <h3 className="mkt-h3">رصيد مشترك واحد</h3>
              <p>بدون اشتراك منفصل. تأثير {e.nameAr} بيسحب من نفس الرصيد الشهري بتاع المحادثة والصور والفيديو.</p>
            </div>
            <div className="mkt-card">
              <h3 className="mkt-h3">ثنائي اللغة عربي/إنجليزي</h3>
              <p>اكتب فكرتك بالعربي أو الإنجليزي، بدعم كامل للكتابة من اليمين لليسار.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Related */}
      {related.length > 0 && (
        <section className="mkt-section" style={{ paddingTop: 0 }}>
          <div className="mkt-wrap">
            <h2 className="mkt-h3" style={{ fontSize: 22, marginBottom: 16 }}>تأثيرات تانية في {catLabel}</h2>
            <div className="mkt-grid">
              {related.map((r) => (
                <Link key={r.slug} href={`/ar/effects/${r.slug}`} className="mkt-card" style={{ textDecoration: "none" }}>
                  <h3 className="mkt-h3">{r.nameAr}</h3>
                  <p style={{ marginBottom: 8 }}>{r.taglineAr}</p>
                  <span className="mkt-eyebrow" style={{ marginTop: "auto", padding: "3px 9px", fontSize: 11 }}>{CATEGORY_LABEL[r.category].ar}</span>
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
            <h2 className="mkt-h2">ابدأ بتأثير {e.nameAr} مجانًا</h2>
            <p className="mkt-sub" style={{ marginInline: "auto" }}>
              تأثير {e.nameAr} متاح مجانًا. أنشئ حسابك في ثوانٍ، بدون بطاقة، وجرّبه على طول.
            </p>
            <div className="mkt-cta-row">
              <Link href={effectHref(e, "ar")} className="mkt-btn mkt-btn-primary">جرّب التأثير ده</Link>
              <Link href="/pricing" className="mkt-btn mkt-btn-ghost">شوف الأسعار</Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
