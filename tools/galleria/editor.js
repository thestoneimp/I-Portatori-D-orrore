/* Editor delle carte: sposta/ridimensiona l'immagine e gli elementi (testi, cornice, sfumatura) e ne cambia le proprietà.
 * Usa Carta.render (carta.js) per disegnare: ciò che si vede qui è ciò che la galleria mostrerà.
 * Salvataggio tramite opz.salva({carta, variante, elementi, imm}) (la pagina chiama /api/layout).
 *  - elementi: comuni a tutte le varianti della carta;  imm: posizione/scala dell'immagine di QUESTA variante.
 * Comandi: trascina = sposta, maniglie = ridimensiona (immagine/testo: scala dal centro; cornice: margine),
 *          frecce = sposta di poco (Maiusc = di più), Canc = nascondi, Ctrl+Z / Ctrl+Y = annulla/ripeti, Esc = chiudi.
 */
const Editor = (() => {
  let ctx = null, st = null, sel = null, storia = [], hi = -1, timer = null, salvato = "", soloImg = false;
  // zone cliccabili degli elementi (solo luoghi): poligoni in % dell'immagine esportata, salvati in assets/carte/zone.json
  let modoZone = false, soloImgPrima = false, zonaSel = null, puntoSel = null, nomiCat = [], zoneOk = false;
  const chiaveZone = c => c.id.split("_")[0] + (c.id.endsWith("_abitata") ? "_abitata" : "");
  const cacheImg = new Map();
  const $ = s => document.querySelector(s);
  const el = (tag, cl, txt) => { const e = document.createElement(tag); if (cl) e.className = cl; if (txt != null) e.textContent = txt; return e; };
  const lim = (v, a, b) => Math.min(b, Math.max(a, v));
  const arr = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;
  // caratteristiche di gioco delle minacce (stesse dei personaggi, chiavi di `caratteristiche` in eroi_base.json): si modificano qui e non vengono disegnate sulla carta.
  // Vuote finché non vengono inserite a mano: il gioco usa dei valori provvisori per quelle mancanti.
  const CAR_MINACCIA = [["pf", "PF"], ["pa", "PA"], ["forza", "Forza"], ["intelletto", "Intelletto"], ["rapidita", "Rapidità"], ["carisma", "Carisma"]];
  const CAR_MINACCIA_VUOTE = { pf: null, pa: null, forza: null, intelletto: null, rapidita: null, carisma: null };
  const cerca = id => st.elementi.find(e => e.id === id);
  const selIniziale = () => (cerca("nome") ? "nome" : cerca("oggetto") ? "oggetto" : "immagine");   // le carte oggetto non hanno un testo "nome" separato
  const sporco = () => JSON.stringify(st) !== salvato;

  /* ---------- apertura / chiusura ---------- */
  function apri(carta, variante, opz) {
    if (ctx) rimuovi();
    ctx = { carta, variante, opz };
    st = { elementi: Carta.elementi(carta), imm: Carta.imm(variante) };
    if (carta.tipo === "minaccia") st.caratteristiche = { ...CAR_MINACCIA_VUOTE, ...(carta.caratteristiche || {}) };   // valori di gioco: non compaiono sulla carta
    modoZone = false; zonaSel = null; puntoSel = null; zoneOk = false; nomiCat = [];
    if (carta.tipo === "luogo") st.zone = {};   // riempito da caricaZone()
    salvato = JSON.stringify(st); storia = [salvato]; hi = 0; sel = selIniziale(); soloImg = false;
    costruisci(); tutto();
    if (carta.tipo === "luogo") caricaZone();
    document.addEventListener("keydown", tasti, true);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => ctx && overlay());   // i font cambiano la larghezza del testo
  }
  function rimuovi() { clearTimeout(timer); document.removeEventListener("keydown", tasti, true); const m = $("#edModale"); if (m) m.remove(); ctx = null; }
  function chiudi() { if (sporco() && !confirm("Ci sono modifiche non salvate. Chiudere comunque?")) return; rimuovi(); }
  const tutto = () => { ridisegna(); livelli(); pannello(); caratteristiche(); pannelloZone(); barra(); };

  function costruisci() {
    const m = el("div", "ed-modale"); m.id = "edModale";
    const t = el("div", "ed-testa");
    t.append(el("b", null, `Modifica carta — ${ctx.carta.nome} · ${ctx.variante.id}`));
    for (const [id, txt, fn] of [["edAnnulla", "↶ Annulla", annulla], ["edRipeti", "↷ Ripeti", ripeti], ["edReset", "Reimposta layout", reimposta]]) {
      const b = el("button", null, txt); b.id = id; b.onclick = fn; t.append(b);
    }
    const lab = el("label"); const cb = document.createElement("input"); cb.type = "checkbox"; cb.id = "edSoloImg";
    cb.onchange = () => { soloImg = cb.checked; ridisegna(); }; lab.append(cb, "Solo immagine"); t.append(lab);
    t.append(el("span", "ed-spazio"), el("span", "ed-sporco", "● modifiche non salvate")); t.lastChild.id = "edSporco";
    const bs = el("button", "ed-primario", "Salva"); bs.id = "edSalva"; bs.onclick = salva;
    const bc = el("button", null, "Chiudi"); bc.onclick = chiudi; t.append(bs, bc);
    const corpo = el("div", "ed-corpo");
    const so = el("div", "ed-stage-outer"), stage = el("div", "ed-stage " + (ctx.carta.formato === "orizzontale" ? "ed-o" : "ed-v")); stage.id = "edStage";
    const ov = el("div", "ed-overlay"); ov.id = "edOverlay";
    const gv = el("div", "ed-guida v"), gh = el("div", "ed-guida h"); gv.id = "edGv"; gh.id = "edGh";
    const zl = el("div", "ed-zone"); zl.id = "edZone";
    stage.append(ov, zl, gv, gh); so.append(stage);
    const p = el("aside", "ed-pannello");
    p.append(el("h3", null, "Livelli"), Object.assign(el("ul", "ed-liv"), { id: "edLivelli" }));
    const add = el("button", null, "+ Aggiungi testo"); add.onclick = aggiungiTesto; p.append(add);
    p.append(el("h3", null, "Proprietà"), Object.assign(el("div"), { id: "edProp" }));
    if (ctx.carta.tipo === "minaccia") p.append(Object.assign(el("div"), { id: "edCar" }));
    if (ctx.carta.tipo === "luogo") p.append(Object.assign(el("div"), { id: "edZoneP" }));
    p.append(el("div", "ed-sugg", "Trascina per spostare · maniglie per ridimensionare (immagine: lati = stira, angoli = scala) · frecce per rifinire (Maiusc = più veloce) · Ctrl+Z annulla."));
    corpo.append(so, p); m.append(t, corpo); document.body.append(m);
    stage.addEventListener("pointerdown", e => { if (e.target === stage || e.target === ov) { /* click a vuoto: nessuna azione */ } });
  }

  /* ---------- disegno ---------- */
  function ridisegna() {
    const stage = $("#edStage"); const vecchia = stage.querySelector(".cx-wrap"); if (vecchia) vecchia.remove();
    const wrap = Carta.render(ctx.carta, ctx.variante, { elementi: st.elementi, imm: st.imm, src: "/media/" + ctx.variante.file, soloImmagine: soloImg, modifica: true, cacheImg });
    stage.prepend(wrap);
    wrap.querySelectorAll(".cx-immagine, .cx-testo").forEach(n => n.addEventListener("pointerdown", e => inizioTrascina(e, n.dataset.id)));
    wrap.querySelectorAll(".cx-stat, .cx-st-pannello").forEach(n => n.addEventListener("pointerdown", e => inizioTrascina(e, "statistiche")));
    wrap.querySelectorAll("img").forEach(i => i.addEventListener("load", overlay));
    overlay(); zoneDisegna();
  }
  function rettangolo(e, n) {
    const r = n.getBoundingClientRect();
    if (e.tipo !== "statistiche") return r;
    const parti = [...n.querySelectorAll(".cx-stat, .cx-st-pannello")].map(x => x.getBoundingClientRect());
    if (!parti.length) return r;
    const l = Math.min(...parti.map(p => p.left)), t = Math.min(...parti.map(p => p.top)), rr = Math.max(...parti.map(p => p.right)), b = Math.max(...parti.map(p => p.bottom));
    return { left: l, top: t, right: rr, bottom: b, width: rr - l, height: b - t };
  }
  function overlay() {
    const ov = $("#edOverlay"); if (!ov) return; ov.replaceChildren();
    const e = cerca(sel); if (!e || !e.visibile || soloImg) return;
    const stage = $("#edStage"), n = stage.querySelector(`[data-id="${CSS.escape(sel)}"]`); if (!n) return;
    const sr = stage.getBoundingClientRect(), r = rettangolo(e, n);
    const box = el("div", "ed-box" + (e.tipo === "sfumatura" ? " ed-tratt" : ""));
    Object.assign(box.style, { left: r.left - sr.left + "px", top: r.top - sr.top + "px", width: r.width + "px", height: r.height + "px" });
    ov.append(box);
    if (e.tipo === "sfumatura" || e.tipo === "oggetto") return;   // sfumatura e oggetto non si trascinano: si regolano dal pannello
    const pos = { nw: [0, 0], n: [50, 0], ne: [100, 0], e: [100, 50], se: [100, 100], s: [50, 100], sw: [0, 100], w: [0, 50] };
    for (const [h, [px, py]] of Object.entries(pos)) {
      if (e.tipo === "statistiche" && h.length === 1) continue;   // le statistiche si scalano solo dagli angoli
      const m = el("div", "ed-h"); m.dataset.h = h;
      Object.assign(m.style, { left: r.left - sr.left + (r.width * px) / 100 + "px", top: r.top - sr.top + (r.height * py) / 100 + "px" });
      m.addEventListener("pointerdown", ev => inizioRidimensiona(ev, h)); ov.append(m);
    }
  }

  /* ---------- storia (annulla / ripeti) ---------- */
  function cambiato() {
    ridisegna(); barra(); clearTimeout(timer);
    timer = setTimeout(spingi, 350);   // un'azione continua (trascinamento, slider) diventa un solo passo di storia
  }
  function spingi() {
    clearTimeout(timer); const s = JSON.stringify(st);
    if (s !== storia[hi]) { storia = storia.slice(0, hi + 1); storia.push(s); hi++; }
    barra();
  }
  function vai(i) { spingi(); if (i < 0 || i >= storia.length) return; hi = i; st = JSON.parse(storia[hi]); if (!cerca(sel)) sel = selIniziale(); tutto(); }
  const annulla = () => vai(hi - 1), ripeti = () => vai(hi + 1);
  function reimposta() {
    if (!confirm("Riportare tutti gli elementi e la posizione dell'immagine ai valori predefiniti?")) return;
    st = { elementi: Carta.predefiniti(ctx.carta), imm: { ...Carta.IMM_DEF }, ...(st.caratteristiche ? { caratteristiche: st.caratteristiche } : {}), ...(st.zone ? { zone: st.zone } : {}) }; sel = selIniziale(); spingi(); tutto();
  }
  function barra() {
    const a = $("#edAnnulla"); if (!a) return;
    a.disabled = hi <= 0 && JSON.stringify(st) === storia[0]; $("#edRipeti").disabled = hi >= storia.length - 1;
    $("#edSporco").style.visibility = sporco() ? "visible" : "hidden";   // lo spazio resta riservato: l'intestazione non cambia altezza
  }
  async function salva() {
    spingi();
    let ok = await ctx.opz.salva({ carta: ctx.carta.id, variante: ctx.variante.id, elementi: st.elementi, imm: st.imm, caratteristiche: st.caratteristiche });
    if (ok && ctx.carta.tipo === "luogo" && zoneOk) ok = await salvaZone();
    if (ok) { ctx.carta.caratteristiche = st.caratteristiche; { salvato = JSON.stringify(st); barra(); ctx.opz.avviso && ctx.opz.avviso("Carta salvata"); } }
  }

  /* ---------- trascinamento / ridimensionamento ---------- */
  function selez(id) { if (sel !== id) { sel = id; livelli(); pannello(); } overlay(); }
  function guide(x, y) { $("#edGv").style.display = x ? "block" : "none"; $("#edGh").style.display = y ? "block" : "none"; }

  function inizioTrascina(ev, id) {
    if (soloImg) return;
    ev.preventDefault(); selez(id);
    const e = cerca(id), sr = $("#edStage").getBoundingClientRect(), img = e.tipo === "immagine", gruppo = e.tipo === "statistiche";
    const o = img ? st.imm : e, kx = gruppo ? "dx" : "x", ky = gruppo ? "dy" : "y";
    const x0 = o[kx] || 0, y0 = o[ky] || 0, p0 = { x: ev.clientX, y: ev.clientY }; let mosso = false;
    const mv = m => {
      let nx = x0 + ((m.clientX - p0.x) / sr.width) * 100, ny = y0 + ((m.clientY - p0.y) / sr.height) * 100;
      const centro = img || gruppo ? 0 : 50;   // immagine e gruppo statistiche: 0 = posizione originale; i testi: 50 = centro della carta
      const sx = Math.abs(nx - centro) < 1.2, sy = Math.abs(ny - centro) < 1.2;
      if (sx) nx = centro; if (sy) ny = centro;
      if (m.shiftKey) { if (Math.abs(nx - x0) > Math.abs(ny - y0)) ny = y0; else nx = x0; }
      o[kx] = arr(nx); o[ky] = arr(ny); mosso = true; guide(sx, sy); cambiato(); panelloValori();
    };
    const su = () => { window.removeEventListener("pointermove", mv); guide(false, false); if (mosso) spingi(); };
    window.addEventListener("pointermove", mv); window.addEventListener("pointerup", su, { once: true });
  }

  function inizioRidimensiona(ev, h) {
    ev.preventDefault(); ev.stopPropagation();
    const e = cerca(sel), stage = $("#edStage"), sr = stage.getBoundingClientRect();
    const n = stage.querySelector(`[data-id="${CSS.escape(sel)}"]`), r = rettangolo(e, n);
    const c = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    let mv;
    if (e.tipo === "immagine") {
      const im = n.querySelector("img"), ar = Carta.rapporto(ctx.carta);
      const iar = im.naturalWidth && im.naturalHeight ? im.naturalWidth / im.naturalHeight : ar;   // proporzioni dell'immagine
      const baseW = Math.max(100, (iar / ar) * 100);                                               // larghezza "cover" in % della carta
      const R = { l: r.left, r: r.right, t: r.top, b: r.bottom }, MIN = 24;
      const mw = h.includes("w"), me = h.includes("e"), mn = h.includes("n"), ms = h.includes("s"), angolo = (mw || me) && (mn || ms);
      mv = m => {
        let L = R.l, Rr = R.r, T = R.t, B = R.b;
        if (angolo && !m.shiftKey) {
          // proporzionale: l'angolo opposto resta fermo, il puntatore viene proiettato sulla diagonale
          const ax = mw ? R.r : R.l, ay = mn ? R.b : R.t, vx = (mw ? R.l : R.r) - ax, vy = (mn ? R.t : R.b) - ay;
          const k = Math.max(((m.clientX - ax) * vx + (m.clientY - ay) * vy) / (vx * vx + vy * vy), MIN / Math.min(Math.abs(vx), Math.abs(vy)));
          const cx = ax + vx * k, cy = ay + vy * k;
          L = Math.min(ax, cx); Rr = Math.max(ax, cx); T = Math.min(ay, cy); B = Math.max(ay, cy);
        } else {
          // lati (o angolo con Maiusc): ogni lato trascinato segue il puntatore, quello opposto resta fermo => stiramento
          if (mw) L = Math.min(m.clientX, R.r - MIN);
          if (me) Rr = Math.max(m.clientX, R.l + MIN);
          if (mn) T = Math.min(m.clientY, R.b - MIN);
          if (ms) B = Math.max(m.clientY, R.t + MIN);
        }
        const w1 = Rr - L, h1 = B - T, sr = stage.getBoundingClientRect();
        st.imm.s = arr(lim(w1 / ((sr.width * baseW) / 100), 0.05, 8), 3);
        st.imm.st = arr(lim((h1 * iar) / w1, 0.1, 8), 3);
        st.imm.x = arr((((L + Rr) / 2 - (sr.left + sr.width / 2)) / sr.width) * 100);
        st.imm.y = arr((((T + B) / 2 - (sr.top + sr.height / 2)) / sr.height) * 100);
        cambiato(); panelloValori();
      };
    } else if (e.tipo === "cornice") {   // il margine segue il puntatore, misurato dal bordo della carta (in cqw = % della larghezza)
      mv = m => {
        const dx = [], w = sr.width;
        if (h.includes("w")) dx.push(((m.clientX - sr.left) / w) * 100);
        if (h.includes("e")) dx.push(((sr.right - m.clientX) / w) * 100);
        if (h.includes("n")) dx.push(((m.clientY - sr.top) / w) * 100);
        if (h.includes("s")) dx.push(((sr.bottom - m.clientY) / w) * 100);
        e.inset = arr(lim(dx.reduce((a, b) => a + b, 0) / dx.length, 0, 25), 1); cambiato(); panelloValori();
      };
    } else if (e.tipo === "statistiche") {   // gruppo di icone: scala dal centro del gruppo
      const d0 = Math.hypot(ev.clientX - c.x, ev.clientY - c.y) || 1, v0 = e.scala || 1;
      mv = m => { e.scala = arr(lim(v0 * (Math.hypot(m.clientX - c.x, m.clientY - c.y) / d0), 0.4, 2.5), 3); cambiato(); panelloValori(); };
    } else {                       // testo: scala dal centro, in proporzione alla distanza del puntatore
      const d0 = Math.hypot(ev.clientX - c.x, ev.clientY - c.y) || 1, v0 = e.dim;
      mv = m => {
        const k = Math.hypot(m.clientX - c.x, m.clientY - c.y) / d0;
        e.dim = arr(lim(v0 * k, 2, 45), 1);
        cambiato(); panelloValori();
      };
    }
    const su = () => { window.removeEventListener("pointermove", mv); spingi(); };
    window.addEventListener("pointermove", mv); window.addEventListener("pointerup", su, { once: true });
  }

  function tasti(ev) {
    if (!ctx) return;
    const inCampo = /^(INPUT|TEXTAREA|SELECT)$/.test(ev.target.tagName) && ev.target.type !== "range" && ev.target.type !== "checkbox";
    const k = ev.key;
    if (k === "Escape") { ev.preventDefault(); chiudi(); return; }
    if ((ev.ctrlKey || ev.metaKey) && !inCampo) {
      if (k === "z" || k === "Z") { ev.preventDefault(); ev.shiftKey ? ripeti() : annulla(); return; }
      if (k === "y" || k === "Y") { ev.preventDefault(); ripeti(); return; }
    }
    if (inCampo) return;
    if (modoZone && zonaSel && puntoSel !== null && st.zone[zonaSel]) {
      const p = st.zone[zonaSel].poligono[puntoSel], pas = ev.shiftKey ? 0.5 : 0.1;
      const dz = { ArrowLeft: [-pas, 0], ArrowRight: [pas, 0], ArrowUp: [0, -pas], ArrowDown: [0, pas] }[k];
      if (dz && p) { ev.preventDefault(); p[0] = arr(lim(p[0] + dz[0], 0, 100), 1); p[1] = arr(lim(p[1] + dz[1], 0, 100), 1); cambiatoZone(); return; }
      if (k === "Delete" || k === "Backspace") { ev.preventDefault(); rimuoviPunto(zonaSel, puntoSel); return; }
    }
    const e = cerca(sel); if (!e) return;
    const passo = ev.shiftKey ? 1 : 0.2, d = { ArrowLeft: [-passo, 0], ArrowRight: [passo, 0], ArrowUp: [0, -passo], ArrowDown: [0, passo] }[k];
    if (d && (e.tipo === "immagine" || e.tipo === "testo" || e.tipo === "statistiche")) {
      ev.preventDefault(); const o = e.tipo === "immagine" ? st.imm : e, kx = e.tipo === "statistiche" ? "dx" : "x", ky = e.tipo === "statistiche" ? "dy" : "y";
      o[kx] = arr((o[kx] || 0) + d[0]); o[ky] = arr((o[ky] || 0) + d[1]); cambiato(); panelloValori();
    } else if (k === "Delete") { ev.preventDefault(); e.visibile = false; cambiato(); livelli(); pannello(); }
  }

  /* ---------- livelli ---------- */
  function livelli() {
    const ul = $("#edLivelli"); ul.replaceChildren();
    [...st.elementi].reverse().forEach(e => {
      const li = el("li", e.id === sel ? "sel" : ""), cb = document.createElement("input");
      cb.type = "checkbox"; cb.checked = e.visibile; cb.title = "Mostra / nascondi";
      cb.onchange = () => { e.visibile = cb.checked; cambiato(); };
      const nm = el("button", "ed-nome", e.tipo === "testo" && e.id !== "nome" ? `Testo: ${(e.testo || "").slice(0, 18)}` : e.nome); nm.onclick = () => selez(e.id);
      const su = el("button", "ed-mini", "▲"), giu = el("button", "ed-mini", "▼"); su.title = "Porta avanti"; giu.title = "Porta indietro";
      su.onclick = () => muovi(e, 1); giu.onclick = () => muovi(e, -1);
      li.append(cb, nm, su, giu);
      if (e.tipo === "testo" && e.id !== "nome") { const x = el("button", "ed-mini", "🗑"); x.title = "Elimina"; x.onclick = () => { st.elementi = st.elementi.filter(z => z !== e); if (sel === e.id) sel = selIniziale(); cambiato(); tutto(); }; li.append(x); }
      ul.append(li);
    });
  }
  function muovi(e, d) {
    const a = st.elementi, i = a.indexOf(e), j = i + d; if (j < 0 || j >= a.length) return;
    [a[i], a[j]] = [a[j], a[i]]; cambiato(); livelli();
  }
  function aggiungiTesto() {
    const id = "t" + Date.now().toString(36);
    st.elementi.push({ id, tipo: "testo", nome: "Testo", visibile: true, testo: "Nuovo testo", x: 50, y: 50, dim: 7, font: "Oswald", colore: "#ffffff",
      spaziatura: 0.2, maiuscolo: false, alone: false, rot: 0 });
    sel = id; cambiato(); tutto();
  }

  /* ---------- pannello proprietà ---------- */
  let aggiornaValori = null;
  const panelloValori = () => aggiornaValori && aggiornaValori();
  function riga(lab, ...c) { const r = el("label", "ed-riga"); r.append(el("span", null, lab), ...c); return r; }
  function slider(min, max, step, val, fn, fmt = v => v) {
    const w = el("div", "ed-sl"), i = document.createElement("input"), o = el("output");
    Object.assign(i, { type: "range", min, max, step, value: val }); o.textContent = fmt(val);
    i.oninput = () => { const v = Number(i.value); o.textContent = fmt(v); fn(v); cambiato(); };
    w.append(i, o); w.set = v => { i.value = v; o.textContent = fmt(v); }; return w;
  }
  function pannello() {
    const p = $("#edProp"); p.replaceChildren(); aggiornaValori = null; const e = cerca(sel); if (!e) return;
    const vis = document.createElement("input"); vis.type = "checkbox"; vis.checked = e.visibile; vis.onchange = () => { e.visibile = vis.checked; cambiato(); livelli(); };
    p.append(riga("Visibile", vis));
    if (e.tipo === "immagine") {
      const s = slider(10, 400, 1, Math.round(st.imm.s * 100), v => (st.imm.s = v / 100), v => v + "%");
      const sy = slider(10, 400, 1, Math.round(st.imm.st * 100), v => (st.imm.st = v / 100), v => v + "%");
      const x = slider(-100, 100, 0.1, st.imm.x, v => (st.imm.x = v), v => v.toFixed(1)), y = slider(-100, 100, 0.1, st.imm.y, v => (st.imm.y = v), v => v.toFixed(1));
      p.append(riga("Scala", s), riga("Stiramento verticale", sy), riga("Posizione X", x), riga("Posizione Y", y));
      const b1 = el("button", null, "Centra"), b2 = el("button", null, "Riempi (100%)"), b3 = el("button", null, "Rifila margini (107%)"), b4 = el("button", null, "Proporzioni originali");
      b1.onclick = () => { st.imm.x = 0; st.imm.y = 0; cambiato(); pannello(); };
      b2.onclick = () => { Object.assign(st.imm, { x: 0, y: 0, s: 1, st: 1 }); cambiato(); pannello(); };
      b3.onclick = () => { Object.assign(st.imm, { x: 0, y: 0, s: 1.07, st: 1 }); cambiato(); pannello(); };
      b4.onclick = () => { st.imm.st = 1; cambiato(); pannello(); };
      const bw = el("div", "ed-riga"); bw.append(b1, b2, b3, b4); bw.style.flexWrap = "wrap"; p.append(bw);
      p.append(el("div", "ed-sugg", "Maniglie sui lati = stira; maniglie d'angolo = scala (con Maiusc stira libero). La posizione vale solo per " + ctx.variante.id + "."));
      aggiornaValori = () => { s.set(Math.round(st.imm.s * 100)); sy.set(Math.round(st.imm.st * 100)); x.set(st.imm.x); y.set(st.imm.y); };
    } else if (e.tipo === "testo") {
      const ta = document.createElement("textarea"); ta.value = e.testo == null ? ctx.carta.nome : e.testo; ta.rows = 2;
      ta.oninput = () => { e.testo = ta.value; cambiato(); livelli(); };
      const ripNome = el("button", "ed-mini", "↺ nome"); ripNome.title = "Torna al nome della carta"; ripNome.onclick = () => { e.testo = null; cambiato(); pannello(); livelli(); };
      const sf = document.createElement("select"); Carta.FONT.forEach(f => sf.append(new Option(f, f, false, f === e.font)));
      sf.onchange = () => { e.font = sf.value; cambiato(); };
      const col = Object.assign(document.createElement("input"), { type: "color", value: e.colore }); col.oninput = () => { e.colore = col.value; cambiato(); };
      const mai = Object.assign(document.createElement("input"), { type: "checkbox", checked: e.maiuscolo }); mai.onchange = () => { e.maiuscolo = mai.checked; cambiato(); };
      const alo = Object.assign(document.createElement("input"), { type: "checkbox", checked: e.alone }); alo.onchange = () => { e.alone = alo.checked; cambiato(); };
      const dim = slider(2, 45, 0.5, e.dim, v => (e.dim = v)), sp = slider(0, 4, 0.1, e.spaziatura, v => (e.spaziatura = v), v => v.toFixed(1));
      const rot = slider(-45, 45, 1, e.rot || 0, v => (e.rot = v), v => v + "°");
      const x = slider(0, 100, 0.1, e.x, v => (e.x = v), v => v.toFixed(1)), y = slider(0, 100, 0.1, e.y, v => (e.y = v), v => v.toFixed(1));
      p.append(riga("Testo", ta), e.id === "nome" ? riga("", ripNome) : "", riga("Font", sf), riga("Dimensione", dim), riga("Colore", col), riga("Spaziatura", sp),
        riga("Rotazione", rot), riga("Maiuscolo", mai), riga("Alone / ombra", alo), riga("Posizione X", x), riga("Posizione Y", y));
      aggiornaValori = () => { dim.set(e.dim); x.set(e.x); y.set(e.y); };
    } else if (e.tipo === "cornice") {
      const col = Object.assign(document.createElement("input"), { type: "color", value: e.colore }); col.oninput = () => { e.colore = col.value; cambiato(); };
      const ins = slider(0, 25, 0.1, e.inset, v => (e.inset = v), v => v.toFixed(1)), sp = slider(0.05, 12, 0.05, e.spessore, v => (e.spessore = v), v => v.toFixed(2));
      const op = slider(0, 1, 0.01, e.opacita, v => (e.opacita = v), v => Math.round(v * 100) + "%"), ra = slider(0, 15, 0.1, e.raggio, v => (e.raggio = v), v => v.toFixed(1));
      const ma = document.createElement("select"); Carta.MATERIALI.forEach(([i, n]) => ma.append(new Option(n, i, false, i === (e.materiale || ""))));
      ma.onchange = () => { if (ma.value) e.materiale = ma.value; else delete e.materiale; cambiato(); };
      p.append(riga("Materiale", ma), riga("Margine", ins), riga("Spessore", sp), riga("Colore" + (e.materiale ? " (tinta)" : ""), col), riga("Opacità", op), riga("Angoli tondi", ra));
      aggiornaValori = () => ins.set(e.inset);
    } else if (e.tipo === "statistiche") {
      const sd = document.createElement("select"); Statistiche.DISPOSIZIONI.forEach(([i, n]) => sd.append(new Option(n, i, false, i === e.disposizione)));
      sd.onchange = () => { e.disposizione = sd.value; cambiato(); };
      const ss = document.createElement("select"); Statistiche.STILI.forEach(([i, n]) => ss.append(new Option(n, i, false, i === e.stile)));
      ss.onchange = () => { e.stile = ss.value; cambiato(); };
      const sc = slider(40, 250, 1, Math.round((e.scala || 1) * 100), v => (e.scala = v / 100), v => v + "%");
      const dx = slider(-40, 40, 0.1, e.dx || 0, v => (e.dx = v), v => v.toFixed(1)), dy = slider(-40, 40, 0.1, e.dy || 0, v => (e.dy = v), v => v.toFixed(1));
      p.append(riga("Disposizione", sd), riga("Stile icone", ss), riga("Grandezza", sc), riga("Spostamento X", dx), riga("Spostamento Y", dy));
      const valori = el("div", "ed-sugg", "Valori (d'esempio finché non sono collegati ai dati del personaggio):");
      p.append(valori);
      const griglia = el("div", "ed-riga"); griglia.style.flexWrap = "wrap"; griglia.style.gap = "6px 12px";
      Statistiche.STAT.forEach(([id, nome]) => {
        const l = el("label"); l.title = nome; l.style.cssText = "display:flex;gap:5px;align-items:center;color:#a89488;font-size:12px";
        const i = Object.assign(document.createElement("input"), { type: "number", min: 0, max: 99, value: (e.valori && e.valori[id] != null) ? e.valori[id] : Statistiche.VALORI_ESEMPIO[id] });
        i.style.cssText = "width:52px;background:#241818;color:#e9dfd6;border:1px solid #3a2626;border-radius:6px;padding:3px 5px";
        i.oninput = () => { e.valori = Object.assign({}, e.valori || Statistiche.VALORI_ESEMPIO, { [id]: Number(i.value) }); cambiato(); };
        l.append(id.toUpperCase(), i); griglia.append(l);
      });
      p.append(griglia);
      const bz = el("button", null, "Valori d'esempio"); bz.onclick = () => { e.valori = null; cambiato(); pannello(); };
      const bp = el("button", null, "Posizione originale"); bp.onclick = () => { e.dx = 0; e.dy = 0; cambiato(); pannello(); };
      const bw = el("div", "ed-riga"); bw.append(bz, bp); p.append(bw);
      p.append(el("div", "ed-sugg", "Le icone possono sporgere dal bordo: nella carta fisica non compaiono. Trascina il gruppo per spostarlo, angoli per ingrandirlo."));
      aggiornaValori = () => { sc.set(Math.round((e.scala || 1) * 100)); dx.set(e.dx || 0); dy.set(e.dy || 0); };
    } else if (e.tipo === "oggetto") {
      // bonus (testo scritto sulla carta: lo somma a mano il giocatore), due tag (icone d'uso) e codice di consultazione; vedi oggetto.js
      e.dati = e.dati || {}; const d = e.dati;
      const stile = i => (i.style.cssText = "background:#241818;color:#e9dfd6;border:1px solid #3a2626;border-radius:6px;padding:4px 7px;width:100%;box-sizing:border-box");
      const sl = document.createElement("select"); Oggetto.LAYOUT.forEach(([i, n]) => sl.append(new Option(n, i, false, i === e.layout)));
      sl.onchange = () => { e.layout = sl.value; cambiato(); };
      const tb = Object.assign(document.createElement("input"), { type: "text", value: d.bonus || "", placeholder: "es. +1 Forza (vuoto = nessun bonus)" }); stile(tb);
      tb.oninput = () => { d.bonus = tb.value; cambiato(); };
      const selTag = [0, 1].map(i => {
        const s = document.createElement("select"); s.append(new Option("— nessuno —", ""));
        Oggetto.TAG.forEach(([t, n]) => s.append(new Option(n, t, false, (d.tag || [])[i] === t)));
        return s;
      });
      selTag.forEach(s => (s.onchange = () => { d.tag = selTag.map(x => x.value).filter(Boolean); cambiato(); }));
      const co = Object.assign(document.createElement("input"), { type: "text", value: d.codice || "", placeholder: "es. OG09" }); stile(co);
      co.oninput = () => { d.codice = co.value.trim(); cambiato(); };
      p.append(riga("Disposizione", sl), riga("Bonus", tb), riga("Tag 1", selTag[0]), riga("Tag 2", selTag[1]), riga("Codice", co));
      p.append(el("div", "ed-sugg", "Il bonus è solo scritto sulla carta (nelle prove lo somma a mano il giocatore): se comincia con un numero e continua con una caratteristica (Forza, Intelletto, Rapidità, Carisma) il nome diventa la sua icona. Il codice è l'id della carta in oggetti_base.json (OGxx)."));
    } else if (e.tipo === "sfumatura") {
      p.append(riga("Altezza in basso", slider(5, 100, 1, e.altezza, v => (e.altezza = v), v => v + "%")), riga("Intensità", slider(0, 1.5, 0.05, e.intensita, v => (e.intensita = v), v => Math.round(v * 100) + "%")));
    }
  }

  /* ---------- caratteristiche della minaccia (solo dati, nessuna icona sulla carta) ---------- */
  function caratteristiche() {
    const c = $("#edCar"); if (!c) return; c.replaceChildren();
    c.append(el("h3", null, "Caratteristiche"));
    const griglia = el("div", "ed-riga"); griglia.style.flexWrap = "wrap"; griglia.style.gap = "6px 12px";
    CAR_MINACCIA.forEach(([id, nome]) => {
      const l = el("label"); l.style.cssText = "display:flex;gap:5px;align-items:center;color:#a89488;font-size:12px";
      const i = Object.assign(document.createElement("input"), { type: "number", min: 0, max: 99, value: st.caratteristiche[id] == null ? "" : st.caratteristiche[id] });
      i.style.cssText = "width:52px;background:#241818;color:#e9dfd6;border:1px solid #3a2626;border-radius:6px;padding:3px 5px";
      i.oninput = () => { st.caratteristiche[id] = i.value === "" ? null : Math.max(0, Math.min(99, Math.round(Number(i.value) || 0))); cambiato(); };
      l.append(nome, i); griglia.append(l);
    });
    c.append(griglia, el("div", "ed-sugg", "Valori di gioco della minaccia: non compaiono sulla carta. Salva e dimmi di applicarli al gioco (minacce_base.json)."));
  }

  /* ---------- zone cliccabili (solo luoghi) ---------- */
  function caricaZone() {
    const c = ctx;
    Promise.all([fetch("/api/zone").then(r => r.json()), fetch("/api/elementi").then(r => r.json())]).then(([z, n]) => {
      if (ctx !== c) return;
      nomiCat = n; zoneOk = true;
      if (!sporco() && storia.length === 1) {   // nessuna modifica nel frattempo: le zone salvate diventano lo stato di partenza
        st.zone = JSON.parse(JSON.stringify(z[chiaveZone(c.carta)] || {})); salvato = JSON.stringify(st); storia = [salvato]; hi = 0;
      }
      pannelloZone(); zoneDisegna(); barra();
    }).catch(() => { if (ctx === c) alert("Non riesco a leggere le zone salvate: non le modifico (riapri l'editor)."); });
  }
  async function salvaZone() {
    try {
      const r = await fetch("/api/zone", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ carta: ctx.carta.id, chiave: chiaveZone(ctx.carta), zone: st.zone }) });
      if (!r.ok) { alert("Zone non salvate: " + ((await r.json().catch(() => ({}))).errore || r.status)); return false; }
      return true;
    } catch (e) { alert("Zone non salvate: " + e); return false; }
  }
  function cambiatoZone() { zoneDisegna(); barra(); clearTimeout(timer); timer = setTimeout(spingi, 350); }
  function selZona(nome, punto) { zonaSel = nome; puntoSel = punto; zoneDisegna(); pannelloZone(); }

  function puntoDa(ev) {
    const r = $("#edStage").getBoundingClientRect();
    return [arr(lim(((ev.clientX - r.left) / r.width) * 100, 0, 100), 1), arr(lim(((ev.clientY - r.top) / r.height) * 100, 0, 100), 1)];
  }
  function trascinaPunto(ev, nome, i) {
    ev.preventDefault(); ev.stopPropagation(); selZona(nome, i); let mosso = false;
    const mv = m => { const p = st.zone[nome] && st.zone[nome].poligono[i]; if (!p) return; [p[0], p[1]] = puntoDa(m); mosso = true; cambiatoZone(); };
    const su = () => { window.removeEventListener("pointermove", mv); if (mosso) spingi(); };
    window.addEventListener("pointermove", mv); window.addEventListener("pointerup", su, { once: true });
  }
  function trascinaZona(ev, nome) {
    ev.preventDefault(); ev.stopPropagation(); selZona(nome, null);
    const r = $("#edStage").getBoundingClientRect(), orig = st.zone[nome].poligono.map(p => [...p]); let mosso = false;
    const mv = m => {
      let dx = ((m.clientX - ev.clientX) / r.width) * 100, dy = ((m.clientY - ev.clientY) / r.height) * 100;
      dx = lim(dx, -Math.min(...orig.map(p => p[0])), 100 - Math.max(...orig.map(p => p[0])));   // l'intera zona resta dentro l'immagine
      dy = lim(dy, -Math.min(...orig.map(p => p[1])), 100 - Math.max(...orig.map(p => p[1])));
      st.zone[nome].poligono = orig.map(p => [arr(p[0] + dx, 1), arr(p[1] + dy, 1)]); mosso = true; cambiatoZone();
    };
    const su = () => { window.removeEventListener("pointermove", mv); if (mosso) spingi(); };
    window.addEventListener("pointermove", mv); window.addEventListener("pointerup", su, { once: true });
  }
  function aggiungiPunto(ev, nome, dopo) {   // clic su un lato: nuovo vertice proprio lì, poi si può trascinare subito
    ev.preventDefault(); ev.stopPropagation();
    st.zone[nome].poligono.splice(dopo + 1, 0, puntoDa(ev));
    trascinaPunto(ev, nome, dopo + 1); pannelloZone();
  }
  function rimuoviPunto(nome, i) {
    const p = st.zone[nome].poligono; if (p.length <= 3) return;   // un poligono ha almeno 3 vertici
    p.splice(i, 1); puntoSel = null; cambiatoZone(); spingi(); pannelloZone();
  }

  function zoneDisegna() {
    const zl = $("#edZone"); if (!zl) return; zl.replaceChildren();
    if (!modoZone || !st.zone) return;
    const NS = "http://www.w3.org/2000/svg", svg = document.createElementNS(NS, "svg");
    svg.setAttribute("class", "ed-zone-svg"); svg.setAttribute("viewBox", "0 0 100 100"); svg.setAttribute("preserveAspectRatio", "none");
    const entries = Object.entries(st.zone).sort(([a], [b]) => (a === zonaSel) - (b === zonaSel));   // la selezionata sta sopra le altre
    for (const [nome, z] of entries) {
      const p = z.poligono, sl = nome === zonaSel;
      const pol = document.createElementNS(NS, "polygon");
      pol.setAttribute("class", "ed-zona" + (sl ? " sel" : "")); pol.setAttribute("points", p.map(q => q.join(",")).join(" "));
      pol.addEventListener("pointerdown", ev => trascinaZona(ev, nome)); svg.append(pol);
      if (sl) p.forEach((q, i) => {
        const l = document.createElementNS(NS, "line"), n = p[(i + 1) % p.length];
        l.setAttribute("class", "ed-lato"); l.setAttribute("x1", q[0]); l.setAttribute("y1", q[1]); l.setAttribute("x2", n[0]); l.setAttribute("y2", n[1]);
        l.addEventListener("pointerdown", ev => aggiungiPunto(ev, nome, i)); svg.append(l);
      });
    }
    zl.append(svg);
    for (const [nome, z] of entries) {
      const p = z.poligono, sl = nome === zonaSel;
      const et = el("div", "ed-zona-nome", nome);
      et.style.left = (p.reduce((s, q) => s + q[0], 0) / p.length) + "%"; et.style.top = (p.reduce((s, q) => s + q[1], 0) / p.length) + "%"; zl.append(et);
      if (sl) p.forEach((q, i) => {
        const m = el("div", "ed-pt" + (i === puntoSel ? " sel" : "")); m.style.left = q[0] + "%"; m.style.top = q[1] + "%";
        m.title = "Trascina per spostare · doppio clic (o Canc) per togliere il punto";
        m.addEventListener("pointerdown", ev => trascinaPunto(ev, nome, i));
        m.addEventListener("dblclick", ev => { ev.preventDefault(); rimuoviPunto(nome, i); });
        m.addEventListener("contextmenu", ev => { ev.preventDefault(); rimuoviPunto(nome, i); });
        zl.append(m);
      });
    }
  }

  function pannelloZone() {
    const c = $("#edZoneP"); if (!c) return; c.replaceChildren();
    c.append(el("h3", null, "Zone cliccabili"));
    const cb = Object.assign(document.createElement("input"), { type: "checkbox", checked: modoZone });
    cb.onchange = () => {
      modoZone = cb.checked;
      if (modoZone) { soloImgPrima = soloImg; soloImg = true; } else { soloImg = soloImgPrima; zonaSel = null; puntoSel = null; }
      const s = $("#edSoloImg"); if (s) { s.checked = soloImg; s.disabled = modoZone; }
      ridisegna(); pannelloZone();
    };
    c.append(riga("Modifica zone", cb));
    if (!modoZone) { c.append(el("div", "ed-sugg", "Contorni cliccabili degli elementi dentro l'illustrazione: li usa il gioco (assets/carte/zone.json).")); return; }
    const nomi = Object.keys(st.zone || {});
    if (!zoneOk) c.append(el("div", "ed-avviso", "Caricamento delle zone salvate…"));
    const ul = el("ul", "ed-liv");
    nomi.forEach(nome => {
      const li = el("li", nome === zonaSel ? "sel" : ""), b = el("button", "ed-nome ed-nome-zona", `${nome} · ${st.zone[nome].poligono.length} punti`);
      b.onclick = () => selZona(nome, null);
      const x = el("button", "ed-mini", "🗑"); x.title = "Elimina la zona";
      x.onclick = () => { if (!confirm(`Eliminare la zona "${nome}"?`)) return; delete st.zone[nome]; if (zonaSel === nome) { zonaSel = null; puntoSel = null; } cambiatoZone(); spingi(); pannelloZone(); };
      li.append(b, x); ul.append(li);
    });
    c.append(ul);
    const inp = Object.assign(document.createElement("input"), { type: "text", placeholder: "nome dell'elemento", className: "ed-zona-input" }), dl = document.createElement("datalist");
    dl.id = "edElementiCat"; nomiCat.forEach(n => dl.append(new Option(n))); inp.setAttribute("list", "edElementiCat"); inp.style.cssText = "flex:1;min-width:0";
    const nuova = el("button", null, "+ Zona");
    const aggiungi = () => {
      const nome = inp.value.trim(); if (!nome) return;
      if (st.zone[nome]) { selZona(nome, null); return; }
      st.zone[nome] = { poligono: [[40, 40], [60, 40], [60, 60], [40, 60]] };
      zonaSel = nome; puntoSel = null; cambiatoZone(); spingi(); pannelloZone();
    };
    nuova.onclick = aggiungi; inp.onkeydown = ev => { if (ev.key === "Enter") aggiungi(); };
    const r = el("div", "ed-riga"); r.append(inp, dl, nuova); c.append(r);
    if (zonaSel && !nomiCat.includes(zonaSel)) c.append(el("div", "ed-avviso", `"${zonaSel}" non è nel catalogo degli elementi del gioco: va aggiunto (con le sue risposte) perché funzioni.`));
    c.append(el("div", "ed-sugg", "Trascina un punto per spostarlo · clic su un lato per aggiungere un punto · doppio clic (o clic destro, o Canc) su un punto per toglierlo · trascina dentro la zona per spostarla tutta · con un punto selezionato le frecce lo muovono di poco (Maiusc = di più). Ricorda di premere Salva."));
  }

  return { apri };
})();
