"""Word art: the Blender-rendered pieces every Word game draws (phase 2 step 4, the Word overhaul).

Each piece is one object rendered alone, straight from above with an orthographic camera, on a transparent film, in
Cycles with OpenImageDenoise, so the app lays live letters over it (letters stay crisp, big and bold; nothing is
baked into a picture but the material). Concept A's polish (docs/design/game-concepts/word.md, PR #427), held to the
art direction (docs/design/cosmetics-redraws/ART-DIRECTION.md, PR #423) and to Joe's Word rule: real materials, clean
even studio light, minimal glow, no glare: no reflections across tiles or letters, no glowing edges or rings. The
light is a large soft overhead box and an even world, so a bevel reads as depth (light top-left, shade bottom-right)
and the face stays flat for the letter.

Setup (keep the working copy outside the project folder):

    python3 -m venv ~/word-art-venv && ~/word-art-venv/bin/pip install bpy==5.3.0 pillow numpy
    ~/word-art-venv/bin/python scripts/word-art/word_art.py [names...] [--samples=96]

Writes public/word-art/<name>.webp (lossless alpha, quality 92) at 3x their largest use size, and
public/word-art/manifest.json (name, size, bytes). Every render is reproducible from this file (fixed seeds).
"""
import json
import math
import os
import sys
import tempfile

import bpy  # noqa: I001 (bpy first: it provides bmesh)
import bmesh

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
OUT = os.path.join(ROOT, "public", "word-art")
S = 0.01  # metres per sprite pixel (at 1x)


def hexc(h, a=1.0):
    h = h.lstrip("#")
    r, g, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
    lin = lambda c: c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return (lin(r), lin(g), lin(b), a)


# ------------------------------------------------------------------------------------------------- scene


def reset(w, h, scale=3):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = 96
    sc.cycles.seed = 7
    sc.cycles.use_denoising = True
    sc.cycles.max_bounces = 8
    sc.cycles.glossy_bounces = 3
    sc.cycles.caustics_reflective = False
    sc.cycles.caustics_refractive = False
    sc.render.resolution_x = int(w * scale)
    sc.render.resolution_y = int(h * scale)
    sc.render.film_transparent = True
    sc.cycles.film_transparent_glass = True
    sc.view_settings.view_transform = "Khronos PBR Neutral"
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGBA"
    cam_data = bpy.data.cameras.new("cam")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = max(w, h) * S
    cam_data.sensor_fit = "AUTO"
    cam = bpy.data.objects.new("cam", cam_data)
    cam.location = (0, 0, 10)
    sc.collection.objects.link(cam)
    sc.camera = cam
    # An even studio: a soft grey world and one large overhead softbox a little to the top left. No rim, no kicker,
    # nothing low enough to put a highlight across a face.
    world = bpy.data.worlds.new("w")
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = (0.62, 0.64, 0.68, 1)
    bg.inputs["Strength"].default_value = 0.22
    sc.world = world
    ld = bpy.data.lights.new("key", "AREA")
    ld.shape = "SQUARE"
    ld.size = 12.0
    ld.energy = 520
    ld.color = (1.0, 0.98, 0.95)
    key = bpy.data.objects.new("key", ld)
    key.location = (-2.6, 2.6, 6.0)
    key.rotation_euler = (math.radians(-22), math.radians(-22), 0)
    sc.collection.objects.link(key)
    return sc


# Pieces with fine transparency (the glass jar) are saved lossy-alpha at this quality, to stay small.
QUALITY = {"jar": 60}


def render(name, samples):
    sc = bpy.context.scene
    sc.cycles.samples = samples
    sc.render.threads_mode = "FIXED"
    sc.render.threads = os.cpu_count() or 4
    tmp = os.path.join(tempfile.gettempdir(), f"word-art-{name}.png")
    sc.render.filepath = tmp
    bpy.ops.render.render(write_still=True)
    from PIL import Image

    im = Image.open(tmp).convert("RGBA")
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, f"{name}.webp")
    im.save(path, "WEBP", quality=QUALITY.get(name, 92), method=6, alpha_quality=QUALITY.get(name, 100))
    return path, im.size


# --------------------------------------------------------------------------------------------- materials

_MATS = {}


def mat(key, color, rough=0.42, metal=0.0, coat=0.0, coat_rough=0.3, spec=0.35, rough_var=0.06, bump=0.0,
        bump_scale=400.0, sheen=0.0):
    """Principled only, satin by default (the no-glare rule: a rough coat, low specular, broken-up roughness)."""
    if key in _MATS:
        return _MATS[key]
    m = bpy.data.materials.new(key)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = color
    b.inputs["Metallic"].default_value = metal
    b.inputs["Specular IOR Level"].default_value = spec
    b.inputs["Coat Weight"].default_value = coat
    b.inputs["Coat Roughness"].default_value = coat_rough
    b.inputs["Sheen Weight"].default_value = sheen
    if rough_var:
        tc = nt.nodes.new("ShaderNodeTexCoord")
        nz = nt.nodes.new("ShaderNodeTexNoise")
        nz.inputs["Scale"].default_value = 90
        nz.inputs["Detail"].default_value = 6
        nt.links.new(tc.outputs["Object"], nz.inputs["Vector"])
        mr = nt.nodes.new("ShaderNodeMapRange")
        mr.inputs["To Min"].default_value = max(0.0, rough - rough_var)
        mr.inputs["To Max"].default_value = rough + rough_var
        nt.links.new(nz.outputs["Fac"], mr.inputs["Value"])
        nt.links.new(mr.outputs["Result"], b.inputs["Roughness"])
    else:
        b.inputs["Roughness"].default_value = rough
    if bump:
        tc = nt.nodes.new("ShaderNodeTexCoord")
        nz = nt.nodes.new("ShaderNodeTexNoise")
        nz.inputs["Scale"].default_value = bump_scale
        nt.links.new(tc.outputs["Object"], nz.inputs["Vector"])
        bp = nt.nodes.new("ShaderNodeBump")
        bp.inputs["Strength"].default_value = bump
        bp.inputs["Distance"].default_value = 0.001
        nt.links.new(nz.outputs["Fac"], bp.inputs["Height"])
        nt.links.new(bp.outputs["Normal"], b.inputs["Normal"])
    _MATS[key] = m
    return m


def glass(key, tint=(0.92, 0.95, 1.0, 1)):
    m = bpy.data.materials.new(key)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = tint
    b.inputs["Transmission Weight"].default_value = 1.0
    b.inputs["Roughness"].default_value = 0.08
    b.inputs["IOR"].default_value = 1.45
    b.inputs["Specular IOR Level"].default_value = 0.3
    return m


def palette():
    """The Word palette: today's navy room, glazed black tiles, champagne gold, the clue colours."""
    return dict(
        black=mat("glaze_black", hexc("#15171E"), rough=0.38, coat=0.35, coat_rough=0.35, bump=0.02),
        pearl=mat("pearl_black", hexc("#191B23"), rough=0.36, coat=0.4, coat_rough=0.3, sheen=0.25),
        dim=mat("glaze_dim", hexc("#14161C"), rough=0.5, coat=0.15),
        gold=mat("enamel_gold", hexc("#D9BD82"), rough=0.36, metal=0.7, coat=0.1, coat_rough=0.4),
        gold_deep=mat("enamel_gold_deep", hexc("#B98F45"), rough=0.4, metal=0.5),
        teal=mat("glaze_teal", hexc("#2AAE98"), rough=0.4, coat=0.3, coat_rough=0.35),
        grey=mat("glaze_grey", hexc("#4A4F5C"), rough=0.45, coat=0.25),
        red=mat("glaze_red", hexc("#8E2A33"), rough=0.42, coat=0.3),
        sapphire=mat("glaze_sapphire", hexc("#1F3E8C"), rough=0.38, coat=0.35, coat_rough=0.3),
        navy=mat("lacquer_navy", hexc("#101A36"), rough=0.45, coat=0.25, coat_rough=0.4, bump=0.015),
        navy_key=mat("key_navy", hexc("#18213D"), rough=0.5, coat=0.15),
        well=mat("well", hexc("#2F4073"), rough=0.55),
        tray=mat("tray", hexc("#0C1530"), rough=0.5, coat=0.2, coat_rough=0.45, bump=0.012),
        well_plate=mat("well_plate", hexc("#16224A"), rough=0.5, coat=0.2, coat_rough=0.45, bump=0.012),
        rim=mat("rim_gold", hexc("#C9A862"), rough=0.4, metal=0.6),
        coin=mat("coin_gold", hexc("#D5AE5E"), rough=0.33, metal=0.8),
        steel=mat("steel", hexc("#9AA1AE"), rough=0.35, metal=0.9),
    )


# ------------------------------------------------------------------------------------------------ meshes


def link(ob):
    bpy.context.scene.collection.objects.link(ob)
    return ob


def finish(ob, bevel, segs=5, angle=50):
    if bevel > 0:
        md = ob.modifiers.new("bv", "BEVEL")
        md.width = bevel * S
        md.segments = segs
        md.limit_method = "ANGLE"
        md.angle_limit = math.radians(angle)
        md.harden_normals = True
        md.miter_outer = "MITER_ARC"
    for p in ob.data.polygons:
        p.use_smooth = True
    return ob


def rounded(w, h, r, n=12):
    pts = []
    for cx, cy, a0 in ((w / 2 - r, h / 2 - r, 0), (-w / 2 + r, h / 2 - r, 90), (-w / 2 + r, -h / 2 + r, 180),
                       (w / 2 - r, -h / 2 + r, 270)):
        for i in range(n + 1):
            a = math.radians(a0 + 90 * i / n)
            pts.append((cx + math.cos(a) * r, cy + math.sin(a) * r))
    return pts


def slab(w, h, d, r, m, bevel, z=0.0, x=0.0, y=0.0, segs=5):
    """A rounded-rectangle slab w x h (px) and d tall, its face at z + d."""
    me = bpy.data.meshes.new("slab")
    bm = bmesh.new()
    vs = [bm.verts.new((px * S, py * S, 0)) for px, py in rounded(w, h, min(r, w / 2, h / 2))]
    f = bm.faces.new(vs)
    if f.normal.z < 0:
        f.normal_flip()
    ext = bmesh.ops.extrude_face_region(bm, geom=[f])
    bmesh.ops.translate(bm, vec=(0, 0, d * S), verts=[e for e in ext["geom"] if isinstance(e, bmesh.types.BMVert)])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new("slab", me)
    ob.location = (x * S, y * S, z * S)
    me.materials.append(m)
    link(ob)
    return finish(ob, min(bevel, d / 2.1), segs)


def cylinder(r, d, m, bevel, z=0.0, x=0.0, y=0.0, verts=128):
    me = bpy.data.meshes.new("cyl")
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=verts, radius1=r * S, radius2=r * S, depth=d * S)
    bmesh.ops.translate(bm, vec=(0, 0, d * S / 2), verts=bm.verts)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new("cyl", me)
    ob.location = (x * S, y * S, z * S)
    me.materials.append(m)
    link(ob)
    return finish(ob, min(bevel, d / 2.1, r / 3), 6)


def frame(w, h, r, t, d, m, bevel):
    """A rounded-rectangle frame t px wide and d tall (a well's rim), as one closed solid."""
    me = bpy.data.meshes.new("frame")
    bm = bmesh.new()
    outer = [bm.verts.new((px * S, py * S, 0)) for px, py in rounded(w, h, r)]
    inner = [bm.verts.new((px * S, py * S, 0)) for px, py in rounded(w - 2 * t, h - 2 * t, max(1, r - t))]
    n = len(outer)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((outer[i], outer[j], inner[j], inner[i]))
    ext = bmesh.ops.extrude_face_region(bm, geom=bm.faces[:])
    bmesh.ops.translate(bm, vec=(0, 0, d * S), verts=[e for e in ext["geom"] if isinstance(e, bmesh.types.BMVert)])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new("frame", me)
    me.materials.append(m)
    link(ob)
    return finish(ob, min(bevel, d / 2.1, t / 2.2), 4)


def inset(w, h, r, depth, m_face, m_pocket, inner):
    """An empty square: a floor in the pocket's material and a rim `inner` px wide standing `depth` px above it."""
    slab(w - 1, h - 1, 1.5, r, m_pocket, 0.5)
    return frame(w, h, r, inner, depth + 1.5, m_face, 1.6)


# --------------------------------------------------------------------------------------------------- pieces
# Each: (name, width, height, builder). Sizes are the sprite's 1x footprint in px; the render is 3x.


def tile(m, size=64, r=11, d=7):
    def build(pal):
        slab(size - 1, size - 1, d, r, pal[m], 3.2)
    return build


def disc(m, size=80, d=7):
    def build(pal):
        cylinder(size / 2 - 0.6, d, pal[m], 2.8)
    return build


def keycap(m, w=44, h=52):
    def build(pal):
        # A keycap: a low skirt and a dished top, so the key reads as a real key under the thumb.
        slab(w - 1, h - 1, 5, 9, pal[m], 1.4)
        slab(w - 7, h - 8, 4, 7, pal[m], 2.0, z=5, y=1.2)
    return build


def button(m, w=120, h=48):
    def build(pal):
        slab(w - 1, h - 1, 7, 14, pal[m], 2.6)
    return build


def button_navy(w=120, h=48):
    def build(pal):
        # Navy lacquer on a fine champagne-gold bezel: a metal edge, never a glowing one.
        slab(w - 1, h - 1, 6, 14, pal["rim"], 1.2)
        slab(w - 5, h - 5, 7.5, 12, pal["navy"], 2.4)
    return build


def well(size=64):
    def build(pal):
        inset(size - 1, size - 1, 11, 4, pal["well_plate"], pal["well"], 4)
    return build


def tray(size=96):
    def build(pal):
        slab(size - 1, size - 1, 5, 16, pal["tray"], 2.0)
    return build


def pip(m, size=28):
    def build(pal):
        cylinder(size / 2 - 0.8, 5, pal[m], 2.0)
    return build


def jar(w=96, h=120):
    def build(pal):
        g = glass("jar_glass")
        body = slab(w - 12, h - 26, 8, 22, g, 3.5, y=-6)
        # The jar's lid: a brushed steel band.
        slab(w - 34, 16, 9, 5, pal["steel"], 1.6, y=h / 2 - 12)
        return body
    return build


def coins(w=96, h=120):
    def build(pal):
        # A loose pile of coins seen from above, filling the jar's footprint (the app clips it to the jar's level).
        import random as _r
        rnd = _r.Random(42)
        for i in range(170):
            cx = rnd.uniform(-(w - 12) / 2 + 11, (w - 12) / 2 - 11)
            cy = rnd.uniform(-(h - 26) / 2 - 6 + 11, (h - 26) / 2 - 6 - 11)
            cylinder(8.5, 2.2, pal["coin"], 0.8, z=i * 0.08, x=cx, y=cy, verts=48)
    return build


def padlock(shut, w=36, h=44):
    def build(pal):
        slab(w - 4, h * 0.56, 8, 6, pal["gold"], 1.8, y=-h * 0.18)
        # The shackle, seen from above: a half ring lying flat; open, lifted to one side.
        me = bpy.data.meshes.new("shackle")
        bm = bmesh.new()
        ro, ri, n = w * 0.3, w * 0.18, 48
        outer, inner = [], []
        for i in range(n + 1):
            a = math.pi * i / n
            outer.append(bm.verts.new((math.cos(a) * ro * S, math.sin(a) * ro * S, 0)))
            inner.append(bm.verts.new((math.cos(a) * ri * S, math.sin(a) * ri * S, 0)))
        for i in range(n):
            bm.faces.new((outer[i], outer[i + 1], inner[i + 1], inner[i]))
        ext = bmesh.ops.extrude_face_region(bm, geom=bm.faces[:])
        bmesh.ops.translate(bm, vec=(0, 0, 4 * S), verts=[e for e in ext["geom"] if isinstance(e, bmesh.types.BMVert)])
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
        bm.to_mesh(me)
        bm.free()
        ob = bpy.data.objects.new("shackle", me)
        ob.location = ((0 if shut else w * 0.2) * S, (h * 0.08 if shut else h * 0.24) * S, 3 * S)
        me.materials.append(pal["steel"])
        link(ob)
        finish(ob, 1.0, 3)
    return build


PIECES = {
    # Letter tiles (Interlock, Slider, Forage, Lookout, Roundabout, Strikeout, Cryptogrid, Swapword).
    "tile-black": (64, 64, tile("black")),
    "tile-gold": (64, 64, tile("gold")),
    "tile-teal": (64, 64, tile("teal")),
    "tile-grey": (64, 64, tile("grey")),
    "tile-red": (64, 64, tile("red")),
    "tile-dim": (64, 64, tile("dim")),
    "tile-sapphire": (64, 64, tile("sapphire")),
    # Small tiles for dense grids (Lookout 10x10 and 12x12, Cryptogrid 9x9): a lower slab and tighter bevel.
    "tile-small-black": (36, 36, tile("black", 36, 6, 4)),
    "tile-small-gold": (36, 36, tile("gold", 36, 6, 4)),
    "tile-small-dim": (36, 36, tile("dim", 36, 6, 4)),
    "well": (64, 64, well()),
    # Nucleus and Roundabout: pearl-black letter discs, the sapphire centre, gold pangram letters.
    "disc-pearl": (80, 80, disc("pearl")),
    "disc-gold": (80, 80, disc("gold")),
    "disc-sapphire": (80, 80, disc("sapphire")),
    # Keyboards (Strikeout, Cryptogrid): about 52 px keys.
    "key": (44, 52, keycap("navy_key")),
    "key-dim": (44, 52, keycap("dim")),
    # Controls: champagne gold and navy (never bright yellow or blue).
    "btn-gold": (120, 48, button("gold")),
    "btn-navy": (120, 48, button_navy()),
    "tray": (96, 96, tray()),
    # Strikeout: gold strike pips and red strike studs.
    "pip-gold": (28, 28, pip("gold")),
    "pip-red": (28, 28, pip("red")),
    "pip-empty": (28, 28, pip("dim")),
    # Roundabout: the bonus jar and the coins it fills with.
    "jar": (96, 120, jar()),
    "jar-coins": (96, 120, coins()),
    # Slider: the padlocks.
    "padlock-open": (36, 44, padlock(False)),
    "padlock-shut": (36, 44, padlock(True)),
}


def main():
    names = [a for a in sys.argv[1:] if not a.startswith("--")] or list(PIECES)
    opts = dict(a[2:].split("=", 1) for a in sys.argv[1:] if a.startswith("--") and "=" in a)
    samples = int(opts.get("samples", 96))
    manifest_path = os.path.join(OUT, "manifest.json")
    manifest = {}
    if os.path.exists(manifest_path):
        manifest = json.load(open(manifest_path))
    for name in names:
        w, h, build = PIECES[name]
        reset(w, h)
        _MATS.clear()
        build(palette())
        path, size = render(name, samples)
        manifest[name] = {"w": w, "h": h, "px": list(size), "bytes": os.path.getsize(path)}
        print("WROTE", name, size, os.path.getsize(path))
    with open(manifest_path, "w") as f:
        json.dump(dict(sorted(manifest.items())), f, indent=1)
        f.write("\n")


if __name__ == "__main__":
    main()
