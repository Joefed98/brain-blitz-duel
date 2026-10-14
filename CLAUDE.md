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
- `src/lib/arcade/` — the deterministic engine (`engine.ts`) and one sim per arcade game
  (`<game>.ts`), with art in `*.renderer.ts` (never imported by the sim or server).
  Seeds and revision stamps come from `src/lib/duel/arcade.server.ts`.
- Strikeout, Cryptogrid and Swapword (`strikeout`, `codeword`, `swapword`): answers from
  `commonWords.server.ts` (SCOWL sizes ≤ 35, built by `scripts/common-words-build.ts`) through
  `answerWords()` in `dictionary.server.ts`; boards from the room seed (`wordSeed.server.ts`;
  Cryptogrid from the 1,000-board bank `codewordBank.server.ts`, `scripts/codeword-bank.ts`).
  Live feedback comes from `checkMovesFn` / `practiceCheckMovesFn` (`moves.server.ts`): the phone
  sends its whole move list and gets back only the board view. Shared QWERTY keypad:
  `src/components/puzzles/LetterKeypad.tsx`.
- `src/lib/fx/signature.ts` — the shared signature beat (gold flash + app-logo burst on every
  solve/finish, fired only from the common points: the rooms/practice verdict and arcadeFeedback);
  `src/lib/fx/roomMoments.ts` — the room's big-moment effects (Prepare to Duel, round titles 1–6, Final
  Round, the winner reveal; display only, CSS `rfx-*`, cues `room.*`, `room-moments-check`);
  `src/lib/fx/soundCues.ts` and `docs/sound-cues/` — named sound cues (`duelz-sound` events,
  `<gameId>.<event>` / `shared.<event>`; `?dev=1` logs them).
- `src/components/duel/` — room/round screens (PhoneShell, RoundIntro, TimerBar,
  AnswerReveal, ArcadeReveal, WinnerReveal…); `src/components/puzzles/` — shared puzzle
  widgets; `src/lib/fx/` — sound and visual feedback (presentation only).

## Checks

- **GitHub Actions runs the full suite** (`.github/workflows/checks.yml`) on every pull
  request open/push/reopen, split into nine parallel jobs (`.github/ci/shards.ts`: `a`–`d`,
  and `play1`–`play5` for arcade-play-check). Each job's summary lists every check by name
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
    (`--part=k/n`). puzzle-bank-check's every-entry verification is split over `a`–`d`
    (one part each, under 90 s on a 2-core runner); arcade-play-check's 21 active arcade games (and Letterfall) over
    `play1`–`play5`. Together the parts check exactly what one whole run does.
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
- **Baseline:** whatever the latest green PR run of the Checks workflow reports (131
  routine checks as of 14 Oct 2026: the 133 `scripts/*-check.ts(x)` less the two `--include-optional`
  ones, which never run in CI; the CI summary lists puzzle-bank-check as its 4 parts and
  arcade-play-check as its 5, 138 rows in all. The 14 Oct deletion removed sum-hunt-check, added
  removed-games-check and renamed stroke-tiles-rings-check to tiles-rings-check and
  gravity-chain-intruder-check to gravity-maze-check). CI times (2-core runners), quick depth: arcade-play-check ~3 min per play job
  (~11 min whole), snip-check ~90 s (full ~8 min CI, ~12 min locally), each
  puzzle-bank-check part ~65 s (whole ~5 min CI, ~4 min on 4 local cores); arcade-fx,
  arcade-self-replay, ink-live-bottom and orbit-camera ~60–70 s; burst-swing-score and
  reveal-score ~50 s. new-types checks seeded bank draws and takes ~10 s. number-batch-check (Brimful, Checkout, Ballpark: same-seed puzzles, BFS and exhaustive-search proofs, score anchors) takes ~12 s. wordfall-check (Letterfall dictionary, plan, a 20-seed bot proving par through the server replay, identity proof) takes ~6 s. arcade-batch1-check (legacy identity + 150 proofs for Jaywalk, Roofbound, Ball Tracker, Slice) takes ~2 min; arcade-batch2-check (legacy digests, bots proving 150 for Gemstone, Coral Pop, Meteor, Hover) takes ~60 s. arcade-batch4-check (legacy digest, stored Scrumper plans for all 60 templates, bots proving 150 for Scrumper, Junction, Tilt, High Rise) takes ~30 s. arcade-batch5-check (legacy digest, bots proving 150 for Swish, Flightpath, Rally, Tempo, Rainbow Bridge, Orbit's hole witnesses) takes ~45 s. arcade-tuning-a-check (Tuning A: pre-change runs replaying to the same score and state for High Rise, Wavefront, Orbit, Grappler and Tilt; Wavefront shapes, Orbit fly-in and earlier misses, Grappler touch stars, every Tilt cup reachable, 150 proofs) takes ~15 s; `CHECKS_FULL=1` checks every Grappler bank course and 40,000 Tilt seeds. ink-live defaults to 20 seeds; `INK_LIVE_SEEDS=60` runs the full set. tap-log-check (Flash, Bang On and Ascend tap logs against honest runs recorded on main, phone parity in happy-dom, tampered logs) takes ~30 s; arcade-tuning-c-check (Tuning C: 72 pre-change runs replaying to the same score and state for Gemstone, Grappler, Hover, Rainbow Bridge, Roofbound, Tempo, Wavefront, Tilt and Slice; Gemstone's wait and 2,500 par, the score-only curves on identical play, Roofbound's 10 s bend, Wavefront's slower waves 3–4 and timed boss kill, Tilt's amber start, hole-mouth stars and a scripted 150, Slice's blade, Junction retired, 150 proofs) takes ~45 s; tuning-b-check (Flightpath bullRev 4 balloons and 150 via the server replay, Breaker's 3.5 s Fireball, Rally pads never overlapping, arena fills, Fission controls) takes ~5 s; `TAP_LOG_PARITY=all` plays every recorded run through the phone. codeword-check (all 1,000 Cryptogrid boards proven unique), strikeout-check and swapword-check take under 10 s each. move-limits-check (13 Oct 2026: Colour Flood, Polypotions, Topsy-Turvy, Counterweight, Operator and Brimful limits, Tally's counts; legacy identity on `scripts/fixtures/move-limits-legacy.json.gz`, enforcement, random play, counters) takes ~2 s. careless-play-check (Flash and Bang On `tapRev: 2`, Pull! `clayRev: 4`: older stamps unchanged, stored breakdowns, careless lines and honest bands on 30 room seeds) takes ~8 s. arcade-tuning-e-check (Tuning E, 13 Oct 2026: 32 pre-change High Rise, Meteor, Scrumper and Hover runs replaying to the same score and state; taller worlds per stored revision; Hover's drifting course; Meteor's 28 rows; Scrumper's 2/3/5 mix, crook rules, stored rev-5 plans at every wobble, hard levels needing their catch; best scores via the server replay) takes ~2 min.
- **Any arcade change** (a sim, renderer, art, effect or arcade stage): run
  `bun scripts/arcade-play-check.ts` with the game's own checks, arcade-self-replay,
  arcade-fx and reveal-score. It plays all 21 active arcade games (and Letterfall, plus Tenfall, Mixed Signals, Bonk and Pull! without the arcade-world layout proof) in headless Chromium
  (390 × 700, practice mode, 15 s of scripted taps and swipes each, about 10–12 minutes)
  and fails if the sim tick or HUD timer stops, a console or page error appears, the
  average frame time is far above the per-game baseline from main
  (`scripts/fixtures/arcade-play-baseline.json`; rerecord with `--record` against main)
  or a drawn object jumps further than it can move. Pass game ids to run only those, or
  `--part=k/n` for one CI group (`play4` holds flip, Roofbound).
  It starts its own Vite dev server (or `--url=<origin>`) and needs the pre-installed
  Chromium; run-checks gives it 1,500 s.
- **Tap targets** (Pull!, Mixed Signals, Tempo): tap-mapping-check (~20 s, shard `d`) draws frames with the
  real renderer (@napi-rs/canvas), finds each target's drawn pixels, and sends taps through the phone's own
  mapping (`src/components/puzzles/tapMapping.ts`) into the sim on the next tick: a tap on the drawn centre
  must hit and a tap 3 px past the drawn edge must miss (clays and birds all round, each drawn over a zone at
  exactly its sim hit area; gates and lanes left and right, since lanes are picked by x). Bonk is reported,
  not enforced: its whole-cell tap box is intended. Run it after changing one of those renderers, their tap
  handlers or tapMapping.ts.
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
   `sliceRev`, `tapRev`, `chainTimeRev`, `bombVersion`, `rulesVersion`, `puzzleScoreRev`, `tenRev`, `pinRev`, and the move-limit stamps
   `floodRev`, `tubesRev`, `gravityRev`, `balanceRev`, `equationRev`, `measureRev` 2, `countRev`). Unstamped/older rounds must replay and score exactly as before.
   Arcade scoring follows the Oct 2026 score bands (`docs/arcade-score-bands-oct-2026.md`): change a curve only with a
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

**Pinball** (`pinball`, working title, 13 Oct 2026) is a new Retro arcade game, **practice only** until
`PINBALL_IN_ROOMS` in `src/lib/arcade/pinball.ts` is set to `true` (the one switch: the registry, the practice list, the
active arcade list and the checks all read it; after switching, update the docs' counts to 22 active arcade games). Its rules are
`pinRev 1`; `scripts/pinball-check.ts` (~11 s) replays stored rev-1 runs, long runs and fast shots (no tunnelling).

**Junction** (`junction`) is retired to practice since Tuning C (12 Oct 2026): rooms deal the 21
active arcade games (`ACTIVE_ARCADE_GAMES` in `arcadeFxGames.renderer.ts`); Junction keeps its world,
fill, effects and band curve for practice and stored rounds.

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
