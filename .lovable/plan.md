# Three number-game changes

## Build
- Extend Ten Drop to a deterministic 90-second run, replace its ten target bands and pace curve, and strengthen the 2,000-seed reachability checks so early targets need at least three digit presses and later hard targets require an operator.
- Put Ten Drop’s target, running total, progress, and compact rectangular timer together in its top bar; remove the shared circular timer slot for this game so the tile arena extends upward without overlap at both requested phone sizes.
- Change Number Pyramid into one 120-second sequence of three boards: 4-row/4–5 empties, 5-row/6–8 empties, then 5-row/9–11 empties, with a small Skip control and persisted answers for every board.
- Rebuild Number Pyramid as 400 sets of three. Prove each board has one tray assignment, enforce uniqueness within every set, and keep every solution private until reveal.
- Grade Number Pyramid as 40 points per completed board, plus up to 30 time points only when all three are complete; otherwise include the proportional score for the one board currently in progress, capped at 150.
- Set Trail to 120 seconds and calculate its completed-path bonus as up to 50 points from the new limit.

## Verification
- Run the Number Pyramid bank generator and focused bank/scoring checks.
- Re-prove Ten Drop reachability over 2,000 seeds and run the self-replay proof for Ten Drop only; do not run another arcade game’s proof.
- Run focused TypeScript and preview diagnostics without browser tests or opening the screens.
