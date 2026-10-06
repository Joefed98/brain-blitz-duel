/**
 * Matchup art pass and swap tween. Render only: reads MatchupState and never
 * mutates it. Gems sit on the sim's cell centres at the sim's symbol radius;
 * each colour keeps its own cut so shapes stay distinguishable.
 */
import type { CanvasSize } from "./engine";
import {
  matchupFindSwap, matchupGame, matchupIndex, matchupShowHint, matchupTransform,
  MATCHUP_BOARD_H, MATCHUP_BOARD_W, MATCHUP_BOARD_X, MATCHUP_BOARD_Y, MATCHUP_BOMB, MATCHUP_CELL_PX,
  MATCHUP_CLEAR_MS, MATCHUP_COLOURS, MATCHUP_CROSS, MATCHUP_DETONATE_MS, MATCHUP_DROP_MS, MATCHUP_GOLD,
  MATCHUP_NEXT_H, MATCHUP_NEXT_Y, MATCHUP_QUEUE_LEN, MATCHUP_ROWS, MATCHUP_SHAPES, MATCHUP_SIZE, MATCHUP_STAR,
  MATCHUP_SYMBOL_PCT, MATCHUP_TEXT, type MatchupAnimStep, type MatchupState,
} from "./matchup";
import { artHash, reducedMotion } from "./art.renderer";

/** Nine frames at 60 Hz, independent of simulation ticks. */
export const MATCHUP_SWAP_MS = 150;
const RADIUS = (MATCHUP_CELL_PX * MATCHUP_SYMBOL_PCT) / 200;
const SPECIAL_WHITE = "#FFFFFF";
const BOMB_OUTLINE = "#D5D7DF";

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

/** Start offsets (ms after the swap tween) of each cascade step's clear. */
export function matchupStepOffsets(steps: readonly MatchupAnimStep[]): number[] {
  const out: number[] = [];
  let at = 0;
  for (const step of steps) {
    out.push(at);
    at += MATCHUP_CLEAR_MS + Math.max(1, step.ticks) * MATCHUP_DROP_MS;
  }
  return out;
}

/** Sound for each cascade step: the special that went off, else the match chime. */
export function matchupStepSound(step: MatchupAnimStep): string {
  const kinds = new Set<number>();
  for (const index of step.detonated) {
    const kind = step.before[index] ?? -1;
    if (kind === MATCHUP_BOMB || kind === MATCHUP_CROSS || kind === MATCHUP_STAR) kinds.add(kind);
  }
  if (kinds.has(MATCHUP_BOMB)) return "arc_gem_bomb";
  if (kinds.has(MATCHUP_STAR)) return "arc_gem_star";
  if (kinds.has(MATCHUP_CROSS)) return "arc_gem_zap";
  return "arc_gem_match";
}

/* ================================ Gems ================================ */

function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(amount < 0 ? c * (1 + amount) : c + (255 - c) * amount)));
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

/** Outline points for each cut, matching the sim's symbol silhouettes. */
function cutPoints(shape: string, cx: number, cy: number, r: number): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  const ring = (n: number, rot: number, rr: (k: number) => number) => {
    for (let k = 0; k < n; k++) {
      const a = rot + (k / n) * Math.PI * 2;
      pts.push([cx + Math.cos(a) * rr(k), cy + Math.sin(a) * rr(k)]);
    }
  };
  if (shape === "circle") ring(10, -Math.PI / 2, () => r);
  else if (shape === "square") {
    const s = r * 0.88;
    const c = s * 0.32;
    pts.push([cx - s + c, cy - s], [cx + s - c, cy - s], [cx + s, cy - s + c], [cx + s, cy + s - c],
      [cx + s - c, cy + s], [cx - s + c, cy + s], [cx - s, cy + s - c], [cx - s, cy - s + c]);
  } else if (shape === "triangle") pts.push([cx, cy - r], [cx + r, cy + r * 0.8], [cx - r, cy + r * 0.8]);
  else if (shape === "diamond") pts.push([cx, cy - r], [cx + r, cy], [cx, cy + r], [cx - r, cy]);
  else if (shape === "star") ring(10, -Math.PI / 2, (k) => (k % 2 === 0 ? r : r * 0.45));
  else ring(6, -Math.PI / 2, () => r);
  return pts;
}

function pathOf(ctx: CanvasRenderingContext2D, pts: Array<[number, number]>): void {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.closePath();
}

function facetedGem(ctx: CanvasRenderingContext2D, pts: Array<[number, number]>, cx: number, cy: number, r: number, colour: string): void {
  const body = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
  body.addColorStop(0, colour);
  body.addColorStop(0.5, colour);
  body.addColorStop(1, shade(colour, -0.2));
  ctx.save();
  pathOf(ctx, pts);
  ctx.clip();
  ctx.fillStyle = body;
  ctx.fill();
  // Table facet and spokes.
  const inner = pts.map(([x, y]) => [cx + (x - cx) * 0.52, cy + (y - cy) * 0.52 - r * 0.06] as [number, number]);
  ctx.strokeStyle = shade(colour, -0.25);
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  pts.forEach(([x, y], i) => {
    ctx.moveTo(x, y);
    const point = inner[i];
    if (point) ctx.lineTo(point[0], point[1]);
  });
  ctx.stroke();
  pathOf(ctx, inner);
  ctx.fillStyle = colour;
  ctx.fill();
  // Darker base edge and a crisp rim.
  pathOf(ctx, pts);
  ctx.strokeStyle = shade(colour, -0.6);
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.restore();
}

/** Flat table and bevel planes: fixed per cut, with three own-colour shades. */
function flatGem(ctx: CanvasRenderingContext2D, shape: string, cx: number, cy: number, r: number, colour: string): void {
  const pts = cutPoints(shape, cx, cy, r);
  const inner = pts.map(([x, y]) => [cx + (x - cx) * 0.5, cy + (y - cy) * 0.5 - r * 0.12] as [number, number]);
  const light = shade(colour, 0.28);
  const dark = shade(colour, -0.3);
  ctx.save();
  pathOf(ctx, pts);
  ctx.clip();
  for (let k = 0; k < pts.length; k++) {
    const a = pts[k]; const b = pts[(k + 1) % pts.length];
    const ia = inner[k]; const ib = inner[(k + 1) % inner.length];
    if (!a || !b || !ia || !ib) continue;
    const height = ((a[1] + b[1]) / 2 - cy) / r;
    ctx.fillStyle = height < -0.3 ? light : height > 0.3 ? dark : colour;
    pathOf(ctx, [a, b, ib, ia]);
    ctx.fill();
  }
  pathOf(ctx, inner);
  ctx.fillStyle = light;
  ctx.fill();
  ctx.strokeStyle = light;
  ctx.lineWidth = 0.65;
  ctx.beginPath();
  for (let k = 0; k < pts.length; k++) {
    const a = pts[k]; const b = inner[k];
    if (!a || !b) continue;
    ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
  }
  ctx.stroke();
  pathOf(ctx, inner); ctx.stroke();
  pathOf(ctx, pts); ctx.lineWidth = 1; ctx.stroke();
  ctx.restore();
}

/** One gem centred on (cx, cy) at the sim's symbol radius. */
export function drawMatchupGem(ctx: CanvasRenderingContext2D, kind: number, cx: number, cy: number, radius: number, time = 0): void {
  ctx.save();
  // Includes special fuse details: never exceed the symbol's bounds.
  ctx.beginPath();
  ctx.rect(cx - radius, cy - radius, radius * 2, radius * 2);
  ctx.clip();
  if (kind === MATCHUP_BOMB) {
    const pts = cutPoints("hexagon", cx, cy + radius * 0.06, radius * 0.86);
    facetedGem(ctx, pts, cx, cy + radius * 0.06, radius * 0.86, "#2A2A33");
    pathOf(ctx, pts);
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = BOMB_OUTLINE;
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.restore();
    const pulse = 0.65 + 0.35 * Math.sin(time * 8);
    const spark = ctx.createRadialGradient(cx + radius * 0.55, cy - radius * 0.72, 0, cx + radius * 0.55, cy - radius * 0.72, radius * 0.5);
    spark.addColorStop(0, `rgba(255,220,120,${pulse})`);
    spark.addColorStop(0.4, `rgba(255,120,40,${0.7 * pulse})`);
    spark.addColorStop(1, "rgba(255,80,20,0)");
    ctx.strokeStyle = "#B88A4A";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx + radius * 0.2, cy - radius * 0.6);
    ctx.quadraticCurveTo(cx + radius * 0.3, cy - radius * 0.95, cx + radius * 0.55, cy - radius * 0.72);
    ctx.stroke();
    ctx.fillStyle = spark;
    ctx.beginPath();
    ctx.arc(cx + radius * 0.55, cy - radius * 0.72, radius * 0.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === MATCHUP_CROSS) {
    const pts = cutPoints("square", cx, cy, radius);
    facetedGem(ctx, pts, cx, cy, radius, SPECIAL_WHITE);
    ctx.fillStyle = shade(MATCHUP_GOLD, -0.55);
    const w = radius * 0.22;
    ctx.fillRect(cx - radius * 0.85, cy - w / 2, radius * 1.7, w);
    ctx.fillRect(cx - w / 2, cy - radius * 0.85, w, radius * 1.7);
  } else if (kind === MATCHUP_STAR) {
    const pts = cutPoints("star", cx, cy, radius);
    facetedGem(ctx, pts, cx, cy, radius, SPECIAL_WHITE);
    pathOf(ctx, pts);
    ctx.clip();
    ctx.strokeStyle = MATCHUP_GOLD;
    ctx.lineWidth = 1.6;
    ctx.stroke();
  } else {
    const shape = MATCHUP_SHAPES[kind] ?? "circle";
    const colour = MATCHUP_COLOURS[kind] ?? MATCHUP_GOLD;
    flatGem(ctx, shape, cx, cy, radius, colour);
  }
  ctx.restore();
}

/* ================================ Board =============================== */

const centre = (index: number) => ({
  x: MATCHUP_BOARD_X + ((index % MATCHUP_SIZE) + 0.5) * MATCHUP_CELL_PX,
  y: MATCHUP_BOARD_Y + (Math.floor(index / MATCHUP_SIZE) + 0.5) * MATCHUP_CELL_PX,
});

function cellFill(row: number, col: number): string {
  return (row + col) % 2 === 0 ? "#15151C" : "#101017";
}

function drawFrame(ctx: CanvasRenderingContext2D): void {
  const x = MATCHUP_BOARD_X - 5;
  const y = MATCHUP_BOARD_Y - 5;
  const w = MATCHUP_BOARD_W + 10;
  const h = MATCHUP_BOARD_H + 10;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10);
  const bevel = ctx.createLinearGradient(0, y, 0, y + h);
  bevel.addColorStop(0, "#3A3A48");
  bevel.addColorStop(1, "#141419");
  ctx.fillStyle = bevel;
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawGrid(ctx: CanvasRenderingContext2D): void {
  for (let row = 0; row < MATCHUP_ROWS; row++) {
    for (let col = 0; col < MATCHUP_SIZE; col++) {
      ctx.fillStyle = cellFill(row, col);
      ctx.fillRect(MATCHUP_BOARD_X + col * MATCHUP_CELL_PX, MATCHUP_BOARD_Y + row * MATCHUP_CELL_PX, MATCHUP_CELL_PX, MATCHUP_CELL_PX);
    }
  }
  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  ctx.lineWidth = 2;
  ctx.strokeRect(MATCHUP_BOARD_X + 1, MATCHUP_BOARD_Y + 1, MATCHUP_BOARD_W - 2, MATCHUP_BOARD_H - 2);
}

function drawNextStrip(ctx: CanvasRenderingContext2D, state: MatchupState, time: number): void {
  ctx.beginPath();
  ctx.roundRect(MATCHUP_BOARD_X, MATCHUP_NEXT_Y, MATCHUP_BOARD_W, MATCHUP_NEXT_H, 12);
  ctx.fillStyle = "rgba(247, 247, 248, 0.08)";
  ctx.fill();
  ctx.strokeStyle = "rgba(247, 247, 248, 0.14)";
  ctx.lineWidth = 1;
  ctx.stroke();
  for (let col = 0; col < MATCHUP_SIZE; col++) {
    const queue = state.queues[col] ?? [];
    const head = state.heads[col] ?? 0;
    drawMatchupGem(ctx, queue[head % MATCHUP_QUEUE_LEN] ?? 0,
      MATCHUP_BOARD_X + col * MATCHUP_CELL_PX + MATCHUP_CELL_PX / 2, MATCHUP_NEXT_Y + MATCHUP_NEXT_H / 2, 9, time);
  }
}

function drawSettled(ctx: CanvasRenderingContext2D, cells: readonly number[], time: number, skip?: ReadonlySet<number>): void {
  drawGrid(ctx);
  for (let index = 0; index < cells.length; index++) {
    if (skip?.has(index)) continue;
    const { x, y } = centre(index);
    drawMatchupGem(ctx, cells[index] ?? 0, x, y, RADIUS, time);
  }
}

function animatedKind(step: MatchupAnimStep, index: number): number {
  return step.created.find((item) => item.index === index)?.kind ?? step.before[index] ?? 0;
}

function shatter(ctx: CanvasRenderingContext2D, kind: number, index: number, p: number, still: boolean): void {
  const { x, y } = centre(index);
  if (still) {
    ctx.globalAlpha = 1 - p;
    drawMatchupGem(ctx, kind, x, y, RADIUS);
    ctx.globalAlpha = 1;
    return;
  }
  const colour = kind < MATCHUP_COLOURS.length ? (MATCHUP_COLOURS[kind] ?? MATCHUP_GOLD) : MATCHUP_GOLD;
  ctx.globalAlpha = Math.max(0, 1 - p * 2.2);
  drawMatchupGem(ctx, kind, x, y, RADIUS);
  ctx.globalAlpha = 1;
  const ease = 1 - (1 - p) * (1 - p);
  for (let k = 0; k < 7; k++) {
    const h = artHash(index * 31 + k, 5);
    const a = (k / 7) * Math.PI * 2 + (h % 100) / 60;
    const d = ease * (14 + (h >>> 8) % 12);
    const s = 2.5 + ((h >>> 4) % 3);
    ctx.globalAlpha = 1 - p;
    ctx.fillStyle = colour;
    ctx.save();
    ctx.translate(x + Math.cos(a) * d, y + Math.sin(a) * d + ease * ease * 6);
    ctx.rotate(a + p * 4);
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.lineTo(s * 0.7, 0);
    ctx.lineTo(0, s);
    ctx.lineTo(-s * 0.7, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

function drawDetonations(ctx: CanvasRenderingContext2D, step: MatchupAnimStep, progress: number): void {
  for (const index of step.detonated) {
    const kind = step.before[index] ?? -1;
    const { x, y } = centre(index);
    ctx.save();
    ctx.globalAlpha = 1 - progress * 0.7;
    ctx.strokeStyle = MATCHUP_GOLD;
    ctx.lineWidth = 2;
    if (kind === MATCHUP_STAR) {
      const spread = MATCHUP_CELL_PX * (0.5 + progress * MATCHUP_SIZE);
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(x - spread, y - spread);
      ctx.lineTo(x + spread, y + spread);
      ctx.moveTo(x + spread, y - spread);
      ctx.lineTo(x - spread, y + spread);
      ctx.stroke();
      ctx.fillStyle = "rgba(247, 247, 248, 0.5)";
      ctx.beginPath();
      ctx.arc(x, y, 6 + progress * MATCHUP_CELL_PX, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === MATCHUP_CROSS) {
      const spread = MATCHUP_CELL_PX * (0.5 + progress * MATCHUP_SIZE);
      ctx.fillStyle = "rgba(245, 184, 46, 0.18)";
      ctx.fillRect(MATCHUP_BOARD_X, y - 3, MATCHUP_BOARD_W, 6);
      ctx.fillRect(x - 3, MATCHUP_BOARD_Y, 6, MATCHUP_BOARD_H);
      ctx.beginPath();
      ctx.moveTo(x - spread, y);
      ctx.lineTo(x + spread, y);
      ctx.moveTo(x, y - spread);
      ctx.lineTo(x, y + spread);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(x, y, 8 + progress * MATCHUP_CELL_PX * 1.8, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawAnimated(ctx: CanvasRenderingContext2D, state: MatchupState, elapsedMs: number, time: number): void {
  const still = reducedMotion();
  let remaining = elapsedMs;
  for (const step of state.lastAnimation) {
    const dropMs = Math.max(1, step.ticks) * MATCHUP_DROP_MS;
    if (remaining >= MATCHUP_CLEAR_MS + dropMs) {
      remaining -= MATCHUP_CLEAR_MS + dropMs;
      continue;
    }
    const cleared = new Set(step.cleared);
    if (remaining < MATCHUP_CLEAR_MS) {
      const p = remaining / MATCHUP_CLEAR_MS;
      drawGrid(ctx);
      for (let index = 0; index < MATCHUP_ROWS * MATCHUP_SIZE; index++) {
        if (cleared.has(index)) continue;
        const { x, y } = centre(index);
        drawMatchupGem(ctx, animatedKind(step, index), x, y, RADIUS, time);
      }
      for (const index of cleared) shatter(ctx, animatedKind(step, index), index, p, still);
      drawDetonations(ctx, step, Math.min(1, remaining / MATCHUP_DETONATE_MS));
      return;
    }
    const p = Math.min(1, (remaining - MATCHUP_CLEAR_MS) / dropMs);
    drawGrid(ctx);
    for (let row = 0; row < MATCHUP_ROWS; row++) {
      for (let col = 0; col < MATCHUP_SIZE; col++) {
        const index = matchupIndex(row, col);
        if (cleared.has(index)) continue;
        if (step.moves.some((move) => move.fromRow === row && move.fromCol === col)) continue;
        const { x, y } = centre(index);
        drawMatchupGem(ctx, animatedKind(step, index), x, y, RADIUS, time);
      }
    }
    ctx.save();
    ctx.beginPath();
    ctx.rect(MATCHUP_BOARD_X, MATCHUP_BOARD_Y, MATCHUP_BOARD_W, MATCHUP_BOARD_H);
    ctx.clip();
    for (const move of step.moves) {
      const from = centre(matchupIndex(move.fromRow, move.fromCol));
      const to = centre(matchupIndex(move.toRow, move.toCol));
      drawMatchupGem(ctx, move.kind, from.x + (to.x - from.x) * p, from.y + (to.y - from.y) * p, RADIUS, time);
    }
    ctx.restore();
    return;
  }
  drawSettled(ctx, state.cells, time);
}

interface SceneOptions {
  animationMs?: number | null;
  cells?: readonly number[];
  skip?: ReadonlySet<number>;
}

function drawScene(ctx: CanvasRenderingContext2D, state: MatchupState, size: CanvasSize, options: SceneOptions = {}): void {
  const time = reducedMotion() ? 0 : state.tick / 60;
  const { scale, offsetX, offsetY } = matchupTransform(size);
  ctx.save();
  ctx.clearRect(0, 0, size.width, size.height);
  ctx.fillStyle = "rgba(11,11,15,0.6)";
  ctx.fillRect(0, 0, size.width, size.height);
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);
  drawNextStrip(ctx, state, time);
  drawFrame(ctx);
  const animationMs = options.animationMs;
  const animating = animationMs != null && state.lastAnimation.length > 0;
  if (animating && animationMs != null) drawAnimated(ctx, state, animationMs, time);
  else drawSettled(ctx, options.cells ?? state.cells, time, options.skip);

  if (!animating && !options.cells && matchupShowHint(state)) {
    const hint = matchupFindSwap(state.cells);
    if (hint) {
      ctx.strokeStyle = MATCHUP_GOLD;
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 2;
      for (const cell of [{ row: hint.row1, col: hint.col1 }, { row: hint.row2, col: hint.col2 }]) {
        ctx.strokeRect(MATCHUP_BOARD_X + cell.col * MATCHUP_CELL_PX + 3, MATCHUP_BOARD_Y + cell.row * MATCHUP_CELL_PX + 3,
          MATCHUP_CELL_PX - 6, MATCHUP_CELL_PX - 6);
      }
      ctx.globalAlpha = 1;
    }
  }
  ctx.font = "600 15px 'JetBrains Mono', ui-monospace, monospace";
  ctx.fillStyle = MATCHUP_TEXT;
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.fillText(`${state.raw} pts`, 12, 12);
  ctx.restore();
}

export function drawMatchupArt(ctx: CanvasRenderingContext2D, state: MatchupState, size: CanvasSize): void {
  drawScene(ctx, state, size);
}

export function drawMatchupArtAnimated(ctx: CanvasRenderingContext2D, state: MatchupState, size: CanvasSize, elapsedMs: number): void {
  drawScene(ctx, state, size, { animationMs: elapsedMs });
}

/** Selected gem glows gold. */
export function drawMatchupArtSelection(ctx: CanvasRenderingContext2D, size: CanvasSize, row: number, col: number): void {
  const { scale, offsetX, offsetY } = matchupTransform(size);
  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);
  ctx.shadowColor = "rgba(245,184,46,0.9)";
  ctx.shadowBlur = 12;
  ctx.strokeStyle = MATCHUP_GOLD;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(MATCHUP_BOARD_X + col * MATCHUP_CELL_PX + 2, MATCHUP_BOARD_Y + row * MATCHUP_CELL_PX + 2,
    MATCHUP_CELL_PX - 4, MATCHUP_CELL_PX - 4, 8);
  ctx.stroke();
  ctx.restore();
}

/** Draw the original gems moving; never interpolate or mutate sim cells. */
export function drawMatchupSwap(
  ctx: CanvasRenderingContext2D,
  state: MatchupState,
  size: CanvasSize,
  tween: MatchupSwapTween,
  elapsedMs: number,
): void {
  drawScene(ctx, { ...state, heads: tween.before.heads }, size, {
    cells: tween.before.cells, skip: new Set([tween.a, tween.b]),
  });
  const { scale, offsetX, offsetY } = matchupTransform(size);
  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);
  const a = centre(tween.a);
  const b = centre(tween.b);
  const p = matchupSwapProgress(elapsedMs, tween.rejected);
  drawMatchupGem(ctx, tween.before.cells[tween.a] ?? 0, a.x + (b.x - a.x) * p, a.y + (b.y - a.y) * p, RADIUS);
  drawMatchupGem(ctx, tween.before.cells[tween.b] ?? 0, b.x + (a.x - b.x) * p, b.y + (a.y - b.y) * p, RADIUS);
  ctx.restore();
}

/** The sim with the art renderer swapped in; step/score are the sim's own. */
export const matchupArtGame = { ...matchupGame, draw: drawMatchupArt };
