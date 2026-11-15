"""The Sports overhaul's rendered sprites (phase 2, step 4): Captain Joulz (docs/design/cosmetics-redraws/blender/captain)
posed for Cue Ball, Curl Champ and Apex, and Apex's race car with him in the cockpit, rendered in Blender (Cycles) on
transparent backgrounds and written to public/sports/<game>/ as WebP, with their anchors in
src/lib/arcade/sportsSprites.data.ts (written by this script). Display only: the games draw these over their own
painted fallbacks once loaded (src/lib/arcade/sportsSprites.ts).

    pip install bpy pillow numpy scipy        (in a venv outside the project folder)
    python render_sports.py [pool|curling|racing …] [--skin=<name>] [--samples=N] [--preview]

Skins: every Captain material comes from captain.MATERIALS; a skin is another table (SKINS below), rendered to
public/sports/<game>/<skin>/ with the same file names, so a game asks for its sprites by skin id. Only "classic" is
rendered today.
"""
import json
import math
import os
import sys

import bpy
from mathutils import Vector
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
BLENDER = os.path.abspath(os.path.join(HERE, "../../cosmetics-redraws/blender"))
sys.path.insert(0, os.path.join(BLENDER, "captain"))
sys.path.insert(0, BLENDER)
import captain  # noqa: E402
import lib  # noqa: E402

REPO = os.path.abspath(os.path.join(HERE, "../../../.."))
PUBLIC = os.path.join(REPO, "public/sports")
DATA = os.path.join(REPO, "src/lib/arcade/sportsSprites.data.ts")
TMP = os.environ.get("RENDER_TMP", "/tmp")

ARGS = [a for a in sys.argv[1:] if not a.startswith("--")]
OPT = dict(a[2:].split("=", 1) if "=" in a else (a[2:], "1") for a in sys.argv[1:] if a.startswith("--"))
SAMPLES = int(OPT.get("samples", 48))
PREVIEW = "preview" in OPT
SKIN = OPT.get("skin", "classic")
SKINS = {"classic": captain.MATERIALS}

# Extra poses in the 2D art's units (x right, y down, feet at 184) with per-joint depth (negative = his front).
POSES = {
    # Curling: the delivery, low over the sliding foot, the stone hand forward, the trailing leg stretched back.
    "curl_slide": {
        "neck": [80, 64], "hip": [80, 114], "sh": [[62, 72], [98, 72]],
        "el": [[46, 92], [100, 94]], "ha": [[30, 104], [96, 116]],
        "hp": [[72, 116], [88, 116]], "kn": [[70, 140], [92, 148]], "ft": [[68, 168], [94, 170]], "lean": 0,
    },
    "curl_release": {
        "neck": [80, 64], "hip": [80, 114], "sh": [[62, 72], [98, 72]],
        "el": [[46, 90], [102, 88]], "ha": [[30, 100], [104, 104]],
        "hp": [[72, 116], [88, 116]], "kn": [[70, 140], [92, 148]], "ft": [[68, 168], [94, 170]], "lean": 0,
    },
    # Cue Ball: one arm, straight out, the hand closed round the cue's butt (only the arm is rendered).
    "cue_arm": {
        "neck": [80, 64], "hip": [80, 114], "sh": [[62, 72], [98, 72]],
        "el": [[50, 98], [100, 104]], "ha": [[46, 124], [101, 136]],
        "hp": [[72, 116], [88, 116]], "kn": [[68, 150], [92, 150]], "ft": [[64, 184], [96, 184]], "lean": 0,
    },
    # Apex: seated at the wheel (only the helmet and shoulders show over the cockpit).
    "drive": {
        "neck": [80, 64], "hip": [80, 114], "sh": [[62, 72], [98, 72]],
        "el": [[54, 92], [106, 92]], "ha": [[66, 80], [94, 80]],
        "hp": [[72, 116], [88, 116]], "kn": [[68, 150], [92, 150]], "ft": [[64, 184], [96, 184]], "lean": 0,
    },
}
DEPTHS = {
    "curl_slide": {"el": (-6, -26), "ha": (-4, -48), "kn": (-34, 26), "ft": (-8, 62)},
    "curl_release": {"el": (-6, -30), "ha": (-4, -62), "kn": (-34, 26), "ft": (-8, 62)},
    "cue_arm": {"el": (0, -4), "ha": (0, -6), "kn": (0, 0), "ft": (0, 0)},
    "drive": {"el": (-14, -14), "ha": (-30, -30), "kn": (0, 0), "ft": (0, 0)},
}
captain.POSES.update(POSES)
captain.POSE_DEPTH.update(DEPTHS)

META = {}


def save(png, name, game, crop=True, size=None):
    """Writes the render as public/sports/<game>/[<skin>/]<name>.webp, cropped to its alpha; returns (w, h, ox, oy)."""
    img = Image.open(png).convert("RGBA")
    W, H = img.size
    box = img.getchannel("A").point(lambda a: 255 if a > 6 else 0).getbbox() if crop else (0, 0, W, H)
    if box is None:
        box = (0, 0, W, H)
    img = img.crop(box)
    if size:
        img = img.resize(size, Image.LANCZOS)
    d = os.path.join(PUBLIC, game) if SKIN == "classic" else os.path.join(PUBLIC, game, SKIN)
    os.makedirs(d, exist_ok=True)
    path = os.path.join(d, f"{name}.webp")
    img.save(path, "WEBP", quality=90, method=6)
    print(f"  {game}/{name}: {img.size[0]}x{img.size[1]}, {os.path.getsize(path) / 1024:.1f} KB")
    return {"w": img.size[0], "h": img.size[1], "box": list(box), "full": [W, H]}


def project(cam_obj, pt, W, H):
    from bpy_extras.object_utils import world_to_camera_view

    co = world_to_camera_view(bpy.context.scene, cam_obj, Vector(pt))
    return (co.x * W, (1 - co.y) * H)


def hide(parent, keep):
    """Removes every captain part whose name doesn't start with one of `keep`."""
    for o in list(parent.children):
        if not any(o.name.startswith("captain." + k) for k in keep):
            bpy.data.objects.remove(o, do_unlink=True)


def studio(key=420, rim=300, fill=90):
    lib.world((0.03, 0.035, 0.05), 0.6)
    lib.area_light((-2.2, -2.6, 4.0), (0, 0, 0.6), key, 2.5, (1.0, 0.95, 0.88))
    lib.area_light((2.6, 2.0, 2.6), (0, 0, 0.6), rim, 1.5, (0.75, 0.88, 1.0))
    lib.area_light((0.5, -3.0, 0.8), (0, 0, 0.5), fill, 3, (1.0, 0.88, 0.7))


# ---------------------------------------------------------------- Cue Ball
def render_pool():
    """The Captain's cue arm seen from straight above, lying along +x from the hand (left) to the shoulder (right)."""
    W, H = 1040, 400
    lib.reset(W, H, samples=SAMPLES, transparent=True)
    studio(key=520, rim=260, fill=60)
    p = captain.build("cue_arm", location=(0, 0, 0), height=1.7, materials=SKINS[SKIN])
    hide(p, ["shoulder1", "upperarm1", "forearm1", "gauntlet1", "badge1", "badgebolt1", "palm1", "finger1", "thumb1"])
    # Lay the arm flat: rotate so the arm (pointing down in art) points along -x, then look down from above.
    bpy.context.view_layer.update()
    pts = [o.matrix_world.translation.copy() for o in p.children]
    sh = next(o for o in p.children if o.name == "captain.shoulder1").matrix_world.translation.copy()
    p.rotation_euler = (0, math.radians(90), 0)  # z (up) → +x; the hand, below the shoulder, ends at -x
    bpy.context.view_layer.update()
    sh = next(o for o in p.children if o.name == "captain.shoulder1").matrix_world.translation.copy()
    hand = next(o for o in p.children if o.name == "captain.palm1").matrix_world.translation.copy()
    mid = (sh + hand) / 2
    cam = lib.camera((mid.x, mid.y, mid.z + 6), (mid.x, mid.y, mid.z), lens=50, ortho_scale=1.05)
    png = os.path.join(TMP, "pool-arm.png")
    lib.render(png)
    hx, hy = project(cam, hand, W, H)
    sx, sy = project(cam, sh, W, H)
    m = save(png, "arm", "pool")
    bx, by = m["box"][0], m["box"][1]
    META["pool"] = {"arm": {**m, "hand": [round(hx - bx, 1), round(hy - by, 1)], "shoulder": [round(sx - bx, 1), round(sy - by, 1)]}}


# ---------------------------------------------------------------- Curl Champ
def render_curling():
    """The Captain's delivery from behind and above (the game's own camera angle), sliding and at release."""
    W, H = 640, 640
    out = {}
    for pose in ("curl_slide", "curl_release"):
        lib.reset(W, H, samples=SAMPLES, transparent=True)
        studio(key=380, rim=420, fill=80)
        p = captain.build(pose, location=(0, 0, 0), height=1.7, materials=SKINS[SKIN])
        # Lean the body forward over the sliding knee, then turn him to face down the sheet (+y, away from camera).
        p.rotation_euler = (math.radians(48), 0, math.pi)
        p.location = (0, 0, 0.62)
        bpy.context.view_layer.update()
        cam = lib.camera((2.6, -4.0, 2.6), (0, 0.4, 0.45), lens=58)
        png = os.path.join(TMP, f"{pose}.png")
        lib.render(png)
        hand = next(o for o in p.children if o.name == "captain.palm1").matrix_world.translation
        hx, hy = project(cam, hand, W, H)
        m = save(png, pose.replace("curl_", ""), "curling")
        out[pose.replace("curl_", "")] = {**m, "hand": [round(hx - m["box"][0], 1), round(hy - m["box"][1], 1)]}
    META["curling"] = out


# ---------------------------------------------------------------- Apex
CAR = {
    "paint": {"base": (0.16, 0.16, 0.19), "metallic": 0.7, "roughness": 0.3, "coat": 1.0},
    "carbon": {"base": (0.012, 0.012, 0.014), "metallic": 0.2, "roughness": 0.35, "coat": 0.4},
    "tyre": {"base": (0.018, 0.018, 0.02), "metallic": 0.0, "roughness": 0.75},
    "rim": {"base": (1.0, 0.72, 0.32), "metallic": 1.0, "roughness": 0.25},
    "gold": {"base": (1.0, 0.74, 0.34), "metallic": 1.0, "roughness": 0.2},
}


def mat(name, spec, emission=None, strength=0.0):
    return lib.material(name, base=spec["base"], metallic=spec.get("metallic", 0), roughness=spec.get("roughness", 0.4),
                        coat=spec.get("coat", 0), emission=emission, strength=strength)


def box(name, loc, size, m, bevel=0.06, segs=3):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.object
    o.name = name
    o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    if bevel:
        b = o.modifiers.new("b", "BEVEL")
        b.width = bevel
        b.segments = segs
    bpy.ops.object.shade_smooth()
    o.data.materials.append(m)
    return o


def wheel(name, loc, r, w, tyre, rim):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=w, location=loc, rotation=(0, math.radians(90), 0), vertices=48)
    t = bpy.context.object
    t.name = name
    b = t.modifiers.new("b", "BEVEL")
    b.width = r * 0.18
    b.segments = 4
    bpy.ops.object.shade_smooth()
    t.data.materials.append(tyre)
    side = 1 if loc[0] > 0 else -1
    bpy.ops.mesh.primitive_cylinder_add(radius=r * 0.62, depth=0.02, location=(loc[0] + side * w / 2, loc[1], loc[2]), rotation=(0, math.radians(90), 0), vertices=32)
    bpy.context.object.data.materials.append(rim)
    return t


def build_car(braking, paint_spec=None):
    """A Le Mans-style open prototype seen from behind: graphite body, gold accents, the Captain in the cockpit."""
    mats = {k: mat(f"car.{k}", v) for k, v in CAR.items()}
    if paint_spec:
        mats["paint"] = mat("car.paint", paint_spec)
    light = lib.emission_material("car.light", (1.0, 0.08, 0.06), 9.0 if braking else 2.2)
    parts = []
    # Floor and tub.
    parts.append(box("floor", (0, 0, 0.16), (1.9, 4.5, 0.1), mats["carbon"], 0.03))
    parts.append(box("tub", (0, 0.2, 0.42), (1.12, 3.9, 0.46), mats["paint"], 0.1, 3))
    # Sidepods sweeping up into the rear fenders.
    for sx in (-1, 1):
        parts.append(box(f"pod{sx}", (sx * 0.72, -0.25, 0.42), (0.5, 2.9, 0.42), mats["paint"], 0.1, 3))
        parts.append(box(f"fender{sx}", (sx * 0.82, -1.55, 0.58), (0.4, 1.05, 0.5), mats["paint"], 0.1, 3))
        parts.append(box(f"ffender{sx}", (sx * 0.8, 1.6, 0.52), (0.4, 0.95, 0.42), mats["paint"], 0.18, 4))
    # Engine cover (a fin up the middle) behind the cockpit.
    parts.append(box("cover", (0, -1.0, 0.72), (0.62, 1.9, 0.36), mats["paint"], 0.1, 3))
    parts.append(box("fin", (0, -1.0, 0.95), (0.04, 1.5, 0.24), mats["paint"], 0.02))
    parts.append(box("stripe", (0, -1.0, 0.905), (0.16, 1.9, 0.02), mats["gold"], 0.005))
    # Rear wing on two gold-edged endplates.
    parts.append(box("wing", (0, -2.1, 0.98), (1.86, 0.36, 0.05), mats["carbon"], 0.02))
    parts.append(box("wingedge", (0, -2.27, 1.0), (1.86, 0.02, 0.03), mats["gold"], 0.005))
    for sx in (-1, 1):
        parts.append(box(f"plate{sx}", (sx * 0.95, -2.1, 0.86), (0.04, 0.5, 0.4), mats["paint"], 0.01))
        parts.append(box(f"pylon{sx}", (sx * 0.25, -2.0, 0.84), (0.05, 0.12, 0.25), mats["carbon"], 0.01))
    # Diffuser, tail-light bar and the rain light.
    parts.append(box("diffuser", (0, -2.2, 0.26), (1.3, 0.2, 0.26), mats["carbon"], 0.02))
    parts.append(box("lightbar", (0, -2.13, 0.66), (1.5, 0.04, 0.06), light, 0.01))
    for sx in (-1, 1):
        parts.append(box(f"tail{sx}", (sx * 0.78, -2.12, 0.66), (0.24, 0.05, 0.12), light, 0.02))
    parts.append(box("rain", (0, -2.24, 0.42), (0.12, 0.03, 0.08), light, 0.01))
    # Wheels: wide rears, fronts mostly hidden.
    for sx in (-1, 1):
        wheel(f"rear{sx}", (sx * 0.86, -1.55, 0.36), 0.36, 0.42, mats["tyre"], mats["rim"])
        wheel(f"front{sx}", (sx * 0.86, 1.6, 0.34), 0.34, 0.34, mats["tyre"], mats["rim"])
    # The Captain in the cockpit: helmet and shoulders over the rim, facing forward (+y).
    cap = captain.build("drive", location=(0, 0.3, -0.12), height=1.45, rotation_z=math.pi, materials=SKINS[SKIN])
    hide(cap, ["helmet", "visor", "crownline", "neck", "neckring", "shoulder", "torso", "piping"])
    # The roll hoop behind his head.
    bpy.ops.mesh.primitive_torus_add(major_radius=0.2, minor_radius=0.035, location=(0, -0.12, 0.82), rotation=(math.radians(90), 0, 0))
    bpy.context.object.data.materials.append(mats["gold"])
    return cap


def render_racing():
    """The car from the chase camera at seven yaws (−5° … 5°), lights off and braking, plus each yaw's paint mask."""
    W, H = 920, 600
    yaws = [float(y) for y in OPT["yaws"].split(",")] if "yaws" in OPT else [-5.0, -3.3, -1.7, 0.0, 1.7, 3.3, 5.0]
    variants = OPT.get("variants", "car,brake,mask").split(",")
    frames = []
    for variant in variants:
        for i, yaw in enumerate(yaws):
            lib.reset(W, H, samples=SAMPLES if variant != "mask" else max(16, SAMPLES // 2), transparent=True)
            # Warm low sun from ahead-left, a cool sky fill, the road's bounce.
            lib.world((0.35, 0.22, 0.2), 0.7)
            lib.area_light((-6, 12, 3.0), (0, 0, 0.6), 3200, 6, (1.0, 0.62, 0.36))
            lib.area_light((3, -5, 6), (0, 0, 0.5), 600, 5, (0.6, 0.7, 1.0))
            lib.area_light((0, -4, 0.2), (0, 0, 0.6), 120, 6, (0.9, 0.55, 0.45))
            spec = {"base": (0.9, 0.9, 0.9), "metallic": 0.0, "roughness": 0.5} if variant == "mask" else None
            build_car(variant == "brake", spec)
            if variant == "mask":
                # Everything but the paint is held out: what remains is the paint's own shading, to tint for skins.
                for o in bpy.data.objects:
                    if o.type == "MESH" and not any(m and m.name.startswith("car.paint") for m in o.data.materials):
                        o.is_holdout = True
            # Turn the car, not the camera, so the road stays still under it.
            for o in bpy.data.objects:
                if o.type in ("MESH", "EMPTY") and o.parent is None:
                    o.rotation_euler.z += math.radians(yaw)
                    o.location = Vector(o.location).copy()
                    x, y = o.location.x, o.location.y
                    c, s = math.cos(math.radians(yaw)), math.sin(math.radians(yaw))
                    o.location.x, o.location.y = x * c - y * s, x * s + y * c
            cam = lib.camera((0, -9.5, 3.1), (0, 0.6, 0.55), lens=58)
            png = os.path.join(TMP, f"car-{variant}-{i}.png")
            lib.render(png)
            # Every variant is cropped to the same full frame, so they overlay exactly.
            m = save(png, f"{variant}-{i}", "racing", crop=False)
            if variant == "car":
                l, r = project(cam, (-0.95 - 0.21, -2.2, 0.0), W, H), project(cam, (0.95 + 0.21, -2.2, 0.0), W, H)
                frames.append({"yaw": yaw, **m, "contactY": round((l[1] + r[1]) / 2, 1)})
    # The body's width at the rear wheels (outer tyre walls) for the bounds rule.
    lib.reset(W, H, samples=8, transparent=True)
    cam = lib.camera((0, -9.5, 3.1), (0, 0.6, 0.55), lens=58)
    l = project(cam, (-1.07, -1.55, 0.36), W, H)
    r = project(cam, (1.07, -1.55, 0.36), W, H)
    META["racing"] = {"frames": frames, "bodyLeft": round(l[0], 1), "bodyRight": round(r[0], 1)}


def write_data():
    old = {}
    if os.path.exists(DATA):
        txt = open(DATA).read()
        start = txt.find("= ") + 2
        try:
            old = json.loads(txt[start:txt.rfind(";")])
        except ValueError:
            old = {}
    old.update(META)
    with open(DATA, "w") as f:
        f.write("// Written by docs/design/game-art/sports/render_sports.py: the rendered sprites' sizes and anchors.\n")
        f.write("// eslint-disable\n")
        f.write("export const SPORTS_SPRITES = " + json.dumps(old, indent=1) + ";\n")


for g in ARGS or ["pool", "curling", "racing"]:
    {"pool": render_pool, "curling": render_curling, "racing": render_racing}[g]()
if not PREVIEW:
    write_data()
