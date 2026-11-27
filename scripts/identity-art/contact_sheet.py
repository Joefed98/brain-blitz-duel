"""
Before-and-after contact sheets for the Blender identity art (session S5): today's SVG beside the render, at the sizes
the app shows them on a phone (36, 56, 96 px and large), on the dark page and the light page.

Usage (any Python with Pillow, e.g. the bpy venv):
    python scripts/identity-art/contact_sheet.py <renders dir> <out dir>

Reads <renders>/<piece>.png (identity_art.py's RGBA renders), writes into <out>: every piece trimmed and saved as WebP
at 2x each size (`<piece>-<px>.webp`, what a phone would load), and dark.html / light.html (390 px wide pages that
load them). Screenshot the pages to get the sheets.
"""
import html
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent.parent
SIZES = (36, 56, 96, 168)

# piece → (label, today's art, or None where today's piece is a flat panel)
PIECES = [
    ("Avatar", [
        ("avatar-captain-paint", "Captain Joulz, paint (player colour)", "docs/art/avatars/svg/captain-joulz.svg"),
        ("avatar-captain-chrome", "Chrome finish", "docs/art/wave-2/items/avatar-finish/chrome.png"),
        ("avatar-captain-holographic", "Holographic finish", "docs/art/wave-2/items/avatar-finish/holographic.png"),
        ("avatar-captain-lightning-core", "Lightning Core finish", "docs/art/wave-2/items/avatar-finish/lightning-core.png"),
    ]),
    ("Tier emblem", [
        ("emblem-storm", "Storm, division II (two of three pips)", "docs/art/svg/emblem-storm.svg"),
    ]),
    ("Badges: enamel pins", [
        ("pin-round-logic-master", "Round = skill · Logic Master (Epic, gold)", "docs/art/badges/svg/logic-master.svg"),
        ("pin-hexagon-hot-streak", "Hexagon = streaks · Hot Streak (Rare, silver)", "docs/art/badges/svg/hot-streak.svg"),
        ("pin-shield-giant-slayer", "Shield = competition · Giant Slayer (Elite, black nickel)", "docs/art/badges/svg/giant-slayer.svg"),
        ("pin-star-first-star", "Star = collection · First Star (Common, bronze)", "docs/art/badges/svg/first-star.svg"),
    ]),
    ("Trophy and podium", [
        ("trophy-gold", "Gold trophy", "docs/art/svg/trophy-gold.svg"),
        ("podium-gold", "Podium step, first place", None),
    ]),
]

PAGES = {
    "dark": {"bg": "#06080F", "panel": "#0F1424", "line": "#1E2640", "text": "#EEF2FF", "text2": "#B5C6DD", "text3": "#8F9BBF"},
    "light": {"bg": "#F3F4F8", "panel": "#FFFFFF", "line": "#DCE0EA", "text": "#0B1020", "text2": "#3A4560", "text3": "#5A6480"},
}


def trim(im, pad=0.03):
    """Crop to the art's alpha, padded, on a square canvas (so every size keeps the same framing)."""
    box = im.getchannel("A").point(lambda a: 255 if a > 8 else 0).getbbox()
    x0, y0, x1, y1 = box
    side = max(x1 - x0, y1 - y0)
    side = int(side * (1 + 2 * pad))
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    out = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    out.paste(im.crop((int(cx - side / 2), int(cy - side / 2), int(cx + side / 2), int(cy + side / 2))), (0, 0))
    return out


def main():
    src, out = Path(sys.argv[1]), Path(sys.argv[2])
    out.mkdir(parents=True, exist_ok=True)
    total = {}
    for _group, items in PIECES:
        for name, _label, _old in items:
            im = trim(Image.open(next(src.glob(f"{name}.*"))).convert("RGBA"))
            for px in SIZES:
                p = out / f"{name}-{px}.webp"
                im.resize((px * 2, px * 2), Image.LANCZOS).save(p, "WEBP", quality=88, method=6)
                total[px] = total.get(px, 0) + p.stat().st_size
    for page, c in PAGES.items():
        rows = []
        for group, items in PIECES:
            rows.append(f"<h2>{html.escape(group)}</h2>")
            for name, label, old in items:
                before = ""
                if old and old.endswith(".png"):
                    # A wave-2 shop board: the avatar alone, cut from the card it sits on.
                    crop = out / f"today-{name}.png"
                    Image.open(ROOT / old).convert("RGBA").crop((127, 77, 337, 287)).save(crop)
                    old = str(crop)
                if old:
                    url = (ROOT / old).as_uri() if not old.startswith("/") else Path(old).as_uri()
                    before = "".join(f"<img src='{url}' width='{px}' height='{px}' style='object-fit:contain'>" for px in SIZES[:3])
                    before = f"<div class='row'><span class='tag'>Today</span>{before}</div>"
                after = "".join(f"<img src='{name}-{px}.webp' width='{px}' height='{px}'>" for px in SIZES[:3])
                rows.append(
                    f"<section><div class='label'>{html.escape(label)}</div>{before}"
                    f"<div class='row'><span class='tag'>Blender</span>{after}</div>"
                    f"<div class='big'><img src='{name}-168.webp' width='168' height='168'></div></section>"
                )
        sizes = " · ".join(f"{px} px: {total[px] / 1024:.0f} KB" for px in SIZES)
        doc = f"""<!doctype html><html><head><meta charset='utf-8'><meta name='viewport' content='width=390'>
<style>
@font-face {{ font-family: Archivo; src: url('{(ROOT / 'public/fonts/archivo-var-latin.woff2').as_uri()}') format('woff2'); font-weight: 100 900; font-stretch: 62% 125%; }}
body {{ margin: 0; background: {c['bg']}; color: {c['text']}; font-family: Archivo, sans-serif; width: 390px; }}
main {{ padding: 20px; }}
h1 {{ font-size: 24px; line-height: 30px; font-weight: 800; font-stretch: 115%; margin: 0 0 4px; }}
p {{ font-size: 13px; line-height: 18px; color: {c['text3']}; margin: 0 0 8px; }}
h2 {{ font-size: 20px; line-height: 26px; font-weight: 700; margin: 24px 0 8px; }}
section {{ background: {c['panel']}; border: 1px solid {c['line']}; border-radius: 16px; padding: 12px 16px; margin-bottom: 12px; }}
.label {{ font-size: 15px; line-height: 20px; color: {c['text2']}; margin-bottom: 8px; }}
.row {{ display: flex; align-items: center; gap: 14px; min-height: 100px; }}
.tag {{ width: 64px; font-size: 13px; color: {c['text3']}; }}
.big {{ display: flex; justify-content: center; padding-top: 4px; }}
</style></head><body><main>
<h1>Identity art: style sheet</h1>
<p>Blender renders (S5, step 1) beside today’s art, at phone sizes 36, 56 and 96 px and large. {page.capitalize()} page.</p>
<p>WebP at 2× ({html.escape(sizes)} for all {sum(len(i) for _, i in PIECES)} pieces).</p>
{''.join(rows)}
</main></body></html>"""
        (out / f"{page}.html").write_text(doc)
    print("sizes", {k: f"{v / 1024:.1f} KB" for k, v in total.items()})


if __name__ == "__main__":
    main()
