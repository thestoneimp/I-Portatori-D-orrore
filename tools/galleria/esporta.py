"""Esporta nel gioco le carte APPROVATE nella galleria (arte/ non è nel repo: qui nascono le immagini che il gioco usa davvero).
 - personaggi: la carta completa (illustrazione + nome + statistiche, con le icone che sporgono: margine trasparente) -> assets/carte/personaggi/<Pnn>.webp
 - minacce: la carta completa come i personaggi (nome, cornice rossa; senza statistiche) -> assets/carte/minacce/<Mnn>.webp
 - luoghi "abbandonati": solo l'illustrazione ritagliata come nella galleria, 3:2 -> assets/carte/luoghi/<Ann>.webp
   (i luoghi "_abitata" sono volutamente esclusi: se ne riparlerà)
 - assets/carte/indice.json (elenco dei luoghi con immagine, letto dal gioco) e il blocco <carte> di service-worker.js (precache)
Disegna con Edge headless sul server della galleria avviato qui su un'altra porta. Uso: python tools/galleria/esporta.py [codice ...]"""
import json, os, re, subprocess, sys, tempfile, threading, time
from http.server import ThreadingHTTPServer

sys.path.insert(0, os.path.dirname(__file__))
import galleria as G
from server import Gestore
from PIL import Image

RADICE = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
PORTA = 8766
LARGH_PG, MARGINE_PG = 640, 64          # carta 640x853 (3:4) + 64 px attorno per le icone che sporgono
LARGH_LUOGO = 600                        # 600x400 (3:2)

def scatta(url, png, larghezza, altezza):
    prof = tempfile.mkdtemp(prefix="esporta_")
    if os.path.exists(png):
        os.remove(png)
    subprocess.run([EDGE, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
                    f"--user-data-dir={prof}", "--virtual-time-budget=15000",
                    f"--window-size={larghezza},{altezza}", f"--screenshot={png}", url], timeout=120,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(60):   # Edge può terminare il processo di lancio prima di aver scritto il file
        if os.path.exists(png) and os.path.getsize(png) > 0:
            time.sleep(0.3)
            return
        time.sleep(0.5)
    raise RuntimeError("screenshot non prodotto: " + url)


def trasparente(url, png, larghezza, altezza):
    """Edge headless non dà sfondo trasparente: si scatta su nero e su bianco e si ricava l'alpha dalla differenza
    (alpha = 1 - (bianco - nero)), così ombre, alone del nome e bordi antialias restano esatti."""
    scatta(url + "&sfondo=%23000", png, larghezza, altezza)
    nero = Image.open(png).convert("RGB")
    scatta(url + "&sfondo=%23fff", png, larghezza, altezza)
    bianco = Image.open(png).convert("RGB")
    out = []
    for (r, g, b), (R, G_, B) in zip(nero.getdata(), bianco.getdata()):
        a = 255 - (R - r + G_ - g + B - b) / 3
        if a >= 254.5:
            out.append((r, g, b, 255))
        elif a < 1:
            out.append((0, 0, 0, 0))
        else:   # il colore sul nero è colore*alpha: lo si "scompone" di nuovo
            k = 255 / a
            out.append((min(255, round(r * k)), min(255, round(g * k)), min(255, round(b * k)), round(a)))
    im = Image.new("RGBA", nero.size)
    im.putdata(out)
    return im


if __name__ == "__main__":
    srv = ThreadingHTTPServer(("127.0.0.1", PORTA), Gestore)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    # /esporta serve la pagina esporta.html (vedi server.py)
    tmp = tempfile.mkdtemp(prefix="esporta_png_")
    dati = G.carica()
    for c in dati["carte"]:
        if not c.get("approvata"):
            continue
        if c["tipo"] in ("personaggio", "minaccia"):
            cod, dest, w, h, q = c["id"].split("_")[0], "personaggi" if c["tipo"] == "personaggio" else "minacce", LARGH_PG + 2 * MARGINE_PG, round(LARGH_PG * 4 / 3) + 2 * MARGINE_PG, f"&larghezza={LARGH_PG}&margine={MARGINE_PG}"
        elif c["tipo"] == "luogo" and not c["id"].endswith("_abitata"):
            cod, dest, w, h, q = c["id"].split("_")[0], "luoghi", LARGH_LUOGO, round(LARGH_LUOGO / 1.5), f"&larghezza={LARGH_LUOGO}&solo=1"
        else:
            continue
        if sys.argv[1:] and cod not in sys.argv[1:]:   # facoltativo: esporta solo i codici indicati (es. M02)
            continue
        png = os.path.join(tmp, cod + ".png")
        url = f"http://127.0.0.1:{PORTA}/esporta?carta={c['id']}{q}"
        if dest in ("personaggi", "minacce"):
            im = trasparente(url, png, w, h)
        else:   # i luoghi sono rettangoli pieni: niente trasparenza
            for _ in range(3):   # a volte l'immagine grande non è ancora decodificata allo scatto: si riprova se è tutto nero
                scatta(url, png, w, h)
                im = Image.open(png).convert("RGB")
                if im.getextrema() != ((0, 0), (0, 0), (0, 0)):
                    break
        out = os.path.join(RADICE, "assets", "carte", dest, cod + ".webp")
        os.makedirs(os.path.dirname(out), exist_ok=True)
        im.save(out, "WEBP", quality=88, method=6)
        print(cod, c["approvata"], os.path.getsize(out) // 1024, "KB", flush=True)
    # elenco per il gioco + precache del service worker
    cartella = os.path.join(RADICE, "assets", "carte")
    luoghi = sorted(f[:-5] for f in os.listdir(os.path.join(cartella, "luoghi")) if f.endswith(".webp"))
    personaggi = sorted(f[:-5] for f in os.listdir(os.path.join(cartella, "personaggi")) if f.endswith(".webp"))
    minacce = sorted(f[:-5] for f in os.listdir(os.path.join(cartella, "minacce")) if f.endswith(".webp"))
    with open(os.path.join(cartella, "indice.json"), "w", encoding="utf-8", newline="") as f:
        json.dump({"luoghi": luoghi, "personaggi": personaggi, "minacce": minacce}, f, indent=2)
    voci = (["assets/carte/indice.json"] + [f"assets/carte/luoghi/{x}.webp" for x in luoghi]
            + [f"assets/carte/personaggi/{x}.webp" for x in personaggi] + [f"assets/carte/minacce/{x}.webp" for x in minacce])
    sw = os.path.join(RADICE, "service-worker.js")
    with open(sw, encoding="utf-8", newline="") as f:
        t = f.read()
    nl = chr(13) + chr(10) if chr(13) in t else chr(10)
    blocco = "  // <carte> generato da tools/galleria/esporta.py: non modificare a mano" + nl + "".join(f'  "./{v}",{nl}' for v in voci) + "  // </carte>"
    t = re.sub(r"  // <carte>.*?// </carte>", lambda m: blocco, t, flags=re.S)
    with open(sw, "w", encoding="utf-8", newline="") as f:
        f.write(t)
    print("indice.json e service-worker.js aggiornati")
