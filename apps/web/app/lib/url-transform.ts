// Safe URL transform for ReactMarkdown's `urlTransform` prop. Allows
// only `http(s):`, `mailto:`, and relative URLs through; everything
// else (javascript:, data:, chrome-extension:, file:, etc.) is stripped
// so ReactMarkdown drops the href.
//
// Extracted as a pure function for unit testability — see
// url-transform.test.ts.
export function safeUrlTransform(url: string | null | undefined): string {
  if (!url) return "";
  let u = url.trim();
  // Whitespace + control characters inside the first ~20 chars defeat
  // the scheme-prefix check by embedding a CR/LF/tab inside "javascript:"
  // — `java\nscript:alert(1)` was passing the /^https?:/ test because
  // String.prototype.trim only strips OUTER whitespace, but the
  // browser still parses the value as `javascript:`. Defang any
  // whitespace / control bytes before the prefix test.
  u = u.replace(/[\x00-\x1F\x7F]/g, "");
  // Protocol-relative `//evil.com/x` resolves to the current scheme +
  // attacker host — block it explicitly. Plain relative paths and
  // fragments are fine.
  if (u.startsWith("//")) return "";
  if (u.startsWith("#") || u.startsWith("/")) return u;
  if (/^https?:/i.test(u) || /^mailto:/i.test(u)) return u;
  return "";
}
