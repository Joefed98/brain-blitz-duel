/**
 * Server-only generation for Don't Break the Chain.
 *
 * Every layout is checked step by step: at each of the twelve taps there are at
 * least two nodes that satisfy the rule and at least four that do not, so the
 * player always has a choice to make and something to avoid.
 */

import { pick, random, shuffled } from "./random";
import { CHAIN_CYCLE, CHAIN_LENGTH, chainRequired, chainValue } from "./chain";
import {
  CHAIN_COLOURS,
  CHAIN_MIN_INVALID,
  CHAIN_MIN_VALID,
  CHAIN_NODES,
  CHAIN_NODE_GAP,
  CHAIN_SHAPES,
  type ChainNode,
  type ChainPuzzleData,
  type ChainRuleKind,
} from "./types";

/** Nodes are kept a minimum distance apart so no two discs overlap. */
function layout(gap: number): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  let guard = 0;
  while (points.length < CHAIN_NODES && guard++ < 6000) {
    const x = 9 + random() * 82;
    const y = 9 + random() * 82;
    if (points.some((point) => Math.hypot(point.x - x, point.y - y) < gap)) continue;
    points.push({ x, y });
  }
  return points;
}

/** True when every step of the chain has enough right and wrong choices. */
export function chainLayoutIsFair(
  nodes: ChainNode[],
  kind: ChainRuleKind,
  cycle: string[],
): boolean {
  for (let step = 0; step < CHAIN_LENGTH; step++) {
    const needed = chainRequired(cycle, step);
    const valid = nodes.filter((node) => chainValue(node, kind) === needed).length;
    const invalid = nodes.length - valid;
    if (valid < CHAIN_MIN_VALID || invalid < CHAIN_MIN_INVALID) return false;
  }
  return true;
}

export function generateChain(): ChainPuzzleData {
  const kind: ChainRuleKind = random() < 0.5 ? "shape" : "colour";
  const values = kind === "shape" ? [...CHAIN_SHAPES] : [...CHAIN_COLOURS];
  const cycle = shuffled(values).slice(0, CHAIN_CYCLE);

  for (let attempt = 0; attempt < 200; attempt++) {
    const gap = attempt < 120 ? CHAIN_NODE_GAP : CHAIN_NODE_GAP - 2;
    const points = layout(gap);
    if (points.length < CHAIN_NODES) continue;

    // Give every value in the cycle a fair share, then fill at random.
    const assigned: string[] = [];
    for (const value of cycle) for (let i = 0; i < 4; i++) assigned.push(value);
    while (assigned.length < CHAIN_NODES) assigned.push(pick(cycle));
    const spread = shuffled(assigned);

    const nodes: ChainNode[] = points.map((point, index) => {
      const value = spread[index]!;
      return {
        x: Math.round(point.x * 10) / 10,
        y: Math.round(point.y * 10) / 10,
        shape: (kind === "shape" ? value : pick(CHAIN_SHAPES)) as ChainNode["shape"],
        colour: (kind === "colour" ? value : pick(CHAIN_COLOURS)) as ChainNode["colour"],
      };
    });

    if (!chainLayoutIsFair(nodes, kind, cycle)) continue;
    return { type: "chain", nodes, kind, cycle };
  }
  throw new Error("Don't Break the Chain generator could not build a fair layout");
}
