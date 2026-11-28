"""
The jewellery close-up (S5 step 2, Joe, 28 Nov 2026): Captain Joulz in Diamond, (a) pavé and (b) solid cut gem, at
512, 168 and 36 px, on the dark page, for Joe to pick the plating style before any gem is rendered.

    python scripts/identity-art/jewel_closeup.py <renders dir> <out dir>

Reads <renders>/captain-joulz/jewel-pave.png and jewel-cut.png (avatar_build.py, 512 px masters); writes 2x WebPs and
closeup.html (screenshot it at DPR 2).
"""
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from contact_sheet import PAGES, ROOT  # noqa: E402

SIZES = (512, 168, 36)
OPTIONS = [("jewel-pave", "(a) Pavé", "White gold set with many small brilliant-cut stones, each faceted"),
           ("jewel-cut", "(b) Solid cut gem", "One carved stone: big flat facets, light passing through")]


def main():
    src, out = Path(sys.argv[1]), Path(sys.argv[2])
    out.mkdir(parents=True, exist_ok=True)
    c = PAGES["dark"]
    cols = []
    for name, title, line in OPTIONS:
        im = Image.open(src / "captain-joulz" / f"{name}.png").convert("RGBA")
        imgs = []
        for px in SIZES:
            f = f"{name}-{px}.webp"
            im.resize((px * 2, px * 2) if px * 2 <= im.width else (px, px), Image.LANCZOS).save(out / f, "WEBP", quality=90, method=6)
            imgs.append(f"<div class='s'><img src='{f}' width='{px}' height='{px}'><span>{px} px</span></div>")
        cols.append(f"<section><h2>{title}</h2><p>{line}</p>{''.join(imgs)}</section>")
    doc = f"""<!doctype html><html><head><meta charset='utf-8'>
<style>
@font-face {{ font-family: Archivo; src: url('{(ROOT / 'public/fonts/archivo-var-latin.woff2').as_uri()}') format('woff2'); font-weight: 100 900; font-stretch: 62% 125%; }}
body {{ margin: 0; background: {c['bg']}; color: {c['text']}; font-family: Archivo, sans-serif; }}
main {{ padding: 24px; display: flex; gap: 24px; }}
h1 {{ font-size: 24px; font-weight: 800; font-stretch: 115%; margin: 24px 24px 0; }}
.lead {{ color: {c['text3']}; font-size: 14px; margin: 6px 24px 0; }}
section {{ background: {c['panel']}; border: 1px solid {c['line']}; border-radius: 16px; padding: 16px; width: 544px; }}
h2 {{ font-size: 20px; margin: 0 0 4px; }}
p {{ color: {c['text2']}; font-size: 15px; margin: 0 0 12px; }}
.s {{ display: flex; flex-direction: column; align-items: center; gap: 6px; margin-bottom: 14px; }}
.s span {{ color: {c['text3']}; font-size: 13px; }}
</style></head><body>
<h1>Captain Joulz in Diamond: pavé or solid cut?</h1>
<p class='lead'>Blender close-up, dark page. Refraction 2.42 with dispersion; a white light inside the cut stone; no
sparkles added. Pick one; the other gems follow it.</p>
<main>{''.join(cols)}</main></body></html>"""
    (out / "closeup.html").write_text(doc)


if __name__ == "__main__":
    main()
