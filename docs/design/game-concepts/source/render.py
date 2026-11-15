"""Render one concept: python render.py <category> <game-id> <look> [--fast]

Builds the scene from games/<game-id>.py (build(look) -> spec), renders with Cycles on the CPU, then in post adds a
soft bloom, the placeholder header band and the game's HUD pills, and writes
docs/design/game-concepts/<category>/<game-id>-<look>.webp (720 px tall) and a 240 px thumbnail.
"""
import sys, os, importlib, time
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, 'games'))
import lib
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageChops
import numpy as np

ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
FONT = os.path.join(ROOT, 'public', 'fonts', 'archivo-var-latin.woff2')
OUT_H = 720


def font(size, weight=b'Bold'):
    f = ImageFont.truetype(FONT, size)
    try:
        f.set_variation_by_name(weight)
    except Exception:
        pass
    return f


STYLES = {
    # Look A: neutral dark glass pills, white text
    'A': dict(fill=(10, 12, 16, 170), edge=(255, 255, 255, 40), label=(196, 198, 210), value=(250, 250, 252)),
    # Look B: Joulz navy with champagne gold values
    'B': dict(fill=(8, 12, 28, 190), edge=(226, 196, 128, 90), label=(170, 176, 200), value=(242, 213, 150)),
}


def bloom(img, threshold=0.72, radius=18, strength=0.55):
    a = np.asarray(img).astype(np.float32) / 255.0
    lum = a.max(axis=2, keepdims=True)
    bright = np.clip((lum - threshold) / (1 - threshold), 0, 1) * a
    b = Image.fromarray((bright * 255).astype(np.uint8))
    acc = np.zeros_like(a)
    for r, w in ((radius * 0.35, 0.5), (radius, 0.35), (radius * 2.6, 0.25)):
        acc += np.asarray(b.filter(ImageFilter.GaussianBlur(r))).astype(np.float32) / 255.0 * w
    out = 1 - (1 - a) * (1 - np.clip(acc * strength, 0, 1))
    return Image.fromarray((np.clip(out, 0, 1) * 255).astype(np.uint8))


def vignette(img, amount=0.22):
    w, h = img.size
    y, x = np.mgrid[0:h, 0:w]
    d = np.sqrt(((x - w / 2) / (w / 2)) ** 2 + ((y - h / 2) / (h / 2)) ** 2) / 1.42
    f = 1 - amount * np.clip(d, 0, 1) ** 2.2
    a = np.asarray(img).astype(np.float32) * f[..., None]
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


def grain(img, amount=3.0, seed=7):
    rng = np.random.default_rng(seed)
    a = np.asarray(img).astype(np.float32)
    n = rng.normal(0, amount, a.shape[:2])[..., None]
    return Image.fromarray(np.clip(a + n, 0, 255).astype(np.uint8))


def pill(d, x, y, label, value, st, s, align='left'):
    fl, fv = font(int(9 * s), b'Bold'), font(int(13 * s), b'ExtraBold')
    lw = d.textlength(label, font=fl) if label else 0
    vw = d.textlength(value, font=fv)
    pad, gap = 9 * s, (6 * s if label else 0)
    w = pad * 2 + lw + gap + vw
    h = 24 * s
    if align == 'right':
        x = x - w
    d.rounded_rectangle([x, y, x + w, y + h], radius=h / 2, fill=st['fill'], outline=st['edge'], width=max(1, int(s)))
    if label:
        d.text((x + pad, y + h / 2), label, font=fl, fill=st['label'], anchor='lm')
    d.text((x + pad + lw + gap, y + h / 2 + 0.5 * s), value, font=fv, fill=st['value'], anchor='lm')


def header(img, name, s, look):
    """Placeholder band for the game frame header: name block, timer ring, score block, menu dots."""
    d = ImageDraw.Draw(img, 'RGBA')
    w = img.width
    hh = lib.HEADER_PX * s
    d.rectangle([0, 0, w, hh], fill=(7, 7, 10, 255))
    d.line([0, hh, w, hh], fill=(255, 255, 255, 22), width=1)
    d.text((14 * s, 21 * s), name, font=font(int(17 * s), b'ExtraBold'), fill=(245, 245, 247), anchor='lm')
    d.rounded_rectangle([14 * s, 35 * s, 92 * s, 45 * s], radius=4 * s, fill=(255, 255, 255, 34))
    cx, cy, r = w / 2, 30 * s, 20 * s
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(255, 255, 255, 60), width=int(3 * s))
    d.arc([cx - r, cy - r, cx + r, cy + r], -90, 150, fill=(242, 199, 92, 230), width=int(3 * s))
    d.text((cx, cy), '42', font=font(int(14 * s), b'ExtraBold'), fill=(245, 245, 247), anchor='mm')
    d.rounded_rectangle([w - 104 * s, 17 * s, w - 56 * s, 27 * s], radius=4 * s, fill=(255, 255, 255, 30))
    d.rounded_rectangle([w - 98 * s, 33 * s, w - 62 * s, 43 * s], radius=4 * s, fill=(255, 255, 255, 46))
    for i in range(3):
        d.ellipse([w - 28 * s - 2 * s, (22 + i * 7) * s - 2 * s, w - 28 * s + 2 * s, (22 + i * 7) * s + 2 * s], fill=(255, 255, 255, 120))


def main():
    cat, gid, look = sys.argv[1], sys.argv[2], sys.argv[3]
    fast = '--fast' in sys.argv
    mod = importlib.import_module(gid)
    t0 = time.time()
    spec = mod.build(look) or {}
    s = lib.bpy.context.scene
    if spec.get('view'):
        s.view_settings.view_transform = spec['view']
        s.view_settings.look = 'None'
    if spec.get('agx_look'):
        s.view_settings.look = spec['agx_look']
    if fast:
        s.cycles.samples = 16
        s.render.resolution_percentage = 60
    raw = f'/tmp/cc/raw-{gid}-{look}.png'
    s.render.filepath = raw
    lib.bpy.ops.render.render(write_still=True)
    print('render', gid, look, round(time.time() - t0, 1), 's')
    img = Image.open(raw).convert('RGB')
    img = bloom(img, spec.get('bloom_threshold', 0.72), radius=img.height / 60, strength=spec.get('bloom', 0.5))
    img = vignette(img, spec.get('vignette', 0.2))
    out_w = round(OUT_H * lib.W / lib.H)
    img = img.resize((out_w, OUT_H), Image.LANCZOS)
    sc = OUT_H / lib.H
    if spec.get('overlay'):
        spec['overlay'](img, sc, look)
    st = STYLES['B' if look == 'B' else 'A'] if look in ('A', 'B') else STYLES[spec.get('pill_style', 'A')]
    d = ImageDraw.Draw(img, 'RGBA')
    for p in spec.get('hud', []):
        side, row, label, value = p
        y = (lib.HEADER_PX + 8 + row * 30) * sc
        if side == 'left':
            pill(d, 10 * sc, y, label, value, st, sc)
        else:
            pill(d, img.width - 10 * sc, y, label, value, st, sc, align='right')
    header(img, spec.get('name', gid), sc, look)
    img = grain(img, 2.2)
    dest = os.path.join(ROOT, 'docs', 'design', 'game-concepts', cat)
    os.makedirs(os.path.join(dest, 'thumbs'), exist_ok=True)
    out = os.path.join(dest, f'{gid}-{look}.webp')
    img.save(out, 'WEBP', quality=84, method=6)
    th = img.resize((round(240 * lib.W / lib.H), 240), Image.LANCZOS)
    th.save(os.path.join(dest, 'thumbs', f'{gid}-{look}.webp'), 'WEBP', quality=78, method=6)
    print('wrote', out, os.path.getsize(out) // 1024, 'KB', round(time.time() - t0, 1), 's')


if __name__ == '__main__':
    main()
