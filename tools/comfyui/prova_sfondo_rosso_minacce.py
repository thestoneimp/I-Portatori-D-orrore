"""Prova: soggetto con la colorazione normale dei personaggi, sfondo interamente rosso (3 sfumature di rosso, stesso seed).
Registrato come varianti di M01_uomo_impermeabile (nota 'sfondo rosso: <nome>').
Uso: python tools/comfyui/prova_sfondo_rosso_minacce.py"""
import os, sys, time
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "galleria"))
from genera import genera, coda_vuota
from stile import STILE, NEGATIVO, FORMATO_VERTICALE
import galleria as G

ID = "M01_uomo_impermeabile"
SOGGETTO = ("portrait illustration of a tall man in a long soaked trench coat with the collar turned up and a wide-brimmed hat pulled low, "
            "his face completely hidden in deep shadow, standing motionless and menacing, three-quarter view, centered, "
            "against a background entirely washed in {rosso}, the whole background one single flat red color field with only faint rain streaks and a vague street silhouette in darker red.")
ROSSI = {
    "rosso-vivo": "bright saturated scarlet red",
    "rosso-sangue": "deep blood red",
    "rosso-mattone": "brick red, slightly orange",
}
NEG = ", weapon, gun, knife, pistol, holding an object, red glowing eyes, blue background, black background, green background, white background"

if __name__ == "__main__":
    if not coda_vuota():
        sys.exit("Coda ComfyUI non vuota.")
    w, h = FORMATO_VERTICALE
    for nome, rosso in ROSSI.items():
        dati = G.carica(); carta = G.trova(dati, ID)
        if any(v.get("nota") == "sfondo rosso: " + nome for v in carta["varianti"]):
            continue
        vid = G.prossimo_id_variante(carta)
        rel = f"minacce/{ID}_{vid}.png"
        p = f"{SOGGETTO.format(rosso=rosso)} {STILE}"
        t = time.time()
        genera(p, os.path.join(G.ARTE, rel), negativo=NEGATIVO + NEG, larghezza=w, altezza=h, seed=5000)
        G.aggiungi_variante(dati, ID, rel, p, 5000, nota="sfondo rosso: " + nome)
        G.salva(dati)
        print(nome, vid, f"{time.time()-t:.0f}s", flush=True)
