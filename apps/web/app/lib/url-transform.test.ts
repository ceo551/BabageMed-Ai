// URL allow-list for markdown links. This is the only line between
// user-controlled-or-LLM-rendered markdown and an XSS vector via a
// crafted `[click me](javascript:alert(1))` link. Regressions here are
// directly exploitable — fail the build.
//
// Run with: npx tsx --test app/lib/url-transform.test.ts
// (or via `npm test` once a runner is wired into apps/web)

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { safeUrlTransform } from "./url-transform";

test("allows https URLs", () => {
  assert.equal(safeUrlTransform("https://example.com"), "https://example.com");
  assert.equal(safeUrlTransform("HTTPS://Example.COM/x"), "HTTPS://Example.COM/x");
});

test("allows http URLs", () => {
  assert.equal(safeUrlTransform("http://example.com"), "http://example.com");
});

test("allows mailto", () => {
  assert.equal(safeUrlTransform("mailto:foo@example.com"), "mailto:foo@example.com");
  assert.equal(safeUrlTransform("MAILTO:foo@example.com"), "MAILTO:foo@example.com");
});

test("allows relative URLs (path + fragment)", () => {
  assert.equal(safeUrlTransform("/foo/bar"), "/foo/bar");
  assert.equal(safeUrlTransform("#anchor"), "#anchor");
});

test("blocks javascript:", () => {
  assert.equal(safeUrlTransform("javascript:alert(1)"), "");
  assert.equal(safeUrlTransform("JavaScript:alert(1)"), "");
  assert.equal(safeUrlTransform("JAVASCRIPT:alert(1)"), "");
  // With leading whitespace — must still be blocked
  assert.equal(safeUrlTransform("  javascript:alert(1)"), "");
  assert.equal(safeUrlTransform("\njavascript:alert(1)"), "");
});

test("blocks data:", () => {
  assert.equal(safeUrlTransform("data:text/html,<script>alert(1)</script>"), "");
  assert.equal(safeUrlTransform("data:image/svg+xml,<svg onload=alert(1)>"), "");
});

test("blocks vbscript:", () => {
  assert.equal(safeUrlTransform("vbscript:msgbox(1)"), "");
});

test("blocks file:", () => {
  assert.equal(safeUrlTransform("file:///etc/passwd"), "");
});

test("blocks chrome-extension:", () => {
  assert.equal(safeUrlTransform("chrome-extension://abc/foo.html"), "");
});

test("blocks browser-internal schemes", () => {
  assert.equal(safeUrlTransform("about:blank"), "");
  assert.equal(safeUrlTransform("blob:https://example.com/abc"), "");
  assert.equal(safeUrlTransform("ws://example.com"), "");
});

test("blocks empty and null", () => {
  assert.equal(safeUrlTransform(""), "");
  assert.equal(safeUrlTransform(null), "");
  assert.equal(safeUrlTransform(undefined), "");
});

test("blocks padded scheme-tricks", () => {
  // Tab character — Chrome historically resolved this. We block it.
  assert.equal(safeUrlTransform("java\tscript:alert(1)"), "");
  // Whitespace before colon (rejected by URL parser but we don't run it)
  assert.equal(safeUrlTransform(" javascript :alert(1)"), "");
});

test("blocks protocol-relative // (resolves to current scheme + host)", () => {
  // `//evil.com/x` on an https page resolves to `https://evil.com/x` —
  // an attacker-controlled URL hidden behind a markdown link.
  assert.equal(safeUrlTransform("//evil.com/path"), "");
  assert.equal(safeUrlTransform("//attacker"), "");
});
