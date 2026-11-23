"""Step 2 - derive the edit decision list from the real narration timing.

Every cut and story event is anchored to a spoken word or phrase, so picture,
sound effects and captions all follow the voice. Writes build/timeline.json,
which both the renderer and the audio mixer read.
"""
import json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
B = os.path.join(ROOT, "build")
ph = {p["id"]: p for p in json.load(open(os.path.join(B, "phrases.json")))["phrases"]}
words = json.load(open(os.path.join(B, "words.json")))
total = json.load(open(os.path.join(B, "phrases.json")))["total"]
FPS = 30
TAIL = 1.5


def w(pid, text, nth=0):
    """start time of the nth occurrence of a word inside a phrase"""
    hits = [x for x in words if x["phrase"] == pid and x["word"].strip(".,!?:“”").lower() == text.lower()]
    return hits[nth]["start"]


def S(pid): return ph[pid]["start"]
def E(pid): return ph[pid]["end"]


ev = {}
ev["flicker"] = 1.25
ev["blackout1"] = w("p01", "DARK")
ev["lamps_off"] = w("p02", "streetlights") + 0.15
ev["shops_off"] = w("p02", "shops") + 0.1
ev["statue_cut"] = w("p02", "Even") - 0.05
ev["statue_off"] = w("p02", "statue") + 0.05
ev["morning"] = S("p03") - 0.12
ev["s03"] = S("p04") - 0.3
ev["baker"] = w("p04", "The", 1) - 0.08
ev["s04"] = S("p05") - 0.22
ev["noah_push"] = S("p06") - 0.1
ev["s05"] = S("p07") - 0.15
ev["s06"] = S("p08") - 0.08
ev["playground"] = w("p09", "Past") - 0.06
ev["trees"] = w("p09", "Through") - 0.06
ev["obs_ext"] = w("p09", "Into") - 0.06
ev["s07"] = S("p10") - 0.12
ev["leo_shout"] = S("p11") - 0.08
ev["stop"] = S("p12")
ev["noah_cu"] = S("p13") - 0.18
ev["s08"] = E("p13") + 0.22
ev["click"] = ev["s08"] + 0.42
ev["aerial_dark_cut"] = ev["click"] + 0.2
ev["town_dark"] = ev["aerial_dark_cut"] + 0.18
ev["s09"] = S("p15") - 0.14
ev["point"] = S("p16") - 0.05
ev["s10"] = S("p17") - 0.42
ev["stars"] = S("p17")
ev["comet"] = S("p18")
ev["s11"] = S("p19") - 0.14
ev["note"] = S("p20")
ev["note_read"] = S("p21")
ev["s12"] = S("p22") - 0.16
ev["home"] = S("p23") - 0.12
ev["s13"] = S("p24") - 0.3
ev["leo_soften"] = S("p25")
ev["s14a"] = S("p26") - 0.18
ev["s14b"] = S("p27") - 0.22
ev["end"] = round(total + TAIL, 3)

shots = [
    ("S01", "THE IMPOSSIBLE EVENT", 0.0, ev["lamps_off"] - 0.55),
    ("S02", "THE BLACKOUT MONTAGE", ev["lamps_off"] - 0.55, ev["s03"]),
    ("S03", "THE TOWN IS CONFUSED", ev["s03"], ev["s04"]),
    ("S04", "THE SUSPECT", ev["s04"], ev["s05"]),
    ("S05", "THE MYSTERIOUS WALK", ev["s05"], ev["s06"]),
    ("S06", "THE PURSUIT", ev["s06"], ev["s07"]),
    ("S07", "THE CONFRONTATION", ev["s07"], ev["s08"]),
    ("S08", "THE SWITCH", ev["s08"], ev["s09"]),
    ("S09", "THE MOMENT OF SILENCE", ev["s09"], ev["s10"]),
    ("S10", "THE SKY REVEAL", ev["s10"], ev["s11"]),
    ("S11", "THE DRAWING", ev["s11"], ev["s12"]),
    ("S12", "THE HIDDEN REASON", ev["s12"], ev["s13"]),
    ("S13", "THE REUNION", ev["s13"], ev["s14a"]),
    ("S14", "THE FINAL EMOTIONAL PAYOFF", ev["s14a"], ev["end"]),
]
ev = {k: round(v, 3) for k, v in ev.items()}
out = dict(fps=FPS, duration=ev["end"], frames=int(round(ev["end"] * FPS)), events=ev,
           shots=[dict(id=a, name=b, start=round(c, 3), end=round(d, 3)) for a, b, c, d in shots])
json.dump(out, open(os.path.join(B, "timeline.json"), "w"), indent=1)
for s in out["shots"]:
    print(f'{s["id"]} {s["start"]:6.2f}-{s["end"]:6.2f} ({s["end"]-s["start"]:.2f}s) {s["name"]}')
print("duration", out["duration"], "frames", out["frames"])
