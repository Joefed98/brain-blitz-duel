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

### The ladder

Seeds 2000–2095 (96 boards a level), which no fitting saw; Heave Expert, Trail Hard and Expert, Regions Hard and
Expert and Loopline Expert are dealt from their banks. Average and great are mean scores; "Elite at 200" is the share
of boards the elite finishes at 200. Easy / Normal / Hard / Expert.

| Game | Average | Great | Elite at 200 |
|---|---|---|---|
| Gridlock | 177 / 43 / 35 / 27 | 199 / 199 / 181 / 132 | 98 / 85 / 74 / 33 % |
| Tessellate | 144 / 72 / 45 / 39 | 200 / 197 / 159 / 137 | 100 / 100 / 65 / 24 % |
| Pipeline | 194 / 78 / 60 / 43 | 200 / 184 / 169 / 99 | 96 / 99 / 47 / 38 % (Easy accepted as measured) |
| Chroma Lines | 178 / 80 / 67 / 59 | 198 / 187 / 162 / 135 | 99 / 94 / 70 / 35 % |
| Skid | 187 / 68 / 50 / 38 | 198 / 185 / 177 / 138 | 98 / 76 / 57 / 32 % |
| Heave | 157 / 61 / 46 / 34 | 199 / 192 / 181 / 124 | 96 / 68 / 60 / 49 % (Expert 33 % across its whole bank) |
| Lightbender | 164 / 40 / 27 / 22 | 196 / 188 / 150 / 110 | 92 / 94 / 53 / 34 % (Easy accepted as measured) |
| Topsy-Turvy | 192 / 76 / 47 / 32 | 199 / 184 / 170 / 144 | 96 / 78 / 49 / 30 % (Normal on gravityRev 9) |
| Box Six | 153 / 65 / 50 / 32 | 199 / 184 / 158 / 95 | 91 / 78 / 55 / 34 % |
| Hanoi | 157 / 65 / 41 / 32 | 199 / 193 / 164 / 116 | 92 / 90 / 61 / 31 % |
| Polypotions | 177 / 78 / 48 / 40 | 200 / 196 / 171 / 135 | 100 / 100 / 47 / 29 % |
| Safe Cracker | 140 / 101 / 41 / 37 | 198 / 195 / 173 / 156 | 100 / 100 / 52 / 21 % |
| Mosaic | 138 / 77 / 44 / 31 | 199 / 194 / 157 / 97 | 92 / 85 / 56 / 36 % |
| Colour Flood | 194 / 108 / 55 / 37 | 198 / 197 / 184 / 167 | 94 / 89 / 52 / 36 % |
| Minefield | 181 / 173 / 130 / 89 | 196 / 197 / 179 / 162 | 99 / 95 / 65 / 25 % |
| Tents and Trees | 156 / 65 / 33 / 20 | 199 / 192 / 120 / 79 | 95 / 93 / 56 / 35 % |
| Shikaku | 166 / 65 / 39 / 25 | 199 / 185 / 136 / 83 | 93 / 89 / 54 / 38 % |
| Lamplighter | 166 / 62 / 38 / 27 | 199 / 187 / 141 / 93 | 94 / 86 / 44 / 34 % |
| Trail | 167 / 75 / 34 / 25 | 197 / 192 / 99 / 73 | 89 / 85 / 53 / 40 % |
| Loopline | 142 / 90 / 48 / 32 | 198 / 196 / 169 / 99 | 93 / 79 / 47 / 28 % |
| Regions | 180 / 99 / 40 / 32 | 198 / 196 / 112 / 90 | 82 / 90 / 50 / 36 % (Easy accepted as measured) |
| Island Link | 148 / 49 / 12 / 6 | 199 / 197 / 160 / 58 | 97 / 92 / 54 / 31 % |

The elite's mean stays at 187–200 on every level: a finish without mistakes loses only speed points. Pipeline,
Lightbender and Regions Easy reach 200 a few times in a hundred less often than Normal because one slip on a small board
costs a point or two (every Regions Easy miss scores 198).

### What each level is

Clock and "full speed by" (Normal keeps its own line; a "–" on Easy is the game's own standard line). Easy / Hard /
Expert boards as in the help lines below.

| Game | Easy | Normal | Hard | Expert |
|---|---|---|---|---|
| Gridlock | 60 s, by 40 s | 60 s | 70 s, by 28 s | 75 s, by 38 s |
| Tessellate | 60 s, by 40 s | 60 s | 70 s, by 35 s | 70 s, by 37 s |
| Pipeline | 120 s | 120 s | 120 s, by 70 s | 120 s, by 96 s |
| Chroma Lines | 75 s, by 21 s | 75 s | 75 s, by 36 s | 70 s, by 36 s |
| Skid | 90 s, by 20 s | 90 s | 100 s, by 41 s | 100 s, by 50 s |
| Heave | 120 s, by 30 s | 120 s | 120 s, by 61 s | 120 s, by 81 s |
| Lightbender | 90 s, by 21 s | 60 s | 60 s, by 28 s | 75 s, by 38 s |
| Topsy-Turvy | 120 s, by 20 s | 120 s, by 40 s (gravityRev 9) | 120 s, by 55 s | 120 s, by 64 s |
| Box Six | 90 s | 90 s | 90 s, by 44 s | 75 s, by 51 s |
| Hanoi | 90 s | 90 s | 90 s, by 43 s | 120 s, by 66 s |
| Polypotions | 90 s | 90 s | 90 s, by 40 s | 120 s, by 62 s |
| Safe Cracker | 75 s | 75 s | 90 s, by 37 s | 105 s, by 52 s |
| Mosaic | 90 s | 120 s | 120 s, by 60 s | 100 s, by 65 s |
| Colour Flood | 60 s | 60 s | 60 s, by 22 s | 75 s, by 34 s |
| Minefield | 90 s (minesRev 4) | 90 s (minesRev 3) | 90 s, minesRev 6 (by 49 s) | 105 s, minesRev 7 (by 69 s) |
| Tents and Trees | 90 s | 90 s | 120 s, by 69 s | 115 s, by 85 s |
| Shikaku | 90 s | 90 s | 120 s, by 67 s | 120 s, by 88 s |
| Lamplighter | 120 s | 90 s | 120 s, by 63 s | 120 s, by 78 s |
| Trail | 120 s | 120 s | 120 s, by 79 s | 120 s, by 103 s |
| Loopline | 90 s | 90 s | 120 s, by 48 s | 120 s, by 74 s |
| Regions | 90 s | 90 s | 120 s, by 78 s | 120 s, by 88 s |
| Island Link | 90 s | 90 s | 120 s, by 51 s | 120 s, by 83 s |

## Joe's decisions (22 Nov 2026)

- **Topsy-Turvy, option A:** a Normal scoring stamp, `gravityRev 9` (src/lib/duel/topsyLine.ts): gravityRev 8 exactly
  with Normal's full-speed time 40 s instead of 32 s. At 32 s the elite reached 200 on about one Normal board in ten,
  so Hard and Expert could not sit below Normal with Expert at a fifth or more. Rounds dealt before keep gravityRev 8
  and grade exactly as before (topsy-line-check against scripts/fixtures/topsy-line-legacy.json.gz, recorded on the
  tree before the stamp); checks written for gravityRev 8 pin it with `pinPreTopsyLine(true)` (era pin
  `preTopsyLine`). Topsy-Turvy's bundled intro demo moved to gravityRev 9 (Joe, 22 Nov 2026): the same touches on the
  same board, still a 200, so the "Save intro demos" run takes it and F1 has nothing to re-record
  (`src/lib/duel/bundledDemos/gravity.json`, `scripts/fixtures/pattern-demos.json`).
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
  8 × 12, 115 seconds."
- Shikaku: "Easy is 10 × 7; Hard 10 × 13 with 19 to 22 rectangles, 120 seconds; Expert 10 × 15 with 22 to 26."
- Lamplighter: "Easy is 9 × 6 with most walls numbered; Hard 9 × 11, 120 seconds; Expert 9 × 12 with fewer numbers."
- Trail: "Easy is 5 × 5 with 9 numbers shown; Hard 7 × 7 with 17; Expert 7 × 7 with 14."
- Loopline: "Easy is 5 × 5; Hard 7 × 7, 120 seconds; Expert 8 × 8, 120 seconds."
- Regions: "Easy is 6 × 6; Hard 8 × 8, 120 seconds; Expert 8 × 8 with 10 to 14 numbers, 120 seconds."
- Island Link: "Easy is 6 × 6 with 7 to 9 islands; Hard 8 × 8 with 13 to 16, 120 seconds; Expert 18 to 22 islands."
