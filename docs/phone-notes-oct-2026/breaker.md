# Breaker: Joe's phone notes (27 Oct 2026)

> "Special-brick symbols should show what the special does (keep the fireball as it is). Add one more 'double
> balls' brick, placed towards the bottom rows. Gold bricks no longer need a direct hit: any 4 hits break them.
> Remove all the '+10' pop-ups from breaking bricks and the skill-point pop-ups."

## What changed

**New stamp `brkRev 10`** (`BRK_REV_PHONE` in `src/lib/arcade/breaker.ts`), dealt by rooms, practice, the daily and
challenges. It is brkRev 9 (the 420 × 784 court, the 9 × 12 wall, combos, skill pay) with two rule changes:

- **Gold bricks break after any 4 hits** (`BRK_V10_GOLD_HITS`). A plain ball, a Fireball ball, a ×3 shot and the
  laser's stop each count one hit. The ball still bounces off (Fireball balls too, as before); every hit but the
  last is a clink (white ring and clink sound). Gold bricks start with 4 in `bricks` and `maxHp`. A break by a plain
  ball adds to the no-touch chain as on brkRev 9; 15 skill points each, unchanged.
- **A second double-ball brick** in the lower rows 8–11 (`BRK_V10_MULTI2_ROWS`, the bottom four, where the first one
  already sits), in a different row from the first, always on a 1-hit brick. It is drawn from a stream of its own
  keyed by the seed (`seed ^ 0x4252cb10`) *after* the brkRev 9 board, so every other brick, the gold places, the
  sliding rows and the first launch are brkRev 9's exactly (expansion-e3-check proves it on 300 seeds). Same for
  every player.
- States carry `phone: 1`, folded into the checkpoint checksum last. Older stamps never see it.
- **Curve**: the second double-ball brick lets every level break more of the wall (the good bot's median 69.5 →
  79.5 bricks), which on brkRev 9's curve lifted the good median from 107 to 130. `BRK_V10_BAND_CURVE` moves brkRev
  9's points to the bricks each level now reaches (knots 34/56/67/80/91/101/105 → 66/80/86/98/129/137/140, was
  34/48/58/70/86/98/105). Skill pay (`BRK_V9_SKILL_PAY`) and the 200 cap are unchanged. `LIVE_BANDS.breaker` reads
  the new curve, so the "?" help numbers follow.

**Display only, every revision** (`src/lib/arcade/breaker.renderer.ts`, no sim, score or sound change):

- Power-up bricks show what they do instead of the plain white star: two balls (double-ball), three small balls
  rising on trails (×3 shots; ×5 on original boards), a beam rising from an emitter (laser). The Fireball brick is
  unchanged (star and flame). The game icon keeps the star (`paintBrick`'s `symbol` defaults off).
- The "+10", "+10 ×2/×3" and "GOLD +10" pops on breaking bricks are gone (the shatter, burst, banners and sounds
  stay). The "GOLD BRICK!" and "COMBO ×2" banners (moment events, which also drive moment sounds and replay moments)
  and the HUD's SKILL figure are kept: they announce, they are not points pops. If Joe meant those too, they are the
  last two events of `BREAKER_FX_DEEP` in `arcadeFxGames.renderer.ts`.
- brkRev 10's gold bricks show a black crack per hit taken; the "direct line" glint is off on brkRev 10 (it no
  longer means anything).

Text: help (`instructions.ts`: gold bricks "break after 4 hits"; five power-up bricks, each showing its power; two
double-ball bricks in the lower rows), the intro still's caption (`src/puzzles/breaker.tsx`). The intro demo stays
stopped until recorded on brkRev 10 (`introDemo.functions.ts`).

## Judgement calls

- "Any 4 hits" counts every kind of hit, the laser and ×3 shots included (a Fireball still bounces off gold rather
  than smashing through it).
- "Towards the bottom rows": the same bottom-four band as the first double-ball brick, never the same row.
- The curve refit keeps an ordinary player's score near where it was; the extra brick still pays a little at every
  level (Joe asked for the brick, not for higher scores).
- `src/lib/replay/moments.ts` still describes the gold moment as "Gold brick broken by a direct hit" (also in the
  generated `docs/sound-cues/cue-sheet.*` and `replays.md`); left alone so the cue sheet stays in step. Worth a
  wording pass with `bun scripts/sound-cue-sheet.ts`.

## Measurements (skill-band tool, tuning seeds 0–59, `--rev=now --levels=all`)

Before: main (brkRev 9), the coordinator's `before-all.json`. After: brkRev 10.

| Level | Before median | After median | Bricks (median) before → after | Zero-scoring played runs |
|---|---|---|---|---|
| Weak | 67 | 66 | 35 → 35 | 0 → 0 |
| Average | 75 | 76.5 | 43 → 50.5 | 0 → 0 |
| Good | 107 | 114.5 | 69.5 → 79.5 | 0 → 0 |
| Great | 138.5 | 141.5 | 80.5 → 88 | 0 → 0 |
| Near-perfect | 165.5 | 172 | 92 → 94.5 | 0 → 0 |
| Elite | 177.5 | 180 | 100.5 → 103 | 0 → 0 |
| Flawless | 179 | 182 | 100 → 105 | 0 → 0 |

(Before the refit, on brkRev 9's curve: 67 / 81 / 130 / 157 / 175 / 180 / 182.) Bot detail, 30 seeds (median gold
bricks broken / mean): good 0 / 0.30 → 0 / 0.83, great 1 / 0.73 → 1 / 1.13, near 1 / 1.23 → 1 / 1.47; power-ups
caught rise by about one at every level. Fresh seeds were not measured.

## Checks (run one at a time, non-browser)

| Check | Result |
|---|---|
| expansion-e3-check (old stamps replay; new section 5 for brkRev 10) | pass (5571) |
| arcade-tuning-g1-check (wiring updated to brkRev 10) | pass |
| arcade-tuning-f-check (wiring updated) | pass |
| arcade-batch3-check (wiring updated) | pass |
| tuning-b-check (wiring updated) | pass |
| arcade-batch2-check | pass |
| round-max-check | pass |
| scoring-bands-check | pass |
| arcade-score-bands-check | pass |
| arcade-help-bands-check | pass |
| intro-score-text-check | pass |
| reveal-score-check | pass |
| arcade-self-replay-check | pass |
| arcade-room-schedule-check | pass |
| arcade-fx-check | pass |
| six-game-scoring-check | pass |
| beta-recording-check | pass |
| presentation-geometry-check | pass |
| replay-check | fail, expected: no stored run on brkRev 10 in `scripts/fixtures/replay-runs.json` (coordinator) |
| practice-bests-check | fail, expected: `practiceStamps.data.ts` out of date (coordinator) |

Review frames: `bun scripts/shots/phone-notes-brk-bub-shots.ts [--out=<dir>]` (the opening wall with every symbol,
and a near-perfect run's frame with a cracked gold brick).
