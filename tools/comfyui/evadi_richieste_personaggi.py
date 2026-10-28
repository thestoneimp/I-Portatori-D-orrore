"""Evade le richieste R004-R006 (nuove varianti di Matt, Kimberly, Scott): 4 varianti ciascuno con il nuovo aspetto indicato
dall'utente, SENZA oggetti né abilità (niente armi, libri, radio ecc.). Ogni variante è registrata subito nella galleria. Riprendibile.
Uso: python tools/comfyui/evadi_richieste_personaggi.py"""
import os, sys, time
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "galleria"))
from genera import genera, coda_vuota
from stile import prompt, NEGATIVO, FORMATO_VERTICALE
import galleria as G

NEG_OGGETTI = ", weapon, gun, pistol, crossbow, dagger, knife, book, bible, grimoire, radio, holding an object"

# id richiesta -> (carta, aspetto fisso, 4 varianti di vestiti/posa/sfondo)
RICHIESTE = {
    "R006": ("P02_scott",
        "a young man named Scott, about 20, overweight and soft-bodied, round friendly face, good-natured but frightened expression, messy brown hair, wide anxious eyes",
        ["wearing a baggy knit sweater and corduroy trousers, hands raised nervously, glancing over his shoulder, in a dark hallway",
         "wearing a plaid shirt and an unzipped windbreaker, sweating, backing away with a shaky smile, a moonlit street",
         "wearing a college hoodie and sneakers, peeking around a doorframe, wide-eyed, a candlelit room",
         "wearing a rain-soaked trench coat over a t-shirt, clutching his own arms in fear, standing in a foggy garden at night"]),
    "R005": ("P03_kimberly",
        "a young woman named Kimberly, about 20, aspiring journalist, long straight black hair, round glasses, curious and determined expression",
        ["wearing a beige trench coat and a scarf, glasses reflecting candlelight, standing in a dark library",
         "wearing a denim jacket and a band t-shirt, glasses slipping down her nose, crouching to peer through a keyhole, a dim corridor",
         "wearing a college sweater and a long skirt, glancing back over her shoulder, a rainy street at night",
         "wearing a rain jacket with the hood down, hair damp, glasses fogged, standing in a cluttered newsroom basement"]),
    "R004": ("P04_matt",
        "a man named Matt, about 20, university quarterback, tall with an athletic muscular build, short buzzed brown hair, confident but wary expression",
        ["wearing a varsity football jacket and jeans, standing tall in a dark corridor of an abandoned house",
         "wearing a sleeveless training shirt and sweatpants, stretching a shoulder, in a ruined basement",
         "wearing a leather jacket over a team t-shirt, leaning against a pickup truck at night, a deserted gas station behind him",
         "wearing a football jersey with a number and a rain-soaked hoodie, running along a rainy forest road, headlights glaring behind him"]),
}

if __name__ == "__main__":
    if not coda_vuota():
        sys.exit("Coda ComfyUI non vuota: riprovo più tardi.")
    w, h = FORMATO_VERTICALE
    for id_r, (id_carta, aspetto, varianti) in RICHIESTE.items():
        dati = G.carica()
        r = next((x for x in G.trova(dati, id_carta)["richieste"] if x["id"] == id_r), None)
        if not r or r["stato"] != "in_attesa":
            continue
        nuove = []
        for i, var in enumerate(varianti):
            dati = G.carica()
            carta = G.trova(dati, id_carta)
            vid = G.prossimo_id_variante(carta)
            seed = 2000 + 10 * int(id_r[1:]) + i
            rel = f"personaggi/{id_carta}_{vid}.png"
            p = prompt(f"portrait illustration of {aspetto}, {var}, three-quarter view, centered.")
            t = time.time()
            genera(p, os.path.join(G.ARTE, rel), negativo=NEGATIVO + NEG_OGGETTI, larghezza=w, altezza=h, seed=seed)
            nuove.append(G.aggiungi_variante(dati, id_carta, rel, p, seed, nota=f"nuovo aspetto ({id_r})"))
            G.salva(dati)
            print(f"{id_r} {id_carta} {nuove[-1]} {time.time()-t:.0f}s", flush=True)
        dati = G.carica()
        G.evadi_richiesta(dati, id_carta, id_r, esito="nuove varianti " + ", ".join(nuove))
        G.salva(dati)
