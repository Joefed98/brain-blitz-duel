# Puzzle batch, 3 Nov 2026

Joe's puzzle batch: three renames, a new way to play Regions, Undo and Reset on the new grid puzzles, and no more
collectibles on Labyrinth, Topsy-Turvy and Skid. Joe tests on an iPhone 11 (414×896); the checks also cover 375×667 and
the computer layout. Screenshots: `screenshots/puzzle-batch-nov-2026/`.

## 1. Regions (was Fillomino; `fillomino`)

Display name only: the id, the answer encoding, `fillominoRev 1` and the grading are unchanged (no new stamp).

- **Number first.** A pad of 1–9 and an eraser under the board. Tap a number to select it (it stays selected until
  another is picked); then tap or drag across squares to fill them with it. Tapping a square that already holds the
  selected number clears it (a drag that starts on one clears the squares it crosses that hold it). The eraser clears
  squares the same way. The old tap-a-square-then-a-number flow is gone. Givens never change.
- **Finished-size tint.** A connected group of one number with exactly that many squares is tinted softly; touching
  tinted regions always get different shades from a calm palette that reads on the dark glass. The tint only says
  "right size", never "correct"; groups past their number still show red.
- **Undo and Reset** in the actions row under the pad, as the other puzzles have them (a whole drag is one Undo step).

## 2. Island Link (was Bridges; `bridges`) and Loopline (was Fences; `fences`)

Display names only. Each gets Undo and Reset at the bottom of the play screen, the same buttons and placement as the
other puzzles (`data-game-controls="actions"`); a drag that changes several edges or bridges is one Undo step. No
scoring change, no new stamp.

## 3–4. Labyrinth, Topsy-Turvy and Skid without collectibles (`src/lib/duel/parMoves.ts`)

Each game moves up one stamp above the scoring standard's: Labyrinth `mazeRev 4`, Topsy-Turvy `gravityRev 6`, Skid
`slideRev 3`. The deal is the standard stamp's board with its collectibles taken off (Labyrinth's stars, Topsy-Turvy's
stars, Skid's ice gems); Topsy-Turvy's stored routes become each board's shortest without stars (the reveal shows
them; their lengths are the par). Older rounds keep their stamps and graders and score exactly as before.

| | Finish | Speed (full by) | Par moves (full at par or under, 0 at twice par) | Unfinished |
| --- | --- | --- | --- | --- |
| Labyrinth | 150 | 30 (40 s) | 20: every step of the trail, steps back included, against the route's length | unchanged (route share + early, wandering costs) |
| Topsy-Turvy | 150 | 30 (80 s) | 20: tilts against the boards' fewest tilts added up | unchanged (balls home, wasted tilts cost) |
| Skid | 150 | 30 (60 s) | 20: slides (an undone slide still counts) against the fewest slides | unchanged (route closed, wasted slides cost) |

Before → after (the standard stamps): Labyrinth was 150 + 20 speed + 30 stars; Topsy-Turvy 150 + 30 speed + 15 stars
+ 5 par tilts; Skid 150 + 30 speed + 20 ice gems. Par is not shown on the board (Labyrinth's route length, Topsy-Turvy's
and Skid's fewest moves stay server-side, as Topsy-Turvy's par always has); the reveal and the round results show the
moves against par.

### Medians, weak → flawless, before → after

`bun scripts/puzzle-batch-nov-check.ts` (8 room seeds a game; Labyrinth and Skid play the fairness kits at a weak
skill, the kit's four and a flawless one; Topsy-Turvy plays the d5 bot, novice to elite, and a flawless one; random =
the kits' spam answers and random tilting, at the buzzer):

| Game | | random | weak | average | good | great | near | flawless |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Labyrinth | before | 7 | 43 | 50 | 130 | 177 | 189 | 194 |
| | after | 5 | 39 | 61 | 120 | 195 | 200 | 200 |
| Topsy-Turvy | before | 0 | 8 | 28 | 94 | 194 | 198 | 190 |
| | after | 0 | 34 | 41 | 189 | 195 | 200 | 200 |
| Skid | before | 7 | 44 | 69 | 159 | 179 | 180 | 180 |
| | after | 0 | 41 | 62 | 176 | 197 | 200 | 200 |

- A flawless solve (the shortest route, finished fast) scores exactly 200 = 150 + 30 speed + 20 par on all 30 seeds of
  each game.
- Guessing never pays: random play's median is under the weak median, no random finish earns par points, and random
  play scores no more than before (median and best). Labyrinth's blind depth-first walk (a systematic search, not a
  guess) can finish a maze in under twice the route by luck; it still scores no more than it did before.
- Topsy-Turvy's "before" flawless bot doesn't chase stars, so it sits under near-perfect there.
- Topsy-Turvy's tilt limits stay gravityRev 5's (set from the all-stars minimum), a little more room than the fewest.

### Proofs

`scripts/puzzle-batch-nov-check.ts` (~50 s): new deals carry the new stamps with no collectibles and the standard's
board otherwise, `pinPreParMoves(true)` deals the standard's stamps; every case of
`scripts/fixtures/puzzle-batch-nov-legacy.json.gz` (174 answers on 18 puzzles, recorded on main 6326101 by
`scripts/puzzle-batch-nov-record.ts`) regrades exactly as on main; the flawless 200; the par line and the speed part;
unfinished answers score as the standard scores them; the bands above; the help and intro texts. Checks written for
the standard's stamps (standard-attention-check, standard-pattern-check) pin the batch off with `pinPreParMoves(true)`.
