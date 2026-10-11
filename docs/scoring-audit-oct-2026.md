# Duelz — Scoring rulings and audit (11 Oct 2026)

Follow-up to section 16 of `docs/duelz-scoring-reference.md` ("Review notes — needs Joe's ruling"). Joe's rulings are recorded below with what was found in the code and what changed. Unless an item says "changed", nothing in the scoring formulas, rules or sims was touched. Games are named by display name with the internal `PuzzleType` id in brackets.

What changed in this session:

- **Intro SCORE text only** (`src/lib/duel/introScore.ts`): the eight arcade 130 / 150 split games now state both parts in one line (Ruling B). The Scrumper (snip) line was also corrected (Fix 3).
- **"?" help text** (`src/lib/duel/instructions.ts`): Ball Tracker (balltrack) and Scrumper (snip) now describe the speed bonus with the speed-par wording instead of a linear `÷ 60 s` formula (Fix 3).
- **Dead code removed**: `scoreStroop` (`src/lib/duel/scoring.ts`) and its unused import in `grade.ts` (Fix 5).
- **Comment fix**: the comment above `scoreTents` (`src/lib/duel/tents.ts`) (Fix 14).
- **Check**: `scripts/six-game-scoring-check.ts` now pins the new intro wording.
- **CLAUDE.md**: a "Known gap" note on Flash (reaction) timing (Ruling D).

---

## Rulings: keep as coded (no code change)

### Ruling A: keep current values

Confirmed in code, unchanged:

| Game | Rule | Code |
|---|---|---|
| Forage (wordhunt) | 2 × word points, cap 150 | `scoring.ts scoreWordHunt` |
| Tally (countup) | stage weights 30 / 45 / 55; all three exact adds up to 20 for speed | `stagedRounds.ts` (`scoreCountUpStages`) |
| Lightbender (laser) | unsolved: 15 per gem lit (`LASER_GEM_POINTS`); never fired = 0 | `scoring.ts scoreLaser` |
| Interlock (tilegrid) | unfinished: 8 per tile inside a valid word | `tileGrid.ts scoreTileGrid` |

### Ruling C: keep the tries rewards

Lightbender (laser) `LASER_FIRE_BASE` and Safe Cracker (safe) `SAFE_TRY_POINTS` stay at 130 / 115 / 100 for try 1 / 2 / 3, plus up to 20 for speed (`scoring.ts scoreLaser`, `scoreSafe`). Intro and help text already state this.

### Ruling 12 (10 Oct): free mistakes stay unpenalised

No change in Lookout (wordsearch), Tents and Trees (tents), Trail (trail), Matchmaker (pairmatch), Interloper (intruder) or Ball Tracker (balltrack). The intro text already says so where it matters ("Wrong tiles cost nothing", "Wrong trays cost nothing").

---

## Ruling B: arcade 130 / 150 split stays; players are told

**Which games split (from the code).** A game is on the split when partial runs are clamped to 130 and a full clear returns `finishScore(runTicks, finishTick)` = 130 + speed bonus (up to 20), capped at 150 (`src/lib/arcade/engine.ts`). Searching every `finishScore` call gives exactly eight active arcade games, matching the list in the prompt:

| Game | Full-clear condition | Partial formula (clamped 0–130) | Code |
|---|---|---|---|
| Ball Tracker (balltrack) | all 30 marbles home | round(130 × home ÷ 30) | `ballTrack.ts btScoreOf` |
| Swish (bintoss) | 10 / 10 buckets | 10 × buckets | `binToss.ts score` |
| Breaker (breaker) | all 80 bricks | round(130 × destroyed ÷ 80) | `breaker.ts score` |
| Coral Pop (bubble) | field cleared | round(130 × cleared ÷ start) | `bubble.ts score` |
| Rainbow Bridge (inkbridge) | all 10 levels | 11 × levels | `inkBridge.ts inkScoreOf` |
| Orbit (orbit) | reach the sun | 3 × best planet | `orbit.ts score`, `orbitRev3.ts score` |
| Grappler (swing) | 500 m | round(130 × metres ÷ 500) | `swing.ts score` |
| Tilt (tilt) | all 4 mazes | 30 × mazes | `tilt.ts score` |

**Scrumper (snip) is not on the split**, so its intro does not get the split line. It scores 10 per apple + 3 per leaf, and only collecting all ten apples adds up to 20 for speed (`snip.ts snipScore`, cap 150). There is no 130 cap and no flat 130 for a full clear: all ten apples with no leaves is 100 + speed bonus. Its intro wrongly said "Collect all ten apples for 130"; that is fixed under Fix 3.

**New intro lines** (built by a new `arcadeSplit` template, with counts taken from the sim constants):

> Points for each brick destroyed. Clear all 80 bricks for up to 150; otherwise up to 128. Finishing earns 130, plus up to 20 for speed: the full 20 if you finish with at least half the time left.

The goals are "Get all 30 marbles home", "Sink all 10 buckets", "Clear all 80 bricks", "Clear the whole field", "Finish all 10 levels", "Reach the sun", "Reach 500 metres" and "Finish all 4 mazes", each followed by "for up to 150; otherwise up to N." Ball Tracker keeps "Wrong trays cost nothing." Rainbow Bridge keeps its level-type line.

**Partial maximum (Joe, 11 Oct):** each intro shows the real partial maximum, the score one unit short of a full clear:

| Game | Partial maximum shown | Why |
|---|---|---|
| Ball Tracker (balltrack) | 126 | round(130 × 29 ÷ 30) |
| Swish (bintoss) | 90 | 9 buckets × 10 |
| Breaker (breaker) | 128 | round(130 × 79 ÷ 80) |
| Coral Pop (bubble) | 128 | round(130 × 66 ÷ 67); the field always starts with 67 bubbles (one sim version, every seed) |
| Rainbow Bridge (inkbridge) | 99 | 9 levels × 11 |
| Orbit (orbit) | 117 | planet 39 of 40 × 3 |
| Grappler (swing) | 130 | metres are whole numbers; round(130 × 499 ÷ 500) = 130 |
| Tilt (tilt) | 90 | 3 mazes × 30 |

**Checks updated:** `scripts/six-game-scoring-check.ts` now asserts that each of the eight intros contains " for up to 150; otherwise up to N." with its own partial maximum, plus the goal wording for six of them. It proves every figure against the sims one unit short of a clear: `btScoreOf(29)`, Breaker with 79 of 80 bricks, Coral Pop with one bubble left (and a fixed 67-bubble field across 200 seeds), Grappler at 499 m, Swish and Tilt one unit short, `inkScoreOf(9)`, and Orbit at planet 39 for both `orbitGame` and `orbitRev3Game`. It also asserts that Scrumper and Mixed Signals (stroop) don't carry the split line, and that the Scrumper intro no longer says "for 130". This check is the existing INTRO_SCORE wording check; `bullseye-cross-flip-tuning-check.ts`, the only other check that reads `INTRO_SCORE`, needed no change.

Mixed Signals (stroop, attention) and Tenfall (tendrop, number) also use 130 + up to 20 for speed, but they are not arcade-category games and their partial formulas aren't capped at 130 by a separate rule, so their text is unchanged.

---

## Ruling D: Flash (reaction) trusts per-flash times (report only)

Nothing changed in grading. What the server trusts today (`src/lib/duel/grade.ts` case "reaction"):

- **Answer format:** `t1,t2,…|falseStarts`, sent by the phone.
- **Per-flash reaction times:** the phone measures each one. The server reads one value per stored flash (`puzzle.flashes`, 5–8 flash start times on the shared 60 s timeline) and clamps each to [1, `REACTION_MISS_MS` = 1,200 ms]. A missing or non-numeric value counts as 1,200 ms. Nothing checks a value against the flash schedule or the server clock, so any value from 1 ms up is accepted as sent.
- **False-start count:** the phone reports it; the server clamps it to [0, 99] and takes 8 per false start off the score. A phone that under-reports false starts loses nothing.
- **Server-side:** the average (rounded), `scoreReaction(avg, falseStarts)` = 150 at ≤ 200 ms average, else round(150 − 0.16 × (avg − 200)), minus 8 per false start, clamped 0–150. `isCorrect` is always true and the stored time left is 0, so `msRemaining` plays no part.
- **Tie-break:** the trusted average is stored as `reaction_avg_ms`, which `totalAnswerMs()` uses to break ties on equal totals.
- `REACTION_FALSE_START_MS` (200, documented as "added to the average for every false start") is declared in `types.ts` but never used by the grader. The server's false-start penalty is −8 points.

A short note was added to `CLAUDE.md`: Flash needs server-verifiable timing before ranked play (Phase 3, before ratings).

---

## Fixes

### Fix 3: Ball Tracker and Scrumper "÷ 75 s" text

**Finding:** the "÷ 75 s" text was already gone. Neither the intro SCORE lines (`introScore.ts`) nor the "?" help (`instructions.ts`) said 75 s for either game. The only "75 s" in git history was in the Mixed Signals help, which was later rewritten. The help text then read `round(20 × time left ÷ 60 s)`, the old linear curve. That was wrong for every round stamped `speedPar: 1`: the sims call `speedBonusCurve`, which gives the full 20 with at least half the 60 s run left.

**Changed (text only):**
- Ball Tracker help: "round(130 × marbles home ÷ 30); all 30 home = 130 + up to 20 for speed: the full 20 if you finish with at least half the time left. Cap 150. Wrong trays have no penalty."
- Scrumper help: "10 per apple collected, +3 for each level's single leaf; collect all ten for up to 20 for speed: the full 20 if you finish with at least half the time left. Cap 150."
- Scrumper intro, replacing the incorrect "Collect all ten apples for 130, plus up to 20…": "10 points for each apple you collect, plus 3 for each leaf. Collect all 10 apples for up to 20 more for speed: the full 20 if you finish with at least half the time left. Up to 150." The numbers come from `SNIP_CONFIG`.
- Ball Tracker intro: changed under Ruling B.

The check now also asserts that neither help line contains a "÷ N s" divisor.

### Fix 5: `scoreStroop`

**Callers:** none. `scoreStroop` was imported by `grade.ts` but never called. It wasn't called in any of the 8 versions of `grade.ts` in this repo's history either. Every Mixed Signals (stroop) round, current or stored, is graded by `case "stroop"`, which replays the run with `replayColourClashRun(puzzle.seed, answer, clashVariantOf(puzzle))`. `clashVariantOf` covers every stored variant (V0 open stream, V1 18-word, V2 52-word, V3 `clashRev: 3`). No check, script, migration or other module referenced it; `standard-scoring-check.ts` imports `scoring.ts` as a namespace but never touches `scoreStroop`.

**Removed:** the function from `scoring.ts`, its now-unused `STROOP_ITEMS` import there, and the `scoreStroop` import in `grade.ts`. `STROOP_ITEMS` itself stays in `types.ts`, where `roundSummaries.ts` and `grade.ts` still import it.

### Fix 14: stale comment above `scoreTents`

The comment said "adds round(30 × ms_remaining ÷ limit)". It now reads "10 per correctly placed tent, up to 110; all correct with no wrong tents = 130 + up to 20 for speed (speedBonusCurve). Cap 150.", which matches the code and the player text.

---

## Checks (report only, nothing changed)

### Check 1: rotation rebuild leftovers

**Removed by the rebuild (confirmed):** `src/lib/duel/selection.ts` now has only `categoryOrderFor` / `roundCountFor` / `pickType` / `pickRoundOrder`. None of the following appear anywhere in `src/` or `scripts/`:
- `CORE_SIXTH_WEIGHTS`, the old round-6 weighted draw
- the "never round 1" arcade insert (`1 + randomBelow(order.length)`)
- the `addMaths` / `addArcade` options and the `no_maths` / `add_maths` / `add_arcade` branch

Arcade can now land in any round, as the 10 Oct rotation decision says.

**Leftovers (not deleted, as instructed):**
- `src/lib/duel/types.ts` `DuelRow.no_maths` (commented "kept for older rooms; no longer used in the draw"). Nothing reads it.
- `src/integrations/supabase/types.ts` (generated): `add_arcade`, `add_maths`, `no_maths` in the `duels` Row / Insert / Update types.
- Database columns `duels.no_maths`, `duels.add_maths`, `duels.add_arcade` (migrations `20260917171808…`, `20260919214759…`, `20260920164230…`). The 23 Sep migration reads them once to seed `selected_categories`. Dropping them would be a schema migration, so it's for Joe and Lovable to decide; it doesn't rewrite round data, but it does change stored room rows.
- Docs: `docs/duelz-scoring-reference.md` section 13 (rows "Round 6 / extra-round weighting", "Arcade-round rule", "Host toggles") and section 15 still describe the old path as current. They need a docs refresh.

### Check 2: Bang On (stopwatch) and Ascend (numhunt): replay or trust?

Neither replays a tap log. Both grade from values the phone reports (`grade.ts`).

**Bang On (stopwatch):**
- Answer: up to 10 (`STOPWATCH_ATTEMPTS`) comma-separated distances in ms from the zone.
- **Trusted:** each distance, clamped to [0, `STOPWATCH_MISS_MS` = 500]. A missing or non-numeric value counts as 500.
- The server holds the watch specs (`centre`, `half`, `sweepMs`, `hidden`, `wrap`) but never recomputes a distance from a tap time.
- Score: `scoreStopWatch(avg)` = 150 at ≤ 20 ms, else round(150 − 0.27 × (avg − 20)), clamped 0–150. The average is stored as `reaction_avg_ms` (used in the tie-break) and the stored time left is 0.

**Ascend (numhunt):**
- Answer: `reached,errors,elapsed`.
- **Trusted:** `reached` (clamped [0, 24]) and `errors` (wrong taps, clamped [0, 99]). `elapsed` is ignored.
- `msRemaining` gets the usual all-rounds check (`trustedMsRemaining`: clamped to the limit and to the server clock + 1.5 s).
- The stored `spots` / `layouts` are never used to check taps.
- Score: `scoreNumberHunt`: all 24 = 130 + speed (par) − 5 × errors; otherwise 5 × reached − 5 × errors; clamped 0–150. A phone that under-reports errors keeps its points.

Like Flash, these should get server-verifiable logs before ranked play. This is not ruled on; recorded here and in the CLAUDE.md note.

### Check 4: Wavefront (wavefront) `armourHits`

**Confirmed: it counts the player's hits on armoured ships, not damage taken.** In `src/lib/arcade/wavefront.ts` (bolt loop, ~line 345), `s.armourHits += 1` runs only when one of the player's upward bolts overlaps a cell with `WAV_ARMOUR_CODE` while `s.armour` is alive. It also lowers `s.armour.hp`, and the armour breaks at 0 hp. Nothing that hurts the player touches it.

Armour from wave 2 takes 6 / 8 / 10 / 12 hits (`WAV_ARMOUR_BY_WAVE`). Those hits are counted in `WAV_PAR`, so a perfect run through wave 5 scores 150 (`wavScoreOf`). The "inversion" in the earlier audit was a false alarm.

### Check 6: Operator (equation) constants

`src/lib/duel/types.ts`:
- `EQUATION_STAGE_POINTS = [25, 30, 35, 40]` (sum 130)
- `EQUATION_SPEED_POINTS = 20`
- `EQUATION_STAGE_COUNT = 4`
- `EQUATION_TIME_MS = 90_000`

Legacy 3-stage rounds, inferred from the stored array length, keep [30, 40, 50] + 30 (`stagedRounds.ts`). This matches the 7 Oct handover.

### Check 8: time limits

- **Exact (target):** 75,000 ms (`TARGET_TIME_MS`, set as the definition's `timeLimitMs` in `src/puzzles/targetNumber.tsx`). Generated puzzles carry no per-puzzle override.
- **Slider (wordslide):** 100,000 ms (`WS_TIME_MS` in `src/lib/duel/wordSlide.ts`, used by `src/puzzles/wordSlide.tsx`). Same, no override.

Both were confirmed by running `typeTimeLimitMs` / `puzzleTimeLimitMs` on freshly generated puzzles.

### Check 9: Pipeline (pipes) partial scores

The board is 7 × 7 = 49 cells (`PIPES_CELLS`). For an unfinished board, `scoring.ts scorePipes` gives:
- ≥ 48 connected → 90
- 47 → 85
- 27–46 → 85 − 5 × floor((46 − n) ÷ 2)
- below 27 → round(1.5 × n)

Values computed by calling `scorePipes(false, n, 0)`:

| Connected | Score |
|---|---|
| 46 | 85 |
| 45 | 85 |
| 28 | 40 |
| 27 | 40 |
| 26 | 39 |

So the step formula reaches 40 at 27 (and 28), and 26 falls to the 1.5-per-tile line (39). There is no cliff: 27 → 40, 26 → 39. The "down to 40 → 40" in the earlier audit was a typo. The help text ("48 = 90, 47-45 = 85, then 5 less per two tiles down to 40 at 27; fewer score 1.5 each") matches the code.

---

## Speed par

The 10 Oct speed par is `speedBonusCurve` in `src/lib/duel/speedPar.ts`: the full bonus with at least half the limit left, then an even fall to 0 at the buzzer. Every newly generated puzzle is stamped `speedPar: 1` (`generate.server.ts generatePuzzle`). `gradeAnswer` grades under the par curve when the stored puzzle carries the stamp, and under the old linear curve (max × left ÷ limit) when it doesn't. That covers arcade replays too, because they run inside the same synchronous `withSpeedCurve` call.

A search for time-bonus maths that bypasses `speedBonusCurve` found none. Every speed helper (`speedBonus`, `speedPoints`, `standardComplete`, `scoreSolvedMoves`, `wordSpeedBonus`, `finishScore`) calls it.

### Uses the speed par (stamped rounds)

| Category | Games (internal id) | Speed component |
|---|---|---|
| Word | Interlock (tilegrid), Slider (wordslide), Lookout (wordsearch), Roundabout (letterwheel) | up to 20 (Slider up to 30) on completion |
| Number | Counterweight (balance), Exact (target), Operator (equation), Integer Pyramid (numpyramid), Trail (trail) | up to 20 or 30 on completion |
| Number (engine) | Tenfall (tendrop) | up to 20 on clearing all ten, measured on the 90 s sim run (`TD_RUN_TICKS`) |
| Speed | Ascend (numhunt), Don't Break the Chain (chain) | Ascend up to 20; Chain up to `CHAIN_FINISH_BONUS` |
| Attention | Eagle Eye (symscan), Double Take (spotdiff), Tally (countup), Labyrinth (maze), Interloper (intruder), Matchmaker (pairmatch) | up to 20 on completion / all perfect |
| Attention (engine) | Mixed Signals (stroop) | up to 20 on sorting the whole queue, measured on the sim run (75 s for `clashRev: 3`) |
| Pattern | Gridlock (unblock), Tessellate (blockparty), Skid (iceslide), Lightbender (laser), Topsy-Turvy (gravity), Jumbled (tiles), Turntable (rings) | Shape A up to 20, Shape B up to 25 |
| Logic | Blackout (lightsout), Pipeline (pipes), Box Six (sudoku), Chroma Lines (flow), Heave (push), Hanoi (tower), Polypotions (tubes), Safe Cracker (safe), Bomb Defusal (bomb), Mosaic (nonogram), Colour Flood (flood), Tents and Trees (tents), Shikaku (shikaku), Lamplighter (lightup) | Shape A up to 20, Shape B up to 25, Colour Flood (Shape C) up to 10 |
| Arcade finish bonuses | Ball Tracker (balltrack), Swish (bintoss), Breaker (breaker), Coral Pop (bubble), Rainbow Bridge (inkbridge), Orbit (orbit), Grappler (swing), Tilt (tilt), all via `finishScore`; Scrumper (snip) via `snipScore` | up to 20 on a full clear, measured in sim ticks against the sim run (not the registry limit, which adds 3 s slack) |

Arcade finish bonuses use the par only when the stored puzzle is stamped, since the server replay runs under `withSpeedCurve`. The phone's live HUD score always uses the par; it is display only and only compared to flag mismatches.

### No speed bonus at all (par doesn't apply)

| Category | Games (internal id) |
|---|---|
| Word | Nucleus (wordsmith), Forage (wordhunt) |
| Speed | Flash (reaction), Bang On (stopwatch), Bonk (whack), Pull! (clayshoot) |
| Arcade (no finish bonus) | Hover (hover), High Rise (skyline), Flightpath (bullseye), Gemstone (matchup), Rally (rally), Slice (slice), Tempo (beat), Meteor (snake), Jaywalk (cross), Wavefront (wavefront), Roofbound (flip), Junction (junction: a flat +40 for surviving, not time-based), Fission (burst: a flat 150 shortcut, not time-based) |

### Not on the par: unstamped rounds

Rounds stored before the stamp keep the legacy linear curve when they are re-graded or displayed. No active game uses a time bonus outside `speedBonusCurve`.

Retired practice-only games also route through the same helpers (for example `scoreRound`, `sumHuntRoundScore`, `scoreDig`). The exceptions are Go / No-Go (gonogo), whose `reactionBonus` is a reaction-time bonus rather than a time-left bonus, and the retired arcade games, none of which use `finishScore`.

---

## Check suite

See the pull request description for the full per-check results of `bun scripts/run-checks.ts` on this branch, against the CLAUDE.md baseline (11 Oct 2026: 83 pass, 0 fail, 0 timeout).
