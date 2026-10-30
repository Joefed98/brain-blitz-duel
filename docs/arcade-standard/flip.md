# Roofbound on the arcade scoring standard (flipRev 10, 29 Oct 2026)

Rooms deal **flipRev 10** (`FLIP_REV_STD` in `src/lib/arcade/flip.ts`). Play is flipRev 9's, which is flipRev 8's
exactly: the same course, hazards, features, checkpoints and speed zones, so a flipRev 8 or 9 log replays tick for
tick to the same checkpoints (arcade-phone-notes-check replays the 12 stored flipRev 8 runs on flipRev 10). Only the
scoring changes. States carry `std: 1`, outside the checkpoint checksum, as flipRev 9's `lift` was. flipRev 8 and 9
rounds score exactly as before.

## The parts (sum 200)

| Part | Max | How it counts |
|---|---|---|
| Time survived (core) | 150 | Half seconds lived, straight line: `stdLine(150, halfSeconds, 120)`, 1.25 each, 150 at the full minute. |
| Gold stars | 15 | 1.5 each of the course's 10 gold stars (every flipRev 8 course has exactly 10; flip-x200-check). |
| Star trails | 15 | 3.75 each of the 4 trails, for a full trail (all 5 of its stars). |
| Sweet landings | 10 | 1.25 each of the 8 sweet spots (once per spot). |
| Double flips | 10 | 1 for each double flip (the sim's `combos`: every flip within 8 ticks of landing with a hazard close by, chained or not; a speed zone does not double it), up to 10. |

Lasting the minute, checkpoints and speed zones pay nothing of their own; there is no rising scale or skill pay and no
penalty. Every part is floored (`stdLine`), so a run taking everything adds up to exactly 200. Anyone who plays scores
at least 1; a run with no input scores 0 (`stdTotal`).

## Decisions where the brief left a choice

- **Core basis: half seconds** (120 in the minute), as the earlier revisions counted, so the help reads "150 at 120".
- **No pause after a save.** On flipRev 8/9 the survival count paused 10 s after a checkpoint's save. On flipRev 10 time
  survived is literal: the save still happens (a second of shield, the run goes on), and every tick lived counts. The
  sim still counts `lost` (it is in the checksum), but this revision's score never reads it. Effect: a saved crash costs
  no core points, which raises the lower levels' finish rate (average 23 of 30 runs last the minute).
- **Double flips: count, not chain points.** One point per double flip up to 10. The stored witness routes show ten or
  more double flips sit on a route that lasts the minute on 252 of 260 courses, so earning them never means giving up
  core.
- **Gold stars split over a fixed 10** (FLIP_STARS); every course carries 10.

## Core target

The core has a fixed maximum (the full minute), so no near-perfect median is needed for it. Measured anyway: the
near-perfect level's median core units on flipRev 10 are 120 half seconds (30 of 30 runs last the minute).
`FLIP_V10_BAND_CURVE = bandCurve([0, 120], [0, 150])` (LIVE_BANDS' curve; the help's good run, 100 points of core, is
80 half seconds).

## Perfect run

`scripts/arcade-standard/flip.ts` replays the stored witness routes (`scripts/fixtures/flip-x200-witness.json.gz`,
one per tuning and fresh room seed) through the server on flipRev 10. 252 of 260 take every gold star, trail and sweet
spot with at least ten double flips; each scores 200 (and one end state through the sim's own score function). The
other 8 were planned for flipRev 8, where combo points could stand in for a missed sweet spot or fewer double flips
(4 miss one sweet spot, 4 have 8–9 double flips); they score 198–199 on flipRev 10.

## Skill bands after (flipRev 10, 30 seeds, `--rev=now --levels=all --jobs=1`)

| Level | Median | p10–p90 | Runs lasting the minute |
|---|---|---|---|
| Weak | 117 | 105–164 | 9 / 30 |
| Average | 167 | 42–171 | 23 / 30 |
| Good | 175 | 153–181 | 27 / 30 |
| Great | 184 | 177–188 | 29 / 30 |
| Near-perfect | 189 | 184–193 | 30 / 30 |
| Elite | 195 | 192–197 | 30 / 30 |
| Flawless | 198 | 195–200 | 30 / 30 |

Medians rise at every level, with 5–6 point gaps between near-perfect, elite and flawless. No bot change was needed.
Scores run high below the top because the core is time survived and saved crashes no longer cost time; the brief asks
for no number targets.
