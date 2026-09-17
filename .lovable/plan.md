# Colour Connect and puzzle controls

## Scope
- Rename Flow’s player-facing name to Colour Connect everywhere it appears.
- Expand it to an 8×8 board with eight pairs using all eight game colours, retaining current path drawing and partner-dot completion.
- Remove Block Party’s double-tap wording and make its ghost/drop use shared cell hit-testing with anchor-cell snapping.
- Restrict Ice Slide arrows to meaningful, reachable cells and verify removal changes reachable search behavior.
- Make Laser undo remove placed mirrors in reverse placement order without recording rotations or flips.
- Confirm the requested existing time limits for Unblock, Block Party, Lights Out, Pipes, Ice Slide, and Laser and Mirrors.

## Technical checks
- Add focused source/generator assertions for board size, colour coverage, arrow necessity, placement history, and timing constants.
- Run TypeScript, focused lint, generator checks, and preview build checks only. No browser tests.
