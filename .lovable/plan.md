# Ball Track tuning pass 3

## Build
- Extend deterministic Ball Track replay from three to five pipe orientations, including stateful shallow-pipe travel, loss rules, gates, blocks, pairs, and richer path points for identical animation.
- Rebuild all 400 seeded boards answer-first with fixed vertical top rows, non-crossing paired balls, valid shallow runs, and stored 12–20-rotation solution plans.
- Update the board visuals: smaller rotating balls, doubled full-edge 2.5D tubes, near-wall occlusion, dim fixed top row, and heavier nested pair links.
- Move the live board down about 24 px while preserving the compact 8×8 phone layout.

## Validation
- Validate all 400 stored solutions, constraints, scoring, and replay determinism.
- Run type and source checks only; do not run browser tests.

## Technical details
- Rotation events remain the submitted input; fixed top-row rotations are ignored by both phone and server.
- Animation follows deterministic centreline waypoints returned by shared replay rather than changing submitted events.
- Scoring remains partial `round(70 × home ÷ 8)` and complete `100 + speed bonus + minimum-rotation bonus`, capped at 150 over 90 seconds.
