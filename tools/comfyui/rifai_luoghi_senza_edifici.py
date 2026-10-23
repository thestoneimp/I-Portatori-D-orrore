"""Secondo tentativo per Strada e Giardini: nessun edificio visibile.
Il primo tentativo (rifai_luoghi.py) usava negazioni ("no building") che Qwen ignora: qui lo sfondo viene
DESCRITTO in positivo (bosco, siepi alte, campi nella nebbia). Le varianti con edifici vengono nascoste (scartate).
Aspetta che la coda di ComfyUI sia vuota (non si sovrappone ad altre generazioni). Riprendibile."""
import os, sys, time
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "galleria"))
from genera import genera, coda_vuota
from stile import prompt, NEGATIVO, FORMATO_LUOGO
import galleria as G

NEG_EDIFICI = ", house, mansion, building, houses, roof, facade, barn, farmhouse, cottage, chimney, windows of a building"
NOTA = "rifatta senza edifici"

# (carta, variante da sostituire, soggetto)
DA_RIFARE = [
    ("A01_strada", "v3",
     "wide landscape view of a lonely empty asphalt road at night, shiny wet asphalt with faded yellow line, a grass verge and a sidewalk edge, "
     "tall bare trees on both sides, dark open fields and dense fog swallowing the distance, a flickering yellowish street lamp in the mist, "
     "a rusty mailbox on a post, 1980s horror, deserted"),
    ("A01_strada", "v4",
     "wide landscape view of a deserted wet asphalt road at night cutting through a dark foggy forest of bare trees, "
     "a steaming open manhole in the middle of the shiny road, a bent metal street sign post, moonlight through thick fog, 1980s horror, deserted"),
    ("A02_giardino_est", "v4",
     "wide landscape view of an overgrown abandoned garden at night surrounded on all sides by a dense dark forest and tall dead hedges, "
     "a dirt path through weeds, a broken wheelbarrow, a dead vegetable patch, crows on a bare branch, low fog over the grass, 1980s horror, deserted"),
    ("A03_giardino_ovest", "v3",
     "wide landscape view of an overgrown abandoned garden at night enclosed by tall thick dark hedges and a wall of dark cypress trees, "
     "an old mossy stone well, dead rose bushes, a toppled weathered statue, tall grass, moonlit mist, 1980s horror, deserted"),
    ("A03_giardino_ovest", "v4",
     "wide landscape view of an overgrown abandoned garden at night surrounded by a dark misty forest, "
     "a rusted children's swing set in tall grass, a broken garden bench, a gnarled old tree with hanging branches, moonlit mist, 1980s horror, deserted"),
]

def attendi_coda(max_s=900):
    t = time.time()
    while not coda_vuota():
        if time.time() - t > max_s:
            sys.exit("Coda ComfyUI ancora occupata dopo 15 minuti: mi fermo.")
        time.sleep(10)

if __name__ == "__main__":
    attendi_coda()
    w, h = FORMATO_LUOGO
    for n, (id_carta, vecchia, soggetto) in enumerate(DA_RIFARE):
        dati = G.carica()
        carta = G.trova(dati, id_carta)
        if any(NOTA in v["nota"] and v["da"] == vecchia for v in carta["varianti"]):
            continue
        vid = G.prossimo_id_variante(carta)
        rel = f"luoghi/{id_carta}_{vid}.png"
        p = prompt(f"{soggetto}.")
        seed = 2000 + n
        t = time.time()
        genera(p, os.path.join(G.ARTE, rel), negativo=NEGATIVO + NEG_EDIFICI, larghezza=w, altezza=h, seed=seed)
        dati = G.carica()  # ricarica: nel frattempo la pagina può aver salvato approvazioni/richieste
        G.aggiungi_variante(dati, id_carta, rel, p, seed, nota=NOTA, da=vecchia)
        carta = G.trova(dati, id_carta)
        for v in carta["varianti"]:
            if v["id"] == vecchia and not v["scartata"]:
                v["scartata"] = True
                v["nota"] = (v["nota"] + " · " if v["nota"] else "") + "sostituita (edifici visibili)"
                if carta["approvata"] == vecchia:
                    carta["approvata"] = None
        G.salva(dati)
        print(f"{id_carta} {vid} (al posto di {vecchia}) seed={seed} {time.time()-t:.0f}s", flush=True)
