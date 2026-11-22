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

## Joe's decisions (22 Nov 2026)

- **Topsy-Turvy, option A:** a Normal scoring stamp, `gravityRev 9` (src/lib/duel/topsyLine.ts): gravityRev 8 exactly
  with Normal's full-speed time 40 s instead of 32 s. At 32 s the elite reached 200 on about one Normal board in ten,
  so Hard and Expert could not sit below Normal with Expert at a fifth or more. Rounds dealt before keep gravityRev 8
  and grade exactly as before (topsy-line-check against scripts/fixtures/topsy-line-legacy.json.gz, recorded on the
  tree before the stamp); checks written for gravityRev 8 pin it with `pinPreTopsyLine(true)` (era pin
  `preTopsyLine`). Topsy-Turvy's intro demo (recorded on gravityRev 8) plays the same tilts; F1 should re-record it on
  gravityRev 9 so its shown score matches.
- **Skid's help line** names the new speed lines now (instructions.ts, "Speed by level:"); every other "Levels:" line
  waits for P2's second PR (proposed below).
- **Shikaku** keeps Normal's 32.5 px squares at every level (its 10 columns; the boards grow downwards).
- **Pipeline and Lightbender Easy** reach 200 two or three in a hundred times less often than Normal at the elite (one
  slip costs a point on a small board): accepted as measured.
- **Joe's ladder over the spec's average targets:** where Normal's own average is about 65, Hard cannot be both clearly
  below Normal and inside the spec's 55–75; the great player lands on the spec's elite targets.

## Not built: for A2 (art) and the spec

- Gridlock's 8 × 8 Hard and 9 × 9 Expert lots wait for the lot renders (lot-8, lot-9).
- Tessellate's 9 × 9 Expert with thirteen pieces needs two new pentomino renders; Expert keeps eleven pieces on 8 × 8.
- Polypotions' 14 flasks in 12 colours need two more potion colours; Hard and Expert use the 12 flasks and 10 colours.
- Topsy-Turvy's 10 balls need two more ball colours and marks; Expert keeps eight.
- Island Link's 8 × 11 Expert needs a row count in its rules, solver and stage (not only art); Expert keeps 8 × 8.
- Safe Cracker Expert's six dials (56 px) sit edge to edge on a 375 px phone: A2 may want `[data-dials="6"]` spacing.
- Tessellate Hard's tray is four to a row (the stage's own rule for more than nine pieces).
- The only stage lines D4 touched: src/puzzles/trail.tsx 16, 303–304, 309–310, 332, 339, 432, 441, 487–488 and 497
  (the board's side read from its numbers, `trSide`; no look change).

## Proposed "Levels:" help lines (after P2's second PR)

- Gridlock: "Easy is a half-empty 6 × 6 lot; Hard a fuller 7 × 7 lot and a longer line, 70 seconds; Expert the longest
  line, 75 seconds."
- Tessellate: "Easy is a 5 × 5 board and four small pieces; Hard an 8 × 8 board and ten pieces, 70 seconds; Expert
  eleven pieces with only one or two ways to finish."
- Pipeline: "Easy is 5 × 5; Hard 8 × 8 with nearly every tile turned; Expert 8 × 11 with the spills hidden."
- Chroma Lines: "Easy is 6 × 6 with 5 or 6 pairs; Hard 9 × 11 with 12 pairs; Expert 9 × 13 with 14 pairs, 70 seconds."
- Heave: "Easy has 3 crates; Hard 6; Expert 7 with the longest pushes."
- Lightbender (instructions.ts "Levels:"): "Easy has one bomb, five shots and three spare mirrors; Hard 6 or 7 bombs and
  one spare, 60 seconds; Expert 9 or 10 bombs, no spare mirror and two shots, 75 seconds."
- Topsy-Turvy: "Easy is two boards of 3 balls; Hard three boards of 7; Expert three boards of 8."
- Box Six: "Easy gives 24 to 26 digits and hides a digit once all six are placed; Hard gives 10 to 12 and needs a pair
  or pointing step; Expert gives 8 or 9, needs three such steps and shows clashes only when you press Check, 75 seconds."
- Hanoi: "Easy is 7 rings on 4 posts; Hard 10 rings on 3 posts, 90 seconds; Expert 12 rings on 3 posts, 120 seconds;
  Normal 3 or 4 posts. Run out of time and the reveal says how many moves you were from done."
- Polypotions: "Easy is 6 flasks of 4 colours; Hard 12 flasks of 10 colours, 90 seconds; Expert the same rack with only
  each flask's top colour showing: the layers below are grey with a ? until you uncover them."
- Safe Cracker: "Easy is 3 dials of 0–9 with simple clues; Hard 5 dials of 0–15, seven clues and two tries, 90 seconds;
  Expert 6 dials of 0–15, nine clues and one try."
- Mosaic: "Easy is 5 × 5 and a line that matches its numbers fills its gaps with ×; Hard 9 × 11; Expert 9 × 14, where
  some squares need two lines read together."
- Colour Flood: unchanged (the boards are today's).
- Minefield: "Easy is 8 × 12 with 9 mines; Hard 26 mines, 90 seconds; Expert 40 mines on the same 10 × 16 with a small
  opening, 105 seconds. Never a guess on any level."
- Tents and Trees: "Easy is 8 × 6 with every count shown; Hard 8 × 11 with half the counts hidden, 120 seconds; Expert
  8 × 12, 110 seconds."
- Shikaku: "Easy is 10 × 7; Hard 10 × 13 with 19 to 22 rectangles, 120 seconds; Expert 10 × 15 with 22 to 26."
- Lamplighter: "Easy is 9 × 6 with most walls numbered; Hard 9 × 11, 120 seconds; Expert 9 × 12 with fewer numbers."
- Trail: "Easy is 5 × 5 with 9 numbers shown; Hard 7 × 7 with 17; Expert 7 × 7 with 14."
- Loopline: "Easy is 5 × 5; Hard 7 × 7; Expert 8 × 8, 120 seconds."
- Regions: "Easy is 6 × 6; Hard 8 × 8, 100 seconds; Expert 8 × 8 with 10 to 14 numbers, 120 seconds."
- Island Link: "Easy is 6 × 6 with 7 to 9 islands; Hard 8 × 8 with 13 to 16, 120 seconds; Expert 18 to 22 islands."
