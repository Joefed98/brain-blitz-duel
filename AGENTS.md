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
- Tents uses `-1` for hidden row/column counts; shared solving and validation treat those lines as unconstrained.
- Directional game controls use the shared press-safe button so pointer holds cannot trigger selection, callouts, or context menus.
- All word games (Wordsmith, Word Hunt, Word Ladder, Tile Grid, Word Slide) check words through the one server-only SCOWL British English list behind dictionary.server.ts; why: one consistent dictionary that never reaches a device.
- Stop Watch stores target-motion phase, right-edge allowances, wrap mode, and pass durations in each generated watch; why: every player must see identical moving targets and acceleration.
- Gravity Maze locks a ball when it comes to rest on its own target (locked = sitting on target), and the minimum is a capped breadth-first joint search; why: a summed per-ball heuristic over-estimates when one tilt moves every ball, so it cannot prove a minimum.
- Ice Slide state is (cell, broken thin-ice bitmask) and every search, replay and undo carries the mask; why: thin ice makes move order matter.
- Ice Slide animates the transient ball along `slideOutcome.path`, including entry/exit portal cells and arrow turns, while only the original move array is submitted; why: visual interpolation must not alter deterministic grading.
- Rotating Rings boards store a link-pattern index into the shared bank in rings.ts; why: phone and server must apply identical linked turns.
- Colour Clash is a deterministic arcade replay, while Count Up truth is recomputed from each stored scene; why: room results must be independently verifiable.
- Laser beam tracing branches at fixed splitters and enforces directional gem entry in shared phone/server logic; why: generation, animation, and grading must agree.
- Laser's visual fork offsets are derived from the tracer's paths so a splitter branch is not revealed before the incoming beam reaches it; why: the splitter is not an independent light source.
- Tower's peg count is the length of the stored `start` (3 or 4) and every rule/replay/search reads it from there; why: the peg count varies per puzzle but must be identical for all players.
- Colour Connect walls live on the public puzzle and are passed to the shared `verifyFlow`; uniqueness is proven server-side by an exhaustive solver before a board is used; why: phone, grader and generator must agree.
- Puzzle-specific intro lines come from an optional `introLine(puzzle)` on the puzzle definition, rendered by RoundIntro; why: fixed examples stay fixed while per-puzzle facts (e.g. peg count) still show.
- Bomb Defusal masks are recomputed per panel because many rule predicates read the panel; why: caching by rule text across panels gives wrong uniqueness proofs.
- TimerBar is the only live-round countdown and PhoneShell owns the 4px game-screen safe margin; why: duel/practice timing and arena width must stay identical without per-game timer slots.
- Number Pyramid stores one bank entry as four public boards plus private solutions and submits all four placement maps with the active index; why: skipped boards and current-board partial credit must grade identically on the server.
- Ball Track uses a shared serpentine toggle sim with course-driven fixed bottom-row interception and occupied-tile locks; its server-only bank proves every tray has an upper-routing alternative and every ball gets home; why: drawing, generator and replay must agree without exposing playbooks.
- Memory stays out of room settings/draws; practice uses allTypesInCategory to retain its games.
- Retire types via RETIRED_TYPES; why: room draws filter it, practice does not.
- Logic grids use container sizing; Shikaku/Light Up prove uniqueness. Flood draws a private bank built by retrying exact in-band par proofs; no fallback.
- The answer reveal shows only the server-stored round score (AnswerReveal's StoredScore, "Scoring…" until it lands); puzzle Reveals must never compute or print a score; scripts/reveal-score-check.tsx guards this. Why: local maths drifted from server scoring.
- RoundIntro exposes Back only in practice; its practice callback cancels the intro and clears run state without grading. Why: leaving an intro must not create results or affect rooms.
- Non-engine intro demos drive the game's real Stage over its fixed intro example (generated under `withSeededRandom` with INTRO_EXAMPLE_SEED; the sealed half carries the example id) from a stored action list in fractions of the recorded play area, with recorded server verdicts replayed; why: the demo must show the real puzzle UI without exposing answers or diverging from play.
