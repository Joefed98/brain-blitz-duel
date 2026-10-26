# x200: Rainbow Bridge to 200 (inkRev 10)

26 Oct 2026. Rainbow Bridge (`inkbridge`) deals **inkRev 10** (`INK_REV_EXPAND`), scored to 200 (`ROUND_MAX`
inkbridge 200) under the arcade rule agreed with Joe on 26 Oct: every seed deals the same opportunities (the seed
only places them), and better play always earns more. It finishes the version parked on `claude/e1-parked` (PR #165)
as inkRev 9, which was never merged or dealt; that number is not used (no code path keeps it). Every older stamp
(unstamped, inkRev 2–8) replays and scores exactly as before.

## What changed from the parked version, and why

The parked inkRev 9 had the taller world, bounce clouds and gold stars, but:

- **No wind zones, shamrock or silver coins** (Joe's list): added.
- **Opportunities varied by seed** ("up to 5" cloud levels, "most" levels with a star, and a bonus shared out over
  however many there were): now fixed counts on every seed.
- **The near-perfect bot potted about half the levels** (median 5 of 10, median ~98): bot bugs and levels whose
  proved lines only worked drawn exactly. Fixed on both sides (below); near-perfect now pots all ten in most runs.
- **No zero-score floor for weak play**: level 1 is now a warm-up.

## The world and the levels

- 390 × 674 (`INK_TALL_H`), inkRev 3's layouts with the pot 54 px lower, gravity scaled 620/674 (59; 50 on live
  levels), 9 % more ink (as parked).
- **Every proof is a hand's line** (`inkPhoneLine`): generation draws every line as a phone sends it (a point every
  12 px, whole px), so a line that only works drawn exactly (a near-vertical stretch breaks into wall pieces) is
  never a proof. A level's reference line must still pot moved 3 px each way (three of four, `lineHolds`) and, on a
  moving pot, from a release in the middle of a window that pots (`steadyRelease`); level 1's must hold at 6 px and
  never be near-vertical. A layout that cannot carry all of this is replaced by the next (the accept hook in
  `buildLevelsRev3`, inkRev 10 only).
- **Live levels (9–10) are proved by hand** (`handLive`, `liveHand` on the level): the pre-release line, then a catch
  ramp under the coin's fall drawn from 20 ticks after RELEASE at a point a tick through the real `step`, also potting
  started 4 ticks early or 5 late, moved 3 px each way and with its far end 5 px either side. The coin stalling on a
  line fails in generation as it does in play (`dropWithHit` applies the step's progress rule).
- **Level 1 is a warm-up**: a missed drop there costs no fail (`INK_WARMUP_LEVELS`); three misses on levels 2–10
  still end the run.

## Features (fixed counts, every seed)

| Feature | Per run | Where | Raw points |
|---|---|---|---|
| Ink star | 8 (one on each of levels 1–8) | On the level's bonus line, at its point farthest from the easy route | 5 |
| Silver coin | 24 (3 on each of levels 1–8) | Spread along the bonus line, off the easy route | 2 |
| Shamrock | 1 (a seeded level of 1–8) | On that level's bonus line, far from the route and the star | 20 |
| Bounce cloud / trick shot | 4 levels | The bonus line bounces off it (pot after the bounce: a trick shot) | 5 |
| Wind zone | 3 levels (never a cloud level) | Over part of the bonus line's flight; the bonus line rides it ≥ 10 ticks | – |

- A level's **bonus line** (`starRef` / `starT0`) is proved like the reference (a hand's margin, its own release) and
  takes the star (after the bounce on a cloud level), passes every silver coin and the shamrock. Pickups count only
  once the coin is potted on that drop. Raw maximum 128 (`INK_FEATURE_RAW_MAX`).
- **Wind** (`InkWind`): while a coin in the air has its centre inside the zone, `ax` (14–27 /256 px a tick², seeded
  sign) is added to its horizontal speed each tick; a coin rolling on a line is held by the line. The reference
  line must still hold in the wind.
- Placement: the kinds are drawn from the feature stream (`seed ^ 0x9c10d5`); a cloud or wind that cannot fit a
  level's layout passes to the next level still plain, so the counts never change. Nothing is ever spawned from
  play: the whole run is built at init (room identity below).

## Scoring (inkRev 10)

- Base: levels on `INK_V10_BAND_CURVE` (0, 22, 32, 40, 47, 54, 61, 72, 88, 110, 140 for 0–10 levels) plus up to 10
  for speed on finishing (the full 10 with half the time left).
- Features: raw points paid on `INK_V10_SKILL_PAY` (20 pay 4, 40 pay 10, 60 pay 18, 80 pay 27, 100 pay 35, 115 pay
  42, the full 50 needs all 128), so incidental pickups pay little and 50 needs every bonus.
- Total = base + paid, capped at 200; no input scores 0.
- The curve is steep at the top because every player pots more levels than on inkRev 8 (the lines are now
  hand-proved): it keeps a good player within ~10 % of their inkRev 8 score while near-perfect and elite players,
  who pot all ten, land at 165–180.

## The perfect-play ceiling (proof)

`scripts/ink-x200-oracle.ts` plays each seed flawlessly: every level's proved line (levels 1–8 the bonus line, 9–10
the pre-release line and the hand-drawn live stroke) as a phone sends it, RELEASE as soon as the line is drawn (a
moving pot: the first tick that pots with everything taken), and scores the log through the server's encode +
replay. **All 260 skill-band seeds (indices 0–59 tuning, 60–259 fresh) score 200** (lowest 200 on both sets; every
run all ten levels and raw 128). ink-x200-check proves it on sample seeds and replays two stored perfect runs.

## Tuning (paired: the same seeds and humans on inkRev 8 and inkRev 10)

The skill-band bot (`scripts/arcade-skill-bands/bots/inkbridge.ts`) through the server replay,
`bun scripts/ink-x200-bands.ts` (rows per run; `--fit` re-scores them on today's curves). New: median / p90 / best;
old: inkRev 8's median with the same (fixed) bot; zero-score runs new / old; runs potting all ten levels.

**Tuning seeds (0–59)**

| Level | inkRev 10 (max 200) | inkRev 8 median | Change | Zeros new / old | All ten |
|---|---|---|---|---|---|
| Weak | 32 / 55 / 88 | 33 | −3 % | 0 / 17 | 0 / 60 |
| Average | 42.5 / 88 / 148 | 51 | −17 % | 0 / 11 | 1 / 60 |
| Good | 61 / 145 / 157 | 65 | −6 % | 0 / 6 | 6 / 60 |
| Great | 118 / 163 / 177 | 91 | +30 % | 0 / 2 | 26 / 60 |
| Near-perfect | 166 / 183 / 191 | 111 | +50 % | 0 / 1 | 46 / 60 |
| Elite | 178 / 193 / 200 | 122 | +46 % | 0 / 1 | 51 / 60 |

**Fresh seeds (60–259, never used for tuning)**

| Level | inkRev 10 (max 200) | inkRev 8 median | Change | Zeros new / old | All ten |
|---|---|---|---|---|---|
| Weak | 32 / 54 / 90 | 33 | −3 % | 0 / 71 | 0 / 200 |
| Average | 47 / 88 / 144 | 51 | −8 % | 0 / 37 | 2 / 200 |
| Good | 72 / 143 / 155 | 65 | +11 % | 0 / 27 | 21 / 200 |
| Great | 110 / 157 / 182 | 83 | +33 % | 0 / 17 | 72 / 200 |
| Near-perfect | 166.5 / 181 / 194 | 105 | +59 % | 0 / 8 | 142 / 200 |
| Elite | 178 / 190 / 200 | 121 | +47 % | 0 / 6 | 185 / 200 |

**Random input** (uniformly random strokes, RELEASE, UNDO and live strokes at a human-ish rate,
`ink-x200-bands.ts --random`): RANDOM_LINE.

Against the bar: good within about ±10 % of before (−6 % tuning, +11 % fresh); near-perfect median 166 / 166.5 with
p90 183 / 181; elite median 178 / 178 with p90 193 / 190; no zero for weak or average play (inkRev 8 had 17–71); great
between good and near-perfect. The inkRev 8 medians here are with the fixed bot (the coordinator's earlier figures,
good 51, used the old one); the old bot played inkRev 8's moving pots and long lines below its level.

### Bot fixes (all revisions, `bots/inkbridge.ts`)

- A line's angle error now leaves its far end about one aim error out (it was swung about its start by aim/150 rad,
  so a long line's end strayed two to three aim errors).
- A moving pot's release is the middle of the longest window that pots (it was the first of 12 phases that potted,
  the window's edge), and the wobble test on a moving pot releases there with the pot moving (it tested a still pot).
- A new attempt after every missed drop (keyed on the miss, so level 1's free misses replan).
- inkRev 10 only: planned lines are sampled with the sim's `inkPhoneLine` (the proofs' model); on live levels the
  catch ramp is aimed where the coin is seen to fall (`liveRescue`, the fall followed from the drop as it is, then
  drawn with the live aim error); a level's bonus line is tried on a first attempt at the level's rate (`BONUS_GO`:
  weak 5 %, average 10 %, good 30 %, great 60 %, near-perfect 85 %, elite always) when it holds up to the wobble
  test (`BONUS_MIN_REL`).

## Room identity

`scripts/room-identity/inkbridge.ts`: `scheduleOf(seed, rev, events)` replays a log and lists every level's seeded
features with their places (all dealt at init, t = 0), throwing if the levels ever change in play; `roomIdentity.logs`
gives idle, random, weak-bot, elite-bot and perfect logs. ink-x200-check proves the lists identical.

## Checks run

RUN_TABLE

## Shared files touched (Rainbow Bridge's lines only)

- `src/lib/duel/roundMax.ts` (inkbridge 200); `scripts/round-max-check.ts` (inkbridge in RAISED).
- `src/lib/arcade/liveBands.ts`: inkbridge `rev` INK_REV_EXPAND, `curve` INK_V10_BAND_CURVE, `strictRev` INK_REV_STRICT.
- `src/lib/duel/arcade.server.ts` (rooms deal inkRev 10), `introDemo.functions.ts` (only an inkRev 10 demo plays; the
  intro shows its still until one is recorded), `instructions.ts` and `introScore.ts` (texts), `grade.ts` (extra
  detail: tricks, silver, shamrock on inkRev 10 only), `practiceStamps.data.ts` (regenerated).
- `src/lib/arcade/reveal.ts` (tiles), `revealRenderers.ts` (reveal height from `inkWorldHFor`),
  `arcadeFxGames.renderer.ts` (`inkBridgeFxFor`, `INKBRIDGE_FX_TALL`, TRICK SHOT! and SHAMROCK +20! events appended
  after the older ones), `src/lib/fx/gameSounds.ts` (cloud bounce, silver coin, shamrock on existing recordings),
  `src/lib/fx/manifest.ts`, `momentCues.ts`, `src/lib/replay/moments.ts`, `docs/sound-cues/*` (cue sheet regenerated).
- Older checks, Rainbow Bridge lines only: `arcade-batch5-check` and `arcade-tuning-c-check` ("rooms deal" now
  inkRev 10; the help's good-run figure), `arcade-fx-check` (the inkRev 10 art game and two bumps),
  `arcade-self-replay-check` (entry #129 `ink/v10`, appended, cost 14).
- `scripts/fixtures/replay-runs.json` (one inkRev 10 run appended); `docs/arena-sizes-oct-2026.md` (the 390 × 674
  rows from the parked branch, as presentation-geometry-check wrote them).
- `src/lib/arcade/inkBridge.ts`'s `capsuleContact` and `moveBall` gained a quick bounding-box miss (speed only: it
  skips exactly the segments the full test returns null for; every revision replays identically, proved by the legacy
  fixture, arcade-self-replay, replay-check and the older ink checks).

## For the coordinator

- **Level build time**: an inkRev 10 run is built in about 3 s on this shared 4-core machine under load (inkRev 8
  about 1.5 s the same way); the phone builds it at the start of a round. Worth timing on a phone after the merge.
- Browser checks not run here: arcade-play-check, arcade-room-practice-check, arcade-lowend-check (Ink Bridge is one of
  its five games), presentation-geometry-check, safe-area-screens-check, play-control-clearance-check,
  bottom-clearance-check, arcade-fill-check; and screenshots of the wind, silver coins and shamrock.
- The intro demo needs re-recording on inkRev 10.
- ink-x200-check takes ~2 min here under load (not added to a shard; it runs in the catch-all).
