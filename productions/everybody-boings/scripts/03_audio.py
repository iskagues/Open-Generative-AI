"""Step 3 - sound design + mix (no music bed, like the reference).

All sounds are synthesised here (numpy): spring 'boings', crowd, impacts,
whooshes, burp, crickets, etc. Their timing mirrors the shot animation
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
    # ambiences per scene
    day = ["c01_aerial", "c02_street", "c03_milo_flat", "c04_milo_high", "c05_fence", "c06_mailman", "c07_morning", "c08_try", "c09_gone_face",
           "c22_tramp", "c23_launch", "c24_mailbox", "c25_cat", "c26_milo_sad", "c36_mailman_walk", "c37_mailman_happy", "c58_hat_town"]
    for n in day:
        s, d = span(n); add(amb_day(d + 0.05), s, -30)
    for n in ["c10_doctor_wide", "c11_knee", "c12_nothing", "c13_doctor_serious", "c14_milo_shock", "c15_clip", "c16_poster", "c17_determined",
              "c18_cans", "c19_burp", "c20_springs", "c21_ceiling", "c30_window", "c32_garage", "c33_squat_close", "c34_squat_wide"]:
        s, d = span(n); add(amb_room(d + 0.05), s, -34)
    for n in ["c35_moon", "c60_night_town", "c62_ref_curb", "c63_ref_search", "c31_roofparty"]:
        s, d = span(n); add(crickets(d + 0.05), s, -32, 0.2)
    # party music: loud on the roof, muffled behind the window/garage
    s, d = span("c27_zoe_roof"); add(party(d), s, -32)
    for n, g in [("c28_zoe_close", -26), ("c29_zoe_smug", -26), ("c31_roofparty", -22), ("c32_garage", -36), ("c61_rooftop", -24)]:
        s, d = span(n); add(party(d), s, g)
    # --- boings (mirror shots.js hop parameters where it matters)
    s, d = span("c01_aerial")
    for i in range(10): add(boing(rng.uniform(0.7, 1.3)), s + rng.uniform(0, d), -22, rng.uniform(-0.6, 0.6))
    s, d = span("c02_street")
    for per, ph, pan in [(1.0, 0.2, -0.4), (1.0, 0.65, 0.3), (1.2, 0.1, 0), (0.9, 0.4, 0.5)]:
        hops("c02_street", per, ph, rng.uniform(0.8, 1.2), -20, pan)
    hops("c03_milo_flat", 1.0, 0.1, 1.0, -24, -0.4); hops("c03_milo_flat", 1.2, 0.6, 0.9, -24, 0.4)
    add(boing(1.4, 0.9), C("c04_milo_high"), -12)
    add(boing(1.0), C("c05_fence", 0.05), -13); add(boing(1.0), C("c06_mailman", 0.02), -13)
    hops("c07_morning", 0.9, 0, 1.0, -14)
    # the failed boing: a sad, short, flat "bo-" + creak
    s, d = span("c08_try")
    for k in range(int(d / (1 / 4.5))):
        tq = s + 0.15 + k / 4.5
        x = boing(1.8, 0.18) * np.linspace(1, 0.2, int(0.18 * SR)); add(x, tq, -22)
    add(tick(1800), EV["knee_tap"], -12)
    add(burp(), EV["burp"], -7)
    s, d = span("c20_springs")
    for k in np.arange(0, d, 0.6): add(boing(0.6, 0.4), s + k, -14)
    add(thud(60, 0.5), C("c21_ceiling"), -8); add(crash(0.8), C("c21_ceiling"), -16)
    hops("c22_tramp", 0.8, 0, 0.9, -14)
    add(boing(1.5, 0.8), C("c23_launch"), -9); add(whoosh(0.8), C("c23_launch", 0.1), -16)
    add(clang(480, 1.0), EV["mailbox_hit"], -10); add(thud(90, 0.3), EV["mailbox_hit"], -10)
    add(boing(0.55, 0.5), C("c25_cat"), -14)
    add(thud(140, 0.25), EV["window_shut"], -8); add(tick(900, 0.1), EV["window_shut"], -14)
    s, d = span("c31_roofparty")
    for k in np.arange(0, d, 0.9): add(boing(rng.uniform(0.8, 1.2)), s + k, -24, rng.uniform(-0.5, 0.5))
    # garage: squat creaks
    for n, rate in [("c32_garage", 0.6), ("c33_squat_close", 1.3), ("c34_squat_wide", 1.5)]:
        s, d = span(n)
        for k in np.arange(0.25 / rate, d, 1 / rate): add(tick(300, 0.12), s + k, -26)
    # race
    race0 = C("c38_venue")
    race_end = C("c60_night_town")
    add(crowd(race_end - race0 + 0.2, 1.0), race0, -24)
    s, d = span("c39_rivals_jump")
    for k in np.arange(0, d, 1.2 / 5): add(boing(rng.uniform(0.9, 1.1)), s + k, -16, rng.uniform(0, 0.5))
    s, d = span("c40_airplane"); t = tt(d); add(lp(np.sin(2 * np.pi * 85 * t) + 0.5 * rng.standard_normal(len(t)), 500) * np.sin(np.pi * t / d), s, -18)
    s, d = span("c41_chant")
    for k in np.arange(0, d, 0.48): add(boing(1.0, 0.4), s + k, -18)
    add(crowd(d, 1.6, True), s, -20)
    add(beep(880), C("c42_score10", 0.05), -16)
    for k in range(5): add(beep(880, 0.12), C("c49_score5", 0.05 + k * 0.0), -16) if k == 0 else None
    # laughter: bursts of "ha" formants
    s, d = span("c48_laugh")
    for k in np.arange(0, d, 0.16):
        tv = tt(0.13); f0 = rng.uniform(170, 260); ph = 2 * np.pi * f0 * tv
        v = bp(np.sign(np.sin(ph)) + 0.3 * rng.standard_normal(len(tv)), 600, 1800) * np.sin(np.pi * tv / 0.13)
        add(v / np.max(np.abs(v)), s + k, -18, rng.uniform(-0.3, 0.3))
    # THE boing
    add(boing(2.4, 1.6), EV["launch"], -4); add(whoosh(1.0), EV["launch"], -10); add(thud(45, 0.6), EV["launch"], -8)
    add(crowd(1.5, 2.0, True), EV["launch"], -14)
    s, d = span("c53_sky"); add(whoosh(d + 0.1), s, -16)
    add(slap(), EV["highfive"], -6); add(tweet(0.3), EV["highfive"] + 0.1, -12)
    add(thud(40, 0.9), EV["land_hit"], -3); add(crash(1.0), EV["land_hit"], -14)
    add(crowd(3.0, 2.4, True), EV["land_hit"], -12)
    add(crash(1.6), EV["board_fall"], -6)
    s, d = span("c57_hat"); add(whoosh(0.7), s, -14)
    s, d = span("c58_hat_town"); add(whoosh(d, False), s, -18)
    s, d = span("c59_win"); add(crowd(d + 0.4, 2.6, True), s, -11)
    s, d = span("c60_night_town")
    for k in range(7): add(boing(rng.uniform(0.8, 1.3)), s + rng.uniform(0, d), -22, rng.uniform(-0.6, 0.6))
    hops("c61_rooftop", 0.9, 0, 1.0, -18); hops("c61_rooftop", 0.9, 0.45, 0.8, -20, 0.3)


def main():
    build()
    sfx = np.stack([L, R], 1)[: int(DUR * SR)]
    sf.write(os.path.join(B, "sfx.wav"), sfx.astype(np.float32), SR)
    v, sr = sf.read(os.path.join(B, "voice.wav"), dtype="float64"); assert sr == SR
    voice = np.zeros(len(sfx)); voice[: min(len(v), len(voice))] = v[: len(voice)]
    # gentle ducking of effects under the voice (voice dominates, like the reference)
    e = np.abs(voice); e = lp(e, 8) ; e = e / (e.max() + 1e-9)
    duck = 10 ** (-6 * np.clip(e * 4, 0, 1) / 20)
    mix = sfx * duck[:, None] * 0.9 + voice[:, None] * 1.0
    import pyloudnorm as pyln
    meter = pyln.Meter(SR)
    for _ in range(4):
        g = -14.0 - meter.integrated_loudness(mix); mix *= 10 ** (g / 20)
        # look-ahead limiter at -1.5 dBFS (4x oversampled peak estimate)
        up = signal.resample_poly(mix, 4, 1, axis=0); pk = np.max(np.abs(up), 1)
        lim = 10 ** (-1.6 / 20); gain = np.minimum(1, lim / np.maximum(pk, 1e-9))
        gain = -signal.convolve(-gain, np.ones(4 * 48) / (4 * 48), mode="same"); gain = np.minimum.accumulate(gain[::-1])[::-1] if False else gain
        gain = signal.resample_poly(np.minimum(1, gain), 1, 4)[: len(mix)]
        # smooth release
        sm = np.copy(gain)
        for i in range(1, len(sm)): sm[i] = min(gain[i], sm[i - 1] + (1 - sm[i - 1]) * 0.0015)
        mix *= sm[:, None]
    I = meter.integrated_loudness(mix)
    tp = 20 * np.log10(np.max(np.abs(signal.resample_poly(mix, 4, 1, axis=0))))
    sf.write(os.path.join(B, "mix.wav"), mix.astype(np.float32), SR, subtype="PCM_24")
    print(f"mix: {I:.2f} LUFS, true peak {tp:.2f} dBTP, {len(mix)/SR:.2f}s")


if __name__ == "__main__":
    main()
