"""Ballpark (`numline`): the ruler, the number card and the marker pins.

Lit as product shots (Joe's clarification, 15 Nov 2026: premium materials need light on them, highlights on curves
and edges, never washed across a face or a number):

  ruler       a flat ruler bar (360 x 80 points): a dark enamel face, even and clean, between polished bevelled chrome
              edges and chrome end caps, the crisp highlights only on those; cut into ruler-l, ruler-m and ruler-r so
              the app stretches only the plain middle, sideways (never vertically), and draws the ticks, end labels
              and markers.
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
    """A flat ruler bar, 360 x 80 points at its largest display: a dark enamel face, even and clean so the app's ticks
    and pins read, between polished bevelled chrome edges top and bottom and chrome end caps; the crisp highlights
    sit only on those edges and caps. Rendered whole and cut into three slices (only the slices ship) the app draws so only the
    plain middle stretches, and only sideways: ruler-l and ruler-r (the end caps, 24 points wide) and ruler-m (a
    4-point slice of the plain middle)."""
    setup(360, 80, scale=3, samples=128)
    world("#06080f", 0.0, hdri="studio.exr", hdri_strength=0.12)
    clear_lights()
    chrome = mat("chrome", "#dfe3ea", 0.1, metal=1.0)
    enamel = mat("enamel", "#0c1220", 0.55, coat=0.12, coat_rough=0.35, spec=0.25)
    add_bump(enamel, 300, 0.006, distance=0.0003)
    # The face, sunk a little between the edges.
    box(10, 9, 340, 62, 6, enamel, r=1.5, z=0)
    # Bevelled chrome edges: rounded rails along the top and the bottom, a little proud of the face.
    xcyl(8, 8.5, 344, 6, chrome, z=3, bevel=2, verts=64)
    xcyl(8, 71.5, 344, 6, chrome, z=3, bevel=2, verts=64)
    # End caps: chrome blocks with bevels across the ends.
    box(2, 2, 14, 76, 12, chrome, r=4, z=-1)
    box(344, 2, 14, 76, 12, chrome, r=4, z=-1)
    # Long lights along the rails: the top rail's upper curve and the bottom rail's lower curve take a crisp line; a
    # low raking key glints on the caps. Nothing faces the enamel square on.
    strip(180, -320, 150, (180, 8, 0), 4, 1400, 2400)
    strip(180, 420, 130, (180, 72, 0), 8, 1400, 900, color="#dbe5ff")
    area(-30, 40, 40, 16, 120, "#fff4e2", target=(8, 40, 0))
    area(390, 40, 40, 16, 80, "#dbe5ff", target=(352, 40, 0))
    # A soft, even fill straight down the face's length, so the enamel reads as a dark surface, not a void.
    strip(180, 40, 400, (180, 40, 0), 60, 900, 35, color="#c9d4ff")
    out = write(GAME, "ruler")
    from PIL import Image
    im = Image.open(out).convert("RGBA")
    k = im.height / 80
    cap, mid = round(24 * k), im.width // 2
    im.crop((0, 0, cap, im.height)).save(out.replace("ruler.webp", "ruler-l.webp"), "WEBP", quality=88, method=6)
    im.crop((im.width - cap, 0, im.width, im.height)).save(out.replace("ruler.webp", "ruler-r.webp"), "WEBP", quality=88, method=6)
    im.crop((mid - round(2 * k), 0, mid + round(2 * k), im.height)).save(out.replace("ruler.webp", "ruler-m.webp"), "WEBP", quality=92, method=6)
    os.remove(out)  # only the slices ship
    print("cut ruler-l, ruler-m, ruler-r")


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
    setup(32, 32, scale=6, samples=96)
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
