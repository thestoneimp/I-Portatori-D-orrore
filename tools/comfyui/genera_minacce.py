"""Genera le immagini delle minacce M02-M04 nello stile scelto per M01: soggetto con la colorazione normale dei personaggi,
sfondo di strada notturna dipinto in rosso con giochi di luce (vedi prova_sfondo_rosso_luci_minacce.py). Per ognuna due luci
('lampione' e 'controluce'), stesso seed. Le carte sono registrate nella galleria con tipo 'minaccia'.
Uso: python tools/comfyui/genera_minacce.py"""
import os, sys, time
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "galleria"))
from genera import genera, coda_vuota
from stile import STILE, NEGATIVO, FORMATO_VERTICALE
import galleria as G

SCENA = ("a rainy night street behind it painted ONLY in shades of red: bright scarlet, deep crimson, dark burgundy and near-black red, "
         "{luce}, strong contrast between glowing bright red areas and dark red shadows, every part of the background is some shade of red.")
LUCI = {
    "lampione": "a street lamp casting a glowing bright scarlet halo with light reflecting on the wet pavement, deep dark red fog and shadows around",
    "controluce": "a blazing bright red glow rising behind it silhouetting it, dark burgundy buildings fading into shadow at the sides",
}
MINACCE = {
    "M02_non_morto": ("Non Morto", "M02 - minaccia di intelligenza 0",
        "portrait illustration of a rotting walking corpse in tattered torn clothes, gaunt grey-green decayed skin, hollow dark eye sockets, "
        "slumped shoulders and arms hanging, shambling slowly toward the viewer, three-quarter view, centered,"),
    "M03_cane_rabbioso": ("Cane Rabbioso", "M03 - minaccia di intelligenza 1",
        "portrait illustration of a large rabid dog, matted wet dark fur, lips pulled back baring teeth, foam dripping from its jaws, "
        "feral hunched stance low to the ground, snarling at the viewer, three-quarter view, centered,"),
    "M04_il_cacciatore": ("Il Cacciatore", "M04 - minaccia di intelligenza 3",
        "portrait illustration of a tall grim hunter in a heavy hooded dark leather coat with a fur collar and a hat topped with antlers, "
        "his face hidden in deep shadow, standing motionless and menacing, three-quarter view, centered,"),
}
NEG = ", red glowing eyes, blue background, green background, yellow, orange, white background, grey background, text"

if __name__ == "__main__":
    if not coda_vuota():
        sys.exit("Coda ComfyUI non vuota.")
    w, h = FORMATO_VERTICALE
    for cid, (nome, desc, soggetto) in MINACCE.items():
        for luce, testo in LUCI.items():
            dati = G.carica()
            if not any(c["id"] == cid for c in dati["carte"]):
                G.aggiungi_carta(dati, cid, "minaccia", nome, "verticale", desc)
                G.salva(dati)
            carta = G.trova(dati, cid)
            if any(v.get("nota") == "sfondo rosso luci: " + luce for v in carta["varianti"]):
                continue
            vid = G.prossimo_id_variante(carta)
            rel = f"minacce/{cid}_{vid}.png"
            p = f"{soggetto} {SCENA.format(luce=testo)} {STILE}"
            t = time.time()
            genera(p, os.path.join(G.ARTE, rel), negativo=NEGATIVO + NEG, larghezza=w, altezza=h, seed=5000)
            G.aggiungi_variante(dati, cid, rel, p, 5000, nota="sfondo rosso luci: " + luce)
            G.salva(dati)
            print(cid, luce, vid, f"{time.time()-t:.0f}s", flush=True)
