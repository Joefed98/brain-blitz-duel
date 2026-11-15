"""Saves the Captain as captain.blend (win pose, his materials editable in Blender), for skins and other poses.

    python save_blend.py [pose]
"""
import os
import sys

import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import captain  # noqa: E402

bpy.ops.wm.read_factory_settings(use_empty=True)
pose = sys.argv[1] if len(sys.argv) > 1 else "win"
captain.build(pose=pose)
path = os.path.join(HERE, "captain.blend")
bpy.ops.wm.save_as_mainfile(filepath=path, compress=True)
print(path, os.path.getsize(path) // 1024, "KB")
