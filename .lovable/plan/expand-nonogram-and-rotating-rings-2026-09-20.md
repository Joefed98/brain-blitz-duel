# Expand Nonogram and Rotating Rings

## Scope
Only Nonogram and Rotating Rings will change. Their scoring formulas and reveal durations remain unchanged.

## Nonogram
- Move the shared board rules to 9×9, 30–45 filled cells, and 90 seconds.
- Replace the current short 5×5 strings with at least 40 complete 9×9 pictograms.
- Reject every pattern with an empty row or column, including bank entries, random fallback candidates, and the final fallback.
- Keep the existing exact line-solver uniqueness proof and re-roll non-unique boards.
- Strengthen the proof script to verify 81 cells, the fill band, no empty line, clue fidelity, and exactly one solution across generated samples.
- Rework the playable and reveal boards so five-number clues cannot overlap the 9×9 grid; keep play cells at least 34px and fit the full screen at 375×667.
- Replace the fixed intro illustration with a compact 4×4 example.

## Rotating Rings
- Change the shared rules to four rings, 8–14 scramble turns, and a proven minimum of 6–10 turns.
- Apply chained motion as ring 2 → ring 3 and ring 3 → ring 4; rings 1 and 4 move independently.
- Keep server replay and BFS authoritative, expanding the search to all 8⁴ offset states.
- Replace side-tap rotation with ring selection, a gold selected-ring outline, and separate 56px anticlockwise/clockwise controls.
- Draw both linked-ring indicators and scale the board and controls to fit 375×667.
- Update the fixed example and instruction copy to match selection and button controls.
- Strengthen the proof script to verify four rings, both links, independent inner/outer turns, exact minimum, and stored solution replay.

## Validation
- Run the focused Nonogram and Rings proof scripts with repeated generated boards.
- Run formatting, focused lint/type checks, and the project build.
- Do not run browser tests.
