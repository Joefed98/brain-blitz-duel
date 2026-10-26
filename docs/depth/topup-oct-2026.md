# Puzzle top-up to the 200-point bar (26 Oct 2026)

The depth batches (#157 word, #158 pattern, #159 logic, #160 speed and attention) raised the puzzles to 200. The
merge-night report showed many of them with near-perfect play under the bar. This top-up measured every one of them
again, on each batch's own tuning seeds and on 40 fresh seeds no tuning saw, and retuned the ones outside the bar,
each under a new version stamp (one above its live stamp). Puzzles only: no arcade game changed (Mixed Signals and
Pull!, engine games on the arcade stage, were in the brief; Pull! passed unchanged).

## The bar

On tuning seeds and on fresh seeds:

- good-level median within about ±10 % of before;
- near-perfect median 165–175 for feature games, 150–165 for stretch-only games (Interlock, Cryptogrid, Eagle Eye,
  Tally, Box Six, Colour Flood, Shikaku, Tessellate, Chroma Lines…), its top 10 % at or under about 185;
- elite: top 10 % 190–200, median at least about 175;
- no zero scores for weak-but-trying or average play; random play stays near 0;
- features pay a modest fixed amount, full value only at elite pace, on top of the base scoring.

## How it was measured

`bun scripts/depth-topup-bands.ts [types…] [--fresh=40] [--tuning] [--old] [--json=<file>]` plays each batch's own
simulated players (the puzzle-fairness kits at average, good, great and near-perfect, and each batch's own elite
player: `depth-speed-lib`, `depth-attention-lib`, `depth/chain-pair-bots`, `depth-engine-bands`,
`depth-word-bands`, `depth-d6-bands`, `depth4/players`) through the real `gradeAnswer`, on the batch's tuning seeds
(`tuningSeeds`) and on fresh seeds (`freshSeeds`, 913,337 + 7,919 k). `--old` deals the stamps rooms dealt before
the top-up (`pinPreTopup`, src/lib/duel/depthTopup.ts). Random play is each kit's spam answers. "Top 10 %" is the
90th percentile.

## What changed (one new stamp per game)

Every new rule is gated on its stamp; older stamps grade exactly as before (depth-topup-check regrades 5,160
cases recorded on main 6b42ef3). Boards, play, logs and replays are unchanged: the new stamps deal the same puzzle.

| Game | Stamp | Change |
| --- | --- | --- |
| Flash | `tapRev` 5 → 6 | curve higher from 180 ms down (`FLASH_REV6_CURVE`: 150 ms 168, 120 ms 186); a floor of 2 per flash hit within 800 ms |
| Bang On | `tapRev` 5 → 6 | dead centre +3 (was 2); streak +2, +3, +4, then +5 a watch (was +1…+4); features at most 50; a floor of 2 per watch stopped within 100 ms |
| Don't Break the Chain | `chainDepthRev` 1 → 2 | 150 at 46 % of the clock left (was 53 %), the stretch from there; milestones in full at 0.45 s a link (none at 0.7 s) |
| Mixed Signals | `clashRev` 8 → 9 | clashRev 8's play and checkpoints exactly; gold and streak points keep 30 % at any finishing time and fade to that at 45 s (was all of it gone at 40 s) |
| Eagle Eye | `scanRev` 2 → 3 | the climb starts at 45 % of the clock left (rev 3's speed part unchanged), power 1.3 |
| Tally | `countRev` 3 → 4 | the climb starts at 57 % of the clock left (rev 3's speed part unchanged), power 1.2 |
| Nucleus | `wordsmithRev` 3 → 4 | the word-points curve a little steeper above 45 points (60 → 153, 80 → 164, 105 → 174, 180 at 140) |
| Interlock | `tileGridRev` 1 → 2 | the pace bonus from 66 % of the clock left to 80 % (was 72 % to 84 %), power 1.3 |
| Slider | `wordSlideRev` 1 → 2 | making par pays 9 at any pace (was 6) |
| Forage | `wordHuntRev` 3 → 4 | base curve reaches 150 at 60 points (44 → 140); the extras' curve a little higher (27 → 15, 48 → 27, 89 → 40, 50 at 120) |
| Strikeout | `strikeoutRev` 5 → 6 | pace (25) rises evenly from 45 % to 85 % of the clock left; early solves (25) × the time left from 25 % to 85 % |
| Swapword | `swapwordRev` 4 → 5 | making par pays 15 at any pace (was 6) |
| Roundabout | `wheelRev` 2 → 3 | the bonus jar pays 50 × fill^0.8 (a half jar 29) |
| Safe Cracker | `depthRev` 1 → 2 | 150 at 70 % of the clock left; a clean crack adds 15 (in full from 65 % left, none at 50 %) plus up to 35 on the stretch to 82 %; a try keeping all but one or two clues earns progress |
| Box Six | `depthRev` 1 → 2 | 150 at 50 % of the clock left (was 59 %), the stretch from there (power 1.3) |
| Colour Flood | `depthRev` 1 → 2 | the curve unchanged; a board run out of moves keeps 0.25 × flooded share⁶ of progress (no more 0 for a near-solved board) |
| Shikaku | `depthRev` 1 → 2 | 150 at 52 % of the clock left (was 58 %), the stretch from there (power 1.3) |
| Tessellate | `blockRev` 1 → 2 | the stretch from 55.5 % of the clock left (was 59 %) |
| Pipeline | `pipesRev` 1 → 2 | the stretch and the par feature's pace from 43 % of the clock left (was 49 %) |
| Lightbender | `laserRev` 1 → 2 | the stretch and the elegant-beam pace from 55 % (was 63 %); pieces placed as the solution has them earn progress (up to 0.4) |
| Turntable | `ringsRev` 1 → 2 | the stretch and the par pace from 72 % (was 77 %); a wasted turn cancels 0.3 of a good one (was 1) in progress |
| Heave | `pushRev` 1 → 2 | the gold crate pays 20 at today's 150 pace (was 15), 50 at elite pace as before |

Passing unchanged (no new stamp): Pull!, Cryptogrid, Chroma Lines. Left unchanged and reported: Lookout (below).

## Exceptions

- **Lookout** is left unchanged. Its only route past 150 is the hidden bonus word, which the near-perfect kit finds
  in under half its runs (the kit's spotting chance at that pace is about 0.47), so the near-perfect median is the
  not-found finish, 150, on both seed sets (top 10 % 167–168, elite 182 / 194–195). Lifting the median to 165 would
  mean paying a finish without the feature, which turns it into a stretch game: a design decision for Joe, not a
  tuning.
- **Safe Cracker**: one fresh-seed average run in 40 still scores 0 (it runs out of time before its first try, with
  one dial set right: a guess's worth). Before the top-up 4 of 12 tuning and 7 of 40 fresh average runs scored 0.
- **Interlock**: one tuning-seed average run in 40 scores 0 (no real word on the grid at the buzzer), as before the
  top-up; fresh seeds have none.
- Random play: Flash's spam top 10 % 0 → 8–10 (the floor), Bang On's 2 → 6, Colour Flood's 0 → 15 (colour cycling
  that runs out of moves near the end of the board); every median stays where it was.
- Bang On's and Swapword's good medians rose 3–6 % (good players make the zone streak or par too); the rest moved
  0–2 %.

## Checks

- `depth-topup-check` (~95 s, in halves on CI shards a and b): the legacy fixture
  (`scripts/fixtures/depth-topup-legacy.json.gz`, `scripts/depth-topup-record.ts`) grades identically; rooms deal
  every new stamp and the board dealt before; Mixed Signals' clashRev 9 plays clashRev 8; the bar on 40 fresh seeds.
- The batch checks (depth-flash, -bangon, -chain, -mixedsignals, -eagleeye, -tally, -wordsmith, -tilegrid,
  -wordslide, -wordhunt, -strikeout, -swapword, -letterwheel, -d6, depth4) and scoring-bands-check keep proving the
  stamps they were written for: new deals pinned with `pinPreTopup(true)`.
- `scripts/fixtures/replay-runs.json` gained a Mixed Signals run on clashRev 9 (`bun scripts/replay-fixtures.ts
  --add=stroop`); practice stamps regenerated (`bun scripts/practice-stamps.ts`, 22 games).

## Results (median, old median in brackets; tuning and fresh seeds)

#### Flash (`reaction`): tapRev 5 → 6

| Seeds | Average | Good | Near-perfect median / top 10 % | Elite median / top 10 % | Zeros (average / good) | Random median / top 10 % |
| --- | --- | --- | --- | --- | --- | --- |
| Tuning (80) | 73 [73] | 107 [107] | 165 / 180 [152] | 196 / 199 [191] | 0 / 0 [6 / 0] | 0 / 10 [0 / 0] |
| Fresh (40) | 73 [73] | 103 [103] | 168 / 179 [154] | 196 / 199 [191] | 0 / 0 [1 / 0] | 0 / 8 [0 / 0] |

#### Don't Break the Chain (`chain`): chainDepthRev 1 → 2

| Seeds | Average | Good | Near-perfect median / top 10 % | Elite median / top 10 % | Zeros (average / good) | Random median / top 10 % |
| --- | --- | --- | --- | --- | --- | --- |
| Tuning (40) | 20 [20] | 82 [82] | 169 / 175 [158] | 195 / 200 [191] | 0 / 0 [0 / 0] | 0 / 0 [0 / 0] |
| Fresh (40) | 20 [20] | 82 [82] | 166 / 175 [156] | 197 / 200 [194] | 0 / 0 [0 / 0] | 0 / 0 [0 / 0] |

#### Mixed Signals (`stroop`): clashRev 8 → 9

| Seeds | Average | Good | Near-perfect median / top 10 % | Elite median / top 10 % | Zeros (average / good) | Random median / top 10 % |
| --- | --- | --- | --- | --- | --- | --- |
| Tuning (60) | 70 [70] | 97 [97] | 167 / 184 [154] | 193 / 198 [193] | 0 / 0 [0 / 0] | 0 / 0 [0 / 0] |
| Fresh (40) | 70 [70] | 100 [100] | 167 / 182 [151] | 192 / 197 [192] | 0 / 0 [0 / 0] | 0 / 0 [0 / 0] |

#### Eagle Eye (`symscan`): scanRev 2 → 3

| Seeds | Average | Good | Near-perfect median / top 10 % | Elite median / top 10 % | Zeros (average / good) | Random median / top 10 % |
| --- | --- | --- | --- | --- | --- | --- |
| Tuning (40) | 74 [74] | 108 [108] | 154 / 169 [149] | 193 / 200 [182] | 0 / 0 [0 / 0] | 0 / 4 [0 / 4] |
| Fresh (40) | 75 [75] | 108 [108] | 154 / 166 [148] | 194 / 198 [183] | 0 / 0 [0 / 0] | 0 / 5 [0 / 5] |

#### Tally (`countup`): countRev 3 → 4

| Seeds | Average | Good | Near-perfect median / top 10 % | Elite median / top 10 % | Zeros (average / good) | Random median / top 10 % |
| --- | --- | --- | --- | --- | --- | --- |
| Tuning (40) | 81 [81] | 88 [88] | 155 / 169 [146] | 198 / 200 [195] | 0 / 0 [0 / 0] | 6 / 47 [6 / 47] |
| Fresh (40) | 71 [71] | 110 [110] | 154 / 175 [146] | 199 / 200 [197] | 0 / 0 [0 / 0] | 6 / 47 [6 / 47] |

#### Bang On (`stopwatch`): tapRev 5 → 6

| Seeds | Average | Good | Near-perfect median / top 10 % | Elite median / top 10 % | Zeros (average / good) | Random median / top 10 % |
| --- | --- | --- | --- | --- | --- | --- |
| Tuning (80) | 78 [76] | 114 [110] | 169 / 182 [161] | 190 / 197 [178] | 0 / 0 [4 / 0] | 0 / 6 [0 / 2] |
| Fresh (40) | 88 [85] | 118 [114] | 165 / 179 [157] | 187 / 197 [176] | 0 / 0 [2 / 0] | 0 / 6 [0 / 2] |

#### Pull! (`clayshoot`): unchanged (no new stamp)

| Seeds | Average | Good | Near-perfect median / top 10 % | Elite median / top 10 % | Zeros (average / good) | Random median / top 10 % |
| --- | --- | --- | --- | --- | --- | --- |
| Tuning (40) | 72 [72] | 97 [97] | 166 / 174 [166] | 184 / 190 [184] | 0 / 0 [0 / 0] | 0 / 0 [0 / 0] |
| Fresh (40) | 75 [75] | 96 [96] | 166 / 175 [166] | 186 / 190 [186] | 0 / 0 [0 / 0] | 0 / 0 [0 / 0] |

#### Nucleus (`wordsmith`): wordsmithRev 3 → 4

| Seeds | Average | Good | Near-perfect median / top 10 % | Elite median / top 10 % | Zeros (average / good) | Random median / top 10 % |
| --- | --- | --- | --- | --- | --- | --- |
| Tuning (40) | 70 [70] | 101 [101] | 166 / 183 [161] | 184 / 197 [172] | 0 / 0 [0 / 0] | 2 / 14 [2 / 14] |
| Fresh (40) | 72 [72] | 110 [110] | 166 / 184 [161] | 185 / 197 [173] | 0 / 0 [0 / 0] | 2 / 14 [2 / 14] |

#### Interlock (`tilegrid`): tileGridRev 1 → 2

| Seeds | Average | Good | Near-perfect median / top 10 % | Elite median / top 10 % | Zeros (average / good) | Random median / top 10 % |
| --- | --- | --- | --- | --- | --- | --- |
| Tuning (40) | 86 [86] | 132 [132] | 155 / 172 [149] | 195 / 200 [171] | 1 / 0 [1 / 0] | 0 / 0 [0 / 0] |
| Fresh (40) | 86 [86] | 132 [132] | 151 / 172 [148] | 190 / 200 [166] | 0 / 0 [0 / 0] | 0 / 0 [0 / 0] |

#### Slider (`wordslide`): wordSlideRev 1 → 2

| Seeds | Average | Good | Near-perfect median / top 10 % | Elite median / top 10 % | Zeros (average / good) | Random median / top 10 % |
| --- | --- | --- | --- | --- | --- | --- |
| Tuning (40) | 137 [137] | 159 [156] | 165 / 184 [162] | 185 / 200 [183] | 0 / 0 [0 / 0] | 0 / 30 [0 / 30] |
| Fresh (40) | 135 [135] | 159 [156] | 168 / 186 [166] | 182 / 200 [181] | 0 / 0 [0 / 0] | 0 / 30 [0 / 30] |

#### Forage (`wordhunt`): wordHuntRev 3 → 4

| Seeds | Average | Good | Near-perfect median / top 10 % | Elite median / top 10 % | Zeros (average / good) | Random median / top 10 % |
| --- | --- | --- | --- | --- | --- | --- |
| Tuning (40) | 64 [64] | 101 [101] | 167 / 184 [155] | 190 / 200 [187] | 0 / 0 [0 / 0] | 0 / 0 [0 / 0] |
| Fresh (40) | 64 [64] | 103 [103] | 167 / 178 [155] | 189 / 200 [186] | 0 / 0 [0 / 0] | 0 / 0 [0 / 0] |

#### Lookout (`wordsearch`): unchanged (no new stamp)

| Seeds | Average | Good | Near-perfect median / top 10 % | Elite median / top 10 % | Zeros (average / good) | Random median / top 10 % |
| --- | --- | --- | --- | --- | --- | --- |
| Tuning (40) | 120 [120] | 139 [139] | 150 / 167 [150] | 182 / 194 [182] | 0 / 0 [0 / 0] | 0 / 0 [0 / 0] |
| Fresh (40) | 122 [122] | 140 [140] | 150 / 168 [150] | 182 / 195 [182] | 0 / 0 [0 / 0] | 0 / 9 [0 / 9] |

#### Strikeout (`strikeout`): strikeoutRev 5 → 6

| Seeds | Average | Good | Near-perfect median / top 10 % | Elite median / top 10 % | Zeros (average / good) | Random median / top 10 % |
| --- | --- | --- | --- | --- | --- | --- |
| Tuning (40) | 79 [79] | 127 [127] | 167 / 184 [157] | 182 / 193 [169] | 0 / 0 [0 / 0] | 17 / 22 [17 / 22] |
| Fresh (40) | 79 [79] | 126 [126] | 165 / 183 [155] | 181 / 191 [167] | 0 / 0 [0 / 0] | 17 / 33 [17 / 33] |

#### Cryptogrid (`codeword`): unchanged (no new stamp)

| Seeds | Average | Good | Near-perfect median / top 10 % | Elite median / top 10 % | Zeros (average / good) | Random median / top 10 % |
| --- | --- | --- | --- | --- | --- | --- |
| Tuning (40) | 105 [105] | 138 [138] | 150 / 167 [150] | 179 / 197 [179] | 0 / 0 [0 / 0] | 0 / 0 [0 / 0] |
| Fresh (40) | 96 [96] | 137 [137] | 149 / 166 [149] | 175 / 197 [175] | 0 / 0 [0 / 0] | 0 / 0 [0 / 0] |

#### Swapword (`swapword`): swapwordRev 4 → 5

| Seeds | Average | Good | Near-perfect median / top 10 % | Elite median / top 10 % | Zeros (average / good) | Random median / top 10 % |
| --- | --- | --- | --- | --- | --- | --- |
| Tuning (40) | 121 [121] | 153 [144] | 167 / 175 [158] | 184 / 192 [180] | 0 / 0 [0 / 0] | 21 / 51 [21 / 51] |
| Fresh (40) | 124 [124] | 139 [139] | 166 / 171 [158] | 183 / 193 [178] | 0 / 0 [0 / 0] | 22 / 48 [22 / 48] |

#### Roundabout (`letterwheel`): wheelRev 2 → 3

| Seeds | Average | Good | Near-perfect median / top 10 % | Elite median / top 10 % | Zeros (average / good) | Random median / top 10 % |
| --- | --- | --- | --- | --- | --- | --- |
| Tuning (40) | 84 [81] | 111 [109] | 167 / 174 [163] | 197 / 200 [197] | 0 / 0 [0 / 0] | 0 / 0 [0 / 0] |
| Fresh (40) | 84 [81] | 111 [110] | 167 / 172 [163] | 196 / 200 [196] | 0 / 0 [0 / 0] | 0 / 0 [0 / 0] |

#### Safe Cracker (`safe`): depthRev 1 → 2

| Seeds | Average | Good | Near-perfect median / top 10 % | Elite median / top 10 % | Zeros (average / good) | Random median / top 10 % |
| --- | --- | --- | --- | --- | --- | --- |
| Tuning (12) | 78 [78] | 139 [138] | 169 / 178 [149] | 180 / 199 [194] | 0 / 0 [4 / 0] | 0 / 43 [0 / 43] |
| Fresh (40) | 110 [110] | 139 [138] | 166 / 183 [149] | 192 / 200 [200] | 1 / 0 [7 / 0] | 0 / 43 [0 / 43] |

#### Box Six (`sudoku`): depthRev 1 → 2

| Seeds | Average | Good | Near-perfect median / top 10 % | Elite median / top 10 % | Zeros (average / good) | Random median / top 10 % |
| --- | --- | --- | --- | --- | --- | --- |
| Tuning (12) | 56 [56] | 123 [122] | 154 / 158 [147] | 195 / 200 [188] | 0 / 0 [0 / 0] | 0 / 0 [0 / 0] |
| Fresh (40) | 63 [63] | 122 [121] | 156 / 168 [147] | 200 / 200 [200] | 0 / 0 [0 / 0] | 0 / 0 [0 / 0] |

#### Colour Flood (`flood`): depthRev 1 → 2

| Seeds | Average | Good | Near-perfect median / top 10 % | Elite median / top 10 % | Zeros (average / good) | Random median / top 10 % |
| --- | --- | --- | --- | --- | --- | --- |
| Tuning (12) | 95 [95] | 134 [134] | 149 / 169 [149] | 187 / 200 [187] | 0 / 0 [0 / 1] | 2 / 15 [0 / 0] |
| Fresh (40) | 94 [94] | 134 [134] | 150 / 170 [150] | 200 / 200 [200] | 0 / 0 [0 / 5] | 2 / 15 [0 / 0] |

#### Shikaku (`shikaku`): depthRev 1 → 2

| Seeds | Average | Good | Near-perfect median / top 10 % | Elite median / top 10 % | Zeros (average / good) | Random median / top 10 % |
| --- | --- | --- | --- | --- | --- | --- |
| Tuning (12) | 60 [60] | 110 [110] | 152 / 165 [148] | 195 / 200 [190] | 0 / 0 [0 / 0] | 0 / 21 [0 / 21] |
| Fresh (40) | 66 [66] | 123 [123] | 159 / 173 [149] | 200 / 200 [200] | 0 / 0 [0 / 0] | 0 / 18 [0 / 18] |

#### Tessellate (`blockparty`): blockRev 1 → 2

| Seeds | Average | Good | Near-perfect median / top 10 % | Elite median / top 10 % | Zeros (average / good) | Random median / top 10 % |
| --- | --- | --- | --- | --- | --- | --- |
| Tuning (40) | 69 [69] | 125 [125] | 154 / 175 [149] | 200 / 200 [200] | 0 / 0 [0 / 0] | 0 / 0 [0 / 0] |
| Fresh (40) | 69 [69] | 125 [125] | 152 / 179 [149] | 199 / 200 [198] | 0 / 0 [0 / 0] | 0 / 0 [0 / 0] |

#### Chroma Lines (`flow`): unchanged (no new stamp)

| Seeds | Average | Good | Near-perfect median / top 10 % | Elite median / top 10 % | Zeros (average / good) | Random median / top 10 % |
| --- | --- | --- | --- | --- | --- | --- |
| Tuning (40) | 79 [79] | 129 [129] | 151 / 163 [151] | 195 / 200 [195] | 0 / 0 [0 / 0] | 11 / 65 [11 / 65] |
| Fresh (40) | 76 [76] | 130 [130] | 150 / 174 [150] | 200 / 200 [200] | 0 / 0 [0 / 0] | 10 / 50 [10 / 50] |

#### Pipeline (`pipes`): pipesRev 1 → 2

| Seeds | Average | Good | Near-perfect median / top 10 % | Elite median / top 10 % | Zeros (average / good) | Random median / top 10 % |
| --- | --- | --- | --- | --- | --- | --- |
| Tuning (40) | 48 [48] | 127 [127] | 166 / 177 [161] | 193 / 196 [191] | 0 / 0 [0 / 0] | 0 / 0 [0 / 0] |
| Fresh (40) | 54 [54] | 127 [127] | 168 / 181 [164] | 193 / 197 [191] | 0 / 0 [0 / 0] | 0 / 0 [0 / 0] |

#### Lightbender (`laser`): laserRev 1 → 2

| Seeds | Average | Good | Near-perfect median / top 10 % | Elite median / top 10 % | Zeros (average / good) | Random median / top 10 % |
| --- | --- | --- | --- | --- | --- | --- |
| Tuning (40) | 31 [14] | 130 [130] | 166 / 181 [160] | 194 / 200 [190] | 0 / 0 [18 / 1] | 0 / 14 [0 / 14] |
| Fresh (40) | 31 [14] | 127 [127] | 166 / 178 [160] | 196 / 200 [194] | 0 / 0 [13 / 0] | 0 / 14 [0 / 14] |

#### Turntable (`rings`): ringsRev 1 → 2

| Seeds | Average | Good | Near-perfect median / top 10 % | Elite median / top 10 % | Zeros (average / good) | Random median / top 10 % |
| --- | --- | --- | --- | --- | --- | --- |
| Tuning (40) | 99 [73] | 141 [141] | 167 / 182 [163] | 195 / 200 [193] | 0 / 0 [2 / 0] | 0 / 0 [0 / 0] |
| Fresh (40) | 75 [48] | 142 [141] | 165 / 183 [164] | 195 / 200 [194] | 0 / 0 [10 / 0] | 0 / 0 [0 / 0] |

#### Heave (`push`): pushRev 1 → 2

| Seeds | Average | Good | Near-perfect median / top 10 % | Elite median / top 10 % | Zeros (average / good) | Random median / top 10 % |
| --- | --- | --- | --- | --- | --- | --- |
| Tuning (40) | 68 [68] | 132 [131] | 167 / 178 [162] | 194 / 200 [192] | 0 / 0 [0 / 0] | 6 / 30 [6 / 30] |
| Fresh (40) | 63 [63] | 130 [130] | 167 / 178 [162] | 194 / 200 [192] | 0 / 0 [0 / 0] | 5 / 25 [5 / 25] |
