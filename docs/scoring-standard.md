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

## Word decisions

Interlock, Slider, Lookout, Roundabout, Strikeout, Cryptogrid and Swapword (`src/lib/duel/standard/word.server.ts`;
the numbers and the help / intro texts in `standard/word.ts`, shared). All seven are `timed` (the draft timeline gives
each part's time). The real clocks match the table (100 / 100 / 120 / 100 / 100 / 120 / 120 s), so no "full by" time was
scaled. Finished is each game's existing verdict (Interlock: all 15 tiles in a valid grid, as `puzzleScoreRev` 3).

- **Interlock** (`tileGridRev` 2 → 3). Unfinished: 8 per tile inside a real word (the grader's own `wordTiles`, a run of
  3+ letters the dictionary knows, crossings once; not rev 3's "word still being extended" prefix rule) + up to 1 each
  early (parts = those tiles). Big words: each valid run of 5 / 6 / 7 letters in the grid adds 6 / 10 / 15, at most 30,
  read as every distinct run (a crossing word counts on its own); they count unfinished too (only for a grid drawn from
  the tray). No mistake efficiency (today's finish has none).
- **Slider** (`wordSlideRev` 2 → 3). Unfinished: 24 per row the player turned into a word (a row that started as a word
  and was never changed never counts) + up to 2 each early (parts = those rows, replayed per draft). Par moves 15 on the
  replay's move count (Undo and Reset count, locks are free) against the stored public `par`; the par bonus replaces
  today's move efficiency. The stage's gold "Par N" beside the moves still reads right (full points within par).
- **Lookout** (`wordSearchRev` 3 → 4). Unfinished: 20 per listed word + up to 1.5 each early, less 2 per wrong drag after
  the first 5 (today's penalty; never below 0), + 30 for the bonus word. The bonus counts on a finish only when found
  before the sixth listed word (the stage submits on the sixth; the help says so). Wrong drags do not cut the finish's
  speed (today's finish has no efficiency). Unfinished at most 100 + 7.5 + 30, capped at 130.
- **Roundabout** (`wheelRev` 3 → 4). Unfinished: 120 × slots filled ÷ slots (linear; today's front-loaded 12-then-5 per
  word is dropped) + up to 10 early (10 ÷ slots per slot), less 3 per miss after the first 5, + the jar. Jar: 30 × kept
  drops ÷ the stored jar size (linear "by how full"; drops as today, each miss after 5 spilling one). On a finish the
  speed points are scaled by today's accuracy efficiency ((15 − miss cost) ÷ 15, misses being today's finish mistake).
- **Strikeout** (`strikeoutRev` 6 → 7; rev 4's board and rules). Unfinished: 28 per word solved + 2 per tile the
  player revealed in the current word (starting letters earn nothing; "up to 2 per letter" read as today's 2 per tile)
  + up to 2 per solved word early + early solves so far. Early solves: 4 per word solved with Solve while 3+ of its
  tiles were still hidden (`so2EarlySolves`' `hiddenAtSolve`), at most 20. Strikes left: 1 per strike left of the 12 at
  the finish, at most 10. Speed is not also scaled by strikes: the strike bonus is the strikes' cost (as a par bonus
  replaces move efficiency). The old pace / early-share formula is gone on the new stamp, and the stage's early pill
  shows the early-solve points (4 per qualifying word) instead of the hidden-letter count.
- **Cryptogrid** (`codewordRev` 4 → 5). Unfinished: 120 × numbers right ÷ hidden numbers + up to 10 early (parts =
  numbers right), less 5 per wrong letter left standing (today's penalty, which also keeps random fill at 0). Clean crack
  10: no wrong letter ever entered, judged from every assignment in every draft of the timeline (an assignment the
  replay ignores, on a given number or with a given letter, is not a mistake). Without a timeline the history is
  unknown and the clean crack is 0. The phone compacts its action list past 850 actions; the timeline still holds the
  earlier drafts, but a history longer than the timeline's 600 entries folds its later drafts into one, so a mistake
  made and undone inside that fold can go unseen (only after 600 changes).
- **Swapword** (`swapwordRev` 6 → 7; rev 6's boards and budget, par + 12). Unfinished: 120 × net tiles ÷ tiles to
  place + up to 10 early (parts = net tiles). Net tiles = tiles put in place, less tiles that started in place and were
  moved out (today's measure), **less blind swaps**: swaps that left neither of their two tiles in place. Every swap of
  a solving line places at least one tile, so play toward the solution loses nothing; random swaps are nearly all blind.
  Without it random swapping scored a median 20 (today's 21); with it 0. The round leaderboard's progress figure
  (`progressFigures.ts`) shows the same net count and names the blind swaps as a cost. Par swaps 30 against the stored
  `minSwaps`. Stale help fixed: the budget is 12 more than par (it said 8).

Texts: each game's "?" help and intro SCORE line come from `standard/word.ts`. With the standard pinned off
(`pinPreStandard(true)`) they read the texts of the stamps before it (the depth checks assert those); `liveRecord`
(roundMax.ts) rebuilds the cached text records when the pin changes.

Checks pinned to the stamps before the standard (`pinPreStandard(true)`): depth-codeword-check, depth-letterwheel-check,
depth-strikeout-check, depth-swapword-check, depth-tilegrid-check, depth-wordsearch-check, depth-wordslide-check and
phone-notes-check (its Swapword deal). `standard-word-check` (~3 s) proves the stamps, worked examples, the rules above,
the texts and the kit order.
