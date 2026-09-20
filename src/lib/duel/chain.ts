/**
 * Don't Break the Chain rules. The shape cycle repeats forever. A correct node
 * must be unused, match the next shape, and add a segment that does not cross
 * the existing chain. The phone and server grade through this same replay.
 */

import { CHAIN_CYCLE, CHAIN_LENGTH, type ChainNode, type ChainShape } from "./types";

/** What the next tap has to be, at any point in the chain. */
export function chainRequired(cycle: ChainShape[], step: number): ChainShape {
  return cycle[step % CHAIN_CYCLE]!;
}

const EPSILON = 0.0001;

/** Any positioned point — chain nodes and One-Stroke dots both qualify. */
type Point = { x: number; y: number };

function orientation(a: Point, b: Point, c: Point): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function onSegment(a: Point, b: Point, point: Point): boolean {
  return (
    point.x >= Math.min(a.x, b.x) - EPSILON &&
    point.x <= Math.max(a.x, b.x) + EPSILON &&
    point.y >= Math.min(a.y, b.y) - EPSILON &&
    point.y <= Math.max(a.y, b.y) + EPSILON
  );
}

/** True when two closed line segments touch or cross. */
export function chainSegmentsIntersect(a: Point, b: Point, c: Point, d: Point): boolean {
  const abC = orientation(a, b, c);
  const abD = orientation(a, b, d);
  const cdA = orientation(c, d, a);
  const cdB = orientation(c, d, b);
  if (
    ((abC > EPSILON && abD < -EPSILON) || (abC < -EPSILON && abD > EPSILON)) &&
    ((cdA > EPSILON && cdB < -EPSILON) || (cdA < -EPSILON && cdB > EPSILON))
  ) {
    return true;
  }
  return (
    (Math.abs(abC) <= EPSILON && onSegment(a, b, c)) ||
    (Math.abs(abD) <= EPSILON && onSegment(a, b, d)) ||
    (Math.abs(cdA) <= EPSILON && onSegment(c, d, a)) ||
    (Math.abs(cdB) <= EPSILON && onSegment(c, d, b))
  );
}

/** Would appending `next` cross an existing segment? The shared last endpoint is excluded. */
export function chainWouldCross(nodes: ChainNode[], chain: number[], next: number): boolean {
  if (chain.length < 2) return false;
  const last = chain[chain.length - 1];
  if (last === undefined) return false;
  const from = nodes[last];
  const to = nodes[next];
  if (!from || !to) return true;
  for (let index = 1; index < chain.length - 1; index++) {
    const a = nodes[chain[index - 1]!];
    const b = nodes[chain[index]!];
    if (a && b && chainSegmentsIntersect(a, b, from, to)) return true;
  }
  return false;
}

/** Undo and Reset travel in the tap list, so the server replays them too. */
export const CHAIN_UNDO = -1;
export const CHAIN_RESET = -2;

export function encodeChainTaps(taps: number[]): string {
  return taps.map((tap) => (tap === CHAIN_UNDO ? "u" : tap === CHAIN_RESET ? "r" : tap)).join(",");
}

export function decodeChainTaps(raw: string): number[] {
  return String(raw ?? "")
    .split(",")
    .map((part) => {
      const token = part.trim();
      if (token === "u") return CHAIN_UNDO;
      if (token === "r") return CHAIN_RESET;
      return Number.parseInt(token, 10);
    })
    .filter((value) => Number.isInteger(value) && value >= CHAIN_RESET)
    .slice(0, 400);
}

export interface ChainReplay {
  /** The exact repeating three-item rule used by this round. */
  rule: ChainShape[];
  /** Number of accepted nodes; also selects rule[index % 3]. */
  index: number;
  /** Correct taps, in order — the gold chain. */
  chain: number[];
  errors: number;
  completed: boolean;
  /** One verdict per tap, in tap order. */
  verdicts: boolean[];
}

/** The one place a tap list becomes a chain — used on the phone and the server. */
export function replayChain(nodes: ChainNode[], cycle: ChainShape[], taps: number[]): ChainReplay {
  const chain: number[] = [];
  const verdicts: boolean[] = [];
  let errors = 0;

  for (const tap of taps) {
    if (chain.length >= CHAIN_LENGTH) break;
    // Undo drops the last link and Reset clears the chain; neither forgives an
    // error already logged.
    if (tap === CHAIN_UNDO) {
      chain.pop();
      verdicts.push(true);
      continue;
    }
    if (tap === CHAIN_RESET) {
      chain.length = 0;
      verdicts.push(true);
      continue;
    }
    const node = nodes[tap];
    if (!node) {
      verdicts.push(false);
      errors++;
      continue;
    }
    const ok =
      !chain.includes(tap) &&
      node.shape === chainRequired(cycle, chain.length) &&
      !chainWouldCross(nodes, chain, tap);
    verdicts.push(ok);
    if (ok) chain.push(tap);
    else errors++;
  }

  return {
    rule: cycle.slice(0, CHAIN_CYCLE),
    index: chain.length,
    chain,
    errors,
    completed: chain.length >= CHAIN_LENGTH,
    verdicts,
  };
}
