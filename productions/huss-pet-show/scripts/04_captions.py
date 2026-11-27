"""Step 4 - captions like the reference: one word at a time, white rounded bold
sans (Nunito Black), thin black outline + soft shadow, centred at ~58% height,
no pop animation. Timed from the real word alignment.
Outputs (build/): captions.ass (burned in), captions.srt (per line), word_timing.csv
"""
import json, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
B = os.path.join(ROOT, "build")
words = json.load(open(os.path.join(B, "words.json")))
phrases = json.load(open(os.path.join(B, "phrases.json")))["phrases"]


def ts(t):
    t = max(0, t); return f"{int(t // 3600)}:{int(t % 3600 // 60):02d}:{t % 60:05.2f}"


def srt(t):
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
Style: Word,Nunito XB,104,&H00FFFFFF,&H00FFFFFF,&H00000000,&H78000000,0,0,0,0,100,100,0.5,0,1,3.6,3,5,40,40,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
X, Y = 540, 1115
_tl = json.load(open(os.path.join(B, "timeline.json")))
LOW = [(c["start"], c["end"]) for c in _tl["cuts"] if c["name"] in ("c22_minute",)]  # scoreboard text sits at caption height
items = [dict(w) for w in words]
for i in range(1, len(items)):
    items[i]["start"] = max(items[i]["start"], items[i - 1]["start"] + 0.08)
lines = []
for i, w in enumerate(items):
    nxt = items[i + 1]["start"] if i + 1 < len(items) else w["end"] + 0.6
    end = nxt if nxt - w["end"] < 0.45 else w["end"] + 0.25
    end = max(min(end, nxt), w["start"] + 0.08)
    shown = w['word'].strip('.,:;…"“”') if not w['word'].endswith(('!', '?')) else w['word'].rstrip('.')
    shown = shown.rstrip('.') or w['word']
    lines.append(f"Dialogue: 0,{ts(w['start'])},{ts(end)},Word,,0,0,0,,{{\\an5\\pos({X},{1330 if any(a <= w['start'] < b for a, b in LOW) else Y})\\blur0.6}}{shown}")
open(os.path.join(B, "captions.ass"), "w").write(head + "\n".join(lines) + "\n")
with open(os.path.join(B, "captions.srt"), "w") as f:
    for i, p in enumerate(phrases, 1):
        f.write(f"{i}\n{srt(p['start'])} --> {srt(p['end'] + 0.15)}\n{p['caption']}\n\n")
with open(os.path.join(B, "word_timing.csv"), "w") as f:
    f.write("index,word,start_s,end_s,line\n")
    for i, w in enumerate(items):
        f.write(f"{i},{w['word'].replace(',', '')},{w['start']:.3f},{w['end']:.3f},{w['phrase']}\n")
print(len(lines), "caption events")
