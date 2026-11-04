# Gemstone under the arcade scoring standard (`matchupRev 11`)

Batch A of the arcade scoring standard. Rooms and practice now deal **`matchupRev 11`** (they dealt `matchupRev 10`
before). Every older stamp replays and scores exactly as before. gemstone-standard-check replays 65 bot runs recorded
on main before the change (`scripts/fixtures/gemstone-standard-legacy.json`, from `scripts/gemstone-standard-legacy.ts`),
covering unstamped rounds and `matchupRev 2`–`10`, and gets the same score and final state for each.

## Parts (total 200)

| Part | Max | Rule |
|---|---|---|
| Core: gems cleared | 110 | One straight line: `floor(110 × gems ÷ 375)`, capped at 110. Every cleared cell counts, whether it went in a line, a cascade or a blast, specials included. A treasure collected is not a gem. |
| Treasure | 40 | 10 for each treasure gem brought down to the bottom row. A run has 4 (`MATCHUP_V11_TREASURES`). |
| Goals | 30 | 3 for each colour goal met. The goals are the run's first four levels (2 + 2 + 3 + 3 = 10 colour goals, shown under the board). Once all four levels are met, no more come and the panel reads ALL GOALS MET. |
| Ice | 10 | 1 for each frozen cell broken. Exactly 10 frozen cells are laid at the start and never refreshed. |
| Big lines | 10 | 2 for each line of 4 or 5 made by a swap's own match (an L or T with a line of 4+ counts its long line). Capped at 10, so 5 lines. |

Nothing costs points. A run with any input scores at least 1. A run with none scores 0. The cascade multiplier and match
points no longer score on this stamp: the panel shows "big lines n" where it used to show "cascades +n". There is no
curve, knot or rising scale. The core is a two-knot line (`MATCHUP_V11_BAND_CURVE`, which the "?" help reads), and every
feature pays a fixed amount per item.

Code: `matchupStdParts`, `matchupStdScore` and `matchupStdBandParts` in `src/lib/arcade/matchup.ts`. The reveal lines
come from `matchupStdBandParts` through `BAND_SPECS.matchup.parts`. The reveal puts gems cleared on its axis and shows
treasure, goals, ice and big lines as tiles. The puzzle's own Reveal lists every part with its points.

## Core target

The core is full at **375 gems cleared**. That is the near-flawless median from
`bun scripts/arcade-skill-bands.ts matchup --rev=now --levels=all --seeds=30 --jobs=4` on room seeds 0–29: the median
was 376 (373 averaging the middle pair), rounded to 375. The full ladder of gems-cleared medians on those seeds is weak 180,
average 225, good 241, great 318, near 376, elite 376, flawless 444.

## Medians before → after

Skill-band tool, `--rev=now --levels=all --seeds=30 --jobs=4`, fixed bots, every run scored by the server's replay.
"Before" is main's `matchupRev 10`. "After" is `matchupRev 11`.

| Seeds | Weak | Average | Good | Great | Near-perfect | Elite | Flawless |
|---|---|---|---|---|---|---|---|
| Tuning (0–29), before | 52 | 67 | 81 | 95 | 110 | 150 | 164 |
| Tuning (0–29), after | 82 | 101 | 116 | 148 | 165 | 176 | 183 |
| Fresh (10000–10029), after | 80 | 93 | 117 | 142 | 161 | 169 | 175 |

Both seed sets rise from weak to flawless. The steps at the top are near → elite +11 (fresh +8) and elite → flawless +7
(fresh +6). The lowest played run is 64 on tuning seeds and 50 on fresh seeds, and no played run scores 0. The
flawless p90 reaches 196 (tuning) and 200 (fresh).

Medians of the parts by level (room seeds 0–29, from the same bots):

| Level | Gems | Treasure | Goals met | Ice | Big lines |
|---|---|---|---|---|---|
| Weak | 180 | 0 | 4 | 8 | 2 |
| Average | 225 | 0 | 5 | 8 | 2 |
| Good | 241 | 0 | 7 | 9 | 2 |
| Great | 318 | 1 | 8 | 9 | 3 |
| Near-perfect | 376 | 1 | 10 | 10 | 3 |
| Elite | 376 | 2 | 10 | 10 | 4 |
| Flawless | 444 | 3 | 10 | 10 | 5 |

## Gameplay changes (`matchupRev 11` only; states add `std: 1`, `gemsCleared`, `bigLines`, folded into the checksum last)

- **4 treasures a run, not 8.** They are placed one at a time as before, in the plan's first four seeded columns.
- **A treasure can swap with a gem.** The swap goes through when the gem, moved into the treasure's cell, makes a line of
  three. The treasure takes the gem's old cell, and a treasure swapped onto the bottom row is collected at once.
  A treasure never swaps with a special or with another treasure. The hint, the "no move left" test and the reshuffle use
  the same rule (`matchupFindSwapV11`). On `matchupRev 9` and `10` the treasure never moves (unchanged).
- **Four goal levels.** Levels 1–4 are the plan's first four. After the fourth no new goal comes.
- **Exactly 10 frozen cells.** `matchupRev 10` already lays the plan's last set, which in practice is always 10 cells.
  On `matchupRev 11`, should the seeded draw ever come up short, the first free cells from row 4 on make up the
  difference. This draws no PRNG, so the board, queues, plan and ice equal `matchupRev 10`'s for the same seed (the check
  proves it on 300 seeds).
- Unchanged from `matchupRev 10`: 90 s, the 7 × 10 board, ice swaps that make a line, the ice laid once, and specials.

## Identical runs for every player

Everything new comes from the seed at init, as before. The treasure columns, the goal levels and the ice belong to the
plan, which `planV9` draws once. The k-th treasure and the k-th level are the same for everyone whatever they play.
`scripts/room-identity/matchup.ts` now targets `matchupRev 11`, and gemstone-standard-check compares weak, good and elite
logs on three seeds.

## Other updates

- `LIVE_BANDS.matchup` names `matchupRev 11` and its core line. The "?" help states the core (up to 110), each part's
  amount and maximum, and that they make 200. The help's rules say that treasure swaps with a gem making a line, that
  there are four levels, and that the cascade multiplier line is gone. The intro score line names the parts.
- The intro demo stays stopped until one is recorded on `matchupRev 11` (`introDemo.functions.ts`).
- The bot (`scripts/arcade-skill-bands/bots/matchup.ts`) values a swap that pulls the treasure down (per row, and more
  for bringing it home), and stronger levels chase the treasure harder (`TREASURE_FOCUS`). This applies only to `std`
  states, so every older revision's bot plays exactly as before.
- Checks that pinned `matchupRev 10` as dealt now expect its successor 11: e6-check, gemstone-rev10-check,
  arcade-tuning-c-check, arcade-tuning-f2-check and six-game-scoring-check (help text "More gems cleared").
- `scripts/fixtures/replay-runs.json` gained one `matchupRev 11` run (`bun scripts/replay-fixtures.ts --add=matchup`).
  `arcade-self-replay-check` gained `matchup/std` at the end of its list.
- `perfect()` in `scripts/arcade-standard/matchup.ts` replays a recorded flawless bot run (room seed 291005263) through
  `replayMatchupRun`. It scores 200 with every part at its maximum. The run is recorded in
  `scripts/fixtures/gemstone-standard-runs.json` by `scripts/gemstone-standard-record.ts`.

## Assumptions

- "Goals split evenly across the goals shown at the bottom" is read as each colour goal in the panel being worth the
  same. A run has four levels (10 colour goals) so the 30 divides evenly at 3 each. The near-flawless player meets all
  ten.
- "Big matches" are the lines of 4 or 5 the player's swap makes (step 0 of its resolution), not lines that fall into
  place in a cascade, so the part rewards the player's own play.
- "Treasure brought down" means collected on the bottom row, as before.
- With the core full at the near median, elite and flawless separate on the features, mostly treasure. They come
  2 and 3 treasures above near's 1.
- Practice stamps (`practiceStamps.data.ts`) are not regenerated here. The merger does it.

# matchupRev 12: six goals and six treasures (Nov 2026)

Joe's notes: show six gem goals at the bottom and six treasure pieces, keep the treasure swap rule, and make high scores
harder to reach (a near-flawless player should land around 170–180, not near 200). Rooms and practice now deal
**`matchupRev 12`**. `matchupRev 11` and every older stamp replay and score exactly as before: gemstone-rev12-check
replays 35 bot runs on `matchupRev 10` and `11` recorded on main before the change
(`scripts/fixtures/gemstone-rev12-legacy.json`, from `scripts/gemstone-rev12-legacy.ts`) to the same score and final
state, and gemstone-standard-check still replays every older stamp and matchupRev 11's own runs and flawless 200.

## Parts (total 200)

| Part | Max | Rule |
|---|---|---|
| Core: gems cleared | 108 | One straight line: `floor(108 × gems ÷ 360)`, capped at 108 (`MATCHUP_V12_BAND_CURVE`). Every cleared cell counts (lines, cascades, blasts, specials); a treasure collected is not a gem. |
| Treasure | 36 | 6 for each treasure gem brought down to the bottom row. A run has 6 (`MATCHUP_V12_TREASURES`). |
| Goals | 36 | 6 for each of the six colour goals met. |
| Ice | 10 | 1 for each of the 10 frozen cells broken (as `matchupRev 11`). |
| Big lines | 10 | 2 for each line of 4 or 5 made by a swap's own match, up to 5 lines (as `matchupRev 11`). |

Nothing costs points; any input scores at least 1, none 0. Code: `matchupSixParts` (through `matchupStdParts`),
`matchupStdScore`, `matchupStdBandParts`, `matchupGoalsOf`, `matchupCoreGemsOf` in `src/lib/arcade/matchup.ts`.

## Gameplay changes (`matchupRev 12` only; states add `six: 1` and `goalNeed`, folded into the checksum last)

- **Six goals at once, one for each colour**, shown in the panel under the board from the start: clear `goalNeed[colour]`
  gems of that colour. The six targets are the ladder 20, 28, 36, 44, 52, 60 (`MATCHUP_V12_GOAL_LADDER`) in a seeded
  order (`matchupV12GoalNeed(seed)`, a stream of its own from the room seed), so every run has the same six goal sizes
  and everyone in a room has the same goals. Every gem of the colour counts (a line, a cascade or a blast). A goal met
  stays met; `levels` counts the goals met (the "GOAL!" banner and chime fire on each), and no level follows.
- **Six treasure gems**, the plan's first six seeded columns, still one at a time in row 4, collected on the bottom row.
  The treasure swap rule is unchanged.
- The board, queues, plan, rng and the 10 frozen cells equal `matchupRev 11`'s for the same seed (the goals draw
  nothing from the state's rng; the check proves it on 300 seeds). 90 s, the 7 × 10 board, ice swaps, specials unchanged.
- The panel (`drawSixGoalsPanel`, the same 360 × 84 tray under the board, inside the 390 × 720 world): a top line
  "GOALS n/6" (ALL GOALS MET when done), ice left, treasure n/6 and big lines; under it the six goals side by side, each a
  gem, the count still to clear (a tick once met) and a bar in its colour. The world is unchanged, so it fits wherever
  `matchupRev 11` fitted: `screenshots/arcade-tuning-nov-2026/gemstone-goals-414x896.png`, `-375x667.png` and
  `-1366x768.png` (the computer layout), each after 26 real swaps in practice (`scripts/shots/drivers/matchup.ts`).

## Core target and why

The core is full at **360 gems cleared**: the near-flawless level's median gems on `matchupRev 12` (358 on room seeds
0–119, 353 on fresh seeds 10000–10119, fixed bots; 361 on 0–59). Raising it would only lower the near-flawless total
further below Joe's 170–180, so the core stays at the near median as the standard asks. The goal ladder was chosen so
the levels separate on goals (median goals met on room seeds 0–119: weak 1, average 3, good 4, great 4, near 5, elite 6, flawless 6); a
harder ladder lowered the near total and narrowed the near → elite step.

## Medians before → after

Skill-band tool, `bun scripts/arcade-skill-bands.ts matchup --rev=now --levels=all --seeds=120 --jobs=4` (and
`--from=10000`), fixed bots, every run scored by the server's replay.

| Seeds | Weak | Average | Good | Great | Near-perfect | Elite | Flawless |
|---|---|---|---|---|---|---|---|
| Tuning (0–119), `matchupRev 11` | 75 | 96 | 113 | 141 | 159 | 170 | 178 |
| Tuning (0–119), `matchupRev 12` | 72 | 96 | 118 | 137 | 159 | 164 | 176 |
| Fresh (10000–10119), `matchupRev 11` | 77 | 93 | 116 | 140 | 160 | 168 | 180 |
| Fresh (10000–10119), `matchupRev 12` | 76 | 95 | 118 | 142 | 159 | 167 | 176 |

Flawless p90 falls from 196–200 to 188 on both seed sets: a 200 now needs all six treasures (the flawless bot brings
down 2 a run, median; 3 of 120 flawless runs got all six). On 30 seeds the tuning set's near and elite medians tie
(169 / 167, within noise); on 120 seeds every level rises.

## Other updates

- `LIVE_BANDS.matchup` names `matchupRev 12` and its core line; the "?" help lists the parts (108 + 36 + 36 + 10 + 10 make
  200) and the six goals; the intro score line gives the core (108) and the features (92). The intro demo stays stopped until one is
  recorded on `matchupRev 12`. The reveal's axis runs to 360 and its tiles show goals and treasure out of 6.
- Room identity (`scripts/room-identity/matchup.ts`) targets `matchupRev 12` and lists the six goals at t = 1.
- `scripts/arcade-standard/matchup.ts` targets `matchupRev 12`; its perfect run is a recorded flawless bot run (room
  seed 582076058, all six treasures) in `scripts/fixtures/gemstone-rev12-runs.json` (`scripts/gemstone-rev12-record.ts`),
  replayed by the server to 200 with every part at its maximum.
- Checks that pinned `matchupRev 11` as dealt now expect its successor 12 (gemstone-standard-check, gemstone-rev10-check,
  e6-check, arcade-tuning-c-check, arcade-tuning-f2-check); gemstone-standard-check still proves matchupRev 11's own
  flawless run at 200. `scripts/fixtures/replay-runs.json` gained one `matchupRev 12` run; `arcade-self-replay-check`
  gained `matchup/six` at the end of its list.
- The bot is unchanged: it already values every goal colour's gems and the treasure on standard states.

## Assumptions

- "6 gem goals shown at the bottom" is read as all six colours' goals shown at once (each "clear N of this colour"),
  not six levels one after another; "Goals 36 (6 per goal)" pays 6 for each.
- Joe's "near-flawless median around 170–180" is met by the flawless level (176) and approached by near-perfect (159).
  With six treasures each worth 6 and a median of 1 brought down at near-perfect (2 at elite and flawless), near-perfect cannot reach 170 without
  a core target below its own median, which the standard does not allow.
- Practice stamps (`practiceStamps.data.ts`) are not regenerated here. The merger does it.

## 3 Nov 2026 polish (`matchupRev 12`, display only, no stamp)

- The big "0 pts" counter (raw match points, at odds with the 0–200 score) is gone: a row of the shared HUD pills at
  the world's top shows "Score n" (the running score on the 0–200 scale, `matchupStdScore` on the live state, so the
  reveal's figure at the end) and "Goals n/6" (gold once all six are met), with "Next drops ↓" on the right over the
  strip of small gems under it (that strip was unlabelled: it shows the next gem to drop into each column).
- The goals panel's top line is pills: "Ice n" (frozen cells left), "Treasure n/6" and "Big lines n"; the six goals
  sit under them as before (gem, gems left or a tick, a bar), in Archivo.
- The world (390 × 720) and the sim are unchanged; with the top 60 px freed, everything under the HUD (next strip,
  board, tray, goals panel, backdrop and the shared effects layer) is drawn 6 % larger (`SIX_ZOOM` in
  `matchup.renderer.ts`, about a point chosen so the strip starts at y 40 and the panel ends inside the world). Taps
  and the selection, swap tween and desktop key cursor go through the same zoom (`matchupCellAtShown`,
  `matchupShownPoint`), so a tap on a drawn gem selects that gem's cell. Earlier revisions draw exactly as before.
