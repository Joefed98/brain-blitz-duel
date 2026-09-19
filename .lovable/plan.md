# Fix the three new puzzle rounds

## Changes
- Rebuild Don't Break the Chain around one replayable state: the three-item rule, current index, accepted node chain, and error count. Correct taps alone advance the index and chain; reused or mismatched nodes flash red and only add an error. Derive the rule highlight and gold path from that state, and route node presses through the shared pointer hit-testing helper on the node elements.
- Ease Intruder Detection to 4×4, 4×4, then 5×5; show each board for 4 seconds with a 0.5-second blank; limit generation to red, blue, green, yellow and circle, square, triangle; generate only colour or shape changes; keep three boards, two attempts, 30 seconds, and existing scoring. Keep cells at least 48px within the available play area.
- Measure Gravity Maze’s available play space and size the square board from the smaller of its width and the height left above the controls. Place the 52px arrow diamond at least 16px below the board, with 12px control spacing, shrinking the board before controls on short screens.

## Validation
- Run focused source assertions and the three-game proof script to confirm replay behavior, Intruder constraints, and active registry flags.
- Run TypeScript, lint, formatting, and the preview build checks. Do not run browser tests.
