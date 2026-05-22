import { z, McpServer, Scraper, cheerioLoad } from "@babagemed/mcp-base";

const scraper = new Scraper({
  base: "https://www.aapd.org",
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
    description: "Search American Academy of Pediatric Dentistry for a query and return links + snippets.",
    input: z.object({ query: z.string().min(1), limit: z.number().int().min(1).max(50).optional() }),
    handler: async ({ query, limit = 10 }) => {
      const url = "https://www.aapd.org" + "/?s=" + encodeURIComponent(query);
      const r = await scraper.fetchHtml(url, { browser: false });
      const $ = r.$;
      const results: { title: string; url: string; snippet: string }[] = [];
      $("a").each((_, a) => {
        const href = $(a).attr("href") || "";
        const text = $(a).text().trim();
        if (!href || !text || text.length < 8) return;
        if (results.length >= limit) return;
        try {
          const abs = new URL(href, "https://www.aapd.org").toString();
          if (!abs.startsWith("https://www.aapd.org")) return;
          if (results.some(x => x.url === abs)) return;
          results.push({ title: text.slice(0, 200), url: abs, snippet: "" });
        } catch {}
      });
      return { source: "aapd", query, count: results.length, results };
    },
  });

  server.tool({
    name: "fetch",
    description: "Fetch a American Academy of Pediatric Dentistry page and return cleaned text content.",
    input: z.object({ url: z.string().url() }),
    handler: async ({ url }) => {
      const r = await scraper.fetchHtml(url, { browser: false });
      const $ = r.$;
      $("script,style,nav,footer,header,form,iframe,aside").remove();
      const title = $("h1").first().text().trim() || $("title").text().trim();
      const text = $("main, article, .content, #content, body").first().text().replace(/\s+/g, " ").trim().slice(0, 12000);
      return { url: r.url, status: r.status, title, text };
    },
  });
}
