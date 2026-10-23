"""Quinta tornata: stile B reso più "disegnato e colorato a mano" (riferimento di tecnica: locandina dipinta anni '80).
Solo luogo (orizzontale) e personaggio, in due varianti di tecnica."""
import os, sys, time
sys.path.insert(0, os.path.dirname(__file__))
from genera import genera, coda_vuota

OUT = os.path.join(os.path.dirname(__file__), "..", "..", "arte", "prove_stile_5")
os.makedirs(OUT, exist_ok=True)

BASE = "1980s horror movie poster painting, dramatic chiaroscuro, dark palette of deep crimson red, black, olive green and cold blue shadows, ominous atmosphere"

TECNICHE = {
    "V1_locandina_dipinta": (
        "traditional hand-painted illustration on paper, airbrush and gouache painting, visible brush strokes and paint texture, "
        "soft hand-blended gradients, painterly rendering with no hard outlines, subtle paper grain, rough imperfect handmade look, "
        "like a vintage 1984 theatrical horror poster artwork"),
    "V2_matita_acquarello": (
        "traditional hand-drawn illustration, loose pencil and ink sketch lines visible under hand-colored watercolor and colored pencil, "
        "uneven hand-applied color washes, visible pencil hatching, textured watercolor paper, rough imperfect handmade look, "
        "colored by hand, 1980s horror concept art"),
}

NEG = ("text, letters, watermark, logo, signature, digital art, vector, smooth clean gradients, cel shading, clean perfect lines, "
       "cgi, 3d render, photo, anime, blurry, deformed hands, extra fingers, pink, magenta, cyan")

SOGGETTI = [
    ("luogo", 1024, 768,
     "wide landscape view of an abandoned Victorian house foyer at night, grand staircase with broken banister, peeling floral wallpaper, "
     "a dusty chandelier, moonlight through a shattered window, a closed wooden door at the end of the hall. No people."),
    ("personaggio", 768, 1024,
     "portrait of a young woman, about 20, early 1990s college student, big permed chestnut brown hair, denim jacket with patches, "
     "holding a crossbow, nervous determined expression, standing in a dark forest at night, three-quarter view, centered."),
]

if __name__ == "__main__":
    if not coda_vuota():
        sys.exit("Coda ComfyUI non vuota: riprovo più tardi.")
    for nome, w, h, soggetto in SOGGETTI:
        for tk, tv in TECNICHE.items():
            dest = os.path.join(OUT, f"{nome}__{tk}.png")
            if os.path.exists(dest):
                continue
            t = time.time()
            s = genera(f"{soggetto} {BASE}. {tv}", dest, negativo=NEG, larghezza=w, altezza=h, seed=1980)
            print(f"{nome} {tk} seed={s} {time.time()-t:.0f}s", flush=True)
