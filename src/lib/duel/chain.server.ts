/**
 * Server-only generation for Don't Break the Chain.
 *
 * A depth-first search counts non-crossing twelve-node paths, capped at 200.
 * Accepted layouts have 1–8 routes, at least two early dead-end traps, and a
 * shape-valid crossing choice wherever crossing is geometrically possible.
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

const CHAIN_SOLUTION_CAP = 200;

/** Nodes are spread across alternating halves to make crossing choices common. */
function layout(gap: number): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  let guard = 0;
  while (points.length < CHAIN_NODES && guard++ < 6000) {
    const band = points.length % 2;
    const x = band === 0 ? 8 + random() * 38 : 54 + random() * 38;
    const y = 8 + random() * 84;
    if (points.some((point) => Math.hypot(point.x - x, point.y - y) < gap)) continue;
    points.push({ x, y });
  }
  return points;
}

function validChoices(nodes: ChainNode[], cycle: ChainShape[], chain: number[]): number[] {
  const needed = chainRequired(cycle, chain.length);
  return nodes
    .map((_node, index) => index)
    .filter(
      (index) =>
        !chain.includes(index) &&
        nodes[index]?.shape === needed &&
        !chainWouldCross(nodes, chain, index),
    );
}

/** Counts complete chains, stopping at the cap so generation stays bounded. */
export function countChainSolutions(
  nodes: ChainNode[],
  cycle: ChainShape[],
  prefix: number[] = [],
  cap = CHAIN_SOLUTION_CAP,
): number {
  let count = 0;
  const search = (chain: number[]) => {
    if (count >= cap) return;
    if (chain.length >= CHAIN_LENGTH) {
      count++;
      return;
    }
    for (const choice of validChoices(nodes, cycle, chain)) search([...chain, choice]);
  };
  search(prefix);
  return count;
}

/** Early shape-valid choices which cannot be extended to twelve links. */
export function chainTrapNodes(nodes: ChainNode[], cycle: ChainShape[]): number[] {
  const traps = new Set<number>();
  const searchPrefixes = (chain: number[]) => {
    if (chain.length >= 5 || traps.size >= 2) return;
    for (const choice of validChoices(nodes, cycle, chain)) {
      const next = [...chain, choice];
      if (countChainSolutions(nodes, cycle, next, 1) === 0) traps.add(choice);
      else searchPrefixes(next);
      if (traps.size >= 2) return;
    }
  };
  searchPrefixes([]);
  return [...traps];
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
  const search = (chain: number[]): number[] | null => {
    if (chain.length >= CHAIN_LENGTH) return chain;
    if (!stepHasRequiredChoices(nodes, cycle, chain)) return null;
    const needed = chainRequired(cycle, chain.length);
    const choices = shuffled(validChoices(nodes, cycle, chain));
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

  for (let attempt = 0; attempt < 30_000; attempt++) {
    const gap = attempt < 5000 ? CHAIN_NODE_GAP : CHAIN_NODE_GAP - 3;
    const points = layout(gap);
    if (points.length < CHAIN_NODES) continue;

    // Twenty nodes: seven choices for the first two cycle positions, six for the last.
    const assigned: ChainShape[] = cycle.flatMap((value, index) =>
      new Array(index < 2 ? 7 : 6).fill(value),
    );
    const spread = shuffled(assigned);

    const nodes: ChainNode[] = points.map((point, index) => {
      return {
        x: Math.round(point.x * 10) / 10,
        y: Math.round(point.y * 10) / 10,
        shape: spread[index]!,
      };
    });

    const solutionCount = countChainSolutions(nodes, cycle);
    if (solutionCount < 1 || solutionCount > 8) continue;
    const solution = findChainSolution(nodes, cycle);
    if (!solution || !chainSolutionIsFair(nodes, cycle, solution)) continue;
    if (chainTrapNodes(nodes, cycle).length < 2) continue;
    return { type: "chain", nodes, cycle, solution, solutionCount };
  }
  throw new Error("Don't Break the Chain generator could not build a fair layout");
}
