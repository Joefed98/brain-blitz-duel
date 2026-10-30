# Tilt on the arcade scoring standard: tiltRev 10 (29 Oct 2026)

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
