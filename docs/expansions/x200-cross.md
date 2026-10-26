# x200: Jaywalk to 200 under the arcade rule (crossRev 9)

26 Oct 2026. Jaywalk `crossRev 9` (`CROSS_REV_EXPAND`) raises the game to 200 (`ROUND_MAX`, docs/scoring-200.md).
Rooms, practice, the daily and challenges deal it; every older stamp (none, 2–7) keeps its own courses, rules and
scoring. It is the parked Expansion E1 version (`origin/claude/e1-parked`, PR #165, `crossRev 8`, never merged or
dealt) ported onto main, renumbered to 9 with no separate code path for 8, and finished under the arcade rule agreed
with Joe on 26 Oct (fixed opportunities a run; skill headroom on paired seeds).

## What changed from the parked version, and why

| | Parked crossRev 8 | crossRev 9 |
|---|---|---|
| Coins | 4 on every crossing, every crossing (more crossings meant more coins) | **20 a run, whatever the seed**: 4 on each of crossings 1–5, none after (`CROSS_X_COINS_PER_RUN`). The seed only picks lanes and columns |
| Coin columns | any of 1–2 / 10–11 | column 2 or 10 (the seed picks the side), so every coin is the same four-column detour from the walker's start; only a column the lane below leaves open (a coin above roadworks can always be hopped into from below; some parked coins in a chicane's middle lane could only be reached by hopping back down from above) |
| Traffic | each car lane's speed, length and gap drawn independently | **one density schedule a crossing**: the crossing's car lanes take speeds, lengths and gaps evenly spread over the usual ranges (one value each), and the seed only deals which lane gets which, directions and phases. Crossing k is equally hard on every run (second iteration, below) |
| Bonus | `min(50, 3 × coins + streak)`: linear, so a few coins and a short streak filled much of it | the raw skill points (3 a coin plus the streak points) paid on `CROSS_V9_SKILL_PAY`: 15 pay 6, 30 pay 36, 45 pay 43, 60 pay 46, the full 50 needs 66 (every coin and a six-point streak) |
| Play curve | `[0,57,68,89,113,136,150]` at units `[0,40,50,58,66,74,82]` | `[0,53,76,90,121,149,150]`: refitted with the pay (tuning seeds only) so good play stays near crossRev 7 |
| HUD | coins taken | coins taken of the run's twenty ("7/20") |
| Bot | chased a coin only when it was in the very next lane | lines up for coins ahead (see below); an elite level |

Everything else is the parked game: the 390×727 world (36 px HUD, 34 px goal kerb, 14 rows of 44 px with the grass
checkpoint island at row 7, a 28 px start pavement), buses (crossing 2, two from 5), motorbikes (crossing 3, two from
6), cyclists and roadworks, the island checkpoint, the ×1–×4 streak (1 × (multiplier − 1) a crossing without a hit),
the art, the arena fill (the pavement runs on below the world), the effects, the sounds on existing cues.

### First, the bots (as the brief asked)

The parked numbers (near-perfect at most ~161 / 150) were largely the bot. Measured on the parked version with the
new weak and elite levels (60 tuning seeds): near-perfect 149 (110–183), elite 151 (110–183): elite barely above
near-perfect because the bot read every level above near-perfect from near-perfect's tables, and both took only about
8 of the 16–20 coins they met, since they went for a coin only when it sat in the next lane. A strong player lines up
for a coin earlier, and decides whether the detour is worth it. So the bot (`scripts/arcade-skill-bands/bots/cross.ts`,
crossRev 9 only; older revisions' play at the four original levels is unchanged):

- goes for the next coin it chases in this half of the road: walking along the pavement or the island (safe) to the
  coin's column, or a column at a time through traffic, and into the coin's lane at its column;
- takes the coin route only when it costs little against its quickest hop (`COIN_DETOUR`: 20 / 35 / 50 / 70 ticks for
  average / good / great / near-perfect). A first version with no limit made every level slower (near-perfect fell
  from 4 to 3 crossings and scored less), which is not how a strong player plays;
- the elite level (`human.band === "elite"`) swipes a little faster (10 ticks, near-perfect 11), misreads traffic a
  little less, takes tighter gaps (6 ticks of margin, 12 before) and goes for every coin (detour up to 100 ticks).

Reaction, timing, lag and slips all still come from `Human`.

## Features (crossRev 9)

- **13 lanes and the island**: a crossing is 14 rows; the island banks it (a later hit restarts there, 1 s pause).
- **Gold coins**: 20 a run, four on each of crossings 1–5, in the fastest two traffic lanes of each half (never
  roadworks), on column 2 or 10, open in the lane below. Standing on the cell takes it. 3 skill points.
- **Traffic**: a crossing's car lanes share one density schedule (above); buses, motorbikes, cyclists and roadworks
  are drawn as parked.
- **Buses and motorbikes**: as parked.
- **Streak**: each crossing without a hit raises it; the multiplier is min(4, streak), and each such crossing adds
  multiplier − 1 skill points (0, 1, 2, 3, 3, …); a hit ends it.
- **Score**: play `bandPoints(CROSS_V9_BAND_CURVE, rows + 2 × crossings)` (≤ 150) + `bandPoints(CROSS_V9_SKILL_PAY,
  3 × coins + streak points)` (≤ 50), capped at `roundMaxFor("cross")`. No input scores 0.

Every appearance is fixed by the seed: each crossing's course (lanes, speeds, gaps, phases, riders) and its coins are
laid out at init, and each crossing's traffic runs on that crossing's own clock (from the end of its kerb pause). The
only thing a player's play decides is which crossing they reach; the crossing they meet is the same for everyone.

## The ceiling proof (perfect play reaches 200 on every seed)

`scripts/cross-ceiling.ts`: an oracle plays every crossing on the shortest path that takes all of its coins (a
time-layered breadth-first search over lane, column, hop up or down, and coins taken, against the course's real
traffic; each crossing's best path depends on its course alone), then the last crossing as deep as the clock allows.
The path becomes an input log played through the real sim and the server replay.

| Seeds | Inputs | Ceiling (min) | Below 200 | Coins (min) | Crossings (min) | Streak points (min) |
|---|---|---|---|---|---|---|
| Tuning 0–59 | any tick (the sim's limit) | **200** | 0 | 20 / 20 | 10 | 24 |
| Fresh 60–259 | any tick | **200** | 0 | 20 / 20 | 8 | 18 |
| All 260 | ≥ 8 ticks apart (about 7 swipes a second) | **200** | 0 | 17 | 5 | 9 |

So the full skill pay (66 raw) is reached on every seed with room to spare (≥ 78 raw), and the play part's 150 too.
`cross-x200-check` replays 6 sampled seeds this way and stores one oracle run (seed index 1000) that scores 200
through the server replay.

## Tuning (paired: the same seeds and the same human for both revisions, every run through the server replay)

`bun scripts/arcade-skill-bands.ts cross --rev=x --levels=weak,average,good,great,near,elite --seeds=60 --jobs=1` and the
same with `--from=60 --seeds=200`. "Old" is crossRev 7 (rooms' revision before, `strictRev`). The curves were fitted on
the 60 tuning seeds only (`scripts/cross-x200-bands.ts`, which also prints crossings, coins and streaks per level).

**Tuning seeds (0–59)**

| Level | crossRev 9 median / p90 / best | (old median) | change | zeros new / old |
|---|---|---|---|---|
| Weak | 61 / 88 / 117 | (61) | 0 % | 0 / 0 |
| Average | 75 / 101 / 128 | (74) | +1 % | 0 / 0 |
| Good | 101 / 152 / 163 | (96) | +5 % | 0 / 0 |
| Great | 126 / 172 / 185 | (116) | +9 % | 0 / 0 |
| Near-perfect | **166 / 187** / 193 | (126) | +32 % | 0 / 0 |
| Elite | **178 / 193** / 195 | (145) | +23 % | 0 / 0 |

**Fresh seeds (60–259)**

| Level | crossRev 9 median / p90 / best | (old median) | change | zeros new / old |
|---|---|---|---|---|
| Weak | 61 / 83 / 116 | (59) | +3 % | 0 / 0 |
| Average | 73 / 97 / 134 | (68) | +7 % | 0 / 0 |
| Good | 97 / 148 / 186 | (93) | +4 % | 0 / 0 |
| Great | 133 / 174 / 192 | (111) | +20 % | 0 / 0 |
| Near-perfect | **159 / 189** / 193 | (130) | +22 % | 0 / 0 |
| Elite | **183 / 193** / 195 | (145) | +26 % | 0 / 0 |

What the levels do (fresh seeds, medians): crossings 2 / 3 / 3 / 4 / 4 / 4; coins 1 / 1 / 3 / 5 / 8 / 11 of the 20;
lives lost 2 / 2 / 1 / 1 / 1 / 1.

Lowest perfect-play ceiling: 200 on both sets. Random play (uniformly random swipes, about 4 a second, 20 seeds):
median 2, max 5.

### Second iteration (after the coordinator's review)

The first version (one commit earlier) measured near-perfect 165 / 190 tuning and 156 / 189 fresh, elite 188 / 193
and 170 / 193. Tried, gated on crossRev 9, fitted on the tuning seeds and then checked on the fresh ones:

1. **One density schedule a crossing** (done): the seed no longer decides how hard crossing k is, only its
   arrangement. Elite's fresh median rose 170 → 183.
2. **Finer base units**: already per row (a crossing's 14 rows each count 1, plus 2 a crossing), so nothing to change.
3. **Coins a similar detour** (done): column 2 or 10 only.
4. **Lost-life cost**: not changed. A hit already costs time (back to the pavement or island) and the streak; the
   spread at the top that keeps near-perfect's p90 high comes from runs that lose nothing and take many coins, which a
   cheaper life would not narrow.

### Against the bar

- Good within ±10 % of before: yes (+5 % tuning, +4 % fresh).
- Great between good and near-perfect, near-perfect above great, elite above near-perfect: yes, on both sets.
- No zero for weak or average play; random play near 0: yes.
- Elite top 10 % 190–200: yes (193 / 193). Elite median ≥ ~175: **yes** (178 tuning, 183 fresh).
- Near-perfect median 165–175: yes on tuning (166), **no on fresh (159)**. Near-perfect p90 ≤ ~185: **no (187 / 189)**.

**Still not fully met, on near-perfect only.** Near-perfect's spread stays wide (its units run 36–94 on the tuning
seeds even with every crossing equally hard: the bot's own hits and how its timing meets each arrangement), and good,
great and near-perfect reach nearly the same depth (median units 58 / 65 / 69 tuning), so the separation has to come
from coins, whose count for near-perfect still runs 2–14. An offline search over smooth curves (≤ 4 points a unit on
the play curve, ≤ 2.6 a skill point on the pay) on the tuning seeds found no curve with near-perfect's p90 under 187
while its median stays at 165 and good within ±10 %; the curves above are its best. A curve with a cliff could hit
the tuning numbers but would not hold on fresh seeds or with real players, so I stopped there.

## Checks

New: **cross-x200-check** (~65 s; `CROSS_X200_CEILING_SEEDS` raises the ceiling sample): legacy crossRev 3 and 7
identity (40 runs recorded on main before the expansion, unchanged since the parked branch), crossRev 9 fixture
replay (37 runs: six at each of the six levels and the oracle's 200, re-recorded on the second iteration), determinism, server = phone, rooms deal crossRev
9, courses (14 rows, the island, buses, motorbikes, passable and fair), exactly 20 coins a run on 60 seeds with four on
each of crossings 1–5 and none later, on open columns, one density schedule per crossing (40 seeds), every coin of
crossing 1 taken by a walker on three seeds, coin, island and streak rules tick by tick, bounds of buses
and motorbikes (2 px), the skill pay (rising, capped at 50, 15 points pay at most 8), no input scores 0, the
ceiling, room identity, random play.

`scripts/room-identity/cross.ts` exports `scheduleOf(seed, rev, events)` and `roomIdentity` (logs: idle, random,
weak bot, elite bot). **Jaywalk's schedule is on the crossing clock**: each entry's `t` is the crossing number
(0 = the first) and `what` spells out that crossing's course and coins as the run meets it; two logs agree over the
crossings both reached (so a shared check should compare each list with the longest one's prefix, not by tick).

Run, each by itself, all passing: cross-x200-check, round-max-check, scoring-bands-check, scoring-targets-check,
scoring-rev3-check, reveal-score-check, replay-check, practice-bests-check, arcade-self-replay-check (the six Jaywalk
entries, 40 runs each), arcade-fx-check, arcade-help-bands-check, intro-score-text-check, six-game-scoring-check,
arcade-batch1-check, arcade-tuning-f2-check, arcade-score-bands-check, sound-manifest-check, reveal-marker-check;
`tsc --noEmit` clean. Browser checks (arcade-play, arcade-room-practice, arcade-lowend, arcade-fill, bottom-clearance,
presentation-geometry) were not run (left to the coordinator).

## Shared files touched (Jaywalk's lines only)

- `src/lib/duel/roundMax.ts` (cross: 200); `scripts/round-max-check.ts` ("cross" in RAISED).
- `src/lib/arcade/liveBands.ts`: cross → `rev: CROSS_REV_EXPAND, curve: CROSS_V9_BAND_CURVE, strictRev: CROSS_REV_STRICT`.
- `src/lib/duel/arcade.server.ts`: `generateCross` deals crossRev 9.
- `src/lib/duel/instructions.ts`, `introScore.ts`: the help (coins, island, streak, buses, the skill pay line) and intro.
- `src/lib/duel/introDemo.functions.ts`: a demo not recorded on crossRev 9 stays stopped (the intro shows its still).
- `src/lib/duel/grade.ts` (`coins`, `streakPts` in a crossRev 9 round's extra) and `roundSummaries.ts` (a detail line).
- `src/lib/arcade/revealRenderers.ts` (the reveal's world height from the stored revision),
  `arcadeFxGames.renderer.ts` (COIN!, CHECKPOINT!, STREAK ×n; `crossFxFor`, `CROSS_FX_TALL` in `ARCADE_FX_SPECS`),
  `src/lib/fx/gameSounds.ts` (crossSounds only), `src/lib/replay/moments.ts` (three cross rows, appended),
  `src/lib/fx/manifest.ts` + `docs/sound-cues/replays.md` + the cue sheet (the three replay-moment cues).
- `docs/arena-sizes-oct-2026.md`: Jaywalk's four rows (390×727) as the parked branch's presentation-geometry-check wrote them.
- `src/lib/duel/practiceStamps.data.ts` (regenerated), `scripts/fixtures/replay-runs.json` (one crossRev 9 run appended).
- Checks: `arcade-fx-check` (cross plays crossRev 9; three bumps), `arcade-self-replay-check` (entry `cross/expand`
  appended at index 129, ENTRY_COST 16.9), `arcade-batch1-check` (the intro line), `arcade-tuning-f2-check`
  (`movedOn.cross`).
- `scripts/arcade-skill-bands/bots/cross.ts` (above).

## Assumptions and notes for the merge

- Other x200 branches may also append an arcade-self-replay entry at index 129 and an ENTRY_COST line; renumber on merge.
- The intro demo needs re-recording on crossRev 9 (stopped until then, as the parked branch did).
- The parked screenshots were not carried over (they show the old HUD); `scripts/shots/cross-expand-shots.ts` redraws them.
- `bun scripts/practice-stamps.ts` again after the merge.
