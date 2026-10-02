/** Focused Stop Watch movement and Chain scatter checks. */
import { generateChain } from "../src/lib/duel/chain.server";
import {
  CHAIN_BOARD_H_PX,
  CHAIN_BOARD_W_PX,
  CHAIN_NODE_GAP_PX,
  CHAIN_NODE_PX,
} from "../src/lib/duel/types";
import { buildStopWatch, markerState } from "../src/puzzles/stopWatch";

for (let run = 0; run < 100; run++) {
  const puzzle = buildStopWatch();
  if (puzzle.watches.length !== 10) throw new Error("Stop Watch must contain ten watches");
  puzzle.watches.forEach((spec, index) => {
    if (spec.passes !== index + 2) throw new Error(`Watch ${index + 1} counter is wrong`);
    if (spec.wrap !== (index >= 7)) throw new Error(`Watch ${index + 1} movement mode is wrong`);
    const durations = spec.passSweepMs ?? Array.from({ length: spec.passes }, () => spec.sweepMs);
    let elapsed = 0;
    for (let pass = 0; pass < spec.passes; pass++) {
      const duration = durations[pass] ?? spec.sweepMs;
      const outbound = markerState(spec, elapsed + Math.floor(duration / 2));
      if (outbound.pass !== pass || outbound.dir !== 1) throw new Error(`Watch ${index + 1} outbound failed`);
      elapsed += duration;
      if (pass + 1 < spec.passes && !spec.wrap) {
        const returning = markerState(spec, elapsed + Math.floor(duration / 2));
        if (returning.pass !== pass + 1 || returning.dir !== -1) throw new Error(`Watch ${index + 1} bounce failed`);
        elapsed += duration;
      }
    }
    if (markerState(spec, elapsed).pass !== spec.passes) throw new Error(`Watch ${index + 1} did not expire`);
  });
}

const minimum = CHAIN_NODE_PX + CHAIN_NODE_GAP_PX;
for (let run = 0; run < 20; run++) {
  const puzzle = generateChain();
  for (const [setIndex, set] of puzzle.sets.entries()) {
    if (set.nodes.length !== 28) throw new Error(`Chain set ${setIndex + 1} does not have 28 nodes`);
    for (let a = 0; a < set.nodes.length; a++) {
      for (let b = a + 1; b < set.nodes.length; b++) {
        const left = set.nodes[a]!;
        const right = set.nodes[b]!;
        const distance = Math.hypot(
          ((left.x - right.x) / 100) * CHAIN_BOARD_W_PX,
          ((left.y - right.y) / 100) * CHAIN_BOARD_H_PX,
        );
        if (distance < minimum - 0.01) throw new Error(`Chain set ${setIndex + 1} nodes touch`);
      }
    }
  }
}

console.log("Stop Watch: 100/100 transition sets valid");
console.log("Chain: 320/320 scattered sets keep 28 non-touching nodes");