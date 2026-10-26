# x200 · Wavefront to 200 (wavRev 10)

26 Oct 2026. Wavefront is raised to 200 (`ROUND_MAX.wavefront`, docs/scoring-200.md) under the arcade rule agreed with
Joe on 26 Oct: every seed deals the same opportunities (the seed decides only where and when), and better play always
earns more. Rooms, practice, the daily and challenges deal **`wavRev 10`** (`WAV_REV_EXPAND`, "World expansion" in
`src/lib/arcade/wavefront.ts`); every older stamp (unstamped, 2–8) plays and scores exactly as before (its step
function is untouched; the new rules live in `stepX`, and every shared helper that knows about them is gated on the
state's `x10` marker). The parked version (`origin/claude/e8-parked`, PR #163, wavRev 9) was never merged or dealt;
this is it renumbered and reworked, with no code path for 9.

## What changed from the parked wavRev 9, and why

| Parked (wavRev 9) | Now (wavRev 10) | Why |
|---|---|---|
| A power-up dropped from whichever saucer, armour core or boss cannon the player shot down (one at a time, seeded kind from the play's own stream) | **9 power-ups on the run's seeded plan** (`wavPlan(seed)`): one in each 5.5 s slot from 4 s (a seeded moment in the slot's first 2.5 s, a seeded x from 40 to 350), three of each kind in a seeded order, falling from the top at 4 px a tick; the last falls before 51 s and only one is ever on screen. Nothing the player shoots drops one | The count depended on play; now every player in a room sees the same power-ups at the same moments and places |
| Saucer side, wave ships drawn from the play's shared stream | Saucer sides from the plan; each wave's ships from that wave's own stream (`waveShapes`) | The shared stream advances with enemy fire and dives, which depend on play |
| Core open for half of every 150 ticks from the boss's arrival | Half of every 150 ticks **of the run clock** | The same moments for every player |
| Streak ×2 from 8, ×3 from 16, ×4 from 24, unbounded points, every boss hit grew it | **×2 from 10, ×3 from 20, never more**; its points count at most 40 (`WAV_X_STREAK_CAP`); hull hits on a boss keep the streak but don't grow it (cannon and open-core hits do) | Can't snowball; the boss's big hull no longer hands everyone a free long streak |
| Edge curve on edge units (streak + core + cannons + power-ups + shield saves) that paid every level about the same | Skill points paid on a rising knot table (`WAV_X_SKILL_PAY`), saucers moved from the base units into skill points, cannons worth more | Skill separates: the full 50 only for elite play |
| Gun every 16 ticks | Every 14 ticks (`WAV_X_FIRE_EVERY`), still 3 centre bolts in the air | Strong players reach the mothership with time for its weak points (boss at ~78 s for near-perfect bots, ~61 s for the oracle) |
| Base curve fitted by quantile matching (steep 296→300: 80→110) | A new base curve on units without saucers | The parked curve's cliff made the good median swing −7 % / +31 % between seed sets |

Kept from the parked version: the 390 × 800 arena (`WAV_X_H`), 36-ship waves (6 × 6, then the Tuning A shapes with six
escorts), the gunship after wave 3 (16 hp, counts as a wave) and the mothership after wave 5 (36 hp), two cannons a
boss (4 hits each) and the core (×3 damage open), spread (8 volleys) and shield (12 s), the faster bolts (11 px) and
red fire, the art, HUD, sounds and screen fill.

## Scoring (wavRev 10)

- **Base**: ships + armour hits + 15 a cleared wave (the gunship too) + every boss hit point, on
  `WAV_V10_BAND_CURVE` (250 → 50, 270 → 58, 290 → 66, 300 → 75, 310 → 90, 320 → 112, 330 = everything → 140).
- **Finish**: destroying the mothership adds up to 10 for speed (full within 20 s of its arrival, as wavRev 5–8).
- **Skill points** (`wavSkillRaw`): the streak's points (1 a hit at ×2, 2 at ×3, up to 40) + 2 a power-up caught + 3 a
  saucer + 8 a cannon destroyed + 2 an open-core hit; paid on `WAV_X_SKILL_PAY` (70 pay 3, 84 pay 10, 94 pay 18,
  100 pay 28, 108 pay 42, the full 50 at 118). Incidental use pays little; the last 30 points need elite play.
- Total `bandTotal(parts, acted, 200)`; no input scores 0. With no skill points a perfect run scores 150.

## Perfect-play ceiling (guaranteed opportunities)

Every seed deals the same items: 180 ships, the same armour, two bosses (16 + 36 hp, 4 cannons), 9 power-ups (three of
each kind, all before 51 s), saucers at 15, 30, 45, 60 and 75 s. Counted for a flawless player (every unit → 140, a
quick kill → 10, skill points: streak cap 40 + 9 power-ups 18 + the 4 saucers before 60 s 12 + 4 cannons 32 + the 13
open-core hits the bosses' hit points allow once their cannons are down 26 = **128 ≥ 118**, so 50): **200 on every one
of the 260 seeds** (lowest 200 on the 60 tuning seeds and on the 200 fresh seeds). `wavefront-expand-check` proves the
count on all 260 (the plan's counts, kinds, spacing and timing, then the formula).

Reachability: a scripted look-ahead player (`scripts/wavefront-expand-ace.ts`, an oracle, not a human model) plays the
real sim; the stored seed-0 run scores **200** through the server replay (boss down at 61.6 s, 3 lives). Its coarse
mode (`--fast`, a coarser search) over all 260 seeds,
as a lower bound on what is reachable: it destroys the mothership on **260 / 260** seeds, clears every unit on 243, and
scores 200 on 132 (32 of 60 tuning, 100 of 200 fresh); lowest 176 (tuning) / 179 (fresh), median 200, ≥ 190 on 58 / 60
and 187 / 200. Where it falls short it is a few skill points (its 72-tick look-ahead misses a cannon or a core window),
not a missing opportunity: the counted ceiling is 200 on every seed.

## Tuning (skill-band bots, paired: the same seeds, every run through the server's encode + replay)

`bun scripts/arcade-skill-bands.ts wavefront --rev=x --levels=weak,average,good,great,near,elite --seeds=60 --jobs=1`
and the same with `--from=60 --seeds=200`. "Old" is wavRev 8 (LIVE_BANDS' `strictRev`, max 150) on the same seeds.
New: median / p90 (p10, best).

| Seeds | Level | New (max 200) | Old median / p90 | Median change |
|---|---|---|---|---|
| Tuning (60) | Weak | 60 / 75 (53, 133) | 59 / 79 | +2 % |
| Tuning (60) | Average | 76 / 121 (62, 164) | 68 / 139 | +12 % |
| Tuning (60) | Good | 92 / 160 (70, 167) | 100 / 150 | −8 % |
| Tuning (60) | Great | 124 / 168 (79, 188) | 125 / 150 | −1 % |
| Tuning (60) | Near-perfect | 166 / 185 (95, 200) | 139 / 150 | +19 % |
| Tuning (60) | Elite | 179 / 194 (143, 200) | 140 / 150 | +28 % |
| Fresh (200) | Weak | 61 / 76 (55, 156) | 62 / 73 | −2 % |
| Fresh (200) | Average | 72 / 140 (61, 164) | 68 / 123 | +6 % |
| Fresh (200) | Good | 98 / 159 (71, 181) | 95 / 150 | +3 % |
| Fresh (200) | Great | 141 / 176 (79, 193) | 125 / 150 | +13 % |
| Fresh (200) | Near-perfect | 167 / 186 (92, 200) | 136 / 150 | +23 % |
| Fresh (200) | Elite | 178 / 192 (120, 200) | 139 / 150 | +28 % |

- No zero scores at any level (0 of 1,560 runs); no run flagged or disagreeing with the server replay.
- Good is steady on both seed sets (−8 % / +3 %; the parked version's base curve alone gave −7 % / +31 %).
- Paired (same seed), the higher level scores more on: average > weak 46/60 and 155/200, good > average 40/60 and
  144/200, great > good 38/60 and 137/200, near > great 48/60 and 137/200, elite > near 41/60 and 119/200.
- **Random play** (uniformly random drags every 8–22 ticks, `randomLog` in `scripts/room-identity/wavefront.ts`, 260
  seeds): median 6, p90 16, max 28 (wavRev 8: 12 / 28 / 40). Idle scores 0.
- Bar: good within ±10 % ✓; near-perfect median 166 / 167 (165–175 ✓), p90 185 / 186 (at about 185, one point over
  on the fresh set); elite p90 194 / 192 (190–200 ✓), median 179 / 178 (≥ 175 ✓); great between good and near ✓.
- Bot (`scripts/arcade-skill-bands/bots/wavefront.ts`, wavRev 10 only, older revisions play exactly as before): weak
  points aimed at by level, `MOVE_ON` (a player who counts the bolts already in flight moves on from a column they
  will empty: weak 5 %, average 15 %, good 35 %, great 60 %, near 80 %, elite always), and the elite band goes for every
  power-up and saucer. All aim, timing and reaction still go through `Human`.

## Room identity

`scripts/room-identity/wavefront.ts` exports `scheduleOf(seed, rev, events)` (every planned power-up, with its tick,
kind and x, and every saucer, with its tick and side, seen while replaying the log) and `roomIdentity` (logs: idle,
random drags, the weak bot, the elite bot). `wavefront-expand-check` proves on three seeds that all four logs see the
same entries over the ticks both runs lived, and the same ships in every wave both reached.

## Checks run

Each run by itself (`bun scripts/<name>`), all **PASS**: wavefront-expand-check (1,738 checks), round-max-check,
scoring-bands-check, scoring-targets-check, scoring-rev3-check (one run failed only its grading-time limit, 484 ms,
while four cores were busy; PASS on a quiet re-run), reveal-score-check (.tsx), replay-check, practice-bests-check,
arcade-self-replay-check (wavefront entries), arcade-fx-check, arcade-help-bands-check, intro-score-text-check,
six-game-scoring-check, arcade-score-bands-check, arcade-batch3-check, arcade-tuning-a-check, arcade-tuning-c-check,
arcade-tuning-g1-check; `tsc --noEmit` on src clean. Not run (the coordinator's, browser): arcade-play-check,
arcade-room-practice-check, arcade-lowend-check, arcade-fill-check, bottom-clearance-check, screenshots.

## Shared files touched (Wavefront lines only)

- `src/lib/duel/roundMax.ts` (wavefront: 200); `scripts/round-max-check.ts` ("wavefront" in RAISED).
- `src/lib/arcade/liveBands.ts`: wavefront → `rev: WAV_REV_EXPAND, curve: WAV_V10_BAND_CURVE, strictRev: WAV_REV_STRICT`.
- `src/lib/duel/arcade.server.ts` (`generateWavefront` deals wavRev 10), `src/lib/duel/introDemo.functions.ts` (the
  demo plays only on wavRev 10; none is recorded, so the intro shows its still — **needs re-recording**),
  `src/lib/duel/instructions.ts` and `introScore.ts` (the wavefront blocks), `src/lib/duel/practiceStamps.data.ts`
  (regenerated).
- `src/lib/arcade/arcadeFxGames.renderer.ts` (Wavefront's spec: "GUNSHIP DOWN!", the gunship's width, the live
  world's 800 height), `src/lib/arcade/arenaFills.renderer.ts` (Wavefront's fill a deep navy beside the taller world),
  `src/lib/fx/gameSounds.ts` (Wavefront's observer: pickup, shield clank, streak blip; existing cues only).
- Older checks, Wavefront lines only ("rooms deal" and wording following the change): `arcade-batch3-check`,
  `arcade-tuning-a-check`, `arcade-tuning-c-check` (saucers now "3 a saucer"), `arcade-tuning-g1-check` (rooms deal,
  the fx height, the demo line).
- `scripts/fixtures/replay-runs.json`: one wavRev 10 run appended.

Game-only files: `src/lib/arcade/wavefront.ts`, `wavefront.renderer.ts`, `src/lib/duel/wavefront.ts`,
`src/puzzles/wavefront.tsx`, `scripts/arcade-skill-bands/bots/wavefront.ts`, `scripts/wavefront-expand-{check,ace,bands,record}.ts`,
`scripts/fixtures/wavefront-expand-{legacy,runs}.json.gz`, `scripts/room-identity/wavefront.ts`. The parked
`devWarp` hook and its e8 screenshots tool were left out.

## Assumptions and notes

- Power-ups fall on the run clock, not per wave: a per-wave schedule would move with each player's clearing pace,
  which the arcade rule forbids. All nine fall before 51 s, long before anyone reaches the mothership.
- Formation waves and the bosses still arrive when the stage before is cleared (that is the game); what each brings is
  fixed by the seed.
- The legacy fixture (32 runs on every older revision) was recorded on the parked branch's base, whose Wavefront code
  is identical to main's.
- Frame rate: not re-measured here (the coordinator runs arcade-play / low-end checks); the parked notes measured
  33–34 fps at 4× on 390 × 844 for the same world and ship counts (above the 30 fps floor, below main's 44.6).
