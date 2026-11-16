/**
 * Retro moments the sims don't count (the Retro overhaul, stage 2, 15 Nov 2026): near-misses and other "just" moments
 * read from a state's positions, shared by each game's renderer (the effect) and its sound observer (the cue), so the
 * spark and the zing always agree. Pure reads of a state: no canvas, no clock, nothing written. A sim never imports
 * this file, and nothing here is scored.
 */
import { HOVER_DISC_R, HOVER_DISC_X, HOVER_PILLAR_W, hoverGapTop, pillarX, type HoverState } from "./hover";
import type { RallyState } from "./rally";
import { BF_H, BF_HIDDEN, BF_W, type BfState } from "./blockfall";
import { snakeCol, snakeColsOf, snakeRockSpan, snakeRow, type SnakeState } from "./snake";
import { BURST_PLAYER_H, BURST_PLAYER_HALF_W, burstFloorY, burstRadius, type BurstState } from "./burst";
import { WAV_BOLT_H, WAV_SHIP_H, WAV_SHIP_W, wavShipY, type WavState } from "./wavefront";

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

/** How close (px) to the paddle's end a return counts as an edge save (the review's "last 4 px"). */
export const RALLY_EDGE_PX = 4;
/**
 * Whether a return just made was an edge save: the ball nearest the paddle within RALLY_EDGE_PX of its end. Shared by
 * the spark here and the sound observer's "rally.edgeSave" (display only).
 */
export function rallyEdgeSave(state: RallyState, width: number): { x: number; side: number } | null {
  const balls = [{ x: state.x, y: state.y }, ...state.golds.map((g) => ({ x: g.x, y: g.y }))];
  let best: { x: number; y: number } | null = null;
  for (const b of balls) if (!best || b.y > best.y) best = b;
  if (!best) return null;
  const off = best.x / 256 - state.paddleX;
  if (Math.abs(off) < width / 2 - RALLY_EDGE_PX) return null;
  return { x: state.paddleX + Math.sign(off) * (width / 2), side: Math.sign(off) };
}


/** Wavefront: how close (px) an enemy bolt may pass the fighter's side and still count as a near-miss. */
export const WAV_NEAR_MISS_PX = 4;
/**
 * Wavefront's near-miss: an enemy bolt level with the fighter, outside the sim's hit band (half the ship + 2 px) but
 * within WAV_NEAR_MISS_PX of it. Returns the bolt's index and the point beside the fighter it passes, or null.
 */
export function wavBoltNearMiss(state: WavState): { index: number; x: number; y: number } | null {
  if (state.ended !== 0) return null;
  const shipY = wavShipY(state);
  const hit = WAV_SHIP_W / 2 + 2;
  for (let i = 0; i < state.reds.length; i++) {
    const r = state.reds[i]!;
    const top = r.y / FP;
    if (top + WAV_BOLT_H < shipY - WAV_SHIP_H / 2 || top > shipY + WAV_SHIP_H / 2) continue;
    const dx = Math.abs(r.x / FP - state.shipX);
    if (dx >= hit && dx < hit + WAV_NEAR_MISS_PX) return { index: i, x: r.x / FP, y: shipY };
  }
  return null;
}

/** Fission: how close (px) an atom may pass over the ship and still count as a near-miss. */
export const BURST_NEAR_MISS_PX = 6;
/**
 * Fission's overhead near-miss: an atom above the ship's box, overlapping it across, its disc within BURST_NEAR_MISS_PX
 * of the box's top but not touching it (the sim's hit). Returns the point over the ship, or null.
 */
export function burstOverhead(state: BurstState): { x: number; y: number } | null {
  if (state.ended !== 0 || state.invuln > 0) return null;
  const floor = burstFloorY(state);
  const top = floor - BURST_PLAYER_H;
  const px = state.x / FP;
  for (const b of state.balls) {
    const r = burstRadius(state, b.size);
    const x = b.x / FP;
    const y = b.y / FP;
    if (y >= top || Math.abs(x - px) > BURST_PLAYER_HALF_W + r * 0.5) continue;
    const gap = top - y - r;
    if (gap > 0 && gap <= BURST_NEAR_MISS_PX) return { x: px, y: top };
  }
  return null;
}

/**
 * Meteor's graze: the head just passing a rock square beside it (side-on to its line of travel, never ahead, which
 * would crash). Returns that rock square, or -1.
 */
export function snakeRockGraze(state: SnakeState): number {
  const head = state.body[0];
  if (head === undefined || state.dead) return -1;
  const cols = snakeColsOf(state);
  const r = snakeRow(head, cols);
  const c = snakeCol(head, cols);
  const side = state.dir === 0 || state.dir === 2 ? [[0, -1], [0, 1]] : [[-1, 0], [1, 0]];
  const rocks = new Set<number>();
  for (const rock of state.rocks ?? []) for (const cell of snakeRockSpan(state, rock)) rocks.add(cell);
  for (const [dr, dc] of side) {
    const cc = c + dc!;
    if (cc < 0 || cc >= cols) continue;
    const cell = (r + dr!) * cols + cc;
    if (rocks.has(cell)) return cell;
  }
  return -1;
}

/** Meteor's wrap (snakeRev 13): the head stepped off one edge and in at the other since the previous state. */
export function snakeWrapped(prev: SnakeState, state: SnakeState): boolean {
  if (!state.wrap) return false;
  const a = prev.body[0];
  const b = state.body[0];
  if (a === undefined || b === undefined || a === b) return false;
  const cols = snakeColsOf(state);
  return Math.abs(snakeCol(a, cols) - snakeCol(b, cols)) > 1 || Math.abs(snakeRow(a, cols) - snakeRow(b, cols)) > 1;
}

/** Blockzone: the top visible rows that count as near the top (the rim's heartbeat). */
export const BF_DANGER_ROWS = 3;
/** Whether a settled square sits in Blockzone's top BF_DANGER_ROWS visible rows, the review's "within 3 rows of the top" (and the run is still on). */
export function bfNearTop(state: BfState): boolean {
  if (state.ended !== 0) return false;
  for (let y = BF_HIDDEN; y < BF_HIDDEN + BF_DANGER_ROWS && y < BF_HIDDEN + BF_H; y++)
    for (let x = 0; x < BF_W; x++) if (state.board[y * BF_W + x]) return true;
  return false;
}

/**
 * Whether the piece that just locked was hard-dropped: a new piece since `prev` while `prev`'s piece stood at least
 * three rows above where it would land. (A soft drop or gravity only lock a piece at its landing row.)
 */
export function bfHardDropped(prev: BfState, state: BfState, prevGhostY: number): boolean {
  return state.pieces > prev.pieces && prevGhostY - prev.piece.y >= 3;
}
