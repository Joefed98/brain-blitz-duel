# Orbit on the arcade scoring standard (orbitRev 13, 29 Oct 2026; orbitRev 14, the fuel meter, 1 Nov 2026)

Rooms dealt **orbitRev 13** (`ORBIT_REV_STD`, `src/lib/arcade/orbit.ts`) until 1 Nov 2026, when **orbitRev 14** (the fuel meter, below) took over on the same parts. Its play is orbitRev 12's exactly: the same
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

## orbitRev 14: the fuel meter (1 Nov 2026)

Joe's notes: a fuel meter in place of dying off-screen, catch any planet the rocket reaches, the camera following the
flight, and more zigzag in the layout. Rooms deal **orbitRev 14** (`ORBIT_REV_FUEL`); every earlier stamp plays and scores
exactly as before (orbit-fuel-check replays 96 orbitRev 10, 12 and 13 runs recorded on main before the change,
`scripts/fixtures/orbit-fuel-legacy.json`, `scripts/orbit-fuel-legacy.ts`).

**Rules** (sim, `orbitRev3.ts` "The fuel meter"; every change gated on the state's `fuel`, set only by `initFuelFrom`):

- **Fuel.** `ORBIT_FUEL_MAX` = 160 units (2.67 s of flight). One unit burns each tick of free flight (the release tick
  included); the tank is full again the moment the rocket is caught by a planet or a black hole, or respawns. In orbit
  nothing drains. An empty tank ends the flight like a crash: the checkpoint's one respawn (with a full tank) if set,
  else the end of the run ("out of fuel", the reveal says so). There is no other end to a flight on 14: no world edge,
  no 190-tick cap, no "past reach" end.
- **Fuel to spare.** Every hop on a dealt course is proved to land on the next planet within `ORBIT_FUEL_HOP_MAX` = 120
  ticks, so an aimed jump arrives with at least 40 units (a quarter) left; every bank witness flight is checked to land
  with at least that. Only a launch into empty space runs the tank dry.
- **Any planet catches** (`orbitCaptureAny`): ahead (any distance, including planets above the visible screen) first,
  then behind. A planet jumped past counts as passed: `best` is the furthest planet reached, so skipping planets never
  costs core.
- **The camera** (`orbitCamera.ts`, display only): in flight it eases toward the point the rocket will reach 45 ticks on
  (`ORBIT_FUEL_LEAD_TICKS`, or where the fuel ends if sooner), framed 42 % down the view, a tenth of the gap a tick and at
  most 10 px, never letting the rocket leave the frame, so the planet it is heading for is in view before it arrives
  (orbit-fuel-check: every witness flight of 20+ ticks shows its target 8+ ticks before the catch).
- **The meter** (`orbit.renderer.ts` `drawFuelMeter`, display only): bottom right of the drawn world, a "FUEL" label over
  a 16 × 112 px gauge in ten segments (green over half, amber over a quarter, red below), its frame brightening while it
  drains; when it runs dry it flashes red, puffs of smoke leave the rocket and "OUT OF FUEL" shows. SET CHECKPOINT keeps
  its top-right corner; the meter is far below it and there is no other control (play-control-clearance-check).

**The courses** (`src/lib/duel/orbitFuelBank.server.ts`, `scripts/orbit-fuel-bank.ts`, `scripts/orbit-fuel-lib.ts`): a new
proved bank. Each bank seed's planets are laid out with a harder zigzag than orbitRev 3's generator: every step 120–300 px
sideways (rev 3: 0–260) and the direction turning after one or two planets (rev 3: two or three), each placement first
tried against a rule that no release from a planet three or more back, on a full tank, flies into it (`noFarCatch`, then
without it), and each hop proved on rev 14's rules (a 4-tick window two laps running landing within 120 ticks). Then the
black holes (`orbit-hole-lib.ts`, as the hole bank) and the features and witness (`orbit-xp-lib.ts` `buildXp`, played on
`initFuelFrom`): 30 motes, 4 slingshots, 3 fields, 2 or 3 of the black holes (a witness may catch a planet beyond a hole), 21+ perfect orbits and the sun with half the run left, so
every course's witness scores 200 through the server replay (orbit-fuel-check replays every one; arcade-standard-check the
first 40). Salted retries until a seed passes; the build is deterministic (`--check` rebuilds entries byte for byte).

**Score:** orbitRev 13's six parts unchanged (the table above, 200 in all). The core has a fixed maximum (every planet),
so it stays full at the sun rather than at a measured median; `ORBIT_V14_BAND_CURVE` is the same straight line.

**Skill bands** (`bun scripts/arcade-skill-bands.ts orbit --rev=now --levels=all --seeds=30`, the bots unchanged: they
read every release by forking the real sim, so fuel and catching any planet are what they see; medians, p10–p90):

| | Weak | Average | Good | Great | Near-perfect | Elite | Flawless |
|---|---|---|---|---|---|---|---|
| orbitRev 13, tuning seeds | 13 (3–47) | 51 (14–104) | 105 (48–152) | 157 (114–180) | 183 (166–191) | 191 (180–195) | 194 (186–200) |
| orbitRev 14, tuning seeds | 15 (3–43) | 32 (9–66) | 74 (6–118) | 118 (44–162) | 181 (168–190) | 186 (178–190) | 191 (183–196) |
| orbitRev 14, fresh seeds (`--from=10000`) | 15 (3–53) | 49 (12–85) | 64 (16–117) | 128 (5–169) | 180 (159–192) | 187 (177–191) | 192 (187–197) |

Medians rise at every level. Planets reached (the core's measure), medians on the tuning seeds: 4, 7, 16, 27, 40, 40, 40
(orbitRev 13: 3, 12.5, 23.5, 37.5, 40, 40, 40); near-perfect's median is every planet, the core's fixed full point. The
middle levels lose ground: the zigzag's longer diagonal hops leave narrower release windows, so mid-skill players crash
or run dry earlier. The top three sit 5 apart (181, 186, 191), as close as on orbitRev 13. Decision for Joe: keep the
harder middle, or soften the zigzag (`ZIG` in scripts/orbit-fuel-lib.ts) and rebuild the bank.

Zigzag measures (orbit-fuel-check, 8 courses each): 187 px sideways a planet (orbitRev 13's courses 127), the direction
turning on 63 % of steps (48 %), and 1.04 % of all full-tank releases caught three or more planets on (1.69 %).
Review frames: `bun scripts/shots/orbit-fuel-shots.ts` (`screenshots/arcade-tuning-nov-2026/orbit-fuel-*.png`: mid-flight,
low and empty at 414 × 896 and the computer layout at 1366 × 768). The intro demo stays stopped until one is recorded on
orbitRev 14.
