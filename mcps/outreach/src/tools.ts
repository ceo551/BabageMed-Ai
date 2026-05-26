import { z, McpServer, Scraper, cheerioLoad } from "@babagemed/mcp-base";

const scraper = new Scraper({
  base: "",
  userAgent: process.env.SCRAPER_USER_AGENT,
  rps: Number(process.env.SCRAPER_RATE_RPS ?? 1) || 1,
  timeoutMs: Number(process.env.SCRAPER_TIMEOUT_MS || 30000),
  headless: (process.env.SCRAPER_HEADLESS ?? "true") !== "false",
  cacheTtlSec: Number(process.env.SCRAPER_CACHE_TTL_SEC || 86400),
  proxyUrl: process.env.SCRAPER_PROXY_URL || undefined,
  blockMedia: true,
});

// Source-specific search URL + result-row selectors (from scripts/site-search-patterns.json)
const SEARCH_URL  = "/?s={q}";
const SEL_RESULT  = "article, .post, .search-result, li";
const SEL_TITLE   = "h1, h2, h3, .title, a";
const SEL_LINK    = "a";
const SEL_SNIPPET = "p, .excerpt, .summary";
const ORIGIN      = "";

export function registerTools(server: McpServer) {
  server.tool({
    name: "search",
    description: "Search Outreach for a query and return structured results.",
    input: z.object({ query: z.string().min(1), limit: z.number().int().min(1).max(50).optional() }),
    handler: async ({ query, limit = 10 }) => {
      const url = SEARCH_URL.replace("{q}", encodeURIComponent(query));
      const r = await scraper.fetchHtml(url, { browser: false });
      const $ = r.$;
      const results: { title: string; url: string; snippet: string }[] = [];
      // Try the source-specific result selector first.
      $(SEL_RESULT).each((_, el) => {
        if (results.length >= limit) return false;
        const $row = $(el);
        const $link = $row.find(SEL_LINK).first();
        const href = $link.attr("href");
        if (!href) return;
        let abs: string;
        try { abs = new URL(href, "").toString(); } catch { return; }
        if (!abs.startsWith(ORIGIN)) return;
        if (results.some((x) => x.url === abs)) return;
        const title = ($row.find(SEL_TITLE).first().text() || $link.text() || "").trim();
        const snippet = $row.find(SEL_SNIPPET).first().text().trim().slice(0, 400);
        if (!title) return;
        results.push({ title: title.slice(0, 240), url: abs, snippet });
      });
      // Fallback: if the structured pass found nothing, harvest same-origin links.
      if (results.length === 0) {
        $("a").each((_, a) => {
          if (results.length >= limit) return false;
          const href = $(a).attr("href") || "";
          const text = $(a).text().trim();
          if (!href || text.length < 8) return;
          let abs: string;
          try { abs = new URL(href, "").toString(); } catch { return; }
          if (!abs.startsWith(ORIGIN)) return;
          if (results.some((x) => x.url === abs)) return;
          results.push({ title: text.slice(0, 240), url: abs, snippet: "" });
        });
      }
      return { source: "outreach", query, searchUrl: url, count: results.length, results };
    },
  });

  server.tool({
    name: "fetch",
    description: "Fetch a Outreach page and return cleaned text content.",
    input: z.object({ url: z.string().url() }),
    handler: async ({ url }) => {
      // Friendlier rejection than the Scraper's bare "host not allowed".
      // Callers often paste a URL from a different site assuming any
      // fetch tool will work; surface the constraint explicitly.
      try {
        const u = new URL(url);
        const expected = new URL("about:blank").hostname;
        if (u.hostname !== expected && !u.hostname.endsWith("." + expected)) {
          return {
            error: "url not under this MCP's allowed host",
            allowedHost: expected,
            providedHost: u.hostname,
            hint: "Use the MCP whose base matches the URL host, or call the chrome MCP for cross-origin browsing.",
          };
        }
      } catch {
        return { error: "invalid url", url };
      }
      const r = await scraper.fetchHtml(url, { browser: false });
      const $ = r.$;
      $("script,style,nav,footer,header,form,iframe,aside,.ad,.advert,.related").remove();
      const title = $("h1").first().text().trim() || $("title").text().trim();
      const text  = $("main, article, .content, #content, .article, body").first().text().replace(/\s+/g, " ").trim().slice(0, 20000);
      return { url: r.url, status: r.status, title, text };
    },
  });
}
