export type Locale = "en" | "ar";

export type LocaleStrings = {
  dir: "ltr" | "rtl";
  new: string; recent: string; customize: string; connectors: string; connectorsDesc: string;
  skills: string; skillsDesc: string;
  greetAm: string; greetPm: string; greetEve: string; greetItalic: string;
  user: string; plan: string; status: string;
  placeholder: string; placeholderHint: string; disclaim: string;
  addConnector: string; addConnectorDesc: string; addFile: string; addFileDesc: string;
  fromTools: string; settings: string; settingsDesc: string; plans: string; plansDesc: string;
  logout: string; logoutDesc: string;
  appearance: string; language: string; themeLight: string; themeDark: string; themeSystem: string;
  langEN: string; langAR: string;
  spaces: string; spacesHeader: string; addSpace: string; addSpaceDesc: string;
  spaceList: ReadonlyArray<{ id: string; t: string; meta: string; c: string }>;
  epic: string; pubmed: string; kdigo: string;
  modelHeader: string; modeHeader: string;
  modes: ReadonlyArray<{ id: string; label: string; color: string }>;
  recents: ReadonlyArray<{ id: number; t: string; w: string; c: string }>;
  toolList: ReadonlyArray<{ id: string; t: string; c: string; st: string }>;
};

export const STR: Record<Locale, LocaleStrings> = {
  en: {
    dir: "ltr",
    new: "New",
    recent: "History",
    customize: "Customize",
    connectors: "Connectors",
    connectorsDesc: "Registries · EHRs · MCP servers",
    skills: "Skills",
    skillsDesc: "Dose calc · cite · differential…",
    greetAm: "Good morning",
    greetPm: "Good afternoon",
    greetEve: "Good evening",
    greetItalic: "Dr.",
    user: "Ahmed Ramadan",
    plan: "Max plan",
    status: "75+ registries online · p50 < 1s",
    placeholder: "Ask a clinical question…",
    placeholderHint: "e.g. eGFR 24, CKD-3b, Pip-Tazo dose adjust?",
    disclaim: "Clinician-in-the-loop · cited · HIPAA · zero retention",
    addConnector: "Add connector",
    addConnectorDesc: "MCP · Registry · EHR",
    addFile: "Add file or folder",
    addFileDesc: "Lab PDFs · DICOM · CSV",
    fromTools: "From connected tools",
    settings: "Settings",
    settingsDesc: "Preferences · model defaults",
    plans: "Plans & billing",
    plansDesc: "Max plan · manage seats",
    logout: "Log out",
    logoutDesc: "End clinical session",
    appearance: "Appearance",
    language: "Language",
    themeLight: "Light",
    themeDark: "Dark",
    themeSystem: "System",
    langEN: "English",
    langAR: "العربية",
    spaces: "Spaces",
    spacesHeader: "Specialty spaces",
    addSpace: "New space",
    addSpaceDesc: "Cardiology, Neurology, custom…",
    spaceList: [
      { id: "icu", t: "ICU rounds", meta: "12 consults", c: "cyan" },
      { id: "cardio", t: "Cardiology", meta: "34 consults", c: "purple" },
      { id: "neuro", t: "Neurology", meta: "18 consults", c: "cyan" },
      { id: "onc", t: "Oncology — breast", meta: "22 consults", c: "yellow" },
      { id: "peds", t: "Pediatrics", meta: "9 consults", c: "purple" },
    ],
    epic: "Epic (EHR)",
    pubmed: "PubMed library",
    kdigo: "KDIGO guidelines",
    modelHeader: "Reasoning engine",
    modeHeader: "Mode",
    modes: [
      { id: "bedside", label: "Bedside fast", color: "cyan" },
      { id: "deep", label: "Deep reasoning", color: "purple" },
      { id: "cited", label: "Cite mode", color: "yellow" },
    ],
    recents: [
      { id: 1, t: "eGFR 24 — CKD-3b dose plan", w: "12m", c: "cyan" },
      { id: 2, t: "Pip-Tazo vs Mero, sepsis bundle", w: "1h", c: "purple" },
      { id: 3, t: "Atypical CXR, 62F PMHx COPD", w: "3h", c: "cyan" },
      { id: 4, t: "Differential — recurrent syncope", w: "Yesterday", c: "yellow" },
      { id: 5, t: "Anticoagulation in valvular AF", w: "Yesterday", c: "cyan" },
      { id: 6, t: "Pediatric DKA fluid resus", w: "Mon", c: "purple" },
      { id: 7, t: "ASCO breast Stage II adjuvant", w: "Mon", c: "cyan" },
    ],
    toolList: [
      { id: "pubmed", t: "PubMed", c: "c", st: "ON" },
      { id: "uptodate", t: "UpToDate", c: "c", st: "ON" },
      { id: "kdigo", t: "KDIGO", c: "p", st: "ON" },
      { id: "fda", t: "FDA DailyMed", c: "y", st: "ON" },
      { id: "snomed", t: "SNOMED CT", c: "p", st: "ON" },
    ],
  },
  ar: {
    dir: "rtl",
    new: "جديد",
    recent: "السجلّ",
    customize: "تخصيص",
    connectors: "الموصّلات",
    connectorsDesc: "سجلّات · EHR · خوادم MCP",
    skills: "المهارات",
    skillsDesc: "حساب جرعة · استشهاد · تشخيص…",
    greetAm: "صباح الخير",
    greetPm: "مساء الخير",
    greetEve: "مساء الخير",
    greetItalic: "د.",
    user: "أحمد رمضان",
    plan: "خطة Max",
    status: "‏75+ مرجعًا متّصلًا · زمن الاستجابة < ١ث",
    placeholder: "اسأل سؤالًا سريريًّا…",
    placeholderHint: "مثلًا: تعديل جرعة Pip-Tazo عند eGFR 24",
    disclaim: "تحت إشراف الطبيب · موثّق · HIPAA · بدون احتفاظ بالبيانات",
    addConnector: "إضافة موصِّل",
    addConnectorDesc: "MCP · سجل · EHR",
    addFile: "إضافة ملف أو مجلد",
    addFileDesc: "PDF · DICOM · CSV",
    fromTools: "من الأدوات المتّصلة",
    settings: "الإعدادات",
    settingsDesc: "تفضيلات · إعدادات النموذج",
    plans: "الخطط والفوترة",
    plansDesc: "خطة Max · إدارة المقاعد",
    logout: "تسجيل الخروج",
    logoutDesc: "إنهاء الجلسة السريرية",
    appearance: "المظهر",
    language: "اللغة",
    themeLight: "فاتح",
    themeDark: "داكن",
    themeSystem: "تبعًا للنظام",
    langEN: "English",
    langAR: "العربية",
    spaces: "المساحات",
    spacesHeader: "مساحات التخصص",
    addSpace: "مساحة جديدة",
    addSpaceDesc: "قلبية، عصبية، مخصصة…",
    spaceList: [
      { id: "icu", t: "جولات العناية المركّزة", meta: "±١٢ استشارة", c: "cyan" },
      { id: "cardio", t: "أمراض القلب", meta: "±٣٤ استشارة", c: "purple" },
      { id: "neuro", t: "أعصاب", meta: "±١٨ استشارة", c: "cyan" },
      { id: "onc", t: "أورام — ثدي", meta: "±٢٢ استشارة", c: "yellow" },
      { id: "peds", t: "أطفال", meta: "±٩ استشارات", c: "purple" },
    ],
    epic: "Epic (EHR)",
    pubmed: "مكتبة PubMed",
    kdigo: "إرشادات KDIGO",
    modelHeader: "محرّك الاستدلال",
    modeHeader: "الوضع",
    modes: [
      { id: "bedside", label: "سريع · بجانب السرير", color: "cyan" },
      { id: "deep", label: "استدلال عميق", color: "purple" },
      { id: "cited", label: "وضع الاستشهاد", color: "yellow" },
    ],
    recents: [
      { id: 1, t: "‏eGFR 24 — خطة جرعات CKD-3b", w: "12د", c: "cyan" },
      { id: 2, t: "‏Pip-Tazo مقابل Mero في الإنتان", w: "1س", c: "purple" },
      { id: 3, t: "صورة صدر غير نمطية — ٦٢ أنثى", w: "3س", c: "cyan" },
      { id: 4, t: "تشخيص تفريقي — إغماء متكرر", w: "أمس", c: "yellow" },
      { id: 5, t: "مضادات التخثر في AF صمامي", w: "أمس", c: "cyan" },
      { id: 6, t: "إنعاش سوائل DKA أطفال", w: "الإثنين", c: "purple" },
      { id: 7, t: "علاج مساعد سرطان ثدي II", w: "الإثنين", c: "cyan" },
    ],
    toolList: [
      { id: "pubmed", t: "PubMed", c: "c", st: "متصل" },
      { id: "uptodate", t: "UpToDate", c: "c", st: "متصل" },
      { id: "kdigo", t: "KDIGO", c: "p", st: "متصل" },
      { id: "fda", t: "FDA DailyMed", c: "y", st: "متصل" },
      { id: "snomed", t: "SNOMED CT", c: "p", st: "متصل" },
    ],
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
