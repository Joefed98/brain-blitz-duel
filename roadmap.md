# Roadmap

## Gravity Maze, Don't Break the Chain, Intruder Detection

- [x] Shared rules: `gravity.ts` (both balls tilt together, each stops on a wall, the edge or the other ball), `chain.ts` (three-step cycle, replay), `intruder.ts` (tap grading, close colour pairs)
- [x] Server generation: joint-state BFS minimum 6–10 tilts with a ball-blocks-ball tilt in the shortest route; chain layouts with two valid and four invalid nodes at every step; three escalating grids storing the changed cell and change kind
- [x] Secrets: gravity `minMoves`/`solution`, intruder `answers`; chain has nothing to hide
- [x] Server verification in `grade.ts` — tilts, taps and grid taps are all replayed, never trusted
- [x] Scoring, standings summary lines, correct-answer lines, GOAL / HOW / SCORE intros
- [x] Play, intro example and reveal screens with the shared hit-test and no-scroll layouts
- [x] Registry entries: all three core, none retired; compact timer slots
- [x] Proof script `scripts/gravity-chain-intruder-check.ts` — 40 rounds each, all pass
- [x] Follow-up fixes: explicit unique-node chain progression, easier 4×4/4×4/5×5 Intruder rounds with four colours and three shapes, and measured Gravity board space above 52px controls
- [x] Chain crossing rules and searched non-crossing solution with crossing decoys; Intruder eased to 3×3/3×3/4×4; both reveals compacted

## Five-game tuning

- [x] Safe Cracker readability; seven-wire Bomb with switch and six effective rules; eight-tube challenge; escalating 3×3 Intruder; Chain limited to 1–8 routes with two traps
- [x] Nine tunings: Target uses five+ tiles, multi-rule Number Sequence, spread Chain layout with Undo/Reset, four-gem Laser (60s), 12x12 Ice Slide (75s), 10x10 Gravity Maze (90s), Tower 90s, ten-tube partial-pour Sort the Tubes, five-clue Safe Cracker
- [x] Six tunings: Sort the Tubes 75s, Tower 60s, Laser 30s, Unblock 7x7 with a 120-layout solver-built bank (15-22 moves), Spot the Difference full 8x6 grids at 30s, Number Sequence 20s

- Added three new types: Nonogram (logic, 60s), Pair Match (attention, 45s) and Colour Flood (logic, 45s) — server generation, private answers, replay-based grading, reveals, summaries and intros. Proof script: scripts/nonogram-pair-flood-check.ts.

- Added three new types: One-Stroke (logic, 45s), Sliding Tiles (pattern, 60s) and Rotating Rings (pattern, 45s) — server generation, private answers, replay-based grading, reveals, summaries and intros. Proof script: scripts/stroke-tiles-rings-check.ts.

- [x] Nonogram 9×9 full-grid rebuild and four-ring Rotating Rings controls/generation.
- [x] Five-type tuning: Nonogram 7×7, Colour Flood 12×12, deferred Bomb DEFUSE, Groups retired, and corrected full-width Rings.

## Scoring amendments (21 types)

- [x] Wordsmith/Word Hunt score their word points directly; Word Ladder, Word Match, Target, Number Sequence, Equation, Maze Dash, Sort the Tubes, Spot the Difference, Sliding Tiles, Lights Out, Pipes, Number Hunt, Count Up, Unblock, Ice Slide, Gravity Maze, Laser and Symbol Scan rescored with progress-based partial credit; SCORE lines and word reveals updated.

## Hover integrity

- [x] Integer-only shared constants, 300-tick client/server state checksums, first-desync reporting, and 200-run path equivalence proof.

## Arcade category

- [x] New "arcade" category with a host toggle (on by default, remembered per host, one arcade round in rounds 2-6, none when off); Hover moved into it.
- [x] Added Swerve and Skyline on the shared deterministic engine: seeded integer fixed-point sims, sim-tick input logs, server replay scoring, 300-tick checkpoints, client-lag handling, fixed instructions/reveals/summaries. Proof script: scripts/arcade-check.ts.

## Arcade inputs, Bin Toss and Bullseye
- [x] Generalised input events ({ t, k, a, b, c, d }, declared per-game ranges, 2000 cap)
- [x] Bin Toss: ten flicked throws, per-throw wind, growing distance, time bonus
- [x] Bullseye: ten aimed arrows, shrinking target, wind drift, half-total scoring

## Matchup
- [x] Matchup: 7x7 six-symbol swap game on the shared engine (k = 3 swap events)
- [x] Fixed per-column refill queues, deterministic reshuffle, cascade scoring, total / 4
- [x] 200-run client/server identity proof with valid and invalid swaps

## Five-game tuning
- [x] Pair Match 5x4 layout/scoring/text
- [x] Swerve speed ramp and coin collection rendering
- [x] Bin Toss drag capture and wind layout
- [x] Bullseye HUD/ring labels/bow aiming render
- [x] Matchup next strip, animation semantics, specials
- [x] Re-run deterministic proof scripts

## Six-game tuning (done)
- [x] Number Sequence: 45-second limit, speed bonus and text scaled to it
- [x] Hover: 666 start, +31 per gate, cap 1331; total gates recomputed
- [x] Swerve: five lanes, 14 px/tick slide, 1–3 blocked lanes, ≤2-step passability, speed +20 per coin
- [x] Matchup: strip aligned to the board columns, score = raw ÷ 8
- [x] Bin Toss: flick launch from the last 80 ms, no preview arc, flight trail
- [x] Bullseye: ring values 10…5, score × 1.5, flick from the bow, no reticle

## Flick recalibration (done)
- [x] Reference swipe 1000 px/s, clamped 250–2200 px/s, square-root response from a shared integer table
- [x] Bin Toss: 1000 px/s at 60° lands in the bin on throw five (launch 1481 units/tick)
- [x] Bullseye: 1000 px/s straight up lands on the centre at arrow one (flight 282/1920)
- [x] ?dev=1 readout of swipe speed, angle and landing point in both games
