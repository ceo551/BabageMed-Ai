// Marketing + functional catalog for the one-tap Effects library
// (/effects + /effects/[slug], EN + AR).
//
// Each effect is a PRESET: a ready-made prompt + model + settings that turns the
// existing text->image / text->video pipeline into a one-click outcome. The
// public landing page is the SEO surface (targets "<effect> generator",
// "<effect> ai", etc.); its CTA deep-links into the media composer with the
// preset pre-filled (see effectHref + the FeatureChat URL prefill).
//
// IMPORTANT: only text->image and text->video presets — the media backend has
// no image-to-video, so we do NOT fake "upload a photo" effects (e.g. hug/kiss).
// Every preset here maps to a capability the product actually has.

export type EffectType = "image" | "video";
export type Aspect = "1:1" | "16:9" | "9:16" | "4:3" | "3:4";

export type EffectEntry = {
  slug: string;
  type: EffectType;
  model: string;        // real model id from app/lib/models.ts
  aspect: Aspect;
  prompt: string;       // the preset prompt sent to the model
  category: "style" | "practical" | "arabic" | "video";
  nameEn: string;
  nameAr: string;
  taglineEn: string;
  taglineAr: string;
  descEn: string;
  descAr: string;
  promptHintEn: string; // shown to the user as "what to type / tweak"
  promptHintAr: string;
};

export const CATEGORY_LABEL: Record<EffectEntry["category"], { en: string; ar: string }> = {
  style: { en: "Art & style", ar: "فن وأنماط" },
  practical: { en: "Work & business", ar: "شغل وأعمال" },
  arabic: { en: "Arabic & MENA", ar: "عربي ومنطقتنا" },
  video: { en: "Video", ar: "فيديو" },
};

export const EFFECTS: EffectEntry[] = [
  // ── Art & style (image) ─────────────────────────────────────────────────
  {
    slug: "ghibli-style", type: "image", model: "qwen-image-2.0-pro", aspect: "1:1", category: "style",
    prompt: "Studio Ghibli style illustration, soft hand-painted anime look, warm lighting, gentle colors, detailed background:",
    nameEn: "Ghibli-style art", nameAr: "فن بأسلوب جيبلي",
    taglineEn: "Turn any idea into soft, hand-painted Ghibli-style art.",
    taglineAr: "حوّل أي فكرة لفن مرسوم بأسلوب جيبلي الناعم.",
    descEn: "Generate dreamy, hand-painted illustrations in the beloved Studio Ghibli look: warm light, gentle colors and rich backgrounds. Describe a scene or character and get a finished Ghibli-style image in seconds.",
    descAr: "ولّد رسومات حالمة مرسومة باليد بأسلوب ستوديو جيبلي المحبوب: إضاءة دافئة وألوان ناعمة وخلفيات غنية. اوصف مشهد أو شخصية وهتطلع صورة جاهزة بأسلوب جيبلي في ثوانٍ.",
    promptHintEn: "Describe the scene or character (e.g. a girl on a hill at sunset).",
    promptHintAr: "اوصف المشهد أو الشخصية (مثلًا بنت على تل وقت الغروب).",
  },
  {
    slug: "pixar-3d", type: "image", model: "gpt-image-2", aspect: "1:1", category: "style",
    prompt: "Cute 3D Pixar-style character render, big expressive eyes, soft studio lighting, clean background, high detail:",
    nameEn: "3D Pixar-style character", nameAr: "شخصية ثلاثية الأبعاد بأسلوب بيكسار",
    taglineEn: "Make a cute 3D animated-movie character from a description.",
    taglineAr: "اعمل شخصية كرتونية ثلاثية الأبعاد لطيفة من وصف.",
    descEn: "Create a polished 3D character in the look of modern animated films: big expressive eyes, soft lighting and a clean background. Great for avatars, mascots and fun portraits.",
    descAr: "اعمل شخصية ثلاثية الأبعاد متقنة بأسلوب أفلام التحريك الحديثة: عيون كبيرة معبّرة وإضاءة ناعمة وخلفية نظيفة. ممتاز للأفاتار والماسكوت والصور الممتعة.",
    promptHintEn: "Describe the character (e.g. a friendly young inventor).",
    promptHintAr: "اوصف الشخصية (مثلًا مخترع شاب ودود).",
  },
  {
    slug: "anime-portrait", type: "image", model: "qwen-image-2.0-pro", aspect: "3:4", category: "style",
    prompt: "High-quality anime portrait, clean line art, vibrant cel shading, detailed eyes, studio background:",
    nameEn: "Anime portrait", nameAr: "بورتريه أنمي",
    taglineEn: "Turn a description into a clean, vibrant anime portrait.",
    taglineAr: "حوّل وصف لبورتريه أنمي نظيف وحيوي.",
    descEn: "Generate a crisp anime-style portrait with clean line art and vibrant shading. Perfect for profile pictures and character art.",
    descAr: "ولّد بورتريه بأسلوب الأنمي بخطوط نظيفة وتظليل حيوي. مثالي لصور البروفايل وفن الشخصيات.",
    promptHintEn: "Describe the person and mood (e.g. calm warrior, blue hair).",
    promptHintAr: "اوصف الشخص والمزاج (مثلًا محارب هادئ، شعر أزرق).",
  },
  {
    slug: "watercolor-art", type: "image", model: "wan2.7-image-pro", aspect: "4:3", category: "style",
    prompt: "Delicate watercolor painting, soft washes of color, paper texture, loose brush strokes, artistic:",
    nameEn: "Watercolor painting", nameAr: "لوحة ألوان مائية",
    taglineEn: "Paint any scene as a soft watercolor artwork.",
    taglineAr: "ارسم أي مشهد كلوحة ألوان مائية ناعمة.",
    descEn: "Create soft, artistic watercolor paintings with gentle color washes and paper texture. Lovely for cards, prints and gentle illustrations.",
    descAr: "اعمل لوحات ألوان مائية فنية ناعمة بتدرّجات لونية لطيفة وملمس ورقي. جميلة للكروت والمطبوعات والرسومات الهادئة.",
    promptHintEn: "Describe the subject (e.g. a quiet street in the rain).",
    promptHintAr: "اوصف الموضوع (مثلًا شارع هادئ تحت المطر).",
  },
  {
    slug: "cyberpunk-neon", type: "image", model: "gpt-image-2", aspect: "16:9", category: "style",
    prompt: "Cyberpunk neon city scene, glowing signs, rain-slick streets, cinematic moody lighting, ultra detailed:",
    nameEn: "Cyberpunk neon", nameAr: "سايبربانك نيون",
    taglineEn: "Generate moody, neon-lit cyberpunk scenes.",
    taglineAr: "ولّد مشاهد سايبربانك بإضاءة نيون غامرة.",
    descEn: "Create cinematic cyberpunk scenes with glowing neon, rain-slick streets and moody lighting. Great for wallpapers and concept art.",
    descAr: "اعمل مشاهد سايبربانك سينمائية بإضاءة نيون متوهّجة وشوارع مبلّلة وإضاءة غامرة. ممتاز للخلفيات والفن المفاهيمي.",
    promptHintEn: "Describe the scene (e.g. a lone figure under neon signs).",
    promptHintAr: "اوصف المشهد (مثلًا شخص وحيد تحت لافتات النيون).",
  },
  // ── Work & business (image) ──────────────────────────────────────────────
  {
    slug: "professional-headshot", type: "image", model: "gpt-image-2", aspect: "3:4", category: "practical",
    prompt: "Professional corporate headshot, soft studio lighting, neutral background, sharp focus, business attire, photorealistic:",
    nameEn: "Professional headshot", nameAr: "صورة شخصية احترافية",
    taglineEn: "Generate a clean, professional headshot for your profile.",
    taglineAr: "ولّد صورة شخصية احترافية نظيفة لبروفايلك.",
    descEn: "Create a polished, photoreal corporate headshot with studio lighting and a neutral background. Ideal for LinkedIn, resumes and team pages.",
    descAr: "اعمل صورة شخصية احترافية واقعية بإضاءة استوديو وخلفية محايدة. مثالية لـ LinkedIn والسير الذاتية وصفحات الفريق.",
    promptHintEn: "Describe the person and style (e.g. man, navy suit, smiling).",
    promptHintAr: "اوصف الشخص والستايل (مثلًا رجل ببدلة كحلي مبتسم).",
  },
  {
    slug: "product-photo", type: "image", model: "gpt-image-2", aspect: "1:1", category: "practical",
    prompt: "Professional e-commerce product photo on a clean white background, soft even lighting, sharp focus, studio quality:",
    nameEn: "Product photo", nameAr: "صورة منتج",
    taglineEn: "Studio-quality product photos for your store.",
    taglineAr: "صور منتجات بجودة استوديو لمتجرك.",
    descEn: "Generate clean, studio-quality product photos on a white background, ready for your online store or ads. Describe the product and get a sharp, well-lit shot.",
    descAr: "ولّد صور منتجات نظيفة بجودة استوديو على خلفية بيضاء، جاهزة لمتجرك أو إعلاناتك. اوصف المنتج وهتطلع لقطة واضحة بإضاءة كويسة.",
    promptHintEn: "Describe the product (e.g. a glass perfume bottle).",
    promptHintAr: "اوصف المنتج (مثلًا زجاجة عطر شفافة).",
  },
  {
    slug: "logo-design", type: "image", model: "gpt-image-2", aspect: "1:1", category: "practical",
    prompt: "Minimalist modern logo, clean vector style, simple shapes, flat colors, professional brand mark, white background:",
    nameEn: "Logo design", nameAr: "تصميم شعار",
    taglineEn: "Generate clean, modern logo concepts in seconds.",
    taglineAr: "ولّد أفكار شعارات نظيفة وعصرية في ثوانٍ.",
    descEn: "Create minimalist, modern logo concepts to kick off your brand. Describe your business and get clean mark ideas to explore.",
    descAr: "اعمل أفكار شعارات بسيطة وعصرية تبدأ بيها هوية علامتك. اوصف نشاطك وهتطلع أفكار نظيفة تختار منها.",
    promptHintEn: "Describe the brand (e.g. a coffee shop named Najm).",
    promptHintAr: "اوصف العلامة (مثلًا محل قهوة اسمه نجم).",
  },
  {
    slug: "social-media-post", type: "image", model: "qwen-image-2.0-pro", aspect: "1:1", category: "practical",
    prompt: "Eye-catching social media post graphic, bold modern layout, vibrant colors, clear focal point, space for text:",
    nameEn: "Social media post", nameAr: "تصميم بوست سوشيال",
    taglineEn: "Create scroll-stopping social posts fast.",
    taglineAr: "اعمل بوستات سوشيال تلفت النظر بسرعة.",
    descEn: "Generate bold, modern graphics for Instagram, Facebook and X. Describe your message and get a vibrant, ready-to-post visual.",
    descAr: "ولّد تصاميم جريئة وعصرية لإنستجرام وفيسبوك و X. اوصف رسالتك وهتطلع صورة حيوية جاهزة للنشر.",
    promptHintEn: "Describe the post (e.g. a summer sale announcement).",
    promptHintAr: "اوصف البوست (مثلًا إعلان تخفيضات الصيف).",
  },
  {
    slug: "youtube-thumbnail", type: "image", model: "gpt-image-2", aspect: "16:9", category: "practical",
    prompt: "Bold high-contrast YouTube thumbnail, dramatic lighting, clear focal subject, vivid colors, space for big title text:",
    nameEn: "YouTube thumbnail", nameAr: "صورة مصغّرة ليوتيوب",
    taglineEn: "Generate click-worthy YouTube thumbnails.",
    taglineAr: "ولّد صور مصغّرة ليوتيوب تجذب الضغط.",
    descEn: "Create bold, high-contrast thumbnails designed to earn clicks, with room for your title text. Describe the video topic and get a striking thumbnail.",
    descAr: "اعمل صور مصغّرة جريئة عالية التباين مصمّمة تجذب الضغط، مع مساحة لعنوانك. اوصف موضوع الفيديو وهتطلع صورة لافتة.",
    promptHintEn: "Describe the video (e.g. a tech review, surprised face).",
    promptHintAr: "اوصف الفيديو (مثلًا مراجعة تقنية، وش متفاجئ).",
  },
  // ── Arabic & MENA (image) — the edge ─────────────────────────────────────
  {
    slug: "arabic-calligraphy", type: "image", model: "qwen-image-2.0-pro", aspect: "1:1", category: "arabic",
    prompt: "Elegant Arabic calligraphy artwork, beautiful Thuluth script, gold and deep colors, ornate decorative background, museum quality:",
    nameEn: "Arabic calligraphy art", nameAr: "فن الخط العربي",
    taglineEn: "Generate elegant Arabic calligraphy artwork.",
    taglineAr: "ولّد لوحات خط عربي أنيقة.",
    descEn: "Create beautiful Arabic calligraphy art with ornate, museum-quality detail. Powered by a model that renders Arabic text well, so your words come out crisp.",
    descAr: "اعمل لوحات خط عربي جميلة بتفاصيل زخرفية بجودة عالية. مدعوم بنموذج بيكتب النص العربي كويس، فكلماتك بتطلع واضحة.",
    promptHintEn: "Type the Arabic word or phrase you want written.",
    promptHintAr: "اكتب الكلمة أو العبارة العربية اللي عايزها.",
  },
  {
    slug: "ramadan-greeting", type: "image", model: "qwen-image-2.0-pro", aspect: "1:1", category: "arabic",
    prompt: "Beautiful Ramadan greeting card, crescent moon and lanterns, elegant Arabic calligraphy reading رمضان كريم, warm gold and night-blue colors:",
    nameEn: "Ramadan greeting card", nameAr: "بطاقة تهنئة رمضان",
    taglineEn: "Design warm Ramadan greeting cards with Arabic text.",
    taglineAr: "صمّم بطاقات تهنئة رمضان دافئة بنص عربي.",
    descEn: "Generate elegant Ramadan greeting cards with crescents, lanterns and Arabic calligraphy. Ready to share with family, friends or customers.",
    descAr: "ولّد بطاقات تهنئة رمضان أنيقة بالأهلّة والفوانيس والخط العربي. جاهزة تشاركها مع الأهل والأصحاب أو العملاء.",
    promptHintEn: "Add a name or extra wish to personalize it.",
    promptHintAr: "ضيف اسم أو دعوة إضافية عشان تخصّصها.",
  },
  {
    slug: "eid-card", type: "image", model: "qwen-image-2.0-pro", aspect: "1:1", category: "arabic",
    prompt: "Festive Eid greeting card, elegant Arabic calligraphy reading عيد مبارك, crescent moon, lanterns, gold and green colors, decorative:",
    nameEn: "Eid greeting card", nameAr: "بطاقة تهنئة العيد",
    taglineEn: "Create festive Eid cards with Arabic calligraphy.",
    taglineAr: "اعمل بطاقات عيد احتفالية بالخط العربي.",
    descEn: "Generate festive Eid greeting cards with Arabic calligraphy and traditional motifs, ready to send or post.",
    descAr: "ولّد بطاقات تهنئة عيد احتفالية بالخط العربي والزخارف التقليدية، جاهزة للإرسال أو النشر.",
    promptHintEn: "Add a name or wish to personalize the card.",
    promptHintAr: "ضيف اسم أو تهنئة عشان تخصّص البطاقة.",
  },
  {
    slug: "arabic-poster", type: "image", model: "qwen-image-2.0-pro", aspect: "3:4", category: "arabic",
    prompt: "Modern Arabic advertising poster, bold Arabic typography, clean professional layout, vibrant brand colors, space for a headline:",
    nameEn: "Arabic poster", nameAr: "بوستر عربي",
    taglineEn: "Design modern posters with bold Arabic type.",
    taglineAr: "صمّم بوسترات عصرية بخط عربي جريء.",
    descEn: "Create modern advertising posters with bold Arabic typography and a clean layout, perfect for events, offers and announcements.",
    descAr: "اعمل بوسترات إعلانية عصرية بخط عربي جريء وتصميم نظيف، مثالية للفعاليات والعروض والإعلانات.",
    promptHintEn: "Describe the offer or event and the Arabic headline.",
    promptHintAr: "اوصف العرض أو الفعالية والعنوان العربي.",
  },
  // ── Video (text-to-video) ────────────────────────────────────────────────
  {
    slug: "cinematic-broll", type: "video", model: "happy-horse-1.0", aspect: "16:9", category: "video",
    prompt: "Cinematic b-roll clip, smooth camera motion, shallow depth of field, film-grade color grading, atmospheric:",
    nameEn: "Cinematic b-roll", nameAr: "لقطات سينمائية (B-roll)",
    taglineEn: "Generate short cinematic b-roll clips from text.",
    taglineAr: "ولّد لقطات سينمائية قصيرة من النص.",
    descEn: "Create short, cinematic b-roll clips with smooth motion and film-grade color, straight from a text prompt. Great filler footage for videos and reels.",
    descAr: "اعمل لقطات سينمائية قصيرة بحركة ناعمة وألوان احترافية، من مجرد وصف نصّي. لقطات ممتازة لملء الفيديوهات والريلز.",
    promptHintEn: "Describe the shot (e.g. coffee being poured, slow motion).",
    promptHintAr: "اوصف اللقطة (مثلًا صبّ قهوة، حركة بطيئة).",
  },
  {
    slug: "product-ad-video", type: "video", model: "happy-horse-1.0", aspect: "9:16", category: "video",
    prompt: "Short vertical product ad video clip, dynamic motion, bright clean lighting, modern commercial style, eye-catching:",
    nameEn: "Product ad video", nameAr: "فيديو إعلان منتج",
    taglineEn: "Make short vertical product ad clips for social.",
    taglineAr: "اعمل مقاطع إعلان منتج عمودية للسوشيال.",
    descEn: "Generate short, vertical product ad clips with dynamic motion, ready for TikTok, Reels and Shorts. Describe the product and the vibe.",
    descAr: "ولّد مقاطع إعلان منتج قصيرة وعمودية بحركة ديناميكية، جاهزة لتيك توك والريلز والشورتس. اوصف المنتج والإحساس.",
    promptHintEn: "Describe the product and mood (e.g. energetic sneaker ad).",
    promptHintAr: "اوصف المنتج والمزاج (مثلًا إعلان حذاء رياضي حماسي).",
  },
  {
    slug: "logo-animation", type: "video", model: "happy-horse-1.0", aspect: "16:9", category: "video",
    prompt: "Clean animated logo intro, smooth reveal motion, modern minimal style, subtle glow, professional brand animation:",
    nameEn: "Logo animation", nameAr: "أنميشن شعار",
    taglineEn: "Turn a logo idea into a clean animated intro.",
    taglineAr: "حوّل فكرة شعار لأنميشن افتتاحي نظيف.",
    descEn: "Create a clean, modern animated logo intro with a smooth reveal, great for video openers and channel intros.",
    descAr: "اعمل أنميشن افتتاحي نظيف وعصري لشعارك بحركة كشف ناعمة، ممتاز لبدايات الفيديوهات ومقدمات القنوات.",
    promptHintEn: "Describe the brand and style (e.g. tech logo, blue glow).",
    promptHintAr: "اوصف العلامة والستايل (مثلًا شعار تقني، توهّج أزرق).",
  },
];

export function getEffect(slug: string): EffectEntry | undefined {
  return EFFECTS.find((e) => e.slug === slug);
}

export function effectsByCategory(cat: EffectEntry["category"]): EffectEntry[] {
  return EFFECTS.filter((e) => e.category === cat);
}

export const EFFECT_CATEGORIES: EffectEntry["category"][] = ["arabic", "style", "practical", "video"];

// Deep-link into the media composer with this effect's preset pre-filled.
// FeatureChat reads ?prompt, ?model and ?aspect from the URL on mount.
export function effectHref(e: EffectEntry, locale: "en" | "ar" = "en"): string {
  const feature = e.type === "video" ? "video" : "image";
  const qs = new URLSearchParams({ prompt: e.prompt + " ", model: e.model, aspect: e.aspect });
  const base = locale === "ar" ? `/features/${feature}` : `/features/${feature}`;
  return `${base}?${qs.toString()}`;
}
