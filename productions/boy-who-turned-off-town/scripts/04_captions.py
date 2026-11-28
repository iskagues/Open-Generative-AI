"""Step 4 - captions from the real word timings.

build/captions.ass  word-by-word animated captions (burned in)
build/captions.srt  phrase-level subtitle file for platforms
build/word_timing.csv  word-level timing data
"""
import json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
B = os.path.join(ROOT, "build")
words = json.load(open(os.path.join(B, "words.json")))
phrases = json.load(open(os.path.join(B, "phrases.json")))["phrases"]
tl = json.load(open(os.path.join(B, "timeline.json")))
ev = tl["events"]

EMPH = {"DARK.": 1.45, "STOP!": 1.6, "stars.": 1.35, "Nobody": 1.3, "CLICK!": 1.5}
CAPS = {"stars.": "STARS.", "Nobody": "NOBODY"}   # shouted / stressed words shown in caps


def ts(t):
    t = max(0, t); h = int(t // 3600); m = int(t % 3600 // 60); s = t % 60
    return f"{h}:{m:02d}:{s:05.2f}"


def srt_ts(t):
    ms = int(round(t * 1000)); h, ms = divmod(ms, 3600000); m, ms = divmod(ms, 60000); s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


head = """[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Word,Anton,128,&H0033E0FF,&H0033E0FF,&H00000000,&H96000000,0,0,0,0,100,100,1,0,1,10,4,5,60,60,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
X, Y = 540, 1335
lines = []
items = [dict(w) for w in words]
# the switch CLICK is a scripted onomatopoeia: caption it on the sound effect
items.append(dict(word="CLICK!", start=ev["click"], end=ev["click"] + 0.55, phrase="sfx"))
items.sort(key=lambda w: w["start"])
# no two caption words on screen at once: each word holds >= 0.1 s, later words wait (<= 0.1 s) if needed
for i in range(1, len(items)):
    items[i]["start"] = max(items[i]["start"], items[i - 1]["start"] + 0.1)
for i, w in enumerate(items):
    nxt = items[i + 1]["start"] if i + 1 < len(items) else w["end"] + 1
    gap = nxt - w["end"]
    end = nxt if gap < 0.6 else w["end"] + 0.3
    end = max(end, w["start"] + 0.1)
    if i + 1 < len(items): end = min(end, items[i + 1]["start"])
    text = CAPS.get(w["word"], w["word"])
    k = EMPH.get(w["word"])
    if k:
        s = int(100 * k)
        anim = (f"\\fscx{int(s*0.75)}\\fscy{int(s*0.75)}\\t(0,90,\\fscx{int(s*1.22)}\\fscy{int(s*1.22)})"
                f"\\t(90,200,\\fscx{s}\\fscy{s})")
        extra = "\\bord12\\shad5"
        if w["word"] == "DARK.":
            extra += "\\1c&H0029C8FF&"
        if w["word"] == "STOP!":
            extra += "\\frz-3"
        if w["word"] == "CLICK!":
            extra += "\\1c&H00FFFFFF&\\frz4"
    else:
        pop = 106 + (i % 3) * 2  # 106/108/110 - avoid an identical, mechanical pop on every word
        anim = f"\\fscx92\\fscy92\\t(0,65,\\fscx{pop}\\fscy{pop})\\t(65,140,\\fscx100\\fscy100)"
        extra = ""
    # S11 note close-up: the note sits in the caption zone for these words, so drop them onto the table below it
    y = 1690 if 47.7 <= w["start"] < 50.1 else Y
    lines.append(f"Dialogue: 0,{ts(w['start'])},{ts(end)},Word,,0,0,0,,{{\\an5\\pos({X},{y}){anim}{extra}}}{text}")
open(os.path.join(B, "captions.ass"), "w").write(head + "\n".join(lines) + "\n")

with open(os.path.join(B, "captions.srt"), "w") as f:
    for i, p in enumerate(phrases, 1):
        f.write(f"{i}\n{srt_ts(p['start'])} --> {srt_ts(p['end'] + 0.2)}\n{p['caption']}\n\n")
with open(os.path.join(B, "word_timing.csv"), "w") as f:
    f.write("index,word,start_s,end_s,phrase\n")
    for i, w in enumerate(items):
        f.write(f"{i},{w['word'].replace(',', '')},{w['start']:.3f},{w['end']:.3f},{w['phrase']}\n")
print(len(lines), "caption events")
