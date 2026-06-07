export type Locale = "en" | "ar";

export type FeatureMeta = {
  slug: string;
  label: string;
  emoji: string;
  // Swatch colour used in the sidebar dot + feature-page hero. Added two
  // values (teal, amber) with the move to 10 features.
  color: "cyan" | "purple" | "yellow" | "green" | "pink" | "orange" | "blue" | "red" | "teal" | "amber" | "indigo" | "rose" | "fuchsia";
  // text → composer shows the chat LLMs (Opus / GPT / Gemini / GLM / …).
  // visual → composer shows the image + video model groups instead.
  modality: "text" | "image" | "video";
};

export type LocaleStrings = {
  dir: "ltr" | "rtl";
  new: string; recent: string; customize: string; connectors: string; connectorsDesc: string;
  skills: string; skillsDesc: string;
  greetAm: string; greetPm: string; greetEve: string; greetItalic: string;
  user: string; plan: string; status: string;
  placeholder: string; placeholderHint: string; disclaim: string;
  addConnector: string; addConnectorDesc: string; addFile: string;
  webSearch: string; webSearchDesc: string;
  deepResearch: string; deepResearchDesc: string;
  agentMode: string; agentModeDesc: string; agentWorking: string;
  fromTools: string; settings: string; settingsDesc: string; plans: string; plansDesc: string;
  logout: string; logoutDesc: string;
  appearance: string; language: string; themeLight: string; themeDark: string; themeSystem: string;
  langEN: string; langAR: string;
  // ── features (replaces spaces) ────────────────────────────────────────────
  featuresHeader: string;
  features: ReadonlyArray<FeatureMeta>;
  // ── Spaces (Claude Projects / Perplexity Spaces analogue) ────────────────
  spacesHeader: string;
  newSpace: string;
  createSpace: string;
  spaceNameLabel: string;
  spaceNamePlaceholder: string;
  noSpacesYet: string;
  deleteSpace: string;
  spaceChatPlaceholder: string;
  allSpaces: string;
  searchSpaces: string;
  instructionsTellHint: string;
  filesHint: string;
  skillsHint: string;
  memoryPanel: string; memoryHint: string; addMemory: string;
  updatedAgo: string;
  noSpacesMatch: string;
  clearSearch: string;
  newThread: string;
  deleteSpaceConfirm: string;
  spaceNotFound: string;
  createFailed: string;
  send: string;
  stop: string;
  errorPrefix: string;
  quotaReached: string;
  instructions: string; instructionsDesc: string;
  filesFolders: string; filesFoldersDesc: string;
  skillsPanel: string; skillsPanelDesc: string;
  connectorsPanel: string; connectorsPanelDesc: string;
  // ── chat extras ───────────────────────────────────────────────────────────
  modelHeader: string; modeHeader: string;
  modes: ReadonlyArray<{ id: string; label: string; color: string }>;
  // ── feature workspace strings ────────────────────────────────────────────
  workspace: string;
  signInToKeepHistory: string;
  noChatsYet: string;
  loadingChats: string;
  featureChatEmpty: string;
  featureChatEmptyVisual: string;
  imageGroup: string;
  videoGroup: string;
  generatingImage: string;
  generatingVideo: string;
  mediaFailed: string;
  download: string;
  aspectRatio: string;
  negativePrompt: string;
  seed: string;
  batch: string;
  lockSeed: string;
  galleryTitle: string;
  tasks: string;
  galleryEmpty: string;
  galleryDeleteConfirm: string;
  galleryCreateCta: string;
  openInCanvas: string;
  canvasTitle: string;
  canvasPreview: string;
  canvasCode: string;
  copy: string;
  close: string;
  // ── Common actions / dialogs (used by recent UI additions) ───────────────
  cancel: string;
  save: string;
  saving: string;
  saved: string; connected: string; copied: string;
  rename: string;
  renameChat: string;
  delete: string;
  edit: string;
  more: string;
  chatOptions: string;
  chatTitle: string;
  untitledChat: string;
  addSkill: string;
  skillExample: string;
  saveInstructions: string;
  remove: string;
  resizeSidebar: string;
  resizeSubSidebar: string;
  resizeRail: string;
  collapseSidebar: string;
  expandSidebar: string;
  collapseRail: string;
  expandRail: string;
  voiceComingSoon: string;
  voiceStart: string;
  voiceListening: string;
  voiceUnsupported: string;
  toggleNavigation: string;
  featureSettings: string;
  // ── Auth pages ────────────────────────────────────────────────────────
  welcomeBack: string;
  signInToContinue: string;
  signInCta: string;
  signUpCta: string;
  signUpToContinue: string;
  createAccount: string;
  emailLabel: string;
  passwordLabel: string;
  mfaCodePrompt: string;
  authenticatorCode: string;
  mfaCodePlaceholder: string;
  verifyAndSignIn: string;
  forgotPassword: string;
  noAccountYet: string;
  createOne: string;
  alreadyHaveAccount: string;
  signInLink: string;
  // ── Misc UI bits ──────────────────────────────────────────────────────
  sources: string;
  closeDialog: string;
  searchConnectorsPlaceholder: string;
  allKinds: string;
  apiKind: string;
  scrapeKind: string;
  hybridKind: string;
  allFeaturesFilter: string;
  disconnect: string;
  generating: string;
  searchingWeb: string;
  workingOnIt: string;
  retry: string;
  sidebarLabel: string;
  settingsNavLabel: string;
  addLabel: string;
  micLabel: string;
};

// The 10 sidebar feature categories — single source of truth. Slug is
// used in /features/<slug> URLs and as the persisted database id. Order
// here is the order rendered in the sidebar.
//
// Two MODALITIES exist:
//   - text:   8 features that compose against TEXT_MODELS (chat).
//   - visual: 1 feature (image-video) that composes
//             against IMAGE_MODELS + VIDEO_MODELS.
// `modality` is what apps/web/app/lib/models.ts maps from a slug to
// the right model list.
const FEATURES_EN: ReadonlyArray<FeatureMeta> = [
  { slug: "education",      label: "Education & Academic & Research",     emoji: "🎓", color: "indigo", modality: "text"   },
  { slug: "writing",        label: "Writing & Content creation",          emoji: "✍️", color: "purple", modality: "text"   },
  { slug: "translation",    label: "Translation & Languages",             emoji: "🌐", color: "blue",   modality: "text"   },
  { slug: "data-analysis",  label: "Data Analysis",                       emoji: "📊", color: "teal",   modality: "text"   },
  { slug: "business",       label: "Business",                            emoji: "💼", color: "yellow", modality: "text"   },
  { slug: "financial",      label: "Financial Services",                  emoji: "💹", color: "green",  modality: "text"   },
  { slug: "image",          label: "Image generation",                    emoji: "🖼️", color: "pink",   modality: "image"  },
  { slug: "video",          label: "Video generation",                    emoji: "🎬", color: "rose",   modality: "video"  },
];

const FEATURES_AR: ReadonlyArray<FeatureMeta> = [
  { slug: "education",      label: "التعليم والبحث الأكاديمي",              emoji: "🎓", color: "indigo", modality: "text"   },
  { slug: "writing",        label: "الكتابة وإنتاج المحتوى",               emoji: "✍️", color: "purple", modality: "text"   },
  { slug: "translation",    label: "الترجمة واللغات",                      emoji: "🌐", color: "blue",   modality: "text"   },
  { slug: "data-analysis",  label: "تحليل البيانات",                       emoji: "📊", color: "teal",   modality: "text"   },
  { slug: "business",       label: "الأعمال",                              emoji: "💼", color: "yellow", modality: "text"   },
  { slug: "financial",      label: "الخدمات المالية",                      emoji: "💹", color: "green",  modality: "text"   },
  { slug: "image",          label: "توليد الصور",                          emoji: "🖼️", color: "pink",   modality: "image"  },
  { slug: "video",          label: "توليد الفيديو",                        emoji: "🎬", color: "rose",   modality: "video"  },
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
    webSearch: "Web search",
    webSearchDesc: "Search the live web with Brave",
    deepResearch: "Deep research",
    deepResearchDesc: "Plan sub-questions, search many sources, write a cited report",
    agentMode: "Agent",
    agentModeDesc: "Plan and act across your connectors to complete a task",
    agentWorking: "Working…",
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
    spacesHeader: "Spaces",
    newSpace: "New space",
    createSpace: "Create space",
    spaceNameLabel: "Space name",
    spaceNamePlaceholder: "e.g. Research, Client X, Thesis",
    noSpacesYet: "No spaces yet",
    deleteSpace: "Delete space",
    spaceChatPlaceholder: "Ask anything in this space…",
    allSpaces: "All spaces",
    searchSpaces: "Search spaces…",
    instructionsTellHint: "Tell the assistant how it should work in this space.",
    filesHint: "Add reference docs the assistant should use as context.",
    skillsHint: "Reusable capabilities the assistant applies automatically.",
    memoryPanel: "Memory",
    memoryHint: "Facts the assistant remembers in every chat in this space.",
    addMemory: "Add memory",
    updatedAgo: "Updated",
    noSpacesMatch: "No spaces match your search",
    clearSearch: "Clear search",
    newThread: "New thread",
    deleteSpaceConfirm: "Delete this space and all its threads, files and instructions? This can't be undone.",
    spaceNotFound: "Space not found",
    createFailed: "Couldn't create the space. Please try again.",
    send: "Send",
    stop: "Stop",
    errorPrefix: "Error: ",
    quotaReached: "You've reached your plan's monthly usage limit. Upgrade for more.",
    instructions: "Instructions",
    instructionsDesc: "Custom system prompt that runs on every chat in this feature.",
    filesFolders: "Files & folders",
    filesFoldersDesc: "PDFs, documents, or notes for grounding answers in this feature.",
    skillsPanel: "Skills",
    skillsPanelDesc: "Reusable instructions Pervagans applies for tasks in this feature.",
    connectorsPanel: "Connectors",
    connectorsPanelDesc: "MCP servers Pervagans may call for this feature.",
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
    featureChatEmptyVisual: "Start a new chat in this feature. Its instructions, files and skills are applied automatically.",
    imageGroup: "Image",
    videoGroup: "Video",
    generatingImage: "Generating image…",
    generatingVideo: "Generating video. This can take a minute…",
    mediaFailed: "Generation failed. Please try again.",
    download: "Download",
    aspectRatio: "Aspect ratio",
    negativePrompt: "Negative prompt (what to avoid)",
    seed: "Seed",
    batch: "Count",
    lockSeed: "Lock seed for reproducible results",
    galleryTitle: "Gallery",
    tasks: "Tasks",
    galleryEmpty: "No generated media yet. Create your first image or video.",
    galleryDeleteConfirm: "Delete this asset? This can't be undone.",
    galleryCreateCta: "Create an image",
    openInCanvas: "Open in Canvas",
    canvasTitle: "Canvas",
    canvasPreview: "Preview",
    canvasCode: "Code",
    copy: "Copy",
    close: "Close",
    cancel: "Cancel",
    save: "Save",
    saving: "Saving…",
    saved: "Saved", connected: "Connected", copied: "Copied",
    rename: "Rename",
    renameChat: "Rename chat",
    delete: "Delete",
    edit: "Edit",
    more: "More",
    chatOptions: "Chat options",
    chatTitle: "Chat title",
    untitledChat: "Untitled chat",
    addSkill: "Add skill",
    skillExample: "e.g. cite sources, use bullets, reply in Arabic",
    saveInstructions: "Save instructions",
    remove: "Remove",
    resizeSidebar: "Resize sidebar",
    resizeSubSidebar: "Resize sub-sidebar",
    resizeRail: "Resize rail",
    collapseSidebar: "Collapse sidebar",
    expandSidebar: "Expand sidebar",
    collapseRail: "Collapse rail",
    expandRail: "Expand rail",
    voiceComingSoon: "Voice (coming soon)",
    voiceStart: "Speak to type",
    voiceListening: "Listening… tap to stop",
    voiceUnsupported: "Voice input isn't supported in this browser. Try Chrome.",
    toggleNavigation: "Toggle navigation",
    featureSettings: "Feature settings",
    welcomeBack: "Welcome back",
    signInToContinue: "Sign in to continue with Pervagans.",
    signInCta: "Sign in",
    signUpCta: "Sign up",
    signUpToContinue: "Create an account to get started with Pervagans.",
    createAccount: "Create account",
    emailLabel: "Email",
    passwordLabel: "Password",
    mfaCodePrompt: "Enter the 6-digit code from your authenticator app, or a backup code.",
    authenticatorCode: "Authenticator code",
    mfaCodePlaceholder: "123456 or XXXX-XXXX",
    verifyAndSignIn: "Verify and sign in",
    forgotPassword: "Forgot password?",
    noAccountYet: "No account yet?",
    createOne: "Create one",
    alreadyHaveAccount: "Already have one?",
    signInLink: "Sign in",
    sources: "Sources",
    closeDialog: "Close dialog",
    searchConnectorsPlaceholder: "Search by id, name, or URL…",
    allKinds: "All kinds",
    apiKind: "API",
    scrapeKind: "Scrape",
    hybridKind: "Hybrid",
    allFeaturesFilter: "All features",
    disconnect: "Disconnect",
    generating: "Generating",
    searchingWeb: "Searching the web…",
    workingOnIt: "Working on it…",
    retry: "Retry",
    sidebarLabel: "Sidebar",
    settingsNavLabel: "Settings navigation",
    addLabel: "Add",
    micLabel: "Mic",
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
    webSearch: "بحث في الويب",
    webSearchDesc: "ابحث في الويب مباشرةً عبر Brave",
    deepResearch: "بحث متعمّق",
    deepResearchDesc: "يخطّط أسئلة فرعية، يبحث في مصادر كثيرة، ويكتب تقريرًا موثّقًا",
    agentMode: "وكيل",
    agentModeDesc: "يخطّط وينفّذ عبر الموصّلات لإنجاز المهمة",
    agentWorking: "جارٍ العمل…",
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
    spacesHeader: "المساحات",
    newSpace: "مساحة جديدة",
    createSpace: "إنشاء مساحة",
    spaceNameLabel: "اسم المساحة",
    spaceNamePlaceholder: "مثال: بحث، عميل X، الرسالة",
    noSpacesYet: "لا توجد مساحات بعد",
    deleteSpace: "حذف المساحة",
    spaceChatPlaceholder: "اسأل أي شيء في هذه المساحة…",
    allSpaces: "كل المساحات",
    searchSpaces: "ابحث في المساحات…",
    instructionsTellHint: "أخبر المساعد كيف يعمل في هذه المساحة.",
    filesHint: "أضف مستندات مرجعية يستخدمها المساعد كسياق.",
    skillsHint: "قدرات قابلة لإعادة الاستخدام يطبّقها المساعد تلقائيًا.",
    memoryPanel: "الذاكرة",
    memoryHint: "حقائق يتذكّرها المساعد في كل محادثة بهذه المساحة.",
    addMemory: "أضف معلومة",
    updatedAgo: "آخر تحديث",
    noSpacesMatch: "لا توجد مساحات مطابقة لبحثك",
    clearSearch: "مسح البحث",
    newThread: "محادثة جديدة",
    deleteSpaceConfirm: "حذف هذه المساحة وكل محادثاتها وملفاتها وتعليماتها؟ لا يمكن التراجع.",
    spaceNotFound: "المساحة غير موجودة",
    createFailed: "تعذّر إنشاء المساحة. حاول مرة أخرى.",
    send: "إرسال",
    stop: "إيقاف",
    errorPrefix: "خطأ: ",
    quotaReached: "وصلت إلى حد الاستخدام الشهري لباقتك. رقِّ باقتك للمزيد.",
    instructions: "التعليمات",
    instructionsDesc: "نص توجيه يُطبَّق على كل محادثة فى هذه الميزة.",
    filesFolders: "الملفات والمجلدات",
    filesFoldersDesc: "ملفات PDF أو مستندات أو ملاحظات تستند إليها الإجابات.",
    skillsPanel: "المهارات",
    skillsPanelDesc: "تعليمات قابلة لإعادة الاستخدام يستخدمها Pervagans لمهام هذه الميزة.",
    connectorsPanel: "الموصّلات",
    connectorsPanelDesc: "خوادم MCP التى يستدعيها Pervagans لهذه الميزة.",
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
    featureChatEmptyVisual: "ابدأ محادثة جديدة فى هذه الميزة. التعليمات والملفات والمهارات الخاصة بها ستُستخدم تلقائيًا.",
    imageGroup: "صور",
    videoGroup: "فيديو",
    generatingImage: "جارٍ توليد الصورة…",
    generatingVideo: "جارٍ توليد الفيديو، قد يستغرق دقيقة…",
    mediaFailed: "فشل التوليد. حاول مرة أخرى.",
    download: "تنزيل",
    aspectRatio: "نسبة الأبعاد",
    negativePrompt: "وصف سلبي (ما يجب تجنّبه)",
    seed: "البذرة",
    batch: "العدد",
    lockSeed: "تثبيت البذرة لنتائج قابلة للتكرار",
    galleryTitle: "المعرض",
    tasks: "المهام",
    galleryEmpty: "لا توجد وسائط مُنشأة بعد. أنشئ أول صورة أو فيديو.",
    galleryDeleteConfirm: "حذف هذا العنصر؟ لا يمكن التراجع.",
    galleryCreateCta: "أنشئ صورة",
    openInCanvas: "افتح في الكانفس",
    canvasTitle: "الكانفس",
    canvasPreview: "معاينة",
    canvasCode: "الكود",
    copy: "نسخ",
    close: "إغلاق",
    cancel: "إلغاء",
    save: "حفظ",
    saving: "جارٍ الحفظ…",
    saved: "تم الحفظ", connected: "تم الاتصال", copied: "تم النسخ",
    rename: "إعادة تسمية",
    renameChat: "إعادة تسمية المحادثة",
    delete: "حذف",
    edit: "تعديل",
    more: "المزيد",
    chatOptions: "خيارات المحادثة",
    chatTitle: "عنوان المحادثة",
    untitledChat: "محادثة بلا عنوان",
    addSkill: "إضافة مهارة",
    skillExample: "مثال: استشهد بالمصادر، استخدم نقاطًا، رد بالعربية",
    saveInstructions: "حفظ التعليمات",
    remove: "إزالة",
    resizeSidebar: "تغيير حجم الشريط الجانبى",
    resizeSubSidebar: "تغيير حجم الشريط الفرعى",
    resizeRail: "تغيير حجم الشريط",
    collapseSidebar: "طى الشريط الجانبى",
    expandSidebar: "توسعة الشريط الجانبى",
    collapseRail: "طى الشريط",
    expandRail: "توسعة الشريط",
    voiceComingSoon: "الصوت (قريبًا)",
    voiceStart: "اتكلم عشان تكتب",
    voiceListening: "بسمعك… دوس عشان توقف",
    voiceUnsupported: "الإدخال الصوتي مش مدعوم في المتصفح ده. جرّب Chrome.",
    toggleNavigation: "إظهار/إخفاء التنقّل",
    featureSettings: "إعدادات الميزة",
    welcomeBack: "أهلاً بعودتك",
    signInToContinue: "سجّل الدخول للمتابعة مع Pervagans.",
    signInCta: "تسجيل الدخول",
    signUpCta: "إنشاء حساب",
    signUpToContinue: "أنشئ حسابًا للبدء مع Pervagans.",
    createAccount: "إنشاء حساب",
    emailLabel: "البريد الإلكترونى",
    passwordLabel: "كلمة المرور",
    mfaCodePrompt: "أدخل الرمز المكوّن من 6 أرقام من تطبيق المصادقة، أو رمز احتياطى.",
    authenticatorCode: "رمز المصادقة",
    mfaCodePlaceholder: "123456 أو XXXX-XXXX",
    verifyAndSignIn: "تحقّق وسجّل الدخول",
    forgotPassword: "نسيت كلمة المرور؟",
    noAccountYet: "ليس لديك حساب؟",
    createOne: "أنشئ واحدًا",
    alreadyHaveAccount: "لديك حساب بالفعل؟",
    signInLink: "تسجيل الدخول",
    sources: "المصادر",
    closeDialog: "إغلاق الحوار",
    searchConnectorsPlaceholder: "ابحث بالمعرّف أو الاسم أو الرابط…",
    allKinds: "كل الأنواع",
    apiKind: "API",
    scrapeKind: "Scrape",
    hybridKind: "Hybrid",
    allFeaturesFilter: "كل الميزات",
    disconnect: "قطع الاتصال",
    generating: "جارٍ التوليد",
    searchingWeb: "جارٍ البحث في الويب…",
    workingOnIt: "بشتغل على طلبك…",
    retry: "إعادة المحاولة",
    sidebarLabel: "الشريط الجانبي",
    settingsNavLabel: "تنقل الإعدادات",
    addLabel: "إضافة",
    micLabel: "ميكروفون",
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
