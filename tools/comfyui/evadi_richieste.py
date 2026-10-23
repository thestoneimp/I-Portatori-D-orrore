"""Evade le richieste di modifica/nuove varianti in attesa nella galleria (arte/galleria.json).
Le modifiche testuali al prompt le decide Claude: qui sotto, per ogni richiesta, il prompt nuovo.
Uso: python tools/comfyui/evadi_richieste.py"""
import os, sys, time
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "galleria"))
from genera import genera, coda_vuota
from stile import NEGATIVO, FORMATO_LUOGO
import galleria as G

# id richiesta -> (carta, funzione che trasforma il prompt della variante di partenza, negativo extra, nota)
MODIFICHE = {
    "R001": ("A09_studio", lambda p: p.replace(", a stuffed owl on a cabinet", ""), ", owl, bird", "senza gufo"),
}

if __name__ == "__main__":
    if not coda_vuota():
        sys.exit("Coda ComfyUI non vuota: riprovo più tardi.")
    for id_r, (id_carta, trasforma, neg_extra, nota) in MODIFICHE.items():
        dati = G.carica()
        carta = G.trova(dati, id_carta)
        r = next((x for x in carta["richieste"] if x["id"] == id_r), None)
        if not r or r["stato"] != "in_attesa":
            continue
        base = next(v for v in carta["varianti"] if v["id"] == r["variante"])
        nuovo = trasforma(base["prompt"])
        assert nuovo != base["prompt"], "la modifica non ha cambiato il prompt"
        vid = G.prossimo_id_variante(carta)
        rel = f"luoghi/{id_carta}_{vid}.png"
        w, h = FORMATO_LUOGO
        t = time.time()
        genera(nuovo, os.path.join(G.ARTE, rel), negativo=NEGATIVO + neg_extra, larghezza=w, altezza=h, seed=base["seed"])
        dati = G.carica()
        nv = G.aggiungi_variante(dati, id_carta, rel, nuovo, base["seed"], nota=f"{nota} ({id_r})", da=base["id"])
        G.evadi_richiesta(dati, id_carta, id_r, esito=f"nuova variante {nv}")
        G.salva(dati)
        print(f"{id_r} -> {id_carta} {nv} {time.time()-t:.0f}s", flush=True)
