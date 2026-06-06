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
  { id: "sonnet-4.6",    name: "Claude Sonnet 4.6", brand: "anthropic", short: "Sonnet 4.6",
    pills: { en: ["FAST", "BALANCED"], ar: ["سريع", "متوازن"] } },
  { id: "gpt-5.5",       name: "GPT 5.5",         brand: "openai",    short: "GPT 5.5",
    pills: { en: ["VISION", "TOOLS"], ar: ["رؤية", "أدوات"] } },
  { id: "gpt-5.4",       name: "GPT 5.4",         brand: "openai",    short: "GPT 5.4",
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
  { id: "gpt-image-2", name: "GPT Image 2", brand: "openai", kind: "image", short: "GPT Image 2",
    pills: { en: ["PHOTOREAL", "EDIT"], ar: ["واقعي", "تعديل"] } },
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

// ── Plan → unlocked models (MIRROR of backend internal/billing/plans.go) ──────
// Cumulative tiers. Keep in sync with the backend (the backend is the real gate;
// this drives the lock icons in the model picker). Prices: Go $20 / Plus $40 /
// Pro $70 / Max $100; Free is the no-card trial.
const GO_MODELS = ["deepseek-v4-pro", "glm-5.1", "qwen-3.7-max"];
const PLUS_MODELS = [...GO_MODELS, "gemini-pro-3.1", "wan2.7-image-pro", "qwen-image-2.0-pro"];
const PRO_MODELS = [...PLUS_MODELS, "sonnet-4.6", "gpt-5.4", "gpt-image-2", "happy-horse-1.0"];
const MAX_MODELS = [...PRO_MODELS, "opus-4.8", "gpt-5.5"];

export const PLAN_ORDER = ["free", "go", "plus", "pro", "max"] as const;
export const PLAN_MODELS: Record<string, readonly string[]> = {
  free: GO_MODELS, // free trial = the Go text models, small credit grant
  go: GO_MODELS,
  plus: PLUS_MODELS,
  pro: PRO_MODELS,
  max: MAX_MODELS,
};

const ALL_GATED = new Set(MAX_MODELS); // every id that appears in some plan

// planAllowsModel: does this plan unlock the model? Unknown ids (not in any
// plan) pass through, matching the backend's fail-open behaviour.
export function planAllowsModel(plan: string | undefined, id: string): boolean {
  if (!ALL_GATED.has(id)) return true;
  const list = PLAN_MODELS[(plan || "free").toLowerCase()] || PLAN_MODELS.free;
  return list.includes(id);
}

// minPlanFor: the lowest plan that unlocks a model (for "upgrade to X" copy).
export function minPlanFor(id: string): string | null {
  for (const p of PLAN_ORDER) if ((PLAN_MODELS[p] || []).includes(id)) return p;
  return null;
}
