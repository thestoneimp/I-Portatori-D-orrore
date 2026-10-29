"""Toglie il fondo bianco piatto da un soggetto generato (flood-fill dai bordi + bordo morbido) e restituisce un RGBA."""
import numpy as np, cv2
from PIL import Image

def ritaglia(src, soglia=40, morbido=28):
    im = np.array(Image.open(src).convert("RGB")).astype(np.float32)
    dist = np.sqrt(((255 - im) ** 2).sum(2))              # distanza dal bianco
    h, w = dist.shape
    sfondo = (dist < soglia).astype(np.uint8)
    # tiene solo le zone di sfondo collegate al bordo (i bianchi interni al soggetto restano)
    n, lab = cv2.connectedComponents(sfondo)
    bordo = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    fondo = np.isin(lab, list(bordo))
    fondo = cv2.dilate(fondo.astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool)
    alfa = np.clip((dist - soglia * 0.5) / morbido, 0, 1)
    alfa = np.where(fondo, alfa, 1.0)
    alfa = cv2.GaussianBlur(alfa, (0, 0), 0.8)
    # toglie l'alone bianco sui bordi semitrasparenti
    a = np.maximum(alfa, 1e-3)[..., None]
    col = np.clip((im - 255 * (1 - a)) / a, 0, 255)
    col = np.where(alfa[..., None] < 0.999, col, im)
    return Image.fromarray(np.dstack([col, alfa * 255]).astype(np.uint8), "RGBA")

if __name__ == "__main__":
    import sys
    ritaglia(sys.argv[1]).save(sys.argv[2])
