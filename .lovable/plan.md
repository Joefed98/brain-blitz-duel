# Stop Watch, Chain, Whack, and Clay updates

## What will change

- **Stop Watch**
  - Keep Watches 1–7 bouncing between both ends.
  - Start the pass counter at 2 on Watch 1 and increase it through 11 on Watch 10.
  - Decrement the counter only when the ticker reaches the right edge.
  - Make Watches 8–10 wrap from the right edge back to the left instead of bouncing.
  - Mark the watch missed as soon as its counter reaches zero, while preserving the existing accuracy scoring and seeded watch traits.

- **Don't Break the Chain**
  - Replace the current serpentine grid positions with stored random scatter layouts.
  - Keep 28 nodes per set, the shape-only cycle, replay grading, scoring, and one-minute run unchanged.
  - Enforce a minimum centre-to-centre distance derived from the 34 px node size plus a clear gap, so nodes never overlap or touch on the supported phone width.

- **Whack-a-Target**
  - Extend the deterministic run to 60 seconds.
  - Start with empty holes, then feed balls from the existing seeded 100-ball queue.
  - Give every raised ball a three-second lifetime, regardless of its current colour rule; a whack or timeout frees the hole for the next queued ball.
  - Preserve rule flips and the existing 2-point / −5-point scoring.

- **Clay Shoot**
  - Reduce the status to one small line.
  - Render all 25 waiting discs identically; reveal gold only after each disc is hit or missed.
  - Let the sky consume all remaining vertical arena space beneath the compact status and lineup, without adding another timer or changing trajectories or scoring.

## Verification

- Update focused source checks for Stop Watch transitions and Chain spacing/scatter generation.
- Run self-replay proofs **only** for Whack-a-Target and Clay Shoot, including Whack’s three-second timeout and Clay’s 25/25 aiming check.
- Run the normal code/build diagnostics, but no browser tests or screenshots.

## Technical details

- Stop Watch’s shared marker function will expose direction, right-edge count, and position for both bounce and wrap modes so display and tap grading use the same state.
- Chain layouts remain embedded in each generated puzzle, so both players and server replay use identical positions even though generation is random.
- Whack queue occupancy and expiry remain fixed-tick simulation state and are included in replay checkpoints.
