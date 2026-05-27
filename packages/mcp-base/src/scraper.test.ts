// SSRF allow-list tests for Scraper. These are the cheapest defense
// against an MCP's public `fetch` tool being used to pivot into cloud
// metadata, the kube control plane, or another pod's localhost — so
// regressions here MUST fail the build.
//
// Run with: npm test (from packages/mcp-base/)

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { Scraper } from "./scraper.js";

// Helper: build a Scraper without actually launching anything.
function newScraper(opts: Partial<ConstructorParameters<typeof Scraper>[0]> = {}) {
  return new Scraper({
    base: "https://example.com",
    ...opts,
  });
}

test("rejects loopback IPv4 (127.0.0.1)", () => {
  const s = newScraper({ allowedHosts: ["*"] });
  assert.throws(() => s.validateUrl("http://127.0.0.1:8080/"), /forbidden host/i);
  assert.throws(() => s.validateUrl("http://127.1.2.3/"), /forbidden host/i);
});

test("rejects link-local 169.254.* (AWS / GCP metadata)", () => {
  const s = newScraper({ allowedHosts: ["*"] });
  assert.throws(() => s.validateUrl("http://169.254.169.254/latest/meta-data/"), /forbidden host/i);
});

test("rejects RFC1918 private ranges", () => {
  const s = newScraper({ allowedHosts: ["*"] });
  for (const ip of ["http://10.0.0.1/", "http://192.168.1.1/", "http://172.16.5.5/", "http://172.31.99.99/"]) {
    assert.throws(() => s.validateUrl(ip), /forbidden host/i, `should reject ${ip}`);
  }
});

test("rejects CGNAT 100.64-100.127", () => {
  const s = newScraper({ allowedHosts: ["*"] });
  assert.throws(() => s.validateUrl("http://100.64.0.1/"), /forbidden host/i);
});

test("rejects IPv6 loopback / link-local / ULA", () => {
  const s = newScraper({ allowedHosts: ["*"] });
  assert.throws(() => s.validateUrl("http://[::1]/"), /forbidden host/i);
  assert.throws(() => s.validateUrl("http://[fe80::1]/"), /forbidden host/i);
  assert.throws(() => s.validateUrl("http://[fc00::1]/"), /forbidden host/i);
});

test("rejects Kubernetes / mDNS internal hostnames", () => {
  const s = newScraper({ allowedHosts: ["*"] });
  for (const h of [
    "http://kubernetes.default.svc.cluster.local/",
    "http://my-service.namespace.svc/",
    "http://printer.local/",
    "http://metadata.internal/",
  ]) {
    assert.throws(() => s.validateUrl(h), /forbidden host/i, `should reject ${h}`);
  }
});

test("rejects bare 'localhost' literal", () => {
  const s = newScraper({ allowedHosts: ["*"] });
  assert.throws(() => s.validateUrl("http://localhost:9090/"), /forbidden host/i);
});

test("rejects non-http(s) schemes (file://, ftp://, gopher://)", () => {
  const s = newScraper({ allowedHosts: ["*"] });
  assert.throws(() => s.validateUrl("file:///etc/passwd"), /forbidden scheme|invalid url/i);
  assert.throws(() => s.validateUrl("ftp://example.com/"), /forbidden scheme/i);
  assert.throws(() => s.validateUrl("gopher://example.com/"), /forbidden scheme/i);
});

test("rejects malformed URLs", () => {
  const s = newScraper({ allowedHosts: ["*"] });
  assert.throws(() => s.validateUrl("not a url"), /invalid url/i);
  assert.throws(() => s.validateUrl(""), /invalid url/i);
});

test("default allow-list scopes to base hostname only", () => {
  // No explicit allowedHosts → derived from `base`.
  const s = newScraper({ base: "https://example.com" });
  // Same host: OK.
  assert.doesNotThrow(() => s.validateUrl("https://example.com/path"));
  // Subdomain of allowed: OK.
  assert.doesNotThrow(() => s.validateUrl("https://api.example.com/v1"));
  // Unrelated host: blocked.
  assert.throws(() => s.validateUrl("https://attacker.com/"), /host not in scraper allow-list/i);
});

test("subdomain match doesn't accept attacker-prefix (regression for endsWith bug)", () => {
  const s = newScraper({ base: "https://example.com" });
  // "evilexample.com" must NOT match "example.com" via .endsWith.
  assert.throws(
    () => s.validateUrl("https://evilexample.com/"),
    /host not in scraper allow-list/i,
    "prefix-confusion: evilexample.com should NOT pass example.com allow-list",
  );
});

test('explicit allowedHosts:["*"] bypasses allow-list (but still blocks forbidden hosts)', () => {
  const s = newScraper({ allowedHosts: ["*"] });
  assert.doesNotThrow(() => s.validateUrl("https://example.org/"));
  // Even with "*" the FORBIDDEN_HOST_PATTERNS layer must still block.
  assert.throws(() => s.validateUrl("http://127.0.0.1/"), /forbidden host/i);
});

test("multiple allowed hosts with subdomain matching", () => {
  const s = newScraper({ base: "https://api.example.com", allowedHosts: ["example.com", "api.example.com"] });
  assert.doesNotThrow(() => s.validateUrl("https://example.com/"));
  assert.doesNotThrow(() => s.validateUrl("https://api.example.com/"));
  assert.doesNotThrow(() => s.validateUrl("https://docs.example.com/"));
  assert.throws(() => s.validateUrl("https://other.org/"), /host not in scraper allow-list/i);
});
