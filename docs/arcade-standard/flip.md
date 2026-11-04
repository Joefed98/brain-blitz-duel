# Roofbound on the arcade scoring standard

## flipRev 12 (3 Nov 2026, the Action polish): the proved deal, a taller cave

Rooms deal **flipRev 12** (`FLIP_REV_DEAL`): flipRev 11's game exactly (the same sim, states, scoring and checksum;
`flipGameFor(12)` is `flipGameFor(11)`), dealt only on the courses whose stored witness route takes every part's maximum
and scores exactly 200 through the server replay. Joe's audit found 4 of the 260 witnesses land only 7 of the 8 sweet
spots (192), so a perfect run couldn't be proved to reach 200 there; those four courses are left out, and the deal is the
other 256 (`src/lib/duel/flipDeal.server.ts`, built by `bun scripts/flip-deal.ts [--check]`; left out: 1659033635,
1279332153, 1324153016, 1157431211). A room seed picks a course from the deal (`flipDealSeed`). flipRev 11 rounds replay as
before. `playRevOf` maps 12 to 11's play (`DEAL_REVS` in `scripts/scoring-targets-revs.ts`), so the band-era checks keep
proving the play they were written for. flip-deal-check proves the wiring, that the two stamps score and end identically
for bot runs at every level, the deal file byte for byte and every dealt course's witness at 200.

Parts, core target and play are flipRev 11's (below), so the medians are too: `bun scripts/arcade-skill-bands.ts flip
--rev=now --levels=all --seeds=60` gives 43 / 86 / 140 / 155 / 164 / 185 / 200 (weak → flawless; the tool's room seeds
include the four left-out courses, hence flawless's p10 of 198 there).

**Display (flipRev 11 and 12, no stamp: collision is along x and never reads a surface's y):** the cave is drawn 8/5 as
tall about its middle line (`FLIP_FLOW_VIEW_NUM` / `DEN` in `flipSurfaceBase`: 200 → 320, 260 → 416, 340 → 544 px of the
730 px world), the spikes and overhangs taller with it (30 and 46 px, their x-spans the sim's), a warm light round the
runner and a brighter backing in its box (the runner already fills its 24 × 28 collision box, which is unchanged, so it
is not drawn bigger), and the HUD is the Action HUD's chips (SCORE left; FLOW and, once ahead, BEST right).


Rooms deal **flipRev 11** since 3 Nov 2026 (`FLIP_REV_FLOW` in `src/lib/arcade/flip.ts`; Joe's arcade batch). flipRev 10
(29 Oct 2026, below) stays proved and replays exactly as before.

## flipRev 11 (3 Nov 2026): no star pickups, perfect landings, the flow streak

Play is flipRev 8's course, hazards, cave heights, speed zones, checkpoints and sweet spots, and its moves exactly: a
flipRev 10 log runs the same path on flipRev 11 tick for tick (side, arc, crashes, saves, double flips, sweet landings;
flip-rev11-check). Three changes, all gated on the state's `flow: 1` (states also carry `std: 1`), folded into the
checkpoint checksum last with the streak counters, so every flipRev 1–10 checksum is unchanged:

- **No star pickups.** The ten gold stars are not dealt into the state (`stars: []`; the course and its seeded stream are
  untouched, so every hazard and sweet spot sits where flipRev 10 has it). The four star trails stay as a faint guide
  (drawn at 40 %, their stars unlit) and are never taken (`trailGot` stays 0). Nothing scores for either.
- **The flow streak.** A **clean jump** is a flip that lands (its arc ends, `flipT` 1 → 0, with the run going on) with no
  crash saved between its take-off and its landing. Clean jumps in a row make the streak (`streak`); a crash a
  checkpoint saves (a stumble) sets it back to 0 and marks the flip in the air, if any, as not clean (`slip`, cleared at
  the next take-off); a crash that ends the run ends it (the jump in the air never lands). The run's longest streak is
  `bestStreak`. Everything it reads (take-off, landing, save) the sim already tracked; nothing new is seeded or placed by
  how a run goes.
- **The score** (below). The checkpoints still save one crash each (a second of shield, the run goes on).

### The parts (sum 200)

| Part | Max | How it counts |
|---|---|---|
| Clean time (core) | 100 | Half seconds lived less 40 (20 s) for each crash a checkpoint saved, never below 0, on a straight line: `stdLine(100, units, 120)`, full at the whole minute with no crash saved. |
| Perfect landings | 60 | 7.5 for each sweet landing (touching down with the runner's centre inside one of the 8 sweet spots, once per spot). |
| Double flips | 20 | 2.5 for each double flip (the sim's `combos`, as on flipRev 10), full at 8. |
| Flow streak | 20 | 0.4 for each clean jump in the run's longest streak, full at 50. |

Every part is floored (`stdLine`), so a run taking everything adds up to exactly 200. Anyone who plays scores at least 1;
a run with no input scores 0 (`stdTotal`). Earning a feature never costs core: perfect landings, double flips and the
streak are all taken on routes that last the minute with no save (256 of the 260 stored witness routes take every
part's maximum).

### Core target

Clean time has a fixed maximum (the full minute, 120 half seconds), so no near-perfect median is needed. Why the core
changed: on flipRev 10 the core was time survived and a saved crash cost nothing, so even a weak player (who lasts 48 s
on fresh seeds and has a save or two) scored 117–131. Clean time takes 20 s off for each crash saved (the flipRev 8 idea
of the survival pause, twice as long and read straight off `saves`), and the core is 100 of the 200, so the
precision features carry the top: a good player lasts the minute cleanly but lands one sweet spot in eight.

### The PERFECT pop-up (display only)

A sweet landing shows a small **PERFECT** at the runner's head (below it on the roof), bold neon orange with a
white-hot top and an ember foot, a soft orange glow and three short drips sliding off its foot, rising a few pixels and
gone in about 0.6 s (`molten` pops in the shared success layer, `ARCADE_FX_MOLTEN_MS`; `textOnly`, so no burst). The
strip itself glows orange for a moment and cools (no star of light). Reduced motion: no rise, the drips held still;
reduced effects: no glow. It is display only and applies to **every revision with sweet spots** (flipRev 8–11): until
3 Nov 2026 the moment was a "SWEET!" pop with a small burst and a white star glint. Its sound is the existing
`flip.sweetLanding` cue (`sfx_spark_chime.mp3`, the library recording), unchanged. No haptics.

### HUD

flipRev 11 shows "FLOW n" (the current streak) in the rock above the cave's top-left, with "BEST n" beside it once the
run's best is ahead of the current streak. There are no star counts (no stars are dealt; the reveal's star tile shows only
when a run has stars). The reveal's tiles: Survived / Crashed at, Perfect landings n / 8, Best streak, Features.

### The bot

`scripts/arcade-skill-bands/bots/flip.ts` on flipRev 11 (`init.flow`): no trail is chased (there is nothing to take; no
gold stars are dealt, so none is planned for either), and double flips are tried until 8 (flipRev 8–10: until 6 combo
points). Everything else (reactions, timing, sweet-spot aims by level) is unchanged.

### Skill bands (median, p10–p90; paired seeds, server replay; `bun scripts/flip-rev11-bands.ts`)

Fresh seeds n = 10000–10059:

| Level | flipRev 10 | flipRev 11 | Seconds lived | Saves | Lasted the minute | Clean half seconds | Perfect landings | Double flips | Best streak |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Weak | 131 (11–166) | 41 (8–85) | 51.25 | 1.5 | 21 / 60 | 39 | 0 | 1 | 23.5 |
| Average | 167.5 (116–174) | 90.5 (45–128) | 60 | 0.5 | 54 / 60 | 80 | 0 | 2 | 38.5 |
| Good | 175 (169–181) | 139 (110–155) | 60 | 0 | 58 / 60 | 120 | 1 | 7 | 49 |
| Great | 182 (175–187) | 153.5 (136–162) | 60 | 0 | 58 / 60 | 120 | 2 | 8 | 51.5 |
| Near-perfect | 189 (184–193) | 170 (155–185) | 60 | 0 | 60 / 60 | 120 | 4 | 8 | 53 |
| Elite | 194 (191–197) | 185 (170–192) | 60 | 0 | 60 / 60 | 120 | 6 | 10 | 55 |
| Flawless | 198 (195–200) | 200 (200–200) | 60 | 0 | 60 / 60 | 120 | 8 | 10.5 | 56 |

Tuning seeds n = 0–59:

| Level | flipRev 10 | flipRev 11 | Seconds lived | Saves | Lasted the minute | Clean half seconds | Perfect landings | Double flips | Best streak |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Weak | 117 (54–163) | 42.5 (10–76) | 44.55 | 1 | 13 / 60 | 39 | 0 | 0 | 23 |
| Average | 166 (122–171) | 86 (38–129) | 60 | 1 | 53 / 60 | 80 | 0 | 2 | 32.5 |
| Good | 175 (169–181) | 140 (100–153) | 60 | 0 | 58 / 60 | 120 | 1 | 7 | 47 |
| Great | 182 (176–188) | 154.5 (105–170) | 60 | 0 | 55 / 60 | 120 | 2 | 8 | 50 |
| Near-perfect | 189 (185–193) | 164 (153–185) | 60 | 0 | 60 / 60 | 120 | 3.5 | 8 | 52 |
| Elite | 194 (191–197) | 185 (177–199) | 60 | 0 | 60 / 60 | 120 | 6 | 10 | 55 |
| Flawless | 198 (196–200) | 200 (198–200) | 60 | 0 | 60 / 60 | 120 | 8 | 11 | 55 |

The band tool agrees (`bun scripts/arcade-skill-bands.ts flip --rev=now --levels=all --from=10000 --seeds=60`):
41 / 91 / 139 / 154 / 170 / 185 / 200. Against the targets (weak 30–60, average about 90, good 120–140, great about
160, near-perfect about 175, elite 185–195, flawless 200): weak, average, good, elite and flawless sit in their bands;
great (153.5) and near-perfect (170) sit a few points under theirs. Every gap between levels is at least 15 points.

### Decisions and assumptions

- **Clean time, not time survived, for the core** (20 s a save). A saved crash is the only stumble the sim knows; it now
  costs time again, as on flipRev 8 (10 s then, as a pause). Weak players separate (a save or two, and an earlier crash).
- **The core is 100, the features 100.** The bots good and up all last the minute cleanly, so the top levels can only be
  told apart by precision: perfect landings carry 60 (the strongest separator: 1, 2, 4, 6, 8 for good → flawless).
- **Double flips full at 8** (2.5 each): good players make 7, great and near 8, so they pay the middle; at 5 they were
  full for everyone from good up and great sat on good.
- **Flow streak = the longest streak, full at 50 clean jumps** (0.4 each): the bots' medians run 23.5 (weak) → 56
  (flawless). Counted in jumps, as the brief asks: a player can raise it by flipping more on safe stretches, which is
  real (and risky) play, and it is capped at 20 points.
- **A mid-air save spoils that jump; a save on a surface spoils none** (the next take-off starts clean). Recounted
  independently from every bot run in flip-rev11-check.
- **The PERFECT pop on every revision with sweet spots**: display only, so the old SWEET! burst goes everywhere.
- **No new seeded content**: the streak and perfect landings are counted from the player's moves; the room-identity
  module (`scripts/room-identity/flip.ts`) lists every hazard, sweet spot, trail, zone and checkpoint as it comes into
  view and proves idle, random, weak and elite logs meet the same course.
- **Intro demo**: stopped until one is recorded on flipRev 11 (the intro shows its still).

Checks: flip-rev11-check (legacy runs recorded on unmodified main 63261010, `scripts/flip-rev11-legacy.ts`; the same
moves as flipRev 10; the rules; the streak recount; perfect witnesses at 200; 14 stored flipRev 11 runs,
`--record`), arcade-standard-check (the entry `scripts/arcade-standard/flip.ts`), arcade-room-identity-check, the
self-replay entry `flip/rev11`. Shots: `bun scripts/shots/roofbound-rev11-shots.ts --url=<origin>`
(`screenshots/arcade-batch-nov-2026/roofbound-rev11-midrun.png`, `roofbound-rev11-perfect.png`).

---

## flipRev 10 (29 Oct 2026)

Rooms dealt **flipRev 10** until 3 Nov 2026 (`FLIP_REV_STD` in `src/lib/arcade/flip.ts`). Play is flipRev 9's, which is flipRev 8's
exactly: the same course, hazards, features, checkpoints and speed zones, so a flipRev 8 or 9 log replays tick for
tick to the same checkpoints (arcade-phone-notes-check replays the 12 stored flipRev 8 runs on flipRev 10). Only the
scoring changes. States carry `std: 1`, outside the checkpoint checksum, as flipRev 9's `lift` was. flipRev 8 and 9
rounds score exactly as before.

### The parts (sum 200)

| Part | Max | How it counts |
|---|---|---|
| Time survived (core) | 150 | Half seconds lived, straight line: `stdLine(150, halfSeconds, 120)`, 1.25 each, 150 at the full minute. |
| Gold stars | 15 | 1.5 each of the course's 10 gold stars (every flipRev 8 course has exactly 10; flip-x200-check). |
| Star trails | 15 | 3.75 each of the 4 trails, for a full trail (all 5 of its stars). |
| Sweet landings | 10 | 1.25 each of the 8 sweet spots (once per spot). |
| Double flips | 10 | 1 for each double flip (the sim's `combos`: every flip within 8 ticks of landing with a hazard close by, chained or not; a speed zone does not double it), up to 10. |

Lasting the minute, checkpoints and speed zones pay nothing of their own; there is no rising scale or skill pay and no
penalty. Every part is floored (`stdLine`), so a run taking everything adds up to exactly 200. Anyone who plays scores
at least 1; a run with no input scores 0 (`stdTotal`).

### Decisions where the brief left a choice

- **Core basis: half seconds** (120 in the minute), as the earlier revisions counted, so the help reads "150 at 120".
- **No pause after a save.** On flipRev 8/9 the survival count paused 10 s after a checkpoint's save. On flipRev 10 time
  survived is literal: the save still happens (a second of shield, the run goes on), and every tick lived counts. The
  sim still counts `lost` (it is in the checksum), but this revision's score never reads it. Effect: a saved crash costs
  no core points, which raises the lower levels' finish rate (average 23 of 30 runs last the minute).
- **Double flips: count, not chain points.** One point per double flip up to 10. The stored witness routes show ten or
  more double flips sit on a route that lasts the minute on 252 of 260 courses, so earning them never means giving up
  core.
- **Gold stars split over a fixed 10** (FLIP_STARS); every course carries 10.

### Core target

The core has a fixed maximum (the full minute), so no near-perfect median is needed for it. Measured anyway: the
near-perfect level's median core units on flipRev 10 are 120 half seconds (30 of 30 runs last the minute).
`FLIP_V10_BAND_CURVE = bandCurve([0, 120], [0, 150])` (LIVE_BANDS' curve; the help's good run, 100 points of core, is
80 half seconds).

### Perfect run

`scripts/arcade-standard/flip.ts` replays the stored witness routes (`scripts/fixtures/flip-x200-witness.json.gz`,
one per tuning and fresh room seed) through the server on flipRev 10. 252 of 260 take every gold star, trail and sweet
spot with at least ten double flips; each scores 200 (and one end state through the sim's own score function). The
other 8 were planned for flipRev 8, where combo points could stand in for a missed sweet spot or fewer double flips
(4 miss one sweet spot, 4 have 8–9 double flips); they score 198–199 on flipRev 10.

### Skill bands after (flipRev 10, 30 seeds, `--rev=now --levels=all --jobs=1`)

| Level | Median | p10–p90 | Runs lasting the minute |
|---|---|---|---|
| Weak | 117 | 105–164 | 9 / 30 |
| Average | 167 | 42–171 | 23 / 30 |
| Good | 175 | 153–181 | 27 / 30 |
| Great | 184 | 177–188 | 29 / 30 |
| Near-perfect | 189 | 184–193 | 30 / 30 |
| Elite | 195 | 192–197 | 30 / 30 |
| Flawless | 198 | 195–200 | 30 / 30 |

Medians rise at every level, with 5–6 point gaps between near-perfect, elite and flawless. No bot change was needed.
Scores run high below the top because the core is time survived and saved crashes no longer cost time; the brief asks
for no number targets.
