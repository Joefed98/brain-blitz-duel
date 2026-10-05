import type { CanvasSize } from "./engine";
import {
  matchupDrawSymbol, matchupGame, matchupTransform,
  MATCHUP_BOARD_X, MATCHUP_BOARD_Y, MATCHUP_CELL_PX,
  MATCHUP_SIZE, MATCHUP_SYMBOL_PCT, type MatchupState,
} from "./matchup";

/** Nine frames at 60 Hz, independent of simulation ticks. */
export const MATCHUP_SWAP_MS = 150;

export interface MatchupSwapTween {
  before: MatchupState;
  a: number;
  b: number;
  rejected: boolean;
  startedAt: number;
}

export function matchupSwapProgress(elapsedMs: number, rejected: boolean): number {
  const leg = Math.max(0, Math.min(rejected ? 2 : 1, elapsedMs / MATCHUP_SWAP_MS));
  const p = leg <= 1 ? leg : 2 - leg;
  return p * p * (3 - 2 * p);
}

/** Draw the original pieces moving; never interpolate or mutate sim cells. */
export function drawMatchupSwap(
  ctx: CanvasRenderingContext2D,
  state: MatchupState,
  size: CanvasSize,
  tween: MatchupSwapTween,
  elapsedMs: number,
): void {
  matchupGame.draw(ctx, { ...state, cells: tween.before.cells, heads: tween.before.heads,
    lastScoreTick: state.tick }, size);
  const { scale, offsetX, offsetY } = matchupTransform(size);
  const tokens = getComputedStyle(ctx.canvas).getPropertyValue.bind(getComputedStyle(ctx.canvas));
  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);
  const centre = (index: number) => ({
    x: MATCHUP_BOARD_X + (index % MATCHUP_SIZE + 0.5) * MATCHUP_CELL_PX,
    y: MATCHUP_BOARD_Y + (Math.floor(index / MATCHUP_SIZE) + 0.5) * MATCHUP_CELL_PX,
  });
  for (const index of [tween.a, tween.b]) {
    const row = Math.floor(index / MATCHUP_SIZE);
    const col = index % MATCHUP_SIZE;
    ctx.fillStyle = tokens((row + col) % 2 === 0 ? "--matchup-cell-alt" : "--matchup-cell").trim();
    ctx.fillRect(MATCHUP_BOARD_X + col * MATCHUP_CELL_PX,
      MATCHUP_BOARD_Y + row * MATCHUP_CELL_PX, MATCHUP_CELL_PX, MATCHUP_CELL_PX);
  }
  const a = centre(tween.a);
  const b = centre(tween.b);
  const p = matchupSwapProgress(elapsedMs, tween.rejected);
  const radius = MATCHUP_CELL_PX * MATCHUP_SYMBOL_PCT / 200;
  matchupDrawSymbol(ctx, tween.before.cells[tween.a] ?? 0,
    a.x + (b.x - a.x) * p, a.y + (b.y - a.y) * p, radius);
  matchupDrawSymbol(ctx, tween.before.cells[tween.b] ?? 0,
    b.x + (a.x - b.x) * p, b.y + (a.y - b.y) * p, radius);
  ctx.restore();
}