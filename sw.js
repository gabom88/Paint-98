// sw.js — funciona sin conexión. Sube CACHE al cambiar archivos.
const CACHE = "paint98-v5";
const SHELL = [
  "./", "css/paint.css", "js/app.js", "js/raster.js", "js/icons.js", "manifest.webmanifest",
  "icons/icon-192.png", "icons/icon-512.png", "icons/maskable-512.png", "icons/apple-touch-icon.png",
  "icons/favicon-64.png", "icons/logo-32.png",
];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  const key = req.mode === "navigate" ? "./" : req;
  e.respondWith(caches.open(CACHE).then(async (c) => {
    const hit = await c.match(key, { ignoreSearch: true });
    const net = fetch(req).then((r) => { if (r.ok && !r.redirected) c.put(key, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  }));
});
