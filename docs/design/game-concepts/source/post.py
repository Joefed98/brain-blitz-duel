"""Post-process a render: lay the placeholder header band over the top, export the WebP and its thumbnail.

The band stands in for the game frame's 60 px header (name, timer ring, score, menu) so the proportions of the
board below are the real ones. It is deliberately plain: grey bars, no words.
"""
import sys

from PIL import Image, ImageDraw, ImageFilter

HEADER = 60  # phone px


def header_band(im, look):
    w, h = im.size
    k = w / 390.0
    band = Image.new("RGBA", im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(band)
    hb = int(HEADER * k)
    d.rectangle((0, 0, w, hb), fill=(6, 8, 15, 236))
    d.line((0, hb, w, hb), fill=(30, 38, 64, 255), width=max(1, int(k)))
    bar = (40, 51, 90, 255)
    bar2 = (30, 38, 64, 255)
    d.rounded_rectangle((16 * k, 15 * k, 120 * k, 28 * k), radius=4 * k, fill=bar)
    d.rounded_rectangle((16 * k, 35 * k, 86 * k, 43 * k), radius=3 * k, fill=bar2)
    cx, cy, r = 195 * k, 30 * k, 21 * k
    d.ellipse((cx - r, cy - r, cx + r, cy + r), outline=bar, width=int(4 * k))
    d.rounded_rectangle((292 * k, 17 * k, 334 * k, 27 * k), radius=3 * k, fill=bar2)
    d.rounded_rectangle((300 * k, 33 * k, 334 * k, 43 * k), radius=3 * k, fill=bar)
    for i in range(3):
        y = (22 + i * 8) * k
        d.ellipse((364 * k - 2 * k, y - 2 * k, 364 * k + 2 * k, y + 2 * k), fill=bar)
    # The goal line under the header: one short bar.
    sh = Image.new("RGBA", im.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).rectangle((0, hb, w, hb + 10 * k), fill=(0, 0, 0, 70))
    sh = sh.filter(ImageFilter.GaussianBlur(6 * k))
    out = Image.alpha_composite(im.convert("RGBA"), sh)
    return Image.alpha_composite(out, band)


def bloom(im, amount, threshold=200, radius=0.02):
    """A soft glare from the brightest parts (lit gold, glowing rims), as a camera lens gives."""
    if amount <= 0:
        return im
    import numpy as np

    a = np.asarray(im.convert("RGB")).astype(np.float32)
    lum = a.max(axis=2, keepdims=True)
    hi = np.clip((lum - threshold) / (255 - threshold), 0, 1) * a
    g = Image.fromarray(hi.astype(np.uint8))
    r = im.size[0] * radius
    g1 = np.asarray(g.filter(ImageFilter.GaussianBlur(r))).astype(np.float32)
    g2 = np.asarray(g.filter(ImageFilter.GaussianBlur(r * 4))).astype(np.float32)
    out = a + (g1 * 0.7 + g2 * 0.5) * amount
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))


def vignette(im, amount):
    if amount <= 0:
        return im
    import numpy as np

    w, h = im.size
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    d = np.sqrt(((x - w / 2) / (w * 0.75)) ** 2 + ((y - h * 0.48) / (h * 0.62)) ** 2)
    f = 1 - amount * np.clip(d - 0.35, 0, 1) ** 1.6
    a = np.asarray(im.convert("RGB")).astype(np.float32) * f[..., None]
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


# How much glare and edge darkening each look gets (B, "Bolder", has more atmosphere).
FX = {"a": (0.35, 0.25), "b": (0.8, 0.5), "c": (0.6, 0.4)}


def export(png, webp, thumb, look="a"):
    im = Image.open(png).convert("RGB")
    bl, vg = FX.get(look, (0.4, 0.3))
    im = vignette(bloom(im, bl), vg)
    im = header_band(im.convert("RGBA"), look).convert("RGB")
    big = im.resize((333, 720), Image.LANCZOS)
    big.save(webp, "WEBP", quality=82, method=6)
    sm = im.resize((120, 260), Image.LANCZOS)
    sm.save(thumb, "WEBP", quality=78, method=6)


if __name__ == "__main__":
    export(*sys.argv[1:])
