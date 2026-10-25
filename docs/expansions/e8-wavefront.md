# E8 · Wavefront wavRev 9 (world expansion and depth, 25 Oct 2026)

Wavefront is raised to 200 (`ROUND_MAX.wavefront`). Rooms and practice deal `wavRev 9`
(`WAV_REV_EXPAND`, `src/lib/arcade/wavefront.ts`, "World expansion"); every older revision plays and
scores exactly as before (its step function is untouched; the new rules live in their own `stepX`,
and every shared helper that learned about wavRev 9 is gated on the state's `x9` marker).

## More world

- **Taller arena**: 390 × 800 (`WAV_X_H`; wavRev 6–8 were 390 × 730). The extra 70 px sits between the
  formation and the ship (the ship stays 66 px above the bottom; drags start in the bottom quarter).
  At 414 × 896 (iPhone 11 home-screen app) the world draws at 0.965× (377 px wide, the screen fill's
  sides either side; Wavefront is in `ARENA_FILL_SIDES`).
- **Longer waves**: 36 ships a wave (30 before). Wave 1 is a 6 × 6 grid (one more row from the same seeded
  stream); waves 2–5 keep their Tuning A shapes and armour cores and add a row of six escorts under the
  shape (`WAV_FORMS_X`).
- **A gunship** (mid-boss, 96 px, 16 hit points, crimson) flies in after wave 3 and counts as a wave; the
  mothership (36 hit points) still follows wave 5 and its kill still ends the run with the timed bonus.
- **Retune** for the bigger load and the longer drop: the gun fires every 16 ticks (20), bolts fly 11 px a
  tick (10), still three centre bolts in the air; red bolts start at 5 px a tick (4) and every 75 ticks (90).
  Same 90 s, the same divers, saucer, march and drops (waves 3 and 4 still drop three quarters of a row).

## Skill features

- **Power-ups** (the existing laser drop, extended): a shot-down saucer, armoured core or boss cannon drops
  one of three seeded kinds (`WAV_DROP_*`, one falling at a time): the laser (5 piercing shots, as
  before), the **spread shot** (8 volleys with two extra bolts angled out at 2 px a tick) and the **shield**
  (absorbs the next red bolt or ram for up to 12 s; a cyan bubble round the ship).
- **Hit streak**: every hit in a row (ships, armour, divers, saucers, boss parts) grows the streak; its
  multiplier is ×2 from 8, ×3 from 16, ×4 from 24 (`wavStreakMult`) and each hit adds the multiplier less
  one to the streak points. A centre bolt that flies off without hitting, or a lost life, ends it; spread
  bolts, volleys fired during a fly-in and a shielded hit never do. The HUD's second line shows
  "STREAK 17 ×3" (gold from ×2) and the power-up held. Hits keep showing the sparkle, never points.
- **Boss weak points** (gunship and mothership): two cannons (4 hits each, 16 px columns at the guns; a
  destroyed one stops firing, smokes and drops a power-up) and a core iris that opens for half of every
  150 ticks from the boss's arrival: a hit on the open core takes 3 hit points.
- The bonus UFO (saucer) is unchanged apart from its drop's kind.

## Scoring (wavRev 9)

- **Base** (today's achievement): ships + armour hits + saucers + 15 a wave (the gunship too) + every boss
  hit point taken, on `WAV_V9_BAND_CURVE` to 140 at a perfect run (`WAV_PAR_X` = 330), plus the kill's
  speed bonus to 10 (as wavRev 5–8).
- **Edge** (up to 50, only from the features): streak points + 4 an open-core hit + 6 a cannon destroyed +
  3 a power-up caught + 4 a shield save (`wavEdgeUnits`), on `WAV_X_EDGE_CURVE`, steep only at the top
  (110 units → 2, 160 → 12, 220 → 30, 300 → 50).
- Total: `bandTotal(parts, acted, 200)`; the reveal's band lines show the base, then "Boss destroyed (+k) ·
  streaks, weak points and power-ups +n".
- Fitted by quantile-matching the wavRev 9 base units to wavRev 8's points over the same bots and seeds
  (`scripts/wavefront-expand-bands.ts`), then the edge curve by level.

## Tuning table (skill-band bots, 40 room seeds a level, server replay)

| Level | wavRev 8 median | top 10 % | best | wavRev 9 median | top 10 % | best | v9 base median | v9 edge median | boss killed (v8 → v9) |
|---|---|---|---|---|---|---|---|---|---|
| Average | 68 | 136 | 150 | 71 (+4 %) | 125 | 159 | 68 | 2 | 1/40 → 1/40 |
| Good | 123 | 150 | 150 | 117 (−5 %) | 149 | 190 | 112 | 4 | 8/40 → 1/40 |
| Great | 125 | 150 | 150 | 133 (+6 %) | 161 | 179 | 125 | 6 | 7/40 → 4/40 |
| Near-perfect | 140 | 150 | 150 | 153 (+9 %) | 176 | 191 | 138 | 12 | 18/40 → 9/40 |

Medians stay within ±10 % of wavRev 8; the spread above 150 is the features' edge (near-perfect players'
top 10 % 176, best 191). `bun scripts/wavefront-expand-bands.ts --seeds=40` reproduces it.

A scripted look-ahead player (`scripts/wavefront-expand-ace.ts`, not a human model) scores **200** on
room seed 0 (boss down at 65 s, streak 113, edge units 572); its log is in
`scripts/fixtures/wavefront-expand-runs.json.gz` and scores ≤ 150 on wavRev 8.

## Checks

- New: `scripts/wavefront-expand-check.ts` (~10 s): 32 runs recorded on the pre-expansion code replay on
  wavRev –, 2–8 to their stored score and final-state digest (`scripts/fixtures/wavefront-expand-legacy.json.gz`,
  recorded from the base tree by `scripts/wavefront-expand-record.ts`); rooms deal wavRev 9; 16 recorded
  wavRev 9 runs replay; the 200 run; rule tests on hand-built states.
- `src/lib/arcade/arcadeFxGames.renderer.ts` (Wavefront's fx spec only): the clear banner names the gunship
  ("GUNSHIP DOWN!") and numbers the waves after it as waves; "BOSS HIT" centres on the gunship's width.
- `scripts/fixtures/replay-runs.json`: one wavRev 9 run appended (`bun scripts/replay-fixtures.ts --add=wavefront`)
  for replay-check's "a stored run on the revision rooms deal".
- Updated "rooms deal" lines (the play moved on): arcade-tuning-a-check, arcade-tuning-c-check,
  arcade-tuning-g1-check (and its demo line), arcade-batch3-check (dealt stamp, intro wording).
- Tools: `scripts/wavefront-expand-bands.ts` (the table above; `--record` re-records the 16 runs) and
  `scripts/wavefront-expand-ace.ts` (`--write` re-records the 200 run).

## Assumptions and decisions

- "Bigger arena" is a taller world at the same 390 px width (a wider world would have moved every shared
  fill, scene and fx layer); the sides at 414 px are the screen fill.
- "Longer waves" is more ships a wave plus the gunship stage, not a longer run (the room clock stays 90 s).
- The streak is the multiplier behind the edge; it never changes the base, so a player who ignores the
  features scores as on wavRev 8.
- A spread shot's side bolts and fly-in volleys can't break a streak (auto-fire would otherwise break it
  at every wave start through no fault of the player's).
- Sounds reuse Wavefront's cues: the pickup (`wavefront.pierce`) for every power-up, the armour clank
  (`wavefront.armourHit`) when the shield saves a hit, the retro blip (`wavefront.dive`) when the streak's
  multiplier steps up; no new files or manifest entries.
- The intro demo plays only on wavRev 9 (none is recorded), so the intro shows its still. **The demo needs
  re-recording on wavRev 9.**

## Shared files touched (Wavefront lines only)

- `src/lib/arcade/liveBands.ts`: the wavefront line (wavRev 9, `WAV_V9_BAND_CURVE`, `bands` wavRev 8).
- `src/lib/duel/arcade.server.ts`: `generateWavefront` deals wavRev 9.
- `src/lib/duel/instructions.ts`, `src/lib/duel/introScore.ts`: the wavefront blocks.
- `src/lib/duel/introDemo.functions.ts`: the wavefront demo line.
- `src/lib/fx/gameSounds.ts`: Wavefront's observer only.
- `scripts/arcade-skill-bands/games.ts` (`expand` field on the spec type and the wavefront line) and
  `scripts/arcade-skill-bands/bots/wavefront.ts` (weak-point aiming).
