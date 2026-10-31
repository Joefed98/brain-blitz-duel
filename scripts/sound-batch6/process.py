"""Trim, loop, level and encode the new sounds. Usage: python3 -I process.py <src dir> <out dir> <report.json>"""
import subprocess, sys, csv, json, os, tempfile
import numpy as np

SR = 44100
LIB_RMS100 = -13.8  # the library's median loudest-100 ms RMS (dBFS)
EFFECT_PEAK = -1.0
MUSIC_LUFS = -18.0
STEREO_LOOPS = {"sports_crowd_loop", "racing_idle_loop", "racing_drive_loop"}


def load(p, ch=2):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", p, "-f", "f32le", "-ac", str(ch), "-ar", str(SR), "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, ch).astype(np.float64)


def db(v):
    return 20 * np.log10(max(v, 1e-12))


def rms100(x):
    m = x.mean(1) if x.ndim == 2 else x
    n = int(SR * 0.1)
    if len(m) < n:
        return 10 * np.log10((m ** 2).mean() + 1e-12)
    c = np.cumsum(np.concatenate([[0], m ** 2]))
    return 10 * np.log10(((c[n:] - c[:-n]) / n).max() + 1e-12)


def to_mono(x):
    l, r = x[:, 0], x[:, 1]
    corr = np.corrcoef(l, r)[0, 1] if l.std() > 0 and r.std() > 0 else 1
    # A phase-inverted pair would cancel in a plain sum: flip one side first.
    return ((l - r) if corr < -0.3 else (l + r)) / 2


def lufs(x):
    with tempfile.NamedTemporaryFile(suffix=".wav") as t:
        write_wav(t.name, x)
        out = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", t.name, "-af", "ebur128=peak=true", "-f", "null", "-"],
                             capture_output=True, text=True).stderr
    summ = out[out.rfind("Summary:"):]
    i = float(summ.split("I:")[1].split("LUFS")[0])
    return i


def write_wav(path, x):
    ch = 1 if x.ndim == 1 else x.shape[1]
    data = np.clip(x, -1, 1).astype(np.float32).tobytes()
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ac", str(ch), "-ar", str(SR), "-i", "-", path],
                   input=data, check=True)


def encode(path, x, stereo):
    ch = 2 if stereo else 1
    data = np.clip(x, -1, 1).astype(np.float32).tobytes()
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ac", str(ch), "-ar", str(SR), "-i", "-",
                    "-c:a", "libmp3lame", "-b:a", "128k" if stereo else "96k", "-ar", str(SR), "-map_metadata", "-1",
                    "-id3v2_version", "0", "-write_xing", "1", path], input=data, check=True)


def env(x, win):
    """Per-sample-block peak envelope (dB) of a mono or stereo signal."""
    m = np.abs(x).max(1) if x.ndim == 2 else np.abs(x)
    k = len(m) // win
    return np.array([db(v) for v in m[:k * win].reshape(k, win).max(1)])


OVER_S = 0.15  # an effect may run this far past its budget to keep its body whole


def onset(x, pk_db):
    """The first sample within 24 dB of the peak, less 3 ms: quiet pre-roll before the transient goes."""
    m = np.abs(x).max(1) if x.ndim == 2 else np.abs(x)
    above = np.nonzero(m > 10 ** ((pk_db - 24) / 20))[0]
    return max(0, above[0] - int(0.003 * SR)) if len(above) else 0


def effect(x, want_s, stereo):
    y = x if stereo else to_mono(x)
    pk = db(np.abs(y).max())
    start = onset(y, pk)
    y = y[start:]
    win = int(0.005 * SR)
    e = env(y, win)
    pk = e.max()
    natural = (len(e) - np.argmax(e[::-1] > pk - 50)) * win  # the tail has decayed 50 dB
    body = (len(e) - np.argmax(e[::-1] > pk - 20)) * win  # the sound's body: within 20 dB of its peak
    fade = int(0.04 * SR)
    want = int(want_s * SR)
    # The body and its fade, at least the budget (unless the sound itself is shorter), at most OVER_S past it.
    end = min(max(body + fade, min(want, natural)), want + int(OVER_S * SR), natural, len(y))
    y = y[:end].copy()
    n = min(fade, len(y) // 2)
    ramp = np.cos(np.linspace(0, np.pi / 2, n)) ** 2
    y[-n:] = (y[-n:].T * ramp).T
    m = min(int(0.003 * SR), len(y))  # a 3 ms fade-in: no click, no audible delay
    y[:m] = (y[:m].T * np.linspace(0, 1, m)).T
    # Level: peaks to -1 dBFS, but never more than 2 dB above the library's median loudness.
    g = min(EFFECT_PEAK - db(np.abs(y).max()), LIB_RMS100 + 2 - rms100(y))
    return y * 10 ** (g / 20), start / SR


def best_loop(m, lo, hi, w, ref=0):
    """The cut L in [lo, hi) whose following w samples best match those at ref (normalised cross-correlation)."""
    a = m[ref:ref + w]
    a = (a - a.mean()) / (a.std() + 1e-12)
    best, score = hi - 1, -2.0
    step = 1
    # Coarse pass on a 2 ms grid, then refine sample by sample.
    for L in range(lo, hi, int(0.002 * SR)):
        b = m[L:L + w]
        if len(b) < w:
            break
        s = float(np.dot(a, (b - b.mean()) / (b.std() + 1e-12))) / w
        if s > score:
            best, score = L, s
    for L in range(max(lo, best - int(0.002 * SR)), min(hi, best + int(0.002 * SR))):
        b = m[L:L + w]
        if len(b) < w:
            continue
        s = float(np.dot(a, (b - b.mean()) / (b.std() + 1e-12))) / w
        if s > score:
            best, score = L, s
    return best, score


def spectral_frames(m, hop=512, n=2048):
    k = (len(m) - n) // hop
    idx = np.arange(n)[None, :] + hop * np.arange(k)[:, None]
    f = np.abs(np.fft.rfft(m[idx] * np.hanning(n), axis=1))
    # 24 log-spaced bands, log magnitude: a coarse timbre/harmony fingerprint.
    edges = np.unique(np.geomspace(2, f.shape[1] - 1, 25).astype(int))
    bands = np.stack([f[:, a:b].sum(1) for a, b in zip(edges[:-1], edges[1:])], 1)
    v = np.log1p(bands * 10)
    return v / (np.linalg.norm(v, axis=1, keepdims=True) + 1e-12)


def make_loop(x, stereo, music):
    y = x if stereo else to_mono(x)
    mono = y.mean(1) if y.ndim == 2 else y
    N = len(mono)
    if music:
        # Keep clear of an ending fade: the loop must close where the bed still plays at full level.
        win = int(0.5 * SR)
        r = np.array([np.sqrt((mono[i:i + win] ** 2).mean()) for i in range(0, N - win, win)])
        full = np.median(r)
        last_full = (len(r) - np.argmax(r[::-1] > full * 10 ** (-3 / 20))) * win
        hop = 512
        F = spectral_frames(mono)
        span = int(4 * SR / hop)  # compare 4 s after the cut with the bed's first 4 s
        ref = F[:span]
        lo = int(N * 0.6 / hop)
        hi = min(len(F) - span, int((last_full - 0.5 * SR) / hop))
        hi = max(hi, lo + 1)
        scores = []
        for k in range(lo, hi):
            scores.append(float((F[k:k + span] * ref).sum(1).mean()))
        scores = np.array(scores)
        # Prefer a longer loop among near-best matches (within 0.5 % of the best score).
        good = np.nonzero(scores >= scores.max() - 0.005)[0]
        k = lo + good.max()
        coarse = k * hop
        L, xc = best_loop(mono, max(0, coarse - 1024), coarse + 1024, int(0.03 * SR))
        spec = float(scores[good.max()])
        xf = int(0.04 * SR)
    else:
        w = min(int(0.05 * SR), N // 8)
        xf = min(int((0.25 if N > 5 * SR else 0.12) * SR), N // 6)
        lw = int(0.1 * SR)
        c = np.cumsum(np.concatenate([[0], mono ** 2]))

        def level(a, b):
            return 10 * np.log10((c[b] - c[a]) / max(1, b - a) + 1e-12)

        # Loop [s0, L): the waveform after L should match the one at s0, and the level just before the join
        # should match the level the loop settles to after its crossfade (no jump either way).
        best = None
        for s0 in range(0, int(N * 0.25), int(0.02 * SR)):
            L, xc = best_loop(mono, max(s0 + int(N * 0.6), int(N * 0.75) - xf), N - xf, w, ref=s0)
            jump = abs(level(L - lw, L) - level(s0 + xf, s0 + xf + lw))
            score = xc - jump / 6 + 0.5 * (L - s0) / N  # and, all else equal, the longer loop
            if best is None or score > best[0]:
                best = (score, s0, L, xc)
        _, s0, L, xc = best
        y = y[s0:]
        mono = mono[s0:]
        L -= s0
        spec = None
    # Snap to the nearest zero crossing (upward, like the head's first sample) within 2 ms.
    seg = mono[max(0, L - 88):L + 88]
    zc = np.nonzero((seg[:-1] <= 0) & (seg[1:] > 0))[0]
    if len(zc):
        L = max(0, L - 88) + zc[np.argmin(np.abs(zc - min(88, L)))] + 1
    head = y[:xf].copy()
    tail = y[L:L + xf]
    t = np.linspace(0, 1, xf)
    if xc > 0.5:  # correlated material: equal-gain crossfade
        fi, fo = t, 1 - t
    else:  # noise-like material: equal-power crossfade
        fi, fo = np.sin(t * np.pi / 2), np.cos(t * np.pi / 2)
    blended = (head.T * fi).T + (tail.T * fo).T
    out = np.concatenate([blended, y[xf:L]])
    return out, {"cut_s": round(L / SR, 3), "xcorr": round(xc, 3), "spectral": None if spec is None else round(spec, 4),
                 "crossfade_ms": round(xf / SR * 1000)}


def main():
    src, out_dir, report = sys.argv[1:4]
    rows = list(csv.DictReader(open(os.path.join(src, "new-sounds-mapping.csv"))))
    result = []
    for r in rows:
        slot, loop = r["slot"], r["loop"].strip().lower() == "yes"
        music = slot.startswith("music_")
        stereo = music or slot in STEREO_LOOPS
        x = load(os.path.join(src, r["file"]))
        before = len(x) / SR
        info = {}
        if loop:
            y, info = make_loop(x, stereo, music)
            if music:
                y = y * 10 ** ((MUSIC_LUFS - lufs(y)) / 20)
                over = db(np.abs(y).max()) - (-1.0)
                if over > 0:  # a bed whose peaks would pass -1 dBFS at -18 LUFS is turned down instead
                    y = y * 10 ** (-over / 20)
            else:
                # Loops sit under the music at 0.2-0.35: level them like the effects, by loudness only.
                g = min(EFFECT_PEAK - db(np.abs(y).max()), LIB_RMS100 + 2 - rms100(y))
                y = y * 10 ** (g / 20)
        else:
            y, cut = effect(x, float(r["length_s"]), stereo)
            info["lead_cut_ms"] = round(cut * 1000)
        dst = os.path.join(out_dir, f"{slot}.mp3")
        encode(dst, y, stereo)
        # MP3 encoding can push a peak past the PCM's: decode, and turn the file down until it sits at -1 dBFS or under.
        for _ in range(3):
            over = db(np.abs(load(dst, 2 if stereo else 1)).max()) - (-1.0)
            if over <= 0:
                break
            y = y * 10 ** (-(over + 0.1) / 20)
            encode(dst, y, stereo)
        result.append({"slot": slot, "file": r["file"], "games": r["game"], "event": r["event"], "budget_s": float(r["length_s"]),
                       "loop": loop, "stereo": stereo, "before_s": round(before, 3), **info})
        print(slot, round(before, 2), "->", round(len(y) / SR, 3), info, flush=True)
    json.dump(result, open(report, "w"), indent=1)


main()
