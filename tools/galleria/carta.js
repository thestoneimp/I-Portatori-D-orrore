/* Rendering condiviso delle carte (galleria ed editor). Layout attuale: "locandina".
 *
 * Una carta ha una lista ordinata di ELEMENTI (l'ordine è lo z-order, dal fondo alla cima):
 *   immagine   – l'illustrazione (la sua posizione/scala sta nella variante: variante.imm = {x, y, s})
 *   sfumatura  – ombra nera in alto e in basso + vignettatura
 *   cornice    – filo sottile a distanza `inset` dal bordo
 *   testo      – nome (testo=null => nome della carta) o testi aggiunti dall'utente
 * Nuovi tipi di elemento: aggiungere un case in nodo(), un default in predefiniti() e le proprietà in editor.js.
 * Gli elementi della carta stanno in carta.layout.elementi (uguali per tutte le varianti); se mancano si usano i predefiniti.
 */
const Carta = (() => {
  const FONT = ["Bebas Neue", "Oswald", "Special Elite", "Cinzel", "Permanent Marker", "VT323"];
  // s = 1.07: rifila il margine di carta con pennellate che le immagini generate hanno quasi sempre
  const IMM_DEF = { x: 0, y: 0, s: 1.07, st: 1 };   // s = scala (larghezza), st = stiramento verticale rispetto alle proporzioni originali

  // colore (chiaro, per dare contrasto sull'illustrazione) con cui si tinge la cornice di ogni personaggio
  const TINTE_PG = { P01: "#9cc26b", P02: "#f2bb4d", P03: "#c98fd6", P04: "#76aee0", P05: "#ec7f6f", P06: "#62c9bf" };
  const TINTA_MINACCE = "#e0463a";   // le minacce hanno la stessa cornice a marmo dei personaggi, ma sempre rossa
  const MATERIALI = [["", "Nessuno (filo colorato)"], ["marmo_venato", "Marmo venato"]];   // texture in tools/galleria/texture/<id>.png (+ _r = ruotata di 90 gradi)

  const rapporto = c => (c.formato === "orizzontale" ? 3 / 2 : 3 / 4);
  const div = cl => Object.assign(document.createElement("div"), { className: cl });
  const clona = o => JSON.parse(JSON.stringify(o));

  function predefiniti(c) {
    const vert = c.formato !== "orizzontale", pg = c.tipo === "personaggio", min = c.tipo === "minaccia";
    const els = [
      { id: "immagine", tipo: "immagine", nome: "Immagine", visibile: true },
      { id: "sfumatura", tipo: "sfumatura", nome: "Sfumatura", visibile: true, altezza: 48, intensita: 1 },
      pg || min ? { id: "cornice", tipo: "cornice", nome: "Cornice", visibile: true, inset: 0, spessore: 6, colore: min ? TINTA_MINACCE : TINTE_PG[c.id.split("_")[0]] || "#c8c8c8", opacita: 1, raggio: 4.2, materiale: "marmo_venato" }
         : { id: "cornice", tipo: "cornice", nome: "Cornice", visibile: true, inset: 0, spessore: 5, colore: "#ffffff", opacita: 1, raggio: 4.2 },
      // nei personaggi il nome sta più in alto per lasciare posto alla fila di icone grandi che sporge dal bordo inferiore
      { id: "nome", tipo: "testo", nome: "Nome", visibile: true, testo: null, x: 50, y: pg ? 83 : vert ? 88 : 86, dim: min ? 9 : vert ? 13 : 11,
        font: "Bebas Neue", colore: min ? "#f4e6d3" : "#d6281c", spaziatura: 0.6, maiuscolo: true, alone: true, rot: 0 },
    ];
    if (c.tipo === "personaggio" && typeof Statistiche !== "undefined") els.push(clona(Statistiche.PREDEFINITO));   // le carte personaggio hanno le statistiche
    return els;
  }
  const elementi = c => {
    const els = clona((c.layout && c.layout.elementi) || predefiniti(c));
    // layout salvati prima dell'introduzione delle statistiche: le aggiunge (in cima) per i personaggi
    if (c.tipo === "personaggio" && typeof Statistiche !== "undefined" && !els.some(e => e.tipo === "statistiche")) els.push(clona(Statistiche.PREDEFINITO));
    return els;
  };
  const imm = v => ({ ...IMM_DEF, ...((v && v.imm) || {}) });

  function nodo(c, v, e, im, o) {
    if (e.tipo === "immagine") {
      const box = div("cx-el cx-immagine");
      const src = o.src || "/mini/" + v.file;
      // l'elemento <img> viene riusato tra un ridisegno e l'altro (cache): evita lampeggi durante il trascinamento
      let img = o.cacheImg && o.cacheImg.get(src);
      if (!img) { img = new Image(); img.draggable = false; img.src = src; o.cacheImg && o.cacheImg.set(src, img); }
      img.alt = c.nome;
      const applica = () => {
        const r = img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : rapporto(c);
        box.style.width = Math.max(100, (r / rapporto(c)) * 100) * im.s + "%"; // "cover" × scala
      };
      img.addEventListener("load", applica); applica();
      box.style.left = `calc(50% + ${im.x}%)`; box.style.top = `calc(50% + ${im.y}%)`;
      box.style.transform = `translate(-50%, -50%) scale(1, ${im.st})`;   // stiramento: solo in verticale (la larghezza è già in s)
      box.append(img); return box;
    }
    if (e.tipo === "sfumatura") {
      const n = div("cx-el cx-sfumatura"), k = e.intensita;
      n.style.background = `linear-gradient(180deg, rgba(0,0,0,${0.28 * k}) 0%, transparent 22%, transparent ${100 - e.altezza}%, rgba(0,0,0,${Math.min(1, 0.88 * k)}) 100%)`;
      return n;
    }
    if (e.tipo === "cornice" && e.materiale) {   // cornice a materiale: quattro lati con giunti a 45 gradi, texture in grigio tinta con `colore`
      const n = div("cx-el cx-cornice cx-cornice-mat");
      n.style.setProperty("--p", e.spessore + "cqw"); n.style.setProperty("--c", e.colore); n.style.opacity = e.opacita;
      n.style.setProperty("--tx", `url("/s/texture/${e.materiale}.png")`); n.style.setProperty("--txr", `url("/s/texture/${e.materiale}_r.png")`);
      ["t", "b", "l", "r"].forEach(k => n.append(div("lato " + k)));
      return n;
    }
    if (e.tipo === "cornice") {
      const n = div("cx-el cx-cornice");
      n.style.inset = e.inset + "cqw";
      n.style.border = `${e.spessore}cqw solid ${e.colore}`;
      n.style.opacity = e.opacita;
      n.style.borderRadius = e.raggio + "cqw";
      return n;
    }
    if (e.tipo === "statistiche") return Statistiche.crea(e, c);   // vedi statistiche.js
    // testo
    const n = div("cx-el cx-testo");
    n.textContent = e.testo == null ? c.nome : e.testo;
    Object.assign(n.style, {
      left: e.x + "%", top: e.y + "%", transform: `translate(-50%, -50%) rotate(${e.rot || 0}deg)`,
      fontFamily: `"${e.font}", Impact, sans-serif`, fontSize: e.dim + "cqw", color: e.colore, letterSpacing: e.spaziatura + "cqw",
      textTransform: e.maiuscolo ? "uppercase" : "none", textAlign: "center",
      textShadow: e.alone
        ? `0 .5cqw 0 rgba(0,0,0,.75), 0 0 3cqw color-mix(in srgb, ${e.colore} 75%, transparent), 0 0 .8cqw #000`
        : "0 .3cqw .8cqw rgba(0,0,0,.8)",
    });
    return n;
  }

  /* Costruisce la carta. Opzioni: elementi/imm (per l'editor, altrimenti quelli salvati), src (immagine),
   * soloImmagine, modifica (cursori dell'editor), cacheImg (Map per riusare le <img>). */
  function render(c, v, o = {}) {
    const els = o.elementi || elementi(c), im = o.imm || imm(v);
    const wrap = div(`cx-wrap ${c.formato === "orizzontale" ? "cx-orizz" : "cx-vert"}` + (o.modifica ? " cx-modifica" : ""));
    const carta = div("cx-carta"), fuori = div("cx-fuori"); wrap.append(carta, fuori);
    els.forEach((e, i) => {
      if (!e.visibile || (o.soloImmagine && e.tipo !== "immagine")) return;
      const n = nodo(c, v, e, im, o); n.dataset.id = e.id; n.style.zIndex = i + 1;
      (e.tipo === "statistiche" ? fuori : carta).append(n);   // le statistiche stanno sullo strato che può sporgere dal bordo
    });
    return wrap;
  }

  return { FONT, MATERIALI, TINTE_PG, IMM_DEF, rapporto, predefiniti, elementi, imm, render, clona };
})();
