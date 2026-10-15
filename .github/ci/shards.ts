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
 * A check file not listed here still runs, in CATCH_ALL.
 */
export const SHARDS: Record<string, string[]> = {
  // Headless Chromium: arcade-play-check's 22 active games (Pinball included, and Letterfall,
  // Tenfall, Mixed Signals, Bonk, Pull!) in five groups (one job each, one game at a time, so
  // frame times compare fairly with the CI baseline; the groups are unchanged). The workflow
  // installs the browser and swaps in the CI frame-time baseline for these.
  play1: ["arcade-play-check.ts@1/5"],
  play2: ["arcade-play-check.ts@2/5"],
  // beat-hold-browser-check (real practice and room screens in Chromium, ~50 s) rides here.
  play3: ["arcade-play-check.ts@3/5", "beat-hold-browser-check.tsx"],
  // safe-area-screens-check (non-game screens, notch and home bar emulated, ~2 min) rides here.
  play4: ["arcade-play-check.ts@4/5", "safe-area-screens-check.tsx"],
  // play5 also plays stored rounds through the replay player (replay-play-check, ~2 min with its dev server).
  play5: ["arcade-play-check.ts@5/5", "replay-play-check.ts"],
  // bottom-clearance-check (every active game's controls ≥12px above the visible bottom at
  // 375x667 / 390x844, with and without an 80px toolbar; since 15 Oct 2026 also arcade play
  // columns 8px up with a home bar emulated, and every puzzle's intro, stage and timed-out
  // reveal drawn with a notch and home bar for colour seams, which roughly doubled it): one
  // eighth per job (~9-10 games; ~4.2 min a part locally on 4 cores with its dev server,
  // aiming at ~5 min on a 2-core runner plus setup). It was in thirds (~25 games) before.
  play6: ["bottom-clearance-check.ts@1/8"],
  play7: ["bottom-clearance-check.ts@2/8"],
  play8: ["bottom-clearance-check.ts@3/8"],
  play9: ["bottom-clearance-check.ts@4/8"],
  play10: ["bottom-clearance-check.ts@5/8"],
  play11: ["bottom-clearance-check.ts@6/8"],
  play12: ["bottom-clearance-check.ts@7/8"],
  play13: ["bottom-clearance-check.ts@8/8"],
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
    "puzzle-bank-check.ts@3/4",
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
    // Headless Chromium on a static page (no dev server), so it needs no play job.
    "help-scroll-check.tsx",
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

/** --include-optional checks: not part of the routine suite, never run in CI. */
export const OPTIONAL = ["orbit-outside-belt-deep-check.ts", "puzzle-bank-rebuild-check.ts"];

/**
 * Checks CI can't run (they need network or a secret Actions doesn't have),
 * mapped to the reason. Empty: on 12 Oct 2026 every routine check passed with
 * networking disabled, and none reads a secret.
 */
export const CI_SKIP: Record<string, string> = {};
