"""Quarta tornata: stile B ORIGINALE (identico alla prima tornata, senza effetti della C), soggetti nuovi."""
import os, sys, time
sys.path.insert(0, os.path.dirname(__file__))
from genera import genera, coda_vuota

OUT = os.path.join(os.path.dirname(__file__), "..", "..", "arte", "prove_stile_4")
os.makedirs(OUT, exist_ok=True)

STILE = ("1980s horror paperback book cover painting, hand-painted gouache and oil illustration, dramatic chiaroscuro, "
         "rich saturated dark colors, crimson and black, ominous atmosphere, vintage pulp illustration")

NEG = "text, watermark, logo, signature, modern smartphone, cgi, 3d render, cartoon, anime, blurry, deformed hands, extra fingers"

CARTE = [
    ("1_luogo_cantina", 1024, 768,
     "wide landscape view of a damp stone cellar in an old abandoned house at night, low vaulted brick ceiling, rusty pipes, "
     "wooden shelves with dusty jars, a single bare hanging light bulb, a dark open doorway at the back, puddles on the floor. No people."),
    ("2_luogo_giardino", 1024, 768,
     "wide landscape view of an overgrown back garden of an old abandoned house at night, twisted dead trees, tall dry grass, "
     "a rusty wrought iron fence, a crooked wooden shed, the dark silhouette of the house looming in the background, full moon. No people."),
    ("3_personaggio", 768, 1024,
     "portrait of a young woman, about 25, early 1990s occultist student, long straight black hair, dark long coat, "
     "silver rings and a pendant, holding a thick ancient grimoire in one hand and a ritual dagger in the other, "
     "mysterious intense expression, standing in a dark candlelit library, three-quarter view, centered."),
    ("4_oggetto", 768, 1024,
     "a single 1980s military field radio with antenna, dials and a handset on a cord, resting on a dusty wooden table, "
     "dimly lit by a lantern, close-up still life, dark background, centered composition. No people."),
    ("5_abilita", 768, 1024,
     "a young woman crouching behind a fallen tree aiming a crossbow straight at a monstrous clawed creature emerging from the dark forest, "
     "arrow trained on its glowing eyes, tense dynamic composition, dark night woods."),
]

if __name__ == "__main__":
    if not coda_vuota():
        sys.exit("Coda ComfyUI non vuota: riprovo più tardi.")
    for nome, w, h, soggetto in CARTE:
        dest = os.path.join(OUT, f"{nome}.png")
        if os.path.exists(dest):
            continue
        t = time.time()
        s = genera(f"{soggetto} {STILE}", dest, negativo=NEG, larghezza=w, altezza=h, seed=1980)
        print(f"{nome} seed={s} {time.time()-t:.0f}s", flush=True)
