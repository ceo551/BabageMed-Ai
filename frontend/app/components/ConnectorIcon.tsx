"use client";
import React, { useState } from "react";

// ConnectorIcon — render an MCP / connector's favicon with graceful fallback.
//
// Most medical-society sites ship only a tiny 16x16 favicon (or none at all).
// icon.horse returns a generic globe placeholder when it can't find a sharp
// icon, and Google's S2 endpoint just upscales whatever the site has. Both
// look terrible at 32-48 px slots, and a wall of identical placeholders
// (which is what the directory looked like before this component) is worse
// than no icon at all.
//
// Strategy:
//   1. Try the URL the backend computed (currently icon.horse).
//   2. On error, fall back to Google S2 at sz=128 — different service, sometimes
//      catches what icon.horse misses.
//   3. On error again, render a deterministic letter avatar (initial of the
//      connector name on a hue derived from the name's hash). Always crisp,
//      always distinct between connectors.

export type ConnectorIconProps = {
  name: string;
  iconUrl?: string;
  size?: number;
  /** Border-radius for the avatar fallback. Defaults to 25% of size. */
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

function s2Url(iconUrl: string | undefined): string | null {
  if (!iconUrl) return null;
  // icon.horse URLs look like https://icon.horse/icon/<host>
  // Reuse the host for the s2 fallback so we don't need to plumb a second
  // URL from the backend.
  const m = iconUrl.match(/icon\.horse\/icon\/(.+)$/i);
  if (!m) return null;
  return `https://www.google.com/s2/favicons?domain=${m[1]}&sz=128`;
}

export function ConnectorIcon({
  name, iconUrl, size = 32, radius, className = "",
}: ConnectorIconProps) {
  const [stage, setStage] = useState<0 | 1 | 2>(0);
  const fallbackUrl = s2Url(iconUrl);

  // 2 = letter avatar
  if (stage === 2 || (!iconUrl && !fallbackUrl)) {
    const init = initialOf(name);
    const hue = hash(name) % 360;
    const bg = `hsl(${hue}, 55%, 40%)`;
    const fg = `hsl(${hue}, 80%, 92%)`;
    const r = radius ?? Math.round(size * 0.25);
    return (
      <span
        className={`connector-letter-avatar ${className}`}
        aria-hidden="true"
        style={{
          width: size, height: size,
          borderRadius: r,
          background: bg,
          color: fg,
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

  const src = stage === 0 ? iconUrl : fallbackUrl!;
  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      className={className}
      style={{
        width: size,
        height: size,
        objectFit: "contain",
        borderRadius: radius ?? Math.round(size * 0.18),
        background: "color-mix(in srgb, currentColor 8%, transparent)",
        flexShrink: 0,
      }}
      onError={() => {
        // Walk to the next stage. If we're already on the s2 fallback (stage 1),
        // jump straight to the letter avatar.
        setStage((cur) => (cur === 0 && fallbackUrl ? 1 : 2));
      }}
    />
  );
}
