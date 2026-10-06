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
- Chain shares versioned length, points and timing across generation, display and replay; unversioned boards retain legacy rules/cycles. Why: never regrade old rounds.
- Art stays in *.renderer.ts; Burst and comet sprites/glow/scanlines cache lazily and arcade loops share frame timing; comet taper keeps a full-cell outer envelope and sparks use the shared cap; why: speed and readable collision bodies without replay changes.
- Cross counters use crossTotalLanes; Flip curves use flipSurfaceLine with exterior-only pools/decoration and silhouette/runner-box clips; pool-death sinks use per-canvas presentation clocks, never sim ticks or input holds; why: scores and collision geometry remain authoritative while frozen deaths can animate.
- Gameplay holds run inside the shared simulation and HUDs read their derived hold state; why: inputs, timeouts and replay must stay synchronized without pausing the client clock.
- Player-selected arcade checkpoints use validated recorded inputs and retained selection counters, with HUD availability derived from sim state; why: the server replay must enforce one-use selection and preserve result facts.
- Arcade bend ramps use shared integer control points and integrated phase rather than resetting oscillators; why: sim, play rendering and saved-run rendering must agree without discontinuities.
- AcceptedWordChip owns the reserved confirmation row for word-entry boards, sized by the remaining board region; why: accepted words must not move or cover controls.
- StageCorrect owns the fixed confirmation slot and persisted presentation-only hold deadline for staged puzzles; why: intermediate solved boards stay visible without pausing the shared round clock.
- Tile Grid uses tileGridWordCells for client verdict-based counting and server dictionary-based counting; why: crossing tiles and changing runs must grade and display consistently without shipping the dictionary.
- PhoneShell gameScreen owns selection/callout suppression: it locks html/body (game-lock class), cancels selectstart/contextmenu, and cancels touchstart inside [data-play-area] with a non-passive listener (React touch handlers are passive).
- Directional game controls use the shared press-safe button so pointer holds cannot trigger selection, callouts, or context menus.
- All word games (Wordsmith, Word Hunt, Word Ladder, Tile Grid, Word Slide) check words through the one server-only SCOWL British English list behind dictionary.server.ts; why: one consistent dictionary that never reaches a device.
- Colour Clash draws spawn lanes from state PRNG using shared lane-count constants; Count Up recomputes truth from stored scenes; why: deterministic server verification.
- RoundIntro renders optional definition `introLine(puzzle)`; why: fixed examples stay fixed while puzzle-specific facts still show.
- TimerBar is the only countdown: accent ring in its existing 20px slot; PhoneShell owns 4px side safety; why: preserve board space.
- Memory stays out of room settings/draws; practice uses allTypesInCategory to retain its games.
- Retire types via RETIRED_TYPES; why: room draws filter it, practice does not.
- Logic grids use container sizing and cell-owned strokes/clipped labels; Shikaku/Light Up prove uniqueness. Flood draws a private bank with exact in-band par proofs; no fallback. Why: aligned geometry.
- Square puzzle arenas use container-sized squares and SVG viewBoxes with coordinate conversion for scaled input; why: boards must remain centred, square and correctly tappable at every arena size.
- The answer reveal shows only the server-stored round score (AnswerReveal's StoredScore, "Scoring…" until it lands); puzzle Reveals must never compute or print a score; scripts/reveal-score-check.tsx guards this. Why: local maths drifted from server scoring.
- RoundIntro exposes Back only in practice; its practice callback cancels the intro and clears run state without grading. Why: leaving an intro must not create results or affect rooms.
- Non-engine demos use the real Stage, INTRO_EXAMPLE_SEED, sealed example id and recorded area-fraction actions/verdicts; why: real UI without exposed answers or divergent play.
- Changed puzzle inputs/layouts reject old demos by shape or recorded presentation revision; why: stale touches cannot target new controls.

- FX/audio stay outside sims; no untargeted boxes; dev displays require accepted keys. Why: safe feedback.
- Music is lobby/standings/podium-only; Beat cues use effects; why: no round music.
- Art caches stay in renderers (see arcade guidance); why: no sim changes.

- PhoneShell shares puzzle paint; WordsmithRing fits shared octagonal wedges; wordInput owns taps. Wordsmith keeps centre index and seeded nine-tile demos. Why: replay compatibility.
