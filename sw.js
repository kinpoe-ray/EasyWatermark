const CACHE_NAME = "easy-watermark-v1";
const ASSETS = [
  "/",
  "/index.html",
  "/app.js",
  "/core.js",
  "/ui.js",
  "/storage.js",
  "/styles.css",
  "/favicon.svg",
  "/logo.svg",
  "/modules/i18n.js",
  "/modules/events.js",
  "/modules/export-ui.js",
  "/modules/template-ui.js",
  "/modules/ui-state.js",
  "/modules/drag.js",
  "/modules/export-flow.js",
  "/modules/modal.js",
  "/modules/logo-storage.js",
  "/gemini-assets.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetched = fetch(event.request).then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached);
      return cached || fetched;
    })
  );
});
