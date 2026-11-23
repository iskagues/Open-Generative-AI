"""Step 1 - narration.

Synthesises every phrase separately with Kokoro (neural TTS), applies a
per-phrase performance (speed, gain, pitch), lays the phrases on a timeline
with hand-directed pauses, then force-aligns every word with faster-whisper
so captions and picture can be cut to the real spoken audio.

Outputs (build/):
  voice.wav           48 kHz mono narration, timeline-accurate
  phrases.json        phrase start/end times
  words.json          word-level timing (from the actual generated audio)
"""
import json, os, re, subprocess, sys
import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BUILD = os.path.join(ROOT, "build")
TMP = os.path.join(BUILD, "vo_parts")
os.makedirs(TMP, exist_ok=True)
MODELS = os.path.expanduser("~/models")
SR_OUT = 48000

NARR = "am_michael"   # warm young-adult male narrator (Leo)
NOAH = "am_puck"      # softer, younger timbre for Noah's one line

# id, spoken text, caption text, voice, speed, gain dB, pitch semitones, pause-after s
P = [
 ("p01", "Every night, at exactly nine seventeen, our town square went... dark.",
         "Every night at exactly nine seventeen, our town square went DARK.", NARR, 1.00, 0, 0, 0.85),
 ("p02", "The streetlights. The shops. Even the mayor's ridiculous golden statue.",
         None, NARR, 1.06, 0, 0.3, 0.45),
 ("p03", "And by morning? Everything worked again.", None, NARR, 1.02, 0, 0.2, 0.55),
 ("p04", "The mayor blamed electricians. The baker blamed aliens.", None, NARR, 1.04, 0, 0.3, 0.55),
 ("p05", "I blamed one kid.", None, NARR, 0.88, -0.5, -1.0, 0.40),
 ("p06", "The quiet boy in the green hoodie.", None, NARR, 0.92, -0.5, -0.6, 0.65),
 ("p07", "Every night, I saw him climb the hill, carrying a giant red switch.",
         "Every night, I saw him climb the hill carrying a giant red switch.", NARR, 1.02, 0, 0, 0.45),
 ("p08", "So on Friday, I followed him.", None, NARR, 1.06, 0.5, 0.2, 0.30),
 ("p09", "Past the playground. Through the trees. Into the abandoned observatory.",
         None, NARR, 1.12, 0.5, 0.3, 0.35),
 ("p10", "He reached for the switch.", None, NARR, 1.08, 0.5, 0.3, 0.12),
 ("p11", "I screamed,", None, NARR, 1.10, 0.5, 0.4, 0.06),
 ("p12", "Stop!", "STOP!", NARR, 1.10, 5.0, 1.2, 0.70),
 ("p13", "Please... just one minute.", None, NOAH, 0.84, -5.0, 0.6, 0.35),
 # CLICK + dramatic beat lives in the gap after p13 (see SWITCH_GAP)
 ("p14", "The whole square disappeared into darkness.", None, NARR, 0.96, 0, -0.3, 0.75),
 ("p15", "I was furious...", None, NARR, 1.00, 1.0, 0.2, 0.55),
 ("p16", "Until he pointed upward.", None, NARR, 0.86, -2.0, -0.4, 1.05),
 ("p17", "Thousands of stars.", None, NARR, 0.86, 0, 0.3, 0.65),
 ("p18", "A glowing comet, stretching across the sky.",
         "A glowing comet stretching across the sky.", NARR, 0.88, 0, 0.2, 0.95),
 ("p19", "On his desk lay a crayon drawing of that same comet.", None, NARR, 0.96, -0.5, 0, 0.40),
 ("p20", "Below it, a note:", "Below it, a note:", NARR, 0.96, -0.5, 0, 0.30),
 ("p21", "I want to see the sky sparkle.", "“I want to see the sky sparkle.”", NARR, 0.86, -1.0, 0.4, 0.85),
 ("p22", "His little sister had been in the hospital all week.", None, NARR, 0.92, -1.0, -0.3, 0.40),
 ("p23", "Tonight was her first night home.", None, NARR, 0.90, -1.0, 0, 0.85),
 ("p24", "He wasn't trying to ruin our nights.", None, NARR, 0.92, -1.0, -0.2, 0.30),
 ("p25", "He was giving her one she would never forget.", None, NARR, 0.88, -1.0, 0, 1.00),
 ("p26", "And for the first time...", None, NARR, 0.84, -2.0, -0.3, 0.70),
 ("p27", "Nobody asked him to turn the lights back on.", None, NARR, 0.82, -2.5, -0.4, 0.0),
]
SPEED_SCALE = 1.10    # global tempo trim to land the 68-70 s target
PAUSE_SCALE = 0.62    # global pause trim...
KEEP_PAUSE = {"p01": 0.9, "p13": 0.9, "p16": 0.85, "p25": 0.85, "p26": 0.9}  # ...except key beats
LEAD_IN = 0.30        # silence before first word
SWITCH_GAP = 1.05     # extra beat after "just one minute" for the CLICK


def synth():
    k = Kokoro(os.path.join(MODELS, "kokoro-v1.0.onnx"), os.path.join(MODELS, "voices-v1.0.bin"))
    clips = []
    for pid, text, cap, voice, speed, gain, pitch, pause in P:
        raw = os.path.join(TMP, pid + "_raw.wav")
        out = os.path.join(TMP, pid + ".wav")
        if not os.path.exists(raw):
            audio, sr = k.create(text, voice=voice, speed=round(speed * SPEED_SCALE, 3), lang="en-us")
            sf.write(raw, audio, sr)
        af = []
        if pitch:
            af.append(f"rubberband=pitch={2 ** (pitch / 12):.5f}:formant=preserved")
        af += [f"volume={gain}dB", "silenceremove=start_periods=1:start_threshold=-50dB",
               "areverse", "silenceremove=start_periods=1:start_threshold=-50dB", "areverse",
               f"aresample={SR_OUT}"]
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", raw, "-af", ",".join(af),
                        "-ac", "1", out], check=True)
        a, _ = sf.read(out, dtype="float32")
        # 8 ms fades to avoid clicks
        f = int(0.008 * SR_OUT)
        a[:f] *= np.linspace(0, 1, f); a[-f:] *= np.linspace(1, 0, f)
        clips.append(a)
    return clips


def assemble(clips):
    t = LEAD_IN
    phrases, parts = [], [np.zeros(int(LEAD_IN * SR_OUT), np.float32)]
    for (pid, text, cap, voice, speed, gain, pitch, pause), a in zip(P, clips):
        d = len(a) / SR_OUT
        phrases.append(dict(id=pid, text=text, caption=cap or text, voice=voice,
                            start=round(t, 3), end=round(t + d, 3)))
        parts.append(a)
        gap = pause * KEEP_PAUSE.get(pid, PAUSE_SCALE) + (SWITCH_GAP if pid == "p13" else 0)
        parts.append(np.zeros(int(gap * SR_OUT), np.float32))
        t += d + gap
    vo = np.concatenate(parts)
    sf.write(os.path.join(BUILD, "voice.wav"), vo, SR_OUT, subtype="PCM_24")
    return phrases, len(vo) / SR_OUT


def norm(w):
    return re.sub(r"[^a-z0-9']", "", w.lower().replace("’", "'"))


def align(phrases):
    """Word timing from the real audio: whisper word timestamps per phrase,
    mapped onto the script's own caption words (so spelling is exact)."""
    from faster_whisper import WhisperModel
    m = WhisperModel("small.en", device="cpu", compute_type="int8")
    words = []
    for ph in phrases:
        wav = os.path.join(TMP, ph["id"] + ".wav")
        pcm = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", wav, "-ar", "16000", "-ac", "1",
                              "-f", "f32le", "-"], capture_output=True, check=True).stdout
        audio16 = np.frombuffer(pcm, np.float32)
        segs, _ = m.transcribe(audio16, word_timestamps=True, language="en", beam_size=5,
                               initial_prompt=ph["text"], vad_filter=False)
        hyp = [w for s in segs for w in s.words]
        cap_words = ph["caption"].split()
        # Whisper writes "9:17" etc. - expand to spoken tokens, keep times.
        htoks = []
        for w in hyp:
            t = w.word.strip()
            if re.fullmatch(r"\d+:\d+\.?", t):
                mid = (w.start + w.end) / 2
                htoks += [("nine", w.start, mid), ("seventeen", mid, w.end)]
            else:
                htoks.append((norm(t), w.start, w.end))
        ph["asr"] = " ".join(h[0] for h in htoks)
        # greedy monotonic alignment of caption words to ASR tokens
        res, j = [], 0
        for cw in cap_words:
            n = norm(cw)
            hit = None
            for k in range(j, min(j + 3, len(htoks))):
                if htoks[k][0] == n or (n and htoks[k][0].startswith(n[:4])):
                    hit = k; break
            if hit is None and j < len(htoks) and len(cap_words) == len(htoks):
                hit = j
            if hit is not None:
                res.append([cw, htoks[hit][1], htoks[hit][2]]); j = hit + 1
            else:
                res.append([cw, None, None])
        # fill unmatched words by interpolation inside the phrase
        dur = ph["end"] - ph["start"]
        for i, r in enumerate(res):
            if r[1] is None:
                prev_e = next((res[q][2] for q in range(i - 1, -1, -1) if res[q][2] is not None), 0.0)
                nxt_s = next((res[q][1] for q in range(i + 1, len(res)) if res[q][1] is not None), dur)
                r[1], r[2] = prev_e, max(prev_e + 0.12, (prev_e + nxt_s) / 2)
                r.append("interp")
        for r in res:
            words.append(dict(word=r[0], start=round(ph["start"] + max(0, r[1]), 3),
                              end=round(ph["start"] + min(dur, r[2]), 3), phrase=ph["id"],
                              interp=len(r) > 3))
    return words


if __name__ == "__main__":
    clips = synth()
    phrases, total = assemble(clips)
    words = align(phrases)
    json.dump(dict(total=total, phrases=phrases), open(os.path.join(BUILD, "phrases.json"), "w"), indent=1)
    json.dump(words, open(os.path.join(BUILD, "words.json"), "w"), indent=1)
    print(f"narration length {total:.2f}s, {len(words)} words, "
          f"{sum(w['interp'] for w in words)} interpolated")
    for ph in phrases:
        print(f"{ph['start']:6.2f}-{ph['end']:6.2f} {ph['id']} | {ph['asr']}")
