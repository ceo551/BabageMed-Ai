import type { Metadata } from "next";
import Link from "next/link";
import { EFFECTS, EFFECT_CATEGORIES, CATEGORY_LABEL, type EffectEntry } from "../../(marketing)/effects/catalog";
import { MktIcon } from "../../(marketing)/mkt-icons";

export const metadata: Metadata = {
  title: "تأثيرات صور وفيديو بضغطة واحدة في Pervagans",
  description:
    "مكتبة تأثيرات جاهزة في Pervagans: فن بأسلوب جيبلي وبيكسار وأنمي، صور احترافية ومنتجات وشعارات، خط عربي وبطاقات رمضان والعيد، ولقطات فيديو سينمائية. اختر تأثيرًا واكتب فكرتك وخلاص.",
  alternates: {
    canonical: "/ar/effects",
    languages: { en: "/effects", ar: "/ar/effects", "x-default": "/effects" },
  },
  openGraph: {
    title: "تأثيرات صور وفيديو بضغطة واحدة في Pervagans",
    description:
      "إعدادات جاهزة تحوّل أي فكرة لصورة أو فيديو في ثوانٍ: أنماط فنية، صور شغل واحترافية، تأثيرات عربية، ولقطات فيديو، كلها برصيد credits مشترك.",
    url: "https://pervagans.com/ar/effects",
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
        { "@type": "ListItem", position: 2, name: "التأثيرات", item: "https://pervagans.com/ar/effects" },
      ],
    },
    {
      "@type": "ItemList",
      name: "تأثيرات الصور والفيديو الجاهزة في Pervagans",
      itemListElement: EFFECTS.map((e, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: e.nameAr,
        url: `https://pervagans.com/ar/effects/${e.slug}`,
      })),
    },
  ],
};

function Group({ cat }: { cat: EffectEntry["category"] }) {
  const list = EFFECTS.filter((e) => e.category === cat);
  if (list.length === 0) return null;
  return (
    <div style={{ marginTop: 40 }}>
      <h2 className="mkt-h3" style={{ fontSize: 22, marginBottom: 16 }}>
        {CATEGORY_LABEL[cat].ar}
      </h2>
      <div className="mkt-grid">
        {list.map((e: EffectEntry) => (
          <Link key={e.slug} href={`/ar/effects/${e.slug}`} className="mkt-card" style={{ textDecoration: "none" }}>
            <span className="mkt-card-ic">{MktIcon.media}</span>
            <h3 className="mkt-h3">{e.nameAr}</h3>
            <p style={{ marginBottom: 8 }}>{e.taglineAr}</p>
            <span style={{ marginTop: "auto", display: "inline-flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span className="mkt-eyebrow" style={{ padding: "3px 9px", fontSize: 11 }}>
                {e.type === "video" ? "فيديو" : "صورة"}
              </span>
              <span className="mkt-eyebrow" style={{ padding: "3px 9px", fontSize: 11, color: "var(--green)", background: "transparent" }}>
                {e.aspect}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function ArabicEffectsPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(SCHEMA) }} />

      <section className="mkt-section mkt-hero">
        <div className="mkt-wrap mkt-center">
          <span className="mkt-eyebrow">تأثيرات بضغطة واحدة</span>
          <h1 className="mkt-h1">تأثيرات صور وفيديو بضغطة واحدة</h1>
          <p className="mkt-lede">
            مش لازم تتعب في كتابة برومبت طويل أو تظبط إعدادات. كل تأثير في Pervagans إعداد جاهز:
            برومبت ونموذج وإعدادات متظبطة عشان تحوّل أي فكرة لصورة أو فيديو في ثوانٍ. اختر التأثير،
            اكتب فكرتك بالعربي أو الإنجليزي، وهتطلع النتيجة على رصيد credits مشترك.
          </p>
          <div className="mkt-cta-row">
            <Link href="/" className="mkt-btn mkt-btn-primary">ابدأ مجانًا</Link>
            <Link href="/pricing" className="mkt-btn mkt-btn-ghost">شوف الأسعار</Link>
          </div>
          <p className="mkt-trust">
            {EFFECTS.length} تأثير جاهز · رصيد credits مشترك · بدون بطاقة للبدء
          </p>
        </div>
      </section>

      <section className="mkt-section" style={{ paddingTop: 0 }}>
        <div className="mkt-wrap">
          {EFFECT_CATEGORIES.map((cat) => (
            <Group key={cat} cat={cat} />
          ))}
        </div>
      </section>

      <section className="mkt-section">
        <div className="mkt-wrap">
          <div className="mkt-cta-band">
            <h2 className="mkt-h2">إعدادات جاهزة، نتيجة فورية</h2>
            <p className="mkt-sub" style={{ marginInline: "auto" }}>
              أنماط فنية وصور احترافية وتأثيرات عربية ولقطات فيديو، كلها بضغطة واحدة وعلى رصيد مشترك.
              اكتب فكرتك بالعربي أو الإنجليزي وخلّي Pervagans يكمّل الباقي.
            </p>
            <div className="mkt-cta-row">
              <Link href="/" className="mkt-btn mkt-btn-primary">ابدأ مجانًا</Link>
              <Link href="/pricing" className="mkt-btn mkt-btn-ghost">قارن الخطط</Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
