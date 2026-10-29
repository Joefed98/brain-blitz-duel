# Flightpath (`bullseye`) on the arcade scoring standard — bullRev 9

29 Oct 2026, batch B of the arcade scoring standard (`src/lib/arcade/arcadeStandard.ts`). Rooms deal **bullRev 9**
(was bullRev 8). Every older stamp replays and scores exactly as before.

## Parts (200 in all)

| Part | Max | How it pays |
| --- | --- | --- |
| Dart total (core) | 150 | Straight line: `floor(150 × min(total, 130) ÷ 130)`. The dart total exactly as bullRev 8 counts it: rings 10 / 9 / 8 / 3 / 2 / 1 from the centre out, 12 for the inner bull, +1 / +2 / +3 for each balloon popped on the way in. |
| Bull streaks | 30 | bullRev 8's streak points exactly ("as today"): the third gold 10 in a row +2, the fourth +4, the fifth +6 …, counted up to 30. |
| Dead-centre darts | 20 | 2 for each dart in bullRev 8's dead-centre ring (a quarter of the bull's radius, only when the 10 is the centre ring), up to 20. |

No speed part. A run with no input scores 0; any run that threw scores at least 1. No part costs points for a
mistake (a missed dart simply adds nothing and ends a streak, as on bullRev 8).

Both features are earned only by bulls (a dead-centre dart is always in the gold 10 or the inner bull, and streak
points come only from bulls), so earning a feature never means giving up dart total.

## Core target

Joe's row fixes `fullAt` at **130** (`BULLSEYE_V9_FULL_AT`); it was not measured. For reference, the skill-band
tool's near-perfect level (`--rev=now --levels=all --seeds=60`, default fixed bots) has a median dart total of
**109** on the tuning seeds (108 on fresh seeds 10000–10099).

**Flag for the lead / Joe:** 130 is above what any run can reach. A dart can score at most 12 (inner bull) and only
when the 10 is the centre ring (always on darts 1–6, on darts 7–10 only when the shuffle leaves it there), and the
three balloons add 6, so a seed's ceiling is 118–124 (median 120 on both seed sets). With fullAt 130 the core tops
out at 136–143. Likewise the dead-centre ring exists only on those same 6–9 darts, so dead-centre tops out at 12–18,
not 20. Together a perfect run on these rules reaches 178–191 (median 182), never 200; the band tool's flawless
level scores a median 178. What-if medians on the same runs (tuning seeds; weak → flawless):

| fullAt | Weak | Avg | Good | Great | Near | Elite | Flawless |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 130 (set) | 60 | 81 | 96 | 132 | 158 | 164 | 178 |
| 120 (median seed ceiling) | 65 | 87 | 104 | 142 | 169 | 175 | 189 |
| 118 (lowest seed ceiling) | 66 | 89 | 106 | 144 | 171 | 177 | 192 |
| 109 (near median) | 71 | 96 | 114 | 155 | 182 | 186 | 192 |

Even at 118 a 200 would also need the dead-centre feature to be reachable on every seed (e.g. 3 a dart up to 20, or
the 10 kept in the centre on every dart, which would be a play change). `fullAt` is one constant
(`BULLSEYE_V9_FULL_AT`); arcade-standard-check and bullseye-standard-check read it, so changing it before release
needs no other edit than this doc (and LIVE_BANDS' curve follows it).

## What changed

- Scoring only. Play is bullRev 8's exactly: `bullseyeInitRev9` is `bullseyeInitRev8` plus `std: 1` (every seeded
  draw unchanged), and the step is the same code. The marker folds into the checkpoint checksum last (bullRev 8's sums
  unchanged).
- Removed: bullRev 8's knotted dart-total curve (`BULLSEYE_V8_BAND_CURVE`), replaced by the straight line. The bull
  streak keeps its rising +2, +4, +6 … steps because Joe's row says "as today" (capped at 30 as before). Dead-centre
  goes from 7 a dart (up to 42) to 2 a dart (up to 20).
- Display: the renderer's "DEAD CENTRE +n" pop reads the state's revision (+2 on bullRev 9, +7 on bullRev 8,
  `bullseyeDeadEach`); bullRev 9 draws bullRev 8's taller range everywhere bullRev 8 did (`bullseyeTallRev`: the
  stage, the reveal renderer, the answer view). The HUD line ("Dart n/10 · streak s · dead-centre d") shows no score
  and is unchanged.
- Help: the SCORE text is `liveStdHelp` (the three parts, "Together 200 points."); the How lines say +2 a dead-centre
  dart, up to 20. The intro SCORE line ("Rings 10 / 9 / 8 / 3 / 2 / 1, inner bull 12; streaks, dead-centre add more.
  Up to {max}.") still reads right and is unchanged.
- Reveal: the arcade reveal's lines are the standard's parts (`stdLines`); tiles and axis unchanged. The grade extras'
  `deadPts` is bullRev 9's (2 each).
- Intro demo: stays stopped until one is recorded on bullRev 9 (a bullRev 8 demo would show "+7" dead-centre pops).

## Medians before → after

Skill-band tool, `--rev=now --levels=all --jobs=2` (before: bullRev 8 on the untouched tree; after: bullRev 9).
Zero scores: none at any level, before or after.

Tuning seeds 0–59 (`--seeds=60`):

| | Weak | Average | Good | Great | Near-perfect | Elite | Flawless |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Before (bullRev 8) | 56 | 77 | 103 | 141 | 172 | 181 | 200 |
| After (bullRev 9) | 61 | 81 | 96 | 133 | 159 | 164 | 178 |
| Dart total (both) | 52 | 69 | 82 | 96 | 109 | 112 | 118 |

Fresh seeds 10000–10099 (`--from=10000 --seeds=100`):

| | Weak | Average | Good | Great | Near-perfect | Elite | Flawless |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Before (bullRev 8) | 55 | 71 | 104 | 143 | 172 | 181 | 200 |
| After (bullRev 9) | 60 | 78 | 99 | 131 | 157 | 166 | 178 |
| Dart total (both) | 52 | 67 | 82 | 97 | 108 | 113 | 117 |

Medians rise from each level to the next, weak < average < good < great < near < elite < flawless (good's median
falls a little against bullRev 8, weak and average rise, the top levels lose the 130-full core). The near → elite gap is 5 (tuning) / 9 (fresh) and elite → flawless 14 / 12; the elite
bots' dart total is only 3–5 above near-perfect's, so the top gaps come mostly from the features.

## Checks

- `scripts/bullseye-standard-check.ts`: expansion E9's stored Flightpath runs (every older stamp, bullRev 8 and its
  stored 200) replay to the same score and state; bullRev 9 starts from bullRev 8's state plus `std`, every bullRev 8
  log replays on bullRev 9 to bullRev 8's state, and the bots throw the same darts on both; 42 bot runs on bullRev 9
  (weak → flawless) replay through `replayBullseyeRun` to the claimed score, equal to the standard's sum worked out
  independently, through `gradeAnswer` to the same score, with reveal lines that add up; dead-centre and streak
  points come only from bulls; rooms deal 9; help and the renderer's pop.
- `scripts/arcade-standard/bullseye.ts`: the case for arcade-standard-check (200, 1, 0, the straight line, older
  states, feature amounts). Its perfect state is hand-built with a dart total of 130 and 10 dead-centre darts, which
  real play cannot reach (see the flag above).
- `scripts/scoring-targets-revs.ts`: `LIFT_REVS.bullseye = [9, 8]`, so checks written for bullRev 8's play
  (expansion-e5-check, expansion-e9-check, arcade-batch5-check, tuning-b-check) keep proving it through `playRevOf`.
