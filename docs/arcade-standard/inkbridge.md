# Rainbow Bridge on the arcade scoring standard (inkRev 12, 29 Oct 2026; inkRev 13, Nov 2026; inkRev 14, 3 Nov 2026)

## inkRev 14 (3 Nov 2026): a bigger coin, clovers and birds

Rooms deal **`inkRev 14`** (`INK_REV_BIG`, one above inkRev 13) since 3 Nov 2026, from a proved deal. Joe's audit on an
iPhone 11 (414×896): the birds, the coin and the clover were too small to read. Everything else is inkRev 13's (its
section below): the same rules, features, counts and parts.

**What changed (inkRev 14 only).** The coin's radius 7 → **10 px** (`INK_V14_BALL_R`), the clover's pickup radius
9 → **12 px** (`INK_V14_SHAMROCK_R`), the birds 6.5 → **10 px** thick (`INK_V14_BIRD_H_FP`; their boxes' widths are drawn
one bird every 24 px, was 18). These are collision sizes, so this is a gameplay stamp: the art is drawn to them exactly
(the coin and clover painters scaled to their circles, the flocks to their boxes; ink-v14-check proves every drawn
pixel within 2 px of the bounds and the bounds filled). The live levels' no-draw ring is the coin's diameter (20 px).
Each inkRev 14 level carries its sizes (`ballR`, `cloverR`), and the sim plays and builds with them (`withSizes` /
`withLevelSizes` in `src/lib/arcade/inkBridge.ts`: the radii are module values set for a level's tick or a build and put
back after; older levels carry none, so every older stamp plays, builds and scores exactly as before: ink-v14-check
replays inkRev 13 runs and inkRev 10–13 level digests recorded on main, `scripts/fixtures/ink-v14-legacy.json.gz`).

**Every level is built and proved with the bigger sizes**: generation's own proofs (each level drawable as a phone draws
it and holding for a hand, the coin never potting unaided, the cloud and clover bonus lines proved, the live levels'
hand-drawn strokes potting, also 5 ticks late) run with the 10 px coin and the 10 px birds. Bird counts stay inkRev 13's.

**The deal** (`src/lib/duel/inkBigDeal.server.ts`, `INK_BIG_DEAL`, built by `bun scripts/ink-big-deal.ts [--check]`):
100 seeds, each with every level's proof passing (two clovers, four clouds, two live levels, every ink par at least its
proved line's ink) and the oracle's perfect run (`scripts/ink-x200-oracle.ts`) replaying through the server to exactly
200, every part at its maximum; witnesses in `scripts/fixtures/ink-big-deal-witness.json.gz`. **0 of the first 100
candidates dropped** (100 kept). Rooms deal `inkBigDealSeed(arcadeSeed())`; `pinInkPreBig(true)` deals inkRev 13 on any
seed for the checks written for it (`pinInkPreClover` still deals inkRev 12).

## The parts (sum 200, inkRev 13's exactly: `INK_V14_STD`)

| Part | Max | How it counts |
| --- | ---: | --- |
| Levels (core) | 120 | 12 a level potted, 10 levels (a fixed maximum): `stdLine(120, levels, 10)`. |
| Ink par | 30 | 3 a level potted within its par, a straight line to 0 at twice par. |
| Trick shots | 20 | 5 each of 4. |
| Clovers | 10 | 5 each of 2. |
| Speed | 20 | Only with all ten levels potted: full with 50 s left, 0 at the buzzer. |

Core target: full at all 10 levels (a fixed maximum). No "full at" figure was retuned.

## Skill bands, before (inkRev 13) → after (inkRev 14)

`bun scripts/arcade-skill-bands.ts inkbridge --rev=now --levels=all --seeds=30 [--from=10000]` (paired seeds, every run
through the server replay; before = inkRev 13's table below):

| Level | Target | Tuning seeds 0–29 | Fresh seeds 10000–10029 |
| --- | --- | --- | --- |
| Weak | 30–60 | 58 → 58 (30–78) | 56 → 59 (30–76) |
| Average | about 90 | 89 → 88 (57–107) | 88 → 83 (58–105) |
| Good | 120–140 | 121 → 125 (107–149) | 119 → 122 (86–143) |
| Great | about 160 | 163 → 158 (137–174) | 162 → 159 (122–172) |
| Near-perfect | about 175 | 180 → 182 (167–191) | 181 → 183 (170–195) |
| Elite | 185–195 | 188 → 191 (179–198) | 195 → 193 (175–198) |
| Flawless | 200 | 200 → 200 (199–200) | 200 → 200 (196–200) |

The bigger sizes barely move the bands (the levels are re-proved with them, so a level is no harder to draw, only easier
to see). Every target is met but near-perfect, 7–8 above "about 175" as on inkRev 13; moving points from the core lowers
elite as much (inkRev 13's fit), so the parts are kept. The skill-band flawless bot dips to 196 on a few fresh seeds (a
moving-pot release it misjudges by a tick); the deal's guarantee is the oracle's 200 on every entry.

## Display (every revision; no hitbox or sim change)

- The HUD is the shared HUD pills (`src/lib/arcade/hudPill.renderer.ts`): **Level 3 / 10** top left (the main count),
  then **Ink 18 · par 54** (the ink this level has taken, then its par; red over par) on inkRev 13 and 14, or **Misses
  1 / 3** on older revisions, and the ink left as a rainbow bar in a pill (**Left**). A second row only on live levels:
  a gold **LIVE** pill (it was a DOM tag over the same spot) and **Line limit** once the first line reaches its cap.
- **DROP AGAIN** shows only while a drop is under way (the only time it does anything: it ends that drop as a miss).
  Undo, Reset and Release are unchanged; the row keeps its 48 px height.
- The help quotes the new readout. The intro demo stays stopped until one is recorded on inkRev 14
  (`introDemo.functions.ts`).

## Proofs

ink-v14-check (~75 s; `CHECKS_FULL=1` replays all 100 deal witnesses, ~4 min): the deal and pins, LIVE_BANDS and the
spec, legacy replay and digests, the sizes in the sim and the art, every level's proofs on deal and fresh seeds, the deal's
perfect runs at 200 with every part full, the rules, recorded inkRev 14 runs (`scripts/fixtures/ink-v14-runs.json.gz`) and
the replay-runs entry, scoring floors and room identity. arcade-standard-check's entry plays the oracle on three deal seeds.
arcade-self-replay-check: `ink/big` appended at the end.

---

Rooms dealt **`inkRev 13`** from Nov 2026 until inkRev 14 (its section is at the end). Until then rooms dealt **`inkRev 12`**. Play is inkRev 11's exactly (Joe's phone notes, 27 Oct 2026: no wind, two silver coins a
level, the pickups spread out): an inkRev 12 state is inkRev 11's plus `std: 1`, which is outside the checkpoint
checksum, so an inkRev 11 input log replays tick for tick on inkRev 12. Only the score changed. inkRev 11 and every
older stamp replay and score exactly as before (ink-v11-check, ink-x200-check and the legacy checks).

Code: `INK_REV_STD`, `INK_STD`, `inkStdScore`, `INK_V12_BAND_CURVE`, `inkBridgeStdGame` at the end of
`src/lib/arcade/inkBridge.ts`, on the shared `src/lib/arcade/arcadeStandard.ts`.

## The parts (sum 200)

| Part | Max | How it counts |
| --- | ---: | --- |
| Levels (core) | 140 | 14 a level potted, 10 levels (a fixed maximum): `stdLine(140, levels, 10)`. |
| Speed | 10 | Only with all ten levels potted: full with 45 s (2,700 ticks) or more left, 0 with 0 s left, a straight line between (`stdSpeed`, floored). |
| Ink stars | 20 | 2.5 each of 8 (one on each of levels 1–8): `floor(20 × stars ÷ 8)`. |
| Trick shots | 12 | 3 each of 4 (the four cloud levels): `floor(12 × tricks ÷ 4)`. |
| Shamrock | 10 | The run's one shamrock. |
| Silver coins | 8 | 0.5 each of 16 (two on each of levels 1–8): `floor(8 × silver ÷ 16)`. |
| All-ten bonus | 0 | None. |

Core 140 + features 60 = 200. No mistake costs points (a failed drop uses one of the three tries, as before; three end
the run). A run with no input scores 0; any input scores at least 1 (`stdTotal`). The skill-pay curve
(`INK_V11_SKILL_PAY`) and the band curve are gone for this revision; every part is a straight line or a fixed share.

## Item counts, confirmed against the sim

inkRev 11 deals, on every seed (generation keeps a level only when every feature is placed and proved, so the counts
never vary; ink-v11-check proves them on its sample seeds): 8 ink stars (`INK_BONUS_LEVELS` = levels 1–8), 4 trick
shots (`INK_CLOUD_LEVELS`), 1 shamrock, and **16 silver coins** (`INK_V11_SILVER_PER_LEVEL` 2 × 8 levels; 24 was
inkRev 10's three a level). So the brief's 0.5 each of 16 applies as written; no adjustment was needed. Pickups count
only once the coin carrying them is potted (unchanged), so taking a feature never costs a level.

## Core target

The core has a fixed maximum (10 levels), so it is full at 10 levels; no near-perfect measurement was needed to set
it. For the help and bands the core curve is `INK_V12_BAND_CURVE = bandCurve([0, 10], [0, 140])` (one unit a level),
and the help's good run (100 points) is 8 levels. For the record, the Near-perfect bots' median is 10 levels (21 of
30 finish).

## Perfect run

The x200 oracle (`scripts/ink-x200-oracle.ts`), played on inkRev 12 and scored through the server's encode + replay,
pots all ten levels on their proved bonus lines with more than 45 s left and takes every ink star, trick shot, silver
coin and the shamrock: 200 on seed indices 0, 7 and 141 (arcade-standard-check), plus a built state with every
counter full. The skill-band tool's flawless level scores 200 on all 30 seeds.

## Skill bands after (inkRev 12)

`bun scripts/arcade-skill-bands.ts inkbridge --rev=now --levels=all --seeds=30 --jobs=1` (the bots' own `fixes`
setting; no bot changed: they read the state's rev 11 and play exactly as on inkRev 11):

| Level | Median | p10–p90 | Levels potted (median) | Finished |
| --- | ---: | --- | ---: | ---: |
| Weak | 28 | 14–59 | 2 | 0 / 30 |
| Average | 31 | 14–56 | 2 | 0 / 30 |
| Good | 52 | 28–115 | 3.5 | 0 / 30 |
| Great | 96 | 55–161 | 6 | 8 / 30 |
| Near-perfect | 178 | 120–192 | 10 | 21 / 30 |
| Elite | 190 | 152–200 | 10 | 26 / 30 |
| Flawless | 200 | 200–200 | 10 | 30 / 30 |

The medians rise at every level, with clear gaps at the top (178 → 190 → 200). Weak and average sit close together
(both bots usually pot two levels on these seeds), as they did on inkRev 11.

## Other changes

- Rooms deal inkRev 12 (`generateInkBridge`), LIVE_BANDS lists it with `INK_V12_BAND_CURVE` (strictRev 8 kept),
  practice's definition generates it, the server replay (`replayInkBridgeRun`) maps 12 to its own run.
- `inkX`, `inkSilverPerLevel`, `inkWindLevels` and `buildLevels` treat 12 as 11 (the world height, input ranges, live
  levels and art read the puzzle's stamp).
- Help: the SCORE text states every part with its maximum and that they total 200; the intro line names them.
- Reveal: the band parts are `stdBandParts` (`"7 / 10 levels → 98"`, then e.g. `"Speed 4 · Ink stars 15 · Silver
  coins 3 +22"`); no skill words.
- Intro demos: a demo recorded on inkRev 11 or 12 plays (the play and HUD are the same).
- Older checks that pinned "rooms deal inkRev 11" now compare `playRevOf("inkbridge", dealt)` with 11 (`LIFT_REVS`
  maps 12 → 11 in `scripts/scoring-targets-revs.ts`); arcade-tuning-c-check's pinned good-run wording moved to the new
  help ("pots 8 levels"); room identity is measured on the dealt stamp (12).
- arcade-self-replay-check: `ink/std` appended at the end.

## Left for the coordinator

`scripts/fixtures/replay-runs.json` needs a stored inkRev 12 run (replay-check reports "no stored run on the revision
rooms stamp today" until then) and `practiceStamps.data.ts` needs `inkRev=12`.

# inkRev 13 (Nov 2026): clovers, ink par, more birds

Joe's brief: remove the ink stars and silver coins; keep an occasional clover (the shamrock art), placed off the easiest
line and worth a small fixed amount; a new feature, ink par, paid for potting a level within the level's par; more birds
now the screen is clearer; rebalance to 200 and the skill-band targets. Rooms deal **`inkRev 13`** (`INK_REV_CLOVER`,
one above inkRev 12). inkRev 12 and every older stamp build, replay and score exactly as before (ink-v13-check replays
inkRev 12 runs and inkRev 10–12 level digests recorded on main; ink-v11-check and ink-x200-check pass unchanged in what
they prove). Code: the end of `src/lib/arcade/inkBridge.ts` (`INK_V13_STD`, `inkV13Score`, `inkBridgeCloverGame`) and
`buildLevelsRev10` with `INK_SPEC_13`.

## What changed in play (inkRev 13 only)

- **No ink stars, no silver coins, no wind.** The levels are inkRev 11's world (674 tall, the same gravity, clouds,
  moving pots and live levels).
- **Two clovers a run** (`INK_V13_CLOVERS`), on two seeded levels of 1–8 (the first is inkRev 11's shamrock level, the
  second drawn after it). A clover sits where inkRev 11 put the level's ink star: the point of the level's proved bonus
  line farthest from the easy route (at least 52 px off it on a plain level, `INK_V11_STAR_OFF_ROUTE`; the top of the
  bounce, at least 40 px off, on a cloud level), so it is proved exactly as a star was (`staticProof`, the same pickup
  circle). It counts once the coin is potted, as before.
- **More birds** (`INK_V13_EXTRA_BIRDS` = 0, 1, 1, 2, 2, 2, 2, 2, 1, 1 by level): the warm-up level keeps its count, the
  others gain one or two (live levels one), and a level is never thinned to fewer than one more than its base count while
  layouts are tried. Measured on 20 seeds: 37.2 birds a run on inkRev 12, 55.8 on inkRev 13 (per level 3.0, 4.0, 5.0,
  5.4, 5.3, 6.3, 6.2, 7.0, 6.8, 6.9). All from the seed, the same for everyone.
- **Ink par** on every level (`InkLevel.inkPar`, px): the ink of the line the level's proof plays (the bonus line on a
  cloud or clover level, else the easy line, whichever is longer; on a live level the pre-release line plus the
  hand-drawn live stroke), drawn as a phone draws it, plus `INK_V13_PAR_MARGIN_PCT` (10 %), never more than the level's
  ink (it never comes to that: the par is at most 1.1 × inkRev 10's ink, the budget 1.25 ×). The HUD shows it beside the ink meter as **"Ink 84 / par 90"** (red once over par; it takes the fail dots' place).
  A potted level earns ink-par credit per mille (`inkParCredit`): 1000 within par, a straight line down to 0 at twice
  par. Undo gives ink back, so only the potted attempt's ink counts.
- **A quarter more ink** on every level (`inkBudgetFor`: inkRev 10's ink × 5 / 4; live levels' shared supply likewise),
  so every ink par sits inside the level's ink and a wasteful line can go over it (with inkRev 12's ink, a bonus line's
  par plus its margin often reached the whole budget). Levels are still proved within inkRev 10's ink.
- **A failed drop never ends the run** (it clears the lines and costs time; the clock ends the run). inkRev 12 ended
  the run at three failed drops; with more birds the weaker players would have stopped after two levels.
- **The 0-undrawable guarantee holds**: generation keeps a layout only when its proofs pass (every level's easy line
  holds for a hand and the coin never pots unaided; a cloud or clover level's bonus line pots, bounces, takes the
  clover; a live level's hand-drawn stroke pots, also 5 ticks late). ink-v13-check proves it on five tuning and fresh
  seeds; a sweep of 160 seeds (0–119, 10000–10039) found no level failing and every run with exactly 2 clovers and 4
  cloud levels.
- Trick shots are kept as they were (the brief did not mention them): a pot after bouncing off one of the run's four
  clouds.

## The parts (sum 200)

| Part | Max | How it counts |
| --- | ---: | --- |
| Levels (core) | 120 | 12 a level potted, 10 levels (a fixed maximum): `stdLine(120, levels, 10)`. |
| Ink par | 30 | 3 a level potted within its par: `stdLine(30, credit, 10 000)` over the per-mille credit. |
| Trick shots | 20 | 5 each of 4. |
| Clovers | 10 | 5 each of 2 (a small fixed amount). |
| Speed | 20 | Only with all ten levels potted: full with 50 s left, 0 at the buzzer, a straight line between. |

Core 120 + features 80 = 200. Nothing costs points. No input scores 0; any input at least 1. Earning a feature never
costs core (features count only on a potted level). LIVE_BANDS lists inkRev 13 with `INK_V13_BAND_CURVE` (12 a
level), as inkRev 12 was listed (the help reads the band curve and `stdFeaturesHelp`); the help says "A good run (100 points) pots 9 levels". Intro line: "Levels 120; little ink 30,
tricks 20, clovers 10. All 10 levels quickly: up to 200." (83 characters; intro lines avoid the word "par",
intro-score-text-check).

The maximums were fitted on the bots' runs (`bun scripts/ink-v13-bands.ts`, which re-scores saved rows with `--fit`):
moving points from the core to speed and trick shots lowers the near-perfect median but lowers the elite one as much
(the near-perfect and elite bots differ mainly in one clover and ten seconds), so 120 / 30 / 20 / 10 / 20 with speed
full at 50 s is the closest to the targets that keeps elite in 185–195.

## Perfect run

The oracle (`scripts/ink-x200-oracle.ts`, rev 13 branch) draws each level's proved line (the bonus line on a cloud or
clover level, else the easy line) and the live levels' hand-drawn strokes, all within par: 200 through the server replay
on every seed tried (12 tuning seeds in the tool, five in ink-v13-check, three in arcade-standard-check). The skill-band
tool's flawless bot plays the same proved lines on inkRev 13 (a flawless player's knowledge): median 200 on both seed sets, lowest 197 (a moving-pot release moment it misjudges by a tick or two).

## Bots

`scripts/arcade-skill-bands/bots/inkbridge.ts`, on inkRev 13 only: a level's bonus line is tried where it takes
something (a cloud's trick shot or a clover), whatever the fails so far (they no longer end the run); a pot line within
the HUD's ink par (planned length at most 95 % of par) counts for `PAR_CARE` more when the player picks a line (weak 0,
average 0.5, good 1, great 1.5, near 2, elite 2.5 wobbles); the flawless player draws the level's proved lines.

## Skill bands, before → after

`bun scripts/arcade-skill-bands.ts inkbridge --rev=now --levels=all --seeds=30` (paired seeds, every run through the
server replay; before = inkRev 12 on main, after = inkRev 13):

| Level | Target | Tuning seeds 0–29 | Fresh seeds 10000–10029 | Levels potted (after) |
| --- | --- | --- | --- | --- |
| Weak | 30–60 | 28 → 58 (28–75) | 28 → 56 (28–74) | 4 |
| Average | about 90 | 31 → 89 (58–122) | 43 → 88 (71–105) | 6 |
| Good | 120–140 | 52 → 121 (89–157) | 56 → 119 (72–150) | 8 |
| Great | about 160 | 110 → 163 (136–175) | 118 → 162 (143–171) | 10 |
| Near-perfect | about 175 | 179 → 180 (172–193) | 178 → 181 (169–195) | 10 |
| Elite | 185–195 | 190 → 188 (179–200) | 193 → 195 (187–200) | 10 |
| Flawless | 200 | 200 → 200 | 200 → 200 | 10 |

Every target is met but two, narrowly: near-perfect sits about 5–6 above "about 175" (180–181), and good on the fresh
seeds is 119 (one under 120). The gap from near-perfect to elite is 8 on the tuning seeds and 14 on the fresh ones.
Finished runs (all ten levels): good 8 / 30 and 5 / 30, great 24 / 30 and 26 / 30, near-perfect 29 / 30 on both.

## Left for the coordinator

`scripts/fixtures/pending-replay-run-inkbridge.json` is one inkRev 13 run for `scripts/fixtures/replay-runs.json`
(replay-check reports "no stored run on the revision rooms stamp today" until it is appended), and
`practiceStamps.data.ts` needs `inkRev=13`. The intro demo stays stopped until one is recorded on inkRev 13.
