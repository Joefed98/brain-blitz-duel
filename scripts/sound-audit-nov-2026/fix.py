"""The audio audit's file fixes (docs/audit-nov-2026/audio.md, ranked fixes 2, 3, 4, 6, 7, 8 and 10's music_menu) on the
files in public/sounds/. Same file names, same slots; nothing about which sound plays when changes.
Usage: python3 -I fix.py <originals dir> <out dir> <slots.json> <before.json> <report.json> [names,...]

<slots.json> maps each file (no extension) to its manifest slots: {"slots", "vols", "loop", "channel"}.
<before.json> is measure.py's output for the originals (the audit's numbers).

Per file, in this order (docs/sound-cues/audit-fixes-nov-2026.md has the before/after table):
1. Loop joins (fix 4): swing.lava, wavefront.danger, racing_idle_loop and curling_sweep_loop are re-cut so the loop's end
   crossfades into its own opening (equal power; the loop is the crossfade shorter and starts just after it), at the cut
   whose end best matches the opening (waveform correlation, and for curling_sweep_loop the level too).
2. Bed joins (fix 8): music_ricochet, music_cross, music_pool and music_matchup end a phrase quieter than they open, so
   the last bar crossfades into the first (one bar, the bed's own bar length, so the beat stays on the grid): the 4-8 dB
   step every minute becomes a one-bar swell. The bed is a bar shorter and starts on its second bar.
3. Loudness (fixes 2, 6, 10): the targets of docs/sound-cues/levels-nov-2026.md (effects by length -22.7 / -17.5 /
   -17.1 / -16.5 LUFS, effect loops -16.8, beds -18.45, voices -23.8), measured as the audit does (ebur128, 1 s of
   silence either side, the file's own channels). An outlier is more than 3 dB off (effects) or 2 dB (beds, loops,
   voices), both as the file and as its slots play it (the file plus 20 log10 of the slots' median `volume`, so a slot
   turned down on purpose for a hot file is left alone). Outliers go to their target; quiet ones are lifted through
   process.py's transparent fast limiter only while it stays transparent (what it shaves at least 14 dB under the
   sound), else they stop short and the report says so. When a quiet file is lifted more than 6 dB, what was under
   -60 dBFS after its last sound is faded out, so its noise floor isn't lifted with it. Not touched: clay.missPuff
   (-48 LUFS before its 0.5 volume, probably meant faint: Joe to confirm) and music_beat (lifted in code,
   BEAT_TRACK_BOOST).
4. True peaks: every file written ends with a true peak (ebur128, 4x oversampled) at -1 dBFS or under, by plain gain
   (the 20 files over 0 dBFS among them: fix 2).
5. Cut-off tails (fix 3): the effects whose last 10 ms are above -40 dBFS get a fade-out over their last 30 ms (a quarter
   of the file at most), cos^4 so the very end is near silence; nothing is trimmed.
6. Mono (fix 7): stereo one-shot effects whose side channel is at least 15 dB under the mid ((L+R)/2: as played, the
   level changes by under 0.15 dB and the image was already near the centre) become mono, 44.1 kHz 96 kbps. Wider ones,
   loops, ambience, beds and voices stay stereo. A mono buffer plays on both speakers at full level in Web Audio, so it
   is measured as two identical channels to keep it on the same footing as before.
Formats otherwise stay as they were (rate, channels, bitrate), so the batch checks' format rules still hold.
"""
import subprocess, sys, json, os, tempfile
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from measure import probe, rms_db, db  # noqa: E402
import lametag  # noqa: E402

SILENCE = 10 ** (-60 / 20)
TP_MAX = -1.0
EFFECT_BY_LEN = ((0.25, -22.7), (0.5, -17.5), (0.9, -17.1), (99, -16.5))
LOOP_LUFS, MUSIC_LUFS, VOICE_LUFS = -16.8, -18.45, -23.8
LIMIT = -2.2  # the limiter's sample-peak ceiling, low enough that the MP3's true peak stays at -1 dBFS or under
ATTACK, RELEASE = 0.5, 5
MAX_DISTORTION = 14
MONO_SIDE_DB = -15
SKIP_LEVEL = {"clay.missPuff", "music_beat"}
LOOP_RECUT = {"swing.lava": 0.04, "wavefront.danger": 0.04, "racing_idle_loop": 0.04, "curling_sweep_loop": 0.25}
# Bar lengths (s), from each bed's onset autocorrelation and its loop length in whole bars: ricochet 25 bars of 4 x
# 0.6 s (100 bpm), cross 125 beats of 0.48 s (125 bpm, bar 4 beats), pool 72 beats of 0.682 s (88 bpm), matchup 30
# bars of 1.818 s (132 bpm).
BED_BAR = {"music_ricochet": 60.0294 / 25, "music_cross": 60.0294 / 125 * 4, "music_pool": 49.0965 / 18,
           "music_matchup": 54.5448 / 30}
LEVEL_BEDS = {"music_menu"}


def load(p):
    sr, ch, kbps = probe(p)
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", p, "-f", "f32le", "-ac", str(ch), "-ar", str(sr), "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, ch).astype(np.float64), sr, ch, kbps


def as_played(x, basis):
    """A mono buffer plays as two identical channels; measure it so when the file was stereo before."""
    return np.repeat(x, 2, 1) if (x.shape[1] == 1 and basis == 2) else x


def ebur(x, sr):
    pad = np.zeros((sr, x.shape[1]))
    data = np.concatenate([pad, x, pad]).astype(np.float32).tobytes()
    out = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-f", "f32le", "-ac", str(x.shape[1]), "-ar", str(sr),
                          "-i", "-", "-af", "ebur128=peak=true", "-f", "null", "-"], input=data,
                         capture_output=True).stderr.decode()
    s = out[out.rfind("Summary:"):]
    return float(s.split("I:")[1].split("LUFS")[0]), float(s.split("True peak:")[1].split("Peak:")[1].split("dBFS")[0])


ROLL = 1152  # one MP3 frame of the loop's own wrap-around audio either side (see write)


def write(path, x, sr, out_sr, kbps, loop=False):
    """MP3, CBR, with the LAME tag (gapless delay and padding). A loop is encoded with ROLL samples of its own end before
    it and of its own start after it, and the tag's delay and padding are widened by ROLL (at the output rate) so a
    gapless decoder drops them: the encoder sees the real waveform either side of the join instead of silence, so the
    decoded loop joins as the original did (a plain encode adds edge artefacts that tick at the join)."""
    ch = x.shape[1]
    if loop:
        x = np.concatenate([x[-ROLL:], x, x[:ROLL]])
    args = ["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ac", str(ch), "-ar", str(sr), "-i", "-", "-c:a",
            "libmp3lame", "-b:a", f"{kbps}k", "-ar", str(out_sr), "-map_metadata", "-1", "-id3v2_version", "0",
            "-write_xing", "1", path]
    subprocess.run(args, input=np.clip(x, -1, 1).astype(np.float32).tobytes(), check=True)
    if loop:
        roll = round(ROLL * out_sr / sr)
        buf = open(path, "rb").read()
        t = lametag.read(buf)
        open(path, "wb").write(lametag.write(buf, t["delay"] + roll, t["padding"] + roll))


def limit(x, sr):
    with tempfile.TemporaryDirectory() as d:
        a, b = os.path.join(d, "a.wav"), os.path.join(d, "b.wav")
        ch = x.shape[1]
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ac", str(ch), "-ar", str(sr), "-i", "-",
                        "-c:a", "pcm_f32le", a], input=x.astype(np.float32).tobytes(), check=True)
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", a, "-af",
                        f"apad=pad_dur=0.05,alimiter=limit={10 ** (LIMIT / 20):.5f}:attack={ATTACK}:release={RELEASE}:level=false:latency=true",
                        "-c:a", "pcm_f32le", b], check=True)
        raw = subprocess.run(["ffmpeg", "-v", "error", "-i", b, "-f", "f32le", "-ac", str(ch), "-"],
                             capture_output=True, check=True).stdout
        return np.frombuffer(raw, np.float32).reshape(-1, ch).astype(np.float64)[:len(x)]


def distortion_db(lin, lim):
    return 10 * np.log10(((lin - lim) ** 2).sum() / max((lin ** 2).sum(), 1e-20) + 1e-20)


def target_for(name, kind, secs):
    if kind == "music":
        return MUSIC_LUFS, 2.0
    if kind == "voice":
        return VOICE_LUFS, 2.0
    if kind == "loop":
        return LOOP_LUFS, 2.0
    return next(t for d, t in EFFECT_BY_LEN if secs < d), 3.0


def best_cut(m, lo, hi, w):
    """The end L in [lo, hi] whose last w samples best match the first w (normalised correlation)."""
    a = m[:w] - m[:w].mean()
    a /= np.linalg.norm(a) + 1e-12
    best, score = hi, -2.0
    for L in range(lo, hi + 1):
        b = m[L - w:L] - m[L - w:L].mean()
        s = float(np.dot(a, b) / (np.linalg.norm(b) + 1e-12))
        if s > score:
            best, score = L, s
    return best, score


def crossfade_loop(x, L, c, equal_power=True):
    """The loop x[c:L] whose last c samples are x[L-c:L] fading out over x[0:c] fading in: it wraps from (nearly)
    x[c-1] into x[c], the sample that followed it, so the join is the original waveform."""
    t = (np.arange(c) + 0.5) / c
    fi, fo = (np.sin(t * np.pi / 2), np.cos(t * np.pi / 2)) if equal_power else (t, 1 - t)
    blend = (x[L - c:L].T * fo).T + (x[:c].T * fi).T
    return np.concatenate([x[c:L - c], blend])


def recut_loop(name, x, sr):
    c = int(LOOP_RECUT[name] * sr)
    m = x.mean(1)
    N = len(m)
    lo = N - int(0.06 * sr)
    if name == "curling_sweep_loop":
        # The brush strokes come round every ~0.38 s: of the ends within 0.25 s of the file's, take the one whose last
        # 0.4 s is closest in level to the loop's opening (the 5 dB step), waveform match breaking ties.
        lw = int(0.4 * sr)
        ref = rms_db(m[c:c + lw])
        best = None
        for L in range(N - int(0.25 * sr), N + 1, int(0.002 * sr)):
            jump = abs(rms_db(m[L - lw:L]) - ref)
            if best is None or jump < best[0] - 0.05:
                best = (jump, L)
        L, score = best_cut(m, best[1] - int(0.002 * sr), min(N, best[1] + int(0.002 * sr)), min(c, int(0.03 * sr)))
    else:
        L, score = best_cut(m, lo, N, min(c, int(0.03 * sr)))
    # The loop now wraps from x[c-1] into x[c], two neighbouring samples of the recording: within 5 ms of the planned
    # crossfade length, start where that step (and its slope) is smallest, so the join is a smooth stretch of waveform.
    d = int(0.005 * sr)
    c = min(range(c - d, c + d + 1),
            key=lambda k: float(np.abs(x[k] - x[k - 1]).max() + np.abs(x[k] - 2 * x[k - 1] + x[k - 2]).max()))
    return crossfade_loop(x, L, c), {"loop_end_s": round(L / sr, 4), "crossfade_ms": round(c / sr * 1000),
                                      "match": round(score, 3), "trimmed_ms": round((N - L + c) / sr * 1000, 1)}


def recut_bed(name, x, sr):
    c = int(round(BED_BAR[name] * sr))
    return crossfade_loop(x, len(x), c), {"crossfade_ms": round(c / sr * 1000), "bar_s": round(BED_BAR[name], 4)}


def fade_tail(x, sr):
    """30 ms (a quarter of the file at most); 10 ms when the sound is still at its loudest in those 30 ms (a charge or
    swell that ends on its climax), so the fade takes the click off without taking the climax with it."""
    n = max(8, min(int(0.03 * sr), len(x) // 4))
    if db(np.abs(x[-n:]).max()) > db(np.abs(x).max()) - 6:
        n = max(8, min(int(0.01 * sr), len(x) // 4))
    g = np.cos(np.linspace(0, np.pi / 2, n)) ** 4
    y = x.copy()
    y[-n:] = (y[-n:].T * g).T
    return y, round(n / sr * 1000, 1)


def gate_lifted_floor(x, orig, sr):
    """After a big lift: fade out what was under -60 dBFS after the original's last sound (a 10 ms fade)."""
    a = np.abs(orig).max(1)
    idx = np.nonzero(a > SILENCE)[0]
    if not len(idx) or idx[-1] + 1 >= len(x):
        return x, None
    e = idx[-1] + 1
    n = min(int(0.01 * sr), len(x) - e)
    y = x.copy()
    y[e:e + n] = (y[e:e + n].T * np.linspace(1, 0, n)).T
    y[e + n:] = 0
    return y, round((len(x) - e) / sr * 1000)


def main():
    src, out_dir, slots_p, before_p, report = sys.argv[1:6]
    only = set(sys.argv[6].split(",")) if len(sys.argv) > 6 else None
    slots, before = json.load(open(slots_p)), json.load(open(before_p))
    rows, skipped = {}, {}
    for fn in sorted(os.listdir(src)):
        if not fn.endswith(".mp3"):
            continue
        name = fn[:-4]
        if only and name not in only:
            continue
        s, b = slots[name], before[fn]
        kind = "music" if s["channel"] == "music" else "voice" if s["channel"] == "voice" else "loop" if s["loop"] else "fx"
        x, sr, ch, kbps = load(os.path.join(src, fn))
        orig = x
        ops = {}
        if name in LOOP_RECUT:
            x, ops["loop_recut"] = recut_loop(name, x, sr)
        if name in BED_BAR:
            x, ops["bed_crossfade"] = recut_bed(name, x, sr)
        target, tol = target_for(name, kind, len(x) / sr)
        vol = float(np.median(s["vols"]))
        cur, tp = ebur(x, sr) if ops else (b["lufs"], b["true_peak"])
        d_file, d_eff = cur - target, cur + 20 * np.log10(vol) - target
        outlier = (name not in SKIP_LEVEL and abs(d_file) > tol and abs(d_eff) > tol and np.sign(d_file) == np.sign(d_eff)
                   and (kind != "music" or name in LEVEL_BEDS))
        cut_tail = kind == "fx" and b["last10"] > -40
        mono = kind == "fx" and ch == 2 and b.get("side_db", 0) <= MONO_SIDE_DB
        over = b["true_peak"] > 0
        if not (ops or outlier or cut_tail or mono or over):
            continue
        # Outliers go to their target; everything else keeps the loudness it had (as played), whatever else is done.
        want = target if outlier else b["lufs"]
        if outlier:
            ops["loudness"] = {"target": target, "from": round(cur, 1), "file_delta": round(d_file, 1),
                               "as_played_delta": round(d_eff, 1), "slot_volume": vol}
        if over:
            ops["true_peak_over_0"] = b["true_peak"]
        mono_out = mono
        out_kbps, out_sr = (96, 44100) if mono else (kbps, 44100 if ch == 1 else sr)
        # Standard bitrates only (ffprobe reports e.g. 191 for a 192k file's average).
        out_kbps = min((96, 112, 128, 192), key=lambda k: abs(k - out_kbps))
        dst = os.path.join(out_dir, fn)
        loop = kind in ("loop", "music")

        def finish(y, path, lifted):
            """The fades, mono and encoding after the gain; the encode is corrected towards `want` while the true peak
            allows, and the true-peak rule always wins. Returns (loudness as played, true peak, notes)."""
            notes = {}
            if lifted > 6 and not loop:
                y, gated = gate_lifted_floor(y, orig, sr)
                if gated:
                    notes["floor_faded_ms"] = gated
            if cut_tail:
                y, notes["tail_fade_ms"] = fade_tail(y, sr)
            if mono_out:
                y = y.mean(1, keepdims=True)
            for _ in range(10):
                write(path, y, sr, out_sr, out_kbps, loop=loop)
                dec, dsr, _, _ = load(path)
                l, t = ebur(as_played(dec, ch), dsr)
                room = TP_MAX - 0.05 - t
                step = min(want - l, room)
                if abs(step) < 0.1 or (0 < step < 0.3 and room < 0.3):
                    break
                y = y * 10 ** (step / 20)
            for _ in range(6):  # the true-peak rule always wins
                if t <= TP_MAX:
                    break
                y = y * 10 ** ((TP_MAX - 0.05 - t) / 20)
                write(path, y, sr, out_sr, out_kbps, loop=loop)
                dec, dsr, _, _ = load(path)
                l, t = ebur(as_played(dec, ch), dsr)
            return l, t, notes

        # Plain gain first. Where the true peak stops it more than 1 dB short of `want`, try the transparent limiter
        # too and keep whichever lands closer (a limited sound can overshoot more once encoded, so it isn't always).
        g = want - cur
        l, t, notes = finish(x * 10 ** (g / 20), dst, g)
        how = "gain"
        if want - l > 1.0:
            room = TP_MAX - 0.2 - tp
            lo, hi, best = room, g, None
            for i in range(12):
                gg = hi if i == 0 else (lo + hi) / 2
                lin = x * 10 ** (gg / 20)
                lim = limit(lin, sr)
                if distortion_db(lin, lim) <= -MAX_DISTORTION:
                    best, lo = (gg, lim), gg
                else:
                    hi = gg
                if hi - lo < 0.1:
                    break
            if best is not None:
                alt = dst + ".lim.mp3"
                l2, t2, notes2 = finish(best[1], alt, best[0])
                if l2 > l + 0.1:
                    os.replace(alt, dst)
                    l, t, notes = l2, t2, notes2
                    how = f"limiter {round(max(0.0, db(np.abs(x).max()) + best[0] - db(np.abs(best[1]).max())), 1)} dB"
                elif os.path.exists(alt):
                    os.remove(alt)
        if outlier and want > cur and l < b["lufs"] - 0.1 and not (cut_tail or mono or over or "loop_recut" in ops
                                                                    or "bed_crossfade" in ops):
            # A lift was the only change and the true peak (already at the limit, plus the re-encode's overshoot) made
            # it come out quieter: leave the file as it was.
            os.remove(dst)
            skipped[fn] = {"why": "lift blocked by the true peak", "from": round(cur, 1), "would_be": round(l, 1)}
            print(fn, "skipped", skipped[fn], flush=True)
            continue
        ops.update(notes)
        if mono:
            ops["mono"] = {"side_db": b["side_db"]}
        if outlier or abs(l - cur) > 0.3:
            ops["level"] = {"from": round(cur, 1), "to": round(l, 1), "want": round(want, 1), "by": how}
        rows[fn] = {"kind": kind, "ops": ops, "after_lufs_as_played": l, "after_true_peak": t}
        print(fn, json.dumps(rows[fn]), flush=True)
    json.dump({"files": rows, "skipped": skipped}, open(report, "w"), indent=1)


if __name__ == "__main__":
    main()
