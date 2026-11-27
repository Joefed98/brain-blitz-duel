# Meteor (`snake`): the arcade scoring standard, snakeRev 11 and 12

## snakeRev 16 (D5's ladder, 23 Nov 2026): Normal's lines lowered, the levels' rocks on the field

New stamp **snakeRev 16** (`SNAKE_REV_LADDER`), dealt at Normal and every level; snakeRev 15 rounds (every level) and
every older stamp replay and score exactly as before (`scripts/fixtures/snake-ladder-legacy.json.gz`, recorded on
polish/d5 428cd79a before any change; snake-ladder-check section 1). Checks written for snakeRev 15 pin
`snakePreLadder` (`DEAL_PINS`). States add `ladder: 1`, folded into the checkpoint checksum last.

**Normal** (Joe's rule for the Normal scoring stamps, 23 Nov 2026: each feature part full at about what the realistic
elite takes on three runs in four): snakeRev 15's play exactly, scored on lower lines (`SNAKE_V16_LINES`):

| Part | Max | snakeRev 15 | snakeRev 16 |
| --- | --- | --- | --- |
| Stars (a gold star counts 2) | 120 | full at 36 | full at 36 (unchanged) |
| Gold stars | 40 | full at all 7 eaten on their first tick | full at 60 % of their whole worth (each about 9.5 eaten at once) |
| Combos | 20 | 1 a combo star (full at 20) | 2 a combo star (full at 10) |
| Lane rides | 10 | 1 a ride (full at 10) | 2 a ride (full at 5) |
| Warp stars | 10 | 2 each (full at 5) | unchanged |

The realistic elite's three-in-four figures on Normal (96 deals, the ladder's elite under the human limits): gold stars
58 % of their worth, 10 combo stars, 5 lane rides, 20 warp points (warps already full). Normal is dealt, like every level,
only from seeds a person held to the limits takes to 200 (below).

### Levels (D5, 23 Nov 2026)

The lever is **rocks on the field** (retroLevels.ts `SNAKE_LEVELS_V16`, mirrored by the level registry): on Normal rocks
only fall once the comet has grown, so no level could be told from Normal at the start; now Easy has none and Hard and
Expert start with rocks already down. Every level keeps snakeRev 15's stars, gold stars, lanes and wormholes (the seed's).

| | Easy | Normal | Hard | Expert |
| --- | --- | --- | --- | --- |
| Rocks at the start | none (no meteor shower either) | none | 8 | 16 |
| Then | none | earned as the comet grows (from length 9, one every 4 stars, 11 at most), the shower at 20 stars | one every 3 s from 10 s, whatever the comet's length, 20 at most; the shower | one every 2 s from 5 s, 32 at most; the shower |
| Edges | wrap | wrap | walls | walls |
| Lives | 3 | 2 | 2 | 1 |
| Pace (ticks a square) | 9 → 5 | 9 → 4 | 9 → 4 | 7 → 3 |
| Stars full at | 20 | 36 | 36 | 36 |
| Gold stars full at | 40 % of their worth | 60 % | 61 % | 67 % |
| Combos full at (combo stars) | 8 | 10 | 12 | 15 |
| Lane rides full at | 4 | 5 | 5 | 7 |
| Warp stars full at (points) | 8 | 10 | 10 | 10 |
| Seeds dealt (proved of tried) | 100 of 107 | 100 of 158 | 100 of 273 | 100 of 212 |

The rocks already down are single squares drawn from a stream of their own after everything snakeRev 15 draws: off the
border, never on a star, a gold star or a lane, never touching a wormhole mouth, the shower's squares or another rock,
and clear of the comet's way out (its column and the next ones from 8 squares above its head to 3 below its tail), so no
square is ever shut in. Hard's timed rocks are snakeRev 15's own rock squares (with their sizes) on an exact 3 s clock;
Expert's are those squares then single ones drawn the same way, every 2 s. A timed rock still shows its shadow 2 s ahead.
Expert keeps the spec's quickest pace (3 ticks a square): the planner held to 0.15 s between swipes proves 200 on 100 of
212 seeds, so the spec's fallback of 4 was not needed. Each level carries its own scoring lines (decision 12), set so the
realistic elite's share of runs at 200 steps down each level.

**The ladder** (`scripts/fixtures/d5-ladder-snake.json.gz`: 96 deals a level, the
ladder's average and realistic elite under the human limits, graded by the server; `bun scripts/d5-ladder-record.ts snake
--deals=96`):

| | Easy | Normal | Hard | Expert |
| --- | --- | --- | --- | --- |
| Average player, mean | 158.8 | 105.6 | 84.1 | 35.4 |
| Realistic elite, mean | 199.1 | 194.8 | 192.5 | 181.8 |
| Elite runs at 200 | 83 % | 48 % | 36 % | 28 % |

On snakeRev 15 (today's deal, 96 deals) the averages were 110.3 / 87.9 / 62.3 / 52.6 and the elite 173.6 / 172.3 /
159.9 / 163.1, with no run at 200 at any level (Expert's elite above Hard's). The spec's targets were average 150–180 / 55–75 / 25–45 and
elite 195+ / 150–175 / 120–150 (Hard's average and both elites sit above them: the elite reaches 200 on more than a fifth
of Expert runs, which Joe's ladder test asks for, so Hard and Expert stay above the guides).

**Proof**: every dealt seed at every level has a stored witness at exactly 200 through the server's replay, played by the
comet planner held to the human limits (below); snake-ladder-check replays a tenth (all with `CHECKS_FULL=1`) and checks
every witness's swipes are at least 0.15 s apart.

Checks and tools: `scripts/snake-ladder-check.ts` (~35 s; `--full`), `bun scripts/snake-level-deal.ts [--check]`,
`bun scripts/snake-oracle.ts` (a report), `bun scripts/d5-ladder.ts snake` (the table), the lever picture
`src/lib/levels/pictures/retro-action/snake.tsx`.

### The proof: a comet planner held to the human limits

`scripts/snake-oracle.ts`: the skill-band bot's flawless player (it routes to each star and each gold star it can reach in
time, rides the speed lanes on purpose, takes the wormholes, steers round rocks and shadows) made a person exactly at
Joe's limits: it acts on a new star, a gold star, a rock's shadow or its own head off the route one reaction later
(0.25 s, 15 ticks, never sooner; HUMAN_LIMITS on the flawless profile), and two swipes are always at least 0.15 s apart
(9 ticks, `snakeBotOptions.minGap`), so at speed a U-turn needs three squares between its turns. It never reads the star
queue ahead or the rock schedule. A seed is dealt at a level only when one of eight draws of its think times scores
exactly 200 through the server's replay (`scripts/snake-level-deal.ts`, `src/lib/duel/snakeLevelDeals.server.ts`, the
witnesses in `scripts/fixtures/snake-level-deal-witness.json.gz`; `--check` replays every witness and rebuilds the deal
file byte for byte).

Bot changes (`scripts/arcade-skill-bands/bots/snake.ts`): `snakeBotOptions.minGap` (0 by default: every existing use
unchanged) and, with the Oct 2026 fixes on a snakeRev 16 state only, the level's own pace (`snakeStepTicksOf`) where the
bot read Normal's; a Normal state has no level, so its pace is the same either way.

## snakeRev 15 (the Retro overhaul, stage 3, 16 Nov 2026): the first crash forgiven

snakeRev 14's world, rocks, wrap, parts and scoring exactly, with one grace at Normal (`SNAKE_V15_GRACE`): a crash that
would end the run instead leaves the comet where it was before the step (a rock landing on the head leaves the rock and
the comet under it) and holds it still for `SNAKE_V15_STUN_TICKS` (90; a turn chosen then is kept), with "SAVED!" over
the board and `snake.saved`. The second crash ends the run as before. Levels (retroLevels.ts): Easy 3 lives, Hard 2 with
walls, Expert 1 with walls; each sets its pace and the stars the core is full at. States add `grace`, `graceUsed`,
`stunTo`, folded into the checkpoint checksum last. Rooms deal it (preRetro: snakeRev 12).

29 Oct 2026. Rooms and practice dealt **snakeRev 11** (was 10) until 1 Nov 2026, when snakeRev 12 replaced it (gold stars count 2 towards the core, full at 28; see "snakeRev 12" below). snakeRev 11 plays exactly as snakeRev 10: the same
19 × 34 field, stars, rocks (2 × 2 ones too), meteor shower, lanes, three wormhole pairs and gold-star schedule, all
drawn the same way from the room seed. Only the scoring is new. Every older stamp (unstamped, 1–10) replays and scores
exactly as before.

Code: `src/lib/arcade/snake.ts` ("The arcade scoring standard (snakeRev 11)"), `snakeStdParts` / `snakeStdScore`.
Check: `scripts/snake-standard-check.ts` (~15–25 s). Standard module: `scripts/arcade-standard/snake.ts`.


## snakeRev 14: rocks in three sizes (the Retro overhaul, 15 Nov 2026)

Joe (15 Nov 2026): "varied Meteor rock sizes, with their stamps". New stamp **snakeRev 14** (`SNAKE_REV_SIZES`):
snakeRev 13's world, wrapping edges, parts and scoring, with the rocks in three sizes. After everything snakeRev 13 draws
from the room seed, `SNAKE_V14_MID_ROCKS` (4) of the single-square rock slots (from the second on, never a 2 × 2 one)
grow into a **2 × 1** or **1 × 2** rock, trying the four placements from a seeded start: none on a star, gold star,
mouth or the border, none touching the shower squares or another rock (snakeRev 10's rule for its 2 × 2 rocks). Every
one of 300 seeds tried gets all four. So a run holds small (1 × 1), middle (2 × 1, 1 × 2) and large (2 × 2) rocks, the
same for every player; each lands only for a meteor that has earned a rock, counts as one rock, shows its shadow on every
square it will cover, and the head may not enter (or be under) any of them. States add `midRocks` and `midRocksV`
(anchors), folded into the checkpoint checksum last; `snakeRockSpan` and `snakeRockShape` read them (the bot sees rocks
only through those). Rooms deal it; only an intro demo recorded on snakeRev 14 plays.

Medians (p10–p90) on 20 room seeds, `bun scripts/arcade-skill-bands.ts snake --rev=now --seeds=20 --levels=all`:
weak 60 (42–85), average 84 (59–104), good 126 (73–146), great 152 (109–167), near-perfect 174 (153–177), elite 176
(169–184), flawless 180 (174–188); snakeRev 13's were measured on the same tool in stage 1 (docs/design/retro-overhaul.md).

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
