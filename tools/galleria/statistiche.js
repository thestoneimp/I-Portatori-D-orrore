/* Elemento "statistiche" delle carte personaggio: 6 valori come icona + numero.
 *   pf = Punti ferita · mov = Movimento · for = Forza · int = Intelletto · rap = Rapidità · car = Carisma
 * Elemento: { tipo:"statistiche", disposizione, stile, scala, valori: {pf:8,...} | null }
 *   disposizione: dove stanno le icone sulla carta (vedi DISPOSIZIONI)
 *   stile:        come sono disegnate le icone (vedi STILI)
 * I valori reali verranno dai dati del personaggio; finché non ci sono si usano quelli d'esempio.
 * Usato da Carta.render (carta.js). Le icone sono SVG: nitide a qualsiasi dimensione. */
const Statistiche = (() => {
  const STAT = [["pf", "Punti ferita"], ["mov", "Movimento"], ["for", "Forza"], ["int", "Intelletto"], ["rap", "Rapidità"], ["car", "Carisma"]];
  const VALORI_ESEMPIO = { pf: 8, mov: 3, for: 4, int: 6, rap: 5, car: 7 };
  const STILI = [["incisione", "Incisione"], ["sigillo", "Sigillo"], ["fumetto", "Fumetto"], ["osd", "OSD / VHS"]];
  const DISPOSIZIONI = [["colonna", "Colonna laterale"], ["barra", "Barra in basso"], ["ali", "Ali"], ["pf", "PF in evidenza"], ["medaglioni", "Medaglioni"], ["griglia", "Griglia in alto"]];

  /* ---- glifi vettoriali 24×24. f = forme (riempite o a contorno secondo lo stile), l = linee di dettaglio ---- */
  const GLIFI = {
    pf: { f: `<path d="M12 20.5S3.2 15.4 3.2 9.4A4.6 4.6 0 0 1 12 7.6a4.6 4.6 0 0 1 8.8 1.8c0 6-8.8 11.1-8.8 11.1z"/>`,
          l: `<path d="M6.6 9.6c.4-1.2 1.4-1.9 2.6-1.8"/>` },
    mov: { f: `<ellipse cx="8.2" cy="16.2" rx="2.7" ry="4.1" transform="rotate(-10 8.2 16.2)"/><circle cx="5.6" cy="10.8" r="1.15"/><circle cx="8" cy="9.9" r="1.15"/><circle cx="10.4" cy="10.5" r="1.15"/>
                <ellipse cx="16.2" cy="8.8" rx="2.7" ry="4.1" transform="rotate(10 16.2 8.8)"/><circle cx="13.6" cy="3.7" r="1.15"/><circle cx="16" cy="2.9" r="1.15"/><circle cx="18.4" cy="3.5" r="1.15"/>`, l: "" },
    for: { f: `<path d="M6.5 11.5V9a1.6 1.6 0 0 1 3.2 0 1.6 1.6 0 0 1 3.2 0 1.6 1.6 0 0 1 3.2 0 1.6 1.6 0 0 1 3.2 0v6.2A5.3 5.3 0 0 1 14 20.5h-1.7a5.8 5.8 0 0 1-5.8-5.8v-3.2z"/>`,
           l: `<path d="M9.7 9v3.4M12.9 9v3.4M16.1 9v3.4M6.6 13.6c2 .3 3.3 1.5 3.5 3.1"/>` },
    int: { f: `<path d="M10.5 4.2A3.3 3.3 0 0 0 7 5.6a3.2 3.2 0 0 0-1.7 4 3.3 3.3 0 0 0 .5 6.3 3.3 3.3 0 0 0 4.7 3.6V4.2z"/><path d="M13.5 4.2A3.3 3.3 0 0 1 17 5.6a3.2 3.2 0 0 1 1.7 4 3.3 3.3 0 0 1-.5 6.3 3.3 3.3 0 0 1-4.7 3.6V4.2z"/>`,
           l: `<path d="M7 9.5c1.2.6 1.5 1.8.6 2.8M17 9.5c-1.2.6-1.5 1.8-.6 2.8"/>` },
    rap: { f: `<path d="M13.5 2 5 13.2h5.6L9.5 22 19 10.2h-5.7L13.5 2z"/>`, l: "" },
    car: { f: `<path d="M12 3C7.2 3 4 6.4 4 10.8c0 4.9 3.4 10.2 8 10.2s8-5.3 8-10.2C20 6.4 16.8 3 12 3z"/>`,
           l: `<path d="M6.8 10.6c1-.9 2.7-.9 3.7.1M17.2 10.6c-1-.9-2.7-.9-3.7.1M8.2 14.6c1.3 2.4 6.3 2.4 7.6 0"/>` },
  };

  /* ---- versione pixel (12 colonne) per lo stile OSD ---- */
  const PIXEL = {
    pf: ["............", ".XXX....XXX.", "XXXXX..XXXXX", "XXXXXXXXXXXX", "XXXXXXXXXXXX", "XXXXXXXXXXXX", ".XXXXXXXXXX.", "..XXXXXXXX..", "...XXXXXX...", "....XXXX....", ".....XX.....", "............"],
    mov: ["............", "..XX........", ".XXXX.......", ".XXXX...XX..", ".XXXX..XXXX.", "..XX...XXXX.", ".......XXXX.", "..XX....XX..", ".XXXX.......", ".XXXX.......", "..XX........", "............"],
    for: ["............", "..X.X.X.X...", ".XXXXXXXXX..", ".XXXXXXXXX..", ".XXXXXXXXX..", ".XXXXXXXXXX.", "XXXXXXXXXXX.", "XXXXXXXXXX..", ".XXXXXXXXX..", "..XXXXXXX...", "...XXXXX....", "............"],
    int: ["............", "...XXXXXX...", "..XXXXXXXX..", ".XX.XX.XXXX.", ".XXXXXXXX.X.", ".XX.XXXXXXX.", ".XXXXX.XXXX.", "..XXXXXXXX..", "...XXXXXX...", "....X..X....", "............", "............"],
    rap: ["......XXX...", ".....XXX....", "....XXX.....", "...XXX......", "..XXXXXXX...", "....XXXXX...", "....XXX.....", "...XXX......", "..XXX.......", "..XX........", "............", "............"],
    car: ["............", "..XXXXXXXX..", ".XXXXXXXXXX.", ".XX.XXXX.XX.", ".X..XXXX..X.", ".XXXXXXXXXX.", ".XXXXXXXXXX.", ".XX.XXXX.XX.", "..XX....XX..", "...XXXXXX...", "....XXXX....", "............"],
  };

  function svgGlifo(id) {
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><g class="f">${GLIFI[id].f}</g><g class="l">${GLIFI[id].l}</g></svg>`;
  }
  function svgPixel(id) {
    let r = "";
    PIXEL[id].forEach((riga, y) => [...riga].forEach((c, x) => { if (c === "X") r += `<rect x="${x}" y="${y}" width="1" height="1"/>`; }));
    return `<svg viewBox="0 0 12 12" shape-rendering="crispEdges" aria-hidden="true">${r}</svg>`;
  }

  /* ---- disposizioni: posizione del centro di ogni icona (x, y in % della carta, ordine pf mov for int rap car),
   *      fattore di grandezza k e un'eventuale tavoletta scura dietro (l, t, w, h in % della carta) ---- */
  function disposizione(id) {
    const S = (xs, ys, k = 1) => xs.map((x, i) => ({ x, y: ys[i], k: Array.isArray(k) ? k[i] : k }));
    switch (id) {
      case "colonna": return { punti: S(Array(6).fill(11.5), [14, 26, 38, 50, 62, 74]), pannello: { l: 2, t: 7, w: 19, h: 75 } };
      case "barra": return { punti: S([8.33, 25, 41.67, 58.33, 75, 91.67], Array(6).fill(75)), pannello: { l: 3, t: 68, w: 94, h: 14 } };
      case "ali": return { punti: S([11, 11, 11, 89, 89, 89], [30, 47, 64, 30, 47, 64]) };
      // PF in evidenza: il PF (grande) e la colonna di destra sporgono leggermente dal bordo: nella carta fisica non compaiono
      case "pf": return { punti: S([10, 94.5, 94.5, 94.5, 94.5, 94.5], [8, 22, 34, 46, 58, 70], [1.55, 1, 1, 1, 1, 1]) };
      case "medaglioni": return { punti: S([12, 88, 8, 92, 12, 88], [8, 8, 40, 40, 74, 74], 1.05) };
      case "riga": return { punti: S([8.33, 25, 41.67, 58.33, 75, 91.67], Array(6).fill(50)) };   // solo per l'anteprima da vicino (non è nel menu)
      case "griglia": return { punti: S([28, 50, 72, 28, 50, 72], [8, 8, 8, 19, 19, 19], 0.95), pannello: { l: 14, t: 3, w: 72, h: 23 } };
      default: return { punti: [] };
    }
  }

  let filtro = false;
  function assicuraFiltro() {   // filtro SVG che rende irregolari i bordi delle icone (effetto "disegnato a mano"), definito una volta sola
    if (filtro || document.getElementById("cx-ruvido")) { filtro = true; return; }
    const d = document.createElement("div");
    d.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";
    d.innerHTML = `<svg width="0" height="0"><filter id="cx-ruvido" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency=".07" numOctaves="2" seed="4" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="1.6"/></filter></svg>`;
    document.body.append(d); filtro = true;
  }

  /* Costruisce il contenitore con tavoletta e icone. `c` = carta (per eventuali valori propri c.stat). */
  function crea(e, c) {
    assicuraFiltro();
    const host = document.createElement("div"); host.className = `cx-el cx-stats cx-st-${e.stile}`;
    const val = Object.assign({}, VALORI_ESEMPIO, c.stat || {}, e.valori || {});
    const d = disposizione(e.disposizione), u0 = 15 * (e.scala || 1), dx = e.dx || 0, dy = e.dy || 0;   // dx, dy: scostamento di tutto il gruppo (% della carta)
    if (d.pannello) {
      const p = document.createElement("div"); p.className = "cx-st-pannello";
      Object.assign(p.style, { left: d.pannello.l + dx + "%", top: d.pannello.t + dy + "%", width: d.pannello.w + "%", height: d.pannello.h + "%" });
      host.append(p);
    }
    STAT.forEach(([id, nome], i) => {
      const pt = d.punti[i]; if (!pt) return;
      const n = document.createElement("div"); n.className = "cx-stat"; n.title = `${nome}: ${val[id]}`;
      n.style.left = pt.x + dx + "%"; n.style.top = pt.y + dy + "%"; n.style.setProperty("--u", u0 * pt.k + "cqw");
      const ico = document.createElement("div"); ico.className = "cx-ico"; ico.innerHTML = e.stile === "osd" ? svgPixel(id) : svgGlifo(id);
      const num = document.createElement("div"); num.className = "cx-num"; num.textContent = val[id];
      n.append(ico, num); host.append(n);
    });
    return host;
  }

  const PREDEFINITO = { id: "statistiche", tipo: "statistiche", nome: "Statistiche", visibile: true, disposizione: "pf", stile: "incisione", scala: 1, dx: 0, dy: 0, valori: null };
  return { STAT, STILI, DISPOSIZIONI, VALORI_ESEMPIO, PREDEFINITO, crea };
})();
