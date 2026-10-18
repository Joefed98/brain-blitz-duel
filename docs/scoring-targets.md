# Scoring targets (18 Oct 2026)

Joe's targets for every puzzle and arcade game (a round scores 0–150):

| Score | Meaning | Simulated level it should fit |
|---|---|---|
| 150 | very hard, near perfect | a flawless run (scripted best) |
| 140–150 | tough | near-perfect |
| 130–140 | you have to be great | great |
| 110–130 | good | good |
| 90–110 | average, decent | average |
| below 90 | scales down smoothly | weaker play |

The simulated players are the ones every earlier calibration used: the arcade skill-band humans
(`scripts/arcade-skill-bands/human.ts`, four levels) and the puzzle-fairness kits (`scripts/puzzle-fairness/kit.ts`, the
same four levels). The October bands aimed at **70 / 100 / 125 / 140** for those levels, so the targets move every
arcade game up by about 30 at the average level, 20 at good and 10 at great; near-perfect and 150 barely move.

## Summary

- **Every arcade band game (22 in rooms) moves to a new revision** that keeps its play and lifts its band curve: each
  knot keeps its units and its points go through one map, `BAND_TARGET_MAP` (`src/lib/arcade/scoreBands.ts`):
  0 → 0, 70 → 100, 100 → 120, 125 → 135, 140 → 140, 150 → 150, straight lines between. So the same run never scores
  less, finishes and the top are unchanged, and each game keeps its own calibration (Joe's kinder Tempo, Gemstone's par,
  Rainbow Bridge fitted to his play).
- **Wavefront** (too harsh) gets its own gentler curve instead of the lift (`wavRev 7`): the old knots sat in a cliff
  (249 → 70, 259 → 100), so a few missed ships cost 30–50 points and a run ending in wave 4 scored under 50. Now
  two waves ≈ 60, four ≈ 92, reaching the boss ≈ 105, never below `wavRev 6` for the same play.
- **Nucleus and Forage** (too harsh) score their word points on curves (`wordsmithRev 1`, `wordHuntRev 1`) instead of
  2.5 × and 2 × points: average players went from 22 and 16 to about 95.
- **Bonk** (clearly low at every level, 62 / 102 / 118 / 133) keeps its play and costs; the total is lifted
  (`whackRev 1`) to about 100 / 120 / 135 / 145.
- **Swish**: the spinner is an eighth shorter (21 px each side of its pivot, was 24) in `binRev 5`, which also carries the lift.
- **Hanoi**: slimmer, cleaner rings (display only, no stamp); the posts stay the tap targets.
- **Puzzles**: measured, not changed beyond Nucleus, Forage and Bonk. As a group they are steep against the targets
  (average players often score 20–70 because they do not finish; good and great players often score 140–150), which
  is the shared puzzle score shape, not one game. That and the individual outliers are listed for Joe below.

Older rounds keep their stamps and replay and score exactly as before: only new rounds are dealt the new revisions, and
every older revision's game object is untouched (the legacy-replay checks below all pass unchanged).

## Stamps

| Game | Field | Before → now | What the new revision does |
|---|---|---|---|
| Ball Tracker | `btRev` | 4 → 5 | lift |
| Wavefront | `wavRev` | 6 → 7 | gentler curve `WAV_V7_BAND_CURVE` |
| Roofbound | `flipRev` | 4 → 5 | lift |
| Rainbow Bridge | `inkRev` | 6 → 7 | lift |
| Gemstone | `matchupRev` | 6 → 7 | lift |
| Coral Pop | `bubbleRev` | 5 → 6 | lift |
| Jaywalk | `crossRev` | 5 → 6 | lift |
| Rally | `rallyRev` | 6 → 7 | lift |
| Meteor | `snakeRev` | 6 → 7 | lift |
| Swish | `binRev` | 4 → 5 | spinner 21 px (was 24) + lift |
| Scrumper | `snipRev` | 7 → 8 | lift |
| Hover | `hoverRev` | 5 → 6 | lift |
| High Rise | `skylineRev` | 4 → 5 | lift |
| Breaker | `brkRev` | 6 → 7 | lift |
| Tilt | `tiltRev` | 4 → 5 | lift |
| Orbit | `orbitRev` | 8 → 9 | lift |
| Tempo | `beatRev` | 6 → 7 | lift |
| Slice | `sliceRev` | 6 → 7 | lift |
| Fission | `burstRev` | 4 → 5 | lift |
| Grappler | `swingRev` | 9 → 10 | lift |
| Flightpath | `bullRev` | 4 → 5 | lift |
| Pinball | `pinRev` | 1 → 2 | lift |
| Nucleus | `wordsmithRev` | none → 1 | `WORDSMITH_V1_CURVE` on word points |
| Forage | `wordHuntRev` | none → 1 | `WORDHUNT_V1_CURVE` on word points |
| Bonk | `whackRev` | none → 1 | `WHACK_TARGET_LIFT` on the total |

How it is built: a lifted state carries `band: 2` from its first tick (`bandTargetGame`), and each sim's breakdown scores
on `bandCurveOf(state, curve)`, which is the curve itself on `band: 1` states and `bandRetarget(curve)` on `band: 2`
ones. The phone's HUD, the server replay and the reveal all read the same breakdown. `src/lib/arcade/liveBands.ts` lists
each lifted curve as the game's newest `<GAME>_V<n>_BAND_CURVE`, so the "?" help's numbers follow it; the help's "good
run" is now 120 points (`BAND_GOOD_POINTS`, was 100), at the same units as before. Practice bests start fresh on the new
stamps (`practiceStamps.data.ts` rebuilt).

## Arcade games

Medians from `bun scripts/arcade-skill-bands.ts --rev=now --seeds=40` (40 room seeds per level, every run through the
server's own encode + replay; none flagged or disagreeing), before (the revision rooms dealt on 17 Oct) → after (the
new revision). Target per level: average 90–110, good 110–130, great 130–140, near-perfect 140–150.

| Game | Before: avg / good / great / near | After | Verdict after |
|---|---|---|---|
| Ball Tracker | 66 / 100 / 130 / 134 | 94 / 120 / 137 / 138 | on target (near a little low) |
| Wavefront | 69 / 118 / 118 / 140 | 111 / 128 / 128 / 140 | on target; eased as asked (average at the top of its band) |
| Roofbound | 80 / 146 / 147 / 150 | 107 / 148 / 149 / 150 | **borderline: good too generous** (below) |
| Rainbow Bridge | 34 / 51 / 67 / 93 | 50 / 73 / 92 / 115 | **borderline: bots under-rate it** (below) |
| Gemstone | 68 / 82 / 98 / 106 | 97 / 108 / 118 / 123 | **borderline: bots under-rate it** (below) |
| Coral Pop | 66 / 100 / 125 / 138 | 94 / 120 / 135 / 139 | on target |
| Jaywalk | 68 / 96 / 127 / 145 | 97 / 117 / 136 / 145 | on target |
| Rally | 66 / 100 / 142 / 142 | 96 / 120 / 142 / 142 | on target |
| Meteor | 70 / 105 / 125 / 142 | 100 / 123 / 135 / 142 | on target |
| Swish | 76 / 100 / 130 / 138 | 100 / 122 / 133 / 139 | on target (shorter spinner included) |
| Scrumper | 73 / 110 / 134 / 137 | 102 / 125 / 138 / 139 | on target |
| Hover | 63 / 86 / 120 / 123 | 90 / 109 / 131 / 133 | **borderline: near-perfect low** (below) |
| High Rise | 72 / 97 / 122 / 145 | 101 / 118 / 133 / 145 | on target |
| Breaker | 72 / 96 / 125 / 138 | 101 / 117 / 135 / 139 | on target |
| Tilt | 75 / 98 / 130 / 127 | 103 / 119 / 136 / 136 | on target (near-perfect bots fall chasing hole stars, as before) |
| Orbit | 70 / 100 / 129 / 136 | 100 / 120 / 136 / 138 | on target |
| Tempo | 74 / 114 / 140 / 149 | 102 / 128 / 140 / 149 | on target (Joe's kinder Tempo kept) |
| Slice | 70 / 101 / 122 / 137 | 96 / 121 / 128 / 137 | on target (great a touch low) |
| Fission | 69 / 106 / 133 / 132 | 99 / 128 / 144 / 144 | **borderline: great high** (below) |
| Grappler | 68 / 99 / 124 / 132 | 96 / 119 / 134 / 137 | on target |
| Flightpath | 68 / 100 / 121 / 142 | 97 / 120 / 132 / 143 | on target |
| Pinball | 68 / 95 / 120 / 142 | 97 / 117 / 132 / 143 | on target |
| Junction (practice only) | 81 / 109 / 115 / 140 | unchanged | not dealt in rooms; left on its curve |

## Puzzle games

Medians from `bun scripts/puzzle-fairness.ts --seeds=30` (the kits on 30 room puzzles, graded by the server's own
`gradeAnswer`); Nucleus, Forage and Bonk after their change. "Off" is how far a level sits outside its band.

| Game | avg / good / great / near | Verdict | Changed |
|---|---|---|---|
| Interlock | 51 / 137 / 150 / 150 | steep (avg −39, great +10) | no |
| Slider | 145 / 146 / 150 / 150 | **generous** (avg +35, good +16) | no — Joe |
| Lookout | 121 / 147 / 150 / 150 | generous (good +17) | no — Joe |
| Roundabout | 72 / 102 / 143 / 150 | low (avg −18, good −8) | no |
| Strikeout | 97 / 140 / 146 / 147 | good +10 | no (Joe's rev 3, 15 Oct) |
| Cryptogrid | 89 / 143 / 150 / 150 | good +13 | no |
| Swapword | 132 / 149 / 150 / 150 | **generous** (avg +22, good +19) | no — Joe |
| Exact | 47 / 143 / 150 / 150 | steep (avg −43, good +13) | no |
| Operator | 85 / 143 / 150 / 150 | good +13 | no |
| Counterweight | 70 / 126 / 142 / 150 | avg −20 | no |
| Integer Pyramid | 52 / 80 / 106 / 136 | **low at every level** | no — Joe (below) |
| Trail | 66 / 131 / 146 / 150 | avg −24 | no |
| Brimful | 48 / 110 / 144 / 150 | avg −42 | no |
| Checkout | 46 / 100 / 144 / 150 | avg −44, good −10 | no |
| Ballpark | 72 / 105 / 126 / 142 | avg −18 | no |
| Tenfall | 97 / 128 / 135 / 137 | on target | no |
| Ascend | 61 / 126 / 145 / 150 | avg −29 | no |
| Don't Break the Chain | 20 / 82 / 135 / 150 | **low** (avg −70, good −28) | no — Joe (below) |
| Mixed Signals | 70 / 100 / 134 / 144 | avg −20, good −10 | no |
| Eagle Eye | 66 / 103 / 135 / 150 | avg −24 | no |
| Double Take | 73 / 136 / 148 / 150 | avg −17 | no |
| Tally | 49 / 92 / 150 / 150 | **low then generous** (avg −41, good −18, great +10) | no — Joe (below) |
| Labyrinth | 57 / 107 / 136 / 146 | avg −33 | no |
| Matchmaker | 79 / 146 / 150 / 150 | good +16 | no |
| Gridlock | 50 / 141 / 148 / 150 | steep (avg −40, good +11) | no |
| Tessellate | 69 / 125 / 142 / 150 | avg −21 | no |
| Skid | 61 / 138 / 146 / 150 | avg −29 | no |
| Topsy-Turvy | 37 / 137 / 148 / 150 | steep (avg −53) | no |
| Jumbled | 30 / 138 / 148 / 150 | steep (avg −60) | no |
| Turntable | 15 / 146 / 150 / 150 | steep (avg −75, good +16) | no |
| Lightbender | 22 / 133 / 147 / 150 | steep (avg −68) | no |
| Pipeline | 51 / 124 / 138 / 149 | avg −39 | no |
| Blackout | 23 / 133 / 146 / 150 | steep (avg −67) | no |
| Box Six | 58 / 113 / 140 / 150 | avg −32 | no |
| Chroma Lines | 70 / 134 / 147 / 150 | avg −20 | no |
| Heave | 73 / 144 / 150 / 150 | good +14 | no |
| Hanoi | 36 / 140 / 149 / 150 | steep (avg −54, good +10) | display only (slimmer rings) |
| Polypotions | 24 / 139 / 148 / 150 | steep (avg −66) | no |
| Safe Cracker | 0 / 147 / 150 / 150 | all or nothing (avg −90, good +17) | no |
| Bomb Defusal | 125 / 150 / 150 / 150 | **generous** (avg +15, good +20) | no — Joe |
| Mosaic | 91 / 146 / 150 / 150 | good +16 | no |
| Colour Flood | 96 / 146 / 150 / 150 | good +16 | no |
| Tents and Trees | 60 / 131 / 149 / 150 | avg −30 | no |
| Shikaku | 51 / 122 / 141 / 150 | avg −39 | no |
| Lamplighter | 62 / 131 / 148 / 150 | avg −28 | no |
| **Nucleus** | 22 / 57 / 85 / 137 → **83–95 / 122 / 135 / 145** | was far too harsh | **yes, `wordsmithRev 1`** |
| **Forage** | 16 / 30 / 48 / 72 → **78–95 / 120 / 135 / 145** | was far too harsh | **yes, `wordHuntRev 1`** |
| Letterfall | 105 / 150 / 150 / 150 | good +20 | no |
| Flash | 70 / 104 / 127 / 144 | avg −20 | no — Joe tuned it down on 14 Oct (below) |
| Bang On | 109 / 119 / 129 / 133 | near −7 | no |
| **Bonk** | 62 / 102 / 118 / 133 → **99 / 120 / 135 / 145** | was low at every level | **yes, `whackRev 1`** |
| Pull! | 88 / 125 / 150 / 150 | great +10 | no |

Nucleus and Forage, word points per level (`bun scripts/word-open-bands.ts --seeds=40`): Nucleus 10 / 23 / 34 / 55,
Forage 9 / 15 / 24 / 36. The curves put those at 95 / 122 / 135 / 145 and 95 / 120 / 135 / 145, top out where the
old formulas did (Nucleus 150 at 60 points, Forage at 48 by the curve; never below the old formula for the same
points), and keep the first few points cheap so random letters stay low (Nucleus random 4-letter tries median 8, was 5;
Forage random paths median 10, was 8; the luckiest random runs now reach about 80, so a careless player is paid a
little more than before — the price of a steeper early curve). Average players' range (p10–p90) is about 72–107 and
61–99. The puzzle-fairness run (seeds 5001–5030) puts their averages at 83 and 78, the 40-seed run at 95 and 95.

## For Joe to rule on

Proposed changes I did not make (each would be a new stamp, as above):

1. **The puzzle score shape (all finish puzzles).** Average kits score 15–70 in most puzzles (they run out of time),
   while good and great kits score 140–150. Against the targets the shape is too steep at both ends. Proposal:
   `puzzleScoreRev 2` with (a) unfinished credit lifted, e.g. 110 × (credit ÷ 110)^0.65 so half done ≈ 70 instead
   of 55, still at most 110 so every finish beats every unfinished run; and (b) the speed part's full 30 only with at
   least two thirds of the clock left (was a half), so a good finish lands nearer 130 than 150. I left it because it moves
   45 games at once and the kits' think times are per-game estimates, less trustworthy than the arcade bots; best
   decided with your own phone runs on a few puzzles first.
2. **Integer Pyramid** (52 / 80 / 106 / 136): good kits finish 0 of 30 in 120 s. Proposal: 150 s on new rounds, or
   three pyramids instead of four. A play-time change, so yours to call.
3. **Don't Break the Chain** (20 / 82 / 135 / 150) and **Flash** (70 / 104 / 127 / 144) were tuned down on 14 Oct
   (speed tuning). Proposal: Flash's curve back up by about 15 at the low end; the chain's unfinished credit lifted
   (half the links ≈ 80). Left because they reverse a fresh ruling.
4. **Tally** (49 / 92 / 150 / 150): low then generous (attention rework, 14 Oct). Proposal: near misses worth a little
   more (one off 25 % of the tray, was 15 %), the finish unchanged.
5. **Slider, Swapword, Bomb Defusal, Lookout** (good 146–150): generous at average and good. Proposal: the speed part's
   full 30 only with two thirds of the clock left (item 1b) on these first.
6. **Roofbound** (107 / 148 / 149 / 150 after): good players already score like great ones; most good bots survive the
   minute. Proposal: knots between average and great lowered so good lands about 125 (`flipRev 6`).
7. **Rainbow Bridge** (50 / 73 / 92 / 115) and **Gemstone** (97 / 108 / 118 / 123): the bots under-rate both (they never
   plan bridges or cascades); both were fitted to your own runs (Tuning C and F), and the lift moves your runs from
   103–116 to about 122–130 on Rainbow Bridge. Proposal: play a few rounds of each; if your runs land under 120, lift
   them another 10 % (`inkRev 8`, `matchupRev 8`).
8. **Hover** near-perfect 133 and **Fission** great 144: small. Proposal: Hover's top knots up a few points, Fission's
   middle knots down a few (`hoverRev 7`, `burstRev 6`).

## Assumptions

- The four simulated levels map onto the target bands in order (average → 90–110, good → 110–130, great → 130–140,
  near-perfect → 140–150), as the October bands mapped them onto 70 / 100 / 125 / 140.
- "Clearly off" for an arcade game meant its median sitting outside the band at two or more levels; every arcade game
  was (about 25–30 low at average), so all of them moved, with one shared lift so each keeps its own calibration.
  Junction is practice-only and stays on its curve.
- For puzzles I changed only the three games that were low at every level (Nucleus, Forage, Bonk); the rest are a shared
  shape question or reverse rulings from the last week, so they are listed above instead.
- Swish's "10–15 % shorter": 12.5 % (24 → 21 px half-length; same pivot, thickness and speed). The art draws the sim's
  own bar ends, so what you see is still what the ball bounces off.
- Hanoi: rings 9–16 px thick on the live board (were 12–30), 4 px apart, flat pills with a soft top light and a crisp rim;
  posts thinner to match. The tap targets are the posts (full-height, equal-width columns, about 85 px wide on a 390 px
  phone), unchanged. Display only, so no stamp.

## Checks

- `scripts/scoring-targets-check.ts` (new, ~5 s): the lift's anchors and that it never lowers a score; every lifted
  curve keeps its units and top and never scores below its previous curve; rooms deal every new revision; older
  revisions keep `band: 1`; 176 bot runs recorded on the new revisions (`scripts/fixtures/scoring-targets-runs.json.gz`)
  replay unflagged and, on the previous revision, end in the identical state and never score more; Swish's 21 px bar on
  the same pivot; Nucleus, Forage and Bonk stamps, curves, graders and the server replay; Hanoi's posts.
- Older checks that pinned "rooms deal revision N" now compare the dealt stamp through `playRevOf`
  (`scripts/scoring-targets-revs.ts`), so they keep proving the play they were written for; their legacy replays are
  unchanged. The "?" help checks read 120 points for a good run.
- Tools: `bun scripts/arcade-skill-bands.ts --rev=now` measures the revisions rooms deal today;
  `bun scripts/word-open-bands.ts` measures Nucleus and Forage word points.
