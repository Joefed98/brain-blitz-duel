"""Speed: concept scenes, one function per live game, each taking the look:

  a  "Today, upgraded": today's warm brown room, orange accents and each game's own pieces, made of real things
     (glass charms, onyx number marbles on walnut, a planked chute with enamel tiles, a lawn with brass-rimmed
     holes, a summer clay range, a glass reaction screen in a wooden frame).
  b  "Bolder": the same games pushed: richer lacquer and polish, lower and warmer light, more glare and depth.

Layouts come from docs/design/game-reviews/img/speed/ measured on a 390 x 844 grid.
"""
import math
import random

import bpy

from lib import (P, S, area, box, cbox, disc, dof, emissive, glass, ground, hexc, key_light, link, mat, metal, outline,
                 plane, poly, prism, rbox, reflector, ring, sphere, text, tube, width, world, wood)
from word import button, pill, tile


def palette(look):
    a = look == "a"
    return dict(
        ground=wood("sp_bg" + look, hexc("#3B2617" if a else "#2A170C"), hexc("#21130A" if a else "#140A04"),
                    rough=0.5 if a else 0.3, scale=10, coat=0.3 if a else 0.7),
        tray=mat("sp_tray" + look, hexc("#1E1A18" if a else "#141110"), rough=0.4 if a else 0.15, coat=0.5 if a else 1,
                 coat_rough=0.1),
        rim=wood("sp_rim" + look, hexc("#6E4526"), hexc("#3D230F"), rough=0.35, scale=18, coat=0.8),
        well=mat("sp_well" + look, hexc("#100C0A"), rough=0.6),
        tile=mat("sp_tile" + look, hexc("#2A2522" if a else "#1C1816"), rough=0.3 if a else 0.1, coat=0.8 if a else 1,
                 coat_rough=0.05),
        tile_dim=mat("sp_tdim" + look, hexc("#201B18" if a else "#16120F"), rough=0.4, coat=0.4),
        ink=mat("sp_ink", hexc("#F7F2EC"), rough=0.35),
        ink_dim=mat("sp_inkd", hexc("#8F8379"), rough=0.4),
        gold=mat("sp_gold", hexc("#F4B530"), rough=0.3, metal=0.35, coat=0.7, coat_rough=0.06) if a
        else metal("sp_goldb", hexc("#F7BE45"), rough=0.14, aniso=0.2),
        gold_ink=mat("sp_goldink", hexc("#160E04"), rough=0.4),
        gold_text=mat("sp_goldt", hexc("#F4B73E"), rough=0.35) if a else emissive("sp_goldtb", hexc("#FFC34D"), 1.4),
        blue=emissive("sp_orange" + look, hexc("#FF8A2A"), 2.2 if a else 5.0),
        blue_text=mat("sp_oranget", hexc("#FF8F3A"), rough=0.35),
        teal=mat("sp_teal", hexc("#2FD0B4"), rough=0.3, coat=0.7),
        red=mat("sp_red", hexc("#E0484C"), rough=0.3, coat=0.7),
        label=mat("sp_label", hexc("#E3D8CE"), rough=0.4),
        navy_btn=mat("sp_btn" + look, hexc("#241D19"), rough=0.35, coat=0.5),
    )


def light(look, power=1.0):
    if look == "a":
        world("interior", 0.25, rot=1.0, tint=(1.0, 0.9, 0.8, 1))
        key_light(1250 * power, warm=(1.0, 0.92, 0.82), fill=0.18)
        reflector(0.9, (1.0, 0.94, 0.86))
    else:
        world("night", 0.1, rot=0.6, tint=(1.0, 0.75, 0.55, 1))
        key_light(850 * power, warm=(1.0, 0.86, 0.7), fill=0.05)
        area(560, 80, 120, 500, 800, (1.0, 0.55, 0.25), target=(195, 450))  # amber rim from the right
        reflector(1.1, (1.0, 0.92, 0.82))


def finish(look):
    dof(10, 5.6 if look == "a" else 3.5)


def frame(pal, x0, y0, x1, y1, r=18, inner=None):
    """The wooden frame round a play area, as today's brown border, with a dark inset."""
    cx, cy, w, h = (x0 + x1) / 2, (y0 + y1) / 2, x1 - x0, y1 - y0
    rbox(cx, cy, w, h, 8, pal["rim"], r=r, bevel=3)
    rbox(cx, cy, w - 12, h - 12, 8.5, inner or pal["tray"], r=r - 5, bevel=1)


# ------------------------------------------------------------------------------------------------ chain


def charm(kind, x, y, col, look, z=9, s=19):
    a = look == "a"
    m = glass(f"ch_{col}{look}", (*hexc(col)[:3], 1), rough=0.03, ior=1.55)
    core = emissive(f"ch_core_{col}{look}", hexc(col), 0.6 if a else 1.5)
    if kind == "circ":
        sphere(x, y, s, m, z=z + s * 0.7, squash=0.7)
        sphere(x, y, s * 0.55, core, z=z + s * 0.5, squash=0.5)
    elif kind == "sq":
        rbox(x, y, s * 1.8, s * 1.8, s * 1.1, m, r=s * 0.35, z=z, bevel=s * 0.3, segs=5)
        rbox(x, y, s * 1.0, s * 1.0, s * 0.5, core, r=s * 0.2, z=z + 1, bevel=1)
    else:
        prism(poly(3, s * 1.25), s * 1.0, m, z=z, cx=x, cy=y + 2, bevel=s * 0.22, segs=4)
        prism(poly(3, s * 0.6), s * 0.5, core, z=z + 1, cx=x, cy=y + 3, bevel=1)


def chain(look):
    """Don't Break the Chain: the five-charm cycle, 12 links made, charms scattered on the board."""
    pal = palette(look)
    light(look)
    ground(pal["ground"])
    cyc = [("tri", "#F7D52A"), ("circ", "#2FC96A"), ("tri", "#EE3B43"), ("sq", "#F7D52A"), ("circ", "#3F7FF0")]
    for i, (k, c) in enumerate(cyc):
        x = 86 + i * 54
        if i == 0:
            rbox(x, 118, 34, 34, 2, pal["tile_dim"], r=7, bevel=0.8)
            outline(x, 118, 36, 36, 8, 2.2, 3.4, pal["gold"])
        charm(k, x, 118, c, look, z=2, s=8.5)
        if i < 4:
            tube([(x + 15, 118, 2), (x + 30, 118, 2)], 0.8, pal["ink_dim"])
            prism([(0, -3), (5, 0), (0, 3)], 1, pal["ink_dim"], z=1.5, cx=x + 30, cy=118, bevel=0.2)
    text("12", 176, 161, 22, pal["gold_text"], depth=0.6, align="RIGHT")
    text("/ 40", 186, 161, 22, pal["ink_dim"], depth=0.6, align="LEFT")
    frame(pal, 4, 195, 386, 832)
    charms = [("circ", "#F7D52A", 72, 272), ("sq", "#3F7FF0", 148, 295), ("sq", "#3F7FF0", 338, 292),
              ("tri", "#2FC96A", 207, 332), ("tri", "#2FC96A", 77, 378), ("sq", "#EE3B43", 127, 397),
              ("circ", "#EE3B43", 333, 368), ("tri", "#EE3B43", 253, 415), ("circ", "#3F7FF0", 195, 470),
              ("sq", "#EE3B43", 292, 475), ("circ", "#EE3B43", 57, 522), ("circ", "#EE3B43", 218, 552),
              ("circ", "#EE3B43", 155, 580), ("tri", "#3F7FF0", 332, 560), ("tri", "#F7D52A", 100, 632),
              ("sq", "#2FC96A", 288, 617), ("circ", "#F7D52A", 340, 645), ("circ", "#2FC96A", 225, 700),
              ("sq", "#F7D52A", 182, 745), ("tri", "#2FC96A", 300, 760), ("circ", "#3F7FF0", 70, 735)]
    for k, c, x, y in charms:
        charm(k, x, y, c, look)
    finish(look)


# ---------------------------------------------------------------------------------------------- numhunt


def numhunt(look):
    """Ascend: 24 numbered marbles on the board, 11 next, the 6.0 s countdown to the reshuffle."""
    pal = palette(look)
    a = look == "a"
    light(look)
    ground(pal["ground"])
    pill(pal, 111, 111, 68, 22, "Next", "11", size=8, vcol=pal["blue_text"])
    pill(pal, 190, 111, 76, 22, "In a row", "0", size=8, vcol=pal["ink"])
    pill(pal, 271, 111, 70, 22, "Errors", "10", size=8, vcol=pal["red"])
    text("6.0s", 195, 143, 14, pal["ink"], depth=0.4)
    rbox(172, 160, 34, 3.5, 1, pal["blue"], r=1.7, bevel=0.3)
    board = wood("nh_board" + look, hexc("#6A4428" if a else "#4A2C16"), hexc("#3B2312" if a else "#24130A"),
                 rough=0.4 if a else 0.2, scale=12, coat=0.6 if a else 1)
    frame(pal, 10, 170, 380, 830, inner=board)
    grid = mat("nh_grid" + look, hexc("#2E1C10"), rough=0.6)
    for x in range(40, 380, 40):
        box(x, 180, 1, 640, 0.3, grid, z=8.5, bevel=0)
    for y in range(200, 830, 40):
        box(20, y, 350, 1, 0.3, grid, z=8.5, bevel=0)
    onyx = mat("nh_onyx" + look, hexc("#2B2A2E" if a else "#121114"), rough=0.12 if a else 0.04, coat=1, coat_rough=0.02,
               spec=0.7)
    nums = [(64, 72, 240), (39, 126, 240), (34, 225, 235), (54, 300, 285), (93, 238, 330), (22, 60, 368), (48, 150, 387),
            (11, 292, 382), (88, 78, 470), (63, 228, 459), (79, 137, 503), (77, 303, 490), (44, 88, 566),
            (92, 210, 579), (37, 275, 573), (98, 45, 625), (61, 337, 625), (71, 118, 663), (62, 177, 688),
            (85, 268, 676), (50, 314, 720), (60, 52, 740), (15, 136, 758), (47, 220, 740)]
    for n, x, y in nums:
        disc(x, y, 21, 13, onyx, z=8.5, bevel=6, segs=6)
        ring(x, y, 22.5, 20.5, 6, metal("nh_rim" + look, hexc("#B9BEC6" if a else "#C9A15A"), rough=0.25), z=8.5)
        text(str(n), x, y + 0.5, 11, pal["ink"], z=21.4, depth=0.5)
        if n == 11:
            ring(x, y, 27, 24.5, 4, pal["blue"], z=8.5)
    finish(look)


# --------------------------------------------------------------------------------------------- reaction


def reaction(look):
    """Flash. A: the readout after a tap, 109 ms over the target rings. B: the instant the screen turns gold."""
    pal = palette(look)
    a = look == "a"
    light(look)
    ground(pal["ground"])
    text("BEST 109 MS", 16, 109, 8.5, pal["label"], depth=0.3, align="LEFT", spacing=1.1)
    text("9 FALSE", 374, 109, 8.5, pal["red"], depth=0.3, align="RIGHT", spacing=1.1)
    rbox(195, 475, 382, 708, 10, pal["rim"], r=26, bevel=4)
    if a:
        scr = mat("fl_screen", hexc("#1E1D22"), rough=0.08, coat=1, coat_rough=0.02, spec=0.6)
        rbox(195, 476, 360, 686, 10.6, scr, r=20, bevel=1.5)
        for r in (40, 80, 125, 170):
            ring(195, 478, r + 0.8, r - 0.8, 10.8, mat("fl_ring", hexc("#2C2B31"), rough=0.4), bevel=0.2)
        tube([(195, 300, 10.8), (195, 650, 10.8)], 0.5, mat("fl_ring", hexc("#2C2B31"), rough=0.4))
        tube([(30, 478, 10.8), (360, 478, 10.8)], 0.5, mat("fl_ring", hexc("#2C2B31"), rough=0.4))
        text("109 ms", 195, 478, 38, emissive("fl_amber", hexc("#FFB52E"), 3.5), z=10.8, depth=0.4)
    else:
        # The flash: the glass lit gold from behind, brightest at the centre, the frame catching it.
        gl = bpy.data.materials.new("fl_gold")
        gl.use_nodes = True
        nt = gl.node_tree
        nt.nodes.clear()
        o = nt.nodes.new("ShaderNodeOutputMaterial")
        e = nt.nodes.new("ShaderNodeEmission")
        tc = nt.nodes.new("ShaderNodeTexCoord")
        gr = nt.nodes.new("ShaderNodeTexGradient")
        gr.gradient_type = "SPHERICAL"
        mp = nt.nodes.new("ShaderNodeMapping")
        mp.inputs["Scale"].default_value = (0.42, 0.24, 1)
        nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
        nt.links.new(mp.outputs["Vector"], gr.inputs["Vector"])
        cr = nt.nodes.new("ShaderNodeValToRGB")
        cr.color_ramp.elements[0].color = hexc("#C97A08")
        cr.color_ramp.elements[1].color = hexc("#FFC23A")
        nt.links.new(gr.outputs["Fac"], cr.inputs["Fac"])
        nt.links.new(cr.outputs["Color"], e.inputs["Color"])
        e.inputs["Strength"].default_value = 0.75
        bs = nt.nodes.new("ShaderNodeBsdfGlossy")
        bs.inputs["Roughness"].default_value = 0.05
        ad = nt.nodes.new("ShaderNodeAddShader")
        nt.links.new(e.outputs[0], ad.inputs[0])
        nt.links.new(bs.outputs[0], ad.inputs[1])
        nt.links.new(ad.outputs[0], o.inputs[0])
        rbox(195, 476, 360, 686, 10.6, gl, r=20, bevel=1.5)
        point(195, 476, 60, 120, (1.0, 0.7, 0.25), radius=150)
        etch = mat("fl_etch", hexc("#B8740A"), rough=0.3)
        for r in (40, 80, 125, 170):
            ring(195, 478, r + 0.8, r - 0.8, 10.8, etch, bevel=0.2)
    finish(look)


def point(x, y, z, power, color, radius=20):
    ld = bpy.data.lights.new("p", "POINT")
    ld.energy = power
    ld.color = color
    ld.shadow_soft_size = radius * S
    ob = bpy.data.objects.new("p", ld)
    ob.location = P(x, y, z)
    link(ob)


# ---------------------------------------------------------------------------------------------- tendrop


def tendrop(look):
    """Tenfall: total 16 towards 25, four planked chutes with tiles falling, −3 about to land."""
    pal = palette(look)
    a = look == "a"
    light(look)
    ground(pal["ground"])
    pill(pal, 52, 87, 80, 30, "Total", "16", size=10)
    pill(pal, 153, 87, 104, 30, "Target", "25", size=10)
    rbox(295, 87, 166, 30, 3.5, pal["tile_dim"], r=15, bevel=1.2)
    for i in range(10):
        disc(232 + i * 10, 87, 2.6, 1.2, pal["gold"] if i == 0 else pal["ink_dim"], z=3.5, bevel=0.4)
    text("1/10", 370, 87.5, 9, pal["ink"], z=3.5, depth=0.3, align="RIGHT")
    plank = wood("td_plank" + look, hexc("#D4A46A" if a else "#B8824A"), hexc("#A8763F" if a else "#7A4E26"),
                 rough=0.45 if a else 0.25, scale=14, coat=0.4 if a else 0.9)
    plank2 = wood("td_plank2" + look, hexc("#C99A61" if a else "#A97640"), hexc("#9C6C38" if a else "#6A421E"),
                  rough=0.45 if a else 0.25, scale=11, coat=0.4 if a else 0.9)
    for c in range(4):
        box(2 + c * 97, 110, 94, 576, 4, plank if c % 2 == 0 else plank2, bevel=1)
        box(2 + c * 97, 696, 94, 148, 4, plank2 if c % 2 == 0 else plank, bevel=1)
    brass = metal("td_brass", hexc("#C99B48"), rough=0.25)
    box(0, 106, 390, 6, 8, brass, bevel=1.5)
    box(0, 682, 390, 12, 9, mat("td_rail" + look, hexc("#4A2E19"), rough=0.3, coat=0.8), bevel=2)
    for x in (8, 97, 195, 292, 382):
        disc(x, 688, 3.4, 10.5, brass, bevel=1)
    cream = mat("td_cream" + look, hexc("#F3E6CF"), rough=0.3 if a else 0.15, coat=0.8, coat_rough=0.05)
    blue = mat("td_blue" + look, hexc("#4E79B6"), rough=0.3 if a else 0.12, coat=0.9, coat_rough=0.04)
    amber = mat("td_amber" + look, hexc("#E88A2E"), rough=0.3 if a else 0.12, coat=0.9, coat_rough=0.04)
    dark = mat("td_dark", hexc("#2A1B10"), rough=0.4)
    tiles = [(1, 146, "÷2", cream, dark), (2, 178, "−3", blue, pal["ink"]), (0, 420, "+5", cream, dark),
             (3, 302, "×2", amber, pal["ink"]), (1, 560, "+8", cream, dark)]
    for c, y, lab, m, ink in tiles:
        x = 50 + c * 97
        rbox(x, y, 80, 64, 12, m, r=8, z=4, bevel=3)
        text(lab, x, y + 1, 22, ink, z=16, depth=0.6)
    finish(look)


# ------------------------------------------------------------------------------------------------- whack


def gopher(x, y, hat, look):
    """A gopher in a hard hat, rising out of its hole."""
    a = look == "a"
    fur = bpy.data.materials.get("gp_fur" + look) or mat("gp_fur" + look, hexc("#8A5A34"), rough=0.75, sheen=1.0,
                                                          bump=0.25, bump_scale=2500)
    muz = mat("gp_muz", hexc("#E8C9A0"), rough=0.7, sheen=0.6, bump=0.1, bump_scale=2500)
    nose = mat("gp_nose", hexc("#2A1810"), rough=0.2, coat=1)
    eye = mat("gp_eye", hexc("#0C0806"), rough=0.05, coat=1)
    # Seen from above, the gopher leans back out of its hole so its face looks up at the player.
    sphere(x, y + 4, 28, fur, z=6, squash=0.9)
    sphere(x, y + 12, 12.5, muz, z=27, squash=0.5)
    sphere(x, y + 9, 4.0, nose, z=33)
    for sg in (-1, 1):
        sphere(x + sg * 10, y + 1, 3.6, eye, z=30)
        sphere(x + sg * 9.6, y + 0.2, 1.1, mat("gp_glint", hexc("#FFFFFF"), rough=0.1), z=33.2)
        sphere(x + sg * 22, y - 8, 6.5, fur, z=18, squash=0.6)
        sphere(x + sg * 22, y - 8, 3.5, muz, z=20.5, squash=0.5)
    for sg in (-1, 1):
        sphere(x + sg * 5, y + 22, 3, mat("gp_tooth", hexc("#F4EFE4"), rough=0.3), z=22, squash=0.6)
    hm = {"gold": mat("gp_hgold" + look, hexc("#F2B22C"), rough=0.25 if a else 0.1, coat=1, coat_rough=0.04),
          "red": mat("gp_hred" + look, hexc("#C7322F"), rough=0.25 if a else 0.1, coat=1, coat_rough=0.04)}[hat]
    disc(x, y - 12, 27, 3, hm, z=24, bevel=1.4)
    sphere(x, y - 16, 20, hm, z=26, squash=0.7)
    box(x - 2.5, y - 36, 5, 22, 3, hm, z=37, bevel=1.4)
    disc(x, y - 3, 6, 3, mat("gp_lamp", hexc("#FFF1C8"), rough=0.1, emit=hexc("#FFE7A0"), emit_strength=1.5), z=25,
         bevel=1.2)


def hedgehog(x, y, look):
    body = mat("hh_body", hexc("#5A4636"), rough=0.6, sheen=0.5)
    sp = mat("hh_spine", hexc("#3A2C22"), rough=0.5)
    sphere(x, y + 4, 25, body, z=6, squash=0.8)
    rng = random.Random(int(x * 7 + y))
    for i in range(60):
        a_ = rng.uniform(math.pi * 0.95, math.pi * 2.05)
        r = rng.uniform(8, 23)
        bx, by = x + math.cos(a_) * r, y + 4 + math.sin(a_) * r * 0.9
        tube([(bx, by, 22), (bx + math.cos(a_) * 9, by + math.sin(a_) * 9, 26)], 1.1, sp)
    sphere(x, y + 18, 10, mat("hh_face", hexc("#D8BC98"), rough=0.6, sheen=0.5), z=18, squash=0.7)
    sphere(x, y + 25, 3, mat("gp_nose", hexc("#2A1810"), rough=0.2, coat=1), z=24)


def lawn_hair(look):
    """A real lawn: short particle grass over the whole field."""
    a = look == "a"
    me = bpy.data.meshes.new("lawn")
    import bmesh
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=120, y_segments=210, size=1.0)
    xs = [v.co.x for v in bm.verts]
    span = max(xs) - min(xs)
    for v in bm.verts:
        v.co.x *= 400 * S / span
        v.co.y *= 690 * S / span
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new("lawn", me)
    ob.location = P(195, 508, 0.6)
    link(ob)
    vg = ob.vertex_groups.new(name="dens")
    for v in me.vertices:
        px = v.co.x / S + 195
        py = 508 - v.co.y / S
        d = min(math.hypot(px - (45 + c * 100), py - (345 + r * 100)) for r in range(4) for c in range(4))
        w = 0.0 if d < 47 else min(1.0, (d - 47) / 6)
        if py < 166:
            w = 0.0
        vg.add([v.index], w, "REPLACE")
    soil = mat("ln_soil" + look, hexc("#2E4A1E" if a else "#1C3212"), rough=0.9)
    me.materials.append(soil)
    gm = mat("ln_grass" + look, hexc("#3E8A2E" if a else "#2C6A22"), rough=0.6, sheen=0.3)
    me.materials.append(gm)
    ps = ob.modifiers.new("grass", "PARTICLE_SYSTEM").particle_system
    st = ps.settings
    st.type = "HAIR"
    st.count = 60000
    st.hair_length = 9 * S
    st.material = 2
    st.use_advanced_hair = False
    st.child_type = "INTERPOLATED"
    st.rendered_child_count = 6
    st.child_length = 0.9
    st.child_length_threshold = 0.4
    st.roughness_2 = 0.08
    st.roughness_endpoint = 0.04
    st.root_radius = 1.0
    st.tip_radius = 0.0
    st.radius_scale = 0.6 * S
    st.normal_factor = 1.0
    st.factor_random = 0.004
    st.brownian_factor = 0.0
    ps.vertex_group_density = "dens"
    st.distribution = "RAND"
    st.child_radius = 0.06
    st.hair_length = 9 * S
    return ob


def whack(look):
    """Bonk: TAP GOLD, sixteen holes in the lawn, a gold-hat gopher up, a red-hat one and a hedgehog too."""
    pal = palette(look)
    a = look == "a"
    light(look, 1.1)
    ground(pal["ground"])
    rbox(195, 92, 318, 60, 4, pal["tile_dim"], r=16, bevel=1.5)
    outline(195, 92, 318, 60, 16, 2.6, 5, pal["gold"])
    text("TAP GOLD", 195, 92, 22, pal["gold_text"], z=4, depth=0.6, spacing=1.15)
    text("Hits 1/64 · Wrong 0 · Combo ×1 · ◆0", 195, 141, 8, pal["label"], depth=0.3)
    lawn_hair(look)
    soil = mat("wk_soil", hexc("#3A2616"), rough=0.9, bump=0.3, bump_scale=900)
    hole = mat("wk_hole", hexc("#050302"), rough=1.0)
    brass = metal("wk_brass" + look, hexc("#C99B5A" if a else "#D9A84E"), rough=0.3 if a else 0.18)
    for r in range(4):
        for c in range(4):
            x, y = 45 + c * 100, 345 + r * 100
            disc(x, y, 46, 3.5, soil, z=-0.5, bevel=1.2)
            disc(x, y, 39, 4.0, hole, z=-0.3, bevel=0.3)
            ring(x, y, 43, 39, 6, brass, z=0, bevel=1.2)
    gopher(45, 345, "red", look)
    gopher(45, 645, "gold", look)
    gopher(345, 545, "gold", look)
    hedgehog(245, 445, look)
    finish(look)


# --------------------------------------------------------------------------------------------- clayshoot


def clay(loc, rot, look, gold=False):
    """A clay target: a shallow ribbed dome, from the side and below as it flies."""
    a = look == "a"
    m = metal("cl_gold", hexc("#F2B23A"), rough=0.2, brushed=False) if gold else \
        mat("cl_orange" + look, hexc("#F06A1E"), rough=0.55, bump=0.08, bump_scale=3000)
    rimm = metal("cl_goldrim", hexc("#C98A1E"), rough=0.3, brushed=False) if gold else \
        mat("cl_rim" + look, hexc("#B9440F"), rough=0.6)
    import bmesh
    me = bpy.data.meshes.new("clay")
    bm = bmesh.new()
    prof = [(0.0, 0.26), (0.18, 0.25), (0.3, 0.2), (0.34, 0.2), (0.36, 0.14), (0.5, 0.06), (0.55, 0.0), (0.5, -0.02),
            (0.0, -0.02)]
    rings = []
    seg = 64
    for (r, z) in prof:
        rings.append([bm.verts.new((math.cos(2 * math.pi * i / seg) * r, math.sin(2 * math.pi * i / seg) * r, z))
                      for i in range(seg)])
    for k in range(len(rings) - 1):
        for i in range(seg):
            j = (i + 1) % seg
            f = bm.faces.new((rings[k][i], rings[k][j], rings[k + 1][j], rings[k + 1][i]))
            f.material_index = 1 if k in (2, 3, 6, 7) else 0
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    ob = bpy.data.objects.new("clay", me)
    ob.location = loc
    ob.rotation_euler = rot
    link(ob)
    me.materials.append(m)
    me.materials.append(rimm)
    return ob


def clayshoot(look):
    """Pull!: a summer clay range under a high sun; a pair of clays and a gold one in flight, a bird crossing."""
    a = look == "a"
    sc = bpy.context.scene
    cam = sc.camera
    cam.location = (0, -2, 1.6)
    cam.rotation_euler = (math.radians(90 + 30), 0, 0)
    cam.data.lens = 22
    # Sky: Blender's physical sky, the sun high and to the right (lower and warmer in B, late afternoon).
    wd = bpy.data.worlds.new("sky")
    sc.world = wd
    wd.use_nodes = True
    nt = wd.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputWorld")
    sky = nt.nodes.new("ShaderNodeTexSky")
    try:
        sky.sky_type = "MULTIPLE_SCATTERING"
    except TypeError:
        sky.sky_type = "NISHITA"
    sky.sun_elevation = math.radians(48 if a else 14)
    sky.sun_rotation = math.radians(-35 if a else -50)
    sky.altitude = 200
    sky.air_density = 1.0
    sky.aerosol_density = 1.0 if a else 2.4
    bg = nt.nodes.new("ShaderNodeBackground")
    bg.inputs["Strength"].default_value = 0.06 if a else 0.09
    nt.links.new(sky.outputs[0], bg.inputs[0])
    nt.links.new(bg.outputs[0], out.inputs[0])
    sun = bpy.data.lights.new("sun", "SUN")
    sun.energy = 2.2 if a else 2.0
    sun.angle = math.radians(1.5)
    sun.color = (1, 0.97, 0.9) if a else (1, 0.72, 0.45)
    so = bpy.data.objects.new("sun", sun)
    so.rotation_euler = (math.radians(90 - (52 if a else 16)), 0, math.radians(-35 if a else -50) + math.pi)
    link(so)
    # Ground: a field to the treeline, rolling hills, a rail fence and the two trap houses.
    me_ = bpy.data.meshes.new("field")
    import bmesh
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=2, y_segments=2, size=400)
    bm.to_mesh(me_)
    bm.free()
    field = bpy.data.objects.new("field", me_)
    link(field)
    from lib import stone
    me_.materials.append(stone("pl_field" + look, hexc("#5C9A3A" if a else "#4B7A2C"), hexc("#2F5E22" if a else "#244A18"),
                               rough=0.9, scale=0.6, veins=False))
    hill = mat("pl_hill" + look, hexc("#4B6E58" if a else "#3B4E46"), rough=0.9)
    rng = random.Random(5)
    for i in range(9):
        x = -60 + i * 15 + rng.uniform(-4, 4)
        h = bpy.data.objects.new("hill", bpy.data.meshes.new("h"))
        bm = bmesh.new()
        bmesh.ops.create_uvsphere(bm, u_segments=32, v_segments=16, radius=1)
        bm.to_mesh(h.data)
        bm.free()
        for p in h.data.polygons:
            p.use_smooth = True
        h.scale = (rng.uniform(14, 22), 6, rng.uniform(3, 6))
        h.location = (x, 140 + rng.uniform(-10, 10), -1)
        h.data.materials.append(hill)
        link(h)
    tree = mat("pl_tree" + look, hexc("#2C4A2A" if a else "#22331F"), rough=0.9, bump=0.5, bump_scale=20)
    for i in range(700):
        x = rng.uniform(-110, 110)
        t = bpy.data.objects.new("tree", bpy.data.meshes.get("treemesh") or bpy.data.meshes.new("treemesh"))
        if not t.data.vertices:
            bm = bmesh.new()
            bmesh.ops.create_icosphere(bm, subdivisions=2, radius=1)
            bm.to_mesh(t.data)
            bm.free()
            t.data.materials.append(tree)
        s = rng.uniform(1.2, 2.6)
        t.scale = (s * rng.uniform(0.8, 1.2), s, s * rng.uniform(1.3, 2.0))
        t.location = (x, 105 + rng.uniform(0, 40), s * 1.2 + rng.uniform(-0.5, 1.5))
        link(t)
    rail = wood("pl_rail" + look, hexc("#8A6A4A"), hexc("#5A4028"), rough=0.6, scale=30, coat=0.0)
    for k in range(-14, 15):
        post = bpy.data.objects.new("post", bpy.data.meshes.new("pm"))
        bm = bmesh.new()
        bmesh.ops.create_cube(bm, size=1)
        bm.to_mesh(post.data)
        bm.free()
        post.scale = (0.08, 0.08, 1.1)
        post.location = (k * 1.4, 18, 0.55)
        post.data.materials.append(rail)
        link(post)
    for zz in (0.55, 0.95):
        r_ = bpy.data.objects.new("rail", bpy.data.meshes.new("rm"))
        bm = bmesh.new()
        bmesh.ops.create_cube(bm, size=1)
        bm.to_mesh(r_.data)
        bm.free()
        r_.scale = (42, 0.05, 0.08)
        r_.location = (0, 18, zz)
        r_.data.materials.append(rail)
        link(r_)
    house = mat("pl_house" + look, hexc("#D9D3C6"), rough=0.6)
    for sx in (-2.15, 2.15):
        hb = bpy.data.objects.new("trap", bpy.data.meshes.new("tm"))
        bm = bmesh.new()
        bmesh.ops.create_cube(bm, size=1)
        bm.to_mesh(hb.data)
        bm.free()
        hb.scale = (0.9, 0.7, 0.45)
        hb.location = (sx, 4.5, 0.22)
        hb.data.materials.append(house)
        mod = hb.modifiers.new("b", "BEVEL")
        mod.width = 0.03
        mod.segments = 3
        link(hb)
    # The clays and the bird, in the sky above the range.
    clay((-0.9, 9, 6.2), (math.radians(42), math.radians(-14), 0.3), look)
    clay((1.3, 10, 7.4), (math.radians(38), math.radians(16), -0.2), look)
    clay((0.2, 12, 10.4), (math.radians(44), math.radians(-8), 0.1), look, gold=True)
    # Haze over the far field so the treeline and hills sit back.
    hz = bpy.data.objects.new("haze", bpy.data.meshes.new("hz"))
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    bm.to_mesh(hz.data)
    bm.free()
    hz.scale = (600, 240, 30)
    hz.location = (0, 150, 14)
    vm = bpy.data.materials.new("haze")
    vm.use_nodes = True
    vnt = vm.node_tree
    vnt.nodes.remove(vnt.nodes["Principled BSDF"])
    pv = vnt.nodes.new("ShaderNodeVolumePrincipled")
    pv.inputs["Density"].default_value = 0.004 if a else 0.007
    pv.inputs["Color"].default_value = (0.8, 0.88, 1.0, 1) if a else (1.0, 0.8, 0.6, 1)
    vnt.links.new(pv.outputs[0], vnt.nodes["Material Output"].inputs["Volume"])
    hz.data.materials.append(vm)
    link(hz)
    bird = mat("pl_bird", hexc("#2A2622"), rough=0.6, sheen=0.4)
    bp = [(0, -0.2), (0.5, -0.05), (1.2, -0.5), (1.0, -0.1), (0.4, 0.1), (0.1, 0.5), (-0.1, 0.5), (-0.4, 0.1),
          (-1.0, -0.1), (-1.2, -0.5), (-0.5, -0.05)]
    bo = bpy.data.objects.new("bird", bpy.data.meshes.new("bm"))
    bm = bmesh.new()
    vs = [bm.verts.new((x * 0.5, 0, -y * 0.5)) for x, y in bp]
    f = bm.faces.new(vs)
    bmesh.ops.solidify(bm, geom=[f], thickness=0.04)
    bm.to_mesh(bo.data)
    bm.free()
    bo.location = (2.1, 13, 4.2)
    bo.rotation_euler = (math.radians(20), 0, math.radians(-15))
    bo.data.materials.append(bird)
    link(bo)
    # Out-of-focus far field, crisp clays.
    cam.data.dof.use_dof = True
    cam.data.dof.focus_distance = 11
    cam.data.dof.aperture_fstop = 4.0 if a else 2.8
    # The HUD line under the header, as today.
    sc.cycles.samples = 160
