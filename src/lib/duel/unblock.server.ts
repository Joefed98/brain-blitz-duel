/**
 * Server-only Unblock round building. Layouts come from the verified bank; the
 * minimum move count and its solution stay server-side until the reveal.
 */

import type { Db } from "@/lib/data/db.server";
import { markUnblockUsed, readLeastUsedUnblockRows } from "@/lib/data/practice.server";

import { pick } from "./random";
import { occupancy, parseLayout } from "./unblock";
import { UNBLOCK_BANK } from "./unblockBank.server";
import { UNBLOCK_COLS, type UnblockPuzzleData, type UnblockVehicle } from "./types";

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
export function generateUnblock(row?: UnblockBankRow | null): UnblockPuzzleData {
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

/** Cars standing between the gold car's nose and the exit gap. */
export function blockingCars(vehicles: UnblockVehicle[]): number {
  const gold = vehicles.find((v) => v.id === 0);
  if (!gold) return 0;
  const taken = occupancy(vehicles, 0);
  let blockers = 0;
  for (let col = gold.col + gold.len; col < UNBLOCK_COLS; col++) {
    if (taken.has(gold.row * UNBLOCK_COLS + col)) blockers += 1;
  }
  return blockers;
}
