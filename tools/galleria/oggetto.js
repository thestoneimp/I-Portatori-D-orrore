/* Elemento "oggetto" delle carte oggetto: nome, testo del bonus, due tag (icone) e codice di consultazione.
 * Elemento: { tipo:"oggetto", layout, dati: { bonus:"+1 Forza", tag:["tagliente","leva"], codice:"OG09" } | null }
 *   layout: come sono disposti i quattro blocchi sulla carta (vedi LAYOUT); la disposizione è fatta quasi solo di CSS
 *           (oggetto.css, classi .ob-<layout>), quindi aggiungere una variante = una voce in LAYOUT + le sue regole.
 * Significato dei blocchi (vedi "Oggetti e abilità" in CLAUDE.md):
 *   bonus  – il modificatore scritto sulla carta: l'app non lo applica, lo somma a mano il giocatore nella prova
 *   tag    – icone d'uso: il giocatore sceglie l'icona della carta che vuole usare su un elemento del luogo
 *   codice – codice di consultazione (l'`id` della carta in oggetti_base.json): il testo letto dipende dallo scenario
 * Usato da Carta.render (carta.js) sullo strato "fuori", che non ritaglia il bordo: le icone possono sporgere dalla carta
 * (solo nella versione digitale). Le icone sono SVG 24×24: f = forme, l = linee di dettaglio. */
const Oggetto = (() => {
  // icone dei tag (stessi id di ICONE_TAG in script.js e dei `tag` in oggetti_base.json)
  const TAG = [["tagliente", "Tagliente"], ["leva", "Leva"], ["fuoco", "Fuoco"], ["luce", "Luce"], ["chiave", "Chiave"], ["sacro", "Sacro"], ["sparo", "Sparo"]];
  const GLIFI = {
    tagliente: { f: `<path d="M12 2.2 15.6 13H8.4z"/><path d="M6 13.4h12v2H6z"/><path d="M10.8 15.4h2.4v4.6h-2.4z"/><circle cx="12" cy="21.4" r="1.1"/>`, l: `<path d="M12 5.2V11.6"/>` },
    leva: { f: `<path d="M17.6 3.2a4.6 4.6 0 0 0-4.5 6L4.2 18.1a1.9 1.9 0 0 0 2.7 2.7l8.9-8.9a4.6 4.6 0 0 0 6-4.5l-2.9 2.9-2.4-.5-.5-2.4z"/>`, l: `<path d="M6.4 18.2l.2.2"/>` },
    fuoco: { f: `<path d="M12 21.6a6.6 6.6 0 0 1-6.6-6.6c0-3.7 2.8-5.5 3.8-8.5.3-.8.4-1.7.3-2.7 3.1 1.4 5.1 4.4 4.8 7.1.9-.6 1.5-1.6 1.7-2.8 1.7 1.6 2.6 3.7 2.6 6A6.6 6.6 0 0 1 12 21.6z"/>`, l: `<path d="M12 19.8a3 3 0 0 1-3-3c0-1.8 1.6-2.8 2.1-4.3 1.8 1 3.9 2.7 3.9 5.3a3 3 0 0 1-3 2z"/>` },
    luce: { f: `<path d="M12 2.4a6.2 6.2 0 0 0-3.7 11.2c.7.6 1.1 1.3 1.1 2.1V17h5.2v-1.3c0-.8.4-1.5 1.1-2.1A6.2 6.2 0 0 0 12 2.4z"/><path d="M9.4 19h5.2v1.4a1.6 1.6 0 0 1-1.6 1.6h-2a1.6 1.6 0 0 1-1.6-1.6z"/>`, l: `<path d="M9.8 17h4.4M10 14.4 12 11.8l2 2.6"/>` },
    chiave: { f: `<circle cx="7" cy="12" r="4.8"/><path d="M11.6 10.7h9.4v2.6h-2.2v2.5h-2.5v-2.5h-4.7z"/>`, l: `<circle cx="6.2" cy="11.2" r="1.5"/>` },
    sacro: { f: `<path d="M10 2.4h4v6.2h6v4h-6v9h-4v-9H4v-4h6z"/>`, l: `<path d="M12 5v13.5M7 10.6h10"/>` },
    sparo: { f: `<path d="M12 2.4c2.9 2 4.1 5.1 4.1 8.6v9H7.9v-9c0-3.5 1.2-6.6 4.1-8.6z"/><path d="M7.4 20.6h9.2V22H7.4z"/>`, l: `<path d="M8 14.2h8"/>` },
  };

  // layout: [id, nome, stile delle icone]. Stili icone: med = medaglione tondo, sig = rombo (sigillo), quad = quadrato, osd = glifo nudo con alone rosso
  const LAYOUT = [
    ["targhetta", "Targhetta in basso", "med"],
    ["colonna", "Colonna di sigilli", "sig"],
    ["angoli", "Sigilli d'angolo", "sig"],
    ["angoli_icona", "Sigilli d'angolo con icona", "sig"],   // come "angoli", ma nel rombo del bonus c'è l'icona della caratteristica al posto del suo nome
    ["cartiglio", "Cartiglio", "med"],
    ["barre", "Barre alto e basso", "quad"],
    ["osd", "OSD / VHS", "osd"],
  ];
  const DATI_ESEMPIO = { bonus: "+1 Forza", tag: ["tagliente", "leva"], codice: "OG09" };

  // nome della caratteristica nel testo del bonus -> id del glifo delle statistiche (statistiche.js); le altre (tempra, atletica...) restano a parole
  const STAT_DI = { forza: "for", intelletto: "int", intelligenza: "int", rapidita: "rap", agilita: "rap", carisma: "car", pf: "pf", pa: "pa" };
  const statDi = t => STAT_DI[String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase()];
  const svgStat = id => (typeof Statistiche !== "undefined" && Statistiche.GLIFI[id])
    ? `<svg viewBox="0 0 24 24" aria-hidden="true"><g class="f">${Statistiche.GLIFI[id].f}</g><g class="l">${Statistiche.GLIFI[id].l}</g></svg>` : "";

  const el = (cl, html) => Object.assign(document.createElement("div"), { className: cl, innerHTML: html || "" });
  const svg = id => GLIFI[id] ? `<svg viewBox="0 0 24 24" aria-hidden="true"><g class="f">${GLIFI[id].f}</g><g class="l">${GLIFI[id].l}</g></svg>` : "";
  const esc = t => String(t ?? "").replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));

  // "+1 Forza" -> numero "+1" ed etichetta "Forza" (se non comincia con un numero, tutto è etichetta)
  function bonusParti(t) {
    const m = /^\s*([+\-−]\s*\d+)\s*(.*)$/.exec(t || "");
    return m ? { num: m[1].replace(/\s/g, "").replace("-", "−"), et: m[2] } : { num: "", et: String(t || "").trim() };
  }

  let filtro = false;
  function assicuraFiltro() {   // lo stesso filtro "disegnato a mano" delle statistiche (id condiviso), definito una volta sola
    if (filtro || document.getElementById("cx-ruvido")) { filtro = true; return; }
    const d = document.createElement("div"); d.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";
    d.innerHTML = `<svg width="0" height="0"><filter id="cx-ruvido" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency=".07" numOctaves="2" seed="4" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="1.6"/></filter></svg>`;
    document.body.append(d); filtro = true;
  }

  /* Costruisce lo strato della carta. `c` = carta (per il nome). */
  function crea(e, c) {
    assicuraFiltro();
    const lay = LAYOUT.find(l => l[0] === e.layout) || LAYOUT[0];
    const d = Object.assign({}, e.dati || {});   // niente valori d'esempio: la pagina di anteprima passa sempre i suoi
    const host = el(`cx-el ob ob-${lay[0]} ob-${lay[0].split("_")[0]} ob-ico-${lay[2]}`);   // ob-<famiglia>: regole comuni alle varianti di una stessa disposizione
    host.append(el("ob-fascia"), el("ob-fascia2"));
    host.append(el("ob-nome", esc(c.nome)));

    const b = bonusParti(d.bonus);
    const icona = lay[0].endsWith("_icona") && svgStat(statDi(b.et));   // la variante "_icona" sostituisce il nome con l'icona, se la caratteristica ne ha una
    if (b.num || b.et) host.append(el("ob-bonus", `${b.num ? `<span class="ob-num">${esc(b.num)}</span>` : ""}${icona ? `<span class="ob-bico" title="${esc(b.et)}">${icona}</span>` : b.et ? `<span class="ob-et">${esc(b.et)}</span>` : ""}`));

    const tags = el("ob-tags");
    (d.tag || []).slice(0, 2).forEach(t => {
      const n = el("ob-ico", svg(t)); n.title = (TAG.find(x => x[0] === t) || [, t])[1]; tags.append(n);
    });
    host.append(tags);

    if (d.codice) host.append(el("ob-codice", `<span class="ob-cod-et">Cod.</span><span class="ob-cod-v">${esc(d.codice)}</span>`));
    return host;
  }

  return { TAG, GLIFI, LAYOUT, DATI_ESEMPIO, crea, svg };
})();
