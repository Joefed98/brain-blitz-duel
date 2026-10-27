# x200: Tilt to 200 (tiltRev 8)

26 Oct 2026. Tilt's round maximum is 200 (`ROUND_MAX`, docs/scoring-200.md). Rooms, practice, the daily and
challenges deal `tiltRev 8` (`TILT_REV_EXPAND`, the "Expansion" section of `src/lib/arcade/tilt.ts`). Every older
stamp (unstamped, 2–6) keeps its own step, mazes and scoring: 32 runs recorded on main's code before the change
replay to the same score and final state on tiltRev 6 and on every older revision (`scripts/tilt-expand-check.ts`).

This finishes the parked E8 Tilt expansion (PR #163, `tiltRev 7`, never dealt; renumbered to 8 with no separate
path for 7) under the 26 Oct arcade rule.

## Why the parked version was not good enough, and what changed

The merge captain's measurement of the parked tiltRev 7: near-perfect 121 / 181 (tuning) and 113 / 177 (fresh),
under great; good and near-perfect only 8–11 apart; black holes ended about a third of runs at every level; the
features paid by seed luck (quick stars 0–2 per maze, a 20 s window measured the same in short and long mazes).

**Why near-perfect bots fell in black holes as often as average ones.** Measured on the parked rules and the bot:

1. *A fall ended the run.* One slip cost everything that run would have earned, so the levels' units barely
   separated (on tiltRev 6 the same is true: 25–38 % of runs end in a hole at every level, `--rev=x` "live").
2. *The bot planned from a stale view.* It rolled its 24 candidate tilts forward from the state its eye saw
   `lag` ticks ago and never allowed for the tilt it had already given since; with the lag removed the near-perfect
   bot's falls halved. Falls showed up as "doomed" plans (every candidate falls) one plan before each fall.
3. *Stars sat in the hole's mouth* (45 % of a cell toward the hole): the pickup zone overlapped the fall zone, so
   a marble that took the star at any speed rolled on in. Most strong-bot falls were seconds after a mouth star.
4. *Holes beside the route.* Pits in pockets one cell off the route, at a bend, tip a marble in on the route itself.

**Fixes (all gated on tiltRev 8; older revisions and the bot's older-revision play are byte-identical):**

- *A fall costs time, not the run.* The marble goes back to its start (blue to the blue start, amber to the amber
  start) and waits `TILT_X_FALL_HOLD` (45 ticks); stars, keys and the best progress are kept. The renderer fades the
  marble in over its hold and the success layer shows a miss at it; `tilt.pitFall` sounds.
- *Holes only in dead ends two or more cells off the route* (up to 2 / 3 / 3 a maze): falls come from detours and
  ice, never from the route's own bends.
- *Gold stars a similar detour:* one per maze, 1–2 cells off a route (dead ends first), never at a hole's mouth.
- *Bot (scripts/arcade-skill-bands/bots/tilt.ts, tiltRev 8 only):* anticipation (a skilled player knows the tilt
  they have just given: near-perfect plans with 30 % of its lag, elite 15 %, average and weak the whole lag);
  falls valued as the time they cost when the bot is stuck (it will take a risky way on instead of freezing), a
  two-tilt "swing" plan when it has made no progress for 100 ticks, caution near a hole it has already fallen into,
  and it no longer rolls into the cup while it is on its way to a star or key. The elite level turns a little
  faster, re-reads the board every 5 ticks and sees 54 ticks ahead, and goes for every star.

Result: falls per run now fall with skill (tuning / fresh seeds): weak 1.18 / 0.69, average 0.92 / 0.56, good 0.63 /
0.49, great 0.42 / 0.39, near-perfect 0.30 / 0.26, elite 0.25 / 0.21; on tiltRev 6 a black hole ended 25–38 % of
runs at every level.

## More world

Three mazes (`TILT_X_SIZES` 13, 15 and 17 cells across, 30 px a cell) in a 440 × 820 world, against tiltRev 6's
four mazes of 11–13 cells in a 360 px disc: 1.9× the cells a run. The second and third are wider than the screen; the
renderer's camera follows the marbles (display only). The carve is a growing tree (one step in `TILT_X_BRANCH` = 8
from a random open cell, else the newest), so routes have side passages all along them; the cup is the rim cell
whose route is nearest 42 / 46 / 40 cells. The amber marble joins in maze 3, as before.

## Features (every one dealt from the seed, the same for every player)

- **Ice** (2 / 3 / 3 patches of 5 route cells, and every quick star's corridor): the marble keeps its speed, up to
  4.8 px a tick.
- **Keys and gates**: one gate a maze across the blue route (beyond the quick stars' passages, up to 92 % of the
  way), its key 1–3 cells into a side passage on the start's side. Every key and both cups are proved reachable.
- **Quick stars** (time-bonus stars): exactly two a maze, each 3–5 cells into its own icy side passage off the first
  75 % of the blue route, before the gate. Each is worth `TILT_X_QUICK_POINTS` (5) up to its window (`Maze.quickAt`),
  then less, gone `TILT_X_QUICK_TAIL` (5 s) later.
- **Par**: each maze's par (`Maze.par`, `parX`) is a time for its par tour (both quick stars first in the nearer order,
  then the shortest walk over the gold star and key to the cup on the maze's tree, then the amber route): 150 ticks,
  8 a cell, 6 a turn (the disc must swing round), 14 a cell of the amber route, all × `TILT_X_PAR_SCALE` (115 %). The
  quick-star windows are the same for the walk up to each star (from 30 ticks) × `TILT_X_QUICK_SCALE` (125 %). The
  coefficients are a least-squares fit to the oracle's maze times (below). A finished maze's pace pays
  `TILT_X_PACE_POINTS` (10) at par or quicker, falling to 0 at 1.6× par. Long and short mazes pay alike.
- **Every passage can be entered and left** (26 Oct, second round): no star, key or ice on the way into a black hole or
  within two cells of one, and holes only in dead ends two or more cells off the blue route. Session A found ice
  corridors that stopped even its flawless bot: a quick star sat in an icy passage that ran on into a hole, so a marble
  taking it at ice speed could not stop. The oracle's proofs (below) enter and leave every passage of every dealt seed.
- Kept: two marbles in maze 3, each to its own cup; the camera, the keys' colours and the gate swing.

**The bank.** Rooms deal only seeds from `TILT_BANK` (`src/lib/duel/tiltBank.server.ts`, 389 seeds): seeds the dealer's
rule passes (`tiltDealableX`: every key and cup reachable, one key and gate, one gold star and two quick stars a maze,
pars that fit the run) **and** that the oracle played to 200 through the server's replay (389 of 492 candidates).
`bun scripts/tilt-bank.ts --scan … / --write …` builds it; the proof logs are `scripts/fixtures/tilt-bank-runs.json.gz`
(2.9 MB). The skill-band tool measures bank seeds (`tiltBankSeedFor`: tuning n 0–59 the bank's first 60, fresh n 10000–
10199 its next 200; the older checks' fixtures keep their room seeds through `fixtureSeedFor`).

**The oracle** (`scripts/tilt-oracle.ts`): a player that knows the maze and plays it through the real sim. It walks
each maze's par-tour waypoints (the two quick stars, the gold star and key as the tour meets them, the blue cup, then in
maze 3 the amber cup, either cup first, whichever is quicker) and reaches each by a beam search over held tilts turned
at 12 px a tick (re-gripping at the screen's edges), never letting the marble it steers fall in. It takes about 4 s a
seed.

## Score

Units: 40 a finished maze, up to 39 progress in the maze being played (its key counts 3 of them), 10 a gold star;
150 units (three mazes and three stars) is 140 on `TILT_V8_BAND_CURVE` (units 0 2 40 80 100 120 130 140 150 → points 0 3
18 45 59 81 104 127 140). All three mazes add 10. Skill points (quick stars up to 30, pace up to 30) are paid on
`TILT_X_SKILL_PAY` (raw 15 25 35 45 52 60 → 8 12 35 35 48 50) to 50; the full 50 needs every quick star in its window
and every maze at par. `bandTotal(…, 200)`; no input scores 0.

## The arcade rule's ceiling (by play)

Every dealt seed offers the same: 3 mazes, 3 gold stars, 6 quick stars, 3 keys, pars that fit the run. Every one was
**played to 200 by the oracle** through the server's replay: tilt-expand-check replays all 389 proof logs (each 200,
every quick star, gold star and key taken), so the lowest ceiling is **200 on the tuning seeds (0–59), 200 on the fresh
seeds (10000–10199) and 200 on the whole bank**. (Counting alone, `tiltCeilingX`, also gives 200 on every one.)

The bots' "perfect" level (Session A's flawless player) does not reach 200: its plan rarely takes all six quick stars
inside their windows (median 185, best 199 on both sets). The oracle is the ceiling's proof.

## Tuning (paired, server replay scores; Session A's fixed bots, #175)

`bun scripts/arcade-skill-bands.ts tilt --rev=x --levels=all --seeds=60 --jobs=2` (tuning) and `--from=10000 --seeds=200`
(fresh), the fixed bots with their fixes on. "Old" is tiltRev 6 (LIVE_BANDS' `strictRev`, max 150) played by the same
fixed bots on the same seeds. Median / p90; the old median in brackets. Every run through the server's encode and
replay. The curves were fitted on the tuning seeds only.

| Seeds | Weak | Average | Good | Great | Near-perfect | Elite | Flawless (median, lowest) |
|---|---|---|---|---|---|---|---|
| Tuning (0–59) | 53 / 122 (55) | 77 / 142 (70) | 126 / 169 (129), −2 % | 149 / 185 (132) | 172 / 186 (138) | 177 / 190 (141) | 185, 43 (143) |
| Fresh (10000–10199) | 48 / 89 (41) | 87 / 139 (75) | 125 / 169 (122), +2 % | 149 / 185 (132) | 172 / 185 (138) | 177 / 194 (140) | 185, 18 (143) |

- Zero scores: none at any level on either set (lowest 1–3: a bot stuck all run near a maze's start).
- Paired: great beats good on 43/60 and 151/200 seeds; near-perfect beats great on 44/60 and 147/200; elite beats
  near-perfect on 32/60 and 101/200.
- Random play (uniform random drags, 60 / 200 seeds): median 3, p90 6, max 9 / 11.
- Lowest ceiling (the oracle, by play): 200 on both sets.

**The bar:** good within ±10 % (−2 %, +2 %): met. Near-perfect median 165–175 (172, 172): met; p90 ≤ ~185 (186, 185):
met (186 on the tuning set). Elite median ≥ ~175 (177, 177): met; p90 190–200 (190, 194): met. Great between good and
near-perfect: met. No zeros: met. Random ~0: met. Flawless and oracle reach 200 on every seed: **the oracle does; the
bots' flawless level does not** (median 185; its plan misses quick-star windows).

## Checks

Re-run after the merge with main (#175) and the re-tune, one process each (no browser checks):

| Check | Result |
|---|---|
| tilt-expand-check (legacy replay, rooms deal the bank, 389 oracle proofs to 200, passable passages, room identity, rules, score) | PASS, 48,385 checks |
| round-max-check | PASS |
| scoring-bands-check | PASS |
| scoring-targets-check | PASS |
| scoring-rev3-check | PASS (a first run under load failed its 250 ms grading-time limit; PASS run alone) |
| reveal-score-check | PASS |
| replay-check | PASS |
| practice-bests-check | PASS |
| arcade-self-replay-check (tilt, tilt/v2, tilt/band, tilt/tunec, tilt/expand) | PASS |
| arcade-fx-check | PASS |
| arcade-help-bands-check | PASS |
| intro-score-text-check | PASS |
| six-game-scoring-check | PASS |
| arcade-score-bands-check | PASS |
| arcade-batch4-check | PASS |
| arcade-tuning-a-check | PASS |
| arcade-tuning-c-check | PASS |
| arcade-correction-check | PASS |
| four-tuning-check | PASS |
| intro-demo-check | PASS |
| beta-recording-check | PASS |

Also `tsc --noEmit` clean; the merged bot plays tiltRev 6 and 4 with logs identical to main's bot (24 logs, fixes on and
off).

## Shared files touched (Tilt's lines only)

- `src/lib/duel/roundMax.ts` (`tilt: 200`), `scripts/round-max-check.ts` (RAISED).
- `src/lib/arcade/liveBands.ts`: tilt → `rev: TILT_REV_EXPAND`, `curve: TILT_V8_BAND_CURVE`, `strictRev: TILT_REV_STRICT`.
- `src/lib/duel/arcade.server.ts` (`generateTilt`), `src/lib/duel/grade.ts` (tiltRev 8 extra fields),
  `src/lib/duel/instructions.ts` (the tilt block), `src/lib/duel/introScore.ts`, `src/lib/duel/introDemo.functions.ts`
  (older demos stopped), `src/lib/duel/roundSummaries.ts`, `src/lib/arcade/reveal.ts`, `src/lib/arcade/revealRenderers.ts`,
  `src/lib/fx/gameSounds.ts` (quick star, key, fall), `src/lib/arcade/arcadeFxGames.renderer.ts` (`ARCADE_FX_SPECS.tilt`
  at the taller world), `src/lib/duel/practiceStamps.data.ts` (regenerated).
- `scripts/arcade-skill-bands/games.ts`: Tilt's `seedFor` measures bank seeds; an optional `fixtureSeedFor` on
  `GameSpec` (Tilt: the room seeds) that `scoring-bands-check` and `scoring-targets-check` read for their recorded runs.
- `scripts/arcade-skill-bands/bots/tilt.ts`: main's fixed bot (#175) plus Tilt's tiltRev 8 paths, all on tiltRev 8 states.
- Older checks' Tilt lines: `arcade-tuning-a-check.ts`, `arcade-tuning-c-check.ts` (rooms deal tiltRev 8; the help names
  "Gold stars"), `six-game-scoring-check.ts` (the intro line).
- `scripts/arcade-self-replay-check.ts`: one entry, `tilt/expand`, appended at the end of its list (other entries keep their PRNG streams).
- `scripts/fixtures/replay-runs.json`: one Tilt run appended.
- New: `scripts/tilt-expand-check.ts`, `scripts/tilt-expand-record.ts`, `scripts/tilt-oracle.ts`, `scripts/tilt-bank.ts`,
  `scripts/room-identity/tilt.ts`, `src/lib/duel/tiltBank.server.ts`, fixtures `tilt-expand-legacy` (from the parked
  branch, recorded on main's code), `tilt-expand-runs`, `tilt-bank-runs` (2.9 MB: the oracle's proof for every bank seed).

## Assumptions and notes for the merge

- `TILT_RUN_TICKS` stays 90 s (the room clock is unchanged).
- The intro demo needs re-recording on tiltRev 8 (older demos are stopped).
- `src/lib/arcade/AGENTS.md` has no tiltRev 8 line (left for the coordinator to avoid five-way conflicts).
- `replay-runs.json` is a one-line file: re-run `bun scripts/replay-fixtures.ts --add=tilt` after merging if it conflicts.
- Browser checks (arcade-play, arcade-lowend for Tilt at 4×, room-practice, screenshots) were not run here; the
  renderer is the parked one (cached rim, gloss and stars from 57b31ab) plus the hold fade and per-star quick rings.
