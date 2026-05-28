import "./tokens.css";
import "./dashboard.css";
import { AuthProvider } from "./lib/auth-context";
import { AppShell } from "./components/AppShell";
import { ServiceWorker } from "./components/ServiceWorker";

export const metadata = {
  title: "Babbage AI",
  description: "Babbage AI — instructions, files, skills and connectors per workflow.",
  applicationName: "Babbage AI",
  manifest: "/manifest.webmanifest",
  formatDetection: { telephone: false, address: false, email: false },
  // Point every favicon size at the brand asset shipped in /public so the
  // browser tab gets the disc mark instead of the default globe.
  icons: {
    icon:     "/babagemed-icon.png",
    shortcut: "/babagemed-icon.png",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
  themeColor: "#0a0a0c",
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
    var p = JSON.parse(localStorage.getItem("babagemed:prefs") || "null");
    var locale = (p && p.locale) || "en";
    var theme = (p && p.theme) || "system";
    if (theme === "system") {
      theme = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    }
    var d = document.documentElement;
    d.lang = locale;
    d.dir = locale === "ar" ? "rtl" : "ltr";
    d.setAttribute("data-theme", theme);
  } catch (e) { /* incognito / disabled storage → defaults stand */ }
})();`;

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
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
        <ServiceWorker />
      </body>
    </html>
  );
}
