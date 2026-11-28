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
TAIL = 1.8  # v2: let the music breathe out at the end

CUTS = [
 ("c01_aerial", "p01", 0), ("c02_street", "p01", 3),
 ("c03_milo_flat", "p02", 0),
 ("c04_milo_high", "p03", 0),
 ("c05_fence", "p04", 0), ("c06_mailman", "p04", 3), ("c07_morning", "p04", 6),
 ("c08_try", "p05", 0), ("c09_gone_face", "p05", 6),
 ("c10_doctor_wide", "p06", 0), ("c11_knee", "p06", 3), ("c12_nothing", "p06", 5),
 ("c13_doctor_serious", "p07", 0), ("c14_milo_shock", "p07", 3), ("c15_clip", "p07", 6),
 ("c16_poster", "p08", 0), ("c17_determined", "p08", 7),
 ("c18_cans", "p09", 0), ("c19_burp", "p09", 2),
 ("c20_springs", "p10", 0), ("c21_ceiling", "p10", 4),
 ("c22_tramp", "p11", 0), ("c23_launch", "p11", 2), ("c24_mailbox", "p11", 5),
 ("c25_cat", "p12", 0), ("c26_milo_sad", "p12", 4),
 ("c27_zoe_roof", "p13", 0),
 ("c28_zoe_close", "p14", 0), ("c29_zoe_smug", "p14", 3),
 ("c30_window", "p15", 0),
 ("c31_roofparty", "p16", 0), ("c32_garage", "p16", 7),
 ("c33_squat_close", "p17", 0), ("c34_squat_wide", "p17", 2), ("c35_moon", "p17", 6),
 ("c36_mailman_walk", "p18", 0), ("c37_mailman_happy", "p18", 8),
 ("c38_venue", "p19", 0),
 ("c39_rivals_jump", "p20", 0), ("c40_airplane", "p20", 6),
 ("c41_chant", "p21", 0),
 ("c42_score10", "p22", 0), ("c43_gap", "p22", 3), ("c44_worried", "p22", 6),
 ("c45_knees", "p23", 0), ("c46_push", "p23", 4),
 ("c47_strain", "p24", 0), ("c47b_strain_wide", "p24", 3),
 ("c48_laugh", "p25", 0),
 ("c49_score5", "p26", 0), ("c50_calm", "p26", 2),
 ("c51_eyes", "p27", 0),
 ("c52_launch", "p28", 0),
 ("c53_sky", "p29", 0), ("c54_bird", "p29", 4),
 ("c55_land", "p30", 0), ("c56_scoreboard", "p30", 6), ("c57_hat", "p30", 10), ("c58_hat_town", "p30", 14),
 ("c59_win", "p31", 0),
 ("c60_night_town", "p32", 0), ("c61_rooftop", "p32", 4),
 ("c62_ref_curb", "p33", 0),
 ("c63_ref_search", "p34", 0),
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
    ev = {
        # sound/picture anchors (absolute seconds)
        "land_hit": cs["c55_land"]["start"] + 0.35,
        "launch": cs["c52_launch"]["start"] + 0.05,
        "knee_tap": cs["c11_knee"]["start"] + 0.25,
        "burp": cs["c19_burp"]["start"] + 0.15,
        "board_fall": cs["c56_scoreboard"]["start"] + 0.9,
        "highfive": cs["c54_bird"]["start"] + 0.28,
        "window_shut": cs["c30_window"]["start"] + 0.5,
        "mailbox_hit": cs["c24_mailbox"]["start"],
    }
    out = dict(fps=FPS, duration=duration, frames=int(round(duration * FPS)), cuts=cuts, events=ev, lines=ph["phrases"])
    json.dump(out, open(os.path.join(B, "timeline.json"), "w"), indent=1)
    print(f"{len(cuts)} cuts, {duration:.2f}s, {out['frames']} frames, avg shot {duration/len(cuts):.2f}s")


if __name__ == "__main__":
    main()
