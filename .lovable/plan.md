# Seven focused puzzle fixes

## Changes

- **Wordsmith:** store the in-progress word as an ordered list of tile indexes. Tile taps add or remove that exact tile, word-bar taps return that exact tile, keyboard entry maps letters only to currently unused matching tiles, and the in-round found-word list is removed while points and word count remain.
- **Groups:** expand the active 4×4 grid to the full available width with roughly 6px gaps and at least 44px tile height. Use a one-line size that comfortably fits ten letters, shrinking only longer words. Increase found-group band height and text proportionally.
- **Word Hunt:** remove the in-round found-word panel entirely while retaining internal found-word tracking, score, count, validation, and final reveal data.
- **Sequence Recall / Reverse Recall:** keep every entered tile in the light-yellow selected state. Tapping an entered tile still removes it and all later entries; the temporary tap flash remains only where useful.
- **Symbol Scan:** use a strict vertical layout with target header, a flexible square grid area, then a natural-height Submit button separated by 12px.
- **Spot the Difference:** add a 12px neutral divider gap between both panels in intro, play, and reveal views, using the existing card-border colour.
- **Block Party:** reserve at least 35% of the puzzle area for the tray, calculate the largest nine-piece scale that fits without scrolling, target 60% of a board cell and never drop below 45%. Keep Block Party’s timer at the existing 60% short-screen scale before reducing pieces.

## Validation

- Run focused TypeScript and lint checks for the changed files.
- Confirm the preview build succeeds from the project build log.
- Do not run browser tests.
