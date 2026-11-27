# Pinball on the arcade scoring standard (pinRev 6, 29 Oct 2026)

## pinRev 9 (D5's ladder, 23 Nov 2026): Normal's refit

Rooms, rated play and the Daily deal **`pinRev 9`** (`PIN_REV_LADDER`, `pinball9Game`). At Normal it is pinRev 8's table,
play and timings exactly (56 px flippers, 3 balls, no ball save, gravity 100 %, a 20 s multiball, 90 s); the state adds
`lad: 1`, folded into the checkpoint checksum last. Only the lines move (Joe's rule of 23 Nov 2026):

| Part | Max | pinRev 8 | pinRev 9 (Normal) |
|---|---|---|---|
| Table points | 130 | full at 61,000 | full at 56,000 (`PIN_V9_FULL_AT`) |
| J-O-U-L-Z | 20 | one set | one set |
| Multiball | 20 | started | started |
| Jackpots | 15 | 5 each (3) | 8 each (`PIN_V9_JACKPOT_EACH`: 2 of 3 fill it) |
| Ramp combos | 15 | 5 each (3) | 8 each (`PIN_V9_COMBO_EACH`: 2 of 3 fill it) |

Measured: with one combo filling the part (15 each, the brief's "about 1 of 3") the realistic elite reached 200 on 63 % of
96 proved Normal deals, over Joe's 40–60 %; 8 each puts it at 59 %. The help and the standard's spec read pinRev 9's lines
(`PIN_STD_SPEC_V9`, LIVE_BANDS). Normal deals only the seeds whose human-limited flawless run scores 200
(`pinballLevelDeals.server.ts`, below). The pin `pinballPreLadder` deals pinRev 8 as before (`dealEra.ts`); every older
stamp replays and scores exactly as before (`scripts/fixtures/pinball-ladder-legacy.json.gz`: pinRev 8 at every level,
pinRev 7 and 6, recorded before any pinRev 9 code by `scripts/pinball-ladder-legacy-record.ts`).

## Levels (D5, 23 Nov 2026)

The lever is **the flippers' length** and so the drain between their tips (`flipLen` in `PINBALL_LEVELS`,
`src/lib/arcade/retroLevels.ts`, on the state as `lv`; pinRev 8's rounds replay on `PINBALL_LEVELS_V8`). The sim sweeps and
resolves each bat at its level's length (`pinFlipLenFp` in `pinball4.ts`, every older state 56 px); the art draws it from
the same figure (`drawFlippers` and the flip flash read `lv.flipLen`), within 2 px of the capsule's end. The deal stamps
`level`; every level deals pinRev 9.

| | Easy | Normal | Hard | Expert |
|---|---|---|---|---|
| Flippers (drain at rest) | 62 px (17 px, about one ball) | 56 px (27 px) | 52 px (34 px) | 50 px (37 px) |
| Balls | 4, a 10 s ball save | 3 | 3 | 2 |
| Gravity | 100 % | 100 % | 110 % | 115 % |
| Multiball | 20 s | 20 s | 20 s | 20 s |
| Lines (table points, jackpot, combo) | 44,000, 15, 15 | 56,000, 8, 8 | 56,000, 15, 15 | 56,000, 15, 15 |
| Average (mean) | 134.9 | 68.0 | 48.2 | 30.8 |
| Elite (mean) | 195.0 | 187.3 | 185.2 | 147.9 |
| Elite at 200 | 71 % (68 of 96) | 59 % (57) | 38 % (36) | 29 % (28) |
| Proof | 60 seeds of 82 | 60 of 94 | 60 of 79 | 60 of 91 |

Measured on the recorded ladder (`scripts/fixtures/d5-ladder-pinball.json.gz`, `bun scripts/d5-ladder-record.ts pinball
--deals=96`: 96 real deals a level, each graded by the server). Before (pinRev 8 at every level, the same players, 24 deals):
average 89.5 / 87.1 / 92.8 / 38.9, elite 182.3 / 168.9 / 177.3 / 161.2, elite at 200 17 % / 21 % / 4 % / 25 %.

Why the numbers moved from the spec's row:

- **The flippers.** The spec's 48 and 42 px left almost nothing to play on Hard and Expert: at 42 px, gravity 120 % and 2
  balls the average player scored 9 and the realistic elite 40 (24 deals); at 48 px Hard's elite reached 200 on 8 %. A
  few pixels of bat are a lot of drain: 52 and 50 px put both levels back in reach, each still a step below Normal's 56.
- **Easy's gravity 100 %** (spec 85 %): at 85 % the floaty ball seldom climbed to the lanes, so the realistic elite missed
  J-O-U-L-Z on a third of Easy runs and reached 200 no more often than on Normal.
- **Expert's gravity 115 %** (spec 120 %), with 2 balls.
- **Per-level lines** (decision 12): Easy's table points full at 44,000; on Easy, Hard and Expert one jackpot and one ramp
  combo fill their parts (shorter games hold fewer of both). Normal keeps 2 of 3 of each.

**The proof.** Every level, Normal included, deals only seeds (the seed sets the skill shot's lanes; the table is fixed) on
which the flawless skill-band player held to the human limits (0.25 s to react, 0.15 s to move) scores exactly 200 through
the server's grade: `scripts/pinball-level-witness.ts` tries the skill-band room seeds in order and keeps 60 a level, writing
`src/lib/duel/pinballLevelDeals.server.ts` and the witness logs `scripts/fixtures/pinball-level-witness.json.gz` (`--check`
replays them all and rebuilds the file byte for byte). `scripts/pinball-ladder-check.ts` (~1 min) proves the legacy fixture,
the stamp and pin, Normal's same play and lines, each level's rules, the flippers swept and drawn at their length, the proof
and the ladder test.

## pinRev 8 (the Retro overhaul, stage 3, 16 Nov 2026): outlane saves counted

pinRev 7's table, play, timings and parts exactly (playRevOf maps 8 to 7's play), with the outlane saves counted: the
main ball falling into an outlane's mouth (within `P4_POST_R` of a guide's lower post, on its outer side) and climbing
back out without draining (`outSaves`, `outSaveTick`); the art sparks gold at the post with "SAVED!" and
`pinball.outlaneSave` plays. A save is rare (none to one a run for the bots). Levels: balls, a ball save after each
launch (Easy 10 s), gravity, the multiball's length and the table points the core is full at. States add `rev8` and the
counters (checksum, last). Rooms deal it (preRetro: pinRev 6).

Joe's row: "Pinball: core up to 130 = table points, full at the near-flawless total. J-O-U-L-Z completed 20 (10 each,
up to 2). Multiball started 20. Jackpots 15 (5 each, up to 3). Ramp combos 15 (5 each, up to 3). Replaces the
266,000-point scale."

## The stamp

`pinRev 6` (`PIN_REV_STD`, `src/lib/arcade/pinball.ts`; game `pinball6Game`, spec `PIN_STD_SPEC`, parts
`pinballStdParts` in `src/lib/arcade/pinball4.ts`). Rooms deal it (`generatePinball`). Its states carry `rev5: 1` (the
90 s run), `rev6: 1` and `combos`; the checkpoint checksum folds `rev6` and `combos` in after pinRev 5's flag, so pinRev
5's checksum is unchanged. Every earlier stamp plays and scores exactly as before.

## Parts (200 in all)

| Part | Max | How it pays |
| --- | ---: | --- |
| Table points (core) | 130 | `stdLine(130, table points, 61,000)`: a straight line, full at 61,000 |
| J-O-U-L-Z | 20 | 10 for each completed set of all five letters, up to 2 |
| Multiball | 20 | once multiball has started (any number) |
| Jackpots | 15 | 5 each, up to 3 |
| Ramp combos | 15 | 5 for each back-to-back ramp shot (within 4 s of the last ramp's exit), up to 3 |

Score = `stdScore(parts, acted)`: 0 with no input, else the sum held to 1…200.

## What changed (and what did not)

Play is pinRev 5's tick for tick (same table, physics, flippers, lanes, lock, multiball, jackpot, skill shot, 90 s).
Only the table's point counting changed, to take the rising scales out of the core:

- **No multiplier.** pinRev 5's J-O-U-L-Z completions and ramp shots raised a table multiplier (x2…x5) that multiplied
  bumpers, slingshots, targets, the bank, the spinner and lane letters: a rising scale inside "table points". On
  pinRev 6 the multiplier stays x1 (the multiplier inserts stay dark; the FX labels drop "x2"…), so table points are a
  plain count of what the ball did. J-O-U-L-Z is paid as a feature instead.
- **Flat combos.** pinRev 5 paid a ramp combo 1,000 × (combo − 1), rising with the chain; pinRev 6 pays a flat 1,000 for
  each back-to-back ramp shot (plus the ramp's 1,000) and counts it in `combos`.
- Every feature still scores its own table points (J-O-U-L-Z 5,000, ramps, locks 2,000, jackpots 5,000, skill shot
  2,500), so earning a feature never costs core points.

The lead's note allowed keeping the table's own counting unless it made the core a rising scale; the multiplier and
the combo chain both did, so they are removed from scoring on pinRev 6 (they had no effect on play).

## Core target (how measured)

`bun scripts/arcade-skill-bands.ts pinball --rev=now --levels=all --seeds=60 --jobs=2` (default fixed bots) on pinRev 6
with a provisional full-at of 100,000: the near-perfect level's median table points were **60,780** → set
`PIN_V6_FULL_AT = 61,000` (nearest 1,000). Fresh seeds (10000–10099) put the near median at 61,000 too.

## Medians, before (pinRev 5) → after (pinRev 6)

Tuning seeds 0–59 (`--seeds=60`):

| Level | Weak | Average | Good | Great | Near | Elite | Flawless |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| pinRev 5 | 60.5 | 66.5 | 97 | 123 | 169 | 173.5 | 195.5 |
| pinRev 6 | 34.5 | 48 | 90.5 | 146 | 175 | 180 | 190 |
| pinRev 6 table points | 14,943 | 20,695 | 29,668 | 48,110 | 60,780 | 65,720 | 103,195 |

Fresh seeds 10000–10099 (`--from=10000 --seeds=100`):

| Level | Weak | Average | Good | Great | Near | Elite | Flawless |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| pinRev 5 | 57.5 | 75.5 | 106.5 | 124 | 163 | 176 | 188 |
| pinRev 6 | 33.5 | 63.5 | 118 | 143.5 | 179 | 185 | 190 |

No run scored 0 and none was flagged, on either revision or seed set. Medians rise at every level. Part medians on
pinRev 6 (tuning): near core 129, J-O-U-L-Z 10, multiball 20, jackpots 10, combos 10; elite core 130, jackpots 15,
combos 15; flawless core 130, J-O-U-L-Z 10, multiball 20, jackpots 15, combos 15. The top gaps (near 175 → elite 180 →
flawless 190) come from the features: the bots seldom complete a second J-O-U-L-Z set in 90 s, so 200 is rare.
The weak and average levels drop (pinRev 5's curve was lenient at the bottom); the standard's straight line pays them
their share of 61,000.

## Texts and display

- Help SCORE: `liveStdHelp("pinball", "Every switch, ramp, lock, jackpot and skill shot scores table points (no multiplier).")`;
  the how lines no longer mention the multiplier.
- Intro SCORE: "Table points, plus J-O-U-L-Z sets, multiball, jackpots and ramp combos. Up to 200."
- Reveal: lines from the parts; on pinRev 6 the tiles are J-O-U-L-Z, Multiball, Jackpots, Ramps · combos, Balls left
  (no Multiplier tile). Round summary and the stage's reveal text drop the multiplier and add combos. Grade extras add
  `combos` on pinRev 6.
- Intro demo: stopped (only a pinRev 6 demo plays, as High Rise's skylineRev 8) until one is recorded on pinRev 6.

## Checks

- `scripts/arcade-standard/pinball.ts` (arcade-standard-check's case) and `scripts/pinball-standard-check.ts`
  (fixture `scripts/fixtures/pinball-standard-runs.json.gz`, 14 bot runs weak → flawless, `--record`): older stamps,
  pinRev 5's recorded runs (`pinball-90-runs.json.gz`), pinRev 6 = pinRev 5 tick for tick, the flat combo award, no
  multiplier, dealing, help, recorded runs through the server path, the replay stepper and the reveal.
- pinball-check, pinball-90-check and e4-expansion-check now assert the dealt stamp is pinRev 6 (pinRev 5's play).
