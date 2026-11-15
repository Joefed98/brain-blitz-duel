# Pattern overhaul: sounds for Joe to generate (ElevenLabs)

Phase 2 step 4 (15 Nov 2026). One line per sound: the slot it fills, what it is, the material, the feel and the
length. Generate each, name the file `<slot>.mp3` and drop it in `public/sounds/`; the slot already plays a
placeholder (the November set behind `NEW_GAME_SOUNDS` in `src/config/soundConfig.ts`, or the library sound named),
so a file with the slot's name replaces it with no code change. Sounds the games already have and that work are
listed as **keep** and need nothing.

The house levels (docs/sound-cues/levels-nov-2026.md) are applied when a file is wired: generate at any level, short
effects with no lead-in silence. Slots that borrow a library file until then (Gridlock's knock and glint, Chroma
Lines' draw, cut and near-miss) are repointed at the new file when it lands (one manifest line each).

<!-- Each game's section is between its own markers; per-game work edits only its own section. -->

<!-- gridlock:start -->
## Gridlock

Glossy painted toy cars on a dark lot. Every car sound is the same small, heavy die-cast toy on a smooth painted
floor: never a real engine, horn or tyre squeal.

- `unblock.slide` — a toy car pushed one or two bays: a short, smooth rubber-and-metal scrape across a painted lot
  floor, ending in a soft, dull bump as it stops; light, tidy, satisfying; 0.17 s. (Replaces `move.slide.mp3`, a
  generic 0.53 s slide that runs past the car's glide.)
- `unblock.slideLong` — the same toy car pushed three or more bays: the same scrape held a little longer with a
  slight rise in speed, the same soft bump on the stop; 0.25 s.
- `unblock.blocked` — a drag into the car (or kerb) in the way: a dull, muffled knock of a die-cast toy car against
  another, a tiny rattle, no ring; clearly "can't go", never harsh or buzzer-like; 0.12 s. (Today the library's
  wood knock stands in.)
- `unblock.laneClear` — the gold car's lane to the exit is open: a quick, bright metallic glint, one small sparkle
  running left to right like light along polished gold paint; airy, short, not a chime melody; 0.35 s.
- `unblock.solve` — **keep** (`pz_car_escape.mp3`, the gold car revving back and driving out).
- Undo and Reset: no new sound; they play `unblock.slide` (the car sliding back).
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
- `pipes.rotate` — a pipe tile turned a quarter, either way: a metallic ratchet, two quick pawl clicks on a hollow steel
  joint, dry and tight, no ring-out; 110–150 ms. (Today the November placeholder `pipes.rotate.mp3`, behind
  `NEW_GAME_SOUNDS`; silent with the switch off.)
- `pipes.flow` — water reaching newly joined pipes: a short gurgle through a metal pipe, a few bubbles running away
  from the listener, wet and clean; 200–300 ms for one to five pipes. (Today's file works; replace only if the new one
  matches the ratchet's material.)
- `pipes.combo` — six or more pipes joined by one turn: a longer, fuller gush through the pipework that rises a little
  in pitch as it runs, satisfying, still water in metal (no chime); 450–600 ms. (Placeholder: the library's `combo.mp3`.)
- `pipes.drain` — a turn that cuts pipes off the water: a falling drain note, water glugging away down a pipe, a soft
  downward gurgle ending in a hollow drip; 350–500 ms. (Placeholder: the library's `combo.lost.mp3`.)
- `pipes.solve` — keep: the water rush through the whole network (1,200 ms).
- `pipes.bubble` — the source valve bubbling as the solved network fills: three or four round bubbles welling up in a
  metal tank, gentle and cheerful, closing on a small pop; 400–550 ms. (Placeholder: the library's `arc_sea_bubble.mp3`.)
<!-- pipeline:end -->

<!-- chroma:start -->
## Chroma Lines
- `flow.draw` — the line grows one square: a single soft liquid "bloop", like a drop of thick paint pushed through a glass tube; round, warm, no click at the start; the game plays it a little higher with every square, so record it at a low-middle pitch; 120–150 ms.
- `flow.cut` — drawing over another colour cuts that line back: a quick soft snip of a rubber tube, wet and short, a little lower than the draw tone, never harsh; 150–200 ms.
- `flow.connect` — a pair joined (the one sound for it; today's file is a placeholder): a glass marble settling into a cup with a short liquid "plip" rising a fifth, satisfying and clean; 400–500 ms.
- `flow.nearMiss` — the board is one pair short (or every pair joined with squares empty): a gentle two-note hint, a soft glassy "almost", the second note left unresolved, quiet; 500–700 ms.
- `flow.solve` — every square filled: liquid colour rushing through every tube at once, then a bright glass-marble chime chord that blooms and fades; 1.0–1.2 s.
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
