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

- First person from a gun turret behind a stone wall at dusk, looking down three lanes that meet on the horizon.
- **Tanks only.** Scout 1 hit, Medium 2, Heavy 4; health pips over each. Each has a glowing amber **weak spot** on its
  hull, placed by type (a scout's low on the glacis, a medium's on the left of the hull, a heavy's at the turret ring)
  and moving with it: a weak-spot hit does **double damage**.
- **Five waves** on a fixed seeded schedule, identical for everyone in a room: every seed deals the same 29 tanks
  (60 hit points; 36 weak-spot chances: one a scout or medium, two a heavy) in the same wave shapes
  (scouts / mediums / heavies: 4/1/0, 3/2/1, 2/3/1, 2/2/2, 1/2/3); the seed picks each tank's lane (never the previous
  tank's), its moment in the wave's 5 s window and its order, and whether (and at which depth) it speeds up ×3/2 or
  slows ×2/3. Waves start at 1, 11, 21, 31 and 41 s and press harder as they go (pace 68, 76, 86, 100, 116 % of each
  type's speed; a scout crosses the full field in about 7.8 s at 100 %). Tanks in one lane keep their distance.
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
  40 ‰ wide: 80 ms). A tap (`k = 3`) with the needle in it finishes the reload at half time (1 s); outside it, the gun
  jams for 0.5 s more. One tap a reload.
- **Computer:** the mouse aims (the crosshair on the pointer; ArcadeCanvasStage's new `hover`), click fires, R reloads,
  Space is the fast-reload tap. The computer layout plays it upright at full height with the dusk carried out to the
  sides (`tall`, `bastionScene`).

## Score (exactly 200)

| Part | Max | How |
|---|---:|---|
| Armour (core) | 140 | straight line: floor(140 × hit points destroyed ÷ 60) |
| Weak spots | 30 | 1 for each weak-spot hit, up to 30 |
| Fast reloads | 20 | 2 for each fast reload, up to 10 |
| Base intact | 10 | 10 with 3 of 3 left at the end, 5 with 2 of 3, else 0 (0 once it fell) |

No input scores 0; any input at least 1. The **core target** is the whole field: all 60 hit points (every tank).

## Proof of 200

The oracle (`scripts/bastion-oracle.ts`) looks 31 ticks ahead through a copy of the run (the tanks' moves and the
shells already flying are fixed), finds for each tank the flight whose landing point is its weak spot, fires at the
tank nearest the wall still owed damage, reloads early whenever the field is quiet and taps the needle in the green.
It scores 200 (every part at its maximum) on every tuning seed (0–59) and fresh seed (10000–10199) through the server
replay (bastion-check), and on 860 further seeds tried while tuning (0–599 and spans near 2^31).

## Skill bands

`bun scripts/arcade-skill-bands.ts bastion --rev=now --levels=all` (bots `scripts/arcade-skill-bands/bots/bastion.ts`:
the oracle's planner with each level's reaction, lead judgement, aim, patience and fast-reload timing; weaker levels aim
at the hull more, reload only when empty and sometimes forget the tap; the perfect level is the oracle).

| Seeds | Weak | Average | Good | Great | Near-perfect | Elite | Flawless |
|---|---:|---:|---:|---:|---:|---:|---:|
| tuning 0–59 | 27 | 99 | 174 | 178 | 181 | 188 | 200 |
| fresh 10000–10199 | 26 | 97 | 175 | 178 | 181 | 187 | 200 |

Medians rise weak → flawless; the clearest gap is at the top (elite 187 → flawless 200, 30 weak-spot hits and every
tank). The bands are wide at the bottom: a weak or average player usually loses the base in the later waves (the run
ends early, as the brief asks); from "good" up the base mostly holds and the weak spots and fast reloads separate players.

## Checks

- bastion-check (~10 s): the original Bastion's legacy runs, the deal, the plan, the rules, the parts, the oracle at 200
  on 260 seeds through the server and gradeAnswer, rising bands, art on its rectangles.
- arcade-standard-check's entry `scripts/arcade-standard/bastion.ts`; arcade-self-replay-check's `bastion/v2` entry
  (appended); replay-check (one run appended to `scripts/fixtures/replay-runs.json`).

## Sound and haptics

Own slots `bastion.cannon`, `.dry`, `.reload`, `.fastReload`, `.jam`, `.loaded`, `.hit`, `.weak`, `.kill`, `.miss`,
`.baseHit`, `.wave`, each on a shared fallback until a recording is set (`docs/sound-cues/arcade.md`); the bed borrows
Wavefront's. Haptics: the base hit (`impact`) and the shared arcade buzzer only.
