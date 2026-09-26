// ============================
// 📌 0. ELEMENTI "PERSISTENTI" FUORI DA <body>
// ============================
// Il sipario di transizione e l'avviso "ruota il dispositivo" devono
// restare visibili anche quando document.body.innerHTML viene sostituito
// per intero (cambio schermata): spostandoli sotto <html>, che non viene
// mai ricreato, sopravvivono a qualunque cambio schermata invece di
// sparire dopo il primo utilizzo.
(function rendiPersistentiElementiFuoriSchermo() {
  ["siparioTransizione", "avvisoRuotaSchermo", "navOverlay", "gameCornerOverlay"].forEach((id) => {
    const el = document.getElementById(id);
    if (el && el.parentElement !== document.documentElement) {
      document.documentElement.appendChild(el);
    }
  });
})();

// ============================
// 📌 0bis. NAVIGAZIONE A ICONE FISSE (Indietro / Home / Avanti)
// ============================
// Sostituisce i vecchi pulsanti in-flow "Indietro"/"Menu principale"/
// "Avanti" con 3 icone fisse sovrapposte allo schermo (angoli in alto a
// sinistra, in basso a sinistra, in basso a destra), slegate dal layout
// delle singole schermate: queste ultime guadagnano così tutto lo spazio
// verticale che prima serviva a quei pulsanti. Ogni schermata dichiara
// quali icone mostrare e cosa devono fare chiamando mostraNavigazione();
// le schermate che hanno una propria navigazione (Home, schermata di
// gioco) chiamano invece nascondiNavigazione().
function mostraNavigazione({ indietro, home, avanti } = {}) {
  const overlay = document.getElementById("navOverlay");
  const btnIndietro = document.getElementById("navBtnIndietro");
  const btnHome = document.getElementById("navBtnHome");
  const btnAvanti = document.getElementById("navBtnAvanti");
  if (!overlay || !btnIndietro || !btnHome || !btnAvanti) return;

  const configura = (btn, azione) => {
    // Un solo handler alla volta (assegnazione diretta, non addEventListener):
    // evita che i click si accumulino passando più volte per la stessa schermata.
    btn.onclick = typeof azione === "function" ? azione : null;
    btn.hidden = typeof azione !== "function";
  };

  configura(btnIndietro, indietro);
  configura(btnHome, home);
  configura(btnAvanti, avanti);
  overlay.classList.remove("nascosto");
}

function nascondiNavigazione() {
  const overlay = document.getElementById("navOverlay");
  if (overlay) overlay.classList.add("nascosto");
}

// ============================
// 📌 0ter. MENU DI GIOCO A ICONE FISSE (Obiettivi/Personaggi/Tutorial/Impostazioni)
// ============================
// Stesso principio di mostraNavigazione()/nascondiNavigazione(): overlay
// fisso fuori da .game-screen, quindi immune alla sua scala/zoom/pan e non
// conteggiato nello spazio del tabellone. Le azioni sono sempre le stesse
// (assegnazione diretta onclick, non addEventListener, per restare idempotente
// anche se richiamata più volte). Mostrato solo durante la partita.
function mostraMenuGioco() {
  const overlay = document.getElementById("gameCornerOverlay");
  if (!overlay) return;

  document.getElementById("gcBtnObiettivi").onclick = () =>
    toggleSideMenu("menuObiettivi", "left", 300);
  document.getElementById("gcBtnPersonaggi").onclick = () =>
    mostraMenuPersonaggi();
  document.getElementById("gcBtnTutorial").onclick = () =>
    toggleSideMenu("menuTutorial", "left", 300);
  document.getElementById("gcBtnImpostazioni").onclick = () =>
    toggleSideMenu("menuImpostazioni", "right", 300);

  overlay.classList.remove("nascosto");
}

function nascondiMenuGioco() {
  const overlay = document.getElementById("gameCornerOverlay");
  if (overlay) overlay.classList.add("nascosto");
}

// ============================
// 📌 1. DATI INIZIALI E VARIABILI GLOBALI
// ============================

let grigliaTabellone = [];
let passoTutorial = 0;
let gameData = {};
let faseCorrente = "giocatori"; // può essere 'giocatori' o 'minacce'
let ultimoPersonaggioSelezionato = null;
let scenariDisponibili = [];
let elementiInteragibili = []; // array con dati caricati da JSON
let eventiGenerici = []; // catalogo eventi generici richiamabili per tag (eventi_generici.json)
let tutorialData = [];
gameData.proveAbilita = {};
// Chiave → valore cumulato della prova (somma dei contributi).
// Chiave consigliata: `${codiceIstanza}::${nomeStruttura}::${idInterazione}`
gameData.inizioPartita = true;
gameData.inizioFase = true;
gameData.messaggioConferma = false;
gameData.struttureSuLuogo = {}; // max 3 per luogo (tipo lucchetto, assi, botola)
gameData.struttureVerticali = {}; // max 1 per luogo (tipo scale)
gameData.struttureOrizzontali = {}; // max 1 per passaggio tra stanze (tipo macerie)
// Storico interazioni per la partita corrente
// Struttura: { codiceCarta: { nomeElemento: idRisposta } }
gameData.interazioniUsate = {};
gameData.ricercaGenericaAttivata = {}; // ri-azzerato per scenario in mostraScenario()
gameData.eventiGenericiUsati = {}; // ri-azzerato per scenario in mostraScenario()
gameData.scenarioCorrente = "tutti"; // da impostare quando parte lo scenario

function caricaScenari(callback) {
  fetch("scenari_base.json")
    .then((res) => res.json())
    .then((data) => {
      scenariDisponibili = data;
      console.log("Scenari caricati:", scenariDisponibili);
      if (callback) callback();
    })
    .catch((err) => {
      console.error("Errore nel caricamento di scenari_base.json:", err);
    });
}

function caricaTutorial() {
  return fetch("tutorial_base.json")
    .then((res) => res.json())
    .then((data) => {
      tutorialData = data;
      console.log("📚 Tutorial caricato:", tutorialData);
      popolaMenuTutorial();
    })
    .catch((err) => console.error("Errore caricamento tutorial:", err));
}

function popolaMenuTutorial() {
  const container = document.getElementById("listaCategorieTutorial");
  if (!container) return;

  container.innerHTML = "";

  tutorialData.forEach((categoria, index) => {
    const catDiv = document.createElement("div");
    catDiv.classList.add("categoria-tutorial");

    // Crea intestazione categoria
    const catHeader = document.createElement("h4");
    catHeader.textContent = categoria.categoria;
    catHeader.style.cursor = "pointer";
    catHeader.onclick = () => toggleCategoria(index);

    // Lista voci (inizialmente nascosta)
    const listaVoci = document.createElement("ul");
    listaVoci.style.display = "none"; // tutte chiuse all'inizio
    categoria.voci.forEach((voce) => {
      const voceLi = document.createElement("li");
      voceLi.innerHTML = `<button onclick="mostraVoceTutorial('${voce.titolo}')">${voce.titolo}</button>`;
      listaVoci.appendChild(voceLi);
    });

    catDiv.appendChild(catHeader);
    catDiv.appendChild(listaVoci);
    container.appendChild(catDiv);
  });
}

// Funzione per aprire/chiudere le categorie in stile accordion
function toggleCategoria(index) {
  const categorie = document.querySelectorAll("#listaCategorieTutorial ul");
  categorie.forEach((lista, i) => {
    if (i === index) {
      // Alterna solo la categoria cliccata
      lista.style.display =
        lista.style.display === "none" || lista.style.display === ""
          ? "block"
          : "none";
    } else {
      // Chiude tutte le altre
      lista.style.display = "none";
    }
  });
}

// 🔹 Gestione popup impilati (voci del Tutorial consultate una sopra
// l'altra): un solo sfondo scuro condiviso, un leggero sfalsamento per
// vederli tutti, e un pulsante "Chiudi tutti" quando sono più di uno.
// Osserva il DOM invece di modificare ogni singola funzione che crea popup.
function getOverlaySfondoPopup() {
  let overlay = document.getElementById("overlaySfondoPopup");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "overlaySfondoPopup";
    document.body.appendChild(overlay);
  }
  return overlay;
}

function getBtnChiudiTuttiTutorial() {
  let btn = document.getElementById("btnChiudiTuttiTutorial");
  if (!btn) {
    btn = document.createElement("button");
    btn.id = "btnChiudiTuttiTutorial";
    btn.className = "btn-chiudi-tutti-tutorial";
    btn.textContent = "Chiudi tutti";
    btn.onclick = () => {
      document
        .querySelectorAll(".popup-voce-tutorial")
        .forEach((p) => chiudiPopupSelettivo(p));
    };
    document.body.appendChild(btn);
  }
  return btn;
}

function aggiornaGestionePopupImpilati() {
  const overlay = getOverlaySfondoPopup();
  const popups = Array.from(document.querySelectorAll(".popup"));
  overlay.style.display = popups.length > 0 ? "block" : "none";

  // Sfalsamento leggero: ogni popup successivo un po' più in basso,
  // così restano tutti visibili invece di sparire esattamente uno sotto l'altro.
  const STEP_PX = 24;
  popups.forEach((p, i) => {
    p.style.paddingTop = `${100 + i * STEP_PX}px`;
  });

  const voci = document.querySelectorAll(".popup-voce-tutorial");
  getBtnChiudiTuttiTutorial().style.display = voci.length > 1 ? "block" : "none";

  // 🔹 Collega ai link ipertestuali appena apparsi nel testo (di qualunque
  // popup/descrizione) il comportamento "a comparsa" al passaggio del mouse.
  collegaHoverTutorial(document.body);
}

new MutationObserver(aggiornaGestionePopupImpilati).observe(document.body, {
  childList: true,
  subtree: true,
});

// 🔹 Finestre "a comparsa" per i link del Tutorial: appaiono sotto al link al
// passaggio del mouse, si chiudono da sole quando il mouse esce, e possono
// contenere a loro volta altri link che aprono altre finestre annidate.
let flyoutContatoreTutorial = 0;

function chiudiFlyoutTutorialECollegati(flyout) {
  if (!flyout) return;
  const id = flyout.dataset.flyoutId;
  document
    .querySelectorAll(`.tutorial-flyout[data-parent-flyout-id="${id}"]`)
    .forEach((figlio) => chiudiFlyoutTutorialECollegati(figlio));
  flyout.remove();
}

function creaFlyoutTutorial(titolo, ancoraEl, parentFlyoutId) {
  const voce = tutorialData.flatMap((c) => c.voci).find((v) => v.titolo === titolo);
  if (!voce) return null;

  flyoutContatoreTutorial++;
  const flyout = document.createElement("div");
  flyout.className = "tutorial-flyout";
  flyout.dataset.flyoutId = String(flyoutContatoreTutorial);
  if (parentFlyoutId) flyout.dataset.parentFlyoutId = String(parentFlyoutId);
  flyout.innerHTML = `
    <div class="tutorial-flyout-titolo">${voce.titolo}</div>
    <div class="tutorial-flyout-testo">${voce.testo}</div>
  `;
  document.body.appendChild(flyout);

  // Posizionamento: appena sotto il link, tenendosi dentro lo schermo
  const rect = ancoraEl.getBoundingClientRect();
  const margine = 8;
  const fRect = flyout.getBoundingClientRect();

  let left = rect.left;
  const maxLeft = window.innerWidth - fRect.width - margine;
  if (left > maxLeft) left = Math.max(margine, maxLeft);

  let top = rect.bottom + margine;
  if (top + fRect.height > window.innerHeight - margine) {
    const topSopra = rect.top - fRect.height - margine;
    if (topSopra >= margine) top = topSopra;
  }

  flyout.style.left = `${left}px`;
  flyout.style.top = `${top}px`;

  return flyout;
}

// Rileva se il dispositivo ha davvero un mouse (hover) o va gestito a tocco.
const usaHoverTutorial = window.matchMedia(
  "(hover: hover) and (pointer: fine)"
).matches;

function collegaHoverTutorial(root) {
  root.querySelectorAll(".tutorial-link:not([data-hover-collegato])").forEach((link) => {
    link.dataset.hoverCollegato = "1";

    let flyout = null;
    let timerChiusura = null;

    const apri = () => {
      if (flyout) return;
      const flyoutGenitore = link.closest(".tutorial-flyout");
      const parentId = flyoutGenitore ? flyoutGenitore.dataset.flyoutId : null;
      flyout = creaFlyoutTutorial(link.dataset.voce, link, parentId);
      if (!flyout) return;
      collegaHoverTutorial(flyout); // link annidati dentro il flyout appena creato
      if (usaHoverTutorial) {
        flyout.addEventListener("mouseenter", annullaChiusura);
        flyout.addEventListener("mouseleave", programmaChiusura);
      }
    };

    const chiudiOra = () => {
      if (flyout) {
        chiudiFlyoutTutorialECollegati(flyout);
        flyout = null;
      }
    };

    const programmaChiusura = () => {
      clearTimeout(timerChiusura);
      timerChiusura = setTimeout(chiudiOra, 200);
    };

    const annullaChiusura = () => clearTimeout(timerChiusura);

    if (usaHoverTutorial) {
      // 🖱️ Con il mouse: apre al passaggio, si chiude quando esce
      link.addEventListener("mouseenter", () => {
        annullaChiusura();
        apri();
      });
      link.addEventListener("mouseleave", programmaChiusura);
    } else {
      // 👆 A tocco: primo tap apre, tap di nuovo sullo stesso link chiude
      // (un tap altrove, fuori da link/riquadri, chiude tutto: vedi sotto)
      link.addEventListener("click", (e) => {
        e.stopPropagation();
        if (flyout) {
          chiudiOra();
        } else {
          apri();
        }
      });
    }
  });
}

// 🔹 A tocco: un tap fuori da qualunque link o riquadro chiude tutti i
// riquadri aperti. Registrato una sola volta.
if (!usaHoverTutorial && !document.body.dataset.tapFuoriTutorialCollegato) {
  document.body.dataset.tapFuoriTutorialCollegato = "1";
  document.addEventListener("click", (e) => {
    if (e.target.closest(".tutorial-flyout, .tutorial-link")) return;
    document
      .querySelectorAll(".tutorial-flyout:not([data-parent-flyout-id])")
      .forEach((f) => chiudiFlyoutTutorialECollegati(f));
  });
}

function mostraVoceTutorial(titolo, onClose = null) {
  const voce = tutorialData
    .flatMap((c) => c.voci)
    .find((v) => v.titolo === titolo);

  if (!voce) return;

  const pulsanti = [
    {
      testo: "Chiudi",
      azione: (btn) => {
        chiudiPopupSelettivo(btn.closest(".popup"));
        if (typeof onClose === "function") {
          onClose();
        }
      },
    },
  ];

  mostraPopupGenerico({
    titolo: voce.titolo,
    messaggio: voce.testo,
    pulsanti,
    chiudiAltri: false, // 🔹 importante: non chiudere altri popup
  });

  // 🔹 Solo le voci consultate come approfondimento (niente onClose che fa
  // avanzare il tutorial guidato) possono essere chiuse tutte insieme.
  if (!onClose) {
    const tuttiPopup = document.querySelectorAll(".popup");
    const popupAppenaCreato = tuttiPopup[tuttiPopup.length - 1];
    if (popupAppenaCreato) {
      popupAppenaCreato.classList.add("popup-voce-tutorial");
    }
  }

  if (voce.freccia && voce.posizioneFreccia) {
    gestisciFrecciaTutorial(true, voce.posizioneFreccia);
  } else {
    gestisciFrecciaTutorial(false);
  }
}

// 🔹 Il click sui link ipertestuali è stato sostituito dal passaggio del
// mouse (vedi collegaHoverTutorial): niente più popup da chiudere.

fetch("elementi_interagibili_base.json")
  .then((res) => res.json())
  .then((data) => {
    elementiInteragibili = data;
    console.log(
      "📦 Elementi interagibili caricati:",
      elementiInteragibili.length,
      "elementi"
    );
  })
  .catch((err) =>
    console.error("Errore caricamento elementi interagibili:", err)
  );

fetch("eventi_generici.json")
  .then((res) => res.json())
  .then((data) => {
    eventiGenerici = data;
    console.log("📦 Eventi generici caricati:", eventiGenerici.length);
  })
  .catch((err) => console.error("Errore caricamento eventi generici:", err));

fetch("eroi_base.json")
  .then((response) => response.json())
  .then((data) => {
    gameData.eroiDisponibili = data;

    // 🔹 Inizializza il movimento attuale per ciascun eroe
    gameData.movimentoAttuale = {};
    data.forEach((pg) => {
      gameData.movimentoAttuale[pg.nome] = pg.movimento; // valore dal JSON
    });
  });

window.addEventListener("load", () => {
  caricaScenari(); // Carica gli scenari all'avvio dell'app
});

// Carica catalogo carte struttura
fetch("carte_struttura_base.json")
  .then((res) => res.json())
  .then((data) => {
    gameData.catalogoStrutture = data; // salva in memoria
    console.log("📚 Catalogo strutture caricato:", data.length, "voci");
  })
  .catch((err) =>
    console.error("Errore caricamento carte_struttura_base:", err)
  );

// Carica catalogo PNG (modelli riutilizzabili, non ancora istanze in gioco)
fetch("png_base.json")
  .then((res) => res.json())
  .then((data) => {
    gameData.catalogoPng = data;
    console.log("👤 Catalogo PNG caricato:", data.length, "voci");
  })
  .catch((err) => console.error("Errore caricamento png_base:", err));

fetch("minacce_base.json")
  .then((res) => res.json())
  .then((data) => {
    gameData.catalogoMinacce = data;
    console.log("👹 Catalogo minacce caricato:", data.length, "voci");
  })
  .catch((err) => console.error("Errore caricamento minacce_base:", err));

// ============================
// 📁 Caricamento dati stanze
// ============================

async function caricaCarteLuogo() {
  return fetch("portatori_orrore_base.json")
    .then((res) => {
      if (!res.ok) throw new Error("Errore nel caricamento carte luogo");
      return res.json();
    })
    .then((dati) => {
      gameData.tutteLeCarteLuogo = dati;
      console.log("✔️ Carte luogo caricate:", gameData.tutteLeCarteLuogo); // DEBUG
      return dati;
    })
    .catch((err) => {
      console.error("Errore caricamento carte luogo:", err);
      return {};
    });
}

// ============================
// 📌 2. MENU PRINCIPALE & AVVIO PARTITA
// ============================

function startNewGame() {
  const container = document.querySelector(".container");
  container.classList.remove("schermata-iniziale");
  container.innerHTML = `
    <h2>Inizia nuova partita</h2>
    <p><strong>Per giocare a questo gioco devi possedere la versione Base del gioco.</strong></p>
    <p>Possiedi anche delle espansioni con cui vuoi giocare?</p>
    <form id="configForm">
      <label>
        <input type="checkbox" name="espansione" value="piramide_dorata" />
        La Piramide Dorata
      </label><br/>
      <label>
        <input type="checkbox" name="espansione" value="invasione_zombi" />
        Invasione Zombi
      </label><br/>
    </form>
    <p id="status"></p>
  `;

  document
    .getElementById("configForm")
    .addEventListener("submit", function (e) {
      e.preventDefault();

      const esp = Array.from(this.espansione)
        .filter((cb) => cb.checked)
        .map((cb) => cb.value);

      gameData.espansioni = esp;

      document.getElementById("status").innerText =
        esp.length > 0
          ? `Hai selezionato ${esp.length} espansion${
              esp.length > 1 ? "i" : "e"
            }: ${esp.join(", ")}.`
          : `Stai giocando solo con la versione base.`;

      mostraSelezionePersonaggi();
    });

  mostraNavigazione({
    home: goToMainMenu,
    avanti: () => document.getElementById("configForm").requestSubmit(),
  });
}

function continueGame() {
  const popup = document.createElement("div");
  popup.classList.add("popup");

  popup.innerHTML = `
    <div class="popup-content">
      <h3>Seleziona uno slot da caricare</h3>
      ${[1, 2, 3]
        .map((i) => {
          const salvataggio = localStorage.getItem(`salvataggio${i}`);
          return `
            <div class="salva-slot" onclick="caricaPartita(${i})">
              Slot ${i} ${salvataggio ? "(📝 presente)" : "(vuoto)"}
            </div>
          `;
        })
        .join("")}
      <button onclick="chiudiPopup()">Annulla</button>
    </div>
  `;

  document.body.appendChild(popup);
}

// ============================
// 📌 3. SELEZIONE GIOCATORI E PERSONAGGI
// ============================

// === Selezione personaggi in un'unica schermata ===

function mostraSelezionePersonaggi() {
  const eroi = (gameData.eroiDisponibili || []).map((e) => e.nome);
  gameData._selezioniPG = new Set();

  const container = document.querySelector(".container");
  if (!container) return;

  container.innerHTML = `
    <h2 style="text-align:center;margin-bottom:16px">Selezione Personaggi</h2>

    <div id="gridSelezionePG" class="grid-selezione-pg"></div>

    <!-- 🔹 contatore giocatori -->
    <div id="playerCount" class="player-count">Numero Giocatori - 0</div>
  `;

  const grid = document.getElementById("gridSelezionePG");

  eroi.forEach((nome) => {
    const card = document.createElement("div");
    card.className = "pg-card";
    card.dataset.pg = nome;
    card.innerHTML = `
      <div class="avatar-placeholder">[Avatar]</div>
      <div class="pg-name">${nome}</div>
      <button class="pg-toggle-btn" type="button">Seleziona Personaggio</button>
    `;
    card.querySelector(".pg-toggle-btn").addEventListener("click", () => {
      toggleSelezionePG(nome, card);
    });
    grid.appendChild(card);
  });

  mostraNavigazione({
    indietro: goToMainMenu,
    home: goToMainMenu,
    avanti: confermaSelezionePG,
  });
}

function toggleSelezionePG(nome, cardEl) {
  const set = gameData._selezioniPG || (gameData._selezioniPG = new Set());
  const btn = cardEl.querySelector(".pg-toggle-btn");

  if (set.has(nome)) {
    set.delete(nome);
    cardEl.classList.remove("selected");
    btn.textContent = "Seleziona Personaggio";
  } else {
    set.add(nome);
    cardEl.classList.add("selected");
    btn.textContent = "Rimuovi Personaggio";
  }

  // 🔹 aggiorna contatore direttamente qui
  const n = set.size;
  const counter = document.getElementById("playerCount");
  if (counter) counter.textContent = `Numero Giocatori - ${n}`;

  // (opzionale) disabilita/abilita "Avanti" se vuoi vincoli live
  // const avanti = document.getElementById("btnSelezioneAvanti");
  // if (avanti) avanti.disabled = (n === 0 || n > 6);
}

function confermaSelezionePG() {
  const selezioni = Array.from(gameData._selezioniPG || []);
  const n = selezioni.length;

  // validazioni richieste
  if (n === 0) {
    mostraPopupGenerico({
      titolo: "Nessuna selezione",
      messaggio: "Nessun Personaggio selezionato.",
      pulsanti: [{ testo: "Chiudi", azione: chiudiPopup }],
    });
    return;
  }
  if (n > 6) {
    mostraPopupGenerico({
      titolo: "Troppe selezioni",
      messaggio: "E' possibile selezionare un massimo di 6 Personaggi.",
      pulsanti: [{ testo: "Chiudi", azione: chiudiPopup }],
    });
    return;
  }

  // salva nello stato di gioco
  gameData.personaggi = selezioni; // es. ["Alessia la Cacciatrice", ...]
  gameData.numeroGiocatori = selezioni.length;

  // prosegui come il flusso attuale (carte iniziali + avanti)
  mostraCarteInizialiDopoSelezione();
}

// schermata “Carte iniziali” identica al flusso che avevi
function mostraCarteInizialiDopoSelezione() {
  const container = document.querySelector(".container");
  if (!container) return;

  container.innerHTML = `
    <h2 style="text-align:center;margin-bottom:16px">Carte iniziali</h2>

    <!-- wrapper che consente il centraggio delle righe incomplete -->
    <div class="grid-selezione-wrapper">
      <div id="gridCarteIniziali" class="grid-selezione-pg"></div>
    </div>
  `;

  mostraNavigazione({
    indietro: mostraSelezionePersonaggi,
    home: goToMainMenu,
    avanti: mostraObiettiviPersonali,
  });

  const grid = document.getElementById("gridCarteIniziali");

  (gameData.personaggi || []).forEach((pg, i) => {
    const carte = getCarteIniziali(pg);
    const abil = (carte.abilità || []).join(", ");
    const eqp = (carte.equipaggiamento || []).join(", ");

    const card = document.createElement("div");
    card.className = "pg-card initial-card";
    card.dataset.pg = pg;

    card.innerHTML = `
      <div class="avatar-placeholder">[Avatar]</div>
      <div class="pg-name" style="text-align:center">Giocatore ${
        i + 1
      } — ${pg}</div>

      <div class="initial-details">
        <div class="row"><span class="label">Abilità:</span> <span class="value">${
          abil || "—"
        }</span></div>
        <div class="row"><span class="label">Equipaggiamento:</span> <span class="value">${
          eqp || "—"
        }</span></div>
      </div>
    `;

    grid.appendChild(card);
  });
}

function getCarteIniziali(nomeEroe) {
  const eroe = gameData.eroiDisponibili.find((e) => e.nome === nomeEroe);
  return eroe || { abilità: [], equipaggiamento: [] };
}

function goToMainMenu() {
  faseCorrente = "giocatori"; // Resetta la fase a inizio partita
  nascondiNavigazione(); // la Home ha i propri pulsanti, non serve l'overlay
  nascondiMenuGioco(); // si esce dalla partita: nasconde le 4 icone d'angolo
  document.body.innerHTML = `
    <div class="home-background" aria-hidden="true">
      <video class="home-background-video" autoplay muted loop playsinline preload="auto">
        <source src="assets/media/animazione-casa-sfondo.mp4" type="video/mp4" />
      </video>
      <div class="home-background-overlay"></div>
    </div>
    <div class="container schermata-iniziale">
      <h1>I Portatori d'Orrore</h1>
      <p class="sottotitolo-iniziale">La casa ricorda chi è entrato.</p>
      <div class="azioni-iniziali">
        <button onclick="startNewGame()">Nuova Partita<span>Inizia una nuova indagine</span></button>
        <button onclick="continueGame()">Continua Partita<span>Riprendi la partita salvata</span></button>
        <button onclick="mostraMenuCampagna()">Modalità Campagna<span>Gioca una storia a lungo termine</span></button>
      </div>
      <p id="status"></p>
    </div>
  `;
}
// ============================
// 📌 4. FASI DI PREPARAZIONE (Tabellone, Obiettivi, Scenario)
// ============================

function mostraObiettiviPersonali() {
  const obiettiviIndividuali = [
    "Uccidere almeno 2 minacce",
    "Raccogliere 3 oggetti mistici",
    "Non subire danni per 5 turni",
    "Visitare tutte le stanze",
  ];

  const assegnati = [];
  for (let i = 0; i < gameData.numeroGiocatori; i++) {
    const casuale =
      obiettiviIndividuali[
        Math.floor(Math.random() * obiettiviIndividuali.length)
      ];
    assegnati.push(casuale);
  }

  gameData.obiettiviIndividuali = assegnati;

  const html = `
      <h2>Obiettivi Personali</h2>
      <p>Mescolate il mazzo degli Obiettivi Personali e distribuitene uno ad ogni giocatore.</p>
      <p><strong>Mi raccomando:</strong> non rivelate i vostri Obiettivi Personali agli altri giocatori, fino a quando l'Obiettivo stesso non vi indica di farlo.</p>
      <p>Una volta fatto, premete l'icona verde "Avanti" in basso a destra.</p>
    `;

  document.querySelector(".container").innerHTML = html;

  mostraNavigazione({
    indietro: mostraCarteInizialiDopoSelezione,
    home: goToMainMenu,
    avanti: mostraSelezioneScenario,
  });
}

function mostraSelezioneScenario() {
  const html = `
    <h2>Selezione dello Scenario</h2>
    <p>Se questa è la vostra prima partita, vi consigliamo caldamente di selezionare lo Scenario Tutorial: <strong>"La notte di Halloween"</strong>, che vi introdurrà alle regole base del gioco e al corretto utilizzo di questa applicazione.</p>
    <p>Se invece conoscete già tutte le regole a menadito, procedete pure con l'assegnazione di uno Scenario Casuale.</p>

    <button class="tutorial" onclick="selezionaScenarioTutorial()">Scenario Tutorial: La Notte di Halloween</button>
    <button class="casuale" onclick="selezionaScenarioCasuale()">Scenario Casuale</button>
  `;

  document.querySelector(".container").innerHTML = html;

  mostraNavigazione({
    indietro: mostraObiettiviPersonali,
    home: goToMainMenu,
  });
}

function selezionaScenarioTutorial() {
  const tutorial = scenariDisponibili.find((s) => s.tipo === "tutorial");
  if (!tutorial) {
    alert("Errore: scenario tutorial non trovato!");
    return;
  }

  const avviaConScelta = (saltaSpiegazioni) => {
    gameData.saltaSpiegazioniTutorial = saltaSpiegazioni;
    caricaCarteLuogo().then(() => {
      gameData.scenario = tutorial;
      gameData.contestoAmbientale = risolviContestoAmbientale(tutorial);
      preparaTabellonePerScenario();
      mostraScenario(tutorial, true);
    });
  };

  // 🔹 Chiede se mostrare i popup esplicativi del Tutorial. In entrambi i casi
  // il setup della partita (piazzamento porte/finestre, ecc.) avviene comunque:
  // scegliere "No" salta solo i messaggi, non il gioco.
  mostraPopupGenerico({
    titolo: "Spiegazioni del Tutorial",
    messaggio:
      "Vuoi vedere i messaggi esplicativi del Tutorial? Il setup della partita avviene comunque in entrambi i casi.",
    pulsanti: [
      {
        testo: "Sì, mostrale",
        azione: () => {
          chiudiPopup();
          avviaConScelta(false);
        },
      },
      {
        testo: "No, salta",
        azione: () => {
          chiudiPopup();
          avviaConScelta(true);
        },
      },
    ],
  });
}

function selezionaScenarioCasuale() {
  const comuni = scenariDisponibili.filter((s) => s.tipo === "comune");
  if (comuni.length > 0) {
    const casuale = comuni[Math.floor(Math.random() * comuni.length)];
    caricaCarteLuogo().then(() => {
      gameData.scenario = casuale;
      gameData.contestoAmbientale = risolviContestoAmbientale(casuale);
      preparaTabellonePerScenario();
      mostraScenario(casuale);
    });
  } else {
    alert("Errore: nessuno scenario comune disponibile!");
  }
}

function mostraScenario(scenario, isTutorial = false) {
  gameData.scenario = scenario;
  gameData.scenarioCorrente = scenario.codice || "tutti"; // 🔹 aggiunto per interazioni
  gameData.turniRimanenti = scenario.turni;
  gameData.tutorialAttivo = isTutorial;
  gameData.turniCompletati = []; // All'inizio nessuno ha agito
  gameData.movimentoUsato = {}; // Nessuno ha ancora effettuato il proprio movimento
  gameData.pngAttivi = []; // Nessun PNG ancora presente in questo scenario
  gameData.minacceAttive = []; // Nessuna minaccia ancora presente in questo scenario
  gameData.flagScenario = {}; // Flag locali di questo scenario (si azzerano ogni scenario)
  gameData.interazioniUsate = {}; // Frasi descrittive congelate per elemento: si riazzerano a ogni nuovo scenario
  gameData.eventiEseguiti = []; // Eventi già scattati in questo scenario
  gameData.eventiGenericiUsati = {}; // Eventi generici (es. "Ragno") già capitati in questo scenario, ovunque
  gameData.turnoMinacceAttuale = 0; // Contatore fasi minaccia, azzerato a ogni scenario
  gameData.ricercaGenericaAttivata = {}; // Elementi che hanno già attivato un evento generico via "Cerca" in questo scenario

  console.log(`🎯 Scenario corrente impostato: ${gameData.scenarioCorrente}`);

  const html = `
    <div class="scenario-anteprima-layout">
      <div class="scenario-anteprima-testo">
        <h2>${isTutorial ? "Scenario Tutorial" : "Scenario Comune"}</h2>
        <h3>${scenario.nome}</h3>
        <p><em>${scenario.introduzione}</em></p>
        <p><strong>Obiettivo:</strong> ${scenario.obiettivo}</p>
        <p><strong>Turni disponibili:</strong> ${scenario.turni}</p>
      </div>
      <div class="scenario-anteprima-tabellone">
        <div id="previewTabellone"></div>
      </div>
    </div>
  `;

  document.querySelector(".container").innerHTML = html;

  mostraNavigazione({
    indietro: mostraSelezioneScenario,
    home: goToMainMenu,
    avanti: () =>
      mostraSchermataScenario(
        gameData.scenario.nome,
        gameData.scenario.descrizione || gameData.scenario.introduzione,
        gameData.scenario.immagine
      ),
  });

  setTimeout(() => {
    generaGrigliaTabelloneNascosto();
    // 🔹 generaPreviewTabellone() viene richiamata automaticamente da
    // adattaSchermataAllaFinestra() (osservatore delle modifiche al DOM,
    // vedi più sotto), che ne calcola anche la scala corretta in base allo
    // spazio disponibile: non serve chiamarla anche qui.
  }, 100);
}

function mostraSchermataScenario(titolo, testo, immagine) {
  // Se l'overlay non esiste, crealo
  let schermata = document.getElementById("schermataScenario");
  if (!schermata) {
    const markup = `
      <div id="schermataScenario" class="schermata-scenario" style="display:none">
        <h1 id="titoloScenario"></h1>
        <div class="contenuto-scenario">
          <div class="testo-scenario" id="testoScenario"></div>
          <div class="immagine-scenario">
            <img id="immagineScenario" alt="Immagine scenario" />
          </div>
        </div>
        <button id="btnIniziaScenario" class="btn-primary">Inizia</button>
      </div>`;
    document.body.insertAdjacentHTML("beforeend", markup);
    schermata = document.getElementById("schermataScenario");
  }

  // Selettori interni (entro l'overlay) per evitare conflitti con altri id
  const titoloEl = schermata.querySelector("#titoloScenario");
  const testoEl = schermata.querySelector("#testoScenario");
  const immagineEl = schermata.querySelector("#immagineScenario");

  // Popola contenuti
  if (titoloEl) titoloEl.textContent = titolo || "";
  if (immagineEl)
    immagineEl.src =
      immagine || "https://via.placeholder.com/400x500?text=Scenario";

  // Testo con animazione (se esiste la tua funzione), altrimenti testo semplice
  if (typeof animazioneTestoScenario === "function") {
    animazioneTestoScenario(testo || "", testoEl);
  } else if (testoEl) {
    testoEl.textContent = testo || "";
  }

  // Mostra overlay
  schermata.style.display = "flex";

  // 🔹 Il vecchio pulsante "Inizia" in-flow è sostituito dall'icona verde
  // "Avanti" dell'overlay di navigazione fisso, coerente con le altre
  // schermate (il markup #btnIniziaScenario resta ma è nascosto via CSS).
  mostraNavigazione({
    avanti: () => {
      schermata.style.display = "none";
      // Avvio effettivo del gioco
      mostraSchermataPrincipale();
    },
  });
}

function animazioneTestoScenario(testo, elemento) {
  if (Array.isArray(testo)) {
    testo = testo.join(" ");
  }

  elemento.innerHTML = "";

  // Regex che separa i tag HTML completi dal testo normale
  const tokens = testo.split(/(<[^>]+>.*?<\/[^>]+>|\s+)/);

  let delay = 0;

  tokens.forEach((token) => {
    if (!token) return;

    // Se è uno spazio, lo aggiungiamo direttamente senza animazione
    if (/^\s+$/.test(token)) {
      elemento.appendChild(document.createTextNode(token));
      return;
    }

    // Se è HTML completo (apertura e chiusura nello stesso token)
    if (
      token.startsWith("<") &&
      token.endsWith(">") &&
      /<\/[^>]+>$/.test(token)
    ) {
      const span = document.createElement("span");
      span.innerHTML = token; // Mantiene tutta la formattazione
      span.style.opacity = "0";
      span.style.transition = "opacity 0.5s ease";
      elemento.appendChild(span);

      setTimeout(() => {
        span.style.opacity = "1";
      }, delay);
      delay += 150;
    }
    // Testo normale → spezza in parole
    else {
      const parole = token.split(/(\s+)/);
      parole.forEach((parola) => {
        if (!parola) return;
        const span = document.createElement("span");
        span.textContent = parola;
        span.style.opacity = "0";
        span.style.transition = "opacity 0.5s ease";
        elemento.appendChild(span);

        setTimeout(() => {
          span.style.opacity = "1";
        }, delay);
        delay += 150;
      });
    }
  });
}

function generaGrigliaTabelloneNascosto() {
  let container = document.getElementById("tabelloneNascosto");
  if (!container) {
    container = document.createElement("div");
    container.id = "tabelloneNascosto";
    container.style.display = "none";
    document.body.appendChild(container);
  }

  container.innerHTML = "";
  const griglia = document.createElement("div");
  griglia.className = "griglia-tabellone";

  for (const carta of gameData.tabelloneAttivo) {
    const cella = document.createElement("div");
    cella.className = "carta-tabellone";
    cella.innerText = carta.codice;

    cella.style.gridColumnStart = carta.posizione.x + 1;
    cella.style.gridRowStart = carta.posizione.y + 1;

    griglia.appendChild(cella);
  }

  container.appendChild(griglia);
}

function generaPreviewTabellone() {
  const container = document.getElementById("previewTabellone");
  if (!container) return;

  const tabelloneOrig = document
    .getElementById("tabelloneNascosto")
    .querySelector(".griglia-tabellone");

  if (!tabelloneOrig) {
    console.warn("❌ Tabellone nascosto non trovato.");
    return;
  }

  const clone = tabelloneOrig.cloneNode(true);

  // Applica lo stile corretto per la preview
  clone.className = "griglia-preview-tabellone";
  clone.style.transform = "none"; // misuriamo la dimensione naturale prima di scalare

  // 🔹 Il clone viene misurato FUORI dal flusso (position:absolute,
  // invisibile) invece di sostituire subito il contenuto: se lo si
  // inserisse a piena grandezza nel flusso normale, il container
  // "ballerebbe" temporaneamente a un'altezza enorme, e siccome .container
  // è centrato verticalmente (justify-content:center), questo sposterebbe
  // anche la posizione (getBoundingClientRect().top) misurata subito dopo
  // — falsando il calcolo dello spazio verticale disponibile. Lasciando
  // invece il contenuto precedente (o vuoto) al suo posto durante la
  // misurazione, la posizione resta stabile. Si sostituisce tutto solo
  // alla fine, con la scala già corretta.
  clone.style.position = "absolute";
  clone.style.visibility = "hidden";
  clone.style.pointerEvents = "none";
  container.appendChild(clone);

  // 🔹 La scala non è più un valore fisso (0.6): su schermi bassi in
  // landscape lasciava uscire l'anteprima dal fondo dello schermo. Si
  // misura invece lo spazio VERTICALE realmente rimasto sotto il punto in
  // cui l'anteprima è posizionata (che dipende dal layout: sotto al testo
  // se impilata, accanto se in due colonne) e la si scala di conseguenza,
  // così l'anteprima non sfora mai, qualunque sia il layout.
  const naturaleW = clone.scrollWidth;
  const naturaleH = clone.scrollHeight;
  if (!naturaleW || !naturaleH) {
    clone.remove();
    return;
  }

  const disponibileW = container.clientWidth || naturaleW;

  // 🔹 L'icona verde "Avanti" è fissa in basso a destra, proprio sopra
  // l'angolo dove finisce questa colonna: si riserva lo spazio che occupa
  // (misurato dal vero elemento, non un valore fisso, così regge anche a
  // future modifiche della sua dimensione) più un piccolo margine, invece
  // di un margine fisso che su schermi molto larghi e bassi non bastava a
  // evitare la sovrapposizione.
  const iconAvanti = document.getElementById("navBtnAvanti");
  const spazioIcona =
    iconAvanti && !iconAvanti.hidden
      ? window.innerHeight - iconAvanti.getBoundingClientRect().top + 10
      : 16;
  const MARGINE_INFERIORE = Math.max(16, spazioIcona);
  const disponibileH = Math.max(
    60,
    window.innerHeight - container.getBoundingClientRect().top - MARGINE_INFERIORE
  );

  const scala = Math.min(1, disponibileW / naturaleW, disponibileH / naturaleH);

  // 🔹 Centratura orizzontale: la griglia naturale (prima di scalare) è
  // quasi sempre più larga del container (che su schermi orizzontali è
  // solo metà schermo), quindi "width:fit-content; margin:0 auto" (CSS)
  // non la centra affatto — un margine "auto" non può essere negativo, si
  // azzera, e la griglia resta ancorata a sinistra sforando a destra. Si
  // calcola quindi qui lo scarto tra lo spazio disponibile e la larghezza
  // GIÀ SCALATA, e lo si applica come traslazione esplicita (con
  // transform-origin "top left", non più "top center", così scala e
  // traslazione non interferiscono tra loro).
  const larghezzaScalata = naturaleW * scala;
  const offsetX = Math.max(0, (disponibileW - larghezzaScalata) / 2);

  // Ora si applica il risultato finale: si sostituisce il contenuto del
  // container con l'unico clone, in flusso normale, già alla scala giusta.
  clone.style.position = "";
  clone.style.visibility = "";
  clone.style.pointerEvents = "";
  clone.style.margin = "0";
  clone.style.transformOrigin = "top left";
  clone.style.transform = `translateX(${offsetX}px) scale(${scala})`;
  container.innerHTML = "";
  container.appendChild(clone);
  container.style.height = `${naturaleH * scala}px`;
  container.style.overflow = "hidden";
}

function toggleSideMenu(menuId, direction = "left", width = 300) {
  const menu = document.getElementById(menuId);
  const overlay = document.getElementById("overlaySfondo");
  const gameScreen = document.querySelector(".game-screen");

  const isOpen = menu.classList.toggle("open");

  if (isOpen) {
    // Apertura menu → sposta schermo
    if (direction === "left") {
      gameScreen.style.transform = `translateX(${width}px)`;
    } else if (direction === "right") {
      gameScreen.style.transform = `translateX(-${width}px)`;
    }
    overlay.style.display = "block";
  } else {
    // Chiusura menu → reset immediato
    gameScreen.style.transform = "translateX(0)";
    overlay.style.display = "none";

    const ghost = document.createElement("div");
    ghost.style.position = "fixed";
    ghost.style.top = "0";
    ghost.style.left = "0";
    ghost.style.width = "100vw";
    ghost.style.height = "100vh";
    ghost.style.background = "transparent";
    ghost.style.zIndex = "999999"; // come un popup
    document.body.appendChild(ghost);

    // piccolo delay, poi rimuove e resetta
    setTimeout(() => {
      gameScreen.style.transform = "translateX(0)";

      ghost.remove();
    }, 350);
  }

  // Chiudi se clic fuori
  overlay.onclick = () => {
    if (isOpen) toggleSideMenu(menuId, direction, width);
  };
}

// ============================
// 📌 5. AVVIO PARTITA E UI PRINCIPALE
// ============================

function mostraSchermataPrincipale() {
  // la schermata di gioco ha la propria navigazione a icone d'angolo
  nascondiNavigazione();
  mostraMenuGioco();

  console.log(
    "DEBUG → posizioniPersonaggi all'inizio partita:",
    gameData.posizioniPersonaggi
  );

  document
    .querySelectorAll("#tabelloneNascosto, .griglia-preview-tabellone")
    .forEach((el) => el.remove());

  window.onpopstate = function () {
    const menu = document.getElementById("menuObiettivi");
    if (menu?.classList.contains("open")) {
      toggleSideMenu("menuObiettivi", "left", 300);
      history.pushState(null, null);
    } else {
      goToMainMenu();
    }
  };

  history.pushState(null, null);
  if (typeof gameData.turniRimanenti !== "number") {
    gameData.turniRimanenti = gameData.scenario.turni;
  }

  document.body.innerHTML = `
    <div class="overlay" id="overlaySfondo"></div>
    <div id="gameViewport" class="game-viewport">
      <div id="gameFit" class="game-fit">
        <div class="game-screen">
          <div id="tabelloneDinamico" class="griglia-tabellone"></div>
          <div id="grigliaPersonaggi" class="griglia-personaggi"></div>
          <div class="turn-counter" id="turnCounter">Contatore Minacce: ${gameData.turniRimanenti}</div>
          <div id="phaseIndicator" class="phase-indicator"></div>
          <button id="btnAvanzaTurno" class="advance-turn-btn">Termina Turno</button>
        </div>
      </div>
    </div>

    <div id="menuObiettivi" class="side-menu">
      <h3>Obiettivi Comuni</h3>
      <ul id="listaObiettivi"></ul>
    </div>

    <div id="menuTutorial" class="side-menu">
      <h3>Tutorial</h3>
      <div id="listaCategorieTutorial"></div>
    </div>

    <div id="menuImpostazioni">
      <h3>Impostazioni Audio</h3>
      <label>Volume Generale</label>
      <input type="range" min="0" max="100" value="80" id="volumeGenerale" />
      <label>Volume Musica</label>
      <input type="range" min="0" max="100" value="60" id="volumeMusica" />
      <label>Volume Effetti</label>
      <input type="range" min="0" max="100" value="70" id="volumeEffetti" />
      <hr/>
      <button id="toggleMessaggioConfermaBtn" onclick="toggleMessaggioConferma()">...</button>
      <button onclick="mostraMenuSalvataggi()">Salva Partita</button>
      <button onclick="confermaRitornoMenu()">Torna al Menu Principale</button>
    </div>
  `;

  generaGrigliaTabellone();
  adattaGameScreenAllaFinestra();
  aggiornaContatoreTurni();
  aggiornaTestoPulsanteConferma();
  aggiornaListaObiettivi();
  caricaTutorial();

  document.getElementById("btnAvanzaTurno").addEventListener("click", () => {
    console.log("Pulsante Termina Turno cliccato");
    if (gameData.pgAttivo) {
      gameData.turniCompletati.push(gameData.pgAttivo);
      gameData.pgAttivo = null;
      aggiornaIndicatoreFase();
    }
    faseGiocatori();
  });

  document.getElementById("overlaySfondo").addEventListener("click", () => {
    const popup = document.querySelector(".popup");
    if (popup) return;
    if (document.getElementById("menuObiettivi")?.classList.contains("open")) {
      toggleSideMenu("menuObiettivi", "left", 300);
    }
    if (
      document.getElementById("menuImpostazioni")?.classList.contains("open")
    ) {
      toggleSideMenu("menuImpostazioni", "right", 300);
    }
  });

  if (gameData.posizioniPersonaggi) {
    const celleIniziali = [
      ...new Set(Object.values(gameData.posizioniPersonaggi)),
    ];
    aggiornaPersonaggiNelleCelle(celleIniziali);
  }

  // 🔹 BLOCCO PER L'INIZIO PARTITA
  if (gameData.inizioPartita) {
    setupIniziale(1); // Avvia il setup iniziale a step
    return; // Fermiamo qui per non far partire tutorial/fase giocatori
  }

  if (
    gameData.scenario?.nome === "La Notte di Halloween" &&
    gameData.tutorialAttivo
  ) {
    setTimeout(() => avviaTutorialFase(1), 500);
  }

  if (!gameData.tutorialAttivo) {
    faseGiocatori();
  }
}

// 📦 Motore generico di setup: piazza gli sbarramenti previsti da QUALSIASI
// scenario. Il primo passo (finestre perimetrali + porte interne) fa parte
// della plancia di gioco standard e viene eseguito SEMPRE, per qualunque
// scenario: non dipende dal JSON. Dopo quello, esegue anche gli eventuali
// passi specifici di questo scenario (scenario.setupStrutture, dal JSON).
// Un passo alla volta, con popup di istruzione (sempre mostrato, non è una
// spiegazione tutorial), poi passa al successivo.
// 🔹 Piazza i PNG previsti dallo scenario (scenario.pngIniziali, dal JSON),
// SEMPRE nascosti: verranno rivelati solo quando la loro stanza viene
// esplorata (vedi rivelaPngNascostiIn). Nessun popup qui: è un piazzamento
// silenzioso, come lo erano gli sbarramenti prima di essere scoperti.
function eseguiSetupPng() {
  const passi = gameData.scenario?.pngIniziali || [];

  passi.forEach((passo) => {
    const candidate = (gameData.tabelloneAttivo || []).filter((c) => {
      if (passo.criterio?.piano && c.piano !== passo.criterio.piano)
        return false;
      if (
        passo.criterio?.escludiTipi &&
        passo.criterio.escludiTipi.includes(c.tipo)
      )
        return false;
      return true;
    });
    if (candidate.length === 0) {
      console.warn("[eseguiSetupPng] Nessun luogo idoneo trovato per:", passo);
      return;
    }

    const scelta = candidate[Math.floor(Math.random() * candidate.length)];
    creaPng(passo.codicePng, scelta.codice, {
      nome: passo.nome,
      visibile: false,
    });
  });
}

function eseguiSetupStrutture(indice, onFine) {
  const passoBase = {
    tipoStep: "perimetro",
    titoloPopup: "Porte e Finestre",
    messaggioPopup:
      "Piazza le <span class='tutorial-link' data-voce='Sbarramenti'> Carte Sbarramento</span> porte e finestre come indicato.",
  };
  const passiScenario = gameData.scenario?.setupStrutture || [];
  const passi = [passoBase, ...passiScenario];

  if (indice >= passi.length) {
    onFine();
    return;
  }

  const passo = passi[indice];
  const prosegui = () => eseguiSetupStrutture(indice + 1, onFine);

  if (passo.tipoStep === "perimetro") {
    // 🔹 Qui si piazzano finestre e porte in tutta la casa, non un singolo
    // elemento: mostriamo prima l'intera plancia (nessuno zoom su un punto
    // preciso), così il messaggio non sembra riferirsi a un solo elemento.
    resetZoom();
    creaFinestrePerimetro();
    piazzaSbarramentiPortaInterni();
  } else {
    piazzaSbarramentoGenerico(
      passo.tipoA,
      passo.tipoB,
      passo.quantita || 1,
      passo.nomeCarta
    );
  }

  if (!passo.titoloPopup) {
    prosegui();
    return;
  }

  mostraPopupGenerico({
    titolo: passo.titoloPopup,
    messaggio: passo.messaggioPopup || "",
    pulsanti: [
      {
        testo: "Chiudi",
        azione: () => {
          chiudiPopup();
          resetZoom();
          setTimeout(prosegui, 500);
        },
      },
    ],
  });
}

// ============================
// 📌 CONTESTO AMBIENTALE (statoCasa / meteo / momento)
// ============================
// Se lo scenario dichiara un valore esplicito lo usa; altrimenti ne pesca
// uno a caso dal vocabolario, cosicché anche uno scenario già giocato offra
// un'ambientazione diversa la volta successiva.
const VOCAB_CONTESTO = {
  statoCasa: ["abbandonata", "abitata", "in_rovina", "curata"],
  meteo: ["sereno", "pioggia", "nebbia", "tempesta", "neve"],
  momento: ["giorno", "notte"],
};

function risolviContestoAmbientale(scenario) {
  const risolto = {};
  for (const chiave of Object.keys(VOCAB_CONTESTO)) {
    if (scenario && scenario[chiave]) {
      risolto[chiave] = scenario[chiave];
    } else {
      const opzioni = VOCAB_CONTESTO[chiave];
      risolto[chiave] = opzioni[Math.floor(Math.random() * opzioni.length)];
    }
  }
  return risolto;
}

const FRAMMENTI_CONTESTO = {
  statoCasa: {
    abbandonata: "La casa è disabitata da tempo, avvolta in un silenzio innaturale.",
    abitata: "La casa è ancora abitata: si avverte una presenza recente tra le stanze.",
    in_rovina: "Anni di incuria hanno lasciato il segno: crepe, umidità e legno marcio ovunque.",
    curata: "Nonostante tutto, la casa appare ben tenuta e curata nei minimi dettagli.",
  },
  meteo: {
    sereno: "Il cielo è sereno, illuminato da una luce fredda e distante.",
    pioggia: "Una pioggia sottile e incessante batte sui vetri.",
    nebbia: "Una fitta nebbia avvolge ogni cosa, rendendo incerti i contorni.",
    tempesta: "Il vento ulula e i tuoni rimbombano in lontananza.",
    neve: "Una coltre di neve silenziosa ricopre ogni cosa.",
  },
  momento: {
    notte: "È notte fonda.",
    giorno: "È giorno, anche se la luce fatica a farsi strada.",
  },
};

// Popup d'atmosfera mostrato dopo il setup (sbarramenti/PNG) e prima
// dell'esplorazione automatica del luogo di partenza.
function mostraIntroAmbientale(callback) {
  const ctx = gameData.contestoAmbientale || {};
  const parti = [
    FRAMMENTI_CONTESTO.momento[ctx.momento],
    FRAMMENTI_CONTESTO.meteo[ctx.meteo],
    FRAMMENTI_CONTESTO.statoCasa[ctx.statoCasa],
  ].filter(Boolean);

  mostraPopupGenerico({
    titolo: "L'atmosfera della casa",
    messaggio: parti.join(" "),
    pulsanti: [
      {
        testo: "Continua",
        azione: (btn) => {
          chiudiPopupSelettivo(btn.closest(".popup"));
          if (callback) callback();
        },
      },
    ],
  });
}

function setupIniziale(passo) {
  switch (passo) {
    case 1: // Controlla il tipo di scenario e avvia il flusso corretto
      if (gameData.scenario?.tipo === "tutorial") {
        avviaTutorialFase(1); // Tutorial: spiegazioni + setup dimostrativo
      } else {
        // Scenario comune: nessuna spiegazione, dritti al setup (se previsto)
        eseguiSetupStrutture(0, () => {
          eseguiSetupPng();
          spawnMinacciaTest(); // 🧪 test: minaccia in un luogo casuale
          mostraIntroAmbientale(() => setupIniziale("exploraIniziale"));
        });
      }
      break;

    case "exploraIniziale": {
      console.log("🔍 Esplorazione automatica luogo iniziale...");

      // 🔹 Solo le posizioni dei GIOCATORI vanno esplorate qui — un PNG o
      // una minaccia già piazzati (ma non ancora scoperti/esplorati) non
      // devono far esplorare la loro stanza.
      const idPngAttivi = new Set((gameData.pngAttivi || []).map((p) => p.id));
      const idMinacceAttive = new Set(
        (gameData.minacceAttive || []).map((m) => m.id)
      );
      const posizioniIniziali = [
        ...new Set(
          Object.entries(gameData.posizioniPersonaggi)
            .filter(
              ([nome]) => !idPngAttivi.has(nome) && !idMinacceAttive.has(nome)
            )
            .map(([, cella]) => cella)
        ),
      ];

      // 🔹 Cosa fare quando TUTTE le carte di partenza sono state esplorate:
      // nel tutorial, prosegui con le spiegazioni; in qualsiasi altro
      // scenario, chiudi il setup e avvia davvero la partita.
      const dopoEsplorazioneIniziale = () => {
        if (gameData.tutorialAttivo) {
          avviaTutorialFase(9);
        } else {
          setupIniziale("fine");
        }
      };

      const daEsplorare = posizioniIniziali.filter((codice) => {
        const carta = gameData.tabelloneAttivo.find((c) => c.codice === codice);
        return carta && !carta.esplorata;
      });

      if (daEsplorare.length === 0) {
        dopoEsplorazioneIniziale();
        return;
      }

      let rimasteDaEsplorare = daEsplorare.length;
      daEsplorare.forEach((codice) => {
        const carta = gameData.tabelloneAttivo.find((c) => c.codice === codice);
        setTimeout(() => {
          completaEsplorazione(carta, () => {
            rimasteDaEsplorare--;
            if (rimasteDaEsplorare === 0) dopoEsplorazioneIniziale();
          });
        }, 500);
      });
      return;
    }

    case "fine":
      console.log("✅ Setup iniziale completato.");
      gameData.inizioPartita = false;
      mostraSchermataPrincipale(); // Avvia il flusso normale di gioco
      eseguiEventiScenario("inizioScenario");
      break;
  }
}

function faseGiocatori() {
  faseCorrente = "giocatori";

  const ancoraDaAgire = gameData.personaggi.filter(
    (pg) => !gameData.turniCompletati.includes(pg)
  );

  if (ancoraDaAgire.length === 0) {
    faseMinacce();
  } else if (gameData.turniCompletati.length === 0) {
    if ((gameData.inizioFase = true)) {
      gameData.inizioFase = false;
      mostraMessaggioFase();
      aggiornaIndicatoreFase();
      setTimeout(() => {
        if (ancoraDaAgire.length === 1) {
          // Solo un giocatore rimasto → inizia direttamente il suo turno
          avviaTurnoPer(ancoraDaAgire[0]);
        } else {
          mostraMenuTurniGiocatori(ancoraDaAgire);
        }
      }, 3000);
    }
  } else if (ancoraDaAgire.length === 1) {
    // Solo un giocatore rimasto → inizia direttamente il suo turno
    avviaTurnoPer(ancoraDaAgire[0]);
  } else {
    mostraMenuTurniGiocatori(ancoraDaAgire);
  }
}

function faseMinacce() {
  faseCorrente = "minacce";
  mostraMessaggioFase();
  gameData.turniRimanenti--;
  aggiornaContatoreTurni();
  aggiornaIndicatoreFase();

  const turnoAttuale = (gameData.scenario?.turni || 0) - gameData.turniRimanenti;
  eseguiEventiScenario("turno", { numero: turnoAttuale });

  // 👹 Contatore delle fasi minaccia trascorse — serve alle minacce per
  // sapere "quanto tempo fa" hanno sentito un rumore (associazione
  // rumore↔vittima entro un certo numero di fasi, vedi associaRumoriRecenti).
  gameData.turnoMinacceAttuale = (gameData.turnoMinacceAttuale || 0) + 1;

  // Qui in futuro: azioni delle minacce...

  // 🔹 Fine turni disponibili → sconfitta
  if (gameData.turniRimanenti <= 0) {
    mostraSconfitta();
    return;
  }

  gameData.turniCompletati = []; // Reset turni
  gameData.movimentoUsato = {}; // Reset movimento: nuovo round, nuovo movimento per tutti
  gameData.inizioFase = true;
}

// === DIAGNOSTICA TABELLONE (log compatto e ordinato) ===
function _diagnosticaBounds(label = "") {
  try {
    const lista = Array.isArray(gameData?.tabelloneAttivo)
      ? gameData.tabelloneAttivo
      : [];
    const rows = lista
      .map((c) => ({
        codice: c.codice,
        tipo: c.tipo,
        x: Number(c?.posizione?.x),
        y: Number(c?.posizione?.y),
      }))
      .sort((a, b) => a.y - b.y || a.x - b.x);

    const xs = rows.map((r) => r.x).filter(Number.isFinite);
    const ys = rows.map((r) => r.y).filter(Number.isFinite);
    const minX = xs.length ? Math.min(...xs) : null;
    const maxX = xs.length ? Math.max(...xs) : null;
    const minY = ys.length ? Math.min(...ys) : null;
    const maxY = ys.length ? Math.max(...ys) : null;

    console.groupCollapsed(`📐 BOUNDS ${label}`);
    console.table(rows);
    console.log("min/max", { minX, maxX, minY, maxY });
    const strada = rows.find((r) => r.tipo === "strada");
    const ingresso = rows.find((r) => r.tipo === "ingresso");
    console.log("strada/ingresso", { strada, ingresso });
    console.groupEnd();

    return { minX, maxX, minY, maxY, strada, ingresso };
  } catch (e) {
    console.warn("diagnosticaBounds error:", e);
    return null;
  }
}

function preparaTabellonePerScenario() {
  console.clear();
  console.log("🚧 [START] Preparazione tabellone per scenario...");

  const tutte = gameData.tutteLeCarteLuogo;

  // ========================
  // 1️⃣ STRUTTURA FISSA
  // ========================
  const struttura = {
    soffitta: 1,
    casa_piano2: 3,
    casa_piano1: 3,
    casa_piano0: 3,
    cantina: 3,
    giardino: 2,
    strada: 1,
  };
  console.log("📌 Struttura tabellone:", struttura);

  // ========================
  // 2️⃣ Raggruppo le carte per piano
  // ========================
  const cartePerTipoPiano = {};
  for (const codice in tutte) {
    const carta = tutte[codice];
    if (!cartePerTipoPiano[carta.piano]) {
      cartePerTipoPiano[carta.piano] = [];
    }
    cartePerTipoPiano[carta.piano].push({ codice, ...carta });
  }
  console.log("📂 Carte raggruppate per piano:", cartePerTipoPiano);

  // ========================
  // 3️⃣ Selezione ingresso (unico)
  // ========================
  const ingresso = scegliCasuali(
    cartePerTipoPiano["casa"].filter((c) => c.tipo === "ingresso"),
    1
  )[0];
  console.log("🚪 Ingresso scelto:", ingresso.codice);

  // ========================
  // 4️⃣ Giardini (2 carte qualsiasi dal piano giardino)
  // ========================
  const giardini = scegliCasuali(
    cartePerTipoPiano["giardino"],
    struttura.giardino
  );
  console.log(
    "🌳 Giardini scelti:",
    giardini.map((c) => c.codice)
  );

  // ========================
  // 5️⃣ Strada (unica carta)
  // ========================
  const strada = scegliCasuali(
    cartePerTipoPiano["strada"],
    struttura.strada
  )[0];
  console.log("🛣️ Strada scelta:", strada.codice);

  // ========================
  // 6️⃣ Cantina (massimo 1 per tipo)
  // ========================
  const cantinaDisponibili = [...cartePerTipoPiano["cantina"]];
  const cantina = [];
  while (cantina.length < struttura.cantina && cantinaDisponibili.length > 0) {
    const carta = scegliCasuali(cantinaDisponibili, 1)[0];
    if (!cantina.some((c) => c.tipo === carta.tipo)) {
      cantina.push(carta);
    }
    cantinaDisponibili.splice(cantinaDisponibili.indexOf(carta), 1);
  }
  console.log(
    "🍷 Cantina scelte:",
    cantina.map((c) => c.codice)
  );

  // ========================
  // 7️⃣ Soffitta (massimo 1 per tipo)
  // ========================
  const soffittaDisponibili = [...cartePerTipoPiano["soffitta"]];
  const soffitta = [];
  while (
    soffitta.length < struttura.soffitta &&
    soffittaDisponibili.length > 0
  ) {
    const carta = scegliCasuali(soffittaDisponibili, 1)[0];
    if (!soffitta.some((c) => c.tipo === carta.tipo)) {
      soffitta.push(carta);
    }
    soffittaDisponibili.splice(soffittaDisponibili.indexOf(carta), 1);
  }
  console.log(
    "🏚️ Soffitta scelte:",
    soffitta.map((c) => c.codice)
  );

  // ========================
  // 8️⃣ Casa (vincoli: max 2 stesso tipo in tutto il tabellone)
  // ========================
  const casaDisponibili = cartePerTipoPiano["casa"].filter(
    (c) => c.tipo !== "ingresso"
  );
  const tipoConteggio = {};
  const casaSelezionate = [];

  const selezionaCasa = (quante, pianoLabel) => {
    console.log(`🏠 Selezione carte casa per ${pianoLabel}...`);
    while (
      casaSelezionate.filter(
        (c) => c.piano === "casa" && c.pianoLabel === pianoLabel
      ).length < quante &&
      casaDisponibili.length > 0
    ) {
      const carta = scegliCasuali(casaDisponibili, 1)[0];
      const tipo = carta.tipo;

      if (!tipoConteggio[tipo]) tipoConteggio[tipo] = 0;

      if (
        tipoConteggio[tipo] < 2 &&
        !casaSelezionate
          .filter((c) => c.pianoLabel === pianoLabel)
          .some((c) => c.tipo === tipo)
      ) {
        casaSelezionate.push({ ...carta, pianoLabel });
        tipoConteggio[tipo]++;
        console.log(`   ➕ Aggiunta ${carta.codice} (${tipo})`);
      }

      casaDisponibili.splice(casaDisponibili.indexOf(carta), 1);
    }
  };

  selezionaCasa(struttura.casa_piano2, "piano2");
  selezionaCasa(struttura.casa_piano1, "piano1");
  selezionaCasa(struttura.casa_piano0 - 1, "piano0"); // -1 per ingresso

  console.log(
    "🏠 Casa selezionate:",
    casaSelezionate.map((c) => c.codice)
  );

  // ========================
  // 9️⃣ Salviamo le scelte per il posizionamento
  // ========================
  gameData.scelteTabellone = {
    ingresso,
    giardini,
    strada,
    cantina,
    soffitta,
    casa: casaSelezionate,
  };

  console.log("💾 [SCELTE SALVATE]", gameData.scelteTabellone);

  // ========================
  // 🔟 Procediamo al posizionamento
  // ========================
  posizionaCarteTabellone();
}

function posizionaCarteTabellone() {
  console.log("🚧 [START] Posizionamento carte sul tabellone...");

  const { ingresso, giardini, strada, cantina, soffitta, casa } =
    gameData.scelteTabellone;

  const larghezza = 3;
  const xStart = 2;

  const yMap = { piano2: 1, piano1: 2, piano0: 3, soffitta: 0, cantina: 4 };

  const slotLiberi = {
    piano0: [xStart, xStart + 1, xStart + 2],
    piano1: [xStart, xStart + 1, xStart + 2],
    piano2: [xStart, xStart + 1, xStart + 2],
  };

  const assegnaPosizione = (carta, pianoKey) => {
    if (!slotLiberi[pianoKey] || slotLiberi[pianoKey].length === 0) {
      console.warn(`⚠️ Nessuno slot libero per ${carta.codice} in ${pianoKey}`);
      return;
    }
    const x = slotLiberi[pianoKey].shift();
    carta.posizione = { x, y: yMap[pianoKey] };
    console.log(
      `   ➕ ${carta.codice} posizionata in (${x},${yMap[pianoKey]}) [${pianoKey}]`
    );
  };

  // 1️⃣ Ingresso → scegli lato e posiziona nell’estremo della casa
  const latoIngresso = Math.random() < 0.5 ? "sx" : "dx"; // sx = sinistra, dx = destra
  const ingressoX = latoIngresso === "sx" ? xStart : xStart + larghezza - 1;
  ingresso.posizione = { x: ingressoX, y: yMap.piano0 };
  // togli lo slot occupato
  slotLiberi.piano0 = slotLiberi.piano0.filter((v) => v !== ingressoX);

  console.log(
    `🚪 Ingresso posizionato a ${
      latoIngresso === "sx" ? "SINISTRA" : "DESTRA"
    }: (${ingressoX},${yMap.piano0})`
  );

  // 2️⃣ Giardini (uno per lato; quello vicino all’ingresso sullo stesso lato)
  const gardenLeftX = xStart - 1; // esterno sinistro
  const gardenRightX = xStart + larghezza; // esterno destro

  giardini[0].posizione = {
    x: latoIngresso === "sx" ? gardenLeftX : gardenRightX,
    y: yMap.piano0,
  };
  giardini[1].posizione = {
    x: latoIngresso === "sx" ? gardenRightX : gardenLeftX,
    y: yMap.piano0,
  };

  console.log(
    `🌳 Giardini posizionati: ${giardini[0].codice}→(${giardini[0].posizione.x},${yMap.piano0}), ` +
      `${giardini[1].codice}→(${giardini[1].posizione.x},${yMap.piano0})`
  );

  // 3️⃣ Strada sullo stesso lato dell’ingresso
  strada.posizione = {
    x: latoIngresso === "sx" ? xStart - 2 : xStart + larghezza + 1,
    y: yMap.piano0,
  };
  console.log(
    `🛣️ Strada lato ${latoIngresso === "sx" ? "SINISTRA" : "DESTRA"}: (${
      strada.posizione.x
    },${yMap.piano0})`
  );

  // 4️⃣ Cantina
  cantina.forEach((c) => {
    c.posizione = { x: xStart + cantina.indexOf(c), y: yMap.cantina };
  });
  console.log(
    "🍷 Cantina posizionata:",
    cantina.map((c) => `${c.codice} (${c.posizione.x},${c.posizione.y})`)
  );

  // 5️⃣ Calcolo slot laterali liberi
  const slotLaterali = [];
  for (const pianoKey of ["piano2", "piano1", "piano0"]) {
    slotLaterali.push({ piano: pianoKey, x: xStart }); // sinistra
    slotLaterali.push({ piano: pianoKey, x: xStart + larghezza - 1 }); // destra
  }
  const slotLateraliLiberi = slotLaterali.filter(
    (s) => slotLiberi[s.piano] && slotLiberi[s.piano].includes(s.x)
  );
  console.log("📍 Slot laterali liberi:", slotLateraliLiberi);

  // 6️⃣ Finestre scelte
  let carteFinestra = casa.filter((c) => c.finestra === true);
  console.log(
    "🪟 Carte finestra trovate:",
    carteFinestra.map((c) => c.codice)
  );

  // 7️⃣ Se troppe finestre → rimuovi e sostituisci
  if (carteFinestra.length > slotLateraliLiberi.length) {
    const eccesso = carteFinestra.length - slotLateraliLiberi.length;
    console.log(`⚠️ Finestre in eccesso: ${eccesso}`);

    const rimosse = [];
    for (let i = 0; i < eccesso; i++) {
      const idx = Math.floor(Math.random() * carteFinestra.length);
      rimosse.push(carteFinestra.splice(idx, 1)[0]);
    }
    console.log(
      "❌ Finestre rimosse:",
      rimosse.map((c) => c.codice)
    );

    const tutteCasa = gameData.tutteLeCarteLuogo.filter(
      (c) => c.piano === "casa"
    );
    const carteNonScelte = tutteCasa.filter(
      (c) =>
        c.finestra !== true &&
        !casa.some((s) => s.codice === c.codice) &&
        c.tipo !== "ingresso"
    );
    const sostitute = scegliCasuali(carteNonScelte, rimosse.length);
    console.log(
      "🔄 Sostituite con:",
      sostitute.map((c) => c.codice)
    );

    casa.push(...sostitute);
  }

  // 8️⃣ Posizionamento finestre nei laterali
  carteFinestra.forEach((carta) => {
    if (slotLateraliLiberi.length === 0) return;
    const slotIndex = Math.floor(Math.random() * slotLateraliLiberi.length);
    const slot = slotLateraliLiberi.splice(slotIndex, 1)[0];
    carta.posizione = { x: slot.x, y: yMap[slot.piano] };
    slotLiberi[slot.piano] = slotLiberi[slot.piano].filter((v) => v !== slot.x);
    console.log(
      `   🪟 ${carta.codice} posizionata in laterale (${slot.x},${
        yMap[slot.piano]
      }) [${slot.piano}]`
    );
  });

  // 9️⃣ Posizionamento altre carte casa (anche nei laterali rimasti)
  const altreCarte = casa.filter((c) => !c.posizione);
  for (const pianoKey of ["piano2", "piano1", "piano0"]) {
    while (
      slotLiberi[pianoKey] &&
      slotLiberi[pianoKey].length > 0 &&
      altreCarte.length > 0
    ) {
      const carta = altreCarte.shift();
      assegnaPosizione(carta, pianoKey);
    }
  }

  // 🔟 Posizionamento soffitta (alla fine, usando casa già posizionata)
  console.log("🏚️ Posizionamento soffitta...");

  const colonneDisponibili = [xStart, xStart + 1, xStart + 2];
  const colonneValide = colonneDisponibili.filter((x) => {
    const sotto = casa.find(
      (c) => c.posizione && c.posizione.x === x && c.posizione.y === yMap.piano2
    );
    if (!sotto) return false;
    return !["bagno", "ripostiglio"].includes(sotto.tipo);
  });

  console.log(`   📍 Colonne valide per soffitta: ${colonneValide.join(", ")}`);

  if (soffitta.length > 0) {
    if (colonneValide.length > 0) {
      const colonnaStart =
        colonneValide[Math.floor(Math.random() * colonneValide.length)];
      const bloccoColonne = [];

      // Espandi a destra
      for (let i = 0; i < soffitta.length; i++) {
        const col = colonnaStart + i;
        if (colonneDisponibili.includes(col)) bloccoColonne.push(col);
      }
      // Se non basta, espandi a sinistra
      while (bloccoColonne.length < soffitta.length) {
        const colSx = bloccoColonne[0] - 1;
        if (colonneDisponibili.includes(colSx)) {
          bloccoColonne.unshift(colSx);
        } else break;
      }

      soffitta.forEach((c, i) => {
        c.posizione = {
          x: bloccoColonne[i % bloccoColonne.length],
          y: yMap.soffitta,
        };
        console.log(
          `   🏚️ ${c.codice} posizionata in colonna ${c.posizione.x} [soffitta]`
        );
      });
    } else {
      console.warn(
        "⚠️ Nessuna colonna valida per soffitta! Posizionamento casuale..."
      );
      const colonnaStart =
        colonneDisponibili[
          Math.floor(Math.random() * colonneDisponibili.length)
        ];
      const bloccoColonne = colonneDisponibili.filter(
        (c) => c >= colonnaStart && c < colonnaStart + soffitta.length
      );
      soffitta.forEach((c, i) => {
        c.posizione = {
          x: bloccoColonne[i % bloccoColonne.length],
          y: yMap.soffitta,
        };
        console.log(
          `   🏚️ ${c.codice} posizionata in colonna ${c.posizione.x} [soffitta]`
        );
      });
    }
  }

  console.log(
    "🏚️ Soffitta posizionata:",
    soffitta.map((c) => `${c.codice} (${c.posizione.x},${c.posizione.y})`)
  );

  // 11️⃣ Aggiorna tabellone attivo
  gameData.tabelloneAttivo = [
    ...soffitta,
    ...casa.filter((c) => c.posizione && c.posizione.y === 1),
    ...casa.filter((c) => c.posizione && c.posizione.y === 2),
    ingresso,
    ...casa.filter((c) => c.posizione && c.posizione.y === 3),
    giardini[0],
    giardini[1],
    strada,
    ...cantina,
  ];

  _diagnosticaBounds("dopo POSIZIONAMENTO");
  // 12️⃣ Stato iniziale carte
  gameData.tabelloneAttivo.forEach((carta) => {
    carta.esplorata = false;
    carta.accessibile = true;
    carta.scale = "no";
  });

  // 12️⃣bis Piazzamento casuale degli elementi decorativi/interagibili
  piazzaElementiCasuali();

  // 13️⃣ Posizione iniziale PG sulla strada
  const cartaStrada = gameData.tabelloneAttivo.find((c) => c.tipo === "strada");
  gameData.posizioniPersonaggi = {};
  if (cartaStrada) {
    gameData.personaggi.forEach((pg) => {
      gameData.posizioniPersonaggi[pg] = cartaStrada.codice;
    });
  }

  console.log("🏃 [PG] Posizioni iniziali:", gameData.posizioniPersonaggi);

  // 14️⃣ Genera progetto scale
  generaProgettoScale(1, 1, 0.3);

  console.log(
    "✅ [END] Posizionamento completato. Tabellone attivo:",
    gameData.tabelloneAttivo
  );
}

// Piazza 3-5 elementi decorativi/interagibili per ciascun luogo del
// tabellone, pescandoli dal catalogo elementiInteragibili in base al
// match tra carta.tagAmbiente e elemento.tagPiazzamento (basta un tag in
// comune). Ogni elemento può comparire una sola volta in tutto lo
// scenario: una volta piazzato altrove, non è più disponibile.
const MIN_ELEMENTI_PER_LUOGO = 3;
const MAX_ELEMENTI_PER_LUOGO = 5;

// A quale "era" di elementi attinge ciascuno statoCasa: una casa abbandonata
// o in rovina pesca solo elementi "vintage" (o senza datazione dichiarata),
// una casa abitata o curata pesca solo elementi "moderno" (o senza
// datazione). Un elemento senza tagDatazione è "senza tempo" e va sempre bene.
const ERA_PER_STATOCASA = {
  abbandonata: "vintage",
  in_rovina: "vintage",
  abitata: "moderno",
  curata: "moderno",
};

function piazzaElementiCasuali() {
  if (!Array.isArray(elementiInteragibili) || elementiInteragibili.length === 0) {
    console.warn("⚠️ Catalogo elementiInteragibili non ancora caricato: salto il piazzamento.");
    return;
  }

  const eraAttuale = ERA_PER_STATOCASA[gameData.contestoAmbientale?.statoCasa];

  const usatiInQuestoScenario = new Set();

  (gameData.tabelloneAttivo || []).forEach((carta) => {
    const tagAmbiente = carta.tagAmbiente || [];

    const candidati = elementiInteragibili.filter(
      (el) =>
        Array.isArray(el.tagPiazzamento) &&
        el.tagPiazzamento.some((t) => tagAmbiente.includes(t)) &&
        !usatiInQuestoScenario.has(el.nome) &&
        (!el.tagDatazione || el.tagDatazione === eraAttuale)
    );

    const quanti =
      MIN_ELEMENTI_PER_LUOGO +
      Math.floor(
        Math.random() * (MAX_ELEMENTI_PER_LUOGO - MIN_ELEMENTI_PER_LUOGO + 1)
      );

    const scelti = scegliCasuali(candidati, quanti);
    scelti.forEach((el) => usatiInQuestoScenario.add(el.nome));

    carta.elementi = scelti.map((el) => el.nome);
  });

  console.log(
    "🪑 Elementi piazzati:",
    Object.fromEntries(
      (gameData.tabelloneAttivo || []).map((c) => [c.codice, c.elementi])
    )
  );
}

function creaFinestrePerimetro() {
  const cards = gameData.tabelloneAttivo || [];
  if (!cards.length) return;

  // Codici delle carte struttura finestra disponibili
  const codiciFinestre = ["S11", "S12", "S13", "S14", "S15"];

  // y dei piani: in base alla tua yMap piano2=1, piano1=2, piano terra=3
  const pianiY = [1, 2];

  // --- comportamento esistente: finestre su piano 1 e 2 ---
  pianiY.forEach((y) => {
    const livello = cards.filter(
      (c) => c?.posizione?.y === y && c.piano === "casa"
    );
    if (!livello.length) return;

    const minX = Math.min(...livello.map((c) => c.posizione.x));
    const maxX = Math.max(...livello.map((c) => c.posizione.x));

    const sinistre = livello.filter((c) => c.posizione.x === minX);
    const destre = livello.filter((c) => c.posizione.x === maxX);

    // lato esterno sinistro
    sinistre.forEach((c) => {
      const finestraRandom =
        codiciFinestre[Math.floor(Math.random() * codiciFinestre.length)];
      aggiungiSbarramentoSpecifico(c.codice, "sinistra", finestraRandom, {
        zoom: false,
      });
    });

    // lato esterno destro
    destre.forEach((c) => {
      const finestraRandom =
        codiciFinestre[Math.floor(Math.random() * codiciFinestre.length)];
      aggiungiSbarramentoSpecifico(c.codice, "destra", finestraRandom, {
        zoom: false,
      });
    });
  });

  // --- nuovo: piazza una finestra al piano terra (y = 3) sul lato OPPOSTO all'ingresso ---
  const pianoTerraY = 3;
  const livelloPT = cards.filter(
    (c) => c?.posizione?.y === pianoTerraY && c.piano === "casa"
  );

  if (livelloPT.length) {
    const minXpt = Math.min(...livelloPT.map((c) => c.posizione.x));
    const maxXpt = Math.max(...livelloPT.map((c) => c.posizione.x));

    // trova la carta ingresso nello stesso livello (se presente)
    const ingresso = livelloPT.find(
      (c) => (c.tipo || "").toLowerCase() === "ingresso"
    );

    if (ingresso) {
      // se l'ingresso è sul lato sinistro (minX) → piazzo finestra sul lato destro (maxX)
      // se ingresso è sul lato destro (maxX) → piazzo finestra sul lato sinistro (minX)
      const ingressoIsLeft = ingresso.posizione.x === minXpt;
      const ingressoIsRight = ingresso.posizione.x === maxXpt;

      // scegli la carta "opposta" dove attaccare la finestra
      let targetCards = [];
      let direzioneDaUsare = "destra"; // default

      if (ingressoIsLeft) {
        // attacca a destra (maxX)
        targetCards = livelloPT.filter((c) => c.posizione.x === maxXpt);
        direzioneDaUsare = "destra";
      } else if (ingressoIsRight) {
        // attacca a sinistra (minX)
        targetCards = livelloPT.filter((c) => c.posizione.x === minXpt);
        direzioneDaUsare = "sinistra";
      } else {
        // ingresso non su bordo estremo: scegli il lato opposto più distante in X
        const distToMin = Math.abs(ingresso.posizione.x - minXpt);
        const distToMax = Math.abs(ingresso.posizione.x - maxXpt);
        if (distToMin >= distToMax) {
          targetCards = livelloPT.filter((c) => c.posizione.x === maxXpt);
          direzioneDaUsare = "destra";
        } else {
          targetCards = livelloPT.filter((c) => c.posizione.x === minXpt);
          direzioneDaUsare = "sinistra";
        }
      }

      // Se trovi targetCards, piazza su una (o su tutte, come preferisci — qui piazziamo su tutte le card sul lato opposto)
      if (targetCards.length) {
        targetCards.forEach((c) => {
          const finestraRandom =
            codiciFinestre[Math.floor(Math.random() * codiciFinestre.length)];
          aggiungiSbarramentoSpecifico(
            c.codice,
            direzioneDaUsare,
            finestraRandom,
            { zoom: false }
          );
        });
      } else {
        console.warn(
          "creaFinestrePerimetro: non ho trovato carte sul lato opposto per piazzare la finestra al piano terra."
        );
      }
    } else {
      // Nessun ingresso trovato sul piano terra → non piazzare nulla (comportamento sicuro)
      console.log(
        "creaFinestrePerimetro: nessun ingresso trovato al piano terra; salto piazzamento finestra opposta."
      );
    }
  }
}

function piazzaSbarramentiPortaInterni() {
  const tipiTarget = [
    "bagno",
    "studio",
    "camera",
    "camera-bimbi",
    "ripostiglio",
  ];
  const tabellone = gameData.tabelloneAttivo || [];

  const carteTarget = tabellone.filter((c) => {
    const tipoNorm = (c.tipo || "").toLowerCase().trim();
    return tipiTarget.includes(tipoNorm);
  });

  console.log(
    "🧩 Stanze valide per porte:",
    carteTarget.map((c) => `${c.codice} (${c.tipo})`)
  );

  carteTarget.forEach((carta) => {
    const { x, y } = carta.posizione || {};

    ["sinistra", "destra"].forEach((direzione) => {
      const deltaX = direzione === "sinistra" ? -1 : 1;
      const xVicino = x + deltaX;

      const adiacente = tabellone.find(
        (c) => c.posizione?.x === xVicino && c.posizione?.y === y
      );

      if (!adiacente) return;

      const xMid = (x + xVicino) / 2;
      const yMid = y;
      const giàPresente = (gameData.tabelloneStrutture || []).some((s) => {
        return (
          Math.abs(s.posizione?.x - xMid) < 0.01 &&
          Math.abs(s.posizione?.y - yMid) < 0.01
        );
      });

      if (giàPresente) return;

      const codiceSbarramento = scegliCasuali(
        ["S01", "S02", "S03", "S04"],
        1
      )[0];
      console.log(
        `🚪 Piazzo porta ${codiceSbarramento} tra ${carta.codice} (${direzione}) e ${adiacente.codice}`
      );
      aggiungiSbarramentoSpecifico(carta.codice, direzione, codiceSbarramento, {
        visual: false,
      });
    });
  });
}

function generaProgettoScale(min = 1, max = 1, probExtra = 0.3) {
  console.log("🚧 [SCALE] Generazione progetto scale...");
  gameData.progettoScale = {};

  // Lista piani da soffitta → piano terra (escludendo cantina)
  const piani = [
    { key: "soffitta", y: 0 },
    { key: "piano2", y: 1 },
    { key: "piano1", y: 2 },
    { key: "piano0", y: 3 },
  ];

  for (const piano of piani) {
    // Escludiamo cantina
    if (piano.key === "cantina") continue;

    // Trova le carte valide in questo piano
    const pianoCards = gameData.tabelloneAttivo.filter((c) => {
      if (!c.posizione) return false;
      if (c.posizione.y !== piano.y) return false;
      if (["strada", "giardino", "bagno", "ripostiglio"].includes(c.tipo))
        return false;

      // Escludi se la carta sottostante NON è valida
      const sotto = gameData.tabelloneAttivo.find(
        (s) =>
          s.posizione &&
          s.posizione.x === c.posizione.x &&
          s.posizione.y === piano.y + 1
      );
      if (!sotto) return false;
      if (["strada", "giardino", "bagno", "ripostiglio"].includes(sotto.tipo))
        return false;

      return true;
    });

    console.log(
      `🏠 [${piano.key.toUpperCase()}] Carte valide: ${pianoCards
        .map((c) => c.codice)
        .join(", ")}`
    );

    if (!pianoCards.length) continue;

    // Assegna sempre min scale "giu"
    const scelteMin = scegliCasuali(
      pianoCards,
      Math.min(min, pianoCards.length)
    );
    scelteMin.forEach((c) => (gameData.progettoScale[c.codice] = "giu"));

    // Assegna extra scale con probabilità
    if (max > min && Math.random() < probExtra) {
      const rimaste = pianoCards.filter(
        (c) => !gameData.progettoScale[c.codice]
      );
      if (rimaste.length) {
        const scelteExtra = scegliCasuali(rimaste, 1); // una sola extra
        scelteExtra.forEach((c) => (gameData.progettoScale[c.codice] = "giu"));
      }
    }

    console.log(
      `   📊 Progetto scale per ${piano.key}:`,
      pianoCards
        .map((c) => `${c.codice}:${gameData.progettoScale[c.codice] || "no"}`)
        .join(", ")
    );
  }

  console.log("✅ [SCALE] Progetto scale generato:", gameData.progettoScale);
}

function toggleMessaggioConferma() {
  mostraPopupGenerico({
    titolo: "Messaggi di Conferma",
    messaggio: `Sei sicuro di voler modificare l'apparizione dei messaggi di conferma per il <span class="tutorial-link" data-voce="Movimento">movimento</span> e le <span class="tutorial-link" data-voce="Esplorazione">esplorazioni</span>?`,
    pulsanti: [
      {
        testo: "Sì",
        azione: () => {
          chiudiPopup();
          mostraPopupGenerico({
            titolo: "Fatto!",
            messaggio: `Ricordati che puoi Attivare o Disattivare i messaggi di conferma in qualsiasi momento dal Menu Impostazioni in basso a destra della schermata principale.`,
          });
          gameData.messaggioConferma = !gameData.messaggioConferma;
          aggiornaTestoPulsanteConferma();
        },
      },
      {
        testo: "No",
        azione: chiudiPopup,
      },
    ],
  });
}

function aggiornaTestoPulsanteConferma() {
  const btn = document.getElementById("toggleMessaggioConfermaBtn");
  if (!btn) return;
  btn.textContent = gameData.messaggioConferma
    ? "Disattiva Messaggi di Conferma"
    : "Attiva Messaggi di Conferma";
}

// 🔹 Avvia il movimento di un personaggio lungo un percorso, controllando
// e rivelando eventuali sbarramenti passo-passo lungo la strada.
// Se un tratto è bloccato, il personaggio si ferma lì (non alla destinazione originale).
function avviaMovimentoConSbarramenti(nomePersonaggio, percorso) {
  // Un solo movimento a turno: da qui in poi, finché non ricomincia il turno,
  // questo personaggio ha già usato il proprio movimento (anche se poi
  // dovesse fermarsi prima per uno sbarramento).
  gameData.movimentoUsato[nomePersonaggio] = true;

  const { percorsoValido, idsDaRivelare, bloccato } =
    troncaPercorsoAiSbarramenti(percorso);

  // Dopo l'arrivo, l'ordine dei popup deve essere SEMPRE questo, uno alla volta:
  // 1) rivelazione degli sbarramenti trovati lungo la strada
  // 2) eventuale avviso "movimento bloccato"
  // 3) solo alla fine, l'esplorazione della stanza di arrivo
  // Così non si sovrappongono mai due popup.
  const dopoArrivo = (cellaArrivo) => {
    const avviaEsplorazioneSeServe = () => {
      const cartaArrivo = gameData.tabelloneAttivo.find(
        (c) => c.codice === cellaArrivo
      );
      if (cartaArrivo && !cartaArrivo.esplorata) {
        completaEsplorazione(cartaArrivo);
      }
    };

    const eventualeAvvisoBlocco = () => {
      if (!bloccato) {
        avviaEsplorazioneSeServe();
        return;
      }
      mostraPopupGenerico({
        titolo: "Movimento bloccato",
        messaggio:
          "Qualcosa ti sbarra il passaggio: non puoi proseguire oltre.",
        pulsanti: [
          {
            testo: "Chiudi",
            azione: () => {
              chiudiPopup();
              avviaEsplorazioneSeServe();
            },
          },
        ],
      });
    };

    if (idsDaRivelare.length > 0) {
      rivelaStruttureBatch(idsDaRivelare, {
        zoom: true,
        onComplete: eventualeAvvisoBlocco,
      });
    } else {
      eventualeAvvisoBlocco();
    }
  };

  if (!Array.isArray(percorsoValido) || percorsoValido.length < 2) {
    // Bloccato subito, sul primo passo: il personaggio non si muove affatto
    dopoArrivo(gameData.posizioniPersonaggi[nomePersonaggio]);
    return;
  }

  muoviPersonaggioConAnimazione(nomePersonaggio, percorsoValido, {
    onComplete: dopoArrivo,
    autoEsplora: false,
  });
}

function gestisciClickCartaLuogo(codiceDestinazione) {
  const nomePG = gameData.pgAttivo;

  if (!nomePG) {
    console.warn("⚠️ Nessun personaggio attivo impostato.");
    return;
  }

  const start = gameData.posizioniPersonaggi[nomePG];
  const cartaDestinazione = gameData.tabelloneAttivo.find(
    (c) => c.codice === codiceDestinazione
  );

  // 🔹 Caso: clic sulla propria cella
  if (start === codiceDestinazione) {
    if (cartaDestinazione && !cartaDestinazione.esplorata) {
      // Mostra solo il codice (non il nome) per mantenere il mistero
      if (gameData.messaggioConferma) {
        mostraPopupGenerico({
          titolo: "Esplorazione",
          messaggio: `Vuoi <span class="tutorial-link" data-voce="Esplorazione">esplorare</span>
        il luogo <b>${cartaDestinazione.codice}</b>?`,
          pulsanti: [
            {
              testo: "Sì",
              azione: () => {
                chiudiPopup();
                completaEsplorazione(cartaDestinazione);
              },
            },
            {
              testo: "No",
              azione: chiudiPopup,
            },
            {
              testo: "Non chiederlo più",
              azione: () => {
                chiudiPopup();
                toggleMessaggioConferma();
              },
            },
          ],
        });
      } else {
        completaEsplorazione(cartaDestinazione);
      }
    } else {
      mostraInterazioneStanza(codiceDestinazione);
    }
    return;
  }

  // 🔹 Caso: destinazione diversa → controllo accessibilità
  // Un solo movimento a turno: se questo personaggio lo ha già fatto, si ferma qui
  if (gameData.movimentoUsato[nomePG]) {
    mostraPopupGenerico({
      titolo: "Movimento non consentito",
      messaggio: "Hai già effettuato il tuo movimento in questo turno.",
    });
    return;
  }

  // Calcoliamo la mappa dei movimenti UNA SOLA VOLTA e la riusiamo per tutti i controlli di questo click
  const mappa = costruisciMappaNavigabile();
  const raggiungibili = calcolaDestinazioniPossibili(nomePG, mappa);

  if (!raggiungibili.includes(codiceDestinazione)) {
    const motivo = verificaMotivoInaccessibile(nomePG, codiceDestinazione, mappa);
    mostraPopupGenerico({
      titolo: "Movimento non consentito",
      messaggio: motivo || "Questa casella è inaccessibile.",
    });
    return;
  }

  // 🔹 Chiedi conferma del movimento
  const destinazioneLabel =
    cartaDestinazione && cartaDestinazione.esplorata
      ? cartaDestinazione.nome || cartaDestinazione.codice // Nome se esplorata
      : cartaDestinazione.codice; // Codice se non esplorata

  if (gameData.messaggioConferma) {
    mostraPopupGenerico({
      titolo: "Conferma Movimento",
      messaggio: `Vuoi <span class="tutorial-link" data-voce="Movimento">muovere</span>
    <b>${nomePG}</b> in <b>${destinazioneLabel}</b>?`,
      pulsanti: [
        {
          testo: "Sì",
          azione: () => {
            chiudiPopup();

            const percorso = calcolaPercorso(start, codiceDestinazione, mappa);

            avviaMovimentoConSbarramenti(nomePG, percorso);
          },
        },
        {
          testo: "No",
          azione: chiudiPopup,
        },
        {
          testo: "Non chiederlo più",
          azione: () => {
            chiudiPopup();
            toggleMessaggioConferma();
          },
        },
      ],
    });
  } else {
    // Nessuna conferma → esegui subito
    const percorso = calcolaPercorso(start, codiceDestinazione, mappa);

    avviaMovimentoConSbarramenti(nomePG, percorso);
  }
}

function mostraInterazioneStanza(codiceCarta) {
  const carta = gameData.tabelloneAttivo.find((c) => c.codice === codiceCarta);
  if (!carta || !carta.esplorata) return;

  const elementi = Array.isArray(carta.elementi) ? carta.elementi : [];

  // --- Costruzione UI (niente personaggi qui: ora si cliccano direttamente sulla mappa) ---
  const interazione = document.createElement("div");
  interazione.classList.add("popup-interazione-stanza");
  interazione.id = "popupInterazioneStanza";

  let html = `
    <div class="popup-content">
      <h2>${carta.nome || carta.codice}</h2>
  `;

  // Elementi interagibili (solo quelli della carta luogo)
  if (elementi.length > 0) {
    html += `
      <h3>Elementi interazione</h3>
      <div class="lista-elementi">
        ${elementi
          .map(
            (el) =>
              `<button class="elemento-btn" onclick="interagisciConElemento('${String(
                el
              ).replace(/'/g, "\\'")}')">${el}</button>`
          )
          .join("")}
      </div>
    `;
  } else {
    html += `
      <p style="opacity:.8;margin:8px 0 12px">
        In questo luogo non ci sono elementi con cui interagire.
      </p>
    `;
  }

  // Pulsante chiusura
  html += `
      <div style="margin-top:12px">
        <button onclick="chiudiPopupSelettivo('.popup-interazione-stanza')">Chiudi</button>
      </div>
    </div>
  `;

  interazione.innerHTML = html;
  document.body.appendChild(interazione);
}

function interagisciConStruttura(
  nomeStruttura,
  codiceIstanza = "",
  coordStruttura = null
) {
  // 🔒 PRE-CHECK: se abbiamo coordinate o un'istanza, verifichiamo la distanza dal PG attivo
  (function () {
    try {
      // Se non abbiamo né coord né istanza, non blocchiamo (compatibilità con overlay "semplici")
      if (!coordStruttura && !codiceIstanza) return;

      // Recupera le coordinate della struttura, preferendo quelle passate dal render:
      let sx, sy;
      if (
        coordStruttura &&
        typeof coordStruttura.x === "number" &&
        typeof coordStruttura.y === "number"
      ) {
        sx = coordStruttura.x;
        sy = coordStruttura.y;
      } else {
        // fallback: prova a risalire dall'istanza
        const s = (gameData.tabelloneStrutture || []).find(
          (t) => t.codice === codiceIstanza
        );
        if (!s || !s.posizione) return; // niente dati → non bloccare
        sx = s.posizione.x;
        sy = s.posizione.y;
      }

      // Trova la posizione del PG attivo (in coordinate di cella intera)
      const pg = gameData.pgAttivo;
      const cellaPG = gameData.posizioniPersonaggi?.[pg];
      if (!cellaPG) return; // prudenza: se non c'è posizione, non blocchiamo

      const cartaPG = (gameData.tabelloneAttivo || []).find(
        (c) => c.codice === cellaPG
      );
      if (!cartaPG?.posizione) return;

      const px = cartaPG.posizione.x;
      const py = cartaPG.posizione.y;

      // Adiacenza a coordinate "mezzo-slot":
      // - barriera verticale tra colonne: |px - sx| = 0.5 e py === sy
      // - barriera orizzontale tra righe: |py - sy| = 0.5 e px === sx
      const dx = Math.abs(px - sx);
      const dy = Math.abs(py - sy);
      const adiacente = (dx === 0.5 && dy === 0) || (dx === 0 && dy === 0.5);

      if (!adiacente) {
        mostraPopupGenerico({
          titolo: "Troppo lontano",
          messaggio:
            "Sei troppo lontano per poter interagire con questo elemento.",
          pulsanti: [{ testo: "Chiudi", azione: chiudiPopup }],
        });
        // Blocco l'interazione aprendo il popup e uscendo subito dalla funzione
        throw new Error("__STOP_INTERAZIONE__");
      }
    } catch (e) {
      if (String(e.message) === "__STOP_INTERAZIONE__") {
        // Interruzione controllata dell'interazione
        throw e;
      }
      // altri errori non devono bloccare l'interazione
      console.warn("[interagisciConStruttura] pre-check distanza:", e);
    }
  })();

  // Da qui in poi il codice originale (popup con definizione/azioni)
  if (!gameData.catalogoStrutture || !gameData.catalogoStrutture.length) {
    return mostraPopupGenerico({
      titolo: "Struttura",
      messaggio: "Catalogo strutture non disponibile.",
    });
  }

  const def = gameData.catalogoStrutture.find((s) => s.nome === nomeStruttura);
  if (!def) {
    return mostraPopupGenerico({
      titolo: "Struttura",
      messaggio: `Nessuna definizione trovata per: ${nomeStruttura}.`,
    });
  }

  let html = `
    <div class="popup-content">
      <h2>${def.nome}</h2>
      <p style="opacity:.85">${def.descrizione || ""}</p>
      ${def.interazioni && def.interazioni.length ? "<h3>Interazioni</h3>" : ""}
      <div class="lista-elementi">
        ${(def.interazioni || [])
          .map(
            (i) => `
          <button onclick="chiudiPopup(); gestisciInterazioneStruttura('${def.nome}','${codiceIstanza}','${i.id}')">
            ${i.etichetta}
          </button>
        `
          )
          .join("")}
      </div>
      <button onclick="chiudiPopup()">Chiudi</button>
    </div>
  `;

  const wrapper = document.createElement("div");
  wrapper.className = "popup";
  wrapper.innerHTML = html;
  document.body.appendChild(wrapper);
}

// Dispatcher delle interazioni
// 🔹 Quando uno sbarramento viene aperto/abbattuto, il luogo dall'altra
// parte viene rivelato (esplorato) anche se il personaggio non vi si è
// ancora spostato: resta comunque inaccessibile/non interagibile finché
// non ci si muove davvero. Riusa completaEsplorazione già esistente.
function rivelaLuogoAdiacenteSbloccato(luoghi) {
  if (!Array.isArray(luoghi) || luoghi.length !== 2) return;

  const pg = gameData.pgAttivo;
  const cellaAttuale = pg ? gameData.posizioniPersonaggi[pg] : null;
  const codiceAltro = luoghi.find((l) => l !== cellaAttuale) ?? luoghi[1];
  if (!codiceAltro) return;

  const cartaAltra = gameData.tabelloneAttivo.find(
    (c) => c.codice === codiceAltro
  );
  if (cartaAltra && !cartaAltra.esplorata) {
    completaEsplorazione(cartaAltra);
  }
}

function gestisciInterazioneStruttura(
  nomeStruttura,
  codiceIstanza,
  idInterazione
) {
  const def = gameData.catalogoStrutture?.find((s) => s.nome === nomeStruttura);
  const inter = def?.interazioni?.find((i) => i.id === idInterazione);
  if (!def || !inter) return;

  if (inter.tipo === "descrittivo") {
    // Testo da mostrare
    const testoPopup = inter.testo || "Non c'è nulla di particolare.";

    // Prepara azione post-testo (se presente)
    const post = (inter.azionedopotesto || "").toLowerCase().trim(); // "apertura" | "chiusura" | ""

    // Deduzione inline del tipo sbarramento dal nome passato alla funzione (niente helper globali)
    const isPorta = /porta/i.test(nomeStruttura);
    const isCancello = /cancello/i.test(nomeStruttura);
    const isFinestra = /finestr/i.test(nomeStruttura); // cattura "finestra", "finestre", "finestr..." ecc.

    // Mappa "apertura/chiusura" -> nuovo nome struttura (senza helper globali)
    let nuovoNome = null;
    if (post === "apertura") {
      if (isPorta) nuovoNome = "Porta Aperta";
      else if (isCancello) nuovoNome = "Cancello Aperto";
      else if (isFinestra) nuovoNome = "Finestra Aperta";
    } else if (post === "chiusura") {
      if (isPorta) nuovoNome = "Porta Chiusa";
      else if (isCancello) nuovoNome = "Cancello Chiuso";
      else if (isFinestra) nuovoNome = "Finestra Chiusa";
    } else if (post === "rottura") {
      if (isFinestra) nuovoNome = "Finestra Rotta";
    }

    // Funzione locale: a popup chiuso, rimuove l'istanza e ripiazza la variante corretta
    const applicaAzionePostTesto = () => {
      if (!nuovoNome) return; // nessuna azione richiesta o tipo non gestito

      // Recupero dell'istanza cliccata dai dati esistenti
      const strutt = (gameData.tabelloneStrutture || []).find(
        (s) => s.codice === codiceIstanza
      );
      if (!strutt) {
        console.warn(
          "[gestisciInterazioneStruttura] Istanza struttura non trovata:",
          codiceIstanza
        );
        return;
      }

      // Salvo i riferimenti necessari PRIMA di rimuovere
      const base = Array.isArray(strutt.luoghi) ? strutt.luoghi[0] : null; // carta A
      const dir = strutt.direzione || null;
      const luoghiPrecedenti = strutt.luoghi;

      // Rimuovo la struttura attuale usando la tua funzione esistente
      rimuoviStruttura(strutt.codice, strutt.codiceCarta, strutt.luoghi);

      // Ripiazzo nella stessa posizione logica (stessa carta base + stessa direzione)
      if (base && dir) {
        aggiungiSbarramentoSpecifico(base, dir, nuovoNome); // riusa la tua funzione

        // 🔹 Se si tratta di un'apertura, il varco è ora aperto: il luogo
        // adiacente viene rivelato (esplorato) anche se il personaggio non
        // vi si è ancora spostato.
        if (post === "apertura") {
          rivelaLuogoAdiacenteSbloccato(luoghiPrecedenti);
        }
      } else {
        console.warn(
          "[gestisciInterazioneStruttura] Mancano base o direzione per ripiazzare lo sbarramento.",
          { base, dir, strutt }
        );
        // opzionale: potresti qui fare un fallback via coordinate, ma per ora evitiamo.
      }
    };

    // Mostra il popup "Apri/Chiudi/Rompi..."; SOLO alla sua chiusura reale
    // (click su "Chiudi") applichiamo il cambiamento della struttura e
    // l'eventuale rivelazione del luogo adiacente — mai prima, altrimenti
    // il popup di esplorazione comparirebbe/sparirebbe prima che il
    // giocatore possa leggere questo.
    mostraPopupGenerico({
      titolo: nomeStruttura,
      messaggio: testoPopup,
      pulsanti: [
        {
          testo: "Chiudi",
          azione: () => {
            // chiude il popup visibile
            chiudiPopup();

            // reset zoom (comportamento immutato)
            try {
              resetZoom();
            } catch (e) {
              /* noop */
            }

            if (post === "apertura" || post === "chiusura" || post === "rottura") {
              try {
                applicaAzionePostTesto();

                if (post === "chiusura" && typeof generaRumore === "function") {
                  const strutturaCorrente = (
                    gameData.tabelloneStrutture || []
                  ).find((t) => t.codice === codiceIstanza);
                  generaRumore(
                    gameData.posizioniPersonaggi?.[gameData.pgAttivo],
                    1,
                    {
                      descrizione: "Porta chiusa",
                      luoghiPossibili: (strutturaCorrente?.luoghi || []).filter(
                        Boolean
                      ),
                    }
                  );
                }

                // aggiungiSbarramentoSpecifico() fa un suo zoom-in sulla
                // struttura appena cambiata (300ms di ritardo + 1200ms di
                // transizione): il resetZoom() qui sopra arriva PRIMA e
                // viene quindi sovrascritto. Rimettiamo a posto la vista
                // dopo che quello zoom-in si è concluso.
                setTimeout(() => {
                  try {
                    resetZoom();
                  } catch (e) {
                    /* noop */
                  }
                }, 1700);
              } catch (e) {
                console.warn(e);
              }
            }

            // Se l'azione è "attraversa" → gestiamo la traversata QUI
            if (post === "attraversa") {
              try {
                const pg = gameData.pgAttivo;
                if (!pg) {
                  console.warn("[attraversa] Nessun PG attivo.");
                  return;
                }
                const startCodice = gameData.posizioniPersonaggi[pg];
                if (!startCodice) {
                  console.warn(
                    "[attraversa] PG attivo senza posizione logica:",
                    pg
                  );
                  return;
                }

                // Recupera l'istanza struttura cliccata
                const struct = (gameData.tabelloneStrutture || []).find(
                  (s) => s.codice === codiceIstanza
                );
                if (!struct) {
                  console.warn(
                    "[attraversa] Istanza struttura non trovata:",
                    codiceIstanza
                  );
                  return;
                }

                const luoghi = Array.isArray(struct.luoghi)
                  ? struct.luoghi
                  : [];
                // ci aspettiamo coppia [A, B]
                if (luoghi.length !== 2) {
                  console.warn(
                    "[attraversa] Struttura senza coppia di luoghi prevista:",
                    struct
                  );
                  return;
                }

                // determina target: l'altra carta nella coppia (gestendo anche i casi [A, null])
                let targetCodice = null;
                if (luoghi.length === 2) {
                  const [L0, L1] = luoghi;

                  // caso classico: entrambe le carte presenti
                  if (L0 === startCodice && L1) targetCodice = L1;
                  else if (L1 === startCodice && L0) targetCodice = L0;
                  else if (L0 === startCodice && !L1) {
                    // Caso bordo ESTERNO: cerchiamo la carta COLLASSATA sul lato OPPOSTO (colonna adiacente)
                    const cartaBase = gameData.tabelloneAttivo.find(
                      (c) => c.codice === L0
                    );
                    if (cartaBase?.posizione) {
                      const maxDrop = 2; // cerca fino a 2 piani sotto
                      // decidi la colonna opposta in base alla direzione dello sbarramento (destra/sinistra)
                      const dir = struct.direzione || "";
                      const deltaX =
                        dir === "destra" ? 1 : dir === "sinistra" ? -1 : 0;
                      // targetX atteso (colonna adiacente)
                      const targetX = cartaBase.posizione.x + deltaX;

                      // tolleranza per .5 o discrepanze: accetta valori molto vicini
                      const tol = 0.001;

                      // 1) cerca candidature *sulla colonna opposta* (x ≈ targetX), piani più in basso (y > base.y)
                      let candidates = (gameData.tabelloneAttivo || [])
                        .filter(
                          (c) =>
                            c.posizione &&
                            Math.abs(c.posizione.x - targetX) <= tol &&
                            c.posizione.y > cartaBase.posizione.y &&
                            c.posizione.y <= cartaBase.posizione.y + maxDrop
                        )
                        .sort((a, b) => a.posizione.y - b.posizione.y); // più vicino (min y) primo

                      // 2) fallback: se non trovi nulla esatto per x, prova con tolleranza spaziale maggiorata (es. .5)
                      if (!candidates.length) {
                        const tol2 = 0.6; // tolleranza più permissiva (accetta 0.5 ecc.)
                        candidates = (gameData.tabelloneAttivo || [])
                          .filter(
                            (c) =>
                              c.posizione &&
                              Math.abs(c.posizione.x - targetX) <= tol2 &&
                              c.posizione.y > cartaBase.posizione.y &&
                              c.posizione.y <= cartaBase.posizione.y + maxDrop
                          )
                          .sort((a, b) => a.posizione.y - b.posizione.y);
                      }

                      // 3) ultima risorsa: se ancora nulla, prova a trovare *qualunque* carta sotto nella stessa X (fallback precedente)
                      if (!candidates.length) {
                        const candidatesSameX = (gameData.tabelloneAttivo || [])
                          .filter(
                            (c) =>
                              c.posizione &&
                              Math.abs(c.posizione.x - cartaBase.posizione.x) <=
                                tol2 &&
                              c.posizione.y > cartaBase.posizione.y &&
                              c.posizione.y <= cartaBase.posizione.y + maxDrop
                          )
                          .sort((a, b) => a.posizione.y - b.posizione.y);
                        if (candidatesSameX.length) {
                          candidates = candidatesSameX;
                          console.warn(
                            "[attraversa] Fallback: trovato target discendente sulla stessa colonna della base (ultimissima risorsa).",
                            {
                              base: cartaBase.codice,
                              targetX,
                              found: candidates[0]?.codice,
                            }
                          );
                        }
                      }

                      if (candidates.length) {
                        targetCodice = candidates[0].codice;
                        console.log(
                          `[attraversa] Trovato target discendente per bordo esterno: ${targetCodice} (cartaBase.x=${cartaBase.posizione.x}, targetX=${targetX})`
                        );
                      } else {
                        console.warn(
                          "[attraversa] Nessuna carta trovata sotto la base per attraversamento (bordo esterno).",
                          {
                            base: L0,
                            x: cartaBase.posizione.x,
                            y: cartaBase.posizione.y,
                            targetX,
                          }
                        );
                      }
                    } else {
                      console.warn(
                        "[attraversa] Carta base non trovata per bordo esterno:",
                        L0
                      );
                    }
                  } else if (L1 === startCodice && !L0) {
                    // simmetrico: il PG è dall'altro lato e l'altro lato è esterno → cerca sotto a partire da L1
                    const cartaBase = gameData.tabelloneAttivo.find(
                      (c) => c.codice === L1
                    );
                    if (cartaBase?.posizione) {
                      const maxDrop = 2;
                      const dir = struct.direzione || "";
                      const deltaX =
                        dir === "destra" ? 1 : dir === "sinistra" ? -1 : 0;
                      const targetX = cartaBase.posizione.x + deltaX;
                      const tol = 0.001;
                      let candidates = (gameData.tabelloneAttivo || [])
                        .filter(
                          (c) =>
                            c.posizione &&
                            Math.abs(c.posizione.x - targetX) <= tol &&
                            c.posizione.y > cartaBase.posizione.y &&
                            c.posizione.y <= cartaBase.posizione.y + maxDrop
                        )
                        .sort((a, b) => a.posizione.y - b.posizione.y);

                      if (!candidates.length) {
                        const tol2 = 0.6;
                        candidates = (gameData.tabelloneAttivo || [])
                          .filter(
                            (c) =>
                              c.posizione &&
                              Math.abs(c.posizione.x - targetX) <= tol2 &&
                              c.posizione.y > cartaBase.posizione.y &&
                              c.posizione.y <= cartaBase.posizione.y + maxDrop
                          )
                          .sort((a, b) => a.posizione.y - b.posizione.y);
                      }

                      if (!candidates.length) {
                        const tol2 = 0.6;
                        const candidatesSameX = (gameData.tabelloneAttivo || [])
                          .filter(
                            (c) =>
                              c.posizione &&
                              Math.abs(c.posizione.x - cartaBase.posizione.x) <=
                                tol2 &&
                              c.posizione.y > cartaBase.posizione.y &&
                              c.posizione.y <= cartaBase.posizione.y + maxDrop
                          )
                          .sort((a, b) => a.posizione.y - b.posizione.y);
                        if (candidatesSameX.length) {
                          candidates = candidatesSameX;
                          console.warn(
                            "[attraversa] Fallback: trovato target discendente sulla stessa colonna della base (simmetrico).",
                            {
                              base: cartaBase.codice,
                              found: candidates[0]?.codice,
                            }
                          );
                        }
                      }

                      if (candidates.length) {
                        targetCodice = candidates[0].codice;
                        console.log(
                          `[attraversa] Trovato target discendente per bordo esterno (simmetrico): ${targetCodice}`
                        );
                      } else {
                        console.warn(
                          "[attraversa] Nessuna carta trovata sotto la base per attraversamento (bordo esterno, simmetrico).",
                          { base: L1 }
                        );
                      }
                    } else {
                      console.warn(
                        "[attraversa] Carta base non trovata per bordo esterno (simmetrico):",
                        L1
                      );
                    }
                  } else {
                    console.warn(
                      "[attraversa] Il PG non condivide la struttura:",
                      { pg, startCodice, luoghi }
                    );
                    return;
                  }
                } else {
                  console.warn(
                    "[attraversa] Struttura senza coppia di luoghi prevista:",
                    struct
                  );
                  return;
                }

                if (!targetCodice) {
                  console.warn(
                    "[attraversa] Target della traversata non risolto - azione ignorata.",
                    struct
                  );
                  return;
                }

                const cartaStart = gameData.tabelloneAttivo.find(
                  (c) => c.codice === startCodice
                );
                const cartaTarget = gameData.tabelloneAttivo.find(
                  (c) => c.codice === targetCodice
                );
                if (!cartaStart || !cartaTarget) {
                  console.warn(
                    "[attraversa] Impossibile risolvere carta start/target:",
                    startCodice,
                    targetCodice
                  );
                  return;
                }

                // delta piani: target più basso => salto/discesa
                const deltaY =
                  (cartaTarget.posizione?.y || 0) -
                  (cartaStart.posizione?.y || 0);
                const scende = deltaY > 0;

                // costruisci percorso diretto (start -> target)
                const percorso = [startCodice, targetCodice];

                // scelta effetto e durata
                let effetto = "lineare";
                let durataStepMs = 400;
                if (scende) {
                  effetto = "scavalcamento";
                  durataStepMs = Math.min(1600, 500 + 300 * deltaY); // 1 piano ~800ms, 2 piani ~1100ms
                } else {
                  // se è sullo stesso piano o sale: movimento rapido lineare
                  effetto = "lineare";
                  durataStepMs = 450;
                }

                // lancia l'animazione (riusa la funzione esistente)
                muoviPersonaggioConAnimazione(pg, percorso, {
                  effetto,
                  durataStepMs,
                });
              } catch (err) {
                console.warn(
                  "[attraversa] Errore durante l'attraversamento:",
                  err
                );
              }
            }
          },
        },
      ],
    });

    return;
  }

  if (inter.tipo === "prova") {
    // Apri la UI di prova abilità, con i metadati dal JSON
    apriProvaAbilita({
      nomeStruttura: def.nome,
      codiceIstanza, // resta se lo stai usando altrove
      codiceCartaStruttura: def.codice, // ⬅️ AGGIUNTO
      idInterazione,
      abilita: inter.abilita,
      requisito: inter.requisito,
      giocatori: inter.giocatori,
      modo: inter.modo,
    });
    return;
  }

  // fallback generico
  mostraPopupGenerico({
    titolo: "Interazione Struttura",
    messaggio: `Hai interagito con <strong>${def.nome}</strong>.`,
  });
}

// Un evento generico è compatibile se il SUO elenco di tag include tutti i
// tagRichiesti dell'elemento (l'evento può avere altri tag suoi, es. "ragno").
// ECCEZIONE: se uno di quei tag "extra" dell'evento è un tag OPZIONALE che
// qualche elemento del catalogo può richiedere (es. "chiuso"), va considerato
// "di gating" — l'evento diventa raggiungibile SOLO quando quel tag è
// realmente presente nel tentativo in corso, altrimenti resterebbe sempre
// compatibile anche quando la condizione non si è mai verificata (bug: la
// semplice inclusione come sottoinsieme non basta a escluderlo).
function trovaEventiGenericiCompatibili(tagRichiesti) {
  if (!Array.isArray(tagRichiesti) || tagRichiesti.length === 0) return [];

  const tagGating = new Set(
    (elementiInteragibili || []).flatMap((e) => e.tagOpzionali || [])
  );

  return eventiGenerici.filter((ev) => {
    const tagsEvento = ev.tag || [];
    const baseOk = tagRichiesti.every((t) => tagsEvento.includes(t));
    if (!baseOk) return false;

    const tagGatingEvento = tagsEvento.filter((t) => tagGating.has(t));
    return tagGatingEvento.every((t) => tagRichiesti.includes(t));
  });
}

// Probabilità che il pulsante "Cerca" faccia scattare l'evento generico
// compatibile disponibile, invece di "Non trovi nulla di utile." — le
// ricerche sono attività di contorno, i progressi verso l'obiettivo dello
// scenario restano affidati alle interazioni predefinite, non a questa.
const PROBABILITA_EVENTO_CERCA = 0.35;

function interagisciConElemento(nomeElemento) {
  const codiceCarta = gameData.posizioniPersonaggi[gameData.pgAttivo];
  const scenarioCorrente = gameData.scenarioCorrente || "tutti";

  console.log(
    `\n🎯 Interazione con elemento: ${nomeElemento} nella carta: ${codiceCarta} (Scenario: ${scenarioCorrente})`
  );

  if (!codiceCarta) {
    console.warn("⚠️ Nessuna carta associata al PG attivo.");
    return;
  }

  if (!gameData.interazioniUsate[codiceCarta]) {
    gameData.interazioniUsate[codiceCarta] = {};
  }

  const elemento = elementiInteragibili.find((e) => e.nome === nomeElemento);
  if (!elemento) {
    console.warn(`⚠️ Nessun dato trovato per elemento: ${nomeElemento}`);
    mostraPopupGenerico({
      titolo: nomeElemento,
      messaggio: "Nessuna interazione disponibile per questo oggetto.",
    });
    return;
  }

  // 1️⃣ Frase descrittiva: se questa carta+elemento ne ha già pescata una,
  // resta congelata (stessa frase ogni volta che riapri l'elemento in
  // questa partita); altrimenti ne peschiamo una nuova e la congeliamo ora.
  let testoDescrittivo;
  const idGiaScelto = gameData.interazioniUsate[codiceCarta][nomeElemento];

  if (idGiaScelto) {
    const rispostaEsistente = (elemento.risposte || []).find(
      (r) => r.id === idGiaScelto
    );
    testoDescrittivo = rispostaEsistente
      ? rispostaEsistente.testo
      : "Non c'è nulla di particolare da notare.";
  } else {
    // Escludo risposte già usate altrove per questo stesso nome elemento
    const risposteGiaUsate = new Set();
    for (const carta in gameData.interazioniUsate) {
      const v = gameData.interazioniUsate[carta][nomeElemento];
      if (v !== undefined) risposteGiaUsate.add(v);
    }

    const statoCasaAttuale = gameData.contestoAmbientale?.statoCasa;
    const meteoAttuale = gameData.contestoAmbientale?.meteo;
    const momentoAttuale = gameData.contestoAmbientale?.momento;

    function risposteCompatibileContesto(r) {
      if (Array.isArray(r.statoCasa) && !r.statoCasa.includes(statoCasaAttuale))
        return false;
      if (Array.isArray(r.meteo) && !r.meteo.includes(meteoAttuale)) return false;
      if (Array.isArray(r.momento) && !r.momento.includes(momentoAttuale))
        return false;
      return true;
    }

    let risposteDisponibili = (elemento.risposte || [])
      .filter((r) => !risposteGiaUsate.has(r.id))
      .filter(risposteCompatibileContesto);

    let risposteScenario = risposteDisponibili.filter(
      (r) => r.scenario === scenarioCorrente
    );
    if (risposteScenario.length === 0) {
      risposteScenario = risposteDisponibili.filter(
        (r) => r.scenario === "tutti"
      );
    }

    // Le frasi specifiche (già filtrate per compatibilità di contesto) e
    // quelle neutre competono insieme nella stessa estrazione casuale: così,
    // a parità di statoCasa/meteo/momento fra una partita e l'altra, c'è
    // comunque la possibilità di vedere una frase diversa.

    if (risposteScenario.length === 0) {
      testoDescrittivo = "Non c'è nulla di particolare da notare.";
    } else {
      const scelta =
        risposteScenario[Math.floor(Math.random() * risposteScenario.length)];
      gameData.interazioniUsate[codiceCarta][nomeElemento] = scelta.id;
      testoDescrittivo = scelta.testo;
    }
  }

  // 2️⃣ Pulsanti: "Usa Oggetto" sempre presente, "Cerca" solo se l'elemento
  // ha tagRichiesti (cioè si presta a essere frugato)
  const pulsanti = [
    {
      testo: "Usa Oggetto",
      azione: () => {
        mostraPopupGenerico({
          titolo: "Usa Oggetto",
          messaggio: "Funzione non ancora implementata.",
          pulsanti: [
            {
              testo: "Ok",
              azione: (btn) => chiudiPopupSelettivo(btn.closest(".popup")),
            },
          ],
        });
      },
    },
  ];

  if (Array.isArray(elemento.tagRichiesti) && elemento.tagRichiesti.length > 0) {
    pulsanti.push({
      testo: "Cerca",
      azione: () => provaCercaEvento(elemento, codiceCarta, nomeElemento),
    });
  }

  pulsanti.push({
    testo: "Chiudi",
    azione: (btn) => chiudiPopupSelettivo(btn.closest(".popup")),
  });

  mostraPopupGenerico({
    titolo: nomeElemento,
    messaggio: testoDescrittivo,
    pulsanti,
  });
}

// Pulsante "Cerca": se l'elemento ha già attivato un evento generico in
// questa specifica interazione, o non ce n'è nessuno compatibile e ancora
// disponibile in questo scenario, esce sempre "Non trovi nulla di utile.".
// Altrimenti c'è PROBABILITA_EVENTO_CERCA di farlo scattare per davvero.
function provaCercaEvento(elemento, codiceCarta, nomeElemento) {
  gameData.ricercaGenericaAttivata[codiceCarta] =
    gameData.ricercaGenericaAttivata[codiceCarta] || {};

  const giaAttivatoQui =
    gameData.ricercaGenericaAttivata[codiceCarta][nomeElemento];

  // Tag effettivi di questo tentativo: quelli fissi dell'elemento, più
  // ciascun tag opzionale (es. "chiuso") incluso o meno a caso, in modo
  // indipendente — così lo stesso elemento può presentarsi diversamente
  // da una ricerca all'altra.
  const tagOpzionaliInclusi = (elemento.tagOpzionali || []).filter(
    () => Math.random() < 0.5
  );
  const tagEffettivi = [...elemento.tagRichiesti, ...tagOpzionaliInclusi];
  console.log("🔑 Tag effettivi per questa ricerca:", tagEffettivi);

  const eventiCompatibili = giaAttivatoQui
    ? []
    : trovaEventiGenericiCompatibili(tagEffettivi).filter(
        (ev) => !gameData.eventiGenericiUsati[ev.id]
      );

  // Gli eventi "ripetibili" (es. "Serratura") sono blocchi affidabili, non
  // sorprese rare: se ce n'è uno compatibile hanno sempre la priorità e
  // scattano SEMPRE (niente tiro di probabilità), così segnalano in modo
  // coerente ogni volta che l'elemento resta "chiuso".
  const eventiRipetibiliCompatibili = eventiCompatibili.filter(
    (ev) => ev.ripetibile
  );
  if (eventiRipetibiliCompatibili.length > 0) {
    const evento =
      eventiRipetibiliCompatibili[
        Math.floor(Math.random() * eventiRipetibiliCompatibili.length)
      ];
    avviaEventoGenerico(evento, nomeElemento);
    return;
  }

  const scattaEvento =
    eventiCompatibili.length > 0 && Math.random() < PROBABILITA_EVENTO_CERCA;

  if (!scattaEvento) {
    mostraPopupGenerico({
      titolo: "Cerca",
      messaggio: "Non trovi nulla di utile.",
      pulsanti: [
        {
          testo: "Ok",
          azione: (btn) => chiudiPopupSelettivo(btn.closest(".popup")),
        },
      ],
    });
    return;
  }

  const evento =
    eventiCompatibili[Math.floor(Math.random() * eventiCompatibili.length)];

  // Un evento normale (non ripetibile) si congela per questa interazione e
  // si esclude per tutto il resto dello scenario, come prima.
  gameData.ricercaGenericaAttivata[codiceCarta][nomeElemento] = true;
  gameData.eventiGenericiUsati[evento.id] = true;

  avviaEventoGenerico(evento, nomeElemento);
}

// Mostra il testo d'apertura di un evento generico e, se previsto,
// fa seguire una prova di abilità con rami di successo/fallimento
// dichiarativi (stesso linguaggio di effetti degli eventi di scenario).
function avviaEventoGenerico(evento, nomeElemento) {
  mostraPopupGenerico({
    titolo: nomeElemento,
    messaggio: evento.testo,
    pulsanti: [
      {
        testo: "Continua",
        azione: (btn) => {
          chiudiPopupSelettivo(btn.closest(".popup"));
          if (evento.prova) {
            avviaProvaGenerica(evento);
          } else if (evento.seguito) {
            // Evento senza prova ma con un secondo messaggio in sequenza
            // (es. "Chiave": trovi l'oggetto, poi le istruzioni per prenderlo)
            mostraPopupGenerico({
              titolo: nomeElemento,
              messaggio: evento.seguito.testo || "",
              pulsanti: [
                {
                  testo: "Ok",
                  azione: (btn2) => {
                    chiudiPopupSelettivo(btn2.closest(".popup"));
                    if (evento.seguito.effetti) eseguiEffetti(evento.seguito.effetti);
                  },
                },
              ],
            });
          } else if (evento.effetti) {
            eseguiEffetti(evento.effetti);
          }
        },
      },
    ],
  });
}

// Prova di abilità "leggera" per gli eventi generici: individuale, esito
// immediato, il valore lo dichiara il giocatore (somma caratteristica +
// bonus, come da regolamento) — stesso principio delle prove sugli
// sbarramenti, ma senza la logica di accumulo/gruppo pensata per quelle.
function avviaProvaGenerica(evento) {
  const { abilita, difficolta } = evento.prova;

  const overlay = document.createElement("div");
  overlay.className = "popup";
  overlay.innerHTML = `
    <div class="popup-content">
      <h2>Prova di ${abilita}</h2>
      <p style="opacity:.85">Difficoltà: ${difficolta}</p>
      <div style="display:flex;align-items:center;justify-content:center;gap:10px;margin:14px 0;">
        <button id="genMinusBtn">−</button>
        <div style="min-width:60px;text-align:center;">
          <div style="font-size:1.6rem;" id="genValoreVal">0</div>
          <div style="font-size:.85rem;opacity:.75">Valore ottenuto</div>
        </div>
        <button id="genPlusBtn">+</button>
      </div>
      <div style="display:flex;gap:10px;justify-content:center;">
        <button id="genConfermaBtn">Conferma</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  let valore = 0;
  const valoreEl = overlay.querySelector("#genValoreVal");

  overlay.querySelector("#genMinusBtn").onclick = () => {
    valore = Math.max(0, valore - 1);
    valoreEl.textContent = valore;
  };
  overlay.querySelector("#genPlusBtn").onclick = () => {
    valore++;
    valoreEl.textContent = valore;
  };

  overlay.querySelector("#genConfermaBtn").onclick = () => {
    const ok = valore >= Number(difficolta);
    chiudiPopupSelettivo(overlay);

    const esito = ok ? evento.successo : evento.fallimento;
    if (!esito) return;

    mostraPopupGenerico({
      titolo: ok ? "Successo" : "Fallimento",
      messaggio: esito.testo || "",
      pulsanti: [
        {
          testo: "Ok",
          azione: (btn) => {
            chiudiPopupSelettivo(btn.closest(".popup"));
            if (esito.effetti) eseguiEffetti(esito.effetti);
          },
        },
      ],
    });
  };
}

// 🔹 Collega meccanicamente le scale
function collegaScale(carta) {
  const progettoVal = gameData.progettoScale?.[carta.codice] || "no";
  let attuale = carta.scale || "no";
  let nuovoVal = attuale;

  // --- STEP 1: Controllo carte sopra/sotto dal PROGETTO ---
  let daSopra = false;
  let daSotto = false;

  // Carta sopra → se nel progetto ha "giu", noi dobbiamo avere "su"
  const sopra = gameData.tabelloneAttivo.find(
    (c) =>
      c.posizione &&
      c.posizione.x === carta.posizione.x &&
      c.posizione.y === carta.posizione.y - 1
  );
  if (sopra && gameData.progettoScale?.[sopra.codice] === "giu") {
    daSopra = true;
  }

  // Carta sotto → se nel progetto ha "su", noi dobbiamo avere "giu"
  const sotto = gameData.tabelloneAttivo.find(
    (c) =>
      c.posizione &&
      c.posizione.x === carta.posizione.x &&
      c.posizione.y === carta.posizione.y + 1
  );
  if (sotto && gameData.progettoScale?.[sotto.codice] === "su") {
    daSotto = true;
  }

  // Assegna in base ai controlli
  if (daSopra && daSotto) {
    nuovoVal = "suegiu";
  } else if (daSopra) {
    nuovoVal = "su";
  } else if (daSotto) {
    nuovoVal = "giu";
  }

  // Se avevamo già un valore e ora ne aggiungiamo un altro → diventa "suegiu"
  if (attuale !== "no" && nuovoVal !== attuale && nuovoVal !== "no") {
    nuovoVal = "suegiu";
  }

  // Aggiorna se cambiato
  if (nuovoVal !== attuale && nuovoVal !== "no") {
    carta.scale = nuovoVal;
    attuale = nuovoVal;
    console.log(`🔧 Scala impostata su ${carta.codice}: ${nuovoVal}`);
  }

  // --- STEP 2: Logica attuale di attivazione dal PROGETTO ---
  if (attuale === "no") {
    if (progettoVal !== "no") {
      carta.scale = progettoVal;
      attuale = progettoVal;
      console.log(
        `🔧 Attivata scala da progetto su ${carta.codice}: ${progettoVal}`
      );
    }
  } else {
    if (progettoVal !== "no" && progettoVal !== attuale) {
      carta.scale = "suegiu";
      attuale = "suegiu";
      console.log(
        `🔀 ${carta.codice} diventa "suegiu" per attivazione da progetto`
      );
    }
  }

  // --- STEP 3: Aggiorna le carte collegate ---
  function aggiornaCollegata(yTarget, opposto) {
    const collegata = gameData.tabelloneAttivo.find(
      (c) =>
        c.posizione &&
        c.posizione.x === carta.posizione.x &&
        c.posizione.y === yTarget
    );
    if (!collegata) return;

    const attualeCol = collegata.scale || "no";
    if (attualeCol === "no") {
      collegata.scale = opposto;
      console.log(`↕️ Attivata scala ${opposto} su ${collegata.codice}`);
    } else if (attualeCol !== opposto && attualeCol !== "suegiu") {
      collegata.scale = "suegiu";
      console.log(`🔀 ${collegata.codice} diventa "suegiu"`);
    }
  }

  if (attuale === "su") {
    aggiornaCollegata(carta.posizione.y - 1, "giu");
  } else if (attuale === "giu") {
    aggiornaCollegata(carta.posizione.y + 1, "su");
  } else if (attuale === "suegiu") {
    aggiornaCollegata(carta.posizione.y - 1, "giu");
    aggiornaCollegata(carta.posizione.y + 1, "su");
  }
}

// 🔹 Disegna TUTTE le scale leggendo da gameData.tabelloneAttivo
function generaGrigliaTabellone() {
  const container = document.getElementById("tabelloneDinamico");
  container.innerHTML = "";
  container.classList.add("griglia-tabellone");

  // --- Disegno CARTE ---
  for (const carta of gameData.tabelloneAttivo) {
    const cella = document.createElement("div");
    cella.className = "cella-tabellone";

    // Contenuto principale della carta
    const cartaLuogo = document.createElement("div");
    cartaLuogo.className = "carta-tabellone";
    cartaLuogo.innerText = carta.codice;
    cartaLuogo.dataset.codice = carta.codice;

    if (carta.esplorata) {
      cartaLuogo.classList.add("esplorata");
    }

    // Posizionamento nella griglia
    cella.style.gridColumnStart = (carta.posizione.x ?? 0) + 1;
    cella.style.gridRowStart = (carta.posizione.y ?? 0) + 1;

    // Overlay (lucchetti, botole, ecc.)
    const strutture = carta.strutture || { overlay: [] };
    const overlays = strutture.overlay || [];
    overlays.forEach((overlay, index) => {
      const overlayDiv = document.createElement("div");
      overlayDiv.dataset.nomeStruttura = overlay.nome;
      overlayDiv.addEventListener("click", (e) => {
        e.stopPropagation();
        interagisciConStruttura(overlay.nome); // istanza non necessaria qui
      });
      overlayDiv.className = "overlay-struttura";
      overlayDiv.innerText = overlay.nome || "🔒";
      overlayDiv.style.left =
        overlays.length === 2 ? (index === 0 ? "5px" : "35px") : "20px";
      cella.appendChild(overlayDiv);
    });

    // Scale (solo se esplorata)
    if (carta.esplorata && carta.scale && carta.scale !== "no") {
      if (carta.scale === "giu" || carta.scale === "suegiu") {
        const connGiu = document.createElement("div");
        connGiu.className = "connessione-verticale-giu";
        connGiu.innerText = "⬇️";
        if (!carta.scalaGiuMostrata) {
          connGiu.classList.add("fade-in-scale");
          carta.scalaGiuMostrata = true;
        }
        cella.appendChild(connGiu);
      }
      if (carta.scale === "su" || carta.scale === "suegiu") {
        const connSu = document.createElement("div");
        connSu.className = "connessione-verticale-su";
        connSu.innerText = "⬆️";
        if (!carta.scalaSuMostrata) {
          connSu.classList.add("fade-in-scale");
          carta.scalaSuMostrata = true;
        }
        cella.appendChild(connSu);
      }
    }

    // Click sulla carta
    cartaLuogo.addEventListener("click", () => {
      gestisciClickCartaLuogo(carta.codice);
    });

    // Append
    cella.appendChild(cartaLuogo);
    container.appendChild(cella);
  }

  // --- Disegno STRUTTURE per coordinate ---
  // Usiamo gameData.tabelloneStrutture: ogni struttura ha posizione {x,y} anche con .5
  const strutturePiazzate = gameData.tabelloneStrutture || [];
  for (const s of strutturePiazzate) {
    // sicurezza
    if (
      !s?.posizione ||
      typeof s.posizione.x !== "number" ||
      typeof s.posizione.y !== "number"
    )
      continue;

    // Se la struttura è stata piazzata SOLO "logicamente" (visibile === false), la saltiamo:
    // Nota: retro-compatibilità — se la proprietà 'visibile' non esiste, consideriamo la struttura visibile (true).
    if (s.visibile === false) continue;

    const x = s.posizione.x;
    const y = s.posizione.y;
    const floorX = Math.floor(x);
    const floorY = Math.floor(y);
    const fracX = x - floorX; // 0 o 0.5
    const fracY = y - floorY; // 0 o 0.5

    // Elemento struttura
    const el = document.createElement("div");
    el.className = "struttura-grid-item";
    el.innerText = s.nome || "🚧";
    el.dataset.sxx = s.codiceCarta || "";
    el.dataset.nome = s.nome || "";
    el.dataset.dir = s.direzione || "";
    el.dataset.instanceId = s.codice || "";
    el.dataset.luogoA = s.luoghi?.[0] ?? "";
    el.dataset.luogoB = s.luoghi?.[1] ?? "";

    // Posizionamento in griglia: col/row start = floor+1
    el.style.gridColumnStart = (floorX + 1).toString();
    el.style.gridRowStart = (floorY + 1).toString();

    // Orientamento/Span:
    // - barriera tra due colonne: x è .5 → SPAN 2 colonne, elemento VERTICALE (stretto, alto)
    // - barriera tra due righe:    y è .5 → SPAN 2 righe,   elemento ORIZZONTALE (largo, basso)
    // - eventi centrati su cella:  nessuno .5 → SPAN 1x1 (badge sulla cella)
    const isBetweenCols = Math.abs(fracX - 0.5) < 0.001;
    const isBetweenRows = Math.abs(fracY - 0.5) < 0.001;

    if (isBetweenCols) {
      // tra due colonne → occupa 2 colonne e tutta l'altezza della cella → barra VERTICALE
      el.style.gridColumnEnd = "span 2";
      el.dataset.orientamento = "verticale";
      // allineamenti via CSS (stretch in altezza, spessore via --struct-thickness)
      // niente inline positioning: tutto demandato al CSS
    } else if (isBetweenRows) {
      // tra due righe → occupa 2 righe e tutta la larghezza della cella → barra ORIZZONTALE
      el.style.gridRowEnd = "span 2";
      el.dataset.orientamento = "orizzontale";
    } else {
      // centro cella (ad es. overlay speciali standalone)
      el.dataset.orientamento = "centrato";
    }

    // === DIAGNOSTICA GRID: colonna/ riga DOM effettive (gridColumnStart/Row) ===
    try {
      const celle = Array.from(container.querySelectorAll(".cella-tabellone"));
      const cols = celle
        .map((el) => Number(el.style.gridColumnStart))
        .filter(Number.isFinite);
      const rows = celle
        .map((el) => Number(el.style.gridRowStart))
        .filter(Number.isFinite);
      const domMinCol = cols.length ? Math.min(...cols) : null;
      const domMinRow = rows.length ? Math.min(...rows) : null;
      const domMaxCol = cols.length ? Math.max(...cols) : null;
      const domMaxRow = rows.length ? Math.max(...rows) : null;

      console.groupCollapsed("🧩 GRID DOM (gridColumnStart/RowStart)");
      console.log({
        domMinCol,
        domMaxCol,
        domMinRow,
        domMaxRow,
        count: celle.length,
      });
      console.groupEnd();
    } catch (e) {
      console.warn("grid diagnostica error:", e);
    }

    // Aggiungi all'output
    container.appendChild(el);

    // Interazione (click sulla struttura)
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      interagisciConStruttura(s.nome, s.codice, { x, y });
    });
  }
}

// 🔹 Esplorazione: segna come esplorata + aggiorna scale
function completaEsplorazione(carta, onClose = null) {
  console.log(
    `▶️ Inizio esplorazione per ${carta.codice} (pos: x=${carta.posizione.x}, y=${carta.posizione.y})`
  );

  // Segna come esplorata
  carta.esplorata = true;

  // Collega eventuali scale
  collegaScale(carta);

  // Recupera descrizione casuale (se presente)
  let descrizione = "";
  if (Array.isArray(carta.descrizione) && carta.descrizione.length > 0) {
    const randomIndex = Math.floor(Math.random() * carta.descrizione.length);
    descrizione = carta.descrizione[randomIndex];
  }

  // 👇 LOG prima dello zoom
  const b = _diagnosticaBounds("prima di ZOOM (completaEsplorazione)");
  console.log("ZOOM target", {
    x: carta.posizione.x,
    y: carta.posizione.y,
    codice: carta.codice,
    bounds: b,
  });

  // Mostra popup con descrizione o messaggio standard
  setTimeout(() => {
    const elCarta = document.querySelector(
      `.carta-tabellone[data-codice="${carta.codice}"]`
    );
    if (elCarta) {
      zoomSuElemento(elCarta, 1200, 2);
    } else {
      zoomSuCoordinate(carta.posizione.x, carta.posizione.y, 1200, 2);
    }
    mostraPopupGenerico({
      titolo: `${carta.nome}`,
      messaggio: descrizione
        ? `${descrizione}`
        : `🏆 Hai <span class="tutorial-link" data-voce="Esplorazione">esplorato</span>
           e scoperto: <strong>${carta.nome || carta.codice}</strong>!`,
      pulsanti: [
        {
          testo: "Chiudi",
          azione: () => {
            resetZoom();
            chiudiPopup();

            setTimeout(() => {
              try {
                // 1) raccogli instanceId di strutture logiche che coinvolgono questa carta e NON sono visibili
                const codiceCarta = carta.codice;
                const strutture = gameData.tabelloneStrutture || [];
                const daRivelare = [];

                strutture.forEach((s) => {
                  if (!s || !Array.isArray(s.luoghi)) return;
                  // se la struttura riguarda questa carta e NON è visibile -> la aggiungiamo
                  if (
                    (s.luoghi[0] === codiceCarta ||
                      s.luoghi[1] === codiceCarta) &&
                    s.visibile !== true
                  ) {
                    daRivelare.push(s.codice);
                  }
                });

                // 2) se ci sono strutture da rivelare, usiamo la funzione batch (single re-render)
                //    e SOLO DOPO (mai in sovrapposizione) rivela eventuali PNG nascosti qui.
                if (daRivelare.length > 0) {
                  rivelaStruttureBatch(daRivelare, {
                    zoom: true,
                    onComplete: () => rivelaPngNascostiIn(codiceCarta),
                  });
                } else {
                  rivelaPngNascostiIn(codiceCarta);
                }
                eseguiEventiScenario("esplorazione", { luogo: codiceCarta });
              } catch (err) {
                console.warn(
                  "Errore durante il reveal alla chiusura popup:",
                  err
                );
              }
            }, 500);
            if (typeof onClose === "function") {
              onClose(); // ✅ chiamata finale
            }
          },
        },
      ],
    });
  }, 500);

  // Aggiorna grafica tabellone
  generaGrigliaTabellone();
}

function verificaMotivoInaccessibile(
  nomePG,
  codiceDestinazione,
  mappaEsistente = null
) {
  const movimentoMax = gameData.movimentoAttuale[nomePG] || 0;
  const start = gameData.posizioniPersonaggi[nomePG];

  const cartaPartenza = gameData.tabelloneAttivo.find(
    (c) => c.codice === start
  );
  const cartaDest = gameData.tabelloneAttivo.find(
    (c) => c.codice === codiceDestinazione
  );

  // 1️⃣ Percorso reale: rispetta solo gli sbarramenti bloccanti GIÀ SCOPERTI
  // (esattamente come il movimento vero). Se questo percorso esiste ma è più
  // lungo del movimento disponibile, il motivo è SEMPRE "movimento
  // insufficiente" — non menzioniamo mai qui eventuali sbarramenti non
  // ancora scoperti che si trovassero lungo la strada: il giocatore li
  // scoprirà solo provando davvero a muoversi.
  const percorsoNormale = calcolaPercorso(
    start,
    codiceDestinazione,
    mappaEsistente
  );

  if (percorsoNormale && percorsoNormale.length > 1) {
    if (percorsoNormale.length > movimentoMax + 1) {
      return "Movimento insufficiente per raggiungere la destinazione.";
    }
    return "Questa casella è inaccessibile.";
  }

  // 2️⃣ Nessun percorso reale: capiamo perché. Controlliamo se uno
  // sbarramento bloccante GIÀ VISIBILE (scoperto) chiude ogni strada
  // possibile — quelli non ancora scoperti non contano come motivo,
  // perché per il giocatore semplicemente non esistono ancora.
  const percorsoGrezzo = calcolaPercorsoIgnorandoSbarramenti(
    start,
    codiceDestinazione
  );

  if (percorsoGrezzo && percorsoGrezzo.length > 1) {
    for (let i = 0; i < percorsoGrezzo.length - 1; i++) {
      const cartaA = gameData.tabelloneAttivo.find(
        (c) => c.codice === percorsoGrezzo[i]
      );
      const cartaB = gameData.tabelloneAttivo.find(
        (c) => c.codice === percorsoGrezzo[i + 1]
      );
      const trovato = trovaSbarramentoTra(cartaA, cartaB);
      if (trovato && trovato.isBlocking && trovato.struttura.visibile === true) {
        return "Uno sbarramento blocca il passaggio.";
      }
    }
  }

  // 3️⃣ Assenza di scale attive fra piani diversi
  const livelloDiverso =
    cartaPartenza?.posizione?.y !== cartaDest?.posizione?.y;

  if (livelloDiverso) {
    return "Non sono ancora state rivelate <span class='tutorial-link' data-voce='Scale'>Scale</span> tra i due piani.";
  }

  // 4️⃣ Caso generico
  return "Questa casella è inaccessibile.";
}

function calcolaPercorsoIgnorandoSbarramenti(codiceInizio, codiceFine) {
  const mappa = costruisciMappaNavigabileIgnorandoSbarramenti();
  const start = Object.values(mappa).find((n) => n.codice === codiceInizio);
  const end = Object.values(mappa).find((n) => n.codice === codiceFine);

  if (!start || !end) return [];

  const coda = [{ nodo: start, percorso: [start] }];
  const visitati = new Set();

  while (coda.length > 0) {
    const { nodo, percorso } = coda.shift();
    const chiave = `${nodo.x},${nodo.y}`;
    if (visitati.has(chiave)) continue;
    visitati.add(chiave);

    if (nodo.codice === codiceFine) {
      return percorso.map((p) => p.codice);
    }

    for (const vicino of nodo.vicini) {
      coda.push({ nodo: vicino, percorso: [...percorso, vicino] });
    }
  }

  return [];
}

// 🔹 Trova lo sbarramento (se esiste) posizionato tra due carte, bloccante o no.
// Riusa la stessa geometria già usata altrove, ma restituisce la struttura stessa
// invece di un semplice sì/no, così può essere rivelata durante il movimento.
function trovaSbarramentoTra(cartaA, cartaB) {
  if (!cartaA?.posizione || !cartaB?.posizione) return null;

  const strutture = gameData.tabelloneStrutture || [];
  for (const struttura of strutture) {
    if (struttura.tipo !== "sbarramento") continue;

    const pos = struttura.posizione;
    const ax = cartaA.posizione.x;
    const ay = cartaA.posizione.y;
    const bx = cartaB.posizione.x;
    const by = cartaB.posizione.y;

    const traX =
      Math.abs(pos.x - (ax + bx) / 2) < 0.01 && pos.y === ay && ay === by;
    const traY =
      Math.abs(pos.y - (ay + by) / 2) < 0.01 && pos.x === ax && ax === bx;

    if (!traX && !traY) continue;

    const def = (gameData.catalogoStrutture || []).find(
      (s) => s.codice === struttura.codiceCarta || s.nome === struttura.nome
    );
    let isBlocking = true; // default prudente
    if (def && Object.prototype.hasOwnProperty.call(def, "bloccante")) {
      if (typeof def.bloccante === "boolean") {
        isBlocking = def.bloccante;
      } else if (typeof def.bloccante === "string") {
        const v = def.bloccante.trim().toLowerCase().replace("ì", "i");
        isBlocking = v !== "no";
      }
    }

    return { struttura, isBlocking };
  }
  return null;
}

// 🔹 RIVELAZIONE PROGRESSIVA DEGLI SBARRAMENTI
// Scandisce il percorso passo-passo (non tutto insieme) e si ferma al primo
// sbarramento bloccante trovato, anche se non era ancora stato scoperto.
// Gli sbarramenti non bloccanti vengono scoperti ma non fermano il personaggio.
function troncaPercorsoAiSbarramenti(percorso) {
  const idsDaRivelare = [];

  if (!Array.isArray(percorso) || percorso.length < 2) {
    return { percorsoValido: percorso, idsDaRivelare, bloccato: false };
  }

  for (let i = 0; i < percorso.length - 1; i++) {
    const cartaA = gameData.tabelloneAttivo.find(
      (c) => c.codice === percorso[i]
    );
    const cartaB = gameData.tabelloneAttivo.find(
      (c) => c.codice === percorso[i + 1]
    );
    if (!cartaA || !cartaB) break;

    const trovato = trovaSbarramentoTra(cartaA, cartaB);
    if (!trovato) continue; // nessuno sbarramento su questo tratto → prosegui

    const { struttura, isBlocking } = trovato;

    if (struttura.visibile !== true) {
      idsDaRivelare.push(struttura.codice);
    }

    if (isBlocking) {
      // Il personaggio si ferma qui: non attraversa questo sbarramento
      return {
        percorsoValido: percorso.slice(0, i + 1),
        idsDaRivelare,
        bloccato: true,
      };
    }
    // Non bloccante: il personaggio passa e continuiamo a controllare il resto
  }

  return { percorsoValido: percorso, idsDaRivelare, bloccato: false };
}

// ============================
// 📌 6. GESTIONE TURNI
// ============================

function aggiornaContatoreTurni() {
  const counter = document.getElementById("turnCounter");
  if (counter) {
    counter.innerText = `Contatore Minacce: ${gameData.turniRimanenti}`;
  }
}

function mostraMessaggioFase() {
  // Rimuovi messaggi precedenti
  const esistente = document.getElementById("messaggioFase");
  if (esistente) esistente.remove();

  const overlay = document.createElement("div");
  overlay.id = "overlayfase";
  overlay.style.position = "fixed";
  overlay.style.top = "0";
  overlay.style.left = "0";
  overlay.style.width = "100%";
  overlay.style.height = "100%";
  overlay.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
  overlay.style.zIndex = "9";

  const msg = document.createElement("div");
  msg.id = "messaggioFase";
  msg.className = "fase-animata";
  msg.innerText =
    faseCorrente === "giocatori" ? "Fase dei Giocatori" : "Fase delle Minacce";

  // Colore diverso per fase
  msg.style.backgroundColor =
    faseCorrente === "giocatori" ? "#2e7d32" : "#b71c1c";

  document.body.appendChild(overlay);
  document.body.appendChild(msg);

  // Trigger animazione (richiede un minimo di delay per essere visibile in CSS)
  setTimeout(() => msg.classList.add("attivo"), 50);

  // Rimozione messaggio e overlay dopo 4s
  setTimeout(() => {
    msg.classList.remove("attivo");
    setTimeout(() => {
      msg.remove();
      overlay.remove();
    }, 1000); // tempo per completare uscita
  }, 2000); // tempo visibile
}

function aggiornaIndicatoreFase() {
  const el = document.getElementById("phaseIndicator");
  if (!el) return;

  const isGiocatori = faseCorrente === "giocatori";
  const pg = isGiocatori ? gameData.pgAttivo : null;

  // Testo: "Fase Giocatori - NomePG" oppure solo "Fase Giocatori" / "Fase Minacce"
  const label = isGiocatori
    ? pg
      ? `Fase Giocatori - ${pg}`
      : "Fase Giocatori"
    : "Fase Minacce";

  el.textContent = label; // niente spazi extra → funziona :empty
  el.classList.toggle("giocatori", isGiocatori);
  el.classList.toggle("minacce", !isGiocatori);
}

function mostraSconfitta() {
  salvaStatoCampagna();

  // Disabilita il pulsante "Avanza Turno"
  const btnTurno = document.getElementById("btnAvanzaTurno");
  if (btnTurno) btnTurno.disabled = true;

  // Crea overlay
  const overlay = document.createElement("div");
  overlay.className = "popup";
  overlay.innerHTML = `
    <div class="popup-content">
      <h2 style="color: red;">SCONFITTA!</h2>
      <p>Il tempo è scaduto... l'oscurità ha prevalso.</p>
      <button id="btnBackToMenu">Torna al menu principale</button>
    </div>
  `;

  document.body.appendChild(overlay);

  // Listener per tornare al menu
  document.getElementById("btnBackToMenu").onclick = () => {
    goToMainMenu();
  };

  // Nasconde gli elementi attivi di gioco
  const contatore = document.getElementById("turno-counter");
  if (contatore) contatore.style.display = "none";

  if (btnTurno) btnTurno.style.display = "none";
}

// Gemella di mostraSconfitta(): da richiamare quando l'obiettivo dello
// scenario viene raggiunto (la logica che verifica l'obiettivo è lavoro
// futuro, questa funzione gestisce solo la schermata finale + salvataggio campagna).
function mostraVittoria() {
  salvaStatoCampagna();

  const btnTurno = document.getElementById("btnAvanzaTurno");
  if (btnTurno) btnTurno.disabled = true;

  const overlay = document.createElement("div");
  overlay.className = "popup";
  overlay.innerHTML = `
    <div class="popup-content">
      <h2 style="color: green;">VITTORIA!</h2>
      <p>Siete sopravvissuti e avete portato a termine l'obiettivo.</p>
      <button id="btnBackToMenuVittoria">Torna al menu principale</button>
    </div>
  `;

  document.body.appendChild(overlay);

  document.getElementById("btnBackToMenuVittoria").onclick = () => {
    goToMainMenu();
  };

  const contatore = document.getElementById("turno-counter");
  if (contatore) contatore.style.display = "none";

  if (btnTurno) btnTurno.style.display = "none";
}

// ============================
// 📌 7. MENU OBIETTIVI COMUNI
// ============================

function aggiornaListaObiettivi() {
  const lista = document.getElementById("listaObiettivi");
  if (!lista || !gameData.scenario || !gameData.scenario.obiettivo) return;

  lista.innerHTML = "";

  const obiettivi = [
    {
      testo: gameData.scenario.obiettivo,
      completato:
        gameData.obiettiviCompletati?.includes(gameData.scenario.obiettivo) ||
        false,
    },
  ];

  gameData.obiettiviComuni = obiettivi;
  gameData.obiettiviCompletati = gameData.obiettiviCompletati || [];

  obiettivi.forEach((obj, index) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <span style="color: ${obj.completato ? "lightgreen" : "white"}">
        ${obj.testo}
      </span>
      ${
        obj.completato
          ? "✅"
          : `<button onclick="confermaCompletamentoObiettivo(${index})">Segna completato</button>`
      }
    `;
    lista.appendChild(li);
  });
}

function confermaCompletamentoObiettivo(index) {
  const obiettivo = gameData.obiettiviComuni[index];

  const popup = document.createElement("div");
  popup.classList.add("popup");
  popup.innerHTML = `
    <div class="popup-content">
      <p>Sei sicuro di voler segnare come completato questo obiettivo?</p>
      <p><em>${obiettivo.testo}</em></p>
      <button id="confermaCompletaBtn">Sì, completa</button>
      <button id="annullaCompletaBtn">Annulla</button>
    </div>
  `;

  document.body.appendChild(popup);

  document
    .getElementById("confermaCompletaBtn")
    .addEventListener("click", (e) => {
      e.stopPropagation();
      gameData.obiettiviCompletati.push(obiettivo.testo);
      popup.remove();
      aggiornaListaObiettivi();

      const tuttiCompletati = gameData.obiettiviComuni.every((obj) =>
        gameData.obiettiviCompletati.includes(obj.testo)
      );

      if (tuttiCompletati) {
        mostraMessaggioVittoriaGruppo();
      }
    });

  document
    .getElementById("annullaCompletaBtn")
    .addEventListener("click", (e) => {
      e.stopPropagation();
      popup.remove();
    });
}

function mostraMessaggioVittoriaGruppo() {
  const popup = document.createElement("div");
  popup.id = "popup";
  popup.classList.add("popup");

  popup.innerHTML = `
    <div class="popup-content">
      <h2 style="color: lightgreen;">🎉 VITTORIA DI GRUPPO 🎉</h2>
      <p>Mostrate i vostri Obiettivi Personali. Chiunque abbia completato il proprio Obiettivo Personale assieme all'Obiettivo Comune, vince la partita!</p>
      <button onclick="goToMainMenu()">Torna al menu principale</button>
    </div>
  `;

  document.body.appendChild(popup);

  // Nascondi elementi interattivi
  document.getElementById("btnAvanzaTurno").style.display = "none";
  document.getElementById("turnCounter").style.display = "none";
}

// ============================
// 📌 9. MENU PERSONAGGI E DETTAGLI
// ============================

function mostraMenuPersonaggi() {
  const popup = document.createElement("div");
  popup.classList.add("popup");
  popup.id = "popupMenuPersonaggi";

  let html = `<div class="popup-content"><h2>Personaggi in gioco</h2>
  <div class="lista-personaggi">`;

  gameData.personaggi.forEach((pg, index) => {
    html += `
      <div class="personaggio-card">
        <div class="avatar-placeholder">[Avatar]</div>
        <p><strong>${pg}</strong></p>
        <button onclick="mostraDettagliPersonaggio(${index})">Dettagli Personaggio</button>
      </div>
    `;
  });

  html += `</div><button onclick="chiudiPopup()">Chiudi</button></div>`;

  popup.innerHTML = html;
  document.body.appendChild(popup);
}

function mostraMenuTurniGiocatori(personaggiDisponibili) {
  const popup = document.createElement("div");
  popup.classList.add("popup");
  popup.id = "popupTurniGiocatori";

  let html = `<div class="popup-content"><h2>Chi agisce ora?</h2>
  <div class="lista-personaggi">`;

  personaggiDisponibili.forEach((pg) => {
    html += `
      <div class="personaggio-card">
        <div class="avatar-placeholder">[Avatar]</div>
        <p><strong>${pg}</strong></p>
        <button onclick="avviaTurnoPer('${pg}')">Avvia Turno</button>
      </div>
    `;
  });

  popup.innerHTML = html;
  document.body.appendChild(popup);
}

function avviaTurnoPer(nomePG) {
  chiudiPopup(); // Chiude il menu turni
  gameData.pgAttivo = nomePG;
  gameData.movimentoUsato[nomePG] = false; // Nuovo turno: movimento di nuovo disponibile

  mostraPopupGenerico({
    titolo: `${nomePG}`,
    messaggio: `Il tuo <span class='tutorial-link' data-voce='Turno di Gioco'>Turno</span> ha inizio!`,
  });
  aggiornaIndicatoreFase();
  // Recupera la cella in cui si trova il PG attivo
  const cellaAttiva = gameData.posizioniPersonaggi[nomePG];
  if (cellaAttiva) {
    // Ridisegna SOLO la cella del PG attivo
    aggiornaPersonaggiNelleCelle([cellaAttiva]);
  }
}

function mostraDettagliPersonaggio(index) {
  ultimoPersonaggioSelezionato = index;
  const pg = gameData.personaggi[index];
  const dati = getCarteIniziali(pg);

  const popup = document.createElement("div");
  popup.classList.add("popup");
  popup.id = "popupDettagliPersonaggio";

  let html = `
    <div class="popup-content">
      <h2>${pg}</h2>
      <p class="bg-personaggio">[Descrizione background del personaggio qui]</p>

      <h3>Abilità</h3>
      <ul>
        ${dati.abilità
          .map(
            (a) =>
              `<li><button onclick="mostraDettaglioVoce('${a}', 'Descrizione dell\\'abilità ${a}')">${a}</button></li>`
          )
          .join("")}
      </ul>

      <h3>Equipaggiamento</h3>
      <ul>
        ${dati.equipaggiamento
          .map(
            (e) =>
              `<li><button onclick="mostraDettaglioVoce('${e}', 'Descrizione dell\\'oggetto ${e}')">${e}</button></li>`
          )
          .join("")}
      </ul>

      <button onclick="tornaAlMenuPersonaggi()">Indietro</button>
      <button onclick="chiudiPopup()">Chiudi</button>
    </div>
  `;

  popup.innerHTML = html;

  chiudiPopup(); // Chiude popup precedente (lista personaggi)
  document.body.appendChild(popup);
}

function mostraDettaglioVoce(titolo, descrizione) {
  const popup = document.createElement("div");
  popup.classList.add("popup");
  popup.id = "popupDettaglioVoce";

  popup.innerHTML = `
    <div class="popup-content">
      <h2>${titolo}</h2>
      <p>${descrizione}</p>
      <button onclick="tornaAiDettagliPersonaggio()">Indietro</button>
      <button onclick="chiudiPopup()">Chiudi</button>
    </div>
  `;

  chiudiPopup(); // chiude il dettaglio precedente
  document.body.appendChild(popup);
}

function tornaAlMenuPersonaggi() {
  chiudiPopup();
  mostraMenuPersonaggi();
}

function tornaAiDettagliPersonaggio() {
  chiudiPopup();
  if (ultimoPersonaggioSelezionato !== null) {
    mostraDettagliPersonaggio(ultimoPersonaggioSelezionato);
  }
}

function mostraMenuSalvataggi() {
  const popup = document.createElement("div");
  popup.classList.add("popup");

  popup.innerHTML = `
    <div class="popup-content">
      <h3>Seleziona uno slot di salvataggio</h3>
      ${[1, 2, 3]
        .map(
          (i) => `
        <div class="salva-slot" onclick="salvaPartita(${i})">
          Slot ${i} ${
            localStorage.getItem(`salvataggio${i}`)
              ? "(📝 già usato)"
              : "(vuoto)"
          }
        </div>
      `
        )
        .join("")}
      <button onclick="chiudiPopup()">Annulla</button>
    </div>
  `;

  document.body.appendChild(popup);
}

function salvaPartita(slot) {
  const chiave = `salvataggio${slot}`;
  const esiste = localStorage.getItem(chiave);

  function salvaEDaiFeedback() {
    const datiDaSalvare = {
      gameData,
      faseCorrente,
    };
    localStorage.setItem(chiave, JSON.stringify(datiDaSalvare));
    mostraPopupSalvataggioConferma(slot);
    chiudiPopup();
  }

  if (esiste) {
    mostraConfermaSovrascrittura(salvaEDaiFeedback);
  } else {
    salvaEDaiFeedback();
  }
}

function caricaPartita(slot) {
  const chiave = `salvataggio${slot}`;
  const raw = localStorage.getItem(chiave);

  if (!raw) {
    return mostraPopupErroreCaricamento(slot);
  }

  try {
    const dati = JSON.parse(raw);
    gameData = dati.gameData;
    faseCorrente = dati.faseCorrente || "minacce"; // fallback sicuro
  } catch (e) {
    return mostraPopupErroreCaricamento(slot);
  }

  mostraPopupConfermaCaricamento(slot);
  chiudiPopup();
  mostraSchermataPrincipale();
  generaGrigliaTabellone();
}

// ============================
// 📌 CAMPAGNA (storage persistente, indipendente dai salvataggi di partita)
// ============================
// Chiave localStorage: campagna1 / campagna2 / campagna3.
// gameData.campagna è la copia "attiva" in memoria durante la partita.

function struttureCampagnaVuota(nome) {
  return {
    nome: nome || "Nuova campagna",
    scenariCompletati: [],
    flag: {},
    personaggiPersistenti: {}, // PNG e mostri, stesso schema
  };
}

function elencaCampagne() {
  return [1, 2, 3].map((slot) => {
    const raw = localStorage.getItem(`campagna${slot}`);
    return { slot, dati: raw ? JSON.parse(raw) : null };
  });
}

function nuovaCampagna(slot, nome) {
  const chiave = `campagna${slot}`;
  gameData.campagna = struttureCampagnaVuota(nome);
  gameData.campagnaSlot = slot;
  localStorage.setItem(chiave, JSON.stringify(gameData.campagna));
}

function caricaCampagna(slot) {
  const raw = localStorage.getItem(`campagna${slot}`);
  if (!raw) return false;
  gameData.campagna = JSON.parse(raw);
  gameData.campagnaSlot = slot;
  return true;
}

// Da chiamare a fine scenario (vittoria/sconfitta), MAI durante la partita:
// fonde eventuali modifiche fatte in gameData.campagna con lo storage.
function salvaStatoCampagna() {
  if (!gameData.campagna || !gameData.campagnaSlot) return;
  if (gameData.scenario?.id) {
    const id = gameData.scenario.id;
    if (!gameData.campagna.scenariCompletati.includes(id)) {
      gameData.campagna.scenariCompletati.push(id);
    }
  }
  localStorage.setItem(
    `campagna${gameData.campagnaSlot}`,
    JSON.stringify(gameData.campagna)
  );
}

// Helper per eventi/dialoghi futuri
function leggiFlagCampagna(nome) {
  return gameData.campagna?.flag?.[nome];
}

function impostaFlagCampagna(nome, valore) {
  if (!gameData.campagna) return;
  gameData.campagna.flag[nome] = valore;
}

function leggiPersonaggioCampagna(codice) {
  return gameData.campagna?.personaggiPersistenti?.[codice];
}

function impostaPersonaggioCampagna(codice, patch) {
  if (!gameData.campagna) return;
  const attuale = gameData.campagna.personaggiPersistenti[codice] || {};
  gameData.campagna.personaggiPersistenti[codice] = { ...attuale, ...patch };
}

function mostraMenuCampagna() {
  const popup = document.createElement("div");
  popup.classList.add("popup");

  popup.innerHTML = `
    <div class="popup-content">
      <h3>Modalità Campagna</h3>
      ${elencaCampagne()
        .map(({ slot, dati }) => {
          const etichetta = dati
            ? `📖 ${dati.nome} (${dati.scenariCompletati.length} scenari completati)`
            : "(vuoto)";
          return `<div class="salva-slot" onclick="sceltaSlotCampagna(${slot})">Slot ${slot} ${etichetta}</div>`;
        })
        .join("")}
      <button onclick="chiudiPopup()">Annulla</button>
    </div>
  `;

  document.body.appendChild(popup);
}

function sceltaSlotCampagna(slot) {
  const raw = localStorage.getItem(`campagna${slot}`);

  if (raw) {
    caricaCampagna(slot);
    chiudiPopup();
    mostraSelezioneScenarioCampagna();
    return;
  }

  const nome = prompt("Nome della nuova campagna:", "La mia campagna");
  if (nome === null) return; // annullato
  nuovaCampagna(slot, nome || "Nuova campagna");
  chiudiPopup();
  mostraSelezioneScenarioCampagna();
}

function mostraSelezioneScenarioCampagna() {
  const comuni = scenariDisponibili.filter((s) => s.tipo === "comune");
  const completati = gameData.campagna?.scenariCompletati || [];
  const container = document.querySelector(".container");
  container.classList.remove("schermata-iniziale");

  const html = `
    <h2>Campagna: ${gameData.campagna?.nome || ""}</h2>
    <p>Seleziona il prossimo scenario da giocare.</p>
    ${comuni
      .map((s) => {
        const fatto = completati.includes(s.id);
        return `<button onclick="avviaScenarioCampagna('${s.id}')">${
          s.nome
        } ${fatto ? "✅" : ""}</button>`;
      })
      .join("<br/>")}
  `;

  document.querySelector(".container").innerHTML = html;

  mostraNavigazione({
    home: goToMainMenu,
  });
}

function avviaScenarioCampagna(idScenario) {
  const scenario = scenariDisponibili.find((s) => s.id === idScenario);
  if (!scenario) {
    alert("Errore: scenario non trovato!");
    return;
  }
  caricaCarteLuogo().then(() => {
    gameData.scenario = scenario;
    gameData.contestoAmbientale = risolviContestoAmbientale(scenario);
    preparaTabellonePerScenario();
    mostraScenario(scenario);
  });
}

// ============================
// 📌 EVENTI DI SCENARIO (dati JSON: scenario.eventi)
// ============================
// Un evento = { id, trigger, condizione?, unaVolta?, effetti[] }
// trigger: {tipo:"inizioScenario"} | {tipo:"turno", numero} | {tipo:"esplorazione", luogo?}
// condizione: {flag, uguale?, diverso?} | {and:[...]} | {or:[...]} (opzionale, default: sempre vera)
// effetti: vedi eseguiEffetto()

// Flag: prima cerca nei flag locali dello scenario in corso, poi in quelli di campagna
function leggiFlag(nome) {
  if (gameData.flagScenario && nome in gameData.flagScenario) {
    return gameData.flagScenario[nome];
  }
  return leggiFlagCampagna(nome);
}

function impostaFlag(nome, valore, ambito = "scenario") {
  if (ambito === "campagna") {
    impostaFlagCampagna(nome, valore);
  } else {
    gameData.flagScenario = gameData.flagScenario || {};
    gameData.flagScenario[nome] = valore;
  }
}

function condizioneSoddisfatta(cond) {
  if (!cond) return true;
  if (cond.and) return cond.and.every(condizioneSoddisfatta);
  if (cond.or) return cond.or.some(condizioneSoddisfatta);
  if (cond.flag !== undefined) {
    const val = leggiFlag(cond.flag);
    if ("uguale" in cond) return val === cond.uguale;
    if ("diverso" in cond) return val !== cond.diverso;
    return !!val;
  }
  return true;
}

// Punto di innesto: nuovi tipi di effetto si aggiungono qui, un case alla volta.
function eseguiEffetto(effetto) {
  switch (effetto.tipo) {
    case "popup":
      mostraPopupGenerico({
        titolo: effetto.titolo || "",
        messaggio: effetto.messaggio || "",
        pulsanti: [{ testo: "Chiudi", azione: () => chiudiPopup() }],
      });
      break;
    case "impostaFlag":
      impostaFlag(effetto.nome, effetto.valore, effetto.ambito);
      break;
    case "impostaStatoLuogo":
      if (effetto.stato === "rumore" && typeof generaRumore === "function") {
        generaRumore(
          gameData.posizioniPersonaggi?.[gameData.pgAttivo],
          effetto.valore ?? 3,
          {
            descrizione: effetto.descrizione || "Urlo",
            tipo: effetto.tipoRumore || null,
            chi: gameData.pgAttivo,
          }
        );
      } else {
        console.warn(
          `Effetto "impostaStatoLuogo" (${effetto.stato}) non gestito.`
        );
      }
      break;
    default:
      console.warn("Effetto sconosciuto:", effetto);
  }
}

function eseguiEffetti(effetti = []) {
  effetti.forEach(eseguiEffetto);
}

function eseguiEventiScenario(tipoTrigger, contesto = {}) {
  const eventi = gameData.scenario?.eventi || [];
  gameData.eventiEseguiti = gameData.eventiEseguiti || [];

  eventi.forEach((ev) => {
    if (ev.trigger?.tipo !== tipoTrigger) return;
    if (tipoTrigger === "turno" && ev.trigger.numero !== contesto.numero) return;
    if (
      tipoTrigger === "esplorazione" &&
      ev.trigger.luogo &&
      ev.trigger.luogo !== contesto.luogo
    )
      return;

    const unaVolta = ev.unaVolta !== false; // default: sì
    if (unaVolta && gameData.eventiEseguiti.includes(ev.id)) return;
    if (!condizioneSoddisfatta(ev.condizione)) return;

    eseguiEffetti(ev.effetti || []);
    if (unaVolta) gameData.eventiEseguiti.push(ev.id);
  });
}

function mostraConfermaSovrascrittura(callbackConferma) {
  const popup = document.createElement("div");
  popup.classList.add("popup");
  popup.innerHTML = `
    <div class="popup-content">
      <p>⚠️ Questo slot contiene già un salvataggio. Vuoi sovrascriverlo?</p>
      <button id="btnSovrascrivi">Sì, sovrascrivi</button>
      <button id="btnAnnullaSovrascrittura">Annulla</button>
    </div>
  `;

  popup.querySelector("#btnSovrascrivi").onclick = () => {
    popup.remove();
    callbackConferma();
  };

  popup.querySelector("#btnAnnullaSovrascrittura").onclick = () => {
    popup.remove();
  };

  document.body.appendChild(popup);
}

function mostraPopupSalvataggioConferma(slot) {
  const popup = document.createElement("div");
  popup.classList.add("popup");
  popup.innerHTML = `
    <div class="popup-content">
      <p>✅ Partita salvata correttamente nello Slot ${slot}.</p>
      <button onclick="this.closest('.popup').remove()">Ok</button>
    </div>
  `;
  document.body.appendChild(popup);
}

function mostraPopupErroreCaricamento(slot) {
  const popup = document.createElement("div");
  popup.className = "popup";
  popup.innerHTML = `
    <div class="popup-content">
      <p>❌ Nessun salvataggio valido trovato nello Slot ${slot}.</p>
      <button onclick="this.closest('.popup').remove()">Ok</button>
    </div>`;
  document.body.appendChild(popup);
}

function mostraPopupConfermaCaricamento(slot) {
  const popup = document.createElement("div");
  popup.className = "popup";
  popup.innerHTML = `
    <div class="popup-content">
      <p>✅ Partita caricata correttamente dallo Slot ${slot}.</p>
      <button onclick="this.closest('.popup').remove()">Continua</button>
    </div>`;
  document.body.appendChild(popup);
}

function confermaRitornoMenu() {
  const popup = document.createElement("div");
  popup.classList.add("popup");

  popup.innerHTML = `
    <div class="popup-content">
      <h3>Sei sicuro di voler tornare al menu principale?</h3>
      <p>Ti consigliamo di salvare prima la partita per non perdere i progressi.</p>
      <button onclick="goToMainMenu()">Torna al Menu</button>
      <button onclick="chiudiPopup()">Annulla</button>
    </div>
  `;

  document.body.appendChild(popup);
}

// 📖 Tutorial guidato iniziale — UN SOLO elenco di passi, con:
//  - preAzione (opzionale): effetto puramente dimostrativo mostrato solo
//    insieme alla spiegazione (es. aprire un menu, evidenziare un pulsante)
//  - suChiusura (opzionale): da annullare/chiudere insieme al popup (es. richiudere il menu aperto da preAzione)
//  - popup / voceTutorial: cosa mostrare (uno dei due) se le spiegazioni sono attive
//  - ritardoMs (opzionale): pausa "di lettura" dopo la chiusura del popup, prima di eseguire postAzione
//  - postAzione: cosa succede alla fine del passo — SEMPRE eseguita, sia che
//    il popup sia stato mostrato e chiuso, sia che le spiegazioni siano state saltate
const passiTutorial = {
  1: {
    popup: {
      titolo: "🎃 Benvenuti ne I Portatori d'Orrore",
      messaggio:
        "Questa è la vostra prima partita, e state per affrontare lo Scenario Tutorial: <strong> La Notte di Halloween. </strong> Durante la partita, questa app vi guiderà passo passo tra turni, esplorazioni, obiettivi e interazioni. Seguite attentamente le indicazioni, cliccate sui pulsanti agli angoli dello schermo per accedere ai menu, ed esplorate i luoghi con i codici delle carte. Buona fortuna... ne avrete bisogno.",
    },
    postAzione: () => avviaTutorialFase(2),
  },
  2: {
    preAzione: () => {
      setTimeout(() => {
        gestisciFrecciaTutorial(true, "bottom-left");
      }, 300);
    },
    popup: {
      titolo: "Tutorial",
      messaggio:
        "Durante tutto il corso di questa partita Tutorial appariranno dei messaggi come questo allo scopo di illustrarvi le Regole del gioco, ma al fine di non esseer troppo invadenti e rischiare di rovinarvi l'esperienza, ci limiteremo a mostrarvi solamente i fondamnetali. Qualora abbiate bisogno, in qualsiasi momento, di approfondire la conoscenza di alcune meccaniche di gioco, avrete due opzioni. La prima, è quella di premere il pulsante Tutorial posto in basso a sinistra nella schermata principale.",
    },
    postAzione: () => avviaTutorialFase(3),
  },
  3: {
    preAzione: () => toggleSideMenu("menuTutorial", "left", 300),
    suChiusura: () => toggleSideMenu("menuTutorial", "left", 300),
    popup: {
      titolo: "Menu Tutorial",
      messaggio:
        "Così facendo si aprirà il relativo Menu, diviso per categorie, nel quale potrete ricercare la nozione che vi interessa. Ciò nonostante, sappiamo benissimo quanto sia noioso e macchinoso dover accedere ad un menu apposito e destreggiarsi fra un fiume di pulsanti e testi. Ecco perché vi proponiamo anche una seconda opzione.",
    },
    postAzione: () => avviaTutorialFase(4),
  },
  4: {
    popup: {
      titolo: "Tutorial quando serve!",
      messaggio:
        "Come noterete durante il corso di questa e di tutte le vostre future partite, molto spesso, nei testi presenti in gioco, alcune parole appariranno sottolineate e in un colore diverso rispetto alle altre, come ad esempio: <span class='tutorial-link' data-voce='Plancia di Gioco'>Plancia di Gioco</span>. Ciò significa che quelle parole sono in realtà dei <strong>link</strong>, e premere su di esse vi rimanderà alla voce del Tutorial corrispondente, qualora ne abbiate bisogno. Potete provare subito se volete.",
    },
    postAzione: () => avviaTutorialFase(5),
  },
  5: {
    popup: {
      titolo: "",
      messaggio:
        "Facile, no?! Bene, ora che sapete come sfatare in qualsiasi momento i vostri dubbi riguardo il Regolamento del Gioco, immagino vi starete chiedendo: 'Va bene, sì, ma cosa bisogna fare, esattamente?!'. Ottima domanda! Andiamo a scoprirlo!",
    },
    postAzione: () => avviaTutorialFase(6),
  },
  6: {
    voceTutorial: "Scopo del Gioco",
    postAzione: () => avviaTutorialFase(7),
  },
  7: {
    popup: {
      titolo: "Setup aggiuntivo",
      messaggio:
        "All'inizio di ogni partita, a seconda dello Scenario che state giocando, il gioco vi richiederà di effettuare alcuni passaggi ulteriori per completare il setup iniziale. Questi riguardano il piazzamento di carte <span class='tutorial-link' data-voce='Sbarramenti'>Sbarramento</span> come porte e finestre in determinate posizioni, aggiungere o sottrarre carte specifiche dal <span class='tutorial-link' data-voce='Mazzo Ricerca'>Mazzo Ricerca</span>, o altro. Vi basterà seguire le istruzioni come indicato. Una volta completata questa fase di setup iniziale, la Carta Luogo di partenza verrà esplorata in automatico, iniziando ad immergervi nell'ambientazione.",
    },
    ritardoMs: 500,
    postAzione: () =>
      eseguiSetupStrutture(0, () => {
        eseguiSetupPng();
        mostraIntroAmbientale(() => avviaTutorialFase(8));
      }),
  },
  8: {
    popup: {
      titolo: "Esplorazione del luogo di partenza",
      messaggio:
        "Una volta terminato il setup iniziale, il gioco procederà <span class='tutorial-link' data-voce='Esplorazione'>Esplorando</span> in automatico le <span class='tutorial-link' data-voce='Carte Luogo'>Carte Luogo</span> di partenza. Fate altrettanto sulla <span class='tutorial-link' data-voce='Plancia di Gioco'>Plancia di Gioco</span> reale di fronte a voi (una <span class='tutorial-link' data-voce='Carte Luogo'>Carta Luogo</span> <span class='tutorial-link' data-voce='Esplorazione'>Esplorata</span> va girata a faccia in su).",
    },
    postAzione: () => setupIniziale("exploraIniziale"),
  },
  9: {
    popup: {
      titolo: "Cominciamo!",
      messaggio:
        "Ora che tutto è pronto, il gioco ha inizio! Ogni partita, a prescindere dallo Scenario, inizia con la...",
    },
    postAzione: () => {
      mostraMessaggioFase();
      aggiornaIndicatoreFase();
      setTimeout(() => avviaTutorialFase(10), 3000);
    },
  },
  10: {
    voceTutorial: "Fase Giocatori",
    postAzione: () => avviaTutorialFase(11),
  },
  11: {
    voceTutorial: "Ordine dei Turni",
    postAzione: () => avviaTutorialFase(12),
  },
  12: {
    voceTutorial: "Turno di Gioco",
    postAzione: () => {
      const ancoraDaAgire = gameData.personaggi.filter(
        (pg) => !gameData.turniCompletati.includes(pg)
      );
      mostraMenuTurniGiocatori(ancoraDaAgire);
    },
  },
  13: {
    voceTutorial: "Movimento",
    postAzione: () => avviaTutorialFase(11),
  },
};

// 🔹 Esegue un passo del tutorial guidato: mostra la spiegazione (popup o
// voce del Tutorial) e SOLO alla sua chiusura esegue postAzione — oppure,
// se il giocatore ha scelto di saltare le spiegazioni, esegue subito
// postAzione senza mostrare nulla. Un solo elenco di passi, un solo punto
// da aggiornare se in futuro cambia qualcosa nel tutorial.
function avviaTutorialFase(passo) {
  passoTutorial = passo;

  const def = passiTutorial[passo];
  if (!def) return;

  if (gameData.saltaSpiegazioniTutorial) {
    def.postAzione();
    return;
  }

  if (typeof def.preAzione === "function") def.preAzione();

  if (def.voceTutorial) {
    mostraVoceTutorial(def.voceTutorial, def.postAzione);
    return;
  }

  mostraPopupGenerico({
    titolo: def.popup.titolo,
    messaggio: def.popup.messaggio,
    pulsanti: [
      {
        testo: "Chiudi",
        azione: () => {
          if (typeof def.suChiusura === "function") def.suChiusura();
          chiudiPopup();
          if (def.ritardoMs) {
            setTimeout(def.postAzione, def.ritardoMs);
          } else {
            def.postAzione();
          }
        },
      },
    ],
  });
}

function gestisciFrecciaTutorial(mostra, posizione) {
  let freccia = document.getElementById("frecciaTutorial");

  if (mostra) {
    if (!freccia) {
      freccia = document.createElement("div");
      freccia.id = "frecciaTutorial";
      freccia.style.position = "fixed";
      freccia.style.fontSize = "3rem";
      freccia.style.zIndex = "10000";
      freccia.style.animation = "bounce 1.5s infinite";
      document.body.appendChild(freccia);
    }

    // Posiziona in base al target
    if (posizione === "top-center") {
      freccia.innerHTML = "⬇️"; // verso il basso
      const counter = document.getElementById("turnCounter");
      const rect = counter.getBoundingClientRect();
      freccia.style.left = `${rect.left + rect.width / 2 - 20}px`;
      freccia.style.top = `${rect.bottom + 5}px`;
    } else if (posizione === "top-left") {
      freccia.innerHTML = "⬇️"; // verso il basso
      const btn = document.getElementById("gcBtnObiettivi");
      const rect = btn.getBoundingClientRect();
      freccia.style.left = `${rect.left + rect.width / 2 - 20}px`;
      freccia.style.top = `${rect.bottom + 5}px`;
    } else if (posizione === "bottom-left") {
      freccia.innerHTML = "⬆️"; // verso l'alto
      const btn = document.getElementById("gcBtnTutorial");
      const rect = btn.getBoundingClientRect();
      freccia.style.left = `${rect.left + rect.width / 2 - 20}px`;
      freccia.style.top = `${rect.top - 30}px`;
    }

    freccia.style.display = "block";
  } else if (freccia) {
    freccia.style.display = "none";
  }
}

function scegliCasuali(arr, quanti) {
  const copia = [...arr];
  const risultato = [];
  while (risultato.length < quanti && copia.length > 0) {
    const i = Math.floor(Math.random() * copia.length);
    risultato.push(copia.splice(i, 1)[0]);
  }
  return risultato;
}

function mostraPopupGenerico({
  titolo = "",
  messaggio = "",
  pulsanti = [],
  chiudiAltri = false, // ⬅️ default: NON chiudere gli altri popup
} = {}) {
  // Opzionalmente chiudi altri popup (solo se esplicitamente richiesto)
  if (chiudiAltri) {
    document.querySelectorAll(".popup").forEach((p) => {
      // usa la tua chiusura animata
      chiudiPopupSelettivo(p);
    });
  }

  // Crea il popup corrente e tieni un riferimento locale
  const popup = document.createElement("div");
  popup.classList.add("popup");

  popup.innerHTML = `
    <div class="popup-content">
      <h2>${titolo}</h2>
      <p>${messaggio}</p>
      <div class="popup-buttons"></div>
    </div>
  `;

  const contenitoreBottoni = popup.querySelector(".popup-buttons");

  // Se non ci sono pulsanti, crea un "Chiudi" di default che chiude SOLO questo popup
  if (!pulsanti || pulsanti.length === 0) {
    pulsanti = [
      {
        testo: "Chiudi",
        azione: () => {
          chiudiPopupSelettivo(popup);
        },
      },
    ];
  }

  // Genera pulsanti
  pulsanti.forEach((cfg) => {
    const button = document.createElement("button");
    button.textContent = cfg.testo || "OK";
    button.onclick = (e) => {
      e.stopPropagation();
      // Passiamo sia il bottone sia il riferimento al popup corrente
      if (typeof cfg.azione === "function") {
        // Extra argomento "popup" è sicuro: in JS gli argomenti extra vengono ignorati
        cfg.azione(button, popup);
      }
    };
    contenitoreBottoni.appendChild(button);
  });

  document.body.appendChild(popup);
}

function costruisciMappaNavigabile() {
  const mappa = {};

  // 1️⃣ Inserisci ogni carta luogo nella mappa
  for (const carta of gameData.tabelloneAttivo) {
    if (!carta.posizione) continue;

    const chiave = `${carta.posizione.x},${carta.posizione.y}`;
    mappa[chiave] = {
      codice: carta.codice,
      x: carta.posizione.x,
      y: carta.posizione.y,
      piano: carta.piano, // 🔹 aggiunto per chiarezza
      esplorata: carta.esplorata,
      accessibile: carta.accessibile,
      scale: carta.scale || "no", // "no", "su", "giu", "suegiu"
      vicini: [],
    };
  }

  // 2️⃣ Collega i vicini orizzontali sullo stesso piano
  for (const chiave in mappa) {
    const nodo = mappa[chiave];

    const adiacenti = [
      [nodo.x + 1, nodo.y], // destra
      [nodo.x - 1, nodo.y], // sinistra
    ];

    for (const [nx, ny] of adiacenti) {
      const chiaveVicino = `${nx},${ny}`;
      const vicino = mappa[chiaveVicino];
      if (!vicino) continue;

      // Stesso piano → sempre collegabile se accessibile
      nodo.vicini.push(vicino);
    }
  }

  // 3️⃣ Collega i vicini verticali tra piani usando le scale
  // (stesso trucco del punto 2️⃣: cerchiamo direttamente la chiave del piano sopra/sotto,
  // invece di confrontare ogni stanza con tutte le altre)
  for (const chiave in mappa) {
    const nodo = mappa[chiave];

    const pianiAdiacenti = [
      [nodo.x, nodo.y - 1], // piano sopra
      [nodo.x, nodo.y + 1], // piano sotto
    ];

    for (const [nx, ny] of pianiAdiacenti) {
      const vicino = mappa[`${nx},${ny}`];
      if (!vicino) continue;

      const suOkNodo = nodo.scale === "su" || nodo.scale === "suegiu";
      const giuOkNodo = nodo.scale === "giu" || nodo.scale === "suegiu";
      const suOkVicino = vicino.scale === "su" || vicino.scale === "suegiu";
      const giuOkVicino = vicino.scale === "giu" || vicino.scale === "suegiu";

      // Se nodo è sotto e vicino sopra
      if (nodo.y > vicino.y && suOkNodo && giuOkVicino) {
        nodo.vicini.push(vicino);
        console.log(
          `⬆️ Collegamento verticale creato: ${nodo.codice} ⬌ ${vicino.codice}`
        );
      }

      // Se nodo è sopra e vicino sotto
      if (nodo.y < vicino.y && giuOkNodo && suOkVicino) {
        nodo.vicini.push(vicino);
        console.log(
          `⬇️ Collegamento verticale creato: ${nodo.codice} ⬌ ${vicino.codice}`
        );
      }
    }
  }

  // 4️⃣ Controllo ostacoli (sbarramenti) - valido per collegamenti orizzontali e verticali
  for (const chiave in mappa) {
    const nodo = mappa[chiave];
    nodo.vicini = nodo.vicini.filter((vicino) => {
      const cartaA = gameData.tabelloneAttivo.find(
        (c) => c.codice === nodo.codice
      );
      const cartaB = gameData.tabelloneAttivo.find(
        (c) => c.codice === vicino.codice
      );

      const bloccoPresente = gameData.tabelloneStrutture?.some((struttura) => {
        if (struttura.tipo !== "sbarramento") return false;

        // 🔎 Se nel catalogo la struttura è marcata NON bloccante -> ignora
        const def = (gameData.catalogoStrutture || []).find(
          (s) => s.codice === struttura.codiceCarta || s.nome === struttura.nome
        );

        // default prudente: bloccante = true
        let isBlocking = true;
        if (def && Object.prototype.hasOwnProperty.call(def, "bloccante")) {
          if (typeof def.bloccante === "boolean") {
            isBlocking = def.bloccante;
          } else if (typeof def.bloccante === "string") {
            // normalizza "sì"/"si"/"no" (togli eventuale accento)
            const v = def.bloccante.trim().toLowerCase().replace("ì", "i");
            isBlocking = v !== "no";
          }
        }

        if (!isBlocking) {
          // Questo sbarramento non ostacola → salta (non contribuisce al blocco)
          return false;
        }

        // 🔎 Se lo sbarramento bloccante non è ancora stato scoperto dai giocatori,
        // non lo consideriamo qui: verrà scoperto (e, se necessario, fermerà il
        // personaggio) durante il movimento passo-passo, non prima.
        if (struttura.visibile !== true) {
          return false;
        }

        // geometria del midpoint tra cartaA e cartaB
        const pos = struttura.posizione;
        const ax = cartaA.posizione.x;
        const ay = cartaA.posizione.y;
        const bx = cartaB.posizione.x;
        const by = cartaB.posizione.y;

        const traX =
          Math.abs(pos.x - (ax + bx) / 2) < 0.01 && pos.y === ay && ay === by;

        const traY =
          Math.abs(pos.y - (ay + by) / 2) < 0.01 && pos.x === ax && ax === bx;

        return traX || traY;
      });

      if (bloccoPresente) {
        console.warn(
          `🚫 Sbarramento blocca collegamento: ${nodo.codice} ⬌ ${vicino.codice}`
        );
      }

      return !bloccoPresente;
    });
  }

  return mappa;
}

function costruisciMappaNavigabileIgnorandoSbarramenti() {
  const mappa = {};

  // Inserisci ogni carta nella mappa
  for (const carta of gameData.tabelloneAttivo) {
    if (!carta.posizione) continue;

    const chiave = `${carta.posizione.x},${carta.posizione.y}`;
    mappa[chiave] = {
      codice: carta.codice,
      x: carta.posizione.x,
      y: carta.posizione.y,
      esplorata: carta.esplorata,
      accessibile: carta.accessibile,
      scale: carta.scale || "no",
      vicini: [],
    };
  }

  // Collega i vicini senza filtrare per sbarramenti
  for (const chiave in mappa) {
    const nodo = mappa[chiave];

    const adiacenti = [
      [nodo.x + 1, nodo.y],
      [nodo.x - 1, nodo.y],
      [nodo.x, nodo.y + 1],
      [nodo.x, nodo.y - 1],
    ];

    for (const [nx, ny] of adiacenti) {
      const chiaveVicino = `${nx},${ny}`;
      const vicino = mappa[chiaveVicino];
      if (!vicino) continue;

      const deltaY = ny - nodo.y;
      let collegamentoConsentito = false;

      if (deltaY === 0) {
        collegamentoConsentito = true; // stesso piano
      } else if (deltaY === 1) {
        collegamentoConsentito =
          (nodo.scale === "giu" || nodo.scale === "suegiu") &&
          (vicino.scale === "su" || vicino.scale === "suegiu");
      } else if (deltaY === -1) {
        collegamentoConsentito =
          (nodo.scale === "su" || nodo.scale === "suegiu") &&
          (vicino.scale === "giu" || vicino.scale === "suegiu");
      }

      if (collegamentoConsentito) {
        nodo.vicini.push(vicino);
      }
    }
  }

  return mappa;
}

function calcolaPercorso(codiceInizio, codiceFine, mappaEsistente = null) {
  const mappa = mappaEsistente || costruisciMappaNavigabile();
  const start = Object.values(mappa).find((n) => n.codice === codiceInizio);
  const end = Object.values(mappa).find((n) => n.codice === codiceFine);

  if (!start || !end) return [];

  const coda = [{ nodo: start, percorso: [start] }];
  const visitati = new Set();

  while (coda.length > 0) {
    const { nodo, percorso } = coda.shift();
    const chiave = `${nodo.x},${nodo.y}`;
    if (visitati.has(chiave)) continue;
    visitati.add(chiave);

    if (nodo.codice === codiceFine) {
      return percorso.map((p) => p.codice);
    }

    for (const vicino of nodo.vicini) {
      coda.push({ nodo: vicino, percorso: [...percorso, vicino] });
    }
  }

  return []; // Nessun percorso trovato
}

function muoviPersonaggioConAnimazione(
  nomePersonaggio,
  percorso,
  opzioni = {}
) {
  const {
    effetto = "lineare",
    durataStepMs = 400,
    onComplete,
    autoEsplora = true,
  } = opzioni;

  // 👹 Solo i personaggi dei giocatori possono "esplorare" un luogo. Le
  // minacce non lo fanno mai — né quando compaiono sul tabellone (vedi
  // creaMinaccia, che non tocca affatto lo stato "esplorata"), né quando
  // si muoveranno in futuro: qui blocchiamo comunque esplicitamente
  // l'auto-esplorazione per qualunque personaggio che risulti una minaccia,
  // a prescindere da cosa passa il chiamante.
  const eMinaccia = (gameData.minacceAttive || []).some(
    (m) => m.id === nomePersonaggio
  );
  const autoEsploraEffettivo = eMinaccia ? false : autoEsplora;

  const container = document.getElementById("grigliaPersonaggi");
  if (!container) return;

  // chiudi eventuale “ventaglio” (evita offset residui)
  if (typeof collassaSpreadPG === "function") collassaSpreadPG();

  // trova la card (prima per data-pg, poi fallback su testo)
  let cartaPG =
    container.querySelector(
      `.carta-personaggio[data-pg="${CSS.escape(nomePersonaggio)}"]`
    ) ||
    Array.from(container.querySelectorAll(".carta-personaggio")).find(
      (el) => el.innerText.trim() === nomePersonaggio.split(" ")[0]
    );

  if (!cartaPG || !Array.isArray(percorso) || percorso.length < 2) return;

  const cellaPartenza = gameData.posizioniPersonaggi[nomePersonaggio];

  // 🧠 Intelligenza >= 3: "apprendimento" della velocità di movimento —
  // prima di animare, guardo l'intero percorso e registro, per ogni
  // minaccia che può vederlo, quante celle la vittima percorre PRIMA di
  // sparire dalla sua linea di vista (mai un valore più basso di uno già
  // appreso in precedenza).
  if (typeof registraMovimentoOsservato === "function") {
    registraMovimentoOsservato(nomePersonaggio, percorso);
  }

  // 1) Posiziona subito alla cella di partenza SENZA transizione
  const startCoords =
    typeof getCoordinateCarta === "function"
      ? getCoordinateCarta(cellaPartenza)
      : null;

  // assicurati del template transform a variabili (inline)
  cartaPG.style.transform =
    "translate(var(--offsetX), var(--offsetY)) translate(var(--spreadX), var(--spreadY)) translateY(var(--jumpY))";

  const prevTransition = cartaPG.style.transition;
  cartaPG.style.transition = "none";
  if (startCoords) {
    cartaPG.style.left = startCoords.x + "px";
    cartaPG.style.top = startCoords.y + "px";
  }
  // NON toccare transform: manteniamo gli offset via variabili
  void cartaPG.offsetWidth; // reflow

  // 2) Imposta transizione base (includo transform: le var CSS animeranno il centro)
  const stepSec = Math.max(0, Number(durataStepMs) || 400) / 1000;
  cartaPG.style.transition = `left ${stepSec}s ease, top ${stepSec}s ease, transform ${stepSec}s ease`;

  // 3) Stato "in movimento" e riassetto cella di partenza
  cartaPG.classList.add("in-movimento");
  if (typeof aggiornaPersonaggiNelleCelle === "function") {
    aggiornaPersonaggiNelleCelle([cellaPartenza], nomePersonaggio);
  }

  // centro desiderato durante l’atterraggio
  const CENTER_X = 30; // regola 27–29 se vuoi
  const CENTER_Y = -40;

  let i = 1;

  function spostaStep() {
    if (i >= percorso.length) {
      const cellaArrivo = percorso[percorso.length - 1];

      // Aggiorna stato logico
      gameData.posizioniPersonaggi[nomePersonaggio] = cellaArrivo;
      cartaPG.dataset.cella = cellaArrivo;

      // 👹 Il movimento di chiunque può cambiare cosa vede una minaccia
      if (typeof aggiornaPercezioneTutteLeMinacce === "function") {
        aggiornaPercezioneTutteLeMinacce();
      }

      // Rimuove stato "in movimento"
      cartaPG.classList.remove("in-movimento");

      // Aggiorna solo la cella di arrivo
      if (typeof aggiornaPersonaggiNelleCelle === "function") {
        aggiornaPersonaggiNelleCelle([cellaArrivo]);
      }

      // ➕ Esplora automaticamente la carta, se non ancora esplorata
      // (disattivabile con autoEsplora: false, quando chi chiama vuole
      // decidere lui quando esplorare — es. dopo aver rivelato sbarramenti)
      const cartaArrivo = gameData.tabelloneAttivo.find(
        (c) => c.codice === cellaArrivo
      );
      if (autoEsploraEffettivo && cartaArrivo && !cartaArrivo.esplorata) {
        completaEsplorazione(cartaArrivo);
      }

      if (typeof onComplete === "function") onComplete(cellaArrivo);

      return;
    }

    const cellaTarget = percorso[i];

    // 👹 Aggiorno la posizione logica ad OGNI passo intermedio (non solo
    // all'arrivo finale), altrimenti una minaccia non registra mai le
    // celle realmente attraversate lungo il percorso — solo partenza e
    // destinazione finale.
    gameData.posizioniPersonaggi[nomePersonaggio] = cellaTarget;
    cartaPG.dataset.cella = cellaTarget;
    if (typeof aggiornaPercezioneTutteLeMinacce === "function") {
      aggiornaPercezioneTutteLeMinacce();
    }

    const coords =
      typeof getCoordinateCarta === "function"
        ? getCoordinateCarta(cellaTarget)
        : null;

    if (coords) {
      if (effetto === "scavalcamento") {
        // Effetto “salto” in 2 fasi + centratura offset al touchdown
        const computed = getComputedStyle(cartaPG);
        const currentTop = parseFloat(computed.top) || 0;

        const upMs = Math.max(
          120,
          Math.min(250, Math.round(durataStepMs * 0.35))
        );
        const downMs = Math.max(120, durataStepMs - upMs);

        // Fase 1: salita
        cartaPG.style.transition = `top ${upMs / 1000}s ease-out`;
        cartaPG.style.top = currentTop - 40 + "px";

        // Fase 2: discesa + orizzontale + centratura offset
        setTimeout(() => {
          cartaPG.style.transition = `left ${downMs / 1000}s ease, top ${
            downMs / 1000
          }s ease-in, transform ${downMs / 1000}s ease`;
          // porta gli offset al centro PRIMA di atterrare
          cartaPG.style.setProperty("--spreadX", "0px");
          cartaPG.style.setProperty("--spreadY", "0px");
          cartaPG.style.setProperty("--offsetX", `${CENTER_X}px`);
          cartaPG.style.setProperty("--offsetY", `${CENTER_Y}px`);

          cartaPG.style.left = coords.x + "px";
          cartaPG.style.top = coords.y + "px";
        }, upMs);
      } else {
        // Movimento lineare: muovi + centra offset nella stessa transizione
        cartaPG.style.setProperty("--spreadX", "0px");
        cartaPG.style.setProperty("--spreadY", "0px");
        cartaPG.style.setProperty("--offsetX", `${CENTER_X}px`);
        cartaPG.style.setProperty("--offsetY", `${CENTER_Y}px`);

        cartaPG.style.left = coords.x + "px";
        cartaPG.style.top = coords.y + "px";
      }
    }

    i++;
    setTimeout(spostaStep, durataStepMs);
  }

  spostaStep();
}

// 🔹 Fabbrica generica dei PNG: crea "alla bisogna" un personaggio non
// giocante e lo piazza sul tabellone. Riusa TUTTO il sistema già esistente
// per i giocatori (posizione, movimento, disegno delle carte) invece di
// duplicarlo: un PNG è, ai fini di questi sistemi, un "personaggio" come un
// altro, distinto solo dalla presenza in gameData.pngAttivi.
//
// definizioneOCodice: il codice di un modello in gameData.catalogoPng,
//   oppure un oggetto di definizione completo (stesso schema del catalogo).
// codiceCartaIniziale: la carta luogo in cui il PNG compare.
// opts: sovrascritture opzionali (id, nome, immagine, movimento,
//   comportamentoMovimento, interazioniExtra, dialoghi, inventario, stato).
function creaPng(definizioneOCodice, codiceCartaIniziale, opts = {}) {
  const definizione =
    typeof definizioneOCodice === "string"
      ? (gameData.catalogoPng || []).find(
          (p) => p.codice === definizioneOCodice
        )
      : definizioneOCodice;

  if (!definizione) {
    console.warn("[creaPng] Definizione PNG non trovata:", definizioneOCodice);
    return null;
  }
  if (!codiceCartaIniziale) {
    console.warn("[creaPng] Manca la carta luogo iniziale per il PNG.");
    return null;
  }

  gameData.pngAttivi = gameData.pngAttivi || [];
  gameData.posizioniPersonaggi = gameData.posizioniPersonaggi || {};
  gameData.movimentoAttuale = gameData.movimentoAttuale || {};

  const id =
    opts.id ||
    `PNG_${definizione.codice || definizione.nome}_${
      gameData.pngAttivi.length + 1
    }`;

  const istanza = {
    id,
    codice: definizione.codice || null,
    nome: opts.nome || definizione.nome,
    immagine: opts.immagine || definizione.immagine || "",
    // 🔹 Se falso, il PNG esiste nei dati ma non compare finché la sua
    // stanza non viene esplorata (stesso principio degli sbarramenti).
    visibile: opts.visibile !== false,
    messaggioApparizione:
      opts.messaggioApparizione || definizione.messaggioApparizione || "",
    nodoDialogoIniziale:
      opts.nodoDialogoIniziale || definizione.nodoDialogoIniziale || null,
    comportamentoMovimento:
      opts.comportamentoMovimento ||
      definizione.comportamentoMovimento ||
      "fermo",
    // 🔹 Interazioni extra oltre alle 4 fisse (Parla/Dai oggetto/Usa oggetto/
    // Ruba): aggiungibili qui in creazione, o spinte a runtime dagli eventi
    // (istanza.interazioniExtra.push({...})).
    interazioniExtra: definizione.interazioniExtra
      ? [...definizione.interazioniExtra]
      : [],
    dialoghi: definizione.dialoghi || {},
    inventario: opts.inventario || [],
    stato: opts.stato || {},
  };

  gameData.pngAttivi.push(istanza);
  gameData.posizioniPersonaggi[id] = codiceCartaIniziale;
  gameData.movimentoAttuale[id] = opts.movimento ?? definizione.movimento ?? 0;

  if (istanza.visibile) {
    aggiornaPersonaggiNelleCelle([codiceCartaIniziale]);
  }

  return istanza;
}

// ============================
// 📌 MINACCE (antagonisti: mostri, creature, animali, assassini...)
// ============================
// Stesso principio dei PNG (istanza leggera, posizione condivisa in
// gameData.posizioniPersonaggi), ma con una logica di comportamento base
// propria: percezione/linea di vista, che sarà la base per farle muovere
// in autonomia durante la fase minacce (non ancora implementato).

// definizioneOCodice: il codice di un modello in gameData.catalogoMinacce,
//   oppure un oggetto di definizione completo (stesso schema del catalogo).
// codiceCartaIniziale: la carta luogo in cui la minaccia compare.
function creaMinaccia(definizioneOCodice, codiceCartaIniziale, opts = {}) {
  const definizione =
    typeof definizioneOCodice === "string"
      ? (gameData.catalogoMinacce || []).find(
          (m) => m.codice === definizioneOCodice
        )
      : definizioneOCodice;

  if (!definizione) {
    console.warn(
      "[creaMinaccia] Definizione minaccia non trovata:",
      definizioneOCodice
    );
    return null;
  }
  if (!codiceCartaIniziale) {
    console.warn("[creaMinaccia] Manca la carta luogo iniziale per la minaccia.");
    return null;
  }

  gameData.minacceAttive = gameData.minacceAttive || [];
  gameData.posizioniPersonaggi = gameData.posizioniPersonaggi || {};

  const id =
    opts.id ||
    `MIN_${definizione.codice || definizione.nome}_${
      gameData.minacceAttive.length + 1
    }`;

  const istanza = {
    id,
    codice: definizione.codice || null,
    nome: opts.nome || definizione.nome,
    // Punteggi caratteristica di base — differiscono da minaccia a minaccia
    movimento: opts.movimento ?? definizione.movimento ?? 0,
    intelligenza: opts.intelligenza ?? definizione.intelligenza ?? 0,
    tempra: opts.tempra ?? definizione.tempra ?? 0,
    forza: opts.forza ?? definizione.forza ?? 0,
    agilita: opts.agilita ?? definizione.agilita ?? 0,
    visibile: opts.visibile !== false,
    // Memoria per vittima: { [idVittima]: { vista, ultimaPosizioneNota, motivoScomparsa } }
    memoriaVittime: {},
    // Log dei rumori percepiti: [{ luogo, valore, descrizione }, ...]
    memoriaRumori: [],
  };

  gameData.minacceAttive.push(istanza);
  gameData.posizioniPersonaggi[id] = codiceCartaIniziale;

  // 👹 Il piazzamento NON esplora il luogo: solo i PG possono farlo
  // (nessuna chiamata a completaEsplorazione qui, intenzionalmente).
  if (istanza.visibile) {
    aggiornaPersonaggiNelleCelle([codiceCartaIniziale]);
  }

  return istanza;
}

// Costruisce l'insieme dei luoghi visibili da una carta, propagandosi solo
// orizzontalmente sullo STESSO piano di gioco (stessa riga), mai tramite
// scale — la vista, a differenza del movimento, non "sale" i piani.
function calcolaLineaDiVista(codiceCartaPartenza) {
  const visibili = new Set();
  if (!codiceCartaPartenza) return visibili;

  const daVisitare = [codiceCartaPartenza];
  visibili.add(codiceCartaPartenza);

  while (daVisitare.length > 0) {
    const codiceAttuale = daVisitare.pop();
    const cartaAttuale = gameData.tabelloneAttivo.find(
      (c) => c.codice === codiceAttuale
    );
    if (!cartaAttuale || !cartaAttuale.posizione) continue;

    const vicini = [
      gameData.tabelloneAttivo.find(
        (c) =>
          c.posizione?.x === cartaAttuale.posizione.x + 1 &&
          c.posizione?.y === cartaAttuale.posizione.y
      ),
      gameData.tabelloneAttivo.find(
        (c) =>
          c.posizione?.x === cartaAttuale.posizione.x - 1 &&
          c.posizione?.y === cartaAttuale.posizione.y
      ),
    ];

    for (const vicino of vicini) {
      if (!vicino || visibili.has(vicino.codice)) continue;
      if (bloccaVistaTraCarte(cartaAttuale, vicino)) continue;
      visibili.add(vicino.codice);
      daVisitare.push(vicino.codice);
    }
  }

  return visibili;
}

// Vero se tra due carte adiacenti c'è uno sbarramento che blocca la vista
// (porta chiusa/chiusa a chiave/sbarrata, macerie...). A differenza della
// navigazione dei PG, qui conta lo stato REALE della struttura, anche se i
// giocatori non l'hanno ancora scoperta: una minaccia "sa" cosa c'è per
// davvero. "Sbarre" e "Cancello Chiuso" bloccano il passaggio ma NON la
// vista (dichiarato esplicitamente nel catalogo con bloccaVista:false).
function bloccaVistaTraCarte(cartaA, cartaB) {
  if (!cartaA.posizione || !cartaB.posizione) return false;

  return (gameData.tabelloneStrutture || []).some((struttura) => {
    if (struttura.tipo !== "sbarramento") return false;

    const def = (gameData.catalogoStrutture || []).find(
      (s) => s.codice === struttura.codiceCarta || s.nome === struttura.nome
    );
    if (!def) return false;

    let bloccaVista;
    if (Object.prototype.hasOwnProperty.call(def, "bloccaVista")) {
      bloccaVista = def.bloccaVista !== false;
    } else if (Object.prototype.hasOwnProperty.call(def, "bloccante")) {
      bloccaVista =
        typeof def.bloccante === "boolean"
          ? def.bloccante
          : String(def.bloccante).trim().toLowerCase().replace("ì", "i") !==
            "no";
    } else {
      bloccaVista = true; // default prudente
    }
    if (!bloccaVista) return false;

    const pos = struttura.posizione;
    const ax = cartaA.posizione.x,
      ay = cartaA.posizione.y;
    const bx = cartaB.posizione.x,
      by = cartaB.posizione.y;

    const traX =
      Math.abs(pos.x - (ax + bx) / 2) < 0.01 && pos.y === ay && ay === by;
    const traY =
      Math.abs(pos.y - (ay + by) / 2) < 0.01 && pos.x === ax && ax === bx;

    return traX || traY;
  });
}

// Elenco di tutte le "potenziali vittime" attualmente in gioco: i
// personaggi dei giocatori e i PNG già rivelati.
// ============================
// 📌 SALUTE (fondamenta minime — il sistema vero e proprio, con danni ed
// effetti, verrà definito più avanti; per ora basta poter interrogare lo
// stato di un personaggio/PNG, così le minacce possano già memorizzarlo).
// ============================
// gameData.puntiSalute[id] = { attuali, massimi }. Se un personaggio non è
// ancora tracciato, si presume a Salute Piena (nessun danno subito finora).
const SALUTE_MASSIMA_DEFAULT = 10;

function puntiSaluteDi(id) {
  gameData.puntiSalute = gameData.puntiSalute || {};
  if (!gameData.puntiSalute[id]) {
    gameData.puntiSalute[id] = {
      attuali: SALUTE_MASSIMA_DEFAULT,
      massimi: SALUTE_MASSIMA_DEFAULT,
    };
  }
  return gameData.puntiSalute[id];
}

// "Salute Piena" | "Ferito" | "Gravemente Ferito" | "Morto"
function calcolaStatoSalute(attuali, massimi) {
  if (attuali <= 0) return "Morto";
  if (attuali < massimi / 2) return "Gravemente Ferito";
  if (attuali < massimi) return "Ferito";
  return "Salute Piena";
}

function statoSaluteDiVittima(id) {
  const { attuali, massimi } = puntiSaluteDi(id);
  return calcolaStatoSalute(attuali, massimi);
}

function elencoPotenzialiVittime() {
  const pg = gameData.personaggi || [];
  const png = (gameData.pngAttivi || [])
    .filter((p) => p.visibile !== false)
    .map((p) => p.id);
  return [...pg, ...png];
}

// Genere di un PG o PNG ("maschio"|"femmina"), o null se non determinabile.
// PG: cercato per nome tra gli eroi disponibili. PNG: cercato tra le
// istanze attive, poi nel relativo catalogo.
function genereDiVittima(idVittima) {
  const eroe = (gameData.eroiDisponibili || []).find(
    (e) => e.nome === idVittima
  );
  if (eroe?.genere) return eroe.genere;

  const istanzaPng = (gameData.pngAttivi || []).find((p) => p.id === idVittima);
  if (istanzaPng) {
    const def = (gameData.catalogoPng || []).find(
      (d) => d.nome === istanzaPng.nome || d.codice === istanzaPng.codice
    );
    if (def?.genere) return def.genere;
  }

  return null;
}

// Aggiorna la memoria di una minaccia confrontando chi vede ORA con chi
// vedeva l'ultima volta che è stata interrogata: registra il momento esatto
// in cui una vittima esce dalla linea di vista (posizione + motivo), senza
// più toccare quella memoria finché non torna visibile.
function aggiornaPercezioneMinaccia(minaccia) {
  const codiceCartaMinaccia = gameData.posizioniPersonaggi[minaccia.id];
  const visibili = calcolaLineaDiVista(codiceCartaMinaccia);
  minaccia.memoriaVittime = minaccia.memoriaVittime || {};

  elencoPotenzialiVittime().forEach((idVittima) => {
    const cellaAttuale = gameData.posizioniPersonaggi[idVittima];
    if (!cellaAttuale) return;

    const vistaOra = visibili.has(cellaAttuale);
    const precedente = minaccia.memoriaVittime[idVittima];

    if (vistaOra) {
      minaccia.memoriaVittime[idVittima] = {
        vista: true,
        ultimaPosizioneNota: cellaAttuale,
        motivoScomparsa: null,
        // 🧠 Intelligenza >= 2: memorizza lo stato di salute, aggiornato a
        // ogni chiamata finché resta in vista (guarigioni/peggioramenti si
        // riflettono subito).
        ultimoStatoSaluteNoto:
          (minaccia.intelligenza ?? 0) >= 2
            ? statoSaluteDiVittima(idVittima)
            : precedente?.ultimoStatoSaluteNoto ?? null,
      };
      associaRumoriRecenti(minaccia, idVittima, [cellaAttuale]);
      aggiornaVittimaDesignata(minaccia, idVittima);
      return;
    }

    if (!precedente) return; // mai avvistata: nulla da registrare
    if (!precedente.vista) return; // già persa in precedenza: non ritoccare

    // Transizione vista→persa: determiniamo il motivo proprio ora
    let motivo = "sconosciuta";
    let posizioneIpotizzata = null; // solo se l'intelligenza lo consente
    let posizioniIpotizzate = null; // insieme esteso, solo intelligenza >= 3
    if (cellaAttuale === precedente.ultimaPosizioneNota) {
      motivo = "Uno sbarramento ha interrotto la linea di vista";
    } else {
      const cartaUltima = gameData.tabelloneAttivo.find(
        (c) => c.codice === precedente.ultimaPosizioneNota
      );
      const cartaAttuale = gameData.tabelloneAttivo.find(
        (c) => c.codice === cellaAttuale
      );
      if (
        cartaUltima?.posizione &&
        cartaAttuale?.posizione &&
        cartaUltima.posizione.y !== cartaAttuale.posizione.y
      ) {
        const suOkUltima = cartaUltima.scale === "su" || cartaUltima.scale === "suegiu";
        const giuOkUltima = cartaUltima.scale === "giu" || cartaUltima.scale === "suegiu";
        const suOkAttuale = cartaAttuale.scale === "su" || cartaAttuale.scale === "suegiu";
        const giuOkAttuale = cartaAttuale.scale === "giu" || cartaAttuale.scale === "suegiu";
        const viaScale =
          (cartaUltima.posizione.y > cartaAttuale.posizione.y &&
            suOkUltima &&
            giuOkAttuale) ||
          (cartaUltima.posizione.y < cartaAttuale.posizione.y &&
            giuOkUltima &&
            suOkAttuale);
        if (viaScale) {
          // y più basso = piano più in alto: se la vittima è passata a un
          // valore di y minore, ha salito le scale; altrimenti le ha scese.
          const direzione =
            cartaAttuale.posizione.y < cartaUltima.posizione.y
              ? "salito"
              : "sceso";
          motivo = `Ha ${direzione} le scale`;
          // 🧠 Intelligenza >= 1: sa dedurre dove portano le scale che ha
          // visto l'ultima volta — l'ipotesi coincide col luogo collegato,
          // che è un dato di gioco noto (la scala porta lì e basta), non un
          // "barare" leggendo la posizione reale della vittima.
          if ((minaccia.intelligenza ?? 0) >= 1) {
            posizioneIpotizzata = cellaAttuale;
          }
        } else {
          motivo = "Ha cambiato piano tramite una finestra";
          // 🧠 Intelligenza >= 2: sa che una finestra porta sempre al piano
          // terra (non assume ingenuamente "un piano sotto"), e può dedurre
          // il punto d'atterraggio esatto collegato a quella finestra.
          if ((minaccia.intelligenza ?? 0) >= 2) {
            posizioneIpotizzata = cellaAttuale;
          }
        }

        // 🧠 Intelligenza >= 3: non si ferma al punto di arrivo più
        // probabile — sa (per averlo appreso osservandola muoversi) quanto
        // può essersi allontanata, e ipotizza TUTTI i luoghi al piano
        // cambiato raggiungibili entro il movimento appreso, contando i
        // passi a partire da dove il movimento è INIZIATO (non dall'ultimo
        // luogo in cui l'ha avvistata: se prima di sparire ha già compiuto
        // altri passi in vista, quei passi vanno comunque conteggiati, o
        // l'ipotesi risulterebbe troppo generosa).
        if (posizioneIpotizzata && (minaccia.intelligenza ?? 0) >= 3) {
          const budget = minaccia.movimentoAppreso?.[idVittima] || 0;
          const origineMovimento =
            minaccia.ultimoInizioVisibile?.[idVittima] ||
            precedente.ultimaPosizioneNota;
          const distanze = calcolaLuoghiRaggiungibili(
            origineMovimento,
            Math.max(budget, 1)
          );
          const direzioneSegno = Math.sign(
            cartaAttuale.posizione.y - cartaUltima.posizione.y
          );
          const insieme = Object.keys(distanze).filter((codice) => {
            const c = gameData.tabelloneAttivo.find((x) => x.codice === codice);
            if (!c?.posizione) return false;
            if (codice === cartaAttuale.codice) return true; // punto base sempre incluso
            const segno = Math.sign(c.posizione.y - cartaUltima.posizione.y);
            return segno === direzioneSegno && segno !== 0;
          });
          posizioniIpotizzate = insieme;
        }
      }
    }

    minaccia.memoriaVittime[idVittima] = {
      vista: false,
      ultimaPosizioneNota: precedente.ultimaPosizioneNota,
      motivoScomparsa: motivo,
      posizioneIpotizzata,
      posizioniIpotizzate,
      ultimoStatoSaluteNoto: precedente.ultimoStatoSaluteNoto ?? null,
    };
    associaRumoriRecenti(
      minaccia,
      idVittima,
      posizioniIpotizzate && posizioniIpotizzate.length > 0
        ? posizioniIpotizzate
        : posizioneIpotizzata
        ? [posizioneIpotizzata]
        : [precedente.ultimaPosizioneNota]
    );
  });
}

// 🧪 Interazione di TEST: click sulla minaccia in qualsiasi momento →
// mostra un resoconto di linea di vista + memoria delle vittime.
function interagisciConMinaccia(idMinaccia) {
  const minaccia = (gameData.minacceAttive || []).find(
    (m) => m.id === idMinaccia
  );
  if (!minaccia) return;

  aggiornaPercezioneMinaccia(minaccia);

  const codiceCartaMinaccia = gameData.posizioniPersonaggi[minaccia.id];
  const visibili = calcolaLineaDiVista(codiceCartaMinaccia);
  const vittime = elencoPotenzialiVittime();

  // Solo il codice della carta (es. "A05"), niente nome esteso.
  const nomeLuogo = (codice) => codice || "--";
  // Solo il nome proprio (es. "Alice"), niente cognome.
  const nomeBreve = (id) => (id ? id.split(" ")[0] : "--");

  const righeLuoghi =
    [...visibili]
      .map((codice) => {
        const vittimeQui = vittime.filter(
          (id) => gameData.posizioniPersonaggi[id] === codice
        );
        return vittimeQui.length > 0
          ? `• ${nomeLuogo(codice)}: ${vittimeQui.map(nomeBreve).join(", ")}`
          : `• ${nomeLuogo(codice)}: nessuna vittima`;
      })
      .join("<br/>") || "nessuno";

  const righeMemoria =
    vittime
      .map((id) => {
        const m = minaccia.memoriaVittime[id];

        let posizione = "--";
        if (m?.vista) {
          posizione = `Vista in ${nomeLuogo(m.ultimaPosizioneNota)}`;
        } else if (m?.posizioniIpotizzate && m.posizioniIpotizzate.length > 0) {
          posizione = `Ipotesi: ${m.posizioniIpotizzate
            .map(nomeLuogo)
            .join(", ")}`;
        } else if (m?.posizioneIpotizzata) {
          posizione = `Ipotesi: ${nomeLuogo(m.posizioneIpotizzata)}`;
        } else if (m?.ultimaPosizioneNota) {
          posizione = `Avvistamento: ${nomeLuogo(m.ultimaPosizioneNota)}`;
        }

        // Ogni campo compare solo se l'intelligenza di QUESTA minaccia le
        // consente davvero quella capacità — niente più "no"/"--" per cose
        // che non può proprio fare.
        const campi = [`Posizione: ${posizione}`];
        if ((minaccia.intelligenza ?? 0) >= 3) {
          campi.push(`Movimento: ${minaccia.movimentoAppreso?.[id] ?? "--"}`);
        }
        if ((minaccia.intelligenza ?? 0) >= 2) {
          campi.push(`Salute: ${m?.ultimoStatoSaluteNoto || "--"}`);
        }
        if ((minaccia.intelligenza ?? 0) >= 3) {
          campi.push(`Voce: ${minaccia.vociApprese?.[id] ? "sì" : "no"}`);
        }

        return `• ${nomeBreve(id)} — ${campi.join(" | ")}`;
      })
      .join("<br/>") || "nessuna";

  const righeRumori =
    (minaccia.memoriaRumori || [])
      .map((r) => {
        const fonti =
          r.possibiliFonti && r.possibiliFonti.length > 0
            ? `; possibile fonte — ${r.possibiliFonti.map(nomeBreve).join(", ")}`
            : "";
        const genere = r.genereSospetto ? ` ${r.genereSospetto}` : "";
        const luoghi = (Array.isArray(r.luogo) ? r.luogo : [r.luogo])
          .map(nomeLuogo)
          .join(" oppure ");
        const eta = (gameData.turnoMinacceAttuale || 0) - (r.turno || 0);
        return `• ${luoghi}: potenziale vittima sconosciuta${genere} (${
          r.descrizione
        }, propagazione ${r.valore}, ${eta} fasi fa)${fonti}`;
      })
      .join("<br/>") || "nessuno";

  // La sezione "Voci riconosciute" ha senso solo per chi può riconoscere le
  // voci (intelligenza >= 3): altrimenti va omessa del tutto, non lasciata
  // vuota — altrimenti sembrerebbe una capacità che "non ha ancora usato"
  // invece che una che non possiede proprio.
  const sezioneVoci =
    (minaccia.intelligenza ?? 0) >= 3
      ? `<br/><br/><strong>Voci riconosciute:</strong><br/>${
          Object.keys(minaccia.vociApprese || {}).map(nomeBreve).join(", ") ||
          "nessuna"
        }`
      : "";

  mostraPopupGenerico({
    titolo: minaccia.nome,
    messaggio: `<strong>Intelligenza:</strong> ${minaccia.intelligenza}<br/><strong>Vittima designata:</strong> ${
      minaccia.vittimaDesignata
        ? `${nomeBreve(minaccia.vittimaDesignata)} (${
            minaccia.distanzaVittimaDesignata
          } passi)`
        : "nessuna"
    }<br/><br/><strong>Luoghi nella linea di vista:</strong><br/>${righeLuoghi}<br/><br/><strong>Memoria delle vittime:</strong><br/>${righeMemoria}<br/><br/><strong>Rumori uditi:</strong><br/>${righeRumori}${sezioneVoci}`,
    pulsanti: [
      {
        testo: "Chiudi",
        azione: (btn) => chiudiPopupSelettivo(btn.closest(".popup")),
      },
    ],
  });
}

// 🧪 Aggancio di test: piazza "Uomo con impermeabile" in un luogo casuale
// del tabellone. Da sostituire con un piazzamento autoriale/da JSON scenario
// una volta validata la logica di percezione.
// Richiama aggiornaPercezioneMinaccia() per OGNI minaccia attiva. Va
// chiamata a ogni evento che può cambiare cosa una minaccia vede: un
// personaggio/PNG che si muove, uno sbarramento che cambia stato
// (apertura/chiusura/abbattimento/rottura), un attraversamento di finestra.
function aggiornaPercezioneTutteLeMinacce() {
  (gameData.minacceAttive || []).forEach(aggiornaPercezioneMinaccia);
}

// ============================
// 📌 RUMORE (l'"udito" delle minacce)
// ============================
// Un rumore si propaga "in linea d'aria" (distanza a scacchiera: orizzontale,
// verticale E diagonale contano come 1 passo ciascuna) per un numero di
// luoghi pari al suo valore di propagazione — NON segue la rete di
// adiacenza/porte usata per la vista o il movimento, attraversa muri e piani
// per semplice vicinanza geometrica sulla griglia.
// Ogni minaccia entro il raggio registra, nella propria memoria, che nel
// luogo d'origine c'è una potenziale vittima "sconosciuta" (non ne conosce
// l'identità: l'ha solo sentita, non vista).
// ============================
// 📌 APPRENDIMENTO (intelligenza 3+): la minaccia impara quanto lontano
// può muoversi una vittima osservandola muoversi entro la propria vista.
// ============================

// Vero se un vero sbarramento bloccante (stato REALE, non quello scoperto
// dai giocatori) impedisce il movimento tra due carte adiacenti — stessa
// idea di bloccaVistaTraCarte ma sul flag "bloccante", non "bloccaVista".
function bloccaMovimentoTraCarte(cartaA, cartaB) {
  if (!cartaA.posizione || !cartaB.posizione) return false;

  return (gameData.tabelloneStrutture || []).some((struttura) => {
    if (struttura.tipo !== "sbarramento") return false;

    const def = (gameData.catalogoStrutture || []).find(
      (s) => s.codice === struttura.codiceCarta || s.nome === struttura.nome
    );
    if (!def) return false;

    let bloccante = true;
    if (Object.prototype.hasOwnProperty.call(def, "bloccante")) {
      bloccante =
        typeof def.bloccante === "boolean"
          ? def.bloccante
          : String(def.bloccante).trim().toLowerCase().replace("ì", "i") !==
            "no";
    }
    if (!bloccante) return false;

    const pos = struttura.posizione;
    const ax = cartaA.posizione.x,
      ay = cartaA.posizione.y;
    const bx = cartaB.posizione.x,
      by = cartaB.posizione.y;

    const traX =
      Math.abs(pos.x - (ax + bx) / 2) < 0.01 && pos.y === ay && ay === by;
    const traY =
      Math.abs(pos.y - (ay + by) / 2) < 0.01 && pos.x === ax && ax === bx;

    return traX || traY;
  });
}

// Tutti i luoghi raggiungibili da codicePartenza entro "budget" spostamenti
// (orizzontali sullo stesso piano + verticali via scale, come il movimento
// vero dei personaggi), rispettando gli sbarramenti REALI. Include anche il
// punto di partenza (distanza 0).
function calcolaLuoghiRaggiungibili(codicePartenza, budget) {
  const distanze = { [codicePartenza]: 0 };
  if (!codicePartenza) return distanze;

  let frontiera = [codicePartenza];

  while (frontiera.length > 0) {
    const codiceAttuale = frontiera.shift();
    const distAttuale = distanze[codiceAttuale];
    if (distAttuale >= budget) continue;

    const cartaAttuale = gameData.tabelloneAttivo.find(
      (c) => c.codice === codiceAttuale
    );
    if (!cartaAttuale || !cartaAttuale.posizione) continue;

    const candidati = (gameData.tabelloneAttivo || []).filter((c) => {
      if (!c.posizione || c.codice === codiceAttuale) return false;
      const stessaRiga =
        c.posizione.y === cartaAttuale.posizione.y &&
        Math.abs(c.posizione.x - cartaAttuale.posizione.x) === 1;
      if (stessaRiga) return true;

      const suOkA = cartaAttuale.scale === "su" || cartaAttuale.scale === "suegiu";
      const giuOkA = cartaAttuale.scale === "giu" || cartaAttuale.scale === "suegiu";
      const suOkC = c.scale === "su" || c.scale === "suegiu";
      const giuOkC = c.scale === "giu" || c.scale === "suegiu";
      return (
        (c.posizione.y === cartaAttuale.posizione.y - 1 && suOkC && giuOkA) ||
        (c.posizione.y === cartaAttuale.posizione.y + 1 && giuOkC && suOkA)
      );
    });

    candidati.forEach((c) => {
      if (distanze[c.codice] !== undefined) return;
      if (bloccaMovimentoTraCarte(cartaAttuale, c)) return;
      distanze[c.codice] = distAttuale + 1;
      frontiera.push(c.codice);
    });
  }

  return distanze; // { codiceCarta: distanza, ... }
}

// ============================
// 📌 VITTIMA DESIGNATA (logica di base, vale per qualunque minaccia a
// prescindere dall'intelligenza)
// ============================
// Ogni volta che una minaccia conosce con ESATTEZZA la posizione di una
// vittima (cioè la vede attualmente, vista:true — non una semplice
// ipotesi), valuta se designarla come bersaglio: sceglie sempre la più
// VICINA in termini di passi reali da percorrere (non in linea d'aria: la
// distanza rispetta gli sbarramenti bloccanti REALI — porte chiuse/chiuse a
// chiave/sbarrate — non solo quelli già scoperti dai giocatori). Se la
// minaccia ha già una vittima designata ma la sua posizione non è più
// esatta (non più vista:true), qualunque nuova vittima esattamente nota la
// sostituisce; altrimenti la sostituisce solo se più vicina.
function aggiornaVittimaDesignata(minaccia, idVittima) {
  const codiceCartaMinaccia = gameData.posizioniPersonaggi[minaccia.id];
  const cellaVittima = gameData.posizioniPersonaggi[idVittima];
  if (!codiceCartaMinaccia || !cellaVittima) return;

  const budgetMassimo = (gameData.tabelloneAttivo || []).length || 1;
  const distanze = calcolaLuoghiRaggiungibili(codiceCartaMinaccia, budgetMassimo);
  const distanzaNuova = distanze[cellaVittima];
  if (distanzaNuova === undefined) return; // irraggiungibile: la ignoro

  const designataAttuale = minaccia.vittimaDesignata;

  if (!designataAttuale || designataAttuale === idVittima) {
    minaccia.vittimaDesignata = idVittima;
    minaccia.distanzaVittimaDesignata = distanzaNuova;
    return;
  }

  // La designata attuale ha ancora una posizione ESATTA (vista:true ora)?
  // Se no, qualunque candidata esatta la scavalca a prescindere dalla
  // distanza (non è più un confronto equo con un dato ormai incerto).
  const memoriaDesignata = minaccia.memoriaVittime?.[designataAttuale];
  const designataAncoraEsatta = memoriaDesignata?.vista === true;

  if (
    !designataAncoraEsatta ||
    distanzaNuova < (minaccia.distanzaVittimaDesignata ?? Infinity)
  ) {
    minaccia.vittimaDesignata = idVittima;
    minaccia.distanzaVittimaDesignata = distanzaNuova;
  }
}

// Chiamata prima di animare un movimento: per ogni minaccia con
// intelligenza >= 3, trova la tratta di percorso realmente osservata (può
// iniziare in vista, "attraversare" la vista a metà, o iniziare fuori e
// concludersi in vista) e aggiorna il movimento "appreso" di conseguenza
// (mai al ribasso rispetto a un valore già registrato).
function registraMovimentoOsservato(nomePersonaggio, percorso) {
  if (!Array.isArray(percorso) || percorso.length < 2) return;
  const eVittima = elencoPotenzialiVittime().includes(nomePersonaggio);
  if (!eVittima) return;

  (gameData.minacceAttive || []).forEach((minaccia) => {
    if ((minaccia.intelligenza ?? 0) < 3) return;
    if (minaccia.id === nomePersonaggio) return;

    const codiceCartaMinaccia = gameData.posizioniPersonaggi[minaccia.id];
    const visibili = calcolaLineaDiVista(codiceCartaMinaccia);

    // Cerco TUTTE le tratte consecutive di percorso visibili alla minaccia
    // (non solo quella che parte dall'indice 0): la vittima può essere
    // entrata in vista a metà strada, magari uscendone di nuovo poco dopo.
    // Per ciascuna tratta calcolo quanti passi rappresenta davvero:
    //  - se la tratta arriva fino alla fine del percorso, il numero di
    //    passi visibili è esatto (la vediamo fermarsi);
    //  - se invece la vittima esce di vista prima della fine (per qualsiasi
    //    motivo: sbarramento, cambio piano...), ha compiuto ALMENO un
    //    passo in più per allontanarsi, quindi +1.
    let migliorPassi = 0;
    let migliorOrigine = null;
    let i = 0;
    while (i < percorso.length) {
      if (!visibili.has(percorso[i])) {
        i++;
        continue;
      }
      let j = i;
      while (j + 1 < percorso.length && visibili.has(percorso[j + 1])) j++;

      let passi = j - i; // passi interni alla tratta visibile
      const finisceInVista = j === percorso.length - 1;
      if (!finisceInVista) passi++; // almeno un passo in più per uscirne

      if (passi > migliorPassi) {
        migliorPassi = passi;
        migliorOrigine = percorso[i];
      }
      i = j + 1;
    }

    if (migliorPassi <= 0) return;

    // 📍 Il punto in cui inizia la tratta osservata (non necessariamente
    // l'inizio dell'intero percorso): serve come vera origine per
    // l'ipotesi estesa quando in futuro la vittima sparirà.
    if (migliorOrigine) {
      minaccia.ultimoInizioVisibile = minaccia.ultimoInizioVisibile || {};
      minaccia.ultimoInizioVisibile[nomePersonaggio] = migliorOrigine;
    }

    minaccia.movimentoAppreso = minaccia.movimentoAppreso || {};
    const attuale = minaccia.movimentoAppreso[nomePersonaggio] || 0;
    minaccia.movimentoAppreso[nomePersonaggio] = Math.max(
      attuale,
      migliorPassi
    );
  });
}

// 🧠 Intelligenza >= 1: quando la posizione di una vittima diventa nota
// (avvistata, ultima posizione registrata, o ipotizzata), la minaccia la
// associa retroattivamente a ogni rumore sentito di recente (entro
// FINESTRA_ASSOCIAZIONE_RUMORE fasi minaccia) in quel luogo o in uno
// adiacente — "dà per scontato" che sia stata lei, invece di lasciare il
// rumore per sempre senza un sospetto anche quando ovvio.
const FINESTRA_ASSOCIAZIONE_RUMORE = 2;

function associaRumoriRecenti(minaccia, idVittima, luoghiVittima) {
  if ((minaccia.intelligenza ?? 0) < 1) return;
  if (!Array.isArray(luoghiVittima) || luoghiVittima.length === 0) return;
  if (!minaccia.memoriaRumori || minaccia.memoriaRumori.length === 0) return;

  const carteVittima = luoghiVittima
    .map((codice) =>
      (gameData.tabelloneAttivo || []).find((c) => c.codice === codice)
    )
    .filter((c) => c?.posizione);
  if (carteVittima.length === 0) return;

  minaccia.memoriaRumori.forEach((rumore) => {
    const eta = (gameData.turnoMinacceAttuale || 0) - (rumore.turno || 0);
    if (eta > FINESTRA_ASSOCIAZIONE_RUMORE) return;

    const luoghiRumore = Array.isArray(rumore.luogo)
      ? rumore.luogo
      : [rumore.luogo];
    const carteRumore = luoghiRumore
      .map((codice) =>
        (gameData.tabelloneAttivo || []).find((c) => c.codice === codice)
      )
      .filter((c) => c?.posizione);

    const vicino = carteRumore.some((cr) =>
      carteVittima.some((cv) => {
        const ddx = Math.abs(cr.posizione.x - cv.posizione.x);
        const ddy = Math.abs(cr.posizione.y - cv.posizione.y);
        return Math.max(ddx, ddy) <= 1;
      })
    );
    if (!vicino) return;

    rumore.possibiliFonti = rumore.possibiliFonti || [];
    if (!rumore.possibiliFonti.includes(idVittima)) {
      rumore.possibiliFonti.push(idVittima);
    }
  });
}

function generaRumore(codiceCartaOrigine, valorePropagazione, opts = {}) {
  if (!codiceCartaOrigine || !valorePropagazione) return;

  const cartaOrigine = (gameData.tabelloneAttivo || []).find(
    (c) => c.codice === codiceCartaOrigine
  );
  if (!cartaOrigine || !cartaOrigine.posizione) return;

  console.log(
    `🔊 Rumore generato in ${codiceCartaOrigine} (propagazione ${valorePropagazione})${
      opts.descrizione ? " — " + opts.descrizione : ""
    }`
  );

  (gameData.minacceAttive || []).forEach((minaccia) => {
    const codiceCartaMinaccia = gameData.posizioniPersonaggi[minaccia.id];
    const cartaMinaccia = (gameData.tabelloneAttivo || []).find(
      (c) => c.codice === codiceCartaMinaccia
    );
    if (!cartaMinaccia || !cartaMinaccia.posizione) return;

    const dx = Math.abs(cartaMinaccia.posizione.x - cartaOrigine.posizione.x);
    const dy = Math.abs(cartaMinaccia.posizione.y - cartaOrigine.posizione.y);
    const distanza = Math.max(dx, dy); // "a scacchiera": diagonale = 1 passo

    if (distanza > valorePropagazione) return;

    const visibiliMinaccia = calcolaLineaDiVista(codiceCartaMinaccia);

    // 🧠 Intelligenza >= 3, solo per un urlo: impara/riconosce la voce di
    // una vittima specifica. Se la vede urlare, memorizza quella voce
    // (associandola alla sua identità). Se in seguito quella stessa
    // vittima urla mentre è fuori dalla sua linea di vista, la minaccia la
    // riconosce PERFETTAMENTE: il luogo da cui parte l'urlo diventa la sua
    // nuova ultima posizione nota con certezza, cancellando ogni ipotesi
    // precedente sul suo conto.
    if (opts.tipo === "urlo" && opts.chi && (minaccia.intelligenza ?? 0) >= 3) {
      minaccia.vociApprese = minaccia.vociApprese || {};

      if (visibiliMinaccia.has(codiceCartaOrigine)) {
        minaccia.vociApprese[opts.chi] = true;
      } else if (minaccia.vociApprese[opts.chi]) {
        minaccia.memoriaVittime = minaccia.memoriaVittime || {};
        const precedente = minaccia.memoriaVittime[opts.chi];
        minaccia.memoriaVittime[opts.chi] = {
          vista: false,
          ultimaPosizioneNota: codiceCartaOrigine,
          motivoScomparsa: "Riconosciuta dalla voce",
          posizioneIpotizzata: null,
          posizioniIpotizzate: null,
          ultimoStatoSaluteNoto: precedente?.ultimoStatoSaluteNoto ?? null,
        };
        associaRumoriRecenti(minaccia, opts.chi, [codiceCartaOrigine]);
      }
    }

    // 🔊 Se la minaccia vede esattamente il luogo d'origine, sa già con
    // certezza chi (o cosa) ha fatto rumore — non serve registrarlo come
    // "vittima sconosciuta": lo percepisce già direttamente con la vista.
    if (visibiliMinaccia.has(codiceCartaOrigine)) return;

    // Luogo/i a cui è attribuito il rumore agli occhi della minaccia. Per un
    // singolo punto (urlo, finestra rotta) è solo l'origine; per uno
    // sbarramento come una porta, che sta TRA due luoghi, chi non vede non
    // può sapere da quale dei due lati sia arrivato: sono entrambi possibili.
    const luoghiPossibili =
      Array.isArray(opts.luoghiPossibili) && opts.luoghiPossibili.length > 0
        ? opts.luoghiPossibili
        : [codiceCartaOrigine];

    // 🧠 Intelligenza >= 2: la fonte esatta resta "sconosciuta" (il rumore
    // non rivela un'identità), ma la minaccia può ipotizzare che sia stato
    // causato da una vittima che ha avvistato o di cui ha un'ipotesi di
    // posizione, se quella posizione è nelle vicinanze di uno dei luoghi
    // possibili (stessa cella, o adiacente "a scacchiera").
    let possibiliFonti = [];
    // 🧠 Intelligenza >= 2, solo per un urlo: distingue il genere dalla
    // voce — la fonte resta "sconosciuta", ma memorizza "sconosciuta
    // maschio/femmina", il che restringe le vittime candidate quando ce ne
    // sono più d'una nei paraggi.
    let genereSospetto = null;
    if ((minaccia.intelligenza ?? 0) >= 2) {
      if (opts.tipo === "urlo" && opts.chi) {
        genereSospetto = genereDiVittima(opts.chi);
      }

      const carteLuoghiPossibili = luoghiPossibili
        .map((codice) =>
          (gameData.tabelloneAttivo || []).find((c) => c.codice === codice)
        )
        .filter((c) => c?.posizione);

      possibiliFonti = Object.entries(minaccia.memoriaVittime || {})
        .filter(([idVittima, m]) => {
          const posizioneNota = m.vista
            ? m.ultimaPosizioneNota
            : m.posizioneIpotizzata || m.ultimaPosizioneNota;
          if (!posizioneNota) return false;
          const cartaVittima = (gameData.tabelloneAttivo || []).find(
            (c) => c.codice === posizioneNota
          );
          if (!cartaVittima?.posizione) return false;

          const vicinoAAlmenoUno = carteLuoghiPossibili.some((cOrig) => {
            const ddx = Math.abs(cartaVittima.posizione.x - cOrig.posizione.x);
            const ddy = Math.abs(cartaVittima.posizione.y - cOrig.posizione.y);
            return Math.max(ddx, ddy) <= 1;
          });
          if (!vicinoAAlmenoUno) return false;

          // Se conosciamo il genere della voce, escludo solo i candidati
          // il cui genere è NOTO e diverso (un genere sconosciuto non
          // esclude nessuno, non basta a scagionarlo).
          if (genereSospetto) {
            const genereCandidato = genereDiVittima(idVittima);
            if (genereCandidato && genereCandidato !== genereSospetto) {
              return false;
            }
          }
          return true;
        })
        .map(([idVittima]) => idVittima);
    }

    minaccia.memoriaRumori = minaccia.memoriaRumori || [];
    minaccia.memoriaRumori.push({
      luogo: luoghiPossibili,
      valore: valorePropagazione,
      descrizione: opts.descrizione || "Rumore",
      genereSospetto,
      possibiliFonti,
      turno: gameData.turnoMinacceAttuale || 0,
    });
  });
}

function spawnMinacciaTest() {
  const candidati = (gameData.tabelloneAttivo || []).filter((c) => c.posizione);
  if (candidati.length === 0) return;

  // Una per ciascun livello di intelligenza (0/1/2/3), per poter testare
  // tutti i comportamenti insieme. In luoghi distinti quando possibile.
  const codiciTest = ["M01", "M02", "M03", "M04"];
  const disponibili = [...candidati];

  codiciTest.forEach((codice) => {
    if (disponibili.length === 0) return;
    const idx = Math.floor(Math.random() * disponibili.length);
    const cartaCasuale = disponibili.splice(idx, 1)[0];
    creaMinaccia(codice, cartaCasuale.codice);
    console.log(`👹 Minaccia di test ${codice} piazzata in:`, cartaCasuale.codice);
  });
}

// 🔹 Muove un PNG verso una destinazione, riusando lo stesso motore di
// calcolo percorso e animazione già usato per i giocatori — nessun sistema
// di movimento parallelo. A differenza del movimento dei giocatori, non
// esplora automaticamente le carte attraversate: l'esplorazione resta
// un'iniziativa dei giocatori, non dei PNG.
function muoviPngVerso(idPng, codiceDestinazione, opts = {}) {
  const png = (gameData.pngAttivi || []).find((p) => p.id === idPng);
  if (!png) return;

  const partenza = gameData.posizioniPersonaggi[idPng];
  if (!partenza || partenza === codiceDestinazione) return;

  const percorso = calcolaPercorso(partenza, codiceDestinazione);
  if (!percorso || percorso.length < 2) return;

  const movimentoMax = gameData.movimentoAttuale[idPng] || 0;
  const percorsoLimitato =
    movimentoMax > 0 ? percorso.slice(0, movimentoMax + 1) : percorso;

  muoviPersonaggioConAnimazione(idPng, percorsoLimitato, {
    autoEsplora: false,
    ...opts,
  });
}

// 🔹 Punto di innesto per i comportamenti dei PNG. Un solo comportamento
// implementato per ora ("segui", verso png.stato.bersaglio: il nome di un
// giocatore) come esempio: qui andranno in futuro "allontanati",
// "evita-minaccia", "vai-a-X", ecc. — ognuno decide solo la cella
// bersaglio, poi passa a muoviPngVerso() che fa il resto.
function aggiornaComportamentoPng(idPng) {
  const png = (gameData.pngAttivi || []).find((p) => p.id === idPng);
  if (!png) return;

  if (png.comportamentoMovimento === "segui" && png.stato?.bersaglio) {
    const cellaBersaglio = gameData.posizioniPersonaggi[png.stato.bersaglio];
    if (cellaBersaglio) muoviPngVerso(idPng, cellaBersaglio);
    return;
  }

  // "fermo" (default): nessun movimento
}

// 🔹 Rivela i PNG ancora nascosti presenti in una carta appena esplorata:
// mostra il loro messaggio di apparizione (se presente) e, alla chiusura,
// avvia subito il loro dialogo iniziale (se presente). Va chiamata SOLO
// dopo l'eventuale rivelazione delle strutture della stessa carta, mai
// insieme, per non sovrapporre popup.
function rivelaPngNascostiIn(codiceCarta) {
  const nascosti = (gameData.pngAttivi || []).filter(
    (p) =>
      gameData.posizioniPersonaggi[p.id] === codiceCarta &&
      p.visibile === false
  );
  if (nascosti.length === 0) return;

  const [primo, ...altri] = nascosti;
  primo.visibile = true;
  altri.forEach((p) => (p.visibile = true)); // eventuali altri PNG nella stessa stanza
  aggiornaPersonaggiNelleCelle([codiceCarta]);

  const avviaDialogoSePresente = () => {
    if (primo.nodoDialogoIniziale) {
      avviaDialogoPng(primo.id, primo.nodoDialogoIniziale);
    }
  };

  if (primo.messaggioApparizione) {
    mostraPopupGenerico({
      titolo: primo.nome,
      messaggio: primo.messaggioApparizione,
      pulsanti: [
        {
          testo: "Chiudi",
          azione: () => {
            chiudiPopup();
            avviaDialogoSePresente();
          },
        },
      ],
    });
  } else {
    avviaDialogoSePresente();
  }
}

// ============================
// 🗨️ DIALOGO PNG (stile RPG)
// ============================
// Finestra fissa in basso: ritratto + nome, testo che scorre a click,
// opzioni di scelta cliccabili. Un solo dialogo attivo per volta.

let dialogoPngAttivo = null; // { idPng, nodoId, righe, indiceRiga }

function getFinestraDialogoPng() {
  let el = document.getElementById("finestraDialogoPng");
  if (!el) {
    el = document.createElement("div");
    el.id = "finestraDialogoPng";
    el.className = "finestra-dialogo-png";
    el.innerHTML = `
      <div class="dialogo-png-ritratto">
        <div class="dialogo-png-ritratto-placeholder"></div>
      </div>
      <div class="dialogo-png-corpo">
        <div class="dialogo-png-nome"></div>
        <div class="dialogo-png-testo"></div>
        <div class="dialogo-png-opzioni"></div>
      </div>
    `;
    document.body.appendChild(el);
    el.addEventListener("click", (e) => {
      if (e.target.closest(".dialogo-png-opzione")) return;
      avanzaDialogoPng();
    });
  }
  return el;
}

function chiudiDialogoPng() {
  dialogoPngAttivo = null;
  const el = document.getElementById("finestraDialogoPng");
  if (el) el.style.display = "none";
}

function avviaDialogoPng(idPng, nodoId) {
  const png = (gameData.pngAttivi || []).find((p) => p.id === idPng);
  const nodo = png?.dialoghi?.[nodoId];
  if (!png || !nodo) return;

  const righe = Array.isArray(nodo.testo) ? nodo.testo : [nodo.testo];
  dialogoPngAttivo = { idPng, nodoId, righe, indiceRiga: 0 };
  disegnaDialogoPng();
}

function disegnaDialogoPng() {
  if (!dialogoPngAttivo) return;
  const { idPng, nodoId, righe, indiceRiga } = dialogoPngAttivo;
  const png = (gameData.pngAttivi || []).find((p) => p.id === idPng);
  const nodo = png?.dialoghi?.[nodoId];
  if (!png || !nodo) {
    chiudiDialogoPng();
    return;
  }

  const el = getFinestraDialogoPng();
  el.style.display = "flex";

  const ritratto = el.querySelector(".dialogo-png-ritratto-placeholder");
  if (png.immagine) {
    ritratto.style.backgroundImage = `url("${png.immagine}")`;
    ritratto.textContent = "";
  } else {
    ritratto.style.backgroundImage = "";
    ritratto.textContent = png.nome; // placeholder bianco col nome, per ora
  }

  el.querySelector(".dialogo-png-nome").textContent = png.nome;
  el.querySelector(".dialogo-png-testo").textContent = righe[indiceRiga] || "";

  const ultimaRiga = indiceRiga >= righe.length - 1;
  const opzioniEl = el.querySelector(".dialogo-png-opzioni");
  opzioniEl.innerHTML = "";

  if (!ultimaRiga) {
    opzioniEl.innerHTML = `<div class="dialogo-png-prosegui">▼ clicca per continuare</div>`;
    return;
  }

  if (nodo.opzioni && nodo.opzioni.length > 0) {
    const opzioniValide = nodo.opzioni.filter((opz) =>
      condizioneSoddisfatta(opz.condizione)
    );
    opzioniValide.forEach((opz) => {
      const btn = document.createElement("button");
      btn.className = "dialogo-png-opzione";
      btn.textContent = opz.testo;
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        sceltaDialogoPng(opz);
      });
      opzioniEl.appendChild(btn);
    });
  } else {
    opzioniEl.innerHTML = `<div class="dialogo-png-prosegui">▼ clicca per chiudere</div>`;
  }
}

function avanzaDialogoPng() {
  if (!dialogoPngAttivo) return;
  const { righe, indiceRiga, idPng, nodoId } = dialogoPngAttivo;
  const png = (gameData.pngAttivi || []).find((p) => p.id === idPng);
  const nodo = png?.dialoghi?.[nodoId];

  if (indiceRiga < righe.length - 1) {
    dialogoPngAttivo.indiceRiga++;
    disegnaDialogoPng();
    return;
  }

  // Ultima riga raggiunta: se non ci sono opzioni, un click in più chiude
  if (!nodo?.opzioni || nodo.opzioni.length === 0) {
    chiudiDialogoPng();
  }
  // Se ci sono opzioni, si aspetta il click su un pulsante, non sul corpo
}

function sceltaDialogoPng(opzione) {
  // Punto di innesto per le conseguenze delle risposte: sia dichiarative
  // (opzione.effetti, dati JSON) sia via codice (opzione.azione, legacy).
  if (Array.isArray(opzione.effetti)) {
    eseguiEffetti(opzione.effetti);
  }
  if (typeof opzione.azione === "function") {
    opzione.azione();
  }
  if (opzione.vai && dialogoPngAttivo) {
    avviaDialogoPng(dialogoPngAttivo.idPng, opzione.vai);
  } else {
    chiudiDialogoPng();
  }
}

function aggiornaPersonaggiNelleCelle(
  celleDaAggiornare,
  pgInMovimentoDaSaltare = null,
  opts = {} // ⬅️ nuovo: { spread: boolean, centerX?: number, step?: number }
) {
  const container = document.getElementById("grigliaPersonaggi");
  const CENTER_X = typeof opts.centerX === "number" ? opts.centerX : 30; // centro “visivo”
  const STEP = typeof opts.step === "number" ? opts.step : 65; // distanza tra carte in spread

  for (const codiceCarta of celleDaAggiornare) {
    let personaggiInCella = Object.entries(gameData.posizioniPersonaggi).filter(
      ([nome, cella]) => {
        if (cella !== codiceCarta || nome === pgInMovimentoDaSaltare) return false;
        // 🔹 Un PNG non ancora scoperto resta invisibile: non va disegnato
        const pngDef = (gameData.pngAttivi || []).find((p) => p.id === nome);
        if (pngDef && pngDef.visibile === false) return false;
        const minacciaDef = (gameData.minacceAttive || []).find(
          (m) => m.id === nome
        );
        if (minacciaDef && minacciaDef.visibile === false) return false;
        return true;
      }
    );

    // 🔹 Porta il PG attivo in fondo (ultimo → più a destra)
    if (gameData.pgAttivo) {
      const attivoIndex = personaggiInCella.findIndex(
        ([nome]) => nome === gameData.pgAttivo
      );
      if (attivoIndex !== -1) {
        const [pgAttivoEntry] = personaggiInCella.splice(attivoIndex, 1);
        personaggiInCella.push(pgAttivoEntry);
      }
    }

    // Rimuove i PG non più presenti in questa cella
    container.querySelectorAll(`.carta-personaggio`).forEach((pg) => {
      if (pg.classList.contains("in-movimento")) return;
      if (pg.dataset.cella === codiceCarta) {
        const nome = pg.dataset.pg || pg.dataset.nome || pg.innerText.trim();
        if (!personaggiInCella.some(([n]) => n === nome)) {
          pg.remove();
        }
      }
    });

    // Ricrea o aggiorna tutti i PG della cella
    const n = personaggiInCella.length;
    const spreadAttivo = !!opts.spread && n >= 3; // ⬅️ condizione spread

    // 🔹 La posizione della cella è la stessa per tutti i personaggi che ci stanno dentro:
    // la chiediamo al browser una sola volta invece che una volta per personaggio.
    const coords = getCoordinateCarta(codiceCarta);

    // Se spread attivo: calcola target assoluti centrati
    let targets = null;
    if (spreadAttivo) {
      // distribuzione simmetrica: CENTER_X + (i - (n-1)/2) * STEP
      targets = personaggiInCella.map(
        (_, i) => CENTER_X + (i - (n - 1) / 2) * STEP
      );
    }

    personaggiInCella.forEach(([nome], index) => {
      // 🔎 Cerca card via data-pg
      let cartaPG = container.querySelector(
        `.carta-personaggio[data-pg="${CSS.escape(
          nome
        )}"][data-cella="${CSS.escape(codiceCarta)}"]`
      );

      // layout base (X variabile, Y fisso)
      let offsetX = 0;
      let offsetY = -40;

      if (spreadAttivo) {
        // ⬅️ in modalità spread usiamo i target calcolati
        offsetX = targets[index];
      } else {
        // ⬅️ layout “normale” (tuo originale)
        if (n === 1) {
          offsetX = 30;
        } else if (n === 2) {
          offsetX = index === 0 ? 5 : 55;
        } else if (n === 3) {
          offsetX = [5, 30, 55][index];
        } else if (n === 4) {
          offsetX = [5, 21.66, 38.32, 55][index];
        } else if (n === 5) {
          offsetX = [5, 17.5, 30, 42.5, 55][index];
        } else {
          offsetX = [5, 15, 25, 35, 45, 55][index];
        }
      }

      if (!cartaPG) {
        // 🆕 Nuova card — PG, PNG o Minaccia, riconosciuto dai rispettivi array
        const pngDef = (gameData.pngAttivi || []).find((p) => p.id === nome);
        const minacciaDef = (gameData.minacceAttive || []).find(
          (m) => m.id === nome
        );

        cartaPG = document.createElement("div");
        cartaPG.dataset.cella = codiceCarta;
        cartaPG.dataset.pg = nome;
        cartaPG.setAttribute("data-nome", nome);

        if (minacciaDef) {
          cartaPG.className = "carta-personaggio minaccia";
          cartaPG.dataset.tipo = "minaccia";
          cartaPG.innerText = minacciaDef.nome.split(" ")[0];
        } else if (pngDef) {
          cartaPG.className = "carta-personaggio png";
          cartaPG.dataset.tipo = "png";
          cartaPG.innerText = pngDef.nome.split(" ")[0];
          if (pngDef.immagine) {
            cartaPG.style.backgroundImage = `url("${pngDef.immagine}")`;
          }
        } else {
          cartaPG.className = "carta-personaggio";
          cartaPG.dataset.tipo = "pg";
          cartaPG.innerText = nome.split(" ")[0];
        }

        cartaPG.style.left = coords.x + "px";
        cartaPG.style.top = coords.y + "px";

        // offset base via CSS vars (NO transform inline fisso)
        cartaPG.style.setProperty("--offsetX", "30px");
        cartaPG.style.setProperty("--offsetY", "-40px");

        // assicura che il transform usi le variabili
        cartaPG.style.transform =
          "translate(var(--offsetX), var(--offsetY)) translate(var(--spreadX, 0px), var(--spreadY, 0px)) translateY(var(--jumpY, 0px))";

        container.appendChild(cartaPG);
      }

      // 🔹 z-index: attivo sopra gli altri
      cartaPG.style.zIndex = nome === gameData.pgAttivo ? "10" : "5";

      // Aggiorna offset via variabili (animabile se hai transition su transform)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          cartaPG.style.setProperty("--offsetX", `${offsetX}px`);
          cartaPG.style.setProperty("--offsetY", `${offsetY}px`);
          // azzera eventuali spreadX/Y legacy
          cartaPG.style.setProperty("--spreadX", `0px`);
          cartaPG.style.setProperty("--spreadY", `0px`);
          // opzionale: marcare stato spread sulla cella
          if (spreadAttivo) {
            cartaPG.classList.add("spread");
          } else {
            cartaPG.classList.remove("spread");
          }
        });
      });
    });
  }
}

function getCoordinateCarta(codiceCarta) {
  const tabellone = document.getElementById("tabelloneDinamico");
  const containerPG = document.getElementById("grigliaPersonaggi");

  if (!tabellone || !containerPG) return null;

  // Trova la carta nel tabellone attivo
  const cartaDiv = tabellone.querySelector(
    `.carta-tabellone[data-codice="${codiceCarta}"]`
  );
  if (!cartaDiv) {
    console.warn(`⚠️ Carta ${codiceCarta} non trovata nel tabellone visibile`);
    return null;
  }

  // Calcola coordinate relative al contenitore dei personaggi
  const rectCarta = cartaDiv.getBoundingClientRect();
  const rectPG = containerPG.getBoundingClientRect();

  return {
    x: rectCarta.left - rectPG.left,
    y: rectCarta.top - rectPG.top,
  };
}

function calcolaDestinazioniPossibili(nomePersonaggio, mappaEsistente = null) {
  // Recupera il movimento attuale dal gameData
  const movimentoMassimo = gameData.movimentoAttuale[nomePersonaggio] || 0;

  const posizioneIniziale = gameData.posizioniPersonaggi[nomePersonaggio];
  if (!posizioneIniziale) return [];

  const cartaIniziale = gameData.tabelloneAttivo.find(
    (c) => c.codice === posizioneIniziale
  );
  if (!cartaIniziale || !cartaIniziale.posizione) return [];

  const mappa = mappaEsistente || costruisciMappaNavigabile();
  const startKey = `${cartaIniziale.posizione.x},${cartaIniziale.posizione.y}`;
  const visitati = new Set();
  const coda = [{ chiave: startKey, passi: 0 }];
  const raggiungibili = new Set();

  while (coda.length > 0) {
    const { chiave, passi } = coda.shift();
    if (visitati.has(chiave)) continue;
    visitati.add(chiave);

    const nodo = mappa[chiave];
    if (!nodo || !nodo.accessibile) continue;

    if (passi <= movimentoMassimo) {
      raggiungibili.add(nodo.codice);
    }

    if (passi < movimentoMassimo) {
      for (const vicino of nodo.vicini) {
        const chiaveVicino = `${vicino.x},${vicino.y}`;
        coda.push({ chiave: chiaveVicino, passi: passi + 1 });
      }
    }
  }

  return Array.from(raggiungibili);
}

function chiudiPopup() {
  chiudiPopupSelettivo(".popup");
}

function chiudiPopupSelettivo(selectorOrElement) {
  let popup;

  if (typeof selectorOrElement === "string") {
    popup = document.querySelector(selectorOrElement);
  } else {
    popup = selectorOrElement; // è già un elemento DOM
  }

  if (popup) {
    popup.classList.add("chiudi");
    setTimeout(() => {
      popup.remove();

      // 🔹 Se è un popup tutorial, nascondi la freccia
      if (
        popup.classList.contains("popup") &&
        /* opzionale: identificatore */ true
      ) {
        gestisciFrecciaTutorial(false);
      }
    }, 250);
  }
}

//GENERAZIONE CARTE STRUTTURA

function piazzaSbarramentoGenerico(keywordA, keywordB, quantita, tipo) {
  const tabellone = gameData.tabelloneAttivo;

  let cartaA = null;
  let cartaB = null;

  // Funzione interna per ricavare la carta in base a parola chiave
  function getCoordinates(keyword, cartaBase = null) {
    // 🔹 Caso: Partenza
    if (keyword === "Partenza") {
      const codicePartenza = Object.values(gameData.posizioniPersonaggi)[0];
      return tabellone.find((c) => c.codice === codicePartenza) || null;
    }

    // 🔹 Caso: Tipo:<qualcosa> → match per tipo carta (case-insensitive)
    if (typeof keyword === "string" && keyword.startsWith("Tipo:")) {
      const target = keyword.slice("Tipo:".length).trim().toLowerCase();
      if (!target) return null;
      return (
        tabellone.find((c) => (c.tipo || "").toLowerCase() === target) ||
        tabellone.find((c) => (c.tipo || "").toLowerCase().includes(target)) ||
        null
      );
    }

    // 🔹 Caso: Adiacente → logica esistente (stesso livello visivo y)
    if (keyword === "Adiacente" && cartaBase) {
      const adiacenti = tabellone.filter((carta) => {
        if (carta.posizione.y !== cartaBase.posizione.y) return false;
        const dx = Math.abs(carta.posizione.x - cartaBase.posizione.x);
        const dy = Math.abs(carta.posizione.y - cartaBase.posizione.y);
        return (dx === 1 && dy === 0) || (dx === 0 && dy === 1);
      });
      if (adiacenti.length === 0) return null;
      return adiacenti.length === 1
        ? adiacenti[0]
        : adiacenti[Math.floor(Math.random() * adiacenti.length)];
    }

    // 🔹 Caso: AdiacenteTipo:<qualcosa> → tra le adiacenti della cartaBase, scegli per tipo
    if (
      typeof keyword === "string" &&
      keyword.startsWith("AdiacenteTipo:") &&
      cartaBase
    ) {
      const target = keyword
        .slice("AdiacenteTipo:".length)
        .trim()
        .toLowerCase();
      if (!target) return null;

      const adiacenti = tabellone.filter((carta) => {
        if (carta.posizione.y !== cartaBase.posizione.y) return false; // stesso "livello"
        const dx = Math.abs(carta.posizione.x - cartaBase.posizione.x);
        const dy = Math.abs(carta.posizione.y - cartaBase.posizione.y);
        return (
          ((dx === 1 && dy === 0) || (dx === 0 && dy === 1)) &&
          ((carta.tipo || "").toLowerCase() === target ||
            (carta.tipo || "").toLowerCase().includes(target))
        );
      });

      if (adiacenti.length === 0) return null;
      if (adiacenti.length === 1) return adiacenti[0];

      // Euristica semplice: scegli quella con min distanza in X (stessa di prima)
      adiacenti.sort(
        (a, b) =>
          Math.abs(a.posizione.x - cartaBase.posizione.x) -
          Math.abs(b.posizione.x - cartaBase.posizione.x)
      );
      return adiacenti[0];
    }

    // (Parole chiave aggiuntive in futuro)
    return null;
  }

  // 🔹 Trova carta A
  cartaA = getCoordinates(keywordA);
  if (!cartaA) {
    console.warn(`⚠️ Carta A non trovata per keyword "${keywordA}"`);
    return;
  }

  // 🔹 Trova carta B
  cartaB = getCoordinates(keywordB, cartaA);
  if (!cartaB) {
    console.warn(`⚠️ Carta B non trovata per keyword "${keywordB}"`);
    return;
  }

  // 📌 Ora abbiamo entrambe le carte, piazziamo lo sbarramento
  const dir = calcolaDirezione(cartaA.codice, cartaB.codice);
  aggiungiSbarramentoSpecifico(cartaA.codice, dir, tipo);
}

function calcolaDirezione(codiceDa, codiceA) {
  const cartaA = gameData.tabelloneAttivo.find((c) => c.codice === codiceDa);
  const cartaB = gameData.tabelloneAttivo.find((c) => c.codice === codiceA);
  if (!cartaA || !cartaB) return null;

  if (cartaB.posizione.x < cartaA.posizione.x) return "sinistra";
  if (cartaB.posizione.x > cartaA.posizione.x) return "destra";
  if (cartaB.posizione.y < cartaA.posizione.y) return "sopra";
  if (cartaB.posizione.y > cartaA.posizione.y) return "sotto";
  return null;
}

function aggiungiSbarramentoSpecificoBase(
  codiceLuogo,
  direzione,
  tipoSbarramento,
  opts = {}
) {
  const tabellone = gameData.tabelloneAttivo || [];
  const cartaA = tabellone.find((c) => c.codice === codiceLuogo);

  if (!cartaA) {
    console.warn(`⚠️ Carta di partenza ${codiceLuogo} non trovata.`);
    return;
  }

  console.log(
    `🚧 Tentativo di piazzare sbarramento "${tipoSbarramento}" da ${cartaA.codice} (${cartaA.posizione?.x},${cartaA.posizione?.y}) in direzione ${direzione}`
  );

  // delta adiacenza “piena”
  const delta = { x: 0, y: 0 };
  if (direzione === "sinistra") delta.x = -1;
  else if (direzione === "destra") delta.x = 1;
  else if (direzione === "sopra") delta.y = -1;
  else if (direzione === "sotto") delta.y = 1;

  const posizioneB = {
    x: cartaA.posizione.x + delta.x,
    y: cartaA.posizione.y + delta.y,
  };

  const cartaB = tabellone.find(
    (c) => c.posizione.x === posizioneB.x && c.posizione.y === posizioneB.y
  );

  // 📚 lookup struttura (catalogo)
  const def = (gameData.catalogoStrutture || []).find(
    (s) => s.nome === tipoSbarramento || s.codice === tipoSbarramento
  );
  const codiceCartaStruttura =
    def?.codice || `S_${(tipoSbarramento || "X").toUpperCase()}`;

  // ===================================================
  // RAMO A) BORDO ESTERNO (nessuna carta adiacente)
  // ===================================================
  if (!cartaB) {
    console.log(
      `ℹ️ Nessuna carta adiacente in direzione ${direzione} da ${cartaA.codice}. Interpreto come BORGO ESTERNO.`
    );

    // mezzo-slot verso l’esterno
    const half = 0.5;
    const posX =
      direzione === "sinistra"
        ? cartaA.posizione.x - half
        : direzione === "destra"
        ? cartaA.posizione.x + half
        : cartaA.posizione.x;
    const posY =
      direzione === "sopra"
        ? cartaA.posizione.y - half
        : direzione === "sotto"
        ? cartaA.posizione.y + half
        : cartaA.posizione.y;

    // ID istanza deterministico per evitare duplicati
    const instanceId = `${codiceCartaStruttura}_${cartaA.codice}_${direzione}_EST`;

    if (
      (gameData.tabelloneStrutture || []).some((s) => s.codice === instanceId)
    ) {
      console.log(`⏭️ Struttura già presente: ${instanceId}`);
      return;
    }

    const struttura = {
      codice: instanceId,
      codiceCarta: codiceCartaStruttura,
      tipo: "sbarramento",
      nome: def?.nome || tipoSbarramento,
      posizione: { x: posX, y: posY },
      luoghi: [cartaA.codice, null], // esterno
      direzione,
      visibile: opts.visual !== false, // <- nuovo: false se piazzato solo "logicamente"
    };

    // registra in tabellone e indice Sxx
    gameData.tabelloneStrutture = gameData.tabelloneStrutture || [];
    gameData.tabelloneStrutture.push(struttura);

    gameData.mappaStrutture = gameData.mappaStrutture || {};
    if (!Array.isArray(gameData.mappaStrutture[codiceCartaStruttura])) {
      gameData.mappaStrutture[codiceCartaStruttura] = [];
    }
    gameData.mappaStrutture[codiceCartaStruttura].push({
      instanceId,
      posizione: { x: posX, y: posY },
      luoghi: [cartaA.codice, null],
      visibile: opts.visual !== false,
    });

    // Aggancio visivo retro-compat (questa è parte dello stato, lasciare)
    cartaA.strutture = cartaA.strutture || {};
    if (direzione === "sinistra" || direzione === "destra") {
      cartaA.strutture.conn_orizzontale = {
        nome: struttura.nome,
        verso: direzione,
        with: null,
        instanceId: struttura.codice,
      };
    } else if (direzione === "sopra" || direzione === "sotto") {
      cartaA.strutture.conn_verticale = {
        nome: struttura.nome,
        verso: direzione,
        with: null,
        instanceId: struttura.codice,
      };
    }

    console.log(
      `🪟 [Bordo esterno] "${struttura.nome}" (${codiceCartaStruttura}) piazzato su ${direzione} di ${cartaA.codice} @ (${posX},${posY})`
    );

    // Solo se richiesto, trigger grafica e zoom (default: visual = true)
    if (opts.visual !== false) {
      generaGrigliaTabellone();
      if (opts.zoom !== false) {
        setTimeout(() => {
          const elStruttura = document.querySelector(
            `.struttura-grid-item[data-instance-id="${instanceId}"]`
          );
          if (elStruttura) {
            zoomSuElemento(elStruttura, 1200, 2);
          } else {
            zoomSuCoordinate(posX, posY, 1200, 2);
          }
        }, 300);
      }
    }
    return;
  }

  // ===================================================
  // RAMO B) ADIACENTE NORMALE (A <-> B)
  // ===================================================
  console.log(
    `📍 Carta trovata in direzione ${direzione}: ${cartaB.codice} (${cartaB.posizione.x},${cartaB.posizione.y})`
  );

  const posX = (cartaA.posizione.x + cartaB.posizione.x) / 2;
  const posY = (cartaA.posizione.y + cartaB.posizione.y) / 2;

  const instanceId = `${codiceCartaStruttura}_${cartaA.codice}_${cartaB.codice}`;
  if (
    (gameData.tabelloneStrutture || []).some((s) => s.codice === instanceId)
  ) {
    console.log(`⏭️ Struttura già presente: ${instanceId}`);
    return;
  }

  const struttura = {
    codice: instanceId,
    codiceCarta: codiceCartaStruttura,
    tipo: "sbarramento",
    nome: def?.nome || tipoSbarramento,
    posizione: { x: posX, y: posY },
    luoghi: [cartaA.codice, cartaB.codice],
    direzione,
    visibile: opts.visual !== false, // <- nuovo: false se piazzato solo "logicamente"
  };

  gameData.tabelloneStrutture = gameData.tabelloneStrutture || [];
  gameData.tabelloneStrutture.push(struttura);

  gameData.mappaStrutture = gameData.mappaStrutture || {};
  if (!Array.isArray(gameData.mappaStrutture[codiceCartaStruttura])) {
    gameData.mappaStrutture[codiceCartaStruttura] = [];
  }
  gameData.mappaStrutture[codiceCartaStruttura].push({
    instanceId,
    posizione: { x: posX, y: posY },
    luoghi: [cartaA.codice, cartaB.codice],
  });

  // Agganci visivi (retro-compat: singolo oggetto nello stato)
  const orizz = direzione === "destra" || direzione === "sinistra";
  const vert = direzione === "sopra" || direzione === "sotto";

  if (orizz) {
    // destra → attacca ad A; sinistra → attacca a B
    const base = direzione === "sinistra" ? cartaB : cartaA;
    const neighbor = direzione === "sinistra" ? cartaA : cartaB;
    base.strutture = base.strutture || {};
    base.strutture.conn_orizzontale = {
      nome: struttura.nome,
      verso: direzione,
      with: neighbor.codice,
      instanceId: struttura.codice,
    };
  } else if (vert) {
    // sotto → attacca ad A; sopra → attacca a B (simmetria con orizzontale)
    const base = direzione === "sopra" ? cartaB : cartaA;
    const neighbor = direzione === "sopra" ? cartaA : cartaB;
    base.strutture = base.strutture || {};
    base.strutture.conn_verticale = {
      nome: struttura.nome,
      verso: direzione,
      with: neighbor.codice,
      instanceId: struttura.codice,
    };
  }

  console.log(
    `✅ Sbarramento "${struttura.nome}" (${codiceCartaStruttura}) piazzato tra ${cartaA.codice} e ${cartaB.codice} in posizione intermedia (${posX},${posY})`
  );

  // Solo se richiesto, trigger grafica e zoom (default: visual = true)
  if (opts.visual !== false) {
    generaGrigliaTabellone();
    if (opts.zoom !== false) {
      setTimeout(() => {
        const elStruttura = document.querySelector(
          `.struttura-grid-item[data-instance-id="${instanceId}"]`
        );
        if (elStruttura) {
          zoomSuElemento(elStruttura, 1200, 2);
        } else {
          zoomSuCoordinate(posX, posY, 1200, 2);
        }
      }, 300);
    }
  }
}

// 👹 Ogni cambio di stato di uno sbarramento (piazzamento iniziale,
// apertura/chiusura, abbattimento, rottura finestra...) può cambiare cosa
// vede una minaccia: avvolgo la funzione invece di toccarne i rami interni
// (ha diversi punti di uscita), così il refresh scatta sempre, qualunque
// ramo/guardia venga eseguito.
const _aggiungiSbarramentoSpecificoBase = aggiungiSbarramentoSpecificoBase;
function aggiungiSbarramentoSpecifico(...args) {
  const risultato = _aggiungiSbarramentoSpecificoBase(...args);
  if (typeof aggiornaPercezioneTutteLeMinacce === "function") {
    aggiornaPercezioneTutteLeMinacce();
  }
  return risultato;
}

// 🔹 Adatta l'intera schermata di gioco (tabellone + personaggi + pulsanti)
// a QUALSIASI dimensione di schermo, restringendo tutto in blocco quando
// non ci sta (telefono, soprattutto in landscape), senza mai ingrandire
// oltre le dimensioni originali (su PC, dove di solito c'è già spazio,
// il fattore resta 1 e nulla cambia). Agisce solo su #gameFit, un
// contenitore dedicato: non tocca il transform di .game-screen, che resta
// libero per il menu laterale e per lo zoom-su-carta esistenti.
const SCALA_MINIMA_ADATTAMENTO = 0.35; // sotto questa soglia, meglio scorrere che rimpicciolire oltre

function adattaGameScreenAllaFinestra() {
  const gameFit = document.getElementById("gameFit");
  const gameViewport = document.getElementById("gameViewport");
  const tabellone = document.getElementById("tabelloneDinamico");
  if (!gameFit || !gameViewport || !tabellone) return;

  // 🔹 FIX BUG "menu che si vede già socchiuso": la schermata precedente
  // (selezione personaggi, scenario, ecc.) lascia su <body> un
  // transform:scale(...) applicato da adattaSchermataAllaFinestra(). Quando
  // si passa al tabellone di gioco, il body viene svuotato con
  // innerHTML (che sostituisce solo i FIGLI, non le proprietà di stile del
  // <body> stesso), quindi quello scale residuo restava applicato e
  // "raddoppiava" l'effetto sul tabellone e sui menu laterali (che sono
  // fratelli di #gameViewport, quindi figli diretti di <body>): con
  // transform-origin:top-center, quello scale residuo tirava verso il
  // centro anche i menu chiusi (posizionati fuori schermo con un offset
  // negativo), rendendoli parzialmente visibili senza nemmeno averli
  // aperti. Il tabellone di gioco gestisce la propria scala per intero
  // tramite #gameFit, quindi qui il body va sempre riportato a "nessuna
  // scala".
  document.body.style.transform = "";
  document.documentElement.style.overflow = "";

  // offsetWidth/offsetHeight riflettono la dimensione NATURALE (di layout),
  // non influenzata da un transform già applicato in precedenza.
  const naturaleW = Math.max(tabellone.scrollWidth, tabellone.offsetWidth);
  const naturaleH = Math.max(tabellone.scrollHeight, tabellone.offsetHeight);
  if (!naturaleW || !naturaleH) return;

  const MARGINE = 16;
  const disponibileW = window.innerWidth - MARGINE;
  const disponibileH = window.innerHeight - MARGINE;

  const scalaCalcolata = Math.min(
    1,
    disponibileW / naturaleW,
    disponibileH / naturaleH
  );
  const scala = Math.max(SCALA_MINIMA_ADATTAMENTO, scalaCalcolata);

  gameFit.style.transform = `scale(${scala})`;

  // Se anche la scala minima non basta a far entrare tutto, teniamo lo
  // scroll come rete di sicurezza invece di rimpicciolire fino a rendere
  // il tabellone illeggibile.
  gameViewport.style.overflow = scalaCalcolata < SCALA_MINIMA_ADATTAMENTO ? "auto" : "hidden";
}

// 🔹 Stesso principio del tabellone di gioco, ma per TUTTE LE ALTRE
// schermate (menu iniziale, selezione personaggi, schermata scenario,
// menu campagna, ecc.): individua la schermata attualmente visibile e la
// restringe in blocco (transform su <body>) se il suo contenuto naturale
// non entra nella finestra. Funziona automaticamente anche su schermate
// future, senza dover richiamare questa funzione da ogni singolo punto
// del codice che cambia schermata (vedi MutationObserver più sotto).
function elementoSchermataAttiva() {
  // Il tabellone di gioco ha già il proprio adattamento dedicato: qui non
  // deve essere toccato (eviterebbe di sommare due scale diverse).
  if (document.getElementById("gameViewport")) return null;

  const scenario = document.getElementById("schermataScenario");
  if (scenario && getComputedStyle(scenario).display !== "none") {
    return scenario;
  }

  return (
    document.querySelector(".schermata-iniziale") ||
    document.querySelector(".container") ||
    null
  );
}

// 🔹 Calcola il numero di colonne della griglia di selezione personaggi
// (#gridSelezionePG / #gridCarteIniziali) in base allo spazio realmente
// disponibile: quante schede da almeno MIN_CARD px entrano su una riga, poi
// distribuisce le righe in modo bilanciato (mai una riga orfana con 1 sola
// scheda, es. 5+1 → diventa 3+3). Richiamata da adattaSchermataAllaFinestra
// PRIMA di misurare l'altezza, così la scala tiene conto del layout finale.
function adattaGrigliaSelezionePersonaggi() {
  const griglie = document.querySelectorAll(".grid-selezione-pg");
  griglie.forEach((grid) => {
    const n = grid.children.length;
    if (!n) return;

    const MIN_CARD = 95; // soglia minima di leggibilità: sotto, meglio andare a capo
    const GAP = 14;
    const disponibile = grid.clientWidth || window.innerWidth;

    let maxColonne = Math.max(1, Math.floor((disponibile + GAP) / (MIN_CARD + GAP)));
    maxColonne = Math.min(maxColonne, n);

    const righe = Math.ceil(n / maxColonne);
    const colonne = Math.ceil(n / righe);

    grid.style.setProperty("--colonne-schede", colonne);
  });
}

function adattaSchermataAllaFinestra() {
  const el = elementoSchermataAttiva();

  if (!el) {
    document.body.style.transform = "";
    return;
  }

  adattaGrigliaSelezionePersonaggi();

  // 🔹 Tutte le schermate basate su .container (Home inclusa: selezione
  // espansioni/personaggi, carte iniziali, obiettivi, selezione scenario,
  // menu principale...) NON passano più dal restringimento in blocco su
  // <body>: quel sistema, per far entrare il contenuto in ALTEZZA, doveva
  // applicare la STESSA scala anche in LARGHEZZA (un'unica trasformazione,
  // altrimenti il testo si deforma) — lasciando bande vuote ai lati anche
  // quando la larghezza aveva spazio a sufficienza. Sulla Home, per di
  // più, scalare <body> scalava anche il video di sfondo (.home-background,
  // position:fixed): un elemento con transform diventa "containing block"
  // per i suoi discendenti position:fixed, quindi il video veniva rimpicciolito
  // insieme al resto invece di restare sempre a schermo intero.
  // Restano quindi sempre a dimensione naturale; se il contenuto è comunque
  // troppo alto per lo schermo (schermi molto piccoli), scorre SOLO al
  // proprio interno (vedi .container in styles.css), senza restringere né
  // spostare nient'altro. Solo la schermata di scenario (overlay a parte,
  // non un .container) mantiene il vecchio comportamento, che lì non ha
  // mai creato questo problema.
  if (el.matches(".container")) {
    document.body.style.transform = "";
    document.documentElement.style.overflow = "";

    // 🔹 Il contenuto è centrato verticalmente (vedi CSS: .container:not
    // (.schermata-iniziale) usa justify-content:center), per non lasciare
    // vuoto in basso sulle schermate con poco contenuto. Ma se eccede
    // l'altezza disponibile, la centratura lo farebbe sforare anche SOPRA
    // il bordo superiore, dove lo scroll interno non può raggiungerlo
    // (scrollTop non può essere negativo): si forza quindi prima
    // l'allineamento in alto per misurare/adattare in modo deterministico,
    // poi si decide se serve davvero tenerlo (eccesso confinato in basso,
    // raggiungibile con lo scroll).
    el.classList.add("contenuto-eccede");

    // 🔹 La schermata "Anteprima Scenario" contiene un'anteprima del
    // tabellone che si auto-ridimensiona in base allo spazio verticale
    // rimasto SOTTO la propria posizione (vedi generaPreviewTabellone).
    // Quella posizione deve restare stabile PRIMA e DOPO il calcolo:
    // se in seguito si passasse alla centratura (perché il contenuto
    // "sembra" entrare), l'intero blocco si sposterebbe più in basso,
    // portando l'anteprima proprio sotto l'icona "Avanti" fissa in basso a
    // destra — quindi qui l'allineamento in alto resta sempre attivo,
    // invece di rivalutarlo come per le altre schermate.
    if (document.getElementById("previewTabellone")) {
      generaPreviewTabellone();
      return;
    }

    const eccede = el.scrollHeight > el.clientHeight + 1;
    el.classList.toggle("contenuto-eccede", eccede);
    return;
  }

  // 🔹 Misurazione a due passaggi: con "justify-content:center" (di
  // default) il contenuto che eccede l'altezza sfora per metà SOPRA il
  // bordo superiore, e quella parte non risulta in scrollHeight (che
  // parte sempre dall'angolo in alto a sinistra) — la misura risulterebbe
  // quindi più piccola del reale. Attivando prima la classe che porta
  // l'allineamento in alto, tutto l'eccesso finisce sotto ed è misurabile
  // per intero; solo dopo si decide se serve davvero tenerla attiva.
  el.classList.add("contenuto-eccede");
  const naturaleW = Math.max(el.scrollWidth, el.offsetWidth);
  const naturaleH = Math.max(el.scrollHeight, el.offsetHeight);
  if (!naturaleW || !naturaleH) {
    el.classList.remove("contenuto-eccede");
    return;
  }

  const MARGINE = 16;
  const disponibileW = window.innerWidth - MARGINE;
  const disponibileH = window.innerHeight - MARGINE;

  const scalaCalcolata = Math.min(
    1,
    disponibileW / naturaleW,
    disponibileH / naturaleH
  );
  const scala = Math.max(SCALA_MINIMA_ADATTAMENTO, scalaCalcolata);

  document.body.style.transform = `scale(${scala})`;
  document.documentElement.style.overflow =
    scalaCalcolata < SCALA_MINIMA_ADATTAMENTO ? "auto" : "hidden";

  // Se il contenuto non entra ed è centrato verticalmente (flex + justify-
  // content:center), l'eccesso sfora anche SOPRA lo schermo, non solo
  // sotto: in quel caso passa ad allineamento in alto (vedi CSS
  // .contenuto-eccede) così l'eccesso resta solo in basso, dove la scala
  // lo riporta comunque a schermo.
  el.classList.toggle("contenuto-eccede", scalaCalcolata < 1);
}

// 🔹 Sipario di transizione: coperto SUBITO (in modo sincrono, prima che il
// browser disegni il fotogramma successivo) quando cambia schermata, e
// scoperto solo a calcolo/scala completati — così non si vede mai il
// "salto" dalla dimensione naturale a quella adattata.
function elementoSipario() {
  return document.getElementById("siparioTransizione");
}
function mostraSipario() {
  elementoSipario()?.classList.add("attivo");
}
function nascondiSipario() {
  elementoSipario()?.classList.remove("attivo");
}

// 🔹 Punto unico richiamato da resize/rotazione/cambio schermata: decide da
// solo quale dei due adattamenti (gioco o resto dell'app) applicare.
let _adattaTuttoTimeout = null;
function adattaTuttoAllaFinestra() {
  if (document.getElementById("gameViewport")) {
    adattaGameScreenAllaFinestra();
  } else {
    adattaSchermataAllaFinestra();
  }
}
function schedulaAdattamento(ritardo = 150, scopriSipario = false) {
  clearTimeout(_adattaTuttoTimeout);
  _adattaTuttoTimeout = setTimeout(() => {
    adattaTuttoAllaFinestra();
    if (scopriSipario) {
      // due rAF: aspetta che il browser disegni davvero il layout con la
      // nuova scala prima di scoprire, non solo che lo script sia finito.
      requestAnimationFrame(() => requestAnimationFrame(nascondiSipario));
    }
  }, ritardo);
}

window.addEventListener("resize", () => schedulaAdattamento(150));
window.addEventListener("orientationchange", () => schedulaAdattamento(300));

// 🔹 Ricalcola automaticamente ogni volta che il contenuto della pagina
// cambia (nuova schermata, popup, ecc.), così ogni schermata — comprese
// quelle future — risulta adattata senza dover richiamare la funzione a
// mano da ogni punto del codice che genera nuovo HTML.
//
// Il sipario si accende SOLO per un vero cambio schermata (nodi rimossi:
// una document.body.innerHTML= o un container.innerHTML= sostituisce
// tutto), non per piccole aggiunte come l'animazione del testo dello
// scenario (che aggiunge singoli span senza mai rimuovere nulla): altrimenti
// lampeggerebbe ad ogni parola.
new MutationObserver((mutazioni) => {
  const cambioSchermata = mutazioni.some((m) => m.removedNodes.length > 0);
  if (cambioSchermata) mostraSipario();
  schedulaAdattamento(cambioSchermata ? 60 : 150, cambioSchermata);
}).observe(document.body, {
  childList: true,
  subtree: true,
});

// 🔹 I font web (Google Fonts) si caricano in modo asincrono: la prima
// misurazione può avvenire con il font di riserva (più piccolo/stretto) e
// il testo si allarga poco dopo quando il font vero arriva, senza che
// nessun'altra delle condizioni sopra se ne accorga da sola.
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() => schedulaAdattamento(50));
}

// 🔹 Primo caricamento della pagina: il sipario parte già acceso (impostato
// direttamente nell'HTML), e viene tolto solo dopo il primo calcolo, una
// volta che anche i font sono pronti.
Promise.all([
  new Promise((res) => {
    if (document.readyState === "complete") res();
    else window.addEventListener("load", res, { once: true });
  }),
  document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve(),
]).then(() => schedulaAdattamento(0, true));

//GESTIONE ZOOM

// 🔹 Zoom preciso: centra la vista sulla posizione REALE dell'elemento DOM
// indicato (misurata con getBoundingClientRect), invece di ricalcolarla a
// mano dalla griglia. Funziona allo stesso identico modo sia per una carta
// luogo intera sia per una singola struttura (finestra/porta), qualunque
// sia la sua posizione o dimensione — niente più zoom leggermente storti.
function zoomSuElemento(el, durata = 1000, zoom = 2, opts = {}) {
  const gameScreen = document.querySelector(".game-screen");
  if (!gameScreen || !el) return;

  const viewport = opts.viewportEl || gameScreen;

  // Misura "piatta": azzera temporaneamente la trasformazione per leggere
  // le posizioni reali sullo schermo, poi le confronto rispetto a game-screen.
  gameScreen.style.transition = "none";
  gameScreen.style.transform = "none";
  void gameScreen.offsetHeight;

  const vpRect = viewport.getBoundingClientRect();
  const gsRect = gameScreen.getBoundingClientRect();
  const elRect = el.getBoundingClientRect();

  const cx = elRect.left - gsRect.left + elRect.width / 2;
  const cy = elRect.top - gsRect.top + elRect.height / 2;

  const s = zoom;
  const tx = vpRect.width / 2 - s * cx;
  const ty = vpRect.height / 2 - s * cy;

  gameScreen.style.transition = `transform ${durata}ms ease`;
  gameScreen.style.transform = `translate(${tx}px, ${ty}px) scale(${s})`;
}

function zoomSuCoordinate(x, y, durata = 1000, zoom = 2, opts = {}) {
  const gameScreen = document.querySelector(".game-screen"); // viewport (overflow hidden)
  const griglia = document.getElementById("tabelloneDinamico"); // grid
  if (!gameScreen || !griglia) return;

  // 🔧 offset fine regolabile quando la griglia parte “a destra”
  const DEFAULT_NUDGE_RIGHT_PX = 50; // ← CAMBIA QUI: 0, 4, 6, 8...
  const nudgeRightPx = Number.isFinite(opts.nudgeRightPx)
    ? opts.nudgeRightPx
    : DEFAULT_NUDGE_RIGHT_PX;

  const viewport = opts.viewportEl || gameScreen;

  // Misura “piatta”
  const prevTransition = gameScreen.style.transition;
  const prevTransform = gameScreen.style.transform;
  const prevOrigin = gameScreen.style.transformOrigin;
  gameScreen.style.transition = "none";
  gameScreen.style.transform = "none";
  gameScreen.style.transformOrigin = "0 0";
  void gameScreen.offsetHeight;

  const vpRect = viewport.getBoundingClientRect();
  const gsRect = gameScreen.getBoundingClientRect();

  // 1) Min col/row DOM effettive (gestiscono la colonna implicita)
  const celle = Array.from(griglia.querySelectorAll(".cella-tabellone"));
  const cols = celle
    .map((el) => Number(el.style.gridColumnStart))
    .filter(Number.isFinite);
  const rows = celle
    .map((el) => Number(el.style.gridRowStart))
    .filter(Number.isFinite);
  const domMinCol = cols.length ? Math.min(...cols) : 1;
  const domMinRow = rows.length ? Math.min(...rows) : 1;

  // 2) Indici relativi alla griglia DOM
  const relX = Number(x) - (domMinCol - 1);
  const relY = Number(y) - (domMinRow - 1);

  // 3) Dimensioni cella/gap dal DOM
  const styles = getComputedStyle(griglia);
  const rowGap = parseFloat(styles.rowGap || styles.gridRowGap || "0") || 0;
  const colGap =
    parseFloat(styles.columnGap || styles.gridColumnGap || "0") || 0;
  const sample = griglia.querySelector(".carta-tabellone");
  const cellRect = sample?.getBoundingClientRect();
  const cellW = cellRect?.width || 120; // include i 2px di bordo → ~122
  const cellH = cellRect?.height || 80; // include i 2px di bordo → ~82

  // 4) Centro target in coordinate locali a .game-screen
  const gridRect = griglia.getBoundingClientRect();
  let cx = gridRect.left - gsRect.left + relX * (cellW + colGap) + cellW / 2;
  let cy = gridRect.top - gsRect.top + relY * (cellH + rowGap) + cellH / 2;

  // 5) Micro-offset: compensa il gap iniziale delle colonne implicite
  //    Se domMinCol = 2 → aggiungi 1 * colGap; se fosse 3 → 2 * colGap, ecc.
  if (domMinCol > 1) {
    cx += (domMinCol - 1) * colGap;
  }
  // opzionale: micro-fine-tuning extra
  if (Number.isFinite(opts.nudgeRightPx)) {
    cx += opts.nudgeRightPx; // es. +2 o -2 px se vuoi rifinire
  }

  // 6) Trasformazione: centro il punto (cx,cy) nel viewport
  const s = zoom;
  const tx = vpRect.width / 2 - s * cx;
  const ty = vpRect.height / 2 - s * cy;

  // (log sintetico)
  console.log("GRID DOM", { domMinCol, domMinRow, nudgeRightPx });
  console.log("CENTER", { relX, relY, cellW, cellH, colGap, rowGap, cx, cy });
  console.log("TRANSFORM", { s, tx, ty });

  gameScreen.style.transition = `transform ${durata}ms ease`;
  gameScreen.style.transform = `translate(${tx}px, ${ty}px) scale(${s})`;

  if (opts.debug) {
    let dot = gameScreen.querySelector(".zoom-debug-dot");
    if (!dot) {
      dot = document.createElement("div");
      dot.className = "zoom-debug-dot";
      gameScreen.appendChild(dot);
    }
    dot.style.left = `${cx}px`;
    dot.style.top = `${cy}px`;
    dot.style.display = "block";
    clearTimeout(dot._t);
    dot._t = setTimeout(() => dot && (dot.style.display = "none"), 1500);
  }

  // (facoltativo) ripristino
  // gameScreen.style.transition = prevTransition;
  // gameScreen.style.transformOrigin = prevOrigin;
}

function resetZoom() {
  const gameScreen = document.querySelector(".game-screen");
  if (!gameScreen) return;

  gameScreen.style.transition = `transform 0.4s ease`;
  gameScreen.style.transform = `scale(1) translate(0, 0)`;
}

//INTERAZIONI strutture

function chiaveProva({ codiceIstanza, nomeStruttura, idInterazione }) {
  return `${codiceIstanza || "NOINST"}::${nomeStruttura}::${idInterazione}`;
}

function getProgressoProva(key) {
  return gameData.proveAbilita[key] || 0;
}

function setProgressoProva(key, nuovoTotale) {
  gameData.proveAbilita[key] = Math.max(0, Number(nuovoTotale) || 0);
}

// UI della prova + controllo contributo (senza mostrare il requisito)
function apriProvaAbilita({
  nomeStruttura,
  codiceStruttura, // es. "S01"
  codiceIstanza, // es. "S01_A04_A05" (opzionale ma utile)
  idInterazione,
  abilita,
  requisito,
  giocatori,
  modo = "accumulo", // "accumulo" | "diretto"
  testoCompletamento, // opzionali: se non arrivano li recuperiamo noi
  azioneCompletamento,
}) {
  console.log("🧪[PROVA] open", {
    nomeStruttura,
    codiceStruttura,
    codiceIstanza,
    idInterazione,
    abilita,
    requisito,
    giocatori,
    modo,
    testoCompletamento,
    azioneCompletamento,
  });

  const isGruppo = (giocatori || "").toLowerCase() === "gruppo";
  const isDiretto = (modo || "accumulo").toLowerCase() === "diretto";
  const reqNum = Number(requisito);
  console.log("🧪[PROVA] flags", { isGruppo, isDiretto, reqNum });

  // Chiave di accumulo (solo per "accumulo")
  const key = isDiretto
    ? null
    : chiaveProva({ codiceIstanza, nomeStruttura, idInterazione });
  if (!gameData.proveAbilita) gameData.proveAbilita = {};
  const totaleAttuale = isDiretto ? 0 : getProgressoProva(key);
  console.log("🧪[PROVA] key/total", { key, totaleAttuale });

  // Popup UI
  const overlay = document.createElement("div");
  overlay.className = "popup";
  overlay.innerHTML = `
    <div class="popup-content" id="uiProva">
      <h2>Prova di ${abilita || "abilità"}</h2>
      <p style="margin-top:-6px; opacity:.85">
        ${isGruppo ? "👥 Prova di gruppo" : "👤 Prova individuale"}${
    isDiretto ? " • tentativo singolo" : ""
  }
      </p>
      <p><strong>Struttura:</strong> ${nomeStruttura}</p>
      ${
        isDiretto
          ? ""
          : `<p><strong>Totale accumulato:</strong> <span id="totaleVal">${totaleAttuale}</span></p>`
      }
      <div style="display:flex;align-items:center;justify-content:center;gap:10px;margin:14px 0;">
        <button id="minusBtn">−</button>
        <div style="min-width:60px;text-align:center;">
          <div style="font-size:1.6rem;" id="contributoVal">0</div>
          <div style="font-size:.85rem;opacity:.75">Contributo</div>
        </div>
        <button id="plusBtn">+</button>
      </div>
      <div style="display:flex;gap:10px;justify-content:center;">
        <button id="avviaProvaBtn">Avvia la prova</button>
        <button id="btnChiudiProva">Chiudi</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  console.log("🧪[PROVA] overlay appended");

  // Stato locale
  let contributo = 0;
  const contributoEl = overlay.querySelector("#contributoVal");
  const totaleEl = overlay.querySelector("#totaleVal");

  // Evita bubbling (e log)
  ["#minusBtn", "#plusBtn", "#avviaProvaBtn", "#btnChiudiProva"].forEach(
    (sel) => {
      const el = overlay.querySelector(sel);
      if (el)
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          // console.debug("🧪[PROVA] click", sel);
        });
    }
  );

  overlay.querySelector("#minusBtn").onclick = () => {
    contributo = Math.max(0, contributo - 1);
    contributoEl.textContent = contributo;
    console.log("🧪[PROVA] contributo −", contributo);
  };
  overlay.querySelector("#plusBtn").onclick = () => {
    contributo = contributo + 1;
    contributoEl.textContent = contributo;
    console.log("🧪[PROVA] contributo +", contributo);
  };

  overlay.querySelector("#btnChiudiProva").onclick = () => {
    console.log("🧪[PROVA] chiudi (utente)");
    chiudiPopupSelettivo(overlay);
  };

  overlay.querySelector("#avviaProvaBtn").onclick = () => {
    try {
      console.log("🧪[PROVA] avvio", { contributo, isDiretto, reqNum });

      if (contributo <= 0) {
        console.warn("🧪[PROVA] contributo non valido");
        mostraPopupGenerico({
          titolo: "Nessun contributo",
          messaggio: "Aumenta il valore con + prima di avviare la prova.",
          pulsanti: [
            {
              testo: "Ok",
              azione: (btn) => chiudiPopupSelettivo(btn.closest(".popup")),
            },
          ],
        });
        return;
      }

      // Recupero (se mancanti) testo/azione di completamento dal catalogo
      let tComp = testoCompletamento;
      let aComp = azioneCompletamento;
      if (!tComp || !aComp) {
        const def = (gameData.catalogoStrutture || []).find(
          (s) => s.nome === nomeStruttura || s.codice === codiceStruttura
        );
        const inter = def?.interazioni?.find((i) => i.id === idInterazione);
        tComp = tComp ?? inter?.testoCompletamento;
        aComp = aComp ?? inter?.azioneCompletamento;
        console.log("🧪[PROVA] lookup completamento", {
          trovato: !!inter,
          tComp,
          aComp,
        });
      }

      if (isDiretto) {
        const ok = Number(contributo) >= reqNum;
        console.log("🧪[PROVA] diretto esito", { ok, contributo, reqNum });
        chiudiPopupSelettivo(overlay);

        if (ok) {
          console.log("🧪[PROVA] diretto -> COMPLETA");
          completaProvaAbilita({
            nomeStruttura,
            codiceStruttura,
            codiceIstanza,
            idInterazione,
            testoCompletamento: tComp,
            azioneCompletamento: aComp,
          });
        } else {
          console.warn("🧪[PROVA] diretto fallito");
          mostraPopupGenerico({
            titolo: "Tentativo fallito",
            messaggio: `La prova non è stata superata.`,
            pulsanti: [
              {
                testo: "Ok",
                azione: (btn) => chiudiPopupSelettivo(btn.closest(".popup")),
              },
            ],
          });
        }
      } else {
        // ACCUMULO
        const nuovoTotale = getProgressoProva(key) + contributo;
        setProgressoProva(key, nuovoTotale);
        if (totaleEl) totaleEl.textContent = nuovoTotale;
        console.log("🧪[PROVA] accumulo", {
          key,
          contributo,
          nuovoTotale,
          reqNum,
        });

        if (Number(nuovoTotale) >= reqNum) {
          console.log("🧪[PROVA] accumulo -> soglia raggiunta -> COMPLETA");
          chiudiPopupSelettivo(overlay);
          completaProvaAbilita({
            nomeStruttura,
            codiceStruttura,
            codiceIstanza,
            idInterazione,
            testoCompletamento: tComp,
            azioneCompletamento: aComp,
          });
        } else {
          console.log("🧪[PROVA] accumulo -> non ancora");
          mostraPopupGenerico({
            titolo: "Progresso registrato",
            messaggio: `Potete contribuire di nuovo più tardi.`,
            pulsanti: [
              {
                testo: "Ok",
                azione: (btn) => chiudiPopupSelettivo(btn.closest(".popup")),
              },
            ],
          });
        }

        contributo = 0;
        contributoEl.textContent = contributo;
      }
    } catch (err) {
      console.error("🧪[PROVA] ERRORE durante avvio prova", err);
      try {
        chiudiPopupSelettivo(overlay);
      } catch (_) {}
      mostraPopupGenerico({
        titolo: "Errore",
        messaggio: "Qualcosa è andato storto nell'avvio della prova.",
        pulsanti: [
          {
            testo: "Ok",
            azione: (btn) => chiudiPopupSelettivo(btn.closest(".popup")),
          },
        ],
      });
    }
  };
}

// Gestisce gli effetti al COMPLETAMENTO della prova
// - Mostra il testo di completamento (se presente)
// - Esegue l'azione richiesta (per ora supporta "scavalcamento")
function completaProvaAbilita({
  nomeStruttura,
  codiceStruttura, // "Sxx"
  codiceIstanza, // es. "Sxx_A04_A05" (opzionale)
  idInterazione,
  testoCompletamento,
  azioneCompletamento,
}) {
  console.log("✅[COMPLETA] start", {
    nomeStruttura,
    codiceStruttura,
    codiceIstanza,
    idInterazione,
    testoCompletamento,
    azioneCompletamento,
  });

  const pg = gameData.pgAttivo;
  const carte = gameData.tabelloneAttivo || [];

  // Se testo/azione non arrivano, recuperali ora dal catalogo
  if (!testoCompletamento || !azioneCompletamento) {
    const def = (gameData.catalogoStrutture || []).find(
      (s) => s.nome === nomeStruttura || s.codice === codiceStruttura
    );
    const inter = def?.interazioni?.find((i) => i.id === idInterazione);
    testoCompletamento = testoCompletamento ?? inter?.testoCompletamento;
    azioneCompletamento = azioneCompletamento ?? inter?.azioneCompletamento;
    console.log("✅[COMPLETA] lookup da catalogo", {
      trovato: !!inter,
      testoCompletamento,
      azioneCompletamento,
    });
  }

  // ➜ CHIUDI SUBITO i popup noti (senza utility dedicate)
  try {
    const popupStanza = document.querySelector(".popup-interazione-stanza");
    if (popupStanza) {
      console.log("✅[COMPLETA] chiudo popup interazione stanza");
      chiudiPopupSelettivo(popupStanza);
    }
    const popupsGenerici = document.querySelectorAll(".popup");
    if (popupsGenerici.length) {
      console.log(
        "✅[COMPLETA] chiudo",
        popupsGenerici.length,
        "popup generici"
      );
      popupsGenerici.forEach((p) => chiudiPopupSelettivo(p));
    }
  } catch (e) {
    console.warn("✅[COMPLETA] errore nella chiusura popup:", e);
  }

  // Helper: trova i due luoghi correlati allo sbarramento attuale.
  // Priorità assoluta: l'id univoco dell'istanza cliccata (codiceIstanza) contro
  // l'elenco reale delle strutture (gameData.tabelloneStrutture) — è l'unico
  // identificatore che non può essere ambiguo. Il vecchio indice parallelo
  // (gameData.mappaStrutture) e il suo criterio "qualunque porta dello stesso
  // tipo che tocca la stanza del giocatore" potevano scegliere una PORTA
  // DIVERSA da quella davvero interagita, se ce n'era un'altra dello stesso
  // tipo collegata alla stessa stanza — causa del luogo sbagliato rivelato.
  function trovaCoppiaLuoghi() {
    const strutture = gameData.tabelloneStrutture || [];

    let struttura = strutture.find((s) => s.codice === codiceIstanza);

    // Solo se l'id univoco non è disponibile (caso limite): ultima risorsa,
    // può essere ambiguo se esistono più strutture dello stesso tipo/nome.
    if (!struttura) {
      struttura = strutture.find(
        (s) => s.codiceCarta === codiceStruttura || s.nome === nomeStruttura
      );
    }

    if (struttura?.luoghi?.length === 2) {
      console.log("✅[COMPLETA] coppia luoghi (match diretto)", struttura.luoghi);
      return struttura.luoghi;
    }

    // Fallback geometrico finale (struttura non più presente nei dati):
    // solo tra carte dello STESSO piano, gli sbarramenti non sono mai verticali.
    if (struttura?.posizione) {
      const sx = struttura.posizione.x,
        sy = struttura.posizione.y;
      for (let i = 0; i < carte.length; i++) {
        const A = carte[i];
        if (!A.posizione) continue;
        for (let j = i + 1; j < carte.length; j++) {
          const B = carte[j];
          if (!B.posizione || B.posizione.y !== A.posizione.y) continue;
          const adiacenti = Math.abs(A.posizione.x - B.posizione.x) === 1;
          if (!adiacenti) continue;
          const midX = (A.posizione.x + B.posizione.x) / 2;
          const midY = (A.posizione.y + B.posizione.y) / 2;
          if (Math.abs(midX - sx) < 0.01 && Math.abs(midY - sy) < 0.01) {
            console.log("✅[COMPLETA] midpoint match", {
              A: A.codice,
              B: B.codice,
              sx,
              sy,
            });
            return [A.codice, B.codice];
          }
        }
      }
    }
    console.warn("✅[COMPLETA] coppia luoghi NON trovata");
    return null;
  }

  const eseguiAzione = () => {
    const azione = (azioneCompletamento || "").toLowerCase();
    console.log("✅[COMPLETA] esegui azione", { azione, pg });

    if (azione === "scavalcamento" && pg) {
      const coppia = trovaCoppiaLuoghi();
      console.log("✅[COMPLETA] coppia luoghi", coppia);

      if (coppia && coppia.length === 2) {
        const [L1, L2] = coppia;
        const cellaAttuale = gameData.posizioniPersonaggi?.[pg];
        const destinazione =
          cellaAttuale === L1 ? L2 : cellaAttuale === L2 ? L1 : null;

        console.log("✅[COMPLETA] movimento", {
          cellaAttuale,
          destinazione,
          hasMover: typeof muoviPersonaggioConAnimazione === "function",
        });

        if (destinazione) {
          if (typeof muoviPersonaggioConAnimazione === "function") {
            muoviPersonaggioConAnimazione(pg, [cellaAttuale, destinazione], {
              effetto: "scavalcamento",
              durataStepMs: 400,
            });
          } else {
            console.warn(
              "✅[COMPLETA] muoviPersonaggioConAnimazione assente, fallback a update stato"
            );
            gameData.posizioniPersonaggi[pg] = destinazione;
            generaGrigliaTabellone();
          }
        } else {
          console.warn(
            "✅[COMPLETA] destinazione NON determinabile (PG non adiacente?)"
          );
        }
      }
    } else if (azione === "abbattimento") {
      let removed = false;

      // Prova a determinare la coppia di luoghi correlata
      const coppia = (() => {
        const c = trovaCoppiaLuoghi();
        return Array.isArray(c) && c.length === 2 ? c : null;
      })();

      if (typeof generaRumore === "function") {
        generaRumore(gameData.posizioniPersonaggi?.[pg], 2, {
          descrizione: "Porta abbattuta",
          luoghiPossibili: (coppia || []).filter(Boolean),
        });
      }

      // Se manca Sxx, prova a inferirlo dalla struttura corrente associata alla coppia
      if (!codiceStruttura && coppia) {
        const s = (gameData.tabelloneStrutture || []).find(
          (t) =>
            Array.isArray(t.luoghi) &&
            t.luoghi.length === 2 &&
            coppia.every((L) => t.luoghi.includes(L))
        );
        if (s?.codiceCarta) {
          codiceStruttura = s.codiceCarta; // es. "S03"
          console.log(
            "✅[COMPLETA] Sxx inferito dall'istanza corrente:",
            codiceStruttura
          );
        }
      }

      // 1) preferisci la rimozione per instanceId se disponibile
      if (codiceIstanza) {
        removed = rimuoviStruttura(codiceIstanza, codiceStruttura, null);
      }

      // 2) altrimenti, se ho la coppia, rimuovi per coppia (anche senza Sxx)
      if (!removed && coppia) {
        removed = rimuoviStruttura(null, codiceStruttura, coppia);
      }

      // 3) fallback estremo: prima struttura di quel tipo
      if (!removed && codiceStruttura) {
        removed = rimuoviStruttura(null, codiceStruttura, null);
      }

      if (removed) {
        console.log(
          "✅[COMPLETA] Abbattimento completato e struttura rimossa."
        );
        // 🔹 Il varco è ora aperto: il luogo adiacente viene rivelato
        // (esplorato) anche se il personaggio non vi si è ancora spostato.
        rivelaLuogoAdiacenteSbloccato(coppia);
      } else {
        console.warn(
          "✅[COMPLETA] Abbattimento: nessuna struttura rimossa (identificazione fallita)."
        );
      }

      generaGrigliaTabellone();
    } else if (azione === "rottura" || azione === "rompi") {
      if (typeof generaRumore === "function") {
        generaRumore(gameData.posizioniPersonaggi?.[pg], 3, {
          descrizione: "Finestra rotta",
        });
      }

      // Gestione "rottura": sostituisci lo sbarramento con la carta "Finestra Rotta"
      console.log("✅[COMPLETA][rottura] start", {
        codiceIstanza,
        codiceStruttura,
        nomeStruttura,
      });

      let struct = null;
      const strutture = gameData.tabelloneStrutture || [];

      // 1) se abbiamo un instance id, prova a trovarla direttamente
      if (codiceIstanza) {
        struct = strutture.find((s) => s.codice === codiceIstanza) || null;
      }

      // 2) se non trovata, prova tramite coppia luoghi (PG o midpoint)
      if (!struct) {
        const coppia = (() => {
          try {
            return trovaCoppiaLuoghi();
          } catch (e) {
            return null;
          }
        })();
        if (Array.isArray(coppia) && coppia.length === 2) {
          struct =
            strutture.find(
              (t) =>
                Array.isArray(t.luoghi) &&
                t.luoghi.length === 2 &&
                coppia.every((L) => t.luoghi.includes(L))
            ) || null;
          if (struct) {
            console.log(
              "[COMPLETA][rottura] struttura individuata via coppia luoghi:",
              struct.codice
            );
          }
        }
      }

      // 3) fallback: cerca la prima istanza di quel tipo Sxx se abbiamo codiceStruttura
      if (!struct && codiceStruttura) {
        struct =
          strutture.find((s) => s.codiceCarta === codiceStruttura) || null;
        if (struct) {
          console.log(
            "[COMPLETA][rottura] struttura individuata via codiceStruttura:",
            struct.codice
          );
        }
      }

      if (!struct) {
        console.warn(
          "[COMPLETA][rottura] Struttura bersaglio NON trovata; nessuna sostituzione eseguita.",
          {
            codiceIstanza,
            codiceStruttura,
            nomeStruttura,
          }
        );
        // comunque aggiorna UI
        generaGrigliaTabellone();

        // reset del zoom dopo che l'animazione di aggiungiSbarramentoSpecifico ha finito
        const ZOOM_RESET_DELAY_AFTER_SBARRAMENTO = 1700; // ms (300 delay + 1200 durata + buffer)
        if (typeof resetZoom === "function") {
          setTimeout(() => {
            try {
              resetZoom();
            } catch (e) {
              console.warn("[rottura] resetZoom fallito:", e);
            }
          }, ZOOM_RESET_DELAY_AFTER_SBARRAMENTO);
        }
      } else {
        // Salva riferimenti prima di rimuovere
        const base = Array.isArray(struct.luoghi) ? struct.luoghi[0] : null;
        const dir = struct.direzione || null;

        // Proviamo a rimuovere con la stessa strategia di "abbattimento"
        let removed = false;

        // 1) preferisci la rimozione per instanceId
        removed = rimuoviStruttura(struct.codice, struct.codiceCarta, null);

        // 2) se fallisce, prova con la coppia luoghi
        if (
          !removed &&
          Array.isArray(struct.luoghi) &&
          struct.luoghi.length === 2
        ) {
          removed = rimuoviStruttura(null, struct.codiceCarta, struct.luoghi);
        }

        // 3) fallback estremo: rimuovi la prima struttura di quel tipo
        if (!removed && struct.codiceCarta) {
          removed = rimuoviStruttura(null, struct.codiceCarta, null);
        }

        if (removed) {
          console.log("[COMPLETA][rottura] struttura rimossa:", struct.codice);

          // 🔹 Il varco è ora aperto: il luogo adiacente viene rivelato
          // (esplorato) anche se il personaggio non vi si è ancora spostato.
          rivelaLuogoAdiacenteSbloccato(struct.luoghi);

          // Ripiazza la "Finestra Rotta" nello stesso punto logico (se abbiamo base+dir)
          if (base && dir) {
            console.log(
              "[COMPLETA][rottura] ripiazzo 'Finestra Rotta' su base:",
              base,
              "dir:",
              dir
            );
            aggiungiSbarramentoSpecifico(base, dir, "Finestra Rotta");
          } else {
            // Se non abbiamo base/dir, proviamo a dedurli come midpoint tra due luoghi
            if (
              Array.isArray(struct.luoghi) &&
              struct.luoghi.length === 2 &&
              struct.luoghi[1]
            ) {
              // calcola direzione tra i due luoghi (se la funzione calcolaDirezione è disponibile)
              if (typeof calcolaDirezione === "function") {
                const dirFrom = calcolaDirezione(
                  struct.luoghi[0],
                  struct.luoghi[1]
                );
                if (dirFrom) {
                  aggiungiSbarramentoSpecifico(
                    struct.luoghi[0],
                    dirFrom,
                    "Finestra Rotta"
                  );
                  console.log(
                    "[COMPLETA][rottura] ripiazzato via calcolaDirezione",
                    { base: struct.luoghi[0], dirFrom }
                  );
                } else {
                  console.warn(
                    "[COMPLETA][rottura] impossibile dedurre direzione per ripiazzare la finestra rotta.",
                    struct
                  );
                }
              } else {
                console.warn(
                  "[COMPLETA][rottura] calcolaDirezione non disponibile; non posso ripiazzare automaticamente.",
                  struct
                );
              }
            } else {
              console.warn(
                "[COMPLETA][rottura] base/dir mancanti e nessuna coppia valida, salto il ripiazzamento.",
                struct
              );
            }
          }
        } else {
          console.warn(
            "[COMPLETA][rottura] rimozione struttura fallita per:",
            struct.codice
          );
        }

        // aggiorna la UI (generaGrigliaTabellone è chiamata anche da aggiungiSbarramentoSpecifico, ma chiamiamo comunque)
        generaGrigliaTabellone();

        // reset del zoom dopo che l'animazione di aggiungiSbarramentoSpecifico ha finito
        const ZOOM_RESET_DELAY_AFTER_SBARRAMENTO = 1700; // ms (300 delay + 1200 durata + buffer)
        if (typeof resetZoom === "function") {
          setTimeout(() => {
            try {
              resetZoom();
            } catch (e) {
              console.warn("[rottura] resetZoom fallito:", e);
            }
          }, ZOOM_RESET_DELAY_AFTER_SBARRAMENTO);
        }
      }
    } else {
      console.log("✅[COMPLETA] nessuna azione specifica, refresh UI");
      generaGrigliaTabellone();
    }
  };

  // Dopo aver chiuso i popup, mostra il testo di completamento (se presente), altrimenti esegui subito
  if (testoCompletamento) {
    console.log("✅[COMPLETA] mostro testo di completamento");
    mostraPopupGenerico({
      titolo: "Azione completata",
      messaggio: testoCompletamento,
      pulsanti: [
        {
          testo: "Procedi",
          azione: (btn, popup) => {
            console.log("✅[COMPLETA] utente conferma -> eseguiAzione()");
            chiudiPopupSelettivo(popup);
            eseguiAzione();
          },
        },
      ],
    });
  } else {
    console.log("✅[COMPLETA] nessun testo di completamento, eseguo azione");
    eseguiAzione();
  }
}

//LISTENER CLICK STRUTTURE
// Click strutture: consenti solo se il PG attivo è adiacente allo sbarramento
if (!window._struttureClickBound) {
  window._struttureClickBound = true;

  document.body.addEventListener("click", (e) => {
    const el = e.target.closest(".connessione-orizzontale, .overlay-struttura");
    if (!el) return;

    e.stopPropagation();

    const nome = el.dataset.nomeStruttura || (el.textContent || "").trim();
    const istanza = el.dataset.codiceIstanza || ""; // se presente
    const attivo = gameData.pgAttivo;
    const pos = gameData.posizioniPersonaggi || {};
    const cellaPG = attivo ? pos[attivo] : null;

    // Se non ho un PG attivo o non ne trovo la cella, blocco e messaggio
    if (!attivo || !cellaPG) {
      mostraPopupGenerico({
        titolo: "Interazione non disponibile",
        messaggio:
          "Seleziona un personaggio attivo per interagire con lo sbarramento.",
        pulsanti: [{ testo: "Chiudi", azione: chiudiPopup }],
      });
      return;
    }

    // Trova la struttura cliccata nelle strutture piazzate
    // 1) se abbiamo un id istanza, usiamolo
    let struttura = (gameData.tabelloneStrutture || []).find(
      (s) => s.codice === istanza || s.instanceId === istanza
    );

    // 2) fallback per nome: prendo la prima struttura con lo stesso nome il cui array 'luoghi' include la cella del PG
    if (!struttura) {
      struttura = (gameData.tabelloneStrutture || []).find(
        (s) =>
          (s.nome === nome || s.tipo === nome || s.codiceCarta === nome) &&
          Array.isArray(s.luoghi) &&
          s.luoghi.includes(cellaPG)
      );
    }

    // 3) fallback estremo: se ancora nulla, prendo la prima con quel nome (meglio di niente)
    if (!struttura) {
      struttura = (gameData.tabelloneStrutture || []).find(
        (s) => s.nome === nome || s.tipo === nome || s.codiceCarta === nome
      );
    }

    // Se non trovo la struttura, o non è adiacente al PG attivo, blocco
    const adiacente =
      struttura &&
      Array.isArray(struttura.luoghi) &&
      struttura.luoghi.includes(cellaPG);
    if (!adiacente) {
      mostraPopupGenerico({
        titolo: "Troppo lontano",
        messaggio:
          "Puoi interagire con uno Sbarramento solamente se ti trovi in un luogo ad esso adiacente.",
        pulsanti: [{ testo: "Chiudi", azione: chiudiPopup }],
      });
      return;
    }

    // Ok, il PG attivo è adiacente: procedi con l'interazione
    interagisciConStruttura(nome, istanza);
  });
}

// 🔹 Interazione con un PNG: 4 pulsanti sempre presenti (Parla, Dai oggetto,
// Usa oggetto, Ruba) + eventuali interazioni extra definite per quel PNG
// (in creazione, o aggiunte a runtime in istanza.interazioniExtra). Ogni
// pulsante extra ha solo bisogno di {id, etichetta, azione?} — azione è
// opzionale: se assente, il pulsante mostra semplicemente un testo/effetto
// da definire in futuro.
function interagisciConPng(idPng) {
  const png = (gameData.pngAttivi || []).find((p) => p.id === idPng);
  if (!png) return;

  const pulsantiBase = [
    {
      testo: "Parla",
      azione: () => {
        chiudiPopup();
        const testo =
          png.dialoghi?.default ||
          `${png.nome} non sembra avere nulla da dire, per ora.`;
        mostraPopupGenerico({
          titolo: png.nome,
          messaggio: testo,
          pulsanti: [{ testo: "Chiudi", azione: chiudiPopup }],
        });
      },
    },
    {
      testo: "Dai oggetto",
      azione: () => {
        chiudiPopup();
        // 🔧 Punto di innesto: qui andrà il selettore di oggetti
        // dall'inventario del giocatore attivo, una volta implementato.
        mostraPopupGenerico({
          titolo: "Dai oggetto",
          messaggio: `Scegli un oggetto da dare a ${png.nome}. (Da collegare all'inventario del giocatore.)`,
          pulsanti: [{ testo: "Chiudi", azione: chiudiPopup }],
        });
      },
    },
    {
      testo: "Usa oggetto",
      azione: () => {
        chiudiPopup();
        // 🔧 Punto di innesto: come sopra, ma l'oggetto agisce sul PNG
        // (es. curarlo, aggredirlo) invece di essergli ceduto.
        mostraPopupGenerico({
          titolo: "Usa oggetto",
          messaggio: `Scegli un oggetto da usare su ${png.nome}. (Da collegare all'inventario del giocatore.)`,
          pulsanti: [{ testo: "Chiudi", azione: chiudiPopup }],
        });
      },
    },
    {
      testo: "Ruba",
      azione: () => {
        chiudiPopup();
        // 🔧 Punto di innesto: qui andrà la logica di furto (prova di
        // abilità? oggetto scelto a caso o a scelta dall'inventario del PNG?)
        mostraPopupGenerico({
          titolo: "Ruba",
          messaggio: `Tenti di rubare qualcosa a ${png.nome}. (Logica da definire.)`,
          pulsanti: [{ testo: "Chiudi", azione: chiudiPopup }],
        });
      },
    },
  ];

  const pulsantiExtra = (png.interazioniExtra || []).map((inter) => ({
    testo: inter.etichetta || inter.id,
    azione: () => {
      chiudiPopup();
      if (typeof inter.azione === "function") {
        inter.azione(png);
        return;
      }
      mostraPopupGenerico({
        titolo: inter.etichetta || png.nome,
        messaggio: inter.testo || "Non succede nulla di particolare.",
        pulsanti: [{ testo: "Chiudi", azione: chiudiPopup }],
      });
    },
  }));

  mostraPopupGenerico({
    titolo: png.nome,
    messaggio: `Cosa vuoi fare con <strong>${png.nome}</strong>?`,
    pulsanti: [
      ...pulsantiBase,
      ...pulsantiExtra,
      { testo: "Annulla", azione: chiudiPopup },
    ],
  });
}

// Listener globale per click sulle carte PG
document.addEventListener("click", (e) => {
  const carta = e.target.closest(".carta-personaggio");
  if (!carta) return;

  e.stopPropagation();

  const nomePG = carta.dataset.pg || carta.dataset.nome;
  const codiceCella = carta.dataset.cella;
  if (!nomePG || !codiceCella) return;

  // 🧪 Minaccia: cliccabile in QUALSIASI momento (bypassa il vincolo di
  // cella qui sotto, pensato solo per PG/PNG) — è un pannello di
  // ispezione/debug, non un'interazione di gioco vera e propria.
  if (carta.dataset.tipo === "minaccia") {
    interagisciConMinaccia(nomePG);
    return;
  }

  // 🚫 guard: blocca interazioni su PG/PNG in celle diverse dal pgAttivo
  if (gameData.pgAttivo) {
    const cellaAttivo = (gameData.posizioniPersonaggi || {})[gameData.pgAttivo];
    if (cellaAttivo && codiceCella !== cellaAttivo) {
      mostraPopupGenerico({
        titolo: "Interazione non consentita",
        messaggio:
          "Non puoi interagire con personaggi presenti in luoghi differenti.",
        pulsanti: [{ testo: "Chiudi", azione: chiudiPopup }],
      });
      return; // stop: niente spread, niente interazione
    }
  }

  // 🔹 PNG: apre il menu di interazione dedicato, non la logica dei giocatori
  if (carta.dataset.tipo === "png") {
    interagisciConPng(nomePG);
    return;
  }

  // ——— logica esistente ———
  const idPngNascostiSet = new Set(
    (gameData.pngAttivi || [])
      .filter((p) => p.visibile === false)
      .map((p) => p.id)
  );
  const personaggiInCella = Object.entries(gameData.posizioniPersonaggi || {})
    .filter(([nome, cella]) => cella === codiceCella && !idPngNascostiSet.has(nome))
    .map(([nome]) => nome);

  const sonoAlmenoTre = personaggiInCella.length >= 3;
  const spreadAttivoQui = gameData._spreadCell === codiceCella;

  if (sonoAlmenoTre && !spreadAttivoQui) {
    aggiornaPersonaggiNelleCelle([codiceCella], null, {
      spread: true,
      centerX: 30,
      step: 65,
    });
    gameData._spreadCell = codiceCella;

    const gameScreen = document.querySelector(".game-screen") || document.body;
    let overlay = document.getElementById("spreadOverlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "spreadOverlay";
      overlay.style.cssText = `
        position:absolute; inset:0;
        background:rgba(0,0,0,0.6);
        z-index:6500;
        pointer-events:auto;`;
      gameScreen.querySelector("#grigliaPersonaggi")?.appendChild(overlay);
    }
    overlay.addEventListener(
      "click",
      (ev) => {
        ev.stopPropagation();
        collassaSpreadPG();
      },
      { once: true }
    );

    const cartaLuogo = gameData.tabelloneAttivo.find(
      (c) => c.codice === codiceCella
    );
    if (cartaLuogo?.posizione) {
      const elCartaLuogo = document.querySelector(
        `.carta-tabellone[data-codice="${codiceCella}"]`
      );
      if (elCartaLuogo) {
        zoomSuElemento(elCartaLuogo, 600, 2);
      } else {
        zoomSuCoordinate(cartaLuogo.posizione.x, cartaLuogo.posizione.y, 600, 2);
      }
    }

    // porta sopra solo le carte della cella (schema z-index “selettivo” che hai già)
    document.querySelectorAll(".carta-personaggio").forEach((pg) => {
      if (pg.dataset.prevZ === undefined)
        pg.dataset.prevZ = pg.style.zIndex || "";
      pg.style.zIndex = pg.dataset.cella === codiceCella ? "7002" : "6400";
    });

    return; // niente popup al primo click
  }

  // spread già attivo (o <3 PG) → interazione diretta
  mostraInterazionePersonaggio(nomePG);
});

// Mini helper per richiudere lo "spread" usando la tua funzione di layout
function collassaSpreadPG() {
  const cella = gameData._spreadCell;

  // ripristina gli z-index originali di TUTTE le carte
  document.querySelectorAll(".carta-personaggio").forEach((pg) => {
    if (pg.dataset.prevZ !== undefined) {
      pg.style.zIndex = pg.dataset.prevZ;
      delete pg.dataset.prevZ;
    }
  });

  // rimuovi overlay + reset zoom
  document.getElementById("spreadOverlay")?.remove();
  resetZoom();

  // ridisegna la cella senza spread
  if (cella) {
    try {
      aggiornaPersonaggiNelleCelle([cella], null, { spread: false });
    } catch (_) {}
  }
  gameData._spreadCell = null;
}

function mostraInterazionePersonaggio(nomePG) {
  // richiudi eventuale ventaglio
  collassaSpreadPG?.();

  const eAttivo = nomePG === gameData.pgAttivo;

  const pulsanti = [
    {
      testo: "Usa Oggetto",
      azione: () => {
        chiudiPopup();
        mostraPopupGenerico({
          titolo: "Usa Oggetto",
          messaggio: `${nomePG} usa un oggetto. (placeholder)`,
          pulsanti: [{ testo: "Chiudi", azione: chiudiPopup }],
        });
      },
    },
    eAttivo
      ? {
          testo: "Fai Rumore",
          azione: () => {
            chiudiPopup();
            mostraPopupGenerico({
              titolo: "Fai Rumore",
              messaggio: `${nomePG} fa rumore attirando l'attenzione. (placeholder)`,
              pulsanti: [{ testo: "Chiudi", azione: chiudiPopup }],
            });
          },
        }
      : {
          testo: "Ruba",
          azione: () => {
            chiudiPopup();
            mostraPopupGenerico({
              titolo: "Ruba",
              messaggio: `${nomePG} tenta di rubare. (placeholder)`,
              pulsanti: [{ testo: "Chiudi", azione: chiudiPopup }],
            });
          },
        },
    { testo: "Chiudi", azione: chiudiPopup },
  ];

  mostraPopupGenerico({
    titolo: nomePG,
    messaggio: `
      <div class="avatar-placeholder">[Avatar PG]</div>
      <div style="text-align:center;margin-top:6px">Scegli un'azione:</div>
    `,
    pulsanti,
  });
}

// ======================================================
// Utility RIUTILIZZABILE: rimuove una struttura dal gioco
// - instanceId: id istanza (es. "Sxx_A04_A05") se noto
// - codiceStruttura: codice carta Sxx (fallback/filtri)
// - luoghi: [A, B] per identificare l’istanza tramite la coppia
// ======================================================
function rimuoviStruttura(instanceId, codiceStruttura, luoghi = null) {
  // ✅ Se ho la coppia di luoghi valida, è già un identificativo sufficiente
  const haLuoghi = Array.isArray(luoghi) && luoghi.length === 2;

  if (!instanceId && !codiceStruttura && !haLuoghi) {
    console.warn("[rimuoviStruttura] Nessun identificativo valido passato.");
    return false;
  }

  const strutture = gameData.tabelloneStrutture || [];
  const carte = gameData.tabelloneAttivo || [];

  // 1) Trova la struttura target
  let target = null;

  if (instanceId) {
    target = strutture.find((s) => s.codice === instanceId) || null;
  }

  // ✅ Se non trovata ma ho la coppia di luoghi, usa quella (anche senza Sxx)
  if (!target && haLuoghi) {
    target =
      strutture.find(
        (s) =>
          Array.isArray(s.luoghi) &&
          s.luoghi.length === 2 &&
          luoghi.every((L) => s.luoghi.includes(L)) &&
          (!codiceStruttura || s.codiceCarta === codiceStruttura) // se Sxx c'è, raffina il match
      ) || null;
  }

  // Fallback: se non trovata ma ho Sxx, prendi la prima di quel tipo
  if (!target && codiceStruttura) {
    target = strutture.find((s) => s.codiceCarta === codiceStruttura) || null;
  }

  if (!target) {
    console.warn("[rimuoviStruttura] Struttura NON trovata.", {
      instanceId,
      codiceStruttura,
      luoghi,
    });
    return false;
  }

  const { codice: instId, codiceCarta: sxx, luoghi: pair = [] } = target;
  const [L1, L2] = pair;

  // 2) LOGICA
  gameData.tabelloneStrutture = strutture.filter((s) => s !== target);

  // 3) INDICE Sxx
  if (
    gameData.mappaStrutture &&
    sxx &&
    Array.isArray(gameData.mappaStrutture[sxx])
  ) {
    gameData.mappaStrutture[sxx] = gameData.mappaStrutture[sxx].filter(
      (e) => e.instanceId !== instId
    );
    if (gameData.mappaStrutture[sxx].length === 0)
      delete gameData.mappaStrutture[sxx];
  }

  // 4) AGGANCI VISUALI (retro-compat, singolo oggetto)
  const cartaA = carte.find((c) => c.codice === L1);
  const cartaB = carte.find((c) => c.codice === L2);
  [
    [cartaA, L2],
    [cartaB, L1],
  ].forEach(([carta, otherCode]) => {
    if (!carta?.strutture) return;
    if (carta.strutture.conn_orizzontale) {
      const conn = carta.strutture.conn_orizzontale;
      if (conn.instanceId === instId || conn.with === otherCode) {
        delete carta.strutture.conn_orizzontale;
      }
    }
    if (carta.strutture.conn_verticale) {
      const conn = carta.strutture.conn_verticale;
      if (conn.instanceId === instId || conn.with === otherCode) {
        delete carta.strutture.conn_verticale;
      }
    }
  });

  console.log(
    `[rimuoviStruttura] Rimosso ${instId} (${sxx}) tra ${L1} e ${L2}.`
  );
  return true;
}

// 🔹 Disegna sul tabellone UNA SOLA struttura (senza ridisegnare tutto il resto).
// Riusa la stessa identica logica di posizionamento già usata in generaGrigliaTabellone().
function creaDOMPerStruttura(s) {
  const container = document.getElementById("tabelloneDinamico");
  if (!container) return null;

  if (
    !s?.posizione ||
    typeof s.posizione.x !== "number" ||
    typeof s.posizione.y !== "number"
  )
    return null;

  if (s.visibile === false) return null;

  // Se esiste già sul tabellone, non duplicarla
  if (s.codice) {
    const esistente = container.querySelector(
      `.struttura-grid-item[data-instance-id="${s.codice}"]`
    );
    if (esistente) return esistente;
  }

  const x = s.posizione.x;
  const y = s.posizione.y;
  const floorX = Math.floor(x);
  const floorY = Math.floor(y);
  const fracX = x - floorX;
  const fracY = y - floorY;

  const el = document.createElement("div");
  el.className = "struttura-grid-item";
  el.innerText = s.nome || "🚧";
  el.dataset.sxx = s.codiceCarta || "";
  el.dataset.nome = s.nome || "";
  el.dataset.dir = s.direzione || "";
  el.dataset.instanceId = s.codice || "";
  el.dataset.luogoA = s.luoghi?.[0] ?? "";
  el.dataset.luogoB = s.luoghi?.[1] ?? "";

  el.style.gridColumnStart = (floorX + 1).toString();
  el.style.gridRowStart = (floorY + 1).toString();

  const isBetweenCols = Math.abs(fracX - 0.5) < 0.001;
  const isBetweenRows = Math.abs(fracY - 0.5) < 0.001;

  if (isBetweenCols) {
    el.style.gridColumnEnd = "span 2";
    el.dataset.orientamento = "verticale";
  } else if (isBetweenRows) {
    el.style.gridRowEnd = "span 2";
    el.dataset.orientamento = "orizzontale";
  } else {
    el.dataset.orientamento = "centrato";
  }

  container.appendChild(el);

  el.addEventListener("click", (e) => {
    e.stopPropagation();
    interagisciConStruttura(s.nome, s.codice, { x, y });
  });

  return el;
}

// Rivela strutture SEQUENZIALMENTE: una alla volta, con popup per ciascuna.
// Manteniamo un piccolo fallback a generaGrigliaTabellone() se il DOM-mirato non è possibile.
// instanceIds: array di instanceId (s.codice)
// opts:
//   - zoom: boolean (se true, zoom sul singolo rivelato)
//   - durata, zoomFactor
//   - onComplete: function() callback chiamata alla fine (opzionale)
function rivelaStruttureBatch(instanceIds = [], opts = {}) {
  if (!Array.isArray(instanceIds) || instanceIds.length === 0) return;
  const strutture = gameData.tabelloneStrutture || [];

  // Helper: marca visibile e aggiorna mappaStrutture
  function marcaVisibile(s) {
    if (!s) return false;
    if (s.visibile === true) return false;
    s.visibile = true;
    s.appenaRivelata = true;
    if (
      gameData.mappaStrutture &&
      Array.isArray(gameData.mappaStrutture[s.codiceCarta])
    ) {
      gameData.mappaStrutture[s.codiceCarta].forEach((entry) => {
        if (entry.instanceId === s.codice) entry.visibile = true;
      });
    }
    return true;
  }

  // Helper: prova a creare DOM mirato per una struttura; ritorna true se creato, false altrimenti
  function tryCreaDOM(s) {
    try {
      if (typeof creaDOMPerStruttura === "function") {
        const el = creaDOMPerStruttura(s);
        return !!el;
      }
      return false;
    } catch (e) {
      console.warn("tryCreaDOM fallita:", e);
      return false;
    }
  }

  // Prepariamo la coda: includiamo solo strutture realmente da rivelare (skip già visibili)
  const queue = [];
  for (const id of instanceIds) {
    const s = strutture.find((st) => st.codice === id);
    if (!s) continue;
    if (s.visibile === true) continue;
    queue.push(s);
  }
  if (queue.length === 0) return;

  let idx = 0;
  const totale = queue.length;

  const next = () => {
    if (idx >= totale) {
      console.log(
        `🔓 rivelaStruttureBatch (sequenziale): completate ${totale} rivelazioni.`
      );
      if (typeof opts.onComplete === "function") opts.onComplete();
      return;
    }

    const s = queue[idx];
    if (!s) {
      idx++;
      return next();
    }

    // 1) aggiorna stato
    marcaVisibile(s);

    // 2) prova DOM-mirato; fallback a render globale
    const created = tryCreaDOM(s);
    if (!created) {
      generaGrigliaTabellone();
    }

    // 3) opzionale: zoom sul singolo rivelato
    if (opts.zoom && s.posizione && typeof s.posizione.x === "number") {
      const elStruttura = document.querySelector(
        `.struttura-grid-item[data-instance-id="${s.codice}"]`
      );
      if (elStruttura) {
        zoomSuElemento(elStruttura, opts.durata ?? 900, opts.zoomFactor ?? 2);
      } else {
        zoomSuCoordinate(
          s.posizione.x,
          s.posizione.y,
          opts.durata ?? 900,
          opts.zoomFactor ?? 2
        );
      }
    }

    // 4) popup informativo per questa rivelazione; alla chiusura proseguiamo
    const nomeBreve = (s.nome || s.codice || "")
      .toString()
      .trim()
      .split(/\s+/)[0]; // prende la prima "parola"

    mostraPopupGenerico({
      titolo: "Sbarramento!",
      messaggio: `Piazza uno <span class='tutorial-link' data-voce='Sbarramenti'>Sbarramento</span> <strong>${nomeBreve}</strong> come indicato. (${
        idx + 1
      }/${totale}).`,
      pulsanti: [
        {
          testo: "Chiudi",
          azione: () => {
            try {
              resetZoom();
              chiudiPopup();
            } catch (e) {
              console.warn("Errore chiusura popup rivelaSequenziale:", e);
            } finally {
              idx++;
              // piccolo delay per non sovrapporre animazioni (regola se vuoi)
              setTimeout(next, 500);
            }
          },
        },
      ],
    });
  };

  // Avvia la sequenza
  next();
}
