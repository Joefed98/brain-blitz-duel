/** Tessellate's 7×7 deal (blockRev 1): a board from its own bank by the room seed. Server-only. */
import { randomBelow } from "../random";
import type { BlockPartyPuzzleData } from "../types";
import { BLOCK_D4_BANK } from "./blockD4Bank.server";
import { d4BankIndex } from "./bankIndex";

export function drawBlockD4(seed: number | undefined): BlockPartyPuzzleData {
  const size = BLOCK_D4_BANK.length;
  const index = seed === undefined ? randomBelow(size) : d4BankIndex("blockD4", seed, size);
  return JSON.parse(JSON.stringify(BLOCK_D4_BANK[index]!)) as BlockPartyPuzzleData;
}
