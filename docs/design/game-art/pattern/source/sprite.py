"""Sprite renders for the Pattern overhaul (phase 2 step 4): real materials in Blender, drawn by the games.

Each sprite is one object (or a small group) rendered straight down with an orthographic camera onto a transparent
background, so the game's own renderer (SVG / CSS) can place it exactly inside its cell, piece or tile box. The art
standard (PR #423 ART-DIRECTION.md, Joe's overhaul rules): clean, even studio lighting from the top left, minimal glow,
no glare (no mirror-like reflections across a tile or a number), bold readable shapes.

Units: a sprite is built in "points" on a square canvas of `size` points (x right, y down), the same convention as
jzlib (which this imports). The camera frames exactly that square, plus `pad` points of shadow room on each side
when asked (`pad` is then part of the image and the game must place the image `pad` larger than its box).

Run a game's file:  /opt/blender/venv/bin/python docs/design/game-art/pattern/source/<game>.py [sprite …]
Writes public/pattern-art/<game>/<sprite>.webp (and nothing else in the project). Working files go to
$JZ_TMP (default /tmp/jz-pattern-art), outside the project.
"""
import bpy, math, os, sys
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import jzlib
from jzlib import *  # noqa: F401,F403  (mat, box, cbox, cyl, sphere, torus, tube, …)

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", "..", "..", ".."))
PUBLIC = os.path.join(ROOT, "public", "pattern-art")
TMP = os.environ.get("JZ_TMP", "/tmp/jz-pattern-art")
SPRITE_SAMPLES = int(os.environ.get("JZ_SPRITE_SAMPLES", "48"))


def begin(size, px, pad=0.0, light=1.0, top_left=True):
    """A fresh scene for one sprite: `size` points square drawn at `px` pixels (plus `pad` points each side)."""
    s = jzlib.reset()
    jzlib._mats.clear()
    jzlib._meshes.clear() if hasattr(jzlib, "_meshes") else None
    s.cycles.samples = SPRITE_SAMPLES
    s.render.film_transparent = True
    full = size + 2 * pad
    s.render.resolution_x = s.render.resolution_y = int(round(px * full / size))
    s.render.resolution_percentage = 100
    s.view_settings.view_transform = "AgX"
    s.view_settings.look = "AgX - Base Contrast"
    s.render.threads_mode = "FIXED"
    s.render.threads = int(os.environ.get("JZ_THREADS", "2"))
    # Orthographic camera straight down over the sprite square (sprite coords: (0,0) top left, (size,size) bottom right).
    jzlib.W, jzlib.H = size, size
    cam = bpy.data.cameras.new("cam")
    cam.type = "ORTHO"
    cam.ortho_scale = full * jzlib.P
    cam.clip_end = 100
    ob = bpy.data.objects.new("cam", cam)
    s.collection.objects.link(ob)
    ob.location = jzlib.V(size / 2, size / 2, 2000)
    ob.rotation_euler = (0, 0, 0)
    s.camera = ob
    # Even studio light, key from the top left; low world so nothing glares.
    jzlib.world("#0a0a10", 0.0, hdri="studio.exr" if jzlib.STUDIO else None, hdri_strength=0.18)
    k = light
    kx, ky = (-size * 0.8, -size * 0.8) if top_left else (size * 0.5, -size * 1.2)
    jzlib.area(kx, ky, size * 2.4, size * 2.6, 0.03 * k * size * size, "#fff4e6", target=(size / 2, size / 2, 0))
    jzlib.area(size * 1.9, size * 1.5, size * 1.6, size * 2.2, 0.008 * k * size * size, "#e4ecff", target=(size / 2, size / 2, 0))
    jzlib.area(size / 2, size / 2, size * 3.0, size * 3.0, 0.01 * k * size * size, "#ffffff", target=(size / 2, size / 2, 0))
    return s


def shadow_catcher(size, pad=0.0, strength=1.0):
    """A ground plane that only receives shadows (transparent elsewhere), so the sprite carries its own soft shadow."""
    m = jzlib.mat("shadowcatch", "#000000", 1.0)
    ob = jzlib.plane(-pad, -pad, size + 2 * pad, size + 2 * pad, m, z=0.0)
    ob.is_shadow_catcher = True
    return ob


def save(game, name, quality=88):
    """Renders the scene and writes public/pattern-art/<game>/<name>.webp (RGBA)."""
    from PIL import Image
    os.makedirs(TMP, exist_ok=True)
    os.makedirs(os.path.join(PUBLIC, game), exist_ok=True)
    png = os.path.join(TMP, f"{game}-{name}.png")
    s = bpy.context.scene
    s.render.filepath = png
    s.render.image_settings.file_format = "PNG"
    s.render.image_settings.color_mode = "RGBA"
    bpy.ops.render.render(write_still=True)
    out = os.path.join(PUBLIC, game, f"{name}.webp")
    Image.open(png).convert("RGBA").save(out, "WEBP", quality=quality, method=6)
    print("wrote", os.path.relpath(out, ROOT))
    return out


def main(game, sprites):
    """Command line: no argument renders every sprite in `sprites` (name -> function); else the names given."""
    names = [a for a in sys.argv[1:] if not a.startswith("-")] or list(sprites)
    for n in names:
        sprites[n]()
        save(game, n)
