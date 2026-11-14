"""Palette-compresses the components step's review shots into docs/design/components-review/ (a design tool).

    python3 -I scripts/shots/components-review-pack.py [--in=.shots/components-review]

Each PNG keeps its 390 px phone width and is quantized to 96 colours (the screens are flat colour), so the whole
gallery stays well under 1.5 MB.
"""
import os
import sys

from PIL import Image

SRC = next((a[5:] for a in sys.argv if a.startswith("--in=")), ".shots/components-review")
OUT = "docs/design/components-review"
os.makedirs(OUT, exist_ok=True)
total = 0
for name in sorted(os.listdir(SRC)):
    if not name.endswith(".png"):
        continue
    im = Image.open(os.path.join(SRC, name)).convert("RGB")
    q = im.quantize(colors=96, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    path = os.path.join(OUT, name)
    q.save(path, optimize=True)
    size = os.path.getsize(path)
    total += size
    print(f"{name} {im.size[0]}x{im.size[1]} {size // 1024} KB")
print(f"total {total // 1024} KB")
