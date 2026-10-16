# Taller worlds, batch 4: candidates (16 Oct 2026)

Report only. No code, sim or stamp has changed. This page measures how much of the arcade play screen each
arcade-stage game uses today. It then asks, for every game without a taller world, whether one would add play
or only empty space, and which games are worth a batch 4.

## Method and assumptions

- **Analytic geometry, not device measurements.** The numbers come from the same CSS arithmetic as
  `scripts/presentation-geometry-check.tsx`, which generates `docs/arena-sizes-oct-2026.md`, and use the worlds
  that rooms deal today (the latest revision of each game). The play column is:
  - one 44 px header row, `max(4px, top inset)` from the top, then 4 px down to the box;
  - each game's own HUD rows above the box (Scrumper 24, Tenfall 56, Bonk 96, Pull! 26);
  - each game's own control rows below the box (Fission 84, Rainbow Bridge 56, Orbit 52, Ball Tracker 36,
    Swish 72, Mixed Signals 60);
  - the column ends 16 px above the bottom of the screen, whatever the home-bar inset.

  The world is drawn at the largest uniform scale that fits, top-anchored (Tilt is centred). The check passes on
  this tree (see Checks below). Joe does the device testing.
- **414x896 is the iPhone 11 home-screen app:** a 48 px top inset and 34 px home bar, laid out to the screen's
  bottom since the 15 Oct fix. The box starts 96 px down and the column ends at 880.
- **390x844 and 430x932 have no insets,** which is the convention of the arena-sizes doc. A real 430x932 phone
  (iPhone 15/16 Pro Max class) has about a 59 px top inset, so its box is about 55 px shorter than shown. That
  only lowers its leftover; the conclusions don't change.
- **"Left over"** is the part of the box the world does not cover: px below (or across), and as a share of the
  box's area. For the ten scene games (`ARENA_SCENE_GAMES`) the space is painted scenery, not black. Everywhere
  else it is `--screen-edge` black.
- **"Max world height"** is the tallest world, at the game's width, that still fills the full screen width at all
  three sizes. The iPhone 11 home-screen app is always the size that binds. For a 390-wide world with no control
  row the limit is **738 px** (784 × 390/414), which is why batches 1 and 2 stopped at 730–735. A taller world
  than that becomes height-bound on the iPhone 11 and gains black bars at the sides there.
- **Bonk** has no world: its 4x4 board is a CSS square, so it is reported as a square.
- **Letterfall** counts as having a taller world. Its rev 2 already grew from 624 to 700 (`wfWorldHFor`), though
  that change came before the taller-worlds batches.
- **No "batch 3" of taller worlds** appears anywhere in the repo: no doc, no `arcade-tuning-g3` and no plan. Every
  "Batch 3" in the docs is the 12 Oct game batch. I've taken "batch 4" to mean the next taller-worlds batch after
  batches 1 and 2. If a batch 3 is in progress on another branch, the games below are what is left after it.

## Screen use today

Each cell reads: box → world as drawn · space left over · share of the box left over.

| Game | World | 414x896 (iPhone 11 home-screen app) | 390x844 | 430x932 | Max world height (gain) | Taller world / scene |
|---|---|---|---|---|---|---|
| Hover | 390x735 | 414x784 → 414x780 · 4 px below · 0.5% | 390x776 → 390x735 · 41 px below · 5.3% | 430x864 → 430x810 · 54 px below · 6.2% | 738 (+3) | taller (hoverRev 5) |
| Breaker | 390x730 | 414x784 → 414x775 · 9 px below · 1.2% | 390x776 → 390x730 · 46 px below · 5.9% | 430x864 → 430x805 · 59 px below · 6.8% | 738 (+8) | taller (brkRev 6) |
| Rally | 390x730 | 414x784 → 414x775 · 9 px below · 1.2% | 390x776 → 390x730 · 46 px below · 5.9% | 430x864 → 430x805 · 59 px below · 6.8% | 738 (+8) | taller (rallyRev 6) |
| Tempo | 390x730 | 414x784 → 414x775 · 9 px below · 1.2% | 390x776 → 390x730 · 46 px below · 5.9% | 430x864 → 430x805 · 59 px below · 6.8% | 738 (+8) | taller (beatRev 6) |
| Meteor | 390x724 | 414x784 → 414x769 · 15 px below · 2.0% | 390x776 → 390x724 · 52 px below · 6.7% | 430x864 → 430x798 · 66 px below · 7.6% | 738 (+14) | taller (snakeRev 5/6) |
| Fission | 390x650 | 414x700 → 414x690 · 10 px below · 1.4% | 390x692 → 390x650 · 42 px below · 6.1% | 430x780 → 430x717 · 63 px below · 8.1% | 659 (+9) | taller (burstRev 4) |
| Wavefront | 390x730 | 414x784 → 414x775 · 9 px below · 1.2% | 390x776 → 390x730 · 46 px below · 5.9% | 430x864 → 430x805 · 59 px below · 6.8% | 738 (+8) | taller (wavRev 6) |
| Orbit | 390x620 | 414x732 → 414x658 · 74 px below · 10.1% | 390x724 → 390x620 · 104 px below · 14.4% | 430x812 → 430x684 · 128 px below · 15.8% | 689 (+69) | neither |
| High Rise | 390x735 | 414x784 → 414x780 · 4 px below · 0.5% | 390x776 → 390x735 · 41 px below · 5.3% | 430x864 → 430x810 · 54 px below · 6.2% | 738 (+3) | taller (skylineRev 4) |
| Jaywalk | 390x580 | 414x784 → 414x616 · 168 px below · 21.5% | 390x776 → 390x580 · 196 px below · 25.3% | 430x864 → 430x639 · 225 px below · 26.0% | 738 (+158) | scene |
| Junction | 390x620 | 414x784 → 414x658 · 126 px below · 16.1% | 390x776 → 390x620 · 156 px below · 20.1% | 430x864 → 430x684 · 180 px below · 20.9% | 738 (+118) | neither |
| Rainbow Bridge | 390x620 | 414x728 → 414x658 · 70 px below · 9.6% | 390x720 → 390x620 · 100 px below · 13.9% | 430x808 → 430x684 · 124 px below · 15.4% | 685 (+65) | scene |
| Slice | 390x730 | 414x784 → 414x775 · 9 px below · 1.2% | 390x776 → 390x730 · 46 px below · 5.9% | 430x864 → 430x805 · 59 px below · 6.8% | 738 (+8) | taller (sliceRev 6) |
| Swish | 390x560 | 414x712 → 414x594 · 118 px below · 16.5% | 390x704 → 390x560 · 144 px below · 20.5% | 430x792 → 430x617 · 175 px below · 22.0% | 670 (+110) | scene |
| Flightpath | 390x560 | 414x784 → 414x594 · 190 px below · 24.2% | 390x776 → 390x560 · 216 px below · 27.8% | 430x864 → 430x617 · 247 px below · 28.5% | 738 (+178) | scene |
| Coral Pop | 390x730 | 414x784 → 414x775 · 9 px below · 1.2% | 390x776 → 390x730 · 46 px below · 5.9% | 430x864 → 430x805 · 59 px below · 6.8% | 738 (+8) | taller (bubbleRev 5) |
| Roofbound | 390x620 | 414x784 → 414x658 · 126 px below · 16.1% | 390x776 → 390x620 · 156 px below · 20.1% | 430x864 → 430x684 · 180 px below · 20.9% | 738 (+118) | scene |
| Grappler | 390x620 | 414x784 → 414x658 · 126 px below · 16.1% | 390x776 → 390x620 · 156 px below · 20.1% | 430x864 → 430x684 · 180 px below · 20.9% | 738 (+118) | neither |
| Scrumper | 360x640 | 414x760 → 414x736 · 24 px below · 3.2% | 390x752 → 390x693 · 59 px below · 7.8% | 430x840 → 430x764 · 76 px below · 9.0% | 660 (+20) | taller (snipRev 5) |
| Tilt | 440x470 | 414x784 → 414x442 · 342 px, half above and half below · 43.6% | 390x776 → 390x417 · 359 px, half above and half below · 46.3% | 430x864 → 430x459 · 405 px, half above and half below · 46.8% | n/a (disc is width-bound) | scene |
| Ball Tracker | 700x1000 | 414x748 → 414x591 · 157 px below · 20.9% | 390x740 → 390x557 · 183 px below · 24.7% | 430x828 → 430x614 · 214 px below · 25.8% | 1264 (+264) | neither |
| Gemstone | 390x560 | 414x784 → 414x594 · 190 px below · 24.2% | 390x776 → 390x560 · 216 px below · 27.8% | 430x864 → 430x617 · 247 px below · 28.5% | 738 (+178) | scene |
| Pinball | 390x700 | 414x784 → 414x743 · 41 px below · 5.2% | 390x776 → 390x700 · 76 px below · 9.8% | 430x864 → 430x772 · 92 px below · 10.7% | 738 (+38) | neither |
| Letterfall | 390x700 | 414x784 → 414x743 · 41 px below · 5.2% | 390x776 → 390x700 · 76 px below · 9.8% | 430x864 → 430x772 · 92 px below · 10.7% | 738 (+38) | taller (wordfall rev 2, 624 → 700) |
| Tenfall | 360x520 | 414x728 → 414x598 · 130 px below · 17.9% | 390x720 → 390x563 · 157 px below · 21.8% | 430x808 → 430x621 · 187 px below · 23.1% | 633 (+113) | scene |
| Bonk | square 4x4 board | 414x684 → 414x414 · 270 px below · 39.5% | 390x676 → 390x390 · 286 px below · 42.3% | 430x764 → 430x430 · 334 px below · 43.7% | n/a | scene |
| Pull! | 360x680 | 414x758 → 401x758 · 13 px across · 3.1% | 390x750 → 390x737 · 13 px below · 1.8% | 430x838 → 430x812 · 26 px below · 3.1% | 659 (-21) | taller (clayRev 6) + scene |
| Mixed Signals | 390x650 | 414x724 → 414x690 · 34 px below · 4.7% | 390x716 → 390x650 · 66 px below · 9.2% | 430x804 → 430x717 · 87 px below · 10.9% | 682 (+32) | taller (clashRev 5) |

Summary:
- **Already tall, nothing left to win:** Hover, High Rise, Breaker, Rally, Tempo, Wavefront, Slice, Coral Pop,
  Meteor, Fission, Scrumper, Pull! and Mixed Signals each leave at most 4.7 % of the box on the iPhone 11.
  - Pull! (clayRev 6, 360x680) is the one world already past the iPhone 11 limit: it is height-bound there and
    drawn 401 wide, with 13 px of scenery across. Its scene covers this.
  - Meteor has 14 px of headroom, less than its 24 px row, so no further row fits on the iPhone 11.
  - Scrumper has 20 px left. It is 360 wide, so it is scaled up and height-bound sooner.
- **Biggest leftovers.** Each figure is the share of the box left over on the iPhone 11 / at 390x844:

  | Game | Left over | What fills it |
  |---|---|---|
  | Tilt | 44 / 46 % | scene |
  | Bonk | 40 / 42 % | scene |
  | Gemstone | 24 / 28 % | scene |
  | Flightpath | 24 / 28 % | scene |
  | Jaywalk | 22 / 25 % | scene |
  | Ball Tracker | 21 / 25 % | black |
  | Tenfall | 18 / 22 % | scene |
  | Swish | 17 / 21 % | scene |
  | Roofbound | 16 / 20 % | scene |
  | Grappler | 16 / 20 % | black |
  | Junction | 16 / 20 % | black, practice only |
  | Orbit | 10 / 14 % | black |
  | Rainbow Bridge | 10 / 14 % | scene |
  | Pinball | 5 / 10 % | black |

- **Black gaps with no scene:** Orbit, Grappler, Ball Tracker, Pinball and Junction. All the other big leftovers
  are already filled with scenery.

## Would a taller world add play? (every game without one)

Risk is the risk to the game's scoring and stored rounds: **low** means a view or display change that stored runs
replay through unchanged; **medium** means a new stamp, generation or curve re-measured, with no stored bank to
rebuild; **high** means a stored bank, template set or proved plans must be rebuilt, or the game must be
redesigned. Every gameplay change needs its own stamp (rule 2): older rounds keep their world, replay and score
exactly as before, and the reveal reads it (`revealWorldH`, `fxSpecAt`), as in batches 1 and 2.

### Jaywalk (`cross`, crossRev 5, 390x580): real play: more lanes. Risk: medium.
- **Layout today:** a 36 px HUD, a 34 px kerb, 9 lanes of 52 px and a 34 px kerb, which is 572 px (`cross.ts:26-41`).
  - At the 738 limit, **12 lanes** fit (728 px, a 730 world, the batch 1/2 size); 11 lanes take 676 px.
  - Every extra lane is new traffic to read and time, so this is real play, not margin.
- **What changes:**
  - `CROSS_LANES` becomes per-revision (`crossLanesFor(rev)`), and so does the world height.
  - Course generation, the cyclist and roadworks lane picks, units and score all read the lane count
    (`cross.ts:237-430, 621, 906-916`).
  - The band curve gives 150 at 77 units, which is 7 crossings of 9 lanes plus 2 per crossing. It must be
    re-measured with `scripts/arcade-skill-bands.ts`. A crossing gets longer, so fewer crossings fit in 60 s;
    check the pace against the clock.
- **Re-prove:** courses are proved crossable at init by a lane × column × tick search, and there is no stored bank.
  Run the legacy replays (tuning-f/f2 fixtures), arcade-batch1-check's 150 proof, bullseye-cross-flip-tuning-check,
  arcade-self-replay, arcade-play, bottom-clearance, the intro demo stop, and arcade-score-bands-check.
- **Why medium:** the units-to-score mapping changes and must be re-banded.

### Gemstone (`matchup`, matchupRev 6, 390x560): more board, a difficulty and score change. Risk: medium.
- **Layout today:** a fixed 7x8 grid of 50 px cells at y 100, with the next-gem strip above it. About 60 px of the
  world is margin below the board (`matchup.ts:44-51, 110-118`).
- **Options:** at a 660 world the board could be 7x10 (y 100–600, keeping the 60 px margin), or at 710, 7x11 (y 100–650).
  - More rows mean longer cascades and more matches per swap. That is more board to work, not a new kind of play.
  - Simply raising the world height adds only empty starry backdrop, which the scene already paints.
- **What changes:**
  - `MATCHUP_ROWS` becomes per-revision.
  - Cascade step timing scales with rows dropped (`matchupV3StepTicks`), and so does the 70-per-column refill queue.
  - A new par and band curve: 150 at 2,800 points was measured with a bot on 7x8.
- **Re-prove:** arcade-tuning-f2-check (par), arcade-tuning-c-check, arcade-batch2-check and its bots,
  six-game-scoring-check, matchup-check, and the replay encoding in `src/lib/duel/matchup.ts`.
- **Why medium:** no bank, but the score par must be re-measured from scratch.

### Orbit (`orbit`, orbitRev 7, 390x620 view): more lookahead, same course. Risk: low.
- **How it works:** a camera scrolls over a climbing course. The current planet sits 440 px down the view, and
  planets are 172–265 px apart.
  - The view is limited to **689 px** (+69) by the 44 px SET CHECKPOINT row and the iPhone 11.
  - That shows about a third of the next jump further ahead. It helps the player read the course rather than
    adding play.
- **Course data:** bank courses (`ORBIT_REV3_BANK`, `ORBIT_HOLE_BANK`) are in absolute world coordinates. Going
  off screen is judged by a ±780 px world bound, not by the view, and `camY` is not in the checksum. The course,
  the hits and the score don't depend on the view height.
- **What changes:** the view height, the camera's safe box (`SAFE_INSET_Y` 120), the renderer and effects, and
  `orbit-camera-check`, which hardcodes 620.
- **Stamp:** add a view stamp anyway, so that stored rounds' reveals keep 620.
- **Re-prove:** orbit-camera-check, arcade-tuning-f-check's 30,720 swept flights (unchanged sim, so they should
  pass as they are), arcade-self-replay, arcade-play, bottom-clearance and arcade-device-bottom-check.

### Rainbow Bridge (`inkbridge`, inkRev 6, 390x620): longer drops, some play. Risk: medium–high.
- **How it works:** the vertical axis is the drop.
  - The spout is at y 50 and the pot at y 470–550. Birds sit between y 130 and the pot less 50.
  - A ball is lost below the world height.
- **Room:** with its 48 px control row the limit is **685 px** (+65). That allows a longer fall and one more
  stacked bird on the hard live levels (9–10). This is real, but modest.
- **What changes:**
  - the generator's draw ranges (pot, birds);
  - the per-level ink budgets (`inkBudgetFor`) and the 170 px live pre-release cap;
  - `DROP_MAX` 600 ticks against the longer fall;
  - the shield height and the y input range;
  - the band curve.
- **Re-prove:** there is no stored bank, but each level's reference route and its star proof are searched at init
  (`findLiveReference`), so search time grows and every level type needs proving solvable again. Run
  `scripts/ink-*-check.ts`, arcade-batch5-check, the legacy and replay fixtures, and tap and replay identity.

### Tenfall (`tendrop`, tenRev 1, 360x520): more lookahead, which makes it easier. Risk: medium.
- **How it works:** tiles spawn at y -64 and fall the world's height. A tile is on screen for about 8.7 s at
  stage 1 and about 5 s at stage 10.
- **Room:** the limit is **633 px** (+113; it is 360 wide and has a 56 px HUD above).
  - A taller well shows about 20 % more tiles at once and gives more time to choose. That makes the game easier
    rather than adding play.
  - To keep the difficulty the same, every stage speed must scale with the height. The net result is the same
    game, drawn bigger.
- **What changes:** the world height, the stage speeds, the 45 s time bonus (tenRev 1), and the tap y range.
- **Re-prove:** tendrop-check works on tile order, so its queue solver is unaffected. Also run
  arcade-input-identity-proof, replay-fixtures and replay-check (`scripts/fixtures/replay-runs.json`), and
  puzzle-score-rev-check.

### Roofbound (`flip`, flipRev 4, 390x620): mostly empty space. Risk: low to build, little gain.
- **How it works:** a side-scrolling runner between a ceiling at y 180 and a floor at y 440. The course runs along x.
  - The late-run bend already sweeps the corridor 145 px either way (y 35–585), nearly filling 620.
  - A flip takes 12 ticks whatever the distance.
- **Room:** at 730 the only new play is a bigger bend sweep. A taller corridor would only make flips look faster.
- **Re-prove:** the crumble and star proofs are height-independent (the bend is a shared offset). Run
  flip-bend-check, hotfloor-flip-check, bullseye-cross-flip-tuning-check and the tuning-c legacy fixtures.
- **Verdict:** its scene already fills the gap. Not worth a stamp.

### Grappler (`swing`, swingRev 8, 390x620): empty rock unless the cavern is redesigned. Risk: high.
- **How it works:** a horizontal side-scroller. The cavern runs from a ceiling at 40–100 to a floor at 540–590,
  with anchors 60–170 below the ceiling and a 220 px rope. The score is metres along x.
- **Room:** a taller world with today's courses would only show more rock. Real play would need a deeper cavern
  (bigger arcs, longer falls), which means:
  - a new course generator;
  - beam-search proofs (`swingProof.server.ts`, seconds per course);
  - a rebuilt 300-seed `SWING_V4_BANK` (`scripts/swing-bank.ts`);
  - swing-rev8-check and a score refit.
- **Cheaper option:** paint a cavern scene in the 126–180 px of black, like the ten arena-scene games.

### Ball Tracker (`balltrack`, btRev 3, 700x1000 at 0.557x): two more rows, effectively a redesign. Risk: high.
- **How it works:** a 7x9 grid of 100 px tiles, limited by width. There is room for **2 more rows** (max height
  1264).
- **Room:** more rows mean more switch decisions, which is real play. But the rows set the fixed serpentine layout
  (`BT_KIND`, `BT_ALWAYS_FIXED`) and the ball's transit time. Both drive the drop schedule (every 103 ticks, last
  drop at 2,988, `BT_LAST_LAND_MIN`).
- **Re-prove:** the 400-course `ballTrackBank.server.ts` (each course proved by a playbook), balltrack-check and the
  curve would all need rebuilding.
- **Cheaper option:** a scene, or simply accepting the black (25 %).

### Flightpath (`bullseye`, bullRev 4, 390x560): aim sensitivity only. Risk: medium for no gain.
- **How it works:** a front view down the range. The target centre is `round(H × 0.4)` = 224 and the bow is at
  y 532. `FLIGHT_NUM` (bow minus centre, 308) sets how far a flick carries.
  - Raising H moves the target and changes aim sensitivity. The flight is drawn only; the landing point is
    computed on release.
- **Verdict:** a taller world adds no play, only a longer drag runway, and needs the centre pinned per revision.
  Its scene already fills the 190–216 px. Not a candidate.

### Swish (`bintoss`, binRev 4, 390x560): empty sky. Risk: medium for no gain.
- **How it works:** play runs horizontally. The floor is at 500 px, the bin 135–270 px away, and the reference
  throw peaks about 90 px up.
  - Wind is calibrated on the reference throw's time to reach the rim.
  - Hoops and spinners sit relative to the rim.
- **Room:** the limit is 670 (+110). The extra height would only be sky, unless new vertical content (higher hoops)
  is designed and re-banded. Its scene already fills the space. Not a candidate.

### Tilt (`tilt`, tiltRev 4, 440x470): nothing to add. Risk: n/a.
- **How it works:** a rotating disc (radius 204) with gravity down the screen. The disc is limited by the width,
  so a taller world cannot make it bigger without a wider world.
- **Room:** the 342–405 px are the scene's table. Not a candidate.

### Bonk (`whack`, no stamp, 4x4 board): nothing to add. Risk: n/a.
- **How it works:** taps are hole numbers 0–15, scheduled by tick, and there is no world height.
  - A 4x5 board only changes difficulty and needs a first stamp.
  - Taller cells only change the look.
- **Room:** its grass scene fills the 270–286 px. Not a candidate.

### Meteor (`snake`, snakeRev 6, 390x724, 28 rows of 24 px): no room for another row. Risk: medium for one row on some phones.
- **Room:** the iPhone 11 limit is 738, which leaves 14 px, less than a 24 px row.
  - 29 rows (748) would be height-bound on the iPhone 11, at 409 wide with side bars.
  - 30 rows (772) fit only 390x844 and 430x932.
- **Verdict:** at most +1–2 rows (about 4–7 % more cells). Each needs snakeRev 7, a re-measured band curve and
  legacy fixtures (arcade-tuning-e/f-check). Not worth it.

### Scrumper (`snip`, snipRev 7, 360x640): no room. Risk: high.
- **Room:** it is 360 wide, so the iPhone 11 limit is 660 (+20).
- **What changes:** all 67 levels are hand-placed templates at absolute y. Any stretch slows falls on a 60 s clock.
- **Re-prove:** all 4,435 stored per-pin plans (snip-rev5/6/7 proofs, snip-rev7-check) plus snip-check at full
  depth.
- **Verdict:** not a candidate.

### Pinball (`pinball`, pinRev 1, 390x700): small and costly. Risk: high.
- **Room:** +38 px. Every feature sits at a fixed y (arch, lanes, bumpers, spinner, drop targets, flippers at 620,
  shooter rest at 652). The launch speeds are tuned to clear the arch.
  - Stretching the table only adds travel time.
  - A bigger table means a new layout, retuned launches and kicks, pinRev 2, new `pinball-rev1`-style fixtures and
    a new band curve.
- **Verdict:** not a candidate at +38 px. Its 41–76 px of black could take a scene (an apron or cabinet) at no
  scoring risk.

### Letterfall (`wordfall`, rev 2, 390x700): half a row. Risk: medium.
- **Room:** +38 px, under a 60 px cell, so no full row fits on the iPhone 11.
- **Verdict:** another row would only add buffer before a loss, which is a difficulty change. Not a candidate.

### Junction (`junction`, retired to practice): no.
- **How it works:** the crossroads is fixed at the centre and cars come in from off the edges. A taller world only
  stretches the roads.
- **Verdict:** it is practice-only, so it isn't worth a stamp.

## Recommendation: batch 4, in priority order

| # | Game | New world | Gain | Risk |
|---|---|---|---|---|
| 1 | Jaywalk | 390x730 (11–12 lanes) | more lanes; fills 22–26 % of the box | medium |
| 2 | Orbit | 390x685 view | more course ahead; turns 10–16 % black into course; course and score unchanged | low |
| 3 | Gemstone, optional | 7x10 at 390x660, or 7x11 at 390x710 | bigger board; fills a 24–28 % gap that is now scenery | medium |

1. **Jaywalk (390x730, 11 or 12 lanes).** The one candidate where a taller world clearly adds new play.
   - It turns the largest open space among the reaction games (22–26 % of the box) into lanes.
   - No bank to rebuild: courses are proved at init. The cost is a lane-count-aware generator and a re-measured
     band curve.
   - Suggested: 11 lanes (676 px) to keep crossing pace close to today's; 12 lanes (728 px) to fill the screen.
     Measure both with the skill-band tool before choosing.
2. **Orbit (390x685 view).** Cheap and low risk.
   - Course, hits and score are untouched; only the view height and the camera's safe box change.
   - Removes Orbit's 74–128 px of black. Add a view stamp so old reveals keep 620.
3. **Gemstone (7x10 or 7x11), optional.** Only if a bigger board is wanted as a design change.
   - It needs a new par from a bot.
   - Its gap is already a scene, so the screen gain is cosmetic. Hold it unless Joe wants a bigger board for its
     own sake.

**Not worth a batch 4:** Tilt, Bonk, Flightpath, Swish, Roofbound, Tenfall, Meteor, Scrumper, Pinball, Letterfall and
Junction. Grappler and Ball Tracker would gain real play only through a redesign with high risk (bank rebuilds and
proofs).

**Scene instead of a taller world (display only, no scoring risk):** Grappler (cavern rock), Ball Tracker, Pinball
(apron or cabinet) and Orbit if it is not taken in batch 4. These are the remaining games that show black. The arena
scene pattern (`ArcadeArenaSlot` `scene`, painted once per size, `pointer-events: none`) covers them.

Each game in a batch 4 follows the batch 1/2 pattern:
- `<game>WorldHFor(rev)`, with `worldH` last in the checkpoint checksum;
- `revealWorldH` and `fxSpecAt` for reveals and effects;
- an arcade-tuning-g4-check replaying pre-change runs on every older revision, plus new-stamp runs reaching 150;
- the intro demos stopped until they are re-recorded;
- the arena-sizes doc regenerated;
- arcade-play, bottom-clearance, arcade-device-bottom, arcade-self-replay, arcade-fx, reveal-score and
  arcade-score-bands checks.

## Checks

- presentation-geometry-check: **pass** (168 arcade play-screen geometries; 14 source/SSR phase checks). It
  rewrote `docs/arena-sizes-oct-2026.md` and `.lovable/audits/presentation-geometry-oct6.md` byte for byte, so
  there was no diff.
- No other check was run, as asked. The full suite runs on the PR.
