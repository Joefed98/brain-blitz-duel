# Tune eight puzzle types

## Arcade changes

- **Hot Floor:** add a per-stage hop budget to generated boards and the in-game display. Restrict numbered tiles to 1–9, make at least half of stored-route tiles exact-timing tiles, bias larger numbers toward paths away from the exit, and raise missing-tile counts to 6–12 from stage 3 onward. Reject GO for over-budget routes. Extend generation validation so the stored route succeeds within budget and at least two plausible alternatives fail.
- **Burst:** rebuild the bottom control strip as three equal-width columns across the available width, with 52 px arrow controls, a 64 px FIRE control, 56 px control height, a 72 px strip, and an 8 px arena gap in both control modes.
- **Parry:** enlarge and reposition the ring while preserving room for the bottom controls at the target phone size. Keep swipe input quantized to the nearest of eight positions, add clockwise/anticlockwise one-slot buttons using the same recorded slot events, and change scoring to `5 × deflections − 10 × lives lost`, capped at 150. Update score guidance and reveal copy.
- **Bastion:** reduce barrel tracking to 4° per simulation tick and apply a deterministic 1.2× spawn-rate multiplier during the final 20 seconds.
- **Wavefront:** preserve raw shape, saucer, and wave points, then score `floor(raw × 0.75)` capped at 150. Update the score guidance.

## Logic puzzle changes

- **Shikaku:** move to 9×9 boards with 15–18 rectangles, retain the small-region limits, require at least four off-centre regions of area 6+, and require at least three adjacent equal-area rectangle pairs. Keep server-side uniqueness verification and adjust board sizing for 36 px minimum cells without scrolling.
- **Light Up:** move to 8×8 boards with 14–18 walls, approximately half numbered, including at least two `0` walls and one `3`. Keep unique solutions and adjust play/reveal sizing for 40 px minimum cells.
- **Tents and Trees:** move to 8×8 boards with 11–12 trees. Hide about one third of row and column counts using `?`, and update shared validation and solving so hidden lines impose no visible-count constraint while generated boards remain uniquely solvable from visible information. Adjust play/reveal sizing for 40 px minimum cells.

## Technical details

- Keep all arcade input changes in the existing deterministic event/replay pipeline and update checkpoint-sensitive state only where required.
- Update shared constants, puzzle data handling, grading, summaries, instructions, intros/reveals, and focused check scripts wherever each changed rule is surfaced.
- Add focused generator metrics for Hot Floor's greedy highest-number strategy over 50 stages, including a failure if its solve rate is 20% or higher.
- Strengthen the existing 50-board checks to assert every requested Shikaku, Light Up, and Tents constraint, including uniqueness under hidden Tents counts.
- Record the resulting gameplay and generator rules in the project architecture notes and keep the roadmap current.

## Verification

- Run 200 deterministic client/server replay identity checks for Hot Floor, Parry, Bastion, and Wavefront.
- Generate and verify 50 boards each for Shikaku, Light Up, and Tents and report their constraint/uniqueness results.
- Run focused scoring, Hot Floor strategy, and control-event checks plus the TypeScript check and preview build diagnostics.
- Do not run browser tests; phone layout and feel remain for device testing.
