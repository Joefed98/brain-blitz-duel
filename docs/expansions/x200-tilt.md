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
  75 % of the blue route, before the gate. Each is worth `TILT_X_QUICK_POINTS` (5) up to its window (`Maze.quickAt`:
  when a run taking the two in the nearer order at `TILT_X_QUICK_CELL` ticks a cell would reach it, after
  `TILT_X_PAR_T0`), then less, gone `TILT_X_QUICK_TAIL` (5 s) later.
- **Par**: each maze's par (`Maze.par`) is `TILT_X_PAR_T0` + `TILT_X_PAR_CELL` (10) ticks a cell of its par tour
  (both quick stars first, then the shortest walk over the gold star and key to the cup on the maze's tree, plus the
  amber route). A finished maze's pace pays `TILT_X_PACE_POINTS` (10) at par or quicker, falling to 0 at 1.6× par
  (`tiltPacePoints`). Long and short mazes pay alike.
- Kept: two marbles in maze 3, each to its own cup; the camera, the keys' colours and the gate swing.

The dealer (`tiltDealableX`, `generateTilt`) deals only seeds whose three mazes all have their key and gate, one gold
star, two quick stars and pars that fit the run (about 72 % of raw seeds; it re-deals the rest). The skill-band tool
measures the dealt seeds (`seedFor` → `tiltDealSeedX`).

## Score

Units: 40 a finished maze, up to 39 progress in the maze being played (its key counts 3 of them), 10 a gold star;
150 units (three mazes and three stars) is 140 on `TILT_V8_BAND_CURVE`. All three mazes add 10. Skill points (quick
stars up to 30, pace up to 30) are paid on `TILT_X_SKILL_PAY` to 50; the full 50 needs every quick star in its window
and every maze at par. `bandTotal(…, 200)`; no input scores 0.

## The arcade rule's ceiling

Every dealt seed offers the same: 3 mazes, 3 gold stars, 6 quick stars, 3 pars that fit the run, every item
reachable. Taking everything at par scores 140 + 10 + 50 = 200 (`tiltCeilingX`). tilt-expand-check proves it on all
260 measured seeds (tuning 0–59 and fresh 60–259): lowest ceiling 200. (Raw, undealt seeds that lack a quick star
would top out at 190; the dealer never deals them.) The stored top run (`scripts/fixtures/tilt-expand-best.json.gz`,
a flawless bot, `bun scripts/tilt-expand-best.ts`) reaches 200 through the server replay.

## Tuning (paired, server replay scores)

`bun scripts/arcade-skill-bands.ts tilt --rev=x --levels=weak,average,good,great,near,elite --seeds=60 --jobs=2`
and the same with `--from=60 --seeds=200`: "old" is tiltRev 6 (LIVE_BANDS' `strictRev`, max 150), "new" tiltRev 8
(max 200), the same seeds and the same simulated players. Every run through the server's encode and replay; no
mismatches, nothing flagged. Median / p90 (max for elite); the old median in brackets.

| Seeds | Weak | Average | Good | Great | Near-perfect | Elite |
|---|---|---|---|---|---|---|
| Tuning (0–59) | 59 (55) | 62 (69) | 107 (104), +3 % | 137 (122) | 170 / 188 (124) | 177 / 188, max 192 (128) |
| Fresh (60–259) | 59 (54) | 70 (68) | 101 (108), −6 % | 144 (119) | 170 / 188 (122) | 177 / 188, max 195 (122) |

- Zero scores: none at any level on either set (lowest 1–3: a bot stuck all run near a maze's start; the base
  curve's first knot makes any progress at all worth a point). No-input runs score 0.
- Paired (same seed): great beats good on 40/60 and 149/200 seeds, near-perfect beats great on 48/60 and 148/200,
  elite beats near-perfect on 38/60 and 124/200 (ties 5 and 10).
- Random play (uniform random drags at a human rate, re-grips now and then, 260 seeds): median 2, p90 6, max 21.
- Lowest perfect-play ceiling: 200 on both sets (every one of the 260 seeds).

**The bar.** Good within ±10 % of before: yes (+3 %, −6 %). Near-perfect median 165–175: yes (170, 170). Near-perfect
p90 at or under about 185: 188 on both sets (just over). Elite median at least about 175: yes (177, 177). Elite top
10 % reaching 190–200: **not met**, 188 on both sets (best 192 and 195). Great between good and near-perfect, and
near-perfect above great: yes. No zeros for weak or average play: yes.

Why the top is short: the elite and near-perfect bots' best runs overlap (both are the same planner; elite has a little
less lag, a slightly faster finger and goes for every star), so any pay curve that lifts elite's p90 to 190 lifts
near-perfect's p90 with it (tried: KP [0,10,16,30,38,42,50] gives near 190 / elite 189). 200 needs every quick star
inside its window and every maze at par: the flawless bot (no lag or aim error) scores median ~185, best 197–198 on
single runs; the stored 200 was built maze by maze (`--stitch`: each maze replayed from where the last ended until
one try takes everything at par). Par is the time a tour at 10 ticks a cell takes; the flawless bot's maze time is
0.7–1.8× par (median 1.16), so par is a stretch target but reachable (the stitched run meets it in all three).


## Checks

Run in this worktree, one process each (no browser checks; the coordinator runs those after the merge):

| Check | Result |
|---|---|
| tilt-expand-check (new) | PASS, 51,161 checks |
| round-max-check | PASS |
| scoring-bands-check | PASS |
| scoring-targets-check | PASS |
| scoring-rev3-check | PASS |
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

Also: `tsc --noEmit` clean; the skill-band bot plays tiltRev 6 and 4 with byte-identical logs to main's bot (12 runs
compared).


## Shared files touched (Tilt's lines only)

- `src/lib/duel/roundMax.ts` (`tilt: 200`), `scripts/round-max-check.ts` (RAISED).
- `src/lib/arcade/liveBands.ts`: tilt → `rev: TILT_REV_EXPAND`, `curve: TILT_V8_BAND_CURVE`, `strictRev: TILT_REV_STRICT`.
- `src/lib/duel/arcade.server.ts` (`generateTilt`), `src/lib/duel/grade.ts` (tiltRev 8 extra fields),
  `src/lib/duel/instructions.ts` (the tilt block), `src/lib/duel/introScore.ts`, `src/lib/duel/introDemo.functions.ts`
  (older demos stopped), `src/lib/duel/roundSummaries.ts`, `src/lib/arcade/reveal.ts`, `src/lib/arcade/revealRenderers.ts`,
  `src/lib/fx/gameSounds.ts` (quick star, key, fall), `src/lib/arcade/arcadeFxGames.renderer.ts` (`ARCADE_FX_SPECS.tilt`
  at the taller world), `src/lib/duel/practiceStamps.data.ts` (regenerated).
- `scripts/arcade-skill-bands/games.ts`: Tilt's `seedFor` deals as rooms do.
- Older checks' Tilt lines: `arcade-tuning-a-check.ts`, `arcade-tuning-c-check.ts` (rooms deal tiltRev 8; the help names
  "Gold stars"), `six-game-scoring-check.ts` (the intro line).
- `scripts/arcade-self-replay-check.ts`: one entry, `tilt/expand`, appended at the end of its list (other entries keep their PRNG streams).
- `scripts/fixtures/replay-runs.json`: one Tilt run appended.
- New: `scripts/tilt-expand-check.ts`, `scripts/tilt-expand-record.ts`, `scripts/tilt-expand-best.ts`,
  `scripts/room-identity/tilt.ts`, fixtures `tilt-expand-legacy` (from the parked branch, recorded on main's code),
  `tilt-expand-runs`, `tilt-expand-best`.

## Assumptions and notes for the merge

- `TILT_RUN_TICKS` stays 90 s (the room clock is unchanged).
- The intro demo needs re-recording on tiltRev 8 (older demos are stopped).
- `src/lib/arcade/AGENTS.md` has no tiltRev 8 line (left for the coordinator to avoid five-way conflicts).
- `replay-runs.json` is a one-line file: re-run `bun scripts/replay-fixtures.ts --add=tilt` after merging if it conflicts.
- Browser checks (arcade-play, arcade-lowend for Tilt at 4×, room-practice, screenshots) were not run here; the
  renderer is the parked one (cached rim, gloss and stars from 57b31ab) plus the hold fade and per-star quick rings.
