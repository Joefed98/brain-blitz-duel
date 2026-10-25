/**
 * Don't Break the Chain rules. A three-item shape-and-colour cycle repeats; each
 * correct tap must match it on the current board, inside the momentum window.
 * The first wrong tap or lapse breaks the chain. The phone and the server walk
 * the same timed tap list through replayChain.
 */

import { finishParts, partialParts, scoreRev1 } from "./puzzleScoreRev";
import { speedBonusCurve } from "./speedPar";
import {
  CHAIN_BLOCK,
  CHAIN_CYCLE,
  CHAIN_CYCLE_REV,
  CHAIN_LENGTH,
  CHAIN_REVERSE_AT,
  CHAIN_REVERSE_LINKS,
  CHAIN_LINK_POINTS,
  CHAIN_FINISH_BONUS,
  CHAIN_RULES_VERSION,
  CHAIN_FASTER_AT,
  CHAIN_MOMENTUM_MS,
  CHAIN_TIME_MS,
  type ChainBreak,
  type ChainPuzzleData,
  type ChainRuleItem,
} from "./types";

/** What the next tap has to be, after `links` correct taps. */
export function chainRequired(cycle: ChainRuleItem[], links: number): ChainRuleItem | undefined {
  return cycle[links % CHAIN_CYCLE];
}

/** Stored per-board rule, with the original rule retained for older rounds. */
export function chainCycleAt(puzzle: ChainPuzzleData, links: number): ChainRuleItem[] {
  return puzzle.cycles?.[chainBoardIndex(links, puzzle)] ?? puzzle.cycle;
}

/** Each new board starts its new cycle at the first symbol. */
export function chainRuleStep(puzzle: ChainPuzzleData, links: number): number {
  return puzzle.cycles ? links % CHAIN_BLOCK : links;
}

/** chainCycleRev 1: five-symbol cycles, reversed on the board from CHAIN_REVERSE_AT. */
export function chainLongCycles(puzzle: ChainPuzzleData | undefined): boolean {
  return puzzle?.chainCycleRev === CHAIN_CYCLE_REV;
}

/** chainCycleRev 1: this link (0-based, the links already made) is on the reversed board. */
export function chainReversedAt(puzzle: ChainPuzzleData | undefined, links: number): boolean {
  return chainLongCycles(puzzle) && links >= CHAIN_REVERSE_AT && links < CHAIN_REVERSE_AT + CHAIN_REVERSE_LINKS;
}

/** Which preview item the next tap needs: its index in the board's cycle. */
export function chainCycleIndex(puzzle: ChainPuzzleData, links: number): number {
  if (!chainLongCycles(puzzle)) return chainRuleStep(puzzle, links) % CHAIN_CYCLE;
  const cycle = chainCycleAt(puzzle, links);
  const step = chainRuleStep(puzzle, links) % cycle.length;
  return chainReversedAt(puzzle, links) ? cycle.length - 1 - step : step;
}

export function chainRequiredAt(puzzle: ChainPuzzleData, links: number): ChainRuleItem | undefined {
  if (chainLongCycles(puzzle)) return chainCycleAt(puzzle, links)[chainCycleIndex(puzzle, links)];
  return chainRequired(chainCycleAt(puzzle, links), chainRuleStep(puzzle, links));
}

/** Resolve old rounds from their stored board count, never today's constants. */
export function chainRules(puzzle?: ChainPuzzleData) {
  const legacyLength = puzzle && puzzle.rulesVersion !== CHAIN_RULES_VERSION
    ? puzzle.boards.length * CHAIN_BLOCK : 0;
  if (legacyLength === 25 || legacyLength === 30) {
    return {
      length: legacyLength,
      points: legacyLength === 25 ? 6 : 5,
      bonus: 0,
      bands: [{ upTo: 10, ms: 3000 }, { upTo: 18, ms: 2500 }, { upTo: legacyLength, ms: 2000 }],
      fasterAt: [10, 18, 26] as readonly number[],
    };
  }
  return { length: CHAIN_LENGTH, points: CHAIN_LINK_POINTS, bonus: CHAIN_FINISH_BONUS,
    bands: CHAIN_MOMENTUM_MS, fasterAt: CHAIN_FASTER_AT as readonly number[] };
}

/** Momentum window for the next 1-based link; the first tap is untimed. */
export function chainWindowMs(link: number, puzzle?: ChainPuzzleData): number {
  const bands = chainRules(puzzle).bands;
  for (const band of bands) if (link <= band.upTo) return band.ms;
  return bands.at(-1)?.ms ?? 2000;
}

/** The board shown after `links` correct taps. */
export function chainBoardIndex(links: number, puzzle?: ChainPuzzleData): number {
  return Math.min(Math.floor(links / CHAIN_BLOCK), Math.floor((chainRules(puzzle).length - 1) / CHAIN_BLOCK));
}

/**
 * chainCycleRev 1: unfinished credit by links made: 4 a link to 20 at five links,
 * then floor(20 + 59 × ((links − 5) ÷ 14)^0.95) to 79 at 19 links, then
 * floor(79 + 31 × ((links − 19) ÷ 20)^0.7) to 110 at 39, so the early links pay a
 * little and the curve flattens towards one short. Written out so phone and server
 * never depend on Math.pow rounding.
 */
export const CHAIN_CYCLE_REV_CREDIT: readonly number[] = [
  0, 4, 8, 12, 16, 20, 24, 29, 33, 37, 42, 46, 50, 54, 58, 62, 66, 70, 74, 79,
  82, 85, 87, 89, 90, 92, 93, 95, 96, 98, 99, 100, 101, 103, 104, 105, 106, 107, 108, 110,
];

/** Shared server-scoring rule, with the original rule for stored rounds. */
export function chainScore(links: number, msRemaining = 0, puzzle?: ChainPuzzleData): number {
  const rules = chainRules(puzzle);
  const count = Math.max(0, Math.min(rules.length, Math.floor(links)));
  if (scoreRev1()) {
    // Rev 1: all links = 120 + PAR(30); otherwise 110 × links ÷ (links − 1) of the chain, so one short is 110.
    if (count === rules.length) return finishParts(speedBonusCurve(30, msRemaining, CHAIN_TIME_MS));
    // chainCycleRev 1: the same 110 one short, on a concave curve, so a chain that
    // breaks at the reversed board (link 20) keeps most of its credit.
    if (chainLongCycles(puzzle)) return partialParts(CHAIN_CYCLE_REV_CREDIT[count] ?? 110);
    return partialParts(Math.floor((110 * count) / Math.max(1, rules.length - 1)));
  }
  const bonus = count === rules.length
    ? speedBonusCurve(rules.bonus, msRemaining, CHAIN_TIME_MS) : 0;
  return Math.min(150, Math.floor(rules.points * count) + bonus);
}

/**
 * Old recordings use the old timing bands (or, before chainCycleRev 1, three-symbol cycles) and must be recorded again;
 * since Depth to 200 (25 Oct 2026) a demo must also be on chainDepthRev 1, which shows the milestone pips.
 */
export function chainDemoCompatible(puzzle: ChainPuzzleData): boolean {
  return puzzle.rulesVersion === CHAIN_RULES_VERSION && puzzle.boards.length === CHAIN_LENGTH / CHAIN_BLOCK && chainLongCycles(puzzle) && (puzzle.chainDepthRev ?? 0) >= 1;
}

/** One tap: node index on the board showing at the time, ms since the round began. */
export interface ChainTap {
  node: number;
  t: number;
}

export interface ChainAnswer {
  taps: ChainTap[];
  /** The phone's stated reason; the server re-derives what it can. */
  reason: ChainBreak;
}

const REASONS: ChainBreak[] = ["wrong", "momentum", "timer", "complete"];

/** "node@ms,node@ms|reason" */
export function encodeChainAnswer(answer: ChainAnswer): string {
  return `${answer.taps.map((tap) => `${tap.node}@${Math.round(tap.t)}`).join(",")}|${answer.reason}`;
}

export function decodeChainAnswer(raw: string): ChainAnswer {
  const [list = "", reasonRaw = "timer"] = String(raw ?? "").split("|");
  const taps: ChainTap[] = [];
  for (const part of list.split(",")) {
    const [nodeRaw, timeRaw] = part.split("@");
    const node = Number.parseInt(nodeRaw ?? "", 10);
    const t = Number.parseInt(timeRaw ?? "", 10);
    if (!Number.isInteger(node) || !Number.isInteger(t) || node < 0 || t < 0) continue;
    taps.push({ node, t });
    if (taps.length >= CHAIN_LENGTH + 1) break;
  }
  const reason = REASONS.includes(reasonRaw as ChainBreak) ? (reasonRaw as ChainBreak) : "timer";
  return { taps, reason };
}

export interface ChainReplay {
  /** Correct links made before the chain ended. */
  links: number;
  /** Why the chain ended (or "timer" while it is still live). */
  reason: ChainBreak;
  /** Node indices used on each board, in order. */
  used: number[][];
  /** Time (ms) of the last correct tap, or null before the first. */
  lastT: number | null;
  /** True once the chain is over (broken or complete). */
  over: boolean;
}

/** Validates one tap against a live replay; does not mutate. */
export function chainTapVerdict(
  puzzle: ChainPuzzleData,
  replay: ChainReplay,
  tap: ChainTap,
): "ok" | "wrong" | "momentum" {
  if (replay.lastT !== null && tap.t - replay.lastT > chainWindowMs(replay.links + 1, puzzle)) {
    return "momentum";
  }
  const board = chainBoardIndex(replay.links, puzzle);
  const node = puzzle.boards[board]?.[tap.node];
  const need = chainRequiredAt(puzzle, replay.links);
  if (!node || !need) return "wrong";
  if (replay.used[board]?.includes(tap.node)) return "wrong";
  return node.shape === need.shape && node.colour === need.colour ? "ok" : "wrong";
}

/** The one place a timed tap list becomes a chain — used on the phone and the server. */
export function replayChain(puzzle: ChainPuzzleData, answer: ChainAnswer): ChainReplay {
  const replay: ChainReplay = { links: 0, reason: "timer", used: [], lastT: null, over: false };
  let previousT = -1;
  for (const tap of answer.taps) {
    if (replay.over) break;
    // Times must run forwards and stay inside the round.
    if (tap.t < previousT || tap.t > CHAIN_TIME_MS) break;
    previousT = tap.t;
    const verdict = chainTapVerdict(puzzle, replay, tap);
    if (verdict !== "ok") {
      replay.reason = verdict;
      replay.over = true;
      break;
    }
    const board = chainBoardIndex(replay.links, puzzle);
    (replay.used[board] ??= []).push(tap.node);
    replay.links += 1;
    replay.lastT = tap.t;
    if (replay.links >= chainRules(puzzle).length) {
      replay.reason = "complete";
      replay.over = true;
    }
  }
  // A lapse after the last tap leaves no tap to prove it; trust only a momentum claim.
  if (!replay.over && answer.reason === "momentum" && replay.links > 0) {
    replay.reason = "momentum";
    replay.over = true;
  }
  return replay;
}
