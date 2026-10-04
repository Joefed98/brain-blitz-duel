# Slice combos and Snip wider arena

## Slice
- Replace slice-count progression with qualifying-slice levels: first 3+ disc slice gives ×2, second gives ×3, further combos retain ×3.
- Each qualifying slice resets a 10-second combo window; only expiry resets it. Bomb penalties and missed-disc tracking remain, without breaking combos.
- Show a gold level bar, multiplier and seconds remaining; preserve the qualifying-slice gold flash.
- Current score: floor(150 × weighted slices ÷ (3 × available discs)) − 10 per bomb, clamped 0–150.
- Change 150 to 235 in that weighting: 70% sliced at ×2 gives 109; 90% at ×3 reaches the 150 cap (before bomb penalties). Preserve penalty-before-cap behavior.

## Snip
- One star per level; 10 per sweet fed + 3 per collected star, with round(20 × time remaining ÷ 60 seconds) for feeding all ten; cap 150. Preserve stars collected on failed levels.
- Widen the world from 360 to 540 units, keeping a 360-unit viewport. Reposition templates within that world and verify each remains winnable with its single star.
- Horizontally pan with an eased, velocity-led camera and safe sweet visibility; transform cut coordinates using the exact displayed camera offset.
- Arena side walls retain collision and bounce with 70% speed retained; top/bottom exits continue to end a level.

## Technical checks
- Update shared simulation/scoring, camera rendering/input mapping and help text; record changed arcade rules.
- Run self-replay proofs only for Slice and Snip, plus focused timer, scoring, wall/camera and template-solvability checks.
- Inspect automatic code diagnostics; no browser tests.
