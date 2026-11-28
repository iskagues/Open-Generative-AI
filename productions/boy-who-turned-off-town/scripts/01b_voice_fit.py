"""Step 1b - pick the best expressive take per line and fit it to the picture.

The picture is cut to the phrase timing in build/phrases_kokoro.json (the
original narration). Each new take keeps its line's start time; it may run
into part of the pause after it, and is gently time-stretched (pitch and
formants preserved) only when it would not fit. Takes are scored on
intelligibility (faster-whisper vs. the script) and how little stretch they need.

Outputs (build/): voice.wav, phrases.json, words.json (re-aligned to the new audio)
"""
import difflib, importlib.util, json, os, subprocess, sys
import numpy as np
import soundfile as sf

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
B = os.path.join(ROOT, "build")
CB = os.path.join(B, "vo_cb")
FIT = os.path.join(B, "vo_fit")
os.makedirs(FIT, exist_ok=True)
SR = 48000

spec = importlib.util.spec_from_file_location("v1", os.path.join(ROOT, "scripts", "01_voice.py"))
v1 = importlib.util.module_from_spec(spec); spec.loader.exec_module(v1)
v1.TMP = FIT                      # align() reads the fitted per-line wavs
GAIN = {p[0]: p[5] for p in v1.P}  # per-line level from the original direction
old = json.load(open(os.path.join(B, "phrases_kokoro.json")))
OLD = old["phrases"]; TOTAL = old["total"]

# clean, broadcast-style voice chain (no pitch shifting: that was the source of the old artefacts)
CLEAN = ("highpass=f=75,lowpass=f=15500,"
         "equalizer=f=220:t=q:w=1.2:g=-1.5,equalizer=f=3200:t=q:w=1.0:g=1.8,"
         "deesser=i=0.35:m=0.5:f=0.5,"
         "acompressor=threshold=-21dB:ratio=2.6:attack=6:release=140:makeup=1.5,"
         "silenceremove=start_periods=1:start_threshold=-48dB,areverse,"
         "silenceremove=start_periods=1:start_threshold=-48dB,areverse")


def ff(inp, out, af):
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", inp, "-af", af,
                    "-ar", str(SR), "-ac", "1", out], check=True)


def loud(a):
    import pyloudnorm as pyln
    return pyln.Meter(SR).integrated_loudness(a) if len(a) > SR * 0.45 else 20 * np.log10(np.sqrt(np.mean(a ** 2)) + 1e-9) - 3


def main():
    from faster_whisper import WhisperModel
    asr = WhisperModel("small.en", device="cpu", compute_type="int8")
    phrases, report = [], []
    out = np.zeros(int((TOTAL + 1) * SR), np.float32)
    for i, ph in enumerate(OLD):
        pid = ph["id"]
        start, old_d = ph["start"], ph["end"] - ph["start"]
        nxt = OLD[i + 1]["start"] if i + 1 < len(OLD) else TOTAL
        gap = nxt - ph["end"]
        room = old_d + min(0.6 * gap, max(0.0, gap - 0.12))   # may borrow part of the pause, never the next line
        best = None
        for n in range(9):
            raw = os.path.join(CB, f"{pid}_{n}.wav")
            if not os.path.exists(raw):
                continue
            cl = os.path.join(FIT, f"{pid}_{n}_clean.wav")
            ff(raw, cl, CLEAN)
            a, _ = sf.read(cl, dtype="float32")
            d = len(a) / SR
            pcm = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", cl, "-ar", "16000", "-f", "f32le", "-"],
                                 capture_output=True, check=True).stdout
            segs, _ = asr.transcribe(np.frombuffer(pcm, np.float32), language="en", beam_size=5)
            hyp = " ".join(v1.norm(w) for w in " ".join(s.text for s in segs).replace("9:17", "nine seventeen").split())
            ref = " ".join(v1.norm(w) for w in ph["text"].split())
            sim = difflib.SequenceMatcher(None, hyp.split(), ref.split()).ratio()
            ratio = d / room if d > room else (d / (old_d * 0.8) if d < old_d * 0.8 else 1.0)
            score = (1 - sim) * 6 + abs(np.log(ratio)) * 2
            if best is None or score < best[0]:
                best = (score, n, cl, d, ratio, sim, hyp)
        if best is None:
            sys.exit(f"no takes for {pid}")
        score, n, cl, d, ratio, sim, hyp = best
        fitted = os.path.join(FIT, pid + ".wav")
        tempo = max(ratio, 1.0)   # only ever speed up to fit; short takes simply leave more pause
        af = f"rubberband=tempo={tempo:.4f}:formant=preserved:pitchq=quality" if tempo > 1.005 else "anull"
        ff(cl, fitted, af)
        a, _ = sf.read(fitted, dtype="float32")
        # level: every line to the same loudness, then the original per-line direction (softened)
        a *= 10 ** ((-20 - loud(a) + 0.6 * GAIN[pid]) / 20)
        f = int(0.008 * SR); a[:f] *= np.linspace(0, 1, f); a[-f:] *= np.linspace(1, 0, f)
        sf.write(fitted, a, SR)
        s0 = int(start * SR); out[s0:s0 + len(a)] += a
        new_d = len(a) / SR
        phrases.append(dict(ph, start=round(start, 3), end=round(start + new_d, 3), take=n))
        report.append(f"{pid} take{n} sim={sim:.2f} {d:5.2f}s -> {new_d:5.2f}s (slot {old_d:.2f}, room {room:.2f}, x{tempo:.2f}) | {hyp}")
    out = out[:int(TOTAL * SR)]
    sf.write(os.path.join(B, "voice.wav"), out, SR, subtype="PCM_24")
    words = v1.align(phrases)
    json.dump(dict(total=TOTAL, phrases=phrases), open(os.path.join(B, "phrases.json"), "w"), indent=1)
    json.dump(words, open(os.path.join(B, "words.json"), "w"), indent=1)
    print("\n".join(report))
    print(f"{len(words)} words, {sum(w['interp'] for w in words)} interpolated")


if __name__ == "__main__":
    main()
