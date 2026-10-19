# Puzzle helper, `puzzleScoreRev 3` (20 Oct 2026)

Batch 1 of the scoring report (`docs/scoring-report-oct-2026.md`, #119) replaces the per-game knots below for every
puzzle with a finish state. Full results, the games that miss a mark and why, and the decisions for Joe:
`docs/scoring-rev3-oct-2026.md`.

- **Unfinished** = min(110, round(110 × progress ÷ oneShort)): about 55 half done, 110 one step short.
- **A correct finish** = 120 + round(30 × min(1, time-left share ÷ fastShare) × efficiency): 120 at the buzzer, 150
  with the game's fast share of the clock left (0.40–0.75; the help says "150 if you finish in about N s with no
  mistakes") and no mistakes. Mistakes only cut the 30 speed points.
- **Progress** per game: `src/lib/duel/puzzleProgress.ts` (Slider's row scale 30/70/90/110, Trail's path, scales,
  equations and jugs with credit inside the current step, Strikeout's fifth word, Interlock's words being built,
  Exact's distance with off by 1 = 110, solver distance on Turntable, Gridlock, Jumbled, Blackout and Hanoi, a
  push bound on Heave, the best layout on Lightbender, small curves on Matchmaker and Safe Cracker); the rest keep
  rev 1's unfinished credit, which the report found fair. Polypotions keeps #118's solver measure: its average kit
  player scores 27 straight through the helper, against 71 on #118's lifted knots.
- **Open games** (Nucleus, Forage, Flash, Bang On, Ballpark) keep the rev-2 curves below under the new stamp.
- Older rounds keep their stamps and grade exactly as before; scoring-rev3-check (~6 s) proves the helper on
  3,563 stored runs (`scripts/fixtures/scoring-rev3-runs.json.gz`, `bun scripts/scoring-rev3-record.ts`).
- The same batch: Strikeout `strikeoutRev 4` (12 strikes), Cryptogrid `codewordRev 3` (a sixth starting letter),
  Swapword `swapwordRev 3` (minimum + 8 swaps), Lookout `wordSearchRev 2` (no theme-name words), Colour Flood
  `floodRev 3` (a pool cycling can't finish), Interlock's Done needs all 15 tiles, and a reload keeps the stage's board.

The score bands below still define the arcade, engine and open games, and grade every rev-2 round.

# Score bands (19 Oct 2026)

Joe's bands for every round of all 74 active games, in rooms and in practice (a round scores 0–150), replacing
#110's scoring targets, which proved too lenient:

| Band | Score | Simulated level it is fitted to |
|---|---|---|
| Perfect | 150 only | a flawless run |
| Near perfect | 130–149 | near-perfect (about 140) |
| Great | 110–129 | great (about 120) |
| Good | 90–109 | good (about 100) |
| Decent | 80–89 | between good and average |
| Average | 60–79 | average (about 70) |
| Below | smoothly down to 0 | weaker play; doing nothing scores 0 |

The simulated players are the ones every calibration used: the arcade skill-band humans
(`scripts/arcade-skill-bands/human.ts`) and the puzzle-fairness kits (`scripts/puzzle-fairness/kit.ts`), four levels
each. Every number below is a median over room seeds, graded or replayed by the server's own code.

## Summary

- **Puzzles (47 games): `puzzleScoreRev 2`.** Each game keeps its rev-1 grader (what counts, every limit and cost)
  and turns its result into points through its own knots, fitted on the kits (below). Partial credit is the game's
  own progress measure, so half done always scores and every finish beats every unfinished run.
- **Arcade (22 games): a new revision each, `band: 3`.** The same play; each game scores on its own strict curve
  (`src/lib/arcade/strictBands.data.ts`, fitted in its own units by `scripts/arcade-bands-fit.ts`).
- **Engine games (5):** Tenfall `tenRev 2`, Mixed Signals `clashRev 6`, Bonk `whackRev 2`, Pull! `clayRev 7`,
  Letterfall `wordfallRev 3`: the same play, the total mapped through a knot curve in the sim (so the HUD, the server
  replay and the reveal agree).
- **Zero scores in rooms:** six games never sent a draft, so a reveal that reached the phone before the stage's own
  lock-in submitted "" (0); Mixed Signals answers were cut at 4,000 characters; Safe Cracker scored 0 for dials set
  but not tried. Fixed (below), and the four room-screen risks were fixed in the follow-up.
- Older rounds keep their stamps and grade and replay exactly as before; no stored data changes.

## How a puzzle's result becomes points (`src/lib/duel/puzzleScoreRev2.ts`)

- **Unfinished:** result = 99 × progress, progress = the rev-1 unfinished credit ÷ 110 (the game's own measure, below,
  already cut by its waste and mistake rules). 50 % done is result 49.5.
- **Finished:** result = 100 + 100 × quality: the share of the clock left at the finish (the whole clock, no par
  plateau), or half that and half the efficiency share on games that measure efficiency, cut by any penalty the
  rev-1 speed part took (wrong taps, rough placing).
- **Open games** (Nucleus, Forage, Flash, Bang On, Ballpark): result = the rev-1 score.
- **Knots** (`src/lib/duel/puzzleBands.data.ts`, `bun scripts/puzzle-bands-fit.ts --write`, 40 fit seeds): (0, 0),
  then each level's median result at its target (70 / 100 / 120 / 140), then 150 at the best near-perfect run (so only
  a run better than every near-perfect kit run scores 150), with guard rails: at most 5 points per result step below
  the average median (10 % progress at most 50), half progress at least 30 where the knots allow it, and random or
  spam input (every strategy the fairness audit does not count as real play) at most 10 at its 90th percentile.
- The reveal stores the rev-2 breakdown (`extra.parts`: what a finish at the buzzer scores + efficiency + speed, or
  "N for progress"), the rev-1 score (`extra.rev1Score`) and the result (`extra.result`).

### Each game's progress measure and what the knots give

Half done / a finish as time runs out / a finish with a third of the time left (none wasted where efficiency counts).
The "?" help states these numbers (`src/lib/duel/puzzleBandsText.ts`), and so does the intro line in plain words.

| Game | Progress (partial credit) | Efficiency | Half / buzzer / third |
|---|---|---|---|
| Interlock | tiles inside a real word | — | 71 / 90 / 105 |
| Slider | rows you made into words (wasted moves cost) | moves | 30 / 48 / 82 |
| Lookout | words found (wrong picks after the first 5 cost a little) | — | 34 / 69 / 91 |
| Roundabout | words found (misses after the first 5 cost a little) | misses | 53 / 102 / 126 |
| Strikeout | words solved, plus letters found in the current word | strikes | 39 / 75 / 131 |
| Cryptogrid | numbers decoded right (a wrong letter costs) | — | 44 / 81 / 99 |
| Swapword | tiles you placed (tiles you moved out of place cost) | swaps | 30 / 51 / 93 |
| Exact | how close the closest number you made is | — | 75 / 89 / 98 |
| Operator | equations solved, 3 tries each | — | 42 / 81 / 98 |
| Counterweight | scales balanced (bigger scales count more) | — | 55 / 93 / 117 |
| Integer Pyramid | pyramids finished, plus right bricks on the next one | — | 73 / 123 / 145 |
| Trail | tiles in their right cell (tiles in a wrong cell cost) | — | 60 / 91 / 112 |
| Brimful | puzzles solved in order | moves | 74 / 100 / 126 |
| Checkout | boards checked out (bigger boards count more) | darts | 75 / 103 / 124 |
| Ascend | numbers reached in order (wrong taps cost) | — | 68 / 95 / 114 |
| Don't Break the Chain | links tapped | — | 87 / 111 / 127 |
| Eagle Eye | eagles found (wrong taps cost) | — | 55 / 104 / 126 |
| Double Take | differences found (wrong taps cost) | — | 53 / 87 / 107 |
| Tally | trays counted right (one off still counts a little) | — | 65 / 106 / 115 |
| Labyrinth | how far along the route you got (wandering costs) | — | 69 / 99 / 128 |
| Matchmaker | pairs found (lots of mismatched tries cost) | — | 49 / 82 / 96 |
| Gridlock | the gold block's lane cleared (wasted moves cost) | moves | 74 / 86 / 114 |
| Tessellate | pieces in their solution spot (pieces elsewhere cost) | — | 56 / 95 / 118 |
| Skid | the distance to the exit you closed (wasted moves cost) | moves | 66 / 84 / 122 |
| Topsy-Turvy | how much closer your balls are to all parked (tilts that don't help cost), `gravityRev 2` | tilts | 72 / 86 / 116 |
| Jumbled | tiles you put in place (wasted moves cost); 90 s from `tilesRev 2` | moves | 46 / 78 / 103 |
| Turntable | spokes you lined up (wasted moves cost) | moves | 74 / 85 / 103 |
| Lightbender | gems lit by your last shot | shots | 78 / 91 / 118 |
| Pipeline | tiles you joined to the source | — | 72 / 96 / 123 |
| Blackout | lights turned off (a few left on counts most) | moves | 77 / 89 / 123 |
| Box Six | right cells (a wrong digit costs) | — | 66 / 100 / 120 |
| Chroma Lines | pairs joined on their route (other joined pairs cost) | — | 55 / 89 / 111 |
| Heave | crates you brought home (wasted pushes cost) | pushes | 40 / 81 / 106 |
| Hanoi | rings you stacked on the gold post (wasted moves cost) | moves | 73 / 86 / 114 |
| Polypotions | how much closer your flasks are to all sorted (pours that don't help cost triple), `tubesRev 2` | pours | 76 / 88 / 115 |
| Safe Cracker | dials right on your best try, or as they stand when time runs out (one lucky dial is free) | tries | 71 / 83 / 99 |
| Bomb Defusal | correct steps before a strike | — | 34 / 68 / 90 |
| Mosaic | right cells (a wrong cell costs) | — | 41 / 78 / 95 |
| Colour Flood | cells flooded, within the par moves | moves | 39 / 74 / 100 |
| Tents and Trees | right tents (a wrong tent costs) | — | 59 / 92 / 111 |
| Shikaku | cells in the solution's rectangles (other rectangles cost) | — | 72 / 98 / 119 |
| Lamplighter | bulbs on the solution (other bulbs cost) | — | 61 / 92 / 112 |

Open games: **Nucleus** and **Forage** count word points (10 ≈ 70, 23 ≈ 100, 34 ≈ 120, 55 ≈ 140 and 150 at 60; Forage 9 ≈ 78,
15 ≈ 100, 24 ≈ 122, 36 ≈ 141, 150 at 44); **Flash** the average reaction (465 ms ≈ 70, 280 ≈ 101, 205 ≈ 120, 160 ≈ 143,
150 at 150 ms); **Bang On** the average stop error (165 ms off ≈ 70, 110 ≈ 100, 65 ≈ 120, 35 ≈ 140, 150 at 20 ms);
**Ballpark** accuracy, then speed with all fifteen placed. **Safe Cracker** was the one solved-or-not puzzle: an
average player sets the dials from the clues but often runs out of time before trying them (median 0 before). Its
progress is now the dials right on the best try, or as they stand when time runs out (the phone's draft carries them
after a ";", never counted as a try), one lucky dial free.

### Puzzles before → after

Medians on 30 room seeds (7001–7030, not the fit seeds), `bun scripts/puzzle-bands-fit.ts --report-only`. Before =
the same puzzles on `puzzleScoreRev 1` (what rooms dealt on 18 Oct).

| Game | Average before → after | Good | Great | Near-perfect | Finished (of 30) | Spam median / max |
|---|---|---|---|---|---|---|
| Interlock | 51 → 70 | 139.5 → 103.5 | 150 → 125 | 150 → 142 | 3 / 30 / 30 / 30 | 0 / 30 |
| Slider | 145 → 71 | 150 → 114 | 150 → 120 | 150 → 141 | 30 / 30 / 30 / 30 | 0 / 0 |
| Lookout | 121 → 69.5 | 149 → 101 | 150 → 121.5 | 150 → 141 | 16 / 30 / 30 / 30 | 0 / 0 |
| Roundabout | 72 → 70 | 102 → 100 | 142 → 120 | 149.5 → 138.5 | 0 / 4 / 30 / 30 | 0 / 0 |
| Strikeout | 110 → 75 | 141 → 108 | 145 → 124.5 | 147 → 141 | 6 / 26 / 30 / 30 | 4 / 47 |
| Cryptogrid | 89 → 70.5 | 144 → 105.5 | 150 → 125 | 150 → 140 | 6 / 29 / 30 / 30 | 0 / 9 |
| Swapword | 134.5 → 70.5 | 149 → 101 | 150 → 122 | 150 → 142.5 | 17 / 29 / 30 / 30 | 9 / 33 |
| Exact | 78 → 80.5 | 145 → 102.5 | 150 → 118.5 | 150 → 141 | 11 / 30 / 30 / 30 | 0 / 89 |
| Operator | 85 → 70 | 143 → 100 | 150 → 118.5 | 150 → 141 | 3 / 30 / 30 / 30 | 0 / 42 |
| Counterweight | 70 → 70 | 124 → 98 | 141 → 119 | 150 → 140 | 0 / 22 / 30 / 30 | 0 / 30 |
| Integer Pyramid | 51 → 68.5 | 80 → 100 | 103.5 → 118.5 | 136 → 139 | 0 / 0 / 7 / 30 | 0 / 21 |
| Trail | 64 → 69.5 | 130.5 → 99.5 | 147 → 122 | 150 → 142 | 0 / 30 / 30 / 30 | 0 / 24 |
| Brimful | 30 → 44 | 132.5 → 113.5 | 146 → 125.5 | 150 → 140 | 0 / 17 / 30 / 30 | 0 / 44 |
| Checkout | 46 → 70 | 100 → 100 | 145 → 123.5 | 150 → 141 | 0 / 8 / 29 / 30 | 0 / 70 |
| Ascend | 61.5 → 72 | 135 → 109 | 145 → 121 | 150 → 139 | 0 / 30 / 30 / 30 | 0 / 0 |
| Don't Break the Chain | 20 → 71 | 82 → 100 | 136.5 → 123.5 | 150 → 142 | 0 / 3 / 19 / 26 | 0 / 16 |
| Eagle Eye | 76 → 75 | 104 → 100 | 136.5 → 121 | 150 → 141 | 0 / 11 / 25 / 29 | 0 / 20 |
| Double Take | 79 → 72.5 | 135 → 99 | 148.5 → 121 | 150 → 140 | 0 / 29 / 30 / 30 | 0 / 0 |
| Tally | 61 → 74 | 89 → 101 | 142 → 116.5 | 150 → 137.5 | 0 / 10 / 18 / 24 | 1 / 85 |
| Labyrinth | 57.5 → 71 | 122 → 101 | 137.5 → 123 | 146 → 140 | 0 / 18 / 30 / 30 | 1 / 99 |
| Matchmaker | 86 → 73 | 144.5 → 99 | 150 → 121 | 150 → 141 | 3 / 30 / 30 / 30 | 0 / 3 |
| Gridlock | 36.5 → 69 | 139.5 → 99 | 148.5 → 119.5 | 150 → 140 | 0 / 27 / 30 / 30 | 0 / 0 |
| Tessellate | 69 → 70 | 124.5 → 100.5 | 141 → 118.5 | 150 → 140 | 0 / 25 / 30 / 30 | 0 / 14 |
| Skid | 62 → 71 | 134 → 97.5 | 146 → 122.5 | 150 → 141.5 | 0 / 18 / 30 / 30 | 0 / 0 |
| Topsy-Turvy | 37 → 7 → **50.5** (`gravityRev 2`; 200 seeds: 68) | 138 → 102 → 100 | 148.5 → 120 | 150 → 140 | 0 / 25 / 30 / 30 | 5 / 37 → 0 / 25 |
| Jumbled | 23 → 57.5 → **64** (`tilesRev 2`, 90 s; 200 seeds: 70) | 136 → 99 → 99 | 147.5 → 119 → 120.5 | 150 → 136.5 → 137 | 0 / 26 / 30 / 30 → 10 / 30 / 30 / 30 | 0 / 7 → 0 / 0 |
| Turntable | 14 → 61.5 | 146 → 101 | 150 → 122 | 150 → 143 | 8 / 30 / 30 / 30 | 0 / 85 |
| Lightbender | 22 → 70 | 134 → 102 | 140.5 → 107.5 | 150 → 137 | 0 / 25 / 30 / 30 | 0 / 70 |
| Pipeline | 46.5 → 65.5 | 125 → 100.5 | 139 → 120.5 | 149 → 140 | 0 / 29 / 30 / 30 | 0 / 45 |
| Blackout | 25 → 70 | 136 → 103.5 | 146 → 122 | 150 → 136 | 1 / 18 / 30 / 30 | 0 / 0 |
| Box Six | 62.5 → 72.5 | 124 → 104 | 140 → 120 | 150 → 140.5 | 0 / 22 / 30 / 30 | 0 / 10 |
| Chroma Lines | 78.5 → 74 | 131 → 99 | 145 → 119 | 150 → 140 | 0 / 28 / 30 / 30 | 8 / 89 |
| Heave | 73 → 70 | 141 → 99 | 150 → 120 | 150 → 137 | 2 / 30 / 30 / 30 | 0 / 70 |
| Hanoi | 41 → 70 | 140.5 → 104.5 | 148 → 117 | 150 → 139.5 | 1 / 29 / 30 / 30 | 0 / 99 |
| Polypotions | 31 → 4 → **59** (`tubesRev 2`; 200 seeds: 71) | 142 → 107.5 | 148 → 119 | 150 → 139.5 | 0 / 29 / 30 / 30 | 5 / 82 → 0 / 96 |
| Safe Cracker | 37.5 → 70 | 147 → 100 | 150 → 119.5 | 150 → 141 | 12 / 30 / 30 / 30 | 0 / 35 |
| Bomb Defusal | 88 → 54 | 148 → 98 | 150 → 127 | 150 → 142 | 14 / 23 / 26 / 29 | 0 / 27 |
| Mosaic | 91.5 → 68.5 | 147 → 102 | 150 → 119.5 | 150 → 140.5 | 7 / 30 / 30 / 30 | 0 / 51 |
| Colour Flood | 95.5 → 68.5 | 145.5 → 99 | 149.5 → 115.5 | 150 → 136.5 | 9 / 26 / 30 / 30 | 0 / 92 |
| Tents and Trees | 70 → 72 | 130 → 100.5 | 149 → 120.5 | 150 → 138 | 0 / 27 / 30 / 30 | 0 / 43 |
| Shikaku | 56 → 72 | 121.5 → 99.5 | 140 → 120 | 150 → 140 | 0 / 17 / 30 / 30 | 0 / 41 |
| Lamplighter | 58.5 → 64.5 | 129 → 99.5 | 146 → 119.5 | 150 → 139 | 0 / 25 / 30 / 30 | 0 / 80 |
| Nucleus | 97 → 72 | 122 → 100 | 135 → 120 | 149.5 → 149 | 0 / 4 / 9 / 16 | 3 / 37 |
| Forage | 95 → 78 | 121 → 101 | 131 → 116 | 142 → 135 | 0 / 0 / 0 / 0 | 6 / 78 |
| Flash | 64.5 → 66 | 106.5 → 101.5 | 130.5 → 124.5 | 143.5 → 139.5 | 30 / 30 / 30 / 30 | 0 / 79 |
| Bang On | 111 → 77 | 121 → 104.5 | 130.5 → 128.5 | 134 → 140 | 30 / 30 / 30 / 30 | 0 / 68 |
| Ballpark | 71 → 72 | 104.5 → 100.5 | 127 → 121 | 140 → 138 | 11 / 30 / 30 / 30 | 0 / 29 |

## Engine games

| Game | Stamp | Map | Before (avg / good / great / near) | After |
|---|---|---|---|---|
| Tenfall | tenRev 1 → 2 | 97 → 70, 128 → 100, 135 → 120, 137 → 140, 150 | 97 / 128 / 135 / 137 | 70 / 100 / 120 / 140 |
| Mixed Signals | clashRev 5 → 6 | 70 → 70, 100 → 100, 134 → 120, 144 → 140, 150 | 70 / 100 / 134 / 144 | 70 / 100 / 120 / 140 |
| Bonk | whackRev 1 → 2 | raw 62 → 70, 102 → 100, 118 → 120, 133 → 140, 150 | 99 / 120 / 135 / 145 | 69 / 100 / 120 / 140 |
| Pull! | clayRev 6 → 7 | 88 → 70, 125 → 100, 149 → 135, a perfect 150 | 88 / 125 / 150 / 150 | 69 / 100 / 150 / 150 |
| Letterfall | wordfallRev 2 → 3 | word points 21 → 70, 31 → 100, 35 → 120, 40 → 140, 150 at 46 (was 150 at par 30) | 105 / 150 / 150 / 150 | 70 / 100 / 115 / 122 |

Pull!'s great and near-perfect players hit every clay with no bird (the kits' medians are perfect runs), so they stay
at 150: the game has no finer measure of a perfect run. Letterfall's great and near-perfect kits make about the same
points (34 and 35), so they land together (115–122).

## Arcade games

Medians from `bun scripts/arcade-skill-bands.ts --rev=now --seeds=30` (every run through the server's encode + replay;
none flagged or disagreeing), before = the revision rooms dealt on 18 Oct (band 2), after = the new one (band 3).

| Game | Stamp | Before: avg / good / great / near | After |
|---|---|---|---|
| Ball Tracker | btRev 5 → 6 | 100 / 118 / 137 / 137 | 70 / 103 / 130 / 130 |
| Wavefront | wavRev 7 → 8 | 115 / 126 / 129 / 140 | 72 / 112 / 124 / 140 |
| Roofbound | flipRev 5 → 6 | 105 / 149 / 149 / 150 | 70 / 110 / 120 / 150 |
| Rainbow Bridge | inkRev 7 → 8 | 50 / 73 / 107 / 115 | 35 / 51 / 80 / 92 (Joe-anchored, below) |
| Gemstone | matchupRev 7 → 8 | 97 / 108 / 120 / 123 | 68 / 82 / 100 / 105 (Joe-anchored, below) |
| Coral Pop | bubbleRev 6 → 7 | 95 / 119 / 134 / 139 | 72 / 101 / 123 / 139 |
| Jaywalk | crossRev 6 → 7 | 99 / 121 / 136 / 145 | 72 / 100 / 120 / 141 |
| Rally | rallyRev 7 → 8 | 98 / 117 / 140 / 141 | 70 / 103 / 131 / 141 |
| Meteor | snakeRev 7 → 8 | 97 / 120 / 135 / 142 | 74 / 100 / 120 / 140 |
| Swish | binRev 5 → 6 | 95 / 122 / 133 / 139 | 70 / 103 / 120 / 139 |
| Scrumper | snipRev 8 → 9 | 102 / 124 / 138 / 139 | 73 / 100 / 121 / 129 |
| Hover | hoverRev 6 → 7 | 93 / 110 / 131 / 133 | 70 / 101 / 123 / 139 |
| High Rise | skylineRev 5 → 6 | 101 / 119 / 134 / 145 | 71 / 102 / 121 / 141 |
| Breaker | brkRev 7 → 8 | 99 / 113 / 135 / 139 | 74 / 100 / 120 / 139 |
| Tilt | tiltRev 5 → 6 | 103 / 120 / 137 / 136 | 71 / 103 / 131 / 130 |
| Orbit | orbitRev 9 → 10 | 104 / 120 / 136 / 138 | 76 / 100 / 124 / 139 |
| Tempo | beatRev 7 → 8 | 103 / 128 / 140 / 148 | 71 / 101 / 121 / 140 |
| Slice | sliceRev 7 → 8 | 98 / 121 / 127 / 137 | 74 / 101 / 125 / 139 |
| Fission | burstRev 5 → 6 | 97 / 130 / 144 / 136 | 71 / 101 / 135 / 116 |
| Grappler | swingRev 10 → 11 | 97 / 115 / 136 / 136 | 76 / 102 / 131 / 131 |
| Flightpath | bullRev 5 → 6 | 99 / 121 / 133 / 144 | 72 / 101 / 121 / 142 |
| Pinball | pinRev 2 → 3 | 100 / 120 / 134 / 144 | 71 / 103 / 123 / 142 |
| Junction (practice only) | junctionRev 3 | 80 / 111 / 114 / 140 | unchanged (not dealt in rooms) |

How a strict curve is built (`scripts/arcade-bands-fit.ts`): the game's units and top stay (140 plus the finish bonus,
or 150 on open games); each level's median units is anchored at its target less that level's median finish bonus or
penalty, refined until the median total lands on the target; between anchors the old curve's shape is kept. A level
whose median units do not rise above the level below (Ball Tracker, Tilt, Grappler, Fission: the near-perfect bots
fall or end no further than the great ones) shares one anchor with it at 130; a level at the top sets none (Roofbound's
near-perfect bots survive with all ten stars: 150, a perfect run).

**Real runs.** No beta recordings are in the repo, so the real anchors are Joe's own calibration play (Tuning C,
`docs/arcade-score-bands-oct-2026.md`): Rainbow Bridge was fitted to his scores (60–76 units) and Gemstone's 150 to his
par (2,800 match points); the bots under-rate both (they never plan bridges or cascades). Both keep their October
curves through the same map the bands imply (70 → 70, 100 → 100, 125 → 120, 140/145 → 140): Joe's Rainbow Bridge runs
now score 102–113 (were 122–130 on #110's lift), his par run 150. Every other game's stored replay runs (the 176
#110 recorded and the replay fixtures) replay to the same final states.

## Guard rails

- **Random and careless play stays low.** `scoring-bands-check` runs every spam strategy on 12 room seeds per puzzle and
  fails if a strategy the fairness audit does not count as real play has a median above 5 (or a point above what rev 1
  gave the same answers); doing nothing scores 0 everywhere. The knots' spam guard pins random input's 90th percentile
  at 10 points. Topsy-Turvy and Polypotions now measure progress by solver distance (below), so random tilts and
  pours score a median of 0 and their average players reach the average band. `careless-play-check` passes unchanged
  (Flash, Bang On and Pull!'s careless lines still cost more).
- **Partial credit:** every rev-2 puzzle's half-progress score is above 0 (checked), every finish beats every
  unfinished run (checked), and progress is the game's own measure of what the player made (rows, words, cells,
  pieces, scales, dials…), never the starting state.
- **Stamps:** every game whose scoring changed has a new stamp; older stamps grade and replay as before
  (`puzzle-score-rev-check`, `scoring-targets-check` and the older games' checks still prove their revisions, pinned
  to them). Stored runs on every new stamp: `scripts/fixtures/scoring-bands-runs.json.gz` (176 arcade runs, 662 answers)
  and 27 new runs in `scripts/fixtures/replay-runs.json`. Practice bests start fresh (`practiceStamps.data.ts` rebuilt).
- **Help text:** the "?" help and intro lines read the new numbers (a good arcade run is now 100 points,
  `BAND_GOOD_POINTS`); the puzzle texts come from the knots.

## Zero scores in rooms (audit)

Fixed:

1. **No draft from six stages** (Gridlock, Tessellate, Exact, Double Take, Forage, Nucleus): they only locked in
   themselves just before their own clock ended. If the room reached the reveal first (a backgrounded or locked phone,
   a stalled clock, a phone clock more than ~1.4 s behind the server), the stage saw a fresh clock and never locked
   in, and the room sent the empty draft: 0 for every word, move, step and piece. Each now sends its answer as a draft
   on every change (`onDraftAnswer`), as every other stage does. Rooms only; practice locks in on the same clock.
2. **Mixed Signals answers were cut at 4,000 characters** (`grade.ts`): a busy run lost its last inputs, and a cut
   inside the end tick replayed only a few ticks. It now gets the arcade runs' allowance.
3. **Safe Cracker: dials set but not tried scored 0**, and an unopened safe counted only the last try (rev 2 counts the
   best try and the dials left standing).

Fixed on the room screens (19 Oct 2026, follow-up; room flow and display only, no scoring or band changes):

4. **A failed send is retried** (`src/lib/duel/roomSend.ts`): the stage's own submit and the time-out's draft both go
   through one sender per round; a send that throws goes again, the same answer and time claim, after 0.4 / 0.8 / 1.6 /
   3.2 / 5 s (then every 5 s) while the round is in the puzzle or reveal phase. A server reply is never retried
   (`room-send-check`).
5. **The draft survives a reload** (`src/lib/duel/roomDraft.ts`): every draft is kept in localStorage by its round's
   state key and read back by a reloaded page, so the time-out sends it if the round ends before the stage is back. The
   stage's untouched opening board never replaces it; the first draft that differs (the player played again) does
   (`room-draft-check`).
6. **Late arcade stages finish their run** (`src/lib/duel/roomClose.ts`): arcade-clock rounds (the 22 active arcade games
   and the five engine games) wait `ARCADE_LATE_RUN_MS` (5 s) longer before the time-out and the phase close (phone and
   server), so a stage mounted up to 8 s late ends on its own. Rounds where everyone has answered move on at once
   (`room-late-run-check`).
7. **The clock is re-measured every round** and whenever the app returns to the foreground (`useDuel`, `clock.ts`), so a
   device clock that moved since the last measurement never drops Flash, Bang On, Ascend or Lightbender taps
   (`clock-round-check`).

Figures fixed with them (display only): the seven puzzles whose leaderboard and reveal showed raw progress now show the
progress their credit counts (`src/lib/duel/progressFigures.ts`, the graders' own counts: Chroma Lines "3/7 pairs on
route", Shikaku "18/81 cells right", Lamplighter "4/9 bulbs right", Tessellate "4/9 pieces in place", Jumbled and
Swapword "3/7 tiles placed", Slider "2/5 rows made"; what counts against it goes in the row's detail); Pull! clayRev 7
and Hats/Bonk whackRev 1–2 label their bird, empty-shot and penalty figures as the total's, not score points; Letterfall
wordfallRev 3's "short of 150" counts to the 46 points that score 150, not to par (`room-figures-check`).

## For Joe to rule on

1. **The 50 % par rule (CLAUDE.md rule 6).** On `puzzleScoreRev 2` a puzzle finish is measured on the whole clock, not
   full marks at half time: with the par plateau a near-perfect and a perfect finish both scored 150, which the bands
   forbid. Finishing with half the clock left (none wasted) now scores 100–150 depending on the game (median about 127:
   lower where good players finish that fast, higher where only near-perfect ones do), 150 only past the best
   near-perfect run. Older rounds keep the par curve. If you want the par rule kept, near-perfect puzzle players will
   sit at 150 again in most games.
2. **Kits and bots as the reference.** Every curve is fitted to the simulated players, as in October; your own runs
   remain the real check. Rainbow Bridge and Gemstone follow your play, not the bots.
3. **Topsy-Turvy and Polypotions**: fixed by the follow-up below (`gravityRev 2`, `tubesRev 2`, solver distance).
4. **Still low or noisy averages** (time proposals for Brimful, Bomb Defusal and Jumbled in the follow-up below):
   Brimful 44, Bomb Defusal 54 (half the average kits finish, so the median swings),
   Jumbled 58 (now 90 s, `tilesRev 2`: 64 on these seeds, 70 on 200), Turntable 62, Lamplighter 65, Pipeline 66 — the average kits make little progress in time and partial
   credit is kept proportional (at most 5 points per step) rather than inflated. Integer Pyramid: good kits never finish
   (they score 100 on progress); the 150 s or three-pyramid proposal from #110 stands.
5. **Near-perfect equal to great** (the bots cannot tell them apart): Ball Tracker, Tilt, Grappler (both about 130),
   Fission (great 135, near-perfect 116: near-perfect bots finish with fewer atoms), Scrumper near 129, Letterfall,
   Pull! and Roofbound (perfect runs at 150).
6. **Safe Cracker's draft** now sends the dials as they stand at the buzzer (`tries;dddd`); a judgment call: they count
   as progress, never as a try, so a time-out can never open the safe.
7. **Stopwatch and Flash under the bands** score lower than #110 for slow play (Bang On 165 ms off ≈ 70); both keep the
   14 Oct speed tuning underneath.

## Checks

- `scripts/scoring-bands-check.ts` (new, ~12 s): the strict curves and stamps, the 176 recorded arcade runs (same final
  state as the target revision, stored scores), the engine maps and recorded answers, every puzzle's knots, recorded
  answers and random play, Safe Cracker's draft, the help numbers.
- Tools: `bun scripts/puzzle-bands-fit.ts` (fit, `--write`, `--report-only`), `bun scripts/arcade-bands-fit.ts <runs.json>`
  (from `arcade-skill-bands.ts --json`), `bun scripts/scoring-bands-record.ts` (the fixture).

## Follow-up (19–20 Oct 2026): Topsy-Turvy and Polypotions progress, Jumbled on 90 s, Operator on one line

### Solver-distance progress (`src/lib/duel/solverProgress.server.ts`)

Balls parked and flasks corked were reached about as often by random tilts and pours at the limit as by an average
player, so the random-play guard held both games' unfinished credit near 0 (averages 7 and 4). New rounds carry
**Topsy-Turvy `gravityRev 2`** and **Polypotions `tubesRev 2`** (the same boards, limits and finish scoring; older rounds
keep `gravityRev 1` / `tubesRev 1` and grade exactly as before):

- **closer** = the board's stored minimum less the fewest moves the board the player holds still needs, found by an
  exact search on the stored board.
- **waste** = moves made beyond `closer` (Undo and Reset never give one back). Each wasted tilt cancels one good one,
  each wasted pour three: random pours do much more real sorting than random tilts (a pour only goes onto a matching
  colour or into an empty flask, so a random pour list at the limit ends a few pours from solved). At two per pour,
  random pours' 90th percentile on 200 room seeds was 13 % of the board against the average player's 36 %; at three it
  is 0 % against 24 %.
- **A board made unsolvable** (a locked ball in the way, a dead end) keeps the best `closer` of the boards the player
  stood on before it, less the same waste (Joe's ruling, 20 Oct 2026; was 0).
- progress = (closer − weight × waste) ÷ minimum, the unfinished credit 110 × progress (the rev-1 shape), then the
  game's own knots row, `gravity:2` / `tubes:2` in `puzzleBands.data.ts` (`rev2KnotsForPuzzle`; older stamps keep
  their rows). Following the solution k moves is worth exactly k ÷ minimum. The reveal stores `extra.progress` (%).
- Fitted with `bun scripts/puzzle-bands-fit.ts --write` (Topsy-Turvy on 80 fit seeds, `--seeds=80`: its average kits'
  progress swings with the board's minimum, 8–14 tilts, so 40 seeds left the median a few points off).

**Grading time.** The first version ran a plain breadth-first search from the board the player held: up to 1.5 s
for one Polypotions round near the start (which timed out puzzle-score-rev-check in CI). Now:

- Polypotions searches with A* on a lower bound that never overestimates and falls by at most one per pour (every run
  of balls sitting on another colour must be poured at least once; of a colour's runs on flask bottoms all but one
  must), so it finds exactly the breadth-first minimum, and with a cheaper state key.
- Topsy-Turvy keeps breadth-first search with a one-pass tilt (`packTilt`, the same board `tilt` reaches; checked on
  every board the kits stand on).
- One round's searches share a 12,000-node budget (`GRADE_NODE_BUDGET`); a board the budget cannot settle counts as
  no closer. On 108,692 Topsy-Turvy boards the kits stood on (200 seeds), 99 % settle within 6,300 nodes and every
  board needing more than 12,000 was no closer than the start. Dead boards' searches mark every state they reach dead,
  and earlier boards are tried newest first, only while one could still beat the best found.
- Measured (`bun scripts/solver-progress-timing.ts`, 100 seeds, every level every few steps, random play, nothing; one
  core): Topsy-Turvy mean 0.9 ms, slowest 35 ms (a random-tilt round on a dead board); Polypotions mean 0.4 ms, slowest
  12 ms. A fully spent budget costs about 45 ms in either game, so no round can take longer.

| Game | Average: fit seeds | test seeds 7001–7030 | 200 test seeds 7001–7200 | Good / great / near (7001–7030) | Random median / p90 (200 seeds) | Half / buzzer / third |
|---|---|---|---|---|---|---|
| Topsy-Turvy | 70 | 50.5 | 68 | 100 / 120 / 140 | 0 / 0 | 72 / 86 / 116 |
| Polypotions | 70 | 59 | 71 | 107.5 / 119 / 139.5 | 0 / 0 | 76 / 88 / 115 |

The 30 test seeds swing (Topsy-Turvy's draw is low: median progress 0.33 against 0.43–0.44 on 80 fit seeds and on 200
seeds; Polypotions' sits a point under the band); the 200-seed column is the fairer figure and is re-measured by `puzzle-bands-depth-check` (optional,
`--include-optional`, a few minutes). The round leaderboard's summary still shows balls parked / tubes sorted (results
screens untouched: another session).

### Jumbled: 90 s (`tilesRev 2`)

Joe's ruling (20 Oct 2026): the average kits ran out of time at 60 s (none of 30 finished; their median finish was 99 s).
New rounds carry `tilesRev 2`: the same extra-cell board with its own clock stored on the puzzle (`timeLimitMs: 90000`,
as Bomb Defusal and Hanoi already do), read by the round clock, the intro, the grader and the phone's own time-out
(`slidingTiles.tsx`); its own knots row `tiles:2`, fitted on 80 seeds. Older rounds keep `tilesRev 1` (or none) and 60 s
and grade exactly as before.

| | Average: fit seeds | test seeds 7001–7030 | 200 test seeds | Good / great / near (7001–7030) | Finished (of 30) | Random | Half / buzzer / third |
|---|---|---|---|---|---|---|---|
| Jumbled 60 s → 90 s | 57.5 → 69 | 64 | 70 | 99 / 120.5 / 137 | 10 / 30 / 30 / 30 | 0 / 0 | 46 / 78 / 103 |

Half done now scores less (46, was 76): with 90 s an average player finishes about a third of the time, so the knots
put 70 nearer the finish. Bomb Defusal (90 s) and Brimful (120 s) stay as they are.

### Operator: one line

The equation is drawn at 32 px and, when that is wider than its box, its font (and the slots, sized in em) shrinks just
enough to fit, measured before paint and on resize (`useFitOneLine`, display only). The slots are 1.35 em wide (were
square). Measured in headless Chromium: equations 1–2 stay at 28.5–32 px; five-number equations 22–26.5 px; the worst
case (five 20s, target 400) 23.5 px at 414×896, 21 px at 375×667, 20 px at 360×800 (slots then about 28 px wide). The
reveal's lines use the same fit and need none: at 414×896 and 375×667 every reveal line (four equations, each with the
player's wrong line) and the worst case ("20 × 20 ÷ 20 × 20 − 20 = 400") stay on one line at their full 18 / 16 px.

### Brimful, Bomb Defusal, Jumbled: the time audit

The average kits on 30 test seeds (`scripts/puzzle-fairness` kits, unlimited clock, when each run would finish), on the
clocks before the Jumbled ruling:

| Game | Clock | Average kits finishing in time | Would finish by | What stops them |
|---|---|---|---|---|
| Brimful | 120 s | 0 / 30 (about 1 of 4 boards; 27 % of their moves made) | 2 / 30 even at 240 s | mostly the clock, and 22 / 30 later hit a board's move limit (all 30 finish with no limit) |
| Bomb Defusal | 90 s | 14 / 30 | 16 at 108 s, 18 at 113 s, 19 at 135 s | 11 / 30 strike out (mistakes, not time); 5 are slow |
| Jumbled | 60 s (now 90 s) | 0 / 30 (60 % of their moves made) | 2 at 72 s, 10 at 90 s, 26 at 120 s | the clock |

### Checks

- `solver-progress-check` (~15 s): stamps and unchanged limits; the measure; packTilt equal to `tilt`, both searches
  equal to the generators' breadth-first minimum, the lower bound never over; dead boards keeping their best less waste;
  older stamps grading as before; 56 runs recorded on the new stamps (`scripts/fixtures/solver-progress-runs.json.gz`);
  average 60–79 on the fit seeds; random median 0.
- `jumbled-clock-check` (~2 s): tilesRev 2 on 90 s (clock, knots, help, the phone's time-out), tilesRev 1 unchanged,
  28 runs recorded on tilesRev 2 (`scripts/fixtures/jumbled-clock-runs.json.gz`), average 60–79, random 0.
- `puzzle-bands-depth-check` (optional): the 200-seed figures above.
- `puzzle-score-rev-check`: no longer grades the audit's unused legacy "before" column (`auditGame(…, { before: false })`);
  27 s locally (it timed out at 300 s in CI with the first solver).
- `scoring-bands-check` grades its fixture's Topsy-Turvy, Polypotions and Jumbled rows (recorded before) on their old
  stamps; `move-limits-check`, `tiles-rings-check` and `pattern-logic-oct14-check` accept the new stamps. Practice bests
  start fresh (`practiceStamps.data.ts`).

## Earlier: scoring targets (18 Oct 2026, #110)

Joe's targets for every puzzle and arcade game (a round scores 0–150):

| Score | Meaning | Simulated level it should fit |
|---|---|---|
| 150 | very hard, near perfect | a flawless run (scripted best) |
| 140–150 | tough | near-perfect |
| 130–140 | you have to be great | great |
| 110–130 | good | good |
| 90–110 | average, decent | average |
| below 90 | scales down smoothly | weaker play |

The simulated players are the ones every earlier calibration used: the arcade skill-band humans
(`scripts/arcade-skill-bands/human.ts`, four levels) and the puzzle-fairness kits (`scripts/puzzle-fairness/kit.ts`, the
same four levels). The October bands aimed at **70 / 100 / 125 / 140** for those levels, so the targets move every
arcade game up by about 30 at the average level, 20 at good and 10 at great; near-perfect and 150 barely move.

### Summary

- **Every arcade band game (22 in rooms) moves to a new revision** that keeps its play and lifts its band curve: each
  knot keeps its units and its points go through one map, `BAND_TARGET_MAP` (`src/lib/arcade/scoreBands.ts`):
  0 → 0, 70 → 100, 100 → 120, 125 → 135, 140 → 140, 150 → 150, straight lines between. So the same run never scores
  less, finishes and the top are unchanged, and each game keeps its own calibration (Joe's kinder Tempo, Gemstone's par,
  Rainbow Bridge fitted to his play).
- **Wavefront** (too harsh) gets its own gentler curve instead of the lift (`wavRev 7`): the old knots sat in a cliff
  (249 → 70, 259 → 100), so a few missed ships cost 30–50 points and a run ending in wave 4 scored under 50. Now
  two waves ≈ 60, four ≈ 92, reaching the boss ≈ 105, never below `wavRev 6` for the same play.
- **Nucleus and Forage** (too harsh) score their word points on curves (`wordsmithRev 1`, `wordHuntRev 1`) instead of
  2.5 × and 2 × points: average players went from 22 and 16 to about 95.
- **Bonk** (clearly low at every level, 62 / 102 / 118 / 133) keeps its play and costs; the total is lifted
  (`whackRev 1`) to about 100 / 120 / 135 / 145.
- **Swish**: the spinner is an eighth shorter (21 px each side of its pivot, was 24) in `binRev 5`, which also carries the lift.
- **Hanoi**: slimmer, cleaner rings (display only, no stamp); the posts stay the tap targets.
- **Puzzles**: measured, not changed beyond Nucleus, Forage and Bonk. As a group they are steep against the targets
  (average players often score 20–70 because they do not finish; good and great players often score 140–150), which
  is the shared puzzle score shape, not one game. That and the individual outliers are listed for Joe below.

Older rounds keep their stamps and replay and score exactly as before: only new rounds are dealt the new revisions, and
every older revision's game object is untouched (the legacy-replay checks below all pass unchanged).

### Stamps

| Game | Field | Before → now | What the new revision does |
|---|---|---|---|
| Ball Tracker | `btRev` | 4 → 5 | lift |
| Wavefront | `wavRev` | 6 → 7 | gentler curve `WAV_V7_BAND_CURVE` |
| Roofbound | `flipRev` | 4 → 5 | lift |
| Rainbow Bridge | `inkRev` | 6 → 7 | lift |
| Gemstone | `matchupRev` | 6 → 7 | lift |
| Coral Pop | `bubbleRev` | 5 → 6 | lift |
| Jaywalk | `crossRev` | 5 → 6 | lift |
| Rally | `rallyRev` | 6 → 7 | lift |
| Meteor | `snakeRev` | 6 → 7 | lift |
| Swish | `binRev` | 4 → 5 | spinner 21 px (was 24) + lift |
| Scrumper | `snipRev` | 7 → 8 | lift |
| Hover | `hoverRev` | 5 → 6 | lift |
| High Rise | `skylineRev` | 4 → 5 | lift |
| Breaker | `brkRev` | 6 → 7 | lift |
| Tilt | `tiltRev` | 4 → 5 | lift |
| Orbit | `orbitRev` | 8 → 9 | lift |
| Tempo | `beatRev` | 6 → 7 | lift |
| Slice | `sliceRev` | 6 → 7 | lift |
| Fission | `burstRev` | 4 → 5 | lift |
| Grappler | `swingRev` | 9 → 10 | lift |
| Flightpath | `bullRev` | 4 → 5 | lift |
| Pinball | `pinRev` | 1 → 2 | lift |
| Nucleus | `wordsmithRev` | none → 1 | `WORDSMITH_V1_CURVE` on word points |
| Forage | `wordHuntRev` | none → 1 | `WORDHUNT_V1_CURVE` on word points |
| Bonk | `whackRev` | none → 1 | `WHACK_TARGET_LIFT` on the total |

How it is built: a lifted state carries `band: 2` from its first tick (`bandTargetGame`), and each sim's breakdown scores
on `bandCurveOf(state, curve)`, which is the curve itself on `band: 1` states and `bandRetarget(curve)` on `band: 2`
ones. The phone's HUD, the server replay and the reveal all read the same breakdown. `src/lib/arcade/liveBands.ts` lists
each lifted curve as the game's newest `<GAME>_V<n>_BAND_CURVE`, so the "?" help's numbers follow it; the help's "good
run" is now 120 points (`BAND_GOOD_POINTS`, was 100), at the same units as before. Practice bests start fresh on the new
stamps (`practiceStamps.data.ts` rebuilt).

### Arcade games

Medians from `bun scripts/arcade-skill-bands.ts --rev=now --seeds=40` (40 room seeds per level, every run through the
server's own encode + replay; none flagged or disagreeing), before (the revision rooms dealt on 17 Oct) → after (the
new revision). Target per level: average 90–110, good 110–130, great 130–140, near-perfect 140–150.

| Game | Before: avg / good / great / near | After | Verdict after |
|---|---|---|---|
| Ball Tracker | 66 / 100 / 130 / 134 | 94 / 120 / 137 / 138 | on target (near a little low) |
| Wavefront | 69 / 118 / 118 / 140 | 111 / 128 / 128 / 140 | on target; eased as asked (average at the top of its band) |
| Roofbound | 80 / 146 / 147 / 150 | 107 / 148 / 149 / 150 | **borderline: good too generous** (below) |
| Rainbow Bridge | 34 / 51 / 67 / 93 | 50 / 73 / 92 / 115 | **borderline: bots under-rate it** (below) |
| Gemstone | 68 / 82 / 98 / 106 | 97 / 108 / 118 / 123 | **borderline: bots under-rate it** (below) |
| Coral Pop | 66 / 100 / 125 / 138 | 94 / 120 / 135 / 139 | on target |
| Jaywalk | 68 / 96 / 127 / 145 | 97 / 117 / 136 / 145 | on target |
| Rally | 66 / 100 / 142 / 142 | 96 / 120 / 142 / 142 | on target |
| Meteor | 70 / 105 / 125 / 142 | 100 / 123 / 135 / 142 | on target |
| Swish | 76 / 100 / 130 / 138 | 100 / 122 / 133 / 139 | on target (shorter spinner included) |
| Scrumper | 73 / 110 / 134 / 137 | 102 / 125 / 138 / 139 | on target |
| Hover | 63 / 86 / 120 / 123 | 90 / 109 / 131 / 133 | **borderline: near-perfect low** (below) |
| High Rise | 72 / 97 / 122 / 145 | 101 / 118 / 133 / 145 | on target |
| Breaker | 72 / 96 / 125 / 138 | 101 / 117 / 135 / 139 | on target |
| Tilt | 75 / 98 / 130 / 127 | 103 / 119 / 136 / 136 | on target (near-perfect bots fall chasing hole stars, as before) |
| Orbit | 70 / 100 / 129 / 136 | 100 / 120 / 136 / 138 | on target |
| Tempo | 74 / 114 / 140 / 149 | 102 / 128 / 140 / 149 | on target (Joe's kinder Tempo kept) |
| Slice | 70 / 101 / 122 / 137 | 96 / 121 / 128 / 137 | on target (great a touch low) |
| Fission | 69 / 106 / 133 / 132 | 99 / 128 / 144 / 144 | **borderline: great high** (below) |
| Grappler | 68 / 99 / 124 / 132 | 96 / 119 / 134 / 137 | on target |
| Flightpath | 68 / 100 / 121 / 142 | 97 / 120 / 132 / 143 | on target |
| Pinball | 68 / 95 / 120 / 142 | 97 / 117 / 132 / 143 | on target |
| Junction (practice only) | 81 / 109 / 115 / 140 | unchanged | not dealt in rooms; left on its curve |

### Puzzle games

Medians from `bun scripts/puzzle-fairness.ts --seeds=30` (the kits on 30 room puzzles, graded by the server's own
`gradeAnswer`); Nucleus, Forage and Bonk after their change. "Off" is how far a level sits outside its band.

| Game | avg / good / great / near | Verdict | Changed |
|---|---|---|---|
| Interlock | 51 / 137 / 150 / 150 | steep (avg −39, great +10) | no |
| Slider | 145 / 146 / 150 / 150 | **generous** (avg +35, good +16) | no — Joe |
| Lookout | 121 / 147 / 150 / 150 | generous (good +17) | no — Joe |
| Roundabout | 72 / 102 / 143 / 150 | low (avg −18, good −8) | no |
| Strikeout | 97 / 140 / 146 / 147 | good +10 | no (Joe's rev 3, 15 Oct) |
| Cryptogrid | 89 / 143 / 150 / 150 | good +13 | no |
| Swapword | 132 / 149 / 150 / 150 | **generous** (avg +22, good +19) | no — Joe |
| Exact | 47 / 143 / 150 / 150 | steep (avg −43, good +13) | no |
| Operator | 85 / 143 / 150 / 150 | good +13 | no |
| Counterweight | 70 / 126 / 142 / 150 | avg −20 | no |
| Integer Pyramid | 52 / 80 / 106 / 136 | **low at every level** | no — Joe (below) |
| Trail | 66 / 131 / 146 / 150 | avg −24 | no |
| Brimful | 48 / 110 / 144 / 150 | avg −42 | no |
| Checkout | 46 / 100 / 144 / 150 | avg −44, good −10 | no |
| Ballpark | 72 / 105 / 126 / 142 | avg −18 | no |
| Tenfall | 97 / 128 / 135 / 137 | on target | no |
| Ascend | 61 / 126 / 145 / 150 | avg −29 | no |
| Don't Break the Chain | 20 / 82 / 135 / 150 | **low** (avg −70, good −28) | no — Joe (below) |
| Mixed Signals | 70 / 100 / 134 / 144 | avg −20, good −10 | no |
| Eagle Eye | 66 / 103 / 135 / 150 | avg −24 | no |
| Double Take | 73 / 136 / 148 / 150 | avg −17 | no |
| Tally | 49 / 92 / 150 / 150 | **low then generous** (avg −41, good −18, great +10) | no — Joe (below) |
| Labyrinth | 57 / 107 / 136 / 146 | avg −33 | no |
| Matchmaker | 79 / 146 / 150 / 150 | good +16 | no |
| Gridlock | 50 / 141 / 148 / 150 | steep (avg −40, good +11) | no |
| Tessellate | 69 / 125 / 142 / 150 | avg −21 | no |
| Skid | 61 / 138 / 146 / 150 | avg −29 | no |
| Topsy-Turvy | 37 / 137 / 148 / 150 | steep (avg −53) | no |
| Jumbled | 30 / 138 / 148 / 150 | steep (avg −60) | no |
| Turntable | 15 / 146 / 150 / 150 | steep (avg −75, good +16) | no |
| Lightbender | 22 / 133 / 147 / 150 | steep (avg −68) | no |
| Pipeline | 51 / 124 / 138 / 149 | avg −39 | no |
| Blackout | 23 / 133 / 146 / 150 | steep (avg −67) | no |
| Box Six | 58 / 113 / 140 / 150 | avg −32 | no |
| Chroma Lines | 70 / 134 / 147 / 150 | avg −20 | no |
| Heave | 73 / 144 / 150 / 150 | good +14 | no |
| Hanoi | 36 / 140 / 149 / 150 | steep (avg −54, good +10) | display only (slimmer rings) |
| Polypotions | 24 / 139 / 148 / 150 | steep (avg −66) | no |
| Safe Cracker | 0 / 147 / 150 / 150 | all or nothing (avg −90, good +17) | no |
| Bomb Defusal | 125 / 150 / 150 / 150 | **generous** (avg +15, good +20) | no — Joe |
| Mosaic | 91 / 146 / 150 / 150 | good +16 | no |
| Colour Flood | 96 / 146 / 150 / 150 | good +16 | no |
| Tents and Trees | 60 / 131 / 149 / 150 | avg −30 | no |
| Shikaku | 51 / 122 / 141 / 150 | avg −39 | no |
| Lamplighter | 62 / 131 / 148 / 150 | avg −28 | no |
| **Nucleus** | 22 / 57 / 85 / 137 → **83–95 / 122 / 135 / 145** | was far too harsh | **yes, `wordsmithRev 1`** |
| **Forage** | 16 / 30 / 48 / 72 → **78–95 / 120 / 135 / 145** | was far too harsh | **yes, `wordHuntRev 1`** |
| Letterfall | 105 / 150 / 150 / 150 | good +20 | no |
| Flash | 70 / 104 / 127 / 144 | avg −20 | no — Joe tuned it down on 14 Oct (below) |
| Bang On | 109 / 119 / 129 / 133 | near −7 | no |
| **Bonk** | 62 / 102 / 118 / 133 → **99 / 120 / 135 / 145** | was low at every level | **yes, `whackRev 1`** |
| Pull! | 88 / 125 / 150 / 150 | great +10 | no |

Nucleus and Forage, word points per level (`bun scripts/word-open-bands.ts --seeds=40`): Nucleus 10 / 23 / 34 / 55,
Forage 9 / 15 / 24 / 36. The curves put those at 95 / 122 / 135 / 145 and 95 / 120 / 135 / 145, top out where the
old formulas did (Nucleus 150 at 60 points, Forage at 48 by the curve; never below the old formula for the same
points), and keep the first few points cheap so random letters stay low (Nucleus random 4-letter tries median 8, was 5;
Forage random paths median 10, was 8; the luckiest random runs now reach about 80, so a careless player is paid a
little more than before — the price of a steeper early curve). Average players' range (p10–p90) is about 72–107 and
61–99. The puzzle-fairness run (seeds 5001–5030) puts their averages at 83 and 78, the 40-seed run at 95 and 95.

### For Joe to rule on

Proposed changes I did not make (each would be a new stamp, as above):

1. **The puzzle score shape (all finish puzzles).** Average kits score 15–70 in most puzzles (they run out of time),
   while good and great kits score 140–150. Against the targets the shape is too steep at both ends. Proposal:
   `puzzleScoreRev 2` with (a) unfinished credit lifted, e.g. 110 × (credit ÷ 110)^0.65 so half done ≈ 70 instead
   of 55, still at most 110 so every finish beats every unfinished run; and (b) the speed part's full 30 only with at
   least two thirds of the clock left (was a half), so a good finish lands nearer 130 than 150. I left it because it moves
   45 games at once and the kits' think times are per-game estimates, less trustworthy than the arcade bots; best
   decided with your own phone runs on a few puzzles first.
2. **Integer Pyramid** (52 / 80 / 106 / 136): good kits finish 0 of 30 in 120 s. Proposal: 150 s on new rounds, or
   three pyramids instead of four. A play-time change, so yours to call.
3. **Don't Break the Chain** (20 / 82 / 135 / 150) and **Flash** (70 / 104 / 127 / 144) were tuned down on 14 Oct
   (speed tuning). Proposal: Flash's curve back up by about 15 at the low end; the chain's unfinished credit lifted
   (half the links ≈ 80). Left because they reverse a fresh ruling.
4. **Tally** (49 / 92 / 150 / 150): low then generous (attention rework, 14 Oct). Proposal: near misses worth a little
   more (one off 25 % of the tray, was 15 %), the finish unchanged.
5. **Slider, Swapword, Bomb Defusal, Lookout** (good 146–150): generous at average and good. Proposal: the speed part's
   full 30 only with two thirds of the clock left (item 1b) on these first.
6. **Roofbound** (107 / 148 / 149 / 150 after): good players already score like great ones; most good bots survive the
   minute. Proposal: knots between average and great lowered so good lands about 125 (`flipRev 6`).
7. **Rainbow Bridge** (50 / 73 / 92 / 115) and **Gemstone** (97 / 108 / 118 / 123): the bots under-rate both (they never
   plan bridges or cascades); both were fitted to your own runs (Tuning C and F), and the lift moves your runs from
   103–116 to about 122–130 on Rainbow Bridge. Proposal: play a few rounds of each; if your runs land under 120, lift
   them another 10 % (`inkRev 8`, `matchupRev 8`).
8. **Hover** near-perfect 133 and **Fission** great 144: small. Proposal: Hover's top knots up a few points, Fission's
   middle knots down a few (`hoverRev 7`, `burstRev 6`).

### Assumptions

- The four simulated levels map onto the target bands in order (average → 90–110, good → 110–130, great → 130–140,
  near-perfect → 140–150), as the October bands mapped them onto 70 / 100 / 125 / 140.
- "Clearly off" for an arcade game meant its median sitting outside the band at two or more levels; every arcade game
  was (about 25–30 low at average), so all of them moved, with one shared lift so each keeps its own calibration.
  Junction is practice-only and stays on its curve.
- For puzzles I changed only the three games that were low at every level (Nucleus, Forage, Bonk); the rest are a shared
  shape question or reverse rulings from the last week, so they are listed above instead.
- Swish's "10–15 % shorter": 12.5 % (24 → 21 px half-length; same pivot, thickness and speed). The art draws the sim's
  own bar ends, so what you see is still what the ball bounces off.
- Hanoi: rings 9–16 px thick on the live board (were 12–30), 4 px apart, flat pills with a soft top light and a crisp rim;
  posts thinner to match. The tap targets are the posts (full-height, equal-width columns, about 85 px wide on a 390 px
  phone), unchanged. Display only, so no stamp.

### Checks

- `scripts/scoring-targets-check.ts` (new, ~5 s): the lift's anchors and that it never lowers a score; every lifted
  curve keeps its units and top and never scores below its previous curve; rooms deal every new revision; older
  revisions keep `band: 1`; 176 bot runs recorded on the new revisions (`scripts/fixtures/scoring-targets-runs.json.gz`)
  replay unflagged and, on the previous revision, end in the identical state and never score more; Swish's 21 px bar on
  the same pivot; Nucleus, Forage and Bonk stamps, curves, graders and the server replay; Hanoi's posts.
- Older checks that pinned "rooms deal revision N" now compare the dealt stamp through `playRevOf`
  (`scripts/scoring-targets-revs.ts`), so they keep proving the play they were written for; their legacy replays are
  unchanged. The "?" help checks read 120 points for a good run.
- Tools: `bun scripts/arcade-skill-bands.ts --rev=now` measures the revisions rooms deal today;
  `bun scripts/word-open-bands.ts` measures Nucleus and Forage word points.

