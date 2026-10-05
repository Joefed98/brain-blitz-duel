import { NUMBER_PYRAMID_BANK } from "../src/lib/duel/numberPyramidBank.server";
import { npComplete, npCountSolutions, npDecode, npEncode, npRulesHold, scoreNumberPyramid, NP_STAGE_CONFIG } from "../src/lib/duel/numberPyramid";
let bad = 0;
const seen = new Set<string>();
for (const set of NUMBER_PYRAMID_BANK) {
  if (set.pyramids.length !== 4) bad++;
  set.pyramids.forEach((e, stage) => {
    const config = NP_STAGE_CONFIG[stage]!;
    const empties = e.givens.map((g, i) => (g == null ? i : -1)).filter((i) => i >= 0);
    const key = JSON.stringify(e.givens) + JSON.stringify([...e.tray].sort((a, b) => a - b));
    if (seen.has(key)) bad++; seen.add(key);
    if (e.rows !== config.rows || empties.length < config.minEmpty || empties.length > config.maxEmpty || e.tray.length !== empties.length + 2) bad++;
    const bottom = e.solution.slice(e.solution.length - e.rows);
    if (bottom.some((value) => value < config.bottomLo || value > config.bottomHi)) bad++;
    if (!npRulesHold(e.solution, e.rows) || npCountSolutions(e.givens, e.tray, e.rows, 3) !== 1) bad++;
    const used = new Set<number>(); const p: Record<number, number> = {};
    for (const c of empties) { const t = e.tray.findIndex((v, i) => v === e.solution[c] && !used.has(i)); if (t < 0) { bad++; continue; } used.add(t); p[c] = t; }
    if (!npComplete(e.givens, e.tray, npDecode(npEncode(p), e.givens, e.tray.length), e.rows)) bad++;
  });
}
if (scoreNumberPyramid(4, true, 60_000, 0, 0, 120_000) !== 135) bad++;
if (scoreNumberPyramid(2, false, 0, 3, 6, 120_000) !== 75) bad++;
if (scoreNumberPyramid(2, false, 0, 0, 6, 120_000) !== 60) bad++;
console.log(`checked ${NUMBER_PYRAMID_BANK.length} sets / ${seen.size} unique pyramids, problems ${bad}; all at half time ${scoreNumberPyramid(4, true, 60_000, 0, 0, 120_000)}; two plus 3/6 ${scoreNumberPyramid(2, false, 0, 3, 6, 120_000)}`);
if (bad) process.exitCode = 1;
