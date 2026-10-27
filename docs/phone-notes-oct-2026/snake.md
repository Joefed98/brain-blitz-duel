# Meteor (`snake`): Joe's phone notes, 27 Oct 2026

> "Meteor: bigger gold stars stay on screen a little longer; add one more wormhole/portal and one more vertical
> speed lane. Redraw the meteor as in Claude's polished mockup: a fiery comet with a dark rock core (#5A2A12),
> orange-to-amber flame (#FF7A2E to #FFB347) and a white-hot streaming trail. Rocks vary in size: some take up
> 4 squares (2×2), not always 1."

New stamp: **`snakeRev 10`** (`SNAKE_REV_10`, `src/lib/arcade/snake.ts`); rooms dealt `snakeRev 9` before this.
Every rule change is gated on the stored revision, and `snakeRev 1–9` replay and score exactly as before.

## What changed

Gameplay (`snakeRev 10` only; `initV10` draws everything after all of `snakeRev 9`'s draws, so the stars, rock
slots, shower, lanes, first two wormhole pairs and gold schedule are exactly `snakeRev 9`'s for the same seed):

- **Gold comet stars stay 5 s** (`SNAKE_V10_GOLD_LIFE`; they stayed 3.5 s before). The worth still falls 5 → 1 over
  the first 3.5 s, and the extra 1.5 s pays 1 (`snakeGoldWorth(tick, end, life)`). So the longer stay gives a later
  chance at the star, not a bigger prize.
- **A third wormhole pair** (green, #4BFF7A from the border palette): one mouth in the top-left part of the field
  and one in the bottom-right. Both mouths are 2+ squares off the border and 3+ squares from the other mouths, and
  they are never on a star, gold star, rock, shower square or lane.
- **A second vertical speed lane** (`laneCol2`): 4+ columns from the first, never the start column, and no mouth
  in it. It works the same as the other lanes (`snakeOnLane`).
- **2×2 rocks:** `SNAKE_V10_BIG_ROCKS` (5) of the room's rock slots, chosen from the seed (never the first slot),
  grow into a 2×2 block round their square. A block is used only where it fits: off the border, not on a star,
  gold star or mouth, clear of the shower and not touching another rock (59 of 60 tuning seeds have all five; the
  other has four). A big rock lands under the same rules as any rock: only for a meteor that has earned one, and
  it counts as one rock. Its shadow covers all four squares. The head may not move into any of the four squares,
  and a landing with the head under any of them ends the run. The body passes through, as before.
  `snakeRockSpan`, `snakeRockCells` and `snakeWarnCells` are the helpers.
- **A played run never scores 0:** a run with input that crashes before its first star and earns no bonus now
  scores 1 (`SNAKE_V10_PLAYED_MIN`; the reveal line reads "Run played +1"). A run with no input still scores 0.
  Reason: one weak bot run in 100 fresh seeds crashed into a wall at 6.75 s with no star, and Joe's bar says anyone
  who plays scores above 0.
- Scoring is otherwise `snakeRev 9`'s: `SNAKE_V9_BAND_CURVE` to 150, the same feature caps (50), 200 at most.
- State: new fields `laneCol2`, `goldLife` and `bigRocks` (top-left squares), present only on `snakeRev 10`. The
  checkpoint checksum adds them after `snakeRev 9`'s fold, so every older checksum is unchanged.

Art (display only, every revision; `src/lib/arcade/snake.renderer.ts`):

- **The comet head:** a dark rock core (#5A2A12, with a warm highlight, a #29282D shadow rim and flecks) set
  2 px forward of the cell's centre. White-hot fire (#FFF4D2) hugs its leading edge, then an amber band (#FFB347),
  then an orange rim (#FF7A2E) with amber flame tongues trailing back. It stays inside its own 24 px cell.
- **The trail:** the square right behind the head is white-hot with amber streaks, the next is amber, and the rest
  cool through orange and red to smoke at the tail. The whole body is the comet's trail: the tail is no longer
  re-tinted red / yellow / teal every 5 stars (it read as a teal snake behind the comet), and the light between the
  squares is orange, not teal. A bright white-hot or amber streak runs between the first squares while moving (motion only).
- **2×2 rocks** are one 48 px pixel boulder over the block (`paintBigRock`, one cached sprite). The falling
  shadow's red floor and dashed rings cover the whole block, and the rock falls in at double size.
- The second lane is drawn like the first. The third wormhole pair is green. The gold timer ring follows the
  longer stay. Meteor's border, scanlines and the rest of the Retro look are unchanged.

Help text (`src/lib/duel/instructions.ts`, help only): three wormhole pairs, gold for 5 s, one row and two columns
of lanes, and the big rock rule. The intro's one-line HOW rows are unchanged, because arcade-batch2-check
requires each to fit one line. The intro demo is stopped until one is recorded on `snakeRev 10`
(`introDemo.functions.ts`).

## Judgement calls

- I read "bigger gold stars" as the existing gold comet stars, not a bigger sprite.
- The longer gold stay pays only the minimum in its extra time, which keeps the good-level lift small (paying
  5 → 1 over the full 5 s gave good players about +10 on average).
- I chose five 2×2 rocks so every room gets the same number. Whether one lands still depends on the rocks a
  meteor has earned, as for every rock.
- The meteor keeps its eyes. snake-renderer-check counts exactly two 2 px pixels under reduced motion.

## Bot

`scripts/arcade-skill-bands/bots/snake.ts` now treats every square of a 2×2 rock and of its shadow as blocked
(`snakeRockCells`, `snakeWarnCells`), rides the second lane (`snakeOnLane`) and judges gold stars on `goldLife`.
On older revisions each helper returns exactly what the old code read, so the bots' play there is unchanged
(expansion-e2-check's fixtures still pass). Elite bots died on a rock 0 times in 30 `snakeRev 10` runs.

## Medians (skill-band tool, `--rev=now`)

Tuning seeds 0–59. Before = `snakeRev 9` (the coordinator's before-all.json); after = `snakeRev 10`.

| Level | Before | After |
|---|---|---|
| Weak | 45 | 50 |
| Average | 82 | 72 |
| Good | 101 | 113 |
| Great | 144 | 140 |
| Near-perfect | 167 | 172 |
| Elite | 179 | 186 |
| Flawless | 182 | 190 |

Fresh seeds 10000–10099, the same bots on both revisions (paired):

| Level | `snakeRev 9` | `snakeRev 10` |
|---|---|---|
| Weak | 46 | 49 |
| Average | 79 | 80 |
| Good | 110 | 103 |
| Great | 137 | 134 |
| Near-perfect | 162 | 163 |
| Elite | 177 | 187 |
| Flawless | 185 | 192 |

Medians rise from good to great to elite on both seed sets. A good-level player's change is small and moves both
ways (+12 on tuning seeds, −7 on fresh seeds; paired means +7 and −4): the longer gold stars add about 3, and the
2×2 rocks take about as much from stars. Elite and flawless gain 7–10, because they use the extra lane, portal and
gold time best. No played run scores 0 (the one weak run that would have now scores 1).

## Checks (run one at a time, non-browser)

| Check | Result |
|---|---|
| snake-rev10-check (new) | pass |
| snake-renderer-check (comet colour and 2×2 rock assertions added) | pass |
| expansion-e2-check (dealt-stamp line updated to snakeRev 10) | pass |
| arcade-tuning-f-check (`movedOn.snake` = 10) | pass |
| arcade-batch2-check | pass |
| arcade-self-replay-check (`snake/v10` entry added) | pass |
| arcade-tuning-e-check (dealt-stamp row moved on to 10) | pass |
| presentation-geometry-check | pass |
| round-max-check | pass |
| arcade-help-bands-check | pass |
| intro-score-text-check | pass |
| arcade-score-bands-check | pass |
| scoring-bands-check | pass |
| reveal-score-check | pass |
| arcade-room-schedule-check | pass |
| arcade-chart-check | pass |
| arcade-four-check | pass |
| arcade-fx-check | pass |
| scoring-targets-check | pass |
| intro-demo-check | pass |
| replay-check | fail, expected: no stored run on snakeRev 10 in `scripts/fixtures/replay-runs.json` (the coordinator updates it) |
| practice-bests-check | fail, expected: `practiceStamps.data.ts` out of date (the coordinator runs `bun scripts/practice-stamps.ts`) |

Review frames: `bun scripts/shots/meteor-rev10-frames.ts [--out=…]`, which shows the start (comet, six mouths,
both lanes), a landed 2×2 rock with a gold star out, and a 2×2 shadow falling (room seed index 0, elite bot).
