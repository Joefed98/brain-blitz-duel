# Cue Ball (`pool`, was Speed Pool; `poolRev` 4, `poolRev` 3, 2 and 1 for stored rounds)

The Sports group (30 Oct 2026; shown as Cue Ball since 31 Oct). A full-width table, top down, 90 s since poolRev 4
(120 s before): pot your seven, spots or stripes (the deal's set since poolRev 4; spots before), then the black. Sim `src/lib/arcade/pool.ts`, art `pool.renderer.ts`, stage `src/puzzles/pool.tsx`, plumbing
`src/lib/duel/pool.ts` on the Sports kit.

## Play

- Walnut rails, mother-of-pearl sights, lamp pools on green cloth, corner pockets with chrome caps and angled jaws,
  half-round middle pockets with a chrome plate, a baulk line (no D), a blue chalk cube on the rail.
- Each seed deals a layout (no break): spots 1–7, four stripes as obstacles and the black, the cue ball on a seeded
  spot. Rooms deal layouts from a bank of layouts the shot search (`scripts/pool-oracle.ts`) cleared without a miss or
  a foul: poolRev 2 from `src/lib/duel/poolBankV2.server.ts` (`bun scripts/pool-bank.ts --rev=2`), poolRev 1's own
  bank `src/lib/duel/poolBank.server.ts` (`bun scripts/pool-bank.ts`) kept for stored rounds.
- Fouls −10: a stripe (or the black before the spots are down) hit first, or a stripe potted. Cue ball potted: 5 s off
  the clock and it comes back to a seeded spot. The black early ends the run with no black or speed points.

## poolRev 4 (3 Nov 2026; what rooms deal)

poolRev 3's table, input, physics and fouls, with:

- **Your set.** Each round's seed decides whether the player's seven are spots or stripes (`poolSetFor(seed, 4)`, a
  fixed hash of the seed, so everyone in a room has the same set; about half the seeds each). The sim keeps its ids
  (1–7 are always the player's seven, 9–15 the other set's four), so poolRev 3's physics and rules carry over exactly;
  on a stripes deal the art swaps them (`poolShownId`): your seven are drawn as stripes 9–15 and the other four as spots
  1–7. Fouls follow the set: the other set hit first (or the black while any of yours remain), one of theirs potted, or
  no ball touched, −10 each as before. The state carries `set` (outside the checksum: it comes from the seed).
- **Shown clearly:** a YOU'RE STRIPES (or SPOTS) banner over the table with your seven, from the start until the first
  shot (at most 4 s, `POOL_SET_BANNER_TICKS`), and the HUD's rack pill named STRIPES / SPOTS in gold with your seven
  (drawn upright on the desktop rotate mode's strip; the banner is not drawn on the turned table). The help, the intro,
  the reveal (“3 of 7 stripes”) and the core's label (“Your balls”) name the set.
- **90 s** (`POOL_RUN_S_V4`, `poolRunTicksFor`; the definition's clock 93 s). poolRev 3 and older rounds replay on the
  server at their own 120 s.
- **The fit to 90 s:** Speed is full by **69 s** (`POOL_FULL_BY_S_V4`, the near-perfect median finish on the poolRev 4
  bank in 90 s, 69.2 s over 30 layouts) and the core is full at **five** of your seven (`POOL_CORE_FULL_V4`, 28 a ball;
  140 at 5, 6 or 7): in 90 s the middle levels pot fewer, and the 6th and 7th still open the black, its speed and the run
  of pots. Black 10 and pots in a row 30 as before; 200 in all.
- **The bank:** `src/lib/duel/poolBankV4.server.ts`, all 60 poolRev 3 layouts (28 dealt as spots, 32 as stripes): poolRev
  4 rolls the balls exactly as poolRev 3, so each layout's poolRev 3 witness shots are played again in 90 s and kept when
  the run scores exactly 200 through the server's replay on the seed's own set **and** with the other set dealt
  (`poolGameFor(4, set)`; the same final state) (`bun scripts/pool-bank.ts --rev=4 [--check]`, witnesses
  `scripts/fixtures/pool-witness-v4.json`; the witnesses finish in 16–24 s).
- poolRev 3 runs replay unchanged: 16 bot runs recorded on main 6326101 (`scripts/fixtures/sports-nov3-legacy.json`)
  replay to the same score and final state, and every poolRev 3 witness still scores 200 (pool-check).

Measured (`bun scripts/arcade-skill-bands.ts pool --rev=now --levels=all --seeds=30`, the poolRev 4 bank):

| Level | Weak | Average | Good | Great | Near-perfect | Elite | Flawless |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Target | 30–60 | about 90 | 120–140 | about 160 | about 175 | 185–195 | 200 |
| poolRev 3 median (120 s) | 30 | 73 | 113 | 138 | 163 | 170 | 200 |
| poolRev 4 at 90 s, before the fit (7 balls, full by 60 s) | 20 | 58 | 95 | 125 | 154 | 170 | 200 |
| **poolRev 4 median (p10–p90)** | **28** (1–87) | **84** (17–140) | **130** (73–146) | **135** (118–160) | **160** (130–180) | **170** (150–190) | **200** (199–200) |
| Cleared / 30, median finish | 0 | 0 | 2, 83 s | 10, 80 s | 25, 69 s | 29, 54 s | 30, 24 s |
| Balls potted, fouls (medians) | 2, 1 | 3.5, 1 | 5, 1 | 7, 2 | 7, 1.5 | 7, 1 | 7, 0 |

Weak, average and good land in or next to their targets; great, near-perfect and elite stay 15–25 under. What holds
them down is not the clock but fouls (one or two a run at −10 each, which the brief keeps) and the run of pots (30,
broken by every miss): those levels already clear the table, so neither the core nor the speed part can lift them
further without changing a rule. Decisions for Joe below.

### Decisions for Joe (poolRev 4)

- **Core full at 5 of 7.** Full at 7 (as before) gives 20 / 58 / 95 / 125 / 154 / 170 / 200 at 90 s; full at 6 about
  23 / 69 / 111 / 130 / 157 / 170 / 200 (modelled from the same runs).
- **The top levels** need fewer fouls or a smaller penalty to reach their targets (e.g. a miss foul −5): not done,
  since the brief keeps −10.
- **The set's hash** gives a table both sets equally often; nothing else about the deal depends on it.



poolRev 2's input encoding, table, rules and parts, with:

- **Power:** the hardest pull leaves at 20 px a tick (`POOL_MAX_V_V3`, +25 % on poolRev 2's 16; the softest is
  unchanged), so a full-power shot rolls about a quarter further (a lone cue ball: 1,251 px against 1,006 px).
- **Spin, 1.75×:** follow / draw at the safe edge 91/256 of the cue ball's pre-impact speed (`POOL_V3_FOLLOW_MAX`; 52
  on poolRev 2) and side 77 (`POOL_V3_SIDE_MAX`; 44). Measured in pool-check: a straight hit with full draw pulls the cue
  ball back 61 px (21 on poolRev 2), full follow runs on 80 px (35), full side turns the angle off a cushion 16.7°
  (9.7°). The aim preview's cue-ball line bends 1.75× as far on poolRev 3 (display).
- **Fouls:** checked; a ball that isn't the player's hit first (a stripe, or the black while spots remain) and a stripe
  potted were already fouls. A shot whose cue ball touches **no ball at all** was not: on poolRev 3 it is a foul too,
  −10 like the others and breaking the run of pots. Nothing else about fouls changed. poolRev 2 and 1 keep a miss
  foul-free (stored rounds score as before).
- **Aiming** (the stage, every revision): the cue's angle was already a continuous float turned by the finger's own
  turn round the cue ball, one-for-one within 110 world px and finer further out (110 ÷ distance, never under 0.3),
  drawn every animation frame by ArcadeCanvasStage's loop. Two fixes: a drag now turns the cue from its first pixel (it
  used to wait for 6 px of movement, so the start of a slow drag was lost and the cue jumped into motion), and the shot
  is sent at the input's full ±4096 reach (was ±4000; about 0.014° a step, finer than any line drawn). The mouse takes
  the same pointer path, through the desktop rotate mode's turn. Frame strip: `bun scripts/shots/pool-aim-strip.ts`
  (`screenshots/cue-ball-aim-nov-2026/aim-full-circle.png`, 24 frames 15° apart, and `aim-fine-steps.png`, 0.25° steps).
- **Speed** full by **73 s** (`POOL_FULL_BY_S_V3`, the near-perfect median finish on the poolRev 3 bank, 72.9 s; the
  harder shots and the miss foul make clean clears slower for the bots).
- **The bank:** `src/lib/duel/poolBankV3.server.ts`, 60 layouts of 60 candidates re-proved by the shot search on
  poolRev 3's physics (`bun scripts/pool-bank.ts --rev=3`, witnesses `scripts/fixtures/pool-witness-v3.json`, each
  exactly 200 through the server replay with no foul, scratch or miss).
- poolRev 2 runs replay unchanged: 16 bot runs recorded on main (`scripts/fixtures/tuning-nov1-legacy.json`) replay to
  the same score and final state, and every poolRev 2 witness still scores 200 (pool-check).

Measured (`bun scripts/arcade-skill-bands.ts pool --rev=now --levels=all --seeds=30`, the poolRev 3 bank):

| Level | Weak | Average | Good | Great | Near-perfect | Elite | Flawless |
| --- | --- | --- | --- | --- | --- | --- | --- |
| poolRev 2 median (p10–p90) | 65 (20–92) | 88 (50–136) | 113 (74–142) | 148 (115–172) | 174 (140–190) | 170 (150–195) | 200 (190–200) |
| **poolRev 3 median (p10–p90)** | **30** (1–70) | **73** (29–116) | **113** (75–158) | **138** (100–166) | **163** (147–180) | **170** (150–190) | **200** (199–200) |

Weak and average lose most: their wild shots now often touch nothing (a foul) and the harder top speed scatters the
table more. Near-perfect and elite now rise in order (poolRev 2 had elite under near-perfect).

## poolRev 2 (31 Oct 2026, Joe's notes)

**Controls** (all presentation but the spin):

- **The cue** lies behind the cue ball the whole time you aim (maple shaft, gold joint, wrapped butt, a blue chalked
  tip), with the ghost ball, the object ball's short line and the cue ball's faint path as before. Each new shot starts
  pointed at the nearest ball still to play.
- **Dragging anywhere on the table turns the cue round the ball**: the cue turns by the finger's own turn round the
  cue ball, scaled down further out (one-for-one within 110 world px, then 110 ÷ distance, never under 0.3), so a drag
  far from the ball is fine control. A quick tap (under 6 px, 300 ms) points the cue straight at the tapped spot.
- **The power meter** at the bottom (`drawPoolPowerPanel`): a framed bar of 20 segments blending green → yellow →
  orange → red, tick marks above and below (longer every fifth), the cue lying inside it. Pull the cue back (drag left
  on the meter) to set the power, let go to shoot; the segments light as the tip passes them, and the cue on the table
  draws back from the ball with the pull. A pull under 4 % cancels. The table stays full width.
- **Spin**: the cue-ball button, bottom right, opens a large cue ball (`SpinPicker`); place the red dot anywhere inside
  the dashed safe circle (tap or drag), Centre resets it, Done or a tap outside closes it. The button shows the dot.
- **Potted balls** roll on into the pocket's mouth and drop away, shrinking and darkening into the hole over 18 ticks,
  drawn from the drop tick the sim keeps on poolRev 2 (`downAt`, outside the checksum).

**Input encoding** (one event per shot, kind 1, `POOL_INPUT_RANGES_V2`): `a`, `b` the aim direction (±4096); `c` the
power alone, 1…1000; `d` the spin dot, `(x + 100) × 201 + (y + 100)` with x the side (right +) and y top (+) or back
(−), each −100…100 and held inside the safe circle x² + y² ≤ 100² in integer maths (`poolSpinClamp`, `poolSpin2Code`,
`poolSpin2Of`; any `d` in 0…40,400 decodes to a dot inside the circle). poolRev 1 keeps `c = power × 25 + spin`
(a 5 × 5 code) and `d` 0; a poolRev 1 round still in play when the stamp lands sends its nearest 5 × 5 spin.

**Spin physics** (poolRev 2 only, `PoolSpin.fine`): follow or draw at the first contact adds `y × 52 ÷ 25,600` of the
cue ball's pre-impact velocity (`POOL_V2_FOLLOW_MAX` 52/256 at the edge: poolRev 1's strongest), and side bends the cue
ball's first two cushion bounces by `x × 44 ÷ 100` 256ths (`POOL_V2_SIDE_MAX`, again poolRev 1's strongest). Both scale
continuously with the dot; a dot at y = 50 plays exactly as poolRev 1's half follow. Everything else (the table,
friction, collisions, the rules) is poolRev 1's.

**Proof**: the bank, 60 layouts of 60 candidates (no drops), each with a witness (`scripts/fixtures/pool-witness-v2.json`,
poolRev 2's input) found by the shot search sweeping the dot (centre, follow and draw at 50 and 100, and the two
diagonals ±70/±70) and scoring exactly 200 through the server replay on poolRev 2 (`replayPoolRun(seed, raw, 2)`);
`bun scripts/pool-bank.ts --rev=2 --check` rebuilds it byte for byte (`--jobs` splits the search; the result does not
depend on it).

## Parts (together 200)

| Part | Max | How |
| --- | --- | --- |
| Spots (core) | 140 | 20 a spot potted |
| Black | 10 | the black after every spot (ends the run) |
| Pots in a row | 30 | 5 for each pot straight after another pot, full at 6 |
| Speed | 20 | the black potted: full by **58 s** on poolRev 2 (**67 s** on poolRev 1), 0 at the buzzer |

Fouls cost 10 each; any played run scores at least 1, no input 0. `poolStdParts` scores both revisions;
`POOL_STD_SPEC` is the dealt revision's (`poolStdSpecFor(rev)`, Speed's full-by time `poolFullByS(rev)`).

## Measured on poolRev 2 (30 poolRev 2 bank layouts)

`bun scripts/arcade-skill-bands.ts pool --rev=now --levels=all --seeds=30` with the bot placing the dot (7 units' error
off the chosen spot below flawless) on poolRev 2's input. Speed's full-by time is the near-perfect median finish
(57.6 s; the table's figures are on the 58 s line).

| Level | Median (min–max) | Cleared | Median finish |
| --- | --- | --- | --- |
| Weak | 65 (20–115) | 0/30 | – |
| Average | 87.5 (1–169) | 1/30 | 105.8 s |
| Good | 112.5 (40–170) | 5/30 | 87.0 s |
| Great | 147.5 (65–183) | 24/30 | 93.0 s |
| Near-perfect | 173.5 (133–195) | 29/30 | 57.6 s |
| Elite | 170 (130–200) | 30/30 | 50.6 s |
| Flawless | 200 (190–200) | 30/30 | 22.4 s |

## Measured on poolRev 1 (30 bank layouts)

Speed's full-by time is the near-perfect median finish (66.6 s).

| Level | Median (min–max) | Cleared | Median finish |
| --- | --- | --- | --- |
| Weak | 42.5 (1–135) | 0/30 | – |
| Average | 90 (20–135) | 0/30 | – |
| Good | 123.5 (40–166) | 9/30 | 98.4 s |
| Great | 140.5 (90–185) | 23/30 | 96.3 s |
| Near-perfect | 171 (129–200) | 30/30 | 66.6 s |
| Elite | 175 (130–200) | 28/30 | 52.4 s |
| Flawless | 200 (175–200) | 30/30 | 22.9 s |

## Proofs

pool-check (both banks' witnesses at 200 through the server replay on their own revision, an unstamped round replays
as poolRev 1, rooms deal poolRev 2 from its bank, the spin encoding and safe circle, follow, draw and side scaling with
the dot, the rules on both revisions, drop ticks on poolRev 2 only), arcade-standard-check's entry (poolRev 2's parts,
every poolRev 2 witness 200, poolRev 1's parts and witnesses unchanged), arcade-self-replay's `pool` entries.
