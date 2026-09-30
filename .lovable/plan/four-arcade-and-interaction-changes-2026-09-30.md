# Four arcade and interaction changes

## Scope
- Rebuild Hot Floor as a deterministic 90-second, three-life sequence of fixed 6×8 route-planning stages, while keeping its existing name, registry key, replay format conventions, and server-authoritative score.
- Shift Tilt's generated maze progression forward by one difficulty step without changing its completed-maze scoring.
- Prevent iOS selection, callouts, context menus, and long-press selection once at the shared active game-screen wrapper used by duel and practice play.
- Add three deterministic Flip decision-pattern families after 10 seconds, preserve the current pace/density, and include them in survivability validation.

## Implementation
- **Hot Floor simulation:** generate seeded stage boards with start/exit cells, missing tiles, per-tile countdowns, a stored verified route, and a deliberately failing tempting route. Replay swipes as six-tick orthogonal hops; invalid/fallen landings and tiles expiring under the figure consume a life and restart the stage with freshly generated countdowns. End after ten stages, three lost lives, or 5,400 ticks; score 15 per completed stage.
- **Hot Floor presentation:** draw the complete board without scrolling, live monospace countdowns and threshold colours, cracks, pulsing exit, capsule player, `Stage N`, and three life dots. Replace intro example, instructions, reveal, summary data, and the round limit with the requested wording and 93-second phase allowance.
- **Tilt progression:** omit the old first maze by generating difficulty levels from the old level 2 onward, continuing the established size/pit progression for later mazes.
- **Shared iOS guard:** add a reusable play-area wrapper/handler and apply it to both duel and practice active screens. Suppress selection/callout throughout the game content, prevent context menus, and prevent long-press touch defaults without blocking normal taps, swipes, drags, or control buttons.
- **Flip decisions:** represent two-flip overhangs, offset paired spikes, and false gaps as grouped generated patterns. From 10 seconds onward, make at least 40% of accepted hazard groups decision patterns, and reject/re-roll any pattern that leaves no valid solver state.

## Checks
- Extend focused scripts to verify Hot Floor stage solvability, failing decoy behavior, life/restart/scoring, and Flip's decision share across 20 seeded courses.
- Run the 200-run client/server identity proof for Hot Floor, Tilt, and Flip, plus the TypeScript check and preview build diagnostics.
- Do not run browser or device tests; report those visual and touch behaviors as untested.
