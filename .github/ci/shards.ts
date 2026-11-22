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
 * Rebalanced 7 Nov 2026 (docs/audit-nov-2026/build-health.md item 10) on Checks run 42372376743's times: g (805 s of
 * checks, 137 of its 155 unlisted) and e (641 s) gave ~398 s to a (298 s), b, c (334 s) and f, so every fast shard
 * is ~485-535 s of checks (a 486, b 507, c 525, d 525, e 532, f 505, g 516) and the workflow's wall time follows
 * its slowest shard down from ~13.4 to ~9.5 min.
 * Rebalanced 21 Nov 2026 on Checks run 44837437683's times: g (the catch-all, 282 checks, ~43.5 min of checks) was at its
 * 45-minute job limit while a-f ran 7-15 min; 63 of its slowest unlisted checks (~30.6 min) moved to a-f, so a-f are each
 * ~16.7 min of checks and g ~12.9 min, leaving g room for the new checks every build session adds.
 * Rebalanced 3 Nov 2026: g (the catch-all, every new check) had grown to ~31-33 min while d-f
 * finished in 6-10; ~18 min of its largest unlisted checks (timed on PR #253's run) now sit on
 * c, d, e and f, each aiming at ~12-13 min against the job's 45-minute limit.
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
/**
 * theme-check and no-wrap-check on their own jobs (check plumbing, 14 Nov 2026, approved by Joe). Their screens are found
 * at run time (the core list in scripts/theme-screens.ts, then every scripts/screens/<area>.ts, scripts/area-screens.ts),
 * and `--part=k/n` takes every n-th draw from the k-th, so each part is within one draw of total ÷ n whatever the screens
 * are: adding screens never needs an edit here. `parts` is fixed with headroom (about 30 draws a part on 14 Nov 2026, so
 * each can roughly double before it nears its time limit); ci-shards-check fails once any part passes `ceiling` draws,
 * long before a timeout, and only then are the parts raised here: a pre-approved routine consequence for any session
 * or the captain, marked "Changed with Joe's approval, 14 Nov 2026 (routine: page-check growth)". Each job runs `parts ÷ jobs`
 * parts one after another, each its own check run with its own time limit.
 */
export const PAGE_CHECK_SPLITS: Record<string, { parts: number; jobs: number; prefix: string; ceiling: number }> = {
  // Changed with Joe's approval, 14 Nov 2026 (routine: page-check growth): re-picked on main's merged screens (the step-3
  // train: 890 theme-check and 1,130 no-wrap-check draws), back to about 30 draws a part; were 24 parts / 4 jobs and 30 / 6.
  // Changed with Joe's approval, 14 Nov 2026 (routine: page-check growth): 30 parts / 5 jobs → 48 / 8 on the puzzle
  // train's combined screens (1,411 draws: about 29 a part and 176 a job, as on main before).
  "theme-check.tsx": { parts: 48, jobs: 8, prefix: "play-theme", ceiling: 40 },
  // Changed with Joe's approval, 14 Nov 2026 (routine: page-check growth): 36 → 42 parts on the Number overhaul's
  // reveal screens (1,442 draws, about 34 a part).
  // Changed with Joe's approval, 14 Nov 2026 (routine: page-check growth): 36 → 42 parts (the Word overhaul's level
  // screens took every part to 41 draws; 42 parts give about 35 a part), jobs unchanged.
  // Changed with Joe's approval, 14 Nov 2026 (routine: page-check growth): 36 → 38 parts for the Attention levels' Expert pages.
  // Changed with Joe's approval, 16 Nov 2026 (routine: puzzle train combine): 42, the larger.
  // Changed with Joe's approval, 14 Nov 2026 (routine: page-check growth): 42 parts / 6 jobs → 54 / 9 on the puzzle
  // train's combined screens (1,760 draws: about 33 a part and 196 a job, near main's 188).
  "no-wrap-check.tsx": { parts: 54, jobs: 9, prefix: "play-nowrap", ceiling: 40 },
};

/** The jobs PAGE_CHECK_SPLITS gives: `<prefix>-<j>` runs parts j, j + jobs, j + 2 × jobs… of its check. */
export function pageCheckJobs(): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [file, { parts, jobs, prefix }] of Object.entries(PAGE_CHECK_SPLITS))
    for (let j = 1; j <= jobs; j++)
      out[`${prefix}-${j}`] = Array.from({ length: parts }, (_, i) => i + 1)
        .filter((k) => (k - 1) % jobs === j - 1)
        .map((k) => `${file}@${k}/${parts}`);
  return out;
}

export const SHARDS: Record<string, string[]> = {
  // Headless Chromium: arcade-play-check's 22 active games (Pinball included, and Letterfall,
  // Tenfall, Mixed Signals, Bonk, Pull!) in five groups (one job each, one game at a time, so
  // frame times compare fairly with the CI baseline; the groups are unchanged). The workflow
  // installs the browser and swaps in the CI frame-time baseline for these.
  // arcade-device-bottom-check (15 Oct 2026: every arcade play screen on iPhone 11 / 14 home-screen
  // app and Safari geometry) is in seven parts (17 Oct 2026: in halves, a half with the Meteor passes ran
  // past run-checks' 300 s on CI; 31 Oct 2026: with the Cards & Board and Sports games a third of the layout
  // passes, 13 games, reached the check's 270 s watchdog on CI; 2 Nov 2026 in eight: with Pyramid and Golf
  // Solitaire a quarter, 11 games, reached it again): its games' layout passes in fifths (@1/8, @2/8 here, @3/8 on
  // play10, @4/8 on play19, @5/8 on play20; ~8 games each), and its three Meteor bottom-edge passes (full, reduced
  // motion, reduced effects; ~1.5-2 min each with a dev server) one each on play7-play9 (@6/8-@8/8).
  play1: ["arcade-play-check.ts@1/5", "arcade-device-bottom-check.ts@1/8"],
  play2: ["arcade-play-check.ts@2/5", "arcade-device-bottom-check.ts@2/8"],
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
  play7: ["bottom-clearance-check.ts@2/8", "arcade-device-bottom-check.ts@6/8", "arcade-room-practice-check.ts@2/3"],
  play8: ["bottom-clearance-check.ts@3/8", "arcade-device-bottom-check.ts@7/8", "arcade-room-practice-check.ts@3/3"],
  // standard-live-check (29 Oct 2026: a production build of the app, then real practice rounds of nine standard puzzles
  // in Chromium, ~4 min) needs Chromium, so it rides on one of the lightest play jobs.
  play9: ["bottom-clearance-check.ts@4/8", "arcade-device-bottom-check.ts@8/8", "standard-live-check.ts"],
  play10: ["bottom-clearance-check.ts@5/8", "arcade-device-bottom-check.ts@3/8"],
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
  play15: ["arcade-room-practice-check.ts@1/3", "fission-repeat-check.ts", "app-shell-check.ts", "demo-intro-check.ts@6/6"],
  // share-check (21 Oct 2026: the podium's Share button, its text, link, clipboard fallback and card in the
  // harness, ~1 min with its dev server) rides here.
  // number-demos-check (16 Nov 2026, the Number overhaul's intro demos, ~105 s whole) in halves, one beside share-check
  // and one beside offline-check.
  // goal-line-check (22 Nov 2026: every puzzle's goal line on its live round at 375×667 and 390×844, never cut short;
  // ~5.5 min whole with its dev server) in thirds, all here (~2 min each locally, well under the 300 s per-check limit).
  play17: ["share-check.ts", "number-demos-check.ts@1/2", "goal-line-check.ts@1/3", "goal-line-check.ts@2/3", "goal-line-check.ts@3/3"],
  // Prompt D (23 Oct 2026): demo-intro-check (every active game's intro from its first frame to its demo playing,
  // with and without a demo, as an iPhone 11 home-screen app; ~8 s a game) and replay-board-check (46 puzzle replays on
  // the room's results screen, ~2 min). demo-intro-check in sixths since 8 Nov 2026: its thirds took 197–300 s on CI
  // against the 300 s limit per check and timed out often; four sixths here, the fifth on play19 in the third's place,
  // the sixth on play15 (the lightest play job, ~7 min).
  // room-e2e-check (14 Nov 2026, Security C1a, ~3 min with its dev server): two phones on the real app get each round's
  // puzzle only from its intro; here beside demo-intro's four sixths (286 s on the 13 Nov Full suite).
  play18: ["demo-intro-check.ts@1/6", "demo-intro-check.ts@2/6", "demo-intro-check.ts@3/6", "demo-intro-check.ts@4/6", "room-e2e-check.ts"],
  play19: ["demo-intro-check.ts@5/6", "replay-board-check.ts", "arcade-device-bottom-check.ts@4/8"],
  // Offline practice (31 Oct 2026): offline-check builds the app for production, installs the service worker, fills
  // every practice pack, plays three games offline, uploads the queue and swaps in a new build's worker (~5 min).
  // arcade-device-bottom-check's fifth layout part (@5/8, 2 Nov 2026) rides here, the lightest play job (~3.5 min).
  play20: ["offline-check.ts", "arcade-device-bottom-check.ts@5/8", "number-demos-check.ts@2/2"],
  // Browser checks that used to ride in the fast shards (1 Nov 2026): help-scroll-check (Chromium on a static page,
  // ~110 s, from g), battery-check (~190 s) and practice-switch-check (~60 s), both unlisted in the catch-all
  // before. BROWSER_CATCH_ALL: any browser check no shard lists runs here too.
  play21: ["help-scroll-check.tsx", "battery-check.ts", "practice-switch-check.ts"],
  // The computer layout (31 Oct 2026, docs/desktop-layout.md): desktop-layout-check in thirds (part 1 also the tab
  // pages, rooms of 16, phones and a touch screen at three desktop sizes; each part a third of the active games'
  // desktop modes at 1440x900, ~3-4 min each with its dev server), desktop-fairness-check (~2 min), and
  // arcade-play-check's desktop pass in halves (arcade-play-desktop-check: every arcade game at 1440x900 and
  // 1920x1080, ~6 min each).
  // arena-world-check (15 Nov 2026, the arena's fairness rule: every arcade play screen on a phone, a sideways tablet
  // and a computer, ~13 min whole) in quarters, one beside each of these four (~3.5 min a part).
  play22: ["desktop-layout-check.ts@1/3", "desktop-fairness-check.ts", "arena-world-check.ts@1/4"],
  play23: ["desktop-layout-check.ts@2/3", "desktop-layout-check.ts@3/3", "arena-world-check.ts@2/4"],
  play24: ["arcade-play-desktop-check.ts@1/2", "arena-world-check.ts@3/4"],
  play25: ["arcade-play-desktop-check.ts@2/2", "arena-world-check.ts@4/4"],
  // theme-check and no-wrap-check: their own jobs, worked out from PAGE_CHECK_SPLITS (above). Never list their parts by hand.
  ...pageCheckJobs(),
  // Non-browser checks. puzzle-bank-check's every-entry verification and
  // arcade-self-replay-check's entries are split into parts on separate jobs.
  // ~282 s of checks on run 38608375501's times.
  a: [
    "logic-levels-check.ts@1/4",
    // From g's catch-all (7 Nov 2026 rebalance, docs/audit-nov-2026/build-health.md item 10; ~188 s on Checks run
    // 42372376743): g ran 805 s of checks, a 298.
    "sound-retheme-check.ts",
    "flip-deal-check.ts",
    "ink-v14-check.ts",
    "puzzle-polish-nov-check.ts",
    "slice-food-check.ts",
    "tilt-rev12-check.ts",
    "sound-nov-2026-check.ts",
    // arcade-room-schedule-check in thirds (1 Nov 2026: Grappler swingRev 16's 90 s runs took the whole check to ~4.8 min).
    "arcade-room-schedule-check.ts@1/3",
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
    // Full-depth split (10 Nov 2026): at CHECKS_FULL=1 these ran ~340 s (swing-assault), ~540 s (cards) and ~400 s
    // (orbit-fuel) whole on CI, past run-checks' 300 s; each part is well under 200 s, the parts together the whole check.
    // Full-depth split (10 Nov 2026, second pass): freekick-check (timed out at 300 s on run 42746046136) in quarters, and
    // cards-check re-split into eighths (a quarter took 241 s there); each part well under 200 s on CI.
    "cards-check.ts@5/8",
    // From g's catch-all (21 Nov 2026 rebalance, ~364 s on Checks run 44837437683): g had reached ~44 min of its 45-minute job limit.
    "freekick-layered-check.ts",
    "number-levels-checkout-kakuro-check.ts",
    "skins-replay-check.ts",
    "cards-levels-order-check.ts",
    "logic-1-steps-check.ts",
    "curling-overhaul-check.ts",
    "solver-progress-check.ts",
    "word-overhaul-check.ts",
    "bastion-levels-check.ts",
    "room-late-run-check.ts",
    "difficulty-check.ts",
    "skyline-levels-check.ts",
  ],
  // ~282 s of checks on run 38608375501's times.
  b: [
    // B4's deal identity (9 Nov 2026, docs/audit-nov-2026/architecture.md): every game's deal and each pin against main, ~6 min whole, in quarters.
    "deal-identity-check.ts@1/4",
    // From g's catch-all (7 Nov 2026 rebalance; ~10 s on run 42372376743).
    "arcade-tuning-g3-check.ts",
    // arcade-fx-check in thirds (3 Nov 2026: Curl Champ's, Apex's and Cue Ball's runs took the whole check past 5 min locally).
    "arcade-fx-check.ts@2/3",
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
    // Full-depth split (10 Nov 2026): at CHECKS_FULL=1 these ran ~340 s (swing-assault), ~540 s (cards) and ~400 s
    // (orbit-fuel) whole on CI, past run-checks' 300 s; each part is well under 200 s, the parts together the whole check.
    "swing-assault-check.ts@2/3",
    // Full-depth split (10 Nov 2026, second pass): freekick-check (timed out at 300 s on run 42746046136) in quarters, and
    // cards-check re-split into eighths (a quarter took 241 s there); each part well under 200 s on CI.
    "freekick-check.ts@3/4",
    "cards-check.ts@3/8",
    // From g's catch-all (21 Nov 2026 rebalance, ~565 s on Checks run 44837437683): g had reached ~44 min of its 45-minute job limit.
    "pool-levels-check.ts",
    "ink-levels-check.ts",
    "retro-overhaul-check.ts",
    "sound-review-fixes-check.ts",
    "skins-check.ts",
    "pattern-overhaul-unblock-levels-check.ts",
    "pattern-overhaul-gravity-levels-check.ts",
    "wavefront-deal-check.ts",
    "pattern-overhaul-laser-levels-check.ts",
    "word-nov7-check.ts",
    "pattern-overhaul-flow-levels-check.ts",
    "wavefront-phone-check.ts",
    "codeword-levels-check.ts",
    "security-fixes-check.ts",
  ],
  // ~282 s of checks on run 38608375501's times.
  c: [
    "logic-levels-check.ts@2/4",
    // seat-key-check (14 Nov 2026, Security C1b, ~2 s, happy-dom): room-mates told apart by public id (me, host, chat,
    // muting, reactions, absent rivals) and stand-in rows by account id.
    "seat-key-check.tsx",
    // B4's deal identity (9 Nov 2026, docs/audit-nov-2026/architecture.md): every game's deal and each pin against main, ~6 min whole, in quarters.
    "deal-identity-check.ts@2/4",
    // 7 Nov 2026 rebalance (~191 s on run 42372376743): orbit-camera-check from e (e ran 641 s, c 334), the rest
    // from g's catch-all.
    "orbit-camera-check.ts",
    "standings-reveal-check.tsx",
    "snip-x200-check.ts",
    "flightpath-hit-check.ts",
    "standard-attention-check.ts",
    "swing-slide-check.ts",
    // From g's catch-all (3 Nov 2026 rebalance; ~138 s on PR #253's CI times): g ran ~31 min, d-f 6-10.
    "scoring-bands-check.ts",
    "scoring-rev3-check.ts",
    "ink-v13-check.ts",
    "burst-standard-check.ts",
    "bastion-check.ts",
    "orbit-levels-check.ts",
    "flip-levels-check.ts",
    "d5-remodels-check.ts",
    "ink-v11-check.ts",
    "hover-standard-check.ts",
    "fences-check.ts",
    // arcade-room-schedule-check in thirds (1 Nov 2026: Grappler swingRev 16's 90 s runs took the whole check to ~4.8 min).
    "arcade-room-schedule-check.ts@2/3",
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
    // Full-depth split (10 Nov 2026): at CHECKS_FULL=1 these ran ~340 s (swing-assault), ~540 s (cards) and ~400 s
    // (orbit-fuel) whole on CI, past run-checks' 300 s; each part is well under 200 s, the parts together the whole check.
    "swing-assault-check.ts@3/3",
    "orbit-fuel-check.ts@1/3",
    // Full-depth split (10 Nov 2026, second pass): freekick-check (timed out at 300 s on run 42746046136) in quarters, and
    // cards-check re-split into eighths (a quarter took 241 s there); each part well under 200 s on CI.
    "freekick-check.ts@1/4",
    "cards-check.ts@1/8",
    "cards-check.ts@8/8",
    // From g's catch-all (21 Nov 2026 rebalance, ~89 s on Checks run 44837437683): g had reached ~44 min of its 45-minute job limit.
    "orbit-overhaul-check.ts",
    "gemstone-levels-check.ts",
    "logic-1-levels-check.tsx",
    "pattern-overhaul-pipes-levels-check.ts",
    "depth-wordsearch-check.ts",
    "hover-x200-check.ts",
    "wavefront-expand-check.ts",
  ],
  // ~282 s of checks on run 38608375501's times.
  d: [
    // B4's deal identity (9 Nov 2026, docs/audit-nov-2026/architecture.md): every game's deal and each pin against main, ~6 min whole, in quarters.
    "deal-identity-check.ts@3/4",
    // From g's catch-all (3 Nov 2026 rebalance; ~360 s on PR #253's CI times): g ran ~31 min, d-f 6-10.
    "arcade-room-identity-check.ts",
    "flip-rev11-check.ts",
    "room-practice-grade-check.ts",
    "racing-render-check.ts",
    "cross-rev11-check.ts",
    // Full-depth split (10 Nov 2026): at CHECKS_FULL=1 these ran ~340 s (swing-assault), ~540 s (cards) and ~400 s
    // (orbit-fuel) whole on CI, past run-checks' 300 s; each part is well under 200 s, the parts together the whole check.
    "swing-assault-check.ts@1/3",
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
    // Full-depth split (10 Nov 2026, second pass): freekick-check (timed out at 300 s on run 42746046136) in quarters, and
    // cards-check re-split into eighths (a quarter took 241 s there); each part well under 200 s on CI.
    "freekick-check.ts@4/4",
    "cards-check.ts@4/8",
    // From g's catch-all (21 Nov 2026 rebalance, ~297 s on Checks run 44837437683): g had reached ~44 min of its 45-minute job limit.
    "wordslide-levels-check.ts",
    "cards-levels-check.ts",
    "ricochet-overhaul-check.ts",
    "swing-overhaul-check.ts",
    "balltrack-levels-check.ts",
    "empty-sports-runs-check.ts",
    "number-overhaul-checkout-kakuro-check.ts",
    "speed-levels-check.ts",
    "practice-receipt-check.ts",
    "number-levels-measure-numline-check.ts",
    "swing-levels-check.ts",
  ],
  // ~282 s of checks on run 38608375501's times.
  e: [
    // The existing voice and crowd cues on their events (18 Nov 2026, the sound wiring; ~90 s, too slow for the catch-all).
    "voice-cues-check.ts",
    // B4's deal identity (9 Nov 2026, docs/audit-nov-2026/architecture.md): every game's deal and each pin against main, ~6 min whole, in quarters.
    "deal-identity-check.ts@4/4",
    // From g's catch-all (3 Nov 2026 rebalance; ~231 s on PR #253's CI times): g ran ~31 min, d-f 6-10.
    "daily-check.ts",
    // server-functions-check (7 Nov 2026, ~5 s): the room, chat, daily, async-room and challenge server functions
    // run against every migration on a local PostgreSQL (scripts/server-fn-harness.ts), beside the other SQL checks.
    "server-functions-check.ts",
    // pattern-demos-check (15 Nov 2026, ~5 s): the Pattern overhaul's intro demos (scripts/fixtures/pattern-demos.json),
    // the real example deal, grade and save functions and the save script on a local PostgreSQL, beside the SQL checks.
    "pattern-demos-check.ts",
    // round-engine-parity-check (9 Nov 2026, B6, ~35 s locally): the round engine against main da93f5d's own code
    // (scripts/round-engine/legacy.ts, temporary until wave 3): deals, receipts, grades, stored rows, windows, rankings.
    "round-engine-parity-check.ts",
    // migrations-check (9 Nov 2026, ~5 s): the automatic migration applier (scripts/migrate.ts) and its
    // destructive guard on a local PostgreSQL, beside the other SQL checks.
    "migrations-check.ts",
    // accounts-check (10 Nov 2026, ~6 s): the accounts backend through the server functions, supabase-js Auth calls and
    // every migration on a local PostgreSQL (the server-function harness), beside the other SQL checks.
    "accounts-check.ts",
    // moderation-check (10 Nov 2026, ~20 s): safety (Turnstile, the new-guest limit, reports, the automatic mute, Joe's
    // moderation functions, bans, retention) through the server functions on a local PostgreSQL, beside accounts-check.
    "moderation-check.ts",
    // security-rooms-check (13 Nov 2026, ~40 s): private room channels, server-sent reactions, chat for players still
    // in the room, removals, Finish now (an Arena duel played to its end) and the rated cooldown on a local PostgreSQL.
    "security-rooms-check.ts",
    // security-trials-check (13 Nov 2026, ~10 s): the report-only content security policy and its /csp-report table,
    // the arcade wall-clock log, Tally's keyed reference and the runbook worker, beside the other SQL checks.
    "security-trials-check.ts",
    // server-input-check (14 Nov 2026, Security C2, ~5 s): every server function outside rooms and chat builds its
    // input through src/lib/validate.ts and refuses a crafted one before its handler runs, on a local PostgreSQL.
    "server-input-check.ts",
    // room-start-check and round-release-check (14 Nov 2026, Security C1a, ~10 s each): the deal claim and the one-transaction
    // start; rounds released one at a time from each intro; on a local PostgreSQL, beside the other SQL checks.
    "room-start-check.ts",
    "round-release-check.ts",
    // public-ids-check (14 Nov 2026, Security C1b, ~10 s): room-mates by public id only (grants, device reads, the sweep).
    "public-ids-check.ts",
    // economy-check (wave 2 A1, 10 Nov 2026, ~8 s): coins and items (the catalogue against catalogue.json, the coin
    // ledger and its races, consumables, ownership, equipping, the avatar, Joe's tools) on a local PostgreSQL through
    // the server-function harness, beside accounts-check.
    "economy-check.ts",
    // skins-db-check (wave 2 E1, 11 Nov 2026, ~10 s): the card-back move and the result looks' triggers on a local
    // PostgreSQL, and the ghost-looks server function, beside economy-check.
    "skins-db-check.ts",
    // customise-looks-db-check (12 Nov 2026, ~5 s): Customise's Games tab path through A1's real equip on a local
    // PostgreSQL, a second device, and the games' renderers; with the database checks.
    "customise-looks-db-check.ts",
    // push-notifications-check (wave 2 B2, 11 Nov 2026, ~5 s): phone notifications (RFC 8291 / VAPID, the six events,
    // the cap and quiet hours, the streak reminder, subscriptions, RLS, the service worker's push listeners) on a local
    // PostgreSQL through the server-function harness, beside economy-check.
    "push-notifications-check.ts",
    // push-testers-check (11 Nov 2026, ~5 s): with the key set, notifications for testers #0001 and #0002 only (the
    // ask and panel in happy-dom, subscriptions and every send on PostgreSQL).
    "push-testers-check.tsx",
    // badges-check (wave 2 C2, 11 Nov 2026, ~10 s): badges, titles, the sign-up and founding rewards, the backfill and the
    // Daily streak on the account, on a local PostgreSQL through the server-function harness, beside economy-check.
    "badges-check.ts",
    // ratings-check (wave 3 W3a, 14 Nov 2026, ~10 s): the ratings engine (the Glicko-2 targets on simulated players,
    // placement, tiers and caps, recorded runs, the 4th-match rule, Joules, the competitive badges) on a local
    // PostgreSQL through the server-function harness, beside badges-check.
    "ratings-check.ts",
    // rated-week-change-check (P1, 21 Nov 2026, ~10 s): Home's "+22 this week" from the stored rated matches.
    "rated-week-change-check.ts",
    // practice-progress-check (wave 2 C1a, 11 Nov 2026, ~15 s): practice stars, bests and gems on the account (the stored
    // breakdown against a room's, 175 / 174, the fresh start, gems, two devices, roles) on a local PostgreSQL.
    "practice-progress-check.ts",
    // progress-cache-check (wave 2 C1a, 11 Nov 2026, ~1 s): the display-only copy of the server's last practice progress.
    "progress-cache-check.ts",
    // shop-check (wave 2 D1, 11 Nov 2026, ~15 s): the daily shop over a simulated two years, the Monday bundles, coin
    // packs and the £ line, then buying, bundles, test packs, the wishlist and the tester list on a local PostgreSQL
    // through the server-function harness, beside economy-check.
    "shop-check.ts",
    // cosmetics-withdrawn-check (13 Nov 2026, ~10 s): withdrawn cosmetics offered nowhere, owners keep them, Joe's
    // one-line restore, the Top 500 frame's grant and card backs on Summit, Thirteen and Five Hands, on a local PostgreSQL
    // through the server-function harness, beside shop-check.
    "cosmetics-withdrawn-check.ts",
    // plus-check (wave 2 E2, 13 Nov 2026, ~20 s): Joulz Plus (test purchases, the monthly perks across month
    // boundaries, the premium pass binding, the PLUS chip), early access, the Daily archive kept off boards, streaks
    // and badges, and the public cosmetics, on a local PostgreSQL through the server-function harness.
    "plus-check.ts",
    // cosmetics-art-check (wave 2 E2, ~2 s): the cosmetics' art data against its sources, every finish on all 32
    // avatars, the emotes, scenes and tile styles, and nothing changed with nothing equipped. No browser.
    "cosmetics-art-check.ts",
    // pass-check (wave 2 D2, 13 Nov 2026, ~20 s): the Season pass, Joules from stored results, the day limits and soft
    // cap, claiming, the premium track and the weekly challenges on a local PostgreSQL through the server-function
    // harness, beside shop-check.
    "pass-check.ts",
    // seasons-check (wave 4 W4d, 15 Nov 2026, ~10 s): seasons for ratings (the season end, the reset on W3a's tables, the
    // peak-tier rewards, a full test-season end and Joe's close), on a local PostgreSQL.
    "seasons-check.ts",
    // moderation-ui-check (10 Nov 2026, ~3 s, happy-dom): two taps to report from a name and from a message.
    "moderation-ui-check.tsx",
    // account-screens-check (10 Nov 2026, ~10 s): the sign-up screens' rules, the save-progress events' server function
    // and usernames in rooms, Dailies and challenges, through the server-function harness, beside accounts-check.
    "account-screens-check.ts",
    // rated-server-check (wave 3 W3b, 11 Nov 2026, ~5 s): rated matchmaking end to end (the queue, live and recorded
    // matches, the hidden finish, settling once, rematch, rated chat, events) on a local PostgreSQL through the
    // server-function harness, beside accounts-check; rated-matchmaking-check (~1 s) proves the pure rules.
    "rated-server-check.ts",
    "rated-matchmaking-check.ts",
    // rated-multi-server-check (wave 3 W3d, 11 Nov 2026, ~10 s): a 4-player rated match through W3b's queue, rooms and
    // settling on a local PostgreSQL through the server-function harness; rated-multi-check (~2 s) the rules and screens.
    "rated-multi-server-check.ts",
    // friends-check (wave 2 B1, 11 Nov 2026, ~5 s): friends (search's age rules, invite links, requests, accept,
    // decline, remove, block, status, invites, challenges, the limits and cap, RLS, B2's events) on a local PostgreSQL
    // through the server-function harness, beside accounts-check; friends-ui-check (~3 s, happy-dom) the screens.
    "friends-check.ts",
    "friends-ui-check.tsx",
    // leaderboards-check (wave 4 W4a, 11 Nov 2026, ~25 s): rating boards, the Daily top 100, privacy, the Daily badges'
    // field sizes and read-only boards on a local PostgreSQL through the server-function harness, beside accounts-check;
    // leaderboards-ui-check (~2 s, happy-dom) the screens.
    "leaderboards-check.ts",
    "leaderboards-ui-check.tsx",
    // practice-challenges-check (wave 2 C1b, 11 Nov 2026, ~40 s): the challenge catalogue's checker on real graded runs,
    // speed goals against the grader, the six stored facts, coins once per account and guests paid on sign-up on a local
    // PostgreSQL through the server-function harness, beside accounts-check.
    "practice-challenges-check.ts",
    // tournaments-check (wave 4 W4b, 11 Nov 2026, ~30 s): the schedule, the Arena's points, streak and pairing, Score
    // Attack, entry and refunds, prizes with the safeguard, trophies and badges once, never a rating, on a local
    // PostgreSQL through the server-function harness; tournaments-screens-check (~2 s) the hub's screens.
    "tournaments-check.ts",
    "tournaments-screens-check.tsx",
    // tournament-events-server-check (wave 4 W4c, 11 Nov 2026, ~15 s): the Category Cup (Swiss) and the Joulz
    // Championship (Knockout) end to end on a local PostgreSQL through the server-function harness: switched off by
    // default, entry and refunds, pairings, the bracket, prizes paid once; tournament-events-check (~6 s) proves the
    // pure rules.
    "tournament-events-server-check.ts",
    "tournament-events-check.ts",
    "tournament-plates-check.tsx",
    "identity-everywhere-check.tsx",
    "ink-x200-check.ts",
    "depth4-check.ts",
    "room-figures-check.ts",
    "puzzle-batch-nov-check.ts",
    "moon-blockzone-check.ts",
    "orbit-expand-check.ts",
    "depth-swapword-check.ts",
    "tilt-expand-check.ts",
    "haptics-check.tsx",
    // arcade-room-schedule-check in thirds (1 Nov 2026: Grappler swingRev 16's 90 s runs took the whole check to ~4.8 min).
    "arcade-room-schedule-check.ts@3/3",
    "category-pool-check.ts",
    "dig-check.ts",
    "hotfloor-flip-check.ts",
    "iceslide-portals-check.ts",
    "ink-line-check.ts",
    "ink-rev3-fix-check.ts",
    "number-batch-check.ts",
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
    // Full-depth split (10 Nov 2026): at CHECKS_FULL=1 these ran ~340 s (swing-assault), ~540 s (cards) and ~400 s
    // (orbit-fuel) whole on CI, past run-checks' 300 s; each part is well under 200 s, the parts together the whole check.
    "orbit-fuel-check.ts@2/3",
    // Full-depth split (10 Nov 2026, second pass): freekick-check (timed out at 300 s on run 42746046136) in quarters, and
    // cards-check re-split into eighths (a quarter took 241 s there); each part well under 200 s on CI.
    "freekick-check.ts@2/4",
    "cards-check.ts@2/8",
    // action-demos-check (15 Nov 2026, ~6 s): the six Action intro demos, their save end to end on a local PostgreSQL
    // through the server-function harness (PostgreSQL is installed on this shard), beside server-functions-check.
    "action-demos-check.ts",
    // From g's catch-all (21 Nov 2026 rebalance, ~86 s on Checks run 44837437683): g had reached ~44 min of its 45-minute job limit.
    "partial-credit-check.ts",
    "voice-lines-check.ts",
    "attention-levels-check.ts",
    "bubble-levels-check.ts",
    "standard-pattern-check.ts",
    "pattern-overhaul-gravity-check.ts",
    "pattern-overhaul-iceslide-check.ts",
  ],
  // ~282 s of checks on run 38608375501's times.
  f: [
    "logic-levels-check.ts@3/4",
    // From g's catch-all (7 Nov 2026 rebalance; ~10 s on run 42372376743).
    "pool-check.ts",
    // From g's catch-all (3 Nov 2026 rebalance; ~336 s on PR #253's CI times): g ran ~31 min, d-f 6-10.
    "arcade-standard-check.ts",
    // Full-depth split (10 Nov 2026): at CHECKS_FULL=1 these ran ~340 s (swing-assault), ~540 s (cards) and ~400 s
    // (orbit-fuel) whole on CI, past run-checks' 300 s; each part is well under 200 s, the parts together the whole check.
    "cross-x200-check.ts",
    "fillomino-check.ts",
    "bintoss-standard-check.ts",
    "tilt-rev11-check.ts",
    "flip-x200-check.ts",
    "arcade-phone-notes-check.ts",
    "challenge-check.ts",
    "arcade-batch4-check.ts",
    // arcade-fx-check in thirds (3 Nov 2026: Curl Champ's, Apex's and Cue Ball's runs took the whole check past 5 min locally).
    "arcade-fx-check.ts@1/3",
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
    // Full-depth split (10 Nov 2026, second pass): freekick-check (timed out at 300 s on run 42746046136) in quarters, and
    // cards-check re-split into eighths (a quarter took 241 s there); each part well under 200 s on CI.
    "cards-check.ts@6/8",
    // From g's catch-all (21 Nov 2026 rebalance, ~436 s on Checks run 44837437683): g had reached ~44 min of its 45-minute job limit.
    "pool-overhaul-check.ts",
    "pattern-overhaul-push-levels-check.ts",
    "flip-overhaul-check.ts",
    "sound-on-demand-check.ts",
    "number-levels-balance-target-check.ts",
    "skyline-overhaul-check.ts",
    "wordhunt-levels-check.ts",
    "net-request-check.ts",
    "analytics-events-check.ts",
    "ranking-identity-check.ts",
    "bubble-standard-check.ts",
    "wordsearch-levels-check.ts",
  ],
  // ~282 s of checks on run 38608375501's times.
  g: [
    "logic-levels-check.ts@4/4",
    // arcade-fx-check in thirds (3 Nov 2026: Curl Champ's, Apex's and Cue Ball's runs took the whole check past 5 min locally).
    "arcade-fx-check.ts@3/3",
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
    // Full-depth split (10 Nov 2026): at CHECKS_FULL=1 these ran ~340 s (swing-assault), ~540 s (cards) and ~400 s
    // (orbit-fuel) whole on CI, past run-checks' 300 s; each part is well under 200 s, the parts together the whole check.
    "orbit-fuel-check.ts@3/3",
    // Full-depth split (10 Nov 2026, second pass): freekick-check (timed out at 300 s on run 42746046136) in quarters, and
    // cards-check re-split into eighths (a quarter took 241 s there); each part well under 200 s on CI.
    "cards-check.ts@7/8",
  ],
};

/**
 * Checks too slow at full depth (CHECKS_FULL=1, the weekly run and Actions → Checks → "full") to run whole inside
 * run-checks' 300 s on CI, and the parts each runs in, so each part stays well under 200 s there. ci-shards-check
 * requires each to be listed in SHARDS as exactly these n parts (never whole, never left to a catch-all) and to take
 * --part. Add a check here when a full-depth run shows it near 200 s.
 */
export const FULL_DEPTH_SPLITS: Record<string, number> = {
  "swing-assault-check.ts": 3,
  "orbit-fuel-check.ts": 3,
  "cards-check.ts": 8,
  "freekick-check.ts": 4,
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
