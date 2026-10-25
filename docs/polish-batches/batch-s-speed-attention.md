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

| Game | Change |
| --- | --- |
| Flash | The screen is a lit glass panel (neutral rim light, top sheen, inner bevel, deep cast shadow; neutral greys only, so nothing can read as a cue). The readout is bigger (52–76 px) and glows in its own colour. New one-line live summary over the screen, from the times it already shows: "Flash 3 of 8 · best 266 ms" (the row already reserved 20 px, so nothing moves). |
| Ascend | The board gets the category's light from the top, a fine grid and a deep rim. Discs are glass domes (same 44 px footprint), done discs glow gold. A right tap gets the toolkit's right-move glow (the wrong tap already had the shared shake). |
| Bang On | The watch is bigger: 148 px tall (112 before), the vertical face 62 % wide (50 %), the diagonal one up to 360 px; a halo in the category colour, a brighter zone and a glowing marker; the result is 40 px and lit; recent results are glass cards. "Watch n of 10" moves into the goal line. A missed watch gets the shared wrong-move shake and red outline on the face (its sound unchanged). The whole stage is still the tap target and the marker runs the same fraction of the face. |
| Don't Break the Chain | Deeper charm shadows and a touch more colour, the board lit from the top, the counter glows. A correct link gets the right-move glow on the charm. |
| Bonk | Shared arcade miss effect (red edge pulse, puff over the hole) on every wrong-colour, hedgehog or empty tap, the moments that play `playWrong`, `whack.bomb`, `whack.emptyTap`. Meadow: a soft top light and a vignette; burrows: an occlusion band and a faint warm bounce inside each hole (baked once per size). |
| Pull! | Shared miss effect when a clay escapes (`clayshoot.escape`) or a shot startles a bird, with a puff where it happened; an empty shot keeps its own smoke puff. Richer sky: faint sun rays, flat high cirrus (seeded) and a warm horizon haze, baked with the scenery. |
| Mixed Signals | Shared miss effect (red edge pulse, a pixel crack on the gate) on a wrong sort (`stroop.wrong`). Lanes glow faintly in their gate's colour from the gate up, with lit rails (cached layers, under the word's neutral plate, so its ink is never tinted). |
| Eagle Eye | Cells lifted (highlight, inner shade, cast shadow); a marked cell keeps its gold and adds a soft glow in the category colour. The label drops "Grid n of 3" (the goal line shows the stage) and the row gains a live "n marked" count. |
| Double Take | Panel bevel and shadow, found rings glow more. "Picture n of 2" moves into the goal line. |
| Tally | Edges in the frame's tray: the field nests in the tray's corners (18 px radius) and loses the old shelf lip, whose second edge ran just above the tray's own; its 10 px goes back to the field. The question drops "n / 4 ·" (the goal line shows the stage). Glass keys, a sunk entry well, a lit Enter (sizes unchanged). |
| Labyrinth | Walls get a wide ambient shadow and a brighter top edge; the ball is glossy (radial gradient, specular dot, contact shadow, halo); the exit star has a gradient and a pulsing halo inside its cell (still under reduced motion). |
| Matchmaker | Cards bigger: the board may run to 400 px (340 before) on a live round. Backs with a lit bevel and deeper shadow, faces glass, matched pairs glow brighter in gold. A match gets the right-move glow on the card, a miss the shared wrong-move shake and outline on the card (in place of the whole board, same sounds). The pairs count moves to the goal line ("3 of 15 pairs"); the line above the dock shows the flips. |

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
- Flash's summary counts the flash being waited for ("Flash 3 of 8") from the stored flash list the stage
  already holds.

## Checks run (all locally, against this branch)

- tap-mapping-check, whack-check, clay-check, colour-clash-queue-check, colour-clash-spawn-check,
  speed-oct14-check, careless-play-check, tap-log-check, attention-rework-check, attention-pattern-check,
  chain-cycles-check, nonogram-pair-flood-check, puzzle-surface-check, presentation-geometry-check,
  polish-a-check, move-limits-check, arcade-fx-check, reveal-score-check, sound-manifest-check,
  play-control-clearance-check: pass.
- first-paint-check for the nine puzzles (practice, room, standalone late): pass.
- `frame-probe.ts --compare=scripts/fixtures/board-sizes-main.json` for the nine puzzles: pass (every board
  at least main's size; Flash, Ascend, Bang On, Chain, Double Take at 375, Tally and Matchmaker larger).
- no-wrap-check: pass. bottom-clearance-check for all twelve: pass.
- arcade-play-check for whack, clayshoot, stroop: pass. arcade-fill-check whack, clayshoot: pass (stroop has no
  screen fill on main either; the check's own list leaves it out). intro-demo-check: pass.
- `bun scripts/practice-stamps.ts`: no change.

## Shared requests

- `boardBox`/the frame tray: Tally's field runs to the screen's sides (main's width, kept by the board-size
  rule), so its tray has no side margin; a frame option to keep 4 px of tray outside a full-width board
  would finish its edges.
- `GoalLine` draws an empty progress span when a game publishes "" (Double Take's old single-picture rounds);
  hiding the span for empty text would be tidier.
- The toolkit's `.gf-glass` / `.gf-well` could take a scoping hook on shared widgets (NumberEntry's keys and
  input, ArrowPad) so games can opt in without restating the values.
- Ascend's goal line reads "Tap 1 to 24 in order" while its discs are two-digit numbers in ascending
  order (`frameGoal`); worth a look.
- Mixed Signals has no screen fill (`arenaFills.renderer.ts`); its gaps are plain black.
