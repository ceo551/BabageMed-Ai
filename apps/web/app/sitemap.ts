import type { MetadataRoute } from "next";

const SITE_URL = "https://pervagans.com";

// Public, indexable feature verticals. These map to the dynamic route
// app/features/[slug]. "healthcare" is intentionally omitted (being removed).
const FEATURE_SLUGS = [
  "education",
  "writing",
  "translation",
  "data-analysis",
  "business",
  "financial",
  "image",
  "video",
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const featurePages: MetadataRoute.Sitemap = FEATURE_SLUGS.map((slug) => ({
    url: `${SITE_URL}/features/${slug}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  return [
    {
      url: `${SITE_URL}/`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/mcps`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    ...featurePages,
  ];
}
