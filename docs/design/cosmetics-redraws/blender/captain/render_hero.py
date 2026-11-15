"""Captain Joulz hero shots: front three-quarter, 600 x 800, on a studio backdrop, in his win and ready poses.

    python render_hero.py [win|ready …]   → docs/design/cosmetics-redraws/samples/captain/captain-<pose>.webp
"""
import os
import sys

import bpy
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.dirname(HERE))
import captain  # noqa: E402
import lib  # noqa: E402

OUT = os.path.join(lib.REPO, "docs/design/cosmetics-redraws/samples/captain")
os.makedirs(OUT, exist_ok=True)


def studio_world():
    w = lib.world((0, 0, 0), 1.0)
    nt = w.node_tree
    bg = nt.nodes["Background"]
    coord = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    el = ramp.color_ramp.elements
    el[0].position, el[0].color = 0.0, (0.01, 0.012, 0.02, 1)
    el[1].position, el[1].color = 1.0, (0.05, 0.05, 0.06, 1)
    el.new(0.52).color = (0.02, 0.025, 0.05, 1)
    el.new(0.58).color = (0.9, 0.85, 0.78, 1)
    el.new(0.66).color = (0.06, 0.07, 0.1, 1)
    nt.links.new(coord.outputs["Generated"], sep.inputs[0])
    nt.links.new(sep.outputs["Z"], ramp.inputs[0])
    nt.links.new(ramp.outputs[0], bg.inputs[0])


def hero(pose):
    s = lib.reset(600, 800, samples=int(os.environ.get("SAMPLES", 128)))
    studio_world()
    captain.build(pose=pose, location=(0, 0, 0), height=1.7, rotation_z=0.0)
    # A navy backdrop sweep and a floor, so he stands somewhere.
    bpy.ops.mesh.primitive_plane_add(size=20, location=(0, 0, 0))
    bpy.context.object.data.materials.append(lib.material("floor", base=(0.008, 0.01, 0.02), roughness=0.3))
    bpy.ops.mesh.primitive_plane_add(size=20, location=(0, 3, 5), rotation=(1.5708, 0, 0))
    bpy.context.object.data.materials.append(lib.material("sweep", base=(0.01, 0.014, 0.035), roughness=0.7))
    lib.area_light((-2.4, -2.6, 3.2), (0, 0, 1.0), 420, 2.2, (1.0, 0.95, 0.88))  # key, top left
    lib.area_light((2.6, 1.6, 2.2), (0, 0, 1.2), 380, 1.2, (0.55, 0.85, 1.0))  # cool rim
    lib.area_light((1.8, -3.0, 1.0), (0, 0, 0.9), 60, 3, (1.0, 0.85, 0.65))  # warm fill
    lib.camera((1.15, -3.1, 1.12), (0, 0, 0.98 if pose != "win" else 1.04), lens=50)
    png = os.path.join(lib.TMP, f"captain-{pose}.png")
    secs = lib.render(png)
    img = lib.bloom(Image.open(png), threshold=0.75, radius=10, amount=0.35)
    path = os.path.join(OUT, f"captain-{pose}.webp")
    img.save(path, "WEBP", quality=86, method=6)
    print(f"captain-{pose}: {secs:.1f} s, {os.path.getsize(path) / 1024:.1f} KB")


for p in sys.argv[1:] or ["win", "ready"]:
    hero(p)
