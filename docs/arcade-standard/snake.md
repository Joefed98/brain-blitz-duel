# Meteor (`snake`): the arcade scoring standard, snakeRev 11

29 Oct 2026. Rooms and practice deal **snakeRev 11** (was 10). snakeRev 11 plays exactly as snakeRev 10: the same
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
