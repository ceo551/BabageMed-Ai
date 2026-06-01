import { request } from "undici";
import pRetry from "p-retry";
import { TtlCache } from "./cache.js";

export interface ApiClientOptions {
  base: string;
  defaultHeaders?: Record<string, string>;
  rps?: number;
  timeoutMs?: number;
  cacheTtlSec?: number;
  userAgent?: string;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  headers?: Record<string, string>;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  cache?: boolean;
  cacheTtlSec?: number;
}

export class ApiClient {
  private nextSlot = 0;
  private cache: TtlCache<unknown>;

  constructor(private opts: ApiClientOptions) {
    this.cache = new TtlCache<unknown>(opts.cacheTtlSec ?? 86400);
  }

  private async throttle() {
    if (!this.opts.rps || this.opts.rps <= 0) return;
    const interval = 1000 / this.opts.rps;
    // Monotonic clock — a system-clock jump backwards (NTP, suspend/
    // resume) would otherwise make `nextSlot - now` huge and stall the
    // next request for hours.
    const now = performance.now();
    const wait = Math.max(0, this.nextSlot - now);
    this.nextSlot = Math.max(now, this.nextSlot) + interval;
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  }

  private buildUrl(path: string, query?: Record<string, string | number | boolean | undefined>): string {
    const url = new URL(path.startsWith("http") ? path : this.opts.base.replace(/\/$/, "") + "/" + path.replace(/^\//, ""));
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v === undefined || v === null) continue;
        url.searchParams.set(k, String(v));
      }
    }
    return url.toString();
  }

  async request<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
    const url = this.buildUrl(path, options.query);
    // Cache key must include the Authorization / cookie header so two
    // different bearers (or one bearer rotating) don't share responses.
    // Today the token is global per process, but the moment per-user
    // auth lands without this fix one user would see another's data.
    const auth = options.headers?.authorization || options.headers?.Authorization || this.opts.defaultHeaders?.Authorization || this.opts.defaultHeaders?.authorization || "";
    const authFingerprint = auth ? simpleHash(auth) : "";
    const key = `${options.method ?? "GET"} ${url} ${JSON.stringify(options.body ?? "")} ${authFingerprint}`;
    if (options.cache !== false && (options.method === undefined || options.method === "GET")) {
      const hit = this.cache.get(key) as T | undefined;
      if (hit !== undefined) return hit;
    }

    const result = await pRetry(
      async () => {
        await this.throttle();
        const res = await request(url, {
          method: options.method ?? "GET",
          headers: {
            "user-agent": this.opts.userAgent || "Pervagans-AI/0.1",
            accept: "application/json,text/xml,*/*",
            ...this.opts.defaultHeaders,
            ...options.headers,
          },
          body: options.body
            ? typeof options.body === "string"
              ? options.body
              : JSON.stringify(options.body)
            : undefined,
          bodyTimeout: this.opts.timeoutMs ?? 30000,
          headersTimeout: this.opts.timeoutMs ?? 30000,
        });
        if (res.statusCode >= 500 || res.statusCode === 429) {
          throw new Error(`HTTP ${res.statusCode}`);
        }
        if (res.statusCode >= 400) {
          const text = await res.body.text();
          const err = new Error(`HTTP ${res.statusCode}: ${text.slice(0, 200)}`);
          // 4xx is not retryable
          throw Object.assign(err, { name: "AbortError" });
        }
        const ct = res.headers["content-type"] || "";
        if (typeof ct === "string" && ct.includes("application/json")) {
          return (await res.body.json()) as T;
        }
        return (await res.body.text()) as unknown as T;
      },
      { retries: 3, minTimeout: 500, maxTimeout: 4000, factor: 2 }
    );

    if (options.cache !== false && (options.method === undefined || options.method === "GET")) {
      this.cache.set(key, result as unknown, options.cacheTtlSec);
    }
    return result;
  }

  get<T = unknown>(path: string, query?: RequestOptions["query"], extra: Omit<RequestOptions, "method" | "query"> = {}) {
    return this.request<T>(path, { ...extra, method: "GET", query });
  }
  post<T = unknown>(path: string, body?: unknown, extra: Omit<RequestOptions, "method" | "body"> = {}) {
    return this.request<T>(path, { ...extra, method: "POST", body });
  }
}

// Truncated SHA-256 of the bearer token — folded into the cache key
// so two different bearers never share a response.
//
// djb2 (the previous implementation) gave 32 bits of entropy, which
// has a ~50 % collision probability at ~77 000 distinct tokens
// (birthday-paradox). At this scale that's safe today, but cross-
// tenant token rotation would land us in the collision zone fast.
// 16 hex chars of SHA-256 = 64 bits, which is collision-safe to
// ~4 billion tokens.
import { createHash } from "node:crypto";
function simpleHash(s: string): string {
  return createHash("sha256").update(s).digest("hex").slice(0, 16);
}
