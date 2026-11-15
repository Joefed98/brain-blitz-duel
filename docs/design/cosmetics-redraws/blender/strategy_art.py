"""The Strategy overhaul's rendered materials (stage 2, 15 Nov 2026; Joe: "spend the image budget on rendered
materials"): Cycles renders of the pieces players look at most, written as WebP to public/strategy/ and drawn by the
games' renderers over their code-drawn art (src/lib/arcade/strategyArt.ts loads them; until one arrives the code art
is drawn, so nothing waits on an image and checks in Bun draw today's art).

    python strategy_art.py [gems marbles bubbles disc captain]   (bpy 5.3: pip install bpy pillow numpy scipy)

Every piece sits exactly inside the collision shape it stands for (the sprite's circle or the cut's outline fills the
image edge to edge at the same radius the code art uses), so the arcade bounds rule holds.
"""
import math
import os
import sys

import bpy
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, "captain"))
import lib  # noqa: E402

OUT = os.path.join(lib.REPO, "public/strategy")
os.makedirs(OUT, exist_ok=True)


def hex_rgb(h):
    h = h.lstrip("#")
    c = [int(h[i : i + 2], 16) / 255 for i in (0, 2, 4)]
    # sRGB → linear for Blender colours.
    return tuple(((v + 0.055) / 1.055) ** 2.4 if v > 0.04045 else v / 12.92 for v in c)


def save(png, name, quality=86, size=None):
    img = Image.open(png).convert("RGBA")
    if size:
        img = img.resize((size, size), Image.LANCZOS)
    path = os.path.join(OUT, f"{name}.webp")
    img.save(path, "WEBP", quality=quality, method=6)
    print(f"{name}: {os.path.getsize(path) / 1024:.1f} KB")


def studio(top=(1.0, 0.96, 0.9), rim=(0.6, 0.8, 1.0), key=900, rim_e=300):
    lib.area_light((-1.6, 1.8, 3.0), (0, 0, 0), key, 1.6, top)  # key, upper left (screen)
    lib.area_light((2.2, -1.4, 1.6), (0, 0, 0), rim_e, 1.0, rim)  # cool rim, lower right
    lib.area_light((0, 0, 4.0), (0, 0, 0), 160, 3.0, (1, 1, 1))  # soft top fill


def top_camera(scale):
    lib.camera((0, 0, 6), (0, 0, 0), ortho_scale=scale)


# ------------------------------------------------------------------ gems (Gemstone)

GEM_COLOURS = ["#F5B82E", "#FF4D4D", "#4D8CFF", "#3DDC84", "#B26BFF", "#FF6BD6"]
GEM_SHAPES = ["circle", "square", "triangle", "diamond", "star", "hexagon"]


def cut_points(shape, r=1.0):
    pts = []

    def ring(n, rot, rr):
        for k in range(n):
            a = rot + (k / n) * math.pi * 2
            pts.append((math.cos(a) * rr(k), math.sin(a) * rr(k)))

    if shape == "circle":
        ring(16, -math.pi / 2, lambda k: r)
    elif shape == "square":
        s, c = r * 0.88, r * 0.88 * 0.32
        pts += [(-s + c, -s), (s - c, -s), (s, -s + c), (s, s - c), (s - c, s), (-s + c, s), (-s, s - c), (-s, -s + c)]
    elif shape == "triangle":
        pts += [(0, -r), (r, r * 0.8), (-r, r * 0.8)]
    elif shape == "diamond":
        pts += [(0, -r), (r, 0), (0, r), (-r, 0)]
    elif shape == "star":
        ring(10, -math.pi / 2, lambda k: r if k % 2 == 0 else r * 0.45)
    else:
        ring(6, -math.pi / 2, lambda k: r)
    # Screen y grows down; Blender's y grows up.
    return [(x, -y) for x, y in pts]


def gem_mesh(shape):
    outer = cut_points(shape, 1.0)
    n = len(outer)
    cx = sum(p[0] for p in outer) / n
    cy = sum(p[1] for p in outer) / n
    table = [(cx + (x - cx) * 0.5, cy + (y - cy) * 0.5) for x, y in outer]
    # Star facets: a point a little inside each girdle edge's middle, raised part-way to the table.
    mids = []
    for k in range(n):
        (ax, ay), (bx, by) = outer[k], outer[(k + 1) % n]
        mx, my = (ax + bx) / 2, (ay + by) / 2
        mids.append((cx + (mx - cx) * 0.8, cy + (my - cy) * 0.8, 0.2))
    verts = [(x, y, 0.0) for x, y in outer] + [(x, y, 0.42) for x, y in table] + mids + [(cx, cy, -0.6)]
    culet = 3 * n
    faces = []
    for k in range(n):
        a, b = k, (k + 1) % n
        m = 2 * n + k
        faces.append((a, b, m))  # girdle to star point
        faces.append((a, m, n + a))  # left upper facet
        faces.append((m, b, n + b))  # right upper facet
        faces.append((m, n + b, n + a))  # star facet
        faces.append((b, a, culet))  # pavilion facet
    faces.append(tuple(range(n, 2 * n)))  # table
    me = bpy.data.meshes.new(f"gem-{shape}")
    me.from_pydata(verts, [], faces)
    me.update()
    ob = bpy.data.objects.new(f"gem-{shape}", me)
    bpy.context.collection.objects.link(ob)
    return ob


def gem_material(colour):
    # A cut stone at sprite size: a saturated body with a little subsurface glow, a hard clear coat, and flat facets
    # (each catching or missing the small lights, so the cut sparkles); no see-through glass, which reads muddy small.
    m = bpy.data.materials.new("gem")
    m.use_nodes = True
    p = m.node_tree.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = (*hex_rgb(colour), 1)
    p.inputs["Roughness"].default_value = 0.02
    p.inputs["IOR"].default_value = 2.0
    p.inputs["Transmission Weight"].default_value = 0.65
    p.inputs["Subsurface Weight"].default_value = 0.15
    p.inputs["Subsurface Radius"].default_value = (0.3, 0.3, 0.3)
    p.inputs["Coat Weight"].default_value = 1.0
    p.inputs["Coat Roughness"].default_value = 0.0
    return m


def gems():
    for colour, shape in zip(GEM_COLOURS, GEM_SHAPES):
        s = lib.reset(256, 256, samples=96, transparent=True)
        s.cycles.film_transparent_glass = False
        lib.world((0.012, 0.01, 0.018), 1.0)
        ob = gem_mesh(shape)
        ob.data.materials.append(gem_material(colour))
        # Small, sharp lights all round (a jeweller's lamp): each facet catches one and sparkles; no flat fill.
        s.view_settings.view_transform = "Standard"
        s.view_settings.look = "None"
        for i, (x, y) in enumerate([(-1.6, 1.8), (1.9, 1.2), (-1.2, -1.9), (1.5, -1.6), (0.0, 2.4)]):
            lib.area_light((x, y, 2.4), (0, 0, 0), 420 if i == 0 else 18, 0.3, (1.0, 0.97, 0.92))
        # Glints: small hard lights low on the upper left and right, where the crown facets mirror them to the camera.
        lib.area_light((-3.0, 3.0, 0.9), (0, 0, 0), 2200, 0.12, (1.0, 1.0, 1.0))
        lib.area_light((3.2, 2.2, 1.1), (0, 0, 0), 700, 0.12, (0.9, 0.95, 1.0))
        round_lights()
        top_camera(2.02)
        png = os.path.join(lib.TMP, f"gem-{shape}.png")
        lib.render(png)
        save(png, f"gem-{shape}", quality=88, size=128)


# ------------------------------------------------------------------ spheres (marbles, bubbles)


def sphere(colour, kind):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=64, ring_count=32, radius=1.0)
    ob = bpy.context.object
    bpy.ops.object.shade_smooth()
    m = bpy.data.materials.new(kind)
    m.use_nodes = True
    p = m.node_tree.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = (*hex_rgb(colour), 1)
    p.inputs["Roughness"].default_value = 0.04
    p.inputs["Coat Weight"].default_value = 1.0
    p.inputs["Coat Roughness"].default_value = 0.02
    if kind == "marble":
        p.inputs["Transmission Weight"].default_value = 0.55
        p.inputs["IOR"].default_value = 1.5
        p.inputs["Subsurface Weight"].default_value = 0.35
    else:  # bubble: candy glass
        p.inputs["Transmission Weight"].default_value = 0.35
        p.inputs["IOR"].default_value = 1.45
        p.inputs["Subsurface Weight"].default_value = 0.5
    ob.data.materials.append(m)
    return ob


def sphere_render(name, colour, kind, gloss_only=False):
    s = lib.reset(192, 192, samples=96, transparent=True)
    s.cycles.film_transparent_glass = False
    s.view_settings.view_transform = "Standard"
    s.view_settings.look = "None"
    lib.world((0.03, 0.03, 0.04) if kind == "marble" else (0.05, 0.12, 0.2), 1.0)
    ob = sphere(colour, kind)
    if gloss_only:
        mat = ob.data.materials[0]
        p = mat.node_tree.nodes["Principled BSDF"]
        p.inputs["Base Color"].default_value = (0, 0, 0, 1)
        p.inputs["Transmission Weight"].default_value = 0.0
        p.inputs["Subsurface Weight"].default_value = 0.0
        lib.world((0, 0, 0), 0.0)
    # One soft key upper left (the crisp curve of light on the glass), a cool rim lower right, a dim top fill.
    lib.area_light((-1.6, 1.8, 3.0), (0, 0, 0), 260, 0.6, (1.0, 0.97, 0.92))
    lib.area_light((2.2, -1.4, 1.2), (0, 0, 0), 120, 0.8, (0.6, 0.8, 1.0))
    lib.area_light((0, 0, 4.0), (0, 0, 0), 40, 3.0, (1, 1, 1))
    round_lights()
    top_camera(2.0)
    png = os.path.join(lib.TMP, f"{name}.png")
    lib.render(png)
    if gloss_only:
        # Highlights only: white, with alpha from the brightness (the crisp curve of the light on the glass).
        a = np.asarray(Image.open(png).convert("RGBA")).astype(np.float32) / 255
        lum = a[..., :3].max(axis=2) * a[..., 3]
        lum = np.clip((lum - 0.06) / 0.94, 0, 1) ** 1.1
        out = np.zeros_like(a)
        out[..., :3] = 1.0
        out[..., 3] = lum
        Image.fromarray((out * 255).astype(np.uint8)).save(png)
    save(png, name, quality=86, size=96)


TILT_MARBLES = {"tilt-marble-blue": "#3E7BFA", "tilt-marble-amber": "#F29A1F"}
BT_MARBLES = {"bt-marble-red": "#FF4D4D", "bt-marble-blue": "#4D8CFF", "bt-marble-green": "#3DDC84", "bt-marble-yellow": "#FFE600"}
BUBBLES = {"bubble-red": "#FF4D4D", "bubble-yellow": "#FFE600", "bubble-green": "#3DDC84", "bubble-blue": "#4D8CFF", "bubble-purple": "#B26BFF"}


def marbles():
    for name, colour in {**TILT_MARBLES, **BT_MARBLES}.items():
        sphere_render(name, colour, "marble")
    sphere_render("marble-gloss", "#000000", "marble", gloss_only=True)


def bubbles():
    for name, colour in BUBBLES.items():
        sphere_render(name, colour, "bubble")
    sphere_render("bubble-gloss", "#000000", "bubble", gloss_only=True)


# ------------------------------------------------------------------ Tilt's lacquered disc


def walnut_material():
    # Walnut: long grain lines bent by a slow noise (the figure), dark heartwood streaks, a warm reddish lacquered tone.
    m = bpy.data.materials.new("walnut")
    m.use_nodes = True
    nt = m.node_tree
    p = nt.nodes["Principled BSDF"]
    coord = nt.nodes.new("ShaderNodeTexCoord")
    bend = nt.nodes.new("ShaderNodeTexNoise")
    bend.inputs["Scale"].default_value = 0.9
    bend.inputs["Detail"].default_value = 2.0
    mixv = nt.nodes.new("ShaderNodeMix")
    mixv.data_type = "VECTOR"
    mixv.inputs["Factor"].default_value = 0.35
    mapping = nt.nodes.new("ShaderNodeMapping")
    mapping.inputs["Scale"].default_value = (0.3, 3.2, 1.0)
    wave = nt.nodes.new("ShaderNodeTexWave")
    wave.wave_type = "BANDS"
    wave.bands_direction = "Y"
    wave.inputs["Scale"].default_value = 2.6
    wave.inputs["Distortion"].default_value = 4.0
    wave.inputs["Detail"].default_value = 3.0
    fine = nt.nodes.new("ShaderNodeTexNoise")
    fine.inputs["Scale"].default_value = 120.0
    streak = nt.nodes.new("ShaderNodeTexNoise")
    streak.inputs["Scale"].default_value = 3.0
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = "FLOAT"
    mix.inputs["Factor"].default_value = 0.32
    mix2 = nt.nodes.new("ShaderNodeMix")
    mix2.data_type = "FLOAT"
    mix2.inputs["Factor"].default_value = 0.3
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    el = ramp.color_ramp.elements
    el[0].position, el[0].color = 0.2, (*hex_rgb("#4A1C0A"), 1)
    el[1].position, el[1].color = 0.85, (*hex_rgb("#A65A2C"), 1)
    el.new(0.5).color = (*hex_rgb("#6E3016"), 1)
    nt.links.new(coord.outputs["Object"], mixv.inputs["A"])
    nt.links.new(bend.outputs["Color"], mixv.inputs["B"])
    nt.links.new(mixv.outputs["Result"], mapping.inputs["Vector"])
    nt.links.new(mapping.outputs["Vector"], wave.inputs["Vector"])
    nt.links.new(wave.outputs["Fac"], mix.inputs["A"])
    nt.links.new(fine.outputs["Fac"], mix.inputs["B"])
    nt.links.new(mix.outputs["Result"], mix2.inputs["A"])
    nt.links.new(streak.outputs["Fac"], mix2.inputs["B"])
    nt.links.new(mix2.outputs["Result"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], p.inputs["Base Color"])
    p.inputs["Roughness"].default_value = 0.5
    return m


def round_lights():
    for light in bpy.data.lights:
        if light.type == "AREA":
            light.shape = "DISK"


def disc():
    # The face: an even, soft light (the screen-fixed gloss is its own layer, so the texture can turn with the maze).
    s = lib.reset(1024, 1024, samples=64, transparent=True)
    s.view_settings.view_transform = "Standard"
    s.view_settings.look = "None"
    lib.world((0.02, 0.018, 0.016), 1.0)
    bpy.ops.mesh.primitive_cylinder_add(vertices=128, radius=1.0, depth=0.05, location=(0, 0, 0))
    ob = bpy.context.object
    ob.data.materials.append(walnut_material())
    lib.area_light((0, 0, 4), (0, 0, 0), 330, 8.0, (1, 0.95, 0.88))
    top_camera(2.0)
    png = os.path.join(lib.TMP, "tilt-disc.png")
    lib.render(png)
    save(png, "tilt-disc", quality=84, size=800)
    # The lacquer's reflection of a lamp above and to the upper left, screen-fixed: highlights only, as alpha.
    s = lib.reset(1024, 1024, samples=64, transparent=True)
    lib.world((0, 0, 0), 0.0)
    bpy.ops.mesh.primitive_cylinder_add(vertices=128, radius=1.0, depth=0.05, location=(0, 0, 0))
    ob = bpy.context.object
    m = lib.material("lacquer", base=(0, 0, 0), roughness=0.06, coat=1.0)
    ob.data.materials.append(m)
    lib.area_light((-0.52, 0.5, 4.0), (-0.52, 0.5, 0), 400, 0.22, (1, 0.94, 0.84))
    round_lights()
    top_camera(2.0)
    png = os.path.join(lib.TMP, "tilt-disc-gloss.png")
    lib.render(png)
    a = np.asarray(Image.open(png).convert("RGBA")).astype(np.float32) / 255
    lum = np.clip((a[..., :3].max(axis=2) * a[..., 3] - 0.02) / 0.98, 0, 1) * 0.34
    out = np.zeros_like(a)
    out[..., :3] = (1.0, 0.96, 0.9)
    out[..., 3] = lum
    Image.fromarray((out * 255).astype(np.uint8)).save(png)
    save(png, "tilt-disc-gloss", quality=80, size=800)


# ------------------------------------------------------------------ Captain Joulz by the pot (Rainbow Bridge)


def captain_art():
    import captain  # noqa: E402

    for pose in ("ready", "win"):
        s = lib.reset(240, 320, samples=96, transparent=True)
        lib.world((0.4, 0.55, 0.8), 0.6)
        captain.build(pose=pose, location=(0, 0, 0), height=1.7, rotation_z=0.0)
        lib.area_light((-2.4, -2.6, 3.2), (0, 0, 1.0), 420, 2.2, (1.0, 0.95, 0.88))
        lib.area_light((2.6, 1.6, 2.2), (0, 0, 1.2), 300, 1.2, (0.55, 0.85, 1.0))
        lib.area_light((1.8, -3.0, 1.0), (0, 0, 0.9), 80, 3, (1.0, 0.85, 0.65))
        lib.camera((1.15, -3.1, 1.12), (0, 0, 0.98 if pose != "win" else 1.04), lens=50)
        png = os.path.join(lib.TMP, f"captain-{pose}.png")
        lib.render(png)
        img = Image.open(png).convert("RGBA")
        img = img.crop(img.getbbox())
        w, h = img.size
        scale = 120 / h
        img = img.resize((max(1, round(w * scale)), 120), Image.LANCZOS)
        path = os.path.join(OUT, f"inkbridge-captain-{pose}.webp")
        img.save(path, "WEBP", quality=88, method=6)
        print(f"inkbridge-captain-{pose}: {img.size}, {os.path.getsize(path) / 1024:.1f} KB")


# ------------------------------------------------------------------ reveal pieces (the redesigned answer reveals)


def reveal_coin():
    """Rainbow Bridge's level coin (the reveal's ten level dots): a gold coin face on, a raised rim and a bolt."""
    s = lib.reset(256, 256, samples=96, transparent=True)
    s.view_settings.view_transform = "Standard"
    s.view_settings.look = "None"
    lib.world((0.05, 0.05, 0.06), 1.0)
    gold = lib.material("gold", base=hex_rgb("#C98A1E"), metallic=1.0, roughness=0.32)
    deep = lib.material("deep", base=hex_rgb("#8A5A12"), metallic=1.0, roughness=0.45)
    bpy.ops.mesh.primitive_cylinder_add(vertices=96, radius=1.0, depth=0.14, location=(0, 0, 0))
    bpy.context.object.data.materials.append(gold)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.86, minor_radius=0.07, location=(0, 0, 0.07))
    bpy.ops.object.shade_smooth()
    bpy.context.object.data.materials.append(gold)
    # A small embossed bolt (the app's mark, simplified).
    verts = [(-0.12, 0.5), (0.3, 0.5), (0.06, 0.08), (0.28, 0.08), (-0.18, -0.55), (-0.02, -0.06), (-0.26, -0.06)]
    mesh = bpy.data.meshes.new("bolt")
    mesh.from_pydata([(x, y, 0.07) for x, y in verts], [], [list(range(len(verts)))])
    ob = bpy.data.objects.new("bolt", mesh)
    bpy.context.scene.collection.objects.link(ob)
    bpy.context.view_layer.objects.active = ob
    ob.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.extrude_region_move(TRANSFORM_OT_translate={"value": (0, 0, 0.1)})
    bpy.ops.object.mode_set(mode="OBJECT")
    ob.scale = (1.3, 1.3, 1)
    ob.data.materials.append(deep)
    lib.area_light((-1.6, 1.8, 3.0), (0, 0, 0), 150, 0.9, (1.0, 0.95, 0.85))
    lib.area_light((2.2, -1.4, 1.6), (0, 0, 0), 60, 1.0, (1.0, 0.9, 0.7))
    lib.area_light((0, 0, 4.0), (0, 0, 0), 12, 3.0, (1, 1, 1))
    round_lights()
    top_camera(2.08)
    png = os.path.join(lib.TMP, "inkbridge-coin.png")
    lib.render(png)
    save(png, "inkbridge-coin", quality=86, size=96)


def reveal_chest():
    """Gemstone's treasure chest (the reveal's treasure row): dark wood, bronze bands, a gold lock, three-quarter view."""
    s = lib.reset(320, 320, samples=96, transparent=True)
    s.view_settings.view_transform = "Standard"
    s.view_settings.look = "None"
    lib.world((0.05, 0.05, 0.06), 1.0)
    wood = walnut_material()
    bronze = lib.material("bronze", base=hex_rgb("#C2843E"), metallic=1.0, roughness=0.28)
    gold = lib.material("gold", base=hex_rgb("#F2C75C"), metallic=1.0, roughness=0.2)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0.35))
    body = bpy.context.object
    body.scale = (1.4, 0.9, 0.7)
    body.data.materials.append(wood)
    bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=0.45, depth=1.36, location=(0, 0, 0.7), rotation=(0, math.pi / 2, 0))
    lid = bpy.context.object
    lid.scale = (1, 1, 1)
    lid.data.materials.append(wood)
    for x in (-0.5, 0.5):
        bpy.ops.mesh.primitive_cube_add(size=1, location=(x, 0, 0.35))
        band = bpy.context.object
        band.scale = (0.1, 0.94, 0.72)
        band.data.materials.append(bronze)
        bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=0.48, depth=0.1, location=(x, 0, 0.7), rotation=(0, math.pi / 2, 0))
        bpy.ops.object.shade_smooth()
        bpy.context.object.data.materials.append(bronze)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, -0.46, 0.62))
    lock = bpy.context.object
    lock.scale = (0.2, 0.06, 0.24)
    lock.data.materials.append(gold)
    lib.area_light((-2.4, -2.6, 3.2), (0, 0, 0.5), 260, 2.0, (1.0, 0.95, 0.88))
    lib.area_light((2.6, 1.6, 2.2), (0, 0, 0.5), 260, 1.2, (0.6, 0.8, 1.0))
    lib.area_light((0, -3, 0.6), (0, 0, 0.4), 50, 3, (1.0, 0.85, 0.65))
    lib.area_light((3.0, -1.6, 0.9), (0.7, 0, 0.6), 120, 1.5, (1.0, 0.9, 0.8))
    lib.camera((2.2, -3.4, 2.0), (0, 0, 0.5), lens=50)
    png = os.path.join(lib.TMP, "matchup-chest.png")
    lib.render(png)
    img = Image.open(png).convert("RGBA")
    img = img.crop(img.getbbox())
    w, h = img.size
    side = max(w, h)
    sq = Image.new("RGBA", (side, side))
    sq.paste(img, ((side - w) // 2, (side - h) // 2))
    sq = sq.resize((112, 112), Image.LANCZOS)
    path = os.path.join(OUT, "matchup-chest.webp")
    sq.save(path, "WEBP", quality=86, method=6)
    print(f"matchup-chest: {os.path.getsize(path) / 1024:.1f} KB")


JOBS = {"gems": gems, "marbles": marbles, "bubbles": bubbles, "disc": disc, "captain": captain_art, "coin": reveal_coin, "chest": reveal_chest}
for job in sys.argv[1:] or list(JOBS):
    JOBS[job]()
