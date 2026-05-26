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
  /**
   * Hostnames the scraper is allowed to fetch from. When omitted, the
   * scraper derives one entry from `base` so the default is "same origin
   * only", which closes the SSRF surface that the public `url` tool
   * input otherwise opens (an MCP exposed at /call/fetch could be driven
   * against http://169.254.169.254/ etc.). Pass `["*"]` to accept any
   * host — only do this for MCPs that genuinely need cross-host scraping
   * AND have their own URL validation.
   */
  allowedHosts?: string[];
}

export interface FetchResult {
  url: string;
  status: number;
  html: string;
  $: CheerioAPI;
}

const UA_DEFAULT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

// Hostnames / IP literals that point at the local machine, link-local
// metadata services, or RFC1918 private ranges. These are rejected
// unconditionally — there's no clinical scrape use case that needs
// them, and they are the primary SSRF targets.
const FORBIDDEN_HOST_PATTERNS: RegExp[] = [
  /^localhost$/i,
  /^127\./,                 // 127.0.0.0/8 loopback
  /^0\./,                   // 0.0.0.0/8
  /^10\./,                  // 10.0.0.0/8 RFC1918
  /^192\.168\./,            // 192.168.0.0/16 RFC1918
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0/12 RFC1918
  /^169\.254\./,            // 169.254.0.0/16 link-local (AWS / GCP metadata)
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, // 100.64.0.0/10 CGNAT
  /^fc00:/i, /^fd[0-9a-f]{2}:/i, // IPv6 ULA
  /^fe80:/i,                // IPv6 link-local
  /^::1$/,                  // IPv6 loopback
  /\.internal$/i,           // GCP internal
  /\.local$/i,              // mDNS
  /\.cluster\.local$/i,     // Kubernetes
  /\.svc$/i, /\.svc\.cluster$/i,
];

export class Scraper {
  private browser?: Browser;
  private context?: BrowserContext;
  private cache: TtlCache<{ status: number; html: string }>;
  // Throttle bookkeeping uses a monotonic clock so a system clock jump
  // (NTP correction, suspend/resume) can't make `nextSlot - now` blow up
  // into an hours-long sleep. performance.now() is process-relative and
  // never decreases.
  private nextSlot = 0;
  // robots.txt cache must expire — sites do update their robots.txt and a
  // long-running pod with a plain Map<> would never pick up the change.
  // 6h TTL matches the practical "fresh enough" window most crawl-policy
  // tooling uses; capping entries keeps the per-pod footprint bounded even
  // if a scraper sees a long-tail of distinct origins.
  private robotsCache = new TtlCache<ReturnType<RobotsParserFn>>(6 * 60 * 60, 1024);
  private allowedHosts: Set<string>;
  private allowAnyHost: boolean;

  constructor(private opts: ScraperOptions) {
    this.cache = new TtlCache(opts.cacheTtlSec ?? 86400);

    // Default allow-list: the hostname from `base`. Callers can pass
    // ["*"] to accept any host (rare — only the chrome MCP).
    const hosts = opts.allowedHosts ?? [new URL(opts.base).hostname];
    this.allowAnyHost = hosts.includes("*");
    this.allowedHosts = new Set(hosts.map((h) => h.toLowerCase()));
  }

  /**
   * Throw if `url` is not allowed by this scraper's host + scheme
   * policy. Exposed so MCPs that drive Playwright directly (e.g. the
   * chrome MCP's screenshot/click tools) can apply the same check
   * before opening a page.
   */
  validateUrl(url: string) {
    this.assertHostAllowed(url);
  }

  private assertHostAllowed(url: string) {
    let u: URL;
    try { u = new URL(url); } catch { throw new Error("invalid url"); }
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      throw new Error(`forbidden scheme: ${u.protocol}`);
    }
    const host = u.hostname.toLowerCase();
    for (const pat of FORBIDDEN_HOST_PATTERNS) {
      if (pat.test(host)) throw new Error(`forbidden host: ${host}`);
    }
    if (this.allowAnyHost) return;
    // Allow exact match or a subdomain of an allowed parent.
    for (const allowed of this.allowedHosts) {
      if (host === allowed) return;
      if (host.endsWith("." + allowed)) return;
    }
    throw new Error(`host not in scraper allow-list: ${host}`);
  }

  private async throttle() {
    if (!this.opts.rps || this.opts.rps <= 0) return;
    const interval = 1000 / this.opts.rps;
    const now = performance.now();
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
        this.robotsCache.set(origin, robots);
      } catch {
        // Unreachable robots.txt → cache a short-lived "no rules"
        // entry so we don't hammer the origin retrying, but use a 5
        // min TTL so a transient outage doesn't grant us a 6h pass.
        robots = rp(origin + "/robots.txt", "");
        this.robotsCache.set(origin, robots, 5 * 60);
      }
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
      // `--no-sandbox` previously listed here removed: Chromium's setuid
      // sandbox is critical defence in depth when the renderer touches
      // user-supplied URLs. The pod runs as non-root with userns enabled
      // (see Helm chart securityContext) so the sandbox starts cleanly.
      // If a deployment target genuinely lacks userns, set
      // PLAYWRIGHT_CHROMIUM_DISABLE_SANDBOX=1 at the process level — that's
      // visible to ops, unlike a hard-coded flag here.
      args: [
        "--disable-blink-features=AutomationControlled",
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
        // Spread first then explicitly re-set user-agent so an extraHeaders
        // entry can't accidentally clobber our intended UA.
        ...(this.opts.extraHeaders ?? {}),
        "user-agent": this.opts.userAgent || UA_DEFAULT,
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

  /** Returns a long-lived page from the shared context. The caller MUST close it. */
  async newPage(): Promise<Page> {
    const ctx = await this.ensureBrowser();
    return ctx.newPage();
  }

  /** Cheap path: undici fetch (fast, no JS). Falls back to browser on 403/blocked. */
  async fetchHtml(url: string, opts: { browser?: boolean; cache?: boolean; cacheTtlSec?: number } = {}): Promise<FetchResult> {
    const full = url.startsWith("http") ? url : this.opts.base.replace(/\/$/, "") + "/" + url.replace(/^\//, "");
    this.assertHostAllowed(full);
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
