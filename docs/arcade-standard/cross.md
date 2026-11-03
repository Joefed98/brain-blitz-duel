# Jaywalk on the arcade scoring standard (crossRev 10, 29 Oct 2026; crossRev 11, 3 Nov 2026)

Rooms deal **`crossRev 11`** since 3 Nov 2026 (no coins, the no-stop streak: [below](#crossrev-11-no-coins-the-no-stop-streak-3-nov-2026)); crossRev 10 (was `crossRev 9`, the x200 expansion) before it. Every earlier revision replays and scores
exactly as before (cross-x200-check, arcade-batch1-check, arcade-tuning-f2-check).

## Play change: busier crossing by crossing

Each crossing is **crossRev 9's own course for the seed**: the same lanes, kinds, vehicles, speeds, directions,
phases, roadworks, island and the same twenty coins in the same cells. Only each traffic lane's period changes
(and a bike or motorbike lane's rider offsets, in proportion), so its vehicles come `CROSS_STD_DENSITY_12[k]`
twelfths as often as on crossRev 9:

| Crossing | 1 | 2 | 3 | 4 | 5 | 6 | 7–10 |
|---|---|---|---|---|---|---|---|
| Density (of crossRev 9's) | 6/12 (half) | 8/12 | 10/12 | 12/12 (full) | 13/12 | 14/12 | 15/12 |

Every scaled crossing must pass the same proofs as crossRev 9's (`crossPassable` over `CROSS_X_SEARCH_TICKS`, and
`crossFairPassable` on crossings 1–2). One that fails steps its density a twelfth toward 12 until one passes; 12
is crossRev 9's own proved course, so every crossing is proved. Everything is fixed at init from the seed, the same
for every player (arcade-room-identity-check runs crossRev 10). Measured on room seeds 0–39
(`bun scripts/cross-std-density.ts`): crossings 1, 3 and 4 always on target, crossing 2 on target 37/40 (else up to
11/12), crossings 5–6 on target 39/40 and 38/40; crossing 7+ hit 15/12 on most seeds, and fall back toward 12 where
the busier course could not be proved (ramp chosen at 15/12 rather than 16/12, which only 8–13 of 40 seeds reached).
Coins never move (the script fails if one does).

## Scoring (the parts total 200)

| Part | Max | How it counts |
|---|---|---|
| Rows and crossings (core) | 150 | units = rows crossed + 2 per full crossing (crossRev 9's units); `stdLine(150, units, 92)` — a straight line, full at 92 |
| Coins | 30 | 1.5 each of the run's 20 coins (`stdLine(30, coins, 20)`) |
| Crossing streak | 10 | 2 for each clean crossing straight after a clean crossing (the 2nd, 3rd, … clean crossing in a row), at most 5 of them; a hit ends the run of them, points already earned stay |
| Close calls | 10 | 1 each (crossRev 9's close-call rule: a forward hop landing within 6 ticks behind a passing vehicle, once a lane a crossing), up to 10 |

No penalties beyond the lives (three, as before). A run with any input scores at least 1; no input scores 0.
Earning a feature never costs core: coins sit on the forward path's lanes, clean crossings are the fastest ones and
close calls are forward hops. `streakPts` holds the standard's streak points on crossRev 10 (state flag `std: 1`,
folded into the checkpoint checksum after crossRev 9's fields).

**Core target.** The Near-perfect level's median core units on crossRev 10, 30 room seeds, `--rev=now
--levels=all --jobs=1`: **91.5 → 92** (elite 90, flawless 100.5).

**Perfect run.** The perfect-play oracle (`scripts/cross-ceiling.ts --rev=10`) takes every coin, a full streak and
17–38 close calls on seeds 0–5 and scores 200 through the server replay; arcade-standard-check replays it on three
seeds. No built state was needed.

## After-medians (crossRev 10, 30 room seeds, score median and p10–p90)

| Weak | Average | Good | Great | Near-perfect | Elite | Flawless |
|---|---|---|---|---|---|---|
| 88 (59–110) | 117 (90–129) | 133 (113–149) | 144 (124–171) | 181 (157–189) | 187 (163–192) | 194 (185–195) |

## Assumptions

- "Half the traffic": every traffic lane's period doubled (half the vehicles passing a point), the lanes themselves
  unchanged; roadworks and the island are not traffic.
- The streak's "full at 5" read as five back-to-back clean crossings after the first (six clean crossings in a row).
- Help (`instructions.ts`) and intro (`introScore.ts`) state the parts; the HUD's ×2–×4 pill and the "STREAK" pop
  still mark the clean run (no multiplier pays on crossRev 10). The crossRev 9 intro demo stays stopped until one is
  recorded on crossRev 10.

## crossRev 11: no coins, the no-stop streak (3 Nov 2026)

Rooms deal **`crossRev 11`** (one above crossRev 10). Joe's brief: take the coins out, keep close calls exactly as
they are, pay a **no-stop streak** for crossings made without stopping at a kerb for more than about half a second,
and rebalance so the weaker levels score less. crossRev 1–10 replay and score exactly as before (cross-rev11-check
replays 44 runs on unstamped and crossRev 2–7, 9 and 10 rounds recorded on unmodified main 63261010,
`scripts/fixtures/cross-rev11-legacy.json.gz`, `bun scripts/cross-rev11-legacy.ts <main checkout>`).

### What changes in play

- **The courses are crossRev 10's exactly** (the same lanes, traffic, densities, roadworks and island from the seed,
  proved the same way), without their coins: nothing is drawn or collected (`rollCourseV11`). The walker moves
  exactly as on crossRev 10 (the check plays crossRev 10 bot logs on both stamps and compares the walker tick for
  tick); `playRevOf` maps 11 to crossRev 10's play (`STD_REVS`).
- **A stop** (`CROSS_V11_STOP_TICKS` = 30 ticks, 0.5 s): the walker stands on the **start kerb or the island** for more
  than 30 ticks in a row. Standing is every tick on one of those two safe rows that is not part of a hop; side-steps
  along the kerb or the island still count as standing there (walking up and down the kerb is waiting). The second's
  kerb pause at a crossing's start, or after a hit, does not count. Waiting in a traffic lane is not a stop (the rule is
  about the kerbs). The sim counts it in `still` (ticks stood in a row) and sets `stopped` once it passes 30.
- **A no-stop crossing** is one reached without a hit and without a stop. **The no-stop streak** is the no-stop
  crossings in a row (`streak`); a crossing that stops or is hit ends it. The clean streak is gone (a hit already
  breaks a no-stop crossing).
- States add `flow: 1` with `still` and `stopped`, folded into the checkpoint checksum last (every crossRev 10
  checksum is unchanged).

### Scoring (the parts total 200)

| Part | Max | How it counts |
|---|---|---|
| Rows and crossings (core) | 150 | units = rows crossed + 2 per full crossing (as crossRev 10); `stdLine(150, units, 76)`, a straight line, full at 76 (four crossings and a few rows) |
| No-stop streak | 40 | 10 for each no-stop crossing straight after a no-stop crossing (the 2nd, 3rd, … in a row), at most 4 of them; points earned stay when the run breaks |
| Close calls | 10 | exactly crossRev 10's: 1 each (a forward hop landing within 6 ticks behind a passing vehicle, once a lane a crossing), up to 10 |
| Hits | −15 each | each life lost costs 15 (the third still ends the run) |

A run with any input scores at least 1; no input scores 0. Earning a feature never costs core: a no-stop crossing is
a crossing (it adds the same rows), and close calls are forward hops.

**Core target.** The brief's targets (weak 30–60, average about 90, good 120–140, great about 160, near-perfect
about 175, elite 185–195, flawless 200) cannot be met by a straight line from 0 on the units alone: on fresh seeds
the weak level crosses 51.5 units, more than half the near-perfect level's 96, so any core full at the Near-perfect
median would give a weak player over 80. Two things separate the levels instead: **hits** (weak players lose all
three lives, near-perfect ones none) and the **no-stop streak** (1, 1, 2, 3, 4, 5, 6 no-stop crossings by level). The
parts were fitted on the bots' per-run counts over a grid (core 130–170, full at 70–120 units, streak 20–60 in steps of
5–20, hit cost 0–25), choosing a 40-point streak (the brief's new feature carries real weight) and the closest fit:
core 150 full at **76 units** (between the Good and Great medians, 68.5 and 81; the Great level fills it), streak 10 ×
4, hit cost 15. The Near-perfect median (96) sits well past the core's full figure, as Meteor's snakeRev 12 does.

**Perfect run.** The perfect-play oracle (`scripts/cross-ceiling.ts --rev=11`) searches each crossing's quickest path
that never stands more than 30 ticks on the kerb or the island (`crossingPath`'s `stop`: the stand count rides in the
search state, crossRev 11 having no coins), and on the last, unfinished crossing ends on the deepest lane still clear
at the deadline (`survive`; a hit costs points here). On room seeds 0–39 every run scores 200 through the server
replay (11–19 crossings, all no-stop, a full streak, 18 or more close calls, no hit); arcade-standard-check replays
seeds 0, 7 and 61 and cross-rev11-check twelve.

### Bots

`scripts/arcade-skill-bands/bots/cross.ts`, read only on states with `flow` (every older revision's runs are
unchanged): no coins to chase; per crossing a player decides whether to keep it moving (`FLOW_TRY`: weak 0.1, average
0.25, good 0.45, great 0.65, near 0.85, elite 0.95, flawless 1). While they do, their plan (as they perceive the
traffic, with their usual read errors) never stands on the kerb or the island longer than 30 ticks less their own
margin (`FLOW_MARGIN`, 14 ticks weak to 2 flawless), a plan reaching the island carries on into the lane above it,
and on the kerb or the island they take a gap they would otherwise take only after a few seconds of waiting
(`FLOW_HOLD`). When no such plan shows they cross as usual and the crossing stops. `bun scripts/cross-rev11-bands.ts`
prints each level's units, no-stop crossings, streak, close calls and lives.

### Before → after (fresh seeds 10000–10039, `--rev=now --levels=all`, score median and p10–p90)

| | Weak | Average | Good | Great | Near-perfect | Elite | Flawless |
|---|---|---|---|---|---|---|---|
| crossRev 10 | 89 (70–111) | 115 (95–132) | 133 (114–157) | 151 (124–173) | 180 (148–188) | 188 (152–194) | 192 (174–196) |
| crossRev 11 | 59 (28–87) | 83 (52–121) | 124 (85–154) | 150 (117–175) | 172 (150–190) | 185 (160–191) | 200 (175–200) |

What the levels do on crossRev 11 (medians, the same seeds):

| Level | Units | Core | Crossings | No-stop crossings | Streak | Close calls | Hits |
|---|---|---|---|---|---|---|---|
| Weak | 51.5 | 101 | 3 | 1 | 0 | 1 | 3 |
| Average | 60 | 118 | 3 | 1 | 0 | 2 | 2 |
| Good | 68.5 | 135 | 4 | 2 | 0 | 3 | 2 |
| Great | 81 | 150 | 5 | 3 | 10 | 7 | 1 |
| Near-perfect | 96 | 150 | 6 | 4 | 20 | 10 | 0 |
| Elite | 98.5 | 150 | 6 | 5 | 30 | 10 | 0 |
| Flawless | 103.5 | 150 | 6 | 6 | 40 | 10 | 0 |

Against the targets: weak 59 (30–60), elite 185 (185–195) and flawless 200 hit them; good 124 is inside 120–140;
average 83 (about 90), great 150 (about 160) and near-perfect 172 (about 175) are a little under. Every gap between
levels is at least 13 points. The spread is wider than crossRev 10's because a hit now costs 15.

### Display, sound and the rest

- HUD: no coin pill; "NO-STOP ×n" after the crossings pill (the no-stop crossings in a row the crossing under way
  makes if it carries on: white at ×1, gold from ×2, when it pays), grey "NO-STOP –" once the crossing has stopped or
  been hit. The streak pop reads "NO-STOP ×n". No coins are drawn (the courses hold none).
- Sound: the streak paying plays the existing streak sting (`arc_fair_sting`), as crossRev 9 and 10 did; no new
  slot. No new haptics.
- Help, intro and reveal: the help drops the coins and states the no-stop rule, its half second, 10 each up to 40 and
  the 15 a hit; the intro reads "150 for rows and crossings, a no-stop streak 40, close calls 10; hits cost 15. Up to
  200." (89 characters); the reveal's lines are "47 rows · 3 crossings → 104", "no-stop streak 10 · 4 close calls 4
  +14", "1 hit −15", "Total → 103". Grading stores `noStop`, `streakPts` and `closeCalls` (no coins) for crossRev 11.
- The intro still drops its coin; the intro demo stays stopped until one is recorded on crossRev 11.
- Room identity: nothing new is dealt (scripts/room-identity/cross.ts deals crossRev 11); the streak is scored from the
  walker alone.

### Assumptions

- "Stopping at a kerb": the start kerb and the island (the road's two safe rows); the goal kerb ends the crossing at
  once, and waiting in a traffic lane is not a stop.
- "More than about 0.5 s": more than 30 ticks in a row; 30 is still no-stop.
- Side-steps along the kerb or the island count as standing there, so pacing the kerb is still waiting.
- The kerb pause (a second at a crossing's start and after a hit) is the game's, not the player's, and never counts.
- "Consecutive crossings": paid from the second no-stop crossing in a row (as crossRev 10's clean streak was), so a
  single no-stop crossing between stops pays nothing.
- A hit breaks the no-stop crossing; the clean streak is dropped rather than kept beside it (one streak, simpler).
- The hit cost is the standard's "mistakes cost what each game says"; it is what brings the weak level into 30–60.
