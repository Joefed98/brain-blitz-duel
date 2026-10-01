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
