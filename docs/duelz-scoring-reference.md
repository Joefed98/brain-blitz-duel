# Duelz — Scoring Reference (as implemented, 8 Oct 2026)

Rewritten from Lovable's read-only scoring audit of 8 Oct 2026 (`scoring-report.md`). This is what the server grading code **does** today, quoted from the code — not what any prompt asked for. It supersedes the 4 Oct and 6 Oct versions. Where the audit contradicts itself or earlier decisions, the facts below follow the audit and the conflict is listed in **section 16, Review notes**, for Joe's ruling.

Every round scores 0–150. Room total = sum of a slot's round scores.

---

## 1. Common rules

| Rule | Value / formula | Location |
|---|---|---|
| Score range per round | 0–150 (`BASE_POINTS=100`, `MAX_SPEED_BONUS=50`) | `scoring.ts` `BASE_POINTS`, `MAX_SPEED_BONUS`, `MAX_ROUND_SCORE` |
| Room total | sum of a slot's `round_results.score` | `scoring.ts` `totalScore()`, `totalScoreThrough()` |
| Tie-break (2-player) | higher total wins; equal totals → lower `totalAnswerMs` wins; still equal → `"draw"` | `scoring.ts` `duelOutcome()` |
| `totalAnswerMs` | sum over rounds of `reaction_avg_ms` if set, else `ROUND_MS − ms_remaining` | `scoring.ts` `totalAnswerMs()` |
| Room standings (3+) tie-break | same metric; ties share a `position` | `scoring.ts` `rank()`, `standings()` |
| Trusted time-left rule | server trusts the client's `msRemaining` unless it exceeds `serverMsRemaining + 1500 ms`; if so it is clamped to the server's own clock and a warning is logged | `grade.ts` `trustedMsRemaining()`, `TIME_CLAIM_TOLERANCE_MS = 1_500`; called from `duel.functions.ts` `submitAnswerFn` (computes `serverMs` from `phase_started_at` / `round_started_at` + `puzzlePrepMs`) |

## 2. Shared scoring helpers and notation

| Helper | Formula | Location |
|---|---|---|
| `speedBonus(msRemaining, limit=ROUND_MS)` | `round(50 × clamp(ms, 0, limit) ÷ limit)` | `scoring.ts` |
| `reactionBonus(avgMs)` | `clamp(round((650 − avgMs) ÷ 10), 0, 50)` | `scoring.ts` |
| `speedPoints(P, ms, limit)` — **SPEED(P)** | `round(P × clamp(ms, 0, limit) ÷ limit)` | `scoring.ts` |
| `movesPoints(B, moves, minMoves)` — **MOVES(B)** | `round(B × clamp(1 − (moves − minMoves) ÷ minMoves, 0, 1))` — full at the minimum, 0 at twice it | `scoring.ts` |
| `standardComplete(ms, limit)` — **Shape A** | `clamp(130 + SPEED(20), 0, 150)` | `scoring.ts` |
| `scoreSolvedMoves(moves, min, ms, limit, shape)` — **Shape B / C** | `clamp(100 + MOVES(w.moves) + SPEED(w.speed), 0, 150)`; `MOVES_SHAPE.B = {moves: 25, speed: 25}`, `MOVES_SHAPE.C = {moves: 40, speed: 10}` (Colour Flood only) | `scoring.ts` |
| `solvedMovesText(...)` | reveal-line string for the above | `scoring.ts` |
| `scoreRound(isCorrect, ms, limit)` | correct → `100 + speedBonus`; else 0 | `scoring.ts` |
| Staged-round helpers | `scoreSymbolScanStages`, `scoreCountUpStages`, `scoreEquationStages`, `scanStageResult`, `splitStages`, `STAGE_COUNT` | `stagedRounds.ts` (imported by `grade.ts`) |
| Arcade scores | each sim exposes its own `.score()` on the server-replayed run, clamped 0–150 | `src/lib/arcade/*.ts`; checked in `scripts/six-game-scoring-check.ts` |
| `finishScore(runTicks, finishTick)` — arcade full clear | `clampInt(130 + round(20 × left ÷ runTicks), 0, 150)` | `engine.ts` |
| `UNFINISHED_CAP = 110` | ceiling for unfinished Shape B boards (e.g. Sort the Tubes) so they can never reach a "finished" (130+) score | `scoring.ts` |

Notation used in the tables: **ms** = trusted time left; **limit** = the game's registry time limit.

## 3. Score-check anchors enforced by scripts

| Script | Anchors |
|---|---|
| `scripts/standard-scoring-check.ts` | Shape A complete at half time = 140; Shape B at minimum moves + half time = 137/138; `scoreSolvedMoves(20, 10, 0, L) = 100`; named partial-credit anchors (e.g. Flow 11/12 → 110, Tower 8/9 → 98, Pair 14/15 → 112, Spot 5/6 → 100); staged anchors (Symbol Scan perfect at half time → 140, Count Up exact at zero time → 130) |
| `scripts/six-game-scoring-check.ts` | Formula identity across the full input range for Ball Track, Matchup (`MATCHUP_PAR_RAW = 2500`), Junction, Rally, Skyline, Bullseye (anchors 100 → 150, 90 → 133, 70 → 99, 50 → 65; `BULLSEYE_RING_VALUES = [10, 9, 8, 3, 2, 1]`); intro-text (`INTRO_SCORE`) wording checks; guards that old Ball Track and other arcade demo puzzles are rejected |
| `scripts/reveal-score-check.tsx` | For every active and retired puzzle type, the reveal's `data-reveal-score` equals the stored `round_results.score`; pending state shows "Scoring…"; static scan bans any `Reveal()` computing its own score; special Cross (two additive terms, capped at 150) and Bubble Pop (percent cleared / 130 + time) breakdown checks |

---

## 4. Word — 6 active

All formulas from `scoring.ts`, `grade.ts`, and per-type files. Everything is clamped to 150.

| Game | Time limit | Complete / correct | Optimal / move bonus | Unfinished / wrong | Items / stages | Penalties | File + function |
|---|---|---|---|---|---|---|---|
| Wordsmith | 100,000 ms | floor(2.5 × word points), cap 150 | none | same formula, scales down; 0 words = 0 | word list; par = 35% of board points | none; `isCorrect` = points ≥ par, but the score uses raw points regardless | `scoring.ts scoreWordsmith`, called from `wordsmith.server.ts` |
| Word Hunt | 100,000 ms | 2 × word points, cap 150 | none | same formula (proportional, no floor) | words found on the grid | none | `scoring.ts scoreWordHunt`, `wordHunt.server.ts` |
| Tile Grid | 100,000 ms | all 15 tiles in a valid grid: 130 + SPEED(20), cap 150 | speed only | not all valid: 8 × tiles in valid words, cap 150 | 15 tiles | none | `tileGrid.ts scoreTileGrid`, `grade.ts` case "tilegrid" |
| Word Slide | `WS_TIME_MS` (par-based) | all 5 rows: 100 + SPEED(30) + MOVES(20, moves, par), cap 150 | MOVES full at par, 0 at 2 × par | fewer than 5 rows: 22 × rows, cap 150 | 5 rows | none | `scoring.ts scoreWordSlide` |
| Word Search | 120,000 ms | all found: 130 + round(20 × ms ÷ limit), cap 150 | speed only | not all: 20 × found, **cap 120** | 6 words | `_wrong` parameter unused — wrong picks are free | `wordSearch.ts scoreWordSearch` |
| Letter Wheel | 100,000 ms | all slots: 130 + round(20 × ms ÷ limit), cap 150 | speed only | 15 per word (8-word boards) or 13 per word (9-word boards), cap 150 | 8 or 9 words | none | `letterWheel.ts scoreLetterWheel` |

**Word oddities (as reported)**
- Word Search: the unfinished cap is 120, not the usual 150/110 pattern, and wrong picks are free (the instructions don't mention this, which is consistent).
- Wordsmith: `isCorrect` (par-based) is decoupled from the score (raw points), so a score above 0 is possible while `isCorrect` is false. The SCORE text matches the formula.
- Letter Wheel, Word Search and Tile Grid finishing bonuses read the registry time limit, not a hard-coded divisor. No inversion: finishing (130+) is always at least the maximum unfinished score.
- Letter Wheel and Word Search score 0 for 0 words — no reward for doing nothing in this category.

## 5. Number (opt-in) — 6 active

| Game | Time limit | Complete / correct | Optimal / move bonus | Unfinished / wrong | Items / stages | Penalties | File + function |
|---|---|---|---|---|---|---|---|
| Target Number | type default (`ROUND_MS` unless set) | distance 0: min(150, 130 + round(20 × ms ÷ limit)) | speed only | distance 1–10: 120 − ((d − 1)(d + 2)) ÷ 2; distance > 10: max(0, round(66 − 0.6 × (d − 10))) | single number | none | `scoring.ts scoreTargetNumber`, `grade.ts` case "target" |
| Equation Balancing | `EQUATION_TIME_MS` (90 s) | sum of stage points (`EQUATION_STAGE_POINTS`) + round(`EQUATION_SPEED_POINTS` × ms ÷ `EQUATION_TIME_MS`) when all 4 stages are correct | speed only, on all 4 | sum of correct stages | 4 stages (`EQUATION_STAGE_COUNT`) | none | `stagedRounds.ts scoreEquationStages` — see section 11; not in the audit's number table |
| Balance | 90,000 ms (`BAL_TIME_MS`) | all 3 scales: min(150, 120 + round(30 × ms ÷ limit)) | speed only | stage credit 20 / 40 / 60 for 1 / 2 / 3 solved, in order only | 3 scales | none | `balance.ts balanceRoundScore` |
| Number Pyramid | 120,000 ms | all 4 pyramids: 30 × 4 + round(30 × ms ÷ limit), cap 150 | speed only | 30 × completed pyramids + proportional credit on the active pyramid only | 4 pyramids (`NP_SET_SIZE`) | none | `numberPyramid.ts scoreNumberPyramid` |
| Trail | 120,000 ms | complete: min(150, 130 + round(20 × ms ÷ limit)) | speed only | 5 × correct player tiles, cap 130 | 36-cell path, 10 givens | wrong tiles score 0, no penalty (stated in the instructions) | `trail.ts scoreTrail` |
| Ten Drop (engine) | 93,000 ms registry; 90 s run (`TD_CONFIG.runSeconds`) | all 10 cleared: 13 × 10 + round(20 × (runTicks − clearTick) ÷ runTicks), cap 150 | early-clear bonus only | 13 × cleared, no finish bonus | 10 targets | none | `arcade/tenDrop.ts tenDropScore` |

**Number oddities (as reported)**
- Ten Drop: the early-clear divisor is `TD_RUN_TICKS` (the 90 s sim run), not the registry's `TENDROP_TIME_MS` (93,000 ms, which includes 3,000 ms arcade slack). Different by design, but easy to misread.
- Number Pyramid: partial credit only applies to the active pyramid; finished pyramids keep a flat 30 each, and only the final 30 is time-based.
- Balance: stage credit needs the scales solved strictly in order (`balanceSolvedCount` stops at the first unsolved scale). A correct third scale with the first wrong scores 0, not 60.
- Trail: free mistakes by design — wrong tiles are simply excluded from the correct count.
- None of the six gives points for doing nothing.

## 6. Speed — 6 active

| Game | Time limit | Complete / correct | Optimal / move bonus | Unfinished / wrong | Items / stages | Penalties | File + function |
|---|---|---|---|---|---|---|---|
| Reaction Time | 60,000 ms (`REACTION_ROUND_MS`) | n/a (continuous) | n/a | average ≤ 200 ms: 150; else clamp(round(150 − 0.16 × (avg − 200)), 0, 150) | average of flash reaction times | −8 per false start | `scoring.ts scoreReaction`, `grade.ts` case "reaction" |
| Stop Watch | 60,000 ms (`STOPWATCH_ROUND_MS`) | n/a (continuous) | n/a | average ≤ 20 ms: 150; else clamp(round(150 − 0.27 × (avg − 20)), 0, 150) | 10 attempts; a miss counts as 500 ms | none beyond the miss value in the average | `scoring.ts scoreStopWatch` |
| Don't Break the Chain | 45,000 ms (`CHAIN_TIME_MS`) | all 40 links: min(150, floor(3.5 × 40) + round(10 × ms ÷ 45,000)) = 140 + bonus | speed-only finish bonus (`CHAIN_FINISH_BONUS = 10`) | floor(3.5 × links) | 40 links (`CHAIN_LENGTH`) | the first wrong or momentum-lapse tap ends the chain at the current link count; no extra deduction | `chain.ts chainScore`, `grade.ts` case "chain" |
| Number Hunt | 60,000 ms (`NUMHUNT_TIME_MS`) | all 24: clamp(130 + round(20 × ms ÷ limit) − 5 × errors, 0, 150) | speed only | clamp(5 × reached − 5 × errors, 0, 150) | 24 numbers (`NUMHUNT_COUNT`) | −5 per wrong tap (`NUMHUNT_ERROR_PENALTY`), finished and unfinished | `scoring.ts scoreNumberHunt` |
| Clay Shoot (engine) | registry 63,000 ms (`CLAYSHOOT_TIME_MS`); 60 s run (`CLAY_RUN_TICKS`) | n/a — one formula for any state | +10 for a perfect run (all 22 orange + 3 gold) | 5 × orange hits + 10 × gold hits (+10 if perfect), clamp 0–150 | 25 clays (22 orange, 3 gold) | none; missed clays just earn nothing | `arcade/clayShoot.ts clayScore` |
| Whack-a-Target (engine) | 60 s run + 3,000 ms slack (`WHACK_RUN_TICKS`) | n/a — one formula | +15 for a perfect run (all targets hit) | floor((2 × 135 × hits + total) ÷ (2 × total)), i.e. round(135 × hits ÷ total), minus penalties | seeded number of targets per run | −3 wrong colour, −5 bomb, −3 empty hole; clamp 0–150 | `arcade/whack.ts whackScore` |

**Speed oddities (as reported)**
- Clay Shoot and Whack-a-Target have no time bonus at all, unlike the other speed games.
- Don't Break the Chain: the finish-bonus divisor is the constant `CHAIN_TIME_MS` (45,000). It matches the registry today, but a future per-puzzle time change would silently desync it.
- Whack-a-Target: no finished/unfinished distinction; an all-miss run scores 0 (penalties can't go below the 0 floor).
- Clay Shoot: doing nothing scores 0; missed clays carry no penalty.
- Number Hunt: the error penalty also applies when unfinished, down to 0. No inversion: unfinished maximum without errors is 120, below the 130 finish floor.
- Reaction Time and Stop Watch have no unfinished state; false starts can take Reaction to 0 but never below.
- The intro SCORE text for all six speed games matches the constants exactly.

## 7. Attention — 7 active

| Game | Time limit | Complete / correct | Optimal / move bonus | Unfinished / wrong | Items / stages | Penalties | File + function |
|---|---|---|---|---|---|---|---|
| Count Up | `COUNTUP_TIME_MS` 45,000 ms | exact per stage = stage weight (30 / 45 / 55); all 3 exact → + round(20 × ms ÷ limit) | none | off by 1 = 60% of the weight, off by 2 = 30%, else 0 | 3 stages | none beyond lost weight | `stagedRounds.ts countStagePoints` / `scoreCountUpStages`, `grade.ts` case "countup" |
| Intruder Detection | `INTRUDER_TIME_MS` = 5 × 15,000 = 75,000 ms | all 5 boards → Shape A (130 + SPEED(20)) | n/a | 24 per board right; 12 for one of two changes on the later boards; clamp 0–150 | 5 boards | none | `scoring.ts scoreIntruder` |
| Maze Dash | `MAZE_TIME_MS` 60,000 ms | solved → Shape A | n/a | round(110 × progress) | 1 path | none | `scoring.ts scoreMaze` |
| Pair Match | `PAIR_TIME_MS` 90,000 ms | solved → Shape A | n/a | 8 per pair found (`PAIR_PAIR_POINTS`), clamp 0–150 | 15 pairs | none (wrong flips cost only time) | `scoring.ts scorePairMatch` |
| Spot the Difference | `SPOT_TIME_MS` 30,000 ms | all 6 found → Shape A | n/a | 20 per difference (`SPOT_DIFF_POINTS`) | 6 differences | none | `scoring.ts scoreSpotDifference` |
| Symbol Scan | `SYMSCAN_TIME_MS` 30,000 ms | per stage: weight × found ÷ total − 3 × wrong; all 3 perfect → + round(20 × ms ÷ limit) | n/a | partial share per stage, floor 0 | 3 stages | −3 per wrong tap | `stagedRounds.ts scanStageResult` / `scoreSymbolScanStages` |
| Colour Clash (stored as `stroop`) | ~75 s run (`CLASH_REV3_RUN_TICKS`) | round(130 × correct ÷ 52) − 2 × wrong; finishing the queue → + round(20 × ticks left ÷ run ticks) | n/a | same formula with fewer correct | 52 words (`CLASH_QUEUE`) | −2 per wrong gate | `colourClash.ts clashQueueScoreOf` / `clashTimeBonusOf` |

Maze Dash's file sets `category: "attention"`, so rooms draw it as attention even though its scorer sits with the logic-style shape scorers.

**Attention oddities (as reported)**
- Pair Match: wrong flips are free, and the cap is 150 (not the stricter 110 used elsewhere).
- Intruder Detection: only matched cells count, so extra wrong taps on a board carry no penalty.
- Colour Clash: the intro text matches the real formula in `colourClash.ts`. `scoreStroop` in `scoring.ts` (12 items, flat accuracy) is a legacy function never called for this game.

## 8. Pattern — 7 active

| Game | Time limit | Complete / correct | Optimal / move bonus | Unfinished / wrong | Items / stages | Penalties | File + function |
|---|---|---|---|---|---|---|---|
| Block Party | `BLOCK_TIME_MS` 60,000 ms | solved → Shape A | n/a | 12 per piece placed (`BLOCK_PIECE_POINTS`) | 9 pieces | none | `scoring.ts scoreBlockParty` |
| Gravity Maze | `GRAV_TIME_MS` 90,000 ms | solved → Shape B: 100 + MOVES(25) + SPEED(25) | MOVES(25, tilts, min) | 30 per locked ball (`GRAV_LOCK_POINTS`) | 4 balls | none | `scoring.ts scoreGravity` |
| Ice Slide | `SLIDE_TIME_MS` 90,000 ms | solved → Shape B | MOVES(25, moves, min) | round(90 × progress) (`SLIDE_PARTIAL_POINTS` = 90) | 1 path | none | `scoring.ts scoreIceSlide` |
| Laser and Mirrors | `LASER_TIME_MS` 60,000 ms | solved on fire 1 / 2 / 3 → 130 / 115 / 100 + SPEED(20) | fewer fires = higher base | fired but not solved: 15 per gem lit (`LASER_GEM_POINTS`); never fired = 0 | 6 gems, up to 3 fires | none explicit; a failed fire uses up a shot | `scoring.ts scoreLaser` |
| Rotating Rings | `RINGS_TIME_MS` 60,000 ms | solved → Shape B | MOVES(25, moves, min) | 12 per aligned spoke (`RINGS_SPOKE_POINTS`), clamp 0–150 | spokes (`RINGS_SEGMENTS`) | none | `scoring.ts scoreRings` |
| Sliding Tiles | `TILES_TIME_MS` 60,000 ms | solved → Shape B | MOVES(25, moves, min) | 14 per tile in place, cap 90 | 8 tiles | none | `scoring.ts scoreTiles` |
| Unblock | `UNBLOCK_TIME_MS` 60,000 ms | solved → Shape B | MOVES(25, moves, min) | up to 70: round(70 × blocker-clear progress), or a flat 10 if any blocker has been cleared | 1 goal car | none | `scoring.ts scoreUnblock` |

**Pattern oddities (as reported)**
- Laser: solving on fire 1 / 2 / 3 scores 130 / 115 / 100 (`LASER_FIRE_BASE`). Fewer shots used scores more.
- Laser: an unsolved run scores a flat 15 per gem lit, with no speed component.
- Ice Slide and Unblock unfinished caps (90 and 70) are below the 110 `UNFINISHED_CAP` used elsewhere.
- Unblock: clearing any blocker guarantees at least 10 (`clamp(max(partial, fewerBlockers ? 10 : 0), 0, 70)`).
- Gravity Maze: 30 per locked ball, so 120 is the unfinished maximum — under the 130 finish floor.

## 9. Logic — 14 active

| Game | Time limit | Complete / correct | Optimal / move bonus | Unfinished / wrong | Items / stages | Penalties | File + function |
|---|---|---|---|---|---|---|---|
| Bomb Defusal | `BOMB_TIME_MS` 75,000 ms | defused → Shape A | n/a | 25 per correct step before the strike, max 75 (`BOMB_PARTIAL_POINTS`) | 4 steps | none beyond lost steps | `scoring.ts scoreBomb` |
| Colour Flood | `FLOOD_TIME_MS` 60,000 ms | solved → Shape C: 100 + MOVES(40, moves, par) + SPEED(10) | MOVES(40) — heaviest move weight of any game | round(110 × region ÷ 196) (`FLOOD_PARTIAL_POINTS` = 110) | 196 cells (14 × 14) | none | `scoring.ts scoreFlood` |
| Colour Connect | `FLOW_TIME_MS` 75,000 ms | solved → Shape A | n/a | 10 per pair joined (`FLOW_PAIR_POINTS`) | up to 12 pairs | none | `scoring.ts scoreFlow` |
| Lights Out | `LIGHTS_TIME_MS` 75,000 ms | solved → Shape B | MOVES(25, presses, min) | 1 / 2 / 3 / 4 lights left → 85 / 75 / 60 / 50; else 5 per correct tap, max 45 | 36 cells | none | `scoring.ts scoreLightsOut` |
| Light Up | `LIGHTUP_TIME_MS` 90,000 ms | solved → 130 + round(20 × ms ÷ limit) | n/a | round(110 × lit ÷ white cells) − 5 × clashing bulbs, floor 0 | white cells | −5 per clashing bulb | `lightUp.ts scoreLightUp` |
| Mini Sudoku | `SUDOKU_TIME_MS` 90,000 ms | solved → Shape A | n/a | round(110 × correct ÷ non-givens) (`SUDOKU_PARTIAL_POINTS` = 110) | 36 cells, 14–16 givens | none | `scoring.ts scoreSudoku` |
| Nonogram | `NONO_TIME_MS` 120,000 ms | solved → Shape A | n/a | round(110 × correct ÷ total) − 5 × wrong, clamp 0–110 | grid cells | −5 per wrong cell | `scoring.ts scoreNonogram` |
| Pipes | `PIPES_TIME_MS` 120,000 ms | solved → Shape A | n/a | stepped: 48 connected → 90; 47–45 → 85; then −5 per 2 tiles, reaching 40 at 27; below 27 → 1.5 per tile | 49 cells (7 × 7) | none, but a steep cliff below the steps | `scoring.ts scorePipes` |
| Push | `PUSH_TIME_MS` 120,000 ms | solved → Shape B | MOVES(25, pushes, min) | round(110 × crates home ÷ crates) (`PUSH_PARTIAL_POINTS` = 110) | 4–5 crates | none | `scoring.ts scorePush` |
| Safe Cracker | `SAFE_TIME_MS` 75,000 ms | opened on try 1 / 2 / 3 → 130 / 115 / 100 + SPEED(20) | fewer tries scores more | not opened: 15 per dial right on the last try, max 60 | 4 dials, 3 tries | none | `scoring.ts scoreSafe` |
| Shikaku | `SHIKAKU_TIME_MS` 90,000 ms | solved → 130 + round(20 × ms ÷ limit) | n/a | round(110 × covered ÷ 100) | 100 cells (10 × 10) | none | `shikaku.ts scoreShikaku` |
| Sort the Tubes | `TUBES_TIME_MS` 90,000 ms | solved → Shape B | MOVES(25, moves, min) | 22 per single-colour tube (`TUBES_TUBE_POINTS`), cap `UNFINISHED_CAP` = 110 | 10 tubes | none | `scoring.ts scoreTubes` |
| Tents and Trees | `TENTS_TIME_MS` 90,000 ms | perfect (all correct, none wrong) → 130 + round(20 × ms ÷ limit) | n/a | 10 per correct tent, cap 110; wrong tents cost nothing | 1 tent per tree | none | `tents.ts scoreTents` |
| Tower | `TOWER_TIME_MS` 90,000 ms | solved → Shape B | MOVES(25, moves, min) | round(110 × discs home from the bottom ÷ discs) (`TOWER_PARTIAL_POINTS` = 110) | 9 discs | none | `scoring.ts scoreTower` |

**Logic oddities (as reported)**
- Tents: free mistakes, stated in the instructions ("wrong tents cost nothing"); `wrong` is accepted but never subtracted.
- Tents: the code comment above `scoreTents` says round(30 × …), but the code and the player-facing text both use 20. Only the internal comment is stale.
- Safe Cracker: same pattern as Laser — 130 / 115 / 100 for try 1 / 2 / 3 (`SAFE_TRY_POINTS`).
- Colour Flood: the only game on the 40 / 10 move/speed split (Shape C).
- Pipes: the stepped formula creates a discontinuity at the 27-tile boundary rather than one smooth curve.
- Lights Out: one light left still scores 85 — a near miss is worth more than half a perfect score.
- No logic game scores above 0 for doing nothing.
- Unfinished caps vary — 45 (Lights Out tap branch), 60 (Safe), 75 (Bomb), 90 (Pipes steps), 110 (Push, Tower, Nonogram, Shikaku, Light Up, Tents, Tubes) — but all sit below the 130 finish floor by design.

---

## 10. Arcade — 22 active

`category: "arcade"` files minus `RETIRED_TYPES`: 31 files, 9 retired (Bastion, Swerve, Dual, Ricochet, Steady, Sort Rush, Parry, Hot Floor, Rooftop Run), 22 active. All scoring lives in `src/lib/arcade/*.ts`. The server replays the input log and uses the sim's own score; the phone's score is only compared to flag mismatches.

| Game (key) | Run | Sim counters | Score formula | Finish bonus | Cap | File + function |
|---|---|---|---|---|---|---|
| Ball Track (balltrack) | 3600 ticks (60 s); `timeLimitMs` = 63,000 | `home` | round(130 × home ÷ 30) | `finishScore` when home ≥ 30 | 130 partial / 150 full | `ballTrack.ts btScoreOf` |
| Beat (beat) | 60 s | perfect, good, ok, misses | floor((4 × perfect + 3 × good + 1 × ok − 8 × misses) ÷ 4) | none | 150 | `beat.ts score` |
| Bin Toss (bintoss) | 60 s, 10 throws | baskets, tick | 10 × baskets | `finishScore` at 10/10 | 130 partial / 150 full | `binToss.ts score` |
| Breaker (breaker) | 90 s | destroyed (of 80) | round(130 × destroyed ÷ 80) | `finishScore` at 80/80 | 130 partial / 150 full | `breaker.ts score` |
| Bubble Pop (bubble) | 90 s | cleared vs `startCount` | round(130 × (start − remaining) ÷ start) | `finishScore` on cleared | 130 partial / 150 full | `bubble.ts score` |
| Bullseye (bullseye) | 45 s, 10 arrows | ring total (0–100) | floor(1.7 × points − 20) | n/a | 0–150 | `bullseye.ts bullseyeScoreFor` |
| Burst (burst) | 90 s | hits, lives lost, waves cleared | 2 × hits − 9 × lives lost; 150 if ended with 0 lives lost and ≥ 4 waves cleared | flat 150 shortcut | 0–150 | `burst.ts burstScoreOf` |
| Cross (cross) | 60 s | lanes (`crossTotalLanes`), crossings | 2 × lanes + 4 × crossings | none | 150 | `cross.ts score` |
| Eat and Grow (snake) | 60 s | pellets eaten | 5 × eaten | none | 150 | `snake.ts score` |
| Flip (flip) | 60 s | ticks survived | trunc(150 × t² ÷ RUN²) | n/a (the curve is the ramp) | 0–150 | `flip.ts flipScoreOf` |
| Hover (hover) | 60 s | gates / total gates | round(150 × gates ÷ total gates) | none | 0–150 | `hover.ts score` |
| Ink Bridge (inkbridge) | 120 s | levels (of 10), tick | 11 × levels | `finishScore` at 10/10 | 130 partial / 150 full | `inkBridge.ts inkScoreOf` |
| Junction (junction) | 60 s | cleared, gave up, ambulances through, ambulances stopped, survived | 2 × cleared − gave up + 4 × (amb through − amb stopped) + 40 × survived | +40 survival (not `finishScore`) | 0–150 | `junction.ts juncScoreOf` |
| Matchup (matchup) | 60 s | raw match points (par 2500) | floor(150 × raw ÷ 2500) | none | 0–150 | `matchup.ts score` |
| Orbit (orbit) | 90 s | best planet reached | 3 × best | `finishScore` on reaching the sun | 130 partial / 150 full | `orbit.ts score` |
| Rally (rally) | 60 s | gold hits | floor(2.5 × gold hits) | none | 0–150 | `rally.ts score` |
| Skyline (skyline) | 60 s | placed, perfects | floor(2.5 × placed + 3 × perfects) | none | 0–150 | `skyline.ts score` |
| Slice (slice) | 60 s | weighted slices (combo-weighted), bombs hit | floor(235 × min(weighted, 3 × total) ÷ (3 × total)) − 10 × bombs hit | n/a (in the ratio) | 0–150 | `slice.ts score` |
| Snip (snip) | 63 s wall / 3600-tick (60 s) sim, 10 levels | eaten, stars, finish tick | 10 × eaten + 3 × stars + bonus | round(20 × (RUN − finishTick) ÷ RUN) when eaten ≥ 10 and finishTick > 0 | 150 | `snip.ts snipScore` |
| Swing (swing) | 60 s | metres (cap 500) | round(130 × m ÷ 500) | `finishScore` at m ≥ 500 | 130 partial / 150 full | `swing.ts score` |
| Tilt (tilt) | 90 s, 4 mazes | mazes solved | 30 × mazes | `finishScore` at 4/4 | 130 partial / 150 full | `tilt.ts score` |
| Wavefront (wavefront) | 60 s | shapes down, armour hits, saucers, waves cleared (par `WAV_PAR`) | floor(150 × (shapes down + armour hits + 5 × saucers + 15 × waves cleared) ÷ `WAV_PAR`) | none (par-scaled) | 0–150 | `wavefront.ts wavScoreOf` |

**Arcade oddities (as reported)**
- **Score above 0 for doing nothing:** none. Bullseye floors to 0 through its −20 offset; Burst's 150 shortcut needs an ended run, 0 lives lost and 4 waves cleared.
- **Rounding:** floor is used by Beat, Bullseye, Matchup, Rally, Skyline, Slice and Wavefront; trunc by Flip; round by Ball Track, Breaker, Bubble Pop and Swing; Orbit, Tilt and Ink Bridge use flat multiples. No documented reason for the mix.
- **130 / 150 split:** 8 games (Ball Track, Bin Toss, Breaker, Bubble Pop, Ink Bridge, Orbit, Swing, Tilt) cap partial runs at 130 and use `finishScore` for a full clear. The other 14 scale straight to 150. Nothing in the game shows which pattern applies.
- **Free mistakes:** Ball Track (wrong trays ignored; the intro says so); Rally (the blue ball scores nothing, and losing it only ends the run); Cross (no clean-crossing bonus; hits before the final one cost nothing); Bin Toss, Breaker, Bubble Pop, Swing, Tilt, Ink Bridge and Orbit count only successes.
- **Inversions flagged by the audit:** Wavefront adds `armourHits` to the score; Junction weights ambulances 4× against 1 for a car giving up (the intro numbers match the code).
- **Intro SCORE text mismatches:** Ball Track and Snip intros say "time left ÷ 75 s", but both sims run 60 s (3600 ticks) and the bonus uses the 60 s run. All other arcade intro SCORE strings match.
- Hover and Matchup are pure ratios to a par value, with no finish or speed component.

---

## 11. Versioned rules

Older stored rounds keep their original grading. Only Chain, Colour Clash and Equation Balancing branch by version; a search of `src/lib/duel/*.ts` and `src/lib/arcade/*.ts` for legacy / version / revision / rev found nothing else.

**Don't Break the Chain** (`chain.ts`). Version field `puzzle.rulesVersion` against `CHAIN_RULES_VERSION`; `chainRules()` also checks `puzzle.boards.length × CHAIN_BLOCK` and `puzzle.cycles` (absent = legacy single `cycle`).
- Legacy (unversioned or a different version): length from the stored board count. 25 links → 6 per link; 30 links → 5 per link; bonus 0; momentum bands {10: 3000 ms, 18: 2500 ms, length: 2000 ms}; FASTER at [10, 18, 26].
- Current: `CHAIN_LENGTH`, `CHAIN_LINK_POINTS`, `CHAIN_FINISH_BONUS`, `CHAIN_MOMENTUM_MS`, `CHAIN_FASTER_AT`.
- Board index, rule lookup (`chainCycleAt`, `chainRuleStep`, `chainBoardIndex`), momentum window (`chainWindowMs`) and score (`chainScore` via `scoreChain`) all read through `chainRules(puzzle)`, so a stored round always replays under its own version.
- `chainDemoCompatible()` requires the current version and board count; old rounds are flagged incompatible for demos rather than migrated.

**Colour Clash** (stored `type: "stroop"`, `colourClash.ts`). Fields `queue` and `clashRev`, picked by `clashVariantOf()`:
- `clashRev === 3` → V3 (current): 75 s run (`CLASH_REV3_RUN_TICKS`), five 15 s phases, fall ticks `CLASH_REV3_FALL_TICKS = [107, 95, 83, 71, 59]`; `initRev3()` builds 5 gate phases.
- else `queue === 52` → V2: 52-word queue, 60 s run, fall ticks `CLASH_QUEUE_FALL_TICKS = [95, 77, 65, 41]`.
- else `queue === 18` → V1: 18-word queue, 60 s, four-phase fall curve.
- else → V0 legacy open-ended stream: `CLASH_RUN_TICKS` (60 s), fall speed `round(BASE_FALL_TICKS × 0.88^phase)` over four 15 s phases.
- `clashFallTicks()` and `clashRunTicksOf()` branch on rev/queue. Replay state carries `rev` only for the current revision, so older stored states stay byte-identical.
- Score formula is the same for every version once run geometry is fixed: round(130 × correct ÷ total) − 2 × wrong + round(20 × ticks left ÷ run ticks), the bonus only on a flawless, finished queue.

**Equation Balancing** (`stagedRounds.ts`). No version field; inferred from the stored array length.
- Legacy (3 stages): weights [30, 40, 50]; bonus base 30.
- Current (4 stages, `EQUATION_STAGE_COUNT`): weights `EQUATION_STAGE_POINTS`; bonus base `EQUATION_SPEED_POINTS`.
- Fully solved needs every stage correct; bonus = round(bonus base × ms ÷ `EQUATION_TIME_MS`).

**Compatibility constants (not scoring versions):** Spatial Memory's `groupSize` (always 2) is kept for old stored puzzles; Wordsmith's `WORDSMITH_CENTRE_INDEX = 4` keeps old stored rings aligned.

## 12. Retired games (practice only, `RETIRED_TYPES`)

| Game (type) | Cat | Time limit | Complete | Bonus | Unfinished / wrong | Items / penalties | File + function |
|---|---|---|---|---|---|---|---|
| Groups (`groups`) | word | 90,000 ms | 4/4: 100 + speedBonus(ms, 90000) | speed, on all 4 | 3 → 60, 2 → 40, 1 → 20, 0 → 0 | 4 groups | `scoring.ts scoreGroups` |
| Word Match (`wordmatch`) | word | 45,000 ms | all 8: 100 + speedBonus(ms, 45000) | speed, on all 8 | min(90, 13 × correct) | 8 pairs | `scoring.ts scoreWordMatch` |
| Word Ladder (`ladder`) | word | 60,000 ms | 100 + speedBonus(ms, 60000) + 20 for a minimum-length path | +20 at minimum | 1 letter away → 75, 2 → 50, 3 → 25, else 0 | — | `scoring.ts scoreWordLadder` |
| Chain Calculation (`chaincalc`) | number | 45,000 ms (inline) | correct → 100 + speedBonus | speed | wrong / timeout → 0 | — | `grade.ts` default → `scoreRound` |
| Number Sequence (`numseq`) | number | 45,000 ms | all 5: 20 × 5 + speedBonus(ms, 45000) | speed, on all 5 | 20 × correct | 5 items | `scoring.ts scoreNumberSequence` |
| Percent Sprint (`pctsprint`) | number | 45,000 ms | all 5: 100 + speedBonus(ms, 45000) | speed, on all 5 | round(100 × correct ÷ 5) | 5 items | `scoring.ts scorePercentSprint` |
| Sum Hunt (`sumhunt`) | number | `SH_TIME_MS` | all stages cleared: `sumHuntRoundScore(stage, ms)` | speed-based, per stage reached | lower stage → lower tier | paths replayed; wrong sums don't count | `sumHunt.ts sumHuntRoundScore`, `replaySumHunt` |
| Sequence Recall (`sequence`) | memory | 30,000 ms (inline) | 100 + speedBonus(ms, 30000) | speed | wrong / timeout → 0 | — | default → `scoreRound` |
| Reverse Recall (`reverse`) | memory | 30,000 ms (inline) | 100 + speedBonus | speed | wrong / timeout → 0 | — | default → `scoreRound` |
| Spatial Memory (`spatial`) | memory | 20,000 ms (inline) | 100 + speedBonus | speed | wrong / timeout → 0 | 8 tiles in 4 groups of 2 | default → `scoreRound` |
| Number Climb (`numclimb`) | memory | `NUMBER_CLIMB_TIME_MS` | 12/12: 100 + speedBonus(ms, 20000) | speed, on the full 12 | round(100 × correct ÷ 12), cap 90 | 12-digit span | `scoring.ts scoreNumberClimb` |
| Go/No-Go (`gonogo`) | speed | 30,000 ms (inline); stored ms = 0 | all 12 hits: 100 + reactionBonus(avg hit ms) | reaction bonus only if flawless | min(90, round(100 × correct ÷ 12)) | 12 items | `scoring.ts scoreGoNoGo` |
| Pattern Completion (`patcomp`) | pattern | 30,000 ms | 3/3: round(100 × 3 ÷ 3) + speedBonus(ms, 30000) | speed, on all 3 | round(100 × correct ÷ 3) | 3 boards | `scoring.ts scorePatternCompletion` |
| Spin (`spin`) | pattern | 45,000 ms | all 8: 100 + speedBonus(ms, 45000) | speed, on all 8 | round(100 × correct ÷ 8) | 8 items | `scoring.ts scoreSpin` |
| Mirror Match (`mirmatch`) | pattern | 60,000 ms | all 5: 100 + speedBonus(ms, 60000) | speed, on all 5 | round(100 × correct ÷ 5) | 5 items | `scoring.ts scoreMirrorMatch` |
| One-Stroke (`stroke`) | logic | 30,000 ms | 100 + speedBonus(ms, 30000) + 20 if first try | `STROKE_FIRST_TRY_BONUS` = 20 | round(60 × best ÷ total), cap 60 | — | `scoring.ts scoreStroke` |
| Dig (`dig`) | logic | 60,000 ms | cleared: min(150, 100 + round(50 × ms left ÷ (`DIG_STEPS` × `DIG_STEP_MS`)) + `DIG_MIN_BONUS` if dug ≤ min digs) | `DIG_MIN_BONUS` | min(90, round(100 × clean collected ÷ targets)) | errors tracked = lost + settled units | `dig.ts scoreDig` |
| Rooftop Run (`rooftop`) | arcade | 60 s run; stored 63,000 ms | survive the full run: 150 | — | clampInt(trunc(150 × t² ÷ run²), 0, 150) | ticks survived | `rooftop.ts roofScoreOf` |
| Dual (`dual`) | arcade | 60 s run; stored 63,000 ms | survive: 150 | — | clampInt(trunc(150 × t² ÷ run²), 0, 150) | gates passed, jumps; scroll cap `DUAL_SCROLL_CAP_FP` = 1126 | `dual.ts dualScoreForTicks` |
| Swerve (`swerve`) | arcade | 60 s run; stored 63,000 ms | coin count, not finish-based | — | clampInt(2 × coins, 0, 150) | coins, survived | `swerve.ts` |
| Ricochet (`ricochet`) | arcade | 60 s run | height-based | — | clampInt(trunc(2 × height px ÷ `RICO_PX_PER_METRE`), 0, 150) | height, leaps; survived / spiked | `ricochet.ts` |
| Steady (`steady`) | arcade | 60 s run | clean run: 150 | — | clampInt(150 − 5 × touches, 0, 150) | touches | `steady.ts` |
| Sort Rush (`sortrush`) | arcade | 60 s run | all sorted, none wrong: full share | — | clampInt(share − 2 × wrong, 0, 150), share ∝ sorted ÷ total | sorted, wrong, total | `sortRush.ts sortScoreOf` |
| Parry (`parry`) | arcade | 60 s run | deflection-based | — | clampInt(2 × deflected − 10 × hits, 0, 150) | deflected, hits | `parry.ts parryScoreOf` |
| Hot Floor (`hotfloor`) | arcade | 120 s run; stored 123,000 ms | stage-based | — | clampInt(15 × stage, 0, 150) | stage reached | `hotFloor.ts score` |
| Bastion (`bastion`) | arcade | 60 s run | finished: destroyed + bonus | bonus when the run finished | clampInt(destroyed + bonus, 0, 150) | destroyed, health | `bastion.ts basScoreOf` |

---

## 13. Room rotation (as coded)

| Aspect | As coded | Location |
|---|---|---|
| Category draw | `pickRoundOrder()`: when host categories are given, rounds are filled category by category (round-robin on the lowest count; core categories get the first 5 draws when all 5 are selected), each draw weighted by recency against the host's last 3 rooms (`RECENT_WEIGHTS = [0.25, 0.5, 0.75]`) | `selection.ts` |
| Default categories | `STANDARD_CATEGORIES = [logic, pattern, speed, attention, word, arcade]`; number is opt-in only; memory is never drawn | `categories.ts` |
| Repeat avoidance | a type played in the host's previous room is excluded if its category still has at least 3 (`EXCLUDE_MIN_ALTERNATIVES`) other types | `selection.ts pickType()` |
| Round 6 / extra-round weighting | `CORE_SIXTH_WEIGHTS = {logic: 0.35, pattern: 0.35, speed: 0.15, attention: 0.1, word: 0.05, number: 0, memory: 0, arcade: 0}`, used only in the no-explicit-categories branch when the category pool runs out before all rounds are filled | `registry.ts`, `selection.ts` |
| Arcade-round rule | on by default (`addArcade !== false`); exactly one slot; never round 1 (inserted at `1 + randomBelow(order.length)`) | `selection.ts` |
| Host toggles `no_maths` / `add_maths` / `add_arcade` | declared as DB columns and as `addMaths` / `addArcade` options in `selection.ts`, but `startRoomFn` never reads them. Only `selected_categories` (the host's category multiselect, which includes "number" and "arcade" directly) is passed. The `addMaths` / `addArcade` path is effectively dead for real rooms | `duel.functions.ts` (~lines 420–440), `selection.ts`, `types.ts` |
| `round_count` | set to `TOTAL_ROUNDS` at room creation and never overridden; read with a `TOTAL_ROUNDS` fallback | `duel.functions.ts` |
| Memory | `normaliseCategories()` strips "memory" even from older stored settings; `typesInCategory("memory")` returns [] | `categories.ts`, `registry.ts` |
| Pre-flight guard | `startRoomFn` refuses to start if the selected categories' active pool is smaller than `round_count` | `duel.functions.ts` |

## 14. Trusted client inputs (not replayed or recomputed, beyond time left)

| Game / field | What's trusted | Verification | Location |
|---|---|---|---|
| All rounds — `msRemaining` | the client's claimed time left | clamped to [0, limit] and checked against the server's clock + 1.5 s; over that, the server's value is used | `grade.ts trustedMsRemaining`, `submitAnswerFn` |
| Reaction Time — per-flash times | each value clamped to [1, `REACTION_MISS_MS`], then averaged server-side | the values themselves are unverified (no server-side reaction capture); averaging and false-start maths are server-side | `grade.ts` case "reaction" |
| Go/No-Go (retired) — `extra.correctCount` | as sent, clamped to [0, `GONOGO_ITEMS`] | no replay | `grade.ts` ~line 325 |
| Go/No-Go (retired) — `extra.reactionAvgMs` | as sent, clamped to [0, 5000] | no recomputation | `grade.ts` ~lines 326–329 |
| Every other type (standard, logic, arcade) | answer strings decoded and matched against stored content, or fully replayed (`replay*`, `verify*`, `decode*`) | full replay / verification | `grade.ts` other cases |

## 15. Dead code

| Item | File | Finding |
|---|---|---|
| All scoring functions in `scoring.ts` (`scoreGroups`, `scoreWordLadder`, `scoreNumberClimb`, `scoreTargetNumber`, `scoreStopWatch`, `scoreNumberHunt`, `scoreStroke`, `scoreStroop`, `scoreGoNoGo`, `scoreMirrorMatch`, `scoreSpin`, `scorePatternCompletion`, `scorePercentSprint`, `scoreNumberSequence`, `scoreEquation`, `scoreCountUp`, `scoreReaction`, `scoreWordMatch`, `scoreSymbolScan`, `scoreChain`, `wordSpeedBonus`, `solvedMovesText`, `MOVES_SHAPE`, the standard shapes) | `scoring.ts` | reported as none dead — all imported and called from `grade.ts` (but see section 16 on `scoreStroop`) |
| `UNFINISHED_CAP` | `scoring.ts` | exported but only used inside `scoreTubes()`; the export is unused outside the module |
| `totalAnswerMs` | `scoring.ts` | exported but only used internally by `duelOutcome()`; the export is redundant |
| `no_maths` / `add_maths` / `add_arcade` columns | `types.ts`, `selection.ts` | never read when starting a room — dead plumbing (section 13) |
| `SubmitExtra.errors` | input type | accepted from the client but never read; errors are computed server-side per type |

---

## 16. Review notes — needs Joe's ruling

These are where the audit contradicts itself, contradicts earlier decisions, or looks wrong. The tables above follow the audit; nothing here has been changed in the app.

1. **Rotation no longer matches the app brief.** Real rooms use the host's category multiselect: one round per selected category, round-robin. The "round 6 weighted draw (logic 35 / pattern 35 …)" only runs in a branch real rooms never reach, and the "never round 1" arcade rule sits in the same unused path. The add_maths / add_arcade toggles are dead. Decide what round 6 should be (with six default categories it's simply one round each, arcade included) and whether arcade may land in round 1; then clean up the dead path.
2. **Trusted inputs: Stop Watch and Number Hunt are missing.** Earlier audits had both trusting the phone; this one lists only Reaction Time and says everything else is replayed. Confirm whether they now replay a tap log or were missed. Either way, Reaction Time still trusts per-flash times, which needs a replay before ranked or money play.
3. **Intro text bug:** Ball Track and Snip say "÷ 75 s"; both run 60 s. Fix the template data for those two.
4. **Wavefront "inversion" is probably a false alarm.** `armourHits` most likely counts your hits on armoured ships (each takes 6–12 hits), not damage to you. Confirm with Lovable before treating it as a bug.
5. **`scoreStroop` contradiction.** Section 15 says no scoring function is dead; the attention notes say `scoreStroop` is never called for Colour Clash. It's likely only reachable for old stored rounds or not at all — confirm and remove if unused.
6. **Equation Balancing is missing from the audit's number table.** The row in section 5 is built from the versioned-rules section; the 7 Oct handover gives stage points 25 / 30 / 35 / 40 + 20 speed. Ask Lovable for `EQUATION_STAGE_POINTS` and `EQUATION_SPEED_POINTS` to confirm.
7. **Values that changed against earlier notes** (the code stands unless you rule otherwise): Word Hunt is 2 × word points (was 3); Count Up stage weights are 30 / 45 / 55 (were 30 / 35 / 35); Laser unsolved is 15 per gem; Tile Grid unfinished is 8 per tile in a valid word.
8. **Time limits the audit didn't state as numbers:** Target Number ("type default", earlier 75 s) and Word Slide (`WS_TIME_MS`, the 6 Oct note says 100 s). Confirm.
9. **Pipes row:** the audit's table read "down to 40 → 40", which looks like a typo. Section 9 states the stepped formula as reaching 40 at 27 connected, matching the earlier specification (85 − 5 × floor((46 − n) ÷ 2) for 27–46). Its oddity note about 1.5 × 27 is also inconsistent with that — confirm the exact boundary.
10. **The "only Hover and Matchup have no finish bonus" note is inaccurate:** Beat, Cross, Eat and Grow, Junction, Rally, Skyline and Wavefront also have none (Junction has a survival bonus instead). Not a code issue.
11. **Arcade 130 / 150 split:** 8 games cap partial runs at 130 with a full-clear jump to 150; 14 scale straight to 150. Decide whether that's intended and whether players should be told which is which.
12. **Free mistakes still in place:** Word Search, Tents, Trail, Pair Match, Intruder (extra taps), Ball Track. Keep by design or add penalties.
13. **Tries inversions:** Laser and Safe Cracker give 130 / 115 / 100 for 1 / 2 / 3 tries. That's an intended efficiency reward rather than a bug; recorded so it's a conscious choice.
14. **Stale code comment** above `scoreTents` (says 30 ×; code and text say 20 ×) — clean up in the GitHub tidy.
