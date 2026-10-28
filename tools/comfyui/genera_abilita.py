"""2 varianti per ciascuna abilità degli eroi (eroi_base.json, 10 abilità uniche: Sangue Freddo è condivisa da 3 eroi).
Formato verticale 3:4. Le abilità sono mostrate in azione ma SENZA volti riconoscibili (mani, sagome, di spalle, simboli):
così non entrano in conflitto con l'aspetto dei personaggi. Ogni variante è registrata nella galleria appena generata. Riprendibile.
Output: arte/abilita/<id>_v<N>.png"""
import os, sys, time
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "galleria"))
from genera import genera, coda_vuota
from stile import prompt, NEGATIVO, FORMATO_VERTICALE
import galleria as G

os.makedirs(os.path.join(G.ARTE, "abilita"), exist_ok=True)

COMUNE = "dynamic dramatic illustration of a special ability in action, strong composition, no faces visible, no text, no lettering, 1980s horror"

# id: (nome, descrizione per la galleria, [variante 1, variante 2])
ABILITA = {
    "AB01_mira_letale": ("Mira Letale", "Abilità di Alice Richards.",
        ["seen through the sights of a crossbow, the crosshair steady on a pair of glowing eyes in a dark foggy forest",
         "a crossbow bolt flying straight toward the single glowing eye of a monstrous shadow, motion streaks, tense frozen moment"]),
    "AB02_tiro_rapido": ("Tiro Rapido", "Abilità di Alice Richards.",
        ["a pair of hands reloading a crossbow in a blur, several bolts in the air at once, motion blur, dark forest",
         "a volley of three crossbow bolts streaking one after another through the fog toward a looming shadowy monster"]),
    "AB03_guarigione": ("Guarigione", "Abilità di Scott Stockings.",
        ["a pair of hands wrapping a clean bandage around a wounded forearm by candlelight, warm soft glow, dark room",
         "two hands hovering over a wound as a soft white healing light pours from the palms, tiny motes of light rising, dark background"]),
    "AB04_esorcismo": ("Esorcismo", "Abilità di Scott Stockings.",
        ["a dark silhouette of a man seen from behind, arm raised holding a glowing silver cross toward a writhing demonic figure made of black smoke with hollow white eyes",
         "close-up of a hand holding a glowing cross above an open book, holy light burning away a swirl of black smoke shaped like a screaming face"]),
    "AB05_evocazione": ("Evocazione", "Abilità di Kimberly Jones.",
        ["a chalk summoning circle on a dark wooden floor with strange symbols and candles, a tall dark shape rising from red smoke in the center",
         "hands resting on an open ancient grimoire, pale ghostly hands and wisps of smoke emerging from the pages, red glow, candles"]),
    "AB06_sigillo_oscuro": ("Sigillo Oscuro", "Abilità di Kimberly Jones.",
        ["a large glowing red sigil with intricate lines burning on an old stone wall, chains of dark energy radiating from it, dark crypt",
         "a hand pressing a glowing black and red seal onto the floor, creeping shadows and clawed hands being pushed back by the light of the seal"]),
    "AB07_scatto": ("Scatto", "Abilità di Matt Stone.",
        ["a dark silhouette of a person sprinting away from the camera down a long dark corridor, motion blur and speed lines, a door at the end",
         "close-up of a pair of heavy boots pounding on wet asphalt, spray flying, speed lines, headlights glaring from behind at night"]),
    "AB08_sangue_freddo": ("Sangue Freddo", "Abilità di Matt Stone, Michael Richards e Julia Constantin.",
        ["extreme close-up of a calm steady eye with a frightening monster reflected in the pupil, perfectly still, cold blue light",
         "a lone silhouette standing perfectly calm and still from behind in the middle of a dark corridor while dark shadows and clawing hands swirl around"]),
    "AB09_controllo": ("Controllo", "Abilità di Michael Richards.",
        ["a firm hand holding taut glowing red threads attached to a restrained shadow creature that strains against them, dark room",
         "a hand raised flat in a stop gesture, a crowd of dark shadowy shapes frozen in place before it, a cold light behind"]),
    "AB10_ordine_tattico": ("Ordine Tattico", "Abilità di Julia Constantin.",
        ["a hand pointing at a hand-drawn tactical map spread on a table under a lamp, with arrows and markers, no writing, a few toy-like pieces",
         "a silhouette seen from behind with an arm raised pointing ahead, a small squad with flashlights behind her in a dark corridor"]),
}

if __name__ == "__main__":
    if not coda_vuota():
        sys.exit("Coda ComfyUI non vuota: riprovo più tardi.")
    w, h = FORMATO_VERTICALE
    for chiave, (nome, descr, varianti) in ABILITA.items():
        for i, var in enumerate(varianti, 1):
            rel = f"abilita/{chiave}_v{i}.png"
            dati = G.carica()
            carta = G.aggiungi_carta(dati, chiave, "abilita", nome, "verticale", descr); G.salva(dati)
            if any(v["file"] == rel for v in carta["varianti"]):
                continue
            p = prompt(f"{COMUNE}: {var}.")
            seed, t = 1980 + i, time.time()
            genera(p, os.path.join(G.ARTE, rel), negativo=NEGATIVO, larghezza=w, altezza=h, seed=seed)
            dati = G.carica()   # ricarica: nel frattempo la pagina può aver salvato approvazioni/richieste
            G.aggiungi_variante(dati, chiave, rel, p, seed); G.salva(dati)
            print(f"{chiave} v{i} seed={seed} {time.time()-t:.0f}s", flush=True)
