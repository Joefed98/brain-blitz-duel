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

## Speed and Attention decisions

Graders: `src/lib/duel/standard/attention.server.ts`; the shared numbers and small rules (also read by the phone and the
help texts): `standard/attention.ts`; texts: `standard/attentionTexts.ts`; Mixed Signals in its sim
(`src/lib/arcade/colourClash.ts`, clashRev 10). Check: `scripts/standard-attention-check.ts`. Every clock in the table is
the game's real clock (Ascend 60 s, the Chain 45 s, Mixed Signals' run 75 s, Eagle Eye 30 s, Double Take, Tally and
Labyrinth 60 s, Matchmaker 90 s), so no "full by" time was scaled.

Foundation change (additive): `StandardInput.latestMs` (the last round-clock ms a logged tap or claimed time may carry,
`latestTapMs`, already worked out in `gradeStandard`), so Ascend's tap log and Matchmaker's gold time are held to a room
answer's receipt exactly as today's graders hold them.

- **Ascend** (`tapRev` 5 → 6; Flash and Bang On stay on their own tapRev 6, outside the standard). Not timed: each
  number's early extra (10 ÷ 24) uses its own tap time from the log. Unfinished = 120 × reached ÷ 24 + early − 5 per wrong
  tap (today's cost) + flow. Finish = 150 + speed 40 (full by 40 s) × (1 − 5 × wrong ÷ 30) (today's 5 off the 30 speed
  points per wrong tap, as a share) + flow. **Flow streak** (the row left it open): the longest run of right taps with no
  wrong tap between (taps that change nothing don't break it; no pause limit), 10 × best run ÷ 24; it is earned
  mid-round, so it counts unfinished too. The phone's flow multiplier chip becomes "n in a row" on tapRev 6 and the
  reveal shows "Flow: best run n of 24 · +k"; tapRev 5's chip and line are unchanged.
- **Don't Break the Chain** (`chainDepthRev` 2 → 3). Not timed (each link's own tap time). Unfinished = 120 × links ÷ 40 +
  early (10 ÷ 40 per link). Finish = 150 + speed 50 (full by 30 s). No mistake cost exists today (a wrong tap ends the
  chain), so none is added. The milestones are gone on the new stamp: no points, and the phone's milestone pips, the
  milestone banner and the reveal's milestone line show only on chainDepthRev 1–2; the "Milestones" how-line is removed
  from the help.
- **Mixed Signals** (`clashRev` 9 → 10, engine game, no StandardGame entry). The play is clashRev 9's exactly (the same
  plan, words, specials and checkpoints; `depth.scoreRev` is 10 and never in the checkpoint); only `score()` differs,
  integer arithmetic only (`clashStandardScoreOf`). Finish = clashRev 8's (all 52 sorted or let fall, at most 3 wrong) =
  150 + speed 15 (full when the last word lands by 50 s of the run, measured as clashRev 8 does with words let fall timed
  as quick sorts, falling evenly to 0 at 75 s) less a sixth per wrong word (today's 5 off 30) + **streak** 20 × (longest
  streak − 12) ÷ 40 (from clashRev 8's streak measure, linear instead of squared) + **gold** 3 per gold word sorted right
  (five golds, 15). Unfinished = 130 × max(0, right − wrong) ÷ 52 + streak + gold, at most 130, and 0 while right does
  not outnumber wrong (an idle run lets "don't sort" words fall and may drop a gold word in the right lane by chance;
  that must not score). The row's "up to 130" is
  read literally; the cap keeps it below every finish). The reveal's lines and the help describe clashRev 10.
- **Eagle Eye** (`scanRev` 3 → 4). **Rule change at grading (no deal change): the finish** is every eagle found in all
  three grids with at most 3 wrong eagles left marked in each grid (today: all three grids perfect). Wrong eagles left on
  a finish cost the clean bonus, not the finish; the per-grid limit keeps "mark everything" from finishing (it scores 0).
  Unfinished = 40 × found ÷ eagles per grid (grid 3 now weighs 40 like the others) + up to 3 for each grid completed
  early (a grid's part counts when every eagle in it is marked) − 3 per wrong eagle left marked (today's cost). Finish =
  150 + speed 10 (full by 20 s) + **clean grids** 40 ÷ 3 per grid in which no wrong eagle was ever marked, read from the
  draft timeline (a wrong eagle marked and taken back makes the grid unclean; no timeline, no clean grid). The answer's
  "taps taken back" count (scanRev 2–3) is no longer used or shown on scanRev 4. The mistake cost does not scale the speed
  points (today's finish allowed no mistakes, so it never did).
- **Double Take** (`spotRev` 2 → 3). Finish = today's (all 12, at most 5 wrong taps in each picture). Unfinished = 10 per
  difference + 0.8 each early − 4 per wrong tap (today's cost) + the hidden difference 20 (counts unfinished). Finish =
  150 + speed 20 (full by 40 s) + hidden 20 + clean taps 10 (no wrong tap at all, all or nothing; the answer keeps every
  tap, so the final answer is the history). Wrong taps don't scale the speed points (today's finish had no mistake cut).
- **Tally** (`countRev` 4 → 5; still dealt by moveLimits.server.ts, the stamp the deal ends on). Unfinished = 30 per tray
  exact + 30 × 0.15 per tray one off (today's 15 % near-miss credit, kept as partial credit) + 2.5 each early for exact
  trays. Finish (all four exact) = 150 + speed 50 (full by 30 s). No bonus.
- **Labyrinth** (`mazeRev` 2 → 3; `usesMazeDepth` now reads mazeRev 1 and later, so mazeRev 3 keeps the 19 × 23 board,
  stars and trail answer). Unfinished = 120 × today's progress share (the route's furthest step beyond the start, times
  today's waste factor, less today's 5 % dead zone) + up to 10 early (10 ÷ the route's steps per step reached, by when
  the furthest step was reached), the early extras scaled by the same waste factor + stars. Finish = 150 + speed 20
  (full by 40 s) + stars. **Stars**: 30 shared over the maze's stars (10 each), finished or not (the old stars counted only
  with a fast finish). The reveal and round summary show the stars' stored points for unfinished rounds too; the intro
  example and help say stars count finished or not.
- **Matchmaker** (`pairRev` 2 → 3). Unfinished = 8 per pair + 0.6 each early (by when each pair was matched, from the
  timeline) − today's miss cost as points (misses beyond 14 cost a third of a pair, 8 ÷ 3, each; never below 0 before
  the extras) + streak + gold. Finish = 150 + speed 30 (full by 60 s; no mistake cut, as today) + streak + gold. **Match
  streak** (the row left it open): 1 for each match in the longest run of matches beyond the first 3, up to 5 (an 8-match
  run earns all 5; a short run cashing the last known pairs earns little). **Gold**: 15 for the gold pair matched in the
  round's first 30 s (pairRev 2's rule; the gold time is the phone's, held to the answer's receipt). The phone's streak
  shows the run's length ("streak n") and the gold line its 15 on pairRev 3.

Kit play (puzzle-fairness kits) needed two fixes for these boards, both script-only: Labyrinth's kit sends the trail
answer (mazeRev 1+) instead of the old path answer (which graded 0 on the 19 × 23 boards) and detours to stars with the
chance depth-labyrinth-check uses (25 / 50 / 80 / 100 %); Matchmaker's kit adds the gold match's time (`@ms`) on pairRev
2+. Older boards play exactly as before (the same random draws).

Checks pinned to the world they were written for (`pinPreStandard(true)`): depth-ascend-check, depth-doubletake-check,
depth-topup-check. Text assertions that compared the live intro/help with a depth text now compare them with the live
deal's (the standard's) text and still check the depth texts for themselves: depth-attention-lib's `checkTexts` (Eagle
Eye, Double Take, Tally), depth-chain-check, depth-matchmaker-check.

Kit bands (`bun scripts/standard-bands.ts`, medians on 8 room seeds 6100 + 7k; nothing / spam / average / good / great /
near-perfect): Ascend 0 / 0 / 79 / 165 / 183 / 200; Chain 0 / 0 / 10 / 64 / 61 / 200; Mixed Signals 0 / 0 / 57 / 113 /
130 / 196; Eagle Eye 0 / 0 / 68 / 107 / 183 / 187; Double Take 0 / 0 / 79 / 164 / 180 / 200; Tally 0 / 5 / 66 / 100 / 100 /
200; Labyrinth 0 / 10 / 57 / 104 / 173 / 189; Matchmaker 0 / 0 / 72 / 185 / 197 / 198. The Chain (a slip ends the chain)
and Tally (one miscount costs the finish) are lumpy on 8 seeds; on 24 seeds they rise strictly (Chain 13 / 60 / 111 /
200, Tally 63 / 98 / 181 / 200), which is what standard-attention-check measures for them. standard-attention-check asserts nothing ≤ spam ≤ 10 < average < good < great < near (or near at 200) and every finish
above every unfinished score for all eight games. Labyrinth's spam median is about 10: a blind depth-first scribble
explores enough of the maze to earn route credit (as today) and a scribble that rolls over a star keeps its 10.

## Pattern and Logic (first half) decisions

Gridlock, Tessellate, Skid, Topsy-Turvy, Gradient, Turntable, Lightbender, Chroma Lines, Pipeline and Heave
(`src/lib/duel/standard/pattern.server.ts`; the numbers in `patternRules.ts`, which the help and intro texts in
`patternText.ts` quote; proved by `scripts/standard-pattern-check.ts`, about 25 s).

**Stamps.** `unblockRev` 1 → 2, `blockRev` 2 → 3, `slideRev` 1 → 2, `gravityRev` 4 → 5, `tilesRev` 4 → 5, `ringsRev`
2 → 3, `laserRev` 2 → 3, `flowRev` 1 → 2, `pipesRev` 2 → 3, `pushRev` 2 → 3. Every one deals the live stamp's boards and
rules unchanged (no rule change in this half). All but Lightbender carry the draft timeline; Lightbender times its gems
from its own action log (the shots' times), so its stamp is not `timed`. Reads of these keys: every one in `src/` is
`>=` (rules, boards, par meters, the D4 top-up tables), except the two board verifiers, `verifyTopsyPuzzle` and
`verifyGradientPuzzle`, which matched the live stamp exactly and now also accept the standard's (gravityRev 5,
tilesRev 5).

**Clocks.** The real clocks are kept: Gridlock 60 s, Tessellate 60 s, Skid 90 s, Topsy-Turvy 120 s, Gradient 120 s,
Turntable 60 s, Lightbender 60 s, Chroma Lines 75 s, Pipeline 120 s, Heave 120 s. Topsy-Turvy's and Gradient's "full by"
times are scaled (the brief's 60 s of 90 and 40 s of 60 → 80 s of 120 each, as the table says).

**Speed.** No game in this half scales speed by a mistake efficiency: their efficiencies today measure moves against
a minimum (replaced by the par bonuses) or nothing. Lightbender's tries (shots) cut speed today; the row's first-shot
bonus is now that measure, so its speed is not scaled as well.

**Unfinished, game by game.**

- *Gridlock*: "the cars blocking the gold car's way" is read as the chain of blocks in its way: the blocks in its row
  ahead of its nose, and, for every block that must move, the blocks standing where it has to go to leave the cells it
  must free (its way out with the fewest blocks: up or down, left or right), counted once each (`gridlockChain`).
  Counting only the blocks in the row left most players with 0 until the last few moves (the blocks in the row clear
  last): the average kit player's median was 0. Cleared = the chain at the start less the shortest chain on any board
  the player stood on (the closest they got, as Skid's route and today's solver progress count it; Undo and Reset
  never take it back). Parts for the early extras: blocks cleared, 10 ÷ chain each.
- *Tessellate*: 13 a piece on its solution cells, less one piece for each piece placed off them (today's rule, so random
  drops earn about 0: `max(0, 2 × on spot − placed)`), + 1.4 a piece early. Right first time (10 shared over the nine
  pieces): a piece whose first placement in the timeline is where it stands at the end (on a finish, any solution: it
  was never moved); unfinished, where it stands now on its solution cells. Without a timeline it is 0.
- *Skid*: the route closed = the start's fewest slides to the exit less the fewest from the closest state the ball
  reached (today's measure), 120 × closed ÷ fewest, + 10 ÷ fewest a slide closed early. The gems (20 shared over the
  gems, 3 on today's boards) count unfinished as the standing slides have collected them (Undo takes them back).
- *Topsy-Turvy*: 120 × balls home ÷ 18, + 10 ÷ 18 a ball early; stars count unfinished only on boards cleared (today's
  rule: random tilting collects stars). Par tilts: par = the boards' fewest tilts (`boardMins`, server-only) added up,
  0 at twice; the all-stars routes take a few more tilts than that, so every star and par together reach 199, not 200,
  on most boards (the 5 par points are the brief's).
- *Gradient*: 120 × tiles put in place ÷ the tiles out of place at the start (15; tiles lock once home), + 10 ÷ 15 a
  tile early. Par swaps at the stored par (the fewest + 3), 0 at twice it.
- *Turntable*: "spokes solved" counted segment by segment: of the 40 ring segments, those showing the colour their
  spoke has in the finished turntable (the stored solution's offsets, all rings turned together whichever way matches
  best), net of those already so at the start (`ringsSegmentsInPlace`). Linked rings line whole spokes up only at the
  very end, so whole aligned spokes left every unfinished player at 0.
- *Lightbender*: 20 for each gem the best shot without a bomb lit; when fewer than three shots were fired, the board
  standing at the buzzer counts as a shot too (as today's timeout draft did; without it a player who never fired scored
  0 however close). Gem k's early extra (1.5) uses the time of the first bomb-free shot that lit k gems (the buzzer's
  board: the buzzer, so nothing). Fewer mirrors: full at the solution's mirror count (`par`), 0 at twice it.
- *Chroma Lines*: 120 × pairs joined along their solution route, less one for each pair joined off it (today's rule),
  ÷ pairs, + 10 ÷ pairs a pair early. A redraw (−2.5 from the clean 10) is a pair's joined path later changed or cleared
  (each time); a path cut short and finished again is one redraw. Timelines keep at most 600 drafts (later changes fold
  into the last), so a very long session can miss redraws past that; without a timeline the clean bonus is 0.
- *Pipeline*: 120 × pipes joined to the source beyond those joined at the start ÷ the rest, + 10 ÷ that a pipe early.
  The board is the tap log's (as today); par taps are counted up to the solve.
- *Heave*: 24 a crate on a mark beyond those on marks at the start, + 2 a crate early, + 10 while the gold crate stands
  on the gold mark (unfinished too). Par pushes at the fewest (`minPushes`, server-only), 0 at twice.

**Waste on the move games.** Today every move game's unfinished credit falls with wasted moves (rev 1's waste factor,
or the solver distance less the moves over the minimum). The rows change the progress measures, so the standard keeps
rev 1's waste factor on them (full up to the fewest moves, falling evenly to nothing at four times): Gridlock and
Turntable (moves against the fewest), Skid (slides), Heave (pushes) and Topsy-Turvy (tilts against the fewest for the
boards reached). It applies to the progress credit and its early extras, not to gems, stars or the gold crate. Without
it random play scored 30–70 on Skid, Turntable, Gridlock and Topsy-Turvy (Topsy-Turvy's doubled tilt limits let random
tilting home most balls).

**Known exception: Gradient and random swapping.** tilesRev 4's rules (Joe's phone notes) lock a tile once it is home, so
random swapping always finishes the board, in 15–50 s at two swaps a second: it scores about 158 today and 185 under the
standard (150 + full speed, no par bonus). No scoring rule can hold a finish under 150; only a rule change (a swap limit,
for instance twice par) would stop it, and the row has none, so it is left for Joe. `standard-pattern-check` reports it
and proves random swapping gets no par bonus.

**Kit bands** (`scripts/standard-pattern-check.ts`, 8 room seeds, medians; Topsy-Turvy and Gradient with their own
bots, since the kits model their older boards; Pipeline's kit answers turned into the tap log its stamp grades):

| Game | nothing | spam | average | good | great | near |
| --- | --- | --- | --- | --- | --- | --- |
| Gridlock | 0 | 0 | 25 | 189 | 200 | 200 |
| Tessellate | 0 | 0 | 60 | 167 | 200 | 200 |
| Skid | 0 | 7 | 65 | 154 | 180 | 180 |
| Topsy-Turvy | 0 | 0 | 60 | 83 | 194 | 198 |
| Gradient | 0 | 185 | 42 | 176 | 200 | 200 |
| Turntable | 0 | 0 | 31 | 198 | 200 | 200 |
| Lightbender | 0 | 0 | 20 | 164 | 179 | 191 |
| Chroma Lines | 0 | 0 | 79 | 168 | 182 | 191 |
| Pipeline | 0 | 8 | 84 | 164 | 184 | 198 |
| Heave | 0 | 0 | 50 | 182 | 188 | 197 |

Great and near-perfect tie only at the top the players reach (200; Skid 180, the kit never detours for gems).
`scripts/standard-bands.ts` still deals Topsy-Turvy and Gradient through the kits' older boards and grades Pipeline's
kit without a tap log (0 at every level), so it is not the report for those three.

**Texts.** The "?" help and the intro line of all ten come from `patternText.ts` (`instructions.ts`, `introScore.ts`);
the old depth-batch and D5 texts (`depth4/text.ts`, `topsyHelpScore`, `jumbledHelpScore`) stated 120–150 finishes and
110 caps and are no longer shown. Topsy-Turvy's reveal names its bonus from the stored breakdown ("stars + par"; older
rounds store "stars").

**Checks pinned or updated.** Pinned to the stamps before the standard (`pinPreStandard(true)`, as they were written
for them): `depth4-check` and `depth-topup-check` (they deal and score the depth batch's and the top-up's stamps),
`phone-notes-check` (it proves rooms deal gravityRev 4 and tilesRev 4) and `scoring-rev3-check` (it proves rev 3's
progress, which never falls along a clean solve; the standard's Heave credit can, when a solution pushes a crate off a
mark on its way). `scoring-bands-check` and `scoring-rev3-check` asserted that these games' help and intro are the depth
batch's texts; they now assert the standard's (`patternStdHelp`, `patternStdIntro`). `stage-state-reload-check` reads
Pipeline's tap log from the plain answer (`stripTimeline`): on the standard's stamp the draft carries its timeline.

**Left as is.** A real page reload loses the phone's draft timeline (FeedbackStage keeps it in memory): the drafts after
the reload start a new one, so parts done before it count as done at the reload and the history bonuses (Tessellate's
right first time, Chroma Lines' redraws) see the restored board as the first. It is the foundation's timeline and is
noted here, not changed.

## Pattern and Logic (second half) decisions

Blackout, Box Six, Hanoi, Polypotions, Safe Cracker, Bomb Defusal, Mosaic, Colour Flood, Tents and Trees, Shikaku and
Lamplighter (`src/lib/duel/standard/logic.server.ts`; numbers in `logicRules.ts`, texts in `logicText.ts`). Every game
moves `depthRev` up by one (live 1 → 2 or 2 → 3, as the table says) and is `timed` (the phone sends the draft
timeline). The real clocks match the table's (75, 90, 90, 90, 75, 90, 120, 60, 90, 90, 90 s), so no "full by" time
was scaled. `depthRev` is read elsewhere only as "≥ 1" (the par lines, the clean-crack line, the intro-demo stops) or
"≥ 2" (Safe Cracker's and Colour Flood's top-up progress, used only by today's grades) and through `depthGame(type,
rev)`, whose rev-3 lookups fall on the top-up's table, so the new values behave like the live ones everywhere but the
score; the depth graders (`logicDepth.server.ts`) never see a standard puzzle.

**The parts.** "Up to 120 by share … + up to 10 early" gives each of the game's N parts 10 ÷ N, the parts being the
items the share counts, judged by the server on every draft of the timeline: lights turned off (Blackout), cells right
(Box Six, Mosaic), rings home (Hanoi), flasks corked (Polypotions), dials right beyond the first (Safe Cracker), steps
right (Bomb Defusal), cells flooded beyond the start region (Colour Flood), tents right (Tents and Trees), cells
covered by correct rectangles (Shikaku), bulbs on solution squares (Lamplighter).

**Shares.**

- Blackout: lights turned off = lights on at the start less lights on now (never below 0), of the lights on at the
  start. The final board counts (not the best board passed through).
- Hanoi: rings home from the bottom of the gold post (`discsHome`), counting only the rings put there beyond those
  already home at the start (as today's rev-1 credit), of the rings that were not.
- Polypotions: corked flasks (full and one colour) beyond those corked at the start, of the colours not corked at the
  start.
- Safe Cracker: the best try's dials right, or the dials as they stand before the third try (today's rule), less one:
  one dial right is what a guess gives (today's free dial), so the share is (dials − 1) ÷ 3. Today's top-up credit for
  a card read but misdialled (`SAFE_CLUE_CREDIT`) is not kept: the row's share is the dials.
- Bomb Defusal: the correct steps before the first wrong one (`correctPrefix`), of the six.
- Colour Flood: cells flooded beyond the start region, of the cells outside it.
- Shikaku: the area of accepted rectangles on the solution, of the grid.

**Mistakes and points off (unfinished).** Today's points off stay: Box Six 5 per wrong digit left in the grid, Mosaic 5
per wrong cell left filled, Tents and Trees 10 per wrong tent left standing (today's rev-1 penalty), Lamplighter 5 per
bulb off the solution, Shikaku the area of accepted rectangles off the solution (today's credit counted it against the
right area; the standard takes 120 × that area ÷ the grid). Three move games scale the unfinished credit (share and
early extras) by how far past par the moves went, as today's waste factor did, because random play otherwise scores
well on their shares (measured: Blackout's random presses 20–70, Polypotions' random pours 15–105, Colour Flood's
random taps 10–160 without it):

- Blackout: all of it up to par presses, falling evenly to none at twice par (the par bonus's zero). Every press
  counts, undone ones too, as the board's Presses line and the par bonus count them.
- Polypotions: all of it up to par pours, none at the pour limit (random pours always reach the limit). Every pour
  counts, as the limit counts them.
- Colour Flood: all of it up to par, none at the move limit (par + 10), so a board out of moves scores 0 (the help
  says so; the top-up's out-of-moves credit is not kept, since with ten spare moves random taps flood most of the
  board by then). This also fixes the old help line "Out of moves, the board ends and scores 0", which the top-up had
  made untrue: on the new stamp it is true, and the line now says par + 10.

Hanoi needs no such factor (random moves get no ring home: spam 0).

**Finishes.** Finished is the game's own verdict. Speed is `speedPoints` on the row's numbers. Par bonuses: Blackout
counts every press (undone ones too, today's depth measure), Hanoi the moves in the net move list (Undo removes a
move), Polypotions every pour (Undo never gives one back), all against the puzzle's public par (`par` / `minMoves`),
0 at twice par; Colour Flood 40 at par, 4 less a move over, 0 at par + 10. Safe Cracker: the only game here whose
today's finish cut the speed points for mistakes (tries: 15 / 8 / 0 of 15), so its speed is scaled by that (all on
the first try, 8 ÷ 15 on the second, none on the third) and the clean crack takes 2.5 off per wrong try on top, as
the brief says ("tries" cut speed). The other games' finishes measured no mistakes, so their speed is unscaled. Bomb
Defusal has no bonus (shown as "+ 0 bonus").

**History-based clean bonuses** (from the draft timeline; no timeline, or one that does not rebuild the answer, earns
no clean bonus):

- Box Six: each distinct (cell, digit) wrong digit ever entered in a blank, erased or overwritten ones too; the same
  wrong digit entered twice in one cell is one mistake.
- Mosaic: each distinct cell ever filled that is not in the picture (crosses are not fills).
- Tents and Trees: each distinct cell ever holding a tent that is not a solution tent.
- Shikaku: each distinct rectangle the board accepted at some draft that is not a solution rectangle and is not in
  the final answer ("drawn and removed"; the finish is the unique solution, so that is every wrong rectangle ever
  drawn). A drag the board rejects never appears in a draft and costs nothing.
- Lamplighter: each distinct cell ever holding a bulb that is not a solution bulb.
- Safe Cracker's tries are in the answer itself, so its clean crack needs no timeline.

Every stage already reports a draft on each change (a React effect on its state), so no stage change was needed.

**Rule change: Colour Flood's move limit.** The standard's stamp deals `moveLimit` = par + 10 (the stamp's `deal`
hook; `FLOOD_STANDARD_SPARE_MOVES`); the phone's counter and the server's replay both read the stored limit
(`floodMoveLimit`), so nothing else changed. **Flagged for Joe:** blind colour cycling floods every board in the
floodRev 3 bank within par + 6 taps (measured on all 400: par + 3 on 272, + 4 on 107, + 5 on 19, + 6 on 2), which is
why floodRev 3's limit was par + 2. With par + 10 a player who taps colours round and round finishes every board and
scores about 150–185 (the kit's cycling spam: 12 of 24 spam plays finish, spam median 21). Only a limit of par + 2 or
less keeps cycling unfinished on this bank; the par bonus formula (40, 4 less a move over, 0 at par + 10) works with
any limit. `standard-logic-check` records the finish rate as a NOTE and holds the unfinished spam near 0.

**Phone.** Safe Cracker's live "· clean crack" tag shows only before the first try on the new stamp (a wrong try now
costs the clean crack 2.5), and the reveal says "clean crack" only for a first-try open; the par meters (to twice par)
and the reveal lines already match. Help: Safe Cracker's "Clean crack" line says the first try earns the full bonus;
Colour Flood's limit line says par + 10.

**Checks pinned** (`pinPreStandard(true)`, the world they were written for): depth-d6-check (the depth revision's
deals and grades; its help-text assertion now reads the depth revision's own text, `logicDepthText.ts` `depthHelp`,
since the live help states the standard), depth-topup-check (the top-up's stamps and bar), flood-cycle-check (floodRev
3's par + 2 limit, under which cycling never finishes).

**Kit bands** (`bun scripts/standard-bands.ts`, 12 seeds from 6100; medians nothing / spam / average / good / great /
near): Blackout 0 / 0 / 41 / 84 / 184 / 194; Box Six 0 / 0 / 66 / 114 / 184 / 200; Hanoi 0 / 0 / 41 / 175 / 195 / 200;
Polypotions 0 / 0 / 30 / 177 / 192 / 199; Safe Cracker 0 / 0 / 84 / 186 / 200 / 200; Bomb Defusal 0 / 0 / 82 / 187 /
200 / 200; Mosaic 0 / 0 / 76 / 165 / 190 / 200; Colour Flood 0 / 11 / 100 / 195 / 200 / 200; Tents and Trees 0 / 0 / 63 /
167 / 192 / 200; Shikaku 0 / 0 / 60 / 159 / 184 / 200; Lamplighter 0 / 0 / 57 / 119 / 184 / 200. The weak average kit
leaves some Blackout and Polypotions boards at 0 (Blackout's lights-off share can be 0 midway through a correct
solution; Polypotions' flasks cork late), as today's grades did.
