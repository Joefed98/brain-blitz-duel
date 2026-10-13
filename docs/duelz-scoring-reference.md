# Duelz — Scoring Reference (as implemented, 13 Oct 2026)

**Rewritten 13 Oct 2026 from the code on `main` (commit `2874c3e`, after Tuning E).** This is what the server's grading code does today, read from `grade.ts`, `scoring.ts`, `stagedRounds.ts`, `speedPar.ts`, each game's own file and the arcade sims, and checked against each game's intro and "?" help text. Where this doc and the code disagree, the code wins. It replaces the 8 Oct audit-based version that was committed on 11 Oct and patched since. Names are the display names in `gameNames.ts`, with the stable id in brackets.

Every round scores 0–150. A room total is the sum of a player's round scores.

## What changed since the 11 Oct version

- **Names and counts.** Every table uses the current display names. 74 active games (Word 10, Number 9, Speed 6, Attention 7, Pattern 7, Logic 14, Arcade 21) and 27 retired, against 68 / 26 in the 11 Oct version.
- **The 50 % par rule everywhere.** Every new puzzle is stamped `speedPar: 1`, and every speed or time bonus (Shape A / B / C, staged rounds, arcade finish bonuses) pays in full with half the time left, then falls evenly to 0. The old doc's `round(P × ms ÷ limit)` is the unstamped legacy curve only (section 2).
- **New games.** Word: Strikeout, Cryptogrid, Swapword and Letterfall (12 Oct). Number: Brimful, Checkout and Ballpark (12 Oct). Formulas in sections 4 and 5.
- **Trusted inputs.** Flash, Bang On and Ascend (`tapRev: 1`, 12 Oct) send raw tap logs and the server works out every reaction, distance, count and wrong tap (section 14). The section now also lists the smaller trusted fields found in this pass.
- **Arcade.** Section 10 is rewritten around the Oct 2026 score bands (12 Oct): achievement units on a knot curve to 140 + up to 10 for a finish, or to 150 on open games, and 0 with no input. The 130 / 150 split, the per-game ratios and the old oddities now describe stored rounds only. Current curves and stamps after Batches 1–5 (11–12 Oct), the bands, Tunings A, B, C and E (12–13 Oct); per-game bands from `docs/arcade-score-bands-oct-2026.md`. Polish F and G and Tuning D are display only.
- **Junction** is retired to practice (Tuning C, 12 Oct); rooms deal 21 arcade games. Its band scoring moves to section 12.
- **Corrections from the code** to the 11 Oct tables: Bomb Defusal is six steps, 90 s, partial round(75 × steps ÷ 6) (bombVersion 2); Operator is 25 / 30 / 35 / 40 + 20; Counterweight's stage credit is cumulative (20, then 60); Topsy-Turvy's unfinished maximum is 90; Gridlock's is 63; Safe Cracker's is 45; Chroma Lines can reach 120 unfinished; Lightbender's shot count comes from the phone; Mixed Signals' bonus is paid on any finished queue; the Chain legacy branch needs a 25- or 30-link board; Pull! has birds (−10 each); several games score for doing nothing (Bang On 20, Labyrinth 1–2, Slider, Jumbled, Hanoi, Pipeline, Colour Flood, Exact).
- **Rotation** (section 13) is the seeded 6-round rotation (11–12 Oct); the round-6 weighting, arcade's one-slot and never-round-1 rules and the add_maths / add_arcade options are gone.
- **Review notes** (11 Oct section 16) are closed where the code has settled them; what is still open is in section 16, **Open items**.

---

## 1. Common rules

| Rule | As coded | Location |
|---|---|---|
| Score range per round | 0–150 (`BASE_POINTS` 100, `MAX_SPEED_BONUS` 50, `MAX_ROUND_SCORE` 150) | `scoring.ts` |
| Room size | 2–10 players (`MIN_PLAYERS`, `MAX_PLAYERS`) | `types.ts` |
| Room total | sum of a slot's `round_results.score` | `scoring.ts totalScore()`, `totalScoreThrough()` |
| Tie-break (2 players) | higher total wins; equal totals → lower `totalAnswerMs` wins; still equal → draw | `scoring.ts duelOutcome()` |
| Standings (3+ players) | total descending, then answer time ascending; equal on both share a position; players who left are dropped; `previousPosition` kept for movement | `scoring.ts rank()`, `standings()` |
| `totalAnswerMs` | sum over rounds of `reaction_avg_ms` if set, else `ROUND_MS − ms_remaining`, where `ROUND_MS` is the fixed 30,000 ms, not the game's own limit (see open item 1) | `scoring.ts totalAnswerMs()`, `answerMsThrough()` |
| Trusted time left | the claim is rounded and clamped to [0, limit] (NaN → 0); if it exceeds the server's own time left (clamped) + 1,500 ms (`TIME_CLAIM_TOLERANCE_MS`) the server's value is used, `clamped: true` is recorded and a warning logged. Server time left = limit − (now − (`phase_started_at` ?? `round_started_at`) − `puzzlePrepMs`); the limit is the puzzle's own `timeLimitMs` where it has one (Hanoi's five-ring variant), else the type's | `grade.ts trustedMsRemaining()`; `duel.functions.ts submitAnswerFn` |
| Receipt time | the server's own time left is also passed to grading as `receivedMsRemaining`; tap logs are cut off at receipt + 1.5 s (`latestTapMs`) | `grade.ts` |
| Stored time left | the grader's `storedMs`, not always the trusted value: Flash, Go/No-Go and Mixed Signals store 0 | `grade.ts` |

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

| Helper | As coded | Location |
|---|---|---|
| **PAR(P)** = `speedPoints(P, ms, limit)` | `speedBonusCurve(P, ms, limit)`; 0 if limit ≤ 0 | `scoring.ts` |
| `speedBonus(ms, limit = ROUND_MS)` | `speedBonusCurve(50, clamp(ms, 0, limit), limit)` (retired games) | `scoring.ts` |
| `reactionBonus(avgMs)` | `clamp(round((650 − avgMs) ÷ 10), 0, 50)` (Go/No-Go only) | `scoring.ts` |
| **MOVES(B)** = `movesPoints(B, moves, min)` | `round(B × clamp(1 − (moves − min) ÷ min, 0, 1))`: full at the minimum, 0 at twice it; 0 if min ≤ 0 | `scoring.ts` |
| **Shape A** = `standardComplete(ms, limit)` | `clamp(130 + PAR(20), 0, 150)`: 150 with half the time or more left | `scoring.ts` |
| **Shape B / C** = `scoreSolvedMoves(...)` | `clamp(100 + MOVES(w.moves) + PAR(w.speed), 0, 150)`; `MOVES_SHAPE.B = {moves: 25, speed: 25}`, `C = {moves: 40, speed: 10}` (Colour Flood only) | `scoring.ts` |
| `UNFINISHED_CAP` | 110; used only inside `scoreTubes` | `scoring.ts` |
| `finishScore(runTicks, finishTick)` | `clampInt(130 + speedBonusCurve(20, left, max(1, runTicks)), 0, 150)`, left = clamp(runTicks − finishTick, 0, runTicks). Pre-band arcade revisions only | `arcade/engine.ts` |
| Band scoring (arcade) | `bandOpen` (curve to 150), `bandFinishFlat` (curve to 140 + flat 10), `bandFinishSpeed` (curve to 140 + PAR(10) over a window); `BAND_PARTIAL_TOP` 140, `BAND_FINISH_BONUS` 10 (section 10) | `arcade/scoreBands.ts` |
| Staged rounds | `scanStageResult` / `scoreSymbolScanStages`, `countStagePoints` / `scoreCountUpStages`, `scoreEquationStages`; stage weights `STAGE_WEIGHTS_3 = [30, 45, 55]` | `stagedRounds.ts` |

Notation: **ms** = trusted time left; **limit** = the game's registry time limit unless stated; **PAR(P)** is the par curve above on stamped rounds (linear on unstamped ones).

## 3. Score-check anchors enforced by scripts

| Script | What it pins |
|---|---|
| `standard-scoring-check.ts` | Every Shape A game complete at half time = 150, every Shape B game at the minimum and half time = 150; `scoreSolvedMoves(20, 10, 0, L)` = 100; Colour Flood and Slider at par and half time = 150; named partials (Chroma Lines 11/12 → 110, Hanoi 8/9 → 98, Matchmaker 14/15 → 112, Double Take 5/6 → 100, Labyrinth 0.9 → 99, Tessellate 8 → 96, Skid 0.9 → 81, Topsy-Turvy 3 → 90, Jumbled 6 → 84, Turntable 7 → 84, Lightbender 5 lit → 75 and 3rd shot at half → 120, Safe Cracker 2nd try at half → 135, Heave 4/5 → 88, Polypotions 4 → 88 and 6 → 110, Bomb 3 → 75 and 4 → 75, Mosaic 90 % with 1 wrong → 94, Box Six 9/10 → 99, Colour Flood 180 → 101, Tents 11 → 110 and 14 → 110, finished at zero → 130, Shikaku 90 → 99, Slider 4 rows → 88, Interloper 4 + half → 108); staged anchors (Eagle Eye perfect at half → 150, at zero → 130; Tally exact at zero → 130, off by 1 on stage 3 → 108) |
| `six-game-scoring-check.ts` | Formula identity over the input range for the pre-band Ball Tracker, Gemstone (revs 1–3), Junction, Rally, High Rise and Flightpath (anchors 100 → 150, 90 → 133, 70 → 99, 50 → 65; rings [10, 9, 8, 3, 2, 1]); band curves for six of them; legacy partial maxima kept for stored rounds; no intro or help states a partial cap or a "÷ N s" divisor; old Ball Tracker demos rejected |
| `reveal-score-check.tsx` | For every active and retired type the reveal's `data-reveal-score` equals the stored score; no stored row shows "Scoring…"; no Reveal computes its own score |
| `arcade-score-bands-check.ts` | 22 band games (21 active + Junction): 88 pre-change runs replay to identical scores; the same logs on the band revisions score exactly their breakdown; curves start at 0, never fall, top at 140 + 10 or 150; one unit short of a finish is at most 12 below; doing nothing = 0 |
| `tap-log-check.tsx` | Flash, Bang On, Ascend: 36 honest runs recorded on main grade identically; tap logs score the same with the same tie-break time; phone parity in happy-dom; 381 tampered logs never beat the honest run |
| `number-batch-check.ts` | Brimful, Checkout, Ballpark: same seed → same puzzle; BFS and exhaustive-search proofs; anchors through the server grader; finishing always beats not finishing; client extras never change a score |
| `strikeout-check.ts`, `codeword-check.ts`, `swapword-check.ts` | Anchors (Strikeout perfect 150, minimum finish 124, best unfinished 88, nothing 0; Cryptogrid perfect 150, minimum finish 130, best unfinished below 130, all 1,000 boards unique; Swapword perfect 150, minimum finish ≥ 111, best unfinished ≤ 100 and below every finish) |
| `wordfall-check.ts` | A scripted bot reaches par inside the 90 s run and the server replay scores it 150; dictionary, plan and replay identity |
| `timing-check.ts` | `trustedMsRemaining`: honest, 1.2 s behind, at the tolerance, impossible claim → server value, over the limit → limit, negative or NaN → 0 |
| `room-rounds-check.ts` | Rotation: 6 rounds (7 with all seven categories), per-category spread, no repeated game, no category twice in a row, same seed → same room (1, 2, 4 and 7 categories) |
| `intro-score-text-check.ts` | Intro SCORE lines fit two short lines; band intros say how to reach the top |
| Arcade identity checks | `arcade-batch1`–`5-check`, `arcade-tuning-a-check`, `tuning-b-check`, `arcade-tuning-c-check`, `arcade-tuning-e-check`, `arcade-self-replay-check`: stored runs replay to the same score and state on their own revision; each new revision reaches 150 through the server replay |

---

## 4. Word — 10 active

| Game (id) | Time limit | Complete / correct | Move / speed bonus | Unfinished / wrong | Items / stages | Penalties | File + function |
|---|---|---|---|---|---|---|---|
| Nucleus (`wordsmith`) | 100,000 ms (`WORDSMITH_TIME_MS`) | one formula: min(150, floor(2.5 × word points)); 60 points reaches 150 | none (no time term) | same formula; 0 words = 0 | 4+ letter words using the centre letter, no plurals; points 4 → 1, 5 → 2, 6 → 4, 7 → 7, 8 → 11, 9+ → 15; `isCorrect` = points ≥ max(1, round(0.35 × board total)) | none; invalid words are skipped | `scoring.ts scoreWordsmith`; `wordsmith.server.ts gradeWordsmith` |
| Forage (`wordhunt`) | 100,000 ms (`WORDHUNT_TIME_MS`) | one formula: min(150, 2 × word points); 75 points reaches 150 | none | same formula | 4+ letter paths, plurals allowed; points 4 → 1, 5 → 2, 6 → 4, 7 → 7, 8+ → 11; 35 % par sets `isCorrect` only | none | `scoring.ts scoreWordHunt`; `wordHunt.server.ts gradeWordHunt` |
| Interlock (`tilegrid`) | 100,000 ms (`TG_TIME_MS`) | all 15 tiles in a valid grid: min(150, 130 + PAR(20)) | speed only | min(150, 8 × tiles inside at least one real word), even in an invalid grid (most 120) | 15 tiles, 7 × 7 board | none | `tileGrid.ts scoreTileGrid` |
| Slider (`wordslide`) | 100,000 ms (`WS_TIME_MS`) | all 5 rows words: min(150, 100 + PAR(30) + MOVES(20, moves, par)) | MOVES full at par, 0 at twice par; par = the scramble's shift count (5–8), not a proven minimum; Undo and Reset count as moves | 22 per row that is any dictionary word | 5 rows of 5 letters | none beyond move points | `scoring.ts scoreWordSlide` |
| Lookout (`wordsearch`) | 120,000 ms (`WORDSEARCH_TIME_MS`) | all 6 found: min(150, 130 + PAR(20)) | speed only | min(120, 20 × found) (most 100) | 6 words, 10 × 10 grid | none; wrong picks are free | `wordSearch.ts scoreWordSearch` |
| Roundabout (`letterwheel`) | 100,000 ms (`LETTERWHEEL_TIME_MS`) | every slot found: min(150, 130 + PAR(20)) | speed only | 15 per word on 8-word boards, 13 on 9-word boards (most 105 / 104) | bank of 112 eight-word and 188 nine-word boards | none | `letterWheel.ts scoreLetterWheel` |
| Strikeout (`strikeout`) | 100,000 ms (`STRIKEOUT_TIME_MS`) | all five revealed: min(150, 120 + 4 × strikes left + PAR(10)); at least 124 | up to 20 for unused strikes, plus speed | min(110, 20 × solved words + 2 × letters showing in unsolved words) (most 88) | 5 five-letter words; 5 strikes end the round (`SO_MAX_STRIKES`) | a strike for a letter not in the puzzle or a wrong real-word solve; non-word solves and repeated letters are free | `strikeout.ts scoreStrikeout` |
| Cryptogrid (`codeword`) | 120,000 ms (`CODEWORD_TIME_MS`) | cracked: Shape A | speed only | min(110, round(110 × numbers right ÷ numbers to find)) | 1,000-board bank; 10–14 numbers to find (4 given) | none; wrong letters are free | `codeword.ts scoreCodeword` |
| Swapword (`swapword`) | 120,000 ms (`SWAPWORD_TIME_MS`) | solved: min(150, 100 + MOVES(25, swaps, minimum) + PAR(25)) (Shape B); at least 111 | budget = minimum + 5 (minimum 9–12), so the moves term never falls below 11 | min(100, 5 × tiles put in place) (only tiles that started out of place; most 80) | 21 tiles, 3–5 start in place | the board locks when the budget runs out | `swapword.ts scoreSwapword` |
| Letterfall (`wordfall`, engine) | 93,000 ms registry; 90 s run (`WF_RUN_TICKS` 5,400) | one formula: floor(150 × min(points, 30) ÷ 30) (5 a point); `isCorrect` = points ≥ 30 | none | same formula; a column overflow ends the run early | word points 3 → 1, 4 → 2, 5 → 4, 6 → 7, 7+ → 11 letters (Qu = 2); par `WF_PAR` 30 | none; a non-word only shakes | `arcade/wordfall.ts wordfallScore` |

**Word notes**
- Slider can score for doing nothing: about a fifth of generated grids start with 1–3 rows that are already words (any dictionary word counts), worth 22–66.
- Finishing scores under 130 in Strikeout (≥ 124), Swapword (≥ 111) and Slider (≥ 100); every unfinished maximum is still lower.
- Roundabout: `isCorrect` counts cells while the score counts word slots; if crossings filled every cell before every word were found, the round would be marked correct but score as unfinished.
- Intro text: Strikeout's intro ("20 per word revealed") leaves out the 2 per letter showing (its "?" help has it); Letterfall's help doesn't say Qu counts as two letters. Everything else matches.

## 5. Number — 9 active (not in the default room presets)

| Game (id) | Time limit | Complete / correct | Move / speed bonus | Unfinished / wrong | Items / stages | Penalties | File + function |
|---|---|---|---|---|---|---|---|
| Exact (`target`) | 75,000 ms (`TARGET_TIME_MS`) | distance 0: min(150, 130 + PAR(20)) | speed only | distance 1–10: 120 − (d − 1)(d + 2) ÷ 2 (120, 118, 115 … 66); over 10: max(0, round(66 − 0.6 × (d − 10))), 0 from 120 | six tiles, target 101–999; d = the closest number left after replaying the steps | none | `scoring.ts scoreTargetNumber`; `target.ts replayTargetSteps` |
| Operator (`equation`) | 90,000 ms (`EQUATION_TIME_MS`) | each correct stage 25 / 30 / 35 / 40 (130); all four adds PAR(20) | speed only, all correct; divisor is the constant `EQUATION_TIME_MS` | sum of correct stages, any order | 4 equations, left to right, whole non-negative steps | none | `stagedRounds.ts scoreEquationStages` |
| Counterweight (`balance`) | 90,000 ms (`BAL_TIME_MS`) | all 3 scales: min(150, 120 + PAR(30)) | speed only | cumulative, in order only: 1 scale → 20, 2 scales → 60; counting stops at the first unsolved scale | 3 scales | none | `balance.ts balanceSolvedCount`, `balanceRoundScore` |
| Integer Pyramid (`numpyramid`) | 120,000 ms (`NUMPYRAMID_TIME_MS`) | all 4 pyramids: min(150, 120 + PAR(30)) | speed only | 30 × completed + round(30 × correct cells ÷ empty cells) on the active pyramid only | 4 pyramids of 5 rows, 2 decoy tiles each; any valid fill completes a pyramid | none | `numberPyramid.ts scoreNumberPyramid` |
| Trail (`trail`) | 120,000 ms (`TRAIL_TIME_MS`) | path matches the solution: min(150, 130 + PAR(20)) | speed only | min(130, 5 × player tiles in their correct cell) (most 125) | 6 × 6, 36 cells, 10 fixed | none; wrong tiles score 0 | `trail.ts scoreTrail` |
| Brimful (`measure`, measureRev 1) | 120,000 ms (`MEASURE_TIME_MS`) | all 4 solved: Σ(25 + move points) + PAR(30), cap 150 | move points per puzzle: 5 at the minimum, then round(5 × (2 × min − moves) ÷ min), 0 at twice the minimum | Σ(25 + move points) over puzzles solved in order; the first unsolved one ends grading (most 90) | 4 puzzles; minimums by breadth-first search | none | `measure.ts measureMovePoints`, `gradeMeasureBoards`, `scoreMeasure` |
| Checkout (`checkout`, checkoutRev 1) | 90,000 ms (`CHECKOUT_TIME_MS`) | all 5: Σ(weight + 2 if fewest darts) + PAR(30), cap 150 (110 + 10 + 30) | +2 per board in the fewest darts (`CHECKOUT_MIN_DART_POINTS`); the exact-four-darts board always gets it | Σ over solved boards, any order (most 100) | 5 boards worth 18 / 20 / 22 / 24 / 26 | none; a wrong throw costs time | `checkout.ts gradeCheckoutStages`, `scoreCheckout` |
| Ballpark (`numline`, numlineRev 1) | 75,000 ms (`NUMLINE_TIME_MS`) | all 15 placed: min(150, round(acc) + round(PAR(30) × acc ÷ 120)) | speed scaled by the accuracy share | round(acc); acc = Σ item points: 8 within 2 % of the line, falling evenly to 0 at 15 % | 3 lines × 5 numbers; `isCorrect` = all placed | none | `numline.ts numlineItemPoints`, `scoreNumline` |
| Tenfall (`tendrop`, engine) | 93,000 ms registry; 90 s run (`TD_RUN_TICKS` 5,400) | all 10: 130 + speedBonusCurve(20, 5,400 − clear tick, 5,400), cap 150 (the full 20 when the last clears by 45 s) | early-clear bonus only; divisor is the run, not the registry limit | 13 × cleared | 10 targets | none; overshooting resets the total; refused tiles are free | `arcade/tenDrop.ts tenDropScore` |

**Number notes**
- Doing nothing can score in Exact (distance is measured from the closest starting tile: about 3.5 % of boards score above 0, up to about 61) and Ballpark (unplaced numbers earn nothing, but wild placements earn accuracy points and no penalty).
- Counterweight's intro and help ("20, 40 and 60 for scales 1, 2 and 3") read as per-scale credit; the code is cumulative and in order (1 → 20, 2 → 60, all 3 → 120 + speed), and a right third scale scores nothing if an earlier one is wrong (open item 5).
- Integer Pyramid's partial credit goes to the pyramid the phone reports as active (`grade.ts` reads `active` from the answer).
- Finishing scores under 130 in Counterweight and Integer Pyramid (≥ 120); their unfinished maximums (60, 90 + partial) are lower.
- Tenfall's help says "up to 20 for clearing them early" without the half-time rule the other helps state.

## 6. Speed — 6 active

| Game (id) | Time limit | Complete / correct | Move / speed bonus | Unfinished / wrong | Items / stages | Penalties | File + function |
|---|---|---|---|---|---|---|---|
| Flash (`reaction`) | 60,000 ms (`REACTION_ROUND_MS`) | no finish state: average ≤ 200 ms → 150, else clamp(round(150 − 0.16 × (avg − 200)), 0, 150); then clamp(that − 8 × false starts, 0, 150) | none | average = round(sum ÷ flashes); each flash counts clamp(t, 1, 1,200) ms; a miss counts 1,200 ms (`REACTION_MISS_MS`) | 5–8 gold flashes, each up 1,500 ms (`REACTION_FLASH_MS`) | −8 per false start (counted from the tap log, false starts under 250 ms apart count once; capped at 99) | `scoring.ts scoreReaction`; `tapLog.ts replayFlash`; `grade.ts` case "reaction" |
| Bang On (`stopwatch`) | 60,000 ms (`STOPWATCH_ROUND_MS`) | no finish state: average ≤ 20 ms → 150, else clamp(round(150 − 0.27 × (avg − 20)), 0, 150) | none | average of 10 distances, each capped at 500 ms; a miss counts 500 ms (`STOPWATCH_MISS_MS`) | 10 watches on a fixed schedule (first at 800 ms, each next 600 ms after the last stop or run-out) | none beyond the miss value | `scoring.ts scoreStopWatch`; `tapLog.ts replayBangOn`; `stopWatch.ts watchStop` |
| Ascend (`numhunt`) | 60,000 ms (`NUMHUNT_TIME_MS`) | all 24: clamp(130 + PAR(20) − 5 × errors, 0, 150) | PAR(20); with a tap log, time left = min(claimed, 60,000 − finishing tap) | clamp(5 × reached − 5 × errors, 0, 150) (most unfinished = 115) | 24 numbers; untapped discs move every 15 s (4 layouts) | −5 per wrong tap (`NUMHUNT_ERROR_PENALTY`), finished or not; capped at 99 errors | `scoring.ts scoreNumberHunt`; `tapLog.ts replayAscend` |
| Don't Break the Chain (`chain`) | 45,000 ms (`CHAIN_TIME_MS`) | all 40 links: min(150, floor(3.5 × 40) + PAR(10)) = 140 + PAR(10) | PAR(10) on the claimed time left; the divisor is the constant `CHAIN_TIME_MS` | min(150, floor(3.5 × links)) | 40 links; board reshuffles every 5; momentum windows 3,000 ms to link 13, 2,500 ms to 26, 2,000 ms to 40 (first tap untimed); FASTER at 10 / 20 / 30 | the first wrong tap (or a reused node) or a lapse ends the chain; no deduction | `chain.ts chainScore`, `replayChain`, `chainRules` |
| Bonk (`whack`, engine) | 63,000 ms registry (`WHACK_TIME_MS`); 60 s run (`WHACK_RUN_TICKS` 3,600) | one formula: floor((270 × hits + total) ÷ (2 × total)) (= round(135 × hits ÷ total)) − penalties, clamp 0–150 | +15 when every target is hit (`WHACK_PERFECT_BONUS`), whatever the penalties; no time bonus | same formula; total ≤ 0 scores 0 | seeded target count; the rule flips 3–5 times; hedgehogs 10 % after 5 s | −3 wrong colour, −5 hedgehog, −3 empty burrow | `arcade/whack.ts whackScore` |
| Pull! (`clayshoot`, engine) | 63,000 ms registry (`CLAYSHOOT_TIME_MS`); 60 s run (`CLAY_RUN_TICKS`) | one formula: clamp(5 × orange + 10 × gold + perfect − 10 × birds hit, 0, 150) | +10 perfect = all 22 orange + all 3 gold with no bird hit; no time bonus | same formula | 25 clays (22 orange, 3 gold); clayRev 3: 10–12 birds | −10 per bird hit; a shot landing on a clay never counts as a bird hit | `arcade/clayShoot.ts clayScore` |

**Speed notes**
- Bang On scores 20 for doing nothing (all misses → average 500 ms → 150 − 0.27 × 480 = 20). Flash all misses → 0.
- Ascend: a finished run with 4+ wrong taps and little time left can score below an error-free unfinished run (110 < 115).
- Flash: a tap 1,200–1,500 ms after the gold scores the same as a miss.
- Don't Break the Chain's bonus uses the phone's claimed time left (held only by the 1.5 s receipt check), not its own replayed last tap; Ascend's tap log caps it.
- Bonk and Pull! have no time bonus. Bonk's +15 is paid even with wrong taps.
- All six intro SCORE lines match the code.

## 7. Attention — 7 active

| Game (id) | Time limit | Complete / correct | Move / speed bonus | Unfinished / wrong | Items / stages | Penalties | File + function |
|---|---|---|---|---|---|---|---|
| Mixed Signals (`stroop`, engine, clashRev 3) | 78,000 ms registry; 75 s run (`CLASH_REV3_RUN_TICKS` 4,500) | clamp(round(130 × correct ÷ 52) − 2 × wrong + bonus, 0, 150) | bonus = PAR(20) over ticks (run − finishing tick, run), paid once every word is sorted (correct + wrong ≥ 52); wrong gates don't block it | same formula, no bonus | 52 words; five 15 s phases (fall ticks 107 / 95 / 83 / 71 / 59); the rule swaps every 15 s; 3 lanes, 4 from 30 s | −2 per wrong gate; an unsorted word costs nothing | `arcade/colourClash.ts clashQueueScoreOf`; `duel/colourClash.ts replayColourClashRun` |
| Eagle Eye (`symscan`) | 30,000 ms (`SYMSCAN_TIME_MS`) | per stage max(0, round(w × found ÷ targets) − 3 × wrong), w = 30 / 45 / 55; total min(150, sum + bonus) | PAR(20) only when all three stages are perfect (all found, none wrong) | per-stage share, each stage floored at 0 | 3 grids (5 / 6 / 7 columns, 5–9 targets each) | −3 per wrong tap within its stage | `stagedRounds.ts scanStageResult`, `scoreSymbolScanStages` |
| Double Take (`spotdiff`) | 30,000 ms (`SPOT_TIME_MS`) | all 6: Shape A | PAR(20) | 20 per difference (most 100) | 6 differences (any cell of one counts) | none; wrong taps are free and unlimited | `scoring.ts scoreSpotDifference` |
| Tally (`countup`) | 45,000 ms (`COUNTUP_TIME_MS`) | per stage: exact = w; off by 1 = round(0.6w) (18 / 27 / 33); off by 2 = round(0.3w) (9 / 14 / 17); else 0; total min(150, sum + bonus) | PAR(20) only when all three are exact | per-stage credit; blank = 0 | 3 trays, w = 30 / 45 / 55; the true count is worked out on the server from the stored scene | none beyond lost weight | `stagedRounds.ts countStagePoints`, `scoreCountUpStages` |
| Labyrinth (`maze`) | 60,000 ms (`MAZE_TIME_MS`) | exit reached: Shape A | PAR(20) | clamp(round(110 × progress), 0, 110); progress = (furthest route index reached + 1) ÷ route length | 19 × 19 maze, route ≥ 70 cells (`MAZE_MIN_PATH`) | none; detours are free; the walk stops at the first wall jump | `scoring.ts scoreMaze`; `maze.ts verifyMazePath` |
| Interloper (`intruder`) | 75,000 ms (`INTRUDER_TIME_MS` = 5 × 15,000) | all 5 boards right: Shape A | PAR(20) | 24 per board right; 12 for one of two changes (most 108) | 5 boards with 1 / 1 / 2 / 2 / 2 changes | no deduction, but only the first N taps per board are read (N = changes), so a wrong tap uses up a pick | `scoring.ts scoreIntruder`; `intruder.ts replayIntruder` |
| Matchmaker (`pairmatch`) | 90,000 ms (`PAIR_TIME_MS`) | all 15 pairs: Shape A | PAR(20) | 8 per pair (most 112) | 15 pairs, 30 cards | none; wrong flips cost only time | `scoring.ts scorePairMatch`; `pairmatch.ts replayPairs` |

**Attention notes**
- Mixed Signals' reveal line "time bonus +N" uses `clashTimeBonusOf`, which is always linear (round(20 × left ÷ run)), while the score uses PAR(20): with 40 % of the run left the score adds 16 but the reveal says +8 (open item 4). The stored score is right.
- Labyrinth scores 1–2 for doing nothing: the timeout submits the start cell, worth 1 ÷ route length of 110.
- Matchmaker's unfinished maximum (112) sits above the usual 110; it is still below the 130 finish floor.
- All seven intro SCORE lines match the code.

## 8. Pattern — 7 active

At the buzzer the phone submits its draft answer with 0 ms left, and it is graded like any other answer, so a board's starting state is scored. Moves, presses, tilts, pours and pushes count cumulatively; Undo and Reset never give moves back.

| Game (id) | Time limit | Complete / correct | Move / speed bonus | Unfinished / wrong | Items / stages | Penalties | File + function |
|---|---|---|---|---|---|---|---|
| Gridlock (`unblock`) | 60,000 ms (`UNBLOCK_TIME_MS`) | solved: Shape B | MOVES(25, moves, minimum) + PAR(25) | clamp(max(round(70 × p), 10 if any blocker cleared), 0, 70), p = 0.9 × blockers cleared from the gold car's lane ÷ blockers at the start, on the final state (most 63; the 10 floor never applies) | 1 gold car | none | `scoring.ts scoreUnblock`; `grade.ts` case "unblock" |
| Tessellate (`blockparty`) | 60,000 ms (`BLOCK_TIME_MS`) | all 29 free cells covered: Shape A | PAR(20) | 12 per legal piece placed (`BLOCK_PIECE_POINTS`, most 96) | 9 pieces | none; illegal or overlapping placements are dropped | `scoring.ts scoreBlockParty`; `blockParty.ts verifyPlacements` |
| Skid (`iceslide`) | 90,000 ms (`SLIDE_TIME_MS`) | solved: Shape B | MOVES(25) + PAR(25) | round(90 × (1 − best ÷ start)), best = fewest moves to the exit from the best state reached (`SLIDE_PARTIAL_POINTS` 90) | 1 ball | none | `scoring.ts scoreIceSlide` |
| Topsy-Turvy (`gravity`) | 90,000 ms (`GRAV_TIME_MS`) | all 4 balls home: Shape B | MOVES(25, tilts, minimum) + PAR(25) | 30 per locked ball (`GRAV_LOCK_POINTS`; most 90, since 4 locked = solved) | 4 balls | none | `scoring.ts scoreGravity` |
| Jumbled (`tiles`) | 60,000 ms (`TILES_TIME_MS`) | solved: Shape B | MOVES(25) + PAR(25) | 14 per tile in place, cap 90 | 8 tiles (3 × 3) | none | `scoring.ts scoreTiles` |
| Turntable (`rings`) | 60,000 ms (`RINGS_TIME_MS`) | every spoke one colour: Shape B | MOVES(25, turns, minimum) + PAR(25) | 12 per aligned spoke (`RINGS_SPOKE_POINTS`, most 84) | 8 spokes | none | `scoring.ts scoreRings` |
| Lightbender (`laser`) | 60,000 ms (`LASER_TIME_MS`) | all 6 gems lit, no bomb: 130 / 115 / 100 for shot 1 / 2 / 3 (`LASER_FIRE_BASE`) + PAR(20) | fewer shots = higher base | 15 per gem lit by the final placement (`LASER_GEM_POINTS`, most 90) | 6 gems, 3 shots | a bomb ends the beam (gems lit before it still count) | `scoring.ts scoreLaser`; `laser.ts verifyLaser` |

**Pattern notes**
- Lightbender's shot count comes from the phone: `verifyLaser` turns 0 into 3 and the draft claims max(1, shots), so the "never fired = 0" branch is unreachable and a solving layout left unfired at the buzzer scores as shot 1 (open item 6).
- Jumbled's starting board often has tiles in place: doing nothing scored 0–84 (non-zero on 79 % of boards measured).
- Gridlock's intro says "up to 70"; the most is 63 (the 0.9 factor in `grade.ts`).

## 9. Logic — 14 active

| Game (id) | Time limit | Complete / correct | Move / speed bonus | Unfinished / wrong | Items / stages | Penalties | File + function |
|---|---|---|---|---|---|---|---|
| Pipeline (`pipes`) | 120,000 ms (`PIPES_TIME_MS`) | all connected, no leaks: Shape A | PAR(20) | j = tiles connected to the source: ≥ 48 → 90; 47 → 85; 27–46 → 85 − 5 × floor((46 − j) ÷ 2) (27 → 40); below 27 → round(1.5 × j) | 49 cells (7 × 7) | none (a cliff from 40 to 39 at 26) | `scoring.ts scorePipes` |
| Blackout (`lightsout`) | 75,000 ms (`LIGHTS_TIME_MS`) | all off: Shape B | MOVES(25, every press including undone ones, minimum) + PAR(25) | 1 / 2 / 3 / 4 lights on → 85 / 75 / 60 / 50; else 5 per solution cell pressed an odd number of times, most 45 | 36 lights | none; extra presses cost only move points | `scoring.ts scoreLightsOut` |
| Box Six (`sudoku`) | 90,000 ms (`SUDOKU_TIME_MS`) | solved: Shape A | PAR(20) | round(110 × correct blanks ÷ blanks) | 36 cells, 14–16 given | none; wrong digits are free | `scoring.ts scoreSudoku` |
| Chroma Lines (`flow`) | 75,000 ms (`FLOW_TIME_MS`) | every pair joined and every open cell filled: Shape A | PAR(20) | 10 per pair joined (`FLOW_PAIR_POINTS`; up to 120 on a 12-pair board) | 10–12 pairs | none | `scoring.ts scoreFlow` |
| Heave (`push`) | 120,000 ms (`PUSH_TIME_MS`) | solved: Shape B | MOVES(25, pushes, minimum) + PAR(25) | round(110 × crates home ÷ crates) | 4–5 crates | none | `scoring.ts scorePush` |
| Hanoi (`tower`) | 90,000 ms (stored on the puzzle, `TOWER_TIME_MS`) | solved: Shape B | MOVES(25) + PAR(25) | round(110 × rings stacked correctly from the bottom of the gold post ÷ 9); rings home at the start count | 9 rings, 3 or 4 posts | none | `scoring.ts scoreTower` |
| Polypotions (`tubes`) | 90,000 ms (`TUBES_TIME_MS`) | every flask empty or full of one colour: Shape B | MOVES(25, pours, minimum) + PAR(25) | 22 per corked flask, cap 110 (`UNFINISHED_CAP`) | 10 flasks | none | `scoring.ts scoreTubes` |
| Safe Cracker (`safe`) | 75,000 ms (`SAFE_TIME_MS`) | opened on try 1 / 2 / 3: 130 / 115 / 100 (`SAFE_TRY_POINTS`) + PAR(20) | fewer tries = higher base | 15 per dial right on the last try (clamp 60, most 45) | 4 dials, 3 tries | none | `scoring.ts scoreSafe` |
| Bomb Defusal (`bomb`, bombVersion 2) | 90,000 ms (stored on the puzzle, `BOMB_V2_TIME_MS`; registry 75,000) | defused: Shape A | PAR(20) | round(75 × correct leading steps ÷ 6): 0 / 13 / 25 / 38 / 50 / 63 | 6 steps; 300-bomb bank | the first wrong step ends the run | `scoring.ts scoreBomb`; `bomb.ts checkBombPlan` |
| Mosaic (`nonogram`) | 120,000 ms (`NONO_TIME_MS`) | exact picture: Shape A | PAR(20) | clamp(round(110 × correct filled ÷ the picture's filled cells) − 5 × wrong, 0, 110) | 7 × 7, 18–30 filled | −5 per wrong cell | `scoring.ts scoreNonogram` |
| Colour Flood (`flood`) | 60,000 ms (`FLOOD_TIME_MS`) | solved: Shape C, 100 + MOVES(40, moves, par) + PAR(10) | the heaviest move weight of any game | round(110 × region ÷ 196) | 196 cells (14 × 14) | none | `scoring.ts scoreFlood` |
| Tents and Trees (`tents`) | 90,000 ms (`TENTS_TIME_MS`) | every tent right, none wrong: min(150, 130 + PAR(20)) | PAR(20) | min(110, 10 per tent on a solution cell) | 11–12 trees | none; wrong tents only block a perfect | `tents.ts scoreTents` |
| Shikaku (`shikaku`) | 90,000 ms (`SHIKAKU_TIME_MS`) | all 100 cells covered: min(150, 130 + PAR(20)) | PAR(20) | round(110 × area of accepted rectangles ÷ 100); a rectangle counts when it holds one clue of matching area, even off the solution | 100 cells | none | `shikaku.ts scoreShikaku`, `acceptedRects` |
| Lamplighter (`lightup`) | 90,000 ms (`LIGHTUP_TIME_MS`) | all lit, no clash, numbers satisfied: min(150, 130 + PAR(20)) | PAR(20) | max(0, round(110 × lit ÷ white cells) − 5 × clashing bulbs) (110 possible with a wall number wrong) | 58–63 white cells | −5 per clashing bulb | `lightUp.ts scoreLightUp` |

**Logic notes**
- Doing nothing scores in Pipeline (2–21, always above 0), Hanoi (0–49; 49 on 40 % of boards) and Colour Flood (1–11), because the start state is graded.
- Chroma Lines' unfinished maximum (120) is above the 110 used elsewhere and within 10 of the 130 finish floor.
- Intro text: Blackout leaves out the 5-per-press branch; Mosaic says "÷ cells" (the code divides by the picture's filled cells); Tents leaves out the 110 cap. The rest match.
- The scorers scale by type constants (`PIPES_CELLS` 49, `FLOOD_CELLS` 196, `SHIKAKU_CELLS` 100, `TILES_COUNT`, `RINGS_SEGMENTS`), not the stored board's size; every board today has those sizes.

---

## 10. Arcade — 21 active (Junction practice only)

### 10.1 How arcade rounds are scored

- **Deterministic replay.** Every arcade game runs on the engine (60 ticks a second, integer 1/256 px physics, a seeded PRNG in the state). The phone records each input on the sim tick it applied; the server replays the log on the stored seed and stores the sim's own score. The phone's score is only compared to flag a mismatch.
- **Run length** = registry limit − 3 s (`ARCADE_PHASE_SLACK_MS`).
- **The Oct 2026 score bands** (`scoreBands.ts`, `bandParts.ts`; full history and measurements in `docs/arcade-score-bands-oct-2026.md`). A game counts its achievement in **units** (buckets, bricks, metres, match points…). A **band curve** turns units into points: straight lines between a few knots from (0, 0), floored (`bandPoints`); more achievement never scores less.
  - **Finish games** (a clear, a finish line, or surviving the clock): the curve tops out at 140 (`BAND_PARTIAL_TOP`); finishing adds up to 10 (`BAND_FINISH_BONUS`): a flat 10 (`bandFinishFlat`), or PAR(10) over the game's window (`bandFinishSpeed`). One unit short of a finish is never more than 12 below the best finish.
  - **Open games** (no finish): the curve tops out at 150 at a near-perfect figure (`bandOpen`).
  - Total = clamp(points + bonus − penalty, 0, 150) (`bandTotal`); **a run with no input scores 0** (`acted`).
  - Which rules apply is decided by the state, not the puzzle: the revision's `<game>GameFor(rev)` init calls `bandInit` (`band: 1, acted: 0`) and `bandScoreOf` scores by `state.band`, else by the original formula; the reveal does the same. `BAND_STAMPS` / `puzzleUsesBands` (stamp ≥ the band revision) are used by the checks.
  - Each band revision plays the previous live revision unchanged; later revisions (Tunings A, B, C, E) change play or curves under new stamps. Every "?" help string is generated from the current curve (`bandHelp`), so the help shows the live knots.
- **Target bands** (the same simulated skill level should land in a similar band in every game, measured by `scripts/arcade-skill-bands.ts` through the server's own replay): average 60–80 (aim 70), good 90–110 (aim 100), great 115–135 (aim 125), near-perfect 140–150, a perfect run 150.

### 10.2 Current scoring per game

PAR(10) below is the 50 % par curve over the stated window. Penalties marked "units" come off before the curve.

| Game (id) | Stamp | Run | Kind | Units counted | Knots (units → points) | Finish bonus | Penalties | File + function |
|---|---|---|---|---|---|---|---|---|
| Ball Tracker (`balltrack`) | btRev 3 | 60 s | finish | 1 per marble home (of 30) | 10 → 32, 19 → 70, 26 → 104, 28 → 126, 29 → 138, 30 → 140 | all 30 home: PAR(10) over the landing window (53 s to the buzzer): the full 10 if the last lands by 56.5 s | none (wrong trays are free) | `ballTrack.ts btBandParts` |
| Breaker (`breaker`) | brkRev 4 | 90 s | finish | 1 per brick (of 80) | 60 → 70, 67 → 100, 76 → 125, 79 → 138, 80 → 140 | wall cleared: PAR(10) over 90 s | none (losing the last ball costs 3 s) | `breaker.ts breakerBandParts` |
| Coral Pop (`bubble`) | bubbleRev 3 | 90 s | finish | 1 per bubble cleared (of 67) | 36 → 70, 50 → 100, 60 → 120, 64 → 132, 66 → 138, 67 → 140 | field cleared: PAR(10) over 90 s | none | `bubble.ts bubbleBandParts` |
| Fission (`burst`) | burstRev 3 | 90 s | finish | 1 per atom hit, −5 units per life lost | 55 → 70, 76 → 100, 88 → 125, 100 → 140 | flat 10 for lasting 90 s | −5 units per life (3 lives) | `burst.ts burstBandParts` |
| Flightpath (`bullseye`) | bullRev 4 | 45 s | open | dart total: rings 10 / 9 / 8 / 3 / 2 / 1 from the centre (`BULLSEYE_RING_VALUES`; values swap places from dart 7), inner bull 12, balloons +1 / +2 / +3 | 75 → 70, 82 → 100, 92 → 125, 101 → 145, 112 → 150 | — | none | `bullseye.ts bullseyeBandParts` (`BULLSEYE_V4_BAND_CURVE`) |
| Gemstone (`matchup`) | matchupRev 5 | 60 s | open | match points (longer lines, cascades and specials score more) | 620 → 70, 900 → 100, 1,300 → 125, 2,000 → 145, 2,500 → 150 | — | none | `matchup.ts matchupBandParts` (`MATCHUP_V5_BAND_CURVE`) |
| Grappler (`swing`) | swingRev 7 | 60 s | finish | 1 per metre (to 500) + 5 per star (10) | 86 → 63, 162 → 90, 245 → 112, 400 → 122, 499 → 124, 550 → 140 | flat 10 for reaching 500 m | none | `swing.ts swingBandParts` (`SWING_V7_BAND_CURVE`) |
| High Rise (`skyline`) | skylineRev 4 | 60 s | open | 5 per block + 5 per perfect drop + 2 per streak point (each perfect from the 3rd in a row) | 100 → 70, 165 → 100, 280 → 125, 480 → 145, 600 → 150 | — | none | `skyline.ts skylineBandParts` |
| Hover (`hover`) | hoverRev 5 | 60 s | finish | 3 per barrier (42) + 2 per star (10) | 24 → 63, 45 → 90, 65 → 112, 100 → 122, 123 → 125, 146 → 140 | flat 10 for lasting the minute | none | `hover.ts hoverBandParts` (`HOVER_V5_BAND_CURVE`) |
| Jaywalk (`cross`) | crossRev 4 | 60 s | open | 1 per lane crossed + 2 more per full crossing | 41 → 70, 50 → 100, 59 → 125, 66 → 145, 77 → 150 | — | none (3 lives) | `cross.ts crossBandParts` |
| Meteor (`snake`) | snakeRev 5 | 60 s | open | 1 per star eaten | 15 → 70, 22 → 100, 26 → 125, 30 → 142, 34 → 150 | — | none | `snake.ts snakeBandParts` (`SNAKE_V5_BAND_CURVE`) |
| Orbit (`orbit`) | orbitRev 6 | 90 s | finish | furthest planet reached (of 40; the sun is 40; black-hole skips count) | 12 → 70, 20 → 100, 30 → 125, 36 → 135, 39 → 138, 40 → 140 | sun reached: PAR(10) over 90 s | none | `orbitRev3.ts orbitBandParts` |
| Rainbow Bridge (`inkbridge`) | inkRev 6 | 120 s | finish | 10 per level + 2 per star (4) | 10 → 33, 20 → 51, 40 → 79, 60 → 103, 80 → 120, 90 → 129, 108 → 140 | all ten levels: PAR(10) over 120 s | none (three failed drops end the run) | `inkBridge.ts inkBridgeBandParts` (`INK_V6_BAND_CURVE`) |
| Rally (`rally`) | rallyRev 4 | 60 s | open | 5 per gold-ball hit + 6 per pink target | 105 → 70, 139 → 100, 154 → 125, 195 → 145, 240 → 150 | — | none (losing the blue ball ends the run) | `rally.ts rallyBandParts` (`RALLY_V4_BAND_CURVE`) |
| Roofbound (`flip`) | flipRev 4 | 60 s | finish | 1 per half second lasted + 3 per star (10) | 40 → 17, 105 → 77, 130 → 110, 140 → 132, 150 → 140 | flat 10 for lasting the minute | none | `flip.ts flipBandParts` (`FLIP_V4_BAND_CURVE`) |
| Scrumper (`snip`) | snipRev 5 | 60 s | finish | 10 per apple + 2 per leaf | 54 → 70, 74 → 100, 90 → 134, 120 → 140 | all ten apples: PAR(10) over 60 s | none | `snip.ts snipBandParts` (`SNIP_V5_BAND_CURVE`) |
| Slice (`slice`) | sliceRev 4 | 60 s | open | combo-weighted slices ÷ the most the run offers (every food at ×3), in thousandths | 435 → 78, 670 → 105, 755 → 130, 835 → 147, 900 → 150 | — | −10 per chilli after the curve (the only post-curve penalty) | `slice.ts sliceBandParts` (`SLICE_V4_BAND_CURVE`) |
| Swish (`bintoss`) | binRev 4 | 60 s | finish | 10 per bucket + 3 per hoop (3) | 45 → 70, 70 → 100, 80 → 118, 90 → 138, 109 → 140 | flat 10 for all ten in | none | `binToss.ts binTossBandParts` |
| Tempo (`beat`) | beatRev 4 | 60 s | open | (4 × Perfect + 3 × Good + 1 × OK − 2 × miss) ÷ (4 × notes), in thousandths | 590 → 77, 810 → 110, 920 → 137, 975 → 148, 1,000 → 150 | — | a miss −2 quarter-notes (units) | `beat.ts beatBandParts` (`BEAT_V4_BAND_CURVE`) |
| Tilt (`tilt`) | tiltRev 4 | 90 s | finish | 30 per maze (4) + best progress toward the exit in the current maze (0–29) + 5 per star (8) | 50 → 35, 86 → 70, 100 → 100, 114 → 125, 140 → 137, 160 → 140 | all four mazes: PAR(10) over 60 s to the buzzer (`TILT_V4_FINISH_MIN`): the full 10 by 75 s | none (a hole ends the run) | `tilt.ts tiltBandParts` (`TILT_V4_BAND_CURVE`) |
| Wavefront (`wavefront`) | wavRev 5 | 90 s | finish | 1 per ship, armour hit, boss hit and saucer + 15 per wave cleared | 100 → 25, 180 → 50, 211 → 70, 218 → 100, 245 → 112, 266 → 125, 268 → 138, 269 → 140 | boss destroyed: PAR(10) over 40 s from its arrival: the full 10 within 20 s, 0 at 40 s | none (3 lives) | `wavefront.ts wavefrontBandParts` (`WAV_V5_BAND_CURVE`) |
| *Junction (`junction`), practice only* | junctionRev 3 | 60 s | finish | 2 per car + 3 per bus + 4 × (ambulances through − stopped) − 1 per driver who gives up | 50 → 40, 89 → 70, 108 → 100, 118 → 120, 130 → 140 | flat 10 for lasting the minute | in the units (a crash ends the run) | `junction.ts junctionBandParts` |

### 10.3 Bands per game (measured medians at the current revision)

Medians of the simulated players at each level (30–100 room seeds), from `docs/arcade-score-bands-oct-2026.md`, taking each game's latest measurement (the band pass, then Tuning A, B, C or E where the game changed).

| Game | Revision measured | Average | Good | Great | Near-perfect | Notes |
|---|---|---|---|---|---|---|
| Ball Tracker | btRev 3 | 70 | 102 | 126 | 138 | |
| Breaker | brkRev 4 | 69 | 104 | 129 | 142 | |
| Coral Pop | bubbleRev 3 | 70 | 100 | 129 | 129 | near-perfect bots barely beat great |
| Fission | burstRev 3 | 70 | 111 | 136 | 137 | |
| Flightpath | bullRev 4 | 68 | 100 | 125 | 142 | |
| Gemstone | matchupRev 5 | 70 | 88 | 103 | 112 | below band from good up: the bots never plan cascades; Joe's 2,500 par stands |
| Grappler | swingRev 7 | 67 | 91 | 116 | 123 | about 10 % lower by design (Joe found it lenient) |
| High Rise | skylineRev 4 | 71 | 99 | 124 | 145 | |
| Hover | hoverRev 5 | 66 | 87 | 119 | 123 | about 10 % lower by design |
| Jaywalk | crossRev 4 | 70 | 96 | 125 | 129 | |
| Meteor | snakeRev 5 | 74 | 103 | 125 | 142 | |
| Orbit | orbitRev 6 | 64 | 100 | 120 | 136 | |
| Rainbow Bridge | inkRev 6 | 33 | 51 | 67 | 92 | fitted low on purpose; Joe's 110–124 runs land about 103–116 |
| Rally | rallyRev 4 | 70 | 100 | 125 | 144 | |
| Roofbound | flipRev 4 | 85 | 147 | 147 | 150 | the game doesn't separate good from near; about 10 % higher by design |
| Scrumper | snipRev 5 | 69 | 100 | 134 | 137 | nearly flat from nine apples up |
| Slice | sliceRev 4 | 74 | 105 | 129 | 126 | |
| Swish | binRev 4 | 69 | 100 | 127 | 138 | |
| Tempo | beatRev 4 | 76 | 113 | 140 | 149 | about 10 % higher by design |
| Tilt | tiltRev 4 | 71 | 99 | 124 | 121 | near players fall chasing hole stars |
| Wavefront | wavRev 5 | 72 | 100 | 128 | 139 | |
| Junction (practice) | junctionRev 3 | 80 | 111 | 114 | 140 | |

### 10.4 Arcade notes

- Help and intro wording: Fission's "each life lost takes 5 off" and Junction's −1 / −4 are units, not points; Flightpath's "rings 10 in the centre down to 1" skips that the values are 10 / 9 / 8 / 3 / 2 / 1; Wavefront's intro line leaves out armour hits (its help has them). The knots in every help string match the code.
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
| Flash, Bang On, Ascend | `tapRev` (1) | stamped: the answer is a raw tap log (`log1:`, up to 16,000 characters and 1,000 taps) replayed by the server (section 14); unstamped: the original summary answers ("t1,t2,…\|falseStarts"; "d1,…,d10"; "reached,errors,…") with clamps only. The phone keeps a `LegacyStage` for unstamped rounds. The legacy Ascend phone sent nothing for an unfinished run (0) |
| Don't Break the Chain | `rulesVersion` (2) | legacy only when the version isn't 2 **and** the stored board count gives 25 or 30 links: 6 or 5 per link, no bonus, momentum {≤ 10: 3,000 ms, ≤ 18: 2,500, rest: 2,000}, FASTER at 10 / 18 / 26; any other unversioned board uses the current rules. No `cycles` → the single legacy `cycle` |
| Mixed Signals (`stroop`) | `clashRev` (3), `queue` (52) | V3 (`clashRev` 3): 75 s, fall ticks [107, 95, 83, 71, 59]; V2 (`queue` 52): 60 s, [95, 77, 65, 41]; V1 (`queue` 18): 60 s, legacy curve round(180 × 0.88^phase); V0: 60 s open stream, score clamp(round(150 × correct ÷ items) − 2 × wrong, 0, 150), no bonus. V1–V3 use the 130 queue formula |
| Pull! | `clayRev` (3) | 3: 10–12 birds; 2: 3–4 birds; anything else: no birds, no bird penalty, perfect = all 25 clays |
| Operator | stage count | 3 stored stages (legacy): 30 / 40 / 50 + speed 30; 4 stages: 25 / 30 / 35 / 40 + speed 20 (`EQUATION_STAGE_POINTS`, `EQUATION_SPEED_POINTS`) |
| Bomb Defusal | `bombVersion` (2) | 2: six steps, 6–9 rule card, 90 s stored on the puzzle, partial round(75 × steps ÷ 6), drawn from the 300-bomb v2 bank; missing: 4 steps, 6 rules, 75 s, 25 per step up to 75. Very old rows grade from `required ?? sequence` |
| Lightbender | stored pieces | old rounds may have fixed `splitters[]`; new ones a movable splitter (`splitterPieces: 1`). Scoring is the same |
| Strikeout, Cryptogrid, Swapword, Letterfall, Brimful, Checkout, Ballpark | `strikeoutRev`, `codewordRev`, `swapwordRev`, `wordfallRev`, `measureRev`, `checkoutRev`, `numlineRev` (all 1) | markers only: nothing branches on them yet |

**Compatibility constants (not scoring versions):** Spatial Memory's `groupSize` (always 2) and Nucleus's `WORDSMITH_CENTRE_INDEX = 4` keep old stored puzzles aligned.

### 11.2 Arcade revisions

Each revision is chosen by `<game>GameFor(rev)`; new state fields exist only on stamped runs and fold into the checkpoint checksum after the unchanged fields, so older states stay byte-identical. Polish F, Polish G and Tuning D changed drawing and effects only and carry no stamps. "Bands" = the Oct 2026 score-band revision (12 Oct).

| Game | Revisions (unstamped → current) |
|---|---|
| Ball Tracker (`btRev`) | unstamped: round(130 × home ÷ 30), all home = `finishScore` on the 60 s timing (most 135) · 2 (Batch 1, 11 Oct): occupied tubes turn, bottom-row switch drops, bonus over the landing window · **3** (bands) |
| Breaker (`brkRev`) | unstamped: full-column laser, ×5, two double-ball bricks; round(130 × bricks ÷ 80), clear = `finishScore` · 2 (Batch 3): 5 s Fireball, 4-brick laser, ×3, one double ball, two sliding rows · 3 (bands) · **4** (Tuning B): Fireball 3.5 s |
| Coral Pop (`bubbleRev`) | unstamped: round(130 × share cleared), clear = `finishScore` · 2 (Batch 2): Joker every 15 shots, a mine and a torpedo every 60, partial out of 100 · **3** (bands): Joker every 22 shots, one mine or torpedo in the first 60 |
| Fission (`burstRev`) | unstamped: 2 per hit − 9 per life; 150 for a full run with no life lost and 4+ waves · 2 (Batch 3): rarer BURST and SHIELD, FREEZE drop, partial cap 130 · **3** (bands) |
| Flightpath (`bullRev`) | unstamped: floor(1.7 × total − 20) · 2 (Batch 5): inner bull 12, 12-point balloon · 3 (bands) · **4** (Tuning B): drifting +1 / +2 / +3 balloons, knots refitted |
| Gemstone (`matchupRev`) | unstamped: floor(150 × points ÷ 2,500) · 2 (Batch 2): Jackpot gem, constant play, par 5,000 · 3 (Batch 2 fixes): original-speed falls, par 5,500 · 4 (bands): 150 at 1,300 · **5** (Tuning C): each swap waits for the board to settle, 150 at 2,500 |
| Grappler (`swingRev`) | unstamped: round(130 × m ÷ 500), 500 m = `finishScore` · 2–3 (Lovable): small, then bigger dragons · 4 (Batch 3): chasing dragon from 200 m, stalactites, lava jets, star anchors; round(120 × m ÷ 500) + stars · 5 (bands) · 6 (Tuning A): touch stars on proved lines, 2 s stalactite crumble · **7** (Tuning C): about 10 % lower |
| High Rise (`skylineRev`) | unstamped: floor(2.5 × blocks + 3 × perfects) · 2 (Batch 4): gusts from block 20, perfect-streak bonus · 3 (bands; Tuning A changed the flag art only) · **4** (Tuning E): taller 390 × 735 view, same play and curve |
| Hover (`hoverRev`) | unstamped: round(150 × barriers ÷ total) · 2 (Batch 2): gold stars, two-gap and sliding barriers, 130 + 20 · 3 (bands) · 4 (Tuning C): about 10 % lower · **5** (Tuning E): 390 × 735 world, the same course drifting over the extra height (≤ 22 px a climb) |
| Jaywalk (`crossRev`) | unstamped: 2 per lane + 4 per crossing · 2 (Batch 1): fair crossings 1–2, cyclist lanes from 3, roadworks from 4 · 3 (Batch 1 fix): three riders per cyclist lane at uneven gaps · **4** (bands) |
| Meteor (`snakeRev`) | unstamped: 5 per star, 15 × 20 grid · 2 (Batch 2): seeded rocks, head-only hits · 3 (Batch 2 fixes): one 20-star meteor shower (at most 11 rocks) · 4 (bands) · **5** (Tuning E): 15 × 28 grid (390 × 724), 150 at 34 stars |
| Orbit (`orbitRev`) | unstamped: original course; 3 per planet, sun = `finishScore` · 3 (Lovable): wide zig-zag course from the proved bank · 4 (Batch 5): three black holes · 5 (bands) · **6** (Tuning A): fly-in after a black hole, a missed hop ends sooner |
| Rainbow Bridge (`inkRev`) | unstamped: block obstacles; 11 per level, all 10 = `finishScore` · 2–3 (Lovable): birds; moving pot on 5–8, live drawing on 9–10 · 4 (Batch 5): optional stars · 5 (bands) · **6** (Tuning C): knots at about 93.5 % |
| Rally (`rallyRev`) | unstamped: floor(2.5 × gold hits) · 2 (Batch 5): two +3 pads, bumper from 30 s · 3 (bands) · **4** (Tuning B): each pad stays in its own half, knots refitted |
| Roofbound (`flipRev`) | unstamped: floor(150 × (s ÷ 60)²), bend from 20 s · 2 (Batch 1): crumble tiles, 10 proved stars, bend from 15 s · 3 (bands) · **4** (Tuning C): bend from 10 s, about 10 % higher |
| Scrumper (`snipRev`) | unstamped: templates 0–9 in a fixed order · 2 (Lovable): 3 easy / 4 medium / 3 hard of 30 templates · 3 (Batch 4): 60 orchard templates (branches, planks, gutters, sliding basket, wasp nests) · 4 (bands) · **5** (Tuning E): tall 360 × 640 bank, 2 easy / 3 medium / 5 hard, picker's crooks, lower knots refitted |
| Slice (`sliceRev`) | unstamped: floor(235 × weighted ÷ (3 × foods)) − 10 per chilli · 2 (Batch 1): mayonnaise Squeeze, a chilli ends the combo · 3 (bands) · **4** (Tuning C): blade 4 px wider each side, cuts 50 % back past the start |
| Swish (`binRev`) | unstamped: 10 per bucket, 10/10 = `finishScore` · 2 (Lovable): catch zone 85 % · 3 (Batch 5): hoops and spinners, exact quarter-bucket wind · **4** (bands) |
| Tempo (`beatRev`) | unstamped: floor((4P + 3G + OK − 8M) ÷ 4) · 2 (Batch 5): swipe notes from 30 s · 3 (bands; a miss −2) · **4** (Tuning C): about 10 % higher |
| Tilt (`tiltRev`) | unstamped: 30 per maze, 4 = `finishScore` · 2 (Batch 4): stars, amber marble from maze 3 · 3 (bands; Tuning A re-deals seeds so every cup is reachable) · **4** (Tuning C): amber starts far from its cup, stars at hole mouths, finish window from 60 s, knots refitted |
| Wavefront (`wavRev`) | unstamped: 60 s, floor(150 × units ÷ 248) · 2 (Batch 3): 90 s, fly-ins, divers, five waves and a boss · 3 (bands) · 4 (Tuning A): shaped waves 2–5 · **5** (Tuning C): waves 3–4 drop three quarters of a row, saucer 1 unit, timed kill bonus |
| Junction (`junctionRev`) | unstamped: 2 per car ± 4 per ambulance − give-ups + 40 for the minute · 2 (Batch 4): diagonal roads every 12 s, buses, + 20 · **3** (bands); retired to practice in Tuning C with no new stamp |

Proofs: `arcade-batch1`–`5-check`, `arcade-score-bands-check`, `arcade-tuning-a-check`, `tuning-b-check`, `arcade-tuning-c-check` and `arcade-tuning-e-check` replay runs recorded on the code before each change to the same score and state; `arcade-self-replay-check` covers every revision.

## 12. Retired games (practice only, `RETIRED_TYPES`)

Never dealt in rooms; still playable in practice, and stored rounds replay and score on their own rules. "speedBonus(ms, L)" is the par curve on stamped puzzles (50 with half the time left, else round(100 × ms ÷ L)) and linear on unstamped ones.

| Game (id) | Cat | Time limit | Complete | Bonus | Unfinished / wrong | Items / notes | File + function |
|---|---|---|---|---|---|---|---|
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

**Ruling D (12 Oct 2026), the prerequisite for ranked play:** Flash, Bang On and Ascend are server-verified. Rounds stamped `tapRev: 1` (`tapLog.ts TAP_REV`, set on every new puzzle) send every raw tap on the round clock, and the server works out the score from those taps and the stored puzzle. Older rounds keep their summary answers and original grading.

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
| Lightbender (`laser`) — shots fired | the shot count (1–3) the answer claims | not replayed: `verifyLaser` reads `max(1, min(3, shots))` and turns 0 into 3; the draft at the buzzer claims at least 1, so a solving layout never fired scores as shot 1 | `laser.ts verifyLaser`, `laser.tsx` |
| Integer Pyramid (`numpyramid`) — `active` | which pyramid earns partial credit | taken from the answer | `grade.ts` case "numpyramid" |
| Don't Break the Chain — time left | the claimed `msRemaining` for the finish bonus | held only by the 1.5 s receipt check; not capped by the replayed last tap (Ascend's log is) | `grade.ts` case "chain" |

**What remains client-timed (honestly).** The score can no longer be invented: the phone can't claim a reaction, distance, count or error total, only taps. But the taps themselves are still the phone's word:
- **Timing.** Every tap time comes from the phone's clock (`serverNow()`, the shared clock calibrated against the server). The server holds the log to the round, to its own receipt time + 1.5 s, and to the rules (Flash's 100 ms floor); it can't tell a real 180 ms reaction from a plausible faked one, or a real Bang On stop from a well-timed fake. Fully server-timed reactions would need taps streamed to the server as they happen; that is the next step before money play.
- **Omission.** A modified client can leave a tap out of its log (a false start, a wrong Ascend tap). The server then scores the run those remaining taps describe, which is a run the player could have played; it can't see a tap that was never sent. A wrong tap relabelled as a number that isn't on the board still counts as wrong.
- **Floating point.** Bang On's moving targets use `Math.sin`; the phone and the server compute the same formula but on different JavaScript engines, so in a vanishingly rare case a displayed "+12 ms" could be 1 ms off the server's figure. Only the server's figure is stored and shown on the reveal.

**Player-visible changes in `tapRev: 1` rounds:** Flash counts a tap within 100 ms of the gold as a false start (intro and help text updated). Bang On starts each watch exactly 600 ms after the last result instead of on the next screen frame (at most a frame earlier; not visible). Ascend now sends its log when the timer runs out, so an unfinished run earns the documented 5 per number reached − 5 per wrong tap; before, the phone sent nothing for an unfinished run and it scored 0.

**Proof:** `scripts/tap-log-check.tsx` replays 36 honest runs recorded on main before the change (`scripts/fixtures/tap-log-honest-runs.json`, from the real phone Stages played in happy-dom by `scripts/tap-log-record.tsx`): every one still grades exactly as main stored it, and as a tap log scores the same with the same tie-break time (the 3 unfinished Ascend runs aside, as above). Today's phone Stages, played by the same scripted players, reproduce main's exact answers on unstamped puzzles and send logs the server scores identically on stamped ones (6 runs per game by default, all 12 with `TAP_LOG_PARITY=all`), and the reveal shows the server's figures. 381 tampered logs (summary answers, claimed counts, impossibly fast taps, reversed order, times beyond the round or after receipt, garbage, floods, relabelled wrong taps, inflated time left) never score above the honest run.

## 15. Dead code and stale comments

| Item | Finding |
|---|---|
| `scoreSymbolScan`, `scoreEquation`, `scoreCountUp` (`scoring.ts`) | referenced nowhere outside `scoring.ts`; grading uses the `stagedRounds.ts` versions |
| `scoreStroop` | removed 11 Oct (commit 3c05e01); only the unused constant `STROOP_ITEMS = 12` remains |
| `UNFINISHED_CAP`, `totalAnswerMs`, `MOVES_SHAPE` | exported but used only inside `scoring.ts` |
| `add_maths` / `add_arcade` / `no_maths` | database columns and generated types only |
| `SubmitExtra.errors` | accepted, never read (Ascend's phone still sends it; tap-log rounds count errors from the log) |
| `REACTION_FALSE_START_MS` (200) | declared as "added to the average", never used |
| Stale comments | `scoring.ts` Reaction "50 at 650 ms" and Stop Watch "down to 50 at 400 ms" (real: 47); `types.ts` "twenty two-digit numbers" (24); `grade.ts` "three differences" (6); `scoring.ts` Mirror Match "three flips"; `parry.ts` "Five per arrow" (2); `registry.ts` comments on `CORE_CATEGORIES` ("always in the room draw") and `ARCADE_CATEGORY` ("one round at most, only when the host toggle is on") describe the old rotation |

---

## 16. Open items

Nothing here has been changed in the app. Each needs Joe's ruling or a small follow-up; none affects stored rounds.

1. **Tie-break time uses a fixed 30 s.** `totalAnswerMs` adds `ROUND_MS − ms_remaining` with `ROUND_MS` = 30,000, not the game's own limit: rounds longer than 30 s can add a negative amount, and rounds stored with 0 ms left (Flash, Go/No-Go, Mixed Signals) add 30,000. It decides only ties on equal totals. Changing it would change past results' tie-breaks, so it needs a versioned rule.
2. **Doing nothing scores** in Bang On (20), Labyrinth (1–2), Slider (22–66 on about a fifth of grids), Jumbled (up to 84), Hanoi (up to 49), Pipeline (2–21), Colour Flood (1–11), Exact (up to about 61 on 3.5 % of boards) and Ballpark (wild placements). Decide whether a start-state credit should be subtracted (a new stamp per game).
3. **Free mistakes** still in place: Lookout, Tents and Trees, Trail, Matchmaker, Double Take, Box Six, Roundabout, Cryptogrid, Ball Tracker (wrong trays). Ruled "keep by design" on 10 Oct for Lookout, Tents, Trail, Matchmaker, Interloper and Ball Tracker; the others are new to the list. (Interloper now reads only the first N taps per board, so a wrong tap costs a pick.)
4. **Mixed Signals' reveal shows a linear time bonus** (`clashTimeBonusOf`) while the score uses the par curve. The stored score is right; the reveal's "+N" line is wrong whenever less than all the run is left. Display fix only.
5. **Counterweight's intro and help** say "20, 40 and 60 for scales 1, 2 and 3"; the code gives 20 for one scale, 60 for two, and requires them in order. Fix the wording or the rule (a rule change needs a stamp).
6. **Lightbender's shot count is the phone's word.** The server can't see shots, only the final layout; an unfired solving layout scores as shot 1. Record shots as a log (like the tap logs) before ranked play.
7. **Integer Pyramid's partial credit goes to the pyramid the phone names** (`active`). Low stakes (30 at most) but client-chosen.
8. **Intro / help wording gaps:** Strikeout's intro (2 per letter showing), Blackout (the 5-per-press branch), Mosaic ("÷ cells" is ÷ the picture's filled cells), Tents (110 cap), Gridlock ("up to 70" is 63), Tenfall (half-time rule), Letterfall (Qu counts as two), Fission and Junction (penalties are units), Flightpath (ring values 10 / 9 / 8 / 3 / 2 / 1), Wavefront's intro (armour hits).
9. **Roundabout's `isCorrect` counts cells while the score counts word slots.** Harmless unless crossings fill every cell before every word is found; then the round is marked correct but scored as unfinished.
10. **Tap timing is still client-side** (section 14): fully server-timed taps need live streaming before money play.
11. **Tries rewards** (Lightbender, Safe Cracker 130 / 115 / 100) stay as an intended efficiency reward; recorded so it stays a conscious choice.
12. **Arcade calibration.** Gemstone (good 88, great 103, near 112), Hover and Grappler (deliberately ~10 % lower), Rainbow Bridge (fitted low) and Roofbound (good ≈ near) sit outside the target bands by design or because the bots can't play like people; re-fit after Joe's phone testing.
13. **Orbit falls back to an unstamped round** if the proved course bank ever misses; that round would play and score on the original rules. The bank is never empty today.
14. **Stale comments and dead helpers** (section 15): tidy in the next code change.

**Closed since 11 Oct:** rotation rebuilt (note 1); Flash, Bang On and Ascend tap logs (note 2); the "÷ 75 s" intro text (note 3); Wavefront `armourHits` counts the player's hits (note 4, false alarm); `scoreStroop` removed (note 5); Operator 25 / 30 / 35 / 40 + 20 (note 6); Exact 75 s and Slider 100 s (note 8); Pipeline's step boundary (note 9: 27 → 40, 26 → 39); the arcade finish-bonus and 130 / 150 notes (notes 10–11, superseded by the bands); the Tents comment (note 14).
