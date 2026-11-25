"""Step 1b - choose the best take of every line, clean it, lay it on a timeline,
and force-align every word (faster-whisper) for captions and cuts.

Take score = intelligibility (ASR vs script) + closeness to the reference pace
(~235 wpm). Voice chain: high-pass, presence EQ, de-esser, compression - dry and
close like the reference (no reverb). If the whole read runs long, every line is
sped up by the same factor (pitch/formants preserved) to land at TARGET seconds.
Outputs (build/): voice.wav, phrases.json, words.json
"""
import difflib, importlib.util, json, os, subprocess, sys
import numpy as np
import soundfile as sf
sys.path.insert(0, os.path.dirname(__file__))
from script import LINES

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
B = os.path.join(ROOT, "build"); VO = os.path.join(B, os.environ.get("VO_DIR", "vo")); FIT = os.path.join(B, os.environ.get("VO_DIR", "vo") + "_fit")
os.makedirs(FIT, exist_ok=True)
SR = 48000
LEAD_IN = 0.06
WPM = float(os.environ.get("WPM", 235))        # target speaking pace (v2 storyteller brief: 165-185)
TARGET_MAX = float(os.environ.get("TARGET_MAX", 62.6))  # cap on total length (v1 matched the 62.4 s reference)

# reuse the word aligner from the first production
spec = importlib.util.spec_from_file_location("v1", os.path.join(ROOT, "..", "boy-who-turned-off-town", "scripts", "01_voice.py"))
v1 = importlib.util.module_from_spec(spec); spec.loader.exec_module(v1)
v1.TMP = FIT

CLEAN = ("highpass=f=80,lowpass=f=15000,equalizer=f=250:t=q:w=1.2:g=-2,equalizer=f=3500:t=q:w=1.0:g=2.5,"
         "deesser=i=0.3:m=0.5:f=0.5,acompressor=threshold=-24dB:ratio=2:attack=8:release=150:makeup=1.5,"
         "silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse")


def ff(inp, out, af):
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", inp, "-af", af, "-ar", str(SR), "-ac", "1", out], check=True)


NUM = {"9": "nine", "10": "ten", "5": "five", "7": "seven", "accept": "except", "hus": "huss", "hush": "huss", "husts": "husses", "hussed": "hussed", "hust": "huss", "hostess": "husses", "hustle": "huss", "tugofwar": "tug"}
def words_of(s):
    return [NUM.get(v1.norm(w), v1.norm(w)) for w in s.replace("-", " ").split() if v1.norm(w)]


def main():
    from faster_whisper import WhisperModel
    import pyloudnorm as pyln
    meter = pyln.Meter(SR)
    asr = WhisperModel("small.en", device="cpu", compute_type="int8")
    picks = []
    for pid, spk, text, cap, ex, cfg, pause in LINES:
        best = None
        for n in range(9):
            raw = os.path.join(VO, f"{pid}_{n}.wav")
            if not os.path.exists(raw):
                continue
            cl = os.path.join(FIT, f"{pid}_{n}_c.wav"); ff(raw, cl, CLEAN)
            a, _ = sf.read(cl, dtype="float32"); d = len(a) / SR
            pcm = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", cl, "-ar", "16000", "-f", "f32le", "-"], capture_output=True, check=True).stdout
            segs, _ = asr.transcribe(np.frombuffer(pcm, np.float32), language="en", beam_size=5, initial_prompt="Huss! Huss! Huss! Everybody husses. Mudville hussed. Squeak. Leo, tug of war, mega spicy chili.")
            hyp = words_of(" ".join(s.text for s in segs)); ref = words_of(text)
            sim = difflib.SequenceMatcher(None, hyp, ref).ratio()
            pace = len(ref) / max(d, 0.3) * 60
            score = (1 - sim) * 8 + abs(np.log(pace / WPM)) * (0.5 if len(ref) > 3 else 0.1)
            if best is None or score < best[0]:
                best = (score, n, cl, d, sim, " ".join(hyp))
        if best is None:
            sys.exit(f"no takes for {pid}")
        picks.append((pid, spk, text, cap, pause) + best[1:])
    total = LEAD_IN + sum(p[7] + p[4] for p in picks)
    speech = sum(p[7] for p in picks); nwords = sum(len(words_of(p[2])) for p in picks)
    speed_len = (total - LEAD_IN - sum(p[4] for p in picks)) / (TARGET_MAX - LEAD_IN - sum(p[4] for p in picks))
    speed_pace = (WPM * speech / 60) / nwords      # raise speech-only pace to WPM
    speed = max(1.0, speed_len, speed_pace)
    print(f"raw read {total:.2f}s -> tempo x{speed:.3f}")
    t, parts, phrases, rep = LEAD_IN, [np.zeros(int(LEAD_IN * SR), np.float32)], [], []
    for pid, spk, text, cap, pause, n, cl, d, sim, hyp in picks:
        out = os.path.join(FIT, pid + ".wav")
        ff(cl, out, f"rubberband=tempo={speed:.4f}:formant=preserved:pitchq=quality" if speed > 1.003 else "anull")
        a, _ = sf.read(out, dtype="float32")
        L = meter.integrated_loudness(a) if len(a) > SR * 0.45 else 20 * np.log10(np.sqrt(np.mean(a ** 2)) + 1e-9) - 3
        a *= 10 ** ((-17 - L) / 20)
        f = int(0.006 * SR); a[:f] *= np.linspace(0, 1, f); a[-f:] *= np.linspace(1, 0, f)
        sf.write(out, a, SR)
        dd = len(a) / SR
        phrases.append(dict(id=pid, speaker=spk, text=text, caption=cap or text, start=round(t, 3), end=round(t + dd, 3), take=n))
        parts += [a, np.zeros(int(pause * SR), np.float32)]
        rep.append(f"{pid} take{n} sim={sim:.2f} {dd:5.2f}s | {hyp}")
        t += dd + pause
    vo = np.concatenate(parts)
    sf.write(os.path.join(B, "voice.wav"), vo, SR, subtype="PCM_24")
    words = v1.align(phrases)
    # whisper sometimes hallucinates on a short isolated clip ("thanks for watching"):
    # re-align such lines on a padded copy (0.6 s silence each side) and keep the better result
    bad = {ph["id"] for ph in phrases if sum(w["interp"] for w in words if w["phrase"] == ph["id"]) > len(ph["caption"].split()) / 3}
    if bad:
        pad = int(0.6 * SR); fixed = []
        for ph in phrases:
            if ph["id"] not in bad: continue
            a, _ = sf.read(os.path.join(FIT, ph["id"] + ".wav"), dtype="float32")
            sf.write(os.path.join(FIT, ph["id"] + "_pad.wav"), np.concatenate([np.zeros(pad, np.float32), a, np.zeros(pad, np.float32)]), SR)
            q = dict(ph, id=ph["id"] + "_pad", start=ph["start"] - 0.6, end=ph["end"] + 0.6)
            ws = v1.align([q])
            if sum(w["interp"] for w in ws) < sum(w["interp"] for w in words if w["phrase"] == ph["id"]):
                for w in ws: w["phrase"] = ph["id"]; w["start"] = max(w["start"], ph["start"]); w["end"] = min(max(w["end"], w["start"] + 0.05), ph["end"])
                words = [w for w in words if w["phrase"] != ph["id"]] + ws
                fixed.append(ph["id"])
        words.sort(key=lambda w: w["start"])
        print("re-aligned:", fixed, "of", sorted(bad))
    json.dump(dict(total=len(vo) / SR, phrases=phrases), open(os.path.join(B, "phrases.json"), "w"), indent=1)
    json.dump(words, open(os.path.join(B, "words.json"), "w"), indent=1)
    print("\n".join(rep))
    nw = len(words); print(f"total {len(vo)/SR:.2f}s, {nw} words, {sum(w['interp'] for w in words)} interpolated, {nw/(len(vo)/SR)*60:.0f} wpm overall")


if __name__ == "__main__":
    main()
