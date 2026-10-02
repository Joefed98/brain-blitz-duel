import { DIG_BANK } from "./digBank.server";
import { DIG_COLS, DIG_ROWS } from "./dig";
import type { DigPuzzleData } from "./types";

/** Draws one pre-simulated board from the bank (built by scripts/dig-bank.ts). */
export function generateDig(): DigPuzzleData {
  const entry = DIG_BANK[Math.floor(Math.random() * DIG_BANK.length)]!;
  return { type: "dig", cols: DIG_COLS, rows: DIG_ROWS, tiles: entry.tiles, water: entry.water, route: [...entry.route] };
}
