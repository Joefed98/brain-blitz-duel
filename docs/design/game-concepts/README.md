# Game concepts (phase 2, step 4)

Concept pictures for choosing each game's look. Nothing here is in the app. Following Joe's note of 15 Nov 2026,
every look keeps the game's own colours, pieces and layout:

- **A · Today, upgraded**: the game as it is today, rendered to the full standard. The main one.
- **B · Bolder**: the same game, pushed further.
- **C**: a third look for the flagship games (Cue Ball, Crazy Golf, Apex, Gemstone).

Pages: [Cards & Board](cards-board.md) · [Sports](sports.md) · [Strategy](strategy.md).

Rendered in Blender 5.3 (the `bpy` module from pip, Cycles on CPU with OpenImageDenoise). Each game is one script in
[source/](source/), run with `python source/<category>/<game>.py [A B C]` (`QUICK=1` for a fast preview). The shared
toolkit is `source/lib.py`, plus a helper module per category. Archivo is under the SIL Open Font License
(`source/OFL-Archivo.txt`).
