/**
 * Scripted play for scripts/shots/number-polish-shots.ts: each game's driver makes a few
 * moves (partial) and then finishes the fixed intro example (solve) through the real UI.
 * Drivers find things by role, label or text so they work on the code before and after polish.
 */
import type { Page } from "playwright";
import { driver as target } from "./drivers/target";
import { driver as equation } from "./drivers/equation";
import { driver as balance } from "./drivers/balance";
import { driver as numpyramid } from "./drivers/numpyramid";
import { driver as trail } from "./drivers/trail";
import { driver as measure } from "./drivers/measure";
import { driver as checkout } from "./drivers/checkout";
import { driver as numline } from "./drivers/numline";
import { driver as tendrop } from "./drivers/tendrop";

export interface DriverCtx {
  page: Page;
  /** The full example puzzle, solutions included (built in the script, never sent by the app). */
  puzzle: Record<string, any>;
  wait: (ms: number) => Promise<void>;
}

export interface Driver {
  partial?: (ctx: DriverCtx) => Promise<void>;
  /** Finishes the puzzle from wherever partial left it. */
  solve: (ctx: DriverCtx) => Promise<void>;
  /** Delay from the solving move to the completion shot (default 350 ms). */
  completeShotMs?: number;
}

export const DRIVERS: Record<string, Driver | null> = { target, equation, balance, numpyramid, trail, measure, checkout, numline, tendrop };
