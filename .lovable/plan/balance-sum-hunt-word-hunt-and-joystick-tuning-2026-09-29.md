# Balance, Sum Hunt, Word Hunt and joystick tuning

## What will change
- Rework Balance to tap-only placement: weights rest above the beam, empty peg markers appear only while a weight is selected, and measured on-screen targets place the weight. Keep double-tap return and rebuild the reveal as a vertically spaced, scrollable stack.
- Convert Sum Hunt to a deterministic 4×4 board with 16-cell final clear, 64 px minimum cells, and regenerated 1–3-path boards for stages 1–8.
- Add tap-built words to Word Hunt alongside drag tracing, including trim-back, non-adjacent restart, last-letter resubmit, and a dedicated Submit control.
- Extend the shared arrow control with a remembered per-device joystick mode. Step games fire once until recentered; Maze Dash repeats every 180 ms while held.

## Technical details
- Preserve existing answer formats and server replay so taps, joystick moves, and arrow presses are recorded identically.
- Use transformed DOM rectangles for Balance target hit-testing.
- Update generation constants and deterministic checks for the smaller Sum Hunt board.
- Store only the joystick preference locally on the device; puzzle state remains unchanged.
- Update affected instructions, summaries, checks, and work notes where wording or constants changed.

## Verification
- Run focused deterministic generation/replay checks and type checks.
- Inspect preview build diagnostics.
- Do not run browser tests.
