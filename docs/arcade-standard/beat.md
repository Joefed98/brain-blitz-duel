# Tempo (`beat`) on the arcade scoring standard: beatRev 11

29 Oct 2026, batch B of the arcade scoring standard (`src/lib/arcade/arcadeStandard.ts`).

## The stamp

`beatRev 11` (`BEAT_REV_STD`). Rooms deal it (`generateBeat`), `beatGameFor(11)` returns `beatV11Game`, and its
states carry `std: 1` (folded into the checkpoint checksum last). Play is **beatRev 10's exactly**: the same 75 s song,
the same chart from the seed, the same 4 / 8 / 13-tick windows, the same fever meter, golden notes, double taps and
Perfect streak. Only the score changes. beatRev 1–10 replay and score exactly as before.

## The parts (200 in all)

| Part | Max | How it pays |
|---|---:|---|
| Accuracy (core) | 130 | The song's per mille: Perfect 4, Good 3, OK 1, a missed note −2, out of 4 a note, never below 0. Straight line, `stdLinear(perMille, 1000, 130)`: full at 1,000 (every note Perfect). |
| Fever | 25 | `stdShare(min(fevers, 4), 4, 25)`: 6, 12, 18, 25 for 1, 2, 3, 4 fevers started. |
| Golden notes | 15 | `stdShare(golden notes hit dead on, golden notes in the song, 15)`. |
| Double taps | 15 | `stdShare(double taps with both hits Perfect, double taps in the song, 15)`. |
| Perfect streak | 15 | `stdShare(longest Perfect streak, notes in the song, 15)`: full for every note Perfect in one streak. |

The score is `stdScore(parts, acted)`: 0 with no input, else the sum held to 1…200.

## The core target

Joe fixed it: full at 1,000. **Interpretation (differs from the lead's literal reading):** "1,000" is the song's per
mille (the measure Tempo has always used: Perfect 4, Good 3, OK 1, miss −2 over 4 × notes, 1,000 = every note
Perfect), not 1,000 raw accuracy points. Raw points cannot reach 1,000 on beatRev 10's chart: songs hold 183–219 notes
(median 196 on 60 seeds), so a flawless run earns at most 732–876 raw points (median ~780), and a raw-1,000 core would
cap a flawless player at about 101 of 130. The chart is unchanged.

Measured (skill-band tool, `--rev=now --levels=all --seeds=60`, default fixed bots): the near-perfect level's median
accuracy is **992 per mille** (~780 raw points; fresh seeds 991). Elite is also 992 on the tuning seeds (1,000 on fresh),
flawless 1,000. The core line is fixed at 1,000 as Joe said, so near-perfect earns 128 of 130 there; the top levels are
told apart mainly by the features.

## Feature rules chosen

- **Fever**: a fixed share per fever started (no ×2: beatRev 10 counted every note in fever again, a quarter of a point
  each; on beatRev 11 fever changes no accuracy points). A flawless run starts 4 in the song (58 of 60 seeds), so full
  at 4. Near-perfect starts 4 on two seeds in three, 3 otherwise.
- **Golden notes**, **double taps**: a share of the song's own count (6–24 golden notes, 7–24 double taps per seed), so
  every seed pays the same 15 for all of them. The golden note keeps beatRev 10's rule: dead on, the very tick.
- **Perfect streak**: a share of the song's notes, so near-perfect (median best streak 144 of ~195) earns 11, elite
  (176) 13, flawless 15. This is the part that keeps clear gaps at the top.
- Double taps are nearly maxed by near-perfect (13 of 13); golden notes and the streak are not.
- Earning a feature never costs accuracy: the parts only read the judgements the shared step already makes; the fever
  tap is its own input on the meter (beat-standard-check replays runs without their fever taps: identical judgements
  and accuracy points).

## What else changed (display only)

- HUD: during fever the meter reads "FEVER!" (not "FEVER x2") and the gold "+n" is the four features' standard points
  (`beatStdBonus`). The practice result line shows "features +n".
- Help: SCORE is `liveStdHelp("beat", "Notes hit closer to the beat score more.")`; the Fever, Golden notes, Double taps
  and Perfect streak lines describe fixed bonuses (no "counts twice", no "bonus point per 10"). Intro SCORE: "Notes hit
  in time, fevers, golden notes, double taps and a Perfect streak. Up to {max}."
- Grade extras on beatRev 11: `beatRev`, `accuracy`, `fevers`, `goldsHit`, `golds`, `doublesDone`, `doubles`,
  `maxStreak`; the round summary adds a features line. The reveal's lines come from the standard parts.
- Intro demo: stopped until one is recorded on beatRev 11 (its HUD shows the standard's points).

## Before (beatRev 10) → after (beatRev 11) medians

Skill-band tool, default fixed bots, paired seeds; no played run scores 0 on either.

Tuning seeds 0–59 (`--seeds=60`):

| | Weak | Average | Good | Great | Near-perfect | Elite | Flawless |
|---|---:|---:|---:|---:|---:|---:|---:|
| beatRev 10 | 43 | 85 | 114 | 148 | 176 | 179 | 200 |
| beatRev 11 | 49 | 97 | 135 | 161 | 184 | 190 | 198 |

Fresh seeds 10000–10099 (`--from=10000 --seeds=100`):

| | Weak | Average | Good | Great | Near-perfect | Elite | Flawless |
|---|---:|---:|---:|---:|---:|---:|---:|
| beatRev 10 | 41 | 81 | 114 | 144 | 174 | 191 | 200 |
| beatRev 11 | 48 | 94 | 133 | 159 | 179 | 192 | 198 |

Zeros: 0 on every level, both seed sets, before and after. The flawless bot's median is 198 (p90 200): it misses one or
two dead-on golden notes; 200 stays reachable.

## Checks

`scripts/beat-standard-check.ts` (legacy beatRev 10 runs recorded on 99115b0 in
`scripts/fixtures/beat-standard-legacy.json.gz`; play unchanged; scoring; fever never costs accuracy; server replay);
`scripts/arcade-standard/beat.ts` (arcade-standard-check's case).
