# Pattern overhaul: sounds for Joe to generate (ElevenLabs)

Phase 2 step 4 (15 Nov 2026). One line per sound: the slot it fills, what it is, the material, the feel and the
length. Generate each, name the file `<slot>.mp3` and drop it in `public/sounds/`; the slot already plays a
placeholder (the November set behind `NEW_GAME_SOUNDS` in `src/config/soundConfig.ts`, or the library sound named),
so a file with the slot's name replaces it with no code change. Sounds the games already have and that work are
listed as **keep** and need nothing.

The house levels (docs/sound-cues/levels-nov-2026.md) are applied when a file is wired: generate at any level, short
effects with no lead-in silence.

<!-- Each game's section is between its own markers; per-game work edits only its own section. -->

<!-- gridlock:start -->
## Gridlock
<!-- gridlock:end -->

<!-- tessellate:start -->
## Tessellate

Look A: glossy lacquered blocks on a dark slab with brass studs. Today `turn` and `flip` share the generic UI select,
`place` a generic block pop and `solve` the shared pops; the four new slots play library stand-ins.

- `blockparty.turn` — a tray piece spun a quarter turn: a quick, light lacquered-wood spin with a crisp click at the end; snappy, satisfying; 120–180 ms.
- `blockparty.flip` — a tray piece flipped over: a short flick and a light clack as the block lands on its other face; 150–200 ms.
- `blockparty.pickup` — a piece lifted off the tray or board: a soft upward lift, a faint lacquer-on-felt slide with a small airy rise; gentle; 120–180 ms.
- `blockparty.place` — a piece dropped where it fits: a firm, solid snap of a lacquered block seating into a recessed board, one dense click with a short low body; confident; 120–200 ms.
- `blockparty.illegal` — a piece let go where it doesn't fit and sliding back to the tray: a dull, muted wooden thud followed by a short soft slide; not harsh, clearly "no"; 250–350 ms.
- `blockparty.undo` — Undo, the last move given back: a quick reversed lift, a soft click as the piece returns; light; 120–180 ms.
- `blockparty.reset` — Reset, every piece back to the tray: a short soft sweep of several blocks sliding together, ending in a light settle; 300–450 ms.
- `blockparty.solve` — the last gap filled: a bright, clean shine, a glassy shimmer rising across the board with a soft brass chime at the top; rewarding, not loud; 900–1,100 ms.
<!-- tessellate:end -->

<!-- pipeline:start -->
## Pipeline
<!-- pipeline:end -->

<!-- chroma:start -->
## Chroma Lines
<!-- chroma:end -->

<!-- skid:start -->
## Skid
<!-- skid:end -->

<!-- heave:start -->
## Heave
<!-- heave:end -->

<!-- lightbender:start -->
## Lightbender
<!-- lightbender:end -->

<!-- topsy:start -->
## Topsy-Turvy
<!-- topsy:end -->
