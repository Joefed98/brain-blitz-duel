import {
  HOT_INPUT_CLEAR,
  HOT_INPUT_GO,
  HOT_INPUT_TILE,
  HOT_STAGES,
  buildHotFloorStage,
  hotFloorGame,
  hotfloorCourseRerolls,
  hotNeighbours,
  hotfloorRouteAnalysis,
  hotfloorRouteHasPinch,
  hotRouteFailure,
  hotfloorStageRoute,
  type HotFloorState,
} from "@/lib/arcade/hotFloor";
import { flipCourseStats, flipDecisionShare } from "@/lib/arcade/flip";

let failures = 0;
const check = (label: string, ok: boolean) => {
  if (!ok) console.log(`FAIL ${label}`);
  if (!ok) failures += 1;
};

let stages = 0, stored = 0, searched = 0, fewRoutes = 0, allPinched = 0, threeFailed = 0, halfExact = 0, missingHard = 0, greedySolved = 0;
let survivingRoutes = 0;
let rerolls = 0;
for (let seed = 1; seed <= 50; seed++) {
  rerolls += hotfloorCourseRerolls(seed * 7919);
  for (let i = 0; i < HOT_STAGES; i++) {
    const b = buildHotFloorStage(seed * 7919, i);
    stages++;
    if (hotRouteFailure(b, b.route) === -1) stored++;
    if (hotfloorStageRoute(b)) searched++;
    const analysis = hotfloorRouteAnalysis(b);
    survivingRoutes += analysis.surviving.length;
    if (analysis.surviving.length <= (i < 2 ? 3 : 2)) fewRoutes++;
    if (analysis.surviving.every((route) => hotfloorRouteHasPinch(b, route))) allPinched++;
    if (analysis.failedSameOrShorter.length >= 3) threeFailed++;
    const exact = b.route.slice(1, -1).filter((c, k) => b.numbers[c] === k + 1).length;
    if (exact * 2 >= b.route.length - 2) halfExact++;
    if (i >= 2 && b.missing.filter(Boolean).length >= 6 && b.missing.filter(Boolean).length <= 12) missingHard++;
    let cell = b.start;
    const greedy = [cell];
    const seen = new Set(greedy);
    while (cell !== b.exit && greedy.length - 1 < b.hopBudget) {
      const options = hotNeighbours(cell, b.rows).filter((c) => !b.missing[c] && !seen.has(c));
      if (!options.length) break;
      options.sort((a, z) => b.numbers[z]! - b.numbers[a]! || a - z);
      cell = options[0]!; greedy.push(cell); seen.add(cell);
    }
    if (hotRouteFailure(b, greedy) === -1) greedySolved++;
  }
}
check("stored routes succeed", stored === stages);
check("search finds a route", searched === stages);
check("surviving route limits", fewRoutes === stages);
check("every survivor has a zero-slack pinch", allPinched === stages);
check("three same-or-shorter routes fail on numbers", threeFailed === stages);
check("half stored route exact", halfExact === stages);
check("stage 3+ has 6-12 missing", missingHard === 400);
check("highest-number-first solve rate under 20%", greedySolved / stages < 0.2);
console.log(`Hot Floor: ${stages} stages; avg surviving routes ${(survivingRoutes / stages).toFixed(2)}; rerolls/stage ${(rerolls / stages).toFixed(2)} (${((100 * rerolls) / (stages + rerolls)).toFixed(1)}% rejected); pinch ${allPinched}/${stages}; 3+ failed ${threeFailed}/${stages}; greedy ${greedySolved}/${stages} = ${((100 * greedySolved) / stages).toFixed(1)}%`);

const tick = (s: HotFloorState, k: number | null, a = 0) =>
  hotFloorGame.step(s, k === null ? null : { t: s.tick + 1, k, a, b: 0, c: 0, d: 0 });
let s = hotFloorGame.init(90210);
// Wrong route: the decoy loses a life and resets with the same board.
const fp = s.board.fingerprint;
for (const c of s.board.decoy.slice(1)) s = tick(s, HOT_INPUT_TILE, c);
s = tick(s, HOT_INPUT_GO);
while (s.phase !== 0 && !hotFloorGame.isOver(s)) s = tick(s, null);
check("decoy costs a life and keeps board", s.lives === 2 && s.board.fingerprint === fp && s.route.length === 1);
// Tap/undo/clear.
const r = s.board.route;
s = tick(s, HOT_INPUT_TILE, r[1]!); s = tick(s, HOT_INPUT_TILE, r[1]!);
check("tapping last tile removes it", s.route.length === 1);
s = tick(s, HOT_INPUT_TILE, r[1]!); s = tick(s, HOT_INPUT_CLEAR);
check("CLEAR empties route", s.route.length === 1);
s = tick(s, HOT_INPUT_GO);
check("GO disabled until route ends on exit", s.phase === 0);
while (!hotFloorGame.isOver(s)) {
  if (s.phase === 0) {
    for (const c of s.board.route.slice(1)) s = tick(s, HOT_INPUT_TILE, c);
    s = tick(s, HOT_INPUT_GO);
  } else s = tick(s, null);
}
check("stored routes clear 10 stages", s.stage === 10 && s.ended === 1);
check("score 150", hotFloorGame.score(s) === 150);
console.log(`Stored-route run finished at ${(s.tick / 60).toFixed(1)}s`);

let d = 0, g = 0, a30 = 0, a60 = 0, maxGap = 0;
for (let seed = 1; seed <= 20; seed++) {
  const r2 = flipDecisionShare(seed * 7919);
  d += r2.decisions; g += r2.groups;
  check(`flip seed ${seed} share >= 70% (${(r2.share * 100).toFixed(1)})`, r2.share >= 0.7);
  const st = flipCourseStats(seed * 7919);
  a30 += st.around30; a60 += st.around60; maxGap = Math.max(maxGap, st.maxGapTicks);
}
check(`flip max gap <= 45 ticks (${maxGap})`, maxGap <= 45);
console.log(`Flip decision share: ${d}/${g} = ${((100 * d) / g).toFixed(1)}%; hazards per 10 s at 25–35 s: ${(a30 / 20).toFixed(1)}, at 50–60 s: ${(a60 / 20).toFixed(1)}; largest gap after 5 s: ${maxGap} ticks`);
if (failures) process.exit(1);
