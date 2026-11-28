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
 ("c01_aerial", "p01", 0), ("c02_street", "p01", 3),
 ("c03_grandma", "p02", 0), ("c04_grandma_huss", "p02", 4),
 ("c05_mailman", "p03", 0), ("c06_mailman_huss", "p03", 5),
 ("c07_cat", "p04", 0), ("c08_cat_huss", "p04", 4),
 ("c09_except", "p05", 0),
 ("c10_try", "p06", 0), ("c11_squeak", "p06", 7),
 ("c12_pull_wide", "p07", 0), ("c13_mudville", "p07", 8),
 ("c14_dragged", "p08", 0), ("c15_faceplant", "p08", 5), ("c16_mudfaces", "p08", 7),
 ("c17_captain", "p09", 0), ("c18_gap", "p09", 5),
 ("c19_ava_point", "p10", 0), ("c20_ava_smug", "p10", 3),
 ("c21_poster", "p11", 0),
 ("c22_chili", "p12", 0), ("c23_smoke", "p12", 4), ("c24_squeak2", "p12", 10),
 ("c25_laptop", "p13", 0), ("c26_laptop_huss", "p13", 5),
 ("c27_night_town", "p14", 0), ("c28_garage", "p14", 7), ("c29_rope", "p14", 11),
 ("c30_car", "p15", 0),
 ("c31_truck", "p16", 0), ("c32_driver", "p16", 6),
 ("c33_venue", "p17", 0),
 ("c34_mud_huss", "p18", 0), ("c35_trees", "p18", 4),
 ("c36_chant", "p19", 0), ("c36b_chant", "p19", 1), ("c36c_chant", "p19", 2),
 ("c37_score10", "p20", 0), ("c38_shoes", "p20", 3), ("c39_worried", "p20", 7),
 ("c40_grab", "p21", 0), ("c41_mouth", "p21", 4),
 ("c42_squeak3", "p22", 0),
 ("c43_laugh", "p23", 0),
 ("c44_score5", "p24", 0), ("c45_flashback", "p24", 2), ("c46_calm", "p24", 6),
 ("c47_eyes", "p25", 0),
 ("c48_bighuss", "p26", 0),
 ("c49_tight", "p27", 0), ("c50_fly", "p27", 4), ("c51_loop", "p27", 11), ("c52_splash", "p27", 15),
 ("c53_win", "p28", 0),
 ("c54_town_end", "p29", 0), ("c55_leo_jar", "p29", 6),
 ("c56_end1", "p30", 0), ("c57_end2", "p30", 1), ("c58_end3", "p30", 2),
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
        "huss_small": [hw("p02", 4), hw("p03", 5), hw("p04", 4)],
        "squeak": [hw("p06", 7), hw("p12", 10), hw("p22", 0)],
        "chant": [hw("p19", i) for i in range(3)],
        "end_chant": [hw("p30", i) for i in range(3)],
        "big_huss": hw("p26", 0),
        "laptop_huss": hw("p13", 6),
        "mud_huss": hw("p18", 1),
        "splash_old": cs["c15_faceplant"]["start"] + 0.35,
        "splash": cs["c52_splash"]["start"] + 0.45,
        "rope_snap": cs["c49_tight"]["start"] + 0.1,
        "whoosh": [cs["c50_fly"]["start"], cs["c51_loop"]["start"]],
        "car_creak": cs["c30_car"]["start"], "truck_creak": cs["c31_truck"]["start"],
        "win": cs["c53_win"]["start"],
    }
    out = dict(fps=FPS, duration=duration, frames=int(round(duration * FPS)), cuts=cuts, events=ev, lines=ph["phrases"])
    json.dump(out, open(os.path.join(B, "timeline.json"), "w"), indent=1)
    print(f"{len(cuts)} cuts, {duration:.2f}s, {out['frames']} frames, avg shot {duration/len(cuts):.2f}s")


if __name__ == "__main__":
    main()
