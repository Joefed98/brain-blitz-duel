import type { GenerateContext } from "../generate.server";
import type { PuzzleData, TileGridPuzzleData } from "../types";
import type { Level } from "@/lib/levels/levels";
import { TILEGRID_LEVEL_SETTINGS } from "@/lib/levels/word/tilegrid";
import { shuffled } from "../random";
import { decodeTileGrid, TILE_GRID_LEVEL_REV } from "../tileGrid";
import { TILEGRID_LEVEL_BANK } from "../tilegridLevelBank.server";

/**
 * A level board as dealt (D1, 21 Nov 2026): the bank entry's solution on the level's side, its letters as the tray in
 * the deal's order, the level's clock, size, tile count and (Expert) words lit only on Done, on tileGridRev 5.
 */
export function tileGridLevelPuzzle(level: Exclude<Level, "normal">, entry: string, tray: readonly string[]): TileGridPuzzleData {
  const s = TILEGRID_LEVEL_SETTINGS[level];
  return {
    type: "tilegrid",
    tray: [...tray],
    solution: decodeTileGrid(entry, s.size),
    tileGridRev: TILE_GRID_LEVEL_REV,
    timeLimitMs: s.timeLimitMs,
    size: s.size,
    tiles: s.tiles,
    ...(s.lightsOnDone ? { lightsOnDone: true } : {}),
  };
}

/**
 * Interlock dealt at a level beyond Normal (D1, 21 Nov 2026; settings in src/lib/levels/word/tilegrid.ts): one board of
 * the level's bank (scripts/tilegrid-level-bank.ts: boards the person-like builder finishes inside the clock, Expert's
 * at 200), drawn and its tray shuffled by the deal's seeded randomness, so a room's board is the same for everyone.
 * Never called at Normal, so Normal is exactly today's deal.
 */
export function dealInterlockLevel(level: Exclude<Level, "normal">, _context: GenerateContext): PuzzleData | null {
  const bank = TILEGRID_LEVEL_BANK[level];
  if (!bank.length) return null;
  const entry = bank[Math.floor(Math.random() * bank.length)]!;
  const cells = decodeTileGrid(entry, TILEGRID_LEVEL_SETTINGS[level].size);
  return tileGridLevelPuzzle(level, entry, shuffled(cells.filter(Boolean)));
}
