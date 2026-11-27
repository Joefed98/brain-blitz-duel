# Hover under the arcade scoring standard: hoverRev 10

## hoverRev 12 (D5, 23 Nov 2026): Normal's fitted lines and the gap ladder

Rooms, practice, the Daily and every level deal **`hoverRev 12`** (`HOVER_REV_FIT`; `hoverFitGame`, `hoverFitFor(level)`).
Older stamps (hoverRev 11 at every level, 10 and before) replay and score exactly as before: the 82 runs recorded before
this stamp (`scripts/fixtures/hover-rev12-legacy.json.gz`, `scripts/hover-rev12-legacy-record.ts`) regrade exactly
(hover-ladder-check section 1), and D5's levels fixture (retro-levels-check) holds hoverRev 11's levels too. Checks written
for hoverRev 11 pin the era `hoverPreFit` (deals hoverRev 11 on a random seed, as rooms did); `preRetro` still deals
hoverRev 10.

### Normal: the same play, the parts' full lines moved (Joe, 23 Nov 2026)

hoverRev 11's play exactly: the same course, the starting shield, every feature (a hoverRev 11 log replays tick for tick
on hoverRev 12 with the same checkpoints; states add `fit: 1`, outside the checksum). The five parts and their maximums
are unchanged (120 + 30 + 20 + 20 + 10 = 200); each feature's full line moves to about what the realistic elite (the D5
ladder's `elite` player: the Elite skill-band bot under the human limits) takes on three runs in four, and the core line
stays put (`HOVER_V12_FIT`):

| Part | Max | hoverRev 11 full at | hoverRev 12 full at |
| --- | --- | --- | --- |
| Barriers | 120 | all 42 | all 42 (the core line stays put) |
| Star chains | 30 | all 30 chain points (five whole chains) | **18** chain points (three whole chains' worth) |
| Gold stars | 20 | all 10 | **2** (10 a star) |
| Tight gates | 20 | all 5 | **4** (5 a gate) |
| Centre line | 10 | every gate dead centre (1,000 ‰ of the credit) | **300** ‰ of the credit |

## Levels (D5, 23 Nov 2026)

The lever is the **height of the barrier gaps** (`HOVER_LEVELS_V12`, retroLevels.ts; the registry shows the same rows;
hoverRev 11's table, `HOVER_LEVELS`, stays for its stored rounds). A level's course is hoverRev 11's for the seed with
every gap scaled about its centre by `gapPct` (inside the world's margins; a gold star keeps its place in its gap; the
80 px tight gates are unchanged), the sliding gaps still where `slide` is 0, and the features (tight gates, star chains,
shield bubbles) then laid on that course by hoverRev 9's own rules (`hoverFitCourse`, `initFit`). The scroll is Normal's at
every level; each level scores on its own full lines.

| | Easy | Normal | Hard | Expert |
| --- | --- | --- | --- | --- |
| Gaps | 127 % (190 px narrowing to 127) | 150 px narrowing to 100 | 75 % (112 narrowing to 75 px) | 70 % (105 narrowing to 70 px) |
| Shields at the start | 3 (each forgives a crash) | 1 | 1 | none |
| Sliding gaps | none | from barrier 23 | as Normal | as Normal |
| Barriers (120) full at | all 42 | all 42 | 28 | 20 |
| Star chains (30) full at | 18 chain points | 18 | 18 | 12 |
| Gold stars (20) full at | 2 | 2 | 3 | 3 |
| Tight gates (20) full at | 4 | 4 | 3 | 3 |
| Centre line (10) full at | 300 ‰ | 300 ‰ | 300 ‰ | 400 ‰ |
| Seeds dealt (proved of candidates tried) | 100 of 128 | 100 of 171 | 79 of 140 | 81 of 140 |

**The ladder** (Joe's test; `scripts/d5-ladder-lib.ts`: the Average and Elite skill-band bots under the human limits,
graded by the server). Before: hoverRev 11 as dealt on 22 Nov 2026, 24 deals a level (`bun scripts/d5-ladder.ts hover
--deals=24`). After: hoverRev 12, 96 deals a level, recorded in `scripts/fixtures/d5-ladder-hover.json.gz`
(`bun scripts/d5-ladder-record.ts hover --deals=96`). Average player's mean; realistic elite's mean and share at 200:

| Level | Average before → after | Elite before → after | Elite at 200 before → after |
| --- | --- | --- | --- |
| Easy | 66.8 → **120.6** | 174.4 → **197.8** | 0 % → **78 %** |
| Normal | 52.2 → **57.3** | 146.6 → **182.6** | 0 % → **41 %** |
| Hard | 32.8 → **35.3** | 130.8 → **183.4** | 0 % → **33 %** |
| Expert | 38.7 → **20.0** | 139.8 → **160.1** | 0 % → **24 %** |

Today's Expert scored above its Hard for the average player (the levels only sped the scroll); now each level steps down
(by 63, 22 and 15), no level is a cliff (Expert 20), and the realistic elite reaches 200 less often each level up, on
Expert on 24 % of runs. The spec's guides for the average player (Easy 150–180, Hard 55–75, Expert 25–45) are not met
at the ends: the Average bot takes no tight gates and few stars on any level, so its score is nearly all barriers.

**The proof.** Every level, Normal included, deals only seeds on which the proof player, the flawless player held to
the human limits (`scripts/hover-proof-player.ts`: taps at least 0.15 s apart, nothing answered sooner than 0.25 s after
it scrolled into view, re-planning as soon as anything new is known), scores exactly 200 through the server replay
(`src/lib/duel/hoverLevelDeals.server.ts`, built by `bun scripts/hover-level-deal.ts campaign … / build`, `--check`
rebuilds it from the stored witnesses `scripts/fixtures/hover-level-deal-witness.json.gz`). The flawless skill-band bot
(`hoverFlawless.ts`) was not used: it taps every 0.1 s and plans through barriers still off the screen. The ladder's
players (the skill-band bot) also read the next barrier before it is on screen; the proof player does not, which is why
it misses 200 on some seeds the elite takes (a late gap 250 px from the last, seen a reaction time too late to reach).

Intro demo: the one recorded on hoverRev 11 still plays (`introDemo.functions.ts` accepts 11 or 12, the same play on
Normal); `scripts/retro-demos.json` wants re-recording on hoverRev 12 (`bun scripts/retro-demos-record.ts hover`).

Display: the saucer's shield ring shows while any shield is held (Easy's three are not counted on screen).

Checks: hover-ladder-check (the legacy fixture, the deals and the pin, the same play on Normal, the lines, the levels as
dealt, every witness at 200, the proof player re-played on a sample, Joe's ladder test on 96 deals a level).

## hoverRev 11 (the Retro overhaul, stage 3, 16 Nov 2026): starting shielded

hoverRev 10's course, rules, parts and scoring exactly, with the saucer starting shielded (hoverRev 9's shield): the first
crash breaks it and the saucer flies on, untouchable for a moment, instead of ending the run. Levels: Easy keeps the
shield and widens the gaps 15 % about their centres; Hard and Expert start without one and scroll 6 % and 12 % faster.
States add `grace: 1`. Rooms deal it (preRetro: hoverRev 10).

29 Oct 2026. Rooms, practice, the daily and challenges deal **`hoverRev 10`** (`HOVER_REV_STANDARD`). The play is
hoverRev 9's exactly: the same course, features, shields, physics and checkpoints. A hoverRev 9 log replays tick for
tick on hoverRev 10 and its checkpoints verify there. Only the scoring changes: five fixed parts that add up to 200,
each one a straight line. hoverRev 9's base curve, the flight unit, the 10 for lasting the minute and the skill pay
scale are all gone on the new stamp. Every older stamp (unstamped, 2–9) replays and scores exactly as before.

## Parts

| Part | Max | Rule |
|---|---|---|
| Core: barriers passed | 120 | ⌊120 × barriers ÷ 42⌋, one straight line (`HOVER_V10_BAND_CURVE` = 0 → 0, 42 → 120). Each barrier is worth 2 or 3 points. |
| Star chains | 30 | 6 a chain over the 5 chains. Each chain pays 4 × the share of its stars touched (5–7 stars), plus 2 when every star is touched. The shares are summed exactly and floored once. |
| Gold stars | 20 | 2 each for the 10. |
| Tight gates | 20 | 4 each for the 5, threaded cleanly (the rule is unchanged from hoverRev 9). |
| Centre line | 10 | Up to 2 a cleanly threaded tight gate. The furthest the saucer's centre strays from the gate's line across the barrier's columns is measured as on hoverRev 9. Within 6 px the gate gets its full credit, falling in a straight line to 0 at 15 px (`hoverCentreCredit`: 0 to 2,304 in 1/256 px). The part is ⌊10 × Σ credit ÷ (2,304 × 5)⌋. |
| Lasting the minute | 0 | — |
| **Total** | **200** | Sum of the parts. A run with any input scores at least 1, and a run with no input scores 0. Nothing costs points: a crash only ends the run, and shields pay nothing. |

Counts: every course holds exactly 42 reachable barriers, 10 gold stars, 5 tight gates and 5 star chains. This was
checked on 3,000 courses for this change and on 1,760 in hover-x200-check. The code still keeps each part's maximum
and splits it evenly over whatever the course holds, so a different count would not change the maxima.

Speed: Hover has no completion speed bonus, because the run is a fixed minute.

Earning a feature never costs core points. A barrier passed through its tight gate also counts as a passed barrier,
and every feature sits on the course the player is already flying.

State: hoverRev 10 states add `std: 1` and `ctrFine`, the summed centre credit, which is written only on the new
stamp. Neither is folded into the checkpoint checksum because play is unchanged, the same approach used for
Roofbound's flipRev 9 lift.

## Core target

The core has a fixed maximum: all 42 reachable barriers on every course. No core target had to be measured. A good
run (100 points of core) passes 35 barriers.

## Medians, weak → flawless

`bun scripts/arcade-skill-bands.ts hover --rev=now --levels=all --seeds=30 --jobs=4`. "Before" was measured on main
(hoverRev 9) and "after" on this branch (hoverRev 10). Figures are median (p10–p90).

| Level | Before (hoverRev 9) | After (hoverRev 10) |
|---|---|---|
| Weak | 28 (11–72) | 8 (2–27) |
| Average | 104 (35–116) | 47 (11–75) |
| Good | 104 (62–126) | 47 (21–95) |
| Great | 123 (47–151) | 94 (20–134) |
| Near-perfect | 172 (121–188) | 156 (76–177) |
| Elite | 182 (132–199) | 170 (83–184) |
| Flawless | 200 (200–200) | 197 (194–200) |

On 30 seeds the average and good medians tie, as they also did before (104 and 104). The tie is sampling noise. On 60
seeds (`--levels=average,good --seeds=60`) they separate clearly: average **36 (8–74)** and good **52 (14–102)**.
Their p10 and p90 also separate at 30 seeds. From great upwards the gaps are clear: 94 → 156 → 170 → 197.

The lower half drops a lot because hoverRev 9's base curve front-loaded points. It gave 68 for the first 8 barriers,
and the flight unit plus the minute's 10 added more. The standard's straight line pays each barrier the same. The top
spreads out instead of bunching.

The flawless bot falls short of 200 on a few seeds for two reasons:
- It plays with a limited view, as it did on hoverRev 9.
- The centre line is now graded on a continuous scale. A pass a few pixels beyond 6 px loses a fraction of its 2 points
  instead of keeping hoverRev 9's grade.

Every tuning and fresh seed has a stored witness run that scores 200 on hoverRev 10.

The bots are unchanged. The skill-band bot plays hoverRev 10 exactly as it plays hoverRev 9, because it reads `xp`.

## Gameplay changes and assumptions

- None to play. The course, features, shields, physics and checkpoints are all hoverRev 9's.
- The centre line's straight line runs from full at 6 px to none at 15 px. These are hoverRev 9's dead-centre and
  grade-1 edges. hoverRev 9's slowest gate allows a best arc of about 4.3 px, so full credit is open on every gate.
- "At least 1" means any input at all, the band rules' `acted`. A run with no input still scores 0.
- The HUD's `CENTRE` figure shows the centre part's points (0–10) on hoverRev 10, and the raw grade points on hoverRev 9.
- The reveal reads "x / 42 barriers → core", then "Star chains a · gold stars b · tight gates c · centre line d +sum",
  then the total.
- The stored detail adds `corePts`, `chainPts`, `goldPts`, `tightPts` and `centreLinePts`. `skill` is the sum of the
  four feature parts.
- The intro demo stays stopped until one is recorded on hoverRev 10.

## Checks and tools

- `scripts/hover-standard-check.ts` (~15 s) checks:
  - The legacy fixture replays identically: 54 runs recorded on main before the change, 40 on hoverRev 9 and two on
    each older stamp, in `scripts/fixtures/hover-standard-legacy.json.gz` (`bun scripts/hover-standard-record.ts`).
  - The wiring.
  - Play is unchanged against hoverRev 9.
  - Each part's rule and cap, including real centre-line flights through a tight gate.
  - The minimum of 1, with no input scoring 0.
  - The same course for every player, whatever they play.
  - All 260 witness runs score 200 with every part at its maximum, through both `gradeAnswer` and the reveal.
- `scripts/arcade-standard/hover.ts` is the standard module, and `perfect()` replays witness 0 on hoverRev 10.
- `arcade-self-replay-check` has a new `hover/std` entry, and `scripts/fixtures/replay-runs.json` has one new hoverRev
  10 run, appended with `--add=hover`.
- Older checks read hoverRev 10 as hoverRev 9's play through `LIFT_REVS` (`hover: [10, 9]`, `playRevOf`).
- hover-x200-check and arcade-tuning-e-check now assert the dealt stamp's play and the new help line.
