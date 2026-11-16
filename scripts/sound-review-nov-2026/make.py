"""The game sounds the November reviews found missing (docs/sound-cues/review-nov-2026.md): every effect slot a live game
plays that had no file of its own, synthesised here, deterministically, from code alone (no recordings, no samples).
Usage: python3 -I scripts/sound-review-nov-2026/make.py [out dir, default public/sounds] [report.json or -] [names,...]
(the default run also rewrites src/lib/fx/newGameSounds.data.ts)

Every sound is built from a few plain parts (decaying modes for wood, glass, stone and metal; band-passed noise for air,
water and grit; band-limited pulse waves for the Retro games), each from a fixed seed, so a rebuild writes the same
samples. Then the house method (docs/sound-cues/levels-nov-2026.md, scripts/sound-audit-nov-2026/fix.py, whose writer,
limiter and loudness meter are imported): mono, 44.1 kHz, 96 kbps CBR MP3 with the LAME gapless tag; each effect
levelled to the library's median loudness for its length (under 0.25 s -22.7 LUFS, 0.25-0.5 s -17.5, 0.5-0.9 s -17.1,
longer -16.5; effect loops -16.8), true peak at -1 dBFS or under, the fast lookahead limiter only while it stays
transparent (what it removes at least 14 dB under the sound), else the file stays short of the median. Loops are built
on their own crossfade (the end folded onto the start) and written with fix.py's wrap-around frames, so the join has no
tick.

Nothing here is wired by default: the files play only with NEW_GAME_SOUNDS on (src/config/soundConfig.ts), through
src/lib/fx/newGameSounds.data.ts, which this script writes from the report.

A recipe whose file Joe has since recorded (sound batch 1, docs/sound-cues/sounds-batch-1.csv) is not synthesised: its
file is his recording (scripts/sound-batch-1/process.py), only measured here for the data file.
"""
import json, os, sys, zlib

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "sound-audit-nov-2026"))
import fix  # noqa: E402  (write, limit, ebur, distortion_db: the house encoder and meter)

SR = 44100
TAU = 2 * np.pi
EFFECT_BY_LEN = fix.EFFECT_BY_LEN
LOOP_LUFS = fix.LOOP_LUFS
TP_MAX = fix.TP_MAX


# ----------------------------------------------------------------------------------------------------------- parts


def n_of(sec):
    return max(1, int(round(sec * SR)))


def tt(n):
    return np.arange(n) / SR


def rng_for(name):
    return np.random.default_rng(zlib.crc32(name.encode()))


def env(n, attack=0.002, decay=0.1, hold=0.0):
    """A short linear attack, an optional hold, then an exponential fall (decay = time to -60 dB)."""
    t = tt(n)
    a = np.clip(t / max(attack, 1e-4), 0, 1)
    d = np.where(t < attack + hold, 1.0, np.exp(-6.91 * (t - attack - hold) / max(decay, 1e-3)))
    return a * d


def pad_to(x, n):
    return np.concatenate([x, np.zeros(max(0, n - len(x)))])[:n] if len(x) < n else x[:n]


def mix(*parts):
    n = max(len(p) for p in parts)
    out = np.zeros(n)
    for p in parts:
        out[: len(p)] += p
    return out


def at(x, sec, total=None):
    """x delayed by `sec`."""
    y = np.concatenate([np.zeros(n_of(sec)), x])
    return pad_to(y, total) if total else y


def phase_of(freq, n):
    f = np.broadcast_to(np.asarray(freq, float), (n,))
    return np.cumsum(TAU * f / SR)


def sine(freq, n, phase0=0.0):
    return np.sin(phase_of(freq, n) + phase0)


def tri(freq, n):
    p = (phase_of(freq, n) / TAU) % 1.0
    return 4 * np.abs(p - 0.5) - 1


def pulse(freq, n, duty=0.5, top=None):
    """Band-limited pulse wave (additive, harmonics under 0.4 of the rate for the highest pitch played)."""
    f = np.broadcast_to(np.asarray(freq, float), (n,))
    ph = phase_of(f, n)
    k_max = max(1, int(0.4 * SR / max(f.max(), 1)))
    if top:
        k_max = min(k_max, top)
    out = np.zeros(n)
    for k in range(1, k_max + 1):
        out += (2 / (k * np.pi)) * np.sin(np.pi * k * duty) * np.cos(k * ph)
    return out


def glide(f0, f1, n, curve=1.0):
    """A pitch path from f0 to f1 (exponential in pitch; curve > 1 holds near f0 longer)."""
    u = np.linspace(0, 1, n) ** curve
    return f0 * (f1 / f0) ** u


def steps(freqs, step_sec, n):
    """A chiptune arpeggio: each pitch held for step_sec."""
    idx = np.minimum((tt(n) / step_sec).astype(int), len(freqs) - 1)
    return np.asarray(freqs, float)[idx]


def noise(n, rng):
    return rng.standard_normal(n)


def svf(x, cutoff, q=0.7, mode="bp"):
    """Chamberlin state-variable filter; cutoff may be an array (Hz, per sample). Returns lp, bp or hp."""
    n = len(x)
    fc = np.broadcast_to(np.asarray(cutoff, float), (n,))
    f = 2 * np.sin(np.pi * np.minimum(fc, SR / 6.2) / SR)
    damp = 1.0 / max(q, 0.5)
    lp = bp = 0.0
    out = np.empty(n)
    want = {"lp": 0, "bp": 1, "hp": 2}[mode]
    for i in range(n):
        hp = x[i] - lp - damp * bp
        bp += f[i] * hp
        lp += f[i] * bp
        out[i] = (lp, bp, hp)[want]
    return out


def onepole_lp(x, cutoff):
    a = np.exp(-TAU * cutoff / SR)
    out = np.empty(len(x))
    y = 0.0
    for i, v in enumerate(x):
        y = (1 - a) * v + a * y
        out[i] = y
    return out


def hp1(x, cutoff):
    return x - onepole_lp(x, cutoff)


def modes(f0, ratios, decays, amps, n, rng=None, detune=0.0):
    """A struck object: decaying sine modes (wood, glass, stone, metal by their ratios and decays)."""
    out = np.zeros(n)
    t = tt(n)
    for r, d, a in zip(ratios, decays, amps):
        f = f0 * r * (1 + (rng.uniform(-detune, detune) if rng is not None and detune else 0))
        if f >= SR * 0.45:
            continue
        out += a * np.sin(TAU * f * t) * np.exp(-6.91 * t / d)
    return out * np.clip(t / 0.0008, 0, 1)


WOOD = ([1.0, 2.57, 4.18, 6.6], [1.0, 0.45, 0.25, 0.12], [1.0, 0.5, 0.25, 0.1])
GLASS = ([1.0, 2.32, 4.25, 6.63, 9.38], [1.0, 0.8, 0.6, 0.45, 0.3], [1.0, 0.55, 0.35, 0.2, 0.1])
METAL = ([1.0, 2.0, 2.76, 5.4, 8.93], [1.0, 0.7, 0.85, 0.5, 0.35], [1.0, 0.35, 0.5, 0.2, 0.1])
STONE = ([1.0, 1.59, 2.95, 4.4], [1.0, 0.4, 0.22, 0.12], [1.0, 0.6, 0.3, 0.15])
BELL = ([0.56, 1.0, 1.19, 1.71, 2.0, 2.74, 3.0], [1.4, 1.0, 0.9, 0.7, 0.6, 0.45, 0.35],
        [0.35, 1.0, 0.45, 0.35, 0.3, 0.18, 0.12])


def struck(kind, f0, length, decay, n, rng, detune=0.004):
    ratios, decs, amps = kind
    return modes(f0, ratios, [decay * d for d in decs], amps, n, rng, detune)


def click(n, rng, bright=6000, ms=3.0):
    k = n_of(ms / 1000)
    c = np.zeros(n)
    c[:k] = noise(k, rng) * np.exp(-np.linspace(0, 6, k))
    return svf(c, bright, 0.8, "hp") * 0.6 + svf(c, bright * 0.5, 1.2, "bp") * 0.8


def thump(f0, f1, decay, n):
    return sine(glide(f0, f1, n, 0.6), n) * env(n, 0.001, decay)


def room(x, rng, size=0.12, wet=0.12, bright=5000):
    """A small, dark room tail (exponentially decaying noise IR, FFT convolution): polish, never a wash."""
    k = n_of(size)
    ir = noise(k, rng) * np.exp(-6.91 * tt(k) / size)
    ir = onepole_lp(ir, bright)
    ir /= np.sqrt((ir ** 2).sum()) + 1e-12
    m = len(x) + k
    y = np.fft.irfft(np.fft.rfft(x, m * 2) * np.fft.rfft(ir, m * 2), m * 2)[:m]
    return np.concatenate([x, np.zeros(k)]) * (1 - wet) + y * wet * 1.6


def bubbles(n, rng, count, f_lo, f_hi, spread, rise=1.8, size=0.045, start=0.0):
    """Water: short sines whose pitch rises as each bubble closes (Minnaert), at seeded times."""
    out = np.zeros(n)
    for i in range(count):
        t0 = start + spread * (i / max(1, count - 1)) + rng.uniform(-0.01, 0.01)
        f = rng.uniform(f_lo, f_hi)
        k = n_of(size * rng.uniform(0.7, 1.3))
        b = sine(f * (1 + rise * tt(k) / size * 0.4), k) * env(k, 0.002, size)
        j = n_of(max(0.0, t0))
        if j < n:
            seg = b[: n - j]
            out[j:j + len(seg)] += seg * rng.uniform(0.6, 1.0)
    return out


def crush(x, bits=6, hold=3):
    """The Retro screens' grit: fewer levels and a held sample (a cheap sound chip), then smoothed a touch."""
    y = np.repeat(x[::hold], hold)[: len(x)]
    q = 2 ** (bits - 1)
    return np.round(y * q) / q


def retro_noise(n, rng, rate_hz):
    """An LFSR-style stepped noise at rate_hz (rate may be an array): the NES noise channel's colour."""
    r = np.broadcast_to(np.asarray(rate_hz, float), (n,))
    ph = np.cumsum(r / SR)
    idx = ph.astype(int)
    vals = rng.uniform(-1, 1, idx.max() + 2)
    return vals[idx]


def stepped(n, step_sec, levels):
    """A stepped volume envelope (chip style)."""
    idx = np.minimum((tt(n) / step_sec).astype(int), len(levels) - 1)
    return np.asarray(levels, float)[idx]


def fade_out(x, sec=0.012):
    k = min(len(x) // 3, n_of(sec))
    y = x.copy()
    if k > 1:
        y[-k:] *= np.cos(np.linspace(0, np.pi / 2, k)) ** 2
    return y


def trim_tail(x, floor_db=-60):
    a = np.abs(x)
    idx = np.nonzero(a > a.max() * 10 ** (floor_db / 20))[0]
    end = idx[-1] + n_of(0.005) if len(idx) else len(x)
    return fade_out(x[: min(len(x), end)])


def make_loop(body, xfade):
    """body holds loop + xfade samples: its tail is crossfaded (equal power) into its head, so it loops seamlessly."""
    c = n_of(xfade)
    L = len(body) - c
    out = body[:L].copy()
    w = np.linspace(0, 1, c)
    out[:c] = body[:c] * np.sin(w * np.pi / 2) + body[L:L + c] * np.cos(w * np.pi / 2)
    return out


def norm(x):
    return x / (np.abs(x).max() + 1e-12)


# --------------------------------------------------------------------------------------------------- the sounds
# Each recipe: (rng) -> mono samples. RECIPES[file] = (recipe, loop?, [slots], what it sounds like).

RECIPES = {}


def sound(file, slots, what, loop=False):
    def deco(fn):
        RECIPES[file] = (fn, loop, slots, what)
        return fn
    return deco


# --- Logic, Number, Pattern and Attention puzzles: tactile, warm, small (a short room on each) -----------------------

@sound("sudoku.place", ["sudoku.place"], "a soft wooden tap, a digit set on a board")
def _(r):
    n = n_of(0.18)
    x = struck(WOOD, 940, 0, 0.15, n, r) * 0.8 + click(n, r, 5000) * 0.1 + thump(260, 180, 0.06, n) * 0.35
    return room(x, r, 0.1, 0.12)


@sound("tower.drop", ["tower.drop"], "a ring dropping onto its post: a mid wooden clunk with a low knock")
def _(r):
    n = n_of(0.24)
    x = struck(WOOD, 430, 0, 0.13, n, r, 0.01) + thump(150, 95, 0.06, n) * 0.6 + click(n, r, 3500) * 0.35
    return room(x, r, 0.1, 0.12)


@sound("tubes.pour", ["tubes.pour"], "a glassy pour: bubbles rising in pitch inside a glass tube")
def _(r):
    n = n_of(0.34)
    b = bubbles(n, r, 7, 700, 1250, 0.2, rise=2.2, size=0.05)
    glass = struck(GLASS, 1760, 0, 0.25, n, r) * 0.18
    wash = svf(noise(n, r), glide(1800, 2600, n), 2.5) * env(n, 0.03, 0.25) * 0.08
    return room(mix(b, glass, wash), r, 0.12, 0.14)


@sound("nonogram.fill", ["nonogram.fill"], "a felt stamp: a soft, dense press into the square")
def _(r):
    n = n_of(0.12)
    press = svf(noise(n, r), 1300, 1.0, "lp") * env(n, 0.001, 0.05) * 0.7
    x = press + thump(320, 210, 0.07, n) * 0.8 + struck(WOOD, 760, 0, 0.08, n, r) * 0.25
    return room(x, r, 0.06, 0.08)


@sound("nonogram.mark", ["nonogram.mark"], "a pencil tick: a light, dry scratch")
def _(r):
    n = n_of(0.07)
    s = svf(noise(n, r), 4200, 1.5) * env(n, 0.003, 0.06)
    return s * 0.9 + struck(WOOD, 2100, 0, 0.05, n, r) * 0.25


@sound("flood.spread", ["flood.spread"], "a liquid ripple washing out across the board")
def _(r):
    n = n_of(0.3)
    f = glide(320, 760, n, 0.7) * (1 + 0.03 * np.sin(TAU * 18 * tt(n)))
    tone = sine(f, n) * env(n, 0.01, 0.22) * 0.5
    wash = svf(noise(n, r), glide(500, 1600, n), 1.8) * env(n, 0.04, 0.24) * 0.35
    b = bubbles(n, r, 4, 500, 900, 0.16, size=0.04, start=0.04) * 0.4
    return room(mix(tone, wash, b), r, 0.14, 0.15)


@sound("tents.pitch", ["tents.pitch"], "canvas snapping taut, a peg tapped into the ground")
def _(r):
    n = n_of(0.22)
    canvas = svf(noise(n, r), glide(1400, 500, n), 1.2) * env(n, 0.004, 0.09) * 0.8
    peg = at(struck(WOOD, 720, 0, 0.06, n_of(0.12), r) + click(n_of(0.12), r, 3000) * 0.4, 0.05, n)
    return room(mix(canvas, peg * 0.7), r, 0.09, 0.1)


@sound("tents.grass", ["tents.grass"], "a soft brush of grass")
def _(r):
    n = n_of(0.13)
    g = svf(noise(n, r), glide(3800, 5200, n), 1.0, "hp") * env(n, 0.012, 0.09)
    g *= 0.7 + 0.3 * np.sin(TAU * 38 * tt(n))
    return g * 0.6


@sound("safe.solve", ["safe.solve"], "placeholder: the safe opening: three drum clicks in turn, then a heavy latch and a low door swing")
def _(r):
    n = n_of(0.9)
    clicks = mix(*[at(struck(METAL, 1900 + 140 * i, 0, 0.05, n_of(0.08), r) * 0.6 + click(n_of(0.08), r, 6500) * 0.4, 0.06 * i, n) for i in range(3)])
    latch = at(thump(150, 90, 0.09, n_of(0.3)) * 0.8 + struck(METAL, 420, 0, 0.18, n_of(0.3), r) * 0.5, 0.22, n)
    swing = at(svf(noise(n_of(0.6), r), glide(500, 260, n_of(0.6)), 1.6) * env(n_of(0.6), 0.08, 0.45) * 0.3, 0.3, n)
    return room(mix(clicks, latch, swing), r, 0.16, 0.14)


@sound("unblock.solve", ["unblock.solve"], "placeholder: the gold block driving out: a short rising engine buzz and a whoosh past the exit")
def _(r):
    n = n_of(0.8)
    f = glide(85, 170, n)
    buzz = svf((tri(glide(110, 220, n), n) * 0.5 + noise(n, r) * 0.15) * (0.6 + 0.4 * sine(30, n)), f * 6, 0.9, "lp") * env(n, 0.04, 0.55) * 0.7
    whoosh = svf(noise(n, r), glide(900, 3200, n), 1.3) * env(n, 0.25, 0.4) * 0.3
    return room(mix(buzz, whoosh), r, 0.12, 0.12)


@sound("shikaku.place", ["shikaku.place"], "a frame snapping into place: two quick clicks on a wooden body")
def _(r):
    n = n_of(0.16)
    a = struck(WOOD, 1150, 0, 0.05, n, r) + click(n, r, 6000) * 0.5
    b = at(struck(WOOD, 1380, 0, 0.06, n_of(0.12), r) * 0.8 + click(n_of(0.12), r, 6000) * 0.4, 0.035, n)
    return room(mix(a * 0.7, b), r, 0.08, 0.1)


@sound("shikaku.remove", ["shikaku.remove"], "the frame lifted off: a soft, falling wooden knock")
def _(r):
    n = n_of(0.15)
    body = modes(820, WOOD[0], [d * 0.1 for d in WOOD[1]], WOOD[2], n, r)
    sw = svf(noise(n, r), glide(2400, 900, n), 1.4) * env(n, 0.003, 0.06) * 0.25
    return room(body * 0.8 + sw, r, 0.07, 0.08)


@sound("lightup.lamp", ["lightup.lamp"], "a warm lamp switching on: a soft hum swelling under a small glass ping")
def _(r):
    n = n_of(0.34)
    hum = (sine(220, n) + 0.45 * sine(440, n) + 0.2 * sine(660, n)) * env(n, 0.05, 0.28, 0.03) * 0.35
    ping = struck(GLASS, 1760, 0, 0.22, n, r) * 0.45
    sw = click(n, r, 4000) * 0.25
    return room(mix(hum, ping, sw), r, 0.14, 0.15)


@sound("lightup.dot", ["lightup.dot"], "a tiny dot set: a short, quiet tick")
def _(r):
    n = n_of(0.06)
    return sine(1500, n) * env(n, 0.002, 0.06) * 0.5 + click(n, r, 7000) * 0.15


@sound("trail.step", ["trail.step"], "a soft step tone, a short rounded pluck")
def _(r):
    n = n_of(0.13)
    f = 660
    pl = (tri(f, n) * 0.6 + sine(f * 2, n) * 0.25) * env(n, 0.002, 0.09)
    return room(svf(pl, 2400, 0.7, "lp") + click(n, r, 4000) * 0.15, r, 0.08, 0.1)


@sound("balance.drop", ["balance.drop"], "a brass weight set on the pan: a metal clink over a soft knock")
def _(r):
    n = n_of(0.34)
    clink = struck(METAL, 540, 0, 0.34, n, r, 0.006) * 0.6
    knock = thump(180, 120, 0.08, n) * 0.5 + struck(WOOD, 300, 0, 0.1, n, r) * 0.3
    return room(clink + knock + click(n, r, 4500) * 0.06, r, 0.14, 0.14)


@sound("balance.lift", ["balance.lift"], "a weight lifted off: a light clink and a small upward breath")
def _(r):
    n = n_of(0.2)
    clink = struck(METAL, 880, 0, 0.14, n, r) * 0.5
    air = svf(noise(n, r), glide(900, 2200, n), 1.5) * env(n, 0.02, 0.12) * 0.25
    return room(clink + air, r, 0.08, 0.1)


@sound("equation.drop", ["equation.drop"], "a number tile clacking into its gap")
def _(r):
    n = n_of(0.12)
    x = modes(1350, [1, 2.31, 3.7], [0.09, 0.06, 0.04], [1, 0.5, 0.25], n, r) + thump(420, 300, 0.05, n) * 0.4
    return room(x + click(n, r, 5500) * 0.25, r, 0.08, 0.1)


@sound("numpyramid.place", ["numpyramid.place"], "a stone set on the pyramid: a short, dense tap")
def _(r):
    n = n_of(0.16)
    x = struck(STONE, 620, 0, 0.11, n, r) + thump(210, 150, 0.06, n) * 0.5
    return room(svf(x, 3000, 0.7, "lp") * 1.4 + click(n, r, 3500) * 0.3, r, 0.08, 0.1)


@sound("measure.pour", ["measure.pour"], "water poured from jug to jug: a short glug")
def _(r):
    n = n_of(0.34)
    b = bubbles(n, r, 6, 260, 520, 0.22, rise=1.6, size=0.06)
    stream = svf(noise(n, r), 900, 1.2) * env(n, 0.03, 0.28, 0.05) * 0.25
    return room(mix(b, stream), r, 0.12, 0.14)


@sound("measure.fill", ["measure.fill"], "a jug filled at the tap: water rising in pitch")
def _(r):
    n = n_of(0.36)
    stream = svf(noise(n, r), glide(700, 1700, n), 2.0) * env(n, 0.02, 0.3, 0.08) * 0.5
    b = bubbles(n, r, 6, 500, 900, 0.26, rise=2.0, size=0.04) * 0.5
    return room(mix(stream, b), r, 0.12, 0.14)


@sound("measure.empty", ["measure.empty"], "a jug emptied: a falling gurgle")
def _(r):
    n = n_of(0.32)
    b = bubbles(n, r, 6, 220, 420, 0.22, rise=-0.4, size=0.06)
    drain = svf(noise(n, r), glide(1200, 400, n), 1.4) * env(n, 0.01, 0.26, 0.04) * 0.3
    return room(mix(b, drain), r, 0.12, 0.12)


@sound("measure.reset", ["measure.reset"], "the jugs set back: a soft, short whoosh")
def _(r):
    n = n_of(0.26)
    w = svf(noise(n, r), glide(600, 2400, n, 0.8), 1.6) * env(n, 0.06, 0.18)
    return w * 0.5 + struck(GLASS, 1200, 0, 0.1, n, r) * 0.12


@sound("numline.place", ["numline.place"], "a pin pressed into the line: a small, bright metal tick")
def _(r):
    n = n_of(0.17)
    pin = struck(METAL, 2200, 0, 0.12, n, r) * 0.5
    x = pin + click(n, r, 6000) * 0.5 + thump(500, 380, 0.025, n) * 0.3
    return room(x, r, 0.08, 0.1)


@sound("pipes.rotate", ["pipes.rotate"], "a pipe joint turned: a metal ratchet click on a hollow body")
def _(r):
    n = n_of(0.15)
    c1 = click(n, r, 5000) * 0.4 + struck(METAL, 1900, 0, 0.07, n, r) * 0.3
    c2 = at(click(n_of(0.1), r, 5000) * 0.5 + struck(METAL, 2350, 0, 0.04, n_of(0.1), r) * 0.25, 0.028, n)
    body = modes(310, [1, 2.9], [0.12, 0.07], [1, 0.3], n, r) * 0.5
    return room(mix(c1, c2, body), r, 0.07, 0.1)


@sound("iceslide.slide", ["iceslide.slide"], "a slide across ice: a bright, glassy swish")
def _(r):
    n = n_of(0.2)
    sw = svf(noise(n, r), glide(6500, 2800, n), 2.0) * env(n, 0.01, 0.16) * 0.6
    sh = struck(GLASS, 2900, 0, 0.12, n, r) * 0.12
    return room(sw + sh, r, 0.1, 0.12, 7000)


@sound("push.step", ["push.step"], "a soft footstep")
def _(r):
    n = n_of(0.09)
    x = svf(noise(n, r), 380, 1.0, "lp") * env(n, 0.004, 0.07) * 1.2 + thump(140, 90, 0.07, n) * 0.6
    return x


@sound("push.push", ["push.push"], "a crate shoved one square: a wooden thump with a short scrape")
def _(r):
    n = n_of(0.18)
    thud = struck(WOOD, 190, 0, 0.14, n, r) + thump(120, 80, 0.09, n) * 0.6
    scrape = svf(noise(n, r), 650, 1.6) * env(n, 0.01, 0.1) * 0.35 * (1 + 0.5 * np.sin(TAU * 55 * tt(n)))
    return room(thud + scrape, r, 0.08, 0.1)


@sound("laser.place", ["laser.place"], "a mirror set down: a small glass click")
def _(r):
    n = n_of(0.13)
    return room(struck(GLASS, 2600, 0, 0.08, n, r) * 0.6 + click(n, r, 6500) * 0.5, r, 0.07, 0.1)


@sound("laser.turn", ["laser.turn"], "a mirror turned: two light glass ticks")
def _(r):
    n = n_of(0.13)
    a = struck(GLASS, 2400, 0, 0.05, n, r) * 0.5 + click(n, r, 6500) * 0.35
    b = at(struck(GLASS, 2750, 0, 0.05, n_of(0.09), r) * 0.45 + click(n_of(0.09), r, 6500) * 0.3, 0.04, n)
    return room(mix(a, b), r, 0.06, 0.1)


@sound("laser.fire", ["laser.fire"], "the beam fired: a clean rising zap that settles into a short hum")
def _(r):
    n = n_of(0.46)
    f = glide(260, 1250, n, 0.35)
    zap = (sine(f, n) + 0.35 * sine(f * 2.01, n) + 0.12 * tri(f * 0.5, n)) * env(n, 0.004, 0.36, 0.04) * 0.5
    sh = svf(noise(n, r), glide(3000, 6000, n), 3.0) * env(n, 0.002, 0.12) * 0.15
    return room(zap + sh, r, 0.12, 0.12)


@sound("symscan.mark", ["symscan.mark"], "a symbol marked: a short, clear ping")
def _(r):
    n = n_of(0.14)
    x = (sine(1320, n) + 0.3 * sine(1980, n)) * env(n, 0.001, 0.1) * 0.5 + click(n, r, 6000) * 0.15
    return room(x, r, 0.07, 0.1)


@sound("symscan.unmark", ["symscan.unmark"], "a mark taken back: a lower, softer ping")
def _(r):
    n = n_of(0.1)
    return room(sine(glide(940, 820, n), n) * env(n, 0.001, 0.07) * 0.5 + click(n, r, 4500) * 0.1, r, 0.05, 0.08)


@sound("spotdiff.found", ["spotdiff.found"], "a difference found: a bright two-note chime, up a fifth")
def _(r):
    n = n_of(0.42)
    a = struck(BELL, 1046.5, 0, 0.32, n, r) * 0.5
    b = at(struck(BELL, 1568, 0, 0.34, n_of(0.35), r) * 0.55, 0.075, n)
    return room(mix(a, b), r, 0.14, 0.14)


@sound("bomb.press", ["bomb.press"], "a panel key pressed: a firm plastic click with a short beep")
def _(r):
    n = n_of(0.13)
    key = click(n, r, 3800) * 0.35 + modes(1150, [1, 2.4], [0.06, 0.035], [1, 0.4], n, r) * 0.45
    beep = at(pulse(1480, n_of(0.06), 0.5, 6) * env(n_of(0.06), 0.002, 0.05), 0.012, n) * 0.18
    return room(mix(key, beep), r, 0.05, 0.08)


# --- Retro arcade (Hover, Breaker, Rally, Fission, Tempo, Meteor, Wavefront, Blockzone): a dry sound chip --------

@sound("retro.start", ["hover.start", "breaker.start", "rally.start", "burst.start", "beat.start", "snake.start", "blockfall.start"],
       "the Retro run starting: a quick three-note pulse arpeggio up to a held note")
def _(r):
    n = n_of(0.3)
    f = steps([523.25, 659.25, 783.99, 1046.5], 0.055, n)
    v = stepped(n, 0.055, [0.8, 0.8, 0.8, 1.0]) * env(n, 0.001, 0.3, 0.17)
    return pulse(f, n, 0.25) * v * 0.55 + tri(f / 2, n) * v * 0.3


@sound("retro.crash", ["hover.crash", "snake.dead", "rally.dead"],
       "a Retro crash: a crunchy noise burst falling in pitch")
def _(r):
    n = n_of(0.36)
    nz = retro_noise(n, r, glide(9000, 700, n, 0.6)) * env(n, 0.001, 0.32)
    tone = pulse(glide(320, 70, n, 0.7), n, 0.5) * env(n, 0.001, 0.2) * 0.4
    return crush(nz * 0.8 + tone, 9, 2)


@sound("retro.lifeLost", ["burst.lifeLost", "wavefront.lifeLost"],
       "a life lost: three falling pulse notes, the last one bending down")
def _(r):
    n = n_of(0.42)
    f = steps([659.25, 523.25, 392.0], 0.1, n)
    f = np.where(tt(n) > 0.2, f * glide(1.0, 0.7, n, 1.0), f)
    v = env(n, 0.001, 0.42, 0.22) * stepped(n, 0.1, [1.0, 0.95, 0.9])
    return pulse(f, n, 0.5) * v * 0.5 + tri(f / 2, n) * v * 0.25


@sound("retro.powerUp", ["breaker.powerUp", "burst.powerUp"], "a power-up caught: a fast four-note climb")
def _(r):
    n = n_of(0.22)
    f = steps([523.25, 783.99, 1046.5, 1567.98], 0.04, n)
    return pulse(f, n, 0.25) * env(n, 0.001, 0.22, 0.12) * 0.55


@sound("hover.gate", ["hover.gate"], "through a barrier: a quick two-note pulse, up a fourth")
def _(r):
    n = n_of(0.1)
    f = steps([1318.5, 1760.0], 0.035, n)
    return pulse(f, n, 0.5) * env(n, 0.001, 0.1, 0.04) * 0.5


@sound("hover.star", ["hover.star"], "a gold star: a bright sparkling arpeggio")
def _(r):
    n = n_of(0.16)
    f = steps([1567.98, 2093.0, 2637.0], 0.03, n)
    return pulse(f, n, 0.125) * env(n, 0.001, 0.16, 0.06) * 0.5 + tri(f, n) * env(n, 0.001, 0.14) * 0.2


@sound("breaker.paddle", ["breaker.paddle"], "the ball off the paddle: a short, round blip")
def _(r):
    n = n_of(0.06)
    return (pulse(440, n, 0.5) * 0.5 + tri(220, n) * 0.4) * env(n, 0.001, 0.07, 0.01)


@sound("breaker.brickHit", ["breaker.brickHit"], "a brick hit: a hard high blip with a tick")
def _(r):
    n = n_of(0.06)
    return crush(pulse(glide(990, 880, n), n, 0.5) * env(n, 0.001, 0.05) * 0.5 + retro_noise(n, r, 12000) * env(n, 0.001, 0.012) * 0.25, 7, 1)


@sound("breaker.ballLost", ["breaker.ballLost"], "the ball lost: a pulse sliding down")
def _(r):
    n = n_of(0.3)
    return pulse(glide(620, 140, n, 0.8), n, 0.5) * env(n, 0.002, 0.3, 0.12) * 0.5


@sound("breaker.fireballLit", ["breaker.fireballLit"], "the fireball lit: a rising rush of noise and pulse")
def _(r):
    n = n_of(0.24)
    nz = retro_noise(n, r, glide(2000, 12000, n)) * env(n, 0.02, 0.2, 0.05) * 0.5
    tone = pulse(glide(300, 1200, n), n, 0.25) * env(n, 0.005, 0.22, 0.05) * 0.35
    return crush(nz + tone, 6, 2)


@sound("breaker.laser", ["breaker.laser"], "a paddle laser: a classic pew diving in pitch")
def _(r):
    n = n_of(0.16)
    return pulse(glide(1900, 380, n, 0.5), n, 0.25) * env(n, 0.001, 0.16) * 0.5


@sound("breaker.multiball", ["breaker.multiball"], "multiball: three quick blips, up")
def _(r):
    n = n_of(0.12)
    f = steps([880, 1174.7, 1568.0], 0.035, n)
    return pulse(f, n, 0.5) * env(n, 0.001, 0.12, 0.08) * 0.45


@sound("burst.hit", ["burst.hit"], "an atom popped: a chip pop falling an octave")
def _(r):
    n = n_of(0.08)
    p = pulse(glide(1100, 520, n, 0.5), n, 0.5) * env(n, 0.001, 0.07) * 0.45
    return crush(p + retro_noise(n, r, 9000) * env(n, 0.001, 0.02) * 0.3, 7, 1)


@sound("burst.shot", ["burst.shot"], "a shot fired: a short, high pew")
def _(r):
    n = n_of(0.06)
    return pulse(glide(2200, 900, n, 0.6), n, 0.25) * env(n, 0.001, 0.07, 0.01) * 0.45


@sound("burst.gameOver", ["burst.gameOver"], "game over: a slow falling four-note phrase")
def _(r):
    n = n_of(0.75)
    f = steps([523.25, 466.16, 415.3, 349.23], 0.15, n)
    f = np.where(tt(n) > 0.45, f * glide(1.0, 0.85, n, 1.0), f)
    v = env(n, 0.002, 0.75, 0.45)
    return pulse(f, n, 0.5) * v * 0.45 + tri(f / 2, n) * v * 0.3


@sound("burst.freezeCaught", ["burst.freezeCaught"], "a freeze caught: an icy shimmer of high notes")
def _(r):
    n = n_of(0.24)
    f = steps([2093.0, 2637.0, 3136.0, 2637.0, 3520.0], 0.035, n)
    shim = tri(f, n) * env(n, 0.001, 0.24, 0.1) * 0.4 + tri(f * 1.006, n) * env(n, 0.001, 0.24, 0.1) * 0.3
    return shim + retro_noise(n, r, 14000) * env(n, 0.01, 0.15) * 0.08


@sound("snake.eat", ["snake.eat"], "a star eaten: a tiny two-note blip, up")
def _(r):
    n = n_of(0.06)
    f = steps([987.8, 1318.5], 0.025, n)
    return pulse(f, n, 0.5) * env(n, 0.001, 0.06, 0.03) * 0.45


@sound("snake.rockLand", ["snake.rockLand"], "a rock landing: a low chip thud with grit")
def _(r):
    n = n_of(0.14)
    t1 = pulse(glide(160, 60, n), n, 0.5) * env(n, 0.001, 0.12) * 0.5
    return crush(t1 + retro_noise(n, r, 1800) * env(n, 0.001, 0.08) * 0.5, 6, 2)


@sound("snake.rockWarn", ["snake.rockWarn"], "a rock incoming: a short warning beep")
def _(r):
    n = n_of(0.09)
    return pulse(1046.5, n, 0.5) * env(n, 0.001, 0.09, 0.05) * 0.4


@sound("snake.showerAlarm", ["snake.showerAlarm"], "a meteor shower: a two-tone alarm")
def _(r):
    n = n_of(0.2)
    f = steps([1174.7, 880.0, 1174.7, 880.0], 0.05, n)
    return pulse(f, n, 0.5) * env(n, 0.001, 0.2, 0.15) * 0.42


@sound("rally.hit", ["rally.hit"], "the ball returned: a round bop")
def _(r):
    n = n_of(0.06)
    return (pulse(523.25, n, 0.5) * 0.45 + tri(261.6, n) * 0.35) * env(n, 0.001, 0.07, 0.01)


@sound("rally.goldHit", ["rally.goldHit"], "a gold target hit: a bright coin, two notes")
def _(r):
    n = n_of(0.16)
    f = steps([1975.5, 2637.0], 0.04, n)
    return pulse(f, n, 0.5) * env(n, 0.001, 0.16, 0.06) * 0.45


@sound("wavefront.pierce", ["wavefront.pierce"], "a shot piercing a ship: a hard zap")
def _(r):
    n = n_of(0.1)
    z = pulse(glide(2400, 600, n, 0.4), n, 0.25) * env(n, 0.001, 0.09) * 0.4
    return crush(z + retro_noise(n, r, 10000) * env(n, 0.001, 0.03) * 0.3, 7, 1)


@sound("wavefront.bigExplode", ["wavefront.bigExplode"], "a big explosion: a long chip blast falling away")
def _(r):
    n = n_of(0.8)
    nz = retro_noise(n, r, glide(7000, 300, n, 0.5)) * env(n, 0.001, 0.78)
    boom = pulse(glide(120, 40, n, 0.6), n, 0.5) * env(n, 0.001, 0.5) * 0.45
    return crush(nz * 0.75 + boom, 9, 2)


@sound("wavefront.shapePop", ["wavefront.shapePop"], "a ship destroyed: a crisp chip pop")
def _(r):
    n = n_of(0.15)
    p = pulse(glide(880, 220, n, 0.6), n, 0.5) * env(n, 0.001, 0.13) * 0.4
    return crush(p + retro_noise(n, r, glide(8000, 2000, n)) * env(n, 0.001, 0.1) * 0.4, 6, 2)


@sound("wavefront.bossHit", ["wavefront.bossHit"], "the boss hit: a metallic chip clang")
def _(r):
    n = n_of(0.14)
    c = (pulse(370, n, 0.5) * 0.4 + pulse(523, n, 0.25) * 0.3) * env(n, 0.001, 0.13)
    return crush(c + retro_noise(n, r, 6000) * env(n, 0.001, 0.03) * 0.3, 6, 1)


@sound("wavefront.dive", ["wavefront.dive"], "a ship diving: a quick swoop down")
def _(r):
    n = n_of(0.12)
    return pulse(glide(1400, 500, n, 0.8), n, 0.25) * env(n, 0.002, 0.12) * 0.4


@sound("blockfall.speedUp", ["blockfall.speedUp"], "the speed steps up: a rising two-note chime")
def _(r):
    n = n_of(0.18)
    f = steps([783.99, 1174.7], 0.06, n)
    return pulse(f, n, 0.25) * env(n, 0.001, 0.18, 0.1) * 0.45 + tri(f, n) * env(n, 0.001, 0.18, 0.1) * 0.2


# --- Action, Strategy and Sports arcade: physical, a little room ---------------------------------------------------

@sound("flip.flip", ["flip.flip"], "gravity flipped: an airy whoosh that turns upward")
def _(r):
    n = n_of(0.26)
    w = svf(noise(n, r), glide(500, 3200, n, 0.6), 2.2) * env(n, 0.03, 0.2) * 0.7
    t = sine(glide(300, 620, n, 0.5), n) * env(n, 0.02, 0.18) * 0.2
    return room(w + t, r, 0.1, 0.1)


@sound("flip.crash", ["flip.crash"], "a crash into the cave: a heavy thud with falling grit")
def _(r):
    n = n_of(0.4)
    thud = thump(110, 45, 0.24, n) * 0.8 + struck(STONE, 180, 0, 0.16, n, r) * 0.4
    grit = svf(noise(n, r), 1600, 0.9) * env(n, 0.005, 0.36) * 0.5
    return room(thud + grit, r, 0.16, 0.14)


@sound("orbit.launch", ["orbit.launch"], "the rocket launched: a short thruster roar")
def _(r):
    n = n_of(0.32)
    roar = svf(noise(n, r), glide(400, 1400, n, 0.5), 0.9, "lp") * env(n, 0.02, 0.28, 0.04) * 0.9
    low = sine(glide(70, 110, n), n) * env(n, 0.02, 0.26) * 0.4
    return room(roar + low, r, 0.14, 0.1)


@sound("orbit.checkpoint", ["orbit.checkpoint"], "a checkpoint set: a soft two-note beacon")
def _(r):
    n = n_of(0.3)
    a = sine(880, n) * env(n, 0.003, 0.2) * 0.4
    b = at(sine(1318.5, n_of(0.24)) * env(n_of(0.24), 0.003, 0.22) * 0.4, 0.07, n)
    return room(mix(a, b), r, 0.2, 0.2)


@sound("orbit.crash", ["orbit.crash"], "a crash in space: a muffled, low burst")
def _(r):
    n = n_of(0.45)
    burst = svf(noise(n, r), glide(1800, 300, n, 0.5), 0.8, "lp") * env(n, 0.002, 0.4) * 1.0
    boom = thump(90, 38, 0.3, n) * 0.6
    return room(burst + boom, r, 0.2, 0.16)


@sound("orbit.ambience", ["orbit.ambience"], "deep space: a slow, low pad with a faint airy shimmer (loop)", loop=True)
def _(r):
    body = n_of(2.0 + 0.25)
    t = tt(body)
    pad = (sine(55, body) * 0.5 + sine(82.4, body) * 0.35 + sine(110.2, body) * 0.15)
    pad *= 0.85 + 0.15 * np.sin(TAU * 0.5 * t)
    air = svf(noise(body, r), 2200 + 500 * np.sin(TAU * 0.5 * t), 1.5) * 0.06
    return make_loop(pad * 0.5 + air, 0.25)


@sound("swing.crash", ["swing.crash"], "a fall into the lava: a heavy splash-thud")
def _(r):
    n = n_of(0.36)
    thud = thump(120, 50, 0.16, n) * 0.8
    hiss = svf(noise(n, r), glide(2500, 900, n), 0.9) * env(n, 0.004, 0.3) * 0.45
    return room(thud + hiss, r, 0.14, 0.12)


@sound("swing.grapple", ["swing.grapple"], "the grapple thrown and caught: a whip of rope and a metal clink")
def _(r):
    n = n_of(0.3)
    whip = svf(noise(n, r), glide(900, 3400, n_of(0.3), 0.5), 2.0) * env(n, 0.01, 0.12) * 0.5
    clink = at(struck(METAL, 1500, 0, 0.12, n_of(0.2), r) * 0.45 + click(n_of(0.2), r, 5000) * 0.3, 0.09, n)
    return room(mix(whip, clink), r, 0.1, 0.1)


@sound("swing.starTaken", ["swing.starTaken"], "a star taken: a quick bright sparkle")
def _(r):
    n = n_of(0.18)
    a = struck(BELL, 2093, 0, 0.14, n, r) * 0.4
    b = at(struck(BELL, 2637, 0, 0.12, n_of(0.14), r) * 0.35, 0.04, n)
    return room(mix(a, b), r, 0.1, 0.12, 8000)


@sound("swing.dragon", ["swing.dragon"], "the dragon closing in: a low, rough growl")
def _(r):
    n = n_of(0.6)
    f = glide(85, 70, n) * (1 + 0.04 * np.sin(TAU * 7 * tt(n)))
    growl = pulse(f, n, 0.3, 30) * (0.7 + 0.3 * np.sin(TAU * 23 * tt(n)))
    growl = svf(growl, 900, 0.8, "lp") * env(n, 0.08, 0.5, 0.1)
    breath = svf(noise(n, r), 700, 1.0) * env(n, 0.1, 0.45) * 0.25
    return room(growl * 0.8 + breath, r, 0.16, 0.12)


@sound("swing.rockShake", ["swing.rockShake"], "rocks about to fall: a short low rumble")
def _(r):
    n = n_of(0.2)
    rum = svf(noise(n, r), 220, 1.0, "lp") * env(n, 0.03, 0.17) * 1.4
    return rum * (0.7 + 0.3 * np.sin(TAU * 26 * tt(n)))


@sound("swing.rockLand", ["swing.rockLand"], "a rock landing: a dull stone thud")
def _(r):
    n = n_of(0.14)
    return room(struck(STONE, 210, 0, 0.12, n, r) * 0.7 + thump(130, 70, 0.1, n) * 0.6, r, 0.1, 0.12)


@sound("skyline.drop", ["skyline.drop"], "a block landing on the tower: a solid clank over a thud")
def _(r):
    n = n_of(0.24)
    clank = struck(METAL, 330, 0, 0.2, n, r, 0.01) * 0.55
    thud = thump(140, 80, 0.09, n) * 0.6 + click(n, r, 3500) * 0.15
    return room(clank + thud, r, 0.12, 0.12)


@sound("skyline.streakDrop", ["skyline.streakDrop"], "a perfect drop: the clank with a bright ring on top")
def _(r):
    n = n_of(0.3)
    base = struck(METAL, 330, 0, 0.14, n, r) * 0.4 + thump(140, 80, 0.05, n) * 0.55
    ring = struck(BELL, 1318.5, 0, 0.24, n, r) * 0.35
    return room(base + ring, r, 0.12, 0.12)


@sound("skyline.miss", ["skyline.miss"], "a block missing the tower: a falling whistle and a distant thud")
def _(r):
    n = n_of(0.42)
    whistle = sine(glide(1400, 500, n_of(0.3), 1.0), n_of(0.3)) * env(n_of(0.3), 0.02, 0.3, 0.1) * 0.3
    thud = at(thump(100, 55, 0.08, n_of(0.14)) * 0.6 + struck(STONE, 160, 0, 0.06, n_of(0.14), r) * 0.25, 0.27, n)
    return room(mix(whistle, thud), r, 0.16, 0.16)


@sound("homerun.swing", ["homerun.swing"], "the bat swung: a fast, clean whoosh")
def _(r):
    n = n_of(0.17)
    w = svf(noise(n, r), glide(700, 2600, n, 0.7), 2.2) * env(n, 0.03, 0.12)
    return w * 0.8


@sound("freekick.net", ["freekick.net"], "the ball in the net: a soft rope swish")
def _(r):
    n = n_of(0.32)
    sw = svf(noise(n, r), glide(1800, 900, n), 1.2) * env(n, 0.006, 0.26) * 0.6
    rope = sw * (0.75 + 0.25 * np.sin(TAU * 32 * tt(n)))
    return room(rope + thump(160, 110, 0.05, n) * 0.25, r, 0.12, 0.1)


@sound("racing.sector", ["racing.sector"], "a clean sector: a short, bright timing chime")
def _(r):
    n = n_of(0.22)
    a = (sine(1567.98, n) + 0.3 * sine(3135.96, n)) * env(n, 0.002, 0.16) * 0.4
    b = at((sine(2093.0, n_of(0.18)) + 0.3 * sine(4186, n_of(0.18))) * env(n_of(0.18), 0.002, 0.17) * 0.4, 0.06, n)
    return room(mix(a, b), r, 0.1, 0.1)


@sound("racing.grass", ["racing.grass"], "off onto the gravel: a gritty rumble")
def _(r):
    n = n_of(0.22)
    grit = svf(noise(n, r), 1100, 0.8) * env(n, 0.01, 0.18) * 0.6
    rum = svf(noise(n, r), 180, 1.0, "lp") * env(n, 0.01, 0.18) * 1.0
    return (grit + rum) * (0.7 + 0.3 * np.sign(np.sin(TAU * 40 * tt(n))))


@sound("inkbridge.draw", ["inkbridge.draw"], "a rainbow drawn: a soft glissando of sine tones with a shimmer")
def _(r):
    n = n_of(0.45)
    f = glide(523.25, 1567.98, n, 0.8)
    gl = (sine(f, n) + 0.4 * sine(f * 1.5, n)) * env(n, 0.03, 0.4, 0.05) * 0.35
    sh = tri(f * 2, n) * env(n, 0.05, 0.35) * 0.08
    return room(gl + sh, r, 0.2, 0.2)


@sound("inkbridge.pot", ["inkbridge.pot"], "the coin in the pot: a bright clink and a little cascade of bells")
def _(r):
    n = n_of(0.7)
    clink = struck(METAL, 2400, 0, 0.18, n, r) * 0.4 + click(n, r, 6000) * 0.3
    notes = [1318.5, 1568.0, 2093.0]
    bells = [at(struck(BELL, f, 0, 0.4, n_of(0.5), r) * 0.35, 0.05 + 0.07 * i, n) for i, f in enumerate(notes)]
    return room(mix(clink, *bells), r, 0.2, 0.18)


@sound("inkbridge.bump", ["inkbridge.bump"], "the ball bouncing off the ink: a soft, round boing")
def _(r):
    n = n_of(0.16)
    f = glide(260, 420, n, 0.4)
    return room(sine(f, n) * env(n, 0.002, 0.13) * 0.6 + thump(180, 120, 0.03, n) * 0.3, r, 0.08, 0.1)


@sound("tilt.roll", ["tilt.roll"], "a marble rolling on wood: a soft, steady rumble (loop)", loop=True)
def _(r):
    body = n_of(1.2 + 0.15)
    t = tt(body)
    rum = svf(noise(body, r), 260, 1.4) * 1.0 + svf(noise(body, r), 1100, 2.0) * 0.18
    rum *= 0.8 + 0.2 * np.sin(TAU * 5 * t)
    return make_loop(rum, 0.15)


@sound("tilt.caught", ["tilt.caught"], "a marble dropping into a hole: a clack and a hollow fall")
def _(r):
    n = n_of(0.24)
    clack = struck(GLASS, 1500, 0, 0.05, n, r) * 0.5 + click(n, r, 5000) * 0.3
    fall = at(modes(240, [1, 2.2], [0.1, 0.06], [1, 0.3], n_of(0.14), r) * 0.6, 0.07, n)
    return room(mix(clack, fall), r, 0.1, 0.12)


@sound("tilt.mazeDone", ["tilt.mazeDone"], "a maze done: a warm three-note wooden chime")
def _(r):
    n = n_of(0.36)
    notes = [783.99, 987.77, 1174.66]
    parts = [at(struck(WOOD, f, 0, 0.16, n_of(0.22), r) * 0.5 + sine(f, n_of(0.22)) * env(n_of(0.22), 0.002, 0.2) * 0.25, 0.06 * i, n)
             for i, f in enumerate(notes)]
    return room(mix(*parts), r, 0.14, 0.14)


@sound("tilt.cup", ["tilt.cup"], "a marble home in its cup: a wooden thunk with a short rattle")
def _(r):
    n = n_of(0.2)
    thunk = struck(WOOD, 360, 0, 0.09, n, r) * 0.7 + thump(200, 150, 0.04, n) * 0.4
    rattle = sum(at(struck(GLASS, 1700 + 120 * i, 0, 0.03, n_of(0.05), r) * (0.3 - 0.07 * i), 0.03 + 0.03 * i, n) for i in range(3))
    return room(thunk + rattle, r, 0.09, 0.1)


@sound("tilt.gate", ["tilt.gate"], "a gate swinging: a light wooden click")
def _(r):
    n = n_of(0.1)
    return room(struck(WOOD, 980, 0, 0.09, n, r) * 0.6 + click(n, r, 4500) * 0.2, r, 0.07, 0.1)


@sound("tilt.knock", ["tilt.knock"], "the marble against a wall: a short wood knock")
def _(r):
    n = n_of(0.09)
    return room(struck(WOOD, 640, 0, 0.09, n, r) * 0.7 + click(n, r, 3000) * 0.12, r, 0.06, 0.08)


@sound("bubble.waves", ["bubble.waves"], "a calm sea under the reef: slow swells of filtered noise (loop)", loop=True)
def _(r):
    body = n_of(2.4 + 0.3)
    t = tt(body)
    swell = 0.55 + 0.45 * np.sin(TAU * t / 2.4 - np.pi / 2) ** 2
    sea = svf(noise(body, r), 500 + 300 * swell, 0.9, "lp") * swell * 0.9
    fizz = svf(noise(body, r), 3500, 1.2) * swell * 0.05
    return make_loop(sea + fizz, 0.3)


@sound("bubble.load", ["bubble.load"], "a bubble loaded: a round, rising bloop")
def _(r):
    n = n_of(0.12)
    return room(sine(glide(300, 620, n, 0.5), n) * env(n, 0.003, 0.1) * 0.6, r, 0.08, 0.12)


@sound("bubble.pop", ["bubble.pop"], "a bubble popped: a small wet pop")
def _(r):
    n = n_of(0.08)
    p = sine(glide(900, 1700, n, 0.4), n) * env(n, 0.001, 0.05) * 0.5
    return p + click(n, r, 5000) * 0.3


@sound("balltrack.roll", ["balltrack.roll"], "marbles running through a tube: a hollow, steady roll (loop)", loop=True)
def _(r):
    body = n_of(1.2 + 0.15)
    t = tt(body)
    tube = svf(noise(body, r), 420, 3.0) * 0.8 + svf(noise(body, r), 1300, 4.0) * 0.25
    tube *= 0.8 + 0.2 * np.sin(TAU * 7 * t)
    return make_loop(tube, 0.15)


@sound("balltrack.marbleHome", ["balltrack.marbleHome"], "a marble home: a glassy clink into its slot")
def _(r):
    n = n_of(0.17)
    return room(struck(GLASS, 1900, 0, 0.12, n, r) * 0.55 + click(n, r, 6000) * 0.3, r, 0.08, 0.12)


@sound("balltrack.wrong", ["balltrack.wrong"], "a marble in the wrong cup: a dull, low clunk")
def _(r):
    n = n_of(0.13)
    return room(struck(WOOD, 220, 0, 0.07, n, r) * 0.6 + thump(150, 95, 0.05, n) * 0.5, r, 0.06, 0.08)


@sound("balltrack.switch", ["balltrack.switch"], "a track switched: a click-clack")
def _(r):
    n = n_of(0.11)
    a = struck(WOOD, 1200, 0, 0.035, n, r) * 0.5 + click(n, r, 5000) * 0.35
    b = at(struck(WOOD, 900, 0, 0.04, n_of(0.07), r) * 0.5 + click(n_of(0.07), r, 4500) * 0.3, 0.035, n)
    return mix(a, b)


@sound("bastion.dry", ["bastion.dry"], "a dry fire: an empty mechanical click")
def _(r):
    n = n_of(0.11)
    a = click(n, r, 3500) * 0.45 + modes(1650, [1, 2.7], [0.06, 0.04], [1, 0.4], n, r) * 0.35
    b = at(click(n_of(0.05), r, 2500) * 0.4, 0.04, n)
    return room(mix(a, b), r, 0.05, 0.08)


# --------------------------------------------------------------------------------------------------- build


def target_lufs(secs, loop):
    if loop:
        return LOOP_LUFS
    return next(t for d, t in EFFECT_BY_LEN if secs < d)


def build(name, outdir):
    fn, loop, slots, what = RECIPES[name]
    r = rng_for(name)
    x = np.asarray(fn(r), float)
    x = x - x.mean() if loop else x
    x = norm(x) * 0.5
    if not loop:
        x = trim_tail(x)
        x[: n_of(0.001)] *= np.linspace(0, 1, n_of(0.001))
    secs = len(x) / SR
    goal = target_lufs(secs, loop)
    m = x[:, None]
    meter = (lambda d: np.tile(d, (2, 1))) if loop else (lambda d: d)
    lufs_in, _ = fix.ebur(meter(m), SR)
    gain = goal - lufs_in
    path = os.path.join(outdir, f"{name}.mp3")
    limited = False

    def render(g, lim):
        y = m * 10 ** (g / 20)
        if lim:
            y = fix.limit(y, SR)
        fix.write(path, y, SR, SR, 96, loop)
        lo, tp_ = fix.ebur(meter(fix.load(path)[0]), SR)
        return lo, tp_

    def transparent(g):
        y = m * 10 ** (g / 20)
        return fix.distortion_db(y, fix.limit(y, SR)) <= -fix.MAX_DISTORTION

    for it in range(10):
        lufs_o, tp = render(gain, limited)
        if tp > TP_MAX:
            if not limited and transparent(gain):
                limited = True
                continue
            gain -= tp - TP_MAX + 0.05
            continue
        short = goal - lufs_o
        if short > 0.2 and it < 9:
            step = short if limited else min(short, TP_MAX - tp - 0.05)
            if step <= 0.1 and not limited and transparent(gain + short):
                limited, step = True, short
            if step > 0.1 and (not limited or transparent(gain + step)):
                gain += step
                continue
        break
    else:
        render(gain, limited)
    dec = fix.load(path)[0]
    lufs_out, tp = fix.ebur(np.tile(dec, (2, 1)) if loop else dec, SR)
    return {"file": f"{name}.mp3", "slots": slots, "what": what, "loop": loop, "ms": round(len(dec) / SR * 1000),
            "bytes": os.path.getsize(path), "lufs": round(lufs_out, 1), "target": goal, "truePeak": round(tp, 1),
            "limited": limited}


def recorded_files(root):
    """The slots Joe has since recorded (his sound batches, docs/sound-cues/sounds-batch-*.csv, cut and levelled by
    scripts/sound-batch-1/process.py and scripts/sound-batch-2/process.py): their files are his recordings, so this
    script never overwrites them and only measures them for the data file. A row marked TO RECORD has no file yet."""
    import csv, glob
    out = set()
    for path in sorted(glob.glob(os.path.join(root, "docs", "sound-cues", "sounds-batch-*.csv"))):
        out |= {r["file"] for r in csv.DictReader(open(path, newline="")) if not r.get("note", "").startswith("TO RECORD")}
    return out


def measured(name, outdir):
    """A recorded file's row, measured as build() measures its own."""
    _, loop, slots, what = RECIPES[name]
    path = os.path.join(outdir, f"{name}.mp3")
    dec = fix.load(path)[0]
    lufs_out, tp = fix.ebur(np.tile(dec, (2, 1)) if loop else dec, SR)
    secs = len(dec) / SR
    return {"file": f"{name}.mp3", "slots": slots, "what": what.removeprefix("placeholder: "), "loop": loop,
            "ms": round(secs * 1000), "bytes": os.path.getsize(path), "lufs": round(lufs_out, 1),
            "target": target_lufs(secs, loop), "truePeak": round(tp, 1), "limited": None}


def main():
    root = os.path.abspath(os.path.join(HERE, "..", ".."))
    outdir = sys.argv[1] if len(sys.argv) > 1 else os.path.join(root, "public", "sounds")
    report = sys.argv[2] if len(sys.argv) > 2 and sys.argv[2] != "-" else None
    only = set(sys.argv[3].split(",")) if len(sys.argv) > 3 else None
    rows = []
    recorded = recorded_files(root)
    for name in RECIPES:
        if only and name not in only:
            continue
        row = measured(name, outdir) if f"{name}.mp3" in recorded else build(name, outdir)
        rows.append(row)
        print(f"{row['file']:34} {row['ms']:5} ms {row['bytes']:6} B {row['lufs']:6} LUFS (target {row['target']}) tp {row['truePeak']}")
    if report:
        json.dump(rows, open(report, "w"), indent=1)
    if only is None and os.path.abspath(outdir) == os.path.join(root, "public", "sounds"):
        write_data(rows, os.path.join(root, "src", "lib", "fx", "newGameSounds.data.ts"))


def write_data(rows, path):
    """The recordings for src/lib/fx/newGameSounds.ts (and /dev-design's Sounds), in RECIPES order."""
    lines = ["// Generated by scripts/sound-review-nov-2026/make.py (python3 -I scripts/sound-review-nov-2026/make.py): do not edit.",
             "// Each recording, the manifest slots it plays for once NEW_GAME_SOUNDS is on (src/config/soundConfig.ts), its",
             "// exact length (ms), size (bytes), loudness (LUFS, ebur128 with 1 s of silence either side; loops measured twice",
             "// through), its length's library target and its true peak (dBFS).",
             "export const NEW_GAME_SOUND_RECORDINGS = ["]
    for r in rows:
        slots = ", ".join(json.dumps(x) for x in r["slots"])
        lines.append(f'  {{ file: {json.dumps(r["file"])}, slots: [{slots}], ms: {r["ms"]}, bytes: {r["bytes"]}, lufs: {r["lufs"]}, '
                     f'target: {r["target"]}, truePeak: {r["truePeak"]}, loop: {"true" if r["loop"] else "false"}, what: {json.dumps(r["what"])} }},')
    lines.append("] as const;")
    open(path, "w").write("\n".join(lines) + "\n")


if __name__ == "__main__":
    main()
