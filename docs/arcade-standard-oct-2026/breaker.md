# Breaker under the arcade scoring standard (brkRev 11)

29 Oct 2026. Batch A of the arcade scoring standard. Rooms and practice deal **`brkRev 11`** (was 10). Play is
brkRev 10's exactly: the same 420 × 784 court, 9 × 12 board, gold bricks (any 4 hits), power-up bricks, the second
double-ball brick, sliding rows and first launch (`initPhone`, then the marker `std: 1`). Only the score changes.
Every older stamp keeps its own scoring and replays exactly as before.

## Parts (total 200)

| Part | Max | Rule |
|---|---|---|
| Bricks (core) | 140 | A straight line on the share of the board's bricks destroyed: `floor(140 × destroyed ÷ 108)`. Every brick counts, the 3 gold bricks and the power-up bricks included (each brick is worth the same, about 1.3). |
| Wall cleared | 10 | Breaking the 105 wall bricks (the last one ends the run, as on every revision; the gold bricks are not needed to clear). Only when cleared. |
| Speed | 20 | Only when cleared: the full 20 with at least half the 90 s left (cleared by 45 s), then falling evenly to 0 at the buzzer: `floor(40 × ticks left ÷ 5400)`. |
| Gold bricks | 30 | Split evenly over the gold bricks dealt: 10 each (3 dealt). |
| Power-up bricks | 0 extra | They are bricks (core), and their effect still helps. |
| Combos | 0 | brkRev 9's combo points and the rising skill-pay scale (`BRK_V9_SKILL_PAY`) are not used on this stamp. |
| Losing the ball | time only | The 3 s relaunch; no points. |

A played run (any input) scores at least 1; a run with no input scores 0; never above 200. A perfect run (every
brick, all 3 gold, the wall cleared by 45 s) is 140 + 10 + 20 + 30 = 200. Gold bricks count in the core as well as in
their own part, so earning the feature never costs core points; because the last wall brick ends the run, the gold
bricks must be broken before the wall is cleared to count.

Code: `BRK_REV_STD`, `breakerStdParts`, `brkStdScore`, `breakerStdBandParts` (reveal lines) and
`BRK_V11_BAND_CURVE` (the core's straight line, 0 → 140 over 0 → 108, read by LIVE_BANDS and the help) in
`src/lib/arcade/breaker.ts`.

## Core target

Breaker has a fixed maximum (all 108 bricks), so the core is full at every brick, not at a measured level. For
reference the near-flawless level's median is 95 of 108 bricks (123 core points) and the elite level's 105.

## Medians, weak → flawless

`bun scripts/arcade-skill-bands.ts breaker --rev=now --levels=all --seeds=30 --jobs=4`, median (p10–p90).

| Revision | Weak | Average | Good | Great | Near-perfect | Elite | Flawless |
|---|---|---|---|---|---|---|---|
| brkRev 10 (before, main) | 66 (36–103) | 73 (62–144) | 115 (76–179) | 142 (87–185) | 170 (94–189) | 179 (128–188) | 181 (130–192) |
| brkRev 11 (after) | 45 (24–79) | 58 (41–109) | 105 (62–166) | 119 (82–168) | 137 (92–186) | 154 (115–187) | 168 (106–196) |

After: bricks broken (median of 108) 35 / 43 / 80 / 88.5 / 95 / 105 / 107; walls cleared 0 / 0 / 1 / 3 / 7 / 7 / 14 of
30. The medians rise at every level with clear gaps at the top (near 137, elite 154, flawless 168); the flawless bot
reached 200 on 3 of 30 seeds. brkRev 10's knotted curve paid weak and average play far more per brick (66 at 34 bricks);
the straight line pays every brick the same, so ordinary scores come down and the top spreads out.

## Gameplay changes and assumptions

- No gameplay change: brkRev 11 is brkRev 10's board and step. The state adds only `std: 1`, folded into the checkpoint
  checksum last (so brkRev 10's checksums are unchanged).
- Display: the HUD's bricks readout counts every brick (`BRICKS n/108`, what the core counts) and the top right shows
  `GOLD n/3` in place of brkRev 9–10's `SKILL n/50`. The reveal's axis is all 108 bricks with a Gold bricks tile (no
  Best combo tile); its lines are the bricks line and one line for clear, speed and gold. The intro still drops the
  "COMBO ×2" label; the "?" help drops the combo lines and states the four parts and their 200.
- The intro demo stays stopped until one is recorded on brkRev 11 (the HUD differs).
- "Clearing the board" is taken as the wall clear that ends the run on every revision (105 bricks); the gold bricks
  count in the share (they are bricks) and in their own 30.
- The skill-band bot values gold bricks at their fixed 10 and combos at nothing on brkRev 11 (gated on `std`, so every
  older revision's bot plays as before).

## Checks

`scripts/breaker-standard-check.ts` (~5 s): older stamps (unstamped and brkRev 2–10) replay to the score and state
recorded on main (`scripts/fixtures/breaker-standard-legacy.json`, `bun scripts/breaker-standard-legacy.ts <main
checkout>`); brkRev 11 runs (`breaker-standard-runs.json`, `--after`); the dealt stamp; brkRev 10's play on brkRev 11;
every part's rule, the floor of 1 and the cap; the stored flawless run (`breaker-standard-perfect.json`) at 200 with
every part at its maximum. `scripts/arcade-standard/breaker.ts` exports `STANDARD` for the umbrella check.

## Can a player break all 108 bricks? (30 Oct 2026)

Yes. The run ends when every non-gold brick is broken (`stepDeep`: `cleared` = every brick broken or gold); the 3 gold
bricks are never needed for the clear, but any 4 hits break one at any time before it. A player who breaks the gold
before the last wall brick breaks all 108, so the full core (140) and 200 are reachable in real play. The stored perfect
run (`scripts/fixtures/breaker-standard-perfect.json`, seed 301794028) replays through `replayBreakerRun` to 108 of 108,
gold 3 of 3, the wall cleared at 35.3 s, no ball lost: 140 + 10 + 20 + 30 = 200. Bot runs reaching 108 (room seeds 0–29 /
fresh 10000–10029): great 3 / 0, near 6 / 5, elite 5 / 10, flawless 11 / 11; every other clear without 108 left a gold
brick when the last wall brick went. The 108 denominator stays.

Fresh-seed medians (`--from=10000`): weak 49, average 74, good 99, great 126, near 153, elite 166, flawless 182. Flawless
sits under 200 because the bot runs out of time (it looks one ball trip ahead), not because 200 is out of reach; by Joe's
decision (30 Oct 2026) the ceiling, speed and clear rules are not reworked.
