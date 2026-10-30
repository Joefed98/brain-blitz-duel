# Jaywalk on the arcade scoring standard (crossRev 10, 29 Oct 2026)

Rooms deal **`crossRev 10`** (was `crossRev 9`, the x200 expansion). Every earlier revision replays and scores
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
