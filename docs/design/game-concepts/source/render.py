"""Render one concept: python render.py <category> <game-id> <look> [--samples=N] [--preview]

Writes docs/design/game-concepts/<category>/<game-id>-<look>.webp and thumbs/<game-id>-<look>.webp.
Each category module (word.py, attention.py, speed.py) has one function per game taking the look letter.
"""
import importlib
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import lib  # noqa: E402
import post  # noqa: E402


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    opts = dict(a[2:].split("=", 1) if "=" in a else (a[2:], "1") for a in sys.argv[1:] if a.startswith("--"))
    cat, game, look = args
    mod = importlib.import_module(cat)
    fn = getattr(mod, game.replace("-", "_"))
    lib.reset(seed=hash((game, look)) & 0xFFFF)
    fn(look)
    tmp = os.environ.get("CONCEPT_TMP", "/tmp")
    png = os.path.join(tmp, f"{game}-{look}.png")
    if "preview" in opts:
        sc = lib.bpy.context.scene
        sc.render.resolution_x, sc.render.resolution_y = 270, 584
        lib.render(png, samples=24)
    else:
        lib.render(png, samples=int(opts.get("samples", 160)))
    out_dir = os.path.join(HERE, "..", cat)
    os.makedirs(os.path.join(out_dir, "thumbs"), exist_ok=True)
    post.export(png, os.path.join(out_dir, f"{game}-{look}.webp"), os.path.join(out_dir, "thumbs", f"{game}-{look}.webp"), look)
    print("WROTE", game, look)


if __name__ == "__main__":
    main()
