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
