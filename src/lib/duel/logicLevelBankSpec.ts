/**
 * Which Logic overhaul levels are dealt from a bank (stage 3, 16 Nov 2026): the ones that take seconds to build live.
 * Shared by the deal (logicLevelDeal.server.ts), the bank builder (scripts/logic-level-bank.ts) and its check.
 */
import type { Level } from "@/lib/levels/levels";
import type { PuzzleType } from "./types";

export const LOGIC_LEVEL_BANKED: readonly { type: PuzzleType; level: Level }[] = [
  { type: "trail", level: "hard" },
  { type: "trail", level: "expert" },
  { type: "fillomino", level: "expert" },
];

/** Boards in each bank. */
export const LOGIC_LEVEL_BANK_SIZE = 120;

export function isBankedLevel(type: string, level: Level): boolean {
  return LOGIC_LEVEL_BANKED.some((b) => b.type === type && b.level === level);
}

/** The seed entry `i` of a bank is built from (fixed, so the bank rebuilds byte for byte). */
export function logicLevelBankSeed(type: string, level: string, i: number): number {
  let h = 0x811c9dc5;
  for (const ch of `${type}:${level}:${i}`) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193) >>> 0;
  return h >>> 1;
}
