# E8 expansion: Scrumper (snip), snipRev 10

25 Oct 2026. Scrumper's world expansion and skill features (docs/scoring-200.md). Older rounds (snipRev 1–9)
play and score exactly as before; rooms deal snipRev 10.

## The world

- **A tall course.** Each level is a course 360 px wide and 1,200 px tall (`SnipCourse.h`), about 1.8 screens,
  seen through a 360 × 672 view (`SNIP_X_VIEW_H`; it fills a 414 × 772 arena box at the largest uniform scale,
  so the iPhone 11 home-screen app shows it edge to edge). There is no horizontal camera any more (the course is
  the view's width, solid walls at both sides); the vertical camera rides in the sim state (`camY`, whole px, eased
  a sixth of the way each tick), so the phone, the server's reveal, the effects layer and the cut mapping all see
  the same view. The renderer draws the backdrop with a slow parallax, apple trees up both walls, the course, then
  the view overlays.
- **The opening pan.** Each level opens with a 1 s pan (`SNIP_X_PAN_TICKS` = 60) from the basket up to the fruit
  (a smoothstep in the sim). The sim holds still and ignores cuts during it; the level clock runs (14 s a level).
- **Six levels a run** (`SNIP_X_LEVELS`; 2 easy, 2 medium, 2 hard from the bank, on their own seed stream) instead
  of ten, since each course is longer. The run stays 60 s.
- **Course pieces.** Pegs are the picker's crooks (extended to every fruit: a free fruit falling past a hook from
  above is snagged on a vine); **rings** are new: a brass hoop that snags a free fruit passing through its middle
  (within `SNIP_X_RING_REACH` = 14 px) from any direction, then holds it on a vine. Slopes are planks and gutters,
  bouncers springy branches, as before; most courses end in a wooden chute over the basket (two boards sloping in,
  two upright). Wasp nests sit beside the paths. Falling fruit is capped at 12 px a tick (`SNIP_X_MAX_SPEED`, air
  drag) so nothing tunnels through a 9 px plank.

## The features

- **Several fruits a level** (1–3), each on its own ropes; fruits never touch each other. Every fruit can be fed.
- **Golden apple**: on levels 2, 4 and 6 one fruit (a seeded pick among the course's `golds`) is golden for the
  level's first 7 s (`SNIP_X_GOLD_TICKS`, the pan included; drawn gold with a soft glow and a gold ring that runs
  down). Fed in time it counts; after that it ripens into an ordinary apple (`gold` 2).
- **Wind**: each level deals one of its course's three presets (amplitude 0–11/256 px a tick², period 160–300
  ticks): a signed integer triangle wave that pushes the ropes and the fruit they hold, so they swing. A falling
  fruit is not blown (it keeps courses predictable once released). Shown by a windsock at the top left and
  drifting streaks and leaves (no streaks with reduced effects; still with reduced motion).
- **Fewest cuts**: a level counts strokes (swipe inputs on consecutive ticks are one stroke; a missed swipe counts
  too), shown as "n/par cuts" in the HUD line. Every fruit fed in at most the course's `par` strokes is a par level.
  Par is the most strokes any deal's perfect stored plan needs; on some courses one swipe across two neighbouring
  ropes beats the naive count.
- **Stars along the way**: two golden leaves a course; the first counts in the base units (2), the second is a
  bonus (2).
- **The level map** at the top right: the whole course, the basket, fruit, pegs, rings, nests and leaves, with the
  current view boxed (view space, display only).

## Deals and proofs

A level's deal comes from the run's seed: a level-wide pin shift (−10, 0, +10 px), one of three wind presets and
(on gold levels) the golden fruit, so every course has 9 physical deals. Every course's every deal has stored plans
in `scripts/fixtures/snip-expand-proofs.json`: `win` (the fastest found that feeds every fruit) and, for each fruit
that may be golden, `best[g]` (a perfect level: every fruit, par, both leaves, that fruit fed while golden). Plans are human-paced: the first cut no sooner than 24 ticks after the pan,
strokes at least 12 ticks apart, a stroke's consecutive cuts within 70 px of each other, every planned cut finding
its rope alive (a vine only after its catch). The courses were laid by `scripts/snip-expand-design.ts`, which traces
each fruit's fall with a reference plan and lays the pieces along it, then keeps a candidate only when every deal
has a win plan and a perfect plan for at least one golden fruit, and its forgiveness (the share of ±24-tick shifts
of the reference plan that still feed every fruit) fits its band (easy ≥ 0.45, medium 0.20–0.62, hard ≤ 0.40).
The bank is **36 courses** (11 easy, 12 medium, 13 hard; hard ones took the longest to find:
the steering of a fast fall into the basket fails often, so every multi-fruit course has a narrow chute over the
basket: ±80 px easy, ±66 medium, ±56 hard).

## Scoring (snipRev 10)

- Units: each level's fruits share 18 (`18 × fed ÷ fruits`) and a leaf adds 2, so 120 is every fruit and a leaf on
  all six levels. `SNIP_V10_BAND_CURVE` turns units into points up to 140; feeding every fruit of every level adds
  up to 10 for speed (the full 10 by 48 s, falling to 0 at the buzzer; `SNIP_X_FINISH_MIN` = 36 s).
- Feature bonus (`snipFeatureBonus`, at most 50): raw points 5 per golden apple fed in time (3 a run), 2.5 per par
  level (6), 2 per second leaf (6) and 8 for a perfect run (every level at par with both leaves and all three
  golden apples), 50 at the top; the bonus is 50 × (raw ÷ 50)², in integer half points (raw2² ÷ 200), so a little
  use of the features adds little (average players about 5, near-perfect ones about 15) and only strong use of all of
  them nears 50.
- Total: `bandTotal(parts, acted, 200)`; no input scores 0. Grading's "correct" flag is 200 on snipRev 10 (150
  before).

## Tuning

Skill-band bots (`scripts/arcade-skill-bands/bots/snip.ts`, 40 room seeds × 4 levels, every run through the server
replay; `bun scripts/arcade-skill-bands.ts snip --rev=now --seeds=40`), before on snipRev 9 (the code before the
expansion), after on snipRev 10:

| Level | snipRev 9 median | top 10 % | best | snipRev 10 median | top 10 % | best | median change |
|---|---|---|---|---|---|---|---|
| Average | 72.5 | 92 | 124 | 75.5 | 134 | 151 | +4 % |
| Good | 101.5 | 127 | 133 | 93.5 | 137 | 152 | −8 % |
| Great | 121 | 130 | 143 | 124 | 162 | 171 | +2 % |
| Near-perfect | 130 | 143 | 147 | 131 | 167 | 200 | +1 % |

snipRev 10 medians per level: units 89 / 93 / 100 / 102, feature bonus 5 / 9 / 13 / 15, fruit fed 8–9 of 11,
golden apples 1 / 1 / 2 / 2, par levels 3 / 4 / 4 / 4, second leaves 2 / 3 / 3 / 4. The stored perfect plans score
200 on 11 of the first 12 room seeds and 199 on the other (its six courses finish at 49 s, past the full speed
bonus), proved through the server replay in snip-expand-check. The new bot plays the stored plans for the deal (the
perfect one when it goes for the features: 10 % / 30 % / 55 % / 85 % of levels), splits a two-rope swipe into two
unless it pulls it off (20 % / 45 % / 70 % / 92 %), with the same reading, timing and aim errors as before.

## Checks

Run in this worktree (light checks only; the browser checks are run after merging):
snip-expand-check PASS (2,217 checks, ~6 s), snip-check PASS (quick depth), snip-rev7-check PASS, snip-bank6-check PASS,
arcade-tuning-e-check PASS (the intro HOW is three short lines and names the crooks), arcade-tuning-f2-check PASS, arcade-self-replay-check PASS (with a new `snip/expand` entry),
reveal-score-check PASS, arcade-fx-check PASS (two new Scrumper events: GOLDEN!, RINGED!), replay-check PASS (a
snipRev 10 run appended to `scripts/fixtures/replay-runs.json`, two moment rows), arcade-help-bands-check PASS,
scoring-bands-check PASS, scoring-targets-check PASS, arcade-score-bands-check PASS, sound-manifest-check PASS,
round-max-check (fails only on Wavefront's intro line in this worktree; Wavefront's own branch changes it),
`tsc --noEmit` clean. practice-bests-check fails until `bun scripts/practice-stamps.ts` is re-run (its only change: snip `snipRev=10`; left for the merge, as asked). New fixtures: `snip-expand-legacy.json.gz` (16 snipRev 9 runs recorded on the pre-expansion
code), `snip-expand-runs.json.gz` (12 snipRev 10 bot runs), `snip-expand-proofs.json`.

## Assumptions and decisions

- The world is narrower than the old 1,260 px wide swing world: the course is the view's width, so a swing hits
  the walls (which bounce without loss, as before). This removes the horizontal camera, which would have fought the
  vertical one.
- Wind does not push a falling fruit, only ropes and the fruit they hold.
- The deal is a level-wide pin shift (three values) rather than per-pin wobbles, so every deal can be proven in CI.
- Par is the worst deal's best stroke count, so a perfect level is open on every deal (and a 200 on every seed whose
  six courses all allow it, proved for a room seed in snip-expand-check).
- The intro still is the old orchard drop illustration (unchanged); the intro demo needs re-recording on snipRev 10
  (older demos are stopped in `introDemo.functions.ts`, so the still shows).

## Shared requests

Lines changed in shared files (game lines only): `liveBands.ts` (snip line with `bands`), `instructions.ts` (snip
block), `introScore.ts` (snip line, an unused import removed), `introDemo.functions.ts` (stop pre-snipRev 10 demos),
`arcade.server.ts` (generateSnip), `grade.ts` (snip case: 200 is "correct" on snipRev 10; extra detail fields),
`reveal.ts` (snip axis and tiles on snipRev 10), `arcadeFxGames.renderer.ts` (SNIP_FX: no horizontal camera and the
vertical one on snipRev 10, clear/final counts, GOLDEN! and RINGED! pops), `gameSounds.ts` (snipSounds: fruit fed,
golden chime `shared.celebrate.chime`, ring catch `snip.hook`), `replay/moments.ts` (two snip rows),
`arcade-skill-bands/games.ts` (snip `expand`), `arcade-self-replay-check.ts` (one entry), `arcade-fx-check.ts` (two
snip bumps), `fixtures/replay-runs.json` (one run appended; Wavefront appended one too, so the one-line file needs
both runs kept on merge), and older Scrumper checks' "rooms deal" lines (snip-bank6, snip-rev7, tuning-e, tuning-f2)
now go through `snipPlayBeforeExpand`. No audio files or manifest entries added; countryside.renderer.ts and
seas.renderer.ts untouched. Requests: none needed.
