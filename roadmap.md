# Roadmap

## Gravity Maze, Don't Break the Chain, Intruder Detection

- [x] Shared rules: `gravity.ts` (both balls tilt together, each stops on a wall, the edge or the other ball), `chain.ts` (three-step cycle, replay), `intruder.ts` (tap grading, close colour pairs)
- [x] Server generation: joint-state BFS minimum 6–10 tilts with a ball-blocks-ball tilt in the shortest route; chain layouts with two valid and four invalid nodes at every step; three escalating grids storing the changed cell and change kind
- [x] Secrets: gravity `minMoves`/`solution`, intruder `answers`; chain has nothing to hide
- [x] Server verification in `grade.ts` — tilts, taps and grid taps are all replayed, never trusted
- [x] Scoring, standings summary lines, correct-answer lines, GOAL / HOW / SCORE intros
- [x] Play, intro example and reveal screens with the shared hit-test and no-scroll layouts
- [x] Registry entries: all three core, none retired; compact timer slots
- [x] Proof script `scripts/gravity-chain-intruder-check.ts` — 40 rounds each, all pass
- [x] Follow-up fixes: explicit unique-node chain progression, easier 4×4/4×4/5×5 Intruder rounds with four colours and three shapes, and measured Gravity board space above 52px controls
- [x] Chain crossing rules and searched non-crossing solution with crossing decoys; Intruder eased to 3×3/3×3/4×4; both reveals compacted

## Five-game tuning

- [x] Safe Cracker readability; seven-wire Bomb with switch and six effective rules; eight-tube challenge; escalating 3×3 Intruder; Chain limited to 1–8 routes with two traps
- [x] Nine tunings: Target uses five+ tiles, multi-rule Number Sequence, spread Chain layout with Undo/Reset, four-gem Laser (60s), 12x12 Ice Slide (75s), 10x10 Gravity Maze (90s), Tower 90s, ten-tube partial-pour Sort the Tubes, five-clue Safe Cracker
- [x] Six tunings: Sort the Tubes 75s, Tower 60s, Laser 30s, Unblock 7x7 with a 120-layout solver-built bank (15-22 moves), Spot the Difference full 8x6 grids at 30s, Number Sequence 20s

- Added three new types: Nonogram (logic, 60s), Pair Match (attention, 45s) and Colour Flood (logic, 45s) — server generation, private answers, replay-based grading, reveals, summaries and intros. Proof script: scripts/nonogram-pair-flood-check.ts.

- Added three new types: One-Stroke (logic, 45s), Sliding Tiles (pattern, 60s) and Rotating Rings (pattern, 45s) — server generation, private answers, replay-based grading, reveals, summaries and intros. Proof script: scripts/stroke-tiles-rings-check.ts.

- [x] Nonogram 9×9 full-grid rebuild and four-ring Rotating Rings controls/generation.
- [x] Five-type tuning: Nonogram 7×7, Colour Flood 12×12, deferred Bomb DEFUSE, Groups retired, and corrected full-width Rings.

## Scoring amendments (21 types)

- [x] Wordsmith/Word Hunt score their word points directly; Word Ladder, Word Match, Target, Number Sequence, Equation, Maze Dash, Sort the Tubes, Spot the Difference, Sliding Tiles, Lights Out, Pipes, Number Hunt, Count Up, Unblock, Ice Slide, Gravity Maze, Laser and Symbol Scan rescored with progress-based partial credit; SCORE lines and word reveals updated.

## Hover integrity

- [x] Integer-only shared constants, 300-tick client/server state checksums, first-desync reporting, and 200-run path equivalence proof.

## Arcade category

- [x] New "arcade" category with a host toggle (on by default, remembered per host, one arcade round in rounds 2-6, none when off); Hover moved into it.
- [x] Added Swerve and Skyline on the shared deterministic engine: seeded integer fixed-point sims, sim-tick input logs, server replay scoring, 300-tick checkpoints, client-lag handling, fixed instructions/reveals/summaries. Proof script: scripts/arcade-check.ts.

## Arcade inputs, Bin Toss and Bullseye

- [x] Generalised input events ({ t, k, a, b, c, d }, declared per-game ranges, 2000 cap)
- [x] Bin Toss: ten flicked throws, per-throw wind, growing distance, time bonus
- [x] Bullseye: ten aimed arrows, shrinking target, wind drift, half-total scoring

## Matchup

- [x] Matchup: 7x7 six-symbol swap game on the shared engine (k = 3 swap events)
- [x] Fixed per-column refill queues, deterministic reshuffle, cascade scoring, total / 4
- [x] 200-run client/server identity proof with valid and invalid swaps

## Five-game tuning

- [x] Pair Match 5x4 layout/scoring/text
- [x] Swerve speed ramp and coin collection rendering
- [x] Bin Toss drag capture and wind layout
- [x] Bullseye HUD/ring labels/bow aiming render
- [x] Matchup next strip, animation semantics, specials
- [x] Re-run deterministic proof scripts

## Six-game tuning (done)

- [x] Number Sequence: 45-second limit, speed bonus and text scaled to it
- [x] Hover: 666 start, +31 per gate, cap 1331; total gates recomputed
- [x] Swerve: five lanes, 14 px/tick slide, 1–3 blocked lanes, ≤2-step passability, speed +20 per coin
- [x] Matchup: strip aligned to the board columns, score = raw ÷ 8
- [x] Bin Toss: flick launch from the last 80 ms, no preview arc, flight trail
- [x] Bullseye: ring values 10…5, score × 1.5, flick from the bow, no reticle

## Flick recalibration (done)

- [x] Reference swipe 1300 px/s, clamped 250–2200 px/s, square-root response from a shared integer table
- [x] Bin Toss: 1300 px/s at 60° lands in the bin on throw five (launch 1243 units/tick)
- [x] Bullseye: 1300 px/s straight up lands on the centre at arrow one (flight 282/1920)
- [x] ?dev=1 readout of swipe speed, angle and landing point in both games

## Achievable arcade scoring (done)

- [x] 1300 px/s reference flick with the deterministic square-root response and existing clamp
- [x] Bin Toss: half wind, wider forgiving bin, 110–245 px distances, floatier gravity, previous-arc ghost
- [x] Bullseye: half wind, 170 px target, gentler shrinking/drift, previous-hit ghost
- [x] Re-run the 200-run client/server identity proof and arcade regressions

## Nine-type tuning (2026-09-21)

- [x] Bomb Defusal: required-action set + ordering constraints, contradiction/cycle/ambiguity rejection, order-independent grading.
- [x] Stop Watch: sweep speeds 1.0x / 1.3x / 1.6x per try.
- [x] Laser: 6 gems, 9 mirrors, 40s, proportional partial score.
- [x] Count Up: full 8x6 field, 20s, on-screen keypad.
- [x] Percent Sprint: five items. Number Hunt: sixteen numbers.
- [x] Chain: nodes never touch (diameter + 14px minimum).
- [x] Sliding Tiles and every drag board: no page scroll while dragging.

## Drag aiming and four-step bombs (2026-09-21)

- [x] Nonogram: 90s limit, speed bonus and help text rescaled.
- [x] Count Up: compact one-row keypad plus ENTER bar (~90px), grid gets the space.
- [x] Bomb Defusal: exactly four required actions, "steps x / 4", consistency and necessity checks kept.
- [x] Bin Toss and Bullseye: drag-position aiming (anchor to finger, 20-220px strength, 20px cancel), live dotted prediction, no velocity measurement.
- [x] Chain: 15 links, at least four invalid nodes per step, scoring and counters updated.
- [x] Re-ran the arcade drag identity proof plus bomb, chain, nonogram and arcade regressions.

## Filled Count Up and arcade polish (2026-09-22)

- [x] Count Up: all 48 cells contain either the target or a valid distractor.
- [x] Bin Toss: scored-ball settle animation, delayed visible counter, and 72px drag-to-cancel zone.
- [x] Bullseye: stored seeded wind −3…+3, exact scaled-ring displacement, and per-arrow reveal details.
- [x] Re-ran the 200-run Bullseye identity proof and focused static checks.

## 2026-09-22 — Bin Toss wind, harder Bullseye, Bomb Defusal by construction

- Bin Toss: wind is a constant sideways acceleration calibrated so one wind point
  drifts the ball exactly half a bin opening (50 px) at rim height; the dotted aim
  path always shows the no-wind arc; wind −3 … +3 shown below the HUD.
- Bullseye: outer ring 114 px at arrow 1, target centre 40% down the play area.
- Bomb Defusal: plan chosen first, then four template rules true of it, then a
  proof over all 3,024 ordered four-action sequences (exactly one survives, and
  every rule is necessary). ~39 panel rolls on average, ~36 ms a panel.

## 2026-09-22 — six-rule bombs, swaying bullseye, softer wind, gentler hover
- Bomb Defusal: six rules per panel (a necessary core of four plus two confirming rules), distinct action pairs, 14 px rule lines; ~33 panel rolls per card.
- Bullseye: deterministic tick-based aim sway (120-tick circle, 0.6 ring width) from a fixed integer table; aim path and landing ring include it.
- Bin Toss: one wind point now drifts a quarter of the bin opening (25 px).
- Hover: scroll step 20 (+0.08 px/tick per gate); a clean run is now 45 gates.

## 2026-09-22 — four new arcade games: Snake, Cross, Dual, Ricochet
- Shared sims in src/lib/arcade/{snake,cross,dual,ricochet}.ts; 60 ticks/s, integer
  1/256-px constants, seeded mulberry32 in state, whole course built at init.
- Inputs: snake k=4 (swipe direction), cross k=5 (hop/left/right), dual k=6 (side),
  ricochet k=0 (tap); per-game declared ranges, 300-tick checkpoints, clientLag.
- Server replay and practice grading in src/lib/duel/{snake,cross,dual,ricochet}.ts;
  registry, help cards, reveals and standings summaries added.
- Cross proves every crossing passable with a (lane, column, tick) search; Dual
  keeps 20/12-tick separation across sides; Ricochet spikes are 90 px apart on a
  wall and never facing.
- scripts/arcade-four-check.ts: 200-run client/server identity per game, payload
  range rejection, lag handling — all passing.

## Drag arcade games (Breaker, Rally, Steady)
- [x] Shared deterministic sims `src/lib/arcade/{breaker,rally,steady}.ts` (60 ticks/s, integer 1/256-px constants, seeded mulberry32, new drag input k=7)
- [x] Server replays `src/lib/duel/{breaker,rally,steady}.ts` with 300-tick checkpoints, desync logging and clientLag handling
- [x] Screens `src/puzzles/{breaker,rally,steady}.tsx` (pointer capture, DPR<=2, no-scroll 390x700 and 375x667)
- [x] Wiring: types, secrets, generators, registry, instructions, grading, round summaries
- [x] Proof `scripts/arcade-drag-check.ts` — 200 random drag traces per game: identical states/checkpoints/scores, inflated claims caught, out-of-range payloads refused, lag handled

- [x] Arcade additions: Slice (swipe segments), Bubble Pop (drag-aim shots) and Beat (lane taps) on the shared deterministic engine, with server replay, 300-tick checkpoints and a 200-run identity proof (`scripts/arcade-slice-bubble-beat-check.ts`).
