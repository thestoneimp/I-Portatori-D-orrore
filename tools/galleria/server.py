"""Server locale della galleria delle carte. Ascolta SOLO su 127.0.0.1 (non raggiungibile da altri dispositivi).

Uso:  python tools/galleria/server.py [porta]     (default 8765)  ->  http://127.0.0.1:8765
Non chiama ComfyUI: registra solo scelte e richieste in arte/galleria.json, che vengono poi evase da Claude.
"""
import json, mimetypes, os, re, sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlparse

sys.path.insert(0, os.path.dirname(__file__))
import galleria as G

PAGINA = os.path.join(os.path.dirname(__file__), "index.html")
RADICE = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
ZONE = os.path.join(RADICE, "assets", "carte", "zone.json")                       # zone cliccabili degli elementi (lette dal gioco)
ELEMENTI = os.path.join(RADICE, "elementi_interagibili_base.json")                # catalogo degli elementi interagibili
CATALOGO = os.path.join(RADICE, "oggetti_base.json")                              # carte oggetto e abilità del gioco
TAG_VALIDI = ("tagliente", "leva", "fuoco", "luce", "chiave", "sacro", "sparo")   # come TAG in oggetto.js e ICONE_TAG in script.js
ABILITA_VALIDE = ("forza", "tempra", "atletica", "intelletto", "rapidita", "carisma", "tutte")


def catalogo_valido(carte):
    """Controllo prima di scrivere sul file del gioco: id univoci, nome presente, modificatori e tag noti, testi non enormi."""
    if not isinstance(carte, list) or not 1 <= len(carte) <= 500:
        return False
    visti = set()
    for c in carte:
        if (not isinstance(c, dict) or not isinstance(c.get("id"), str) or not re.fullmatch(r"(AB|OG)\d{2,3}", c["id"]) or c["id"] in visti
                or c.get("tipo") not in ("oggetto", "abilita") or not isinstance(c.get("nome"), str) or not 1 <= len(c["nome"].strip()) <= 60
                or not isinstance(c.get("descrizione", ""), str) or len(c.get("descrizione", "")) > 600):
            return False
        visti.add(c["id"])
        for m in c.get("modificatori") or []:
            if (not isinstance(m, dict) or m.get("abilita") not in ABILITA_VALIDE or isinstance(m.get("valore"), bool)
                    or not isinstance(m.get("valore"), int) or not -9 <= m["valore"] <= 9):
                return False
        t = c.get("tag") or []
        if not isinstance(t, list) or len(t) > 2 or any(x not in TAG_VALIDI for x in t):
            return False
        cons = c.get("consulta")
        if cons is not None and (not isinstance(cons, dict) or len(cons) > 20
                                 or any(not isinstance(k, str) or not isinstance(v, str) or len(v) > 1500 for k, v in cons.items())):
            return False
    return True


def leggi_zone():
    try:
        with open(ZONE, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def scrivi_zone(zone):
    """Stesso formato scritto a mano: un poligono per riga."""
    righe = ["{"]
    luoghi = []
    for chiave, elementi in zone.items():
        zz = []
        for nome, z in elementi.items():
            pts = ",".join("[" + ",".join(("%g" % round(v, 1)) for v in p) + "]" for p in z["poligono"])
            zz.append(f'    {json.dumps(nome, ensure_ascii=False)}: {{\n      "poligono": [{pts}]\n    }}')
        luoghi.append(f'  {json.dumps(chiave)}: {{\n' + ",\n".join(zz) + "\n  }")
    righe.append(",\n".join(luoghi))
    righe.append("}")
    with open(ZONE, "w", encoding="utf-8", newline="") as f:
        f.write("\n".join(righe) + "\n")


def zone_valide(zone):
    """Elementi -> {poligono: [[x, y], ...]} con coordinate in % (0-100): controllo prima di scrivere sul file del gioco."""
    if not isinstance(zone, dict) or len(zone) > 40:
        return False
    for nome, z in zone.items():
        if not isinstance(nome, str) or not 1 <= len(nome) <= 60 or not isinstance(z, dict):
            return False
        p = z.get("poligono")
        if not isinstance(p, list) or not 3 <= len(p) <= 80:
            return False
        for q in p:
            if (not isinstance(q, list) or len(q) != 2
                    or any(isinstance(v, bool) or not isinstance(v, (int, float)) or not 0 <= v <= 100 for v in q)):
                return False
    return True


MINIATURE = os.path.join(G.ARTE, ".miniature")


def miniatura(relativo, larghezza=520, cartella=None):
    """Miniatura JPEG (in cache in arte/.miniature) di un'immagine di arte/; None se il file non esiste/non è valido."""
    from PIL import Image
    src = os.path.abspath(os.path.join(G.ARTE, relativo))
    if not (src.startswith(G.ARTE + os.sep) and os.path.isfile(src)):
        return None
    dst = os.path.join(cartella or MINIATURE, os.path.splitext(relativo)[0] + ".jpg")
    if not os.path.exists(dst) or os.path.getmtime(dst) < os.path.getmtime(src):
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        with Image.open(src) as im:
            im = im.convert("RGB")
            im.thumbnail((larghezza, larghezza * 2))
            im.save(dst, "JPEG", quality=88)
    return dst


class Gestore(BaseHTTPRequestHandler):
    def log_message(self, *a):  # silenzioso
        pass

    def handle(self):
        try:
            super().handle()
        except (ConnectionResetError, BrokenPipeError, ConnectionAbortedError):
            pass  # il browser ha chiuso la connessione (pagina ridisegnata, scheda chiusa...): non è un errore

    def _invia(self, codice, corpo, tipo="application/json; charset=utf-8"):
        if isinstance(corpo, (dict, list)):
            corpo = json.dumps(corpo, ensure_ascii=False).encode("utf8")
        self.send_response(codice)
        self.send_header("Content-Type", tipo)
        self.send_header("Content-Length", str(len(corpo)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        # a blocchi: su Windows un'unica write() di 1-2 MB sul loopback può essere interrotta a metà
        for i in range(0, len(corpo), 64 * 1024):
            self.wfile.write(corpo[i:i + 64 * 1024])
            self.wfile.flush()

    def do_GET(self):
        percorso = unquote(urlparse(self.path).path)
        if percorso in ("/", "/index.html"):
            with open(PAGINA, "rb") as f:
                return self._invia(200, f.read(), "text/html; charset=utf-8")
        if percorso.startswith("/s/"):
            nome = percorso[3:]
            f = os.path.join(os.path.dirname(__file__), nome)
            if re.fullmatch(r"(texture/)?[\w.-]+\.(js|css|png)", nome) and os.path.isfile(f):
                with open(f, "rb") as fh:
                    tipo = {"js": "text/javascript; charset=utf-8", "css": "text/css; charset=utf-8", "png": "image/png"}[nome.rsplit(".", 1)[1]]
                    return self._invia(200, fh.read(), tipo)
        if percorso == "/stats":
            with open(os.path.join(os.path.dirname(__file__), "stats.html"), "rb") as f:
                return self._invia(200, f.read(), "text/html; charset=utf-8")
        if percorso == "/oggetti":   # anteprima delle varianti di layout delle carte oggetto
            with open(os.path.join(os.path.dirname(__file__), "oggetti.html"), "rb") as f:
                return self._invia(200, f.read(), "text/html; charset=utf-8")
        if percorso == "/catalogo":   # elenco modificabile degli oggetti del gioco (legge e scrive oggetti_base.json)
            with open(os.path.join(os.path.dirname(__file__), "catalogo.html"), "rb") as f:
                return self._invia(200, f.read(), "text/html; charset=utf-8")
        if percorso == "/api/catalogo":
            with open(CATALOGO, encoding="utf-8") as f:
                return self._invia(200, json.load(f))
        if percorso == "/esporta":   # pagina usata da esporta.py
            with open(os.path.join(os.path.dirname(__file__), "esporta.html"), "rb") as f:
                return self._invia(200, f.read(), "text/html; charset=utf-8")
        if percorso == "/layout":
            with open(os.path.join(os.path.dirname(__file__), "layout.html"), "rb") as f:
                return self._invia(200, f.read(), "text/html; charset=utf-8")
        if percorso == "/api/galleria":
            return self._invia(200, G.carica())
        if percorso == "/api/zone":
            return self._invia(200, leggi_zone())
        if percorso == "/api/elementi":   # nomi degli elementi interagibili del gioco (per dare un nome alle zone)
            try:
                with open(ELEMENTI, encoding="utf-8") as f:
                    return self._invia(200, sorted({e["nome"] for e in json.load(f)}))
            except (OSError, ValueError, KeyError):
                return self._invia(200, [])
        if percorso.startswith("/mini/"):
            mini = miniatura(percorso[len("/mini/"):])
            if mini:
                with open(mini, "rb") as fh:
                    return self._invia(200, fh.read(), "image/jpeg")
        if percorso.startswith("/media/"):  # formato intermedio (1100 px) per le anteprime dei layout
            mini = miniatura(percorso[len("/media/"):], 1100, os.path.join(G.ARTE, ".media"))
            if mini:
                with open(mini, "rb") as fh:
                    return self._invia(200, fh.read(), "image/jpeg")
        if percorso.startswith("/arte/"):
            f = os.path.abspath(os.path.join(G.ARTE, percorso[len("/arte/"):]))
            if f.startswith(G.ARTE + os.sep) and os.path.isfile(f):
                with open(f, "rb") as fh:
                    return self._invia(200, fh.read(), mimetypes.guess_type(f)[0] or "application/octet-stream")
        self._invia(404, {"errore": "non trovato"})

    def do_POST(self):
        n = int(self.headers.get("Content-Length") or 0)
        try:
            d = json.loads(self.rfile.read(n) or b"{}")
        except ValueError:
            return self._invia(400, {"errore": "JSON non valido"})
        if urlparse(self.path).path == "/api/catalogo":
            if not catalogo_valido(d):
                return self._invia(400, {"errore": "catalogo non valido"})
            with open(CATALOGO, "w", encoding="utf-8", newline="") as f:   # stesso formato del file (2 spazi, accenti, CRLF)
                f.write(json.dumps(d, indent=2, ensure_ascii=False).replace(chr(10), chr(13) + chr(10)))
            return self._invia(200, {"ok": True, "carte": len(d)})
        with G._lock:
            dati = G.carica()
            carta = G.trova(dati, d.get("carta", ""))
            if not carta:
                return self._invia(404, {"errore": "carta inesistente"})
            p = urlparse(self.path).path

            if p == "/api/approva":  # variante=null toglie l'approvazione
                v = d.get("variante")
                if v is not None and not any(x["id"] == v for x in carta["varianti"]):
                    return self._invia(404, {"errore": "variante inesistente"})
                carta["approvata"] = v
            elif p == "/api/scarta":
                for x in carta["varianti"]:
                    if x["id"] == d.get("variante"):
                        x["scartata"] = bool(d.get("scartata", True))
                        if x["scartata"] and carta["approvata"] == x["id"]:
                            carta["approvata"] = None
            elif p == "/api/richiesta":
                tipo = d.get("tipo")
                if tipo not in ("nuove_varianti", "modifica"):
                    return self._invia(400, {"errore": "tipo richiesta non valido"})
                if tipo == "modifica" and not any(x["id"] == d.get("variante") for x in carta["varianti"]):
                    return self._invia(400, {"errore": "serve una variante esistente da modificare"})
                carta["richieste"].append({
                    "id": G.nuovo_id_richiesta(dati), "tipo": tipo,
                    "variante": d.get("variante") if tipo == "modifica" else None,
                    "testo": (d.get("testo") or "").strip(),
                    "quante": max(1, min(8, int(d.get("quante") or (1 if tipo == "modifica" else 4)))),
                    "stato": "in_attesa", "creata": G.adesso(), "evasa": None, "esito": ""})
            elif p == "/api/layout":
                elementi, im = d.get("elementi"), d.get("imm")
                if elementi is not None:
                    tipi = ("immagine", "sfumatura", "cornice", "testo", "statistiche", "oggetto")
                    if (not isinstance(elementi, list) or len(elementi) > 40 or len(json.dumps(elementi)) > 40000
                            or any(not isinstance(e, dict) or e.get("tipo") not in tipi or not isinstance(e.get("id"), str) for e in elementi)):
                        return self._invia(400, {"errore": "elementi non validi"})
                    carta["layout"] = {"modello": "locandina", "elementi": elementi}
                car = d.get("caratteristiche")
                if car is not None:
                    chiavi = ("pf", "pa", "forza", "intelletto", "rapidita", "carisma")
                    if (carta["tipo"] != "minaccia" or not isinstance(car, dict) or set(car) - set(chiavi)
                            or any(car[k] is not None and (not isinstance(car[k], int) or isinstance(car[k], bool) or not 0 <= car[k] <= 99) for k in car)):
                        return self._invia(400, {"errore": "caratteristiche non valide"})
                    carta["caratteristiche"] = car
                if im is not None:
                    var = next((x for x in carta["varianti"] if x["id"] == d.get("variante")), None)
                    if var is None:
                        return self._invia(404, {"errore": "variante inesistente"})
                    try:
                        var["imm"] = {"x": max(-100, min(100, float(im["x"]))), "y": max(-100, min(100, float(im["y"]))),
                                      "s": max(0.05, min(8, float(im["s"]))), "st": max(0.1, min(8, float(im.get("st", 1))))}
                    except (KeyError, TypeError, ValueError):
                        return self._invia(400, {"errore": "imm non valida"})
            elif p == "/api/zone":
                chiave, zone = d.get("chiave"), d.get("zone")
                if not isinstance(chiave, str) or not re.fullmatch(r"\w{1,40}", chiave) or not zone_valide(zone):
                    return self._invia(400, {"errore": "zone non valide"})
                tutte = leggi_zone()
                if zone:
                    tutte[chiave] = zone
                else:
                    tutte.pop(chiave, None)
                scrivi_zone(tutte)
                return self._invia(200, {"ok": True})
            elif p == "/api/richiesta/annulla":
                for r in carta["richieste"]:
                    if r["id"] == d.get("id") and r["stato"] == "in_attesa":
                        r["stato"] = "annullata"
            else:
                return self._invia(404, {"errore": "endpoint sconosciuto"})
            G.salva(dati)
            self._invia(200, dati)


if __name__ == "__main__":
    porta = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    print(f"Galleria su http://127.0.0.1:{porta}  (Ctrl+C per fermare)")
    ThreadingHTTPServer(("127.0.0.1", porta), Gestore).serve_forever()
