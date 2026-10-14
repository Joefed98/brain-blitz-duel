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
- `.game-column` keeps controls 12px below arenas; live stages (and demos recorded on GAME_COLUMN_LAYOUT 2) add `.game-column-centred`, which splits spare height evenly above and below a capped arena so it sits centred between the top bar and the bottom controls; demos recorded on layout 1 keep layout 1. Shared word-letter-tile owns paint; histories/ripples are presentation-only; revisions reject stale coordinate demos. Why: polish cannot alter input encoding, grading or replay.
- Game screens are the dynamic viewport (`.game-viewport`, 100dvh; never vh) with `viewport-fit=cover`, and pad-game-safe leaves the home-bar inset plus 16px under the bottom controls; live stages (and demos recorded on GAME_COLUMN_LAYOUT 3) add `.game-column-lifted`, whose per-game lifts (src/polish-layout/bottom.css) raise listed boards' bottom controls further; scripts/bottom-clearance-check.ts proves every active game's controls sit ≥12px above the visible bottom at 375×667 and 390×844, with and without an 80px browser toolbar. Why: no control under a browser toolbar or home bar, and older demos keep their recorded layout.
- In a room the round intro also gives up the chat bar's 64px (`:has(> [data-chat-bar]) > .round-intro`), so READY is never under the sticky chat bar; scripts/safe-area-screens-check.tsx proves every non-game screen keeps text and controls clear of a notch and home bar. Why: viewport-fit=cover lets pages draw under both, and the intro must never scroll.
- Directional game controls use the shared press-safe button so pointer holds cannot trigger selection, callouts, or context menus.
- All word games (Wordsmith, Word Hunt, Tile Grid, Word Slide) check words through the one server-only SCOWL British English list behind dictionary.server.ts; why: one consistent dictionary that never reaches a device.
- Letterfall (wordfall) is the one exception (ruled 12 Oct 2026): its engine sim judges words on the phone, so an exact front-coded copy of that list (minus blocked words and Q-without-U words; scripts/wordfall-dict.ts, proven current and equal to isWord by scripts/wordfall-check.ts) is fetched as a separate text file (public/wordfall/words-<hash>.txt, never the main bundle) at room start when the round order includes Letterfall (or when the practice list shows), is cached in IndexedDB by list version, holds the round intro READY until installed, and the server installs the same data for its replay; why: a word's verdict must be a pure function of the string on both sides, and the main bundle must not carry it.
- In-game "?" help (PuzzleHelp) scrolls inside its own body (.help-sheet-scroll, data-scrollable) with the close button outside the scroller; why: tall help must scroll by touch over touch-action none arenas without moving the game, and closing must always be reachable. scripts/help-scroll-check.tsx proves every game at 375×667.
- The signature beat (src/lib/fx/signature.ts) fires only from the common points (rooms/practice verdict via useSignatureVerdict, arcade run end via arcadeFeedback), never from a game; why: one learned moment, presentation only.
- RoundIntro renders optional definition `introLine(puzzle)`; why: fixed examples stay fixed while puzzle-specific facts still show.
- RoundIntro never scrolls: the demo or example sits in IntroFit (asks for its natural height, shrinks and scales down uniformly) and, when that would leave the picture under 110 px or the text would not fit, the intro steps GOAL/HOW/SCORE down a size (data-compact 1, then 2); scripts/intro-ready-measure.ts --all measures every game. Why: every game's text fits above READY at 375×667 with nothing hidden.
- TimerBar is the only countdown: accent ring in its existing 20px slot; PhoneShell owns 4px side safety; why: preserve board space.
- Room settings/draws exclude RETIRED_TYPES; practice retains them via allTypesInCategory. Why: retirement must not remove practice access.
- Deleted games (removedGames.ts, 14 Oct 2026: 19 retired games and the Memory category) have no code; stored rounds of them show only the name and stored score (puzzleDef returns a read-only stand-in with the old clock), are never replayed or regraded (scoreStoredRound), and old rooms' totals and tie-breaks are unchanged. Why: room history must survive deleting a game.
- gameNames owns display names; PuzzleType keys all logic. Why: renames cannot change saved rounds, assets, inputs or IDs.
- Square puzzle arenas use container-sized squares and SVG viewBoxes with coordinate conversion for scaled input; why: boards must remain centred, square and correctly tappable at every arena size.
- AnswerReveal's StoredScore alone prints scores ("Scoring…" while pending); reveal-score-check guards it. Why: local maths drifted from server scoring.
- RoundIntro exposes Back only in practice; its practice callback cancels the intro and clears run state without grading. Why: leaving an intro must not create results or affect rooms.
- Non-engine demos use the real Stage, INTRO_EXAMPLE_SEED, sealed example id and recorded area-fraction actions/verdicts; why: real UI without exposed answers or divergent play.
- Changed inputs/layouts reject demos by shape or presentation revision; why: stale touches must not target new controls.

- FX/audio stay outside sims; dev displays require accepted keys; Pull clayRev owns birds while unstamped rounds stay clay-only. Why: safe feedback and legacy replay.
- Success renderers use bounded counter memory; Gemstone caches sprites/cells. Orbit art observes pure steps for pans/stars; its camera measures path arc coverage. Why: replay-identical rewards/framing without sim writes.
- run-checks records named pass/fail/timeout results: 300s, Snip 1800s, deep Orbit opt-in. Why: reproducible coverage and comparable reports.
- soundSettings owns device channel migration and normalized slider values; sound.ts owns bus gains and round-track ramp classification, while MuteToggle owns compact overlay controls. Why: all screens share settings without altering gameplay or clock ownership.

- PhoneShell shares paint; WordsmithRing owns the shared circular orbit board and wordInput owns taps; presentation revisions reject coordinate demos of obsolete boards. Wordsmith keeps centre index, size bands and original-band seeded examples. Why: demo compatibility.
- The last round leads to a server-timed, unskippable `winner_reveal` phase (WinnerReveal, shared-clock cues) before status finished, replacing final standings; why: every phone reveals the winner at the same moment.
- Only room/practice round-phase useRoundMusic starts/stops round music; intro/countdown/timer/game components never do. Why: GO mounts must not cut music.
- RoomChat owns portalled bounded compact/expanded message sheets and keyboard geometry; room state supplies only chat availability and header time, and gesture blockers exempt data-scrollable. Why: chat scroll stays independent of game/page layouts.

- Pipeline BFS is presentation-only; scenery and Grappler art are private renderers. Why: paint cannot alter grading.
- Grappler swingRev selects the rules (2/3 fixed dragons, 4 the chasing dragon, stalactites, lava jets and star anchors); courses come from the server-only proved bank by seed (swingRev 4: SWING_V4_BANK, every course proved to 500 m with all 10 stars), live proof only as fallback. Why: legacy replay, fast starts, a provable 150.

- Refresh icons/Bonk cache original footprint art for replay parity.
- letterShuffle keeps IDs; practiceBest is local; puzzleReject/useSolveFlourish/nearMiss paint existing verdicts/facts only, never grading/audio/phases.
- Every room plays at least 6 rounds (roomRoundCount): one per category with 6 or 7 selected, otherwise 6 spread as evenly as possible; the room seed picks the extras' categories, the order (categoryOrderFor; no category twice in a row where possible) and every game (pickRoundOrder, recent-avoidance weighted). Stored as round_order/round_count at start; the lobby reads roomRoundCount and every in-game display reads round_count. Why: one seed always deals the same room, and rooms in progress keep their dealt rounds.
- Ready (intro) and Continue (results, standings) wait only for connected active players (roomFlow) and never past the screen's timer; Continue marks live in duel_players.ready_round. A player alone in a game can Finish now (roomPhase.server finishGame), which ends outside the winner reveal (endedByForfeit); forfeitOutcome (the player who stayed wins) is the recorded result on the final screen and in the previous-games entry Play again writes (recordForfeitInHistory), and stored round scores never change. Why: no dead ends or idle waits; phase moves stay server-side and guarded.
