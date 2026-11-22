/**
 * A picture of the run for a game's own reveal (Logic overhaul 1, 15 Nov 2026; Joe: arcade games show a short visual
 * summary of the run). Used by Minefield's Reveal (src/puzzles/minesweeper.tsx). The run's last frame, drawn by the game's own reveal renderer (revealRenderers.ts
 * `drawFinal`, the server's replay of the stored log), large enough to read: for Minefield, the board as the run left
 * it, mines hit in red, flags on mines ringed gold and wrong flags struck through. Opt-in per game
 * (RUN_SUMMARY_TYPES), so every other arcade reveal is unchanged; the renderers load on demand. Display only.
 *
 * In the reveal template's stage (the polish plan's G5, A2's note; drawn by A3, 21 Nov 2026): the canvas takes the
 * figure's own width (the stage's) at the device's pixel ratio, cropped to the board in its frame (no HUD row, no
 * world margin), so the board draws at the stage's size, sharp, and Expert's wider board is never cut off.
 */
import { useEffect, useRef, useState } from "react";
import type { PuzzleData } from "@/lib/duel/types";
import { canvasRatio } from "@/lib/battery";

export const RUN_SUMMARY_TYPES: ReadonlySet<string> = new Set(["minesweeper"]);

/** The board's crop in world units (the frame included), from the puzzle's own revision. */
async function cropOf(puzzle: PuzzleData): Promise<{ x: number; y: number; w: number; h: number } | null> {
  if (puzzle.type !== "minesweeper") return null;
  const { minesGeoFor, MINES_FRAME } = await import("@/lib/arcade/minesweeper");
  const g = minesGeoFor(puzzle.minesRev);
  return { x: g.boardX - MINES_FRAME, y: g.boardY - MINES_FRAME, w: g.boardW + 2 * MINES_FRAME, h: g.boardH + 2 * MINES_FRAME };
}

export function ArcadeRunSummary({ puzzle, answer }: { puzzle: PuzzleData; answer: string | null }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const figure = useRef<HTMLElement>(null);
  const [drawn, setDrawn] = useState(false);
  const [width, setWidth] = useState(0);
  const on = RUN_SUMMARY_TYPES.has(puzzle.type) && answer !== null;
  // The figure's width (the stage's), measured once per layout and on resize (never on a frame).
  useEffect(() => {
    const el = figure.current;
    if (!on || !el) return;
    const measure = () => setWidth((w) => (Math.round(el.getBoundingClientRect().width) || w));
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [on]);
  useEffect(() => {
    if (!on || width <= 0) return;
    let live = true;
    void Promise.all([import("@/lib/arcade/revealRenderers"), cropOf(puzzle)]).then(([{ ARCADE_REVEAL_RENDERERS }, crop]) => {
      const renderer = ARCADE_REVEAL_RENDERERS[puzzle.type];
      const el = canvas.current;
      if (!live || !renderer || !el || !crop) return;
      const ratio = canvasRatio();
      const k = width / crop.w;
      el.width = Math.round(width * ratio);
      el.height = Math.round(crop.h * k * ratio);
      el.style.aspectRatio = `${crop.w} / ${crop.h}`;
      const ctx = el.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(ratio * k, 0, 0, ratio * k, -crop.x * ratio * k, -crop.y * ratio * k);
      renderer.drawFinal(ctx, puzzle, answer ?? "", "reveal");
      setDrawn(true);
    });
    return () => {
      live = false;
    };
  }, [on, puzzle, answer, width]);
  if (!on) return null;
  return (
    <figure ref={figure} data-run-summary={puzzle.type} className="arcade-run-summary" style={{ opacity: drawn ? 1 : 0 }}>
      <canvas ref={canvas} role="img" aria-label="Your board at the end of the run" />
    </figure>
  );
}
