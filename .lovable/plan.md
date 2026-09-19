# Chain and Intruder fixes

## Scope
Update only **Don't Break the Chain** and **Intruder Detection**. Keep every other puzzle unchanged and do not run browser tests.

## Implementation
- Make Chain shape-only, with an explicit repeating three-shape cycle and shared segment-intersection logic used by both play and server grading.
- Generate 18 stored-position nodes using depth-first search, store one valid non-crossing 12-node solution privately, and reject layouts unless each solution step offers a crossing decoy plus three shape-invalid choices.
- Update Chain play feedback, gold SVG path, scoring, fixed instructions/example, concise summary, and compact reveal with error taps marked red.
- Change Intruder boards to 3×3, 3×3, 4×4 and raise playable cells to at least 56px while preserving timing, attempts, colours, shapes, change types, and scoring.
- Replace Intruder's reveal with three tightly sized boards in one row, marked answers, per-board result marks, and one summary line.

## Validation
- Extend the existing proof script to verify the stored Chain solution, non-crossing replay, crossing decoys, invalid choices, and new Intruder sizes.
- Run the focused proof script, formatting, lint, TypeScript checks, and confirm the preview build is clean.
- Do not run browser tests.
