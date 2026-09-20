# Tune five puzzle types

## Scope
Change only Safe Cracker, Bomb Defusal, Sort the Tubes, Intruder Detection, and Don't Break the Chain. Preserve all other puzzles, scoring, and round flow.

## Implementation
- **Safe Cracker:** enlarge interactive arrow targets to at least 52px and arrow glyphs by roughly 30%; enlarge clue copy and line spacing; reduce live dial digit size and safe padding only enough to keep clue card, safe, and TRY separated on short screens.
- **Bomb Defusal:** expand the panel model to seven wires plus a three-position read-only switch; render the switch in play and examples/reveals; raise the timer to 75 seconds; select six rules from a bank of at least 30 templates covering counts, positions from the end, switch state, and “wire after first X”; generate only contradiction-free 3–6 action sequences where at least four rules are effective; keep two-strike server replay.
- **Sort the Tubes:** use eight tubes with six colour sets and two empties; add orange and yellow ball colours; reverse-scramble with 40–60 legal pours; raise BFS cap to 500,000 and accept only proven 12–20 move minima; render play as a stable 4×2 grid when needed while preserving tap/pour behavior and the 60-second timer.
- **Intruder Detection:** generate three 3×3 boards with per-board palettes of 3 colours/2 shapes, 4 colours/3 shapes, then 5 colours/4 shapes including star; keep one colour-or-shape change, timing, attempts, scoring, and three-board reveal; add star rendering.
- **Don't Break the Chain:** increase to 20 nodes; count valid non-crossing 12-link chains with DFS capped at 200 and accept only totals 1–8; store the count privately; bias layouts toward crossing choices; require at least two early shape-valid dead-end traps and retain the stored-route crossing-decoy requirement wherever crossing is geometrically possible.

## Validation
- Extend the existing proof scripts to assert all new constants, panel/rule constraints, BFS bands, Intruder progression, Chain solution count, dead-end traps, and stored solution replay.
- Run focused proof scripts, TypeScript checks, lint/format checks, and confirm the latest preview build is successful.
- Do not run browser tests.
