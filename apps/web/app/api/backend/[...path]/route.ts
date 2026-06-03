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
  // Strip any client-supplied x-client-ip — THIS proxy is the only thing
  // allowed to set it (from the verified LB value below). Without stripping,
  // a client could spoof their rate-limit identity.
  "x-client-ip",
  "authorization",
  // Strip Origin/Referer BEFORE forwarding. This proxy already enforces
  // same-origin itself (isCrossSite() below) for every state-changing
  // method, so it is the CSRF trust boundary — and in k8s the backend is
  // a ClusterIP only reachable through this proxy (NetworkPolicy blocks
  // everything else). Forwarding the browser's public-ingress Origin made
  // the backend's own originCSRFGuard 403 every write unless ops set
  // CORS_ALLOWED_ORIGINS/PUBLIC_BASE_URL to the exact (often IP-only,
  // unknown-until-deploy) ingress origin. With the headers stripped the
  // backend sees no Origin and falls through to session auth — secure,
  // and no fragile per-deploy origin config required.
  "origin", "referer",
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

// realClientIp extracts the caller's true IP from the inbound X-Forwarded-For.
// This request reached us through the GCP HTTP(S) load balancer, which appends
// "<client-ip>, <lb-ip>" to XFF — so the trustworthy client IP is the
// SECOND-TO-LAST element (the last is the LB itself; any value the client
// prepended sits further left and is ignored). We forward exactly this to the
// backend as X-Client-IP so per-IP rate limiting works per real client instead
// of collapsing to the single frontend-pod IP.
function realClientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length >= 2) return parts[parts.length - 2];
    if (parts.length === 1) return parts[0];
  }
  // Next may also surface a platform-resolved IP; last resort.
  return (req as unknown as { ip?: string }).ip || "";
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
  // Set the ONE trusted client-IP header the backend reads for rate limiting
  // (it ignores XFF). Computed from the LB-verified XFF above; any inbound
  // x-client-ip was stripped, so this can't be spoofed through the proxy.
  const clientIp = realClientIp(req);
  if (clientIp) forwardHeaders.set("x-client-ip", clientIp);
  // Forward a single trusted X-Forwarded-Proto so the backend issues session +
  // CSRF cookies with the Secure flag on HTTPS (auth.isSecure reads this; the
  // proxy→backend hop itself is plain HTTP). The inbound value is set by the
  // GCP load balancer (https for real traffic); fall back to the request's own
  // protocol so local-dev http doesn't get Secure cookies the browser rejects.
  const fwdProto = req.headers.get("x-forwarded-proto")
    || (req.nextUrl.protocol === "https:" ? "https" : "http");
  forwardHeaders.set("x-forwarded-proto", fwdProto);

  // 10-minute hard ceiling so a hung backend can't pin a Node worker
  // forever. SSE streams (chat) legitimately run several minutes; a
  // shorter cap would kill them mid-response. Real per-request limits
  // are enforced in the Go layer via http.MaxBytesReader + context
  // timeouts; this is purely a last-resort circuit breaker.
  const init: RequestInit & { duplex?: "half"; signal?: AbortSignal } = {
    method: req.method,
    headers: forwardHeaders,
    redirect: "manual",
    // Abort the upstream call when EITHER the client disconnects (req.signal)
    // OR the 10-min ceiling hits. Without req.signal, a user navigating away
    // mid-stream left the backend → LLM generation running (and billing) for
    // the full 10 minutes.
    signal: AbortSignal.any([req.signal, AbortSignal.timeout(10 * 60 * 1000)]),
  };
  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.arrayBuffer();
    init.duplex = "half";
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, init);
  } catch (e) {
    // Server-side log keeps the diagnostic value (the cluster-internal
    // BACKEND_URL + error chain) for ops. Echoing it to clients on a
    // 502 used to leak the internal Service DNS name + node error
    // detail — useful to attackers mapping the cluster topology.
    console.error("[/api/backend] upstream fetch failed:", target, e);
    return NextResponse.json(
      { error: "backend_unreachable" },
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
