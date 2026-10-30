# Swish on the arcade scoring standard (binRev 9, 29 Oct 2026)

Rooms deal **binRev 9** (`BINTOSS_REV_STD`, `binTossStdGame`). It plays binRev 8 exactly (the same fairground, ten
throws, winds, slides, narrowing, far buckets on throws 1–6, hoops over them, spinners on three of throws 6–10, the
60 % far bucket and close misses), with one change to the deal (exactly three hoops, below) and a new score.

## Parts (Joe's row: "core up to 130 = 13 per bucket; a near miss counts 1 (within the 130). Far buckets 36 (6 each, throws 1–6). Hoops 24 (8 each of 3). All ten in 10.")

| Part | Key | Max | How it pays |
| --- | --- | --- | --- |
| Buckets | `core` | 130 | 13 a bucket (either bucket), plus 1 for each missed throw that came close (binRev 8's close miss: the ball crossed the rim line within 28 px of a bucket's mouth), held to 130 |
| Far buckets | `far` | 36 | 6 for each far basket; the far bucket stands only on throws 1–6 |
| Hoops | `hoops` | 24 | 8 for each of the 3 hoops gone through and then into a bucket (binRev 3's swish) |
| All ten in | `finish` | 10 | every one of the ten throws in a bucket |
| **Total** | | **200** | |

- `score = stdScore(binTossStdParts(state), acted)`: 0 with no input, else the sum held to 1…200. Integer maths only.
- No curve, multiplier or rising scale: binRev 8's `BINTOSS_V7_BAND_CURVE` (units through knots to 142) is not used.
  The core line is `BINTOSS_V9_BAND_CURVE = bandCurve([0, 10], [0, 130])` (13 a bucket).
- A far basket is still a basket (13 + 6) and a swish is still a basket (13 + 8): no feature costs core. A close
  miss is only ever a missed throw, so buckets + close misses never pass 10 and the core never needs its 130 cap in
  real play (the cap is there as Joe's row says).
- No speed part (the round has no speed rule; the 60 s clock is unchanged).

## Core target

A fixed-maximum game (ten throws), so the core is full at all ten buckets (`fullAt = 10`), as the lead's
interpretation says. For reference, the skill-band tool's `near` level (default fixed bots, `--rev=now`) has a median of
**8 buckets** on the tuning seeds 0–59 and 9 on fresh seeds 10000–10099; fullAt stays at the game's maximum, 10.

## What changed in play

- **Exactly three hoops.** binRev 8's hoop draw picks three of throws 2–5, but `placeHoop` drops a picked hoop no
  makeable throw fits: about one seed in six had two or fewer (20,000 seeds: 16,574 with 3, 3,235 with 2, 182 with 1,
  9 with none). binRev 9 keeps every binRev 8 draw and every hoop binRev 8 placed, then, for each picked throw whose
  hoop was dropped, makes further seeded draws on the same stream (after every binRev 8 draw): up to 16 tries at a
  new height and arc over the same throw's far bucket (`BINTOSS_V9_HOOP_TRIES`). Only if all 16 fail does the hoop
  move to one of throws 7–10 (`BINTOSS_V9_MAIN_HOOP_FROM`; no far bucket there, spinner-free throws first, seeded
  order) and hang over the main bucket. Every one of 20,000 seeds then has three hoops, and none needs the fallback.
  Fixed at init from the room seed, the same for every player.
- **200 is reachable on every seed.** Every hoop on throws 1–6 (binRev 8's and the re-placed ones) hangs over the far
  bucket, placed on a makeable throw through it into the far bucket, so one throw can earn the far bucket and the hoop
  together; a main-bucket hoop can only stand on throws 7–10, where there is no far bucket to give up.
  bintoss-standard-check proves this on 20,000 seeds (`binTossV9HoopOver`) and proves 79 sampled hoops with a launch.
- Correction to the first version of this note: it said about 3 % of seeds topped out at 192 with a hoop over the main
  bucket. That came from classifying hoops by the nearer bucket (a far-bucket hoop may sit up to 60 px towards the
  main bucket); in fact the main-bucket fallback was never used on those seeds. The rework moved the fallback to
  throws 7–10; the deal on every measured seed is unchanged (the stored binRev 9 runs replay to the same scores and
  states), so the medians below stand. The flawless level's occasional 192 is the bot missing, not the deal.
- States add `std: 1` (folded into the checkpoint checksum last), so older states and checksums are unchanged.

## Texts and display

- Help SCORE: `liveStdHelp("bintoss", "Ten throws, the same for everyone.")`; the How lines say far +6 and hoops +8.
- Intro SCORE: "Buckets 13, far buckets +6, hoops +8. All 10 in for 10 more: up to {max}."
- The far bucket's pennant and the "FAR n · +x" HUD line show 6 a far basket on binRev 9 (`binTossFarEach`,
  `binTossFarShown`); binRev 7 and 8 keep +9.
- Reveal: the standard's lines (one per part, then the total); a "Far buckets n / 6" tile (grade extras `far` and
  `close`, set on binRev 9 only).
- Intro demo: only a binRev 9 demo plays (`introDemo.functions.ts`); **the demo needs recording on binRev 9.**

## Skill bot

`scripts/arcade-skill-bands/bots/bintoss.ts`: on binRev 9, a hoop re-placed over the main bucket is aimed at on a main
throw (a player going for the far bucket leaves it). Every older revision plays as before.

## Medians (skill-band tool, `--rev=now --levels=all`, default bots)

Tuning seeds 0–59 (`--seeds=60`):

| Level | binRev 8 (before) | binRev 9 (after) |
| --- | --- | --- |
| Weak | 63 | 58 |
| Average | 83 | 81 |
| Good | 106 | 94 |
| Great | 131 | 112 |
| Near-perfect | 175 | 144 |
| Elite | 185 | 164 |
| Flawless | 200 | 200 |
| Zeros (all levels) | 0 | 0 |

Fresh seeds 10000–10099 (`--from=10000 --seeds=100`):

| Level | binRev 8 (before) | binRev 9 (after) |
| --- | --- | --- |
| Weak | 59 | 55 |
| Average | 83 | 80 |
| Good | 105 | 94 |
| Great | 148 | 118 |
| Near-perfect | 176 | 152 |
| Elite | 185 | 172 |
| Flawless | 200 | 200 |
| Zeros (all levels) | 0 | 0 |

The top no longer bunches: binRev 8's near-perfect and elite sat 10 apart (175 / 185) under the curve's flat top;
binRev 9's straight line spreads them 20 apart (144 / 164) and 36 below flawless. Every level rises.

## Checks

- `scripts/bintoss-standard-check.ts`: binRev 8 and 7 replays of 42 skill-band runs recorded on 99115b0
  (`scripts/fixtures/bintoss-standard-legacy.json.gz`) replay to the same score and state; rooms deal binRev 9 from
  binRev 8's draws with exactly three hoops and every hoop on throws 1–6 over the far bucket (20,000 seeds; 200 reachable on each), sampled hoops proved makeable into the bucket they hang over (~50 s in all); the same log plays the same
  on binRev 8 and 9; 42 stored binRev 9 runs (`scripts/fixtures/bintoss-standard-runs.json.gz`, `--record=<dir>` from
  a skill-band `--save`) replay to their scores, with the reveal's lines adding up.
- `scripts/arcade-standard/bintoss.ts`: arcade-standard-check's case (the core line on `baskets`; All ten in reads
  the per-throw `results`).
