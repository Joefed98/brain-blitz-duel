"""Builds the Pattern polish before/after contact sheets (not a check).

One sheet per game and viewport: a "before" row and an "after" row, each with
intro, mid-play, the completion moment at 0.15 / 0.5 / 0.9 s and the reveal,
at half scale.

    python3 scripts/pattern-shots/sheets.py <before-dir> <after-dir> <out-dir>
"""
import os
import sys

from PIL import Image, ImageDraw, ImageFont

GAMES = [
    ("unblock", "Gridlock"), ("blockparty", "Tessellate"), ("iceslide", "Skid"),
    ("gravity", "Topsy-Turvy"), ("tiles", "Jumbled"), ("rings", "Turntable"),
    ("laser", "Lightbender"), ("flow", "Chroma Lines"), ("pipes", "Pipeline"), ("push", "Heave"),
]
SIZES = ["375x667", "390x844"]
COLUMNS = [("intro", "Intro"), ("play", "Mid-play"), ("solve1", "Solve +0.15 s"),
           ("solve2", "Solve +0.5 s"), ("solve3", "Solve +0.9 s"), ("reveal", "Reveal")]
SCALE = 0.5
PAD = 10
LABEL_H = 22
ROW_LABEL_W = 70
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"


def main(before_dir: str, after_dir: str, out_dir: str) -> None:
    os.makedirs(out_dir, exist_ok=True)
    font = ImageFont.truetype(FONT, 13)
    bold = ImageFont.truetype(BOLD, 15)
    for game, name in GAMES:
        for size in SIZES:
            w, h = (int(v) for v in size.split("x"))
            tw, th = int(w * SCALE), int(h * SCALE)
            width = ROW_LABEL_W + len(COLUMNS) * (tw + PAD) + PAD
            height = 34 + LABEL_H + 2 * (th + PAD) + PAD
            sheet = Image.new("RGB", (width, height), (24, 22, 30))
            draw = ImageDraw.Draw(sheet)
            draw.text((PAD, 8), f"{name} ({game}) · {size} · before / after", fill=(240, 236, 228), font=bold)
            for c, (_, label) in enumerate(COLUMNS):
                draw.text((ROW_LABEL_W + c * (tw + PAD), 34), label, fill=(200, 196, 190), font=font)
            for r, (folder, row_label) in enumerate([(before_dir, "Before"), (after_dir, "After")]):
                y = 34 + LABEL_H + r * (th + PAD)
                draw.text((PAD, y + th // 2 - 8), row_label, fill=(240, 236, 228), font=bold)
                for c, (key, _) in enumerate(COLUMNS):
                    x = ROW_LABEL_W + c * (tw + PAD)
                    path = os.path.join(folder, f"{game}-{size}-{key}.png")
                    if os.path.exists(path):
                        image = Image.open(path).convert("RGB").resize((tw, th), Image.LANCZOS)
                        sheet.paste(image, (x, y))
                    else:
                        draw.rectangle((x, y, x + tw, y + th), outline=(120, 60, 60))
                        draw.text((x + 8, y + 8), "missing", fill=(220, 120, 120), font=font)
            sheet.save(os.path.join(out_dir, f"{game}-{size}.png"), optimize=True)


if __name__ == "__main__":
    main(*sys.argv[1:4])
