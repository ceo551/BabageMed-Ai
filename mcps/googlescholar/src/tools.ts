import { z, McpServer, Scraper } from "@babagemed/mcp-base";
const scraper = new Scraper({
  base: "https://scholar.google.com",
  rps: 0.5,
  headless: true,
  proxyUrl: process.env.SCRAPER_PROXY_URL || undefined,
  respectRobots: false,
});
export function registerTools(server: McpServer) {
  server.tool({
    name: "search",
    description: "Search Google Scholar.",
    input: z.object({ query: z.string().min(1), num: z.number().int().min(1).max(20).optional() }),
    handler: async ({ query, num = 10 }) => {
      const url = `https://scholar.google.com/scholar?q=${encodeURIComponent(query)}&num=${num}`;
      const r = await scraper.fetchHtml(url, { browser: true });
      const $ = r.$;
      const results: any[] = [];
      $(".gs_r.gs_or").each((_, el) => {
        const a = $(el).find("h3 a").first();
        results.push({
          title: a.text().trim(),
          url: a.attr("href"),
          authors: $(el).find(".gs_a").text().trim(),
          snippet: $(el).find(".gs_rs").text().trim(),
          cites: $(el).find('a:contains("Cited by")').text().trim(),
        });
      });
      return { query, count: results.length, results };
    },
  });
  server.tool({
    name: "author",
    description: "Fetch a Google Scholar profile by user id.",
    input: z.object({ userId: z.string() }),
    handler: async ({ userId }) => {
      const r = await scraper.fetchHtml(`https://scholar.google.com/citations?user=${encodeURIComponent(userId)}&hl=en`, { browser: true });
      const $ = r.$;
      return {
        name: $("#gsc_prf_in").text(),
        affiliation: $(".gsc_prf_il").first().text(),
        citations: $("#gsc_rsb_st td.gsc_rsb_std").first().text(),
      };
    },
  });
  server.tool({
    name: "cite",
    description: "Open a cite-as menu for a search result by cluster id and return BibTeX URL.",
    input: z.object({ clusterId: z.string() }),
    handler: async ({ clusterId }) => {
      const r = await scraper.fetchHtml(`https://scholar.google.com/scholar?q=info:${clusterId}:scholar.google.com`, { browser: true });
      return { url: r.url, text: r.$("body").text().slice(0, 2000) };
    },
  });
}
