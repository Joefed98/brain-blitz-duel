# Pinball on the arcade scoring standard (pinRev 6, 29 Oct 2026)

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
| Table points (core) | 130 | `stdLinear(table points, 61,000, 130)`: a straight line, full at 61,000 |
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
