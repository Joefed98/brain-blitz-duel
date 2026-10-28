/**
 * Game tile scenes (27 Oct 2026; a design tool, never imported by the app): each game's tile is a
 * small hand-made scene drawn with the game's own art (its renderer's painters for the arcade
 * games, its own components and CSS for the puzzles), a few pieces arranged to show the idea,
 * exported once as a WebP by `bun scripts/shots/tile-scenes.ts` (public/tiles/<type>.webp).
 *
 * A scene draws a TILE × TILE CSS px square on black (the tile's inside; the category border is the
 * tile's own, drawn by GameIcon over the image's edge). The export renders it at device pixel
 * ratio 2, so the image is 2 × TILE px: sharp on Practice's 104 px shelf tiles and on every
 * smaller tile. Rules: few pieces, bold, nicely composed for a square; no text, no HUD, timers or
 * buttons; the same picture every build (no clock, no Math.random: a hand-made state only).
 */
import type { ReactNode } from "react";

import type { PuzzleType } from "@/lib/duel/types";

/** The scene's size in CSS px (the export is 2× this). */
export const TILE = 104;

export type TileScene =
  /** Painted on a canvas already scaled to CSS px (`k` = device px per CSS px, 2, for renderers that cache sprites). */
  | { kind: "canvas"; paint: (c: CanvasRenderingContext2D, k: number) => void }
  /** Rendered as DOM (the game's own components and CSS) into the TILE × TILE box. */
  | { kind: "dom"; render: () => ReactNode };

export type SceneSet = Partial<Record<PuzzleType, TileScene>>;

export const canvasScene = (paint: (c: CanvasRenderingContext2D, k: number) => void): TileScene => ({ kind: "canvas", paint });
export const domScene = (render: () => ReactNode): TileScene => ({ kind: "dom", render });

/** Runs `paint` translated to (x, y) and scaled by s. */
export function at(c: CanvasRenderingContext2D, x: number, y: number, s: number, paint: () => void): void {
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  paint();
  c.restore();
}

/** Runs a painter with text drawing switched off (tiles that carry a letter or digit in play stay blank). */
export function noText(c: CanvasRenderingContext2D, paint: () => void): void {
  const own = c as unknown as { fillText: unknown; strokeText: unknown };
  own.fillText = () => undefined;
  own.strokeText = () => undefined;
  try {
    paint();
  } finally {
    delete own.fillText;
    delete own.strokeText;
  }
}

/**
 * A DOM scene's piece at its natural size, placed at (x, y) in the tile and scaled by `scale`
 * (transform only, so the game's own layout and CSS are untouched); the tile crops what spills over.
 * `attrs` are put on the wrapper (a game's polish hooks such as data-word-polish, or data-skin-off).
 */
export function Scaled({
  x = 0,
  y = 0,
  scale = 1,
  attrs,
  children,
}: {
  x?: number;
  y?: number;
  scale?: number;
  attrs?: Record<string, string>;
  children: ReactNode;
}) {
  return (
    <div {...attrs} style={{ position: "absolute", left: x, top: y, transform: `scale(${scale})`, transformOrigin: "0 0" }}>
      {children}
    </div>
  );
}
