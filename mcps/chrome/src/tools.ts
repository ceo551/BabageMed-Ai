import { z, McpServer, Scraper } from "@babagemed/mcp-base";
const scraper = new Scraper({
  base: "about:blank",
  rps: 2,
  headless: (process.env.SCRAPER_HEADLESS ?? "true") !== "false",
  proxyUrl: process.env.SCRAPER_PROXY_URL || undefined,
  respectRobots: false,
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
      // expose internal context to capture screenshot directly
      const { chromium } = await import("playwright");
      const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
      try {
        const page = await browser.newPage();
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
        const buf = await page.screenshot({ fullPage });
        return { url, image: buf.toString("base64"), mime: "image/png" };
      } finally { await browser.close(); }
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
      const { chromium } = await import("playwright");
      const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
      try {
        const page = await browser.newPage();
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
        await page.click(selector, { timeout: 10000 });
        await page.waitForLoadState("domcontentloaded");
        return { url: page.url(), text: (await page.textContent("body"))?.slice(0, 5000) ?? "" };
      } finally { await browser.close(); }
    },
  });
}
