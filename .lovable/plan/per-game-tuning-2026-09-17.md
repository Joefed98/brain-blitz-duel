# Per-game tuning

## Changes

- Update the requested generation constants and constraints for Reaction Time, Number Hunt, Count Up, and Mirror Match while preserving room-start generation and shared stored puzzles.
- Update Stop Watch speed, Symbol Scan spacing, Spot the Difference count/scoring/divider, Maze Dash controls, and Spin arrow emphasis.
- Rework Pattern Completion into three stored two-attribute puzzles sharing one continuous 30-second timer, with Submit/Skip progression, three-part progress, server-verified aggregate scoring, and updated intro/reveal/standings text.
- Keep all unlisted puzzle types unchanged.

## Technical details

- Extend Pattern Completion’s data and answer encoding so public puzzle data contains three visible boards while private room secrets retain all three solutions and rules.
- Grade Pattern Completion and Spot the Difference from stored server answers only; apply the requested partial and speed scoring formulas.
- Preserve backward-safe parsing where practical for rooms generated before this update.
- Validate generator invariants and run TypeScript/build checks only; do not run browser tests.