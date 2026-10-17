import { useState } from "react";

/**
 * The desktop keyboard's cursor over a board (17 Oct 2026, display only; docs/desktop-support.md):
 * a ring round one cell, placed in world units as percentages of the arena box, so it sits on the
 * drawn cell at any size. It takes no pointer events and is drawn only once a key has moved it,
 * so a phone (which never sends keys) never shows it.
 */
export function KeyCursor({ rect, worldW, worldH }: { rect: { x: number; y: number; w: number; h: number } | null; worldW: number; worldH: number }) {
  if (!rect) return null;
  return (
    <div
      aria-hidden="true"
      data-key-cursor=""
      className="pointer-events-none absolute rounded-md"
      style={{
        left: `${(rect.x / worldW) * 100}%`,
        top: `${(rect.y / worldH) * 100}%`,
        width: `${(rect.w / worldW) * 100}%`,
        height: `${(rect.h / worldH) * 100}%`,
        boxShadow: "0 0 0 3px #FFFFFF, 0 0 0 5px rgba(0, 0, 0, 0.7)",
      }}
    />
  );
}

/** A grid cursor moved by the arrows (WASD): null until the first key, then clamped to the grid. */
export function useGridCursor(rows: number, cols: number, start: { row: number; col: number } = { row: 0, col: 0 }) {
  const [cell, setCell] = useState<{ row: number; col: number } | null>(null);
  return {
    cell,
    /** Moves one step (showing the cursor first if hidden); returns the new cell. */
    move(dir: "up" | "down" | "left" | "right"): { row: number; col: number } {
      const from = cell ?? start;
      const next = cell
        ? {
            row: Math.max(0, Math.min(rows - 1, from.row + (dir === "up" ? -1 : dir === "down" ? 1 : 0))),
            col: Math.max(0, Math.min(cols - 1, from.col + (dir === "left" ? -1 : dir === "right" ? 1 : 0))),
          }
        : from;
      setCell(next);
      return next;
    },
    /** The cursor's cell, showing it if hidden. */
    show(): { row: number; col: number } {
      const at = cell ?? start;
      if (!cell) setCell(at);
      return at;
    },
    hide() {
      if (cell) setCell(null);
    },
  };
}
