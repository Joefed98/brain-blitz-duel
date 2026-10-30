# Racing on the arcade scoring standard (racingRev 1, 30 Oct 2026)

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
appears under the thumb anywhere below world y 470).

## Sound cues

`racingSounds()`: `racing.go` (first throttle; fallback `arc_horn`), `racing.sector` (`arc_retro_coin`), `racing.lap`
(`arc_fair_bell`), `racing.wall` (`arc_crash`), `racing.grass` (`arc_bounce`), `racing.finish` (`arc_fair_sting`). No
engine loop yet.

## Assumptions and decisions

- Clean sectors: the lap has 4 sectors, so the race has 8 sector passes at 3.75 each, integer `floor(30 × clean ÷ 8)`.
- "Contact" is a wheel past the kerb (grass or gravel) or the tyre wall; the kerbs count as track.
- Every circuit carries two hairpins (the brief's "a hairpin or two"), so all circuits take about as long and one par
  fits them.
- The race starts from a standstill with no lights countdown (the round intro is the countdown).
- The elevation is display only; hills do not change speed.
- Desktop keys: arrows / WASD give full-lock steer and full throttle / brake through the same payloads.
- The intro still is the tile view (`paintRacingTile`) on a fixed 200 px canvas.

## Art that would benefit from proper artwork

The car (a hand-drawn graphite GT rear view), the grandstand and crowd, the trees, the braking boards and the tyre
walls are vector drawings; a painted car sprite (with real sunset reflections and LED detail), photographic hills and
grandstand textures, and proper tree sprites would lift it most. The lens flare and heat haze are simple shapes.
