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
    elif shape == "heart":
        # matchupRev 13 Expert's seventh gem: the classic parametric heart, the same 20 points the code-cut gem uses
        # (matchup.renderer's gemPoints), so the render fills exactly the outline the code art draws.
        for k in range(20):
            t = k / 20 * math.pi * 2
            hx = 16 * math.sin(t) ** 3
            hy = -(13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t))
            pts.append((hx * 0.95 / 16 * r, (hy - 2.5) * 0.95 / 16 * r))
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


def softbox(location, target, size, strength, colour=(1, 1, 1), size_y=None):
    """An emissive panel the camera never sees: only its reflection in a facet or on glass."""
    bpy.ops.mesh.primitive_plane_add(size=1, location=location)
    ob = bpy.context.object
    ob.scale = (size, size_y or size, 1)
    lib.look_at(ob, target)
    ob.rotation_euler.rotate_axis("X", math.pi)  # the plane's normal faces the target
    m = bpy.data.materials.new("softbox")
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs[0].default_value = (*colour, 1)
    em.inputs[1].default_value = strength
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(em.outputs[0], out.inputs[0])
    ob.data.materials.append(m)
    ob.visible_camera = False
    ob.visible_shadow = False
    return ob


def gem_material(colour, shade=1.0):
    # A cut stone that reads at 40 px (Joe, 15 Nov: "cut, faceted, lit gems from the concept"): a deep saturated body
    # (diffuse colour from a key light) under a mirror-hard surface, so every flat facet shows either a bright softbox
    # or the dark studio: the alternating light and dark facets are what make a cut read as a cut.
    m = bpy.data.materials.new("gem")
    m.use_nodes = True
    p = m.node_tree.nodes["Principled BSDF"]
    r, g, b = hex_rgb(colour)
    p.inputs["Base Color"].default_value = (r * 0.5 * shade, g * 0.5 * shade, b * 0.5 * shade, 1)
    p.inputs["Roughness"].default_value = 0.03
    p.inputs["IOR"].default_value = 2.4
    # Reflections tinted by the stone (a gem's facets flash its own colour, light, not plain white).
    p.inputs["Specular Tint"].default_value = (min(1, r * 0.5 + 0.55), min(1, g * 0.5 + 0.55), min(1, b * 0.5 + 0.55), 1)
    p.inputs["Coat Weight"].default_value = 0.15
    p.inputs["Coat Roughness"].default_value = 0.0
    p.inputs["Subsurface Weight"].default_value = 0.25
    p.inputs["Subsurface Radius"].default_value = (0.4, 0.4, 0.4)
    return m


# Expert's seventh colour (matchupRev 13, 16 Nov 2026): the cyan heart, MATCHUP_COLOUR7.
GEM7 = ("#2FE3E6", "heart")


def gems(only=None):
    for colour, shape in only or zip(GEM_COLOURS, GEM_SHAPES):
        s = lib.reset(256, 256, samples=128, transparent=True)
        s.view_settings.view_transform = "Standard"
        s.view_settings.look = "Medium High Contrast"
        lib.world((0.0, 0.0, 0.0), 0.0)
        ob = gem_mesh(shape)
        # Three bodies on the facets, as a jeweller's drawing shades a cut: the table and every other crown facet light,
        # the rest dark, the star facets between (gem_mesh's face order: five faces a girdle edge, then the table).
        for shade in (1.55, 0.55, 1.0):
            ob.data.materials.append(gem_material(colour, shade))
        for f in ob.data.polygons:
            if f.index == len(ob.data.polygons) - 1:
                f.material_index = 0
            else:
                edge, kind = divmod(f.index, 5)
                if kind == 3:
                    f.material_index = 2
                elif kind in (1, 2):
                    f.material_index = 0 if (edge + kind) % 2 == 0 else 1
                elif kind == 0:
                    f.material_index = 1 if edge % 2 == 0 else 0
                else:
                    f.material_index = 1
        # The colour: a soft key from the upper left and a weak fill (the diffuse body).
        lib.area_light((-1.5, 1.5, 3.0), (0, 0, 0), 150, 2.0, (1.0, 0.97, 0.92))
        lib.area_light((1.5, -1.5, 2.5), (0, 0, 0), 50, 2.0, (0.8, 0.9, 1.0))
        # The sparkle: a ring of twelve narrow softboxes, alternately bright and dark, round and above the stone, and one
        # softbox overhead for the table. Each crown facet mirrors a different one.
        # Three tiers of narrow softboxes, alternately lit and dark round the stone: a crown facet (about 40 degrees)
        # mirrors the horizon tier, a star facet the middle one, the table the overhead box; each tier is turned half a
        # step from the next, so neighbouring facets differ.
        for tier, (elev, rr, gain) in enumerate(((84, 3.0, 1.0), (62, 3.0, 0.8), (40, 3.0, 0.6))):
            for k in range(16):
                if k % 2:
                    continue
                a = (k + tier * 0.5) / 16 * math.pi * 2 + 0.2
                e = math.radians(elev)
                softbox((math.cos(a) * rr * math.sin(e), math.sin(a) * rr * math.sin(e), rr * math.cos(e)), (0, 0, 0), 0.5, 4.0 * gain, size_y=0.6)
        softbox((-0.4, 0.4, 4.0), (0, 0, 0), 1.1, 2.2)
        round_lights()
        top_camera(2.02)
        png = os.path.join(lib.TMP, f"gem-{shape}.png")
        lib.render(png)
        save(png, f"gem-{shape}", quality=90, size=128)


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
        p.inputs["Transmission Weight"].default_value = 0.15
        p.inputs["IOR"].default_value = 1.5
        p.inputs["Subsurface Weight"].default_value = 0.6
        p.inputs["Subsurface Radius"].default_value = (0.5, 0.5, 0.5)
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
    if kind == "bubble":
        lib.area_light((-1.6, 1.8, 3.0), (0, 0, 0), 220, 4.0, (1.0, 0.97, 0.92))
        lib.area_light((0, 0, 4.0), (0, 0, 0), 30, 8.0, (1, 1, 1))
        mat = ob.data.materials[0].node_tree.nodes["Principled BSDF"]
        mat.inputs["Coat Roughness"].default_value = 0.12
    else:
        lib.area_light((-1.6, 1.8, 3.0), (0, 0, 0), 260, 0.6, (1.0, 0.97, 0.92))
        lib.area_light((2.2, -1.4, 1.2), (0, 0, 0), 120, 0.8, (0.6, 0.8, 1.0))
        lib.area_light((0, 0, 4.0), (0, 0, 0), 40, 3.0, (1, 1, 1))
    if kind == "bubble":
        # Candy glass that reads at 30 px (Joe, 15 Nov): a big bright window reflected high on the upper left (the
        # crescent of light the concept shows) and a soft rim of light low on the far side.
        softbox((-1.3, 1.3, 1.9), (0, 0, 0), 3.4, 5.0, (1, 1, 1), size_y=1.4)
        softbox((1.8, -1.8, 0.4), (0, 0, 0), 4.0, 1.2, (0.85, 0.95, 1.0), size_y=0.8)
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
# Expert's sixth colour (BUB_SIXTH, 16 Nov 2026): the warm orange the seahorse lives in, BUB_SIXTH_COLOUR.
BUBBLE6 = {"bubble-orange": "#FF9A3C"}


def marbles():
    for name, colour in {**TILT_MARBLES, **BT_MARBLES}.items():
        sphere_render(name, colour, "marble")
    sphere_render("marble-gloss", "#000000", "marble", gloss_only=True)


def bubbles(only=None):
    for name, colour in (only or BUBBLES).items():
        sphere_render(name, colour, "bubble")
    if only is None:
        sphere_render("bubble-gloss", "#000000", "bubble", gloss_only=True)


# ------------------------------------------------------------------ Tilt's lacquered disc


def walnut_material():
    # Walnut: long, gently bent grain lines (calmed 15 Nov 2026) (the figure), dark heartwood streaks, a warm reddish lacquered tone.
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
    mixv.inputs["Factor"].default_value = 0.2
    mapping = nt.nodes.new("ShaderNodeMapping")
    mapping.inputs["Scale"].default_value = (0.3, 3.2, 1.0)
    wave = nt.nodes.new("ShaderNodeTexWave")
    wave.wave_type = "BANDS"
    wave.bands_direction = "Y"
    wave.inputs["Scale"].default_value = 1.3
    wave.inputs["Distortion"].default_value = 2.2
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
    # Calm (Joe, 15 Nov: "stripy and busy"): the grain a narrow step of tone round the walnut, so the gold walls lead.
    el[0].position, el[0].color = 0.1, (*hex_rgb("#3A180A"), 1)
    el[1].position, el[1].color = 0.95, (*hex_rgb("#7A3E1A"), 1)
    el.new(0.55).color = (*hex_rgb("#5A2A12"), 1)
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


def value_noise(shape, cells, rng):
    """Smooth value noise on a grid of `cells` (cubic-smoothed bilinear), 0..1."""
    h, w = shape
    gy, gx = cells
    grid = rng.random((gy + 2, gx + 2))
    ys = np.linspace(0, gy, h, endpoint=False)
    xs = np.linspace(0, gx, w, endpoint=False)
    y0, x0 = ys.astype(int), xs.astype(int)
    ty, tx = ys - y0, xs - x0
    ty, tx = ty * ty * (3 - 2 * ty), tx * tx * (3 - 2 * tx)
    a = grid[y0][:, x0]
    b = grid[y0][:, x0 + 1]
    c = grid[y0 + 1][:, x0]
    d = grid[y0 + 1][:, x0 + 1]
    top = a + (b - a) * tx[None, :]
    bot = c + (d - c) * tx[None, :]
    return top + (bot - top) * ty[:, None]


def disc():
    # The face (Joe, 15 Nov: "calm the grain; keep the walnut, make the walls the focus"): painted, not rendered, so the
    # grain is a quiet step of tone. Long fine lines bent by a slow figure, a broad soft figure over them, the lacquered
    # walnut's warm browns, a touch darker at the rim. Seeded: the same bytes every run.
    size = 800
    rng = np.random.default_rng(7)
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32) / size
    bend = value_noise((size, size), (3, 2), rng) * 0.9 + value_noise((size, size), (8, 5), rng) * 0.25
    lines = np.sin((yy + bend * 0.22) * math.pi * 2 * 34)
    fine = value_noise((size, size), (160, 12), rng)
    figure = value_noise((size, size), (5, 3), rng)
    t = 0.5 + 0.07 * lines + 0.08 * (fine - 0.5) + 0.32 * (figure - 0.5)
    t = np.clip(t, 0, 1)
    dark = np.array([0x3E, 0x1C, 0x0D], np.float32) / 255
    light = np.array([0x86, 0x47, 0x22], np.float32) / 255
    rgb = dark[None, None, :] + (light - dark)[None, None, :] * t[..., None]
    r = np.hypot(xx - 0.5, yy - 0.5) * 2
    rgb *= (1 - 0.18 * np.clip((r - 0.55) / 0.45, 0, 1) ** 1.5)[..., None]
    alpha = np.clip((1 - r) * size / 2, 0, 1)
    out = np.dstack([np.clip(rgb, 0, 1), alpha])
    png = os.path.join(lib.TMP, "tilt-disc.png")
    Image.fromarray((out * 255).astype(np.uint8), "RGBA").save(png)
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
        # 160 px tall: drawn about 70 world px tall (Joe, 15 Nov), sharp at a phone's 2x.
        scale = 160 / h
        img = img.resize((max(1, round(w * scale)), 160), Image.LANCZOS)
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


# ------------------------------------------------------------------ Ball Tracker's wood (concept A)


def tile_noise(size, cells, rng):
    """Value noise that tiles: the grid wraps, so the texture repeats with no seam."""
    gy, gx = cells
    grid = rng.random((gy, gx))
    ys = np.arange(size) / size * gy
    xs = np.arange(size) / size * gx
    y0, x0 = ys.astype(int), xs.astype(int)
    ty, tx = ys - y0, xs - x0
    ty, tx = ty * ty * (3 - 2 * ty), tx * tx * (3 - 2 * tx)
    y1, x1 = (y0 + 1) % gy, (x0 + 1) % gx
    a, b = grid[y0][:, x0], grid[y0][:, x1]
    c, d = grid[y1][:, x0], grid[y1][:, x1]
    top = a + (b - a) * tx[None, :]
    bot = c + (d - c) * tx[None, :]
    return top + (bot - top) * ty[:, None]


def wood_tile(name, dark, light, lines, contrast, seed):
    """A 256 px tileable plank texture: fine grain lines along x bent by a slow figure (each a whole number of waves
    across the tile, so it repeats), a soft broad figure, warm tones."""
    size = 256
    rng = np.random.default_rng(seed)
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32) / size
    bend = tile_noise(size, (2, 3), rng) * 0.8 + tile_noise(size, (4, 6), rng) * 0.2
    grain = np.sin((yy + bend * 0.07) * math.pi * 2 * lines)
    fine = tile_noise(size, (128, 4), rng)
    figure = tile_noise(size, (3, 2), rng)
    t = np.clip(0.5 + contrast * (0.55 * grain + 0.5 * (fine - 0.5)) + 0.25 * (figure - 0.5), 0, 1)
    d = np.array(dark, np.float32) / 255
    l = np.array(light, np.float32) / 255
    rgb = d[None, None, :] + (l - d)[None, None, :] * t[..., None]
    png = os.path.join(lib.TMP, f"{name}.png")
    Image.fromarray((np.clip(rgb, 0, 1) * 255).astype(np.uint8), "RGB").save(png)
    img = Image.open(png).convert("RGB")
    path = os.path.join(OUT, f"{name}.webp")
    img.save(path, "WEBP", quality=82, method=6)
    print(f"{name}: {os.path.getsize(path) / 1024:.1f} KB")


def bt_wood():
    # The board: warm light oak (concept A's face); the channels: deep oiled walnut (concept A's grooves).
    wood_tile("bt-board", (0xB0, 0x7E, 0x4C), (0xD8, 0xAA, 0x72), 16, 0.22, 11)
    wood_tile("bt-walnut", (0x3A, 0x1E, 0x0C), (0x6E, 0x3E, 0x1E), 12, 0.35, 12)


JOBS = {"gem7": lambda: gems([GEM7]), "bubble6": lambda: bubbles(BUBBLE6), "gems": gems, "marbles": marbles, "bubbles": bubbles, "disc": disc, "captain": captain_art, "coin": reveal_coin, "chest": reveal_chest, "btwood": bt_wood}
for job in sys.argv[1:] or list(JOBS):
    JOBS[job]()
