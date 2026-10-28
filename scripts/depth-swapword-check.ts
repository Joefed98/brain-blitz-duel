/**
 * depth-swapword-check (25 Oct 2026, word depth d1; docs/depth/d1-word.md): Swapword's par swaps, `swapwordRev 4`.
 *   1. 956 rounds on swapwordRev 3, recorded from the kit players before the change
 *      (scripts/fixtures/depth-swapword-legacy.json.gz), regrade to their stored score, verdict and extra.
 *   2. New rounds deal swapwordRev 4 on rev 3's board and budget; a pinned deal is the rev-3 puzzle exactly.
 *   3. Every kit answer at nine clock shares: unfinished and over-par finishes score as today, a finish in the
 *      fewest swaps adds 1–50, nothing above 150 without par, scores 0–200, the breakdown adds up, more time never
 *      scores less.
 *   4. Bands: the good player within 10 % of today, near-perfect about 150–165, elite best 190–200.
 *   5. Texts: intro and help state {max} and the par bonus.
 *
 *   bun scripts/depth-swapword-check.ts            # ~10 s
 *   bun scripts/depth-swapword-check.ts --record   # re-record the legacy fixture (pinned to the pre-depth stamp)
 */
import { SWAPWORD_REV3, SWAPWORD_REV_PAR } from "../src/lib/duel/swapword";
import { pinPreStandard } from "../src/lib/duel/standard/stamps";
// Written for the stamps before the scoring standard (docs/scoring-standard.md): new deals keep them.
pinPreStandard(true);
import type { PuzzleData, SwapwordPuzzleData } from "../src/lib/duel/types";
import { runParCheck } from "./depth-par-lib";
import { pinPreTopup } from "../src/lib/duel/depthTopup";

// The puzzle top-up (26 Oct 2026, docs/depth/topup-oct-2026.md) deals newer stamps; this check proves the stamps it was
// written for, so new deals are pinned to them (depth-topup-check proves the top-up's).
pinPreTopup(true);

runParCheck({
  type: "swapword",
  fixture: "scripts/fixtures/depth-swapword-legacy.json.gz",
  stampOf: (p) => (p as SwapwordPuzzleData).swapwordRev,
  depthStamp: SWAPWORD_REV_PAR,
  preStamp: SWAPWORD_REV3,
  toPre: (p) => ({ ...(p as SwapwordPuzzleData), swapwordRev: SWAPWORD_REV3 }) as PuzzleData,
  usedPar: (e) => ({ used: Number(e.swaps), par: Number(e.minSwaps) }),
});
