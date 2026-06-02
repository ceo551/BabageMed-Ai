// Per-feature page metadata. The page.tsx is "use client" so it can't
// export generateMetadata directly — the layout is server-side and the
// only place Next.js will run our title resolver on a dynamic route.
//
// Title source mirrors the i18n FEATURES_EN labels (server-side; the
// locale switch lives client-side only, so the OG title falls back to
// English which matches our public marketing).
import type { Metadata } from "next";

const TITLES: Record<string, string> = {
  "education":      "Education & Academic & Research",
  "writing":        "Writing & Content creation",
  "translation":    "Translation & Languages",
  "data-analysis":  "Data Analysis",
  "business":       "Business",
  "financial":      "Financial Services",
  "consulting":     "Consulting & Professional Services",
  "image-video":    "Image & Video",
  "advertisements": "Advertisements",
};

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params;
  const label = TITLES[slug] || "Feature";
  return {
    title: `${label} — Pervagans`,
    description: `Pervagans workspace for ${label.toLowerCase()}.`,
  };
}

export default function FeatureLayout({ children }: { children: React.ReactNode }) {
  return children;
}
