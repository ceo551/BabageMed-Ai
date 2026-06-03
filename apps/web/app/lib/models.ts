// Per-feature model registry.
//
// Two modalities:
//   - text   → 6 features (Education, Writing, Translation,
//              Data Analysis, Business, Financial). Composer
//              shows TEXT_MODELS.
//   - visual → 1 feature (Image & Video). Composer
//              shows IMAGE_MODELS + VIDEO_MODELS as two groups.
//
// The feature → modality mapping lives in apps/web/app/i18n.ts
// (FeatureMeta.modality). The composer in apps/web/app/page.tsx and
// apps/web/app/features/[slug]/page.tsx read this registry to decide
// what to render.

export type ModelBrand =
  | "anthropic" | "openai" | "google" | "zhipu"
  | "deepseek" | "alibaba" | "xai" | "kling" | "bytedance" | "happyhorse";

export type TextModel = {
  id: string;
  name: string;
  brand: ModelBrand;
  short: string;
  pills: { en: string[]; ar: string[] };
};

export type MediaModel = {
  id: string;
  name: string;
  brand: ModelBrand;
  short: string;
  kind: "image" | "video";
  pills: { en: string[]; ar: string[] };
};

// ── Text models (chat) ───────────────────────────────────────────────
// Used by every feature with modality = "text" + the main "/" dashboard
// chat. Order here is the order rendered in the picker.
export const TEXT_MODELS: ReadonlyArray<TextModel> = [
  { id: "opus-4.8",      name: "Claude Opus 4.8", brand: "anthropic", short: "Opus 4.8",
    pills: { en: ["FRONTIER", "REASONING"], ar: ["متقدّم", "استدلال"] } },
  { id: "gpt-5.5",       name: "GPT 5.5",         brand: "openai",    short: "GPT 5.5",
    pills: { en: ["VISION", "TOOLS"], ar: ["رؤية", "أدوات"] } },
  { id: "gemini-pro-3.1", name: "Gemini Pro 3.1", brand: "google",    short: "Gemini 3.1",
    pills: { en: ["LONG CTX", "IMAGING"], ar: ["سياق طويل", "تصوير"] } },
  { id: "glm-5.1",       name: "GLM 5.1",         brand: "zhipu",     short: "GLM 5.1",
    pills: { en: ["CHINESE", "AGENT"], ar: ["صينى", "وكيل"] } },
  { id: "deepseek-v4-pro", name: "DeepSeek V4 Pro", brand: "deepseek", short: "DeepSeek V4 Pro",
    pills: { en: ["CODE", "REASONING"], ar: ["كود", "استدلال"] } },
  { id: "qwen-3.7-max",  name: "Qwen 3.7 Max",    brand: "alibaba",   short: "Qwen 3.7 Max",
    pills: { en: ["MULTILINGUAL"], ar: ["متعدد اللغات"] } },
];

// ── Image models (Alibaba Model Studio / DashScope — synchronous) ────
export const IMAGE_MODELS: ReadonlyArray<MediaModel> = [
  { id: "qwen-image-2.0-pro", name: "Qwen Image 2.0 Pro", brand: "alibaba", kind: "image", short: "Qwen Image 2.0",
    pills: { en: ["PHOTO", "DESIGN"], ar: ["صورة", "تصميم"] } },
  { id: "wan2.7-image-pro", name: "Wan 2.7 Image Pro", brand: "alibaba", kind: "image", short: "Wan 2.7 Image",
    pills: { en: ["FAST"], ar: ["سريع"] } },
];

// ── Video models (Alibaba Model Studio / DashScope — async + poll) ───
export const VIDEO_MODELS: ReadonlyArray<MediaModel> = [
  { id: "happy-horse-1.0", name: "Happy Horse 1.0", brand: "happyhorse", kind: "video", short: "Happy Horse 1.0",
    pills: { en: ["TEXT→VIDEO"], ar: ["نص→فيديو"] } },
];

// ── Convenience: feature slug → models to show ──────────────────────
import type { FeatureMeta } from "../i18n";

export type ModelGroup =
  | { kind: "text"; models: ReadonlyArray<TextModel> }
  | { kind: "media"; image: ReadonlyArray<MediaModel>; video: ReadonlyArray<MediaModel> };

export function modelsForFeature(feature: FeatureMeta | null): ModelGroup {
  // Image and Video are separate features now — each shows only its own model
  // group (the picker hides an empty group).
  if (feature && feature.modality === "image") {
    return { kind: "media", image: IMAGE_MODELS, video: [] };
  }
  if (feature && feature.modality === "video") {
    return { kind: "media", image: [], video: VIDEO_MODELS };
  }
  return { kind: "text", models: TEXT_MODELS };
}

// Default model id picked when a feature page first loads (or when the
// user's persisted choice isn't valid for the current modality).
export function defaultModelId(feature: FeatureMeta | null): string {
  if (feature && feature.modality === "image") return IMAGE_MODELS[0].id;
  if (feature && feature.modality === "video") return VIDEO_MODELS[0].id;
  return TEXT_MODELS[0].id;
}

// Lookup by id across all three lists. Returns undefined if the id is
// stale (e.g. removed model).
export function findModelById(id: string): TextModel | MediaModel | undefined {
  return TEXT_MODELS.find((m) => m.id === id)
    || IMAGE_MODELS.find((m) => m.id === id)
    || VIDEO_MODELS.find((m) => m.id === id);
}
