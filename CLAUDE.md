# CLAUDE.md — Duelz

Guide for Claude Code sessions. Read `docs/` first (master plan, game bank, scoring
reference, anti-cheat), then the `AGENTS.md` files (root, `scripts/`, `src/lib/arcade/`,
`src/lib/duel/`, `src/puzzles/`). Those hold Lovable's per-area design rules and
override anything general here.

## What this is

Duelz: a multiplayer skill-game app. Up to 10 players (`MAX_PLAYERS`) join a room with a
short code and play the same timed rounds; 74 active games across Word, Number, Speed, Attention,
Pattern, Logic and Arcade (Word 10, Number 9, Speed 6, Attention 6, Pattern 10, Logic 11,
Arcade 22 with Pinball dealt in rooms; 9 retired to practice: Swerve, Steady, Dual, Ricochet,
Bastion, Rooftop Run, Junction, Dig, Hot Floor). Every category the lobby offers keeps at
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
- `src/components/duel/` — room/round screens (PhoneShell, RoundIntro, TimerBar,
  AnswerReveal, ArcadeReveal, WinnerReveal…); `src/components/puzzles/` — shared puzzle
  widgets; `src/lib/fx/` — sound and visual feedback (presentation only).

## Checks

- **GitHub Actions runs the full suite** (`.github/workflows/checks.yml`) on every pull
  request open/push/reopen, split into twenty parallel jobs (`.github/ci/shards.ts`: `a`–`g`,
  `play1`–`play5` for arcade-play-check and `play6`–`play13` for bottom-clearance-check, one eighth each
  since its 15 Oct seam pass), each about 6 minutes or less (balanced 15 Oct 2026 from run 38608375501's per-check times). Each job's summary lists every check by name
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
- **Screen bottoms** (16 Oct 2026, display only): screen-bottom-check (headless Chromium, ~1 min, shard `play6`) draws 19
  non-game screens (home, first-time intro, practice list and round intro, lobby with 2 and 10 players, link join, Prepare
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
  screen, one 500 ms stall; slowness is judged by each frame's own work, never the gap between frames). Before → after for every game:
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
   `floodRev`, `tubesRev`, `gravityRev`, `balanceRev`, `equationRev`, `measureRev` 2, `countRev` 2; and Tuning F's `crossRev` 5, `sliceRev` 5, `bubbleRev` 4, `swingRev` 8, `matchupRev` 6, `snipRev` 7; and the Pattern / Logic batch's `tilesRev`, `sudokuRev`, `floodRev` 2, `bombVersion` 3; and taller worlds batch 1's `brkRev` 6, `rallyRev` 6, `wavRev` 6, `burstRev` 4; and batch 2's `beatRev` 6, `sliceRev` 6, `bubbleRev` 5, `clashRev` 5, `clayRev` 6; and batch 3's `swingRev` 9, `orbitRev` 8, `btRev` 4). Unstamped/older rounds must replay and score exactly as before.   Arcade scoring follows the Oct 2026 score bands (`docs/arcade-score-bands-oct-2026.md`): change a curve only with a
   new band revision, re-measure with `scripts/arcade-skill-bands.ts`, and keep `arcade-score-bands-check` green.
   Prove it with the game's legacy-replay/identity check.
3. **Arcade bounds rule.** Drawn art must sit within 2 px of the sim's collision bounds,
   so what players see is what collides.
4. **Never rewrite stored data.** No migrations or scripts that change saved rounds,
   puzzles, results, input logs or demos. Never regrade old rounds.
5. **Rooms are identical for every player.** All content (puzzles, order, arcade seeds,
   schedules) is derived once from the room seed on the server and stored; nothing
   random is generated per device. Answers/solutions stay server-only.
6. **Speed bonus = 50 % par rule.** Full bonus when finishing with at least half the
   time left, then an even fall to 0 at the buzzer (`speedPar.ts`, puzzles stamped
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
