# E7 · Grappler (`swing`): world expansion and depth, swingRev 12

25 Oct 2026. Gameplay change on a new stamp, **swingRev 12** (`SWING_REV_EXPAND`). Rooms deal it from
`SWING_V12_BANK`; every earlier revision plays and scores exactly as before. The round's maximum is
**200** (`ROUND_MAX.swing`).

## What changed

- **More world**: the view is 450 × 844 (was 390 × 730), the shape of the iPhone 11 arena box
  (414 × 772), so the whole box fills and more cave shows ahead (the hero sits 225 px from the left).
  The ceiling, anchors, ceiling spikes, stalactites, dragon and every course draw are rev 9's. The lava
  is 224 px below rev 8's (114 below rev 9's), each lava jet's top where it was. The ten touch stars
  are re-proved on the deeper cave.
- **High and low routes**: 12 cave crystals (gems) sit at the tops of proved flights near the ceiling
  (the high route; touch radius 12 px). 8 speed gates hang under anchors, their openings around the
  deepest proved fast swing (the low route: grab early for a long rope and swoop through at
  7 px a tick or faster; the gate lights gold). Neither can end a run.
- **Swing combos**: a flying grab of an anchor further ahead at 7 px a tick or faster, within 60 ticks
  of the last grab, adds a link; every fifth link is a combo point. A slow grab, a grab from a ledge or
  a landing ends the chain. Natural play rarely chains (strong releases do): see the tuning table.
- **Course sections (set routes)**: two or three per course before the dragon (from about 22, 80 and
  145 m): a wide start ledge (where most open flights come down), three landing ledges and a
  finish-flag ledge, hung from the roof on chains. Ledges are one-way: falling on to one from above,
  off the rope, lands the hero, who walks to its centre (6 px a tick; a press on the way is held until
  there) and kicks off with the next press (a push along the swing). Each ledge sits where a proved
  kick-and-release from the ledge before lands, with releases a tick or two either side landing too.
  **Collapsing ledges**: the middle landing ledge of sections 2 and 3 cracks and gives way 45 ticks
  after the first landing. Every ledge landed counts once.
- **Score** (`swingScoreV12`): a base curve on metres + 5 a star (as every band revision; 140 at
  500 m with all stars, + 10 for 500 m), refitted to the deeper cave, plus feature points capped at
  50: combo points (up to 25), a point a gem (12), a point a lit gate (8) and 15 shared by the ledges
  landed (1 each with three sections, 1.5 with two). 60 available, 50 counted, so 200 needs nearly
  everything. The reveal's breakdown lists each part.

## Assumptions and decisions

- "Fills the screen": the world widens as well as deepens (an even taller 390-wide world would leave
  side bars). Everything draws about 8 % smaller on an iPhone 11 than rev 11.
- The "low route" is the long-rope swoop through the gates under the same anchors; no second line of
  anchors (a nearest-anchor grab would steal grabs from the main line and break its proofs).
- Course sections are added to the existing proved course (ledges, no anchors moved); a player can
  always ignore them and swing through.
- The base curve was fitted by matching the bot players' unit quantiles on rev 12 to their curve points
  on rev 11 on the same bank courses (30 a level), then the low end lifted 5 points so average players
  land as today on room courses: `SWING_V12_BAND_CURVE` units [0, 55, 74, 129, 166, 215, 260, 329, 489,
  515, 550] → [0, 46, 60, 84, 93, 107, 117, 129, 133, 135, 140].
- Init cost: the sections, gems and gates are found by simulation at init (cached per seed): median
  ~170 ms, worst ~430 ms on the server here; the phone does it once a round.
- The reveal box stays 390 wide; a rev-12 reveal draws at 390 × 731 (the world's shape).
- Sounds: the existing set through the shared success layer (pop, streak, perfect cues). No new files.
- Reduced motion: the gate glow, flag ripple, ledge shake and falling chips hold still; reduced effects
  skip the gate band, gem glow and ledge underside light. Nothing that collides or scores is skipped.
- Art on the sim's geometry: ledge top = landing line, slab width = landing reach; gem drawn at its
  touch radius; gate posts flank the opening (the gate is a line test, not a body). Hero unchanged.

## Tuning table (bot players, `bun scripts/arcade-skill-bands.ts swing --rev=x --seeds=30`)

"Old" is swingRev 11 on the seeds rooms dealt before (unchanged baseline); "new" is swingRev 12 on the
`SWING_V12_BANK` courses rooms deal now. Median (p10–p90, the p90 being the top 10 %), best.

| Level | Old median (p10–p90) | Old best | New median (p10–p90) | New best | Change |
| --- | --- | --- | --- | --- | --- |
| Average | 76 (27–107) | 111 | 72 (24–107) | 113 | −5 % |
| Good | 102 (51–129) | 134 | 101 (46–134) | 140 | −1 % |
| Great | 131 (94–147) | 148 | 139 (92–156) | 158 | +6 % |
| Near-perfect | 131 (115–147) | 148 | 152 (112–163) | 165 | +16 % (feature use) |

Strong feature play (scripts/swing-rev12-witness.ts, a search that also plays the proved ledge
routes), through the server replay: **198, 195, 195, 190** on four bank courses
(`scripts/fixtures/swing-rev12-witness.json`). A state with everything scores exactly 200.

## Files

`src/lib/arcade/swing.ts` (rev 12 block, gated step code), `swing.renderer.ts` (ledges, gems, gates,
HUD row), `arcadeFxGames.renderer.ts` (swing block: `SWING_FX_V12`, registry), `revealRenderers.ts`
(swing line), `src/puzzles/swing.tsx`, `src/lib/duel/{swing.ts, arcade.server.ts, swingProof.server.ts,
swingBankV12.server.ts, instructions.ts, introScore.ts, introDemo.functions.ts, roundMax.ts}`,
`src/lib/arcade/liveBands.ts`; scripts: `swing-rev12-check.ts`, `swing-rev12-legacy.ts`,
`swing-rev12-witness.ts`, `swing-bank.ts --expand`, `shots/swing-expand-shots.ts`, the swing bot
and `games.ts` lines, `arcade-skill-bands.ts --rev=x`; fixtures `swing-rev12-{legacy,runs,witness}.json`.

## Intro demo

The intro shows its still (updated with a gem, a gate and a flag ledge). **The Grappler demo needs
re-recording on swingRev 12**; until then only a rev-12 demo would play (none exists).

## Screenshots

`screenshots/e7-oct-2026/swing-*.png` (414 × 896 at 2×): the game's own renderer drawing a recorded
strong run at each feature (start ledge, collapsing ledge, flag, gem, speed gate, combo, late run) in
the play screen's geometry; the header is a stand-in for the app's game frame.

## Checks (local)

Pass: swing-rev12-check (new), swing-rev8-check, burst-swing-score-check, arcade-tuning-a-check,
arcade-tuning-c-check, arcade-tuning-f2-check, arcade-tuning-g3-check, arcade-batch1-check,
arcade-batch3-check, arcade-self-replay-check (swing entries incl. the new `swing/expand`),
arcade-fx-check, reveal-score-check, scoring-bands-check, scoring-targets-check,
arcade-score-bands-check, arcade-help-bands-check, intro-score-text-check, help-scroll-check,
sound-manifest-check, arcade-chart-check, intro-demo-check, demo-intro-check swing,
arcade-play-check swing, arcade-fill-check swing, arcade-lowend-check swing (41 fps at 4×).

Expected failures for the parent to settle after merging: round-max-check (swing is 200 and its intro
and help text changed beyond the maximum), practice-bests-check (run `bun scripts/practice-stamps.ts`).
first-paint-check swing fails its standalone late-geometry pass, as it does for any arcade game on main
(checked with Meteor, untouched): that pass holds puzzle screens only.

## Shared requests

- `scripts/scoring-targets-revs.ts`: `EXPANDED_FROM` gets `swing: 11` (with `bandRevOf`, and `playRevOf`
  reading the expansion as the earlier play); scoring-bands-check and scoring-targets-check read it.
  Merge with the flip fork's version (keep one map).
- `arcade-help-bands-check`: "Up to {the game's maximum}" (same as the flip fork's change).
- `arcade-tuning-c-check` (the swing good-run text from the live curve), `arcade-tuning-g3-check` (the
  swing spec height 730 or 844; the demo filter on 9 or 12), `arcade-batch3-check` (the reworded intro),
  `arcade-fx-check` (swing on rev 12 with five more bumps), `arcade-self-replay-check` (appended entry).
- `scripts/arcade-skill-bands.ts`: `--rev=x` and `seedForRev` (games whose expansion deals its own bank).
- round-max-check and practice stamps, as above; replay fixtures: `bun scripts/replay-fixtures.ts --add=swing`.
