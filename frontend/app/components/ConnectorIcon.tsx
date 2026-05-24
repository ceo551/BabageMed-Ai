"use client";
import React, { useMemo, useState } from "react";

// ConnectorIcon — render an MCP / connector's favicon with graceful fallback.
//
// The hard reality of medical-society favicons:
//   * Most sites only ship a 16x16 .ico.
//   * icon.horse and Google S2 BOTH respond 200-OK with a generic globe
//     placeholder for sites they can't crawl, so an onError chain isn't
//     enough — we also need a "did this image even load anything useful?"
//     check.
//   * A handful of well-known providers (Mayo, Google, FDA, PubMed…) deserve
//     a hard-coded high-resolution logo so they look right immediately.
//
// Strategy now:
//   1. If `id` matches an entry in OVERRIDES, use that hardcoded URL.
//   2. Otherwise try iconUrl (icon.horse via the backend).
//   3. On error OR if the loaded image is smaller than MIN_NATURAL,
//      try Google S2 at sz=128 (different scraper).
//   4. Same check after that — if it's also tiny, render a deterministic
//      coloured letter avatar so each connector still ends up visually
//      distinct on a 416-card wall.

// Anything smaller than this on its natural side is either a 16-32 px
// favicon (visually useless in a 36-56 px slot) OR a stock placeholder
// served back by a failing favicon scraper. Either way: treat as a miss
// and fall through to the next source.
const MIN_NATURAL = 48;

// High-quality canonical logos for the providers the user singled out plus a
// few obvious "must look right" brands. Keys match the MCP id (lower-case)
// from scripts/mcps.manifest.json.
const OVERRIDES: Record<string, string> = {
  // Google-family services — these always serve well from gstatic / wikimedia
  // and the favicon services miss them.
  gmail:        "https://upload.wikimedia.org/wikipedia/commons/7/7e/Gmail_icon_%282020%29.svg",
  gcalendar:    "https://upload.wikimedia.org/wikipedia/commons/a/a5/Google_Calendar_icon_%282020%29.svg",
  gdrive:       "https://upload.wikimedia.org/wikipedia/commons/1/12/Google_Drive_icon_%282020%29.svg",
  googlescholar:"https://upload.wikimedia.org/wikipedia/commons/c/c7/Google_Scholar_logo.svg",

  // Big-name medical brands the favicon scrapers struggle with.
  mayoclinic:   "https://upload.wikimedia.org/wikipedia/commons/c/c0/Mayo_Clinic_logo.svg",
  clevelandclinic: "https://upload.wikimedia.org/wikipedia/commons/d/d6/Cleveland_Clinic_logo.svg",
  who:          "https://upload.wikimedia.org/wikipedia/commons/d/d7/Flag_of_WHO.svg",
  cdc:          "https://upload.wikimedia.org/wikipedia/commons/3/35/US_CDC_logo.svg",
  fda:          "https://upload.wikimedia.org/wikipedia/commons/3/3d/Food_and_Drug_Administration_logo.svg",
  nih:          "https://upload.wikimedia.org/wikipedia/commons/4/4a/US-NIH-NLM-NCBI-Logo.svg",
  ncbi:         "https://upload.wikimedia.org/wikipedia/commons/4/4a/US-NIH-NLM-NCBI-Logo.svg",
  pubmed:       "https://upload.wikimedia.org/wikipedia/commons/4/4a/US-NIH-NLM-NCBI-Logo.svg",
  nccn:         "https://www.nccn.org/Images/global/header/logo.png",
  bmj:          "https://upload.wikimedia.org/wikipedia/commons/4/45/BMJ_Group_Logo.svg",
  nejm:         "https://upload.wikimedia.org/wikipedia/commons/5/5c/NEJM_logo.svg",
  lancet:       "https://upload.wikimedia.org/wikipedia/commons/d/dc/The_Lancet_logo.svg",
  nature:       "https://upload.wikimedia.org/wikipedia/commons/8/80/Nature_logo.svg",
  jamanetwork:  "https://upload.wikimedia.org/wikipedia/commons/9/9e/JAMA_Network_logo.svg",
  medscape:     "https://upload.wikimedia.org/wikipedia/commons/2/23/Medscape_logo.svg",

  // Productivity tools.
  github:       "https://github.githubassets.com/assets/GitHub-Mark-ea2971cee799.png",
  slack:        "https://upload.wikimedia.org/wikipedia/commons/d/d5/Slack_icon_2019.svg",
  notion:       "https://upload.wikimedia.org/wikipedia/commons/4/45/Notion_app_logo.png",
  linkedin:     "https://upload.wikimedia.org/wikipedia/commons/c/ca/LinkedIn_logo_initials.png",
  huggingface:  "https://huggingface.co/front/assets/huggingface_logo-noborder.svg",
  kaggle:       "https://upload.wikimedia.org/wikipedia/commons/7/7c/Kaggle_logo.png",
  hostinger:    "https://www.hostinger.com/assets/icons/icon-256x256.png",
  ms365:        "https://upload.wikimedia.org/wikipedia/commons/0/0e/Microsoft_365_%282022%29.svg",
};

export type ConnectorIconProps = {
  /** Connector / MCP id — used to look up the overrides table. */
  id?: string;
  /** Display name — drives the letter avatar fallback. */
  name: string;
  /** Backend-supplied URL (today: icon.horse). */
  iconUrl?: string;
  size?: number;
  /** Border-radius for the avatar / image. Defaults to 25% of size. */
  radius?: number;
  className?: string;
};

function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function initialOf(name: string): string {
  const c = name.trim()[0];
  if (!c) return "?";
  return c.toUpperCase();
}

function hostFrom(iconUrl: string | undefined): string | null {
  if (!iconUrl) return null;
  const m = iconUrl.match(/icon\.horse\/icon\/(.+)$/i);
  if (!m) return null;
  return m[1];
}

function s2Url(iconUrl: string | undefined): string | null {
  const host = hostFrom(iconUrl);
  return host ? `https://www.google.com/s2/favicons?domain=${host}&sz=128` : null;
}

// Clearbit Logo (now part of HubSpot) keeps an open-access logo CDN for
// most "real" brands at https://logo.clearbit.com/<domain>. It serves
// vector / high-res raster and 404s cleanly when it doesn't know a domain.
// So: cheap to try, free to fail.
function clearbitUrl(iconUrl: string | undefined): string | null {
  const host = hostFrom(iconUrl);
  return host ? `https://logo.clearbit.com/${host}` : null;
}

export function ConnectorIcon({
  id, name, iconUrl, size = 32, radius, className = "",
}: ConnectorIconProps) {
  // Build the ordered list of candidate URLs once per render.
  // Priority: manual override → Clearbit (real brand logos) → icon.horse
  // (whatever was scraped) → Google S2 at 128 px → letter avatar.
  const sources = useMemo(() => {
    const out: string[] = [];
    if (id && OVERRIDES[id.toLowerCase()]) out.push(OVERRIDES[id.toLowerCase()]);
    const cb = clearbitUrl(iconUrl);
    if (cb) out.push(cb);
    if (iconUrl) out.push(iconUrl);
    const s2 = s2Url(iconUrl);
    if (s2) out.push(s2);
    return out;
  }, [id, iconUrl]);

  const [stage, setStage] = useState(0);

  // Past the last source → letter avatar.
  if (stage >= sources.length) {
    const init = initialOf(name);
    const hue = hash(name) % 360;
    const r = radius ?? Math.round(size * 0.25);
    return (
      <span
        className={`connector-letter-avatar ${className}`}
        aria-hidden="true"
        style={{
          width: size, height: size,
          borderRadius: r,
          background: `hsl(${hue}, 55%, 40%)`,
          color: `hsl(${hue}, 80%, 92%)`,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 700,
          fontSize: Math.round(size * 0.46),
          lineHeight: 1,
          flexShrink: 0,
        }}
      >
        {init}
      </span>
    );
  }

  return (
    <img
      key={stage} // force a fresh <img> when stage advances so onError fires again
      src={sources[stage]}
      alt=""
      width={size}
      height={size}
      className={className}
      referrerPolicy="no-referrer"
      style={{
        width: size,
        height: size,
        objectFit: "contain",
        borderRadius: radius ?? Math.round(size * 0.18),
        background: "color-mix(in srgb, currentColor 6%, transparent)",
        flexShrink: 0,
      }}
      onLoad={(e) => {
        // Detect the "loaded a tiny placeholder" case — icon.horse and S2 both
        // happily 200-OK with a generic globe in this situation.
        const img = e.currentTarget;
        if (img.naturalWidth > 0 && img.naturalWidth < MIN_NATURAL) {
          setStage((s) => s + 1);
        }
      }}
      onError={() => setStage((s) => s + 1)}
    />
  );
}
