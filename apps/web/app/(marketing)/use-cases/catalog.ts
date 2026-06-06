// Catalog for the per-use-case landing pages (/use-cases/[slug] + AR).
//
// Each entry is an audience/vertical Pervagans serves. Drives a templated,
// crawlable landing page that targets "AI for <use case>" searches and funnels
// into the product. Bilingual (EN + AR) so it powers the /ar variant too.

export type UseCaseEntry = {
  slug: string;
  nameEn: string;
  nameAr: string;
  taglineEn: string;
  taglineAr: string;
  introEn: string;
  introAr: string;
  jobsEn: string[];   // concrete things this audience does in Pervagans
  jobsAr: string[];
  featuresEn: string[]; // Pervagans capabilities that matter most here
  featuresAr: string[];
};

export const USE_CASES: UseCaseEntry[] = [
  {
    slug: "marketing",
    nameEn: "Marketing teams", nameAr: "فرق التسويق",
    taglineEn: "Campaigns, copy and creative in one workspace.",
    taglineAr: "حملات ونصوص وتصاميم في مساحة عمل واحدة.",
    introEn: "Plan campaigns, write copy and generate on-brand visuals without juggling five tools. Pervagans puts the best AI models, image and video generation, and your own connectors in one bilingual workspace, so marketing work moves from idea to asset in one place.",
    introAr: "خطّط الحملات واكتب النصوص وولّد تصاميم متوافقة مع هويتك من غير ما تنقّل بين خمس أدوات. Pervagans بيحطّ أفضل النماذج وتوليد الصور والفيديو وموصّلاتك في مساحة عمل واحدة ثنائية اللغة، فشغل التسويق بيتحرّك من الفكرة للأصل في مكان واحد.",
    jobsEn: ["Write ad copy, emails and landing pages", "Generate on-brand images and short video ads", "Brainstorm campaign angles with multiple models", "Repurpose one piece into many channels"],
    jobsAr: ["كتابة نصوص الإعلانات والإيميلات وصفحات الهبوط", "توليد صور وفيديوهات إعلانية متوافقة مع الهوية", "العصف الذهني لزوايا الحملات بأكثر من نموذج", "إعادة استخدام محتوى واحد في قنوات كثيرة"],
    featuresEn: ["Multi-model chat", "Image & video generation", "Spaces for each campaign", "Connectors to your tools"],
    featuresAr: ["محادثة متعددة النماذج", "توليد الصور والفيديو", "Spaces لكل حملة", "موصّلات لأدواتك"],
  },
  {
    slug: "social-media",
    nameEn: "Social media creators", nameAr: "صنّاع محتوى السوشيال",
    taglineEn: "Post ideas, captions and visuals, fast.",
    taglineAr: "أفكار بوستات وكابشنز وتصاميم، بسرعة.",
    introEn: "Keep your feed full without burning out. Generate post ideas, captions and hashtags, then create matching images and short vertical clips, all in one bilingual workspace built for English and Arabic audiences.",
    introAr: "خلّي فيدك مليان من غير ما تتعب. ولّد أفكار بوستات وكابشنز وهاشتاجات، وبعدين اعمل صور ومقاطع عمودية قصيرة مناسبة، كله في مساحة عمل واحدة ثنائية اللغة مبنية للجمهور العربي والإنجليزي.",
    jobsEn: ["Generate captions and hashtags in EN or AR", "Create images and vertical video clips", "Plan a week of content in minutes", "Adapt one idea for every platform"],
    jobsAr: ["توليد كابشنز وهاشتاجات بالعربي أو الإنجليزي", "إنشاء صور ومقاطع فيديو عمودية", "تخطيط أسبوع محتوى في دقائق", "تكييف فكرة واحدة لكل منصة"],
    featuresEn: ["Image & video generation", "Bilingual EN / AR captions", "Effects presets", "Saved Gallery"],
    featuresAr: ["توليد الصور والفيديو", "كابشنز ثنائية اللغة", "قوالب Effects جاهزة", "معرض محفوظ"],
  },
  {
    slug: "ecommerce",
    nameEn: "E-commerce & online stores", nameAr: "التجارة الإلكترونية والمتاجر",
    taglineEn: "Product photos, descriptions and ads on demand.",
    taglineAr: "صور منتجات وأوصاف وإعلانات عند الطلب.",
    introEn: "Turn a product into a full listing: clean product photos, persuasive descriptions and short ad clips, in both Arabic and English. One workspace replaces a photo studio, a copywriter and a video editor.",
    introAr: "حوّل المنتج لقائمة كاملة: صور منتج نظيفة وأوصاف مقنعة ومقاطع إعلانية قصيرة، بالعربي والإنجليزي. مساحة عمل واحدة بتغني عن استوديو تصوير وكاتب محتوى ومونتير فيديو.",
    jobsEn: ["Generate clean product photos", "Write product descriptions that convert", "Create short product ad videos", "Translate listings between Arabic and English"],
    jobsAr: ["توليد صور منتجات نظيفة", "كتابة أوصاف منتجات تبيع", "إنشاء فيديوهات إعلان منتج قصيرة", "ترجمة القوائم بين العربي والإنجليزي"],
    featuresEn: ["Product photo presets", "Multi-model copywriting", "Short video ads", "Bilingual listings"],
    featuresAr: ["قوالب صور المنتجات", "كتابة بأكثر من نموذج", "إعلانات فيديو قصيرة", "قوائم ثنائية اللغة"],
  },
  {
    slug: "education",
    nameEn: "Teachers & education", nameAr: "المعلّمون والتعليم",
    taglineEn: "Lessons, materials and explanations in any language.",
    taglineAr: "دروس ومواد وشروحات بأي لغة.",
    introEn: "Build lesson plans, worksheets and clear explanations in seconds, in Arabic or English. Pin a model and your curriculum in a Space so the assistant stays grounded in how you teach.",
    introAr: "ابنِ خطط دروس وأوراق عمل وشروحات واضحة في ثوانٍ، بالعربي أو الإنجليزي. ثبّت نموذج ومنهجك في Space عشان المساعد يفضل ملتزم بطريقة تدريسك.",
    jobsEn: ["Create lesson plans and worksheets", "Explain hard topics simply", "Generate quizzes and examples", "Work in Arabic or English"],
    jobsAr: ["إنشاء خطط دروس وأوراق عمل", "شرح المواضيع الصعبة ببساطة", "توليد اختبارات وأمثلة", "الشغل بالعربي أو الإنجليزي"],
    featuresEn: ["Spaces with your curriculum", "Bilingual explanations", "Multi-model chat", "Image generation for materials"],
    featuresAr: ["Spaces بمنهجك", "شروحات ثنائية اللغة", "محادثة متعددة النماذج", "توليد صور للمواد"],
  },
  {
    slug: "students",
    nameEn: "Students & researchers", nameAr: "الطلاب والباحثون",
    taglineEn: "Study, research and write with cited answers.",
    taglineAr: "ذاكر وابحث واكتب بإجابات موثّقة.",
    introEn: "Understand tough material, summarize sources and draft papers with the best models, in Arabic or English. Deep Research returns a structured, cited report so you can verify every claim.",
    introAr: "افهم المواد الصعبة، لخّص المصادر، واكتب أبحاثك بأفضل النماذج، بالعربي أو الإنجليزي. الـ Deep Research بيرجّع تقرير منظّم وموثّق عشان تتأكد من كل معلومة.",
    jobsEn: ["Summarize papers and notes", "Get step-by-step explanations", "Draft and edit essays", "Run cited deep research"],
    jobsAr: ["تلخيص الأبحاث والملاحظات", "شرح خطوة بخطوة", "صياغة وتحرير المقالات", "بحث عميق موثّق"],
    featuresEn: ["Deep Research with citations", "Multi-model chat", "Spaces for each subject", "Bilingual EN / AR"],
    featuresAr: ["بحث عميق بمراجع", "محادثة متعددة النماذج", "Spaces لكل مادة", "ثنائي اللغة عربي/إنجليزي"],
  },
  {
    slug: "writers",
    nameEn: "Writers & content", nameAr: "الكتّاب وصنّاع المحتوى",
    taglineEn: "Draft, edit and polish across models.",
    taglineAr: "صياغة وتحرير وتنقيح عبر النماذج.",
    introEn: "Move from blank page to finished piece. Brainstorm with one model, draft with another, then edit side-by-side in Canvas, in Arabic or English. Keep each project grounded in your voice with Spaces.",
    introAr: "اتحرّك من الصفحة الفاضية للنص الجاهز. اعصف ذهنيًا بنموذج، اكتب بنموذج تاني، وحرّر جنب بعض في Canvas، بالعربي أو الإنجليزي. خلّي كل مشروع ملتزم بأسلوبك مع Spaces.",
    jobsEn: ["Brainstorm and outline", "Draft long-form content", "Edit and rewrite in Canvas", "Match your tone with Spaces"],
    jobsAr: ["العصف الذهني ووضع الخطوط العريضة", "كتابة محتوى طويل", "التحرير وإعادة الصياغة في Canvas", "مطابقة أسلوبك عبر Spaces"],
    featuresEn: ["Canvas / Artifacts", "Multi-model chat", "Spaces for your voice", "Skills for copywriting"],
    featuresAr: ["Canvas / Artifacts", "محادثة متعددة النماذج", "Spaces لأسلوبك", "مهارات لكتابة المحتوى"],
  },
  {
    slug: "translation",
    nameEn: "Translators", nameAr: "المترجمون",
    taglineEn: "Native Arabic-English translation, in context.",
    taglineAr: "ترجمة عربية-إنجليزية أصيلة، بالسياق.",
    introEn: "Translate with models that genuinely understand Arabic and English, keeping tone and context intact. Full right-to-left support and Spaces that remember your glossary make Pervagans a real bilingual translation workspace.",
    introAr: "ترجم بنماذج بتفهم العربي والإنجليزي فعلًا، مع الحفاظ على النبرة والسياق. دعم كامل للكتابة من اليمين لليسار و Spaces بتفتكر مصطلحاتك بيخلّوا Pervagans مساحة ترجمة ثنائية اللغة حقيقية.",
    jobsEn: ["Translate documents in context", "Keep tone and meaning intact", "Build a reusable glossary in a Space", "Work fully right-to-left"],
    jobsAr: ["ترجمة المستندات بالسياق", "الحفاظ على النبرة والمعنى", "بناء قاموس مصطلحات قابل لإعادة الاستخدام في Space", "الشغل كامل من اليمين لليسار"],
    featuresEn: ["Strong Arabic models", "Full RTL support", "Spaces for glossaries", "Multi-model comparison"],
    featuresAr: ["نماذج عربية قوية", "دعم كامل للـ RTL", "Spaces لقواميس المصطلحات", "مقارنة بين النماذج"],
  },
  {
    slug: "business",
    nameEn: "Founders & small business", nameAr: "المؤسّسون والشركات الصغيرة",
    taglineEn: "One AI workspace instead of a whole team's tools.",
    taglineAr: "مساحة ذكاء اصطناعي واحدة بدل أدوات فريق كامل.",
    introEn: "Do the work of several roles without several subscriptions. Write, design, research and automate multi-step tasks with an AI agent that connects to your real tools, all on one shared credit pool.",
    introAr: "اعمل شغل كذا دور من غير كذا اشتراك. اكتب وصمّم وابحث وأتمت مهام متعدّدة الخطوات بوكيل ذكاء اصطناعي بيتوصّل بأدواتك الحقيقية، كله على رصيد credits مشترك واحد.",
    jobsEn: ["Draft docs, emails and proposals", "Create marketing visuals", "Automate tasks with Agent Mode", "Connect your tools via MCP"],
    jobsAr: ["صياغة المستندات والإيميلات والعروض", "إنشاء تصاميم تسويقية", "أتمتة المهام بوضع الـ Agent", "ربط أدواتك عبر MCP"],
    featuresEn: ["Agent Mode", "Connectors (MCP)", "Image & video", "One shared credit pool"],
    featuresAr: ["وضع الـ Agent", "الموصّلات (MCP)", "الصور والفيديو", "رصيد credits مشترك"],
  },
  {
    slug: "developers",
    nameEn: "Developers", nameAr: "المطوّرون",
    taglineEn: "Code, debug and ship with top coding models.",
    taglineAr: "اكتب كود وصحّح وأطلق بأفضل نماذج البرمجة.",
    introEn: "Write code, debug and reason about systems with strong coding models like Claude and DeepSeek, then let Agent Mode act across your connected tools. Switch models per task without leaving the workspace.",
    introAr: "اكتب كود وصحّح الأخطاء وفكّر في الأنظمة بنماذج برمجة قوية زي Claude و DeepSeek، وبعدين خلّي وضع الـ Agent يتصرّف عبر أدواتك المربوطة. بدّل النماذج حسب المهمة من غير ما تسيب مساحة العمل.",
    jobsEn: ["Write and refactor code", "Debug and explain errors", "Reason over large codebases", "Automate dev tasks with Agent Mode"],
    jobsAr: ["كتابة وإعادة هيكلة الكود", "تصحيح وشرح الأخطاء", "فهم قواعد الكود الكبيرة", "أتمتة مهام التطوير بوضع الـ Agent"],
    featuresEn: ["Top coding models", "Long-context models", "Agent Mode + connectors", "Canvas for code"],
    featuresAr: ["أفضل نماذج البرمجة", "نماذج بسياق طويل", "وضع الـ Agent + الموصّلات", "Canvas للكود"],
  },
];

export function getUseCase(slug: string): UseCaseEntry | undefined {
  return USE_CASES.find((u) => u.slug === slug);
}
