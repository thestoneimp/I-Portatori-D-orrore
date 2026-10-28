"""2 varianti per ciascun luogo (A01-A17) con la casa in buone condizioni (statoCasa "abitata"/"curata" del gioco).
Ogni luogo diventa una carta distinta nella galleria: id <luogo>_abitata, così si approva una variante per stato della casa.
Formato 3:2 (FORMATO_LUOGO). Strada e Giardini senza la casa in vista (come per gli abbandonati). Riprendibile.
Output: arte/luoghi_abitati/<id>_abitata_v<N>.png"""
import os, sys, time
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "galleria"))
from genera import genera, coda_vuota
from stile import prompt, STILE_ABITATA, NEGATIVO, FORMATO_LUOGO
import galleria as G

os.makedirs(os.path.join(G.ARTE, "luoghi_abitati"), exist_ok=True)

NEG_BUONE = NEGATIVO + ", abandoned, decayed, broken, cracked, peeling paint, cobwebs, dust, rust, rubble, dirty, ruined, torn, shattered"
NEG_EDIFICI = ", house, mansion, building, houses, roof, facade, barn, farmhouse, cottage, chimney, windows of a building"

# id base: (nome, soggetto comune, [variante 1, variante 2], negativo extra)
LUOGHI = {
    "A01_strada": ("Strada",
        "wide landscape view of a quiet clean paved road at night, well-kept, tidy sidewalk and grass verge, tall trimmed trees on both sides, soft fog in the distance, 1980s, deserted",
        ["a working street lamp glowing a warm yellow, a neat painted mailbox on a post, shiny dry-clean asphalt with fresh road lines",
         "a neat low trimmed hedge along the sidewalk, a clean manhole cover, a metal street sign post, warm glow of a lamp on the pavement"], NEG_EDIFICI),
    "A02_giardino_est": ("Giardino Est",
        "wide landscape view of a beautifully tended garden in the evening twilight surrounded by tall trimmed hedges and trees, 1980s, deserted",
        ["a freshly mown lawn with flower beds in bloom, a sound wooden tool shed painted dark green, a neat gravel path, warm lantern light",
         "a tidy vegetable patch with rows of healthy plants, a wheelbarrow leaning by a trellis, a watering can, a stone-edged path, warm evening light"], NEG_EDIFICI),
    "A03_giardino_ovest": ("Giardino Ovest",
        "wide landscape view of a beautifully tended garden in the evening twilight enclosed by tall trimmed hedges and cypress trees, 1980s, deserted",
        ["a clean stone well with a wooden roof, blooming red rose bushes, a clean white stone statue, trimmed lawn, warm lantern light",
         "a painted swing set on a trimmed lawn, a wooden bench, a big old tree with a lantern hanging from a branch, warm glow in the dusk"], NEG_EDIFICI),
    "A04_ingresso": ("Ingresso",
        "wide landscape view of the entrance hall of a well-kept lived-in Victorian house in the evening, warm and tidy, 1980s, no people",
        ["a grand staircase with an intact polished banister, a lit crystal chandelier, clean floral wallpaper, a polished wooden floor with a runner rug",
         "the front door seen from inside, a console table with a vase of fresh flowers and a mirror, a coat stand with coats, a warm table lamp, a clean checkered floor"], ""),
    "A05_salone": ("Salone",
        "wide landscape view of the living room of a well-kept lived-in Victorian house in the evening, warm and tidy, 1980s, no people",
        ["a crackling fire in a stone fireplace with a gilded mirror above, comfortable sofas with cushions, a grandfather clock, tall curtained windows",
         "an upright piano with sheet music, armchairs around a fireplace with a warm fire, framed family portraits on the walls, a soft rug"], ""),
    "A06_cucina": ("Cucina",
        "wide landscape view of the kitchen of a well-kept lived-in Victorian house in the evening, warm and tidy, 1980s, no people",
        ["a wood stove with a kettle, copper pots hanging neatly, a wooden table with a loaf of bread and a bowl of fruit, clean tiled walls",
         "a clean sink under a window with curtains, open cupboards with neatly stacked plates, a checked tablecloth, a warm ceiling lamp"], ""),
    "A07_camera_da_letto": ("Camera da Letto",
        "wide landscape view of the master bedroom of a well-kept lived-in Victorian house at night, warm and tidy, 1980s, no people",
        ["a large canopy bed made with a quilt and pillows, a lit bedside lamp, moonlight through a window with curtains",
         "a dressing table with an intact oval mirror and perfume bottles, a wardrobe, a rocking chair, a soft rug, a warm lamp"], ""),
    "A08_bagno": ("Bagno",
        "wide landscape view of the bathroom of a well-kept lived-in Victorian house in the evening, clean and tidy, 1980s, no people, four walls and a ceiling",
        ["a clean clawfoot bathtub with clear water and folded towels, clean white tiles, a small window with a curtain on the same wall, a warm light",
         "a clean sink with a polished mirror above it, a closed medicine cabinet, folded towels on a rail, a bar of soap, a small plant"], ""),
    "A09_studio": ("Studio",
        "wide landscape view of the interior of a study room in a well-kept lived-in Victorian house in the evening, enclosed room, 1980s, no people",
        ["a tidy oak desk with a typewriter and neat stacks of papers, a leather chair, a green banker lamp lit, a world globe, wood-paneled walls",
         "bookshelves full of books, a leather armchair with a reading lamp, framed diplomas and a framed map on the wall, a clean tidy desk"], ""),
    "A10_camera_dei_bimbi": ("Camera dei Bimbi",
        "wide landscape view of a children's bedroom in a well-kept lived-in Victorian house at night, tidy and cozy, 1980s, no people",
        ["a small bed with a cheerful bedspread, a rocking horse, toys neatly on shelves, wallpaper with animals, a glowing night light",
         "two small beds with teddy bears, a dollhouse, crayon drawings pinned on the wall, a rocking chair, a warm lamp"], ""),
    "A11_ripostiglio": ("Ripostiglio",
        "wide landscape view of a small tidy storage closet in a well-kept lived-in Victorian house, neatly organized, 1980s, no people",
        ["brooms and mops hanging in order, shelves with neatly stacked boxes and cleaning supplies, an old vacuum cleaner, a bare hanging bulb glowing warm",
         "shelves with tools and folded linens, an ironing board, a clean bucket, everything in its place, a warm light"], ""),
    "A12_biblioteca": ("Biblioteca",
        "wide landscape view of the library of a well-kept lived-in Victorian house in the evening, 1980s, no people",
        ["floor-to-ceiling bookshelves full of neatly arranged books, a polished rolling wooden ladder, a reading table with a lit lamp and an open book, a tall arched window",
         "a narrow aisle between tall orderly bookshelves, a leather armchair near a glowing fireplace, a globe, warm light"], ""),
    "A13_cantina_vini": ("Cantina Vini",
        "wide landscape view of the wine cellar of a well-kept Victorian house, clean stone, 1980s, no people",
        ["stone vaulted ceiling, wooden racks full of neatly arranged wine bottles, large oak barrels, warm hanging lamps, a clean stone floor",
         "a tasting table with a few bottles, glasses and a candle between rows of orderly wine racks and stone arches"], ""),
    "A14_dispensa": ("Dispensa",
        "wide landscape view of the pantry in the cellar of a well-kept lived-in Victorian house, tidy and well stocked, 1980s, no people",
        ["wooden shelves lined with neat jars of preserves, hanging dried herbs and hams, sacks of flour, a small window, a warm lantern",
         "shelves with jars and baskets of fresh vegetables and apples, a wooden crate of potatoes, a warm hanging lamp"], ""),
    "A15_locale_caldaia": ("Locale Caldaia",
        "wide landscape view of the boiler room in the cellar of a well-kept Victorian house, clean and maintained, 1980s, no people",
        ["a large clean painted boiler with a warm glow from its furnace door, neatly arranged pipes along the ceiling, pressure gauges, tools hanging in order",
         "a neat stack of firewood and a shovel, clean brick walls, tidy pipes, a warm glow from the furnace on the floor"], ""),
    "A16_lavanderia": ("Lavanderia",
        "wide landscape view of the laundry room in the cellar of a well-kept lived-in Victorian house, clean and tidy, 1980s, no people",
        ["a clean washing machine, stone wash basins, clotheslines with clean white sheets hanging, a warm bulb, dry clean walls",
         "an ironing board with a folded shirt, wicker baskets of folded linens, shelves with neat bottles, a small window with soft light"], ""),
    "A17_soffitta": ("Soffitta",
        "wide landscape view of the attic of a well-kept lived-in Victorian house at night, tidy and organized, 1980s, no people",
        ["slanted wooden roof beams, neat trunks and boxes, a round gable window with moonlight, a dress on a mannequin, a warm lamp",
         "a rocking horse, rolled carpets neatly stacked, a standing mirror, shelves with labeled boxes, a narrow wooden staircase and a warm lamp"], ""),
}

if __name__ == "__main__":
    if not coda_vuota():
        sys.exit("Coda ComfyUI non vuota: riprovo più tardi.")
    w, h = FORMATO_LUOGO
    for base, (nome, comune, varianti, neg_extra) in LUOGHI.items():
        cid = base + "_abitata"
        for i, var in enumerate(varianti, 1):
            rel = f"luoghi_abitati/{cid}_v{i}.png"
            dati = G.carica()
            carta = G.aggiungi_carta(dati, cid, "luogo", f"{nome} (casa abitata)", "orizzontale", "Versione con la casa in buone condizioni."); G.salva(dati)
            if any(v["file"] == rel for v in carta["varianti"]):
                continue
            p = prompt(f"{comune}, {var}.", STILE_ABITATA)
            seed, t = 1980 + i, time.time()
            genera(p, os.path.join(G.ARTE, rel), negativo=NEG_BUONE + neg_extra, larghezza=w, altezza=h, seed=seed)
            dati = G.carica()   # ricarica: nel frattempo la pagina può aver salvato approvazioni/richieste
            G.aggiungi_variante(dati, cid, rel, p, seed); G.salva(dati)
            print(f"{cid} v{i} seed={seed} {time.time()-t:.0f}s", flush=True)
