# Tilt on the arcade scoring standard: tiltRev 10 (29 Oct 2026), tiltRev 11 and tiltRev 12 (3 Nov 2026)

Rooms and practice deal `tiltRev 12` since 3 Nov 2026 (the next section); the tiltRev 11 and tiltRev 10 sections below
describe the stamps before it, which still replay and score exactly as written.

## tiltRev 12 (3 Nov 2026): bigger marbles, cups and keys; walnut and brass

Joe's audit of Tilt (iPhone 11): the marbles, cups and keys read small; Tilt looked like Ball Tracker's light wood; the
HUD said "Over par" at a maze's start. Rooms and practice deal `tiltRev 12` (`TILT_REV_BIG`, one above 11).

### Play

tiltRev 11's four mazes, pars and rules exactly (the same carve, holes, keys and gates, ice, cups, amber marble and pars
from the same seed streams; the same physics, falls and 90 s), with bigger pieces (`tiltMazesB`):

| Piece | tiltRev 11 | tiltRev 12 |
| --- | --- | --- |
| Marble radius, mazes 1–3 (30 px cells) | 28 % of a cell, 8.4 px | `TILT_B_BALL` 41 %, 12.3 px (1.46×) |
| Marble radius, maze 4 (16 px cells) | 34 %, 5.4 px | `TILT_B_BALL4` 45 %, 7.2 px (1.32×) |
| Key pickup (marble centre to the key cell's centre, each axis) | cs / 3, 10 px | `TILT_B_KEY_REACH` 45 %, 13.5 px (1.35×) |
| Cup radius (display) | min(0.55 cell, 1.75 × marble), 14.7 px | `TILT_B_CUP` 160 % of the marble, 19.7 px (1.34×) |

The marble is the collision radius and is drawn at it; every radius stays under half a cell, so every passage the carve
opened is still passable. The key is drawn to its reach (`TILT_B_KEY_SIZE` 0.54 of a cell: its outline reaches about
45 % of a cell from its centre). A marble is home, as before, once its centre leaves the maze through its exit; the
bigger cup sits 0.6 of its radius beyond the exit edge, on a disc rim 26 px wide (16 before, display only). States add
`big: 1` (after tiltRev 11's markers in the checkpoint checksum, so every tiltRev 11 checksum is unchanged); `Maze`
adds `keyReach` (tiltRev 12 only; older mazes take cs / 3 in the same line of `stepX`).

### Parts (200 in all, tiltRev 11's)

| Part | Max | Rule |
| --- | --- | --- |
| Core: mazes | 140 | 35 a finished maze (15 + its full 20 for the way), up to 20 for progress in the maze being played. A straight line on the way covered. |
| Par | 24 | 6 for each maze finished within its par (`tiltParT`, from the maze alone). |
| Clean run | 12 | 3 for each maze finished before the run's first fall. |
| Speed | 24 | All four done: full by 60 s, evenly to 0 at the buzzer. |

**Core target:** a fixed maximum (all four mazes = 140), as tiltRev 10 and 11; no skill-band target needed. The parts'
"full at" figures were left as tiltRev 11's (see the what-if below).

### The deal: 200 proved on every seed rooms can deal

`src/lib/duel/tiltDealV12.server.ts` (`TILT_DEAL_V12`) lists every tiltRev 8 bank seed (TILT_BANK, in its order) whose
oracle run (`scripts/tilt-oracle.ts --rev=12`: every maze within its par, no fall) replays through `replayTiltRun` on
tiltRev 12 to exactly 200 with every part full. **347 of the 389 candidates kept, 42 dropped** (39 at 194 — one maze
over its par with the bigger marble —, one at 199, one at 188, two at 132). Witnesses (each kept seed's log):
`scripts/fixtures/tilt-deal-v12-witness.json.gz`. `bun scripts/tilt-deal.ts` builds both (4 workers, ~25 min);
`--check` replays every witness to 200 and rebuilds the deal file from the witnesses byte for byte (~1 min);
`--check --full` also re-runs the oracle on every candidate and compares the file and the witnesses byte for byte.
`generateTilt` deals `TILT_DEAL_V12` on tiltRev 12.

### Skill bands

`bun scripts/tilt-rev11-bands.ts --rev=11|12 [--deal] --seeds=40 --from=10000` (the skill-band bots,
`scripts/arcade-skill-bands/bots/tilt.ts`, unchanged; every run replayed through the server). Median score:

| Revision, seeds | Weak | Average | Good | Great | Near | Elite | Flawless |
| --- | --- | --- | --- | --- | --- | --- | --- |
| tiltRev 11 (before), bank seeds 10000–10039 | 53.5 | 87 | 135 | 139.5 | 183.5 | 185 | 194 |
| tiltRev 12, the same bank seeds (paired) | 44.5 | 88 | 128.5 | 136 | 177 | 183.5 | 189 |
| tiltRev 12, deal seeds 10000–10039 (what rooms deal) | 43 | 89 | 130 | 161 | 181.5 | 185.5 | 189 |

Targets: weak 30–60, average about 90, good 120–140, great about 160, near about 175, elite 185–195, flawless 200. On
the dealt seeds every level but flawless is in or at its target band; flawless is the band tool's flawless bot (189:
it usually misses one par and finishes near 63 s); the oracle scores 200 on every deal seed. The bigger marbles cost the
bots a little time at the corners (median maze time ÷ par up 2–10 points at most levels), so the pars bite slightly
more. What-if (same runs, score only; par scale %, speed full by s): 100/60 (as dealt) 43 / 89 / 130 / 161 / 181.5 /
185.5 / 189; 110/60 43 / 90.5 / 130 / 161 / 182.5 / 189 / 191.5; 100/64 43 / 89 / 130 / 162 / 184 / 188 / 192; 110/64
43 / 90.5 / 130 / 162 / 185 / 192 / 193.5. Each lifts the top three together and narrows near → elite → flawless, so
tiltRev 11's parts stay.

### Display (tiltRev 12 only; `state.big`)

- **Walnut and brass** in place of Ball Tracker's light wood: a dark walnut table (`drawWalnutTable`, the screen fill
  `tiltWalnutFill`, the stage's edge `WALNUT_TABLE`), a walnut disc (`paintWalnutDisc`), a brass rim (`drawBrassBed`) and
  brass wall strips on the same 3 px footprint (`drawBrassStrips`).
- **HUD in the shared pills** (`drawHudPill` / `drawHudPillRow`, `hudPill.renderer.ts`): "Maze 1 / 4" first, then
  "Par 8 s" counting down, then a gold "Clean" while no marble has fallen; at most two rows, no "·". **"Over par" only
  once the par has passed** (`tiltOverParT`: ticks past the par, 0 while within it; a missing par shows no "Over
  par"). tiltRev 11's HUD showed "Over par" whenever the seconds left read 0, which includes the tick at exactly the par
  (still a par met, `took <= par`). The start-of-maze case Joe saw was not reproduced in the sim: every maze starts with
  its full par on the oracle, bot and random runs (tilt-rev12-check proves it tick by tick); the new HUD reads the ticks
  past the par directly instead. tiltRev 11's HUD is unchanged (tilt-rev11-check pins its source).

### Proof

`tilt-rev12-check` (~40 s): the wiring (deal, LIVE_BANDS on tiltRev 11's line `TILT_V12_BAND_CURVE`, parts, help, the
standard module's perfect runs, the intro demo stopped until recorded on 12, the renderer's walnut, cups, keys and HUD);
34 runs on tiltRev 11 (24, every level), 10, 9, 8, 4 and unstamped, recorded on the tree before tiltRev 12
(`scripts/fixtures/tilt-rev12-legacy.json.gz`, `bun scripts/tilt-rev12-record.ts --legacy`), replaying to the same
score, flag, final state and checkpoints; tiltRev 12's mazes are tiltRev 11's but for the marble and key reach; a
marble 40 % of a cell from a key takes it on 12 and not on 11; the parts and the par countdown on bot and random runs;
all 347 deal witnesses at 200 with every part full and the deal file rebuilt byte for byte; 19 stored tiltRev 12 runs
(`scripts/fixtures/tilt-rev12-runs.json.gz`, `--new`; 4 oracle runs at 200); rooms identical (the schedule names the
marble and the key reach); the reveal. Also changed: `liveBands.ts`, `arcade.server.ts`, `introDemo.functions.ts`, the
standard module (`scripts/arcade-standard/tilt.ts`, its roster line), the room-identity module, one self-replay entry
(`tilt/big`, appended), one replay-runs fixture run (`--add=tilt`), the practice stamps; checks that pinned "rooms deal
tiltRev 11" now expect 12. **The intro demo needs recording on tiltRev 12.** The tile image still shows the light wood
(re-export with `bun scripts/shots/tile-scenes.ts tilt` and `bun scripts/reveal-palette.ts` to follow).

## tiltRev 10 (29 Oct 2026)

Batch A of the arcade scoring standard. Rooms and practice deal `tiltRev 10` (was 9), from the same oracle-proved
bank (`src/lib/duel/tiltBank.server.ts`). Every older stamp replays and scores exactly as before
(`scripts/fixtures/tilt-standard-legacy.json.gz`, recorded on main 73f6bb7).

## Parts (200 in all)

| Part | Max | Rule |
| --- | --- | --- |
| Core: mazes | 140 | 35 for each finished maze (30 for finishing it, plus its full 5), and in the maze being played up to 5 for how close you got to its exit: `trunc(5 × best progress)`, progress being the share of the start-to-exit path covered (path distance in the maze, the best reached, averaged over both marbles in maze 3). A straight line, no curve. |
| All four mazes | 10 | Flat, once all four mazes are done. |
| Speed | 20 | Only when all four are done: full if done by 75 s, then falling evenly to 0 at the 90 s buzzer (`trunc(20 × (5400 − end tick) ÷ 900)`). |
| Gold stars | 30 | Split evenly over the gold stars of mazes 1–3: `trunc(30 × taken ÷ on offer)`; every dealt seed has one a maze, so 10 each. Maze 4 has none. |

Holes cost time only (a fall puts the marble back at its start for 0.75 s, as tiltRev 8 and 9). Any input scores at
least 1; no input scores 0. Stars never change the core. Code: `tiltStdParts`, `scoreS`, `tiltStdBandParts` in
`src/lib/arcade/tilt.ts`. The standard's module: `scripts/arcade-standard/tilt.ts`.

**Core target:** the core has a fixed maximum (all four mazes = 140), so no skill-band target was needed. Near-perfect
bots reach it on most seeds (p10 124).

## Gameplay changes (tiltRev 10 only)

- **Mazes 1–3** are tiltRev 9's exactly (the same carve, holes, keys and gates, ice, cups, amber marble and gold
  stars from the same seed streams) **less the quick stars** (the timed windows and the par pace are gone: the
  standard pays no rising scale or skill points).
- **Maze 4** (`buildMazeS`): a smaller, tighter disc, 19 cells across at 16 px a cell (maze 3: 17 at 30 px), the
  same growing-tree carve, cup at the rim cell whose route is nearest 56 cells, the blue marble only (radius 34 % of
  a cell, 5.4 px), no holes, stars, keys, gates or ice. It is carved from the seed on its own PRNG stream
  (`seed ^ 0x4d5a0004`), so mazes 1–3 are untouched and every player meets the same maze.
- **Solvability (assumption: generated and proved in the sim, not banked).** The carve is a spanning tree of the
  disc's cells, so the cup is always reachable; `tiltSeedReachableS` proves it, and tilt-standard-check runs it on
  all 389 bank seeds. The oracle (`scripts/tilt-oracle.ts --rev=10`) plays the first bank seeds to 200 through the
  server's replay (all four mazes in 41–51 s with every star); four of those runs are stored and replayed.
- **Look:** under tiltRev 9's fixed camera the fourth disc (336 px across) draws at full size, smaller on screen than
  maze 3's (about 417 px). The HUD and the success layer count the state's own mazes ("Maze 4 / 4", "ALL 4 MAZES!").
  Arcade bounds rule: the marble is drawn at its collision radius; the wall strips are 3 px wide on the cell edge the
  marble stops at (1.5 px either side).
- The checkpoint checksum adds the `std: 1` marker on tiltRev 10 states.

## Skill bands (`bun scripts/arcade-skill-bands.ts tilt --rev=now --levels=all --seeds=30 --jobs=4`)

Median (p10–p90), bank seeds 0–29:

| Revision | Weak | Average | Good | Great | Near | Elite | Flawless |
| --- | --- | --- | --- | --- | --- | --- | --- |
| tiltRev 9 (before, main) | 81 (16–124) | 101 (37–149) | 134 (55–176) | 163 (57–186) | 179 (101–187) | 180 (158–190) | 186 (153–193) |
| tiltRev 10 (after) | 70 (12–90) | 83 (34–130) | 110 (36–172) | 136 (77–191) | 184 (124–200) | 190 (139–200) | 200 (136–200) |

The medians rise at every level, with gaps at the top (184 → 190 → 200) that tiltRev 9 bunched (179 / 180 / 186).

## Bot (tiltRev 10 states only; older stamps play the old bot)

`scripts/arcade-skill-bands/bots/tilt.ts`, in `starAffordable` (the Oct 2026 fixes path): the player judges a star's
detour with the maze's gate open (with no quick stars first, the amber marble is often steered while the blue
marble's gate is still shut, which read every trip as endless and dropped maze 3's star), counts their rolling pace
apart from the time spent reading each maze (and adds that reading time for the mazes to come), and weighs the fourth
maze's small cells by their size. No extra random draws.

## Also changed

`liveBands.ts` (tiltRev 10 on `TILT_V10_BAND_CURVE`, the core's straight line), the "?" help and intro (the parts and
their maximums, 140 + 10 + 20 + 30 = 200), the reveal (band lines from `tiltStdBandParts`), the round summary's maze
count, the intro demo (stopped until one is recorded on tiltRev 10), the room-identity module (tiltRev 10), one
self-replay entry (`tilt/std`, appended) and one replay-runs fixture run (appended with `--add=tilt`). Checks that
pinned "rooms deal tiltRev 9" now expect 10. Practice stamps need regenerating (`bun scripts/practice-stamps.ts`).

## tiltRev 11 (3 Nov 2026): par times and a clean run, no gold stars

Joe's brief: the gold stars go; par times and a clean run come in; 200 exactly. Rooms and practice deal `tiltRev 11`
(one above 10) from the same bank (`tiltBank.server.ts`). Every older stamp, tiltRev 10 included, replays and scores
exactly as before (`scripts/fixtures/tilt-rev11-legacy.json.gz`: 53 runs on unstamped and tiltRev 2–10, 21 of them on
tiltRev 10 at every skill level, recorded on unmodified main 63261010 by `bun scripts/tilt-rev11-record.ts --legacy`;
`tilt-rev11-check` replays each to the same score, flag, final state and checkpoints).

### Play

tiltRev 10's four mazes exactly (the same carve, holes, keys and gates, ice, cups, amber marble and fourth maze from the
same seed streams; the same physics, falls and 90 s) **less the gold stars**: none is dealt (`tiltMazesP` strips mazes
1–3's stars), drawn or scored. The same input log moves the marbles identically on tiltRev 10 and 11 tick for tick
(tilt-rev11-check proves it on bot and random logs). States add `parClean: 1` (beside tiltRev 10's `std: 1`) and the
counters `parsMet`, `cleanTo` (both in the checkpoint checksum, after tiltRev 10's marker, so every tiltRev 10 checksum is
unchanged) and `mazeTicks` (each finished maze's time, read by the reveal and tools).

### Parts (200 in all)

| Part | Max | Rule |
| --- | --- | --- |
| Core: mazes | 140 | 35 for each finished maze (15 for finishing it, plus its full 20 for the way), and in the maze being played up to 20 for how close the marbles got to its exit: `trunc(20 × best progress)`, progress being tiltRev 10's (path distance, best reached, averaged over both marbles in maze 3). A straight line on the way covered, no curve. |
| Par | 24 | 6 for each maze finished within its par (from the maze's start to every marble home). |
| Clean run | 12 | 3 for each maze finished before the run's first fall into a black hole: all four with no fall is the whole 12; after a fall the mazes already done keep theirs and nothing more is added. |
| Speed | 24 | Only when all four are done: full if done by 60 s, then falling evenly to 0 at the 90 s buzzer. |

tiltRev 10's flat "all four mazes" 10 is folded into speed (the tuning found it only lifted the levels that already
finish). No part costs another: par and the clean run never change the core (a fall still costs only time and the clean
credit still to come). No input scores 0; any input at least 1 (`stdFinal`). Code: `tiltParParts`, `tiltParScore`,
`tiltParBandParts` in `src/lib/arcade/tilt.ts`; the standard module `scripts/arcade-standard/tilt.ts` now names tiltRev 11.

### The par rule

Each maze's par is fixed from the maze alone (`tiltParT`), so every player in a room races the same par: tiltRev 8's par
walk without its quick and gold stars, that is the shortest walk from the blue start over the maze's key(s) to the blue
cup, then the amber marble's own route in maze 3. In ticks: 90 (reading the maze) + 8 a cell of the walk + 6 a turn of it
+ 14 a cell of the amber route, cell times scaled by the maze's cell size (÷ 30 px, so maze 4's 16 px cells count about
half), all × 150 %. Integer only. Over the 389 bank seeds: maze 1 9.1–18.4 s (median 14.8), maze 2 9.9–19.8 s (16.3),
maze 3 17.9–40.3 s (22.8), maze 4 8.2–15.9 s (13.3); all four 53–82 s (median 66). The HUD counts down the seconds to
the current maze's par ("Par 12 s", "Over par" once past it) and shows "Clean" until the first fall; a maze finished
within par pops UNDER PAR! (the success layer's last moment, appended) with the star chime a fifth higher.

The oracle (`scripts/tilt-oracle.ts --rev=11`, which on this stamp treats a fall of either marble as a dead branch) beat
every par on the first 30 bank seeds' 120 mazes at this scale (worst 1.48 × the unscaled walk time, one maze 4); its
runs on four bank seeds are stored (`scripts/fixtures/tilt-rev11-runs.json.gz`) and replay to 200 with every part full.
On a fresh seed a par could in principle sit under the oracle's time (200 is not proved on every seed; Joe's simplified
bar does not ask it).

### Core target

The core has a fixed maximum (all four mazes = 140), so no skill-band target was needed. The progress share was raised
from 5 to 20 of each maze's 35 so the core is mostly a straight line on the way covered: runs that stop in the same maze
are told apart by how far into it they got (great players often end deep in maze 4, good ones early in it).

### Skill bands

`bun scripts/arcade-skill-bands.ts tilt --rev=now --levels=all --seeds=40 --from=10000 --jobs=3` on the fresh bank seeds
(n = 10000–10039, the bank's 61st seed on; never used for tuning), before on main (tiltRev 10) and after (tiltRev 11).
Median (p10–p90):

| Revision | Weak | Average | Good | Great | Near | Elite | Flawless |
| --- | --- | --- | --- | --- | --- | --- | --- |
| tiltRev 10 (before) | 54 (1–105) | 83 (10–130) | 106 (37–180) | 128 (45–190) | 177 (102–200) | 186 (125–200) | 194 (137–200) |
| tiltRev 11 (after) | 54 (6–96) | 87 (12–131) | 135 (44–179) | 140 (91–192) | 184 (98–194) | 185 (131–200) | 194 (170–200) |

Targets: weak 30–60, average about 90, good 120–140, great about 160, near about 175, elite 185–195, flawless 200.
Tuned on the tuning seeds n = 0–59 (`bun scripts/tilt-rev11-bands.ts --from=0 --seeds=60 --dump=<file>`, then the
constants tried offline on the dumped maze times), where tiltRev 11 gives 65.5 / 92 / 126.5 / 158.5 / 178.5 / 188.5 /
194. Weak, average, good, near and elite land in or near their targets on the fresh seeds. Great sits low and close to
good on the fresh seeds: great finishes maze 4 on only 19 of the 40 (near 28, elite 29), so its median falls on the
boundary between a three-maze run (about 130) and a four-maze one (about 175); near and elite finish in much the same
time (68 s and 66 s), so the gap between them is small. Both are bot properties no fixed-amount split moved (every split
tried kept great within 5 of good on these seeds). Flawless is the band tool's flawless bot (194); the oracle scores 200.

Bots: `scripts/arcade-skill-bands/bots/tilt.ts` is unchanged. It reads each maze's stars from the maze, so on tiltRev 11
(no stars) it never detours for one; older stamps play exactly as before.

Per-level parts on the fresh seeds (`bun scripts/tilt-rev11-bands.ts --from=10000 --seeds=40`): pars met 0 / 0 / 2 / 2 /
3 / 3 / 3 (median, weak → flawless); bots almost never fall (clean credit follows the mazes finished), so the clean run
separates players on the phone more than it does here.

### Also changed

`liveBands.ts` (tiltRev 11 on `TILT_V11_BAND_CURVE`, the core's straight line 0 → 140), the "?" help and HOW lines (par and
the clean run in place of the gold stars), the intro score line, the reveal (band lines from `tiltParBandParts`; tiles
Mazes, Under par, Falls, Time), grading's stored `parsMet` and `cleanMazes`, the HUD and success layer, the intro demo
(stopped until one is recorded on tiltRev 11), the room-identity module (tiltRev 11), one self-replay entry
(`tilt/rev11`, appended), `scripts/arcade-standard/tilt.ts` and the roster (tiltRev 11). Checks that pinned "rooms deal
tiltRev 10" (and the help naming gold stars) now expect tiltRev 11. Shot: `bun scripts/shots/tilt-rev11-shots.ts`
(`screenshots/arcade-batch-nov-2026/tilt-rev11-midrun.png`). After merging: one replay-runs fixture run
(`bun scripts/replay-fixtures.ts --add=tilt`) and the practice stamps (`bun scripts/practice-stamps.ts`).
