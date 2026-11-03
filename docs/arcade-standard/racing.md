# Apex (`racing`) on the arcade scoring standard (racingRev 1, 30 Oct 2026; racingRev 2, 31 Oct 2026; racingRev 3, 3 Nov 2026)

**Apex** (shown as "Racing" until 31 Oct 2026; the id stays `racing`). Rooms deal **`racingRev 3`** since 3 Nov 2026
(see [racingRev 3](#racingrev-3-3-nov-2026-the-cornering) at the end) and racingRev 2 from 31 Oct 2026 (see
[racingRev 2](#racingrev-2-31-oct-2026-the-lights-start-and-the-softer-joystick)); everything up to them describes
racingRev 1, which still replays and scores exactly as before, as racingRev 2 does.

A new arcade game (`racing`): a 90-second, two-lap race on a seeded circuit, seen from a chase camera at sunset,
driven with a one-thumb joystick. Rooms deal **`racingRev 1`** (`RACING_REV_STD`); it is born on the standard
(`src/lib/arcade/arcadeStandard.ts`), so there is no older revision.

Files: sim `src/lib/arcade/racing.ts`, art `src/lib/arcade/racing.renderer.ts`, server `src/lib/duel/racing.ts`, deal
`src/lib/duel/racingDeal.server.ts` (built by `scripts/racing-deal.ts`), phone `src/puzzles/racing.tsx`, sounds
`src/lib/fx/racingSounds.ts`, oracle `scripts/racing-oracle.ts`, bots `scripts/arcade-skill-bands/bots/racing.ts`,
bands `scripts/racing-bands.ts`, check `scripts/racing-check.ts`.

## The game

- **The circuit** is built at init from the seed (`racingTrack`, cached): exactly 1,290 segments a lap
  (`RACING_LAP_SEGS`), each with an integer curvature (positive = a right-hander) and a display-only height. Every lap
  holds the same set of bends in a seeded order, lengths, tightness and directions: two hairpins (curvature 10–11), a
  chicane (7 one way, then 7 the other), three corners (4–6) and two sweepers (1–2), each eased in and out over 6
  segments, with straights between them (the start straight at least 70 segments, the others 34+, the spare shared by
  seeded weights) and gentle hills. The fixed set keeps every circuit about as quick as the others (the par is one
  number). The lap is split into 4 sectors, so the race has 8 sector passes.
- **The car**: speed `v` along the track (top speed 3,072 units a tick = 0.75 of a segment, shown as 300 km/h) and a
  lateral position `x` (±65,536 = the tarmac's edge, positive = right). The joystick is k = 7: `a` steer −100…100,
  `b` throttle (+) / brake (−) −100…100, held until the next event, (0, 0) on release (coast). The phone records an
  event only when the stick's value (steps of 5, small dead zone) changes.
- **Physics (integer)**: the throttle adds 18 × pedal% × (top − v) ÷ top a tick, the brake takes 42 × pedal% a tick,
  coasting 5. Steering moves the car sideways by 3,000 × steer% × v ÷ top a tick. A curve pushes the car outwards by
  3,000 × c × v² ÷ (4 × top²) a tick (speed² × curvature), so full lock balances a curve c at 4 × top ÷ c; past that
  speed the tyres let go and the car also slides outwards by 6 × the excess a tick. The kerb is track (to 73,728);
  once the car's outer wheel passes it (`|x| > RACING_CLEAN_X`, the car's half width 16,384) the car is on the grass
  or gravel: above 1,075 it loses 1/22 of its speed a tick (at least 18) and the throttle cannot raise it past that;
  the tyre wall's face (131,072) stops the car sideways and costs a quarter of its speed on impact, 1/32 a tick while
  scraping. Contact costs time only, never points directly.
- The race ends on the tick the second lap is completed (`finishTick`) or at the buzzer (5,400 ticks).

## The parts (200 in all)

| Part | Max | How it pays |
| --- | --- | --- |
| Distance (core) | 140 | `stdLine(140, distance, two laps)`: a straight line in distance, full at two complete laps |
| Clean sectors | 30 | `floor(30 × clean ÷ 8)`: a sector is clean when driven through with no grass or wall contact |
| Finish | 10 | for completing both laps |
| Speed | 20 | on a finish only: `stdSpeed(20, finishTick, 4,850, 5,400)`, full by 80.8 s, 0 at the buzzer |

Score = `stdScore(parts, acted > 0)`: 0 with no input, else the sum held to 1…200. A sector not reached (or not yet
completed) is not clean.

## Measured targets

`bun scripts/racing-bands.ts` (every level on room seeds 0–59, the dealt circuit `racingDealSeed(roomSeed(n))`, each
run replayed through `replayRacingRun`). **Par `RACING_PAR_TICKS` = 4,850** = the near-perfect level's median finish
tick (80.8 s). The core's full figure is fixed (two laps), so there is no other target.

### Room seeds 0–59 (score median, p10–p90; part medians)

| Level | Score | Distance | Clean sectors | Finish | Speed | Finished | Finish time (finishers) | Zeros |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Weak | 131 (123–136) | 117 | 15 | 0 | 0 | 0/60 | – | 0 |
| Average | 155 (148–160) | 132 | 22 | 0 | 0 | 2/60 | 88.0 s | 0 |
| Good | 182 (165–189) | 140 | 26 | 10 | 6 | 49/60 | 86.6 s | 0 |
| Great | 192.5 (186–197) | 140 | 30 | 10 | 13 | 60/60 | 83.7 s | 0 |
| Near-perfect | 198 (191–200) | 140 | 30 | 10 | 19.5 | 60/60 | 80.8 s | 0 |
| Elite | 200 (196–200) | 140 | 30 | 10 | 20 | 60/60 | 80.1 s | 0 |
| Flawless | 200 (200–200) | 140 | 30 | 10 | 20 | 60/60 | 77.5 s | 0 |
| Random | 18 (13–23) | 18 | 0 | 0 | 0 | 0/60 | – | 0 |

### Fresh room seeds 10000–10099

| Level | Score | Finished | Finish time |
| --- | --- | --- | --- |
| Weak | 131 (124–136) | 0/100 | – |
| Average | 154 (146–161) | 2/100 | 88.7 s |
| Good | 181 (172–190) | 91/100 | 87.3 s |
| Great | 191 (184–196) | 100/100 | 84.0 s |
| Near-perfect | 197 (192–200) | 100/100 | 81.6 s |
| Elite | 200 (196–200) | 100/100 | 80.3 s |
| Flawless | 200 (200–200) | 100/100 | 77.8 s |

Medians rise weak < average < good < great < near < elite ≤ flawless = 200. The lower levels sit fairly high because
the core is distance: even a weak driver covers most of two laps in 90 s; they are separated by clean sectors, the
finish and speed.

## The deal

`scripts/racing-deal.ts` walks a fixed candidate sequence (a hash of 0, 1, 2 …) and keeps a seed only when the oracle
(`scripts/racing-oracle.ts`: a speed profile at 99.5 % of each segment's balance speed with braking zones at 99 % of
full braking, and a lateral controller holding the centre one tick ahead) replays through the server path to exactly
200, unflagged: both laps, all 8 sectors clean, home by par. **300 kept, 4 of the first 304 dropped** (1.3 %: their
oracle finish fell just past par). `racingDealSeed(roomSeed) = RACING_DEAL[roomSeed mod 300]`.
`bun scripts/racing-deal.ts --check` proves the written list; racing-check replays 24 entries (all 300 with
`CHECKS_FULL=1`).

## Bots

`scripts/arcade-skill-bands/bots/racing.ts`: the oracle's controller driven through a Human: decisions read the car as
it was a tracking lag ago, the thumb moves every 2–7 ticks with aim error, the stick is held at the level's resolution
(5–20 units), every corner on each lap is taken at a share of its limit drawn around the level's (0.66 weak … 0.94
elite) with a spread, and a slip (the level's mistake rate × 4 per corner) takes one 6–20 % too fast, which slides the
car onto the kerb or the grass. Flawless = the oracle. `randomBot` throws the stick somewhere new about every half
second.

## Ghosts (display only)

Other players in a room appear as translucent cars with name tags (`setRacingGhosts`, fed from
`src/lib/duel/raceGhosts.ts`'s `useRaceGhosts`; the stage publishes its own car with `publishRaceGhost(s, x)` from the
sound observer's frame). Units: `s` = race distance (4,096 a segment, 0 … `RACING_TOTAL`, lap 2 continuing past one
lap), `x` = lateral (±65,536 the tarmac's edge). No collisions, no points; nothing reaches the sim.

## Look

Pseudo-3D segment projection (`racing.renderer.ts`): a chase camera 1,714 units behind and above the car, the road's
curve offsets and hills accumulated per segment and zeroed at the car's depth (the camera follows the car sideways
exactly, so the drawn car — exactly 2 × `RACING_CAR_HALF` wide at its depth — crosses the kerb's outer edge on the tick
the sim calls it off track), road surfaces batched one path per colour front to back with a crest clip, roadside
sprites back to front. Cached per size: the sunset sky, two hill layers scrolling with the heading, three tree
variants, a grandstand section with its crowd, the car (plain and braking). Per frame: the sun with rays when the car
faces it and a light lens flare, red-and-white kerbs through the bends, white track-limit lines on the straights, a
darker racing line, skid marks in the braking zones, 150/100/50 braking boards, gravel traps on the outside of every
bend, tyre walls with red and white belts, catch fencing along the grandstand, the chequered start line, the car's
LED bar and rain light (blinking on the grass), brake bloom and heat haze. HUD: LAP n/2 and the race time at the top,
speed bottom left, the 8 sector bars bottom right (gold clean, red touched), the joystick bottom centre (its base
appears under the thumb anywhere below world y 477 since 31 Oct 2026, 250 above the world's bottom; 470 before).

## Sound cues

`racingSounds()`: `racing.go` (first throttle; fallback `arc_horn`), `racing.sector` (`arc_retro_coin`), `racing.lap`
(`arc_fair_bell`), `racing.wall` (`arc_crash`), `racing.grass` (`arc_bounce`), `racing.finish` (`arc_fair_sting`). No
engine loop yet.

## Assumptions and decisions

- Clean sectors: the lap has 4 sectors, so the race has 8 sector passes at 3.75 each, integer `floor(30 × clean ÷ 8)`.
- "Contact" is a wheel past the kerb (grass or gravel) or the tyre wall; the kerbs count as track.
- Every circuit carries two hairpins (the brief's "a hairpin or two"), so all circuits take about as long and one par
  fits them.
- The race starts from a standstill with no lights countdown (the round intro is the countdown). racingRev 2 adds
  the F1 lights (below).
- The elevation is display only; hills do not change speed.
- Desktop keys: arrows / WASD give full-lock steer and full throttle / brake through the same payloads.
- The intro still is the tile view (`paintRacingTile`) on a fixed 200 px canvas.

## Art that would benefit from proper artwork

The car (a hand-drawn graphite GT rear view), the grandstand and crowd, the trees, the braking boards and the tyre
walls are vector drawings; a painted car sprite (with real sunset reflections and LED detail), photographic hills and
grandstand textures, and proper tree sprites would lift it most. The lens flare and heat haze are simple shapes.

## racingRev 2 (31 Oct 2026): the lights start and the softer joystick

Joe's notes after his iPhone 11 tests. The parts and their maximums are unchanged (distance 140, clean sectors 30,
finish 10, speed 20 = 200); the circuit, the physics and the scoring lines are racingRev 1's. Rooms and practice deal
`RACING_REV_DEALT` = 2 from its own proved deal (`src/lib/duel/racingDealV2.server.ts`); racingRev 1 rounds (and the
first deal, `racingDeal.server.ts`, byte-identical) replay exactly as before (racing-check's legacy section replays 36
runs recorded on main b154694: `scripts/fixtures/racing-v1-legacy.json.gz`, `scripts/racing-legacy-record.ts`).

### The start (sim, racingRev 2 only)

- The car sits on its grid box at the start line. Light k (1…5) comes on at tick 30 + 60 × (k − 1)
  (`RACING_V2_LIGHT0`, `RACING_V2_LIGHT_GAP`): one a second, with a large 5-4-3-2-1 over the scene; all five go out at
  tick 330 (`RACING_V2_GO`) and "GO" shows for a second. The sim tick runs throughout (the HUD timer and the round
  clock move), but until lights out the car cannot move whatever is held: the held stick is stored and inputs count
  as played (a run that only touched the stick during the lights scores 1), the wheels turn, and the throttle held
  through the lights leaves on the first tick after (`racingStep` returns before the physics while `tick <= GO`).
- The race clock (the HUD's time chip, the reveal's time and the speed part) runs from lights out
  (`racingRaceTicks`, `RESULT.raceTicks`); the race still lasts at most 90 s, so the whole run is 5.5 s longer
  (`RACING_V2_RUN_TICKS` = 5,730). The round's clock is 99 s (`RACING_TIME_MS`: the lights, the race and the usual
  3 s of slack; racingRev 1 runs still end at their own 90 s, as Tempo's and Gemstone's older rounds do).
- Sounds: `racing.light` as each light comes on (fallback `countdown_step`), `racing.go` on lights out
  (racingRev 1: the first throttle, as before).

### The joystick (less sensitive)

- **Sim (stamped):** the stick's steer goes through a dead zone of ±10 (`RACING_V2_DEAD`), then an expo curve
  (`racingV2SteerTarget`: u = the stick past the dead zone on 0…100, target = (u² + 100u) ÷ 200: half the gain at
  mid-stick, the same full lock at the end), and the front wheels (`state.wheel`, in the rev-2 checksum) move towards
  that target at most 8 a tick (`RACING_V2_WHEEL_RATE`: centre to full lock in about 0.2 s, lock to lock 0.4 s). The
  car steers by the wheels, not the raw stick. Full lock's authority is unchanged, so every bend balances at the same
  speed as on racingRev 1. Throttle and brake are unchanged.
- **Phone (input mapping):** full lock needs 64 world px of thumb travel across (`RACING_V2_STEER_R`; racingRev 1: 46),
  sent in steps of 5 with no dead zone of its own (the sim's applies); the throttle and brake keep 46 px and their
  small dead zone. The joystick's base is drawn wider than tall to match, with the dead zone shaded faintly.
- Keys: arrows / WASD send full lock, which the wheels reach at the smoothing rate.

### The look (display only, every revision)

- **The car turns:** as it yaws into a turn the rear face narrows and moves into the turn while the flank on the
  outside comes into view (`drawFlank`: the graphite side with the side window, the sunset along the shoulder, the
  rear tyre's wall and the front wheel at the far end turned with the steer), up to 30 % of the car's width at full
  lock and speed. The whole stays exactly the collision width (rule 3): the flank takes the width the rear face gives
  up. On racingRev 2 it follows the smoothed wheel; racingRev 1 shows the stick.
- **No dead strip, no side strips:** the world is 390 × 727 (was 720; the arena box's aspect at 414 × 896 with the
  iPhone's insets). Beyond the world's box the play screen shows the world's own view carried on: `racingAmbient` (the
  slot's moving layer, under the world canvas) draws `drawWorld` over the whole screen (sky mirrored past the edges, the
  hills, the road with its lines, kerbs and racing line, the grass, trees, tyre walls, grandstands and the start
  furniture; no car or HUD), and every world frame repaints it (`drawRacingPlay` → `repaintBeyond`), so it never lags
  the world at 60 Hz and the road runs to the screen's bottom and sides with no seam. It is the world's view, not a
  decorative fill, so it moves when the world does (also under reduced motion). `racingScene` is only the first paint
  (sky, fields, tarmac). The HUD panels keep their own light backing; nothing fades to black. The stick's touch area
  and resting place moved down with the world's bottom.
- racingRev 2 draws the grid box round the car and a five-light gantry over the road ahead (it recedes as the car
  leaves).

### The deal

`bun scripts/racing-deal.ts --rev=2` (the same candidate sequence and oracle, on racingRev 2: the oracle holds the
throttle through the lights and sends the stick whose expo target is the steer it wants, `racingV2StickFor`): **300
kept, 4 of the first 304 dropped** (the same four as racingRev 1: their oracle finish falls just past par).
`racingDealSeedV2(roomSeed) = RACING_DEAL_V2[roomSeed mod 300]`; `--rev=2 --check` proves the list. racing-check
replays 24 (all 300 with `CHECKS_FULL=1`) to exactly 200 through `replayRacingRun(…, 2)`; arcade-standard-check's
racing entry does the same.

### Measured targets (`bun scripts/racing-bands.ts`, racingRev 2)

**Par `RACING_V2_PAR_TICKS` = 4,854** race ticks from lights out (80.9 s): the near-perfect median below. The bots
steer through the same mapping (the stick for the wheel steer they want, aim error over the longer throw) and put the
throttle down a reaction time after lights out; the flawless level is the oracle.

Room seeds 0–59 (dealt seeds; score median, p10–p90; part medians; race time from lights out):

| Level | Score | Distance | Clean sectors | Finish | Speed | Finished | Race time (finishers) | Zeros |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Weak | 128 (122–134) | 116.5 | 11 | 0 | 0 | 0/60 | – | 0 |
| Average | 152 (146–157) | 131 | 20 | 0 | 0 | 2/60 | 88.1 s | 0 |
| Good | 179.5 (164–185) | 140 | 26 | 10 | 5 | 49/60 | 87.2 s | 0 |
| Great | 191.5 (185–196) | 140 | 30 | 10 | 13 | 60/60 | 83.9 s | 0 |
| Near-perfect | 198 (192–200) | 140 | 30 | 10 | 20 | 60/60 | 80.9 s | 0 |
| Elite | 200 (196–200) | 140 | 30 | 10 | 20 | 60/60 | 80.0 s | 0 |
| Flawless | 200 (200–200) | 140 | 30 | 10 | 20 | 60/60 | 77.5 s | 0 |
| Random | 19 (13–23) | 19 | 0 | 0 | 0 | 0/60 | – | 0 |

Room seeds 10000–10099 (dealt seeds):

| Level | Score | Finished | Race time |
| --- | --- | --- | --- |
| Weak | 129 (123–135) | 0/100 | – |
| Average | 150.5 (144–158) | 2/100 | 89.4 s |
| Good | 178.5 (164–185) | 87/100 | 87.6 s |
| Great | 190 (183–196) | 100/100 | 84.1 s |
| Near-perfect | 197 (192–200) | 100/100 | 81.5 s |
| Elite | 200 (196–200) | 100/100 | 80.5 s |
| Flawless | 200 (200–200) | 100/100 | 77.8 s |

The softer stick costs the lower levels a little (weak 131 → 128, average 155 → 152, good 182 → 179.5 on seeds 0–59:
the smoothing makes late corrections later, so a few more sectors are touched); great and above are unchanged, and the
par moves by 3.5 ticks.

### Decisions for Joe

- **Light timing:** the first light half a second after the run starts, one a second, out one second after the fifth
  (fixed, no random hold as in real F1: every player sees the same start). Jumping the start is impossible rather than
  penalised (the car simply cannot move).
- **Steering feel:** dead zone ±10 of 100, expo halving mid-stick gain, wheels at 8 a tick, 64 px for full lock. Each
  is one constant (sim stamped; the 64 px is the phone's).
- **The round clock** grows from 93 s to 99 s for every Apex round (rooms' timers); racingRev 1's runs keep 90 s.

## racingRev 3 (3 Nov 2026): the cornering

Joe's iPhone 11 video: on lap 2's first sharp corner he braked from 271 to about 184 km/h with the stick at full lock
and still ran wide onto the gravel, while gentler bends were fine at 170–210 at full lock; the only cue was the distance
boards; the gravel dropped him to about 100 km/h with a slow climb back; the car looked lopsided when turning; the
joystick covered the car. Rooms and practice deal `RACING_REV_DEALT` = 3 from its own proved deal
(`src/lib/duel/racingDealV3.server.ts`); racingRev 1 and 2 rounds replay and score exactly as before (racing-check
replays 36 racingRev 2 runs recorded on main 6326101, `scripts/fixtures/racing-v2-legacy.json.gz`,
`bun scripts/racing-legacy-record.ts --rev=2`, as well as racingRev 1's 36).

### Step 1: the cornering, measured (racingRev 2's physics, which racingRev 3 keeps)

- **Steering rate against speed:** full lock moves the car sideways 3,000 × v ÷ 3,072 units a tick (`racingSteerMove`):
  proportional to speed, so the heading it gives (sideways ÷ forward) is the same at every speed (0.977 at full lock:
  599 units a tick at 60 km/h, 1,500 at 150, 2,000 at 200, 3,000 at 300). Steering is **not** turned down at speed.
- **The curve's push** is 3,000 × c × v² ÷ (4 × 3,072²) a tick (`racingPush`: speed² × curvature), so full lock
  balances a bend of curvature c at 4 × top ÷ c (`racingBalanceSpeed`); past that the tyres let go and the car also
  slides out by 6 × the excess a tick. Because the push grows with speed² and the slide is steep, a corner's limit is a
  cliff: at 184 km/h a curvature-10 hairpin pushes the car out 4,917 units a tick net of full lock, so it leaves the
  tarmac from the centre line in 12 ticks (0.2 s); curvature 11 in 10 ticks.
- **Each corner's fastest full-lock speed** (`racingCornerLimit`: held at a steady speed from the centre line, steering
  just enough to hold the line and at most full lock, through the corner's real eased curvature, no wheel past the kerb;
  the same integer push and steer as the sim). Every circuit has the same set of bends; over racingRev 2's 300 dealt
  circuits:

  | Bend | Count | Full-lock balance | Fastest from the centre, median (min–max) | Length (segments) |
  | --- | --- | --- | --- | --- |
  | Hairpin, curvature 11 | 321 | 109 km/h | 119 (118–121) km/h | 30–37 |
  | Hairpin, curvature 10 | 279 | 120 km/h | 131 (129–133) km/h | 30–37 |
  | Corner, curvature 6 | 290 | 200 km/h | 212 (209–218) km/h | 34–55 |
  | Chicane, curvature 7 each way | 300 | 171 km/h | 217 (214–235) km/h | 34–41 |
  | Corner, curvature 5 | 311 | 240 km/h | 254 (251–261) km/h | 34–55 |
  | Corner, curvature 4; sweepers 1–2 | 899 | 300 km/h | flat out | 34–109 |

  The chicane's halves are short and the push swaps sides halfway, so the car drifts out and back: it goes well above
  its balance speed.
- **Verdict: by design, not a bug.** The code does what its comments and this page say (steering proportional to speed,
  the push to speed² × curvature, "so the tight corners need braking"). Joe's sharp corner fits a hairpin (110–130 km/h):
  at 184 km/h he was about 50 % over its limit, while his gentler bends (curvature 5–6, 210–260 km/h) held at 170–210.
  What was missing is a cue for how fast: the boards only say where to brake. A note for the stick: through the dead zone
  and expo (racingRev 2), three quarters of the steering throw gives a little over half the lock; full lock needs the thumb
  at the edge of the ring. So the steering is unchanged; racingRev 3 adds the signs, softens the gravel and re-fits the score.

### The changes (sim and score stamped; the look and the stick on every revision)

- **Advisory corner speed signs** (racingRev 3, display): before every corner slower than flat out (hairpins, the
  chicane, the curvature-5 and 6 corners) a round sign, white with a red ring and the speed in km/h, stands on the
  corner's outside 34 segments before its turn-in, ahead of the 150 / 100 / 50 boards (`racingCornerAdvice`, cached per
  circuit; the sign is the corner's `racingCornerLimit` rounded down to 10 km/h, `racingSignKmh`, so a car at the sign's
  speed holds the corner from the centre with full lock: racing-check drives every sign through the sim's step). On the
  rev-3 deal: hairpins 110–130, corners 200–260, chicanes 210–230.
- **Softer gravel** (racingRev 3, sim): on leaving the tarmac the car's speed is noted (`offFrom`); it slows at the same
  rate as before (1/22 a tick) but only to 65 % of that (`RACING_V3_OFF_KEEP`; never below racingRev 1's 105 km/h cap
  or the speed itself, `racingV3OffFloor`), where the throttle holds it (it cannot raise it); off the throttle the gravel
  drags as before. Back on the tarmac the throttle pulls twice as hard (`RACING_V3_RECOVER_MUL`) until the speed the car
  left at is regained (`rec`). Both fields are in the rev-3 checksum. From 271 km/h: 176 km/h on the gravel (racingRev 2:
  105).
- **The car turning** (display, every revision): the flank, side window and visible front wheel are gone; the car is one
  shape turned slightly into the turn about its centre (`RACING_CAR_TURN_MAX` 0.087 rad, about 5°, at full yaw), so it
  stays symmetrical, drawn about 5 % smaller at full yaw so the turned body is exactly the collision width
  (`racingCarTurnFit`, rule 3) and lifted so its lowest corner stays on the contact line.
- **The joystick** (display, every revision): a faint ring (no dark disc) and a 12 px knob (was 19), drawn where the thumb
  went down but never higher than 4 px clear of the car with the knob at full throttle (`RACING_STICK_DRAW_MIN_Y` 632) nor
  lower than 6 px above the world's bottom (`RACING_STICK_DRAW_MAX_Y` 675; the world ends above the home bar's strip), so
  it never covers the car or the road ahead. The thumb's mapping is unchanged (the touch area, the 64 px steering throw,
  the 46 px pedal throw): the drawn ring moves down, the thumb does not have to.

### The score (racingRev 3): pace and clean sectors

| Part | Max | How it pays |
| --- | --- | --- |
| Pace (core) | 160 | `stdLine(160, pace − 152.0 km/h, 69.5 km/h)`: the race's average speed on a straight line, 0 at 152 km/h, full at 221.5 km/h (`RACING_V3_PACE_ZERO` / `_FULL`, tenths of a km/h) |
| Clean sectors | 40 | 5 each of 8 sectors with no grass or wall contact |

The pace (`racingPace10`) is a finish's two laps over its race time from lights out, or the distance covered over the
whole 90 s. No finish or speed part: a finish is simply a higher pace. No input 0, any played run 1+.

**Core target.** The brief's targets (weak 30–60, average about 90, good 120–140, great about 160, near-perfect about 175,
elite 185–195, flawless 200) put the near-perfect level well under 200, so the core is not full at the near-perfect median
(the standard's usual rule, as the brief changes it) but at 221.5 km/h, a pace the oracle reaches on about 40 % of
candidate circuits; the deal keeps only circuits it does (`bun scripts/racing-deal.ts --rev=3`: 300 kept, 349 of the
first 649 dropped), so a perfect run is 200 on every dealt circuit through the server replay. The zero (152 km/h) and the
split (160 + 40) are the best straight-line fit to the targets over the bands below.

### Measured (`bun scripts/racing-bands.ts`, racingRev 3; dealt seeds; score median (p10–p90))

Room seeds 0–59, racingRev 2 → racingRev 3:

| Level | racingRev 2 | racingRev 3 | Pace | Clean sectors | Average km/h | Finished | Race time |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Weak | 128 | 38 (21–52) | 19 | 15 | 160.5 | 0/60 | – |
| Average | 152 | 97 (82–110) | 70.5 | 30 | 182.8 | 2/60 | 88.3 s |
| Good | 179.5 | 142 (131–154) | 109.5 | 35 | 199.7 | 58/60 | 86.0 s |
| Great | 191.5 | 165 (154–177) | 126.5 | 40 | 207.2 | 60/60 | 83.0 s |
| Near-perfect | 198 | 181.5 (176–191) | 142 | 40 | 213.9 | 60/60 | 80.4 s |
| Elite | 200 | 188.5 (181–200) | 149 | 40 | 216.9 | 60/60 | 79.3 s |
| Flawless | 200 | 200 (200–200) | 160 | 40 | 223.4 | 60/60 | 77.0 s |
| Random | 19 | 1 (1–1) | 0 | 0 | 27.5 | 0/60 | – |

Fresh room seeds 10000–10099 (racingRev 3): weak 37 (23–54), average 98.5 (85–112), good 144 (133–152), great 167
(157–176), near-perfect 183 (175–193), elite 190 (183–200), flawless 200 (200–200), random 1.

Medians rise weak < average < good < great < near < elite < flawless with gaps of 59, 45, 23, 16.5, 7 and 11.5.
**Misses against the brief:** near-perfect sits at 181.5–183 (target about 175) and good at 142–144 (target 120–140):
the near-perfect and elite bots drive within 3 km/h of each other here (corner shares 0.92 and 0.94), so no straight line
holds near-perfect at 175 and elite at 185+; the fit keeps elite in its range. The bots do not read the signs (each
level's corner judgement is its own share of the limit), so the bands measure the gravel and the score alone; a player
who uses the signs should drive nearer the top levels.

### The deal and the proofs

`bun scripts/racing-deal.ts --rev=3 [--check]`; racing-check sections 13–16 (racingRev 2's legacy runs, the rev-3 deal
and its oracle 200s, the gravel, the recovery and the signs, the parts and the replay); arcade-standard-check's racing
entry (rev 3: the pace line in tenths of a km/h, 5 a clean sector, perfect runs at 200 through the server replay);
racing-render-check draws racingRev 3 frames too; self-replay entry `racing/v3`; one racingRev 3 run appended to
`scripts/fixtures/replay-runs.json`. Screenshots: `screenshots/apex-cornering-nov-2026/`.

### Decisions for Joe

- The sign shows the corner's limit **from the centre line at a steady speed**, rounded down to 10 km/h; a driver on the
  outside line can go a little faster, one who arrives off-line slower. 300 km/h corners (flat out) get no sign.
- The gravel keeps 65 % (the brief's 60–70 %) and the recovery pulls twice as hard; both one constant.
- The score has no finish or speed part (the pace is the speed); the help says "Pace up to 160, Clean sectors up to 40".
