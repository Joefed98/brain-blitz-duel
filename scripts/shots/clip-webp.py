"""Joins a folder of PNG frames (sorted) into a looping animated WebP, scaled to `--width` (default 300), for the gallery.

    python3 scripts/shots/clip-webp.py <frames dir> <out.webp> [--width=300] [--ms=50] [--quality=60]
"""
import glob
import sys

from PIL import Image

args = [a for a in sys.argv[1:] if not a.startswith("--")]
opts = dict(a[2:].split("=", 1) for a in sys.argv[1:] if a.startswith("--"))
width = int(opts.get("width", 300))
frames = []
for path in sorted(glob.glob(f"{args[0]}/*.png")):
    im = Image.open(path).convert("RGB")
    frames.append(im.resize((width, round(im.height * width / im.width)), Image.LANCZOS))
frames[0].save(args[1], save_all=True, append_images=frames[1:], duration=int(opts.get("ms", 50)), loop=0, quality=int(opts.get("quality", 60)), method=6)
print(f"{args[1]}: {len(frames)} frames")
