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
 ("c04_grandma_cat", "p03", 0), ("c05_backflip", "p03", 3),
 ("c06_mailman_dog", "p04", 0), ("c07_dog_hoop", "p04", 4),
 ("c08_except", "p05", 0), ("c09_nopets", "p05", 2),
 ("c10_rock", "p06", 0), ("c11_gary", "p06", 5),
 ("c12_bark", "p07", 0), ("c13_eat", "p07", 3), ("c14_nothing", "p07", 6),
 ("c15_venue", "p08", 0), ("c16_bone", "p08", 5),
 ("c17_cat_flip", "p09", 0), ("c18_dog_hoops", "p09", 6), ("c19_cheer", "p09", 10),
 ("c20_turn", "p10", 0), ("c21_sat", "p10", 5), ("c22_minute", "p10", 9),
 ("c23_laugh", "p11", 0), ("c24_dog_laugh", "p11", 2),
 ("c25_train", "p12", 0), ("c26_night", "p12", 4),
 ("c27_sit", "p13", 0), ("c28_sat", "p13", 2), ("c29_stay", "p13", 4), ("c30_stayed", "p13", 6), ("c31_roll", "p13", 8), ("c32_working", "p13", 11),
 ("c33_final", "p14", 0), ("c34_judge", "p14", 4),
 ("c35_breath", "p15", 0),
 ("c36_bighuss", "p16", 0),
 ("c37_fly", "p17", 0), ("c38_mud", "p17", 5), ("c39_gary_still", "p17", 9),
 ("c40_judge_point", "p18", 0), ("c41_award", "p18", 5),
 ("c42_town_rocks", "p19", 0), ("c43_grandma_rock", "p19", 4),
 ("c44_end1", "p20", 0), ("c45_end2", "p20", 2), ("c46_end3", "p20", 4),
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
        "big_huss": hw("p16", 0),
        "flip": cs["c05_backflip"]["start"] + 0.1,
        "hoop": cs["c07_dog_hoop"]["start"] + 0.1,
        "flip3": cs["c17_cat_flip"]["start"],
        "hoops3": cs["c18_dog_hoops"]["start"],
        "splash": cs["c38_mud"]["start"] + 0.35,
        "win": cs["c41_award"]["start"],
    }
    out = dict(fps=FPS, duration=duration, frames=int(round(duration * FPS)), cuts=cuts, events=ev, lines=ph["phrases"])
    json.dump(out, open(os.path.join(B, "timeline.json"), "w"), indent=1)
    print(f"{len(cuts)} cuts, {duration:.2f}s, {out['frames']} frames, avg shot {duration/len(cuts):.2f}s")


if __name__ == "__main__":
    main()
