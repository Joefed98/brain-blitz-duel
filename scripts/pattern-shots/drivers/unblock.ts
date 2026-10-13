import type { Page } from "playwright";

import { applyMove, decodeMoves, position } from "../../../src/lib/duel/unblock";
import { UNBLOCK_COLS as N, type UnblockVehicle } from "../../../src/lib/duel/types";
import { drag, type Driver, type FullPuzzle } from "../driver";

/** The measured 7 × 7 grid (drag geometry) and the drawn lot (gap measurement). */
const BOARD = ".unblock-grid";

/**
 * Plays solution moves `from`..`to` with real pointer drags (Gridlock keeps
 * its state in the component, so nothing can be seeded). Each move is
 * "vehicleId:newPosition" — a column for a horizontal vehicle, a row for a
 * vertical one.
 */
async function play(page: Page, full: FullPuzzle, count: number) {
  const moves = decodeMoves(full.solution as string);
  let vehicles = (full.vehicles as UnblockVehicle[]).map((v) => ({ ...v }));
  for (const move of moves.slice(0, count)) {
    const vehicle = vehicles.find((v) => v.id === move.id)!;
    const box = (await page.locator(BOARD).first().boundingBox())!;
    const cell = box.width / N;
    const centre = {
      x: box.x + (vehicle.col + (vehicle.axis === "h" ? vehicle.len : 1) / 2) * cell,
      y: box.y + (vehicle.row + (vehicle.axis === "v" ? vehicle.len : 1) / 2) * cell,
    };
    const delta = (move.to - position(vehicle)) * cell;
    const end = vehicle.axis === "h" ? { x: centre.x + delta, y: centre.y } : { x: centre.x, y: centre.y + delta };
    await drag(page, [centre, end], 12);
    vehicles = applyMove(vehicles, move) ?? vehicles;
    await page.waitForTimeout(260);
  }
}

export const driver: Driver = {
  board: ".unblock-lot",
  midPlay: (page, full) => play(page, full, Math.floor(decodeMoves(full.solution).length / 2)),
  // Resolves on the solving drop (the last drag's release).
  finish: async (page, full) => {
    const moves = decodeMoves(full.solution);
    await play(page, { ...full, solution: full.solution }, moves.length - 1);
    const last = moves.at(-1)!;
    let vehicles = (full.vehicles as UnblockVehicle[]).map((v) => ({ ...v }));
    for (const move of moves.slice(0, -1)) vehicles = applyMove(vehicles, move) ?? vehicles;
    const gold = vehicles.find((v) => v.id === last.id)!;
    const box = (await page.locator(BOARD).first().boundingBox())!;
    const cell = box.width / N;
    const y = box.y + (gold.row + 0.5) * cell;
    const x = box.x + (gold.col + gold.len / 2) * cell;
    await drag(page, [{ x, y }, { x: x + (last.to - gold.col) * cell, y }], 12);
  },
};
