/**
 * depth-wordslide-check (25 Oct 2026, word depth d1; docs/depth/d1-word.md): Slider's par moves, `wordSlideRev 1`.
 *   1. 744 rounds on the pre-depth stamp (no wordSlideRev), recorded from the kit players before the change
 *      (scripts/fixtures/depth-wordslide-legacy.json.gz), regrade to their stored score, verdict and extra.
 *   2. New rounds deal wordSlideRev 1 on the same board; a pinned deal is the pre-depth puzzle exactly.
 *   3. Every kit answer at nine clock shares: unfinished and over-par finishes score as today, a finish within par
 *      adds 1–50, nothing above 150 without par, scores 0–200, the breakdown adds up, more time never scores less.
 *   4. Bands: the good player within 10 % of today, near-perfect about 150–165, elite best 190–200.
 *   5. Texts: intro and help state {max} and the par bonus.
 *
 *   bun scripts/depth-wordslide-check.ts            # ~10 s
 *   bun scripts/depth-wordslide-check.ts --record   # re-record the legacy fixture (pinned to the pre-depth stamp)
 */
import type { PuzzleData } from "../src/lib/duel/types";
import { pinPreStandard } from "../src/lib/duel/standard/stamps";
// Written for the stamps before the scoring standard (docs/scoring-standard.md): new deals keep them.
pinPreStandard(true);
import { WORD_SLIDE_REV_PAR } from "../src/lib/duel/wordSlide";
import { runParCheck } from "./depth-par-lib";
import { pinPreTopup } from "../src/lib/duel/depthTopup";

// The puzzle top-up (26 Oct 2026, docs/depth/topup-oct-2026.md) deals newer stamps; this check proves the stamps it was
// written for, so new deals are pinned to them (depth-topup-check proves the top-up's).
pinPreTopup(true);

runParCheck({
  type: "wordslide",
  fixture: "scripts/fixtures/depth-wordslide-legacy.json.gz",
  stampOf: (p) => (p as { wordSlideRev?: number }).wordSlideRev,
  depthStamp: WORD_SLIDE_REV_PAR,
  preStamp: undefined,
  toPre: (p) => {
    const { wordSlideRev: _, ...rest } = p as PuzzleData & { wordSlideRev?: number };
    return rest as PuzzleData;
  },
  usedPar: (e) => ({ used: Number(e.moves), par: Number(e.par) }),
});
