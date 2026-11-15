/**
 * Retro moments the sims don't count (the Retro overhaul, stage 2, 15 Nov 2026): near-misses and other "just" moments
 * read from a state's positions, shared by each game's renderer (the effect) and its sound observer (the cue), so the
 * spark and the zing always agree. Pure reads of a state: no canvas, no clock, nothing written. A sim never imports
 * this file, and nothing here is scored.
 */
import { HOVER_DISC_R, HOVER_DISC_X, HOVER_PILLAR_W, hoverGapTop, pillarX, type HoverState } from "./hover";

const FP = 256;

/** Hover: how close (px) the saucer's edge may pass a barrier and still count as a scrape. */
export const HOVER_SCRAPE_PX = 3;

/**
 * Hover's scrape: the saucer inside a barrier's columns with its edge within HOVER_SCRAPE_PX of the gap's top or bottom
 * (and not crashed). Returns the barrier's index and the point on the gap's edge nearest the saucer, or null.
 */
export function hoverScrape(state: HoverState): { index: number; x: number; y: number } | null {
  if (state.crashed) return null;
  const left = HOVER_DISC_X - HOVER_DISC_R;
  const right = HOVER_DISC_X + HOVER_DISC_R;
  for (let i = Math.max(0, state.gates - 1); i < Math.min(state.pillars.length, state.gates + 2); i++) {
    const p = state.pillars[i]!;
    const x0 = pillarX(p, state.distance);
    const x1 = x0 + HOVER_PILLAR_W;
    if (x1 <= left || x0 >= right) continue;
    const gaps: [number, number][] = [[hoverGapTop(p, state.tick), p.gapH]];
    if (p.gap2Top !== undefined) gaps.push([p.gap2Top, p.gap2H ?? 0]);
    if (p.tightTop !== undefined) gaps.push([p.tightTop, p.tightH ?? 0]);
    for (const [top, h] of gaps) {
      const above = state.y - HOVER_DISC_R - top;
      const below = top + h - (state.y + HOVER_DISC_R);
      if (above < 0 || below < 0) continue;
      const near = Math.min(above, below);
      if (near < HOVER_SCRAPE_PX * FP) {
        const edge = above <= below ? top : top + h;
        return { index: i, x: HOVER_DISC_X / FP, y: edge / FP };
      }
    }
  }
  return null;
}
