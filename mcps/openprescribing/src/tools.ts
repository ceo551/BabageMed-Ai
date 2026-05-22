import { z, McpServer, Scraper, cheerioLoad } from "@babagemed/mcp-base";

const scraper = new Scraper({
  base: "https://openprescribing.net",
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
    description: "Search OpenPrescribing.net for a query and return links + snippets.",
    input: z.object({ query: z.string().min(1), limit: z.number().int().min(1).max(50).optional() }),
    handler: async ({ query, limit = 10 }) => {
      const url = "https://openprescribing.net" + "/?s=" + encodeURIComponent(query);
      const r = await scraper.fetchHtml(url, { browser: false });
      const $ = r.$;
      const results: { title: string; url: string; snippet: string }[] = [];
      $("a").each((_, a) => {
        const href = $(a).attr("href") || "";
        const text = $(a).text().trim();
        if (!href || !text || text.length < 8) return;
        if (results.length >= limit) return;
        try {
          const abs = new URL(href, "https://openprescribing.net").toString();
          if (!abs.startsWith("https://openprescribing.net")) return;
          if (results.some(x => x.url === abs)) return;
          results.push({ title: text.slice(0, 200), url: abs, snippet: "" });
        } catch {}
      });
      return { source: "openprescribing", query, count: results.length, results };
    },
  });

  server.tool({
    name: "fetch",
    description: "Fetch a OpenPrescribing.net page and return cleaned text content.",
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
