"""Crowd chant layer: many synthetic Kokoro voices shouting "Huss!" (pitch-varied,
slightly de-synced) mixed into one stereo hit. Output: build/crowd_huss.wav"""
import os, numpy as np, soundfile as sf
from kokoro_onnx import Kokoro
from scipy import signal
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
k = Kokoro(os.path.expanduser("~/models/kokoro-v1.0.onnx"), os.path.expanduser("~/models/voices-v1.0.bin"))
voices = ["am_adam", "am_michael", "am_eric", "am_liam", "am_onyx", "am_fenrir", "am_puck", "af_bella", "af_nicole", "af_sarah", "bm_george", "bm_lewis", "af_heart", "bf_emma"]
rng = np.random.default_rng(3); SR = 48000
out = np.zeros((int(1.0 * SR), 2))
for rep in range(2):
    for v in voices:
        a, sr = k.create("Huss!", voice=v, speed=1.15, lang="en-us")
        a = signal.resample_poly(a, SR, sr)
        nz = np.where(np.abs(a) > 0.02)[0]; a = a[nz[0]:nz[-1]]
        st = rng.uniform(0.95, 1.08); a = signal.resample(a, int(len(a) / st))
        off = int(rng.uniform(0, 0.07) * SR); pan = rng.uniform(-0.8, 0.8)
        n = min(len(a), len(out) - off)
        out[off:off + n, 0] += a[:n] * np.cos((pan + 1) * np.pi / 4); out[off:off + n, 1] += a[:n] * np.sin((pan + 1) * np.pi / 4)
out /= np.max(np.abs(out)) + 1e-9
sf.write(os.path.join(ROOT, "build", "crowd_huss.wav"), out.astype(np.float32), SR)
print("ok", len(out) / SR)
