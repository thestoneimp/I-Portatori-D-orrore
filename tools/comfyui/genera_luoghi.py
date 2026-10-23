"""2 varianti per ciascuna carta luogo di portatori_orrore_base.json (A01-A17), formato orizzontale.
Ogni variante viene registrata nella galleria (arte/galleria.json) appena generata.
Riprendibile: salta le varianti già registrate. Output: arte/luoghi/<id>_v<N>.png"""
import os, sys, time
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "galleria"))
from genera import genera, coda_vuota
from stile import prompt, NEGATIVO, FORMATO_LUOGO
import galleria as G

OUT = os.path.join(G.ARTE, "luoghi")
os.makedirs(OUT, exist_ok=True)

BASE = "wide landscape view of a room in the same old abandoned Victorian haunted house, 1980s horror, no people"

# id: (nome, descrizione breve per la galleria, soggetto comune, [variante 1, variante 2])
LUOGHI = {
    "A01_strada": ("Strada", "Strada deserta davanti alla casa: lampione, cassetta delle lettere, tombino fumante.",
        "wide landscape view of a deserted wet asphalt street at night in front of an old abandoned Victorian house, thick fog, 1980s horror, no people",
        ["a flickering yellowish street lamp in the mist, a rusty mailbox, the dark silhouette of the house and its iron gate at the end of the street",
         "a steaming open manhole in the middle of the shiny wet road, a bent street sign post, bare trees along the sidewalk, moonlight through the fog"]),
    "A02_giardino_est": ("Giardino Est", "Lato est del giardino della casa.",
        "wide landscape view of the overgrown east garden of an old abandoned Victorian house at night, 1980s horror, no people",
        ["twisted dead trees, tall dry grass, a rusty wrought iron fence, a crooked wooden shed, the dark house looming behind, full moon",
         "a dirt path through weeds leading to the house side wall, a broken wheelbarrow, a dead vegetable patch, crows on a branch, low fog"]),
    "A03_giardino_ovest": ("Giardino Ovest", "Lato ovest del giardino della casa.",
        "wide landscape view of the overgrown west garden of an old abandoned Victorian house at night, 1980s horror, no people",
        ["an old mossy stone well, dead rose bushes, a toppled weathered statue, the house wall with a dark window in the background",
         "a rusted children's swing set in tall grass, a broken garden bench, a gnarled old tree with hanging branches, moonlit mist"]),
    "A04_ingresso": ("Ingresso", "Atrio d'ingresso con scalone.",
        "wide landscape view of the entrance hall of an old abandoned Victorian house at night, 1980s horror, no people",
        ["a grand staircase with a broken banister, peeling floral wallpaper, a dusty chandelier, moonlight through a shattered window",
         "the heavy front door seen from inside with a coat stand and an old cracked mirror, scattered letters on a dusty checkered floor, a long dark corridor"]),
    "A05_salone": ("Salone", "Salone con camino e mobili coperti.",
        "wide landscape view of the living room of an old abandoned Victorian house at night, 1980s horror, no people",
        ["a large stone fireplace with a gilded mirror, sofas covered with white dust sheets, a grandfather clock, tall curtained windows",
         "an old upright piano with open keys, armchairs facing a dead fireplace, framed family portraits on the walls, a faded rug"]),
    "A06_cucina": ("Cucina", "Cucina con fornello a legna e utensili.",
        "wide landscape view of the kitchen of an old abandoned Victorian house at night, 1980s horror, no people",
        ["a cast-iron wood stove, copper pots hanging from the ceiling, a long scarred wooden table with a rusty cleaver, cracked tiled walls",
         "an old sink under a dirty window, open cupboards with broken plates, a rusty refrigerator with its door ajar, a flickering ceiling lamp"]),
    "A07_camera_da_letto": ("Camera da Letto", "Camera da letto padronale.",
        "wide landscape view of the master bedroom of an old abandoned Victorian house at night, 1980s horror, no people",
        ["a large canopy bed with torn curtains and rumpled stained sheets, a bedside oil lamp, moonlight through a window",
         "a dressing table with a cracked oval mirror, a wardrobe with one door open, dusty perfume bottles, a worn rug and a rocking chair"]),
    "A08_bagno": ("Bagno", "Bagno con vasca e specchio.",
        "wide landscape view of the bathroom of an old abandoned Victorian house at night, 1980s horror, no people",
        ["a clawfoot bathtub with dark murky water, cracked white tiles, a rusty faucet, a small window with a torn curtain",
         "a cracked wall mirror above a stained sink, a medicine cabinet hanging open, peeling paint, a flickering bare bulb, water dripping on the floor"]),
    "A09_studio": ("Studio", "Studio con scrivania e documenti.",
        "wide landscape view of the study of an old abandoned Victorian house at night, 1980s horror, no people",
        ["a heavy oak desk covered in yellowed papers and an old typewriter, a leather chair, a green banker lamp, a world globe",
         "walls with pinned maps and old photographs connected by string, a filing cabinet with drawers pulled out, a stuffed owl, scattered documents on the floor"]),
    "A10_camera_dei_bimbi": ("Camera dei Bimbi", "Cameretta dei bambini con giocattoli.",
        "wide landscape view of an abandoned children's bedroom in an old Victorian house at night, 1980s horror, no people",
        ["a small crib, a rocking horse, toys scattered on the floor, faded wallpaper with animals, a single night light",
         "two small beds, a dollhouse, a row of porcelain dolls on a shelf staring forward, crayon drawings pinned on the wall, a rocking chair moving by itself"]),
    "A11_ripostiglio": ("Ripostiglio", "Ripostiglio ingombro di oggetti.",
        "wide landscape view of a cramped storage closet in an old abandoned Victorian house at night, 1980s horror, no people",
        ["brooms and mops leaning on the wall, stacked cardboard boxes, an old vacuum cleaner, shelves of cleaning supplies, a bare hanging bulb",
         "a pile of covered furniture and rolled carpets, a tool chest, a rusty bucket, cobwebs in the corners, a narrow shaft of light under the door"]),
    "A12_biblioteca": ("Biblioteca", "Biblioteca con scaffali alti e scala.",
        "wide landscape view of the library of an old abandoned Victorian house at night, 1980s horror, no people",
        ["floor-to-ceiling bookshelves, a rolling wooden ladder, a reading table with a candle and an open book, a tall arched window",
         "a narrow aisle between towering shelves, fallen books on the floor, a leather armchair, a globe, dust floating in a shaft of moonlight"]),
    "A13_cantina_vini": ("Cantina Vini", "Cantina dei vini con botti e scaffali.",
        "wide landscape view of the wine cellar of an old abandoned Victorian house, 1980s horror, no people",
        ["stone vaulted ceiling, wooden racks full of dusty wine bottles, large oak barrels, a single bare hanging bulb, damp stone floor",
         "a narrow stone passage between wine racks, broken bottles and dark wine stains on the floor, cobwebs, a rusty iron door at the far end"]),
    "A14_dispensa": ("Dispensa", "Dispensa con scaffali di conserve.",
        "wide landscape view of the pantry in the cellar of an old abandoned Victorian house, 1980s horror, no people",
        ["wooden shelves lined with dusty jars of preserves, hanging dried herbs and cured meats, sacks of flour, a small barred window, a dim lantern",
         "overturned shelves, smashed jars and spilled dark contents on the floor, a half-open meat locker, rats' tracks in the dust, a flickering bulb"]),
    "A15_locale_caldaia": ("Locale Caldaia", "Locale caldaia con grande caldaia arrugginita.",
        "wide landscape view of the boiler room in the cellar of an old abandoned Victorian house, 1980s horror, no people",
        ["a huge rusty boiler with glowing red slits in its furnace door, a tangle of pipes along the ceiling, pressure gauges, steam leaking from valves",
         "a stack of coal and a shovel, a soot-covered brick wall, rusted pipes dripping water, a heavy iron door, red glow from the furnace on the floor"]),
    "A16_lavanderia": ("Lavanderia", "Lavanderia nel seminterrato.",
        "wide landscape view of the laundry room in the cellar of an old abandoned Victorian house, 1980s horror, no people",
        ["an old washing machine with its door open, stone wash basins, clotheslines with tattered white sheets hanging, a bare bulb, damp walls",
         "a wringer washer, wicker laundry baskets with dark stained linens, a clothesline of ghostly hanging dresses, a drain in the floor, dripping pipes"]),
    "A17_soffitta": ("Soffitta", "Soffitta con travi e bauli.",
        "wide landscape view of the attic of an old abandoned Victorian house at night, 1980s horror, no people",
        ["slanted wooden roof beams, dusty trunks and boxes, a round gable window with moonlight, a sheet-covered mannequin, cobwebs",
         "an old dress form, rolled carpets, a broken rocking horse, a tall standing mirror covered with a cloth, hanging dusty garments, a narrow wooden staircase hatch"]),
}

if __name__ == "__main__":
    if not coda_vuota():
        sys.exit("Coda ComfyUI non vuota: riprovo più tardi.")
    w, h = FORMATO_LUOGO
    for chiave, (nome, descr, comune, varianti) in LUOGHI.items():
        for i, var in enumerate(varianti, 1):
            rel = f"luoghi/{chiave}_v{i}.png"
            dati = G.carica()
            carta = G.aggiungi_carta(dati, chiave, "luogo", nome, "orizzontale", descr)
            G.salva(dati)
            if any(v["file"] == rel for v in carta["varianti"]):
                continue
            p = prompt(f"{comune}, {var}.")
            t = time.time()
            seed = 1980 + i
            genera(p, os.path.join(G.ARTE, rel), negativo=NEGATIVO, larghezza=w, altezza=h, seed=seed)
            # ricarica prima di scrivere: nel frattempo l'utente può aver approvato/richiesto qualcosa dalla pagina
            dati = G.carica()
            G.aggiungi_variante(dati, chiave, rel, p, seed)
            G.salva(dati)
            print(f"{chiave} v{i} seed={seed} {time.time()-t:.0f}s", flush=True)
