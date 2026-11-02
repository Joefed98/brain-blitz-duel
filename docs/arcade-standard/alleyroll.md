# Alley Roll on the arcade scoring standard (alleyRollRev 1, 1 Nov 2026)

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
