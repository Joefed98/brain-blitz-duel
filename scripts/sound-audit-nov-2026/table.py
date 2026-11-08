"""The before/after table for docs/audit-nov-2026/audio-fixes.md, from measure.py's JSON for the originals and the
fixed files and fix.py's report. Usage: python3 -I table.py <before.json> <after.json> <report.json> <slots.json>

Loudness is as played: a file made mono reads 3.0 dB lower on ebur128 (one channel) than the same sound as two
identical channels, which is how Web Audio plays a mono buffer, so its after figure adds 3.0 dB to stay comparable."""
import json, sys

b, a, r, sl = (json.load(open(p)) for p in sys.argv[1:5])


def fmt(m):
    return f"{m['rate'] / 1000:g}k {'mo' if m['ch'] == 1 else 'st'} {min((96, 112, 128, 192), key=lambda k: abs(k - m['kbps']))}"


def played(k, m):
    return m["lufs"] + (3.01 if b[k]["ch"] == 2 and m["ch"] == 1 else 0)


def what(ops):
    out = []
    if "loop_recut" in ops:
        o = ops["loop_recut"]
        out.append(f"loop re-cut ({o['crossfade_ms']} ms crossfade)")
    if "bed_crossfade" in ops:
        out.append(f"last bar crossfades into the first ({ops['bed_crossfade']['crossfade_ms']} ms)")
    if "loudness" in ops:
        out.append(f"to target {ops['loudness']['target']:g}")
    if "true_peak_over_0" in ops:
        out.append("true peak over 0")
    if "level" in ops and ops["level"]["by"].startswith("limiter"):
        out.append(ops["level"]["by"])
    if "tail_fade_ms" in ops:
        out.append(f"tail fade {ops['tail_fade_ms']:g} ms")
    if "floor_faded_ms" in ops:
        out.append(f"lifted floor faded ({ops['floor_faded_ms']} ms)")
    if "mono" in ops:
        out.append(f"mono (side {ops['mono']['side_db']:g} dB)")
    return "; ".join(out)


print("| File | Changes | Format | Length ms | True peak dBFS | LUFS as played | Last 10 ms / last sample dBFS | Loop join (step ×, slope ×, level 50 / 400 ms) | Decoded KB at 48 kHz |")
print("|---|---|---|---|---|---|---|---|---|")
for k in sorted(a):
    x, y = b[k], a[k]
    join = ""
    if "join" in x:
        j0, j1 = x["join"], y["join"]
        join = (f"{j0['step']:.2f}, {j0['slope']:.2f}, {j0['level50']:+.1f} / {j0['level400']:+.1f} → "
                f"{j1['step']:.2f}, {j1['slope']:.2f}, {j1['level50']:+.1f} / {j1['level400']:+.1f}")
    fm = fmt(x) if fmt(x) == fmt(y) else f"{fmt(x)} → {fmt(y)}"
    ln = f"{x['ms']}" if x["ms"] == y["ms"] else f"{x['ms']} → {y['ms']}"
    print(f"| {k} | {what(r[k]['ops'])} | {fm} | {ln} | {x['true_peak']:+.1f} → {y['true_peak']:+.1f} | "
          f"{x['lufs']:.1f} → {played(k, y):.1f} | {x['last10']:.0f} / {x['last_sample']:.0f} → {y['last10']:.0f} / "
          f"{y['last_sample']:.0f} | {join} | {x['mem_kb_48k']} → {y['mem_kb_48k']} |")
