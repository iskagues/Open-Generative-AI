"""Step 1a - expressive narration takes (run with the Chatterbox venv: ~/cbx/bin/python).

Chatterbox (open-weights, MIT) clones the narrator / Noah timbre from clean
reference clips and acts each line with a per-line emotion intensity
("exaggeration") and pacing ("cfg"). Several takes per line are written to
build/vo_cb/<id>_<n>.wav; 01b_voice_fit.py picks the best take.
Chatterbox embeds an inaudible Perth provenance watermark in its output.
"""
import os, sys
import torch, torchaudio as ta
from chatterbox.tts import ChatterboxTTS

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "build", "vo_cb")
TAKES = int(os.environ.get("TAKES", 3))

# id, text as spoken, voice, exaggeration (emotion), cfg (lower = slower, more deliberate)
LINES = [
 ("p01", "Every night, at exactly nine seventeen, our town square went... dark.", "narr", 0.65, 0.45),
 ("p02", "The streetlights. The shops. Even the mayor's ridiculous golden statue.", "narr", 0.70, 0.45),
 ("p03", "And by morning? Everything worked again.", "narr", 0.65, 0.45),
 ("p04", "The mayor blamed electricians. The baker blamed aliens.", "narr", 0.70, 0.45),
 ("p05", "I blamed one kid.", "narr", 0.75, 0.35),
 ("p06", "The quiet boy in the green hoodie.", "narr", 0.60, 0.40),
 ("p07", "Every night, I saw him climb the hill, carrying a giant red switch.", "narr", 0.65, 0.45),
 ("p08", "So on Friday, I followed him.", "narr", 0.75, 0.45),
 ("p09", "Past the playground. Through the trees. Into the abandoned observatory.", "narr", 0.80, 0.50),
 ("p10", "He reached for the switch.", "narr", 0.85, 0.45),
 ("p11", "I screamed,", "narr", 0.90, 0.40),
 ("p12", "STOP!", "narr", 1.30, 0.30),
 ("p13", "Please... just one minute.", "noah", 0.55, 0.35),
 ("p14", "The whole square disappeared into darkness.", "narr", 0.70, 0.40),
 ("p15", "I was furious...", "narr", 0.95, 0.40),
 ("p16", "Until he pointed upward.", "narr", 0.55, 0.35),
 ("p17", "Thousands of stars.", "narr", 0.85, 0.35),
 ("p18", "A glowing comet, stretching across the sky.", "narr", 0.80, 0.35),
 ("p19", "On his desk lay a crayon drawing of that same comet.", "narr", 0.55, 0.40),
 ("p20", "Below it, a note:", "narr", 0.55, 0.40),
 ("p21", "I want to see the sky sparkle.", "narr", 0.65, 0.35),
 ("p22", "His little sister had been in the hospital all week.", "narr", 0.60, 0.35),
 ("p23", "Tonight was her first night home.", "narr", 0.65, 0.35),
 ("p24", "He wasn't trying to ruin our nights.", "narr", 0.65, 0.40),
 ("p25", "He was giving her one she would never forget.", "narr", 0.75, 0.35),
 ("p26", "And for the first time...", "narr", 0.60, 0.35),
 ("p27", "Nobody asked him to turn the lights back on.", "narr", 0.70, 0.35),
]

if __name__ == "__main__":
    only = set(sys.argv[1:])
    torch.manual_seed(0)
    m = ChatterboxTTS.from_pretrained(device="cpu")
    refs = {v: os.path.join(OUT, f"ref_{v}.wav") for v in ("narr", "noah")}
    for pid, text, voice, ex, cfg in LINES:
        if only and pid not in only:
            continue
        for n in range(TAKES):
            path = os.path.join(OUT, f"{pid}_{n}.wav")
            if os.path.exists(path):
                continue
            torch.manual_seed(1000 * n + int(pid[1:]))
            w = m.generate(text, audio_prompt_path=refs[voice], exaggeration=ex, cfg_weight=cfg,
                           temperature=0.75)
            ta.save(path, w, m.sr)
            print(pid, n, f"{w.shape[1] / m.sr:.2f}s", flush=True)
