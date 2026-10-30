# Flightpath (`bullseye`) on the arcade scoring standard — bullRev 9

29–30 Oct 2026, batch B of the arcade scoring standard (`src/lib/arcade/arcadeStandard.ts`). Rooms deal **bullRev 9**
(was bullRev 8). Every older stamp replays and scores exactly as before.

## Parts (200 in all)

| Part | Max | How it pays |
| --- | --- | --- |
| Dart total (core) | 150 | Straight line: `floor(150 × min(total, 112) ÷ 112)`. The dart total exactly as bullRev 8 counts it: rings 10 / 9 / 8 / 3 / 2 / 1 from the centre out, 12 for the inner bull, +1 / +2 / +3 for each balloon popped on the way in. |
| Bull streaks | 30 | bullRev 8's streak points exactly ("as today"): the third gold 10 in a row +2, the fourth +4, the fifth +6 …, counted up to 30. |
| Dead-centre darts | 20 | 20 shared between the darts that have a dead-centre ring on this seed (the darts whose 10 is the middle ring, 6–9 of the 10, fixed at init from the seed): `floor(20 × hit ÷ darts)`, about 2 or 3 a dart. Hitting every one gives 20 on any seed. |

No speed part. A run with no input scores 0; any run that threw scores at least 1. No part costs points for a
mistake (a missed dart adds nothing and ends a streak, as on bullRev 8).

Both features are earned only by bulls (a dead-centre dart is always in the inner bull, and streak points come only
from bulls), so earning a feature never means giving up dart total.

## Two deviations from Joe's row, and why

Joe's row: "core up to 150 = dart total, full at 130 … Dead-centre 20 (2 per dart)". As written, no run on any seed
could score 200:

1. **Core full at 112, not 130.** A dart scores at most 12 (the inner bull), and only where the 10 is the centre
   ring: always on darts 1–6, on darts 7–10 only when the shuffle leaves it there. With the three balloons (+6) a
   seed's on-paper ceiling is 118–124. 130 is above every seed's.
   The lead first chose 118 (the lowest on-paper ceiling), but that ceiling counts every balloon popped *and*
   every dead centre hit, and often both can't happen on one dart. A balloon flies a seeded line across the board
   up to 65 % of the radius off centre, so on many darts it never covers the dead-centre ring. Playing the best
   possible run for real (`scripts/bullseye-best-run.ts`: ten bulls, every dead centre, every balloon that such a
   landing can also pop) gives a dart total of only 113–124 on the 260 tuning and fresh seeds. At 118, 96 of them
   (37 %) could not reach 200.
   112 is the guaranteed figure: ten bulls with every dead centre is `12 × k + 10 × (10 − k) = 100 + 2k`, and k
   (the dead-centre darts) is at least 6 on every seed. So a perfect run fills the core on **any** seed, balloons or
   not. bullseye-standard-check plays that run on all 260 seeds through the server replay: 200 on every one (lowest
   dart total 113).
2. **Dead-centre shared, not 2 a dart.** The dead-centre ring exists only on the darts whose 10 is the middle ring
   (6–9 a seed), so 2 a dart tops out at 12–18. Sharing 20 between those darts (the lead's decision) makes the full 20
   reachable on every seed: about 2.2–3.3 a dart.

The near-perfect skill-band level's median dart total is 109 on tuning seeds and 108 on fresh seeds, so 112 sits just
above near-perfect play. Elite's median is 112–113 and flawless 117–118.

## What changed

- **Scoring only.** Play is bullRev 8's exactly: `bullseyeInitRev9` is `bullseyeInitRev8` plus `std: 1` (every seeded
  draw unchanged), and the step is the same code. The marker folds into the checkpoint checksum last; bullRev 8's sums
  are unchanged.
- **Removed:**
  - bullRev 8's knotted dart-total curve (`BULLSEYE_V8_BAND_CURVE`), replaced by the straight line;
  - bullRev 8's 7 a dead centre (up to 42), replaced by the shared 20.
  - The bull streak keeps its rising +2, +4, +6 … steps because Joe's row says "as today" (capped at 30 as before).
- **Display:**
  - The renderer's "DEAD CENTRE +n" pop shows what that dart added (`bullseyeDeadEach`: its share on bullRev 9, the
    pops adding up to 20; +7 on bullRev 8).
  - bullRev 9 draws bullRev 8's taller range everywhere bullRev 8 did (`bullseyeTallRev`: the stage, the reveal
    renderer, the answer view).
  - The HUD line ("Dart n/10 · streak s · dead-centre d") shows no score and is unchanged.
- **Help:**
  - The SCORE text is `liveStdHelp`: the three parts and "Together 200 points.".
  - The How lines say a dead centre adds about +2 or +3, the 20 shared between the darts that have one.
  - The intro SCORE line ("Rings 10 / 9 / 8 / 3 / 2 / 1, inner bull 12; streaks, dead-centre add more. Up to {max}.")
    still reads right and is unchanged.
- **Reveal:** the arcade reveal's lines are the standard's parts (`stdLines`, the dead-centre line "d of n
  dead-centre"); tiles and axis unchanged. The grade extras' `deadPts` is bullRev 9's share.
- **Intro demo:** stays stopped until one is recorded on bullRev 9 (a bullRev 8 demo would show "+7" dead-centre pops).

## Medians before → after

Skill-band tool, `--rev=now --levels=all --jobs=2`. Before is bullRev 8 on the untouched tree; after is bullRev 9 with
the core full at 112 and the shared dead-centre. Zero scores: none at any level, before or after.

Tuning seeds 0–59 (`--seeds=60`):

| | Weak | Average | Good | Great | Near-perfect | Elite | Flawless |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Before (bullRev 8) | 56 | 77 | 103 | 141 | 172 | 181 | 200 |
| After (bullRev 9) | 70 | 95 | 112 | 152 | 181 | 186 | 200 |
| Dart total (both) | 52 | 69 | 82 | 96 | 109 | 112 | 118 |

Fresh seeds 10000–10099 (`--from=10000 --seeds=100`):

| | Weak | Average | Good | Great | Near-perfect | Elite | Flawless |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Before (bullRev 8) | 55 | 71 | 104 | 143 | 172 | 181 | 200 |
| After (bullRev 9) | 70 | 90 | 115 | 149 | 178 | 188 | 200 |
| Dart total (both) | 52 | 67 | 82 | 97 | 108 | 113 | 117 |

- Medians rise from each level to the next.
- The gaps at the top:
  - near → elite is 5 (tuning) / 10 (fresh);
  - elite → flawless is 14 / 12.
- The elite bots' dart total is only 3–5 above near-perfect's, so the near → elite gap comes mostly from the
  features.
- Every level scores higher than on bullRev 8 except flawless, which stays at 200. The straight line ends at 112, so
  the lower levels' dart totals are worth more than on bullRev 8's curve.

## Checks

- `scripts/bullseye-standard-check.ts` (~10 s):
  - expansion E9's stored Flightpath runs (every older stamp, bullRev 8 and its stored 200) replay to the same score
    and state;
  - bullRev 9 starts from bullRev 8's state plus `std`, every bullRev 8 log replays on bullRev 9 to bullRev 8's state,
    and the bots throw the same darts on both;
  - 42 bot runs on bullRev 9 (weak → flawless) replay through `replayBullseyeRun` to the claimed score, which equals
    the standard's sum worked out independently, and grade through `gradeAnswer` to the same score, with reveal lines
    that add up;
  - dead-centre and streak points come only from bulls;
  - the dead-centre pops add up to 20 on every seed;
  - rooms deal 9, and the help is right;
  - the best possible run, played and replayed through the server, scores exactly 200 on every tuning (0–59) and
    fresh (10000–10199) seed.
- `scripts/bullseye-best-run.ts`: that best run, played for real (exact launches found from the sim's own aim and
  wind functions).
- `scripts/arcade-standard/bullseye.ts`: the case for arcade-standard-check. Its perfect state is the best run on one
  seed (reachable); it also checks 200, 1, 0, the straight line, older states and the shared dead-centre amounts.
- `scripts/scoring-targets-revs.ts`: `LIFT_REVS.bullseye = [9, 8]`, so checks written for bullRev 8's play
  (expansion-e5-check, expansion-e9-check, arcade-batch5-check, tuning-b-check) keep proving it through `playRevOf`.
