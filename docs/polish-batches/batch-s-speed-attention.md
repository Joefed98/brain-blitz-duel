# Polish batch S: Speed and Attention (25 Oct 2026)

Display only, on top of Polish 2's game frame (#139). Twelve games: Flash, Ascend, Bang On, Don't Break the
Chain, Bonk, Pull! (Speed); Mixed Signals, Eagle Eye, Double Take, Tally, Labyrinth, Matchmaker (Attention).
Nothing here changes scoring, rules, timing, difficulty, seeds, hitboxes, physics, server calls, data,
routes, storage keys or version stamps (`bun scripts/practice-stamps.ts` writes no change). Every
accessible name and test id is kept.

Before and after: `screenshots/before-after/<game>.png` (414 × 896, full size) and
`screenshots/polish-batch-s/overview.png`.

## Where it lives

- `src/polish-speed/batch-s.css`, imported at the end of `src/polish-speed/index.css` (that folder holds only
  these twelve games' styles). Every rule that changes a size is scoped to a live round's frame
  (`[data-puzzle-play]`), so intros, intro demos and reveals keep their layout and every recorded demo
  touch lands where it did (intro-demo-check).
- Each game's own module (`src/puzzles/<game>.tsx`) and the three engine-game renderers
  (`whack.renderer.ts`, `clayShoot.renderer.ts` + `clayShootArt.renderer.ts`, `colourClash.renderer.ts`).
- Toolkit used as is: `rightMoveFlash`, `wrongMoveFlash`, `useGoalProgress`, `GoalLineContext`, the shared
  arcade layer (`arcadeFx`). Glass, well and glow looks are the toolkit's values written into the batch
  file (the elements are the games' own, so the classes could not be added without touching shared widgets).

## Per game

Second pass (25 Oct 2026, after review: "the difference should be obvious at a glance on a phone"). The look rules
now applied to every piece: a light top edge, a body about 15-20 % lighter at the top than the bottom, a soft drop
shadow; empty cells sunk; active, marked, found or correct items glow 8-14 px; flat boards get a low gradient in
the category colour and an inner edge shadow; spare height is used. Everything from the first pass stays.

| Game | Change |
| --- | --- |
| Flash | The screen is a lit glass panel in a glowing frame: inside, neutral greys only (a surface lit from the top, a bevelled inner frame, a faint sensor reticle of three rings and a crosshair), so nothing can read as a cue; outside, a soft frame glow in the category colour. The readout is bigger (54-80 px) and glows in its own colour. A one-line live summary over the screen, from the times it already shows: "Flash 3 of 8 · best 266 ms" (the row already reserved 20 px, so nothing moves). |
| Ascend | The board is a lit surface in the category colour (light from the top, a fine grid, a deep inner edge, a soft halo). Discs are glass domes (same 44 px footprint) with a bright top edge, a body clearly lighter at the top and a drop shadow; done discs glow gold, a wrong one red. A right tap gets the toolkit's right-move glow. The goal line reads "Tap the numbers lowest to highest" (it said "Tap 1 to 24 in order"; the discs are two-digit numbers). |
| Bang On | The watch uses the height: the face grows with the screen, 148 px at least (112 before) up to 270 px (30 % of the screen; 269 px at 414 × 896, 200 px at 375 × 667); the vertical face 62 % wide (50 %), the diagonal one up to 380 px. The dial is lit from the top in a bezel with a halo in the category colour; the gold zone is lit with a bloom, the marker glows. The result is 48 px and lit; the recent results are 84 px glass cards. "Watch n of 10" moves into the goal line. A missed watch gets the shared wrong-move shake and red outline on the face (its sound unchanged). The whole stage is still the tap target and the marker runs the same fraction of the face. |
| Don't Break the Chain | Every charm glows in its own colour (8 px) over a drop shadow; the counter is bigger (38 px) and glows gold, as does the chain strip. The board is a lit surface in the category colour with a deep inner edge. A correct link gets the right-move glow on the charm. |
| Bonk | Shared arcade miss effect (red edge pulse, puff over the hole) on every wrong-colour, hedgehog or empty tap, the moments that play `playWrong`, `whack.bomb`, `whack.emptyTap`. Burrows lit: a mound gradient with more contrast, a bright top rim and a brighter front lip, a cast shadow, an occlusion band and a faint warm bounce inside. A warm light rises in the burrow behind every popped target (the same for every kind, so it never tells which to tap) and a gold glow fills the cell under the hit ring. The meadow: a soft central light and a vignette (both away from the board's edges, so the scene meets it without a seam). |
| Pull! | Shared miss effect when a clay escapes (`clayshoot.escape`) or a shot startles a bird, with a puff where it happened; an empty shot keeps its own smoke puff. Richer sky: faint sun rays, flat high cirrus (seeded) and a warm horizon haze, baked with the scenery. |
| Mixed Signals | Shared miss effect (red edge pulse, a pixel crack on the gate) on a wrong sort (`stroop.wrong`). Lanes glow in their gate's colour from the gate up with lit rails; gates glow (a doubled halo, a stronger wash) with a body lit from the top and a bright top edge; the selected lane is brighter. The falling word's plate is lifted (a neutral halo and drop shadow, a body lit from the top), so its ink is never tinted. New screen fill (`stroopFill` in arenaFills.renderer.ts): the night board runs on under the arrows, its dot grid lifting from the board's black to a soft indigo glow. |
| Eagle Eye | Cells are sky tiles lit from the top (a bright top edge, a body ~20 % lighter at the top), with a drop shadow and a border in the category colour; the gaps show a lit surface in the category colour. A marked cell keeps its gold and glows 12 px. The label drops "Grid n of 3" (the goal line shows the stage) and the row gains a live "n marked" count. |
| Double Take | The pictures lit: a light from the top over both panels (an overlay, pointer-events none), an inner edge shadow, a frame in the category colour with a soft glow, the art a little brighter and more saturated; found rings glow 9 px. "Picture n of 2" moves into the goal line. |
| Tally | Edges in the frame's tray: the field nests in the tray's corners (18 px radius) and loses the old shelf lip, whose second edge ran just above the tray's own; its 10 px goes back to the field. The field is a lit surface in the category colour with a deep inner edge; shapes get a deeper drop shadow and a little more light. The question drops "n / 4 ·" (the goal line shows the stage). Keys lit from the top, a sunk entry well, a glowing Enter (sizes unchanged). |
| Labyrinth | A bigger maze: on a live round the arena takes the spare height (up to 132 % of its width) and the maze grows into it with taller cells (`k`, measured before the first paint; 406 × 536 at 414 × 896, 367 × 453 at 375 × 667; was 406 × 406 and 367 × 367). Touches map through the board's own box, so every cell answers as before; circles stay round. The board is a stone slab lit from the top with a glow in the category colour. Walls have a wide ambient shadow and a brighter top edge; the ball is glossy (gradient, specular dot, contact shadow, halo); the exit star has a gradient and a pulsing halo (still under reduced motion). |
| Matchmaker | Bigger cards: the board may run to 400 px (340 before) and on a tall screen (780 px or more) the cards are taller than wide, like playing cards (400 × 412 at 414 × 896, was 382 × 317). The board sits on a lit surface in the category colour. Backs and faces are lit from the top over a drop shadow; matched pairs glow 13 px in gold. A match gets the right-move glow on the card, a miss the shared wrong-move shake and outline on the card (in place of the whole board, same sounds). The pairs count moves into the goal line ("3 of 15 pairs"); the line above the dock shows the flips. |

## Assumptions

- Batch-wide CSS is `src/polish-speed/batch-s.css`, imported from `src/polish-speed/index.css`: that folder and
  index already belong only to these twelve games. A CSS import from the game modules could be missing from
  the server-rendered page's styles on a reload and flash unstyled, breaking "nothing moves after first paint".
- Selected and matched pieces keep their own gold (the games' palette); the category colour is added as a
  soft outer glow (Eagle Eye) or a halo (Bang On, Ascend's board, Chain's board).
- Mixed Signals' miss effect uses the shared layer's Retro look (a pixel crack) on its dark neon board;
  Bonk and Pull! use the Realworld look (a smoke puff).
- Bonk, Pull! and Mixed Signals pass misses only to the shared layer (no success events), so their own
  success art is unchanged.
- Labyrinth's taller cells and Matchmaker's taller cards are "boards may only get bigger": the maze, the cards
  and every touch target only grow, and the cells keep answering the same touches (the board's own box).
- Flash keeps neutral greys inside the screen (the cue must stay unambiguous); its atmosphere is a reticle and
  light, and the category colour glows only round the frame.
- Flash's summary counts the flash being waited for ("Flash 3 of 8") from the stored flash list the stage
  already holds.

## Shared files changed (on request, second pass)

- `src/components/duel/GameFrame.tsx`: one entry in `SHORT_GOALS` (Ascend's goal text).
- `src/lib/arcade/arenaFills.renderer.ts`: a new `stroopFill`, used only by Mixed Signals.
- `src/lib/arcade/arenaScene.renderer.ts`: `stroop` added to `ARENA_SCENE_GAMES` (arcade-play-check refuses a scene
  on a game not in the list); `scripts/presentation-geometry-check.tsx` gains its stage file and scene note, and
  rewrites `docs/arena-sizes-oct-2026.md` with its row.
- `scripts/arcade-fill-check.ts`: `stroop` added to its default list (it was left out only because it had no fill).

## Checks run (all locally, against this branch, second pass)

- tap-mapping-check, whack-check, clay-check, colour-clash-queue-check, colour-clash-spawn-check,
  speed-oct14-check, careless-play-check, tap-log-check, attention-rework-check, attention-pattern-check,
  chain-cycles-check, nonogram-pair-flood-check, puzzle-surface-check, presentation-geometry-check,
  polish-a-check, move-limits-check, arcade-fx-check, reveal-score-check, sound-manifest-check,
  play-control-clearance-check: pass.
- first-paint-check for the nine puzzles (practice, room, standalone late): pass.
- `frame-probe.ts --compare=scripts/fixtures/board-sizes-main.json` for the nine puzzles: pass (every board at
  least main's size; Bang On, Labyrinth, Matchmaker, Tally, Flash, Ascend, Chain and Double Take larger).
- arcade-play-check for whack, clayshoot, stroop: pass. arcade-fill-check for whack, clayshoot, stroop: pass.
- bottom-clearance-check for all twelve, arcade-device-bottom-check for whack, clayshoot, stroop,
  safe-area-screens-check, no-wrap-check, intro-demo-check: pass.
- `scripts/arcade-input-identity-proof.ts stroop` (a proof, not in CI): touches below the board record nothing,
  but it reports FAIL because Mixed Signals' band between the board and its arrows is 11 px at 390 × 844 and the
  proof needs more than 20 px to tap in.
- `bun scripts/practice-stamps.ts`: no change. `bun.lock`: unchanged.

## Shared requests

- `boardBox`/the frame tray: Tally's field runs to the screen's sides (main's width, kept by the board-size
  rule), so its tray has no side margin; a frame option to keep 4 px of tray outside a full-width board
  would finish its edges.
- `GoalLine` draws an empty progress span when a game publishes "" (Double Take's old single-picture rounds);
  hiding the span for empty text would be tidier.
- The toolkit's `.gf-glass` / `.gf-well` could take a scoping hook on shared widgets (NumberEntry's keys and
  input, ArrowPad) so games can opt in without restating the values.
- CLAUDE.md's "Screen fill-ins" paragraph still says arcade-fill-check covers "the 22 active arcade games plus Pull!
  and Bonk"; it now covers Mixed Signals too (CLAUDE.md is not this batch's to edit).
