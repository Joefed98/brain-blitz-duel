/**
 * arcade-standard-check's case for `bintoss` (see ./case.ts): Swish binRev 9 (docs/arcade-standard/bintoss.md).
 * Buckets 13 each plus 1 a close miss, up to 130; Far buckets 6 each (throws 1–6), up to 36; Hoops 8 each of 3, up to
 * 24; All ten in 10. The core counts `baskets`; All ten in reads the per-throw `results` (every one of ten a basket).
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  binTossGameFor,
  binTossStdParts,
  BINTOSS_FAR_THROWS,
  BINTOSS_HOOP_COUNT,
  BINTOSS_REV_SMALL_FAR,
  BINTOSS_REV_STD,
  BINTOSS_THROWS,
  BINTOSS_V9_BUCKET,
  BINTOSS_V9_FAR,
  BINTOSS_V9_FINISH,
  BINTOSS_V9_HOOP,
  type BinTossState,
} from "../../src/lib/arcade/binToss";
import type { StdCase } from "./case";

const game = binTossGameFor(BINTOSS_REV_STD);
const SEED = 4242;

/** A final state built by hand from binRev 9's init: `baskets` in (`results` given separately), the features as set. */
function final(over: Partial<BinTossState>): BinTossState {
  const base = game.init(SEED);
  return { ...base, acted: 1, resolved: BINTOSS_THROWS, throwIndex: BINTOSS_THROWS, ...over };
}
const ones = (n: number) => Array.from({ length: n }, () => 1);
const part = (s: BinTossState, key: string) => binTossStdParts(s)!.find((p) => p.key === key)!.points;

export const stdCase: StdCase = {
  game,
  perfect: () => final({ baskets: BINTOSS_THROWS, results: ones(BINTOSS_THROWS), farIn: BINTOSS_FAR_THROWS, swishes: BINTOSS_HOOP_COUNT, close: 0 }),
  idle: () => final({ baskets: 0, results: Array.from({ length: BINTOSS_THROWS }, () => 0), farIn: 0, swishes: 0, close: 0 }),
  // The core line on `baskets` (and its matching per-throw `results`); All ten in is the finish a full core earns.
  core: (value: number) => {
    const b = Math.min(value, BINTOSS_THROWS);
    return final({ baskets: value, results: [...ones(b), ...Array.from({ length: BINTOSS_THROWS - b }, () => 0)], farIn: 0, swishes: 0, close: 0 });
  },
  fullAt: BINTOSS_THROWS,
  finishParts: ["finish"],
  older: () => binTossGameFor(BINTOSS_REV_SMALL_FAR).init(SEED),
  extra(ok) {
    // Every bucket 13, a far bucket 6 more, a hoop 8 more: a feature never costs core.
    for (let b = 0; b <= BINTOSS_THROWS; b++) {
      const s = final({ baskets: b, results: [...ones(b), ...Array.from({ length: BINTOSS_THROWS - b }, () => 0)], close: 0, farIn: 0, swishes: 0 });
      ok(part(s, "core") === BINTOSS_V9_BUCKET * b, `bintoss: ${b} buckets → core ${BINTOSS_V9_BUCKET * b}`);
      ok(part(s, "finish") === (b === BINTOSS_THROWS ? BINTOSS_V9_FINISH : 0), `bintoss: All ten in only with ten in (${b})`);
    }
    for (let f = 0; f <= BINTOSS_FAR_THROWS + 2; f++) {
      const s = final({ baskets: f, results: ones(f), farIn: f });
      ok(part(s, "far") === BINTOSS_V9_FAR * Math.min(f, BINTOSS_FAR_THROWS), `bintoss: ${f} far buckets → ${BINTOSS_V9_FAR * Math.min(f, BINTOSS_FAR_THROWS)}`);
      ok(part(s, "core") === BINTOSS_V9_BUCKET * f, `bintoss: a far bucket is still a bucket (${f})`);
    }
    for (let h = 0; h <= BINTOSS_HOOP_COUNT + 2; h++) {
      const s = final({ baskets: h, results: ones(h), swishes: h });
      ok(part(s, "hoops") === BINTOSS_V9_HOOP * Math.min(h, BINTOSS_HOOP_COUNT), `bintoss: ${h} hoops → ${BINTOSS_V9_HOOP * Math.min(h, BINTOSS_HOOP_COUNT)}`);
    }
    // Close misses: 1 each, inside the core's 130.
    for (let b = 0; b < BINTOSS_THROWS; b++) {
      const close = BINTOSS_THROWS - b;
      const s = final({ baskets: b, results: ones(b), close });
      ok(part(s, "core") === BINTOSS_V9_BUCKET * b + close, `bintoss: ${b} in and ${close} close → core ${BINTOSS_V9_BUCKET * b + close}`);
      ok(part(s, "core") <= 130, "bintoss: close misses stay inside the 130");
    }
    ok(game.score(final({ baskets: 0, results: ones(0), close: 3 })) === 3, "bintoss: three close misses and nothing in score 3");
    // The score is the parts' sum, no curve: 7 in, 2 close, 3 far, 2 hoops = 91 + 2 + 18 + 16.
    ok(game.score(final({ baskets: 7, results: ones(7), close: 2, farIn: 3, swishes: 2 })) === 127, "bintoss: 7 in, 2 close, 3 far, 2 hoops score 127");
    // Every binRev 9 run has exactly three hoops (binRev 8 dropped some).
    let three = 0;
    for (let seed = 1; seed <= 400; seed++) if ((game.init(seed * 7919).hoops ?? []).filter(Boolean).length === BINTOSS_HOOP_COUNT) three++;
    ok(three === 400, `bintoss: every binRev 9 run has exactly three hoops (${three} of 400)`);
  },
};
