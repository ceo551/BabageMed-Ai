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

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ target: string; arch: string; version: string }> },
) {
  const { target, arch, version } = await ctx.params;
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
