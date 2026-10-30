# Minigolf (`minigolf`, `golfRev` 1)

The Sports group (30 Oct 2026). Five holes in 120 s on a night garden terrace, top down. Pull back from the ball to aim
and set the power (a dotted aim line and a power pill); let go to putt. Sim `src/lib/arcade/minigolf.ts`, art
`minigolf.renderer.ts`, stage `src/puzzles/minigolf.tsx`, server plumbing `src/lib/duel/minigolf.ts` on the shared
Sports kit (`src/lib/arcade/sportsKit.ts`: integer ball physics, the run's wire format, the one server replay).

## Play

- Five holes from templates, each bigger and longer than the last (30 Oct 2026, the longer course): a long lane up a
  ramp through a boulder field (300 × 520 px), a long dogleg round a pond (340 × 580), a three-leg S-bend (370 × 620),
  two routes round an island pond split by timber walls, a ramp one way and boulders the other (390 × 660), and a
  three-leg switchback finale between two timber walls with two ponds (390 × 690). The seed mirrors each hole and
  nudges its banks, boulders, ponds and cup; the walls are fixed. Nothing random happens after the deal.
- Diagonal timber banks, boulders, bushes in stone planters guarding every cup, ponds, uphill ramps and cross-slopes
  (dark at the bottom, light at the crest, a bright crest edge, fading arrows pointing uphill).
- The hardest putt carries about 300 px (8 px a tick at most), so the holes take several shots.
- 6 strokes a hole; after the sixth the hole ends with closeness credit. Water: +1 stroke, the ball back where it was
  played. A ball drops when its centre is inside the cup and it is moving no faster than 3.2 px a tick.
- Par per hole = the best route the putt search (`scripts/minigolf-oracle.ts`, a beam search to 4 putts) found + 1, so
  a birdie is always possible. Rooms deal a course from the bank (`src/lib/duel/minigolfBank.server.ts`, 60 courses
  of 60 candidates, built by `bun scripts/minigolf-bank.ts --jobs=4`, about 20 min); the pars ride in the puzzle.
  Pars are **3 4 4 4 5** on 42 courses and **4 4 4 4 5** on 18 (par 19–20).

## Parts (together 200)

| Part | Max | How |
| --- | --- | --- |
| Holes (core) | 120 | 24 a hole holed; an unfinished hole up to 20 on a straight line from the tee's distance (0) to the cup (20) |
| Par | 40 | 8 a hole at par or better, falling evenly to 0 at the stroke limit (6) |
| Under par | 20 | 4 a hole under par |
| Speed | 20 | all five holed: full by **50 s**, 0 at the buzzer (120 s) |

Any putt scores at least 1; no input 0.

## Measured

Speed's full-by time is the near-perfect level's median finish (49.9 s over the runs that holed all five; 30 bank
courses, the skill-band bot), rounded.

| Level | Median (p10–p90) | Holes holed (median) | All five holed in time | Median finish |
| --- | --- | --- | --- | --- |
| Weak | 123 (103–139) | 3 | 0/30 | – |
| Average | 127 (103–143) | 4 | 1/30 | 94.4 s |
| Good | 139 (122–166) | 4 | 6/30 | 70.3 s |
| Great | 151 (134–182) | 4 | 14/30 | 60.1 s |
| Near-perfect | 154 (142–180) | 4 | 11/30 | 49.9 s |
| Elite | 179 (154–188) | 5 | 23/30 | 44.4 s |
| Flawless | 196 (188–196) | 5 | 30/30 | 33.0 s |

Weak and average players now struggle on the later holes (the finale's switchback and the island hole run them to the
stroke limit). The flawless bot's planner reaches 196; the oracle's witness on every course scores exactly 200.

**For Joe:** the near-perfect round takes about 50 s, a little under the 60–75 s aimed at: the bot thinks for about
0.6 s a putt. The near-perfect bot also often runs out of strokes on the par-5 finale, so it holes all five only 11
times in 30 (great 14); longer holes would push both further.

## Proofs

minigolf-check (every bank witness scores 200 through the server replay and birdies every hole; the courses, the
rules, determinism and input repair), arcade-standard-check's entry, arcade-self-replay's `minigolf` entry.
