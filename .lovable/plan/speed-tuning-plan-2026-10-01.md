# Speed tuning plan

## Reaction Time
- Generate five stored gold flashes within the 50-second round.
- Place 1–3 stored teal, red, or blue decoys before each flash, constrain the total to roughly 8–12, and vary both decoy spacing and the final gap before gold.
- Render blue decoys and update the intro copy while preserving false-start penalties and scoring.

## Stop Watch
- Track three zone crossings per watch and show a 3/2/1 passes-left counter, with the final pass highlighted red.
- Add a seeded oscillating horizontal target to Watch 2 and measure taps against its live centre.
- Rebuild Watch 4 as a vertical, accelerating three-pass watch with a seeded moving target in the upper half.
- Preserve Watches 1, 3, and 5 and existing scoring; update the help card.

## Verification
- Add focused code checks for timing bounds, decoy counts and spacing, moving-target positions, pass timing, and scoring.
- Run the focused checks and the TypeScript check only. Do not run browser tests.
