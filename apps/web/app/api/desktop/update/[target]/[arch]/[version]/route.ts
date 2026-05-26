// Tauri auto-updater endpoint.
//
// The desktop app (apps/desktop) polls
//
//   GET https://babagemed.com/api/desktop/update/{target}/{arch}/{current_version}
//
// on every launch. Tauri expects 204 (no update) or 200 + JSON describing
// the newer release. We delegate the manifest lookup + version compare to
// the Go backend (`backend/internal/updates`) — kept here is just the
// proxy hop, so the route can live on the public web origin without
// exposing the backend URL.

import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8080";

// Strict allow-list for the three URL params. Tauri only ever sends a
// known set of target/arch combos, and the version string is a semver.
// Without these the route forwards arbitrary attacker-chosen strings to
// the backend on every request — encodeURIComponent stops path traversal
// but not the requests themselves.
const TARGET_RE = /^[a-z0-9_-]{1,32}$/;
const ARCH_RE   = /^[a-z0-9_-]{1,16}$/;
const VERSION_RE = /^v?[0-9]+(\.[0-9]+){0,3}(-[a-z0-9_.-]{1,32})?$/i;

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ target: string; arch: string; version: string }> },
) {
  const { target, arch, version } = await ctx.params;
  if (!TARGET_RE.test(target) || !ARCH_RE.test(arch) || !VERSION_RE.test(version)) {
    // Treat invalid input as "no update" rather than 400 — Tauri would
    // pop a scary error every launch on 4xx.
    return new NextResponse(null, { status: 204 });
  }
  const safe = (s: string) => encodeURIComponent(s);
  const target_url = `${BACKEND_URL}/api/desktop/update/${safe(target)}/${safe(arch)}/${safe(version)}`;

  let upstream: Response;
  try {
    upstream = await fetch(target_url, {
      method: "GET",
      headers: { accept: "application/json" },
      // Don't follow redirects — the manifest URL itself may point at a
      // signed S3 URL that browsers can follow but Node's fetch shouldn't
      // strip the response body for.
      redirect: "manual",
      cache: "no-store",
      // 5 s ceiling so a hung backend doesn't camp a request handler.
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // Backend unreachable → tell Tauri "no update". Failing the call
    // would surface as a popup on every launch.
    return new NextResponse(null, { status: 204 });
  }

  if (upstream.status === 204) {
    return new NextResponse(null, { status: 204 });
  }

  // Pass through the JSON body + content-type. We deliberately strip
  // every other upstream header (set-cookie, x-*, etc) so the public
  // endpoint surface stays minimal.
  const body = await upstream.text();
  return new NextResponse(body, {
    status: upstream.status,
    headers: {
      "content-type": upstream.headers.get("content-type") || "application/json",
      "cache-control": "no-store",
    },
  });
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
