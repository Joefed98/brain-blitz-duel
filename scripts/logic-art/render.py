"""Logic overhaul session 1 (phase 2 step 4): the piece and surface art for Box Six, Polypotions, Hanoi, Safe Cracker,
Mosaic, Colour Flood and Minefield, rendered in Blender (Cycles) and exported as WebP sprites the app lays out and
animates (`public/logic-art/`). The materials come from the concept renders' helpers (`jzlib.py`, copied from
docs/design/game-concepts/source/ in PR #429); the looks follow docs/design/game-concepts/logic.md (Box Six A with B's
light, Polypotions A + B with C's cork, Hanoi A with B's rings, Safe Cracker A, Minefield A, and new ceramic Mosaic and
enamel Flood art).

Pieces whose colour the game picks (Hanoi's rings, the flood pots) are rendered as neutral *shading maps*: a grey
object whose body sits at mid-grey, so CSS lays it over the colour with `background-blend-mode: hard-light` and every
colour gets the same glass or glaze.

Run (Blender as a Python module, `pip install bpy pillow` in a Python 3.13 venv, working copies outside the repo):

    JZ_SAMPLES=64 python scripts/logic-art/render.py [name ...]

No name renders every sprite. Output: public/logic-art/<name>.webp (lossless alpha, quality 90).
"""
import bpy, math, os, sys, tempfile
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import jzlib as J  # noqa: E402

# Sprites are centred on the origin, so points map straight to Blender units (no 390 x 844 screen offset).
J.V = lambda x, y, z=0.0: Vector((x * J.P, -y * J.P, z * J.P))

OUT = os.path.abspath(os.path.join(HERE, "..", "..", "public", "logic-art"))
SAMPLES = int(os.environ.get("JZ_SAMPLES", "64"))
TMP = os.environ.get("JZ_TMP", tempfile.gettempdir())
P = J.P


def scene(px_w, px_h, span_w, view="top", tilt=0.0, glass_alpha=False):
    """A fresh scene with an orthographic camera `span_w` points wide, rendering px_w x px_h with a transparent film.
    view "top": looking down at the z=0 plane (x right, y down in points, centred on 0, 0).
    view "front": looking along +y at the x/z plane (x right, z up)."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    s = bpy.context.scene
    s.render.engine = "CYCLES"; s.cycles.device = "CPU"; s.cycles.samples = SAMPLES
    s.cycles.use_denoising = True; s.cycles.max_bounces = 12; s.cycles.transmission_bounces = 12
    s.cycles.transparent_max_bounces = 12
    s.render.resolution_x = px_w; s.render.resolution_y = px_h; s.render.resolution_percentage = 100
    s.render.film_transparent = True
    s.cycles.film_transparent_glass = glass_alpha
    s.view_settings.view_transform = "AgX"; s.view_settings.look = "AgX - Punchy"
    cam = bpy.data.cameras.new("cam"); cam.type = "ORTHO"; cam.ortho_scale = span_w * P * max(1, px_h / px_w) if px_h > px_w else span_w * P
    cam.sensor_fit = "AUTO"; cam.clip_end = 100
    ob = bpy.data.objects.new("cam", cam); s.collection.objects.link(ob)
    if view == "top":
        t = math.radians(tilt)
        ob.location = (0, -10 * math.sin(t), 10 * math.cos(t)); ob.rotation_euler = (t, 0, 0)
    else:
        ob.location = (0, -10, 0); ob.rotation_euler = (math.radians(90), 0, 0)
    s.camera = ob
    J._mats.clear(); J._meshes.clear()
    w = bpy.data.worlds.new("w"); s.world = w; w.use_nodes = True
    nt = w.node_tree
    if J.STUDIO:
        env = nt.nodes.new("ShaderNodeTexEnvironment"); env.image = bpy.data.images.load(os.path.join(J.STUDIO, "studio.exr"))
        nt.links.new(env.outputs[0], nt.nodes["Background"].inputs[0])
    nt.nodes["Background"].inputs[1].default_value = 0.12
    return s


def light(loc, energy, size=4.0, color="#ffffff", target=(0, 0, 0)):
    d = bpy.data.lights.new("a", "AREA"); d.energy = energy; d.size = size; d.color = J.hexc(color)[:3]
    ob = bpy.data.objects.new("a", d); bpy.context.scene.collection.objects.link(ob); ob.location = loc
    ob.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    return ob


def key_lights(view="top", k=1.0):
    """Clean, even studio light (Joe, 15 Nov 2026: minimal glow, no glare): one large soft overhead and two broad
    fills, so no hard reflection runs across a panel, tile or numeral."""
    if view == "top":
        light((0, 0, 8), 1100 * k, 16, "#fff6ea"); light((-6, 4, 5), 260 * k, 14); light((6, -4, 5), 260 * k, 14)
    else:
        light((0, -6, 6), 1000 * k, 16, "#fff6ea"); light((-6, -5, 0), 260 * k, 14); light((6, -5, 0), 260 * k, 14)


def black_world():
    """Camera rays see black (the sprite is a highlight layer laid on with `mix-blend-mode: screen`)."""
    s = bpy.context.scene; s.render.film_transparent = False
    nt = s.world.node_tree; n = nt.nodes
    lp = n.new("ShaderNodeLightPath"); bg2 = n.new("ShaderNodeBackground"); bg2.inputs[0].default_value = (0, 0, 0, 1)
    mix = n.new("ShaderNodeMixShader")
    nt.links.new(lp.outputs["Is Camera Ray"], mix.inputs[0]); nt.links.new(n["Background"].outputs[0], mix.inputs[1])
    nt.links.new(bg2.outputs[0], mix.inputs[2]); nt.links.new(mix.outputs[0], n["World Output"].inputs[0])


def write(name, shading=False, mid=None):
    s = bpy.context.scene
    png = os.path.join(TMP, f"logic-art-{name}.png"); s.render.filepath = png
    s.render.image_settings.file_format = "PNG"; s.render.image_settings.color_mode = "RGBA"
    bpy.ops.render.render(write_still=True)
    from PIL import Image, ImageOps
    im = Image.open(png).convert("RGBA")
    if shading:
        # A shading map: grey, with the body's median brought to mid-grey (128) for hard-light blending.
        r, g, b, a = im.split()
        lum = ImageOps.grayscale(Image.merge("RGB", (r, g, b)))
        px = [v for v, al in zip(lum.getdata(), a.getdata()) if al > 200]
        px.sort(); med = px[len(px) // 2] if px else 128
        target = mid or 128
        lum = lum.point(lambda v: max(0, min(255, round(v * target / max(1, med)))) if v <= med else
                        max(0, min(255, round(target + (v - med) * (255 - target) / max(1, 255 - med)))))
        im = Image.merge("RGBA", (lum, lum, lum, a))
    os.makedirs(OUT, exist_ok=True)
    im.save(os.path.join(OUT, f"{name}.webp"), "WEBP", quality=90, method=6)
    print("wrote", name, im.size)


# ------------------------------------------------------------------------------------------------- the sprites
def box_tile(given=False):
    """Box Six: a lacquered black tile (A) under B's single pool of light. Numerals stay app text."""
    scene(192, 192, 100)
    key_lights(k=0.45)
    m = J.mat("lacq", "#050608" if not given else "#0c0b09", 0.42, coat=0.25, coat_rough=0.35)
    J.add_bump(m, 80, 0.008)
    J.cbox(0, 0, 92, 92, 10, m, r=7.0, z=-10)
    write("box-tile-given" if given else "box-tile")


def flask_glass():
    """Polypotions: a thin-walled test tube, front glass only (the liquid is app-drawn behind it)."""
    scene(160, 512, 50, view="front")
    black_world()
    key_lights("front", 1.2)
    g = J.mat("glass", "#ffffff", 0.12, trans=1.0, ior=1.45)
    # One lathed wall: a round bottom rising into a straight tube (no seam inside the glass).
    import bmesh
    prof = [(0.0, -0.765)] + [(0.21 * math.sin(math.radians(a)), -0.555 - 0.21 * math.cos(math.radians(a))) for a in range(6, 91, 6)] + [(0.21, 0.795)]
    me = bpy.data.meshes.new("flask"); bm = bmesh.new()
    rings = []
    for i in range(64):
        t = i * 2 * math.pi / 64
        rings.append([bm.verts.new((r * math.cos(t), r * math.sin(t), z)) for r, z in prof])
    for i in range(64):
        a, b = rings[i], rings[(i + 1) % 64]
        for k in range(len(prof) - 1):
            if k == 0:
                bm.faces.new((a[0], a[1], b[1])) if a[0] is not b[0] else None
            else:
                bm.faces.new((a[k], a[k + 1], b[k + 1], b[k]))
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bm.to_mesh(me); bm.free()
    tube = bpy.data.objects.new("flask", me); bpy.context.scene.collection.objects.link(tube)
    for p in me.polygons: p.use_smooth = True
    tube.data.materials.append(g)
    sol = tube.modifiers.new("s", "SOLIDIFY"); sol.thickness = 0.012
    # the rolled lip
    bpy.ops.mesh.primitive_torus_add(major_radius=0.215, minor_radius=0.018, location=(0, 0, 0.795))
    lip = bpy.context.object; lip.data.materials.append(g); bpy.ops.object.shade_smooth()
    write("flask-glass")


def cork():
    scene(128, 96, 40, view="front")
    key_lights("front")
    m = J.mat("cork", "#b98a55", 0.75)
    J.add_bump(m, 260, 0.35, kind="voronoi")
    bpy.ops.mesh.primitive_cone_add(vertices=48, radius1=0.15, radius2=0.18, depth=0.2, location=(0, 0, 0))
    ob = bpy.context.object; ob.data.materials.append(m); bpy.ops.object.shade_smooth()
    write("cork")


def ring_shading():
    """Hanoi: a candy-glass ring seen from the front (a long capsule), as a shading map for any colour."""
    scene(512, 72, 360, view="front")
    key_lights("front", 1.1)
    m = J.mat("candy", "#c8c8c8", 0.35, coat=0.2, coat_rough=0.4, sss=0.25)
    bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=0.22, depth=3.1, rotation=(0, math.radians(90), 0))
    body = bpy.context.object; body.data.materials.append(m); bpy.ops.object.shade_smooth()
    for x in (-1.55, 1.55):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=24, radius=0.22, location=(x, 0, 0))
        e = bpy.context.object; e.data.materials.append(m); bpy.ops.object.shade_smooth()
    write("hanoi-ring", shading=True)


def oak_post():
    scene(48, 512, 40, view="front")
    key_lights("front")
    w = J.wood("oak", "#a8743f", "#5a3618", rough=0.55, coat=0.15, stretch=(1, 1, 8))
    bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=0.12, depth=3.6, location=(0, 0, -0.1))
    ob = bpy.context.object; ob.data.materials.append(w); bpy.ops.object.shade_smooth()
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=24, radius=0.135, location=(0, 0, 1.7))
    t = bpy.context.object; t.data.materials.append(w); bpy.ops.object.shade_smooth()
    write("hanoi-post")


def plate(gold=False):
    scene(512, 64, 420, view="front")
    key_lights("front")
    m = J.brushed("gold", "#d7b46a", 0.48) if gold else J.wood("oakb", "#9a6a3a", "#4f2f15", rough=0.55, coat=0.15, rot=math.radians(90))
    J.cbox(0, 0, 410, 30, 46, m, r=6.0, z=-23)
    obj = [o for o in bpy.context.scene.objects if o.type == "MESH"][0]
    obj.rotation_euler = (math.radians(90), 0, 0); obj.location = (0, 0, 0)
    write("hanoi-plate-gold" if gold else "hanoi-plate")


def safe_door():
    """Safe Cracker: brushed steel with rivets (A); the clue card and drums sit on it."""
    scene(512, 512, 300)
    key_lights(k=0.9)
    st = J.brushed("steel", "#8d949e", 0.5, aniso=0.0, stretch=(1, 90, 1))
    J.cbox(0, 0, 296, 296, 12, st, r=10, z=-12)
    rv = J.mat("rivet", "#b9c0c9", 0.5, metal=1.0)
    for x in (-130, 130):
        for y in (-130, 130):
            J.sphere(x, y, 5, rv, z=0)
    write("safe-door")


def safe_drum():
    """A brass drum (numerals stay app text, inked dark on the brass so reflections never hide them)."""
    scene(120, 168, 60, view="front")
    key_lights("front", 1.3)
    br = J.brushed("brass", "#d1ad62", 0.6, aniso=0.0, stretch=(90, 1, 1))
    bpy.ops.mesh.primitive_cylinder_add(vertices=96, radius=0.38, depth=0.52, rotation=(0, math.radians(90), 0))
    ob = bpy.context.object; ob.data.materials.append(br); bpy.ops.object.shade_smooth()
    ob.scale = (1, 1, 1)
    write("safe-drum")


def mosaic_tile():
    """Mosaic: a glazed ceramic tile (cream glaze, a hand-made ripple), pressed in when filled."""
    scene(160, 160, 100)
    key_lights()
    m = J.mat("glaze", "#efe3c8", 0.4, coat=0.2, coat_rough=0.4, sss=0.1)
    J.add_bump(m, 6, 0.06)
    J.cbox(0, 0, 90, 90, 9, m, r=8.0, z=-9)
    write("mosaic-tile")


def mosaic_well():
    scene(160, 160, 100)
    key_lights(k=0.8)
    grout = J.mat("grout", "#1c2126", 0.9)
    J.add_bump(grout, 140, 0.25)
    J.cbox(0, 0, 100, 100, 4, grout, r=0.5, z=-14)
    slate = J.mat("slate", "#1a2229", 0.7)
    J.add_bump(slate, 30, 0.12)
    J.cbox(0, 0, 88, 88, 6, slate, r=4.0, z=-14)
    write("mosaic-well")


def flood_pot():
    """Colour Flood: a glass paint pot seen from above, as a shading map for each colour."""
    scene(160, 160, 100, tilt=0)
    key_lights(k=1.1)
    m = J.mat("pot", "#c2c2c2", 0.38, coat=0.2, coat_rough=0.4)
    J.cyl(0, 0, 44, 20, m, z=-20, bevel=6)
    rim = J.mat("potrim", "#e0e0e0", 0.4, coat=0.1)
    J.disc_ring(0, 0, 46, 6, 3, rim, z=0)
    write("flood-pot", shading=True)


def mine_raised():
    """Minefield A: an unopened square, raised silver stone."""
    scene(128, 128, 100)
    key_lights()
    m = J.mat("silverstone", "#9aa1a8", 0.62, metal=0.2)
    J.add_bump(m, 22, 0.18)
    J.cbox(0, 0, 92, 92, 14, m, r=9.0, z=-14)
    write("mine-raised")


def mine_open():
    scene(128, 128, 100)
    key_lights(k=0.7)
    m = J.mat("slate2", "#1b2128", 0.78)
    J.add_bump(m, 18, 0.14)
    J.cbox(0, 0, 100, 100, 6, m, r=1.0, z=-20)
    write("mine-open")


def mine_mine():
    scene(128, 128, 100)
    key_lights(k=1.0)
    iron = J.mat("iron", "#2a2c30", 0.55, metal=1.0)
    J.sphere(0, 0, 26, iron, z=0)
    for i in range(8):
        a = i * math.pi / 4
        bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.05, depth=0.2,
                                            location=(math.cos(a) * 0.32, math.sin(a) * 0.32, 0),
                                            rotation=(0, math.radians(90), a))
        s = bpy.context.object; s.data.materials.append(iron); bpy.ops.object.shade_smooth()
    write("mine-mine")


def mine_flag():
    scene(128, 128, 100, view="front")
    key_lights("front")
    pin = J.mat("pin", "#c9ccd1", 0.2, metal=1.0)
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.025, depth=0.8, location=(-0.08, 0, -0.02))
    p = bpy.context.object; p.data.materials.append(pin); bpy.ops.object.shade_smooth()
    cloth = J.mat("cloth", "#c8322b", 0.8, sheen=0.6)
    J.add_bump(cloth, 90, 0.2)
    bpy.ops.mesh.primitive_plane_add(size=0.34, location=(0.1, 0, 0.24), rotation=(math.radians(90), 0, 0))
    f = bpy.context.object; f.scale = (1, 0.72, 1); f.data.materials.append(cloth)
    wave = f.modifiers.new("w", "SIMPLE_DEFORM"); wave.deform_method = "BEND"; wave.angle = math.radians(25)
    sol = f.modifiers.new("s", "SOLIDIFY"); sol.thickness = 0.01
    base = J.mat("pinbase", "#3a3e44", 0.4, metal=0.8)
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=0.12, depth=0.05, location=(-0.08, 0, -0.42))
    b = bpy.context.object; b.data.materials.append(base); bpy.ops.object.shade_smooth()
    write("mine-flag")


SPRITES = {
    "box-tile": lambda: box_tile(False), "box-tile-given": lambda: box_tile(True),
    "flask-glass": flask_glass, "cork": cork,
    "hanoi-ring": ring_shading, "hanoi-post": oak_post, "hanoi-plate": lambda: plate(False),
    "hanoi-plate-gold": lambda: plate(True),
    "safe-door": safe_door, "safe-drum": safe_drum,
    "mosaic-tile": mosaic_tile, "mosaic-well": mosaic_well,
    "flood-pot": flood_pot,
    "mine-raised": mine_raised, "mine-open": mine_open, "mine-mine": mine_mine, "mine-flag": mine_flag,
}

if __name__ == "__main__":
    names = [a for a in sys.argv[1:] if not a.startswith("-")] or list(SPRITES)
    for n in names:
        SPRITES[n]()
