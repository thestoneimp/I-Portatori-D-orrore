# I Portatori d'Orrore — Companion App

Companion app (PWA) per il gioco da tavolo horror "I Portatori d'Orrore". Tutto il testo di gioco, i commenti e i messaggi di commit sono **in italiano**: mantieni questa convenzione.

Repo: https://github.com/thestoneimp/I-Portatori-D-orrore (branch `main`).

## Stack e vincoli

- Vanilla HTML/CSS/JS, **nessun build step, nessun package manager, nessun test automatico**. Si apre servendo la cartella con un server statico (serve per `fetch` dei JSON e per il service worker), es. `python -m http.server 8000`.
- App pensata **solo in orizzontale**: in verticale mostra un avviso "Ruota il dispositivo".
- PWA: `manifest.json` + `service-worker.js` (cache `portatori-orrore-v2`, strategia network-first, precache dei JSON e degli asset principali). Se aggiungi un nuovo file JSON o asset essenziale, aggiungilo a `PRECACHE_URLS`; se cambi la logica di cache, incrementa `CACHE_NAME`.
- Salvataggi in `localStorage`: `salvataggio1..3` (partita) e `campagna1..3` (progresso campagna).

## File

| File | Contenuto |
|---|---|
| `index.html` | Shell: overlay fissi (navigazione, 4 icone angolari di gioco, indicatore fase + contatore minacce), sfondo video. Gli overlay vengono spostati sotto `<html>` da `script.js`. |
| `script.js` | Tutta la logica (~10.800 righe, un unico file, sezioni separate da banner `// ====`). |
| `styles.css` | Tutti gli stili. |
| `scenari_base.json` | Scenari (`SC01` "La Notte di Halloween", tipo tutorial, 6 turni) con `setupStrutture` (sbarramenti ecc.) e testi introduttivi. |
| `carte_struttura_base.json` | Carte luogo/struttura (`A01` Strada, ...) con `tipo`, `piano`, descrizioni, elementi. |
| `elementi_interagibili_base.json` | Elementi interagibili (es. lampione) con risposte condizionate da scenario/statoCasa/meteo/momento. |
| `eventi_generici.json` | Eventi con tag, prova (abilità + difficoltà) ed effetti di successo/fallimento. |
| `eroi_base.json` | Personaggi giocabili (`P01` Alice Richards, `P02` Scott Stockings, ...): abilità, equipaggiamento, movimento. |
| `png_base.json` | PNG (`PNG01`...) con comportamento di movimento e dialoghi. |
| `minacce_base.json` | Minacce `M01–M04` (Lo sconosciuto, Zombie, Cane Rabbioso, Il Cacciatore): `caratteristiche` (pf, pa, forza, intelletto 0–3 = livello della IA, rapidita, carisma) e `immagine` (carta esportata). |
| `portatori_orrore_base.json` | Dati dei Portatori d'Orrore / carte luogo della casa. |
| `tutorial_base.json` | Voci del tutorial/glossario (link `data-voce`, es. "Sbarramenti"). |
| `assets/media/` | Video di sfondo e sfondi ambientali `sfondo-{abitata|abbandonata}-{sereno|pioggia|nebbia|neve}-{giorno|notte}.jpg`. |

I JSON sono caricati con `fetch` all'avvio da `script.js` (vedi le chiamate `fetch(...)` intorno alle righe 219–620).

## Mappa di `script.js` (numeri di riga indicativi, verifica con grep)

- ~1–700: setup, schermo intero, menu di gioco, tutorial, popup impilati, caricamento dati.
- ~700–1500: selezione personaggi/scenario, schermata scenario, schermata principale.
- ~1780–2470: sfondo ambientale (meteo/giorno-notte), diagnostica tabellone, `faseMinacce()`.
- ~2470–4500: piazzamento elementi casuali, interazioni con stanze e strutture, eventi generici, esplorazione.
- ~4500–5300: sconfitta/vittoria, salvataggi e campagne, flag ed `eseguiEffetti`.
- ~5700–7900: **IA delle minacce** (`creaMinaccia`, `aggiornaPercezioneMinaccia`, visibilità `luogoInVistaAiGiocatori`, memoria rumori/sbarramenti, `scegliObiettivoMinaccia`, `eseguiMovimentoMinaccia`).
- ~7790–8400: comportamento e dialoghi PNG, posizionamento personaggi nelle celle, `calcolaDestinazioniPossibili`.
- ~8700–9500: adattamento/scale-to-fit, camera (zoom/pan/pinch, `impostaInquadraturaPersonaggio`).
- ~9400–10760: prove, interazioni PNG, rendering DOM delle strutture (`creaDOMPerStruttura`).

## Concetti di gioco da conoscere

- **Tabellone**: griglia di carte con colonne e piani (strada, giardino, piano terra, piani superiori, cantina...), collegate da porte, finestre e scale. Gli **sbarramenti** (porte chiuse, cancelli, finestre) bloccano il passaggio finché non vengono aperti/abbattuti con una prova.
- **Prove**: abilità (`forza`, `tempra`, `agilita`, `intelligenza`) contro un requisito/difficoltà; modalità come `accumulo` di gruppo.
- **Fasi di turno**: azioni dei personaggi, poi `faseMinacce()`; il "Contatore Minacce" scandisce i turni dello scenario.
- **Rumori**: "Fai Rumore" con tre opzioni (Bussa sul muro 2, Attira a voce 3, Urla 4); il rumore si propaga per N carte con effetto visivo. L'adiacenza per attribuire la fonte vale solo sullo stesso piano.
- **Intelligenza delle minacce** (comportamento cumulativo):
  - 0: se vede una vittima cancella ogni informazione e ignora i rumori; senza vittime il rumore azzera memoria e designata.
  - 1+: ricordano gli sbarramenti visti da vicino e aprono porte/finestre chiuse (non a chiave), salvo regola specifica `"apreSbarramenti": false` in `minacce_base.json` (oggi solo il Cane Rabbioso M03); controllo in `minacciaApreSbarramenti()`.
  - Tutte (qualunque intelligenza, Forza > 0): abbattono le **porte** abbattibili a mani nude (quelle con `resistenza` in `carte_struttura_base.json`; mai ferro/cancelli/sbarre e non le finestre) quando non possono aprirle: ogni colpo costa 1 PA e toglie la propria Forza dalla resistenza (`colpisciPortaConMinaccia`); **abbattono solo con un motivo** (`consideraAbbattimento`, `distAbb` in `scegliObiettivoMinaccia`): (1) ipotesi su una vittima oltre la porta, se non hanno vittime in vista né ipotesi più vicine; (2) rumore udito oltre la porta; (3) tutti i luoghi accessibili già esplorati senza vittime (obiettivo `abbattimento`: il luogo non vuoto più vicino oltre una porta); regola specifica `"abbattePorte": false` in `minacce_base.json` (oggi solo il Cane Rabbioso M03, troppo piccolo); controllo in `minacciaAbbattePorte()`.
  - 1+: quando una vittima esce di vista senza causa nota (sbarramento/scale/finestra) ipotizzano la sua posizione in tutti i luoghi raggiungibili entro `RAGGIO_IPOTESI_VITTIMA` (3) passi dall'ultimo avvistamento che non vedono ora (`ipotizzaPosizioniVittimaPersa`); i luoghi che poi vedono vuoti vengono tolti dall'ipotesi (`ipotesiAmpia` in `memoriaVittime`). Con intelletto 3 e `movimentoAppreso` noto l'ipotesi si restringe ai luoghi raggiungibili con quei passi dall'inizio del movimento osservato.
  - 2+: attraversano finestre aperte/rotte tra casa e giardino (piano terra).
  - 3: distingue porta chiusa prima/dopo il movimento; ricerca del piano esteso a piani non adiacenti con reset dei luoghi vuoti.
  - Le minacce usano le scale reali e le rivelano solo se in vista ai giocatori; ricordano luoghi vuoti/inaccessibili e l'obiettivo casuale di piano persiste tra i turni.
- **Camera**: due livelli di transform distinti (zoom/pan e slide-menu). Zoom standard su 5 colonne e 3 piani, inquadratura sempre centrata in orizzontale, sfondo prolungato con copie speculari, navigazione manuale (trascina, pinch) con pulsante "Torna al personaggio". Gli zoom contestuali sono stati rimossi di proposito.
- **UI**: popup responsive e impilabili, schede personaggio in rapporto 3:4, carte 5:7, mai stirate.

## Convenzioni di lavoro

- Commit in italiano, formato `Area: descrizione` (es. `Minacce: ...`, `Camera: ...`), un cambiamento logico per commit.
- Codice, nomi di funzioni/variabili e commenti in italiano (`mostraSchermataPrincipale`, `faseMinacce`, ...). I commenti spiegano il *perché* e sono piuttosto estesi: segui lo stesso stile.
- Cambiando struttura dei dati nei JSON, controlla tutti i punti di `script.js` che li leggono (grep sul nome del campo): non ci sono schemi né test a proteggere.
- Per verificare una modifica: servi la cartella, apri nel browser (anteprima Claude o Chrome) in orizzontale, ed esercita il flusso interessato. C'è un log di diagnostica del tabellone (`DIAGNOSTICA TABELLONE`, ~riga 1979) utile per il debug.
- Non esiste un file di handoff nel repo: se ne viene prodotto uno, mettilo nella root e linkalo qui.

## Immagini delle carte (galleria)

- Stile predefinito ("V2": matita e inchiostro colorati a mano, acquarello): `tools/comfyui/stile.py`. Generazione con Qwen-Image su ComfyUI locale (condiviso con un altro progetto: non toccare i suoi workflow/output, coda vuota prima di generare) tramite `tools/comfyui/genera.py`.
- Galleria locale per scegliere le varianti: `python tools/galleria/server.py` (http://127.0.0.1:8765) o `tools/galleria/avvia_galleria.bat`. Stato in `arte/galleria.json` (approvazioni, varianti con prompt e seed, richieste di nuove varianti/modifiche); libreria `tools/galleria/galleria.py`. Le richieste `in_attesa` le evade Claude generando e registrando le nuove varianti.
- Formati: luoghi in orizzontale **3:2** (come `.carta-tabellone` 120×80; generati a 1152×768, quelli del primo lotto ritagliati a 1020×680 con gli originali 4:3 in `arte/luoghi/_originali_4x3/`), personaggi 3:4 (768×1024). Costanti in `tools/comfyui/stile.py`.
- **Layout delle carte ("Locandina") ed editor**: `tools/galleria/carta.js`+`carta.css` disegnano la carta (immagine + elementi: sfumatura, cornice, testi; scala con `cqw`), `editor.js`+`editor.css` sono l'editor (apre dalla galleria con "Modifica carta", o `/?edit=<idCarta>:<idVariante>`). Gli elementi stanno in `carta.layout.elementi` di `arte/galleria.json` (comuni a tutte le varianti), posizione/scala dell'immagine in `variante.imm = {x,y,s}`; salvataggio via `POST /api/layout`. Per un nuovo tipo di elemento: `predefiniti()` e `nodo()` in carta.js, proprietà in `pannello()` di editor.js, tipo ammesso in server.py. Le carte **personaggio** hanno anche l'elemento `statistiche` (`statistiche.js`: 6 valori pf/mov/for/int/rap/car come icona+numero; disposizione predefinita "PF in evidenza", stile "Incisione"; disegnato su uno strato non ritagliato, quindi le icone possono sporgere dal bordo: solo nella versione digitale). Valori d'esempio finché non collegati ai dati degli eroi. Anteprime: `/layout` (stili grafici) e `/stats` (disposizioni e stili delle icone).
- Immagini in `arte/<categoria>/<id>_v<N>.png` (miniature in `arte/.miniature`, rigenerabili).

- **Immagini nel gioco**: `arte/` è fuori da git, quindi le carte approvate nella galleria vanno esportate con `python tools/galleria/esporta.py` (Edge headless): scrive `assets/carte/personaggi/<Pnn>.webp` (carta completa con nome e statistiche, sfondo trasparente), `assets/carte/minacce/<Mnn>.webp` (come i personaggi, senza statistiche; il nome è quello scritto sulla carta, non `carta.nome`; argomenti opzionali `python tools/galleria/esporta.py M02` per esportare solo certi codici), `assets/carte/luoghi/<Ann>.webp` (solo i luoghi **abbandonati**, non quelli `_abitata`), `assets/carte/indice.json` e il blocco `<carte>` di `service-worker.js`. Il gioco usa `immagine` di `eroi_base.json` (eroi) e `indice.json` (luoghi, `applicaImmagineLuogo`). `eroi_base.json` ha anche `caratteristiche` (pf, pa, forza, intelletto, rapidita, carisma) per gli eroi già definiti (P02, P03); i PA (clessidra) sono la nuova meccanica in arrivo.

- **Layout predefinito delle carte personaggio** (senza `layout` salvato in `arte/galleria.json`, valori in `carta.stat`): cornice a materiale "marmo venato" (texture in `tools/galleria/texture/`, tinta chiara per eroe in `Carta.TINTE_PG`, spessore 6 cqw, giunti a 45°), icone `sigillo` scala 1,3 che sporgono del 10% dal bordo (angoli: PF e PA/clessidra; in basso: 4 caratteristiche equidistanti, +50%), nome a y=83. Altre texture generate con `tools/comfyui/genera_texture.py` (in `arte/texture/`, fuori da git).

- **Minacce (carte)**: tipo `minaccia` in galleria (`M01..M04`, immagini in `arte/minacce/`, stile: soggetto con colori normali su strada notturna dipinta solo in rosso con luci; script `tools/comfyui/genera_minacce.py`), cornice a marmo rossa (`TINTA_MINACCE` in carta.js), nome crema. Le **caratteristiche** sono le stesse dei personaggi (pf, pa, forza, intelletto, rapidita, carisma) e si modificano nel pannello "Caratteristiche" dell'editor: stanno in `carta.caratteristiche` di `arte/galleria.json` (non disegnate sulla carta). Quando l'utente le cambia (e rinomina/sceglie nuove varianti), riporta nome, `caratteristiche` e immagine in `minacce_base.json` ed esegui l'export. Il gioco legge solo `minacce_base.json` (eventuali valori `null` ricadono sui vecchi campi `movimento`, `intelligenza`, `tempra`, oggi rimossi).

## Punti Azione (PA)

- Ogni azione di un personaggio costa PA (`COSTO_PA` in script.js, ~riga 2840; tutto 1 per ora, da affinare con le prove). Il turno ricarica `pa` a pieno (`paMassimi`, default provvisorio 3 se `caratteristiche.pa` manca); i PA non spesi si perdono. Funzioni: `paSufficienti`, `spendiPA`, `aggiornaIndicatorePA` (badge "PA x/y" nell'indicatore di fase).
- Movimento: costa 1 PA e dà fino a **Rapidità** passi (`movimentoAttuale[nome]` = `caratteristiche.rapidita` o, se manca, il vecchio `movimento`); si possono fare più movimenti per turno. Scale = gratis (parte del movimento); esplorazione all'arrivo = gratis, esplorazione manuale del luogo = 1.
- Costano 1 PA: interazioni con elementi e strutture/sbarramenti (apri, chiudi, abbatti...), fare rumore, "Usa Oggetto", parlare con un PNG.
- Minacce: `creaMinaccia` legge `caratteristiche` (`movimento`=rapidita, `intelligenza`=intelletto, `carisma`) con fallback ai vecchi campi; `eseguiMovimentoMinaccia` spende PA (movimento 1, aprire sbarramento 1). Con `pa` null mantiene il comportamento precedente (un movimento, sbarramenti gratis).
- **Resistenza degli sbarramenti**: `resistenza: {min, max}` in `carte_struttura_base.json` (Porta Chiusa/Porta 3-5, a chiave 4-7, Sbarrata 5-9, Finestra Chiusa 2-4, Bloccata 3-5); al piazzamento si estrae a caso (`assicuraResistenza`, campi `resistenza`/`resistenzaMax` sulla struttura). Ogni "Abbatti"/"Rompi" apre la prova in modo `danno` (`apriProvaAbilita`): il contributo dichiarato dal giocatore, precompilato con la Forza (`forzaDi`, default provvisorio 2; oggetti e abilità li gestiscono i giocatori al tavolo), è il danno (`colpisciSbarramento`); a 0 cede. Il danno (`danno` sulla struttura) passa al nuovo stato quando lo sbarramento viene ripiazzato (apri/chiudi) tramite `applicaDannoEreditato`. Le prove costano PA solo quando il tentativo parte. Ferro (`indistruttibile`: Sbarre, Cancello, Finestra con Sbarre) non si abbatte a mani nude. Ai giocatori si mostra solo una sensazione, mai il numero. Ogni colpo (anche quello delle minacce) fa rumore con propagazione 2 (`RUMORE_COLPO_SBARRAMENTO`); il colpo che fa cedere lo sbarramento fa il rumore di abbattimento (2) o rottura (3).
- Da decidere: PF delle minacce (eliminarle, stordirle o solo fuggire), costo dell'aggressione, PA dei PNG, costi di abilità/oggetti.

## Stato attuale

Ultimo lavoro (ott 2026): IA delle minacce (movimento passo-passo, esplorazione piani, memoria sbarramenti, apertura porte/finestre chiuse, attraversamento finestre con effetto "si china") e rifiniture della camera. Aggiorna questa sezione quando cambia il filone di lavoro.
