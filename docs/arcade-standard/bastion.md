# Bastion on the arcade scoring standard (bastionRev 2, 1 Nov 2026)

Bastion is back in rooms as a new game under its old id: a first-person tank-defence shooter in the arcade's **Action**
group (`src/lib/duel/arcadeGroups.ts`), born on the standard at `bastionRev` 2. The original Bastion (a turret firing at
falling shapes) was retired to practice in October 2026 and never carried a stamp; its stored rounds (unstamped) replay
and score exactly as before through the untouched `src/lib/arcade/bastion.ts` (proved by bastion-check against 40 runs
recorded on main 9486004). Keeping the id keeps every stored round, practice best and the room history pointing at the
same game; the stamp decides which sim plays.

- Sim `src/lib/arcade/bastionTank.ts`, art `bastionTank.renderer.ts`, stage and reveal `src/puzzles/bastion.tsx`
  (`TankStage`), replay `replayBastionTankRun` (`src/lib/duel/bastion.ts`), deal `generateBastion` (any seed).
- 60 s run, 63 s round clock (`BASTION_TIME_MS`, unchanged). World 390 × 720.

## The game

- First person from a gun turret behind a wall at dusk, looking down a road's three lanes that meet on the horizon
  (the look follows Joe's mockups, bastion-mockup.png and bastion-controls.png: slate sky, jagged peaks, earth field).
- **Tanks only.** Scout 1 hit, Medium 2, Heavy 4; orange health pips over each. Each has a round orange **weak spot** (a
  vent on a 14 × 14 square at scale 1), placed by type (a scout's low on the glacis, a medium's on the left of the hull,
  a heavy's at the turret ring) and moving with it: a hit on it does **double damage** while it is **exposed**. Each
  vent is open 60 ticks of every 90 (a seeded phase per tank) and drawn dark while shut; a shell on a shut vent is a
  plain hull hit.
- **Five waves** on a fixed seeded schedule, identical for everyone in a room: every seed deals the same 30 tanks
  (63 hit points; 38 weak-spot chances: one a scout or medium, two a heavy) in the same wave shapes
  (scouts / mediums / heavies: 4/1/0, 3/2/0, 3/1/1, 2/2/3, 1/3/4: the last two bigger); the seed picks each tank's
  lane (never the previous tank's), its moment in the wave's 5 s window and its order, the depth at which it speeds up
  ×3/2 or slows ×2/3 (every tank does once) and its vent's phase. Waves start at 1, 11, 21, 31 and 41 s; the first three
  roll in gently and the last two press hard (pace 44, 50, 56, 100, 134 % of each type's speed; a scout crosses the
  full field in about 7.8 s at 100 %). Tanks in one lane keep their distance.
- A tank that reaches the wall hits the base. The base takes 3 hits; losing all 3 ends the run early, score kept.
- Everything is integer maths: depth in 1/256 units, the perspective scale `256·K/(K+z)` (K 320) from one integer
  division, and every collision rectangle (`bastionTankRects`: hull, turret, weak spot) is exactly what the renderer
  draws (bastion-check records the renderer's drawing and finds every point within 2 px).

## Controls (one thumb)

- **Drag anywhere to aim.** The crosshair floats 60 world px above the finger. Slow, small drags move it less than the
  finger (a gain from 0.45 to 1 by finger speed) for fine aim. Recorded as `k = 7` aim events.
- **Lift to fire** (`k = 1`, carrying the crosshair's point). A shell lands 18–30 ticks later (0.3–0.5 s, longer the
  higher on the screen it is aimed), on the front-most tank whose hull or turret covers the point at landing; so a
  moving tank must be led. A shot every 15 ticks at most.
- **5 shells.** Empty, it reloads by itself in 2 s. **Swipe down** (70 px, mostly vertical, under 0.42 s) to reload early
  (`k = 2`; the crosshair goes back where it was).
- **Fast reload:** during a reload a needle sweeps a bar with a green zone (seeded per reload, 250–450 ‰ of the sweep,
  30 ‰ wide: 60 ms). A tap (`k = 3`) with the needle in it finishes the reload at half time (1 s); outside it, the gun
  jams for 0.5 s more. One tap a reload.
- **Computer:** the mouse aims (the crosshair on the pointer; ArcadeCanvasStage's new `hover`), click fires, R reloads,
  Space is the fast-reload tap. The computer layout plays it upright at full height with the dusk carried out to the
  sides (`tall`, `bastionScene`).

## Score (exactly 200)

| Part | Max | How |
|---|---:|---|
| Armour (core) | 140 | straight line: floor(140 × hit points destroyed ÷ 63) |
| Weak spots | 30 | 1 for each weak-spot hit, up to 30 |
| Fast reloads | 20 | 2 for each fast reload, up to 10 |
| Base intact | 10 | 10 with 3 of 3 left at the end, 5 with 2 of 3, else 0 (0 once it fell) |

No input scores 0; any input at least 1. The **core target** is the whole field: all 63 hit points (every tank).

## Proof of 200

The oracle (`scripts/bastion-oracle.ts`) looks 31 ticks ahead through a copy of the run (the tanks' moves and the
shells already flying are fixed), finds for each tank the flight whose landing point is its weak spot while that vent is open, fires at the
tank nearest the wall still owed damage, reloads early whenever the field is quiet and taps the needle in the green.
It scores 200 (every part at its maximum) on every tuning seed (0–59) and fresh seed (10000–10199) through the server
replay (bastion-check), and on every seed tried while tuning (1,000 in all: 0–599, 10000–10199 and two spans of 100
near 2^31).

## Skill bands

`bun scripts/arcade-skill-bands.ts bastion --rev=now --levels=all` (bots `scripts/arcade-skill-bands/bots/bastion.ts`:
the oracle's planner with each level's reaction, lead judgement, aim, patience and fast-reload timing; weaker levels aim
at the hull more, reload only when empty and sometimes forget the tap; the perfect level is the oracle).

| Seeds | Weak | Average | Good | Great | Near-perfect | Elite | Flawless |
|---|---:|---:|---:|---:|---:|---:|---:|
| tuning 0–59 | 37 | 82 | 133 | 156 | 176 | 191 | 200 |
| fresh 10000–10199 | 37 | 79 | 140 | 160 | 179 | 191 | 200 |

Before the follow-up (the first version of rev 2, never dealt: 29 tanks, waves at pace 68–116, vents always open, an
80 ms green zone, 18 × 11 weak spots) fresh seeds gave 26 / 97 / 175 / 178 / 181 / 187 / 200: the top four bunched and
"good" cleared the field. The follow-up (1 Nov 2026) added the pressure Joe asked for, all on the fixed seeded
schedule: bigger and much faster waves 4–5 (2/2/3 and 1/3/4 at 100 % and 134 %, gentler waves 1–3), a speed change on
every tank, weak spots exposed 60 of every 90 ticks, a 60 ms green zone and the round 14 × 14 vent. Now only strong
play destroys everything: good players lose part of waves 4–5 (and often the base), great ones most of the weak spots,
near-perfect ones a few; elite runs are 9 below flawless.

Against Joe's targets (weak ~30, average ~90, good 120–140, great ~160, near-perfect ~175, elite 185–195, flawless 200):
everything lands but average, about 80, because an average player nearly always loses the base early in wave 4 (three
base hits end the run); easing wave 4 lifts average but squeezes great and elite together, so I kept the gap at the top.

## Checks

- bastion-check (~10 s): the original Bastion's legacy runs, the deal, the plan, the rules, the parts, the oracle at 200
  on 260 seeds through the server and gradeAnswer, rising bands, art on its rectangles.
- arcade-standard-check's entry `scripts/arcade-standard/bastion.ts`; arcade-self-replay-check's `bastion/v2` entry
  (appended); replay-check (one run appended to `scripts/fixtures/replay-runs.json`).

## Sound and haptics

Own slots `bastion.cannon`, `.dry`, `.reload`, `.fastReload`, `.jam`, `.loaded`, `.hit`, `.weak`, `.kill`, `.miss`,
`.baseHit`, `.wave`, each on a shared fallback until a recording is set (`docs/sound-cues/arcade.md`); the bed borrows
Wavefront's. Haptics: the base hit (`impact`) and the shared arcade buzzer only.
