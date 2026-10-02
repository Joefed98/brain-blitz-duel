import { NUMBER_PYRAMID_BANK } from "../src/lib/duel/numberPyramidBank.server";
import { npComplete, npCountSolutions, npDecode, npEncode, npRulesHold, scoreNumberPyramid, NP_MIN_EMPTY, NP_MAX_EMPTY } from "../src/lib/duel/numberPyramid";
let bad = 0;
for (const e of NUMBER_PYRAMID_BANK) {
  const empties = e.givens.map((g, i) => (g == null ? i : -1)).filter((i) => i >= 0);
  if (empties.length < NP_MIN_EMPTY || empties.length > NP_MAX_EMPTY || e.tray.length !== empties.length + 2) bad++;
  if (!npRulesHold(e.solution) || npCountSolutions(e.givens, e.tray, 3) !== 1) bad++;
  const used = new Set<number>(); const p: Record<number, number> = {};
  for (const c of empties) { const t = e.tray.findIndex((v, i) => v === e.solution[c] && !used.has(i)); used.add(t); p[c] = t; }
  const placements = npDecode(npEncode(p), e.givens, e.tray.length);
  if (!npComplete(e.givens, e.tray, placements)) bad++;
  if (scoreNumberPyramid(true, 37_500, 75_000, empties.length, empties.length) !== 125) bad++;
  const half: Record<number, number> = {}; empties.slice(0, 3).forEach((c) => (half[c] = p[c]!));
  if (npComplete(e.givens, e.tray, half)) bad++;
}
console.log(`checked ${NUMBER_PYRAMID_BANK.length} pyramids, problems ${bad}; 3 of 6 right = ${scoreNumberPyramid(false, 0, 75000, 3, 6)}`);
