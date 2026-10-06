/**
 * Skyline — the third arcade game on the shared engine.
 *
 * A block slides back and forth above a tower; a tap drops it. The overlapping
 * part stays, the overhang is lost, and the next block starts from the opposite
 * side at the trimmed width. Everything is integer fixed-point (1/256 px) and
 * every constant below is written once, in units.
 */

import {
  clampInt,
  px,
  rngBelow,
  TICKS_PER_SECOND,
  type CanvasSize,
} from "./engine";
import type { ArcadeGame } from "./engine";

/* ============================== Constants ============================== */

export const SKYLINE_WORLD_W = 390;
export const SKYLINE_WORLD_H = 560;

export const SKYLINE_RUN_SECONDS = 60;
export const SKYLINE_RUN_TICKS = SKYLINE_RUN_SECONDS * TICKS_PER_SECOND;

/** Every simulation constant below is already in 1/256-pixel units. */
export const SKYLINE_WORLD_RIGHT = 99_840;
export const SKYLINE_WORLD_BOTTOM = 143_360;

export const SKYLINE_START_W = 51_200;
export const SKYLINE_BLOCK_H = 9_216;

export const SKYLINE_SPEED_START = 768;
export const SKYLINE_SPEED_STEP = 26;
export const SKYLINE_SPEED_MAX = 1_536;

/** Edges within this distance snap into line and win width back. */
export const SKYLINE_PERFECT_TOL = 768;
export const SKYLINE_PERFECT_GROW = 1_536;

/** Par: 36 blocks placed. */
export const SKYLINE_PAR = 36;
export const SKYLINE_BLOCK_POINTS = 2.5;
export const SKYLINE_PERFECT_POINTS = 3;
export const SKYLINE_POINTS_CAP = 110;
export const SKYLINE_SURVIVE_BONUS = 40;

/* ================================ State ================================ */

export interface SkylineBlock {
  /** Left edge, fixed-point. */
  x: number;
  w: number;
}

export interface SkylineState {
  tick: number;
  rng: number;
  /** Bottom-up: index 0 is the base block. */
  blocks: SkylineBlock[];
  /** The sliding block. */
  x: number;
  w: number;
  /** +1 sliding right, −1 sliding left. */
  dir: number;
  placed: number;
  perfects: number;
  missed: boolean;
  /** The tick of the last perfect drop, for the render-only gold flash. */
  perfectTick: number;
  endedTick: number;
}

/** Slide speed after this many blocks placed. */
export function skylineSpeed(placed: number): number {
  return Math.min(SKYLINE_SPEED_MAX, SKYLINE_SPEED_START + SKYLINE_SPEED_STEP * placed);
}

function init(seed: number): SkylineState {
  const base: SkylineBlock = {
    x: (SKYLINE_WORLD_RIGHT - SKYLINE_START_W) >> 1,
    w: SKYLINE_START_W,
  };
  // The seed decides which side the first block comes in from.
  const drawn = rngBelow(seed | 0, 2);
  const dir = drawn.value === 0 ? 1 : -1;
  return {
    tick: 0,
    rng: drawn.state,
    blocks: [base],
    x: dir === 1 ? 0 : SKYLINE_WORLD_RIGHT - SKYLINE_START_W,
    w: SKYLINE_START_W,
    dir,
    placed: 0,
    perfects: 0,
    missed: false,
    perfectTick: 0,
    endedTick: 0,
  };
}

function isOver(state: SkylineState): boolean {
  return state.missed || state.tick >= SKYLINE_RUN_TICKS;
}

export function skylineSurvived(state: SkylineState): boolean {
  return !state.missed && state.tick >= SKYLINE_RUN_TICKS;
}

function step(state: SkylineState, tapped: boolean): SkylineState {
  if (isOver(state)) return state;
  const tick = state.tick + 1;

  if (tapped) {
    const below = state.blocks[state.blocks.length - 1]!;
    const left = Math.max(state.x, below.x);
    const right = Math.min(state.x + state.w, below.x + below.w);
    if (right - left <= 0) {
      return { ...state, tick, missed: true, endedTick: tick };
    }

    const perfect = Math.abs(state.x - below.x) <= SKYLINE_PERFECT_TOL;
    const width = perfect
      ? Math.min(SKYLINE_START_W, below.w + SKYLINE_PERFECT_GROW)
      : right - left;
    const x = perfect ? below.x : left;
    const blocks = [...state.blocks, { x, w: width }];
    const placed = state.placed + 1;
    const dir = state.dir >= 0 ? -1 : 1;
    const next: SkylineState = {
      ...state,
      tick,
      blocks,
      placed,
      perfects: state.perfects + (perfect ? 1 : 0),
      perfectTick: perfect ? tick : state.perfectTick,
      x: dir === 1 ? 0 : SKYLINE_WORLD_RIGHT - width,
      w: width,
      dir,
    };
    if (tick >= SKYLINE_RUN_TICKS) return { ...next, endedTick: tick };
    return next;
  }

  const speed = skylineSpeed(state.placed);
  let x = state.x + state.dir * speed;
  let dir = state.dir;
  if (x <= 0) {
    x = 0;
    dir = 1;
  } else if (x + state.w >= SKYLINE_WORLD_RIGHT) {
    x = SKYLINE_WORLD_RIGHT - state.w;
    dir = -1;
  }
  const next: SkylineState = { ...state, tick, x, dir };
  if (tick >= SKYLINE_RUN_TICKS) return { ...next, endedTick: tick };
  return next;
}

function score(state: SkylineState): number {
  return clampInt(Math.floor(SKYLINE_BLOCK_POINTS * state.placed + SKYLINE_PERFECT_POINTS * state.perfects), 0, 150);
}

/* =========================== Integrity checks ========================== */

export const SKYLINE_CHECKPOINT_INTERVAL = 300;

export interface SkylineCheckpointState {
  tick: number;
  x: number;
  w: number;
  dir: number;
  placed: number;
  perfects: number;
  speed: number;
  topX: number;
  topW: number;
}

export interface SkylineCheckpoint extends SkylineCheckpointState {
  checksum: number;
}

export function skylineCheckpointState(state: SkylineState): SkylineCheckpointState {
  const top = state.blocks[state.blocks.length - 1]!;
  return {
    tick: state.tick,
    x: state.x,
    w: state.w,
    dir: state.dir,
    placed: state.placed,
    perfects: state.perfects,
    speed: skylineSpeed(state.placed),
    topX: top.x,
    topW: top.w,
  };
}

/** 32-bit FNV-1a over the integer snapshot, with an xor before each multiply. */
export function skylineCheckpoint(state: SkylineState): SkylineCheckpoint {
  const snapshot = skylineCheckpointState(state);
  let checksum = 0x811c9dc5;
  for (const value of Object.values(snapshot)) {
    checksum ^= value | 0;
    checksum = Math.imul(checksum, 0x01000193) >>> 0;
  }
  return { ...snapshot, checksum };
}

/* ================================ Drawing ============================== */

export const SKYLINE_BG = "#0B0B0F";
export const SKYLINE_FLASH = "#F5B82E";
/** The game palette, cycled per level — render only, never in the sim. */
export const SKYLINE_COLOURS = [
  "#2ED3B7",
  "#F5B82E",
  "#7C5CFF",
  "#FF7A59",
  "#4F9CF9",
  "#FFE600",
  "#FF4D8D",
  "#8B5A2B",
];

/** Smallest render zoom as the tower grows. */
export const SKYLINE_MIN_ZOOM = 0.45;
const zoomMemo = new WeakMap<CanvasRenderingContext2D, number>();

/** Fixed silhouette: [left, width, height] in world px. */
const BACKDROP = [
  [0, 34, 120], [30, 26, 180], [54, 40, 140], [92, 22, 210], [112, 36, 160], [146, 30, 240],
  [174, 44, 130], [216, 26, 200], [240, 38, 170], [276, 30, 230], [304, 42, 150], [344, 24, 190], [366, 30, 140],
] as const;

function drawBackdrop(ctx: CanvasRenderingContext2D, zoom: number, scroll: number): void {
  // Moves a fifth as much as the tower: shrinks a little and sinks a little.
  const k = 1 - (1 - zoom) * 0.2;
  ctx.save();
  ctx.translate(SKYLINE_WORLD_W / 2, SKYLINE_WORLD_H + scroll * 0.2 * zoom);
  ctx.scale(k, k);
  ctx.translate(-SKYLINE_WORLD_W / 2, -SKYLINE_WORLD_H);
  ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
  for (const [x, w, h] of BACKDROP) ctx.fillRect(x - 40, SKYLINE_WORLD_H - h, w - 2, h);
  ctx.fillStyle = "rgba(255, 255, 255, 0.035)";
  for (const [x, w, h] of BACKDROP) ctx.fillRect(x + 15, SKYLINE_WORLD_H - h * 0.6, w - 4, h * 0.6);
  ctx.restore();
}

function draw(ctx: CanvasRenderingContext2D, state: SkylineState, size: CanvasSize): void {
  const scale = Math.min(size.width / SKYLINE_WORLD_W, size.height / SKYLINE_WORLD_H);
  const offsetX = (size.width - SKYLINE_WORLD_W * scale) / 2;
  const offsetY = (size.height - SKYLINE_WORLD_H * scale) / 2;
  const blockH = px(SKYLINE_BLOCK_H);

  ctx.save();
  ctx.fillStyle = SKYLINE_BG;
  ctx.fillRect(0, 0, size.width, size.height);
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  // Camera (render only): once the tower passes the middle the view zooms out
  // about the bottom centre so the whole tower stays in shot, down to 0.45;
  // past that it scrolls. The zoom eases toward its target per canvas.
  const towerH = state.blocks.length * blockH;
  const middle = SKYLINE_WORLD_H / 2;
  const target = towerH + blockH <= middle ? 1 : Math.max(SKYLINE_MIN_ZOOM, middle / (towerH + blockH));
  const prev = zoomMemo.get(ctx);
  const zoom = prev === undefined || state.tick < 2 ? target : prev + (target - prev) * 0.12;
  zoomMemo.set(ctx, zoom);
  const visibleH = SKYLINE_WORLD_H / zoom;
  const camScroll = Math.max(0, towerH + blockH - visibleH * 0.5);

  // Faint city backdrop, parallaxing slower than the tower.
  drawBackdrop(ctx, zoom, camScroll);

  ctx.save();
  ctx.translate(SKYLINE_WORLD_W / 2, SKYLINE_WORLD_H);
  ctx.scale(zoom, zoom);
  ctx.translate(-SKYLINE_WORLD_W / 2, -SKYLINE_WORLD_H + camScroll);

  state.blocks.forEach((block, index) => {
    const bottom = SKYLINE_WORLD_H - index * blockH;
    const top = bottom - blockH;
    ctx.fillStyle = SKYLINE_COLOURS[index % SKYLINE_COLOURS.length]!;
    ctx.fillRect(px(block.x), top, px(block.w), blockH);
    ctx.strokeStyle = "rgba(0, 0, 0, 0.45)";
    ctx.lineWidth = 1;
    ctx.strokeRect(px(block.x) + 0.5, top + 0.5, px(block.w) - 1, blockH - 1);
  });

  if (!state.missed) {
    const bottom = SKYLINE_WORLD_H - state.blocks.length * blockH;
    ctx.fillStyle = SKYLINE_COLOURS[state.blocks.length % SKYLINE_COLOURS.length]!;
    ctx.fillRect(px(state.x), bottom - blockH, px(state.w), blockH);
  }

  if (state.perfectTick > 0 && state.tick - state.perfectTick < 12) {
    ctx.fillStyle = SKYLINE_FLASH;
    ctx.fillRect(-SKYLINE_WORLD_W, SKYLINE_WORLD_H - state.blocks.length * blockH - 2, SKYLINE_WORLD_W * 3, 2);
  }
  ctx.restore();

  ctx.font = "600 16px 'JetBrains Mono', ui-monospace, monospace";
  ctx.fillStyle = "#F7F7F8";
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.fillText(`Blocks ${state.placed}`, 12, 12);
  ctx.textAlign = "right";

  if (state.missed) {
    ctx.fillStyle = "rgba(255, 77, 77, 0.22)";
    ctx.fillRect(0, 0, SKYLINE_WORLD_W, SKYLINE_WORLD_H);
  }

  ctx.restore();
}

export const skylineGame: ArcadeGame<SkylineState> = {
  key: "skyline",
  runTicks: SKYLINE_RUN_TICKS,
  init,
  step,
  isOver,
  score,
  draw,
};
