"""Sound batch 3 (17 Nov 2026): Joe's 141 ElevenLabs uploads (docs/sound-cues/sounds-batch-3.csv) for the Pattern (#433),
Action (#436), Home Run and Top Bins (#444) and Logic 1 (#430) overhauls, on batch 2's method exactly
(scripts/sound-batch-2/process.py: trim to the attack, cut to target_ms with a 10 ms fade, ring out to the natural decay
up to 1.5 x target_ms where the cut would chop, levelled to the house standard, mono 44.1 kHz 96 kbps; loop rows made
seamless by sound batch 6's make_loop). The 23 "Batch 1 retakes" rows are not processed here: they are compared with
the batch-1 files on that batch's branch (scripts/sound-batch-1/retakes.py, docs/sound-cues/batch-1-wiring.md).
Usage: python3 -I scripts/sound-batch-3/process.py <originals dir> <out dir> <report.json>

Originals: the uploads on branch sounds-batch-3, commit 6d5a5e7d (`git show 6d5a5e7d:<file>`).

Ambience beds (a row whose note says "Ambience bed": bastion.dustWind, bastion.stormFire) are made as the library's
ambience beds are (sounds for the re-themed games, docs/sound-cues/retheme-nov-2026.md): stereo 128 kbps, the beds'
-18.45 LUFS, peaks at -1 dBFS or under, and looped by bed_loop (below: the join placed away from every boom and crackle,
the levels either side within the take's own quietest match, a 0.4 s equal-power crossfade), written with fix.py's
wrap-around frames so MP3 adds no tick.
No take made two events where its prompt asked for one, so nothing is cut to its first event.
"""
import csv, json, os, sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..", "..")
sys.path.insert(0, os.path.join(HERE, "..", "sound-audit-nov-2026"))
import importlib.util  # noqa: E402

# Batch 2's module (which imports batch 1's as `process`) under its own name, so the two don't collide.
_spec = importlib.util.spec_from_file_location("sound_batch_2", os.path.join(HERE, "..", "sound-batch-2", "process.py"))
B2 = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(B2)
import fix  # noqa: E402
import measure  # noqa: E402

SR = 44100
CSV = os.path.join(ROOT, "docs", "sound-cues", "sounds-batch-3.csv")
B2.FIRST_EVENT_ONLY = set()
B2.SERIES = {}


def bed_loop(x, xf_s=0.4, min_s=3.0):
    """A long ambience bed's loop with no audible seam: of every start s0 in its first quarter and end L at least min_s
    later (10 ms steps), the one whose join is quietest to the ear: the level just before L within the level just after
    the crossfade (200 ms and 600 ms windows), the least transient (a boom or crackle over the bed's median + 6 dB) within
    300 ms either side of the join, and the waveforms across the crossfade as alike as the take allows; then an equal-power
    crossfade of xf_s (ambience is noise-like) of the loop's end into its head."""
    m = x.mean(1)
    N = len(m)
    xf = int(xf_s * SR)
    w = int(0.005 * SR)
    env = 10 * np.log10(np.convolve(m ** 2, np.ones(w) / w, "same") + 1e-12)
    med = float(np.median(env))
    c = np.cumsum(np.concatenate([[0.0], m ** 2]))

    def lv(a, b):
        return 10 * np.log10((c[b] - c[a]) / max(1, b - a) + 1e-12)

    def busy(i):
        """How far the loudest moment within 300 ms of i stands over the bed's median plus 6 dB (0 when none does)."""
        a, b = max(0, i - int(0.3 * SR)), min(N, i + int(0.3 * SR))
        return max(0.0, float(env[a:b].max()) - med - 6)

    best = None
    for s0 in range(0, int(N * 0.25), int(0.01 * SR)):
        b0 = busy(s0 + xf)
        after = (lv(s0 + xf, s0 + xf + int(0.2 * SR)), lv(s0 + xf, s0 + xf + int(0.6 * SR)))
        for L in range(s0 + int(min_s * SR) + xf, N - xf, int(0.01 * SR)):
            b1 = busy(L)
            jump = max(abs(lv(L - int(0.2 * SR), L) - after[0]), abs(lv(L - int(0.6 * SR), L) - after[1]))
            a = m[s0:s0 + xf] - m[s0:s0 + xf].mean()
            b = m[L:L + xf] - m[L:L + xf].mean()
            xc = float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-12))
            # a transient at the join first, then a smaller jump, then alike, then the longer loop
            score = (b0 + b1) + jump - 2 * xc - 0.3 * (L - s0) / SR
            if best is None or score < best[0]:
                best = (score, s0, L, jump, xc)
    _, s0, L, jump, xc = best
    t = (np.arange(xf) + 0.5) / xf
    fi, fo = np.sin(t * np.pi / 2), np.cos(t * np.pi / 2)
    head = x[s0:s0 + xf]
    tail = x[L:L + xf]
    y = np.concatenate([(head.T * fi).T + (tail.T * fo).T, x[s0 + xf:L]])
    return y, {"loop_start_s": round(s0 / SR, 3), "loop_end_s": round(L / SR, 3), "crossfade_ms": round(xf_s * 1000),
               "join_level_db": round(jump, 2), "xcorr": round(xc, 3)}


def ambience_bed(row, src, outdir):
    import subprocess
    name = row["file"]
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", os.path.join(src, name), "-f", "f32le", "-ac", "2", "-ar",
                          str(SR), "-"], capture_output=True, check=True).stdout
    x = np.frombuffer(raw, np.float32).reshape(-1, 2).astype(np.float64)
    r = {"file": name, "slot": row["slot"], "pr": row["pr"], "category": row["category"], "loop": True, "bed": True,
         "target_ms": int(row["target_ms"]), "raw_ms": round(len(x) / SR * 1000), "raw_peak": round(fix.db(np.abs(x).max()), 2),
         "raw_lufs": round(fix.ebur(x, SR)[0], 1)}
    loud = np.nonzero(np.abs(x).max(1) > B2.P.SILENCE)[0]
    x = x[loud[0]:loud[-1] + 1]
    x = x - x.mean(0)
    y, info = bed_loop(x)
    r.update(info)
    out = os.path.join(outdir, name)
    meter = lambda d: np.concatenate([d, d])  # noqa: E731  (a loop measured twice through)
    gain = fix.MUSIC_LUFS - fix.ebur(meter(y), SR)[0]
    for _ in range(10):
        fix.write(out, y * 10 ** (gain / 20), SR, SR, 128, True)
        lufs, tp = fix.ebur(meter(fix.load(out)[0]), SR)
        if tp > fix.TP_MAX:
            gain -= max(tp - fix.TP_MAX, fix.db(np.abs(y).max()) + gain - fix.TP_MAX) + 0.05
            continue
        if abs(fix.MUSIC_LUFS - lufs) > 0.1 and fix.MUSIC_LUFS - lufs < fix.TP_MAX - tp - 0.05:
            gain += fix.MUSIC_LUFS - lufs
            continue
        break
    dec = fix.load(out)[0]
    lufs, tp = fix.ebur(meter(dec), SR)
    r.update({"ms": round(len(dec) / SR * 1000), "bytes": os.path.getsize(out), "lufs": round(lufs, 1),
              "target": fix.MUSIC_LUFS, "truePeak": round(tp, 1), "short_db": round(fix.MUSIC_LUFS - lufs, 1),
              "join": measure.join(dec, SR)})
    return r


def main():
    src, outdir, report = sys.argv[1:4]
    rows = [r for r in csv.DictReader(open(CSV, newline="")) if r["category"] != "Batch 1 retakes"]
    only = set(os.environ.get("ONLY", "").split(",")) - {""}
    if os.environ.get("PART"):
        k, n = map(int, os.environ["PART"].split("/"))
        only = only or {r["file"] for r in rows[k - 1::n]}
    held = set(os.environ.get("HELD", "").split(",")) - {""}
    res = []
    for row in rows:
        if only and row["file"] not in only:
            continue
        # A file a live slot plays on main is processed to a side folder (its report row kept), never over main's.
        out = os.path.join(outdir, "held") if row["file"] in held else outdir
        os.makedirs(out, exist_ok=True)
        if "ambience bed" in row["note"].lower():
            r = ambience_bed(row, src, out)
        elif row["loop"].strip().lower() == "yes":
            r = B2.effect_loop(row, src, out)
        else:
            r = B2.one_shot(row, src, out)
        r["held"] = row["file"] in held
        res.append(r)
        print(f"{r['file']:34} {r.get('raw_ms', 0):6} -> {r.get('ms', 0):6} ms  {r.get('lufs', '-'):>6} LUFS "
              f"(target {r.get('target', '-')}) tp {r.get('truePeak', '-')}{'  HELD' if r['held'] else ''}", flush=True)
    json.dump(res, open(report, "w"), indent=1)


if __name__ == "__main__":
    main()
