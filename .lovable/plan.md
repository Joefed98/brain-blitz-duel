# Tune Balance, Sum Hunt, and Wordsmith

## Changes

- **Balance:** replace square peg markers in play, examples, and reveals with 2 px hanging gold lines aligned to the distance labels. Keep large invisible measured targets; brighten the active line to 4 px and hang weights immediately below the beam.
- **Sum Hunt:** generate a deterministic, stage-indexed 5×5 board for each stage using values 1–20, with about 40% two-digit cells. Generate targets from 20–25 followed by seeded rises of 8–14. For stages 1–8, deterministically reroll until the board has 1–3 distinct orthogonal paths of at least two cells matching the target. Stage 9 uses a fresh board and its full-board sum. Move to the next board with a slide animation after each clear, preserve replay-based server verification, and simplify incomplete reveal/results text to `Stage N of 9`.
- **Wordsmith:** treat pointer movement below 8 px as a tap. A tap appends an unused wheel letter; tapping a used letter removes it and every later letter. Preserve drag-to-connect and submission through SUBMIT, the word box, or Enter.
- Update help text, code-level regression checks, and project notes. Do not run browser tests.

## Technical details

- Sum Hunt boards remain derived solely from the stored seed and stage index, so both players and server replay receive identical boards.
- Path counting and validation use the same four-direction adjacency rule.
- Balance keeps `getBoundingClientRect()` hit-testing on the transformed, invisible HTML targets.
