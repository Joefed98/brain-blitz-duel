# Tempo (`beat`) on the arcade scoring standard: beatRev 11

## beatRev 12: no note below 0 (the Retro overhaul, 15 Nov 2026)

Joe's review (docs/design/game-reviews/retro.md "Tempo"): a miss-heavy run still earns something. New stamp **beatRev
12** (`BEAT_REV_FLOOR`, `BEAT_STD_SPEC_V12`): beatRev 11's song, chart, windows, features and parts exactly; a missed note
scores 0 instead of −2 (so a third of the notes Perfect is 333 of 1,000 accuracy, not 0). Every note Perfect is still
1,000 and 200 overall. States add `floor: 1`, outside the checksum; `playRevOf` maps 12 to 11's play (`RETRO_REVS`).
retro-overhaul-check proves the same checksums and judgements on the skill-band bots' logs at every level, that no run
scores less, and the server replay.


29 Oct 2026, batch B of the arcade scoring standard (`src/lib/arcade/arcadeStandard.ts`).

## The stamp

`beatRev 11` (`BEAT_REV_STD`). Rooms deal it (`generateBeat`), `beatGameFor(11)` returns `beatV11Game`, and its
states carry `std: 1` (folded into the checkpoint checksum last). Play is **beatRev 10's exactly**: the same 75 s song,
the same chart from the seed, the same 4 / 8 / 13-tick windows, the same fever meter, golden notes, double taps and
Perfect streak. Only the score changes. beatRev 1–10 replay and score exactly as before.

## The parts (200 in all)

| Part | Max | How it pays |
|---|---:|---|
| Accuracy (core) | 130 | The song's per mille: Perfect 4, Good 3, OK 1, a missed note −2, out of 4 a note, never below 0. Straight line, `stdLine(130, perMille, 1000)`: full at 1,000 (every note Perfect). |
| Fever | 25 | `stdLine(25, min(fevers, 4), 4)`: 6, 12, 18, 25 for 1, 2, 3, 4 fevers started. |
| Golden notes | 15 | `stdLine(15, golden notes hit dead on, golden notes in the song)`. |
| Double taps | 15 | `stdLine(15, double taps with both hits Perfect, double taps in the song)`. |
| Perfect streak | 15 | `stdLine(15, longest Perfect streak, notes in the song)`: full for every note Perfect in one streak. |

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

## beatRev 13 (D5, 23 Nov 2026): the lower full lines and the lanes

Joe's approval of 23 Nov 2026 (the polish plan's D5; `docs/polish-plan-final/difficulty-spec.md` "Tempo"). One new
stamp, `BEAT_REV_LANES` 13, dealt at Normal and every level.

**Normal** is beatRev 12's song, chart, windows, judging and features exactly (the same checkpoints: `fit: 1` stays
outside the checksum, so a beatRev 12 log replays on beatRev 13 tick for tick). Two feature lines move to about what the
realistic elite (`scripts/d5-ladder.ts`, the elite under the human limits) takes on three runs in four:

| Part | beatRev 12 full at | beatRev 13 full at |
|---|---|---|
| Accuracy (130) | 1,000 (every note Perfect) | unchanged |
| Fever (25) | 4 fevers | unchanged |
| Golden notes (15) | every golden note the chart deals | 5 in every 9 (rounded up; `BEAT_V13_GOLD_NINTHS`) |
| Double taps (15) | every double tap | unchanged |
| Perfect streak (15) | a streak of every note | 70 % of the notes (rounded up; `BEAT_V13_STREAK_PCT`) |

The elite's three-in-four on Normal (96 deals): golden notes 0.56 of the chart's, the streak 0.68 of the notes, 3 or 4
fevers, every double tap, accuracy 994.

**The deal.** Each level deals from its own proved list (`src/lib/duel/beatDealV13.server.ts`, 300 seeds a level, built
by `bun scripts/beat-lanes-deal.ts [--check]`): a seed is kept only if (1) its chart is playable by two thumbs at Joe's
human limits (`scripts/beat-thumbs.ts`: a thumb needs 0.15 s, 9 ticks, to reach a note in another lane; never more than
two notes down at once, held tails included) and (2) the flawless player held to the human limits scores exactly 200
through the server replay. About three quarters of today's Normal charts hold a chord under a held tail (three notes
down), so Normal deals only the quarter that two thumbs can play (1,073 of 1,387 candidates dropped for it, 14 more for
the proof); the level charts are built two-thumb playable (below), so none is dropped there. Checks written for
beatRev 12 pin `beatPreLanes` (`pinBeatPreLanes`), which deals beatRev 12 on any seed as before.

## Levels (D5, 23 Nov 2026)

The lever is **the lanes** (`BEAT_LEVELS_V13` in `src/lib/arcade/retroLevels.ts`; beatRev 12's level rounds replay on
their own table, `BEAT_LEVELS`). A level's chart is built on its own lanes from the first note (no fifth-lane switch, so
no quiet second before 40 s) on Normal's plan with the level's off-beat and chord shares; a hold grows only where the
other thumb alone can play every note while it is held (`thumbsAllowHold`). Taps, releases and swipes range over the
level's lanes (`beatInputRangesFor`); the stage maps a tap by its share of the width (`beatLaneAtOf`); desktop keys F
Space J on three lanes, S D F J K L on six. Each level's row also carries its own full lines (the ladder rule: each
feature at about the elite's three-in-four at that level; accuracy moved only where the elite would otherwise reach 200
too rarely for the ladder).

| | Easy | Normal | Hard | Expert |
|---|---|---|---|---|
| Lanes | 3, the whole song | 4, a fifth from 40 s | 5 from the first note | 6 from the first note |
| Windows (Perfect / Good / OK, ticks) | 5 / 10 / 16 | 4 / 8 / 13 | 3 / 6 / 11 | 3 / 6 / 11 |
| Fall (ticks on screen) | 110 | 90 | 75 | 60 |
| Off-beats / chords (of Normal's) | 50 % / 50 % | 100 % / 100 % | 170 % / 160 % | 240 % / 220 % |
| Accuracy full at | 990 | 1,000 | 995 | 992 |
| Fever full at | 3 fevers | 4 | 4 | 4 |
| Golden notes full at | 4 in 9 | 5 in 9 | 5 in 9 | 5 in 9 |
| Perfect streak full at | 75 % | 70 % | 60 % | 45 % |
| Average player (mean) | 122.5 | 109.7 | 90.7 | 83.5 |
| Realistic elite (mean) | 198.6 | 196.1 | 195.3 | 196.0 |
| Elite runs at 200 | 68 % | 44 % | 35 % | 28 % |
| 200 proved on | 300 seeds | 300 seeds | 300 seeds | 300 seeds |

Measured on the recorded ladder (`scripts/fixtures/d5-ladder-beat.json.gz`, `bun scripts/d5-ladder-record.ts beat
--deals=288`: 288 deals a level, the average and elite skill-band players under the human limits, graded by the server).
Joe's ladder test holds: the average steps down 12.8, 19.0 and 7.2 points; every level's average is above 15; the elite
reaches 200 less often each level up, on Expert on 28 % of runs.

Before (beatRev 12's levels, 96 deals a level, the same players): average 110.8 / 106.0 / 88.8 / 73.1, elite 189.0 /
189.3 / 187.0 / 181.8 and never 200 (the flawless player held to the limits: 23 / 23 / 11 / 8 % at 200).

What the bots cannot feel: the skill-band players read the chart's busyness and time each note, but not how wide a
lane is, so six narrow lanes are no harder for them than four; the elite's means stay near 196 at every level and the
spec's guides for the average (Easy 150–180, Hard 55–75, Expert 25–45) are not reached (an average player never fills
the fever meter, so 70 of the 200 points are out of its reach at every level). The ladder test is met on the chart's
density, the windows, the fall and the lines.

Checks: `scripts/beat-ladder-check.ts` (the legacy fixture `scripts/fixtures/beat-ladder-legacy.json.gz`, recorded by
`scripts/beat-ladder-legacy-record.ts` before the change; the deal and pin; Normal's same play; the levels as dealt; the
two-thumb proof and 200 through the server replay at every level; the ladder; the lanes on screen).
