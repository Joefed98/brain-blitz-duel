# Four speed-game changes

## Build
- Extend Reaction Time to a 60-second stored schedule with 5–8 gold flashes, proportionally scaled decoys, dynamic averaging, and simplified play copy.
- Rebuild Number Hunt around 20 two-digit targets and four stored, non-overlapping layouts; switch layouts at 15, 30, and 45 seconds without changing the next target, then apply the new complete and partial scoring.
- Expand Stop Watch to ten progressively harder stored watches, with watch-specific full-sweep allowances from 1 through 10 and unchanged ten-result average scoring.
- Rework Don’t Break the Chain into a 60-second continuous run over seeded 28-node sets, shape-only nodes, no fixed link target, and score each valid link/error directly.
- Use the shared compact timer presentation for Chain so its node field receives the reclaimed vertical space.

## Verification
- Update focused generators, grading, summaries, instructions, and deterministic checks.
- Review source sizing and reserved vertical space for 390×700 and 375×667 without opening screens.
- Run self-replay proofs only if one of these four games is implemented on the arcade replay engine; do not run unrelated proofs or browser tests.

## Technical details
- Keep generated schedules/layouts in the stored puzzle so both players receive identical rounds and server grading uses the same data.
- Preserve server-authoritative scores; clients submit interaction results/logs, not trusted scores.
