/**
 * Server-only Unblock round building. Layouts come from the verified bank; the
 * minimum move count and its solution stay server-side until the reveal.
 */

import type { Db } from "@/lib/data/db.server";
import { markUnblockUsed, readLeastUsedUnblockRows } from "@/lib/data/practice.server";

import { NORMAL, type Level } from "@/lib/levels/levels";
import { gameLevelSettings } from "@/lib/levels/gameLevels";
import type { UnblockLevelSettings } from "@/lib/levels/pattern/unblock.levels";

import { pick } from "./random";
import { saltSeed, seededRng } from "./seededRng";
import { occupancy, parseLayout } from "./unblock";
import { UNBLOCK_BANK } from "./unblockBank.server";
import { UNBLOCK_LEVEL_BANK } from "./unblockLevelsBank.server";
import { UNBLOCK_COLS, UNBLOCK_TIME_MS, type UnblockPuzzleData, type UnblockVehicle } from "./types";

export interface UnblockBankRow {
  layout: string;
  min_moves: number;
  solution: string;
}

/**
 * Builds a round from one bank entry. The layouts are solved ahead of time by
 * scripts/unblock-bank.ts — no solver ever runs while a room is live. With no
 * row (the bank could not be reached) the built-in verified list is used.
 */
export function generateUnblock(row?: UnblockBankRow | null, level?: Level, bankSeed?: number): UnblockPuzzleData {
  if (level && level !== NORMAL) {
    const leveled = generateUnblockLevel(level, bankSeed);
    if (leveled) return leveled;
  }
  const entry = row ? `${row.layout}|${row.min_moves}|${row.solution}` : pick(UNBLOCK_BANK);
  const [layout, min, solution] = entry.split("|");
  const vehicles = parseLayout(layout ?? "");
  const minMoves = Number.parseInt(min ?? "", 10);
  return {
    type: "unblock",
    vehicles,
    minMoves: Number.isFinite(minMoves) ? minMoves : 0,
    // The bank separates moves with ";"; the shared codec uses ",".
    solution: (solution ?? "").split(";").join(","),
  };
}

/**
 * A board at a level beyond Normal (the difficulty levels, 15 Nov 2026; src/lib/levels/pattern/unblock.levels.ts):
 * one entry of the level's proved bank (unblockLevelsBank.server.ts), picked by the deal's bank seed (rooms: the room
 * seed, so every player gets the same lot; practice a fresh one), or at random with none. Stamps the lot size when it
 * isn't 7 and the clock when it isn't 60 s. Null for a level with no bank (dealt as Normal).
 */
export function generateUnblockLevel(level: Level, bankSeed?: number): UnblockPuzzleData | null {
  const settings = gameLevelSettings<UnblockLevelSettings>("unblock", level);
  const bank = UNBLOCK_LEVEL_BANK[level as keyof typeof UNBLOCK_LEVEL_BANK];
  if (!settings || !bank?.length) return null;
  const entry = bankSeed === undefined ? pick(bank) : bank[seededRng(saltSeed(bankSeed, `unblock:${level}`)).below(bank.length)]!;
  const [layout, min, solution] = entry.split("|");
  const minMoves = Number.parseInt(min ?? "", 10);
  return {
    type: "unblock",
    vehicles: parseLayout(layout ?? ""),
    minMoves: Number.isFinite(minMoves) ? minMoves : 0,
    solution: (solution ?? "").split(";").join(","),
    ...(settings.cols !== UNBLOCK_COLS ? { cols: settings.cols } : {}),
    ...(settings.timeLimitMs !== UNBLOCK_TIME_MS ? { timeLimitMs: settings.timeLimitMs } : {}),
  };
}

/** How many of the least recently used layouts a draw chooses from. */
const UNBLOCK_DRAW_POOL = 100;

/**
 * Picks a layout from the stored bank, avoiding recent ones: only the 100
 * least recently used are candidates, and the pick is stamped as used.
 */
export async function drawUnblockRow(client: Db): Promise<UnblockBankRow | null> {
  try {
    const { data, error } = await readLeastUsedUnblockRows(client, UNBLOCK_DRAW_POOL);
    if (error || !data?.length) return null;
    const row = pick(data as (UnblockBankRow & { id: number })[]);
    await markUnblockUsed(client, row.id, new Date().toISOString());
    return row;
  } catch (err) {
    console.error("[unblock] bank draw failed", err);
    return null;
  }
}

/** Cars standing between the gold car's nose and the exit gap (`n` the lot's size, `unblockCols`). */
export function blockingCars(vehicles: UnblockVehicle[], n: number = UNBLOCK_COLS): number {
  const gold = vehicles.find((v) => v.id === 0);
  if (!gold) return 0;
  const taken = occupancy(vehicles, 0, n);
  let blockers = 0;
  for (let col = gold.col + gold.len; col < n; col++) {
    if (taken.has(gold.row * n + col)) blockers += 1;
  }
  return blockers;
}
