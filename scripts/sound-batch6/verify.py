"""Measure the encoded files. Usage: python3 -I verify.py <out dir> <report.json> <verify.json>"""
import subprocess, sys, json, os, re
import numpy as np

SR = 44100


def probe(p):
    o = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=sample_rate,channels,bit_rate:format=duration",
                        "-of", "json", p], capture_output=True, text=True).stdout
    j = json.loads(o)
    s = j["streams"][0]
    return int(s["sample_rate"]), int(s["channels"]), int(s.get("bit_rate", 0)), float(j["format"]["duration"])


def load(p, ch):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", p, "-f", "f32le", "-ac", str(ch), "-ar", str(SR), "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, ch).astype(np.float64)


def lufs(p):
    out = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", p, "-af", "ebur128=peak=true", "-f", "null", "-"],
                         capture_output=True, text=True).stderr
    summ = out[out.rfind("Summary:"):]
    i = float(re.search(r"I:\s+(-?[\d.]+) LUFS", summ).group(1))
    tp = float(re.search(r"Peak:\s+(-?[\d.]+) dBFS", summ).group(1))
    return i, tp


def rms100(m):
    n = int(SR * 0.1)
    if len(m) < n:
        return 10 * np.log10((m ** 2).mean() + 1e-12)
    c = np.cumsum(np.concatenate([[0], m ** 2]))
    return 10 * np.log10(((c[n:] - c[:-n]) / n).max() + 1e-12)


def loop_points(x):
    """The app's detectLoopPoints (src/lib/sound.ts): the first and last sample above -60 dB on any channel."""
    a = np.abs(x).max(1) > 0.001
    idx = np.nonzero(a)[0]
    return int(idx[0]), int(idx[-1]) + 1


def join_check(x):
    s, e = loop_points(x)
    y = x[s:e]
    m = y.mean(1)
    # Click: the sample step across the join against the loop's own steps.
    steps = np.abs(np.diff(y, axis=0)).max(1)
    p999 = float(np.percentile(steps, 99.9))
    join_step = float(np.abs(y[0] - y[-1]).max())
    # Jump: loudness 50 ms either side of the join against the same measure at 200 points inside the loop.
    w = int(0.05 * SR)

    def gap(a, b):
        return abs(10 * np.log10((a ** 2).mean() + 1e-12) - 10 * np.log10((b ** 2).mean() + 1e-12))

    jump = gap(m[-w:], m[:w])
    pts = range(w, len(m) - w, int(0.005 * SR))
    inside = np.array([gap(m[p - w:p], m[p:p + w]) for p in pts])
    jump_ok = jump <= max(3.0, float(inside.max()))
    click_ok = join_step <= p999
    return {"loop_s": round(len(y) / SR, 3), "join_step": round(join_step, 4), "step_p999": round(p999, 4),
            "jump_db": round(float(jump), 2), "jump_max_inside_db": round(float(inside.max()), 2),
            "passed": bool(jump_ok and click_ok), "lead_trim_ms": round(s / SR * 1000, 1)}


def main():
    out_dir, report, dst = sys.argv[1:4]
    rows = json.load(open(report))
    res = []
    for r in rows:
        p = os.path.join(out_dir, r["slot"] + ".mp3")
        sr, ch, br, dur = probe(p)
        x = load(p, ch)
        m = x.mean(1)
        pk = 20 * np.log10(np.abs(x).max() + 1e-12)
        lead = int(np.argmax(np.abs(x).max(1) > 10 ** ((pk - 40) / 20)))
        i, tp = lufs(p)
        v = {"slot": r["slot"], "sr": sr, "channels": ch, "kbps": round(br / 1000), "after_s": round(len(x) / SR, 3),
             "bytes": os.path.getsize(p), "peak_db": round(pk, 1), "true_peak_db": tp, "lufs": i,
             "rms100_db": round(rms100(m), 1), "lead_ms": round(lead / SR * 1000, 1)}
        if r["loop"]:
            v["join"] = join_check(x)
        res.append(v)
        print(v, flush=True)
    json.dump(res, open(dst, "w"), indent=1)


main()
