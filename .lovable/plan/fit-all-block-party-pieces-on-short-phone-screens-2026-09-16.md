# Fit all Block Party pieces on short phone screens

## What will change
- Give Block Party a dedicated active-round column: round bar, a roughly 70%-size timer, covered counter, square 6×6 board, then the tray using all remaining height.
- Remove the score strip only while Block Party is being played so the requested board and all nine pieces have enough vertical space; no score or scoring behavior changes.
- Measure the Block Party play area and tray, then size the board and tray-piece cells from the available width and height.
- Arrange every remaining piece in a wrapping three-column tray grid. Pieces will never be hidden, clipped, or require scrolling.
- Render tray pieces near 60% of a board cell when space permits, smaller on short screens, and enlarge a lifted tray piece to board-cell scale while dragging. Pieces placed on the board remain full board-cell size.

## Verification
- Open Block Party in Practice with all nine pieces still in the tray at 390×700 and 375×667.
- Confirm the top bar, timer, counter, complete board, and all nine tray pieces are visible with no scrolling or clipping.
- Pick up tray pieces and confirm the lifted piece becomes board-cell size and can be dropped onto the board.
- Confirm the preview build remains healthy and no other puzzle layout changes.

## Technical details
- Changes will be limited to `BlockPartyPuzzle` and Block Party-specific active-round wrappers in the Practice and room screens.
- Existing generation, piece definitions, rotation/flip gestures, placement rules, scoring, reveal, and shared controls remain unchanged.
