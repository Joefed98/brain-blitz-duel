"""
Orbit's planet surfaces, rendered in Blender (the Action overhaul's stage-2 look pass, 15 Nov 2026; display only, never
read by the sim). Replaces scripts/orbit-planet-maps.py's numpy maps.

Each planet type is a procedural Blender material (noise, voronoi and wave textures: banded and storm-swirled gas, rimmed
craters and canyons, lava fissures, oceans with continents and cloud, cracked ice with frozen seas) on a 256 x 128 UV
sphere, baked by Cycles (CPU, EMIT bake: no lights, no randomness beyond Blender's fixed per-pixel pattern) into an
equirectangular map: the UV sphere's own unwrap, longitude across, latitude down, seamless left to right. The renderer
(src/lib/arcade/orbitPlanets.renderer.ts) projects the map onto a sphere, turns it slowly and lights it from one sun with
a soft terminator, a deep night side, a thin atmosphere rim inside the disc and (on rocks and ice) the bump of a second
baked map, the surface's height.

Two kinds of map:
  * colour maps carry the world's own colours (desert, lava, terran ocean, two icy worlds),
  * tone maps carry grey detail that the renderer tints with the planet's seeded colour (two gas giants, a marbled world,
    a cratered moon).
Rocks and ice also ship `<name>-h.webp`, a grey height map at half size.

Usage (Blender as a Python module, outside the project):
    python -m venv <dir>/bpyvenv && <dir>/bpyvenv/bin/pip install bpy pillow
    <dir>/bpyvenv/bin/python scripts/orbit-planets-blender.py [--check]

Writes public/orbit/planets/<name>.webp and src/lib/arcade/orbitPlanetMaps.data.ts (each URL with a content hash, the
map's kind, and the total bytes). Deterministic: fixed node inputs, one bake sample, a fixed WebP encoder setting; the
same bytes every run on the same Blender and libwebp. --check rebuilds and compares without writing.
"""
import hashlib
import io
import os
import sys
import tempfile
from pathlib import Path

import bpy
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public/orbit/planets"
DATA = ROOT / "src/lib/arcade/orbitPlanetMaps.data.ts"

# Map size: the largest planet on screen is about 160 device px across (radius 28 world px at the desktop column's 1.42
# scale and a 2x screen, or a 3x phone), so the front half of a 640-wide map gives 2 map px a screen px.
MW, MH = 640, 320
HW, HH = 320, 160
QUALITY = 80
HEIGHT_QUALITY = 76


def srgb_to_linear(c):
    c = c / 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hexc(h, a=1.0):
    h = h.lstrip("#")
    return (srgb_to_linear(int(h[0:2], 16)), srgb_to_linear(int(h[2:4], 16)), srgb_to_linear(int(h[4:6], 16)), a)


def grey(v):
    """A tone map's grey: written as sRGB, so a linear v = (v)^2.2-ish; pass display values 0..1."""
    x = srgb_to_linear(round(v * 255))
    return (x, x, x, 1.0)


class Graph:
    """A tiny helper over a material's node tree."""

    def __init__(self, mat):
        self.t = mat.node_tree
        self.n = self.t.nodes
        self.l = self.t.links
        for node in list(self.n):
            self.n.remove(node)
        self.coord = self.node("ShaderNodeTexCoord").outputs["Object"]

    def node(self, kind, **props):
        nd = self.n.new(kind)
        for k, v in props.items():
            setattr(nd, k, v)
        return nd

    def link(self, out, inp):
        self.l.new(out, inp)

    def val(self, sock, v):
        sock.default_value = v

    # Inputs can be sockets or numbers.
    def put(self, inp, x):
        if isinstance(x, (int, float, tuple)):
            inp.default_value = x
        else:
            self.link(x, inp)

    def math(self, op, a, b=0.0, c=None):
        m = self.node("ShaderNodeMath", operation=op)
        self.put(m.inputs[0], a)
        self.put(m.inputs[1], b)
        if c is not None:
            self.put(m.inputs[2], c)
        return m.outputs[0]

    def vmath(self, op, a, b=(0.0, 0.0, 0.0), scale=None):
        m = self.node("ShaderNodeVectorMath", operation=op)
        self.put(m.inputs[0], a)
        self.put(m.inputs[1], b)
        if scale is not None:
            self.put(m.inputs[3], scale)
        out = m.outputs["Value"] if op in ("DOT_PRODUCT", "LENGTH", "DISTANCE") else m.outputs["Vector"]
        return out

    def noise(self, vec, scale, detail=6.0, rough=0.55, distortion=0.0, w=None, dims="3D", lacunarity=2.0):
        nd = self.node("ShaderNodeTexNoise", noise_dimensions="4D" if w is not None else dims)
        self.put(nd.inputs["Vector"], vec)
        nd.inputs["Scale"].default_value = scale
        nd.inputs["Detail"].default_value = detail
        nd.inputs["Roughness"].default_value = rough
        nd.inputs["Lacunarity"].default_value = lacunarity
        nd.inputs["Distortion"].default_value = distortion
        if w is not None:
            nd.inputs["W"].default_value = w
        return nd

    def voronoi(self, vec, scale, feature="F1", metric="EUCLIDEAN", w=None, randomness=1.0):
        nd = self.node("ShaderNodeTexVoronoi", feature=feature, distance=metric, voronoi_dimensions="4D" if w is not None else "3D")
        self.put(nd.inputs["Vector"], vec)
        nd.inputs["Scale"].default_value = scale
        nd.inputs["Randomness"].default_value = randomness
        if w is not None:
            nd.inputs["W"].default_value = w
        return nd

    def ramp(self, fac, stops, interp="LINEAR"):
        nd = self.node("ShaderNodeValToRGB")
        cr = nd.color_ramp
        cr.interpolation = interp
        while len(cr.elements) > 1:
            cr.elements.remove(cr.elements[-1])
        cr.elements[0].position = stops[0][0]
        cr.elements[0].color = stops[0][1]
        for pos, col in stops[1:]:
            e = cr.elements.new(pos)
            e.color = col
        self.put(nd.inputs["Fac"], fac)
        return nd.outputs["Color"]

    def mixc(self, fac, a, b, blend="MIX"):
        nd = self.node("ShaderNodeMix", data_type="RGBA", blend_type=blend, clamp_result=True)
        self.put(nd.inputs[0], fac)
        self.put(nd.inputs[6], a)
        self.put(nd.inputs[7], b)
        return nd.outputs[2]

    def maprange(self, x, a, b, c=0.0, d=1.0, interp="LINEAR"):
        nd = self.node("ShaderNodeMapRange", interpolation_type=interp, clamp=True)
        self.put(nd.inputs["Value"], x)
        nd.inputs["From Min"].default_value = a
        nd.inputs["From Max"].default_value = b
        nd.inputs["To Min"].default_value = c
        nd.inputs["To Max"].default_value = d
        return nd.outputs["Result"]

    def sep(self, vec):
        nd = self.node("ShaderNodeSeparateXYZ")
        self.put(nd.inputs[0], vec)
        return nd.outputs

    def comb(self, x, y, z):
        nd = self.node("ShaderNodeCombineXYZ")
        self.put(nd.inputs[0], x)
        self.put(nd.inputs[1], y)
        self.put(nd.inputs[2], z)
        return nd.outputs[0]

    def emit(self, colour):
        e = self.node("ShaderNodeEmission")
        self.put(e.inputs["Color"], colour)
        e.inputs["Strength"].default_value = 1.0
        out = self.node("ShaderNodeOutputMaterial")
        self.link(e.outputs[0], out.inputs["Surface"])


# ---------------------------------------------------------------------------------------------------------------------
# Shared pieces


def warped(g, p, amount, scale, w):
    """p displaced by a noise field (domain warp), for swirls and ragged coasts."""
    n = g.noise(p, scale, detail=4, rough=0.5, w=w)
    off = g.vmath("SUBTRACT", n.outputs["Color"], (0.5, 0.5, 0.5))
    return g.vmath("ADD", p, g.vmath("SCALE", off, scale=amount))


def craters(g, p, scale, w, depth=1.0):
    """Rimmed craters from a voronoi field: a bowl inside, a raised rim, flat beyond. Returns a height (−depth..+0.5)."""
    v = g.voronoi(p, scale, w=w, randomness=0.85)
    d = v.outputs["Distance"]
    # Each cell's own crater radius from its random colour (0.12–0.38 of a cell), and only some cells hold one.
    rnd = g.sep(v.outputs["Color"])
    rad = g.math("MULTIPLY_ADD", rnd[0], 0.26, 0.12)
    keep = g.math("GREATER_THAN", rnd[1], 0.35)
    x = g.math("DIVIDE", d, rad)
    bowl = g.math("MULTIPLY", g.math("SUBTRACT", g.math("POWER", g.math("MINIMUM", x, 1.0), 2.0), 1.0), 1.0)  # −1 at centre → 0 at the rim
    rim = g.math("MULTIPLY", g.maprange(x, 0.8, 1.0, 0.0, 1.0, "SMOOTHSTEP"), g.maprange(x, 1.0, 1.55, 1.0, 0.0, "SMOOTHSTEP"))
    h = g.math("ADD", g.math("MULTIPLY", bowl, g.math("LESS_THAN", x, 1.0)), g.math("MULTIPLY", rim, 0.55))
    return g.math("MULTIPLY", g.math("MULTIPLY", h, keep), depth)


def lat_of(g, p):
    """The surface point's latitude as z (−1 south … 1 north)."""
    return g.sep(p)[2]


def polar_caps(g, p, start, width, w):
    z = g.math("ABSOLUTE", lat_of(g, p))
    edge = g.noise(p, 6, detail=5, rough=0.6, w=w).outputs["Fac"]
    zz = g.math("ADD", z, g.math("MULTIPLY", g.math("SUBTRACT", edge, 0.5), 0.12))
    return g.maprange(zz, start, start + width, 0.0, 1.0, "SMOOTHSTEP")


# ---------------------------------------------------------------------------------------------------------------------
# The worlds. Each builder returns (colour socket, height socket or None).


def gas(g, p, seed, bands, turb, storm_lat):
    """A banded gas giant (tone map): latitude bands torn into eddies, a big storm oval, fine streaks."""
    q = warped(g, p, turb, 2.2, seed + 0.11)
    q = warped(g, q, turb * 0.35, 5.0, seed + 0.37)
    z = lat_of(g, q)
    # Bands: a wave along z with its own wobble, then a finer second set.
    wave = g.node("ShaderNodeTexWave", wave_type="BANDS", bands_direction="Z", wave_profile="SIN")
    g.put(wave.inputs["Vector"], q)
    wave.inputs["Scale"].default_value = bands
    wave.inputs["Distortion"].default_value = 2.0
    wave.inputs["Detail"].default_value = 2.0
    wave.inputs["Detail Scale"].default_value = 1.4
    wave.inputs["Phase Offset"].default_value = seed
    fine = g.node("ShaderNodeTexWave", wave_type="BANDS", bands_direction="Z", wave_profile="SIN")
    g.put(fine.inputs["Vector"], q)
    fine.inputs["Scale"].default_value = bands * 2.2
    fine.inputs["Distortion"].default_value = 3.0
    fine.inputs["Detail"].default_value = 2.0
    fine.inputs["Phase Offset"].default_value = seed * 2.1
    # Broad belts and zones of their own brightness (the main read at play size), the waves riding on them.
    broad = g.noise(g.comb(0.0, 0.0, z), 3.4, detail=3, rough=0.55, w=seed + 0.5).outputs["Fac"]
    belts = g.maprange(broad, 0.35, 0.65, 0.0, 1.0, "SMOOTHSTEP")
    v = g.math("MULTIPLY_ADD", wave.outputs["Fac"], 0.2, 0.0)
    v = g.math("MULTIPLY_ADD", fine.outputs["Fac"], 0.07, v)
    v = g.math("MULTIPLY_ADD", belts, 0.9, v)
    # The storm: an oval of swirled, darker cloud with a pale eye.
    sx, sy, sz = 0.72, -0.62, storm_lat
    rel = g.vmath("SUBTRACT", p, (sx, sy, sz))
    rels = g.vmath("MULTIPLY", rel, (1.5, 1.5, 3.4))
    sd = g.vmath("LENGTH", rels)
    swirl = g.noise(warped(g, p, 0.6, 6.0, seed + 0.9), 8, detail=2, w=seed).outputs["Fac"]
    core = g.maprange(sd, 0.35, 1.0, 1.0, 0.0, "SMOOTHSTEP")
    eye = g.maprange(sd, 0.0, 0.42, 1.0, 0.0, "SMOOTHSTEP")
    v = g.math("SUBTRACT", v, g.math("MULTIPLY", core, g.math("MULTIPLY_ADD", swirl, 0.35, 0.25)))
    v = g.math("ADD", v, g.math("MULTIPLY", eye, 0.55))
    t = g.maprange(v, 0.05, 1.2, 0.0, 1.0)
    col = g.ramp(t, [(0.0, grey(0.08)), (0.3, grey(0.36)), (0.55, grey(0.6)), (0.8, grey(0.82)), (1.0, grey(0.98))])
    return col, None


def marble(g, p, seed):
    """A marbled world (tone map): swirled veins of light and dark, the concept's green planet."""
    q = warped(g, p, 1.2, 1.8, seed)
    q = warped(g, q, 0.5, 5.0, seed + 0.3)
    vein = g.node("ShaderNodeTexWave", wave_type="RINGS", rings_direction="SPHERICAL", wave_profile="SIN")
    g.put(vein.inputs["Vector"], q)
    vein.inputs["Scale"].default_value = 2.2
    vein.inputs["Distortion"].default_value = 3.5
    vein.inputs["Detail"].default_value = 1.5
    vein.inputs["Detail Scale"].default_value = 1.3
    vein.inputs["Phase Offset"].default_value = seed
    n = g.noise(q, 4, detail=2, rough=0.45, w=seed + 0.7).outputs["Fac"]
    v = g.math("MULTIPLY_ADD", vein.outputs["Fac"], 0.75, g.math("MULTIPLY", n, 0.35))
    # Sharp light veins along the swirl's ridges.
    ridge = g.maprange(vein.outputs["Fac"], 0.86, 0.98, 0.0, 1.0, "SMOOTHSTEP")
    v = g.math("MULTIPLY_ADD", ridge, 0.3, v)
    t = g.maprange(v, 0.15, 1.15)
    col = g.ramp(t, [(0.0, grey(0.1)), (0.35, grey(0.32)), (0.6, grey(0.58)), (0.85, grey(0.8)), (1.0, grey(0.97))])
    h = g.math("MULTIPLY", g.math("SUBTRACT", t, 0.5), 0.35)
    return col, h


def moon(g, p, seed):
    """A cratered moon (tone map): dark maria, bright highlands, craters at three sizes with rays on the biggest."""
    hi = g.noise(p, 3.5, detail=8, rough=0.58, w=seed).outputs["Fac"]
    maria = g.maprange(g.noise(warped(g, p, 0.4, 2.0, seed + 0.2), 1.6, detail=3, w=seed + 0.4).outputs["Fac"], 0.5, 0.62, 0.0, 1.0, "SMOOTHSTEP")
    h = g.math("MULTIPLY_ADD", hi, 0.5, g.math("MULTIPLY", maria, -0.25))
    h = g.math("ADD", h, craters(g, p, 4.0, seed + 0.11, 0.5))
    h = g.math("ADD", h, craters(g, p, 11.0, seed + 0.21, 0.28))
    h = g.math("ADD", h, craters(g, p, 28.0, seed + 0.31, 0.14))
    tone = g.math("MULTIPLY_ADD", hi, 0.6, g.math("MULTIPLY", maria, -0.42))
    tone = g.math("ADD", tone, g.math("MULTIPLY", h, 0.7))
    t = g.maprange(tone, -0.25, 0.75)
    col = g.ramp(t, [(0.0, grey(0.14)), (0.35, grey(0.36)), (0.7, grey(0.66)), (1.0, grey(0.9))])
    return col, h


def desert(g, p, seed):
    """A rust desert (colour map): ochre dunes and plateaus, dark canyon networks, craters, faint frost caps."""
    hi = g.noise(warped(g, p, 0.35, 3.0, seed), 3.0, detail=7, rough=0.55, w=seed).outputs["Fac"]
    canyon_v = g.voronoi(warped(g, p, 0.6, 3.0, seed + 0.4), 2.2, feature="DISTANCE_TO_EDGE", w=seed + 0.6)
    canyon_mask = g.maprange(g.noise(p, 1.4, detail=2, w=seed + 0.45).outputs["Fac"], 0.45, 0.6, 0.0, 1.0, "SMOOTHSTEP")
    canyon = g.math("MULTIPLY", g.maprange(canyon_v.outputs["Distance"], 0.0, 0.022, 1.0, 0.0, "SMOOTHSTEP"), canyon_mask)
    plains = g.maprange(g.noise(p, 1.8, detail=3, w=seed + 0.8).outputs["Fac"], 0.42, 0.6, 0.0, 1.0, "SMOOTHSTEP")
    h = g.math("SUBTRACT", hi, g.math("MULTIPLY", canyon, 0.45))
    h = g.math("ADD", h, craters(g, p, 6.0, seed + 0.13, 0.35))
    h = g.math("ADD", h, craters(g, p, 16.0, seed + 0.23, 0.15))
    t = g.maprange(g.math("MULTIPLY_ADD", plains, 0.25, h), 0.1, 1.05)
    col = g.ramp(t, [(0.0, hexc("#3a160d")), (0.25, hexc("#7a2f19")), (0.5, hexc("#b5532a")), (0.72, hexc("#d98a4c")), (1.0, hexc("#f0c08a"))])
    col = g.mixc(g.math("MULTIPLY", canyon, 0.7), col, hexc("#2a0f0a"))
    col = g.mixc(polar_caps(g, p, 0.95, 0.03, seed + 0.9), col, hexc("#f4e8dc"))
    return col, h


def lava(g, p, seed):
    """A volcanic world (colour map): black basalt plates, dull orange fissures (no glow), ash plains, calderas."""
    plates = g.voronoi(warped(g, p, 0.4, 3.0, seed), 2.6, feature="DISTANCE_TO_EDGE", w=seed + 0.2)
    crack = g.maprange(plates.outputs["Distance"], 0.0, 0.035, 1.0, 0.0, "SMOOTHSTEP")
    fine = g.voronoi(warped(g, p, 0.2, 6.0, seed + 0.5), 7.0, feature="DISTANCE_TO_EDGE", w=seed + 0.6)
    crack2 = g.maprange(fine.outputs["Distance"], 0.0, 0.025, 0.6, 0.0, "SMOOTHSTEP")
    rough = g.noise(p, 4.0, detail=6, rough=0.55, w=seed + 0.7).outputs["Fac"]
    ash = g.maprange(g.noise(p, 1.5, detail=3, w=seed + 0.9).outputs["Fac"], 0.48, 0.66, 0.0, 1.0, "SMOOTHSTEP")
    h = g.math("SUBTRACT", rough, g.math("MULTIPLY", g.math("MAXIMUM", crack, crack2), 0.5))
    h = g.math("ADD", h, craters(g, p, 5.0, seed + 0.15, 0.4))
    rock = g.ramp(g.maprange(rough, 0.25, 0.8), [(0.0, hexc("#120d0c")), (0.5, hexc("#2c2220")), (1.0, hexc("#4d3d36"))])
    rock = g.mixc(g.math("MULTIPLY", ash, 0.65), rock, hexc("#6d625b"))
    glowc = g.ramp(g.math("MAXIMUM", crack, crack2), [(0.0, hexc("#5a1a08")), (0.6, hexc("#c4410f")), (1.0, hexc("#ff8a2a"))])
    col = g.mixc(g.math("MAXIMUM", crack, g.math("MULTIPLY", crack2, 0.8)), rock, glowc)
    return col, h


def terran(g, p, seed):
    """An ocean world (colour map): deep and shallow seas, green and tan continents, mountains, cloud bands, ice caps."""
    land_n = g.noise(warped(g, p, 0.45, 2.5, seed), 2.2, detail=10, rough=0.62, w=seed).outputs["Fac"]
    landish = g.math("SUBTRACT", land_n, 0.0)
    land = g.maprange(landish, 0.52, 0.535, 0.0, 1.0, "SMOOTHSTEP")
    shallow = g.maprange(landish, 0.43, 0.52, 0.0, 1.0)
    sea = g.ramp(shallow, [(0.0, hexc("#0a1f52")), (0.65, hexc("#13408a")), (1.0, hexc("#2a7bb8"))])
    elev = g.maprange(landish, 0.53, 0.72)
    dry = g.maprange(g.math("ABSOLUTE", lat_of(g, p)), 0.05, 0.4, 1.0, 0.0)  # deserts near the equator
    ground = g.ramp(elev, [(0.0, hexc("#2f6b2a")), (0.4, hexc("#4c7d34")), (0.75, hexc("#8a7a4e")), (1.0, hexc("#d8d2c4"))])
    ground = g.mixc(g.math("MULTIPLY", dry, g.maprange(g.noise(p, 5, detail=4, w=seed + 0.4).outputs["Fac"], 0.45, 0.6)), ground, hexc("#c2a066"))
    col = g.mixc(land, sea, ground)
    col = g.mixc(polar_caps(g, p, 0.93, 0.04, seed + 0.5), col, hexc("#f2f6fa"))
    # Clouds: swirled bands, thin over the poles, baked into the surface.
    cq = warped(g, p, 0.7, 3.5, seed + 0.6)
    cl = g.noise(g.vmath("MULTIPLY", cq, (1.0, 1.0, 2.2)), 4.5, detail=7, rough=0.6, w=seed + 0.7).outputs["Fac"]
    cloud = g.maprange(cl, 0.53, 0.72, 0.0, 0.9, "SMOOTHSTEP")
    col = g.mixc(cloud, col, hexc("#f7f9fc"))
    h = g.math("MULTIPLY", g.math("MULTIPLY", land, elev), 0.6)
    return col, h


def ice(g, p, seed, tint_a, tint_b, seas):
    """An icy world (colour map): pale blue-white plains, long blue cracks, frozen grey-blue seas, bright caps."""
    base = g.noise(p, 3.5, detail=5, rough=0.5, w=seed).outputs["Fac"]
    cracks = g.voronoi(warped(g, p, 0.7, 2.5, seed + 0.2), 2.2, feature="DISTANCE_TO_EDGE", w=seed + 0.3)
    crack = g.maprange(cracks.outputs["Distance"], 0.0, 0.022, 1.0, 0.0, "SMOOTHSTEP")
    cracks2 = g.voronoi(warped(g, p, 0.5, 5.0, seed + 0.4), 5.0, feature="DISTANCE_TO_EDGE", w=seed + 0.5)
    crack_mask = g.maprange(g.noise(p, 1.6, detail=2, w=seed + 0.45).outputs["Fac"], 0.42, 0.58, 0.0, 1.0, "SMOOTHSTEP")
    crack2 = g.math("MULTIPLY", g.maprange(cracks2.outputs["Distance"], 0.0, 0.014, 0.7, 0.0, "SMOOTHSTEP"), crack_mask)
    sea = g.maprange(g.noise(warped(g, p, 0.4, 2.0, seed + 0.6), 1.9, detail=4, w=seed + 0.7).outputs["Fac"], seas, seas + 0.05, 0.0, 1.0, "SMOOTHSTEP")
    col = g.ramp(g.maprange(base, 0.3, 0.75), [(0.0, hexc(tint_b)), (0.5, hexc(tint_a)), (1.0, hexc("#f4fbff"))])
    col = g.mixc(g.math("MULTIPLY", sea, 0.75), col, hexc("#5f86a8"))
    col = g.mixc(g.math("MAXIMUM", crack, crack2), col, hexc("#3f73a8"))
    col = g.mixc(polar_caps(g, p, 0.9, 0.06, seed + 0.8), col, hexc("#ffffff"))
    h = g.math("SUBTRACT", g.math("MULTIPLY", base, 0.4), g.math("MULTIPLY", g.math("MAXIMUM", crack, crack2), 0.35))
    h = g.math("SUBTRACT", h, g.math("MULTIPLY", sea, 0.12))
    h = g.math("ADD", h, craters(g, p, 7.0, seed + 0.9, 0.12))
    return col, h


# name: (kind, builder). "tone" maps are tinted by the planet's seeded colour; "colour" maps keep their own.
WORLDS = {
    "gas-a": ("tone", lambda g, p: gas(g, p, 1.3, 3.2, 0.2, -0.3)),
    "gas-b": ("tone", lambda g, p: gas(g, p, 4.7, 5.0, 0.14, 0.38)),
    "marble": ("tone", lambda g, p: marble(g, p, 2.9)),
    "moon": ("tone", lambda g, p: moon(g, p, 3.3)),
    "desert": ("colour", lambda g, p: desert(g, p, 5.1)),
    "lava": ("colour", lambda g, p: lava(g, p, 6.7)),
    "terran": ("colour", lambda g, p: terran(g, p, 7.9)),
    "ice-a": ("colour", lambda g, p: ice(g, p, 8.3, "#cfe6f5", "#8fb8d8", 0.6)),
    "ice-b": ("colour", lambda g, p: ice(g, p, 9.7, "#d9eef0", "#9cc6cc", 0.52)),
}


def setup_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = 1
    sc.cycles.use_denoising = False
    sc.cycles.seed = 0
    sc.render.threads_mode = "FIXED"
    sc.render.threads = 1  # one thread: the same tile order and bytes every run
    sc.view_settings.view_transform = "Standard"
    sc.view_settings.look = "None"
    sc.render.bake.margin = 8
    bpy.ops.mesh.primitive_uv_sphere_add(segments=256, ring_count=128, radius=1.0)
    ob = bpy.context.active_object
    bpy.ops.object.shade_smooth()
    return ob


def bake(ob, mat, kind_socket_builder, w, h, colourspace, path):
    g = Graph(mat)
    img = bpy.data.images.new(Path(path).stem, w, h, alpha=False, float_buffer=False)
    img.colorspace_settings.name = colourspace
    tex = g.node("ShaderNodeTexImage")
    tex.image = img
    g.n.active = tex
    g.emit(kind_socket_builder(g, g.coord))
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.bake(type="EMIT", margin=8, use_clear=True)
    img.filepath_raw = path
    img.file_format = "PNG"
    img.save()
    bpy.data.images.remove(img)


def render_world(ob, name, tmp):
    kind, build = WORLDS[name]
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True  # (still required by bpy 5.3 for a new material)
    ob.data.materials.clear()
    ob.data.materials.append(mat)
    cache = {}

    def colour(g, p):
        c, hgt = build(g, p)
        return c

    def height(g, p):
        c, hgt = build(g, p)
        return g.comb(*(3 * [g.maprange(hgt, -0.6, 0.9)])) if hgt is not None else (0.5, 0.5, 0.5, 1.0)

    cpath = os.path.join(tmp, f"{name}.png")
    bake(ob, mat, colour, MW, MH, "sRGB", cpath)
    cache["colour"] = cpath
    if kind == "colour" or name in ("moon", "marble"):
        hpath = os.path.join(tmp, f"{name}-h.png")
        bake(ob, mat, height, HW, HH, "Non-Color", hpath)
        cache["height"] = hpath
    return kind, cache


def webp(path, mode, quality):
    im = Image.open(path).convert(mode)
    # Blender's bake writes the UV sphere's v upwards (north at the bottom row of the PNG): flip so row 0 is north.
    im = im.transpose(Image.FLIP_TOP_BOTTOM)
    buf = io.BytesIO()
    im.save(buf, "WEBP", quality=quality, method=6)
    return buf.getvalue()


def main():
    check = "--check" in sys.argv
    only = [a for a in sys.argv[1:] if not a.startswith("--")]
    ob = setup_scene()
    OUT.mkdir(parents=True, exist_ok=True)
    rows, total, bad, files = [], 0, [], {}
    with tempfile.TemporaryDirectory() as tmp:
        for name in WORLDS:
            kind, paths = render_world(ob, name, tmp)
            tone = kind == "tone"
            files[f"{name}.webp"] = webp(paths["colour"], "L" if tone else "RGB", QUALITY)
            entry = {"kind": kind, "url": None, "h": None}
            if "height" in paths:
                files[f"{name}-h.webp"] = webp(paths["height"], "L", HEIGHT_QUALITY)
            for fn in [f"{name}.webp", f"{name}-h.webp"]:
                if fn in files:
                    total += len(files[fn])
            hc = hashlib.sha256(files[f"{name}.webp"]).hexdigest()[:10]
            hh = hashlib.sha256(files[f"{name}-h.webp"]).hexdigest()[:10] if f"{name}-h.webp" in files else None
            href = f'"/orbit/planets/{name}-h.webp?v={hh}"' if hh else "null"
            rows.append(f'  "{name}": {{ kind: "{kind}", url: "/orbit/planets/{name}.webp?v={hc}", height: {href} }},')
    if only:
        for fn, data in files.items():
            if any(fn.startswith(o) for o in only):
                (OUT / fn).write_bytes(data)
        print("wrote", [fn for fn in files if any(fn.startswith(o) for o in only)])
        return
    text = (
        "/** Orbit's planet surface maps (rendered in Blender by scripts/orbit-planets-blender.py; display only, never read by a sim). */\n"
        "export const ORBIT_PLANET_MAPS = {\n" + "\n".join(rows) + "\n} as const;\n"
        f"/** Their total size in bytes (colour and height maps). */\nexport const ORBIT_PLANET_MAP_BYTES = {total};\n"
    )
    if check:
        for fn, data in files.items():
            if not (OUT / fn).exists() or (OUT / fn).read_bytes() != data:
                bad.append(fn)
        if DATA.read_text() != text:
            bad.append(str(DATA))
        if bad:
            print("FAIL orbit-planets-blender: differs", bad)
            sys.exit(1)
        print(f"PASS orbit-planets-blender: {len(files)} files rebuilt byte for byte ({total} bytes)")
        return
    for old in OUT.glob("*.webp"):
        if old.name not in files:
            old.unlink()
    for fn, data in files.items():
        (OUT / fn).write_bytes(data)
    DATA.write_text(text)
    print(f"wrote {len(files)} files, {total} bytes")
    for fn, data in sorted(files.items()):
        print(f"  {fn}: {len(data)}")


if __name__ == "__main__":
    main()
