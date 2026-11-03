"""Re-cut Joe's Nov 2026 recordings from the originals (sounds-nov-2026 branch, commit f19a6876) and level them to the
library. Usage: python3 -I process.py <originals dir> <out dir> <report.json>

Why (3 Nov 2026 fix-up): the first wiring cut the attack off many effects (a leading-silence trim that kept the tail)
and left every file at its upload level, 20-35 dB under the library on some, while four of the beds sat 4-7 dB over the
library's beds. Here:
- effects: only true digital silence is trimmed (under -60 dBFS), keeping at least 10 ms before the first sound; the
  tail is kept until it falls under -60 dBFS after levelling; then levelled to the library's median effect loudness
  (LIB_EFFECT_LUFS, measured by measure.py on every effect file already wired) with peaks at most -1 dBFS after encoding;
- the three effect loops: the upload's own 2 s loop untouched (it already joins cleanly), levelled to the library's
  median loop loudness;
- music beds: cut on the bar whose next 4 s best match the bed's opening (batch 6's make_loop) where the upload ends on a
  fade, so the bed loops without a dip; levelled to the library's median bed loudness;
- voice lines: the same silence trim (10 ms lead, 60 ms tail), levelled to the existing voice lines' median.
"""
import subprocess, sys, json, os, tempfile
import numpy as np

SR = 44100
SILENCE = 10 ** (-60 / 20)
PEAK = -1.0
# Library medians (measure.py: integrated LUFS, 1 s of silence padded either side), 3 Nov 2026, the files wired before
# this batch: 253 effects, 11 effect loops, 14 beds, 5 voice lines.
LIB_EFFECT_LUFS = -17.2
# Short sounds read lower on a gated 400 ms measure, so each effect is matched to the library's effects of its length.
LIB_EFFECT_LUFS_BY_LEN = ((0.25, -22.7), (0.5, -17.5), (0.9, -17.1), (99, -16.5))
LIMIT = -1.5  # the limiter's ceiling (dBFS), under the -1 dBFS peak rule so the MP3's overshoot stays under it
ATTACK, RELEASE = 0.5, 5  # ms
MAX_DISTORTION = 14  # dB: the limiter may shave at most this far under the sound
LIB_LOOP_LUFS = -16.8
LIB_MUSIC_LUFS = -18.45
LIB_VOICE_LUFS = -23.8

VOICE = {"clean_sweep.mp3": "voice.cleanSweep", "draw.mp3": "voice.draw", "new_best.mp3": "voice.newBest",
         "new_leader.mp3": "voice.newLeader", "photo_finish.mp3": "voice.photoFinish", "round_8.mp3": "round8",
         "round_9.mp3": "round9", "round_10.mp3": "round10", "round_11.mp3": "round11"}
LOOPS = {"bastion.drone", "ricochet.lanternRide", "alleyroll.rolling"}


def channels(p):
    return int(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=channels", "-of", "csv=p=0", p],
                              capture_output=True, text=True, check=True).stdout.split()[0])


def load(p, ch=None):
    """Decoded samples in the file's own channel count (ffmpeg's mono-to-stereo upmix is 3 dB down, so never upmix)."""
    ch = ch or channels(p)
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", p, "-f", "f32le", "-ac", str(ch), "-ar", str(SR), "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, ch).astype(np.float64)


def db(v):
    return 20 * np.log10(max(v, 1e-12))


def to_mono(x):
    l, r = x[:, 0], x[:, 1]
    corr = np.corrcoef(l, r)[0, 1] if l.std() > 0 and r.std() > 0 else 1
    return ((l - r) if corr < -0.3 else (l + r)) / 2


def write(path, x, codec=None):
    ch = 1 if x.ndim == 1 else x.shape[1]
    data = np.clip(x, -1, 1).astype(np.float32).tobytes()
    args = ["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ac", str(ch), "-ar", str(SR), "-i", "-"]
    if codec:
        args += ["-c:a", "libmp3lame", "-b:a", codec, "-ar", str(SR), "-map_metadata", "-1", "-id3v2_version", "0",
                 "-write_xing", "1"]
    subprocess.run(args + [path], input=data, check=True)


def lufs_array(x):
    """Integrated loudness (ebur128) with 1 s of digital silence either side, so a sound under 400 ms still gets a gated
    block. Mono is measured as one channel, as ebur128 does."""
    x = x if x.ndim == 2 else x[:, None]
    pad = np.zeros((SR, x.shape[1]))
    data = np.concatenate([pad, x, pad]).astype(np.float32).tobytes()
    out = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-f", "f32le", "-ac", str(x.shape[1]), "-ar", str(SR), "-i", "-",
                          "-af", "ebur128", "-f", "null", "-"], input=data, capture_output=True).stderr.decode()
    s = out[out.rfind("Summary:"):]
    return float(s.split("I:")[1].split("LUFS")[0])


def lufs_file(path):
    return lufs_array(load(path))


def lufs(x):
    return lufs_array(x)


def trim(x, tail_s):
    """Trim true digital silence only: keep 10 ms before the first sample over -60 dBFS and tail_s after the last."""
    a = np.abs(x).max(1) if x.ndim == 2 else np.abs(x)
    idx = np.nonzero(a > SILENCE)[0]
    if not len(idx):
        return x, 0
    s = max(0, idx[0] - int(0.010 * SR))
    e = min(len(x), idx[-1] + 1 + int(tail_s * SR))
    y = x[s:e].copy()
    if e < len(x):  # cut inside the quiet tail: a short fade so the cut never clicks
        n = min(int(0.010 * SR), len(y) // 4)
        y[-n:] = (y[-n:].T * np.linspace(1, 0, n)).T
    return y, s


def limit(x):
    """A fast lookahead peak limiter (ffmpeg alimiter) at LIMIT dBFS: it shaves the sub-millisecond spikes these recordings
    open with and lets go within a few ms, so the body after the spike is not ducked."""
    with tempfile.TemporaryDirectory() as d:
        a, b = os.path.join(d, "a.wav"), os.path.join(d, "b.wav")
        ch = 1 if x.ndim == 1 else x.shape[1]
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ac", str(ch), "-ar", str(SR), "-i", "-",
                        "-c:a", "pcm_f32le", a], input=x.astype(np.float32).tobytes(), check=True)
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", a, "-af",
                        f"apad=pad_dur=0.05,alimiter=limit={10 ** (LIMIT / 20):.5f}:attack={ATTACK}:release={RELEASE}:level=false:latency=true",
                        "-c:a", "pcm_f32le", b], check=True)
        y = load(b)[:len(x)]
        return y[:, 0] if x.ndim == 1 else y


def distortion_db(lin, lim):
    """How much of the signal the limiter changed, in dB under the signal."""
    return 10 * np.log10(((lin - lim) ** 2).sum() / max((lin ** 2).sum(), 1e-20) + 1e-20)


def encode_level(y, target, codec, path):
    """Encode, then correct the encoded file's loudness to the target (MP3 shifts it a little) and its peak to -1 dBFS
    or under: up only as far as the peak allows, down whenever the peak passes it."""
    write(path, y, codec)
    for _ in range(10):
        dec = load(path)
        up = target - lufs(dec)
        room = PEAK - 0.05 - db(np.abs(dec).max())
        step = min(up, room)
        if abs(step) < 0.1 or (0 < step < 0.3 and room < 0.3):
            break
        y = y * 10 ** (step / 20)
        write(path, y, codec)
    for _ in range(6):  # the peak rule always wins
        over = db(np.abs(load(path)).max()) - PEAK
        if over <= 0:
            break
        y = y * 10 ** (-(over + 0.05) / 20)
        write(path, y, codec)
    return y


def level(x, target, codec, path, limited=False):
    """Gain to the target loudness with peaks at most -1 dBFS in the encoded file. Without the limiter (music, voice)
    the gain stops at the peak. With it (effects and their loops) a peak-bound sound is lifted towards the target
    through the fast limiter, but only while the limiter stays transparent (what it shaves at least MAX_DISTORTION dB
    under the sound); past that the file stays short of the target and the report says by how much."""
    level.reduction = 0.0
    full = target - lufs(x)
    plain = min(full, LIMIT - db(np.abs(x).max()))
    y = x * 10 ** (plain / 20)
    if limited and full > plain + 0.1:
        lo, hi = plain, full
        best = None
        for i in range(12):  # the largest gain at which the limiter stays transparent: the full gain, else bisect
            g = hi if i == 0 else (lo + hi) / 2
            lin = x * 10 ** (g / 20)
            lim = limit(lin)
            if distortion_db(lin, lim) <= -MAX_DISTORTION:
                best, lo = (g, lim), g
            else:
                hi = g
            if hi - lo < 0.1:
                break
        if best is not None:
            y = best[1]
            level.reduction = max(0.0, db(np.abs(x).max()) + best[0] - db(np.abs(y).max()))
    return encode_level(y, target, codec, path)


def ends_on_fade(x):
    m = x.mean(1)
    b = int(0.5 * SR)
    r = [10 * np.log10((m[i:i + b] ** 2).mean() + 1e-12) for i in range(0, len(m) - b, b)]
    return r[-1] < np.median(r) - 6


def make_music_loop(x):
    # batch 6's music loop: the bar whose next 4 s best match the bed's opening, a 40 ms crossfade.
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "sound-batch6", "process.py")
    ns = {"__name__": "b6"}
    exec(compile(open(path).read().replace("\nmain()\n", "\n"), path, "exec"), ns)
    return ns["make_loop"](x, True, True)


def main():
    src, out_dir, report = sys.argv[1:4]
    only = set(sys.argv[4].split(",")) if len(sys.argv) > 4 else None
    rows = []
    for name in sorted(os.listdir(src)):
        if not name.endswith(".mp3"):
            continue
        slot = VOICE.get(name, name[:-4])
        if only and slot not in only:
            continue
        x = load(os.path.join(src, name))
        dst = os.path.join(out_dir, slot + ".mp3")
        info = {"slot": slot, "source": name}
        if slot in VOICE.values():
            y, cut = trim(x, 0.06)
            info.update(kind="voice", lead_cut_ms=round(cut / SR * 1000, 1))
            level(y, LIB_VOICE_LUFS, "192k", dst)
        elif slot.startswith("music_"):
            if ends_on_fade(x):
                y, loop = make_music_loop(x)
                info.update(kind="music", loop=loop)
            else:
                y = x
                info.update(kind="music", loop="whole file (no ending fade)")
            level(y, LIB_MUSIC_LUFS, "128k", dst)
        elif slot in LOOPS:
            info.update(kind="loop")
            level(to_mono(x), LIB_LOOP_LUFS, "96k", dst, limited=True)
            info.update(target_lufs=LIB_LOOP_LUFS, limiter_db=round(level.reduction, 1))
        else:
            y, cut = trim(to_mono(x), 0.0)
            info.update(kind="effect", lead_cut_ms=round(cut / SR * 1000, 1))
            # Levelled before the tail trim, so the -60 dBFS tail is judged at the file's final level.
            target = next(t for d, t in LIB_EFFECT_LUFS_BY_LEN if len(y) / SR < d)
            g = target - lufs(y)
            y, _ = trim(y * 10 ** (g / 20), 0.0)
            y = y * 10 ** (-g / 20)
            level(y, target, "96k", dst, limited=True)
            info.update(target_lufs=target, limiter_db=round(level.reduction, 1))
        info["after_lufs"] = lufs_file(dst)
        info["after_peak"] = round(db(np.abs(load(dst)).max()), 2)
        rows.append(info)
        print(info, flush=True)
    json.dump(rows, open(report, "w"), indent=1)


main()
