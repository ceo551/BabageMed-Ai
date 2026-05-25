import { chromium, Browser, BrowserContext, Page, Route } from "playwright";
import { load as cheerioLoad, CheerioAPI } from "cheerio";
import pRetry from "p-retry";
// @ts-ignore — robots-parser ships a default export but its .d.ts is loose
import robotsParser from "robots-parser";
type RobotsParserFn = (url: string, txt: string) => { isAllowed: (url: string, ua?: string) => boolean | undefined };
const rp = robotsParser as unknown as RobotsParserFn;
import { request } from "undici";
import { TtlCache } from "./cache.js";

export interface ScraperOptions {
  base: string;
  userAgent?: string;
  rps?: number;
  timeoutMs?: number;
  headless?: boolean;
  cacheTtlSec?: number;
  proxyUrl?: string;
  /** Block third-party domains (ads, analytics) to speed pages and reduce footprint. */
  blockThirdParty?: boolean;
  /** Block images / media to save bandwidth (text-only scraping). */
  blockMedia?: boolean;
  /** Respect robots.txt when true. Defaults true — clinical product, behave well. */
  respectRobots?: boolean;
  /** Extra headers sent on every request. */
  extraHeaders?: Record<string, string>;
}

export interface FetchResult {
  url: string;
  status: number;
  html: string;
  $: CheerioAPI;
}

const UA_DEFAULT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

export class Scraper {
  private browser?: Browser;
  private context?: BrowserContext;
  private cache: TtlCache<{ status: number; html: string }>;
  private nextSlot = 0;
  // robots.txt cache must expire — sites do update their robots.txt and a
  // long-running pod with a plain Map<> would never pick up the change.
  // 6h TTL matches the practical "fresh enough" window most crawl-policy
  // tooling uses; capping entries keeps the per-pod footprint bounded even
  // if a scraper sees a long-tail of distinct origins.
  private robotsCache = new TtlCache<ReturnType<RobotsParserFn>>(6 * 60 * 60, 1024);

  constructor(private opts: ScraperOptions) {
    this.cache = new TtlCache(opts.cacheTtlSec ?? 86400);
  }

  private async throttle() {
    if (!this.opts.rps || this.opts.rps <= 0) return;
    const interval = 1000 / this.opts.rps;
    const now = Date.now();
    const wait = Math.max(0, this.nextSlot - now);
    this.nextSlot = Math.max(now, this.nextSlot) + interval;
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  }

  private async robotsAllow(url: string): Promise<boolean> {
    if (this.opts.respectRobots === false) return true;
    const u = new URL(url);
    const origin = u.origin;
    let robots = this.robotsCache.get(origin);
    if (!robots) {
      try {
        const r = await request(origin + "/robots.txt", { bodyTimeout: 5000, headersTimeout: 5000 });
        const txt = r.statusCode === 200 ? await r.body.text() : "";
        robots = rp(origin + "/robots.txt", txt);
      } catch {
        robots = rp(origin + "/robots.txt", "");
      }
      // TtlCache.set signature matches the prior Map.set call site exactly,
      // so the only thing changing here is *expiry* — entries now age out
      // after the cache's default TTL (6h) instead of living forever.
      this.robotsCache.set(origin, robots);
    }
    const ua = this.opts.userAgent || UA_DEFAULT;
    const allowed = robots.isAllowed(url, ua);
    return allowed === undefined ? true : allowed;
  }

  private async ensureBrowser(): Promise<BrowserContext> {
    if (this.context) return this.context;
    this.browser = await chromium.launch({
      headless: this.opts.headless !== false,
      proxy: this.opts.proxyUrl ? { server: this.opts.proxyUrl } : undefined,
      args: [
        "--disable-blink-features=AutomationControlled",
        "--no-sandbox",
        "--disable-dev-shm-usage",
      ],
    });
    this.context = await this.browser.newContext({
      userAgent: this.opts.userAgent || UA_DEFAULT,
      viewport: { width: 1366, height: 900 },
      locale: "en-US",
      timezoneId: "UTC",
      extraHTTPHeaders: {
        "accept-language": "en-US,en;q=0.9",
        ...this.opts.extraHeaders,
      },
    });
    // Light stealth — remove the most obvious automation tells.
    await this.context.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
      // @ts-ignore
      window.chrome = window.chrome || { runtime: {} };
      Object.defineProperty(navigator, "languages", { get: () => ["en-US", "en"] });
      Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3, 4, 5] });
    });
    return this.context;
  }

  /** Cheap path: undici fetch (fast, no JS). Falls back to browser on 403/blocked. */
  async fetchHtml(url: string, opts: { browser?: boolean; cache?: boolean; cacheTtlSec?: number } = {}): Promise<FetchResult> {
    const full = url.startsWith("http") ? url : this.opts.base.replace(/\/$/, "") + "/" + url.replace(/^\//, "");
    if (opts.cache !== false) {
      const hit = this.cache.get(full);
      if (hit) return { url: full, status: hit.status, html: hit.html, $: cheerioLoad(hit.html) };
    }
    if (!(await this.robotsAllow(full))) {
      throw new Error(`robots.txt disallows ${full}`);
    }

    const useBrowser = opts.browser === true;
    const exec = async (): Promise<{ status: number; html: string }> => {
      await this.throttle();
      if (!useBrowser) {
        const res = await request(full, {
          headers: {
            "user-agent": this.opts.userAgent || UA_DEFAULT,
            accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "accept-language": "en-US,en;q=0.9",
            ...this.opts.extraHeaders,
          },
          bodyTimeout: this.opts.timeoutMs ?? 30000,
          headersTimeout: this.opts.timeoutMs ?? 30000,
          maxRedirections: 5,
        });
        if (res.statusCode === 403 || res.statusCode === 429 || res.statusCode === 503) {
          throw new Error(`blocked-${res.statusCode}`);
        }
        if (res.statusCode >= 400) {
          throw Object.assign(new Error(`HTTP ${res.statusCode}`), { name: "AbortError" });
        }
        return { status: res.statusCode, html: await res.body.text() };
      }
      // Browser path
      const ctx = await this.ensureBrowser();
      const page = await ctx.newPage();
      try {
        if (this.opts.blockMedia || this.opts.blockThirdParty) {
          await page.route("**/*", (route: Route) => {
            const r = route.request();
            const type = r.resourceType();
            if (this.opts.blockMedia && (type === "image" || type === "media" || type === "font")) return route.abort();
            if (this.opts.blockThirdParty) {
              try {
                const host = new URL(r.url()).hostname;
                const pageHost = new URL(full).hostname;
                if (!host.endsWith(pageHost.split(".").slice(-2).join("."))) return route.abort();
              } catch {}
            }
            return route.continue();
          });
        }
        const resp = await page.goto(full, { waitUntil: "domcontentloaded", timeout: this.opts.timeoutMs ?? 30000 });
        const status = resp?.status() ?? 0;
        const html = await page.content();
        return { status, html };
      } finally {
        await page.close().catch(() => {});
      }
    };

    let result: { status: number; html: string };
    try {
      result = await pRetry(exec, { retries: 2, minTimeout: 800, maxTimeout: 4000, factor: 2 });
    } catch (e: any) {
      // If undici failed with blocked-* and we weren't already using the browser, escalate.
      if (!useBrowser && String(e?.message || "").startsWith("blocked-")) {
        return this.fetchHtml(url, { ...opts, browser: true });
      }
      throw e;
    }

    if (opts.cache !== false) this.cache.set(full, result, opts.cacheTtlSec);
    return { url: full, status: result.status, html: result.html, $: cheerioLoad(result.html) };
  }

  async close() {
    await this.context?.close().catch(() => {});
    await this.browser?.close().catch(() => {});
    this.context = undefined;
    this.browser = undefined;
  }
}

export { cheerioLoad };
