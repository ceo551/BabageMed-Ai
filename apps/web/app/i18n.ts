export type Locale = "en" | "ar";

export type FeatureMeta = {
  slug: string;
  label: string;
  emoji: string;
  // Swatch colour used in the sidebar dot + feature-page hero. Added two
  // values (teal, amber) with the move to 10 features.
  color: "cyan" | "purple" | "yellow" | "green" | "pink" | "orange" | "blue" | "red" | "teal" | "amber";
  // text → composer shows the chat LLMs (Opus / GPT / Gemini / GLM / …).
  // visual → composer shows the image + video model groups instead.
  modality: "text" | "visual";
};

export type LocaleStrings = {
  dir: "ltr" | "rtl";
  new: string; recent: string; customize: string; connectors: string; connectorsDesc: string;
  skills: string; skillsDesc: string;
  greetAm: string; greetPm: string; greetEve: string; greetItalic: string;
  user: string; plan: string; status: string;
  placeholder: string; placeholderHint: string; disclaim: string;
  addConnector: string; addConnectorDesc: string; addFile: string;
  fromTools: string; settings: string; settingsDesc: string; plans: string; plansDesc: string;
  logout: string; logoutDesc: string;
  appearance: string; language: string; themeLight: string; themeDark: string; themeSystem: string;
  langEN: string; langAR: string;
  // ── features (replaces spaces) ────────────────────────────────────────────
  featuresHeader: string;
  features: ReadonlyArray<FeatureMeta>;
  instructions: string; instructionsDesc: string;
  filesFolders: string; filesFoldersDesc: string;
  skillsPanel: string; skillsPanelDesc: string;
  connectorsPanel: string; connectorsPanelDesc: string;
  // ── chat extras ───────────────────────────────────────────────────────────
  epic: string; pubmed: string; kdigo: string;
  modelHeader: string; modeHeader: string;
  modes: ReadonlyArray<{ id: string; label: string; color: string }>;
  // ── feature workspace strings ────────────────────────────────────────────
  workspace: string;
  signInToKeepHistory: string;
  noChatsYet: string;
  loadingChats: string;
  featureChatEmpty: string;
  imageGroup: string;
  videoGroup: string;
};

// The 10 sidebar feature categories — single source of truth. Slug is
// used in /features/<slug> URLs and as the persisted database id. Order
// here is the order rendered in the sidebar.
//
// Two MODALITIES exist:
//   - text:   8 features that compose against TEXT_MODELS (chat).
//   - visual: 2 features (image-video, advertisements) that compose
//             against IMAGE_MODELS + VIDEO_MODELS.
// `modality` is what apps/web/app/lib/models.ts maps from a slug to
// the right model list.
const FEATURES_EN: ReadonlyArray<FeatureMeta> = [
  { slug: "healthcare",     label: "Healthcare & Life sciences",          emoji: "🩺", color: "cyan",   modality: "text"   },
  { slug: "education",      label: "Education & Academic & Research",     emoji: "🎓", color: "red",    modality: "text"   },
  { slug: "writing",        label: "Writing & Content creation",          emoji: "✍️", color: "purple", modality: "text"   },
  { slug: "translation",    label: "Translation & Languages",             emoji: "🌐", color: "blue",   modality: "text"   },
  { slug: "data-analysis",  label: "Data Analysis",                       emoji: "📊", color: "teal",   modality: "text"   },
  { slug: "business",       label: "Business",                            emoji: "💼", color: "yellow", modality: "text"   },
  { slug: "financial",      label: "Financial Services",                  emoji: "💹", color: "green",  modality: "text"   },
  { slug: "consulting",     label: "Consulting & Professional Services",  emoji: "🤝", color: "orange", modality: "text"   },
  { slug: "image-video",    label: "Image & Video",                       emoji: "🎬", color: "pink",   modality: "visual" },
  { slug: "advertisements", label: "Advertisements",                      emoji: "📣", color: "amber",  modality: "visual" },
];

const FEATURES_AR: ReadonlyArray<FeatureMeta> = [
  { slug: "healthcare",     label: "الصحة وعلوم الحياة",                   emoji: "🩺", color: "cyan",   modality: "text"   },
  { slug: "education",      label: "التعليم والبحث الأكاديمي",              emoji: "🎓", color: "red",    modality: "text"   },
  { slug: "writing",        label: "الكتابة وإنتاج المحتوى",               emoji: "✍️", color: "purple", modality: "text"   },
  { slug: "translation",    label: "الترجمة واللغات",                      emoji: "🌐", color: "blue",   modality: "text"   },
  { slug: "data-analysis",  label: "تحليل البيانات",                       emoji: "📊", color: "teal",   modality: "text"   },
  { slug: "business",       label: "الأعمال",                              emoji: "💼", color: "yellow", modality: "text"   },
  { slug: "financial",      label: "الخدمات المالية",                      emoji: "💹", color: "green",  modality: "text"   },
  { slug: "consulting",     label: "الاستشارات والخدمات المهنية",          emoji: "🤝", color: "orange", modality: "text"   },
  { slug: "image-video",    label: "الصور والفيديو",                       emoji: "🎬", color: "pink",   modality: "visual" },
  { slug: "advertisements", label: "الإعلانات",                            emoji: "📣", color: "amber",  modality: "visual" },
];

export const STR: Record<Locale, LocaleStrings> = {
  en: {
    dir: "ltr",
    new: "New",
    recent: "History",
    customize: "Customize",
    connectors: "Connectors",
    connectorsDesc: "MCP servers · APIs · web sources",
    skills: "Skills",
    skillsDesc: "Reusable instructions and prompt presets",
    greetAm: "Good morning",
    greetPm: "Good afternoon",
    greetEve: "Good evening",
    greetItalic: "",
    user: "Ahmed Ramadan",
    plan: "Max plan",
    status: "Connectors online · streaming responses",
    placeholder: "Ask anything…",
    placeholderHint: "Pick a feature on the left for instructions, files, skills and connectors tuned to that workflow.",
    disclaim: "Cited · zero retention · your data stays yours",
    addConnector: "Add connector",
    addConnectorDesc: "Pick from connected MCP servers",
    addFile: "Add file or folder",
    fromTools: "From connected tools",
    settings: "Settings",
    settingsDesc: "Preferences · model defaults",
    plans: "Plans & billing",
    plansDesc: "Max plan · manage seats",
    logout: "Log out",
    logoutDesc: "End session",
    appearance: "Appearance",
    language: "Language",
    themeLight: "Light",
    themeDark: "Dark",
    themeSystem: "System",
    langEN: "English",
    langAR: "العربية",
    featuresHeader: "Features",
    features: FEATURES_EN,
    instructions: "Instructions",
    instructionsDesc: "Custom system prompt that runs on every chat in this feature.",
    filesFolders: "Files & folders",
    filesFoldersDesc: "PDFs, documents, or notes for grounding answers in this feature.",
    skillsPanel: "Skills",
    skillsPanelDesc: "Reusable instructions Babbage applies for tasks in this feature.",
    connectorsPanel: "Connectors",
    connectorsPanelDesc: "MCP servers Babbage may call for this feature.",
    epic: "Epic",
    pubmed: "PubMed library",
    kdigo: "KDIGO guidelines",
    modelHeader: "Reasoning engine",
    modeHeader: "Mode",
    modes: [
      { id: "bedside", label: "Fast",            color: "cyan"   },
      { id: "deep",    label: "Deep reasoning",  color: "purple" },
      { id: "cited",   label: "Cite mode",       color: "yellow" },
    ],
    workspace: "Workspace",
    signInToKeepHistory: "Sign in to keep history.",
    noChatsYet: "No chats yet",
    loadingChats: "Loading…",
    featureChatEmpty: "Start a new chat in this feature. Its instructions, files, skills and connectors are applied automatically.",
    imageGroup: "Image",
    videoGroup: "Video",
  },
  ar: {
    dir: "rtl",
    new: "جديد",
    recent: "السجلّ",
    customize: "تخصيص",
    connectors: "الموصّلات",
    connectorsDesc: "خوادم MCP · APIs · مصادر ويب",
    skills: "المهارات",
    skillsDesc: "تعليمات قابلة لإعادة الاستخدام",
    greetAm: "صباح الخير",
    greetPm: "مساء الخير",
    greetEve: "مساء الخير",
    greetItalic: "",
    user: "أحمد رمضان",
    plan: "خطة Max",
    status: "الموصّلات متّصلة · ردود متدفّقة",
    placeholder: "اسأل أى سؤال…",
    placeholderHint: "اختر ميزة من اليمين لتعليمات وملفات ومهارات وموصّلات خاصة بها.",
    disclaim: "موثّق · بدون احتفاظ بالبيانات · بياناتك ملكك",
    addConnector: "إضافة موصِّل",
    addConnectorDesc: "من خوادم MCP المتّصلة",
    addFile: "إضافة ملف أو مجلد",
    fromTools: "من الأدوات المتّصلة",
    settings: "الإعدادات",
    settingsDesc: "تفضيلات · إعدادات النموذج",
    plans: "الخطط والفوترة",
    plansDesc: "خطة Max · إدارة المقاعد",
    logout: "تسجيل الخروج",
    logoutDesc: "إنهاء الجلسة",
    appearance: "المظهر",
    language: "اللغة",
    themeLight: "فاتح",
    themeDark: "داكن",
    themeSystem: "تبعًا للنظام",
    langEN: "English",
    langAR: "العربية",
    featuresHeader: "الميزات",
    features: FEATURES_AR,
    instructions: "التعليمات",
    instructionsDesc: "نص توجيه يُطبَّق على كل محادثة فى هذه الميزة.",
    filesFolders: "الملفات والمجلدات",
    filesFoldersDesc: "ملفات PDF أو مستندات أو ملاحظات تستند إليها الإجابات.",
    skillsPanel: "المهارات",
    skillsPanelDesc: "تعليمات قابلة لإعادة الاستخدام يستخدمها Babbage لمهام هذه الميزة.",
    connectorsPanel: "الموصّلات",
    connectorsPanelDesc: "خوادم MCP التى يستدعيها Babbage لهذه الميزة.",
    epic: "Epic",
    pubmed: "مكتبة PubMed",
    kdigo: "إرشادات KDIGO",
    modelHeader: "محرّك الاستدلال",
    modeHeader: "الوضع",
    modes: [
      { id: "bedside", label: "سريع",              color: "cyan"   },
      { id: "deep",    label: "استدلال عميق",       color: "purple" },
      { id: "cited",   label: "وضع الاستشهاد",      color: "yellow" },
    ],
    workspace: "مساحة عمل",
    signInToKeepHistory: "سجّل الدخول لحفظ السجل.",
    noChatsYet: "لا توجد محادثات بعد",
    loadingChats: "جارٍ التحميل…",
    featureChatEmpty: "ابدأ محادثة جديدة فى هذه الميزة. التعليمات والملفات والمهارات والموصّلات الخاصة بها ستُستخدم تلقائيًا.",
    imageGroup: "صور",
    videoGroup: "فيديو",
  },
};

// `brand` drives which SVG mark the model picker renders next to each row —
// Backwards-compat export. The full per-modality registry now lives in
// apps/web/app/lib/models.ts (TEXT_MODELS / IMAGE_MODELS / VIDEO_MODELS).
// Callers that need to know which models to render should use
// modelsForFeature(feature) from that module instead. This re-export
// stays so the settings/page.tsx "default model" picker and any other
// consumer of a flat list keeps compiling. Visual-only models are not
// included here because they're not picked from the text composer.
export { TEXT_MODELS as MODELS } from "./lib/models";
