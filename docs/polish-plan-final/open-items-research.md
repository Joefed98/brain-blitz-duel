# Research: open items (repo at main 774e5ddb, 19 Nov 2026)

Read-only. Nothing in the tree changed; no dev server or check was run.

## 1. The scoring review list

Common facts first:

- Every note is dated 16 Nov 2026 and landed through the puzzle train (#449, merged 16 Nov 21:08) and the arcade
  train (#450, merged 17 Nov 01:51). `git log --first-parent --since=2026-11-17 origin/main` shows exactly one merge
  since: `774e5ddb Merge pull request #453: Joe's sounds wired (sound-wiring-nov18)` (18 Nov). `git diff --stat
  774e5ddb^1 774e5ddb -- src/lib/arcade src/lib/duel src/puzzles` touches only `src/puzzles/*.tsx` sound hooks (8
  files, +104/−11; colourFlood, matchup, miniSudoku, minigolf, nonogram, safeCracker, sortTubes, tower), no grader,
  sim scoring or stamp.
- `git log --since=2026-11-15` on the ten games' scoring files (`src/lib/duel/depth/flash.ts`,
  `src/lib/arcade/cards/fiveHands.ts`, `src/lib/duel/standard/number.server.ts`, the Word graders /
  `wordOverhaul.ts`, `src/lib/arcade/{skyline,flip,pool,tilt}.ts`, `grade.ts`, `arcadeStandard.ts`) lists only the
  16 Nov level commits (`2f6c6a4e`, `ee6435d0`, `a1419c99`, `d482b39b`, `de81fd10`, `b76cdd4c`, `5a47d28b`,
  `ec63bd25`…) and the train merges. Nothing dated 17–19 Nov.
- Dealt stamps today (`src/lib/duel/practiceStamps.data.ts`): `reaction` tapRev 7; `fivehands` fiveHandsRev 3;
  `numpyramid` depthRev 2; `wordsmith` wordsmithRev 5; `wordhunt` wordHuntRev 4; `letterwheel` wheelRev 5; `skyline`
  skylineRev 11; `flip` flipRev 13; `pool` poolRev 4; `tilt` tiltRev 12. Every one is the stamp its note names.

**Verdict: all ten are open.** Each note says Normal was left unchanged on purpose; no stamp has moved since.

| Game (id) | Note (file:line) | Concern | Measured | Status |
|---|---|---|---|---|
| Flash (`reaction`) | `docs/design/speed-art/README.md:129` — "**For Joe's scoring review (Flash, 16 Nov 2026):** under the human limits Flash averages 124 / 114 / 106 / 100 (Easy to Expert), with Expert's best tenth at 123: no level reaches the 160–200 band the other Speed games give a strong player. The cause is the per-flash curve (tapRev 7, `FLASH_REV6_CURVE` in `src/lib/duel/depth/flash.ts`): 250 ms scores about 115, and 200 points needs about 120 ms, faster than people react. Normal is left byte for byte as it is (Joe, 16 Nov 2026); any change to the curve would be a new stamp." | Too hard for a human: the curve pays 200 only for ~120 ms reactions. | Human-limits bot (100 deals, `scripts/speed-levels-tune.ts`): Easy 124 / Normal 114 / Hard 106 / Expert 100 (best tenth 123). 140 ms elite: 188 / 186 / 187 / 183. level-tune near-perfect: 167 / 164 / 163 / 159. Other Speed games' human rows run 146–199. | **Open.** tapRev 7 still dealt; `flash.ts` untouched since 16 Nov. |
| Five Hands (`fivehands`) | `docs/arcade-standard/fivehands.md:194` — "**For Joe's scoring review:** Normal is unchanged (fiveHandsRev 3). On 40 deals the elite bot averages about 154–161 on Normal and 172–177 on Easy, and a player held to human limits 136 and 154; Normal is the hardest Normal of the five card games for a strong player, left as it is on purpose (Joe, 16 Nov 2026)." | Hardest card-game Normal for a strong player; also the standard's one named exception (not every deck reaches 200). | Elite 154–161 Normal / 172–177 Easy; human-limited 136 Normal / 154 Easy (40 deals). Normal ×1.4, 60 s, today's table; Hard ×1.4 50 s stricter table; Expert ×1.3 45 s. | **Open.** fiveHandsRev 3 dealt; last change `a1419c99` (16 Nov, levels only). |
| Integer Pyramid (`numpyramid`) | `docs/number-overhaul.md:123` — "**For Joe's scoring review (16 Nov 2026).** Integer Pyramid's Normal is today's game, unchanged: on main's level-tune.ts (40 seeds) the great bot averages 135.4 and finishes 35 % of runs (the near-perfect bot 188.7, every run finished), the largest gap between great and near-perfect play of the eight. Left as it is for the scoring review; nothing in this overhaul changes it." | Steep cliff between great and near-perfect play (finish rate 35 % vs 100 %). | Great 135.4 (35 % finished); near-perfect 188.7 (100 %). Levels: Easy 4 rows, Normal today's, Hard 5 rows 3 decoys, Expert 6 rows 3 decoys. | **Open.** depthRev 2 dealt; Number levels landed in `ec63bd25` / `b636b6b5` without touching Normal. |
| Nucleus (`wordsmith`), Forage (`wordhunt`), Roundabout (`letterwheel`) | `docs/design/game-reviews/word.md:406-412` — "**For Joe's scoring review (16 Nov 2026): Nucleus, Forage and Roundabout.** Normal is unchanged, as asked. In the level measurements (30 seeds a level) the kit's great and near-perfect players rarely reach a star (175+) on Normal: Nucleus 0 % (great) and 33 % (near-perfect), Forage 0 % and 27 %, Roundabout 0 % and 63 %; above Easy a star is out of reach for Nucleus and Forage (Hard 0 / 3 % and 0 / 7 %, Expert 0 / 0) and nearly so for Roundabout (Hard 0 / 10 %, Expert 0 / 0). Their near-perfect averages on Normal are 162 (Nucleus), 165 (Forage) and 175 (Roundabout), so Normal is tough for a strong player in all three: the open word finds score on how much of a large word list is found, and the curves were fitted before the levels existed. Worth a look in the scoring review: the star line for these three, or their curves." | Star (175+) practically unreachable above Easy; the curves were fitted before levels existed. Suggested: the star line or the curves. | Near-perfect Normal averages 162 / 165 / 175; star rates great / near-perfect: Nucleus 0 / 33 %, Forage 0 / 27 %, Roundabout 0 / 63 %; Hard 0 / 3, 0 / 7, 0 / 10 %; Expert 0 / 0 all three. | **Open.** wordsmithRev 5, wordHuntRev 4, wheelRev 5 dealt; last change `5a47d28b` "Word levels: Nucleus, Forage and Roundabout" (16 Nov, levels only). |
| High Rise (`skyline`) | `docs/arcade-standard/skyline.md:235` — "**For Joe's scoring review** (16 Nov 2026): High Rise's Normal under human limits (the limited elite) is 123 mean, 122 median, short of the ~198 guide (the limited bot, reacting in a quarter second, often lets a fast pass go and takes the return pass, so it builds fewer floors in the minute: none of its 40 runs reaches 61). Roofbound's is 183 mean, 188 median (flip.md). Normal is unchanged." | Far under the "~198 for a strong player" guide; the reaction-limited player builds too few floors. | Table at `skyline.md:205-228` (40 seeds): limited elite Normal 123 / 122 (p90 151, 73 % finish); 145 ms elite 176 / 178; near-perfect 156 / 164; great 105 / 101; oracle 200. | **Open.** skylineRev 11 dealt; `ee6435d0` (16 Nov) is the levels commit that wrote the note. |
| Roofbound (`flip`) | `docs/arcade-standard/flip.md:132` — "**For Joe's scoring review** (16 Nov 2026): Roofbound's Normal under human limits (the limited elite) scores 183 mean, 188 median, short of the ~198 guide; Normal is unchanged (High Rise's Normal, 123, is noted in skyline.md)." Also `:125-127`: "Normal under human limits: 183 mean, 188 median, short of Joe's ~198 guide by its perfect landings (3–4 of the 5); Normal is not changed here (Joe approved a Normal change for Iron Wall only)." | Mildly under the guide; the shortfall is the perfect-landings part (3–4 of 5). | Table `flip.md:105-121` (24 seeds): limited elite Normal 183 / 188; elite 198 / 200; near-perfect 184 / 188; great 165 / 164; witness 200. level-tune: Normal 181.1 / 197.1. | **Open.** flipRev 13 dealt; `d482b39b`, `f330cb67` (16 Nov) levels and intro build only. |
| Cue Ball (`pool`) | `docs/arcade-standard/pool.md:225` — "**For Joe's scoring review: Cue Ball's Normal.** The elite bot averages 164 on Normal (stage 3's measurement, 30 deals), well under the levels guide's 198 for a strong player. Normal is today's live poolRev 4 game and was left unchanged on purpose (the levels may not touch it). The gap is mostly the clear: the black and Speed (30 together) need all seven down first, inside 90 s." | A 30-point part (black 10 + speed 20) pays only after all seven in 90 s. | Elite 164 Normal (30 deals). Easy (black opens at 5 of 7): average 117, 13 % clears, 10 % at 175+, elite 184. | **Open.** poolRev 4 dealt; `2f6c6a4e` (16 Nov) "Cue Ball Normal noted for the scoring review". |
| Tilt (`tilt`) | `docs/arcade-standard/tilt.md:83` — "**For Joe's scoring review (16 Nov 2026): Tilt's Normal.** Normal is `tiltRev 12` exactly, the game rooms, rated play and the Daily deal, and its elite score sits well under the other Strategy games': the elite bot under human limits averages **144** on Normal (1 of 40 runs at 200; 166 without limits, 7/40 at 200), against about 158–196 for the other four games' Normal. Normal was left unchanged by stage 3 (no retuning for bot numbers, Joe, 16 Nov 2026); if the review wants it higher, it needs a new tiltRev with its own proved deal, not a change to the levels." | Lowest Strategy Normal for a strong player; a fix needs a new tiltRev with a re-proved deal. | `tilt.md:55-78`: human-limits elite Easy 193 / Normal 144 / Hard 141 / Expert 121; near-perfect under limits 193 / 140 / 125 / 106; unlimited elite Normal 166 (183 median, 7/40 at 200); flawless bot 184; oracle 200 on all 347 Normal entries. | **Open.** tiltRev 12 dealt; `de81fd10` (16 Nov) levels only. |

Also flagged, not on the list: Moon Climb `docs/arcade-standard/ricochet.md:105-107` ("A decision for Joe: keep the
parts as they are (Joe's ask: hit scoring unchanged), or re-fit the core's 245 m to the new near-perfect median (247 m,
so practically unchanged) in his scoring review.").

## 2. The browser checks' dev-server memory problem

Where the logic lives:

- **The restart logic is in `scripts/arcade-play-check.ts:322-385`**, not in `scripts/browser-load.ts` (which only
  holds `warmUp`, `gotoRetried`, `freezeClock`). `RESTART_BETWEEN_GAMES = DESKTOP && !URL_ARG` (line 333) and
  `RESTART_RSS_MB = 3600` (line 335). Between games the desktop pass reads vite's RSS from `/proc` (`viteRssMb`,
  lines 338-359: the vite process in the server's process group, not npx/esbuild), and when it is over the line it
  `stopServer`s (SIGTERM the group, SIGKILL after 10 s, lines 361-373), `startServer`s and re-warms (lines 414-423).
  Comment at 324-331: "its server once ran out of memory late in play25 (about 3.9 GB, slow growth over a long run).
  Measured locally (13 Nov 2026): one server peaked at 3,239 MB RSS for the whole part, and a fresh one reaches
  ~3.4–3.5 GB within its first game (the first-deal compile), each restart costing ~45 s, so restarting before every
  game would take play25 past its time limit with no lower peak." The phone passes never restart ("their frame-time
  baseline was recorded on one long-lived server").
- The server is spawned at `scripts/arcade-play-check.ts:300-312` with `NODE_OPTIONS … --max-old-space-size=4096`
  (comment: "on CI it sat at 1.9 GB of Node's ~2.2 GB default heap all run … Runners have ~7.7 GB").
  `scripts/arcade-play-desktop-check.ts` is a 12-line wrapper that runs `arcade-play-check.ts --desktop`.
- Other checks setting their own 4 GB heap: `scripts/app-shell-check.ts:85-91`, `scripts/arcade-perf.ts:235-240`,
  `scripts/account-flow-check.ts:115`. Demo-save scripts ask for 6 GB (`scripts/action-demos-save.ts:23`,
  `attention-demos-save.ts:16-17`, `docs/demo-replay-audit.md:335`, `docs/number-overhaul.md:130`).
- Workflow side (`.github/workflows/full-suite.yml`): the `Run checks` step sets for every shard
  `NODE_OPTIONS: --require .github/ci/dev-server-log.cjs --report-on-fatalerror --report-directory=…/ci-results/dev-server --max-old-space-size=4096`
  (comment: "a stopgap giving every check's vite dev server a 4 GB heap … the dev servers of arcade-device-bottom,
  arcade-lowend and arcade-fill-check ran out of Node's ~2.2 GB default"). `.github/ci/dev-server-log.cjs` keeps each
  vite server's last 400 lines and a memory sample every 2 s in `ci-results/dev-server/vite-<pid>.log`; the
  "Dev-server capture summary" step prints them on failure; `full-logs-<shard>` artifact kept 7 days. Shard jobs
  have `timeout-minutes: 45`; a "Runner memory" step prints `free -m` / `nproc` (the 18 Nov runs show 15,983 MB RAM,
  4 cores, so the "~7.7 GB" comments are out of date). `.github/workflows/save-intro-demos.yml` starts its dev server
  with `NODE_OPTIONS: --max-old-space-size=6144`.
- Shards (`.github/ci/shards.ts:167-168`): `play24: ["arcade-play-desktop-check.ts@1/2", "arena-world-check.ts@3/4"]`,
  `play25: ["arcade-play-desktop-check.ts@2/2", "arena-world-check.ts@4/4"]`. `arena-world-check` uses
  `startSafeAreaServer` (its own server, line 91), inheriting the workflow's 4 GB NODE_OPTIONS.

The 18 Nov facts (Full suite run 44305501219 on `sound-wiring-nov18` f0a820aa, the head merged as #453):

- Attempt 1, `full (play24)` job 134805882629 (FAIL, 12:37–12:59): `arcade-play-desktop-check.ts@1/2 … FAIL (1121.3s)`;
  `dev server memory: peak 4226 MB after a game; 7 restart(s) over the 3600 MB line`. Restarts logged before `flip`
  (3625 MB → 1921 MB, 56 s), `freecell` (3636 → 1922, 48 s), `curling` (3625 → 1796, 45 s), `minesweeper`
  (3650 → 1892, 56 s) and three earlier in the part. Per-game RSS after each game 3409–3650 MB. The only failing game
  was `flip`: "mean frame 19.2 ms on the desktop layout (under 60 fps; limit 18.3 ms)" with "the runner had CPU to
  spare (other processes used 0.96 of 4 cores …)". The capture logs show eight vite processes (3069, 3465, 3932, 4170,
  4508, 5029, 5458, 5871), each exiting code 143 (SIGTERM, the restart), RSS at exit 3,416–4,226 MB, heap used
  2.7–3.0 GB of the 4,288 MB limit. No fatal-error report: nothing OOMed; the 4,226 MB RSS was the pre-restart peak.
  `arena-world-check.ts@3/4 PASS (175.2s)`.
- Attempt 1, `full (play25)` job 134805882833: PASS; `arcade-play-desktop-check.ts@2/2 … PASS (962.3s)`,
  `arena-world-check.ts@4/4 PASS (176.6s)`. (Its memory line isn't in the retained tail; the 3.9 GB figure is the
  13 Nov comment's earlier OOM, not this run.)
- Attempt 2 (re-run of the failed jobs, 13:05–13:24): `full (play24)` job 134821976897 PASS
  (`arcade-play-desktop-check.ts@1/2 … PASS (924.9s)`); `full-suite-passed` job 134833213813 success. The merge
  commit of #453 records it: "full-suite-passed green only after a re-run of play24 that was made without Joe's
  say-so (attempt 2, passed) … Follow-up: profile Roofbound's desktop frames, main vs the new sounds (flip.flowTick on
  clean landings), and fix in app code in a small PR if the sounds cost frame time."
- Earlier history (`docs/audit-nov-2026/build-health.md:173-182, 212, 215`): play24/play25 average 13.7 / 14.8 min
  (worst single job 28.2 min, play24); `arcade-play-desktop-check` the two slowest checks (691 / 707 s on 4 Nov); the
  pre-4 GB OOM "heap used 1866 MB of a 2240 MB limit" on play1/play5 (not seen since 6 Nov).

Summary for an infrastructure session: the restart-at-3.6 GB rule works as designed (seven restarts, no OOM), but each
desktop half now takes 15–19 min of its 45-min job and a fresh server already sits at ~1.9 GB after warming and ~3.4 GB
after one game; the 18 Nov red was a frame-time miss on `flip`, not memory.

## 3. The `sounds-bring-back` PR

- **PR #454, open, draft** (`mergeable_state: blocked`), title "Sounds bring-back: Joe's picks of 19 Nov 2026",
  head `sounds-bring-back` @ b48bf37e, base main @ 774e5ddb (so its merge-base is today's main). Created
  2026-11-19T23:24:43Z; 4 commits, 35 files, +624/−334; no migrations, `bun.lock` unchanged. Its Checks run
  44637432909 was in progress at the time of writing (build (production), typecheck (src), migrations and checks (f)
  green; a–e, g running). No Full suite yet (no `ready-to-merge` label, still draft).
- Commits (`git log origin/sounds-bring-back`): `676bf122` "Sounds bring-back: Joe's 19 Nov picks play what they
  played before #453", `f8783756` "the cue sheet, arcade-effects.md and the bring-back doc", `86c9c454` "Joe's
  approved check changes (19 Nov 2026)", `b48bf37e` "offline-media-refresh-check: kept-in batch-1 files are ones this
  branch leaves wired (Joe's approval, 19 Nov 2026)".
- Files (`git diff --stat origin/main...origin/sounds-bring-back`): `src/lib/fx/manifest.ts` (110 lines),
  `src/lib/fx/keptUnusedSounds.ts` (new, 101: the 77 recordings now unused, kept out of the offline download),
  `src/lib/fx/newGameSounds.ts`, `newGameSounds.data.ts`, `wiredSoundReplaces.ts`, `gameSounds.ts`,
  `src/lib/offline/swPlugin.ts`; 14 files added under `public/sounds/` (`*.prev.mp3` for numhunt.shuffle,
  bomb.defuse, whack.bonk, chain.reshuffle, reaction.bar, swing.streak, pipes.flow, clayshoot.goldShatter, plus restored
  `racing_kerb_loop.mp3`, `ui.select.mp3`, `minigolf_putt.mp3`, `move.slide.mp3`, `mines_clear.mp3`,
  `pz_safe_open.mp3`); docs `docs/sound-cues/sounds-bring-back.md` (new), `cue-sheet.md/.csv`, `arcade-effects.md`,
  `batch6-mapping.csv`, `batch6-sports-cards.md`; scripts `sound-wiring-nov18/wire.ts` (`BROUGHT_BACK`),
  `sound-review-nov-2026/make.py`, and check changes in `sound-manifest-check.ts`, `offline-media-refresh-check.ts`,
  `sound-retheme-check.ts`, `sound-review-fixes-check.ts`, `speed-overhaul-check.ts`, `word-overhaul-check.ts`.
- Content (PR body / `sounds-bring-back.md`): A 41 slots back to their old file; B 33 arcade slots back to their
  library sound; C 12 moments play the shared sound again; D Breaker relaunch unchanged; E Pinball multiball zap per
  ball; F/G Spacewalk no jet puff, no traffic loop; H Curl Champ collisions always `curling.hit`. Nothing deleted.
- Related merged PRs: #448 / #451 / #452 (sound batches 1–3, not wired) and #453 (wiring, NEW_GAME_SOUNDS on), all
  merged 18 Nov 14:04. PR #455 (open, draft, 19 Nov) is a one-file check fix (`scripts/logic-overhaul-1-check.tsx`
  Box Six row test on a fixed board).

## 4. Intro demos

Sources: `docs/demo-replay-audit.md:246-306` ("Re-record list (3 Nov 2026)", updated through 15 Nov),
`src/lib/duel/introDemo.functions.ts` (`SAME_PLAY_DEMO_REVS` l.62-79, `ACTION_DEMO_REVS` l.92-99,
`NUMBER_DEMO_REV` / `NUMBER_DEMO_MIN_STAMPS` l.113-121, `STRATEGY_DEMO_GAMES` l.48, `acceptIntroDemo` l.182-415),
`cardsDemoRules.ts`, `sportsDemoRules.ts`, `minigolfDemoRule.ts`, `attentionDemoRules.ts`, `logicDemoRules.ts`,
`wordDemoStamps.ts`, `src/components/puzzles/wordInput.ts` (`LOGIC2_PRESENTATION` l.24, `WORD_OVERHAUL_PRESENTATION`),
`src/lib/duel/bundledDemos/` (13 puzzle demos shipped with the app: blockparty, flow, gravity, iceslide, laser, pipes,
unblock, sudoku, tubes, tower, safe, nonogram, flood).

The workflow: `.github/workflows/save-intro-demos.yml` (manual only, `dry_run` default on, `categories` filter;
starts a dev server with `--max-old-space-size=6144` on the live project's secrets and runs every
`scripts/*-demos-save.ts`). Save scripts present (14): action, attention, cards, crazy-golf, home-run-top-bins, logic,
logic2, number, pattern, retro, speed, sports, strategy, word. Whether a saved live row exists is in the database, not the
repo ("Whether a matching demo is already saved is in the database, not the repo", audit l.306); the table below says
"fixture recorded, not saved" wherever a fixture waits for the workflow and no bundled copy exists.

Legend: **plays** = a bundled demo ships with the app (or an older live row still passes the rule); **still** = the rule
stops every older demo and no fixture exists; **fixture** = a run is recorded in the repo for the Save intro demos
workflow, not yet known to be saved.

| Game (id) | Demo status | Stamp it needs (rule) |
|---|---|---|
| Roofbound (`flip`) | fixture (`scripts/fixtures/action-demos.json`, elite run) | flipRev 13, Normal (`ACTION_DEMO_REVS.flip = FLIP_REV_GRACE`) |
| Grappler (`swing`) | fixture (action-demos.json) | swingRev 18 (`SWING_REV_BIG`) |
| Moon Climb (`ricochet`) | fixture (action-demos.json) | ricoRev 4 (`MOON_BIG_REV`) |
| Iron Wall (`bastion`) | fixture (action-demos.json) | bastionRev 4 (`BASTION_REV_DEALT`) |
| High Rise (`skyline`) | fixture (action-demos.json; a rev-10 live demo also plays) | skylineRev 11 or 10 (`SAME_PLAY_DEMO_REVS.skyline`) |
| Orbit (`orbit`) | fixture (action-demos.json) | orbitRev 16 (`ORBIT_REV_BIG`) |
| Hover, Breaker, Rally, Tempo, Meteor, Fission, Wavefront, Pinball, Spacewalk, Blockzone (`hover`, `breaker`, `rally`, `beat`, `snake`, `burst`, `wavefront`, `pinball`, `cross`, `blockfall`) | fixture (`scripts/retro-demos.json`, 10 runs) | hoverRev 11, brkRev 12, rallyRev 13 (12 also plays), beatRev 12 (11 also), snakeRev 15, burstRev 13, wavRev 15, pinRev 8, crossRev 13, blockfallRev 2 |
| Tilt, Gemstone, Coral Pop, Rainbow Bridge, Ball Tracker (`tilt`, `matchup`, `bubble`, `inkbridge`, `balltrack`) | fixture (`scripts/fixtures/strategy-demos.json`) | tiltRev 12 (`TILT_REV_BIG`), matchupRev 13, bubbleRev 12, inkRev 15 (`INK_REV_HILLS`), btRev 8 (7 also); Normal only (`STRATEGY_DEMO_GAMES`) |
| Free Cell, Mahjong, Summit, Five Hands, Thirteen (`freecell`, `mahjong`, `tripeaks`, `fivehands`, `pyramid`) | fixture (`scripts/fixtures/cards-demos.json`) | freecellRev 5, mahjongRev 2, tripeaksRev 3, fiveHandsRev 3, pyramidRev 3; Normal (`CARDS_DEMO_STAMPS`) |
| Home Run, Top Bins (`homerun`, `freekick`) | fixture (`scripts/fixtures/home-run-top-bins-demos.json`) | homerunRev 5, freekickRev 6; Normal (`sportsDemoPlays`, `HOMERUN_REV_DEALT` / `FREEKICK_REV_DEALT`) |
| Cue Ball, Curl Champ, Apex (`pool`, `curling`, `racing`) | fixture (`scripts/fixtures/sports-demos.json`) | poolRev 4 (`POOL_REV`), curlRev 4 (`CURLING_REV`), racingRev 4 (`RACING_REV_DEALT`) |
| Crazy Golf (`minigolf`) | fixture (`scripts/fixtures/crazy-golf-demos.json`) | golfRev 3, Normal (`MINIGOLF_REV_COURSE`) |
| Minefield (`minesweeper`) | fixture (`scripts/fixtures/logic-demos.json`) | minesRev 3, Normal (`logicDemoPlays`) |
| Box Six, Polypotions, Hanoi, Safe Cracker, Mosaic, Colour Flood (`sudoku`, `tubes`, `tower`, `safe`, `nonogram`, `flood`) | **plays** (bundled, `bundledDemos/logic1.ts`) | Normal, presentation `LOGIC_OVERHAUL1_PRESENTATION` |
| Tessellate, Pipeline, Chroma Lines, Skid, Topsy-Turvy, Gridlock, Lightbender (`blockparty`, `pipes`, `flow`, `iceslide`, `gravity`, `unblock`, `laser`) | **plays** (bundled, `bundledDemos/index.ts`; fixture also in `pattern-demos.json`) | blockRev 4, pipesRev 5, flowRev 3, slideRev 5, gravityRev 8, unblockRev 4, laserRev 4 (rules l.216-233) |
| Gradient (`tiles`) | plays if a tilesRev ≥ 4 live row exists (rule l.234); audit says "Out of date" for tilesRev 6 | tilesRev 6 (re-record "only if its score line matters") |
| Tents and Trees, Shikaku, Lamplighter, Trail, Loopline, Regions, Island Link (`tents`, `shikaku`, `lightup`, `trail`, `fences`, `fillomino`, `bridges`) | fixture (`scripts/fixtures/logic2-demos.json`) | presentation `nov15-logic-overhaul-2` (`LOGIC2_PRESENTATION`); Trail depthRev 3, Regions fillominoRev 2, Loopline fencesRev 1, Island Link bridgesRev 1 |
| Counterweight, Exact, Operator, Integer Pyramid, Brimful, Checkout, Ballpark, Kakuro (`balance`, `target`, `equation`, `numpyramid`, `measure`, `checkout`, `numline`, `kakuro`) | fixture (`scripts/fixtures/number-demos.json`) | `numberDemoRev 1` in the log plus balanceRev ≥ 5, gapsRev ≥ 2, measureRev ≥ 5, checkoutRev ≥ 4, kakuroRev ≥ 3 (`NUMBER_DEMO_MIN_STAMPS`); the rest today's Normal |
| Eagle Eye, Double Take, Tally, Labyrinth, Bomb Defusal, Matchmaker (`symscan`, `spotdiff`, `countup`, `maze`, `bomb`, `pairmatch`) | fixture (`scripts/fixtures/attention-demos.json`) | scanRev 5, spotRev 4, countRev 7, mazeRev 5 (today's deal), bombVersion 3 (no `bombInstant`), pairRev 4; Normal (`attentionDemoPlays`) |
| Bonk, Tenfall, Pull! (`whack`, `tendrop`, `clayshoot`) | fixture (`scripts/fixtures/speed-demos.json`) | whackRev 4 (`WHACK_REV_NOTES`), tenRev 6, clayRev 10 (`CLAY_REV_WIDE`) |
| Flash, Bang On (retired), Ascend, Don't Break the Chain (`reaction`, `numhunt`, `chain`) | not in any fixture; older puzzle demos play if on the `DEPTH_D3_SPEED_PRESENTATION` (wordInput.ts l.111, 152); Chain gated by `chainDemoCompatible` | unknown from the repo (database) |
| The nine Word games (`wordsmith`, `tilegrid`, `wordslide`, `wordhunt`, `wordsearch`, `letterwheel`, `strikeout`, `codeword`, `swapword`) | fixture (`scripts/fixtures/word-demos.json`, Normal) | each game's own dealt stamp exactly (`wordDemoStampOk` on `LIVE_DEAL`: wordsmithRev 5, tileGridRev 4, wordSlideRev 6, wordHuntRev 4, wordSearchRev 6, wheelRev 5, strikeoutRev 7, codewordRev 7, swapwordRev 7) and presentation `WORD_OVERHAUL_PRESENTATION` |
| Letterfall (`wordfall`, retired) | rule l.279: `wordfallRev !== WORDFALL_REV` stopped | n/a (retired) |
| Ringer (`alleyroll`) | still ("None yet", audit l.265); no fixture, no rule | alleyRollRev 2 |
| Mixed Signals (`stroop`, retired) | still; rule plays `clashRev` 8 only (`clashPlays3`) while rooms dealt 10 (audit l.294) | n/a (retired) |

Note: the audit table's "Record on" column is dated 3 Nov and lags the stamps in several rows (e.g. Tilt tiltRev 11 →
rule needs 12; Rainbow Bridge inkRev 13 → rule needs 15; Wavefront wavRev 12 → 15; Spacewalk crossRev 11 → 13; Meteor
snakeRev 12 → 15; Top Bins freekickRev 5 → fixture is 6). The code rules above are authoritative.

## 5. The latest Checks / Full suite runs on main

- **Checks** (`checks.yml`) has no push trigger on main (CLAUDE.md: "PRs only (no push trigger)"); its last run on
  `main` is a manual one, run 690 (42885313519, 10 Nov 2026, success). The latest Checks for main's head commit is the
  PR run on `sound-wiring-nov18` f0a820aa: **run 44300404371, success** (18 Nov 12:04–12:33; the merge commit says
  "Checks run 44300404371 green (10 jobs)"). A second run 44320282363 on the same sha was cancelled at merge time.
- **Full suite** (`full-suite.yml`): the last run on `main` is the weekly, **run 635 (43791839778, 16 Nov 02:23,
  success)** at 8589b571 (#432). The latest on main's head sha f0a820aa is **run 44305501219: success on attempt 2**
  (full-suite-passed 134833213813); attempt 1 had one failing job, `full (play24)` (134805882629: flip 19.2 ms mean
  frame, limit 18.3 ms; see section 2). Run 44320282308 on the same sha was cancelled at merge. The next weekly run is
  Sunday 22 Nov 22:41 UTC.
- **Full-depth checks (weekly)** (`checks-full-weekly.yml`): run 1 (43788323222, 16 Nov, success) at 8589b571.
- **Deploy to Cloudflare**: run 609 (44320326487, 18 Nov 14:04, success) at main 774e5ddb (#453's merge).
- In flight (19 Nov 23:24–23:26): Checks 44637432909 on PR #454 (`sounds-bring-back`) and 44637680892 on PR #455
  (`box-six-check-fixed-board`), both `in_progress`; on #454, build (production), typecheck (src), migrations and
  checks (f) had passed, a–e and g still running. No Full suite has run for either (both drafts, no label).
- Failing job names on the latest main-head runs: none after the re-run; attempt 1's `full (play24)` only.
