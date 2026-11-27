"""Single narrator "Huss!" takes (Chatterbox built-in voice) used to build the rhythmic
six-huss refrain. Run with ~/cbx/bin/python. Output: _shared/huss/huss_N.wav"""
import os, copy, torch, torchaudio as ta
from chatterbox.tts import ChatterboxTTS
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), "huss")
m = ChatterboxTTS.from_pretrained(device="cpu")
for n in range(12):
    p = os.path.join(D, f"huss_{n}.wav")
    if os.path.exists(p): continue
    torch.manual_seed(1009 * n + 17)
    text = ["Huss!", "Huss!", "HUSS!"][n % 3]
    w = m.generate(text, exaggeration=[1.0, 1.2, 1.4][n % 3], cfg_weight=0.38, temperature=0.8)
    ta.save(p, w, m.sr); print(n, f"{w.shape[1] / m.sr:.2f}s", flush=True)
