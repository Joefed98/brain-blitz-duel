# Code audit 4: build health, dependencies and checks

7 Nov 2026, on `main` at 34272737. This is a read-only audit: nothing in the app, the checks or CI changed. No browser
check was run locally. The evidence comes from:

- `bun outdated` and `bun audit` (bun 1.4.4);
- `tsc` over `src/`, and separately over `scripts/` through a temporary tsconfig kept outside the repo;
- `eslint .`;
- grep over the source;
- the GitHub Actions history for the 26 non-skipped Full suite runs from 6–7 Nov 2026 and the last 60 Checks runs from
  4–7 Nov;
- the per-check times of the latest green pair (Checks run 42372376743 and Full suite run 42372376764, PR branch
  `claude/quirky-fermi-frw0k0`, 7 Nov).

Effort: **S** under half a day, **M** one to three days, **L** a week or more. Benefit: **H** / **M** / **L**.

---

## The ranked list

### Do before the Supabase move

| # | Item | Effort | Benefit |
|---|---|---|---|
| 1 | Reconcile the three migration records: 43 in `supabase/migrations`, 13 in `drizzle/migrations`, and "written but not applied" notes in CLAUDE.md | S | H |
| 2 | Regenerate `src/integrations/supabase/types.ts` from the live schema and diff it against the migrations | S | H |
| 3 | Add a check that runs the room server functions' handlers (`duel.functions.ts`) against the local PostgreSQL the four SQL checks already start, with auth, host-only rules and RLS | L | H |
| 4 | Make `recordInputType` failures visible, and test the `input_type` write path end to end | S | H (ratings) |
| 5 | Patch-level upgrades that clear runtime advisories: `seroval` (through `@tanstack/react-router`), `vite` ≥ 8.1.6, `happy-dom` ≥ 21.0.4 | S–M | M |
| 6 | Add `tsc --noEmit` for `src/` to the fast Checks workflow. It passes clean today, so the gate costs nothing | S | M |

### During the build waves

| # | Item | Effort | Benefit |
|---|---|---|---|
| 7 | Fix the four recurring browser flakes: battery-check on Box Six, offline-check's worker takeover, the desktop frame-time limit, and replay-board/replay-play timing | M | H (CI minutes, trust in red) |
| 8 | Fix the dev-server heap root cause (the "first-deal compile spike") and then remove the three 4 GB stopgaps | M | M |
| 9 | Remove the ~40 unused dependencies (Lovable's shadcn starter set) | S | M |
| 10 | Rebalance the `g` catch-all shard: 155 checks in 805 s, 137 of them not listed in `shards.ts` | S | M |
| 11 | Type-check `scripts/` (1,235 errors in 342 files today), starting with the files that are not TS4111 noise | M | M |
| 12 | Fold the per-revision legacy checks into the one self-replay or standard roster where they duplicate it | M–L | M |
| 13 | Make ESLint usable: scope it, cache it, and put it in CI as warn-only first | S | L–M |

### Later

| # | Item | Effort | Benefit |
|---|---|---|---|
| 14 | Major upgrades with no reason to stay put: `zod` 3→4, `lucide-react` 0.x→1.x, `eslint` 9→10 and its plugins, `@vitejs/plugin-react` 5→6, `globals`, `@types/node` | M | L |
| 15 | Delete the 7 unreferenced scripts. Audit `scripts/` subfolders and the old batch tools | S | L |
| 16 | Move the deprecated `createServerFn().inputValidator()` calls to `.validator()` | S | L |
| 17 | Bump CI actions that run on Node 20 (`actions/cache@v4`, `actions/upload-artifact@v5`) | S | L |
| 18 | Repo weight: `.git` is 845 MB and `scripts/fixtures` 26 MB | M | L |

The detail and evidence for each item follow.

---

## 1. Dependencies

### 1.1 Vulnerabilities (`bun audit`)

`bun audit` reports **30 advisories: 1 critical, 16 high, 12 moderate, 1 low.** Grouped by whether they ship to players:

| Package (version) | Reached through | Ships to players? | Note |
|---|---|---|---|
| `seroval` 1.6.8 | `@tanstack/router-core` | **Yes**: SSR serialisation of loader and server-function data | 2 moderate: code and script injection in serialised output (fixed in 1.6.11). We serialise our own data, but this is the one runtime-path advisory worth taking first. It needs a TanStack Router or Start patch bump. |
| `zod` 3.25.76 and 4.6.5 | direct, plus `@hookform/resolvers` and `@tanstack/router-generator` | 3.x: no direct import in `src/` or `scripts/`; 4.x is build-time | high: memory exhaustion on oversized collections (< 4.6.6) |
| `vite` 8.1.5 | direct | dev server only | low and moderate: fs.allow bypass and middleware cross-origin; plus `launch-editor` |
| `happy-dom` 20.14.5 | direct (checks only) | no | 3 advisories, 2 high (SSRF; host code execution through an import alias). It only parses our own markup, so risk is low, but it is a direct dependency with a fix (21.0.4+). |
| `shell-quote` 1.10.0 | `@lovable.dev/vite-tanstack-config` → devtools → `launch-editor` | no (dev) | **critical**: command injection in `quote()`. Only a Lovable config bump fixes it. |
| `brace-expansion`, `minimatch`, `js-yaml` | eslint, typescript-eslint, start-plugin-core | no (tooling) | DoS-class |
| `esbuild` 0.18 / 0.25 / 0.28, `nanoid`, `source-map-js` | drizzle-kit, vite→tsx, postcss | no (build) | |

Nothing on this list is exploitable by a player from the live app except, at a stretch, `seroval`. The critical one is
dev tooling inside Lovable's own config package. `bun audit fix` would rewrite `bun.lock`, which CLAUDE.md forbids
outside Lovable, so every bump in this section has to go through Lovable (or Joe's say-so) and the 24 h
`minimumReleaseAge` guard.

### 1.2 Unused packages

I grepped `src/`, `scripts/`, `.github/`, `vite.config.ts` and `drizzle.config.ts` for imports of each `package.json`
entry (and for CSS `@import`s). **None of these is imported anywhere:**

- **Radix (23 of 25):** accordion, alert-dialog, aspect-ratio, avatar, checkbox, collapsible, context-menu, dialog,
  dropdown-menu, hover-card, label, menubar, navigation-menu, progress, radio-group, scroll-area, select, separator,
  switch, tabs, toggle, toggle-group, tooltip. `react-dialog` is still installed as `vaul`'s own dependency.
  `src/components/ui/` is down to `button`, `popover` and `slider` (F2, 6 Nov).
- **Other runtime packages:** `@hookform/resolvers`, `react-hook-form`, `cmdk`, `date-fns`, `embla-carousel-react`,
  `input-otp`, `react-day-picker`, `react-resizable-panels`, `recharts`, `sonner`, `zod` (no direct import; server
  functions validate inline).
- **Dev packages:** `drizzle-orm` (only the empty `drizzle/schema.ts`: "auto-generated and intentionally left blank")
  and `postgres` (the SQL checks call the `initdb` / `psql` binaries instead).
- **Keep:** `nitro`, `vite-tsconfig-paths`, `@tanstack/router-plugin` and `tailwindcss` are wired in by
  `@lovable.dev/vite-tanstack-config` (its header comment says so). `tw-animate-css` and `tailwindcss` are CSS imports in
  `styles.css`. `drizzle-kit` is probably Lovable's (`drizzle.config.ts` reads `LOVABLE_DB_MIGRATION_URL`).

Benefit: a smaller install and lockfile, fewer advisories (`recharts` and `react-day-picker` alone carry a large tree),
and less starter-kit noise for the next reader. Removing them changes `bun.lock`, so Lovable has to make the change (ask
it to "remove unused dependencies"), not a Claude branch.

### 1.3 Duplicated packages

The audit's dependency paths show several packages installed at more than one version:

- `zod` 3.25.76 (ours) beside 4.6.5 (TanStack's router-generator);
- `esbuild` at 0.18.20, 0.25.12 and 0.28.2;
- `minimatch` at 3.1.5 and 10.2.6;
- `brace-expansion` at 1.1.16 and 5.0.8.

Only the `zod` pair is ours to fix: dropping or upgrading our unused `zod` 3 leaves one copy. The rest are transitive
and harmless.

### 1.4 Outdated (`bun outdated`) and old majors

- **Most packages** are one minor behind (Radix, React 19.2.8 → 19.3.1, supabase-js 2.116 → 2.119, Tailwind 4.3.3 →
  4.3.5, playwright 1.64 → 1.65).
- **Pinned on purpose:** `@tanstack/react-router` 1.170.41, `react-start` 1.168.60, `router-plugin` 1.168.42 and
  `vite` 8.1.5 are exact pins, apparently to match Lovable's config, which pins `vite`.
- **Pinned in effect:** `nitro` 3.0.260603-beta is a dated beta; rc 3.0.261103 exists. The `"rolldown": "1.2.1"`
  override has no comment explaining why.
- **Old majors with no stated reason:**

| Package | Have | Latest | Reason to stay? |
|---|---|---|---|
| `zod` | 3.25 | 4.6 | none (unused); remove rather than upgrade |
| `lucide-react` | 0.575 | 1.70 | used only in game boards now (icon swap 2); a 1.x bump is a rename check |
| `recharts` | 2.15 | 3.10 | unused; remove |
| `react-day-picker` | 9 | 10 | unused; remove |
| `@hookform/resolvers` | 5 | 7 | unused; remove |
| `eslint` / `@eslint/js` | 9 | 10 | none, but see item 13 first |
| `eslint-plugin-react-hooks` | 5.2 | 7.1 | 7.x adds the React Compiler rules; worth having |
| `@vitejs/plugin-react` | 5 | 6 | probably follows Lovable's config |
| `globals` | 15 | 17 | none |
| `@types/node` | 22 | 26 | bun runs the scripts; pin to the Node CI uses |
| `postgres` | 3 | 4 | unused; remove |
| `typescript` | 5.9 | 7.0 | TS 7 is the native port; wait until tsc and typescript-eslint both support it |
| `drizzle-kit` / `drizzle-orm` | `0.x` range | | a floating range is unusual next to the exact pins; leave for Lovable |

---

## 2. The check suite

### 2.1 Size and time per shard

The repo has 349 `scripts/*-check.ts(x)` files. The latest green pair ran **321 rows on the fast Checks workflow and 67
rows on the Full suite**; a split check counts once per part, and every row passed. Seconds are the sum of the check
times in each job's summary table. Job wall time adds about 30 s of setup to a fast job and about 1–2 min (setup plus
browser install) to a play job.

**Checks (every push), run 42372376743:**

| Shard | Checks | Check time | Job wall |
|---|---|---|---|
| a | 21 | 298 s | 5.0 min |
| b | 36 | 497 s | 8.3 min |
| c | 27 | 334 s | 5.6 min |
| d | 25 | 525 s | 8.8 min |
| e | 30 | 641 s | 10.7 min |
| f | 27 | 495 s | 8.3 min |
| **g (catch-all)** | **155** | **805 s** | **13.4 min** |
| **Total** | **321** | **60 min** | ~13.5 min wall (parallel) |

**Full suite (at ready-to-merge), run 42372376764:** 25 jobs and 67 check rows, 9.4–14.8 min each. Averages over the
last 16 runs: play25 14.8, play13 14.5, play4 14.3, play5 14.0, play24 13.7, play17 13.7 … play21 7.0 min; the worst
single job took 28.2 min (play24). The run sums to about **300 job-minutes, five times the fast workflow**. On the free
plan's 2,000 minutes a month, that is about six or seven Full suite runs before anything else runs.

### 2.2 The slowest checks

| Check | Shard | Time |
|---|---|---|
| arcade-play-desktop-check @2/2 | play25 | 707 s |
| arcade-play-desktop-check @1/2 | play24 | 691 s |
| arcade-play-check @4/5 / @3/5 / @2/5 / @1/5 / @5/5 | play4/3/2/1/5 | 437 / 387 / 383 / 339 / 319 s |
| desktop-layout-check @1/3 | play22 | 428 s |
| safe-area-screens-check | play4 | 406 s |
| theme-check | play16 | 396 s |
| bottom-clearance-check (8 parts) | play6–13 | 250–307 s each, ~2,160 s in all |
| desktop-geometry-check | play14 | 279 s |
| first-paint-check | play3 | 268 s |
| arcade-fill-check @1/3, @3/3 | play11, 13 | 250, 228 s |
| offline-check | play20 | 229 s |
| app-shell-check | play15 | 223 s |
| celebrations-check | play13 | 220 s |
| *fast:* arcade-self-replay-check @2/2, @1/2 | b, a | 156, 113 s |
| *fast:* orbit-camera-check | e | 109 s |
| *fast:* puzzle-bank-check @4/4 | e | 102 s |

The two desktop halves are each within about 10 s of their own shard's job budget, and they are the two flakiest by
frame time (2.3).

### 2.3 Checks that needed re-runs

- **Fast workflow:** no re-runs at all in its last 60 completed runs. All seven failures were real failures fixed by the
  next push.
- **Full suite:** 8 of its 26 non-skipped runs on 6–7 Nov needed a second attempt (`run_attempt` 2). Six of those
  passed on the re-run with no code change:

| Check | Shard | Times | Failure (verbatim) | Kind |
|---|---|---|---|---|
| battery-check | play21 | 2 (runs 42272363340, 42232396172) | `FAIL idle puzzle between moves (Box Six): 1.2 rAF fps … (at most 1)` | limit on the edge, or an occasional extra frame on Box Six |
| offline-check | play20 | 2 (42341236401, 42332474095) | `FAIL timed out: the new worker takes over on the list` then `reload: net::ERR_ABORTED; maybe frame was detached?` (offline-check.ts:681) | race in the worker-update step |
| arcade-play-desktop-check | play24, play25 | 2 (42220904054, 42292194349) | `breaker … mean frame 18.5 ms … limit 18.3 ms`; `rally … 20.5 ms` | frame time on a shared runner |
| replay-play-check | play5 | 1 (42341236401) | `stroop: 2x plays 87 ticks a second (120 expected)` | CPU starvation |
| replay-board-check | play19 | 1 (42337324408) | `FAIL Heave (push): ended on frame 64, want 77`; `Hanoi … 32, want 33` | time-lapse cut short under load |
| arcade-lowend / arcade-device-bottom @1/8 | play5, play1 | run 42227318645 (both attempts on play1) | `Allocation failed - JavaScript heap out of memory | heap used 1866 MB of a 2240 MB limit` | dev-server OOM before the 4 GB stopgap; not seen since 6 Nov 18:38 |

One more failure, share-check on play17 (5 of 282), failed the same way on both attempts of run 42220904054
(`welcome (414x896 app): the line is not its two set lines`). That was a real regression on that branch, not a flake.

**About a quarter of Full suite runs pay for a second attempt** (~12–15 job-minutes for a one-shard re-run, ~300 when
the whole run is re-run). Worse, a red Full suite has stopped meaning "broken". CLAUDE.md has no flaky list. Its only
retry rule is `scripts/browser-load.ts` (a page load that timed out is retried once), and "Never loosen the limits to
get green" rules out the easy fix. What the four flakes need instead:

- **battery-check:** measure over a longer window, or count frames after the first idle second, rather than raise the
  1 fps limit;
- **offline-check:** wait on `controllerchange` before the reload;
- **the frame-time checks:** compare against the CI baseline as a ratio over two samples;
- **replay-play / replay-board:** judge the end state rather than the tick rate, or pin CPU with
  `Emulation.setCPUThrottlingRate`, as arcade-lowend does.

Each change should keep what the check proves.

### 2.4 Overlapping checks

- **Per-revision legacy checks.** 51 checks are named for a batch, tuning, revision or standard (for example
  `arcade-tuning-{a,c,e,f,f2,g1,g2,g3}`, `arcade-batch{1..5}`, `snake-rev10`/`rev12`/`standard`, `tilt-expand`/`rev11`/
  `rev12`/`standard`, `gemstone-rev10`/`rev12`/`standard`). Each one proves "older stamps replay and score as before"
  on its own fixture for the games it touched. `arcade-self-replay-check` (461 roster lines) and
  `arcade-standard-check` (`STANDARD_ROSTER`) already prove the same for every game. Snake alone is replayed by at
  least four checks.
  - They are not pure duplicates: each pins fixtures recorded on the main of its day, and some assert batch-specific
    rules. Never delete an assertion (CLAUDE.md working rule 5).
  - The safe direction is to move each check's fixtures and rule asserts into the roster entry for its game, one game
    at a time, so each game has one legacy proof.
  - Benefit: a few minutes of fast CI, and one place to look when a replay breaks.
- **The layout family.** bottom-clearance, arcade-device-bottom, arcade-play (its layout proof), arcade-room-practice,
  arcade-fill, screen-bottom and safe-area-screens each start a dev server and measure the arcade play column's bottom
  16 px on an emulated iPhone 11 home-screen app. CLAUDE.md says so in as many words: "arcade-play-check and
  bottom-clearance-check measure every arcade play screen as an iPhone 11 home-screen app once more the same way".
  Together they are about 75 of the ~300 Full suite minutes. One shared geometry pass, run once per game, whose results
  each check reads, would keep every assertion and cut much of the dev-server start and page-load time.
- **The desktop checks.** arcade-play-desktop-check (both halves, 23 min) replays all arcade games at desktop sizes.
  desktop-layout-check and desktop-geometry-check then draw many of the same screens again.

### 2.5 The 4 GB heap stopgaps

There are three places that set `--max-old-space-size=4096`:

- `.github/workflows/full-suite.yml:170` (6 Nov 2026), for every browser check's vite dev server. Its comment calls
  it "a stopgap … The dev-only first-deal compile spike behind it stays on the later list";
- `scripts/app-shell-check.ts:91`;
- `scripts/arcade-play-check.ts:305`.

Evidence that the spike is real and steady:

- On green jobs the dev-server capture shows the heap at **1,918–1,929 MB used of 2,181–2,217 MB allocated** at exit
  (play5, play19, play20, 7 Nov). That is just under Node's old 2,240 MB default limit, which is why the OOMs began.
- The `tsc` pass over `scripts/` hit the same wall locally (`FATAL ERROR: … JavaScript heap out of memory` at 2,042 MB)
  and needed a 6 GB heap.
- The dev server's log is full of `createServerFn().inputValidator() is deprecated` warnings while it compiles
  `practice.functions.ts` and `introDemo.functions.ts`. Those modules pull in every game's generator and bank, a large
  graph in the SSR module runner.

The likely culprits are the eager bank and data imports reached from `practice.functions.ts` (for example
`unblockBank.server.ts`, the tile and word banks, `*Deal*.server.ts`). Lazy `await import()` of each game's generator,
in the one dispatch place, would shrink both the dev compile and the production server bundle. Measure first with
`--heap-prof` on one dev-server start. Runners have 7.7 GB and each job runs one dev server at a time, so 4 GB is safe
for now. Treat it as a ceiling to get back under, not a new normal.

---

## 3. Coverage: important code that no check runs

This is the gap that matters most before the Supabase move and a rating system. The suite is very thorough about
*pure* logic (generators, sims, grading, scoring, replays) and very thin about *the server's I/O and auth*.

- **Room server functions never run.** `src/lib/duel/duel.functions.ts` is 1,192 lines with 22 `createServerFn`s:
  `createRoomFn`, `joinRoomFn`, `startRoomFn`, `advancePhaseFn`, `submitAnswerFn`, `rematchFn`, `continueFn` and the
  rest.
  - 15 checks read it **as text** with regexes.
  - The one check that imports it (`app-update-check.tsx`) replaces it with a mock.
  - So none of these is ever executed: the `requireSupabaseAuth` middleware, the host-only rules
    (`room.host_user_id !== context.userId`, lines 470 and 562), the phase guards, or the real reads and writes.
- **The pieces under it are covered:**
  - `roomGrade.server.ts` (8 checks);
  - `roomPhase.server.ts` (`setPhase`, `finishGame`, on fake clients);
  - `roomSettings.server.ts`;
  - `roomFlow.ts`, `roomClose.ts`;
  - `scoringMode.ts` (room-scoring only);
  - `historyWinner.server.ts` and `duelOutcome` (tie-break, room-scoring, dropout-finish);
  - `standings` (named in 32 checks).
- **Async rooms, daily and challenges:** `asyncRoom.functions.ts` (178 lines), `challenge.functions.ts` (235) and
  `daily.functions.ts` (99) have no check at all. `asyncRoom.server.ts`, under them, is covered by challenge-check and
  daily-check. The calls' ownership rules ("one attempt per device", "the board only once they finish") are proved only
  in the engine, not at the function boundary.
- **Chat:** `chat.functions.ts` (161 lines), no check.
- **Replay → stored score:** all 55 exported `replay*Run` functions are named in a check, and `arcade.server.ts` is
  imported by 38. But no check runs the end-to-end server path from receiving an input log, to replaying it, to writing
  the score row. The exception is standard-live-check, on a production build in Chromium, for the standard games only.
  `arcadeRun.ts` (144 lines) has no direct import.
- **Data that ratings will read:**
  - `input_type`: only beta-recording-check asserts it, as SQL against local PostgreSQL. `recordInputType`
    (`inputType.server.ts`) is never called by a check and swallows its errors ("best effort"), so a broken write would
    vanish silently. For ratings that split touch from mouse, that write has to be reliable and visible.
  - `round_results` is named in 12 checks, but no check proves the room path writes one row per active player per
    round under concurrent submits. Nothing runs two submits, or a submit racing a rematch, against a real database.
    The 26 checks that mention a race or `FOR UPDATE` reason about source text.
  - RLS: the four SQL checks (beta-recording, challenge, daily, player-looks) apply **every** migration to a local
    PostgreSQL 16 and test policies with `SET ROLE` for their own tables only. `round_results`'s read policies are
    checked as text (reveal-window-check). If the PostgreSQL binaries are missing, all four fall back to "SQL checked as
    text only" and still pass.
- **Server files with zero direct check imports:** 52 of the 185 `*.server.ts` / `*.functions.ts` files under
  `src/lib/duel/`. Most are reached one level away (word lists, standard graders). Unreached at any depth:
  - the `*.functions.ts` files above, plus `introDemo.functions.ts` (267 lines);
  - `unblockBank.server.ts` (409);
  - `logicDepth.server.ts`, `wordCheck.server.ts`;
  - nine small `depth/*.server.ts` files.
  - `rateLimit.server.ts` is reached one level away, but no check names it.

**The recommendation (item 3)** is a "server-function harness". Run the real handlers of `duel.functions.ts` and the
async-room, challenge and daily functions against the local PostgreSQL those four checks already set up, with two or
three signed-in test users. Assert:

- auth and host refusals;
- one result row per player per round;
- the stored score equals a replay of the stored log;
- `input_type` is written;
- concurrent submits converge.

That is the check a Supabase move most needs: it would fail the day a migration, policy or client call drifts.

---

## 4. Tooling

### 4.1 TypeScript

- **`tsconfig.json` is strict and then some:** `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
  `noPropertyAccessFromIndexSignature`, `noImplicitReturns`, `noImplicitOverride`, `noFallthroughCasesInSwitch`,
  `noUncheckedSideEffectImports`. Only `noUnusedLocals` and `noUnusedParameters` are off.
- **`src/` type-checks clean:** `tsc --noEmit` reports 0 errors in 38 s. `src/` has no `@ts-ignore` or
  `@ts-expect-error`, 1 `@ts-nocheck` (the generated `routeTree.gen.ts`) and 139 `any` annotations or casts.
- **But no workflow runs `tsc`.** `grep tsc .github/workflows` finds nothing. Lovable's build (vite) strips types
  without checking them, so a type error can reach `main` and stay. Adding `bunx tsc --noEmit` as a fast-shard step
  is about 40 s (item 6).
- **`scripts/` (938 files, 177k lines) is outside `include`** and has never been type-checked. Under the same options
  it reports **1,235 errors in 342 files**:
  - 715 are TS4111 (dot access on an index signature), which is a style rule;
  - the rest are mostly `possibly undefined` (TS18048, TS2532, TS2345) and `exactOptionalPropertyTypes` (TS2379);
  - a few are real wrong-type calls (TS2339 missing property ×42, TS2352 bad cast ×40), and `bun:test` types are
    missing.
  - bun runs these files without checking, so a check's own bug shows up only as a confusing failure.
  - Suggested route (item 11): a `scripts/tsconfig.json` without `noPropertyAccessFromIndexSignature` (clears the 715),
    then fix the remaining ~520 a folder at a time, and gate new files only (as design-lint does).

### 4.2 Lint

- The ESLint config (`eslint.config.js`) is Lovable's starter: `js` and `typescript-eslint` recommended, react-hooks 5's
  rules, react-refresh as a warning, `@typescript-eslint/no-unused-vars` off, and Prettier as a lint rule.
- It ignores only `dist`, `.output` and `.vinxi`, so `eslint .` lints all of `scripts/` and `screenshots/` too.
  **A local `eslint .` had not finished after more than 10 minutes**, and no workflow runs it. In practice there is no
  lint.
- What does run is `design-lint-check` (`scripts/design-lint.ts`), the project's own rule set for colours, fonts and
  keyframes, which gates added lines. That pattern (fail on new problems, warn on old ones) is the one to copy.
- Suggested route (item 13):
  1. scope ESLint to `src/`;
  2. drop the Prettier-as-lint plugin, which is slow and noisy, and run `prettier --check` separately or not at all;
  3. add `--cache`;
  4. turn on `no-unused-vars` as a warning;
  5. upgrade to react-hooks 7, whose `exhaustive-deps` and purity rules catch the class of bug behind battery work such
     as "a fresh `dangerouslySetInnerHTML` object on render";
  6. run it warn-only on changed files in the fast workflow.

### 4.3 Scripts that are no longer used

- `scripts/` has 328 top-level entries that are not checks, plus 19 subfolders, which I did not scan.
- **7 files are not referenced anywhere** (scripts, `.github`, `docs`, CLAUDE.md, AGENTS.md, `package.json`): `dig-bank.ts`,
  `flip-x200-bands.ts`, `number-pyramid-bank.ts`, `orbit-bank.ts`, `snip-crook-design.ts`, `tilt-standard-record.ts`,
  `trail-bank.ts`. All were last committed on 31 Oct 2026. The match was a loose substring search, so the true count
  is probably higher.
- Dig is retired and Snip (Scrumper) is practice only. Their bank builders may still be wanted to rebuild a bank
  byte for byte, so check before deleting.
- The many one-off `*-legacy-record.ts`, `*-bands.ts` and `shots/*` tools are referenced from docs and are intended
  to stay.
- `package.json`'s scripts are only `dev`, `build`, `build:dev`, `preview`, `lint` and `format`. `lint` takes over 10
  minutes (4.2) and `format` would reformat the repo. Neither is used.

### 4.4 Other findings

- **Deprecated API.** Every dev-server start logs `createServerFn().inputValidator() is deprecated. Use
  createServerFn().validator() instead` (for example at `practice.functions.ts:406` and `introDemo.functions.ts:52`).
  It is harmless today and will break on a future TanStack major (item 16).
- **CI actions on Node 20.** `actions/cache@v4` and `actions/upload-artifact@v5` are forced onto Node 24 with a warning
  in every job (item 17).
- **The g catch-all.** It holds 155 checks and runs 805 s, against 300–640 s for a–f. 137 of its checks are not listed
  in `shards.ts` ("Not listed in this shard … ran here: alleyroll-check.ts, arcade-chart-check.ts, …"). This is the
  same drift the 3 Nov rebalance fixed once. Moving ~5 min of its largest checks to `a` and `c` (the lightest shards,
  298 s and 334 s) brings the fast workflow's wall time from 13.4 to about 10 min (item 10).
- **Repo weight.** `.git` is 845 MB; `scripts/fixtures` holds 213 files and 26 MB. CI's `actions/checkout` takes 15–20 s
  a job, across 32 jobs (item 18; low priority).

---

## 5. Before the Supabase move: the migration records disagree

This is item 1. It is not strictly build health, but it is the first thing the move will trip on.

- **`supabase/migrations/` has 43 files.** That is 25 UUID-named Lovable migrations from 9 Sep to 5 Oct, plus 18
  named ones written in this repo. CLAUDE.md marks many of the latter "**written but not applied**":
  - `20261017120000_player_colour_icon`
  - `20261017140000_player_submitted_round`
  - `20261021120000_beta_share_events`
  - `20261021130000_async_rooms_daily`
  - `20261022120000_friend_challenges`
  - `20261023120000_beta_terms_events`
  - `20261031150000_room_16_players`
  - `20261031170000_result_input_type`
  - `20261107120000_room_code_digits`
  - `20261108120000_room_scoring_mode`
- **`drizzle/migrations/` has 13 numbered files** (`0000_rate_limits` … `0012_room_scoring_mode`) plus `meta/`. They
  were last changed by Lovable on 7 Nov ("Changes"). Their names suggest this is Lovable's record of what it has
  applied. That record includes several migrations CLAUDE.md calls unapplied (player colour, submitted round, share
  events, async rooms, friend challenges, terms, room scoring mode), but not `room_16_players`, `result_input_type`
  or `room_code_digits`.
- **`src/integrations/supabase/types.ts`** (1,190 lines, generated) already names `async_rooms`, `challenges`,
  `share_events`, `terms_events`, `scoring_mode` and `input_type`.

So the three sources disagree, and CLAUDE.md's "not applied" notes are probably stale for at least seven migrations.
Before moving:

1. Have Joe or Lovable export the live schema and its migration history.
2. Diff that against both folders and against `types.ts`.
3. Correct CLAUDE.md's notes.
4. Write down which folder is the source of truth after the move.

Also note that `20261108120000_room_scoring_mode.sql` is dated tomorrow (8 Nov). Lovable's copy is the undated
`0012_room_scoring_mode.sql`, so it should sort correctly, but a dated file in the future can surprise a migration tool
that orders by name and compares with the clock.

---

## What was run

| Step | Result |
|---|---|
| `bun outdated` | ~70 packages behind; table above |
| `bun audit` | 30 advisories (1 critical, 16 high, 12 moderate, 1 low) |
| `npx tsc --noEmit` (src) | pass, 0 errors, 38 s |
| `tsc` over `scripts/` (temporary tsconfig outside the repo, 6 GB heap) | 1,235 errors in 342 files; OOM at the default heap |
| `npx eslint .` | did not finish within 10 minutes |
| GitHub Actions history | 26 Full suite runs and 60 Checks runs read; per-check times from runs 42372376743 and 42372376764 |
| Browser checks | none run, as asked |

No check was run, since nothing changed.
