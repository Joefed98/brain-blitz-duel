# Fix and audit short-phone puzzle layouts

## What will change
- Rework Pattern Completion into a strict vertical layout: fixed top bar, a roughly 70% timer, a square 3×3 grid that yields height first, then fixed-height picker rows and Submit.
- Audit every registered puzzle’s active round and answer reveal at 390×700 and 375×667.
- For any failing type, keep headers, timers, controls, trays, and keypads reachable without scrolling; grid-based puzzles will shrink their board before controls.
- Use the smaller timer treatment for the UI-heavy types named in the request, while preserving normal timers elsewhere when they fit.
- Keep puzzle rules, generation, timing, scoring, and submission behavior unchanged.

## Verification
- Exercise every registered puzzle in Practice at both requested viewport sizes.
- Check viewport overflow and each visible element’s bounds during play and reveal.
- Confirm Pattern Completion picker rows remain at least 44px tall and its grid retains a square aspect ratio.
- Recheck the preview build and report the exact puzzle types changed.

## Technical details
- Prefer narrowly scoped flex/grid sizing and container-relative dimensions in puzzle stages and reveal content.
- Shared wrappers will only change where a common constraint fixes multiple confirmed failures without altering other screens.
