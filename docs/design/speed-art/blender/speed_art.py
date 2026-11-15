"""Speed overhaul art (phase 2 step 4, 15 Nov 2026): every piece and surface the six Speed games draw, rendered in
Blender (Cycles, path traced, OpenImageDenoise) and exported as WebP sprites into public/speed-art/.

The look (docs/design/game-concepts/speed.md, Joe's picks): Speed's warm wood and orange on darker backgrounds,
real materials, clean even light. Minimal glow and no glare: every surface is satin (roughness 0.35 or more, a
rough clear coat at most), the key is a large soft box with a soft fill, so no panel, tile or number carries a
reflection or a hot spot. Numbers are never rendered here: the games draw them in code, big and bold, on the
plain faces these sprites leave for them.

Run (bpy 5.3 from PyPI, in a virtualenv outside the project):
    python speed_art.py <out_png_dir> [name ...] [--samples=N] [--preview]
then `python3 -I export.py <out_png_dir>` writes the WebPs and src/lib/fx/speedArt.data.ts.

Coordinates are sprite pixels (origin top left, y down); 1 px = 1 cm. Every sprite is reproducible from this
file and fixed seeds.
"""
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import bpy  # noqa: E402
import lib  # noqa: E402
from lib import (S, area, disc, glass, hexc, mat, metal, outline, prism, poly, rbox, ring, sphere,  # noqa: E402
                 tube, wood)

CAM_Z = lib.CAM_Z

# ------------------------------------------------------------------------------------------------- set-up


def cplane(cx, cy, w, h, m, z=0.0):
    """A flat w x h plane centred on (cx, cy)."""
    return lib.plane(cx - w / 2, cy - h / 2, w, h, m, z=z)


def setup(w, h, scale=2.0, transparent=True, seed=1, tilt=0.0):
    """A sprite canvas w x h px, rendered at `scale` px per px; `tilt` (degrees) looks down at an angle from the front."""
    lib.reset(seed=seed)
    lib._MATS.clear()
    lib._MESHES.clear()
    lib.W, lib.H = w, h
    sc = bpy.context.scene
    sc.render.resolution_x = int(round(w * scale))
    sc.render.resolution_y = int(round(h * scale))
    sc.render.film_transparent = transparent
    sc.render.image_settings.color_mode = "RGBA" if transparent else "RGB"
    sc.view_settings.view_transform = "Khronos PBR Neutral"
    cam = sc.camera
    cam.data.sensor_fit = "VERTICAL"
    cam.data.lens = 36 * CAM_Z / (h * S)
    if tilt:
        a = math.radians(tilt)
        cam.location = (0, -CAM_Z * math.sin(a), CAM_Z * math.cos(a))
        cam.rotation_euler = (a, 0, 0)
    return sc


def even_light(power=1.0, warm=(1.0, 0.93, 0.84), world_strength=0.22):
    """Clean, even light: a large soft key from the top left, a soft cool fill, a dim interior world. No hot spots."""
    w, h = lib.W, lib.H
    m = max(w, h)
    lib.world("interior", world_strength, rot=1.0, tint=(1.0, 0.92, 0.84, 1))
    d = m * 2.2
    area(-m * 0.6, -m * 0.6, d, m * 2.6, 2.3e-3 * d * d * power, warm, target=(w / 2, h / 2))
    area(w + m * 0.7, h + m * 0.5, d * 0.8, m * 2.6, 0.9e-3 * d * d * power, (0.86, 0.9, 1.0), target=(w / 2, h / 2))


def satin(key, color, rough=0.45, coat=0.0, metal_=0.0, bump=0.0, rough_var=0.08):
    """The overhaul's one non-metal surface: satin, never glossy (coat roughness 0.3)."""
    return mat(key, color, rough=rough, metal=metal_, coat=coat, coat_rough=0.3, rough_var=rough_var, bump=bump)


def champagne(key="champagne"):
    """Champagne gold, brushed and satin (no mirror highlights)."""
    return metal(key, hexc("#E2C07A"), rough=0.42, aniso=0.3)


def dark_wood(key, light="#3A2416", dark="#160C06", scale=10.0, rot90=False):
    """Dark oiled wood, warm (Speed's wood, a step darker than today's)."""
    return wood(key, hexc(light), hexc(dark), rough=0.55, scale=scale, coat=0.15, rot90=rot90)


def warm_board_light(power=0.85):
    even_light(power, warm=(1.0, 0.86, 0.68), world_strength=0.12)


# ---------------------------------------------------------------------------------------------- Flash


def flash_wait():
    """The waiting screen: dark smoked glass with faint etched rings, inside the wooden frame (frame drawn apart)."""
    setup(360, 560, transparent=False)
    even_light(0.9)
    cplane(180, 280, 380, 580, satin("fw_glass", hexc("#0D0B0A"), rough=0.6, rough_var=0.05), z=0)
    etch = satin("fw_etch", hexc("#1C1714"), rough=0.7)
    for r in (40, 92, 150, 214):
        ring(180, 280, r + 1.2, r, 0.3, etch, z=0.05, bevel=0.1)
    tick = satin("fw_tick", hexc("#211A15"), rough=0.7)
    for k in range(4):
        a = k * math.pi / 2
        prism(poly(4, 3, rot=a), 0.3, tick, z=0.05, cx=180 + math.cos(a) * 248, cy=280 + math.sin(a) * 248, bevel=0.1)


def flash_gold():
    """The flash: the glass flooding a warm, even gold (emissive, so it reads the same on every phone)."""
    setup(360, 560, transparent=False)
    m = bpy.data.materials.new("fg_burst")
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    o = nt.nodes.new("ShaderNodeOutputMaterial")
    e = nt.nodes.new("ShaderNodeEmission")
    tc = nt.nodes.new("ShaderNodeTexCoord")
    gr = nt.nodes.new("ShaderNodeTexGradient")
    gr.gradient_type = "QUADRATIC_SPHERE"
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (1 / 3.4, 1 / 4.4, 1)
    nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
    nt.links.new(mp.outputs["Vector"], gr.inputs["Vector"])
    cr = nt.nodes.new("ShaderNodeValToRGB")
    cr.color_ramp.elements[0].color = hexc("#E9971E")
    cr.color_ramp.elements[1].color = hexc("#FFD36A")
    cr.color_ramp.elements[0].position = 0.0
    cr.color_ramp.elements[1].position = 1.0
    nt.links.new(gr.outputs["Fac"], cr.inputs["Fac"])
    nt.links.new(cr.outputs["Color"], e.inputs["Color"])
    e.inputs["Strength"].default_value = 1.0
    nt.links.new(e.outputs[0], o.inputs[0])
    cplane(180, 280, 380, 580, m)
    bpy.context.scene.view_settings.view_transform = "Standard"


def flash_frame():
    """The polished walnut frame round the screen, drawn as a CSS border image (40 px slices, transparent middle)."""
    setup(240, 240, scale=2.0)
    even_light(1.0)
    rim = wood("ff_walnut", hexc("#7A4A26"), hexc("#3A1E0C"), rough=0.4, scale=16, coat=0.35)
    outline(120, 120, 236, 236, 26, 30, 10, rim, z=0)
    outline(120, 120, 180, 180, 10, 4, 6, satin("ff_lip", hexc("#170D07"), rough=0.6), z=0)
    outline(120, 120, 186, 186, 12, 2.2, 10.5, champagne("ff_gold"), z=0)


# --------------------------------------------------------------------------------------------- Ascend


def ascend_board():
    setup(390, 600, transparent=False)
    warm_board_light(0.85)
    cplane(195, 300, 420, 640, dark_wood("ab_walnut", "#3E220E", "#120702", scale=8), z=0)


def _counter(face_fn, rim_fn, key):
    """A domed counter, 120 px across: a turned rim and a flat-topped dome that leaves the face clear for its number."""
    setup(128, 128, scale=2.0, seed=7)
    even_light(1.0)
    face, rim_mat = face_fn(), rim_fn()
    disc(64, 64, 60, 8, rim_mat, z=0, bevel=3.0, segs=5)
    disc(64, 64, 52, 11, face, z=0, bevel=4.5, segs=6)


def ascend_disc():
    _counter(lambda: satin("ad_onyx", hexc("#1E1916"), rough=0.5, coat=0.2), lambda: metal("ad_brass", hexc("#B8925A"), rough=0.45), "todo")


def ascend_disc_done():
    _counter(lambda: satin("add_gold", hexc("#F0B43C"), rough=0.42, coat=0.15), lambda: metal("add_rim", hexc("#C9952E"), rough=0.4), "done")


# --------------------------------------------------------------------------------------------- Chain

CHAIN_GEMS = {
    "red": "#D9101E",
    "blue": "#1048E0",
    "green": "#04A848",
    "yellow": "#FFC800",
    "purple": "#7A1EF0",
    "orange": "#F25A00",
}


def chain_board():
    setup(390, 640, transparent=False)
    warm_board_light(0.8)
    cplane(195, 320, 420, 680, dark_wood("cb_wood", "#38200C", "#0F0602", scale=9), z=0)


def chain_charm(shape, colour):
    """A gem charm, 112 px across, in a champagne bezel; its shape is cut as clearly as its colour."""
    setup(128, 128, scale=2.0, seed=11)
    even_light(0.62)
    gem = satin(f"cg_{colour}", hexc(CHAIN_GEMS[colour]), rough=0.36, coat=0.25)
    bezel = champagne()
    if shape == "circle":
        disc(64, 64, 56, 6, bezel, z=0, bevel=2.2)
        disc(64, 64, 50, 12, gem, z=0, bevel=6, segs=6)
    elif shape == "square":
        rbox(64, 64, 108, 108, 6, bezel, r=20, z=0, bevel=2.2)
        rbox(64, 64, 96, 96, 12, gem, r=15, z=0, bevel=6, segs=6)
    else:
        prism(poly(3, 62, star=None), 6, bezel, z=0, cx=64, cy=72, bevel=2.2, segs=4)
        prism(poly(3, 52, star=None), 12, gem, z=0, cx=64, cy=72, bevel=6, segs=6)


# ---------------------------------------------------------------------------------------------- Bonk


def bonk_lawn():
    """Dusk lawn, darker: a dense mown turf with soft stripes (no holes; burrows are their own sprite)."""
    setup(512, 512, transparent=False, seed=3)
    even_light(0.7, warm=(1.0, 0.9, 0.78))
    m, nt, b = lib._principled("bl_turf")
    lib._noise_into(nt, b.inputs["Roughness"], scale=200, lo=0.7, hi=0.9)
    tc = nt.nodes.new("ShaderNodeTexCoord")
    nz = nt.nodes.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = 120
    nz.inputs["Detail"].default_value = 12
    nt.links.new(tc.outputs["Object"], nz.inputs["Vector"])
    cr = nt.nodes.new("ShaderNodeValToRGB")
    cr.color_ramp.elements[0].color = hexc("#13230F")
    cr.color_ramp.elements[1].color = hexc("#2C4A1F")
    nt.links.new(nz.outputs["Fac"], cr.inputs["Fac"])
    wv = nt.nodes.new("ShaderNodeTexWave")
    wv.wave_type = "BANDS"
    wv.bands_direction = "Y"
    wv.wave_profile = "SAW"
    wv.inputs["Scale"].default_value = 1.3
    nt.links.new(tc.outputs["Object"], wv.inputs["Vector"])
    st = nt.nodes.new("ShaderNodeMix")
    st.data_type = "RGBA"
    st.blend_type = "MULTIPLY"
    st.inputs["Factor"].default_value = 0.16
    nt.links.new(cr.outputs["Color"], st.inputs["A"])
    nt.links.new(wv.outputs["Color"], st.inputs["B"])
    nt.links.new(st.outputs["Result"], b.inputs["Base Color"])
    lib._bump(nt, b, scale=900, strength=0.6, detail=14, stretch=(1, 3, 1))
    b.inputs["Sheen Weight"].default_value = 0.3
    cplane(256, 256, 540, 540, m, z=0)


def bonk_burrow():
    """A dark burrow: a packed-earth lip round a deep hole. The hole (r 66, squashed to 0.92 tall) is the game's hole
    ellipse; the lip adds 12 px, so neighbouring burrows never touch."""
    setup(160, 150, scale=2.0, seed=5)
    even_light(0.85, warm=(1.0, 0.9, 0.78))
    earth = lib.stone("bb_earth", hexc("#4A3220"), hexc("#21150B"), rough=0.85, scale=18, veins=False)
    parts = [ring(80, 75, 78, 64, 6, earth, z=0, bevel=3.0, verts=128),
             disc(80, 75, 66, 1, satin("bb_hole", hexc("#050404"), rough=0.9), z=-6),
             disc(80, 75, 70, 1, satin("bb_shade", hexc("#0E0905"), rough=0.9), z=-2)]
    for o in parts:
        o.scale = (o.scale[0], o.scale[1] * 0.92, o.scale[2])


def _gopher(hat_colour=None, hedgehog=False):
    """A gopher looking up out of its burrow (seen from the front, a little above), inside a 220 px circle."""
    setup(220, 220, scale=1.0, seed=9, tilt=38)
    even_light(1.15, warm=(1.0, 0.92, 0.82))
    fur = mat("bg_fur", hexc("#6B4E3A"), rough=0.82, sheen=0.15, bump=0.15, bump_scale=900)
    belly = mat("bg_muzzle", hexc("#E9CFA2"), rough=0.7, sheen=0.4)
    ink = satin("bg_ink", hexc("#160F0C"), rough=0.4)
    white = satin("bg_white", hexc("#FAF4E8"), rough=0.4)
    if hedgehog:
        spine = mat("bh_spine", hexc("#5B4636"), rough=0.6)
        tip = mat("bh_tip", hexc("#D9C7A8"), rough=0.6)
        sphere(110, 118, 72, fur, z=40, squash=0.8)
        for k in range(90):
            a = k * 2.399963
            rr = 72 * math.sqrt((k + 0.5) / 90)
            x, y = 110 + math.cos(a) * rr, 104 + math.sin(a) * rr * 0.85
            if y > 150 and abs(x - 110) < 40:
                continue
            tube([(x, y, 55), (x + (x - 110) * 0.2, y + (y - 110) * 0.2 - 4, 84)], 4.2, spine)
            sphere(x + (x - 110) * 0.2, y + (y - 110) * 0.2 - 4, 3.0, tip, z=84)
        sphere(110, 150, 34, belly, z=70, squash=0.7)
        sphere(96, 136, 6, ink, z=96)
        sphere(124, 136, 6, ink, z=96)
        sphere(110, 160, 7, ink, z=100)
        return
    sphere(110, 134, 60, fur, z=40, squash=0.9)
    sphere(110, 158, 31, belly, z=72, squash=0.7)
    for x in (80, 140):
        sphere(x, 92, 10, fur, z=66, squash=0.6)
    sphere(93, 138, 7, ink, z=92)
    sphere(127, 138, 7, ink, z=92)
    sphere(91, 135.5, 2.1, white, z=98)
    sphere(125, 135.5, 2.1, white, z=98)
    sphere(110, 153, 7, satin("bg_nose", hexc("#3B2017"), rough=0.35), z=96)
    rbox(105, 174, 8, 10, 3, white, r=2, z=90, bevel=0.8)
    rbox(115, 174, 8, 10, 3, white, r=2, z=90, bevel=0.8)
    if hat_colour:
        hat = satin(f"bg_hat_{hat_colour}", hexc(hat_colour), rough=0.38, coat=0.25)
        sphere(110, 98, 46, hat, z=88, squash=0.66)
        disc(110, 112, 54, 5, hat, z=82, bevel=2.2)
        rbox(110, 78, 9, 34, 7, satin("bg_hatrib", hexc(hat_colour), rough=0.45), r=4, z=108, bevel=2)


def fit_group(pivot, to, k):
    """Scale every mesh about phone point `pivot` by k and move it to `to` (fills a sprite's circle)."""
    em = bpy.data.objects.new("fit", None)
    em.location = lib.P(*pivot, 0)
    lib.link(em)
    for o in list(bpy.data.objects):
        if o.type == "MESH":
            o.parent = em
            o.matrix_parent_inverse = em.matrix_world.inverted()
    em.scale = (k, k, k)
    em.location = lib.P(*to, 0)


def bonk_gopher_gold():
    _gopher("#F2B22A")
    fit_group((110, 120), (110, 118), 1.32)


def bonk_gopher_red():
    _gopher("#D8352E")
    fit_group((110, 120), (110, 118), 1.32)


def bonk_hedgehog():
    _gopher(hedgehog=True)
    fit_group((110, 124), (110, 112), 0.86)


# ------------------------------------------------------------------------------------------- Tenfall


def tenfall_board():
    """Four lanes in dark oiled wood (the sim's 360 x 520 world); rails between them, no glare."""
    setup(360, 520, transparent=False, seed=4)
    warm_board_light(0.85)
    cplane(180, 260, 380, 540, dark_wood("tb_floor", "#3A210D", "#110702", scale=7, rot90=True), z=0)
    rail = dark_wood("tb_rail", "#4A2D16", "#1E1006", scale=14, rot90=True)
    for col in (1, 2, 3):
        rbox(col * 90, 260, 6, 560, 4, rail, r=2, z=0, bevel=1.2)
    for col in range(4):
        rbox(col * 90 + 45, 260, 82, 560, 0.6, satin("tb_groove", hexc("#0E0703"), rough=0.8), r=4, z=-0.4, bevel=0.2)


TENFALL_TILES = {
    "digit": "#EFE3CB",
    "op": "#E3AE45",
    "minus": "#5A82AD",
    "gold": "#F5BE38",
    "refused": "#C9483A",
}


def tenfall_tile(look):
    """A blank enamel tile, 76 x 64 at (2, 2) in an 80 x 68 sprite; its label is drawn in code."""
    setup(80, 68, scale=3.0, seed=6)
    even_light(1.05)
    face = satin(f"tt_{look}", hexc(TENFALL_TILES[look]), rough=0.48, coat=0.1)
    rbox(40, 34, 76, 64, 7, face, r=11, z=0, bevel=2.6, segs=5)
    if look == "gold":
        outline(40, 34, 70, 58, 9, 2.0, 7.3, metal("tt_goldrim", hexc("#A8730E"), rough=0.4))


# --------------------------------------------------------------------------------------------- Pull!


def pull_sky():
    """The range in late afternoon, the sun toned right down: a deep sky, haze over a treeline, the grass and fence."""
    setup(360, 680, transparent=False, seed=8)
    m = bpy.data.materials.new("ps_sky")
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    o = nt.nodes.new("ShaderNodeOutputMaterial")
    e = nt.nodes.new("ShaderNodeEmission")
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(tc.outputs["Generated"], sep.inputs["Vector"])
    cr = nt.nodes.new("ShaderNodeValToRGB")
    els = cr.color_ramp.elements
    els[0].position, els[0].color = 0.0, hexc("#C98B5A")
    els[1].position, els[1].color = 1.0, hexc("#1F3E66")
    mid = els.new(0.35)
    mid.color = hexc("#6A7E92")
    nt.links.new(sep.outputs["Y"], cr.inputs["Fac"])
    nt.links.new(cr.outputs["Color"], e.inputs["Color"])
    e.inputs["Strength"].default_value = 1.0
    nt.links.new(e.outputs[0], o.inputs[0])
    cplane(180, 340, 440, 780, m, z=-30)
    lib.world("sunset", 0.35, rot=2.4)
    area(-200, 520, 300, 400, 420, (1.0, 0.78, 0.55), target=(180, 600))
    area(500, -200, 900, 900, 900, (0.8, 0.86, 1.0), target=(180, 500))
    trees = mat("ps_trees", hexc("#1C2A1C"), rough=0.85)
    for k in range(26):
        x = -10 + k * 15.5
        hgt = 34 + ((k * 37) % 23)
        sphere(x, 590 - hgt * 0.45, 14 + (k % 3) * 3, trees, z=-10, squash=1.6)
    haze = mat("ps_haze", (0.55, 0.5, 0.48, 1), rough=1.0)
    haze_mat = bpy.data.materials["ps_haze"]
    b = haze_mat.node_tree.nodes["Principled BSDF"]
    b.inputs["Alpha"].default_value = 0.22
    cplane(180, 590, 400, 26, haze, z=-4)
    grass = mat("ps_grass", hexc("#2D4A22"), rough=0.9, sheen=0.3, bump=0.4, bump_scale=600)
    cplane(180, 640, 400, 84, grass, z=0)
    post = wood("ps_post", hexc("#6B4A2E"), hexc("#3A2614"), rough=0.7, scale=20, coat=0.0)
    for k in range(7):
        rbox(10 + k * 58, 626, 6, 34, 5, post, r=1.5, z=1, bevel=1)
    rbox(180, 616, 400, 4, 4, post, r=1, z=4, bevel=0.8)
    rbox(180, 630, 400, 4, 4, post, r=1, z=4, bevel=0.8)


def _clay(colour, rim, key):
    """A clay target seen in flight: the 2R x 1.1R ellipse footprint, a raised dome and ring, satin (no glint)."""
    setup(26, 14.3, scale=6.0, seed=12, tilt=56)
    even_light(1.2)
    body = satin(f"pc_{key}", hexc(colour), rough=0.5, coat=0.15)
    disc(13, 7.15, 13, 3.0, body, z=0, bevel=1.2, segs=5)
    disc(13, 7.15, 8.2, 4.6, satin(f"pc_{key}d", hexc(rim), rough=0.5), z=0, bevel=1.4, segs=5)


def pull_clay_orange():
    _clay("#EE7428", "#F38A3E", "orange")


def pull_clay_gold():
    setup(26, 14.3, scale=6.0, seed=12, tilt=56)
    even_light(1.25)
    body = metal("pc_gold", hexc("#E9B53C"), rough=0.3, brushed=False)
    disc(13, 7.15, 13, 3.0, body, z=0, bevel=1.2, segs=5)
    disc(13, 7.15, 8.2, 4.6, metal("pc_goldd", hexc("#F6CC5C"), rough=0.26, brushed=False), z=0, bevel=1.4, segs=5)


def _bird(frame):
    """A white gull-like bird side on, flying right (the help's "white birds"): a slim body, a forked tail and one swept
    wing with dark tips; `frame` 0 wing up, 1 level, 2 down (the game picks the frame from its flap)."""
    setup(34, 22, scale=4.0, seed=13)
    even_light(1.0)
    body = mat("pb_body", hexc("#ECEEF1"), rough=0.7, sheen=0.3)
    belly = mat("pb_belly", hexc("#C3CAD3"), rough=0.75)
    tipm = mat("pb_tip", hexc("#2B2F36"), rough=0.6)
    torso = sphere(17, 12, 3.4, body, z=4, squash=0.7)
    torso.scale = (3.4 * S * 2.3, 3.4 * S, 3.4 * S * 0.7)
    chest = sphere(19, 13.4, 2.0, belly, z=5)
    chest.scale = (2.0 * S * 2.0, 2.0 * S * 0.8, 2.0 * S * 0.6)
    sphere(25.0, 11.2, 2.7, body, z=5)
    sphere(26.0, 10.6, 0.6, satin("pb_eye", hexc("#15171B"), rough=0.4), z=7.5)
    prism([(0, -1.0), (3.2, 0.2), (0, 1.0)], 1.2, satin("pb_beak", hexc("#E3A93A"), rough=0.5), z=5, cx=27.4, cy=11.4, bevel=0.3)
    prism([(0, -1.2), (-7, -3.6), (-4.6, 0), (-7, 3.0), (0, 1.2)], 1.0, body, z=3.5, cx=10.5, cy=12.2, bevel=0.25)
    wing = {0: [(0, 0), (-3, -9.5), (-7.5, -10.5), (-4, -1.5)],
            1: [(0, 0), (-9, -2.2), (-14, -1.0), (-5, 1.2)],
            2: [(0, 0), (-3, 8.5), (-7.5, 9.5), (-4, 1.5)]}[frame]
    prism(wing, 0.9, belly, z=6.5, cx=19.5, cy=11.0, bevel=0.3)
    tip = [(wing[1][0] + (wing[2][0] - wing[1][0]) * 0.0, wing[1][1]), wing[2], (wing[2][0] * 0.7, wing[2][1] * 0.6)]
    prism(tip, 1.0, tipm, z=6.9, cx=19.5, cy=11.0, bevel=0.2)


def pull_bird_0():
    _bird(0)


def pull_bird_1():
    _bird(1)


def pull_bird_2():
    _bird(2)


# ---------------------------------------------------------------------------------------------- main

SPRITES = {
    "flash-wait": flash_wait,
    "flash-gold": flash_gold,
    "flash-frame": flash_frame,
    "ascend-board": ascend_board,
    "ascend-disc": ascend_disc,
    "ascend-disc-done": ascend_disc_done,
    "chain-board": chain_board,
    **{f"chain-{s}-{c}": (lambda s=s, c=c: chain_charm(s, c)) for s in ("circle", "square", "triangle") for c in CHAIN_GEMS},
    "bonk-lawn": bonk_lawn,
    "bonk-burrow": bonk_burrow,
    "bonk-gopher-gold": bonk_gopher_gold,
    "bonk-gopher-red": bonk_gopher_red,
    "bonk-hedgehog": bonk_hedgehog,
    "tenfall-board": tenfall_board,
    **{f"tenfall-tile-{k}": (lambda k=k: tenfall_tile(k)) for k in TENFALL_TILES},
    "pull-sky": pull_sky,
    "pull-clay-orange": pull_clay_orange,
    "pull-clay-gold": pull_clay_gold,
    "pull-bird-0": pull_bird_0,
    "pull-bird-1": pull_bird_1,
    "pull-bird-2": pull_bird_2,
}


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    opts = dict(a[2:].split("=", 1) if "=" in a else (a[2:], "1") for a in sys.argv[1:] if a.startswith("--"))
    out = args[0]
    names = args[1:] or list(SPRITES)
    os.makedirs(out, exist_ok=True)
    for name in names:
        SPRITES[name]()
        samples = int(opts.get("samples", 24 if "preview" in opts else 128))
        lib.render(os.path.join(out, name + ".png"), samples=samples)
        print("RENDERED", name, flush=True)


if __name__ == "__main__":
    main()
