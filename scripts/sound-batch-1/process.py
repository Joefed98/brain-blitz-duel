"""Sound batch 1 (16 Nov 2026): Joe's 153 ElevenLabs recordings for the Logic, Speed and Attention overhauls
(docs/sound-cues/sounds-batch-1.csv), cut and levelled to the house standard (docs/sound-cues/levels-nov-2026.md).
Usage: python3 -I scripts/sound-batch-1/process.py <originals dir> <out dir> <report.json> [csv]

Originals: the uploads on branch sounds-batch-1, commit e810f88d (`git show e810f88d:<file>`).

Per file (none of batch 1 is a loop; a row with loop = yes would be levelled whole to the loops' -16.8 LUFS and
encoded with fix.py's wrap-around frames, never cut):
- decoded to mono (the channels' mean) at 44.1 kHz;
- the lead trimmed to the attack: the first sample over -60 dBFS (digital silence, so nothing of the sound is lost),
  1 ms of that silence kept before it;
- the tail trimmed where the sound falls under 59 dB below its own peak (-60 dBFS at the final level);
- cut to the CSV's target_ms if still longer, with a 10 ms raised-cosine fade-out; a file already shorter keeps its
  length (never stretched) and gets a 5 ms fade on its last samples;
- levelled as scripts/sound-review-nov-2026/make.py levels: the library's effect median for its length (under 0.25 s
  -22.7 LUFS, 0.25-0.5 s -17.5, 0.5-0.9 s -17.1, longer -16.5), true peak at -1 dBFS or under, the fast lookahead
  limiter only while transparent (what it removes at least 14 dB under the sound), else short of the median;
- MP3 mono 96 kbps CBR with the LAME gapless tag (fix.write).
A file that replaces a November placeholder (src/lib/fx/newGameSounds.data.ts) is also held to that data's limits
(sound-review-fixes-check: at most 4.5 dB under the target, at most 15,000 bytes): the limiter is pushed past
transparent where needed (its distortion reported) and the tail shortened a frame at a time where needed.

The report also carries the measures used to flag retakes (docs/sound-cues/batch-1-wiring.md, "Retakes").
"""
import csv, json, os, sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "sound-audit-nov-2026"))
import fix  # noqa: E402

SR = 44100
TP_MAX = fix.TP_MAX
SILENCE = 10 ** (-60 / 20)
FRAME = 1152
# The files that replace the November placeholders (src/lib/fx/newGameSounds.data.ts) keep that data's limits
# (scripts/sound-review-fixes-check.ts): at most 4.5 dB under the target, at most 15,000 bytes for a one-shot.
PLACEHOLDER_MAX_SHORT, PLACEHOLDER_MAX_BYTES = 4.5, 15_000
_DATA = os.path.join(HERE, "..", "..", "src", "lib", "fx", "newGameSounds.data.ts")
PLACEHOLDERS = set(__import__("re").findall(r'file: "([^"]+)"', open(_DATA).read())) if os.path.exists(_DATA) else set()


def decode(path):
    x, sr, ch, _ = fix.load(path)
    raw = x
    m = x.mean(1)
    if sr != SR:
        import subprocess
        out = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"],
                             capture_output=True, check=True).stdout
        m = np.frombuffer(out, np.float32).astype(np.float64)
    return m, raw, sr


def env_db(m, win=0.005):
    n = max(1, int(win * SR))
    k = len(m) // n
    if k == 0:
        return np.array([-120.0])
    e = np.sqrt((m[: k * n].reshape(k, n) ** 2).mean(1) + 1e-20)
    return 20 * np.log10(e)


def onsets(m):
    """Separate events: the envelope (5 ms windows) falling 25 dB under the peak window for 60 ms or more, then rising
    back within 8 dB of it."""
    e = env_db(m)
    top = e.max()
    events, low_run, in_event = 0, 0, False
    for v in e:
        if v > top - 8:
            if not in_event:
                if events == 0 or low_run >= 12:
                    events += 1
                in_event = True
            low_run = 0
        elif v < top - 25:
            in_event = False
            low_run += 1
    return events


def target_lufs(secs, loop):
    if loop:
        return fix.LOOP_LUFS
    return next(t for d, t in fix.EFFECT_BY_LEN if secs < d)


def level(x, path, loop, max_short=None):
    """make.py's build loop: gain to the target, the limiter only while transparent, true peak at -1 dBFS or under.
    With max_short (a file that replaces a November placeholder, held to sound-review-fixes-check's 4.5 dB), the
    limiter is then pushed past transparent until the file is at most that far under its target; the distortion it
    adds is reported (`forced_distortion_db`)."""
    secs = len(x) / SR
    goal = target_lufs(secs, loop)
    m = x[:, None]
    meter = (lambda d: np.tile(d, (2, 1))) if loop else (lambda d: d)
    lufs_in, _ = fix.ebur(meter(m), SR)
    gain = goal - lufs_in
    limited = False

    def render(g, lim):
        y = m * 10 ** (g / 20)
        if lim:
            y = fix.limit(y, SR)
        fix.write(path, y, SR, SR, 96, loop)
        return fix.ebur(meter(fix.load(path)[0]), SR)

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
    lufs_out, tp = fix.ebur(meter(fix.load(path)[0]), SR)
    forced = None
    if max_short is not None and goal - lufs_out > max_short:
        limited = True
        for _ in range(12):
            if goal - lufs_out <= max_short - 0.1 and tp <= TP_MAX:
                break
            gain += (goal - lufs_out) - (max_short - 0.3) if goal - lufs_out > max_short - 0.1 else -(tp - TP_MAX + 0.05)
            lufs_out, tp = render(gain, True)
        y = m * 10 ** (gain / 20)
        forced = round(fix.distortion_db(y, fix.limit(y, SR)), 1)
    for _ in range(6):
        # The loop can end on a step up that overshot: turn down until the true peak is at -1 dBFS or under.
        if tp <= TP_MAX:
            break
        gain -= tp - TP_MAX + 0.05
        lufs_out, tp = render(gain, limited)
    dec = fix.load(path)[0]
    lufs_out, tp = fix.ebur(meter(dec), SR)
    return {"ms": round(len(dec) / SR * 1000), "bytes": os.path.getsize(path), "lufs": round(lufs_out, 1),
            "target": goal, "truePeak": round(tp, 1), "peak": round(fix.db(np.abs(dec).max()), 1), "limited": limited,
            "short_db": round(goal - lufs_out, 1), **({"forced_distortion_db": forced} if forced is not None else {})}


def process(row, src, outdir):
    name, target_ms, loop = row["file"], int(row["target_ms"]), row["loop"].strip().lower() == "yes"
    m, raw, raw_sr = decode(os.path.join(src, name))
    r = {"file": name, "slot": row["slot"], "pr": row["pr"], "category": row["category"], "target_ms": target_ms,
         "loop": loop, "raw_ms": round(len(m) / SR * 1000), "raw_rate": raw_sr, "raw_ch": raw.shape[1]}
    a = np.abs(raw)
    r["raw_peak"] = round(fix.db(a.max()), 2)
    # Clipping: three or more samples running at full scale on a channel.
    full = a >= 0.999
    r["clip_runs"] = int(sum(((full[2:, c] & full[1:-1, c] & full[:-2, c]).sum()) for c in range(raw.shape[1])))
    r["raw_lufs"] = round(fix.ebur(m[:, None], SR)[0], 1)
    peak = np.abs(m).max()
    loud = np.nonzero(np.abs(m) > SILENCE)[0]
    if peak < 1e-6 or not len(loud):
        r["empty"] = True
        return r
    r["lead_ms"] = round(loud[0] / SR * 1000)
    if loop:
        x = m - m.mean()
    else:
        start = max(0, loud[0] - int(0.001 * SR))
        tail_floor = peak * 10 ** (-59 / 20)
        end = np.nonzero(np.abs(m) > tail_floor)[0][-1] + 1
        x = m[start:end].copy()
        r["sound_ms"] = round(len(x) / SR * 1000)
        # How much of the sound the target cuts off, and how loud it still was there (a long tail, often reverb).
        cut_at = int(target_ms / 1000 * SR)
        if len(x) > cut_at:
            rest = x[cut_at:]
            r["cut_ms"] = round(len(rest) / SR * 1000)
            r["cut_energy_db"] = round(10 * np.log10((rest ** 2).sum() / ((x ** 2).sum() + 1e-20) + 1e-20), 1)
            r["level_at_cut_db"] = round(float(env_db(x[max(0, cut_at - 441):cut_at + 441], 0.02).max() - env_db(x).max()), 1)
            x = x[:cut_at]
            f = min(len(x), int(0.010 * SR))
            x[-f:] *= 0.5 * (1 + np.cos(np.linspace(0, np.pi, f)))
        else:
            f = min(len(x), int(0.005 * SR))
            x[-f:] *= 0.5 * (1 + np.cos(np.linspace(0, np.pi, f)))
        # Active share: 5 ms windows within 30 dB of the loudest, over the kept sound.
        e = env_db(x)
        r["active_share"] = round(float((e > e.max() - 30).mean()), 2)
        r["events"] = onsets(x)
    capped = name in PLACEHOLDERS
    out = os.path.join(outdir, name)
    r.update(level(x, out, loop, PLACEHOLDER_MAX_SHORT if capped else None))
    while capped and r["bytes"] > PLACEHOLDER_MAX_BYTES and len(x) > 2 * FRAME:
        # sound-review-fixes-check's size aim for a one-shot: shorten the tail a frame at a time, faded again.
        x = x[:-FRAME].copy()
        f = int(0.010 * SR)
        x[-f:] *= 0.5 * (1 + np.cos(np.linspace(0, np.pi, f)))
        r.update(level(x, out, loop, PLACEHOLDER_MAX_SHORT))
        r["shortened_for_size"] = True
    return r


def main():
    src, outdir, report = sys.argv[1:4]
    path = sys.argv[4] if len(sys.argv) > 4 else os.path.join(HERE, "..", "..", "docs", "sound-cues", "sounds-batch-1.csv")
    rows = list(csv.DictReader(open(path)))
    only = set(os.environ.get("ONLY", "").split(",")) - {""}
    res = []
    for row in rows:
        if only and row["file"] not in only:
            continue
        r = process(row, src, outdir)
        res.append(r)
        print(f"{r['file']:34} {r.get('raw_ms', 0):5} -> {r.get('ms', 0):5} ms  {r.get('lufs', '-'):>6} LUFS "
              f"(target {r.get('target', '-')}) tp {r.get('truePeak', '-')}{'  LIMITED' if r.get('limited') else ''}")
    json.dump(res, open(report, "w"), indent=1)


if __name__ == "__main__":
    main()
