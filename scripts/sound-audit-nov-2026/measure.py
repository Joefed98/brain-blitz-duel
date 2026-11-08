"""The audio audit's per-file measures (docs/audit-nov-2026/audio.md), as JSON, for a before/after table.
Usage: python3 -I measure.py <out.json> <file.mp3>...

Per file: format (rate, channels, kbps), size, length, sample peak and true peak (ebur128, 4x oversampled), integrated
loudness (ebur128 with 1 s of silence padded either side, the file's own channels, as scripts/sound-nov-2026/measure.py),
the last 10 ms's RMS level and the last sample's level, the side channel's energy under the mid's (stereo files),
decoded memory at a 48 kHz context (what preloading costs), and for loops the join: the sample step and the slope break
across the join against the file's own 99th-percentile step, and the level change into the join over 50 ms and 400 ms
(the loop region is the app's -60 dBFS edge trim, detectLoopPoints)."""
import subprocess, sys, json, os
import numpy as np

SILENCE = 0.001


def probe(p):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=sample_rate,channels,bit_rate", "-of",
                          "json", p], capture_output=True, text=True, check=True).stdout
    s = json.loads(out)["streams"][0]
    return int(s["sample_rate"]), int(s["channels"]), round(int(s.get("bit_rate", 0)) / 1000)


def load(p, sr, ch):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", p, "-f", "f32le", "-ac", str(ch), "-ar", str(sr), "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, ch).astype(np.float64)


def db(v):
    return 20 * np.log10(max(float(v), 1e-12))


def lufs(x, sr):
    pad = np.zeros((sr, x.shape[1]))
    data = np.concatenate([pad, x, pad]).astype(np.float32).tobytes()
    out = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-f", "f32le", "-ac", str(x.shape[1]), "-ar", str(sr),
                          "-i", "-", "-af", "ebur128=peak=true", "-f", "null", "-"], input=data,
                         capture_output=True).stderr.decode()
    s = out[out.rfind("Summary:"):]
    i = float(s.split("I:")[1].split("LUFS")[0])
    tp = float(s.split("True peak:")[1].split("Peak:")[1].split("dBFS")[0])
    return i, tp


def rms_db(a):
    return 10 * np.log10((a ** 2).mean() + 1e-20) if len(a) else -200.0


def join(x, sr):
    m = x.mean(1)
    a = np.abs(x).max(1)
    idx = np.nonzero(a > SILENCE)[0]
    s, e = (idx[0], idx[-1] + 1) if len(idx) else (0, len(x))
    y = x[s:e]
    d = np.abs(np.diff(y, axis=0)).max(1)
    p99 = np.percentile(d, 99) or 1e-9
    step = np.abs(y[0] - y[-1]).max() / p99
    pred = 2 * y[-1] - y[-2]
    slope = np.abs(y[0] - pred).max() / p99
    ym = y.mean(1)
    lv = {}
    for w in (0.05, 0.4):
        n = int(w * sr)
        lv[str(int(w * 1000))] = round(rms_db(ym[:n]) - rms_db(ym[-n:]), 1)
    return {"step": round(float(step), 2), "slope": round(float(slope), 2), "level50": lv["50"], "level400": lv["400"],
            "trim_head_ms": round(s / sr * 1000, 1), "trim_tail_ms": round((len(x) - e) / sr * 1000, 1)}


def measure(p, loop=False):
    sr, ch, kbps = probe(p)
    x = load(p, sr, ch)
    i, tp = lufs(x, sr)
    n10 = max(1, int(0.010 * sr))
    r = {"rate": sr, "ch": ch, "kbps": kbps, "kb": round(os.path.getsize(p) / 1024, 1),
         "ms": round(len(x) / sr * 1000), "peak": round(db(np.abs(x).max()), 2), "true_peak": tp, "lufs": i,
         "last10": round(max(rms_db(x[-n10:, c]) for c in range(ch)), 1),
         "last_sample": round(db(np.abs(x[-1]).max()), 1),
         "mem_kb_48k": round(len(x) / sr * 48000 * ch * 4 / 1024)}
    if ch == 2:
        mid, side = (x[:, 0] + x[:, 1]) / 2, (x[:, 0] - x[:, 1]) / 2
        r["side_db"] = round(rms_db(side) - rms_db(mid), 1)
    if loop:
        r["join"] = join(x, sr)
    return r


if __name__ == "__main__":
    out, files = sys.argv[1], sys.argv[2:]
    loops = set(os.environ.get("LOOPS", "").split(","))
    res = {}
    for p in files:
        name = os.path.basename(p)
        res[name] = measure(p, name[:-4] in loops or name.startswith("music_"))
    json.dump(res, open(out, "w"), indent=1)
