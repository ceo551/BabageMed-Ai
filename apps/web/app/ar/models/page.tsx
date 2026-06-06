import type { Metadata } from "next";
import type { ReactElement } from "react";
import Link from "next/link";
import { MODELS, modelsByType, planLabel, type ModelEntry } from "../../(marketing)/models/catalog";
import { MktIcon } from "../../(marketing)/mkt-icons";

export const metadata: Metadata = {
  title: "نماذج الذكاء الاصطناعي: كل أفضل النماذج في مساحة واحدة",
  description:
    "Pervagans يجمع لك Claude و GPT و Gemini و DeepSeek و Qwen و GLM مع نماذج الصور والفيديو في مساحة عمل واحدة ثنائية اللغة (عربي/إنجليزي) وبرصيد credits مشترك. تصفّح كل النماذج.",
  alternates: {
    canonical: "/ar/models",
    languages: { en: "/models", ar: "/ar/models", "x-default": "/models" },
  },
  openGraph: {
    title: "نماذج الذكاء الاصطناعي في Pervagans: كل النماذج باشتراك واحد",
    description:
      "Claude و GPT و Gemini و DeepSeek و Qwen و GLM للمحادثة، مع نماذج الصور والفيديو، كلها في مساحة عمل واحدة ثنائية اللغة وبرصيد مشترك.",
    url: "https://pervagans.com/ar/models",
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
        { "@type": "ListItem", position: 2, name: "النماذج", item: "https://pervagans.com/ar/models" },
      ],
    },
    {
      "@type": "ItemList",
      name: "نماذج الذكاء الاصطناعي المتاحة في Pervagans",
      itemListElement: MODELS.map((m, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: m.name,
        url: `https://pervagans.com/ar/models/${m.slug}`,
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
        {type === "chat" ? "نماذج النصوص" : type === "image" ? "نماذج الصور" : "نماذج الفيديو"}
      </h2>
      <div className="mkt-grid">
        {list.map((m: ModelEntry) => (
          <Link key={m.slug} href={`/ar/models/${m.slug}`} className="mkt-card" style={{ textDecoration: "none" }}>
            <span className="mkt-card-ic">{ICON[m.type]}</span>
            <h3 className="mkt-h3">{m.name}</h3>
            <p style={{ marginBottom: 8 }}>{m.taglineAr}</p>
            <span style={{ marginTop: "auto", display: "inline-flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span className="mkt-eyebrow" style={{ padding: "3px 9px", fontSize: 11 }}>{m.maker}</span>
              <span className="mkt-eyebrow" style={{ padding: "3px 9px", fontSize: 11, color: "var(--green)", background: "transparent" }}>{planLabel(m.plan, "ar")}</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function ArabicModelsPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(SCHEMA) }} />

      <section className="mkt-section mkt-hero">
        <div className="mkt-wrap mkt-center">
          <span className="mkt-eyebrow">كل أفضل النماذج في مكان واحد</span>
          <h1 className="mkt-h1">كل أفضل نماذج الذكاء الاصطناعي، مساحة عمل واحدة</h1>
          <p className="mkt-lede">
            بطّل تدفع وتنقّل بين أدوات منفصلة. Pervagans بيجمع أقوى نماذج المحادثة والصور والفيديو في
            مساحة عمل واحدة ثنائية اللغة (عربي/إنجليزي)، وعلى رصيد credits مشترك. اختر النموذج المناسب
            لكل مهمة، وبدّل وقت ما تحب.
          </p>
          <div className="mkt-cta-row">
            <Link href="/" className="mkt-btn mkt-btn-primary">ابدأ مجانًا</Link>
            <Link href="/pricing" className="mkt-btn mkt-btn-ghost">شوف الأسعار</Link>
          </div>
          <p className="mkt-trust">
            {MODELS.length} نموذج · رصيد credits مشترك · بدون بطاقة للبدء
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
            <h2 className="mkt-h2">اشتراك واحد بدل خمسة</h2>
            <p className="mkt-sub" style={{ marginInline: "auto" }}>
              محادثة وصور وفيديو من أفضل النماذج، مع Spaces والمهارات والموصّلات ووكيل ذكاء اصطناعي.
              كله في مكان واحد، بالعربي أو الإنجليزي، وعلى رصيد مشترك.
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
