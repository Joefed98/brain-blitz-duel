import {
  HOT_STAGES,
  buildHotFloorStage,
  hotfloorCourseRerolls,
  hotfloorCourseSurvivable,
  hotfloorStageRoute,
} from "@/lib/arcade/hotFloor";
import { flipDecisionShare } from "@/lib/arcade/flip";

let failures = 0;
const check = (label: string, ok: boolean) => {
  console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
  if (!ok) failures += 1;
};

let routeChecks = 0;
let decoysFail = 0;
let rerolls = 0;
for (let seed = 1; seed <= 50; seed++) {
  check(`hotfloor seed ${seed} course`, hotfloorCourseSurvivable(seed * 7919));
  rerolls += hotfloorCourseRerolls(seed * 7919);
  for (let stage = 0; stage < HOT_STAGES; stage++) {
    const board = buildHotFloorStage(seed * 7919, stage);
    const found = hotfloorStageRoute(board);
    if (found) routeChecks += 1;
    const trap = board.decoy.findIndex((cell, index) => index > 0 && board.deadlines[cell]! <= index * 6);
    if (trap >= 0) decoysFail += 1;
  }
}
check("all 500 Hot Floor stages have a verified route", routeChecks === 500);
check("all 500 Hot Floor stages contain a collapsing direct-route trap", decoysFail === 500);

let decisions = 0;
let groups = 0;
for (let seed = 1; seed <= 20; seed++) {
  const result = flipDecisionShare(seed * 7919);
  decisions += result.decisions;
  groups += result.groups;
  check(`flip seed ${seed} decision share >= 40%`, result.share >= 0.4);
}
console.log(`Hot Floor average whole-course rerolls: ${(rerolls / 50).toFixed(2)}`);
console.log(`Flip decision share over 20 courses: ${decisions}/${groups} (${((100 * decisions) / groups).toFixed(1)}%)`);

if (failures) process.exit(1);