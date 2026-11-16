# Coral Pop (`bubbleRev 12`, 15 Nov 2026: the fast shot and a clearable reef)

Rooms deal `bubbleRev 12` (`BUB_REV_FAST`, `bubbleFastGame` in `src/lib/arcade/bubble.ts`), the Strategy overhaul's
stamp (phase 2 step 4, `docs/design/game-reviews/strategy.md`). bubbleRev 11's game and parts (below) with two changes,
both from the seed or the input log only, so every phone and the server play them identically:

- **A smaller reef.** Nine rows (86 bubbles, `BUB_V12_REEF`) instead of ten (95); the chests are drawn on rows 3–8. The
  review found Near-perfect play left about 20 of 95 in the 90 s. The core is full at the whole 86-bubble reef
  (`BUB_V12_STD_SPEC`, the same parts and maximums).
- **The fast shot.** Dragging further down the aim line shoots faster: the release carries `c` = 0, 1 or 2 (the phone's
  drag length: 110 px and 190 px, `BUB_V12_FAST_DRAG`, `bubFastLevel`), and the shot's flight runs `c + 1` times a tick.
  Each run is the very flight step every revision uses, so the bubble follows exactly the same path (sub-steps, wall
  bounces, landing cell) and only arrives sooner. Gold chevrons over the gun show the level while aiming. Only
  bubbleRev 12's input range carries `c` (`bubbleInputRangesFor`); older stamps clamp it to 0 and never read it.

The checkpoint folds the fast-shot mark and the shot's level in last. `pinBubblePreFast(true)` deals bubbleRev 11 for
the checks written for it. strategy-overhaul-check proves the reef on 200 seeds, the same landing for 300 shots at each
level, a fast-shot run through the server replay, and bubbleRev 11 unchanged.

**Measured (skill-band bots, `bun scripts/arcade-skill-bands.ts bubble --rev=now --seeds=12`; the bot drags further at
higher levels, `FAST_DRAG`):** medians Average 66, Good 99, Near-perfect 171, Elite 178 (bubbleRev 11's Near-perfect
and Elite sat at about 158). The difficulty levels (Easy, Hard, Expert) come with the difficulty framework.

## Levels (stage 3)

The Strategy overhaul's stage 3 (15–16 Nov 2026, `docs/design/difficulty/README.md`): Easy, Hard and Expert on the live
stamp, bubbleRev 12, with the level read from the stored puzzle (`level`, `puzzleLevel`; `bubbleGameFor(rev, level)`,
`replayBubbleRun(seed, raw, rev, level)`; grade, replay steppers, reveal renderers, the stage and the reveal all pass
it). **Normal is today's game exactly**: no `level` field on the puzzle or the state, and every revision's init states,
a scripted run and its score digest exactly as recorded on the tree before levels (`scripts/fixtures/bubble-levels-normal.json`).
A level asked of an older stamp plays that stamp. Rated play and the Daily are always Normal (the framework's
`modeLevel`). The settings are frozen in the sim with the stamp (`BUB_LEVELS`; a retune is a new stamp) and repeated
in `GAME_LEVELS.bubble` for the selectors and the tuning tool.

**Today's Normal (bubbleRev 12)**: 5 colours, an 86-bubble reef (9 rows), a descent every 8 shots, the aim trail
running to the top of the tank through every bounce, a 90 s run; parts full at the whole reef, 30 bank shots and a
clear with 45 s left.

| | Easy | Normal (today) | Hard | Expert |
| --- | --- | --- | --- | --- |
| Colours | 4 | 5 | 5 | 6 (the sixth: orange, a seahorse, a cross) |
| Reef bubbles (chests included) | 75 | 86 | 110 | 110 |
| Shots per descent | 10 | 8 | 5 | 7 |
| Aim trail (display only) | two bounces | to the top | one bounce | short (120 px) |
| Core full at (bubbles cleared) | 60 | the reef | the reef | the reef |
| Bank shots full at | 10 | 30 | 20 | 10 |
| Speed full at (left at the clear) | 30 s | 45 s | 30 s | 30 s |
| Clock | 90 s | 90 s | 90 s | 90 s |

- **The reef** is drawn row by row from the seed (`init`'s `look`): the last row part-filled and centred to the exact
  count, the six chests on full rows only, the queue from the level's colours. Nothing comes from play.
- **The sixth colour** is grid value 10 (`BUB_SIXTH`; 6–8 are the specials, 9 the chest), drawn as an orange bubble
  (`BUB_SIXTH_COLOUR`) with its own seahorse and cross symbol, told apart without colour. It is code-drawn: there is
  no rendered candy-glass sprite for it yet (the other five use `public/strategy/bubble-*.webp`). The Joker matches it.
- **Scoring** stays the arcade scoring standard: the same six parts and maximums, 200 in all. Only the "full at" figures
  move (`banksFull`, `coreFull`, `speedFullLeft` on the state), so a flawless run can fill every part on a level
  (Normal's 30 bank shots are never reached by any bot).
- **The bots** (`scripts/arcade-skill-bands/bots/bubble.ts`) read the trail's reach (`trail` on the state): a bank shot
  with more bounces than the trail shows is noticed half as often and aimed less surely; Expert's short trail makes
  every aim less sure. Normal (no `trail`) plays exactly as before.

**Proofs** (bubble-levels-check): every level's reef on 120 seeds (count, colours, chests, cadence, trail and full-at
figures), the clock, the server replay reading the stored level (a level's log replayed as Normal does not match), and
144 recorded witness runs (`scripts/fixtures/bubble-levels-witness.json.gz`, `bun scripts/bubble-levels-record.ts`: the
skill-band bot under human limits at Average, Elite and Flawless on each level's first 12 room seeds) replaying through
the server to their recorded scores. Every level is cleared by Elite and by Flawless, and 200 is reached through the
server replay on every new level (Easy: Elite 1, Flawless 3 of 12; Hard: Elite 2, Flawless 5; Expert: Elite 1).

**Measured** (the witness runs, 12 room seeds a level; averages, with the median in brackets):

| | Easy | Normal | Hard | Expert |
| --- | --- | --- | --- | --- |
| Average | 116 (114) | 64 (67) | 53 (54) | 26 (22) |
| Elite (human limits) | 193 (194) | 176 (178) | 174 (171) | 159 (171) |
| Flawless | 194 (195) | 184 (183) | 183 (197) | 171 (175) |
| Elite clears | 11 of 12 | 8 of 12 | 4 of 12 | 1 of 12 |

Easy's star (175+) for the Average bot: 1 of 12 seeds (the best 177). Expert seeds for Joe to try (Elite's score):
428011710 (200), 1583049006 (178), 992653281 (174), 855957879 (173), 375698285 (173). The Elite level's reaction is
145 ms, but with its think time each shot is about 0.5 s after the last lands (above 0.25 s to react plus 0.15 s to
move). `bun scripts/level-tune.ts bubble --level=all` reports the same game's Near-perfect and Elite on dealt puzzles.

## Coral Pop on the arcade scoring standard (`bubbleRev 11`, 29 Oct 2026)

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
| Speed | 10 | a cleared reef only: full with half the clock (45 s) or more left, then even to 0 at the buzzer (`stdLine(10, ticks left, 2700)`) |
| Chests | 30 | 5 for each of the 6 seeded chests that falls with a cluster (bubbleRev 10's chest rule) |
| Bank shots | 15 | 1 for every 2 bank shots (`stdLine(15, banks, 30)`), so 30 bank shots fill it |
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

## 3 Nov 2026 polish (display only, no stamp)

The HUD on the rock is the shared pills (`hudPill.renderer.ts`): "Popped n" (the main count, top left), "Treasure n/6"
top right with its chest bubble beside it (gold once all six are out), and "Combo ×n" (gold) under "Popped" while a pop
streak runs (bubbleRev 8+). It replaced the gold monospace "Popped" readout and the bare "0/6" tally.
