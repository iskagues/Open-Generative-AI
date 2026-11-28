import sys
p = sys.argv[1] + '/scripts/01b_voice_build.py'; s = open(p).read()
# 1) h6 builder
s = s.replace('def main():', '''HUSS_DIR = os.path.join(ROOT, "..", "_shared", "huss")
BEAT = float(os.environ.get("HUSS_BEAT", 0.40))
_HITS = None
def huss_hits():
    """cleaned single narrator 'Huss!' takes, trimmed, level-matched"""
    global _HITS
    if _HITS is None:
        _HITS = []
        for n in range(12):
            raw = os.path.join(HUSS_DIR, f"huss_{n}.wav")
            if not os.path.exists(raw): continue
            cl = os.path.join(FIT, f"huss_{n}_c.wav"); ff(raw, cl, CLEAN)
            a, _ = sf.read(cl, dtype="float32"); d = len(a) / SR
            if 0.2 < d < 0.75:
                a = a / (np.sqrt(np.mean(a ** 2)) + 1e-9) * 10 ** (-17 / 20)
                f = int(0.01 * SR); a[-f:] *= np.linspace(1, 0, f); _HITS.append(a)
        print("huss hits usable:", len(_HITS))
    return _HITS
def build_h6(pid, seed):
    hits = huss_hits(); r = np.random.default_rng(seed)
    order = r.permutation(len(hits))[:6] if len(hits) >= 6 else [i % len(hits) for i in range(6)]
    n = int((5 * BEAT + 0.8) * SR); out = np.zeros(n, np.float32); ons = []
    for k, i in enumerate(order):
        a = hits[i] * (1.12 if k in (0, 5) else 1.0); o = int(k * BEAT * SR); m = min(len(a), n - o)
        out[o:o + m] += a[:m]; ons.append((k * BEAT, k * BEAT + len(a) / SR))
    end = int(ons[-1][1] * SR) + 1; out = out[:end]
    p = os.path.join(FIT, f"{pid}_h6.wav"); sf.write(p, out, SR)
    return p, len(out) / SR, ons


def main():''')
# 2) in the take loop, h6 lines bypass ASR
s = s.replace('''        best = None
        for n in range(9):''', '''        best = None
        if spk == "h6":
            p6, d6, ons = build_h6(pid, int(pid[1:]))
            H6ONS[pid] = ons
            picks.append((pid, spk, text, cap, pause, 0, p6, d6, 1.0, "huss x6")); continue
        for n in range(9):''')
s = s.replace('    picks = []\n', '    picks = []\n    global H6ONS\n')
s = s.replace('def main():\n    from faster', 'H6ONS = {}\ndef main():\n    from faster')
# 3) h6 loudness: hits already set; skip integrated-loudness renorm for them
s = s.replace('        a *= 10 ** ((-17 - L) / 20)', '        if spk != "h6": a *= 10 ** ((-17 - L) / 20)')
# 4) alignment: only spoken lines; h6 words placed on their onsets
s = s.replace('    words = v1.align(phrases)', '''    words = v1.align([ph for ph in phrases if ph["speaker"] != "h6"])
    for ph in phrases:
        if ph["speaker"] == "h6":
            k = (ph["end"] - ph["start"]) / H6ONS[ph["id"]][-1][1]
            for (a0, a1), w in zip(H6ONS[ph["id"]], ph["caption"].split()):
                words.append(dict(word=w, start=round(ph["start"] + a0 * k, 3), end=round(ph["start"] + a1 * k, 3), phrase=ph["id"], interp=False))
    words.sort(key=lambda w: w["start"])''')
s = s.replace('initial_prompt="Huss! Huss! Huss! Everybody husses. Mudville hussed. Squeak. Leo, tug of war, mega spicy chili."', 'initial_prompt=os.environ.get("ASR_PROMPT", "Huss! Everybody. Leo.")')
open(p, 'w').write(s)
print('patched', p)
