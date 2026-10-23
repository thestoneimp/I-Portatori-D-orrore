"""Sesta tornata: tecnica V2 (matita + acquarello) con l'effetto "contorno rosso" dello stile B originale. Solo personaggio."""
import os, sys, time
sys.path.insert(0, os.path.dirname(__file__))
from genera import genera, coda_vuota

OUT = os.path.join(os.path.dirname(__file__), "..", "..", "arte", "prove_stile_6")
os.makedirs(OUT, exist_ok=True)

BASE = ("1980s horror movie poster painting, dramatic chiaroscuro, dark palette of deep crimson red, black, olive green and cold blue shadows, "
        "ominous atmosphere, traditional hand-drawn illustration, loose pencil and ink sketch lines visible under hand-colored watercolor and colored pencil, "
        "uneven hand-applied color washes, visible pencil hatching, textured watercolor paper, rough imperfect handmade look, colored by hand, 1980s horror concept art")

VARIANTI = {
    "A_bagliore_rosso": ("strong crimson red rim light glowing along the edges of her hair, shoulders, arms and the surrounding tree trunks, "
                         "intense red backlight halo around the whole silhouette, red glow on every outer edge"),
    "B_contorno_disegnato": ("a thick hand-drawn crimson red ink outline around her entire figure, her hair and the tree trunks, "
                             "bold red contour line tracing every outer edge, red outlined silhouette against the dark forest, red rim glow"),
}

NEG = ("text, letters, watermark, logo, signature, digital art, vector, smooth clean gradients, cel shading, "
       "cgi, 3d render, photo, anime, blurry, deformed hands, extra fingers, pink, magenta, cyan")

SOGGETTO = ("portrait of a young woman, about 20, early 1990s college student, big permed chestnut brown hair, denim jacket, "
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
