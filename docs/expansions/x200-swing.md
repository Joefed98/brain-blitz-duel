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
  (15, shared by the course's two or three sections) in proportion to the margin, the full share from
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
  440/489/510/530 → 0/15/29/44/60/80/89/98/109/122/130/133/136/140; 140 from 500 m with six stars, phase 1), + 10 for 500 m: at most 150. Refitted
  (26 Oct) by matching the weak, average and good players' unit quantiles on rev 13 to their scores on rev 11 on
  the same courses (paired), so players who ignore the features keep today's score.
- **Skill** (raw points, `swingFeaturePoints`): combo points (at most `SWING_COMBO_CAP` 10), a point a gem (12) and a
  lit gate (8), 15 shared by the ledges landed, 15 shared by the pars. Paid on a rising scale
  (`SWING_SKILL_PAY`: raw 6 pay 4, 12 pay 12, 20 pay 24, 28 pay 36, 36 pay 46, the full 50 at 42), Breaker's shape:
  light use pays little, the full 50 needs most of what a course offers.
- **Total**: base + skill, capped at 200; no input scores 0.
- The parked branch's skill (a flat point each, capped at 50; combos up to 25) is replaced by this scale.

## The guarantee (the arcade rule)

Every course rooms deal guarantees, whatever the seed: 10 stars, 12 gems, 8 gates, two or three full sections and a
par for each. The seed decides only where. A course's **perfect-play ceiling** (`scripts/swing-x200-lib.ts`) is
the base for 500 m with all ten stars (150) plus the pay of the raw points it guarantees without counting a single
combo point: 12 + 8 + 15 (every ledge) + 15 (every par) = `SWING_GUARANTEED_RAW` 50 ≥ 42, so 50; ceiling 200.
Reachability: 500 m with all ten stars is the bank's own witness on this course and revision (each within the
minute, 2,7xx–2,8xx ticks of 3,600); gems and gates sit on proved flights and proved fast swings (generation); every
ledge and every par is played in the real game (`sectionRoute`: from the start ledge's centre, each press the tick
after a landing, each let-go the earliest that lands on the next ledge), and every route must finish at least
`SWING_PAR_FULL` ticks under par. The pay saturates at raw 42 of the 50 guaranteed (plus up to 10 combo points), so
a perfect player may skip some gems or gates where they conflict. A witness search (`scripts/swing-x200-witness.ts`,
a beam search with the ledge routes) finds 199 and 198 on the first two bank courses; the stored 200
(`scripts/fixtures/swing-x200-runs.json`) is a witness run on course 1032160737 (500 m, all ten stars, 10 gems, all 8 gates, all 10 ledges, 10 combo
points) replayed through the server; over the first 20 bank courses the search reached 200 on three and 197–199
on the rest (its shortfalls are mostly stars: a search limit, not the course's).

- **Room bank**: `scripts/swing-bank.ts --expand` re-proved every SWING_V9_BANK course (19 min here); a course is
  kept when it carries every feature, its reference search reaches 500 m with every star and its ceiling is 200.
  The rebuild matched the parked bank's 180 entries exactly; the ceiling test then removed three (353288422,
  470269692, 202606151: a stalactite falls on the swing that the last hop of one section needs, which the bank's
  course-only search never simulated), so rooms deal **177 courses**, every one with a ceiling of 200
  (`scripts/fixtures/swing-x200-ceiling.json`, lowest 200; swing-x200-check recomputes a sample, every course with
  `CHECKS_FULL=1`).
- **Tuning and fresh seeds** are bank courses: the skill-band tool's `seedForRev` deals swingRev 13 (and the
  swingRev 11 baseline, so the two are paired) as `SWING_V13_BANK[roomSeed(n) % 177]`. Tuning indices 0–59 play
  54 distinct courses; fresh indices 10000–10199 play 119, 83 of them (139 runs) courses the tuning never saw. Both
  sets' lowest ceiling is 200 (every bank course's is).

## Tuning (paired; `bun scripts/arcade-skill-bands.ts swing --rev=x --levels=weak,average,good,great,near,elite,random`)

"Old" is swingRev 11 (LIVE_BANDS' `strictRev`) on the same courses; "new" swingRev 13. Median / p90 / best; no run
was flagged or disagreed with the server replay.

| Seeds | Weak | Average | Good | Great | Near-perfect | Elite | Random |
|---|---|---|---|---|---|---|---|
| Tuning 60, new | 25 / 68 / 97 | 79 / 107 / 118 | 113 / 142 / 149 | 150 / 177 / 184 | 171 / 185 / 193 | 189 / 194 / 197 | 3 / 8 / 14 |
| Tuning 60, old median | 31 | 83 (−5 %) | 107 (+6 %) | 134 | 146 | 146 | 4 |
| Fresh 200, new | 28 / 73 / 102 | 79 / 106 / 123 | 110 / 142 / 169 | 147 / 175 / 183 | 175 / 186 / 194 | 190 / 194 / 197 | 4 / 8 / 16 |
| Fresh 200, old median | 30 | 83 (−5 %) | 109 (+1 %) | 129 | 145 | 146 | 5 |
| Fresh, unseen courses (139) | 29 | 80 (−2 %) | 108 (0 %) | 146 | 177 / 187 | 191 / 195 | 5 |

Zero scores: none for weak to elite on either set (random: 0 of 60 tuning, 2 of 200 fresh, as on rev 11).
Skill paid (median by tier, tuning 60): weak 0, average 0, good 4, great 21, near-perfect 34, elite 46 (p90 50); of which the par (raw par
points, of 15): weak to great 0 (great p90 1), near-perfect 1 (p90 5), elite 6 (p90 10).

The bots (`scripts/arcade-skill-bands/bots/swing.ts`, rev 13 only, older revisions play exactly as before) read the
Human's tier (`TIER_CFG`): how often a tier goes for stars, gems, gates and sections, what each is worth to it, how
soon it presses after landing, how long a swing it waits for, and whether it trusts a two-tick release window. On a
set route it watches the swing for the release that lands on the next ledge (and reels in to reach a start ledge);
the great to elite tiers also search for gem flights and gate swoops, held back by the dragon's lead. Elite and
near-perfect play different runs (their own profile, stream and appetite: elite goes for every gem, gate and
section, presses at once and takes two-tick windows).

## Files

`src/lib/arcade/swing.ts` (the rev-13 block: pars, `sectionWitness`, `swingSectionPar`, `swingRunningSection`,
`swingParLabel`, the pay scale, the refitted base curve), `swing.renderer.ts` (ledges, gems, gates, the par label and
clock), `src/lib/duel/{swing.ts, swingProof.server.ts, swingBankV13.server.ts, arcade.server.ts, grade.ts,
roundSummaries.ts, instructions.ts, introScore.ts, introDemo.functions.ts, roundMax.ts, practiceStamps.data.ts}`,
`src/lib/arcade/{liveBands.ts, reveal.ts, revealRenderers.ts, arcadeFxGames.renderer.ts}`, `src/lib/fx/{manifest.ts,
momentCues.ts}`, `src/lib/replay/moments.ts`, `src/puzzles/swing.tsx`, the sound-cue docs and cue sheet; scripts:
`swing-x200-check.ts`, `swing-x200-lib.ts`, `swing-x200-ceiling.ts`, `swing-x200-legacy.ts`, `swing-x200-witness.ts`,
`swing-bank.ts --expand`, `shots/swing-x200-shots.ts`, `x200/swing.ts`, the bot and `games.ts` lines,
`arcade-skill-bands.ts` (`seedForRev`); fixtures `swing-x200-{legacy,runs,ceiling}.json`, `replay-runs.json`.

## Intro and help

Intro HOW lines: "Hold to grab and swing, let go to fly." / "Fly high for gems, swoop fast through gates." /
"Land each ledge route under its par time." SCORE: "Distance and stars. Reach 500 metres for 10 more. Gems, gates,
ledges, pars: up to 200." The "?" help explains each feature (combos, high and low routes, set routes, par times)
and the skill pay. **The intro demo needs re-recording on swingRev 13**; `introDemo.functions.ts` stops any older
one, so the intro shows its still.

## Screenshots

`screenshots/x200-oct-2026/swing-par-414x896.png` (a route running: the clock "1.2 s · PAR 4.5" under the distance),
`swing-par-start-414x896.png` (a start ledge with "PAR 4.5 s"), `swing-gem-gate-414x896.png` (a gem and a speed
gate): the game's renderer drawing a recorded elite run at the iPhone 11 home-screen play box (414 × 772 under a
60 px header, 2×; the header is a stand-in), `bun scripts/shots/swing-x200-shots.ts`.

## Assumptions

- The tool's swingRev 11 baseline is measured on the swingRev 13 bank's courses (all in SWING_V9_BANK, which rev 11
  rooms dealt) so the comparison is paired; checks keep reading `seedFor`.
- Par counts only a cleared section (every ledge landed): faster, cleaner swinging pays, skipping does not.
- Combos stay a parked feature but pay at most 10 raw; they are never counted in the guarantee.
- Weak players' median moved 31 → 25 on the tuning set (−7 % fresh); the bar does not cover weak beyond "no
  zeros"; the base curve was fitted to weak, average and good together.
- docs/arena-sizes-oct-2026.md still lists Grappler at 390 × 730 (rev 13 is 450 × 844); left for the merge
  (presentation-geometry-check rewrites the whole table, other games' lines included).

## Checks (local, 26 Oct 2026; four workers sharing four cores)

Pass: swing-x200-check (176 checks, 9 s; `CHECKS_FULL=1` 2,757 checks: every bank course's features, 2,030 ledges
in the real sim and all 177 ceilings), arcade-room-schedule-check (Grappler's lines: 6 deals × 5 styles, 299
scheduled items identical, 13 s; it fails only on the three other games' missing modules), round-max-check,
scoring-bands-check, scoring-targets-check, arcade-score-bands-check, arcade-help-bands-check,
intro-score-text-check, reveal-score-check, replay-check, arcade-self-replay-check (with the appended
`swing/expand` entry), arcade-fx-check, sound-manifest-check, practice-bests-check, arcade-chart-check,
help-scroll-check, swing-rev8-check, burst-swing-score-check, arcade-batch1-check, arcade-batch3-check,
arcade-tuning-a-check, arcade-tuning-c-check, arcade-tuning-e-check, arcade-tuning-f2-check,
arcade-tuning-g3-check, six-game-scoring-check, four-tuning-check, intro-demo-check, pinball-check,
player-looks-check, presentation-geometry-check, bottom-clearance-check swing, arcade-fill-check swing,
arcade-play-check swing (frame 29.9 ms against the 17.8 ms baseline, within its limits; a first attempt under heavy
load timed out in the layout harness, Breaker passed beside it), `bunx tsc --noEmit`.

Not run here (the coordinator's, after merging): arcade-room-practice-check and arcade-lowend-check. Frame times
measured with `bun scripts/arcade-perf.ts swing --rates=1,4` on the loaded machine (1×: 19.3 ms; 4×: 8.5 fps, but
Tilt measured 15.9 fps beside it, against its 30 fps floor in arcade-lowend-check) are not trustworthy here;
**arcade-lowend-check's Grappler line needs a run on a quiet machine**.

## Phase 1 (26 Oct 2026, evening): achievable combos and a 200 within human reach

Session A's fixed bots found Grappler topping out at 161 / 164 / 167 (near-perfect / elite / flawless) with no seed
at 200: the old combo (a point every fifth link) only mattered for chains of 25+ fast regrabs, and the base needed
every one of the ten stars. Changed in place on swingRev 13 (never dealt outside the unmerged PR):

- **Combo tiers** (`SWING_COMBO_TIERS` 5 / 10 / 15, `SWING_COMBO_TIER_PAY` 2 / 3 / 5): a chain pays as it reaches
  each tier, 10 raw points for a full 15-link chain (still capped at `SWING_COMBO_CAP` 10). A new state counter,
  `comboTiers` (in the checkpoint, after every earlier value), drives the effect streak, so each tier is one moment.
- **Base**: 140 from 500 m with six of the ten stars (530 units; was 550, all ten), so a flawless human-paced run
  does not have to take every star to reach 200. Below 489 units the curve is unchanged (good and average keep
  their scores).
- **Par time stays the headroom feature** (unchanged: fastest proved route + start walk + 48 ticks, full share from
  36 under).
- **Ceiling**: unchanged at 200 on every bank course (the fixture recomputes byte for byte); the guaranteed raw
  points (50, no combos counted) are now joined by up to 10 from a single 15-link chain, and the base needs six
  stars, not ten.
- With these, the witness search (`scripts/swing-x200-witness.ts 20 400`) reaches 200 on 19 of the first 20 bank
  courses (199 on the other; before: 3 of 20), and an elite skill-band run reaches 200 (room deal 4).
- Re-recorded: `scripts/fixtures/swing-x200-runs.json` (rev-13 runs, the elite 200 and a witness 200) and the
  swing run in `scripts/fixtures/replay-runs.json`. Final tuning waits for Session A's bots (phase 2).
