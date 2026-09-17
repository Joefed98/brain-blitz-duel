# Clear round instructions and in-round help

## Build
- Add one structured instruction definition to every registered puzzle: a one-sentence GOAL, two or three verb-led HOW lines with one emphasized phrase each, and a one-line SCORE explanation.
- Render that shared GOAL / HOW / SCORE block before each puzzle’s existing fixed example on the round intro, keeping the READY area beneath it and using compact responsive typography for 375×667 screens.
- Remove duplicated instructional prose from the fixed examples while preserving their visual demonstrations and example-specific labels or answers.
- Add a small help control to the shared top bar for active duel and practice rounds.
- Open the same structured instructions in a dismissible overlay without the example; keep the timer visible and running above the overlay.

## Technical details
- Store instructions on the puzzle definition so intro and help always use the same source.
- Use a shared instruction card and shared help overlay component in both duel and practice screens.
- Keep puzzle generation, timing, input, grading, scoring, and results unchanged.
- Validate with static checks and the preview build only; do not run browser tests.
