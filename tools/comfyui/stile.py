"""Stile predefinito delle immagini di gioco ("V2": disegno a matita e inchiostro colorato a mano, acquarello e pastello).

Scelto dopo le prove in arte/prove_stile_*. Palette: rosso cupo, nero, verde oliva, ombre blu fredde.
NIENTE contorni/aloni rossi forzati (provati e scartati): il rosso resta solo colore di scena.
Tutte le carte del gioco devono usare STILE e NEGATIVO da qui.
"""

STILE = ("1980s horror movie poster painting, dramatic chiaroscuro, dark palette of deep crimson red, black, olive green and cold blue shadows, "
         "ominous atmosphere. traditional hand-drawn illustration, loose pencil and ink sketch lines visible under hand-colored watercolor and colored pencil, "
         "uneven hand-applied color washes, visible pencil hatching, textured watercolor paper, rough imperfect handmade look, "
         "colored by hand, 1980s horror concept art")

NEGATIVO = ("text, letters, numbers, watermark, logo, signature, digital art, vector, smooth clean gradients, cel shading, clean perfect lines, "
            "cgi, 3d render, photo, anime, blurry, deformed hands, extra fingers, pink, magenta, cyan, modern smartphone")

# Formati (larghezza, altezza) in pixel: i luoghi sono orizzontali, il resto verticale 3:4
FORMATO_LUOGO = (1152, 768)  # 3:2, come le carte luogo del tabellone (.carta-tabellone 120x80)
FORMATO_VERTICALE = (768, 1024)


def prompt(soggetto):
    return f"{soggetto} {STILE}"
