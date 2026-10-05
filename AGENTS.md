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

- ArrowPad owns the device-local arrows/joystick preference so every arrow-controlled puzzle behaves consistently.
- Trail uses shared sequential tap/last-player undo helpers and contiguous legal drag prefixes while retaining numbered-slot decoding for old answers; why: mixed gestures must share one sequence without changing independent tile grading.
- Chain stores a seeded cycle per board and uses chainCycleAt/chainRequiredAt in display and replay, falling back to the legacy single cycle; why: reshuffles must change rules identically for all players without invalidating old results.
- Renderer-only tuning uses *.renderer.ts helpers for play/reveal/demo; why: never modify sims or inputs.
- Cross counters use crossTotalLanes; Flip curves use flipSurfaceLine with exterior-only decoration and silhouette/runner-box clips; why: scores and art must follow authoritative geometry.
- Gameplay holds run inside the shared simulation and HUDs read their derived hold state; why: inputs, timeouts and replay must stay synchronized without pausing the client clock.
- Player-selected arcade checkpoints use validated recorded inputs and retained selection counters, with HUD availability derived from sim state; why: the server replay must enforce one-use selection and preserve result facts.
- Arcade bend ramps use shared integer control points and integrated phase rather than resetting oscillators; why: sim, play rendering and saved-run rendering must agree without discontinuities.
- AcceptedWordChip owns the reserved confirmation row for word-entry boards, sized by the remaining board region; why: accepted words must not move or cover controls.
- StageCorrect owns the fixed confirmation slot and persisted presentation-only hold deadline for staged puzzles; why: intermediate solved boards stay visible without pausing the shared round clock.
- Tile Grid uses tileGridWordCells for client verdict-based counting and server dictionary-based counting; why: crossing tiles and changing runs must grade and display consistently without shipping the dictionary.
- PhoneShell gameScreen owns selection/callout suppression: it locks html/body (game-lock class), cancels selectstart/contextmenu, and cancels touchstart inside [data-play-area] with a non-passive listener (React touch handlers are passive).
- Directional game controls use the shared press-safe button so pointer holds cannot trigger selection, callouts, or context menus.
- All word games (Wordsmith, Word Hunt, Word Ladder, Tile Grid, Word Slide) check words through the one server-only SCOWL British English list behind dictionary.server.ts; why: one consistent dictionary that never reaches a device.
- Colour Clash is a deterministic arcade replay, while Count Up truth is recomputed from each stored scene; why: room results must be independently verifiable.
- Puzzle-specific intro lines come from an optional `introLine(puzzle)` on the puzzle definition, rendered by RoundIntro; why: fixed examples stay fixed while per-puzzle facts (e.g. peg count) still show.
- TimerBar is the only countdown: accent ring in its existing 20px slot; PhoneShell owns 4px side safety; why: preserve board space.
- Memory stays out of room settings/draws; practice uses allTypesInCategory to retain its games.
- Retire types via RETIRED_TYPES; why: room draws filter it, practice does not.
- Logic grids use container sizing; Shikaku/Light Up prove uniqueness. Flood draws a private bank built by retrying exact in-band par proofs; no fallback.
- Square puzzle arenas use container-sized squares and SVG viewBoxes with coordinate conversion for scaled input; why: boards must remain centred, square and correctly tappable at every arena size.
- The answer reveal shows only the server-stored round score (AnswerReveal's StoredScore, "Scoring…" until it lands); puzzle Reveals must never compute or print a score; scripts/reveal-score-check.tsx guards this. Why: local maths drifted from server scoring.
- RoundIntro exposes Back only in practice; its practice callback cancels the intro and clears run state without grading. Why: leaving an intro must not create results or affect rooms.
- Non-engine intro demos drive the game's real Stage over its fixed intro example (generated under `withSeededRandom` with INTRO_EXAMPLE_SEED; the sealed half carries the example id) from a stored action list in fractions of the recorded play area, with recorded server verdicts replayed; why: the demo must show the real puzzle UI without exposing answers or diverging from play.
- Mechanic-changing puzzle revisions reject incompatible saved intro demos by their stored puzzle shape; why: old touches must not show retired mechanics while a new fixed example awaits recording.

- Shared category themes, bounded FX and manifest audio adapters live outside sims; why: preserve gameplay and grading.
- Music is lobby/standings/podium-only; Beat cues use effects; why: no round music.
