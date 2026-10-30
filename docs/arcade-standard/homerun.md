# Home Run Derby on the arcade scoring standard (homerunRev 1, 30 Oct 2026)

A new arcade game (`homerun`, the Sports group): ten seeded pitches in 60 s, one about every 6 s, swung at from the
hitter's eye level in a night ballpark. Rooms deal **`homerunRev 1`** (`HOMERUN_REV_STD`); it is born on the standard
(`src/lib/arcade/arcadeStandard.ts`), so there is no older revision.

Files: sim `src/lib/arcade/homerun.ts`, art `src/lib/arcade/homerun.renderer.ts`, server `src/lib/duel/homerun.ts`, deal
`src/lib/duel/homerunDeal.server.ts` (built by `scripts/homerun-deal.ts`), phone `src/puzzles/homerun.tsx`, sounds
`src/lib/fx/homerunSounds.ts`, oracle `scripts/homerun-oracle.ts`, bots `scripts/arcade-skill-bands/bots/homerun.ts`,
bands `scripts/homerun-bands.ts`, check `scripts/homerun-check.ts`, arcade-standard-check entry
`scripts/arcade-standard/homerun.ts`.

## The game

- **The plan** comes from the seed at init (`homerunPlan`, cached): three fastballs, two each of curve, drop and
  changeup, and one more of any kind, shuffled; released every 348 ticks (5.8 s) from tick 96. Each pitch has a seeded
  flight (fastball 40–47 ticks, drop 50–57, curve 52–59, changeup 60–67), a plate point inside the strike zone (one of
  three lanes, any height), a late break (curves across, drops down) and a shown speed. Four signs stand beyond the
  fence at seeded spray angles (four of −30°, −15°, 0°, 15°, 30°, each moved up to ±2°; ±6° wide) and distances
  (415–440 ft): every sign is past the deepest fence (400 ft), so **a sign hit is always a home run**.
- **The swing** (k = 1, `a` contact height in world px, `b` swipe angle in tenths of a degree): the phone records it on
  the tick the finger has moved 12 world px from where it went down, so the swing starts as the finger starts moving,
  not when it lifts. `a` is where the swipe began, `b` its direction (level = centre field, rising = pulled to left
  field, falling = right field). The bat reaches the plate 6 ticks (100 ms) later. One swing a pitch, accepted from the
  pitcher's wind-up (54 ticks before release); a pitch nobody swings at is taken 6 ticks after it reaches the plate.
- **Contact** (`homerunContact`, integer): timing quality by how many ticks the bat is early or late at the plate
  (0…6: 1000, 930, 820, 680, 520, 360, 200; 7 or more misses), height quality 1000 within 4 px of the ball, then 45
  less a pixel; quality = timing × height ÷ 1000, under 100 a miss. Carry = 120 + 350 × quality ÷ 1000 ft (470 ft at
  1000). Spray = three quarters of the swipe angle; a swipe past ±60° (spray past the ±45° foul lines) is foul. A home
  run when the carry passes the fence at that angle (330 ft down the lines, 400 ft to centre, a straight line between).
  A sign is struck when a home run's spray is inside it and its carry reaches its distance (each sign counts once).
- The run ends 150 ticks after the tenth pitch is decided (about 57 s) or at 60 s.

## The parts (200 in all)

| Part | Max | How it pays |
| --- | --- | --- |
| Distance (core) | 130 | `stdLine(130, Σ min(carry, 450), 4,500)`: 13 a pitch, a straight line in feet, full at 450 ft |
| Home runs | 50 | 5 each, up to 10 |
| Sign hits | 20 | 5 for each of the 4 signs struck |

Score = `stdScore(parts, acted > 0)`: 0 with no input, else the sum held to 1…200. Foul balls, misses and taken pitches
carry 0 ft. Features never cost the core: a sign needs a home run, and both come from a well-struck ball.

## Measured targets

The core's full mark (450 ft a pitch) is Joe's; nothing else in the shape needs a measured target (no speed part). The
timing window was widened once from the first draft (0…4 ticks) after measuring: the average level's median was 50.

## Medians, weak → flawless (`bun scripts/homerun-bands.ts`, room seeds 0–59, each run replayed through `replayHomerunRun`)

| Level | Score | Distance (130) | Home runs (50) | Signs (20) | Avg ft a pitch | HR | Signs |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Random | 1 | 0 | 0 | 0 | 0 | 0 | 0 |
| Weak | 46 | 43 | 5 | 0 | 149 | 1 | 0 |
| Average | 71 | 62 | 10 | 0 | 214 | 2 | 0 |
| Good | 114 | 91 | 20 | 5 | 315 | 4 | 1 |
| Great | 163 | 113 | 35 | 20 | 391 | 7 | 4 |
| Near-perfect | 190 | 124 | 45 | 20 | 430 | 9 | 4 |
| Elite | 197 | 127 | 50 | 20 | 440 | 10 | 4 |
| Flawless | 200 | 130 | 50 | 20 | 450 | 10 | 4 |

Fresh seeds (n = 10000–10099): 44 / 76 / 114 / 160 / 191 / 197 / 200.

The bot (`bots/homerun.ts`): timing on the level's sd widened by how hard the pitch is to read (fastball 1.5×, drop
1.8×, curve 2×, changeup 2.2×), never before release + a reaction; height off by the level's pointing error and part of
a curve's or drop's late break; angle off by about 0.9° per px of pointing error; slips mistime a swing by 6–10 ticks.
Weak and average hitters aim straight away, good ones go for a sign half the time, great and better for each sign still
standing. The flawless level is the oracle.

## The deal

`homerunDeal.server.ts`: 300 seeds (a fixed hash of 0, 1, 2, …), each proved by the oracle (`scripts/homerun-oracle.ts`:
every swing on time at the ball's height, four of them at the four signs) to score exactly 200 through the server
replay. **None was dropped**: by construction every pitch can be hit 470 ft and every sign is reachable.
homerun-check re-proves 24 at quick depth and all 300 with `CHECKS_FULL=1`; arcade-standard-check replays the same.

## The look

A fixed 2.5D camera at the hitter's eye: the park (night sky and a few stars, four floodlight banks with bloom and light
beams, two packed tiers of lit fans with an LED ribbon between, the padded outfield wall curving deepest in centre with
its distance markers, yellow foul poles, the seeded signs, warning track, mowed outfield, infield dirt, the mound, the
plate's dirt circle, chalk and plate) is painted once per size and seed (`deviceLayer`); per frame only the pitcher (a
shaded silhouette with a warm rim light and a wind-up), the pitch (its 1 / depth approach and late break), the bat (dark
lacquered ash with a rim light, sweeping flat through the zone at the swipe's height and tilt), the batted ball's flight,
camera flashes in the stands, the call ("HOME RUN", "SIGN HIT!", the distance) and the HUD chips (pitch n/10, HR, signs,
the pitch type and speed). A faint dashed strike-zone box. No instruction text on the play screen.

### Art that would benefit from proper artwork

- The pitcher's wind-up and delivery (a few hand-drawn silhouette frames would read better than the jointed shapes).
- The crowd (a painted crowd texture with depth rather than seeded dots), and the floodlight towers.
- The bat at contact (a motion-blurred barrel sprite), and the signs' faces.

## Decisions for Joe

- **Timing window** (the main difficulty knob): 7 ticks either side of perfect (about 115 ms) before a miss.
- **Swing start**: 12 px of finger travel; the angle is read from those first 12 px (a quick, decisive swipe aims best).
- **Signs**: worded "450 CLUB", "DEEP", "LIGHTS OUT", "JOULZ", "MOONSHOT" (no real brands).
- **Music**: no track of its own yet (borrows High Rise's).
