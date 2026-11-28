"""Step 3 - original score, sound design and final mix (all synthesised here).

Reads build/timeline.json, build/walks.json, build/words.json, build/voice.wav.
Writes build/music.wav, build/sfx.wav, build/mix.wav (48 kHz stereo, -14 LUFS, <= -1.5 dBTP).
"""
import json, os, subprocess
import numpy as np
import soundfile as sf
from scipy import signal
import pyloudnorm as pyln

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
B = os.path.join(ROOT, "build")
SR = 48000
tl = json.load(open(os.path.join(B, "timeline.json")))
ev = tl["events"]; DUR = tl["duration"]
walks = json.load(open(os.path.join(B, "walks.json")))
words = json.load(open(os.path.join(B, "words.json")))
N = int(DUR * SR) + SR
rng = np.random.default_rng(7)


def T(sec): return int(sec * SR)
def buf(): return np.zeros((N, 2), np.float32)
def env_adsr(n, a=0.01, d=0.1, s=0.7, r=0.2):
    a, d, r = int(a * SR), int(d * SR), int(r * SR)
    e = np.ones(n) * s
    e[:a] = np.linspace(0, 1, a) if a else 1
    if d: e[a:a + d] = np.linspace(1, s, min(d, max(0, n - a)))[: len(e[a:a + d])]
    if r and n > r: e[-r:] *= np.linspace(1, 0, r)
    return e
def place(dst, x, t, gain=1.0, pan=0.0):
    i = T(t)
    if i >= len(dst): return
    x = x[: len(dst) - i]
    if x.ndim == 1:
        l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        dst[i:i + len(x), 0] += x * gain * l * 1.414
        dst[i:i + len(x), 1] += x * gain * r * 1.414
    else:
        dst[i:i + len(x)] += x * gain
def mtof(m): return 440.0 * 2 ** ((m - 69) / 12)
def bp(x, lo, hi, order=2): return signal.sosfilt(signal.butter(order, [lo, hi], 'band', fs=SR, output='sos'), x)
def lp(x, f, order=2): return signal.sosfilt(signal.butter(order, f, 'low', fs=SR, output='sos'), x)
def hp(x, f, order=2): return signal.sosfilt(signal.butter(order, f, 'high', fs=SR, output='sos'), x)
def noise(n): return rng.standard_normal(n).astype(np.float32)
def fade_window(n, t0, t1, a0, a1):
    g = np.full(n, a0, np.float32)
    i0, i1 = T(t0), T(t1)
    g[i0:i1] = np.linspace(a0, a1, max(1, i1 - i0))[: len(g[i0:i1])]
    g[i1:] = a1
    return g
def automation(points, n=N):
    """points: [(t, gain), ...] linear"""
    ts = np.array([p[0] for p in points]); gs = np.array([p[1] for p in points])
    return np.interp(np.arange(n) / SR, ts, gs).astype(np.float32)


# ------------------------------------------------------------------ instruments
def pluck(f, dur=0.6, bright=1.0):
    n = T(dur); t = np.arange(n) / SR
    x = np.zeros(n)
    for h in range(1, 9):
        x += (1 / h ** 1.3) * np.sin(2 * np.pi * f * h * t) * np.exp(-t * (5 + h * 2.4 / bright))
    x *= np.minimum(1, t / 0.003)
    return (x * 0.5).astype(np.float32)

def piano(f, dur=2.5, vel=1.0):
    n = T(dur); t = np.arange(n) / SR
    x = np.zeros(n)
    B_ = 0.0004
    for h in range(1, 12):
        fh = f * h * np.sqrt(1 + B_ * h * h)
        if fh > 16000: break
        x += (vel ** (0.6 + h * 0.1)) / h ** 1.1 * np.sin(2 * np.pi * fh * t + h) * np.exp(-t * (0.8 + h * 0.55) * (f / 300) ** 0.35)
    x += noise(n) * np.exp(-t * 90) * 0.02 * vel
    x *= np.minimum(1, t / 0.002) * env_adsr(n, 0.002, 0.0, 1.0, 0.25)
    return (x * 0.35).astype(np.float32)

def bell(f, dur=2.0):
    n = T(dur); t = np.arange(n) / SR
    x = sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-t * dcy) for r, a, dcy in [(1, 1, 2.5), (2.76, 0.5, 4), (5.4, 0.25, 7), (8.9, 0.12, 10)])
    return (x * np.minimum(1, t / 0.001) * 0.25).astype(np.float32)

def pad(freqs, dur, att=1.2, rel=1.5, bright=2500, det=0.25):
    n = T(dur); t = np.arange(n) / SR
    L = np.zeros(n); R = np.zeros(n)
    for f in freqs:
        for k, d in enumerate([-det, 0, det]):
            ff = f * 2 ** (d / 12 / 4)
            ph = rng.uniform(0, 6.28)
            saw = signal.sawtooth(2 * np.pi * ff * t + ph) * (1 + 0.2 * np.sin(2 * np.pi * 0.2 * t + k))
            (L if k != 2 else R)[:] += saw
            (R if k != 0 else L)[:] += saw * 0.6
    e = env_adsr(n, att, 0.0, 1.0, rel)
    L = lp(L, bright, 2) * e; R = lp(R, bright, 2) * e
    return (np.stack([L, R], 1) * 0.05 / max(1, len(freqs) ** 0.5)).astype(np.float32)

def strings(freqs, dur, att=1.5, rel=2.0):
    n = T(dur); t = np.arange(n) / SR
    x = np.zeros((n, 2))
    for i, f in enumerate(freqs):
        vib = 1 + 0.004 * np.sin(2 * np.pi * 5.2 * t + i) * np.minimum(1, t / 1.0)
        ph = 2 * np.pi * np.cumsum(f * vib) / SR
        tone = sum(np.sin(ph * h) / h for h in range(1, 7))
        x[:, i % 2] += tone; x[:, (i + 1) % 2] += tone * 0.7
    x = lp(x.T, 3200).T * env_adsr(n, att, 0, 1, rel)[:, None]
    return (x * 0.06 / max(1, len(freqs) ** 0.5)).astype(np.float32)

def bass(f, dur, sat=1.5):
    n = T(dur); t = np.arange(n) / SR
    x = np.sin(2 * np.pi * f * t) + 0.3 * np.sin(4 * np.pi * f * t)
    x = np.tanh(x * sat) * env_adsr(n, 0.01, 0.1, 0.8, 0.08)
    return (x * 0.35).astype(np.float32)

def kick(g=1.0):
    n = T(0.35); t = np.arange(n) / SR
    f = 50 + 90 * np.exp(-t * 30)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9)
    return (x * 0.6 * g).astype(np.float32)

def shaker(g=1.0):
    n = T(0.08); t = np.arange(n) / SR
    return (hp(noise(n), 6000) * np.exp(-t * 60) * 0.12 * g).astype(np.float32)

def snap(g=1.0):
    n = T(0.15); t = np.arange(n) / SR
    x = bp(noise(n), 1200, 5000) * np.exp(-t * 35) + np.sin(2 * np.pi * 220 * t) * np.exp(-t * 40) * 0.3
    return (x * 0.25 * g).astype(np.float32)

def reverb(x, secs=2.5, mix=0.3, damp=4000, pre=0.02):
    n = T(secs); t = np.arange(n) / SR
    irL = noise(n) * np.exp(-t * 6.9 / secs); irR = noise(n) * np.exp(-t * 6.9 / secs)
    irL = lp(irL, damp); irR = lp(irR, damp)
    irL[: T(pre)] = 0; irR[: T(pre)] = 0
    irL /= np.sqrt((irL ** 2).sum()); irR /= np.sqrt((irR ** 2).sum())
    mono = x.mean(1) if x.ndim == 2 else x
    wl = signal.fftconvolve(mono, irL)[: len(mono)]; wr = signal.fftconvolve(mono, irR)[: len(mono)]
    dry = x if x.ndim == 2 else np.stack([x, x], 1)
    return (dry * (1 - mix) + np.stack([wl, wr], 1) * mix * 0.9).astype(np.float32)


# ------------------------------------------------------------------ SCORE
# Key: C major / A minor. The motif: E G A G E D C (a playful "lights on" figure)
MOTIF = [(0, 76, 0.5), (0.5, 79, 0.5), (1.0, 81, 0.5), (1.5, 79, 0.5), (2.0, 76, 0.75), (2.75, 74, 0.25), (3.0, 72, 1.0)]
def music():
    m = buf()
    bpm = 104; beat = 60 / bpm
    S = {s["id"]: s for s in tl["shots"]}
    # --- 1. OPENING (0 -> blackout1): plucky motif + light groove
    t0 = 0.15
    chords = [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]]
    def groove(start, end, motif=True, gain=1.0, minor=False):
        k = 0; t = start
        while t < end - 0.05:
            bar = k // 4; ch = chords[bar % 4] if not minor else [[57, 60, 64], [53, 57, 60], [50, 53, 57], [52, 56, 59]][bar % 4]
            if k % 4 == 0: place(m, bass(mtof(ch[0] - 24), beat * 1.8), t, 0.55 * gain)
            place(m, kick(0.8 if k % 2 == 0 else 0.0), t, gain)
            place(m, shaker(), t + beat / 2, 0.8 * gain, 0.3)
            if k % 2 == 1: place(m, snap(0.8), t, gain, -0.2)
            # arpeggio 8ths
            for j in range(2):
                note = ch[(k * 2 + j) % 3] + 12
                place(m, pluck(mtof(note), 0.4), t + j * beat / 2, 0.22 * gain, (j - 0.5) * 0.5)
            k += 1; t += beat
        if motif:
            for (o, n_, d) in MOTIF:
                if start + 0.4 + o * beat < end - 0.1:
                    place(m, pluck(mtof(n_ + (-3 if minor else 0)), d * beat + 0.4, 1.4), start + 0.4 + o * beat, 0.42 * gain, 0.1)
    groove(t0, ev["blackout1"] - 0.02)
    # blackout: hard stop. Montage restarts the groove, with "power-down" gaps at each switch-off
    groove(S["S02"]["start"] + 0.05, ev["morning"] - 0.05, motif=True, gain=0.85)
    # morning: brighter, motif an octave up with bells
    groove(ev["morning"], ev["s04"], motif=False, gain=0.9)
    for (o, n_, d) in MOTIF:
        place(m, bell(mtof(n_ + 12), 1.4), ev["morning"] + 0.05 + o * beat * 0.75, 0.25)
    # --- 2. SUSPECT -> minor, sneaky pizzicato
    t = ev["s04"]; k = 0
    while t < ev["s05"]:
        n_ = [57, 60, 64, 63, 62, 60, 59, 57][k % 8]
        place(m, pluck(mtof(n_), 0.25, 0.6), t, 0.32, (k % 2 - 0.5) * 0.6)
        t += beat / 2; k += 1
    place(m, pad([mtof(45), mtof(52), mtof(57)], ev["s05"] - ev["s04"] + 1, att=1.0, bright=900), ev["s04"], 0.6)
    # --- 3. MYSTERY / PURSUIT: low pulse, rising
    start, end = ev["s05"], ev["s07"]
    t = start; k = 0
    while t < end:
        prog = (t - start) / (end - start)
        root = [45, 45, 41, 43][int((t - start) / (beat * 4)) % 4]
        place(m, bass(mtof(root - 12), beat / 2 * 0.9, 2.0), t, 0.42 + 0.15 * prog)
        if k % 4 == 2: place(m, pluck(mtof(root + 24 + (7 if k % 8 == 2 else 3)), 0.5, 0.7), t, 0.18)
        if t > ev["s06"]: place(m, shaker(0.7), t + beat / 4, 0.7, 0.4)
        if t > ev["s06"] and k % 2 == 0: place(m, kick(0.6), t, 0.8)
        t += beat / 2 * (1 if t < ev["s06"] else 0.85); k += 1
    place(m, pad([mtof(45), mtof(52), mtof(60)], end - start + 0.5, att=2.0, bright=700), start, 0.8)
    # --- 4. CONFRONTATION: thin drone + heartbeat, cut to silence before the click
    c0, c1 = ev["s07"], ev["click"] - 0.25
    place(m, pad([mtof(40), mtof(47)], c1 - c0 + 0.3, att=0.3, rel=0.25, bright=500), c0, 0.9)
    hb = c0 + 0.1
    while hb < c1 - 0.3:
        place(m, kick(0.5), hb, 0.7); place(m, kick(0.35), hb + 0.22, 0.6); hb += 0.85
    # --- 5. AFTER THE CLICK: a low swell as the town goes dark
    place(m, pad([mtof(33), mtof(40), mtof(45)], ev["s10"] - ev["town_dark"] + 1.0, att=1.4, rel=1.2, bright=420), ev["town_dark"], 0.85)
    # --- 6. REVEAL: warm piano + spacious pad + strings, motif slowed down in major
    r0 = ev["s10"]
    place(m, pad([mtof(48), mtof(55), mtof(64), mtof(67)], 17.5, att=2.5, rel=3.0, bright=2200), r0 - 0.4, 0.9)
    place(m, strings([mtof(60), mtof(64), mtof(67)], 8, att=2.0, rel=2.5), ev["comet"] - 0.4, 0.8)
    slow = 0.82
    for (o, n_, d) in MOTIF:
        place(m, piano(mtof(n_ - 12), 3.0, 0.8), ev["stars"] + 0.2 + o * slow, 0.55, 0.1)
    for i, ch in enumerate([[48, 55, 64], [45, 52, 60], [41, 48, 57], [43, 50, 59]]):
        for j, n_ in enumerate(ch):
            place(m, piano(mtof(n_), 3.2, 0.5), ev["comet"] + i * 1.65 + j * 0.06, 0.35, -0.3 + j * 0.3)
    # --- 7. DRAWING + MEMORY: gentle piano, music box in the hospital
    d0 = ev["s11"]
    for i, ch in enumerate([[45, 52, 60], [41, 48, 57], [48, 55, 64], [43, 50, 59]]):
        for j, n_ in enumerate(ch):
            place(m, piano(mtof(n_), 3.0, 0.45), d0 + 0.2 + i * 1.55 + j * 0.09, 0.32, -0.3 + j * 0.3)
    for (o, n_, d) in MOTIF:
        place(m, bell(mtof(n_ + 12), 1.8), ev["s12"] + 0.15 + o * 0.55, 0.22, 0.2)
    place(m, pad([mtof(53), mtof(57), mtof(60), mtof(64)], ev["s13"] - ev["s12"] + 1, att=0.8, rel=1.2, bright=1800), ev["s12"], 0.7)
    # --- 8. ENDING: resolution with the motif, strings swell, final chord rings out
    e0 = ev["s13"]
    place(m, strings([mtof(48), mtof(55), mtof(60), mtof(64)], DUR - e0 + 0.5, att=2.5, rel=3.5), e0, 1.0)
    for i, ch in enumerate([[41, 48, 57, 64], [43, 50, 59, 62], [45, 52, 60, 64], [41, 48, 57, 60], [43, 50, 55, 62]]):
        for j, n_ in enumerate(ch):
            place(m, piano(mtof(n_), 3.2, 0.45), e0 + 0.1 + i * 1.3 + j * 0.07, 0.3, -0.35 + j * 0.23)
    for (o, n_, d) in MOTIF:
        place(m, piano(mtof(n_), 3.5, 0.6), ev["s14a"] + 0.2 + o * 0.9, 0.42, 0.15)
    for j, n_ in enumerate([36, 48, 55, 60, 64, 67, 72]):
        place(m, piano(mtof(n_), 6.0, 0.55), ev["s14b"] + 2.2 + j * 0.05, 0.3, -0.4 + j * 0.13)
    place(m, pad([mtof(48), mtof(55), mtof(60), mtof(64), mtof(71)], DUR - ev["s14b"] + 1, att=1.5, rel=2.5, bright=2600), ev["s14b"], 0.8)
    m = reverb(m, 2.8, 0.28)
    # global fade at the very end
    g = automation([(0, 1), (DUR - 1.2, 1), (DUR, 0)])
    return m * g[:, None]


# ------------------------------------------------------------------ SOUND DESIGN
def sfx():
    s = buf()
    S = {x["id"]: x for x in tl["shots"]}
    nt = np.arange(N) / SR
    # town power level over time (for electric hum)
    power = automation([(0, 1), (ev["blackout1"], 1), (ev["blackout1"] + 0.15, 0), (S["S02"]["start"], 0.9), (ev["shops_off"], 0.6),
                        (ev["statue_off"] + 0.5, 0.2), (ev["morning"], 0.0), (ev["s05"], 0.0), (ev["s05"] + 0.01, 0.7), (ev["s07"], 0.7),
                        (ev["s07"] + 0.01, 0.35), (ev["click"], 0.35), (ev["aerial_dark_cut"], 0.8), (ev["town_dark"], 0.8), (ev["town_dark"] + 0.4, 0), (DUR, 0)])
    hum = sum(np.sin(2 * np.pi * f * nt) * a for f, a in [(60, 1), (120, 0.6), (180, 0.3), (240, 0.15)])
    s += (hum * power * 0.012)[:, None].astype(np.float32)
    # night ambience: soft wind bed + crickets; day: birds-ish chirps + brighter bed
    night = automation([(0, 1), (ev["morning"] - 0.05, 1), (ev["morning"], 0), (ev["s05"], 0), (ev["s05"] + 0.05, 1), (ev["s12"], 1), (ev["s12"] + 0.05, 0.25), (ev["s13"], 0.25), (ev["s13"] + 0.05, 1), (DUR, 1)])
    bed = lp(noise(N), 700) * 0.035
    wind = bp(noise(N), 250, 1400) * (0.5 + 0.5 * np.sin(2 * np.pi * 0.11 * nt) * np.sin(2 * np.pi * 0.037 * nt + 1)) * 0.03
    windgain = automation([(0, 0.3), (ev["s05"], 0.3), (ev["s05"] + 0.1, 1.0), (ev["s07"], 1.0), (ev["s07"] + 0.05, 0.25), (ev["town_dark"] + 0.3, 0.25), (ev["town_dark"] + 1.5, 1.2), (DUR, 1.0)])
    s[:, 0] += (bed + wind * windgain) * night; s[:, 1] += (np.roll(bed, 997) + np.roll(wind, 2311) * windgain) * night
    crick = np.zeros(N)
    for i in range(int(DUR * 3)):
        t0 = rng.uniform(0, DUR); n = T(0.35); tt = np.arange(n) / SR
        c = np.sin(2 * np.pi * (4300 + rng.uniform(-300, 300)) * tt) * (np.sin(2 * np.pi * 30 * tt) > 0.3) * np.hanning(n)
        crick[T(t0):T(t0) + n] += c[: max(0, min(n, N - T(t0)))] * rng.uniform(0.3, 1)
    crickgain = automation([(0, 0.25), (ev["blackout1"], 0.25), (ev["blackout1"] + 1, 0.6), (ev["morning"], 0.6)] + [(ev["morning"] + 0.01, 0), (ev["s05"], 0), (ev["s05"] + 0.01, 0.6), (ev["s07"], 0.6), (ev["s07"] + 0.01, 0.15), (ev["town_dark"], 0.15), (ev["town_dark"] + 2, 0.9), (DUR, 0.8)])
    s[:, 0] += crick * crickgain * night * 0.012; s[:, 1] += np.roll(crick, 4800) * crickgain * night * 0.012
    # day birds
    for i in range(14):
        t0 = rng.uniform(ev["morning"], ev["s05"] - 0.5); n = T(0.18); tt = np.arange(n) / SR
        f = 2600 + 1400 * np.sin(2 * np.pi * 9 * tt)
        place(s, (np.sin(2 * np.pi * np.cumsum(f) / SR) * np.hanning(n) * 0.04).astype(np.float32), t0, 1, rng.uniform(-0.7, 0.7))
    # distant crowd chatter (babble) where townsfolk are on screen
    def babble(dur, level):
        n = T(dur); x = np.zeros(n)
        for k in range(10):
            car = noise(n)
            syl = (np.sin(2 * np.pi * rng.uniform(3, 5.5) * np.arange(n) / SR + rng.uniform(0, 6)) > rng.uniform(-0.2, 0.4)).astype(float)
            syl = lp(syl, 12)
            f1 = rng.uniform(400, 900)
            x += bp(car, f1, f1 * 2.4) * syl
        return (lp(x, 3000) * level).astype(np.float32)
    place(s, babble(ev["blackout1"] + 0.3, 0.006), 0.0, 1, -0.2)
    place(s, babble(ev["s05"] - ev["morning"], 0.012), ev["morning"], 1, 0.15)
    place(s, babble(ev["s14b"] - ev["s14a"], 0.0025), ev["s14a"], 1, 0)  # hushed murmur
    # crowd "ohh" at the first blackout
    place(s, babble(1.4, 0.012) * np.linspace(1, 0, T(1.4)).astype(np.float32), ev["blackout1"] + 0.15, 1, 0.1)

    def thump(g=1.0, f0=70):
        n = T(1.2); tt = np.arange(n) / SR
        f = f0 * (1 + 1.5 * np.exp(-tt * 12))
        x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 3.5) + lp(noise(n), 300) * np.exp(-tt * 10) * 0.6
        return (x * 0.55 * g).astype(np.float32)
    def powerdown(dur=0.9, g=1.0):
        n = T(dur); tt = np.arange(n) / SR
        f = 420 * np.exp(-tt * 3.2) + 40
        x = signal.sawtooth(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 3) * 0.15
        return (lp(x, 2500) * g).astype(np.float32)
    def lampclick(g=1.0):
        n = T(0.12); tt = np.arange(n) / SR
        x = bp(noise(n), 2000, 7000) * np.exp(-tt * 140) + np.sin(2 * np.pi * 1800 * tt) * np.exp(-tt * 90) * 0.4
        buzz = signal.square(2 * np.pi * 120 * tt) * np.exp(-tt * 25) * 0.15
        return ((x + buzz) * 0.35 * g).astype(np.float32)
    def whoosh(dur=0.5, g=1.0, up=True):
        n = T(dur); tt = np.arange(n) / SR
        e = np.sin(np.pi * tt / dur) ** 2
        x = noise(n)
        out = np.zeros(n)
        for k in range(8):
            seg = slice(k * n // 8, (k + 1) * n // 8)
            fc = 400 + (2500 if up else 2500 * (1 - k / 8)) * (k / 8 if up else 1)
            out[seg] = bp(x, fc * 0.6, fc * 1.6)[seg]
        return (out * e * 0.1 * g).astype(np.float32)
    # ---- event sounds
    place(s, thump(1.0), ev["blackout1"]); place(s, powerdown(1.0), ev["blackout1"], 0.8)
    for i, dt in enumerate([0, 0.17, 0.33, 0.5]): place(s, lampclick(0.8 if i < 3 else 0.5), ev["lamps_off"] + dt, 1, -0.4 + i * 0.25)
    place(s, powerdown(0.6, 0.5), ev["shops_off"]); place(s, lampclick(0.8), ev["shops_off"], 1, 0.2)
    for i in range(8): place(s, lampclick(0.5), ev["statue_off"] + i * 0.055, 1, -0.6 + i * 0.17)
    place(s, powerdown(0.7, 0.6), ev["statue_off"] + 0.5); place(s, thump(0.4, 90), ev["statue_off"] + 0.5)
    place(s, whoosh(0.45, 0.8), ev["morning"] - 0.25)
    for t0 in [S["S06"]["start"], ev["playground"], ev["trees"], ev["obs_ext"]]: place(s, whoosh(0.35, 0.6), t0 - 0.17, 1, 0)
    # door creak
    n = T(0.9); tt = np.arange(n) / SR
    f = 160 + 90 * np.sin(2 * np.pi * 1.3 * tt) + rng.normal(0, 8, n).cumsum() * 0.02
    creak = signal.sawtooth(2 * np.pi * np.cumsum(f) / SR) * (0.5 + 0.5 * (np.sin(2 * np.pi * 23 * tt) > 0)) * np.hanning(n)
    place(s, (bp(creak, 300, 3000) * 0.07).astype(np.float32), ev["obs_ext"] + 0.05, 1, 0.1)
    # tension rise before the switch
    n = T(ev["click"] - ev["leo_shout"]); tt = np.arange(n) / SR
    rise = bp(noise(n), 300, 3000) * (tt / tt[-1]) ** 2 * 0.05 + np.sin(2 * np.pi * np.cumsum(220 * (1 + tt / tt[-1])) / SR) * (tt / tt[-1]) ** 3 * 0.04
    rise[-T(0.05):] *= np.linspace(1, 0, T(0.05))
    place(s, rise.astype(np.float32), ev["leo_shout"])
    # THE CLICK: metallic snap + resonant ping + low thunk + spark crackle
    n = T(0.6); tt = np.arange(n) / SR
    click = hp(noise(n), 2500) * np.exp(-tt * 300) * 1.2 + np.sin(2 * np.pi * 3100 * tt) * np.exp(-tt * 45) * 0.35 + np.sin(2 * np.pi * 95 * tt) * np.exp(-tt * 22) * 0.9
    place(s, (click * 0.6).astype(np.float32), ev["click"])
    crackle = np.zeros(T(0.4))
    for i in range(40): j = rng.integers(0, len(crackle) - 200); crackle[j:j + 200] += hp(noise(200), 3000) * np.exp(-np.arange(200) / 30) * rng.uniform(0.2, 1)
    place(s, (crackle * 0.15).astype(np.float32), ev["click"] + 0.01, 1, 0.2)
    place(s, powerdown(1.4, 1.0), ev["town_dark"]); place(s, thump(1.1, 55), ev["town_dark"])
    # comet shimmer: sparkling chimes + reverse swell
    n = T(1.6); tt = np.arange(n) / SR
    swell = bp(noise(n), 2000, 9000) * (tt / tt[-1]) ** 3 * 0.05
    place(s, swell.astype(np.float32), ev["comet"] - 1.5)
    for i in range(26):
        t0 = ev["stars"] - 0.2 + rng.uniform(0, 4.5)
        place(s, bell(rng.choice([2093, 2349, 2637, 3136, 3520, 4186]), 1.6) * 0.18, t0, 1, rng.uniform(-0.8, 0.8))
    # memory transition: soft chime + whoosh in, whoosh out
    place(s, bell(1568, 2.5) * 0.4, ev["s12"], 1, 0); place(s, whoosh(0.6, 0.5), ev["s12"] - 0.3)
    place(s, whoosh(0.5, 0.4, up=False), ev["s13"] - 0.3)
    # footsteps from the renderer's walk windows
    surf = {"noahHill": "grass", "leoFriday": "pave", "leoSneak": "grass", "leoTrees": "leaves", "noahDoor": "stone", "home": "pave"}
    for name, (a, b, rate) in walks.items():
        k = 1; t = a + 0.5 / rate
        while t < b:
            n = T(0.12); tt = np.arange(n) / SR
            kind = surf[name]
            if kind == "pave": x = bp(noise(n), 800, 5000) * np.exp(-tt * 70) * 0.6 + np.sin(2 * np.pi * 110 * tt) * np.exp(-tt * 50) * 0.5
            elif kind == "stone": x = bp(noise(n), 1000, 6000) * np.exp(-tt * 90) * 0.7 + np.sin(2 * np.pi * 140 * tt) * np.exp(-tt * 60) * 0.4
            elif kind == "leaves": x = bp(noise(n), 1500, 8000) * np.exp(-tt * 25) * 0.6 + np.sin(2 * np.pi * 90 * tt) * np.exp(-tt * 45) * 0.3
            else: x = bp(noise(n), 400, 3000) * np.exp(-tt * 40) * 0.55 + np.sin(2 * np.pi * 80 * tt) * np.exp(-tt * 45) * 0.35
            g = (0.12 if name != "leoSneak" else 0.07) * rng.uniform(0.8, 1.1)
            place(s, x.astype(np.float32), t, g, 0.15 if k % 2 else -0.15)
            t += 1 / rate; k += 1
    # swings creak lightly in the playground
    for i in range(2):
        n = T(0.5); tt = np.arange(n) / SR
        cr = bp(signal.sawtooth(2 * np.pi * (600 + 120 * np.sin(2 * np.pi * 2 * tt)) * tt), 500, 2500) * np.hanning(n) * 0.02
        place(s, cr.astype(np.float32), ev["playground"] + 0.15 + i * 0.6, 1, 0.5)
    # Noah's lantern + room tone in the observatory
    room = automation([(0, 0), (ev["s07"], 0), (ev["s07"] + 0.02, 1), (ev["s10"] + 1.5, 1), (ev["s10"] + 2.0, 0), (ev["s11"], 0), (ev["s11"] + 0.05, 1), (ev["s12"], 1), (ev["s12"] + 0.02, 0)])
    s += (lp(noise(N), 200) * room * 0.03)[:, None].astype(np.float32)
    # hospital: soft room + distant gentle beeps (kept very low, tasteful)
    for i in range(3): place(s, (np.sin(2 * np.pi * 1320 * np.arange(T(0.09)) / SR) * np.hanning(T(0.09)) * 0.012).astype(np.float32), ev["s12"] + 0.6 + i * 1.0, 1, 0.6)
    return reverb(s, 1.2, 0.15, 6000)


# ------------------------------------------------------------------ MIX
def main():
    v, sr = sf.read(os.path.join(B, "voice.wav"), dtype="float32")
    assert sr == SR
    voice = np.zeros(N, np.float32); voice[: len(v)] = v
    # Noah's line is diegetic: give it the observatory's room
    p13 = [w for w in words if w["phrase"] == "p13"]
    a, b = T(p13[0]["start"] - 0.05), T(p13[-1]["end"] + 1.2)
    seg = voice[a:b].copy(); wet = reverb(seg, 0.9, 0.35, 5000)
    voiceS = np.stack([voice, voice], 1)
    voiceS[a:b] = wet
    # gentle voice compression (soft knee) for consistent level
    lvl = np.sqrt(signal.sosfilt(signal.butter(1, 8, 'low', fs=SR, output='sos'), voice ** 2) + 1e-9)
    gr = np.minimum(1, (0.12 / np.maximum(lvl, 1e-4)) ** 0.35)
    voiceS *= gr[:, None]
    voiceS = hp(voiceS.T, 80).T.astype(np.float32)
    mus = music(); fx = sfx()
    sf.write(os.path.join(B, "music.wav"), np.clip(mus * 0.9, -1, 1), SR)
    sf.write(os.path.join(B, "sfx.wav"), np.clip(fx, -1, 1), SR)
    # sidechain ducking: music dips under speech
    venv = signal.sosfilt(signal.butter(1, 3, 'low', fs=SR, output='sos'), np.abs(voice))
    venv = venv / (venv.max() + 1e-9)
    duck = 1 - 0.55 * np.clip(venv * 4, 0, 1)
    meter = pyln.Meter(SR)
    def norm_to(x, lufs):
        l = meter.integrated_loudness(x.astype(np.float64)); return x * 10 ** ((lufs - l) / 20)
    voiceS = norm_to(voiceS, -16.0)
    mus = norm_to(mus, -27.0) * duck[:, None]
    fx = norm_to(fx, -27.5)
    mix = voiceS + mus + fx
    mix = mix[: int(DUR * SR)]
    # final loudness: -14 LUFS integrated, true peak below -1 dBTP.
    # Look-ahead peak limiter (5 ms look-ahead, 120 ms release), iterated with loudness re-targeting.
    lim = 10 ** (-1.6 / 20)
    def limit(x):
        pk = np.abs(signal.resample_poly(x, 4, 1, axis=0)).max(1).reshape(-1, 4).max(1)[: len(x)]
        g = np.minimum(1.0, lim / np.maximum(pk, 1e-9))
        la = T(0.005)
        # running min over the look-ahead window (vectorised via strided max-filter on 1/g)
        from scipy.ndimage import minimum_filter1d
        g = minimum_filter1d(g, size=2 * la + 1, origin=0)
        # smooth: instant attack, exponential release
        rel = np.exp(-1.0 / (0.12 * SR))
        out = np.empty_like(g); cur = 1.0
        for i in range(len(g)):
            cur = g[i] if g[i] < cur else g[i] + (cur - g[i]) * rel
            out[i] = cur
        return x * out[:, None]
    for _ in range(4):
        mix = norm_to(mix, -14.0)
        mix = limit(mix)
    up = signal.resample_poly(mix, 4, 1, axis=0); tp = np.abs(up).max()
    if tp > 10 ** (-1.0 / 20): mix *= 10 ** (-1.2 / 20) / tp
    sf.write(os.path.join(B, "mix.wav"), mix.astype(np.float32), SR, subtype="PCM_24")
    up = signal.resample_poly(mix, 4, 1, axis=0)
    print(f"mix: {meter.integrated_loudness(mix):.2f} LUFS, true peak {20*np.log10(np.abs(up).max()):.2f} dBTP, {len(mix)/SR:.2f}s")


if __name__ == "__main__":
    main()
