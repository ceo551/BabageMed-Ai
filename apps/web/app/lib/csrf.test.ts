// CSRF same-origin check tests. The /api/backend/* proxy gates every
// mutating request through this — a regression here is a one-click
// account-takeover vector on any logged-in user.
//
// Run via `npm test` from apps/web/.

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { sameOrigin } from "./csrf";

test("accepts matching Origin (https)", () => {
  assert.equal(sameOrigin({ origin: "https://babagemed.com", host: "babagemed.com" }), true);
});

test("accepts matching Origin (http)", () => {
  assert.equal(sameOrigin({ origin: "http://localhost:3000", host: "localhost:3000" }), true);
});

test("rejects cross-origin Origin", () => {
  assert.equal(sameOrigin({ origin: "https://evil.com", host: "babagemed.com" }), false);
});

test("rejects Origin with port mismatch", () => {
  assert.equal(sameOrigin({ origin: "http://localhost:4000", host: "localhost:3000" }), false);
});

test("rejects Origin with scheme mismatch (http on https host)", () => {
  // Both http://host and https://host match — that's intentional for
  // dev (no TLS) AND prod (Cloudflare-terminated TLS proxying to a
  // plaintext upstream). Either scheme equality should pass.
  assert.equal(sameOrigin({ origin: "http://babagemed.com", host: "babagemed.com" }), true);
});

test("falls back to Referer when Origin missing", () => {
  assert.equal(sameOrigin({ referer: "https://babagemed.com/foo", host: "babagemed.com" }), true);
});

test("rejects cross-origin Referer", () => {
  assert.equal(sameOrigin({ referer: "https://evil.com/csrf", host: "babagemed.com" }), false);
});

test("rejects malformed Referer", () => {
  assert.equal(sameOrigin({ referer: "not a url", host: "babagemed.com" }), false);
});

test("rejects when both Origin and Referer absent", () => {
  // Real browsers always send one or the other on mutating requests.
  assert.equal(sameOrigin({ host: "babagemed.com" }), false);
});

test("rejects when host header is absent", () => {
  // A request without Host can't be validated.
  assert.equal(sameOrigin({ origin: "https://babagemed.com" }), false);
});

test("Origin takes precedence over Referer", () => {
  // If Origin is present, Referer is ignored — even a matching Referer
  // can't override a cross-origin Origin.
  assert.equal(sameOrigin({
    origin: "https://evil.com",
    referer: "https://babagemed.com/foo",
    host: "babagemed.com",
  }), false);
});

test("subdomain is treated as cross-origin (strict match)", () => {
  // api.babagemed.com vs babagemed.com is a different origin.
  assert.equal(sameOrigin({
    origin: "https://api.babagemed.com",
    host: "babagemed.com",
  }), false);
});

test("Origin with trailing path is rejected (URLs without path expected)", () => {
  // The Origin header per spec has no path. We do a literal string
  // compare so anything with a path is mis-shaped and must be rejected.
  assert.equal(sameOrigin({
    origin: "https://babagemed.com/",
    host: "babagemed.com",
  }), false);
});

test("rejects null Origin / null host edges", () => {
  assert.equal(sameOrigin({ origin: null, host: "babagemed.com" }), false);
  assert.equal(sameOrigin({ origin: "https://babagemed.com", host: null }), false);
});
