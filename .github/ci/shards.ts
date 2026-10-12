/**
 * CI shard lists for .github/workflows/checks.yml (one job per key; the matrix
 * there must name the same keys). Balanced by runtime from a full local run on
 * 12 Oct 2026 (snip ~625 s alone; a, b and c ~600 s each; play ~555 s in #16). Rebalance if one
 * job's time drifts well past the others.
 *
 * A check file not listed here still runs, in CATCH_ALL.
 */
export const SHARDS: Record<string, string[]> = {
  snip: ["snip-check.ts"],
  // Headless Chromium (arrives with #16; skipped while the file doesn't exist).
  // The workflow installs the browser and swaps in the CI frame-time baseline
  // for this shard only.
  play: ["arcade-play-check.ts"],
  a: [
    "arcade-fixes-check.ts",
    "arcade-fx-check.ts",
    "bintoss-small-bucket-check.ts",
    "clay-check.ts",
    "colour-clash-queue-check.ts",
    "colour-clash-spawn-check.ts",
    "dig-check.ts",
    "four-tuning-check.ts",
    "gravity4-check.ts",
    "iceslide-portals-check.ts",
    "ink-live-bottom-check.ts",
    "logic-grid-check.ts",
    "orbit-checkpoint-check.ts",
    "puzzle-bank-check.ts",
    "puzzle-surface-check.tsx",
    "reveal-score-check.tsx",
    "rings5-check.ts",
    "room-viewport-check.tsx",
    "slice-kitchen-check.ts",
    "stroke-tiles-rings-check.ts",
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
    "ink-birds-check.ts",
    "ink-line-check.ts",
    "ink-rainbow-check.ts",
    "intro-demo-check.ts",
    "intro-score-text-check.ts",
    "laser-check.ts",
    "link-join-check.ts",
    "matchup-check.ts",
    "new-types-check.ts",
    "nonogram-pair-flood-check.ts",
    "orbit-camera-check.ts",
    "orbit-legacy-replay-check.ts",
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
    "tile-grid-word-count-check.ts",
    "timing-check.ts",
    "trail-check.ts",
    "whack-check.ts",
    "word-game-tuning-check.ts",
    "wordsearch-check.ts",
  ],
  c: [
    "arcade-batch1-check.ts",
    "arcade-check.ts",
    "arcade-correction-check.ts",
    "arcade-drag-check.ts",
    "arcade-oct4-check.ts",
    "arcade-self-replay-check.ts",
    "bullseye-cross-flip-tuning-check.ts",
    "chain-cycles-check.ts",
    "hotfloor-flip-check.ts",
    "ink-live-check.ts",
    "ink-rev3-fix-check.ts",
    "laser-tower-maze-check.ts",
    "number-pyramid-check.ts",
    "orbit-outside-belt-check.ts",
    "orbit-rev3-replay-check.ts",
    "puzzle-input-tuning-check.tsx",
    "room-practice-parity-check.tsx",
    "shikaku-lightup-check.ts",
    "six-game-scoring-check.ts",
    "tubes-safe-bomb-check.ts",
    "wordsmith-variable-check.tsx",
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
