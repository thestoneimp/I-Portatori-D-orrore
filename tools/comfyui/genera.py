"""Genera immagini con Qwen-Image (GGUF) tramite l'API di un ComfyUI già in esecuzione.

Non scrive nulla nelle cartelle di ComfyUI: usa PreviewImage (temp) e scarica
il risultato in una cartella del progetto. Rifiuta di partire se la coda
di ComfyUI non è vuota (il server è condiviso con un altro progetto).
"""
import json, random, sys, time, urllib.request, urllib.parse

SERVER = "http://127.0.0.1:8188"

def _http(path, data=None):
    req = urllib.request.Request(SERVER + path, data=json.dumps(data).encode() if data is not None else None,
                                 headers={"Content-Type": "application/json"})
    return urllib.request.urlopen(req, timeout=60).read()

def coda_vuota():
    q = json.loads(_http("/queue"))
    return not q["queue_running"] and not q["queue_pending"]

def workflow(prompt, negativo, larghezza, altezza, seed, passi=20, cfg=4.0):
    return {
        "1": {"class_type": "UnetLoaderGGUF", "inputs": {"unet_name": "Qwen_Image-Q3_K_M.gguf"}},
        "2": {"class_type": "CLIPLoader", "inputs": {"clip_name": "qwen_2.5_vl_7b_fp8_scaled.safetensors", "type": "qwen_image", "device": "default"}},
        "3": {"class_type": "VAELoader", "inputs": {"vae_name": "qwen_image_vae.safetensors"}},
        "4": {"class_type": "ModelSamplingAuraFlow", "inputs": {"model": ["1", 0], "shift": 3.1}},
        "5": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["2", 0], "text": prompt}},
        "6": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["2", 0], "text": negativo}},
        "7": {"class_type": "EmptySD3LatentImage", "inputs": {"width": larghezza, "height": altezza, "batch_size": 1}},
        "8": {"class_type": "KSampler", "inputs": {"model": ["4", 0], "positive": ["5", 0], "negative": ["6", 0], "latent_image": ["7", 0],
                                                    "seed": seed, "steps": passi, "cfg": cfg, "sampler_name": "euler", "scheduler": "simple", "denoise": 1.0}},
        "9": {"class_type": "VAEDecode", "inputs": {"samples": ["8", 0], "vae": ["3", 0]}},
        "10": {"class_type": "PreviewImage", "inputs": {"images": ["9", 0]}},
    }

def genera(prompt, destinazione, negativo="", larghezza=896, altezza=1152, seed=None, **kw):
    seed = random.randint(0, 2**32 - 1) if seed is None else seed
    pid = json.loads(_http("/prompt", {"prompt": workflow(prompt, negativo, larghezza, altezza, seed, **kw)}))["prompt_id"]
    while True:
        h = json.loads(_http("/history/" + pid))
        if pid in h:
            break
        time.sleep(3)
    stato = h[pid]["status"]
    if stato["status_str"] != "success":
        raise RuntimeError(json.dumps(stato)[:800])
    img = h[pid]["outputs"]["10"]["images"][0]
    q = urllib.parse.urlencode({"filename": img["filename"], "subfolder": img["subfolder"], "type": img["type"]})
    with open(destinazione, "wb") as f:
        f.write(_http("/view?" + q))
    return seed

if __name__ == "__main__":
    if not coda_vuota():
        sys.exit("La coda di ComfyUI non è vuota: probabilmente l'altro progetto sta generando. Riprova dopo.")
    t = time.time()
    s = genera(sys.argv[1], sys.argv[2])
    print(f"ok seed={s} in {time.time()-t:.0f}s")
