"""Step 3 - sound design + mix.

All effects are synthesised here (numpy): air-blast 'huss' hits, squeaks, mud
splashes, crowd, impacts, whooshes, snores, crickets; the crowd chant layer is
build/crowd_huss.wav (scripts/00_crowd_huss.py). Their timing mirrors the shot animation
(shots.js) through build/timeline.json. The voice sits on top, dry and loud;
the mix is normalised to -14 LUFS with true peak < -1 dBTP.
Outputs (build/): sfx.wav, mix.wav
"""
import json, os
import numpy as np
import soundfile as sf
from scipy import signal

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
B = os.path.join(ROOT, "build")
SR = 48000
tl = json.load(open(os.path.join(B, "timeline.json")))
CUT = {c["name"]: c for c in tl["cuts"]}
EV = tl["events"]
DUR = tl["duration"]
N = int(DUR * SR) + SR
rng = np.random.default_rng(7)
L = np.zeros(N); R = np.zeros(N)


def add(x, t, gain_db=0.0, pan=0.0):
    if t < 0 or t >= DUR:
        return
    i = int(t * SR); x = x[: max(0, N - i)] * 10 ** (gain_db / 20)
    gl, gr = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    L[i:i + len(x)] += x * gl * 1.41; R[i:i + len(x)] += x * gr * 1.41


def env(n, a=0.005, d=0.3):
    t = np.arange(n) / SR
    return np.minimum(1, t / max(a, 1e-4)) * np.exp(-t / d)


def tt(d): return np.arange(int(d * SR)) / SR


def bp(x, lo, hi, order=2):
    sos = signal.butter(order, [lo, hi], "bandpass", fs=SR, output="sos"); return signal.sosfilt(sos, x)


def lp(x, f, order=2):
    sos = signal.butter(order, f, "lowpass", fs=SR, output="sos"); return signal.sosfilt(sos, x)


def hp(x, f, order=2):
    sos = signal.butter(order, f, "highpass", fs=SR, output="sos"); return signal.sosfilt(sos, x)


# ---------------------------------------------------------------- sound makers
def boing(size=1.0, d=0.55):
    """cartoon spring: rising pitch glide + wobble, buzzy (jaw-harp like)"""
    t = tt(d)
    f0 = 140 / size ** 0.5
    f = f0 * (1 + 1.6 * (1 - np.exp(-t * 9))) * (1 + 0.18 * np.exp(-t * 4) * np.sin(2 * np.pi * 15 * t))
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.sign(np.sin(ph)) * 0.35 + np.sin(ph) * 0.6 + 0.25 * np.sin(2 * ph)
    x = lp(x, 2600) * env(len(t), 0.004, d * 0.45)
    return x / np.max(np.abs(x))


def thud(f=70, d=0.35):
    t = tt(d); x = np.sin(2 * np.pi * f * t * (1 + 0.6 * np.exp(-t * 25))) * env(len(t), 0.002, d * 0.3)
    n = lp(rng.standard_normal(len(t)), 900) * env(len(t), 0.001, 0.05)
    x = x + 0.5 * n; return x / np.max(np.abs(x))


def tick(f=2200, d=0.08):
    t = tt(d); x = (np.sin(2 * np.pi * f * t) + 0.5 * bp(rng.standard_normal(len(t)), 1500, 6000)) * env(len(t), 0.0005, 0.015)
    return x / np.max(np.abs(x))


def whoosh(d=0.6, up=True):
    t = tt(d); n = rng.standard_normal(len(t))
    fc = np.linspace(400, 3000, len(t)) if up else np.linspace(3000, 400, len(t))
    y = np.zeros_like(n); blk = 512
    for i in range(0, len(n), blk):
        y[i:i + blk] = bp(n[i:i + blk + 256], max(100, fc[i] * 0.6), min(20000, fc[i] * 1.6))[:len(n[i:i + blk])]
    x = y * np.sin(np.pi * np.clip(t / d, 0, 1)) ** 1.5
    return x / np.max(np.abs(x))


def clang(f=520, d=0.9):
    t = tt(d); x = sum(np.sin(2 * np.pi * f * k * t) * np.exp(-t * (3 + k * 2)) / k for k in (1, 2.76, 5.4, 8.9))
    x += 0.4 * bp(rng.standard_normal(len(t)), 2000, 8000) * env(len(t), 0.0005, 0.02)
    return x / np.max(np.abs(x))


def crash(d=1.4):
    t = tt(d); n = rng.standard_normal(len(t))
    x = lp(n, 3000) * env(len(t), 0.002, 0.35) + 0.8 * thud(48, d)[: len(t)] + 0.4 * clang(310, d)[: len(t)]
    return x / np.max(np.abs(x))


def burp(d=0.75):
    t = tt(d)
    f = 72 + 18 * np.sin(2 * np.pi * 3 * t) + 10 * rng.standard_normal(len(t)).cumsum() / np.sqrt(np.arange(1, len(t) + 1)) * 0
    ph = 2 * np.pi * np.cumsum(f) / SR
    pulses = np.sign(np.sin(ph)) * (0.6 + 0.4 * np.abs(np.sin(ph * 0.5)))
    x = bp(pulses, 150, 1400) + 0.2 * bp(rng.standard_normal(len(t)), 300, 1200)
    x *= np.minimum(1, t / 0.03) * np.exp(-np.maximum(0, t - 0.45) * 12)
    return x / np.max(np.abs(x))


def slap(d=0.18):
    t = tt(d); x = bp(rng.standard_normal(len(t)), 800, 6000) * env(len(t), 0.0005, 0.03) + 0.4 * np.sin(2 * np.pi * 180 * t) * env(len(t), 0.001, 0.04)
    return x / np.max(np.abs(x))


def tweet(d=0.25):
    t = tt(d); f = 3200 + 1400 * np.sin(2 * np.pi * 16 * t)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / d) ** 2
    return x


def beep(f=1000, d=0.18):
    t = tt(d); x = np.sign(np.sin(2 * np.pi * f * t)) * 0.5 * env(len(t), 0.002, 0.2) * (t < d - 0.01)
    return lp(x, 5000)


def crowd(d, energy=1.0, cheer=False):
    """stadium crowd: shaped noise + many short vowel-ish formant bursts"""
    t = tt(d); n = len(t)
    base = bp(rng.standard_normal(n), 250, 3500, 2)
    mod = 0.65 + 0.35 * lp(rng.standard_normal(n), 3)
    x = base * mod * 0.5
    for _ in range(int(d * 60 * energy)):
        s = int(rng.uniform(0, max(1, n - SR // 2))); ln = int(rng.uniform(0.08, 0.35) * SR)
        ln = min(ln, n - s); f0 = rng.uniform(140, 320)
        tv = np.arange(ln) / SR; ph = 2 * np.pi * np.cumsum(f0 * (1 + 0.05 * np.sin(2 * np.pi * 5 * tv))) / SR
        v = np.sign(np.sin(ph)) * np.sin(np.pi * tv / (ln / SR))
        fm = rng.choice([700, 900, 1100, 500])
        x[s:s + ln] += bp(v, fm * 0.7, fm * 1.8) * rng.uniform(0.2, 0.6)
    if cheer:
        x *= np.minimum(1, t / 0.25) * (1 + 0.6 * np.exp(-t * 1.2))
    x = hp(x, 120)
    return x / (np.max(np.abs(x)) + 1e-9)


def crickets(d):
    t = tt(d); x = np.zeros(len(t))
    for k in range(3):
        f = 4200 + k * 350; rate = 2.4 + k * 0.7
        g = (np.sin(2 * np.pi * rate * t + k) > 0.6) * (np.sin(2 * np.pi * 30 * t) > 0)
        x += np.sin(2 * np.pi * f * t) * lp(g.astype(float), 200) * (0.6 + 0.4 * k / 2)
    return x / np.max(np.abs(x))


def party(d):
    """muffled music through walls from the roof party (simple 4-on-the-floor + bass)"""
    t = tt(d); x = np.zeros(len(t)); bpm = 124; beat = 60 / bpm
    for i in range(int(d / beat) + 1):
        s = int(i * beat * SR); k = thud(55, 0.25); x[s:s + len(k)] += k[: max(0, len(x) - s)]
        bass = np.sin(2 * np.pi * [55, 55, 65.4, 49][i % 4] * tt(beat * 0.9)) * env(int(beat * 0.9 * SR), 0.01, 0.3)
        s2 = int((i + 0.5) * beat * SR); x[s2:s2 + len(bass)] += 0.5 * bass[: max(0, len(x) - s2)]
    return lp(x, 400) / np.max(np.abs(x))


def amb_day(d):
    t = tt(d); x = lp(rng.standard_normal(len(t)), 600) * 0.3
    for _ in range(int(d / 2.5)):  # distant birds
        s = int(rng.uniform(0, max(1, len(t) - SR // 3))); b = tweet(0.18) * 0.25; x[s:s + len(b)] += b[: len(x) - s]
    return x


def amb_room(d):
    return lp(rng.standard_normal(int(d * SR)), 300) * 0.15


def huss_hit(size=1.0, d=0.45):
    """air blast: breathy noise burst with a low punch"""
    t = tt(d); n = len(t)
    x = bp(rng.standard_normal(n), 250 / size, 3000, 2) * env(n, 0.004, 0.09 * size)
    x += np.sin(2 * np.pi * (90 / size) * t * (1 - 0.3 * t)) * env(n, 0.002, 0.12 * size) * 0.9
    return x / (np.max(np.abs(x)) + 1e-9)


def squeak(d=0.22):
    """tiny rubber-toy squeak"""
    t = tt(d); f = 1900 + 900 * np.sin(np.pi * t / d) + 60 * np.sin(2 * np.pi * 38 * t)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / d) ** 0.6
    return x + 0.2 * np.sin(2 * np.pi * 2 * np.cumsum(f) / SR) * np.sin(np.pi * t / d)


def splash(d=1.0):
    t = tt(d); n = len(t)
    x = lp(rng.standard_normal(n), 900) * env(n, 0.003, 0.25)
    for _ in range(14):
        s = int(rng.uniform(0.02, 0.6) * SR); ln = int(0.07 * SR); tv = tt(0.07)
        f = rng.uniform(250, 700) * (1 + 1.5 * tv / 0.07)
        x[s:s + ln] += np.sin(2 * np.pi * np.cumsum(f) / SR)[: n - s] * np.sin(np.pi * tv / 0.07)[: n - s] * 0.35
    th = thud(55, 0.3)[:n]; x[:len(th)] += th
    return x / (np.max(np.abs(x)) + 1e-9)


def snore(d):
    t = tt(d); g = np.clip(np.sin(2 * np.pi * t / 1.6), 0, 1) ** 2
    x = bp(rng.standard_normal(len(t)), 80, 700) * g * (1 + 0.5 * np.sin(2 * np.pi * 32 * t))
    return x / (np.max(np.abs(x)) + 1e-9)


def rustle(d):
    t = tt(d); x = hp(rng.standard_normal(len(t)), 2500) * (0.5 + 0.5 * lp(rng.standard_normal(len(t)), 20) * 3) * np.sin(np.pi * t / d)
    return x / (np.max(np.abs(x)) + 1e-9)


def rolling(d):
    t = tt(d); x = lp(rng.standard_normal(len(t)), 220) * (1 + 0.3 * np.sin(2 * np.pi * 3 * t))
    return x / (np.max(np.abs(x)) + 1e-9)


def chant_hit():
    p = os.path.join(B, "crowd_huss.wav")
    if not os.path.exists(p): return None
    a, _ = sf.read(p, dtype="float64"); return a


def add2(x, t, gain_db=0.0):
    if t < 0 or t >= DUR: return
    i = int(t * SR); x = x[: max(0, N - i)] * 10 ** (gain_db / 20)
    L[i:i + len(x)] += x[:, 0]; R[i:i + len(x)] += x[:, 1]


# ---------------------------------------------------------------- placement
def C(name, dt=0.0): return CUT[name]["start"] + dt
def span(name): c = CUT[name]; return c["start"], c["end"] - c["start"]


def hops(name, period, phase, size=1.0, gain=-14, pan=0.0, first=0):
    """one boing per take-off of a hop() loop: take-off when (t+phase) % period == 0"""
    s, d = span(name)
    k = np.ceil((0 + phase) / period); t0 = k * period - phase
    while t0 < d:
        if t0 >= first: add(boing(size), s + t0, gain, pan)
        t0 += period


def sizzle(d):
    t = tt(d); x = hp(rng.standard_normal(len(t)), 2500) * (0.6 + 0.4 * (rng.random(len(t)) < 0.02))
    x += lp(rng.standard_normal(len(t)), 300) * 1.5
    x *= np.minimum(1, t / 0.05) * np.minimum(1, (d - t) / 0.15); return x / (np.max(np.abs(x)) + 1e-9)


def laughs(s, d, gain=-18, lo=150, hi=230):
    for k in np.arange(0, d, 0.16):
        tv = tt(0.13); f0 = rng.uniform(lo, hi); ph = 2 * np.pi * f0 * tv
        v = bp(np.sign(np.sin(ph)) + 0.3 * rng.standard_normal(len(tv)), 600, 1800) * np.sin(np.pi * tv / 0.13)
        add(v / np.max(np.abs(v)), s + k, gain, rng.uniform(-0.3, 0.3))


def refrain(evs, ch, g=-16):
    for i, t0 in enumerate(evs):
        add(huss_hit(rng.uniform(0.9, 1.1)), t0, g, (-0.3, 0.3)[i % 2])
        if ch is not None and i % 2 == 0: add2(ch, t0 - 0.02, g - 5)


def build():
    ch = chant_hit()
    names = [c["name"] for c in tl["cuts"]]
    INT = ("c09_", "c10_", "c11_", "c16_", "c17_", "c18_", "c19_", "c20_", "c21_", "c22_", "c23_", "c24_", "c25_", "c26_")
    STAD = ("c12_", "c13_", "c14_", "c15_", "c27_", "c28_", "c29_", "c30_", "c31_", "c32_", "c33_", "c34_", "c35_", "c36_", "c37_", "c38_", "c39_")
    for n in names:
        s, d = span(n)
        if n.startswith(INT): add(amb_room(d + 0.05), s, -34)
        elif not n.startswith(STAD): add(amb_day(d + 0.05), s, -30)
    refrain(EV["h6a"], ch); refrain(EV["h6b"], ch, -14)
    s, d = span("c05_birds")
    for k in np.arange(0.05, d, 0.22): add(tweet(), s + k, -20, rng.uniform(-0.6, 0.6))
    add(whoosh(0.5), EV["flip"], -14)
    s, d = span("c07_over"); add(whoosh(d), s, -12); add(tick(300, 0.1), s + d - 0.05, -14)
    for t0 in EV["burn"]: add(sizzle(1.2), t0, -15); add(whoosh(0.5), t0, -18)
    s, d = span("c11_alarm")
    for k in np.arange(0.02, d, 0.28): add(beep(3150, 0.14), s + k, -17)
    s, d = span("c10_twice"); add(sizzle(d), s, -24)
    add(tick(900, 0.08), EV["pop"], -12); add(boing(0.5, 0.3), EV["pop"], -20)
    s, d = span("c16_remember"); add(sizzle(d), s, -22)
    add(huss_hit(1.0), EV["gran_huss"], -9); add(beep(1568, 0.15), EV["gran_huss"] + 0.3, -20)
    c0 = C("c12_venue"); c1 = C("c17_train"); add(crowd(c1 - c0 + 0.2, 1.0), c0, -24)
    s, d = span("c13_spoon"); add(beep(1760, 0.3), s + 0.05, -20); add(beep(2349, 0.4), s + 0.2, -22)
    c0 = C("c27_day"); c1 = C("c40_town"); add(crowd(c1 - c0 + 0.2, 0.8), c0, -25)
    s, d = span("c30_sigh"); t = tt(0.7); add(lp(rng.standard_normal(len(t)), 900) * np.sin(np.pi * t / 0.7) ** 2, s + 0.1, -16)
    s, d = span("c31_laugh"); laughs(s, d + 0.3, -15); add(crowd(d, 1.5, True), s, -19)
    t0 = EV["big_huss"]
    add(huss_hit(2.6, 1.2), t0, -3); add(thud(40, 0.9), t0, -5); add(whoosh(1.2), t0 + 0.05, -10); add(crowd(1.6, 2.2, True), t0 + 0.1, -14)
    s, d = span("c34_spin"); t = tt(d + span("c35_cook")[1]); f = 300 + 900 * t / t[-1]
    add(np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.5 * np.minimum(1, t / 0.1) + 0.5 * bp(rng.standard_normal(len(t)), 800, 3000), s, -20)
    s, d = span("c35_cook"); add(sizzle(d), s, -16)
    add(beep(1568, 0.2), EV["ding"], -14); add(beep(2093, 0.5), EV["ding"] + 0.12, -14); add(crowd(1.5, 1.8, True), EV["ding"], -15)
    s, d = span("c37_bite"); add(tick(400, 0.08), s + d * 0.5, -14)
    s, d = span("c38_cry"); add(crowd(d, 1.4, True), s, -18)
    s, d = span("c39_award"); add(crowd(d + 0.6, 2.6, True), s, -11)
    s, d = span("c40_town")
    for k in np.arange(0, d, 0.9): add(huss_hit(0.8), s + k, -20, rng.uniform(-0.5, 0.5))
    add(huss_hit(1.1), C("c41_grandma", 0.2), -10)


def main():
    build()
    sfx = np.stack([L, R], 1)[: int(DUR * SR)]
    sf.write(os.path.join(B, "sfx.wav"), sfx.astype(np.float32), SR)
    v, sr = sf.read(os.path.join(B, "voice.wav"), dtype="float64"); assert sr == SR
    voice = np.zeros(len(sfx)); voice[: min(len(v), len(voice))] = v[: len(voice)]
    # gentle ducking of effects under the voice (voice dominates, like the reference)
    e = np.abs(voice); e = lp(e, 8) ; e = e / (e.max() + 1e-9)
    duck = 10 ** (-8 * np.clip(e * 4, 0, 1) / 20)
    import pyloudnorm as pyln
    meter = pyln.Meter(SR)
    mix = sfx * duck[:, None] * 10 ** (-8 / 20) + voice[:, None] * 1.0   # voice-first balance, like the reference
    # v2: background music supplied by the user (build/music/track.wav), from its start,
    # sitting ~10 LU under the voice, ducked a further ~5 dB while the narrator speaks, faded out at the end
    mp = os.path.join(B, "music", "track.wav")
    if os.path.exists(mp) and os.environ.get("MUSIC", "1") == "1":
        mu, msr = sf.read(mp, dtype="float64"); assert msr == SR
        n = len(mix)
        while len(mu) < n: mu = np.concatenate([mu, mu])
        mu = mu[:n].copy()
        vl = meter.integrated_loudness(np.stack([voice, voice], 1))
        mu *= 10 ** ((vl - 10 - meter.integrated_loudness(mu)) / 20)
        mduck = 10 ** (-5 * np.clip(e * 4, 0, 1) / 20)
        fi, fo = int(0.25 * SR), int(2.2 * SR)
        fade = np.ones(n); fade[:fi] = np.linspace(0, 1, fi); fade[-fo:] = np.linspace(1, 0, fo) ** 1.5
        mix = mix + mu * (mduck * fade)[:, None]
        sf.write(os.path.join(B, "music_bed.wav"), (mu * (mduck * fade)[:, None]).astype(np.float32), SR)
    from scipy.ndimage import maximum_filter1d, uniform_filter1d
    lim = 10 ** (-1.7 / 20)
    for _ in range(6):
        mix *= 10 ** ((-14.0 - meter.integrated_loudness(mix)) / 20)
        up = signal.resample_poly(mix, 4, 1, axis=0)
        pk = signal.resample_poly(np.max(np.abs(up), 1), 1, 4)[: len(mix)]   # true-peak envelope
        pk = np.maximum(pk, np.max(np.abs(mix), 1))
        w = int(0.006 * SR)                                                  # 6 ms look-ahead/hold
        g = np.minimum(1, lim / np.maximum(maximum_filter1d(pk, 2 * w + 1), 1e-9))
        g = uniform_filter1d(np.minimum.reduce([g, np.roll(g, w // 2), np.roll(g, -w // 2)]), w)  # smooth attack
        rel = np.exp(-1 / (0.08 * SR)); out = np.empty_like(g); acc = 1.0
        for k in range(len(g)):
            acc = g[k] if g[k] < acc else g[k] + (acc - g[k]) * rel
            out[k] = acc
        mix *= np.minimum(out, g)[:, None]
    I = meter.integrated_loudness(mix)
    tp = 20 * np.log10(np.max(np.abs(signal.resample_poly(mix, 4, 1, axis=0))))
    sf.write(os.path.join(B, "mix.wav"), mix.astype(np.float32), SR, subtype="PCM_24")
    print(f"mix: {I:.2f} LUFS, true peak {tp:.2f} dBTP, {len(mix)/SR:.2f}s")


if __name__ == "__main__":
    main()
