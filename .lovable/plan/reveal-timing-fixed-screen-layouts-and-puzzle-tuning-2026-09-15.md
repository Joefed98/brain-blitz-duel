# Reveal timing, fixed-screen layouts, and puzzle tuning

## What will change

- Add a per-puzzle `revealMs` setting, defaulting to 5 seconds and using 8 seconds for the named detailed/list reveals. Both room and practice transitions will use it.
- Rework the shared answer-reveal frame to fit within a 390×700 viewport without page scrolling, then compact the detailed reveals requested: Chain Calculation, Target Number, Equation Balancing, run puzzles, Wordsmith, and Word Hunt.
- Make puzzle play screens use the available device height without page scrolling. Tighten Chain Calculation and Target Number specifically, then check every registered puzzle at 390×700 and correct any other overflow found.
- Keep Target Number’s six tile positions fixed. Consumed tiles become disabled placeholders, results replace the first operand’s slot, and the result becomes the active selected operand.
- Ensure Enter submits every typed-answer puzzle, show `PRACTICE` without round pips in practice, and verify puzzle time begins only after the intro countdown completes.
- Update the requested standings summaries and enforce one-line ellipsis for every summary.
- Apply the six requested time limits and the new server-verified Symbol Scan partial-credit formula.

## Technical details

- Extend the puzzle definition/registry with `revealMs`, and add a registry helper used by client phase checks, practice, and the authenticated server phase transition.
- Preserve the current secure grading boundary: Symbol Scan selections are recomputed against the stored target indices on the server; client-reported counts are not trusted.
- Replace Target Number’s shrinking tile pool with six stable slots and undo snapshots, while preserving the existing encoded step format and server replay.
- Use viewport-constrained flex/min-height rules and local overflow only for Target Number’s step history; do not introduce page-level scrolling.
- Update per-type intro text through the existing shared time-limit display where applicable, without changing unrelated puzzle rules or scoring.

## Verification

- Run focused type checks/tests and inspect the latest preview build result.
- Exercise all registered puzzle play screens and reveals at 390×700, with explicit checks for Chain Calculation, Target Number, Equation Balancing, Wordsmith, and Colour Clash.
- Verify Target Number tile coordinates remain stable and its generated result is immediately selected.
- Verify Enter submission for Chain Calculation, Number Sequence, Missing Letters, Number Span, Count Up, and Wordsmith.
- Verify practice shows `PRACTICE`, and confirm a 30-second puzzle receives the full 30 seconds after countdown completion.
