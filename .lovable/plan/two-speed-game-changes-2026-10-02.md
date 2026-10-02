# Two speed-game changes

## Whack-a-Target
- Replace the timed pop schedule with a deterministic 100-ball queue containing only seeded gold/red colours and seeded hole assignment as holes become available.
- Keep the existing 30-second simulation and rule flips at 10 and 20 seconds.
- Keep a correct-colour ball visible until tapped. Let a currently wrong-colour ball withdraw after 2 seconds; tapping it clears the hole immediately and records the penalty.
- Score 2 points per correct whack, subtract 5 per wrong-colour tap, clamp to 0–150, and update the HUD, intro, reveal, grading details, and round summary for the queue model.

## Clay Shoot
- Extend the deterministic simulation to 60 seconds and generate exactly 25 seeded launches: 22 orange and 3 gold.
- Put every launch parameter in the integer config: edge, origin height, launch tick, angle, speed, colour, hit radius, and trajectory ranges.
- Spread the three gold launches across the run, prevent gold-gold overlap, and give gold clays faster, harder trajectories with a 24 px hit radius; orange retains 30 px.
- Preserve at most one airborne clay in the first half and at most two in the second half, while varying launch heights along both edges, including near-top near-horizontal crossings.
- Score orange hits at 5, gold hits at 10, add 10 for hitting all 25, and cap at 150. Update play/reveal counters, instructions, summaries, and server-graded details to expose the colour split.

## Verification
- Update the focused proof scripts so Whack-a-Target and Clay Shoot are the only self-replay proofs run.
- Run 200 deterministic client/server identity replays for each game with checkpoint comparison.
- Check Whack’s queue length, colour determinism, persistence/2-second retreat behaviour, rule flips, and score boundaries.
- Run Clay’s aiming bot across seeded runs and require all 25 clays, including all gold clays, to be hittable; also check colour counts, non-overlapping gold launches, timing, trajectory variety, and the one/two-airborne limits.
- Run focused TypeScript and preview diagnostics. Do not open screens or run browser tests.

## Technical details
- Both games continue to use the shared 60-tick deterministic arcade engine, integer simulation state, tick-stamped input logs, 300-tick checkpoints, and full server replay. The device-submitted score remains untrusted.
- Existing room generation and category rotation remain unchanged.
