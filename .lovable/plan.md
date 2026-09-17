# Block Party sizing adjustment

## Change
- Reduce the centred board to 85% of the available width.
- Let the tray automatically receive all remaining height below the smaller board.
- Scale tray pieces to the largest size that fits every visible piece without scrolling, capped at 75% of a board cell.
- Keep the shared board hit-testing, snapping, placement behavior, counter, and wording unchanged.

## Validation
- Confirm the sizing formulas preserve the counter, centred board, remaining-height tray, and nine-piece capacity at the requested phone dimensions.
- Run focused type, lint, source, and preview-build checks only; no browser tests.
