/** Heave's bigger warehouses (pushRev 1): a layout from its own bank, with its gold crate. Server-only. */
import { randomBelow } from "../random";
import type { PushPuzzleData } from "../types";
import { PUSH_D4_BANK } from "./pushD4Bank.server";
import { d4BankIndex } from "./bankIndex";

export function drawPushD4(seed: number | undefined): PushPuzzleData {
  const size = PUSH_D4_BANK.length;
  const entry = PUSH_D4_BANK[seed === undefined ? randomBelow(size) : d4BankIndex("pushD4", seed, size)]!;
  return {
    type: "push",
    walls: [...entry.walls],
    crates: [...entry.crates],
    targets: [...entry.targets],
    pusher: entry.pusher,
    gold: { ...entry.gold },
    minPushes: entry.minPushes,
    stats: { crates: entry.crates.length, minPushes: entry.minPushes, minMoves: entry.minMoves, detour: entry.detour },
    solution: entry.solution,
  };
}
