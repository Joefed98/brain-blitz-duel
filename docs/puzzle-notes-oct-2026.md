# Joe's puzzle notes, 28 Oct 2026

Five notes from Joe's iPhone 11 tests (414×896, also 375×667), on main after the puzzle scoring standard
(`docs/scoring-standard.md`). Two change play, each on a new stamp one above the standard's; three are look only.
The scoring formulas are the standard's, unchanged. Code: `src/lib/duel/puzzleNotes.ts`; check:
`scripts/puzzle-notes-check.ts` (~5 s); review frames: `bun scripts/shots/puzzle-notes-shots.ts --url=<origin>
--tag=before|after` (`screenshots/puzzle-notes-oct-2026/`, main on the left, this branch on the right).

| Game | Note | Change | Stamp |
| --- | --- | --- | --- |
| Slider | With four words locked, let the last row's tiles move between slots | Tap a tile in the last row (it lifts, gold ring), then another: the two swap. Swipes still turn the row. Each swap is a move (Undo takes it back, par counts it). | `wordSlideRev 4` |
| Strikeout | Solved words higher, centred between the top bar and the tiles | The solved-word chips float centred in the space between the word-dots row and the tiles; the tiles keep their place and the board tray now hugs only the tiles. | look only |
| Integer Pyramid | A completed pyramid's tiles turn gold from the bottom up during "correct" | Every completed pyramid (the 1 s CORRECT hold, and the final one's finish) tints its stones gold row by row, bottom first, 110 ms a row; reduced motion: gold at once. | look only |
| Flash | Don't show the number of flashes top left | The summary line shows only "Best 241 ms" (or the steady-hand "Steady 38 ms"); "Flash 3 of 8" and "All 8 flashes" are gone. | look only |
| Tally | Vary the second tray's question | Tray 2 asks one of three kinds, seeded on the server (so the same in a room): a colour and a shape ("How many pink circles?"), a shape alone ("How many triangles?") or a colour alone ("How many pink shapes?"). | `countRev 6` |

## Rules kept

- **Older rounds replay and score as before.** Slider swap tokens (`S13`) are ignored below `wordSlideRev 4`
  (puzzle-notes-check grades every older stamp with and without them, identically). Tally trays without `ask` count
  the colour and the shape together exactly as before (`countUpCounts` / `countUpStageTruth` in `attentionRev.ts`).
- **Server is the arbiter.** On `wordSlideRev 4` the server applies a swap only when exactly four rows are locked and
  every locked row is a word in its dictionary (`replayWordSlideFor`); the phone only lets word rows lock, so an honest
  log replays the same on both (proved). A log that locks non-words to open swaps gets nothing from them.
- **Rooms identical.** Tally's question kind is drawn on the server from the room's seeded generation and stored with
  the tray; the stored count still equals the scene's truth.
- **Dealing.** `dealPuzzleNotes` moves a puzzle up only when it carries the standard's stamp, so any check pinning an
  earlier world keeps what it pinned; `pinPrePuzzleNotes(true)` keeps the standard's stamps (standard-word-check and
  standard-attention-check, written for them, now pin it).
- **Help text.** Slider's How to play adds "Four words locked? Tap two tiles in the last row to swap them; each swap is
  a move." Tally's reads "Read the question: a shape, a colour, or both." Practice stamps regenerated
  (`bun scripts/practice-stamps.ts`): new bests start fresh for Slider and Tally.

## Assumptions

- **Slider:** a swap is an ordinary move (counts towards moves and par; Undo/Reset as usual). Swipes on the last row
  still turn it, so nothing already possible was taken away. No desktop key for swaps (mouse clicks work as taps).
- **Tally:** the three kinds are equally likely; "both" keeps exactly the tray countRev 5 deals. The shape-only and
  colour-only trays use tray 2's size (80 shapes) and count range (5–17), with a near-miss population (another shape,
  or a colour that is never a look-alike) and no look-alike fillers for a colour question.
- **Integer Pyramid:** gold on every completed pyramid, not only the last (the "correct" moment shows on pyramids 1–3;
  the last goes straight to the finish).
- **Intro demos:** each plays its own stored puzzle, so none is stopped; they show the older rules until re-recorded.
