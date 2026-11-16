"""Attention overhaul sprites (phase 2 step 4, 15 Nov 2026): the pieces and surfaces the eight Number games draw.

Each sprite is one object (a kettlebell, a tile, a stone, a jug, a dartboard...) rendered on its own with Cycles on a
transparent film, through an orthographic camera looking at the screen plane, so the app can place and animate it.
Numbers are never baked in: the app draws them over the pieces in Archivo, bold and legible at any size.

Lighting follows the art direction for game pieces: clean, even studio light (a large soft key from the top left,
a soft fill, a low rim), matte-to-satin materials, no reflections across panels or numbers and no glowing edges.

Coordinates are sprite points: (0, 0) the sprite's top left, x right, y down, z towards the viewer; the sprite is
`w` x `h` points and renders at `scale` pixels a point.

Run:  /opt/blender/venv/bin/python docs/design/attention-overhaul/source/<game>.py [sprite ...]
Output: public/attention/<game>/<sprite>.webp (alpha), plus a contact sheet in $JZ_SHEETS when set.
"""
import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
import jzlib
from jzlib import *  # noqa: F401,F403  (materials and shapes)

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", ".."))
PUBLIC = os.path.join(ROOT, "public", "attention")
TMP = os.environ.get("JZ_TMP", "/tmp/jz-attention")
SPRITE_SAMPLES = int(os.environ.get("JZ_SAMPLES", "64"))


def setup(w, h, scale=3, samples=None):
    """A fresh scene framing a w x h point box; returns the scene."""
    jzlib.W, jzlib.H = w, h
    jzlib._mats.clear(); jzlib._fonts.clear(); jzlib._meshes.clear()
    s = reset()
    s.cycles.samples = samples or SPRITE_SAMPLES
    s.cycles.seed = 7
    s.render.film_transparent = True
    s.render.resolution_x = int(round(w * scale))
    s.render.resolution_y = int(round(h * scale))
    s.view_settings.look = "AgX - Base Contrast"
    cam = bpy.data.cameras.new("cam")
    cam.type = "ORTHO"
    cam.ortho_scale = max(w, h) * P
    cam.sensor_fit = "AUTO"
    ob = bpy.data.objects.new("cam", cam)
    s.collection.objects.link(ob)
    ob.location = (0, 0, 50)
    cam.clip_end = 200
    s.camera = ob
    world("#06080f", 0.0, hdri=None)
    even_lights()
    return s


def even_lights(key=1.0):
    """Soft, even studio light: no hard highlights, nothing that reads as glare."""
    W, H = jzlib.W, jzlib.H
    span = max(W, H)
    area(-span * 0.6, -span * 0.7, span * 2.2, span * 2.4, 2600 * key * (span / 120) ** 2 / 9, "#fff4e4", target=(W / 2, H / 2, 0))
    area(W + span * 0.8, H * 0.6, span * 1.4, span * 2.0, 700 * key * (span / 120) ** 2 / 9, "#e6eeff", target=(W / 2, H / 2, 0))
    area(W / 2, H + span * 1.2, span * 0.6, span * 2.4, 300 * key * (span / 120) ** 2 / 9, "#ffffff", target=(W / 2, H / 2, 0))


def write(game, name, max_kb=None):
    """Renders the scene to public/attention/<game>/<name>.webp (lossless alpha where small, else quality 90)."""
    from PIL import Image
    s = bpy.context.scene
    os.makedirs(TMP, exist_ok=True)
    png = os.path.join(TMP, f"{game}-{name}.png")
    s.render.filepath = png
    s.render.image_settings.file_format = "PNG"
    s.render.image_settings.color_mode = "RGBA"
    bpy.ops.render.render(write_still=True)
    out_dir = os.path.join(PUBLIC, game)
    os.makedirs(out_dir, exist_ok=True)
    out = os.path.join(out_dir, f"{name}.webp")
    im = Image.open(png).convert("RGBA")
    im.save(out, "WEBP", quality=88, method=6, exact=False)
    if max_kb and os.path.getsize(out) > max_kb * 1024:
        im.save(out, "WEBP", quality=78, method=6)
    print("wrote", os.path.relpath(out, ROOT), os.path.getsize(out) // 1024, "KB")
    return out


def run(sprites):
    """Command line: sprite names to render, or none for all. `sprites` maps a name to a no-argument builder."""
    want = [a for a in sys.argv[1:] if not a.startswith("-")]
    for name, fn in sprites.items():
        if want and name not in want:
            continue
        fn()


# ------------------------------------------------------------------ shared matte materials (no glare)
def satin(name, color, rough=0.55, metal=0.0):
    return mat(name, color, rough, metal=metal)


def champagne(name="champagne", rough=0.42):
    """The interface gold as a brushed, satin metal: warm, never mirror-bright."""
    return mat(name, "#d9b56c", rough, metal=1.0)


def navy(name="navy", rough=0.6):
    return mat(name, "#1a2440", rough)
