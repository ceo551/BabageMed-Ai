// Runtime proxy from /api/backend/* to the Go backend.
//
// We deliberately handle this in a route handler instead of a next.config.mjs
// rewrite because Next.js evaluates `rewrites()` at build time when using
// `output: "standalone"`, so process.env.BACKEND_URL set by Kubernetes never
// reaches the rewrite destination. A route handler runs per request and
// reads the env var fresh.
import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8080";

// Don't forward these — they confuse the upstream, are auto-set by fetch,
// or would let a client spoof their own IP / proxy chain.
const STRIP_REQ_HEADERS = new Set([
  "host", "content-length", "connection",
  "x-forwarded-for", "x-forwarded-host", "x-forwarded-proto", "x-forwarded-port",
  "forwarded", "x-real-ip",
]);
const STRIP_RES_HEADERS = new Set(["content-encoding", "content-length", "transfer-encoding", "connection"]);

// Allow-list of path prefixes this proxy will forward to. Without this,
// a client could reach /health, /metrics, or any future debug endpoint.
const ALLOWED_PREFIXES = ["api/"];

// Mutating methods carry the session cookie automatically, so we enforce
// a same-origin Origin/Referer check as a lightweight CSRF defence — a
// belt-and-braces complement to the SameSite cookie attribute.
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");
  const host = req.headers.get("host");
  if (!host) return false;
  if (origin) {
    return origin === `http://${host}` || origin === `https://${host}`;
  }
  if (referer) {
    try { return new URL(referer).host === host; } catch { return false; }
  }
  // Mutating browser requests always carry Origin or Referer. Missing
  // both is suspicious — reject.
  return false;
}

async function proxy(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> }
): Promise<Response> {
  const { path } = await ctx.params;
  const joined = path.join("/");

  if (!ALLOWED_PREFIXES.some((p) => joined.startsWith(p))) {
    return NextResponse.json({ error: "not_proxied" }, { status: 404 });
  }
  if (!SAFE_METHODS.has(req.method) && !sameOrigin(req)) {
    return NextResponse.json({ error: "csrf_check_failed" }, { status: 403 });
  }

  const target = `${BACKEND_URL}/${joined}${req.nextUrl.search}`;

  const forwardHeaders = new Headers();
  req.headers.forEach((v, k) => {
    if (!STRIP_REQ_HEADERS.has(k.toLowerCase())) forwardHeaders.set(k, v);
  });

  const init: RequestInit & { duplex?: "half" } = {
    method: req.method,
    headers: forwardHeaders,
    redirect: "manual",
  };
  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.arrayBuffer();
    init.duplex = "half";
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, init);
  } catch (e) {
    return NextResponse.json(
      { error: "backend_unreachable", target, detail: String(e) },
      { status: 502 }
    );
  }

  const respHeaders = new Headers();
  upstream.headers.forEach((v, k) => {
    if (!STRIP_RES_HEADERS.has(k.toLowerCase())) respHeaders.set(k, v);
  });

  return new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: respHeaders,
  });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const OPTIONS = proxy;
export const HEAD = proxy;

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
