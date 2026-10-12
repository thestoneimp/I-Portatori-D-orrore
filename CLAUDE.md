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
| `minacce_base.json` | Minacce `M01–M04` (Uomo con impermeabile, Non Morto, Cane Rabbioso, Il Cacciatore): movimento, intelligenza (0–3), tempra, forza, agilità. |
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
  - 1+: ricordano gli sbarramenti visti da vicino e aprono porte/finestre chiuse.
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

## Stato attuale

Ultimo lavoro (ott 2026): IA delle minacce (movimento passo-passo, esplorazione piani, memoria sbarramenti, apertura porte/finestre chiuse, attraversamento finestre con effetto "si china") e rifiniture della camera. Aggiorna questa sezione quando cambia il filone di lavoro.
