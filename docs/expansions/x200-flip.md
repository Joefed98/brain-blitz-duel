# Expansion E7 (x200): Roofbound to 200, flipRev 8

26 Oct 2026. Roofbound (`flip`) is raised to 200 (`ROUND_MAX.flip`, docs/scoring-200.md) on a new stamp, **flipRev 8**
(`FLIP_REV_EXPAND`). Rooms, practice, the daily and challenges deal it; every older stamp (unstamped, 2–6) keeps its own
course, rules and scoring (flip-x200-check replays 48 runs recorded before the change). This is the parked E7 Roofbound
expansion (PR #164, `claude/e7-parked`, parked stamp flipRev 7) taken alone onto today's main, with a new precision
feature (sweet spots), the arcade rule's guarantee and the skill pay on a rising scale. Grappler and Orbit from the same
parked PR are not part of it.

**The parked stamp.** flipRev 7 was never merged, published or dealt, so no stored round carries it. Its rules now gate on
8; nothing deals or names 7. A round stamped 7 would play and score as flipRev 6 (`flipGameFor`, `replayFlipRun`; proved by
flip-x200-check on stored flipRev 6 runs).

## World and features (from the parked expansion, kept)

- **A 390 × 730 world** (was 390 × 620; `FLIP_V8_WORLD_H`, `flipWorldHFor`): at 414 × 896 (iPhone 11 home-screen app) the
  arena box is 414 × 772, so the cave fills the screen.
- **Cave heights**: normal 260 px for 8 s, then 5–8 s sections of tight 200 / normal 260 / tall 340 px, eased over 160 px.
  A flip's arc follows the height it leaves at (9 / 12 / 16 ticks, `flipV8Arc`).
- **More rooftops, faster**: top speed 2,560 (was 2,304) and two **speed zones** (5 s at 11/8 speed, from 17–20 s and
  37–40 s). The course's x at every tick is a table stored with the course (`v8.xs`).
- **Moving spikes** (from 12 s, a quarter of the decision patterns): a spike sliding 40–70 px along its surface over a
  dashed groove; collision follows the slide exactly (`flipSegShift`).
- **Star trails**: four arcs of five small stars, taken in the air from a launch chevron.
- **Double-flip combos**: a flip within 8 ticks of landing with a hazard close by; chains count more, twice in a zone.
- **Checkpoints** at 15, 30 and 45 s and the **saved-crash rule** (kept from the parked expansion as Joe listed it; **flagged
  for Joe's confirmation**): passing one readies a save; the next crash is saved (a second of shield, the combo lost, the
  survival count paused for 10 s, so lasting on never scores less than crashing there). Without a save a crash ends the run.
- The runner is drawn as the Joulz hero (`drawRunnerHero`, unchanged).

## The new feature: sweet spots

Each course has **eight sweet spots** (`FLIP_V8_SWEETS`): a short strip of roof, `FLIP_V8_SWEET_TICKS` = 2 ticks of travel
long (about 8–14 px early in the run, 20–28 px late), placed by the seed near 6.5, 13, 19.5, 26, 32.5, 39, 45.5 and 52 s on
one surface, on clear roof (no hazard, gap, crumble or moving spike's sweep within reach of it). A **sweet landing** is the
tick a flip ends (`flipT` 1 → 0) with the runner's centre inside an untaken strip on its surface (`flipSweetLanding`); each
spot counts once (`sweetGot` bits; `sweetT` the tick, for the glint). Running or standing over a strip never counts. Like
every other feature, the spots come only from the stored course, the same for every player.

- **Art** (`drawSweetSpots`, flipArt.renderer.ts): a faint pale-gold strip laid a hair inside the rail over exactly the
  strip's x-span (what you see is what counts), with a tiny notch at each end and a soft glow on the strip only (skipped
  under reduced effects). A landed spot fades to a ghost; a sweet landing runs a small white glint along its strip for 24
  ticks (held still under reduced motion), and the shared success layer pops "SWEET!" at the runner.
- **Sound**: `flip.sweetLanding` on `sfx_spark_chime.mp3` (an existing recording, volume 0.6) through the moment cues
  (`momentCues.ts`), so mute and the Effects slider apply; the replay moment `flip.sweet-spot` (`replay.moment.mp3`).
- **Stored**: `sweetGot` folds into the checkpoint; the grade's `extra` carries `sweets`, `sweetsTotal` and `skill`, and the
  reveal shows "Sweet landings n / 8" and "Skill +n".
- Raw skill: 4 a sweet landing (32 for all eight).

## Scoring (`flipV8Parts`, `flipV8Features`)

- **Base** (the rev-6 shape): units = half seconds survived (the paused ticks left out) + 3 per gold star, on
  `FLIP_V8_BAND_CURVE` (units 0 / 40 / 105 / 130 / 140 / 146 / 150 → 0 / 15 / 51 / 73 / 79 / 123 / 140), plus 10 for lasting
  the minute: 150 at most, only for the full minute with all ten stars.
- **Skill** (0–50): raw points 4 a full trail, 4 a sweet landing, 3 a speed zone run without a save, 3 a checkpoint reached
  with no crash, and double-flip combo points up to 6 (`FLIP_V8_COMBO_CAP`), paid on `FLIP_V8_SKILL_PAY` (raw 12 / 32 / 51 /
  54 / 63 → 1 / 2 / 28 / 36 / 50): a little feature play pays little; the full 50 needs `FLIP_V8_SKILL_FULL` = 63 raw, which
  is every trail, sweet spot, zone and checkpoint (or near it with combos on top).
- **Total**: base + skill, capped at 200; no input scores 0. The reveal's lines add up to it (`bandLines`).

## The guarantee (the arcade rule)

**Fixed counts.** Every flipRev 8 course carries exactly 10 gold stars, 4 trails (20 trail stars), 8 sweet spots, 2 speed
zones and 3 checkpoints (`flipV8Opportunities`); the seed decides only where. The builder (`flipCourseV8`) now retries a
trail that no route can take after the next hazard (instead of skipping it), places the stars and sweet spots in time order
on the route proved so far, and re-rolls the course from the seed (up to 40 times) until all of them fit on **one route the
solver proved lasts the minute**. (The parked builder could skip trails and fall back to a course with no stars, so a
seed's opportunities varied; that is what made elite vary with the seed, 195 against 158.)

**Ceiling.** That proved route takes every gold star and lasts the minute with no crash (units 150 → base 140 + 10) and
every trail, sweet spot, clean zone and clean checkpoint (raw 63 → skill 50): **200 on every course with the full counts**.
- On all 60 tuning seeds and all 200 fresh seeds: full opportunities on 260 of 260 (flip-x200-check).
- A stored witness route (`scripts/fixtures/flip-x200-witness.json.gz`, planned by `scripts/flip-x200-plan.ts`, an exact
  search on the sim) on each of those 260 seeds replays through the server's encode + replay to exactly 200: the **lowest
  perfect-play ceiling is 200** on both sets (flip-x200-check).
- Rooms draw any seed (`arcadeSeed`); `bun scripts/flip-x200-seeds.ts --n=2000` builds 2,000 seeds spread over that range:
  0 without the full opportunities (74 ms a course). The fallback in `flipCourseV8` was never reached.
- Room identity: `scripts/x200/flip.ts` (arcade-room-schedule-check) plays six room deals with idle, random, weak, good and
  elite input; every scheduled item (hazards and slides, heights, zones, checkpoints, stars, trails, sweet spots) reads the
  same in every run, and the opportunity counts agree.

## Tuning

Paired runs (the same seeds for every level), every run through the server's encode + replay:
`bun scripts/arcade-skill-bands.ts flip --rev=x --levels=weak,average,good,great,near,elite,random --seeds=60` (tuning,
indices 0–59) and `--seeds=200 --from=10000` (fresh, never tuned on). "Old" is flipRev 6 (LIVE_BANDS' `strictRev`, max 150);
new is flipRev 8 (max 200). Median / p90 / best; zero scores in brackets. `bun scripts/flip-x200-bands.ts` gives the same
runs with each feature's raw points.

| Seeds | Level | New (max 200) median · p90 · best | Old median (max 150) | Median change |
|---|---|---|---|---|
| Tuning (60) | Weak | 37 · 55 · 80 | 38 | −3 % |
| Tuning (60) | Average | 73 · 97 · 119 | 74 | −1 % |
| Tuning (60) | Good | 119 · 151 · 169 | 120 | −1 % |
| Tuning (60) | Great | 143 · 164 · 183 | 120 | +19 % |
| Tuning (60) | Near-perfect | 170 · 183 · 196 | 150 | +13 % |
| Tuning (60) | Elite | 183 · 196 · 200 | 150 | +22 % |
| Tuning (60) | Random | 2 · 4 · 5 | 2 | |
| Fresh (200) | Weak | 33 · 55 · 87 (1 zero) | 38 | −13 % |
| Fresh (200) | Average | 73 · 97 · 151 | 74 (1 zero) | −1 % |
| Fresh (200) | Good | 110 · 145 · 169 (1 zero) | 100 | +10 % |
| Fresh (200) | Great | 137 · 164 · 190 | 120 | +14 % |
| Fresh (200) | Near-perfect | 162 · 187 · 196 | 150 | +8 % |
| Fresh (200) | Elite | 183 · 196 · 200 | 150 | +22 % |
| Fresh (200) | Random | 2 · 4 · 6 (4 zeros) | 2 (4 zeros) | |

No other zero scores; no run flagged or disagreeing with the server replay (3,640 runs). On the old revision good's median
moves with the seed set (120 tuning, 100 fresh) because flipRev 6's curve jumps 20 points for a ninth star; flipRev 8's good
median is 119 and 110, within 10 % of both.

**Feature payout by level** (medians; tuning / fresh): sweet landings 0 / 0 weak, 0 / 0 average, 1 / 1 good, 2 / 2 great,
4 / 4 near-perfect, 6 / 6 elite (raw 4 each); skill pay 0, 1, 1–2, 14, 33, 46.

**What changed from the parked tuning.** The parked expansion paid its features straight (trails 5, combo up to 15, zones
3, checkpoints 3, capped at 50), so a good player already collected about 30 and near-perfect players often the full 50
(near-perfect 158 · 200 · 200). Now the skill points are paid on the rising scale, the base curve is refitted with them, the
near-perfect and elite players differ mostly in sweet landings and full trails (the precision the elite tier's tighter timing
and full feature chasing buys), and good stays within about 10 % of its old median.

**The bar.** Tuning: met (good 119 vs 120; near-perfect 170 / p90 183; elite 183 / p90 196; weak and average at their old
medians; random ≤ 5). Fresh: met for good (110 vs 100, +10 %), elite (183 / p90 196) and random; **near-perfect lands just outside** (median 162 against 165–175, p90 187 against about 185): its median moves with how many of the ten gold stars the seed set lets it take, on the steep top of the base curve (the old revision's own steep top makes good move by 20 between the two sets). Two runs scored 0 on fresh seeds (one weak, one good: the bot never tapped before
the first hazard, so "no input scores 0"); flipRev 6 has the same bot artefact (one average and four random zeros on the same
seeds).

**Bots** (`scripts/arcade-skill-bands/bots/flip.ts`): the parked bot, plus sweet spots (decided on first sight, kept only
while a route over the known stretch lands in one, aimed with the level's timing jitter: 25 / 45 / 65 / 80 % of spots tried
for average / good / great / near-perfect), the tiers (weak: stars 35 %, trails 20 %, combos 5 %, sweet spots 12 %; elite:
every star, trail and sweet spot, combos 95 %, with the elite profile's own timing and random stream) and `randomBot` (taps
at random, about 1.5 a second, no aim).

**Fitting**: the curves were fitted on the 60 tuning seeds only (a search over the base knots and the pay scale, scored on
bootstrap resamples of those seeds so a fit that only held on one sample lost); the sweet spot's length went 5 → 3 → 2
ticks in the same tuning, so that it is a precision test that separates elite from near-perfect play.

## Replay coverage

- `scripts/fixtures/flip-legacy-runs.json.gz`: 48 bot runs recorded on the tree before the expansion (24 on flipRev 6, 8
  each on 4, 2 and unstamped); flip-x200-check replays each to its stored score and final checkpoint and proves no
  expansion field appears on them.
- `scripts/fixtures/flip-x200-runs.json.gz`: 12 skill-band runs on flipRev 8 (two per tier), replayed to their stored
  score and checkpoint; `flip-x200-witness.json.gz`: the 260 witness routes; `scripts/fixtures/replay-runs.json`: one run on
  flipRev 8 appended (`bun scripts/replay-fixtures.ts --add=flip`).
- Re-record: `bun scripts/flip-x200-record.ts --runs --witness` (never `--legacy`: those were recorded before the change).

## Intro and help

- Intro HOW (three lines): "Tap to flip sides; dodge the spikes (some slide). Flip again right after landing for a double
  flip." / "Grab gold stars and star trails; land a flip on a roof's faint sweet spot for a bonus." / "Checkpoints save one
  crash. Speed zones rush you on; tall caves mean longer flips."
- Intro SCORE: "Time and stars score; trails, sweet spots, double flips, zones and checkpoints: up to {max}."
- "?" help: every feature in its own line (sweet spots: "8 roofs carry a short, faint pale strip. Time a flip so you touch
  down with your feet inside it for a sweet landing; it glints. Each counts once."), and the score line with the base
  curve's numbers, the raw points and the pay scale (`skillPayLine`), "Up to 200."
- **The intro demo needs re-recording on flipRev 8**: `introDemo.functions.ts` returns no demo for a Roofbound demo
  recorded on an earlier revision, so the intro shows its still until one is.

## Screenshots

`screenshots/x200-oct-2026/flip-sweet-spot-414x896.png` (a sweet spot on the floor ahead of the runner) and
`flip-sweet-glint-414x896.png` (a sweet landing: the glint on the strip and the SWEET! pop), from a real practice run at
414 × 896 (DPR 2) in headless Chromium, the page clock stepped a tick at a time while the in-page planner taps:
`bun scripts/shots/flip-x200-shots.ts --url=<origin> --only=sweet-spot,sweet-glint` (without `--only` it also draws the
parked expansion's frames: trail, double flip, zone, moving spike, checkpoint, tall, tight, saved).

## Checks

Local, 26 Oct 2026 (a machine shared by four workers, so browser frame times run high):

- PASS: flip-x200-check (677 checks, ~20 s: legacy replay, stamp, courses, the 260-seed guarantee and witnesses, sweet-spot
  rules on 1,703 landings, caps, saves, idle and random play, stored flipRev 8 runs, texts), arcade-room-schedule-check
  (Roofbound's lines: 6 deals × 5 styles, every scheduled item identical; the check itself fails only on the three other
  games' missing modules), round-max-check, scoring-bands-check, scoring-targets-check, arcade-score-bands-check,
  arcade-help-bands-check, intro-score-text-check, reveal-score-check, replay-check, arcade-self-replay-check (whole run,
  plus the new `flip/x200` entry and every flip entry at 40 runs), arcade-fx-check, sound-manifest-check,
  practice-bests-check, arcade-batch1-check, arcade-tuning-c-check, flip-bend-check, hotfloor-flip-check,
  bullseye-cross-flip-tuning-check, arcade-correction-check, depth-matchmaker-check, intro-demo-check, whack-check,
  presentation-geometry-check, arcade-play-check flip (frame 27.1 ms against the 17.0 baseline under load, within limits),
  bottom-clearance-check flip, arcade-fill-check flip; `bunx tsc --noEmit` clean.
- Not run here (the coordinator runs them after merging): arcade-room-practice-check, arcade-lowend-check (which does not
  cover Roofbound).

## Assumptions and notes

- "A sweet spot on each roof": the guarantee rule needs a fixed count, so every course has eight sweet spots on eight of
  its roofs (stretches of clear surface), placed by the seed, rather than one on every stretch (whose number varies).
- The landing is judged on the runner's centre (its feet), the tick the flip's arc ends; the strip is drawn over exactly
  that x-span. A double flip off a sweet spot still counts the landing.
- The checkpoint saved-crash rule is kept from the parked expansion as Joe listed it, flagged for his confirmation.
- Combos are not needed for the ceiling (the full skill pay needs only the guaranteed items), so a seed's number of combo
  chances never limits the top; they add raw points on top (up to 6).
- Fresh-seed results of earlier configurations were looked at between tuning rounds; the final curves were chosen by their
  cost on the tuning seeds (the lower of two fitted candidates).
- The worktree started at origin/main (6b42ef3) and was fast-forwarded to the groundwork commit 8d8b61c.

## Shared lines touched (Roofbound's only)

`src/lib/duel/roundMax.ts` (flip 200), `scripts/round-max-check.ts` (`RAISED`), `src/lib/arcade/liveBands.ts` (rev 8 on
`FLIP_V8_BAND_CURVE`, `strictRev` flipRev 6), `src/lib/duel/arcade.server.ts`, `grade.ts` (the flipRev 8 extras),
`src/lib/arcade/reveal.ts` (two tiles), `revealRenderers.ts` (the 730 px height), `arcadeFxGames.renderer.ts` (the flip
effects, `flipFxFor`, `FLIP_FX_TALL` in `ARCADE_FX_SPECS`), `instructions.ts`, `introScore.ts`, `introDemo.functions.ts`,
`src/lib/replay/moments.ts`, `src/lib/fx/momentCues.ts`, `src/lib/fx/manifest.ts`, `docs/sound-cues/arcade-effects.md`,
`replays.md` and the cue sheet (regenerated), `scripts/fixtures/replay-runs.json` (one run appended),
`src/lib/duel/practiceStamps.data.ts` (regenerated), and older checks' Roofbound lines: `arcade-batch1-check` (the intro
line, now with the help's 10 for the minute), `arcade-tuning-c-check` (rooms deal flipRev 8), `arcade-play-check` (the
runner's drawn point from the game's geometry on flipRev 8), `arcade-fx-check` (the flipRev 8 art game and its seven new
event bumps), `arcade-self-replay-check` (one appended entry, `flip/x200`).
