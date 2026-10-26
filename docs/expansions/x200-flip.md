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

Each course has **eight sweet spots** (`FLIP_V8_SWEETS`): a short strip of roof, `FLIP_V8_SWEET_TICKS` = 1 tick of travel
long (about 4–7 px early in the run, 10–14 px late: exactly one landing tick fits, so a sweet landing needs the flip timed
to the tick), placed by the seed near 6.5, 13, 19.5, 26, 32.5, 39, 45.5 and 52 s on
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
  `FLIP_V8_BAND_CURVE` (units 0 / 40 / 105 / 130 / 140 / 146 / 150 → 0 / 11 / 33 / 38 / 43 / 95 / 140), plus 10 for lasting
  the minute: 150 at most, only for the full minute with all ten stars.
- **Skill** (0–50): raw points 4 a full trail, 4 a sweet landing, 3 a speed zone run without a save, 3 a checkpoint reached
  with no crash, and double-flip combo points up to 6 (`FLIP_V8_COMBO_CAP`), paid on `FLIP_V8_SKILL_PAY` (raw 12 / 30 / 37 /
  61 / 63 → 0 / 1 / 7 / 30 / 50): a little feature play pays little; the full 50 needs `FLIP_V8_SKILL_FULL` = 63 raw, which
  is every trail, sweet spot, zone and checkpoint (or near it with combos on top).
- **Total**: base + skill, capped at 200; no input scores 0. The reveal's lines add up to it (`bandLines`).

## Look-ahead strip (phase 2, 26 Oct)

Session A's fixed bots found gold stars that became readable too late, even for a flawless player, on 31 of 200 seeds: at
top speed the 300 px of view ahead of the runner is barely two flips. flipRev 8 now **announces the course
`FLIP_V8_PREVIEW` = 180 px early**: the next stretch is squeezed into a faint strip along the view's right edge (30 px,
`drawPreviews`), each hazard a short red mark on its surface, each gold star a small gold diamond and each sweet spot a pale
notch (display only; nothing in it collides). The course builder proves every gold star and sweet spot **readable from
there**: from every settled runner (on either surface) a reaction time (12 ticks) after the item enters the strip, a route
still takes it (players may flip again 6 ticks after a landing in this proof; the route proofs keep 14). The skill-band bot
reads hazards, stars and sweet spots from the strip on flipRev 8 (all levels; earlier stamps are unchanged).

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
  0 without the full opportunities (about 250 ms a course with the readability proof). The fallback in `flipCourseV8` was never reached.
- Room identity: `scripts/x200/flip.ts` (arcade-room-schedule-check) plays six room deals with idle, random, weak, good and
  elite input; every scheduled item (hazards and slides, heights, zones, checkpoints, stars, trails, sweet spots) reads the
  same in every run, and the opportunity counts agree.

## Tuning (phase 2: #175's fixed bots)

Paired runs (the same seeds for every level), every run through the server's encode + replay, with #175's fixed bots
(`ctx.fixes`) and this game's flipRev 8 feature chasing: `bun scripts/arcade-skill-bands.ts flip --rev=x
--levels=weak,average,good,great,near,elite,perfect,random --seeds=60` (tuning) and `--seeds=200 --from=10000` (fresh,
measured once, at the end). "Old" is flipRev 6 (LIVE_BANDS' `strictRev`, max 150) with the same fixed bots; new is flipRev 8.
Median (p10–p90) as the tool prints them; min / max and zeros from its JSON.

| Seeds | Level | New median (p10–p90) | New min / max | Old median (p10–p90) |
|---|---|---|---|---|
| Tuning (60) | Weak | 50 (7–116) | 1 / 150 | 38 (11–62) |
| Tuning (60) | Average | 74 (45–150) | 0 / 164 (1 zero) | 72 (34–120) |
| Tuning (60) | Good | 119 (46–153) | 0 / 160 (1 zero) | 120 (59–150) |
| Tuning (60) | Great | 157 (94–168) | 9 / 180 | 120 (89–150) |
| Tuning (60) | Near-perfect | 168 (138–180) | 57 / 200 | 150 (100–150) |
| Tuning (60) | Elite | 180 (172–200) | 69 / 200 | 150 (147–150) |
| Tuning (60) | Flawless | 200 (200–200) | 200 / 200 | 150 (120–150) |
| Tuning (60) | Random | 1 (1–3) | 1 / 3 | 2 (2–4) |
| Fresh (200) | Weak | 46 (4–87) | 1 / 150 | 40 (11–68) |
| Fresh (200) | Average | 63 (8–116) | 1 / 153 | 74 (30–120), 1 zero |
| Fresh (200) | Good | 119 (50–156) | 1 / 160 | 120 (61–150) |
| Fresh (200) | Great | 157 (94–168) | 3 / 176 | 150 (100–150) |
| Fresh (200) | Near-perfect | 172 (134–180) | 3 / 200 | 150 (120–150) |
| Fresh (200) | Elite | 180 (172–200) | 3 / 200 | 150 (150–150) |
| Fresh (200) | Flawless | 200 (200–200) | 200 / 200 | 150 (150–150) |
| Fresh (200) | Random | 1 (1–3) | 0 / 4 (4 zeros) | 2 (2–4), 4 zeros |

No run flagged or disagreeing with the server replay. The tuning set's two zeros (one average, one good) are a slip at the
first hazard: the planned flip came a few ticks too late, after the crash, so the run has no input and scores 0 under the
existing no-input rule; none on the fresh seeds.

**The bar** (Joe's, confirmed 26 Oct): good 119 / 119 against 120 / 120 (within 1 %); near-perfect 168 / p90 180 (tuning)
and 172 / p90 180 (fresh); elite 180 / p90 200 on both; **flawless 200 on every one of the 260 seeds**; random 1. Met on both
sets. Average is 74 on the tuning seeds and 63 on the fresh ones (−15 % against 74; the bar names no figure for average).

**Feature payout by level** (tuning medians): sweet landings 0 weak, 0 average, 1 good, 2 great, 4 near-perfect, 6 elite,
8 flawless (raw 4 each); skill pay 0, 0, 3, 10, 22, 30, 50.

**How it gets there.** The sweet spot is one landing tick wide (was 2), so it needs the flip timed to the tick: near-perfect
lands half of them, elite three quarters, flawless all. The skill pay is steep at the top (61 raw pays 30, the full 63 pays
50), so the near-perfect top 10 % (raw about 61) stays at 180 while the elite top 10 % reaches 200. The base curve's last
stretch is steep too (146 → 150 units, the last gold star, is worth 45 points), as flipRev 6's own curve is (its last star
is worth 30).

**Bot** (`scripts/arcade-skill-bands/bots/flip.ts`): #175's fixed bot, its old-stamp play unchanged (proved event for event
against #175's bot on flipRev 6, 4 and unstamped, every level, fixes on and off), plus flipRev 8's feature chasing: trails,
double flips and sweet spots per level (weak … flawless), the look-ahead strip, a sweet landing only aimed for while a flip
a tick or two off (none for flawless) still lives, and no double flip that costs a planned item or leaves only a
hair-trigger rescue. Elite and flawless keep wanting an item a plan could not fit yet, take the first comfortable flip
window, and stop chasing combos past the cap or with an announced gold star still to take.

**Fitting**: the curves were fitted on the 60 tuning seeds only (a search over the base knots and the pay scale, scored on
bootstrap resamples of those seeds); the fresh seeds were measured once, after the fit.

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

Local, 26 Oct 2026, after phase 2 (on the PR branch with #175 merged; a machine shared by four workers, so browser frame
times run high):

- PASS: flip-x200-check (677 checks, ~30 s: legacy replay, stamp, courses, the 260-seed guarantee and witnesses, sweet-spot
  rules, caps, saves, idle and random play, stored flipRev 8 runs, texts), scoring-bands-check, scoring-targets-check,
  arcade-help-bands-check, intro-score-text-check, replay-check, round-max-check, sound-manifest-check, practice-bests-check,
  arcade-fx-check, reveal-score-check, arcade-self-replay-check (the five flip entries, `flip/x200` included, at 40 runs),
  arcade-batch1-check, arcade-tuning-c-check, flip-bend-check, hotfloor-flip-check, arcade-score-bands-check,
  intro-demo-check, arcade-play-check flip (26.4 ms against the 17.0 baseline, within limits; 43 ms when run alongside the
  fresh band run), arcade-fill-check flip, bottom-clearance-check flip; `bunx tsc --noEmit` clean.
- arcade-room-schedule-check: Roofbound's lines pass (6 deals × 5 styles, 539 scheduled items identical); the check stops
  on Hover's module, which imports a `randomBot` that #175's fixed `bots/hover.ts` no longer exports (the Hover port, not
  Roofbound).
- Not run here (the coordinator runs them after merging): arcade-room-practice-check, arcade-lowend-check (which does not
  cover Roofbound).

## Assumptions and notes

- "A sweet spot on each roof": the guarantee rule needs a fixed count, so every course has eight sweet spots on eight of
  its roofs (stretches of clear surface), placed by the seed, rather than one on every stretch (whose number varies).
- The landing is judged on the runner's centre (its feet), the tick the flip's arc ends; the strip is drawn over exactly
  that x-span. A double flip off a sweet spot still counts the landing.
- The look-ahead strip (phase 2) is a display change Joe has not seen yet: it answers Session A's finding that stars were
  readable too late; the strip and its proof could instead be a wider view if he prefers.
- The checkpoint saved-crash rule is kept from the parked expansion as Joe listed it, flagged for his confirmation.
- Combos are not needed for the ceiling (the full skill pay needs only the guaranteed items), so a seed's number of combo
  chances never limits the top; they add raw points on top (up to 4).
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
