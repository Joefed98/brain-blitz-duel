# E7 · Roofbound (`flip`) — flipRev 7

25 Oct 2026. Roofbound's expansion: a bigger cave, five skill features, scored to 200 (`ROUND_MAX.flip = 200`).
Rooms and practice deal `flipRev 7`; every earlier revision replays and scores exactly as before.

## World

- **Taller world: 390 × 730** (was 390 × 620; `FLIP_V7_WORLD_H`, `flipWorldHFor(rev)`). At 414 × 896 (iPhone 11
  home-screen app) the arena box is 414 × 772, so the world draws at 1.058× (412 × 772) instead of 1.06× of a
  658 px world with 114 px of rock fill underneath: it fills the screen.
- **The cave's height changes along the run** (`flipV7HeightAt`): normal 260 px for the first 8 s, then sections of
  5–8 s alternating between tight (200 px), normal (260 px) and tall (340 px), each change eased over 160 px of
  tunnel, the cave centred on y = 365. **A flip's arc follows the height** it leaves at (`flipV7Arc`): 9 ticks in a
  tight stretch, 12 at normal, 16 in a tall one, so flips change in distance and timing.
- **Longer runs, more rooftops**: the top speed is 2,560 (was 2,304; still +90 every 3 s) and two **speed zones**
  (5 s each, starting between 17–20 s and 37–40 s) run at 11/8 speed, so a full run covers about 16 % more tunnel
  (more hazards, more roofs in the far city, which now draws a second, further row of rooftops). The course's x at
  every tick is a table (`v7.xs`) built with the course.
- The bend (from 10 s, the rev-4 table) is unchanged and still shared by both surfaces; hazards ride it.

## Features (all deterministic, integer sim, gated on the stamp)

| Feature | Rule | Points (of the extra 50) |
|---|---|---|
| **Star trails** | Four trails (about 7, 20, 33 and 48 s), each five small stars on a flip's arc from a launch chevron on one surface. A star is taken in the air when the runner is within 24 px of it along the tunnel and within 23 % of the cave height of it across (`flipV7Frac`, the art's own ease). The course gives each trail a clear stretch and is proved with every trail and gold star on one route. | 5 per full trail (20) |
| **Double-flip combos** | A flip started within 8 ticks of landing with a hazard under the runner or within 96 px ahead counts; chained ones count more (double 1, triple 2, longer 3), twice in a speed zone. A crash save ends the chain. | combo points, capped at 15 |
| **Moving spikes** | From 12 s, a quarter of the decision patterns are a spike sliding 40–70 px to and fro along its surface (period 1.5–2.5 s). Collision follows the slide exactly (`flipSegShift`); the art draws the spike there over a dashed groove marking its whole sweep. | (a hazard) |
| **Speed zones** | 11/8 speed for 5 s; warm air, chevrons and a gate at each end. | 3 per zone run through without a save (6) |
| **Checkpoints** | Gates at 15, 30 and 45 s. Passing one readies a save (a gold shield in the tunnel's corner): the next crash is saved — a second of shield (60 ticks), the combo lost, and the survival count paused for 10 s, so lasting on never scores less than crashing there. Without a save a crash ends the run as before. | 3 per checkpoint reached with no crash so far (9) |

## Scoring (`flipV7Score`, `flipV7Parts`)

- **Base** (the rev-6 shape): units = half seconds survived (the paused ticks left out) + 3 per gold star, on
  `FLIP_V7_BAND_CURVE` (units 0/40/105/130/140/146/147/150 → 0/10/40/56/72/84/98/140), plus 10 for lasting the minute.
  So the base still tops out at 150 only for the full minute with all ten gold stars.
- **Features**: trails + combo + zones + checkpoints, capped at 50.
- **Total**: base + features, capped at 200; no input scores 0. The reveal's lines add up to it (`bandLines`).
- The base curve is lower than rev 6's strict curve below the top because the features add on top: fitted so the
  bots' medians land within about ±10 % of rev 6's (table below).

## Tuning (bots, 40 room seeds a level, every run replayed through the server)

`bun scripts/flip-rev7-bands.ts --rev=6,7 --seeds=40` (the skill-band bot: `scripts/arcade-skill-bands/bots/flip.ts`,
which on rev 7 also goes for trails — 35 / 60 / 80 / 95 % of the time by level — and tries double flips after a
landing by a hazard 10 / 30 / 55 / 80 % of the time, never planning a crash into a save).

| Level | flipRev 6 median · p90 · best | flipRev 7 median · p90 · best | rev 7 parts (medians) |
|---|---|---|---|
| Average | 72 · 100 · 120 | 76 · 104 · 172 | base 58, features 16 (trails 5, combo 2, zones 3, checkpoints 6), 1 save |
| Good | 120 · 150 · 150 | 122 · 147 · 192 | base 90, features 30 |
| Great | 120 · 150 · 150 | 136 · 190 · 195 | base 90, features 40 |
| Near-perfect | 150 · 150 · 150 | 158 · 200 · 200 | base 108, features 50 |

Average and good stay within about 6 % of rev 6; great (+13 %) and near-perfect (+5 %) gain through strong
feature play, and only they reach 190–200 (p90). A planned route (an exact search on the sim) scores 200 through
the server replay on all three seeds flip-rev7-check plans.

## Intro, help and demo

- Intro (three HOW lines, ≤ 110 characters each): tap to flip, some spikes slide, flip again right after landing for a
  double flip; gold stars and star trails (flip at the chevron); checkpoints save one crash, speed zones, tall caves
  mean longer flips. SCORE: "Points for time and stars; trails, double flips, clean zones and checkpoints reach {max}."
- The "?" help explains each feature in full and its points; its band numbers come from `FLIP_V7_BAND_CURVE`.
- **The intro demo needs re-recording on flipRev 7.** `introDemo.functions.ts` now returns no demo for a Roofbound
  demo recorded on any earlier revision, so the intro shows its still until one is recorded.

## Sounds (existing files only)

New effect cues through the shared success layer (`arcade-effects.md`, manifest slots, `momentCues.ts`,
`moments.ts` rows 5–10): `flip.trailStar` (`arc_pickup`), `flip.trailDone` (`done.chimeSweep.mp3`),
`flip.doubleFlip` (`banner.combo.mp3`, replaces the generic combo), `flip.checkpointPassed` (`done.goldPulse.mp3`),
`flip.crashSaved` (`done.glowSweep.mp3`), `flip.speedZone` (`hover.zone.mp3`); replay moments `flip.trail-star`,
`.star-trail`, `.double-flip`, `.checkpoint`, `.saved`, `.speed-zone`. No new audio files. All follow mute and the
Effects slider through the shared sound path.

## Motion and performance

Reduced motion: chevrons, curtains, trails and the shield hold still (the streaks are not drawn moving). Reduced
effects (slow devices): the speed-zone streaks and the trail stars' glow are skipped, as the cave's decorative
passes already were.

## Replay coverage

- `scripts/fixtures/flip-legacy-runs.json.gz`: 48 bot runs recorded **before** the change (24 on flipRev 6, 8 each
  on 4, 2 and unstamped) by `scripts/flip-rev7-record.ts`; flip-rev7-check replays each to its stored score and final
  checkpoint and proves no rev-7 field appears on them.
- `scripts/fixtures/replay-runs.json`: one great-bot run on flipRev 7 appended (`bun scripts/replay-fixtures.ts --add=flip`).

## Checks (local, 25 Oct 2026)

PASS: flip-rev7-check (290 checks, 200 via the server replay on 3 of 3 planned routes), flip-bend-check,
hotfloor-flip-check, arcade-batch1-check, arcade-tuning-c-check, bullseye-cross-flip-tuning-check, scoring-bands-check,
scoring-targets-check, arcade-score-bands-check, arcade-help-bands-check, intro-score-text-check, sound-manifest-check,
replay-check, reveal-score-check, arcade-fx-check, arcade-self-replay-check, arcade-play-check flip (frame 19.1 ms vs
17.0 baseline on a loaded machine, within limits), arcade-fill-check flip, demo-intro-check flip, intro-demo-check,
first-paint-check flip (practice and room passes).

Expected / not mine:
- round-max-check FAILS on flip's lines (its "every game is 150" table and the flip intro/help text comparison): left
  for the merge, as agreed.
- practice-bests-check FAILS until `bun scripts/practice-stamps.ts` is re-run after the merge.
- first-paint-check's standalone *late* pass, when flip is named, fails (the stage moves 48 px as the late insets
  land). That pass covers puzzle screens only (the geometry hold is puzzle-only by design); any arcade game named there
  does the same, so it is not a flipRev 7 regression.
- arcade-lowend-check does not cover Roofbound (Tilt, Ball Tracker, Ink Bridge, Grappler, Orbit).

## Screenshots

`screenshots/e7-oct-2026/flip-*.png` (414 × 896, DPR 2, a real practice run driven tick by tick by
`scripts/shots/flip-e7-shots.ts`): double flip, tight cave, tall cave, moving spike, speed zone, star trail,
checkpoint gate, saved crash. The saved-crash frame comes from an earlier run of the tool, before the rock-tile seam
fix and the mid-tunnel save badge (later runs crashed before reaching it: the stepped-clock driver sometimes lands a tap
a tick late).

## Shared changes made (small, game-agnostic) and shared requests

- `scripts/scoring-targets-revs.ts`: `EXPANDED_FROM` (type → the score-bands revision a game dealt before its 200
  expansion). `TARGET_REVS` / `STRICT_REVS` derive from it instead of LIVE_BANDS' rev, and `playRevOf` maps the
  expansion revision to it, so every older "rooms deal revision N" pin keeps proving its chain. **Other expansions
  add their own line** (`orbit: 10`, `swing: 11` …).
- `scripts/scoring-bands-check.ts` / `scripts/scoring-targets-check.ts`: read `STRICT_REVS` for those games.
- `scripts/arcade-help-bands-check.ts`: a finish game's help ends "Up to {roundMaxFor(type)}." (was a literal 150).
- `scripts/arcade-play-check.ts`, `scripts/arcade-fx-check.ts`, `scripts/arcade-batch1-check.ts`: Roofbound's own lines.
- **Shared request**: `scripts/round-max-check.ts` still says every game is 150 (left to the merge, as agreed).
- **Shared request**: `src/lib/duel/practiceStamps.data.ts` needs `bun scripts/practice-stamps.ts` after the merge.
- **Shared request**: `docs/arena-sizes-oct-2026.md` lists Roofbound at 390 × 620; rev 7 is 390 × 730 (414 × 772 box
  → 412 × 772 world at 414 × 896).
