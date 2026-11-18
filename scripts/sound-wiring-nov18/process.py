"""Sound wiring, 18 Nov 2026: Joe's last uploads (branch sounds-retakes, commits 3a153bda and 7417d775) and the held-back
batch files, cut and levelled into public/sounds/ on the house method (docs/sound-cues/levels-nov-2026.md).

  python3 -I scripts/sound-wiring-nov18/process.py <work dir> [--write]

<work dir> holds the originals, each batch in its own folder (`git show <commit>:<file>` of the upload commits):
  batch1/  sounds-batch-1 e810f88d       batch2/  sounds-batch-2 a512ca90
  batch3/  sounds-batch-3 6d5a5e7d       retakes/ sounds-retakes 3a153bda, 7417d775
Without --write everything is made in <work dir>/out and nothing in public/sounds changes; the report goes to
scripts/sound-wiring-nov18/report.json either way.

What it makes:
1. The retakes (docs/sound-cues/sounds-retakes.csv, 150 rows): each on the method of the batch its name came from
   (batch 1: scripts/sound-batch-1/process.py; batches 2 and 3: scripts/sound-batch-2/process.py's one_shot and
   effect_loop, batch 3's ambience beds by scripts/sound-batch-3/process.py's bed_loop): trim to the attack, cut to
   target_ms with a short fade, ring out to the natural decay up to 1.5 x target_ms where the cut would chop, the
   first event only where two were made and one was asked, levelled to the house standard, mono 44.1 kHz.
   Joe chose each by ear, so the new take replaces the old one unless it is broken by measurement: a near-silent
   upload (-59 LUFS or under), a clipped one (three samples running at full scale), or two events where one was
   asked and none can be cut away. Each such case is listed in the report (`kept_old` with the reason).
2. The two retaken .base notes (wordsearch.found.base, wordsmith.word.base) pitch-shifted into their series from the
   new note (scripts/sound-batch-2/process.py SERIES); the other batch-2 series were made from their only take.
3. music_blockfall and music_matchup (Blockzone's and Gemstone's beds): stereo 128 kbps, the beds' -18.45 LUFS,
   each looping whole (its last 40 ms crossfaded into its opening, ~60 s), as batch 2's music_snake.
4. The files held back while their batch waited (a live slot on main played main's file of that name), now meant to
   replace main's: batch 1's 33 (bomb.defuse and the Speed overhaul's 32; seven of them from their batch-3 retake,
   which won) and batch 3's five (flow.connect, laser.bomb, pipes.flow, swing.streak, push.solve). A retake of the
   same name in (1) is the final take.
5. The announcer's twelve voice lines (voice.<word>.mp3): kept stereo as recorded, trimmed tight (from 8 ms before the
   first word to 40 ms after the last, the breath and room tone either side left out), a 6 ms fade in and 30 ms
   fade out, each under 1.3 s, levelled together to VOICE_LUFS with true peaks at -1 dBFS or under, 192 kbps as the
   library's voice lines.
Not made (Joe, 18 Nov 2026): hover.gate, hover.star, hover.thrust and bastion.weakTing keep main's sound.
"""
import csv, json, os, shutil, subprocess, sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..", "..")
sys.path.insert(0, os.path.join(HERE, "..", "sound-audit-nov-2026"))
import importlib.util  # noqa: E402


def _load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


B2 = _load("sound_batch_2", os.path.join(HERE, "..", "sound-batch-2", "process.py"))
B3 = _load("sound_batch_3", os.path.join(HERE, "..", "sound-batch-3", "process.py"))
P = B2.P  # batch 1's process.py, as batch 2 loads it
import fix  # noqa: E402
import measure  # noqa: E402

SR = 44100
CSV_DIR = os.path.join(ROOT, "docs", "sound-cues")
RETAKES_CSV = os.path.join(CSV_DIR, "sounds-retakes.csv")
CHOP_DB = -10
MULTI = ("two", "three", "four", "then", "followed", "run of", "double", "into", "ending", "one after another")
NOT_WIRED = {"hover.gate.mp3", "hover.star.mp3", "hover.thrust.mp3", "bastion.weakTing.mp3"}
HELD_1 = ["bomb.defuse", "chain.heartbeat", "chain.reshuffle", "clayshoot.birdWrong", "clayshoot.escape",
          "clayshoot.goldChime", "clayshoot.goldShatter", "clayshoot.shot", "numhunt.combo", "numhunt.note-high",
          "numhunt.note-low", "numhunt.note-mid", "numhunt.shuffle", "numhunt.warn", "numhunt.wrong", "reaction.bar",
          "reaction.combo", "reaction.done", "reaction.hit", "reaction.wrong", "tendrop.apply", "tendrop.count",
          "tendrop.near", "tendrop.shatter", "tendrop.tap", "tendrop.tenBurst", "whack.bonk", "whack.diamond",
          "whack.emptyTap", "whack.hedgehog", "whack.slam", "whack.whistle", "whack.wrongHat"]
# Batch 1's retakes of these won in batch 3 (docs/sound-cues/batch-1-wiring.md "Retakes from batch 3") but were held.
HELD_1_RETAKE_WON = {"clayshoot.birdWrong", "reaction.wrong", "reaction.done", "tendrop.count", "tendrop.tap",
                     "tendrop.tenBurst", "whack.bonk"}
HELD_3 = ["flow.connect", "laser.bomb", "pipes.flow", "swing.streak", "push.solve"]
# Batch 2's CSV marks these "loop" but they are one-shots (the ball round Crazy Golf's loop-the-loop, and stalling back
# down it): the slots play them once (minigolfSounds), so they are made again as one-shots from batch 2's originals.
KEEP_PLACEHOLDER_SERIES = {"wordsearch.found.base"}
ONE_SHOT_FIX = ["minigolf.loop", "minigolf.loopBack"]
VOICES = ["great", "brilliant", "superb", "amazing", "outstanding", "incredible", "sensational", "unbelievable",
          "phenomenal", "perfect", "legendary", "flawless"]
VOICE_LUFS = -17.0
VOICE_MAX_MS = 1300
VOICE_FIT_MS = 1240


def rows_of(name):
    return list(csv.DictReader(open(os.path.join(CSV_DIR, name), newline="")))


def origin_rows():
    """Each file's row in the batch it came from (batch 3's own rows over its batch-1 retake rows)."""
    out = {}
    for n, b in (("sounds-batch-1.csv", 1), ("sounds-batch-2.csv", 2), ("sounds-batch-3.csv", 3)):
        for r in rows_of(n):
            if b == 3 and r["category"] == "Batch 1 retakes":
                out.setdefault(r["file"], (1, r))
            else:
                out[r["file"]] = (b, r)
    return out


def one_shot_b1(row, src, outdir, first_event):
    """Batch 1's method with its two fixes worked out by measurement (scripts/sound-batch-1/retakes.py)."""
    name = row["file"]
    m, _, _ = P.decode(os.path.join(src, name))
    peak = np.abs(m).max()
    loud = np.nonzero(np.abs(m) > P.SILENCE)[0]
    x = m[max(0, loud[0] - int(0.001 * SR)):np.nonzero(np.abs(m) > peak * 10 ** (-59 / 20))[0][-1] + 1]
    t = int(int(row["target_ms"]) / 1000 * SR)
    chop = len(x) > t and float(P.env_db(x[max(0, t - 441):t + 441], 0.02).max() - P.env_db(x).max()) > CHOP_DB
    P.RING_OUT = {name} if chop else set()
    P.FIRST_EVENT_ONLY = {name} if first_event else set()
    r = P.process(row, src, outdir)
    r["rings_out"] = chop
    return r


def one_shot_b2(row, src, outdir, first_event):
    B2.FIRST_EVENT_ONLY = {row["file"]} if first_event else set()
    r = B2.one_shot(row, src, outdir)
    B2.FIRST_EVENT_ONLY = set()
    return r


def take(batch, row, src, outdir):
    """One take processed on its batch's method; a second event where one was asked is cut away."""
    if "ambience bed" in row.get("note", "").lower() or (batch == 3 and row["file"] in ("bastion.dustWind.mp3", "bastion.stormFire.mp3")):
        return B3.ambience_bed({**row, "note": row.get("note") or "Ambience bed"}, src, outdir)
    if row["loop"].strip().lower() == "yes":
        return B2.effect_loop(row, src, outdir)
    fn = one_shot_b1 if batch == 1 else one_shot_b2
    r = fn(row, src, outdir, False)
    multi = any(w in (row.get("prompt") or "").lower() for w in MULTI)
    if r.get("events", 1) > 1 and not multi:
        r = fn(row, src, outdir, True)
        r["cut_to_first_event"] = True
    r["multi_asked"] = multi
    return r


def broken(r):
    why = []
    if r.get("empty"):
        why.append("empty upload")
    if r.get("raw_lufs", 0) <= -59:
        why.append(f"near-silent upload ({r['raw_lufs']} LUFS)")
    if r.get("clip_runs", 0) > 0:
        why.append(f"clipped ({r['clip_runs']} runs of three samples at full scale)")
    if r.get("events", 1) > 1 and not r.get("multi_asked", True) and not r.get("first_event_ms"):
        why.append("two events where one was asked, and no quiet point between them to cut at")
    return why


def voice(name, src, outdir):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", os.path.join(src, name), "-f", "f32le", "-ac", "2", "-ar",
                          str(SR), "-"], capture_output=True, check=True).stdout
    x = np.frombuffer(raw, np.float32).reshape(-1, 2).astype(np.float64)
    x = x - x.mean(0)
    m = np.abs(x).max(1)
    w = int(0.010 * SR)
    env = 10 * np.log10(np.convolve(x.mean(1) ** 2, np.ones(w) / w, "same") + 1e-12)
    top = float(env.max())
    # Speech starts where the 10 ms level first comes within 32 dB of the loudest syllable (a breath sits well under
    # that) and ends where it last does within 20 dB: the end of the word's body. The takes carry a long room
    # reverb after it (falling about 2 dB every 50 ms), which is the tail left out.
    on = np.nonzero(env > top - 32)[0]
    off = np.nonzero(env > top - 20)[0]
    s = max(0, on[0] - int(0.008 * SR))
    e = min(len(x), off[-1] + int(0.030 * SR))
    y = x[s:e].copy()
    r = {"file": name, "raw_ms": round(len(x) / SR * 1000), "raw_peak": round(fix.db(m.max()), 2),
         "raw_lufs": round(fix.ebur(x, SR)[0], 1), "start_ms": round(s / SR * 1000), "end_ms": round(e / SR * 1000),
         "word_ms": round(len(y) / SR * 1000)}
    # A word longer than VOICE_FIT_MS is tightened to it (rubberband: pitch and formants kept), so every line is
    # under 1.3 s once its fades are on. The tempo is in the report.
    if len(y) > VOICE_FIT_MS / 1000 * SR:
        tempo = len(y) / (VOICE_FIT_MS / 1000 * SR)
        o = subprocess.run(["ffmpeg", "-v", "error", "-f", "f32le", "-ac", "2", "-ar", str(SR), "-i", "-", "-af",
                            f"rubberband=tempo={tempo:.4f}:pitch=1:transients=crisp:formant=preserved:pitchq=quality",
                            "-f", "f32le", "-ac", "2", "-ar", str(SR), "-"],
                           input=y.astype(np.float32).tobytes(), capture_output=True, check=True).stdout
        y = np.frombuffer(o, np.float32).reshape(-1, 2).astype(np.float64).copy()
        r["tempo"] = round(tempo, 3)
    fi, fo = int(0.006 * SR), int(0.040 * SR)
    y[:fi] *= (0.5 * (1 - np.cos(np.linspace(0, np.pi, fi))))[:, None]
    y[-fo:] *= (0.5 * (1 + np.cos(np.linspace(0, np.pi, fo))))[:, None]
    out = os.path.join(outdir, name)
    gain = VOICE_LUFS - fix.ebur(y, SR)[0]
    for _ in range(10):
        fix.write(out, y * 10 ** (gain / 20), SR, SR, 192, False)
        lufs, tp = fix.ebur(fix.load(out)[0], SR)
        if tp > fix.TP_MAX:
            gain -= max(tp - fix.TP_MAX, fix.db(np.abs(y).max()) + gain - fix.TP_MAX) + 0.05
            continue
        if abs(VOICE_LUFS - lufs) > 0.1 and VOICE_LUFS - lufs < fix.TP_MAX - tp - 0.05:
            gain += VOICE_LUFS - lufs
            continue
        break
    dec = fix.load(out)[0]
    lufs, tp = fix.ebur(dec, SR)
    r.update({"ms": round(len(dec) / SR * 1000), "bytes": os.path.getsize(out), "lufs": round(lufs, 1),
              "target": VOICE_LUFS, "truePeak": round(tp, 1), "short_db": round(VOICE_LUFS - lufs, 1)})
    return r


def main():
    work = sys.argv[1]
    write = "--write" in sys.argv
    out = os.path.join(work, "out")
    os.makedirs(os.path.join(out, "_new"), exist_ok=True)
    src = {1: os.path.join(work, "batch1"), 2: os.path.join(work, "batch2"), 3: os.path.join(work, "batch3"),
           "r": os.path.join(work, "retakes")}
    origins = origin_rows()
    only = set(os.environ.get("ONLY", "").split(",")) - {""}
    want = lambda f: not only or f in only  # noqa: E731
    report = {"held": [], "retakes": [], "series": [], "music": [], "voices": []}

    # 4. Held-back files, from their batch's originals (or the batch-3 retake that won).
    for slot in HELD_1 + HELD_3:
        f = f"{slot}.mp3"
        if not want(f):
            continue
        b, row = (3, origins[f][1]) if slot in HELD_3 else origins[f]
        retake = slot in HELD_1_RETAKE_WON
        if retake:
            row = next(r for r in rows_of("sounds-batch-3.csv") if r["file"] == f)
        r = take(1 if slot in HELD_1 else 3, row, src[3] if (retake or slot in HELD_3) else src[1], out)
        r["from"] = "batch-3 retake" if retake else f"batch {1 if slot in HELD_1 else 3}"
        report["held"].append(r)
        print(f"held  {f:32} {r.get('ms', 0):6} ms {r.get('lufs', '-'):>6} LUFS tp {r.get('truePeak', '-')}", flush=True)

    for slot in ONE_SHOT_FIX:
        f = f"{slot}.mp3"
        if not want(f):
            continue
        b, row = origins[f]
        r = take(b, {**row, "loop": "no"}, src[b], out)
        r["from"] = "batch 2, as a one-shot (its row said loop)"
        report["held"].append(r)
        print(f"fix   {f:32} {r.get('ms', 0):6} ms {r.get('lufs', '-'):>6} LUFS tp {r.get('truePeak', '-')}", flush=True)

    # 1. Retakes.
    for row in rows_of("sounds-retakes.csv"):
        f = row["file"]
        if f.startswith("music_") or not want(f):
            continue
        b, orow = origins[f]
        if f in NOT_WIRED:
            report["retakes"].append({"file": f, "skipped": "keeps main's sound (Joe, 18 Nov 2026)"})
            continue
        nrow = {**orow, **{k: v for k, v in row.items() if v}}
        nrow["note"] = orow.get("note", "") if b == 3 else row.get("note", "")
        r = take(b, nrow, src["r"], os.path.join(out, "_new"))
        r["batch"] = b
        why = broken(r)
        r["kept_old"] = why
        if not why:
            os.makedirs(out, exist_ok=True)
            shutil.copyfile(os.path.join(out, "_new", f), os.path.join(out, f))
        report["retakes"].append(r)
        print(f"retake {f:32} b{b} {r.get('ms', 0):6} ms {r.get('lufs', '-'):>6} LUFS tp {r.get('truePeak', '-')}"
              f"{'  KEPT OLD: ' + '; '.join(why) if why else ''}", flush=True)
        # 2. A retaken .base note: its series again.
        # Lookout's series keeps main's placeholders (as batch 2 decided): the retaken note is still a sharp spike over a
        # quiet body, so found7-found9 can't come within 4.5 dB of the house level (sound-review-fixes-check's bound).
        if orow["slot"] in B2.SERIES_FULL and not why and orow["slot"] not in KEEP_PLACEHOLDER_SERIES:
            srows, sres = B2_series(orow, os.path.join(out, f), out)
            report["series"] += sres

    # 3. Music.
    for row in rows_of("sounds-retakes.csv"):
        if row["file"].startswith("music_") and want(row["file"]):
            r = B2.music({**row, "slot": row["slot"] or row["file"][:-4]}, src["r"], out)
            report["music"].append(r)
            print(f"music {row['file']:32} {r['ms']} ms {r['lufs']} LUFS tp {r['truePeak']} {r['loop_cut']}", flush=True)

    # 5. Voices.
    for v in VOICES:
        f = f"voice.{v}.mp3"
        if want(f):
            r = voice(f, src["r"], out)
            report["voices"].append(r)
            print(f"voice {f:32} {r['raw_ms']} -> {r['ms']} ms {r['lufs']} LUFS tp {r['truePeak']}", flush=True)

    path = os.path.join(HERE, "report.json")
    if only and os.path.exists(path):  # a partial run updates its rows in the full report
        full = json.load(open(path))
        for k, rows in report.items():
            done = {r["file"] for r in rows}
            full[k] = [r for r in full.get(k, []) if r["file"] not in done] + rows
        report = full
    json.dump(report, open(path, "w"), indent=1)
    if write:
        for name in os.listdir(out):
            if name.endswith(".mp3"):
                shutil.copyfile(os.path.join(out, name), os.path.join(ROOT, "public", "sounds", name))


B2.SERIES_FULL = dict(B2.SERIES)


def B2_series(row, base_path, outdir):
    B2.SERIES = B2.SERIES_FULL
    try:
        return B2.series(row, base_path, outdir)
    finally:
        B2.SERIES = {}


if __name__ == "__main__":
    main()
