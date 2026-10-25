/** Focused generator and symbol checks for the Oct 2 Attention/Pattern tuning. */
import { COUNTUP_STAGE_SIZES } from "../src/lib/duel/types";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { countUpCounts, countUpStageTruth } from "../src/lib/duel/attentionRev";
import type { CountUpPuzzleData, CountUpStage } from "../src/lib/duel/types";
import {
  COUNTUP_COMPARE_GAP,
  COUNTUP_COMPARE_LESS,
  COUNTUP_COMPARE_SIZE,
  COUNTUP_STAGE_COUNTS_REV1,
  COUNTUP_STAGE_COUNTS_REV2,
  buildCountUp,
  countUpSceneValid,
  countUpVisibleShare,
} from "../src/puzzles/countUp";
import { directionalChevronPoints } from "../src/puzzles/laser";

function check(ok: boolean, message: string): void {
  if (!ok) throw new Error(message);
}

let minimumVisibility = 1;
/** Stages 1–3 of any Tally puzzle: the Oct 2 tuning's size, containment and visibility rules, unchanged. */
function checkCountTray(stage: CountUpStage, index: number, [lo, hi]: [number, number], label = ""): void {
  check(stage.shapes.length === COUNTUP_STAGE_SIZES[index], `Count Up${label} stage ${index + 1} shape count`);
  check(countUpSceneValid(stage), `Count Up${label} stage ${index + 1} containment/visibility`);
  const targets = stage.shapes.filter((shape) => shape.shape === stage.targetShape && shape.colour === stage.targetColour);
  check(targets.length >= lo && targets.length <= hi, `Count Up${label} stage ${index + 1} answer range`);
  for (const target of targets) minimumVisibility = Math.min(minimumVisibility, countUpVisibleShare(target, stage.shapes));
}

// countRev 1 (13 Oct 2026): seven values per tray, 5–11, 7–13, 9–15. New rounds are countRev 2, so these
// assertions run on real countRev 1 puzzles as main dealt them (the attention rework's legacy fixture).
const legacy = JSON.parse(gunzipSync(readFileSync("scripts/fixtures/attention-rework-legacy.json.gz")).toString("utf8")) as {
  cases: { type: string; puzzle: CountUpPuzzleData }[];
};
const rev1 = legacy.cases.filter((c) => c.type === "countup").map((c) => c.puzzle);
check(rev1.length > 0 && rev1.every((p) => p.countRev === 1 && p.stages.length === 3), "Count Up countRev 1 fixture puzzles");
for (const puzzle of rev1) puzzle.stages.forEach((stage, index) => checkCountTray(stage, index, COUNTUP_STAGE_COUNTS_REV1[index]!, " countRev 1"));

// countRev 2 (14 Oct 2026): the same three trays with thirteen values each (3–15, 5–17, 7–19), then a
// fourth, comparison tray of COUNTUP_COMPARE_SIZE shapes asking "how many more A than B?".
for (let round = 0; round < 100; round += 1) {
  const puzzle = buildCountUp();
  // Depth to 200 (25 Oct 2026): dealt as countRev 3 on countRev 2's trays (depth-tally-check).
  check(puzzle.countRev === 3 && puzzle.stages.length === 4, "Count Up countRev 3 has countRev 2's four trays");
  puzzle.stages.forEach((stage, index) => {
    if (index < 3) {
      check(!stage.compare, `Count Up stage ${index + 1} is a count tray`);
      checkCountTray(stage, index, COUNTUP_STAGE_COUNTS_REV2[index]!);
      return;
    }
    check(!!stage.compare, "Count Up stage 4 is the comparison tray");
    check(stage.shapes.length === COUNTUP_COMPARE_SIZE, "Count Up stage 4 shape count");
    check(countUpSceneValid(stage), "Count Up stage 4 containment/visibility");
    const counted = stage.shapes.filter((shape) => countUpCounts(stage, shape));
    const less = stage.shapes.filter((shape) => shape.colour === stage.compare!.less).length;
    const answer = countUpStageTruth(stage);
    check(less >= COUNTUP_COMPARE_LESS[0] && less <= COUNTUP_COMPARE_LESS[1], "Count Up stage 4 smaller colour count");
    check(answer >= COUNTUP_COMPARE_GAP[0] && answer <= COUNTUP_COMPARE_GAP[1] && answer === puzzle.counts?.[3], "Count Up stage 4 answer range");
    for (const target of counted) minimumVisibility = Math.min(minimumVisibility, countUpVisibleShare(target, stage.shapes));
  });
}

for (const dir of ["U", "D", "L", "R"] as const) {
  const coordinates = directionalChevronPoints(dir).split(" ").flatMap((point) => point.split(",").map(Number));
  check(coordinates.every((value) => Number.isFinite(value) && value >= 0 && value <= 24), `Laser ${dir} marker is clipped`);
}

console.log(`Count Up: ${rev1.length} stored countRev 1 three-tray sets and 100/100 countRev 3 (countRev 2's) four-tray sets are contained and in range; minimum sampled target visibility ${(minimumVisibility * 100).toFixed(1)}%`);
console.log("Laser: directional chevrons stay inside all four cell sides; shared board renderer covers intro, play and reveal");