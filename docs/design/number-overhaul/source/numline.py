"""Ballpark (`numline`): the ruler, the number card and the marker pins.

Lit as product shots (Joe's clarification, 15 Nov 2026: premium materials need light on them, highlights on curves
and edges, never washed across a face or a number):

  ruler       a polished chrome rail with rounded ends: a crisp highlight line along its top curve and a fainter one
              along its underside, the steel reflecting a dark studio between them. The app stretches it to the line's
              width (it is lit evenly along its length) and draws the bold end labels, the notches and the markers.
  card        the number card: deep navy lacquer under a clear coat, its rounded rim catching the light (a bright top
              edge, a soft lower one); the face itself stays dark and clean for the number. Drawn 9-slice by the app.
  pin         the live marker's head: polished champagne gold, a crisp highlight on its upper left.
  pin-placed  a placed marker's head: polished steel.

The app draws the needles and every number. Run:
  /opt/blender/venv/bin/python docs/design/number-overhaul/source/numline.py [ruler card pin pin-placed]
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sprites import *  # noqa: F401,F403
import bpy
import jzlib

GAME = "numline"


def strip(x, y, z, aim, width, length, energy, long_axis="x", color="#ffffff"):
    """A long, narrow area light at sprite point (x, y, z), facing `aim` (x, y, z), its long side along the sprite's
    x or y, so a cylinder along that axis reflects it as one straight line."""
    from mathutils import Matrix, Vector
    d = bpy.data.lights.new("strip", "AREA")
    d.energy = energy
    d.color = hexc(color)[:3]
    d.shape = "RECTANGLE"
    ob = bpy.data.objects.new("strip", d)
    bpy.context.scene.collection.objects.link(ob)
    loc = jzlib.V(x, y, z)
    zax = (loc - jzlib.V(*aim)).normalized()          # an area light shines down its local -Z
    along = Vector((1.0, 0.0, 0.0)) if long_axis == "x" else Vector((0.0, 1.0, 0.0))
    xax = along - zax * along.dot(zax)
    xax.normalize()
    yax = zax.cross(xax).normalized()
    d.size, d.size_y = length * P, width * P              # the long side along local x
    ob.matrix_world = Matrix(((xax.x, yax.x, zax.x, loc.x), (xax.y, yax.y, zax.y, loc.y), (xax.z, yax.z, zax.z, loc.z), (0, 0, 0, 1)))
    return ob


def clear_lights():
    for ob in list(bpy.data.objects):
        if ob.type == "LIGHT":
            bpy.data.objects.remove(ob)


def ruler():
    """360 x 36 points; the rail's body runs 6–30 down (the app maps that to the tape's thickness)."""
    setup(360, 36, scale=3, samples=96)
    world("#06080f", 0.0, hdri="studio.exr", hdri_strength=0.35)
    clear_lights()
    chrome = mat("chrome", "#d9dde4", 0.12, metal=1.0)
    add_bump(chrome, 400, 0.01, stretch=(1, 30, 1), distance=0.0004)     # a faint polish grain along the rail
    xcyl(6, 18, 348, 12, chrome, z=0, bevel=4, verts=96)
    # A crisp line along the top curve and a softer one under it; a warm glint on the ends from the key.
    strip(180, -260, 150, (180, 18, 0), 4, 1400, 2600)
    strip(180, 280, 120, (180, 18, 0), 10, 1400, 700, color="#dbe5ff")
    area(-40, -80, 120, 40, 260, "#fff4e2", target=(20, 18, 0))
    write(GAME, "ruler")


def card():
    """The number card, 360 x 100 points; its 9-slice corners are 24 points (the app's border-image)."""
    setup(360, 100, scale=3, samples=96)
    world("#06080f", 0.0, hdri="studio.exr", hdri_strength=0.04)
    clear_lights()
    lacquer = mat("lacquer", "#070c1a", 0.32, coat=1.0, coat_rough=0.06)
    rim = mat("cardrim", "#c9cfdb", 0.16, metal=1.0)
    # A thin polished steel rim under the lacquered face: the rim's curve takes the light, the face stays dark.
    box(2, 2, 356, 96, 10, rim, r=14)
    box(5, 5, 350, 90, 12, lacquer, r=12, z=0.5)
    # The key's reflection on the top curved edge, a soft one on the bottom edge; nothing faces the camera square on.
    strip(180, -300, 160, (180, 50, 0), 6, 1400, 2200)
    strip(180, 380, 120, (180, 50, 0), 14, 1400, 500, color="#dbe5ff")
    strip(-300, 50, 140, (180, 50, 0), 8, 600, 600, long_axis="y")
    write(GAME, "card")


def pin(name, color, rough):
    """A pin's head alone (32 x 32 points, its centre the sprite's centre); the app draws the needle."""
    setup(32, 32, scale=4, samples=96)
    world("#06080f", 0.0, hdri="studio.exr", hdri_strength=0.6)
    head = mat(f"head{name}", color, rough, metal=1.0)
    sphere(16, 16, 14, head, z=0)
    write(GAME, name)


if __name__ == "__main__":
    run({
        "ruler": ruler,
        "card": card,
        "pin": lambda: pin("pin", "#e2c07a", 0.2),
        "pin-placed": lambda: pin("pin-placed", "#b9bec8", 0.18),
    })
