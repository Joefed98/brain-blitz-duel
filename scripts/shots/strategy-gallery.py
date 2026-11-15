"""
Builds docs/design/pages-review/strategy/img/ from a strategy-shots run (the Strategy overhaul's gallery): each frame
shrunk to 360 px wide WebP, and each game's clip frames joined into one animated WebP. Run with -I from the repo root:

    python3 -I scripts/shots/strategy-gallery.py <shots dir>
"""
import sys
from pathlib import Path

from PIL import Image

SHOTS = Path(sys.argv[1])
OUT = Path("docs/design/pages-review/strategy/img")
OUT.mkdir(parents=True, exist_ok=True)
GAMES = ["tilt", "matchup", "bubble", "inkbridge", "balltrack"]

for game in GAMES:
    for phase in ["intro", "page", "play", "reveal"]:
        for tag in ["before", "after"]:
            src = SHOTS / f"{game}-{phase}-{tag}.png"
            if not src.exists():
                continue
            im = Image.open(src).convert("RGB")
            im = im.resize((360, round(im.height * 360 / im.width)), Image.LANCZOS)
            im.save(OUT / f"{game}-{phase}-{tag}.webp", "WEBP", quality=72, method=6)
    frames = sorted(SHOTS.glob(f"{game}-clip-*-after.png"), key=lambda p: int(p.stem.split("-")[2]))
    if frames:
        ims = []
        for f in frames:
            im = Image.open(f).convert("RGB")
            ims.append(im.resize((240, round(im.height * 240 / im.width)), Image.LANCZOS))
        ims[0].save(OUT / f"{game}-clip-after.webp", "WEBP", save_all=True, append_images=ims[1:], duration=300, loop=0, quality=60, method=6)

total = sum(p.stat().st_size for p in OUT.iterdir())
print(f"gallery images: {total / 1e6:.2f} MB in {OUT}")

# Stage 2: the effect clips (scripts/shots/strategy-fx-clips.ts frames, `<game>-<effect>-NN.png`), one animated WebP each.
if len(sys.argv) > 2:
    FX = Path(sys.argv[2])
    groups = {}
    for f in sorted(FX.glob("*-[0-9][0-9].png")):
        groups.setdefault(f.stem.rsplit("-", 1)[0], []).append(f)
    for name, files in sorted(groups.items()):
        ims = []
        for f in files:
            im = Image.open(f).convert("RGB")
            ims.append(im.resize((220, round(im.height * 220 / im.width)), Image.LANCZOS))
        ims[0].save(OUT / f"fx-{name}.webp", "WEBP", save_all=True, append_images=ims[1:], duration=66, loop=0, quality=62, method=6)
    total = sum(p.stat().st_size for p in OUT.iterdir())
    print(f"gallery images with effect clips: {total / 1e6:.2f} MB")
