"""Settima tornata: tecnica V2 (matita + acquarello) con il "bagliore rosso" reso come tratteggio a linee. Solo personaggio."""
import os, sys, time
sys.path.insert(0, os.path.dirname(__file__))
from genera import genera, coda_vuota

OUT = os.path.join(os.path.dirname(__file__), "..", "..", "arte", "prove_stile_7")
os.makedirs(OUT, exist_ok=True)

BASE = ("1980s horror movie poster painting, dramatic chiaroscuro, dark palette of black, olive green and cold blue shadows with crimson red accents, "
        "ominous atmosphere, traditional hand-drawn illustration, loose pencil and ink sketch lines visible under hand-colored watercolor and colored pencil, "
        "uneven hand-applied color washes, textured watercolor paper, rough imperfect handmade look, colored by hand, 1980s horror concept art")

VARIANTI = {
    "A_tratteggio_bordi": ("the red glow is drawn entirely as thin red colored pencil hatching lines: dense parallel red pencil strokes along the edges of her hair, "
                           "shoulders and arms that thin out and fade away into the dark, like a hand-hatched red halo made only of separate red lines, no solid red outline, no soft glow"),
    "B_tratteggio_incrociato": ("red cross-hatching in loose hand-drawn red pencil and red ink lines filling the shadow areas and the background around her figure, "
                                "the red light is rendered only as scratchy red hatched lines, no solid red color fills, no continuous outline, no airbrushed glow"),
}

NEG = ("text, letters, watermark, logo, signature, digital art, vector, smooth clean gradients, cel shading, solid red outline, neon glow, airbrushed glow, "
       "cgi, 3d render, photo, anime, blurry, deformed hands, extra fingers, pink, magenta, cyan, red hair, orange hair, ginger")

SOGGETTO = ("portrait of a young woman, about 20, early 1990s college student, big permed dark chestnut brown hair, denim jacket, "
            "holding a crossbow, nervous determined expression, standing in a dark forest at night, three-quarter view, centered.")

if __name__ == "__main__":
    if not coda_vuota():
        sys.exit("Coda ComfyUI non vuota: riprovo più tardi.")
    for vk, vv in VARIANTI.items():
        dest = os.path.join(OUT, f"personaggio__{vk}.png")
        if os.path.exists(dest):
            continue
        t = time.time()
        s = genera(f"{SOGGETTO} {BASE}. {vv}", dest, negativo=NEG, larghezza=768, altezza=1024, seed=1980)
        print(f"{vk} seed={s} {time.time()-t:.0f}s", flush=True)
