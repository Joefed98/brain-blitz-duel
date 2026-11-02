# Top Bins (`freekick`) on the arcade scoring standard (freekickRev 1, 30 Oct 2026; freekickRev 2, 31 Oct 2026; freekickRev 3, 1 Nov 2026)

Shown as **Top Bins** since 31 Oct 2026 (was Free Kick; the id `freekick` is unchanged). Rooms deal **freekickRev 3**
(the prepared shot: tap to aim, drag to curl, a power meter; the last section, "freekickRev 3"). The section before it
describes freekickRev 2; everything from here to that section describes freekickRev 1. Every rev-1 and rev-2 round
still replays and scores exactly as before.

A new arcade game (`freekick`, Sports), born on the arcade scoring standard (`src/lib/arcade/arcadeStandard.ts`).
Rooms deal **`freekickRev 1`** (`FREEKICK_REV_STD`, `freekickGame`) on a proved seed from `FREEKICK_DEAL`
(`src/lib/duel/freekickDeal.server.ts`, `freekickDealSeed(roomSeed)`).

Joe's brief: 75 s, 10 kicks. Camera behind the ball; a packed two-tier stadium under roof floodlights; a wall of 3–5;
a keeper; wind; draw the shot through the ball (direction aims, bend curls, speed is power); four targets (top
corners or the bar); core 130, targets 40, curled round the wall 20, five in a row 10.

## The run

- **Ten kicks, dealt at init from the seed** (`fkSeedPlan`): each kick's spot (17.5–25 m out, up to 0.45 × the
  distance across), the wall (3–5 players, 3–4 off-centre, shoulder to shoulder 0.55 m apart, 9.15 m from the ball,
  perpendicular to the line from the ball to the goal's centre, covering the near post plus 0.15–0.5 m outside it),
  the keeper's start (0.3–1.2 m to the far side), the wind (−5…5 across the pitch, the HUD chip), and the four
  targets (four different kicks: two in three a top corner, always the corner behind the wall's end; one in three
  the crossbar).
- **Timing**: a 0.5 s whistle, then the kick can be taken until its deadline (kick k by tick 450k + 270); a flight
  runs up to 110 ticks and the result settles for 70 ticks (~1.2 s) before the next kick. A kick not taken by its
  deadline is a miss and the next kick comes, so all ten always fit in 75 s; a prompt player finishes in ~45 s
  (the run ends after the tenth kick settles).
- **Input**: one event per kick on release (kind 1): `a` aim (−500…500 mrad of launch yaw off the line to the goal's
  centre), `b` curl (−100…100), `c` power (0…1000: launch speed 14–32 m/s and loft 12–22° rise together, so power
  sets how high the ball arrives). The phone (`freekickStrokeKick` in `src/puzzles/freekick.tsx`) measures the stroke:
  it must pass within ~30 px of the ball and go up the screen; `a` is where the stroke's first half points at the
  goal line's height (so a bowed stroke sends the ball out first), `b` the stroke's bow (its widest signed gap from
  the chord ÷ the chord, full at 0.25; the ball bends the way the finger did), `c` the stroke's speed (0.35–3.0 world
  px a ms, measured with `performance.now`). Only the integers are recorded and replayed. No aim line before the
  shot; a short trail after it.
- **Ball flight** (`fkFlightStep`, integer 1/65536 m units): gravity, drag (1/230 a tick), Magnus curl (b × the
  velocity turned a quarter ÷ 16000), wind (6 units a tick² a point), the wall (a box per player, crossing its line;
  jumping 0.18 m on a fixed schedule 6–30 ticks after the kick), the keeper, the posts and crossbar (0.12 m
  cylinders, six sub-steps near the goal, restitution 0.55), the ground (bounce, friction) and the net.
- **The keeper** reacts from the sim's state only: still until 10 ticks after the ball passes the wall's line, then
  moves toward the straight-line prediction of where the ball crosses his line (ignoring curl, wind and gravity),
  at most 5.1 m/s, accelerating 0.48 m/s a tick, within ±3.3 m. He saves anything crossing his line (0.4 m off the
  goal line) inside a reach ellipse 1.06 m across and 1.46 m up from his body centre (1.0 m high). The same flight
  always meets the same dive.

## The parts (200 in all)

| Part | Max | How it pays |
| --- | --- | --- |
| Goals (core) | 130 | per goal 100 units + 0–30 for placement; `stdLine(130, units, 1300)`. Placement: `30 × d ÷ 150` (held to 30), `d` = the distance in cm between where the ball passed the keeper's line and his body centre at that moment, **full at 150 cm** |
| Targets | 40 | 10 for each of the 4 targets: a corner target counts when the goal goes in through its hoop (0.55 m, centred 0.55 m in from the post and bar); the bar target only when the ball goes in off the bar (so a target never costs a goal) |
| Round the wall | 20 | 2 for each goal that bends round the wall (below) |
| Five in a row | 10 | 10 for five consecutive goals at any point |

**Round the wall, precisely** (`fkJudge`): as the ball crosses the wall's line its centre is beside one end of the
wall (outside the span by at least the ball's radius, at any height), and the curl's own displacement across the line
of the kick, integrated from the Magnus acceleration alone (wind excluded) up to where the ball crosses the goal, is at
least `FREEKICK_CURL_MIN` = 0.75 m back toward the wall's side: beside the left end it must have curled right, beside
the right end left. Over the top of the wall does not count.

No speed part. Score = `stdScore(parts, acted > 0)`: 0 with no input, else the sum held to 1…200 (a kick that did
nothing scores 1).

## The deal

`scripts/freekick-oracle.ts` (`oracleRun(seed)`) solves each kick independently: for a set of goal-plane points (the
hoop, the bar's underside, or the corners) and curls, a 2-D Newton search on (aim, power) finds the shot that crosses
there with no wall or keeper, and the real flight judges it; the first shot that scores everything the kick offers
is kept. `scripts/freekick-deal.ts` keeps the first 300 seeds of the roomSeed hash sequence whose oracle run replays
through `replayFreekickRun` to exactly 200: **12 dropped** of 312 (each a kick where the search found no in-off-the-bar
or through-the-hoop goal that was also curled round the wall and placed in full). freekick-check re-proves 24 spread
through the deal (all 300 with `CHECKS_FULL=1`, ~35 s, plus the file's rebuild).

## The placement target

Measured with `bun scripts/freekick-bands.ts --seeds=60` (the bots in
`scripts/arcade-skill-bands/bots/freekick.ts`): the near-perfect level's goals pass the keeper at a median 244 cm
(p25 199 cm); weak players' goals 186 cm (p25 148 cm). Joe's rule is that near-perfect play mostly earns the
placement: at 150 cm almost every near-perfect goal earns the full 3. A higher figure (180 cm) was tried: it made 37 %
of seeds unprovable (the oracle's in-off-the-bar goals pass the keeper closer), so 150 cm was kept. Distances: the
ball's centre where it crosses the keeper's line to his body centre (the reach ellipse means any goal is at least
~1.06 m away).

## Weak → flawless medians (60 dealt seeds, `bun scripts/freekick-bands.ts --seeds=60`)

| Level | Score median (p10–p90) | Goals | Core | Targets | Round the wall | Five in a row | Goal distance cm (p25 / median) | Zeros |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Weak | 23 (1–49) | 1 | 13 | 0 | 0 | 0 | 148 / 186 | 0 |
| Average | 36 (13–62) | 2 | 26 | 0 | 2 | 0 | 164 / 204 | 0 |
| Good | 66 (30–103) | 4 | 52 | 10 | 4 | 0 | 172 / 208 | 0 |
| Great | 102 (69–144) | 6 | 78 | 20 | 8 | 0 | 185 / 232 | 0 |
| Near-perfect | 148 (117–182) | 8 | 104 | 30 | 14 | 10 | 199 / 244 | 0 |
| Elite | 165 (135–199) | 9 | 117 | 30 | 16 | 10 | 203 / 250 | 0 |
| Flawless | 200 (200–200) | 10 | 130 | 40 | 20 | 10 | 205 / 246 | 0 |
| Random strokes | 1 (1–12) | 0 | 0 | 0 | 0 | 0 | 148 / 154 | 0 |

The bots know two shots per kick from the oracle's search (the full shot and the safest goal), go for the full shot
more often as they get better (5 % weak → 97 % elite) and add the level's errors in the stroke's terms: aim (3 mrad a
px of pointing error), power (the level's power error × 1000), curl, a wind misread and slips. Weak and average are
low: power (stroke speed) sets the arrival height, and an average player's 7 % speed error is about ±0.7 m at the goal.

## Assumptions and decisions

- **Placement measured at the keeper's line**, not the goal line: a ball in off the bar slows and the keeper keeps
  moving, so measuring at the goal line punished the bar targets. "The keeper at that moment" is the moment the ball
  beats him.
- **Corner targets sit behind the wall's end** (the classic free kick): a far-side corner (the keeper's side) curled
  round the wall was often impossible, which would have dropped seeds.
- Five in a row is all or nothing (10 at five consecutive goals).
- The wall jumps on a fixed schedule; the keeper reaction, speed and reach are fixed constants; nothing depends on the
  player's earlier kicks.
- The run ends after the tenth kick settles (often well before 75 s).
- **Desktop keys: skipped.** The shot is a drawn stroke whose speed is power, and there is no aim line to steer by;
  a key scheme would need an aim preview the brief rules out. Mouse strokes work on desktop.
- Sounds (`src/lib/fx/freekickSounds.ts`): `freekick.kick`, `freekick.post` (posts and bar), `freekick.save` (the
  keeper; the wall's block reuses it quieter), `freekick.goal`, `freekick.target`, `freekick.net`, falling back to
  `arc_fair_thud`, `arc_clank`, `arc_wood_knock`, `arc_fair_sting`, `arc_fair_bell`, `arc_bounce`.
- **The intro demo needs recording** on freekickRev 1.

## Art that would benefit from proper artwork

All art is drawn in code (`src/lib/arcade/freekick.renderer.ts`): the stadium panorama (roof, floodlight banks,
two-tier crowd as coloured dots, tier fascia), the LED boards, the pitch's mowing stripes and markings, the goal and
net, the referee's foam, the wall players and the keeper as shaded flat silhouettes with a rim light, the ball.
Candidates for real artwork:

- the **players**: the wall (front-facing kit, arms, faces) and especially the **keeper's dive** (a proper sprite
  sequence for set, shuffle, dive left/right, high and low; today one body rotated by his speed);
- the **crowd**: a painted crowd texture (with a few frames of movement on a goal) instead of dots;
- the **stadium roof and floodlight haze**, and the **LED boards** (real ad art, animated on a goal);
- the **ball** (a textured ball with a proper spin read) and the **net ripple** when a goal goes in (today the net is
  static; the ball simply stops at the back);
- a **kicker** (no player is shown taking the kick; the stroke itself is the strike).

## freekickRev 2 (Top Bins, 31 Oct 2026)

Joe's tuning notes. Rooms deal **`freekickRev 2`** (`FREEKICK_REV_DEALT`, `freekickGameV2`) on a proved seed from
`FREEKICK_DEAL_V2` (`src/lib/duel/freekickDealV2.server.ts`, `freekickDealSeedV2(roomSeed)`, built by
`bun scripts/freekick-deal.ts --rev=2`). Rev 1 (`freekickGame`, `FREEKICK_DEAL`) is untouched: stamped-1 and unstamped
rounds replay to the same score, state and checkpoints (freekick-check section 6: 48 runs recorded before the change,
`scripts/fixtures/freekick-rev1-legacy.json` from `scripts/freekick-legacy-record.ts`).

### What changed (gameplay, rev 2 only)

- **No wind.** Every rev-2 kick has wind 0 (the flight's wind term is then nothing); the wind chip is gone and the
  top centre chip names the spot's distance ("26 YDS").
- **Each kick's spot is seeded** (`makeKickV2`): 18–32 yards from the goal's centre (`FK_V2_DIST_MIN…MAX`) at up to
  35° either side of the centre line (`FK_V2_ANGLE_MAX` 611 mrad), placed with the sim's integer sine and cosine.
- **The wall matches the spot**: 4–5 players for a central kick (within 12°) inside 25 yards, 3 from a wide angle
  (25° or more) or beyond 30 yards, otherwise 3–4; it covers the near post as on rev 1 (0.15–0.5 m outside it).
- **The keeper matches the spot**: he starts on the bisector of the angle the posts make at the ball (where it meets
  the goal line, by the angle-bisector theorem), stepped 0.3–1.0 m toward the far post, held to ±3 m.
- The flight, the wall's jump, the keeper's reaction and dive (`fkFlightStep`), the targets and the scoring are rev 1's.
  The keeper is deterministic for the same flight (freekick-check section 8: two copies of one launch step
  identically, he stands still until his reaction tick, a kick taken on any tick flies and is saved the same).

### The parts (unchanged, 200 in all)

| Part | Max | How it pays |
| --- | --- | --- |
| Goals (core) | 130 | 10 a goal + up to 3 for placement (full at 150 cm from the keeper), a straight line on 1,300 units |
| Targets | 40 | 10 for each of the 4 targets |
| Round the wall | 20 | 2 for each goal curled round the wall's end |
| Five in a row | 10 | 10 for five goals in a row |

`FREEKICK_V2_STD_SPEC` is rev 1's spec on stamp 2. Removing the wind leaves every part meaningful (the wind was a
difficulty, not a scored feature). No speed part, so there is no "full by" time; the one measured target is the
placement's 150 cm, kept (the near-perfect level's goals pass the keeper at p25 179 cm, median 219 cm).

### The deal

The oracle (`oracleShots(seed, 2)`) searches the same goal-plane points as rev 1 plus, for rev-2 kicks only, the
tightest corners on both sides (0.2–0.27 m in from the post, 0.18–0.35 m off the ground or 2.05–2.3 m up), which
long and wide spots need for full placement (rev-1 kicks carry no `yards`, so rev 1's search, and its deal file, are
byte for byte as before: `bun scripts/freekick-deal.ts --check`). **51 of 351 seeds were dropped**: a kick the search
could not take to everything (mostly a corner target from close in at 20–35°, curled round the wall into the near
top corner, and a few bar targets from long and wide). The kept 300 still reach both ends of the range.
freekick-check re-proves 24 (all 300 with `CHECKS_FULL=1`, plus the file's rebuild); arcade-standard-check's entry
replays the same on stamp 2.

### Weak → flawless medians (freekickRev 2, `bun scripts/freekick-bands.ts --seeds=60 [--from=10000]`)

Dealt seeds n = 0–59 (tuning):

| Level | Score median (p10–p90) | Goals | Core | Targets | Round the wall | Five in a row | Goal distance cm (p25 / median) | Zeros |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Weak | 13 (1–35) | 1 | 13 | 0 | 0 | 0 | 154 / 213 | 0 |
| Average | 27 (12–63) | 2 | 26 | 0 | 0 | 0 | 157 / 200 | 0 |
| Good | 53 (28–91) | 3 | 39 | 10 | 4 | 0 | 168 / 210 | 0 |
| Great | 79 (50–111) | 5 | 64 | 10 | 6 | 0 | 167 / 218 | 0 |
| Near-perfect | 128 (95–166) | 7 | 90 | 20 | 12 | 0 | 179 / 219 | 0 |
| Elite | 157 (120–197) | 8 | 103 | 30 | 16 | 10 | 178 / 221 | 0 |
| Flawless | 200 (200–200) | 10 | 130 | 40 | 20 | 10 | 172 / 219 | 0 |
| Random strokes | 1 (1–13) | 0 | 0 | 0 | 0 | 0 | 139 / 165 | 0 |

Fresh seeds n = 10000–10059:

| Level | Score median (p10–p90) | Goals | Core | Targets | Round the wall | Five in a row | Goal distance cm (p25 / median) | Zeros |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Weak | 13 (1–38) | 1 | 13 | 0 | 0 | 0 | 164 / 217 | 0 |
| Average | 26 (1–51) | 2 | 25 | 0 | 0 | 0 | 155 / 206 | 0 |
| Good | 53 (28–76) | 3 | 39 | 10 | 4 | 0 | 166 / 206 | 0 |
| Great | 80 (36–118) | 5 | 64 | 10 | 6 | 0 | 167 / 220 | 0 |
| Near-perfect | 130 (94–167) | 7 | 90 | 20 | 12 | 0 | 174 / 221 | 0 |
| Elite | 148 (100–190) | 8 | 103 | 30 | 14 | 10 | 174 / 217 | 0 |
| Flawless | 200 (200–200) | 10 | 130 | 40 | 20 | 10 | 163 / 226 | 0 |
| Random strokes | 1 (1–1) | 0 | 0 | 0 | 0 | 0 | 165 / 166 | 0 |

Rev 2 is harder than rev 1 at every level below flawless (near-perfect 148 → 128 on rev 1's table): the spots reach
32 yards and 35°, where power (the arrival height) and placement are harder, and the keeper has longer to move. The
bots are rev 1's, without the wind misread on rev 2.

### The look (display only; most of it on every revision)

- The referee's foam line under the wall is gone (the foam arc by the ball stays).
- The keeper stands with his hands down while the kick is set, raises them as it is struck (within 12 ticks; the
  ball always takes longer to reach him), then dives from his sim speed, leaning further and stretching his leading
  arm.
- On a goal the crowd jumps (340 seeded fans springing up, arms waving), scarves held overhead and red-and-white flags
  wave, and camera flashes pop round the stands, for the 70-tick settle (`paintFans`; the goal and the pitch stay in
  front).
- **Filling the screen**: the play screen's scenery (`freekickScene`, repainted per kick through `freekickSceneKey`)
  paints the kick's own static layer (the stadium panorama at its yaw, the boards, the pitch, the net) on out to the
  arena box, so the stands and the grass run across the world's edges with no seam: no side bars at 375×667, no
  strip at the bottom at 414×896 (the grass settles a little darker below the world, from nothing at its edge). The
  pitch layer's bottom vignette was dropped so the world's bottom edge meets the scenery cleanly.
- Screenshots: `screenshots/sports-tuning-oct-2026/freekick-*.png` (414×896 and 375×667, mid-run and reveal, from the
  practice screen; `freekick-goal-crowd-render.png` is an offline render of a goal with the crowd up, the world
  plus its scenery at 470 world px wide).

### Assumptions and decisions for Joe (rev 2)

- **Distance is measured from the goal's centre**, the angle from the centre line through the goal.
- **Wall sizes by spot** (central inside 25 yards 4–5, wide or beyond 30 yards 3, else 3–4) are my reading of "set up to
  match each spot".
- **The keeper's dive is rev 1's sim** (a reaction 10 ticks after the ball passes the wall, then a lateral dive at up to
  5.1 m/s); "hands down, then raises" is display only, so the keeper's saves are unchanged for the same flight.
- **Dropped seeds bias the deal slightly** away from close, wide corner targets (see the deal).
- The scenery is repainted on each kick (its camera moves), not every frame.
- **The intro demo needs recording** on freekickRev 2.

## freekickRev 3 (Top Bins, the prepared shot, 1 Nov 2026)

Joe's note: he scored 20–50 on Top Bins; the shot should be about preparing it before taking it. Rooms deal
**`freekickRev 3`** (`FREEKICK_REV_3`, `FREEKICK_REV_DEALT`, `freekickGameV3`) on a proved seed from `FREEKICK_DEAL_V3`
(`src/lib/duel/freekickDealV3.server.ts`, `freekickDealSeedV3(roomSeed)`, built by `bun scripts/freekick-deal.ts
--rev=3`). Rev 1 and rev 2 are untouched: their states, checksums, inputs and 75 s runs are exactly as before
(freekick-check section 10 replays 80 rev-2 runs recorded on main before the change,
`scripts/fixtures/freekick-rev2-legacy.json` from `bun scripts/freekick-legacy-record.ts --rev=2`: the oracle, two
random-stroke runs and the skill-band bot at good and great on 16 deal seeds; section 6 still replays the 48 rev-1 runs).

### The shot, in three steps

1. **Aim: tap the goal.** A white target marker appears on the goal plane where the tap lands (the ray through the
   tapped pixel meets the goal plane, `freekickAimAt`; a tap more than 45 cm outside the frame is ignored). The marker is
   where a clean strike goes.
2. **Curl: drag sideways.** The further, the more bend (0.9 curl units a world px, ±100; the ball bends the way the
   finger went). Dots preview the first stretch of the shot's own flight from the ball to 2.5 m past the wall's line
   (the real solved flight, no wall or keeper), following the finger while it drags.
3. **Power: hold the bar, release in the gold.** Pressing the bar under the ball starts the meter; its needle sweeps
   0 → 1000 → 0 every 96 ticks (1.6 s), a triangle of the ticks since the press alone (`fkV3Meter`), so the replay
   recomputes it from the STRIKE's tick. The gold sweet zone is 720–800 (35–38 ticks after the press, ~0.6 s; four
   ticks, ~67 ms). Released in the zone, the ball flies exactly to the marker with that curl. Past it by e units:
   **too much** adds e × 20 to the launch's rise (`FK_V3_OVER_VY`; about 0.3 m higher at the goal a tick late), so it
   flies over the bar; **too little** scales the whole launch by (1000 − 4e)‰ (`FK_V3_UNDER_PERMILLE`), so the ball comes
   in lower and slower and the keeper has longer. The bar shows CLEAN STRIKE / TOO MUCH / TOO LITTLE with the needle
   frozen where it was released.

Aim and curl can be redone freely until the bar is pressed; after the press they (and a second press) are ignored.
A press before any aim, a release before a press, and anything outside the aim phase do nothing. A kick not struck by
its deadline is a miss, as before.

**The solver** (`fkV3Solve`, in the sim, integer and cached): the launch (rev 1's aim `a` and power `c` mapping, so the
flight physics, the wall, the keeper, the woodwork and the judging are rev 2's) that crosses the goal plane at the
target with the chosen curl, found by alternating integer bisections on a ghost flight (`fkGhostCross`: no wall, no
keeper, no woodwork, no ground, so the height at the goal plane is monotonic in power): power for the height, aim for
the side, up to eight rounds, stopping within 2 cm. ~0.4 ms a solve. A target the curl cannot reach (a huge bend from a
wide spot) gives the nearest shot the search finds; freekick-check proves the oracle's targets are met within 3 cm.
`fkFlightStep` gained a `ground` flag (default on; only the ghost turns it off), so every earlier flight is unchanged.

**Timing**: a 90 s run (`FREEKICK_V3_RUN_TICKS` 5,400; `FREEKICK_TIME_MS` 93 s with the usual 3 s of slack) of ten
540-tick slots: kick k must be struck by tick 540k + 360 (`fkDeadlineFor`), so the first kick has 5.5 s to set and the
deadlines are absolute (a quick kick banks time for the next). Rev 1 and rev 2 runs still end at 75 s.

### Input encoding (rev 3 only)

`FREEKICK_INPUT_RANGES_V3`; earlier revisions have no range for these kinds, so they are never recorded or replayed
there (and rev 3 has no range for kind 1, the old stroke):

| Kind | Name | Fields |
| --- | --- | --- |
| 2 | AIM | `a` target x on the goal plane, cm (−372…372, the posts' centres), `b` height, cm (11…250, up to the bar's centre) |
| 3 | CURL | `b` curl, −100…100 (+ bends right) |
| 4 | POWER | starts the meter on its tick |
| 5 | STRIKE | takes the kick with the meter at `fkV3Meter(tick − POWER's tick)` |

The state carries the prepared shot on rev 3 only (`aimX`, `aimY`, `aimed`, `curl`, `meterAt`, `strikeM`; reset for
each kick) and rev 3's checkpoint checksum adds them (earlier revisions' checksums unchanged).

**Controls**: phone, a tap (under 12 px of movement) on the goal aims, a drag anywhere above the bar curls, a press on
the bar (world y ≥ 626) powers and its release strikes. Mouse: the same as clicks and drags. Keys (computer layout,
`DESKTOP_KEYS`, docs/desktop-support.md): ← → ↑ ↓ move the aim 20 cm (Shift 5 cm; the first press aims at the goal's
centre, 1.2 m up), A / D bend the curl 10 left / right, Space held starts the meter and its release strikes.

### The parts (unchanged, 200 in all)

| Part | Max | How it pays |
| --- | --- | --- |
| Goals (core) | 130 | 10 a goal + up to 3 for placement (full at 150 cm from the keeper), a straight line **full at 1,100 units** (rev 2: 1,300) |
| Targets | 40 | 10 for each of the 4 targets |
| Round the wall | 20 | 2 for each goal curled round the wall's end |
| Five in a row | 10 | 10 for five goals in a row |

`FREEKICK_V3_STD_SPEC` is rev 2's parts (same keys and labels) on stamp 3 with the core's `how` naming its full figure;
`FREEKICK_V3_CORE_FULL` = 1,100: nine placed goals (or ten with some placement) fill the core, so the near-perfect and
elite levels' cores are full and the gap to 200 is the features (a missed target or curl, a broken streak). No speed
part. Score = `stdScore(parts, acted > 0)`.

### The deal

The oracle (`oracleShotsV3(seed)`, `fkPlanKickV3`) searches rev 2's goal-plane points (`aimPoints`) and curls as
prepared shots through the sim's own solver, struck clean (36 ticks after the press, meter 750), and keeps the first
that scores everything the kick offers. The deal keeps the first 300 seeds of the hash sequence whose oracle run
replays through `replayFreekickRun` to exactly 200 (every target, curl and the streak, and a full core: with the core
full at 1,100 one kick's placement may fall short): **70 of the first 370 dropped** (the prepared shot's aim is
quantised to whole cm and the solver's own launch, so a few kicks rev 2's float search could reach are not found).
freekick-check re-proves 24 (all 300 with `CHECKS_FULL=1`, plus the file's rebuild); arcade-standard-check's entry
replays the same on stamp 3.

### The skill bands (`bun scripts/freekick-bands.ts --seeds=60 [--from=10000]`)

The bots (`scripts/arcade-skill-bands/bots/freekick.ts`, `botV3`, rev 3 only; rev 1 and 2 measurements stand) know the
same two plans per kick as prepared shots (the full shot and the safest goal) and go for the full one as often as
before (5 % weak → 97 % elite). Each step gets its own error: the tap off by 0.6 × the level's pointing error at the
goal's on-screen scale (cm a px: 100 × camera distance ÷ 800; 0.6 because the marker shows where the tap landed and a
player re-taps a visible miss) plus a read of where to put it (`AIM_READ` sd: weak 30, average 22, good 14, great 9,
near 6, elite 3 cm; 0.6 of it in height); the curl off by the pointing error (0.9 units a px) plus a read of the bend
(`CURL_READ`: 24 / 17 / 12 / 8 / 4 / 3); the strike off the zone's centre by the level's timing error (65 → 9 ms sd);
slips botch one step (a mis-tap of 60–140 cm, an over-drag of 30–70, a release 3–7 ticks out). Think times before the
tap, the drag and the press are the level's.

Before (freekickRev 2 as dealt today) → after (freekickRev 3), medians (p10–p90), 60 dealt seeds:

| Level | Rev 2, n = 0–59 | **Rev 3, n = 0–59** | Rev 2, n = 10000–10059 | **Rev 3, n = 10000–10059** |
| --- | --- | --- | --- | --- |
| Weak | 13 (1–35) | **40 (15–83)** | 13 (1–38) | **45 (15–81)** |
| Average | 27 (12–63) | **69 (40–114)** | 26 (1–51) | **73 (40–116)** |
| Good | 53 (28–91) | **128 (81–168)** | 53 (28–76) | **119 (75–176)** |
| Great | 79 (50–111) | **164 (122–192)** | 80 (36–118) | **172 (125–194)** |
| Near-perfect | 128 (95–166) | **186 (154–200)** | 130 (94–167) | **186 (158–200)** |
| Elite | 157 (120–197) | **188 (168–200)** | 148 (100–190) | **188 (156–200)** |
| Flawless | 200 (200–200) | **200 (200–200)** | 200 (200–200) | **200 (200–200)** |
| Random | 1 (1–13) | **1 (1–16)** | 1 (1–1) | **1 (1–24)** |

Rev 3 parts at each level (n = 0–59): goals 2 / 4 / 6 / 8 / 9 / 9 / 10, core 30 / 61 / 92 / 122 / 130 / 130 / 130,
targets 0 / 10 / 20 / 20 / 30 / 30 / 40, round the wall 0 / 2 / 6 / 12 / 16 / 18 / 20, five in a row 0 / 0 / 0 / 10 /
10 / 10 / 10; goals pass the keeper at p25 / median 157–177 / 213–233 cm; no zeros at any level.

Tuning steps (n = 0–39 unless said): the first cut (core full at 1,300, the meter's penalties 12 / 6, the bots' full
pointing error and reads 45 → 5 cm) measured good 81, great 121, near-perfect 169, elite 175: the tap was most of the
loss (with the aim error off, good 150). With the re-tap model and smaller reads, the steeper over-power penalty (20)
and the softer under-power one (4): core full at 1,200 gave good 120, great 148, near and elite 184; at 1,100 (kept)
good 123, great 156, near-perfect 186, elite 188 on 60 seeds of the first deal; the deal rebuilt for the 1,100 core
(more seeds prove: a full core no longer needs every goal placed in full) gives the table above.

### Decisions and assumptions for Joe (rev 3)

- **The meter oscillates** (a triangle, 1.6 s a cycle) rather than filling once, so a late press is never stuck at
  full; the sweet zone is fixed (720–800) on every kick. The needle position is purely ticks since the press.
- **Over-power lifts, under-power weakens**, as specified; the strengths (0.3 m a tick late, ~8 % speed a tick early)
  were tuned so a near-miss still often scores and a big miss does not.
- **Run length 90 s** (from 75 s): three steps per kick need the time (5.5 s for the first kick, deadlines absolute).
  Rev 1 and 2 rounds still end at 75 s; the round clock (`FREEKICK_TIME_MS`) is now 93 s for every revision (a stored
  rev-2 round's time column reads on the longer clock, as Apex's did).
- **The aim marker is honest**: a clean strike goes exactly where the marker is, so skill is choosing the spot (away
  from the keeper, round the wall), the bend, and the timing. Wall, keeper and spots are rev 2's.
- The curl preview stops 2.5 m past the wall (a short preview, so it shows whether the bend clears the wall, not where
  the keeper will be beaten).
- **Five in a row and the other features unchanged**; only the core's full figure moved (1,300 → 1,100).
- **The intro demo needs recording** on freekickRev 3 (the intro shows its still, now captioned for the three steps).

### Screenshots

`screenshots/sports-prepare-nov-2026/freekick-414x896-*.png` (practice at 414×896, played through the canvas by
`bun scripts/shots/freekick-prepare-shots.ts --url=<origin> [--hold=640]`): 1 the aim marker after a tap, 2 the curl
preview mid-drag, 3 the power bar held (needle sweeping), 4 the strike's verdict in flight, 5 the reveal. The script's
scripted taps aim naively (no curl, no read of the keeper) and headless timing is loose, so its run scores little;
the shots are of the steps, not of good play.
