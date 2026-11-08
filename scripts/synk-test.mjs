/**
 * Køyrer synk-flyten i Chrome med syntetiske økter og ein lokal GitHub-stub.
 * Skriv ikkje til det private repoet og loggar ikkje token eller øktinnhald.
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const harness = `<!doctype html>
<meta charset="utf-8">
<title>synk-test</title>
<pre id="ut">køyrer</pre>
<div id="toast" hidden></div>
<header><h1 id="topTitle">Trening</h1><button id="personBtn" type="button"></button></header>
<main id="app"><p class="laster">Lastar …</p></main>
<div id="timer" hidden><span id="timerLabel"></span><strong id="timerTime"></strong>
  <button id="timerPlus" type="button"></button><button id="timerStop" type="button"></button></div>
<script>
window.__ingenTenesteArbeidar = true;
window.__synkVentMs = 0;
window.__gh = { mode: "ok", remote: null, sha: "sha-1", log: [], throwsLeft: 0, putThrowsLeft: 0 };
function kod(obj) { return btoa(unescape(encodeURIComponent(JSON.stringify(obj)))); }
function dekodInnhald(content) { return JSON.parse(decodeURIComponent(escape(atob(String(content).replace(/\\s/g, ""))))); }
const origFetch = window.fetch.bind(window);
window.fetch = async function (input, init) {
  const url = typeof input === "string" ? input : (input && input.url) || "";
  if (!url.includes("api.github.com")) return origFetch(input, init);
  const method = (init && init.method) || "GET";
  const stored = localStorage.getItem("treningsapp-gh-token") || "";
  const header = init && init.headers && init.headers.Authorization || "";
  const entry = {
    method,
    keepalive: !!(init && init.keepalive),
    cache: (init && init.cache) || "",
    authLik: header === "Bearer " + stored.trim() && stored.trim().length > 0,
    ids: null,
    sha: null
  };
  if (init && init.body) {
    const b = JSON.parse(init.body);
    entry.sha = b.sha;
    entry.ids = (dekodInnhald(b.content).okter || []).map((o) => o.id + ":" + o.okt + ":" + (o.ferdig ? "1" : "0"));
  }
  window.__gh.log.push(entry);
  const mode = window.__gh.mode;
  if (mode === "throw" || (mode === "throw-once" && window.__gh.throwsLeft-- > 0)) throw new TypeError("Failed to fetch");
  if (mode === "keepalive-feil" && init && init.keepalive) throw new TypeError("Reached maximum amount of queued data of 64Kb for keepalive requests");
  if (method === "PUT" && window.__gh.putThrowsLeft > 0) { window.__gh.putThrowsLeft--; throw new TypeError("Failed to fetch"); }
  if (mode === "401" || mode === "403" || mode === "404" || mode === "500") {
    return new Response(JSON.stringify({ message: "stub" }), { status: Number(mode), headers: { "Content-Type": "application/json" } });
  }
  if (method === "PUT" && mode === "409-ein") {
    window.__gh.mode = "ok";
    window.__gh.sha = "sha-2";
    return new Response(JSON.stringify({ message: "conflict" }), { status: 409, headers: { "Content-Type": "application/json" } });
  }
  if (method === "GET") {
    return new Response(JSON.stringify({ sha: window.__gh.sha, encoding: "base64", content: kod(window.__gh.remote) }), { status: 200, headers: { "Content-Type": "application/json" } });
  }
  const b = JSON.parse(init.body);
  window.__gh.remote = dekodInnhald(b.content);
  window.__gh.sha = "sha-etter";
  return new Response(JSON.stringify({ content: { sha: "sha-etter" } }), { status: 200, headers: { "Content-Type": "application/json" } });
};
</script>
<script src="js/app.js"></script>
<script>
const TOKEN_KEY = "treningsapp-gh-token";
const LAGER = "treningsapp-data-v1";
const TOKEN = "github_pat_synthetic";
const SIST = "2026-11-04T13:55:00.000Z";
const ut = [];
function rein(s) { return String(s == null ? "" : s).replace(/github_pat_[A-Za-z0-9_]+/g, "[token]").slice(0, 220); }
function sjekk(name, ok, detail) { ut.push({ name, ok: !!ok, detail: ok ? "" : rein(detail || "feila") }); }
function okt(id, dato, bokstav, ferdig) {
  return { id, person: "a", dato, okt: bokstav, ferdig: !!ferdig, start: dato + "T10:00:00.000Z", slutt: ferdig ? dato + "T11:00:00.000Z" : "", score: null, kommentar: "", ovingar: { ov: { sett: [{ ferdig: !!ferdig, rep: 1, kg: 1 }], kommentar: "", lett: false } } };
}
function basis() {
  return [okt("syn-1102", "2026-11-02", "A", true), okt("syn-1104", "2026-11-04", "B", true), okt("syn-1106", "2026-11-06", "A", true)];
}
function seed(okter, remoteOkter) {
  const S = window.__treningsapp.state();
  S.versjon = 1; S.person = "atle"; S.innstillingar = { kgSteg: 1 };
  S.okter = okter || basis();
  S.vekt = [{ person: "a", dato: "2026-11-02", kg: 1 }];
  S.sletta = []; S.synkPending = true; S.sistSynk = SIST; S.sistEksport = null; S.sistTryggleikskopi = "2026-11-01";
  localStorage.setItem(LAGER, JSON.stringify(S));
  localStorage.setItem(TOKEN_KEY, TOKEN);
  window.__gh.mode = "ok"; window.__gh.sha = "sha-1"; window.__gh.log = [];
  window.__gh.throwsLeft = 0; window.__gh.putThrowsLeft = 0;
  window.__gh.remote = { versjon: 1, okter: remoteOkter || [okt("syn-1102", "2026-11-02", "A", true)], vekt: [], sletta: [], sistSynk: "2026-11-02T12:00:00.000Z" };
}
function lagra() { return JSON.parse(localStorage.getItem(LAGER)); }
function har(id) { return lagra().okter.some((o) => o.id === id && o.ferdig && (id !== "syn-1104" || o.okt === "B") && (id !== "syn-1106" || o.okt === "A")); }
function minneHar(id) { const S = window.__treningsapp.state(); return S.okter.some((o) => o.id === id && o.ferdig); }
function tokenUrord() { return localStorage.getItem(TOKEN_KEY) === TOKEN; }
function status() { const el = document.querySelector("#synkStatus"); return el ? el.textContent : ""; }
function toastNo() { const el = document.querySelector("#toast"); return el && !el.hidden ? el.textContent : ""; }
function gøymToast() { const el = document.querySelector("#toast"); el.hidden = true; el.textContent = ""; }
function setOnline(v) { Object.defineProperty(window.navigator, "onLine", { configurable: true, get: () => v }); }
async function vent(fn, n) {
  for (let i = 0; i < (n || 40); i++) { if (fn()) return true; await new Promise((r) => setTimeout(r, 25)); }
  return false;
}
async function telLagring(fn) {
  let n = 0;
  const orig = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k, v) { if (k === LAGER) n++; return orig.call(this, k, v); };
  try { await fn(); } finally { Storage.prototype.setItem = orig; }
  return n;
}
function sistePut() { const p = window.__gh.log.filter((x) => x.method === "PUT"); return p[p.length - 1]; }
function putIds(entry) { return entry && entry.ids ? entry.ids : []; }

async function kjor() {
  window.addEventListener("unhandledrejection", (e) => sjekk("rejection", false, e.reason && e.reason.message || e.reason));
  await vent(() => window.__treningsapp && document.querySelector("#app") && !document.querySelector("#app").textContent.includes("Lastar"));
  await new Promise((r) => setTimeout(r, 350));
  if (!window.__treningsapp) { sjekk("app-starta", false, document.body.textContent.slice(0, 120)); ferdig(); return; }
  window.__treningsapp.state().person = "atle";
  location.hash = "#/meir";
  await vent(() => document.querySelector("#synkStatus"));

  try {
    const api = window.__treningsapp;
    setOnline(true);
    sjekk("tekst-nett", api.synkFeilTekst("nett").status.includes("Nettlesaren melder ikkje nett") && !api.synkFeilTekst("nett").status.includes("GitHub"), api.synkFeilTekst("nett").status);
    sjekk("tekst-kontakt", api.synkFeilTekst("kontakt").status.includes("På nett") && api.synkFeilTekst("kontakt").status.includes("GitHub") && !api.synkFeilTekst("kontakt").status.includes("ikkje nett"), api.synkFeilTekst("kontakt").status);
    sjekk("tekst-401", api.synkFeilTekst(401).status.includes("401") && api.synkFeilTekst(401).alltid === true, api.synkFeilTekst(401).status);
    sjekk("tekst-403", api.synkFeilTekst(403).status.includes("403") && api.synkFeilTekst(403).status.includes("trening-logg"), api.synkFeilTekst(403).status);
    sjekk("tekst-404", api.synkFeilTekst(404).status.includes("404"), api.synkFeilTekst(404).status);
    localStorage.setItem(TOKEN_KEY, TOKEN);
    sjekk("kode-quota", api.transportKode(new TypeError("Reached maximum amount of queued data of 64Kb for keepalive requests")) === "keepalive", "feil kode");
    sjekk("kode-online-feil", api.transportKode(new TypeError("Failed to fetch")) === "kontakt", api.transportKode(new TypeError("Failed to fetch")));
    setOnline(false);
    sjekk("kode-flagg-av", api.transportKode(new TypeError("Failed to fetch")) === "nett", api.transportKode(new TypeError("Failed to fetch")));
    sjekk("kode-abort", api.transportKode(Object.assign(new Error("The operation was aborted"), { name: "AbortError" })) === "avbrote", "feil kode");
    setOnline(true);

    const medLinje = TOKEN + "\\n";
    localStorage.setItem(TOKEN_KEY, medLinje);
    const trimma = api.ghInit("GET", null, false);
    sjekk("trim-i-header", trimma.headers.Authorization === "Bearer " + TOKEN && localStorage.getItem(TOKEN_KEY) === medLinje, "header eller lagring");
    sjekk("foregrunn-utan-keepalive", api.ghInit("GET", null, false).keepalive !== true && api.ghInit("GET", null, false).cache === "no-store", "init");
    sjekk("liten-lukking-keepalive", api.ghInit("PUT", { message: "t", content: "e30", sha: "s", branch: "main" }, true).keepalive === true, "init");
    const stor = api.ghInit("PUT", { message: "t", content: "A".repeat(70000), sha: "s", branch: "main" }, true);
    sjekk("stor-kropp-utan-keepalive", stor.keepalive !== true && !!stor.body && stor.body.length > 48000, "storleik " + (stor.body ? stor.body.length : 0));

    const ufull = okt("syn-1104-ufull", "2026-11-04", "B", false);
    const merga = api.mergeState({
      versjon: 1, person: "atle", synkPending: true, sistTryggleikskopi: "2026-11-01", sistSynk: SIST,
      okter: basis(), vekt: [{ person: "a", dato: "2026-11-02", kg: 1 }], sletta: []
    }, { versjon: 1, okter: [okt("syn-1102", "2026-11-02", "A", true), ufull], vekt: [], sletta: [], sistSynk: "2026-11-02T12:00:00.000Z" });
    sjekk("merge-1104-B", merga.okter.some((o) => o.id === "syn-1104" && o.ferdig && o.okt === "B"), "manglar fullført");
    sjekk("merge-1106-A", merga.okter.some((o) => o.id === "syn-1106" && o.ferdig && o.okt === "A"), "manglar fullført");
    sjekk("merge-1102", merga.okter.some((o) => o.id === "syn-1102" && o.ferdig), "manglar");
    sjekk("merge-ikkje-ufull", !merga.okter.some((o) => o.id === "syn-1104-ufull"), "ufullført vann");
    sjekk("merge-kopi-og-vekt", merga.sistTryggleikskopi === "2026-11-01" && merga.vekt.length === 1 && merga.synkPending === true, "mista sidefelt");

    seed(basis(), [okt("syn-1102", "2026-11-02", "A", true), okt("syn-fjern", "2026-10-20", "A", true)]);
    gøymToast();
    const okSynk = await api.synk({ manuell: true });
    const put = sistePut();
    sjekk("suksess-retur", okSynk === true, String(okSynk));
    sjekk("suksess-utan-keepalive", window.__gh.log.every((x) => x.keepalive === false && x.cache === "no-store" && x.authLik), "kall " + window.__gh.log.length);
    sjekk("suksess-put-1104", putIds(put).some((x) => x.startsWith("syn-1104:B:1")), "put");
    sjekk("suksess-put-1106", putIds(put).some((x) => x.startsWith("syn-1106:A:1")), "put");
    sjekk("suksess-put-fjern", putIds(put).some((x) => x.startsWith("syn-fjern:A:1")), "put");
    sjekk("suksess-lagra", har("syn-1104") && har("syn-1106") && har("syn-1102") && lagra().okter.some((o) => o.id === "syn-fjern") && lagra().synkPending === false, "lagring");
    sjekk("suksess-token", tokenUrord(), "token");
    sjekk("suksess-kopi", lagra().sistTryggleikskopi === "2026-11-01" && lagra().vekt.length === 1, "sidefelt");
    sjekk("suksess-toast", toastNo().includes("Synka") && !toastNo().includes("ikkje nett"), toastNo());
    sjekk("suksess-ny-tid", lagra().sistSynk !== SIST, "sistSynk urørd");

    seed();
    window.__gh.mode = "throw-once"; window.__gh.throwsLeft = 1;
    gøymToast();
    await api.synk({ manuell: true });
    sjekk("retry-etter-eit-kast", har("syn-1104") && har("syn-1106") && lagra().synkPending === false && window.__gh.log.filter((x) => x.method === "GET").length >= 2, "logg " + window.__gh.log.length);
    sjekk("retry-token", tokenUrord(), "token");

    seed();
    window.__gh.mode = "throw";
    setOnline(true);
    const snap = localStorage.getItem(LAGER);
    gøymToast();
    const skrivKontakt = await telLagring(() => api.synk({ manuell: true }));
    sjekk("kontakt-ikkje-lagra", skrivKontakt === 0 && localStorage.getItem(LAGER) === snap, "skriv " + skrivKontakt);
    sjekk("kontakt-tekst", status().includes("På nett") && status().includes("GitHub") && !status().includes("ikkje nett"), status());
    sjekk("kontakt-toast", toastNo().includes("GitHub") && !toastNo().includes("ikkje nett"), toastNo());
    sjekk("kontakt-forsok", window.__gh.log.length === 2 && window.__gh.log.every((x) => x.method === "GET" && x.keepalive === false), "logg " + window.__gh.log.map((x) => x.method + (x.keepalive ? ":k" : "")).join(","));
    sjekk("kontakt-pending", lagra().synkPending === true && har("syn-1104") && har("syn-1106") && minneHar("syn-1104") && minneHar("syn-1106"), "manglar økt");
    sjekk("kontakt-token", tokenUrord(), "token");
    sjekk("kontakt-nettlinje", status().includes("Nettlesaren melder på nett"), status());

    seed();
    window.__gh.mode = "throw";
    setOnline(false);
    const snapAv = localStorage.getItem(LAGER);
    gøymToast();
    const skrivAv = await telLagring(() => api.synk({ manuell: true }));
    sjekk("av-flagg-tekst", status().includes("Nettlesaren melder ikkje nett") && !status().includes("GitHub svarte ikkje"), status());
    sjekk("av-flagg-likevel-kall", window.__gh.log.length >= 2, "kall " + window.__gh.log.length);
    sjekk("av-flagg-beheld", skrivAv === 0 && localStorage.getItem(LAGER) === snapAv && har("syn-1104") && har("syn-1106") && lagra().synkPending === true && tokenUrord(), "mista data");
    setOnline(true);
    window.__gh.mode = "ok"; window.__gh.log = [];
    await api.synk({ manuell: true });
    sjekk("av-flagg-deretter-ok", har("syn-1104") && har("syn-1106") && lagra().synkPending === false && tokenUrord() && (sistePut() && putIds(sistePut()).some((x) => x.startsWith("syn-1104:B:1"))), "etter retry");

    seed();
    window.__gh.mode = "throw";
    gøymToast();
    await api.synk({ stille: true });
    sjekk("stille-utan-toast", toastNo() === "" && status().includes("GitHub"), toastNo() || status());
    sjekk("stille-beheld", har("syn-1104") && har("syn-1106") && lagra().synkPending === true && tokenUrord(), "mista data");

    for (const kode of [401, 403, 404, 500]) {
      seed();
      window.__gh.mode = String(kode);
      gøymToast();
      const snapHttp = localStorage.getItem(LAGER);
      const skrivHttp = await telLagring(() => api.synk({ stille: true }));
      const st = status();
      sjekk("http-" + kode + "-tekst", st.includes(String(kode)) && !st.includes("ikkje nett"), st);
      sjekk("http-" + kode + "-eitt-kall", window.__gh.log.length === 1 && window.__gh.log[0].method === "GET", "logg " + window.__gh.log.length);
      sjekk("http-" + kode + "-beheld", skrivHttp === 0 && localStorage.getItem(LAGER) === snapHttp && har("syn-1104") && har("syn-1106") && tokenUrord() && lagra().synkPending === true, "mista data");
      if (kode === 401) sjekk("http-401-toast-stille", toastNo().includes("avvist"), toastNo());
    }

    seed(basis(), [okt("syn-1102", "2026-11-02", "A", true), okt("syn-1104-ufull", "2026-11-04", "B", false)]);
    window.__gh.mode = "409-ein";
    await api.synk({ manuell: true });
    const shas = window.__gh.log.filter((x) => x.method === "PUT").map((x) => x.sha);
    sjekk("konflikt-sha", shas[0] === "sha-1" && shas.includes("sha-2"), shas.join(","));
    sjekk("konflikt-beheld-1104", har("syn-1104") && !lagra().okter.some((o) => o.id === "syn-1104-ufull") && tokenUrord(), "ufullført erstatta");

    seed();
    window.__gh.putThrowsLeft = 5;
    const snapPut = localStorage.getItem(LAGER);
    const skrivPut = await telLagring(() => api.synk({ manuell: true }));
    sjekk("put-feil-ikkje-lagra", skrivPut === 0 && localStorage.getItem(LAGER) === snapPut, "skriv " + skrivPut);
    sjekk("put-feil-minne", minneHar("syn-1104") && minneHar("syn-1106") && har("syn-1104") && har("syn-1106") && lagra().synkPending === true && tokenUrord(), "mista økt");
    sjekk("put-feil-tekst", status().includes("GitHub") && !status().includes("ikkje nett"), status());

    seed();
    window.__gh.mode = "keepalive-feil";
    window.dispatchEvent(new Event("pagehide"));
    window.dispatchEvent(new Event("pagehide"));
    const venta = await vent(() => lagra().synkPending === false && lagra().sistSynk !== SIST);
    const kPut = window.__gh.log.filter((x) => x.method === "PUT" && x.keepalive).length;
    const vanlegPut = window.__gh.log.filter((x) => x.method === "PUT" && !x.keepalive).length;
    sjekk("pagehide-fullførte", venta && har("syn-1104") && har("syn-1106") && tokenUrord(), venta ? "ok" : "timeout");
    sjekk("pagehide-keepalive-så-vanleg", kPut === 1 && vanlegPut === 1, "k=" + kPut + " vanleg=" + vanlegPut);
    sjekk("pagehide-ikkje-dobbel-get", window.__gh.log.filter((x) => x.method === "GET" && x.keepalive).length === 1, "keepalive-get");

    const storOkter = basis();
    storOkter[2] = Object.assign({}, storOkter[2], { kommentar: "x".repeat(60000) });
    seed(storOkter);
    window.__gh.mode = "ok";
    window.dispatchEvent(new Event("pagehide"));
    const ventaStor = await vent(() => lagra().synkPending === false);
    sjekk("stor-pagehide-utan-keepalive-put", ventaStor && window.__gh.log.filter((x) => x.method === "PUT" && x.keepalive).length === 0 && har("syn-1106"), "put-keepalive " + window.__gh.log.filter((x) => x.method === "PUT" && x.keepalive).length);
    sjekk("stor-pagehide-token", tokenUrord() && lagra().okter.some((o) => o.id === "syn-1106" && o.kommentar && o.kommentar.length > 50000), "mista");
  } catch (e) {
    sjekk("unntak", false, e && e.stack || e);
  }
  ferdig();
}
function ferdig() {
  const ok = ut.length > 0 && ut.every((x) => x.ok);
  document.getElementById("ut").textContent = JSON.stringify({ ok, ut });
}
kjor();
</script>
`;

const types = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".css": "text/css", ".png": "image/png", ".webmanifest": "application/manifest+json", ".txt": "text/plain" };

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  if (url.pathname === "/harness.html") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    res.end(harness);
    return;
  }
  const rel = decodeURIComponent(url.pathname);
  const file = path.normalize(path.join(root, rel));
  if (!file.startsWith(root + path.sep) && file !== root) { res.writeHead(403); res.end("no"); return; }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); res.end("missing"); return; }
    res.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
    res.end(buf);
  });
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;
const userDir = path.join("/tmp", "chrome-synk-" + process.pid);
fs.rmSync(userDir, { recursive: true, force: true });
const outFile = path.join("/tmp", "synk-test-" + process.pid + ".html");
const errFile = path.join("/tmp", "synk-test-" + process.pid + ".err");
const args = ["--headless=new", "--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage", "--user-data-dir=" + userDir, "--virtual-time-budget=8000", "--dump-dom", "http://127.0.0.1:" + port + "/harness.html"];
const chrome = spawn("google-chrome", args, { stdio: ["ignore", "pipe", "pipe"] });
const out = fs.createWriteStream(outFile);
const err = fs.createWriteStream(errFile);
chrome.stdout.pipe(out);
chrome.stderr.pipe(err);
const code = await new Promise((resolve) => {
  const t = setTimeout(() => { chrome.kill("SIGKILL"); resolve(124); }, 25000);
  chrome.on("exit", (c) => { clearTimeout(t); resolve(c); });
});
await new Promise((r) => setTimeout(r, 100));
server.close();
const html = fs.readFileSync(outFile, "utf8");
const m = html.match(/<pre id="ut">([\s\S]*?)<\/pre>/);
if (!m) {
  console.error("Fekk ikkje testresultat. chrome-exit=" + code);
  console.error(html.slice(0, 800));
  process.exit(1);
}
let parsed;
try { parsed = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")); }
catch (e) {
  console.error("Klarte ikkje å lese resultat");
  console.error(m[1].slice(0, 800));
  process.exit(1);
}
let feil = 0;
for (const row of parsed.ut) {
  if (row.ok) console.log("ok  " + row.name);
  else { feil++; console.log("FEIL " + row.name + (row.detail ? " — " + row.detail : "")); }
}
console.log((parsed.ut.length - feil) + "/" + parsed.ut.length + " ok, chrome-exit=" + code);
fs.rmSync(userDir, { recursive: true, force: true });
process.exit(feil || !parsed.ok ? 1 : 0);
