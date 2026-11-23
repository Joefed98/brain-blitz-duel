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
- **The camera** (`orbitCamera.ts`, display only; **replaced on 3 Nov 2026 by the still camera**, "Camera and stardust"
  below): in flight it eased toward the point the rocket will reach 45 ticks on
  (`ORBIT_FUEL_LEAD_TICKS`, or where the fuel ends if sooner), framed 42 % down the view, a tenth of the gap a tick and at
  most 10 px, never letting the rocket leave the frame, so the planet it is heading for is in view before it arrives
  (orbit-fuel-check: every witness flight of 20+ ticks shows its target 8+ ticks before the catch).
- **The meter** (`orbit.renderer.ts` `drawFuelMeter`, display only): bottom right of the drawn world, a "FUEL" label over
  a 16 × 112 px gauge in ten segments (green over half, amber over a quarter, red below), its frame brightening while it
  drains; when it runs dry it flashes red and "OUT OF FUEL" shows. SET CHECKPOINT keeps its top-right corner; the meter
  is far below it and there is no other control (play-control-clearance-check).
- **The sputter** (2 Nov 2026, display only; `orbit.renderer.ts` `observeSputter` / `drawSputter`, `ORBIT_SPUTTER_MS`):
  when the tank runs dry the rocket coughs a flicker of flame and a trail of smoke puffs, tumbles and drops away, fading
  out, while the meter flashes red (on and off every 100 ms), over 0.6 s, instead of the frame freezing on the dry tick.
  The sim is untouched: it still ends the run (or respawns at the checkpoint) on the dry tick. A run that ended dry has
  no more ticks, so its sputter runs on the presentation clock from the first frame that shows the end, and the stage
  holds the submit for the same 0.6 s (`ArcadeCanvasStage` `endHoldMs`, `orbitEndHoldMs`; the finished run is sent as
  the draft at once, and a stage that goes away first sends it at once), well inside the 2 s the battery rule keeps an
  ended arena at full frame rate. A checkpoint respawn's sputter runs on the sim's ticks at the point the tank ran dry
  (the rocket is already back at the checkpoint), with the words fading over the next half second. Reduced motion: no
  smoke, drop or flashing; the dead rocket where it stopped, a red gauge and the words. orbit-fuel-check section 7.

**The courses** (`src/lib/duel/orbitFuelBank.server.ts`, `scripts/orbit-fuel-bank.ts`, `scripts/orbit-fuel-lib.ts`): a new
proved bank. Each bank seed's planets are laid out on a zigzag: every step 60–220 px sideways (rev 3's generator: 0–260,
so a rev-14 hop never goes straight up; the first rev-14 bank: 120–300) and the direction turning after one or two
planets (rev 3: two or three), each placement first
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
| orbitRev 14, first bank (120–300 px), tuning seeds | 15 (3–43) | 32 (9–66) | 74 (6–118) | 118 (44–162) | 181 (168–190) | 186 (178–190) | 191 (183–196) |
| orbitRev 14, first bank, fresh seeds (`--from=10000`) | 15 (3–53) | 49 (12–85) | 64 (16–117) | 128 (5–169) | 180 (159–192) | 187 (177–191) | 192 (187–197) |
| **orbitRev 14, softened bank (60–220 px), tuning seeds** | 19 (6–67) | 60 (17–103) | 86 (12–145) | 154 (65–174) | 185 (175–191) | 189 (172–196) | 195 (187–199) |
| **orbitRev 14, softened bank, fresh seeds** | 32 (9–68) | 64 (18–96) | 89 (50–145) | 145 (111–165) | 183 (162–191) | 190 (182–197) | 195 (187–200) |

**Softening the zigzag** (2 Nov 2026, Joe: bring the middle levels back, about 50 / 100 / 140 for Average / Good / Great,
the top as it was). The first rev-14 bank (every step 120–300 px sideways) left the middle well under orbitRev 13's: its
longer diagonal hops leave narrower release windows, so mid-skill players crashed or ran dry early (on 96 seeds: 39 / 71 /
118). Trial banks of 32 courses each (the first 32 bank seeds, the same proof), measured on 96–288 seeds at those three
levels: 80–260 px 52 / 75 / 137; 100–260 px turning after two or three planets 37 / 75 / 140; 60–220 px 56 / 85 / 141;
60–220 turning after one to three 61 / 69 / 152; 50–210 68 / 100 / 158; 40–200 58 / 98 / 167. How far a hop goes
sideways sets the middle; how often the zigzag turns barely moves it. 60–220 px, turning after one or two planets, was
nearest the targets and was built in full (96 of 96 bank seeds proved): on 96 seeds Average / Good / Great are 57 / 90 /
151 (tuning) and 56 / 87 / 149 (fresh); the 30-seed table above is noisier. The top three are where they were (185, 189,
195). Good still sits about 10 under its target and Great about 10 over (the bots' spread at those levels is wide);
narrower steps lift Good but push Great further past 140.

Zigzag measures (orbit-fuel-check, 8 courses each): 124 px sideways a planet (orbitRev 13's courses 127), no step under
40 px sideways on any of the 96 courses (orbitRev 13's: 12.5 % of steps), the direction turning on 69 % of steps (48 %),
and 0.52 % of all full-tank releases caught three or more planets on (orbitRev 13's 1.69 %; the first rev-14 bank 1.04 %).
Over the whole bank: 125 px, 65 % turning, 0.44 % caught far ahead (the first bank 1.21 %). Every witness flight lands
with at least 42 of 160 units left (the proof's floor is 40), every hop proved within 120 ticks.
Review frames: `bun scripts/shots/orbit-fuel-shots.ts` (`screenshots/arcade-tuning-nov-2026/orbit-fuel-*.png`: mid-flight,
low and empty (after the sputter) at 414 × 896 and the computer layout at 1366 × 768, and `orbit-fuel-sputter-414x896.png`,
0.3 s into the sputter). The intro demo stays stopped until one is recorded on orbitRev 14.

## Camera and stardust, Nov 2026, display only

Joe's brief (3 Nov 2026): the screen stays still while the rocket orbits and while it flies; only a catch moves it; stardust
that looks like stardust. No stamp: the sim (`orbitRev3.ts`) is untouched, every stored run replays to the same score and
state (arcade-self-replay-check, orbit-fuel-check's legacy runs), and nothing the sim reads came from the camera. The
display camera (`orbitCamera.ts`) never fed the sim on any revision: the sim's own `camY` (rev 3's old draw path) and its
world-edge, flight-length and past-reach ends are computed from the world and the planets, not from what is framed.

**The still camera** (orbitRev 14 only: states carrying `fuel`, `orbitStillCamera`; `advanceStill` in `orbitCamera.ts`):

- In orbit the view holds exactly still. It frames the planet caught as every revision does (`framedPlanet`: the whole
  orbit inside the safe box, the next planet up the screen); only a backstop keeps the rocket inside the frame (a black
  hole's rocket flying in from beyond the ring).
- A catch (any planet, a black hole's target) or a checkpoint respawn starts one eased pan (smoothstep) to that planet's
  framing: `ORBIT_STILL_PAN_TICKS` = 24 ticks (0.4 s) for an ordinary hop, longer only so its peak speed stays under
  `ORBIT_STILL_PAN_TOP_SPEED` (22 px a tick) for a far catch or respawn, at most 60 ticks (reduced motion 15, at most 40).
  A pan still running when the player taps carries on to its end.
- In flight the view holds still unless the rocket nears the frame's edge: inside a soft band (`ORBIT_STILL_EDGE_BAND`,
  56 px inside the 14 px on-screen margin) the camera moves by a quarter of the rocket's depth into the band a tick
  (`ORBIT_STILL_EDGE_FOLLOW`), and never lets the rocket's centre past the 14 px margin, so it follows just enough to keep
  the rocket in view, easing in rather than snapping. A running pan shifts by the same amount, so the two add smoothly.
- orbitRev 14's look-ahead lead (`ORBIT_FUEL_LEAD_*`, 1 Nov 2026) is gone.
- **Older revisions keep their camera exactly** (orbitRev 3–13: the distance-scaled pans, the in-flight safe-box push and
  the settled visibility pans). Their flights still end at the world's edges and past reach, and their players learned
  those edges with that framing; orbit-camera-check's first sections still prove it unchanged on the rev-3 bank.
- SET CHECKPOINT's corner stays clear: the rocket stays 14 px inside the frame, below the 80 rows drawn above it
  (play-control-clearance-check replays every fuel-bank course in both camera modes).

Proved by orbit-camera-check's "STILL CAMERA" section (12 fuel-bank courses, witness and seeded random taps, normal and
reduced motion): still in orbit and in flight away from the edges (exactly, frame to frame), a pan only after a catch or
respawn and never longer than its maximum, the rocket always inside the frame, no step over 24 px a tick. orbit-fuel-check
section 5 still finds every witness flight's landing planet in view 8+ ticks before the catch.

**Stardust** (`orbit.renderer.ts` `drawDustCluster`, every revision with stardust, orbitRev 12+): each mote is a small
glittering cluster, five specks (white, pale gold and a faint lilac) inside the pickup's own 4 px radius (`ORBIT_DUST_R`:
the cluster is the collision size; each speck's centre distance plus size is at most 4 px), each twinkling on its own
phase, a thin four-point glint on the centre no longer than the radius, over a soft gold-white glow (the cached
`drawFxGlow` sprites; the glow alone reaches past the core). Reduced effects (battery saver included): no glow. Reduced
motion: the specks still. Taking a mote keeps its four-ray flash and adds a faint sparkle trail (`XP_TRAIL_MS` 650 ms):
ten glitter specks streaming after the rocket along its path, each slower than the last and drifting aside, twinkling as
they fade (deterministic per mote, no `Math.random`). Not under reduced motion or reduced effects. The moment already
sounds (`shared.celebrate.countTick`, `gameSounds.ts`); no new cue or recording.

Review frames: `bun scripts/shots/orbit-camera-shots.ts` (`screenshots/arcade-batch-nov-2026/orbit-before-catch.png`, a
long flight just before its catch with the view where it was at the release; `orbit-after-catch.png`, the pan settled on
the new planet; `orbit-stardust.png`, a mote's sparkle trail and the clusters ahead), 414 × 896 at 2×.

## orbitRev 15: grace (the Action overhaul, 15 Nov 2026)

Rooms deal **orbitRev 15** (`ORBIT_REV_GRACE`) since the Action overhaul (phase 2, step 4; `docs/design/game-reviews/action.md`):
orbitRev 14's fuel-bank courses, fuel, features, view and parts, with one rule changed. The review's capture showed a blind
first try catching one planet, running dry and ending the 90 s round at 5 s with 3 points. Joe's grace rule: no run ends on
the first slip.

- **A slip no longer ends the run.** A crash (a belt, a rock, a moon, a tap on a planet's inner lobe) or an empty tank,
  with no checkpoint armed, respawns the rocket at the planet the flight left (the last planet caught), with a full tank,
  held in orbit for `ORBIT_GRACE_HOLD_TICKS` (180 ticks, 3 s). A tap during the hold does nothing; the screen shows
  "OUT OF FUEL" or "CRASHED" over "BACK IN 3, 2, 1". The hold is the whole cost: the clock runs on and the planets already
  reached stay reached. The run ends only at the sun or the buzzer.
- **SET CHECKPOINT stays, as the bonus.** Its one respawn is instant (no hold) at the checkpoint planet, as on orbitRev 14.
  Once it is used, later slips fall to grace.
- **No slip, no change.** A run with no slip plays orbitRev 14 tick for tick (every fuel-bank witness replays to the same
  200 on both). The state adds `grace`, `hold` and `autoRespawns`, folded into the checkpoint checksum last, so orbitRev
  14 and earlier checksums are unchanged.
- **Proof.** Every one of the 96 fuel-bank witnesses replays through the server on orbitRev 15 to exactly 200 with every
  feature (orbit-overhaul-check). The bank is unchanged: grace only adds a way back, so every course's proof holds.

Display and input, every revision of the expansion's view (no stamp):

- **The planets** (concept A, made in canvas, `orbitPlanets.renderer.ts`): each planet a sphere-shaded disc whose surface
  (banded gas, cratered rock or streaked ice, in its seeded colour) turns slowly under a fixed light, a thin lit limb on
  the sunward side, all inside the collision circle. Clean black space, no nebula. The turn follows the round tick and
  stands still under reduced motion.
- **The setting: towards the sun.** The sun's warmth grows from the top of the view as the run climbs the course (0 at the
  start, full by planet 39), a low dome that is 0 along the world's sides and bottom, so the screen's fill (black space and
  the same stars, `orbitFill`) meets the world with no seam at any point of the course (edge to edge).
- **The HUD:** fewer and bigger counters: PLANETS (and the checkpoint, once armed) in 32 px pills, then STARDUST and
  SLING in 28 px pills. Asteroid fields and perfect orbits show as their pops and in the reveal.
- **SET CHECKPOINT is held, not tapped** (`ORBIT_CHECKPOINT_HOLD_MS`, 450 ms, a gold fill sweeping across it), so a
  release aimed near the corner can't spend the checkpoint by accident. The keyboard's C stays a single press.
- **The capture chain** of the success layer now resets on every slip (it read the respawns left, which fall).

### Skill bands (30 room seeds a level, the same human on both, server replay; `bun scripts/orbit-grace-bands.ts`)

| Level | orbitRev 14 median (p10–p90), run ends at | orbitRev 15 median (p10–p90), respawns |
|---|---|---|
| Weak | 17 (6–67), 17 s | 78 (37–98), 4 |
| Average | 57 (18–115), 39 s | 94 (79–142), 4 |
| Good | 84 (13–146), 43 s | 131 (111–153), 3 |
| Great | 151 (65–178), 75 s | 161 (140–178), 1 |
| Near-perfect | 184 (175–191), 90 s | 184 (175–191), 0 |
| Elite | 188 (173–197), 90 s | 188 (182–197), 0 |
| Flawless | 195 (187–199), 90 s | 195 (187–199), 0 |

Brilliant > great > good still holds; the levels that never slip are unchanged, and the ones that did now play the whole
90 s. The skill-band bot (`scripts/arcade-skill-bands/bots/orbit.ts`) plays orbitRev 14 and 15 (its replan key carries the
automatic respawns).

### Stage 2 look pass: Blender-rendered planets (15 Nov 2026, display only, no stamp)

The planets of the expansion's view (orbitRev 12–15) are drawn from nine surface maps baked in Blender
(`scripts/orbit-planets-blender.py`: procedural materials on a UV sphere, a Cycles EMIT bake, fixed seeds, `--check`
rebuilds byte for byte; run it with Blender as a Python module in a venv outside the project). Two gas giants, a marbled
world and a cratered moon are grey tone maps tinted with the seeded colour; a desert, a volcanic world, an ocean world and
two icy worlds keep their own colours; rocks and ice add a height map. 363 KB in `public/orbit/planets/`, loaded on the
first draw (the stage-1 strip look shows until they arrive). `orbitPlanets.renderer.ts` projects a map onto the sphere at
the canvas's device scale (up to `SPHERE_MAX_PX` 192), lights it from one sun (terminator, deep night side, relief from the
height map, highlight on water and ice, a thin rim inside the disc in the seeded colour), 240 frames a turn (120 under
reduced effects), the turn still under reduced motion. Which map a planet wears follows its type and seeded colour
(`orbitPlanetMapFor`); icy worlds take only a cold cast (`orbitIceCast`), never a warm colour. Rings are three ringlets
inside 0.88 r (`drawPlanetRing`). Nothing is drawn past the collision circle + 2 px and there is no glow halo
(orbit-overhaul-check). The planets' size is the sim's: radius 19–28 world px, so 17–26 CSS px on a phone and up to 40 on
the desktop column; drawing them larger would need a new stamp (the collision circle): orbitRev 16 below.

### Stage 2: effects and the answer reveal (15 Nov 2026, display only, no stamp)

`orbitEffects.renderer.ts` (drawn by Orbit's renderer on the expansion's view): the launch puff, low fuel (the gauge
pulsing red, the flame stuttering, the beep every 30 ticks from `ORBIT_LOW_FUEL` 40), a lock ring on every catch, the
hold's draining arc and GO, the sun's bloom with ALL 40 PLANETS! and the count-up; the out-of-fuel sputter now coughs,
fizzles and drifts (`sputterPose`, still `ORBIT_SPUTTER_MS` 600). Orbit is edgeless: `ORBIT3_FX_XP.moment` draws a ring
where a moment happened, and its final banner is the bloom's. Every effect observes the sim, ends within 900 ms and is
still under reduced motion. The reveal's run picture (`PuzzleDefinition.RunPicture`, `OrbitRunPicture`):
`traceOrbitRun` (src/lib/duel/orbitRunTrace.ts) replays the stored log through the server's own replay
(`replayOrbitRun`'s new `observe`, which changes nothing) and `drawOrbitRunMap` (orbitReveal.renderer.ts) draws the
course folded into four columns; the planets, stardust, slingshots and slips are big numbers above it. The planet maps
load with the game's chunk (`preloadOrbitPlanetMaps`).

### orbitRev 16: bigger planets (stage 3 of the overhaul, 15 Nov 2026)

Joe asked for bigger planets that read clearly on a phone. `ORBIT_REV_BIG` 16 (`initBigFrom`, the state's `big`, outside
the checksum) is orbitRev 15's play exactly: the same 96 fuel-bank courses, rings, catches, black holes, belts, features,
fuel, grace and parts. Only each planet's body circle (`r`, the bounds its art is held to) changes, in
`orbitBigPlanets` (orbit.ts):

- the body is `ORBIT_BIG_PCT` 140 % of orbitRev 15's, **capped** so the drawn body (a figure-eight's two bodies at 80 %)
  keeps `ORBIT_BIG_AIR` (the rocket's 10 px radius and 3 px) from the planet's own orbit path (`orbitPathClearance`,
  1,024 phases, integer), and never smaller than before; the sun is 140 % (40 → 56 px).
- Why a cap and not bigger orbits: the body is collided with by nothing (a catch is the orbit's region, a crash a belt,
  rock, moon or the figure-eight's crossing), so growing the bodies inside the paths keeps every catch, hole and course
  exactly fair, and the bank needs no new courses. Growing the rings too would change every catch region and the course
  layout, and need a new bank and new bands.
- What that gives on the bank's 3,840 planets: every circle orbit 140 % (63 %), ellipses ×1.17 (median), figure-eights
  unchanged (their bodies already sit close to the crossing). By stretch of the course: planets 1–10 140 %, 11–20 140 %
  (79 % of them), 21–30 ×1.22, 31–39 ×1.00 (43 % at 140 %). Largest body 39.2 px (was 28).
- No grown body reaches a neighbour's path or belt, a mote, moon, rock or black hole (orbit-overhaul-check section 9).
- The Blender maps fill the bigger discs from the same files (640 × 320, no new bytes: 363,486 in all);
  `SPHERE_MAX_PX` 224 so a radius-39 planet on the desktop column at 2× (222 px) is baked at full size. Rings stay inside
  the circle + 2 px.

Proof: all 96 bank witnesses replay to 200 with every feature on orbitRev 16 through the server, tick for tick and checksum
for checksum as on 15 (`bun scripts/orbit-fuel-bank.ts --rev=16`, orbit-overhaul-check section 9); 120 runs on orbitRev
12–15 recorded on 329286de before the change (`scripts/fixtures/orbit-big-legacy.json`, `scripts/orbit-big-record.ts`)
replay exactly, and the 30 orbitRev 15 logs among them (bots, a random tapper with slips, a checkpoint) play the same on
16. Rooms deal 16; `pinOrbitPreBig(true)` (deal pin `orbitPreBig`) deals 15. Stargazer is met on 16. Self-replay entry
`orbit/big`.

Skill bands (30 room seeds a level, the same human on both, server replay;
`bun scripts/orbit-grace-bands.ts --from=15 --to=16`): identical at every level, as the play is.

| Level | orbitRev 15 median (p10–p90) | orbitRev 16 median (p10–p90) |
|---|---|---|
| Weak | 78 (37–98) | 78 (37–98) |
| Average | 94 (79–142) | 94 (79–142) |
| Good | 131 (111–153) | 131 (111–153) |
| Great | 161 (140–178) | 161 (140–178) |
| Near-perfect | 184 (175–191) | 184 (175–191) |
| Elite | 188 (182–197) | 188 (182–197) |
| Flawless | 195 (187–199) | 195 (187–199) |

**The answer reveal** (Joe, 15 Nov 2026): the run picture (big numbers and the course map) sits straight under the score,
with the stored breakdown in the shared layout below it, as Roofbound, Moon Climb and Iron Wall read (the shared
ArcadeReveal order, `data-reveal-run-picture` before `RevealBreakdown`, from the stage-3 reveal fix); Orbit's own `Reveal` (results-screen replays) on
the expansion's view is the same picture, never the old lines.

**The sun's end hold** (Joe, 15 Nov 2026, display only): a finished run on the expansion's view holds its submit
`ORBIT_SUN_HOLD_MS` 1,500 ms (`orbitEndHoldMs`), so the bloom, ALL 40 PLANETS! and the count-up show in practice too;
the finished run is the draft meanwhile. A dry end still holds 600 ms for the sputter.

### Levels (stage 3 of the overhaul, 16 Nov 2026)

Easy, Hard and Expert through the difficulty framework (`GAME_LEVELS.orbit` in `src/lib/levels/gameLevels.ts`,
docs/design/difficulty/README.md). Normal is exactly today's game: the same deal byte for byte (the Normal fuel bank is
untouched, no `level` field), and rated matches and the Daily stay Normal. Each level is orbitRev 16 on a course from
**its own proved bank** (`src/lib/duel/orbitFuelBank{Easy,Hard,Expert}.server.ts`, 32 / 32 / 31 courses, about 80 KB
each, server only), picked by the seed as Normal's (`orbitFuelCourseForSeed(seed, level)`); the deal stamps `level` and
the sim reads its rules from the stored level (`orbitLevelFields`, `initLevelFrom` in `orbitRev3.ts`; the state's
`tank`, `cpAuto` / `cpNone`, `cpUsed`, folded into the checkpoint checksum last, only when present). Grace, the 90 s run,
the features (30 motes, 4 slingshots, 3 fields) and the six parts (200) are orbitRev 16's at every level.

| Lever | Easy | Normal (today) | Hard | Expert |
|---|---|---|---|---|
| Tank (ticks of free flight) | 240 | 160 | 140 | 120 |
| Longest proved hop (ticks) | 120 | 120 | 105 | 90 |
| Zigzag: sideways step | 30–150 px | 60–220 px | 110–270 px | 140–300 px |
| Zigzag: lift (× 1.15) | 130–200 px | 150–230 px | 170–250 px | 190–270 px |
| Narrowest release window a hop is built with | 4 ticks | 4 ticks | 3 ticks | 2 ticks |
| Black holes beside planets | 25 | 10, 20, 29 | 15, 25, 34 | 11, 21, 30 |
| Belts from planet | 25 | 31 | 25 | 21 |
| Checkpoints | automatic on planets 10, 20, 30 | one (SET CHECKPOINT) | one (SET CHECKPOINT) | none (grace only) |

- **Today's Normal values, confirmed**: belts from planet 31 (`ORBIT_HAZARD_FROM`), black holes beside planets 10, 20 and
  29 (`HOLE_FROM` 9, 19, 28, 0-based). The earlier draft of this table said "21 / 31"; 21 is where figure-eights start
  (`ORBIT_EIGHT_FROM`), not black holes. Joe's "from N" is read as the first hole beside planet N, the others 10 and 19
  on (as Normal's), while a hole's target stays short of the sun.
- **Easy's automatic checkpoints.** With grace a slip already respawns at the planet the flight left, so a checkpoint
  that sent the rocket *back* to planet 10 would cost more than it saves. On Easy the checkpoint arms itself whenever a
  catch takes the furthest planet past 10, 20 or 30; a slip then respawns **at once at the planet it left, with no hold**,
  spending it until the next tenth planet; with none armed, grace's 3 s hold. SET CHECKPOINT is not offered on Easy or
  Expert (`orbitCanSetCheckpoint` / `orbitRev3CanSetCheckpoint`, so the button hides).
- **Easy's belts from 25** are Joe's words; they are earlier than Normal's 31 (decision for Joe).
- **The banks.** `bun scripts/orbit-fuel-bank.ts --level=easy|hard|expert` builds a level's bank from its settings in
  `GAME_LEVELS` (`levelCourse`), `--check [n] --level=…` rebuilds the first n byte for byte, `--rev=16 --level=…`
  re-proves every witness through the server replay. A level course is proved on its own rules only: the holes are
  placed on a walk with the level's tank (`buildHoles`' `HoleWalk`, `windowHopDelay`) and the old-rule bot is skipped
  (it asks for four-tick windows and rev-3 flight ends); the witness (`scripts/orbit-xp-lib.ts`) then takes every
  feature and the sun with half the run left, 200, its flights landing with a quarter of the tank to spare. Without
  `--level` the script builds the Normal bank exactly as before.
- **Stargazer** ("Collect all the stardust on Hard") is met by every Hard witness as the server grades it.

#### Measured (16 Nov 2026)

`bun scripts/orbit-level-bands.ts --seeds=16` (16 real deals a level, `generatePuzzle("orbit", { bankSeed, level })`,
the skill-band bot, every run graded by the server's replay on the dealt puzzle; checkpoints every 300 ticks, Orbit's
`ORBIT_CHECKPOINT_INTERVAL`). **Human limits on the elite bot** (this tool's own constraint, `ORBIT_HUMAN_LIMITS`): a
reaction of 250 ± 30 ms (elite's 145 ± 15) and a thinkScale of 0.43, so the bot's 350 ms read of each new orbit takes
about 150 ms more before it can move (elite's 0.32); timing (9 ms) and aim are elite's. The other levels are the shared
profiles. Mean, median (p10–p90), share of runs reaching the sun:

| Bot | Easy | Normal | Hard | Expert |
|---|---|---|---|---|
| Average | 116, 118 (98–125), 0 % | 107, 98 (84–130), 0 % | 79, 75 (47–110), 0 % | 82, 87 (66–97), 0 % |
| Good | 141, 139 (113–163), 6 % | 143, 145 (125–154), 6 % | 104, 102 (73–129), 0 % | 104, 104 (82–120), 0 % |
| Great | 173, 172 (167–179), 88 % | 160, 159 (145–169), 19 % | 120, 122 (97–138), 0 % | 124, 122 (103–139), 0 % |
| Near-perfect | 186, 187 (178–191), 100 % | 184, 183 (173–193), 100 % | 157, 160 (129–176), 50 % | 154, 152 (125–168), 25 % |
| Elite (human limits) | 185, 185 (180–187), 100 % | 184, 188 (172–193), 94 % | 170, 175 (146–185), 75 % | 160, 161 (147–172), 44 % |

The shared tool, `bun scripts/level-tune.ts orbit --level=all --seeds=20` (main's version, raw profiles, checkpoints
every 300 ticks): see the table below it.

| Bot (20 deals a level) | Easy | Normal | Hard | Expert |
|---|---|---|---|---|
| Near-perfect | avg 184.7, median 185, sun 100 % | 183.2, 181, 100 % | 157.1, 155, 45 % | 154.3, 154, 30 % |
| Elite (raw profile) | 190.3, 192, 100 % | 186.6, 191, 95 % | 173.2, 176, 80 % | 162.7, 162, 45 % |

Reading it: a clear step at the top (elite 185 → 184 → 170 → 160, near-perfect 186 → 184 → 157 → 154); Hard and Expert
cut the middle levels hard (great 173 → 160 → 120 → 124). Easy lifts great to 173 and average to 116, but no average
run reaches the sun in 90 s, so the 175 star is out of an average player's reach (great reaches it on about half the
runs): giving the average player a shot needs a longer Easy round (up to 120 s), a run-length change across the stage,
replay and speed part (decision for Joe). Expert "scored well" means 150+ (elite: 13 of 16 deals, 180 the best, the sun
on 7): Expert courses to try (elite with human limits): bank #7 (bank seed 833130779; 172, 180 and 179 on three deals, the
sun each time), #5 (bank seed −1004237067; 170, the sun), #11 (bank seed −1530903713; 165, the sun), and the hardest seen,
#13 (bank seed 307522173; 135) and #22 (bank seed 1120914580; 147). A deal takes bank entry `seed mod 31`.

## orbitRev 17: the lost flight (22 Nov 2026, D5 item H4)

`docs/polish-plan-final/earlier-plan.md` row H4: on orbitRev 14–16 a missed flight burns the whole tank (about 160 ticks at
Normal) with the camera following the rocket into empty space, then grace's 3 s hold: a slip costs about 5.7 s. Rooms,
the Daily and every level now deal **orbitRev 17** (`ORBIT_REV_LOST`, `initLostFrom`): orbitRev 16 exactly (the same
fuel bank `ORBIT_FUEL_BANK` and level banks, the bigger planets, the levels' tanks and checkpoint rules, catches, black
holes, features, grace and the six parts, 200 in all), except that a free flight ends the moment it is **lost**
(`orbitFlightLost` in `orbitRev3.ts`) and takes the slip's usual path: SET CHECKPOINT's respawn if it is armed (or Easy's
automatic one), else grace's 180-tick hold at the planet the flight left. Nothing else changes, so a run whose flights are
never lost plays orbitRev 16 tick for tick; `lost`, `lostTick` and `lostFlights` stay outside the checkpoint checksum, and
the stored extra adds `lostFlights` on orbitRev 17 only.

**Lost, from the sim's own geometry.** A free flight is a straight line: each tick the rocket moves by exactly (vx, vy),
which only a slingshot (leaving a moon's ring) or a black hole can change, and it moves at most `fuel` more times. So the
rest of the flight is a known segment, and the flight is lost when, on that segment:

- no planet but the one it left can catch it (every planet's capture reach, the disc round its whole capture region,
  misses the segment) and no live black hole is on it;
- nothing can still score: no stardust mote not yet taken, no asteroid field not yet threaded, no moon's slingshot ring
  (and the rocket isn't inside one now), and the partial credit toward the next planet (`reach`, sixteenths) would not grow
  by the segment's end;
- and the rocket is **120 px** (`ORBIT_LOST_MARGIN`) past the orbit it left and past every planet ahead (their capture
  reach), so the player sees it fly clear.

Every reach is padded by 4 px (`ORBIT_LOST_PAD`) against integer rounding, so the rule can end a flight later than it
might but never one that could still be caught or still earn a point: ending a lost flight early costs nothing but the
tank it would have burned. Integer maths only.

**Proved** (orbit-lost-check): over every free-flight tick of the 144 recorded runs and of synthetic releases (a release
every 17 ticks from the recorded average and elite runs' orbits; `CHECKS_FULL=1` every 3 ticks from all 144), played on
orbitRev 16's rules, wherever the rule holds the rest of the flight catches nothing and earns nothing: 10,587 flights at
the default depth, 125,071 at full depth, no exception. It ends 94 % of the flights that would run dry (96 % at full
depth) and saves 53–56 % of their flight time: a missed flight now flies about 75 ticks on average instead of 161, so a
slip costs about 4.3 s instead of 5.7 s (the hold is unchanged). What keeps the rest flying: the 120 px margin near a
planet, and flights still drifting along the hop toward the next planet (their partial credit still growing); dropping the
partial-credit test would save 68 % instead of 57 % of the time, at the cost of those sixteenths (not done: the rule never
takes a point). Every bank witness (Normal's 96 and every level's bank) plays on orbitRev 17 exactly as on 16, is never
lost and scores exactly 200 through the server replay, so the banks' proofs carry over unchanged.

**Measured** (`bun scripts/d5-ladder.ts orbit --deals=16 --bots=average,elite,proof`, real deals 0–15 at each level,
graded by the server; orbitRev 16 → orbitRev 17; mean / median, best, share at 200; `fin` = the sun reached):

| Level | Average | Elite (realistic) | Proof (flawless at the limits) |
| --- | --- | --- | --- |
| Easy | 115.9 / 118, best 133 → 118.3 / 118, best 148 | 186.1 / 186, fin 100 % → 186.1 / 186, fin 100 % | 189.9 / 190 → 189.9 / 190 |
| Normal | 107.0 / 98, best 153 → 108.1 / 98, best 153 | 184.2 / 189, fin 94 % → 183.8 / 189, fin 94 % | 189.6 / 192 → 189.7 / 192 |
| Hard | 78.8 / 75 → 79.0 / 75 | 171.8 / 176, fin 88 % → 171.8 / 176, fin 88 % | 180.0 / 178 → 180.0 / 178 |
| Expert | 82.4 / 87 → 82.8 / 87 | 161.9 / 160, fin 44 % → 162.1 / 160, fin 44 % | 165.9 / 167 → 165.9 / 167 |

No run reaches 200 on either stamp. The rule fires about 2.4 times a Normal run for the average player (3.4 on Expert)
and almost never for the elite (0.13; 0.31 on Expert), who rarely misses: the elite's ceiling is its pace and its perfect
orbits, not its slips, so the lost flight is a comfort for the players who miss (a second and a half back each time and
no flight into empty space), not a score lever.

Checks written for orbitRev 16 pin the era `orbitPreLost` (`pinOrbitPreLost`), which deals orbitRev 16 at every level as
rooms did; `orbitPreBig` still deals orbitRev 15. Practice bests start fresh for Orbit (`PRACTICE_STAMPS`). The intro demo
recorded on orbitRev 16 still plays on its own stamp; re-record it on orbitRev 17 (`bun scripts/action-demos-record.ts
orbit`) with `ACTION_DEMO_REVS.orbit` and its stop rule once Joe approves. Display: nothing new is drawn yet; `lostTick`
is there for an effect (a "LOST" moment) when the renderers' owner adds one. The level levers in the difficulty spec
(belts) will need a stamp after this one (orbitRev 18).

orbit-lost-check (~13 s; `CHECKS_FULL=1` ~50 s): the 144 orbitRev 16 runs recorded at every level before this stamp
(`scripts/fixtures/orbit-lost-legacy.json.gz`, `scripts/orbit-lost-legacy-record.ts`) regrade exactly, and the 120
orbitRev 12–15 runs (`orbit-big-legacy.json`); the deals at every level and under both pins; the sweep; the rule on the
sim (a missed release from the first planet: lost after 83 ticks of flight instead of a 159-tick burn, then the hold, or
SET CHECKPOINT's respawn); every bank witness; the recorded runs with no lost flight replaying exactly on 17; the live
stamp, the view and the extra.
