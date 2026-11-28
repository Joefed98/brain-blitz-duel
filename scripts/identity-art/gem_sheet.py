"""
The gem glow's contact sheet (S5 step 2, Joe's addition of 28 Nov 2026): avatars in a gem beside their plain paint, at
36, 56, 96 and 168 px, on the dark and light pages. Each avatar is its whole 100-unit box (never trimmed), so the
halo is seen exactly as the app draws it.

    python scripts/identity-art/gem_sheet.py <renders dir> <out dir> <id>:<gem>[,<gem>…] …

Reads <renders>/<id>/paint.png and gem-<gem>.png (avatar_build.py); writes 2x WebPs and dark.html / light.html.
"""
import html
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from contact_sheet import PAGES, ROOT  # noqa: E402

SIZES = (36, 56, 96, 168)
GLOW = {}  # filled from the arguments' order for the labels


def main():
    src, out = Path(sys.argv[1]), Path(sys.argv[2])
    out.mkdir(parents=True, exist_ok=True)
    rows = []
    for spec in sys.argv[3:]:
        aid, gems = spec.split(":")
        for v in ["paint"] + [f"gem-{g}" for g in gems.split(",")]:
            im = Image.open(src / aid / f"{v}.png").convert("RGBA")
            for px in SIZES:
                im.resize((px * 2, px * 2), Image.LANCZOS).save(out / f"{aid}-{v}-{px}.webp", "WEBP", quality=88, method=6)
        rows.append((aid, gems.split(",")))
    for page, c in PAGES.items():
        body = []
        for aid, gems in rows:
            for g in gems:
                label = f"{aid.replace('-', ' ').title()}: {g.replace('-', ' ').title()} beside the plain paint"
                line = lambda v: "".join(f"<img src='{aid}-{v}-{px}.webp' width='{px}' height='{px}'>" for px in SIZES[:3])  # noqa: E731
                body.append(
                    f"<section><div class='label'>{html.escape(label)}</div>"
                    f"<div class='row'><span class='tag'>Paint</span>{line('paint')}</div>"
                    f"<div class='row'><span class='tag'>{html.escape(g.title())}</span>{line('gem-' + g)}</div>"
                    f"<div class='big'><img src='{aid}-paint-168.webp' width='140' height='140'>"
                    f"<img src='{aid}-gem-{g}-168.webp' width='168' height='168'></div></section>"
                )
        doc = f"""<!doctype html><html><head><meta charset='utf-8'><meta name='viewport' content='width=390'>
<style>
@font-face {{ font-family: Archivo; src: url('{(ROOT / 'public/fonts/archivo-var-latin.woff2').as_uri()}') format('woff2'); font-weight: 100 900; font-stretch: 62% 125%; }}
body {{ margin: 0; background: {c['bg']}; color: {c['text']}; font-family: Archivo, sans-serif; width: 390px; }}
main {{ padding: 20px; }}
h1 {{ font-size: 24px; line-height: 30px; font-weight: 800; font-stretch: 115%; margin: 0 0 4px; }}
p {{ font-size: 13px; line-height: 18px; color: {c['text3']}; margin: 0 0 8px; }}
section {{ background: {c['panel']}; border: 1px solid {c['line']}; border-radius: 16px; padding: 12px 16px; margin-bottom: 12px; }}
.label {{ font-size: 15px; line-height: 20px; color: {c['text2']}; margin-bottom: 8px; }}
.row {{ display: flex; align-items: center; gap: 14px; min-height: 100px; }}
.tag {{ width: 64px; flex: none; font-size: 13px; color: {c['text3']}; }}
.big {{ display: flex; justify-content: center; align-items: center; gap: 12px; padding-top: 4px; }}
</style></head><body><main>
<h1>Gem avatars: the solid cut gem</h1>
<p>Joe’s pick (b): the body is the gem, one carved stone with flat facets, light through it, a soft backlight and rim
bloom in its colour, one or two small sparkles. Brighter the higher the gem: Amber softest, Diamond brightest. All inside
the avatar’s box; the disc stays the dark, toned-down disc. {page.capitalize()} page; the still image (the app adds a
gentle shimmer).</p>
{''.join(body)}
</main></body></html>"""
        (out / f"{page}.html").write_text(doc)


if __name__ == "__main__":
    main()
