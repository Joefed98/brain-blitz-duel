# Duelz — Scoring Reference (as implemented, 13 Oct 2026)

**Rewritten 13 Oct 2026 from the code on `main` (commit `2874c3e`, after Tuning E).** This is what the server's grading code does today, read from `grade.ts`, `scoring.ts`, `stagedRounds.ts`, `speedPar.ts`, each game's own file and the arcade sims, and checked against each game's intro and "?" help text. Where this doc and the code disagree, the code wins. It replaces the 8 Oct audit-based version that was committed on 11 Oct and patched since. Names are the display names in `gameNames.ts`, with the stable id in brackets.

Every round scores 0–150. A room total is the sum of a player's round scores.

**Puzzle score shape (13 Oct 2026, `puzzleScoreRev: 1`).** Sections 1–9, 11.1, 15 and 16 were rewritten for the new shape: every non-arcade game with a finish state now scores a finish as 120 plus up to 30 (all speed, or 15 efficiency + 15 speed) and caps unfinished credit at 110, counting only the player's own progress; Tenfall and Mixed Signals take `tenRev: 1` and `clashRev: 4`. Stored rounds grade exactly as before (`puzzle-score-rev-check`). Each table gives the new formula and the stored one. The fairness audit and the measured bands are in `docs/puzzle-score-bands-oct-2026.md`.

## What changed since the 11 Oct version

- **Names and counts.** Every table uses the current display names. 74 active games (Word 10, Number 9, Speed 6, Attention 7, Pattern 7, Logic 14, Arcade 21; 73 since 13 Oct: Attention 6, Pattern 10, Logic 11, Interloper retired; 74 since 14 Oct with Pinball in rooms, Arcade 22) and 27 retired (28 now), against 68 / 26 in the 11 Oct version.
- **The 50 % par rule everywhere.** Every new puzzle is stamped `speedPar: 1`, and every speed or time bonus (Shape A / B / C, staged rounds, arcade finish bonuses) pays in full with half the time left, then falls evenly to 0. The old doc's `round(P × ms ÷ limit)` is the unstamped legacy curve only (section 2).
- **New games.** Word: Strikeout, Cryptogrid, Swapword and Letterfall (12 Oct). Number: Brimful, Checkout and Ballpark (12 Oct). Formulas in sections 4 and 5.
- **Trusted inputs.** Flash, Bang On and Ascend (`tapRev: 1`, 12 Oct) send raw tap logs and the server works out every reaction, distance, count and wrong tap (section 14). The section now also lists the smaller trusted fields found in this pass.
- **Arcade.** Section 10 is rewritten around the Oct 2026 score bands (12 Oct): achievement units on a knot curve to 140 + up to 10 for a finish, or to 150 on open games, and 0 with no input. The 130 / 150 split, the per-game ratios and the old oddities now describe stored rounds only. Current curves and stamps after Batches 1–5 (11–12 Oct), the bands, Tunings A, B, C and E (12–13 Oct); per-game bands from `docs/arcade-score-bands-oct-2026.md`. Polish F and G and Tuning D are display only.
- **Junction** is retired to practice (Tuning C, 12 Oct); rooms deal 21 arcade games. Its band scoring moves to section 12.
- **Pinball** (`pinball`, working title, 13 Oct) is a new Retro arcade game: table points on an open band curve, `pinRev: 1` (sections 10.2, 10.3 and 11.2). Practice only on 13 Oct; dealt in rooms from 14 Oct (`PINBALL_IN_ROOMS` is `true`), so rooms deal 22 arcade games.
- **Tuning F, second set (14 Oct).** Jaywalk `crossRev 5` (smaller walker hit box), Slice `sliceRev 5` (longer slice), Coral Pop `bubbleRev 4` (directional torpedo), Grappler `swingRev 8` (stars spread evenly; the dragon's distance label scales with distance, display only), Gemstone `matchupRev 6` (150 at 2,800) and Scrumper `snipRev 7` (every per-pin deal proven) (sections 10.2, 10.3 and 11.2).
- **Corrections from the code** to the 11 Oct tables: Bomb Defusal is six steps, 90 s, partial round(75 × steps ÷ 6) (bombVersion 2); Operator is 25 / 30 / 35 / 40 + 20; Counterweight's stage credit is cumulative (20, then 60); Topsy-Turvy's unfinished maximum is 90; Gridlock's is 63; Safe Cracker's is 45; Chroma Lines can reach 120 unfinished; Lightbender's shot count comes from the phone; Mixed Signals' bonus is paid on any finished queue; the Chain legacy branch needs a 25- or 30-link board; Pull! has birds (−10 each); several games score for doing nothing (Bang On 20, Labyrinth 1–2, Slider, Jumbled, Hanoi, Pipeline, Colour Flood, Exact).
- **Rotation** (section 13) is the seeded 6-round rotation (11–12 Oct); the round-6 weighting, arcade's one-slot and never-round-1 rules and the add_maths / add_arcade options are gone.
- **Move limits (13 Oct 2026, later).** Colour Flood, Polypotions, Topsy-Turvy, Counterweight, Operator and Brimful show a limit on the board; running out ends that board as unfinished, scored on the game's existing unfinished rules (Colour Flood: on `floodRev 1` the unfinished credit falls to 0 at the move limit, so running out scores 0; Joe's ruling, 14 Oct). Counterweight's two small scales have exactly one balanced arrangement; Tally's trays take seven count values. Per-game stamps (`floodRev`, `tubesRev`, `gravityRev`, `balanceRev`, `equationRev`, `measureRev 2`, `countRev`; section 11.1), so stored rounds and every other game are untouched (`move-limits-check`). Sections 5, 7, 8, 9 and open item 15 updated; measured bands in `docs/puzzle-score-bands-oct-2026.md` ("Move limits").
- **Tuning F (14 Oct 2026).** Breaker's Fireball 2.5 s (`brkRev 5`), a second Rally bumper from 45 s (`rallyRev 5`, knots refitted), a tenth fewer Tempo notes (`beatRev 5`, knots moved so each level keeps its Tuning C score), more Meteor rocks (`snakeRev 6`, knots refitted) and Orbit's swept black holes (`orbitRev 7`, a bug fix: every hole ahead swallows the rocket the moment its drawn body touches the disc). Hover's fainter arena border lights and Fission's higher arrows are display only. Sections 10.2, 10.3, 10.4 and 11.2; stored rounds replay unchanged (`arcade-tuning-f-check`).
- **Review notes** (11 Oct section 16) are closed where the code has settled them; what is still open is in section 16, **Open items**.

---

## 1. Common rules

| Rule | As coded | Location |
|---|---|---|
| Score range per round | 0–150 (`BASE_POINTS` 100, `MAX_SPEED_BONUS` 50, `MAX_ROUND_SCORE` 150) | `scoring.ts` |
| Puzzle score shape (13 Oct 2026) | every new puzzle is stamped `puzzleScoreRev: 1` (`generatePuzzle`, `bankedIntroExample`); a non-arcade game with a finish state then scores **a finish = 120 + up to 30, unfinished credit at most 110** (section 2). Tenfall and Mixed Signals carry their own stamps (`tenRev: 1`, `clashRev: 4`). Unstamped stored rounds grade exactly as before | `puzzleScoreRev.ts`, `grade.ts gradeSubmission` |
| Room size | 2–10 players (`MIN_PLAYERS`, `MAX_PLAYERS`) | `types.ts` |
| Room total | sum of a slot's `round_results.score` | `scoring.ts totalScore()`, `totalScoreThrough()` |
| Tie-break (2 players; 3+ use the same time in `standings()`) | higher total wins; equal totals → lower `totalAnswerMs` wins; still equal → draw. **Rooms stamped `tieRev: 1`** (every puzzle `buildRoomPuzzles` makes from 13 Oct 2026): each round adds the time actually used against its own limit, `min(limit, phase limit − ms_remaining)`; the limit is the puzzle's stored `timeLimitMs`, else the registry limit, and for arcade and engine rounds the run length (`puzzleRunMs`; ms_remaining there is stored against run + 3 s slack). Flash adds its `reaction_avg_ms`; a round with no answer adds its whole limit; Mixed Signals stores its finishing time from the sim's finishing tick (held to the receipt-checked claim; unfinished = the whole 75 s run); Bang On and Go/No-Go store 0 and so add their whole limit. A plain sum, not normalised: everyone in a room plays the same rounds. **Older rooms** (not every round stamped) keep the original sum over answered rounds of `reaction_avg_ms` if set, else `ROUND_MS (30,000) − ms_remaining` Play again's saved winner (the room history) follows the same rule on `tieRev: 1` rooms: the reset (`restart_duel_room`) still appends the points leader with equal totals split by slot, then the server writes the final standings' winner over that entry (`historyWinner.server.ts`); older rooms keep the entry the reset saved, and a forfeit keeps its own record | `scoring.ts duelOutcome()`, `roundTimeUsedMs()`; `tieBreak.ts roomTieRounds()`; `historyWinner.server.ts`; `scripts/tie-break-check.ts` |
| Standings (3+ players) | total descending, then answer time ascending; equal on both share a position; players who left are dropped; `previousPosition` kept for movement | `scoring.ts rank()`, `standings()` |
| `totalAnswerMs` | sum over rounds of `reaction_avg_ms` if set, else `ROUND_MS − ms_remaining`, where `ROUND_MS` is the fixed 30,000 ms, not the game's own limit (see open item 1) | `scoring.ts totalAnswerMs()`, `answerMsThrough()` |
| Trusted time left | the claim is rounded and clamped to [0, limit] (NaN → 0); if it exceeds the server's own time left (clamped) + 1,500 ms (`TIME_CLAIM_TOLERANCE_MS`) the server's value is used, `clamped: true` is recorded and a warning logged. Server time left = limit − (now − (`phase_started_at` ?? `round_started_at`) − `puzzlePrepMs`); the limit is the puzzle's own `timeLimitMs` where it has one (Hanoi's five-ring variant), else the type's | `grade.ts trustedMsRemaining()`; `duel.functions.ts submitAnswerFn` |
| Receipt time | the server's own time left is also passed to grading as `receivedMsRemaining`; tap logs are cut off at receipt + 1.5 s (`latestTapMs`) | `grade.ts` |
| Stored time left | the grader's `storedMs`, not always the trusted value: Flash, Go/No-Go and Mixed Signals store 0 | `grade.ts` |
| Stored breakdown | a `puzzleScoreRev: 1` grade stores its parts on the round as `extra.parts` (`{ kind: "finish", base: 120, efficiency?, measure?, speed }` or `{ kind: "partial", base }`); reveals that print a breakdown read it (`PuzzleRevealProps.scoreParts`) | `puzzleScoreRev.ts`, `AnswerReveal.tsx` |

## 2. Shared scoring helpers and notation

**The 50 % par rule (speed par, 10 Oct 2026).** Every new puzzle is stamped `speedPar: 1` (`generatePuzzle()` in `generate.server.ts`), and `gradeAnswer` grades inside `withSpeedCurve(puzzleUsesSpeedPar(puzzle))`, so every speed or time bonus below follows the stamp:

```
speedBonusCurve(max, left, limit):           (speedPar.ts)
  limit ≤ 0 or left not finite → 0
  left = clamp(left, 0, limit)
  stamped (speedPar: 1):  left ≥ limit ÷ 2 → max;  else round(2 × max × left ÷ limit)
  unstamped (legacy):     round(max × left ÷ limit)
```

Outside grading (live counters, demos) the par curve is the default. Arcade finish bonuses (`finishScore`, `bandFinishSpeed`) call the same curve, so arcade replays follow the stamp too.

**The puzzle score shape (`puzzleScoreRev: 1`, 13 Oct 2026).** `gradeSubmission` grades inside `withPuzzleScoreRev(puzzleScoreRevOf(puzzle))`; each scorer branches on `scoreRev1()`. Outside a grade the default is the stored (legacy) shape, so a check or display that calls a scorer directly gets the old numbers unless it wraps the call.

```
Finish (everything solved):         120 + up to 30                              (finishParts)
  standard games:                    120 + PAR(30)
  moves, tries, strikes, darts:      120 + up to 15 efficiency + PAR(15)
    moves:    MOVES(15, moves, minimum or par)   full at the minimum, 0 at twice it
    tries:    15 / 8 / 0 for try (or shot) 1 / 2 / 3      (TRY_EFFICIENCY)
    strikes:  3 per strike left (15 with none used)
    darts:    3 per board in the fewest darts
Unfinished:                         clamp(credit, 0, 110)                       (partialParts)
  counts only the player's own progress (never the starting state)
  moves games: credit × wasteFactor(moves, minimum) = 1 up to the minimum, falling evenly to 0 at 4× it
```

So every finish (120 or more) beats every unfinished run (110 or less), and the 50 % par rule still sets the speed part.

| Helper | As coded | Location |
|---|---|---|
| **PAR(P)** = `speedPoints(P, ms, limit)` | `speedBonusCurve(P, ms, limit)`; 0 if limit ≤ 0 | `scoring.ts` |
| `speedBonus(ms, limit = ROUND_MS)` | `speedBonusCurve(50, clamp(ms, 0, limit), limit)` (retired games) | `scoring.ts` |
| `reactionBonus(avgMs)` | `clamp(round((650 − avgMs) ÷ 10), 0, 50)` (Go/No-Go only) | `scoring.ts` |
| **MOVES(B)** = `movesPoints(B, moves, min)` | `round(B × clamp(1 − (moves − min) ÷ min, 0, 1))`: full at the minimum, 0 at twice it; 0 if min ≤ 0 | `scoring.ts` |
| **Shape A** = `standardComplete(ms, limit)` | rev 1: `finishParts(PAR(30))` = 120 + PAR(30); stored: `clamp(130 + PAR(20), 0, 150)` | `scoring.ts` |
| **Shape B / C** = `scoreSolvedMoves(...)` | rev 1 (both shapes): `finishParts(PAR(15), MOVES(15), "moves")` = 120 + MOVES(15) + PAR(15); stored: `clamp(100 + MOVES(w.moves) + PAR(w.speed), 0, 150)` with `MOVES_SHAPE.B = {25, 25}`, `C = {40, 10}` (Colour Flood) | `scoring.ts` |
| `finishParts(speed, efficiency?, measure?)` | min(150, 120 + efficiency + speed); records `extra.parts` | `puzzleScoreRev.ts` |
| `partialParts(points)` / `unfinishedCredit` | clamp(round(points), 0, 110) (`PUZZLE_UNFINISHED_CAP`); records `extra.parts` | `puzzleScoreRev.ts` |
| `wasteFactor(moves, min)` | clamp(1 − (moves − min) ÷ (3 × min), 0, 1); 1 when min ≤ 0 (`WASTE_ZERO_AT` 4) | `puzzleScoreRev.ts` |
| `tryEfficiency(n)` | 15 / 8 / 0 for n = 1 / 2 / ≥ 3 (`TRY_EFFICIENCY`) | `puzzleScoreRev.ts` |
| `UNFINISHED_CAP` | 110; used inside the stored `scoreTubes` (rev 1 uses `PUZZLE_UNFINISHED_CAP`) | `scoring.ts` |
| `finishScore(runTicks, finishTick)` | `clampInt(130 + speedBonusCurve(20, left, max(1, runTicks)), 0, 150)`, left = clamp(runTicks − finishTick, 0, runTicks). Pre-band arcade revisions only | `arcade/engine.ts` |
| Band scoring (arcade) | `bandOpen` (curve to 150), `bandFinishFlat` (curve to 140 + flat 10), `bandFinishSpeed` (curve to 140 + PAR(10) over a window); `BAND_PARTIAL_TOP` 140, `BAND_FINISH_BONUS` 10 (section 10) | `arcade/scoreBands.ts` |
| Staged rounds | `scanStageResult` / `scoreSymbolScanStages`, `countStagePoints` / `scoreCountUpStages`, `scoreEquationStages`; stage weights `STAGE_WEIGHTS_3 = [30, 45, 55]` (stored), `STAGE_WEIGHTS_3_REV1 = [25, 40, 45]`, `EQUATION_REV1_STAGE_POINTS = [20, 30, 35, 45]` | `stagedRounds.ts` |

Notation: **ms** = trusted time left; **limit** = the game's registry time limit unless stated; **PAR(P)** is the par curve above on stamped rounds (linear on unstamped ones). In sections 4–9, **New** is a `puzzleScoreRev: 1` round and **Stored** the formula unstamped rounds keep (the 13 Oct version of this document).

## 3. Score-check anchors enforced by scripts

| Script | What it pins |
|---|---|
| `standard-scoring-check.ts` | Stored shape (unchanged anchors): every Shape A game complete at half time = 150, every Shape B game at the minimum and half time = 150, `scoreSolvedMoves(20, 10, 0, L)` = 100, the named partials (Chroma Lines 11/12 → 110, Hanoi 8/9 → 98, Matchmaker 14/15 → 112 …), staged anchors. New shape (`withPuzzleScoreRev(1)`): every standard game 150 at half time and 120 at the buzzer; every moves game 150 at the minimum and half time and 120 for the slowest, longest solve; tries 150 / 143 / 120; unfinished tops (Double Take 5 → 110, Labyrinth one step short → 110, Bomb 5 of 6 → 110, Ascend 23 → 110 …); starting states 0 (Hanoi, Pipeline, Colour Flood, Labyrinth, Exact with no step); Bang On all misses 0 and its 300 ms knee 74; staged anchors (Eagle Eye perfect 150 / 120, Tally exact 120, Operator best three 110); the default outside a grade is the stored shape |
| `puzzle-score-rev-check.ts` (new, shard a) | **Legacy identity**: 8,366 stored-round answers (`scripts/fixtures/puzzle-score-legacy.json.gz`, recorded on main `eb143ad` before the change by `puzzle-score-legacy-record.ts`: 47 games × 3 seeds, unstamped and speedPar puzzles; empty drafts, spam, four solver levels and their unfinished states, at the buzzer, half and quarter time) grade exactly as main stored them: score, verdict, counts, errors, stored time and the whole stored extra (Mixed Signals' presentation-only `extra.reveal` excepted: #40 changed its bonus line on purpose). Every new puzzle is stamped. Tenfall `tenRev: 1` and Mixed Signals `clashRev: 4` runs score the same on the phone's own sim and the server's replay, unflagged, with finishes covered, and Mixed Signals' reveal bonus is the stored score above 120. Lightbender on the action log: a first-shot solve at half time 150, a second-shot solve at the buzzer 128, a solving layout never fired 110 unfinished. Quick fairness on 24 seeds per game: nothing scores 0, finishes 120–150 beat every unfinished run, unfinished ≤ 110, pure spam median ≤ 5 |
| `six-game-scoring-check.ts` | Formula identity over the input range for the pre-band Ball Tracker, Gemstone (revs 1–3), Junction, Rally, High Rise and Flightpath; band curves; legacy partial maxima; no intro or help states a partial cap or a "÷ N s" divisor; old Ball Tracker demos rejected |
| `reveal-score-check.tsx` | For every active and retired type the reveal's `data-reveal-score` equals the stored score; no stored row shows "Scoring…"; no Reveal computes its own score |
| `arcade-score-bands-check.ts` | 22 band games: pre-change runs replay to identical scores; curves start at 0, never fall, top at 140 + 10 or 150; doing nothing = 0 |
| `tap-log-check.tsx` | Flash, Bang On, Ascend: 36 honest runs recorded on main grade identically; tap logs score the same with the same tie-break time; phone parity in happy-dom; 381 tampered logs never beat the honest run |
| `careless-play-check.ts` | Flash, Bang On (`tapRev: 2`) and Pull! (`clayRev: 4`): older stamps match independent copies of the old formulas (5,199 score points) and grade the same kit runs exactly as before; rev-3 and rev-4 Pull! sims match tick for tick; the stored breakdowns (`falseStartCost`, `averageMs` / `kneeMs` / `zeroMs`, `emptyShots` / `emptyShotCost`); on 30 room seeds the careless lines land at Flash 45–65, Bang On 60–80, Pull! 12–22 while every honest median moves by at most 3 and no run scores more |
| `number-batch-check.ts` | Brimful, Checkout, Ballpark: same seed → same puzzle; BFS and exhaustive-search proofs; new-shape anchors (Brimful 150 / minimum finish 120 / best unfinished 110; Checkout 150 / 120–135 / 110; Ballpark 150 / best unfinished 110) and the stored ones on unstamped copies (100 / 90; 110–120 / 100; 112); placing a number never lowers the score (new rounds: unless it is 25 % or more off, by 1) |
| `strikeout-check.ts`, `codeword-check.ts`, `swapword-check.ts` | New shape: Strikeout perfect 150, minimum finish 123, best unfinished 110; Cryptogrid 150 / 120 / one short 110; Swapword 150 / slow finish 120–135 / one swap short ≤ 110; nothing 0. Stored: Strikeout 124 / 88, Cryptogrid 130, Swapword ≥ 111 / ≤ 100; all 1,000 Cryptogrid boards unique |
| `move-limits-check.ts` (new, 13 Oct) | **Legacy identity**: 1,973 answers on 56 room puzzles of the seven games as main stamped them before the limits (`scripts/fixtures/move-limits-legacy.json.gz`, recorded by `move-limits-legacy-record.ts`) grade exactly as main stored them. Every new puzzle of the six limited games carries its stamp and a public limit (rounded to a 5 where the minimum is private), Tally `countRev 1`, no other game any of these fields. The server cuts each list at the limit (Colour Flood's par route solves at par, is unfinished at par − 1 and scores exactly the unfinished rule; Polypotions' Undo and Reset never give a pour back; Topsy-Turvy's reset tilts count; a Brimful board past its limit ends the run at 0); Counterweight and Operator refuse a scale / equation whose recorded count is over its limit (110 and 100). Counterweight's small scales have one balanced arrangement and Tally's counts use the seven-value ranges (60 seeds). Random play on 24 seeds: no spam strategy finishes more than 2 boards, every median ≤ 60; on Colour Flood every unfinished random-colour or colour-cycling run scores exactly 0 on `floodRev 1`, and the same answers with the stamp removed (a stored round) still score on the old waste factor. Each Stage renders its counter (`data-move-limit`), and a stored round shows none |
| `tubes-safe-bomb-check.ts` | Bomb v2 three-step strike: 66 on a new round (22 per step), 38 on a stored one |
| `wordfall-check.ts` | A scripted bot reaches par inside the 90 s run and the server replay scores it 150 |
| `timing-check.ts` | `trustedMsRemaining`: honest, 1.2 s behind, at the tolerance, impossible claim → server value, over the limit → limit, negative or NaN → 0 |
| `room-rounds-check.ts` | Rotation: rounds, per-category spread, no repeated game, no category twice in a row, same seed → same room |
| `intro-score-text-check.ts` | Intro SCORE lines fit two short lines (90 characters) with no scoring terms; band intros say how to reach the top |
| `arcade-play-check.ts` | Also plays Tenfall, Mixed Signals, Bonk and Pull! on the real practice screens (15 s live, tick and HUD timer advancing, no errors, frame time, READY on screen; no arcade-world layout proof) |
| `tie-break-check.ts` | Mixed Signals' reveal bonus equals the bonus inside the stored score on clashRev 3, and on clashRev 4 is the score above 120; a tied tieRev room's saved Play-again winner is the standings' winner (older rooms keep the saved one) |
| `chain-time-check.ts` | Don't Break the Chain, `chainTimeRev: 1`: a claimed time beyond the replayed last tap never raises the finish bonus or the stored time left; unstamped rounds score the claim exactly as before |
| `reveal-window-check.ts` | No other player's answer is readable (reveal, replays, the `round_results` read policy) while late answers are still accepted; a player with no answer can't read the correct answer or solution until then, and can't send a late answer after reading it |
| Arcade identity checks | `arcade-batch1`–`5-check`, `arcade-tuning-*`, `tuning-b-check`, `arcade-self-replay-check` (now also Mixed Signals clashRev 4): stored runs replay to the same score and state on their own revision |

`scripts/puzzle-fairness.ts` (not a check) is the full audit behind these numbers: `docs/puzzle-score-bands-oct-2026.md`.

---

## 4. Word — 10 active

| Game (id) | Time limit | New: finish | New: unfinished | Stored rounds | Items | File + function |
|---|---|---|---|---|---|---|
| Nucleus (`wordsmith`) | 100,000 ms | no finish state: min(150, floor(2.5 × word points)) (unchanged) | same | same | 4+ letter words with the centre letter; points 4 → 1 … 9+ → 15 | `scoring.ts scoreWordsmith` |
| Forage (`wordhunt`) | 100,000 ms | no finish state: min(150, 2 × word points) (unchanged) | same | same | 4+ letter paths | `scoring.ts scoreWordHunt` |
| Interlock (`tilegrid`) | 100,000 ms | all 15 tiles in a valid grid: 120 + PAR(30) | 110 × tiles in a real word ÷ 15 | 130 + PAR(20); else 8 per tile in a word | 15 tiles | `tileGrid.ts scoreTileGrid` |
| Slider (`wordslide`) | 100,000 ms | 120 + MOVES(15, moves, par) + PAR(15) | 27.5 per word row the player made (a row unchanged from the start doesn't count) × wasteFactor(moves, par) | 100 + PAR(30) + MOVES(20); else 22 per word row, start rows included | 5 rows; par = scramble shifts | `scoring.ts scoreWordSlide` |
| Lookout (`wordsearch`) | 120,000 ms | 120 + PAR(30) | 22 per word − 2 per wrong pick beyond the first 5 | 130 + PAR(20); else min(120, 20 × found) | 6 words | `wordSearch.ts scoreWordSearch` |
| Roundabout (`letterwheel`) | 100,000 ms | every slot: 120 + PAR(30); `isCorrect` = every slot found | 110 × words ÷ (slots − 1) | 130 + PAR(20); else 15 / 13 per word; `isCorrect` counted cells | 8 or 9 words | `letterWheel.ts scoreLetterWheel` |
| Strikeout (`strikeout`) | 100,000 ms | 120 + 3 per strike left + PAR(15) (123–150) | 27.5 per solved word (four = 110); letters showing earn nothing | 120 + 4 per strike left + PAR(10); else min(110, 20 × words + 2 × letters showing) | 5 words, 5 strikes | `strikeout.ts scoreStrikeout` |
| Cryptogrid (`codeword`) | 120,000 ms | 120 + PAR(30) | 110 × numbers right ÷ (numbers to find − 1) − 5 per wrong letter left | Shape A; else min(110, 110 × right ÷ to find), wrong letters free | 10–14 numbers to find | `codeword.ts scoreCodeword` |
| Swapword (`swapword`) | 120,000 ms | 120 + MOVES(15, swaps, minimum) + PAR(15) | 110 × (tiles placed − tiles moved out of place) ÷ (tiles to place − 2) | Shape B (≥ 111); else min(100, 5 × placed) | 21 tiles; budget = minimum + 5 | `swapword.ts scoreSwapword` |
| Letterfall (`wordfall`, engine) | 93,000 ms (90 s run) | no finish state: floor(150 × min(points, 30) ÷ 30) (unchanged) | same | same | par 30 word points | `arcade/wordfall.ts wordfallScore` |

**Word notes**
- Slider: the generator no longer deals a row that is already a word (about a fifth of grids did; it redraws, and a grid with no word row draws exactly as before, so the fixed intro example is unchanged), and rev 1 credits only rows the player changed into words.
- Roundabout: the phone only keeps words that fill a slot, so wrong traces never reach the server; random tracing that finds slot words is real progress (audit flag).
- Strikeout: guessing letters in frequency order is how the game is played and still scores (audit flag); a random alphabet scores about 0.

## 5. Number — 9 active (not in the default room presets)

| Game (id) | Time limit | New: finish | New: unfinished | Stored rounds | Items | File + function |
|---|---|---|---|---|---|---|
| Exact (`target`) | 75,000 ms | distance 0: 120 + PAR(30) | d = distance of the closest number the player **made** (a step result still on the board); no step = 0. d 1–10: 110 − (d − 1)(d + 2) ÷ 2 (110 … 56); over 10: 56 − 0.6 × (d − 10) | 130 + PAR(20); 120 − (d − 1)(d + 2) ÷ 2; over 10: 66 − 0.6 × (d − 10); d counted starting tiles | 6 tiles, target 101–999 | `scoring.ts scoreTargetNumber`; `target.ts madeDistance` |
| Operator (`equation`) | 90,000 ms | all four: 120 + PAR(30) | 20 / 30 / 35 / 45 per correct stage, any order (best three = 110); `equationRev 1`: a stage counts only if its recorded tries ≤ 3 (`tryLimit`; every full set of signs is a try, the phone locks the equation after the third wrong one) | 25 / 30 / 35 / 40 + PAR(20) on all four; 3-stage rounds 30 / 40 / 50 + 30; no try limit | 4 equations; answer `ops|ops|ops|ops#t1,t2,t3,t4` on equationRev 1 | `stagedRounds.ts scoreEquationStages`; `grade.ts`; `moveLimits.ts` |
| Counterweight (`balance`) | 90,000 ms | all three: 120 + PAR(30) | 20 / 35 / 75 per balanced scale, **any order** (any two ≤ 110); `balanceRev 1`: a scale counts only if its recorded hangs ≤ its limit (`placeLimits` = weights + 4 / 5 / 6 = 6, 8, 10); out of hangs, the phone ends the scale and starts the next | 120 + PAR(30); else cumulative in order: 1 → 20, 2 → 60; no limit | 3 scales; balanceRev 1: scales 1–2 have exactly one balanced arrangement; answer `…|…|…#h1,h2,h3` | `balance.ts balanceRoundScore`, `balanceScalesSolved`; `numberRounds.server.ts balancedArrangements` |
| Integer Pyramid (`numpyramid`) | 120,000 ms | all four: 120 + PAR(30) | 27.5 × (pyramids finished + share right on the **first unfinished** pyramid), at most 110; the phone's `active` is not read | 30 per pyramid + 30 × share on the phone's `active` pyramid; all four + PAR(30) | 4 pyramids | `numberPyramid.ts scoreNumberPyramid` |
| Trail (`trail`) | 120,000 ms | 120 + PAR(30) | 110 × (player tiles in their right cell − player tiles in a wrong cell) ÷ (tiles to place − 1) | 130 + PAR(20); else min(130, 5 × right tiles) | 26 tiles to place | `trail.ts scoreTrail` |
| Brimful (`measure`) | 120,000 ms | 120 + 15 × (Σ move points ÷ 20) + PAR(15) | 30 / 35 / 45 for puzzles 1–3 solved in order (three = 110); `measureRev 2`: a puzzle stops at its move limit (`moveLimits`, 3 × the minimum rounded up to a 5) and, unsolved, ends the run | Σ(25 + move points) + PAR(30) on all four; no limit | 4 puzzles; move points 5 at the minimum, 0 at twice it | `measure.ts scoreMeasure`, `replayMeasure` |
| Checkout (`checkout`) | 90,000 ms | 120 + 3 per board in the fewest darts + PAR(15) | 22 / 24 / 26 / 28 / 32 per board, any order (best four = 110) | 18–26 + 2 per fewest board + PAR(30) on all five | 5 boards | `checkout.ts scoreCheckout` |
| Ballpark (`numline`) | 75,000 ms | all 15 placed: accuracy + round(PAR(30) × accuracy ÷ 120) (150 at full accuracy) | accuracy, at most 110 | item points 8 within 2 %, 0 at 15 %; no wild cost; unfinished up to 112 | 15 numbers; rev 1 item points: 8 within 2 %, 0 at 8 %, −1 at 25 % or more | `numline.ts numlineItemPoints`, `scoreNumline` |
| Tenfall (`tendrop`, engine, `tenRev: 1`) | 93,000 ms (90 s run) | all 10: 120 + speedBonusCurve(30, 5,400 − clear tick, 5,400) | floor(110 × cleared ÷ 9) − 2 per reset beyond 5, 0–110 | 13 per target; all 10: 130 + PAR(20) | 10 targets | `arcade/tenDrop.ts tenDropScore` (rev in the sim state, `tenDropInit`) |

**Number notes**
- Ballpark has no clean finish: "all placed" is its finish, scaled by accuracy, so a careless finish can score below a careful unfinished run (audit rule c does not apply to it). A placement 25 % or more off costs 1, so placing a number can lower the score by 1 on a new round.
- Counterweight and Operator (13 Oct, `balanceRev 1`, `equationRev 1`): a visible hang limit per scale and 3 tries per equation. The server sees only the final placement / operators plus the phone's own counts after `#`, so it can refuse a count over the limit but the count is the phone's word; what the server does verify is Counterweight's harder small scales (one balanced arrangement each), which take random hanging with no limit at all from a median of 38–55 to 20. Random hanging now scores a median of 0, brute-forcing Operator 20 (was 68; open item 15).
- Brimful's limit (`measureRev 2`) is for consistency only: random play already scored 0 and no simulated level reaches 3× the minimum, so scores are unchanged.
- Tenfall's rev travels in the sim state (`scoreRev`), so the phone's claimed score matches the replay; checkpoints and play are unchanged.
- **Careless play (13 Oct 2026, open item 16 closed).** Flash and Bang On take `tapRev: 2`, Pull! `clayRev: 4`: Flash's false starts cost 8 each for the first two and 11 each after that; Bang On's line falls from 101 at 200 ms to 0 at 325 ms; Pull! charges 1 for every 20 shots that hit nothing beyond the first 30. Simulated careless play drops (Flash tapping every colour 75 → 54, Bang On random taps 92 → 72, Pull! mashing 30 → 16) while the honest bands move by at most 2. Older stamps score exactly as before (`careless-play-check`). Letterfall is unchanged (its par waits on real play).

## 6. Speed — 6 active

| Game (id) | Time limit | New: finish | New: unfinished | Stored rounds | Items | File + function |
|---|---|---|---|---|---|---|
| Flash (`reaction`) | 60,000 ms | no finish state. `tapRev: 2` (13 Oct 2026): average ≤ 200 ms → 150, else 150 − 0.16 × (avg − 200), minus false starts: −8 each for the first two (`FLASH_REV2_CHEAP_FALSE_STARTS`), −11 each after that (`FLASH_REV2_FALSE_START_COST`); stored as `extra.falseStartCost` | — | `tapRev: 1` and unstamped: the same, − 8 per false start | 5–8 gold flashes | `scoring.ts scoreReaction`, `reactionFalseStartCost` |
| Bang On (`stopwatch`) | 60,000 ms | no finish state. `tapRev: 2` (13 Oct 2026): 150 at ≤ 20 ms, −0.27 per ms above to 101 at 200 ms (`STOPWATCH_REV2_KNEE_MS`), then an even fall to 0 at 325 ms (`STOPWATCH_REV2_ZERO_MS`); every average error under 200 ms scores as before; stored as `extra.averageMs`, `kneeMs`, `zeroMs` | — | `tapRev: 1`: the same line down to 74 at 300 ms (`STOPWATCH_REV1_KNEE_MS`), then an even fall to 0 at the 500 ms miss value (all misses = 0); before `puzzleScoreRev: 1`: the same line all the way (all misses = 20) | 10 watches | `scoring.ts scoreStopWatch` |
| Ascend (`numhunt`) | 60,000 ms | all 24: 120 + max(0, PAR(30) − 5 × wrong taps): never below 120 | 110 × reached ÷ 23 − 5 × wrong taps, 0–110 | 130 + PAR(20) − 5 × wrong (could fall below an unfinished run); else 5 × reached − 5 × wrong | 24 numbers | `scoring.ts scoreNumberHunt` |
| Don't Break the Chain (`chain`) | 45,000 ms | all 40: 120 + PAR(30) (time left, `CHAIN_TIME_MS`; `chainTimeRev: 1` caps it by the replayed last tap) | floor(110 × links ÷ 39) | floor(3.5 × links); all 40: 140 + PAR(10) | 40 links | `chain.ts chainScore` |
| Bonk (`whack`, engine) | 63,000 ms | no finish state (unchanged) | — | same | — | `arcade/whack.ts whackScore` |
| Pull! (`clayshoot`, engine) | 63,000 ms | no finish state. `clayRev: 4` (13 Oct 2026): 5 per orange, 10 per gold, −10 per bird, +10 for all 25 with no bird, minus 1 for every 20 shots that hit nothing (no clay, no bird) beyond the first 30: floor(max(0, empty − 30) ÷ 20) (`CLAY_FREE_EMPTY_SHOTS`, `CLAY_EMPTY_SHOTS_PER_POINT`); stored as `extra.emptyShots`, `emptyShotCost` | — | `clayRev: 3` / 2: no empty-shot cost; unstamped: no birds | 25 clays, 10–12 birds | `arcade/clayShoot.ts clayScore`, `clayEmptyShotCost` |

**Speed notes**
- Bang On: tapping at a random moment in each watch averages about 226 ms off (an average simulated player is about 138 ms off, 116). `tapRev: 1` scored random taps about 92; `tapRev: 2` steepens only the part above 200 ms, so they score about 72 and no honest median moves (30 seeds, `careless-play-check`).
- Flash: tapping every coloured flash (gold and decoys alike) averages about 9 false starts. `tapRev: 1` scored it about 75; `tapRev: 2` (8 each for the first two, 11 after) about 54. Honest players make 0–2 false starts (median), so the average band moves 112 → 110 and the rest not at all.
- Pull!: mashing on whatever is flying (about 6 shots a second, over 300 empty shots) scored about 30; `clayRev: 4` about 16. Honest runs miss 0–15 shots, inside the free 30, so no honest score changes.
- Ascend: a finish now always beats an unfinished run (the old formula could put a 4-wrong-tap finish under a clean 23).

## 7. Attention — 6 active (Interloper retired 13 Oct, section 12)

| Game (id) | Time limit | New: finish | New: unfinished | Stored rounds | Items | File + function |
|---|---|---|---|---|---|---|
| Mixed Signals (`stroop`, engine, `clashRev: 4`) | 78,000 ms (75 s run) | all 52 sorted with at most 2 wrong gates: 120 + max(0, PAR(30) − 5 × wrong) over (run − finishing tick, run) | round(110 × right ÷ 52) − 2 × wrong, 0–110 | clashRev 3: round(130 × right ÷ 52) − 2 × wrong + PAR(20) once every word is sorted | 52 words; play identical to clashRev 3 | `arcade/colourClash.ts clashRev4ScoreOf`, `clashRev4Finished` |
| Eagle Eye (`symscan`) | 30,000 ms | all three perfect: 120 + PAR(30) | per stage max(0, round(w × found ÷ targets) − 3 × wrong), w = 25 / 40 / 45 | w = 30 / 45 / 55 + PAR(20) when perfect | 3 grids | `stagedRounds.ts scanStageResult` |
| Double Take (`spotdiff`) | 30,000 ms | all 6 found with at most 5 wrong taps: 120 + PAR(30) | 22 per difference − 5 per wrong tap, 0–110 | Shape A; else 20 per difference, wrong taps free | 6 differences | `scoring.ts scoreSpotDifference` |
| Tally (`countup`) | 45,000 ms | all three exact: 120 + PAR(30) | per tray w / 60 % / 30 % for exact / off by 1 / off by 2, w = 25 / 40 / 45 | w = 30 / 45 / 55 + PAR(20) | 3 trays; `countRev 1`: counts 5–11, 7–13, 9–15 (stored: 6–10, 8–12, 10–14) | `stagedRounds.ts countStagePoints`; `countUp.tsx COUNTUP_STAGE_COUNTS_REV1` |
| Labyrinth (`maze`) | 60,000 ms | exit: 120 + PAR(30) | 110 × (p − 0.05) ÷ 0.95 × wasteFactor(cells walked, route length); p = furthest route step beyond the start ÷ steps to the exit | Shape A; else 110 × (furthest index + 1) ÷ route length (the start cell scored 1–2) | 19 × 19 | `scoring.ts scoreMaze`; `grade.ts` |
| Matchmaker (`pairmatch`) | 90,000 ms | 120 + PAR(30) | 110 × pairs ÷ 14 − 1 per mismatched try beyond 25 | Shape A; else 8 per pair (up to 112) | 15 pairs | `scoring.ts scorePairMatch` |

**Attention notes**
- Double Take: wrong taps were free, so tapping every cell found all six and scored a finish. The lightest fix that passes rule b: each wrong tap costs 5 from unfinished credit, and all six with more than 5 wrong taps is not a finish. The phone still says "6 / 6 found"; the reveal shows the stored "Partly solved" (a phone-side tap budget display belongs to Attention polish).
- Mixed Signals' reveal bonus line ("time bonus +N", `clashTimeBonusOf`) belongs to Room rules and trust and was left as it was; on clashRev 4 rounds its "+N" does not match the rev-4 rule (open item 4).
- Tally (13 Oct, `countRev 1`, generation only): each tray's count is one of seven values around the same middles, so guessing the middle scores a median of 53 (was 66) and a random guess in range 44; the scene is stored and grading is unchanged (open item 15).

## 8. Pattern — 10 active (Pipeline, Chroma Lines and Heave moved from Logic, 13 Oct)

At the buzzer the phone submits its draft answer with 0 ms left, and it is graded like any other answer. Moves, presses, tilts, pours and pushes count cumulatively; Undo and Reset never give moves back. On new rounds the board's starting state never earns credit.

| Game (id) | Time limit | New: finish | New: unfinished | Stored rounds | File + function |
|---|---|---|---|---|---|
| Gridlock (`unblock`) | 60,000 ms | 120 + MOVES(15) + PAR(15) | 110 × share of the gold car's blockers cleared × wasteFactor | Shape B; else round(70 × 0.9 × share) (most 63) | `scoring.ts scoreUnblock` |
| Tessellate (`blockparty`) | 60,000 ms | 120 + PAR(30) | 110 × (pieces on their stored-solution cells − other legal pieces) ÷ 8 | Shape A; else 12 per legal piece (random drops scored ~96) | `scoring.ts scoreBlockParty`; `grade.ts` |
| Skid (`iceslide`) | 90,000 ms | 120 + MOVES(15) + PAR(15) | 110 × (start − best) ÷ (start − 1) × wasteFactor, best = fewest moves to the exit from the best state reached | Shape B; else round(90 × (1 − best ÷ start)) | `scoring.ts scoreIceSlide` |
| Topsy-Turvy (`gravity`) | 90,000 ms | 120 + MOVES(15, tilts) + PAR(15) | 110 × balls parked beyond the start ÷ 3 × wasteFactor; `gravityRev 1`: nothing after the `tiltLimit`-th tilt counts (minimum + 6 rounded up to a 5; Undo and Reset never give one back), so running out is this unfinished score | Shape B; else 30 per locked ball; no limit | `scoring.ts scoreGravity`; `gravity.ts replayGravity` |
| Jumbled (`tiles`) | 60,000 ms | 120 + MOVES(15) + PAR(15) | 110 × (tiles the player put in place − start tiles moved out) ÷ (7 − tiles in place at the start) × wasteFactor | Shape B; else 14 per tile in place incl. the start (doing nothing scored 0–84) | `scoring.ts scoreTiles`; `grade.ts` |
| Turntable (`rings`) | 60,000 ms | 120 + MOVES(15) + PAR(15) | 110 × spokes aligned beyond the start ÷ (7 − aligned at the start) × wasteFactor | Shape B; else 12 per aligned spoke | `scoring.ts scoreRings` |
| Lightbender (`laser`) | 60,000 ms | all gems, no bomb: 120 + 15 / 8 / 0 for shot 1 / 2 / 3 + PAR(15) (shots are taken as an input; Room rules and trust moves them to a server-read log) | 22 per gem lit by the final placement (fired at least once) | 130 / 115 / 100 + PAR(20); else 15 per gem | `scoring.ts scoreLaser` |
| Pipeline (`pipes`) | 120,000 ms | 120 + PAR(30) | 110 × (tiles joined to the source beyond the start ÷ (49 − start))² | Shape A; else the stepped 90 / 85 / … / 1.5 × j table (the start scored 2–21) | `scoring.ts scorePipes` |
| Chroma Lines (`flow`) | 75,000 ms | 120 + PAR(30) | 110 × (pairs joined on their solution route − other joined pairs) ÷ pairs (every pair joined with cells empty = 110) | Shape A; else 10 per pair (up to 120) | `scoring.ts scoreFlow`; `grade.ts` |
| Heave (`push`) | 120,000 ms | 120 + MOVES(15, pushes) + PAR(15) | 110 × crates the player brought home ÷ (crates − 1) × wasteFactor(pushes) | Shape B; else 110 × home ÷ crates | `scoring.ts scorePush` |

**Pattern notes**
- Topsy-Turvy (13 Oct, `gravityRev 1`): a parked ball never moves again, so random tilting used to solve about one board in five. The tilt limit stops that (1 board in 30 at 3 tilts a second), but it also stops random tilting before wasteFactor reaches 0, so it now keeps some unfinished credit at the limit (median 31 at 3 / s, was 0; 0 at 1.5 / s).
- Tessellate and Chroma Lines credit only placements on the stored solution (both banks prove a unique, or stored, solution); a different full tiling still finishes.

## 9. Logic — 11 active

| Game (id) | Time limit | New: finish | New: unfinished | Stored rounds | File + function |
|---|---|---|---|---|---|
| Blackout (`lightsout`) | 75,000 ms | 120 + MOVES(15, presses) + PAR(15) | after a press, 1 / 2 / 3 / 4 lights left = 110 / 95 / 80 / 65; else 5 × (solution cells pressed an odd number of times − other cells pressed an odd number of times), 0–45 | Shape B; 85 / 75 / 60 / 50; else 5 per solution cell, most 45 (pressing every cell scored 45) | `scoring.ts scoreLightsOut` |
| Box Six (`sudoku`) | 90,000 ms | 120 + PAR(30) | round(110 × correct ÷ blanks) − 5 per wrong digit | Shape A; else round(110 × correct ÷ blanks), wrong digits free | `scoring.ts scoreSudoku` |
| Hanoi (`tower`) | 90,000 ms | 120 + MOVES(15) + PAR(15) | 110 × rings stacked from the bottom of the gold post beyond the start ÷ (8 − home at the start) × wasteFactor | Shape B; else 110 × rings home ÷ 9 incl. the start (49 for doing nothing on 40 % of boards) | `scoring.ts scoreTower` |
| Polypotions (`tubes`) | 90,000 ms | 120 + MOVES(15, pours) + PAR(15) | 110 × flasks corked beyond the start ÷ (colours − 1) × wasteFactor; `tubesRev 1`: the answer logs Undo (`u`) and Reset (`r`), every pour counts (for MOVES and wasteFactor too) and nothing after the `pourLimit`-th pour does (minimum + 6 rounded up to a 5) | Shape B; else 22 per corked flask, cap 110; Undo removed pours from the list | `scoring.ts scoreTubes`; `tubes.ts replayTubeLog` |
| Safe Cracker (`safe`) | 75,000 ms | 120 + 15 / 8 / 0 for try 1 / 2 / 3 + PAR(15) | 25 per dial right on the last try beyond the first | 130 / 115 / 100 + PAR(20); else 15 per dial | `scoring.ts scoreSafe` |
| Bomb Defusal (`bomb`, v2) | 90,000 ms | 120 + PAR(30) | 22 per correct leading step (five of six = 110) | Shape A; else round(75 × steps ÷ 6); v1 25 per step | `scoring.ts scoreBomb` |
| Mosaic (`nonogram`) | 120,000 ms | 120 + PAR(30) | round(110 × correct filled ÷ the picture's filled cells) − 5 × wrong (unchanged) | Shape A; same partial | `scoring.ts scoreNonogram` |
| Colour Flood (`flood`) | 60,000 ms | 120 + MOVES(15, moves, par) + PAR(15) | 110 × cells flooded beyond the starting region ÷ (196 − start) × wasteFactor(moves, par); `floodRev 1`: nothing after the `moveLimit`-th tap counts (par + 2), and the waste factor is 1 up to par, falling evenly to 0 at the limit (½ at par + 1), so running out of moves scores 0 (`floodLimitWaste`) | Shape C: 100 + MOVES(40) + PAR(10); else 110 × region ÷ 196; no limit | `scoring.ts scoreFlood`; `flood.ts replayFlood` |
| Tents and Trees (`tents`) | 90,000 ms | 120 + PAR(30) | 10 per tent on a solution cell − 10 per other tent | 130 + PAR(20); else min(110, 10 × right), wrong tents free | `tents.ts scoreTents` |
| Shikaku (`shikaku`) | 90,000 ms | 120 + PAR(30) | 110 × (area of accepted rectangles on the unique solution − area of other accepted rectangles) ÷ 100 | 130 + PAR(20); else 110 × accepted area ÷ 100 | `shikaku.ts scoreShikaku`; `grade.ts` |
| Lamplighter (`lightup`) | 90,000 ms | 120 + PAR(30) | 110 × bulbs on the solution ÷ (solution bulbs − 1) − 5 per other bulb | 130 + PAR(20); else 110 × lit ÷ whites − 5 per clash (lighting everything at random scored 110) | `lightUp.ts scoreLightUp`; `grade.ts` |

**Logic notes**
- Doing nothing now scores 0 everywhere: Pipeline, Hanoi and Colour Flood subtract the starting state.
- Colour Flood and Polypotions (13 Oct, `floodRev 1`, `tubesRev 1`): any colour sequence used to flood the board and random pours solved about two boards in three. With the limits random play no longer finishes (0 of 30 boards; 1 of 30 for colour cycling and fast pours), Polypotions keeps the existing unfinished credit for flasks corked by the limit (median 41–42). Colour Flood's waste factor on `floodRev 1` reaches 0 at the limit instead of at 4× par (Joe's ruling, 14 Oct), because colour cycling floods most of the board within par + 2 and kept 85 on the old factor: random colours and cycling now score 0 (median and max, apart from cycling's one genuine finish), the average band 98 → 96.
- The free mistakes ruled "keep by design" on 10 Oct failed rule b for Tents and Trees (tents around every tree scored 110), so wrong tents now cost 10; Lookout's wrong picks cost 2 beyond the first 5; Trail's wrong tiles count against; Matchmaker's mismatched tries cost 1 beyond 25.
- The scorers scale by type constants (`PIPES_CELLS` 49, `FLOOD_CELLS` 196, `SHIKAKU_CELLS` 100, `TILES_COUNT`, `RINGS_SEGMENTS`), not the stored board's size; every board today has those sizes.

---

## 10. Arcade — 22 active (Junction practice only; Pinball dealt in rooms from 14 Oct)

### 10.1 How arcade rounds are scored

- **Deterministic replay.** Every arcade game runs on the engine (60 ticks a second, integer 1/256 px physics, a seeded PRNG in the state). The phone records each input on the sim tick it applied; the server replays the log on the stored seed and stores the sim's own score. The phone's score is only compared to flag a mismatch.
- **Run length** = registry limit − 3 s (`ARCADE_PHASE_SLACK_MS`).
- **The Oct 2026 score bands** (`scoreBands.ts`, `bandParts.ts`; full history and measurements in `docs/arcade-score-bands-oct-2026.md`). A game counts its achievement in **units** (buckets, bricks, metres, match points…). A **band curve** turns units into points: straight lines between a few knots from (0, 0), floored (`bandPoints`); more achievement never scores less.
  - **Finish games** (a clear, a finish line, or surviving the clock): the curve tops out at 140 (`BAND_PARTIAL_TOP`); finishing adds up to 10 (`BAND_FINISH_BONUS`): a flat 10 (`bandFinishFlat`), or PAR(10) over the game's window (`bandFinishSpeed`). One unit short of a finish is never more than 12 below the best finish.
  - **Open games** (no finish): the curve tops out at 150 at a near-perfect figure (`bandOpen`).
  - Total = clamp(points + bonus − penalty, 0, 150) (`bandTotal`); **a run with no input scores 0** (`acted`).
  - Which rules apply is decided by the state, not the puzzle: the revision's `<game>GameFor(rev)` init calls `bandInit` (`band: 1, acted: 0`) and `bandScoreOf` scores by `state.band`, else by the original formula; the reveal does the same. `BAND_STAMPS` / `puzzleUsesBands` (stamp ≥ the band revision) are used by the checks.
  - Each band revision plays the previous live revision unchanged; later revisions (Tunings A, B, C, E, F) change play or curves under new stamps. Every "?" help string is generated from the current curve (`bandHelp`), so the help shows the live knots.
- **Target bands** (the same simulated skill level should land in a similar band in every game, measured by `scripts/arcade-skill-bands.ts` through the server's own replay): average 60–80 (aim 70), good 90–110 (aim 100), great 115–135 (aim 125), near-perfect 140–150, a perfect run 150.

### 10.2 Current scoring per game

PAR(10) below is the 50 % par curve over the stated window. Penalties marked "units" come off before the curve.

| Game (id) | Stamp | Run | Kind | Units counted | Knots (units → points) | Finish bonus | Penalties | File + function |
|---|---|---|---|---|---|---|---|---|
| Ball Tracker (`balltrack`) | btRev 3 | 60 s | finish | 1 per marble home (of 30) | 10 → 32, 19 → 70, 26 → 104, 28 → 126, 29 → 138, 30 → 140 | all 30 home: PAR(10) over the landing window (53 s to the buzzer): the full 10 if the last lands by 56.5 s | none (wrong trays are free) | `ballTrack.ts btBandParts` |
| Breaker (`breaker`) | brkRev 5 | 90 s | finish | 1 per brick (of 80) | 60 → 70, 67 → 100, 76 → 125, 79 → 138, 80 → 140 | wall cleared: PAR(10) over 90 s | none (losing the last ball costs 3 s) | `breaker.ts breakerBandParts` |
| Coral Pop (`bubble`) | bubbleRev 4 | 90 s | finish | 1 per bubble cleared (of 67) | 36 → 70, 50 → 100, 60 → 120, 64 → 132, 66 → 138, 67 → 140 | field cleared: PAR(10) over 90 s | none | `bubble.ts bubbleBandParts`; bubbleRev 4's torpedo flies where aimed and destroys only the bubbles it touches (up to 6), then the normal drop |
| Fission (`burst`) | burstRev 3 | 90 s | finish | 1 per atom hit, −5 units per life lost | 55 → 70, 76 → 100, 88 → 125, 100 → 140 | flat 10 for lasting 90 s | −5 units per life (3 lives) | `burst.ts burstBandParts` |
| Flightpath (`bullseye`) | bullRev 4 | 45 s | open | dart total: rings 10 / 9 / 8 / 3 / 2 / 1 from the centre (`BULLSEYE_RING_VALUES`; values swap places from dart 7), inner bull 12, balloons +1 / +2 / +3 | 75 → 70, 82 → 100, 92 → 125, 101 → 145, 112 → 150 | — | none | `bullseye.ts bullseyeBandParts` (`BULLSEYE_V4_BAND_CURVE`) |
| Gemstone (`matchup`) | matchupRev 6 | 60 s | open | match points (longer lines, cascades and specials score more) | 620 → 70, 1,008 → 100, 1,456 → 125, 2,240 → 145, 2,800 → 150 | — | none | `matchup.ts matchupBandParts` (`MATCHUP_V6_BAND_CURVE`) |
| Grappler (`swing`) | swingRev 8 | 60 s | finish | 1 per metre (to 500) + 5 per star (10, one per equal stretch of the run) | 86 → 63, 162 → 90, 245 → 112, 400 → 122, 499 → 124, 550 → 140 | flat 10 for reaching 500 m | none | `swing.ts swingBandParts` (`SWING_V7_BAND_CURVE`) |
| High Rise (`skyline`) | skylineRev 4 | 60 s | open | 5 per block + 5 per perfect drop + 2 per streak point (each perfect from the 3rd in a row) | 100 → 70, 165 → 100, 280 → 125, 480 → 145, 600 → 150 | — | none | `skyline.ts skylineBandParts` |
| Hover (`hover`) | hoverRev 5 | 60 s | finish | 3 per barrier (42) + 2 per star (10) | 24 → 63, 45 → 90, 65 → 112, 100 → 122, 123 → 125, 146 → 140 | flat 10 for lasting the minute | none | `hover.ts hoverBandParts` (`HOVER_V5_BAND_CURVE`) |
| Jaywalk (`cross`) | crossRev 5 | 60 s | open | 1 per lane crossed + 2 more per full crossing | 41 → 70, 50 → 100, 59 → 125, 66 → 145, 77 → 150 | — | none (3 lives; the walker's hit box is 13 px either side, 16 before crossRev 5) | `cross.ts crossBandParts` |
| Meteor (`snake`) | snakeRev 6 | 60 s | open | 1 per star eaten | 15 → 70, 21 → 100, 26 → 125, 29 → 142, 33 → 150 | — | none | `snake.ts snakeBandParts` (`SNAKE_V6_BAND_CURVE`) |
| Orbit (`orbit`) | orbitRev 7 | 90 s | finish | furthest planet reached (of 40; the sun is 40; black-hole skips count) | 12 → 70, 20 → 100, 30 → 125, 36 → 135, 39 → 138, 40 → 140 | sun reached: PAR(10) over 90 s | none | `orbitRev3.ts orbitBandParts` |
| Rainbow Bridge (`inkbridge`) | inkRev 6 | 120 s | finish | 10 per level + 2 per star (4) | 10 → 33, 20 → 51, 40 → 79, 60 → 103, 80 → 120, 90 → 129, 108 → 140 | all ten levels: PAR(10) over 120 s | none (three failed drops end the run) | `inkBridge.ts inkBridgeBandParts` (`INK_V6_BAND_CURVE`) |
| Rally (`rally`) | rallyRev 5 | 60 s | open | 5 per gold-ball hit + 6 per pink target | 105 → 70, 130 → 100, 146 → 125, 185 → 145, 250 → 150 | — | none (losing the blue ball ends the run) | `rally.ts rallyBandParts` (`RALLY_V5_BAND_CURVE`) |
| Roofbound (`flip`) | flipRev 4 | 60 s | finish | 1 per half second lasted + 3 per star (10) | 40 → 17, 105 → 77, 130 → 110, 140 → 132, 150 → 140 | flat 10 for lasting the minute | none | `flip.ts flipBandParts` (`FLIP_V4_BAND_CURVE`) |
| Scrumper (`snip`) | snipRev 7 | 60 s | finish | 10 per apple + 2 per leaf | 54 → 70, 74 → 100, 90 → 134, 120 → 140 | all ten apples: PAR(10) over 60 s | none | `snip.ts snipBandParts` (`SNIP_V5_BAND_CURVE`) |
| Slice (`slice`) | sliceRev 5 | 60 s | open | combo-weighted slices (one path up to 620 px, the world's height; 465 before sliceRev 5) ÷ the most the run offers (every food at ×3), in thousandths | 435 → 78, 670 → 105, 755 → 130, 835 → 147, 900 → 150 | — | −10 per chilli after the curve (the only post-curve penalty) | `slice.ts sliceBandParts` (`SLICE_V4_BAND_CURVE`) |
| Swish (`bintoss`) | binRev 4 | 60 s | finish | 10 per bucket + 3 per hoop (3) | 45 → 70, 70 → 100, 80 → 118, 90 → 138, 109 → 140 | flat 10 for all ten in | none | `binToss.ts binTossBandParts` |
| Tempo (`beat`) | beatRev 5 | 60 s | open | (4 × Perfect + 3 × Good + 1 × OK − 2 × miss) ÷ (4 × notes), in thousandths | 662 → 75, 869 → 114, 951 → 140, 990 → 149, 1,000 → 150 | — | a miss −2 quarter-notes (units) | `beat.ts beatBandParts` (`BEAT_V5_BAND_CURVE`) |
| Tilt (`tilt`) | tiltRev 4 | 90 s | finish | 30 per maze (4) + best progress toward the exit in the current maze (0–29) + 5 per star (8) | 50 → 35, 86 → 70, 100 → 100, 114 → 125, 140 → 137, 160 → 140 | all four mazes: PAR(10) over 60 s to the buzzer (`TILT_V4_FINISH_MIN`): the full 10 by 75 s | none (a hole ends the run) | `tilt.ts tiltBandParts` (`TILT_V4_BAND_CURVE`) |
| Wavefront (`wavefront`) | wavRev 5 | 90 s | finish | 1 per ship, armour hit, boss hit and saucer + 15 per wave cleared | 100 → 25, 180 → 50, 211 → 70, 218 → 100, 245 → 112, 266 → 125, 268 → 138, 269 → 140 | boss destroyed: PAR(10) over 40 s from its arrival: the full 10 within 20 s, 0 at 40 s | none (3 lives) | `wavefront.ts wavefrontBandParts` (`WAV_V5_BAND_CURVE`) |
| Pinball (`pinball`) | pinRev 1 | 60 s, 3 balls | open | table points, multiplier included: bumper 100, slingshot 10, drop target 400, full bank of four 2,500, lane lit 100 (again 20), all three lanes 1,000 and the multiplier +1 (to ×5), spinner 25 a turn (100 while lit after a bank); a drain resets the multiplier, lanes, targets and spinner | 5,250 → 70, 7,400 → 100, 8,650 → 125, 15,000 → 145, 24,000 → 150 | — | none (a drained ball relaunches; three drains end the run) | `pinball.ts pinballBandParts` (`PIN_BAND_CURVE`) |
| *Junction (`junction`), practice only* | junctionRev 3 | 60 s | finish | 2 per car + 3 per bus + 4 × (ambulances through − stopped) − 1 per driver who gives up | 50 → 40, 89 → 70, 108 → 100, 118 → 120, 130 → 140 | flat 10 for lasting the minute | in the units (a crash ends the run) | `junction.ts junctionBandParts` |

**Pinball.** Pinball (`pinball`, working title, 13 Oct) is dealt in rooms from 14 Oct (`PINBALL_IN_ROOMS` is `true` in `pinball.ts`), one of the 22 active arcade games (74 active, 28 retired). It is scored as shown in its row above: stamp `pinRev 1`; open curve on `PIN_BAND_CURVE` with knots 5,250 → 70, 7,400 → 100, 8,650 → 125, 15,000 → 145, 24,000 → 150; 0 with no input. Table-point sources (each × the current multiplier): pop bumper 100 (`PIN_PTS_BUMPER`), slingshot 10 (`PIN_PTS_SLING`), drop target 400 (`PIN_PTS_TARGET`), all four targets 2,500 more (`PIN_PTS_BANK`), a top lane lit 100 or 20 if already lit (`PIN_PTS_LANE`, `PIN_PTS_LANE_AGAIN`), all three lanes 1,000 (`PIN_PTS_LANE_SET`) and the multiplier +1 to ×5, spinner 25 a turn or 100 while lit after a bank (`PIN_PTS_SPIN`, `PIN_PTS_SPIN_LIT`). A drain resets the multiplier, lanes, targets and the lit spinner.

### 10.3 Bands per game (measured medians at the current revision)

Medians of the simulated players at each level (30–100 room seeds), from `docs/arcade-score-bands-oct-2026.md`, taking each game's latest measurement (the band pass, then Tuning A, B, C, E or F where the game changed).

| Game | Revision measured | Average | Good | Great | Near-perfect | Notes |
|---|---|---|---|---|---|---|
| Ball Tracker | btRev 3 | 70 | 102 | 126 | 138 | |
| Breaker | brkRev 5 | 67 | 103 | 131 | 141 | |
| Coral Pop | bubbleRev 4 | 64 | 107 | 126 | 129 | Tuning F, 60 seeds (rev 3 on the same seeds 62 / 105 / 126 / 129); near-perfect bots barely beat great |
| Fission | burstRev 3 | 70 | 111 | 136 | 137 | |
| Flightpath | bullRev 4 | 68 | 100 | 125 | 142 | |
| Gemstone | matchupRev 6 | 70 | 83 | 95 | 105 | Tuning F, 60 seeds (rev 5: 70 / 88 / 103 / 112); below band from good up: the bots never plan cascades; Joe's par is now 2,800 |
| Grappler | swingRev 8 | 63 | 100 | 114 | 131 | Tuning F, 60 seeds (rev 7: 67 / 91 / 116 / 123); about 10 % lower by design (Joe found it lenient) |
| High Rise | skylineRev 4 | 71 | 99 | 124 | 145 | |
| Hover | hoverRev 5 | 66 | 87 | 119 | 123 | about 10 % lower by design |
| Jaywalk | crossRev 5 | 69 | 96 | 121 | 133 | Tuning F, 60 seeds (rev 4 on the same seeds 67 / 96 / 109 / 127) |
| Meteor | snakeRev 6 | 68 | 100 | 125 | 142 | |
| Orbit | orbitRev 7 | 76 | 100 | 128 | 136 | |
| Rainbow Bridge | inkRev 6 | 33 | 51 | 67 | 92 | fitted low on purpose; Joe's 110–124 runs land about 103–116 |
| Rally | rallyRev 5 | 72 | 78 | 124 | 145 | the simulated average and good players barely separate |
| Roofbound | flipRev 4 | 85 | 147 | 147 | 150 | the game doesn't separate good from near; about 10 % higher by design |
| Scrumper | snipRev 7 | 70 | 104 | 134 | 136 | Tuning F, 60 seeds (rev 6: 73 / 102 / 132 / 135); nearly flat from nine apples up |
| Slice | sliceRev 5 | 71 | 105 | 130 | 131 | Tuning F, 60 seeds (rev 4: 74 / 105 / 129 / 126) |
| Swish | binRev 4 | 69 | 100 | 127 | 138 | |
| Tempo | beatRev 5 | 75 | 114 | 140 | 148 | about 10 % higher by design (Tuning C levels kept) |
| Tilt | tiltRev 4 | 71 | 99 | 124 | 121 | near players fall chasing hole stars |
| Wavefront | wavRev 5 | 72 | 100 | 128 | 139 | |
| Junction (practice) | junctionRev 3 | 80 | 111 | 114 | 140 | |
| Pinball | pinRev 1 | 70 | 100 | 123 | 144 | 30 seeds; p10–p90 23–102 / 41–137 / 74–145 / 119–149; near-perfect reaches 150 in 2 of 30 |

### 10.4 Arcade notes

- Help and intro wording (fixed 13 Oct 2026, text only): Fission's and Junction's "?" help name their penalties in units (Fission's intro: a lost life takes 5 hits off); Flightpath's help and intro list the ring values 10 / 9 / 8 / 3 / 2 / 1 and the inner bull 12 from `BULLSEYE_RING_VALUES` / `BULLSEYE_INNER_BULL_POINTS`; Wavefront's intro names armour hits; Letterfall's intro and help say a Qu tile counts as two letters. The knots in every help string match the code.
- Display only (Tuning F, 14 Oct 2026): Hover's arena border lights (the edge bulbs round the arena) are a very faint flash at each barrier passed (`HOVER_BARRIER_LIGHT`, about a fifth of before) and a stronger blink every 7th (`HOVER_ZONE_LIGHT`, under half its old strength); the barriers' own effects are unchanged; Fission's arrows sit 8 px higher. No stamp: nothing a sim, input or score reads.
- Orbit `orbitRev 7` (Tuning F) fixes black holes that did not register: on `orbitRev 4–6` a hole swallows only a flight released from the planet it sits beside, and only when the rocket's centre comes within the 13 px disc, so a flight from the planet before (often passing straight over the next hole) or a rocket overlapping the rim flew through a drawn hole. On rev 7 every hole whose target is ahead is live, the reach is the disc plus the rocket's 10 px radius (`ORBIT_HOLE_SWEPT_R`), tested along the whole tick's swept segment, and a belt wins only if the rocket meets it first along that segment.
- Orbit: if the proved course bank ever misses, `generateOrbit` falls back to an unstamped round (original rules and scoring).
- Rainbow Bridge times its finish bonus on `endedTick || tick`; every other game uses `endedTick`.
- Before the bands, idle runs scored 30 in Ball Tracker, 20 in Breaker, 19 in Junction and 16 in Wavefront; stored rounds of those revisions still do.

---

## 11. Versioned rules

Older stored rounds always replay and grade on their own rules: every gameplay or scoring change is gated on a stamp in the stored puzzle (CLAUDE.md rule 2). New rounds carry the stamps listed here.

### 11.1 Puzzle games

| Game | Field (current) | What branches |
|---|---|---|
| Every game | `speedPar` (1) | stamped: the 50 % par speed curve; unstamped: the old linear `round(P × ms ÷ limit)`. No effect where a game has no time term (Nucleus, Forage, Letterfall, Flash, Bang On, Bonk, Pull!) |
| Every game | `puzzleScoreRev` (1, 13 Oct 2026) | stamped: the puzzle score shape (section 2): a finish = 120 + up to 30, unfinished at most 110 and only the player's own progress, the per-game rules in sections 4–9 (Double Take's wrong-tap cost and 5-tap allowance, Counterweight any order, Integer Pyramid's server-picked pyramid, Roundabout's slot-count verdict, Bang On's all-miss 0, wasteFactor, start states subtracted …); the stored breakdown `extra.parts`. Unstamped: the 13 Oct shapes, byte for byte (`puzzle-score-rev-check`). No effect on arcade games or Interloper. Slider's generator also stops dealing word rows on new puzzles |
| Flash, Bang On | `tapRev` (2, 13 Oct 2026) | the tap log of `tapRev: 1`, scored with the careless-play costs (section 6: Flash's 11 per false start after the first two, Bang On's fall to 0 at 325 ms); `tapRev: 1` rounds keep the 8-per-false-start and 74-at-300 ms scores (`careless-play-check`). Ascend stays on 1 |
| Flash, Bang On, Ascend | `tapRev` (1) | stamped: the answer is a raw tap log (`log1:`, up to 16,000 characters and 1,000 taps) replayed by the server (section 14); unstamped: the original summary answers ("t1,t2,…\|falseStarts"; "d1,…,d10"; "reached,errors,…") with clamps only. The phone keeps a `LegacyStage` for unstamped rounds. The legacy Ascend phone sent nothing for an unfinished run (0) |
| Don't Break the Chain | `chainTimeRev` (1, 13 Oct 2026) | stamped: time left for the finish bonus (and the stored `ms_remaining`) is the receipt-checked claim but never more than 45,000 less the replayed last tap's time; unfinished runs unchanged. Unstamped: the claim alone (`chain-time-check`) |
| Don't Break the Chain | `rulesVersion` (2) | legacy only when the version isn't 2 **and** the stored board count gives 25 or 30 links: 6 or 5 per link, no bonus, momentum {≤ 10: 3,000 ms, ≤ 18: 2,500, rest: 2,000}, FASTER at 10 / 18 / 26; any other unversioned board uses the current rules. No `cycles` → the single legacy `cycle` |
| Mixed Signals (`stroop`) | `clashRev` (4), `queue` (52) | V4 (`clashRev` 4, 13 Oct 2026): V3's play, scored on the puzzle shape (section 7); V3 (`clashRev` 3): 75 s, fall ticks [107, 95, 83, 71, 59]; V2 (`queue` 52): 60 s, [95, 77, 65, 41]; V1 (`queue` 18): 60 s, legacy curve round(180 × 0.88^phase); V0: 60 s open stream, score clamp(round(150 × correct ÷ items) − 2 × wrong, 0, 150), no bonus. V1–V3 use the 130 queue formula |
| Pull! | `clayRev` (4) | 4 (13 Oct 2026): rev 3's clays and birds, plus 1 per 20 empty shots beyond 30 (the sim plays tick for tick as rev 3; only the score differs); 3: 10–12 birds; 2: 3–4 birds; anything else: no birds, no bird penalty, perfect = all 25 clays |
| Operator | stage count | 3 stored stages (legacy): 30 / 40 / 50 + speed 30; 4 stages: 25 / 30 / 35 / 40 + speed 20 (`EQUATION_STAGE_POINTS`, `EQUATION_SPEED_POINTS`) |
| Tenfall | `tenRev` (1, 13 Oct 2026) | 1: the puzzle shape (all ten = 120 + PAR(30); else 110 × cleared ÷ 9 − 2 per reset beyond 5), carried in the sim state (`scoreRev`); missing: 13 per target, all ten 130 + PAR(20). Play and checkpoints are the same |
| Bomb Defusal | `bombVersion` (2) | 2: six steps, 6–9 rule card, 90 s stored on the puzzle, partial round(75 × steps ÷ 6), drawn from the 300-bomb v2 bank; missing: 4 steps, 6 rules, 75 s, 25 per step up to 75. Very old rows grade from `required ?? sequence` |
| Lightbender | stored pieces | old rounds may have fixed `splitters[]`; new ones a movable splitter (`splitterPieces: 1`). Scoring is the same |
| Colour Flood | `floodRev` (1), `moveLimit` (13 Oct 2026) | 1: taps after the `moveLimit`-th (par + 2) are ignored, so running out ends the board unfinished, and the unfinished waste factor falls from 1 at par to 0 at the limit; missing: no limit, waste factor 0 at 4× par |
| Polypotions | `tubesRev` (1), `pourLimit` | 1: the answer is a pour log with Undo `u` and Reset `r`; every pour counts (MOVES and wasteFactor included) and pours after the `pourLimit`-th are ignored; missing: the plain pour list, Undo removed pours, no limit |
| Topsy-Turvy | `gravityRev` (1), `tiltLimit` | 1: tilts after the `tiltLimit`-th are ignored; missing: no limit |
| Counterweight | `balanceRev` (1), `placeLimits` | 1: scales 1–2 generated with one balanced arrangement; the answer ends `#h1,h2,h3` (the phone's hang counts) and a scale over its limit does not count; extra adds `hangs`, `placeLimits`; missing: no limit, in-order or any-order credit as before |
| Operator | `equationRev` (1), `tryLimit` (3) | 1: the answer ends `#t1,…,t4` (the phone's full tries) and an equation over the limit does not count; extra `{ tries, tryLimit }`; missing: no limit, no extra |
| Brimful | `measureRev` (2), `moveLimits` | 2: each board stops at its move limit (3 × the minimum, rounded up to a 5); 1: no limit (the marker the batch shipped with) |
| Tally | `countRev` (1) | 1: counts drawn from 5–11, 7–13, 9–15 (generation only; grading reads the stored scene either way); missing: 6–10, 8–12, 10–14 |
| Strikeout, Cryptogrid, Swapword, Letterfall, Brimful, Checkout, Ballpark | `strikeoutRev`, `codewordRev`, `swapwordRev`, `wordfallRev`, `measureRev`, `checkoutRev`, `numlineRev` (all 1) | markers only: nothing branches on them yet |

**Compatibility constants (not scoring versions):** Spatial Memory's `groupSize` (always 2) and Nucleus's `WORDSMITH_CENTRE_INDEX = 4` keep old stored puzzles aligned.

### 11.2 Arcade revisions

Each revision is chosen by `<game>GameFor(rev)`; new state fields exist only on stamped runs and fold into the checkpoint checksum after the unchanged fields, so older states stay byte-identical. Polish F, Polish G and Tuning D changed drawing and effects only and carry no stamps. "Bands" = the Oct 2026 score-band revision (12 Oct).

| Game | Revisions (unstamped → current) |
|---|---|
| Ball Tracker (`btRev`) | unstamped: round(130 × home ÷ 30), all home = `finishScore` on the 60 s timing (most 135) · 2 (Batch 1, 11 Oct): occupied tubes turn, bottom-row switch drops, bonus over the landing window · **3** (bands) |
| Breaker (`brkRev`) | unstamped: full-column laser, ×5, two double-ball bricks; round(130 × bricks ÷ 80), clear = `finishScore` · 2 (Batch 3): 5 s Fireball, 4-brick laser, ×3, one double ball, two sliding rows · 3 (bands) · 4 (Tuning B): Fireball 3.5 s · **5** (Tuning F): Fireball 2.5 s |
| Coral Pop (`bubbleRev`) | unstamped: round(130 × share cleared), clear = `finishScore` · 2 (Batch 2): Joker every 15 shots, a mine and a torpedo every 60, partial out of 100 · 3 (bands): Joker every 22 shots, one mine or torpedo in the first 60 · **4** (Tuning F): the torpedo flies where aimed and destroys only what it touches, up to 6 (rev 2–3 clear its whole row) |
| Fission (`burstRev`) | unstamped: 2 per hit − 9 per life; 150 for a full run with no life lost and 4+ waves · 2 (Batch 3): rarer BURST and SHIELD, FREEZE drop, partial cap 130 · **3** (bands) |
| Flightpath (`bullRev`) | unstamped: floor(1.7 × total − 20) · 2 (Batch 5): inner bull 12, 12-point balloon · 3 (bands) · **4** (Tuning B): drifting +1 / +2 / +3 balloons, knots refitted |
| Gemstone (`matchupRev`) | unstamped: floor(150 × points ÷ 2,500) · 2 (Batch 2): Jackpot gem, constant play, par 5,000 · 3 (Batch 2 fixes): original-speed falls, par 5,500 · 4 (bands): 150 at 1,300 · 5 (Tuning C): each swap waits for the board to settle, 150 at 2,500 · **6** (Tuning F): rev-5 play, 150 at 2,800 (knots from 100 up × 1.12) |
| Grappler (`swingRev`) | unstamped: round(130 × m ÷ 500), 500 m = `finishScore` · 2–3 (Lovable): small, then bigger dragons · 4 (Batch 3): chasing dragon from 200 m, stalactites, lava jets, star anchors; round(120 × m ÷ 500) + stars · 5 (bands) · 6 (Tuning A): touch stars on proved lines, 2 s stalactite crumble · 7 (Tuning C): about 10 % lower · **8** (Tuning F): the ten stars spread one per equal stretch of 30–490 m (same cavern, hazards and curve) |
| High Rise (`skylineRev`) | unstamped: floor(2.5 × blocks + 3 × perfects) · 2 (Batch 4): gusts from block 20, perfect-streak bonus · 3 (bands; Tuning A changed the flag art only) · **4** (Tuning E): taller 390 × 735 view, same play and curve |
| Hover (`hoverRev`) | unstamped: round(150 × barriers ÷ total) · 2 (Batch 2): gold stars, two-gap and sliding barriers, 130 + 20 · 3 (bands) · 4 (Tuning C): about 10 % lower · **5** (Tuning E): 390 × 735 world, the same course drifting over the extra height (≤ 22 px a climb) |
| Jaywalk (`crossRev`) | unstamped: 2 per lane + 4 per crossing · 2 (Batch 1): fair crossings 1–2, cyclist lanes from 3, roadworks from 4 · 3 (Batch 1 fix): three riders per cyclist lane at uneven gaps · 4 (bands) · **5** (Tuning F): walker hit box 13 px either side (was 16), same courses and curve |
| Meteor (`snakeRev`) | unstamped: 5 per star, 15 × 20 grid · 2 (Batch 2): seeded rocks, head-only hits · 3 (Batch 2 fixes): one 20-star meteor shower (at most 11 rocks) · 4 (bands) · 5 (Tuning E): 15 × 28 grid (390 × 724), 150 at 34 stars · **6** (Tuning F): more rocks (from length 9, every 4 stars, up to 11; 14 with the shower), 150 at 33 stars |
| Orbit (`orbitRev`) | unstamped: original course; 3 per planet, sun = `finishScore` · 3 (Lovable): wide zig-zag course from the proved bank · 4 (Batch 5): three black holes · 5 (bands) · 6 (Tuning A): fly-in after a black hole, a missed hop ends sooner · **7** (Tuning F): swept black holes (every hole ahead, the rocket's whole body, ordered against belts) |
| Rainbow Bridge (`inkRev`) | unstamped: block obstacles; 11 per level, all 10 = `finishScore` · 2–3 (Lovable): birds; moving pot on 5–8, live drawing on 9–10 · 4 (Batch 5): optional stars · 5 (bands) · **6** (Tuning C): knots at about 93.5 % |
| Rally (`rallyRev`) | unstamped: floor(2.5 × gold hits) · 2 (Batch 5): two +3 pads, bumper from 30 s · 3 (bands) · 4 (Tuning B): each pad stays in its own half, knots refitted · **5** (Tuning F): a second bumper from 45 s, knots refitted |
| Roofbound (`flipRev`) | unstamped: floor(150 × (s ÷ 60)²), bend from 20 s · 2 (Batch 1): crumble tiles, 10 proved stars, bend from 15 s · 3 (bands) · **4** (Tuning C): bend from 10 s, about 10 % higher |
| Scrumper (`snipRev`) | unstamped: templates 0–9 in a fixed order · 2 (Lovable): 3 easy / 4 medium / 3 hard of 30 templates · 3 (Batch 4): 60 orchard templates (branches, planks, gutters, sliding basket, wasp nests) · 4 (bands) · 5 (Tuning E): tall 360 × 640 bank, 2 easy / 3 medium / 5 hard, picker's crooks, lower knots refitted · 6 (bank growth): 67 tall levels · **7** (Tuning F): each pin's wobble one of −10 / −5 / 0 / +5 / +10 px on the same stream, every one of the 4,435 deals proven by a stored plan, Crook gutter run dealt as a fixed copy (template 129) |
| Slice (`sliceRev`) | unstamped: floor(235 × weighted ÷ (3 × foods)) − 10 per chilli · 2 (Batch 1): mayonnaise Squeeze, a chilli ends the combo · 3 (bands) · 4 (Tuning C): blade 4 px wider each side, cuts 50 % back past the start · **5** (Tuning F): one path may run 620 px (the world's height; was 465) |
| Swish (`binRev`) | unstamped: 10 per bucket, 10/10 = `finishScore` · 2 (Lovable): catch zone 85 % · 3 (Batch 5): hoops and spinners, exact quarter-bucket wind · **4** (bands) |
| Tempo (`beatRev`) | unstamped: floor((4P + 3G + OK − 8M) ÷ 4) · 2 (Batch 5): swipe notes from 30 s · 3 (bands; a miss −2) · 4 (Tuning C): about 10 % higher · **5** (Tuning F): a tenth fewer notes, knots moved to keep Tuning C's levels |
| Tilt (`tiltRev`) | unstamped: 30 per maze, 4 = `finishScore` · 2 (Batch 4): stars, amber marble from maze 3 · 3 (bands; Tuning A re-deals seeds so every cup is reachable) · **4** (Tuning C): amber starts far from its cup, stars at hole mouths, finish window from 60 s, knots refitted |
| Wavefront (`wavRev`) | unstamped: 60 s, floor(150 × units ÷ 248) · 2 (Batch 3): 90 s, fly-ins, divers, five waves and a boss · 3 (bands) · 4 (Tuning A): shaped waves 2–5 · **5** (Tuning C): waves 3–4 drop three quarters of a row, saucer 1 unit, timed kill bonus |
| Pinball (`pinRev`) | **1** (13 Oct, new): the first table, born on the bands (no unstamped rounds exist; an unstamped puzzle plays rev 1); `scripts/fixtures/pinball-rev1.json` holds real rev-1 runs that must replay to their stored scores |
| Junction (`junctionRev`) | unstamped: 2 per car ± 4 per ambulance − give-ups + 40 for the minute · 2 (Batch 4): diagonal roads every 12 s, buses, + 20 · **3** (bands); retired to practice in Tuning C with no new stamp |

Proofs: `pinball-check` (stored pinRev 1 runs, long replays, swept contacts), `arcade-batch1`–`5-check`, `arcade-score-bands-check`, `arcade-tuning-a-check`, `tuning-b-check`, `arcade-tuning-c-check`, `arcade-tuning-e-check`, `arcade-tuning-f-check` and `arcade-tuning-f2-check` replay runs recorded on the code before each change to the same score and state; `arcade-self-replay-check` covers every revision.

## 12. Retired games (practice only, `RETIRED_TYPES`)

Never dealt in rooms; still playable in practice, and stored rounds replay and score on their own rules. "speedBonus(ms, L)" is the par curve on stamped puzzles (50 with half the time left, else round(100 × ms ÷ L)) and linear on unstamped ones.

| Game (id) | Cat | Time limit | Complete | Bonus | Unfinished / wrong | Items / notes | File + function |
|---|---|---|---|---|---|---|---|
| Interloper (`intruder`) | attention | 75,000 ms | all 5 boards right: 130 + PAR(20) (`scoreIntruder`; unchanged on every revision, including `puzzleScoreRev: 1`) | PAR(20) | 24 per board right, 12 for one of two changes | retired 13 Oct 2026 (Rotation and shared screens); only the first N taps per board are read | `scoring.ts scoreIntruder`; `intruder.ts replayIntruder` |
| Groups (`groups`) | word | 90,000 ms | 4/4: 100 + speedBonus(ms, 90,000) | speed, on all 4 | 3 → 60, 2 → 40, 1 → 20 | 4 groups | `scoring.ts scoreGroups` |
| Word Match (`wordmatch`) | word | 45,000 ms | all 8: 100 + speedBonus(ms, 45,000) | speed, on all 8 | min(90, 13 × correct) | 8 pairs | `scoring.ts scoreWordMatch` |
| Word Ladder (`ladder`) | word | 60,000 ms | 100 + speedBonus(ms, 60,000) + 20 for a minimum-length path | +20 at minimum | 1 letter away → 75, 2 → 50, 3 → 25 | — | `scoring.ts scoreWordLadder` |
| Chain Calculation (`chaincalc`) | number | 45,000 ms | correct → 100 + speedBonus | speed | wrong → 0 | — | `grade.ts` default → `scoreRound` |
| Number Sequence (`numseq`) | number | 45,000 ms | all 5: 20 × 5 + speedBonus(ms, 45,000) | speed, on all 5 | 20 × correct | 5 items | `scoring.ts scoreNumberSequence` |
| Percent Sprint (`pctsprint`) | number | 45,000 ms | all 5: 100 + speedBonus(ms, 45,000) | speed, on all 5 | round(100 × correct ÷ 5) | 5 items | `scoring.ts scorePercentSprint` |
| Sum Hunt (`sumhunt`) | number | 90,000 ms (`SH_TIME_MS`) | all 9 stages cleared: 100 + speedBonus(ms, 90,000) | speed | min(80, 10 × (stage − 1)) | 9 stages (`SH_STAGES`); paths replayed | `sumHunt.ts sumHuntRoundScore` |
| Sequence Recall (`sequence`) | memory | 30,000 ms | 100 + speedBonus | speed | 0 | — | default → `scoreRound` |
| Reverse Recall (`reverse`) | memory | 30,000 ms | 100 + speedBonus | speed | 0 | — | default → `scoreRound` |
| Spatial Memory (`spatial`) | memory | 20,000 ms | 100 + speedBonus | speed | 0 | 8 tiles in 4 pairs | default → `scoreRound` |
| Number Climb (`numclimb`) | memory | 20,000 ms + 6,000 ms prep | 12/12: 100 + speedBonus(ms, 20,000) | speed, on all 12 | min(90, round(100 × correct ÷ 12)) | 12 digits | `scoring.ts scoreNumberClimb` |
| Go / No-Go (`gonogo`) | speed | 30,000 ms; stores 0 ms | 12/12: 100 + reactionBonus(average hit ms) | reaction bonus only if flawless | min(90, round(100 × correct ÷ 12)) | 12 items; trusts `extra.correctCount` and `extra.reactionAvgMs` (section 14) | `scoring.ts scoreGoNoGo` |
| Pattern Completion (`patcomp`) | pattern | 30,000 ms | 3/3: 100 + speedBonus(ms, 30,000) | speed, on all 3 | round(100 × correct ÷ 3) | 3 boards | `scoring.ts scorePatternCompletion` |
| Spin (`spin`) | pattern | 45,000 ms | all 8: 100 + speedBonus(ms, 45,000) | speed, on all 8 | round(100 × correct ÷ 8) | 8 items | `scoring.ts scoreSpin` |
| Mirror Match (`mirmatch`) | pattern | 60,000 ms | all 5: 100 + speedBonus(ms, 60,000) | speed, on all 5 | round(100 × correct ÷ 5) | 5 items | `scoring.ts scoreMirrorMatch` |
| One-Stroke (`stroke`) | logic | 30,000 ms | 100 + speedBonus(ms, 30,000) + 20 if first try | `STROKE_FIRST_TRY_BONUS` 20 | min(60, round(60 × best ÷ total)) | — | `scoring.ts scoreStroke` |
| Dig (`dig`) | logic | 60,000 ms | cleared: min(150, 100 + speedBonusCurve(50, ms, 60,000) + 20 if within the planned digs) | `DIG_MIN_BONUS` 20 | min(90, round(100 × clean collected ÷ targets)) | — | `dig.ts scoreDig` |
| Rooftop Run (`rooftop`) | arcade | 63,000 ms (60 s run) | lasting the run: 150 | — | trunc(150 × t² ÷ run²) | ticks survived | `rooftop.ts roofScoreOf` |
| Dual (`dual`) | arcade | 63,000 ms (60 s run) | lasting the run: 150 | — | trunc(150 × t² ÷ run²) | — | `dual.ts dualScoreForTicks` |
| Swerve (`swerve`) | arcade | 63,000 ms | — | — | clamp(2 × coins, 0, 150) | 75 coins | `swerve.ts` |
| Ricochet (`ricochet`) | arcade | 63,000 ms | — | — | clamp(trunc(2 × height px ÷ 40), 0, 150) | — | `ricochet.ts` |
| Steady (`steady`) | arcade | 63,000 ms | clean run 150 | — | clamp(150 − 5 × touches, 0, 150) | — | `steady.ts` |
| Sort Rush (`sortrush`) | arcade | 63,000 ms | — | — | clamp(trunc((300 × sorted + total) ÷ (2 × total)) − 2 × wrong, 0, 150) | — | `sortRush.ts sortScoreOf` |
| Parry (`parry`) | arcade | 63,000 ms | — | — | clamp(2 × deflected − 10 × hits, 0, 150) | — | `parry.ts parryScoreOf` |
| Hot Floor (`hotfloor`) | arcade | 123,000 ms (120 s run) | — | — | clamp(15 × stage, 0, 150) | — | `hotFloor.ts` |
| Bastion (`bastion`) | arcade | 63,000 ms | — | +20 finished at full health (5), +10 finished with health left | clamp(big + trunc(small ÷ 2) + bonus, 0, 150) | — | `bastion.ts basScoreOf` |
| Junction (`junction`) | arcade | 63,000 ms (60 s run) | junctionRev 3 (band, new practice rounds): units = max(0, 2 per car + 3 per bus − 1 per driver who gave up + 4 × (ambulances through − ambulances stopped)), knots 50 → 40, 89 → 70, 108 → 100, 118 → 120, 130 → 140; +10 for lasting the minute | +10 | same curve | retired 12 Oct (Tuning C) | `junction.ts` band parts; `juncScoreOf` (pre-band) |

Junction before the bands: rev 2 = 2 × cars + 3 × buses − gave up ± 4 per ambulance + 20 for the minute; unstamped = 2 × cars − gave up ± 4 per ambulance + 40 for the minute; cap 150.

## 13. Room rotation (as coded)

| Aspect | As coded | Location |
|---|---|---|
| Round count | `roundCountFor(n)`: 7 when all seven playable categories are selected, else 6 (`MAX_ROUNDS` 7); only categories with active games count | `selection.ts`, `types.ts` |
| Category share | each selected category gets floor(6 ÷ n) rounds; the remainder go one each to distinct categories picked by the seeded RNG (4 categories: 2 extras; 5 categories: 1) | `selection.ts` |
| Order | seeded Fisher–Yates on the room seed, repeated until no category sits next to itself (a one-category room repeats it) | `selection.ts` |
| Game draw | per slot inside `withSeededRandom(seed ^ 0x5a17c0de)`; no game repeats within a room | `selection.ts pickRoundOrder`, `pickType` |
| Recency | type weights `RECENT_WEIGHTS = [0.25, 0.5, 0.75]` over the host's last 3 rooms; a type played in the previous room is excluded while its category keeps ≥ 3 alternatives (`EXCLUDE_MIN_ALTERNATIVES`); categories are not recency-weighted | `selection.ts`, `duel.functions.ts` |
| Seed | `newRoomSeed()` (31-bit, crypto) at room start; logged, not stored; the derived `round_order` and puzzles are stored; the same seed draws banked boards and word-game answers | `duel.functions.ts startRoomFn`, `generate.server.ts buildRoomPuzzles` |
| Arcade | an ordinary category: any round including round 1, no one-slot limit; an arcade-only room plays 6 different arcade games | `selection.ts`, `RoomLobby.tsx` |
| Presets | `STANDARD_CATEGORIES` = logic, pattern, speed, attention, word, arcade (one round each); "Puzzles only" = the same without arcade (6 rounds over 5 categories); Number is selectable; Memory is never offered or drawn | `categories.ts`, `RoomLobby.tsx` |
| `round_count` | inserted as `TOTAL_ROUNDS` (6), overwritten at start with the length of the dealt order | `duel.functions.ts`, `roomPhase.server.ts` |
| Pre-flight | refuses only when no selected category has active games; `setRoomModesFn` rejects empty, duplicate or unknown categories | `duel.functions.ts` |
| Removed | the round-6 weighted draw (`CORE_SIXTH_WEIGHTS`), the "arcade never round 1" rule and the `addMaths` / `addArcade` options; `add_maths`, `add_arcade`, `no_maths` remain only as database columns | — |

## 14. Trusted client inputs

**Ruling D (12 Oct 2026), the prerequisite for ranked play:** Flash, Bang On and Ascend are server-verified. Rounds stamped `tapRev: 1` (`tapLog.ts TAP_REV`, set on every new puzzle) send every raw tap on the round clock, and the server works out the score from those taps and the stored puzzle. Older rounds keep their summary answers and original grading. Since 13 Oct new Flash and Bang On puzzles are stamped `tapRev: 2` (`TAP_REV_CARELESS`): the same tap log and the same server replay, scored with the careless-play costs (section 6); Ascend stays on `tapRev: 1`.

| Game / field | What's trusted | Verification | Location |
|---|---|---|---|
| All rounds — `msRemaining` | the client's claimed time left | clamped to [0, limit] and checked against the server's clock + 1.5 s (`TIME_CLAIM_TOLERANCE_MS`); over that, the server's value is used | `grade.ts trustedMsRemaining`, `submitAnswerFn` |
| Flash (`reaction`), `tapRev: 1` — answer `log1:t,t,…` | **only the tap times** (ms on the round clock, measured by the phone's server-synced clock) | the server replays the taps against the stored flash schedule (`replayFlash`): a tap counts for a gold flash from 100 ms (`FLASH_FASTEST_MS`) to 1,500 ms after it appears; every other tap (dark screen, decoy, faster than 100 ms, a second tap on gold) is a false start, except that false starts under 250 ms apart count once; an untapped flash is a miss (1,200 ms). The average, false starts and score are all server-side | `tapLog.ts replayFlash`, `grade.ts` case "reaction" |
| Bang On (`stopwatch`), `tapRev: 1` — answer `log1:t,t,…` | **only the tap times** | watches run on a fixed schedule (watch 1 at 800 ms, each next one 600 ms after the last was stopped or ran out of passes), so the server knows when every watch started; it places the marker and the moving target at each tap from the stored watch spec (`markerState`, `targetCentre`) and measures the distance itself (`replayBangOn`, `watchStop`). Taps in the lead-in, between watches or after the last are ignored | `tapLog.ts replayBangOn`, `stopWatch.ts`, `grade.ts` case "stopwatch" |
| Ascend (`numhunt`), `tapRev: 1` — answer `log1:n@t,…` | **only the tap times and which disc was tapped** | each tapped number is checked against the layout on screen at that moment (`ascendLayoutAt`: the 15 s moves). The next number clears; a later number, or one not on the board, is a wrong tap; a cleared number is ignored. Count reached, wrong taps and the finishing tap's time are all server-side. Time left is the phone's claim (receipt-checked as above) but never more than the log's own finishing tap allows; an unfinished run stores 0 | `tapLog.ts replayAscend`, `grade.ts` case "numhunt" |
| Tap logs — repairs | nothing | the server repairs rather than rejects, and counts every repair on the round (`extra.repaired`, `clamped`, `dropped`, `reason`), as the arcade engine does: taps out of order are moved up to the tap before (never sorted into a better order); taps before the round, after it, after the server received the answer (+ 1.5 s), beyond 1,000 (`TAP_LOG_MAX`), or unreadable are dropped; a summary answer (no `log1:` prefix) is not read at all, so an old-format claim scores as no taps | `tapLog.ts readLog`, `grade.ts latestTapMs` |
| Flash / Bang On / Ascend, unstamped rounds | per-flash times and false-start count; per-watch distances; count reached and error count | clamped only (the pre-12 Oct behaviour, kept so stored rounds grade as they did) | `grade.ts` legacy branches |
| Go/No-Go (retired) — `extra.correctCount` | as sent, clamped to [0, `GONOGO_ITEMS`] | no replay | `grade.ts` case "gonogo" |
| Go/No-Go (retired) — `extra.reactionAvgMs` | as sent, clamped to [0, 5000] | no recomputation | `grade.ts` case "gonogo" |
| Every other type (standard, logic, arcade) | answer strings decoded and matched against stored content, or fully replayed (`replay*`, `verify*`, `decode*`) | full replay / verification | `grade.ts` other cases |
| Lightbender (`laser`), `alogRev: 1` — answer `alog1:<action>@<t>,…` | **only which actions were taken and when** (every placement, turn, move, removal, Reset and FIRE on the round clock) | the server replays the action log (`docs/puzzle-action-log.md`) on the stored board under the phone's own rules, counts the shots itself (a FIRE after the third is ignored) and takes the layout at each shot from the log. A solve happens only on a FIRE whose layout lights all six gems without a bomb; nothing after it counts. `scoreLaser` is called with the server's shot count. A solving layout never fired is not a solve: the final layout's gems earn the unfinished credit (15 each; the shot argument is max(1, shots), as the old draft claimed). Time left is the receipt-checked claim but never more than the solving FIRE allows. Repairs as the tap logs (out-of-order actions are put back in time order and counted, so a shuffled log replays exactly as played; before / after the round, after receipt + 1.5 s, beyond 1,500, unreadable dropped), plus actions the board refuses (piece on a fixed or occupied cell, beyond the tray, turning or moving nothing); all counted on the round (`extra.actions`, `repaired`, `reason`). An old-format answer is not read | `actionLog.ts`, `laserLog.ts replayLaserLog`, `grade.ts` case "laser"; `scripts/laser-log-check.tsx` |
| Lightbender (`laser`), unstamped rounds — shots fired | the shot count (1–3) the answer claims | not replayed: `verifyLaser` reads `max(1, min(3, shots))` and turns 0 into 3; the draft at the buzzer claims at least 1, so a solving layout never fired scores as shot 1 (kept so stored rounds grade as they did) | `laser.ts verifyLaser`, `grade.ts` legacy branch |
| Lightbender, `alogRev: 1` — what stays the phone's word | which FIREs it logs | a modified phone can leave a missed FIRE out of its log; the server then grades the legal run that never took that shot (the board is public, so a phone can trace the beam without firing anyway). Fully server-witnessed shots would need FIREs streamed live, as for tap timing | `scripts/laser-log-check.tsx` (asserted: such a log grades exactly as that legal run) |
| Integer Pyramid (`numpyramid`) — `active` | which pyramid earns partial credit | taken from the answer | `grade.ts` case "numpyramid" |
| Don't Break the Chain — time left | the claimed `msRemaining` for the finish bonus | held to the 1.5 s receipt check; on `chainTimeRev: 1` rounds also capped by the replayed last tap (as Ascend's log is); unstamped rounds keep the claim | `grade.ts` case "chain"; `scripts/chain-time-check.ts` |

**What remains client-timed (honestly).** The score can no longer be invented: the phone can't claim a reaction, distance, count or error total, only taps. But the taps themselves are still the phone's word:
- **Timing.** Every tap time comes from the phone's clock (`serverNow()`, the shared clock calibrated against the server). The server holds the log to the round, to its own receipt time + 1.5 s, and to the rules (Flash's 100 ms floor); it can't tell a real 180 ms reaction from a plausible faked one, or a real Bang On stop from a well-timed fake. Fully server-timed reactions would need taps streamed to the server as they happen; that is the next step before money play.
- **Omission.** A modified client can leave a tap out of its log (a false start, a wrong Ascend tap). The server then scores the run those remaining taps describe, which is a run the player could have played; it can't see a tap that was never sent. A wrong tap relabelled as a number that isn't on the board still counts as wrong.
- **Floating point.** Bang On's moving targets use `Math.sin`; the phone and the server compute the same formula but on different JavaScript engines, so in a vanishingly rare case a displayed "+12 ms" could be 1 ms off the server's figure. Only the server's figure is stored and shown on the reveal.

**Player-visible changes in `tapRev: 1` rounds:** Flash counts a tap within 100 ms of the gold as a false start (intro and help text updated). Bang On starts each watch exactly 600 ms after the last result instead of on the next screen frame (at most a frame earlier; not visible). Ascend now sends its log when the timer runs out, so an unfinished run earns the documented 5 per number reached − 5 per wrong tap; before, the phone sent nothing for an unfinished run and it scored 0.

**Proof:** `scripts/tap-log-check.tsx` replays 36 honest runs recorded on main before the change (`scripts/fixtures/tap-log-honest-runs.json`, from the real phone Stages played in happy-dom by `scripts/tap-log-record.tsx`): every one still grades exactly as main stored it, and as a tap log scores the same with the same tie-break time (the 3 unfinished Ascend runs aside, as above). Today's phone Stages, played by the same scripted players, reproduce main's exact answers on unstamped puzzles and send logs the server scores identically on stamped ones (6 runs per game by default, all 12 with `TAP_LOG_PARITY=all`), and the reveal shows the server's figures. 381 tampered logs (summary answers, claimed counts, impossibly fast taps, reversed order, times beyond the round or after receipt, garbage, floods, relabelled wrong taps, inflated time left) never score above the honest run.

## 15. Dead code and stale comments

Tidied on 13 Oct 2026 (puzzle score pass): `scoreSymbolScan`, `scoreEquation` and `scoreCountUp` removed from `scoring.ts` (grading uses the `stagedRounds.ts` versions); `STROOP_ITEMS` and `REACTION_FALSE_START_MS` removed; comments fixed in `scoring.ts` (Reaction, Stop Watch, Mirror Match), `types.ts` (Ascend's 24 numbers, Mirror Match's five shapes), `grade.ts` (six differences) and `parry.ts` (two per arrow).

| Item | Finding |
|---|---|
| `UNFINISHED_CAP`, `totalAnswerMs`, `MOVES_SHAPE` | exported but used only inside `scoring.ts` (kept: the stored shapes use them) |
| `add_maths` / `add_arcade` / `no_maths` | database columns and generated types only |
| `SubmitExtra.errors` | accepted, never read (Ascend's phone still sends it; tap-log rounds count errors from the log); kept so older phones still type-check |
| Stale comments left for their owners | `registry.ts` `CORE_CATEGORIES` ("always in the room draw") and `ARCADE_CATEGORY` ("one round at most, only when the host toggle is on") describe the old rotation (Rotation and shared screens owns `registry.ts`) |

---

## 16. Open items

Nothing here has been changed in the app unless it says so. Each needs Joe's ruling or a small follow-up; none affects stored rounds.

1. **Closed 13 Oct 2026** (`tieRev: 1`, section 1; `scripts/tie-break-check.ts`). ~~**Tie-break time uses a fixed 30 s.** `totalAnswerMs` adds `ROUND_MS − ms_remaining` with `ROUND_MS` = 30,000, not the game's own limit: rounds longer than 30 s can add a negative amount, and rounds stored with 0 ms left (Flash, Go/No-Go, Mixed Signals) add 30,000. It decides only ties on equal totals. Changing it would change past results' tie-breaks, so it needs a versioned rule.~~
2. ~~Doing nothing scores~~ **Closed 13 Oct** (`puzzleScoreRev: 1`): Bang On, Labyrinth, Slider, Jumbled, Hanoi, Pipeline, Colour Flood, Exact and Ballpark score 0 for doing nothing on new rounds.
3. **Free mistakes.** Closed where they failed the spam rule (Double Take, Box Six, Tents and Trees, Lookout, Trail, Matchmaker, Cryptogrid, Lamplighter, Shikaku, Tessellate, Chroma Lines, Blackout). Roundabout keeps free misses (the phone sends only slot words; costing misses needs an attempt log); Ball Tracker unchanged (arcade).
4. **Closed 13 Oct 2026:** the reveal's "time bonus +N" is now the bonus inside the stored score (the score less the same run scored unfinished), on whatever curve scored it; no score change. ~~**Mixed Signals' reveal shows a linear time bonus** (`clashTimeBonusOf`) while the score uses the par curve. The stored score is right; the reveal's "+N" line is wrong whenever less than all the run is left. Display fix only.~~ On clashRev 4 rounds (puzzle score shape) the bonus read the same way is the rev-4 finish bonus: PAR(30) less 5 per wrong gate, with at most 2 wrong.
5. ~~Counterweight's intro and help~~ **Closed 13 Oct**: new rounds credit each scale in any order (20 / 35 / 75); intro and help say so.
6. **Closed 13 Oct 2026** (`alogRev: 1`, section 14; `scripts/laser-log-check.tsx`). ~~**Lightbender's shot count is the phone's word.** The server can't see shots, only the final layout; an unfired solving layout scores as shot 1. Record shots as a log (like the tap logs) before ranked play.~~ On `puzzleScoreRev: 1` rounds `scoreLaser` takes the log's shot count as its tries measure (15 / 8 / 0), and a solving layout never fired scores the unfinished 22 per gem lit (at most 110), not a solve.
7. ~~Integer Pyramid's partial credit goes to the pyramid the phone names~~ **Closed 13 Oct**: new rounds credit the first unfinished pyramid.
8. **Intro / help wording gaps** (arcade only now): Fission and Junction (penalties are units), Flightpath (ring values 10 / 9 / 8 / 3 / 2 / 1), Wavefront's intro (armour hits), Letterfall (Qu counts as two). Every puzzle SCORE line and help was rewritten to the new numbers on 13 Oct.
9. ~~Roundabout's `isCorrect` counts cells~~ **Closed 13 Oct**: new rounds count word slots.
10. **Tap timing is still client-side** (section 14).
11. **Tries rewards** (Lightbender shots, Safe Cracker tries) are now the efficiency part: 15 / 8 / 0.
12. **Arcade calibration** (section 10.3).
13. **Orbit falls back to an unstamped round** if the proved course bank ever misses.
14. ~~Stale comments and dead helpers~~ **Mostly closed 13 Oct** (section 15).
15. **Mostly closed 13 Oct 2026** (move limits, `moveLimits.ts`, `move-limits-check`; bands doc "Move limits"). ~~Random play still pays in a few puzzles: Colour Flood and Polypotions (random moves solve the board), Topsy-Turvy (random tilting solves about one board in five), Counterweight (the two small scales balance by chance), Operator (stages 1–2 can be brute-forced from the CORRECT flash), Tally (each count is one of five values).~~ Each now has a visible limit (Colour Flood par + 2 moves, Polypotions and Topsy-Turvy the minimum + 6 rounded up to a 5, Counterweight 6 / 8 / 10 hangs and unique small scales, Operator 3 tries, Brimful 3× the minimum for consistency) or wider counts (Tally, 7 values), and random or brute-force medians are 0–54, down from 38–126. Colour Flood's unfinished credit falls to 0 at the limit on `floodRev 1` (Joe's ruling, 14 Oct), so random colours and colour cycling score 0 (cycling kept 85 on the old waste factor). **Still open:** (a) ~~Colour Flood's colour cycling~~ closed 14 Oct, above; (b) Counterweight's hang counts and Operator's try counts are the phone's word (the server sees only the final placement / operators); a server-read action log (docs/puzzle-action-log.md) would make them verifiable; (c) Topsy-Turvy's random tilting now keeps some unfinished credit at the limit (median 31 at 3 tilts a second, was 0).
16. **Closed 13 Oct 2026 for Flash, Bang On and Pull!** (light-touch costs: `tapRev: 2`, `clayRev: 4`; section 6, `careless-play-check`): Bang On random taps 92 → 72, Flash's tap-every-colour 75 → 54, Pull!'s mashing 30 → 16; honest medians move by at most 2. **Still open: Letterfall's random chains (about 25)**, left until its par is set from real play. ~~No-finish games keep their formulas (rule b flags): Bang On random taps score about 90 (only the all-miss bottom changed), Flash's tap-every-colour 75–100, Pull!'s mashing 15–30, Letterfall's random chains about 25. Each needs Joe's ruling on a steeper curve or a miss cost.~~
17. **Mixed Signals' finish is 52 sorted with at most 2 wrong**: good simulated players (who average 3–5 wrong) rarely finish, so its good band sits about 25 below the others (section bands doc).

**Closed since 11 Oct:** rotation rebuilt; Flash, Bang On and Ascend tap logs; the "÷ 75 s" intro text; Wavefront `armourHits`; `scoreStroop` removed; Operator 25 / 30 / 35 / 40 + 20; Exact 75 s and Slider 100 s; Pipeline's step boundary; the arcade finish-bonus and 130 / 150 notes; the Tents comment. **13 Oct:** the puzzle score shape (items 2, 5, 7, 9, most of 3 and 14).
