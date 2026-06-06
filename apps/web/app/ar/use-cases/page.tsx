import type { Metadata } from "next";
import Link from "next/link";
import { USE_CASES } from "../../(marketing)/use-cases/catalog";
import { MktIcon } from "../../(marketing)/mkt-icons";

export const metadata: Metadata = {
  title: "حالات الاستخدام: Pervagans لكل مجال",
  description:
    "سواء كنت في التسويق أو التجارة الإلكترونية أو التعليم أو البرمجة، Pervagans بيجمع أفضل النماذج وتوليد الصور والفيديو وموصّلاتك في مساحة عمل واحدة ثنائية اللغة (عربي/إنجليزي) وبرصيد credits مشترك. اكتشف حالة الاستخدام المناسبة لك.",
  alternates: {
    canonical: "/ar/use-cases",
    languages: { en: "/use-cases", ar: "/ar/use-cases", "x-default": "/use-cases" },
  },
  openGraph: {
    title: "Pervagans لكل مجال: حالات الاستخدام",
    description:
      "من التسويق للبرمجة، Pervagans بيحطّ أفضل النماذج وتوليد الصور والفيديو وموصّلاتك في مساحة عمل واحدة ثنائية اللغة وبرصيد مشترك.",
    url: "https://pervagans.com/ar/use-cases",
    type: "website",
  },
};

const SCHEMA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "الرئيسية", item: "https://pervagans.com/" },
        { "@type": "ListItem", position: 2, name: "حالات الاستخدام", item: "https://pervagans.com/ar/use-cases" },
      ],
    },
    {
      "@type": "ItemList",
      name: "حالات استخدام Pervagans",
      itemListElement: USE_CASES.map((u, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: u.nameAr,
        url: `https://pervagans.com/ar/use-cases/${u.slug}`,
      })),
    },
  ],
};

export default function ArabicUseCasesPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(SCHEMA) }} />

      <section className="mkt-section mkt-hero">
        <div className="mkt-wrap mkt-center">
          <span className="mkt-eyebrow">حالات الاستخدام</span>
          <h1 className="mkt-h1">Pervagans لكل مجال</h1>
          <p className="mkt-lede">
            مهما كان شغلك، في Pervagans حالة استخدام تناسبك. سواء كنت في التسويق أو التجارة الإلكترونية
            أو التعليم أو البحث أو الكتابة أو البرمجة، بتلاقي أفضل نماذج المحادثة والصور والفيديو وموصّلاتك
            في مساحة عمل واحدة ثنائية اللغة (عربي/إنجليزي) وعلى رصيد credits مشترك. اختر مجالك وشوف
            Pervagans بيشتغل إزاي لك.
          </p>
          <div className="mkt-cta-row">
            <Link href="/" className="mkt-btn mkt-btn-primary">ابدأ مجانًا</Link>
            <Link href="/pricing" className="mkt-btn mkt-btn-ghost">الأسعار</Link>
          </div>
          <p className="mkt-trust">
            {USE_CASES.length} حالة استخدام · رصيد credits مشترك · بدون بطاقة للبدء
          </p>
        </div>
      </section>

      <section className="mkt-section" style={{ paddingTop: 0 }}>
        <div className="mkt-wrap">
          <div className="mkt-grid mkt-grid--3">
            {USE_CASES.map((u) => (
              <Link key={u.slug} href={`/ar/use-cases/${u.slug}`} className="mkt-card" style={{ textDecoration: "none" }}>
                <span className="mkt-card-ic">{MktIcon.compass}</span>
                <h3 className="mkt-h3">{u.nameAr}</h3>
                <p style={{ marginBottom: 8 }}>{u.taglineAr}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="mkt-section">
        <div className="mkt-wrap">
          <div className="mkt-cta-band">
            <h2 className="mkt-h2">اشتراك واحد لكل مجالاتك</h2>
            <p className="mkt-sub" style={{ marginInline: "auto" }}>
              محادثة وصور وفيديو من أفضل النماذج، مع Spaces والمهارات والموصّلات ووكيل ذكاء اصطناعي.
              كله في مكان واحد، بالعربي أو الإنجليزي، وعلى رصيد مشترك.
            </p>
            <div className="mkt-cta-row">
              <Link href="/" className="mkt-btn mkt-btn-primary">ابدأ مجانًا</Link>
              <Link href="/pricing" className="mkt-btn mkt-btn-ghost">الأسعار</Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
