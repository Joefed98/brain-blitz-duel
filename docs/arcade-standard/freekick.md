# Free Kick on the arcade scoring standard (freekickRev 1, 30 Oct 2026)

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
