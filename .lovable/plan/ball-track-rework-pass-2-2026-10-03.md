# Ball Track rework pass 2

## What will change
- Expand Ball Track to an 8×8 pipe grid while keeping the 90-second round and existing scoring formula.
- Reduce balls to about 55% of a tile and replace line glyphs with layered tube graphics that show highlight and shadow.
- Add 4–6 fixed blocked cells, two colour gates, and two linked pairs per puzzle.
- Make linked-ball taps launch and animate both balls together; replay will expand the single recorded drop into the paired drop deterministically.
- Update the intro example and wording to explain blocks, gates, and linked drops.

## Puzzle generation and validation
- Rebuild the 400-board server-only bank answer-first for the 8×8 rules.
- Store blocks, gates, pairs, solution pipes, and a 12–20 rotation minimum with every puzzle.
- Reject generated boards unless all eight solved paths reach their matching buckets, avoid blocks, obey gates, and each pair is simultaneously valid.
- Keep rotations and drops as the submitted event log; server replay remains the scoring authority.

## Layout and checks
- Size the live grid from available width so the complete balls + 8 rows + buckets layout fits the two requested phone dimensions without scrolling.
- Update replay/bank checks for blocks, gates, paired drops, 400 distinct boards, and stored minimums.
- Run source checks, bank validation, type checking, and build diagnostics only. No browser tests.

## Technical details
- Blocked cells will use a separate tile marker and reject rotation events during replay.
- Gates remain ordinary rotating pipes with an additional colour restriction checked when a ball enters the cell.
- A drop event still names one ball; replay resolves its stored pair and marks both balls dropped in one action, preserving the compact event format.
