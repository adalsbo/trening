/* Service worker: alt blir lagra lokalt så appen verkar utan nett. Versjonsnamnet ligg i js/versjon.js. */
importScripts("js/versjon.js");
const FILER = ["./", "index.html", "css/app.css", "js/app.js", "js/versjon.js", "data/program.json", "manifest.webmanifest",
  "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png", "icons/icon-maskable-512.png", "vendor/xlsx.mini.min.js"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(VERSJON).then((c) => c.addAll(FILER)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((n) => n !== VERSJON).map((n) => caches.delete(n)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  // Ikkje ta over kryss-opphav (api.github.com) eller anna enn GET. respondWith her
  // kan gjera at iOS avviser synk som nettverksfeil.
  if (req.method !== "GET") return;
  let url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.origin !== self.location.origin) return;
  const nettForst = url.pathname.endsWith("/data/program.json")
    || url.pathname.endsWith("/js/app.js")
    || url.pathname.endsWith("/js/versjon.js")
    || url.pathname.endsWith("/css/app.css")
    || url.pathname.endsWith("/sw.js");
  if (nettForst) {
    e.respondWith(fetch(req).then((r) => {
      if (r && r.ok) { const c = r.clone(); caches.open(VERSJON).then((ca) => ca.put(req, c)).catch(() => {}); }
      return r;
    }).catch(() => caches.match(req, { ignoreSearch: true })));
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((r) => {
    if (r.ok) { const c = r.clone(); caches.open(VERSJON).then((ca) => ca.put(req, c)); }
    return r;
  }).catch(() => (req.mode === "navigate" ? caches.match("index.html") : undefined))));
});
