"""Lotto di prove di stile: 4 stili x 4 soggetti. Salta i file già generati."""
import os, sys, time
sys.path.insert(0, os.path.dirname(__file__))
from genera import genera, coda_vuota

OUT = os.path.join(os.path.dirname(__file__), "..", "..", "arte", "prove_stile")

STILI = {
    "A_pellicola": "authentic 1980s horror film still, shot on 35mm film, heavy film grain, harsh on-camera flash, deep shadows, "
                   "desaturated colors with sickly green and teal tint, slightly soft focus, practical effects look",
    "B_paperback": "1980s horror paperback book cover painting, hand-painted gouache and oil illustration, dramatic chiaroscuro, "
                   "rich saturated dark colors, crimson and black, ominous atmosphere, vintage pulp illustration",
    "C_vhs": "1980s direct-to-video VHS horror cover art, airbrushed painting, neon magenta and cyan rim lighting, "
             "glowing fog, dramatic backlight, retro synthwave horror, glossy airbrush gradients",
    "D_fumetto": "1980s horror comic book illustration in the style of Creepshow and EC comics, bold black ink outlines, "
                 "cross-hatching, flat vivid colors with halftone dots, lurid purple orange and green palette",
}

SOGGETTI = {
    "1_luogo": "interior of an abandoned Victorian house foyer at night, grand staircase with broken banister, peeling floral wallpaper, "
               "a single dusty chandelier, moonlight through a shattered window, a closed wooden door at the end of the hall. No people.",
    "2_personaggio": "portrait of a young woman, about 20, early 1990s college student, big permed hair, denim jacket with patches, "
                     "holding a crossbow, nervous determined expression, standing in a dark forest at night, three-quarter view, centered.",
    "3_oggetto": "a single old silver crucifix and a worn leather-bound Bible resting on a dusty wooden table, "
                 "lit by a candle, close-up still life, dark background, centered composition. No people.",
    "4_abilita": "a priest in a dark coat performing an exorcism, one hand raised holding a holy cross, "
                 "a pale ghostly shape writhing in black smoke before him, dramatic energy, in an old dark room, dynamic composition.",
}

NEG = "text, watermark, logo, signature, modern smartphone, cgi, 3d render, cartoon, anime, blurry, deformed hands, extra fingers"

if __name__ == "__main__":
    if not coda_vuota():
        sys.exit("Coda ComfyUI non vuota: riprovo più tardi.")
    for sk, sv in SOGGETTI.items():
        for stk, stv in STILI.items():
            dest = os.path.join(OUT, f"{sk}__{stk}.png")
            if os.path.exists(dest):
                continue
            t = time.time()
            s = genera(f"{sv} {stv}", dest, negativo=NEG, larghezza=768, altezza=1024, seed=1980)
            print(f"{sk} {stk} seed={s} {time.time()-t:.0f}s", flush=True)
