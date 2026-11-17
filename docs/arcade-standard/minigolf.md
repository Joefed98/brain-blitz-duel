# Minigolf, shown as Crazy Golf (`minigolf`, `golfRev` 3; `golfRev` 1 and 2 replay)

Rooms deal **golfRev 3** (the Crazy Golf overhaul, 15 Nov 2026; the section "golfRev 3" at the top). golfRev 2 (crazy
golf, 31 Oct 2026; its section below) and golfRev 1 (everything from "Play" to "Proofs") still replay and score
exactly as before.

## golfRev 3: the overhaul (15 Nov 2026)

The phase 2 step 4 overhaul (docs/design/game-reviews/sports.md, Crazy Golf). Gated on the stamp and on the puzzle's
`holes`; golfRev 1 and 2 are untouched (minigolf-check and minigolf-sync-check pass unchanged on them).

**Holes from a bank.** `src/lib/arcade/minigolfHolesV3.ts` holds twenty hole templates, four for each of the course's
five slots (an opening lane, a dogleg family, a tricky middle, then two holes on uneven ground), and every variant of
each: which of three tees, which of three cups, mirrored or not (18 a template, 360 in all). A hole is one integer id
(`template × 100 + variant`) built from the id and the level alone, never the room seed, so a hole proven once is the
same in any course. `scripts/minigolf-holes-bank.ts` searches every hole with the shot oracle (`bestRouteV3` in
`scripts/minigolf-oracle.ts`: putts and chips on the sim's clock) at each windmill speed the levels use, and keeps a
hole whose route has par (strokes + 1) from 2 to 5 at every speed: **all 360 holes are kept** (72 a slot). The bank
(`src/lib/duel/minigolfHolesBank.server.ts`) lists them by slot with their pars per level; the witness routes are in
`scripts/fixtures/minigolf-holes-witness.json`. The deal (`generateMinigolf` in `sports.server.ts`) draws one hole
from each slot and stores `holes`, `pars` (at the level) and `level` (only off Normal), so a room's players all play
the same five; about 72⁵ ≈ 1.9 billion courses. Any five composed (each first shot waiting for the sails' repeat to line
up with the tick its route was proved from, `playCourseV3`) score exactly 200 through the server's replay at every
level, all five under par (crazy-golf-v3-check: 600 courses).

**Every layout is crazy golf** (Joe, 15 Nov 2026): windmills, castle gates, tunnels, ramps, loop-the-loops, bridges over
water, bowls round the cup, domes and banked curves, at least two on every template and placed in the line of play
(crazy-golf-v3-check counts them). Three pieces are new:

- **Loop-the-loops** (`MgLoop`): two ends and tall rails closing the lane between them. A ball within `MG_LOOP_R` (10 px)
  of an end, moving into the loop at `MG_LOOP_MIN_V` (4.2 px a tick) or faster, comes out of the other end heading on with
  13/16 of its speed; slower, it stalls and rolls back out at half speed. A loop works both ways.
- **Bridges** (`MgBridge`): a deck box with no water on it and low timber rails along its long sides (a chip flies over
  them).
- **Bowls**: a hollow round the cup (a swell with k −10 to −14, at every level and slot) that gathers a ball in.

**Big features** (round 3, Joe, 16 Nov 2026: "most holes are a big green with two small features"): every template now
has at least three of the big ones in play (windmills, castles, tunnels, ramps, loops, bridges, banked curves;
crazy-golf-v3-check counts them), and the buildings are solid in the sim, so what is drawn is what the ball meets:

- **Windmills** stand a house either side of the doorway (`MgGate.boxes`: two blocks `V3_HOUSE_W` 30 px wide and
  `V3_HOUSE_D` 60 px deep behind the wall's line, their outlines tall segments), the ball rolling through the passage
  between them, and turn long, broad sails: the hub `V3_MILL_H` 50 px above the doorway (golfRev 2's 28) and the sails
  `V3_SAIL_W` 22 px wide (`MgWindmill.h` / `sw`; golfRev 1 and 2 keep `MG_MILL_H` and `MG_SAIL_W`), so each sail's foot
  sweeps the doorway at 50·tan φ.
- **Castles**: a curtain wall `V3_CASTLE_R` 9 px thick with battlements, a round tower `V3_TOWER_R` 17 px either side of the
  gate (`MgHole.towers`, the last entries of `planters`, so the sim meets them as planters; a chip meets them too), the
  gatehouse's arch over the opening (overhead), and, on most castles, a keep: a solid box `V3_KEEP_W` × `V3_KEEP_D`
  (60 × 50 px) on the wall with a flag.
- **Tunnels** have stone portals round their mouths, **ramps** a deck lit from the crest down to a shaded toe with red and
  white kerbs (no arrows), and **loops** stand up from the lane as a loop of track (far half behind, near half lit).

**Bunkers and ponds are smooth shapes** (Joe, 15 Nov 2026: "never clusters of circles"): each is the level set of a field
over its circles, Σ (r²/d²)² (`mgMetaSum`, integer, 4096ths). A lone circle is exactly its circle and overlapping ones
melt into one outline; the fourth power keeps a ring of circles from flooding its middle, so an island green stays an
island. A ball is in a bunker at a sum of 1, and in water at 6/5 (about 2 px inside the drawn edge of a 40 px pond), except
on a bridge's deck. The art samples the same field at the canvas's own resolution and draws through its masks, so what
is drawn is exactly the shape that plays: a raked bunker in a bevelled turf lip, glossy water in a bevelled stone ring.

**The chip** (input kind 2, `MG_INPUT_CHIP`; chosen on the Putt | Chip switch under the course, or C on a keyboard):
the same pull-back, but the ball is lofted. It carries `MG_CHIP_MIN_PX`–`MG_CHIP_MAX_PX` (40–180 px) by power over
`MG_CHIP_MIN_T`–`MG_CHIP_MAX_T` (20–42) ticks (`mgChipLaunch`). In the air (`mgRollTickV3`) it meets only the tall
things: the fence, the castle gates and windmill houses (and their sails), the banked curved walls and the planters; it
flies over water, sand, low timber walls, boulders, hills, ramps, tunnels and the cup. On its last air tick it lands:
keeping `MG_CHIP_LAND_KEEP`/256 (80/256) of its speed and rolling on, stopped dead in a bunker, or in the water (a
stroke added, the ball back where it was played, as a putt). Integer throughout, one function for the sim and every
search, so phone and server step the same flight (minigolf-sync-check).

**Uneven ground** (the last two slots): swells, broad mounds (k > 0) and hollows (k < 0) pushing a rolling ball
4·|k|·d(r − d)/r² units a tick² away from or towards their centre (nothing at the centre or the rim; |k| 9–12). A
resting ball stays put; a rolling one bends (a straight roll across the Rolling green drifts about 9 px). On the
ground only: a chip flies over them.

**The look** (display only): the slopes, hills and swells read through light and shadow alone (no arrows): a height
field from the sim's own pieces (`groundHeight`, `src/lib/arcade/minigolfV3Ground.renderer.ts`) lit from the top left,
and the mowing stripes laid on the ground so they bend over it. Captain Joulz stands beside the ball (top-down sprites
from the approved 3D Captain, `docs/design/cosmetics-redraws/blender/captain/golf_sprites.py`, round 3: lit by a key, a
front fill and a cool rim so he reads at 120 px; addressing the ball, the backswing (putter or wedge) once the pull
passes 15 % of full power, then the follow-through after a putt or a chip), always to the side of the line. The HUD's chips are 14 px.

**Moments** (display, sound, haptics): aiming stretches a rubber band from the ball to the finger with a soft tone rising
with power; a putt's "tock" and a faint speed trail; a chip's "click", the ball lifted over its shadow and a ring where
it lands; a white flash on a rail; a ball over the cup's lip rattles and wobbles; holed, the ball drops as the flag
lifts, with confetti on a birdie or better; water a splash ring and a "plip"; sand a puff. Haptics on the strike
(tick), a hole (success) and water (impact). New recordings: `docs/sound-cues/crazy-golf-elevenlabs.md`.

**Levels** (`MG_LEVELS`; the puzzle's `level`, Normal when absent; rated play and the Daily deal Normal). All 90 s.

| | Easy | Normal | Hard | Expert |
|---|---|---|---|---|
| Par | best route + 2 | best route + 2 | the best route | the best route |
| Under par (4 a hole) | under par | under par | in par | in par |
| Stroke limit | par + 4 | par + 3 | par + 3 | par + 2 |
| Windmill sails | slower (128) | 256 | 256 | faster (512) |
| Extra hazards | | | each template's | each template's |
| Slopes, domes, swells, bowls | | | 1.4× | 1.8× |
| Aim preview (display) | the line to its first bounce | the full line | 35 % | 20 % |
| Speed full by | 60 s | 53 s | 24 s | 22 s |

Each level builds its own hole (`buildHoleV3(id, slot, level)`: its sails, extras and slope strength) and each level's
par is proven on that hole: the bank holds four witnesses a hole and each witness's time (`t`). Holing in par earns the
under-par bonus on Hard and Expert, where par is the best route itself. The deal (`pickMinigolfHoles`) re-draws until the
five holes' witness times fit the level's Speed time, so 200 stays reachable on every level (every composed course's
witness scores 200 at every level; crazy-golf-v3-check). The levels are ready for the difficulty framework (#432): its
`GAME_LEVELS` entry is `minigolf: { levels: { easy: { settings: {} }, hard: { settings: {} }, expert: { settings: {} } } }`
(the deal reads `context.level`; `generateMinigolf` already takes it).

**Parts** (200, as golfRev 2): Holes 120, Par 40 (falling to 0 at the level's stroke limit), Under par 20, Speed 20
(full by the level's time, 0 at 90 s).

**Measured** (round 3, 16 Nov 2026, the difficulty framework's shared tool, `bun scripts/level-tune.ts minigolf
--level=<level> --seeds=24`: each sample a real deal at the level, the golfRev 3 skill-band bot,
`scripts/arcade-skill-bands/bots/minigolfV3.ts`, under the skill-band tool's human limits plus Joe's: at least 0.25 s to
react to the ball coming to rest and 0.15 s to move the finger into the pull; no modelled effect of the aim preview;
every run graded through the server's replay on the dealt puzzle):

| Level | Near-perfect avg / median (holed all five) | Elite avg / median (holed all five) |
|---|---|---|
| Easy | 188.8 / 190 (100 %) | 191.6 / 196 (96 %) |
| Normal | 185.1 / 189 (92 %) | 191.7 / 196 (96 %) |
| Hard | 151.0 / 154 (67 %) | 163.0 / 162 (83 %) |
| Expert | 142.9 / 147 (46 %) | 145.5 / 150 (58 %) |

Joe (16 Nov 2026): the ~198 / 160 / 140 targets are a guide; what matters is a clear step up, a comfortable Normal and an
Expert proven humanly scorable. Easy and Normal sit together for strong players (both near the top: Easy's slower sails,
longer stroke limit and bounce preview help weaker players most); Hard and Expert step down clearly. Expert's elite runs
on the 24 sample courses range 105–197 (`docs/design/pages-review/crazy-golf/GALLERY.md` lists them with their holes).

**Proofs.** crazy-golf-v3-check (the catalogue, the bank, 600 composed courses at 200, the deal, the chip, the swells, the
levels, the reveal's trace; `CHECKS_FULL=1` also rebuilds the bank byte for byte, about 20 min), minigolf-sync-check
(every bank hole at every level rolled phone = server and Bun = Chromium, chips and swells included),
arcade-standard-check's entry and arcade-self-replay-check's `minigolf/v3`.



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

## For the later polish pass (Joe, 16 Nov 2026)

- **Castles** should read more clearly as castles from above.
- **Captain Joulz** in a slightly more upright three-quarter view (`golf_sprites.py`: the camera's tip, now 38°).
