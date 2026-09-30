import {
  HOT_INPUT_CLEAR,
  HOT_INPUT_GO,
  HOT_INPUT_TILE,
  HOT_STAGES,
  buildHotFloorStage,
  hotFloorGame,
  hotfloorCourseRerolls,
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

let stages = 0, stored = 0, searched = 0, decoyShorter = 0, decoyOneShort = 0, zeroSlack = 0, missing8 = 0;
let rerolls = 0;
for (let seed = 1; seed <= 50; seed++) {
  rerolls += hotfloorCourseRerolls(seed * 7919);
  for (let i = 0; i < HOT_STAGES; i++) {
    const b = buildHotFloorStage(seed * 7919, i);
    stages++;
    if (hotRouteFailure(b, b.route) === -1) stored++;
    if (hotfloorStageRoute(b)) searched++;
    if (b.decoy.length < b.route.length) decoyShorter++;
    const f = hotRouteFailure(b, b.decoy);
    if (f > 0 && b.numbers[b.decoy[f]!] === f - 1) decoyOneShort++;
    if (b.route.slice(1, -1).some((c, k) => b.numbers[c] === k + 1)) zeroSlack++;
    if (i >= 7 && b.rows === 8 && b.missing.filter(Boolean).length >= 8) missing8++;
  }
}
check("stored routes succeed", stored === stages);
check("search finds a route", searched === stages);
check("decoy shorter", decoyShorter === stages);
check("decoy fails by one hop", decoyOneShort === stages);
check("stage 8+ is 6x8 with 8-10 missing", missing8 === 150);
console.log(`Hot Floor: ${stages} stages; stored ok ${stored}; search ok ${searched}; decoy shorter+fails by one ${decoyOneShort}; stages with a zero-slack tile ${zeroSlack}; avg rejected attempts per course ${(rerolls / 50).toFixed(1)}`);

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
