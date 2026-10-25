/* Treningsapp for Atle og Audny – rein JS, ingen byggjesteg. Data: data/program.json (laga av scripts/build_data.py). */
(function () {
  "use strict";
  const LAGER = "treningsapp-data-v1";
  const $ = (s, el = document) => el.querySelector(s);
  const app = $("#app");
  let P = null; // programdata
  let S = null; // lagra data

  // ---------- hjelparar ----------
  const esc = (t) => String(t == null ? "" : t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pad = (n) => String(n).padStart(2, "0");
  const isoDato = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const idag = () => isoDato(new Date());
  const tilNorsk = (iso) => { const [y, m, d] = iso.split("-"); return `${d}.${m}.${y}`; };
  const VEKEDAGAR = ["sundag", "måndag", "tysdag", "onsdag", "torsdag", "fredag", "laurdag"];
  const MND = ["januar", "februar", "mars", "april", "mai", "juni", "juli", "august", "september", "oktober", "november", "desember"];
  const langDato = (iso) => { const d = new Date(iso + "T12:00:00"); return `${VEKEDAGAR[d.getDay()]} ${d.getDate()}. ${MND[d.getMonth()]}`; };
  const kgTekst = (kg) => (kg == null ? "" : String(Math.round(kg * 10) / 10).replace(".", ","));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const fmtTid = (s) => `${Math.floor(s / 60)}:${pad(s % 60)}`;

  function last() {
    try { S = JSON.parse(localStorage.getItem(LAGER)) || null; } catch (e) { S = null; }
    if (!S || S.versjon !== 1) S = { versjon: 1, person: null, innstillingar: { kgSteg: 1 }, okter: [], vekt: [] };
    S.innstillingar = Object.assign({ kgSteg: 1 }, S.innstillingar || {});
    if (S.sistEksport === undefined) S.sistEksport = null;
  }
  function lagre() { localStorage.setItem(LAGER, JSON.stringify(S)); }
  function toast(t) {
    const el = $("#toast"); el.textContent = t; el.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(() => (el.hidden = true), 2600);
  }
  const person = () => (S.person ? P.personar[S.person] : null);
  const scoreNamn = (pid) => P.personar[pid].scoreNamn;

  // ---------- kalender ----------
  function kalenderDag(iso) { return P.kalender.find((d) => d.dato === iso) || null; }
  function nesteStyrkedag(iso) { return P.kalender.find((d) => d.dato >= iso && d.type === "Styrke") || null; }
  function dagensPlan(iso) {
    const { start, slutt } = P.blokk;
    if (iso < start) { const n = nesteStyrkedag(start); return { fase: "for", neste: n }; }
    if (iso > slutt) return { fase: "etter" };
    const dag = kalenderDag(iso);
    if (dag && dag.type === "Styrke") return { fase: "styrke", dag };
    return { fase: "annan", dag, neste: nesteStyrkedag(iso) };
  }
  function sisteOktFor(pid) { return S.okter.filter((o) => o.person === pid).sort((a, b) => (a.dato + a.start < b.dato + b.start ? 1 : -1))[0]; }

  // ---------- historikk og progresjon ----------
  function ferdigeOkter(pid, utanId) {
    return S.okter.filter((o) => o.person === pid && o.ferdig && o.id !== utanId).sort((a, b) => (a.dato + a.start > b.dato + b.start ? 1 : -1));
  }
  function historikkFor(pid, exId, utanId) {
    return ferdigeOkter(pid, utanId).map((o) => ({ okt: o, data: o.ovingar[exId] })).filter((h) => h.data && h.data.sett.some((s) => s.ferdig));
  }
  function maxKg(data) { const k = data.sett.filter((s) => s.ferdig && s.kg != null).map((s) => s.kg); return k.length ? Math.max(...k) : null; }
  function minRep(data) { const r = data.sett.filter((s) => s.ferdig).map((s) => s.rep); return r.length ? Math.min(...r) : null; }
  function reint(ex, data) {
    const ferdig = data.sett.filter((s) => s.ferdig);
    if (ferdig.length < ex.sets || data.lett) return false;
    if (!ferdig.every((s) => s.rep >= ex.repMax)) return false;
    if (ex.type === "manual") { const k = ferdig.map((s) => s.kg); return k.every((x) => x === k[0]); }
    return true;
  }
  function nesteKg(kg) {
    const steg = Number(S.innstillingar.kgSteg) || 1, { min, max } = P.manual;
    if (!kg || kg < min) return min;
    return Math.min(max, Math.round((kg + steg) * 10) / 10);
  }
  function forrigeKg(kg, tillatNull) {
    const steg = Number(S.innstillingar.kgSteg) || 1, { min } = P.manual;
    if (kg == null) return min;
    if (kg <= min) return tillatNull ? 0 : min;
    return Math.max(min, Math.round((kg - steg) * 10) / 10);
  }
  function scoreForOkt(okt) {
    if (okt && okt.score) return okt.score;
    const f = ferdigeOkter(okt ? okt.person : S.person, okt && okt.id).filter((o) => o.score);
    return f.length ? f[f.length - 1].score : null;
  }

  /** Progresjonsråd etter reglane i arbeidsboka. Returnerer liste med {type, tekst, kg?, rep?} */
  function progresjon(pid, ex, okt) {
    const ut = [];
    const hist = historikkFor(pid, ex.id, okt && okt.id);
    const score = scoreForOkt(okt);
    const atle = pid === "atle";
    const dag = okt ? kalenderDag(okt.dato) : null;
    let stopp = false, hald = false;
    if (score >= 4) {
      stopp = true;
      ut.push({ type: "stopp", tekst: atle ? `Rygg ${score}: berre lett-variant (${ex.lett || "lettare utgåve"}) eller berre gåtur i dag.` : `Nakke/skulder ${score}: berre lett-variant eller berre haldningsøvingar i dag.` });
    } else if (score === 3) {
      hald = true;
      ut.push({ type: "hald", tekst: `${atle ? "Rygg" : "Nakke/skulder"} 3: ingen auke i dag – same kg og rep som sist.` });
    }
    if (atle && ex.atvaring) {
      if (!score || score > 2) { stopp = true; ut.push({ type: "stopp", tekst: `Berre ved Rygg 1–2. ${score ? "I dag:" : "Set ryggskåre først. Elles:"} ${ex.lett}.` }); }
      else ut.push({ type: "info", tekst: "Rygg 1–2: lett vekt, berre til knea, heilt nøytral rygg. Stopp ved stråling." });
    }
    if (dag && dag.veke === 4) { hald = true; ut.push({ type: "hald", tekst: "Veke 4: hald same kg som veke 3. Ta eitt sett mindre om de er slitne." }); }
    if (!hist.length) {
      if (ex.type === "manual") ut.push({ type: "info", tekst: `Første gong: start på ${ex.startKgTekst}. Juster slik at dei to siste repetisjonane er tunge, men reine.` });
      else ut.push({ type: "info", tekst: `Første gong: ${ex.settRep}. Juster slik at dei to siste repetisjonane er tunge, men reine.` });
      return ut;
    }
    const siste = hist[hist.length - 1].data, nestSiste = hist.length > 1 ? hist[hist.length - 2].data : null;
    const kg = maxKg(siste), rep = minRep(siste);
    const toReine = nestSiste && reint(ex, siste) && reint(ex, nestSiste) && (ex.type !== "manual" || maxKg(nestSiste) === kg);
    const eining = ex.unit === "s" ? "sek" : ex.unit === "m" ? "m" : "rep";
    // Audny: 3 kg minimum -> strikk
    if (!atle && ex.type === "manual" && kg != null && kg <= P.manual.min && kg > 0 && rep != null && ex.repMin && rep < ex.repMin) {
      ut.push({ type: "hald", tekst: `3 kg er lettaste innstilling. Bruk strikk (${ex.lett}) til du klarer ${ex.repMin} reine rep med 3 kg.` });
      return ut;
    }
    if (atle && ex.type === "manual" && rep != null && ex.repMin && ex.unit === "rep" && rep < ex.repMin - 1) {
      ut.push({ type: "hald", tekst: `Sist vart det berre ${rep} rep. Gå ned eitt steg (${kgTekst(forrigeKg(kg))} kg) og bygg opp att.`, kg: forrigeKg(kg) });
      return ut;
    }
    if (toReine && !stopp) {
      if (ex.type === "manual" && ex.unit !== "s") {
        if (kg >= P.manual.max) {
          ut.push({ type: "info", tekst: "Du er på 24 kg (taket på manualane). Auk heller med fleire rep, saktare tempo (3 s ned), 1–2 s pause i tyngste posisjon, eller eittbeins/eittarms variant." });
        } else if (hald) {
          ut.push({ type: "hald", tekst: `Klar for ${kgTekst(nesteKg(kg))} kg når dagen er god – men ikkje i dag.` });
        } else if (!atle && ex.gruppe === "Press" && !trekkKlar(pid, okt)) {
          ut.push({ type: "hald", tekst: "Trekk før press: auk roing og omvendt flyes først. Hald same kg på pressøvinga til trekkøvingane er auka." });
        } else {
          const n = nesteKg(kg), r = ex.unit === "m" ? ex.repMax : ex.repMin;
          ut.push({ type: "auke", tekst: `Reint øvst i intervallet to økter på rad! Prøv ${kgTekst(n)} kg${ex.unit === "rep" ? ` og start på ${r} rep` : ""}.`, kg: n, rep: r });
        }
      } else if (ex.unit === "s") {
        if (!hald) ut.push({ type: "auke", tekst: `Prøv ${rep + 5} sek (+5 sek per veke).`, rep: rep + 5 });
      } else if (ex.type === "strikk") {
        if (!hald) ut.push({ type: "auke", tekst: "Klar for tyngre strikk (eller gå lenger frå festet), start på " + ex.repMin + " rep.", rep: ex.repMin });
      } else if (!hald) {
        ut.push({ type: "auke", tekst: "Klar for litt meir: lengre hald (5–8 s) eller saktare tempo." });
      }
    } else if (!stopp && !hald) {
      if (ex.unit === "rep" && rep != null && ex.repMax && rep < ex.repMax) ut.push({ type: "info", tekst: `Bygg repetisjonar: sist ${rep} ${eining}${kg ? ` med ${kgTekst(kg)} kg` : ""}. Prøv 1–2 fleire (mål ${ex.repMax}).` });
      else ut.push({ type: "info", tekst: `Sist: ${rep} ${eining}${kg ? ` med ${kgTekst(kg)} kg` : ""}. Gjer det same reint éin gong til før du aukar.` });
    }
    return ut;
  }
  function trekkKlar(pid, okt) {
    const trekk = P.personar[pid].ovingar.filter((e) => e.gruppe === "Trekk" && e.type === "manual");
    return trekk.every((e) => {
      const h = historikkFor(pid, e.id, okt && okt.id);
      if (!h.length) return false;
      const kg = maxKg(h[h.length - 1].data);
      const reineTo = h.length > 1 && reint(e, h[h.length - 1].data) && reint(e, h[h.length - 2].data);
      return (kg != null && kg > (e.startKg || 0)) || reineTo;
    });
  }

  // ---------- økter ----------
  function startKgFor(ex, iso) {
    if (ex.type !== "manual") return null;
    if (ex.startKg === 0 && ex.targetKg) { const d = kalenderDag(iso); if (d && d.veke >= 2) return ex.targetKg; }
    return ex.startKg;
  }
  function tidlegDefault(pid) {
    const d = P.kalender.filter((k) => k.okt && k.dato < idag() && !S.okter.some((o) => o.person === pid && o.dato === k.dato && o.ferdig));
    return d.length ? d[0].dato : "2026-10-19";
  }
  function nyOkt(pid, oktBokstav, iso) {
    const dag = kalenderDag(iso);
    const o = { id: uid(), person: pid, dato: iso, start: new Date().toISOString(), okt: oktBokstav, oktNr: dag && dag.okt === oktBokstav ? dag.oktNr : null,
      veke: dag ? dag.veke : null, ferdig: false, score: null, kommentar: "", ovingar: {} };
    for (const ex of P.personar[pid].ovingar.filter((e) => e.okt === oktBokstav)) {
      const h = historikkFor(pid, ex.id, o.id);
      const sist = h.length ? h[h.length - 1].data : null;
      const sett = [];
      for (let i = 0; i < ex.sets; i++) {
        const fs = sist && (sist.sett[i] || sist.sett[sist.sett.length - 1]);
        sett.push({ rep: fs ? fs.rep : (ex.repMin || 0), kg: ex.type === "manual" ? (fs && fs.kg != null ? fs.kg : startKgFor(ex, iso)) : null, ferdig: false });
      }
      o.ovingar[ex.id] = { sett, kommentar: "", lett: false };
    }
    S.okter.push(o); lagre();
    return o;
  }
  const aktivOkt = (pid) => S.okter.find((o) => o.person === pid && !o.ferdig);

  // ---------- visingar ----------
  function setTittel(t) { $("#topTitle").textContent = t; document.title = t + " – Trening"; }
  function markerTab(t) { document.querySelectorAll(".tabbar a").forEach((a) => a.classList.toggle("aktiv", a.dataset.tab === t)); }
  function oppdaterPersonknapp() { $("#personBtn").textContent = S.person ? P.personar[S.person].namn + " ▾" : "Vel person"; }

  function visPersonval() {
    setTittel("Kven trenar?"); markerTab("");
    app.innerHTML = `<h2>Kven skal trene?</h2><p>Vel person. Appen hugsar valet til neste gong.</p>
      <div class="personval">${Object.entries(P.personar).map(([id, p]) => `<button class="knapp stor" data-person="${id}">${esc(p.namn)}</button>`).join("")}</div>`;
    app.querySelectorAll("[data-person]").forEach((b) => b.addEventListener("click", () => { S.person = b.dataset.person; lagre(); oppdaterPersonknapp(); location.hash = "#/idag"; rute(); }));
  }

  function oktKnapp(bokstav, tekst, cls = "") { return `<button class="knapp stor full ${cls}" data-start="${bokstav}">${esc(tekst)}</button>`; }

  function visIdag() {
    const pid = S.person, p = person(), iso = idag(), plan = dagensPlan(iso);
    setTittel(`I dag · ${p.namn}`); markerTab("idag");
    const aktiv = aktivOkt(pid);
    let h = `<h2>${esc(langDato(iso)[0].toUpperCase() + langDato(iso).slice(1))}</h2>`;
    if (aktiv) {
      h += `<div class="kort gul"><h3>Du har ei økt i gang</h3><p>Økt ${aktiv.okt} frå ${esc(langDato(aktiv.dato))}.</p>
        <a class="knapp stor full" href="#/okt/${aktiv.id}">Hald fram med økta</a></div>`;
    }
    const gjortIdag = S.okter.find((o) => o.person === pid && o.dato === iso && o.ferdig);
    if (gjortIdag) h += `<div class="kort gron"><h3>✓ Økt ${gjortIdag.okt} er fullført i dag</h3><p>Bra jobba! Sjå «Framgang» for oversikt.</p></div>`;
    if (plan.fase === "for") {
      h += `<div class="kort"><h3>Ny blokk startar måndag 19. oktober</h3>
        <p>Fram til sundag 18.10 følgjer de det gamle programmet. Første økt i den nye blokka er <strong>økt ${plan.neste.okt}</strong> ${esc(langDato(plan.neste.dato))}.</p></div>`;
      if (!aktiv) h += `<div class="knapprad">${oktKnapp(plan.neste.okt, `Prøv økt ${plan.neste.okt} no likevel`, "sekundar")}${oktKnapp(plan.neste.okt === "A" ? "B" : "A", `Prøv økt ${plan.neste.okt === "A" ? "B" : "A"}`, "sekundar")}</div>`;
    } else if (plan.fase === "styrke") {
      h += `<div class="kort"><p class="liten">Veke ${plan.dag.veke} · økt ${plan.dag.oktNr} av 12</p><h3>I dag: Styrkeøkt <span class="merke">${plan.dag.okt}</span></h3>
        <p>${esc(plan.dag.tid)} med oppvarming og avslutning.</p></div>`;
      if (!aktiv && !gjortIdag) h += oktKnapp(plan.dag.okt, `Start økt ${plan.dag.okt}`) + `<div class="knapprad">${oktKnapp(plan.dag.okt === "A" ? "B" : "A", `Byt til økt ${plan.dag.okt === "A" ? "B" : "A"}`, "sekundar")}</div>`;
    } else if (plan.fase === "annan") {
      h += `<div class="kort"><p class="liten">Veke ${plan.dag.veke}</p><h3>I dag: ${esc(plan.dag.type)}</h3><p>${esc(plan.dag[pid])} (${esc(plan.dag.tid)})</p>
        ${plan.dag.type === "Gåtur" ? `<p class="liten">Dårleg vêr? Bruk tredemølla eller spinningsykkelen.</p>` : ""}</div>`;
      if (plan.neste) h += `<div class="kort"><p>Neste styrkeøkt: <strong>økt ${plan.neste.okt}</strong> ${esc(langDato(plan.neste.dato))}.</p></div>`;
      if (!aktiv && plan.neste) h += `<details><summary>Tok de ikkje økta i går? Start likevel</summary><div class="knapprad">${oktKnapp(plan.neste.okt, `Start økt ${plan.neste.okt}`, "sekundar")}${oktKnapp(plan.neste.okt === "A" ? "B" : "A", `Start økt ${plan.neste.okt === "A" ? "B" : "A"}`, "sekundar")}</div></details>`;
    } else {
      const sist = ferdigeOkter(pid).pop();
      const forslag = sist ? (sist.okt === "A" ? "B" : "A") : "A";
      h += `<div class="kort"><h3>Blokka 19.10–15.11 er ferdig</h3><p>Vel økt fritt. Forslag: <strong>økt ${forslag}</strong>${sist ? ` (sist: økt ${sist.okt})` : ""}.</p></div>`;
      if (!aktiv) h += `<div class="knapprad">${oktKnapp(forslag, `Start økt ${forslag}`)}${oktKnapp(forslag === "A" ? "B" : "A", `Start økt ${forslag === "A" ? "B" : "A"}`, "sekundar")}</div>`;
    }
    const vd = new Date(iso + "T12:00:00").getDay();
    const gamal = !S.sistEksport || (new Date(iso + "T12:00:00") - new Date(S.sistEksport + "T12:00:00")) / 864e5 > 6;
    if (vd === 0 || vd === 6 || (gamal && S.okter.some((o) => o.ferdig))) h += `<div class="kort"><h3>Send loggen til OneDrive</h3>${STEG}
      <button class="knapp stor full" id="ekspXlsxIdag">Del logg for begge (Excel)</button>${S.sistEksport ? `<p class="liten">Sist sendt: ${tilNorsk(S.sistEksport)}</p>` : ""}</div>`;
    // vekt
    h += vektKort(pid);
    app.innerHTML = h;
    app.querySelectorAll("[data-start]").forEach((b) => b.addEventListener("click", () => {
      const a = aktivOkt(pid);
      if (a) { location.hash = "#/okt/" + a.id; return; }
      const o = nyOkt(pid, b.dataset.start, iso); location.hash = "#/okt/" + o.id;
    }));
    kobleVekt(pid);
    const ek = $("#ekspXlsxIdag"); if (ek) ek.addEventListener("click", delXlsx);
  }

  function vektKort(pid) {
    const p = P.personar[pid];
    const v = S.vekt.filter((x) => x.person === pid).sort((a, b) => (a.dato > b.dato ? 1 : -1));
    const sist = v[v.length - 1];
    const mal = pid === "atle" ? `Mål: ${kgTekst(p.malVekt)} kg` : `Hald vekta – ikkje under ${p.minVekt} kg`;
    return `<div class="kort"><h3>Kroppsvekt</h3><p class="liten">${mal}. Veg deg same morgon kvar veke, i lette klede.</p>
      ${sist ? `<p>Sist: <strong>${kgTekst(sist.kg)} kg</strong> (${tilNorsk(sist.dato)})</p>` : ""}
      <label class="felt" for="vektInn">Vekt i dag (kg)</label>
      <input id="vektInn" type="text" inputmode="decimal" autocomplete="off" pattern="[0-9]+([,.][0-9])?" placeholder="${sist ? kgTekst(sist.kg) : ""}">
      <div class="knapprad"><button class="knapp" id="vektLagre">Lagre vekt</button></div></div>`;
  }
  function kobleVekt(pid) {
    const b = $("#vektLagre"); if (!b) return;
    b.addEventListener("click", () => {
      const v = parseFloat(String($("#vektInn").value).replace(",", "."));
      if (!(v > 30 && v < 200)) { toast("Skriv inn vekta i kg, t.d. 75,2"); return; }
      const iso = idag();
      S.vekt = S.vekt.filter((x) => !(x.person === pid && x.dato === iso));
      S.vekt.push({ id: uid(), person: pid, dato: iso, kg: Math.round(v * 10) / 10 }); lagre();
      toast(`Vekt lagra: ${kgTekst(v)} kg`); rute();
    });
  }

  function videoKnappar(vkey) {
    const g = P.guide.find((x) => x.id === vkey); if (!g) return "";
    return `<div class="video-knappar"><a class="knapp sekundar" href="${esc(g.videoUrl)}" target="_blank" rel="noopener">▶ Sjå video</a>
      ${g.reserveUrl ? `<a class="knapp sekundar" href="${esc(g.reserveUrl)}" target="_blank" rel="noopener">▶ Reservevideo</a>` : ""}</div>
      <p class="liten">Kjelde: ${esc(g.kjelde)}${g.merknad ? ". " + esc(g.merknad) : ""}</p>`;
  }

  function stepper(kind, i, verdi, eining) {
    return `<div class="stepper" data-kind="${kind}" data-i="${i}"><button type="button" data-d="-1" aria-label="Mindre ${eining}">−</button>
      <span class="verdi">${kind === "kg" ? kgTekst(verdi) : verdi}<span class="eining">${eining}</span></span>
      <button type="button" data-d="1" aria-label="Meir ${eining}">+</button></div>`;
  }

  function oevingHtml(okt, ex) {
    const d = okt.ovingar[ex.id];
    const alle = d.sett.every((s) => s.ferdig);
    const hint = progresjon(okt.person, ex, okt);
    const eining = ex.unit === "s" ? "sek" : ex.unit === "m" ? "meter" : "rep";
    const kgEining = ex.twoDumbbells ? "kg/manual" : "kg";
    let h = `<section class="kort oving ${alle ? "ferdig" : ""} ${ex.atvaring ? "atvaring" : ""}" id="ex-${ex.id}" data-ex="${ex.id}">
      <p class="liten">Øving ${ex.nr}${ex.gruppe ? " · " + esc(ex.gruppe) : ""}</p>
      <h3>${alle ? "✓ " : ""}${esc(ex.namn)}</h3>
      <dl class="fakta"><dt>Sett × rep</dt><dd>${esc(ex.settRep)}</dd>
        <dt>Start</dt><dd>${esc(ex.startKgTekst)}</dd>
        <dt>Pause</dt><dd>${esc(ex.pauseTekst)}</dd>
        <dt>Lett</dt><dd>${esc(ex.lett)}</dd></dl>
      <p>${esc(ex.korleis)}</p>
      ${ex.merknad ? `<p class="${ex.atvaring ? "hint stopp" : "liten"}">${esc(ex.merknad)}</p>` : ""}
      ${videoKnappar(ex.video)}
      ${hint.map((x) => `<div class="hint ${x.type}">${esc(x.tekst)}${x.kg != null || x.rep != null ? ` <button class="knapp sekundar" data-bruk='${JSON.stringify({ kg: x.kg ?? null, rep: x.rep ?? null })}'>Bruk forslaget</button>` : ""}</div>`).join("")}
      <label class="felt"><input type="checkbox" data-lett ${d.lett ? "checked" : ""} style="width:28px;height:28px;vertical-align:middle"> Eg gjer lett-varianten i dag</label>`;
    d.sett.forEach((s, i) => {
      h += `<div class="sett" data-i="${i}"><span class="nr">Sett ${i + 1}</span>
        ${stepper("rep", i, s.rep, eining)}
        ${ex.type === "manual" ? stepper("kg", i, s.kg, kgEining) : `<span class="liten utstyr">${ex.type === "strikk" ? "Strikk" : ex.type === "kroppsvekt" ? "Kroppsvekt" : ""}</span>`}
        <button type="button" class="hak" data-hak="${i}" aria-pressed="${s.ferdig}" aria-label="Sett ${i + 1} ferdig">✓</button></div>`;
    });
    h += `<label class="felt" for="k-${ex.id}">Kommentar</label><input type="text" id="k-${ex.id}" data-kommentar value="${esc(d.kommentar)}" placeholder="T.d. kjendest lett, vondt i …">
      ${ex.pauseSek ? `<div class="knapprad"><button class="knapp sekundar" data-pause="${ex.pauseSek}">⏱ Start pause (${fmtTid(ex.pauseSek)})</button></div>` : ""}
      </section>`;
    return h;
  }

  function visOkt(id) {
    const okt = S.okter.find((o) => o.id === id);
    if (!okt) { location.hash = "#/idag"; return; }
    if (okt.person !== S.person) { S.person = okt.person; lagre(); oppdaterPersonknapp(); }
    const p = P.personar[okt.person];
    setTittel(`Økt ${okt.okt} · ${p.namn}`); markerTab("idag");
    const ovingar = p.ovingar.filter((e) => e.okt === okt.okt);
    const antal = ovingar.filter((e) => okt.ovingar[e.id].sett.every((s) => s.ferdig)).length;
    const atle = okt.person === "atle";
    let h = `<div class="okt-hovud"><h2>Økt <span class="merke">${okt.okt}</span> · ${esc(langDato(okt.dato))}</h2>
      <span class="liten">${okt.oktNr ? `Økt ${okt.oktNr} av 12 · veke ${okt.veke}` : ""}${okt.ferdig ? " · fullført" : ""}</span></div>
      <p><strong>${antal} av ${ovingar.length}</strong> øvingar ferdige.</p>
      <div class="kort"><h3>${atle ? "Korleis er ryggen i dag?" : "Korleis er nakke og skuldrer i dag?"}</h3>
        <p class="liten">${esc(p.scoreTekst)}</p>
        <div class="score" role="group" aria-label="${esc(p.scoreNamn)} 1–5">${[1, 2, 3, 4, 5].map((n) => `<button type="button" class="s${n}" data-score="${n}" aria-pressed="${okt.score === n}">${n}</button>`).join("")}</div>
        ${okt.score >= 4 ? `<div class="hint stopp">${atle ? "Rygg 4–5: berre lett-variantar, eller gjer dagen om til ein rolig gåtur." : "4–5: berre lett-variantar, eller berre haldningsøvingane i dag."} Ikkje «stå han av».</div>` : ""}
      </div>
      <details class="kort"><summary>Oppvarming (8–10 min)</summary><p>${esc(P.start.oppvarming)}</p></details>`;
    h += ovingar.map((ex) => oevingHtml(okt, ex)).join("");
    h += `<details class="kort" open><summary>Avslutning</summary>${p.notat.slice(0, 2).map((t) => `<p>${esc(t)}</p>`).join("")}</details>
      <div class="kort"><label class="felt" for="oktKommentar">Kommentar til økta</label>
      <textarea id="oktKommentar" placeholder="Korleis gjekk det?">${esc(okt.kommentar)}</textarea></div>
      ${okt.ferdig ? `<div class="kort gron"><h3>✓ Økta er fullført</h3><p>Du kan framleis rette tal her.</p></div>`
        : `<button class="knapp stor full gron" id="fullfor">Fullfør økta</button>`}
      <div class="knapprad"><button class="knapp fare" id="slettOkt">Slett økta</button></div>`;
    app.innerHTML = h;
    kobleOkt(okt);
  }

  function kobleOkt(okt) {
    const p = P.personar[okt.person];
    const exById = Object.fromEntries(p.ovingar.map((e) => [e.id, e]));
    app.querySelectorAll("[data-score]").forEach((b) => b.addEventListener("click", () => { okt.score = Number(b.dataset.score); lagre(); bevarScroll(() => visOkt(okt.id)); }));
    app.querySelectorAll("section.oving").forEach((sec) => {
      const ex = exById[sec.dataset.ex], d = okt.ovingar[ex.id];
      sec.querySelectorAll(".stepper button").forEach((b) => b.addEventListener("click", () => {
        const st = b.closest(".stepper"), i = Number(st.dataset.i), dir = Number(b.dataset.d), s = d.sett[i];
        if (st.dataset.kind === "rep") {
          const steg = ex.unit === "s" ? 5 : ex.unit === "m" ? 10 : 1;
          s.rep = Math.max(0, (s.rep || 0) + dir * steg);
          for (let j = i + 1; j < d.sett.length; j++) if (!d.sett[j].ferdig) d.sett[j].rep = s.rep;
        } else {
          const tillatNull = ex.startKg === 0;
          s.kg = dir > 0 ? nesteKg(s.kg) : forrigeKg(s.kg, tillatNull);
          for (let j = i + 1; j < d.sett.length; j++) if (!d.sett[j].ferdig) d.sett[j].kg = s.kg;
        }
        lagre(); bevarScroll(() => visOkt(okt.id));
      }));
      sec.querySelectorAll("[data-hak]").forEach((b) => b.addEventListener("click", () => {
        lasOppLyd();
        const s = d.sett[Number(b.dataset.hak)]; s.ferdig = !s.ferdig; lagre();
        if (s.ferdig && ex.pauseSek && d.sett.some((x) => !x.ferdig)) startTimar(ex.pauseSek, ex.namn);
        bevarScroll(() => visOkt(okt.id));
      }));
      const k = sec.querySelector("[data-kommentar]");
      k.addEventListener("change", () => { d.kommentar = k.value; lagre(); });
      sec.querySelector("[data-lett]").addEventListener("change", (e) => { d.lett = e.target.checked; lagre(); });
      sec.querySelectorAll("[data-bruk]").forEach((b) => b.addEventListener("click", () => {
        const f = JSON.parse(b.dataset.bruk);
        d.sett.forEach((s) => { if (!s.ferdig) { if (f.kg != null) s.kg = f.kg; if (f.rep != null) s.rep = f.rep; } });
        lagre(); toast("Forslaget er lagt inn"); bevarScroll(() => visOkt(okt.id));
      }));
      const pb = sec.querySelector("[data-pause]");
      if (pb) pb.addEventListener("click", () => { lasOppLyd(); startTimar(Number(pb.dataset.pause), ex.namn); });
    });
    $("#oktKommentar").addEventListener("change", (e) => { okt.kommentar = e.target.value; lagre(); });
    const f = $("#fullfor");
    if (f) f.addEventListener("click", () => {
      const ingen = !Object.values(okt.ovingar).some((d) => d.sett.some((s) => s.ferdig));
      if (ingen && !confirm("Ingen sett er haka av. Vil du likevel fullføre økta?")) return;
      okt.ferdig = true; okt.slutt = new Date().toISOString(); lagre(); stoppTimar();
      toast("Økta er lagra. Bra jobba!"); location.hash = "#/framgang";
    });
    $("#slettOkt").addEventListener("click", () => {
      if (!confirm("Vil du slette heile økta? Dette kan ikkje angrast.")) return;
      S.okter = S.okter.filter((o) => o.id !== okt.id); lagre(); stoppTimar(); location.hash = "#/idag";
    });
    vekeLas();
  }
  function bevarScroll(fn) { const y = window.scrollY; fn(); window.scrollTo(0, y); }

  // ---------- pausetimar ----------
  let timar = null, lyd = null;
  function lasOppLyd() { try { if (!lyd) lyd = new (window.AudioContext || window.webkitAudioContext)(); if (lyd.state === "suspended") lyd.resume(); } catch (e) {} }
  function pip() {
    try { if (!lyd) return; [0, 0.35, 0.7].forEach((t) => { const o = lyd.createOscillator(), g = lyd.createGain(); o.frequency.value = 880; o.connect(g); g.connect(lyd.destination);
      g.gain.setValueAtTime(0.3, lyd.currentTime + t); o.start(lyd.currentTime + t); o.stop(lyd.currentTime + t + 0.2); }); } catch (e) {}
    if (navigator.vibrate) navigator.vibrate([300, 150, 300]);
  }
  function startTimar(sek, namn) {
    stoppTimar(true);
    const el = $("#timer"); el.hidden = false; el.classList.remove("klar"); document.body.classList.add("timar-paa");
    timar = { slutt: Date.now() + sek * 1000, namn };
    $("#timerLabel").textContent = "Pause";
    const tikk = () => {
      if (!timar) return;
      const igjen = Math.max(0, Math.round((timar.slutt - Date.now()) / 1000));
      $("#timerTime").textContent = fmtTid(igjen);
      if (igjen <= 0) { el.classList.add("klar"); $("#timerLabel").textContent = "Klar for neste sett!"; $("#timerTime").textContent = ""; pip(); clearInterval(timar.iv); timar.iv = null; }
    };
    timar.iv = setInterval(tikk, 250); tikk();
  }
  function stoppTimar() { if (timar && timar.iv) clearInterval(timar.iv); timar = null; $("#timer").hidden = true; document.body.classList.remove("timar-paa"); }
  $("#timerPlus").addEventListener("click", () => { if (timar) { if (!timar.iv) startTimar(15, timar.namn); else timar.slutt += 15000; } });
  $("#timerStop").addEventListener("click", stoppTimar);
  let vekeLock = null;
  async function vekeLas() { try { if ("wakeLock" in navigator && !vekeLock) { vekeLock = await navigator.wakeLock.request("screen"); vekeLock.addEventListener("release", () => (vekeLock = null)); } } catch (e) {} }

  // ---------- framgang ----------
  function linjegraf(punkt, { mal = null, eining = "kg", tittel = "" } = {}) {
    if (!punkt.length) return `<p class="liten">Ingen data enno.</p>`;
    const smal = window.innerWidth < 600, W = smal ? 340 : 640, H = smal ? 240 : 260, FS = smal ? 22 : 18, m = { l: smal ? 52 : 56, r: 12, t: 24, b: 44 };
    const ys = punkt.map((p) => p.y).concat(mal != null ? [mal] : []);
    let lo = Math.min(...ys), hi = Math.max(...ys); if (hi - lo < 2) { lo -= 1; hi += 1; }
    lo = Math.floor(lo - 0.5); hi = Math.ceil(hi + 0.5);
    const xs = punkt.map((p) => new Date(p.x + "T12:00:00").getTime());
    let x0 = Math.min(...xs), x1 = Math.max(...xs); if (x1 === x0) { x0 -= 86400000 * 3; x1 += 86400000 * 3; }
    const X = (t) => m.l + ((t - x0) / (x1 - x0)) * (W - m.l - m.r), Y = (v) => m.t + (1 - (v - lo) / (hi - lo)) * (H - m.t - m.b);
    const linje = punkt.map((p, i) => `${i ? "L" : "M"}${X(xs[i]).toFixed(1)},${Y(p.y).toFixed(1)}`).join(" ");
    const steg = Math.max(1, Math.round((hi - lo) / 4));
    let g = `<svg class="graf" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(tittel)}">`;
    for (let v = lo; v <= hi; v += steg) g += `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(v)}" y2="${Y(v)}" stroke="#E5DDD2"/><text x="${m.l - 8}" y="${Y(v) + 6}" font-size="${FS}" text-anchor="end" fill="#4A3F35">${v}</text>`;
    if (mal != null) g += `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(mal)}" y2="${Y(mal)}" stroke="#1E6B34" stroke-width="3" stroke-dasharray="10 6"/><text x="${W - m.r}" y="${Y(mal) - 8}" font-size="${FS}" text-anchor="end" fill="#1E6B34" font-weight="700">Mål ${kgTekst(mal)} ${eining}</text>`;
    g += `<path d="${linje}" fill="none" stroke="#7A3A16" stroke-width="4"/>`;
    punkt.forEach((p, i) => (g += `<circle cx="${X(xs[i])}" cy="${Y(p.y)}" r="7" fill="#7A3A16"/>`));
    g += `<text x="${m.l}" y="${H - 12}" font-size="${FS}" fill="#4A3F35">${tilNorsk(punkt[0].x).slice(0, 5)}</text><text x="${W - m.r}" y="${H - 12}" font-size="${FS}" text-anchor="end" fill="#4A3F35">${tilNorsk(punkt[punkt.length - 1].x).slice(0, 5)}</text></svg>`;
    return g;
  }
  function visFramgang(valEx) {
    const pid = S.person, p = person();
    setTittel(`Framgang · ${p.namn}`); markerTab("framgang");
    const okter = ferdigeOkter(pid);
    const iBlokk = okter.filter((o) => o.dato >= P.blokk.start && o.dato <= P.blokk.slutt);
    const vekt = S.vekt.filter((v) => v.person === pid).sort((a, b) => (a.dato > b.dato ? 1 : -1));
    let h = `<h2>Framgang for ${esc(p.namn)}</h2>
      <div class="to-kol"><div class="kort"><h3>Økter i blokka</h3><p style="font-size:2rem;margin:0"><strong>${iBlokk.length}</strong> av 12</p><p class="liten">19.10–15.11.2026 · totalt ${okter.length} fullførte</p></div>
      <div class="kort"><h3>Kroppsvekt</h3>${vekt.length ? `<p style="font-size:2rem;margin:0"><strong>${kgTekst(vekt[vekt.length - 1].kg)}</strong> kg</p><p class="liten">${pid === "atle" ? `Mål ${kgTekst(p.malVekt)} kg · ${vekt.length > 1 ? `endring ${kgTekst(Math.round((vekt[vekt.length - 1].kg - vekt[0].kg) * 10) / 10)} kg` : ""}` : `Hald over ${p.minVekt} kg`}</p>` : `<p class="liten">Ingen vekt lagra enno.</p>`}</div></div>
      <div class="kort"><h3>Vektutvikling</h3>${linjegraf(vekt.map((v) => ({ x: v.dato, y: v.kg })), { mal: pid === "atle" ? p.malVekt : p.minVekt, tittel: "Vektutvikling" })}</div>`;
    // beste per øving
    h += `<div class="kort"><h3>Beste per øving</h3><p class="liten">Trykk på ei øving for å sjå utviklinga.</p><table class="tabell"><thead><tr><th>Øving</th><th>Beste kg</th><th>Flest</th><th>Gonger</th></tr></thead><tbody>`;
    for (const ex of p.ovingar) {
      const hist = historikkFor(pid, ex.id);
      const kg = hist.map((x) => maxKg(x.data)).filter((x) => x != null);
      const rep = hist.flatMap((x) => x.data.sett.filter((s) => s.ferdig).map((s) => s.rep));
      const ein = ex.unit === "s" ? " sek" : ex.unit === "m" ? " m" : "";
      h += `<tr><td><a href="#/framgang/${encodeURIComponent(ex.id)}">${esc(ex.namn)}</a> <span class="liten">(${ex.okt})</span></td><td>${kg.length ? kgTekst(Math.max(...kg)) : "–"}</td><td>${rep.length ? Math.max(...rep) + ein : "–"}</td><td>${hist.length}</td></tr>`;
    }
    h += `</tbody></table></div>`;
    if (valEx) {
      const ex = p.ovingar.find((e) => e.id === valEx);
      if (ex) {
        const hist = historikkFor(pid, ex.id);
        const pkt = hist.map((x) => ({ x: x.okt.dato, y: ex.type === "manual" ? maxKg(x.data) : minRep(x.data) })).filter((q) => q.y != null);
        h += `<div class="kort" id="exGraf"><h3>${esc(ex.namn)}</h3><p class="liten">${ex.type === "manual" ? "Kg per manual (tyngste sett)" : "Rep/sek i svakaste sett"}</p>${linjegraf(pkt, { eining: ex.type === "manual" ? "kg" : "", tittel: ex.namn })}</div>`;
      }
    }
    h += `<div class="kort"><h3>Fullførte økter</h3>${okter.length ? `<table class="tabell"><thead><tr><th>Dato</th><th>Økt</th><th>${esc(p.scoreNamn)}</th><th>Sett</th></tr></thead><tbody>${okter.slice().reverse().map((o) => {
      const n = Object.values(o.ovingar).reduce((a, d) => a + d.sett.filter((s) => s.ferdig).length, 0);
      return `<tr><td><a href="#/okt/${o.id}">${tilNorsk(o.dato)}</a></td><td>${o.okt}</td><td>${o.score || "–"}</td><td>${n}</td></tr>`;
    }).join("")}</tbody></table>` : `<p>Ingen fullførte økter enno.</p>`}</div>`;
    app.innerHTML = h;
    if (valEx) { const g = $("#exGraf"); if (g) g.scrollIntoView(); }
  }

  // ---------- øvingsguide ----------
  function visOvingar() {
    setTittel("Øvingar"); markerTab("ovingar");
    const pid = S.person;
    let h = `<h2>Alle øvingane (${P.guide.length})</h2><p>Teknikk, typiske feil og video. Videoane opnar i YouTube.</p>
      <label class="felt" for="sok">Søk</label><input id="sok" type="text" placeholder="T.d. roing, planke …">`;
    h += P.guide.map((g) => `<details class="kort guide" data-namn="${esc(g.namn.toLowerCase())}"><summary>${esc(g.namn)}</summary>
      <p class="liten">Gjeld: ${esc(g.gjeld)}</p><p><strong>Slik:</strong> ${esc(g.teknikk)}</p><p><strong>Typiske feil:</strong> ${esc(g.feil)}</p>
      ${videoKnappar(g.id)}</details>`).join("");
    app.innerHTML = h;
    $("#sok").addEventListener("input", (e) => {
      const q = e.target.value.trim().toLowerCase();
      app.querySelectorAll(".guide").forEach((d) => d.classList.toggle("skjult", q && !d.dataset.namn.includes(q)));
    });
  }

  // ---------- eksport ----------
  const KOLONNAR = (pid) => ["Økt nr.", "Dato", "Veke", "Økt", "Øving", "Plan (sett × rep)", "Sett gjort", "Rep per sett", "Kg (per manual)", P.personar[pid].scoreNamn + " 1–5", "Kommentar"];
  function loggRader(pid) {
    const p = P.personar[pid], rader = [];
    const okter = S.okter.filter((o) => o.person === pid).sort((a, b) => (a.dato + a.start > b.dato + b.start ? 1 : -1));
    for (const o of okter) for (const ex of p.ovingar.filter((e) => e.okt === o.okt)) {
      const d = o.ovingar[ex.id]; if (!d) continue;
      const fs = d.sett.filter((s) => s.ferdig);
      if (!fs.length && !d.kommentar) continue;
      const detalj = fs.length ? `rep ${fs.map((s) => s.rep).join("/")}${ex.type === "manual" ? `, kg ${fs.map((s) => kgTekst(s.kg)).join("/")}` : ""}` : "";
      const komm = [d.lett ? "Lett-variant" : "", d.kommentar, detalj, o.ferdig ? "" : "ikkje fullført"].filter(Boolean).join("; ");
      rader.push([o.oktNr ?? "", tilNorsk(o.dato), o.veke ?? "", o.okt, ex.namn, ex.settRep, fs.length, fs.length ? minRep(d) : "", ex.type === "manual" && fs.length ? maxKg(d) : "", o.score ?? "", komm]);
    }
    return rader;
  }
  function csvFor(pid) {
    const celle = (v) => { let s = typeof v === "number" ? String(v).replace(".", ",") : String(v ?? ""); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const linjer = [KOLONNAR(pid), ...loggRader(pid)].map((r) => r.map(celle).join(";"));
    return "\ufeff" + linjer.join("\r\n") + "\r\n";
  }
  async function delFil(blob, filnamn, tittel) {
    const fil = new File([blob], filnamn, { type: blob.type });
    if (navigator.canShare && navigator.canShare({ files: [fil] })) {
      try { await navigator.share({ files: [fil], title: tittel }); return "delt"; }
      catch (e) { if (e && e.name === "AbortError") return "avbrote"; }
    }
    const url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = filnamn; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return "lasta ned";
  }
  const STEG = `<ol class="steg"><li>Trykk knappen under</li><li>Vel «Lagre i Filer»</li><li>OneDrive → DOK → Helse → Trening</li></ol>`;
  function eksportOk(r) { if (r === "avbrote") return; S.sistEksport = idag(); lagre(); toast("Hugs: lagre i OneDrive → DOK/Helse/Trening"); }
  async function delXlsx() {
    try { const b = await eksporterXlsx(); eksportOk(await delFil(b, `Treningslogg_Atle_og_Audny_${idag()}.xlsx`, "Treningslogg")); }
    catch (e) { toast("Klarte ikkje å lage Excel-fila"); }
  }
  function lastSkript(src) { return new Promise((ok, feil) => { if (window.XLSX) return ok(); const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = feil; document.head.appendChild(s); }); }
  async function eksporterXlsx() {
    await lastSkript("vendor/xlsx.mini.min.js");
    const wb = XLSX.utils.book_new();
    for (const pid of Object.keys(P.personar)) {
      const ws = XLSX.utils.aoa_to_sheet([KOLONNAR(pid), ...loggRader(pid)]);
      ws["!cols"] = [7, 12, 6, 6, 34, 18, 10, 12, 14, 14, 50].map((w) => ({ wch: w }));
      XLSX.utils.book_append_sheet(wb, ws, "Logg " + P.personar[pid].namn);
    }
    const v = [["Person", "Dato", "Vekt (kg)"], ...S.vekt.slice().sort((a, b) => (a.dato > b.dato ? 1 : -1)).map((x) => [P.personar[x.person].namn, tilNorsk(x.dato), x.kg])];
    const wv = XLSX.utils.aoa_to_sheet(v); wv["!cols"] = [{ wch: 10 }, { wch: 12 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, wv, "Vekt");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    return new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  }

  function visMeir() {
    setTittel("Meir"); markerTab("meir");
    const pid = S.person, p = person();
    const steg = S.innstillingar.kgSteg;
    app.innerHTML = `<h2>Meir</h2>
      <div class="kort"><h3>Person</h3><div class="knapprad">${Object.entries(P.personar).map(([id, q]) => `<button class="knapp ${id === pid ? "" : "sekundar"}" data-person="${id}">${esc(q.namn)}${id === pid ? " ✓" : ""}</button>`).join("")}</div></div>
      <div class="kort"><h3>Legg inn tidlegare økt</h3><p class="liten">For ei økt de gløymde å registrere.</p>
        <label class="felt" for="tidDato">Dato</label><input id="tidDato" type="date" max="${idag()}" value="${tidlegDefault(pid)}">
        <label class="felt" for="tidOkt">Økt</label><select id="tidOkt"><option>A</option><option>B</option></select>
        <button class="knapp stor full" id="tidLegg">Legg inn økta</button></div>
      <div class="kort"><h3>Del treningsloggen</h3><p>Send Excel-fila til OneDrive kvar helg, så kan søndagsstatusen lese henne:</p>${STEG}
        <button class="knapp stor full" id="ekspXlsx">Del logg for begge (Excel)</button>
        <div class="knapprad"><button class="knapp sekundar" id="ekspCsv">Berre ${esc(p.namn)} (CSV)</button></div></div>
      <div class="kort"><h3>Tryggleikskopi (iPhone ⇄ iPad)</h3><p>Data ligg berre på denne eininga. Lag ein tryggleikskopi og opne han på den andre eininga for å flytte loggen.</p>
        <div class="knapprad"><button class="knapp sekundar" id="backup">Lag tryggleikskopi</button>
        <label class="knapp sekundar" for="importFil">Hent inn tryggleikskopi</label></div>
        <input type="file" id="importFil" accept="application/json,.json" class="skjult">
        <p class="liten">Ved innhenting blir økter og vekt slått saman. Like økter blir ikkje dobla.</p></div>
      <div class="kort"><h3>Steg på manualane</h3><p>Kor mykje + og − endrar kg (manualane går frå 3 til 24 kg).</p>
        <select id="kgSteg">${[0.5, 1, 1.5, 2, 2.5, 3].map((v) => `<option value="${v}" ${Number(steg) === v ? "selected" : ""}>${kgTekst(v)} kg</option>`).join("")}</select></div>
      <details class="kort"><summary>Progresjon – korleis de aukar</summary>${P.progresjon.map((r) => `<p><strong>${esc(r.steg)}:</strong> ${esc(r.regel)}${r.doeme ? ` <span class="liten">Døme: ${esc(r.doeme)}</span>` : ""}</p>`).join("")}</details>
      <details class="kort"><summary>Reglar</summary>${P.start.reglar.map((r) => `<p><strong>${esc(r.tittel)}</strong> ${esc(r.tekst)}</p>`).join("")}</details>
      <details class="kort"><summary>Utstyr</summary>${P.start.utstyr.map((r) => `<p><strong>${esc(r.utstyr)}:</strong> ${esc(r.tekst)}</p>`).join("")}</details>
      <div class="kort varsel"><p>${esc(P.start.atvaring || "")}</p></div>
      <p class="liten">Programdata: ${esc(P.kjelde)}, laga ${esc(P.laga)}.</p>`;
    app.querySelectorAll("[data-person]").forEach((b) => b.addEventListener("click", () => { S.person = b.dataset.person; lagre(); oppdaterPersonknapp(); visMeir(); }));
    $("#kgSteg").addEventListener("change", (e) => { S.innstillingar.kgSteg = Number(e.target.value); lagre(); toast("Lagra"); });
    $("#ekspCsv").addEventListener("click", async () => {
      const r = await delFil(new Blob([csvFor(pid)], { type: "text/csv" }), `Logg_${p.namn}_${idag()}.csv`, `Treningslogg ${p.namn}`);
      eksportOk(r);
    });
    const tdag = kalenderDag($("#tidDato").value); if (tdag && tdag.okt) $("#tidOkt").value = tdag.okt;
    $("#tidDato").addEventListener("change", (e) => { const d = kalenderDag(e.target.value); if (d && d.okt) $("#tidOkt").value = d.okt; });
    $("#tidLegg").addEventListener("click", () => {
      const iso = $("#tidDato").value, b = $("#tidOkt").value;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || iso > idag()) { toast("Vel ein dato fram til i dag"); return; }
      const finst = S.okter.find((o) => o.person === pid && o.dato === iso && o.okt === b);
      if (finst && finst.ferdig) { toast(`Økt ${b} ${tilNorsk(iso)} er alt registrert`); return; }
      const o = finst || nyOkt(pid, b, iso); location.hash = "#/okt/" + o.id;
    });
    $("#ekspXlsx").addEventListener("click", async () => {
      await delXlsx();
    });
    $("#backup").addEventListener("click", async () => {
      const blob = new Blob([JSON.stringify({ app: "treningsapp", laga: new Date().toISOString(), data: S }, null, 1)], { type: "application/json" });
      const r = await delFil(blob, `Trening_tryggleikskopi_${idag()}.json`, "Tryggleikskopi");
      if (r !== "avbrote") toast("Tryggleikskopi laga");
    });
    $("#importFil").addEventListener("change", async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try {
        const inn = JSON.parse(await f.text()); const d = inn.data || inn;
        if (!d || !Array.isArray(d.okter)) throw new Error("ugyldig");
        let nyeO = 0, nyeV = 0;
        for (const o of d.okter) { const i = S.okter.findIndex((x) => x.id === o.id); if (i < 0) { S.okter.push(o); nyeO++; } else if ((o.slutt || o.start) > (S.okter[i].slutt || S.okter[i].start)) S.okter[i] = o; }
        for (const v of d.vekt || []) { if (!S.vekt.some((x) => x.person === v.person && x.dato === v.dato)) { S.vekt.push(v); nyeV++; } }
        lagre(); toast(`Henta inn ${nyeO} nye økter og ${nyeV} vektmålingar`);
      } catch (err) { toast("Fila kunne ikkje lesast. Vel ein tryggleikskopi frå appen."); }
      e.target.value = "";
    });
  }

  // ---------- ruting ----------
  function rute() {
    if (!P) return;
    if (!S.person) { visPersonval(); return; }
    oppdaterPersonknapp();
    const h = location.hash || "#/idag";
    const [, side, arg] = h.split("/");
    if (side === "okt" && arg) visOkt(arg);
    else if (side === "framgang") visFramgang(arg ? decodeURIComponent(arg) : null);
    else if (side === "ovingar") visOvingar();
    else if (side === "meir") visMeir();
    else if (side === "person") visPersonval();
    else visIdag();
    if (!(side === "framgang" && arg) && !(side === "okt" && rute.forrige === h)) window.scrollTo(0, 0);
    rute.forrige = h;
  }
  $("#personBtn").addEventListener("click", () => { location.hash = "#/person"; });
  window.addEventListener("hashchange", rute);

  async function init() {
    last();
    try {
      const r = await fetch("data/program.json", { cache: "no-cache" });
      P = await r.json();
    } catch (e) { app.innerHTML = `<div class="kort varsel"><p>Klarte ikkje å laste programmet. Opne appen på nytt med nett.</p></div>`; return; }
    rute();
    if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("sw.js").catch(() => {});
  }
  window.__treningsapp = { progresjon: (pid, exId, oktId) => progresjon(pid, P.personar[pid].ovingar.find((e) => e.id === exId), S.okter.find((o) => o.id === oktId)), csvFor, state: () => S };
  init();
})();
