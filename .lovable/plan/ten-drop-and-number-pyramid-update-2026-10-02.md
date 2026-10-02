# Ten Drop and Number Pyramid update

## Build
- Simplify Ten Drop’s in-game header to a gold running total on the left and the target centred, leaving countdown display solely to the shared timer bar above it.
- Rebalance Ten Drop’s vertical layout so the falling-tile arena begins higher without overlap.
- Expand Number Pyramid to four sequential boards with the requested row counts, empty-cell ranges, and bottom-value ranges; extend its round to 150 seconds.
- Rebuild the server-only bank as 400 four-board sets, rejecting duplicate board-and-tray combinations and proving one valid tray assignment per board.
- Add double-tap return for placed Number Pyramid tiles while retaining tap and drag placement.
- Change scoring to 30 per completed pyramid, a proportional 30-point all-four speed bonus, and proportional 30-point partial credit on the active pyramid.
- Move the four-board indicators directly below the timer, lower the tray, and size the pyramid from available width and height for short-phone layouts.
- Update instructions, reveals, summaries, fallback data, and stored-answer handling from three boards to four.

## Validation
- Run the Number Pyramid bank builder and focused bank/scoring checks.
- Run TypeScript and source-level layout checks only; do not run browser tests.
- Check the preview build diagnostics after changes.
