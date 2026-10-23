"""4 varianti per ciascun personaggio di eroi_base.json (aspetto, vestiti, posa e sfondo diversi).
Riprendibile: salta i file già generati. Output in arte/personaggi/<id>_<nome>_v<N>.png"""
import os, sys, time
sys.path.insert(0, os.path.dirname(__file__))
from genera import genera, coda_vuota
from stile import prompt, NEGATIVO, FORMATO_VERTICALE

OUT = os.path.join(os.path.dirname(__file__), "..", "..", "arte", "personaggi")
os.makedirs(OUT, exist_ok=True)

# Per ogni personaggio: descrizione fissa dell'aspetto + 4 varianti (vestiti, posa, sfondo)
PERSONAGGI = {
    "P01_alice": (
        "a young woman named Alice, about 20, early 1990s college student, big permed dark chestnut brown hair, freckles, nervous but determined expression, carrying a crossbow",
        [
            "wearing a faded denim jacket over a white t-shirt and jeans, standing three-quarter view holding the crossbow low, in a dark forest at night",
            "wearing a plaid flannel shirt tied at the waist and a black band t-shirt, crouching behind a fallen log aiming the crossbow, in a misty woodland clearing",
            "wearing a hooded rain jacket and boots, hood down, hiking through tall wet grass with the crossbow on her shoulder, a foggy hillside at dusk",
            "wearing a varsity bomber jacket and high-top sneakers, back against a brick wall of an alley, crossbow raised, glancing sideways, a dim streetlamp behind her",
        ]),
    "P02_scott": (
        "a young man named Scott, about 28, 1980s seminarian and healer, short messy brown hair, kind tired eyes, light stubble, carrying a worn leather Bible and a silver cross",
        [
            "wearing a black clerical shirt with a white collar and a long dark coat, holding the cross raised in one hand and the Bible in the other, in a dark old church",
            "wearing a knit sweater and corduroy trousers, kneeling to tend a wounded person with a first-aid kit beside him, in a candlelit room",
            "wearing a trench coat soaked by rain, standing in the middle of a deserted street at night, the cross held out before him, determined",
            "wearing shirtsleeves rolled up and a loosened collar, sitting at a cluttered desk with open books and candles, reading the Bible, an old study full of shelves",
        ]),
    "P03_kimberly": (
        "a young woman named Kimberly, about 25, early 1990s occult student, long straight black hair, pale skin, intense mysterious expression, carrying a thick ancient grimoire and a ritual dagger",
        [
            "wearing a long black coat, silver rings and a pendant, holding the grimoire open and the dagger in the other hand, in a dark candlelit library",
            "wearing a dark velvet dress with a lace collar and heavy boots, standing inside a ritual circle drawn in chalk on a wooden floor, candles around her",
            "wearing a ripped band t-shirt, leather jacket and a choker, leaning on a gravestone in a cemetery at night, grimoire under her arm",
            "wearing a dark hooded cloak, standing at the top of a spiral stone staircase in a cellar, the dagger raised, shadows crawling on the walls",
        ]),
    "P04_matt": (
        "a man named Matt, about 30, stocky and muscular ex-soldier, buzz-cut dark hair, square jaw, calm steady expression, carrying a pistol and a military field radio",
        [
            "wearing an olive drab army jacket and dog tags, aiming the pistol with both hands, in a dark corridor of an abandoned house",
            "wearing a sleeveless t-shirt and cargo pants, crouching beside the field radio with the headset on one ear, in a ruined basement",
            "wearing a leather jacket and jeans, standing in front of a pickup truck at night, one hand on the pistol at his belt, a deserted gas station behind him",
            "wearing a bulletproof vest over a flannel shirt, running through a rainy forest road with the pistol drawn, headlights glaring behind him",
        ]),
    "P05_michael": (
        "a man named Michael, about 32, lean athletic former army officer, short dark hair, clean shaven, sharp focused expression, carrying a pistol and a military field radio",
        [
            "wearing a dark turtleneck and a field jacket, holding the pistol at his side while talking into the field radio, in a dim command room",
            "wearing a trench coat and a tie loosened at the collar, kneeling behind an overturned table with the pistol drawn, an old wooden hall",
            "wearing camouflage pants and a tank top, climbing out of a window into a moonlit garden, pistol in hand",
            "wearing a wool sweater and a scarf, standing on a porch in the snow, the field radio in one hand, scanning the dark tree line",
        ]),
    "P06_julia": (
        "a woman named Julia, about 30, disciplined former military tactician, dark hair tied back in a tight bun, sharp commanding gaze, carrying a pistol and a military field radio",
        [
            "wearing a fitted olive field jacket and a black beret, pointing ahead as if giving orders, the pistol in her other hand, in a dark hallway",
            "wearing a long wool coat, gloves and boots, kneeling over a hand-drawn map spread on the floor by lantern light, field radio beside her",
            "wearing a sleeveless vest top and cargo pants, back flat against a wall next to a door, pistol raised, listening, a dim stairwell",
            "wearing a rain poncho over her uniform, crossing a flooded street at night, the field radio pressed to her ear, burned-out cars behind her",
        ]),
}

if __name__ == "__main__":
    if not coda_vuota():
        sys.exit("Coda ComfyUI non vuota: riprovo più tardi.")
    w, h = FORMATO_VERTICALE
    for chiave, (aspetto, varianti) in PERSONAGGI.items():
        for i, var in enumerate(varianti, 1):
            dest = os.path.join(OUT, f"{chiave}_v{i}.png")
            if os.path.exists(dest):
                continue
            t = time.time()
            s = genera(prompt(f"portrait illustration of {aspetto}, {var}, three-quarter view, centered."),
                       dest, negativo=NEGATIVO, larghezza=w, altezza=h, seed=1980 + i)
            print(f"{chiave} v{i} seed={s} {time.time()-t:.0f}s", flush=True)
