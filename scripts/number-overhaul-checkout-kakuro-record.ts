// Records the older-stamp grades (checkoutRev 2, kakuroRev 1) number-overhaul-checkout-kakuro-check replays: run from a
// checkout of main before the Number overhaul (e.g. commit cea304c4) with this file copied to its root:
//   bun number-overhaul-checkout-kakuro-record.ts > scripts/fixtures/number-overhaul-checkout-kakuro-legacy.json
import { generatePuzzle, gradeAnswer } from "./src/lib/duel/generate.server";
import { withSeededRandom } from "./src/lib/duel/random";
import { pinPreNumberOverhaul } from "./src/lib/duel/numberOverhaul";
import { encodeTimeline } from "./src/lib/duel/standard/timeline";
import { encodeKakuro } from "./src/lib/duel/kakuro";
import { checkoutOptions, encodeCheckoutDarts, decodeCheckoutDarts, joinCheckoutRound } from "./src/lib/duel/checkout";
import type { CheckoutPuzzleData, KakuroPuzzleData } from "./src/lib/duel/types";
pinPreNumberOverhaul(true);
const out: { type: string; seed: number; answer: string; ms: number; score: number; isCorrect: boolean }[] = [];
let lcg = 12345;
const rnd = (n: number) => ((lcg = (Math.imul(lcg, 1103515245) + 12345) >>> 0) % n);
for (let seed = 0; seed < 12; seed++) {
  const p = withSeededRandom(seed, () => generatePuzzle("checkout")) as CheckoutPuzzleData;
  const opts = p.stages.map((s) => checkoutOptions(s));
  const answers: string[] = [];
  answers.push(joinCheckoutRound(p.routes ?? []));
  answers.push(joinCheckoutRound([(p.routes ?? [])[0] ?? "", "", (p.routes ?? [])[2] ?? "", "", ""]));
  for (let k = 0; k < 6; k++)
    answers.push(joinCheckoutRound(p.stages.map((s, i) => (rnd(2) ? encodeCheckoutDarts(Array.from({ length: 1 + rnd(s.maxDarts) }, () => opts[i]![rnd(opts[i]!.length)]!)) : p.routes?.[i] ?? ""))));
  // An overshoot-then-negative route on board 5 (it busts on rev 3).
  const s5 = p.stages[4]!;
  const neg = s5.wedges.findIndex((v) => v < 0);
  answers.push(joinCheckoutRound([...(p.routes ?? []).slice(0, 4), encodeCheckoutDarts([{ wedge: 0, ring: 3 }, { wedge: neg, ring: 1 }, ...decodeCheckoutDarts(p.routes?.[4] ?? "", 4).slice(2)])]));
  for (const a of answers) for (const ms of [0, 40_000]) {
    const g = gradeAnswer(p, a, ms);
    out.push({ type: "checkout", seed, answer: a, ms, score: g.score, isCorrect: g.isCorrect });
  }
}
for (let seed = 0; seed < 10; seed++) {
  const p = withSeededRandom(seed, () => generatePuzzle("kakuro")) as KakuroPuzzleData;
  const sol = p.solution ?? [];
  const n = p.size * p.size;
  const solText = encodeKakuro(sol);
  const off = [...sol]; off[p.white[0]!] = (sol[p.white[0]!]! % 9) + 1;
  const part = new Array<number>(n).fill(0); p.white.slice(0, 5).forEach((c) => (part[c] = sol[c]!));
  const partOff = [...part]; partOff[p.white[0]!] = (sol[p.white[0]!]! % 9) + 1;
  const answers = [
    solText,
    `${solText}${encodeTimeline([{ t: 30_000, draft: solText }])}`,
    `${solText}${encodeTimeline([{ t: 9_000, draft: encodeKakuro(partOff) }, { t: 30_000, draft: solText }])}`,
    `${solText}${encodeTimeline([{ t: 9_000, draft: encodeKakuro(off) }, { t: 30_000, draft: solText }])}`,
    encodeKakuro(part),
    `${encodeKakuro(partOff)}${encodeTimeline([{ t: 5_000, draft: encodeKakuro(partOff) }])}`,
  ];
  for (const a of answers) for (const ms of [0, 60_000]) {
    const g = gradeAnswer(p, a, ms);
    out.push({ type: "kakuro", seed, answer: a, ms, score: g.score, isCorrect: g.isCorrect });
  }
}
console.log(JSON.stringify(out));
