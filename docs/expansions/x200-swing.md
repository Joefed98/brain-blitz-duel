# Grappler to 200: swingRev 13

26 Oct 2026. Grappler (`swing`) raised to 200 (`ROUND_MAX.swing`, docs/scoring-200.md) on a new stamp,
**swingRev 13** (`SWING_REV_EXPAND`). Rooms, practice, the daily and challenges deal it from `SWING_V13_BANK`; every
earlier revision plays and scores exactly as before (proved by `swing-x200-check`). This finishes the parked E7
Grappler expansion (PR #164, `claude/e7-parked`, swingRev 12) on today's main and adds par times.

**The parked stamp.** swingRev 12 was never dealt (never merged or published). Its rules now gate on swingRev 13
(`SWING_REV_EXPAND = 13`; every `V12` name is `V13`, `swingBankV12.server.ts` is `swingBankV13.server.ts`), so
nothing deals or names 12. A stored round stamped swingRev 12 (none exist) would play as swingRev 11's
(`swingGameFor` has no 12 branch).

## World and features (from the parked expansion, kept)

- **More world**: a 450 × 844 view (the iPhone 11 arena box's shape, 414 × 772), the hero 225 px from the left; the
  lava 224 px below rev 8's (114 below rev 9's), each jet's top where it was; ceiling, anchors, spikes, stalactites,
  dragon and course draws are rev 9's; the ten touch stars re-proved on the deeper cave.
- **High route**: 12 cave crystals (gems) at the tops of proved flights near the ceiling (touch radius 22 px).
- **Low route**: 8 speed gates under anchors, their openings around the deepest proved fast swing; lit by a forward
  pass at 7 px a tick or faster.
- **Swing combos**: fast (≥ 7 px a tick), quick (≤ 60 ticks), forward flying grabs grow a chain; a chain
  reaching 5, 10 and 15 links pays 2, 3 and 5 combo points (phase 1, below).
- **Set-route sections**: two or three per course before the dragon (from about 22, 80 and 145 m): a wide start
  ledge, three landing ledges (the middle one of sections 2 and 3 collapses 45 ticks after the first landing) and a
  finish-flag ledge, each on a proved kick-and-release from the one before. Ledges are one-way; landed, the hero
  walks to the centre and kicks off with the next press.

## New: a par time per section

- Each section's **par** (`state.pars`, ticks) is built with the course, from the course alone: its fastest proved
  route (`sectionWitness` in swing.ts: each hop kicks off a ledge's centre, as every kick does, and lets go on the
  release whose flight comes down first on the next ledge of the section by the game's own landing test, counting
  the walk to the next centre), plus the longest walk on the start ledge (10 ticks), plus `SWING_PAR_MARGIN` (48
  ticks, 0.8 s). Never from the player: it is fixed at init and identical for everyone in the room
  (arcade-room-schedule-check, swing-x200-check).
- A section **cleared** (every ledge landed) with its flag landed under par pays its share of `SWING_PAR_POINTS`
  (25, shared by the course's two or three sections) in proportion to the margin, the full share from
  `SWING_PAR_FULL` (36) ticks under par, so within 12 ticks of the fastest route plus the start walk. At or over par,
  a skipped ledge or no start landing pays nothing (`swingSectionPar`, `swingFeaturePoints`).
- **Shown subtly**: "PAR 4.5 s" in small muted gold over each start ledge until the section is done; while a section
  runs, a small clock under the distance ("1.2 s · PAR 4.5", gold while under par, grey once past it,
  `swingRunningSection`); finishing under par pops "−0.8 s UNDER PAR" (the shared effect layer) with the
  `swing.parBeaten` cue (the existing `done.goldPulse.mp3`, in place of the section chime), and a replay moment
  `swing.par`. Mute, the Effects slider, reduced motion and reduced effects apply through the shared layer.
- Stored: `extra` carries `sections`, `parsBeaten`, `parBeat`, `parPts` (and every other feature count, the raw
  skill points and what they paid); the reveal tiles show "Sections n / m · k under par", the round summary a line.

## Scoring (`swingScoreV13`)

- **Base**: metres (to 500) + 5 a star on `SWING_V13_BAND_CURVE` (to 140; units 0/20/40/60/75/95/120/170/245/315/
  440/489/500/515 → 0/19/36/50/64/82/91/99/110/122/130/133/135/140; 140 from 500 m with three of the ten stars), + 10
  for 500 m: at most 150. Fitted (phase 2) on the tuning seeds against swingRev 11 with the same fixed bots on the
  same courses (paired), so good stays within a few per cent of today and average and weak near it.
- **Skill** (raw points, `swingFeaturePoints`): combo tier points (at most `SWING_COMBO_CAP` 10), a point a gem (12)
  and a lit gate (8), 15 shared by the ledges landed, 25 shared by the pars (`SWING_PAR_POINTS`). Paid on a rising
  scale (`SWING_SKILL_PAY`: raw 10 pay 4, 20 pay 12, 26 pay 20, 34 pay 28, 42 pay 38, the full 50 at 46): light use
  pays little, the full 50 needs most of what a course offers, par included.
- **Total**: base + skill, capped at 200; no input scores 0.
- The parked branch's skill (a flat point each, capped at 50; combos up to 25) is replaced by this scale.

## The guarantee (the arcade rule)

Every course rooms deal guarantees, whatever the seed: 10 stars, 12 gems, 8 gates, two or three full sections and a
par for each. The seed decides only where. A course's **perfect-play ceiling** (`scripts/swing-x200-lib.ts`) is
the base for 500 m with all ten stars (150) plus the pay of the raw points it guarantees without counting a single
combo point: 12 + 8 + 15 (every ledge) + 25 (every par) = `SWING_GUARANTEED_RAW` 60 ≥ 46, so 50; ceiling 200.
Reachability: 500 m with all ten stars is the bank's own witness on this course and revision (each within the
minute); gems and gates sit on proved flights and proved fast swings (generation); every ledge and every par is
played in the real game (`sectionRoute`: from the start ledge's centre, each press the tick after a landing, each
let-go the earliest that lands on the next ledge), every route must finish at least `SWING_PAR_FULL` ticks under
par, and no ledge may stand under a stalactite (within the ledge's half-width + the rock's half-width + the hero's
radius), so a hero standing to kick off is never under a falling rock. The pay saturates at raw 46 of the 60
guaranteed (plus up to 10 combo points), so a flawless player may skip some gems or gates where they conflict, and
the base needs only three stars at 500 m.

- **Room bank**: `scripts/swing-bank.ts --expand` re-proved every SWING_V9_BANK course; a course is kept when it
  carries every feature, its reference search reaches 500 m with every star and its ceiling is 200. The rebuild
  matched the parked bank's 180 entries; the ceiling test removes twelve (three where a stalactite falls on the swing
  one section's last hop needs, nine with a ledge under a stalactite), so rooms deal **168 courses**, every one with
  a ceiling of 200 (`scripts/fixtures/swing-x200-ceiling.json`, lowest 200; swing-x200-check recomputes a sample,
  all 168 with `CHECKS_FULL=1`).
- **Tuning and fresh seeds** are bank courses: the skill-band tool's `seedForRev` deals swingRev 13 (and the
  swingRev 11 baseline, so the two are paired) as `SWING_V13_BANK[roomSeed(n) % 168]`. Tuning indices 0–59 play
  52 distinct courses; fresh indices 10000–10199 play 113, 81 of them (139 runs) courses the tuning never saw. Both
  sets' lowest ceiling is 200 (every bank course's is).

## Tuning (paired; `bun scripts/arcade-skill-bands.ts swing --rev=x --jobs=1`)

The bots are #175's fixed bots (`scripts/arcade-skill-bands/bots/swing.ts`, with the rope reel) plus this
expansion's feature play on swingRev 13 only; older revisions play exactly as #175's bot does (`fixes`). "Old" is
swingRev 11 (LIVE_BANDS' `strictRev`) with the same bots on the same courses; "new" is swingRev 13. Median / p90; no
run was flagged or disagreed with the server replay. Tuned on the 60 tuning seeds only; the fresh 200 are reported.

| Seeds | Weak | Average | Good | Great | Near-perfect | Elite | Flawless | Random |
|---|---|---|---|---|---|---|---|---|
| Tuning 60, new | 41 / 97 | 84 / 107 | 115 / 137 | 153 / 163 | 168 / 183 | 179 / 200 | 200 / 200 (min 200) | 5 / 11 |
| Tuning 60, old median | 44 (−7 %) | 83 (+1 %) | 110 (+5 %) | 136 | 147 | 148 | 147 | |
| Fresh 200, new | 36 / 93 | 92 / 111 | 116 / 147 | 153 / 166 | 167 / 179 | 179 / 197 | 200 (min 142) | 5 |
| Fresh 200, old median | 44 (−18 %) | 85 (+8 %) | 109 (+6 %) | 136 | 147 | 148 | 147 | |
| Fresh, unseen courses (139) | | | +9 % | | 168 / 177 | 179 / 197 | | |

Joe's bar: near-perfect median 165–175 and p90 ≤ 185 (168 / 183 tuning, 167 / 179 fresh); elite p90 190–200 and
median ≥ 175 (179 / 200 tuning, 179 / 197 fresh); good within ±10 % (+5 %, +6 %); no zero for weak or average (none
on either set, none for any level but random); random near 0 (median 5, max 18 tuning and 20 fresh, one zero on
each set). Flawless reaches 200 on every tuning seed; on the fresh set 192 of 200 runs reach 200 and 8 runs on six
courses fall short (1982452008: 142, a stalactite; 1216593723: 161 and 2061088918: 182, lava jets; 1791192742: 186
and 1275108123: 194, a section missed; 812230477: 190, out of time at 486 m). Each of those courses has a proved
ceiling of 200, so these are the bot's limits, not the course's.

**Feature payout** (tuning 60, median / p90): skill paid weak 0, average 0, good 3, great 11, near-perfect 20 / 33,
elite 30 / 50, flawless 50; of it, raw par points (of 25): weak to good 0, great 0 / 2, near-perfect 3 / 10, elite
8 / 16, flawless 25. Par is the headroom: it separates elite from near-perfect and only flawless play takes it all.

The bot (rev 13) reads the level (`TIER_CFG`): how often it goes for stars, gems, gates and sections, what each is
worth to it, how soon it presses after landing, the shortest swing it waits for and whether it trusts a two-tick
release window. On a set route it watches the swing for the release that lands on the next ledge (flawless takes the
earliest tick, others aim at the middle of the window) and reels in to reach a start ledge; the great to flawless
levels search for gem flights and gate swoops, held back by the dragon's lead and, from tick 1,200, by the clock
(each level's cruise pace with 120 ticks spare). It kicks off a standing ledge only on a survivable swing, checks
safety on the tick it actually aims for, and lets go as a last resort when the dragon is out.

## Files

`src/lib/arcade/swing.ts` (the rev-13 block: pars, combo tiers, `sectionWitness`, `swingSectionPar`,
`swingRunningSection`, `swingParLabel`, the pay scale, the base curve), `swing.renderer.ts` (ledges, gems, gates, the
par label and clock), `src/lib/duel/{swing.ts, swingProof.server.ts, swingBankV13.server.ts, arcade.server.ts,
grade.ts, roundSummaries.ts, instructions.ts, introScore.ts, introDemo.functions.ts, roundMax.ts,
practiceStamps.data.ts}`, `src/lib/arcade/{liveBands.ts, reveal.ts, revealRenderers.ts, arcadeFxGames.renderer.ts}`,
`src/lib/fx/{manifest.ts, momentCues.ts}`, `src/lib/replay/moments.ts`, `src/puzzles/swing.tsx`, the sound-cue docs
and cue sheet; scripts: `swing-x200-check.ts`, `swing-x200-lib.ts`, `swing-x200-ceiling.ts`, `swing-x200-legacy.ts`,
`swing-x200-witness.ts`, `swing-bank.ts --expand`, `shots/swing-x200-shots.ts`, `x200/swing.ts`,
`arcade-skill-bands/bots/swing.ts`, `arcade-skill-bands/games.ts` (`seedForRev`), `arcade-skill-bands.ts`; fixtures
`swing-x200-{legacy,runs,ceiling}.json`, `replay-runs.json`.

## Intro and help

Intro HOW lines: "Hold to grab and swing, let go to fly." / "Fly high for gems, swoop fast through gates." /
"Land each ledge route under its par time." SCORE: "Distance and stars. Reach 500 metres for 10 more. Gems, gates,
ledges, pars: up to 200." The "?" help explains each feature (combo tiers at 5, 10 and 15 fast regrabs, high and low
routes, set routes, par times) and the skill pay. **The intro demo needs re-recording on swingRev 13**;
`introDemo.functions.ts` stops any older one, so the intro shows its still.

## Screenshots

`screenshots/x200-oct-2026/swing-par-414x896.png` (a route running: the clock under the distance),
`swing-par-start-414x896.png` (a start ledge with its "PAR x.x s"), `swing-gem-gate-414x896.png` (a gem and a speed
gate): the game's renderer drawing the recorded elite 200 run at the iPhone 11 home-screen play box (414 × 772 under
a 60 px header, 2×; the header is a stand-in), `bun scripts/shots/swing-x200-shots.ts`.

## Assumptions

- The tool's swingRev 11 baseline is measured on the swingRev 13 bank's courses (all in SWING_V9_BANK, which rev 11
  rooms dealt) so the comparison is paired; checks keep reading `seedFor`.
- Par counts only a cleared section (every ledge landed): faster, cleaner swinging pays, skipping does not.
- Combo tiers are never counted in the guarantee.
- Weak's median falls 44 → 41 on the tuning set and 44 → 36 on the fresh set (−18 %); the bar covers weak only by
  "no zeros"; lifting weak further lifted good past its ±10 %.
- "Flawless reaches 200 on every seed" holds on every tuning seed and every course's proved ceiling; the flawless bot
  misses it on six fresh courses (above). Not tuned on the fresh set.
- docs/arena-sizes-oct-2026.md still lists Grappler at 390 × 730 (rev 13 is 450 × 844); left for the merge
  (presentation-geometry-check rewrites the whole table, other games' lines included).

## Checks (local, 26 Oct 2026, after phase 2)

Pass: swing-x200-check (173 checks; `CHECKS_FULL=1` 2,618 checks in 279 s: every bank course's features, 1,925
ledges in the real sim and all 168 ceilings), round-max-check, intro-score-text-check, arcade-help-bands-check,
scoring-bands-check, scoring-targets-check, arcade-score-bands-check, sound-manifest-check, practice-bests-check,
arcade-chart-check, six-game-scoring-check, swing-rev8-check, arcade-batch3-check, arcade-tuning-a-check,
arcade-tuning-c-check, arcade-tuning-e-check, arcade-tuning-f2-check, arcade-tuning-g3-check, replay-check,
reveal-score-check, arcade-fx-check, help-scroll-check, burst-swing-score-check, arcade-self-replay-check (with the
`swing/expand` entry), arcade-play-check swing (frame 25.6 ms against the 17.8 ms baseline, within its limits), `bunx
tsc --noEmit`. Earlier on this stamp: bottom-clearance-check swing, arcade-fill-check swing.

arcade-room-schedule-check: Grappler's lines pass (checked with a copy filtered to Grappler, since deleted); the
whole check fails only because Hover's module (another session's) has no `randomBot` yet.

Not run here (the coordinator's, after merging): arcade-room-practice-check and arcade-lowend-check (the latter needs
a quiet machine for Grappler's line).

## Phase 1 (26 Oct 2026): achievable combos and a 200 within human reach

Session A's fixed bots found Grappler topping out at 161 / 164 / 167 (near-perfect / elite / flawless) with no seed
at 200. Changed in place on swingRev 13 (never dealt outside the unmerged PR): combo tiers (`SWING_COMBO_TIERS` 5 / 10
/ 15 paying `SWING_COMBO_TIER_PAY` 2 / 3 / 5, a `comboTiers` counter in the checkpoint after every earlier value,
driving the effect streak so each tier is one moment), and the base reaching 140 with fewer than ten stars.

## Phase 2 (26 Oct 2026): #175's fixed bots and Joe's bar

- Merged #175's bots (d74da894) and ported the rev-13 feature play into its fixed `bots/swing.ts`; old-stamp play is
  #175's exactly under `fixes`. Added a flawless level config and the pacing and safety rules above.
- `SWING_PAR_POINTS` 15 → 25 and the pay scale moved to saturate at raw 46, so par is the headroom between elite and
  flawless; the base curve refitted on the tuning seeds (140 from 500 m with three stars).
- The bank lost nine more courses (a ledge under a stalactite), 177 → 168; the ceiling fixture, rev-13 runs (now an
  elite 200), the replay fixture run and the screenshots were re-recorded.
