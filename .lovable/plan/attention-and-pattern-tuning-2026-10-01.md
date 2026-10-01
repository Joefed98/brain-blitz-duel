# Attention and Pattern tuning

## What will change

### Colour Clash
- Replace the current swipe-to-gate stream with a deterministic 60-second falling-word lane game while retaining the existing `stroop` room identity and Attention category.
- Show a fixed five-second demonstration before live words begin. Use three lanes through 30 seconds, then redivide into four lanes with a 500 ms flash.
- Spawn one word at a time. Its normal fall time starts at 3.0 seconds and drops by 12% at each 15-second boundary; a successful or wrong landing immediately starts the next word. Keep the seeded ink/word mismatch, exact 15-second rule swaps, gate reshuffles, and total generated-word count.
- Record all steering and fast-drop actions as `k = 5` arcade events. Left/right buttons and the remembered arrows/joystick setting move by lane; tapping the board records an absolute lane target; down or a downward swipe records a drop.
- Keep server replay as the source of the result and score `round(150 × correct ÷ total_words) − 2 × wrong`, floored at zero. Update the intro, controls, reveal, summaries, and 60-second round limit.

### Intruder Detection
- Change all five generated boards to 3×3 while preserving one change on boards 1–2, two changes on boards 3–5, half-cell shuffles on boards 4–5, all existing phase timings, and current scoring.
- Update the generator check to assert five 3×3 boards, exact per-board change counts, shuffle metadata, and valid tap targets.

### Count Up
- Generate every shape centre from its actual size so its full rotated bounding extent remains inside the scene.
- Add a deterministic visibility check for every counted shape against both arena edges and all shapes above it. Reject and regenerate any scene where a counted shape is clipped or has less than 50% visible area.
- Extend the focused generator check across repeated 50/80/110-shape scenes, including exact stored counts, full containment, and measured target visibility.

### Laser and Mirrors
- Replace the splitter tile with a dark, 90%-cell teal diamond containing a bold Y fork and two short outgoing beam stubs.
- Draw each directional-gem marker as a solid white chevron outside the gem, on its required entry side and pointing inward. Use shared geometry for all four directions so markers stay inside the cell but do not overlap the gem.
- Put a working splitter and directional gem in the fixed intro example. The shared board renderer will continue to show the same symbols during play and in both reveal boards.
- Add source-level symbol geometry checks covering all four directional-gem sides and the intro/reveal data paths.

## Verification
- Run 200 deterministic phone/server identity replays for Colour Clash and confirm clean input logs, matching checkpoints, final state, total-word count, and score.
- Run the focused Intruder, Count Up, and Laser generator/geometry checks described above.
- Run the TypeScript check and inspect the latest preview build diagnostics.
- Do not run browser or device tests; appearance and touch feel remain for your device testing.

## Technical notes
- Colour Clash remains an arcade replay game. Its input payload will distinguish relative lane moves, absolute tapped lanes, and fast drops while using event kind 5 throughout.
- Count Up visibility will be proved with deterministic sampled shape masks in generation rather than inferred from layer order.
- Laser beam rules and generation remain unchanged; this pass changes symbols and the fixed teaching example only.
