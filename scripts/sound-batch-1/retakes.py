"""Sound batch 1's retakes (17 Nov 2026): Joe re-recorded the batch-1 sounds on docs/sound-cues/batch-1-retakes.md (the
"Batch 1 retakes" rows of sounds-batch-3.csv, uploaded on branch sounds-batch-3, commit 6d5a5e7d). Each new take is
processed as batch 1's files were (process.py: trim to the attack, cut to target_ms with a fade, level, mono 44.1 kHz),
with the two fixes Joe asked for on batch 1 applied by measurement: a take still within 10 dB of its peak at target_ms
rings out to its natural decay, at most 1.5 x target_ms; a take with two events where one was asked keeps the first.
Then it is compared with the batch-1 file by the retake list's own measures and the better one is kept.

Usage: python3 -I scripts/sound-batch-1/retakes.py <new takes dir> <csv with the retake rows> <out report.json>
       [--write]   (without it, the new takes are written to a scratch dir only and nothing in public/sounds changes)
Env SKIP=<file,...>: rows left out (none now: nonogram.solve was compared on 17 Nov 2026 and its new take won), HELD=<file,...>: files a live slot plays on
main, compared but never written.
"""
import csv, json, os, shutil, subprocess, sys, tempfile

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, "..", "sound-audit-nov-2026"))
import process as P  # noqa: E402
import fix  # noqa: E402

SR = 44100
ROOT = os.path.join(HERE, "..", "..")
CHOP_DB = -10
# Prompts that ask for more than one event (two knocks, a click then a chime…): a second event is wanted there.
MULTI = ("two", "three", "four", "then", "followed", "run of", "double", "into", "ending", "one after another")


def dec(path):
    o = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"],
                       capture_output=True, check=True).stdout
    return np.frombuffer(o, np.float32).astype(np.float64)


def decay30_ms(m):
    e = P.env_db(m)
    pk = int(e.argmax())
    below = np.nonzero(e[pk:] < e[pk] - 30)[0]
    return int((below[0] if len(below) else len(e) - pk) * 5)


def problems(r, raw_m, ring, multi):
    """The retake list's measures (batch-1-retakes.md): each a reason this take needs redoing."""
    out = []
    if r["raw_lufs"] <= -59:
        out.append(f"near-silent upload ({r['raw_lufs']} LUFS)")
    if r["active_share"] <= 0.21:
        out.append("a click then nothing")
    if r["short_db"] >= 6:
        out.append(f"{r['short_db']} dB quieter than its family (a spike over a quiet body)")
    lvl = r.get("level_at_cut_db", -99)
    if ring and lvl > CHOP_DB:
        out.append(f"still sounding at 1.5x its length ({lvl} dB under its peak at the fade)")
    elif not ring and decay30_ms(raw_m) > max(250, 2 * r["target_ms"]) and lvl > CHOP_DB:
        out.append(f"reverb tail: the fade starts {-lvl} dB under the peak")
    if r.get("events", 1) > 1 and not r.get("first_event_ms") and not multi:
        out.append("two events")
    return out


def score(r, probs):
    """Lower is better: problems first (a near-silent upload counts twice: its noise was lifted with it), then how far
    under the house level, then how little of it sounds."""
    weight = sum(2 if p.startswith("near-silent") else 1 for p in probs)
    return (weight, max(0.0, r["short_db"]), -r["active_share"])


def process_take(row, src, outdir, first_event):
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
    return r, m


def main():
    src, csv_path, report = sys.argv[1:4]
    write = "--write" in sys.argv
    skip = set(os.environ.get("SKIP", "").split(",")) - {""}
    held = set(os.environ.get("HELD", "").split(",")) - {""}
    old = {r["file"]: r for r in json.load(open(os.path.join(HERE, "report.json")))}
    rows = [r for r in csv.DictReader(open(csv_path, newline="")) if r["category"] == "Batch 1 retakes"]
    scratch = tempfile.mkdtemp()
    res = []
    for row in rows:
        name = row["file"]
        entry = {"file": name, "slot": row["slot"], "pr": row["pr"], "note": row["note"]}
        cur = os.path.join(ROOT, "public", "sounds", name)
        # The old take as batch 1 made it: its stored measures, its decoded original for the tail measure.
        o = old.get(name)
        old_raw = os.path.join(src, "..", "batch1-raw", name)
        multi = any(w in row["prompt"].lower() for w in MULTI)
        o_probs = problems(o, dec(old_raw), bool(o.get("ring_out_ms")), multi) if o and os.path.exists(old_raw) else []
        if name in skip:
            entry.update(kept="old", why="Joe kept batch 1's take (the new upload is measured but not used)")
        n, n_raw = process_take(row, src, scratch, False)
        if n.get("events", 1) > 1 and not multi:
            n, n_raw = process_take(row, src, scratch, True)
        n_probs = problems(n, n_raw, n["rings_out"], multi)
        entry["old"] = {k: o.get(k) for k in ("ms", "lufs", "target", "truePeak", "short_db", "active_share")} if o else None
        entry["old_problems"] = o_probs
        entry["new"] = {k: n.get(k) for k in ("ms", "lufs", "target", "truePeak", "short_db", "active_share", "raw_lufs",
                                               "rings_out", "first_event_ms", "forced_distortion_db")}
        entry["new_problems"] = n_probs
        if "kept" not in entry:
            sn, so = score(n, n_probs), score(o, o_probs) if o else (99, 0, 0)
            better = sn < so
            entry["kept"] = "new" if better else "old"
            entry["why"] = ("no problems left" if better and not n_probs else
                            "fewer or lighter problems" if better and sn[0] < so[0] else
                            "the same problems, closer to the house level" if better else
                            "the new take has more or worse problems" if sn[0] > so[0] else
                            "the same problems, and the old take sits closer to the house level")
        entry["held"] = name in held
        if entry["kept"] == "new" and write and not entry["held"]:
            shutil.copyfile(os.path.join(scratch, name), cur)
            n["retake"] = True
            old[name] = n
        res.append(entry)
        print(f"{name:28} kept {entry['kept']:3}  old {o_probs}  new {n_probs}{'  (held: live on main)' if entry['held'] else ''}", flush=True)
    json.dump(res, open(report, "w"), indent=1)
    if write:
        json.dump(list(old.values()), open(os.path.join(HERE, "report.json"), "w"), indent=1)


if __name__ == "__main__":
    main()
