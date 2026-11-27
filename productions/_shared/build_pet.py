def bark(d=0.22, f0=520):
    t = tt(d); f = f0 * (1 - 0.35 * t / d)
    x = np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)) * 0.6 + 0.4 * rng.standard_normal(len(t))
    x = bp(x, 400, 2600) * env(len(t), 0.004, 0.07); return x / (np.max(np.abs(x)) + 1e-9)


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
    INT = ("c09_", "c12_", "c13_", "c14_", "c25_", "c27_", "c28_", "c29_", "c30_", "c31_", "c32_")
    STAD = [n for n in names if n[:3] >= "c15" and n[:3] <= "c41" and not n.startswith(INT) and n != "c26_night"]
    for n in names:
        s, d = span(n)
        if n.startswith(INT): add(amb_room(d + 0.05), s, -34)
        elif n == "c26_night": add(crickets(d + 0.05), s, -28)
        elif n not in STAD: add(amb_day(d + 0.05), s, -30)
    refrain(EV["h6a"], ch); refrain(EV["h6b"], ch, -14)
    for n in ("c01_aerial", "c02_street", "c08_except"):
        s, d = span(n)
        for k in np.arange(rng.uniform(0.1, 0.4), d, 0.7): add(bark(0.2, rng.uniform(450, 700)), s + k, -24, rng.uniform(-0.6, 0.6))
    add(whoosh(0.5), EV["flip"], -14); add(tick(900, 0.08), EV["flip"] + 0.65, -16)
    add(bark(0.22, 600), C("c06_mailman_dog", 0.3), -14); add(whoosh(0.6), EV["hoop"], -13); add(thud(110, 0.2), EV["hoop"] + 0.8, -14)
    # stadium
    c0 = C("c15_venue"); c1 = C("c25_train"); add(crowd(c1 - c0 + 0.2, 1.0), c0, -24)
    s, d = span("c16_bone"); add(beep(1760, 0.3), s + 0.05, -20); add(beep(2349, 0.4), s + 0.2, -22)
    s, d = span("c17_cat_flip")
    for k in range(3): add(whoosh(0.35), s + 0.05 + k * (d - 0.25) / 3, -15)
    s, d = span("c18_dog_hoops")
    for k in range(3): add(whoosh(0.35), s + 0.1 + k * d / 3.2, -15)
    add(crowd(1.6, 2.0, True), C("c19_cheer"), -13)
    s, d = span("c21_sat"); add(crickets(d + 0.05), s, -26)
    s, d = span("c22_minute")
    for k in range(61): add(tick(2200, 0.03), s + k * (d - 0.25) / 60, -24)
    add(beep(880, 0.3), s + d - 0.25, -16)
    s, d = span("c23_laugh"); laughs(s, d + span("c24_dog_laugh")[1], -16); add(crowd(d, 1.5, True), s, -20)
    s, d = span("c24_dog_laugh")
    for k in np.arange(0, d, 0.2): add(bark(0.12, 700), s + k, -15)
    s, d = span("c12_bark"); add(crickets(d + 0.05), s, -27)
    s, d = span("c14_nothing"); add(crickets(d + 0.05), s, -27)
    add(tick(500, 0.1), C("c13_eat", 0.2), -18)
    s, d = span("c31_roll"); add(rustle(d), s, -20)
    add(tick(700, 0.06), C("c27_sit", 0.4), -22)
    f0 = C("c33_final"); add(crowd(DUR - f0, 0.6), f0, -26)
    # THE huss
    t0 = EV["big_huss"]
    add(huss_hit(2.6, 1.2), t0, -3); add(thud(40, 0.9), t0, -5); add(whoosh(1.2), t0 + 0.05, -10)
    add(crowd(1.6, 2.2, True), t0 + 0.1, -14)
    s, d = span("c37_fly"); add(whoosh(1.0), s, -10)
    for k in range(4): add(bark(0.15, rng.uniform(600, 900)), s + 0.1 + k * 0.18, -17, rng.uniform(-0.5, 0.5))
    add(splash(1.1), EV["splash"], -3); add(thud(45, 0.6), EV["splash"], -6)
    add(crowd(2.5, 2.4, True), EV["splash"] + 0.1, -12)
    s, d = span("c39_gary_still"); add(beep(1568, 0.12), s + d * 0.5, -20)
    s, d = span("c41_award"); add(crowd(d + 0.6, 2.6, True), s, -11); add(beep(1568, 0.2), s, -18); add(beep(2093, 0.4), s + 0.15, -18)
    s, d = span("c42_town_rocks"); add(rolling(d), s, -22)
