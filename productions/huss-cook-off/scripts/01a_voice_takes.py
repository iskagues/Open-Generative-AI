"""Step 1a - expressive takes per line with Chatterbox (run with ~/cbx/bin/python).

Voices are synthetic and NOT cloned from the reference video. v2: the narrator
(Leo) uses Chatterbox's own built-in voice (NARR_REF=default) for natural, human prosody;
Ava (captain) is Kokoro af_sky, raised 6 semitones. Chatterbox clones these references and acts
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
NARR = os.environ.get("NARR_REF", "default")
# "default" = Chatterbox's built-in voice (a natural human-recorded conditioning): far more human prosody than a TTS reference
REF = {"h6": None, "kid": None if NARR == "default" else os.path.join(REF_DIR, NARR), "ava": os.path.join(REF_DIR, "ref_sky6.wav")}
CFG_MAX = float(os.environ.get("CFG_MAX", 0.38))

if __name__ == "__main__":
    only = set(sys.argv[1:])
    m = ChatterboxTTS.from_pretrained(device="cpu")
    import copy; DEFAULT_CONDS = copy.deepcopy(m.conds)
    for pid, spk, text, cap, ex, cfg, pause in LINES:
        if (only and pid not in only) or spk == "h6":
            continue
        for n in range(TAKES):
            path = os.path.join(VO, f"{pid}_{n}.wav")
            if os.path.exists(path):
                continue
            torch.manual_seed(7919 * n + int(pid[1:]))
            if REF[spk] is None: m.conds = DEFAULT_CONDS  # reset to the built-in voice
            w = m.generate(text, audio_prompt_path=REF[spk], exaggeration=ex, cfg_weight=min(cfg, CFG_MAX), temperature=0.8)
            ta.save(path, w, m.sr)
            print(pid, n, f"{w.shape[1] / m.sr:.2f}s", flush=True)
