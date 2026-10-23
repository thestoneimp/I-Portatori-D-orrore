"""Evade le richieste del Bagno (A08): R002 = ritocco mirato con Qwen-Image-Edit, R003 = rifacimento della v2.

R002: Qwen-Image-Edit-2509 (GGUF) rigenera l'immagine seguendo l'istruzione; poi SOLO la zona del rubinetto viene incollata
      sull'originale con un bordo sfumato, così il resto resta identico pixel per pixel.
R003: nuovo prompt (finestra dentro il bagno, lampadina asciutta) con Qwen-Image, 2 candidati (seed diversi).
Isolamento (ComfyUI condiviso con un altro progetto): l'unico file scritto nelle cartelle di ComfyUI è l'immagine di partenza
caricata in input/ con prefisso 'portatori_'; gli output vengono scaricati nel progetto. Riprendibile (salta le richieste evase)."""
import io, json, os, sys, time, urllib.request, uuid
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "galleria"))
from PIL import Image, ImageFilter
from genera import genera, coda_vuota, _http, SERVER
from stile import NEGATIVO, FORMATO_LUOGO
import galleria as G

# ---------------------------------------------------------------- Qwen-Image-Edit
def carica_input(percorso, nome):
    """Carica un'immagine nella cartella input di ComfyUI (multipart) col nome dato; restituisce il nome assegnato."""
    b = uuid.uuid4().hex
    corpo = (f'--{b}\r\nContent-Disposition: form-data; name="image"; filename="{nome}"\r\nContent-Type: image/png\r\n\r\n').encode() + open(percorso, "rb").read() \
        + (f'\r\n--{b}\r\nContent-Disposition: form-data; name="overwrite"\r\n\r\ntrue\r\n--{b}--\r\n').encode()
    req = urllib.request.Request(SERVER + "/upload/image", data=corpo, headers={"Content-Type": f"multipart/form-data; boundary={b}"})
    return json.loads(urllib.request.urlopen(req, timeout=60).read())["name"]

def workflow_edit(nome_img, istruzione, seed, passi=20, cfg=4.0, larghezza=1024, altezza=688):
    return {
        "1": {"class_type": "UnetLoaderGGUF", "inputs": {"unet_name": "Qwen-Image-Edit-2509-Q3_K_M.gguf"}},
        "2": {"class_type": "CLIPLoader", "inputs": {"clip_name": "qwen_2.5_vl_7b_fp8_scaled.safetensors", "type": "qwen_image", "device": "default"}},
        "3": {"class_type": "VAELoader", "inputs": {"vae_name": "qwen_image_vae.safetensors"}},
        "4": {"class_type": "LoadImage", "inputs": {"image": nome_img}},
        "5": {"class_type": "ImageScale", "inputs": {"image": ["4", 0], "upscale_method": "bilinear", "width": larghezza, "height": altezza, "crop": "disabled"}},
        "6": {"class_type": "ModelSamplingAuraFlow", "inputs": {"model": ["1", 0], "shift": 3.0}},
        "7": {"class_type": "CFGNorm", "inputs": {"model": ["6", 0], "strength": 1.0}},
        "8": {"class_type": "TextEncodeQwenImageEditPlus", "inputs": {"clip": ["2", 0], "prompt": istruzione, "vae": ["3", 0], "image1": ["5", 0]}},
        "9": {"class_type": "TextEncodeQwenImageEditPlus", "inputs": {"clip": ["2", 0], "prompt": "", "vae": ["3", 0], "image1": ["5", 0]}},
        "10": {"class_type": "VAEEncode", "inputs": {"pixels": ["5", 0], "vae": ["3", 0]}},
        "11": {"class_type": "KSampler", "inputs": {"model": ["7", 0], "seed": seed, "steps": passi, "cfg": cfg, "sampler_name": "euler", "scheduler": "simple",
                                                    "positive": ["8", 0], "negative": ["9", 0], "latent_image": ["10", 0], "denoise": 1.0}},
        "12": {"class_type": "VAEDecode", "inputs": {"samples": ["11", 0], "vae": ["3", 0]}},
        "13": {"class_type": "PreviewImage", "inputs": {"images": ["12", 0]}},
    }

def modifica_edit(sorgente, istruzione, destinazione, zona, seed=1981, sfumatura=12):
    """Ritocca `sorgente` con Qwen-Image-Edit e incolla solo `zona` (l, t, r, b nelle coordinate della sorgente) sull'originale."""
    nome = carica_input(sorgente, "portatori_" + os.path.basename(sorgente))
    pid = json.loads(_http("/prompt", {"prompt": workflow_edit(nome, istruzione, seed)}))["prompt_id"]
    while True:
        h = json.loads(_http("/history/" + pid))
        if pid in h: break
        time.sleep(3)
    if h[pid]["status"]["status_str"] != "success":
        raise RuntimeError(json.dumps(h[pid]["status"])[:600])
    img = h[pid]["outputs"]["13"]["images"][0]
    q = f"filename={img['filename']}&subfolder={img['subfolder']}&type={img['type']}"
    modificata = Image.open(io.BytesIO(_http("/view?" + q))).convert("RGB")
    orig = Image.open(sorgente).convert("RGB")
    modificata = modificata.resize(orig.size, Image.LANCZOS)
    modificata.save(destinazione.replace(".png", "_intera.png"))          # risultato non incollato (per confronto)
    maschera = Image.new("L", orig.size, 0)
    maschera.paste(255, zona)
    maschera = maschera.filter(ImageFilter.GaussianBlur(sfumatura))
    Image.composite(modificata, orig, maschera).save(destinazione)

# ---------------------------------------------------------------- richieste
def richiesta_R002():
    dati = G.carica(); carta = G.trova(dati, "A08_bagno")
    r = next(x for x in carta["richieste"] if x["id"] == "R002")
    if r["stato"] != "in_attesa": return
    base = next(v for v in carta["varianti"] if v["id"] == r["variante"])
    istruzione = ("Replace only the faucet above the bathtub with a proper antique bathtub faucet: a curved brass spout pointing down over the tub, "
                  "with two small round cross-shaped handles on a horizontal pipe, mounted on the wall above the tub rim. It must not look like a telephone receiver. "
                  "Keep everything else exactly the same, in the same hand-drawn ink and watercolor style, colors and lines.")
    vid = G.prossimo_id_variante(carta); rel = f"luoghi/A08_bagno_{vid}.png"
    t = time.time()
    modifica_edit(os.path.join(G.ARTE, base["file"]), istruzione, os.path.join(G.ARTE, rel), zona=(160, 325, 305, 515), seed=base["seed"])
    dati = G.carica()
    nv = G.aggiungi_variante(dati, "A08_bagno", rel, "[Qwen-Image-Edit] " + istruzione, base["seed"], nota="rubinetto ritoccato (R002)", da=base["id"])
    G.evadi_richiesta(dati, "A08_bagno", "R002", esito=f"nuova variante {nv}"); G.salva(dati)
    print(f"R002 -> {nv} {time.time()-t:.0f}s", flush=True)

def richiesta_R003():
    dati = G.carica(); carta = G.trova(dati, "A08_bagno")
    r = next(x for x in carta["richieste"] if x["id"] == "R003")
    if r["stato"] != "in_attesa": return
    base = next(v for v in carta["varianti"] if v["id"] == r["variante"])
    vecchio = ", a flickering bare bulb, water dripping on the floor"
    assert vecchio in base["prompt"]
    nuovo = base["prompt"].replace(vecchio, ", a bare light bulb hanging steadily from a cord with a warm glow, a small window with a torn curtain on the same wall of the bathroom, "
                                   "a fully enclosed small bathroom with four walls and a ceiling")
    neg = NEGATIVO + ", doorway, open door, corridor, hallway, another room, water dripping from the light bulb, drops falling from the bulb"
    w, h = FORMATO_LUOGO
    nuove = []
    for seed in (base["seed"], 2011):
        dati = G.carica(); carta = G.trova(dati, "A08_bagno")
        vid = G.prossimo_id_variante(carta); rel = f"luoghi/A08_bagno_{vid}.png"
        t = time.time()
        genera(nuovo, os.path.join(G.ARTE, rel), negativo=neg, larghezza=w, altezza=h, seed=seed)
        dati = G.carica()
        G.aggiungi_variante(dati, "A08_bagno", rel, nuovo, seed, nota="finestra nel bagno, lampadina asciutta (R003)", da=base["id"]); G.salva(dati)
        nuove.append(vid); print(f"R003 -> {vid} seed={seed} {time.time()-t:.0f}s", flush=True)
    dati = G.carica(); G.evadi_richiesta(dati, "A08_bagno", "R003", esito="nuove varianti " + ", ".join(nuove)); G.salva(dati)

if __name__ == "__main__":
    if not coda_vuota():
        sys.exit("Coda ComfyUI non vuota: riprovo più tardi.")
    for f in (richiesta_R002, richiesta_R003):
        try:
            f()
        except Exception as e:   # una richiesta che fallisce non blocca l'altra
            print(f"ERRORE in {f.__name__}: {str(e)[:500]}", flush=True)
