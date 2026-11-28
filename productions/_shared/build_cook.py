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
