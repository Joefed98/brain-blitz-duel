/** Focused Stop Watch movement and Chain scatter checks. */
import { generateChain } from "../src/lib/duel/chain.server";
import { chainRequiredAt, chainWindowMs, replayChain, encodeChainAnswer, decodeChainAnswer } from "../src/lib/duel/chain";
import { scoreChain } from "../src/lib/duel/scoring";
import {
  CHAIN_LENGTH,
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
const ROUNDS = 200;
for (let run = 0; run < ROUNDS; run++) {
  const puzzle = generateChain();
  if (puzzle.boards.length !== 6) throw new Error("Chain needs six boards");
  // Perfect run: pick a matching unused node each step, tapping 1 s apart.
  const taps: { node: number; t: number }[] = [];
  const used: number[][] = [];
  for (let link = 0; link < CHAIN_LENGTH; link++) {
    const board = Math.floor(link / 5);
    const nodes = puzzle.boards[board]!;
    const need = chainRequiredAt(puzzle, link)!;
    // Near-miss decoys exist for this step.
    if (!nodes.some((n) => n.shape === need.shape && n.colour !== need.colour)) throw new Error("no same-shape decoy");
    if (!nodes.some((n) => n.colour === need.colour && n.shape !== need.shape)) throw new Error("no same-colour decoy");
    const pick = nodes.findIndex((n, i) => n.shape === need.shape && n.colour === need.colour && !(used[board] ?? []).includes(i));
    if (pick < 0) throw new Error(`no valid node for link ${link + 1}`);
    (used[board] ??= []).push(pick);
    taps.push({ node: pick, t: 1000 + link * 1000 });
  }
  for (const [setIndex, set] of puzzle.boards.entries()) {
    if (set.length !== 20) throw new Error(`Chain board ${setIndex + 1} does not have 20 nodes`);
    for (let a = 0; a < set.length; a++) {
      for (let b = a + 1; b < set.length; b++) {
        const left = set[a]!;
        const right = set[b]!;
        const distance = Math.hypot(
          ((left.x - right.x) / 100) * CHAIN_BOARD_W_PX,
          ((left.y - right.y) / 100) * CHAIN_BOARD_H_PX,
        );
        if (distance < minimum - 0.01) throw new Error(`Chain board ${setIndex + 1} nodes touch`);
      }
    }
  }
  const full = replayChain(puzzle, decodeChainAnswer(encodeChainAnswer({ taps, reason: "complete" })));
  if (full.links !== 30 || full.reason !== "complete" || scoreChain(full.links) !== 150) throw new Error("perfect run failed");
  // Wrong tap at link 13 breaks with 12 links.
  const wrongNode = puzzle.boards[2]!.findIndex((n) => { const need = chainRequiredAt(puzzle, 12)!; return n.shape !== need.shape || n.colour !== need.colour; });
  const wrong = replayChain(puzzle, { taps: [...taps.slice(0, 12), { node: wrongNode, t: 13_000 }], reason: "wrong" });
  if (wrong.links !== 12 || wrong.reason !== "wrong" || scoreChain(wrong.links) !== 60) throw new Error("wrong-tap break failed");
  // Late tap for link 19 (window 2.5 s... link 19 is 2.0 s) breaks on momentum.
  const late = taps.slice(0, 19).map((tap, i) => (i === 18 ? { ...tap, t: taps[17]!.t + chainWindowMs(19) + 1 } : tap));
  const slow = replayChain(puzzle, { taps: late, reason: "momentum" });
  if (slow.links !== 18 || slow.reason !== "momentum") throw new Error("momentum break failed");
  const onTime = taps.slice(0, 19).map((tap, i) => (i === 18 ? { ...tap, t: taps[17]!.t + chainWindowMs(19) } : tap));
  if (replayChain(puzzle, { taps: onTime, reason: "timer" }).links !== 19) throw new Error("on-time tap rejected");
}
if (chainWindowMs(10) !== 3000 || chainWindowMs(11) !== 2500 || chainWindowMs(18) !== 2500 || chainWindowMs(19) !== 2000 || chainWindowMs(25) !== 2000 || chainWindowMs(26) !== 2000 || chainWindowMs(30) !== 2000) throw new Error("windows wrong");

console.log("Stop Watch: 100/100 transition sets valid");
console.log(`Chain: ${ROUNDS}/${ROUNDS} runs — 30-link run = 150, wrong tap at 13 = 60, late tap breaks, decoys present`);
