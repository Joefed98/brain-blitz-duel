# Three new rounds: Word Hunt, Unblock, Block Party

Adds three puzzle types through the existing registry, plus one shared drag-and-snap
building block the two grid games share. No other round type, scoring formula, or
shared screen changes.

| Round | Category | Clock |
| --- | --- | --- |
| Word Hunt | word | 60 s |
| Unblock | pattern | 90 s |
| Block Party | pattern | 90 s |

## Shared drag system

One reusable pointer-events component (works with finger and mouse):
the dragged piece lifts slightly with a soft shadow so it stays visible above the
finger, a ghost outline shows where it will land, legal drops snap with the
existing 150 ms pop, illegal drops shake gently and return the piece. Short
haptic tick on a legal snap. Honours reduced-motion settings.

## 1. Word Hunt

4x4 letter grid. Drag a path through touching tiles (diagonals count, each tile
once), release to submit. Gold path line, each tile lights as it joins, haptic
tick per letter. Words of four letters or more, checked against the same
server-side dictionary and blocklist Wordsmith uses; repeats don't count twice.

- Boards are built on the server at room start: two or three real 6–8 letter
  words are laid as snaking paths, remaining cells filled with letters weighted
  by English frequency (at most one Q, played as "Qu"), then the whole board is
  solved and only boards with 40+ findable words are kept.
- Stored privately: the full word list, per-word points, board total.
- Scoring matches Wordsmith exactly (4 letters = 1 … 8+ = 11; score =
  min(150, round(150 x points / par)), par = 35% of the board total). The device
  sends each word with the path it traced; the server re-walks every path for
  adjacency and reuse and re-checks every word before scoring.
- Screen: full-width grid, running points counter, found words scrolling below
  with their points, green flash for a good word and red for invalid or repeat,
  no hint of how many remain, Done button.
- Fixed intro, reveal (your words and points, total vs par, five best missed
  words drawn on a small grid), summary line "9 words · 18 pts".

## 2. Unblock

6x6 grid, gold 1x2 car on row 3 must reach the gold exit gap on the right. Grey
cars (1x2) and lorries (1x3) slide only along their own axis, never through each
other or off the grid; a drag that would pass through another vehicle stops at
the obstacle. Reaching the exit slides the car out and auto-locks the round.

- A committed bank of 120+ layouts, each verified solvable by a solver that
  records the true minimum move count, tagged by depth: 40 at 6–8 moves, 40 at
  9–12, 40 at 13–18. The bank is produced once by a build-time script and stored
  as static data — never generated during a round. A round draws one at random
  and stores it, so every player in the room gets the same layout.
- Scoring (this type only): solved = 100 + round(50 x remaining / 90000), plus a
  flat +20 when solved in the minimum number of moves, capped at 150. Not
  solved = 0. Moves used and the minimum are recorded on the round. The device
  sends its moves; the server replays them on the stored layout to verify.
- Screen: grid in the upper 60% with the exit clearly gold, monospace move
  counter, Undo and Reset.
- Fixed intro, reveal (minimum solution played back as a 3-second animation,
  your moves vs the minimum, tick or cross), summary
  "Solved · 9 moves (min 8) · 41.2s" or "Not solved".

## 3. Block Party

6x6 grid, seven blocker pegs, nine tray pieces totalling 29 cells — exactly the
free squares. Drag pieces in, tap a tray piece to rotate, double-tap to flip.
No overlapping pegs or other pieces; placed pieces can be dragged back to the
tray. Covering all 29 cells auto-locks the round with the LOCKED stamp.

- Server picks seven peg cells, a solver confirms at least one solution and
  counts them (capped at 200), and only layouts with 5–60 solutions are used so
  rounds land in a consistent middle difficulty. The pegs and one solution are
  stored, the solution privately. Pegs drawn as small gold-outlined dots.
- Scoring (this type only): solved = 100 + round(50 x remaining / 90000);
  otherwise round(60 x covered / 29) for legally placed pieces. The device sends
  placements; the server verifies legality and coverage.
- Screen: grid in the top ~55%, tray below with all nine pieces visible at
  reduced scale in five soft palette colours, placed pieces full size,
  monospace "covered / 29" counter.
- Fixed intro, reveal (stored solution beside your board), summary
  "Solved · 52.8s" or "24 / 29".

## Technical notes

- New modules follow the current split exactly: `src/puzzles/<type>.tsx` renders
  and collects input only; generation, path/move/placement verification and
  scoring live in server-only files (`wordHunt.server.ts`, `unblock.server.ts`,
  `blockParty.server.ts`) reached through `generate.server.ts`, with answer
  fields listed in `secrets.ts` so they stay in `duel_secrets`.
- Word Hunt reuses `dictionary.server.ts` (`isWord`, blocklist) and Wordsmith's
  point table; scoring for the two new pattern types is added to `scoring.ts`
  without touching existing formulas.
- New types, constants and data shapes go in `src/lib/duel/types.ts`; registry,
  `roundSummaries.ts` and `grade.ts` gain one entry each. No database schema
  change — move counts and coverage ride in the existing `extra` column.
- The Unblock bank ships as a generated static data file; the generator script
  is kept in the repo so the bank can be regenerated.

## Checks before finishing

In practice mode: Word Hunt boards always reach 40+ words and the path draws
smoothly under a finger; Unblock layouts solve in the stated minimum and
vehicles never pass through each other; Block Party layouts always have a
solution and auto-lock on completion; every drag works with a finger at 390px
wide; each type gives a sensible summary and reveal. Then a three-device room
to confirm everyone sees the same board, layout and pegs.
