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
