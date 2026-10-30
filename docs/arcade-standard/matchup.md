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
