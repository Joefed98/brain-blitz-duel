# The puzzle scoring standard (27 Oct 2026)

One agreed scoring shape for 45 puzzles (the brief said 46; its tables list 45: Word 7, Number 9, Speed and Attention 8,
Pattern and Logic 21), each on a new version stamp one above its live stamp. Puzzles only. Outside the standard and
unchanged: Nucleus, Forage, Bonk, Pull!, Flash, Bang On (and every arcade game).

Every older puzzle grades exactly as before: `standard-legacy-check` regrades 5,400 cases recorded on main 158fd83
(`scripts/standard-legacy-record.ts`).

## The shape (`src/lib/duel/standard/shape.ts`)

- **Finished = 150.** Speed + bonus add up to 50 more (max 200); the split is per game.
- **Speed**: full points if solved by the game's "full by" time (seconds used), then shrinking evenly to 0 at the buzzer
  (`speedPoints`).
- **Par bonuses** (moves, swaps, pours, presses, turns, tilts, pushes, slides, hangs): full at par, shrinking evenly to 0
  at twice par (`parPoints`; Colour Flood: to 0 at its move limit, par + 10).
- **Clean bonuses**: the stated amount, minus the stated amount per mistake, never below 0 (`cleanPoints`). A clean
  bonus with no per-mistake figure is all or nothing.
- **Unfinished**: the game's credit, capped at 130, so a finish always beats it (`standardUnfinished`). "Plus up to N
  for how early" means each part's extra is full if done at 0 s, shrinking evenly to 0 at the buzzer (`earlyPoints`);
  "up to 120 by share … + up to 10 early" gives each of the game's N parts 10 ÷ N of early extra.
- A bonus feature that can be earned mid-puzzle also counts towards an unfinished score (still capped at 130).
- Mistakes keep costing what they cost today unless a game's row says otherwise: today's unfinished penalties (points
  off the progress credit) stay; where today's finish efficiency measures mistakes (wrong taps, tries, strikes), it
  scales the speed points; a par bonus replaces any efficiency that measured moves against a minimum.
- Random or blank play stays near 0.

The reveal shows a finish as "150 + N <bonus> + N speed" (`extra.parts`, kind finish, `efficiency` = the bonus) and an
unfinished round as "N for progress". `extra.standard` is 1 on every standard grade.

## Stamps and dealing (`src/lib/duel/standard/stamps.ts`)

`STANDARD_STAMPS` holds each game's stamp key, its live value and the standard's (one above). `generatePuzzle` deals the
standard stamp (`dealStandard`) when the game's own rules dealt its live stamp on `puzzleScoreRev` 3, so a check that
pins an earlier batch (`pinPreTopup`, `pinPrePhoneNotes`, `pinPreDepth`, `pinDealtPuzzleScoreRev`, …) keeps exactly what
it pinned. `pinPreStandard(true)` deals the live stamps (checks written for them). The standard grader
(`standard/grade.server.ts`, called first by `gradeAnswer`) applies only to puzzles carrying the standard stamp or later;
the depth graders (`depth200.server.ts`) and today's grades still score every older puzzle.

## When each part was done: the draft timeline (`src/lib/duel/standard/timeline.ts`)

Answers carried no times. On a standard stamp marked `timed`, the stage wrapper (`FeedbackStage`) records every draft the
stage reports with its round-clock time and appends the record to the answer (after `TIMELINE_MARK`, as edits, at most
600 entries; later changes fold into the last). `gradeAnswer` splits it off: the game is graded on the plain answer, the
stored answer is the plain answer, and the standard grader rebuilds each intermediate draft and asks the game how many
parts it holds (`StandardGame.parts`). A part's time is the moment after which the count never again fell below it, so
taking a part back and redoing it later earns the later time. Games whose answers already carry times (Ascend's and the
Chain's tap logs, Lightbender's action log, the engine games) use their own.

The timeline also shows the history behind final-state answers (wrong digits entered and erased, redrawn paths, tents
removed), so the clean bonuses can count them. A timeline that does not rebuild the answer it came with is ignored: no
early extras and no history-based clean bonus (the safe default; an honest phone always sends it). The times are the
phone's word, as every tap time is (held to the round and to the server's receipt time); a modified phone could claim
earlier parts or hide a mistake, worth at most the early extras and a clean bonus (docs/security-audit-oct-2026.md).

## The games

Clock = the game's real clock; "full by" is seconds used. Where the brief's clock differed from the real one, the
"full by" time is scaled in proportion (noted).

### Word

| Game | Stamp | Unfinished | Speed | Bonus |
| --- | --- | --- | --- | --- |
| Interlock (`tilegrid`) | `tileGridRev` 3 | 8 per tile inside a real word, + up to 1 each for how early | 20, full by 33 s | big words: each valid word of 5 letters +6, 6 +10, 7 +15, up to 30 (counts unfinished) |
| Slider (`wordslide`) | `wordSlideRev` 3 | 24 per word row the player made, + up to 2 each early | 35, full by 33 s | par moves 15 |
| Lookout (`wordsearch`) | `wordSearchRev` 4 | 20 per word, + up to 1.5 each early; −2 per wrong pick after the first 5 | 20, full by 40 s | hidden bonus word 30 (counts unfinished) |
| Roundabout (`letterwheel`) | `wheelRev` 4 | up to 120 by share of slots filled, + up to 10 early; −3 per wrong guess after the first 5 | 20, full by 40 s | bonus-word jar, up to 30 by how full (counts unfinished) |
| Strikeout (`strikeout`) | `strikeoutRev` 7 | 28 per word solved, + up to 2 per letter found in the current word, + up to 2 per word early | 20, full by 40 s | early solve 4 per word solved with 3+ letters still missing (up to 20, counts unfinished) + 1 per strike left at the finish (up to 10); the old early-solve formula is dropped |
| Cryptogrid (`codeword`) | `codewordRev` 5 | up to 120 by share of the code decoded, + up to 10 early | 40, full by 60 s | clean crack 10 if no wrong letter was ever entered, else 0 |
| Swapword (`swapword`) | `swapwordRev` 7 | up to 120 by share of tiles in place, + up to 10 early | 20, full by 60 s | par swaps 30 |

### Number

| Game | Stamp | Unfinished | Speed | Bonus |
| --- | --- | --- | --- | --- |
| Exact (`target`) | `depthRev` 3 | not exact: up to 130 by how close the best answer got, falling away fast | 35, full by 30 s | elegance 15 using the fewest numbers possible, −5 per extra number |
| Operator (`equation`) | `depthRev` 2 | 30 per equation, + up to 2.5 each early | 40, full by 60 s | 2.5 per equation solved without a wrong attempt (up to 10, counts unfinished) |
| Counterweight (`balance`) | `depthRev` 2 | 30 per scale, + up to 2.5 each early | 35, full by 60 s | par hangs 15 |
| Integer Pyramid (`numpyramid`) | `depthRev` 2 | up to 120 for pyramids done plus the share of the current one, + up to 10 early | 40, full by 75 s | 2.5 per pyramid with no wrong number ever entered (up to 10, counts unfinished) |
| Trail (`trail`) | `depthRev` 2 | up to 120 by share of tiles in their right square, + up to 10 early | 40, full by 60 s | clean path 10 if no placed tile is ever undone |
| Brimful (`measure`) | `depthRev` 3 | 30 per puzzle, + up to 2.5 each early | 35, full by 60 s | par pours 15 |
| Checkout (`checkout`) | `depthRev` 3 | 24 per board, + up to 2 each early | 30, full by 60 s | fewest darts 10 (full at the minimum, 0 at twice it) + big finishes up to 10, only on boards where a 100+ checkout is possible, split evenly across those boards |
| Ballpark (`numline`) | `depthRev` 2 | up to 8 per number placed by accuracy, + up to 10 early | 20, full by 60 s, × average accuracy | bullseyes 2 per number within 1 % of the line's length (up to 30, counts unfinished) |
| Tenfall (`tendrop`) | `tenRev` 5 | 12 per target, + up to 1 each early | 30, full by 60 s | gold tile cleared 20 |

Ballpark finished = up to 150 by average accuracy (accuracy per number: full within 2 % of the line's length from the
true spot, falling evenly to 0 at 15 %).

### Speed and Attention

| Game | Stamp | Unfinished | Speed | Bonus |
| --- | --- | --- | --- | --- |
| Ascend (`numhunt`) | `tapRev` 6 | up to 120 by share of numbers reached, + up to 10 early | 40, full by 40 s | flow streak up to 10 |
| Don't Break the Chain (`chain`) | `chainDepthRev` 3 | up to 120 by share of the chain, + up to 10 early | 50, full by 30 s | none (milestone points removed) |
| Mixed Signals (`stroop`) | `clashRev` 10 | up to 130 by words sorted right, less wrong sorts | 15, full by 50 s | no-mistake sort streaks up to 20, gold words up to 15 |
| Eagle Eye (`symscan`) | `scanRev` 4 | 40 per grid, + up to 3 each early, less wrong taps | 10, full by 20 s | clean grids 40 (about 13.3 per grid with no wrong taps) |
| Double Take (`spotdiff`) | `spotRev` 3 | 10 per difference, + up to 0.8 each early, less wrong taps | 20, full by 40 s | hidden extra difference 20 (counts unfinished) + clean taps 10 |
| Tally (`countup`) | `countRev` 5 | 30 per tray, + up to 2.5 each early | 50, full by 30 s | none |
| Labyrinth (`maze`) | `mazeRev` 3 | up to 120 by share of the route, + up to 10 early | 20, full by 40 s | stars 30, shared across all stars (counts unfinished) |
| Matchmaker (`pairmatch`) | `pairRev` 3 | 8 per pair, + up to 0.6 each early | 30, full by 60 s | match streak 5, gold pair found in the first 30 s 15 (both count unfinished) |

### Pattern and Logic

| Game | Stamp | Unfinished | Speed | Bonus |
| --- | --- | --- | --- | --- |
| Gridlock (`unblock`) | `unblockRev` 2 | up to 120 by share of the cars blocking the gold car's way cleared, + up to 10 early | 30, full by 40 s | par moves 20 |
| Tessellate (`blockparty`) | `blockRev` 3 | 13 per piece on its solution cells, + up to 1.4 each early | 40, full by 40 s | right first time 10, shared across the pieces (counts unfinished) |
| Skid (`iceslide`) | `slideRev` 2 | up to 120 by share of the route, + up to 10 early | 30, full by 60 s | ice gems 20, shared (counts unfinished) |
| Topsy-Turvy (`gravity`) | `gravityRev` 5 | up to 120 by share of balls home, + up to 10 early | 30, full by 80 s (brief 60 s of 90; the clock is 120 s) | stars up to 15 (counts unfinished), par tilts 5 |
| Gradient (`tiles`) | `tilesRev` 5 | up to 120 by share of tiles in place, + up to 10 early | 35, full by 80 s (brief 40 s of 60; the clock is 120 s) | par slides 15 |
| Turntable (`rings`) | `ringsRev` 3 | up to 120 by share of spokes solved, + up to 10 early | 35, full by 40 s | par turns 15 |
| Lightbender (`laser`) | `laserRev` 3 | 20 per gem lit, + up to 1.5 each early | 40, full by 15 s | fewer mirrors 5 (full at the minimum, 0 at twice it) + first-shot solve 5 |
| Chroma Lines (`flow`) | `flowRev` 2 | up to 120 by share of pairs on their solution route, + up to 10 early | 40, full by 20 s | no path redrawn 10, −2.5 per redraw |
| Pipeline (`pipes`) | `pipesRev` 3 | up to 120 by share of tiles connected, + up to 10 early | 40, full by 60 s | par turns 10 |
| Heave (`push`) | `pushRev` 3 | 24 per crate on a marking, + up to 2 each early | 25, full by 45 s | gold crate placed 10 (counts unfinished), par pushes 15 |
| Blackout (`lightsout`) | `depthRev` 2 | up to 120 by share of lights off, + up to 10 early | 30, full by 20 s | par presses 20 |
| Box Six (`sudoku`) | `depthRev` 3 | up to 120 by share of cells right, + up to 10 early | 40, full by 45 s | clean grid 10, −2.5 per wrong digit |
| Hanoi (`tower`) | `depthRev` 2 | up to 120 by share of rings home on the gold post, + up to 10 early | 40, full by 45 s | par moves 10 (full at the minimum) |
| Polypotions (`tubes`) | `depthRev` 2 | up to 120 by share of flasks corked, + up to 10 early | 35, full by 45 s | par pours 15 |
| Safe Cracker (`safe`) | `depthRev` 3 | up to 120 by share of dials right, + up to 10 early | 40, full by 30 s | clean crack 10, −2.5 per wrong attempt |
| Bomb Defusal (`bomb`) | `depthRev` 2 | up to 120 by share of correct steps, + up to 10 early | 50, full by 30 s | none |
| Mosaic (`nonogram`) | `depthRev` 2 | up to 120 by share of cells right, + up to 10 early | 40, full by 60 s | clean picture 10, −2.5 per wrong cell |
| Colour Flood (`flood`) | `depthRev` 3 | up to 120 by share of the board flooded, + up to 10 early | 10, full by 30 s | par moves 40, 4 less per move over, 0 at par + 10; the move limit is par + 10 |
| Tents and Trees (`tents`) | `depthRev` 2 | up to 120 by share of tents right, + up to 10 early | 40, full by 45 s | clean camp 10, −2.5 per wrong tent |
| Shikaku (`shikaku`) | `depthRev` 3 | up to 120 by share of the grid covered by correct rectangles, + up to 10 early | 40, full by 45 s | clean cuts 10, −2.5 per wrong rectangle drawn and removed |
| Lamplighter (`lightup`) | `depthRev` 2 | up to 120 by share of bulbs on their solution squares, + up to 10 early | 40, full by 45 s | clean 10, −2.5 per wrong bulb |

Each category's section below records its own decisions (how a row was read where the brief left room).

## Number decisions

Module `src/lib/duel/standard/number.server.ts` (grader), shared rules `standard/number.ts`, texts
`standard/numberText.ts`; Tenfall scores in its sim (`src/lib/arcade/tenDrop.ts`, `tenRev` 5). Check:
`scripts/standard-number-check.ts` (~11 s).

**Stamps.** The eight puzzles share the `depthRev` key, each one above its own live value: Exact 2 → 3, Operator 1 → 2,
Counterweight 1 → 2, Integer Pyramid 1 → 2, Trail 1 → 2, Brimful 2 → 3, Checkout 2 → 3, Ballpark 1 → 2; Tenfall `tenRev`
4 → 5. Every other read of `depthRev` for these games is `usesNumberDepth` (≥ 1: the depth boards, Brimful's public
par, Checkout's big-finish boards, Exact's five-number targets) or the depth grader's `≥ 2` (scoring only, never reached
on the new stamp), so the new values deal and play exactly as the live ones. Tenfall's `tenRev ≥ 4` reads (gold tiles,
the moment cue, the reveal's gold tens, the intro demo's gate) cover 5; the intro demo keeps its recorded tenRev 4 run.
Exact and Tenfall carry no draft timeline (Exact is one part; Tenfall's run log has its own ticks).

**Clocks.** Every row's clock is the game's real one (Exact 75 s, Operator 90 s, Counterweight, Integer Pyramid, Trail and
Brimful 120 s, Checkout and Ballpark 90 s, Tenfall a 90 s run), so no "full by" time was scaled.

**Speed and mistakes.** No Number game's finish speed is cut by mistakes today (Operator's, Counterweight's, the Pyramid's
and Trail's rev-1 finishes have no efficiency part; Brimful's moves and Checkout's darts are par-type and are replaced by
their par / fewest-darts bonuses), so speed is never scaled, except Ballpark's (× average accuracy, the row).

- **Exact.** Finished = 150 + speed + elegance: 15 using the fewest numbers the target needs, 5 less per number more.
  The fewest is computed (`exactMinTiles`: any answer from 1–4 numbers, else 5, else 6); on depth deals it is always 5.
  Not exact: 129 × 0.93^d for the closest any made number (any step's result, over every prefix of the stored steps; a
  starting number is not "made") came to the target (d at least 1): off by 1 = 120, 5 away 90, 10 away 62, 20 away 30,
  40 away 7; random steps sit 20–900 away (spam median 0).
- **Operator.** Unfinished = 30 per equation right + up to 2.5 each early + the clean points; clean = 2.5 per equation
  right whose only try was its first full set of signs (the phone's try count is 1), counting unfinished.
- **Counterweight.** Par hangs: every tray weight hung once (the scale's tray length, the fewest possible), summed over the
  four scales against the hangs used (each scale counted at least its tray length): 15 at par, 0 at twice. Unfinished =
  30 per balanced scale (any order, as rev 1: a scale out of hangs is skipped) + up to 2.5 each early. Not a mid-puzzle
  bonus (it is measured over the whole round), so it pays on a finish only.
- **Integer Pyramid.** Unfinished = 120 × (pyramids done + the share of cells right on the first unfinished one, at most
  0.99) ÷ 4 + up to 2.5 per pyramid early + clean. Clean = 2.5 per completed pyramid in which no draft ever held a
  wrong number (a tray tile whose value is not the cell's solution), counted unfinished too; no timeline → 0.
- **Trail.** Unfinished = 120 × today's progress (the larger of the right run from the start and right squares less wrong
  ones: today's cost for wrong squares kept) + 10 ÷ 26 per square right, early. Clean path: 10 when no draft ever lost a
  placed square (every square a draft had at step i is still at step i in the next draft); no timeline → 0. Drafts are
  raw paths and the finish is the slot form (`trSlots`); both read the same way.
- **Brimful.** Par pours over the four puzzles together: total actions against the total of the public par (each
  puzzle's fewest moves); 15 at par, 0 at twice. Unfinished = 30 per puzzle solved + up to 2.5 each early (in-board
  progress no longer counts).
- **Checkout** (five boards). Fewest darts: 10 at the boards' total fewest darts, 0 at twice (all darts thrown on
  solved boards). Big finishes: a board pays when its checkout is 100 or more (target ≥ 100) and some legal visit can end
  it on a big finish (the Bull, or a treble on a double-finish board; searched over the board's own dart rule,
  `checkoutBigBoards`). Those boards share 10 evenly; on room seeds that is 2–4 boards (board 3 always, board 4 almost
  always, board 5 about four in five, board 2 about one in four, board 1 almost never). A big finish is earned board by
  board, so it counts towards an unfinished score too (the standard's mid-puzzle rule). The stage's rule line and the
  reveal show the ★ only on the boards that pay.
- **Ballpark.** Accuracy per number: 1 within 2 % of the line's length, evenly to 0 at 15 %. Finished (all 15 placed) =
  150 × average accuracy + 20 × speed share × average accuracy + 2 per bullseye (within 1 %, at most 30). Unfinished =
  8 × accuracy per number placed + early: each number's 10 ÷ 15 scaled by its own accuracy (so quick random taps earn
  none) + bullseyes. Today's cost of a wild number (25 % or more off: −1) is kept, finished or not; with it random or
  all-middle placement scores a median 3 on the kits (all-middle alone about 16). A finish never scores below the same
  answer's unfinished credit: 150 A + speed + B − wild against 120 A + early (≤ 10 A) + B − wild. A finish's base is
  below 150 here, so `StandardFinish` gained an optional `base` (foundation change, additive: absent = 150). Ballpark is
  the one game where a finish need not beat every unfinished score: a finish of all-wild placements scores near 0.
  The stage shows "◎ Bullseyes" instead of the streak; the reveal colours numbers within 2 % as full and counts bullseyes.
  *Worked example (Joe's board, room seed 5000):* 12 numbers 1.5 % off and 3 numbers 5 % off, placed by 70 s: before
  (depthRev 1) **100**; now accuracy (12 + 3 × 0.769) ÷ 15 = 0.954 → 143, speed 20 × 20⁄30 × 0.954 = 13, no bullseyes →
  **156**.
- **Tenfall** (`tenRev` 5, whole numbers in the sim). Unfinished = ⌊(12 × targets × 5400 + Σ ticks left at each clear)
  ÷ 5400⌋ (12 per target + up to 1 each early) + 2 per gold ten − 5 per reset after the first 4 (tenRev 3's cost, kept), at
  most 130. All ten = 150 + ⌊30 × min(ticks left, 1800) ÷ 1800⌋ (full by 60 s) + 2 per gold ten (at most 20). Gold: 2 for
  each of the ten targets cleared with its gold tile, finished or not. The sim keeps the early sum (`earlyTicks`) on
  tenRev 5 states only; checkpoints and older revisions are unchanged. A tenRev 5 run joins `replay-runs.json`
  (`bun scripts/replay-fixtures.ts --add=tendrop`; the older runs stay).

**Texts.** `standardNumberHelp` / `standardNumberIntro` replace the depth texts in `instructions.ts` and `introScore.ts`
(the depth texts stay in `numberDepthText.ts` for the older stamps). How-to lines: Brimful's par pours are over the
puzzles together, Checkout's big finish names boards of 100+, Ballpark's bullseyes replace the streak.

**Checks pinned** (the world they were written for): `number-depth-check`, `puzzle-score-rev-check`,
`scoring-rev3-check` and `tendrop-depth-check` deal with `pinPreStandard(true)`; `number-depth-check` reads the depth
texts from `numberDepthText.ts`; `scoring-rev3-check` compares a standard game's older text with the live help only
when the game is not on the standard; `scoring-bands-check` and `number-batch-check` expect the standard's live texts.
