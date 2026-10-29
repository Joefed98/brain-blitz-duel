# Rainbow Bridge on the arcade scoring standard (inkRev 12, 29 Oct 2026)

Rooms deal **`inkRev 12`**. Play is inkRev 11's exactly (Joe's phone notes, 27 Oct 2026: no wind, two silver coins a
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
