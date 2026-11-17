/**
 * The Strategy overhaul's in-game effects (stage 2, 15 Nov 2026; Joe: "all of these go through the #422 kit"): the five
 * Strategy games draw on canvas, so each effect is drawn by the game's own renderer (the kit's rule for canvas games,
 * docs/design/game-fx/README.md) but plays in the kit's variant for its kind: `full`, `lite` (reduced effects or the
 * battery saver: smaller and shorter) or `reduced` (prefers-reduced-motion: the state change shown still, no movement).
 * The sounds are each game's own slots, played by its sound observer (lib/fx/gameSounds.ts), as the kit asks of a
 * game with its own recording.
 *
 * Display only: nothing here reads a clock or writes a sim. Memory is per canvas (a replay, a reveal and the live
 * stage each keep their own), keyed by the drawn tick.
 */
import { gameFxVariant, type GameFxKind } from "@/lib/fx/kit";
import { BUB_COLS, BUB_R, bubCellY, bubDangerLine, type BubState } from "./bubble";

export type StrategyFxVariant = "full" | "lite" | "reduced";

/** The kit's variant for an effect of this kind ("calm" draws as "lite"). */
export function strategyFx(kind: GameFxKind): StrategyFxVariant {
  if (typeof window === "undefined") return "full";
  const v = gameFxVariant(kind);
  return v === "reduced" ? "reduced" : v === "full" ? "full" : "lite";
}

/** How strongly a movement plays in a variant: 1 in full, a half in lite, none when reduced. */
export function fxAmount(v: StrategyFxVariant): number {
  return v === "full" ? 1 : v === "lite" ? 0.5 : 0;
}

const memories = new WeakMap<object, Map<string, unknown>>();

/** One effect's memory for this canvas (a fresh one each new run: `reset` true when the tick went backwards). */
export function fxMemory<T extends { tick: number }>(ctx: CanvasRenderingContext2D, key: string, tick: number, init: () => T): T {
  const owner = (ctx.canvas as object | undefined) ?? (ctx as object);
  let map = memories.get(owner);
  if (!map) memories.set(owner, (map = new Map()));
  let m = map.get(key) as T | undefined;
  if (!m || tick < m.tick) {
    m = init();
    map.set(key, m);
  }
  return m;
}

/** Coral Pop: the reef's lowest row within two rows of the warning line (the line flashes; the warning sounds). */
export function bubbleNearLine(state: BubState): boolean {
  let lowest = -1;
  for (let i = state.grid.length - 1; i >= 0; i--) if (state.grid[i]) { lowest = Math.floor(i / BUB_COLS); break; }
  return lowest >= 0 && bubDangerLine(state) - bubCellY(lowest, state.descents) < BUB_R * 4.4;
}
