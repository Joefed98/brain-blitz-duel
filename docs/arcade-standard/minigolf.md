# Minigolf, shown as Crazy Golf (`minigolf`, `golfRev` 2; `golfRev` 1 replays)

Rooms deal **golfRev 2** (crazy golf, 31 Oct 2026; the section "golfRev 2" below). Everything from "Play" to "Proofs"
describes golfRev 1, which still replays and scores exactly as before.

The Sports group (30 Oct 2026). Five holes in 120 s on a night garden terrace, top down. Pull back from the ball to aim
and set the power (a dotted aim line and a power pill); let go to putt. Sim `src/lib/arcade/minigolf.ts`, art
`minigolf.renderer.ts`, stage `src/puzzles/minigolf.tsx`, server plumbing `src/lib/duel/minigolf.ts` on the shared
Sports kit (`src/lib/arcade/sportsKit.ts`: integer ball physics, the run's wire format, the one server replay).

## Play

- Five holes from templates, each bigger and longer than the last (30 Oct 2026, the longer course): a long lane up a
  ramp through a boulder field (300 × 520 px), a long dogleg round a pond (340 × 580), a three-leg S-bend (370 × 620),
  two routes round an island pond split by timber walls, a ramp one way and boulders the other (390 × 660), and a
  three-leg switchback finale between two timber walls with two ponds (390 × 690). The seed mirrors each hole and
  nudges its banks, boulders, ponds and cup; the walls are fixed. Nothing random happens after the deal.
- Diagonal timber banks, boulders, bushes in stone planters guarding every cup, ponds, uphill ramps and cross-slopes
  (dark at the bottom, light at the crest, a bright crest edge, fading arrows pointing uphill).
- The hardest putt carries about 300 px (8 px a tick at most), so the holes take several shots.
- 6 strokes a hole (golfRev 2: par + 3); after the last the hole ends with closeness credit. Water: +1 stroke, the ball back where it was
  played. A ball drops when its centre is inside the cup and it is moving no faster than 3.2 px a tick.
- Par per hole = the best route the putt search (`scripts/minigolf-oracle.ts`, a beam search to 4 putts) found + 1, so
  a birdie is always possible. Rooms deal a course from the bank (`src/lib/duel/minigolfBank.server.ts`, 60 courses
  of 60 candidates, built by `bun scripts/minigolf-bank.ts --jobs=4`, about 20 min); the pars ride in the puzzle.
  Pars are **3 4 4 4 5** on 42 courses and **4 4 4 4 5** on 18 (par 19–20).

## Parts (together 200)

| Part | Max | How |
| --- | --- | --- |
| Holes (core) | 120 | 24 a hole holed; an unfinished hole up to 20 on a straight line from the tee's distance (0) to the cup (20) |
| Par | 40 | 8 a hole at par or better, falling evenly to 0 at the stroke limit (6) |
| Under par | 20 | 4 a hole under par |
| Speed | 20 | all five holed: full by **50 s**, 0 at the buzzer (120 s) |

Any putt scores at least 1; no input 0.

## Measured

Speed's full-by time is the near-perfect level's median finish (49.9 s over the runs that holed all five; 30 bank
courses, the skill-band bot), rounded.

| Level | Median (p10–p90) | Holes holed (median) | All five holed in time | Median finish |
| --- | --- | --- | --- | --- |
| Weak | 123 (103–139) | 3 | 0/30 | – |
| Average | 127 (103–143) | 4 | 1/30 | 94.4 s |
| Good | 139 (122–166) | 4 | 6/30 | 70.3 s |
| Great | 151 (134–182) | 4 | 14/30 | 60.1 s |
| Near-perfect | 154 (142–180) | 4 | 11/30 | 49.9 s |
| Elite | 179 (154–188) | 5 | 23/30 | 44.4 s |
| Flawless | 196 (188–196) | 5 | 30/30 | 33.0 s |

Weak and average players now struggle on the later holes (the finale's switchback and the island hole run them to the
stroke limit). The flawless bot's planner reaches 196; the oracle's witness on every course scores exactly 200.

**For Joe:** the near-perfect round takes about 50 s, a little under the 60–75 s aimed at: the bot thinks for about
0.6 s a putt. The near-perfect bot also often runs out of strokes on the par-5 finale, so it holes all five only 11
times in 30 (great 14); longer holes would push both further.

## Proofs

minigolf-check (every bank witness scores 200 through the server replay and birdies every hole; the courses, the
rules, determinism and input repair), arcade-standard-check's entry, arcade-self-replay's `minigolf` entry.

## golfRev 2: crazy golf (31 Oct 2026)

Joe's notes: a harder putt, the classic crazy-golf obstacles, raised ramps. Every change is gated on the stored
`golfRev` (the state's `rev`): `minigolfGameFor(pars, rev)` and `replayMinigolfRun(seed, raw, pars, rev)` take the
puzzle's stamp (unstamped is golfRev 1); golfRev 2's holes come from `minigolfCourseV2` (its own templates,
`TEMPLATES_V2`) and roll through `mgRollTickV2`; golfRev 1's `minigolfCourse` and `mgRollTick` are untouched
(minigolf-check pins digests of golfRev 1's 60 courses and of its witnesses' and cut-down runs' replays, recorded on
main 9dc6e56).

- **Power:** the hardest putt is 9.6 px a tick (`MG_MAX_V_V2`, golfRev 1: 8), about 356 px on the flat.
- **Windmills** (`MgWindmill`, holes 1 and 5): a brick house across the fairway with an 84 px doorway. Its four sails
  turn upright in the wall's plane, a quarter turn every 64 ticks (`MG_MILL_SPIN` 256 angle units a tick, the starting
  angle seeded at the deal, the angle from the sim tick with integer trig). A sail touches the ground only while it is
  within 39° of straight down; its foot (16 px wide, 6 px thick) then sweeps along the doorway at 28·tan(angle) px from
  its centre (`mgSails`), pushing the ball with its own speed. So each point of the doorway is shut part of each 64-tick
  cycle and open the rest: time the putt (a straight full putt up hole 1 gets through at about 40–70 % of moments,
  minigolf-check). A ball that comes to rest in the doorway's line is set down 11 px clear on its own side
  (`mgApron`). The art draws the sails as a see-through cross 28 px beyond the wall, its lower sail meeting the line
  exactly at the foot, which is drawn solid on the sim's capsule.
- **Tunnels** (`MgTunnel`): rolling over an entrance (the ball's centre within 9 px) the ball comes out of its exit
  heading the exit's way with 7/8 of its speed (at least 1.5 px a tick). Entrance and exit share a colour ring; the exit
  shows chevrons. Hole 3 has one (in a nook behind a timber wall, out to the top leg); hole 4 has two to different
  places.
- **Sand traps:** much stronger friction (`MG_SAND_DRAG` 520/4096 and 24 a tick, against 96 and 6).
- **Hills:** a dome; the push grows from nothing at the top to its rim strength (10 units a tick²), away from the top.
- **Banked curved walls:** arcs of 8 short capsules (holes 2 and 5 round the top-left corner), drawn as a striped kerb.
- **Castle gates:** a stone wall across the hole with one 40 px archway (hole 4's right lane, hole 5's upper wall).
- **Ramps** keep golfRev 1's pull and are drawn raised (both revisions; art only): a lit deck from a shaded toe to a
  bright crest lip with a cast shadow, boards closing up towards the toe, bold chevrons uphill, and the course's rail
  drawn taller from toe to crest where the ramp runs along it (off the fairway).

Obstacles per hole (gates, tunnels, bunkers, hills, curves): 1 (windmill), 2 (curve, bunker; plus a pond), 2 (tunnel,
hill), 4 (two tunnels, castle gate, bunker), 5 (windmill, castle gate, hill, bunker, curve). The kinds, sizes, the
stroke limit, water and the scoring parts are golfRev 1's.

**The proof.** The putt search rolls golfRev 2 on the sim's clock: a hole is searched from the tick its first putt
can be played (the previous hole's drop + the 50-tick pause + 1); a putt that meets a sail is also tried after each
of 7 waits (every 8 ticks of the 64-tick cycle), and a route's putts carry their wait (`Putt.w`). Tunnels count in the
search's walking distance. The witness plays each putt its wait after the ball comes to rest (`playRoutes`), and must
score exactly 200 through the server's replay. `bun scripts/minigolf-bank.ts --rev=2 --jobs=4` (~50 min) writes
`src/lib/duel/minigolfBankV2.server.ts` (`MINIGOLF_BANK_V2`) and `scripts/fixtures/minigolf-witness-v2.json`; `--check`
rebuilds byte for byte. **60 courses of 60 candidates** (none dropped); pars **3 4 4 3 5** on 41, **3 4 4 4 5** on 18,
**3 3 4 3 5** on 1 (par 19–20); the witnesses finish in 21–24 s.

**Stroke limit (31 Oct 2026, still golfRev 2: not yet dealt in a live room).** golfRev 2's limit is **par + 3 a hole**
(`mgStrokeLimit(rev, par)`: 6, 7 or 8 on its par 3, 4 and 5 holes; golfRev 1 keeps the flat six), so the par-5 finale
leaves as much room as a par 3. Reaching it ends the hole with closeness credit as before, and par points fall evenly
from par to the limit (three strokes on every hole). The flat six cut the near-perfect bot off on the finale, which is
why near-perfect (148) sat below great (167) and flawless below elite. The bank was re-proved under the new limit:
`bun scripts/minigolf-bank.ts --rev=2 --jobs=4 --check` rebuilds all 60 courses byte for byte, every witness 200
through the server replay (a witness never reaches a limit: pars are its strokes + 1).

**Speed** is full by **53 s** on golfRev 2 (`MINIGOLF_FULL_BY_S`; golfRev 1 keeps 50, `minigolfFullByS(rev)`): the
near-perfect level's median finish over the runs that holed all five (52.9 s, 28 of 30). (Under the flat six it was
51 s, from 13 of 30.)

| Level | Median (p10–p90) | Holes holed (median) | All five holed | Median finish |
| --- | --- | --- | --- | --- |
| Weak | 129 (114–139) | 4 | 1/30 | 108.3 s |
| Average | 141 (124–158) | 4 | 9/30 | 90.3 s |
| Good | 159 (138–168) | 5 | 21/30 | 75.6 s |
| Great | 175.5 (160–183) | 5 | 27/30 | 59.4 s |
| Near-perfect | 177.5 (165–185) | 5 | 28/30 | 52.9 s |
| Elite | 185 (178–192) | 5 | 30/30 | 45.3 s |
| Flawless | 196 (190–196) | 5 | 30/30 | 32.5 s |

(`bun scripts/arcade-skill-bands.ts minigolf --levels=all --rev=now --seeds=30`, 30 golfRev 2 bank courses, Speed at
the 53 s full-by.) The bot reads each putt for the moment it will be played and waits for the sails' gap with its
level's timing error. Its competence fix (`fixes`, the band tool only; checks play the old bot): when the best lay-up
leaves the ball where it is, it looks one putt ahead. That's the ramp under hole 5's castle gate, where every way
out is further at first, and the bot used to nudge the ball against the slope until the hole was cut off. The flawless
bot's greedy planner reaches 196; the oracle's witnesses reach 200 on every course.

Proofs: minigolf-check (golfRev 2's bank, witnesses, courses and rules, and golfRev 1 unchanged),
arcade-standard-check's entry (both banks' witnesses at 200).
