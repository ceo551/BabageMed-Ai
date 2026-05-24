import "./tokens.css";
import "./dashboard.css";
import { AuthProvider } from "./lib/auth-context";
import { AppShell } from "./components/AppShell";

export const metadata = {
  title: "BabageMed Ai",
  description: "BabageMed Ai — medical reasoning with 416 connected MCP servers.",
  // Point every favicon size at the brand asset shipped in /public so the
  // browser tab gets the disc mark instead of the default globe.
  icons: {
    icon:          "/babagemed-icon.png",
    shortcut:      "/babagemed-icon.png",
    apple:         "/babagemed-icon.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr" data-theme="dark">
      <head>
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
      </body>
    </html>
  );
}
