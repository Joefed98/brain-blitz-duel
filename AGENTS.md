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

- ArrowPad owns device-local arrows/joystick preference and reserved full-width control tracks; why: consistent modes without overlaps.
- DuelStart and RoundTitle own shell-free shared-clock room presentations and voice cues; server transitions use fixed deadlines before intro. Why: room sizes and reconnects share timing without changing practice or gameplay.
- AcceptedWordChip owns the reserved confirmation row for word-entry boards, sized by the remaining board region; why: accepted words must not move or cover controls.
- StageCorrect owns the fixed confirmation slot and persisted presentation-only hold deadline for staged puzzles; why: intermediate solved boards stay visible without pausing the shared round clock.
- PhoneShell/GameLayout own equal round geometry; chat stays outside play/reveal, Stage omits repeated hints. Why: room/practice parity.
- Game screens follow the `.game-column` rule: top-anchored 100%-height column, stages mark `data-stage-column`/`data-game-arena`/`data-game-controls`, the capped arena is the only flexible item and controls sit 12px below it; legacy demos keep old layout via `GameColumnLayout`/log revision. Why: controls never drift down with dead space above.
- Directional game controls use the shared press-safe button so pointer holds cannot trigger selection, callouts, or context menus.
- All word games (Wordsmith, Word Hunt, Word Ladder, Tile Grid, Word Slide) check words through the one server-only SCOWL British English list behind dictionary.server.ts; why: one consistent dictionary that never reaches a device.
- RoundIntro renders optional definition `introLine(puzzle)`; why: fixed examples stay fixed while puzzle-specific facts still show.
- TimerBar is the only countdown: accent ring in its existing 20px slot; PhoneShell owns 4px side safety; why: preserve board space.
- Room settings/draws exclude Memory and RETIRED_TYPES; practice retains both via allTypesInCategory. Why: retirement must not remove practice access.
- The browser-safe gameNames catalog supplies each active registry entry's name and named board/demo labels; all non-display logic stays keyed by PuzzleType. Why: display renames must not change saved rounds, assets, inputs or code identifiers.
- Square puzzle arenas use container-sized squares and SVG viewBoxes with coordinate conversion for scaled input; why: boards must remain centred, square and correctly tappable at every arena size.
- The answer reveal shows only the server-stored round score (AnswerReveal's StoredScore, "Scoring…" until it lands); puzzle Reveals must never compute or print a score; scripts/reveal-score-check.tsx guards this. Why: local maths drifted from server scoring.
- RoundIntro exposes Back only in practice; its practice callback cancels the intro and clears run state without grading. Why: leaving an intro must not create results or affect rooms.
- Non-engine demos use the real Stage, INTRO_EXAMPLE_SEED, sealed example id and recorded area-fraction actions/verdicts; why: real UI without exposed answers or divergent play.
- Changed inputs/layouts reject demos by shape or presentation revision; why: stale touches must not target new controls.

- FX/audio stay outside sims; no untargeted boxes; dev displays require accepted keys. Why: safe feedback.
- Hover barriers use two finite cached full-height rasters cropped to collision rectangles; Fission lives reuse the player sprite rows. Why: art stays bounded, inexpensive and visually consistent without simulation changes.
- soundSettings owns device channel migration and normalized slider values; sound.ts owns bus gains and round-track ramp classification, while MuteToggle owns compact overlay controls. Why: all screens share settings without altering gameplay or clock ownership.

- PhoneShell shares paint; WordsmithRing owns the shared circular orbit board and wordInput owns taps; presentation revisions reject coordinate demos of obsolete boards. Wordsmith keeps centre index, size bands and original-band seeded examples. Why: demo compatibility.
- The last round leads to a server-timed, unskippable `winner_reveal` phase (WinnerReveal, shared-clock cues) before status finished, replacing final standings; why: every phone reveals the winner at the same moment.
- Round music is started/stopped only by useRoundMusic, called from the room and practice round-phase state; screen components (intro, countdown, timer bar, game frame) never touch it. Why: component mounts at the GO cut the track.
- RoomChat owns portalled bounded compact/expanded message sheets and keyboard geometry; room state supplies only chat availability and header time, and gesture blockers exempt data-scrollable. Why: chat scroll stays independent of game/page layouts.

- Pipeline BFS is presentation-only; Flightpath palette/scenery are renderer modules and Grappler art is private. Why: animation/paint cannot alter grading, clocks or Roofbound.

- Refresh icons share one-to-one direction/kind art; Bonk caches original circular-footprint sprites in its renderer and shares vectors with its intro. Why: new artwork must preserve generated variants and replay state.
