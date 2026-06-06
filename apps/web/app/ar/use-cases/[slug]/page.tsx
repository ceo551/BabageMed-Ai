import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { USE_CASES, getUseCase } from "../../../(marketing)/use-cases/catalog";

const SITE = "https://pervagans.com";

export function generateStaticParams() {
  return USE_CASES.map((u) => ({ slug: u.slug }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params;
  const u = getUseCase(slug);
  if (!u) return { title: "حالة الاستخدام غير موجودة" };
  const title = `Pervagans لـ ${u.nameAr}`;
  const description = `${u.taglineAr} ${u.introAr}`;
  return {
    title,
    description,
    alternates: {
      canonical: `/ar/use-cases/${u.slug}`,
      languages: { en: `/use-cases/${u.slug}`, ar: `/ar/use-cases/${u.slug}`, "x-default": `/use-cases/${u.slug}` },
    },
    openGraph: { title, description, url: `${SITE}/ar/use-cases/${u.slug}`, type: "website" },
  };
}

export default async function ArabicUseCasePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const u = getUseCase(slug);
  if (!u) notFound();

  const related = USE_CASES.filter((x) => x.slug !== u.slug).slice(0, 3);

  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        inLanguage: "ar",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "الرئيسية", item: `${SITE}/` },
          { "@type": "ListItem", position: 2, name: "حالات الاستخدام", item: `${SITE}/ar/use-cases` },
          { "@type": "ListItem", position: 3, name: u.nameAr, item: `${SITE}/ar/use-cases/${u.slug}` },
        ],
      },
      {
        "@type": "FAQPage",
        inLanguage: "ar",
        mainEntity: [
          {
            "@type": "Question",
            name: `إزاي Pervagans بيساعد ${u.nameAr}؟`,
            acceptedAnswer: {
              "@type": "Answer",
              text: `${u.introAr}`,
            },
          },
          {
            "@type": "Question",
            name: `أقدر أبدأ مجانًا؟`,
            acceptedAnswer: {
              "@type": "Answer",
              text: `أيوه. ابدأ بخطة Pervagans المجانية بـ 200 رصيد شهري، بدون بطاقة، واترقّى وقت ما تحتاج. كل المميزات بتشتغل على رصيد credits مشترك واحد.`,
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
            <span className="mkt-eyebrow">حالة استخدام</span>
            <span className="mkt-eyebrow">{u.nameAr}</span>
            <span className="mkt-eyebrow" style={{ color: "var(--green)" }}>ثنائي اللغة عربي/إنجليزي</span>
          </p>
          <h1 className="mkt-h1" style={{ maxWidth: "20ch" }}>Pervagans لـ {u.nameAr}</h1>
          <p className="mkt-lede">{u.taglineAr}</p>
          <p className="mkt-sub" style={{ marginTop: 14 }}>{u.introAr}</p>
          <div className="mkt-cta-row">
            <Link href="/" className="mkt-btn mkt-btn-primary">ابدأ مجانًا</Link>
            <Link href="/ar/use-cases" className="mkt-btn mkt-btn-ghost">كل حالات الاستخدام</Link>
          </div>
        </div>
      </section>

      {/* Jobs + features */}
      <section className="mkt-section" style={{ paddingTop: 0 }}>
        <div className="mkt-wrap">
          <div className="mkt-row">
            <div>
              <h2 className="mkt-h3" style={{ fontSize: 24 }}>اللي تقدر تعمله</h2>
              <ul className="mkt-list">
                {u.jobsAr.map((j, i) => <li key={i}>{j}</li>)}
              </ul>
            </div>
            <div className="mkt-row-media" style={{ flexDirection: "column", gap: 12, alignItems: "flex-start", minHeight: 0, padding: 28 }}>
              <h3 className="mkt-h3" style={{ margin: 0 }}>مبني لده</h3>
              <ul className="mkt-list" style={{ margin: 0 }}>
                {u.featuresAr.map((f, i) => <li key={i}>{f}</li>)}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Why Pervagans */}
      <section className="mkt-section" style={{ paddingTop: 0 }}>
        <div className="mkt-wrap">
          <div className="mkt-center">
            <span className="mkt-eyebrow">في Pervagans</span>
            <h2 className="mkt-h2">كل ده في مساحة عمل واحدة</h2>
            <p className="mkt-sub">
              من غير ما تنقّل بين الأدوات. أفضل النماذج وتوليد الصور والفيديو وموصّلاتك، كلهم في نفس
              مساحة العمل ثنائية اللغة. بدّل بين النماذج حسب المهمة، وكله بيشتغل على رصيد credits
              مشترك واحد، فمفيش حاجة زيادة تديرها.
            </p>
          </div>
          <div className="mkt-grid mkt-grid--3" style={{ marginTop: 28 }}>
            <div className="mkt-card">
              <h3 className="mkt-h3">رصيد مشترك واحد</h3>
              <p>بدون اشتراك منفصل لكل أداة. المحادثة والصور والفيديو وتشغيلات الـ agent كلها بتسحب من نفس الرصيد الشهري.</p>
            </div>
            <div className="mkt-card">
              <h3 className="mkt-h3">بدّل في أي وقت</h3>
              <p>قارن أكتر من نموذج على نفس المهمة واحتفظ بالنتيجة اللي عجبتك، من غير ما تسيب مساحة العمل.</p>
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
            <h2 className="mkt-h3" style={{ fontSize: 22, marginBottom: 16 }}>حالات استخدام تانية في Pervagans</h2>
            <div className="mkt-grid">
              {related.map((r) => (
                <Link key={r.slug} href={`/ar/use-cases/${r.slug}`} className="mkt-card" style={{ textDecoration: "none" }}>
                  <h3 className="mkt-h3">{r.nameAr}</h3>
                  <p style={{ marginBottom: 8 }}>{r.taglineAr}</p>
                  <span className="mkt-eyebrow" style={{ marginTop: "auto", padding: "3px 9px", fontSize: 11 }}>حالة استخدام</span>
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
            <h2 className="mkt-h2">جرّب Pervagans لـ {u.nameAr}</h2>
            <p className="mkt-sub" style={{ marginInline: "auto" }}>
              ابدأ مجانًا بالنماذج الأساسية، بدون بطاقة. مساحة عمل واحدة، رصيد مشترك واحد، لكل شغلك.
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
