"""Seconda tornata di prove: stile B (paperback dipinto) + effetti luminosi della C (nebbia, fumo, aloni bianchi)."""
import os, sys, time
sys.path.insert(0, os.path.dirname(__file__))
from genera import genera, coda_vuota

OUT = os.path.join(os.path.dirname(__file__), "..", "..", "arte", "prove_stile_2")
os.makedirs(OUT, exist_ok=True)

STILE = ("1980s horror paperback book cover painting, hand-painted gouache and oil illustration, dramatic chiaroscuro, "
         "rich dark palette of crimson red, black, sickly olive green and aged yellow ochre, vintage pulp illustration. "
         "Atmospheric lighting effects: thick volumetric fog, drifting smoke, soft white-silver glowing halo and ethereal luminous aura, "
         "god rays of pale light cutting through mist, glowing backlight, luminous haze. No neon pink, no cyan, no frame, no border, no text.")

NEG = ("text, letters, numbers, writing, watermark, logo, signature, border, frame, neon pink, cyan, magenta, "
       "cgi, 3d render, photo, anime, blurry, deformed hands, extra fingers")

# (nome, larghezza, altezza, soggetto)
CARTE = [
    ("1_luogo_orizzontale", 1024, 768,
     "wide landscape view of an abandoned Victorian house foyer at night, grand staircase with broken banister on the left, "
     "peeling floral wallpaper, a dusty chandelier, moonlight pouring through a shattered window casting a glowing white beam through the fog, "
     "a closed wooden door at the far end of the hall. No people."),
    ("2_personaggio", 768, 1024,
     "portrait of a young woman, about 20, early 1990s college student, big permed auburn hair, denim jacket with patches, "
     "holding a crossbow, nervous determined expression, standing in a dark forest at night, three-quarter view, centered, "
     "pale moonlit mist swirling around her."),
    ("3_oggetto", 768, 1024,
     "a single old silver crucifix lying on a worn leather-bound closed book on a dusty wooden table, "
     "the crucifix emitting a soft white holy glow, a thin wisp of smoke rising from a candle, close-up still life filling the frame, "
     "dark background, centered composition."),
    ("4_abilita", 768, 1024,
     "a priest in a long black coat performing an exorcism, one hand raised holding a glowing white cross, "
     "a dark horrifying demonic silhouette made of writhing black smoke and shadow before him with hollow glowing white eyes, "
     "an old dark room, dynamic dramatic composition, the cross radiating a bright white halo."),
    ("5_sbarramento_porta", 768, 1024,
     "a heavy old wooden door nailed shut with thick crossed wooden planks and rusty nails, chains and a padlock, "
     "in a decayed dark hallway, peeling paint, faint white light and mist leaking through the gaps around the door, "
     "front view, centered, close-up of the door filling the frame."),
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
