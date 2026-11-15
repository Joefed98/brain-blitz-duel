"""Captain Joulz on the Crazy Golf course (golfRev 3, the Crazy Golf overhaul, 15 Nov 2026): top-down sprites of the
approved 3D Captain (captain.py) with a club, lit from the top left as the course is, on transparent.

  address     standing over the ball, the club soled behind it (aiming)
  putt        the putt's follow-through, the club low along the line
  chip        the chip's follow-through, the hands high and the wedge face open

Two clubs, built here: a gold-shafted putter with a black lacquer head and a wedge with a gold blade. The Captain faces
-Y (towards the ball); the target is +X, so a sprite is drawn by the game turned so that +X is the shot's direction.

    python golf_sprites.py        → public/minigolf/captain-<pose>.webp (256 px square, the sprite's world size MG_CAPTAIN_PX)

Runs with bpy 5.3 (pip install bpy pillow numpy); render outside the project (RENDER_TMP).
"""
import math
import os
import sys

import bpy
from mathutils import Vector
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.dirname(HERE))
import captain  # noqa: E402
import lib  # noqa: E402

OUT = os.path.join(lib.REPO, "public/minigolf")
os.makedirs(OUT, exist_ok=True)

# The golf poses, in the 2D art's joint units (captain-poses.json's frame: x 0..160 centre 80, y down, feet at 184).
GOLF_POSES = {
    "address": {
        "neck": [80, 70], "hip": [80, 116], "sh": [[63, 78], [97, 78]], "el": [[70, 100], [90, 100]],
        "ha": [[78, 122], [82, 122]], "hp": [[71, 118], [89, 118]], "kn": [[68, 152], [92, 152]],
        "ft": [[63, 184], [97, 184]], "lean": 0,
    },
    "putt": {
        "neck": [80, 70], "hip": [80, 116], "sh": [[63, 78], [97, 78]], "el": [[78, 100], [98, 98]],
        "ha": [[94, 120], [98, 119]], "hp": [[71, 118], [89, 118]], "kn": [[68, 152], [92, 152]],
        "ft": [[63, 184], [97, 184]], "lean": 0,
    },
    "chip": {
        "neck": [80, 68], "hip": [80, 116], "sh": [[63, 76], [97, 76]], "el": [[84, 90], [102, 86]],
        "ha": [[104, 84], [108, 82]], "hp": [[71, 118], [89, 118]], "kn": [[70, 152], [92, 150]],
        "ft": [[63, 184], [97, 184]], "lean": 0,
    },
}
# Depth (towards the ball is -Y): the hands forward of the body, the club's head beyond them on the ground.
GOLF_DEPTH = {
    "address": {"el": (-10, -10), "ha": (-20, -20), "kn": (-3, -3), "ft": (0, 0)},
    "putt": {"el": (-10, -12), "ha": (-20, -20), "kn": (-3, -3), "ft": (0, 0)},
    "chip": {"el": (-8, -10), "ha": (-14, -14), "kn": (-3, -2), "ft": (0, 0)},
}
# Where each pose's club head sits (art units: x, height above the soles, depth).
CLUB_HEAD = {"address": (80, 2, -34), "putt": (112, 6, -30), "chip": (128, 40, -22)}

captain.POSES.update(GOLF_POSES)
captain.POSE_DEPTH.update(GOLF_DEPTH)

HEIGHT = 1.7
# The square of ground a sprite covers (m), so the Captain fills about half of it from above.
GROUND = 1.9


def art(xy_or_x, y=None, depth=0.0):
    s = HEIGHT / captain.ART_HEIGHT
    x, yy = (xy_or_x if y is None else (xy_or_x, y))
    return Vector(((x - 80.0) * s, depth * s, (captain.FEET_Y - yy) * s))


def club(pose):
    s = HEIGHT / captain.ART_HEIGHT
    p = GOLF_POSES[pose]
    hx = (p["ha"][0][0] + p["ha"][1][0]) / 2
    hy = (p["ha"][0][1] + p["ha"][1][1]) / 2
    hd = sum(GOLF_DEPTH[pose]["ha"]) / 2
    grip = art(hx, hy, hd)
    cx, cz, cd = CLUB_HEAD[pose]
    head = Vector(((cx - 80) * s, cd * s, cz * s))
    shaft = head - grip
    mid = grip + shaft / 2
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=1.1 * s, depth=shaft.length, location=mid)
    o = bpy.context.object
    o.rotation_mode = "QUATERNION"
    o.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(shaft.normalized())
    o.data.materials.append(lib.material("shaft", base=(1.0, 0.74, 0.34), metallic=1.0, roughness=0.2))
    # The head: a putter's flat black blade or a wedge's gold blade, along the target line (+X).
    w, d, h = (12 * s, 4 * s, 3.4 * s) if pose != "chip" else (9 * s, 2.4 * s, 6 * s)
    bpy.ops.mesh.primitive_cube_add(size=1, location=head)
    hd_o = bpy.context.object
    hd_o.scale = (w, d, h)
    bev = hd_o.modifiers.new("b", "BEVEL")
    bev.width = 0.8 * s
    bev.segments = 3
    if pose == "chip":
        hd_o.data.materials.append(lib.material("wedge", base=(1.0, 0.76, 0.36), metallic=1.0, roughness=0.15))
    else:
        hd_o.data.materials.append(lib.material("putter", base=(0.012, 0.014, 0.02), metallic=0.4, roughness=0.18, coat=1.0))
    # A gold sight line on the putter's top.
    if pose != "chip":
        bpy.ops.mesh.primitive_cube_add(size=1, location=head + Vector((0, 0, h / 2 + 0.2 * s)))
        line = bpy.context.object
        line.scale = (w * 0.7, 0.7 * s, 0.4 * s)
        line.data.materials.append(lib.material("sight", base=(1.0, 0.8, 0.4), metallic=1.0, roughness=0.2))


def sprite(pose, px=256):
    lib.reset(px, px, samples=int(os.environ.get("SAMPLES", 96)), transparent=True)
    lib.world((0.42, 0.48, 0.58), 0.35)
    captain.build(pose=pose, location=(0, 0, 0), height=HEIGHT)
    club(pose)
    # The course's light: a warm key from the top left, a soft cool fill.
    sun = bpy.data.lights.new("sun", "SUN")
    sun.energy = 3.4
    sun.angle = math.radians(10)
    sun.color = (1.0, 0.95, 0.86)
    o = bpy.data.objects.new("sun", sun)
    bpy.context.scene.collection.objects.link(o)
    o.rotation_euler = (math.radians(24), math.radians(-18), math.radians(-35))
    # A shadow catcher under him, so the sprite carries its own contact shadow.
    bpy.ops.mesh.primitive_plane_add(size=6, location=(0, 0, 0))
    plane = bpy.context.object
    plane.is_shadow_catcher = True
    # From above, tipped 30° towards the ball's side (so the visor, the bolt and the club read, not just the helmet's
    # crown), the body a little behind the frame's middle so the club's head reaches towards the ball.
    tip = math.radians(30)
    target = Vector((0, -0.2, 0.8))
    lib.camera(tuple(target + Vector((0, -math.sin(tip), math.cos(tip))) * 12), tuple(target), ortho_scale=GROUND)
    png = os.path.join(lib.TMP, f"captain-golf-{pose}.png")
    secs = lib.render(png)
    img = Image.open(png).convert("RGBA")
    path = os.path.join(OUT, f"captain-{pose}.webp")
    img.save(path, "WEBP", quality=82, method=6, exact=False)
    print(f"captain-{pose}: {secs:.1f} s, {os.path.getsize(path) / 1024:.1f} KB")


if __name__ == "__main__":
    for p in sys.argv[1:] or ["address", "putt", "chip"]:
        sprite(p)
