"""Sound batch 2 (16 Nov 2026): Joe's 309 ElevenLabs recordings for the Number, Word, Retro, Strategy, Cards & Board,
Sports and Crazy Golf overhauls (docs/sound-cues/sounds-batch-2.csv), on batch 1's method
(scripts/sound-batch-1/process.py, docs/sound-cues/levels-nov-2026.md) with this batch's extras.
Usage: python3 -I scripts/sound-batch-2/process.py <originals dir> <out dir> <report.json>

Originals: the uploads on branch sounds-batch-2, commit a512ca90 (`git show a512ca90:<file>`).

- One-shots: batch 1's process() exactly (trim to the attack, cut to target_ms with a 10 ms fade, level, mono 44.1 kHz
  96 kbps), with batch 1's two fixes decided by measurement: a sound still within 10 dB of its peak at target_ms rings
  out to its natural decay, never past 1.5 x target_ms (RING_OUT, worked out per file); FIRST_EVENT_ONLY lists the
  sounds that made two events where the prompt asked for one.
- Effect loops (loop = yes): the whole take (lead and tail silence trimmed, DC removed) made seamless by sound batch 6's
  make_loop (the loop whose waveform and level best match across the join, crossfaded into its head),
  levelled to the loops' -16.8 LUFS measured twice through, and written with fix.py's wrap-around frames. A loop that
  replaces a November placeholder keeps that data's 32,000-byte size aim (sound-review-fixes-check), so it is cut to
  at most LOOP_MAX_S before the join.
- music_snake: stereo 128 kbps, the beds' -18.45 LUFS, peaks at -1 dBFS or under (gain only); a take that ends on a fade
  is cut on the bar whose next 4 s best match its opening (batch 6's make_loop, as levels-nov-2026.md's beds), else it
  loops whole with a short crossfade of its end into its start.
- "Record ONE clean note only" rows: the processed .base file is kept, and pitch-shifted (resampled, so a higher note is
  also shorter, as a struck note is) into its series on the steps in SERIES (from the Word overhaul's
  word-elevenlabs.md), each levelled again. The series rows are written to docs/sound-cues/sounds-batch-2-series.csv.
- Rows whose note starts "TO RECORD" (no usable upload) are skipped and reported.
"""
import csv, json, os, subprocess, sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..", "..")
sys.path.insert(0, os.path.join(HERE, "..", "sound-batch-1"))
sys.path.insert(0, os.path.join(HERE, "..", "sound-audit-nov-2026"))
import process as P  # noqa: E402  (batch 1)
import fix  # noqa: E402
import measure  # noqa: E402

SR = 44100
# Sound batch 6's loop maker (scripts/sound-batch6/process.py make_loop), as the house's loops and beds use it.
B6 = {"__name__": "b6"}
_b6 = os.path.join(HERE, "..", "sound-batch6", "process.py")
exec(compile(open(_b6).read().replace("\nmain()\n", "\n"), _b6, "exec"), B6)
CSV = os.path.join(ROOT, "docs", "sound-cues", "sounds-batch-2.csv")
SERIES_CSV = os.path.join(ROOT, "docs", "sound-cues", "sounds-batch-2-series.csv")
CHOP_DB = -10  # still this close to its peak at target_ms: the cut would chop, so it rings out
FIRST_EVENT_ONLY = {"kakuro.pencil.mp3"}  # "a light graphite tick": the take has two
LOOP_MAX_S = 2.5
# A target_ms of 0 in the CSV (balance.solve): the slot's own length on its PR (#431's manifest, 1080 ms) instead.
TARGET_FIX = {"balance.solve.mp3": 1080}


def _write_openable(path, x, sr, out_sr, kbps, loop=False, _write=fix.write):
    """fix.write, then make sure ffmpeg opens the file: a three-frame MP3 can come out with bytes ffmpeg's format
    sniffer does not recognise (a browser's ffmpeg-based decoder could trip on it too), so such a file is encoded again
    0.01 dB quieter (a few tries; the level is unchanged to the meter)."""
    for i in range(6):
        _write(path, x * 10 ** (-0.01 * i / 20), sr, out_sr, kbps, loop)
        if subprocess.run(["ffprobe", "-v", "error", path], capture_output=True).returncode == 0:
            return
    raise RuntimeError(f"{path}: ffmpeg cannot open the encoded file")


fix.write = _write_openable
MUSIC_LUFS = fix.MUSIC_LUFS

# The series: semitone steps from the recorded note (a list of steps is a chord). From word-elevenlabs.md (#437):
# Nucleus "six rising steps of a major scale"; Lookout "six rising pitches" (the major scale too); Forage "one note per
# step of a major scale (nine steps)"; Roundabout "one per step of a pentatonic scale"; Interlock "three notes for
# three letters up to a fuller five-note chord for seven" (major triads and their octaves, each a little higher).
MAJOR = [0, 2, 4, 5, 7, 9, 11, 12, 14]
PENTA = [0, 2, 4, 7, 9, 12, 14, 16]
SERIES = {
    "wordsmith.word.base": [(f"wordsmith.word{n}", [MAJOR[i]]) for i, n in enumerate(range(4, 10))],
    "wordsearch.found.base": [(f"wordsearch.found{n}", [MAJOR[i]]) for i, n in enumerate(range(4, 10))],
    "wordhunt.trace.base": [(f"wordhunt.trace{n}", [MAJOR[i]]) for i, n in enumerate(range(1, 10))],
    "letterwheel.trace.base": [(f"letterwheel.trace{n}", [PENTA[i]]) for i, n in enumerate(range(1, 9))],
    "tilegrid.word.base": [("tilegrid.word3", [0, 4, 7]), ("tilegrid.word4", [4, 7, 12]), ("tilegrid.word5", [0, 4, 7, 12]),
                           ("tilegrid.word6", [4, 7, 12, 16]), ("tilegrid.word7", [0, 4, 7, 12, 16])],
}


def shift(x, semis):
    """Resample x so it plays semis semitones higher (and that much shorter)."""
    if semis == 0:
        return x.copy()
    rate = round(SR * 2 ** (semis / 12))
    out = subprocess.run(["ffmpeg", "-v", "error", "-f", "f32le", "-ac", "1", "-ar", str(rate), "-i", "-", "-af",
                          f"aresample={SR}:resampler=soxr" if _soxr() else f"aresample={SR}", "-f", "f32le", "-ac", "1",
                          "-"], input=x.astype(np.float32).tobytes(), capture_output=True, check=True).stdout
    return np.frombuffer(out, np.float32).astype(np.float64)


def _soxr():
    if not hasattr(_soxr, "ok"):
        _soxr.ok = "soxr" in subprocess.run(["ffmpeg", "-hide_banner", "-buildconf"], capture_output=True, text=True).stdout
    return _soxr.ok


def series(base_row, base_path, outdir):
    x = fix.load(base_path)[0].mean(1)
    rows, res = [], []
    for slot, steps in SERIES[base_row["slot"]]:
        parts = [shift(x, s) for s in steps]
        n = max(len(p) for p in parts)
        y = sum(np.concatenate([p, np.zeros(n - len(p))]) for p in parts) / np.sqrt(len(parts))
        f = min(len(y), int(0.005 * SR))
        y[-f:] *= 0.5 * (1 + np.cos(np.linspace(0, np.pi, f)))
        name = f"{slot}.mp3"
        r = {"file": name, "slot": slot, "pr": base_row["pr"], "category": base_row["category"], "loop": False,
             "from": base_row["file"], "semitones": steps, "target_ms": round(len(y) / SR * 1000)}
        r.update(P.level(y, os.path.join(outdir, name), False, P.PLACEHOLDER_MAX_SHORT if name in P.PLACEHOLDERS else None))
        res.append(r)
        what = "chord of " if len(steps) > 1 else ""
        rows.append({"file": name, "slot": slot, "category": base_row["category"], "pr": base_row["pr"],
                     "target_ms": r["ms"], "generated_s": "", "loop": "no",
                     "note": f"pitch-shifted from {base_row['file']}: {what}{'+'.join(str(s) for s in steps)} semitones",
                     "prompt": base_row["prompt"]})
    return rows, res


def effect_loop(row, src, outdir):
    name = row["file"]
    m, raw, raw_sr = P.decode(os.path.join(src, name))
    r = {"file": name, "slot": row["slot"], "pr": row["pr"], "category": row["category"], "loop": True,
         "target_ms": int(row["target_ms"]), "raw_ms": round(len(m) / SR * 1000), "raw_peak": round(fix.db(np.abs(raw).max()), 2),
         "raw_lufs": round(fix.ebur(m[:, None], SR)[0], 1)}
    loud = np.nonzero(np.abs(m) > P.SILENCE)[0]
    x = m[loud[0]:loud[-1] + 1] - m[loud[0]:loud[-1] + 1].mean()
    capped = name in P.PLACEHOLDERS
    if capped and len(x) > int(LOOP_MAX_S * SR):
        x = x[: int(LOOP_MAX_S * SR)]
        r["shortened_for_size"] = True
    y, info = B6["make_loop"](np.stack([x, x], 1), False, False)
    r.update(info)
    r.update(P.level(y, os.path.join(outdir, name), True, P.PLACEHOLDER_MAX_SHORT if capped else None))
    r["join"] = measure.join(fix.load(os.path.join(outdir, name))[0], SR)
    e = P.env_db(y, 0.05)
    r["level_spread_db"] = round(float(np.percentile(e, 95) - np.percentile(e, 5)), 1)
    return r


def music(row, src, outdir):
    name = row["file"]
    path = os.path.join(src, name)
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-f", "f32le", "-ac", "2", "-ar", str(SR), "-"],
                         capture_output=True, check=True).stdout
    x = np.frombuffer(raw, np.float32).reshape(-1, 2).astype(np.float64)
    r = {"file": name, "slot": row["slot"], "pr": row["pr"], "category": row["category"], "loop": True, "music": True,
         "target_ms": int(row["target_ms"]), "raw_ms": round(len(x) / SR * 1000), "raw_peak": round(fix.db(np.abs(x).max()), 2),
         "raw_lufs": round(fix.ebur(x, SR)[0], 1)}
    loud = np.nonzero(np.abs(x).max(1) > P.SILENCE)[0]
    x = x[loud[0]:loud[-1] + 1]
    m = x.mean(1)
    b = int(0.5 * SR)
    lv = [10 * np.log10((m[i:i + b] ** 2).mean() + 1e-12) for i in range(0, len(m) - b, b)]
    r["ends_on_fade"] = bool(lv[-1] < np.median(lv) - 6)  # sound-nov-2026's ends_on_fade
    if r["ends_on_fade"]:
        y, how = B6["make_loop"](x, True, True)
        r["loop_cut"] = how
    else:
        c = int(0.04 * SR)
        y = fix.crossfade_loop(x, len(x), c)
        r["loop_cut"] = "whole take, 40 ms crossfade of its end into its start"
    out = os.path.join(outdir, name)
    meter = lambda d: np.concatenate([d, d])  # noqa: E731  (a loop measured twice through)
    gain = MUSIC_LUFS - fix.ebur(meter(y), SR)[0]
    for _ in range(8):
        fix.write(out, y * 10 ** (gain / 20), SR, SR, 128, True)
        lufs, tp = fix.ebur(meter(fix.load(out)[0]), SR)
        if tp > fix.TP_MAX:
            gain -= tp - fix.TP_MAX + 0.05
            continue
        if abs(MUSIC_LUFS - lufs) > 0.1 and MUSIC_LUFS - lufs < fix.TP_MAX - tp - 0.05:
            gain += MUSIC_LUFS - lufs
            continue
        break
    dec = fix.load(out)[0]
    lufs, tp = fix.ebur(meter(dec), SR)
    r.update({"ms": round(len(dec) / SR * 1000), "bytes": os.path.getsize(out), "lufs": round(lufs, 1), "target": MUSIC_LUFS,
              "truePeak": round(tp, 1), "short_db": round(MUSIC_LUFS - lufs, 1), "join": measure.join(dec, SR)})
    return r


def one_shot(row, src, outdir):
    name = row["file"]
    m, _, _ = P.decode(os.path.join(src, name))
    peak = np.abs(m).max()
    loud = np.nonzero(np.abs(m) > P.SILENCE)[0]
    x = m[max(0, loud[0] - int(0.001 * SR)):np.nonzero(np.abs(m) > peak * 10 ** (-59 / 20))[0][-1] + 1]
    t = int(int(row["target_ms"]) / 1000 * SR)
    chop = len(x) > t and float(P.env_db(x[max(0, t - 441):t + 441], 0.02).max() - P.env_db(x).max()) > CHOP_DB
    P.RING_OUT = {name} if chop else set()
    P.FIRST_EVENT_ONLY = FIRST_EVENT_ONLY
    return P.process(row, src, outdir)


def main():
    src, outdir, report = sys.argv[1:4]
    rows = list(csv.DictReader(open(CSV, newline="")))
    for row in rows:
        if row["file"] in TARGET_FIX:
            row["target_ms"] = str(TARGET_FIX[row["file"]])
    only = set(os.environ.get("ONLY", "").split(",")) - {""}
    if os.environ.get("PART"):  # PART=k/n: every n-th row from the k-th (parallel runs; merge their reports)
        k, n = map(int, os.environ["PART"].split("/"))
        only = only or {r["file"] for r in rows[k - 1::n]}
    res, series_rows = [], []
    for row in rows:
        if only and row["file"] not in only:
            continue
        if row["note"].startswith("TO RECORD"):
            res.append({"file": row["file"], "slot": row["slot"], "pr": row["pr"], "to_record": row["note"]})
            continue
        if row["slot"].startswith("music_"):
            r = music(row, src, outdir)
        elif row["loop"].strip().lower() == "yes":
            r = effect_loop(row, src, outdir)
        else:
            r = one_shot(row, src, outdir)
        res.append(r)
        print(f"{r['file']:34} {r.get('raw_ms', 0):6} -> {r.get('ms', 0):6} ms  {r.get('lufs', '-'):>6} LUFS "
              f"(target {r.get('target', '-')}) tp {r.get('truePeak', '-')}", flush=True)
        if row["slot"] in SERIES:
            srows, sres = series(row, os.path.join(outdir, row["file"]), outdir)
            series_rows += srows
            res += sres
    json.dump(res, open(report, "w"), indent=1)
    if series_rows and not only:
        with open(SERIES_CSV, "w", newline="") as f:
            w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
            w.writeheader()
            w.writerows(series_rows)
    elif series_rows:
        json.dump(series_rows, open(report + ".series.json", "w"), indent=1)


if __name__ == "__main__":
    main()
