# CLAUDE.md — Duelz

Guide for Claude Code sessions. Read `docs/` first (master plan, game bank, scoring
reference, anti-cheat; **`docs/design-system.md` for every screen's look**: colour tokens, the gold
rule, the tile palette, fonts, radii, panels and rows, tap feedback, the logo, the wordmark and the
Joulz hero; follow it for any screen change), then the `AGENTS.md` files (root, `scripts/`, `src/lib/arcade/`,
`src/lib/duel/`, `src/puzzles/`). Those hold Lovable's per-area design rules and
override anything general here.

## What this is

Duelz: a multiplayer skill-game app. Up to 10 players (`MAX_PLAYERS`) join a room with a
short code and play the same timed rounds; 73 active games across Word, Number, Speed, Attention,
Pattern, Logic and Arcade (Word 9, Number 9, Speed 6, Attention 6, Pattern 10, Logic 11,
Arcade 22 with Pinball dealt in rooms; 10 retired to practice: Swerve, Steady, Dual, Ricochet,
Bastion, Rooftop Run, Junction, Dig, Hot Floor and, since 20 Oct 2026, Letterfall). Every category the lobby offers keeps at
least 6 active games (`category-pool-check`). On 14 Oct 2026, 19 retired games and the Memory
category were deleted; old rooms' rounds of them show only the name and stored score
(`src/lib/duel/removedGames.ts`, proved by `removed-games-check`). Built in Lovable, synced to this repo.
Lovable still hosts and publishes the app (https://brain-blitz-duel.lovable.app).

## Stack

- TanStack Start (React 19, TanStack Router file routes in `src/routes/`, server
  functions via `createServerFn` in `src/lib/duel/*.functions.ts`), Vite 8, Tailwind 4,
  Radix/shadcn UI (`src/components/ui/`).
- Lovable Cloud / Supabase for Postgres, realtime and RLS (`src/integrations/supabase/`,
  `supabase/migrations/`).
- Bun is the package manager and script runner (`bun.lock`, `bunfig.toml` with a 24 h
  minimum-release-age guard; don't add exclusions without asking Joe).

## Where things live

- `src/puzzles/<game>.tsx` — one module per puzzle type (UI + definition), registered in
  `src/lib/duel/registry.ts` (`RETIRED_TYPES` = practice-only).
- `src/lib/duel/` — room flow, generators (`*.server.ts`, server-only), banks
  (`*Bank.server.ts`, built by `scripts/*-bank.ts`), shared rules (`<game>.ts`, imported
  by both phone and server), grading (`grade.ts`), scoring (`scoring.ts`,
  `stagedRounds.ts`, `speedPar.ts`), display names (`gameNames.ts`), dictionary
  (`dictionary.server.ts`, server-only SCOWL British list; Letterfall alone ships an exact
  packed copy to the phone, `public/wordfall/words-<hash>.txt`, identical to the server's
  `arcade/wordfallWords.data.ts`; both rebuilt by `scripts/wordfall-dict.ts`).
- Tuning E taller worlds (High Rise skylineRev 4, Meteor snakeRev 5, Scrumper snipRev 5, Hover hoverRev 5): the world height rides in the state and stages, reveals and effects size from the stored revision (`<game>WorldHFor`, `revealWorldH`, `fxSpecAt`).
- Tuning F (14 Oct 2026): Breaker brkRev 5 (2.5 s Fireball), Rally rallyRev 5 (second bumper from 45 s), Tempo beatRev 5 (a tenth fewer notes), Meteor snakeRev 6 (more rocks), Orbit orbitRev 7 (swept black holes: every hole ahead, the rocket's whole body; `orbitRev3StartFor(rev)` picks a bank course's start); Hover's faint arena border lights (`level` on the shared border lights; barriers unchanged) are display only.
- **Meteor's border** (16 Oct 2026, display only; `drawBorder` in `src/lib/arcade/snake.renderer.ts`): the board's 1 px
  frame is drawn over the scanlines in whole device pixels (`retroScreen`'s `overlay`), and every 4 s gives a 0.6 s inner
  glow pulse and steps through #4BFF7A, #3DFFE0, #FF4FD8, #FFB43A (`meteorBorderLook`); colour and glow only, never size, the
  glow inside the board only, square corners, no sound. Reduced motion and reduced effects hold #4BFF7A with no pulse. No
  snakeRev change; the intro demo plays on (no touch target moved).
- Taller worlds batch 1 (16 Oct 2026, the Tuning E pattern): Breaker brkRev 6 and Rally rallyRev 6 (390×730 courts), Wavefront wavRev 6 (390×730, bolts 10 px a tick), Fission burstRev 4 (390×650, every bounce and ceiling height scaled by `burstGeometry`); knots refitted; arcade-tuning-g1-check (~2 s) replays 88 pre-change runs on every older revision and 32 on the new stamps; the four intro demos stay stopped until re-recorded on the tall revision.
- Taller worlds batch 2 (16 Oct 2026, the same pattern): Tempo beatRev 6, Slice sliceRev 6, Coral Pop bubbleRev 5 (390×730), Mixed Signals clashRev 5 (390×650, with a gentler unfinished credit) and Pull! clayRev 6 (360×680 sky); arcade-tuning-g2-check (~3 s) replays 116 pre-change runs on every older revision and 40 on the new stamps; the five intro demos stay stopped until re-recorded on the tall revision.
- Taller worlds batch 3 (16 Oct 2026, the same pattern): Grappler swingRev 9 (390×730 cavern, the lava 110 px lower, stars re-proved, rooms deal the 298 bank courses re-proved on it, `swingBankV9.server.ts`), Orbit orbitRev 8 (rev 7 play in a 390×650 view, the extra height ahead) and Ball Tracker btRev 4 (12 rows, 700×1300, its own proved bank `ballTrackBankTall.server.ts`); arcade-tuning-g3-check (~15 s) replays 72 pre-change runs on every older revision and 24 on the new stamps; the three intro demos stay stopped until re-recorded on the tall revision.
- **Arcade play screen** (15 Oct 2026, display only; `data-arcade-play` in `src/polish-layout/bottom.css`): the live
  round of the 22 arcade games and the five engine games on the arcade stage (Letterfall, Tenfall, Bonk, Pull!, Mixed
  Signals) has one 52 px header (a 44 px row, 4 px from the top or just under a notch) with the timer centred, score or
  PRACTICE left, "?" and sound right. In a room (16 Oct 2026) the round and game (`RoundLabel`) sit between the score and
  the timer, 8 px from each, in place of the round pips, stepping down "Round 2 of 6 · Gemstone" → "Round 2 of 6" over the
  name → "2/6 · Gemstone" → "2/6" over the name ellipsised (phones get the last; "Final round" on the last round). Every arena sits in `ArcadeArenaSlot` (the five engine games use the same box):
  edge to edge, down to 8 px above its controls or 16 px above the visible bottom, the world at the largest uniform
  scale that fits, top-anchored. The lowest control row ends exactly 16 px above the bottom, inset or not. Every gap is
  `--screen-edge` #070709; there are no per-game arena fills. Why: the largest undistorted world on every phone, the
  same world and inputs everywhere, no seams. `docs/arena-sizes-oct-2026.md` lists every box and world size.
  "The bottom" is the physical bottom of the screen: an iOS home-screen app is laid out short by the top inset (WebKit bug
  254868), so the play screen adds the measured shortfall (`--standalone-short`, PhoneShell) to its height, and so does the
  page's root (`html:has([data-arcade-play])`, body being 100 % of it): html and body are locked `overflow: hidden`, and at
  100 % of the short viewport they cut tall worlds and the lowest controls 48 px above the screen's bottom (fix-up, 15 Oct
  2026). Every clipping box ends at the screen's bottom; nothing clips above the 16 px strip. Tilt's world is
  centred in its box; Orbit's SET CHECKPOINT is 44 px tall and narrower. arcade-device-bottom-check (headless Chromium,
  in six parts since 17 Oct 2026, when a half with the Meteor passes ran past run-checks' 300 s on CI: its games' layout passes in thirds, `@1/6` and `@2/6` on `play1`/`play2` and `@3/6` on `play10`, and its three Meteor edge passes one each on `play7`–`play9` as `@4/6`–`@6/6`) reproduces the iPhone 11 and 14 home-screen app and Safari geometry (`scripts/device-emulation.ts`:
  the short layout viewport, the full screen, the insets, `navigator.standalone`, which the app keys on, and `display-mode:
  standalone` answered in-page since Chromium cannot emulate it) and fails if any clipping ancestor, html and body included,
  cuts the box, the world, a scene canvas or a control, and (16 Oct 2026, bottom-flash fix-up) fails unless the iPhone 11 home-screen
  pass holds still for 3 s after a dispatched resize: root, body and shell heights, `--standalone-short` and the scene canvas size
  unchanged, no root style rewrite, no scene redraw (PhoneShell measures the shortfall once per screen size, orientation and inset,
  with the growth taken off, so it can't feed back), and (16 Oct 2026, Meteor bottom-flash fix) plays Meteor for 5 s at DPR 2 on that setup with a scripted rock landing and shower, failing unless the arena's bottom device rows show exactly what its canvas painted every frame (Meteor's canvas is whole CSS pixels inside its box, never rounded past it, and its retro screen fills it edge to edge), and (16 Oct 2026, Meteor border fix) judges the canvas's bottom 48 device rows with the clock running: no row may change across the board's width between frames outside the border's own pulse or the success layer's edge effects (the flash that remained was the board's bottom border under the drifting scanlines, darkened 28 % one phase in three; the border is now drawn over them, `retroScreen`'s overlay), the border must step colour and glow, and with prefers-reduced-motion or reduced effects it must hold #4BFF7A with no pulse; arcade-play-check and bottom-clearance-check measure every arcade play screen as an
  iPhone 11 home-screen app once more the same way. Run them after any arcade play-screen layout change.
- **Arena scenes** (15 Oct 2026, display only; `src/lib/arcade/arenaScene.renderer.ts`): ten games (Gemstone, Tilt, Bonk,
  Tenfall, Flightpath, Swish, Pull!, Roofbound, Rainbow Bridge, Jaywalk; `ARENA_SCENE_GAMES`) paint their own scenery
  behind the world out to the arena box's edges on the play screen (ArcadeArenaSlot `scene`, one canvas painted per
  integer canvas size, never per frame, `pointer-events: none`, so a tap or drag in it records no input); the world, its place
  and its tap mapping are unchanged, and the gap is black elsewhere.
- **Screen fill-ins** (17 Oct 2026, display only; `src/lib/arcade/arenaFills.renderer.ts`): every active arcade game paints
  a light, soft backdrop round its world (darker than the play area, starting from the world edge's own colour) out to the
  screen's bottom (behind the controls, the 16 px strip and the home bar) and, where listed, its sides: ArcadeArenaSlot portals
  the scene canvas into `[data-arcade-play]` under the column (the header row stays black but for Gemstone's velvet). Seven
  games add a slow `ambient` layer (Pinball's and Rally's retro lamps, lit only by `arenaLight` from their sound observers;
  Tempo's notes, Meteor's stars, Jaywalk's walkers, Roofbound's lava, Fission's reactions), still under reduced motion or
  reduced effects. Pinball, Meteor, Scrumper, Gemstone and (item 28) Bonk are centred on the play screen only (`playCentre`). No frame round
  any world (the play area's accent ring is off on the play screen; real walls in Breaker, Rally, Fission and Gemstone's board
  are soft shades; Meteor keeps its border). Rally's HUD shows "GOLD n · PADS n" on rallyRev 3+. Pull!'s scene starts in its world's bottom grass
  and Bonk's meadow has soft tufts, faded flowers and small stones on a faint band of soil (static). arcade-fill-check
  (headless Chromium, ~10 s a game; the 22 active arcade games plus Pull! and Bonk, in thirds on `play11`–`play13`) fails
  on a black strip, a border line or seam at 414×896 (home-screen app) and 390×844, or a moving fill under reduced motion. Run it after changing a fill or a world's edge art.
- `src/lib/arcade/liveBands.ts` — each arcade band game's dealt stamp and curve; the "?" help's numbers (top, a good
  run) come from it, so a new stamp updates the help here (arcade-help-bands-check fails until it does).
- `src/lib/arcade/` — the deterministic engine (`engine.ts`) and one sim per arcade game
  (`<game>.ts`), with art in `*.renderer.ts` (never imported by the sim or server).
  Seeds and revision stamps come from `src/lib/duel/arcade.server.ts`.
- Strikeout, Cryptogrid and Swapword (`strikeout`, `codeword`, `swapword`): answers from
  `commonWords.server.ts` (SCOWL sizes ≤ 35, built by `scripts/common-words-build.ts`) through
  `answerWords()` in `dictionary.server.ts` (Strikeout `strikeoutRev 2`'s 8-letter answers from
  `strikeoutWords.server.ts`, `scripts/strikeout-words-build.ts`, same rules); boards from the room seed (`wordSeed.server.ts`;
  Cryptogrid from the 1,000-board bank `codewordBank.server.ts`, `scripts/codeword-bank.ts`).
  Live feedback comes from `checkMovesFn` / `practiceCheckMovesFn` (`moves.server.ts`): the phone
  sends its whole move list and gets back only the board view. Shared QWERTY keypad:
  `src/components/puzzles/LetterKeypad.tsx`.
- `src/lib/fx/signature.ts` — the shared signature beat (gold flash + app-logo burst on every
  solve/finish, fired only from the common points: the rooms/practice verdict and arcadeFeedback);
  `src/lib/fx/roomMoments.ts` — the room's big-moment effects (Prepare to Duel, round titles 1–6, Final
  Round, the winner reveal; display only, CSS `rfx-*`, cues `room.*`, `room-moments-check`);
  `src/lib/fx/soundCues.ts` and `docs/sound-cues/` — named sound cues (`duelz-sound` events,
  `<gameId>.<event>` / `shared.<event>`; `?dev=1` logs them). Every cue, arcade moment and music slot has
  an entry in `src/lib/fx/manifest.ts` (`url: null` until a file is set; `docs/sound-cues/README.md` says how);
  `docs/sound-cues/cue-sheet.md`/`.csv` (`bun scripts/sound-cue-sheet.ts`) lists them, `sound-manifest-check` proves it. Every arcade-stage visual effect has a cue
  (`docs/sound-cues/arcade-effects.md`: success effects through `momentFrame` in `src/lib/fx/momentCues.ts`, renderer
  effects in `gameSounds.ts`); audio files are one per recording in `public/sounds/`, several slots may share one.
- **Sound batches 2 and 3** (18 Oct 2026, presentation only): `docs/sound-cues/batch2-mapping.csv` and
  `batch3-mapping.csv` (must-haves wired; the 17 nice-to-have recordings are not made) point manifest slots at
  `public/sounds/`; slots may set play caps (`gapMs`, `voices`) and a `rate`, kept in `playSlotOr` / `playCueSlot`;
  named loops go through `loopCue()` (0.25–0.35, 500 ms fades, one per game); `puzzleReject()` announces
  `shared.reject` unless the move already plays `wrong`; five voice lines (`voice.*`, `playVoice`). sound-manifest-check
  proves every file is used and the caps hold.
- **Sound batch 4** (20 Oct 2026, presentation only; `docs/sound-cues/batch4-sound-polish.md`, `batch4-mapping.csv`):
  49 recordings wired (trimmed, levelled to the library's median loudness); `shared.roundResults` on the Round results
  screen for everyone but the top scorer (who hears `round_won`, never both), `slice.specialIn`, `matchup.jackpotBlast`
  (in place of `arc_rainbow`; the bomb is unchanged), no generic combo on Gemstone cascades, Roofbound's speed-up sounded
  on every third step only. Tempo's `music_beat` is tick-locked (`syncBeatTrack` in `src/lib/sound.ts`: starts at tick 120
  on its downbeat, re-synced past 40 ms, never in `roundMusicFor`), the synth beat its fallback until it decodes.
- **Scoring targets** (18 Oct 2026, `docs/scoring-targets.md`): about 100 average, 120 good, 135 great, 140–150 near-perfect.
  Every arcade band game's new revision keeps its play and lifts its curve through `BAND_TARGET_MAP` (`band: 2` states,
  `bandCurveOf`), Wavefront on its own gentler curve, Swish with a 21 px spinner; Nucleus, Forage and Bonk score on new
  curves; the help's good run is 120 points. scoring-targets-check (~5 s) proves it; older checks compare the dealt stamp
  through `playRevOf` (`scripts/scoring-targets-revs.ts`); `bun scripts/arcade-skill-bands.ts --rev=now` measures today's revisions.
- **Score bands** (19 Oct 2026, `docs/scoring-targets.md`, replacing the targets above, which proved lenient): perfect 150
  only, near perfect 130–149, great 110–129, good 90–109, decent 80–89, average 60–79, smoothly down to 0. Puzzles deal
  `puzzleScoreRev 2` (`puzzleScoreRev2.ts`: the rev-1 grade turned into a result, 0–99 unfinished progress, 100–200 a
  finish by time left and efficiency, then each game's knots in `puzzleBands.data.ts`, fitted by
  `bun scripts/puzzle-bands-fit.ts --write`; help text from `puzzleBandsText.ts`); arcade band games deal a new
  revision on `band: 3` (`bandCurveOf` → `bandStrict`, each game's strict curve in `strictBands.data.ts`, fitted by
  `scripts/arcade-bands-fit.ts` from `arcade-skill-bands.ts --json` runs); engine games map their totals in the sim
  (`tenRev` 2, `clashRev` 6, `whackRev` 2, `clayRev` 7, `wordfallRev` 3). The help's good run is 100 points.
  scoring-bands-check (~12 s) proves it on `scripts/fixtures/scoring-bands-runs.json.gz` (`bun scripts/scoring-bands-record.ts`).
  Checks written for the rev-1 shape pin new puzzles to it (`pinDealtPuzzleScoreRev(1)`, or `pinRev1Shape` for the
  fairness kits). The six stages that only locked in themselves (Gridlock, Tessellate, Exact, Double Take, Forage,
  Nucleus) now send drafts, so a reveal that arrives first never submits ""; Safe Cracker's rev-2 draft carries the
  dials left standing (`tries;dddd`, never a try).
- **Player colours, icons and podium awards** (17 Oct 2026, presentation and room data only, no version stamps):
  `src/lib/duel/playerLook.ts` (ten colours `PLAYER_COLOURS`, each ≥ 4.5:1 on the background and under the badge's
  near-black glyph, every pair ≥ 10 ΔE2000 apart with normal vision and simulated protan/deutan/tritan vision; sixteen
  icon ids; `resolvePlayerLooks`, the same on every phone and the server), `playerLook.server.ts` (the server picks a free
  colour on join, the device's remembered one when free, retrying on the unique `(duel_id, colour)` index; `setPlayerLookFn`
  changes colour/icon in the lobby only; `rematchFn` stores slot colours so Play again keeps them), `PlayerBadge` (initial
  or icon on the colour, beside the name in the lobby, round results, standings, both final screens and chat; never colour
  alone; the winner reveal shows no player). Icons are original line drawings (`src/components/duel/playerIcons.tsx`, no
  library) behind `PLAYER_ICONS_ENABLED` in `src/lib/brand.ts` (off: initials, no picker). Columns `duel_players.colour`
  / `.icon` come from `supabase/migrations/20261017120000_player_colour_icon.sql`, **written but not applied**: until it is,
  rows have no colour, phones show slot colours with initials and the lobby hides the picker, so publishing first is safe;
  RLS is unchanged (clients only read). Awards (`src/lib/duel/podiumAwards.ts`, `PodiumAwards`): Fastest Finger,
  Perfectionist, Comeback Kid (≥ 2 places), So Close, each only when earned, non-winners first, fixed tie-break (figure,
  fewer awards, final place, slot), from results every player can read; cue `room.award`, skipped with the animation under
  reduced motion or reduced effects. player-looks-check (~5 s) proves the palette, unique colours through joins (racing
  too), lobby changes, leaves and Play again with the real server code, the pre-migration fallback, no new client writes,
  the migration on a local PostgreSQL where installed (unique index, constraints, the real `restart_duel_room`, RLS), and
  awards identical for any row order and only when earned.
- **Practice bests, live "finished" pings and the arcade reveal chart** (17 Oct 2026, presentation and room data only, no
  version stamps): practice keeps each game's best on the device (`practiceBest.ts`; practice_plays stays server-only)
  under the game's version-stamp signature (`practiceStamps.ts`: every top-level `…Rev` / `…Version` / `speedPar` of the
  dealt puzzle), so a game dealt under new stamps starts a fresh best; the list's cards show "Best 132" from
  `PRACTICE_STAMPS` (`practiceStamps.data.ts`, built by `bun scripts/practice-stamps.ts`; **re-run it after any change to a
  stamp a generator deals**, practice-bests-check fails until then); the reveal's "New best!" (`NewBestMoment`, cue
  `shared.momentcard`) shows only when an earlier best was beaten, never on a first run, and is skipped with reduced
  motion or effects. In a room's live round, other players finishing show as a slim strip, "Ali and Jo finished ✓" with
  their badges (`finishedPings.ts`, `FinishedPings.tsx`), laid over the score strip (the arcade header's score and round
  label on arcade play screens), never the play area, timer or controls; silent; no score, answer or result, ever. It
  reads `duel_players.submitted_round`, written by `submitAnswerFn` after the result row is stored and cleared by
  `rematchFn` (`finishedPing.server.ts`); the column comes from `supabase/migrations/20261017140000_player_submitted_round.sql`,
  **written but not applied**: until it is, no pings show and nothing else changes. The room answer reveal for arcade
  games places every player on one "snake" line that bends round in three rows, 0–50, 51–100 (right to left) and
  101–150, labelled 0, 50, 100 and 150 at the ends and bends (`arcadeChart.ts`, `ArcadeScoreChart`; the only look):
  badges with names, **no points figure for anyone** (your own score is the reveal's big number; exact scores are for
  the results screen), stacked into lanes when they would touch, "You" ringed and labelled (never a colour). To place
  the markers, the reveal phase's arcade progress entries (sent only to players whose own answer is stored) carry each
  other player's stored score, never drawn; answers, lines and details stay closed until the results screen
  (reveal-window-check). Checks: practice-bests-check (~2 s), finished-pings-check (~2 s), arcade-chart-check (~1 s),
  room-extras-check (headless Chromium, ~3 min, its own shard `play14`: ping placement at 414×896 home-screen app and 390×844,
  the snake with 2/6/10 players, every marker's place and no numbers;
  `--shots=<dir>` saves screenshots).
- **Room and layout fixes** (18 Oct 2026; no version stamps, no game's scoring changed):
  - *Room scoring = practice scoring.* `submitAnswerFn` grades through `gradeRoomAnswer` (`src/lib/duel/roomGrade.server.ts`),
    the same `gradeAnswer` practice calls plus the server's receipt time. An answer received in the reveal phase arrived after
    the clock (0 ms left): it used to be measured from the reveal's own `phase_started_at`, which dropped every tap or action
    after ~1.5 s, so a time-out landing just after the buzzer scored 0 (Flash, Bang On, Ascend, Lightbender). The room page
    sends one answer per round (a stage's own submit and the time-out's draft never both go: an empty draft could beat Forage,
    Nucleus, Gridlock, Tessellate, Exact or Double Take's real answer), sends the round's draft if the room reached the reveal
    first, tags drafts with their round (a reload mid-round keeps the restored one), and "everyone answered" counts active
    players only (phone and both server functions). room-practice-grade-check (~15 s) grades 42,690 stored, tap-log, arcade and
    sample answers for all 74 active games as practice and as a room (puzzle phase 80 ms / 1.2 s late, reveal +0.1 s / +3 s).
  - *Arcade play screen height.* In an iOS home-screen app the play screen is `min(100dvh + inset, screen)` and html
    `min(100% + inset, screen)` (`--standalone-short` is now the top inset, `--standalone-screen` the screen's height, neither
    read from layout): a shortfall measured once per screen size used to stay on a layout viewport WebKit had since grown to the
    whole screen (after a room's keyboard, after a few runs), pushing the lowest controls 48 px down (Rainbow Bridge and Mixed
    Signals in rooms, Fission's arrows after repeat plays). arcade-room-practice-check (headless Chromium, ~2 min, in thirds since 25 Oct 2026 on `play15`, `play7` and `play8`)
    draws every arcade play screen in a room and in practice at 848, 896 and 848 again and fails unless room = practice box for
    box and everything ends 16 px above the bottom; fission-repeat-check (~2 min, `play15`) plays Fission four times in a row.
  - *Silent puzzle replays.* The results screen's (and podium's) time-lapse and moment cards play no sound effects: their own
    cues are gone and, while a time-lapse is up, cues named for a game (its Reveal board's) are not played (`quietForReplay`
    in `src/lib/sound.ts`; shared, room and UI cues, voices and direct sounds still play). replay-sound-check (~2 s).
  - *Lobby looks.* Your own row has a "Change ▾" chip; icons, like colours, are one per room (taken ones greyed out, refused by
    `changePlayerLook`, dropped on join, a racing join's duplicate cleared for the higher slot). No migration (no unique index:
    two taps in the same instant could share an icon, harmless).
- **Room screen fixes** (19 Oct 2026; display and room data only, no version stamps, no scoring or grading changed):
  - *Chat* (`src/lib/duel/chatNotice.ts`): placeholder "Chat…"; the chat button shows only other players' unread
    messages, in gold; between rounds a live message from another player shows a toast (their badge, name, first words;
    tap opens the messages) with `playBlip` and a light haptic, at the screen's bottom since 22 Oct 2026 (slides up,
    above the home bar and every control pinned there, `chatToastPlace.ts`; chat-notice-check's browser pass,
    `scripts/chat-toast-browser.ts`, proves it at 414×896 app, 375×667 and desktop); during a round (intro countdown to reveal) nothing but a
    small silent dot on the play header (`RoundChatDot`). chat-notice-check (~1 s, happy-dom).
  - *Finished pings* only for a finish before the buzzer (`src/lib/duel/buzzer.ts`: received in the puzzle phase with
    ≥ 1 s left on the round's own clock, an arcade run's length or the time limit); never a time-out draft, an answer at
    the buzzer, a late one or a run played to the end.
  - *Round leaderboard*: the time column is on the round's own clock and shows it whole ("90s") for anyone who reached the
    buzzer; Bang On shows no time (its stored figure is a distance, "avg N ms off"); arcade runs, Flash and Bang On are
    judged by score alone ("Scored" / "✗", `scoreOnlyVerdict`); summaries fixed to match the stored result (Ascend tap
    logs, Operator's tries suffix and limit, Nucleus/Forage curves, Counterweight's scales, Target rev 1's made distance,
    Hats rev 1, Lights Out, Pull!'s empty shots). round-time-check (~3 s) proves it for every active game.
  - *Awards* (`podiumAwards.ts`): Fastest Finger a full solve of 110+ using at most half the clock (120+ until 19 Oct, decision on #117); Perfectionist the most
    150s; Comeback Kid a climb of 2+ places onto the podium, rooms of 3+ only; So Close a genuinely small gap
    (`isGenuinelyClose` in nearMiss.ts); better figure first, then non-winners. player-looks-check.
  - *No blue boxes* (styles.css): no tap highlight, focus outline/ring or text selection on touch (inputs excepted);
    keyboard focus rings only with hover and a fine pointer. touch-highlight-check (headless Chromium, ~1 min, `play6`).
- **Room follow-ups to the score bands** (19 Oct 2026; room flow and display only, no scoring or band changes): a failed
  room send is retried while the round takes answers (`roomSend.ts`, room-send-check); the round's draft is kept in
  localStorage so a reload keeps it (`roomDraft.ts`, room-draft-check); arcade-clock rounds wait 5 s longer for a late
  stage's run before the time-out and phase close, phone and server (`roomClose.ts`, room-late-run-check); the shared clock
  is re-measured every round and on returning to the app (`clock.ts`, `useDuel`, clock-round-check). The leaderboard and
  reveals show the progress a puzzle's credit counts for Chroma Lines, Shikaku, Lamplighter, Tessellate, Jumbled, Swapword
  and Slider (`progressFigures.ts`, whose counts the graders call), and the curve games' costs as the total's
  (room-figures-check, which also regrades `scripts/fixtures/progress-figures-grades.json.gz`, 3,420 grades of those seven
  games on every score revision recorded on main before the move by `scripts/progress-figures-record.ts`, and fails on any
  difference). The server's close reason ("all_answered" / "timer") comes from `puzzleCloseReason` (beta-recording-check).
  All five new checks take under 10 s.
- **Scoring report batch 2** (20 Oct 2026, `docs/scoring-targets.md` "Scoring report batch 2"; open, speed and
  engine games, no arcade curve or bot changed): Nucleus `wordsmithRev 2` (one curve on word points,
  `WORDSMITH_V2_CURVE`, 140 at most without a word using every tile), Forage `wordHuntRev 2` (the phone sends rejected
  traces as `!cells` after the words; misses beyond 10 + 2 per word cost 3 % each; the traced word shows in the
  `AcceptedWordChip` row), Flash and Bang On `tapRev 4` (one curve each; Flash's decoy cut in `replayFlash` past half
  the decoys tapped), Tenfall `tenRev 3` (tenRev 1's raw score, overshoots beyond 4 cost 5), Pull! `clayRev 8`
  (quick-hit part, `clayQuickScore`), Mixed Signals `clashRev 7` (`CLASH_GREAT_MAP`: unfinished at most 110, a finish
  120+); Letterfall is practice only. The new open-game stamps score on their own curve: their rev-2 knots row is the
  identity (`REV2_IDENTITY_KNOTS` in `puzzleScoreRev2.ts`). `WORDSMITH_REV_TARGET` / `WORDHUNT_REV_TARGET` are the dealt
  stamps (2); the rev-1 curves are `WORDSMITH_REV_CURVE` / `WORDHUNT_REV_CURVE`. Help (`instructions.ts`) and intro
  (`introScore.ts`) texts state the new stamps; Nucleus' and Forage's found words (and Forage's misses) are stage state
  (`useStageState`), so a room reload keeps them. Known exceptions: Tenfall's average 97 (raw shape, to revisit with
  beta data); Forage's misses are reported by the phone (`docs/security-audit-oct-2026.md`). scoring-batch2-check (~10 s,
  `scripts/fixtures/scoring-batch2-runs.json.gz`, `--record` to re-record).
- **Puzzle helper, `puzzleScoreRev 3`** (20 Oct 2026, batch 1 of `docs/scoring-report-oct-2026.md`; results, misses
  and decisions in `docs/scoring-rev3-oct-2026.md`): every finish puzzle scores unfinished = min(110, 110 × progress ÷
  oneShort) and a correct finish = 120 + 30 × min(1, time-left share ÷ fastShare) × efficiency (`puzzleScoreRev3.ts`,
  per-game `fastShare` 0.40–0.75 and `oneShort`; mistakes only cut the 30); progress from `puzzleProgress.ts`
  (server-only: Slider's rows 30/70/90/110, Trail's path, Counterweight/Operator/Brimful credit inside the current
  step, Strikeout's fifth word, Interlock's words being built, Exact's distance, solver distance on Turntable,
  Gridlock, Jumbled, Blackout and Hanoi with best-reached tables cached per board, a push bound on Heave; the rest rev
  1's credit), stored as `extra.progressShare` (finishes: `time`, `efficiency`). Open games keep rev 2's curves. Help
  and intro numbers come from `puzzleBandsText.ts` (`DEALT_LIMIT_S`, "150 if you finish in about N s with no
  mistakes"). Checks proving rev 2 pin new deals to it (`pinDealtPuzzleScoreRev(2)`). scoring-rev3-check (~6 s) on
  `scripts/fixtures/scoring-rev3-runs.json.gz` (`bun scripts/scoring-rev3-record.ts`). `scripts/scoring-report.ts
  --combine=<dir> --rev3-doc=docs/scoring-rev3-oct-2026.md` rewrites the results tables. Same batch: Interlock's Done
  needs all 15 tiles (rev 3 grades a short grid as progress) and word tiles get Slider's gold border; Colour Flood
  `floodRev 3` deals a pool no colour cycling can finish (flood-cycle-check); Strikeout `strikeoutRev 4` (12 strikes),
  Cryptogrid `codewordRev 3` (a sixth starting letter), Swapword `swapwordRev 3` (minimum + 8), Lookout
  `wordSearchRev 2` (no theme-name words, `wordSearchBankRev2.server.ts`); a room round's stage state is saved with
  the draft (`stageState.ts` `persistStageState`, puzzles only), so a reload continues the board
  (stage-state-reload-check).
- **Sharing results** (21 Oct 2026, presentation and beta recording only, no version stamps): the room's final screen
  (Podium and FinalResult) has Share beside Play again (`RoomShareButton`, `th-btn-teal`, one line, 48 px). It goes through
  `shareResult()` (`src/lib/share/shareResult.ts`: title, lines, image, link; reusable for the daily challenge and friend
  challenges): the share sheet (`navigator.share`, the link inside the text, never also `url`; the PNG attached where
  `canShare({ files })`), else the text and link copied and "Copied". Text and link from `roomShare.ts` ("I came 2nd in a
  6-round {APP_NAME} room – 612 pts. Play: <link>"; always the room's link with `?ref=share`; where it leads is decided when
  it's opened, in `JoinFromLink` (`shareLinkJoinable`: the lobby, not disbanded, a seat free → the lobby's join; else a
  redirect to `/?ref=share&room=CODE` and the welcome card), so friends who open it after Play again join the next game and
  no newcomer lands on "This game has finished"). The card (`resultCard.ts`, 1080×1350, drawn when the screen opens so iOS can attach
  it to the tap): APP_NAME, place and total, the top three with medals, the round games' icons (`gameIconImages.tsx`: the
  arcade painters, puzzles' GameIcon SVGs rasterised) and the room code; built only from what the final screen shows, never
  an answer or puzzle. Beta counts (`shareRef.ts` → `recordShareEventFn`, fire-and-forget): `share_tap` (room, place,
  method), `arrival` (the first `?ref=share` visit per device, counted by the root route) and `arrival_finished` (that device's
  first final screen). A home arrival (never a room-lobby one: the lobby is the welcome) sees a one-time welcome card at the top
  of the Play tab on that visit only (`ShareWelcomeCard`, the only Play tab change; the first-time intro is skipped for it,
  as for a room link): "YOUR FRIEND PLAYED {APP_NAME}", TRY A PRACTICE GAME (Warm up's first game), NEXT PUBLIC GAME: {day
  time} (the Tournaments tab, only when one is scheduled) and a ✕, counted as `arrival_welcome` (`shown`, then `dismissed`,
  `practice` or `public`). Table `share_events` from `supabase/migrations/20261021120000_beta_share_events.sql`, **written but
  not applied** (until it is, the writes fail quietly; queries in `docs/beta-sql.md` section 7). share-check (~1 min, `play17`).
- **Desktop browsers** (17 Oct 2026, presentation and input only; `docs/desktop-support.md` has the control map for every
  game): `src/lib/desktop.ts` (`DESKTOP_QUERY`: a mouse or trackpad, hover and a fine pointer, in a window ≥ 1180×560; phones
  and tablets never match), `src/polish-layout/desktop.css` (pages a centred 480 px column; puzzle screens a centred ≤ 560×1000
  column; arcade play screens a centred ≤ 640×1120 column, the world on whole CSS pixels, 56 px header, 28 px timer, the fill
  over the whole screen), `useGameKeys` (keys on mouse/trackpad devices only, feeding the same handlers and queues as taps;
  `ArcadeCanvasStage`'s `keys` prop, ArrowPad, LetterKeypad and NumberEntry cover many games at once), `KeyCursor` (display-only
  board cursor), `DESKTOP_KEYS` (`src/lib/desktopKeys.ts`, the intro's key line on desktop). Flash, Bang On, Bonk, Tenfall and
  Tempo have no keys (decisions for Joe in the doc). desktop-geometry-check (headless Chromium, shard `play14`) proves 1366×768,
  1440×900, 1920×1080, 1280×720 and resizing; arcade-play-check's 1280×800 layout window is a touch-screen laptop.
- **App shell** (18 Oct 2026, presentation and device storage only, no version stamps): a bottom tab bar
  (`src/components/app/AppTabBar.tsx`: Play `/`, Practice `/practice`, Tournaments `/tournaments`, Profile `/profile`;
  gold = current; fixed above the home bar, `polish-layout/app-shell.css`) drawn by PhoneShell's `tabs` on those four
  screens only (Practice's list, never a round); rooms, rounds, results, podium and games are unchanged. Back: a tab opened
  from Play is pushed (`fromPlayTab`), tab to tab replaces, Play goes back. Play: Quick play (Create a room; join with a
  code), "Rejoin your last room" (`deviceHistory.ts` last room, shown only while the room is open and this device is in it),
  the next public game, Warm up (`practiceRecent.ts`, else Gridlock, Hover, Blackout; `?game=` opens the round). Practice:
  search, category chips, one row per game (icon, name, category, best; the button's name is exactly the game's).
  Tournaments (beta): the schedule Joe edits in `src/config/publicGames.ts` (UK times, `src/lib/publicSchedule.ts`), Next
  up (Add to calendar, an .ics, until lobby time, then Join now to the public room), Coming up, Your results. Profile:
  the look (the lobby's `LookPicker`, saved with `rememberLook` for new rooms), rooms played / wins / podiums and recent
  rooms from this device's own record (`useDeviceRoomRecord` in the room route: each finished game it shows, place and
  points as the final screen shows them; server history can't answer this because Play again deletes results),
  practice bests, settings (the gear: sound, direction controls, How it works). Game icons (`GameIcon`): every active game's
  own art on a tile in its colour, arcade ones painted by the game's renderer (`gameIcons/arcadeIcons.renderer.ts`),
  puzzles by their art components or their board element redrawn (`gameIcons/puzzleIcons.tsx`); no text.
  app-shell-check (~2 min, `play15`) proves the tabs, Back, icons, rooms without the tab bar and the card's switch at lobby time.
- **Page skin** (19 Oct 2026, presentation only; `src/polish-layout/theme.css`, `src/lib/theme.ts`): the four tab
  screens, lobby, round leaderboard, answer reveal, standings, results and podium, settings, dialogs and sheets carry
  `data-skin` (PhoneShell `skin`, tabs automatic); inside it the shared `--th-*` tokens replace the page tokens (background
  #07070A, text #F5F5F7 / #BDBDCC, gold #F2C75C, metallic gold and teal buttons `th-btn-gold` / `th-btn-teal`, cards
  `th-card` with `data-tint` gold / teal / me, category pills `th-pill`, chip dots `th-chip-dot` and icon tiles from `data-cat` in each category's own game colour (`--category-*`), medal discs
  `Medal`, scores `th-score`, names `th-name`). `data-skin-off` restores the original tokens for a game's own art inside a
  skinned screen (reveal boards, replays). Fonts are self-hosted in `public/fonts` (OFL), preloaded from the root route:
  Saira 600–800 (headings, buttons), Manrope 500–800 (body, names), JetBrains Mono 600–700 as "Duelz Mono" (scores, times,
  codes; the games' own JetBrains Mono is untouched). Game screens, round intros and room moments are not skinned. Game
  icon tiles are their category's glossy gradient; the art is unchanged. Round leaderboard rows keep time · verdict · summary
  on one line under the name (ellipsis; a tap opens the detail). theme-check (fonts, tokens, contrast ≥ 4.5:1,
  targets ≥ 44 px, `play16`) and no-wrap-check (single-line text never wraps or is cut off but names, at 414×896 app,
  375×667 and desktop; thirds on `play16`/`play17`) prove it; run both after changing a skinned screen.
- **Daily challenge and async rooms** (21 Oct 2026, the beta's daily; no game's rules, scoring or grading changed, no
  version stamps): an *async room* (`src/lib/duel/asyncRoom.ts` timings, `asyncRoom.server.ts` engine,
  `asyncRoom.functions.ts` calls, `src/components/async/AsyncRun.tsx` / `AsyncResults.tsx`) is a set of rounds dealt once
  on the server from a seed and stored (`async_rooms` + `async_room_secrets`), played by each player at their own time:
  a round starts when the player taps READY (no auto-start), the server stores that start (`async_results.started_at`) and
  only then sends the round's puzzle; every timing after it is the room's (`roomTimeoutMs`, `roomPuzzleCloseMs`, then a
  late answer with 0 ms left until the reveal's length, then missed = 0), and grading is `gradeRoomAnswer` on that start
  (so practice's). The phone keeps the room's one-answer sender, stored draft and stage state, so a reload continues the
  same round on the same clock. One attempt per device per room (unique index); answers, the private half and other
  players' scores never leave the server before the player's own result (the board only once they finish or the day
  closes). The dailies (`src/lib/duel/daily.ts`, `daily.server.ts`, `daily.functions.ts`): Daily Puzzle (one active game
  per puzzle category) and Daily Arcade (three active arcade games), dealt on the UK day's first start under
  `daily_<kind>:<YYYY-MM-DD>`, avoiding yesterday's games and banked boards; closes at UK midnight (no round starts after
  it; a round started before it finishes); boards ranked by the room tie-break, count shown from 20 players, names as set
  with offensive ones refused (`boardName.server.ts`), start rate-limited (`DAILY_START_LIMIT`). Screens: the Play tab's
  Daily challenge card (`DailyCard`, hidden until the status call finds the tables), `/daily` (tabs Puzzle / Arcade,
  Today / Yesterday, `DailyBoard`), Profile's Daily row (`dailyRecord.ts`: streak and bests, device only). Beta events in
  `async_events` (`recordAsyncEvent`; docs/beta-sql.md section 8, Q8a–c). Migration
  `supabase/migrations/20261021130000_async_rooms_daily.sql` is **written but not applied**: until it is, the card is
  hidden and nothing else changes. RLS: no client writes at all; clients read only the leaderboard columns of attempts
  on an open board (plus their own row) and the rooms' window columns. daily-check (~15 s; the SQL on a local PostgreSQL
  when installed) proves it; the daily screens are in theme-check and no-wrap-check (`scripts/theme-screens.ts`,
  `scripts/daily-fixture.ts`); `bun scripts/shots/daily-shots.ts` draws the review screenshots
  (`screenshots/daily-oct-2026/`). A friend challenge can reuse the engine as is (kind `challenge`). The deal
  (`dailyRoundOrder`) is the one place the daily reads categories (category-pool-check allows it there only); the stored
  daily keeps its types and puzzles, so a later category move or retirement never changes it (daily-check).
- **Friend challenges** (22 Oct 2026, on the daily's async rooms; no game's rules, scoring or grading changed, no
  version stamps): a challenge is an async room of kind `challenge` (`room_key` `challenge:<CODE>`, 6 characters from
  `CHALLENGE_CODE_ALPHABET`) plus a row in `challenges` (`src/lib/duel/challenge.ts` rules, `challenge.server.ts`,
  `challenge.functions.ts`, `challengeApi.ts`, route `/challenge?code=`). Made from the Play tab's "Challenge a friend"
  card (`ChallengeCard`; categories as the lobby, arcade allowed, 3 / the lobby's 6 or 7 / 10 rounds, never more than
  the categories hold games, `challengeRoundOrder`), the creator plays it alone first and gets the link at the end;
  or from any finished room's podium or two-player final screen (`RoomChallengeButton`: first tap makes or finds the
  game's challenge, second tap shares): the room's own stored puzzles and every player's stored results copied as
  finished attempts (never regraded; one challenge per room game; a round's start is set from its stored time left,
  since rooms keep no per-round start). Friends play the stored rounds through the async-room calls (graded as rooms
  and practice), with `rivals` on `AsyncRun` (`src/components/async/rivals.tsx`): the earlier players (attempts
  finished when this one started, a fixed set) ping "finished ✓" when the friend's own clock passes their stored
  receipt time (`challengePingsFn`, polled each second, slots only; the room's buzzer rule measured at receipt),
  then the reveal (arcade chart), the round leaderboard and standings from `challengeRoundBoardFn` once the friend's
  own result is stored (that round and earlier only; others' rows through `rivalRow`: no answer, `extra` numbers and
  booleans only), and the room's Podium with awards (`actions`: Share, Challenge someone else, New challenge, Done).
  Up to 20 players (server and a database trigger), the link lasts 7 days, one attempt per device; making one is
  rate limited (`CHALLENGE_CREATE_LIMIT` and 10 an hour counted from `challenges`). Profile's "Your challenges"
  (`YourChallenges`: device-remembered codes, `challengeRecord.ts`, plus the server's) shows "Sam beat you 612–580".
  The daily's results and today's board have Share ("I scored 612 on today's Daily Puzzle – can you beat it? <link>",
  `dailyShare.ts`, `shareResult` with `linkPrefix: ""`). Beta: `challenge_events` (created, link_opened,
  friend_finished, followup_room / followup_daily from the device), queries in `docs/beta-sql.md` section 9.
  Migration `supabase/migrations/20261022120000_friend_challenges.sql` is **written but not applied** (after
  20261021130000): until it is, the card, the podium button and Your challenges stay hidden. challenge-check (~12 s;
  the SQL on a local PostgreSQL when installed); the screens are in theme-check and no-wrap-check;
  `bun scripts/shots/challenge-shots.ts` draws the review screenshots (`screenshots/challenge-oct-2026/`).
- **Play tab without jumps** (22 Oct 2026, presentation and device storage only): the late cards (share welcome,
  Rejoin, Daily challenge, Challenge a friend) are `PlaySlot`s, always in the markup; `PLAY_CARDS_BOOT`
  (`src/lib/playCards.ts`, an inline script in the root's `<head>`) marks `<html data-play-cards>` from device storage
  before the first paint and CSS (`polish-layout/app-shell.css`) hides the slots not reserved; a reserved card draws
  its last known status (`duelz-play-cards:v1`) and updates in place; a "no" from the server collapses it smoothly and
  is remembered; an unreserved card never pops in (it is reserved next visit). The Quick play name row's height is
  reserved the same way; the public-games schedule is read in the first render. play-tab-shift-check (headless
  Chromium, `play13`) proves positions within 2 px from the first frame at 414×896 with a slow server.
- **Share sources** (22 Oct 2026): `share_events.source` (`room` / `daily` / `challenge`, existing rows `room`; added
  in `20261022120000_friend_challenges.sql`) on every Share tap and on arrivals from `?ref=daily` / `?ref=challenge`
  links (`noteLinkArrival`; still one arrival per device), with `daily_kind` / `challenge_code`; queries Q-S4/Q-S5 in
  `docs/beta-sql.md` section 7.
- **Beta extras** (22 Oct 2026, presentation, device storage and beta recording only; no scoring, game or stamp
  changes): the app's public name is **Joulz** (`APP_NAME`, `src/lib/brand.ts`, and the manifest; storage keys, tables,
  the build id and "Duelz Mono" keep the old name). Values Joe supplies later live in `src/config/betaConfig.ts`
  (`SENTRY_DSN`, `TALLY_URL`, `CONTACT_EMAIL`, empty until then; read through `betaValue`, which checks can stand in
  through `window.__DUELZ_BETA_CONFIG__`); an empty value switches its feature off with nothing shown or loaded.
  *Crash reporting* (`src/lib/crashReporting.ts`): a first-party client for Sentry's envelope API (no package, so
  bun.lock is untouched), started by the root only when `SENTRY_DSN` is set; uncaught errors, unhandled rejections and
  boundary-caught errors with device type, screen, viewport, display, route pattern, game id and round
  (`useCrashContext` in the room, practice and async runs), the commit as release, no user, names, chat, answers or
  breadcrumbs, no performance data; it only observes, so a round always carries on; `/dev-crash` (development only) raises
  each kind. *Beta terms* (`/terms`, `TermsScreen`, `lib/beta/terms.ts`): shown once before a device's first room (the
  room link's join, Create and Join), daily or challenge (`TermsGate`; never inside a room the device is already in: its
  lobby, rounds, reveals and results show without them, and its next entry point asks), I AGREE stored as `duelz-terms:v1` with its date and
  sent once to `terms_events` (`supabase/migrations/20261023120000_beta_terms_events.sql`, **written but not applied**);
  Profile → settings → Beta terms. The screen harnesses seed an agreement unless `?terms=0`. *Add to Home Screen hint*
  (`HomeScreenHint`): the Play tab's `homescreen` PlaySlot, reserved by the boot script on iPhone Safari outside a
  home-screen app until shown once (`duelz-home-hint:v1`). *Send feedback* (`FeedbackLink`, `lib/beta/feedback.ts`):
  Profile, under the podium and two-player final screen, under the daily results; `TALLY_URL` with `device` (the anonymous
  sign-in id) and `version`. *Public games*: the persistent room **JULZ** (`PUBLIC_ROOM_CODE`; JOULZ isn't a valid code),
  Tue 27 and Thu 29 Oct 2026 at 20:00 UK; new rooms never get it (`RESERVED_ROOM_CODES`); made by hand once
  (`docs/beta-sql.md` section 11). The boot script also reserves the next configured public game's card on a fresh device
  (`PUBLIC_CARD_STARTS`), and the server-rendered page draws a time-free stand-in card in that space (the real one
  needs the phone's clock), so it never pops in or jumps. beta-extras-check (~2 min, `play11`) proves it all.
- **Tab screens redesign** (23 Oct 2026, Prompt R, look only; `src/polish-layout/app-pages.css`): the four tab pages
  (PhoneShell marks their column `data-app-page`), the app header (`AppHeader`: `AppWordmark`, APP_NAME
  uppercased with its last letter gold, plus `LogoMark`, `src/components/brand/`) and the tab bar take flat panels of divided rows, the gold
  shine buttons and Archivo (self-hosted, OFL, `public/fonts`); rooms, rounds, results, daily/challenge play, sheets and
  game tiles keep the page skin. The share welcome card keeps the skin's type (share-check). App icons (apple-touch 180,
  manifest 192/512/maskable, favicons 32/16) are the inverted mark on the gold shine from `APP_ICONS` in `brand.ts`, drawn
  by `bun scripts/brand-icons.ts`; the in-game logo (`APP_LOGO_URL`) is unchanged. Review shots:
  `bun scripts/shots/app-pages-shots.ts` (`screenshots/app-redesign-oct-2026/`). Connected to the beta extras (#128):
  Play's Next public game card is one layout (`PublicGameNext`: the teal date tile and three lines, then Join now and
  Add to calendar side by side; reserved 186 px, `PUBLIC_CARD_H`, titled or not, with a same-size stand-in), the Add to Home
  Screen hint a plain panel, and Profile's Send feedback the link on the right of the footer line (`FeedbackLink`);
  play-tab-shift-check covers a cached height and the hint. Gold means "tap to play" (Create a room, the Daily Play and
  Continue pills, Join now, the current tab, the logo and wordmark Z; the selected Practice chip is a light fill since 26 Oct); links, secondary buttons,
  scores and the Beta pill are neutral, icon squares take the category palette (`data-tone`), a played daily shows a grey
  Done pill and "6 rounds · 742", and every `.press` control on the pages sinks to 98 % and lightens while pressed.
  Practice is shelves: with All and no search, one horizontally scrolling row of 104 px square tiles per category
  (`.ap-shelf`, `data-practice-shelf`, "See all" selects the chip); with a category or a search, a grid of three
  (`data-practice-grid`); Retired stays collapsed. Each tile is one button named exactly its game, its best its
  description.
- **The Joulz hero** (23 Oct 2026, display only; `src/lib/arcade/hero.renderer.ts`): Grappler, Jaywalk and Roofbound draw
  the hero (gold cape, gold-outlined black limbs, chest bolt, gold gloves and boots, masked head) on their old stick
  figures' joints (`drawHero`, Jaywalk `drawWalkerHero`, Roofbound `drawRunnerHero`); their game icons (Practice, Play,
  Profile, the share and challenge cards) draw it too, as vectors at the icon's real pixel size, each paint on a fresh
  pose (`detailScale` judges the eye slits and bolt by the icon's real px). The old stick figures are gone.
- **Intro demos, puzzle replays and the arcade reveal line** (23 Oct 2026, Prompt D; display only, no version stamps;
  `docs/demo-replay-audit.md` audits all 73 games): every intro has one layout, GOAL, HOW, a demo box (`IntroStage`) and
  SCORE, the box sized by the text alone; the game's still (its `IntroExample`) fills it until a saved demo draws its first
  frame, and stays for a game without one; the intro fades in without moving. Puzzle time-lapses showed an empty card (their
  fitting box had no width, so every board scaled to 0): fixed, the board laid out as on the answer reveal, Lightbender's
  action-log rounds at their recorded rhythm, Lookout and Roundabout added, at most about 8 s, ending on the stored score;
  every other puzzle shows the winner's real final board with "Replay not available for this game yet". The arcade reveal's
  snake gives each player a 6 px line in their colour (this player's 8 px, on top), fills the spare height and draws all
  text #F3F1EC at 13 px semibold on a dark backing, never overlapping (still no points figure for anyone).
  demo-intro-check (`play18`/`play19`, thirds) proves zero shift from the first frame to the demo playing for every game,
  with and without a demo; replay-board-check (`play19`) plays 46 stored puzzle answers on the room's results screen.
- **Celebrations** (23 Oct 2026, Prompt P; display, sound and animation only, no version stamps): one switch,
  `FX_CELEBRATIONS` in `src/config/betaConfig.ts` (false: every screen exactly as before, proved against
  `scripts/fixtures/celebrations-off.json`, recorded on main), and `HERO_RUN_SCORE` (150). The kit
  (`src/lib/fx/celebrations.ts`): gold spark bursts, the banner pill, the hero's victory pose and run
  (`heroVictoryPose` / `heroRunPose` in `hero.renderer.ts`), the GO strike, all drawn by one fixed full-screen
  layer mounted by the root (`CelebrationLayer`, one canvas, pointer-events none, 120 pooled sparks, its frame loop
  stopped when idle; `celebrationCanvas.ts`); recorded sounds since Prompt S (24 Oct 2026: Joe's
  `public/sounds/sfx_*.mp3`, slots `shared.celebrate.*`, `celebrationSound` / `CELEBRATION_SOUND_SLOTS`; table in
  `docs/sound-cues/shared.md` "Celebrations"; effects channel, preloaded on unlock, skipped if not decoded, silent with
  the switch off). Moments: the podium hero beside the winner's step with a burst and the victory sting on every phone
  ("You win!" and the spark chime on the winner's); the hero run on a reveal of 150+
  (once per round; rooms, practice, daily; not on reopened daily reveals); practice's new best (banner, burst,
  chime); daily streaks of 3, 7 and 30 on the results (today's first daily only); standings, podium and two-player
  final totals counting up from the round before over 1.2 s with a FLIP slide and climbs sparking (tap to skip;
  `useFlipRows`, `AnimatedScore` `skip`); the app header logo charging in once per app open (SMIL, `LogoMark`
  `charge`, memory only; then #133's mark exactly); the zap on Create a room and GO; the lobby's charge meter (`ChargeMeter`, directly under the "{n} of 10 players" line, no label of its own, 20 px reserved); one
  lightning strike on GO (`RoundIntro`; never on Prepare to Duel). Reduced motion: no sparks, runs, strikes or
  count-ups, banners and the podium hero fade in still, sounds kept. Each screen's effects end when it unmounts
  (`useCelebrationScope`). celebrations-check (~2 min with its browser pass, `play13`; `--shots=<dir>`);
  `bun scripts/celebrations-perf.ts` measures the moments at 4× CPU slowdown. Screenshots:
  `screenshots/celebrations-oct-2026/`.
- **Quick wins before the beta** (23 Oct 2026, Prompt Q; display, docs and checks only, no stamps): Prepare to Duel
  (`DuelStart`) shows the gold `LogoMark` (cropped to its bolt, `viewBox` "6 0.5 16 33") where the old bolt grew, with the
  same zoom; thin branching gold-and-white lightning strikes behind it (`PrepareLightning.tsx`, `src/lib/fx/prepareLightning.ts`:
  ≥ 550 ms apart, so ≤ 2 a second, each gone in 260 ms, a dim gold brightening, none within 700 ms of the gold flash, a
  canvas clear of the home-bar strip, bolts built once per size); reduced motion or reduced effects: no strikes and the
  logo's static glow (prepare-lightning-check). Orbit, Breaker, Gemstone, Meteor and Tempo's icons paint their sprite's
  art at the icon's real size (`paintRocket`, `paintBrick`, `paintMatchupGem`, `paintStamp`, `paintNote`, the same
  painters behind the games' cached sprites, so in-game art is unchanged). Link previews: Open Graph and Twitter
  large-card tags in the root route's head from `LINK_PREVIEW` (`src/lib/brand.ts`, absolute on `SITE_URL`; there is no
  index.html, TanStack Start renders the head), image `public/og-image.png` from `bun scripts/og-image.ts`
  (link-preview-check). app-shell-check waits out a cold dev server's reload before setup and repeats only the setup once
  on "Execution context was destroyed". `docs/design-system.md` (the look rules) and `docs/stale-code-report.md` (a
  report; nothing deleted).
- **Polish 1: game feedback, fonts and readability** (24 Oct 2026; display and sound only, no stamps; from the game
  look audit): arcade banners and pops on every world but Retro and Space draw in Archivo 800
  (`ARCADE_FX_DISPLAY_FONT`; "Fredoka"/"Nunito" were never loaded; the layer asks `document.fonts` for it once). The shared
  arcade layer has a miss moment (`misses` on each spec in `arcadeFxGames.renderer.ts`, read from the counters the sound
  observers use): a 200 ms faint red edge pulse (`ARCADE_FX_MISS_*`, edge only) and, where a point is given, a small puff
  (a pixel crack on Retro screens, painted once on its own cached canvas and blitted, so a game's own frame gets no
  extra pixel rects: snake-renderer-check counts them on Meteor's death frame); every active arcade game declares one; Gemstone's sliding gems are drawn inside the
  layer so the puff shows over them. Puzzles: Bang On's "Missed" plays `wrong`; Ascend's wrong tap gets the shared
  shake and red outline on the disc, a right tap a quiet `tick`; Interlock and Slider play `fx.onCorrect` for a word the
  player made (not words already on the board at mount). Readability (`polish-layout/readability.css`): puzzle HUD lines
  13 px / 600 on their 16 px line; Lookout letters 60 % of a cell (16–28 px); Bomb Defusal rules 14 px on 1.5;
  Cryptogrid keys 19 px, Clear/Next 16 px. arcade-fx-check proves the miss layer; `bun scripts/shots/miss-shots.ts
  --url=<origin>` draws the review frames (`screenshots/polish1-oct-2026/`).
- **Polish 2: the game frame** (24 Oct 2026; display only, no stamps; `docs/design-system.md` "Game screens"): every
  game's live round (PhoneShell `play`) draws GameLayout's one 60 px header (`polish-layout/game-frame.css`,
  `GameFrame.tsx`) instead of the app's top bar and the old arcade row: the name and "{Category} · Practice / Round n
  of N / Daily" left, the 48 px timer ring centred (TimerBar), the score block (`FrameScore`: room total with place or
  opponent, daily total, practice "Best"), "?" and one sound button (MuteToggle `variant="frame"`) right; the arena
  starts directly under it (no 4 px gaps). Puzzles (`data-puzzle-play`) add the goal line (`GoalLine`, `frameGoal`;
  StageProgress games publish "Stage n of N" through `useGoalProgress`), the category gradient background, main's
  board layout exactly (never smaller; `BOARD_FILL` lifts the arena cap for Tally and Don't Break the Chain), the tray
  as its own layer hugging the board (`useBoardTray`, `boardBox` in `src/lib/boardBox.ts`) and a 52 px dock. The
  board-size check: `bun scripts/shots/frame-probe.ts --compare=scripts/fixtures/board-sizes-main.json` (every board at
  least main's size at 414×896 and 375×667, the tray within 24 px above and below).
  Toolkit for the category batches: `.gf-glass`, `.gf-well`, `.gf-glow`, `.gf-alert`, `gameToolkit.ts`,
  `ArcadeAtmosphere`. Tools: `bun scripts/shots/before-after.ts` (main beside the branch, `screenshots/before-after/`)
  and `bun scripts/shots/frame-probe.ts` (cut text, tray overflow, dock heights at 414×896 and 375×667).
- **Polish batch R: room and other screens** (25 Oct 2026; presentation only, no stamps;
  `docs/polish-batches/room-screens.md`, `src/polish-layout/room-screens.css`, design-system.md "Room and other
  screens"): every non-tab skinned screen (lobby, link join, round results, standings, podium and final, the
  answer reveal's chrome, daily and challenge screens, terms, settings, chat sheet, dialogs, first-time intro)
  takes the tab pages' look, gold only on the action that plays; one room footer row (`RoomFooter`: chat
  button and the main action; Disband / Leave in the header's "⋯" `RoomMenu`); intros draw the game frame's
  header (`bare` PhoneShell); ties shown with `tieDisplay.ts` (tie-display-check); one error layout
  (`ErrorState`) for the 404, room not found and challenge not found; `Wordmark.tsx` retired for
  `AppWordmark`. celebrations-off.json was re-recorded on the branch (switch set off).
- **Tab pages refresh** (26 Oct 2026; presentation and device storage only, no stamps; `docs/design-system.md`
  "Tab pages refresh", the design canvas's T-* boards): Play's first visit shows the first-time intro as a
  card (`IntroCard`, Play slot "intro", reserved by `PLAY_CARDS_BOOT` from the onboarding flag; its How it
  works opens the three panels; onboarding-check), the Next public game card says "Lobby opens in 1 h 25
  min" over a quiet "Opens 7:45 pm" until lobby time (`PUBLIC_CARD_H` 220), Today's dailies show Done with
  the score, Challenge a friend joins their panel, new icon tiles (`TabIcons.tsx`); Practice's chips are a
  4 × 2 grid, Recently played, category lists with a BEST column; Tournaments' results are titled from
  `publicGames.ts` with place discs, an empty state with the Discord button (`DISCORD_URL` in
  `betaConfig.ts`, hidden while empty); Profile's badge is the player's colour, and a new player sees Get
  started instead of zeros. Shots: `bun scripts/shots/tab-refresh-shots.ts` (`screenshots/tab-refresh-oct-2026/`).
- **Puzzle top-up** (26 Oct 2026, `docs/depth/topup-oct-2026.md`; puzzles only, no arcade game): 22 puzzles raised to 200
  whose near-perfect play sat under the bar retuned on new stamps (Flash and Bang On `tapRev` 6, `chainDepthRev` 2,
  `clashRev` 9, `scanRev` 3, `countRev` 4, `wordsmithRev` 4, `tileGridRev` 2, `wordSlideRev` 2, `wordHuntRev` 4,
  `strikeoutRev` 6, `swapwordRev` 5, `wheelRev` 3, `depthRev` 2 for Safe Cracker, Box Six, Colour Flood and Shikaku,
  stamp 2 for Tessellate, Pipeline, Lightbender, Turntable and Heave); the same boards and play, partial credit so trying
  play never scores 0. `pinPreTopup` (`src/lib/duel/depthTopup.ts`) deals the stamps before it for the batch checks;
  `bun scripts/depth-topup-bands.ts` measures every game on tuning and fresh seeds; depth-topup-check (~95 s, halves on
  shards a and b) proves legacy grades, deals and the bar. Lookout is left unchanged (its bonus word is found in under
  half of near-perfect runs).
- **Per-game round maximum** (25 Oct 2026, the 200-point foundation; `docs/scoring-200.md`; no game's scoring changed):
  `src/lib/duel/roundMax.ts` (`ROUND_MAX`, 150 for every game today; `SCORE_CEILING` 200; `roundMaxFor`) is what the
  perfect moment and `shared.perfect`, the signature beat's no-finish threshold, the arcade reveal chart's axis, the intro
  and "?" help texts (`{max}`), Perfectionist / So Close / Fastest Finger, the round result's bars and the onboarding read.
  An expansion raises its own line to 200 plus its stamped scoring. Practice bests moved to `duelz-practice-best:v3:` and room
  arcade bests (`arcadeBest.ts`) to `duelz-arcade-room-best:v2:` (fresh once; old records kept, never read). round-max-check (~1 s) proves it.
- **Skill bands with an elite level** (26 Oct 2026, measurement only; `docs/arcade-bands-elite.md`): the arcade
  skill-band tool has seven levels (`ALL_LEVELS`: weak, average, good, great, near, elite = a top-1 % human, perfect =
  no error, used only for each seed's ceiling), paired seeds (`--from=10000` for fresh ones) and the report
  `scripts/arcade-bands-elite.ts`. The bots' Oct 2026 competence fixes are gated on `BotCtx.fixes` (set only by the
  band tool; `--bots=v1` and every check play the old bots). Parked branches' copies are patches in
  `scripts/arcade-skill-bands/parked/`.
- **The x200 expansions under the arcade rule** (26 Oct 2026; `docs/expansions/x200-*.md`): Wavefront `wavRev 10`,
  Tilt `tiltRev 8`, Jaywalk `crossRev 9`, Rainbow Bridge `inkRev 10` and Orbit `orbitRev 12` score to 200 (the parked
  E1/E7/E8 work, finished; their parked stamps 9/7/8/9/11 were never dealt and have no code path). The rule: every run
  deals the same count of scoring items and feature chances (the seed picks only where and when), an oracle player plays
  every tuning (0–59) and fresh (10000–10199) seed to 200 through the server replay (each game's own check), features
  pay on a rising scale (full value only at elite play) and nothing spawns from how a player plays
  (arcade-room-identity-check replays idle, random, weak and elite logs over `scripts/room-identity/<type>.ts`). Tilt
  deals from an oracle-proved bank (`tiltBank.server.ts`). Checks: wavefront-expand-check, tilt-expand-check,
  cross-x200-check, ink-x200-check, orbit-expand-check. **The five intro demos need re-recording** on the new stamps.
- `src/components/duel/` — room/round screens (PhoneShell, RoundIntro, TimerBar,
  AnswerReveal, ArcadeReveal, WinnerReveal…); `src/components/puzzles/` — shared puzzle
  widgets; `src/lib/fx/` — sound and visual feedback (presentation only).

## Checks

- **GitHub Actions runs the full suite** (`.github/workflows/checks.yml`) on every pull
  request open/push/reopen, split into twenty-two parallel jobs (`.github/ci/shards.ts`: `a`–`g`,
  `play1`–`play5` for arcade-play-check, `play6`–`play13` for bottom-clearance-check, one eighth each
  since its 15 Oct seam pass, `play14` for room-extras-check and `play15` for arcade-room-practice-check and fission-repeat-check), each about 6 minutes or less (balanced 15 Oct 2026 from run 38608375501's per-check times). Each job's summary lists every check by name
  with pass / fail / timeout. PRs that change only `docs/**`, `screenshots/**`, `*.md` or
  `.lovable/**` skip it. Free plan, 2,000 minutes a month, so:
  - **Quick and full depth.** PR runs (and local runs) use quick depth for the two slow
    checks: snip-check searches every template but the full cut-time grid only for the
    one-pin and hardest templates (~90 s on CI instead of ~8 min), and puzzle-bank-check
    rebuilds 2 sampled entries per bank instead of 8 (it still verifies every entry and
    checks the SHA-256 and duplicates). **Full depth is one click:** Actions → Checks →
    Run workflow (on the branch) with "full" ticked (the default), or locally
    `bun scripts/snip-check.ts --full`, `bun scripts/run-checks.ts --full <filter>`
    (`CHECKS_FULL=1`). Use full depth after changing Snip's sim or templates, or a
    banked generator or verifier.
  - Split checks: an entry `<file>@<k>/<n>` in `shards.ts` runs part k of n
    (`--part=k/n`). puzzle-bank-check's every-entry verification is split over four of `a`–`g`
    (one part each, under 90 s on a 2-core runner); arcade-play-check's 22 active arcade games (and Letterfall) over
    `play1`–`play5`; arcade-self-replay-check's entries over two (`@1/2`, `@2/2`, each entry on its own
    PRNG stream, so a part runs the same seeds as a whole run). Together the parts check exactly what one whole run does.
  - While working, run only the checks for what you changed (`bun scripts/<name>-check.ts`,
    or `bun scripts/run-checks.ts <filter>`). **Don't run the full suite locally.**
  - When done, open or update the PR and let Actions run the suite. Don't watch the run
    unless asked.
  - Push fixes in as few commits as possible: every push triggers a full run (a newer
    push cancels the one in progress).
  - arcade-play-check (headless Chromium) runs in the `play1`–`play5` jobs, which install
    Playwright's Chromium. Each job plays its games one at a time, as a whole run and the
    baseline recording do, so the per-game frame-time comparison is unchanged. CI never
    compares frame times with the local fixture: it uses
    `.github/ci/arcade-play-baseline.json`, recorded on a CI runner (Actions → Checks →
    Run workflow with "record arcade baseline", one job playing every game; then commit
    the artifact's file there). Without that file it applies only the absolute
    under-30-fps ceiling. Re-record after a change that should alter frame times on
    purpose. Never loosen the limits to get green.
  - Browser checks that load a page first (arcade-play, bottom-clearance, replay-play,
    beat-hold-browser, safe-area-screens) warm the cold dev server once, unmeasured, before
    anything is judged, and retry a page load that timed out once (`scripts/browser-load.ts`;
    safe-area-screens-check keeps its own copy from #64). Every wait after the load and every
    limit stands.
  - A new `scripts/*-check.ts` runs automatically (in the catch-all shard); add it to a
    shard in `.github/ci/shards.ts` if it is slow.
- Run all (Actions does this; locally only if Joe asks): `bun scripts/run-checks.ts`
  (each `scripts/*-check.ts(x)` in its own `bun` process; 300 s limit, `snip-check.ts` 1,800 s; `--include-optional` adds the deep Orbit
  belt check; `--full` runs full depth; `--json=<path>` saves results; extra args filter
  by filename, and `<file>@<k>/<n>` runs one part).
- One check: `bun scripts/<name>-check.ts`.
- A check fails if it exits non-zero, times out, or prints a FAIL summary.
- Install deps first. Many checks import server functions (`@tanstack/react-start`) or
  need `happy-dom` / `@napi-rs/canvas`; a "Cannot find module" failure is an
  environment problem, not a check result.
- **Package registry:** `bun.lock` pins 54 packages to Lovable's private npm cache
  (`europe-west*-npm.pkg.dev/lovable-core-prod/...`), which returns 403 outside Lovable.
  The approved workaround: back up `bun.lock`, temporarily rewrite those URLs to
  `https://registry.npmjs.org/` (same versions and integrity hashes), run
  `bun install --frozen-lockfile`, then restore `bun.lock` and confirm
  `git diff -- bun.lock` is empty. **Never commit a changed `bun.lock`**; Lovable builds
  from it. Joe's cloud environment can do this automatically through a setup script
  (kept in the environment settings, not in the repo); if `node_modules` is missing at
  session start, the script didn't run, so ask Joe before working around it.
- **Baseline:** whatever the latest green PR run of the Checks workflow reports (143
  routine checks as of 14 Oct 2026, after the deletion and the 14 Oct batches: the 145
  `scripts/*-check.ts(x)` less the two `--include-optional` ones, which never run in CI; the CI
  summary lists puzzle-bank-check as its 4 parts, arcade-play-check as its 5,
  bottom-clearance-check as its 3 and arcade-self-replay-check as its 2, 153 rows in all. The 14 Oct deletion removed sum-hunt-check, added
  removed-games-check and renamed stroke-tiles-rings-check to tiles-rings-check and
  gravity-chain-intruder-check to gravity-maze-check). CI times (2-core runners), quick depth: arcade-play-check ~3 min per play job
  (~11 min whole), snip-check ~90 s (full ~8 min CI, ~12 min locally), each
  puzzle-bank-check part ~65 s (whole ~5 min CI, ~4 min on 4 local cores); arcade-fx,
  arcade-self-replay, ink-live-bottom and orbit-camera ~60–70 s; burst-swing-score and
  reveal-score ~50 s. new-types checks seeded bank draws and takes ~10 s. number-batch-check (Brimful, Checkout, Ballpark: same-seed puzzles, BFS and exhaustive-search proofs, score anchors) takes ~12 s. wordfall-check (Letterfall dictionary, plan, a 20-seed bot proving par through the server replay, identity proof) takes ~6 s. arcade-batch1-check (legacy identity + 150 proofs for Jaywalk, Roofbound, Ball Tracker, Slice) takes ~2 min; arcade-batch2-check (legacy digests, bots proving 150 for Gemstone, Coral Pop, Meteor, Hover) takes ~60 s. arcade-batch4-check (legacy digest, stored Scrumper plans for all 60 templates, bots proving 150 for Scrumper, Junction, Tilt, High Rise) takes ~30 s. arcade-batch5-check (legacy digest, bots proving 150 for Swish, Flightpath, Rally, Tempo, Rainbow Bridge, Orbit's hole witnesses) takes ~45 s. arcade-tuning-a-check (Tuning A: pre-change runs replaying to the same score and state for High Rise, Wavefront, Orbit, Grappler and Tilt; Wavefront shapes, Orbit fly-in and earlier misses, Grappler touch stars, every Tilt cup reachable, 150 proofs) takes ~15 s; `CHECKS_FULL=1` checks every Grappler bank course and 40,000 Tilt seeds. ink-live defaults to 20 seeds; `INK_LIVE_SEEDS=60` runs the full set. attention-rework-check (14 Oct 2026: Eagle Eye `scanRev 1`, Double Take `spotRev 1`, Tally `countRev 2`; legacy and new-stamp fixtures `scripts/fixtures/attention-rework-*.json.gz`, generation, anchors, random play) takes ~1 s. tap-log-check (Flash, Bang On and Ascend tap logs against honest runs recorded on main, phone parity in happy-dom, tampered logs) takes ~30 s; arcade-tuning-c-check (Tuning C: 72 pre-change runs replaying to the same score and state for Gemstone, Grappler, Hover, Rainbow Bridge, Roofbound, Tempo, Wavefront, Tilt and Slice; Gemstone's wait and 2,500 par, the score-only curves on identical play, Roofbound's 10 s bend, Wavefront's slower waves 3–4 and timed boss kill, Tilt's amber start, hole-mouth stars and a scripted 150, Slice's blade, Junction retired, 150 proofs) takes ~45 s; tuning-b-check (Flightpath bullRev 4 balloons and 150 via the server replay, Breaker's 3.5 s Fireball, Rally pads never overlapping, no per-game arena fills, Fission controls) takes ~5 s; `TAP_LOG_PARITY=all` plays every recorded run through the phone. codeword-check (all 1,000 Cryptogrid boards proven unique with four and five givens), strikeout-check and swapword-check take under 10 s each (word batch 2, 14 Oct: each also replays a legacy fixture recorded on main). letterwheel-check (Roundabout `wheelRev 1`: 3,456 stored-round cases and reveals, both banks rebuilt byte for byte, 300 new boards proved, miss costs, random tracing) takes ~22 s; wordsearch-check (Lookout's 76-theme bank rebuilt, chip counts, 840 stored answers) ~13 s. move-limits-check (13 Oct 2026: Colour Flood, Polypotions, Topsy-Turvy, Counterweight, Operator and Brimful limits, Tally's counts; legacy identity on `scripts/fixtures/move-limits-legacy.json.gz`, enforcement, random play, counters) takes ~2 s. careless-play-check (Flash and Bang On `tapRev: 2`, Pull! `clayRev: 4`: older stamps unchanged, stored breakdowns, careless lines and honest bands on 30 room seeds) takes ~8 s. speed-oct14-check (Speed tuning, 14 Oct 2026: Flash and Bang On `tapRev: 3`, `chainCycleRev: 1`, Pull! `clayRev: 5`; stored rounds on `scripts/fixtures/speed-oct14-legacy.json.gz` and `speed-oct14-rounds.json.gz`, new decoys, blind spots and curves, 14–16 birds, before/after bands from `scripts/speed-bands-oct14.ts`) takes ~10 s. pattern-logic-oct14-check (14 Oct 2026: Jumbled `tilesRev 1`, Colour Flood `floodRev 2`, Box Six `sudokuRev 1`, Bomb `bombVersion 3`; stored-round identity on `scripts/fixtures/pattern-logic-oct14.json.gz` and, recorded on unmodified main, `scripts/fixtures/pattern-logic-oct14-legacy.json.gz`, new-round stamps and rules) takes ~5 s; bomb-v3-check (all 300 v3 bomb cards proved from their clue text over 60,480 sequences) takes ~5 s. arcade-tuning-e-check (Tuning E, 13 Oct 2026: 32 pre-change High Rise, Meteor, Scrumper and Hover runs replaying to the same score and state; taller worlds per stored revision; Hover's drifting course; Meteor's 28 rows; Scrumper's 2/3/5 mix, crook rules, stored rev-5 plans at every wobble, hard levels needing their catch; best scores via the server replay) takes ~2 min. arcade-tuning-f-check (Tuning F, 14 Oct 2026: 40 pre-change and 40 new-stamp runs replaying to the same score and state for Breaker, Rally, Tempo, Meteor and Orbit; the Fireball, the second bumper, the thinned chart, the rock pace; 30,720 synthetic Orbit flights at 1–40 px a tick and real runs proving a touched black hole always registers; 150 on every new stamp; Hover's border-light levels; Fission's arrows) takes ~15 s; `CHECKS_FULL=1` flies through every bank course's holes. arcade-tuning-f2-check (Tuning F second set, 14 Oct 2026: 48 pre-change Jaywalk, Slice, Coral Pop, Grappler, Gemstone and Scrumper runs replaying to the same score and state, runs on the new revisions, Jaywalk's 13 px walker, Slice's 620 px slice, Gemstone's 2,800 par, best scores via the server replay) takes ~15 s; bubble-rev4-check (Coral Pop's directional torpedo, stored rev-4 runs) takes ~1 s; swing-rev8-check (Grappler's evenly spread stars, stored rev-8 runs, the dragon label; `CHECKS_FULL=1` checks every bank course) takes ~17 s; snip-rev7-check (every one of the 4,435 Scrumper per-pin deals replayed with its stored plan, older-revision digests, stored rev-6/rev-7 runs, a 150) takes ~50 s.- **Any arcade change** (a sim, renderer, art, effect or arcade stage): run
  `bun scripts/arcade-play-check.ts` with the game's own checks, arcade-self-replay,
  arcade-fx and reveal-score. It plays all 22 active arcade games (and Letterfall, plus Tenfall, Mixed Signals, Bonk and Pull!, all with the arcade play-screen layout proof) in headless Chromium
  (390 × 700, practice mode, 15 s of scripted taps and swipes each, about 10–12 minutes; the play-screen
  layout proof runs first on its own practice run with the clock frozen, as bottom-clearance-check, so a
  game that dies in seconds without input stays on its play screen and no played run loses time to it)
  and fails if the sim tick or HUD timer stops (judged over the span the HUD was sampled), a console or page error appears, the
  average frame time is far above the per-game baseline from main
  (`scripts/fixtures/arcade-play-baseline.json`; rerecord with `--record` against main)
  or a drawn object jumps further than it can move. Pass game ids to run only those, or
  `--part=k/n` for one CI group (`play4` holds flip, Roofbound).
  It starts its own Vite dev server (or `--url=<origin>`) and needs the pre-installed
  Chromium; run-checks gives it 1,500 s.
- **Bottom clearance** (14 Oct 2026): bottom-clearance-check (headless Chromium, ~10 s a game, ~20 s a puzzle with
  the 15 Oct seam pass, split over `play6`–`play13` as `@1/8`–`@8/8`) opens every active game's intro and live stage in practice at
  375×667 and 390×844, each also 80 px shorter (a browser bottom toolbar shortens the dynamic viewport by
  its height), and fails if any control in the stage (or the intro's Ready) sits under 12 px above the
  visible bottom, is clipped by the game region, or the shell does not end at the dynamic viewport's
  bottom. Game screens are `.game-viewport` (100dvh) with the inset + 16 px under the controls; per-game
  lifts live in `src/polish-layout/bottom.css` (layout 3, `.game-column-lifted`). Run it after a stage
  layout change. Arcade play screens (15 Oct 2026, `data-arcade-play`: the live round of the arcade games
  and the engine games on the arcade stage) are as large as possible instead: a 44 px header row, an
  edge-to-edge box from 4 px under it, the column and its lowest control ending exactly 16 px above the
  bottom whatever the home-bar inset (also proved with a 34 px home bar emulated, here and in
  arcade-play-check); controls inside a 34 px home-bar zone are printed as NOTE lines, not failures, and a
  pixel test fails on any gap pixel that is not `--screen-edge` (#070709) with a notch and home bar
  emulated (`docs/arena-sizes-oct-2026.md` has every box and world size, 414×896 included), and once more as an iPhone 11
  home-screen app (414×896, 48/34 px insets, laid out 848 px short, `navigator.standalone`), where the column and lowest
  control end 16 px above the screen's bottom and nothing clips. Each puzzle's intro, stage and timed-out
  reveal is also drawn with a 47 px notch and 34 px home bar and fails on a colour seam in the top or
  bottom strip (`data-puzzle-screen`: the page behind is `--screen-edge` and the strips fade to it).
- **Safe areas on the other screens** (14 Oct 2026): `viewport-fit=cover` lets every page draw under a
  notch and home bar, so safe-area-screens-check (headless Chromium, ~2 min, shard `play4`) draws the home /
  room join, practice list, sound settings, practice and room round intros, a help sheet, and the room's
  lobby, link join, Prepare to Duel, round title, result, standings, winner reveal and podium (the real
  routes through `scripts/safe-area-harness.tsx`, network stubbed) with a 47 px notch and 34 px home bar
  emulated (`Emulation.setSafeAreaInsetsOverride`) at 375×667 and 390×844. It fails if text or a control
  sits under either inset (a scrolling page at its scroll end), a control is covered, or an intro or room
  moment scrolls. It also draws the room's live round (arcade and puzzle screens; 6- and 7-round rooms, the final
  round, the bank's longest name) at 414×896 as an iPhone 11 home-screen app, 390×844, 375×667, 360×800, 600×900 and
  1024×768 and fails unless the arcade header stays 44 px (52 px to the arena) with the timer centred and the round label
  in its widest fitting form, on at most two unwrapped lines, 8 px clear of every header item (`--geometry=<file>` writes
  every box for a before → after run on main). Run it after changing a non-game screen's or the play header's layout.
- **First paint** (16 Oct 2026, display only): first-paint-check (headless Chromium, ~2 min, shard `play3`) starts
  18 practice puzzle rounds (two or more per category) and 4 room rounds (the server moving the phase on, no input) as an
  iPhone 11 home-screen app at 414×896 with the CPU slowed 4×, the intro page scrolled to its end first, and fails if the
  stage, any `[data-game-arena]` or the board is ever more than 0.5 px from its final box in any frame from the first one
  (or the page is scrolled). GameLayout's entrance is a fade only (`animate-round-in`; phase-in's 10 px rise was drawn
  part-way through on a slow first frame), the game screen's scroll reset runs before paint, and boards that size from
  their container measure in `useBeforePaint` (a layout effect), never after the first frame. Pass game ids to run only
  those (practice and room). Run it after changing a puzzle board's sizing or GameLayout.
  Its standalone pass (17 Oct 2026, fix-up after #95; `--late-only` runs it alone) opens 7 practice and 2 room rounds as a
  reopened home-screen app: laid out 414×896 with no insets, then, from the stage's first frame, the 414×848 viewport and
  the 48/34 px insets (CDP, a frame or two late, as iOS settles them). PhoneShell's geometry hold (`useGeometryHold`,
  `data-geometry-hold`, standalone puzzle play screens only) keeps the round hidden, its fade paused, until the insets
  have arrived and the geometry reads the same for 3 frames (at most 400 ms); held frames are not judged, every visible
  one is. The arcade shortfall (`useStandaloneShortfall`) is applied in a layout effect, before the first paint.
- **Screen bottoms** (16 Oct 2026, display only): screen-bottom-check (headless Chromium, ~1 min, shard `play6`) draws 21
  non-game screens (home, first-time intro, practice list, tournaments, profile and practice round intro, lobby with 2 and 10 players, link join, Prepare
  to Duel, round title, room round intro, round result, standings and podium with 2 and 10 players, round result and standings after an arcade round, winner reveal) as an
  iPhone 11 home-screen app and, at the top, middle and end of each page's scroll, fails unless html and body are
  `--screen-edge` (#070709: what shows below a short page, below the 848 px layout viewport and on overscroll) and the
  bottom 34 rows are #070709 in the background alone and wherever no content covers them. The page shells pin their
  screen background to the viewport and its bottom strip is that black across the home-bar inset (polish-layout/bottom.css
  "Every screen's bottom").
- **Tap targets** (Pull!, Mixed Signals, Tempo): tap-mapping-check (~20 s) draws frames with the
  real renderer (@napi-rs/canvas), finds each target's drawn pixels, and sends taps through the phone's own
  mapping (`src/components/puzzles/tapMapping.ts`) into the sim on the next tick: a tap on the drawn centre
  must hit and a tap 3 px past the drawn edge must miss (clays and birds all round, each drawn over a zone at
  exactly its sim hit area; gates and lanes left and right, since lanes are picked by x). Bonk is reported,
  not enforced: its whole-cell tap box is intended. Run it after changing one of those renderers, their tap
  handlers or tapMapping.ts.
- **Low-end performance** (16 Oct 2026, presentation only): `src/lib/fx/lowEnd.ts` steps an arena into reduced
  effects after sustained slow frames (pixel ratio ≤ 1, then 0.75; decorative passes skipped; the screen clock at 4 Hz
  instead of 10 while an arena is live), never at full frame rate; every arcade-stage canvas sizes through `arcadeCanvasRatio()`. `bun scripts/arcade-perf.ts [games] [--rates=1,4,6]
  [--profile] [--raster]` measures frame times under CDP CPU slowdown and attributes them (a tool, not a check);
  arcade-lowend-check (~4 min, shard `play5`) fails if Tilt, Ball Tracker, Ink Bridge, Grappler or Orbit average
  under 30 fps at 4× slowdown (390×844), or if reduced effects switch on at normal speed (plain, a 30 Hz-capped
  screen, one 500 ms stall; slowness is judged by each frame's own work, never the gap between frames); a normal-speed step down is played once more only when /proc shows other processes left the browser under 1.25 cores through the judging window, and that second play must keep full effects). Before → after for every game:
  `docs/arcade-lowend-oct-2026.md`. Geometry/pixel browser checks pin full effects (`DEVICE_INIT`).
- puzzle-input-tuning rewrites `.lovable/audits/puzzle-input-oct6.md`; restore it
  (`git checkout`) before committing.
- `scripts/*-bank.ts` rebuild server-only banks; run them only when a bank must change.
  The six slow-generator banks (`flow`, `blockparty`, `tubes`, `gravity`, `lightup`,
  `iceslide`; `scripts/puzzle-bank-lib.ts`) are seeded and rebuild byte-for-byte;
  `bun scripts/<game>-bank.ts --check` proves it without writing. Any change to one of
  those generators or verifiers must be followed by rebuilding its bank.

## Screenshots (design tools, not checks)

- **One screenshot tool:** `bun scripts/shots/capture.ts <game ids…> | --category=<id> | --all
  [--sizes=375x667,390x844] [--phases=intro,play,solve,reveal,timeout,full] [--tag=after] [--out=<dir>, default
  `.shots/`, which is gitignored]
  [--url=<origin>] [--dpr=1]`. Any game at any viewport: practice mode on the fixed intro example with
  `Math.random` seeded (so two trees show the same puzzle), the practice grade request held so completion
  effects can be photographed, frames `<game>-<w>x<h>-<phase>-<tag>.png` and `report-<tag>.json` (play-area
  and board gaps, reveal scrolling, smallest text, lowest contrast, sound cues, page errors). It starts its
  own dev server unless `--url` is given. Before/after: run main in a git worktree on another port with
  `--tag=before`, then `bun scripts/shots/sheets.ts` (reads `.shots/` unless `--in`, writes `<in>/sheets/` unless `--out`) for one
  sheet per game and size. Commit chosen sheets to `screenshots/<wave>/` deliberately; raw frames stay in `.shots/`.
- A game without a driver still gets its intro, an untouched mid-play frame, its completion effect through
  the dev preview hooks and a timed-out reveal. To play one for real, add a driver in
  `scripts/shots/drivers/` (contract in `scripts/shots/driver.ts`, register it in `drivers/index.ts`);
  don't make a per-wave copy of the tool.
- **Intro demos after a layout change:** `bun scripts/shots/demo-taps.ts --old=<origin> --url=<origin>
  [games…]` checks whether coordinate demos recorded on an older tree (a worktree of the commit they were
  recorded on, with `scripts/shots/demo-mount.tsx` copied in) still land every touch on the same target
  in today's intro-demo player. Stop the ones that miss with a presentation revision in
  `src/components/puzzles/wordInput.ts` until they are re-recorded.

## Rules (non-negotiable)

1. **Deterministic arcade engine.** Fixed 60-tick timestep, integer 1/256-px physics,
   seeded PRNG carried in state, no `Math.random`, no floats or wall clock in a sim. The
   phone records the input log on the sim tick it applied; the server replays that log
   and stores its own score. Art, sound, camera and effects observe the sim and never
   write to it.
2. **Version-stamp every gameplay change.** Any change to rules, generation, physics,
   timing or scoring is gated on a stamp in the stored puzzle (e.g. `speedPar`,
   `clashRev`, `inkRev`, `snipRev`, `binRev`, `orbitRev`, `crossRev`, `flipRev`, `btRev`,
   `sliceRev`, `tapRev`, `chainTimeRev`, `chainCycleRev`, `bombVersion`, `rulesVersion`, `puzzleScoreRev`, `tenRev`, `pinRev`, `scanRev`, `spotRev`, and the move-limit stamps
   `floodRev`, `tubesRev`, `gravityRev`, `balanceRev`, `equationRev`, `measureRev` 2, `countRev` 2; and Tuning F's `crossRev` 5, `sliceRev` 5, `bubbleRev` 4, `swingRev` 8, `matchupRev` 6, `snipRev` 7; and the Pattern / Logic batch's `tilesRev`, `sudokuRev`, `floodRev` 2, `bombVersion` 3; and taller worlds batch 1's `brkRev` 6, `rallyRev` 6, `wavRev` 6, `burstRev` 4; and batch 2's `beatRev` 6, `sliceRev` 6, `bubbleRev` 5, `clashRev` 5, `clayRev` 6; and batch 3's `swingRev` 9, `orbitRev` 8, `btRev` 4; and the scoring targets' (18 Oct 2026) `btRev` 5, `wavRev` 7, `flipRev` 5, `inkRev` 7, `matchupRev` 7, `bubbleRev` 6, `crossRev` 6, `rallyRev` 7, `snakeRev` 7, `binRev` 5, `snipRev` 8, `hoverRev` 6, `skylineRev` 5, `brkRev` 7, `tiltRev` 5, `orbitRev` 9, `beatRev` 7, `sliceRev` 7, `burstRev` 5, `swingRev` 10, `bullRev` 5, `pinRev` 2, `wordsmithRev` 1, `wordHuntRev` 1, `whackRev` 1; and the score bands' (19 Oct 2026) `puzzleScoreRev` 2, `btRev` 6, `wavRev` 8, `flipRev` 6, `inkRev` 8, `matchupRev` 8, `bubbleRev` 7, `crossRev` 7, `rallyRev` 8, `snakeRev` 8, `binRev` 6, `snipRev` 9, `hoverRev` 7, `skylineRev` 6, `brkRev` 8, `tiltRev` 6, `orbitRev` 10, `beatRev` 8, `sliceRev` 8, `burstRev` 6, `swingRev` 11, `bullRev` 6, `pinRev` 3, `tenRev` 2, `clashRev` 6, `whackRev` 2, `clayRev` 7, `wordfallRev` 3; and batch 1 of the scoring report's (20 Oct 2026) `puzzleScoreRev` 3, `floodRev` 3, `strikeoutRev` 4, `codewordRev` 3, `swapwordRev` 3, `wordSearchRev` 2; and the Number depth's (25 Oct 2026, `docs/depth/d2-number.md`) `depthRev` 1, `checkoutRev` 2, `tenRev` 4, with Exact, Brimful and Checkout on `depthRev` 2's gentler feature curve; and the puzzle top-up's (26 Oct 2026) `tapRev` 6, `chainDepthRev` 2, `clashRev` 9, `scanRev` 3, `countRev` 4, `wordsmithRev` 4, `tileGridRev` 2, `wordSlideRev` 2, `wordHuntRev` 4, `strikeoutRev` 6, `swapwordRev` 5, `wheelRev` 3, Logic `depthRev` 2, `blockRev` / `pipesRev` / `laserRev` / `ringsRev` / `pushRev` 2; and the x200 expansions' (26 Oct 2026) `wavRev` 10, `tiltRev` 8, `crossRev` 9, `inkRev` 10, `orbitRev` 12). Unstamped/older rounds must replay and score exactly as before.   Arcade scoring follows the Oct 2026 score bands (`docs/arcade-score-bands-oct-2026.md`): change a curve only with a
   new band revision, re-measure with `scripts/arcade-skill-bands.ts`, and keep `arcade-score-bands-check` green.
   Prove it with the game's legacy-replay/identity check.
3. **Arcade bounds rule.** Drawn art must sit within 2 px of the sim's collision bounds,
   so what players see is what collides.
4. **Never rewrite stored data.** No migrations or scripts that change saved rounds,
   puzzles, results, input logs or demos. Never regrade old rounds.
5. **Rooms are identical for every player.** All content (puzzles, order, arcade seeds,
   schedules) is derived once from the room seed on the server and stored; nothing
   random is generated per device. Answers/solutions stay server-only.
6. **Finish rule.** `puzzleScoreRev 3` puzzles (20 Oct 2026) score a correct finish 120 + up to 30 for speed, 150 with the game's
   fast share of the clock left and no mistakes (`puzzleScoreRev3.ts`). `puzzleScoreRev 2` puzzles (the score bands, 19 Oct 2026) measure a finish on the
   whole clock, with no par plateau: the share of the clock left (half that and half the efficiency share
   on games that measure efficiency), and 150 is only for a perfect run (better than every near-perfect
   kit run; `puzzleScoreRev2.ts`). Older rounds keep the 50 % par rule: full speed bonus when finishing with
   at least half the time left, then an even fall to 0 at the buzzer (`speedPar.ts`, puzzles stamped
   `speedPar: 1`; unstamped rounds keep the old linear curve).
7. **Server is the arbiter.** Clients never send scores or correctness; the server
   grades from moves/inputs. Only AnswerReveal's stored score is ever shown.
8. Keep display names in `gameNames.ts`; `PuzzleType` ids never change.

**Pinball** (`pinball`, working title, 13 Oct 2026) is a Retro arcade game, **dealt in rooms since 14 Oct 2026**
(`PINBALL_IN_ROOMS` in `src/lib/arcade/pinball.ts` is `true`; the one switch: the registry, the practice list, the
active arcade list and the checks all read it). Its rules are
`pinRev 1`; `scripts/pinball-check.ts` (~11 s) replays stored rev-1 runs, long runs and fast shots (no tunnelling).

**Junction** (`junction`) is retired to practice since Tuning C (12 Oct 2026): rooms deal the 22
active arcade games (`ACTIVE_ARCADE_GAMES` in `arcadeFxGames.renderer.ts`); Junction keeps its world,
effects and band curve for practice and stored rounds.

**Trusted client inputs (updated 12 Oct 2026, ruling D):** Flash (`reaction`), Bang On
(`stopwatch`) and Ascend (`numhunt`) rounds stamped `tapRev: 1` send raw tap logs, and the
server works out every reaction, false start, distance, count reached and wrong tap from
them against the stored puzzle (`src/lib/duel/tapLog.ts`, proved by `tap-log-check`).
What remains client-side is the tap timing (the phone's synced clock, held to the round
and the 1.5 s receipt check) and which taps the phone chooses to send; fully server-timed
taps would need live streaming before money play. Unstamped rounds keep the old summary
grading. See `docs/duelz-scoring-reference.md` section 14.

## Working process

- **Prompt reports must list every check by name** with pass / fail / timeout, never
  just a count.
  For the full suite, cite (or link) the PR's Checks run rather than a local run.
- **Joe does all device and phone testing.** Don't claim something works on a phone;
  say what was verified in code and checks.
- **Lovable and Claude Code must never edit at the same time.** Agree who holds the
  branch before starting.
- **Changes reach the live app only after merging to `main` and pressing Publish in
  Lovable.** Pushing a branch does not deploy.
- Lovable syncs `main`: never force-push, rebase, amend or squash pushed commits, and
  keep the branch building.
- Develop on the session's feature branch; don't open PRs unless asked.
- Root-level scratch files (`fix.py`, `check_example.ts`, `m.md`, `mem/`, `roadmap.md`)
  are Lovable working notes, not app code.
- Not legal advice: naming, IP, dictionary licensing and real-money items need Joe's
  adviser (see the master plan).
