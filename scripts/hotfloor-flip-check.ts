import {
  HOT_STAGES,
  HOT_DOWN,
  HOT_INPUT_SWIPE,
  HOT_LEFT,
  HOT_RIGHT,
  HOT_UP,
  buildHotFloorStage,
  hotFloorGame,
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

let run = hotFloorGame.init(90210);
const firstFingerprint = run.board.fingerprint;
run = hotFloorGame.step(run, { t: 1, k: HOT_INPUT_SWIPE, a: HOT_DOWN, b: 0, c: 0, d: 0 });
check("an invalid Hot Floor hop costs one life", run.lives === 2 && run.stage === 0);
check("a failed stage restarts with fresh seeded countdowns", run.board.fingerprint !== firstFingerprint && run.stageTick === 0);
while (!hotFloorGame.isOver(run) && run.stage < HOT_STAGES) {
  const route = run.board.route;
  for (let index = 1; index < route.length && !hotFloorGame.isOver(run); index++) {
    const from = route[index - 1]!;
    const to = route[index]!;
    const delta = to - from;
    const direction = delta === 1 ? HOT_RIGHT : delta === -1 ? HOT_LEFT : delta === HOT_COLS ? HOT_DOWN : HOT_UP;
    run = hotFloorGame.step(run, { t: run.tick + 1, k: HOT_INPUT_SWIPE, a: direction, b: 0, c: 0, d: 0 });
    for (let hop = 1; hop < 6; hop++) run = hotFloorGame.step(run, null);
  }
}
check("a verified route completes all ten Hot Floor stages", run.stage === 10 && run.ended === 1);
check("Hot Floor awards 15 per completed stage, capped at 150", hotFloorGame.score(run) === 150);

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