"""2 varianti per ciascun oggetto: l'equipaggiamento degli eroi (eroi_base.json) + le due chiavi degli eventi (eventi_generici.json).
Formato verticale 3:4. Ogni variante viene registrata nella galleria (arte/galleria.json) appena generata. Riprendibile.
Output: arte/oggetti/<id>_v<N>.png"""
import os, sys, time
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "galleria"))
from genera import genera, coda_vuota
from stile import prompt, NEGATIVO, FORMATO_VERTICALE
import galleria as G

OUT = os.path.join(G.ARTE, "oggetti")
os.makedirs(OUT, exist_ok=True)

COMUNE = "close-up still life of a single object, filling the frame, dramatic lighting, dark background, 1980s horror, no people, no text, no lettering"

# id: (nome, descrizione per la galleria, soggetto, [variante 1, variante 2])
OGGETTI = {
    "O01_balestra": ("Balestra", "Equipaggiamento di Alice Richards.",
        "an old hunting crossbow with wooden stock and steel limbs, loaded with a bolt",
        ["resting on a scarred wooden table with three spare bolts beside it, lit by a single lantern",
         "leaning against a rough plank wall of a dark cabin, a leather quiver of bolts hanging next to it, moonlight through a gap"]),
    "O02_mappa_del_bosco": ("Mappa del Bosco", "Equipaggiamento di Alice Richards.",
        "a worn hand-drawn paper map of a forest with trails, rivers and little drawn trees, creased and stained, with no writing on it",
        ["unrolled on a wooden table, held down by an old brass compass and a candle stub",
         "half-folded and torn along the creases, a pencil resting on it, a red pencil mark circling a spot, dim lamp light"]),
    "O03_croce_sacra": ("Croce Sacra", "Equipaggiamento di Scott Stockings.",
        "a plain antique silver cross with simple clean lines, softly glowing",
        ["lying on dark velvet cloth beside a lit candle, a faint holy glow around it",
         "hanging by a thin chain from a rusty nail on a dark wall, swaying, a pale glow cutting the darkness"]),
    "O04_bibbia": ("Bibbia", "Equipaggiamento di Scott Stockings.",
        "a thick worn leather-bound book with a cracked spine and a ribbon bookmark, aged pages with tiny illegible scribbles",
        ["closed on a wooden table, a candle burning beside it, dust on the cover",
         "open on an old wooden lectern in a dark church, a thin line of light falling on the pages"]),
    "O05_pugnale_rituale": ("Pugnale Rituale", "Equipaggiamento di Kimberly Jones.",
        "an ornate ritual dagger with a curved engraved blade and a dark carved handle",
        ["lying on black cloth, strange chalk symbols drawn around it, a few candles at the edges",
         "stuck upright into a wooden table, the blade catching a streak of red light, dust floating around"]),
    "O06_grimorio": ("Grimorio", "Equipaggiamento di Kimberly Jones.",
        "an ancient thick grimoire with a cracked dark leather cover, a metal clasp and a strange engraved sigil on the front",
        ["closed on a stone altar, a clasp strap hanging loose, two candles, thin smoke rising",
         "open on a table, its yellowed pages covered with illegible diagrams and symbols, a faint red glow rising from the pages"]),
    "O07_pistola": ("Pistola", "Equipaggiamento di Matt Stone, Michael Richards e Julia Constantin.",
        "a classic 1980s semi-automatic pistol, dark steel with worn edges",
        ["lying on a scratched metal workbench next to a spare magazine and a few loose bullets, one hanging lamp",
         "resting on the dusty seat of an old car, a pale light from a window glinting on the barrel"]),
    "O08_radio_militare": ("Radio Militare", "Equipaggiamento di Matt Stone, Michael Richards e Julia Constantin.",
        "a 1980s military field radio with antenna, dials and a handset on a coiled cord, olive drab metal case",
        ["on a wooden table, lit by an oil lantern, glowing red dial",
         "set on the floor of a ruined room, the antenna extended, the handset dangling by its cord, a faint static glow"]),
    "O09_chiave": ("Chiave", "Apre le porte chiuse a chiave.",
        "a large old iron skeleton key with an ornate bow, rusted and heavy",
        ["lying on a scarred wooden table in a pool of light",
         "lying in the dust on old floorboards, a faint glow from the keyhole of a door beside it"]),
    "O10_chiave_piccola": ("Chiave piccola", "Apre serrature, cassetti e lucchetti.",
        "a small brass key on a thin worn string loop",
        ["lying on a dusty wooden surface, lit by a single candle",
         "hanging from a nail inside an open drawer, a shaft of light on the key"]),
}

if __name__ == "__main__":
    if not coda_vuota():
        sys.exit("Coda ComfyUI non vuota: riprovo più tardi.")
    w, h = FORMATO_VERTICALE
    for chiave, (nome, descr, soggetto, varianti) in OGGETTI.items():
        for i, var in enumerate(varianti, 1):
            rel = f"oggetti/{chiave}_v{i}.png"
            dati = G.carica()
            carta = G.aggiungi_carta(dati, chiave, "oggetto", nome, "verticale", descr); G.salva(dati)
            if any(v["file"] == rel for v in carta["varianti"]):
                continue
            p = prompt(f"{COMUNE}: {soggetto}, {var}.")
            seed, t = 1980 + i, time.time()
            genera(p, os.path.join(G.ARTE, rel), negativo=NEGATIVO, larghezza=w, altezza=h, seed=seed)
            dati = G.carica()   # ricarica: nel frattempo la pagina può aver salvato approvazioni/richieste
            G.aggiungi_variante(dati, chiave, rel, p, seed); G.salva(dati)
            print(f"{chiave} v{i} seed={seed} {time.time()-t:.0f}s", flush=True)
