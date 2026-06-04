// Shared helper for the auth pages: read the post-auth redirect target from
// the current URL's ?next= param, rejecting anything that isn't a same-site
// relative path. This blocks the classic open-redirect where a crafted
// ?next=https://evil.example (or the //evil.example and /\evil.example
// protocol-relative variants) would forward a freshly-signed-in user off-site.
export function safeNext(raw: string | null | undefined): string {
  if (!raw) return "/";
  // Must be a single-slash absolute path. Reject //host, /\host, and any
  // value carrying a scheme or backslash.
  if (!raw.startsWith("/")) return "/";
  if (raw.startsWith("//") || raw.startsWith("/\\")) return "/";
  if (raw.includes("://") || raw.includes("\\")) return "/";
  return raw;
}

// Read + sanitise ?next from window.location. Client-only (returns "/" during
// SSR). Used instead of useSearchParams so the auth pages don't need a
// Suspense boundary to satisfy Next's static-render check.
export function readNext(): string {
  if (typeof window === "undefined") return "/";
  return safeNext(new URLSearchParams(window.location.search).get("next"));
}
