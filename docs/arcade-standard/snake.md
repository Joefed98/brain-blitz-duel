# Meteor (`snake`): the arcade scoring standard, snakeRev 11 and 12

29 Oct 2026. Rooms and practice dealt **snakeRev 11** (was 10) until 1 Nov 2026, when snakeRev 12 replaced it (gold stars count 2 towards the core, full at 28; see "snakeRev 12" below). snakeRev 11 plays exactly as snakeRev 10: the same
19 × 34 field, stars, rocks (2 × 2 ones too), meteor shower, lanes, three wormhole pairs and gold-star schedule, all
drawn the same way from the room seed. Only the scoring is new. Every older stamp (unstamped, 1–10) replays and scores
exactly as before.

Code: `src/lib/arcade/snake.ts` ("The arcade scoring standard (snakeRev 11)"), `snakeStdParts` / `snakeStdScore`.
Check: `scripts/snake-standard-check.ts` (~15–25 s). Standard module: `scripts/arcade-standard/snake.ts`.

## Parts

| Part | Max | Rule |
| --- | --- | --- |
| Core: stars eaten | 120 | Straight line: 120 × stars ÷ 27, rounded down, full at 27 stars (nothing more after). Each star adds 4 or 5. |
| Gold stars | 40 | The run deals 7 gold stars on every seed (the gold schedule from snakeRev 9: from 8 s, about every 7 s, each on the board 5 s). Each is worth up to 40 ÷ 7 ≈ 5.7, falling in a straight line from its full worth on the first tick it can be eaten to 0 as it fades. Kept exactly as the sum of ticks left on eating (`goldLeft`); the part is 40 × ticks left ÷ (7 × 300), rounded down once on the total. |
| Combos | 20 | A star eaten within 3 s of the last raises the combo; from the third star in a row each star scores 1. |
| Lane rides | 10 | 1 point for each ride along a speed lane that reaches 10 squares in a row (counted once, on its 10th square; a longer ride is still 1). |
| Warp stars | 10 | +2 for a star eaten within 2 s of a wormhole trip. |
| **Total** | **200** | |

- A crash (wall, tail or rock with the head) ends the run, as before. There are no other mistakes.
- Any played run (at least one swipe) scores at least 1. A run with no input scores 0.
- Speed: none (the run is a fixed 60 s).
- Gameplay changes (scoring rules only, the sim's movement is unchanged): the combo window is 3 s (was 1.25 s) and the
  warp-star window 2 s (was 1 s). The old 1–3 combo points per star, the 1–5 gold worth, and the "every 4 lane squares
  from the 6th" rule are gone on snakeRev 11 (no rising scales); the old band curve (`SNAKE_V9_BAND_CURVE`) is not used.
- Everyone in a room plays the identical run: nothing new is drawn; the check proves snakeRev 11's start state is
  snakeRev 10's plus three counters (`std: 1`, `goldLeft: 0`, `laneRides: 0`), and that a bot's log plays the same on both
  stamps tick for tick. The three fields are folded into the checkpoint checksum after everything earlier stamps fold.
- The reveal: "N stars (120 at 27) → core", "Gold g/40 · combos c/20 · lanes l/10 · warps w/10 +bonus", "Total → score"
  (`bandLines` from `snakeBandParts`). Grading stores the parts as `extra.meteorParts` on snakeRev 11.
- HUD: the "COMBO ×n" readout stays up for the 3 s window; "BONUS +n" shows the four feature parts' sum.

## Core target

The first target was 22 stars, with the safeguard: if the great level reaches it easily, use the near-perfect median.
Measured with the skill-band bots on room seeds (`scripts/arcade-skill-bands.ts`, the same play on snakeRev 10 and 11):

| Level | Weak | Average | Good | Great | Near | Elite | Flawless |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Stars, median (30 seeds, snakeRev 10 bots) | 9 | 13 | 18 | 22 | 27 | 34 | 35 |
| Stars, median (100 seeds, snakeRev 11 bots) | 9 | 13 | 17 | 22 | 27 | 28 | 29 |

The great level's median **is** 22, so the target is the near-perfect median: **27 stars** (`SNAKE_STD_CORE_STARS`).

## Medians before → after

`bun scripts/arcade-skill-bands.ts snake --rev=now --levels=all --seeds=30 --jobs=4` (room seeds 0–29, replayed
through the server):

| | Weak | Average | Good | Great | Near-perfect | Elite | Flawless |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Before (snakeRev 10) | 50 | 73 | 115 | 139 | 175 | 186 | 191 |
| After (snakeRev 11) | 48 | 74 | 115 | 141 | 171 | 181 | 182 |
| After, fresh seeds (`--from=10000`) | 45 | 75 | 80 | 145 | 172 | 177 | 185 |

Per part, 100 room seeds (0–99), medians (the score column is the median score, not the parts' sum):

| Level | Score | Stars | Core | Golds eaten | Gold | Combo | Lane rides | Warp | Crashed |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Weak | 51 | 9 | 40 | 1 | 1 | 0 | 2 | 6 | 76 % |
| Average | 74 | 13 | 57 | 2 | 5 | 2 | 3 | 8 | 74 % |
| Good | 112 | 17 | 75 | 4 | 13 | 6 | 4 | 10 | 65 % |
| Great | 144 | 22 | 97 | 5 | 18 | 10 | 5 | 10 | 42 % |
| Near-perfect | 172 | 27 | 120 | 6 | 24 | 15 | 6 | 10 | 26 % |
| Elite | 180 | 28 | 120 | 7 | 26 | 17 | 7 | 10 | 10 % |
| Flawless | 183 | 29 | 120 | 7 | 27 | 18 | 10 | 10 | 9 % |

## Bot changes (`scripts/arcade-skill-bands/bots/snake.ts`, snakeRev 11 only)

- Elite and flawless players take every gold star they can reach before it fades (a gold is worth about 5.7, a star on
  the core's line about 4.4 and nothing past 27), instead of weighing the detour against the old band curve's slope.
- The flawless player values lane squares at 0.4 of a square (others 0.6) when routing, so it takes long lane rides on
  purpose (it never mistimes a swipe). Tried for elite too: more crashes and no gain, so elite keeps 0.6.
- Every other level, and every earlier stamp, plays exactly as before (all gated on the state's `std`).

## Known limits and assumptions

- **Top bunching.** Near-perfect, elite and flawless all fill the core (27+ stars) and nearly fill combos and warp stars,
  so only gold stars (how soon each is reached) and lane rides separate them: 171 → 181 → 182 on room seeds, 172 → 177 →
  185 on fresh seeds. A core target of 30 (elite's median) was tried and leaves elite 177 / flawless 179, so the
  bunching is in the feature parts' caps (combo 20 and warp 10 fill early), not the core target.
- Warp stars fill early: good players already reach 10 (5 warp stars in a 60 s run).
- A perfect 200 needs every gold star eaten on its first tick, which no run can plan for, so the standard module builds
  the perfect run's final state (the core's 27 stars, every gold eaten with its whole life left, the other counters at
  their caps) and scores it with the sim's own scoring (`snakeStdGame.score`, `snakeStdParts`). The best bot runs reach
  about 190.
- The gold count is 7 on every seed (2,000 seeds checked; snake-standard-check proves 60); the part divides by the run's
  own `golds.length`, so a seed dealing fewer would still pay 40 in all.
- Earning a feature never takes core points away by rule (the parts are independent), but chasing a gold star or a lane
  ride costs time a player could spend on stars; past 27 stars that time is free.

## Files

- Sim and scoring: `src/lib/arcade/snake.ts`; dealt: `src/lib/duel/arcade.server.ts`; help: `src/lib/arcade/liveBands.ts`
  (`SNAKE_V11_BAND_CURVE`, the core's straight line), `src/lib/duel/instructions.ts`, `src/lib/duel/introScore.ts`;
  reveal and grading: `src/lib/duel/grade.ts` (`meteorParts`); HUD and sounds: `src/lib/arcade/snake.renderer.ts`,
  `src/puzzles/snake.tsx`; intro demo stopped until one is recorded on snakeRev 11: `src/lib/duel/introDemo.functions.ts`.
- Checks updated for the new dealt stamp: `expansion-e2-check`, `snake-rev10-check`, `arcade-tuning-e-check`,
  `arcade-tuning-f-check` (help text from the live curve), `scripts/scoring-targets-revs.ts` (`LIFT_REVS.snake = [11, 10]`:
  snakeRev 11 keeps snakeRev 10's play).
- Fixtures: `scripts/fixtures/snake-standard-legacy.json.gz` (99 runs on unstamped and snakeRev 1–10, recorded on
  unmodified main 73f6bb7), `scripts/fixtures/snake-standard-runs.json.gz` (24 snakeRev 11 runs), one snakeRev 11 run
  appended to `scripts/fixtures/replay-runs.json` (`bun scripts/replay-fixtures.ts --add=snake`), and the self-replay
  entry `snake/std` appended at the end of `scripts/arcade-self-replay-check.ts`.
- Practice stamps need regenerating (`bun scripts/practice-stamps.ts`): practice-bests-check fails until then.

## snakeRev 12: big stars count twice (1 Nov 2026)

Rooms and practice deal **snakeRev 12** (was 11). Joe found Meteor's scores low and asked for two changes to the core:

- **The bigger stars that appear now and then count as 2 stars towards the core.** These are the gold comet stars (the
  ones drawn on a gold diamond with a timer ring, 7 a run, each on the board for 5 s). They still pay their own gold-star
  part exactly as on snakeRev 11 (up to 40 ÷ 7 each), so eating one never costs core: it adds to it.
- **The core is full at 28 core stars** (snakeRev 11: 27 stars eaten; the first snakeRev 11 target was 22, which the
  great level's median reached, so snakeRev 11 shipped with the near-perfect median, 27). Joe first asked for 20; at 20
  great players filled the core on 88 % of runs, so on 2 Nov 2026, before snakeRev 12 shipped, he took the suggested 28
  (changed in place: no stamp ever dealt the 20).

Everything else is snakeRev 11 exactly: the same world, the same play (a gold star still doesn't make the meteor longer;
speed, rocks and the shower still follow the stars actually eaten), the same feature parts and caps.

| Part | Max | Rule |
| --- | --- | --- |
| Core: stars | 120 | Straight line: 120 × core stars ÷ 28, rounded down, full at 28. Core stars = stars eaten + 2 × gold stars eaten. |
| Gold stars | 40 | As snakeRev 11. |
| Combos | 20 | As snakeRev 11. |
| Lane rides | 10 | As snakeRev 11. |
| Warp stars | 10 | As snakeRev 11. |
| **Total** | **200** | Any played run at least 1, no input 0; no speed part (fixed 60 s run). |

- Code: `src/lib/arcade/snake.ts` ("Big stars count twice (snakeRev 12)"): `SNAKE_REV_12`, `SNAKE_V12_CORE_STARS`,
  `SNAKE_V12_GOLD_CORE`, `snakeCoreStars`, `snakeV12Core`, `SNAKE_V12_BAND_CURVE` (the help's line). States add `gold2: 1`,
  folded into the checkpoint checksum after snakeRev 11's fields, so every earlier checksum is unchanged.
- The reveal's first line: "13 stars + 2 gold ×2 (120 at 28) → 72" ("13 stars (120 at 28) → 55" with no gold star). The
  HUD's STARS count shows the core's stars on snakeRev 12 (the stars eaten on every earlier round).
- Help: "Each star eaten counts 1, each big gold star 2. More stars, higher score – up to 120. A good run (100 points)
  counts 24 stars. Stars are full at 28. Gold stars also add up to 40, …: 120 + 80 = 200." Intro: "Stars to 120 at 28
  (gold stars count 2); gold, combos, lanes, warps add 80. Up to 200."
- Bots unchanged: snakeRev 12 plays as snakeRev 11 for them (the elite and flawless players already take every gold star
  they can reach; snake-rev12-check proves the logs are the same on both stamps).
- The intro demo stays stopped until one is recorded on snakeRev 12.

### Measured (skill-band bots, replayed through the server)

`bun scripts/arcade-skill-bands.ts snake --rev=now --levels=all --seeds=60 [--from=10000]` before the change (snakeRev 11),
and `bun scripts/snake-rev12-bands.ts --seeds=60 [--from=10000] [--targets=…]` after (the same runs scored on both stamps;
they play identically).

| Median score | Weak | Average | Good | Great | Near-perfect | Elite | Flawless |
| --- | --- | --- | --- | --- | --- | --- | --- |
| snakeRev 11, room seeds 0–59 | 48 | 74 | 113 | 143 | 172 | 179 | 182 |
| snakeRev 12 (full at 28), room seeds 0–59 | 54.5 | 89 | 151.5 | 165 | 174 | 179.5 | 182 |
| snakeRev 11, fresh seeds 10000–10059 | 45 | 76 | 99 | 142 | 162 | 178 | 185 |
| snakeRev 12 (full at 28), fresh seeds 10000–10059 | 52 | 96.5 | 130 | 165 | 173.5 | 179.5 | 185 |

Per part, room seeds 0–59, medians (Core full: the share of runs whose core is full at 28):

| Level | Stars | Golds | Core stars | Gold | Combo | Lane | Warp | Core full | Crashed |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Weak | 8 | 0 | 10 | 0 | 0 | 2 | 5 | 0 % | 82 % |
| Average | 12.5 | 2 | 16.5 | 6 | 2 | 3 | 8 | 0 % | 75 % |
| Good | 17.5 | 4 | 27 | 12.5 | 6 | 5 | 10 | 48 % | 65 % |
| Great | 22 | 5 | 33.5 | 18 | 10 | 5 | 10 | 78 % | 38 % |
| Near-perfect | 26.5 | 6 | 39 | 23.5 | 15 | 6 | 10 | 87 % | 30 % |
| Elite | 29 | 7 | 42 | 26 | 17 | 7 | 10 | 98 % | 12 % |
| Flawless | 29 | 7 | 42.5 | 27 | 17 | 10 | 10 | 100 % | 12 % |

On fresh seeds 10000–10059 the core is full on 25 % of good runs, 72 % of great and 92 % of near-perfect.

The near-perfect level's median is **39 core stars** (26.5 stars eaten and 6 gold stars; 38 on fresh seeds). Joe's
first target, 20, was well under it; 28 is still under it, so the top levels mostly fill the core.

### Known limits

- **The core still fills often at the top.** At 28, good players fill it on 48 % of runs (25 % fresh), great on 78 %
  (72 %), near-perfect on 87 % (92 %). Above great, the feature parts decide (great 165 < near-perfect 174 < elite 179.5 <
  flawless 182); the gaps at the top are small (5–9 points), as on snakeRev 11.
- Joe's aims: good 140–150 (measured 151.5 on room seeds, 130 fresh), great about 170 (165). Great can't reach 170 by
  the core target alone: with the core full, a great run's features are worth about 43–45, so its ceiling is about 165.
  Lifting great towards 170 would need more weight on the features against the core (for example core 110 and gold 50).
- What-if medians before the choice (room seeds 0–59, the core full at T core stars, gold stars counting 2):

  | T | Weak | Average | Good | Great | Near | Elite | Flawless |
  | --- | --- | --- | --- | --- | --- | --- | --- |
  | 20 (Joe's first ask) | 72.5 | 118 | 155 | 165 | 174 | 179.5 | 182 |
  | 24 | 62.5 | 101.5 | 155 | 165 | 174 | 179.5 | 182 |
  | **28 (chosen, 2 Nov 2026)** | 54.5 | 89 | 151.5 | 165 | 174 | 179.5 | 182 |
  | 32 | 49.5 | 80.5 | 138 | 164.5 | 174 | 179.5 | 182 |
  | 39 (near-perfect median) | 42.5 | 69 | 120 | 149 | 174 | 179.5 | 182 |

### Checks and fixtures

- `scripts/snake-rev12-check.ts` (~15 s): wiring, help and intro texts, the standard module's 200, 56 legacy runs on
  unstamped and snakeRev 1–11 recorded on unmodified main ae1efbe (`scripts/fixtures/snake-rev12-legacy.json.gz`,
  `bun scripts/snake-rev12-legacy.ts <root>`) replaying to the same score, flag, state and checkpoints, the same world and
  play as snakeRev 11 tick for tick, the scripted rules and the reveal, and 18 stored snakeRev 12 runs
  (`scripts/fixtures/snake-rev12-runs.json.gz`, `--record`).
- Updated for the new dealt stamp: snake-standard-check, snake-rev10-check, expansion-e2-check, arcade-tuning-e-check (the
  help's good run, now "counts 24 stars"), arcade-tuning-f-check (label), arcade-standard-check's roster,
  `scripts/arcade-standard/snake.ts` (snakeRev 12), `scripts/scoring-targets-revs.ts` (`STD_REVS.snake = [12, 10]`).
- One snakeRev 12 run appended to `scripts/fixtures/replay-runs.json`; self-replay entry `snake/v12` appended at the end
  of `scripts/arcade-self-replay-check.ts`.
- Practice stamps need regenerating (`bun scripts/practice-stamps.ts`): practice-bests-check fails until then.
