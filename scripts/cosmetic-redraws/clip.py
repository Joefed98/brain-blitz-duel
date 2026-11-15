"""Assembles a folder of PNG frames into an animated WebP clip (the samples' clips). python3 clip.py <frames dir> <out.webp> [fps] [width]"""
import glob
import sys

from PIL import Image

src, out = sys.argv[1], sys.argv[2]
fps = float(sys.argv[3]) if len(sys.argv) > 3 else 15
width = int(sys.argv[4]) if len(sys.argv) > 4 else 0
frames = []
for f in sorted(glob.glob(f"{src}/*.png")):
    im = Image.open(f).convert("RGB")
    if width and im.width != width:
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    frames.append(im)
frames[0].save(out, save_all=True, append_images=frames[1:], duration=round(1000 / fps), loop=0, quality=58, method=6)
print(out, len(frames), "frames")
