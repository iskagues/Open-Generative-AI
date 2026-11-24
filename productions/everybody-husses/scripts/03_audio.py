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
    x += thud(55, 0.3)[:n] if n >= int(0.3 * SR) else 0
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


def build():
    ch = chant_hit()
    town = ["c01_aerial", "c02_street", "c03_grandma", "c04_grandma_huss", "c05_mailman", "c06_mailman_huss", "c07_cat", "c08_cat_huss",
            "c09_except", "c10_try", "c11_squeak", "c54_town_end", "c55_leo_jar", "c56_end1", "c57_end2", "c58_end3"]
    for n in town:
        s, d = span(n); add(amb_day(d + 0.05), s, -30)
    for n in ["c21_poster", "c22_chili", "c23_smoke", "c24_squeak2", "c25_laptop", "c26_laptop_huss", "c28_garage", "c29_rope"]:
        s, d = span(n); add(amb_room(d + 0.05), s, -34)
    for n in ["c27_night_town", "c30_car", "c31_truck", "c32_driver"]:
        s, d = span(n); add(crickets(d + 0.05), s, -32, 0.2)
    # town husses (mirror hussing(): a blast at the start of every 'on' phase)
    s, d = span("c01_aerial")
    for i in range(9): add(huss_hit(rng.uniform(0.8, 1.2)), s + rng.uniform(0, d), -22, rng.uniform(-0.6, 0.6))
    s, d = span("c02_street")
    for i in range(6):
        ph = i * 0.37; t0 = (-ph) % 1.1
        while t0 < d: add(huss_hit(rng.uniform(0.8, 1.1)), s + t0, -19, rng.uniform(-0.5, 0.5)); t0 += 1.1
    for t0, g in zip(EV["huss_small"], [-10, -9, -16]): add(huss_hit(1.0 if g > -12 else 0.6), t0, g)
    add(whoosh(0.5), C("c04_grandma_huss", 0.02), -16); add(tick(1400, 0.1), C("c04_grandma_huss", 0.02), -12)
    add(thud(80, 0.3), C("c06_mailman_huss", 0.0), -12)
    s, d = span("c09_except")
    for i in range(4):
        t0 = (-i * 0.3) % 1.0
        while t0 < d: add(huss_hit(0.9), s + t0, -24, rng.uniform(-0.5, 0.5)); t0 += 1.0
    s, d = span("c10_try"); t = tt(d); add(lp(rng.standard_normal(len(t)), 200) * np.linspace(0.2, 1, len(t)), s, -30)
    for t0 in EV["squeak"]: add(squeak(), t0, -9)
    # flashback tug of war
    p0 = C("c12_pull_wide"); p1 = C("c17_captain")
    add(crowd(p1 - p0 + 0.2, 1.0), p0, -24)
    add(huss_hit(1.3), C("c13_mudville", 0.05), -14)
    add(splash(1.0), EV["splash_old"], -6); add(crowd(1.2, 1.8, True), EV["splash_old"], -18)
    s, d = span("c17_captain"); add(crowd(C("c21_poster") - s, 0.25), s, -32)
    # kitchen / laptop / garage
    s, d = span("c22_chili"); t = tt(d); add(lp(rng.standard_normal(len(t)), 1200) * 0.4, s, -30)
    s, d = span("c23_smoke"); t = tt(d); add(hp(rng.standard_normal(len(t)), 3000) * np.sin(np.pi * t / d), s, -22)
    add(huss_hit(0.7), EV["laptop_huss"], -10); add(bp(huss_hit(0.7), 700, 4000), EV["laptop_huss"], -8)
    add(tick(600, 0.1), C("c28_garage", 0.3), -20); add(tick(500, 0.1), C("c29_rope", 0.2), -20)
    s, d = span("c30_car"); add(rolling(d), s, -22)
    for k in np.arange(0.2, d, 0.45): add(tick(300, 0.12), s + k, -26)
    s, d = span("c31_truck"); add(rolling(d), s, -18)
    s, d = span("c32_driver"); add(rolling(d), s, -24); add(snore(d), s, -17)
    # the Big Pull
    v0 = C("c33_venue"); v1 = DUR
    add(crowd(C("c53_win") - v0 + 0.2, 1.0), v0, -23)
    s, d = span("c34_mud_huss")
    for k in range(5): add(huss_hit(1.4), s + 0.02 + k * 0.05, -11, (k - 2) * 0.2)
    s, d = span("c35_trees"); add(rustle(min(d + 0.6, 3)), s, -16); add(whoosh(1.0), s, -16)
    for t0 in EV["chant"]:
        add(huss_hit(1.5), t0, -10)
        if ch is not None: add2(ch, t0 - 0.02, -13)
        add(crowd(0.5, 1.6, True), t0, -22)
    add(beep(880), C("c37_score10", 0.05), -16)
    s, d = span("c38_shoes"); t = tt(d); add(lp(rng.standard_normal(len(t)), 400) * 0.8, s, -20)
    s, d = span("c40_grab"); add(tick(250, 0.15), s + 0.05, -14)
    s, d = span("c43_laugh")
    for k in np.arange(0, d, 0.16):
        tv = tt(0.13); f0 = rng.uniform(150, 230); ph = 2 * np.pi * f0 * tv
        v = bp(np.sign(np.sin(ph)) + 0.3 * rng.standard_normal(len(tv)), 600, 1800) * np.sin(np.pi * tv / 0.13)
        add(v / np.max(np.abs(v)), s + k, -18, rng.uniform(-0.3, 0.3))
    add(beep(880), C("c44_score5", 0.05), -16)
    s, d = span("c45_flashback"); add(rolling(d), s, -26)
    # THE huss
    t0 = EV["big_huss"]
    add(huss_hit(2.6, 1.2), t0, -3); add(thud(40, 0.9), t0, -5); add(whoosh(1.2), t0 + 0.05, -10)
    add(crowd(1.6, 2.2, True), t0 + 0.1, -14)
    add(slap(), EV["rope_snap"], -6); add(tick(200, 0.2), EV["rope_snap"], -10)
    for w in EV["whoosh"]: add(whoosh(1.0), w, -11)
    add(splash(1.1), EV["splash"], -3); add(thud(45, 0.6), EV["splash"], -6)
    add(crowd(2.5, 2.4, True), EV["splash"] + 0.1, -12)
    s, d = span("c53_win"); add(crowd(d + 0.6, 2.6, True), s, -11)
    # ending: whole town husses
    s, d = span("c54_town_end")
    for i in range(8): add(huss_hit(rng.uniform(0.8, 1.2)), s + rng.uniform(0, d), -20, rng.uniform(-0.6, 0.6))
    add(huss_hit(1.1), C("c55_leo_jar", 0.25), -9); add(whoosh(0.5), C("c55_leo_jar", 0.27), -16)
    for t0 in EV["end_chant"]:
        add(huss_hit(1.6), t0, -9)
        if ch is not None: add2(ch, t0 - 0.02, -12)


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
