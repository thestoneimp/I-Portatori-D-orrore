"""Rifacimento di alcuni luoghi: nuove varianti (formato 3:2) che sostituiscono le precedenti.
- A09 Studio: deve essere una stanza interna (prima: scrivania in un prato / facciata sul muro).
- A01 Strada, A02/A03 Giardini: la casa NON deve comparire, solo la strada o il giardino.
Le vecchie varianti vengono marcate 'scartata' (si possono ripristinare dalla galleria), le nuove registrate appena generate.
Riprendibile: salta le nuove varianti già registrate (nota 'rifatta')."""
import os, sys, time
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "galleria"))
from genera import genera, coda_vuota
from stile import prompt, NEGATIVO, FORMATO_LUOGO
import galleria as G

SENZA_CASA = ", house, mansion, building, houses, roof, facade, windows of a building, buildings in the background"
SOLO_INTERNO = ", outdoors, exterior of a house, garden, lawn, trees, sky, painting of a house on the wall, house facade, landscape"

# id: (soggetto comune, [varianti], negativo extra)
RIFACIMENTI = {
    "A09_studio": (
        "wide landscape view of the interior of a study room in an old abandoned Victorian house at night, four walls and a ceiling clearly visible, "
        "enclosed indoor room, 1980s horror, no people",
        ["a heavy oak desk covered in yellowed papers and an old typewriter, a leather chair, a green banker lamp, a world globe, dark wood-paneled walls, a curtained window with moonlight",
         "a cluttered study with a filing cabinet with drawers pulled out, shelves of old books, a stuffed owl on a cabinet, scattered documents on the floor, an old map framed on the wall, a dim desk lamp"],
        SOLO_INTERNO),
    "A01_strada": (
        "wide landscape view of a deserted wet asphalt street at night, thick fog swallowing the distance, ONLY the street and sidewalk, "
        "no buildings anywhere, empty dark fog and bare tree silhouettes on both sides, 1980s horror, no people",
        ["a flickering yellowish street lamp in the mist, a rusty mailbox on the sidewalk, shiny wet road, the street disappearing into dense fog",
         "a steaming open manhole in the middle of the shiny wet road, a bent street sign post, bare trees along the sidewalk, moonlight through the fog"],
        SENZA_CASA),
    "A02_giardino_est": (
        "wide landscape view of an overgrown abandoned garden at night, ONLY the garden, no building in view, 1980s horror, no people",
        ["twisted dead trees, tall dry grass, a rusty wrought iron fence, a crooked wooden tool shed, a dark treeline behind, full moon",
         "a dirt path through weeds, a broken wheelbarrow, a dead vegetable patch, crows on a bare branch, low fog over the grass"],
        SENZA_CASA),
    "A03_giardino_ovest": (
        "wide landscape view of an overgrown abandoned garden at night, ONLY the garden, no building in view, 1980s horror, no people",
        ["an old mossy stone well, dead rose bushes, a toppled weathered statue, tall grass, a dark hedge in the background, moonlit mist",
         "a rusted children's swing set in tall grass, a broken garden bench, a gnarled old tree with hanging branches, moonlit mist"],
        SENZA_CASA),
}

if __name__ == "__main__":
    if not coda_vuota():
        sys.exit("Coda ComfyUI non vuota: riprovo più tardi.")
    w, h = FORMATO_LUOGO
    for chiave, (comune, varianti, neg_extra) in RIFACIMENTI.items():
        for i, var in enumerate(varianti, 1):
            dati = G.carica()
            carta = G.trova(dati, chiave)
            fatte = [v for v in carta["varianti"] if "rifatta" in v["nota"]]
            if len(fatte) >= i:
                continue
            vid = G.prossimo_id_variante(carta)
            rel = f"luoghi/{chiave}_{vid}.png"
            p = prompt(f"{comune}, {var}.")
            seed = 1990 + i
            t = time.time()
            genera(p, os.path.join(G.ARTE, rel), negativo=NEGATIVO + neg_extra, larghezza=w, altezza=h, seed=seed)
            dati = G.carica()  # ricarica: nel frattempo la pagina può aver salvato approvazioni/richieste
            G.aggiungi_variante(dati, chiave, rel, p, seed, nota="rifatta 3:2")
            G.salva(dati)
            print(f"{chiave} {vid} seed={seed} {time.time()-t:.0f}s", flush=True)
        # tutte e due le nuove ci sono: le vecchie varianti vengono nascoste (ripristinabili dalla galleria)
        dati = G.carica()
        carta = G.trova(dati, chiave)
        if len([v for v in carta["varianti"] if "rifatta" in v["nota"]]) >= len(varianti):
            for v in carta["varianti"]:
                if "rifatta" not in v["nota"] and not v["scartata"]:
                    v["scartata"] = True
                    v["nota"] = (v["nota"] + " · " if v["nota"] else "") + "sostituita"
                    if carta["approvata"] == v["id"]:
                        carta["approvata"] = None
            G.salva(dati)
