"""Prove di colore per la prima minaccia (M01, Uomo con impermeabile): stessa scena e stesso tratto V2, ma con dominanti di colore
DIVERSE da quelle dei personaggi (rosso cupo / verde oliva / blu freddo), cosi' le minacce si distinguono a colpo d'occhio.
Ogni prova e' registrata come variante della carta M01_uomo_impermeabile nella galleria (nota = nome della dominante).
Uso: python tools/comfyui/prove_colore_minacce.py"""
import os, sys, time
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "galleria"))
from genera import genera, coda_vuota
from stile import STILE, NEGATIVO, FORMATO_VERTICALE
import galleria as G

PALETTE_BASE = "dark palette of deep crimson red, black, olive green and cold blue shadows"
SOGGETTO = ("portrait illustration of a tall man in a long soaked trench coat with the collar turned up and a wide-brimmed hat pulled low, "
            "his face completely hidden in deep shadow, standing motionless and menacing, a rainy night street behind him, three-quarter view, centered.")
NEG_MIN = ", weapon, gun, knife, pistol, holding an object, red glowing eyes"

# nome -> descrizione della dominante di colore (niente rosa/magenta: sono nel negativo di stile)
DOMINANTI = {
    "ocra-zolfo": "dark palette dominated by sickly sulfur yellow, ochre and soot black, with small touches of brown",
    "indaco-viola": "dark palette dominated by deep indigo, midnight violet and black, with small touches of pale grey",
    "grigio-cenere": "near monochrome palette of ashen grey, bone white and charcoal black fog, with only a faint touch of cold blue",
    "arancio-ruggine": "dark palette dominated by burnt orange, rust brown and soot black, with small touches of dark ochre",
    "verde-acido": "dark palette dominated by sickly acid yellow-green, toxic lime glow and black",
    "azzurro-ghiaccio": "pale palette dominated by icy white, steel blue and pale cyan-grey with black shadows",
}
ID, NOME = "M01_uomo_impermeabile", "Uomo con impermeabile"

if __name__ == "__main__":
    if not coda_vuota():
        sys.exit("Coda ComfyUI non vuota: riprovo più tardi.")
    dati = G.carica()
    if not any(c["id"] == ID for c in dati["carte"]):
        G.aggiungi_carta(dati, ID, "minaccia", NOME, "verticale", "M01 - minaccia di intelligenza 2")
        G.salva(dati)
    w, h = FORMATO_VERTICALE
    for i, (nome, dom) in enumerate(DOMINANTI.items()):
        dati = G.carica()
        carta = G.trova(dati, ID)
        if any(v.get("nota") == "prova colore: " + nome for v in carta["varianti"]):
            continue
        vid = G.prossimo_id_variante(carta)
        seed = 5000          # stesso seed: cambia solo il colore, cosi' il confronto e' pulito
        rel = f"minacce/{ID}_{vid}.png"
        p = f"{SOGGETTO} {STILE.replace(PALETTE_BASE, dom)}"
        t = time.time()
        genera(p, os.path.join(G.ARTE, rel), negativo=NEGATIVO + NEG_MIN, larghezza=w, altezza=h, seed=seed)
        G.aggiungi_variante(dati, ID, rel, p, seed, nota="prova colore: " + nome)
        G.salva(dati)
        print(nome, vid, f"{time.time()-t:.0f}s", flush=True)
