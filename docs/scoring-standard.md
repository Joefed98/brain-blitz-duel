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
