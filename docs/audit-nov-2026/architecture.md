# Code audit 2: architecture, stale and duplicate code (7 Nov 2026)

Read-only audit of `main` at 34272737, before the competitive layer (data layer, accounts, ratings).
No code was changed. Nothing here has been removed yet: each item says what proves it safe when it is.

## How this was measured

- **knip 5** (`bunx knip@5`, not added to package.json), two configs written outside the repo:
  - *app graph*: entries `src/routes/**`, `src/router.tsx`, `src/server.ts`, `src/start.ts`, `vite.config.ts`;
  - *whole graph*: the same plus every `scripts/**` file and `.github/ci/*.ts` as entries.

  A file unused in both graphs is dead. A file unused only in the app graph is reached only by checks and tools.
- **madge 8** `--circular` over `src` (40 cycles).
- grep and small Python passes for CSS classes, public assets, storage keys, flags and logs (methods in the appendix).
- No browser checks were run. No build was made.

**knip false positives, checked by hand and excluded below:**
- **The whole `src/design/components/` folder.** `@/design/components` sits beside `src/design/components.css`, and knip resolves the import to the CSS file. The folder is in fact imported by 60 files.
- **`vaul`, `tw-animate-css` and `postgres`.** They are used through CSS, a shim or a script.
- **The 32 "unresolved" imports in `scripts/shots/*`.** Those are dynamic `import()` strings built at run time.

Every "unused" claim below was re-checked with grep across `src/` and `scripts/`.

## Summary

| Group | Items | What it buys |
|---|---|---|
| A. Safe to remove now | 12 | ~3,000 lines, ~30 deps, a stale font, fewer false leads for the next sessions |
| B. Refactor before the backend waves | 9 | One place where accounts, ratings and the data layer plug in, instead of six |
| C. Later | 10 | Size and consistency; none blocks the competitive layer |

Ranked within each group by value ÷ (effort × risk).

---

## A. Safe to remove now

Each item is display, tooling or dead code: no game rule, stamp, score or stored row changes (rules 2 and 4 hold).

### A1. Dead components and modules (no importer in app or scripts)
- **What:** files nothing imports.

  | File | Lines | What it was |
  |---|---|---|
  | `src/puzzles/words.ts` | 961 | word banks of the games deleted on 14 Oct |
  | `src/components/duel/RoundLabel.tsx` | 89 | the arcade header's round label. GameFrame replaced it: `room-practice-parity-check.tsx:148` asserts it never renders, and `safe-area-screens-check.tsx:513` fails if one is drawn |
  | `src/components/duel/SoloScoreStrip.tsx` | 33 | |
  | `src/components/puzzles/BarOverlay.tsx` | 38 | |
  | `src/components/puzzles/depth4/ParMeter.tsx` | 28 | a second ParMeter. The live one is `components/puzzles/depth/ParMeter.tsx`, imported by lightsOut, sortTubes and tower |
  | `src/components/arcade/ArcadeAtmosphere.tsx` | 70 | the Polish 2 "toolkit", never adopted |
- **Why:** each one is a false lead. A session searching for "the par meter" or "the round label" finds the dead copy first.
- **Effort:** S. **Risk:** very low.
- **Proof:** `bunx tsc --noEmit`, design-lint-check, no-side-effect-imports-check, ci-shards-check. Also re-run knip: the files must stay absent from both graphs.

### A2. Modules reached only by one screenshot tool
- **What:** `src/components/app/gameIcons/arcadeIcons.renderer.ts` (349 lines), used only by `scripts/shots/sharp-icons-shots.ts`. CLAUDE.md keeps it for that tool alone.
- **What:** `src/components/duel/ScoreStrip.tsx` and `ProgressStrip.tsx`, used only by `scripts/room-viewport-check.tsx` and `scripts/shared-fx-check.tsx`.
- **Why:** for the renderer, the tile scenes replaced it on 27 Oct. For the strips, they are app code that only a check renders, so the check proves a screen the app no longer draws.
- **Action:** delete the renderer together with `sharp-icons-shots.ts`. Rewrite or drop the strips' check assertions only after Joe confirms the screens are gone. Never loosen an assertion: replace it with one about what the app now draws.
- **Effort:** S. **Risk:** low.
- **Proof:** the two checks updated, tile-scenes-check, icons-check.

### A3. The Manrope font and other dropped faces
- **What:** `public/fonts/manrope-500-800-latin.woff2`, `manrope-500-800-latin-ext.woff2` and `OFL-Manrope.txt` are referenced from no `src` file. F1 dropped Manrope on 6 Nov. The offline worker still caches every public file, so each phone stores them.
- **What:** `src/lib/offline/sw.template.js:222` still sets `font-family:Manrope` on the offline page.
- **What:** `src/lib/arcade/hudPills.renderer.ts:6` names `'Saira'` in its font stack. So does `bastionTank.renderer.ts`.
- **Why:** dead bytes on every device, and leftovers of F1. The canvas stacks fall back to Archivo, so nothing visible changes.
- **Effort:** S. **Risk:** low. Three old screenshot scripts mention the files (`scripts/shots/e5-shots.ts`, `arcade-notes-oct28-shots.ts`, `phone-notes-shots.ts`).
- **Proof:** theme-check, brand-assets-check, offline-check (browser, CI only), design-lint-check.

### A4. `public/favicon.png`
- **What:** referenced nowhere. The tab icon is `favicon-32.png` and `favicon-16.png` (`src/lib/brand.ts:54-55`).
- **Effort:** XS. **Risk:** very low. Lovable's template may recreate it, so ask before deleting.
- **Proof:** link-preview-check, brand-assets-check.

### A5. Switches that are permanently on
- **What:** `PINBALL_IN_ROOMS = true` (`src/lib/arcade/pinball.ts:43`) has been on since 14 Oct. It is read in `registry.ts:174` and four other src files, plus five scripts.
- **What:** `PLAYER_ICONS_ENABLED = true` (`src/lib/brand.ts:92`), read in four files, all with an "off" branch.
- **Why:** each switch keeps a branch that never runs, and the checks still exercise both sides.
- **Action:** inline `true` and delete the off branches.
- **Not in scope:** `FX_CELEBRATIONS` (`betaConfig.ts:51`). It is a deliberate kill switch with a recorded "off" fixture (`scripts/fixtures/celebrations-off.json`), so keep it until Joe retires it. `ROOM_SETTINGS_PLUS_ONLY` (`betaConfig.ts:67`) belongs to the accounts wave (see B5).
- **Effort:** S. **Risk:** low.
- **Proof:** category-pool-check, pinball-check, player-looks-check, practice-switch-check, room-settings-check.

### A6. Duplicate pool bank
- **What:** `src/lib/duel/poolBankV4.server.ts` holds exactly the same 60 seeds, in the same order, as `poolBankV3.server.ts`. I checked them element by element.
- **What:** rooms deal poolRev 4 from `POOL_BANK_V3` (`src/lib/duel/sports.server.ts:21,50`). The comment at `:49` still says "poolRev 3 deals from its own proved bank". V4 is used only by `scripts/arcade-standard/pool.ts`.
- **Why:** the behaviour is correct by coincidence. The next bank rebuild (`pool-bank.ts --rev=5`) could easily diverge from what rooms deal.
- **Action:** deal from `POOL_BANK_V4` and fix the comment, or make V4 a re-export of V3. The deal is identical either way, so stored rounds are untouched.
- **Effort:** XS. **Risk:** very low.
- **Proof:** pool-check, arcade-standard-check, cards-check is unaffected.

### A7. Duplicate canvas HUD pill helpers
- **What:** two files both export `drawHudPillRow` and `HUD_PILL_FONT`, with different heights (26 vs 28):
  - `src/lib/arcade/hudPill.renderer.ts`, 106 lines, 8 importers;
  - `src/lib/arcade/hudPills.renderer.ts`, 75 lines, 1 importer (`orbit.renderer.ts`).
- **Action:** fold Orbit onto `hudPill.renderer.ts`.
- **See also:** C3 for the broader HUD consolidation.
- **Effort:** S. **Risk:** low. This is display only, so it is covered by the bounds rule.
- **Proof:** orbit-camera-check, play-control-clearance-check, arcade-fx-check. Arcade-play-check and room-practice-parity-check run in CI.

### A8. Thin re-export and name clashes
- **What:** `src/components/duel/Medal.tsx` is a 2-line re-export of `@/design/components/Medal` with one importer. Point that importer at the real module.
- **What:** two clashing pairs of names, both in `src/lib`:
  - `src/lib/motion.ts` (24 importers: `useReducedMotion`) and `src/lib/fx/motion.ts` (`animateFx`, `MOTION_MS`);
  - `src/lib/theme.ts` (the font list, 1 importer) and `src/lib/fx/theme.ts` (game sound and effect themes).
- **Action:** rename `fx/theme.ts` to `fx/gameTheme.ts` and fold `lib/theme.ts` into `src/design/`. Grep becomes unambiguous.
- **Effort:** S. **Risk:** very low.
- **Proof:** `tsc --noEmit`, theme-check, sound-manifest-check.

### A9. Unused npm dependencies (Joe / Lovable decision)
- **What:** about 30 runtime deps that no file imports, all shadcn leftovers since the components were cut to button, popover and slider:
  - `@hookform/resolvers`;
  - 20 `@radix-ui/react-*` packages (accordion, alert-dialog, aspect-ratio, avatar, checkbox, collapsible, context-menu, dropdown-menu, hover-card, label, menubar, navigation-menu, progress, radio-group, scroll-area, select, separator, switch, tabs, toggle, toggle-group, tooltip);
  - `cmdk`, `date-fns`, `embla-carousel-react`, `input-otp`, `react-day-picker`, `react-hook-form`, `react-resizable-panels`, `recharts`, `sonner`, `zod`;
  - dev deps `drizzle-orm`.
- **What:** `@radix-ui/react-dialog` stays, because vaul needs it.
- **Why:** tree-shaking keeps them out of the bundle. The cost is install time, audit surface and confusion: zod is listed, yet no server function validates with it.
- **Constraint:** removing them changes `bun.lock`, and CLAUDE.md forbids committing a changed `bun.lock` because Lovable builds from it. So this has to be done in Lovable or with Joe's explicit go-ahead.
- **Effort:** S. **Risk:** low at runtime, medium for the Lovable build.
- **Proof:** a production build, standard-live-check (it builds the app).

### A10. Orphaned CSS
- **What:** classes defined in CSS and named in no TS or TSX file. Dynamic `prefix-${x}` names are excluded.

  | File | Classes |
  |---|---|
  | `src/polish-layout/theme.css` | `th-answer-board`, `th-answer-correct`, `th-answer-yours`, `th-card-clip`, `th-score-top`, `th-trophy`, `th-wordmark`, `th-wordmark-last` (F4's single wordmark replaced the last two) |
  | `src/styles.css` | `animate-sheen`, `animate-slow-pulse`, `arcade-reveal-glow`, `arcade-reveal-pulse` (the arcade reveal's backdrop was removed on 3 Nov), `category-header`, `category-tag` |
  | `src/polish-layout/game-frame.css` | `gf-alert`, `gf-glass-cat`, `gf-glow`, `gf-well` (the never-adopted toolkit, with A1's ArcadeAtmosphere) |
  | `src/polish-layout/app-pages.css` | `ap-hit`, `ap-pad`, `ap-pill-done`, `ap-score` |
  | `src/polish-layout/room-screens.css` | `rs-row-btn` |
  | `src/design/components.css` | `jz-sheet-close` |
- **Not in scope:** the unused `jz-*` utilities in `src/design/utilities.css`, which are the design system's offer. Also `kakuro-tone-*`, `bridges-island-*` and `logic-wire-*`, which are likely built dynamically.
- **Effort:** S. **Risk:** low.
- **Proof:** theme-check, no-wrap-check, reduced-motion-end-check, design-lint-check. The pixel checks run in CI: bottom-clearance, safe-area-screens, celebrations (its off fixture must stay identical).

### A11. Dev-only frame-rate logs copied six times
- **What:** an `if (import.meta.env.DEV …) console.log("[game] ticks/s")` block inside six hand-written loops:
  - `src/puzzles/matchup.tsx:316`
  - `binToss.tsx:310`
  - `hover.tsx:211`
  - `skyline.tsx:184`
  - `bullseye.tsx:275`
  - `swerve.tsx:184`
- **Why:** dev noise. `frameTiming` and `scripts/arcade-perf.ts` already measure this properly.
- **Action:** delete. The blocks disappear anyway once C1 lands.
- **Effort:** XS. **Risk:** none (compiled out in production).
- **Proof:** `tsc`.

### A12. The repo's `.git` (845 MB) and `screenshots/` (611 MB, 116 folders)
- **What:** review screenshots of finished waves are committed. The largest are `oct-2026` (65 MB), `audit-nov-2026-final` (49 MB) and `sports-prepare-nov-2026` (38 MB). `docs/design-audit` adds another 61 MB.
- **Why:** every fresh cloud session clones this, which costs minutes and disk allowance.
- **Action:** move finished waves to a release asset or an external bucket, and keep only the latest audit set. This does not rewrite history; it just stops growth.
- **Effort:** S. **Risk:** none to the app. Lovable sync is untouched.
- **Proof:** ci-shards-check (screenshots-only PRs skip CI).

---

## B. Refactor before the backend waves

These are where accounts, ratings and the new data layer will plug in. Doing them first means each wave touches one module, not six.

### B1. Migrations reported "written but not applied" appear to be applied: retire the fallbacks
- **Evidence:** Lovable's own migration journal, `drizzle/migrations/meta/_journal.json`, lists these as run (latest dated 7 Nov):
  - `0006`–`0007`: player colour and icon, submitted round;
  - `0008`: share events;
  - `0009`: async rooms and the daily;
  - `0010`: friend challenges;
  - `0011`: terms events;
  - `0012`: room scoring mode.
- **Evidence:** `src/integrations/supabase/types.ts`, regenerated from the live database by Lovable on 7 Nov (e3f0bd95), has `colour` / `icon` (:19-22), `submitted_round` (:348), `input_type` (:116) and `scoring_mode` (:499).
- **Still unconfirmed:** whether `20261031150000_room_16_players`, `20261107120000_room_code_digits` and `20261031170000_result_input_type` are applied, beyond the column. They carry check-constraint changes and the `restart_duel_room` redefinition, which the types file can't show.
- **Code that exists only for the pre-migration database:**
  - `roomSettings.server.ts:74-90`: the `PGRST204` / `42703` fallback;
  - `scoringMode.ts:33-41`: `hasScoringColumn`, also read at `routes/duel.$code.tsx:944`;
  - `betaRecord.server.ts:231`: the retry without `input_type`;
  - `inputType.server.ts:6`;
  - `finishedPing.server.ts:5`;
  - `daily.server.ts:235` and `daily.functions.ts:20`: `available: false`;
  - the hidden-card paths in `playCards.ts:15`;
  - the `RoomSeatsError` 10-seat fallback (`duel.functions.ts`, `playerLook.server.ts`);
  - every "written but not applied" paragraph in CLAUDE.md.
- **Why:**
  - **Wrong signals.** Today a real failure (a revoked grant, a renamed column) is swallowed as "migration not applied".
  - **Docs mislead.** CLAUDE.md tells every session the opposite of the live state.
  - **Accounts collide.** The accounts wave will add columns to the same tables, and needs one clear "schema is X" baseline.
- **Action:**
  1. Joe confirms the live schema: Lovable's Cloud SQL view, or `docs/beta-sql.md` queries against `information_schema` and `pg_constraint`.
  2. One PR removes the fallbacks for the confirmed migrations and turns their silent ignores into logged errors.
  3. Update CLAUDE.md.
- **Two migration folders:** the repo has `supabase/migrations` (43 files, the source of truth) and `drizzle/migrations` (Lovable's applied copies). Document which one Lovable runs before the backend waves add more.
- **Effort:** M. **Risk:** medium, if a migration turns out to be unapplied. Hence step 1.
- **Proof:** player-looks-check, finished-pings-check, daily-check, challenge-check, room-scoring-check, room-16-check, room-code-check, beta-extras-check, share-check.

### B2. One server data-access layer instead of 121 inline queries
- **Evidence:** there are 121 `.from("…")` calls across 18 files:

  | File | Calls |
  |---|---|
  | `duel.functions.ts` | 30 |
  | `challenge.server.ts` | 16 |
  | `asyncRoom.server.ts` | 15 |
  | `betaRecord.server.ts` | 10 |
  | `roomPhase.server.ts` | 8 |
  | `playerLook.server.ts` | 8 |
  | `chat.functions.ts` | 8 |
  | others | 26 |
- **Evidence:** the typed client is thrown away with `supabaseAdmin as any` at `duel.functions.ts:86`, `asyncRoom.functions.ts:19`, `challenge.functions.ts:17` and `daily.functions.ts:16` (19 `as any` in src). So the generated `types.ts` protects nothing on the server.
- **Why this is the plug-in point:** accounts need a `user_id` → account mapping on every row read and written. Ratings need a "result stored" hook after `submitAnswerFn` (`roomGrade.server.ts`) and after the async submit. Both are one-line additions in a repository layer and 18-file hunts without one.
- **Action:**
  - `src/lib/data/` (server only) with one module per aggregate: rooms, players, results, async, challenges, beta events.
  - Each module exports typed functions on the generated `Database` type, with no `as any`.
  - The `*.functions.ts` files call those modules only.
  - Grading stays where it is. Only I/O moves.
- **Effort:** L, done table by table. **Risk:** medium.
- **Proof:** room-practice-grade-check, room-send-check, room-late-run-check, daily-check, challenge-check, player-looks-check, finished-pings-check, room-settings-check, room-scoring-check, beta-recording-check, room-16-check. Run `scripts/room-load-test.ts` before and after.

### B3. Ranking written twice; standings and outcome split
- **What:** the room's ranking is `rank()` in `src/lib/duel/scoring.ts:421`, which feeds `standings()` at `:491`. `duelOutcome()` at `:334` is a separate two-player path with its own time comparison (`:357-358`).
- **What:** the daily's board re-implements the same order in `rankBoard()` (`src/lib/duel/daily.ts:97`), whose comment says "as the room tie-break does".
- **Why:** ratings will consume "final places" from rooms, dailies and challenges alike. Three sources of truth for a place mean three chances for a rating to disagree with the podium.
- **Action:** one `placesOf(rows, mode)` used by standings, `duelOutcome`, `rankBoard` and the challenge board, keeping today's tie order exactly.
- **Effort:** M. **Risk:** medium. The tie order must be byte-identical.
- **Proof:** room-scoring-check (Total vs Placings), standings-reveal-check, player-looks-check (awards), daily-check, challenge-check, tie-display-check, room-settings-check's legacy digest.

### B4. What a game deals today is spread over six layers and 16 global "pin" switches
- **What:** `generatePuzzle` (`src/lib/duel/generate.server.ts:166`) composes `dealOperatorGaps(dealParMoves(dealPuzzleNotes(dealStandard(…))))`, on top of `dealDepth4` (`:175`), `dealsD5Remodels()` (`:172`), `dealtDepthRev` / `dealtTopupRev` (`:183`) and `dealtNotesRev`.
- **What:** each layer has a module-level mutable `pinPre…(on)` switch that checks flip: `pinPreStandard` and 15 more, such as `phoneNotes.ts:18`, `puzzleNotes.ts:29` and `arcade.server.ts:321`. They live in production code on a shared server isolate.
- **What:** grading mirrors this. `gradeAnswer` (`generate.server.ts:330`) goes rev1 `grade.ts` → `withRev2` / `withRev3` → `gradeDepth200` → `gradeStandard`.
- **Why it matters for ratings:** a rating must compare like with like. A game's rating epoch has to change whenever its dealt scoring changes, and today "the stamp a game deals" can only be found by running the onion. `practiceStamps.ts` already computes a stamp signature for practice bests. That signature, built from one per-game table, is the rating-epoch key the competitive layer needs.
- **Why it matters for safety:** a pin left on (an exception in a check, or a future server-side tool) silently changes what every room deals.
- **Action:**
  1. A single data table, `LIVE_DEAL[type]`, with each stamp and value, read by the deal layers. Each layer keeps its code for old stamps.
  2. Replace the module-level pins with an explicit `DealOptions` argument (`{ era: "pre-standard" }`) passed by checks.
  3. Expose `dealtSignature(type)` for practice bests and ratings.
- **Effort:** L. **Risk:** high (deal identity). Do it game group by game group.
- **Proof:** standard-legacy-check, phone-notes-check, puzzle-notes-check, puzzle-batch-nov-check, puzzle-polish-nov-check, depth-topup-check, practice-bests-check (it must stay green without re-running `practice-stamps.ts`), standard-live-check (CI).

### B5. Device-only records that accounts must take over
- **What:** the record a player would expect to follow their account lives in `localStorage` only:

  | Record | Module and key |
  |---|---|
  | Practice bests | `practiceBest.ts`, `duelz-practice-best:v3:` |
  | Stars and challenges | `practiceGoals.ts`, `duelz-practice-goals:v1` |
  | Daily streak | `dailyRecord.ts`, `duelz.dailyRecord.v*` |
  | Challenges | `challengeRecord.ts`, `duelz-challenges:v1` |
  | Room history and Profile stats | `deviceHistory.ts`, `duelz-room-history:v1`, and `useDeviceRoomRecord` in `routes/duel.$code.tsx` |
  | Recent games | `practiceRecent.ts` |
  | Remembered look | `rememberLook` |
- **What:** about 20 `duelz-*` keys in total, each module with its own try/catch JSON wrapper (22 files touch `localStorage`).
- **What:** CLAUDE.md notes that the server can't answer room history because Play again deletes results. The `*_archive` tables (`20261016130300_beta_play_again_archive.sql`) now keep them.
- **Why:** these are exactly the screens the accounts wave rebuilds. Today each module reads storage directly in its own shape.
- **Action:**
  - One `deviceStore` helper: versioned key, safe parse, one write path.
  - Each record behind a small interface (`load` / `save` / `merge`), so the accounts wave swaps the backing store and adds a one-time upload on first sign-in.
  - Leave the retired keys as they are (`practiceBest.ts:17` keeps them unread on purpose).
- **Effort:** M. **Risk:** low. Storage shapes stay the same.
- **Proof:** practice-bests-check, practice-goals-check, daily-check, challenge-check, app-shell-check (CI), offline-check (CI, the queue updates bests).

### B6. Three copies of "play one round" orchestration
- **What:** the live room (`routes/duel.$code.tsx`, 1,351 lines, 80 imports, 18 effects), the async runner (`components/async/AsyncRun.tsx`, 610 lines) and practice (`routes/practice.tsx`, 1,059 lines, 23 `useState`) each wire up the same pieces by hand:
  - `createRoomSender`
  - `createDraftKeeper`
  - `persistStageState` / `clearStageState`
  - the intro → play → reveal phases
  - the crash context
  - the verdict
- **What:** they share the helpers (good) but not the wiring.
- **Why:** ratings, anti-cheat timing and account attribution all hook the round lifecycle (start, submit, stored, revealed). One `useRoundSession(kind)` hook means one hook point. Without it, every lifecycle change is three edits with three chances of drift; `room-practice-parity-check` exists because of that drift.
- **Action:** extract the shared lifecycle into `src/lib/round/` with `kind: "room" | "async" | "practice"` adapters. Move the room route's chat and settings sheets out of the route file.
- **Effort:** L. **Risk:** medium.
- **Proof:** room-send-check, room-draft-check, stage-state-reload-check, room-late-run-check, clock-round-check, room-practice-grade-check, daily-check, challenge-check. In CI: room-practice-parity-check, arcade-room-practice-check, first-paint-check.

### B7. Module boundaries in `src/lib/duel` (355 files, flat)
- **What:** `src/lib/duel/` mixes everything in one flat directory of 355 `.ts` files:
  - room flow (`roomPhase`, `roomSend`, `roomSettings`, `roomSeats`);
  - every puzzle's rules and generators;
  - all scoring generations (`puzzleScoreRev2/3`, `depth/`, `depth4/`, `logicDepth`, `numberDepth`, `wordDepth`, `standard/`, `parMoves`, `parBonus`, `speedPar`);
  - roughly 60 banks;
  - beta recording;
  - presentation helpers.
- **What:** naming hides the server boundary. `grade.ts` and `puzzleProgress.ts` have no `.server` suffix yet import `dictionary.server`, `tileGrid.server`, `wordSlide.server` and more (`grade.ts:24-198`, `puzzleProgress.ts:34-46`). They are only reached from the client as types (`roomSend.ts:16`, `asyncApi.ts:19`, `offline/queue.ts:16`), but nothing stops a value import.
- **What:** madge finds runtime cycles in the grader registries:
  - `depth200.server.ts` ↔ nine `depth/*.server.ts`;
  - `wordDepth.server.ts` ↔ nine `depth/*`;
  - `standard/grade.server.ts` ↔ `games.server.ts` ↔ six category graders;
  - `arcadeFxGames.renderer.ts` → `alleyroll.renderer.ts` → `arenaFills.renderer.ts` → three renderers.

  The cycles through `types.ts` are type-only and harmless.
- **Why:** the backend waves add `room/`, `account/`, `rating/` and `data/` code. If it lands in the same flat folder, "where does X live" stops being answerable.
- **Action:**
  - Before the waves, create the new top-level homes: `src/lib/data`, `src/lib/account`, `src/lib/rating`, `src/lib/round`.
  - Move only room flow into `src/lib/room/`. Leave the games alone.
  - Move the `Graded` and `SubmitExtra` types to `grade.types.ts` and rename `grade.ts` → `grade.server.ts`.
  - Break each registry cycle by moving shared helpers to a leaf module.
- **Effort:** M (moves only). **Risk:** low. Imports change, behaviour doesn't.
- **Proof:** `tsc`, no-side-effect-imports-check (registries must stay named imports, never bare `import "./x"`), standard-live-check (CI, production build), room-practice-grade-check.

### B8. Silent and unstructured server logging
- **What:** server logs are free-form `console.log` strings:
  - `[room-selection]` at `duel.functions.ts:504` and `:580`;
  - `[daily]` at `daily.server.ts:126`;
  - two at `challenge.server.ts:257` and `:389`;
  - `roomSettings.server.ts:68`;
  - `[bomb]` at `bomb.server.ts:709`, on every generated (non-bank) panel.
- **What:** best-effort writes swallow errors. See B1.
- **Why:** ratings need an audit trail ("why did my rating move") and the beta needs to see failed writes.
- **Action:** one `serverLog(event, fields)` helper (JSON lines) and errors routed to the existing crash reporter's server side. It is small, and B2 can carry it.
- **Effort:** S. **Risk:** very low.
- **Proof:** beta-recording-check, daily-check.

### B9. Server function input validation
- **What:** `zod` is a dependency, but nothing imports it. The 12 `createServerFn` files hand-validate (`data as unknown as Record<string, unknown>`, for example at `share.functions.ts:35` and `beta/terms.functions.ts:17`).
- **Why:** account and rating endpoints will take user input that matters, such as names and ladder joins.
- **Action:** decide one validation style before those endpoints exist: zod, already installed, or the hand-written checks made into a shared helper. This overlaps audit 1 (security); listed here only as a structure decision.
- **Effort:** S to decide. **Risk:** none.

---

## C. Later

Worth doing, but none of it blocks the competitive layer.

### C1. Twenty-two hand-written arcade frame loops
- **What:** 22 stage files carry their own copy of the fixed-timestep loop (`let accumulator = 0`, `Math.floor(accumulator / TICK_MS)`, input-tick recording, `arenaFrame`) that `ArcadeCanvasStage.tsx:205-245` already provides. They are the older stages: matchup, binToss, bullseye, clayShoot, breaker, ballTrack, bubble, tenDrop, beat, whack, snake, rally, hover, slice, cross, skyline, pinball, ricochet (its unstamped shaft) and the retired steady, swerve, dual and snip. That is about 8,000 lines.
- **Why:** every loop rule (battery's `arenaFrame`, the 2 s parked draw, reduced effects, haptics) has to be added 23 times. battery-check proves they were.
- **Action:** migrate one game at a time onto ArcadeCanvasStage.
- **Risk:** high. Input ticks must stay identical (rule 1).
- **Proof:** arcade-self-replay-check and the game's own check. In CI: arcade-play-check, battery-check, room-practice-parity-check, arcade-device-bottom-check.

### C2. Legacy scoring generations
- **What:** rev1, rev2, rev3, depth, depth4, depth200, standard, notes, par-moves and gaps all stay forever (rules 2 and 4: stored rounds replay and score as before). That is right, but they are mixed with live code.
- **What:** about 20 near-identical `*FastSeconds` / `*EliteSeconds` helpers sit in different generations, for example:
  - `topsy.ts:312`, `jumbled.ts:347`, `logicDepth.ts:210`;
  - `depth/labyrinth.ts:141-151`, `depth/chain.ts:98`;
  - `wordDepth.ts:87-92`, `puzzleBandsText.ts:108`, `numberDepthText.ts:19`.
- **What:** two standard shapes exist, puzzle `standard/shape.ts` and arcade `arcadeStandard.ts`. Both are "parts on a straight line summing to 200" with separate speed and line helpers.
- **Action:** freeze the pre-standard generations under a `legacy/` folder, frozen by their legacy-replay checks. Share one straight-line and speed primitive between the two standards.
- **Effort:** L. **Risk:** high (regrading identity).
- **Proof:** standard-legacy-check, scoring-rev3-check, scoring-bands-check, depth-topup-check, every `*-legacy` fixture check, arcade-standard-check.

### C3. Six canvas HUD styles
- **What:** after A7, these remain:
  - `hudPill.renderer.ts`, the shared pill;
  - `actionHud.renderer.ts:137` (Action);
  - `sportsHud.renderer.ts` (Sports);
  - `cards.renderer.ts:808` `drawChip` (felt);
  - `retro.renderer.ts:404` `retroHud`;
  - `ballTrackArt.renderer.ts:861`.
- **What:** on the DOM side there are `HudPills` (20 importers), `batchP/LiveSummary` (28) and `batchW/LiveSummary` (2, a third list-of-parts component).
- **Action:** one pill primitive with per-group skins, and fold `batchW/LiveSummary` into `batchP`'s.
- **Effort:** M. **Risk:** low. This is display, under the bounds rule.

### C4. `conceptIcons.tsx`, a 1,480-line fallback that never renders
- **What:** every game, retired ones included, has a tile WebP. `GameIcon.tsx:50` falls back to `ConceptIcon` only when it doesn't.
- **Action:** replace the fallback with one generic glyph. tile-scenes-check (`:69`) then asserts "a scene" instead of "a scene or a line drawing", which is a stricter assertion, not a looser one.
- **Effort:** S. **Risk:** low.
- **Proof:** tile-scenes-check, icons-check.

### C5. Server bank weight
- **What:** about 9 MB of `*.server.ts`, 7 MB of it banks.
- **What:** 26 files totalling 775 KB are reached only by checks. These are old-revision deal banks; stored rounds carry their own seed, so replay never reads them. Examples:
  - `curlingBank`, `curlingBankV2`, `curlingBankV3`;
  - `homerunDeal`, `homerunDealV2`, `homerunDealV3`;
  - `freekickDeal`, `freekickDealV2`, `freekickDealV3`;
  - `racingDeal`, `racingDealV2`;
  - `poolBank`, `poolBankV2`;
  - `tiltBank`, `bombBank`, `ballTrackBankTall`, `blockfallDeal`.
- **What:** large old banks are still in the app graph through `pinPre*` deal paths, for example `orbitRev3Bank` (727 KB), `wordSearchBank` (653 KB) and `ballTrackBank` (392 KB).
- **Why:** the nitro build targets Cloudflare by default, where worker size limits apply.
- **Action:** measure the server bundle first; it needs a build, not done here. If it is close to the limit, move check-only banks under `scripts/fixtures/`, and with B4's `DealOptions` make the old-stamp deals lazy imports.
- **Effort:** M. **Risk:** low once B4 lands.

### C6. Retired games' code
- **What:** the four named in the brief are live code, not dead code:
  - Full House (`pokersquares`): 5 files, 27 KB;
  - Golf Solitaire (`golfsol`): 6 files, 27 KB;
  - Muggins (`muggins`): 6 files, 42 KB;
  - Scrumper (`snip`): 5 files, 170 KB, plus `snipCourses.data.ts` (17 KB).

  They are playable in Practice's Retired section and their stored rounds replay (registry `RETIRED_TYPES`, `registry.ts:151-175`). Removing them would break rules 4 and 5.
- **What:** the same applies to the older retired games: rooftop, swerve, dual, steady, hotfloor, dig (233 KB with its bank), junction and wordfall (394 KB with its dictionary).
- **What:** the 14 Oct deletion left no stray references; the 19 removed ids appear only in `removedGames.ts`.
- **Options:**
  - Keep them as they are.
  - Move them to "replay only": drop them from Practice and keep the sims for reveals and replays. That saves no code, because the reveal replays need the sims.
  - The one real saving: once C1 lands, their stages share the loop.
- **Decision:** Joe's.

### C7. 3,475 unused exports (mostly sim constants)
- **Where:** about 2,300 are in `src/lib/arcade`; the most are in `cross.ts` (70), `breaker.ts` (65), `binToss.ts` (62) and `homerun.ts` (62). About 830 are in `src/lib/duel`, 51 of them in `types.ts`.
- **What:** knip also reports 49 pairs of exports that are the same value under two names, for example `CLAY_REV_TALL = CLAY_REV`, `ALLEYROLL_REV_RINGER = ALLEYROLL_REV_DEALT` and `BEAT_V5_BAND_CURVE = BEAT_V6_BAND_CURVE`.
- **Why it can wait:** most are revision constants kept for documentation and checks. Removing `export` changes nothing at runtime and would churn every sim.
- **Action:** don't mass-remove. Add knip (as a `bunx` call in a fast check, no package.json change) only for new files.

### C8. CSS spread over nine root folders
- **What:** 81 CSS files and about 16,100 lines, in `src/styles.css` (1,971 lines, 32 `@import`s) plus `polish-b`, `polish-batch-p`, `polish-depth-d6`, `polish-layout` (40 files), `polish-logic`, `polish-pattern`, `polish-speed`, `src/design` and stray component CSS.
- **What:** there are 946 raw hex colours outside `tokens.css` (design-lint warns but doesn't fail on old ones) and 184 `!important` (`styles.css` 54, `batch-p.css` 13).
- **Action:** move the `polish-*` folders under `src/styles/{app,game,category}/` and burn down hex colours file by file with design-lint's counts.
- **Effort:** M. **Risk:** medium (cascade order).
- **Proof:** theme-check, no-wrap-check, design-lint-check. In CI: bottom-clearance, safe-area-screens, screen-bottom and celebrations-off.

### C9. Canvas font stacks naming faces that are never loaded
- **What:**
  - `Fredoka`, `Nunito`: `arcadeFx.renderer.ts`, `wordfall.renderer.ts`;
  - `Space Grotesk`, `Inter`: `tenDrop.renderer.ts`;
  - `Duelz Mono`: `freekick`, `homerun`, `minesweeper`, `racing`, `sportsHud` renderers;
  - `Saira`: see A3.
- **What:** `arcadeChart.ts:115` sizes chart names with a per-character width measured for Manrope (`NAME_CHAR_PX = 8.8`) while the chart now draws in Archivo.
- **Why it's minor:** game art is outside the design lint by design, and every stack falls back to Archivo or system UI. The chart width is a possible early-ellipsis nit, not a bug report.
- **Proof:** arcade-chart-check, art-check.

### C10. Root scratch files
- **What:** `fix.py`, `check_example.ts`, `m.md`, `mem/` and `roadmap.md` are Lovable's notes per CLAUDE.md. `src/integrations/supabase/cron-auth.ts` is Lovable-generated and unused today ("Do not edit").
- **Action:** leave them; they belong to Lovable. Ask Lovable to clear the scratch files when convenient.

---

## Not found (good news)

- **No TODO, FIXME or HACK comments** in app code (banks and data files excluded).
- **No `debugger`, and no commented-out code blocks.** I scanned for runs of three or more commented code lines and found none.
- **Removed games are clean.** No reference to the 19 games deleted on 14 Oct exists outside `removedGames.ts`.
- **The F2 class removal is complete.** No `.th-btn-*`, `.ap-btn-*`, `.rs-btn*`, `.th-input`, `.th-chip` or `.rs-*` classes survive. `ap-chip-grid` is a layout class, and `--ap-input` is a token alias.
- **Sounds are complete.** Every `public/sounds` file is referenced; sound-manifest-check already proves it.
- **Dev routes are gated.** `/replay-lab`, `/dev-crash` and `/dev-design` throw `notFound()` outside development.
- **Client-side imports of server files are type-only** (`replay.server` types, `grade.ts` types).

## Suggested order

1. **Group A as one or two PRs.** A1–A8, A10 and A11 together are fast checks only. Then A9 and A12 with Joe.
2. **B1, after Joe confirms the live schema.** It sets the baseline for everything else.
3. **B7, the folder homes.** Then B2 and B8 together, table by table.
4. **B3 and B5.** Small, and directly needed by ratings and accounts.
5. **B4 and B6.** The big ones; B4's `dealtSignature` is the rating-epoch key.
6. **Group C as capacity allows.** Start with C4 and C3. Leave C1 and C2 for a quiet week, since they carry the most replay risk.

## Appendix: reproducing the numbers

```bash
# knip, whole graph (scripts as entries); config kept outside the repo
cat > /tmp/knip.json <<'EOF'
{ "entry": ["src/routes/**/*.tsx","src/router.tsx","src/server.ts","src/start.ts","scripts/**/*.{ts,tsx}","vite.config.ts",".github/ci/*.ts"],
  "project": ["src/**/*.{ts,tsx}","scripts/**/*.{ts,tsx}"], "ignore": ["src/routeTree.gen.ts"] }
EOF
bunx knip@5 --config /tmp/knip.json --no-progress
```

```bash
bunx madge@8 --circular --extensions ts,tsx --ts-config tsconfig.json src
```

For the app graph, drop `scripts/**` and `.github/ci/*.ts` from both lists. Neither tool touches `package.json` or `bun.lock`. I checked: `git status` was clean after both runs.
