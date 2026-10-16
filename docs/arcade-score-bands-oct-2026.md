# Arcade score bands — October 2026

All 22 active arcade games now score on one shape, fitted so that the same simulated skill level lands
in a similar band in every game. Every change is a new revision stamp on the stored puzzle, so rounds
stored before this change replay and score exactly as they did.

## Targets

| Level | Target band | Median reached (new rules, 22 games) |
|---|---|---|
| Average | 60–80 (aim 70) | 68–80 in 21 games (Rainbow Bridge 37, see below) |
| Good | 90–110 (aim 100) | 94–111 in 20 games (Roofbound 141, Rainbow Bridge 55) |
| Great | 115–135 (aim 125) | 114–140 in 20 games (Roofbound 144, Rainbow Bridge 86) |
| Near-perfect | 140–150 | 140–150 in 10 games; 135–138 in 7 (Ball Tracker, Swish, Fission, Hover, Orbit, Scrumper, Tilt); 129–131 in 4 where the bots barely separate great from near (Coral Pop, Jaywalk, Rally, Slice); Rainbow Bridge 100 |
| Perfect run | 150 | 150 in every game (a full clear at speed, or the curve's top on open games) |

## How the bands were measured

`scripts/arcade-skill-bands.ts` (with `scripts/arcade-skill-bands/`) plays every game with simulated human
players at four levels and sends each run's input log through the server's own encode + replay path; only the
replayed score is counted. It is a reusable tool, not a check:

    bun scripts/arcade-skill-bands.ts                       # all 22 games, 30 room seeds per level, live revisions
    bun scripts/arcade-skill-bands.ts bintoss tilt --rev=both --jobs=4 --json=out.json

The four levels are defined once (`scripts/arcade-skill-bands/human.ts`) and used in every game:

| Level | Reaction (mean ± sd) | Lapse chance | Timing sd | Aim sd (phone px) | Power sd | Slip rate | Think time | Judgement blur | Tracking lag |
|---|---|---|---|---|---|---|---|---|---|
| Average | 300 ± 55 ms | 8 % | 45 ms | 9 | 7 % | 10 % | ×1.0 | 35 % | 140 ms |
| Good | 230 ± 40 ms | 4 % | 30 ms | 6 | 4.5 % | 5 % | ×0.75 | 20 % | 100 ms |
| Great | 190 ± 30 ms | 2 % | 20 ms | 4 | 3 % | 2.5 % | ×0.55 | 10 % | 75 ms |
| Near-perfect | 160 ± 20 ms | 0.5 % | 12 ms | 2.5 | 1.5 % | 0.8 % | ×0.4 | 4 % | 55 ms |

Each game has its own player (`scripts/arcade-skill-bands/bots/<type>.ts`). They may use the sim or a solver to know the
right move (that stands in for experience), but every action goes through the human model: late perception, reaction to
surprises, timing and aim error that grows with how far ahead the player must judge, one focus at a time, finger speed,
think time on puzzle steps, blurred choices and slips. No bot ever looks at the score, and no noisy action is chosen
because a forked sim showed it succeeding. Each bot file lists the few game-specific constants it adds.

**Assumptions (made without phone data):** the profile figures above; per-game constants such as finger top speed
(26–44 px a tick), Tempo's comfortable note rate (4.5–8 a second), the chance a player goes for optional stars, hoops,
leaves and black holes, and how often weaker Gemstone players read through cascades. Joe's phone testing is the real
calibration; re-run the script after changing a bot or a curve.

## The new shape (scoreBands.ts)

- A game counts its achievement in units (buckets, bricks, metres, match points…). A band curve turns units into points:
  straight lines between a few knots, from (0, 0) up to the game's full-run figure. More achievement never scores less.
- **Finish games** (a clear, a finish line or surviving the clock): the curve tops out at 140, and finishing adds up to 10
  (a flat 10, or the 50 % par speed curve where the game had a speed element). One unit short of a finish is never more
  than 12 below the best finish (checked at every count of optional extras). This replaces the 11 Oct 130 / 150 split.
- **Open games** (no finish): the curve tops out at 150 at a near-perfect figure.
- **Doing nothing scores 0:** a run with no player input scores 0. Before this change an idle run scored 30 in Ball Tracker,
  20 in Breaker, 19 in Junction and 16 in Wavefront.
- Cap 150. Penalties that already existed stay where they mean something (Slice chilli −10, Junction give-ups and stopped
  ambulances, Tempo misses now −2 instead of −8, Fission −5 a life lost).
- Every game's "?" help states its top, what a good run (100 points) takes and the finish rule, computed from the curve of the revision new rooms deal (16 Oct 2026: knot lists replaced by one plain line; `liveBands.ts`); the intro SCORE line says it
  in plain words.

## Old and new, per game

Medians at 30 room seeds per level, before → after (same simulated players, same seeds; for score-only revisions the
identical input log is replayed under both rules).

| Game (stamp) | Old formula | New formula | Average old → new | Good old → new | Great old → new | Near-perfect old → new |
|---|---|---|---|---|---|---|
| Ball Tracker (btRev 2 → 3) | round(130 × home ÷ 30), max 126 short of all 30; all home = 130 + up to 20 speed (landing window) | Each marble home counts 1. Points follow 10 → 32, 19 → 70, 26 → 104, 28 → 126, 29 → 138, 30 → 140, in straight lines between (up to 140). All 30 home adds up to 10 for speed: the full 10 if the last marble lands by 56.5 s, falling to 0 at the buzzer. Up to 150. | 82 → **70** | 111 → **102** | 121 → **126** | 126 → **138** |
| Wavefront (wavRev 2 → 3) | floor(150 × (ships + armour + 5 × saucers + 15 × waves + boss hits + 40 × boss kill) ÷ 309) | Ships, armour hits and boss hits count 1, saucers 5 and cleared waves 15. Points follow 100 → 25, 214 → 72, 235 → 100, 255 → 120, 269 → 140, in straight lines between (up to 140). Destroying the boss adds 10. Up to 150. | 103 → **72** | 114 → **100** | 137 → **140** | 150 → **150** |
| Roofbound (flipRev 2 → 3) | floor(130 × (seconds ÷ 60)²) + 2 per star, cap 150 | Each half second you last counts 1 and each gold star 3. Points follow 40 → 15, 105 → 70, 130 → 100, 140 → 120, 150 → 140, in straight lines between (up to 140). Lasting the full minute adds 10. Up to 150. | 82 → **70** | 147 → **141** | 148 → **144** | 150 → **150** |
| Rainbow Bridge (inkRev 4 → 5) | 11 per level + 2 per star, cap 130 (max 107 short of 10); all 10 = 130 + up to 20 speed + stars | Each level counts 10 and each gold star 2. Points follow 10 → 35, 20 → 55, 40 → 85, 60 → 110, 80 → 128, 90 → 138, 108 → 140, in straight lines between (up to 140). All ten levels adds up to 10 for speed: the full 10 with at least half the time left, falling to 0 at the buzzer. Up to 150. | 12 → **37** | 22 → **55** | 45 → **86** | 57 → **100** |
| Gemstone (matchupRev 3 → 4) | floor(150 × match points ÷ 5,500) | Match points: longer lines, cascades and special gems score more. Points follow 560 → 70, 760 → 100, 980 → 125, 1,150 → 145, 1,300 → 150, in straight lines between: 150 at 1,300. | 15 → **70** | 20 → **97** | 26 → **124** | 31 → **145** |
| Coral Pop (bubbleRev 2 → 3) | round(100 × share cleared), max 99; cleared = 130 + up to 20 speed. Joker every 15 shots, a mine and a torpedo every 60 | Each bubble cleared from the field counts 1. Points follow 36 → 70, 50 → 100, 60 → 120, 64 → 132, 66 → 138, 67 → 140, in straight lines between (up to 140). Clearing the field adds up to 10 for speed: the full 10 with at least half the time left, falling to 0 at the buzzer. Up to 150. | 51 → **70** | 86 → **100** | 94 → **129** | 136 → **129** |
| Jaywalk (crossRev 3 → 4) | 2 per lane + 4 per crossing, cap 150 | Each lane crossed counts 1 and each full crossing 2 more. Points follow 41 → 70, 50 → 100, 59 → 125, 66 → 145, 77 → 150, in straight lines between: 150 at 77. | 82 → **70** | 98 → **96** | 118 → **125** | 121 → **129** |
| Rally (rallyRev 2 → 3) | floor(2.5 × gold hits) + 3 per target, cap 150 | Each gold-ball hit counts 5 and each pink target 6. The blue ball scores nothing; losing it ends the run. Points follow 100 → 70, 130 → 100, 155 → 125, 185 → 145, 220 → 150, in straight lines between: 150 at 220. | 50 → **70** | 64 → **98** | 79 → **126** | 82 → **131** |
| Meteor (snakeRev 3 → 4) | 5 per star, cap 150 | Each star eaten counts 1. Points follow 14 → 70, 24 → 100, 30 → 125, 35 → 145, 38 → 150, in straight lines between: 150 at 38. | 70 → **70** | 118 → **99** | 150 → **125** | 150 → **141** |
| Swish (binRev 3 → 4) | 10 per bucket + 3 per hoop, max 99 short of 10; all 10 = 130 + up to 20 speed + hoops | Each bucket counts 10 and each hoop bonus 3. Points follow 45 → 70, 70 → 100, 80 → 118, 90 → 138, 109 → 140, in straight lines between (up to 140). All ten in adds 10. Up to 150. | 45 → **69** | 70 → **100** | 85 → **127** | 98 → **138** |
| Scrumper (snipRev 3 → 4) | 10 per apple + 3 per leaf; all 10 adds up to 20 speed; cap 150 | Each apple counts 10 and each leaf 2. Points follow 62 → 70, 80 → 100, 90 → 134, 120 → 140, in straight lines between (up to 140). All ten apples adds up to 10 for speed: the full 10 with at least half the time left, falling to 0 at the buzzer. Up to 150. | 68 → **70** | 85 → **100** | 99 → **134** | 114 → **137** |
| Hover (hoverRev 2 → 3) | round(130 × barriers ÷ 42) + round(20 × stars ÷ stars on course) | Each of the 42 barriers counts 3 and each gold star 2. Points follow 24 → 70, 45 → 100, 65 → 125, 100 → 136, 123 → 138, 146 → 140, in straight lines between (up to 140). Lasting the minute adds 10. Up to 150. | 25 → **70** | 46 → **100** | 65 → **122** | 109 → **136** |
| High Rise (skylineRev 2 → 3) | floor(2.5 × blocks + 2.5 × perfects) + streak points, cap 150 | Each block and each perfect drop counts 5, and each streak point 2 (a streak point for each perfect drop from the 3rd in a row). Points follow 100 → 70, 165 → 100, 280 → 125, 480 → 145, 600 → 150, in straight lines between: 150 at 600. | 51 → **71** | 82 → **99** | 138 → **124** | 150 → **145** |
| Junction (junctionRev 2 → 3) | 2 per car, 3 per bus, ±4 per ambulance, −1 per give-up, +20 for the minute, cap 150 | Each car counts 2 and each bus 3; an ambulance through +4, one stopped −4; a driver who gives up −1. Points follow 50 → 40, 89 → 70, 108 → 100, 118 → 120, 130 → 140, in straight lines between (up to 140). Lasting the minute adds 10. Up to 150. | 108 → **80** | 128 → **111** | 130 → **114** | 144 → **140** |
| Breaker (brkRev 2 → 3) | round(130 × bricks ÷ 80), max 128 short of 80; all 80 = 130 + up to 20 speed | Each brick destroyed counts 1. Points follow 60 → 70, 67 → 100, 76 → 125, 79 → 138, 80 → 140, in straight lines between (up to 140). Clearing all 80 adds up to 10 for speed: the full 10 with at least half the time left, falling to 0 at the buzzer. Up to 150. | 97 → **69** | 107 → **94** | 128 → **138** | 130 → **140** |
| Tilt (tiltRev 2 → 3) | 25 per maze + 5 per star (max 115 short of 4); all 4 adds up to 30 speed | Each finished maze counts 30, getting closer to the exit in the maze you are on up to 29 more, and each star 5. Points follow 60 → 35, 102 → 70, 120 → 95, 130 → 110, 145 → 135, 160 → 140, in straight lines between (up to 140). All four mazes adds up to 10 for speed: the full 10 with at least half the time left, falling to 0 at the buzzer. Up to 150. | 75 → **70** | 90 → **110** | 100 → **125** | 108 → **135** |
| Orbit (orbitRev 4 → 5) | 3 per furthest planet, max 117; the sun = 130 + up to 20 speed | Each planet reached counts 1. Points follow 12 → 70, 20 → 100, 30 → 125, 36 → 135, 39 → 138, 40 → 140, in straight lines between (up to 140). Reaching the sun adds up to 10 for speed: the full 10 with at least half the time left, falling to 0 at the buzzer. Up to 150. | 36 → **70** | 60 → **100** | 90 → **125** | 108 → **135** |
| Tempo (beatRev 2 → 3) | floor((4 × Perfect + 3 × Good + OK − 8 × misses) ÷ 4), cap 150 | Perfect counts 4, Good 3, OK 1 and a missed note −2, out of 4 a note, in thousandths of the chart. Points follow 590 → 70, 810 → 100, 920 → 125, 975 → 145, 1,000 → 150, in straight lines between: 150 at 1,000. | 42 → **68** | 108 → **104** | 139 → **130** | 150 → **148** |
| Slice (sliceRev 2 → 3) | floor(235 × weighted slices ÷ (3 × foods)) − 10 per chilli | Combo-weighted slices out of the most the run offers (every food at ×3), in thousandths. Each chilli then costs 10 and ends the combo. Points follow 410 → 78, 645 → 105, 745 → 130, 830 → 147, 900 → 150, in straight lines between: 150 at 900. | 87 → **68** | 150 → **104** | 150 → **129** | 150 → **129** |
| Fission (burstRev 2 → 3) | 2 per atom − 9 per life lost, cap 130; 150 for 90 s with no life lost and 4+ waves cleared | Each atom hit counts 1; each life lost takes 5 off. Points follow 55 → 70, 76 → 100, 88 → 125, 100 → 140, in straight lines between (up to 140). Lasting the 90 s adds 10. Up to 150. | 113 → **70** | 130 → **111** | 130 → **136** | 150 → **137** |
| Grappler (swingRev 4 → 5) | round(120 × metres ÷ 500) + 1 per star, cap 130; 500 m adds 20 | Each metre counts 1 (up to 500) and each star 5. Points follow 86 → 70, 162 → 100, 245 → 125, 400 → 136, 499 → 138, 550 → 140, in straight lines between (up to 140). Reaching 500 m adds 10. Up to 150. | 21 → **69** | 39 → **100** | 59 → **124** | 143 → **148** |
| Flightpath (bullRev 2 → 3) | floor(1.7 × dart total − 20) | Your dart total: rings 10 in the centre down to 1, an inner bull or a balloon 12. Points follow 72 → 70, 82 → 100, 94 → 125, 102 → 145, 110 → 150, in straight lines between: 150 at 110. | 102 → **72** | 120 → **101** | 140 → **126** | 150 → **141** |

Spread with the new rules, median (p10–p90), and how many of the 30 near-perfect runs reached 150:

| Game | Average | Good | Great | Near-perfect | 150s by near-perfect (of 30) |
|---|---|---|---|---|---|
| Ball Tracker | 70 (43–104) | 102 (89–127) | 126 (99–138) | 138 (126–150) | 7 |
| Wavefront | 72 (67–86) | 100 (73–150) | 140 (92–150) | 150 (100–150) | 23 |
| Roofbound | 70 (21–131) | 141 (59–150) | 144 (63–150) | 150 (144–150) | 20 |
| Rainbow Bridge | 37 (0–70) | 55 (35–88) | 86 (35–111) | 100 (39–139) | 1 |
| Gemstone | 70 (40–112) | 97 (60–132) | 124 (99–150) | 145 (126–150) | 7 |
| Coral Pop | 70 (43–104) | 100 (80–141) | 129 (120–141) | 129 (116–144) | 1 |
| Jaywalk | 70 (57–93) | 96 (59–146) | 125 (61–147) | 129 (66–150) | 4 |
| Rally | 70 (43–101) | 98 (56–134) | 126 (69–148) | 131 (89–149) | 3 |
| Meteor | 70 (40–88) | 99 (65–120) | 125 (88–141) | 141 (91–150) | 5 |
| Swish | 69 (46–110) | 100 (78–138) | 127 (91–149) | 138 (124–150) | 6 |
| Scrumper | 70 (40–115) | 100 (82–136) | 134 (95–137) | 137 (133–147) | 0 |
| Hover | 70 (7–103) | 100 (25–126) | 122 (74–136) | 136 (125–149) | 0 |
| High Rise | 71 (56–86) | 99 (80–109) | 124 (105–132) | 145 (136–150) | 5 |
| Junction | 80 (29–114) | 111 (42–139) | 114 (49–145) | 140 (113–150) | 7 |
| Breaker | 69 (42–119) | 94 (50–138) | 138 (90–145) | 140 (129–147) | 1 |
| Tilt | 70 (30–96) | 110 (37–121) | 125 (87–137) | 135 (44–140) | 0 |
| Orbit | 70 (0–113) | 100 (29–112) | 125 (96–136) | 135 (120–150) | 5 |
| Tempo | 68 (62–81) | 104 (93–112) | 130 (120–139) | 148 (145–150) | 8 |
| Slice | 68 (41–91) | 104 (83–129) | 129 (108–144) | 129 (104–146) | 0 |
| Fission | 70 (28–143) | 111 (69–148) | 136 (92–150) | 137 (109–150) | 6 |
| Grappler | 69 (24–117) | 100 (60–129) | 124 (91–148) | 148 (136–149) | 0 |
| Flightpath | 72 (51–115) | 101 (68–130) | 126 (79–147) | 141 (127–150) | 5 |

## Specific items

- **Swish** — no 99 cap when you miss: nine buckets and every hoop now scores 140 (was 99), nine and no hoops 138; all ten
  in still adds 10.
- **Tempo** — was low against the others for average players (42) because a missed note cost 8 quarter-points; a miss now
  costs half a note and the score is a share of the chart, so average 68, good 104, great 130, near 148.
- **Coral Pop** — the 99 unfinished cap is gone. Specials are rarer instead of capped: one Joker in each block of 22 shots
  (was 15) and a single mine or torpedo somewhere in the first 60 shots (was one of each every 60). Same field and colours
  as rev 2 (bubbleRev 3; stored rev-2 rounds keep their queue).
- **Gemstone** — the 5,500 par was far out of reach (near-perfect median 31). The band curve reaches 150 at 1,300 match
  points: great players land around 124 and the better great/near runs pass 130.
- **Junction** — now on the same bands: the 20 for lasting the minute is 10, and the points curve fits the levels
  (80 / 111 / 114 / 140 against 108 / 128 / 130 / 144 before).

## Where a game cannot fit, and why

- **Rainbow Bridge** is deliberately fitted low (37 / 55 / 86 / 100). Its simulated players pot only 36 % (average) to 78 %
  (near) of drops, because hand-drawn lines at the phone's 12-px point spacing are very sensitive in the physics, and most
  runs end on three failures. Real players adapt by trial in ways the bot cannot, so stretching one or two levels to 70
  points on this evidence would over-reward real players. Re-fit after phone testing.
- **Roofbound** good players score about 141: from the good level up, the bots survive the full minute and take nine or
  ten stars, so the game itself does not separate good from near (only lapses do).
- **Near-perfect at 129–131 in Coral Pop, Jaywalk, Rally and Slice** (and 135–138 in seven more): the simulated near-perfect
  player barely beats the great one there (Slice's near player waits for combos and slices fewer foods; Jaywalk's misreads
  edge gaps it has not seen for a reaction time; Coral Pop clears the field in 11 of 30 runs now that specials are rarer).
  The top of each curve is still reachable: near-perfect runs reached 149 or 150 in every game except Tilt, whose
  near-perfect finishes were slow (best 141); a fast full clear scores 150 there as everywhere.
- **Scrumper** great players land at 134 (target 115–135, but compressed): with ten apples, keeping one apple short within
  12 of a finish means the curve is nearly flat from nine apples up.

## Revision stamps and proofs

| Game | Stamp | Game | Stamp |
|---|---|---|---|
| Ball Tracker | btRev 3 | Swish | binRev 4 |
| Wavefront | wavRev 3 | Scrumper | snipRev 4 |
| Roofbound | flipRev 3 | Hover | hoverRev 3 |
| Rainbow Bridge | inkRev 5 | High Rise | skylineRev 3 |
| Gemstone | matchupRev 4 | Junction | junctionRev 3 |
| Coral Pop | bubbleRev 3 | Breaker | brkRev 3 |
| Jaywalk | crossRev 4 | Tilt | tiltRev 3 |
| Rally | rallyRev 3 | Orbit | orbitRev 5 |
| Meteor | snakeRev 4 | Tempo | beatRev 3 |
| Slice | sliceRev 3 | Fission | burstRev 3 |
| Grappler | swingRev 5 | Flightpath | bullRev 3 |

Each band revision plays the previous live revision unchanged (Coral Pop aside, whose queue changes): the stamped state keeps
the old `rev` and gains only `band`/`acted` (and Tilt's best maze progress), which never feed the sim.

- `scripts/arcade-score-bands-check.ts`: 88 real runs recorded with the code on main before this change
  (`scripts/fixtures/arcade-score-bands-legacy.json`) replay to the same score; the same logs replay on the band revisions
  with no checkpoint desync and score exactly their band breakdown; every curve's rules; idle runs score 0; Coral Pop's queue.
- `scripts/arcade-self-replay-check.ts` covers all 22 band revisions alongside the stored ones; the batch 1–5 legacy digests
  still pass.

## Tuning B (12 Oct 2026): later gameplay revisions on the bands

Three games changed play after the band pass. Each is a new stamp; the band revisions above (and everything older) replay
and score exactly as before. `scripts/arcade-skill-bands.ts --rev=current` measures a game's current revision against its
band revision with the same simulated players and seeds (100 seeds for Breaker and Rally, 60 for Flightpath):

| Game | Stamp | Change | Average | Good | Great | Near-perfect |
|---|---|---|---|---|---|---|
| Flightpath | bullRev 4 | Three value balloons (+1 green, +2 blue, +3 purple) fly back and forth across the board, faster by value; a dart through one pops it, adds its value and still scores its ring. Knots refitted: 75 → 70, 82 → 100, 92 → 125, 101 → 145, 112 → 150 | 68 | 100 | 125 | 142 |
| Breaker | brkRev 4 | Fireball 3.5 s (was 5 s). Knots unchanged: no level moved more than 2 points | 69 | 104 | 129 | 142 |
| Rally | rallyRev 4 | Each +3 pad moves within its own half of the far wall, so the two never overlap. Pads spread across the wall are easier to reach, so knots refitted: 105 → 70, 139 → 100, 154 → 125, 195 → 145, 240 → 150 | 70 | 100 | 125 | 144 |

Before refitting, the bullRev 3 curve put bullRev 4 at 76 / 101 / 117 / 141, and the rallyRev 3 curve put rallyRev 4 at
75 / 109 / 124 / 146.

States keep the band revision's `rev` and add `tune: 1` (folded into the checkpoint checksum last, so older sums are
unchanged). `puzzleUsesBands` treats a stamp at or above the band revision as banded. Proofs: `scripts/tuning-b-check.ts`
(new rules, 150 through the server replay, pads never overlapping, the Fireball length), `scripts/arcade-self-replay-check.ts`
(the three new revisions), and the existing batch-3/5 and score-band checks for the older revisions.

## Tuning A (12 Oct 2026)

Three games changed play on their existing band curves, each under a new stamp that `BAND_STAMPS` lists alongside the
band stamp (Wavefront wavRev 4, Orbit orbitRev 6, Grappler swingRev 6). High Rise (flag art) and Tilt (drawing, cup
proof, arena position) changed no sim and keep skylineRev 3 / tiltRev 3. Medians (p10–p90) from
`bun scripts/arcade-skill-bands.ts <game> --rev=next|tuned --seeds=60`, same seeds and players:

| Game | Revision | Average | Good | Great | Near-perfect |
|---|---|---|---|---|---|
| Wavefront | wavRev 3 (before) | 74 (58–90) | 111 (71–150) | 150 (88–150) | 150 (136–150) |
| Wavefront | wavRev 4 (shapes) | 73 (65–102) | 99 (72–150) | 140 (86–150) | 140 (96–150) |
| Orbit | orbitRev 5 (before) | 64 (0–110) | 100 (39–117) | 120 (85–135) | 135 (120–150) |
| Orbit | orbitRev 6 (fly-in, quicker miss) | 64 (0–110) | 100 (39–117) | 120 (85–145) | 136 (120–150) |
| Grappler | swingRev 5 (before) | 77 (22–118) | 100 (39–130) | 130 (92–148) | 148 (128–149) |
| Grappler | swingRev 6 (touch stars, 2 s crumble) | 75 (22–112) | 101 (46–136) | 129 (95–148) | 137 (116–148) |
| High Rise | skylineRev 3 (unchanged) | 72 (59–88) | 99 (81–109) | 121 (107–130) | 145 (136–150) |
| Tilt | tiltRev 3 (unchanged) | 67 (28–98) | 106 (29–125) | 119 (39–137) | 131 (39–140) |

- Wavefront's shapes are wider than the grid, so they reach the walls (and drop) sooner; first measured with each shape's
  lowest ships where the grid's bottom row starts, average/good fell to 70/78. Shapes now settle at the top on wave 2 and
  21 px lower each wave after (`WAV_FORM_STEP_Y`), which brings every level back to the rev-3 band.
- Grappler near-perfect players finish less often when they chase touch stars that sit off their own line (stars were
  previously on anchors they grabbed anyway): 137 against 148. Bigger stars and moving stars off lava jets did not change
  that; it stays inside the 135–138 range seven games already sit in, and every other level is in band.
- `scripts/arcade-tuning-a-check.ts` replays 40 runs recorded on the pre-change code
  (`scripts/fixtures/arcade-tuning-a-legacy.json`) to the same score and final state.

## Tuning C (12 Oct 2026): Joe's calibration play

Joe (a good-to-great player) played every changed game on a phone. Where he found scoring lenient or harsh, the
game's curve moved so his kind of runs land about 10 % lower or higher; Rainbow Bridge was refitted from his own
scores and Gemstone's 150 from his par, not from the bots. Every change is a new stamp (`tunec: 1` in the state);
older rounds replay and score exactly as before (`scripts/arcade-tuning-c-check.ts` replays 72 runs recorded on the
code before this change, `scripts/fixtures/arcade-tuning-c-legacy.json`). Medians (p10–p90 in the PR) from
`bun scripts/arcade-skill-bands.ts <game> --rev=c --seeds=60`: the revision rooms stamped before → the Tuning C one,
same simulated players and seeds.

| Game | Stamp | Change | Average | Good | Great | Near-perfect |
|---|---|---|---|---|---|---|
| Gemstone | matchupRev 4 → 5 | Constant play reverted: each swap resolves its whole cascade and the sim refuses swaps until the gems have cleared and fallen at the original speed (200 ms clear + 120 ms a row, plus the 150 ms swap tween). Joe's par: 150 at 2,500 match points; lower knots 620 → 70, 900 → 100, 1,300 → 125, 2,000 → 145. No bursts or rings over the gems (text pop-ups kept) | 73 → 70 | 97 → 88 | 120 → 103 | 144 → 112 |
| Grappler | swingRev 6 → 7 | About 10 % lower: each knot below the top at nine tenths of its points | 75 → 67 | 101 → 91 | 129 → 116 | 137 → 123 |
| Hover | hoverRev 3 → 4 | About 10 % lower (same rule) | 70 → 63 | 97 → 87 | 127 → 114 | 136 → 122 |
| Rainbow Bridge | inkRev 5 → 6 | Joe scores 110–124 (about 60–76 units); knots below the top at about 93.5 % of their points, so his runs land about 103–116 | 35 → 33 | 55 → 51 | 73 → 67 | 99 → 92 |
| Roofbound | flipRev 3 → 4 | The corridor bends from 10 s (was 15 s); about 10 % higher (knots below the top gain a tenth) | 77 → 85 | 144 → 147 | 144 → 147 | 150 → 150 |
| Tempo | beatRev 3 → 4 | About 10 % higher (145 can only rise to 148); no highlight box while a hold note is held (all revisions, art only) | 69 → 76 | 103 → 113 | 131 → 140 | 148 → 149 |
| Wavefront | wavRev 4 → 5 | The same five waves and boss; waves 3 and 4 drop three quarters of a row at a wall. Ships, armour, waves (15), boss hits and saucers (1, was 5) count; 140 at five perfect waves and every boss hit (269), saucers standing in for misses; the kill adds up to 10 by how fast the boss fell from its arrival (the full 10 within 20 s, none after 40 s). Knots 100 → 25, 180 → 50, 211 → 70, 218 → 100, 245 → 112, 266 → 125, 268 → 138, 269 → 140 | 73 → 72 | 99 → 100 | 140 → 128 | 140 → 139 |
| Tilt | tiltRev 3 → 4 | The amber marble starts at least a maze's width along the paths from its cup; stars at the mouth of a black hole on or one cell off a route (a risky lean as you pass), else one cell off a route (22 % of maze-1 stars sit at a hole, 65 % of maze-4 stars); knots refitted (50 → 35, 86 → 70, 100 → 100, 114 → 125, 140 → 137) | 67 → 71 | 106 → 99 | 119 → 124 | 131 → 121 |
| Slice | sliceRev 3 → 4 | Blade 4 px wider each side and cutting 50 % back past the swipe's start (was 25 %); the lower knots move up a little to keep the levels in band | 73 → 74 | 105 → 105 | 130 → 129 | 130 → 126 |

- **Wavefront**: a first cut removed wave 5 (with half-speed drops every level killed the boss, all 150), then a
  70-hit boss; Joe kept all five waves instead. With three-quarter-speed drops on waves 3 and 4 the boss is reached
  slightly more often than before (average and good players mostly stop in waves 4–5; great and near-perfect ones
  fight the boss, killing it in about a third of runs), so the boss stays as it was (36 hits, same volleys). 150 needs
  all five waves and a kill within 20 s of the boss's arrival: a scripted flawless player (the skill-band player with no
  lapses or error) does it through the server replay.
- **Tilt**: the whole-run speed window could not pay the full 10 (the fastest scripted run with every star finishes at
  68.5–70 s), so tiltRev 4's window runs from 60 s to the buzzer (`TILT_V4_FINISH_MIN`, as Ball Tracker's does from its
  earliest landing): the full 10 by 75 s. A scripted run with every maze and star scores 150 through the server replay;
  the level medians did not move.
- **Gemstone** good, great and near-perfect sit below band (88 / 103 / 112): the simulated players make about 1,100
  match points at best, well short of Joe's 2,500 par. His par stands; the bots never plan cascades, so they
  under-rate strong players here.
- **Tilt**'s bot takes a star beside a hole half as often as any other star (a fall ends the run), and now aims at the
  star's own point; near-perfect players still fall chasing them, so near (121) sits under great (124).
- **Junction** is retired to practice (registry `RETIRED_TYPES`); rooms deal 21 arcade games. Its band curve stays
  for practice and stored rounds.

## Tuning E (13 Oct 2026): taller worlds, deeper Scrumper

High Rise, Meteor, Scrumper and Hover get taller worlds (the same for every player, uniform scale) so their arenas fill
a 390 × 844 phone down to the usual gap; Scrumper's run becomes 2 easy, 3 medium and 5 hard levels from a tall bank,
with picker's crooks (catch a falling apple from above, hold it on a vine to cut again). Every change is a new stamp;
older rounds replay and score exactly as before (`scripts/arcade-tuning-e-check.ts` replays 32 runs recorded on the
code before this change, `scripts/fixtures/arcade-tuning-e-legacy.json`). Medians (p10–p90 in the PR) from
`bun scripts/arcade-skill-bands.ts <game> --rev=e`: the revision rooms stamped before → the Tuning E one.

| Game | Stamp | World | Change | Average | Good | Great | Near-perfect |
|---|---|---|---|---|---|---|---|
| High Rise | skylineRev 3 → 4 | 390 × 560 → 390 × 735 | View only; same play and curve | 71 → 71 | 99 → 99 | 124 → 124 | 145 → 145 |
| Meteor | snakeRev 4 → 5 | 390 × 532 → 390 × 724 (15 × 20 → 15 × 28) | Stars, rocks and shower drawn over the taller grid; the same skill eats fewer stars, so 150 at 34 stars (knots 15 → 70, 22 → 100, 26 → 125, 30 → 142) | 70 → 74 | 99 → 103 | 125 → 125 | 141 → 142 |
| Scrumper | snipRev 4 → 5 | 360 × 560 → 360 × 640 | Tall bank (28 stretched orchard levels, 13 crook levels), 2 easy / 3 medium / 5 hard; lower knots 54 → 70, 74 → 100 (top unchanged) | 70 → 69 | 100 → 100 | 134 → 134 | 137 → 137 |
| Hover | hoverRev 4 → 5 | 390 × 560 → 390 × 735 | The same course drifting over the extra height (each climb changes by ≤ 22 px); Tuning C curve with its 123-unit knot at 125 | 63 → 66 | 90 → 87 | 109 → 119 | 122 → 123 |

- **Hover**: stretching the course with the world (and growing the gaps) was tried first; it made some late drops longer
  than the disc can fall between barriers at top speed (a flawless player crashed on every course). The drifting course
  keeps every climb, gap and star as before. A scripted flawless player scores 150 through the server replay.
- **Scrumper**: every tall template has stored human-paced winning plans at pin wobble −10, 0 and +10
  (`scripts/fixtures/snip-rev5-proofs.json`); the slowest ten-level mix takes 34.7 s with them, and a run bot scores 150
  through the server replay. Hard crook levels cannot be won without the catch (no rope-only plan feeds the apple).

## Scrumper bank growth (13 Oct 2026): snipRev 6

The same tall game as snipRev 5 (rules, physics, timing, scoring and curve unchanged) dealing from a bigger bank so
regular players see fewer repeats: 41 → 67 tall levels (easy 6 → 10, medium 16 → 26, hard 19 → 31), 26 new ones,
all picker's-crook levels (cut, catch, cut) mixed with springy branches, planks, gutters, wasp nests and sliding
baskets. Still 2 easy / 3 medium / 5 hard a run. Across ten rooms a regular player now meets about 47 repeat levels
in 100, against 62 on snipRev 5. Every new level has stored human-paced plans at pin wobble −10, 0 and +10
(`scripts/fixtures/snip-rev6-proofs.json`); the slowest ten-level mix takes 42.6 s with them. snipRev 5 rounds replay
on their own bank (`scripts/snip-bank6-check.ts` replays 12 real snipRev 5 runs recorded on main). Medians (p10–p90)
from `bun scripts/arcade-skill-bands.ts snip --rev=bank --seeds=60`, snipRev 5 → snipRev 6, same players and seeds:

| Game | Stamp | Average | Good | Great | Near-perfect |
|---|---|---|---|---|---|
| Scrumper | snipRev 5 → 6 | 70 (41–113) → 73 (38–100) | 108 (76–134) → 102 (82–135) | 134 (97–137) → 132 (91–136) | 136 (125–145) → 135 (107–145) |

## Pinball (13 Oct 2026): a new game, born on the bands — in rooms from 14 Oct

Pinball (`pinball`, working title; Retro world) is new, so it has no older scoring to keep: its first revision
(`pinRev 1`) is band-stamped from the start and is an **open** game (table points on a curve to 150, no finish bonus,
0 with no input). Practice only on 13 Oct; rooms deal it from 14 Oct (`PINBALL_IN_ROOMS` in `src/lib/arcade/pinball.ts` is `true`, Tuning F below), with the same rules and curve.

The units are the table's own points (multiplier included): pop bumper 100, slingshot 10, drop target 400, all four
targets 2,500 more (the spinner is lit for 15 s and the bank stays open for 6 s), a top lane lit 100 (again 20), all
three lanes 1,000 and the multiplier up one (to ×5), the spinner 25 a turn (100 while lit). A drained ball takes the
multiplier, lit lanes, dropped targets and lit spinner with it, so keeping the ball alive is worth far more than the
1.5 s a relaunch costs.

The simulated player (`scripts/arcade-skill-bands/bots/pinball.ts`) watches the ball fall towards the flippers from what
it has seen a tracking lag ago, uses a fork as experience to know when and on which side the ball will arrive, values a
few flip moments around that arrival by the table points and survival they lead to, picks one with its blurred
judgement, and presses off that moment by its timing error (and the odd lapse); a ball whose path changes before the
press is re-planned a reaction time later. It never looks at the score. Medians (p10–p90) from
`bun scripts/arcade-skill-bands.ts pinball --seeds=30`, through the server's own encode + replay:

| Level | Table points, median (p10–p90) | Balls drained (of 3), runs of 30 with 0 / 1 / 2 / 3 | Score, median (p10–p90) |
|---|---|---|---|
| Average | 5,255 (1,766–7,506) | 3 / 6 / 8 / 13 | 70 (23–102) |
| Good | 7,372 (3,145–12,680) | 9 / 10 / 7 / 4 | 100 (41–137) |
| Great | 8,648 (5,504–16,264) | 12 / 9 / 8 / 1 | 123 (74–145) |
| Near-perfect | 15,090 (8,382–22,274) | 17 / 10 / 3 / 0 | 144 (119–149) |

Knots fitted to those medians: 5,250 → 70, 7,400 → 100, 8,650 → 125, 15,000 → 145, 24,000 → 150 (near-perfect p90 is
22,274; 2 of 30 near-perfect runs reach 150, best 27,280 points). Good and great sit close in table points (a great
player drains about as often as a good one but aims a little better), so the curve is steep between them; re-fit after
Joe's phone play. No run was flagged or disagreed with the server replay.

Physics and proofs: integer fixed point (1/256 px), every contact swept (walls, targets and bumpers as capsules and
circles; flippers in their own rotating frame), a penetration pass for resting and rolling contacts.
`scripts/pinball-check.ts` replays stored pinRev 1 runs (`scripts/fixtures/pinball-rev1.json`) to their scores, replays a
full near-perfect minute and 30 dense random runs identically on the server, shows a single sweep finding the contact of
a move far longer than the bumper, thin target or swinging flipper it hits, and fires 2,500 fast shots at bumpers,
targets and swinging flippers without the ball ever ending a tick inside a collider or on the far side of one.
`arcade-self-replay-check`, `arcade-fx-check`, `arcade-score-bands-check` and `arcade-play-check` include it.

## Tuning F (14 Oct 2026)

Five games changed play under new stamps; everything older replays and scores exactly as before
(`scripts/arcade-tuning-f-check.ts` replays 40 runs recorded on main before this change and 40 recorded on the new
stamps, `scripts/fixtures/arcade-tuning-f-legacy.json`). Hover's arena border lights and Fission's arrows changed display only (Hover's barriers, sim, score and stamp are untouched).
Medians (p10–p90) from `bun scripts/arcade-skill-bands.ts breaker rally beat snake orbit --rev=f --seeds=30`, the revision
rooms stamped before → the Tuning F one, same simulated players and seeds, every run through the server's own encode +
replay (no run flagged or disagreeing):

| Game | Stamp | Change | Average | Good | Great | Near-perfect |
|---|---|---|---|---|---|---|
| Breaker | brkRev 4 → 5 | Fireball 2.5 s (was 3.5 s). Knots unchanged | 67 (42–125) → 67 (42–124) | 94 (50–125) → 103 (50–129) | 133 (99–145) → 131 (89–142) | 141 (128–148) → 141 (127–148) |
| Rally | rallyRev 4 → 5 | A second mirror bumper for the final 15 s (from 45 s, same 2 s blinking warning), at a seeded spot in the first's band at least 90 px (centres) from it, on a stream of its own, so play before 45 s is exactly rallyRev 4's. Knots refitted: 105 → 70, 130 → 100, 146 → 125, 185 → 145, 250 → 150 | 78 (45–100) → 72 (48–128) | 85 (51–131) → 78 (54–131) | 118 (68–149) → 124 (68–147) | 144 (96–150) → 145 (112–150) |
| Tempo | beatRev 4 → 5 | A tenth fewer notes: the beatRev 4 chart, then round(notes ÷ 10) plain notes dropped on a stream of their own, busiest spots first (chord partners and eighths), never a hold, a swipe or the first note (300 charts: 47,950 → 43,135 notes, 10.0 % fewer). Knots moved to the new unit medians, keeping the points each level scored on beatRev 4: 662 → 75, 869 → 114, 951 → 140, 990 → 149, 1,000 → 150 | 75 (68–89) → 75 (66–87) | 114 (102–123) → 114 (106–126) | 140 (132–144) → 140 (131–145) | 149 (148–150) → 148 (146–150) |
| Meteor | snakeRev 5 → 6 | More rocks on the taller grid: first at length 9 (was 10), one more every 4 stars (was 5), up to 11 asteroids (was 8; 14 rocks with the shower); same slots every 3 s and squares. 20 good and great runs saw 139 rocks land against 105. Knots refitted: 15 → 70, 21 → 100, 26 → 125, 29 → 142, 33 → 150 | 74 (44–96) → 68 (32–106) | 103 (56–133) → 100 (56–121) | 125 (89–142) → 125 (100–146) | 142 (117–150) → 142 (113–150) |
| Orbit | orbitRev 6 → 7 | Bug fix, swept black holes: every hole ahead is live (not only the one beside the planet just left), the rocket is swallowed when its drawn body touches the drawn disc anywhere along the tick's segment, and a belt wins only when the rocket meets it first. Knots unchanged | 70 (0–112) → 76 (0–109) | 98 (29–112) → 100 (29–122) | 126 (96–147) → 128 (96–148) | 135 (120–149) → 136 (125–150) |

- **Tempo kept Tuning C's levels rather than 70 / 100 / 125.** Fewer notes make the chart easier, so on the beatRev 4
  curve the same players scored 87 / 124 / 143 / 149; the beatRev 5 knots bring each level back to what it scored on
  beatRev 4, Joe's deliberately kinder Tempo (Tuning C, about 10 % above the targets).
- **Rally good players stay low (78).** As in every Rally measurement, the simulated average and good players barely
  separate (unit medians 107 and 112); a curve cannot put them 30 points apart without a cliff, so the knots fit average,
  great and near-perfect.
- **Orbit** scores a little more for the same players because hops that cross the next planet's hole now take it; 150
  is still the sun at speed.
- Proofs (`arcade-tuning-f-check`): the old and new stored runs; stamps and bands; Breaker's 150-tick Fireball; Rally's
  second bumper on 4,000 seeds, play identical to rallyRev 4 until 45 s, and bounces off it after; Tempo's thinned chart
  keeping every rule on 300 seeds; Meteor's rock pace; for Orbit, 30,720 synthetic flights at 1–40 px a tick through
  every hole of 8 bank courses (all of them with `CHECKS_FULL=1`) from the hole's planet and the one before, judged by a
  closed-form distance oracle — every flight that reaches 2 px inside the reach registers, none passing 2 px outside it
  does, and on orbitRev 6 most of the same flights fly through unregistered (the bug) — plus every flight tick of real
  skill-band runs; 150 through the server replay on every new stamp; Hover's border lights painted at 19 % (each barrier) and
  37 % (every 7th) of their old strength; Fission's arrows 20 px off the bottom (were 12 px).

## Tuning F, second set (14 Oct 2026): six more games, Pinball in rooms

Joe's notes from phone play, worked in a parallel session to the five games above. Every play or scoring change is a new stamp; older rounds replay and score exactly as before
(`scripts/arcade-tuning-f2-check.ts` replays 48 runs recorded on the code before this change,
`scripts/fixtures/arcade-tuning-f2-legacy.json`, and runs recorded on each new revision, `scripts/fixtures/arcade-tuning-f2-runs.json`;
`bubble-rev4-check`, `swing-rev8-check` and `snip-rev7-check` hold the Coral Pop, Grappler and Scrumper proofs and stored runs).
Medians (p10–p90) from `bun scripts/arcade-skill-bands.ts <game> --rev=f --seeds=60`: the revision rooms stamped before → the
Tuning F one, same simulated players and seeds.

| Game | Stamp | Change | Average | Good | Great | Near-perfect |
|---|---|---|---|---|---|---|
| Jaywalk | crossRev 4 → 5 | The walker's hit box is 13 px either side of its column (was 16): the stick figure's own reach. Same courses (still proved with the 16 px box) and curve | 67 (47–90) → 69 (46–102) | 96 (61–145) → 96 (61–145) | 109 (64–146) → 121 (63–147) | 127 (68–148) → 133 (70–150) |
| Slice | sliceRev 4 → 5 | One finger-down path cuts up to 620 px (the world's height; was 465, three quarters). Same foods, blade and curve | 74 (46–92) → 71 (46–90) | 105 (85–137) → 105 (80–138) | 129 (95–146) → 130 (99–145) | 126 (98–143) → 131 (104–147) |
| Coral Pop | bubbleRev 3 → 4 | The torpedo never sticks: it flies like any shot and, once it touches the field, keeps going the way it points, destroying each bubble it touches (up to 6) until the top row's line; bubbles left unheld then drop as after any pop. It no longer clears its whole row (and everything under it). Same field, queue and curve | 62 (36–95) → 64 (38–104) | 105 (80–140) → 107 (80–126) | 126 (118–142) → 126 (118–140) | 129 (118–148) → 129 (118–141) |
| Grappler | swingRev 7 → 8 | The ten touch stars sit one per equal stretch of 30–490 m (aimed at each stretch's middle, on a proved line), not bunched near the start (gaps 46 ± 1.5 m against 39 ± 49 m over all 300 bank courses). Same cavern, hazards and curve. The dragon's "N m" label (all revisions, display only) is hidden beyond 50 m, small at 40–50 m and full size within 10 m | 67 (20–101) → 63 (20–95) | 91 (41–122) → 100 (41–122) | 116 (85–135) → 114 (83–142) | 123 (104–139) → 131 (108–140) |
| Gemstone | matchupRev 5 → 6 | Score only: 150 at 2,800 match points (was 2,500); the knots from 100 up move by the same factor (1,008 → 100, 1,456 → 125, 2,240 → 145), 620 → 70 stays | 70 (43–100) → 70 (43–92) | 88 (58–118) → 83 (58–110) | 103 (63–126) → 95 (63–119) | 112 (91–129) → 105 (85–125) |
| Scrumper | snipRev 6 → 7 | Each pin's seeded wobble is one of −10 / −5 / 0 / +5 / +10 px (the same pin stream; was any of −10…+10), so a level with k pins has 5^k deals, and every one of the 4,435 deals over the 67-level bank has a stored human-paced winning plan. Crook gutter run (template 116: 28 of its 441 rev-6 deals had no plan, where its two pins meet) is dealt as a fixed copy (template 129) in its slot; the bot's other misses were its search, not the levels. Same ten levels per seed, rules and curve | 73 (38–100) → 70 (43–97) | 102 (82–135) → 104 (76–134) | 132 (91–136) → 134 (100–137) | 135 (107–145) → 136 (121–145) |

- **No curve refits.** Every level moved by a few points at most (Jaywalk's great and Grappler's good about 10, within the
  seed noise those levels show), so each new revision keeps its predecessor's curve; Gemstone's change is the curve.
- **Gemstone** still sits below band from good up because the bots never plan cascades (as in Tuning C); Joe's par is
  the calibration. A scripted greedy player still reaches 150 through the server replay.
- **Coral Pop** barely moves in the medians because a run deals only one mine or torpedo; on seeds that deal a torpedo
  the greedy bot's score fell from 142–147 to 91–126. No simulated run reaches 150 on rev 3 or rev 4 (best stored, a
  clear at 54.7 s, scores 148).
- **Best scores** through the server replay: 150 on Jaywalk, Gemstone, Grappler and Scrumper; Slice's flawless player
  reaches the 140s.
- **Pinball** moves into rooms (Arcade 22 active, 74 in all) with a display-only table polish (cached table layer,
  lit inserts by gradient, bevels inside each solid's outline); pinRev 1 and its curve are unchanged.

## Taller worlds, batch 1 (16 Oct 2026): Breaker, Rally, Wavefront, Fission

Following Tuning E (High Rise, Meteor, Scrumper, Hover), four more worlds grow so the arena fills a modern phone after the
bottom-gap fix: Breaker, Rally and Wavefront 390 × 730 (were 390 × 620), Fission 390 × 650 (was 390 × 560; its arrow row
stays below). The world height rides in the state (`worldH`, folded into the checkpoint checksum last); stages size from
`<game>WorldHFor(rev)`, reveals and intro demos from `revealWorldH`, effects through `fxSpecAt`. Older rounds replay and
score exactly as before (`scripts/arcade-tuning-g1-check.ts` replays 88 runs recorded on main before the change, on every
revision the four games ever stamped, `scripts/fixtures/arcade-tuning-g1-legacy.json`, and 32 on the new stamps,
`scripts/fixtures/arcade-tuning-g1-runs.json`). Medians (p10–p90) from
`bun scripts/arcade-skill-bands.ts breaker rally wavefront burst --rev=g1 --seeds=60`: the revision rooms stamped before →
the taller one, same simulated players and seeds, every run through the server's own encode + replay (none flagged or
disagreeing):

| Game | Stamp | Change | Average | Good | Great | Near-perfect |
|---|---|---|---|---|---|---|
| Breaker | brkRev 5 → 6 | 390 × 730 court: the wall stays at the top, the paddle 72 px above the new bottom, so 110 px more between bricks and paddle. Same 80 bricks, capsules, sliding rows and 2.5 s Fireball. Knots refitted: 44 → 70, 57 → 100, 70 → 125, 74 → 138, 80 → 140 | 70 (44–125) → 70 (42–132) | 103 (47–133) → 101 (58–139) | 129 (90–143) → 125 (72–139) | 142 (122–148) → 138 (89–146) |
| Rally | rallyRev 5 → 6 | 390 × 730 court, the paddle 60 px above the new bottom. Same pads, gold balls and rules; each bumper keeps its spot across and its height is stretched down the longer court (both still ≥ 90 px apart). Knots refitted: 85 → 70, 111 → 100, 116 → 125, 122 → 142, 220 → 150 | 64 (41–127) → 70 (34–136) | 99 (56–143) → 100 (51–145) | 127 (68–146) → 125 (60–145) | 143 (93–150) → 139 (73–148) |
| Wavefront | wavRev 5 → 6 | 390 × 730 world: formations, saucer and boss keep their places, the ship 66 px above the new bottom, drags from the bottom quarter (548 px). The ship's bolts fly 10 px a tick (were 8) so they reach the formation in the same time from the lower line. Same five waves, slow drops, divers and timed boss. Knots refitted: 100 → 20, 200 → 45, 249 → 70, 259 → 100, 263 → 125, 268 → 138, 269 → 140 | 72 (64–111) → 72 (63–138) | 100 (70–150) → 100 (68–150) | 128 (94–150) → 125 (69–150) | 139 (100–150) → 138 (82–150) |
| Fission | burstRev 3 → 4 | 390 × 650 arena (floor at 650). Every height scales with the arena: each atom size bounces to the same share of it (75 / 60 / 45 / 30 %), the ceiling comes down 46 px a wave (was 40) to 60 % of it. Same waves, drops and lives. Knots refitted: 55 → 70, 79 → 100, 84 → 125, 95 → 140 | 62 (15–131) → 69 (24–130) | 111 (44–148) → 104 (42–148) | 132 (76–150) → 130 (92–150) | 137 (117–150) → 135 (92–150) |

- **Before refitting** (the taller revision on its predecessor's curve): Breaker 51 / 67 / 108 / 119, Rally 56 / 77 / 83 / 89,
  Wavefront 115 / 120 / 123 / 138, Fission 69 / 108 / 124 / 126. Breaker and Rally get harder (the ball takes longer to come
  back, so fewer bricks and returns fit in the clock); Wavefront gets easier (more time to see bolts and divers coming);
  Fission's slower, taller bounces cost a few atoms.
- **Wavefront's bolts.** At 8 px a tick the lower ship's bolts took a quarter longer to reach the formation, every wave
  took longer, and near-perfect players met the boss too late to kill it (median 111). At 10 px a tick a bolt reaches the
  top row in 52.8 ticks (55.5 before) and the boss is killed as often as before (22 of 60 near-perfect runs, 22 before).
- **Close players.** Rally's simulated good, great and near-perfect players sit within 10 units of each other (one or two
  gold hits), so its middle knots are close together; Fission's great and near-perfect players barely separate (83 and 84
  units), as before.
- **Best scores** through the server replay: 150 on all four new stamps (`arcade-tuning-g1-check`).
- Each game's intro demo stays stopped (`introDemo.functions.ts`) until one is recorded on the taller revision.

## Taller worlds, batch 2 (16 Oct 2026): Tempo, Slice, Coral Pop (and Mixed Signals, Pull!)

The same pattern as batch 1: Tempo, Slice and Coral Pop grow to 390 × 730 (were 390 × 620); the engine games Mixed
Signals (390 × 650, was 390 × 560; its arrows and joystick stay below) and Pull! (360 × 680, was 360 × 400; it draws
390 × 737 on a 390 px phone) grow the same way. The world height rides in the state (`worldH`, folded into the checkpoint
checksum last); stages size from `<game>WorldHFor(rev)`, reveals and intro demos from `revealWorldH`, effects through
`fxSpecAt`. Older rounds replay and score exactly as before (`scripts/arcade-tuning-g2-check.ts`: 116 runs recorded on
main before the change on every revision the five games ever stamped, `scripts/fixtures/arcade-tuning-g2-legacy.json`,
and 40 on the new stamps, `scripts/fixtures/arcade-tuning-g2-runs.json`). Medians (p10–p90) from
`bun scripts/arcade-skill-bands.ts beat slice bubble --rev=g2 --seeds=60`, the revision rooms stamped before → the
taller one, every run through the server's own encode + replay:

| Game | Stamp | Change | Average | Good | Great | Near-perfect |
|---|---|---|---|---|---|---|
| Tempo | beatRev 5 → 6 | 390 × 730 lanes, the hit line 100 px above the new bottom (630). A note still crosses its lane in 90 ticks (6.51 px a tick, was 5.29), so it is in view for the same 1.5 s; the same chart, hit windows and curve (judging is by tick alone) | 73 (67–87) → 73 (67–87) | 112 (102–126) → 112 (102–126) | 139 (130–145) → 139 (130–145) | 148 (146–150) → 148 (146–150) |
| Slice | sliceRev 5 → 6 | 390 × 730 board: every throw starts below the new bottom and its rise (speed and gravity alike) × 730 ÷ 620, so it climbs proportionally higher and is in the air exactly as long; one path may run 730 px. Knots refitted: 436 → 79, 668 → 103, 747 → 131, 769 → 147, 900 → 150 | 71 (46–90) → 70 (46–92) | 105 (80–138) → 101 (79–147) | 130 (99–145) → 125 (96–148) | 131 (104–147) → 139 (101–148) |
| Coral Pop | bubbleRev 4 → 5 | 390 × 730 tank: the field and the danger line stay put (the same rows apart), the gun 60 px above the new bottom, shots 7.35 px a tick (were 6) so they reach the ceiling in the old time. Knots refitted: 30 → 70, 52 → 100, 60 → 125, 62 → 138, 67 → 140 | 64 (38–104) → 69 (28–86) | 107 (80–126) → 102 (79–138) | 126 (118–140) → 125 (103–138) | 129 (118–141) → 138 (121–142) |

- **Before refitting** (the taller revision on its predecessor's curve): Slice 69 / 102 / 122 / 131 (unit medians 428 / 688 /
  766 / 769 → 436 / 668 / 747 / 769: the throws spread over more height, so long multi-food swipes come a little less often),
  Coral Pop 57 / 105 / 120 / 126 (unit medians 33 / 53.5 / 62 / 63 → 29.5 / 52.5 / 60 / 62: longer shots from the lower gun).
- **Slice's chillies.** −10 per chilli sits outside the curve, so each knot's points are set a few above the target for the
  level to land there (the same as sliceRev 4–5's knots).
- **Tempo keeps Tuning C's kinder level** (73 / 112 / 139 / 148, about 10 % above the band targets by Joe's ruling); the taller
  lanes change nothing a player can score.
- **Engine games** (no band curve; measured with the puzzle-fairness kits, `bun scripts/arcade-tuning-g2-engine-bands.ts`, 30
  room puzzles):
  - **Mixed Signals clashRev 4 → 5** (390 × 650 board, gates 90 px lower at y 544; a word falls (gate − spawn) ÷ its fall
    ticks and a drop runs 22.47 px a tick, so every word lands in the same ticks on the same three, then four, lanes):
    44 / 85 / 134 / 144 → 70 / 100 / 134 / 144. Unfinished credit is now net = words right − words wrong on
    `CLASH_V5_CURVE`: net ≤ 0 → 0, 20 → 70, 40 → 100, 46 or more → 110, straight lines between (was round(110 × right ÷ 52)
    − 2 per wrong). Good players sort all 52 with about six wrong (net about 40). A finish (all 52, at most 2 wrong:
    120 + PAR(30) − 5 per wrong) is unchanged, so great and near-perfect players, who mostly finish, stay at 134 / 144.
    Random-gate, same-gate and drop-where-spawned sorting still score 0 (their net is negative).
  - **Pull! clayRev 5 → 6** (360 × 680 sky, drawn 390 × 737 on a 390 px phone; launch heights, vertical speeds and gravity
    × 1.7, so every clay and bird is in the air as long as before; clays and hit areas unchanged): 90 / 130 / 150 / 150 →
    88 / 125 / 150 / 150 on its unchanged formula (great and near-perfect players hit every clay, so a curve cannot separate
    them).
- **Best scores** through the server replay: 150 on beatRev 6 and bubbleRev 5, 149 on sliceRev 6 (no simulated player reaches
  Slice's 900 ‰ on any revision) (`arcade-tuning-g2-check`).
- Each game's intro demo stays stopped (`introDemo.functions.ts`) until one is recorded on the taller revision.

## Taller worlds, batch 3 (16 Oct 2026): Grappler, Orbit, Ball Tracker

The same pattern again: Grappler's cavern grows to 390 × 730 (was 390 × 620), Orbit's view to 390 × 650 (was 390 × 620; its
SET CHECKPOINT row stays below the arena) and Ball Tracker's board to 12 rows of the same tiles, 700 × 1300 (was 9 rows,
700 × 1000; 390 × 724 on a 390-wide arena). The world height rides in the state (`worldH`, folded into the checkpoint
checksum last); stages size from `<game>WorldHFor(rev)` (Ball Tracker from its stored course's `rows`), reveals and intro
demos from `revealWorldH`, effects through `fxSpecAt`. Older rounds replay and score exactly as before
(`scripts/arcade-tuning-g3-check.ts`: 72 runs recorded on main before the change on every revision the three games ever
stamped, `scripts/fixtures/arcade-tuning-g3-legacy.json`, and 24 on the new stamps, `scripts/fixtures/arcade-tuning-g3-runs.json`).
Medians (p10–p90) from `bun scripts/arcade-skill-bands.ts swing balltrack --rev=g3 --seeds=60` (Orbit at 30 seeds), the
revision rooms stamped before → the taller one, every run through the server's own encode + replay:

| Game | Stamp | Change | Average | Good | Great | Near-perfect |
|---|---|---|---|---|---|---|
| Grappler | swingRev 8 → 9 | 390 × 730 cavern: the same ceiling, anchors, spikes and stalactites; the lava 110 px lower and each jet 110 px taller, so it still tops out at the same height; the stars re-proved on the taller cavern. Knots refitted to the band targets: 87 → 70, 204 → 100, 290 → 125, 400 → 130, 499 → 133, 550 → 140 | 63 (20–95) → 70 (23–95) | 100 (41–122) → 100 (46–130) | 114 (83–142) → 125 (84–146) | 131 (108–140) → 135 (108–145) |
| Orbit | orbitRev 7 → 8 | 390 × 650 view, the extra 30 px above the next planet; play identical (no step reads the view) | 76 (0–109) → 76 (0–109) | 100 (29–122) → 100 (29–122) | 128 (96–148) → 128 (96–148) | 136 (125–150) → 136 (125–150) |
| Ball Tracker | btRev 3 → 4 | 12-row board from its own proved bank; the same 30 marbles, release pace and rules; the speed window from tick 3228. Knots refitted: 10 → 32, 20 → 70, 26 → 100, 28 → 130, 29 → 139, 30 → 140 | 72 (48–104) → 70 (43–91) | 99 (89–116) → 100 (85–130) | 126 (104–138) → 130 (100–150) | 138 (126–150) → 130 (115–139) |

- **Before refitting** (the taller revision on its predecessor's curve): Grappler 63 / 101 / 115 / 129 (unit medians 87 /
  204.5 / 290.5 / 500, the same players: the lower lava only removes a few deaths), Ball Tracker 74 / 104 / 126 / 126 (unit
  medians 20 / 26 / 28 / 28 against 19.5 / 25 / 28 / 29 on 9 rows).
- **Grappler leaves Tuning C's lower level.** swingRev 7–8 sat about 10 % under the targets by Joe's ruling (63 / 100 / 114 /
  131); swingRev 9 is fitted to 70 / 100 / 125 / 140–150 as asked for this batch. Its near-perfect median (135) is half
  finishes and half runs that stop short, so it sits a little under 140.
- **Ball Tracker's great and near-perfect players** both bring 28 marbles home at the median on the taller board (near-perfect
  ones 29 almost as often: 27 runs at 28 and 21 at 29 of 60), so one curve cannot put them at 125 and 140–150; 28 → 130 splits
  the difference (great 130, near-perfect 130, their p90 150 and 139).
- **Orbit's curve is unchanged**: the taller view shows more of the course ahead (settled in orbit, the view reaches 286 →
  309 px above the rocket, 1.39 → 1.49 planets ahead, on 40 bank courses) but the bots, and the scores, are the same.
- **Best scores** through the server replay: 150 on swingRev 9 (a bank course's proof witness), orbitRev 8 (a near-perfect
  run) and btRev 4 (a great run) (`arcade-tuning-g3-check`).
- Each game's intro demo stays stopped (`introDemo.functions.ts`) until one is recorded on the taller revision.
