export type Locale = "en" | "ar";

export type FeatureMeta = {
  slug: string;
  label: string;
  emoji: string;
  // Tailwind-ish swatch color used in the sidebar dot and the feature page
  // hero. Map: cyan | purple | yellow | green | pink | orange | blue | red.
  color: "cyan" | "purple" | "yellow" | "green" | "pink" | "orange" | "blue" | "red";
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
  recents: ReadonlyArray<{ id: number; t: string; w: string; c: string }>;
  toolList: ReadonlyArray<{ id: string; t: string; c: string; st: string }>;
};

// The 8 sidebar feature categories — single source of truth. Slug is used in
// /features/<slug> URLs and as the persisted database id.
const FEATURES_EN: ReadonlyArray<FeatureMeta> = [
  { slug: "healthcare",   label: "Healthcare & life sciences",      emoji: "🩺", color: "cyan"   },
  { slug: "writing",      label: "Writing & content creation",      emoji: "✍️", color: "purple" },
  { slug: "translation",  label: "Translation & languages",         emoji: "🌐", color: "blue"   },
  { slug: "business",     label: "Business",                         emoji: "💼", color: "yellow" },
  { slug: "financial",    label: "Financial",                        emoji: "💹", color: "green"  },
  { slug: "consulting",   label: "Consulting & Professional Services", emoji: "🤝", color: "orange" },
  { slug: "math-science", label: "Mathematics & Science",            emoji: "🧪", color: "pink"   },
  { slug: "education",    label: "Education",                        emoji: "🎓", color: "red"    },
];

const FEATURES_AR: ReadonlyArray<FeatureMeta> = [
  { slug: "healthcare",   label: "الصحة وعلوم الحياة",                emoji: "🩺", color: "cyan"   },
  { slug: "writing",      label: "الكتابة وإنتاج المحتوى",            emoji: "✍️", color: "purple" },
  { slug: "translation",  label: "الترجمة واللغات",                   emoji: "🌐", color: "blue"   },
  { slug: "business",     label: "الأعمال",                            emoji: "💼", color: "yellow" },
  { slug: "financial",    label: "المالية",                            emoji: "💹", color: "green"  },
  { slug: "consulting",   label: "الاستشارات والخدمات المهنية",        emoji: "🤝", color: "orange" },
  { slug: "math-science", label: "الرياضيات والعلوم",                 emoji: "🧪", color: "pink"   },
  { slug: "education",    label: "التعليم",                            emoji: "🎓", color: "red"    },
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
    recents: [],
    toolList: [],
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
    recents: [],
    toolList: [],
  },
};

// `brand` drives which SVG mark the model picker renders next to each row —
// Anthropic's coral asterisk for Claude, Google's gradient sparkle for
// Gemini. (See I.anthropicMark / I.geminiMark in icons.tsx.) Adding a new
// vendor here just means adding another brand + the matching icon.
export const MODELS = [
  {
    id: "opus-4.7",
    name: "Claude Opus 4.7",
    brand: "anthropic",
    swatch: "o",
    pills: { en: ["FRONTIER", "REASONING"], ar: ["متقدّم", "استدلال"] },
    short: "Opus 4.7",
  },
  {
    id: "opus-4.6",
    name: "Claude Opus 4.6",
    brand: "anthropic",
    swatch: "o",
    pills: { en: ["BALANCED", "FAST"], ar: ["متوازن", "سريع"] },
    short: "Opus 4.6",
  },
  {
    id: "gemini-3.1",
    name: "Gemini 3.1 Pro",
    brand: "google",
    swatch: "g",
    pills: { en: ["LONG CTX", "IMAGING"], ar: ["سياق طويل", "تصوير"] },
    short: "Gemini 3.1 Pro",
  },
] as const;
