"""Brimful (`measure`): the glass jug shell and the shelf the jugs stand on.

The jug is a clear glass beaker (a thick base, straight walls and a rolled lip) rendered alone on a transparent film:
only the glass's Fresnel edges and a soft sheen have alpha, so the app draws vivid water, the litre marks and the
target line *behind* it and the glass reads as real glass in front. The straight walls let the app stretch the
middle (CSS border-image, 9-slice) to any jug's width and height without bending the lip or the base.

Run:  /opt/blender/venv/bin/python docs/design/number-overhaul/source/measure.py [jug-front shelf]
"""
import math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sprites import *  # noqa: F401,F403
import bmesh
import jzlib

GAME = "measure"
# The jug sprite: 120 x 300 points at 3 px a point. Its 9-slice insets (points): lip 10, walls 9, base 24.
JW, JH = 120, 300
WALL, LIP, BASE = 9, 10, 24


def lathe(profile, m, segs=96):
    """A solid of revolution about the sprite's vertical centre line. `profile` is (radius, y) in points, top to
    bottom, open (the inner wall comes back up)."""
    me = bpy.data.meshes.new("lathe")
    bm = bmesh.new()
    cx = jzlib.W / 2
    ring_prev = None
    rings = []
    for k in range(segs):
        a = 2 * math.pi * k / segs
        ring = []
        for r, y in profile:
            v = jzlib.V(cx + r * math.cos(a), y, r * math.sin(a))
            ring.append(bm.verts.new(v))
        rings.append(ring)
    for k in range(segs):
        a, b = rings[k], rings[(k + 1) % segs]
        for i in range(len(profile) - 1):
            bm.faces.new((a[i], a[i + 1], b[i + 1], b[i]))
    bm.normal_update()
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    ob = bpy.data.objects.new("lathe", me)
    jzlib._set_mat(ob, m)
    return jzlib._link(ob)


def jug_front():
    """A clear glass beaker lit as a product shot: crisp vertical highlights on its curved walls (narrow, in the
    right-hand wall and a thin edge on the left, clear of the litre marks), a bright rolled lip and a glinting thick
    base. The middle stays clear glass, so the water and the marks read through it."""
    setup(JW, JH, scale=3, samples=96)
    # A darker studio for the reflections: the glass shows the strips, not a grey haze.
    world("#06080f", 0.0, hdri="studio.exr", hdri_strength=0.18)
    for ob in list(bpy.data.objects):
        if ob.type == "LIGHT":
            bpy.data.objects.remove(ob)
    glass_m = thin_glass("jugglass", "#ffffff", rough=0.015, strength=1.0)
    R = JW / 2 - 4          # outer radius at the walls
    t = 3.2                 # wall thickness
    top, bot = 6, JH - 6
    prof = [
        (R - t, top + 3), (R - t * 0.4, top - 0.8), (R + 1.4, top), (R + 1.6, top + 3.2), (R, top + 6),  # rolled lip
        (R, bot - 14), (R - 2, bot - 4), (R - 7, bot - 0.4), (0.01, bot),                                   # outer base
    ]
    inner = [(0.01, bot - 11), (R - t - 6, bot - 12.5), (R - t - 1, bot - 18), (R - t, bot - 26), (R - t, top + 3)]
    lathe(prof + inner, glass_m)
    # Two tall, narrow strip lights well to the sides: on the curved wall each reflects as one crisp vertical line,
    # the key's on the right a third of the way in from the edge, a thinner one in the left wall's edge (clear of the
    # litre marks). Far past the ends, so the lines run the full height evenly (the app stretches the middle).
    area(JW + 130, JH / 2, 70, 10, 2600, "#ffffff", target=(JW / 2, JH / 2, 0), sx=6, sy=JH * 6)
    area(-210, JH / 2, 30, 10, 2600, "#e6eeff", target=(JW / 2, JH / 2, 0), sx=5, sy=JH * 6)
    # A small key in front, above and to the right: a bright glint on the rolled lip and the thick base's rim.
    area(JW * 0.8, -40, 120, 18, 420, "#fff6e8", target=(JW / 2, JH * 0.15, 0))
    write(GAME, "jug-front")


def shelf():
    setup(400, 40, scale=3, samples=96)
    world("#06080f", 0.0, hdri=None)
    slate = mat("slate", "#20242c", 0.78)
    add_bump(slate, 140, 0.18, detail=8)
    box(4, 8, 392, 22, 14, slate, r=4)
    lip = mat("shelflip", "#2b303a", 0.6)
    box(4, 6, 392, 5, 15, lip, r=2, z=1)
    write(GAME, "shelf")


if __name__ == "__main__":
    run({"jug-front": jug_front, "shelf": shelf})
