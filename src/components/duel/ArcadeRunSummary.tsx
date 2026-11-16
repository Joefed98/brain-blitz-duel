/**
 * A picture of the run for a game's own reveal (Logic overhaul 1, 15 Nov 2026; Joe: arcade games show a short visual
 * summary of the run). Used by Minefield's Reveal (src/puzzles/minesweeper.tsx). The run's last frame, drawn by the game's own reveal renderer (revealRenderers.ts
 * `drawFinal`, the server's replay of the stored log), large enough to read: for Minefield, the board as the run left
 * it, mines hit in red, flags on mines ringed gold and wrong flags struck through. Opt-in per game
 * (RUN_SUMMARY_TYPES), so every other arcade reveal is unchanged; the renderers load on demand. Display only.
 */
import { useEffect, useRef, useState } from "react";
import type { PuzzleData } from "@/lib/duel/types";

export const RUN_SUMMARY_TYPES: ReadonlySet<string> = new Set(["minesweeper"]);

export function ArcadeRunSummary({ puzzle, answer }: { puzzle: PuzzleData; answer: string | null }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [drawn, setDrawn] = useState(false);
  const on = RUN_SUMMARY_TYPES.has(puzzle.type) && answer !== null;
  useEffect(() => {
    if (!on) return;
    let live = true;
    void import("@/lib/arcade/revealRenderers").then(({ ARCADE_REVEAL_RENDERERS, revealWorldH }) => {
      const renderer = ARCADE_REVEAL_RENDERERS[puzzle.type];
      const el = canvas.current;
      if (!live || !renderer || !el) return;
      const w = renderer.worldW;
      const h = revealWorldH(renderer, puzzle);
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      el.width = Math.round(w * ratio);
      el.height = Math.round(h * ratio);
      el.style.aspectRatio = `${w} / ${h}`;
      const ctx = el.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      renderer.drawFinal(ctx, puzzle, answer ?? "", "reveal");
      setDrawn(true);
    });
    return () => {
      live = false;
    };
  }, [on, puzzle, answer]);
  if (!on) return null;
  return (
    <figure data-run-summary={puzzle.type} className="arcade-run-summary" style={{ opacity: drawn ? 1 : 0 }}>
      <canvas ref={canvas} role="img" aria-label="Your board at the end of the run" />
    </figure>
  );
}
