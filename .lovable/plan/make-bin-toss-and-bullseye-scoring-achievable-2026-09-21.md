# Make Bin Toss and Bullseye scoring achievable

## What will change

- Retune the shared flick curve around a 1300 px/s reference while preserving the 250–2200 px/s clamp and deterministic square-root response.
- Reduce both games’ seeded wind range to −2…+2 without changing how the current wind indicator is presented.
- Make Bin Toss easier with an 84 px opening, 10 px rim inset, 110–245 px throw distances, and integer gravity reduced by about 15%.
- Make Bullseye easier with a 170 px outer radius, gentler per-arrow shrinking, and 6–14 px wind drift.
- Keep the existing `?dev=1` calibration readout.
- Add render-only correction feedback: the completed Bin Toss arc remains faintly visible, and the last Bullseye landing dot remains faintly visible, until the next valid release.

## Technical details

- Recalculate the integer lookup values for \(\sqrt{speed / 1300}\), including interpolation and the existing speed limits.
- Re-solve Bin Toss’s integer reference launch against the new gravity and throw-five distance; set Bullseye’s flight denominator so a 1300 px/s straight-up reference shot still reaches centre.
- Keep path/ghost presentation outside authoritative scoring state so replay checksums and scoring remain deterministic.
- Update the proof calibration assertions and add checks for the new wind bounds, distances, opening tolerance, target scale, and drift constants.

## Verification

- Run the Bin Toss/Bullseye 200-run random-flick client/server identity proof and input-range checks.
- Run the existing arcade regression proofs and TypeScript check.
- Confirm the latest preview build is healthy. No browser tests will be run.