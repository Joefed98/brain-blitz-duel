# D6: Logic depth to 200 (25 Oct 2026)

Eleven Logic games score to 200 on puzzles stamped **`depthRev: 1`**: Blackout, Box Six, Hanoi, Polypotions, Safe
Cracker, Bomb Defusal, Mosaic, Colour Flood, Tents and Trees, Shikaku and Lamplighter. Their `ROUND_MAX` lines are
200 (`src/lib/duel/roundMax.ts`, docs/scoring-200.md). Puzzles dealt before carry no `depthRev` and grade exactly as
before (proved by `depth-d6-check` on 2,074 rounds recorded on main).

## The rule

Every finish starts from `puzzleScoreRev 3`: **120 + 30 × min(1, time left ÷ fast) × efficiency** (efficiency is the
game's own mistake measure). Unfinished rounds keep rev 3's progress score (up to 110). The top 50 comes from one of
three routes (`src/lib/duel/logicDepth.ts`):

| Route | Games | The extra 50 |
| --- | --- | --- |
| Stretch | Box Six, Bomb Defusal, Mosaic, Colour Flood, Tents and Trees, Shikaku, Lamplighter | 50 × ((left − fast) ÷ (elite − fast))^power × efficiency²: nothing at today's 150 pace, all of it only at the elite pace with no mistakes. Colour Flood's needs the par moves (half of it one move over). |
| Par | Blackout (par presses), Hanoi (perfect solve), Polypotions (par pours) | Finishing in par (the stored minimum, shown on the board) adds 20 plus up to 30 by the same speed share: par at the fast pace is 200, par at the buzzer 140, one over par at most 150. |
| Clean crack | Safe Cracker | The stretch, scaled by the tries to spare: all of it on the first try, half on the second, none on the third. |

Per game (`DEPTH_GAMES`): `fast` is rev 3's fastShare where the board is unchanged and refitted for the four bigger
boards; `elite` is the elite kit's median time-left share; `power` 1.5 (1.8 for Box Six, Mosaic and Shikaku, whose
150s ran close to elite).

| Game | Route | fast | elite | power | 150 by | 200 by |
| --- | --- | --- | --- | --- | --- | --- |
| Blackout | Par | 0.66 | – | – | 25 s of 75 | par in 25 s |
| Hanoi | Par | 0.69 | – | – | 28 s of 90 | par in 28 s |
| Polypotions | Par | 0.67 | – | – | 30 s of 90 | par in 30 s |
| Safe Cracker | Clean crack | 0.74 | 0.79 | 1.5 | 20 s of 75 | 16 s, first try |
| Box Six | Stretch | 0.59 | 0.69 | 1.8 | 37 s of 90 | 28 s |
| Bomb Defusal | Stretch | 0.75 | 0.85 | 1.5 | 23 s of 90 | 14 s |
| Mosaic | Stretch | 0.65 | 0.77 | 1.8 | 42 s of 120 | 28 s |
| Colour Flood | Stretch | 0.73 | 0.79 | 1.5 | 16 s of 60 | 13 s at par |
| Tents and Trees | Stretch | 0.64 | 0.75 | 1.5 | 32 s of 90 | 23 s |
| Shikaku | Stretch | 0.58 | 0.69 | 1.8 | 38 s of 90 | 28 s |
| Lamplighter | Stretch | 0.58 | 0.72 | 1.5 | 38 s of 90 | 25 s |

The stored breakdown adds up to the score: the par bonus and the clean crack are the efficiency term with their own
label ("120 + 45 par + 30 speed"); the stretch rides in the speed term ("120 + 64 speed"). `extra.depth` keeps
`{ top, speed, atPar?, par? }` and `extra.rev3Score` the rev-3 score of the same finish.

## Features (drawn in the games' current polished style)

- **Par line** (Blackout, Hanoi, Polypotions): the live summary under the board reads "Presses 6 · Par 12" (Moves,
  Pours) with a slim 56 × 4 px bar whose gold marker sits at par; the fill grows with each move and turns warn red
  past par (`src/components/puzzles/depth/ParMeter.tsx`, `src/polish-depth-d6/depth-d6.css`). One fixed-width item in
  the fixed 20 px summary line: nothing moves when a figure changes, nothing animates. Polypotions keeps its pour limit
  beside it ("Pours 12 / 30 · Par 24"). The reveals say "par" for "min"; Hanoi's says "perfect solve · par n" when
  earned.
- **Public par**: Blackout and Polypotions puzzles carry `par` (the stored minimum, `logicDepthStamp.server.ts`); Hanoi's
  `minMoves` was always public. *Assumption*: showing par is the feature, so the minimum is no longer hidden on these two
  (Polypotions' pour limit stays rounded to a multiple of 5 as before).
- **Clean crack** (Safe Cracker): the door's line reads "tries left 3 · clean crack" while opening now would keep a try
  spare; the reveal adds "· clean crack".

## Bigger boards (under `depthRev 1`)

| Game | Before | Now | Generation | Cells at 375 px |
| --- | --- | --- | --- | --- |
| Mosaic | 7 × 7, 18–30 filled | 8 × 8, 22–36 filled | random picture, unique clues (`countNonoSolutions`) | 40 px |
| Tents and Trees | 8 × 8, 11–12 pairs | 8 wide × 9 tall, 12–13 pairs, a third of the 17 counts hidden | unique layout (`countTentSolutions`) | 42 px |
| Shikaku | 10 × 10, 18–22 rectangles | 10 wide × 11 tall, 17–21 rectangles | unique partition (`countShikakuSolutions`) | 37 px (as before) |
| Lamplighter | 9 × 9, 18–23 walls | 9 wide × 10 tall, 20–25 walls | unique layout; the 1,000-board bank rebuilt (`bun scripts/lightup-bank.ts`) | 41 px |

- *Assumption*: Tents was already 8 × 8, so "a larger field (about 8 × 8)" is 8 × 9; Shikaku and Lamplighter grow a
  row. Growing the width would shrink every cell (Shikaku's 10 columns are 36.7 px at 375 px already and cannot reach
  40 px), so the three grow taller: the cells keep their width and the boards use the slack above and below them.
- The round's clock is unchanged; each round is still one board, so the bigger boards are only a little bigger
  (Shikaku deals 17–21 rectangles where it dealt 18–22, Mosaic's filled share is a little lower, Tents has one more pair) and `fast` was refitted on them, so a
  solid player lands about where they did.
- Stored puzzles say their own size: Mosaic's is its clue count (`nonoSizeOf`), the others' a `height` field (absent =
  square, every older board). Shikaku's answer code is now one base-36 character per coordinate: digits as before,
  "a" for row 10; a letter decodes past a square board's edge, so every older answer decodes as before.
- The legacy generators (`generateLegacyNonogram`, `generateLegacyTents`, `generateLegacyShikaku`,
  `generateLightUp(cap, 9)`) keep the old boards' exact draws for the checks; rooms never deal them.
- Board-size check (`bun scripts/shots/frame-probe.ts --compare=scripts/fixtures/board-sizes-main.json`): every board
  at least main's size at 414 × 896 and 375 × 667 (table below).

| Game | 414×896 main | 414×896 branch | 375×667 main | 375×667 branch |
|---|---|---|---|---|
| Blackout | 382×410 | 406×434 | 343×371 | 367×395 |
| Box Six | 406×406 | 406×406 | 367×367 | 367×367 |
| Hanoi | 390×260 | 406×456 | 351×260 | 367×392 |
| Polypotions | 390×648 | 406×648 | 351×449 | 367×475 |
| Safe Cracker | 406×381.5 | 406×407.5 | 367×343.7 | 367×358.7 |
| Bomb Defusal | 406×578 | 406×578 | 367×455 | 367×473 |
| Mosaic | 372.5×382.6 | 406×412.5 | 338.9×348.9 | 367×376.8 |
| Colour Flood | 382×382 | 406×406 | 343×343 | 367×367 |
| Tents and Trees | 382×415 | 406×486.8 | 343×376 | 367×442.9 |
| Shikaku | 382×410 | 406×474 | 343×371 | 367×431.1 |
| Lamplighter | 382×410 | 406×478.7 | 343×371 | 367×435.4 |

("main" is the board-size fixture recorded before polish batch P; today's main is 406 px wide on most of these.)

## Old versus new scores

`bun scripts/depth-d6-bands.ts --seeds=12 --pop=40` plays the puzzle-fairness kits on 12 room seeds through the real
grader, on the board rooms dealt before (no stamp; the old board for the four bigger-board games) and on today's deal.
Levels are the kit players (good, great, near-perfect) plus an elite level (pace 0.35 of a good player, no mistakes);
the population is 40 players a seed (pace log-normal around a good player's, mistakes rising with pace): median, top
10 % and best. "Old 150s now" is what the runs that scored 150 on the old board score on the new (median, best, count).

| Blackout | 110 → 110 | 137 → 174 | 146 → 192 | 150 → 200 | 110 → 110 | 140 → 178 | 150 → 200 | 200, 200 (6) |
| Hanoi | 129 → 129 | 139 → 142 | 148 → 196 | 150 → 200 | 127 → 128 | 143 → 182 | 150 → 200 | 200, 200 (6) |
| Polypotions | 125 → 125 | 139 → 139 | 148 → 196 | 150 → 200 | 124 → 124 | 141 → 147 | 150 → 200 | 200, 200 (3) |
| Safe Cracker | 138 → 138 | 143 → 143 | 149 → 149 | 150 → 172 | 137 → 137 | 147 → 147 | 150 → 200 | 155, 200 (17) |
| Box Six | 122 → 122 | 136 → 136 | 147 → 147 | 150 → 188 | 122 → 122 | 140 → 140 | 150 → 194 | 170, 194 (8) |
| Bomb Defusal | 138 → 138 | 147 → 147 | 150 → 160 | 150 → 200 | 139 → 139 | 149 → 149 | 150 → 185 | 157, 185 (38) |
| Mosaic | 137 → 130 | 146 → 142 | 150 → 156 | 150 → 200 | 139 → 131 | 148 → 146 | 150 → 200 | 155, 200 (29) |
| Colour Flood | 134 → 134 | 142 → 142 | 149 → 149 | 150 → 187 | 133 → 133 | 145 → 145 | 150 → 200 | 150, 200 (11) |
| Tents and Trees | 133 → 126 | 142 → 143 | 150 → 150 | 150 → 197 | 129 → 126 | 147 → 146 | 150 → 200 | 157, 200 (26) |
| Shikaku | 121 → 110 | 139 → 136 | 150 → 148 | 150 → 190 | 121 → 120 | 143 → 143 | 150 → 200 | 164, 200 (13) |
| Lamplighter | 127 → 125 | 141 → 139 | 148 → 159 | 150 → 200 | 127 → 124 | 144 → 144 | 150 → 200 | 155, 200 (22) |
| Game | Good old → new | Great | Near-perfect | Elite | Population median | Top 10 % | Best | Old 150s now (median, max) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |

Reading it: the good level and the population median stay within about ±10 % (the bigger boards cost a few points
at the good level: Mosaic −5 %, Tents −5 %, Shikaku −9 %, whose population median is unchanged). Today's 150s land
about 150–165 on the stretch games (Box Six's sample of eight runs is the exception), and only the elite level reaches
190–200. On the par games a near-perfect player who also finds par scores near 200: the kits play from the stored
solution, so they find par far more often than people will.

## Demos

The intro demos of Mosaic, Tents and Trees, Shikaku and Lamplighter (old board), and of Blackout, Hanoi, Polypotions
and Safe Cracker (no par line or clean crack) are stopped until one is recorded on `depthRev 1`
(`DEPTH_DEMO_STOPS`, `introDemo.functions.ts`): their intros show the game's still. **They need re-recording.** Box Six,
Bomb Defusal and Colour Flood play exactly as before, so their demos keep playing.

## Files

Owned: `src/lib/duel/logicDepth.ts` (rules and numbers), `logicDepth.server.ts` (the grade), `logicDepthStamp.server.ts`
(the stamp), `logicDepthText.ts` (help and intro), the eleven games' rule, generator and stage files, `src/polish-logic/logic.css` (`--board-aspect`,
`.logic-board-tall`), `src/components/puzzles/depth/ParMeter.tsx`, `src/polish-depth-d6/depth-d6.css`,
`src/lib/duel/lightUpBank.server.ts` (rebuilt), the tubes bank's intro example (re-stamped), the games' lines in
`ROUND_MAX`, `instructions.ts`, `introScore.ts`, `types.ts`, `grade.ts`, `progressFigures.ts` (Shikaku),
`practiceStamps.data.ts` (rebuilt), the Logic kits in `scripts/puzzle-fairness/kits-logic.ts` (taller boards),
`scripts/depth-d6-check.ts`, `depth-d6-record.ts`, `depth-d6-bands.ts`, `depth-d6-legacy.ts` (the room puzzle a seed dealt
before, old boards included), `scripts/fixtures/depth-d6-legacy.json.gz` and `scripts/fixtures/lightup-bank-9x9.json.gz`
(the old Lamplighter bank, checks only).

Shared hooks (one line each, listed in the PR): `generate.server.ts` (`withLogicDepth` after `withRev3`),
`moveLimits.server.ts` (`stampLogicDepth` after the limit stamps, so banked draws and intro examples carry it),
`introDemo.functions.ts` (the demo stop). Shared checks updated for the new revision: `round-max-check` (the raised
games), `scoring-bands-check` (its recorded answers replay on the legacy draw; the help is the depth text),
`scoring-rev3-check` (the help and intro are the depth text), and my games' `nonogram-pair-flood-check` and
`shikaku-lightup-check` (new and old boards).
