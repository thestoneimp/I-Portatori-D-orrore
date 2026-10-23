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
            if re.fullmatch(r"[\w.-]+\.(js|css)", nome) and os.path.isfile(f):
                with open(f, "rb") as fh:
                    return self._invia(200, fh.read(), "text/javascript; charset=utf-8" if nome.endswith(".js") else "text/css; charset=utf-8")
        if percorso == "/layout":
            with open(os.path.join(os.path.dirname(__file__), "layout.html"), "rb") as f:
                return self._invia(200, f.read(), "text/html; charset=utf-8")
        if percorso == "/api/galleria":
            return self._invia(200, G.carica())
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
                    tipi = ("immagine", "sfumatura", "cornice", "testo")
                    if (not isinstance(elementi, list) or len(elementi) > 40 or len(json.dumps(elementi)) > 40000
                            or any(not isinstance(e, dict) or e.get("tipo") not in tipi or not isinstance(e.get("id"), str) for e in elementi)):
                        return self._invia(400, {"errore": "elementi non validi"})
                    carta["layout"] = {"modello": "locandina", "elementi": elementi}
                if im is not None:
                    var = next((x for x in carta["varianti"] if x["id"] == d.get("variante")), None)
                    if var is None:
                        return self._invia(404, {"errore": "variante inesistente"})
                    try:
                        var["imm"] = {"x": max(-100, min(100, float(im["x"]))), "y": max(-100, min(100, float(im["y"]))),
                                      "s": max(0.05, min(8, float(im["s"]))), "st": max(0.1, min(8, float(im.get("st", 1))))}
                    except (KeyError, TypeError, ValueError):
                        return self._invia(400, {"errore": "imm non valida"})
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
