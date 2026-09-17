# Three scoped puzzle layout fixes

## Changes
- **Groups:** remove the reserved fixed-height band area, stack found bands naturally, and let the 4×4 grid consume all remaining height above the controls. Tiles will stretch with the grid and shrink as solved bands appear.
- **Symbol Scan:** measure the playable stage and its fixed target/control areas, then explicitly size the 7×7 square to the smaller of the available height and available width, preserving a 12px gap above Submit at 375×667.
- **Block Party:** restore a width-filling board and a tray that uses the remaining height. Scale tray pieces to 55–60% of a board cell while keeping all nine visible without scrolling; preserve current placement behavior and wording.

## Technical details
- Changes stay limited to the three listed puzzle files plus the task checklist.
- Existing puzzle rules, scoring, generation, and interaction logic remain unchanged.
- Validate with focused TypeScript, lint, source assertions, and the preview build log. No browser tests.
