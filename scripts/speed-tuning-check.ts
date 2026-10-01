import { buildReaction } from "../src/puzzles/reaction";
import { buildStopWatch, markerState, stopWatchPoints, targetCentre } from "../src/puzzles/stopWatch";
import { REACTION_DECOY_MS, REACTION_FLASH_MS, REACTION_ROUND_MS, STOPWATCH_PASSES } from "../src/lib/duel/types";

let reactionRounds = 0;
for (let run = 0; run < 1_000; run++) {
  const puzzle = buildReaction();
  if (puzzle.flashes.length !== 5) throw new Error("Reaction flash count");
  if (puzzle.decoys.length < 8 || puzzle.decoys.length > 12) throw new Error("Reaction decoy total");
  if (puzzle.flashes[0]! < 3_000) throw new Error("First gold before 3 seconds");
  if (puzzle.flashes.at(-1)! + REACTION_FLASH_MS > REACTION_ROUND_MS) throw new Error("Gold exceeds round");
  if (!puzzle.decoys.some((d) => d.color === "blue")) {
    // Individual rounds need not contain every colour; the aggregate check below covers blue generation.
  }
  for (let i = 1; i < puzzle.flashes.length; i++) {
    const gap = puzzle.flashes[i]! - puzzle.flashes[i - 1]!;
    if (gap < 5_000 || gap > 12_000) throw new Error("Gold spacing");
  }
  let segmentStart = 0;
  for (const flash of puzzle.flashes) {
    const before = puzzle.decoys.filter((d) => d.at >= segmentStart && d.at < flash);
    if (before.length < 1 || before.length > 3) throw new Error("Decoys per flash");
    const finalGap = flash - before.at(-1)!.at;
    if (finalGap < 1_000 || finalGap > 5_000) throw new Error("Final decoy gap");
    for (let i = 1; i < before.length; i++) {
      const spacing = before[i]!.at - before[i - 1]!.at;
      if (spacing < 1_500 || spacing > 4_000) throw new Error("Decoy spacing");
    }
    if (before.some((d) => d.at + REACTION_DECOY_MS > flash)) throw new Error("Decoy overlaps gold");
    segmentStart = flash + REACTION_FLASH_MS;
  }
  reactionRounds += 1;
}

const colours = new Set(Array.from({ length: 100 }, () => buildReaction()).flatMap((p) => p.decoys.map((d) => d.color)));
if (!["teal", "red", "blue"].every((colour) => colours.has(colour as "teal" | "red" | "blue"))) {
  throw new Error("Missing decoy colour");
}

let watchSets = 0;
for (let run = 0; run < 1_000; run++) {
  const puzzle = buildStopWatch();
  if (puzzle.watches.length !== 5) throw new Error("Watch count");
  const moving = puzzle.watches[1]!;
  const vertical = puzzle.watches[3]!;
  if (moving.moving?.cycleMs !== 2_400 || moving.vertical) throw new Error("Watch 2 setup");
  if (!vertical.vertical || vertical.moving?.cycleMs !== 2_000) throw new Error("Watch 4 setup");
  if (vertical.passSweepMs?.join(",") !== "1000,700,500") throw new Error("Watch 4 pass speeds");
  for (const spec of puzzle.watches) {
    const durations = spec.passSweepMs ?? [spec.sweepMs, spec.sweepMs, spec.sweepMs];
    let elapsed = 0;
    for (let pass = 0; pass < STOPWATCH_PASSES; pass++) {
      const state = markerState(spec, elapsed + 1);
      if (state.pass !== pass) throw new Error(`Pass index ${pass}`);
      elapsed += durations[pass]!;
    }
    if (markerState(spec, elapsed).pass !== STOPWATCH_PASSES) throw new Error("Third pass completion");
    for (let sample = 0; sample <= 20; sample++) {
      const centre = targetCentre(spec, (sample * (spec.moving?.cycleMs ?? 1)) / 20);
      if (centre - spec.half < 0 || centre + spec.half > 1) throw new Error("Target leaves bar");
      if (spec.vertical && centre - spec.half < 0.5) throw new Error("Vertical target leaves upper half");
    }
  }
  watchSets += 1;
}

if (stopWatchPoints(0) !== 150 || stopWatchPoints(100) !== 125 || stopWatchPoints(400) !== 50) {
  throw new Error("Stop Watch scoring changed");
}

console.log(`Reaction schedules: ${reactionRounds}/1000 valid; colours: ${[...colours].sort().join(", ")}`);
console.log(`Stop Watch sets: ${watchSets}/1000 valid; passes: 3; moving cycles: 2400/2000 ms`);
console.log("Stop Watch scores: 0 ms=150, 100 ms=125, 400 ms=50");
