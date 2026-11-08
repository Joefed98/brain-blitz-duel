# Speed fixes 1 and 5 (Nov 2026)

From `docs/audit-nov-2026/performance.md`, findings 1 ("every page downloads all 92 games") and 5 ("the first tap
decodes about 100 MB of sound"). No game's rules, scoring, stamps or look changed.

## Results

Measured with `bun scripts/perf-budget.ts` on production builds (`bun run build`) of main 1509a99 and this branch.
Raw bytes from stat, gzip at level 9 (Cloudflare serves brotli, 10–20 % smaller). Decoded sound is what Web Audio
holds: duration × channels × 48 kHz × 4 bytes.

| | Before (main) | After |
|---|---|---|
| First screen (the root and the Play tab, every static import) | 36 files, 4,651 KB raw, 1,397 KB gzip | 58 files, 1,519 KB raw, 419 KB gzip (−67 % raw, −70 % gzip) |
| Room screen before any game | 4,921 KB raw, 1,492 KB gzip | 3,850 KB raw, 1,250 KB gzip |
| Practice list before any game | 4,760 KB raw, 1,435 KB gzip | 3,665 KB raw, 1,183 KB gzip |
| Each game's own code on top of the room screen | (already downloaded) | median 26 KB raw / 11 KB gzip, largest (Cue Ball) 73 KB / 26 KB |
| First tap: sound files fetched and decoded | 429 files, 6,565 KB, 416 s of audio, ≈107 MB decoded | 50 files (63 slots), 605 KB, 41 s, ≈9 MB decoded |

First-tap memory is the decoded sound (the audit's ≈100 MB); JS heap was not measured (no browser runs).

## 1. Only the game being played is downloaded

- **`src/lib/duel/catalogue.ts`**: the light catalogue. Every game's id, name, category, clock, reveal length and
  heading, arcade run, timer, retired flag, theme, desktop mode and GOAL line, and every timing and category helper
  (`puzzleTimeLimitMs`, `typesInCategory`, `puzzleRunMs`…). Menus, lists, room settings, the tie-break, the offline
  packs and the play header read it. Its data, `catalogue.data.ts`, is generated from the registry by
  `bun scripts/game-catalogue.ts`; **re-run it after adding a game or changing a definition's name, category,
  timeLimitMs, revealMs, arcadeRun, showTimer, revealHeading or GOAL line** (game-catalogue-check fails until then).
- **`src/lib/duel/registry.ts`**: still the full registry, for the server and the checks; it re-exports every
  catalogue helper, so both read the same values. **The phone never imports it** (game-catalogue-check: only
  `*.server.ts` files and `puzzles.ts` may).
- **`src/lib/duel/gameModules.ts`** (generated with the catalogue): one `import()` per game, so each game is its own
  chunk. **`src/lib/duel/gameLoader.ts`**: `loadGameDef`, `preloadGame`, `useGameDef`; the definition is built by
  `registerDefinition.ts`, exactly as the registry builds it. **`src/components/duel/GameParts.tsx`**: `GameStage`,
  `GameReveal`, `GameIntroExample`, which draw the game's own components once its chunk is here.
- **Preloading.** A room preloads the current round's game and the next one's (round 1's from the lobby), so the
  next game arrives during this round and a round never waits. Practice fetches the game's chunk alongside its deal
  and opens the intro once both are here. The Daily and challenges preload the current and next round's game.
  Intro demos wait for the game's chunk with their still showing; replays and reveals load on demand.
- **Offline practice.** The service worker already keeps every client file, game chunks included, so a pack plays
  with no signal as before.
- **Cut from the root:** the offline queue reads `arcade/diagnosticsWire.ts` (the counters' wire format) instead of
  the diagnostics that import every sim; the play header's goal line reads the catalogue's GOAL line instead of the
  whole help copy; the game menu's own help sheet is loaded when first opened; RoundIntro's course and deal builders
  (Grappler, Rainbow Bridge, Muggins, Thirteen) and art preload load their game's code when the intro starts.

**Still shared (follow-up):** the room and practice routes carry the help copy (`instructions.ts`), the arcade
reveal and replay renderers (`revealRenderers.ts`, `playback.renderer.ts`), the sound observers (`gameSounds.ts`)
and the reveal breakdowns, which import constants and helpers from every arcade sim, so those routes still
download every sim once (≈0.26 MB gzip) before the first game. Splitting them per game is the next step.

## 5. Sounds when needed

`src/lib/sound.ts`:

- The first tap fetches and decodes only the small shared set, group `core` (UI, the clock's warnings,
  `shared.*`): 50 files.
- A room (and the Daily's and challenges' screens) loads group `room` (Prepare to Duel, round titles, the winner
  and podium) and group `voice`.
- A game starting (`loadGameSounds(type)`, from its intro and its stage) loads `voice`, the shared arcade (`arc_*`)
  or puzzle (`pz_*`) sounds its kind uses, and its own slots (named for it, `<gameId>.<event>` or `<gameId>_…`,
  `soundSlotGame`). The games before the last two let their files go; shared groups stay.
- At most five files decode at once. Each URL is fetched and decoded once, however many slots share it.
- A slot asked for before its file is here plays nothing (or the shared sound it stands in for, as during the old
  first-tap preload) and is fetched then, so it plays from its next moment. Music still loads per screen and round.
- **No first sound is silent.** Rooms (and the Daily and challenges) decode the next round's sounds during the
  current round, and the intro's Ready waits for `gameSoundsReady(type)` (`useGameSoundsReady`, at most 4 s if a
  file never answers). sound-on-demand-check proves the first tap decodes only `core`, that every game's sounds
  decode within its intro and within the shortest round on a simulated 1.6 Mbit/s link (slowest, Mixed Signals,
  ≈5.6 s of a 30 s window), that a three-round room has each round's sounds ready as its intro opens with only two
  games resident, and that every slot then plays its own file the first time.
- **Checks.** sound-manifest, sound-batch6, sound-nov-2026 and sound-retheme play every slot, so each calls the
  checks-only `loadAllSounds()` right after `unlockAudio()` (Joe's decision, 8 Nov 2026); their assertions are
  unchanged.
