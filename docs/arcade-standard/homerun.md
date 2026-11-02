# Home Run on the arcade scoring standard (homerunRev 1, 30 Oct 2026; homerunRev 2, 31 Oct 2026; homerunRev 3, 1 Nov 2026)

Shown as **Home Run** since 31 Oct 2026 (was Home Run Derby; the id `homerun` is unchanged). Rooms deal
**homerunRev 3** since 1 Nov 2026 (section "homerunRev 3" at the end; rev 2 was dealt on 31 Oct 2026, section
"homerunRev 2"); everything above them describes rev 1, which every later rule keeps unless its section says otherwise.

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

## homerunRev 2 (31 Oct 2026, the Sports tuning batch)

Rooms deal **`homerunRev 2`** (`HOMERUN_REV_DEALT`) from its own proved deal, `src/lib/duel/homerunDealV2.server.ts`
(`bun scripts/homerun-deal.ts --rev=2`; 300 seeds, each the oracle's run scoring exactly 200 on rev 2 through the server
replay, 0 dropped). Rev-1 rounds replay and score exactly as before: `homerunGameFor(1)` is the old game and
homerun-check replays 54 rev-1 runs recorded on main b154694 (`scripts/fixtures/homerun-rev1-legacy.json`, written by
`scripts/homerun-rev2-legacy.ts`: every skill-band level, random swipes, edge swings) to the same score, final checksum
and end tick. The rev-1 deal file is unchanged byte for byte.

### What changes (gameplay, gated on the stamp)

- **Finer aim.** The spray is 9/16 of the swipe angle (rev 1 three quarters) and fair to ±80° of swipe (rev 1 ±60°):
  the same aiming error moves the ball a quarter less, and pull / centre / opposite field each take a wider band of
  swipe. A sign (±6° wide) now needs the swipe within about ±10.7° of its angle (rev 1 ±8°).
- **A longer chord.** The phone starts the swing after 18 px of finger travel (rev 1 12 px), so the swipe's angle is
  read over a longer stroke (`homerunSwingStartPx`).
- Unchanged: the plan (pitches, timing, plate points, signs), contact quality, carry, the fence, the parts and their
  maximums, the run's length.

### What changes (display only, every revision)

- **The camera** is behind the plate, just over the batter's right shoulder; the whole batter is drawn (helmet, body,
  hands and the bat) as a jointed 3-D figure through the same camera as the field. The strike zone and every pitch's
  plate point are the sim's own world px, unchanged.
- **The swing** is a full animation: load, the bat laid flat behind, the barrel whipped through the zone, follow-through
  and finish, then back to the stance. It starts on the sim's swing tick and the bat's sweet spot reaches the plate on
  the contact tick at the swipe's height (tilted out in front for a pull, deeper for the opposite field), so an early
  or late swing visibly passes before or after the ball, and a miss swings through empty air.
- **Reading the pitch:** nothing names the pitch before it is thrown (the old "DROP 85" chip is gone). The radar board
  in the upper deck lights with the pitch type and its speed once the pitch is decided, for about 3 s.
- **After every swing:** EARLY / PERFECT / LATE (with the milliseconds off) and a small timing meter under the call, and
  over the zone the bat's line at the swipe's height against a ring where the ball crossed (gold within the 4 px sweet
  band).
- **The park:** a denser, varied crowd (caps, standing fans) on two tiers with the LED ribbon, floodlight banks along the
  roof, the outfield in mowed bands, the infield's dirt arc, grass diamond, mound and base-path cut-outs, the plate's
  dirt with chalk boxes; after a home run the crowd jumps with arms up under a storm of camera flashes.
- **No dead strip, no side bars:** the static park is painted out to any extent and the play screen's scenery
  (`homerunScene`) is that same park carried on beyond the world, so the box fills edge to edge at 414×896 and 375×667
  with no seam.

### The parts (unchanged, 200 in all)

Distance 130 (straight line, full at 450 ft a pitch) + Home runs 50 (5 each) + Sign hits 20 (5 a sign) = 200
(`HOMERUN_STD_SPEC_V2`, rev 1's parts with `rev: 2`). No speed part, so there is no full-by time; the only fixed
target is the core's 450 ft a pitch.

### Medians, weak → flawless (`bun scripts/homerun-bands.ts`, rev 2's deal for room seeds 0–59, server replay)

The bots read the pitch from the hand and flight alone on rev 2 (timing spread a fifth wider on every kind, a fifth
less of the late break read) and aim through the 9/16 mapping with the same pointing error in degrees of swipe.

| Level | Score | Distance (130) | Home runs (50) | Signs (20) | Avg ft a pitch | HR | Signs |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Random | 1 | 0 | 0 | 0 | 0 | 0 | 0 |
| Weak | 42 | 34 | 5 | 0 | 121 | 1 | 0 |
| Average | 65 | 55 | 5 | 0 | 191 | 1 | 0 |
| Good | 105 | 84 | 15 | 5 | 290 | 3 | 1 |
| Great | 154 | 109 | 30 | 15 | 377 | 6 | 3 |
| Near-perfect | 186 | 122 | 45 | 20 | 422 | 9 | 4 |
| Elite | 195 | 126 | 50 | 20 | 437 | 10 | 4 |
| Flawless | 200 | 130 | 50 | 20 | 450 | 10 | 4 |

Fresh seeds (n = 10000–10099, rev 2): 38 / 67 / 105 / 148 / 187 / 195 / 200. Rev 1 on the same tool (for comparison):
46 / 71 / 114 / 163 / 190 / 197 / 200. Hiding the pitch costs the middle levels 5–10 points; the finer aim gives a
little back at the top.

### Review shots

`bun scripts/shots/homerun-tuning-shots.ts --url=<dev origin>` (a near-perfect bot's run warped in at its ninth swing,
`src/lib/arcade/devWarp.ts`, development only; the grade request carries that run): `screenshots/sports-tuning-oct-2026/
homerun-<414x896|375x667>-<midrun|reveal>.png`, plus `homerun-swing-frames.png` (the swing frame by frame, drawn
offline by `scripts/shots/homerun-swing-frames.ts`).

### Decisions for Joe

- The aim ratio (9/16) and the 18 px chord: a steadier aim at the cost of a swing that starts a few milliseconds later
  in the stroke.
- The timing word calls only an exact tick PERFECT; one tick (17 ms) either side already reads EARLY / LATE.
- The radar board reads out after the pitch is decided, not as it crosses (it would otherwise tell a late swinger).

## homerunRev 3 (1 Nov 2026, "prepare the shot")

Joe scored 20–50 on rev 2: every pitch was one hard swing on a 7-tick window, read from the flight alone. Rev 3 makes
each pitch about preparing the swing before taking it. Rooms deal **`homerunRev 3`** (`HOMERUN_REV_3`,
`HOMERUN_REV_DEALT`) from its own proved deal, `src/lib/duel/homerunDealV3.server.ts` (`bun scripts/homerun-deal.ts
--rev=3`; 300 seeds, each the oracle's run scoring exactly 200 on rev 3 through the server replay, 0 dropped; the same
seed list as rev 2's, since the plan is unchanged and every seed proves). Rev-1 and rev-2 rounds replay and score exactly
as before: homerun-check replays the 54 rev-1 runs and 54 rev-2 runs recorded on main ae1efbe
(`scripts/fixtures/homerun-rev2-legacy.json`, written by `scripts/homerun-rev3-legacy.ts`: every skill-band level,
random swipes, edge swings, three of them carrying kind-2 events that rev 2 ignores and its server drops) to the same
score, final checksum and end tick. The rev-1 and rev-2 deal files are unchanged byte for byte.

### What changes (gameplay, gated on the stamp)

- **The swing choice** (`HOMERUN_INPUT_MODE`, k = 2, `a` = 0 Contact / 1 Power; rev 3's own input ranges,
  `HOMERUN_INPUT_RANGES_V3`, so rev 1 and 2 never declare it). Two 48 px buttons over the bottom of the field, below the plate
  (`data-game-controls="swing"`, the stage's arena overlay; 1 Nov 2026 follow-up: lifted by the home bar, so the row ends
  at least 12 px above `env(safe-area-inset-bottom)`, and the world reaches the bottom of the play screen), C / 1 and P / 2
  on a computer. Follow-up (2 Nov 2026, display only): the stage's view runs `HOMERUN_V3_VIEW_ROWS` (60) field rows
  below the 720-row world (`homerunViewHFor`; the park and the success layer cover them in the world's own coordinates),
  so the batter and the plate sit clear above the row: its top is 24 px below the plate's lowest drawn row at 375×667,
  54 px at 414×896 and 18 px on the iPhone 11 home-screen app (the world is drawn about 7 % smaller at 375×667 and on the
  home-screen app, 1 % at 414×896). The sim's world, the timing windows, the scoring and the inputs are unchanged: the
  view's top 720 rows are the world's own, a touch that starts in the rows below starts no swing, and a drag below them
  reads as the world's bottom row, as it did at the canvas's edge. The row fades out (150 ms) from the pitch's release
  until it is decided and comes back for the next pitch (the choice is locked on the release tick); it stays up and
  tappable through the wind-up and the tell. A choice is recorded on the sim tick it is made and stands until changed (Contact to
  start); each pitch is played with the choice standing at its release (`pmode`, locked on the release tick), so a press
  after the release waits for the next pitch. The HUD chip shows NEXT CONTACT / NEXT POWER until the release, then
  CONTACT / POWER; the lit button is the sim's own choice. A choice counts as playing (at least 1).
- **The pitcher's tell** (display only; the plan is rev 1's): for the last 24 ticks (0.4 s) of the wind-up
  (`HOMERUN_TELL_TICKS`) the pitcher holds his arm in the pitch's slot (fastball high over the top, curve and drop
  between, changeup low), his hand and glove flash the pitch's colour, and a grip bubble beside him shows the ball in his
  fingers, ringed in that colour: **fastball red**, two fingers across the top; **curve blue**, fingers hooked along a
  seam; **drop purple**, two fingers split wide; **changeup green**, a circle grip (`paintTellBubble`, 52 world px across,
  clear of the pitch's path). The radar board still reads type and speed after the pitch.
- **Each pitch kind's timing** (`homerunPerfectOffset`, `HOMERUN_V3_PERFECT`): the perfect contact tick against the
  ball's arrival is fastball −1 (meet it out front), curve +1, drop +1, changeup +2 (wait on it). Early / Perfect / Late
  is called against that tick. Timing quality falls on a straight line from 1000 at the perfect tick to 0 at the window's
  edge (`HOMERUN_V3_WINDOW`, tenths of a tick: Contact 10.0 / 12.5 / 12.0 / 13.5 ticks, Power 5.2 / 6.4 / 6.0 / 6.8 for
  fastball / curve / drop / changeup; the fastball tightest on either swing).
- **Contact vs Power** (`HOMERUN_V3_SWEET`, `HOMERUN_V3_HEIGHT_LOSS`, `HOMERUN_V3_FEET_BASE` / `_SPAN`):

  | Swing | Timing window | Height sweet band | Loss a px past it | Carry at quality q | Reaches |
  | --- | --- | --- | --- | --- | --- |
  | Contact | wide (10–13.5 ticks) | ±8 px | 20 | 124 + 290 q (≤ 414 ft) | home runs down the lines on a square hit, never a sign |
  | Power | narrow (5.2–6.8 ticks) | ±4 px | 35 | 100 + 380 q (≤ 480 ft) | home runs anywhere, every sign |

  Quality = timing × height ÷ 1000; under 100 is a miss. Aim, the fence, foul lines and signs are rev 2's.
- Unchanged: the plan (pitches, flights, plate points, breaks, signs), the aim (9/16 of the swipe, fair to ±80°), the
  18 px chord, the run's length, the parts.

### The parts (200 in all, `HOMERUN_STD_SPEC_V3`)

| Part | Max | How it pays |
| --- | --- | --- |
| Distance (core) | 130 | `stdLine(130, Σ min(carry, 460), 4,600)`: 13 a pitch, full at **460 ft** (rev 1–2: 450) |
| Home runs | 50 | 5 each, up to 10 |
| Sign hits | 20 | 5 for each of the 4 signs struck (Power only) |

A perfect run (the oracle: Power on every pitch, each met on its kind's perfect tick at the ball's height, four aimed at
the signs) carries 480 ft every pitch: 130 + 50 + 20 = 200. 460 ft needs a Power swing met within about a tick and the
sweet band, so the core's top is earned at elite precision.

### Medians, rev 2 as dealt → rev 3 (`bun scripts/homerun-bands.ts [--rev=2]`, room seeds 0–59, server replay)

| Level | Rev 2 | Rev 3 | Distance (130) | Home runs (50) | Signs (20) | Avg ft a pitch | HR | Signs |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Random | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 0 |
| Weak | 42 | 73 | 69 | 5 | 0 | 245 | 1 | 0 |
| Average | 65 | 92 | 88 | 5 | 0 | 314 | 1 | 0 |
| Good | 105 | 128 | 99 | 28 | 0 | 353 | 6 | 0 |
| Great | 154 | 159 | 110 | 35 | 10 | 389 | 7 | 2 |
| Near-perfect | 186 | 187 | 121 | 45 | 20 | 431 | 9 | 4 |
| Elite | 195 | 193 | 123 | 50 | 20 | 439 | 10 | 4 |
| Flawless | 200 | 200 | 130 | 50 | 20 | 460 | 10 | 4 |

Fresh seeds (n = 10000–10099), rev 2 → rev 3: weak 38 → 70, average 67 → 91, good 105 → 128, great 148 → 154,
near 187 → 187, elite 195 → 193, flawless 200 → 200; random 1 on both.

The rev-3 bot (`botV3` in `bots/homerun.ts`; rev 1 and 2 measure as before): before each pitch it chooses the swing
(Power with chance weak 0, average 0.1, good 0.3, great 0.85, near-perfect and elite 1), pressing the button 30–90 ticks
before the release when the choice changes. It reads the tell with chance weak 0.55, average 0.7, good 0.85, great
0.93, near 0.97, elite 0.99: read, it times the kind's perfect tick with the level's timing sd × 1.0 (fastball) to 1.2
(changeup) and judges a little more of the break; misread, it times the arrival from the flight alone (rev 2's spread).
Height and angle errors are rev 2's. With Power it goes for the signs (great and better always, good half the time);
a good or better hitter on Contact pulls the ball 25–35° down a line, where the fence is shortest; weak and average
hitters aim straight away.

What moved: Contact's wide window and sweet band lift the lower half (weak and average by about 25–30, good by 23 into
the 120–140 band), Power is still where home runs, signs and the full core come from, so the top stays the top: great
about 160, elite 193, and only flawless play reaches 200. The near-perfect / elite / flawless gaps are about rev 2's
(the features saturate at near-perfect: 9–10 home runs and all four signs).

### Review shots

`screenshots/sports-prepare-nov-2026/`: `homerun-tells.png` (the four tells 6 ticks before the release, with 3×
close-ups, drawn offline by `bun scripts/shots/homerun-tell-frames.ts`), and the play screen at 414×896,
`homerun-414x896-<choose|tell|swing|call|reveal>.png` (`bun scripts/shots/homerun-prepare-shots.ts --url=<dev origin>
[--burst]`: an elite bot's run warped in on the practice example's seed; the reveal grades only the part played after the
warp, so its score is low).

### Decisions for Joe

- **The tell's colours and grips** (red fastball, blue curve, purple drop, green changeup) are learned from the help;
  colour alone is never the only cue (the grip shape differs on each), but it is the quickest read.
- **The perfect ticks** (fastball 17 ms early, changeup 33 ms late) are small: the windows matter more than the offsets.
- **Contact's carry** (≤ 414 ft) keeps the signs Power-only; Contact can still homer down the lines on a square hit.
- **Weak and average rise most** (73 and 92): Contact is the easy way in. If that is too generous, narrow Contact's
  window before touching Power.
