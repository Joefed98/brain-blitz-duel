/**
 * Server-only generation for Don't Break the Chain.
 *
 * A depth-first search stores one twelve-node non-crossing path. Once crossing
 * becomes geometrically possible, every stored-solution step also has a
 * shape-valid crossing trap, plus at least three shape-invalid nodes.
 */

import { random, shuffled } from "./random";
import { chainRequired, chainWouldCross } from "./chain";
import {
  CHAIN_CYCLE,
  CHAIN_LENGTH,
  CHAIN_MIN_INVALID,
  CHAIN_NODES,
  CHAIN_NODE_GAP,
  CHAIN_SHAPES,
  type ChainNode,
  type ChainPuzzleData,
  type ChainShape,
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

function stepHasRequiredChoices(nodes: ChainNode[], cycle: ChainShape[], chain: number[]): boolean {
  const needed = chainRequired(cycle, chain.length);
  const unused = nodes.map((_node, index) => index).filter((index) => !chain.includes(index));
  const invalid = unused.filter((index) => nodes[index]?.shape !== needed).length;
  if (invalid < CHAIN_MIN_INVALID) return false;
  // Crossing cannot exist until there are two prior segments. Thereafter every
  // stored-solution step must deliberately offer a shape-valid crossing trap.
  if (chain.length < 3) return true;
  return unused.some(
    (index) => nodes[index]?.shape === needed && chainWouldCross(nodes, chain, index),
  );
}

/** Depth-first search for one valid non-crossing twelve-node chain. */
export function findChainSolution(nodes: ChainNode[], cycle: ChainShape[]): number[] | null {
  let visits = 0;
  const search = (chain: number[]): number[] | null => {
    if (++visits > 120_000) return null;
    if (chain.length >= CHAIN_LENGTH) return chain;
    if (!stepHasRequiredChoices(nodes, cycle, chain)) return null;
    const needed = chainRequired(cycle, chain.length);
    const choices = shuffled(
      nodes
        .map((_node, index) => index)
        .filter(
          (index) =>
            !chain.includes(index) &&
            nodes[index]?.shape === needed &&
            !chainWouldCross(nodes, chain, index),
        ),
    );
    for (const choice of choices) {
      const solved = search([...chain, choice]);
      if (solved) return solved;
    }
    return null;
  };
  return search([]);
}

export function chainSolutionIsFair(
  nodes: ChainNode[],
  cycle: ChainShape[],
  solution: number[],
): boolean {
  if (solution.length !== CHAIN_LENGTH) return false;
  const chain: number[] = [];
  for (const node of solution) {
    if (!stepHasRequiredChoices(nodes, cycle, chain)) return false;
    if (
      chain.includes(node) ||
      nodes[node]?.shape !== chainRequired(cycle, chain.length) ||
      chainWouldCross(nodes, chain, node)
    ) {
      return false;
    }
    chain.push(node);
  }
  return true;
}

export function generateChain(): ChainPuzzleData {
  const cycle = shuffled([...CHAIN_SHAPES]).slice(0, CHAIN_CYCLE);

  for (let attempt = 0; attempt < 500; attempt++) {
    const gap = attempt < 120 ? CHAIN_NODE_GAP : CHAIN_NODE_GAP - 2;
    const points = layout(gap);
    if (points.length < CHAIN_NODES) continue;

    // Six of each shape supports four complete turns through the cycle.
    const assigned: ChainShape[] = [];
    for (const value of cycle)
      for (let i = 0; i < CHAIN_NODES / CHAIN_CYCLE; i++) assigned.push(value);
    const spread = shuffled(assigned);

    const nodes: ChainNode[] = points.map((point, index) => {
      return {
        x: Math.round(point.x * 10) / 10,
        y: Math.round(point.y * 10) / 10,
        shape: spread[index]!,
      };
    });

    const solution = findChainSolution(nodes, cycle);
    if (!solution || !chainSolutionIsFair(nodes, cycle, solution)) continue;
    return { type: "chain", nodes, cycle, solution };
  }
  throw new Error("Don't Break the Chain generator could not build a fair layout");
}
