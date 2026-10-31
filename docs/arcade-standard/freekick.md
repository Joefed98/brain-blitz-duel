# Top Bins (`freekick`) on the arcade scoring standard (freekickRev 1, 30 Oct 2026; freekickRev 2, 31 Oct 2026)

Shown as **Top Bins** since 31 Oct 2026 (was Free Kick; the id `freekick` is unchanged). Rooms deal **freekickRev 2**
(below, "freekickRev 2"); everything from here to that section describes freekickRev 1, which every rev-1 round
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
