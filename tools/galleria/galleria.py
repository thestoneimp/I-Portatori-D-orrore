"""Archivio della galleria delle carte (arte/galleria.json): lettura/scrittura condivisa da server e script.

Struttura del file:
{
  "carte": [
    {
      "id": "P01_alice", "tipo": "personaggio", "nome": "Alice Richards",
      "formato": "verticale" | "orizzontale", "descrizione": "...",
      "approvata": "v2" | null,
      "varianti": [
        {"id": "v1", "file": "personaggi/P01_alice_v1.png", "prompt": "...", "seed": 1981,
         "nota": "", "da": null | "v2" (variante da cui deriva una modifica), "scartata": false, "creata": "..."}
      ],
      "richieste": [
        {"id": "R001", "tipo": "nuove_varianti" | "modifica", "variante": "v2" | null,
         "testo": "...", "quante": 4, "stato": "in_attesa" | "evasa" | "annullata", "creata": "...", "evasa": null, "esito": ""}
      ]
    }
  ]
}
I file immagine sono percorsi relativi alla cartella arte/.
"""
import json, os, tempfile, threading, time

RADICE = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
ARTE = os.path.join(RADICE, "arte")
FILE = os.path.join(ARTE, "galleria.json")
TIPI = ["personaggio", "luogo", "oggetto", "abilita", "sbarramento"]

_lock = threading.RLock()


def adesso():
    return time.strftime("%Y-%m-%d %H:%M:%S")


def _riprova(operazione, tentativi=40, pausa=0.25):
    """Su Windows il file può essere bloccato per un istante (Dropbox che sincronizza, antivirus, un altro
    processo che lo legge): PermissionError/OSError transitori vanno ritentati, non fanno fallire il lavoro."""
    for n in range(tentativi):
        try:
            return operazione()
        except (PermissionError, json.JSONDecodeError):
            if n == tentativi - 1:
                raise
            time.sleep(pausa)


def carica():
    def leggi():
        if not os.path.exists(FILE):
            return {"carte": []}
        with open(FILE, encoding="utf8") as f:
            return json.load(f)
    with _lock:
        return _riprova(leggi)


def salva(dati):
    with _lock:
        os.makedirs(ARTE, exist_ok=True)
        fd, tmp = tempfile.mkstemp(dir=ARTE, suffix=".tmp")
        with os.fdopen(fd, "w", encoding="utf8") as f:
            json.dump(dati, f, ensure_ascii=False, indent=2)
        try:
            _riprova(lambda: os.replace(tmp, FILE))  # scrittura atomica: mai un JSON a metà
        except Exception:
            if os.path.exists(tmp):
                os.remove(tmp)
            raise


def trova(dati, id_carta):
    return next((c for c in dati["carte"] if c["id"] == id_carta), None)


def aggiungi_carta(dati, id_carta, tipo, nome, formato="verticale", descrizione=""):
    if tipo not in TIPI:
        raise ValueError(f"tipo sconosciuto: {tipo}")
    carta = trova(dati, id_carta)
    if carta:
        return carta
    carta = {"id": id_carta, "tipo": tipo, "nome": nome, "formato": formato, "descrizione": descrizione,
             "approvata": None, "varianti": [], "richieste": []}
    dati["carte"].append(carta)
    return carta


def prossimo_id_variante(carta):
    n = max([int(v["id"][1:]) for v in carta["varianti"]] or [0])
    return f"v{n + 1}"


def aggiungi_variante(dati, id_carta, file, prompt, seed, nota="", da=None):
    """Registra una variante già generata (file relativo ad arte/). Restituisce l'id della variante."""
    carta = trova(dati, id_carta)
    vid = prossimo_id_variante(carta)
    carta["varianti"].append({"id": vid, "file": file.replace("\\", "/"), "prompt": prompt, "seed": seed,
                              "nota": nota, "da": da, "scartata": False, "creata": adesso()})
    return vid


def richieste_in_attesa(dati):
    return [(c, r) for c in dati["carte"] for r in c["richieste"] if r["stato"] == "in_attesa"]


def evadi_richiesta(dati, id_carta, id_richiesta, esito=""):
    carta = trova(dati, id_carta)
    r = next(r for r in carta["richieste"] if r["id"] == id_richiesta)
    r["stato"], r["evasa"], r["esito"] = "evasa", adesso(), esito


def nuovo_id_richiesta(dati):
    n = max([int(r["id"][1:]) for c in dati["carte"] for r in c["richieste"]] or [0])
    return f"R{n + 1:03d}"


def riepilogo(dati=None):
    """Testo compatto: carte, approvate e richieste in attesa (comodo da stampare per orientarsi)."""
    dati = dati or carica()
    righe = []
    for c in dati["carte"]:
        att = [r for r in c["richieste"] if r["stato"] == "in_attesa"]
        righe.append(f"{c['id']:<16} {c['tipo']:<12} varianti={len(c['varianti']):<3} approvata={c['approvata'] or '-':<4} richieste_in_attesa={len(att)}")
    return "\n".join(righe)


if __name__ == "__main__":
    d = carica()
    print(riepilogo(d))
    for c, r in richieste_in_attesa(d):
        print(f"\n[{r['id']}] {c['id']} {r['tipo']} variante={r['variante']} quante={r['quante']}\n  {r['testo']}")
