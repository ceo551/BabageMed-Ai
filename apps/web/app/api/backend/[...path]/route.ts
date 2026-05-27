// Runtime proxy from /api/backend/* to the Go backend.
//
// We deliberately handle this in a route handler instead of a next.config.mjs
// rewrite because Next.js evaluates `rewrites()` at build time when using
// `output: "standalone"`, so process.env.BACKEND_URL set by Kubernetes never
// reaches the rewrite destination. A route handler runs per request and
// reads the env var fresh.
import { NextRequest, NextResponse } from "next/server";
import { sameOrigin } from "../../../lib/csrf";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8080";

// Don't forward these — they confuse the upstream, are auto-set by fetch,
// would let a client spoof their own IP / proxy chain, or would let a
// client smuggle a bearer token aimed at a different scope. Auth lives
// in the session cookie; an Authorization header from the browser is
// always either accidental or hostile.
const STRIP_REQ_HEADERS = new Set([
  "host", "content-length", "connection",
  "x-forwarded-for", "x-forwarded-host", "x-forwarded-proto", "x-forwarded-port",
  "forwarded", "x-real-ip",
  "authorization",
]);
const STRIP_RES_HEADERS = new Set(["content-encoding", "content-length", "transfer-encoding", "connection"]);

// Allow-list of path prefixes this proxy will forward to. Without this,
// a client could reach /health, /metrics, or any future debug endpoint.
const ALLOWED_PREFIXES = ["api/"];

// Mutating methods carry the session cookie automatically, so we enforce
// a same-origin Origin/Referer check as a lightweight CSRF defence — a
// belt-and-braces complement to the SameSite cookie attribute.
// The check itself lives in apps/web/app/lib/csrf.ts so it can be unit-
// tested against the matrix of (origin, referer, host) combinations.
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function isCrossSite(req: NextRequest): boolean {
  return !sameOrigin({
    origin: req.headers.get("origin"),
    referer: req.headers.get("referer"),
    host: req.headers.get("host"),
  });
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
  if (!SAFE_METHODS.has(req.method) && isCrossSite(req)) {
    return NextResponse.json({ error: "csrf_check_failed" }, { status: 403 });
  }

  const target = `${BACKEND_URL}/${joined}${req.nextUrl.search}`;

  const forwardHeaders = new Headers();
  req.headers.forEach((v, k) => {
    if (!STRIP_REQ_HEADERS.has(k.toLowerCase())) forwardHeaders.set(k, v);
  });

  // 10-minute hard ceiling so a hung backend can't pin a Node worker
  // forever. SSE streams (chat) legitimately run several minutes; a
  // shorter cap would kill them mid-response. Real per-request limits
  // are enforced in the Go layer via http.MaxBytesReader + context
  // timeouts; this is purely a last-resort circuit breaker.
  const init: RequestInit & { duplex?: "half"; signal?: AbortSignal } = {
    method: req.method,
    headers: forwardHeaders,
    redirect: "manual",
    signal: AbortSignal.timeout(10 * 60 * 1000),
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
