/**
 * Jumbled (`tiles`) board art — presentation only. The tray, bevelled tiles,
 * slide animation and the solve ramp observe the replayed frame; taps still
 * report the tile VALUE through `data-pointer-index`, exactly as before.
 */
import { useLayoutEffect, useRef } from "react";

import { pointerElementIndex } from "@/components/puzzles/GridDrag";
import { useNoTouchScroll } from "@/components/puzzles/noScroll";
import { gameDisplayName } from "@/lib/duel/gameNames";
import { CLASSIC_TILES_LAYOUT, type TilesLayout } from "@/lib/duel/tiles";
import { TILES_SIZE, TILES_SLIDE_MS } from "@/lib/duel/types";
import { soundCue } from "@/lib/fx/patternFx";
import { rightMoveFlash } from "@/lib/fx/gameToolkit";

const TILE_GRADIENT_STOPS = 8;

/** The 1→8 hue ramp (same as the puzzle's own `tileFill`); the extra-cell board spreads it over 1→9. */
export function tilesRampFill(value: number, stops: number = TILE_GRADIENT_STOPS): string {
  const step = (value - 1) % stops;
  const hue = 215 - (step / (stops - 1)) * 175;
  return `hsl(${hue.toFixed(0)} 52% 58%)`;
}

/** Slide length on screen: a touch longer than the rule's 120 ms so the glide reads. */
export const TILES_GLIDE_MS = TILES_SLIDE_MS + 40;

function reducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  );
}

export function TilesFrame({
  frame,
  onTile,
  variant = "stage",
  celebrate = false,
  layout = CLASSIC_TILES_LAYOUT,
  showHome = false,
}: {
  frame: number[];
  /** Live round (batch P): tiles in their solved cell glow, and a tile slid home flashes once. */
  showHome?: boolean;
  /** The board's cells: the classic 3×3 frame, or the extra-cell board (tilesRev 1). */
  layout?: TilesLayout;
  onTile?: ((tile: number) => void) | undefined;
  /** "stage" keeps the original 86 px cells outside the live column; "reveal" fits its box. */
  variant?: "stage" | "reveal";
  /** True for the 1.2 s solve moment: the colour ramp runs 1 → 8. */
  celebrate?: boolean;
}) {
  const board = useRef<HTMLDivElement | null>(null);
  useNoTouchScroll(board);

  // One tile changed cell: glide it from where it was (layout offsets, so a scaled demo still lines up).
  const previous = useRef<number[] | null>(null);
  const key = frame.join(",");
  useLayoutEffect(() => {
    const before = previous.current;
    previous.current = frame;
    const root = board.current;
    if (!before || !root || before.join(",") === key) return;
    const moved = frame.filter((value, index) => value !== 0 && before[index] !== value);
    if (moved.length !== 1) return;
    const value = moved[0]!;
    const tile = root.querySelector<HTMLElement>(`[data-tile-value="${value}"]`);
    const gap = root.querySelector<HTMLElement>("[data-tile-gap]");
    if (!tile || !gap) return;
    soundCue("tiles.slide");
    if (showHome && layout.goal[frame.indexOf(value)] === value) rightMoveFlash(tile);
    if (reducedMotion() || typeof tile.animate !== "function") return;
    // The gap now sits where the tile came from.
    const dx = gap.offsetLeft - tile.offsetLeft;
    const dy = gap.offsetTop - tile.offsetTop;
    tile.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "translate(0, 0)" }], {
      duration: TILES_GLIDE_MS,
      easing: "cubic-bezier(.22,.8,.28,1)",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const shaped = layout.cells.length !== TILES_SIZE * TILES_SIZE;
  const stops = Math.max(TILE_GRADIENT_STOPS, layout.count);
  // tilesRev 1: each cell sits at its own grid slot inside the bounding box; a bed under each
  // cell draws the tray in the board's shape, so the empty corners of the box show nothing.
  const place = (index: number) => {
    if (!shaped) return undefined;
    const cell = layout.cells[index]!;
    return { gridRow: cell.r - layout.top + 1, gridColumn: cell.c - layout.left + 1 };
  };

  return (
    <div
      ref={board}
      className={`tiles-frame puzzle-board grid gap-1.5 rounded-xl border-2 p-1.5${shaped ? " tiles-frame-shaped" : ""}`}
      data-tiles-variant={variant}
      data-tiles-shape={shaped ? `${layout.cols}x${layout.rows}` : undefined}
      data-celebrate={celebrate ? "on" : undefined}
      style={{
        gridTemplateColumns: `repeat(${shaped ? layout.cols : TILES_SIZE}, minmax(0, 1fr))`,
        ...(shaped ? { ["--tiles-aspect" as string]: layout.cols / layout.rows } : {}),
      }}
      aria-label={`${gameDisplayName("tiles")} frame`}
    >
      {shaped &&
        layout.cells.map((_cell, index) => (
          <span key={`bed-${index}`} aria-hidden="true" className="tiles-bed" style={place(index)} />
        ))}
      {frame.map((value, index) =>
        value === 0 ? (
          <span key="gap" data-tile-gap className="tiles-gap rounded-lg bg-background/40" style={place(index)} />
        ) : (
          <button
            key={`tile-${value}`}
            type="button"
            data-pointer-index={value}
            data-tile-value={value}
            data-home={showHome && layout.goal[index] === value ? "" : undefined}
            disabled={!onTile}
            aria-label={`Tile ${value}`}
            onPointerDown={(event) => {
              if (!onTile) return;
              event.preventDefault();
              const hit = pointerElementIndex(event.currentTarget);
              if (hit !== null) onTile(hit);
            }}
            className="tiles-tile flex items-center justify-center rounded-lg font-display font-bold text-white"
            style={{
              ...place(index),
              background: tilesRampFill(value, stops),
              ["--tile-fill" as string]: tilesRampFill(value, stops),
              ["--tile-order" as string]: value - 1,
            }}
          >
            <span className="tiles-numeral">{value}</span>
          </button>
        ),
      )}
    </div>
  );
}
