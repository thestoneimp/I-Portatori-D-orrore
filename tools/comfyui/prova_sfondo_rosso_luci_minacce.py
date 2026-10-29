"""Prova: soggetto con la colorazione normale dei personaggi, sfondo SOLO in sfumature di rosso ma con giochi di luce e contrasti
(rosso acceso, rosso scuro, porpora, bordeaux), come nelle carte personaggio. Tre impostazioni di luce, stesso seed.
Registrato come varianti di M01_uomo_impermeabile (nota 'sfondo rosso luci: <nome>').
Uso: python tools/comfyui/prova_sfondo_rosso_luci_minacce.py"""
import os, sys, time
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "galleria"))
from genera import genera, coda_vuota
from stile import STILE, NEGATIVO, FORMATO_VERTICALE
import galleria as G

ID = "M01_uomo_impermeabile"
SOGGETTO = ("portrait illustration of a tall man in a long soaked trench coat with the collar turned up and a wide-brimmed hat pulled low, "
            "his face completely hidden in deep shadow, standing motionless and menacing, three-quarter view, centered, "
            "a rainy night street behind him painted ONLY in shades of red: bright scarlet, deep crimson, dark burgundy, purple-red and near-black red, "
            "{luce}, strong contrast between glowing bright red areas and dark red shadows, every part of the background is some shade of red.")
LUCI = {
    "lampione": "a street lamp casting a glowing bright scarlet halo with light reflecting on the wet pavement, deep dark red fog and shadows around",
    "controluce": "a blazing bright red glow rising behind the man silhouetting him, dark burgundy and purple-red buildings fading into shadow at the sides",
    "nebbia": "thick glowing red fog lit from above, layered bands of bright red, crimson and dark purple-red depth, light streaks of rain",
}
NEG = ", weapon, gun, knife, pistol, holding an object, red glowing eyes, blue background, green background, yellow, orange, white background, grey background"

if __name__ == "__main__":
    if not coda_vuota():
        sys.exit("Coda ComfyUI non vuota.")
    w, h = FORMATO_VERTICALE
    for nome, luce in LUCI.items():
        dati = G.carica(); carta = G.trova(dati, ID)
        if any(v.get("nota") == "sfondo rosso luci: " + nome for v in carta["varianti"]):
            continue
        vid = G.prossimo_id_variante(carta)
        rel = f"minacce/{ID}_{vid}.png"
        p = f"{SOGGETTO.format(luce=luce)} {STILE}"
        t = time.time()
        genera(p, os.path.join(G.ARTE, rel), negativo=NEGATIVO + NEG, larghezza=w, altezza=h, seed=5000)
        G.aggiungi_variante(dati, ID, rel, p, 5000, nota="sfondo rosso luci: " + nome)
        G.salva(dati)
        print(nome, vid, f"{time.time()-t:.0f}s", flush=True)
