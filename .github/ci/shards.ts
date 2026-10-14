/**
 * CI shard lists for .github/workflows/checks.yml (one job per key; the matrix
 * there must name the same keys). An entry `<file>@<k>/<n>` runs part k of n of
 * that check (run-checks passes --part). Balanced from the CI run of 12 Oct 2026
 * (run 38198462753) with the quick modes: a, b, c and d ~260-300 s each of checks
 * (snip-check quick ~90 s, each puzzle-bank-check part ~65 s), each play group
 * ~110-130 s of games plus ~60-90 s of dev-server start. Rebalance if one job's
 * time drifts well past the others.
 *
 * A check file not listed here still runs, in CATCH_ALL.
 */
export const SHARDS: Record<string, string[]> = {
  // Headless Chromium: arcade-play-check's 21 games (and practice-only Pinball, and Letterfall) in five groups (one job each,
  // one game at a time, so frame times compare fairly with the CI baseline). The
  // workflow installs the browser and swaps in the CI frame-time baseline for these.
  // bottom-clearance-check (every active game's controls ≥12px above the visible bottom at
  // 375x667 / 390x844, with and without an 80px toolbar) rides play1-play3 for the browser,
  // one third each (~25 games, ~4 min), after the arcade games.
  play1: ["arcade-play-check.ts@1/5", "bottom-clearance-check.ts@1/3"],
  play2: ["arcade-play-check.ts@2/5", "bottom-clearance-check.ts@2/3"],
  play3: ["arcade-play-check.ts@3/5", "bottom-clearance-check.ts@3/3"],
  // beat-hold-browser-check (real practice and room screens in Chromium) rides here for the browser.
  play4: ["arcade-play-check.ts@4/5", "beat-hold-browser-check.tsx"],
  // play5 also plays stored rounds through the replay player (replay-play-check, ~2-3 min with its dev server).
  play5: ["arcade-play-check.ts@5/5", "replay-play-check.ts"],
  a: [
    "arcade-fixes-check.ts",
    "arcade-fx-check.ts",
    "bintoss-small-bucket-check.ts",
    "clay-check.ts",
    "colour-clash-queue-check.ts",
    "colour-clash-spawn-check.ts",
    "dig-check.ts",
    "four-tuning-check.ts",
    "iceslide-portals-check.ts",
    "ink-live-bottom-check.ts",
    "orbit-checkpoint-check.ts",
    "puzzle-score-rev-check.ts",
    "puzzle-surface-check.tsx",
    "reveal-score-check.tsx",
    "rings5-check.ts",
    "room-viewport-check.tsx",
    "slice-kitchen-check.ts",
    "stroke-tiles-rings-check.ts",
    "puzzle-bank-check.ts@2/4",
  ],
  b: [
    "arcade-batch2-check.ts",
    "arcade-four-check.ts",
    "arcade-input-check.ts",
    "arcade-slice-bubble-beat-check.ts",
    "attention-pattern-check.ts",
    "balltrack-check.ts",
    "brand-copy-check.ts",
    "burst-renderer-performance-check.ts",
    "burst-swing-score-check.ts",
    "dropout-finish-check.tsx",
    "duel-start-check.ts",
    "eight-tuning-check.ts",
    "flip-bend-check.ts",
    "gravity-chain-intruder-check.ts",
    "hover-check.ts",
    // Pinball (practice only): stored rev-1 runs, long replays, swept-contact proofs (~11 s).
    "pinball-check.ts",
    "ink-birds-check.ts",
    "ink-line-check.ts",
    "ink-rainbow-check.ts",
    "intro-demo-check.ts",
    "intro-score-text-check.ts",
    "laser-check.ts",
    "laser-log-check.tsx",
    "link-join-check.ts",
    "matchup-check.ts",
    "new-types-check.ts",
    "nonogram-pair-flood-check.ts",
    "orbit-camera-check.ts",
    "pipes-check.ts",
    "play-control-clearance-check.tsx",
    "polish-a-check.tsx",
    "presentation-geometry-check.tsx",
    "reveal-marker-check.ts",
    "room-continue-check.ts",
    "room-rounds-check.ts",
    "shared-box-check.ts",
    "shared-fx-check.tsx",
    "snake-renderer-check.ts",
    "sound-controls-check.tsx",
    "sound-settings-check.ts",
    "speed-tuning-check.ts",
    "standard-scoring-check.ts",
    "stopwatch-chain-check.ts",
    "success-effects-check.ts",
    "sum-hunt-check.ts",
    "tendrop-check.ts",
    "tie-break-check.ts",
    "tile-grid-word-count-check.ts",
    "timing-check.ts",
    "trail-check.ts",
    "whack-check.ts",
    "word-game-tuning-check.ts",
    "wordfall-check.ts",
    "wordsearch-check.ts",
    "puzzle-bank-check.ts@3/4",
  ],
  c: [
    "arcade-batch1-check.ts",
    "category-pool-check.ts",
    "help-scroll-check.tsx",
    "signature-beat-check.ts",
    "beat-hold-check.tsx",
    "arcade-check.ts",
    "arcade-correction-check.ts",
    "arcade-drag-check.ts",
    "arcade-oct4-check.ts",
    "bullseye-cross-flip-tuning-check.ts",
    "chain-cycles-check.ts",
    "gravity4-check.ts",
    "hotfloor-flip-check.ts",
    "ink-live-check.ts",
    "ink-rev3-fix-check.ts",
    "laser-tower-maze-check.ts",
    "logic-polish-check.tsx",
    "number-pyramid-check.ts",
    "orbit-outside-belt-check.ts",
    "orbit-rev3-replay-check.ts",
    "puzzle-input-tuning-check.tsx",
    "room-practice-parity-check.tsx",
    "shikaku-lightup-check.ts",
    "six-game-scoring-check.ts",
    "word-polish-check.ts",
    "puzzle-bank-check.ts@1/4",
  ],
  d: [
    "app-update-check.tsx",
    "arcade-self-replay-check.ts",
    "logic-grid-check.ts",
    "orbit-legacy-replay-check.ts",
    "snip-check.ts",
    // Canvas tap targets: centre taps hit, 3 px past the drawn edge misses (~20 s, @napi-rs/canvas).
    "tap-mapping-check.ts",
    "tubes-safe-bomb-check.ts",
    "wordsmith-variable-check.tsx",
    "puzzle-bank-check.ts@4/4",
    // Round replays (Oct 2026): fixture replays and moments (~10 s), the serve-after-close gate, results/podium flow.
    "replay-check.ts",
    "replay-access-check.ts",
    "replay-flow-check.tsx",
  ],
};

export const CATCH_ALL = "c";

/** --include-optional checks: not part of the routine suite, never run in CI. */
export const OPTIONAL = ["orbit-outside-belt-deep-check.ts", "puzzle-bank-rebuild-check.ts"];

/**
 * Checks CI can't run (they need network or a secret Actions doesn't have),
 * mapped to the reason. Empty: on 12 Oct 2026 every routine check passed with
 * networking disabled, and none reads a secret.
 */
export const CI_SKIP: Record<string, string> = {};
