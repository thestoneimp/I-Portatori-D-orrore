const CACHE_NAME = "portatori-orrore-v2";
const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./styles.css",
  "./script.js",
  "./manifest.json",
  "./carte_struttura_base.json",
  "./eroi_base.json",
  "./png_base.json",
  "./portatori_orrore_base.json",
  "./scenari_base.json",
  "./elementi_interagibili_base.json",
  "./eventi_generici.json",
  "./minacce_base.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
      )
    )
  );
  self.clients.claim();
});

// Network-first per i file dell'app: prende sempre l'ultima versione
// quando c'è connessione, e usa la cache solo come riserva offline.
// (Prima era cache-first: mostrava la versione vecchia finché non si
// riapriva l'app una seconda volta.)
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  if (!req.url.startsWith(self.location.origin)) return;

  event.respondWith(
    fetch(req)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        }
        return networkResponse;
      })
      .catch(() => caches.match(req))
  );
});
