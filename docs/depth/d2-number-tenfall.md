# Depth to 200, D2 Number: Tenfall (`tendrop`, `tenRev 4`)

25 Oct 2026. Tenfall's round maximum is 200 (`ROUND_MAX.tendrop`, `src/lib/duel/roundMax.ts`). Rooms, practice,
the daily and challenges deal `tenRev 4` (`TEN_DROP_DEPTH_REV`, `generateTenDrop` in `src/lib/duel/arcade.server.ts`).
Rounds stored without a stamp or with `tenRev` 1, 2 or 3 replay and score exactly as before.

## Design

- **Same board as tenRev 3.** tenRev 4 uses tenRev 3's targets, tile queues, proofs and rng stream for the same seed,
  and the same physics, spawn rules, taps and unfinished score (at most 110, 5 per reset after the first 4).
  `tenDropInit(seed, 4)` builds tenRev 3's start state and adds three fields: `plan.gold`, `scoreRev` and
  `goldTens: 0`. Older revisions never get those fields, so their whole state (tiles, plan, log) is byte-identical.
- **Gold tiles.** Each target's queue has one gold digit (`plan.gold[stage]`, a queue position mod its length, so it
  comes back every pass of the queue). A spawned tile at that position carries `gold: true` (only on tenRev 4).
  A **gold ten** is a target hit exactly by tapping the gold tile (it makes the total). `goldTens` counts them.
  - Picked by `tdGoldPlan(seed, plan)`: integer only, from a hash of (seed, target), never the rng. Each candidate
    is a digit that can make the ten, proved by `tdMinArrivals` (an integer DP over the repeating queue, with
    overshoot resets). The pick prefers a digit whose gold ten costs the fastest line 1–2 more tiles
    (`TD_GOLD_DETOUR`), then up to 6 (`TD_GOLD_DETOUR_FAR`), then any. A gold ten is a plan, not an accident.
    Results are cached by seed, about 5 ms to build.
  - About 6 % of targets have no gold tile (no digit can make the ten: they finish only on ×2). The gold part fills
    at 5 gold tens, so every board can still reach 200.
  - *Why the finish rule, not "a gold tile in the total":* every ten uses most of a queue's digits. With the looser
    rule, kit players who never looked for gold made 4–5 gold tens out of 10, and a good player's score rose 18 %.
    With the finish rule, gold-blind play makes about 1 gold ten and gold-chasing play makes 3–5.
- **No chain clears.** Tenfall has none and none were added.

## Scoring (tenRev 4)

- **Unfinished:** tenRev 3 exactly: `floor(110 × targets ÷ 9)`, then −5 per reset after the first 4. At most 110.
  Gold pays nothing here.
- **All ten:** `120 + speedBonusCurve(30, left, 90 s)` (tenRev 3's part: the full 30 with half the clock left)
  `+ tdStretchBonus(left) + tdGoldBonus(goldTens)`, capped at `TD_DEPTH_MAX` = 200.
  - `tdStretchBonus`: `floor(25 × d² ÷ 840²)` with `d = clamp(left − 1440, 0, 840)` ticks. It is 0 when the last
    target clears at 66 s or later and reaches the full 25 at 52 s (`TD_STRETCH_MAX` 25, `TD_STRETCH_FROM` 1440,
    `TD_STRETCH_SPAN` 840). It is convex, so the last seconds are worth the most.
  - `tdGoldBonus`: 5 per gold ten (`TD_GOLD_POINTS`), at most 25 (`TD_GOLD_MAX`).
  - Anchors: 120 at the buzzer, 136 at 66 s, 170 at 52 s, 175 by 45 s. Add up to 25 for gold: 200 needs all ten by
    45 s and 5 gold tens.
- **Why the stretch sits before 45 s, not beyond it:** tenRev 3's full-speed point (45 s) is already about the fastest
  a board can be cleared. A scripted player that takes every needed tile on the tick it arrives finishes in 37–52 s
  on room seeds (median 45). So "faster than today's 150 pace" can't be reached by anyone. The stretch rides the
  seconds just before that point instead, where only near-flawless play gets to.
- Grading (`grade.ts`) and the replay result carry `goldTens` on tenRev 4 only. The reveal adds a "Gold tens" tile,
  and the round summary adds "n gold tens".

## Constants (`src/lib/arcade/tenDrop.ts`)

| Constant | Value |
|---|---|
| `TEN_DROP_DEPTH_REV` | 4 |
| `TD_STRETCH_MAX` / `TD_STRETCH_FROM` / `TD_STRETCH_SPAN` | 25 / 1440 ticks left (66 s) / 840 ticks (full at 52 s) |
| `TD_GOLD_POINTS` / `TD_GOLD_MAX` | 5 / 25 |
| `TD_GOLD_DETOUR` / `TD_GOLD_DETOUR_FAR` | [1, 2] / 6 extra tiles |
| `TD_DEPTH_MAX` | 200 |

## Tuning table

`bun scripts/tendrop-depth-bands.ts` runs 30 room seeds (4401 + 13n). Each run is graded by the server's
`gradeAnswer` under tenRev 3 and tenRev 4. Because the play is the same, the same run is graded both ways. Figures are
median / top 10 % / best.

- **"(kit)" rows:** the puzzle-fairness Tenfall kit as it is, with the shared SKILLS. These players are gold-blind
  (today's players).
- **"+ gold" rows:** the same kit player on tenRev 4 (`scripts/tendrop-depth-player.ts`), planning for gold tens. A
  gold ten is worth 4 tiles of time to it.
- **Elite:** pace 0.35, no mis-adds, 140 ± 15 ms reactions. This level is defined in the script; SKILLS is unchanged.
- **Scripted best:** no reaction or think time. It takes every planned tile on the tick it arrives and goes for gold
  tens first.

| Player | tenRev 3 | tenRev 4 |
|---|---|---|
| average (kit) | 97 / 110 / 110 | 97 / 110 / 110 |
| good (kit) | 129 / 137 / 141 | 137 / 151 / 153 |
| great (kit) | 137 / 144 / 147 | 143 / 165 / 176 |
| near (kit) | 141 / 145 / 147 | 158 / 175 / 191 |
| good + gold | 110 / 135 / 140 | 110 / 153 / 157 |
| great + gold | 131 / 139 / 143 | 152 / 166 / 181 |
| near + gold | 135 / 144 / 146 | 160 / 181 / 191 |
| elite (no gold) | 142 / 147 / 148 | 162 / 176 / 177 |
| elite + gold | 138 / 144 / 148 | 162 / 177 / 188 |
| scripted best | 143 / 148 / 150 | 183 / 198 / 200 |

Reading against the brief:

- **A solid player scores about the same.** Good (kit) moves 129 → 137 (+6 %). The average player is unchanged:
  unfinished runs are tenRev 3's score.
- **Today's top pace lands at 150–165.** Near-perfect today is 141 median, best 147; it becomes 158 median.
- **190–200 is the top end only.** The near-perfect and gold-chasing kit players reach 188–191 on their best seeds.
  Only the scripted near-floor run gets 198–200. The modelled elite human, who plays one tap at a time, reaches about
  188. A real elite who reads ahead and plans gold tens is the 190–200 player.
- **Chasing gold is a choice with a cost.** A good player chasing gold drops to a 110 median: the detours often cost
  the finish. Great and better players gain about 5–9 points from it.

## Presentation

- **Gold tile:** a gilded face (#FFF3C2 → `TD_GOLD` #F5B82E), a deep gold rim (#8A5A08), a bright inner rim, a
  diagonal glint and a small star in the top-left corner. It is the cached tile sprite (`tileSprite` look `gold`),
  drawn over the tile's collision rectangle like every tile (bounds unchanged, within the 2 px allowance). Operator
  tiles keep their brass face. The gold tile is the cream digit's shape, but its face and star read differently.
- **Gold ten:** the clear ring is gold instead of pale gold, and "GOLD TEN" (Space Grotesk 800, gold with a dark
  outline) rises 34 px and fades over 900 ms from the tile. Under reduced motion it fades in place without rising.
  This is presentation memory only (`observe`); the sim is never written.
- **Sound:** a gold ten plays the existing `tendrop.ten` cue over the clear (`playCorrect` + `tendrop.clear`). No new
  audio files. It goes through `soundCue`, so mute and the effects level apply as for every Tenfall cue.
- **Reveals and replays:** the reveal board (`revealRenderers.ts`) and the stage's Reveal now replay with the stored
  `tenRev`, so a tenRev 4 board shows its gold tiles. Older rounds are unchanged. Layout is unchanged: no HUD or box
  change, and nothing moves after first paint.
- **Texts:** the intro is "Points per target. Clear all ten fast, hitting targets with gold tiles, for up to {max}."
  The "?" help score line is built from the tenRev 4 functions and `{max}`. A new how-line: "Gold tiles: hit a target
  with one for bonus points."
- **Intro demo:** `introDemo.functions.ts` stops any Tenfall demo recorded before tenRev 4. The intro shows its still
  (IntroExample) until a demo is recorded on tenRev 4. **Demo needs re-recording.**

## Screenshots

- `screenshots/depth-d2-number/tenfall-414x896.png`: practice at 414×896 (DPR 2), 260 ms after a gold ten. "GOLD
  TEN" rises over the lane, and the next pass's gold 4 is entering at the bottom.
- `tenfall-414x896-gold-tile.png`: a gold 4 falling beside a brass ×2. The gold face is close to the operator
  tiles' brass; the star and glint tell them apart. A deeper or cooler gold is an option if Joe finds them too alike
  on a phone.

## Replay coverage

- `scripts/fixtures/tendrop-rev3-legacy.json.gz` holds 280 runs recorded on the code before tenRev 4: 10 seeds ×
  (4 kit levels, 2 spam strategies, nothing) × (unstamped, tenRev 1, 2, 3). Each has its score and a hash of its
  whole final state. Re-record only on pre-tenRev-4 code: `bun scripts/tendrop-depth-check.ts --record`.
- `scripts/fixtures/replay-runs.json` gained one tenRev 4 run (`replay-fixtures.ts --add=tendrop`); the 110 earlier
  runs are kept.

## Checks run

| Check | Result |
|---|---|
| tendrop-depth-check (new, ~5 s) | PASS: 280 legacy runs identical; the rev-4 plan is rev 3's on 500 seeds; 96 rev-4 runs replay as played; gold tens counted independently; formulas; 200 reached through gradeAnswer |
| tendrop-check (now half the runs on tenRev 4) | PASS |
| intro-score-text-check | PASS |
| intro-demo-check | PASS |
| reveal-score-check | PASS |
| replay-check | PASS (after adding the tenRev 4 fixture run) |
| scoring-batch2-check | PASS (its stored Tenfall runs are pinned to tenRev 3; the rooms-deal line accepts tenRev 4) |
| scoring-bands-check | Tenfall lines PASS (the rooms-deal line accepts tenRev 4). It still FAILs on 7 lines for Target, Equation, Balance, Integer Pyramid, Trail, Counterweight and Checkout ("the '?' help is not the puzzle's score text"), from the other depth work in this tree, not Tenfall |
| round-max-check | PASS |
| sound-manifest-check | PASS |
| practice-bests-check | PASS (`practiceStamps.data.ts` already lists `tenRev=4`) |
| round-time-check | PASS |
| puzzle-score-rev-check | PASS |
| room-practice-grade-check | PASS |
| arcade-fx-check | PASS |
| arcade-play-check tendrop | PASS (frame 16.8 ms vs baseline 16.7, max step 1.2 px/tick) |

arcade-self-replay-check does not include Tenfall.

## Shared files touched (Tenfall lines only)

`src/lib/duel/arcade.server.ts` (generateTenDrop), `src/lib/duel/types.ts` (tenRev comment), `src/lib/duel/grade.ts`
(`goldTens` in extra), `src/lib/arcade/reveal.ts` ("Gold tens" tile), `src/lib/duel/roundSummaries.ts`,
`src/lib/arcade/revealRenderers.ts` (replay with the stored tenRev), `src/lib/duel/instructions.ts`,
`src/lib/duel/introScore.ts`, `src/lib/duel/introDemo.functions.ts`, `scripts/scoring-batch2-check.ts`,
`scripts/scoring-bands-check.ts`, `scripts/fixtures/replay-runs.json`.
