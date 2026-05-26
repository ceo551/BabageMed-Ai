#!/usr/bin/env node
// Sanity check: list MCPs that DON'T have SEARCH_URL and classify them
// by whether their tools.ts uses Scraper / fetchHtml / cheerio (= scraping) vs
// pure fetch / api (= REST-driven).
import fs from "node:fs"; import path from "node:path";
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\//, ""), "..");
// On Windows the URL-derived dirname can start with /C:/ — strip it.
const MCPS = path.resolve(process.cwd(), "mcps");

const all = fs.readdirSync(MCPS, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith("_") && !d.name.startsWith("."))
  .map((d) => d.name);

const others = [];
for (const id of all) {
  const tp = path.join(MCPS, id, "src", "tools.ts");
  if (!fs.existsSync(tp)) continue;
  const src = fs.readFileSync(tp, "utf8");
  if (/SEARCH_URL\s*=/.test(src)) continue;
  const usesScraper = /new Scraper\(/.test(src) || /scraper\.fetchHtml/.test(src) || /cheerio/.test(src);
  others.push({ id, scraping: usesScraper });
}
console.log("MCPs without SEARCH_URL: " + others.length);
console.log("  scraping-without-SEARCH_URL: " + others.filter((o) => o.scraping).length);
console.log("  api-driven (no scraping):    " + others.filter((o) => !o.scraping).length);
console.log("---scraping-without-SEARCH_URL---");
for (const o of others.filter((o) => o.scraping)) console.log("  " + o.id);
console.log("---api-driven sample---");
for (const o of others.filter((o) => !o.scraping).slice(0, 20)) console.log("  " + o.id);
