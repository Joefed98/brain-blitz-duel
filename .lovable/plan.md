# Tune five puzzle types

## Scope

- **Nonogram:** return to 7×7, 18–30 filled cells, full row/column coverage, unique solutions, a rebuilt 7×7 pictogram bank, 60-second timer, and a compact board with cells at least 40px.
- **Colour Flood:** expand to 12×12, target exact par 10–15 with a higher bounded search budget, and draw one 2px white outline only around the outer edge of the captured region.
- **Bomb Defusal:** replace strikes and immediate feedback with reversible actions plus Reset and a final DEFUSE submission. Generate six-rule puzzles with at least two ordering rules, a last-card ordering rule that changes the first action, and exactly one valid 3–6 action sequence. Grade the ordered action list server-side, apply exact/prefix scoring, and show a numbered side-by-side reveal with the first mismatch marked red.
- **Groups:** mark the type retired so it remains in practice but leaves room rotation.
- **Rotating Rings:** correct clockwise/anticlockwise movement in shared replay and linked rings, make the rings nearly full-width below the timer, and place the selected label and 56px controls beneath them without overlap.

## Validation

- Update focused generator/proof assertions for the new board sizes, ranges, ordering guarantees, replay direction, retirement flag, and scoring.
- Run focused scripts, formatting, lint, type checks, and the preview build.
- Do not run browser tests.
