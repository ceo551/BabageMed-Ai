// Safe URL transform for ReactMarkdown's `urlTransform` prop. Allows
// only `http(s):`, `mailto:`, and relative URLs through; everything
// else (javascript:, data:, chrome-extension:, file:, etc.) is stripped
// so ReactMarkdown drops the href.
//
// Extracted as a pure function for unit testability — see
// url-transform.test.ts.
export function safeUrlTransform(url: string | null | undefined): string {
  if (!url) return "";
  const u = url.trim();
  // Protocol-relative `//evil.com/x` resolves to the current scheme +
  // attacker host — block it explicitly. Plain relative paths and
  // fragments are fine.
  if (u.startsWith("//")) return "";
  if (u.startsWith("#") || u.startsWith("/")) return u;
  if (/^https?:/i.test(u) || /^mailto:/i.test(u)) return u;
  return "";
}
