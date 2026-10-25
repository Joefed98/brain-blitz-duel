# Polish batch P: Pattern and Logic (25 Oct 2026)

Display only. 21 games: Pattern (Gridlock, Tessellate, Pipeline, Chroma Lines, Skid, Heave, Lightbender,
Topsy-Turvy, Jumbled, Turntable) and Logic (Blackout, Box Six, Hanoi, Polypotions, Safe Cracker, Bomb
Defusal, Mosaic, Colour Flood, Tents and Trees, Shikaku, Lamplighter). Built on #139's frame, tray and
toolkit; "same game, enhanced" (docs/design-system.md, "Game screens").

No rule, score, timing, seed, server call, stored data, route, storage key or version stamp changed: every
change reads what the stage already computes and paints it. `bun scripts/practice-stamps.ts` shows no change.

## Where it lives

| File | What |
| --- | --- |
| `src/components/puzzles/batchP/LiveSummary.tsx` | `useInFrame`, `useFrameProgress` (the goal line's progress, through the frame's own `useGoalProgress`), `LiveSummary` and `SummaryItem` (the one-line summary) |
| `src/polish-batch-p/batch-p.css` | every look in this batch, one section per game, imported only by `LiveSummary.tsx` (so only by these games) |
| The games' own files | `src/puzzles/<game>.tsx`, `UnblockPuzzle.tsx`, `BlockPartyPuzzle.tsx`, `pattern/flowArt.tsx`, `pattern/iceSlideBoard.tsx`, `pattern/tilesBoard.tsx` |

Every CSS rule is scoped to the live round (`[data-puzzle-play]`, doubled so it outranks the games' rules in
styles.css whichever order the bundler emits the two sheets), so intros, intro demos, reveals and replays draw
exactly as before.

## The HUD, the goal line and the summary

Inside the frame (a live round: practice, rooms, the daily, challenges) the game's own HUD row is not drawn.
Its progress figure moves to the goal line's right (`useFrameProgress`, published before the first paint, so it
is there from the first frame) and its counts to one 20 px summary line just above the dock (`LiveSummary`:
13 px, 600, #A09DA6 labels, figures in #F3F1EC tabular, items joined by a category-coloured dot; one line, never
wraps; its height is fixed, so nothing moves when a figure changes; a figure over its limit turns warn red).
Outside the frame (intros, demos, server-rendered checks) the old HUD is drawn as before, so `data-move-limit`
counters and demo layouts are unchanged.

The Logic games' status line sat inside their arena, above the board, and is part of the board's box. Their
summary takes its place inside the arena, under the board (`inArena`, the same 20 px `.logic-status` height), so
the board and the tray keep main's size exactly.

Figures are from the intro example mid-play at 414 × 896.

| Game | Goal line (right) | Summary above the dock |
| --- | --- | --- |
| Gridlock | none (the HUD's "get the gold block out" repeated the goal) | Moves |
| Tessellate | "12 / 40 covered" | none (the piece tray is the dock; it gains the HUD's height) |
| Pipeline | "3 / 49 connected" | none |
| Chroma Lines | "6 / 12 pairs" | Filled 31 / 77 |
| Skid | none | Moves · falls (warn) |
| Heave | "0 / 4 home" | Pushes · Moves |
| Lightbender | none | Mirrors 4 / 8 · Splitter 1 / 1 · Gems lit 0 / 6 |
| Topsy-Turvy | "0 / 4 locked" | Tilts 6 / 20 (warn when out) |
| Jumbled | "1 / 9 in place" | Moves |
| Turntable | "0 / 8 spokes" | Ring 1 selected · Turns |
| Blackout | "10 still on" | Presses |
| Box Six | "25 / 36 filled" | none (the keypad is the dock) |
| Hanoi | "3 / 9 on gold" | Moves |
| Polypotions | "1 / 8 corked" | Pours 12 / 30 (or Moves on unlimited rounds) |
| Safe Cracker | none | none ("tries left" stays on the door, where it was) |
| Bomb Defusal | "3 / 6 steps" (the goal is "Defuse the bomb in six steps"; the dock's steps count is gone) | none |
| Mosaic | "5 / 14 lines" (rows and columns matching their clues) | none |
| Colour Flood | "108 / 196 flooded" | Moves 6 / 14 · Par 12 |
| Tents and Trees | "5 / 11 tents" | Grass marked |
| Shikaku | "55 / 100 covered" | Rectangles 9 / 18 |
| Lamplighter | "38 / 62 lit" | Lamps · Dots |

## Per game

- **Gridlock**: the gold block glows softly gold; a lifted car glows brighter; the lot sits deeper in the tray.
- **Tessellate**: tray pieces cast a soft shadow (and are bigger, from the HUD row's height); the board deeper.
- **Pipeline**: pipes in the network glow with their water; the turned tile that lets more water on flashes the
  toolkit's right-move ring (it had no per-move feedback).
- **Chroma Lines**: a joined colour glows in its own hue (a halo path drawn under the tube in flowArt, live round
  only); open slots are wells.
- **Skid**: the white ice joins the dark app: cool blue-grey ice (the same sheet gradient, sheen and scratches,
  recoloured through classes on its SVG stops), pale highlights, dark stone rocks with a thin frost cap and a real
  shadow, darker thin ice with pale cracks, the ball with a faint glow so it reads on the darker ice.
- **Heave**: a crate on its mark glows warm gold.
- **Lightbender**: a mirror's cell glows faintly gold; lit gems glow.
- **Topsy-Turvy**: balls cast a shadow; a ball locked in its cup glows in its colour.
- **Jumbled**: bigger tiles (the board takes the column's whole width; main kept 16 px back); tiles in their solved
  cell glow in their own colour; a tile slid home flashes the right-move ring; an illegal tap shakes that tile
  (the board shook before); the gap is a deep well.
- **Turntable**: the deck stands off the tray with a long shadow; the selected ring's marker glows.
- **Blackout**: lit bulbs glow warmly in their sockets; unlit ones are darker.
- **Box Six**: given digits gold with a soft glow, crisp light box lines and finer cell lines, the selected cell
  glowing from inside; the keypad keys are toolkit glass. Your own entries were gold on main; with the givens now
  gold they take the category colour (a light teal), so the two still read apart.
- **Hanoi**: rings up to 26 px thick (16 px on main) and posts to match, using the tray's height; rings on the gold
  post glow; the lifted ring glows brighter.
- **Polypotions**: flasks cast a shadow; a corked (finished) flask glows in the category colour.
- **Safe Cracker**: bigger brass drums (up to 70 × 88 px, from 58 × 72), a deeper bevel and shadow; the arrow keys
  lift off the door.
- **Bomb Defusal**: wires with a cast shadow and brighter highlight, domed buttons with a rim and drop shadow, the
  casing deeper; the rules card lifted, its text kept at 14 px on 1.5 (readability.css) in brighter ink.
- **Mosaic**: filled tiles glow faintly; empty tiles are wells.
- **Colour Flood**: the same five colours a step deeper and less bright (the paint pots take the same values), the
  flooded region's white wash halved, darker colour edges and an inner shade for depth; tapping the colour already
  in use shakes that pot (it did nothing before).
- **Tents and Trees**: pitched tents glow softly gold; grass squares are wells.
- **Shikaku**: gold panes glow faintly; unclaimed squares are wells.
- **Lamplighter**: lit squares glow warmer; unlit floor squares sit darker.

## Assumptions

- "Move the HUD into the goal line": the goal line takes the HUD's progress figure; the HUD's other counts go to
  the summary, so nothing shows twice. Where a game had no progress figure (Gridlock, Skid, Lightbender) the goal
  line's right stays empty.
- Par is shown only where it is public on the phone (Colour Flood). Jumbled's, Gridlock's and the other minimums
  are server-only (`secrets.ts`), so their summaries have no par.
- Hanoi's rings and Safe Cracker's drums grow as asked; Safe Cracker's drum is also its swipe target, so the swipe
  area grows with it (the arrow keys are unchanged). Nothing else changes a hit box.
- Right- and wrong-move flashes were added only where a move had no answer of its own (Pipeline's turns, Jumbled's
  tile home and illegal tap, Colour Flood's no-op tap). The wrong flash plays the existing `shared.reject` cue.
- Reduced motion: the new glows do not move; the flashes are the toolkit's (shorter glow, no shake).

## Shared requests

- `frame-probe` reported `tents 414x896: no board measured` on unchanged main as well (the board had not mounted
  when it measured); a longer wait in the probe for a board would remove the false failure.
- The summary line is batch-local (`LiveSummary`); if other batches add the same line, it could move to the
  toolkit as one shared component.
