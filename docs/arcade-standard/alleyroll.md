# Ringer (Alley Roll) on the arcade scoring standard

**Ringer** (`alleyRollRev` 2, 3 Nov 2026) is the redesign of Alley Roll: the display name is Ringer (`gameNames.ts`), the
id stays `alleyroll`, the group Sports. Rooms deal rev 2 (`ALLEYROLL_REV_DEALT`); rev 1's rounds replay, score and
draw their own board exactly as before (the second half of this page). Sim `src/lib/arcade/alleyroll.ts` (the
"Ringer" block), swipe mapping `src/lib/arcade/alleyrollSwipe.ts`, art `alleyroll.renderer.ts`, stage
`src/puzzles/alleyroll.tsx`, replay `replayAlleyRollRun(seed, raw, 2)`.

## Ringer's rules (alleyRollRev 2)

- The same lane, ramp and physics as rev 1, nine balls or 60 s (63 s round clock), one input a ball (k1).
- **The board** (`AR2_CUPS`): a flat 10 ring (r 108) round a stepped tower of raised cups, each higher, smaller and
  further back: 20 (rim 3 px up), 30 (5), 40 (7), 50 (9). The two **100 pockets** sit in the top corners
  (`AR2_POCKETS`). A ball scores where it comes down *through a rim*: each tick of flight, the targets whose rim height
  it passes downward through (highest first) are tested at the exact crossing point (integer interpolation, so a
  landing is never rounded to a tick's step); then the floor: a pocket, the 10 ring, else the gutter (0).
- **The gold cup** (150): it glides end to end and back along a track at the top of the board (`AR2_GOLD_Y`) on a
  path from the room seed (`arInitV2`: a period of 70–110 ticks, any phase, a half-width of 56–76 px; `arGoldX256` on
  the round clock), the same for every player in a room. It takes a ball that drops inside its rim whole (the ball's
  centre within 7 px of the cup's, rim drawn at 7 + the ball's 9). Worth more than a pocket: you must time the roll as
  well as aim it.
- **The launch** leaves from the ramp's lip itself (the part of a tick past the lip counts as flight), so a little
  more power always carries a little further: no tick-sized steps (ringer-check measures the largest step).
- **Controls, no aiming arrow**: one swipe up the lane. Where it starts sets the release point (the ball comes to the
  finger), its angle the direction (a screen slope is 0.2 of a lane slope, held to 3/10), its speed over the last
  140 ms the power (0.35 to 2.4 px/ms maps to `AR2_VMIN`–`AR2_VMAX`, 9 to 13.5 px a tick). The same swipe always gives
  the same input (`ringerSwipeInput`, which the bots use too). Computer: drag with the mouse the same way; ← → line up
  and holding Space rolls straight (up to 1.2 s for full power).
- No bank-shot bonus and no ×3 ring.

## Ringer's parts (200 in all)

| Part | Max | How it pays |
| --- | ---: | --- |
| Ring points (core) | 140 | `stdLine(140, ring points, 550)`: every ball's points (pockets and gold cups included), full at 550 |
| Gold cup | 30 | 10 a hit, up to 3 |
| Roll streak | 20 | 4 for each ball scoring 30 or more straight after another that did, up to 5 |
| Pocket hits | 10 | 5 each, up to 2 |

A gold cup or a pocket counts its 150 or 100 in the core as well, so earning a feature never costs core. Any run that
rolled a ball scores at least 1; no input 0. A perfect run (three gold cups, two pockets, four 50s: 850 ring points)
scores 200 through the server replay on every seed (`scripts/ringer-oracle.ts`; ringer-check proves all 260 tuning and
fresh seeds).

**The core's target**: the near-perfect median, **550 ring points** (the brief's "full at the near-perfect median").

## Ringer's medians, weak → flawless (`bun scripts/new-arcade-bands.ts alleyroll`, server replay)

| Level | Before (rev 1, seeds 0–59) | After: room seeds 0–59 (p10–p90) | Fresh seeds 10000–10059 | Ring points | Parts (median) |
| --- | ---: | --- | ---: | ---: | --- |
| Weak | 41 | 60 (25–107) | 52 | 200 | core 50 · gold 0 · streak 8 · pockets 0 |
| Average | 52 | 91 (83–136) | 91 | 280 | core 71 · gold 0 · streak 20 · pockets 0 |
| Good | 66 | 119 (101–147) | 121 | 390 | core 99 · gold 0 · streak 20 · pockets 0 |
| Great | 119 | 139 (120–170) | 167 | 450 | core 114 · gold 0 · streak 20 · pockets 5 |
| Near-perfect | 177 | 180 (131–190) | 180 | **550** | core 140 · gold 10 · streak 20 · pockets 10 |
| Elite | 200 | 190 (163–200) | 190 | 650 | core 140 · gold 20 · streak 20 · pockets 10 |
| Flawless | 200 | 200 | 200 | 850 | core 140 · gold 30 · streak 20 · pockets 10 |

Targets were weak 30–60, average about 90, good 120–140, great about 160, near-perfect about 175, elite 185–195,
flawless 200. Great swings between seed sets (139 / 167: a missed pocket try is a 0 and breaks the streak); weak sits
at the top of its band on room seeds.

The bots (`scripts/arcade-skill-bands/bots/alleyroll.ts`, rev 2) swipe through the phone's own mapping with the hand's
errors: the start point off by the pointing error, the angle by the pointing error over a 120 px swipe, the speed by
1.4× the power error, a fumbled swipe 18 % off, and a gold-cup roll's release off by the timing error of a hard read
(×5: the cup is about 1.2 s from where the ball will meet it). Weak players misjudge the lane's pace at the start
(about 25 %, learnt a quarter a ball) and are tempted by the gold cup (three tries) and a pocket; average players roll
for the tower's middle (the 40's front) and try the gold cup twice; good ones roll for the 50 a little short (it drops
behind the tower when long) and try a pocket once; great ones try both pockets; near-perfect ones three gold cups and
two pockets; elite ones chase the gold cup until three are in (four tries) and the pockets (three). Flawless is the oracle.

## Ringer's checks

ringer-check (~2 s): the board, the gold cup's seeded path and timing, the physics, the swipe mapping, the parts, the
run and replay (rev 1's runs on rev 1's game), the oracle on 260 seeds, the bands, the words. alleyroll-check keeps
proving rev 1. arcade-standard-check's entry (`scripts/arcade-standard/alleyroll.ts`, rev 2 with rev 1's parts in its
extra), arcade-self-replay-check's appended `alleyroll/ringer` entry, one replay fixture run appended
(`scripts/fixtures/replay-runs.json`). The intro demo stays a still.

---

# Alley Roll (alleyRollRev 1, 1 Nov 2026; rev 1's rounds)

A new Arcade game in the **Sports** group (`src/lib/duel/arcadeGroups.ts`), born on the standard: `alleyroll`
(working name; Joe may rename it in `gameNames.ts`), nine balls or 60 s (63 s round clock). Sim
`src/lib/arcade/alleyroll.ts`, art `alleyroll.renderer.ts`, stage `src/puzzles/alleyroll.tsx`, replay
`replayAlleyRollRun` (`src/lib/duel/alleyroll.ts`).

## Rules

- A wooden lane slopes up to a ramp that launches the ball at a tilted board of rings: 50 in the centre, then 40,
  30, 20 and 10 round it, and two 100 pockets in the top corners. A ball that comes down outside every ring scores 0.
- **Setup, then roll** (as the other Sports games): slide the ball along the bottom to choose the release point, then
  swipe up. The swipe's speed sets the power (0.35 to 2.4 px/ms over its last 140 ms maps to the least and most), its
  angle the direction (held to 3/10 across for every 10 up); a short preview arrow shows while the swipe is drawn.
  **Computer:** ← → line up, ↑ ↓ aim, hold Space to charge (up to 1.2 s) and let go to roll; the mouse works as a
  finger.
- One input a ball (k1: release, across speed, up speed in 1/256 px a tick), refused while a ball is moving.
- **Physics:** integer only. The slope takes 2/256 px a tick from the ball's speed every tick; the rails bounce it
  back at three quarters of its speed. Off the ramp a quarter of the speed turns into lift and gravity brings it down
  over the board (wider than the lane; its sides bounce it, its back sends it back at half speed). Where it comes down
  decides the ball. No wind and no seed: the lane is the same lane in every room and every round.
- The run ends after the ninth ball (a finish) or at 60 s; a ball still rolling or in the air at the buzzer scores
  nothing.

## The look

A warm arcade alley: a wooden cabinet top with a dark glass scoreboard of warm lit digits (BALL, SCORE, POCKETS), the
tilted wooden board with its rings lit in warm neon (the ring a ball falls in pulses), the pockets ringed in cyan, a
maple lane with aiming arrows and brass-capped rails, the balls still to roll in the return tray. Sports' green is the
group colour (tile border, intro). No borrowed name: the game is called Alley Roll everywhere.

## The proof of 200

The lane is the same for every seed, so one line serves every seed: `scripts/alleyroll-oracle.ts` finds the release
and swipe that land a ball nearest each target's centre on the sim's own physics and rolls all nine balls into the
pockets, alternating sides. alleyroll-check replays it to exactly 200 through the server replay on every tuning seed
(0–59) and every fresh seed (10000–10199). Rooms deal any seed (`generateAlleyRoll`).

## Parts (200 in all)

| Part | Max | How it pays |
| --- | ---: | --- |
| Ring points (core) | 150 | `stdLine(150, ring points, 540)`: a straight line on every ball's points (pockets included), full at 540 |
| 100 pockets | 30 | 10 each, up to 3 |
| Hot streak | 20 | 4 for each ball scoring 40 or more straight after another that did, up to 5 |

Any run that rolled a ball scores at least 1; no input 0.

## The core's target

As for Blockfall: at the near-perfect median (460 ring points) near-perfect, elite and flawless all had a median of
200. Read as the **elite** level (the band just below Flawless), the core is full at the elite median, **540 ring
points**.

## Medians, weak → flawless (`bun scripts/new-arcade-bands.ts alleyroll`, room seeds 0–59, server replay)

| Level | Score, median (p10–p90) | Ring points | Ring part | Pockets | Streak |
| --- | --- | ---: | ---: | ---: | ---: |
| Weak | 41 (25–76) | 150 | 41 | 0 | 0 |
| Average | 52 (41–70) | 190 | 52 | 0 | 0 |
| Good | 66 (56–100) | 240 | 66 | 0 | 0 |
| Great | 119 (70–176) | 350 | 97 | 10 | 8 |
| Near-perfect | 177 (145–200) | 460 | 127 | 30 | 16 |
| Elite | 200 (168–200) | **540** | 150 | 30 | 20 |
| Flawless | 200 | 900 | 150 | 30 | 20 |

Fresh seeds (10000–10059): 47 / 52 / 70 / 108 / 183 / 197 / 200.

The bots (`scripts/arcade-skill-bands/bots/alleyroll.ts`) line up for about 0.9 s (the level's think scale), aim with
the oracle's table and add the hand's errors: the release off by the level's pointing error, the direction off by
that error over a 120 px swipe, the speed off by 1.4× the level's power error, and now and then a fumbled swipe.
Weak and average players aim at the centre; good ones go for a pocket once, great ones three times, near-perfect and
elite ones on every ball until three pockets are made.

## Checks

alleyroll-check (~1 s): the board, the physics (integer, seed-free, rails, back wall, ranges), the run (one roll a
ball, nine balls, the buzzer, a ball in the air at the buzzer), replay determinism and tampering, the oracle on 260
seeds, the bands rising and the help. arcade-standard-check's entry (`scripts/arcade-standard/alleyroll.ts`),
arcade-self-replay-check's entry, the replay fixture (one run appended). The intro demo is on the later list.
