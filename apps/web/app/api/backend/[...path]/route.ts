// Runtime proxy from /api/backend/* to the Go backend.
//
// We deliberately handle this in a route handler instead of a next.config.mjs
// rewrite because Next.js evaluates `rewrites()` at build time when using
// `output: "standalone"`, so process.env.BACKEND_URL set by Kubernetes never
// reaches the rewrite destination. A route handler runs per request and
// reads the env var fresh.
import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8080";

// Don't forward these — they confuse the upstream or are auto-set.
const STRIP_REQ_HEADERS = new Set(["host", "content-length", "connection"]);
const STRIP_RES_HEADERS = new Set(["content-encoding", "content-length", "transfer-encoding", "connection"]);

async function proxy(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> }
): Promise<Response> {
  const { path } = await ctx.params;
  const target = `${BACKEND_URL}/${path.join("/")}${req.nextUrl.search}`;

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
