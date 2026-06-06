// Marketing catalog for the public per-model landing pages (/models + /models/[slug]).
//
// This is the programmatic-SEO surface: one templated landing page per model
// Pervagans offers, each targeting the long-tail searches around that model
// ("<model> online", "<model> free", "<model> alternative"). Grounded in the
// real model registry (app/lib/models.ts) — every entry here is a model the
// product actually serves. Copy is bilingual (EN + AR) so the same data can
// drive an Arabic locale variant next.

export type ModelType = "chat" | "image" | "video";
export type PlanTier = "free" | "plus" | "pro" | "max";

export type ModelEntry = {
  slug: string;        // URL segment, e.g. "claude-opus-4-8"
  id: string;          // real model id from app/lib/models.ts
  name: string;
  maker: string;       // company behind the model
  type: ModelType;
  plan: PlanTier;      // lowest Pervagans plan that unlocks it
  taglineEn: string;
  taglineAr: string;
  introEn: string;
  introAr: string;
  bestForEn: string[];
  bestForAr: string[];
  highlightsEn: string[];
  highlightsAr: string[];
};

const PLAN_LABEL: Record<PlanTier, { en: string; ar: string }> = {
  free: { en: "Free & up", ar: "مجانًا فأعلى" },
  plus: { en: "Plus & up", ar: "Plus فأعلى" },
  pro: { en: "Pro & up", ar: "Pro فأعلى" },
  max: { en: "Max", ar: "Max" },
};

export function planLabel(plan: PlanTier, locale: "en" | "ar" = "en"): string {
  return PLAN_LABEL[plan][locale];
}

export const TYPE_LABEL: Record<ModelType, { en: string; ar: string }> = {
  chat: { en: "Text model", ar: "نموذج نصّي" },
  image: { en: "Image model", ar: "نموذج صور" },
  video: { en: "Video model", ar: "نموذج فيديو" },
};

export const MODELS: ModelEntry[] = [
  // ── Text ───────────────────────────────────────────────────────────────
  {
    slug: "claude-opus-4-8", id: "opus-4.8", name: "Claude Opus 4.8", maker: "Anthropic",
    type: "chat", plan: "max",
    taglineEn: "Frontier reasoning for the hardest problems.",
    taglineAr: "استدلال متقدّم لأصعب المسائل.",
    introEn: "Claude Opus 4.8 is Anthropic's most capable model, built for deep reasoning, long-form writing, complex coding and analysis that needs to be right. In Pervagans you can use Opus 4.8 inside any chat, Space or agent run, and switch to a faster model the moment you do not need that much horsepower.",
    introAr: "Claude Opus 4.8 هو أقوى نماذج Anthropic، مصمّم للاستدلال العميق والكتابة الطويلة والبرمجة المعقّدة والتحليل اللي لازم يكون مظبوط. في Pervagans تقدر تستخدم Opus 4.8 في أي شات أو Space أو تشغيل agent، وتبدّل لموديل أسرع وقت ما متحتاجش كل القوة دي.",
    bestForEn: ["Hard reasoning and multi-step analysis", "Long, structured documents", "Complex coding and refactors", "Agent runs that must not slip"],
    bestForAr: ["الاستدلال الصعب والتحليل متعدّد الخطوات", "المستندات الطويلة المنظّمة", "البرمجة المعقّدة وإعادة الهيكلة", "تشغيلات الـ agent اللي مش مسموح فيها بأخطاء"],
    highlightsEn: ["Top-tier reasoning quality", "Excellent at following detailed instructions", "Strong long-context comprehension"],
    highlightsAr: ["جودة استدلال من الطراز الأول", "ممتاز في اتّباع التعليمات التفصيلية", "فهم قوي للسياق الطويل"],
  },
  {
    slug: "claude-sonnet-4-6", id: "sonnet-4.6", name: "Claude Sonnet 4.6", maker: "Anthropic",
    type: "chat", plan: "pro",
    taglineEn: "The fast, balanced workhorse for daily work.",
    taglineAr: "الحصان السريع المتوازن للشغل اليومي.",
    introEn: "Claude Sonnet 4.6 pairs near-frontier quality with the speed you want for everyday work: drafting, editing, coding help, research and chat. It is the model most people leave selected by default, stepping up to Opus only for the truly hard tasks.",
    introAr: "Claude Sonnet 4.6 بيجمع بين جودة قريبة من المتقدّمة والسرعة اللي محتاجها للشغل اليومي: الصياغة، التحرير، المساعدة في الكود، البحث والمحادثة. ده الموديل اللي معظم الناس بتسيبه مختار افتراضيًا، وتطلع لـ Opus بس في المهام الصعبة فعلًا.",
    bestForEn: ["Everyday chat and drafting", "Fast coding assistance", "Summaries and rewrites", "High-volume work where speed matters"],
    bestForAr: ["المحادثة والصياغة اليومية", "مساعدة سريعة في الكود", "التلخيص وإعادة الصياغة", "الشغل الكثيف اللي السرعة فيه مهمة"],
    highlightsEn: ["Fast responses", "Great quality-to-speed balance", "Reliable instruction following"],
    highlightsAr: ["ردود سريعة", "توازن ممتاز بين الجودة والسرعة", "اتّباع موثوق للتعليمات"],
  },
  {
    slug: "gpt-5-5", id: "gpt-5.5", name: "GPT 5.5", maker: "OpenAI",
    type: "chat", plan: "max",
    taglineEn: "OpenAI's flagship for vision, tools and reasoning.",
    taglineAr: "نموذج OpenAI الرائد للرؤية والأدوات والاستدلال.",
    introEn: "GPT 5.5 is OpenAI's most advanced model, strong across reasoning, vision and tool use. Use it in Pervagans for tasks that lean on images, function calling and broad world knowledge, all on the same shared credit balance as every other model.",
    introAr: "GPT 5.5 هو أكثر نماذج OpenAI تقدّمًا، قوي في الاستدلال والرؤية واستخدام الأدوات. استخدمه في Pervagans للمهام اللي بتعتمد على الصور واستدعاء الدوال والمعرفة الواسعة، كله على نفس رصيد الـ credits المشترك زي باقي الموديلات.",
    bestForEn: ["Image understanding (vision)", "Tool and function calling", "General reasoning and writing", "Broad knowledge questions"],
    bestForAr: ["فهم الصور (الرؤية)", "استدعاء الأدوات والدوال", "الاستدلال والكتابة العامة", "أسئلة المعرفة الواسعة"],
    highlightsEn: ["Strong multimodal vision", "Robust tool use", "Versatile across tasks"],
    highlightsAr: ["رؤية متعددة الوسائط قوية", "استخدام متين للأدوات", "متعدّد الاستخدامات عبر المهام"],
  },
  {
    slug: "gpt-5-4", id: "gpt-5.4", name: "GPT 5.4", maker: "OpenAI",
    type: "chat", plan: "pro",
    taglineEn: "Capable vision and tools at a lighter cost.",
    taglineAr: "رؤية وأدوات قوية بتكلفة أخف.",
    introEn: "GPT 5.4 brings most of the GPT line's strengths in vision and tool use at a lower cost per run, making it a great default when you want OpenAI quality without reaching for the flagship. Available in Pervagans on Pro and above.",
    introAr: "GPT 5.4 بيقدّم معظم مزايا سلسلة GPT في الرؤية والأدوات بتكلفة أقل لكل تشغيل، فبيبقى اختيار افتراضي ممتاز لما تعوز جودة OpenAI من غير ما تروح للنموذج الرائد. متاح في Pervagans على Pro فأعلى.",
    bestForEn: ["Vision tasks on a budget", "Tool-using chats and agents", "Everyday OpenAI-quality work"],
    bestForAr: ["مهام الرؤية باقتصاد", "محادثات و agents بتستخدم الأدوات", "شغل يومي بجودة OpenAI"],
    highlightsEn: ["Good vision and tools", "Lower cost per run", "Solid all-rounder"],
    highlightsAr: ["رؤية وأدوات جيدة", "تكلفة أقل لكل تشغيل", "متوازن وقوي"],
  },
  {
    slug: "gemini-3-1-pro", id: "gemini-pro-3.1", name: "Gemini Pro 3.1", maker: "Google",
    type: "chat", plan: "plus",
    taglineEn: "Huge context windows and strong multimodality.",
    taglineAr: "نوافذ سياق ضخمة وقدرات متعددة الوسائط قوية.",
    introEn: "Gemini Pro 3.1 from Google shines when you need to reason over a lot of material at once: long documents, large codebases and mixed media. Pair it with Pervagans Spaces to keep all that context grounded across a project.",
    introAr: "Gemini Pro 3.1 من Google بيتألّق لما تحتاج تستوعب كمية كبيرة من المحتوى مرة واحدة: مستندات طويلة، قواعد كود كبيرة ووسائط مختلطة. استخدمه مع Spaces في Pervagans عشان تحافظ على كل السياق ده مرتبط عبر المشروع.",
    bestForEn: ["Very long documents", "Large codebases", "Mixed text and image input", "Research over big sources"],
    bestForAr: ["المستندات الطويلة جدًا", "قواعد الكود الكبيرة", "مدخلات نص وصور مختلطة", "البحث في مصادر كبيرة"],
    highlightsEn: ["Long context window", "Strong multimodal input", "Good for research"],
    highlightsAr: ["نافذة سياق طويلة", "مدخلات متعددة الوسائط قوية", "ممتاز للبحث"],
  },
  {
    slug: "deepseek-v4-pro", id: "deepseek-v4-pro", name: "DeepSeek V4 Pro", maker: "DeepSeek",
    type: "chat", plan: "free",
    taglineEn: "Open-weight power for code and reasoning, free to start.",
    taglineAr: "قوة مفتوحة الأوزان للكود والاستدلال، تبدأ بها مجانًا.",
    introEn: "DeepSeek V4 Pro is a strong, cost-efficient model for coding and reasoning, and it is part of the Pervagans Free plan, so anyone can start with serious capability at no cost. It is the default model for logged-out visitors trying Pervagans.",
    introAr: "DeepSeek V4 Pro موديل قوي واقتصادي للبرمجة والاستدلال، وهو جزء من خطة Pervagans المجانية، فأي حد يقدر يبدأ بقدرة جادة من غير تكلفة. وهو الموديل الافتراضي للزوار اللي بيجرّبوا Pervagans قبل تسجيل الدخول.",
    bestForEn: ["Coding and debugging", "Step-by-step reasoning", "Trying Pervagans for free", "High-volume everyday tasks"],
    bestForAr: ["البرمجة وتصحيح الأخطاء", "الاستدلال خطوة بخطوة", "تجربة Pervagans مجانًا", "المهام اليومية الكثيفة"],
    highlightsEn: ["Strong at code", "Very cost-efficient", "Included free"],
    highlightsAr: ["قوي في الكود", "اقتصادي جدًا", "متاح مجانًا"],
  },
  {
    slug: "glm-5-1", id: "glm-5.1", name: "GLM 5.1", maker: "Zhipu AI",
    type: "chat", plan: "free",
    taglineEn: "A capable agentic model, strong in Chinese and English.",
    taglineAr: "نموذج وكيل قوي، متميّز في الصينية والإنجليزية.",
    introEn: "GLM 5.1 from Zhipu AI is a well-rounded model with strong agentic and bilingual abilities. It is part of the Pervagans Free plan and works well for tool-using chats and everyday tasks.",
    introAr: "GLM 5.1 من Zhipu AI نموذج متكامل بقدرات قوية كـ agent وثنائي اللغة. هو جزء من خطة Pervagans المجانية ويشتغل كويس في المحادثات اللي بتستخدم الأدوات والمهام اليومية.",
    bestForEn: ["Agentic, tool-using tasks", "Chinese and English work", "Everyday chat", "Free-tier usage"],
    bestForAr: ["المهام الوكيلة اللي بتستخدم الأدوات", "الشغل بالصينية والإنجليزية", "المحادثة اليومية", "الاستخدام في الخطة المجانية"],
    highlightsEn: ["Good agent behavior", "Bilingual strength", "Included free"],
    highlightsAr: ["سلوك وكيل جيد", "قوة ثنائية اللغة", "متاح مجانًا"],
  },
  {
    slug: "qwen-3-7-max", id: "qwen-3.7-max", name: "Qwen 3.7 Max", maker: "Alibaba",
    type: "chat", plan: "free",
    taglineEn: "Multilingual model with real strength in Arabic.",
    taglineAr: "نموذج متعدد اللغات بقوة حقيقية في العربية.",
    introEn: "Qwen 3.7 Max from Alibaba is a strong multilingual model and a natural fit for Arabic and English work. It is included in the Pervagans Free plan, which makes it an easy starting point for bilingual users.",
    introAr: "Qwen 3.7 Max من Alibaba نموذج قوي متعدد اللغات وملائم طبيعيًا للشغل بالعربية والإنجليزية. هو ضمن خطة Pervagans المجانية، وده بيخلّيه نقطة بداية سهلة للمستخدمين ثنائيي اللغة.",
    bestForEn: ["Arabic and bilingual tasks", "Multilingual translation", "Everyday chat", "Free-tier usage"],
    bestForAr: ["المهام العربية وثنائية اللغة", "الترجمة متعددة اللغات", "المحادثة اليومية", "الاستخدام في الخطة المجانية"],
    highlightsEn: ["Strong Arabic support", "Broad language coverage", "Included free"],
    highlightsAr: ["دعم عربي قوي", "تغطية لغوية واسعة", "متاح مجانًا"],
  },
  // ── Image ──────────────────────────────────────────────────────────────
  {
    slug: "gpt-image-2", id: "gpt-image-2", name: "GPT Image 2", maker: "OpenAI",
    type: "image", plan: "pro",
    taglineEn: "Photoreal image generation and editing.",
    taglineAr: "توليد وتعديل صور واقعية.",
    introEn: "GPT Image 2 generates photoreal images and follows detailed prompts closely, including editing existing images. In Pervagans you generate from the same workspace as your chat, with aspect, seed and negative-prompt controls and a saved Gallery.",
    introAr: "GPT Image 2 بيولّد صور واقعية وبيتّبع الـ prompts التفصيلية بدقة، وكمان بيعدّل الصور الموجودة. في Pervagans بتولّد من نفس مساحة العمل بتاعة الشات، مع تحكّم في الأبعاد والـ seed والـ negative prompt ومعرض محفوظ.",
    bestForEn: ["Photoreal images", "Editing existing images", "Precise prompt following", "Marketing and product visuals"],
    bestForAr: ["الصور الواقعية", "تعديل الصور الموجودة", "اتّباع دقيق للـ prompt", "صور التسويق والمنتجات"],
    highlightsEn: ["Photorealism", "Image editing", "Strong prompt adherence"],
    highlightsAr: ["واقعية عالية", "تعديل الصور", "التزام قوي بالـ prompt"],
  },
  {
    slug: "qwen-image-2-0", id: "qwen-image-2.0-pro", name: "Qwen Image 2.0 Pro", maker: "Alibaba",
    type: "image", plan: "plus",
    taglineEn: "Versatile image generation, strong with text in images.",
    taglineAr: "توليد صور متعدد الاستخدامات، قوي في كتابة النصوص داخل الصور.",
    introEn: "Qwen Image 2.0 Pro is a versatile image model that handles design, photography styles and text rendering well, which is especially useful for Arabic and English text in visuals. Available in Pervagans from the Plus plan.",
    introAr: "Qwen Image 2.0 Pro نموذج صور متعدد الاستخدامات بيتعامل كويس مع التصميم وأنماط التصوير وكتابة النصوص داخل الصور، وده مفيد خصوصًا للنص العربي والإنجليزي في التصاميم. متاح في Pervagans من خطة Plus.",
    bestForEn: ["Design and graphics", "Text inside images (incl. Arabic)", "Varied photo styles", "Social and marketing visuals"],
    bestForAr: ["التصميم والجرافيك", "النص داخل الصور (شامل العربي)", "أنماط تصوير متنوعة", "صور السوشيال والتسويق"],
    highlightsEn: ["Good text rendering", "Design flexibility", "Plus-tier value"],
    highlightsAr: ["كتابة نصوص جيدة", "مرونة في التصميم", "قيمة في خطة Plus"],
  },
  {
    slug: "wan-2-7-image", id: "wan2.7-image-pro", name: "Wan 2.7 Image Pro", maker: "Alibaba",
    type: "image", plan: "plus",
    taglineEn: "Fast, clean image generation.",
    taglineAr: "توليد صور سريع ونظيف.",
    introEn: "Wan 2.7 Image Pro is built for fast, clean image generation, a good pick when you want results quickly. It is available in Pervagans from the Plus plan and shares the same Gallery and controls as the other image models.",
    introAr: "Wan 2.7 Image Pro مصمّم لتوليد صور سريع ونظيف، اختيار كويس لما تعوز نتائج بسرعة. متاح في Pervagans من خطة Plus وبيشارك نفس المعرض والتحكّمات مع باقي نماذج الصور.",
    bestForEn: ["Quick image drafts", "Iterating on ideas fast", "High-volume image needs"],
    bestForAr: ["مسوّدات صور سريعة", "التكرار على الأفكار بسرعة", "احتياجات الصور الكثيفة"],
    highlightsEn: ["Fast generation", "Clean output", "Plus-tier value"],
    highlightsAr: ["توليد سريع", "مخرجات نظيفة", "قيمة في خطة Plus"],
  },
  // ── Video ──────────────────────────────────────────────────────────────
  {
    slug: "happy-horse", id: "happy-horse-1.0", name: "Happy Horse 1.0", maker: "Alibaba",
    type: "video", plan: "pro",
    taglineEn: "Turn text prompts into short video clips.",
    taglineAr: "حوّل أوامر النص إلى مقاطع فيديو قصيرة.",
    introEn: "Happy Horse 1.0 generates short video clips from text prompts, right inside the Pervagans workspace. Generate, save to your Gallery and reuse, with the same shared credits as every other model. Available from the Pro plan.",
    introAr: "Happy Horse 1.0 بيولّد مقاطع فيديو قصيرة من أوامر النص، جوّه مساحة عمل Pervagans مباشرة. ولّد، احفظ في معرضك وأعد الاستخدام، بنفس الـ credits المشتركة زي أي موديل تاني. متاح من خطة Pro.",
    bestForEn: ["Text-to-video clips", "Social and ad content", "Quick video ideas", "Storyboards and concepts"],
    bestForAr: ["مقاطع نص-إلى-فيديو", "محتوى السوشيال والإعلانات", "أفكار فيديو سريعة", "القصص المصوّرة والتصورات"],
    highlightsEn: ["Text-to-video", "In-workspace generation", "Saved Gallery"],
    highlightsAr: ["نص إلى فيديو", "توليد داخل مساحة العمل", "معرض محفوظ"],
  },
];

export function getModel(slug: string): ModelEntry | undefined {
  return MODELS.find((m) => m.slug === slug);
}

export function modelsByType(type: ModelType): ModelEntry[] {
  return MODELS.filter((m) => m.type === type);
}
