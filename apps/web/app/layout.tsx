import type { Metadata, Viewport } from "next";
import "./tokens.css";
import "./dashboard.css";
import { AuthProvider } from "./lib/auth-context";
import { AppShell } from "./components/AppShell";
import { ServiceWorker } from "./components/ServiceWorker";
import { NavProgress } from "./components/NavProgress";

const SITE_URL = "https://pervagans.com";
const SITE_TITLE =
  "Pervagans: AI workspace with instructions, files, skills & connectors";
const SITE_DESCRIPTION =
  "Pervagans is a bilingual (EN/AR) AI assistant and workspace. Give each workflow its own instructions, files, skills and MCP connectors, then chat to get work done.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: "%s · Pervagans",
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "Pervagans",
    "AI assistant",
    "AI workspace",
    "MCP connectors",
    "Model Context Protocol",
    "productivity AI",
    "AI workflows",
    "AI agent",
    "bilingual AI",
    "Arabic AI",
  ],
  applicationName: "Pervagans",
  authors: [{ name: "Pervagans", url: SITE_URL }],
  creator: "Pervagans",
  publisher: "Pervagans",
  category: "technology",
  manifest: "/manifest.webmanifest",
  formatDetection: { telephone: false, address: false, email: false },
  // Point every favicon size at the brand asset shipped in /public so the
  // browser tab gets the disc mark instead of the default globe.
  icons: {
    icon:     "/pervagans-icon.png",
    shortcut: "/pervagans-icon.png",
  },
  alternates: {
    canonical: "/",
    languages: {
      en: "/",
      ar: "/",
      "x-default": "/",
    },
  },
  openGraph: {
    type: "website",
    siteName: "Pervagans",
    url: SITE_URL,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    locale: "en_US",
    alternateLocale: ["ar_AR"],
    images: [
      {
        url: "/pervagans-icon.png",
        width: 512,
        height: 512,
        alt: "Pervagans",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ["/pervagans-icon.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
  themeColor: "#0a0c10",
  colorScheme: "dark" as const,
};

// Pre-paint locale + theme bootstrap. SSR can't see localStorage, so
// without this script the first paint always renders `lang="en"
// dir="ltr" data-theme="dark"` — Arabic users get a left-to-right
// flash and the dir flip on mount causes a measurable layout shift.
// Light-theme users get a dark flash on every navigation. Running
// this *before* React hydrates sets <html> to the user's choice so
// the server-rendered HTML and the client's first render agree
// (the React tree itself stays SSR-friendly because we don't read
// localStorage during render — only this inline IIFE does, before
// the React root mounts).
const PRE_PAINT_SCRIPT = `(function(){
  try {
    // Locale + theme are persisted as raw strings under their own keys by
    // ui-context.tsx (LS_LOCALE="pervagans:locale", LS_THEME="pervagans:theme").
    // The previous version read them off the "pervagans:prefs" JSON object
    // (which only holds model/mode/draft) → p.locale/p.theme were always
    // undefined, so this script silently did nothing and the RTL/theme
    // flash it exists to prevent persisted on every load.
    var locale = localStorage.getItem("pervagans:locale") || "en";
    var theme = localStorage.getItem("pervagans:theme") || "system";
    if (theme === "system") {
      theme = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    }
    var d = document.documentElement;
    d.lang = locale;
    d.dir = locale === "ar" ? "rtl" : "ltr";
    d.setAttribute("data-theme", theme);
  } catch (e) { /* incognito / disabled storage → defaults stand */ }
})();`;

// schema.org structured data (Organization + WebSite + SoftwareApplication).
// Rendered server-side from the root layout so crawlers see it in the initial
// HTML — this is what powers rich results (logo, app card, price) in Google.
const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://pervagans.com/#organization",
      name: "Pervagans",
      url: "https://pervagans.com",
      logo: "https://pervagans.com/pervagans-icon.png",
      description:
        "Pervagans is a bilingual (EN/AR) AI assistant and workspace. Chat with leading AI models and ground every workflow in your own instructions, files, skills and connectors.",
    },
    {
      "@type": "WebSite",
      "@id": "https://pervagans.com/#website",
      name: "Pervagans",
      url: "https://pervagans.com",
      inLanguage: ["en", "ar"],
      publisher: { "@id": "https://pervagans.com/#organization" },
    },
    {
      "@type": "SoftwareApplication",
      "@id": "https://pervagans.com/#app",
      name: "Pervagans",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web, Windows, macOS",
      url: "https://pervagans.com",
      description:
        "A bilingual AI assistant and workspace. Chat with Claude, GPT and Gemini, build Spaces with custom instructions, files, skills and MCP connectors, generate images and video, run deep research, and automate multi-step tasks with Agent Mode.",
      inLanguage: ["en", "ar"],
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
        description: "Free plan available; paid plans for higher usage.",
      },
      featureList: [
        "Chat with leading AI models (Claude, GPT, Gemini, and more)",
        "Per-workspace instructions, files, skills and connectors",
        "AI image and video generation",
        "Deep research with cited sources",
        "Agent Mode for multi-step tasks",
        "Bilingual English and Arabic",
      ],
      publisher: { "@id": "https://pervagans.com/#organization" },
    },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // suppressHydrationWarning on <html> tells React it's expected for
  // the pre-paint script to have mutated lang/dir/data-theme before
  // hydration; otherwise the dev console fills with mismatch warnings
  // even though the runtime behaviour is correct.
  return (
    <html lang="en" dir="ltr" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: PRE_PAINT_SCRIPT }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700&family=Amiri:ital@0;1&display=swap"
        />
      </head>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />
        <NavProgress />
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
        <ServiceWorker />
      </body>
    </html>
  );
}
