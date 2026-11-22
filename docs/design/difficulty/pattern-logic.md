# Pattern and Logic levels (D4, 22 Nov 2026)

The levels of the 8 Pattern and 14 Logic games, built and measured to Joe's ladder: the average player steps down
clearly from Easy to Normal to Hard to Expert, and a realistic elite player reaches 200 less often each level up, on
Expert on at least a fifth of boards. Normal is today's game byte for byte (deal-identity-check, difficulty-check).

## How it was measured

`bun scripts/pattern-logic-human-tune.ts <game|pattern|logic|all> --level=all --seeds=96 [--from=N] [--people=…]`
deals each level as a room deals it and plays it with five people (scripts/pattern-logic-human.ts): average, good,
great, near-perfect and elite, every action held to HUMAN_LIMITS (0.25 s to react, 0.15 s a tap, with each game's taps
counted as the phone needs them), graded by the server. The people are the puzzle-fairness kits' skill levels (pace and
slip rate, LEVEL_THINK's thinking per level); the elite is pace 0.4 and a slip in 125 moves, the figures D1 and D2 used.
Minefield plays its skill-band bot under the same limits. With `PL_SCAN=1` each elite finish is regraded by the real
grader at every whole-second speed line, so a level's line is set to an exact share at 200.

## The speed line rides on the deal

Every Hard and Expert deal of the 21 puzzle games carries its level's own "full speed by" time as `levelFullByS`
(src/lib/duel/standard/plLevelSpeed.ts), read by the graders; Normal deals never carry it. A level round dealt before
D4 keeps the time its level had then (`PRE_D4_LEVEL_FULL_BY_S`, frozen). Minefield's Hard and Expert are new
revisions (minesRev 6 and 7) with their own speed parts.

## The tables

The tables follow, generated from the final measurement (see "Measured").
