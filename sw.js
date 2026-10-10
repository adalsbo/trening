/* Service worker: alt blir lagra lokalt så appen verkar utan nett. Auk VERSJON ved endringar. */
const VERSJON = "treningsapp-v4";
const FILER = ["./", "index.html", "css/app.css", "js/app.js", "data/program.json", "manifest.webmanifest",
  "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png", "icons/icon-maskable-512.png", "vendor/xlsx.mini.min.js"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(VERSJON).then((c) => c.addAll(FILER)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((n) => n !== VERSJON).map((n) => caches.delete(n)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  const url = new URL(req.url);
  if (url.pathname.endsWith("/data/program.json")) {
    // Nett først for programdata, men fall tilbake på lagra kopi
    e.respondWith(fetch(req).then((r) => { const c = r.clone(); caches.open(VERSJON).then((ca) => ca.put(req, c)); return r; }).catch(() => caches.match(req, { ignoreSearch: true })));
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((r) => {
    if (r.ok) { const c = r.clone(); caches.open(VERSJON).then((ca) => ca.put(req, c)); }
    return r;
  }).catch(() => (req.mode === "navigate" ? caches.match("index.html") : undefined))));
});
