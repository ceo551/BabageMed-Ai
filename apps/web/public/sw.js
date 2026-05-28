// Babbage AI service worker.
//
// Strategy: stale-while-revalidate for static assets, network-with-
// offline-fallback for HTML navigations (NOT cached — see below).
// We deliberately do NOT cache /api/backend/* — those carry per-user
// auth state.

// VERSION is derived from the `?v=<buildId>` query string the client
// uses when calling navigator.serviceWorker.register (see
// apps/web/app/components/ServiceWorker.tsx). Each deploy passes a
// new buildId, so a fresh worker installs with fresh caches — the
// previous version stayed "v1" forever and the install handler
// never re-ran across deploys.
const swParams = new URLSearchParams(self.location.search);
const VERSION = swParams.get("v") || "dev";
const STATIC_CACHE = `babbage-static-${VERSION}`;
const RUNTIME_CACHE = `babbage-runtime-${VERSION}`;
const OFFLINE_URL = "/offline.html";

const PRECACHE = [OFFLINE_URL, "/babagemed-icon.png", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => ![STATIC_CACHE, RUNTIME_CACHE].includes(k))
          .map((k) => caches.delete(k)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Never cache live API traffic. Auth tokens + chat streams would leak
  // between sessions if we did.
  if (url.pathname.startsWith("/api/")) return;

  // HTML navigations: network-only with offline fallback. We do NOT
  // cache the response body — Next.js injects per-user content into
  // the SSR HTML (sidebar names, draft state) and stamping that into
  // the cache would surface it to the next signed-in user on a shared
  // device. /offline.html is precached at install for the offline path.
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          return await fetch(req);
        } catch {
          const offline = await caches.match(OFFLINE_URL);
          // Last-resort: if even /offline.html is missing from cache
          // (precache failed) return Response.error() so the browser
          // shows its native "no connection" UI rather than hanging
          // forever on a never-resolved promise.
          return offline || Response.error();
        }
      })(),
    );
    return;
  }

  // Static assets: stale-while-revalidate.
  if (
    url.pathname.startsWith("/_next/static/") ||
    /\.(js|css|woff2?|png|jpg|webp|svg|ico)$/i.test(url.pathname)
  ) {
    event.respondWith(
      caches.open(RUNTIME_CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        const fetched = fetch(req)
          .then((res) => {
            if (res.ok) cache.put(req, res.clone());
            return res;
          })
          .catch(() => cached);
        // If both cached and network fail, return Response.error()
        // instead of letting the FetchEvent resolve to undefined
        // (which hangs the request indefinitely in Chrome).
        return (await (cached || fetched)) || Response.error();
      }),
    );
  }
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});
