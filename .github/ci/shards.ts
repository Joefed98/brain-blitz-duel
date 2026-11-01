/**
 * CI shard lists for .github/workflows/checks.yml (one job per key; the matrix
 * there must name the same keys). An entry `<file>@<k>/<n>` runs part k of n of
 * that check (run-checks passes --part). Balanced on 15 Oct 2026 from the per-check
 * times of PR run 38608375501 (2-core runners, quick depth), aiming for no job over
 * about 6 minutes: each of a-g ~280 s of checks plus ~20 s of setup; each play job one
 * browser check part (~200-325 s, a dev-server start each) or an arcade-play part plus
 * one short browser check, plus ~45 s of setup and browser install.
 * Rebalance if one job's time drifts well past the others (each job's summary lists
 * every check's time).
 *
 * A check file not listed here still runs: in CATCH_ALL (g) if it starts no browser, in BROWSER_CATCH_ALL (play21)
 * if it does.
 *
 * Two workflows since 1 Nov 2026 (CI cost cut): the play* shards are browser checks and run only in
 * .github/workflows/full-suite.yml (a PR labelled `ready-to-merge`, a PR leaving draft, a manual run and weekly on
 * main); the other shards run on every push (.github/workflows/checks.yml). Which side a check is on is worked out
 * from its source (.github/ci/browser.ts): a browser check listed in a fast shard is run in BROWSER_CATCH_ALL
 * instead, so nothing that starts Chromium runs on a push and nothing is ever skipped (ci-shards-check proves it).
 */
export const SHARDS: Record<string, string[]> = {
  // Headless Chromium: arcade-play-check's 22 active games (Pinball included, and Letterfall,
  // Tenfall, Mixed Signals, Bonk, Pull!) in five groups (one job each, one game at a time, so
  // frame times compare fairly with the CI baseline; the groups are unchanged). The workflow
  // installs the browser and swaps in the CI frame-time baseline for these.
  // arcade-device-bottom-check (15 Oct 2026: every arcade play screen on iPhone 11 / 14 home-screen
  // app and Safari geometry) is in seven parts (17 Oct 2026: in halves, a half with the Meteor passes ran
  // past run-checks' 300 s on CI; 31 Oct 2026: with the Cards & Board and Sports games a third of the layout
  // passes, 13 games, reached the check's 270 s watchdog on CI): its games' layout passes in quarters (@1/7,
  // @2/7 here, @3/7 on play10, @4/7 on play19; ~10 games each), and its three Meteor bottom-edge passes (full,
  // reduced motion, reduced effects; ~1.5-2 min each with a dev server) one each on play7-play9 (@5/7-@7/7).
  play1: ["arcade-play-check.ts@1/5", "arcade-device-bottom-check.ts@1/7"],
  play2: ["arcade-play-check.ts@2/5", "arcade-device-bottom-check.ts@2/7"],
  // beat-hold-browser-check (real practice and room screens in Chromium, ~50 s) and
  // onboarding-check (16 Oct 2026: the first-time intro on home, ~60 s with its dev server) ride here.
  play3: [
    "arcade-play-check.ts@3/5",
    "beat-hold-browser-check.tsx",
    "onboarding-check.ts",
    "first-paint-check.ts",
  ],
  // safe-area-screens-check (non-game screens, notch and home bar emulated, and the room play header's 36 cases, ~3–4 min) rides here.
  play4: ["arcade-play-check.ts@4/5", "safe-area-screens-check.tsx"],
  // play5 also plays stored rounds through the replay player (replay-play-check, ~2 min with its dev server)
  // and the low-end check (arcade-lowend-check, 16 Oct 2026: five heavy games at 4× CPU slowdown, ~4 min).
  play5: ["arcade-play-check.ts@5/5", "replay-play-check.ts", "arcade-lowend-check.ts"],
  // bottom-clearance-check (every active game's controls ≥12px above the visible bottom at
  // 375x667 / 390x844, with and without an 80px toolbar; since 15 Oct 2026 also arcade play
  // columns 8px up with a home bar emulated, and every puzzle's intro, stage and timed-out
  // reveal drawn with a notch and home bar for colour seams, which roughly doubled it): one
  // eighth per job (~9-10 games; ~4.2 min a part locally on 4 cores with its dev server,
  // aiming at ~5 min on a 2-core runner plus setup). It was in thirds (~25 games) before.
  // touch-highlight-check (18 Oct 2026: no tap highlight, touch focus ring or selection on game and room screens,
  // ~1 min with its dev server) rides beside screen-bottom-check, through the same harness.
  play6: ["bottom-clearance-check.ts@1/8", "screen-bottom-check.tsx", "touch-highlight-check.tsx"],
  // arcade-room-practice-check's other two thirds (25 Oct 2026, see play15) ride on the two lightest of these jobs.
  play7: ["bottom-clearance-check.ts@2/8", "arcade-device-bottom-check.ts@5/7", "arcade-room-practice-check.ts@2/3"],
  play8: ["bottom-clearance-check.ts@3/8", "arcade-device-bottom-check.ts@6/7", "arcade-room-practice-check.ts@3/3"],
  // standard-live-check (29 Oct 2026: a production build of the app, then real practice rounds of nine standard puzzles
  // in Chromium, ~4 min) needs Chromium, so it rides on one of the lightest play jobs.
  play9: ["bottom-clearance-check.ts@4/8", "arcade-device-bottom-check.ts@7/7", "standard-live-check.ts"],
  play10: ["bottom-clearance-check.ts@5/8", "arcade-device-bottom-check.ts@3/7"],
  // arcade-fill-check (17 Oct 2026, the screen fill-ins: every active arcade game at 390x844 and as an iPhone 11
  // home-screen app, ~15-20 s a game with one page load each) in thirds alongside the lighter bottom-clearance parts.
  // beta-extras-check (22 Oct 2026: the beta terms, the Add to Home Screen hint, Send feedback and crash reporting
  // through the screen harness, ~2 min with its dev server) needs Chromium, so it rides on the lightest play job.
  play11: ["bottom-clearance-check.ts@6/8", "arcade-fill-check.ts@1/3", "beta-extras-check.ts"],
  // chat-notice-check (22 Oct 2026: its browser pass draws the chat toast on six room screens at three sizes, ~1 min
  // with its dev server) needs Chromium, so it rides on a play job.
  play12: ["bottom-clearance-check.ts@7/8", "arcade-fill-check.ts@2/3", "chat-notice-check.tsx"],
  // play-tab-shift-check (22 Oct 2026: the Play tab's layout from the first frame, five visits with a slow
  // server, ~1 min with its dev server) needs Chromium.
  // celebrations-check (23 Oct 2026, Prompt P: the celebrations' rules and components in happy-dom, then its browser
  // pass on ten harness screens as an iPhone 11 home-screen app, ~2 min with its dev server) needs Chromium too.
  play13: ["bottom-clearance-check.ts@8/8", "arcade-fill-check.ts@3/3", "play-tab-shift-check.ts", "celebrations-check.tsx"],
  // room-extras-check (17 Oct 2026: the room's "finished" pings and the reveal's snake chart, ~3 min with its dev
  // server) on its own job: beside a bottom-clearance part and an arcade-fill third it would pass 10 minutes.
  // desktop-geometry-check (17 Oct 2026: PC and laptop browsers at four sizes and while resizing, ~2-3 min with its
  // dev server) rides here, and room-16-check (31 Oct 2026: rooms of 16 and the colour wheel, ~1.5 min with its
  // dev server).
  play14: ["room-extras-check.ts", "desktop-geometry-check.tsx", "room-16-check.ts"],
  // arcade-room-practice-check (18 Oct 2026: every arcade play screen in a room and in practice as an iPhone 11
  // home-screen app, at three layout viewports, ~2 min with its dev server) and fission-repeat-check (Fission
  // four times in a row in practice, ~2 min) on their own job: play14 is already near its limit.
  // In thirds since 25 Oct 2026 (~55 s a third locally with its dev server, ~2 min whole): it ran into the 300 s limit
  // on CI, and every expansion makes the arcade games heavier. @1/3 here, @2/3 on play7, @3/3 on play8.
  // app-shell-check (18 Oct 2026: the four tabs, icons and the public-games card in the real app plus room screens
  // in the harness, ~2 min with its dev server) rides here too.
  play15: ["arcade-room-practice-check.ts@1/3", "fission-repeat-check.ts", "app-shell-check.ts"],
  // The page skin (19 Oct 2026): theme-check and no-wrap-check's 63 draws in thirds (the daily screens joined 21 Oct 2026:
  // locally theme-check ~2 min, no-wrap-check ~4 min whole, so each job stays near 4 min).
  play16: ["theme-check.tsx", "no-wrap-check.tsx@1/3"],
  // share-check (21 Oct 2026: the podium's Share button, its text, link, clipboard fallback and card in the
  // harness, ~1 min with its dev server) rides with no-wrap's other two thirds.
  play17: ["no-wrap-check.tsx@2/3", "no-wrap-check.tsx@3/3", "share-check.ts"],
  // Prompt D (23 Oct 2026): demo-intro-check (every active game's intro from its first frame to its demo playing,
  // with and without a demo, as an iPhone 11 home-screen app; ~8 s a game, so in thirds of ~25 games, ~3 min each
  // with its dev server) and replay-board-check (46 puzzle replays on the room's results screen, ~2 min).
  play18: ["demo-intro-check.ts@1/3", "demo-intro-check.ts@2/3"],
  play19: ["demo-intro-check.ts@3/3", "replay-board-check.ts", "arcade-device-bottom-check.ts@4/7"],
  // Offline practice (31 Oct 2026): offline-check builds the app for production, installs the service worker, fills
  // every practice pack, plays three games offline, uploads the queue and swaps in a new build's worker (~5 min).
  play20: ["offline-check.ts"],
  // Browser checks that used to ride in the fast shards (1 Nov 2026): help-scroll-check (Chromium on a static page,
  // ~110 s, from g), battery-check (~190 s) and practice-switch-check (~60 s), both unlisted in the catch-all
  // before. BROWSER_CATCH_ALL: any browser check no shard lists runs here too.
  play21: ["help-scroll-check.tsx", "battery-check.ts", "practice-switch-check.ts"],
  // Non-browser checks. puzzle-bank-check's every-entry verification and
  // arcade-self-replay-check's entries are split into parts on separate jobs.
  // ~282 s of checks on run 38608375501's times.
  a: [
    "arcade-batch5-check.ts",
    "arcade-input-check.ts",
    "arcade-slice-bubble-beat-check.ts",
    "bomb-v3-check.ts",
    "bubble-rev4-check.ts",
    "intro-demo-check.ts",
    "laser-log-check.tsx",
    "letterwheel-check.ts",
    "orbit-checkpoint-check.ts",
    "puzzle-input-tuning-check.tsx",
    "reveal-marker-check.ts",
    "room-moments-check.ts",
    "room-practice-parity-check.tsx",
    "six-game-scoring-check.ts",
    "tap-log-check.tsx",
    "tiles-rings-check.ts",
    "arcade-self-replay-check.ts@1/2",
    // Ball Tracker btRev 8's deal list: every dealt course reaches 200 (a sample at quick depth, all ~4.5 min at full), in halves.
    "balltrack-deal-check.ts@1/2",
    "puzzle-bank-check.ts@3/4",
    // The puzzle top-up (26 Oct 2026): legacy grades, deals and the bar on 40 fresh seeds, ~95 s whole locally, in halves.
    "depth-topup-check.ts@1/2",
  ],
  // ~282 s of checks on run 38608375501's times.
  b: [
    "app-update-check.tsx",
    "arcade-batch1-check.ts",
    "arcade-batch2-check.ts",
    "arcade-batch3-check.ts",
    "arcade-tuning-e-check.ts",
    "attention-pattern-check.ts",
    "brand-copy-check.ts",
    "bullseye-cross-flip-tuning-check.ts",
    "burst-renderer-performance-check.ts",
    "chain-cycles-check.ts",
    "clay-check.ts",
    "dropout-finish-check.tsx",
    "duel-start-check.ts",
    "eight-tuning-check.ts",
    "four-tuning-check.ts",
    "intro-score-text-check.ts",
    "laser-tower-maze-check.ts",
    "link-join-check.ts",
    "pipes-check.ts",
    "play-control-clearance-check.tsx",
    "polish-a-check.tsx",
    "replay-access-check.ts",
    // Round replays: fixture replays and moments, the serve-after-close gate, results/podium flow.
    "replay-check.ts",
    "depth-topup-check.ts@2/2",
    "balltrack-deal-check.ts@2/2",
    "reveal-window-check.ts",
    "room-continue-check.ts",
    "signature-beat-check.ts",
    "sound-settings-check.ts",
    "standard-scoring-check.ts",
    "success-effects-check.ts",
    "swapword-check.ts",
    "tuning-b-check.ts",
    "word-game-tuning-check.ts",
    "arcade-self-replay-check.ts@2/2",
  ],
  // ~282 s of checks on run 38608375501's times.
  c: [
    "arcade-correction-check.ts",
    "arcade-fixes-check.ts",
    "careless-play-check.ts",
    "colour-clash-queue-check.ts",
    "colour-clash-spawn-check.ts",
    "gravity4-check.ts",
    "ink-birds-check.ts",
    "ink-live-bottom-check.ts",
    "laser-check.ts",
    "logic-grid-check.ts",
    "puzzle-surface-check.tsx",
    "shared-box-check.ts",
    "shared-fx-check.tsx",
    // Canvas tap targets: centre taps hit, 3 px past the drawn edge misses (@napi-rs/canvas).
    "tap-mapping-check.ts",
    "tubes-safe-bomb-check.ts",
    "whack-check.ts",
    "puzzle-bank-check.ts@1/4",
  ],
  // ~282 s of checks on run 38608375501's times.
  d: [
    "arcade-tuning-f-check.ts",
    "arcade-tuning-f2-check.ts",
    "beat-hold-check.tsx",
    "burst-swing-score-check.ts",
    "flip-bend-check.ts",
    "hover-check.ts",
    "logic-polish-check.tsx",
    "move-limits-check.ts",
    "number-pyramid-check.ts",
    "puzzle-score-rev-check.ts",
    "room-viewport-check.tsx",
    "shikaku-lightup-check.ts",
    "snip-rev7-check.ts",
    "speed-tuning-check.ts",
    "strikeout-check.ts",
    "tile-grid-word-count-check.ts",
    "wordsearch-check.ts",
    "wordsmith-variable-check.tsx",
    "puzzle-bank-check.ts@2/4",
  ],
  // ~282 s of checks on run 38608375501's times.
  e: [
    "category-pool-check.ts",
    "dig-check.ts",
    "hotfloor-flip-check.ts",
    "iceslide-portals-check.ts",
    "ink-line-check.ts",
    "ink-rev3-fix-check.ts",
    "number-batch-check.ts",
    "orbit-camera-check.ts",
    "orbit-outside-belt-check.ts",
    "pattern-logic-oct14-check.ts",
    "presentation-geometry-check.tsx",
    "replay-flow-check.tsx",
    "reveal-score-check.tsx",
    "speed-oct14-check.ts",
    "tendrop-check.ts",
    "trail-check.ts",
    "word-polish-check.ts",
    "wordfall-check.ts",
    "puzzle-bank-check.ts@4/4",
  ],
  // ~282 s of checks on run 38608375501's times.
  f: [
    "arcade-batch4-check.ts",
    "arcade-fx-check.ts",
    "arcade-tuning-a-check.ts",
    "arcade-tuning-c-check.ts",
    "chain-time-check.ts",
    "codeword-check.ts",
    "matchup-check.ts",
    "new-types-check.ts",
    "nonogram-pair-flood-check.ts",
    "orbit-legacy-replay-check.ts",
    // Pinball: stored rev-1 runs, long replays, swept-contact proofs (~6-11 s).
    "pinball-check.ts",
    "rings5-check.ts",
    "room-rounds-check.ts",
    "slice-kitchen-check.ts",
    "snake-renderer-check.ts",
    "snip-check.ts",
    "sound-controls-check.tsx",
    "tie-break-check.ts",
  ],
  // ~282 s of checks on run 38608375501's times.
  g: [
    "arcade-check.ts",
    "arcade-drag-check.ts",
    "arcade-four-check.ts",
    "arcade-oct4-check.ts",
    "arcade-score-bands-check.ts",
    "attention-rework-check.ts",
    "balltrack-check.ts",
    "bintoss-small-bucket-check.ts",
    "gravity-maze-check.ts",
    "ink-live-check.ts",
    "ink-rainbow-check.ts",
    "orbit-rev3-replay-check.ts",
    // Rounds of the 19 games deleted on 14 Oct 2026: name and stored score only.
    "removed-games-check.tsx",
    "snip-bank6-check.ts",
    "stopwatch-chain-check.ts",
    "swing-rev8-check.ts",
    "timing-check.ts",
  ],
};

export const CATCH_ALL = "g";

/** Unlisted browser checks (and any listed in a fast shard) run here, in the full-suite workflow. */
export const BROWSER_CATCH_ALL = "play21";

/** Browser shards (full-suite.yml) and fast shards (checks.yml); the workflows' matrices must name exactly these. */
export const isBrowserShard = (shard: string) => shard.startsWith("play");

/** --include-optional checks: not part of the routine suite, never run in CI. */
export const OPTIONAL = [
  "orbit-outside-belt-deep-check.ts",
  "puzzle-bank-rebuild-check.ts",
  "puzzle-bands-depth-check.ts",
  // A report, not a check (docs/scoring-report-oct-2026.md): never run in CI.
  "scoring-report.ts",
];

/**
 * Checks CI can't run (they need network or a secret Actions doesn't have),
 * mapped to the reason. Empty: on 12 Oct 2026 every routine check passed with
 * networking disabled, and none reads a secret.
 */
export const CI_SKIP: Record<string, string> = {};
