"""Lightbender (laser) sprites, the Pattern overhaul (15 Nov 2026, look A: terracotta brick walls, silvered glass
mirrors, cut crystal gems that light up, round black bombs, a gunmetal emitter; the beam stays vector in the game).

One cell is 100 points, every sprite exactly one cell box (the game places each on the cell the tracer uses, so nothing
leaves its square). The light is the house's soft studio key from the top left; the gems' lit state is the same
crystal with a warm light inside it (no halo baked in), so dark and lit sit in exactly the same outline.

  JZ_THREADS=1 /opt/blender/venv/bin/python docs/design/game-art/pattern/source/laser.py [sprite …]
"""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sprite import *  # noqa: F401,F403
import bpy, bmesh
import jzlib

SIZE = 100
PX = 160   # a cell is ~36 css px on a phone: past 3× for DPR 3, so facets and grain stay crisp
LIGHT = float(os.environ.get("LB_LIGHT", "1.0"))  # the rich studio (sprite.py begin(rich=True))


def cell_begin(light=LIGHT, shadow=True):
    begin(SIZE, PX, pad=0, light=light)
    if shadow:
        shadow_catcher(SIZE, 0)


# ---------------------------------------------------------------- board tiles

def floor():
    """An empty square: a satin deep violet plate, softly bevelled (fills its box; the board gap shows round it).
    Spotlight (the polish plan of 20 Nov 2026): deep violet, not black (was graphite #09080c)."""
    cell_begin(shadow=False)
    plate = mat("plate", "#1a0a3e", 0.85, coat=0.0, spec=0.08)
    add_bump(plate, scale=140, strength=0.04, detail=3, distance=0.002)
    box(1.0, 1.0, SIZE - 2.0, SIZE - 2.0, 5, plate, r=7, z=0)


def brick():
    """A wall: terracotta bricks in two staggered courses on dark mortar."""
    cell_begin(shadow=False)
    mortar = mat("mortar", "#2e1c13", 0.9)
    add_bump(mortar, scale=220, strength=0.45, distance=0.003)
    clay = mat("brick", "#8a3a1c", 0.62, coat=0.05, coat_rough=0.6)
    add_bump(clay, scale=55, strength=1.0, detail=12, distance=0.03)
    clay2 = mat("brick2", "#76301a", 0.64, coat=0.05, coat_rough=0.6)
    add_bump(clay2, scale=50, strength=1.0, detail=12, distance=0.03)
    box(1, 1, SIZE - 2, SIZE - 2, 8, mortar, r=5, z=0)
    g = 4.0     # the mortar joint
    m = 4.0     # the margin inside the cell
    rows = 3
    h = (SIZE - 2 * m - (rows - 1) * g) / rows
    for r in range(rows):
        y = m + r * (h + g)
        if r % 2 == 0:
            w = (SIZE - 2 * m - g) / 2
            for k in range(2):
                box(m + k * (w + g), y, w, h, 14, clay if k == 0 else clay2, r=2.5, z=0)
        else:
            half = (SIZE - 2 * m - 2 * g) / 4
            full = 2 * half
            xs = [(m, half), (m + half + g, full), (m + half + full + 2 * g, half)]
            for k, (x, w) in enumerate(xs):
                box(x, y, w, h, 14, clay2 if k == 1 else clay, r=2.5, z=0)


# ---------------------------------------------------------------- pieces

def mirror(kind):
    """A mirror on its diagonal: a silvered glass pane in a slim dark frame, standing proud of the cell."""
    def build():
        cell_begin()
        frame_m = mat("mirrorFrame", "#1d2027", 0.25, metal=0.8, coat=0.6, coat_rough=0.12)
        silver = mat("silver", "#f2f5f8", 0.04, metal=1.0, coat=1.0, coat_rough=0.03)
        glass_edge = mat("glassEdge", "#d8f0ff", 0.02, coat=1.0, coat_rough=0.02, emit="#eaf6ff", emit_strength=0.25)
        rot = math.radians(45 if kind == "slash" else -45)
        L = 118.0   # along the diagonal (the cell's diagonal is 141)
        cbox(50, 50, L, 15, 14, frame_m, r=3, z=0, rot=rot)
        cbox(50, 50, L - 6, 9, 3, silver, r=1.5, z=14, rot=rot)
        cbox(50, 50, L - 6, 2.2, 1.2, glass_edge, r=0.6, z=17, rot=rot)
    return build


def splitter():
    """The splitter: a violet glass prism block, a square turned 45°; the game draws its split arrows over it."""
    cell_begin()
    violet = mat("prism", "#8357e6", 0.04, coat=1.0, coat_rough=0.03, trans=0.45, ior=1.5, emit="#5b2fb8", emit_strength=0.12)
    rim = mat("prismRim", "#d9c8ff", 0.2, metal=0.3)
    cbox(50, 50, 70, 70, 12, rim, r=4, z=0, rot=math.radians(45))
    cbox(50, 50, 64, 64, 20, violet, r=6, z=0, rot=math.radians(45))


def _gem_mesh(R, girdle_z, table_r, table_z, culet_z, n=8):
    """A brilliant: an n-sided girdle, a crown up to a flat table, a pavilion down to a point. Flat-shaded facets."""
    me = bpy.data.meshes.new("gem")
    bm = bmesh.new()
    P = jzlib.P
    girdle = [bm.verts.new((R * math.cos(2 * math.pi * (i + 0.5) / (2 * n)) * P, R * math.sin(2 * math.pi * (i + 0.5) / (2 * n)) * P, girdle_z * P)) for i in range(2 * n)]
    table = [bm.verts.new((table_r * math.cos(2 * math.pi * i / n) * P, table_r * math.sin(2 * math.pi * i / n) * P, table_z * P)) for i in range(n)]
    # Star points between the table and the girdle (a second ring of crown facets).
    star_r = (R + table_r) / 2
    star = [bm.verts.new((star_r * math.cos(2 * math.pi * (i + 0.5) / n) * P, star_r * math.sin(2 * math.pi * (i + 0.5) / n) * P, (girdle_z + table_z) / 2 * P + 0.35 * (table_z - girdle_z) * P)) for i in range(n)]
    culet = bm.verts.new((0, 0, culet_z * P))
    bm.faces.new(table)
    for i in range(n):
        a, b = table[i], table[(i + 1) % n]
        s = star[i]
        g0, g1, g2 = girdle[2 * i], girdle[2 * i + 1], girdle[(2 * i + 2) % (2 * n)]
        bm.faces.new((a, s, b)[::-1])       # star facet
        bm.faces.new((a, g0, g1, s)[::-1])  # kite (bezel) halves
        bm.faces.new((s, g1, g2, b)[::-1])
        bm.faces.new((a, girdle[(2 * i - 1) % (2 * n)], g0)[::-1])
    for i in range(2 * n):
        bm.faces.new((girdle[i], girdle[(i + 1) % (2 * n)], culet))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = False
    return me


def gem(lit):
    """A cut crystal on a small dark setting. Dark: cool smoky crystal; lit: the same stone burning gold from inside."""
    def build():
        cell_begin()
        if lit:
            # AgX drains a glowing amber towards peach; the lit stone keeps its full gold under the Standard transform.
            bpy.context.scene.view_settings.view_transform = "Standard"
            bpy.context.scene.view_settings.look = "None"
        setting = mat("setting", "#2b2833", 0.45, metal=0.7)
        cyl(50, 50, 33, 5, setting, z=0, bevel=1.5, verts=16)
        if lit:
            stone = mat("gemLit", "#e08200", 0.05, coat=1.0, coat_rough=0.03, ior=2.2,
                        emit="#ff7a00", emit_strength=0.28)
        else:
            stone = mat("gemDark", "#8fa6d8", 0.02, coat=1.0, coat_rough=0.02, trans=0.35, ior=2.2)
        ob = bpy.data.objects.new("gem", _gem_mesh(R=37, girdle_z=22, table_r=19, table_z=34, culet_z=4))
        ob.location = jzlib.V(50, 50, 0)
        ob.rotation_euler[2] = math.pi / 8
        jzlib._set_mat(ob, stone)
        jzlib._link(ob)
        if lit:
            # Light inside the stone only (a small warm point under the table), so the facets blaze without a halo.
            point(50, 50, 18, 0.6, "#ffb020", radius=6)
    return build


def bomb(hit):
    """A round black bomb with a brass fuse cap, a fuse and a lit spark; `hit`: the shell glowing red hot."""
    def build():
        cell_begin()
        shell = mat("bombHit" if hit else "bomb", "#5a0c08" if hit else "#16171c", 0.3, coat=1.0, coat_rough=0.1,
                    emit="#e01a0a" if hit else None, emit_strength=0.35 if hit else 0.0)
        sphere(46, 54, 33, shell, z=33)
        # A red danger band round the equator reads "bomb" at a glance.
        torus(46, 54, 31.5, 3.2, mat("bombBand", "#c4262a", 0.4, coat=0.6), z=34)
        cap = mat("fuseCap", "#9a7a3c", 0.32, metal=1.0)
        cyl(64, 34, 8, 10, cap, z=58, bevel=1.2, verts=24)
        fuse = mat("fuse", "#c8a060", 0.75)
        tube([(66, 31, 68), (72, 22, 72), (80, 15, 74)], 2.2, fuse, round_caps=True)
        sphere(81, 14, 5, emissive("spark", "#ffb040", 9.0), z=76)
    return build


def emitter():
    """The laser: a gunmetal housing with a gold lens, nozzle to the right (the game turns it to the beam's way)."""
    cell_begin()
    body = mat("emitBody", "#2c2f37", 0.32, metal=0.85)
    trim = mat("emitTrim", "#c9a13a", 0.25, metal=1.0)
    box(8, 16, 62, 68, 22, body, r=10, z=0)
    box(66, 34, 28, 32, 16, body, r=5, z=0)
    box(88, 38, 7, 24, 16, trim, r=2, z=0)
    cyl(38, 50, 19, 4, trim, z=22, bevel=1.0)
    cyl(38, 50, 14, 2, emissive("lens", "#ffd36a", 2.2), z=25.5)
    for y in (24, 76):
        cyl(16, y, 3, 2, trim, z=22, bevel=0.5, verts=16)


SPRITES = {
    "floor": floor,
    "brick": brick,
    "mirror-slash": mirror("slash"),
    "mirror-back": mirror("back"),
    "splitter": splitter,
    "gem-dark": gem(False),
    "gem-lit": gem(True),
    "bomb": bomb(False),
    "bomb-hit": bomb(True),
    "emitter": emitter,
}

if __name__ == "__main__":
    main("laser", SPRITES)
