# Orbit on the arcade scoring standard (orbitRev 13, 29 Oct 2026)

Rooms deal **orbitRev 13** (`ORBIT_REV_STD`, `src/lib/arcade/orbit.ts`). Its play is orbitRev 12's exactly: the same
feature-bank course (`orbitXpBank.server.ts`), black holes, stardust, slingshot moons and asteroid fields, the same
450 × 782 view drawn 862 tall with SET CHECKPOINT in `ORBIT_XP_ZONE`. The start is `initXpFrom` plus `std: 1`
(`initStdFrom`), which is outside the checkpoint checksum, so an orbitRev 12 log replays tick for tick on 13. Only the
score changed (`orbitStdScore`, `ORBIT_STD` in `src/lib/arcade/orbitRev3.ts`). orbitRev 12 and every earlier stamp score
exactly as before. Every display, layout and bank path that treated orbitRev 12 specially now goes through
`orbitXpRev(rev)` (12 or 13).

## The parts (200 in all)

| Part | Max | How it counts |
|---|---|---|
| Planets (core) | 130 | A straight line over the 40 planets in sixteenths: `floor(130 × (16 × planets reached + reach) ÷ 640)`. `reach` (0–15) is orbitRev 12's partial credit: how far the furthest flight from the last planet reached got along the line to the next one. All 130 at the sun. |
| Speed | 20 | Only on reaching the sun: `stdSpeed(20, ticks left, 2700, 0)`, so all 20 with half the run (45 s) or more left, 0 at the buzzer, and a straight line between. |
| Stardust | 15 | 0.5 a mote, of 30 (5 trails × 6 motes, `ORBIT_XP_TRAILS × ORBIT_XP_MOTES`). |
| Slingshots | 12 | 3 each, of 4 moons (`ORBIT_XP_MOONS`). |
| Asteroid fields | 12 | 4 each, of 3 fields threaded (`ORBIT_XP_FIELDS`). |
| Perfect orbits | 11 | Equal shares of 21 (11/21 each, `ORBIT_STD_PERFECT_OF`). All 11 at 21. |

Reaching the sun gives no separate bonus. orbitRev 12's rising skill scale, its pace cap and its "without the sun, skill
pays at most 24" rule are gone on 13. There is no penalty: a crash costs only the planets it leaves unreached. A run with
no input scores 0 and any played run scores at least 1 (`stdTotal`). The counts in the brief match the `ORBIT_XP_*`
constants: 30 motes, 4 moons and 3 fields on every bank course (orbit-expand-check proves it).

## Assumptions

- **Perfect orbits of 21.** The number of perfect orbits a course offers depends on the route. Each hop can be one, but
  black holes and two-planet skips remove hops, and the witness routes fly 22–30 captures. 21 is the most that every
  course's proved witness run flies (`XP_PERFECT_MIN`, 21–28 across the 371 courses). It is also orbitRev 12's own full
  figure (7 × 3).
- **Partial credit in sixteenths** keeps the core integer. At whole planets the core equals the straight line
  `ORBIT_V13_BAND_CURVE` = (0, 0) → (40, 130).
- **Speed "half the time left"** means 2,700 of the 5,400 ticks left at the capture of the sun.
- The core has a fixed maximum (every planet), so no near-perfect median was needed to set it.

## Perfect runs

The x200 oracle is the feature bank's witness taps (`scripts/orbit-xp-lib.ts`). It takes every feature and at least 21
perfect orbits on every course. 342 of the 371 witnesses also reach the sun with at least 2,700 ticks left, and each of
those scores 200 through the server replay on orbitRev 13. arcade-standard-check replays the first 40 of them. The other
29 finish with 2,567–2,699 ticks left, so they lose up to 1 speed point. A built state (the sun with 50 s left and
everything taken) is scored by the sim as well.

## Skill bands after (orbitRev 13, 30 seeds, `--rev=now --levels=all`, the feature-bank course per room seed)

| Weak | Average | Good | Great | Near-perfect | Elite | Flawless |
|---|---|---|---|---|---|---|
| 13 (3–47) | 51 (14–104) | 105 (48–152) | 157 (114–180) | 183 (166–191) | 191 (180–195) | 194 (186–200) |

Medians (p10–p90) rise at every level. The top three sit close together (183, 191, 194) because the bots already take
nearly every feature. No bot change was needed.
