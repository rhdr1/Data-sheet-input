// Minimal service worker — required for PWA installability.
// Strategy: network-first for app shell (so updates land instantly).
// No aggressive caching of API responses (Sheets data must be fresh).

const CACHE_NAME = "mulazamah-v1";
const SHELL_ASSETS = ["/", "/index.html", "/icon-192.png", "/icon-512.png", "/icon.svg", "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET and external requests (Google APIs etc.)
  if (event.request.method !== "GET") return;
  if (url.origin !== self.location.origin) return;

  // Network-first for HTML so updates land instantly
  if (event.request.mode === "navigate" || event.request.destination === "document") {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match("/index.html").then((r) => r || new Response("Offline", { status: 503 }))
      )
    );
    return;
  }

  // Cache-first for static assets
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response.ok && response.type === "basic") {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached || new Response("Offline", { status: 503 }));
    })
  );
});
