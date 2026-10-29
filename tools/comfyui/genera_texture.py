"""Genera texture di materiali (legno, marmo, pietra ...) per le cornici delle carte, a media luminosita'
cosi' da poterle colorare a piacere (multiply / tinta) anche in vettoriale. Output in arte/texture/<id>_v<N>.png.
Uso: python tools/comfyui/genera_texture.py [id ...]"""
import os, sys, time
sys.path.insert(0, os.path.dirname(__file__))
from genera import genera, coda_vuota

BASE = ("flat top-down close-up photograph of {m}, filling the entire frame edge to edge, uniform even lighting, no shadows, "
        "no perspective, no objects, no border, seamless tileable material texture, high detail, sharp, strong contrast, rich visible grain and relief, natural mid-tone colors")
NEG = "text, letters, watermark, frame, border, object, person, hand, perspective, vignette, dark shadows, strong color, cartoon, drawing"

MATERIALI = {
    "legno_chiaro": "light oak wooden planks with fine straight grain",
    "legno_antico": "old weathered dark wood board with deep grain, cracks and knots",
    "marmo_venato": "white carrara marble slab with distinct dark grey veins",
    "marmo_nero": "polished black marble with thin white veins",
    "pietra_tombale": "weathered speckled grey granite gravestone surface with lichen stains, uniform without any recess",
    "pietra_grezza": "rough cut sandstone with cracks and chisel marks",
    "intonaco": "peeling cracked old plaster wall with damp stains",
    "metallo_arrugginito": "rusty corroded iron plate with scratches and rivet marks",
    "cuoio": "old worn leather with creases and stitching texture",
    "carta_parati": "faded damask victorian wallpaper pattern with stains and tears",
    "mattoni": "old crumbling brick wall with moss and mortar",
    "osso_avorio": "aged yellowed ivory bone surface with fine cracks",
}

if __name__ == "__main__":
    if not coda_vuota():
        sys.exit("Coda ComfyUI non vuota: riprovo più tardi.")
    ids = sys.argv[1:] or list(MATERIALI)
    for i, k in enumerate(ids):
        for v in (1,):
            dest = f"arte/texture/{k}_v{v}.png"
            if os.path.exists(dest): continue
            t = time.time()
            s = genera(BASE.format(m=MATERIALI[k]), dest, NEG, 768, 768, seed=7000 + 100 * list(MATERIALI).index(k) + v)
            print(k, v, "seed", s, f"{time.time()-t:.0f}s", flush=True)
