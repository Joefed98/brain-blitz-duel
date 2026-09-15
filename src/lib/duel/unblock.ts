/**
 * Unblock rules. Shared by the phone (to decide what a drag may do) and by the
 * server (to replay the moves a phone sends). Pure logic, no rendering.
 */

import { UNBLOCK_COLS as N, UNBLOCK_EXIT_ROW, type UnblockVehicle } from "./types";

export interface UnblockMove {
  id: number;
  /** New column for a horizontal vehicle, new row for a vertical one. */
  to: number;
}

export function vehicleCells(v: UnblockVehicle): number[] {
  return Array.from({ length: v.len }, (_, i) =>
    v.axis === "h" ? v.row * N + v.col + i : (v.row + i) * N + v.col,
  );
}

export function occupancy(vehicles: UnblockVehicle[], skipId?: number): Set<number> {
  const cells = new Set<number>();
  for (const v of vehicles) {
    if (v.id === skipId) continue;
    for (const cell of vehicleCells(v)) cells.add(cell);
  }
  return cells;
}

export function position(v: UnblockVehicle): number {
  return v.axis === "h" ? v.col : v.row;
}

function withPosition(v: UnblockVehicle, to: number): UnblockVehicle {
  return v.axis === "h" ? { ...v, col: to } : { ...v, row: to };
}

/** The lowest and highest position this vehicle can slide to right now. */
export function slideRange(vehicles: UnblockVehicle[], id: number): { min: number; max: number } {
  const v = vehicles.find((entry) => entry.id === id);
  if (!v) return { min: 0, max: 0 };
  const blocked = occupancy(vehicles, id);
  const start = position(v);

  let min = start;
  while (min - 1 >= 0) {
    const cell = v.axis === "h" ? v.row * N + (min - 1) : (min - 1) * N + v.col;
    if (blocked.has(cell)) break;
    min -= 1;
  }
  let max = start;
  while (max + v.len <= N - 1) {
    const next = max + v.len;
    const cell = v.axis === "h" ? v.row * N + next : next * N + v.col;
    if (blocked.has(cell)) break;
    max += 1;
  }
  return { min, max };
}

/** Where a drag actually lands: clamped to the first obstacle or the edge. */
export function clampSlide(vehicles: UnblockVehicle[], id: number, wanted: number): number {
  const { min, max } = slideRange(vehicles, id);
  return Math.max(min, Math.min(max, wanted));
}

export function applyMove(vehicles: UnblockVehicle[], move: UnblockMove): UnblockVehicle[] | null {
  const v = vehicles.find((entry) => entry.id === move.id);
  if (!v) return null;
  const { min, max } = slideRange(vehicles, move.id);
  if (!Number.isInteger(move.to) || move.to < min || move.to > max) return null;
  if (move.to === position(v)) return null;
  return vehicles.map((entry) => (entry.id === move.id ? withPosition(entry, move.to) : entry));
}

/** Solved when the gold car's nose reaches the exit gap on the right edge. */
export function isSolved(vehicles: UnblockVehicle[]): boolean {
  const gold = vehicles.find((v) => v.id === 0);
  if (!gold) return false;
  return gold.axis === "h" && gold.row === UNBLOCK_EXIT_ROW && gold.col + gold.len === N;
}

export function encodeMoves(moves: UnblockMove[]): string {
  return moves.map((m) => `${m.id}:${m.to}`).join(",");
}

export function decodeMoves(raw: string): UnblockMove[] {
  return raw
    .split(",")
    .map((part) => part.split(":"))
    .map(([id, to]) => ({ id: Number.parseInt(id ?? "", 10), to: Number.parseInt(to ?? "", 10) }))
    .filter((m) => Number.isInteger(m.id) && Number.isInteger(m.to))
    .slice(0, 200);
}

export interface UnblockReplay {
  solved: boolean;
  /** Legal moves actually played. */
  moves: number;
}

/** Replays the phone's moves on the stored layout; illegal moves are dropped. */
export function replayUnblock(start: UnblockVehicle[], moves: UnblockMove[]): UnblockReplay {
  let state = start.map((v) => ({ ...v }));
  let played = 0;
  for (const move of moves) {
    const next = applyMove(state, move);
    if (!next) continue;
    state = next;
    played += 1;
    if (isSolved(state)) break;
  }
  return { solved: isSolved(state), moves: played };
}

export function serialiseLayout(vehicles: UnblockVehicle[]): string {
  return vehicles.map((v) => `${v.id}${v.axis}${v.len}${v.row}${v.col}`).join(",");
}

/** Reads "0h2,10v3,..." — the id may be more than one digit. */
export function parseLayout(raw: string): UnblockVehicle[] {
  const out: UnblockVehicle[] = [];
  for (const part of raw.split(",")) {
    const match = /^(\d+)([hv])(\d)(\d)(\d)$/.exec(part.trim());
    if (!match) continue;
    out.push({
      id: Number.parseInt(match[1]!, 10),
      axis: match[2] === "v" ? "v" : "h",
      len: Number.parseInt(match[3]!, 10),
      row: Number.parseInt(match[4]!, 10),
      col: Number.parseInt(match[5]!, 10),
    });
  }
  return out;
}
