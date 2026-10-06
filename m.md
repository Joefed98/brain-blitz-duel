---
name: Colour Clash fixed queue
description: 52 words, 75 s run (78 s limit), five 15 s phases fall 1.80/1.60/1.40/1.20/1.00 s, 130 × share − 2/wrong + 20 × left/75 s bonus; older revisions unchanged
type: feature
---
- Current (clashRev 3): N = 52 words, one at a time; run 75 s, registry limit 78 s.
- Five 15 s phases, fall per word 1.80 / 1.60 / 1.40 / 1.20 / 1.00 s (settings one tick shorter: 107/95/83/71/59).
- Rule swap + gate reshuffle at every 15 s boundary; lanes 3 → 4 at 30 s.
- No fast drops: 52nd word appears at 70.4 s.
- Score: round(130 × correct / 52) − 2 per wrong, + round(20 × ticks left / 4500) only if all 52 sorted; clamp 0–150. Half-time anchor 140.
- Older stored rounds keep their own rules: 52-word/60 s (fall 1.60/1.30/1.10/0.70), 18-word, and legacy open stream. Never regrade.
- Intro demo must be re-recorded for clashRev 3.
