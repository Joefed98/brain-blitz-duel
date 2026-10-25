# Polish batch W: Word and Number puzzles (25 Oct 2026)

Display only. No change to scoring, rules, timing, difficulty, seeds, hit areas, physics, server calls,
data, routes, storage keys or version stamps; `bun scripts/practice-stamps.ts` writes an identical
`practiceStamps.data.ts`. Every accessible name, test id and existing `data-*` attribute is kept (a few
`data-*` attributes are added). New looks apply to the live stage only; intros, demos and reveals keep
main's look unless noted.

Before / after (414 × 896, main beside this branch): `screenshots/polish-batch-w/<game>.png` and
`screenshots/polish-batch-w/overview.png`.

## Shared pieces (this batch only)

- `src/polish-layout/batch-w.css`: `.bw-summary` (the 18 px live summary line), `.bw-active` (a soft
  glow in the category colour), `.bw-lift` (light top edge and shadow over a piece's own colour).
- `src/components/puzzles/batchW/LiveSummary.tsx`: the summary line, drawn from the first paint at its
  fixed height so nothing moves when its text changes.
- One `src/polish-layout/batch-w-<game>.css` per game, imported only from that game's module and scoped
  to the game's root attribute.
- The frame toolkit is used as it is: `.gf-glass`, `.gf-glass-cat`, `.gf-well`, `rightMoveFlash`,
  `wrongMoveFlash`.

## Word

| Game | Changes | Live summary |
| --- | --- | --- |
| Nucleus | Atom tiles get a light top edge, gradient and shadow; tiles in the word glow; the orbit ring glows faintly; the word box is a well when empty, lifted when filled; right-move flash on an accepted word. | In the existing status line: "N letters · 4 needed", "N words · longest L letters" |
| Interlock | Tiles keep main's dark body with a light top edge and deeper shadow; empty cells are wells (faint category rim while a tile is picked up); the picked tile glows (its old ring was hidden under the shared tile shadow); right-move flash on a new word. | Replaces "PLACE ALL 15": "4 / 15 placed · 4 in words" |
| Slider | Tiles get depth; rows that read as words glow; padlocks are glass keys; right-move flash when a row becomes a word; the board's inner frame is softer so it does not double the tray. | "N / 5 words · N locked · Moves N" |
| Forage | Tiles get a light top edge and shadow; traced tiles and the trace line glow; Submit is a raised key; right-move flash on an accepted word's tiles. | In the status line: "N letters", "Best WORD · N pts" |
| Lookout | Cells get a light top edge; found words raised gold; the drag line glows; found chips lifted, open chips wells. "N of 6 found" moves to the goal line (`useGoalProgress`), the stage's own line is hidden in a live round. | None (the chips row already shows it) |
| Roundabout | The wheel grows into the free height (main 240 px → 340 px at 414 × 896; 197 → 223 px at 375 × 667), the crossword keeps its size; the wheel is a dome with glass letter discs; traced letters glow (on main the shared tile gradient hid the highlight); crossword cells are sunk wells with a clear rim, filled cells lifted; right-move flash on a word's cells. | None (the existing "n / N words" line) |
| Strikeout | The word row fills the tray width: tiles up to 64 px (main 52 px), 1.2 × as tall as wide (398 × 64 px at 414 × 896, main 341 × 45); hidden letters are wells, found letters glass, solved gold; keypad keys get an edge and shadow. | In the hint line once the word has a guess: "3 found · 2 missed · 4 to go" |
| Cryptogrid | Clue strip numbers 9 → 10 px, letters 14 → 16 px (paid for by the note line, 24 → 20 px); squares to decode are wells, decoded ones glass; the selected number glows; keypad sizes unchanged (still usable). | In the note line: "8 placed · 10 to go" |
| Swapword | A light top edge and shadow over the gold, teal and slate tiles; the picked tile glows; right-move flash on each tile that turns gold after a swap. | The colour key shows counts: "8 in place · 5 elsewhere · 8 neither" (fixed-width slots) |

## Number

| Game | Changes | Live summary |
| --- | --- | --- |
| Counterweight | "Scale n of N" in the goal line, the stage's own pip bar no longer drawn in the frame; the rack is a well, cups get a top edge and shadow, the picked weight glows. Tray: the board fills its height (656 px at 414 × 896, main 622), so the tray has no space above it (frame-probe +0 / +10, within the 24 px limit). The shots driver reads the stage from either place. | "Hangs 2 / 6 · 1 of 4 balanced · Weight 3 picked" (keeps `data-move-limit`) |
| Exact | The picked number and operator glow; used numbers sink into wells; a refused tap adds the shared red outline on the tile (no second sound). | Inside the board under the steps: "4 numbers left · 2 steps · Closest 460 · 2 away" |
| Operator | The caption drops "Equation n of N" in the frame (the goal line shows it); the next empty slot rims in the category colour; a full wrong set shakes and outlines the equation (`wrongMoveFlash`, same sound). | In the tries line's place inside the board: "Tries 1 / 3 · 2 of 4 slots · 1 of 4 right" |
| Tenfall | The shared arcade miss moment (faint red edge pulse, a puff) on its refused and reset moments, beside `tendrop.refused` / `tendrop.reset`. Drawn by Tenfall's own renderer (`drawTenDropLive`, a misses-only spec in `tenDrop.renderer.ts`), live round only; the sim is unchanged. | None (no dock) |
| Integer Pyramid | "Pyramid n of 4" removed in a live round (the goal line shows it); the picked stone glows in the category colour; stone rows get a deeper shadow. | In that row, left of Skip: "9 given · 1 placed · 5 to go" |
| Trail | "12 / 26" moves to the goal line; the trail's head glows; empty squares are deeper wells; milestones get a shadow; Undo / Reset are glass. Tray: the grid is main's size, tray +10 / +10. | "Next 13 · 14 to go" |
| Brimful | "Puzzle n of 3" dropped in the frame; the picked jug glows (solved jugs keep gold); jugs get a contact shadow; buttons glass. | Replaces the hint: "Tap a jug · 9 moves left", "Jug 2: 3 of 5 L · pour, Fill or Empty" |
| Checkout | Tabs, ring buttons and Undo / Throw get a top edge and shadow; the board in play glows round its label; palette unchanged. | On the chalk scoreboard: "2/3 darts" beside the remaining total |
| Ballpark | "Line n of 3" dropped in the frame (the goal line shows it); padding fix: Place's own 16 px bottom pad doubled the dock's, removed in a live round only (demos keep it); the number card is deeper; Place glows when ready. | "2 of 5 placed · touch the line" |

## Assumptions

- "Live round" means inside the frame's `GoalLineContext`; outside it every game looks as on main.
- Summaries restate only what the board already knows; where a game already had a status line, the
  summary lives in it (no new height). Operator and Exact draw theirs inside the board, so every board
  keeps at least main's size.
- No right/wrong flash was added where the game's feedback was already clear (Integer Pyramid has no
  live mistake to flag; Brimful, Checkout and Trail already shake or play their own cues).
- The Word batch 13 Oct coordinate demos: Roundabout's wheel and Strikeout's row moved. No demo
  recordings are in the repo; any in the database are on `WORD_BATCH_DEMOS`' revision (see Shared requests).

## Checks (run locally)

- Board size: `bun scripts/shots/frame-probe.ts <18 games> --compare=scripts/fixtures/board-sizes-main.json`: PASS
  (every board at least main's size, every tray within 24 px; Operator first failed by 18 px and was fixed
  by moving its summary inside the board).
- first-paint-check (the 18 games, practice, room and standalone late passes): PASS for all 17 puzzles.
  Tenfall, not in the check's own list (an arcade-stage game with no geometry hold), fails its standalone
  late pass when the insets arrive late; its layout code is unchanged (only the draw call), so main fails the same way.
- no-wrap-check "answer reveal": PASS.
- Game checks: codeword, letterwheel, strikeout, swapword, word-polish, word-game-tuning, wordsearch,
  wordsmith-variable, tile-grid-word-count, move-limits, number-batch, number-pyramid, trail, tendrop,
  arcade-fx: PASS. Typecheck: clean.

## Shared requests

- `styles.css` `.word-letter-tile` sets `box-shadow … !important`, which hides Tailwind rings and shadows
  on every word tile and beats the toolkit's `[data-move-flash]` glow; each batch-W file works round it
  with a stronger selector. A shared fix would let games use `ring-*` / `rightMoveFlash` directly.
- If intro demos exist in the database for Roundabout or Strikeout, bump their presentation revision in
  `src/components/puzzles/wordInput.ts` (`WORD_BATCH_DEMOS`) so coordinate touches on the moved wheel / row
  are not replayed; then re-record.
- Optional: give Tenfall an entry in `arcadeFxGames.renderer.ts` so arcade-fx-check covers its miss moment
  (today the spec lives in `tenDrop.renderer.ts`).
- Optional: add Counterweight to `GOAL_BAR_GAMES` so its "Scale n of N" gets the pip bar (needs the goal
  line's 28 px height, a shared change).
