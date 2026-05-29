// @hand-edited — do not regenerate via write-real-tools.mjs
import { z, McpServer, Scraper } from "@babbage/mcp-base";

// `allowedHosts: ["*"]` is intentional and dangerous — this MCP is meant
// for cross-origin browse-as-a-service. We rely on the Scraper's built-in
// FORBIDDEN_HOST_PATTERNS to still block link-local / loopback / RFC1918
// (i.e. metadata services, internal kube DNS, localhost ports). Without
// that base-class guard this tool would be a trivial SSRF pivot.
const scraper = new Scraper({
  base: "about:blank",
  rps: 2,
  headless: (process.env.SCRAPER_HEADLESS ?? "true") !== "false",
  proxyUrl: process.env.SCRAPER_PROXY_URL || undefined,
  respectRobots: false,
  allowedHosts: ["*"],
});

export function registerTools(server: McpServer) {
  server.tool({
    name: "browse",
    description: "Open a URL in a real Chromium browser and return rendered HTML + text.",
    input: z.object({ url: z.string().url() }),
    handler: async ({ url }) => {
      const r = await scraper.fetchHtml(url, { browser: true, cache: false });
      const $ = r.$;
      $("script,style").remove();
      return { url: r.url, status: r.status, title: $("title").text(), text: $("body").text().replace(/\s+/g, " ").trim().slice(0, 20000) };
    },
  });

  server.tool({
    name: "screenshot",
    description: "Open a URL and return a PNG (base64).",
    input: z.object({ url: z.string().url(), fullPage: z.boolean().optional() }),
    handler: async ({ url, fullPage = false }) => {
      // Reuse the shared Scraper's context instead of launching a fresh
      // Chromium per call. Each launch() previously cost ~150 MB RAM +
      // ~20 FDs; even a handful of concurrent callers exhausted the pod.
      // The host allow-list inside fetchHtml is also re-applied via
      // the explicit assert below.
      scraper.validateUrl(url);
      const page = await scraper.newPage();
      try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
        const buf = await page.screenshot({ fullPage });
        return { url, image: buf.toString("base64"), mime: "image/png" };
      } finally {
        await page.close().catch(() => {});
      }
    },
  });

  server.tool({
    name: "extract",
    description: "Extract text matching a CSS selector from a page.",
    input: z.object({ url: z.string().url(), selector: z.string() }),
    handler: async ({ url, selector }) => {
      const r = await scraper.fetchHtml(url, { browser: true });
      const items: string[] = [];
      r.$(selector).each((_, el) => { items.push(r.$(el).text().trim()); });
      return { url, selector, items };
    },
  });

  server.tool({
    name: "click",
    description: "Open a URL, click a selector, return resulting URL+text.",
    input: z.object({ url: z.string().url(), selector: z.string() }),
    handler: async ({ url, selector }) => {
      scraper.validateUrl(url);
      const page = await scraper.newPage();
      try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
        await page.click(selector, { timeout: 10000 });
        await page.waitForLoadState("domcontentloaded");
        return { url: page.url(), text: (await page.textContent("body"))?.slice(0, 5000) ?? "" };
      } finally {
        await page.close().catch(() => {});
      }
    },
  });
}
