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
//
// We deliberately prefer logo.clearbit.com URLs over hand-picked Wikimedia
// paths because:
//   * Clearbit's logo CDN doesn't randomly 404 when a path is renamed
//     (the Mayo / Cleveland / NEJM Wikimedia URLs in the first pass were
//     either wrong or served black-text-on-transparent SVGs that vanished
//     against the dark UI).
//   * Clearbit returns a single, predictable raster crop sized for icons.
// For the handful of cases Clearbit doesn't know (the Wikimedia logos for
// Google's product icons are nicer than Clearbit's), we leave an explicit
// override.
const OVERRIDES: Record<string, string> = {
  // Google product icons — Wikimedia hosts the official multicolour SVGs.
  gmail:        "https://upload.wikimedia.org/wikipedia/commons/7/7e/Gmail_icon_%282020%29.svg",
  gcalendar:    "https://upload.wikimedia.org/wikipedia/commons/a/a5/Google_Calendar_icon_%282020%29.svg",
  gdrive:       "https://upload.wikimedia.org/wikipedia/commons/1/12/Google_Drive_icon_%282020%29.svg",
  googlescholar:"https://upload.wikimedia.org/wikipedia/commons/c/c7/Google_Scholar_logo.svg",

  // Big-name medical brands — go through Clearbit so we get a real raster
  // logo even when the brand's own site only ships a tiny favicon.
  mayoclinic:      "https://logo.clearbit.com/mayoclinic.org",
  clevelandclinic: "https://logo.clearbit.com/clevelandclinic.org",
  who:             "https://logo.clearbit.com/who.int",
  cdc:             "https://logo.clearbit.com/cdc.gov",
  fda:             "https://logo.clearbit.com/fda.gov",
  nih:             "https://logo.clearbit.com/nih.gov",
  ncbi:            "https://logo.clearbit.com/ncbi.nlm.nih.gov",
  pubmed:          "https://logo.clearbit.com/pubmed.ncbi.nlm.nih.gov",
  nccn:            "https://logo.clearbit.com/nccn.org",
  bmj:             "https://logo.clearbit.com/bmj.com",
  nejm:            "https://logo.clearbit.com/nejm.org",
  lancet:          "https://logo.clearbit.com/thelancet.com",
  jamanetwork:     "https://logo.clearbit.com/jamanetwork.com",
  medscape:        "https://logo.clearbit.com/medscape.com",
  webmd:           "https://logo.clearbit.com/webmd.com",
  healthline:      "https://logo.clearbit.com/healthline.com",
  drugscom:        "https://logo.clearbit.com/drugs.com",

  // Productivity tools — vendor CDNs (or Clearbit) all serve canonical marks.
  github:       "https://github.githubassets.com/assets/GitHub-Mark-ea2971cee799.png",
  slack:        "https://logo.clearbit.com/slack.com",
  notion:       "https://logo.clearbit.com/notion.so",
  linkedin:     "https://logo.clearbit.com/linkedin.com",
  huggingface:  "https://huggingface.co/front/assets/huggingface_logo-noborder.svg",
  kaggle:       "https://logo.clearbit.com/kaggle.com",
  hostinger:    "https://logo.clearbit.com/hostinger.com",
  ms365:        "https://logo.clearbit.com/microsoft.com",
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
        // Light backdrop + tiny inset padding so dark-text logos (Mayo, NEJM,
        // Slack-style monochromes that are transparent black on transparent
        // background) stay visible on the app's dark UI.
        background: "#ffffff",
        padding: Math.max(2, Math.round(size * 0.08)),
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
