import { DIG_BANK } from "./digBank.server";
import { DIG_COLS, DIG_ROWS } from "./dig";
import type { DigPuzzleData } from "./types";

/** Draws one pre-simulated board uniformly from the bank (built by scripts/dig-bank.ts). */
export function generateDig(): DigPuzzleData {
  const e = DIG_BANK[Math.floor(Math.random() * DIG_BANK.length)]!;
  return {
    type: "dig",
    cols: DIG_COLS,
    rows: DIG_ROWS,
    tiles: e.tiles,
    water: e.water,
    budget: e.budget,
    minDigs: e.minDigs,
    targets: [...e.targets],
    pool: e.pool,
    hazards: [...e.hazards],
    tier: e.tier,
    route: [...e.route],
    intended: e.intended,
  };
}
