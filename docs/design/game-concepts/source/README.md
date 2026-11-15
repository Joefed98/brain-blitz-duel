# Game concept scenes (Blender)

Scripts that build and render the game concept pictures in `../action/` and `../retro/` (phase 2, step 4). Concept
art only; nothing here is used by the app.

- `lib.py`: shared helpers. Units are phone px / 100 on the z = 0 plane (`P(x, y)` from phone px), a long-lens
  camera that fills the 390 × 844 frame, materials (crackle crust, wood, windows, planets, atmosphere, nebula, fog,
  smoke), shapes (bevelled boxes, prisms, tubes, leaves, stars) and an original small hero figure.
- `render.py`: `python render.py <category> <game-id> <A|B> [--fast]` renders `games/<game-id>.py`'s `build(look)`
  with Cycles on the CPU, then adds bloom, a vignette, grain, the placeholder header band and the HUD pills and writes
  the 720 px WebP and a 240 px thumbnail.
- `games/<game-id>.py`: one scene per game; `look == 'A'` is Today upgraded, `'B'` is Bolder.

Install: `pip install bpy==5.3.0 pillow numpy` in a Python 3.13 virtual environment (the bpy wheel is Blender as a
module, headless; no GPU needed). A full render takes 30 s to 3 min on 4 cores; `--fast` is ~10 s for layout checks.
