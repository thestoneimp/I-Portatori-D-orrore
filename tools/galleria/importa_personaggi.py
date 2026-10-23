"""Importa nella galleria le varianti dei personaggi già generate (arte/personaggi/). Idempotente."""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "comfyui"))
import galleria as G
from genera_personaggi import PERSONAGGI
from stile import prompt

NOMI = {"P01_alice": "Alice Richards", "P02_scott": "Scott Stockings", "P03_kimberly": "Kimberly Jones",
        "P04_matt": "Matt Stone", "P05_michael": "Michael Richards", "P06_julia": "Julia Constantin"}

dati = G.carica()
for chiave, (aspetto, varianti) in PERSONAGGI.items():
    carta = G.aggiungi_carta(dati, chiave, "personaggio", NOMI[chiave], "verticale", aspetto)
    for i, var in enumerate(varianti, 1):
        rel = f"personaggi/{chiave}_v{i}.png"
        if not os.path.exists(os.path.join(G.ARTE, rel)) or any(v["file"] == rel for v in carta["varianti"]):
            continue
        G.aggiungi_variante(dati, chiave, rel,
                            prompt(f"portrait illustration of {aspetto}, {var}, three-quarter view, centered."),
                            1980 + i)
G.salva(dati)
print(G.riepilogo(dati))
