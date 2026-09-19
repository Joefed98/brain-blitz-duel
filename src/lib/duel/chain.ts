/**
 * Don't Break the Chain rules. The cycle repeats forever: the value needed at
 * step `n` is `cycle[n % 3]`. The phone draws the chain from the same replay the
 * server uses to grade it.
 */

import { CHAIN_CYCLE, CHAIN_LENGTH, type ChainNode, type ChainRuleKind } from "./types";

export function chainValue(node: ChainNode, kind: ChainRuleKind): string {
  return kind === "shape" ? node.shape : node.colour;
}

/** What the next tap has to be, at any point in the chain. */
export function chainRequired(cycle: string[], step: number): string {
  return cycle[step % CHAIN_CYCLE]!;
}

export function encodeChainTaps(taps: number[]): string {
  return taps.join(",");
}

export function decodeChainTaps(raw: string): number[] {
  return String(raw ?? "")
    .split(",")
    .map((part) => Number.parseInt(part, 10))
    .filter((value) => Number.isInteger(value) && value >= 0)
    .slice(0, 200);
}

export interface ChainReplay {
  /** Correct taps, in order — the gold chain. */
  chain: number[];
  errors: number;
  completed: boolean;
  /** One verdict per tap, in tap order. */
  verdicts: boolean[];
}

/** The one place a tap list becomes a chain — used on the phone and the server. */
export function replayChain(
  nodes: ChainNode[],
  kind: ChainRuleKind,
  cycle: string[],
  taps: number[],
): ChainReplay {
  const chain: number[] = [];
  const verdicts: boolean[] = [];
  let errors = 0;

  for (const tap of taps) {
    if (chain.length >= CHAIN_LENGTH) break;
    const node = nodes[tap];
    if (!node) {
      verdicts.push(false);
      errors++;
      continue;
    }
    const ok = chainValue(node, kind) === chainRequired(cycle, chain.length);
    verdicts.push(ok);
    if (ok) chain.push(tap);
    else errors++;
  }

  return { chain, errors, completed: chain.length >= CHAIN_LENGTH, verdicts };
}
