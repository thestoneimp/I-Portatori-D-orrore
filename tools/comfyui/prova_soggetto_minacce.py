"""Prova: solo il SOGGETTO della minaccia (M01) su fondo bianco piatto, senza scena, per poi ritagliarlo e metterlo su un fondo
monocromatico a scelta. Registrato come variante di M01_uomo_impermeabile (nota 'soggetto su bianco').
Uso: python tools/comfyui/prova_soggetto_minacce.py"""
import os, sys, time
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "galleria"))
from genera import genera, coda_vuota
from stile import STILE, NEGATIVO, FORMATO_VERTICALE
import galleria as G

ID = "M01_uomo_impermeabile"
SOGGETTO = ("full figure of a tall man in a long soaked trench coat with the collar turned up and a wide-brimmed hat pulled low, "
            "his face completely hidden in deep shadow, standing motionless and menacing, three-quarter view, centered, "
            "isolated on a plain flat solid pure white background, nothing else in the image, no ground, no cast shadow, no rain, no scenery.")
STILE_SOGGETTO = STILE.replace(", textured watercolor paper", "")
NEG = ", weapon, gun, knife, pistol, holding an object, red glowing eyes, background scenery, street, ground, floor, shadow on ground, paper texture, vignette, gradient background"

if __name__ == "__main__":
    if not coda_vuota():
        sys.exit("Coda ComfyUI non vuota.")
    w, h = FORMATO_VERTICALE
    for seed in (5000, 5001):
        dati = G.carica(); carta = G.trova(dati, ID)
        vid = G.prossimo_id_variante(carta)
        rel = f"minacce/{ID}_{vid}.png"
        p = f"{SOGGETTO} {STILE_SOGGETTO}"
        t = time.time()
        genera(p, os.path.join(G.ARTE, rel), negativo=NEGATIVO + NEG, larghezza=w, altezza=h, seed=seed)
        G.aggiungi_variante(dati, ID, rel, p, seed, nota="soggetto su bianco")
        G.salva(dati)
        print(vid, seed, f"{time.time()-t:.0f}s", flush=True)
