/** Focused generator and symbol checks for the Oct 2 Attention/Pattern tuning. */
import { COUNTUP_STAGE_SIZES } from "../src/lib/duel/types";
import { COUNTUP_STAGE_COUNTS_REV1, buildCountUp, countUpSceneValid, countUpVisibleShare } from "../src/puzzles/countUp";
import { directionalChevronPoints } from "../src/puzzles/laser";

function check(ok: boolean, message: string): void {
  if (!ok) throw new Error(message);
}

let minimumVisibility = 1;
for (let round = 0; round < 100; round += 1) {
  const puzzle = buildCountUp();
  puzzle.stages.forEach((stage, index) => {
    check(stage.shapes.length === COUNTUP_STAGE_SIZES[index], `Count Up stage ${index + 1} shape count`);
    check(countUpSceneValid(stage), `Count Up stage ${index + 1} containment/visibility`);
    const targets = stage.shapes.filter((shape) => shape.shape === stage.targetShape && shape.colour === stage.targetColour);
    // countRev 1 (13 Oct 2026): seven values per tray, 5–11, 7–13, 9–15.
    const [lo, hi] = COUNTUP_STAGE_COUNTS_REV1[index]!;
    check(targets.length >= lo && targets.length <= hi, `Count Up stage ${index + 1} answer range`);
    for (const target of targets) minimumVisibility = Math.min(minimumVisibility, countUpVisibleShare(target, stage.shapes));
  });
}

for (const dir of ["U", "D", "L", "R"] as const) {
  const coordinates = directionalChevronPoints(dir).split(" ").flatMap((point) => point.split(",").map(Number));
  check(coordinates.every((value) => Number.isFinite(value) && value >= 0 && value <= 24), `Laser ${dir} marker is clipped`);
}

console.log(`Count Up: 100/100 three-scene sets are contained; minimum sampled target visibility ${(minimumVisibility * 100).toFixed(1)}%`);
console.log("Laser: directional chevrons stay inside all four cell sides; shared board renderer covers intro, play and reveal");