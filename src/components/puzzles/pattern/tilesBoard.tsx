/**
 * Jumbled (`tiles`) board art — presentation only. The tray, bevelled tiles,
 * slide animation and the solve ramp observe the replayed frame; taps still
 * report the tile VALUE through `data-pointer-index`, exactly as before.
 */
import { useLayoutEffect, useRef } from "react";

import { pointerElementIndex } from "@/components/puzzles/GridDrag";
import { useNoTouchScroll } from "@/components/puzzles/noScroll";
import { gameDisplayName } from "@/lib/duel/gameNames";
import { TILES_SIZE, TILES_SLIDE_MS } from "@/lib/duel/types";
import { soundCue } from "@/lib/fx/patternFx";

const TILE_GRADIENT_STOPS = 8;

/** The 1→8 hue ramp (same as the puzzle's own `tileFill`). */
export function tilesRampFill(value: number): string {
  const step = (value - 1) % TILE_GRADIENT_STOPS;
  const hue = 215 - (step / (TILE_GRADIENT_STOPS - 1)) * 175;
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
}: {
  frame: number[];
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

  return (
    <div
      ref={board}
      className="tiles-frame puzzle-board grid gap-1.5 rounded-xl border-2 p-1.5"
      data-tiles-variant={variant}
      data-celebrate={celebrate ? "on" : undefined}
      style={{ gridTemplateColumns: `repeat(${TILES_SIZE}, minmax(0, 1fr))` }}
      aria-label={`${gameDisplayName("tiles")} frame`}
    >
      {frame.map((value) =>
        value === 0 ? (
          <span key="gap" data-tile-gap className="tiles-gap rounded-lg bg-background/40" />
        ) : (
          <button
            key={`tile-${value}`}
            type="button"
            data-pointer-index={value}
            data-tile-value={value}
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
              background: tilesRampFill(value),
              ["--tile-fill" as string]: tilesRampFill(value),
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
