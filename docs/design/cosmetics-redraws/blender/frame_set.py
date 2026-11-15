"""The redrawn frames other than Founding (frame_founding.py), each a crafted object with its own motif
(docs/design/cosmetics-redraws/ART-DIRECTION.md, "Frames"; shared pieces in frames.py):

  frame.top-500       regal: a heavy dark-gold band with filigree and a crimson inlay, a gold coronet with pearls
                      and a ruby over a filigree cartouche, ruby cabochons at the corners, rubies on the band
  frame.championship  the grandest: two-tone (a platinum outer band, a gold inner band with navy enamel), a gold
                      trophy crest in a gold laurel wreath on a platinum sunburst, platinum stars with diamonds at
                      the corners
  frame.s1-<tier>     Season 1, one family: the tier's metal and enamel inlay, the season's hexagonal "1" medallion
                      (its shared motif), tier stones at the corners, richer tier by tier (wider bands, more stones, a
                      second band from Storm, a sunburst behind the medallion on Top 500)
  frame.obsidian      black volcanic glass with a violet light along its inner edge, obsidian shards at the corners
  frame.silver        polished silver, finely engraved, silver studs (calm)
  frame.bronze        warm satin bronze, plain studs (everyday: calm)

  python frame_set.py [id …]   (SAMPLES=n for a quick look)
"""
import math
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import frames as F  # noqa: E402
import lib  # noqa: E402

CORNERS = ((8, 8), (292, 8), (8, 104), (292, 104))
RUBY = (0.75, 0.02, 0.08)
CRIMSON_ENAMEL = (0.32, 0.01, 0.04)
NAVY = (0.012, 0.022, 0.07)
PEARL = (0.95, 0.92, 0.86)
DIAMOND = (0.92, 0.96, 1.0)

CROWN = [(-1, -0.55), (1, -0.55), (0.95, -0.2), (1.0, 0.75), (0.65, 0.15), (0.45, 0.85), (0.2, 0.2), (0, 1.0), (-0.2, 0.2), (-0.45, 0.85), (-0.65, 0.15), (-1.0, 0.75), (-0.95, -0.2)]
CROWN_TIPS = [(1.0, 0.75), (0.45, 0.85), (0, 1.0), (-0.45, 0.85), (-1.0, 0.75)]
TROPHY = [(-0.95, 0.95), (0.95, 0.95), (0.85, 0.55), (0.6, 0.15), (0.25, -0.05), (0.14, -0.35), (0.42, -0.62), (0.42, -0.85), (-0.42, -0.85), (-0.42, -0.62), (-0.14, -0.35), (-0.25, -0.05), (-0.6, 0.15), (-0.85, 0.55)]
ONE = [(-0.38, 0.62), (0.12, 1.0), (0.36, 1.0), (0.36, -0.72), (0.62, -0.72), (0.62, -1.0), (-0.52, -1.0), (-0.52, -0.72), (-0.16, -0.72), (-0.16, 0.48), (-0.38, 0.36)]


def star(n=5, inner=0.45):
    return [(math.cos(math.pi / 2 + i * math.pi / n) * (1 if i % 2 == 0 else inner), math.sin(math.pi / 2 + i * math.pi / n) * (1 if i % 2 == 0 else inner)) for i in range(2 * n)]


def hexagon(r=1.0):
    return [(math.cos(math.radians(90 + 60 * i)) * r, math.sin(math.radians(90 + 60 * i)) * r) for i in range(6)]


# ------------------------------------------------------------------ Top 500


def top_500():
    F.studio(horizon=2.8, zenith=0.3)
    dg = F.metal("darkgold", F.METALS["dark-gold"], 0.13)
    F.band("band", [dg, F.engraved("filigree", F.METALS["dark-gold"], "scroll", 0.28, 0.8), F.enamel("crimson", CRIMSON_ENAMEL)], F.INLAY_PROFILE, scale=(1.85, 1.5), inset=6.4, radius=5.0)
    # A fine black-enamel line inside the band.
    F.band("line", [F.enamel("black", (0.01, 0.01, 0.012))], [(-0.5, 0.2, 0), (-0.4, 0.7, 0), (0.4, 0.7, 0), (0.5, 0.2, 0)], scale=(1.0, 1.0), inset=13.6, radius=2.5)
    gold = F.metal("gold", F.METALS["gold"], 0.12)
    for x, y in CORNERS:
        F.stone(x, y, 5.2, RUBY, gold, cut="cabochon", ior=1.76, spark=1800)
    for x in (70, 230):
        for y in (6.2, 105.8):
            F.stone(x, y, 2.4, RUBY, gold, z=3.4, spark=500)
    # The cartouche behind the coronet: a filigree oval.
    c = F.disc(150, 9, 19.5, 3.0, F.engraved("cart", F.METALS["dark-gold"], "scroll", 0.25, 0.9), bevel=1.0)
    c.scale = (1.32, 0.86, 1.0)
    c2 = F.disc(150, 9, 16.6, 3.6, F.enamel("cartenamel", CRIMSON_ENAMEL), bevel=0.5)
    c2.scale = (1.32, 0.86, 1.0)
    F.ring(150, 9, 17.4, 0.7, gold, 3.6)
    bpy.context.object.scale = (1.32, 0.86, 1.0)
    # The coronet: a raised gold crown, pearls on its tips, a ruby in its band, small rubies beside it.
    F.poly_relief(CROWN, 150, 9.5, 14.5, 3.6, 2.6, F.metal("crown", F.METALS["gold"], 0.1), bevel=0.45, name="crown")
    pearl = lib.material("pearl", base=PEARL, roughness=0.18, coat=1.0)
    for px, py in CROWN_TIPS:
        bpy.ops.mesh.primitive_uv_sphere_add(radius=1.9, location=F.card_to_world(150 + px * 14.5, 9.5 - py * 14.5, 6.6))
        bpy.context.object.data.materials.append(pearl)
        bpy.ops.object.shade_smooth()
    F.stone(150, 15.0, 3.0, RUBY, gold, z=6.2, cut="cabochon", claws=0, spark=900)
    for dx in (-7, 7):
        F.stone(150 + dx * 1.15, 15.6, 1.7, RUBY, gold, z=6.2, claws=0, spark=0)
    F.plaque(150, 105, 62, 12, gold, F.enamel("plaque", CRIMSON_ENAMEL))


# ------------------------------------------------------------------ Championship


def championship():
    F.studio(horizon=3.0, zenith=0.36, warm=False)
    plat = F.metal("plat", F.METALS["platinum"], 0.1)
    gold = F.metal("gold", F.METALS["gold"], 0.12)
    F.band("outer", [plat, F.engraved("platfield", F.METALS["platinum"], "lines", 0.25, 0.4)], F.BASE_PROFILE, scale=(1.35, 1.5), inset=4.2, radius=6.0)
    F.band("inner", [gold, F.engraved("goldfield", F.METALS["gold"], "guilloche", 0.28), F.enamel("navy", NAVY)], F.INLAY_PROFILE, scale=(1.05, 1.15), inset=12.2, radius=2.2)
    # Corners: platinum stars set with diamonds.
    for x, y in CORNERS:
        F.poly_relief(star(), x, y, 7.4, 3.6, 1.6, plat, bevel=0.5, name="star")
        F.stone(x, y, 2.3, DIAMOND, plat, z=5.4, ior=2.42, claws=0, spark=1200)
    # The crest: a platinum sunburst, a gold laurel wreath, the gold trophy.
    rays = [(math.cos(math.radians(a)) * (1.0 if i % 2 == 0 else 0.62), math.sin(math.radians(a)) * (1.0 if i % 2 == 0 else 0.62)) for i, a in enumerate(range(0, 360, 15))]
    F.poly_relief(rays, 150, 9, 21.5, 3.2, 1.0, plat, bevel=0.3, name="burst")
    F.disc(150, 9, 15.2, 4.6, F.enamel("crestnavy", NAVY), bevel=0.8)
    F.ring(150, 9, 15.3, 1.0, gold, 4.6)
    F.poly_relief(TROPHY, 150, 9, 10.2, 4.6, 2.2, F.metal("trophy", F.METALS["gold"], 0.09), bevel=0.4, name="trophy")
    for side in (-1, 1):
        # The handles: two small gold rings.
        F.ring(150 + side * 8.8, 3.6, 3.0, 0.6, gold, 5.4)
    leaf = F.metal("laurel", F.METALS["gold"], 0.18)
    F.leaf_spray(150, 9, 1, leaf, count=9, length=40, start=23, size=1.25, rise=3.6)
    F.leaf_spray(150, 9, -1, leaf, count=9, length=40, start=23, size=1.25, rise=3.6)
    F.stone(150, 0.8, 1.9, DIAMOND, gold, z=6.8, ior=2.42, claws=0, spark=800)
    F.plaque(150, 105, 64, 12, plat, F.enamel("plaque", NAVY))


# ------------------------------------------------------------------ Season 1


SEASON = {
    #          metal         enamel                 stone (gem)          scale      corner r  extra  double  burst
    "spark": ("copper", (0.6, 0.2, 0.06), (0.95, 0.42, 0.16), (1.25, 1.2), 3.2, 0, False, False),
    "charge": ("platinum", (0.03, 0.45, 0.2), (0.12, 0.85, 0.42), (1.3, 1.2), 3.4, 0, False, False),
    "volt": ("platinum", (0.03, 0.42, 0.56), (0.18, 0.86, 1.0), (1.35, 1.25), 3.6, 0, False, False),
    "surge": ("gold", (0.06, 0.15, 0.64), (0.25, 0.4, 1.0), (1.45, 1.3), 3.8, 2, False, False),
    "storm": ("gold", (0.3, 0.08, 0.64), (0.62, 0.36, 1.0), (1.5, 1.35), 4.0, 2, True, False),
    "lightning": ("gold", (0.8, 0.58, 0.04), (1.0, 0.85, 0.2), (1.6, 1.4), 4.4, 4, True, False),
    "top-500": ("dark-gold", (0.28, 0.04, 0.44), DIAMOND, (1.7, 1.45), 4.8, 4, True, True),
}


def season(tier):
    metal_name, enamel_c, gem_c, scale, cr, extra, double, burst = SEASON[tier]
    F.studio(horizon=2.7, zenith=0.32, warm=metal_name not in ("platinum",))
    met = F.metal("m", F.METALS[metal_name], 0.13)
    en = F.enamel("e", enamel_c)
    F.band("band", [met, F.engraved("f", F.METALS[metal_name], "guilloche", 0.3), en], F.INLAY_PROFILE, scale=scale, inset=5.6, radius=5.0)
    if double:
        F.band("inner", [met], F.PLAIN_PROFILE, scale=(0.32, 0.55), inset=13.2, radius=2.0)
    ior = 2.42 if gem_c == DIAMOND else 1.77
    for x, y in CORNERS:
        F.stone(x, y, cr + 0.8, gem_c, met, ior=ior, spark=2800)
    if extra:
        xs = (80, 220) if extra == 2 else (60, 105, 195, 240)
        for x in xs:
            for y in (6.0, 106.0):
                F.stone(x, y, 2.2, gem_c, met, z=3.6, ior=ior, claws=0, spark=400)
    # The season medallion: a hexagon of the tier's metal, its enamel, a raised "1".
    if burst:
        rays = [(math.cos(math.radians(a)) * (1.0 if i % 2 == 0 else 0.6), math.sin(math.radians(a)) * (1.0 if i % 2 == 0 else 0.6)) for i, a in enumerate(range(0, 360, 20))]
        F.poly_relief(rays, 150, 9, 20, 3.0, 0.9, F.metal("burst", F.METALS["gold"], 0.12), bevel=0.3, name="burst")
    F.poly_relief(hexagon(), 150, 9, 14.6, 0.0, 4.2, met, bevel=0.8, name="hex")
    F.poly_relief(hexagon(), 150, 9, 11.8, 4.2, 0.5, F.enamel("hexenamel", enamel_c), bevel=0.25, name="hexenamel")
    F.poly_relief(ONE, 150, 9.5, 7.2, 4.7, 1.4, F.metal("one", F.METALS[metal_name], 0.1), bevel=0.3, name="one")


# ------------------------------------------------------------------ everyday and Elite


def obsidian():
    F.studio(horizon=3.2, zenith=0.4, warm=False)
    glass = lib.material("obsidian", base=(0.012, 0.01, 0.018), roughness=0.04, coat=1.0)
    F.band("band", [glass, lib.material("obsfield", base=(0.02, 0.016, 0.03), roughness=0.12, coat=0.6)], F.BASE_PROFILE, scale=(1.55, 1.35), inset=5.6, radius=5.0)
    # The violet light along the inner edge.
    F.band("edge", [lib.emission_material("violet", (0.62, 0.36, 1.0), 18.0)], [(-0.45, 0.2, 0), (-0.3, 1.1, 0), (0.3, 1.1, 0), (0.45, 0.2, 0)], scale=(1.0, 1.0), inset=11.0, radius=1.8)
    shard = lib.material("shard", base=(0.015, 0.012, 0.022), roughness=0.03, coat=1.0)
    for i, (x, y) in enumerate(CORNERS):
        for k, (dx, dy, r, h) in enumerate(((0, 0, 6.2, 9.0), (4.6, 3.4, 3.6, 5.8), (-3.6, 4.4, 3.0, 4.6))):
            sx = -1 if x > 150 else 1
            sy = -1 if y > 56 else 1
            bpy.ops.mesh.primitive_cone_add(vertices=5, radius1=r, radius2=0.2, depth=h, location=F.card_to_world(x + dx * sx, y + dy * sy, h / 2))
            o = bpy.context.object
            o.rotation_euler = (0.25 * sy, -0.2 * sx, math.radians(17 * (i + k)))
            o.data.materials.append(shard)
    F.point_light(150, 56, 60, 30000, (0.75, 0.6, 1.0), 40)


def silver():
    F.studio(horizon=2.6, zenith=0.32, warm=False)
    s = F.metal("silver", F.METALS["silver"], 0.1)
    F.band("band", [s, F.engraved("lines", F.METALS["silver"], "lines", 0.22, 0.35)], F.BASE_PROFILE, scale=(1.3, 1.2), inset=5.0, radius=5.4)
    for x, y in CORNERS:
        F.disc(x, y, 3.6, 3.4, s, bevel=1.2, vertices=48)


def bronze():
    F.studio(horizon=2.2, zenith=0.28)
    b = F.metal("bronze", F.METALS["bronze"], 0.34)
    F.band("band", [b], F.PLAIN_PROFILE, scale=(1.2, 1.1), inset=4.8, radius=5.6)
    for x, y in CORNERS:
        F.disc(x, y, 3.0, 2.9, b, bevel=1.0, vertices=40)


BUILDERS = {
    "frame.top-500": top_500,
    "frame.championship": championship,
    **{f"frame.s1-{t}": (lambda t=t: season(t)) for t in SEASON},
    "frame.obsidian": obsidian,
    "frame.silver": silver,
    "frame.bronze": bronze,
}

ids = sys.argv[1:] or list(BUILDERS)
for item in ids:
    F.begin()
    BUILDERS[item]()
    F.finish(item)
