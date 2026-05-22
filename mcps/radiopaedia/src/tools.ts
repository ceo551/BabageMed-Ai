import { z, McpServer, Scraper } from "@babagemed/mcp-base";
const scraper = new Scraper({
  base: "https://radiopaedia.org",
  userAgent: process.env.SCRAPER_USER_AGENT,
  rps: Number(process.env.SCRAPER_RATE_RPS || 1),
  timeoutMs: Number(process.env.SCRAPER_TIMEOUT_MS || 30000),
  headless: (process.env.SCRAPER_HEADLESS ?? "true") !== "false",
  cacheTtlSec: Number(process.env.SCRAPER_CACHE_TTL_SEC || 86400),
  proxyUrl: process.env.SCRAPER_PROXY_URL || undefined,
  blockMedia: true,
});
export function registerTools(server: McpServer) {
  server.tool({
    name: "search",
    description: "Search radiopaedia.",
    input: z.object({ query: z.string().min(1), limit: z.number().int().min(1).max(50).optional() }),
    handler: async ({ query, limit = 10 }) => {
      const url = "https://radiopaedia.org/search?q={q}".replace("{q}", encodeURIComponent(query));
      const r = await scraper.fetchHtml(url, { browser: true });
      const $ = r.$;
      const results: any[] = [];
      $(".search-result").each((_, el) => {
        if (results.length >= limit) return;
        const a = $(el).find("a").first();
        const href = a.attr("href"); if (!href) return;
        try {
          const abs = new URL(href, "https://radiopaedia.org").toString();
          if (!abs.startsWith("https://radiopaedia.org")) return;
          results.push({ title: a.text().trim(), url: abs, snippet: $(el).find("p").first().text().trim() });
        } catch {}
      });
      return { source: "radiopaedia", query, count: results.length, results };
    },
  });
  server.tool({
    name: "fetch",
    description: "Fetch a radiopaedia URL and return cleaned text content.",
    input: z.object({ url: z.string().url() }),
    handler: async ({ url }) => {
      const r = await scraper.fetchHtml(url, { browser: true });
      const $ = r.$;
      $("script,style,nav,footer,header,form,iframe,aside,.ad,.advert,.related").remove();
      const title = $("h1").first().text().trim() || $("title").text().trim();
      const sel = ".body, article, main";
      const text = $(sel).first().text().replace(/\s+/g, " ").trim().slice(0, 20000);
      return { url: r.url, status: r.status, title, text };
    },
  });
}
