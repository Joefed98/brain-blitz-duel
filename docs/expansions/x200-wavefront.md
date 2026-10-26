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

## Addendum (26 Oct, evening, Joe's notes): the boss earlier, weak-point precision, a played ceiling

- **The mothership by 78 s at the latest** (`WAV_X_BOSS_BY`): it still follows wave 5, but if a player hasn't got
  there by 78 s of the run clock, whatever is left of the formations (or the gunship) leaves without units and the
  mothership flies in. Every player gets at least 12 s with its weak points; a flawless player arrives by about 50 s.
  The same moment for everyone (run clock), never from how the player played.
- **Weak-point precision** (approved): a hit on a standing cannon or the open core pays precision points by how near
  its centre it lands (`wavPrecision`, integer px from the bolt's whole-px x to the centre: 3 within 1 px, 2 within 3,
  1 within 5, else 0), counted in `precise` and worth `WAV_X_SKILL_PRECISE` = 2 skill points each. Hull hits pay none.
- Base and skill pay refitted on today's bots (provisional, see below).
- **Reachability, played**: the look-ahead oracle (`scripts/wavefront-expand-ace.ts`; it now also tries the exact
  positions that put the next bolt on a weak point's centre, and falls back to plain play when it hides from a boss)
  played all 260 seeds; its runs are stored (`scripts/fixtures/wavefront-expand-oracle.json.gz`, packed by
  `--pack`) and `wavefront-expand-check` replays every one through the server: **lowest 200 on the 60 tuning seeds and
  200 on the 200 fresh seeds**. (259 seeds from the coarse `--fast` search; seed 229, 191 there, from the full search.)
- Bot changes stay in wavRev 10 paths only (the bot reads `seen.x10`); none were needed for precision (the existing
  per-level weak-point aim and `Human` aim error decide it), so they re-apply onto Session A's bots unchanged.

## Scoring (wavRev 10)

- **Base**: ships + armour hits + 15 a cleared wave (the gunship too) + every boss hit point, on
  `WAV_V10_BAND_CURVE` (250 → 29, 270 → 52, 290 → 53, 300 → 66, 310 → 93, 320 → 140; 330 is everything).
- **Finish**: destroying the mothership adds up to 10 for speed (full within 20 s of its arrival, as wavRev 5–8).
- **Skill points** (`wavSkillRaw`): the streak's points (1 a hit at ×2, 2 at ×3, up to 40) + 2 a power-up caught + 3 a
  saucer + 8 a cannon destroyed + 2 an open-core hit + 2 a precision point; paid on `WAV_X_SKILL_PAY` (up to 125 pay 0,
  150 pay 28, 170 pay 29, 190 pay 31, the full 50 at 210).
- Total `bandTotal(parts, acted, 200)`; no input scores 0. With no skill points a perfect run scores 150.

## Perfect-play ceiling

Counted: every seed deals the same items (180 ships, the same armour, two bosses of 16 + 36 hp with 4 cannons, 9
power-ups, five saucers); a flawless player's skill points come to at least 302 (the full 50 needs 210), so 200 on
every seed. **Played** (the arcade rule's proof): the oracle's stored run reaches 200 through the server replay on
every one of the 260 seeds (lowest 200 tuning / 200 fresh), checked by `wavefront-expand-check` each run.

## Tuning (provisional: today's bots; to be redone on Session A's fixed bots and flawless level)

`bun scripts/arcade-skill-bands.ts wavefront --rev=x --levels=weak,average,good,great,near,elite --seeds=60 --jobs=1`
and the same with `--from=60 --seeds=200`. "Old" is wavRev 8 (`strictRev`, max 150) on the same seeds, today's bots.
New: median / p90 (p10, best).

| Seeds | Level | New (max 200) | Old median / p90 | Median change |
|---|---|---|---|---|
| Tuning (60) | Weak | 52 / 76 (34, 140) | 59 / 79 | −12 % |
| Tuning (60) | Average | 89 / 117 (61, 172) | 68 / 139 | +31 % |
| Tuning (60) | Good | 102 / 151 (67, 178) | 100 / 150 | +2 % |
| Tuning (60) | Great | 128 / 178 (92, 179) | 125 / 150 | +2 % |
| Tuning (60) | Near-perfect | 166 / 180 (126, 200) | 139 / 150 | +19 % |
| Tuning (60) | Elite | 178 / 200 (134, 200) | 140 / 150 | +27 % |
| Fresh (200) | Weak | 54 / 81 (33, 150) | 62 / 73 | −13 % |
| Fresh (200) | Average | 84 / 129 (58, 164) | 68 / 123 | +24 % |
| Fresh (200) | Good | 95 / 150 (65, 178) | 95 / 150 | +0 % |
| Fresh (200) | Great | 135 / 178 (92, 190) | 125 / 150 | +8 % |
| Fresh (200) | Near-perfect | 163 / 185 (118, 200) | 136 / 150 | +20 % |
| Fresh (200) | Elite | 178 / 200 (135, 200) | 139 / 150 | +28 % |

- No zero scores (0 of 1,560 runs); none flagged. Good +2 % / +0 %. Near-perfect 166 / 163 (the fresh median two
  under 165), p90 180 / 185. Elite 178 / 178, p90 200 / 200. Great between good and near-perfect.
- Paired: average > weak 50/60 and 164/200, good > average 41/60 and 121/200, great > good 39/60 and 153/200,
  near > great 49/60 and 151/200, elite > near 42/60 and 127/200.
- **Random play** (`randomLog`, 260 seeds): median 3, p90 9, max 15 (wavRev 8: 12 / 28 / 40). Idle 0.
- The curves are fitted to these bots, whose pace is much alike (good, great and near reach the mothership within a
  few seconds of each other), so the base has a steep stretch (300 → 66 to 320 → 140) and the pay a flat middle.
  Both are expected to change when re-fitted on Session A's bots.
- Bot (`scripts/arcade-skill-bands/bots/wavefront.ts`, wavRev 10 only): weak points aimed at by level, `MOVE_ON`
  (weak 5 % … elite always), and the elite band goes for every power-up and saucer.

## Room identity

`scripts/room-identity/wavefront.ts` exports `scheduleOf(seed, rev, events)` (every planned power-up, with its tick,
kind and x, and every saucer, with its tick and side, seen while replaying the log) and `roomIdentity` (logs: idle,
random drags, the weak bot, the elite bot). `wavefront-expand-check` proves on three seeds that all four logs see the
same entries over the ticks both runs lived, and the same ships in every wave both reached.

## Checks run

Each run by itself (`bun scripts/<name>`), all **PASS** (re-run after the addendum): wavefront-expand-check (2,006 checks), round-max-check,
scoring-bands-check, scoring-targets-check, scoring-rev3-check (on the first pass one run failed only its grading-time limit, 484 ms,
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
