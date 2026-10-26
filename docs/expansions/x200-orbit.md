# Orbit to 200 under the arcade rule (orbitRev 12)

26 Oct 2026. Orbit's parked expansion (orbitRev 11, PR #164 on `claude/e7-parked`, docs/expansions/e7.md, never
merged or dealt) ported onto main, renumbered **orbitRev 12**, and finished under the arcade rule agreed with Joe
on 26 Oct: guaranteed opportunities on every seed, and skill headroom measured on paired seeds. Rooms, practice,
the daily and challenges deal orbitRev 12 (`ROUND_MAX.orbit = 200`); every older stamp replays and scores exactly
as before (orbit-expand-check replays 96 runs recorded on main before the change). There is no code path for 11.

## Kept from the parked version

- **More space.** A 450 × 782 view (was 390 × 650): about 40 % more area, the iPhone 11 home-screen box's shape,
  so one or two more planets are in view and the course reads further ahead. The view rides in the state
  (`viewW`, `worldH`); the camera (`orbitCamera.ts`) frames the next planet 360 px from the bottom.
- **The course**: orbitRev 10's proved 40-planet bank courses and black holes, dealt from the 371 courses of the
  feature bank (`orbitXpBank.server.ts`, `bun scripts/orbit-xp-bank.ts`, `scripts/orbit-xp-lib.ts`; room seed mod
  371). The bank is unchanged from the parked branch (its constants now live in the sim: `ORBIT_XP_TRAILS` etc.).
- **Features** (drawn in the Orbit style; glows skipped with reduced effects, still with reduced motion):
  - *Stardust trails*: 5 trails of 6 gold motes on a hop's best line; the rocket collects a mote it touches.
  - *Slingshot moons* (gravity assist): 4 small moons with a dashed teal ring 44 px round each; a flight that
    passes through the ring and leaves it without touching the moon is flung on at 1.5×. The moon's body crashes.
  - *Asteroid fields*: 3 lines of rocks across a hop (crash like belts, the checkpoint works); crossing the gap's
    dotted line threads the field.
  - *Perfect orbits*: a release during the first lap round a planet that lands (or enters a hole).
  - *Black holes*: unchanged.
- Sounds from the existing set (a tick per mote, a zap per slingshot, a chime per field, a ding per perfect orbit).

## What changed from the parked version, and why

> The curve, pay and pace numbers in this section are the first tuning, on the old bots. They were refitted on Session
> A's fixed bots (#175): see "Final tuning" at the end, which supersedes them. The mechanisms are unchanged.

1. **Partial credit** (Joe: the rocket was lost before the first planet too often, so average and good play scored
   0: on the parked version 2 average zeros on the tuning seeds and 10 on fresh ones). `reach` (orbitRev 12 only)
   is how far the furthest flight from the last planet reached got toward the next one: the rocket's position
   projected on the line between the two centres, in sixteenths, at most 15 (`orbitXpReach`, integer maths,
   reset when a new planet is reached). The base adds that share of the next planet's step
   (`orbitXpBasePoints`), so an early crash still scores for the distance it flew, and never as much as landing.
2. **Base curve** `ORBIT_V12_BAND_CURVE`: orbitRev 10's strict curve from 20 planets up, with a knot at 4 planets
   (0 / 4 / 12 / 20 / 30 / 36 / 40 → 0 / 32 / 74 / 100 / 117 / 139 / 140), so the first hops, now among rocks and
   moons, count a little more. Fitted with the skill pay below on the 60 tuning seeds.
3. **Skill pay on a rising scale.** The features' raw points (`orbitXpFeaturePoints`, as parked: 1 per 2 motes up
   to 15, 4 per slingshot up to 16, 4 per field up to 12, 1 per 3 perfect orbits up to 7; 50 at most) are paid on
   `ORBIT_V12_SKILL_PAY` (20 pay 14, 30 pay 28, 40 pay 36, 45 pay 46, 50 pay 50), so incidental motes and moons
   pay little.
4. **Full value only at elite pace.** Skill pays at most 40 (`ORBIT_V12_SKILL_PACED_FROM`) unless the sun is
   reached quickly: the last 10 come in a share from 10 s left to all 10 with 40 s or more left
   (`orbitXpSkillCap`). Every course's witness run finishes with at least 42.8 s left, so the ceiling stays 200.
   Near-perfect play that collects nearly everything but reaches the sun late (the near bot's median finish is
   ~55 s) no longer meets elite's top band; before this, near-perfect's top 10 % sat at 188–190 on fresh seeds.
5. **The elite bot** (stand-in for Session A's): near-perfect's tables, but it always goes for the features and
   the first-lap release (`FEATURE_TRY` / `FIRST_LAP` 1) and aims a tick closer to a window's edge (±1 instead
   of ±2 ticks of room); its motor skill is the elite profile's. Other levels are unchanged.
6. Results carry the features as flat numbers (`dust`, `slings`, `threads`, `perfect` and totals in the stored
   `extra`), the reveal shows them as tiles, and the reveal's lines state the partial credit and the skill pay.

Score: `base (curve + partial credit, 140 at most) + speed (10 with half the time left, as before) + skill paid
(≤ 50)`, capped at 200; no input scores 0 (`bandTotal`).

## The arcade rule

**Guaranteed opportunities.** Every course in the feature bank carries exactly 30 motes (5 × 6), 4 moons, 3 fields
and 3 black holes, and its stored witness tap log (built by the bank script on orbitRev 12 rules) replays through
the server to the sun with every feature taken and 21+ perfect orbits (a course has 22–30 hops), scoring 200. The
seed only decides which course, so where the features lie; never how many. Perfect-play ceiling, from the witness
replay of the course each seed index deals (orbit-expand-check):

| Seed set | Seeds | Lowest ceiling |
|---|---|---|
| Tuning | 0–59 | 200 |
| Fresh | 60–259 | 200 |

**Skill headroom.** Nothing in the sim spawns or moves from how the run is played: the course, holes and features
are fixed in the stored puzzle and the belts turn with the tick. `scripts/room-identity/orbit.ts` lists every
planet, hole, mote, moon and rock at t = 0 and every second the run lived each belt's opening and a digest of the
course the sim carries; idle, random, weak-bot and elite-bot logs on the same seed give the identical schedule
(orbit-expand-check, 36 / 36 pairs). Features pay on top of the base, at a rising scale, and fully only at elite pace.

## Tuning

Measured with the skill-band tool through the server's encode + replay, paired: both revisions on the same seeds,
the feature-bank courses rooms deal (`--rev=x`: "before" is orbitRev 10, the score-band revision rooms dealt, its
LIVE_BANDS `strictRev`):

    bun scripts/arcade-skill-bands.ts orbit --rev=x --levels=weak,average,good,great,near,elite --seeds=60 --jobs=1
    bun scripts/arcade-skill-bands.ts orbit --rev=x --levels=weak,average,good,great,near,elite --from=60 --seeds=200 --jobs=1

orbitRev 12 median / p90, best in brackets after, orbitRev 10's median [in brackets]:

| Seeds | Weak | Average | Good | Great | Near-perfect | Elite |
|---|---|---|---|---|---|---|
| Tuning (0–59) | 32 / 81 [40] | 79.5 / 106 [58] | 99.5 / 133 [101] | 139 / 177 [120] | **165 / 181** (198) [135] | **179.5 / 192** (200) [143] |
| Fresh (60–259) | 34.5 / 88 [37.5] | 69 / 103 [73] | 96 / 131 [100] | 136 / 173 [117] | **170 / 186** (198) [139] | **179 / 192** (199) [144] |

| Seeds | Zero scores, orbitRev 12 (orbitRev 10) | Lowest perfect-play ceiling | Good median vs before |
|---|---|---|---|
| Tuning | 0 of 360 (10: weak 4, average 4, great 2) | 200 | −1 % |
| Fresh | 0 of 1,200 (52: weak 27, average 16, good 5, great 3, near 1) | 200 | −4 % |

Paired levels on orbitRev 12 (same seeds): each level scores more than the one below on most seeds (tuning: weak →
average 41 / 60, → good 43, → great 48, → near-perfect 45, → elite 48; fresh: 126, 154, 143, 152 and 130 of 200),
median gains +33 / +16 / +31 / +22 / +12 (tuning) and +16 / +28 / +35 / +27 / +8.5 (fresh). Every level from
great up scores more on orbitRev 12 than on orbitRev 10 on most seeds (elite: 56 / 60 and 185 / 200).

**Random play** (uniform random taps every 0.25–1.5 s, 1,000 dealt courses): median 1, p90 8, best 44 (orbit-expand-check
asserts median ≤ 5 and p90 ≤ 20 on 200 courses).

**Against the bar.** Good within ±10 % of before (−1 %, −4 %) ✓. Near-perfect median 165–175 (165, 170) ✓; its top 10 %
181 and 186 (bar: at or under about 185; fresh is 1 over). Elite median ≥ ~175 (179.5, 179) ✓ and top 10 % 190–200
(192, 192) ✓. No zeros for weak or average play ✓ (partial credit). Great sits between good and near-perfect ✓ and
near-perfect out-scores great ✓. Random play near 0 ✓. Weak's median is 20 % under before on the tuning seeds (8 % on
fresh): the new rocks and moons crash weak flights more than the lifted first-hops knot gives back; average is +37 % /
−5 %.

What did not work (fresh seeds): the parked scoring with linear skill (no partial credit) gave near-perfect 172 / 190
and 11 average zeros; the rising scale alone left near-perfect's top 10 % at 188–190, because the near-perfect bot's
best runs take almost every feature and still reach the sun (late). Tying the last 10 of skill to reaching the sun
with 40 s left (elite pace: elite's median finish is ~43 s in, near-perfect's 55–63 s) brought it to 186 with elite's
p90 unchanged at 192. A stricter pace (full 10 only with 45 s left) would cut near-perfect more but the slowest
witness runs finish with 42.8 s left, so the ceiling would fall below 200 on some courses.

## Checks

Run locally, one process each (26 Oct 2026). No browser checks (the coordinator runs them after the merge).

| Check | Result |
|---|---|
| orbit-expand-check (new; legacy, ceiling on 260 seed indices, rules, recorded runs, room identity, random play) | pass (46) |
| round-max-check | pass |
| scoring-bands-check | pass |
| scoring-targets-check | pass |
| scoring-rev3-check | pass (a first run under heavy machine load failed its "a stored run took 264 ms to grade" timing line, a puzzle's; the rerun passed) |
| reveal-score-check | pass |
| replay-check | pass |
| practice-bests-check | pass |
| arcade-self-replay-check (orbit, orbit/v3, v4, band, tuned, swept, tall, xp) | pass |
| arcade-fx-check | pass |
| arcade-help-bands-check | pass |
| intro-score-text-check | pass |
| six-game-scoring-check | pass |
| arcade-score-bands-check | pass |
| arcade-chart-check | pass |
| intro-demo-check | pass |
| sound-manifest-check | pass |
| signature-beat-check | pass |
| four-tuning-check | pass |
| arcade-tuning-a-check, arcade-tuning-f-check, arcade-tuning-g3-check, arcade-batch5-check | pass |
| orbit-camera-check, orbit-legacy-replay-check, orbit-checkpoint-check, orbit-rev3-replay-check, orbit-outside-belt-check | pass |
| `tsc --noEmit` | clean |

## Shared files touched (Orbit's lines only)

- `src/lib/duel/roundMax.ts` (orbit: 200); `scripts/round-max-check.ts` ("orbit" in RAISED).
- `src/lib/arcade/liveBands.ts`: orbit's entry (`rev` orbitRev 12, `curve` ORBIT_V12_BAND_CURVE, `strictRev` 10).
- `src/lib/duel/types.ts` (`OrbitPuzzleData.extras`), `src/lib/duel/arcade.server.ts` (generateOrbit),
  `src/lib/duel/grade.ts` (extras to the replay; the features in `extra`), `src/lib/arcade/reveal.ts` (feature
  tiles), `src/lib/arcade/revealRenderers.ts` (the 450-wide view in the 390 box through `in390`),
  `src/lib/replay/steppers.ts`, `src/lib/arcade/arcadeFxGames.renderer.ts` (`ORBIT3_FX_XP`, the live spec at
  450 × 782), `src/lib/fx/gameSounds.ts` (inside `orbitSounds`), `src/lib/duel/instructions.ts`,
  `src/lib/duel/introScore.ts`, `src/lib/duel/introDemo.functions.ts`, `src/lib/duel/practiceStamps.data.ts`
  (regenerated), `scripts/fixtures/replay-runs.json` (one orbitRev 12 run appended), `scripts/replay-server-table.ts`.
- `scripts/arcade-skill-bands.ts` and `scripts/arcade-skill-bands/games.ts`: an optional `seedForX` on a game spec,
  used only by `--rev=x`, so both revisions are measured on the feature-bank courses rooms now deal (paired).
- Older checks, Orbit lines only: `arcade-self-replay-check` (an `orbit/xp` entry appended), `intro-demo-check`
  (extras), `arcade-tuning-a-check`, `arcade-tuning-f-check` (`movedOn`), `arcade-tuning-g3-check` (rooms deal
  orbitRev 12, its 782 effect height, the demo regex), `arcade-batch5-check` (rooms deal orbitRev 12).

## Intro, help and demo

Intro HOW: "Tap to let go; the next orbit catches you." / "Grab stardust; sling through moon rings." / "Thread rock
gaps; let go on the first lap." (checkpoint and black hole moved to the help). SCORE: "Planets and the sun, plus
stardust, slingshots, fields and perfect orbits: up to {max}." The help explains every feature, the partial credit,
the raw points and the pay scale (`skillPayLine`). **The intro demo needs re-recording on orbitRev 12**; until then
`introDemo.functions.ts` returns none and the intro shows its still.

## For the coordinator

- Browser checks not run here (as agreed): arcade-play-check orbit, arcade-room-practice-check, arcade-lowend-check
  (Orbit at 4× must stay ≥ 30 fps; the parked version measured 49.7 fps), arcade-fill-check, bottom-clearance,
  demo-intro-check, first-paint; and screenshots.
- Re-run `bun scripts/practice-stamps.ts` after the merge (committed here for this branch).
- `arcade-self-replay-check` gains an appended entry (`orbit/xp`); other branches may append too, so keep each.
- Measure tool: `bun scripts/arcade-skill-bands.ts orbit --rev=x --levels=weak,average,good,great,near,elite
  --seeds=60 --jobs=1` and `--from=60 --seeds=200`.

## Addendum (26 Oct 2026, Joe's notes from the test-bot session): provisional

**What changed.**
- *The near-perfect and elite plan* (`bots/orbit.ts`, orbitRev 12 only): the old plan took the first usable landing
  window in a lap. On figure-eights and belted orbits the windows fly different lines, and the features lie on one of
  them. A keen player now looks a little further (up to the plan's own scan) and takes the usable window whose safe
  ticks take the most feature points, keeping the first window on a tie. On 30 tuning seeds, raw feature points went
  from a median of 34 / 35 (near-perfect / elite) to 42 / 45 out of 50 (p90 50 / 50). Full stardust trails went from 3
  to 4 of 5, slingshots from 3 to 4 of 4. Other levels are unchanged. The change is one separate block, so it can be
  re-applied onto Session A's bots.
- *The ceiling, by play*: orbit-expand-check now deals the puzzle for each of the 260 seed indices as generateOrbit
  does (room seed, feature-bank course, its planets, holes and extras), plays it with its course's witness player and
  grades the run through the server replay on that puzzle. Lowest: **200** on the tuning seeds (0–59) and **200** on
  the fresh seeds (60–259).
- *Zeros*: with today's bots, partial credit already removes them: 0 of 360 tuning runs and 0 of 1,200 fresh runs,
  against 10 and 52 on orbitRev 10. Session A's average-level zeros (18 / 200) were on the parked scoring. A release
  that flies away from the next planet still scores 0, so Session A's harder bots need re-measuring.

**Provisional tables (today's bots plus the new plan; scoring unchanged).** orbitRev 12 median / p90 [orbitRev 10 median]:

| Seeds | Weak | Average | Good | Great | Near-perfect | Elite |
|---|---|---|---|---|---|---|
| Tuning (0–59) | 32 / 81 [40] | 79.5 / 106 [58] | 99.5 / 133 [101] | 139 / 177 [120] | 177 / 192 [135] | 182.5 / 196 [143] |
| Fresh (60–259) | 34.5 / 88 [37.5] | 69 / 103 [73] | 96 / 131 [100] | 136 / 173 [117] | 178 / 188 [139] | 183 / 197 [144] |

No level scores 0. With the better plan, near-perfect is now above the bar: median 177–178, p90 188–192, about 5
under elite's median. The skill pay and the elite-pace cap will be refitted on Session A's bots and flawless level;
final tuning waits for them, as agreed. Good is −1 % / −4 % against orbitRev 10 measured with the old bots.

## Final tuning (26 Oct 2026, Session A's fixed bots, #175)

**Merge.** Main (with #175) is merged in. The x200 tools now use main's `human.ts` (`ALL_LEVELS`, seven levels) with
no shim, plus `seedForX` for `--rev=x`. Orbit's bot is #175's fixed bot (the risk-judged windows on `fixes`; elite and
flawless protect the base) with the orbitRev 12 paths added on top. Every new path is gated on the state's `xp` marker,
so older stamps play exactly as main's bot, fixes on or off:
- the feature-aiming tick (`FEATURE_TRY`) and the first-lap release (`FIRST_LAP`), per-level tables with all seven keys;
- for near-perfect, elite and flawless, the window whose line takes the most features (with the fixes, only among
  windows under the level's risk);
- ±1 tick of room for elite and flawless.

The recorded runs (`orbit-x200-runs.json.gz`, 28 runs, weak to flawless, fixes on) and the replay-runs.json orbit run
were re-recorded on the final scoring. replay-runs.json keeps main's new stroop run as well.

**Final scoring on orbitRev 12** (no stored rounds exist on it, so it was refitted freely):
- Base `ORBIT_V12_BAND_CURVE`: planets 0 / 4 / 12 / 20 / 30 / 36 / 40 → 0 / 24 / 60 / 89 / 110 / 139 / 140, plus the partial
  credit (sixteenths of the next planet's step).
- The speed bonus is unchanged: up to 10 for the sun.
- Raw feature points, 50 at most:
  - stardust 15 for 28 of the 30 motes (`ORBIT_XP_DUST_FULL`, in proportion);
  - 4 per slingshot (16);
  - 4 per field threaded (12);
  - 1 per 3 perfect orbits (7).
- `ORBIT_V12_SKILL_PAY`: raw 20 pays 10, 30 pays 26, 44 pays 30, and 48 or more pays 50.
- Elite pace (`orbitXpSkillCap`): skill pays at most 24 unless the sun is reached quickly. The rest comes in a share
  from 35 s left to all of it with 2,560 ticks (42.7 s) left. The slowest witness finishes with 2,567 ticks left, so
  every course's ceiling stays 200.

Why the pace cap matters: with the fixed bots, near-perfect reaches the sun on 50 / 60 and 180 / 200 seeds. Its
fastest tenth finishes as quickly as elite's median, and finish speed is the one thing that separates the two levels.

**Tables.** Measured with `bun scripts/arcade-skill-bands.ts orbit --rev=x --levels=all --jobs=2`, tuning seeds 0–59
and fresh seeds 10000–10199, with fixes on. "Before" is the fixed bots on orbitRev 10 (`strictRev`), on the same
feature-bank courses. The scores are the tool's own logs (`--save`) replayed through the server on the final scoring.
The logs don't depend on scoring, because the bot never reads the score.

| Seeds | Weak | Average | Good | Great (med / p90) | Near-perfect (med / p90) | Elite (med / p90) | Flawless (med, lowest) |
|---|---|---|---|---|---|---|---|
| Tuning 0–59 | 23 [40] | 73 [73] | 112.5 [107] | 163 / 171 [139] | **171 / 179** [147] | **178 / 200** [150] | 189.5, 171 [150] |
| Fresh 10000–10199 | 25 [23] | 63.5 [70] | 99 [106] | 159.5 / 170 [135] | **172 / 184** [148] | **179 / 200** [150] | 190, 170 [150] |

| Seeds | Zero scores, orbitRev 12 | Zero scores, orbitRev 10 (fixed bots) | Good vs before | Lowest ceiling (oracle, server replay) | Flawless bot at 200 |
|---|---|---|---|---|---|
| Tuning | none at any level | weak 4, average 4, great 2 | +5.1 % | 200 | 17 / 60 |
| Fresh | none at any level | weak 17, average 18, good 5, great 4, near 1 | −6.6 % | 200 (also 200 on seeds 60–259) | 74 / 200 |

Random play (uniform taps every 0.25–1.5 s): median 1, p90 6, best 34 on 200 courses (orbit-expand-check).

**Session A's two points.**
- *Average scored 0 on 18 of 200 seeds.* That is orbitRev 10 itself with the fixed bots (18 average zeros on the
  fresh set above). On orbitRev 12 the partial credit leaves no zeros at any level.
- *Good +14 %.* With the fixed bots on both sides, on the same seeds, good is +5.1 % (tuning) and −6.6 % (fresh).

**Against the bar.**
- Met:
  - good within ±10 %;
  - near-perfect median 171 / 172, p90 179 / 184;
  - elite median 178 / 179, p90 200 / 200;
  - great between good and near-perfect, and near-perfect out-scores great;
  - no zeros for weak or average play;
  - random play near 0;
  - the oracle (each course's witness player, through the server replay) reaches 200 on every seed of 0–59, 60–259 and
    10000–10199.
- Not met: **the flawless bot reaches 200 on only 17 / 60 and 74 / 200 seeds** (median 189.5 / 190, lowest 171 / 170).
  It always reaches the sun, but its plan takes a median of 46–47 of the 50 raw feature points; it reaches 48 or more
  on only 26 / 60 and 94 / 200 seeds. Its first-lap and feature windows also wait for its reaction time, which the
  witness's instant releases don't.
- Making the flawless bot's own score reach 200 would need a better plan (for example searching the hole choices and
  windows for the most features), not a gentler curve. Any curve that pays its 46 raw points in full also pays elite's
  typical run in full, and puts elite's median at 200.
- Weak's median is 23 against 40 on the tuning seeds (25 against 23 on fresh).

Checks re-run after the final scoring (each alone): orbit-expand-check (the ceiling on all three seed sets, 28 recorded
runs), round-max-check, scoring-bands-check, scoring-targets-check, scoring-rev3-check (one run under load failed only
its "a stored run took 902 ms to grade" timing line, a puzzle's; the rerun passed), reveal-score-check, replay-check,
practice-bests-check, arcade-self-replay-check (all 8 Orbit entries), arcade-fx-check, arcade-help-bands-check,
intro-score-text-check, six-game-scoring-check, arcade-score-bands-check, arcade-chart-check, intro-demo-check,
arcade-tuning-a-check, arcade-tuning-f-check, arcade-tuning-g3-check and arcade-batch5-check all pass. `tsc --noEmit`
is clean.
