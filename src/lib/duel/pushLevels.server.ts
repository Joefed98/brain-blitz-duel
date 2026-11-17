/**
 * Heave's levels (the Pattern overhaul, stage 3, 16 Nov 2026; src/lib/levels/pattern/push.levels.ts): a level's
 * warehouse drawn from its own proved bank (pushLevelBank.server.ts, scripts/push-levels-bank.ts) by the room seed, on
 * Normal's stamps (pushRev and the rest come from the deal's layers as on Normal). Server-only.
 */
import type { Level } from "@/lib/levels/levels";

import { d4BankIndex } from "./depth4/bankIndex";
import { PUSH_LEVEL_BANK } from "./pushLevelBank.server";
import { randomBelow } from "./random";
import type { PushPuzzleData } from "./types";

export type PushLevel = Exclude<Level, "normal">;

export function isPushLevel(level: Level | undefined): level is PushLevel {
  return level === "easy" || level === "hard" || level === "expert";
}

/** A level's board for a room seed (no seed: a random draw, as Normal's practice fallback). */
export function drawPushLevel(level: PushLevel, seed: number | undefined): PushPuzzleData {
  const bank = PUSH_LEVEL_BANK[level];
  const index = seed === undefined ? randomBelow(bank.length) : d4BankIndex(`push:${level}`, seed, bank.length);
  const entry = bank[index]!;
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
