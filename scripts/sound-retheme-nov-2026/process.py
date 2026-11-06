"""Joe's recordings for the re-themed games (the sounds-retheme-nov-2026 branch, commit 293fcf51), cut and levelled with
scripts/sound-nov-2026/process.py's method (docs/sound-cues/levels-nov-2026.md), wired by docs/sound-cues/retheme-nov-2026.md.
Usage: python3 -I process.py <originals dir> <out dir> <report.json>

- effects: only true digital silence trimmed (under -60 dBFS, at least 10 ms kept before the attack, the tail judged at the
  final level), levelled to the library's median effect loudness for their length, peaks at most -1 dBFS (the transparent
  fast limiter on the opening spike only), mono 96 kbps;
- effect loops (2 s): the upload's own loop untouched (it joins cleanly), levelled to the library loops' median, mono;
- the ambience beds (8 s) and music_cross: levelled to the library beds' -18.45 LUFS, stereo 128 kbps; an ambience loops
  whole (its join is already clean), a bed that ends on a fade is cut on a matching bar (batch 6's make_loop).
"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
_path = os.path.join(HERE, "..", "sound-nov-2026", "process.py")
ns = {"__name__": "nov"}
exec(compile(open(_path).read().replace("\nmain()\n", "\n"), _path, "exec"), ns)

# upload file -> (slot, kind)
FILES = {
    "cross.closeCall.mp3": ("cross.closeCall", "effect"),
    "cross.comet.mp3": ("cross.pastBikes", "effect"),
    "cross.dock.mp3": ("cross.crossed", "effect"),
    "cross.freighter.mp3": ("cross.freighter", "effect"),
    "cross.hit.mp3": ("cross.lifeLost", "effect"),
    "cross.hop.mp3": ("cross.hop", "effect"),
    "cross.pass.mp3": ("cross.pastRoadworks", "effect"),
    "cross.streak.mp3": ("cross.streakUp", "effect"),
    "music_cross.mp3": ("music_cross", "music"),
    "slice.chilli.mp3": ("slice.chilli", "effect"),
    "swing.gate.mp3": ("swing.gate", "effect"),
    "swing.grab.mp3": ("swing.vineCreak", "effect"),
    "swing.jungle.mp3": ("swing.jungle", "ambience"),
    "swing.land.mp3": ("swing.land", "effect"),
    "swing.ptero.mp3": ("swing.pterodactyl", "effect"),
    "swing.release.mp3": ("swing.release", "effect"),
    "swing.slideVine.mp3": ("swing.slideVine", "loop"),
    "swing.splash.mp3": ("swing.splash", "effect"),
    "swing.streak.mp3": ("swing.streak", "effect"),
    "swing.wings.mp3": ("swing.wings", "loop"),
    "symscan.eagle.mp3": ("symscan.eagle", "effect"),
    "bintoss.ambience.mp3": ("bintoss.ambience", "ambience"),
    "bintoss.wind.mp3": ("bintoss.wind", "effect"),
    "bullseye.ambience.mp3": ("bullseye.ambience", "ambience"),
}


def main():
    src, out_dir, report = sys.argv[1:4]
    load, level, lufs, lufs_file, trim, to_mono, db = (ns[k] for k in ("load", "level", "lufs", "lufs_file", "trim", "to_mono", "db"))
    rows = []
    for name, (slot, kind) in sorted(FILES.items()):
        x = load(os.path.join(src, name))
        dst = os.path.join(out_dir, slot + ".mp3")
        info = {"slot": slot, "source": name, "kind": kind}
        if kind == "music":
            if ns["ends_on_fade"](x):
                y, loop = ns["make_music_loop"](x)
                info["loop"] = loop
            else:
                y = x
                info["loop"] = "whole file (no ending fade)"
            level(y, ns["LIB_MUSIC_LUFS"], "128k", dst)
        elif kind == "ambience":
            info["loop"] = "whole file (clean join)"
            level(x, ns["LIB_MUSIC_LUFS"], "128k", dst)
        elif kind == "loop":
            level(to_mono(x), ns["LIB_LOOP_LUFS"], "96k", dst, limited=True)
            info.update(target_lufs=ns["LIB_LOOP_LUFS"], limiter_db=round(level.reduction, 1))
        else:
            y, cut = trim(to_mono(x), 0.0)
            info["lead_cut_ms"] = round(cut / ns["SR"] * 1000, 1)
            target = next(t for d, t in ns["LIB_EFFECT_LUFS_BY_LEN"] if len(y) / ns["SR"] < d)
            g = target - lufs(y)
            y, _ = trim(y * 10 ** (g / 20), 0.0)
            y = y * 10 ** (-g / 20)
            level(y, target, "96k", dst, limited=True)
            info.update(target_lufs=target, limiter_db=round(level.reduction, 1))
        info["after_lufs"] = lufs_file(dst)
        info["after_peak"] = round(db(abs(load(dst)).max()), 2)
        rows.append(info)
        print(info, flush=True)
    json.dump(rows, open(report, "w"), indent=1)


main()
