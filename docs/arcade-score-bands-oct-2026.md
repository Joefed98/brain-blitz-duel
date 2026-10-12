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
- Every curve and finish rule is in the game's "?" help (generated from the sim's constants); the intro SCORE line says it
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
