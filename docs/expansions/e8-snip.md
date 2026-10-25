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
- **Golden apple**: on levels 2, 4 and 6 one fruit (a seeded pick) is golden (drawn gold with a soft glow); feeding
  it scores 5.
- **Wind**: each level deals one of its course's three presets (amplitude 0–11/256 px a tick², period 160–300
  ticks): a signed integer triangle wave that pushes the ropes and the fruit they hold, so they swing. A falling
  fruit is not blown (it keeps courses predictable once released). Shown by a windsock at the top left and
  drifting streaks and leaves (no streaks with reduced effects; still with reduced motion).
- **Fewest cuts**: a level counts strokes (cut inputs on consecutive ticks are one stroke; a stroke counts once it
  cuts a rope), shown as "n/par cuts" in the HUD line. Every fruit fed in at most the course's `par` strokes is a
  par level. Par is the most strokes any deal's best stored plan needs; on some courses a swipe across two
  neighbouring ropes in one stroke beats the naive count.
- **Stars along the way**: two golden leaves a course; the first counts in the base units (2), the second is a
  bonus (2).
- **The level map** at the top right: the whole course, the basket, fruit, pegs, rings, nests and leaves, with the
  current view boxed (view space, display only).

## Deals and proofs

A level's deal comes from the run's seed: a level-wide pin shift (−10, 0, +10 px), one of three wind presets and
(on gold levels) the golden fruit, so every course has 9 physical deals. Every course's every deal has two stored
plans in `scripts/fixtures/snip-expand-proofs.json`: `win` (the fastest found that feeds every fruit) and `best`
(every fruit at par with both leaves). Plans are human-paced: the first cut no sooner than 24 ticks after the pan,
strokes at least 12 ticks apart, a stroke's consecutive cuts within 70 px of each other, every planned cut finding
its rope alive (a vine only after its catch). The courses were laid by `scripts/snip-expand-design.ts`, which traces
each fruit's fall with a reference plan and lays the pieces along it, then keeps a candidate only when every deal
has a win plan and a perfect plan.

## Scoring (snipRev 10)

- Units: each level's fruits share 18 (`18 × fed ÷ fruits`) and a leaf adds 2, so 120 is every fruit and a leaf on
  all six levels. `SNIP_V10_BAND_CURVE` turns units into points up to 140; feeding every fruit of every level adds
  up to 10 for speed (the full 10 by 48 s, falling to 0 at the buzzer; `SNIP_X_FINISH_MIN` = 36 s).
- Feature bonus (`snipFeatureBonus`, at most 50): 5 per golden apple fed (3 a run), 2.5 per par level (6), 2 per
  second leaf (6), and 8 for a perfect run (every level at par with both leaves and all three golden apples).
- Total: `bandTotal(parts, acted, 200)`; no input scores 0. Grading's "correct" flag is 200 on snipRev 10 (150
  before).

## Tuning

TUNING_TABLE

## Checks

CHECKS

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

SHARED
