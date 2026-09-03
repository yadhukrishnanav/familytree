// Family Tree — Service Worker
// Simple cache-first strategy for static assets, network-first for navigation.
//
// NOTE ON DEPLOYS: `CACHE_NAME` must be bumped on every deploy that changes
// app code. The activate handler deletes every cache whose name doesn't match,
// so clients purge stale assets on the first load after the new SW arrives.
// A stale cache was the cause of "Application error: a client-side exception"
// after deployments (old chunks 404 on the new deployment).

const CACHE_NAME = "family-tree-v2";
const STATIC_ASSETS = [
  "/",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-512.png",
];

// Install: pre-cache static assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting())
  );
});

// Activate: clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Messages from the app: force-activate a waiting SW, or purge every cache.
// Used by the error-recovery flow (see src/features/family-tree/errorRecovery.ts)
// when a chunk fails to load after a deploy.
self.addEventListener("message", (event) => {
  const type = event?.data?.type;
  if (type === "SKIP_WAITING") {
    self.skipWaiting();
  } else if (type === "PURGE_CACHES") {
    event.waitUntil(
      caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
    );
  }
});

// Fetch: network-first for navigation requests (so users get latest app),
// cache-first for everything else (static assets).
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  // Navigation requests (HTML pages)
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match("/")))
    );
    return;
  }

  // Static assets: cache-first
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        // Cache successful same-origin responses
        if (res.ok && new URL(req.url).origin === self.location.origin) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy));
        }
        return res;
      });
    })
  );
});
