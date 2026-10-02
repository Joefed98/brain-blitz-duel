<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Tile Grid is tap-only: rack tile, then empty cell; placed tile, then empty cell or rack.
- Sum Hunt uses deterministic 4×4 stage boards with 1–3 orthogonal target paths of 3–6 cells; server replay regenerates them.
- ArrowPad owns the device-local arrows/joystick preference so every arrow-controlled puzzle behaves consistently.
- Balance placement uses only fixed, non-tilting distance buttons; their peg indices feed the existing server-validated placement encoding.
- PhoneShell gameScreen owns selection/callout suppression: it locks html/body (game-lock class), cancels selectstart/contextmenu, and cancels touchstart inside [data-play-area] with a non-passive listener (React touch handlers are passive).
- Hot Floor generation exhaustively enumerates simple budgeted survivors; accepted stages have at most two routes (three on stages 1–2), a zero-slack pinch on every survivor, three same-or-shorter number failures, and under 20% highest-number-first solves.
- Tents uses `-1` for hidden row/column counts; shared solving and validation treat those lines as unconstrained.
- Directional game controls use the shared press-safe button so pointer holds cannot trigger selection, callouts, or context menus.
- All word games (Wordsmith, Word Hunt, Word Ladder, Tile Grid, Word Slide) check words through the one server-only SCOWL British English list behind dictionary.server.ts; why: one consistent dictionary that never reaches a device.
- Stop Watch stores target-motion phase and pass durations in each generated watch; why: every player must see identical moving targets and acceleration.
- Gravity Maze locks a ball when it comes to rest on its own target (locked = sitting on target), and the minimum is a capped breadth-first joint search; why: a summed per-ball heuristic over-estimates when one tilt moves every ball, so it cannot prove a minimum.
- Ice Slide state is (cell, broken thin-ice bitmask) and every search, replay and undo carries the mask; why: thin ice makes move order matter.
- Rotating Rings boards store a link-pattern index into the shared bank in rings.ts; why: phone and server must apply identical linked turns.
- Colour Clash is a deterministic arcade replay, while Count Up truth is recomputed from each stored scene; why: room results must be independently verifiable.
- Laser beam tracing branches at fixed splitters and enforces directional gem entry in shared phone/server logic; why: generation, animation, and grading must agree.
- Tower's peg count is the length of the stored `start` (3 or 4) and every rule/replay/search reads it from there; why: the peg count varies per puzzle but must be identical for all players.
- Colour Connect walls live on the public puzzle and are passed to the shared `verifyFlow`; uniqueness is proven server-side by an exhaustive solver before a board is used; why: phone, grader and generator must agree.
- Puzzle-specific intro lines come from an optional `introLine(puzzle)` on the puzzle definition, rendered by RoundIntro; why: fixed examples stay fixed while per-puzzle facts (e.g. peg count) still show.
- Bomb Defusal masks are recomputed per panel because many rule predicates read the panel; why: caching by rule text across panels gives wrong uniqueness proofs.
- Skyline's camera zoom is render-only, eased per canvas context; why: the sim and server replay must stay in fixed world units.
- Slice combo misses are detected in the sim when an unsliced non-bomb passes its lastTick; why: the multiplier feeds the server-replayed score.
- Ball Track and Word Search draw from script-built, server-only banks (scripts/ball-track-bank.ts, scripts/word-search-bank.ts); why: each board is proven (unique minimal removals / each word exactly once) offline, not at room start.
- Word Search category lists live in src/lib/duel/wordSearchWords.ts and must be followed by re-running the bank script; why: the bank is derived from them.
- Ten Drop (number) and Clay Shoot (speed) run on the arcade engine but draw from their own categories via `arcadeRun`; Ten Drop proves each target's seeded tile queue with the shared greedy solver at init; why: every player and the server replay must face the same provably reachable targets.
- Number Pyramid draws from a script-built, server-only bank (scripts/number-pyramid-bank.ts); answers are (cell, tray index) pairs graded against the stored tray and solution; why: uniqueness is proven offline and tile values never come from the device.
