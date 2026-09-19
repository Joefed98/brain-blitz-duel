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
