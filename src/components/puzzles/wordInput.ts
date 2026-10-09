import type { GridGeometry } from "./GridDrag";

/** Coordinate recordings made before these control-layout changes cannot replay. */
export const REVISED_PUZZLE_DEMOS = new Set(["wordsmith", "wordhunt", "target", "lightsout", "maze", "rings", "flood", "balance"]);
export const BALANCE_PRESENTATION = "oct9-beam-notches";
export const PUZZLE_INPUT_PRESENTATION = "oct6-ring-controls";
export function puzzleInputDemoCompatible(type: string, log: unknown): boolean {
  if (!REVISED_PUZZLE_DEMOS.has(type)) return true;
  if (typeof log !== "object" || log === null || !("presentation" in log)) return false;
  return log.presentation === (type === "wordsmith" ? WORDSMITH_PRESENTATION : type === "balance" ? BALANCE_PRESENTATION : PUZZLE_INPUT_PRESENTATION);
}
export const WORDSMITH_PRESENTATION = "oct8-atom-orbit";

/** A tile can be used once; re-tapping removes only that occurrence. */
export function toggleWordsmithTile(selected: readonly number[], index: number): number[] {
  return selected.includes(index) ? selected.filter((tile) => tile !== index) : [...selected, index];
}

/** Strict inner-60% hit box, with no nearest-cell or gap snapping. */
export function wordHuntInnerCell(g: GridGeometry | null, cols: number, rows: number): number | null {
  if (!g || g.cellW <= 0 || g.cellH <= 0) return null;
  const col = Math.floor(g.x / (g.cellW + g.gapX));
  const row = Math.floor(g.y / (g.cellH + g.gapY));
  if (col < 0 || col >= cols || row < 0 || row >= rows) return null;
  const x = g.x - col * (g.cellW + g.gapX);
  const y = g.y - row * (g.cellH + g.gapY);
  return x >= g.cellW * 0.2 && x <= g.cellW * 0.8 && y >= g.cellH * 0.2 && y <= g.cellH * 0.8
    ? row * cols + col : null;
}

export function extendWordHuntPath(path: readonly number[], cell: number, cols: number): number[] {
  const last = path.at(-1);
  if (last === undefined) return [cell];
  if (last === cell) return [...path];
  if (path.length > 1 && path.at(-2) === cell) return path.slice(0, -1);
  const dr = Math.abs(Math.floor(last / cols) - Math.floor(cell / cols));
  const dc = Math.abs(last % cols - cell % cols);
  if (path.includes(cell) || dr > 1 || dc > 1) return [...path];
  return [...path, cell];
}