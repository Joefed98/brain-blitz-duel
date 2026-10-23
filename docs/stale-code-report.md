# Stale code report

23 Oct 2026. A report only: **nothing was deleted or changed** apart from adding this file.

## Method

- **knip 5** (`bunx knip@5`, run with a throwaway config in the session's scratch folder, never added to
  `package.json` or `bun.lock`). Entry points: every file in `src/routes/` (TanStack file routes),
  `src/router.tsx`, `src/start.ts`, `src/server.ts`, `vite.config.ts`, `.github/ci/*.ts` and every file in
  `scripts/` (so anything a script or check imports counts as used). Reported: unimported files, unused exports and
  types, duplicate exports, unused dependencies.
- **ripgrep** for confirming each candidate: imports, string paths (`import.meta.glob`, fixture paths read by
  checks, `public/` URLs), and mentions in `docs/`, `CLAUDE.md`, the `AGENTS.md` files and `.lovable/`.
- An "unused export" was counted **dead** only when its name appears **once** in all of `src/`, `scripts/`,
  `.github/` and `vite.config.ts` (its own declaration). knip's wider list (exports only used inside their own file)
  is summarised, not listed.
- Kept by rule, whatever the tools say: route files, `routeTree.gen.ts`, `supabase/migrations/`, `drizzle/`
  (Lovable), every `scripts/*-check.ts(x)` (run by the catch-all in `scripts/run-checks.ts`), retired games
  (`RETIRED_TYPES`, `removedGames.ts`) and anything an older version stamp can still reach (rule 2: older rounds must
  replay and score as before).

Risk: **safe** = no reference found anywhere, deleting cannot change the app or a check; **check first** = no code
reference but a plausible reason to keep it (history, a design tool, Lovable, a stamp); **keep** = used or kept by rule.

## 1. Unimported source files

knip found 47 unimported files under `src/`. rg confirms no import, glob or string path for any of them.

| Path | Why it looks unused | Evidence | Risk |
|---|---|---|---|
| `src/components/ui/*.tsx` (43 files: accordion, alert, alert-dialog, aspect-ratio, avatar, badge, breadcrumb, calendar, card, carousel, chart, checkbox, collapsible, command, context-menu, dialog, drawer, dropdown-menu, form, hover-card, input, input-otp, label, menubar, navigation-menu, pagination, progress, radio-group, resizable, scroll-area, select, separator, sheet, sidebar, skeleton, sonner, switch, table, tabs, textarea, toggle, toggle-group, tooltip) | Lovable's shadcn scaffold; the app draws its own screens | knip: unused file; rg finds imports only between these files (chart → tooltip, sidebar → sheet/tooltip/use-mobile) | safe (low value: Lovable may use them again) |
| `src/hooks/use-mobile.tsx` | Only `ui/sidebar.tsx` (itself unused) imports it | knip: unused file; rg `use-mobile` | safe (with sidebar) |
| `src/components/puzzles/BarOverlay.tsx` | A controls bar over a letterboxed arcade canvas; replaced by `ArcadeArenaSlot` (15 Oct play screen) | knip: unused file; rg `BarOverlay`: only the file itself, no doc mention | safe |
| `src/puzzles/words.ts` | Old shared word banks (`SEVEN`…) from before the SCOWL dictionary (`dictionary.server.ts`, `commonWords.server.ts`) | knip: unused file; rg for `puzzles/words` / `./words` imports: none | check first (word lists; confirm no retired generator wants them) |
| `src/integrations/supabase/cron-auth.ts` | Header says "automatically generated" by Lovable; no cron route uses it | knip: unused file; mentioned in `docs/security-audit-oct-2026.md`, `docs/migration-readiness-oct-2026.md` | keep (Lovable-generated) |

## 2. Unused exports

knip reports **1,383 unused exports and 276 unused exported types** in 256 `src/` files (none in `scripts/`, which
are entries). Most are used inside their own file and only need the `export` keyword dropped, which is not worth
churn. **180** of them are referenced nowhere at all besides their own declaration:

| Area | Count | Most notable names | Why | Risk |
|---|---|---|---|---|
| `src/lib/duel/types.ts` | 48 | `*_PARTIAL_POINTS` (Block Party, Flow, Laser, Lights, Pair, Pipes, Rings, Tiles, Tubes), `*_MIN_MOVE_BONUS`, `COUNTUP_*` (6), `SPOT_ONE/THREE/FOUR_POINTS`, `TARGET_NEAR/FAR_POINTS`, `STROOP_*`, `COUNTDOWN_MS`, `WORDSMITH_LETTERS`, `NonoMark`, `StroopItem` | Old scoring constants from before `puzzleScoreRev`; several belong to games deleted on 14 Oct | check first (confirm no legacy grader needs the value under another name) |
| Old arcade band curves | 17 | `BRK_V7_`, `RALLY_V7_`, `SLICE_V7_`, `SNAKE_V7_`, `BEAT_V7_`, `BINTOSS_V5_`, `BT_V5_`, `BUB_V6_`, `BULLSEYE_V5_`, `BURST_V5_`, `CROSS_V6_`, `FLIP_V5_`, `HOVER_V6_`, `INK_V7_`, `MATCHUP_V7_`, `ORBIT_V9_`, `PIN_V2_`, `SKYLINE_V5_`, `SWING_V10_`, `TILT_V5_BAND_CURVE` | The 18 Oct "scoring targets" revisions score through `BAND_TARGET_MAP`, not these named curves | check first (stamp history; prove with arcade-score-bands-check before removing) |
| Arcade sim constants and helpers | ~45 | `RALLY_PAR`, `RALLY_HIT_POINTS`, `RALLY_POINTS_CAP`, `SKYLINE_PAR`, `SKYLINE_POINTS_CAP`, `SLICE_MULTI_BONUS`, `BINTOSS_PAR`, `ARCADE_COMPLETION_BONUS`, `flipCourseV2`, `inkSlideSpeed`, `orbitRev3InWindow`, `hotfloorRouteHasPinch`, `juncIsDiagonal`, `matchupDrawAnimated`, `bullseyeDrawAim`, `binTossDrawLanding`, `whackPopAt` | Constants from older scoring shapes or helpers left behind by refactors | check first (sims are deterministic and stamped; delete only with the game's replay check) |
| Renderer palettes and art helpers | ~30 | `seas.renderer.ts` (`SEA_*` colours, `paintCoin`, `seaRope`, `seaUnderwater`), `realworld.renderer.ts` (`REAL_*`, `realSky`, `realCloud`, `realClock`), `drawCountryGround`, `grassTexture`, `matchupArenaScene`, `withArcadeFx`, `setArcadeFxClock`, `ORBIT3_FX_TALL` | Art kit pieces never called | safe (display only) |
| `src/lib/sound.ts` | 7 | `playFanfare`, `playRoundStart`, `isMusicPlaying`, `voiceDurationMs`, `onMuteChange` (alias of `onSoundSettingsChange`), `DEFAULT_EFFECTS_VOLUME`, `DEFAULT_MUSIC_VOLUME` | Superseded by the sound manifest and cue slots | safe |
| Puzzle and room helpers | ~25 | `fetchDuelById` (api.ts), `clockOffsetMs`, `gradeFlowPaths`, `floodCycleFinisher`, `generateStrikeoutRev1`, `decodeColourClashRun`, `bombPlanIsConsistent`, `encodePushSolution`, `serialiseLayout`, `rotateTile`, `categoryPoolSizes`, `canTimelapse`, `TIMELAPSE_MAX_MS`, `crashContext`, `stopCrashReporting`, `hasGameIcon`, `GhostOutline`, `nearestGridCellAt`, `adjacentGridCellAt`, `Kettlebell` icon | Mixed: dead helpers, plus a few kept for a stamp or a future check | check first (`generateStrikeoutRev1`, `floodCycleFinisher`, `gradeFlowPaths` may matter to stamped rounds) |

**Duplicate exports** (one value under two names, knip): `CLAY_REV_TALL`/`CLAY_REV`, `FLOW_MAX_PAIRS`/`FLOW_PAIRS`,
`BEAT_V5_BAND_CURVE`/`BEAT_V6_BAND_CURVE`, `BINTOSS_REV3`/`BINTOSS_REV`, `BUB_LEFT`/`BUB_WALL`,
`BULLSEYE_REF_V`/`BULLSEYE_FLIGHT_DEN`, `BURST_FLOOR_Y`/`BURST_DRAG_TOP`, `SNAKE_HUD_H`/`SNAKE_BOARD_Y`,
`WORD_POLISH_PRESENTATION`/`WORDSMITH_PRESENTATION`, `WORDSMITH_REV_ONE_CURVE`/`WORDSMITH_REV_TARGET`,
`WORDHUNT_REV_MISSES`/`WORDHUNT_REV_TARGET`, `onSoundSettingsChange`/`onMuteChange`,
`FLOOD_LIMIT_REV3`/`FLOOD_LIMIT_DEALT`. Mostly intentional (a stamp named twice, a revision equal to the dealt one).
Risk: **keep** (they document versioning; merging names would touch stamped code).

## 3. Scripts not run by CI, package.json or docs

196 non-check files in `scripts/` (tools, recorders, bank builders, shot tools). `package.json` runs none of them
(`dev`, `build`, `preview`, `lint`, `format` only); CI runs `run-checks.ts`, `arcade-play-check.ts --record` and the
checks. Most tools are named in CLAUDE.md / docs or imported by a check. These 18 have **no import and no mention
in any code**; the first 14 also have no mention in docs:

| Path | What it is | Evidence | Risk |
|---|---|---|---|
| `scripts/find-arrow.ts` | Undocumented one-off: draws Orbit rev-3 frames with the camera arrow | rg `find-arrow`: none; no header comment | safe |
| `scripts/orbit-rev3-shots.ts` | Mock screenshots for Orbit rev 3 (Orbit is now `orbitRev` 10) | rg `orbit-rev3-shots`: none | safe |
| `scripts/orbit-rev3-stats-merge.ts` | Fans out `orbit-rev3-stats.ts` over 8 workers | rg: only mentions itself; `orbit-rev3-stats.ts` is referenced only by it | check first (with `orbit-rev3-stats.ts`) |
| `scripts/arcade-batch3-frames.ts` | PNG stills of the batch-3 games' art, "not a check" | rg `arcade-batch3-frames`: none | safe |
| `scripts/intro-ready-375.ts` | Measures READY on the practice intro at 375×667 | rg: none; bottom-clearance-check now proves it | safe |
| `scripts/snip-design.ts` | Design aid for Scrumper templates | rg: none | check first (design tool for future templates) |
| `scripts/snip-star-design.ts` | Design aid: golden-leaf positions | rg: none | check first |
| `scripts/snip-rev6-deal-audit.ts` | Audit of `snipRev 6` deals (now `snipRev` 9) | rg: none; snip-rev7-check covers the deals | safe |
| `scripts/codeword-rev2-record.ts` | Recorded `codeword-rev2-legacy.json.gz` | rg: none; the fixture exists and codeword-check reads it | check first (recorders document how a legacy fixture was made; re-running on today's main would not reproduce it) |
| `scripts/wordsearch-rev1-record.ts` | Recorded `wordsearch-rev1-legacy.json.gz` | as above | check first |
| `scripts/speed-oct14-legacy-record.ts` | Recorded `speed-oct14-legacy.json.gz` | as above | check first |
| `scripts/shots/hero-shots.ts` | Review shots for the Joulz hero (23 Oct) | rg: none; output in `screenshots/hero-oct-2026/` | keep (today's design tool) |
| `scripts/shots/hero-icons-shots.ts` | Review shots for the hero icons (23 Oct) | rg: none | keep |
| `scripts/shots/high-rise-flag.ts` | Review shots for High Rise's flag (23 Oct) | rg: none | keep |
| `scripts/arcade-input-identity-proof.ts` | On-demand Chromium proof that the fitted arena keeps inputs identical | mentioned in 2 docs | keep (documented proof) |
| `scripts/intro-ready-measure.ts` | Measures the round intro's READY | mentioned in 1 doc | check first |
| `scripts/replay-fixtures.ts` | Builds `scripts/fixtures/replay-runs.json` (read by replay-lab and checks) | mentioned in 2 docs | keep |
| `scripts/solver-progress-timing.ts` | Timing tool named in `docs/scoring-targets.md` | mentioned in 1 doc | keep |

## 4. Fixtures nothing reads

All 60 files in `scripts/fixtures/` (including `orbit-legacy/`) are read by at least one `*-check.ts(x)` through a
string path (rg for each file name outside the folder). `arcade-play-baseline.json` is also swapped by CI, and
`replay-runs.json` is loaded by `src/routes/replay-lab.tsx` through `import.meta.glob`.

| Path | Why | Evidence | Risk |
|---|---|---|---|
| (none) | Every fixture has a check reader | rg per file name; no orphan found | keep (all) |

`scripts/data/word-frequency.txt` (6 readers) and the `scripts/arcade-skill-bands/`, `scripts/puzzle-fairness/`
helpers are imported by tools and checks: keep.

## 5. Screenshot folders

`screenshots/` is 139 MB; no code reads it (review images committed on purpose, per CLAUDE.md). "Doc refs" = files
in docs/CLAUDE.md/scripts naming the folder.

| Folder | Files / size | Doc refs | Risk |
|---|---|---|---|
| `oct-2026/` | 260 / 65 MB | 0 by path (CLAUDE.md mentions "oct-2026" only in other names) | check first (largest; the screen audit's sheets) |
| `polish-speed-attention/` | 25 / 14 MB | 0 | safe |
| `pattern-polish/` | 21 / 11 MB | 0 | safe |
| `polish-word/` | 21 / 7.4 MB | 0 | safe |
| `polish-g/` | 63 / 7.3 MB | 0 | safe |
| `tuning-d/` | 22 / 5.3 MB | 0 | safe |
| `polish-number/` | 19 / 4.8 MB | 0 | safe |
| `polish-f/` | 31 / 4.4 MB | 0 | safe |
| `polish-logic/` | 25 / 3.4 MB | 0 (rg hits are CSS class names) | safe |
| `share-oct-2026/` | 8 / 3.5 MB | 0 | check first (recent, 21 Oct) |
| `replays/` | 6 / 2.7 MB | 0 | safe |
| `tidy-oct15/` | 28 / 2.2 MB | 0 | safe |
| `rotation-oct13/` | 14 / 1.4 MB | 0 | safe |
| `fill-ins-oct-2026/` | 2 / 1.2 MB | 0 | check first (screen fill-ins, 17 Oct) |
| `beta-extras-oct-2026/` | 4 / 888 KB | 0 | check first (22 Oct) |
| `room-extras-oct17/` | 6 / 348 KB | 0 | safe |
| `app-redesign-oct-2026/` | 15 / 1.3 MB | 3 | keep |
| `challenge-oct-2026/` | 17 / 800 KB | 2 | keep |
| `daily-oct-2026/` | 5 / 236 KB | 2 | keep |
| `hero-oct-2026/` | 14 / 1.2 MB | 1 | keep |
| `hero-icons-oct-2026/` | 9 / 1.8 MB | 1 | keep |

"safe" here means no code or doc depends on them; they are still the only record of those design waves, so Joe may
prefer to keep them (git history keeps them either way).

## 6. Other

| Path | Why it looks unused | Evidence | Risk |
|---|---|---|---|
| `fix.py` | One-off Python edit of `cross.renderer.ts` | Lovable working note (CLAUDE.md) | keep (Lovable notes) |
| `check_example.ts` | 8-line Wordsmith example print | Lovable working note | keep (Lovable notes) |
| `m.md` | Memory note on Colour Clash's fixed queue | Lovable working note | keep (Lovable notes) |
| `mem/` (`features/`) | Lovable memory notes | Lovable working note | keep (Lovable notes) |
| `roadmap.md` | 958-line roadmap | Lovable working note | keep (Lovable notes) |
| 14 sound asset pointers in `src/assets/sounds/`: `arc_gem_match`, `arc_gem_star`, `arc_gem_zap`, `arc_laser`, `arc_lava_hiss`, `arc_saucer_shot`, `arc_sea_cannon`, `arc_sea_chest`, `arc_sea_coin`, `arc_sea_creak`, `arc_sea_cutlass`, `arc_splash`, `arc_swoosh`, `round_won` (`.mp3.asset.json`) | Lovable asset records whose `asset_id` the sound manifest no longer uses (batches 2–4 moved to `public/sounds/`) | rg for each `asset_id` in `src/`, `scripts/`: none | check first (Lovable owns the asset store) |
| The other 137 `src/assets/{sounds,music}/*.asset.json` | Never imported, but their URLs are in `src/lib/fx/manifest.ts` | rg `asset_id` hits | keep |
| `public/favicon.png` | Not named in code; the app icons come from `APP_ICONS` (`brand.ts`) | rg `favicon.png`: none | check first (browsers request `/favicon.*` by default) |
| `public/robots.txt`, `public/fonts/OFL-*.txt` | Served by convention / font licences | — | keep |
| Dependencies (knip): 24 `@radix-ui/*`, `@hookform/resolvers`, `react-hook-form`, `cmdk`, `date-fns`, `embla-carousel-react`, `input-otp`, `react-day-picker`, `react-resizable-panels`, `recharts`, `sonner`, `vaul`, `zod`; dev: `drizzle-orm`, `postgres` | Used only by the unused `ui/` files (or not at all) | knip `dependencies` | check first (removing changes `bun.lock`, which Lovable builds from; never without Joe) |
| `tailwindcss`, `tw-animate-css`, `@tanstack/router-plugin` (knip "unused") | Used by CSS `@import` / the Vite config | false positives | keep |
| `src/routes/replay-lab.tsx`, `src/routes/dev-crash.tsx` | Development-only pages (`import.meta.env.DEV`) | route files | keep |
| `drizzle/`, `drizzle.config.ts` | Lovable's migration mirror (schema.ts is blank) | Lovable-managed | keep |
| knip "unresolved" imports in `scripts/shots/capture.ts`, `demo-taps.ts`, `hero-icons-shots.ts` | `/scripts/...` and `/src/...` strings are Vite dev-server URLs loaded in the browser | read the code | keep |

## Totals

| Risk | Items |
|---|---|
| safe | 45 unimported files (43 `ui/`, `use-mobile`, `BarOverlay`); ~37 dead exports (renderer art, `sound.ts`); 5 scripts; 12 screenshot folders (~64 MB) |
| check first | 1 file (`puzzles/words.ts`); ~143 dead exports (old constants, band curves, sim and puzzle helpers); 7 scripts; 4 screenshot folders (~70 MB); 14 asset pointers; `favicon.png`; unused dependencies |
| keep | `cron-auth.ts`; 13 duplicate-export pairs; 3 documented and 3 current design scripts; all 60 fixtures; 5 screenshot folders; root scratch files; routes, migrations, drizzle |
