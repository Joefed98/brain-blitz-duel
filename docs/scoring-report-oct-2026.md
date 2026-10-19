# Scoring report, October 2026 (for the 27 Oct beta)

> Batch 1 of the fix plan is in (20 Oct 2026, `puzzleScoreRev 3`): see `docs/scoring-rev3-oct-2026.md` for the new
> numbers. This report describes the 19 Oct state.

Report only: no score, band, stamp or game changed. The data comes from `scripts/scoring-report.ts` (optional, never
run in CI), which played every active game on room seeds through the real server grader on today's stamps.
Every run is listed in `docs/scoring-report-oct-2026.csv` (23,990 runs). The tables between `generated` markers are
written by the script: `bun scripts/scoring-report.ts --out=<dir>` then `bun scripts/scoring-report.ts --combine=<dir> --write`.
A whole run takes about 2½ minutes locally (puzzles ~40 s, arcade ~100 s), so it was not split; `--category=` and
`--game=` re-run parts.

## Coverage

Each of the 74 active games in the registry is covered, Pinball and Letterfall included; no game was skipped.
Puzzles: 15 room seeds per level. Speed and engine games: 15 seeds of each kit player. Arcade: 10 seeds of each bot
level plus a run with no input.

<!-- generated:coverage -->
| # | Game | id | Category | How played | Seeds | Runs |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Cryptogrid | `codeword` | word | level grid + kit players + phone path | 15 | 510 |
| 2 | Forage | `wordhunt` | word | progress + kit players + phone path (no finish) | 15 | 315 |
| 3 | Interlock | `tilegrid` | word | level grid + kit players + phone path | 15 | 510 |
| 4 | Letterfall | `wordfall` | word | kit players + spam | 15 | 135 |
| 5 | Lookout | `wordsearch` | word | level grid + kit players + phone path | 15 | 480 |
| 6 | Nucleus | `wordsmith` | word | progress + kit players + phone path (no finish) | 15 | 330 |
| 7 | Roundabout | `letterwheel` | word | level grid + kit players + phone path | 15 | 495 |
| 8 | Slider | `wordslide` | word | level grid + kit players + phone path | 15 | 495 |
| 9 | Strikeout | `strikeout` | word | level grid + kit players + phone path | 15 | 495 |
| 10 | Swapword | `swapword` | word | level grid + kit players + phone path | 15 | 495 |
| 11 | Ballpark | `numline` | number | progress + kit players + phone path (no finish) | 15 | 345 |
| 12 | Brimful | `measure` | number | level grid + kit players + phone path | 15 | 495 |
| 13 | Checkout | `checkout` | number | level grid + kit players + phone path | 15 | 495 |
| 14 | Counterweight | `balance` | number | level grid + kit players + phone path | 15 | 510 |
| 15 | Exact | `target` | number | level grid + kit players + phone path | 15 | 495 |
| 16 | Integer Pyramid | `numpyramid` | number | level grid + kit players + phone path | 15 | 510 |
| 17 | Operator | `equation` | number | level grid + kit players + phone path | 15 | 510 |
| 18 | Tenfall | `tendrop` | number | kit players + spam | 15 | 135 |
| 19 | Trail | `trail` | number | level grid + kit players + phone path | 15 | 495 |
| 20 | Ascend | `numhunt` | speed | level grid + kit players + phone path | 15 | 465 |
| 21 | Bang On | `stopwatch` | speed | kit players + spam | 15 | 150 |
| 22 | Bonk | `whack` | speed | kit players + spam | 15 | 150 |
| 23 | Don't Break the Chain | `chain` | speed | level grid + kit players + phone path | 15 | 465 |
| 24 | Flash | `reaction` | speed | kit players + spam | 15 | 150 |
| 25 | Pull! | `clayshoot` | speed | kit players + spam | 15 | 150 |
| 26 | Double Take | `spotdiff` | attention | level grid + kit players + phone path | 15 | 510 |
| 27 | Eagle Eye | `symscan` | attention | level grid + kit players + phone path | 15 | 510 |
| 28 | Labyrinth | `maze` | attention | level grid + kit players + phone path | 15 | 510 |
| 29 | Matchmaker | `pairmatch` | attention | level grid + kit players + phone path | 15 | 480 |
| 30 | Mixed Signals | `stroop` | attention | kit players + spam | 15 | 150 |
| 31 | Tally | `countup` | attention | level grid + kit players + phone path | 15 | 495 |
| 32 | Chroma Lines | `flow` | pattern | level grid + kit players + phone path | 15 | 495 |
| 33 | Gridlock | `unblock` | pattern | level grid + kit players + phone path | 15 | 480 |
| 34 | Heave | `push` | pattern | level grid + kit players + phone path | 15 | 495 |
| 35 | Jumbled | `tiles` | pattern | level grid + kit players + phone path | 15 | 495 |
| 36 | Lightbender | `laser` | pattern | level grid + kit players + phone path | 15 | 480 |
| 37 | Pipeline | `pipes` | pattern | level grid + kit players + phone path | 15 | 510 |
| 38 | Skid | `iceslide` | pattern | level grid + kit players + phone path | 15 | 480 |
| 39 | Tessellate | `blockparty` | pattern | level grid + kit players + phone path | 15 | 510 |
| 40 | Topsy-Turvy | `gravity` | pattern | level grid + kit players + phone path | 15 | 480 |
| 41 | Turntable | `rings` | pattern | level grid + kit players + phone path | 15 | 480 |
| 42 | Blackout | `lightsout` | logic | level grid + kit players + phone path | 15 | 510 |
| 43 | Bomb Defusal | `bomb` | logic | level grid + kit players + phone path | 15 | 495 |
| 44 | Box Six | `sudoku` | logic | level grid + kit players + phone path | 15 | 510 |
| 45 | Colour Flood | `flood` | logic | level grid + kit players + phone path | 15 | 495 |
| 46 | Hanoi | `tower` | logic | level grid + kit players + phone path | 15 | 510 |
| 47 | Lamplighter | `lightup` | logic | level grid + kit players + phone path | 15 | 510 |
| 48 | Mosaic | `nonogram` | logic | level grid + kit players + phone path | 15 | 525 |
| 49 | Polypotions | `tubes` | logic | level grid + kit players + phone path | 15 | 480 |
| 50 | Safe Cracker | `safe` | logic | level grid + kit players + phone path | 15 | 495 |
| 51 | Shikaku | `shikaku` | logic | level grid + kit players + phone path | 15 | 495 |
| 52 | Tents and Trees | `tents` | logic | level grid + kit players + phone path | 15 | 525 |
| 53 | Ball Tracker | `balltrack` | arcade | arcade bots (server replay) + no input | 10 | 50 |
| 54 | Breaker | `breaker` | arcade | arcade bots (server replay) + no input | 10 | 50 |
| 55 | Coral Pop | `bubble` | arcade | arcade bots (server replay) + no input | 10 | 50 |
| 56 | Fission | `burst` | arcade | arcade bots (server replay) + no input | 10 | 50 |
| 57 | Flightpath | `bullseye` | arcade | arcade bots (server replay) + no input | 10 | 50 |
| 58 | Gemstone | `matchup` | arcade | arcade bots (server replay) + no input | 10 | 50 |
| 59 | Grappler | `swing` | arcade | arcade bots (server replay) + no input | 10 | 50 |
| 60 | High Rise | `skyline` | arcade | arcade bots (server replay) + no input | 10 | 50 |
| 61 | Hover | `hover` | arcade | arcade bots (server replay) + no input | 10 | 50 |
| 62 | Jaywalk | `cross` | arcade | arcade bots (server replay) + no input | 10 | 50 |
| 63 | Meteor | `snake` | arcade | arcade bots (server replay) + no input | 10 | 50 |
| 64 | Orbit | `orbit` | arcade | arcade bots (server replay) + no input | 10 | 50 |
| 65 | Pinball | `pinball` | arcade | arcade bots (server replay) + no input | 10 | 50 |
| 66 | Rainbow Bridge | `inkbridge` | arcade | arcade bots (server replay) + no input | 10 | 50 |
| 67 | Rally | `rally` | arcade | arcade bots (server replay) + no input | 10 | 50 |
| 68 | Roofbound | `flip` | arcade | arcade bots (server replay) + no input | 10 | 50 |
| 69 | Scrumper | `snip` | arcade | arcade bots (server replay) + no input | 10 | 50 |
| 70 | Slice | `slice` | arcade | arcade bots (server replay) + no input | 10 | 50 |
| 71 | Swish | `bintoss` | arcade | arcade bots (server replay) + no input | 10 | 50 |
| 72 | Tempo | `beat` | arcade | arcade bots (server replay) + no input | 10 | 50 |
| 73 | Tilt | `tilt` | arcade | arcade bots (server replay) + no input | 10 | 50 |
| 74 | Wavefront | `wavefront` | arcade | arcade bots (server replay) + no input | 10 | 50 |
<!-- /generated:coverage -->

How each kind was played:

- **Finish puzzles (42 games)** used the puzzle-fairness kits, which build the answer strings each stage sends.
  - A clean solve (no mistakes) defines progress: 10 %…90 %, two steps short and one step short are shares of that
    solve's actions, each graded as a time-out (clock run out).
  - Finishes were graded at 90 / 75 / 50 / 25 / 10 / 0 % of the clock left. For tap-log and action-log games (Ascend,
    Chain, Lightbender), the solve was replayed at the pace that finishes at that time. The script also searched for
    the least time left that scores 150.
  - Mistakes: a kit with a 5 / 15 / 35 % slip rate, graded at half the clock left so only the mistakes differ.
  - Bad play: every kit spam strategy, no input, and half done then taken back (where moves can be reversed).
  - Six kit players: careless, below average, average, good, great, near perfect.
  - The phone's room path, described under *Room = practice and the phone path* below.
- **Open puzzles (Nucleus, Forage, Ballpark)** got the same treatment, except progress is a share of what a
  near-perfect player finds within the clock, and they have no finish levels.
- **Speed and engine games (Flash, Bang On, Bonk, Pull!, Mixed Signals, Tenfall, Letterfall)** got the six kit players
  and spam, through each game's own replay.
- **Arcade (22 games)** used `scripts/arcade-skill-bands.ts --rev=now`: today's dealt revisions, with only the
  server-replayed score counting. There are four bot levels (average, good, great, near perfect). No careless or
  below-average bot exists (each bot's tables are per level), so the no-input run stands in for careless play.

### Room = practice and the phone path

Every puzzle run was also graded as a room. `gradeRoomAnswer` was given a puzzle-phase receipt 80 ms after the claim,
or a reveal-phase receipt for a time-out. **All 22,890 room grades were identical to practice.** The three checks
also pass, listed by name under *Checks run* at the end.

For every finish and open puzzle, the drafts went through the room's own draft keeper (`roomDraft.ts`) and sender
(`roomSend.ts`), then into the grader:

- a time-out one step short;
- a reload at half done (restored draft, then the stage's opening board);
- a reload then one more action.

The draft sent was always the last draft made: no game encodes its draft differently from what the grader reads. The
one real loss is by design. After a reload the stage restarts from its opening board, and the first new action
replaces the restored draft (see bug 5).

What was not driven: the stages themselves are not rendered. The kits mirror each stage's encoding. The 14 games Joe
reported were also read stage by stage.

## (a) Summary for Joe

- **The puzzle scores you saw are what the server computes. They are not phone bugs.** All 14 of your phone results
  reproduce exactly from the grader on real room puzzles (table below). The cause is almost always the 19 Oct
  rev-2 mapping:
  - Each puzzle's points come from knots fitted so the simulated *average* player scores 70 and the *good* one 100.
  - Most simulated players finish their puzzle, so a correct finish lands wherever those players happened to land.
  - That is 66–116 at the buzzer in 41 of the 42 finish puzzles. Only Integer Pyramid gives 120+.
  - The rule you agreed (finish = 120 + speed) is broken in every one of those 41 puzzles. Slider, Swapword, Bomb
    Defusal and Lookout finish at the buzzer for under 80.
- **Unfinished play is scaled by where simulated players are, not by how much is done.** A sample, against the rule's
  ≈ 55 at half done and ≈ 110 one step short:

  | Game | Half done | One step short |
  | --- | --- | --- |
  | Lookout | 41 | 68 |
  | Swapword | 30 | 51 |
  | Bomb Defusal | 40 | 67 |
  | Exact | 0 | 73 |
  | Polypotions | 76 | 87 |
  | Integer Pyramid | 82 | 122 |

  Integer Pyramid one step short scores almost the same as its finish at the buzzer (123).
- **150 is out of reach for people.**
  - A clean finish needs 39–96 % of the clock left (median 74 %, over the 39 puzzles where the script could search it;
    the tap-log games Ascend, Chain and Lightbender were not searched).
  - The near-perfect kit player's median finish leaves less time than that in all 39.
  - Only 18 of 3,780 puzzle-player runs scored 150.
  - "150 only for a perfect, fast run" holds, but in practice it means "never".
- **Some games measure progress wrongly:**
  - Slider: wasted moves take everything to 0.
  - Trail: one wrong turn makes every later tile wrong.
  - Counterweight: scale weights assume any order, but the scales are dealt in order.
  - Turntable and Gridlock: the board gets "worse" before it gets better.
  - Brimful: no credit inside a jug puzzle.
  - Strikeout: word 5 earns nothing.
  - Operator: unequal weights, and solving equation 1 is worth 10.
- **Rooms and practice agree everywhere.** Each puzzle draft reaches the server intact.
- **Real bugs:**
  - Interlock's Done accepts a 14-tile grid, stores it as correct and scores it as unfinished.
  - Your progress is lost if the app reloads mid-round and you then keep playing.
  - Stale intro texts in Exact and Nucleus.
  - Colour Flood can be finished by cycling colours (3 of 15 seeds).
- **Speed, engine and arcade games** are mostly on target for the average player:
  - Bonk, Tenfall, Ball Tracker, Coral Pop, Flightpath, Gemstone, High Rise, Jaywalk, Scrumper, Slice and Tempo land
    in 60–79.
  - Tenfall's band map squashes a 10/10 finish to 93.
  - Flash's average player sits at 55.
  - Bang On's random tapping gets 27.
  - Several arcade bots can't tell their levels apart, so those curves can't be judged from bots alone (Rainbow
    Bridge, Breaker, Tilt, Fission, Wavefront, Meteor, Gemstone).
- **Recommended fix: one shared puzzle formula** (fix plan, section 3), on a new stamp `puzzleScoreRev 3`:
  - Unfinished = 110 × progress (scaled so one step short = 110).
  - Finish = 120 + 30 × speed × efficiency, where speed is measured against a fast but human time.
  - Its numbers are in the proposal grid below. Every finish lands at 120–150, one step short at 110, and random at
    0–14. Half done lands at 50–80 wherever the progress measure counts work along the way; the move puzzles need
    the progress fixes first.
  - About 30 puzzles can move to it as they are. About 10 need a better progress measure first.

### Your phone results, explained

| Game | You saw | Reproduced | Cause | Under the rule |
| --- | --- | --- | --- | --- |
| Slider | 3–4 rows = 0 | 4 rows = 48 at par moves, falling to 0 from 4 × par moves (20–32) | **Formula**, two parts. (1) Rev-1 credit is multiplied by `wasteFactor`, which reaches 0 at 4 × par; par is the 5–8-shift scramble depth, and Undo and Reset count as moves (`scoring.ts:491`, `wordSlide.server.ts:42`). (2) Slider's knots are the harshest of any game (`puzzleBands.data.ts:54`). | 3 rows ≈ 82, 4 rows ≈ 110 |
| Trail | 8/26 = 0; 26/26 = 92 | 0 once wrong tiles outnumber right ones; 92 = a finish with 2–3 s left | **Formula.** Credit is 110 × (right − wrong) ÷ 25, with "right" meaning the exact solution step (`trail.ts:79-82, 147`), so one wrong turn makes every later tile wrong. The finish comes from the knots (91 at the buzzer). Display: the reveal never shows the wrong-tile cost. | 8/26 ≈ 35; 26/26 ≈ 121 |
| Interlock | 15 valid = 112 and 124; 14 valid = 87 | 41 s and 53 s left; 14 tiles in words = 87 at any time | **Formula** (knots: a finish at the buzzer = 90) plus a **phone bug**: Done accepts any valid grid of 3+ tiles (`tileGrid.tsx:229-234`), and the grader stores it as correct (`grade.ts:349`) but scores it as unfinished, discarding the time left. The screens show "14/15 · valid" in gold. | 132 and 136; 14 ≈ 103 |
| Exact | hit = 97–104 | hits with 20–32 s of 75 left; a hit at the buzzer = 89, the same as off by 1 | **Formula** (knots `puzzleBands.data.ts:42` squash "off by 20" to "hit at the buzzer" into 73–89). Display: the intro example still says "Exact hit scores 120 + speed; off by 1 scores 110" (`targetNumber.tsx:152`). | 128–133 |
| Tenfall | 10/10 = 93; 8/10 = 70 | exactly, on kit runs | **Formula.** The tenRev 1 raw score already follows the rule (10/10 = 120 + speed, 8/10 = 97). tenRev 2's map (`tenDrop.ts:458, 467`) squashes it, with a 20-point jump between raw 135 and 137. | 121; 97 |
| Roundabout | all words = 118–119 | a clean finish with 12–19 s of 100 left; 116 at the buzzer | **Formula.** The knots (`puzzleBands.data.ts:20`) put "good" at an unfinished result and "great" at a quarter of the clock left, so most real finishes squeeze into 116–120. | 124–126 |
| Lookout | 4/6 = 54 | exactly: rev-1 credit 88 → 54 | **Formula.** The rev-1 credit (110 × found ÷ 5) already meets the rule; the knots scale it by about 0.69. A finish at the buzzer = 69. | ≈ 88 |
| Nucleus | 4 words = 61 | 4 words worth 9 word points = 61 (four 4-letter words = 18) | **Formula**, two curves stacked (`WORDSMITH_V1_CURVE`, then the rev-2 knots). 150 is reached at 60 word points, so the 140 cap without the all-letters word is not enforced. Display: the intro still says "floor(2.5 × word points)" (`wordsmith.tsx:32`). | ≈ 65–75 (inside Average either way) |
| Swapword | 13/21 tiles = 35 | 10 of 18 placed (13 gold includes 3 that start in place) = 35; one swap short = 51 | **Formula** (knots `puzzleBands.data.ts:40`: the simulated average player's median is a finish, so every unfinished run sits under 51). Display: the board shows 13/21 gold while the leaderboard shows 10/18 placed. | ≈ 61–69 |
| Counterweight | 1 scale = 15 | exactly | **Formula.** Scales are worth 15/25/30/55, any order (`balance.ts:124`), but the stage deals them in order, so one short (scales 1–3) = 70, not 110. A finish at the buzzer = 93. | ≈ 27–37 |
| Operator | 2 equations = 38 | exactly (20 + 30 credit → 38) | **Formula.** Equations are worth 20/30/35/45 (`stagedRounds.ts:42`), and the spam-guard knot makes equation 1 alone worth 10. A finish at the buzzer = 81–82. | ≈ 50–55 |
| Strikeout | 2 words ≈ 45 | 2 words + 1–2 letters = 44–46 | **Formula.** The slope is low (about 0.71 points per credit point), and the 110 cap is reached at 4 words, so word 5's letters earn nothing. A flawless finish at the buzzer = 99. | 44–60 |
| Cryptogrid | 4/12 letters = 32 | exactly | **Formula** (credit 40 → 32). A crack at the buzzer = 81–82. | ≈ 40 |
| Brimful | 1 jug = 44 | one of four jug puzzles solved = 44 | **Formula.** Here the knots are generous (44 > the rule's 30–37). What hurts is that (1) a half-done jug puzzle counts nothing, and (2) running out of a puzzle's moves submits the whole round, losing the time left (`measure.tsx:455-466`). | 30–37 |

None of the 14 is a phone answer or draft bug, and none is a display difference: the number shown is the stored
score. Interlock's 14-tile Done and the stale intro texts are bugs found along the way.

## (b) Games that break the rule, worst first

63 of 74 games break at least one part of the rule. Severity adds up how far each failed part misses: points below the
120 finish floor, distance from 55 at half done and 110 one short, random play above 10, progress or time drops, and
arcade or speed averages outside 60–79. **Integer Pyramid** passes the finish floor but fails the partial scale.

The 11 games that pass every part they are judged on:

- Ballpark (an open game);
- Bonk and Tenfall;
- Coral Pop, Flightpath, Gemstone, High Rise, Jaywalk, Scrumper, Slice and Tempo.

Two notes on that list. Gemstone passes only on separation: its bands look compressed. Nucleus fails only on random
play, and only narrowly (random 4-letter paths: median 6, 90th percentile 27).

<!-- generated:ranking -->
| Rank | Game | Severity | Parts failed |
| --- | --- | --- | --- |
| 1 | Slider | 167 | finish floor 120 (buzzer finish 66 (66–66); lowest finish 57); partial scale (50 % → 0 (target ~55); one short → 48 (target ~110); top unfinished 48) |
| 2 | Turntable | 128 | monotonic (progress drops on 8/15 seeds; time drops on 0; mistakes few 114 → many 94); finish floor 120 (buzzer finish 97 (97–97); lowest finish 91); partial scale (50 % → 0 (target ~55); one short → 66 (target ~110); top unfinished 72) |
| 3 | Swapword | 121 | finish floor 120 (buzzer finish 76 (76–76); lowest finish 66); partial scale (50 % → 30 (target ~55); one short → 51 (target ~110); top unfinished 51) |
| 4 | Exact | 120 | finish floor 120 (buzzer finish 89 (89–89); lowest finish 89); partial scale (50 % → 0 (target ~55); one short → 73 (target ~110); top unfinished 89) |
| 5 | Interlock | 119 | random near 0 (worst strategy median 0, p90 30); monotonic (progress drops on 1/15 seeds; time drops on 0; mistakes few 120 → many 120); finish floor 120 (buzzer finish 90 (90–90); lowest finish 90); partial scale (50 % → 0 (target ~55); one short → 82 (target ~110); top unfinished 84) |
| 6 | Bomb Defusal | 115 | finish floor 120 (buzzer finish 68 (68–68); lowest finish 68); partial scale (50 % → 40 (target ~55); one short → 67 (target ~110); top unfinished 67) |
| 7 | Colour Flood | 115 | random near 0 (worst strategy median 0, p90 90); finish floor 120 (buzzer finish 93 (93–93); lowest finish 90); partial scale (50 % → 32 (target ~55); one short → 73 (target ~110); top unfinished 74) |
| 8 | Lookout | 112 | finish floor 120 (buzzer finish 69 (69–69); lowest finish 69); partial scale (50 % → 41 (target ~55); one short → 68 (target ~110); top unfinished 68) |
| 9 | Jumbled | 110 | monotonic (progress drops on 7/15 seeds; time drops on 0; mistakes few 111 → many 93); finish floor 120 (buzzer finish 95 (95–95); lowest finish 87); partial scale (50 % → 13 (target ~55); one short → 78 (target ~110); top unfinished 78) |
| 10 | Gridlock | 108 | monotonic (progress drops on 4/15 seeds; time drops on 0; mistakes few 121 → many 97); finish floor 120 (buzzer finish 98 (98–98); lowest finish 92); partial scale (50 % → 0 (target ~55); one short → 86 (target ~110); top unfinished 86) |
| 11 | Heave | 102 | monotonic (progress drops on 3/15 seeds; time drops on 0; mistakes few 120 → many 120); finish floor 120 (buzzer finish 96 (96–96); lowest finish 96); partial scale (50 % → 10 (target ~55); one short → 80 (target ~110); top unfinished 80) |
| 12 | Mosaic | 97 | finish floor 120 (buzzer finish 78 (78–78); lowest finish 78); partial scale (50 % → 39 (target ~55); one short → 75 (target ~110); top unfinished 76) |
| 13 | Operator | 96 | finish floor 120 (buzzer finish 81 (81–81); lowest finish 81); partial scale (50 % → 38 (target ~55); one short → 70 (target ~110); top unfinished 70) |
| 14 | Matchmaker | 91 | finish floor 120 (buzzer finish 82 (82–82); lowest finish 82); partial scale (50 % → 35 (target ~55); one short → 82 (target ~110); top unfinished 82) |
| 15 | Cryptogrid | 80 | finish floor 120 (buzzer finish 81 (81–81); lowest finish 81); partial scale (50 % → 48 (target ~55); one short → 81 (target ~110); top unfinished 81) |
| 16 | Safe Cracker | 80 | random near 0 (worst strategy median 0, p90 35); finish floor 120 (buzzer finish 95 (95–95); lowest finish 89); partial scale (50 % → 35 (target ~55); one short → 75 (target ~110); top unfinished 75) |
| 17 | Lamplighter | 77 | random near 0 (worst strategy median 15, p90 53); finish floor 120 (buzzer finish 92 (92–92); lowest finish 92); partial scale (50 % → 61 (target ~55); one short → 91 (target ~110); top unfinished 91) |
| 18 | Counterweight | 76 | finish floor 120 (buzzer finish 93 (93–93); lowest finish 93); partial scale (50 % → 40 (target ~55); one short → 70 (target ~110); top unfinished 70) |
| 19 | Shikaku | 69 | random near 0 (worst strategy median 0, p90 49); finish floor 120 (buzzer finish 98 (98–98); lowest finish 98); partial scale (50 % → 71 (target ~55); one short → 95 (target ~110); top unfinished 97) |
| 20 | Strikeout | 66 | finish floor 120 (buzzer finish 94 (92–99); lowest finish 92); partial scale (50 % → 64 (target ~55); one short → 75 (target ~110); top unfinished 75) |
| 21 | Double Take | 64 | finish floor 120 (buzzer finish 87 (87–87); lowest finish 87); partial scale (50 % → 58 (target ~55); one short → 87 (target ~110); top unfinished 87) |
| 22 | Polypotions | 64 | finish floor 120 (buzzer finish 99 (99–99); lowest finish 99); partial scale (50 % → 76 (target ~55); one short → 87 (target ~110); top unfinished 87) |
| 23 | Tents and Trees | 62 | finish floor 120 (buzzer finish 92 (92–92); lowest finish 92); partial scale (50 % → 65 (target ~55); one short → 91 (target ~110); top unfinished 91) |
| 24 | Trail | 61 | finish floor 120 (buzzer finish 91 (91–91); lowest finish 91); partial scale (50 % → 62 (target ~55); one short → 90 (target ~110); top unfinished 90) |
| 25 | Topsy-Turvy | 61 | finish floor 120 (buzzer finish 100 (100–100); lowest finish 94); partial scale (50 % → 72 (target ~55); one short → 83 (target ~110); top unfinished 84) |
| 26 | Chroma Lines | 60 | finish floor 120 (buzzer finish 89 (89–89); lowest finish 89); partial scale (50 % → 55 (target ~55); one short → 84 (target ~110); top unfinished 84) |
| 27 | Skid | 60 | finish floor 120 (buzzer finish 99 (99–99); lowest finish 92); partial scale (50 % → 70 (target ~55); one short → 84 (target ~110); top unfinished 84) |
| 28 | Don't Break the Chain | 59 | finish floor 120 (buzzer finish 111 (111–112); lowest finish 111); partial scale (50 % → 100 (target ~55); one short → 110 (target ~110); top unfinished 110) |
| 29 | Pipeline | 59 | random near 0 (worst strategy median 6, p90 32); finish floor 120 (buzzer finish 96 (96–96); lowest finish 96); partial scale (50 % → 44 (target ~55); one short → 94 (target ~110); top unfinished 94) |
| 30 | Lightbender | 55 | monotonic (progress drops on 2/15 seeds; time drops on 0; mistakes few 146 → many 112); finish floor 120 (buzzer finish 109 (109–109); lowest finish 97); partial scale (50 % → 80 (target ~55); one short → 91 (target ~110); top unfinished 91) |
| 31 | Blackout | 54 | monotonic (progress drops on 1/15 seeds; time drops on 0; mistakes few 135 → many 111); finish floor 120 (buzzer finish 106 (106–106); lowest finish 95); partial scale (50 % → 70 (target ~55); one short → 79 (target ~110); top unfinished 82) |
| 32 | Tally | 53 | finish floor 120 (buzzer finish 106 (106–106); lowest finish 106); partial scale (50 % → 83 (target ~55); one short → 102 (target ~110); top unfinished 102) |
| 33 | Hanoi | 51 | finish floor 120 (buzzer finish 99 (99–99); lowest finish 98); partial scale (50 % → 48 (target ~55); one short → 86 (target ~110); top unfinished 86) |
| 34 | Tessellate | 47 | finish floor 120 (buzzer finish 95 (95–95); lowest finish 95); partial scale (50 % → 56 (target ~55); one short → 94 (target ~110); top unfinished 94) |
| 35 | Brimful | 44 | random near 0 (worst strategy median 0, p90 44); finish floor 120 (buzzer finish 116 (116–116); lowest finish 112); partial scale (50 % → 78 (target ~55); one short → 100 (target ~110); top unfinished 100) |
| 36 | Rainbow Bridge | 43 | average player 60–79 (average 17 (target 60–79), good 33 (target 90–109), great 58 (target 110–129), near 94 (target 130–149)) |
| 37 | Ascend | 38 | finish floor 120 (buzzer finish 95 (95–96); lowest finish 95) |
| 38 | Bang On | 36 | random near 0 (worst strategy median 27, p90 53); levels separate (two neighbouring levels within 5 points) |
| 39 | Breaker | 34 | average player 60–79 (average 108 (target 60–79), good 95 ✓, great 111 ✓, near 141 ✓); levels separate (two neighbouring levels within 5 points) |
| 40 | Integer Pyramid | 33 | partial scale (50 % → 82 (target ~55); one short → 122 (target ~110); top unfinished 122) |
| 41 | Flash | 32 | random near 0 (worst strategy median 5, p90 68); average player 60–79 (careless 2, below 3, average 55 (target 60–79), good 104 ✓, great 124 ✓, near 143 ✓); levels separate (two neighbouring levels within 5 points) |
| 42 | Labyrinth | 32 | random near 0 (worst strategy median 4, p90 26); finish floor 120 (buzzer finish 99 (99–99); lowest finish 99) |
| 43 | Forage | 31 | random near 0 (worst strategy median 22, p90 63) |
| 44 | Roundabout | 31 | finish floor 120 (buzzer finish 116 (116–116); lowest finish 109); partial scale (50 % → 75 (target ~55); one short → 101 (target ~110); top unfinished 101) |
| 45 | Box Six | 30 | finish floor 120 (buzzer finish 100 (100–100); lowest finish 100) |
| 46 | Eagle Eye | 24 | finish floor 120 (buzzer finish 104 (104–104); lowest finish 104) |
| 47 | Swish | 18 | average player 60–79 (average 97 (target 60–79), good 105 ✓, great 110 ✓, near 144 ✓) |
| 48 | Hover | 16 | average player 60–79 (average 44 (target 60–79), good 82 (target 90–109), great 130 (target 110–129), near 139 ✓) |
| 49 | Letterfall | 14 | random near 0 (worst strategy median 16, p90 40) |
| 50 | Wavefront | 11 | average player 60–79 (average 85 (target 60–79), good 80 (target 90–109), great 124 ✓, near 133 ✓); levels separate (two neighbouring levels within 5 points) |
| 51 | Meteor | 9 | average player 60–79 (average 83 (target 60–79), good 102 ✓, great 137 (target 110–129), near 126 (target 130–149)); levels separate (two neighbouring levels within 5 points) |
| 52 | Grappler | 8 | average player 60–79 (average 87 (target 60–79), good 99 ✓, great 123 ✓, near 131 ✓) |
| 53 | Orbit | 7 | average player 60–79 (average 86 (target 60–79), good 102 ✓, great 132 (target 110–129), near 140 ✓) |
| 54 | Checkout | 6 | finish floor 120 (buzzer finish 116 (116–116); lowest finish 116) |
| 55 | Pinball | 6 | average player 60–79 (average 80 (target 60–79), good 112 (target 90–109), great 110 ✓, near 139 ✓); levels separate (two neighbouring levels within 5 points) |
| 56 | Roofbound | 6 | average player 60–79 (average 54 (target 60–79), good 100 ✓, great 120 ✓, near 150 (target 130–149)) |
| 57 | Pull! | 5 | levels separate (two neighbouring levels within 5 points) |
| 58 | Mixed Signals | 5 | levels separate (two neighbouring levels within 5 points) |
| 59 | Ball Tracker | 5 | levels separate (two neighbouring levels within 5 points) |
| 60 | Fission | 5 | levels separate (two neighbouring levels within 5 points) |
| 61 | Rally | 5 | levels separate (two neighbouring levels within 5 points) |
| 62 | Tilt | 5 | levels separate (two neighbouring levels within 5 points) |
| 63 | Nucleus | 1 | random near 0 (worst strategy median 6, p90 27) |
<!-- /generated:ranking -->

## (c) All games side by side

Median score per cell; ⚠ marks a cell outside the rule.

- **Puzzles** are judged on the progress columns, the finishes and random:
  - 25 % should be 15–40;
  - 50 % should be 40–70;
  - 75 % should be 65–95;
  - one short should be 95–115;
  - every finish should be 120+, and a 90 %-left perfect finish 145+;
  - random should be ≤ 10.
- **Speed, engine and arcade games** are judged on the bot columns: average 60–79, good 90–109, great 110–129, near
  130–149, with ⚠ more than 10 points outside.
- **Random** is the worst blind strategy. ˢ: the game has only screen-reading strategies (reported, not judged).
- **Arcade random** is the run with no input.
- **"Perfect"** is a clean finish with 90 % of the clock left: what the formula gives, not what people reach.

<!-- generated:grid -->
| Game | Cat | 25 % | 50 % | 75 % | one short | finish at buzzer | finish 50 % left | perfect (90 % left) | random | avg | good | great | near |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Cryptogrid | word | 19 | 48 | 68 | **81** ⚠ | **81** ⚠ | **116** ⚠ | 150 | 0 | 70 | 104 | 121 | 141 |
| Forage | word | 49 | 100 | 122 | — | — | — | — | **22** ⚠ | 78 | 96 | 119 | 139 |
| Interlock | word | **0** ⚠ | **0** ⚠ | 70 | **82** ⚠ | **90** ⚠ | 120 | 150 | 0 | 70 | 104 | 126 | 143 |
| Letterfall | word | — | — | — | — | — | — | — | **16** ⚠ | 79 | 110 | 120 | 128 |
| Lookout | word | **14** ⚠ | 41 | **54** ⚠ | **68** ⚠ | **69** ⚠ | **103** ⚠ | 150 | 0 | 68 | 104 | 119 | 141 |
| Nucleus | word | 45 | 88 | 120 | — | — | — | — | 6 | 72 | 98 | 120 | 146 |
| Roundabout | word | 35 | **75** ⚠ | 90 | 101 | **116** ⚠ | 140 | 150 | 0 | 70 | 100 | 120 | 138 |
| Slider | word | **0** ⚠ | **0** ⚠ | **0** ⚠ | **48** ⚠ | **66** ⚠ | **100** ⚠ | **139** ⚠ | 0 | 79 | 101 | 127 | 138 |
| Strikeout | word | 23 | 64 | 70 | **75** ⚠ | **94** ⚠ | 127 | 149 | 6ˢ | 75 | 99 | 117 | 139 |
| Swapword | word | **13** ⚠ | **30** ⚠ | **41** ⚠ | **51** ⚠ | **76** ⚠ | **103** ⚠ | 150 | 0 | 68 | 99 | 124 | 141 |
| Ballpark | number | 25 | 57 | 86 | — | — | — | — | 6 | 69 | 99 | 125 | 145 |
| Brimful | number | **44** ⚠ | **78** ⚠ | **100** ⚠ | 100 | **116** ⚠ | 135 | 150 | 0 | 78 | 112 | 121 | 143 |
| Checkout | number | 33 | 70 | **100** ⚠ | 100 | **116** ⚠ | 137 | 150 | 0 | 70 | 100 | 120 | 140 |
| Counterweight | number | 15 | 40 | 70 | **70** ⚠ | **93** ⚠ | 134 | 150 | 0 | 70 | 102 | 119 | 140 |
| Exact | number | **0** ⚠ | **0** ⚠ | **0** ⚠ | **73** ⚠ | **89** ⚠ | **110** ⚠ | 150 | 0 | 85 | 104 | 121 | 142 |
| Integer Pyramid | number | **48** ⚠ | **82** ⚠ | **106** ⚠ | **122** ⚠ | 123 | 150 | 150 | 6 | 66 | 100 | 121 | 139 |
| Operator | number | **10** ⚠ | **38** ⚠ | 70 | **70** ⚠ | **81** ⚠ | **114** ⚠ | 150 | 0 | 70 | 99 | 117 | 140 |
| Tenfall | number | — | — | — | — | — | — | — | 2 | 70 | 100 | 117 | 141 |
| Trail | number | 28 | 62 | 79 | **90** ⚠ | **91** ⚠ | 127 | 150 | 0 | 71 | 102 | 122 | 142 |
| Ascend | speed | 36 | 70 | 84 | 95 | **95** ⚠ | 125 | 150 | 0 | 74 | 106 | 117 | 139 |
| Bang On | speed | — | — | — | — | — | — | — | **27** ⚠ | 68 | 102 | 127 | 137 |
| Bonk | speed | — | — | — | — | — | — | — | 0 | 71 | 98 | 122 | 136 |
| Don't Break the Chain | speed | **81** ⚠ | **100** ⚠ | **106** ⚠ | 110 | **111** ⚠ | 139 | — | 0 | 71 | 100 | 125 | 142 |
| Flash | speed | — | — | — | — | — | — | — | 5 | 55 | 104 | 124 | 143 |
| Pull! | speed | — | — | — | — | — | — | — | 0 | 63 | 107 | **150** ⚠ | 150 |
| Double Take | attention | 29 | 58 | 78 | **87** ⚠ | **87** ⚠ | 124 | 150 | 0 | 69 | 99 | 122 | 141 |
| Eagle Eye | attention | 35 | 70 | 88 | 102 | **104** ⚠ | 140 | 150 | 0 | 75 | 102 | 124 | 140 |
| Labyrinth | attention | 29 | 65 | 83 | 98 | **99** ⚠ | 147 | 150 | 4 | 73 | 102 | 122 | 141 |
| Matchmaker | attention | **7** ⚠ | **35** ⚠ | **63** ⚠ | **82** ⚠ | **82** ⚠ | **109** ⚠ | 150 | 0 | 73 | 99 | 120 | 140 |
| Mixed Signals | attention | — | — | — | — | — | — | — | 0 | 70 | 101 | 105 | 138 |
| Tally | attention | 31 | **83** ⚠ | **102** ⚠ | 102 | **106** ⚠ | 120 | 150 | 5ˢ | 77 | 113 | 120 | 141 |
| Chroma Lines | pattern | 27 | 55 | 76 | **84** ⚠ | **89** ⚠ | 128 | 150 | 9 | 71 | 98 | 119 | 135 |
| Gridlock | pattern | **0** ⚠ | **0** ⚠ | 74 | **86** ⚠ | **98** ⚠ | 127 | 150 | 0 | 53 | 101 | 124 | 141 |
| Heave | pattern | **10** ⚠ | **10** ⚠ | 70 | **80** ⚠ | **96** ⚠ | 120 | 150 | 0 | 70 | 100 | 113 | 137 |
| Jumbled | pattern | **12** ⚠ | **13** ⚠ | **39** ⚠ | **78** ⚠ | **95** ⚠ | **115** ⚠ | 150 | 0 | 56 | 106 | 119 | 141 |
| Lightbender | pattern | **70** ⚠ | **80** ⚠ | 86 | **91** ⚠ | **109** ⚠ | 131 | 150 | 0 | 70 | 100 | 107 | 137 |
| Pipeline | pattern | **10** ⚠ | 44 | 77 | **94** ⚠ | **96** ⚠ | 145 | 150 | 6 | 69 | 100 | 119 | 139 |
| Skid | pattern | 31 | 70 | 77 | **84** ⚠ | **99** ⚠ | 134 | 150 | 0 | 66 | 100 | 121 | 141 |
| Tessellate | pattern | 28 | 56 | 78 | **94** ⚠ | **95** ⚠ | 134 | 150 | 0 | 70 | 100 | 116 | 140 |
| Topsy-Turvy | pattern | 35 | **72** ⚠ | 78 | **83** ⚠ | **100** ⚠ | 128 | 150 | 0 | 63 | 99 | 120 | 141 |
| Turntable | pattern | **0** ⚠ | **0** ⚠ | **0** ⚠ | **66** ⚠ | **97** ⚠ | **114** ⚠ | 150 | 0 | 66 | 110 | 126 | 139 |
| Blackout | logic | 28 | 70 | 74 | **79** ⚠ | **106** ⚠ | 135 | 150 | 0 | 70 | 74 | 117 | 137 |
| Bomb Defusal | logic | **13** ⚠ | 40 | **54** ⚠ | **67** ⚠ | **68** ⚠ | **101** ⚠ | 150 | 0 | 67 | 99 | 125 | 141 |
| Box Six | logic | 31 | 63 | 82 | 96 | **100** ⚠ | 137 | 150 | 0 | 73 | 105 | 122 | 144 |
| Colour Flood | logic | **7** ⚠ | **32** ⚠ | **61** ⚠ | **73** ⚠ | **93** ⚠ | **114** ⚠ | 150 | 0 | 71 | 100 | 118 | 139 |
| Hanoi | logic | **0** ⚠ | 48 | 71 | **86** ⚠ | **99** ⚠ | 126 | 150 | 0 | 53 | 102 | 120 | 137 |
| Lamplighter | logic | 31 | 61 | 80 | **91** ⚠ | **92** ⚠ | 126 | 150 | **15** ⚠ | 68 | 98 | 122 | 136 |
| Mosaic | logic | 19 | **39** ⚠ | **60** ⚠ | **75** ⚠ | **78** ⚠ | **107** ⚠ | 150 | 0 | 67 | 104 | 121 | 139 |
| Polypotions | logic | **71** ⚠ | **76** ⚠ | 82 | **87** ⚠ | **99** ⚠ | 127 | 150 | 0 | 71 | 100 | 118 | 138 |
| Safe Cracker | logic | **0** ⚠ | **35** ⚠ | 70 | **75** ⚠ | **95** ⚠ | **110** ⚠ | 150 | 0 | 75 | 100 | 122 | 140 |
| Shikaku | logic | 34 | **71** ⚠ | 83 | 95 | **98** ⚠ | 135 | 150 | 0 | 72 | 100 | 119 | 139 |
| Tents and Trees | logic | 32 | 65 | 82 | **91** ⚠ | **92** ⚠ | 122 | 150 | 0 | 54 | 104 | 119 | 137 |
| Ball Tracker | arcade | — | — | — | — | — | — | — | 0 | 70 | 97 | **142** ⚠ | 135 |
| Breaker | arcade | — | — | — | — | — | — | — | 0 | **108** ⚠ | 95 | 111 | 141 |
| Coral Pop | arcade | — | — | — | — | — | — | — | 0 | 72 | **120** ⚠ | 129 | 139 |
| Fission | arcade | — | — | — | — | — | — | — | 0 | 77 | 101 | 116 | **101** ⚠ |
| Flightpath | arcade | — | — | — | — | — | — | — | 0 | 67 | 83 | 119 | 142 |
| Gemstone | arcade | — | — | — | — | — | — | — | 0 | 70 | 90 | **98** ⚠ | **105** ⚠ |
| Grappler | arcade | — | — | — | — | — | — | — | 0 | 87 | 99 | 123 | 131 |
| High Rise | arcade | — | — | — | — | — | — | — | 0 | 68 | 102 | 124 | 140 |
| Hover | arcade | — | — | — | — | — | — | — | 0 | **44** ⚠ | 82 | 130 | 139 |
| Jaywalk | arcade | — | — | — | — | — | — | — | 0 | 71 | 110 | 128 | 143 |
| Meteor | arcade | — | — | — | — | — | — | — | 0 | 83 | 102 | 137 | 126 |
| Orbit | arcade | — | — | — | — | — | — | — | 0 | 86 | 102 | 132 | 140 |
| Pinball | arcade | — | — | — | — | — | — | — | 0 | 80 | 112 | 110 | 139 |
| Rainbow Bridge | arcade | — | — | — | — | — | — | — | 0 | **17** ⚠ | **33** ⚠ | **58** ⚠ | **94** ⚠ |
| Rally | arcade | — | — | — | — | — | — | — | 0 | 73 | 81 | **142** ⚠ | 145 |
| Roofbound | arcade | — | — | — | — | — | — | — | 0 | 54 | 100 | 120 | 150 |
| Scrumper | arcade | — | — | — | — | — | — | — | 0 | 79 | 96 | 111 | 129 |
| Slice | arcade | — | — | — | — | — | — | — | 0 | 78 | 97 | 122 | 129 |
| Swish | arcade | — | — | — | — | — | — | — | 0 | **97** ⚠ | 105 | 110 | 144 |
| Tempo | arcade | — | — | — | — | — | — | — | 0 | 70 | 97 | 123 | 140 |
| Tilt | arcade | — | — | — | — | — | — | — | 0 | 79 | 80 | 126 | **69** ⚠ |
| Wavefront | arcade | — | — | — | — | — | — | — | 0 | 85 | 80 | 124 | 133 |
<!-- /generated:grid -->

## (d) Per-game detail

Each game lists what progress means in its grader, every level's median and range, and pass or fail on each part. For
puzzles, "progress" levels are shares of a clean solve's actions. In move puzzles (Gridlock, Heave, Jumbled, Turntable,
Blackout, Lightbender), a solve passes through boards that score lower before they score higher. Those drops are real:
the score falls while the player is on the right path.

<!-- generated:detail -->
#### Cryptogrid (`codeword`, word, finish puzzle) — 510 runs, 15 seeds

Progress means: right letters placed, 110 × right ÷ (hidden − 1), −5 per wrong letter on the grid

| Level | median (min–max) |
| --- | --- |
| nothing | 0 (0–0) |
| 10 % | 9 (0–10) |
| 25 % | 19 (18–24) |
| 40 % | 35 (32–39) |
| 50 % | 48 (44–49) |
| 60 % | 56 (51–58) |
| 75 % | 68 (66–71) |
| 90 % | 76 (75–81) |
| two short | 75 (74–76) |
| one short | 81 (81–81) |
| finish, 90 % left | 150 (150–150) |
| finish, 75 % left | 144 (144–144) |
| finish, 50 % left | 116 (116–116) |
| finish, 25 % left | 95 (95–95) |
| finish, 10 % left | 87 (87–87) |
| finish at the buzzer | 81 (81–81) |
| finish, few mistakes | 116 (116–116) |
| finish, some mistakes | 116 (116–116) |
| finish, many mistakes | 116 (116–116) |
| half done, then undone | 0 (0–0) |
| no input | 0 (0–0) |
| phone: time-out one short | 81 (81–81) |
| phone: reload at half | 40 (39–44) |
| phone: reload, then one action | 9 (7–11) |
| kit careless | 25 (0–74) |
| kit below average | 56 (33–81) |
| kit average | 70 (44–91) |
| kit good | 104 (90–119) |
| kit great | 121 (104–133) |
| kit near perfect | 141 (127–150) |
| random: frequency-fill (reads the screen) | 0 (0–9) |
| random: random-fill | 0 (0–0) |
| random: random-reassign | 0 (0–0) |

150 on a clean finish needs: 79 % left (26 s of 120 s).

- PASS room = practice: 510/510 identical
- n/a screen-reading strategies (reported): frequency-fill median 0
- PASS random near 0: worst strategy median 0, p90 0
- PASS monotonic: progress drops on 0/15 seeds; time drops on 0; mistakes few 116 → many 116
- **FAIL** finish floor 120: buzzer finish 81 (81–81); lowest finish 81
- **FAIL** partial scale: 50 % → 48 (target ~55); one short → 81 (target ~110); top unfinished 81

#### Forage (`wordhunt`, word, no finish state) — 315 runs, 15 seeds

Progress means: no finish state: word points (curve, then the rev-2 knots)

| Level | median (min–max) |
| --- | --- |
| nothing | 0 (0–0) |
| 10 % | 6 (4–6) |
| 25 % | 49 (36–63) |
| 40 % | 88 (81–92) |
| 50 % | 100 (92–109) |
| 60 % | 109 (101–119) |
| 75 % | 122 (114–131) |
| 90 % | 131 (124–141) |
| every action (no finish) | 141 (130–147) |
| no input | 0 (0–0) |
| phone: time-out one short | 141 (130–147) |
| phone: reload at half | 100 (92–109) |
| phone: reload, then one action | 2 (2–2) |
| kit careless | 8 (0–49) |
| kit below average | 36 (4–63) |
| kit average | 78 (49–88) |
| kit good | 96 (92–111) |
| kit great | 119 (109–124) |
| kit near perfect | 139 (133–147) |
| random: random-paths-4 | 22 (4–63) |
| random: random-paths-4to6 | 2 (0–8) |

- PASS room = practice: 315/315 identical
- **FAIL** random near 0: worst strategy median 22, p90 63
- PASS monotonic: progress drops on 0/15 seeds; time drops on 0; mistakes few — → many —
- PASS average player 60–79: careless 8, below 36, average 78 ✓, good 96 ✓, great 119 ✓, near 139 ✓
- PASS levels separate: each level ≥ 5 above the one below

#### Interlock (`tilegrid`, word, finish puzzle) — 510 runs, 15 seeds

Progress means: tiles placed inside valid words, out of 15 (rev-1 credit); a valid grid of any size can be submitted with Done

| Level | median (min–max) |
| --- | --- |
| nothing | 0 (0–0) |
| 10 % | 0 (0–0) |
| 25 % | 0 (0–0) |
| 40 % | 0 (0–0) |
| 50 % | 0 (0–60) |
| 60 % | 70 (70–75) |
| 75 % | 70 (60–80) |
| 90 % | 82 (80–84) |
| two short | 82 (80–84) |
| one short | 82 (80–84) |
| finish, 90 % left | 150 (150–150) |
| finish, 75 % left | 150 (150–150) |
| finish, 50 % left | 120 (120–120) |
| finish, 25 % left | 99 (99–99) |
| finish, 10 % left | 93 (93–93) |
| finish at the buzzer | 90 (90–90) |
| finish, few mistakes | 120 (120–120) |
| finish, some mistakes | 120 (120–120) |
| finish, many mistakes | 120 (120–120) |
| half done, then undone | 0 (0–0) |
| no input | 0 (0–0) |
| phone: time-out one short | 82 (80–84) |
| phone: reload at half | 0 (0–60) |
| phone: reload, then one action | 0 (0–0) |
| kit careless | 0 (0–0) |
| kit below average | 0 (0–70) |
| kit average | 70 (0–82) |
| kit good | 104 (95–114) |
| kit great | 126 (116–134) |
| kit near perfect | 143 (132–150) |
| random: random-cells | 0 (0–30) |
| random: random-cross | 0 (0–0) |
| random: tray-in-rows | 0 (0–30) |

150 on a clean finish needs: 74 % left (26 s of 100 s).

- PASS room = practice: 510/510 identical
- **FAIL** random near 0: worst strategy median 0, p90 30
- **FAIL** monotonic: progress drops on 1/15 seeds; time drops on 0; mistakes few 120 → many 120
- **FAIL** finish floor 120: buzzer finish 90 (90–90); lowest finish 90
- **FAIL** partial scale: 50 % → 0 (target ~55); one short → 82 (target ~110); top unfinished 84

#### Letterfall (`wordfall`, word, speed / engine game) — 135 runs, 15 seeds

| Level | median (min–max) |
| --- | --- |
| no input | 0 (0–0) |
| kit careless | 30 (3–63) |
| kit below average | 50 (23–115) |
| kit average | 79 (33–120) |
| kit good | 110 (76–145) |
| kit great | 120 (97–140) |
| kit near perfect | 128 (94–150) |
| random: random-chains+enter | 16 (3–46) |
| random: random-taps+enter | 0 (0–3) |

- PASS room = practice: 135/135 identical
- **FAIL** random near 0: worst strategy median 16, p90 40
- PASS average player 60–79: careless 30, below 50, average 79 ✓, good 110 (target 90–109), great 120 ✓, near 128 (target 130–149)
- PASS levels separate: each level ≥ 5 above the one below

#### Lookout (`wordsearch`, word, finish puzzle) — 480 runs, 15 seeds

Progress means: themed words found: 110 × found ÷ (total − 1)

| Level | median (min–max) |
| --- | --- |
| nothing | 0 (0–0) |
| 10 % | 0 (0–0) |
| 25 % | 14 (14–14) |
| 40 % | 27 (27–27) |
| 50 % | 41 (41–41) |
| 60 % | 41 (41–41) |
| 75 % | 54 (54–54) |
| 90 % | 68 (68–68) |
| two short | 54 (54–54) |
| one short | 68 (68–68) |
| finish, 90 % left | 150 (150–150) |
| finish, 75 % left | 139 (139–139) |
| finish, 50 % left | 103 (103–103) |
| finish, 25 % left | 85 (85–85) |
| finish, 10 % left | 75 (75–75) |
| finish at the buzzer | 69 (69–69) |
| finish, few mistakes | 103 (103–103) |
| finish, some mistakes | 103 (103–103) |
| finish, many mistakes | 103 (103–103) |
| no input | 0 (0–0) |
| phone: time-out one short | 68 (68–68) |
| phone: reload at half | 27 (27–27) |
| phone: reload, then one action | 14 (14–14) |
| kit careless | 41 (26–41) |
| kit below average | 54 (26–82) |
| kit average | 68 (37–88) |
| kit good | 104 (93–117) |
| kit great | 119 (105–128) |
| kit near perfect | 141 (137–149) |
| random: random-drags | 0 (0–0) |
| random: sweep-every-cell | 0 (0–0) |

150 on a clean finish needs: 83 % left (21 s of 120 s).

- PASS room = practice: 480/480 identical
- PASS random near 0: worst strategy median 0, p90 0
- PASS monotonic: progress drops on 0/15 seeds; time drops on 0; mistakes few 103 → many 103
- **FAIL** finish floor 120: buzzer finish 69 (69–69); lowest finish 69
- **FAIL** partial scale: 50 % → 41 (target ~55); one short → 68 (target ~110); top unfinished 68

#### Nucleus (`wordsmith`, word, no finish state) — 330 runs, 15 seeds

Progress means: no finish state: word points (WORDSMITH_V1_CURVE, then the rev-2 knots)

| Level | median (min–max) |
| --- | --- |
| nothing | 0 (0–0) |
| 10 % | 6 (3–9) |
| 25 % | 45 (9–76) |
| 40 % | 78 (27–98) |
| 50 % | 88 (45–112) |
| 60 % | 100 (53–124) |
| 75 % | 120 (70–138) |
| 90 % | 124 (87–150) |
| every action (no finish) | 148 (124–150) |
| no input | 0 (0–0) |
| phone: time-out one short | 148 (124–150) |
| phone: reload at half | 88 (45–112) |
| phone: reload, then one action | 3 (3–3) |
| kit careless | 18 (6–37) |
| kit below average | 45 (27–81) |
| kit average | 72 (37–93) |
| kit good | 98 (87–126) |
| kit great | 120 (100–130) |
| kit near perfect | 146 (126–150) |
| random: random-4 | 3 (0–6) |
| random: random-4-centre | 6 (0–37) |
| random: random-4to6-centre | 3 (0–18) |

- PASS room = practice: 330/330 identical
- **FAIL** random near 0: worst strategy median 6, p90 27
- PASS monotonic: progress drops on 0/15 seeds; time drops on 0; mistakes few — → many —
- PASS average player 60–79: careless 18, below 45, average 72 ✓, good 98 ✓, great 120 ✓, near 146 ✓
- PASS levels separate: each level ≥ 5 above the one below

#### Roundabout (`letterwheel`, word, finish puzzle) — 495 runs, 15 seeds

Progress means: distinct slot words: 12 each for the first 6, then 5 each, capped at 110, −3 per miss over 5

| Level | median (min–max) |
| --- | --- |
| nothing | 0 (0–0) |
| 10 % | 12 (12–12) |
| 25 % | 35 (35–35) |
| 40 % | 58 (47–58) |
| 50 % | 75 (70–75) |
| 60 % | 80 (75–80) |
| 75 % | 90 (85–90) |
| 90 % | 100 (90–100) |
| two short | 100 (90–100) |
| one short | 101 (95–101) |
| finish, 90 % left | 150 (150–150) |
| finish, 75 % left | 150 (150–150) |
| finish, 50 % left | 140 (140–140) |
| finish, 25 % left | 120 (120–120) |
| finish, 10 % left | 118 (118–118) |
| finish at the buzzer | 116 (116–116) |
| finish, few mistakes | 140 (140–140) |
| finish, some mistakes | 140 (140–140) |
| finish, many mistakes | 140 (109–140) |
| no input | 0 (0–0) |
| phone: time-out one short | 101 (95–101) |
| phone: reload at half | 70 (58–70) |
| phone: reload, then one action | 12 (12–12) |
| kit careless | 23 (0–47) |
| kit below average | 47 (23–70) |
| kit average | 70 (47–80) |
| kit good | 100 (90–117) |
| kit great | 120 (118–131) |
| kit near perfect | 138 (130–143) |
| random: random-3 | 0 (0–0) |
| random: random-3to5 | 0 (0–0) |
| random: sweep-3 | 0 (0–0) |

150 on a clean finish needs: 61 % left (39 s of 100 s).

- PASS room = practice: 495/495 identical
- PASS random near 0: worst strategy median 0, p90 0
- PASS monotonic: progress drops on 0/15 seeds; time drops on 0; mistakes few 140 → many 140
- **FAIL** finish floor 120: buzzer finish 116 (116–116); lowest finish 109
- **FAIL** partial scale: 50 % → 75 (target ~55); one short → 101 (target ~110); top unfinished 101

#### Slider (`wordslide`, word, finish puzzle) — 495 runs, 15 seeds

Progress means: rows made into words different from the start, cut by wasted moves (wasteFactor reaches 0 at 4 × par; Undo and Reset count)

| Level | median (min–max) |
| --- | --- |
| nothing | 0 (0–0) |
| 10 % | 0 (0–0) |
| 25 % | 0 (0–0) |
| 40 % | 0 (0–15) |
| 50 % | 0 (0–15) |
| 60 % | 0 (0–15) |
| 75 % | 0 (0–48) |
| 90 % | 48 (0–48) |
| two short | 0 (0–48) |
| one short | 48 (0–48) |
| finish, 90 % left | 139 (139–139) |
| finish, 75 % left | 115 (115–115) |
| finish, 50 % left | 100 (100–100) |
| finish, 25 % left | 72 (72–72) |
| finish, 10 % left | 68 (68–68) |
| finish at the buzzer | 66 (66–66) |
| finish, few mistakes | 100 (66–100) |
| finish, some mistakes | 100 (57–100) |
| finish, many mistakes | 59 (57–70) |
| half done, then undone | 0 (0–0) |
| no input | 0 (0–0) |
| phone: time-out one short | 48 (0–48) |
| phone: reload at half | 0 (0–15) |
| phone: reload, then one action | 0 (0–0) |
| kit careless | 50 (0–66) |
| kit below average | 62 (53–106) |
| kit average | 79 (58–114) |
| kit good | 101 (69–127) |
| kit great | 127 (77–135) |
| kit near perfect | 138 (104–149) |
| random: random-shifts | 0 (0–0) |
| random: spin-rows-lock-green (reads the screen) | 0 (0–0) |

150 on a clean finish needs: 96 % left (4 s of 100 s).

- PASS room = practice: 495/495 identical
- n/a screen-reading strategies (reported): spin-rows-lock-green median 0
- PASS random near 0: worst strategy median 0, p90 0
- PASS monotonic: progress drops on 0/15 seeds; time drops on 0; mistakes few 100 → many 59
- **FAIL** finish floor 120: buzzer finish 66 (66–66); lowest finish 57
- **FAIL** partial scale: 50 % → 0 (target ~55); one short → 48 (target ~110); top unfinished 48

#### Strikeout (`strikeout`, word, finish puzzle) — 495 runs, 15 seeds

Progress means: 30 a solved word + 2 a found letter, capped at 110 (reached at 4 words)

| Level | median (min–max) |
| --- | --- |
| nothing | 0 (0–0) |
| 10 % | 1 (0–21) |
| 25 % | 23 (3–44) |
| 40 % | 44 (23–64) |
| 50 % | 64 (26–67) |
| 60 % | 66 (43–75) |
| 75 % | 70 (64–75) |
| 90 % | 75 (66–75) |
| two short | 75 (66–75) |
| one short | 75 (75–75) |
| finish, 90 % left | 149 (147–150) |
| finish, 75 % left | 144 (142–150) |
| finish, 50 % left | 127 (121–143) |
| finish, 25 % left | 100 (98–122) |
| finish, 10 % left | 96 (95–105) |
| finish at the buzzer | 94 (92–99) |
| finish, few mistakes | 121 (105–143) |
| finish, some mistakes | 121 (96–140) |
| finish, many mistakes | 105 (95–143) |
| no input | 0 (0–0) |
| phone: time-out one short | 75 (75–75) |
| phone: reload at half | 47 (26–66) |
| phone: reload, then one action | 1 (0–21) |
| kit careless | 47 (4–75) |
| kit below average | 67 (64–75) |
| kit average | 75 (44–111) |
| kit good | 99 (75–140) |
| kit great | 117 (102–147) |
| kit near perfect | 139 (118–150) |
| random: alphabet (reads the screen) | 4 (1–21) |
| random: frequency-order (reads the screen) | 6 (3–27) |
| random: random-letters (reads the screen) | 4 (0–6) |

150 on a clean finish needs: 90 % left (10 s of 100 s).

- PASS room = practice: 495/495 identical
- n/a screen-reading strategies (reported): alphabet median 4, frequency-order median 6, random-letters median 4
- PASS monotonic: progress drops on 0/15 seeds; time drops on 0; mistakes few 121 → many 105
- **FAIL** finish floor 120: buzzer finish 94 (92–99); lowest finish 92
- **FAIL** partial scale: 50 % → 64 (target ~55); one short → 75 (target ~110); top unfinished 75

#### Swapword (`swapword`, word, finish puzzle) — 495 runs, 15 seeds

Progress means: tiles placed minus tiles moved out of place, × 110 ÷ (tiles to place − 2)

| Level | median (min–max) |
| --- | --- |
| nothing | 0 (0–0) |
| 10 % | 4 (0–9) |
| 25 % | 13 (9–17) |
| 40 % | 21 (17–30) |
| 50 % | 30 (21–33) |
| 60 % | 34 (30–39) |
| 75 % | 41 (39–45) |
| 90 % | 51 (45–51) |
| two short | 45 (45–48) |
| one short | 51 (51–51) |
| finish, 90 % left | 150 (150–150) |
| finish, 75 % left | 138 (138–138) |
| finish, 50 % left | 103 (103–103) |
| finish, 25 % left | 89 (89–89) |
| finish, 10 % left | 81 (81–81) |
| finish at the buzzer | 76 (76–76) |
| finish, few mistakes | 103 (78–103) |
| finish, some mistakes | 91 (69–103) |
| finish, many mistakes | 78 (36–98) |
| no input | 0 (0–0) |
| phone: time-out one short | 51 (51–51) |
| phone: reload at half | 26 (17–32) |
| phone: reload, then one action | 4 (4–9) |
| kit careless | 32 (4–42) |
| kit below average | 45 (30–84) |
| kit average | 68 (42–96) |
| kit good | 99 (84–121) |
| kit great | 124 (66–135) |
| kit near perfect | 141 (110–148) |
| random: random-swaps | 0 (0–13) |
| random: swap-amber (reads the screen) | 16 (4–30) |
| random: swap-non-green (reads the screen) | 17 (0–33) |

150 on a clean finish needs: 83 % left (20 s of 120 s).

- PASS room = practice: 495/495 identical
- n/a screen-reading strategies (reported): swap-non-green median 17, swap-amber median 16
- PASS random near 0: worst strategy median 0, p90 4
- PASS monotonic: progress drops on 0/15 seeds; time drops on 0; mistakes few 103 → many 83
- **FAIL** finish floor 120: buzzer finish 76 (76–76); lowest finish 66
- **FAIL** partial scale: 50 % → 30 (target ~55); one short → 51 (target ~110); top unfinished 51

#### Ballpark (`numline`, number, no finish state) — 345 runs, 15 seeds

Progress means: no finish state: accuracy of each number placed on the line (rev-1 score is the result)

| Level | median (min–max) |
| --- | --- |
| nothing | 0 (0–0) |
| 10 % | 8 (8–8) |
| 25 % | 25 (25–25) |
| 40 % | 49 (49–49) |
| 50 % | 57 (56–57) |
| 60 % | 73 (72–73) |
| 75 % | 86 (86–86) |
| 90 % | 100 (99–100) |
| every action (no finish) | 115 (114–115) |
| no input | 0 (0–0) |
| phone: time-out one short | 115 (114–115) |
| phone: reload at half | 57 (56–57) |
| phone: reload, then one action | 8 (8–8) |
| kit careless | 32 (17–42) |
| kit below average | 46 (25–62) |
| kit average | 69 (52–87) |
| kit good | 99 (82–118) |
| kit great | 125 (105–139) |
| kit near perfect | 145 (129–148) |
| random: all-left-end | 0 (0–0) |
| random: all-middle | 6 (0–16) |
| random: all-right-end | 0 (0–4) |
| random: random | 6 (0–20) |

- PASS room = practice: 345/345 identical
- PASS random near 0: worst strategy median 6, p90 18
- PASS monotonic: progress drops on 0/15 seeds; time drops on 0; mistakes few — → many —
- PASS average player 60–79: careless 32, below 46, average 69 ✓, good 99 ✓, great 125 ✓, near 145 ✓
- PASS levels separate: each level ≥ 5 above the one below

#### Brimful (`measure`, number, finish puzzle) — 495 runs, 15 seeds

Progress means: jug puzzles solved in order, worth 30 / 35 / 45; pours inside a puzzle count nothing

| Level | median (min–max) |
| --- | --- |
| nothing | 0 (0–0) |
| 10 % | 0 (0–0) |
| 25 % | 44 (44–44) |
| 40 % | 78 (78–78) |
| 50 % | 78 (78–78) |
| 60 % | 78 (78–100) |
| 75 % | 100 (100–100) |
| 90 % | 100 (100–100) |
| two short | 100 (100–100) |
| one short | 100 (100–100) |
| finish, 90 % left | 150 (150–150) |
| finish, 75 % left | 150 (150–150) |
| finish, 50 % left | 135 (135–135) |
| finish, 25 % left | 121 (121–121) |
| finish, 10 % left | 118 (118–118) |
| finish at the buzzer | 116 (116–116) |
| finish, few mistakes | 121 (100–135) |
| finish, some mistakes | 119 (78–128) |
| finish, many mistakes | 0 (0–100) |
| no input | 0 (0–0) |
| phone: time-out one short | 100 (100–100) |
| phone: reload at half | 78 (78–78) |
| phone: reload, then one action | 0 (0–0) |
| kit careless | 0 (0–44) |
| kit below average | 44 (0–78) |
| kit average | 78 (0–100) |
| kit good | 112 (78–121) |
| kit great | 121 (100–137) |
| kit near perfect | 143 (132–147) |
| random: random-actions | 0 (0–44) |
| random: random-actions-fast | 0 (0–0) |
| random: sweep | 0 (0–0) |

150 on a clean finish needs: 70 % left (35 s of 120 s).

- PASS room = practice: 495/495 identical
- **FAIL** random near 0: worst strategy median 0, p90 44
- PASS monotonic: progress drops on 0/15 seeds; time drops on 0; mistakes few 121 → many —
- **FAIL** finish floor 120: buzzer finish 116 (116–116); lowest finish 112
- **FAIL** partial scale: 50 % → 78 (target ~55); one short → 100 (target ~110); top unfinished 100

#### Checkout (`checkout`, number, finish puzzle) — 495 runs, 15 seeds

Progress means: boards checked out, worth 22 / 24 / 26 / 28 / 32

| Level | median (min–max) |
| --- | --- |
| nothing | 0 (0–0) |
| 10 % | 0 (0–0) |
| 25 % | 33 (33–33) |
| 40 % | 70 (70–70) |
| 50 % | 70 (70–70) |
| 60 % | 84 (84–84) |
| 75 % | 100 (100–100) |
| 90 % | 100 (100–100) |
| two short | 100 (100–100) |
| one short | 100 (100–100) |
| finish, 90 % left | 150 (150–150) |
| finish, 75 % left | 150 (150–150) |
| finish, 50 % left | 137 (137–137) |
| finish, 25 % left | 120 (120–120) |
| finish, 10 % left | 118 (118–118) |
| finish at the buzzer | 116 (116–116) |
| finish, few mistakes | 137 (137–137) |
| finish, some mistakes | 137 (137–137) |
| finish, many mistakes | 137 (137–137) |
| no input | 0 (0–0) |
| phone: time-out one short | 100 (100–100) |
| phone: reload at half | 70 (70–70) |
| phone: reload, then one action | 70 (70–70) |
| kit careless | 0 (0–70) |
| kit below average | 33 (0–84) |
| kit average | 70 (33–84) |
| kit good | 100 (70–126) |
| kit great | 120 (100–134) |
| kit near perfect | 140 (130–149) |
| random: greedy (reads the screen) | 0 (0–37) |
| random: random-darts | 0 (0–33) |
| random: single-finishers | 0 (0–0) |

150 on a clean finish needs: 61 % left (35 s of 90 s).

- PASS room = practice: 495/495 identical
- n/a screen-reading strategies (reported): greedy median 0
- PASS random near 0: worst strategy median 0, p90 0
- PASS monotonic: progress drops on 0/15 seeds; time drops on 0; mistakes few 137 → many 137
- **FAIL** finish floor 120: buzzer finish 116 (116–116); lowest finish 116
- PASS partial scale: 50 % → 70 (target ~55); one short → 100 (target ~110); top unfinished 100

#### Counterweight (`balance`, number, finish puzzle) — 510 runs, 15 seeds

Progress means: scales balanced, worth 15 / 25 / 30 / 55 in any order (the stage deals them in order)

| Level | median (min–max) |
| --- | --- |
| nothing | 0 (0–0) |
| 10 % | 0 (0–0) |
| 25 % | 15 (15–15) |
| 40 % | 40 (40–40) |
| 50 % | 40 (40–40) |
| 60 % | 40 (40–40) |
| 75 % | 70 (70–70) |
| 90 % | 70 (70–70) |
| two short | 70 (70–70) |
| one short | 70 (70–70) |
| finish, 90 % left | 150 (150–150) |
| finish, 75 % left | 150 (150–150) |
| finish, 50 % left | 134 (134–134) |
| finish, 25 % left | 111 (111–111) |
| finish, 10 % left | 100 (100–100) |
| finish at the buzzer | 93 (93–93) |
| finish, few mistakes | 134 (134–134) |
| finish, some mistakes | 134 (134–134) |
| finish, many mistakes | 134 (134–134) |
| half done, then undone | 0 (0–0) |
| no input | 0 (0–0) |
| phone: time-out one short | 70 (70–70) |
| phone: reload at half | 40 (40–40) |
| phone: reload, then one action | 0 (0–0) |
| kit careless | 40 (15–40) |
| kit below average | 40 (40–70) |
| kit average | 70 (70–70) |
| kit good | 102 (70–115) |
| kit great | 119 (107–131) |
| kit near perfect | 140 (121–145) |
| random: place-once | 0 (0–15) |
| random: random-hang (reads the screen) | 0 (0–25) |
| random: random-hang-fast (reads the screen) | 0 (0–45) |

150 on a clean finish needs: 65 % left (42 s of 120 s).

- PASS room = practice: 510/510 identical
- n/a screen-reading strategies (reported): random-hang median 0, random-hang-fast median 0
- PASS random near 0: worst strategy median 0, p90 0
- PASS monotonic: progress drops on 0/15 seeds; time drops on 0; mistakes few 134 → many 134
- **FAIL** finish floor 120: buzzer finish 93 (93–93); lowest finish 93
- **FAIL** partial scale: 50 % → 40 (target ~55); one short → 70 (target ~110); top unfinished 70

#### Exact (`target`, number, finish puzzle) — 495 runs, 15 seeds

Progress means: distance to the target from the closest number made (off by 1 = 110)

| Level | median (min–max) |
| --- | --- |
| nothing | 0 (0–0) |
| 10 % | 0 (0–0) |
| 25 % | 0 (0–0) |
| 40 % | 0 (0–0) |
| 50 % | 0 (0–73) |
| 60 % | 0 (0–85) |
| 75 % | 0 (0–87) |
| 90 % | 73 (0–89) |
| two short | 0 (0–85) |
| one short | 73 (0–89) |
| finish, 90 % left | 150 (150–150) |
| finish, 75 % left | 142 (142–142) |
| finish, 50 % left | 110 (110–110) |
| finish, 25 % left | 96 (96–96) |
| finish, 10 % left | 92 (92–92) |
| finish at the buzzer | 89 (89–89) |
| finish, few mistakes | 110 (110–110) |
| finish, some mistakes | 110 (110–110) |
| finish, many mistakes | 110 (110–110) |
| no input | 0 (0–0) |
| phone: time-out one short | 73 (0–89) |
| phone: reload at half | 0 (0–0) |
| phone: reload, then one action | 0 (0–0) |
| kit careless | 0 (0–75) |
| kit below average | 0 (0–91) |
| kit average | 85 (0–104) |
| kit good | 104 (94–122) |
| kit great | 121 (104–143) |
| kit near perfect | 142 (121–150) |
| random: multiply-biggest | 0 (0–29) |
| random: one-random-chain | 0 (0–6) |
| random: random-steps | 0 (0–48) |

150 on a clean finish needs: 81 % left (14 s of 75 s).

- PASS room = practice: 495/495 identical
- PASS random near 0: worst strategy median 0, p90 0
- PASS monotonic: progress drops on 0/15 seeds; time drops on 0; mistakes few 110 → many 110
- **FAIL** finish floor 120: buzzer finish 89 (89–89); lowest finish 89
- **FAIL** partial scale: 50 % → 0 (target ~55); one short → 73 (target ~110); top unfinished 89

#### Integer Pyramid (`numpyramid`, number, finish puzzle) — 510 runs, 15 seeds

Progress means: pyramid cells filled correctly across the four boards

| Level | median (min–max) |
| --- | --- |
| nothing | 0 (0–0) |
| 10 % | 21 (18–24) |
| 25 % | 48 (45–52) |
| 40 % | 73 (70–73) |
| 50 % | 82 (81–84) |
| 60 % | 93 (90–95) |
| 75 % | 106 (104–106) |
| 90 % | 115 (115–117) |
| two short | 121 (120–121) |
| one short | 122 (122–122) |
| finish, 90 % left | 150 (150–150) |
| finish, 75 % left | 150 (150–150) |
| finish, 50 % left | 150 (150–150) |
| finish, 25 % left | 138 (138–138) |
| finish, 10 % left | 129 (129–129) |
| finish at the buzzer | 123 (123–123) |
| finish, few mistakes | 150 (150–150) |
| finish, some mistakes | 150 (150–150) |
| finish, many mistakes | 150 (150–150) |
| half done, then undone | 0 (0–0) |
| no input | 0 (0–0) |
| phone: time-out one short | 122 (122–122) |
| phone: reload at half | 81 (79–83) |
| phone: reload, then one action | 6 (5–6) |
| kit careless | 41 (37–54) |
| kit below average | 55 (44–70) |
| kit average | 66 (48–80) |
| kit good | 100 (85–106) |
| kit great | 121 (110–128) |
| kit near perfect | 139 (136–148) |
| random: fill-once | 5 (0–15) |
| random: forged-all-boards | 6 (0–15) |
| random: random-drops | 6 (0–11) |

150 on a clean finish needs: 39 % left (74 s of 120 s).

- PASS room = practice: 510/510 identical
- PASS random near 0: worst strategy median 6, p90 15
- PASS monotonic: progress drops on 0/15 seeds; time drops on 0; mistakes few 150 → many 150
- PASS finish floor 120: buzzer finish 123 (123–123); lowest finish 123
- **FAIL** partial scale: 50 % → 82 (target ~55); one short → 122 (target ~110); top unfinished 122

#### Operator (`equation`, number, finish puzzle) — 510 runs, 15 seeds

Progress means: equations solved in order, worth 20 / 30 / 35 / 45 (3 tries each)

| Level | median (min–max) |
| --- | --- |
| nothing | 0 (0–0) |
| 10 % | 0 (0–0) |
| 25 % | 10 (10–10) |
| 40 % | 38 (38–38) |
| 50 % | 38 (38–38) |
| 60 % | 38 (38–38) |
| 75 % | 70 (70–70) |
| 90 % | 70 (70–70) |
| two short | 70 (70–70) |
| one short | 70 (70–70) |
| finish, 90 % left | 150 (150–150) |
| finish, 75 % left | 149 (149–149) |
| finish, 50 % left | 114 (114–114) |
| finish, 25 % left | 94 (94–94) |
| finish, 10 % left | 86 (86–86) |
| finish at the buzzer | 81 (81–81) |
| finish, few mistakes | 114 (114–114) |
| finish, some mistakes | 114 (114–114) |
| finish, many mistakes | 114 (42–114) |
| half done, then undone | 0 (0–0) |
| no input | 0 (0–0) |
| phone: time-out one short | 70 (70–70) |
| phone: reload at half | 38 (38–38) |
| phone: reload, then one action | 0 (0–0) |
| kit careless | 38 (10–38) |
| kit below average | 38 (38–70) |
| kit average | 70 (38–84) |
| kit good | 99 (86–117) |
| kit great | 117 (107–134) |
| kit near perfect | 140 (129–148) |
| random: all-plus | 0 (0–24) |
| random: brute-force (reads the screen) | 10 (0–38) |
| random: random-next | 0 (0–10) |

150 on a clean finish needs: 76 % left (22 s of 90 s).

- PASS room = practice: 510/510 identical
- n/a screen-reading strategies (reported): brute-force median 10
- PASS random near 0: worst strategy median 0, p90 19
- PASS monotonic: progress drops on 0/15 seeds; time drops on 0; mistakes few 114 → many 114
- **FAIL** finish floor 120: buzzer finish 81 (81–81); lowest finish 81
- **FAIL** partial scale: 50 % → 38 (target ~55); one short → 70 (target ~110); top unfinished 70

#### Tenfall (`tendrop`, number, speed / engine game) — 135 runs, 15 seeds

| Level | median (min–max) |
| --- | --- |
| no input | 0 (0–0) |
| kit careless | 34 (15–52) |
| kit below average | 52 (25–70) |
| kit average | 70 (61–94) |
| kit good | 100 (95–141) |
| kit great | 117 (96–144) |
| kit near perfect | 141 (97–148) |
| random: random-taps | 2 (0–27) |
| random: tap-every-tile | 0 (0–27) |

- PASS room = practice: 135/135 identical
- PASS random near 0: worst strategy median 2, p90 24
- PASS average player 60–79: careless 34, below 52, average 70 ✓, good 100 ✓, great 117 ✓, near 141 ✓
- PASS levels separate: each level ≥ 5 above the one below

#### Trail (`trail`, number, finish puzzle) — 495 runs, 15 seeds

Progress means: tiles at their exact solution step minus every other tile placed, × 110 ÷ 25

| Level | median (min–max) |
| --- | --- |
| nothing | 0 (0–0) |
| 10 % | 10 (10–10) |
| 25 % | 28 (28–28) |
| 40 % | 48 (48–48) |
| 50 % | 62 (62–62) |
| 60 % | 71 (71–71) |
| 75 % | 79 (79–79) |
| 90 % | 86 (86–86) |
| two short | 88 (88–88) |
| one short | 90 (90–90) |
| finish, 90 % left | 150 (150–150) |
| finish, 75 % left | 150 (150–150) |
| finish, 50 % left | 127 (127–127) |
| finish, 25 % left | 105 (105–105) |
| finish, 10 % left | 96 (96–96) |
| finish at the buzzer | 91 (91–91) |
| finish, few mistakes | 127 (127–127) |
| finish, some mistakes | 127 (127–127) |
| finish, many mistakes | 127 (127–127) |
| half done, then undone | 0 (0–0) |
| no input | 0 (0–0) |
| phone: time-out one short | 90 (90–90) |
| phone: reload at half | 58 (58–58) |
| phone: reload, then one action | 4 (4–4) |
| kit careless | 28 (14–52) |
| kit below average | 48 (34–68) |
| kit average | 71 (62–81) |
| kit good | 102 (73–116) |
| kit great | 122 (108–130) |
| kit near perfect | 142 (138–147) |
| random: random-walk | 0 (0–0) |
| random: random-walk-undo | 0 (0–0) |

150 on a clean finish needs: 72 % left (34 s of 120 s).

- PASS room = practice: 495/495 identical
- PASS random near 0: worst strategy median 0, p90 0
- PASS monotonic: progress drops on 0/15 seeds; time drops on 0; mistakes few 127 → many 127
- **FAIL** finish floor 120: buzzer finish 91 (91–91); lowest finish 91
- **FAIL** partial scale: 50 % → 62 (target ~55); one short → 90 (target ~110); top unfinished 90

#### Ascend (`numhunt`, speed, finish puzzle) — 465 runs, 15 seeds

Progress means: numbers tapped in order (tap log), wrong taps cost

| Level | median (min–max) |
| --- | --- |
| nothing | 0 (0–0) |
| 10 % | 12 (12–12) |
| 25 % | 36 (36–36) |
| 40 % | 53 (53–53) |
| 50 % | 70 (70–70) |
| 60 % | 75 (75–75) |
| 75 % | 84 (84–84) |
| 90 % | 90 (90–90) |
| two short | 92 (92–92) |
| one short | 95 (95–95) |
| finish, 90 % left | 150 (150–150) |
| finish, 75 % left | 148 (145–150) |
| finish, 50 % left | 125 (125–125) |
| finish, 25 % left | 109 (109–109) |
| finish, 10 % left | 100 (100–101) |
| finish at the buzzer | 95 (95–96) |
| finish, few mistakes | 135 (123–148) |
| finish, some mistakes | 108 (95–149) |
| finish, many mistakes | 95 (95–101) |
| no input | 0 (0–0) |
| phone: time-out one short | 95 (95–95) |
| phone: reload at half | 65 (65–65) |
| phone: reload, then one action | 6 (6–6) |
| kit careless | 10 (0–41) |
| kit below average | 39 (0–79) |
| kit average | 74 (39–88) |
| kit good | 106 (95–117) |
| kit great | 117 (104–134) |
| kit near perfect | 139 (129–146) |
| random: sweep-screen | 0 (0–0) |
| random: tap-random | 0 (0–0) |

- PASS room = practice: 465/465 identical
- PASS random near 0: worst strategy median 0, p90 0
- PASS monotonic: progress drops on 0/15 seeds; time drops on 0; mistakes few 135 → many 95
- **FAIL** finish floor 120: buzzer finish 95 (95–96); lowest finish 95
- PASS partial scale: 50 % → 70 (target ~55); one short → 95 (target ~110); top unfinished 95

#### Bang On (`stopwatch`, speed, speed / engine game) — 150 runs, 15 seeds

| Level | median (min–max) |
| --- | --- |
| no input | 0 (0–0) |
| kit careless | 15 (0–97) |
| kit below average | 65 (10–102) |
| kit average | 68 (41–130) |
| kit good | 102 (66–120) |
| kit great | 127 (74–137) |
| kit near perfect | 137 (113–147) |
| random: tap-150-300ms | 0 (0–0) |
| random: tap-at-start | 0 (0–0) |
| random: tap-random-time | 27 (0–69) |

- PASS room = practice: 150/150 identical
- **FAIL** random near 0: worst strategy median 27, p90 53
- PASS average player 60–79: careless 15, below 65, average 68 ✓, good 102 ✓, great 127 ✓, near 137 ✓
- **FAIL** levels separate: two neighbouring levels within 5 points

#### Bonk (`whack`, speed, speed / engine game) — 150 runs, 15 seeds

| Level | median (min–max) |
| --- | --- |
| no input | 0 (0–0) |
| kit careless | 0 (0–0) |
| kit below average | 11 (0–46) |
| kit average | 71 (46–88) |
| kit good | 98 (82–122) |
| kit great | 122 (108–141) |
| kit near perfect | 136 (129–148) |
| random: hit-every-pop | 0 (0–16) |
| random: random-burrows | 0 (0–0) |
| random: tap-all-burrows | 0 (0–0) |

- PASS room = practice: 150/150 identical
- PASS random near 0: worst strategy median 0, p90 1
- PASS average player 60–79: careless 0, below 11, average 71 ✓, good 98 ✓, great 122 ✓, near 136 ✓
- PASS levels separate: each level ≥ 5 above the one below

#### Don't Break the Chain (`chain`, speed, finish puzzle) — 465 runs, 15 seeds

Progress means: links tapped before the chain broke (tap log)

| Level | median (min–max) |
| --- | --- |
| nothing | 0 (0–0) |
| 10 % | 62 (62–62) |
| 25 % | 81 (81–81) |
| 40 % | 93 (93–93) |
| 50 % | 100 (100–100) |
| 60 % | 103 (103–103) |
| 75 % | 106 (106–106) |
| 90 % | 109 (109–109) |
| two short | 110 (110–110) |
| one short | 110 (110–110) |
| finish, 75 % left | 150 (150–150) |
| finish, 50 % left | 139 (139–140) |
| finish, 25 % left | 122 (121–122) |
| finish, 10 % left | 115 (115–115) |
| finish at the buzzer | 111 (111–112) |
| finish, few mistakes | 150 (93–150) |
| finish, some mistakes | 102 (47–150) |
| finish, many mistakes | 75 (31–100) |
| no input | 0 (0–0) |
| phone: time-out one short | 110 (110–110) |
| phone: reload at half | 99 (99–99) |
| phone: reload, then one action | 16 (16–16) |
| kit careless | 31 (16–75) |
| kit below average | 31 (16–75) |
| kit average | 71 (16–91) |
| kit good | 100 (73–117) |
| kit great | 125 (83–131) |
| kit near perfect | 142 (108–147) |
| random: tap-in-order | 0 (0–16) |
| random: tap-random | 0 (0–16) |

- PASS room = practice: 465/465 identical
- PASS random near 0: worst strategy median 0, p90 0
- PASS monotonic: progress drops on 0/15 seeds; time drops on 0; mistakes few 150 → many —
- **FAIL** finish floor 120: buzzer finish 111 (111–112); lowest finish 111
- **FAIL** partial scale: 50 % → 100 (target ~55); one short → 110 (target ~110); top unfinished 110

#### Flash (`reaction`, speed, speed / engine game) — 150 runs, 15 seeds

| Level | median (min–max) |
| --- | --- |
| no input | 0 (0–0) |
| kit careless | 2 (0–27) |
| kit below average | 3 (0–78) |
| kit average | 55 (5–98) |
| kit good | 104 (37–119) |
| kit great | 124 (71–138) |
| kit near perfect | 143 (138–150) |
| random: tap-150-300ms | 0 (0–0) |
| random: tap-every-1s | 0 (0–0) |
| random: tap-every-colour | 5 (0–70) |

- PASS room = practice: 150/150 identical
- **FAIL** random near 0: worst strategy median 5, p90 68
- **FAIL** average player 60–79: careless 2, below 3, average 55 (target 60–79), good 104 ✓, great 124 ✓, near 143 ✓
- **FAIL** levels separate: two neighbouring levels within 5 points

#### Pull! (`clayshoot`, speed, speed / engine game) — 150 runs, 15 seeds

| Level | median (min–max) |
| --- | --- |
| no input | 0 (0–0) |
| kit careless | 19 (7–43) |
| kit below average | 35 (19–67) |
| kit average | 63 (43–95) |
| kit good | 107 (75–150) |
| kit great | 150 (107–150) |
| kit near perfect | 150 (150–150) |
| random: mash-on-movers | 0 (0–0) |
| random: random-3/s | 0 (0–2) |
| random: random-6/s | 0 (0–0) |

- PASS room = practice: 150/150 identical
- PASS random near 0: worst strategy median 0, p90 2
- PASS average player 60–79: careless 19, below 35, average 63 ✓, good 107 ✓, great 150 (target 110–129), near 150 (target 130–149)
- **FAIL** levels separate: two neighbouring levels within 5 points

#### Double Take (`spotdiff`, attention, finish puzzle) — 510 runs, 15 seeds

Progress means: differences found, 10 each, wrong taps cost

| Level | median (min–max) |
| --- | --- |
| nothing | 0 (0–0) |
| 10 % | 10 (10–10) |
| 25 % | 29 (29–29) |
| 40 % | 38 (38–38) |
| 50 % | 58 (58–58) |
| 60 % | 67 (67–67) |
| 75 % | 78 (78–78) |
| 90 % | 82 (82–82) |
| two short | 82 (82–82) |
| one short | 87 (87–87) |
| finish, 90 % left | 150 (150–150) |
| finish, 75 % left | 150 (150–150) |
| finish, 50 % left | 124 (124–124) |
| finish, 25 % left | 100 (100–100) |
| finish, 10 % left | 92 (92–92) |
| finish at the buzzer | 87 (87–87) |
| finish, few mistakes | 124 (124–124) |
| finish, some mistakes | 124 (124–124) |
| finish, many mistakes | 124 (124–124) |
| no input | 0 (0–0) |
| phone: time-out one short | 87 (87–87) |
| phone: reload at half | 48 (48–48) |
| phone: reload, then one action | 10 (10–10) |
| kit careless | 40 (17–54) |
| kit below average | 56 (46–73) |
| kit average | 69 (46–85) |
| kit good | 99 (90–109) |
| kit great | 122 (111–127) |
| kit near perfect | 141 (134–147) |
| random: skip-then-tap-all | 0 (0–0) |
| random: tap-all-in-order | 0 (0–0) |
| random: tap-all-random-order | 0 (0–0) |
| random: tap-random-half | 0 (0–0) |

150 on a clean finish needs: 72 % left (17 s of 60 s).

- PASS room = practice: 510/510 identical
- PASS random near 0: worst strategy median 0, p90 0
- PASS monotonic: progress drops on 0/15 seeds; time drops on 0; mistakes few 124 → many 124
- **FAIL** finish floor 120: buzzer finish 87 (87–87); lowest finish 87
- **FAIL** partial scale: 50 % → 58 (target ~55); one short → 87 (target ~110); top unfinished 87

#### Eagle Eye (`symscan`, attention, finish puzzle) — 510 runs, 15 seeds

Progress means: symbols found on the three boards, worth 40 / 40 / 30, wrong taps cost

| Level | median (min–max) |
| --- | --- |
| nothing | 0 (0–0) |
| 10 % | 13 (9–16) |
| 25 % | 35 (30–40) |
| 40 % | 53 (46–60) |
| 50 % | 70 (62–79) |
| 60 % | 79 (71–81) |
| 75 % | 88 (82–91) |
| 90 % | 97 (96–99) |
| two short | 101 (99–101) |
| one short | 102 (101–102) |
| finish, 90 % left | 150 (150–150) |
| finish, 75 % left | 150 (150–150) |
| finish, 50 % left | 140 (140–140) |
| finish, 25 % left | 119 (119–119) |
| finish, 10 % left | 110 (110–110) |
| finish at the buzzer | 104 (104–104) |
| finish, few mistakes | 140 (102–140) |
| finish, some mistakes | 102 (102–140) |
| finish, many mistakes | 102 (100–140) |
| half done, then undone | 0 (0–0) |
| no input | 0 (0–0) |
| phone: time-out one short | 102 (101–102) |
| phone: reload at half | 67 (58–73) |
| phone: reload, then one action | 6 (4–8) |
| kit careless | 40 (19–46) |
| kit below average | 47 (37–79) |
| kit average | 75 (50–83) |
| kit good | 102 (86–113) |
| kit great | 124 (102–132) |
| kit near perfect | 140 (135–150) |
| random: tap-all | 0 (0–0) |
| random: tap-random-half | 0 (0–12) |
| random: tap-random-quarter | 0 (0–7) |

150 on a clean finish needs: 63 % left (11 s of 30 s).

- PASS room = practice: 510/510 identical
- PASS random near 0: worst strategy median 0, p90 8
- PASS monotonic: progress drops on 0/15 seeds; time drops on 0; mistakes few 140 → many 140
- **FAIL** finish floor 120: buzzer finish 104 (104–104); lowest finish 104
- PASS partial scale: 50 % → 70 (target ~55); one short → 102 (target ~110); top unfinished 102

#### Labyrinth (`maze`, attention, finish puzzle) — 510 runs, 15 seeds

Progress means: share of the route to the exit walked (solver distance)

| Level | median (min–max) |
| --- | --- |
| nothing | 0 (0–0) |
| 10 % | 6 (6–7) |
| 25 % | 29 (29–29) |
| 40 % | 50 (50–51) |
| 50 % | 65 (65–65) |
| 60 % | 74 (74–74) |
| 75 % | 83 (83–83) |
| 90 % | 92 (92–92) |
| two short | 97 (97–97) |
| one short | 98 (98–98) |
| finish, 90 % left | 150 (150–150) |
| finish, 75 % left | 150 (150–150) |
| finish, 50 % left | 147 (147–147) |
| finish, 25 % left | 119 (119–119) |
| finish, 10 % left | 107 (107–107) |
| finish at the buzzer | 99 (99–99) |
| finish, few mistakes | 147 (147–147) |
| finish, some mistakes | 147 (147–147) |
| finish, many mistakes | 147 (147–147) |
| half done, then undone | 65 (65–65) |
| no input | 0 (0–0) |
| phone: time-out one short | 98 (98–98) |
| phone: reload at half | 64 (64–64) |
| phone: reload, then one action | 0 (0–0) |
| kit careless | 33 (18–46) |
| kit below average | 46 (36–74) |
| kit average | 73 (55–78) |
| kit good | 102 (91–113) |
| kit great | 122 (109–137) |
| kit near perfect | 141 (124–150) |
| random: blind-dfs-6cps (reads the screen) | 94 (64–99) |
| random: forward-scribble | 0 (0–15) |
| random: random-scribble | 4 (0–54) |

150 on a clean finish needs: 53 % left (28 s of 60 s).

- PASS room = practice: 510/510 identical
- n/a screen-reading strategies (reported): blind-dfs-6cps median 94
- **FAIL** random near 0: worst strategy median 4, p90 26
- PASS monotonic: progress drops on 0/15 seeds; time drops on 0; mistakes few 147 → many 147
- **FAIL** finish floor 120: buzzer finish 99 (99–99); lowest finish 99
- PASS partial scale: 50 % → 65 (target ~55); one short → 98 (target ~110); top unfinished 98

#### Matchmaker (`pairmatch`, attention, finish puzzle) — 480 runs, 15 seeds

Progress means: pairs matched, flips beyond the minimum cost

| Level | median (min–max) |
| --- | --- |
| nothing | 0 (0–0) |
| 10 % | 0 (0–7) |
| 25 % | 7 (0–14) |
| 40 % | 21 (14–27) |
| 50 % | 35 (27–42) |
| 60 % | 42 (35–56) |
| 75 % | 63 (63–70) |
| 90 % | 76 (76–76) |
| two short | 82 (82–82) |
| one short | 82 (82–82) |
| finish, 90 % left | 150 (150–150) |
| finish, 75 % left | 148 (148–148) |
| finish, 50 % left | 109 (109–109) |
| finish, 25 % left | 92 (92–92) |
| finish, 10 % left | 86 (86–86) |
| finish at the buzzer | 82 (82–82) |
| finish, few mistakes | 109 (109–109) |
| finish, some mistakes | 109 (109–109) |
| finish, many mistakes | 109 (109–109) |
| no input | 0 (0–0) |
| phone: time-out one short | 82 (82–82) |
| phone: reload at half | 27 (21–42) |
| phone: reload, then one action | 0 (0–0) |
| kit careless | 14 (7–49) |
| kit below average | 35 (7–56) |
| kit average | 73 (56–79) |
| kit good | 99 (92–110) |
| kit great | 120 (114–126) |
| kit near perfect | 140 (132–150) |
| random: random-pairs | 0 (0–0) |
| random: sweep-in-order | 0 (0–0) |

150 on a clean finish needs: 76 % left (22 s of 90 s).

- PASS room = practice: 480/480 identical
- PASS random near 0: worst strategy median 0, p90 0
- PASS monotonic: progress drops on 0/15 seeds; time drops on 0; mistakes few 109 → many 109
- **FAIL** finish floor 120: buzzer finish 82 (82–82); lowest finish 82
- **FAIL** partial scale: 50 % → 35 (target ~55); one short → 82 (target ~110); top unfinished 82

#### Mixed Signals (`stroop`, attention, speed / engine game) — 150 runs, 15 seeds

| Level | median (min–max) |
| --- | --- |
| no input | 0 (0–0) |
| kit careless | 0 (0–0) |
| kit below average | 0 (0–56) |
| kit average | 70 (28–85) |
| kit good | 101 (88–117) |
| kit great | 105 (100–140) |
| kit near perfect | 138 (105–148) |
| random: drop-where-spawned | 0 (0–21) |
| random: random-gate | 0 (0–0) |
| random: same-gate | 0 (0–0) |

- PASS room = practice: 150/150 identical
- PASS random near 0: worst strategy median 0, p90 7
- PASS average player 60–79: careless 0, below 0, average 70 ✓, good 101 ✓, great 105 (target 110–129), near 138 ✓
- **FAIL** levels separate: two neighbouring levels within 5 points

#### Tally (`countup`, attention, finish puzzle) — 495 runs, 15 seeds

Progress means: trays counted right, worth 40 / 30 / 25 / 15; one off scores 15 %

| Level | median (min–max) |
| --- | --- |
| nothing | 0 (0–0) |
| 10 % | 0 (0–0) |
| 25 % | 31 (31–31) |
| 40 % | 31 (31–31) |
| 50 % | 83 (83–83) |
| 60 % | 83 (83–83) |
| 75 % | 102 (102–102) |
| 90 % | 102 (102–102) |
| two short | 83 (83–83) |
| one short | 102 (102–102) |
| finish, 90 % left | 150 (150–150) |
| finish, 75 % left | 150 (150–150) |
| finish, 50 % left | 120 (120–120) |
| finish, 25 % left | 113 (113–113) |
| finish, 10 % left | 109 (109–109) |
| finish at the buzzer | 106 (106–106) |
| finish, few mistakes | 120 (89–120) |
| finish, some mistakes | 101 (8–120) |
| finish, many mistakes | 47 (4–85) |
| half done, then undone | 0 (0–0) |
| no input | 0 (0–0) |
| phone: time-out one short | 102 (102–102) |
| phone: reload at half | 31 (31–31) |
| phone: reload, then one action | 31 (31–31) |
| kit careless | 22 (0–87) |
| kit below average | 40 (8–87) |
| kit average | 77 (3–98) |
| kit good | 113 (83–120) |
| kit great | 120 (98–140) |
| kit near perfect | 141 (85–150) |
| random: guess-random (reads the screen) | 1 (0–85) |
| random: guess-typical (reads the screen) | 5 (0–83) |

150 on a clean finish needs: 75 % left (15 s of 60 s).

- PASS room = practice: 495/495 identical
- n/a screen-reading strategies (reported): guess-typical median 5, guess-random median 1
- PASS monotonic: progress drops on 0/15 seeds; time drops on 0; mistakes few 120 → many —
- **FAIL** finish floor 120: buzzer finish 106 (106–106); lowest finish 106
- **FAIL** partial scale: 50 % → 83 (target ~55); one short → 102 (target ~110); top unfinished 102

#### Chroma Lines (`flow`, pattern, finish puzzle) — 495 runs, 15 seeds

Progress means: pairs joined, share of cells filled

| Level | median (min–max) |
| --- | --- |
| nothing | 0 (0–0) |
| 10 % | 8 (8–10) |
| 25 % | 27 (19–27) |
| 40 % | 36 (36–44) |
| 50 % | 55 (50–55) |
| 60 % | 64 (60–66) |
| 75 % | 76 (73–76) |
| 90 % | 80 (79–83) |
| two short | 80 (78–80) |
| one short | 84 (83–84) |
| finish, 90 % left | 150 (150–150) |
| finish, 75 % left | 150 (150–150) |
| finish, 50 % left | 128 (128–128) |
| finish, 25 % left | 103 (103–103) |
| finish, 10 % left | 94 (94–94) |
| finish at the buzzer | 89 (89–89) |
| finish, few mistakes | 128 (128–128) |
| finish, some mistakes | 128 (128–128) |
| finish, many mistakes | 128 (128–128) |
| half done, then undone | 0 (0–0) |
| no input | 0 (0–0) |
| phone: time-out one short | 84 (83–84) |
| phone: reload at half | 46 (44–50) |
| phone: reload, then one action | 8 (8–10) |
| kit careless | 36 (27–66) |
| kit below average | 55 (10–66) |
| kit average | 71 (46–79) |
| kit good | 98 (89–112) |
| kit great | 119 (109–130) |
| kit near perfect | 135 (124–145) |
| random: direct-lines (reads the screen) | 36 (0–89) |
| random: scribble | 9 (0–27) |

150 on a clean finish needs: 72 % left (21 s of 75 s).

- PASS room = practice: 495/495 identical
- n/a screen-reading strategies (reported): direct-lines median 36
- PASS random near 0: worst strategy median 9, p90 17
- PASS monotonic: progress drops on 0/15 seeds; time drops on 0; mistakes few 128 → many 128
- **FAIL** finish floor 120: buzzer finish 89 (89–89); lowest finish 89
- **FAIL** partial scale: 50 % → 55 (target ~55); one short → 84 (target ~110); top unfinished 84

#### Gridlock (`unblock`, pattern, finish puzzle) — 480 runs, 15 seeds

Progress means: solver distance from the start to the exit (moves), cut by waste

| Level | median (min–max) |
| --- | --- |
| nothing | 0 (0–0) |
| 10 % | 0 (0–74) |
| 25 % | 0 (0–74) |
| 40 % | 0 (0–80) |
| 50 % | 0 (0–80) |
| 60 % | 70 (0–80) |
| 75 % | 74 (0–80) |
| 90 % | 74 (0–80) |
| two short | 78 (0–80) |
| one short | 86 (86–86) |
| finish, 90 % left | 150 (150–150) |
| finish, 75 % left | 150 (150–150) |
| finish, 50 % left | 127 (127–127) |
| finish, 25 % left | 109 (109–109) |
| finish, 10 % left | 100 (100–100) |
| finish at the buzzer | 98 (98–98) |
| finish, few mistakes | 121 (107–127) |
| finish, some mistakes | 107 (98–117) |
| finish, many mistakes | 97 (92–103) |
| no input | 0 (0–0) |
| phone: time-out one short | 86 (86–86) |
| phone: reload at half | 0 (0–80) |
| phone: reload, then one action | 0 (0–74) |
| kit careless | 0 (0–74) |
| kit below average | 0 (0–80) |
| kit average | 53 (0–98) |
| kit good | 101 (0–122) |
| kit great | 124 (100–136) |
| kit near perfect | 141 (128–143) |
| random: random-1.5/s | 0 (0–0) |
| random: random-3/s | 0 (0–0) |

150 on a clean finish needs: 74 % left (15 s of 60 s).

- PASS room = practice: 480/480 identical
- PASS random near 0: worst strategy median 0, p90 0
- **FAIL** monotonic: progress drops on 4/15 seeds; time drops on 0; mistakes few 121 → many 97
- **FAIL** finish floor 120: buzzer finish 98 (98–98); lowest finish 92
- **FAIL** partial scale: 50 % → 0 (target ~55); one short → 86 (target ~110); top unfinished 86

#### Heave (`push`, pattern, finish puzzle) — 495 runs, 15 seeds

Progress means: boxes on goals / solver distance, cut by waste

| Level | median (min–max) |
| --- | --- |
| nothing | 0 (0–0) |
| 10 % | 0 (0–10) |
| 25 % | 10 (0–70) |
| 40 % | 10 (0–70) |
| 50 % | 10 (0–73) |
| 60 % | 10 (0–73) |
| 75 % | 70 (8–80) |
| 90 % | 80 (40–80) |
| two short | 80 (80–80) |
| one short | 80 (80–80) |
| finish, 90 % left | 150 (150–150) |
| finish, 75 % left | 148 (148–148) |
| finish, 50 % left | 120 (120–120) |
| finish, 25 % left | 100 (100–100) |
| finish, 10 % left | 97 (97–97) |
| finish at the buzzer | 96 (96–96) |
| finish, few mistakes | 120 (120–120) |
| finish, some mistakes | 120 (120–120) |
| finish, many mistakes | 120 (120–120) |
| no input | 0 (0–0) |
| phone: time-out one short | 80 (80–80) |
| phone: reload at half | 10 (0–73) |
| phone: reload, then one action | 0 (0–0) |
| kit careless | 10 (0–70) |
| kit below average | 10 (0–70) |
| kit average | 70 (8–80) |
| kit good | 100 (96–108) |
| kit great | 113 (99–131) |
| kit near perfect | 137 (114–143) |
| random: random-swipes-1.5/s | 0 (0–40) |
| random: random-swipes-3/s | 0 (0–40) |
| random: swipe-runs | 0 (0–10) |

150 on a clean finish needs: 77 % left (27 s of 120 s).

- PASS room = practice: 495/495 identical
- PASS random near 0: worst strategy median 0, p90 10
- **FAIL** monotonic: progress drops on 3/15 seeds; time drops on 0; mistakes few 120 → many 120
- **FAIL** finish floor 120: buzzer finish 96 (96–96); lowest finish 96
- **FAIL** partial scale: 50 % → 10 (target ~55); one short → 80 (target ~110); top unfinished 80

#### Jumbled (`tiles`, pattern, finish puzzle) — 495 runs, 15 seeds

Progress means: tiles in place / solver distance, cut by waste

| Level | median (min–max) |
| --- | --- |
| nothing | 0 (0–0) |
| 10 % | 0 (0–23) |
| 25 % | 12 (0–31) |
| 40 % | 23 (0–46) |
| 50 % | 13 (0–39) |
| 60 % | 13 (0–34) |
| 75 % | 39 (0–66) |
| 90 % | 66 (46–72) |
| two short | 72 (69–74) |
| one short | 78 (78–78) |
| finish, 90 % left | 150 (150–150) |
| finish, 75 % left | 139 (139–139) |
| finish, 50 % left | 115 (115–115) |
| finish, 25 % left | 99 (99–99) |
| finish, 10 % left | 97 (97–97) |
| finish at the buzzer | 95 (95–95) |
| finish, few mistakes | 111 (101–115) |
| finish, some mistakes | 101 (97–111) |
| finish, many mistakes | 93 (87–99) |
| half done, then undone | 0 (0–0) |
| no input | 0 (0–0) |
| phone: time-out one short | 78 (78–78) |
| phone: reload at half | 23 (0–39) |
| phone: reload, then one action | 0 (0–23) |
| kit careless | 12 (0–61) |
| kit below average | 15 (0–66) |
| kit average | 56 (0–98) |
| kit good | 106 (97–116) |
| kit great | 119 (109–130) |
| kit near perfect | 141 (122–146) |
| random: random-1.5/s | 0 (0–0) |
| random: random-3/s | 0 (0–0) |

150 on a clean finish needs: 84 % left (15 s of 90 s).

- PASS room = practice: 495/495 identical
- PASS random near 0: worst strategy median 0, p90 0
- **FAIL** monotonic: progress drops on 7/15 seeds; time drops on 0; mistakes few 111 → many 93
- **FAIL** finish floor 120: buzzer finish 95 (95–95); lowest finish 87
- **FAIL** partial scale: 50 % → 13 (target ~55); one short → 78 (target ~110); top unfinished 78

#### Lightbender (`laser`, pattern, finish puzzle) — 480 runs, 15 seeds

Progress means: targets lit by the placed mirrors (action log), fires limited

| Level | median (min–max) |
| --- | --- |
| nothing | 0 (0–0) |
| 10 % | 0 (0–70) |
| 25 % | 70 (0–86) |
| 40 % | 75 (0–86) |
| 50 % | 80 (0–86) |
| 60 % | 86 (70–91) |
| 75 % | 86 (70–91) |
| 90 % | 91 (91–91) |
| two short | 91 (80–91) |
| one short | 91 (91–91) |
| finish, 90 % left | 150 (150–150) |
| finish, 75 % left | 150 (150–150) |
| finish, 50 % left | 131 (130–131) |
| finish, 25 % left | 116 (116–116) |
| finish, 10 % left | 112 (112–112) |
| finish at the buzzer | 109 (109–109) |
| finish, few mistakes | 146 (109–150) |
| finish, some mistakes | 112 (98–150) |
| finish, many mistakes | 112 (97–146) |
| no input | 0 (0–0) |
| phone: time-out one short | 91 (91–91) |
| phone: reload at half | 75 (0–86) |
| phone: reload, then one action | 70 (0–80) |
| kit careless | 0 (0–86) |
| kit below average | 70 (0–80) |
| kit average | 70 (0–91) |
| kit good | 100 (75–118) |
| kit great | 107 (103–141) |
| kit near perfect | 137 (111–150) |
| random: fire-empty-x3 | 0 (0–0) |
| random: random-layout-unfired | 0 (0–0) |
| random: random-layout-x3 | 0 (0–0) |

- PASS room = practice: 480/480 identical
- PASS random near 0: worst strategy median 0, p90 0
- **FAIL** monotonic: progress drops on 2/15 seeds; time drops on 0; mistakes few 146 → many 112
- **FAIL** finish floor 120: buzzer finish 109 (109–109); lowest finish 97
- **FAIL** partial scale: 50 % → 80 (target ~55); one short → 91 (target ~110); top unfinished 91

#### Pipeline (`pipes`, pattern, finish puzzle) — 510 runs, 15 seeds

Progress means: pipes connected to the source

| Level | median (min–max) |
| --- | --- |
| nothing | 0 (0–0) |
| 10 % | 0 (0–6) |
| 25 % | 10 (3–30) |
| 40 % | 25 (14–42) |
| 50 % | 44 (25–61) |
| 60 % | 57 (40–71) |
| 75 % | 77 (72–81) |
| 90 % | 87 (86–88) |
| two short | 92 (91–94) |
| one short | 94 (94–94) |
| finish, 90 % left | 150 (150–150) |
| finish, 75 % left | 150 (150–150) |
| finish, 50 % left | 145 (145–145) |
| finish, 25 % left | 115 (115–115) |
| finish, 10 % left | 102 (102–102) |
| finish at the buzzer | 96 (96–96) |
| finish, few mistakes | 145 (145–145) |
| finish, some mistakes | 145 (145–145) |
| finish, many mistakes | 145 (145–145) |
| half done, then undone | 0 (0–0) |
| no input | 0 (0–0) |
| phone: time-out one short | 94 (94–94) |
| phone: reload at half | 41 (21–57) |
| phone: reload, then one action | 0 (0–0) |
| kit careless | 20 (10–52) |
| kit below average | 42 (3–61) |
| kit average | 69 (44–75) |
| kit good | 100 (94–105) |
| kit great | 119 (110–128) |
| kit near perfect | 139 (135–147) |
| random: random-taps-2/s | 0 (0–6) |
| random: random-turns | 0 (0–6) |
| random: tap-all-once | 6 (0–34) |

150 on a clean finish needs: 52 % left (58 s of 120 s).

- PASS room = practice: 510/510 identical
- **FAIL** random near 0: worst strategy median 6, p90 32
- PASS monotonic: progress drops on 0/15 seeds; time drops on 0; mistakes few 145 → many 145
- **FAIL** finish floor 120: buzzer finish 96 (96–96); lowest finish 96
- **FAIL** partial scale: 50 % → 44 (target ~55); one short → 94 (target ~110); top unfinished 94

#### Skid (`iceslide`, pattern, finish puzzle) — 480 runs, 15 seeds

Progress means: solver distance to the goal, cut by waste

| Level | median (min–max) |
| --- | --- |
| nothing | 0 (0–0) |
| 10 % | 7 (7–14) |
| 25 % | 31 (29–35) |
| 40 % | 54 (51–56) |
| 50 % | 70 (66–70) |
| 60 % | 72 (72–73) |
| 75 % | 77 (77–78) |
| 90 % | 82 (81–82) |
| two short | 82 (82–83) |
| one short | 84 (84–84) |
| finish, 90 % left | 150 (150–150) |
| finish, 75 % left | 150 (150–150) |
| finish, 50 % left | 134 (134–134) |
| finish, 25 % left | 116 (116–116) |
| finish, 10 % left | 105 (105–105) |
| finish at the buzzer | 99 (99–99) |
| finish, few mistakes | 134 (114–134) |
| finish, some mistakes | 119 (92–134) |
| finish, many mistakes | 93 (92–114) |
| no input | 0 (0–0) |
| phone: time-out one short | 84 (84–84) |
| phone: reload at half | 63 (63–66) |
| phone: reload, then one action | 7 (6–7) |
| kit careless | 39 (14–63) |
| kit below average | 53 (29–73) |
| kit average | 66 (31–74) |
| kit good | 100 (74–116) |
| kit great | 121 (99–131) |
| kit near perfect | 141 (130–150) |
| random: random-1.5/s | 0 (0–0) |
| random: random-3/s | 0 (0–0) |

150 on a clean finish needs: 66 % left (31 s of 90 s).

- PASS room = practice: 480/480 identical
- PASS random near 0: worst strategy median 0, p90 0
- PASS monotonic: progress drops on 0/15 seeds; time drops on 0; mistakes few 134 → many 93
- **FAIL** finish floor 120: buzzer finish 99 (99–99); lowest finish 92
- **FAIL** partial scale: 50 % → 70 (target ~55); one short → 84 (target ~110); top unfinished 84

#### Tessellate (`blockparty`, pattern, finish puzzle) — 510 runs, 15 seeds

Progress means: pieces placed in their solution place

| Level | median (min–max) |
| --- | --- |
| nothing | 0 (0–0) |
| 10 % | 0 (0–0) |
| 25 % | 28 (28–28) |
| 40 % | 42 (42–42) |
| 50 % | 56 (56–56) |
| 60 % | 70 (70–70) |
| 75 % | 78 (78–78) |
| 90 % | 94 (94–94) |
| two short | 86 (86–86) |
| one short | 94 (94–94) |
| finish, 90 % left | 150 (150–150) |
| finish, 75 % left | 150 (150–150) |
| finish, 50 % left | 134 (134–134) |
| finish, 25 % left | 112 (112–112) |
| finish, 10 % left | 102 (102–102) |
| finish at the buzzer | 95 (95–95) |
| finish, few mistakes | 134 (134–134) |
| finish, some mistakes | 134 (134–134) |
| finish, many mistakes | 134 (134–134) |
| half done, then undone | 0 (0–0) |
| no input | 0 (0–0) |
| phone: time-out one short | 94 (94–94) |
| phone: reload at half | 56 (56–56) |
| phone: reload, then one action | 14 (14–14) |
| kit careless | 28 (0–56) |
| kit below average | 56 (14–70) |
| kit average | 70 (42–78) |
| kit good | 100 (94–113) |
| kit great | 116 (103–132) |
| kit near perfect | 140 (128–147) |
| random: drop-all-random | 0 (0–0) |
| random: first-fit | 0 (0–0) |
| random: mash-1/s | 0 (0–0) |

150 on a clean finish needs: 66 % left (20 s of 60 s).

- PASS room = practice: 510/510 identical
- PASS random near 0: worst strategy median 0, p90 0
- PASS monotonic: progress drops on 0/15 seeds; time drops on 0; mistakes few 134 → many 134
- **FAIL** finish floor 120: buzzer finish 95 (95–95); lowest finish 95
- **FAIL** partial scale: 50 % → 56 (target ~55); one short → 94 (target ~110); top unfinished 94

#### Topsy-Turvy (`gravity`, pattern, finish puzzle) — 480 runs, 15 seeds

Progress means: solver distance (gravityRev 2 solverProgress), cut by waste

| Level | median (min–max) |
| --- | --- |
| nothing | 0 (0–0) |
| 10 % | 12 (0–16) |
| 25 % | 35 (29–40) |
| 40 % | 56 (53–63) |
| 50 % | 72 (70–72) |
| 60 % | 74 (73–74) |
| 75 % | 78 (76–79) |
| 90 % | 82 (81–83) |
| two short | 81 (80–82) |
| one short | 83 (83–84) |
| finish, 90 % left | 150 (150–150) |
| finish, 75 % left | 148 (148–148) |
| finish, 50 % left | 128 (128–128) |
| finish, 25 % left | 112 (112–112) |
| finish, 10 % left | 105 (105–105) |
| finish at the buzzer | 100 (100–100) |
| finish, few mistakes | 121 (108–128) |
| finish, some mistakes | 114 (0–128) |
| finish, many mistakes | 99 (0–114) |
| no input | 0 (0–0) |
| phone: time-out one short | 83 (83–84) |
| phone: reload at half | 68 (63–71) |
| phone: reload, then one action | 13 (12–17) |
| kit careless | 0 (0–80) |
| kit below average | 40 (0–80) |
| kit average | 63 (0–78) |
| kit good | 99 (76–120) |
| kit great | 120 (100–141) |
| kit near perfect | 141 (131–145) |
| random: random-1.5/s | 0 (0–0) |
| random: random-3/s | 0 (0–0) |

150 on a clean finish needs: 78 % left (20 s of 90 s).

- PASS room = practice: 480/480 identical
- PASS random near 0: worst strategy median 0, p90 0
- PASS monotonic: progress drops on 0/15 seeds; time drops on 0; mistakes few 121 → many 102
- **FAIL** finish floor 120: buzzer finish 100 (100–100); lowest finish 94
- **FAIL** partial scale: 50 % → 72 (target ~55); one short → 83 (target ~110); top unfinished 84

#### Turntable (`rings`, pattern, finish puzzle) — 480 runs, 15 seeds

Progress means: rings aligned, cut by waste

| Level | median (min–max) |
| --- | --- |
| nothing | 0 (0–0) |
| 10 % | 0 (0–0) |
| 25 % | 0 (0–0) |
| 40 % | 0 (0–0) |
| 50 % | 0 (0–69) |
| 60 % | 0 (0–69) |
| 75 % | 0 (0–69) |
| 90 % | 66 (0–72) |
| two short | 0 (0–69) |
| one short | 66 (0–72) |
| finish, 90 % left | 150 (150–150) |
| finish, 75 % left | 141 (141–141) |
| finish, 50 % left | 114 (114–114) |
| finish, 25 % left | 100 (100–100) |
| finish, 10 % left | 98 (98–98) |
| finish at the buzzer | 97 (97–97) |
| finish, few mistakes | 114 (99–114) |
| finish, some mistakes | 99 (94–114) |
| finish, many mistakes | 94 (91–114) |
| no input | 0 (0–0) |
| phone: time-out one short | 66 (0–72) |
| phone: reload at half | 0 (0–69) |
| phone: reload, then one action | 0 (0–0) |
| kit careless | 0 (0–0) |
| kit below average | 0 (0–98) |
| kit average | 66 (0–107) |
| kit good | 110 (95–123) |
| kit great | 126 (95–132) |
| kit near perfect | 139 (105–150) |
| random: random-1.5/s | 0 (0–0) |
| random: random-3/s | 0 (0–0) |

150 on a clean finish needs: 80 % left (12 s of 60 s).

- PASS room = practice: 480/480 identical
- PASS random near 0: worst strategy median 0, p90 0
- **FAIL** monotonic: progress drops on 8/15 seeds; time drops on 0; mistakes few 114 → many 94
- **FAIL** finish floor 120: buzzer finish 97 (97–97); lowest finish 91
- **FAIL** partial scale: 50 % → 0 (target ~55); one short → 66 (target ~110); top unfinished 72

#### Blackout (`lightsout`, logic, finish puzzle) — 510 runs, 15 seeds

Progress means: lights off towards the solution (solver distance), cut by waste

| Level | median (min–max) |
| --- | --- |
| nothing | 0 (0–0) |
| 10 % | 14 (0–14) |
| 25 % | 28 (28–42) |
| 40 % | 56 (42–56) |
| 50 % | 70 (56–71) |
| 60 % | 71 (56–72) |
| 75 % | 74 (71–82) |
| 90 % | 74 (73–82) |
| two short | 74 (71–82) |
| one short | 79 (73–82) |
| finish, 90 % left | 150 (150–150) |
| finish, 75 % left | 150 (150–150) |
| finish, 50 % left | 135 (135–135) |
| finish, 25 % left | 118 (118–118) |
| finish, 10 % left | 111 (111–111) |
| finish at the buzzer | 106 (106–106) |
| finish, few mistakes | 135 (107–135) |
| finish, some mistakes | 120 (95–135) |
| finish, many mistakes | 111 (95–125) |
| half done, then undone | 0 (0–0) |
| no input | 0 (0–0) |
| phone: time-out one short | 79 (73–82) |
| phone: reload at half | 56 (42–70) |
| phone: reload, then one action | 14 (14–14) |
| kit careless | 28 (0–56) |
| kit below average | 42 (0–71) |
| kit average | 70 (28–106) |
| kit good | 74 (71–129) |
| kit great | 117 (100–143) |
| kit near perfect | 137 (122–150) |
| random: press-every-cell | 0 (0–0) |
| random: press-lit | 0 (0–0) |
| random: random-presses | 0 (0–0) |

150 on a clean finish needs: 72 % left (21 s of 75 s).

- PASS room = practice: 510/510 identical
- PASS random near 0: worst strategy median 0, p90 0
- **FAIL** monotonic: progress drops on 1/15 seeds; time drops on 0; mistakes few 135 → many 111
- **FAIL** finish floor 120: buzzer finish 106 (106–106); lowest finish 95
- **FAIL** partial scale: 50 % → 70 (target ~55); one short → 79 (target ~110); top unfinished 82

#### Bomb Defusal (`bomb`, logic, finish puzzle) — 495 runs, 15 seeds

Progress means: wires cut and buttons pressed correctly in order

| Level | median (min–max) |
| --- | --- |
| nothing | 0 (0–0) |
| 10 % | 0 (0–0) |
| 25 % | 13 (13–13) |
| 40 % | 27 (27–27) |
| 50 % | 40 (40–40) |
| 60 % | 40 (40–40) |
| 75 % | 54 (54–54) |
| 90 % | 67 (67–67) |
| two short | 54 (54–54) |
| one short | 67 (67–67) |
| finish, 90 % left | 150 (150–150) |
| finish, 75 % left | 137 (137–137) |
| finish, 50 % left | 101 (101–101) |
| finish, 25 % left | 84 (84–84) |
| finish, 10 % left | 74 (74–74) |
| finish at the buzzer | 68 (68–68) |
| finish, few mistakes | 101 (13–101) |
| finish, some mistakes | 101 (0–101) |
| finish, many mistakes | 27 (0–101) |
| no input | 0 (0–0) |
| phone: time-out one short | 67 (67–67) |
| phone: reload at half | 27 (27–27) |
| phone: reload, then one action | 13 (13–13) |
| kit careless | 13 (0–40) |
| kit below average | 13 (0–80) |
| kit average | 67 (0–89) |
| kit good | 99 (13–119) |
| kit great | 125 (108–137) |
| kit near perfect | 141 (40–150) |
| random: random-steps | 0 (0–13) |
| random: tap-all-in-order | 0 (0–13) |
| random: tap-all-shuffled | 0 (0–27) |

150 on a clean finish needs: 83 % left (15 s of 90 s).

- PASS room = practice: 495/495 identical
- PASS random near 0: worst strategy median 0, p90 13
- PASS monotonic: progress drops on 0/15 seeds; time drops on 0; mistakes few 101 → many 101
- **FAIL** finish floor 120: buzzer finish 68 (68–68); lowest finish 68
- **FAIL** partial scale: 50 % → 40 (target ~55); one short → 67 (target ~110); top unfinished 67

#### Box Six (`sudoku`, logic, finish puzzle) — 510 runs, 15 seeds

Progress means: cells filled correctly, −5 per wrong cell

| Level | median (min–max) |
| --- | --- |
| nothing | 0 (0–0) |
| 10 % | 12 (12–12) |
| 25 % | 31 (29–31) |
| 40 % | 51 (48–52) |
| 50 % | 63 (63–66) |
| 60 % | 73 (72–74) |
| 75 % | 82 (82–83) |
| 90 % | 90 (90–91) |
| two short | 94 (94–94) |
| one short | 96 (96–96) |
| finish, 90 % left | 150 (150–150) |
| finish, 75 % left | 150 (150–150) |
| finish, 50 % left | 137 (137–137) |
| finish, 25 % left | 115 (115–115) |
| finish, 10 % left | 106 (106–106) |
| finish at the buzzer | 100 (100–100) |
| finish, few mistakes | 137 (137–137) |
| finish, some mistakes | 137 (137–137) |
| finish, many mistakes | 137 (137–137) |
| half done, then undone | 0 (0–0) |
| no input | 0 (0–0) |
| phone: time-out one short | 96 (96–96) |
| phone: reload at half | 63 (60–64) |
| phone: reload, then one action | 6 (6–6) |
| kit careless | 37 (19–57) |
| kit below average | 57 (31–70) |
| kit average | 73 (57–82) |
| kit good | 105 (94–112) |
| kit great | 122 (116–132) |
| kit near perfect | 144 (137–149) |
| random: random-digits | 0 (0–0) |
| random: row-fill | 0 (0–0) |
| random: same-digit | 0 (0–0) |

150 on a clean finish needs: 63 % left (33 s of 90 s).

- PASS room = practice: 510/510 identical
- PASS random near 0: worst strategy median 0, p90 0
- PASS monotonic: progress drops on 0/15 seeds; time drops on 0; mistakes few 137 → many 137
- **FAIL** finish floor 120: buzzer finish 100 (100–100); lowest finish 100
- PASS partial scale: 50 % → 63 (target ~55); one short → 96 (target ~110); top unfinished 96

#### Colour Flood (`flood`, logic, finish puzzle) — 495 runs, 15 seeds

Progress means: share of the board flooded to one colour, moves limited

| Level | median (min–max) |
| --- | --- |
| nothing | 0 (0–0) |
| 10 % | 2 (1–5) |
| 25 % | 7 (3–15) |
| 40 % | 21 (11–33) |
| 50 % | 32 (17–45) |
| 60 % | 42 (34–55) |
| 75 % | 61 (58–70) |
| 90 % | 71 (64–73) |
| two short | 70 (64–73) |
| one short | 73 (71–74) |
| finish, 90 % left | 150 (150–150) |
| finish, 75 % left | 146 (146–146) |
| finish, 50 % left | 114 (114–114) |
| finish, 25 % left | 98 (98–98) |
| finish, 10 % left | 95 (95–95) |
| finish at the buzzer | 93 (93–93) |
| finish, few mistakes | 114 (0–114) |
| finish, some mistakes | 99 (0–114) |
| finish, many mistakes | 0 (0–108) |
| no input | 0 (0–0) |
| phone: time-out one short | 73 (71–74) |
| phone: reload at half | 28 (17–36) |
| phone: reload, then one action | 2 (1–5) |
| kit careless | 42 (12–64) |
| kit below average | 59 (29–71) |
| kit average | 71 (34–93) |
| kit good | 100 (0–118) |
| kit great | 118 (97–131) |
| kit near perfect | 139 (128–144) |
| random: cycle-colours-2/s | 0 (0–92) |
| random: random-colours-0.5/s | 0 (0–0) |
| random: random-colours-2/s | 0 (0–0) |

150 on a clean finish needs: 77 % left (14 s of 60 s).

- PASS room = practice: 495/495 identical
- **FAIL** random near 0: worst strategy median 0, p90 90
- PASS monotonic: progress drops on 0/15 seeds; time drops on 0; mistakes few 114 → many 99
- **FAIL** finish floor 120: buzzer finish 93 (93–93); lowest finish 90
- **FAIL** partial scale: 50 % → 32 (target ~55); one short → 73 (target ~110); top unfinished 74

#### Hanoi (`tower`, logic, finish puzzle) — 510 runs, 15 seeds

Progress means: discs moved to the target peg (solver distance), cut by waste

| Level | median (min–max) |
| --- | --- |
| nothing | 0 (0–0) |
| 10 % | 0 (0–38) |
| 25 % | 0 (0–48) |
| 40 % | 27 (0–53) |
| 50 % | 48 (0–70) |
| 60 % | 48 (48–71) |
| 75 % | 71 (48–75) |
| 90 % | 79 (73–80) |
| two short | 82 (80–83) |
| one short | 86 (86–86) |
| finish, 90 % left | 150 (150–150) |
| finish, 75 % left | 149 (149–149) |
| finish, 50 % left | 126 (126–126) |
| finish, 25 % left | 110 (110–110) |
| finish, 10 % left | 102 (102–102) |
| finish at the buzzer | 99 (99–99) |
| finish, few mistakes | 119 (112–126) |
| finish, some mistakes | 116 (109–119) |
| finish, many mistakes | 105 (98–112) |
| half done, then undone | 0 (0–0) |
| no input | 0 (0–0) |
| phone: time-out one short | 86 (86–86) |
| phone: reload at half | 48 (0–70) |
| phone: reload, then one action | 0 (0–0) |
| kit careless | 24 (0–70) |
| kit below average | 27 (0–73) |
| kit average | 53 (38–100) |
| kit good | 102 (97–118) |
| kit great | 120 (106–141) |
| kit near perfect | 137 (127–150) |
| random: blind-cycle | 0 (0–0) |
| random: random-moves-1.5/s | 0 (0–0) |
| random: random-moves-3/s | 0 (0–0) |

150 on a clean finish needs: 75 % left (22 s of 90 s).

- PASS room = practice: 510/510 identical
- PASS random near 0: worst strategy median 0, p90 0
- PASS monotonic: progress drops on 0/15 seeds; time drops on 0; mistakes few 119 → many 105
- **FAIL** finish floor 120: buzzer finish 99 (99–99); lowest finish 98
- **FAIL** partial scale: 50 % → 48 (target ~55); one short → 86 (target ~110); top unfinished 86

#### Lamplighter (`lightup`, logic, finish puzzle) — 510 runs, 15 seeds

Progress means: lamps placed correctly, −5 per wrong lamp

| Level | median (min–max) |
| --- | --- |
| nothing | 0 (0–0) |
| 10 % | 8 (7–10) |
| 25 % | 31 (26–32) |
| 40 % | 48 (45–52) |
| 50 % | 61 (61–65) |
| 60 % | 72 (70–73) |
| 75 % | 80 (79–81) |
| 90 % | 88 (87–88) |
| two short | 88 (87–88) |
| one short | 91 (91–91) |
| finish, 90 % left | 150 (150–150) |
| finish, 75 % left | 150 (150–150) |
| finish, 50 % left | 126 (126–126) |
| finish, 25 % left | 106 (106–106) |
| finish, 10 % left | 97 (97–97) |
| finish at the buzzer | 92 (92–92) |
| finish, few mistakes | 126 (126–126) |
| finish, some mistakes | 126 (126–126) |
| finish, many mistakes | 126 (126–126) |
| half done, then undone | 0 (0–0) |
| no input | 0 (0–0) |
| phone: time-out one short | 91 (91–91) |
| phone: reload at half | 61 (56–61) |
| phone: reload, then one action | 8 (7–10) |
| kit careless | 20 (6–46) |
| kit below average | 46 (21–67) |
| kit average | 68 (29–84) |
| kit good | 98 (79–104) |
| kit great | 122 (107–129) |
| kit near perfect | 136 (127–149) |
| random: bulbs-everywhere | 0 (0–0) |
| random: fill-dark | 15 (0–53) |
| random: random-30pc | 0 (0–0) |

150 on a clean finish needs: 72 % left (26 s of 90 s).

- PASS room = practice: 510/510 identical
- **FAIL** random near 0: worst strategy median 15, p90 53
- PASS monotonic: progress drops on 0/15 seeds; time drops on 0; mistakes few 126 → many 126
- **FAIL** finish floor 120: buzzer finish 92 (92–92); lowest finish 92
- **FAIL** partial scale: 50 % → 61 (target ~55); one short → 91 (target ~110); top unfinished 91

#### Mosaic (`nonogram`, logic, finish puzzle) — 525 runs, 15 seeds

Progress means: cells filled correctly, −5 per wrong cell

| Level | median (min–max) |
| --- | --- |
| nothing | 0 (0–0) |
| 10 % | 7 (4–8) |
| 25 % | 19 (17–21) |
| 40 % | 31 (30–33) |
| 50 % | 39 (39–41) |
| 60 % | 48 (46–49) |
| 75 % | 60 (59–62) |
| 90 % | 71 (70–72) |
| two short | 73 (72–74) |
| one short | 75 (75–76) |
| finish, 90 % left | 150 (150–150) |
| finish, 75 % left | 139 (139–139) |
| finish, 50 % left | 107 (107–107) |
| finish, 25 % left | 91 (91–91) |
| finish, 10 % left | 83 (83–83) |
| finish at the buzzer | 78 (78–78) |
| finish, few mistakes | 107 (107–107) |
| finish, some mistakes | 107 (107–107) |
| finish, many mistakes | 107 (107–107) |
| half done, then undone | 0 (0–0) |
| no input | 0 (0–0) |
| phone: time-out one short | 75 (75–76) |
| phone: reload at half | 39 (37–39) |
| phone: reload, then one action | 4 (3–4) |
| kit careless | 25 (4–49) |
| kit below average | 52 (12–68) |
| kit average | 67 (46–90) |
| kit good | 104 (88–115) |
| kit great | 121 (107–134) |
| kit near perfect | 139 (132–149) |
| random: busy-lines (reads the screen) | 35 (13–48) |
| random: fill-all | 0 (0–11) |
| random: random-clue-count | 0 (0–22) |
| random: random-half | 0 (0–13) |

150 on a clean finish needs: 82 % left (21 s of 120 s).

- PASS room = practice: 525/525 identical
- n/a screen-reading strategies (reported): busy-lines median 35
- PASS random near 0: worst strategy median 0, p90 10
- PASS monotonic: progress drops on 0/15 seeds; time drops on 0; mistakes few 107 → many 107
- **FAIL** finish floor 120: buzzer finish 78 (78–78); lowest finish 78
- **FAIL** partial scale: 50 % → 39 (target ~55); one short → 75 (target ~110); top unfinished 76

#### Polypotions (`tubes`, logic, finish puzzle) — 480 runs, 15 seeds

Progress means: solver distance (tubesRev 2 solverProgress), cut by waste

| Level | median (min–max) |
| --- | --- |
| nothing | 0 (0–0) |
| 10 % | 27 (24–33) |
| 25 % | 71 (70–71) |
| 40 % | 74 (73–74) |
| 50 % | 76 (76–76) |
| 60 % | 78 (78–79) |
| 75 % | 82 (81–82) |
| 90 % | 85 (85–85) |
| two short | 86 (85–86) |
| one short | 87 (87–87) |
| finish, 90 % left | 150 (150–150) |
| finish, 75 % left | 150 (150–150) |
| finish, 50 % left | 127 (127–127) |
| finish, 25 % left | 110 (110–110) |
| finish, 10 % left | 102 (102–102) |
| finish at the buzzer | 99 (99–99) |
| finish, few mistakes | 121 (117–127) |
| finish, some mistakes | 117 (110–121) |
| finish, many mistakes | 102 (0–117) |
| no input | 0 (0–0) |
| phone: time-out one short | 87 (87–87) |
| phone: reload at half | 76 (75–76) |
| phone: reload, then one action | 12 (12–18) |
| kit careless | 0 (0–39) |
| kit below average | 24 (0–80) |
| kit average | 71 (0–83) |
| kit good | 100 (75–111) |
| kit great | 118 (110–134) |
| kit near perfect | 138 (126–145) |
| random: random-pours-1.5/s | 0 (0–0) |
| random: random-pours-3/s | 0 (0–0) |

150 on a clean finish needs: 75 % left (23 s of 90 s).

- PASS room = practice: 480/480 identical
- PASS random near 0: worst strategy median 0, p90 0
- PASS monotonic: progress drops on 0/15 seeds; time drops on 0; mistakes few 121 → many 106
- **FAIL** finish floor 120: buzzer finish 99 (99–99); lowest finish 99
- **FAIL** partial scale: 50 % → 76 (target ~55); one short → 87 (target ~110); top unfinished 87

#### Safe Cracker (`safe`, logic, finish puzzle) — 495 runs, 15 seeds

Progress means: dials right on the best try; tries cost (rev 2 draft carries the dials left standing)

| Level | median (min–max) |
| --- | --- |
| nothing | 0 (0–0) |
| 10 % | 0 (0–0) |
| 25 % | 0 (0–35) |
| 40 % | 35 (35–70) |
| 50 % | 35 (35–70) |
| 60 % | 70 (70–70) |
| 75 % | 70 (70–70) |
| 90 % | 75 (75–75) |
| two short | 70 (70–70) |
| one short | 75 (75–75) |
| finish, 90 % left | 150 (150–150) |
| finish, 75 % left | 147 (147–147) |
| finish, 50 % left | 110 (110–110) |
| finish, 25 % left | 98 (98–98) |
| finish, 10 % left | 96 (96–96) |
| finish at the buzzer | 95 (95–95) |
| finish, few mistakes | 110 (95–110) |
| finish, some mistakes | 110 (89–110) |
| finish, many mistakes | 95 (0–110) |
| no input | 0 (0–0) |
| phone: time-out one short | 75 (75–75) |
| phone: reload at half | 35 (35–70) |
| phone: reload, then one action | 0 (0–35) |
| kit careless | 35 (0–70) |
| kit below average | 35 (0–96) |
| kit average | 75 (0–98) |
| kit good | 100 (83–121) |
| kit great | 122 (114–135) |
| kit near perfect | 140 (128–150) |
| random: random-tries | 0 (0–35) |
| random: single-dial-clues | 0 (0–35) |
| random: try-0000 | 0 (0–0) |

150 on a clean finish needs: 77 % left (18 s of 75 s).

- PASS room = practice: 495/495 identical
- **FAIL** random near 0: worst strategy median 0, p90 35
- PASS monotonic: progress drops on 0/15 seeds; time drops on 0; mistakes few 110 → many 95
- **FAIL** finish floor 120: buzzer finish 95 (95–95); lowest finish 89
- **FAIL** partial scale: 50 % → 35 (target ~55); one short → 75 (target ~110); top unfinished 75

#### Shikaku (`shikaku`, logic, finish puzzle) — 495 runs, 15 seeds

Progress means: rectangles drawn that match the solution

| Level | median (min–max) |
| --- | --- |
| nothing | 0 (0–0) |
| 10 % | 5 (3–19) |
| 25 % | 34 (15–46) |
| 40 % | 56 (33–70) |
| 50 % | 71 (50–77) |
| 60 % | 75 (59–80) |
| 75 % | 83 (76–88) |
| 90 % | 92 (89–95) |
| two short | 92 (89–95) |
| one short | 95 (92–97) |
| finish, 90 % left | 150 (150–150) |
| finish, 75 % left | 150 (150–150) |
| finish, 50 % left | 135 (135–135) |
| finish, 25 % left | 114 (114–114) |
| finish, 10 % left | 104 (104–104) |
| finish at the buzzer | 98 (98–98) |
| finish, few mistakes | 135 (135–135) |
| finish, some mistakes | 135 (135–135) |
| finish, many mistakes | 135 (135–135) |
| half done, then undone | 0 (0–0) |
| no input | 0 (0–0) |
| phone: time-out one short | 95 (92–97) |
| phone: reload at half | 69 (42–77) |
| phone: reload, then one action | 5 (3–15) |
| kit careless | 31 (0–60) |
| kit below average | 57 (34–74) |
| kit average | 72 (44–81) |
| kit good | 100 (83–109) |
| kit great | 119 (115–130) |
| kit near perfect | 139 (134–144) |
| random: random-drags | 0 (0–10) |
| random: random-valid-rects | 0 (0–61) |

150 on a clean finish needs: 65 % left (32 s of 90 s).

- PASS room = practice: 495/495 identical
- **FAIL** random near 0: worst strategy median 0, p90 49
- PASS monotonic: progress drops on 0/15 seeds; time drops on 0; mistakes few 135 → many 135
- **FAIL** finish floor 120: buzzer finish 98 (98–98); lowest finish 98
- **FAIL** partial scale: 50 % → 71 (target ~55); one short → 95 (target ~110); top unfinished 97

#### Tents and Trees (`tents`, logic, finish puzzle) — 525 runs, 15 seeds

Progress means: tents placed correctly, −10 per wrong tent

| Level | median (min–max) |
| --- | --- |
| nothing | 0 (0–0) |
| 10 % | 11 (11–11) |
| 25 % | 32 (22–32) |
| 40 % | 43 (43–43) |
| 50 % | 65 (54–65) |
| 60 % | 72 (65–72) |
| 75 % | 82 (77–82) |
| 90 % | 86 (82–86) |
| two short | 86 (82–86) |
| one short | 91 (86–91) |
| finish, 90 % left | 150 (150–150) |
| finish, 75 % left | 150 (150–150) |
| finish, 50 % left | 122 (122–122) |
| finish, 25 % left | 105 (105–105) |
| finish, 10 % left | 97 (97–97) |
| finish at the buzzer | 92 (92–92) |
| finish, few mistakes | 122 (122–122) |
| finish, some mistakes | 122 (122–122) |
| finish, many mistakes | 122 (122–122) |
| half done, then undone | 0 (0–0) |
| no input | 0 (0–0) |
| phone: time-out one short | 91 (86–91) |
| phone: reload at half | 54 (54–54) |
| phone: reload, then one action | 11 (11–11) |
| kit careless | 11 (0–65) |
| kit below average | 43 (0–77) |
| kit average | 54 (22–82) |
| kit good | 104 (93–118) |
| kit great | 119 (108–127) |
| kit near perfect | 137 (132–147) |
| random: around-every-tree | 0 (0–0) |
| random: fill-all | 0 (0–0) |
| random: one-per-tree | 0 (0–32) |
| random: random-cells | 0 (0–0) |

150 on a clean finish needs: 72 % left (25 s of 90 s).

- PASS room = practice: 525/525 identical
- PASS random near 0: worst strategy median 0, p90 11
- PASS monotonic: progress drops on 0/15 seeds; time drops on 0; mistakes few 122 → many 122
- **FAIL** finish floor 120: buzzer finish 92 (92–92); lowest finish 92
- **FAIL** partial scale: 50 % → 65 (target ~55); one short → 91 (target ~110); top unfinished 91

#### Ball Tracker (`balltrack`, arcade, arcade) — 50 runs, 10 seeds

| Level | median (min–max) |
| --- | --- |
| no input | 0 (0–0) |
| bot average | 70 (51–118) |
| bot good | 97 (76–135) |
| bot great | 142 (118–150) |
| bot near perfect | 135 (118–150) |

- PASS random near 0: worst strategy median 0, p90 0
- PASS average player 60–79: average 70 ✓, good 97 ✓, great 142 (target 110–129), near 135 ✓
- **FAIL** levels separate: two neighbouring levels within 5 points

#### Breaker (`breaker`, arcade, arcade) — 50 runs, 10 seeds

| Level | median (min–max) |
| --- | --- |
| no input | 0 (0–0) |
| bot average | 108 (35–143) |
| bot good | 95 (63–146) |
| bot great | 111 (52–139) |
| bot near perfect | 141 (108–150) |

- PASS random near 0: worst strategy median 0, p90 0
- **FAIL** average player 60–79: average 108 (target 60–79), good 95 ✓, great 111 ✓, near 141 ✓
- **FAIL** levels separate: two neighbouring levels within 5 points

#### Coral Pop (`bubble`, arcade, arcade) — 50 runs, 10 seeds

| Level | median (min–max) |
| --- | --- |
| no input | 0 (0–0) |
| bot average | 72 (30–112) |
| bot good | 120 (86–139) |
| bot great | 129 (103–139) |
| bot near perfect | 139 (126–143) |

- PASS random near 0: worst strategy median 0, p90 0
- PASS average player 60–79: average 72 ✓, good 120 (target 90–109), great 129 ✓, near 139 ✓
- PASS levels separate: each level ≥ 5 above the one below

#### Fission (`burst`, arcade, arcade) — 50 runs, 10 seeds

| Level | median (min–max) |
| --- | --- |
| no input | 0 (0–0) |
| bot average | 77 (58–140) |
| bot good | 101 (0–150) |
| bot great | 116 (85–150) |
| bot near perfect | 101 (87–150) |

- PASS random near 0: worst strategy median 0, p90 0
- PASS average player 60–79: average 77 ✓, good 101 ✓, great 116 ✓, near 101 (target 130–149)
- **FAIL** levels separate: two neighbouring levels within 5 points

#### Flightpath (`bullseye`, arcade, arcade) — 50 runs, 10 seeds

| Level | median (min–max) |
| --- | --- |
| no input | 0 (0–0) |
| bot average | 67 (46–105) |
| bot good | 83 (52–143) |
| bot great | 119 (107–144) |
| bot near perfect | 142 (122–146) |

- PASS random near 0: worst strategy median 0, p90 0
- PASS average player 60–79: average 67 ✓, good 83 (target 90–109), great 119 ✓, near 142 ✓
- PASS levels separate: each level ≥ 5 above the one below

#### Gemstone (`matchup`, arcade, arcade) — 50 runs, 10 seeds

| Level | median (min–max) |
| --- | --- |
| no input | 0 (0–0) |
| bot average | 70 (40–90) |
| bot good | 90 (41–113) |
| bot great | 98 (42–115) |
| bot near perfect | 105 (67–138) |

- PASS random near 0: worst strategy median 0, p90 0
- PASS average player 60–79: average 70 ✓, good 90 ✓, great 98 (target 110–129), near 105 (target 130–149)
- PASS levels separate: each level ≥ 5 above the one below

#### Grappler (`swing`, arcade, arcade) — 50 runs, 10 seeds

| Level | median (min–max) |
| --- | --- |
| no input | 0 (0–0) |
| bot average | 87 (31–103) |
| bot good | 99 (40–129) |
| bot great | 123 (94–147) |
| bot near perfect | 131 (112–147) |

- PASS random near 0: worst strategy median 0, p90 0
- **FAIL** average player 60–79: average 87 (target 60–79), good 99 ✓, great 123 ✓, near 131 ✓
- PASS levels separate: each level ≥ 5 above the one below

#### High Rise (`skyline`, arcade, arcade) — 50 runs, 10 seeds

| Level | median (min–max) |
| --- | --- |
| no input | 0 (0–0) |
| bot average | 68 (52–90) |
| bot good | 102 (72–109) |
| bot great | 124 (90–131) |
| bot near perfect | 140 (132–150) |

- PASS random near 0: worst strategy median 0, p90 0
- PASS average player 60–79: average 68 ✓, good 102 ✓, great 124 ✓, near 140 ✓
- PASS levels separate: each level ≥ 5 above the one below

#### Hover (`hover`, arcade, arcade) — 50 runs, 10 seeds

| Level | median (min–max) |
| --- | --- |
| no input | 0 (0–0) |
| bot average | 44 (0–100) |
| bot good | 82 (0–113) |
| bot great | 130 (100–149) |
| bot near perfect | 139 (116–149) |

- PASS random near 0: worst strategy median 0, p90 0
- **FAIL** average player 60–79: average 44 (target 60–79), good 82 (target 90–109), great 130 (target 110–129), near 139 ✓
- PASS levels separate: each level ≥ 5 above the one below

#### Jaywalk (`cross`, arcade, arcade) — 50 runs, 10 seeds

| Level | median (min–max) |
| --- | --- |
| no input | 0 (0–0) |
| bot average | 71 (45–100) |
| bot good | 110 (59–144) |
| bot great | 128 (59–144) |
| bot near perfect | 143 (59–150) |

- PASS random near 0: worst strategy median 0, p90 0
- PASS average player 60–79: average 71 ✓, good 110 (target 90–109), great 128 ✓, near 143 ✓
- PASS levels separate: each level ≥ 5 above the one below

#### Meteor (`snake`, arcade, arcade) — 50 runs, 10 seeds

| Level | median (min–max) |
| --- | --- |
| no input | 0 (0–0) |
| bot average | 83 (35–108) |
| bot good | 102 (55–133) |
| bot great | 137 (100–147) |
| bot near perfect | 126 (112–150) |

- PASS random near 0: worst strategy median 0, p90 0
- **FAIL** average player 60–79: average 83 (target 60–79), good 102 ✓, great 137 (target 110–129), near 126 (target 130–149)
- **FAIL** levels separate: two neighbouring levels within 5 points

#### Orbit (`orbit`, arcade, arcade) — 50 runs, 10 seeds

| Level | median (min–max) |
| --- | --- |
| no input | 0 (0–0) |
| bot average | 86 (0–131) |
| bot good | 102 (29–131) |
| bot great | 132 (96–150) |
| bot near perfect | 140 (117–150) |

- PASS random near 0: worst strategy median 0, p90 0
- **FAIL** average player 60–79: average 86 (target 60–79), good 102 ✓, great 132 (target 110–129), near 140 ✓
- PASS levels separate: each level ≥ 5 above the one below

#### Pinball (`pinball`, arcade, arcade) — 50 runs, 10 seeds

| Level | median (min–max) |
| --- | --- |
| no input | 0 (0–0) |
| bot average | 80 (14–104) |
| bot good | 112 (36–141) |
| bot great | 110 (52–145) |
| bot near perfect | 139 (107–147) |

- PASS random near 0: worst strategy median 0, p90 0
- **FAIL** average player 60–79: average 80 (target 60–79), good 112 (target 90–109), great 110 ✓, near 139 ✓
- **FAIL** levels separate: two neighbouring levels within 5 points

#### Rainbow Bridge (`inkbridge`, arcade, arcade) — 50 runs, 10 seeds

| Level | median (min–max) |
| --- | --- |
| no input | 0 (0–0) |
| bot average | 17 (0–53) |
| bot good | 33 (0–102) |
| bot great | 58 (0–103) |
| bot near perfect | 94 (33–150) |

- PASS random near 0: worst strategy median 0, p90 0
- **FAIL** average player 60–79: average 17 (target 60–79), good 33 (target 90–109), great 58 (target 110–129), near 94 (target 130–149)
- PASS levels separate: each level ≥ 5 above the one below

#### Rally (`rally`, arcade, arcade) — 50 runs, 10 seeds

| Level | median (min–max) |
| --- | --- |
| no input | 0 (0–0) |
| bot average | 73 (12–133) |
| bot good | 81 (50–144) |
| bot great | 142 (65–147) |
| bot near perfect | 145 (66–148) |

- PASS random near 0: worst strategy median 0, p90 0
- PASS average player 60–79: average 73 ✓, good 81 (target 90–109), great 142 (target 110–129), near 145 ✓
- **FAIL** levels separate: two neighbouring levels within 5 points

#### Roofbound (`flip`, arcade, arcade) — 50 runs, 10 seeds

| Level | median (min–max) |
| --- | --- |
| no input | 0 (0–0) |
| bot average | 54 (3–100) |
| bot good | 100 (47–150) |
| bot great | 120 (67–150) |
| bot near perfect | 150 (120–150) |

- PASS random near 0: worst strategy median 0, p90 0
- **FAIL** average player 60–79: average 54 (target 60–79), good 100 ✓, great 120 ✓, near 150 (target 130–149)
- PASS levels separate: each level ≥ 5 above the one below

#### Scrumper (`snip`, arcade, arcade) — 50 runs, 10 seeds

| Level | median (min–max) |
| --- | --- |
| no input | 0 (0–0) |
| bot average | 79 (38–92) |
| bot good | 96 (46–133) |
| bot great | 111 (80–128) |
| bot near perfect | 129 (112–147) |

- PASS random near 0: worst strategy median 0, p90 0
- PASS average player 60–79: average 79 ✓, good 96 ✓, great 111 ✓, near 129 (target 130–149)
- PASS levels separate: each level ≥ 5 above the one below

#### Slice (`slice`, arcade, arcade) — 50 runs, 10 seeds

| Level | median (min–max) |
| --- | --- |
| no input | 0 (0–0) |
| bot average | 78 (42–94) |
| bot good | 97 (70–149) |
| bot great | 122 (94–149) |
| bot near perfect | 129 (92–149) |

- PASS random near 0: worst strategy median 0, p90 0
- PASS average player 60–79: average 78 ✓, good 97 ✓, great 122 ✓, near 129 (target 130–149)
- PASS levels separate: each level ≥ 5 above the one below

#### Swish (`bintoss`, arcade, arcade) — 50 runs, 10 seeds

| Level | median (min–max) |
| --- | --- |
| no input | 0 (0–0) |
| bot average | 97 (32–139) |
| bot good | 105 (48–139) |
| bot great | 110 (93–139) |
| bot near perfect | 144 (128–150) |

- PASS random near 0: worst strategy median 0, p90 0
- **FAIL** average player 60–79: average 97 (target 60–79), good 105 ✓, great 110 ✓, near 144 ✓
- PASS levels separate: each level ≥ 5 above the one below

#### Tempo (`beat`, arcade, arcade) — 50 runs, 10 seeds

| Level | median (min–max) |
| --- | --- |
| no input | 0 (0–0) |
| bot average | 70 (61–80) |
| bot good | 97 (90–110) |
| bot great | 123 (113–145) |
| bot near perfect | 140 (130–150) |

- PASS random near 0: worst strategy median 0, p90 0
- PASS average player 60–79: average 70 ✓, good 97 ✓, great 123 ✓, near 140 ✓
- PASS levels separate: each level ≥ 5 above the one below

#### Tilt (`tilt`, arcade, arcade) — 50 runs, 10 seeds

| Level | median (min–max) |
| --- | --- |
| no input | 0 (0–0) |
| bot average | 79 (34–140) |
| bot good | 80 (18–135) |
| bot great | 126 (33–144) |
| bot near perfect | 69 (32–148) |

- PASS random near 0: worst strategy median 0, p90 0
- PASS average player 60–79: average 79 ✓, good 80 (target 90–109), great 126 ✓, near 69 (target 130–149)
- **FAIL** levels separate: two neighbouring levels within 5 points

#### Wavefront (`wavefront`, arcade, arcade) — 50 runs, 10 seeds

| Level | median (min–max) |
| --- | --- |
| no input | 0 (0–0) |
| bot average | 85 (63–150) |
| bot good | 80 (62–150) |
| bot great | 124 (76–150) |
| bot near perfect | 133 (65–150) |

- PASS random near 0: worst strategy median 0, p90 0
- **FAIL** average player 60–79: average 85 (target 60–79), good 80 (target 90–109), great 124 ✓, near 133 ✓
- **FAIL** levels separate: two neighbouring levels within 5 points
<!-- /generated:detail -->

## (e) Bugs, not tuning

1. **Interlock: Done accepts a short grid.**
   - Done submits any valid grid of 3+ tiles with the lock sound and finish effect (`src/puzzles/tileGrid.tsx:229-234`).
   - The grader sets `isCorrect = valid` (`grade.ts:349`), so a 14-tile grid is stored as *correct* but scored on the
     unfinished credit, and its time left is thrown away.
   - The reveal and leaderboard show "14/15 tiles · valid" in gold.
   - This is Joe's "14 valid = 87".
2. **Colour Flood can be finished by cycling colours.** The `cycle-colours-2/s` spam finished on 3 of 15 seeds,
   scoring 90–92, inside the move limit. Under the rule that would be 120+.
3. **Integer Pyramid: an unfinished board scores like a finish.** One short = 122 against 123 for a finish at the
   buzzer, breaking "unfinished up to 110". The knot row puts great at an unfinished result (`puzzleBands.data.ts:31`).
4. **Counterweight's weights assume any order; the stage deals scales in order.** One short is scales 1–3 = 70. The
   rev-1 "best three = 110" is reachable only by skipping scale 3, which the stage never offers.
5. **A reload mid-round loses your progress once you keep playing.**
   - The draft keeper restores the stored draft, so a time-out right after a reload is safe: the half-done score was
     kept in every game.
   - But the stage restarts from its opening board. The first new action replaces the restored draft (`roomDraft.ts`
     header: "a reload never keeps the better of two attempts").
   - In this report, half done and then one action after a reload scored 0–14 in most games.
   - Exact's board and Nucleus' word list are plain `useState`, not `useStageState`
     (`targetNumber.tsx:192, 195`; `WordsmithPuzzle.tsx:50`), so even a re-mount without a reload wipes them.
6. **Stale intro texts:**
   - Exact: "Exact hit scores 120 + speed; off by 1 scores 110" (`targetNumber.tsx:152`).
   - Nucleus: "Round score = floor(2.5 × word points)" and "nine-letter word for 15" (`wordsmith.tsx:32`).
7. **Brimful: running out of moves on one jug puzzle ends the whole round**, and the time left is lost
   (`measure.tsx:455-466`). Moves before a Reset count toward the limit. Possibly intended; listed because it turns
   "1 jug" into the final score with time still on the clock.
8. **Tenfall's band map has a 20-point cliff.** Raw 135 → 120 and raw 137 → 140 (`tenDrop.ts:467`), so clearing about
   5 s sooner moves the score about 26 points. Near the top the map gives more than the raw score (140 → 142).
9. **Displays that hide the cost:**
   - Trail's reveal shows "N / 26 tiles correct" and never the wrong-tile cost.
   - Slider's shows "N/5 rows made" and never the waste cut to 0.
   - Swapword's board counts gold tiles (13/21) while its leaderboard counts placed tiles (10/18).
10. **Strikeout's credit caps at 4 words.** 4 words = 4 words + 7 letters of word 5 = 75, so the last word's progress
    is not measured.

Not bugs, but measurement limits:

- Arcade bots that cannot separate levels: Tilt near-perfect 69 below average 79; Breaker average 108 above good 95;
  Fission near 101 below great 116; Meteor and Wavefront are inverted between neighbouring levels.
- Rainbow Bridge bots score 17 / 33 / 58 / 94. `docs/scoring-targets.md` already notes that these bots under-rate it.
- 10 arcade seeds is noisy. The 19 Oct fit used 30.

## 3. Fix plan (proposals only)

### The shared puzzle helper

Recommendation: replace the per-game rev-2 knots for finish puzzles with one formula on a new stamp,
`puzzleScoreRev 3`. Older rounds keep their stamps and grade as before.

```
unfinished = round(min(110, 110 × progress ÷ oneShort))       progress 0–1 from the game's own measure
finished   = round(120 + 30 × min(1, timeLeftShare ÷ fastShare) × efficiency)
```

- **progress** is each game's own measure of what is done: today's rev-1 unfinished credit ÷ 110, with the
  per-game fixes below.
- **oneShort** is the progress one step short holds, so one short = 110 and half done ≈ 55. It is a constant per game,
  measured by the script (the proposal table's first column).
- **fastShare** is the share of the clock a fast human leaves. The script uses the near-perfect kit player's 75th
  percentile, which comes to 0.29–0.9 and in most games 0.55–0.8. So a near-perfect player scores about 145–150, and
  150 needs a fast, clean run.
- **efficiency** (0–1) is the game's own mistake measure: wasted moves, tries, strikes, misses or wrong taps. Mistakes
  only take away from the 30 speed points, so a finish never drops below 120.
- **Random play** stays where the game's progress measure puts it, 0 in nearly every game. The script's worst spam
  strategy gives at most 5 under the helper in every puzzle but Chroma Lines (11) and Lamplighter (14), whose blind
  fill strategies reach real progress.

The per-game numbers the helper gives are in the generated table below, scaled on each game's measured one-short
progress and fast share.

- In 41 of 42 puzzles one short = 110 and every finish is 120–150, with random ≈ 0 (Turntable is the exception).
- Half done reaches only 0–16 in the move puzzles (Gridlock, Heave, Jumbled, Turntable, Exact, Interlock), because
  their progress measures don't count work done along the way. Those need the progress fixes in batch 1.
- Turntable's one-short progress is 0.15, so its row is marked "needs a progress measure".

<!-- generated:proposal -->
| Game | one-short progress | fast time share | 25 % | 50 % | 75 % | one short | buzzer finish | 50 % left | 90 % left | random | avg | good | great | near |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Cryptogrid | 1 | 0.75 | 24 | 60 | 86 | 110 | 120 | 140 | 150 | 0 | 88 | 135 | 142 | 149 |
| Interlock | 0.8 | 0.72 | 0 | 0 | 64 | 110 | 120 | 141 | 150 | 0 | 64 | 133 | 143 | 149 |
| Lookout | 1 | 0.78 | 22 | 66 | 88 | 110 | 120 | 139 | 150 | 0 | 110 | 139 | 144 | 149 |
| Roundabout | 0.97 | 0.51 | 37 | 79 | 95 | 110 | 120 | 149 | 150 | 0 | 74 | 105 | 134 | 148 |
| Slider | 1 | 0.9 | 0 | 0 | 0 | 110 | 120 | 137 | 150 | 0 | 134 | 139 | 149 | 150 |
| Strikeout | 1 | 0.74 | 32 | 90 | 98 | 110 | 120 | 136 | 144 | 0 | 110 | 128 | 133 | 140 |
| Swapword | 1 | 0.79 | 24 | 55 | 83 | 110 | 120 | 139 | 150 | 0 | 121 | 139 | 145 | 149 |
| Brimful | 1 | 0.66 | 30 | 65 | 110 | 110 | 120 | 143 | 150 | 0 | 65 | 122 | 135 | 149 |
| Checkout | 0.91 | 0.58 | 24 | 51 | 110 | 110 | 120 | 146 | 150 | 0 | 51 | 110 | 135 | 148 |
| Counterweight | 0.64 | 0.59 | 24 | 63 | 110 | 110 | 120 | 146 | 150 | 0 | 110 | 126 | 138 | 148 |
| Exact | 0.45 | 0.79 | 0 | 0 | 0 | 110 | 120 | 139 | 150 | 0 | 110 | 136 | 143 | 148 |
| Integer Pyramid | 0.98 | 0.29 | 37 | 64 | 89 | 110 | 120 | 150 | 150 | 5 | 50 | 81 | 108 | 148 |
| Operator | 0.77 | 0.7 | 26 | 65 | 110 | 110 | 120 | 141 | 150 | 0 | 110 | 136 | 143 | 149 |
| Trail | 1 | 0.66 | 26 | 57 | 84 | 110 | 120 | 143 | 150 | 0 | 66 | 130 | 140 | 150 |
| Ascend | 1 | 0.7 | 29 | 57 | 86 | 110 | 120 | 141 | 150 | 0 | 66 | 129 | 137 | 149 |
| Don't Break the Chain | 1 | 0.53 | 42 | 82 | 99 | 110 | 121 | 149 | — | 0 | 20 | 82 | 137 | 150 |
| Double Take | 1 | 0.69 | 30 | 60 | 90 | 110 | 120 | 142 | 150 | 0 | 72 | 130 | 141 | 148 |
| Eagle Eye | 0.97 | 0.55 | 36 | 72 | 93 | 110 | 120 | 147 | 150 | 0 | 78 | 110 | 137 | 148 |
| Labyrinth | 0.99 | 0.48 | 23 | 52 | 82 | 110 | 120 | 150 | 150 | 3 | 63 | 122 | 138 | 148 |
| Matchmaker | 1 | 0.72 | 8 | 39 | 71 | 110 | 120 | 141 | 150 | 0 | 86 | 137 | 144 | 149 |
| Tally | 0.86 | 0.72 | 46 | 81 | 110 | 110 | 120 | 141 | 150 | 0 | 74 | 131 | 140 | 147 |
| Chroma Lines | 0.92 | 0.61 | 30 | 60 | 90 | 110 | 120 | 144 | 150 | 11 | 80 | 128 | 140 | 148 |
| Gridlock | 1 | 0.68 | 0 | 0 | 55 | 110 | 120 | 142 | 150 | 0 | 28 | 129 | 141 | 149 |
| Heave | 1 | 0.64 | 37 | 37 | 73 | 110 | 120 | 143 | 150 | 0 | 73 | 131 | 140 | 149 |
| Jumbled | 1 | 0.78 | 14 | 16 | 47 | 110 | 120 | 139 | 150 | 0 | 67 | 136 | 142 | 149 |
| Lightbender | 1 | 0.63 | 22 | 66 | 88 | 110 | 120 | 145 | 150 | 0 | 22 | 123 | 130 | 148 |
| Pipeline | 0.95 | 0.49 | 7 | 32 | 68 | 110 | 120 | 150 | 150 | 4 | 51 | 125 | 138 | 149 |
| Skid | 1 | 0.63 | 26 | 58 | 84 | 110 | 120 | 144 | 150 | 0 | 55 | 125 | 137 | 148 |
| Tessellate | 1 | 0.59 | 28 | 55 | 83 | 110 | 120 | 145 | 150 | 0 | 69 | 124 | 136 | 148 |
| Topsy-Turvy | 0.92 | 0.69 | 26 | 60 | 86 | 110 | 120 | 142 | 150 | 0 | 48 | 126 | 140 | 147 |
| Turntable | 0.15 ⚠ needs a progress measure | 0.77 | 0 | 0 | 0 | 18 | 120 | 140 | 150 | 0 | 18 | 137 | 145 | 149 |
| Blackout | 0.59 | 0.66 | 17 | 42 | 76 | 110 | 120 | 143 | 150 | 0 | 42 | 76 | 131 | 146 |
| Bomb Defusal | 1 | 0.8 | 22 | 66 | 88 | 110 | 120 | 139 | 150 | 0 | 110 | 138 | 146 | 149 |
| Box Six | 0.95 | 0.59 | 27 | 54 | 83 | 110 | 120 | 146 | 150 | 0 | 66 | 124 | 138 | 149 |
| Colour Flood | 0.97 | 0.73 | 10 | 46 | 87 | 110 | 120 | 141 | 150 | 0 | 104 | 135 | 143 | 149 |
| Hanoi | 1 | 0.69 | 0 | 28 | 47 | 110 | 120 | 142 | 150 | 0 | 31 | 129 | 139 | 147 |
| Lamplighter | 1 | 0.64 | 28 | 55 | 86 | 110 | 120 | 144 | 150 | 14 | 62 | 126 | 141 | 148 |
| Mosaic | 0.95 | 0.78 | 26 | 56 | 85 | 110 | 120 | 139 | 150 | 0 | 94 | 138 | 145 | 149 |
| Polypotions | 0.96 | 0.67 | 27 | 57 | 83 | 110 | 120 | 143 | 150 | 0 | 27 | 126 | 139 | 148 |
| Safe Cracker | 0.68 | 0.74 | 0 | 37 | 73 | 110 | 120 | 140 | 150 | 0 | 110 | 137 | 144 | 149 |
| Shikaku | 0.95 | 0.57 | 26 | 56 | 84 | 110 | 120 | 146 | 150 | 0 | 58 | 122 | 137 | 149 |
| Tents and Trees | 1 | 0.66 | 30 | 60 | 90 | 110 | 120 | 143 | 150 | 0 | 50 | 131 | 142 | 149 |
<!-- /generated:proposal -->

What moves to the helper:

- **As they are (rev-1 progress is a fair share):** Interlock (with bug 1 fixed), Lookout, Roundabout, Cryptogrid,
  Swapword, Checkout, Ascend, Chain, Integer Pyramid, Double Take, Eagle Eye, Labyrinth, Matchmaker, Tally,
  Chroma Lines, Pipeline, Skid, Tessellate, Topsy-Turvy, Polypotions, Box Six, Colour Flood (with bug 2), Hanoi,
  Lamplighter, Mosaic, Shikaku, Tents and Trees, Bomb Defusal, Safe Cracker and Exact. Exact's progress is the
  distance, with off by 1 as its "one short".
- **After a progress fix:**
  - Slider: rows made, with waste only cutting the speed part, not to 0.
  - Trail: the longest correct prefix, or right tiles minus a capped penalty.
  - Counterweight: scales in deal order, 25 % each.
  - Operator: equal weights, plus slots right inside the current equation; drop the spam knot.
  - Brimful: credit for a jug puzzle part done, by solver distance.
  - Strikeout: count word 5's letters; remove the cap at 4 words.
  - Turntable, Gridlock, Heave, Jumbled, Blackout, Lightbender: solver distance from the start, never below the best
    reached (the way `solverProgress.server.ts` already works for Topsy-Turvy and Polypotions).
- **Not on the helper:**
  - Nucleus, Forage and Ballpark: open games, kept on smooth curves. Nucleus needs the 140 cap without the all-letters
    word.
  - Flash and Bang On: tap logs, open.
  - Tenfall, Letterfall, Bonk, Pull! and Mixed Signals: engine games scored in the sim.
  - The 22 arcade games: per-revision band curves in the sim, `strictBands.data.ts`.
  - The helper's shape still applies to Tenfall: its tenRev 1 raw score already is 120 + speed for a finish.

Stamps:

- `puzzleScoreRev 3` covers the helper and every puzzle progress fix (one stamp, dealt to every finish puzzle).
- `tenRev 3` for Tenfall: raw tenRev 1 scoring, or a smooth map without the cliff.
- `wordsmithRev 2` for Nucleus' cap.
- Arcade curves need new band revisions (band 4) game by game, only after the bots are re-measured.
- The Interlock Done gate and the `useStageState` changes are phone-only: no stamp.
- Rerun `bun scripts/practice-stamps.ts` after any new stamp (practice-bests-check fails until it is rerun).

Other proposals (the failing games outside the helper):

| Game | Today | Proposal | New numbers (from this report's runs) | Stamp |
| --- | --- | --- | --- | --- |
| Tenfall | 10/10 at the buzzer ≈ 92, 8/10 = 70 | Score the tenRev 1 raw (already 120 + speed for 10/10, 110 × n ÷ 9 unfinished) | 10/10 at 88.6 s = 121, 9/10 = 110, 8/10 = 97 | `tenRev 3` |
| Nucleus | 150 at 60 word points; random 4-letter paths median 6, p90 27 | One curve instead of two: average (10 points) → 70, cap 140 without the all-letters word, 150 only with it | average 70, near-perfect ≤ 140 unless the long word is found | `wordsmithRev 2` |
| Forage | random 4-letter paths median 22, p90 63 | Count only words of 5+ letters toward the first 60 points, or a lower 4-letter weight | random ≈ 5 (to measure) | `wordHuntRev 2` |
| Bang On | random taps median 27, p90 53 | Floor accuracy credit at a distance random taps rarely reach | random ≤ 10 (to measure) | `tapRev 4` |
| Flash | average 55, colour-mashing p90 68 | Stop crediting taps on every colour; lift the average-player knot | average ≈ 70 | `tapRev 4` |
| Letterfall | random chains median 16 | Raise the minimum scoring word or refuse random chains | random ≤ 10 | `wordfallRev 4` |
| Pull! | great and near both 150 | Re-fit the top of `clayRev 7`'s map so great ≈ 120 | great ≈ 120, near ≈ 140 | `clayRev 8` |
| Mixed Signals | good 101, great 105 | Re-fit the 100–130 segment | great ≈ 120 | `clashRev 7` |
| Arcade (Rainbow Bridge, Breaker, Tilt, Fission, Wavefront, Meteor, Orbit, Grappler, Hover, Swish, Roofbound, Pinball) | averages 17–108; several bots out of order | First re-measure with 30 seeds and fix the bots' level tables (Tilt, Breaker, Fission, Meteor, Wavefront); then re-fit `strictBands.data.ts` on new band revisions | no new numbers until the bots separate | band 4 per game |

### Two batches on separate files

The batches can be made at the same time by two sessions. Neither batch touches the other's files.

**Batch 1: bugs and the worst outliers (finish puzzles).**

- New `src/lib/duel/puzzleScoreRev3.ts`: the helper, `fastShare` and `oneShort` per game as data.
- New `src/lib/duel/puzzleProgress.ts`: the progress fixes for Slider, Trail, Counterweight, Operator, Brimful,
  Strikeout, Turntable, Gridlock, Heave, Jumbled, Blackout and Lightbender.
- Grading and stamps: `generate.server.ts` (wiring), `puzzleScoreRev.ts` (dealt stamp), and `grade.ts` (Interlock's
  `isCorrect` needs 15 tiles under rev 3).
- Stages: `src/puzzles/tileGrid.tsx` (Done needs 15 tiles), `src/puzzles/targetNumber.tsx` (`useStageState` and the
  intro text).
- Room flow: `src/lib/duel/stageState.ts` and `roomDraft.ts` (keep the stage's state across a reload).
- Texts: `puzzleBandsText.ts`, `introScore.ts` and `instructions.ts` (help and intro numbers).
- Colour Flood's move rule (`colourFlood` generator / limits in `moveLimits.ts`).
- `practiceStamps.data.ts` (regenerated).
- A new `scoring-rev3-check`. Rerun this report.

**Batch 2: open, speed, engine and arcade games.**

- Nucleus: `scoring.ts` (`WORDSMITH_V1_CURVE` / new curve), `wordsmith.server.ts`, `src/puzzles/wordsmith.tsx`
  (intro), `src/components/puzzles/WordsmithPuzzle.tsx` (`useStageState`).
- Forage: `wordHunt.server.ts`.
- Flash and Bang On: `tapLog.ts`, `reaction.ts`, `stopWatch.ts`.
- Tenfall: `src/lib/arcade/tenDrop.ts`.
- Letterfall: `wordfall.ts`.
- Pull!: `clayShoot.ts`.
- Mixed Signals: `colourClash.ts`.
- Arcade bots: `scripts/arcade-skill-bands/bots/*.ts`.
- Arcade curves: `src/lib/arcade/strictBands.data.ts`, `liveBands.ts`, and each re-fitted sim's band revision.
- Their help texts come from `liveBands.ts`; `arcade-help-bands-check` keeps them in step.

Shared-file conflicts to watch:

- `practiceStamps.data.ts` is regenerated by both batches. Whoever merges second reruns
  `bun scripts/practice-stamps.ts`.
- `docs/scoring-targets.md` / CLAUDE.md notes: each batch adds its own section.

## 4. Decisions for Joe

1. **Finishing a puzzle will mean Great or better.**
   - Under the rule, any correct finish is 120+.
   - The kit average players finish most puzzles, so puzzle averages would rise from about 70 to 110–135 (proposal
     table, "avg" column), while arcade averages stay 60–79.
   - *Recommendation:* keep the rule for the beta. Finishing should feel like an achievement, and puzzles where most
     people finish are a difficulty question (shorter clocks, harder boards), not a scoring one.
   - Watch the beta's room results for puzzles that most players finish.
2. **What "fast" means for 150.**
   - Today 150 needs 39–96 % of the clock left (median 74 %): nobody gets it.
   - *Recommendation:* a per-game fast share (the near-perfect kit's 75th percentile, about 55–80 % left in most
     games). Show it in the help as "150 if you finish in about N s with no mistakes".
3. **One step short = 110 in games with only 4 steps** (Operator, Counterweight, Brimful, Checkout).
   - The rule's "≈ 55 at half done" and "≈ 110 one short" cannot both hold with 4 steps (2/4 vs 3/4).
   - *Recommendation:* count partial progress inside the current step, so the curve is smooth: slots in an equation,
     pours in a jug puzzle, weights on a scale. Then take the straight share × 110 with no rescale.
4. **Mistakes on a finish only take speed points.**
   - *Recommendation:* yes, as the rule says. A correct finish never drops below 120. Wasted moves, tries and strikes
     scale the 30 speed points (the helper's efficiency).
5. **Reloads.**
   - *Recommendation:* save the stage's own state with the draft (batch 1), so a reload continues the same board.
     Today a reload then one more action loses the earlier work.
6. **Interlock's Done.**
   - *Recommendation:* Done needs all 15 tiles. A short grid stays a draft, and the time-out grades it as unfinished
     progress. The alternative, scoring a valid short grid as a finish, would let a 3-tile grid finish.
7. **Nucleus' cap.**
   - *Recommendation:* cap at 140 without the all-letters word, as agreed. Today 150 comes at 60 word points.
8. **Letterfall.**
   - Random chains score a median of 16.
   - *Recommendation:* if it leaves rotation, leave it on its current stamps. If it stays, fix the spam floor in batch 2.
9. **Arcade curves before the beta.**
   - *Recommendation:* don't re-fit any arcade curve before the beta except where Joe's own play disagrees. The bots
     can't separate levels in 7 games, and Rainbow Bridge's bots are known to under-rate it. Re-measure at 30 seeds
     after fixing the bots.
10. **Ballpark, Forage and Nucleus stay curves.**
    - *Recommendation:* yes; open games have no finish to anchor 120.
    - Ballpark (average 69) and Nucleus (average 72) already sit in 60–79. Forage (78) is at the top of the band but
      needs its spam floor.

## Assumptions

- **"Progress" in the level grid** is a share of a clean solve's actions. For games whose own measure is not
  action-shaped (Exact's distance, Turntable's rings), the grid shows what the grader gives at that point of a real
  solve.
- **Levels:**
  - "One step short" is the last action before the solve.
  - "Mistakes" are the kit's own slip types at 5 / 15 / 35 % per decision. "Many" sometimes means the kit ran out of
    tries and did not finish; those runs are listed as unfinished.
  - "Undo" is reported only for games whose moves can be reversed (state answers, Slider, Jumbled, Blackout, Hanoi,
    Labyrinth), 21 games in all. In every one but Labyrinth it scored the same as no progress, with tries and hangs
    counters kept. Labyrinth keeps 65 after walking back to the start: it credits the furthest point reached, like
    the best-reached rule `solverProgress.server.ts` uses.
- **The clock:**
  - Tap-log and action-log finishes were replayed at the pace that finishes at each time.
  - Chain cannot be finished slowly, because its momentum window breaks the chain. Its 0 %, 10 % and 25 % levels are
    missing on some seeds and are listed as `-unreached` in the CSV.
  - Chain's 90 % level is out of reach for any player, at a minimum of 250 ms per tap.
- **No stored human practice runs exist in the repo**, so the time 150 needs was compared with the kit players. Puzzle
  `practice_plays` stays server-only, and `scripts/fixtures` holds only kit and bot runs: `replay-runs.json`,
  `scoring-bands-runs.json.gz`.
- **Arcade:** 10 seeds per level (the request's minimum), today's dealt revisions (`LIVE_BANDS`). Careless play is the
  no-input run, because no careless bot exists.

## Checks run

Run locally after the report, to confirm nothing changed (the full suite was not run locally):

- scoring-bands-check: **pass** (5,775 checks, ~15 s)
- replay-check: **pass** (5,999 checks, 419 stored runs, ~21 s)
- room-practice-grade-check: **pass** (42,994 room/practice comparisons over 75 games, ~33 s)

`bun.lock` is unchanged. No file under `src/` changed.
