# Coral Pop on the arcade scoring standard (`bubbleRev 11`, 29 Oct 2026)

Rooms deal `bubbleRev 11` (`BUB_REV_STD`, `bubbleStdGame` in `src/lib/arcade/bubble.ts`). Every earlier revision
replays and scores exactly as before (bubble-standard-check replays 28 bubbleRev 10 runs recorded on the untouched
tree, `scripts/fixtures/bubble-standard-legacy.json.gz`, written by `scripts/bubble-standard-legacy.ts`).

## Joe's row

"Coral Pop (gameplay change): the mine pops only the 4 bubbles closest to where it hits. Core up to 120 = bubbles
cleared, full at clearing the reef. Clearing the reef 10 + speed 10. Chests 30 (5 each of 6). Bank shots 15. Combos 15."

## The parts (200 in all)

| Part | Max | How it pays |
| --- | --- | --- |
| Bubbles cleared (core) | 120 | 120 × bubbles cleared ÷ 95 (the reef's starting bubbles), rounded down: a straight line, full only when the reef is cleared |
| Reef cleared | 10 | the whole reef cleared |
| Speed | 10 | a cleared reef only: full with half the clock (45 s) or more left, then even to 0 at the buzzer (`stdLinear(ticks left, 2700, 10)`) |
| Chests | 30 | 5 for each of the 6 seeded chests that falls with a cluster (bubbleRev 10's chest rule) |
| Bank shots | 15 | 1 for every 2 bank shots (`stdShare(banks, 30, 15)`), so 30 bank shots fill it |
| Combos | 15 | 1 each (bubbleRev 10's rule: every removing shot straight after another removing shot) |

Anyone who plays scores at least 1, a run with no input 0 (`stdScore`). No feature curve or rising scale is left
(`BUB_V8_FEATURE_CURVE` and the rev-8 band curve no longer score the new stamp).

**Core measure.** "Bubbles cleared" is the reef's net shrink (95 − bubbles left), or a quarter of the bubbles burst or
dropped when that is more (bubbleRev 9's credit, so a reef grown past its start by stuck shots still credits play; in
play it is at most (95 + 120 shots) ÷ 4 = 53, so only a cleared reef reaches 95). The reef starts with 95 bubbles on
every seed (10 rows of 10 and 9, the 6 chests among them), so `fullAt` is the run's own reef size, 95 everywhere.
The near-perfect level's median measure is 88 of 95 on the tuning seeds (87 on fresh seeds); the core stays full at
the whole reef as Joe's row says.

**Earning a feature never costs core.** A falling chest, a bank shot and a combo all clear bubbles too; a chest is one
of the 95 and counts as cleared however it goes.

## What changed in play

- **The mine** (`bubMineNearest`): when it lands it pops exactly the 4 bubbles nearest its landing cell, by squared
  distance in px between cell centres (integers; descents shift every row alike), ties to the lower cell index, the
  mine itself gone. bubbleRev 10's mine cleared every bubble within two hex rings (up to 18). In a full field the four
  nearest are the neighbours above and below (17 px across, 29 down: 1,130 px²), nearer than the two beside (34 px).
  A chest is a bubble here, as on every earlier revision: one popped by the mine pays nothing. Bubbles left hanging then
  drop as after any pop, and they count as cleared (the core counts the reef's shrink). The queue is unchanged, so the
  mine (or torpedo: the seed picks one) comes at the same shot for everyone.
- Everything else is bubbleRev 10: the reef, queue, Jokers, torpedo, chests, bank-shot and combo rules, the descent pace.
- States add `minePops: 4` (folded into the checkpoint checksum last) and `std: 1`, and carry no `bombR`.
- The renderer's mine ring stays over one ring of cells on bubbleRev 11 (the four pops show in the pop effects); the HUD
  is unchanged (chest tally, `COMBO ×n`).

## Texts and wiring

- Help SCORE: `liveStdHelp("bubble", …)` (every part, its maximum and how it pays, "Together 200 points."); the help's
  mine line says the mine pops the 4 nearest.
- Intro SCORE: "Bubbles cleared, a fast clear, falling chests, bank shots and combos. Up to {max}."
- Grade extras add `chests`, `banks`, `combos` on bubbleRev 11 only; the round summary's detail line shows them.
- The reveal's breakdown lines come from the standard parts (reveal.ts, unchanged); its axis and tiles are unchanged.
- The intro demo stays stopped until one is recorded on bubbleRev 11 (introDemo.functions.ts).
- Skill-band bot: on bubbleRev 11 it weighs the features in score points against a bubble's 120 ÷ 95 core points
  (`bubStdFeaturePoints`); a capped feature adds nothing. No other bot change (a bounce-wariness change for the top
  levels was tried and dropped: it made the flawless bot worse).

## Before → after medians

`bun scripts/arcade-skill-bands.ts bubble --rev=now --levels=all --jobs=2` (fixed bots), before on 99115b0
(bubbleRev 10), after on bubbleRev 11. No played run scored 0 and none was flagged, before or after.

Tuning seeds (`--seeds=60`):

| | Weak | Average | Good | Great | Near-perfect | Elite | Flawless |
| --- | --- | --- | --- | --- | --- | --- | --- |
| before (rev 10) | 42 | 75 | 101 | 124.5 | 171.5 | 179 | 187 |
| after (rev 11) | 21 | 40 | 75.5 | 123 | 158 | 158.5 | 170.5 |
| bubbles cleared after | 12 | 22.5 | 43.5 | 68 | 88 | 89 | 94.5 |

Fresh seeds (`--from=10000 --seeds=100`):

| | Weak | Average | Good | Great | Near-perfect | Elite | Flawless |
| --- | --- | --- | --- | --- | --- | --- | --- |
| before (rev 10) | 43 | 79 | 104 | 128 | 170 | 183 | 188 |
| after (rev 11) | 19 | 46 | 85 | 125 | 158 | 161 | 175.5 |
| bubbles cleared after | 11.5 | 27 | 46 | 69.5 | 87 | 90 | 95 |

Feature medians after (tuning): chests 0 / 1 / 2 / 4 / 5 / 5 / 6, bank shots 3 / 6 / 8 / 12 / 12 / 12 / 10, combos
4 / 5 / 9 / 13 / 17 / 17 / 16.5; reefs cleared 0 / 0 / 0 / 0 / 2 / 3 / 30 of 60 (fresh: 0 / 0 / 0 / 1 / 3 / 11 / 53 of 100).

**Reading.** Medians rise at every level. The lower levels fall because the straight core no longer lifts a part-cleared
reef the way bubbleRev 8's curve did (70 points at 20 bubbles), as the standard intends. The near-perfect and elite
bots are close (158 → 158.5 tuning, 158 → 161 fresh): both run out of clock with 6 or 7 bubbles left (60 and 65 shots),
both reach the combo cap and make about 12 bank shots, so only clears (2–3 vs 3–11 per hundred) and a bubble or two of
core separate them; elite's lower tail is higher (p10 145 vs 139 tuning, 152 vs 130 fresh). Flawless sits 12–15 above.
Under bubbleRev 10 the steep top of the rev-8 core curve and the feature curve widened that gap; a straight line
cannot.

## Checks

- `bun scripts/arcade-standard-check.ts bubble`: perfect 200, idle 1, the core line to 120 at 95, older state no parts,
  each feature's amounts, speed shape, features adding to core, the 4-nearest mine on 40 seeds, 6 chests and 95 bubbles
  on 200 seeds.
- `bun scripts/bubble-standard-check.ts`: legacy bubbleRev 10 replays, the new start and checksum, rooms deal 11, the
  help, the mine on a built reef (and bubbleRev 10's two rings on the same shot), tie order, bot runs through
  `replayBubbleRun` scoring their parts' sum.
