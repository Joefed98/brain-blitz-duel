import {
  HOT_INPUT_CLEAR,
  HOT_INPUT_GO,
  HOT_INPUT_TILE,
  HOT_STAGES,
  buildHotFloorStage,
  hotFloorGame,
  hotfloorCourseRerolls,
  hotNeighbours,
  hotDirectClosed,
  hotfloorLateDecoys,
  hotRouteShape,
  hotSizeFor,
  hotLayout,
  hotSurvivorCount,
  hotTilePoint,
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

let stages = 0, stored = 0, searched = 0, unique = 0, shaped = 0, closed = 0, decoyOk = 0, budgetOk = 0, sizeOk = 0, greedySolved = 0;
let ratioSum = 0, rerolls = 0, minTile = 99;
const t0 = Date.now();
for (let seed = 1; seed <= 5; seed++) rerolls += hotfloorCourseRerolls(seed * 7919);
const rerollStages = 5 * HOT_STAGES;
for (let seed = 1; seed <= 5; seed++) {
  for (let i = 0; i < HOT_STAGES; i++) {
    const b = buildHotFloorStage(seed * 7919, i);
    stages++;
    const size = hotSizeFor(i);
    if (b.rows === size.rows && b.cols === size.cols) sizeOk++;
    minTile = Math.min(minTile, hotLayout(b).tile);
    if (hotRouteFailure(b, b.route) === -1) stored++;
    if (hotfloorStageRoute(b)) searched++;
    if (b.hopBudget === b.route.length - 1) budgetOk++;
    const survivors = hotSurvivorCount(b);
    if (i === 0 ? survivors <= 2 && survivors >= 1 : survivors === 1) unique++;
    const shape = hotRouteShape(b);
    ratioSum += shape.ratio;
    if (shape.ratio >= 1.8 && shape.turns >= 3 && shape.away >= 2) shaped++;
    if (hotDirectClosed(b)) closed++;
    const decoys = hotfloorLateDecoys(b);
    if (decoys.length >= 4 && decoys.every((r) => { const f = hotRouteFailure(b, r); return f >= r.length - 3 && r.length - 1 <= b.hopBudget && !b.missing[r[f]!]; })) decoyOk++;
    let cell = b.start;
    const greedy = [cell];
    const seen = new Set(greedy);
    while (cell !== b.exit && greedy.length - 1 < b.hopBudget) {
      const options = hotNeighbours(cell, b.rows, b.cols).filter((c) => !b.missing[c] && !seen.has(c));
      if (!options.length) break;
      options.sort((a, z) => b.numbers[z]! - b.numbers[a]! || a - z);
      cell = options[0]!; greedy.push(cell); seen.add(cell);
    }
    if (hotRouteFailure(b, greedy) === -1) greedySolved++;
  }
}
check("stage sizes", sizeOk === stages);
check("stored routes succeed", stored === stages);
check("search finds a route", searched === stages);
check("budget equals route length", budgetOk === stages);
check("one survivor (stage 1 up to two)", unique === stages);
check("winding shape", shaped === stages);
check("direct approach closed", closed === stages);
check("four late decoys", decoyOk === stages);
check(`tiles >= 36 px on 375 phone (world tile ${minTile})`, minTile * (343 / 390) >= 36);
console.log(`Hot Floor: ${stages} stages; rerolls/stage ${(rerolls / rerollStages).toFixed(2)} (${((100 * rerolls) / (rerollStages + rerolls)).toFixed(1)}% rejected); avg length/Manhattan ${(ratioSum / stages).toFixed(2)}; greedy ${greedySolved}/${stages}; ${((Date.now() - t0) / 1000).toFixed(1)}s`);

const tick = (s: HotFloorState, k: number | null, cellArg = -1) => {
  const p = k === HOT_INPUT_TILE ? hotTilePoint(s.board, cellArg) : { a: 0, b: 0 };
  return hotFloorGame.step(s, k === null ? null : { t: s.tick + 1, k, a: p.a, b: p.b, c: 0, d: 0 });
};
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
