# CLAUDE.md — Duelz

Guide for Claude Code sessions. Read `docs/` first (master plan, game bank, scoring
reference, anti-cheat; **`docs/design-system.md` for every screen's look**: colour tokens, the gold
rule, the tile palette, fonts, radii, panels and rows, tap feedback, the logo, the wordmark and the
Joulz hero; follow it for any screen change), then the `AGENTS.md` files (root, `scripts/`, `src/lib/arcade/`,
`src/lib/duel/`, `src/puzzles/`). Those hold Lovable's per-area design rules and
override anything general here.

## What this is

Duelz: a multiplayer skill-game app. Up to 16 players (`MAX_PLAYERS`, 10 until 31 Oct 2026) join a room with a
short code and play the same timed rounds; 83 active games across Word, Number, Speed, Attention,
Pattern, Logic and Arcade (Word 9, Number 8, Speed 6, Attention 6, Pattern 10, Logic 12 (Trail moved from Number on 27 Oct 2026),
Arcade 32 with Pinball and, since 30 Oct 2026, the Cards & Board group's Minefield (shown as Minesweeper until 31 Oct 2026), Mahjong Solitaire, Free Cell and Summit (shown as FreeCell and TriPeaks until 31 Oct 2026), since 31 Oct 2026 Five Hands, and the Sports group's Home Run, Top Bins, Apex (shown as Home Run Derby, Free Kick and Racing until 31 Oct 2026), Crazy Golf, Cue Ball and Curl Champ (shown as Minigolf, Speed Pool and Curling until 31 Oct 2026) dealt in rooms; 12 retired to practice: Swerve, Steady, Dual, Ricochet,
Bastion, Rooftop Run, Junction, Dig, Hot Floor, since 20 Oct 2026 Letterfall and, since 27 Oct 2026
(Joe's decision), Scrumper (`snip`: out of room draws and the Practice list's main shelves, in its
Retired section; stored rounds replay and grade as before; icon and name kept; category-pool-check pins
the counts) and, since 1 Nov 2026 (Joe's decision), Full House (`pokersquares`, retired the same way: out of room draws,
the Cards & Board room pool and presets; practice bests and stored replays stay)). Every category the lobby offers keeps at
least 6 active games (`category-pool-check`). On 14 Oct 2026, 19 retired games and the Memory
category were deleted; old rooms' rounds of them show only the name and stored score
(`src/lib/duel/removedGames.ts`, proved by `removed-games-check`). Built in Lovable, synced to this repo.
Lovable still hosts and publishes the app at https://joulz.uk (the primary domain since 31 Oct 2026; playjoulz.com and the old
https://brain-blitz-duel.lovable.app redirect to it). Every link the app hands out and every absolute URL in the page head
is built on `APP_URL` (`src/config/appUrl.ts`), never the page's own origin; `docs/domain-move-oct-2026.md` lists the settings
outside the repo.

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
  centred in its box; Orbit's SET CHECKPOINT is 44 px tall and narrower, in the world's reserved top-right corner on orbitRev 12 since 27 Oct 2026. arcade-device-bottom-check (headless Chromium,
  in seven parts since 31 Oct 2026 (six from 17 Oct 2026, when a half with the Meteor passes ran past run-checks' 300 s on CI; with the Cards & Board and Sports games a third of the layout passes reached the check's 270 s watchdog): its games' layout passes in quarters, `@1/7` and `@2/7` on `play1`/`play2`, `@3/7` on `play10` and `@4/7` on `play19`, and its three Meteor edge passes one each on `play7`–`play9` as `@5/7`–`@7/7`) reproduces the iPhone 11 and 14 home-screen app and Safari geometry (`scripts/device-emulation.ts`:
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
  on every third step only. Tempo's `music_beat` is tick-locked (`syncBeatTrack` in `src/lib/sound.ts`: since 27 Oct 2026 from tick 0, looping
  seconds 8–56, preloaded during the intro; before that from tick 120 on its downbeat, re-synced past 40 ms, never in `roundMusicFor`), the synth beat its fallback until it decodes.
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
  practice bests, settings (the gear: sound, direction controls, How it works). Game icons (`GameIcon`): every game's
  tile scene (a small scene of its own pieces) on a black tile with its category-colour border (since 27 Oct 2026,
  "Hero moments and tile icons" below; until then each game's own art).
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
  icon tiles are black with their category's colour as the border (27 Oct 2026). Round leaderboard rows keep time · verdict · summary
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
  no games scheduled since 27 Oct 2026 (launch night delayed; `PUBLIC_GAMES` empty until the beta date is set, so no Next
  public game card and Tournaments' empty state); new rooms never get it (`RESERVED_ROOM_CODES` always holds `PUBLIC_ROOM_CODE`); made by hand once
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
  (`useCelebrationScope`). celebrations-check (~2 min with its browser pass, `play13`; `--shots=<dir>`; drawn on a fixed clock, Mon 26 Oct 2026,
  `scripts/fixed-clock.ts`, as are theme-check, no-wrap-check, play-tab-shift-check and screen-bottom-check, so dated Play tab
  and Tournaments screens read the same on any day; the harness reserves the public card from the check's own schedule);
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
  large-card tags in the root route's head from `LINK_PREVIEW` (`src/lib/brand.ts`, absolute on `APP_URL`, plus a canonical link per path, `canonicalUrl`; there is no
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
- **Expansion E9: Rally, Fission and Flightpath to 200** (26 Oct 2026, `docs/expansions/e9.md`; Rally `rallyRev 10`,
  Fission `burstRev 8`, Flightpath `bullRev 8`; supersedes #154's Rally, #155's Fission and the parked Flightpath branch).
  The arcade rule agreed with Joe: every feature appears at seeded moments and places from the room seed, fixed at init and
  the same for every player, never from how a run has gone; every run holds enough chances for 200; features pay a modest
  fixed amount on top of the base. Rally: a 420 × 784 court, today's two pink pads (each move to its half's next spot on a
  seeded list), spin shots (aim only, no points), six gold bonus targets (`RALLY_V10_*`: seeded tick and place in the upper
  half, 4 s, any ball, +6; HUD "TARGET n/6"), blue returns 1 unit each. Fission: the higher arena, power-ups (DOUBLE, FREEZE)
  falling on a seeded schedule (atoms drop nothing), six golden atoms at seeded moments and spots (4 s), the fast-wave bonus
  and the clean-wave bonus (a shot is one tap, a double beam's two beams one shot; a beam that hits nothing breaks the wave;
  HUD "CLEAN hit/fired"); lives never take more than three quarters of the atoms hit. Flightpath: the parked rev-7 range
  (boards at five distances, the bull streak) plus a dead-centre ring at a quarter of the bull's radius (`BULLSEYE_V8_DEAD_*`).
  Tuning: `bun scripts/expansion-e9-bands.ts` (paired old/new on room seeds 0–59 and 10000–10199, weak to flawless, per-feature
  payouts, `--off`, `--random`) and `scripts/expansion-e9-ceiling.ts` (perfect-play ceilings with the oracles in
  `expansion-e9-oracles.ts`), with the skill-band tool's fixed bots (`fixes`) and its weak, elite and flawless
  levels. expansion-e9-check (~5 s) proves old stamps replay as on main
  (`scripts/fixtures/expansion-e9-legacy.json.gz`, `bun scripts/expansion-e9-legacy.ts <main checkout>`), identical
  features for every player whatever they do, the rules, and Flightpath's ceiling on all 260 seeds; review frames
  `bun scripts/shots/e9-shots.ts` (`screenshots/expansion-e9-oct-2026/`). The three intro demos stay stopped until recorded on
  the new stamps.
- **The ten 200-point arcade games re-measured** (26 Oct 2026, `docs/arcade-200-remeasure.md`): on Joe's simplified bar
  (brilliant > great > good, no played run at 0, an ordinary player's score steady; no number targets, 200 need not be
  reachable on every seed) nine pass unchanged; Coral Pop deals `bubbleRev 9` (bubbleRev 8's play exactly; base units
  the larger of the reef's net shrink and a quarter of the bubbles burst or dropped, `BUB_V9_CREDIT_PER`), so a reef
  grown past its start no longer scores 0; every level's median unchanged.
- **Joe's phone notes** (27 Oct 2026, `docs/phone-notes-oct-2026.md`; scoring formulas unchanged): Swapword
  `swapwordRev 6` (4 more swaps), Counterweight `balanceRev 3` and Brimful `measureRev 3` (1.5× the hangs and pours),
  Topsy-Turvy `gravityRev 4` (2× the tilts; a ball home blocks), Bonk `whackRev 4` (the diamond up 450 ms), Labyrinth
  `mazeRev 2` (stars anywhere reachable), Matchmaker `pairRev 2` (the gold pair pays in the first 30 s; the answer
  carries the gold match's time, `@ms`), Jumbled shown as **Gradient** (`tiles`, `tilesRev 4`: swaps, tiles lock once
  home, a colour scheme per round from `gradientPalette.ts`); Trail is a Logic game; look only: Strikeout's solved
  words above the tiles, Flash's light-orange trap, a softer Chain glow, Mixed Signals' words shrunk to fit their lane,
  slimmer Hanoi discs. New stamps come from `dealtNotesRev` (`phoneNotes.ts`); checks written for older stamps pin
  them with `pinPrePhoneNotes(true)`. phone-notes-check (~4 s) proves it. The Topsy-Turvy, Gradient and Bonk intro
  demos stay stopped until re-recorded on the new stamps.
- **Phone notes, eight arcade games** (27 Oct 2026, `docs/phone-notes-oct-2026/`; Joe's iPhone 11 tests): Breaker
  `brkRev 10` (gold bricks break after any 4 hits, a second double-ball brick in rows 8–11, a refitted curve; power-up
  bricks show their effect, no "+10" pops on any revision), Rally `rallyRev 11` (spin curves the ball for about 2/3 s,
  gold targets 5 s; the ball warms white → orange → red), Tempo `beatRev 10` (wider windows, a lighter chart, easiest
  from the fifth lane; `music_beat` preloaded during the intro and looped from its main groove, seconds 8–56, from
  tick 0 and louder, `prepareBeatTrack`), Meteor `snakeRev 10` (gold stars 5 s, a third wormhole pair, a second
  vertical lane, five seeded 2×2 rocks, a played run never 0; the comet art on every revision), High Rise
  `skylineRev 8` (rev 7's play on a gentler curve; the crane bell on a perfect drop, the gust every 10 floors), Coral
  Pop `bubbleRev 10` (the mine clears two rings; creatures drawn at 82 %), Slice `sliceRev 10` (onion and golden fruit
  1.2× bigger; the onion #CFEDE6), Swish `binRev 8` (the +9 far bucket's mouth 60 %, a close miss 1 unit; a clearer
  ball and a waving wind flag with the strength). Each new stamp draws its predecessor's seeded stream first, so older
  stamps replay as before (each game's own check); the eight intro demos stay stopped until re-recorded.
- **Joe's phone notes on six arcade games** (27 Oct 2026, `docs/arcade-phone-notes-oct-2026.md`): Roofbound `flipRev 9` and
  Tilt `tiltRev 9` keep flipRev 8's and tiltRev 8's play exactly on lifted curves (`FLIP_V9_*`, `TILT_V9_*`; states add
  `lift: 1`, outside the checksum; every run scores at least its rev-8 score; `playRevOf` maps 9 → 8 for older checks;
  their intro demos play only when recorded on 9). Display only: Hover's city gone for deep space with more stars, its
  gold stars drawn 1.2× (8.4 px on a 7 px pickup); Jaywalk a dark evening palette (darker road, dusk wash, lamp pools on
  the verges); Orbit black space (no nebula), no rings round moons (a soft halo to the assist's reach), no field guide
  line or belt track line, the planets' orbit paths kept, its 450 × 782 view drawn 862 tall (`orbitDrawHFor`: 80 rows above the
  camera's frame; the world reaches the bottom) with SET CHECKPOINT in `ORBIT_XP_ZONE`, a reserved top-right corner of those
  rows clipped out of everything in play (`clipOutZone`; `ArcadeCanvasStage` `overlay` can take `send`; earlier revisions keep
  the row; play-control-clearance-check and room-practice-parity-check prove the corner, `scripts/orbit-zone-lib.ts`);
  Roofbound's far city replaced by the cave's depths (stalactites, cold crystals, mist, pale spores); Tilt's camera fixed
  on the disc's centre, scaled to fit the width (`tiltFixedZoom`), and fainter ice; Ball Tracker's reveal, leaderboard
  and final moment count btRev 7's 36 marbles, and the readout under the board counts the seconds to the next
  switch-up ("20 to switch up"). arcade-phone-notes-check (~1 min).
- **Grappler's assault course** (27 Oct 2026, `swingRev 14`, `docs/grappler-assault-oct-2026.md`): a new course on its
  own rules (gated on the state's `assault`; every earlier revision plays and scores as before): 36 sections
  (`SWING_V14_SECTIONS`), each a start ledge, one or two hooks and a landing ledge, two of them squeezes (roof and floor
  close to a gap, a hook before it and one behind); only the section's hooks can be grabbed and nothing past the
  landing ledge is drawn; a miss (lava, squeeze rock) or the dragon's catch restarts the section from its start ledge
  (the clock runs on, the attempt's pickups go back); the dragon 40 % slower; 4 gates on the flight line, 4 gems on
  harder lines, 4 stars on a reeled-in swing; a par per section, "SECTION x / y" in the HUD. Built and proved from any
  seed in the sim (no bank; `generateSwing` deals any seed, `pinSwingPreAssault` deals swingRev 13's bank course for
  the checks written for it). Score: sections on `SWING_V14_BAND_CURVE` (120) + 10 for the course + up to 34 for pars
  + 3 a gate, gem or star. Bots: `scripts/arcade-skill-bands/bots/swingAssault.ts`. swing-assault-check (~1 min;
  `scripts/fixtures/swing-assault-legacy.json` recorded on main, `swing-assault-runs.json`, `--record`); shots
  `bun scripts/shots/swing-assault-shots.ts`. **The intro demo needs recording on swingRev 14.**
- **Grappler's swinging course** (29 Oct 2026, `swingRev 15`, `docs/arcade-standard/swing.md`; Joe: rev 14 was all
  ledges and hooks): mostly the old swinging game again (about 80 % of the course's length), hook to hook with fewer,
  wider-spaced hooks (each grab a choice), with four short ledge runs of rev 14's sections (3, 2, 2 and 3; two
  squeezes) mixed in; gated on the state's `rework` (rev-15 states also carry `assault`, so rev 14's sections,
  restarts, banked pickups, effects and reveal counts carry on; every earlier revision plays and scores as before).
  27 blocks (`SWING_V15_BLOCKS`): swinging stretches of 3–5 hooks (grab the stretch's hooks or the next stretch's
  first, which clears it) and the ledge runs; a miss puts the hero back hanging from the last hook of the stretch held
  (a ledge section: its start ledge; pickups bank at each new hook); the dragon only over the last quarter (`chaseFrom`); 5 gates on the natural line between hooks (3.5 px
  a tick), 5 gems on harder lines, 5 stars on a reeled-in swing, a par per stretch. Built and proved from any seed in
  the sim (`initV15`; `swingReworkPlan(seed)` is the course's witness: its planned route and each pickup's line).
  Score: 140 × the share of the course (straight line, `SWING_V15_BAND_CURVE` on per mille) + 30 for pars + 2 a gate,
  gem or star (30) = 200; nothing for clearing; any input scores 1 or more. Bots:
  `scripts/arcade-skill-bands/bots/swingRework.ts` (look-ahead through `swingBotKit`, perception only).
  swing-rework-check (~3 min; `scripts/fixtures/swing-rework-legacy.json` recorded on main, `swing-rework-runs.json`,
  `--record`); `pinSwingPreRework` deals swingRev 14 for the checks written for it; shots
  `bun scripts/shots/swing-rework-shots.ts`. A build takes ~60–130 ms here, 260–550 ms at a 4× CPU throttle in Chromium,
  so RoundIntro builds the course while the intro is up (`prepareSwingCourse`; rooms and practice) and the round's own
  init is a cache hit (an async round's seed only arrives at its start, so it builds then).
  `bun scripts/swing-rework-bands.ts` measures the bands on any courses. **The intro demo needs recording on swingRev 15.**
- **Practice reveal, fitting reveals, Scrumper retired** (27 Oct 2026, from Joe's phone tests; display and room
  draw only, no stamps, no scoring or grading changed): practice has no separate points page after the answer
  reveal; the reveal (puzzles and arcade) stays up with small Back (the Practice list) and Play again (a new round of
  the same game) under it (`AnswerReveal` `onPlayAgain` / `onBack`, `data-practice-reveal-actions`; no countdown
  in practice). Rooms keep their timed reveal, round results and standings exactly. Every answer reveal fits its
  screen (`useRevealFit` in `AnswerReveal.tsx`): when the board and lines are taller than the space, the boards
  (outermost canvases, svgs and grids) are drawn smaller by a transform with a matching negative margin, down to
  half size, before the whole reveal shrinks (its lines never under 13 px); the reveal tray no longer runs past the
  content's end (its 10 px padding made fill-height reveals, the Logic ones, scroll and fade). Ballpark's line and
  Roundabout's crossword cells got the dark-glass pass (`batch-w-numline.css`, `batch-w-letterwheel.css`, live round
  only). Scrumper is retired (see the counts at the top).
- **The puzzle scoring standard** (27 Oct 2026, `docs/scoring-standard.md`; one PR per category): one shape for 45
  puzzles (Nucleus, Forage, Flash, Bang On, Bonk and Pull! stay outside): a finish is 150 + speed + bonus (max 200; speed
  full by the game's "full by" time, then even to 0 at the buzzer; par bonuses full at par, 0 at twice par; clean
  bonuses less a fixed amount a mistake), unfinished credit at most 130 with "how early" extras. Each game's own live
  stamp moves up by one (`STANDARD_STAMPS` in `src/lib/duel/standard/stamps.ts`, dealt by `dealStandard` in
  `generatePuzzle`; checks written for older stamps pin them with `pinPreStandard(true)`); `gradeAnswer` sends a standard
  puzzle to `standard/grade.server.ts` (each category's module: `word`, `number`, `attention`, `pattern`, `logic`
  `.server.ts`) before the depth path, which still scores every older puzzle. The shape's arithmetic is
  `standard/shape.ts`. Part times: on a timed standard stamp the stage wrapper (`FeedbackStage`) appends a draft
  timeline (`standard/timeline.ts`: every draft with its round-clock time, kept on the device as `duelz.timeline.v1:`);
  `gradeAnswer` splits it off, grades and stores the plain answer, and the grader rebuilds the drafts for the early
  extras and the history-based clean bonuses (none without a valid timeline). standard-legacy-check regrades 5,400
  cases recorded on main 158fd83 (`scripts/standard-legacy-record.ts`); standard-shape-check, standard-timeline-check
  and one `standard-<group>-check` per group prove the rest; `bun scripts/standard-bands.ts [types]` is the sanity
  report (kit players nothing → near-perfect). The graders are imported by name (`STANDARD_GAMES` in `standard/games.server.ts`): until 29 Oct 2026 they were
  registered by bare side-effect imports, which the production build drops (`"sideEffects": false`), so the live app
  graded every standard puzzle on the older path. **Never register anything by a bare `import "./x"`.**
  standard-live-check (~3 min, `play9`) builds the app for production and plays practice rounds in Chromium and room
  rounds on the built bundle, failing unless the server stores the standard's 150 base, and grades every stored arcade
  run through the built bundle; no-side-effect-imports-check (~1 s) fails on any bare side-effect import under `src/`.
- **Joe's phone-test notes** (27 Oct 2026, `docs/phone-notes-oct-2026/`): Fission `burstRev 9` (power-ups carried by
  seeded atoms and dropped as they split, never from the top; the golden atom bounces; BURST back as the third carried
  power-up; a wave-clear time bonus, up to 5 a wave, in place of the clean-wave and fast-wave bonuses; fission-carry-check),
  Wavefront `wavRev 11` (Spread and Shield carried by two seeded ships a wave, the saucer drops the purple laser, no
  hit-streak multiplier, the mothership only after wave 5 is destroyed, a lifted curve; ships silver, grey and black
  chrome on every revision; wavefront-phone-check), Rainbow Bridge `inkRev 11` (no wind zones, 2 silver coins a level,
  pickups further from the easy line and each other, the bonus curve rescaled; ink-v11-check), Gemstone `matchupRev 10`
  (90 s, ice laid once at the start and never refreshed, swaps into and out of ice when they make a line of three, the
  curve refitted; the gem counter gone and the treasure shiny bronze on every revision; gemstone-rev10-check), Pinball
  `pinRev 5` (pinRev 4 for 90 s on a stretched curve; on pinRev 4 and 5 the original vivid pinks, greens and cyans on a
  rich purple table, smoked square-mouthed ramp tubes and a LOCK label; pinball-90-check) and Flightpath (display only, no stamp:
  a landed dart stays on its own board for 700 ms before the next board shows, so it is drawn in the ring it scored;
  rings 1–2 light pinks and 8–9 light golds, a black dart, a waving wind flag with the strength; flightpath-hit-check).
  Gemstone and Pinball follow Tempo's precedent: the definition's clock is 93 s, older 60 s rounds end at 60 s. The
  Fission, Wavefront, Rainbow Bridge and Gemstone intro demos stay stopped until recorded on the new stamps. Review
  shots: `bun scripts/shots/phone-notes-page.ts --url=<origin> --tag=before|after` (`screenshots/phone-notes-oct-2026/`).
- **Hero moments and tile icons** (27 Oct 2026; display, sound and device only, no stamps): the answer reveal's hero
  by this player's own stored score (`heroMomentFor` in `src/lib/fx/celebrations.ts`; lines `HERO_DANCE_SCORE` 190 and
  `HERO_GRAND_SCORE` 200 in `betaConfig.ts`): 150–189 the run as before; 190–199 `heroDance` (on from the left, dances
  `heroDancePose` near the left edge, off, 1.5 s); 200 `heroGrand` (a run, a leap back in the victory pose, a dance, off
  to the right, six gold fireworks, 3 s). A tap anywhere skips it (`skipCelebration`; a passive capture listener, so the
  tap still lands); reduced motion draws the hero still with a short glow (`HERO_STILL_MS`). Cues
  `shared.celebrate.heroDance` / `heroGrand` / `firework` reuse existing files. Every game's tile (`GameIcon`) is a
  small scene drawn with the game's own art: a few of its real pieces in a hand-made state (renderer painters for the
  arcade and engine games, the puzzle's own board components and CSS), defined in `scripts/shots/tile-scenes/<category>.tsx`
  (rules in `scene.tsx`: 104 px square on black, few bold pieces, no HUD, timers, buttons or UI words) and exported by
  `bun scripts/shots/tile-scenes.ts [types…] [--preview=<dir>]` as 208 px WebPs (`public/tiles/<type>.webp`, ~2–13 KB,
  the same bytes every build) plus `src/components/app/gameIcons/tileScenes.data.ts` (content hash on each URL); scenes
  import game art through plain `export`s added for them, nothing else changed in a game. The tile is black with a
  border in the exact `--category-*` colour (theme.css); the share card draws the same image. A game without a scene
  falls back to its line drawing (`conceptIcons.tsx`, today none). tile-scenes-check (~1 s) proves every active game has
  an image, hashes, sizes and the fallback. `arcadeIcons.renderer.ts` stays only for `scripts/shots/sharp-icons-shots.ts`.
  Contact sheet: `bun scripts/shots/tile-icons-sheet.ts` (`screenshots/tile-icons-oct-2026/`). celebrations-off.json was
  re-recorded (only the icon markup changed). **Re-run tile-scenes.ts after changing a game's look.**
- **Joe's iPhone 11 notes, eight arcade games** (28 Oct 2026, `docs/arcade-notes-oct28.md`; look and sound only, no
  stamps): Hover's gap stars alone drawn 1.2× (chain stars at their pickup size); no combo text above Breaker's
  paddle; Tempo's note an 8-bit pulse (`beat.note8bit.mp3`) up a major pentatonic scale by lane and its track louder
  (`BEAT_TRACK_BOOST`); Meteor's comet from Joe's mockup (white-gold head, round fading segments, no eyes; the tail's
  colours change every 5 stars, `COMET_TAILS`); a few Wavefront ships in maroon, navy or dark red (`wavHullTint`);
  Orbit planets' glow full, slight or none (`orbitGlowStrength`); Swish's ball a white baseball with no glow;
  Gemstone's bed `music_matchup2.mp3`. Both sounds come from `bun scripts/chiptune-sounds.ts`
  (`docs/sound-cues/batch5-chiptune.md`). Shots: `bun scripts/shots/arcade-notes-oct28-shots.ts`.
- **Arcade scoring standard, batch A** (29 Oct 2026, `docs/arcade-standard/`): Slice `sliceRev 11`, Breaker
  `brkRev 11`, Tilt `tiltRev 10`, Fission `burstRev 10`, Gemstone `matchupRev 11`, Meteor `snakeRev 11` and Hover
  `hoverRev 10` score in fixed parts that sum to exactly 200: a core on a straight line (no curve, knots or rising scale)
  plus fixed-amount features; speed only on a completed run; any played run scores at least 1. Gameplay changes on the
  new stamps only: Tilt a 4th maze (a smaller, tighter disc, the blue marble alone, carved from the seed in the sim),
  Fission's golden atom takes a life and the run is five fixed waves (87 atoms), Gemstone 4 treasures that swap with a
  gem making a line of three, four goal levels and exactly 10 ice cells, Meteor's combo window 3 s and warp window 2 s
  (core full at 27 stars, the near-flawless median). Slice, Breaker, Meteor and Hover keep the previous stamp's play
  (`LIFT_REVS` in `scripts/scoring-targets-revs.ts`). Each game has `scripts/arcade-standard/<type>.ts` (stamp, parts
  with maximums, a perfect run through the real scoring path) and its own `<game>-standard-check` (older stamps replay
  as on main 73f6bb7, the parts' rules); arcade-standard-check proves every game's parts sum to 200 and a perfect run
  scores 200 with every part at its maximum. The seven intro demos stay stopped until recorded on the new stamps.
- **Arcade scoring standard, batch B** (29 Oct 2026, `docs/arcade-standard/`):
  High Rise `skylineRev` 9, Swish `binRev` 9, Flightpath `bullRev` 9, Pinball `pinRev` 6, Rally `rallyRev` 12 (the spin
  reversed: a left swipe leaves left and curves back right), Coral Pop `bubbleRev` 11 (the mine pops the 4 nearest
  bubbles) and Tempo `beatRev` 11 score on one shape (`src/lib/arcade/arcadeStandard.ts`): a core measure on a straight
  line (`stdLine`, full at the near-perfect skill-band median where there is no fixed maximum) plus fixed features,
  maximums summing to exactly 200, no input 0, anyone who plays at least 1. Each sim exports `<GAME>_STD_SPEC` and
  `<game>StdParts`, listed in `src/lib/arcade/standard/index.ts`; the reveal draws one line per part, the help is
  `liveStdHelp` (LIVE_BANDS `std`), and `arcade-standard-check` proves every game's 200 (`scripts/arcade-standard/<type>.ts`);
  each game's `<game>-standard-check` replays the older stamp's runs unchanged. Flightpath's core is full at 112 (Joe's
  130 is above every seed's ceiling) and Tempo's 1,000 is per mille: decisions for Joe in the doc. The seven intro demos
  stay stopped until recorded on the new stamps.
- **Joe's puzzle notes** (28 Oct 2026, `docs/puzzle-notes-oct-2026.md`; scoring formulas unchanged): Slider
  `wordSlideRev 4` (with four rows locked as words, tap two tiles of the last row to swap them; a move; the server
  applies a swap only while every locked row is a dictionary word, `replayWordSlideFor`), Tally `countRev 6` (tray 2
  asks, seeded, a colour and a shape, a shape alone or a colour alone; `ask` on the stage); look only: Strikeout's solved
  words centred between the top bar and the tiles (the tiles keep their place), Integer Pyramid's stones turning gold
  bottom row first on every completed pyramid, Flash's summary without the flash count. Stamps one above the standard's
  (`dealPuzzleNotes` in `puzzleNotes.ts`, after `dealStandard`); checks written for the standard's pin them with
  `pinPrePuzzleNotes(true)`. puzzle-notes-check (~5 s); shots `bun scripts/shots/puzzle-notes-shots.ts`.
- **Arcade scoring standard, batch C** (29 Oct 2026, `docs/arcade-standard/`): Jaywalk `crossRev 10`, Wavefront `wavRev 12`, Roofbound `flipRev 10`, Rainbow Bridge `inkRev 12`,
  Orbit `orbitRev 13` and Ball Tracker `btRev 8` score on one shape (`src/lib/arcade/arcadeStandard.ts`): the core on a
  straight line (`stdLine`, full at a fixed figure or the Near-perfect median), each feature a fixed share of its own
  maximum, speed only on a completed run (`stdSpeed`), the parts' maximums summing to exactly 200, any played run at least 1
  (`stdTotal`, `stdFinal`), no rising scales. Each game exports `<GAME>_STD` and a straight `*_V<n>_BAND_CURVE` (LIVE_BANDS). Play is
  unchanged on all but Jaywalk (states add `std: 1`; `LIFT_REVS` / `STD_REVS` in `scripts/scoring-targets-revs.ts` map each
  to the revision whose play it keeps); Jaywalk's crossings get busier (the first at half crossRev 9's traffic, full by the
  fourth, up to 15/12 later, each crossing still proved passable; `scripts/cross-std-density.ts`). Orbit's orbitRev 12
  display and bank rules apply to 13 through `orbitXpRev`. Ball Tracker btRev 8 deals 299 of the 300 bank courses (`BT_V8_DEAL` in `ballTrackDealV8.server.ts`, course 56 left out), every one proved to reach 200 by the boosted oracle through the server replay (balltrack-deal-check, all at full depth, 24 at quick, in halves on shards a and b). arcade-standard-check (one entry per game in
  `scripts/arcade-standard/`) proves 200 in parts, perfect runs at 200 through the server replay, a played run ≥ 1 and the
  help's wording. **The Jaywalk, Wavefront, Roofbound and Orbit intro demos stay stopped until recorded on the new stamps**
  (Ball Tracker's and Rainbow Bridge's older demos still play: their HUDs show no score).
- **The arcade scoring standard** (29 Oct 2026, `docs/arcade-standard/README.md`, one page per game in that folder): core on
  a straight line, features fixed amounts, parts summing to exactly 200, at least 1 for any played run, each game on a new
  stamp one above its live one. ONE helper, `src/lib/arcade/arcadeStandard.ts` (`STD_MAX`, `StdSpec`, `stdLine`, `stdEach`,
  `stdSpeed`, `stdFinal`, parts lists and breakdowns); ONE check, `arcade-standard-check`, with an entry per game in
  `scripts/arcade-standard/<type>.ts` (shape in `entry.ts`) and `STANDARD_ROSTER` listing the 21 games of batches A–C,
  Grappler's swingRev 15 and the two Cards & Board games (a game dealt on its standard stamp must have an entry). Don't add a second helper, check or docs
  location for a new game: add its entry, its page and its roster line.
- **Practice switch, arcade groups and tile backgrounds** (30 Oct 2026; presentation and device storage only, no
  stamps): the Practice tab has a Puzzles | Arcade switch under its title ("Puzzles 51" | "Arcade 21", counts from
  the registry through `practiceSideCounts`, `src/lib/duel/practiceSide.ts`; the side shown gold, remembered as
  `duelz-practice-side:v1`); search ("Search puzzles" / "Search arcade games"), Recently played, sections and Retired
  show only that side's games. Puzzles: the six categories (no Arcade chip). Arcade: chips three across (All games,
  Retro, Sports / Cards & Board over two, Action) and one section per group. Groups by registry id in
  `src/lib/duel/arcadeGroups.ts` (Retro #36E2F5 with a soft glow, Sports #4CC24A, Cards & Board #FF5C93, Action the
  arcade colour; tokens `--group-*`; the 11 new Sports and Cards & Board ids are listed and skipped until registered):
  browsing and arcade tile borders (`GameIcon` `data-group`, the share card) only; rooms, the room category picker,
  arcade rounds, the daily arcade and scoring keep Arcade as one category. **A new arcade game needs a line in
  arcadeGroups.ts** (practice-switch-check fails on an active arcade game in no group). Every tile's inside now
  echoes its game's screen (`scripts/shots/tile-scenes/backgrounds.ts`, painted under the scene into the same WebP;
  style rules in `docs/design-system.md` "Tile backgrounds"; tile-scenes-check fails on a scene with no background).
  practice-switch-check (~1 min, headless Chromium); shots `bun scripts/shots/practice-switch-shots.ts` and
  `bun scripts/shots/tile-icons-sheet.ts` (`screenshots/practice-arcade-oct-2026/`).
- **Cards & Board: Minesweeper (shown as Minefield since 31 Oct 2026) and Mahjong Solitaire** (30 Oct 2026; `docs/arcade-standard/minesweeper.md`, `mahjong.md`):
  two arcade games born on the arcade scoring standard (`minesRev` 1, `mahjongRev` 1), dealt in rooms from the start
  (the Cards & Board group in `arcadeGroups.ts`; their tiles take the group's `--group-cards` border). Each deals its whole board in the sim from the room seed and the deal is its own
  proof: Minesweeper (`src/lib/arcade/minesweeper.ts`, 10 × 16, 25 mines, 90 s) places the mines try after try until the
  logic solver (`minesSolve`, no guessing) clears the board from a 20–60-square opening revealed for you; Mahjong
  (`mahjong.ts`, 72 tiles in four layers, 120 s) builds the stack backwards, and Shuffle (−5) re-deals the faces left by
  the same build (packed onto the lowest places when the places left can't clear). Scores: core 150 on a straight line
  (safe squares beyond the opening / pairs), No mines hit / No shuffles 20 on the same line, Speed 30 on a clear (full by
  50 s / 65 s, the near-perfect medians); −5 a mine hit / a Shuffle. Art in `minesweeper.renderer.ts` and
  `mahjong.renderer.ts` (faces and characters drawn in code), world "cards" in the shared success layer; the stages are
  ArcadeCanvasStage with a Reveal / Flag switch (long press flags) and a Shuffle button. Oracles
  `scripts/cards-board-oracles.ts`, bots `scripts/arcade-skill-bands/bots/{minesweeper,mahjong}.ts`, measurements
  `bun scripts/cards-board-bands.ts`. cards-board-check (~2 s) proves the deals, every tuning and fresh seed's oracle at
  200 through the server replay, the rules and a deal digest; the band-era checks skip them (`born: true` in LIVE_BANDS, read through
  `liveBornOnStandard`). Intro stills only (no demos recorded).
- **The Sports group** (30 Oct 2026; `docs/arcade-standard/homerun.md`, `freekick.md`, `racing.md`): three new arcade
  games born on the arcade scoring standard at stamp 1, each dealt from a proved deal (`<game>Deal.server.ts`: 300 seeds
  the game's oracle, `scripts/<game>-oracle.ts`, took to exactly 200 through the server replay; `scripts/<game>-deal.ts
  [--check]` rebuilds it; `sports.server.ts` deals them). **Home Run Derby** (`homerun`, `homerunRev` 1, 60 s): ten
  seeded pitches seen from the hitter's eye in a night ballpark; a swipe swings from the tick the finger starts moving
  (12 px), its start height the contact point and its angle the direction; distance 130 (full at 450 ft a pitch), home
  runs 50, signs beyond the fence 20. **Free Kick** (`freekick`, `freekickRev` 1, 75 s): ten seeded kicks (spot, wall,
  keeper, wind); a stroke drawn through the ball aims, curls and powers the shot; goals 130 (10 + up to 3 placement),
  targets 40, curled round the wall 20, five in a row 10. **Racing** (`racing`, `racingRev` 1, 90 s): two laps of a seeded
  circuit from a chase camera at sunset, a one-thumb joystick; distance 140, clean sectors 30 (4 a lap), finish 10, speed
  20 (par 80.8 s); other players in a room show as ghost cars (`raceGhosts.ts`: the room's broadcast channel, display
  only, no collisions or points). The Sports group in `src/lib/duel/arcadeGroups.ts` (tiles take `--group-sports`);
  born on the standard through `born: true` in LIVE_BANDS; the count checks read the registries. Checks: homerun-check, freekick-check,
  racing-check (each `CHECKS_FULL=1` proves all 300 deal seeds), arcade-standard-check's three entries; bands
  `bun scripts/<game>-bands.ts`. No intro demos yet (the intros show their stills). Shared effects
  `sportsFx.renderer.ts`.
- **Cards & Board: FreeCell, TriPeaks, Poker Squares** (30 Oct 2026; `freecell`, `tripeaks`, `pokersquares`; Arcade
  category, born on the arcade scoring standard at `freecellRev` / `tripeaksRev` / `pokerSquaresRev` 1;
  `docs/arcade-standard/freecell.md`, `tripeaks.md`, `pokersquares.md`). Sims in `src/lib/arcade/cards/` (`cards.ts` the
  shared card model; one sim each; integer moves on the engine's 60-tick clock, nothing random after the deal), art in
  `cards.renderer.ts` (the shared deck, backs and blue felt, cached per size) and one `<game>.renderer.ts` each (layout,
  hit tests, HUD chips, the success layer in the new `cards` arcade world), replay plumbing in `src/lib/duel/cards.ts`.
  FreeCell (120 s) and TriPeaks (60 s) deal a bank index: `freecellDeals.data.ts` (300 deals, each solved by
  `scripts/cards/freecellSolver.ts`, par its shortest line) and `tripeaksDeals.data.ts` (300 deals proved to clear with
  a run of ten), built by `scripts/freecell-bank.ts` / `tripeaks-bank.ts` (`--check` rebuilds byte for byte); the proved
  lines are `scripts/fixtures/*-solutions.json`, never shipped. Poker Squares (60 s) builds its target grid from any
  seed in the sim (a seeded hill climb; every line a pair or better, the total at least the core's full 68) and
  shuffles it into the dealing order; its core is full at 68 hand points, the near-perfect median. Speed
  "full by" times are the near-perfect bots' median finish (`bun scripts/cards-bands.ts`): FreeCell 66 s, TriPeaks 27 s.
  cards-check (~8 s) replays every bank deal's line (and 200 Poker Squares targets) to 200 through the server replay.
  Small cards draw a large index (rank and suit side by side across the top strip). Their pink Cards & Board border
  comes from the group map (`arcadeGroups.ts`, `--group-cards`); they share the `cards` arcade world with Minesweeper and
  Mahjong. LIVE_BANDS marks them `born` (no score-band history; the band-era checks pass them by through
  `liveBornOnStandard`), and the count checks read the registries.
- **The Sports group** (30 Oct 2026; `docs/arcade-standard/minigolf.md`, `pool.md`, `curling.md`): three new arcade
  games on the arcade standard from their first stamp, `golfRev` 1, `poolRev` 1 and `curlRev` 1, 120 s each. One kit,
  `src/lib/arcade/sportsKit.ts` (integer ball physics: segments, circles, equal-mass collisions, friction; the run's wire
  format; `replaySportsRun`, the one server replay). Each deals from a bank of seeds its oracle played to exactly 200
  through the server replay (`scripts/<game>-oracle.ts`, `scripts/<game>-bank.ts`, `src/lib/duel/<game>Bank.server.ts`,
  witnesses in `scripts/fixtures/<game>-witness.json`; `src/lib/duel/sports.server.ts` deals): Minigolf's five holes
  (a ramp lane, dogleg, S-bend, two-route island, switchback finale; pars 3–5 = best route + 1, stored in the puzzle), Speed Pool's layouts (cleared
  without a miss or a foul), Curling's sheets (every opponent stone out, eight stones on the button). Effects
  `sportsFx.renderer.ts`; checks minigolf-check, pool-check, curling-check and arcade-standard-check's entries. Their tiles take the Sports
  group's border (`arcadeGroups.ts`, `--group-sports`); LIVE_BANDS marks them `born`. Intro demos are stills until recorded.
- **Sports tuning: Crazy Golf, Cue Ball, Curl Champ** (31 Oct 2026; display names only for `minigolf`, `pool`,
  `curling`; each on a new stamp, the parts and their 200 unchanged, rev 1 dealing, replaying and scoring as before on
  its own bank). **Crazy Golf** `golfRev` 2 (`MINIGOLF_REV_CLASSIC` 1): 20 % more power (`MG_MAX_V_V2`), obstacles on
  every hole (`TEMPLATES_V2`, `mgRollTickV2`): an upright windmill whose sail feet sweep the doorway (64-tick cycle,
  phase seeded, on the round clock), tunnels (hole 4 two to different exits), sand, a dome hill, banked curves and a
  castle gate; ramps drawn as raised slopes on both revisions; witnesses carry waits (`Putt.w`) so the proof times
  the sails; a stroke limit of par + 3 a hole (`mgStrokeLimit`; golfRev 1 keeps six); bank `minigolfBankV2.server.ts` (60 of
  60, re-proved under par + 3), full by 53 s. **Cue Ball** `poolRev` 2 (`POOL_REV_V1` 1):
  the shot's `c` is power alone and `d` the spin dot anywhere in the safe circle (`poolSpinClamp`); the cue drawn behind
  the ball, turned by a drag anywhere (finer further out), a segmented green → red meter, a large spin ball, balls
  rolling into the pocket and dropping (`downAt`, display only); bank `poolBankV2.server.ts` (60 of 60), full by 58 s.
  **Curl Champ** `curlRev` 2: the throw's `d` is the start along the hog line (±100 cm), strokes carry a side
  (`b`: left bends left, right bends right, either carries); a 390 × 540 world (`CURL_VIEW_V2`) so 375-wide phones
  have no side bars; a larger Stone chip (every revision); bank `curlingBankV2.server.ts` (80 kept of 86 proved, 34 of
  120 dropped); no speed part. `ArcadeCanvasStage`'s `PointerPayload` takes an optional `d` (0 for every other game).
  Each game's check replays rev-1 runs recorded before the change; the self-replay list pins the old entries to rev 1
  and appends the rev-2 ones.
- **Small tuning batch** (31 Oct 2026): Minesweeper is shown as **Minefield** (`gameNames.ts`; id and stamps unchanged).
  Mahjong `mahjongRev 2` (`MAHJONG_REV_DEALT`; `docs/arcade-standard/mahjong.md`): rev 1's deal and score plus Undo
  (free, unlimited: the board before the last pair or Shuffle; a Shuffle undone still counts) and Reset (the original
  deal; Shuffles used still count), small buttons beside Shuffle and kind-10 presses `a` 1 / 2 in the move log; the clock
  runs on; rev 1 runs replay as before (cards-board-check, self-replay entry `mahjong/undo`). The game header's name
  (`FrameName` in `GameFrame.tsx`, play header and intro) is measured before the first paint and shrunk to fit its half
  of the header, 19px down to 13px, then two 15px lines, an ellipsis only past that; the capture tool's report records
  it (`frameName`), and `bun scripts/shots/header-sheet.ts --in=<capture dir>` draws the header contact sheet.
- **Cards tuning and Five Hands** (31 Oct 2026; `docs/arcade-standard/freecell.md`, `tripeaks.md`, `pokersquares.md`,
  `fivehands.md`): display names Free Cell, Summit and Full House (ids `freecell`, `tripeaks`, `pokersquares` unchanged;
  `gameNames.ts`). Free Cell `freecellRev 2`: Undo and Reset (input kinds 3 and 4, small buttons in the HUD row either
  side of HOME; undo unlimited, each undo or reset a move for par, the clock running; reset undoable) and a toast for a
  move refused for want of free cells ("Need a free cell to move 2 cards", `fcNoteText`); rev 1 replays on
  `freecellGameV1`. Full House `pokerSquaresRev 2`: the core full at 73 hand points, the elite median (rev 1: 68, near-
  perfect); the elite bot now plans ahead with rollouts. Summit is unchanged (60 s). **Five Hands** (`fivehands`,
  `fiveHandsRev 1`, 60 s; sim `src/lib/arcade/cards/fiveHands.ts`): five dealt cards, then 20 turns of your card (tap a
  row; rows fill evenly, filled rows greyed out) and a discard face up on the overlapping discard rows; the rows score
  as poker hands (`psHand`); hand points 160 (full at 23, the elite median) + made hands 40 (8 a row). Every deck is
  dealt with a witness arrangement reaching 200 (`fhBuildDeal`). cards-check proves rev 1 unchanged on 48 runs recorded on
  main (`scripts/fixtures/cards-rev1-legacy.json`, `scripts/cards-legacy-record.ts`), the rev-2 rules, and 460 Five
  Hands seeds at 200 through the server replay. Intro stills only.
- **Sports tuning: Home Run, Top Bins, Apex** (31 Oct 2026; `docs/arcade-standard/homerun.md`, `freekick.md`,
  `racing.md`, each with a rev-2 section): the display names are Home Run, Top Bins and Apex (ids unchanged). Each deals
  rev 2 from its own proved deal (`<game>DealV2.server.ts`, `bun scripts/<game>-deal.ts --rev=2`: 300 seeds the oracle
  took to exactly 200 through the server replay); the rev-1 deal files are unchanged and rev-1 runs replay as before
  (`scripts/fixtures/homerun-rev1-legacy.json`, `freekick-rev1-legacy.json`, `racing-v1-legacy.json.gz`, proved by each
  game's check). `<GAME>_REV_STD` stays 1; `<GAME>_REV_2` is the new stamp. Parts unchanged (200 each). **Home Run**
  `homerunRev 2`: finer aim (spray 9/16 of the swipe, fair to ±80°; the phone starts the swing after 18 px), the pitch
  type hidden until a radar board shows type and speed after the pitch, EARLY / PERFECT / LATE and a bat-vs-ball height
  marker after each swing; the camera behind the batter's shoulder with the whole batter and a full swing (display, all
  revisions). **Top Bins** `freekickRev 2`: no wind (the chip shows the distance), seeded spots 18–32 yd and up to 35°
  either side, the wall (3–5) and keeper set to each spot; the keeper's hands-down → raise → dive, no foam line, the
  crowd's goal reaction (display). **Apex** `racingRev 2`: F1 start lights (one a second from tick 30, out at tick 330,
  no movement before; the race clock, reveal time and speed part from lights out; run 5,730 ticks, `RACING_TIME_MS` 99 s,
  rev-1 runs still end at 90 s), a softer stick (±10 dead zone, expo, front wheels at most 8 a tick; 64 px thumb throw on
  the phone), the car's side and steered front wheel shown as it yaws (display, all revisions). All three fill the play
  screen at 414×896 and 375×667 (worlds and scenes carried to the box). Shots `screenshots/sports-tuning-oct-2026/`.
- **Battery** (31 Oct 2026; presentation, sound and network timing only, no stamps; `src/lib/battery.ts`): canvases render at
  a pixel ratio of at most 2 (`canvasRatio`, also behind `arcadeCanvasRatio`); every arcade loop takes its next frame through
  `arenaFrame(loop)` / `cancelArenaFrame(loop, frame)` (none while hidden, resuming on return; once the run is over,
  `arcadeClockEnded`, or the stage locked, SteadyOrPlain's `setArenaLocked`, for 2 s it draws once a second); a new arcade
  loop must use them. The timer ring steps once a second outside arcade play screens, standings/podium rows move only when
  their contents change, the room clock ticks every 250 ms between rounds (`roomTick.ts`), waiting dots step at 2.5 Hz.
  Sound (`sound.ts`): the AudioContext is suspended ~5 s after the last source ends and woken by the next `start()`, and
  suspended while hidden. Rooms (`useDuel`): realtime refetches batched to one a second (`batched`), heartbeat and polls
  off while hidden, the 8 s safety-net poll only while the channel is down. Battery saver (Profile → settings,
  `duelz-battery-saver:v1`, `<html data-battery-saver>`, off by default): `arcadeReducedEffects()` on (fewer particles and
  glows at full pixel ratio), half the celebration sparks, endless decorative CSS motion off, puzzles' animation frames at
  30 fps (`capPuzzleFrames`; never arcade or Speed). battery-check (headless Chromium, ~2 min; `--report`,
  `--arcade=<ids> [--dpr=3]` for CPU per frame) proves idle screens at ~0 fps, loops stopping when hidden or parked, the
  ratio cap and the audio suspend.
- **Sound batch 6** (31 Oct 2026, presentation only, no stamps; `docs/sound-cues/batch6-sports-cards.md`,
  `batch6-mapping.csv`): Joe's 86 ElevenLabs recordings for the Sports and Cards & Board games, trimmed (under 3 ms of
  lead, each effect within its budget plus 150 ms), looped (seamless joins, checked as `detectLoopPoints` loops them),
  levelled (effects -1 dBFS peaks, capped at the library's median loudness + 2 dB; beds -18 LUFS) and encoded (44.1 kHz,
  mono 96k; beds, crowd and engines stereo 128k) into `public/sounds/<slot>.mp3`, about 10 MB. The observers live in
  `gameSounds.ts` (cardSounds.ts re-exports): a moment that played a shared sound plays its own file in its place
  (arcade.md), new moments and loops stay silent without one (`effectCue` / `loopCue`; the eight that played a
  celebrations recording through `ownCue`); each game's bed is `music_<gameId>`. Racing's engine loop follows speed
  (`setCueLoopRate` in `src/lib/sound.ts`), its five start lights and lights out (racingRev 2) play `racing_light` and
  `racing_go` on T2's `racing.light` / `racing.go`; TriPeaks' run card rises a semitone a card. sound-batch6-check (~1 s)
  proves every slot's file, length budget, loop flag and format from the MP3 frames. The upload branch was
  `Joefed98-patch-1`; the originals are not in the repo.
- **Offline practice** (31 Oct 2026, `docs/offline-practice.md`; presentation, device storage and practice grading
  plumbing only, no game's rules, scoring or stamps changed): a hand-written service worker
  (`src/lib/offline/sw.template.js`, written per build to `/sw.js` by `swPlugin.ts` from vite.config.ts with the build id,
  every client file, the public files and the kept pages; production only) keeps the app, fonts, tiles, sounds and music;
  a new build's worker waits and takes over only while the updater's gate is "now" (`serviceWorker.ts`; the updater's
  reload hands over to it instead of unregistering it). Practice packs (`packs.ts`, `practicePackFn`: up to 10 deals a
  game, the public half plus the server's sealed token, tied to the game's stamps, replaced when they change) are topped
  up in the background (not with Settings' Offline practice switch off, on a metered connection or while a round is on
  screen). A run from a pack, or with no connection, is queued in IndexedDB (`queue.ts`) and sent oldest first, after a
  sign-in refresh, to `practiceGradeQueuedFn` (practice's own grading; a deal changed on the phone is rejected:
  "Couldn't be confirmed"); confirmed runs update practice bests only. Arcade runs show the phone's own score as
  provisional, puzzles "Score pending", both with a clock (`src/components/offline/`). The nine games whose stage asks
  the server during play are online only (`ONLINE_ONLY_TYPES`, no pack). Play, Tournaments, rooms, the daily and
  challenges show an offline state (`OnlineOnly`); a slim banner and Practice's iPhone install card are shown from
  `<html data-offline>` / `data-offline-install` (`OFFLINE_BOOT`). offline-check (headless Chromium on a production
  build, 414×896 and 375×667, shard `play20`, ~5 min) proves it; ~16 MB stored with every pack full.
- **Room settings** (31 Oct 2026; room setup and presentation only, no game's rules, scoring or stamps changed):
  under the lobby's room code a summary line for everyone ("9 rounds · Pattern, Logic, Retro, Sports · about 16 min",
  a preset's name when the picks are one) and, for the host, **Room settings**, a sheet (`RoomSettingsSheet`): presets
  Mixed (the default: Word, Speed, Attention, Pattern, Logic and the arcade groups), Puzzles only and Arcade only
  over ten colour chips (the six puzzle categories, then Retro, Sports, Cards & Board, Action from `arcadeGroups.ts`;
  at least one stays on; editing a chip deselects the preset), then rounds as 3 / 6 / 9 / 12 over a 3–12 slider, linked
  both ways (default 6), capped at the picks' room-eligible games ("Only 6 games in your picks…") with the room's
  estimated length live (`estimateRoomMinutes`). Rules in `src/lib/duel/roomSettings.ts`; the server's only writer is
  `changeRoomSettings` (`roomSettings.server.ts`, through `setRoomSettingsFn`: host only, lobby only, validated, written
  with the room still waiting). Stored in the existing `duels.selected_categories` jsonb (no migration): the picks, then
  a `rounds:N` token, which marks a settings room. Rooms without it keep `pickRoundOrder` exactly (6 rounds, 7 with all
  seven categories) until their host saves; the daily and challenges never read settings. Settings rooms deal through
  `dealRoomRounds` (`roomDeal.ts`) from the room seed: shares within 1, a seeded mixed order with no pick twice running,
  no game repeated within a pick before its games are used, the host's last three rooms avoided as before. A new room
  starts from the host's last settings (`rememberedSettings`; an older room's Arcade read as all four groups, the
  deleted memory option as nothing); Play again keeps them. `ROOM_SETTINGS_PLUS_ONLY` (`betaConfig.ts`, false) would
  keep them for Duelz Plus hosts. Intros take the game's colour (`data-intro-accent`: the category's for a puzzle,
  the group's for an arcade game) on the gradient, title (a fifth lighter, `--intro-title`), dot, labels, tray, ring
  and dots; Ready stays gold. room-settings-check (~10 s) proves presets, the cap, the sheet in happy-dom, server
  refusals, 29k seeded deals and older rooms' deals (`scripts/fixtures/room-settings-legacy.json`, recorded on main);
  theme-check draws the sheet and lobby and checks the intro colours at 414×896 app and 375×667; shots
  `bun scripts/shots/room-settings-shots.ts` (`screenshots/room-settings-oct-2026/`).
- **Rooms of 16 and the colour wheel** (31 Oct 2026, `docs/room-16-oct-2026.md`; presentation and room data only, no
  stamps): `MAX_PLAYERS` 16 (`roomCapacity`, `roomSeats.ts` `seatFor`: the 17th join is refused "That room is full (16
  players)."); migration `20261031150000_room_16_players.sql` (slots 1–16, colours 0–31, share counts 1–20) is **written
  but not applied**: until it is, the 11th join is refused as full (10) through `RoomSeatsError` and wheel colours past 9
  seat as no colour. Lobby players in two columns; round results and standings compact from 11 players with my row pinned
  (sticky, the list `overflow: clip`); the arcade chart the top 8 plus me from 11 players (`chartShown`); the podium the top three, "Your
  place" and my row (`See all`); the reveal's chart panel never shrinks below its chart (the 375×667 four-part-line
  overlap). Colours: `PLAYER_COLOURS` is a 32-swatch wheel (indices stored, never reorder; 0–9 the October ten), every
  pair ≥ 14 ΔE2000 (`PLAYER_COLOUR_MIN_DE`), drawn by `ColourWheel` in `RoomLobby.tsx` (Profile's default, the lobby's
  own chip for this room); a taken default gives the nearest free swatch (`nearestFreeColour`). Apex draws only the 3
  nearest ghosts (`nearestRacingGhosts`). room-16-check (~1.5 min, `play14`); `bun scripts/room-load-test.ts` (a tool:
  bots on an in-memory test copy, report in the doc); shots `bun scripts/shots/room16-shots.ts`.
- **The computer layout, chess.com style** (31 Oct 2026, `docs/desktop-layout.md`; presentation, input mapping and
  result recording only, no stamps, no game's world, rules, sim, scoring or grading changed): breakpoints in
  `src/lib/layoutMode.ts` (desktop: 1024 px wide and up with a mouse or trackpad; tablet: 700 px and up otherwise, pages
  in two columns, game screens exactly the phone's; phone: unchanged, every new slot renders null there, so its markup is
  byte-identical). PhoneShell marks `data-layout` and draws the 240 px rail (`AppRail`, replacing the tab bar and header;
  76 px on rooms and games), the 112 px banner slot on Play, Practice and Tournaments (`BannerSlot`, house promotions from
  `src/config/banners.ts`, never in rooms, rounds, reveals or standings), a tab page's 320 px right column (`aside`,
  `PageAside`) and a room's 380 px panel (`RoomPanel` through `RoomPanelSlot`: code, round progress by category, standings
  for 16 with playing / finished, chat between rounds). Practice on desktop: switch, search and chips in one row, games a
  3–5 card grid. **Every game declares a desktop mode** (`src/lib/duel/desktopModes.ts`, the registry's `desktop`; a new
  game needs a line): `wide` (puzzles, card and board games), `rotate` (Cue Ball only, Joe's call: the table and balls turned 90° clockwise in `ArcadeArenaSlot`'s rotor;
  pointers through `tapMapping.ts` `arenaPointer` / `arenaSize`; its HUD chips upright on the stage's `hud` strip, ball
  numbers and pop-ups counter-turned: **no text is ever drawn rotated**), `tall` (every other arcade game, upright: full height,
  scenery faded at the edges; Apex's world capped at 340×634 on desktop with its static backdrop, `maxWorldWidth`,
  for 60 fps, and its renderer skips near-grass bands the haze already paints, pixel-identical: racing-render-check). `DesktopControlsHint` shows the keys for 8 s. Every result records its input type
  (`src/lib/inputType.ts` → `input_type` on round_results, async_results, practice_plays, best effort; migration
  `20261031170000_result_input_type.sql` **written but not applied**; it also redefines `restart_duel_room` so Play
  again's archive keeps `input_type`). Checks: desktop-layout-check (thirds,
  `play22`/`play23`), desktop-fairness-check (`play22`), `arcade-play-check --desktop` as arcade-play-desktop-check
  (halves, `play24`/`play25`); desktop-geometry-check proves the new columns. Shots `bun scripts/shots/desktop-layout-shots.ts`.
- **Haptics** (31 Oct 2026; presentation and device storage only, no stamps; `src/lib/haptics.ts`): main moments
  only, through one helper with named patterns (`tick`, `go`, `success`, `error`, `impact`, `celebrate`) and an adapter
  (`setHapticsAdapter`; the web Vibration API today, so Android only: iPhone Safari has none and gets nothing; a
  Capacitor plugin can plug in later without touching a call site). Moments: the countdown's 3, 2, 1 (`tick`) and GO
  (`go`) in RoundIntro; a puzzle's correct / wrong answer from the shared signals (`usePuzzleHaptics`, mounted by
  PhoneShell on puzzle screens) and its completion when the verdict lands (`useSignatureVerdict`); arcade goals, home
  runs and pots (`success`), Cue Ball's foul (`error`), lives lost and crashes (`impact`) in the sound observers
  (`feel` in `gameSounds.ts`), the arcade buzzer (`impact`, arcadeFeedback); the podium / two-player final for the
  winner (`celebrate`); the between-rounds chat toast keeps its tick (chat-notice-check asserts it). In-game moments
  pass `{ inGame: true }`: only with a live `[data-game-stage]` on screen, never in an intro demo, replay or answer
  reveal (`holdHaptics`). Never on button taps, drags or routine hits: **don't call `navigator.vibrate` or add a
  `haptic()` call outside the listed sites** (haptics-check's `CALL_SITES` pins them). Settings → Haptics, on by
  default (`duelz-haptics:v1`), "Not supported on this device" where there is none. haptics-check (~16 s, happy-dom).
- **Joe's quick fixes** (1 Nov 2026; display, sound and room draw only, no stamps): Orbit's SET CHECKPOINT (orbitRev 12–13)
  sits over the scene, which is drawn behind and around it (no clip out of `ORBIT_XP_ZONE`; the rocket still never enters it,
  play-control-clearance-check); Tempo's hits play only their lane's note (`arcadeFeedback` `combo: false`, no generic combo
  sound each hit; the PERFECT visual stays); Pinball's J-O-U-L-Z (pinRev 4+) shows its usual banner in gold and flashes the
  world's border gold three times, 0.15 s on / 0.15 s off, with the sting `pinball.joulz` (the library's streak flourish;
  pinball-joulz-check); one app-wide home bed (`holdHomeBed` / `useHomeBed`) carries on unbroken across Play, Practice,
  Tournaments, Profile and settings, gives way to the lobby's own `lobby_loop` (follow-up, same day: the lobby crossfades
  it out over 400 ms and leaving the lobby crossfades back) and to a game's music, and resumes where it was (home-music-check,
  docs/sound-cues/music.md); the arcade answer reveal's breakdown is one line until tapped ("142 · core 110 + features
  32" on the standard, `revealSummary`; reveal-fold-check, room-16-check); Full House retired to practice.
- **Tuning: Cue Ball, Free Cell, Five Hands** (1 Nov 2026; each on a new stamp, older stamps replaying and scoring as
  before on `scripts/fixtures/tuning-nov1-legacy.json`, recorded on main by `scripts/tuning-nov1-legacy-record.ts`).
  **Cue Ball** `poolRev 3` (`docs/arcade-standard/pool.md`): poolRev 2's input and parts with a 25 % harder top speed
  (`POOL_MAX_V_V3`, `poolShotVelocity(…, rev)`), 1.75× the follow, draw and side (`POOL_V3_FOLLOW_MAX` 91,
  `POOL_V3_SIDE_MAX` 77, `PoolSpin.strong`) and one more foul, a shot whose cue ball touches no ball (−10, as the
  others); its own proved bank (`poolBankV3.server.ts`, `bun scripts/pool-bank.ts --rev=3`, witnesses
  `scripts/fixtures/pool-witness-v3.json`); the aim turns from a drag's first pixel (the 6 px wait is gone), is sent at
  the input's full ±4096 reach on every revision, and the aim preview's follow/draw bend scales with the stamp; frame
  strip `bun scripts/shots/pool-aim-strip.ts` (`screenshots/cue-ball-aim-nov-2026/`). **Free Cell** `freecellRev 3`
  (`freecell.md`): rev 2's play and 120 s, the core full at 54 units (`FC_CORE_UNITS_V3`, the near-perfect median at
  60 s; `bun scripts/cards-bands.ts freecell --at=60`) instead of all 52 home; the safe auto-move home (every revision)
  flies home on rev 3 (`fly` / `flyTick`, display only, outside the checksum; `fcFlights`). **Five Hands**
  `fiveHandsRev 2` (`fivehands.md`): the steep hand table (`FH_HANDS_V2`: pair 5, two pair 10, trips 20, straight 25,
  flush 35, full house 50, quads 60, straight flush 75), one part: 200 × hand points ÷ the deck's own best, capped at
  200; the best is exact (`fhDeckBest`, a branch and bound over the four rounds' orders, ~17 ms a deck), stored with the
  deal as `fiveHandsBest` and read by the replay, reveal and stage (`fiveHandsGameFor(rev, best)`); the deck is rev 1's
  first shuffle. cards-check, pool-check,
  arcade-standard-check and the self-replay entries `pool/v3`, `freecell/v3`, `fivehands/v2` prove it.
- **Strategy group** (1 Nov 2026; presentation and room setup only, no stamps): the arcade's Action group split in
  two: Action keeps Slice, Roofbound and Grappler; Strategy (`strategy`, `--group-strategy` #8E80FF, a blue-leaning
  violet) takes Tilt, Gemstone, High Rise, Coral Pop, Rainbow Bridge and Ball Tracker (`arcadeGroups.ts`). Practice's
  Arcade chips are the 4-column grid (All games, Retro, Sports, Action; Cards & Board and Strategy over two), the
  room settings sheet has eleven chips and Mixed / Arcade only take all five groups (each its own share). Settings
  are stored as the picks, `rounds:N`, then `groups:2`; a settings room saved before the split (no `groups:2`) reads
  its Action as Action and Strategy (`storedPicks`), so it keeps its games. room-settings-check, practice-switch-check.
- `src/components/duel/` — room/round screens (PhoneShell, RoundIntro, TimerBar,
  AnswerReveal, ArcadeReveal, WinnerReveal…); `src/components/puzzles/` — shared puzzle
  widgets; `src/lib/fx/` — sound and visual feedback (presentation only).

## Checks

- **GitHub Actions: fast checks on every push, browser checks when ready** (CI cost cut, 1 Nov 2026;
  `docs/ci-cost-nov-2026.md`). Two workflows, split by `.github/ci/shards.ts` and `.github/ci/plan.ts`:
  - **Checks** (`.github/workflows/checks.yml`) on every PR open / push / reopen / leaving draft: every check that
    starts no browser (scoring, replay, standard, type-level, unit-style), shards `a`–`g`. A new push cancels the run in
    progress; PRs only (no push trigger), so a commit is checked once.
  - **Full suite** (`.github/workflows/full-suite.yml`): every check that starts Chromium, shards `play1`–`play25`
    (`play21` is the browser catch-all), plus the one job to merge on, **full-suite-passed** (success only if every
    browser shard ran and passed; skipped never counts). It runs when a PR gets the label `ready-to-merge` (and again
    on each new push while the label is on), when a PR leaves draft, by hand (Actions → Full suite → Run workflow;
    "record arcade baseline" lives here) and weekly on main (Sunday 22:41 UTC) when main changed in the past week. Add the label only when a PR is
    otherwise finished: every push while it is on re-runs the Full suite.
  - Which side a check is on is worked out from its source (`.github/ci/browser.ts`: it, or a script it imports or
    spawns, launches Chromium through Playwright), never by hand; a browser check listed in a fast shard runs in
    `play21` instead. ci-shards-check proves every routine check runs exactly once, no browser starts on a push, and
    the workflows' matrices match the shards.
  - PRs that change only `docs/**`, `screenshots/**`, `*.md` or `.lovable/**` skip both, except `docs/beta-sql.md`
    and `docs/sound-cues/**` (checks read them). Each job's summary lists every check by name with pass / fail /
    timeout. Free plan, 2,000 minutes a month.
  - **Merge rule (the captain follows it; branch protection isn't available on this plan):** a PR merges only when
    Checks is green **and** full-suite-passed is green on its latest commit. When a PR is otherwise ready (fast checks
    green, review done), the captain adds the `ready-to-merge` label, waits for full-suite-passed, then merges (merge
    commit). A skipped full-suite-passed is not a pass. A docs-only PR (both workflows skipped) merges without them.
    If main moves on, merge main in: the label stays on, so the push re-runs both.
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
   `floodRev`, `tubesRev`, `gravityRev`, `balanceRev`, `equationRev`, `measureRev` 2, `countRev` 2; and Tuning F's `crossRev` 5, `sliceRev` 5, `bubbleRev` 4, `swingRev` 8, `matchupRev` 6, `snipRev` 7; and the Pattern / Logic batch's `tilesRev`, `sudokuRev`, `floodRev` 2, `bombVersion` 3; and taller worlds batch 1's `brkRev` 6, `rallyRev` 6, `wavRev` 6, `burstRev` 4; and batch 2's `beatRev` 6, `sliceRev` 6, `bubbleRev` 5, `clashRev` 5, `clayRev` 6; and batch 3's `swingRev` 9, `orbitRev` 8, `btRev` 4; and the scoring targets' (18 Oct 2026) `btRev` 5, `wavRev` 7, `flipRev` 5, `inkRev` 7, `matchupRev` 7, `bubbleRev` 6, `crossRev` 6, `rallyRev` 7, `snakeRev` 7, `binRev` 5, `snipRev` 8, `hoverRev` 6, `skylineRev` 5, `brkRev` 7, `tiltRev` 5, `orbitRev` 9, `beatRev` 7, `sliceRev` 7, `burstRev` 5, `swingRev` 10, `bullRev` 5, `pinRev` 2, `wordsmithRev` 1, `wordHuntRev` 1, `whackRev` 1; and the score bands' (19 Oct 2026) `puzzleScoreRev` 2, `btRev` 6, `wavRev` 8, `flipRev` 6, `inkRev` 8, `matchupRev` 8, `bubbleRev` 7, `crossRev` 7, `rallyRev` 8, `snakeRev` 8, `binRev` 6, `snipRev` 9, `hoverRev` 7, `skylineRev` 6, `brkRev` 8, `tiltRev` 6, `orbitRev` 10, `beatRev` 8, `sliceRev` 8, `burstRev` 6, `swingRev` 11, `bullRev` 6, `pinRev` 3, `tenRev` 2, `clashRev` 6, `whackRev` 2, `clayRev` 7, `wordfallRev` 3; and batch 1 of the scoring report's (20 Oct 2026) `puzzleScoreRev` 3, `floodRev` 3, `strikeoutRev` 4, `codewordRev` 3, `swapwordRev` 3, `wordSearchRev` 2; and the Number depth's (25 Oct 2026, `docs/depth/d2-number.md`) `depthRev` 1, `checkoutRev` 2, `tenRev` 4, with Exact, Brimful and Checkout on `depthRev` 2's gentler feature curve; and the puzzle top-up's (26 Oct 2026) `tapRev` 6, `chainDepthRev` 2, `clashRev` 9, `scanRev` 3, `countRev` 4, `wordsmithRev` 4, `tileGridRev` 2, `wordSlideRev` 2, `wordHuntRev` 4, `strikeoutRev` 6, `swapwordRev` 5, `wheelRev` 3, Logic `depthRev` 2, `blockRev` / `pipesRev` / `laserRev` / `ringsRev` / `pushRev` 2; and the x200 expansions' (26 Oct 2026) `wavRev` 10, `tiltRev` 8, `crossRev` 9, `inkRev` 10, `orbitRev` 12; and expansion E9's (26 Oct 2026) `rallyRev` 10, `burstRev` 8, `bullRev` 8; and the arcade re-measure's (26 Oct 2026) `bubbleRev` 9; and Joe's phone notes' (27 Oct 2026) `swapwordRev` 6, `balanceRev` 3, `measureRev` 3, `gravityRev` 4, `whackRev` 4, `mazeRev` 2, `pairRev` 2, `tilesRev` 4; and the arcade phone notes' (27 Oct 2026) `brkRev` 10, `rallyRev` 11, `beatRev` 10, `snakeRev` 10, `skylineRev` 8, `bubbleRev` 10, `sliceRev` 10, `binRev` 8; and Grappler's assault course (27 Oct 2026) `swingRev` 14; and the scoring standard's (27 Oct 2026, `STANDARD_STAMPS`) Word stamps `tileGridRev` 3, `wordSlideRev` 3, `wordSearchRev` 4, `wheelRev` 4, `strikeoutRev` 7, `codewordRev` 5, `swapwordRev` 7, and Speed and Attention's `tapRev` 6 (Ascend only), `chainDepthRev` 3, `clashRev` 10, `scanRev` 4, `spotRev` 3, `countRev` 5, `mazeRev` 3, `pairRev` 3, and Pattern and Logic's `unblockRev` 2, `blockRev` 3, `slideRev` 2, `gravityRev` 5, `tilesRev` 5, `ringsRev` 3, `laserRev` 3, `flowRev` 2, `pipesRev` 3, `pushRev` 3, `depthRev` 2 for Blackout, Hanoi, Polypotions, Bomb Defusal, Mosaic, Tents and Trees and Lamplighter, `depthRev` 3 for Box Six, Safe Cracker, Colour Flood (move limit par + 10) and Shikaku, and Number's `depthRev` 3 for Exact, Brimful and Checkout, `depthRev` 2 for Operator, Counterweight, Integer Pyramid, Trail and Ballpark, `tenRev` 5; and the six-game phone notes' (27 Oct 2026) `burstRev` 9, `wavRev` 11, `inkRev` 11, `matchupRev` 10, `pinRev` 5; and the six-game arcade phone notes' (27 Oct 2026) `flipRev` 9, `tiltRev` 9; and the standard's follow-up (28 Oct 2026, `StandardStamp.dealt`) Gradient `tilesRev` 6 (full speed within 30 s) and Colour Flood `depthRev` 4 (move limit par + 6); and Joe's puzzle notes' (28 Oct 2026) `wordSlideRev` 4, `countRev` 6; and the arcade scoring standard's batch A (29 Oct 2026) `sliceRev` 11, `brkRev` 11, `tiltRev` 10, `burstRev` 10, `matchupRev` 11, `snakeRev` 11, `hoverRev` 10; and batch B's `skylineRev` 9, `binRev` 9, `bullRev` 9, `pinRev` 6, `rallyRev` 12, `bubbleRev` 11, `beatRev` 11; and batch C's `crossRev` 10, `wavRev` 12, `flipRev` 10, `inkRev` 12, `orbitRev` 13, `btRev` 8; and Grappler's swinging course (29 Oct 2026) `swingRev` 15; and Cards & Board's (30 Oct 2026) `minesRev` 1, `mahjongRev` 1, `freecellRev` 1, `tripeaksRev` 1, `pokerSquaresRev` 1; and the Sports group's (30 Oct 2026) `homerunRev` 1, `freekickRev` 1, `racingRev` 1, `golfRev` 1, `poolRev` 1, `curlRev` 1; and the small tuning batch's (31 Oct 2026) `mahjongRev` 2; and the cards tuning's (31 Oct 2026) `freecellRev` 2, `pokerSquaresRev` 2, `fiveHandsRev` 1; and the Sports tuning's (31 Oct 2026) `homerunRev` 2, `freekickRev` 2, `racingRev` 2, `golfRev` 2, `poolRev` 2, `curlRev` 2; and the 1 Nov 2026 tuning's `poolRev` 3, `freecellRev` 3, `fiveHandsRev` 2). Unstamped/older rounds must replay and score exactly as before.   Arcade scoring follows the Oct 2026 score bands (`docs/arcade-score-bands-oct-2026.md`): change a curve only with a
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

**Junction** (`junction`) is retired to practice since Tuning C (12 Oct 2026): rooms deal the 21
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

## Working rules for every session

1. **Before pushing, merge the latest `main` into your branch** and re-run your checks on the merged tree.
2. **Never rebuild `scripts/fixtures/replay-runs.json` over existing runs** (e.g. a fresh `scripts/replay-fixtures.ts`
   write): keep every stored run and add each new-stamp run once.
3. **Append new self-replay entries at the end of the list** (`scripts/arcade-self-replay-check.ts`), never mid-list:
   each entry has its own PRNG stream and the `@k/n` parts split by position.
4. **Take game counts, names and categories from `main`** (`src/lib/duel/gameNames.ts`, `src/lib/duel/registry.ts`),
   never from memory or an older branch.
5. **Never loosen or delete an assertion** to get green, and leave `bun.lock` unchanged.

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
