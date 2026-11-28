"""Step 2 - cut list + events from the real narration timing.

Every cut starts on a spoken word (line id, word index) like the reference
edit (~1 cut per second). Writes build/timeline.json.
If build/words.json does not exist yet, a provisional timing (230 wpm) is used
so the picture can be previewed while the voice is still being generated.
"""
import json, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from script import LINES

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
B = os.path.join(ROOT, "build")
FPS = 30
TAIL = 1.6  # let the music breathe out at the end

CUTS = [
 ("c01_aerial", "p01", 0), ("c02_street", "p01", 4),
 ("c03_h1", "p02", 0), ("c03_h2", "p02", 2), ("c03_h3", "p02", 4),
 ("c04_pie", "p03", 0), ("c05_birds", "p03", 5),
 ("c06_pan", "p04", 0), ("c07_over", "p04", 4),
 ("c08_except", "p05", 0), ("c09_water", "p05", 2), ("c10_twice", "p05", 5),
 ("c11_alarm", "p06", 0),
 ("c12_venue", "p07", 0), ("c13_spoon", "p07", 5),
 ("c14_look", "p08", 0), ("c15_please", "p08", 6), ("c16_remember", "p08", 8),
 ("c17_train", "p09", 0), ("c18_toast", "p09", 3), ("c19_toast_b", "p09", 4), ("c20_cereal", "p09", 5), ("c21_cereal_b", "p09", 6), ("c22_ice", "p09", 7), ("c23_ice_b", "p09", 9),
 ("c24_secret", "p10", 0),
 ("c25_hands", "p11", 0), ("c26_gran_huss", "p11", 7),
 ("c27_day", "p12", 0), ("c28_pizza", "p12", 2), ("c29_nooven", "p12", 7),
 ("c30_sigh", "p13", 0), ("c31_laugh", "p13", 3),
 ("c32_breath", "p14", 0),
 ("c33_bighuss", "p15", 0),
 ("c34_spin", "p16", 0), ("c35_cook", "p16", 5), ("c36_golden", "p16", 8),
 ("c37_bite", "p17", 0), ("c38_cry", "p17", 5),
 ("c39_award", "p18", 0),
 ("c40_town", "p19", 0), ("c41_grandma", "p19", 5),
 ("c42_end1", "p20", 0), ("c42_end2", "p20", 2), ("c42_end3", "p20", 4),
]


def provisional():
    t, words, lines = 0.05, [], []
    for pid, spk, text, cap, ex, cfg, pause in LINES:
        ws = (cap or text).split(); s0 = t
        for w in ws:
            d = 60 / 230 * (1.25 if w.endswith(("!", ".", "...")) else 1.0)
            words.append(dict(word=w, start=round(t, 3), end=round(t + d * 0.9, 3), phrase=pid)); t += d
        lines.append(dict(id=pid, start=round(s0, 3), end=round(t, 3))); t += pause
    return dict(total=t, phrases=lines), words


def main():
    wp = os.path.join(B, "words.json")
    if os.path.exists(wp):
        words = json.load(open(wp)); ph = json.load(open(os.path.join(B, "phrases.json")))
    else:
        ph, words = provisional(); print("PROVISIONAL timing")
    byline = {}
    for w in words:
        byline.setdefault(w["phrase"], []).append(w)
    duration = round(ph["total"] + TAIL, 3)
    cuts = []
    for i, (name, pid, wi) in enumerate(CUTS):
        ws = byline[pid]
        start = 0.0 if i == 0 else ws[min(wi, len(ws) - 1)]["start"] - 0.06
        cuts.append(dict(name=name, line=pid, start=round(start, 3)))
    for i, c in enumerate(cuts):
        c["end"] = cuts[i + 1]["start"] if i + 1 < len(cuts) else duration
        assert c["end"] - c["start"] > 0.15, c
    W = lambda pid, i: byline[pid][min(i, len(byline[pid]) - 1)]
    cs = {c["name"]: c for c in cuts}
    # sound anchors: every HUSS / squeak lands on its word
    hw = lambda pid, i: round(W(pid, i)["start"], 3)
    ev = {
        "h6a": [hw("p02", i) for i in range(6)],
        "h6b": [hw("p20", i) for i in range(6)],
        "big_huss": hw("p15", 0),
        "gran_huss": cs["c26_gran_huss"]["start"] + 0.25,
        "flip": cs["c06_pan"]["start"] + 0.3,
        "burn": [cs[n]["start"] for n in ("c09_water", "c19_toast_b", "c21_cereal_b", "c23_ice_b")],
        "alarm": cs["c11_alarm"]["start"],
        "pop": cs["c18_toast"]["start"] + 0.2,
        "ding": cs["c36_golden"]["start"],
        "win": cs["c39_award"]["start"],
    }
    out = dict(fps=FPS, duration=duration, frames=int(round(duration * FPS)), cuts=cuts, events=ev, lines=ph["phrases"])
    json.dump(out, open(os.path.join(B, "timeline.json"), "w"), indent=1)
    print(f"{len(cuts)} cuts, {duration:.2f}s, {out['frames']} frames, avg shot {duration/len(cuts):.2f}s")


if __name__ == "__main__":
    main()
