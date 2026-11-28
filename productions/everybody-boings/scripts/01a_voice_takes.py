"""Step 1a - expressive takes per line with Chatterbox (run with ~/cbx/bin/python).

Voices are synthetic and NOT cloned from the reference video: the narrator
(Milo, a kid) is Kokoro af_nova raised 6 semitones with shifted formants;
Zoe is Kokoro af_sky, raised 6 semitones. Chatterbox clones these references and acts
each line with its own emotion intensity. Its output carries an inaudible
Perth provenance watermark.
"""
import os, sys
import torch, torchaudio as ta
from chatterbox.tts import ChatterboxTTS
sys.path.insert(0, os.path.dirname(__file__))
from script import LINES

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VO = os.path.join(ROOT, "build", os.environ.get("VO_DIR", "vo"))
TAKES = int(os.environ.get("TAKES", 3))
REF_DIR = os.path.join(ROOT, "build", "vo")
REF = {"kid": os.path.join(REF_DIR, os.environ.get("NARR_REF", "ref_nova6.wav")), "zoe": os.path.join(REF_DIR, "ref_sky6.wav")}

if __name__ == "__main__":
    only = set(sys.argv[1:])
    m = ChatterboxTTS.from_pretrained(device="cpu")
    for pid, spk, text, cap, ex, cfg, pause in LINES:
        if only and pid not in only:
            continue
        for n in range(TAKES):
            path = os.path.join(VO, f"{pid}_{n}.wav")
            if os.path.exists(path):
                continue
            torch.manual_seed(7919 * n + int(pid[1:]))
            w = m.generate(text, audio_prompt_path=REF[spk], exaggeration=ex, cfg_weight=cfg, temperature=0.75)
            ta.save(path, w, m.sr)
            print(pid, n, f"{w.shape[1] / m.sr:.2f}s", flush=True)
