import { strict as assert } from "node:assert";
import { test } from "node:test";
import { TtlCache } from "./cache.js";

test("get returns undefined for missing key", () => {
  const c = new TtlCache<string>();
  assert.equal(c.get("missing"), undefined);
});

test("set + get round-trip", () => {
  const c = new TtlCache<string>();
  c.set("k", "v");
  assert.equal(c.get("k"), "v");
});

test("expired entries return undefined", async () => {
  const c = new TtlCache<string>(0.05); // 50 ms TTL
  c.set("k", "v");
  await new Promise((r) => setTimeout(r, 60));
  assert.equal(c.get("k"), undefined);
});

test("explicit per-call TTL overrides default", async () => {
  const c = new TtlCache<string>(60); // 60 s default
  c.set("k", "v", 0.05); // 50 ms override
  await new Promise((r) => setTimeout(r, 60));
  assert.equal(c.get("k"), undefined);
});

test("LRU eviction: cap evicts least-recently-USED key, not FIFO", () => {
  const c = new TtlCache<string>(60, 3); // cap = 3
  c.set("a", "A");
  c.set("b", "B");
  c.set("c", "C");
  // Touch "a" — it should now be most recently used.
  c.get("a");
  // Insert "d" — cap is 3, so the LRU key (which is now "b") must go.
  c.set("d", "D");
  assert.equal(c.get("a"), "A", "a was just touched; must survive");
  assert.equal(c.get("b"), undefined, "b was the LRU; must be evicted");
  assert.equal(c.get("c"), "C");
  assert.equal(c.get("d"), "D");
});

test("set overwrites preserve recency", () => {
  const c = new TtlCache<string>(60, 3);
  c.set("a", "A1");
  c.set("b", "B");
  c.set("c", "C");
  c.set("a", "A2"); // overwrite → recent
  c.set("d", "D"); // evicts LRU
  assert.equal(c.get("a"), "A2");
  // The LRU should be "b" now (oldest untouched after a's overwrite).
  assert.equal(c.get("b"), undefined);
});

test("expired-sweep frees room before evicting live entries", async () => {
  const c = new TtlCache<string>(60, 3);
  c.set("expire1", "x", 0.05);
  c.set("expire2", "x", 0.05);
  c.set("alive", "y"); // default TTL = 60 s
  await new Promise((r) => setTimeout(r, 60));
  // Now expire1 + expire2 are expired but still counted toward cap.
  c.set("new", "n"); // would have evicted "alive" under naive FIFO
  assert.equal(c.get("alive"), "y", "live entry must survive — expired ones swept first");
  assert.equal(c.get("new"), "n");
});

test("wrap: only one upstream call for duplicate keys", async () => {
  const c = new TtlCache<number>();
  let calls = 0;
  const fn = async () => {
    calls++;
    return 42;
  };
  await c.wrap("k", fn);
  await c.wrap("k", fn);
  await c.wrap("k", fn);
  assert.equal(calls, 1);
});

test("wrap: distinct keys → distinct calls", async () => {
  const c = new TtlCache<number>();
  let calls = 0;
  const fn = async () => {
    calls++;
    return calls;
  };
  const a = await c.wrap("a", fn);
  const b = await c.wrap("b", fn);
  assert.equal(a, 1);
  assert.equal(b, 2);
  assert.equal(calls, 2);
});
