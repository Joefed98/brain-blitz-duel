"""Crazy Golf gallery comparisons (a design tool): panels side by side, each labelled, 768 px tall.

    python3 scripts/shots/crazy-golf-compare.py <out.webp> <image> <label> [<image> <label> ...]
"""
import sys
from PIL import Image, ImageDraw, ImageFont
font = None
for f in ["/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"]:
    try: font = ImageFont.truetype(f, 26)
    except Exception: pass
def panel(path, label, h=768, w=355):
    im = Image.open(path).convert("RGB")
    im = im.resize((round(im.width * h / im.height), h), Image.LANCZOS)
    if im.width > w: im = im.crop(((im.width - w)//2, 0, (im.width - w)//2 + w, h))
    out = Image.new("RGB", (w, h + 48), (14, 14, 18))
    out.paste(im, (0, 48))
    ImageDraw.Draw(out).text((8, 8), label, fill=(240, 240, 240), font=font)
    return out
def row(panels, out):
    W = sum(p.width for p in panels) + 10 * (len(panels) - 1)
    H = max(p.height for p in panels)
    im = Image.new("RGB", (W, H), (14, 14, 18))
    x = 0
    for p in panels:
        im.paste(p, (x, 0)); x += p.width + 10
    im.save(out, "WEBP", quality=74, method=6)
    print(out, im.size)
args = sys.argv[1:]
out = args[0]
pairs = list(zip(args[1::2], args[2::2]))
row([panel(p, l) for p, l in pairs], out)
