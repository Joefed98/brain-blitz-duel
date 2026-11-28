"""
Before-and-after contact sheets for the Blender identity art (session S5): today's art beside the render, at the sizes
the app shows them on a phone (36, 56, 96 px and large), on the dark page and the light page.

Usage (any Python with Pillow, e.g. the bpy venv):
    python scripts/identity-art/contact_sheet.py <renders dir> <out dir> [--only=<piece>,…] [--before=<dir>]

--only keeps those pieces (the ladder strips are left out); --before shows an earlier render (that dir's
<piece>.webp) in the "before" row in place of today's art, for a revision of an approved piece.

Reads <renders>/<piece>.(png|webp) (identity_art.py's RGBA renders), writes into <out>: every piece trimmed and saved as
WebP at 2x each size (`<piece>-<px>.webp`, what a phone would load), and dark.html / light.html (390 px wide pages
that load them). Screenshot the pages to get the sheets.

Player colours (sheet 2): `tint:<hex>` pieces are not renders. They are composited here from the three tint passes
the way the app would draw them in CSS (sRGB, per pixel): the base image; inside the mask, the base multiplied by the
player colour (mix-blend-mode: multiply); then the gloss pass screened on top (mix-blend-mode: screen).
"""
import html
import sys
from pathlib import Path

from PIL import Image, ImageChops

ROOT = Path(__file__).resolve().parent.parent.parent
SIZES = (36, 56, 96, 168)
WIDE = (96, 160, 300)  # a podium is shown wide: its widths

SVG = "docs/art/svg"
BADGES = "docs/art/badges/svg"
FINISH = "docs/art/wave-2/items/avatar-finish"
EMBLEM_TIERS = [("spark", "Spark: bronze, matte"), ("charge", "Charge: silver, brushed"), ("volt", "Volt: gold, brushed"),
                ("surge", "Surge: platinum, polished"), ("storm", "Storm: obsidian and gold, polished"),
                ("lightning", "Lightning: electric gold, polished, live current"),
                ("top500", "Top 500: Lightning on its numbered plate (the app sets the number)")]

# (group, [(piece, label, today's art or None, layout)]): layout "square" (trimmed to the art), "frame" (one shared
# frame for the group, so sizes compare as in the app), "wide" (a podium).
SHEET2 = [
    ("Tier emblems", [(f"emblem-{t}", label, f"{SVG}/emblem-{'lightning' if t == 'top500' else t}.svg", "frame")
                      for t, label in EMBLEM_TIERS]),
    ("Avatars", [
        ("avatar-captain-paint", "Paint, helmet at 70 %, stripes toned down", "docs/art/avatars/svg/captain-joulz.svg", "square"),
        ("avatar-captain-paint-plain", "Paint on a plain dark disc", "docs/art/avatars/svg/captain-joulz.svg", "square"),
        ("avatar-captain-chrome", "Chrome (the chin “tooth” gone)", f"{FINISH}/chrome.png", "square"),
        ("avatar-captain-holographic", "Holographic, brighter", f"{FINISH}/holographic.png", "square"),
        ("avatar-captain-lightning-core", "Lightning Core", f"{FINISH}/lightning-core.png", "square"),
    ]),
    ("Player colours: rendered vs tinted in the app", [
        (f"avatar-captain-player-{i}", f"jz-player-{i} {name}, rendered", None, "square") if k == 0
        else (f"tint:{hexv}:{i}", f"jz-player-{i} {name}, tinted from the passes", None, "square")
        for i, name, hexv in ((12, "Olive", "#8F7F00"), (4, "Violet", "#8A65F0"), (17, "Cream", "#F7DFB7"))
        for k in (0, 1)
    ]),
    ("Badges: enamel pins", [
        ("pin-round-logic-master", "Round = skill · Logic Master (Epic, gold)", f"{BADGES}/logic-master.svg", "square"),
        ("pin-hexagon-hot-streak", "Hexagon = streaks · Hot Streak (Rare, silver)", f"{BADGES}/hot-streak.svg", "square"),
        ("pin-shield-giant-slayer", "Shield = competition · Giant Slayer (Elite), heavier sword", f"{BADGES}/giant-slayer.svg", "square"),
        ("pin-star-first-star", "Star = collection, 8-point starburst · First Star (Common)", f"{BADGES}/first-star.svg", "square"),
        ("pin-star5-first-star", "Star = collection, 5-point star · First Star (Common)", f"{BADGES}/first-star.svg", "square"),
    ]),
    ("Trophy and podium", [
        ("trophy-gold", "Gold trophy (unchanged from sheet 1)", f"{SVG}/trophy-gold.svg", "square"),
        ("podium-bolt", "Podium (a): the three steps make a bolt", None, "wide"),
        ("podium-block", "Podium (b): the wide block, a panel for name and total", None, "wide"),
    ]),
]

PAGES = {
    "dark": {"bg": "#06080F", "panel": "#0F1424", "line": "#1E2640", "text": "#EEF2FF", "text2": "#B5C6DD", "text3": "#8F9BBF"},
    "light": {"bg": "#F3F4F8", "panel": "#FFFFFF", "line": "#DCE0EA", "text": "#0B1020", "text2": "#3A4560", "text3": "#5A6480"},
}


def bbox(im):
    return im.getchannel("A").point(lambda a: 255 if a > 8 else 0).getbbox()


def square(im, box, pad=0.03):
    """Crop to `box`, padded, on a square canvas (so every size keeps the same framing)."""
    x0, y0, x1, y1 = box
    side = int(max(x1 - x0, y1 - y0) * (1 + 2 * pad))
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    out = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    out.paste(im.crop((int(cx - side / 2), int(cy - side / 2), int(cx + side / 2), int(cy + side / 2))), (0, 0))
    return out


def tinted(src, hexv):
    """The app's composite: base; base × colour inside the mask; the gloss screened on top."""
    load = lambda n: Image.open(next(src.glob(f"avatar-captain-tint-{n}.*"))).convert("RGBA")
    base, gloss, mask = load("base"), load("gloss"), load("mask")
    m = mask.convert("L").point(lambda v: min(255, v * 255 // 200))
    colour = Image.new("RGB", base.size, hexv)
    rgb = base.convert("RGB")
    out = Image.composite(ImageChops.multiply(rgb, colour), rgb, m)
    out = Image.composite(ImageChops.screen(out, gloss.convert("RGB")), out, m)
    out.putalpha(base.getchannel("A"))
    return out


def main():
    src, out = Path(sys.argv[1]), Path(sys.argv[2])
    out.mkdir(parents=True, exist_ok=True)
    opts = dict(a[2:].split("=", 1) for a in sys.argv[3:] if a.startswith("--") and "=" in a)
    only = set(opts["only"].split(",")) if "only" in opts else None
    before_dir = Path(opts["before"]) if "before" in opts else None
    pieces = SHEET2
    if only:
        pieces = [(g, [it for it in items if it[0] in only]) for g, items in pieces]
        pieces = [(g, items) for g, items in pieces if items]
    if before_dir:
        pieces = [(g, [(n, l, str((before_dir / f"{n}.webp").resolve()), lay) for n, l, _o, lay in items]) for g, items in pieces]
    total, count = {}, 0
    frame_box = {}
    for group, items in pieces:
        boxes = [bbox(Image.open(next(src.glob(f"{n}.*"))).convert("RGBA")) for n, _l, _o, lay in items if lay == "frame"]
        if boxes:
            frame_box[group] = (min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes))
    for group, items in pieces:
        for name, _label, _old, lay in items:
            if name.startswith("tint:"):
                im = tinted(src, name.split(":")[1])
                name = name.replace(":", "-").replace("#", "")
            else:
                im = Image.open(next(src.glob(f"{name}.*"))).convert("RGBA")
            count += 1
            if lay == "wide":
                b = bbox(im)
                im = im.crop((b[0] - 8, b[1] - 8, b[2] + 8, b[3] + 8))
                for w in WIDE:
                    p = out / f"{name}-w{w}.webp"
                    im.resize((w * 2, round(w * 2 * im.height / im.width)), Image.LANCZOS).save(p, "WEBP", quality=88, method=6)
                continue
            im = square(im, frame_box[group] if lay == "frame" else bbox(im))
            for px in SIZES:
                p = out / f"{name}-{px}.webp"
                im.resize((px * 2, px * 2), Image.LANCZOS).save(p, "WEBP", quality=88, method=6)
                total[px] = total.get(px, 0) + p.stat().st_size

    def today_url(name, old):
        if old.endswith(".png"):
            # A wave-2 shop board: the avatar alone, cut from the card it sits on.
            crop = out / f"today-{name}.png"
            Image.open(ROOT / old).convert("RGBA").crop((127, 77, 337, 287)).save(crop)
            return crop.as_uri()
        return Path(old).as_uri() if old.startswith("/") else (ROOT / old).as_uri()

    for page, c in PAGES.items():
        rows = []
        # The ladder strip: every tier side by side, today above, Blender below, at 36 and 56 px.
        emb = pieces[0][1] if len(pieces[0][1]) == 7 else []
        for px in (36, 56) if emb else ():
            t = "".join(f"<img src='{today_url(n, o)}' width='{px}' height='{px}' style='object-fit:contain'>" for n, _l, o, _ in emb)
            b = "".join(f"<img src='{n}-{px}.webp' width='{px}' height='{px}'>" for n, _l, _o, _ in emb)
            rows.append(f"<section><div class='label'>The ladder at {px} px, Spark → Top 500</div>"
                        f"<div class='strip'><span class='tag'>Today</span>{t}</div><div class='strip'><span class='tag'>Blender</span>{b}</div></section>")
        for group, items in pieces:
            rows.append(f"<h2>{html.escape(group)}</h2>")
            for name, label, old, lay in items:
                name = name.replace(":", "-").replace("#", "")
                if lay == "wide":
                    imgs = "".join(f"<img src='{name}-w{w}.webp' width='{w}'>" for w in WIDE)
                    rows.append(f"<section><div class='label'>{html.escape(label)}</div><div class='wide'>{imgs}</div></section>")
                    continue
                before = ""
                if old:
                    url = today_url(name, old)
                    before = "".join(f"<img src='{url}' width='{px}' height='{px}' style='object-fit:contain'>" for px in SIZES[:3])
                    before = f"<div class='row'><span class='tag'>{'Sheet 2' if before_dir else 'Today'}</span>{before}</div>"
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
.strip {{ display: flex; flex-wrap: wrap; align-items: center; gap: 4px; min-height: 64px; }}
.tag {{ width: 64px; flex: none; font-size: 13px; color: {c['text3']}; }}
.big {{ display: flex; justify-content: center; padding-top: 4px; }}
.wide {{ display: flex; flex-direction: column; align-items: center; gap: 12px; }}
</style></head><body><main>
<h1>Identity art: {'Lightning and Top 500' if only else 'style sheet 2'}</h1>
<p>Blender renders (S5) beside {'the version approved in sheet 2' if before_dir else 'today’s art'}, at phone sizes 36, 56 and 96 px and large. {page.capitalize()} page.</p>
<p>WebP at 2× ({html.escape(sizes)} for the {count} square pieces).</p>
{''.join(rows)}
</main></body></html>"""
        (out / f"{page}.html").write_text(doc)
    print("sizes", {k: f"{v / 1024:.1f} KB" for k, v in total.items()})


if __name__ == "__main__":
    main()
