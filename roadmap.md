## Stop Watch, Chain, Whack, and Clay updates (Oct 2)

- [x] Make Stop Watch 1–7 bounce, Watches 8–10 wrap, and count right-edge arrivals from 2 through 11.
- [x] Scatter all 28 Chain nodes with a guaranteed clear gap and store each generated layout.
- [x] Run Whack-a-Target for 60 seconds with an initially empty, paced 100-ball queue and universal three-second lifetimes.
- [x] Compact Clay Shoot's status, conceal gold discs until resolved, and expand the sky area.
- [x] Run self-replay proofs only for Whack-a-Target and Clay Shoot.

## Ten Drop and Number Pyramid update (Oct 2)
- [x] Simplify Ten Drop to a gold running total on the left and centred target beneath the shared timer.
- [x] Expand Number Pyramid to four rising-difficulty boards over 150 seconds.
- [x] Add placed-tile double-tap return and rebalance the short-phone layout.
- [x] Rebuild and validate 400 unique four-board sets, then run code checks without browser tests.

## Word Search and Letter Wheel tuning (Oct 2)
- [x] Extend Word Search to 120 seconds and rescale its completion bonus.
- [x] Remove Letter Wheel shuffle and bonus words, and add neutral valid-word feedback.
- [x] Rebuild Letter Wheel as 300 validated eight- or nine-word crosswords with the new scoring.
- [x] Adjust Letter Wheel controls for short phones and run focused checks without browser tests.

## Shared play timer and full-width arenas (Oct 2)
- [x] Replace all live countdowns with the shared top timer bar.
- [x] Remove per-game timer slots and reclaim their height.
- [x] Make game screens use the viewport width minus an 8 px safe margin.
- [x] Remove height-driven narrowing from shared arcade canvases and capped puzzle arenas.
- [x] Audit 390×700 and 375×667 layouts from source and verify checks without browser tests.

## Two speed-game changes (Oct 2)
- [x] Rework Whack-a-Target as a paced 100-ball queue with persistent correct balls and two-second wrong-colour retreats.
- [x] Update Whack-a-Target scoring, HUD, instructions, reveal, and server-graded details.
- [x] Expand Clay Shoot to 60 seconds with 22 orange and 3 harder gold clays across 25 seeded trajectories.
- [x] Update Clay Shoot hit radii, scoring, colour counters, instructions, reveal, and server-graded details.
- [x] Run only Whack-a-Target and Clay Shoot identity proofs plus focused schedule, aiming-bot, and score checks; no browser tests.

## Four speed-game changes (Oct 2)
- [x] Update Reaction Time to 60 seconds, seeded 5–8 flashes, simplified play UI, and scaled decoys.
- [x] Update Number Hunt to 20 non-touching numbers, seeded 15-second relocations, and new scoring.
- [x] Expand Stop Watch to ten progressively harder watches and correct full-sweep pass counters.
- [x] Rework Don’t Break the Chain for endless seeded 28-node sets, compact timer, and link scoring.
- [x] Audit source layouts for 390×700 and 375×667; run focused checks and only applicable changed-game replay proofs, with no browser tests.


## Three number-game changes (Oct 2)
- [x] Extend Ten Drop to 90 seconds with the new ten-target bands and pace.
- [x] Move Ten Drop timing into a compact top bar and reclaim the arena space.
- [x] Rebuild Number Pyramid as 400 unique three-board sets with sequential play and skipping.
- [x] Update Number Pyramid and Trail scoring and timing.
- [x] Run only Ten Drop's replay proof plus focused bank, scoring, and code checks; no browser tests.

## Four word-game tunings (Oct 2)
- [x] Update Wordsmith scoring and all displayed conversion text.
- [x] Remove Word Slide's in-game par label only.
- [x] Rescore Word Search, clarify category headings, and rebuild its 500-board bank.
- [x] Add Letter Wheel tap input, new scoring, larger cells, compact timer, and rebuild its constrained 300-board bank.
- [x] Run focused checks, TypeScript validation, and preview diagnostics; no browser tests.

## Attention and Pattern tuning (Oct 2)
- [x] Rebuild Colour Clash as a deterministic 60-second falling-word lane game with recorded steering and drops.
- [x] Make all five Intruder Detection boards 3×3 without changing stages, timings, or scoring.
- [x] Guarantee and verify Count Up shape containment and counted-shape visibility.
- [x] Clarify Laser splitter and directional-gem symbols in the intro, game, and reveal.
- [x] Run the Colour Clash identity proof and focused generator/geometry checks; no browser tests.

## Attention and Pattern changes (Oct 1)
- [x] Rebuild Colour Clash as a deterministic 45-second attention sorting stream with seeded rules, gates, replay grading, and reveal.
- [x] Expand Intruder Detection to five timed boards with two-change and shuffled-grid stages.
- [x] Rebuild Count Up as three dense overlapping picture scenes with stored, server-counted targets.
- [x] Fit Rotating Rings controls, legend, and board into short phone play areas without scrolling.
- [x] Add Laser splitters and directional gems while preserving nine-mirror necessity and three shots.
- [x] Run Colour Clash identity proof, named generator checks, TypeScript validation, and preview build diagnostics; no browser tests.

## Reaction and Stop Watch tuning (Oct 1)
- [x] Give every Reaction Time flash 1–3 seeded decoys in three colours with irregular spacing.
- [x] Give Stop Watch three visible passes, seeded moving targets on Watches 2 and 4, and a vertical accelerating Watch 4.
- [x] Run focused timing and scoring checks plus the TypeScript check; no browser tests.

## Six-type route, controls, and intro tuning (Sep 30)
- [x] Limit Hot Floor to few exhaustive-search viable routes with pinch tiles and three failed alternatives; report 50-stage metrics.
- [x] Make Burst and every arrow/joystick control press-safe and non-selectable, with full-width Burst columns.
- [x] Let Parry arrows remain catchable inside the ring and cost a life only at the core.
- [x] Reduce Bastion arrow rotation to 3° per tick without changing touch aim.
- [x] Make every round intro scroll when needed with READY sticky at the bottom; statically verify target phone fits.
- [x] Run focused checks and 200-run identity proofs for Hot Floor, Parry, and Bastion; no browser tests.

## Eight-type difficulty and scoring tuning (Sep 30)
- [x] Add Hot Floor hop budgets, tighter tile values, choke points, failed alternatives, and naive-strategy metric.
- [x] Retune Burst, Parry, Bastion, and Wavefront controls/scoring/schedules.
- [x] Increase Shikaku, Light Up, and Tents board difficulty while preserving unique solutions.
- [x] Run four arcade identity proofs and three 50-board uniqueness checks; no browser tests.

## Four arcade and interaction changes (Sep 30)
- [x] Rebuild Hot Floor as ten deterministic 6×8 route-planning stages with three lives.
- [x] Shift Tilt's starting maze difficulty forward by one level.
- [x] Suppress iOS selection and callouts at the shared game-screen wrapper.
- [x] Make at least 40% of Flip hazards after 10 seconds solver-checked decision patterns.
- [x] Run focused generation checks and 200-run replay identity proofs; no browser tests.

## Six type tuning (Sep 30)
- [x] Burst separate control bar in both modes.
- [x] Ink Bridge stroke controls, swept collision and stuck handling.
- [x] Junction traffic, Parry ring, Flip pace, Light Up board difficulty and fit.
- [x] Replay identity and unique-board checks; no browser tests.

## Balance fixed placement controls (Sep 29)

- [x] Replace tilted measured peg targets with a fixed row of eight number buttons.
- [x] Keep the beam decorative except for placed-weight selection and double-tap return.
- [x] Raise the rack 56 px above the safe-area inset and centre the pivot in the remaining play area.
- [x] Preserve the placement encoding validated by the server; run code-level checks only.

## Four control and layout tunings (Sep 29)

- [x] Make Balance tap-only with weights above the beam, selected-only peg markers, measured targets and spaced stacked reveals.
- [x] Convert Sum Hunt to deterministic 4×4 boards with a 16-cell final clear.
- [x] Add persistent tap-built words and a Submit control to Word Hunt while preserving drag tracing.
- [x] Add a remembered shared joystick mode with step locks and 180 ms Maze Dash repeat.
- [x] Run code-level checks only; do not run browser tests.

## Three type tunings (Sep 29)

- [x] Replace Balance peg squares with hanging gold lines while retaining measured targets.
- [x] Give Sum Hunt deterministic harder stage boards, larger values and tightly controlled path counts.
- [x] Add sub-8 px wheel taps to Wordsmith while preserving drag-to-connect.
- [x] Run code-level checks only; do not run browser tests.

## Three new-round input refinements (Sep 29)

- [x] Make Tile Grid tap-only, with selected-tile glow and faint empty-cell targets.
- [x] Centre Balance vertically and hit-test the actual tilted on-screen peg targets.
- [x] Centre Sum Hunt's target, auto-resolve matching/overshot paths, and use orthogonal paths throughout.
- [x] Run code-level checks only; do not run browser tests.

## Four round refinements (Sep 29)

- [x] Tile Grid tap selection, tap-to-place and live nearest-cell drag highlight.
- [x] Word Slide 90-second limit and speed scaling.
- [x] Sum Hunt seeded nine-stage progression, final full-grid clear, 90-second timing and stage scoring.
- [x] Balance full-width progress bar, tap-to-place, double-tap return and live peg drop highlight.
- [x] Run code-level checks only; do not run browser tests.

## Four new round tunings (Sep 29)

- [x] Tile Grid: fit seven rows between HUD and tray; centre drag ghosts and snap by nearest cell centre.
- [x] Word Slide: five dictionary rows, five-to-eight shifts, live checks, scoring and reveal.
- [x] Sum Hunt: five-by-five diagonal paths, tap and drag, rising deterministic targets.
- [x] Balance: centred ghosts, generous peg zones and hanging weights.
- [x] Run code-level checks only; no browser tests.

## Three presentation fixes (Sep 26)

- [x] Add a gold Wordsmith Submit control beside Undo and Shuffle without removing box-tap or Enter submission.
- [x] Fit Count Up's filled board within the measured phone width and height with visible side gutters.
- [x] Move Bin Toss and Bullseye wind displays onto a clear line below their headings, above the bin and target.

## Phone presentation fixes (Sep 26)

- [x] Replace the four-direction pads with a compact 56 × 44 px row, 16 px gaps, beneath Push, Maze Dash, Ice Slide and Gravity Maze boards.
- [x] Remove Wordsmith's upper box, enlarge its wheel and submit from the word-entry box while retaining keyboard Enter.
- [x] Fill Count Up's measured space with a 9 × 8 grid, compact timer slot and keypad; enlarge Bin Toss and Bullseye wind displays and Bullseye play text.
- [x] Draw Breaker and Slice frames directly in their simulations' world coordinates so letterboxing cannot shift the borders. Validate without browser tests.

## Arcade presentation and tuning (Sep 26)

- [x] Simplify the requested arcade reveals: no gate/coin/pellet dots, input counts or per-arrow detail.
- [x] Enlarge Bin Toss play text; frame Breaker and Slice; add six seeded three-hit Breaker bricks with hit cracks and unchanged per-destroyed-brick score.
- [x] Delay Steady's lifted-finger penalty five seconds, cycle Cross traffic colours, and tighten Dual's final-20-second side gaps while retaining passability.
- [x] Re-run 200-run Breaker, Steady, Cross and Dual client/server identity proofs. No browser tests.

## Presentation and tuning (Sep 26)

- [x] Reaction waiting text enlarged; Count Up filled 8×7 board with unchanged answer range.
- [x] Maze Dash, Ice Slide and Push arrow pads enlarged with non-overlapping diamond spacing; Spin answer boxes enlarged; Block Party pegs doubled.
- [x] Intruder before/after comparison with marked change and tap; Rings and Colour Flood reveals stacked vertically.
- [x] Validate code and preview build without browser tests.

## Ricochet, Dual and home copy (Sep 24)

- [x] Ricochet scores floor(2 × metres), capped at 150; help and reveals reflect it.
- [x] Dual javelins enlarged 1.2× with matching collision geometry and recomputed passability spacing.
- [x] Home game-count copy updated to 40+ puzzle types and 15 arcade games.
- [x] Dual client/server identity proof passed 200/200 runs with matching checkpoints and scores; no browser tests.

## Puzzle scoring balance

- [x] Triple raw Wordsmith and Word Hunt points for the capped round score; retain raw in-game counters and show conversion in reveals.
- [x] Rebalance Reaction Time and Stop Watch to 50–150 with missed attempts counted at their worst value.
- [x] Word Match, Pipes, and all other unfinished/imperfect puzzle partial scores capped at 90; align score instructions and reveals.
- [x] Verify focused scoring formulas and preview build diagnostics without browser tests.

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

- Chat panel closes by button/outside tap/swipe; Nonogram 120s; Intruder 5s/1s/3s one-tap boards; Equation five numbers; One-Stroke 30s; arcade reveals show game stats only (metres, seconds) with desync logged but hidden.

## Arcade rework (Breaker / Rally / Steady)
- Breaker: 8x8 wall, speed +26 per brick and +51 per 10s (cap 1920), 3 seeded gold bricks dropping MULTI/SPAM/LASER capsules, multi-ball (cap 8), gold power-up button (k=10).
- Rally: +3% per hit (cap 2.2x), paddle -5 px to 40 min, seeded gold ball every 10s scoring 6.
- Steady: ball on a fixed line, x-only drag, track 44 -> 18 px (1 px per 4s), scroll 1.2 -> 3.0 px/tick (+0.15 per 5s), reveal in metres.
- 200-run identity proof re-run for all three; all other arcade proofs and the build pass.

## Six arcade tunings (done)
- Slice: launch rate ramps 1 → 4 per 1.5 s; seeded FRENZY (5 s bomb-free burst) and LINE (row of six, 2 s hang) specials, 1–2 each, never in the first 10 s; totals count specials and their spawns.
- Bubble Pop: 90 s run, five distinct colours with per-colour symbols.
- Snake renamed "Eat and Grow" (mechanics unchanged).
- Cross: four-way swipe input, one-second kerb pause between crossings with inputs dropped and unlogged, "Crossing N" banner.
- Dual: scroll 2.0 → 4.4 px/tick, +0.3 every 10 s.
- Bullseye: outer ring 91 px, new scoring curve (ten centres = 150, −10 per point dropped above 90, T × 0.55 below).
- Proofs: all arcade checks pass, incl. a new Slice specials check (payload spawn counts, no bombs in a frenzy, client/server identity).

## Fixes and tuning (Sep 23)
- [x] Unblock: no solver in rooms; 400-layout bank in the database with recent avoidance; guarded reveal.
- [x] Arcade clock shows the run (sim-driven), 0.0 when the sim ends.
- [x] Arcade reveal mismatch: 2,000-event cap made the server replay with no inputs; cap now 6,000.
- [x] One par-based arcade scoring formula; SCORE lines updated.
- [x] Mirror Match five shapes, 60 s.
- [x] Dual smaller blocks, double jump, +25% jump.
- [x] Ricochet 85% spikes, 60 px clear gap, slide keyed to height.
- [x] Breaker power-up button is its own target.

## Arcade client/server agreement
- [x] Arcade answers no longer cut at 4,000 chars (root cause)
- [x] Sim reads only the recorded log, all 16 games
- [x] Server clamps and counts bad inputs
- [x] Dev diagnostics (?dev=1)
- [x] Slice launch speed/angle variation

## Categories, persistent rooms, Slice and Dual (Sep 23)
- [x] Eight-category host picker, presets, persisted selection and even six-round draw without repeated types. Memory is displayed but unavailable while every memory type remains retired.
- [x] Reuse room/code on play again; retain tournament history, disband and host-disconnect handling.
- [x] Slice seeded speed classes and smaller faster specials; identity proof (200/200).
- [x] Dual thin javelin spikes with matching collision; identity proof (200/200).

## Arcade scoring and tuning (Sep 24)
- [x] Intro shows run length (60/90 s), not phase slack.
- [x] Ricochet: 1 pt/m, 75% ball, seeded tightening spike gaps, cross-wall offset, reachability search.
- [x] Dual: 50% spikes, ×1.3 jump, 150 × (s/60)² scoring.
- [x] Cross 4/lane +4/crossing; Eat and Grow 5/pellet; Beat 1/0.75/0.25/−2.
- [x] Bubble Pop 150 − 3 per bubble left; Slice 150 × sliced ÷ all available (specials' batches included).
- [x] Steady: centred ball, no nudge, repeating edge/lift touches, 150 − 5/touch.

## Arcade scoring and tuning, part 2 (Sep 24)
- [x] Rally: blue ball, 3 per gold hit
- [x] Breaker: bottom-quarter drag zone, 9×8 wall, 4 starred gold bricks, 2 per brick / all 72 = 150
- [x] Matchup: T/L STAR clears both diagonals; floor(150 × raw ÷ 2000)
- [x] Bullseye: 45 s, 100 = 150 else 146 − 3 per point short
- [x] Skyline 3/block + 2/perfect; Swerve exactly 75 coins, 2 each; Hover exactly 45 gates, 2 each, all = 100
- [x] Bin Toss: wind ±1..±4, 80 px bin, 10/basket + whole seconds left on 10/10
- [x] Verified: 200/200 self-replay for all 16 games, typecheck and build OK

## Two new word rounds (Sep 29)
- [x] Tile Grid (60 s, reveal 8 s)
- [x] Word Slide (60 s, reveal 6 s)
- [x] Sum Hunt (number, 45 s, reveal 6 s)
- [x] Balance (number, 60 s, reveal 8 s)

## Three-stage rounds (Sep 29)
- [x] Equation Balancing: 3/4/5-number stages, 60 s, 30/40/50 + time bonus
- [x] Symbol Scan: 5×5/6×6/7×7, 45 s, 30/35/35 − 3 per wrong tap + bonus
- [x] Count Up: 5×4/7×6/full grid, 45 s, exact/near-miss weights + bonus

## New rounds (Sep 29)
- [x] Whack-a-Target (attention, arcade engine, 30 s)
- [x] Tents and Trees (logic, 7×7, 90 s, unique solution)

## New arcade games (Sep 29)
- [x] Wavefront
- [x] Bastion
- [x] Rooftop Run

- [x] Sort Rush, Flip and Parry arcade games (200-run identity proofs passed)
- [x] Junction and Ink Bridge arcade games (200-run identity proofs passed)
- [x] Burst arcade game (200-run identity proof passed)

- [x] Orbit and Swing arcade games (200/200 identity proof)
- [ ] Swing: confirm scroll speed vs 2-per-metre cap (cap reached ~25 s at spec speed)
- [x] Tilt and Hot Floor arcade games (200/200 identity proof)
- [ ] Hot Floor: confirm pickup count (~30-38 per run vs ~60 spec)
- [x] Shikaku and Light Up logic rounds (50/50 unique each)

- [x] Hot Floor plan-then-go, Tilt harder mazes, root-level iOS selection lock, Flip harder (2026-09-30)

## Oct 2 — Logic category changes
- [x] Pipes 7×7, 120 s, new stepped scoring
- [x] Lights Out 6×6, minimum 8–12, 75 s
- [x] Colour Connect 9×9, 10–12 pairs, 2–4 walls, unique, 75 s, 60 × joined ÷ pairs
- [x] Tower 9 discs, 3 or 4 pegs per puzzle, minimum 20–40, 90 s
- [x] Sort the Tubes capacity 5, 90 s
- [x] One-Stroke retired (practice only)
- [x] Bomb Defusal 40-template rule bank

## Oct 2 — Arcade changes, part 1
- [x] Retire Swerve, Dual, Ricochet, Steady, Sort Rush, Parry, Hot Floor (practice only)
- [x] Ink Bridge collision hardening + 500-drop line check
- [x] Skyline camera pull-back (render only) + city backdrop
- [x] Bullseye moving target on arrows 6–10
- [x] Cross cars/lorries, 3 lives, clean-crossing bonus
- [x] Slice combo ×1–×3, 25% longer cut, combo meter

## Stop Watch, Chain, Whack, and Clay update (Oct 2)
- [ ] Correct Stop Watch bounce/wrap movement and right-edge pass counters from 2–11.
- [ ] Scatter each 28-node Chain set with enforced non-touching spacing.
- [ ] Extend Whack-a-Target to 60 seconds with queued pop-ups and universal three-second retreats.
- [ ] Compact Clay Shoot status, conceal gold lineup discs until resolved, and reclaim arena height.
- [ ] Run only Whack-a-Target and Clay Shoot self-replay proofs plus focused source checks; no browser tests.

## Number & Speed tuning (Oct 3)
- [x] Ten Drop sparser digits spread 1–10, operators needed on every target
- [x] Number Pyramid levels shifted, new hardest Level 4, 120 s, bank rebuilt (400 × 4)
- [x] Number Hunt 24 numbers
- [x] Chain: set counter removed, Lock in button
- [x] Whack: decoys drop at 1.5 s, 45 targets, 3 pts, +15 perfect
- [x] Clay: launch origins in lower half / middle band only

## Whack lifetimes and memory removal (Oct 3)
- [x] Whack-a-Target: every ball (target and decoy) drops after 1 s if not whacked; scoring unchanged.
- [x] Rooms never draw memory: addMemory option removed from the draw, memory filtered from saved category settings; memory games stay in practice.
- [x] Whack-only self-replay proof (200/200) and typecheck; no browser tests.
