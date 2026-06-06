import type { MetadataRoute } from "next";
import { MODELS } from "./(marketing)/models/catalog";
import { EFFECTS } from "./(marketing)/effects/catalog";
import { USE_CASES } from "./(marketing)/use-cases/catalog";

const SITE_URL = "https://pervagans.com";

// Only PUBLIC, crawlable pages belong in the sitemap. The app surfaces
// (/mcps, /features/*, /spaces, …) sit behind the login gate (middleware.ts) —
// listing them made Google fetch them, hit the 307 → /login redirect, and
// report "Page with redirect" errors. They're intentionally excluded.
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const page = (
    path: string,
    priority: number,
    changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"],
  ): MetadataRoute.Sitemap[number] => ({
    url: `${SITE_URL}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
  });

  return [
    page("/", 1.0, "weekly"),         // home / app entry (public anon trial)
    page("/product", 0.9, "weekly"),    // flagship product/marketing page
    page("/pricing", 0.9, "weekly"),    // plans
    page("/models", 0.9, "weekly"),     // models directory (aggregator surface)
    // One programmatic landing page per model — the long-tail SEO surface.
    ...MODELS.map((m) => page(`/models/${m.slug}`, 0.7, "weekly")),
    // Arabic (RTL) variant of the models surface — the MENA long tail.
    page("/ar/models", 0.9, "weekly"),
    ...MODELS.map((m) => page(`/ar/models/${m.slug}`, 0.7, "weekly")),
    // Effects library (one-tap presets) — EN + AR.
    page("/effects", 0.9, "weekly"),
    ...EFFECTS.map((e) => page(`/effects/${e.slug}`, 0.7, "weekly")),
    page("/ar/effects", 0.9, "weekly"),
    ...EFFECTS.map((e) => page(`/ar/effects/${e.slug}`, 0.7, "weekly")),
    page("/use-cases", 0.8, "weekly"),  // use-case / audience landing (EN index)
    ...USE_CASES.map((u) => page(`/use-cases/${u.slug}`, 0.7, "weekly")),
    page("/ar/use-cases", 0.8, "weekly"),
    ...USE_CASES.map((u) => page(`/ar/use-cases/${u.slug}`, 0.7, "weekly")),
    page("/about", 0.7, "monthly"),     // about
    page("/company", 0.6, "monthly"),   // company hub (links the marketing pages)
    page("/try", 0.6, "weekly"),        // zero-login trial
    page("/privacy", 0.4, "yearly"),    // privacy policy
    page("/terms", 0.4, "yearly"),      // terms of service
    page("/refund", 0.4, "yearly"),     // refund policy
  ];
}
