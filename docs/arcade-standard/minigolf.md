# Minigolf (`minigolf`, `golfRev` 1)

The Sports group (30 Oct 2026). Five holes in 120 s on a night garden terrace, top down. Pull back from the ball to aim
and set the power (a dotted aim line and a power pill); let go to putt. Sim `src/lib/arcade/minigolf.ts`, art
`minigolf.renderer.ts`, stage `src/puzzles/minigolf.tsx`, server plumbing `src/lib/duel/minigolf.ts` on the shared
Sports kit (`src/lib/arcade/sportsKit.ts`: integer ball physics, the run's wire format, the one server replay).

## Play

- Five holes from templates, each bigger than the last: a straight (230 × 380 px), a dogleg (300 × 440), an S-bend
  (330 × 520), a split route round a pond (360 × 600) and a grand finale (380 × 680). The seed mirrors and nudges each
  one (obstacles, cup); nothing random happens after the deal.
- Diagonal timber logs (banks), boulders, bushes in stone planters guarding cups, ponds and slopes (dark at the
  bottom, light at the crest, a bright crest edge, fading arrows pointing uphill).
- 6 strokes a hole; after the sixth the hole ends with closeness credit. Water: +1 stroke, the ball back where it was
  played. A ball drops when its centre is inside the cup and it is moving no faster than 3.2 px a tick.
- Par per hole = the best route the putt search (`scripts/minigolf-oracle.ts`) found + 1, so a birdie is always
  possible. Rooms deal a course from the bank (`src/lib/duel/minigolfBank.server.ts`, 60 courses, built by
  `bun scripts/minigolf-bank.ts`); the pars ride in the puzzle. Every course's pars came out 2 3 3 3 3 (hole 1's
  straight can be aced).

## Parts (together 200)

| Part | Max | How |
| --- | --- | --- |
| Holes (core) | 120 | 24 a hole holed; an unfinished hole up to 20 on a straight line from the tee's distance (0) to the cup (20) |
| Par | 40 | 8 a hole at par or better, falling evenly to 0 at the stroke limit (6) |
| Under par | 20 | 4 a hole under par |
| Speed | 20 | all five holed: full by **33 s**, 0 at the buzzer (120 s) |

Any putt scores at least 1; no input 0.

## Measured

Speed's full-by time is the near-perfect level's median finish (32.5 s, 30 bank courses; the bot below), rounded up.

| Level | Median (p10–p90) | All holed in time | Median finish |
| --- | --- | --- | --- |
| Weak | 151 (131–162) | 21/30 | 87.1 s |
| Average | 162 (132–176) | 22/30 | 63.3 s |
| Good | 168 (144–175) | 25/30 | 51.9 s |
| Great | 178 (169–184) | 28/30 | 39.9 s |
| Near-perfect | 184 (177–192) | 29/30 | 32.5 s |
| Elite | 189 (181–196) | 29/30 | 28.5 s |
| Flawless | 200 (200–200) | 30/30 | 21.1 s |

**For Joe:** the bands are in order but bunched at the top: the core (24 a hole holed) is paid to anyone who holes
out within six strokes, which almost every level does. Harder holes (smaller capture speed, more water) or fewer
strokes would spread them; the parts are as briefed.

## Proofs

minigolf-check (every bank witness scores 200 through the server replay and birdies every hole; the courses, the
rules, determinism and input repair), arcade-standard-check's entry, arcade-self-replay's `minigolf` entry.
