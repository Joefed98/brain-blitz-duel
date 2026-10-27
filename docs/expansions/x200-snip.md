# Scrumper to 200: snipRev 11 (26 Oct 2026)

Scrumper (`snip`) is raised from 150 to 200 (`ROUND_MAX.snip`, docs/scoring-200.md). Rooms, practice, the daily and
challenges deal **`snipRev 11`** (`SNIP_REV_EXPAND`, `src/lib/arcade/snip.ts`, "Expansion"). It ports the parked
world expansion from PR #163 (E8, branch `claude/e8-parked`, Scrumper only: Wavefront and Tilt are not part of this
work) onto today's main and adds one new precision feature, a **par time per level**.

The parked stamp `snipRev 10` was never dealt (never merged or published). It is folded into 11: every expansion rule
is gated on the course state that only `snipGameFor(11)` builds, and nothing names or deals 10. A stored round stamped
10 (none exist) would play through `snipGameFor`'s unstamped default, exactly as on main (snip-x200-check pins it).
Every revision rooms ever dealt (unstamped, 2–9) plays and scores exactly as before.

## The world (from the parked expansion, unchanged)

- **A tall course**: each level is 360 px wide and 1,200 px tall (`SnipCourse.h`), seen through a 360 × 672 view
  (`SNIP_X_VIEW_H`) under a vertical camera the sim carries (`camY`, whole px), so the phone, the reveal, the effects
  layer and the cut mapping see the same view.
- **The opening pan**: each level opens with a 1 s pan (`SNIP_X_PAN_TICKS` = 60) from the basket up to the fruit; cuts
  are ignored during it and the level clock runs.
- **Six levels a run** (2 easy, 2 medium, 2 hard from the 36-course bank `snipCourses.data.ts`), up to 14 s each, in the
  same 60 s run.
- **Features kept**: 1–3 fruits a level, pegs (picker's crooks) and rings that catch a free fruit and re-hang it on a
  vine, planks, gutters, chutes, springy branches, wasp nests, sliding baskets, the golden apple on levels 2, 4 and 6
  (golden for the level's first 7 s), wind (a seeded preset per level swinging the ropes), two golden leaves a course,
  fewest cuts (every swipe counts, a miss too; a level fed in no more than the course's `par` strokes is a par level),
  the level map at the top right.

## The new feature: par time

- Every course carries a **par time** (`SnipCourse.parT`, level ticks from the level's start, the pan included): the
  slowest of its deals' fastest stored perfect plans (every fruit at par cuts, both leaves, the golden fruit while
  golden; over the 3 pin shifts × 3 wind presets and every golden choice) plus a fixed margin, `SNIP_X_PAR_MARGIN` =
  60 ticks (1 s). Course data only, written by `scripts/snip-x200-plans.ts`; the same for every player, never from how
  anyone has played. Par times run from 5.6 s (Hedgerow steps) to 10.0 s (Orchard hop).
- A level whose every fruit is fed **at par cuts** before the par time earns credit for each tick under it, up to the
  margin (`quickTicks`, `quickLevels` in the state): quick **and** clean. A level fed off par cuts earns none. The full
  credit is reached at the slowest deal's proof time, so it needs the earliest workable cut; on most deals a perfect
  plan beats par by more.
- **HUD**: the line under the frame reads "Level 2 · 1/1 cuts · par 5.7s"; the par figure dims once the level's clock
  passes it. A small pocket-watch dial under the windsock runs down to the par time (display only, view space).
- **Effects and sound**: a "QUICK!" pop over the basket when a level ends under par time (`SNIP_FX`), the leaf chime a
  little higher and softer (`snip.star` at rate 1.35, existing recording). Replay moment `snip.quick` ("Under par time",
  with `snip.golden` and `snip.ring` for the parked features' pops; all on `replay.moment.mp3`, manifest entries added,
  cue sheet regenerated).
- Recorded for the reveal and reports: `quickLevels` and `quickTicks` in the graded `extra`, the reveal's "Quick n / 6"
  tile and the round summary's detail line.

## Scoring (snipRev 11)

- **Base (≤ 150)**: units are each level's fruits sharing 18 and a leaf 2 (120 = everything on all six levels) on
  `SNIP_V11_BAND_CURVE` to 140, plus up to 10 for speed when every fruit of every level is fed (full by 48 s).
  Knots (units → points): 40 → 17, 60 → 25, 75 → 33, 85 → 66, 92 → 81, 98 → 94, 104 → 111, 110 → 132, 115 → 138,
  120 → 140; every unit adds at least 0.4 points.
- **Skill (≤ 50)**, raw points (`snipFeatureRaw`, in tenths, at most 50): 5 a golden apple fed in time, 2 a level at
  par cuts, 2 a second leaf, up to 1.5 a level under its par time (scaled by the ticks under it, at par cuts only),
  2 for a perfect run (every level perfect, every golden apple and the full par-time credit on all six). Paid on
  `SNIP_X_SKILL_PAY`, a rising scale: raw 10 pays 3, 20 pays 6, 26 pays 22, 30 pays 34, 34 pays 36, 38 pays 38,
  42 pays 45, 46 pays 47 and the full 50 needs all 50.
- Total `bandTotal(parts, acted, 200)`; no input scores 0; grading's "correct" flag is 200 on snipRev 11 (150 before).

## The guarantee: every deal can reach 200

The deal of a level (course, pin shift, wind preset, golden fruit) comes from the seed alone; the rng is not touched
during play, so the six deals are fixed before the first cut. The proof (snip-x200-check, section 3–4):

1. **Every course deal has a perfect plan**: all 36 courses × 9 deals × every golden choice (and no golden fruit)
   have a stored human-paced plan (`fixtures/snip-x200-proofs.json`, `best`; first cut ≥ 24 ticks after the pan,
   strokes ≥ 12 ticks apart) that feeds every fruit at par cuts with both leaves and the golden fruit in time, and
   ends inside the full par-time credit (`tick + margin ≤ parT`). Replayed in the check: 324 deals.
2. **Counts**: a perfect level is 20 units, par cuts, a second leaf and 1.5 raw points of par time; three golden
   apples a run. Six perfect levels are 120 units (140 points) and raw 15 + 12 + 12 + 9 + 2 = 50 (pays 50).
3. **Speed**: the slowest run of perfect plans the bank can deal (each band's two distinct courses, the golden one at
   its slowest golden choice) ends at tick **2,734** (45.6 s), inside the full speed bonus (by tick 2,880, 48 s).
   So **every possible deal's ceiling is 200** (140 + 10 + 50), not just the seeds measured.
4. **Witnesses** through the server replay: the stored perfect plans score **200 on all 60 tuning seeds** (room seed
   indices 0–59) **and all 200 fresh seeds** (10000–10199). Lowest ceiling: 200 on both sets and on the bank.

The parked note "200 on 11 of the first 12 room seeds" (one deal at 199, finishing at 49 s) is fixed by
`scripts/snip-x200-plans.ts`: it searched every deal for the fastest perfect plan (from every stored plan of the
course, shifted in time, then stroke by stroke), cutting the slowest course's perfect time from 748 to 414 ticks and
the worst bank run from ~3,690 ticks (past the run's end) to 2,734.

**Tuning vs fresh**: the curves and the bot's figures were fitted on the 60 tuning seeds only. The 200 fresh seeds draw
other six-course runs, pin shifts, winds and golden fruits from the same bank and were only measured. The par times and
plans come from the bank (every deal), not from either seed set.

## Tuning (skill-band bots, paired seeds, every run the sim's own score = the server replay)

Old = snipRev 9 (the band-3 revision rooms dealt before, `strictRev`), from `bun scripts/arcade-skill-bands.ts snip
--rev=x`. New = snipRev 11: median / top 10 % (p90) / best. Zero-score runs: none on any level, either revision.

| Seeds | Level | New: median / p90 / best | Old: median / p90 | Median change |
|---|---|---|---|---|
| Tuning (60) | Weak | 53 / 110 / 144 | 49 / 77 | +8 % |
| Tuning (60) | Average | 66.5 / 134 / 180 | 70 / 92 | −5 % |
| Tuning (60) | Good | 92.5 / 165 / 183 | 97 / 123 | −5 % |
| Tuning (60) | Great | 126 / 174 / 186 | 121 / 131 | +4 % |
| Tuning (60) | Near-perfect | 166 / 187 / 194 | 127 / 144 | +31 % |
| Tuning (60) | Elite | 171 / 191 / 197 | 128 / 146 | +34 % |
| Fresh (200) | Weak | 45.5 / 102 / 150 | 51 / 77 | −11 % |
| Fresh (200) | Average | 72.5 / 125 / 176 | 67 / 97 | +8 % |
| Fresh (200) | Good | 92.5 / 153 / 195 | 95 / 121 | −3 % |
| Fresh (200) | Great | 134 / 184 / 193 | 115 / 130 | +17 % |
| Fresh (200) | Near-perfect | 157.5 / 187 / 195 | 124 / 143 | +27 % |
| Fresh (200) | Elite | 177 / 195 / 198 | 128 / 145 | +38 % |

`bun scripts/arcade-skill-bands.ts snip --rev=x --levels=weak,average,good,great,near,elite,random --seeds=60` (tuning)
and `--seeds=200 --from=10000` (fresh); every run went through the encode and the server replay (no flag, no mismatch).

Feature payouts (tuning seeds, median): skill paid (of 50) weak 3, average 4, good 5, great 15, near 34, elite 36.
**Par time's own credit** (raw points before the pay scale, of 9): weak 0.55, average 1.5, good 1.5, great 2.7,
near 3.85, elite 4.8 (ticks under par summed: 24, 60, 60, 109, 156, 195 of 360).

Random play (the bot module's `randomBot`, random swipes at random places every 0.5–2 s): median 0, best 14 on 20 room
seeds (snip-x200-check); with the tool: tuning median 0, p90 9, best 12 (old 2 / 2 / 5); fresh median 3, p90 9, best 26 (old 2 / 2 / 7).

### Against the bar

| Target | Tuning (60) | Fresh (200) | Met? |
|---|---|---|---|
| Good median within ±10 % of the old | 92.5 vs 97 (−5 %) | 92.5 vs 95 (−3 %) | yes |
| Near-perfect median 165–175 | 166 | 157.5 | tuning yes, fresh 7.5 short |
| Near-perfect p90 ≤ ~185 | 187 | 187 | 2 over on both |
| Elite p90 190–200 | 191 | 195 | yes |
| Elite median ≥ ~175 | 171 | 177 | fresh yes, tuning 4 short |
| No zero scores for bot players | 0 zeros | 0 zeros | yes |
| Random play near 0 | median 0, best 12 | median 3, best 26 | yes |

**The bar is met only in part**: good, elite p90, zeros and random are met on both sets; near-perfect's median is met on
the tuning seeds but 7.5 short on the fresh ones, its top 10 % sits 2 over on both, and the elite median is 4 short on
the tuning seeds (met on the fresh ones).

Why the top of the bar is hard here: the perfect-level windows are narrow. On many deals the plan that takes both
leaves at par cuts works only within 1–6 ticks, so even the near-perfect and elite bots (timing spread about 1.2–1.9
ticks) lose about one level in seven and skip the narrowest feature plans; their runs differ mostly by the seed's
courses, not by the tier. Near-perfect and elite therefore sit close together (units median 111 and 112), so any
monotone curve that puts the near-perfect median at 165 lifts its top decile to about the elite's. The fit keeps every
curve monotone (no flat stretch: every unit and every raw point adds) rather than cliffing to force the numbers.

**Average players' top 10 %** (the parked note's 92 → 134): tuning 134 (old 92), fresh 125 (old 97); the good player’s top 10 % is 165 / 153 (old 123 / 121). The spread comes from the six-course mix (an easy
run of courses lets an average player feed nearly everything); it is fair in a room (everyone gets the same courses).

## The bot (`scripts/arcade-skill-bands/bots/snip.ts`)

The parked course bot, keyed by tier (weak and elite added; the four levels' figures kept), plus:
- the "best" plans are now the fastest perfect plans;
- a player looks past the first workable moment for a roomier window (`PATIENCE`: 0 / 0 / 12 / 24 / 40 / 40 ticks)
  and aims at its middle to the tick;
- a player skips a feature plan whose window is tighter than about three times their own timing spread
  (`MIN_WINDOW`: 20 / 16 / 12 / 9 / 6 / 4 ticks) and plays the plain plan instead;
- the elite player reads the swing more sharply (0.6 ticks against near-perfect's 1.5), studies during the pan, goes
  for the features on 95 % of levels and, chasing the par time, takes the first moment a feature plan works (85 % of
  levels; near-perfect 30 %); elite and near-perfect play different runs (own profiles and random streams);
- `randomBot`: random swipes, no aim.

## Assumptions and decisions

- Par time is per course (the slowest deal + 1 s), not per deal: a per-deal par was tried offline and separated the
  tiers less (near-perfect and elite then both lose most of the credit to timing spread).
- Par-time credit needs par cuts (quick and clean); it never needs the leaves or the golden apple.
- The parked courses, their deals and the win plans are unchanged; only the `best` plans (now the fastest perfect
  plans, keyed `-1` for a level with no golden fruit and by fruit otherwise) and the new `parT` were added.
- The skill pay is a knot table (`bandPoints`) on raw tenths, like Breaker's `BRK_V9_SKILL_PAY`, replacing the parked
  squared bonus.
- The parked dev-only warp (`src/lib/arcade/devWarp.ts`) is ported for the review screenshots (dev builds only; the
  game is unchanged in production).
- The intro demo was recorded on an older revision: `introDemo.functions.ts` stops it, so the intro shows its still
  until a demo is recorded on snipRev 11. **It needs re-recording.**

## Checks

Run in this worktree (CPU shared with three other workers):

- snip-x200-check PASS (3,439 checks, ~25 s; new)
- snip-check PASS (quick depth), snip-rev7-check PASS, snip-bank6-check PASS
- arcade-tuning-e-check PASS (its live-arena line now reads Scrumper's height from the dealt stamp),
  arcade-tuning-f2-check PASS, arcade-batch4-check PASS, arcade-correction-check PASS, intro-demo-check PASS,
  six-game-scoring-check PASS
- round-max-check PASS, scoring-bands-check PASS, scoring-targets-check PASS, arcade-score-bands-check PASS,
  arcade-help-bands-check PASS, intro-score-text-check PASS, reveal-score-check PASS, replay-check PASS,
  arcade-fx-check PASS, sound-manifest-check PASS, practice-bests-check PASS (after `bun scripts/practice-stamps.ts`)
- arcade-self-replay-check: the five Scrumper entries PASS 40/40 (`bun scripts/arcade-self-replay-check.ts 40
  snip,snip/tall,snip/bank6,snip/proven,snip/expand`); the whole check timed out at run-checks' 300 s here under the
  shared CPU (CI runs it in two parts)
- arcade-room-schedule-check: Scrumper's lines PASS (6 deals × 5 styles, every scheduled item identical); the check
  fails only on the other three games' missing modules (flip, hover, swing), expected in this worktree
- arcade-play-check snip PASS (16.7 ms a frame, baseline 16.7), bottom-clearance-check snip PASS, arcade-fill-check
  snip PASS
- `bunx tsc --noEmit` clean

## Files

- Game: `src/lib/arcade/snip.ts` (expansion block, par time, scoring), `snip.renderer.ts` (course world, the par dial),
  `snipCourses.data.ts` (36 courses with `parT`), `src/puzzles/snip.tsx` (HUD par line), `devWarp.ts`.
- Shared (Scrumper lines only): `roundMax.ts` (`snip: 200`), `liveBands.ts` (`rev` 11, `SNIP_V11_BAND_CURVE`,
  `strictRev` 9), `arcade.server.ts`, `grade.ts`, `reveal.ts`, `roundSummaries.ts`, `instructions.ts`, `introScore.ts`,
  `introDemo.functions.ts`, `arcadeFxGames.renderer.ts` (SNIP_FX: no horizontal camera on the course, the vertical one,
  GOLDEN!, RINGED!, QUICK!; the live spec at the 672 px view), `arenaFills.renderer.ts` (bark beside the view),
  `gameSounds.ts`, `manifest.ts`, `replay/moments.ts`, `docs/sound-cues/replays.md` and the cue sheet,
  `practiceStamps.data.ts`, `scripts/fixtures/replay-runs.json` (one snipRev 11 run appended).
- Checks touched (Scrumper lines only): `round-max-check` (`RAISED`), `arcade-fx-check` (three bumps),
  `arcade-self-replay-check` (`snip/expand`, appended), `arcade-batch4-check`, `arcade-tuning-e-check`,
  `arcade-tuning-f2-check`, `snip-bank6-check`, `snip-rev7-check` ("rooms deal" lines now name snipRev 11),
  `six-game-scoring-check` (the intro and help wording).
- New: `scripts/snip-x200-check.ts`, `scripts/x200/snip.ts`, `scripts/snip-x200-plans.ts` (plans and par times),
  `scripts/snip-x200-bands.ts` (tuning aid), `scripts/snip-x200-runs.ts`, `scripts/snip-x200-lib.ts`,
  `scripts/snip-x200-design.ts` and `snip-x200-legacy.ts` (the parked course designer and legacy recorder, renamed),
  `scripts/shots/snip-x200-shots.ts`; fixtures `snip-x200-legacy.json.gz` (16 snipRev 9 runs recorded on main before
  the parked change), `snip-x200-proofs.json`, `snip-x200-runs.json.gz` (two runs per tier and a perfect 200).
- Screenshots: `screenshots/x200-oct-2026/snip-par-time-414x896.png` (HUD "1/1 cuts · par 5.7s", the dial, a golden
  apple falling), `snip-course-pan-414x896.png` (two fruits, rings, nests, the map, "par 6.6s"),
  `snip-several-fruits-414x896.png`.

## For the merge

- `scripts/arcade-room-schedule-check.ts` replays each style's log with `inputAt(log.events, t)`, which only returns the
  log's last event (it is the recorder's live lookup), so every style plays as idle there. Scrumper's module passes
  either way; with a per-tick map (`new Map(events.map((e) => [e.t, e]))`) its 6 deals × 5 styles also pass (42
  scheduled items identical, tried locally, not committed: the check is shared).
- Shared lines to merge: `ROUND_MAX.snip`, round-max-check's `RAISED`, `LIVE_BANDS.snip`, the snip blocks of
  `instructions.ts` / `introScore.ts` / `introDemo.functions.ts` / `grade.ts` / `reveal.ts` / `roundSummaries.ts` /
  `arcadeFxGames.renderer.ts` / `arenaFills.renderer.ts` / `gameSounds.ts` / `manifest.ts` / `replay/moments.ts`,
  `docs/sound-cues/replays.md`, the cue sheet (regenerate with `bun scripts/sound-cue-sheet.ts`),
  `practiceStamps.data.ts` (regenerate with `bun scripts/practice-stamps.ts`), `scripts/fixtures/replay-runs.json`
  (one appended snip run; keep every game's appended run), arcade-self-replay-check's appended `snip/expand` entry.
- `src/lib/arcade/devWarp.ts` is the parked branch's file as is; another worker may port the same file.

## Second attempt (26 Oct 2026, after the review): structural reweighting, not shipped

What I tried, offline on the 60 tuning seeds only: the bots' per-level records (each level's course, deal, end tick
and whether it was fed at par cuts) were re-scored under 45 structures. The par-time margin was 60, 90 or 120 ticks.
The par-time credit was linear, squared or cubed toward the tight end. The raw weights for golden apples, par cuts,
second leaves and par time were 50/20/20/15, 50/15/15/25, 55/15/10/30, 50/10/10/35 or 60/10/10/30 (perfect-run bonus
making 50). For each structure I refitted the base curve, kept strictly rising (0.4–3.5 points a unit, so its top
flattens where the optimiser wants it to), and the pay scale, also strictly rising (0.03–0.3 a raw tenth). The target
was near-perfect median 170, near-perfect p90 ≤ 182, elite median ≥ 178 and elite p90 190–200.

Result: the best structure (60-tick margin, squared par-time credit, weights 50/10/10/35) gives near-perfect 169.5 /
p90 187, elite 174.5 / p90 190 and good 98. Every structure leaves near-perfect's top 10 % at 186–189 and elite's
median at 172–174.5.

Why no monotone scoring can reach the band: near-perfect's top-decile runs beat elite's median run on every scored
feature (tuning seeds):

| Feature | Elite median | Near-perfect 85th–90th percentile |
|---|---|---|
| Units | 112 | 120 |
| Levels cleared | 5 | 6 |
| Speed bonus | 0 | 10 |
| Golden apples | 2 | 3 |
| Second leaves | 3 | 4–5 |
| Par-cut levels | 5 | 6 |
| Par-time levels (sum of credit) | 3.3 | 3.85–4.0 |

So with any monotone scoring, elite's median is at most near-perfect's p90. "Elite median ≥ 178 with near-perfect p90
≤ 182" then needs both to land in 178–182, which only a plateau (a cliff in reverse) could do. The separation has to
come from play, not pay: the elite bot loses a level as often as the near-perfect one, because the perfect-level
windows are 1–6 ticks wide. The shipped scoring is unchanged (first attempt above), so I didn't take a second fresh
measurement; the fresh numbers above stand.

## Phase 1 and phase 2 (26 Oct 2026, evening): forgiving cut timing, Session A's bots

**Phase 1: cut timing made more forgiving.** Same stamp, since snipRev 11 was never dealt outside an unmerged PR.
- *Wider chutes*: each course's two chute boards over the basket reach up to 50 px further out, and 25 px higher.
  Each board goes as far as it can while staying a fruit's width (24 px) from every other piece, nest, leaf, peg and
  ring (`scripts/snip-x200-chutes.ts`). 63 of the 72 boards got the full 50; the other nine 0–25.
- *Larger leaves*: leaves are now drawn at 60 px (they were 48) and taken at `SNIP_X_STAR_REACH` 40 (it was 24).
  That is a fruit touching the drawn leaf.
- *Re-proved*: `scripts/snip-x200-plans.ts` now also re-finds every deal's win plan and drops a golden choice that
  has no perfect plan. All 324 deals × golden choices still have plans; no golden choice was dropped. Par times
  were rewritten (5.0–8.3 s), the recorded runs re-recorded, and the ceiling proof still holds: 200 on every bank
  deal and on all 260 tuning and fresh seeds.
- *Effect* (start-time shifts of ±8 ticks around the stored plans, wind preset 0, all courses): plans that still
  feed every fruit went from 10.3 to 11.3 of 17; plans that stay perfect from 6.0 to 7.8 of 17. Deals with fewer
  than 5 perfect shifts went from 37 of 108 to 28.

**Phase 2: #175's fixed bots** (merged at d74da894).
- `bots/snip.ts` keeps #175's old-stamp bot exactly and adds the snipRev 11 course bot, keyed on all seven levels.
  Flawless plays each level's stored perfect plan.
- Competence fixes to the course bot:
  - #175's `steadyMid`: centre on a run of ticks that all work. The 3-tick scan used to land on failing ticks
    inside ragged windows, which was most of the elite bot's lost levels.
  - Weigh the deal's other stored plans for the roomiest window.
  - Look further on before cutting on an untested plan.

Measured on the tuning seeds (0–59). "Before" is the old stamp (snipRev 9) on the same fixed bots:

| Level | Before: median (p90) | snipRev 11 now: median / p90 |
|---|---|---|
| Weak | 51 (80) | 65.5 / 110 |
| Average | 73.5 (100) | 94 / 153 |
| Good | 97 (123) | 132.5 / 168 |
| Great | 120 (130) | 162.5 / 185 |
| Near-perfect | 124 (144) | 164.5 / 187 |
| Elite | 130 (145) | 173 / 190 |
| Flawless | 147 (149) | 200 / 200 (min 200) |

No zero scores at any level. Random play: median 0, best 12.

**The bar is still not met.** The forgiving timing lifts every level, so the skill levels bunch at the top:

| Level | Units, median | Units, p90 | Levels cleared, median |
|---|---|---|---|
| Good | 102 | 118 | 5 |
| Great | 111 | 120 | 5 |
| Near-perfect | 111 | 120 | 5 |
| Elite | 114 | 120 | 5 |

The only clear separation at the top is the par-time credit (median of six levels: near-perfect 1.7, elite 2.15;
p90 2.6 vs 3.8).

Refitting on these runs: 12 structures (par margin 60 or 90; linear or squared credit; four weight splits), each
with strictly rising curves (0.4–3.5 a unit, 0.03–0.3 a raw tenth).
- Good stays at 122–129 against the target of about 97 ± 10 %.
- Near-perfect sits at 157.5–162 / 184–187.
- Elite sits at 170.5–175 / 188–193.

To put good back at 97 and near-perfect at 165, the base would have to jump about 4 points a unit between 102 and
111 units (a cliff). And near-perfect's top-decile runs (units 120, all six levels) still dominate elite's median
run (units 114, five levels).

The shipped scoring is unchanged (`SNIP_V11_BAND_CURVE` and `SNIP_X_SKILL_PAY` as above). The fresh seeds were not
measured again: the tuning seeds already miss the bar on good, near-perfect and elite.

## Final (27 Oct 2026): the stricter snipRev 11, shipped

Joe's decisions: the more forgiving cut timing (phase 1, commit b3733c15) is reverted (73b7cc97), so snipRev 11 is
the stricter version again (its courses, stored plans, par times and scoring as before phase 1); phase 2's bot
improvements on #175's fixed bots stay. Joe's simplified bar replaces every number target: fun, fair and consistent
scoring; brilliant > great > good; anyone who plays scores above 0; an ordinary player's score doesn't jump wildly.

Measured once on #175's bots (`arcade-skill-bands.ts snip --rev=x`, all levels plus random), paired seeds, "before"
= snipRev 9 on the same fixed bots. Median (p10–p90) / before-median:

| Level | Tuning 60 | Fresh 200 |
|---|---|---|
| Weak | 36 (25–98) / 51 | 52 (24–104) / 46 |
| Average | 78 (31–134) / 74 | 78 (29–132) / 67 |
| Good | 100 (33–153) / 97 | 99 (35–164) / 95 |
| Great | 125 (77–183) / 120 | 134 (74–184) / 115 |
| Near-perfect | 166 (123–189) / 124 | 165 (111–187) / 124 |
| Elite | 174 (140–190) / 130 | 184 (141–193) / 130 |
| Flawless | 200 (min 200) / 147 | 200 (min 200) / 147 |
| Random | 0 (0–9) / 2 | 3 (0–9) / 2 |

No zero scores weak through flawless on either set; random play is near 0. Every level's median is above the one
below on both sets; good is +3 % (tuning) and +4 % (fresh). The flawless level (the stored perfect plans) scores 200
on every seed. Meets the bar; shipped in #174. Checks re-run on the reverted code: snip-x200-check, snip-rev7-check,
snip-bank6-check, arcade-tuning-e-check, arcade-tuning-f2-check, arcade-batch4-check (all pass). Screenshots retaken
on the stricter version.
