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
- AcceptedWordChip owns the reserved confirmation row for word-entry boards, sized by the remaining board region; why: accepted words must not move or cover controls.
- StageCorrect owns the fixed confirmation slot and persisted presentation-only hold deadline for staged puzzles; why: intermediate solved boards stay visible without pausing the shared round clock.
- Tile Grid uses tileGridWordCells for client verdict-based counting and server dictionary-based counting; why: crossing tiles and changing runs must grade and display consistently without shipping the dictionary.
- PhoneShell gameScreen owns selection/callout suppression: it locks html/body (game-lock class), cancels selectstart/contextmenu, and cancels touchstart inside [data-play-area] with a non-passive listener (React touch handlers are passive).
- Directional game controls use the shared press-safe button so pointer holds cannot trigger selection, callouts, or context menus.
- All word games (Wordsmith, Word Hunt, Word Ladder, Tile Grid, Word Slide) check words through the one server-only SCOWL British English list behind dictionary.server.ts; why: one consistent dictionary that never reaches a device.
- Colour Clash is a deterministic arcade replay, while Count Up truth is recomputed from each stored scene; why: room results must be independently verifiable.
- Puzzle-specific intro lines come from an optional `introLine(puzzle)` on the puzzle definition, rendered by RoundIntro; why: fixed examples stay fixed while per-puzzle facts (e.g. peg count) still show.
- TimerBar is the only live-round countdown and PhoneShell owns the 4px game-screen safe margin; why: duel/practice timing and arena width must stay identical without per-game timer slots.
- Memory stays out of room settings/draws; practice uses allTypesInCategory to retain its games.
- Retire types via RETIRED_TYPES; why: room draws filter it, practice does not.
- Logic grids use container sizing; Shikaku/Light Up prove uniqueness. Flood draws a private bank built by retrying exact in-band par proofs; no fallback.
- Square puzzle arenas use container-sized squares and SVG viewBoxes with coordinate conversion for scaled input; why: boards must remain centred, square and correctly tappable at every arena size.
- The answer reveal shows only the server-stored round score (AnswerReveal's StoredScore, "Scoring…" until it lands); puzzle Reveals must never compute or print a score; scripts/reveal-score-check.tsx guards this. Why: local maths drifted from server scoring.
- RoundIntro exposes Back only in practice; its practice callback cancels the intro and clears run state without grading. Why: leaving an intro must not create results or affect rooms.
- Non-engine intro demos drive the game's real Stage over its fixed intro example (generated under `withSeededRandom` with INTRO_EXAMPLE_SEED; the sealed half carries the example id) from a stored action list in fractions of the recorded play area, with recorded server verdicts replayed; why: the demo must show the real puzzle UI without exposing answers or diverging from play.
