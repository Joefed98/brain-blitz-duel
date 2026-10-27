import { successHud, successFrame, SUCCESS_ACCENTS } from "./success.renderer";
import { arcadeFx } from "./arcadeFx.renderer";
import { snakeFxFor } from "./arcadeFxGames.renderer";
/** Eat and Grow's cached Retro Arcade meteor. Presentation only. */
import {
  snakeGame, snakeCol, snakeRow, SNAKE_BOARD_W,
  SNAKE_BOARD_X, SNAKE_BOARD_Y, SNAKE_CELL, SNAKE_COLS,
  SNAKE_WORLD_W, SNAKE_ROCK_WARN_TICKS, snakeRowsOf, snakeWorldHFor, type SnakeState,
  snakeBoardXOf, snakeColsOf, snakeWorldWOf, snakeV9Bonus, SNAKE_GOLD_LIFE,
} from "./snake";
import type { ArcadeGame, ArcadeInputEvent, CanvasSize } from "./engine";
import { reducedMotion } from "./art.renderer";
import { artCanvas, artContext, type ArtCanvas } from "./cache.renderer";
import { retroClock, retroScreen, retroText, RETRO_BLACK, RETRO_RED, RETRO_WHITE } from "./retro.renderer";
import { arcadeReducedEffects } from "../fx/lowEnd";
import { FX_PARTICLE_LIMIT } from "../fx/limits";
import { addPop, backdrop, blob, drawPops, glow, linear, pixelStars } from "./polishA1.renderer";

// Meteor-only art roles; the grid and pellet retain their Retro palette.
const ACCENT = "#FF8A28";
const FLAMES = ["#FF9D32", "#FF7824", "#F44C20", "#D92C21", "#982328", "#66646C"];
const RIMS = ["#B74419", "#AB3519", "#95261B", "#791E22", "#5D2027", "#46444D"];
const HOT = "#FFF4D2";
const ROCK = "#29282D";
const ROCK_FLECK = "#77747B";
const SMOKE = "#85818B";
/** Polish A1: the asteroids' orange shades, lit top left. */
const ROCK_LIT = "#FFB060";
const ROCK_MID = "#F07A2C";
const ROCK_BASE = "#C2561E";
const ROCK_DARK = "#8A3614";
const ROCK_SPECK = "#FFD08A";
/** Polish A1: the stars' white-gold glow. */
export const STAR_GLOW = "#FFE9A8";
const PICKUP_TAILS=["#FF6545","#FFD84A","#3DFFE0"] as const;
const PELLET = "#FFD84A";
const EYE = RETRO_BLACK;
const SPRITE_RATIO = 2;
const EAT_MS = 260;
const DEATH_MS = 650;
const TAIL_SPARKS = 6;
const LEVELS = 6;
const stamps = new Map<string, ArtCanvas>();

type Memory = { tick: number; rng: number; eaten: number; pellet: number; dead: boolean; eatAt: number; eatCell: number; deathAt: number };
const memories = new WeakMap<CanvasRenderingContext2D, Memory>();
/** The board being drawn: its left edge and columns (snakeRev 9's wider grid, else the original); set per frame. */
let BX = SNAKE_BOARD_X;
let COLS = SNAKE_COLS;
const point = (cell: number) => ({ x: BX + snakeCol(cell, COLS) * SNAKE_CELL + SNAKE_CELL / 2, y: SNAKE_BOARD_Y + snakeRow(cell, COLS) * SNAKE_CELL + SNAKE_CELL / 2 });
const direction = (dir: number) => ({ x: dir === 1 ? 1 : dir === 3 ? -1 : 0, y: dir === 2 ? 1 : dir === 0 ? -1 : 0 });

/** Fixed DPR-2 sprites: only cache creation draws pixel planes and pays for blur. */
export function stamp(kind: "bead" | "head" | "star" | "rock", level = 0, dir = 0, tail = 0): ArtCanvas | null {
  const id = `${kind}:${level}:${kind === "head" ? dir : 0}:${tail}`;
  const old = stamps.get(id);
  if (old) return old;
  const canvas = artCanvas(SNAKE_CELL * SPRITE_RATIO, SNAKE_CELL * SPRITE_RATIO);
  const c = canvas && artContext(canvas);
  if (!canvas || !c) return null;
  c.scale(SPRITE_RATIO, SPRITE_RATIO);
  c.imageSmoothingEnabled = false;
  paintStamp(c as CanvasRenderingContext2D, kind, level, dir, tail, SPRITE_RATIO);
  // Canvas itself clips every glow to the full-cell envelope.
  stamps.set(id, canvas);
  return canvas;
}

/**
 * A stamp's art on a SNAKE_CELL square at (0, 0) (the cached sprite above; the game icon paints it at
 * its real size). `ratio` is device px per cell px, so the glow keeps its size: the sprite's is 2.
 */
export function paintStamp(c: CanvasRenderingContext2D, kind: "bead" | "head" | "star" | "rock", level: number, dir: number, tail: number, ratio: number): void {
  const middle = SNAKE_CELL / 2;
  if (kind === "rock") {
    // A landed asteroid (Polish A1: shaded orange, lit from the top left, no tail): a pixel boulder
    // filling the cell (the head's whole collision square).
    for (let y = 0; y < SNAKE_CELL; y += 2) {
      for (let x = 0; x < SNAKE_CELL; x += 2) {
        const dx = x + 1 - middle, dy = y + 1 - middle;
        const lumpy = middle - 1 + (((x * 7 + y * 3) >> 2) % 3 === 0 ? -1 : 0);
        if (dx * dx + dy * dy > lumpy * lumpy) continue;
        const light = -(dx + dy) / (middle * 2);
        const crater = (dx - 3) * (dx - 3) + (dy + 2) * (dy + 2) < 10 || (dx + 4) * (dx + 4) + (dy - 4) * (dy - 4) < 6;
        const rim = dx * dx + dy * dy > (lumpy - 2) * (lumpy - 2);
        c.fillStyle = crater
          ? (dx + dy < 0 ? "#6A2A10" : "#4A1C0C")
          : light > 0.32 ? ROCK_LIT : light > 0.05 ? ROCK_MID : light > -0.3 ? ROCK_BASE : ROCK_DARK;
        if (rim && light < -0.1) c.fillStyle = "#3E170A";
        if (!crater && (x + y) % 10 === 0 && light > -0.3) c.fillStyle = ROCK_SPECK;
        c.fillRect(x, y, 2, 2);
      }
    }
    c.fillStyle = "#FFE2B8";
    c.globalAlpha = 0.75;
    c.fillRect(middle - 6, middle - 7, 2, 2);
    c.fillRect(middle - 4, middle - 7, 2, 2);
    c.globalAlpha = 1;
  } else if (kind === "star") {
    c.fillStyle = PELLET;
    c.shadowColor = PELLET;
    c.shadowBlur = 1.5 * ratio;
    // Four pointed pixel star; no soft/gradient geometry.
    c.fillRect(middle - 1, middle - 6, 2, 12);
    c.fillRect(middle - 6, middle - 1, 12, 2);
    c.fillRect(middle - 3, middle - 3, 6, 6);
    c.shadowBlur = 0;
    // Polish A1: a white-gold heart, so the star reads as light.
    c.fillStyle = "#FFF3C4";
    c.fillRect(middle - 1, middle - 4, 2, 8);
    c.fillRect(middle - 4, middle - 1, 8, 2);
    c.fillStyle = RETRO_WHITE;
    c.fillRect(middle - 1, middle - 1, 2, 2);
  } else {
    // A full 24px outer bead always marks the sim cell. Only the bright inner
    // bead tapers: 24 -> 18px (75%), never the collision-sized envelope.
    const inner = kind === "head" ? SNAKE_CELL : SNAKE_CELL - Math.round(level / (LEVELS - 1) * 3) * 2;
    const radius = inner / 2;
    const inset = (SNAKE_CELL - inner) / 2;
    const flame = FLAMES[level] ?? ACCENT;
    c.fillStyle = kind === "head" ? RIMS[0] ?? ACCENT : RIMS[level] ?? ACCENT;
    c.shadowColor = kind === "head" ? ACCENT : flame;
    c.shadowBlur = 1.5 * ratio;
    for (let y = 0; y < SNAKE_CELL; y += 2) {
      for (let x = 0; x < SNAKE_CELL; x += 2) {
        const dx = x + 1 - middle, dy = y + 1 - middle;
        if (dx * dx + dy * dy <= middle * middle) c.fillRect(x, y, 2, 2);
      }
    }
    c.shadowBlur = 0;
    c.globalAlpha = kind === "head" ? 1 : 1 - level * 0.105;
    const d = direction(dir);
    for (let y = inset; y < SNAKE_CELL - inset; y += 2) {
      for (let x = inset; x < SNAKE_CELL - inset; x += 2) {
        const dx = x + 1 - middle, dy = y + 1 - middle;
        if (dx * dx + dy * dy > radius * radius) continue;
        if (kind === "head") {
          // Pixel fire bands face travel, while the rock stays cell-centred.
          const front = dx * d.x + dy * d.y;
          c.fillStyle = front >= 7 ? HOT : front >= -3 ? ACCENT : FLAMES[3] ?? ACCENT;
          if (dx * dx + dy * dy < 43 && !(dx > 3 && dy < -2)) c.fillStyle = ROCK;
        } else {
          // Flat flame tongues, not gradients: each bead remains a discrete cell.
          const tongue = ((x / 2 + y / 2) % 5 === 0) && dy < 1;
          c.fillStyle = tail===0 ? (tongue && level < 4 ? FLAMES[Math.max(0, level - 1)] ?? flame : flame) : PICKUP_TAILS[tail%PICKUP_TAILS.length]??flame;
          if (level === LEVELS - 1 && (x / 2 + y / 2) % 4 === 0) c.fillStyle = SMOKE;
        }
        c.fillRect(x, y, 2, 2);
      }
    }
    c.globalAlpha = 1;
    if (kind === "head") {
      c.fillStyle = ROCK_FLECK;
      c.fillRect(middle - 4, middle - 3, 2, 2);
      c.fillRect(middle + 1, middle + 2, 2, 2);
      c.fillRect(middle - 2, middle + 4, 2, 2);
    }
  }
}

function blit(ctx: CanvasRenderingContext2D, sprite: ArtCanvas | null, x: number, y: number, fallback = ACCENT): void {
  if (sprite) ctx.drawImage(sprite, Math.round(x - SNAKE_CELL / 2), Math.round(y - SNAKE_CELL / 2), SNAKE_CELL, SNAKE_CELL);
  else { ctx.fillStyle = fallback; ctx.fillRect(x - 9, y - 9, 18, 18); }
}

/** The faint grid, one cached raster per row count (the original 20 rows or Tuning E's taller grid). */
const grids = new Map<string, ArtCanvas | null>();
function drawGrid(ctx: CanvasRenderingContext2D, rows: number, cols: number = SNAKE_COLS, bx: number = SNAKE_BOARD_X): void {
  const boardH = rows * SNAKE_CELL;
  const boardW = cols * SNAKE_CELL;
  let grid = grids.get(`${rows}:${cols}`) ?? null;
  if (!grid) {
    const canvas = artCanvas(boardW * SPRITE_RATIO, boardH * SPRITE_RATIO);
    const c = canvas && artContext(canvas);
    if (canvas && c) {
      c.scale(SPRITE_RATIO, SPRITE_RATIO);
      c.fillStyle = "rgba(75,255,122,0.07)";
      for (let col = 0; col <= cols; col++) c.fillRect(col * SNAKE_CELL, 0, 1, boardH);
      for (let row = 0; row <= rows; row++) c.fillRect(0, row * SNAKE_CELL, boardW, 1);
      // The board's outer border is drawn live over the scanlines (drawBorder), not in this raster.
      grid = canvas;
      grids.set(`${rows}:${cols}`, grid);
    }
  }
  if (grid) ctx.drawImage(grid, bx, SNAKE_BOARD_Y, boardW, boardH);
}

function memory(key: CanvasRenderingContext2D, state: SnakeState, now: number): Memory {
  let memo = memories.get(key);
  if (!memo || state.tick < memo.tick || (state.tick === 0 && state.rng !== memo.rng) || state.eaten < memo.eaten) {
    memo = { tick: state.tick, rng: state.rng, eaten: state.eaten, pellet: state.pellet, dead: state.dead, eatAt: -Infinity, eatCell: -1, deathAt: state.dead ? now : -Infinity };
  }
  if (state.eaten > memo.eaten) {
    memo.eatAt = now; memo.eatCell = memo.pellet;
    // Polish A1: a small "+10" where the star was eaten (presentation memory only).
    const at = point(memo.pellet);
    addPop(key, at.x, at.y - 6, "+10", STAR_GLOW, 9, 3);
  }
  if (state.dead && !memo.dead) memo.deathAt = now;
  memo.tick = state.tick; memo.rng = state.rng; memo.eaten = state.eaten; memo.pellet = state.pellet; memo.dead = state.dead;
  memories.set(key, memo);
  return memo;
}

export function eyes(ctx: CanvasRenderingContext2D, x: number, y: number, dir: number): void {
  const d = direction(dir);
  ctx.fillStyle = EYE;
  for (const side of [-1, 1]) ctx.fillRect(x + d.x * 6 - d.y * side * 5 - 1, y + d.y * 6 + d.x * side * 5 - 1, 2, 2);
}

function drawWorld(ctx: CanvasRenderingContext2D, state: SnakeState, key: CanvasRenderingContext2D): void {
  const now = typeof performance === "undefined" ? 0 : performance.now();
  const motion = !reducedMotion();
  // snakeRev 9: the wider board (the original otherwise), set before anything places a square.
  BX = snakeBoardXOf(state);
  COLS = snakeColsOf(state);
  const memo = memory(key, state, now);
  const age = now - memo.eatAt;
  const deathAge = now - memo.deathAt;
  const rows = snakeRowsOf(state);
  const SNAKE_WORLD_H = snakeWorldHFor(rows);
  // snakeRev 9: the wider world and board (the original otherwise).
  const W = snakeWorldWOf(state);
  const cols = COLS, bx = BX;
  backdrop(ctx, `meteor-space:${W}`, W, SNAKE_WORLD_H, (c) => paintSpace(c, rows, SNAKE_WORLD_H, W, cols, bx));
  drawGrid(ctx, rows, cols, bx);
  // Body decoration cannot spill beyond the playable grid.
  ctx.save();
  ctx.beginPath(); ctx.rect(bx, SNAKE_BOARD_Y, cols * SNAKE_CELL, rows * SNAKE_CELL); ctx.clip();
  if (state.exp) drawFeatures(ctx, state, motion, now);
  const pellet = point(state.pellet);
  // Polish A1: the star's white-gold glow, breathing slowly (still under reduced motion), inside its cell.
  glow(ctx, STAR_GLOW, pellet.x, pellet.y, 12, 12, motion ? 0.5 + 0.18 * Math.sin(now / 380) : 0.55);
  blit(ctx, stamp("star"), pellet.x, pellet.y, PELLET);
  drawRocks(ctx, state, motion);
  const headCell = state.body[0];
  if (headCell !== undefined) {
    const head = point(headCell);
    // Light only between contiguous centres; no interpolation or moved segments.
    if (motion && !state.dead) {
      const lengthFactor = Math.min(1, state.body.length / 25); ctx.fillStyle = ACCENT; ctx.globalAlpha = 0.12 + 0.16 * lengthFactor;
      for (let i = 1; i < state.body.length; i++) {
        const cell = state.body[i], ahead = state.body[i - 1];
        if (cell === undefined || ahead === undefined) continue;
        const a = point(cell), b = point(ahead);
        if (Math.abs(a.x - b.x) + Math.abs(a.y - b.y) !== SNAKE_CELL) continue;
        ctx.fillRect(Math.min(a.x, b.x) - 1, Math.min(a.y, b.y) - 1, Math.abs(a.x - b.x) + 2, Math.abs(a.y - b.y) + 2);
      }
      ctx.globalAlpha = 1;
    }
    for (let i = state.body.length - 1; i >= 0; i--) {
      const cell = state.body[i];
      if (cell === undefined) continue;
      const p = point(cell);
      const level = Math.min(LEVELS - 1, Math.round(i / Math.max(1, state.body.length - 1) * (LEVELS - 1)));
      ctx.globalAlpha = state.dead && motion ? 1 - 0.35 * Math.min(1, deathAge / DEATH_MS) : 1;
      const shift=Math.floor(state.eaten/5)%3;
      blit(ctx, stamp(i === 0 ? "head" : "bead", i === 0 ? 0 : level, state.dir,shift), p.x, p.y);
    }
    ctx.globalAlpha = 1;
    eyes(ctx, head.x, head.y, state.dir);
    if (age >= 0 && age < EAT_MS) {
      if (motion && memo.eatCell >= 0) {
        const start = point(memo.eatCell), d = direction(state.dir), k = Math.min(1, age / 150);
        const x = start.x - d.x * 8, y = start.y - d.y * 8;
        ctx.globalAlpha = 1 - k;
        blit(ctx, stamp("star"), x + (head.x - x) * k, y + (head.y - y) * k, PELLET);
      }
      ctx.globalAlpha = 0.75 * (1 - age / EAT_MS);
      // Short fire flare stays inside the head cell, leaving its rock visible.
      ctx.fillStyle = HOT;
      const d = direction(state.dir);
      if (d.x !== 0) ctx.fillRect(head.x + d.x * 8 - 1, head.y - 7, 2, 14);
      else ctx.fillRect(head.x - 7, head.y + d.y * 8 - 1, 14, 2);
      ctx.globalAlpha = 1;
      eyes(ctx, head.x, head.y, state.dir);
    }
    if (motion) sparks(ctx, state, now, deathAge);
    if (state.exp) v9Pops(key, state, head);
  }
  const rewardPoint=memo.eatCell>=0?point(memo.eatCell):point(state.body[0]??0);
  successFrame(ctx,{id:'snake',tick:state.tick,count:state.eaten,colour:ACCENT,width:W,height:SNAKE_WORLD_H,point:{...rewardPoint,shape:'spark'},hud:{x:14,y:22,text:`STARS ${state.eaten}`}});
  ctx.restore();
  // Same 1UP readout, without a per-frame text blur.
  const on = Math.floor(retroClock() / 500) % 2 === 0;
  retroText(ctx, "1UP", 14, 10, 8, on ? RETRO_RED : "rgba(255,59,92,0.35)");
  drawPops(ctx, key, W);
  successHud(ctx,'snake',state.tick,14,22,()=>{retroText(ctx, `STARS ${state.eaten}`, 14, 22, 10, RETRO_WHITE);});
  if (state.rev) {
    const rocks = state.rocks?.length ?? 0;
    const falling = (state.rockWarn ?? -1) >= 0;
    const shower = (state.showerWarn ?? []).length > 0;
    retroText(ctx, shower ? "METEOR SHOWER!" : falling ? "ROCK INCOMING" : `ROCKS ${rocks}`, W - 14, 22, 8, (falling || shower) && on ? RETRO_RED : "rgba(255,255,255,0.6)", "right");
  }
  if (state.exp) {
    // snakeRev 9's HUD line: the combo (gold while it scores) and the skill bonus so far.
    const combo = state.combo ?? 0;
    const quick = state.tick - (state.lastStar ?? -9999) <= 150;
    retroText(ctx, combo >= 2 && quick ? `COMBO x${combo}` : "", W / 2, 22, 10, combo >= 3 ? GOLD : RETRO_WHITE, "center");
    retroText(ctx, `BONUS +${snakeV9Bonus(state).total}`, W - 14, 8, 8, GOLD, "right");
  }
}

/**
 * snakeRev 2 asteroids: the falling rock's shadow (a red square that darkens and
 * tightens over its 2 s, timed by the sim tick) and every landed rock. All read
 * from the state; the rock fills its cell, the head's collision square.
 */
function drawRocks(ctx: CanvasRenderingContext2D, state: SnakeState, motion: boolean): void {
  // snakeRev 3: the meteor shower's three shadows use the same warning as a single rock.
  const falling: [number, number][] = [];
  if ((state.rockWarn ?? -1) >= 0) falling.push([state.rockWarn!, state.rockLandTick ?? 0]);
  for (const cell of state.showerWarn ?? []) falling.push([cell, state.showerLandTick ?? 0]);
  for (const [warn, landTick] of falling) {
    const p = point(warn);
    const left = Math.max(0, landTick - state.tick);
    const k = 1 - Math.min(1, left / SNAKE_ROCK_WARN_TICKS);
    const half = SNAKE_CELL / 2 - 1;
    // Polish A1: a faint red floor where it lands, under a pulsing dashed pixel ring that tightens and
    // quickens as the rock falls (the square's tint still deepens over the 2 s, timed by the sim tick).
    ctx.fillStyle = `rgba(255,59,92,${0.1 + 0.26 * k})`;
    ctx.fillRect(p.x - half + 2, p.y - half + 2, half * 2 - 4, half * 2 - 4);
    const beat = motion ? 0.5 + 0.5 * Math.sin(state.tick / (k > 0.6 ? 2.2 : 4.5)) : 1;
    // Inside the cell (never over the board's border), closing in from 10 px to 8 px as it falls.
    const ring = half - 1 - 2 * k;
    dashedRing(ctx, p.x, p.y, ring, 20, motion ? state.tick * 0.03 : 0, RETRO_RED, 0.55 + 0.45 * beat);
    if (k > 0.5) dashedRing(ctx, p.x, p.y, ring - 4, 12, motion ? -state.tick * 0.05 : 0, "#FF8FA3", (k - 0.5) * 2 * (0.4 + 0.6 * beat));
    // The rock itself, small and high, growing as it nears the ground.
    if (motion && k > 0.35) {
      const sprite = stamp("rock");
      const size = Math.round(6 + 14 * k);
      const lift = Math.round((1 - k) * 40);
      ctx.globalAlpha = 0.5 + 0.5 * k;
      if (sprite) ctx.drawImage(sprite, Math.round(p.x - size / 2), Math.round(p.y - size / 2 - lift), size, size);
      ctx.globalAlpha = 1;
    }
  }
  for (const rock of state.rocks ?? []) {
    const p = point(rock);
    blit(ctx, stamp("rock"), p.x, p.y, ROCK_BASE);
  }
}

/** A dashed ring of 2 px pixels (two on, one off) round (x, y), turned by `turn` radians. */
function dashedRing(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, dots: number, turn: number, colour: string, alpha: number): void {
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  ctx.fillStyle = colour;
  for (let i = 0; i < dots; i++) {
    if (i % 3 === 2) continue;
    const a = turn + (i / dots) * Math.PI * 2;
    ctx.fillRect(Math.round(x + Math.cos(a) * r) - 1, Math.round(y + Math.sin(a) * r) - 1, 2, 2);
  }
  ctx.globalAlpha = 1;
}

/**
 * Polish A1: Meteor's deep space, painted once per world size (backdrop): a near-black sky with a
 * purple and a teal nebula, a pixel starfield and a soft glow round the board's edge, fading to black
 * at the world's edges so it meets the screen fill without a seam. Static: nothing here moves.
 */
function paintSpace(c: CanvasRenderingContext2D, rows: number, worldH: number, W: number = SNAKE_WORLD_W, cols: number = SNAKE_COLS, boardX: number = SNAKE_BOARD_X): void {
  const boardH = rows * SNAKE_CELL;
  const SNAKE_BOARD_W = cols * SNAKE_CELL;
  c.fillStyle = "#04030A";
  c.fillRect(0, 0, W, worldH);
  blob(c, W * 0.22, worldH * 0.26, W * 0.62, "#5B2A9E", 0.42, 1.25);
  blob(c, W * 0.86, worldH * 0.7, W * 0.58, "#137A78", 0.34, 1.35);
  blob(c, W * 0.55, worldH * 0.48, W * 0.36, "#7A3FC4", 0.16, 1.1);
  blob(c, W * 0.12, worldH * 0.84, W * 0.32, "#1FA8A0", 0.14, 1.2);
  pixelStars(c, 0, 0, W, worldH, 150, 512, ["#FFFFFF", "#CFC4FF", "#9FF5EA", "#FFE9A8"], 0.85);
  // The board's edge: a soft light just inside and outside the frame (the live border is drawn over it).
  const bx = boardX, by = SNAKE_BOARD_Y;
  c.globalAlpha = 1;
  for (const [x, y, w, h, x0, y0, x1, y1] of [
    [bx, by, SNAKE_BOARD_W, 10, 0, by, 0, by + 10],
    [bx, by + boardH - 10, SNAKE_BOARD_W, 10, 0, by + boardH, 0, by + boardH - 10],
    [bx, by, 10, boardH, bx, 0, bx + 10, 0],
    [bx + SNAKE_BOARD_W - 10, by, 10, boardH, bx + SNAKE_BOARD_W, 0, bx + SNAKE_BOARD_W - 10, 0],
  ] as const) {
    c.fillStyle = linear(c, x0, y0, x1, y1, [[0, "rgba(185,166,255,0.16)"], [1, "rgba(185,166,255,0)"]]);
    c.fillRect(x, y, w, h);
  }
  for (const [x, y, w, h, x0, y0, x1, y1] of [
    [bx - 6, by - 6, SNAKE_BOARD_W + 12, 6, 0, by, 0, by - 6],
    [bx - 6, by + boardH, SNAKE_BOARD_W + 12, 6, 0, by + boardH, 0, by + boardH + 6],
    [bx - 6, by, 6, boardH, bx, 0, bx - 6, 0],
    [bx + SNAKE_BOARD_W, by, 6, boardH, bx + SNAKE_BOARD_W, 0, bx + SNAKE_BOARD_W + 6, 0],
  ] as const) {
    c.fillStyle = linear(c, x0, y0, x1, y1, [[0, "rgba(185,166,255,0.12)"], [1, "rgba(185,166,255,0)"]]);
    c.fillRect(x, y, w, h);
  }
  // The border's own rows and the margin under the board stay pure black, as before: the live border is
  // drawn at half strength over black (its colour is judged there), and the margin under it must never
  // light (arcade-device-bottom-check, the Meteor bottom-edge fix).
  c.globalAlpha = 1;
  // The board's last cells settle to black too, so the drifting scanlines (a 28 % shade every third
  // device row) change nothing across the bottom edge: lit there, their drift was the old blink.
  c.fillStyle = linear(c, 0, by + boardH - 64, 0, by + boardH - 2, [[0, "rgba(0,0,0,0)"], [0.55, "rgba(0,0,0,0.9)"], [1, "rgba(0,0,0,1)"]]);
  c.fillRect(0, by + boardH - 64, W, 62);
  c.fillStyle = "#000000";
  c.fillRect(0, by - 2, W, 4);
  c.fillRect(0, by + boardH - 2, W, worldH - (by + boardH - 2));
  // Fade to black over the last few px of the world, where the screen fill (black, with stars) takes over.
  const edge = 6;
  for (const [x, y, w, h, x0, y0, x1, y1] of [
    [0, 0, W, edge, 0, 0, 0, edge],
    [0, worldH - edge, W, edge, 0, worldH, 0, worldH - edge],
    [0, 0, edge, worldH, 0, 0, edge, 0],
    [W - edge, 0, edge, worldH, W, 0, W - edge, 0],
  ] as const) {
    c.fillStyle = linear(c, x0, y0, x1, y1, [[0, "rgba(0,0,0,0.9)"], [1, "rgba(0,0,0,0)"]]);
    c.fillRect(x, y, w, h);
  }
}

/** Analytic sparks: no emitter allocation, shared maximum, no sim randomness. */
function sparks(ctx: CanvasRenderingContext2D, state: SnakeState, now: number, deathAge: number): void {
  const death = state.dead;
  if (death && (deathAge < 0 || deathAge >= DEATH_MS)) return;
  const count = death ? Math.min(FX_PARTICLE_LIMIT, state.body.length * 2) : Math.min(FX_PARTICLE_LIMIT, TAIL_SPARKS + 6);
  const tail = state.body[state.body.length - 1];
  if (tail === undefined) return;
  const ahead = state.body[state.body.length - 2] ?? tail;
  const t = point(tail), a = point(ahead);
  for (let i = 0; i < count; i++) {
    const tailEffect = !death && i < TAIL_SPARKS;
    const cell = death || !tailEffect ? state.body[Math.floor(i * state.body.length / count)] : tail;
    if (cell === undefined) continue;
    const p = point(cell);
    const k = death ? deathAge / DEATH_MS : ((now / 550 + i / count) % 1);
    const angle = i * 2.39996 + snakeCol(cell) * 0.3;
    const spread = death ? 15 * k : 5 * k;
    const smoke = death ? i % 3 === 0 || k > 0.65 : tailEffect && i % 3 === 0;
    const dx = death ? Math.cos(angle) * spread : tailEffect ? (t.x - a.x) / SNAKE_CELL * (5 + k * 10) + Math.cos(angle) * spread : Math.cos(angle) * spread;
    const dy = death ? Math.sin(angle) * spread - (smoke ? k * 9 : 0) : tailEffect ? (t.y - a.y) / SNAKE_CELL * (5 + k * 10) + Math.sin(angle) * spread - k * 6 : -k * 16;
    ctx.globalAlpha = (1 - k) * 0.75;
    ctx.fillStyle = smoke ? SMOKE : i % 2 === 0 ? ACCENT : HOT;
    const size = smoke ? 4 : 2;
    ctx.fillRect(Math.round(p.x + dx) - size / 2, Math.round(p.y + dy) - size / 2, size, size);
  }
  ctx.globalAlpha = 1;
}

/**
 * The board's border (16 Oct 2026, display only): a crisp 1 px neon frame round the board that,
 * every METEOR_BORDER_PERIOD_MS, gives a short glow pulse (METEOR_BORDER_PULSE_MS) and steps to the
 * next colour of a small retro palette, the step hidden at the pulse's peak. Only colour and glow
 * animate: the frame's place and width never change, and the glow is painted inside the board only,
 * so nothing outside the frame (the bottom margin, the gap under the canvas) ever changes. Reduced
 * motion and reduced effects hold the first colour (Meteor's green, as before) with no pulse.
 */
export const METEOR_BORDER_COLOURS = ["#4BFF7A", "#3DFFE0", "#FF4FD8", "#FFB43A"] as const;
export const METEOR_BORDER_PERIOD_MS = 4000;
export const METEOR_BORDER_PULSE_MS = 600;
/** The frame's alpha at rest and at the pulse's peak; the inner glow bands' alpha at the peak. */
export const METEOR_BORDER_REST_ALPHA = 0.5;
const BORDER_PEAK_ALPHA = 1;
const BORDER_GLOW = [0.34, 0.2, 0.1] as const;

/** The border's look at presentation time `t` (ms): its colour and glow (0…1). Pure, for checks. */
export function meteorBorderLook(t: number, hold: boolean): { colour: string; glow: number } {
  const n = METEOR_BORDER_COLOURS.length;
  if (hold || t <= 0) return { colour: METEOR_BORDER_COLOURS[0], glow: 0 };
  const cycle = Math.floor(t / METEOR_BORDER_PERIOD_MS);
  const phase = t - cycle * METEOR_BORDER_PERIOD_MS;
  const pulsing = phase < METEOR_BORDER_PULSE_MS;
  const index = cycle - (pulsing && phase < METEOR_BORDER_PULSE_MS / 2 ? 1 : 0);
  return {
    colour: METEOR_BORDER_COLOURS[((index % n) + n) % n]!,
    glow: pulsing ? Math.sin((Math.PI * phase) / METEOR_BORDER_PULSE_MS) : 0,
  };
}

/**
 * The border's outer edges in device pixels for a world-to-device transform (scale a, d; offset e, f):
 * left, right, top and bottom snapped to whole device pixels, and its width w (one world pixel, rounded).
 */
export function meteorBorderRect(a: number, d: number, e: number, f: number, rows: number, cols: number = SNAKE_COLS, bx: number = SNAKE_BOARD_X): { x0: number; x1: number; y0: number; y1: number; w: number } {
  return {
    x0: Math.round(a * bx + e),
    x1: Math.round(a * (bx + cols * SNAKE_CELL) + e),
    y0: Math.round(d * SNAKE_BOARD_Y + f),
    y1: Math.round(d * (SNAKE_BOARD_Y + rows * SNAKE_CELL) + f),
    w: Math.max(1, Math.round(Math.min(a, d))),
  };
}

/**
 * Draws the border in device pixels over the scanlines (retroScreen's overlay): each edge snapped to
 * whole device pixels and as wide as one world pixel rounds to, so no row is part-covered and
 * anti-aliased. Four fills at rest, twelve more during a pulse; no blur.
 */
function drawBorder(ctx: CanvasRenderingContext2D, rows: number, cols: number = SNAKE_COLS, bx: number = SNAKE_BOARD_X): void {
  const look = meteorBorderLook(retroClock(), arcadeReducedEffects());
  const m = ctx.getTransform();
  const { x0, x1, y0, y1, w } = meteorBorderRect(m.a || 1, m.d ?? (m.a || 1), m.e ?? 0, m.f ?? 0, rows, cols, bx);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = look.colour;
  const frame = (inset: number, alpha: number) => {
    const l = x0 + inset, t = y0 + inset, r = x1 - inset, b = y1 - inset;
    if (r - l <= 2 * w || b - t <= 2 * w) return;
    ctx.globalAlpha = alpha;
    ctx.fillRect(l, t, r - l, w);
    ctx.fillRect(l, b - w, r - l, w);
    ctx.fillRect(l, t + w, w, b - t - 2 * w);
    ctx.fillRect(r - w, t + w, w, b - t - 2 * w);
  };
  frame(0, METEOR_BORDER_REST_ALPHA + (BORDER_PEAK_ALPHA - METEOR_BORDER_REST_ALPHA) * look.glow);
  if (look.glow > 0) BORDER_GLOW.forEach((alpha, i) => frame((i + 1) * w, alpha * look.glow));
  ctx.restore();
}

/**
 * Meteor's bottom-edge flash (16 Oct 2026, display only), in two parts:
 *  - #80: on the play screen the canvas is the world's own box (its aspect to within a device pixel),
 *    and "fit" letterboxed the world inside it by a fraction of a pixel, leaving an edge row part
 *    bezel, part screen. When the canvas is within a pixel of the world's aspect, the screen fills it
 *    edge to edge with square corners (the play screen's corners are square; elsewhere the canvas's
 *    CSS rounds them). Any other size keeps the letterboxed fit.
 *  - The flash that remained: the board's bright bottom border (then a 35 % green stroke in the
 *    cached grid, about 9 px above the arena's bottom) lay under the scanlines, which drift a pixel
 *    every 90 ms with a 3 px period, so one phase in three darkened the whole line by 28 %: a
 *    full-width line blinking about four times a second. The border is now drawn over the scanlines
 *    (drawBorder), so nothing on the bottom edge changes but the game's own content.
 */
function draw(ctx: CanvasRenderingContext2D, state: SnakeState, size: CanvasSize): void {
  const rows = snakeRowsOf(state);
  const worldH = snakeWorldHFor(rows);
  const worldW = snakeWorldWOf(state);
  const cols = snakeColsOf(state);
  const bx = snakeBoardXOf(state);
  const s = Math.min(size.width / worldW, size.height / worldH);
  const ownBox = size.width - worldW * s < 1 && size.height - worldH * s < 1;
  retroScreen(ctx, size, worldW, worldH, ownBox ? "stretch" : "fit", c => arcadeFx(c, snakeFxFor(state), state, () => drawWorld(c, state, ctx)), 0, ownBox ? 0 : 6, c => drawBorder(c, rows, cols, bx));
}
export const snakeArtGame: ArcadeGame<SnakeState, ArcadeInputEvent | null> = { ...snakeGame, draw };

/* ================= snakeRev 9 features (display only) ================= */

const GOLD = "#FFD84A";
const GOLD_HOT = "#FFF4C4";
/** Wormhole pair colours (Meteor's border palette's teal and magenta). */
const WARP_COLOURS = ["#3DFFE0", "#FF4FD8"] as const;
const LANE = "#9F8BFF";
type V9Memory = { tick: number; golds: number; goldPts: number; warps: number; combo: number; laneCells: number };
const v9Memories = new WeakMap<object, V9Memory>();

/** Pops for the features' moments: "+n" where a gold star was eaten, "WARP", "COMBO ×n" (presentation memory only). */
function v9Pops(key: object, state: SnakeState, head: { x: number; y: number }): void {
  let memo = v9Memories.get(key);
  const now = { tick: state.tick, golds: state.goldsEaten ?? 0, goldPts: state.goldPts ?? 0, warps: state.warpsUsed ?? 0, combo: state.combo ?? 0, laneCells: state.laneCells ?? 0 };
  if (!memo || state.tick < memo.tick) memo = now;
  if (now.golds > memo.golds) addPop(key, head.x, head.y - 10, `GOLD +${now.goldPts - memo.goldPts}`, GOLD, 10, 4);
  if (now.warps > memo.warps) addPop(key, head.x, head.y - 10, "WARP!", WARP_COLOURS[0], 9, 4);
  if (now.combo > memo.combo && now.combo >= 3) addPop(key, head.x, head.y + 14, `COMBO x${now.combo}`, GOLD_HOT, 9, 4);
  v9Memories.set(key, now);
}

/**
 * snakeRev 9's speed lanes, wormholes and gold comet star, under the stars and the meteor. Everything
 * sits inside its squares (a lane's strip, a mouth's or the gold star's cell), so the art matches what
 * the head collides with. The board's last 64 px (kept dark against the scanline drift) get only the
 * lanes' still strip: nothing there moves from frame to frame.
 */
function drawFeatures(ctx: CanvasRenderingContext2D, state: SnakeState, motion: boolean, now: number): void {
  const rows = snakeRowsOf(state);
  const boardW = COLS * SNAKE_CELL;
  const boardH = rows * SNAKE_CELL;
  const fade = SNAKE_BOARD_Y + boardH - 64;
  const shift = motion ? Math.floor(now / 45) % 24 : 0;
  // Speed lanes: a violet strip with glowing edges and chevrons running both ways.
  const lanes: [number, number, number, number, boolean][] = [];
  if (state.laneRow !== undefined) lanes.push([BX, SNAKE_BOARD_Y + state.laneRow * SNAKE_CELL, boardW, SNAKE_CELL, true]);
  if (state.laneCol !== undefined) lanes.push([BX + state.laneCol * SNAKE_CELL, SNAKE_BOARD_Y, SNAKE_CELL, boardH, false]);
  for (const [x, y, w, h, across] of lanes) {
    ctx.fillStyle = "rgba(159,139,255,0.10)";
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = LANE;
    ctx.globalAlpha = 0.45;
    if (across) {
      ctx.fillRect(x, y + 1, w, 1);
      ctx.fillRect(x, y + h - 2, w, 1);
    } else {
      ctx.fillRect(x + 1, y, 1, h);
      ctx.fillRect(x + w - 2, y, 1, h);
    }
    ctx.globalAlpha = 0.5;
    // Chevrons: 2 px pixels, one row each way (right/left, or down/up), every 24 px, drifting.
    for (let k = -1; k < (across ? w : Math.min(h, fade - y)) / 24 + 1; k++) {
      for (const way of [1, -1]) {
        const along = k * 24 + (way > 0 ? shift : 24 - shift);
        for (let i = 0; i < 3; i++) {
          const a = along + i * 2 * way, b = (i === 1 ? 0 : i === 0 ? -2 : 2);
          const lx = across ? x + a : x + SNAKE_CELL / 2 + (way > 0 ? -5 : 4) + b * 0;
          const ly = across ? y + SNAKE_CELL / 2 + (way > 0 ? -5 : 4) : y + a;
          if (across ? lx < x || lx > x + w - 2 : ly < y || ly > fade - 2) continue;
          if (across) ctx.fillRect(lx, ly + b, 2, 2);
          else ctx.fillRect(lx + b, ly, 2, 2);
        }
      }
    }
    ctx.globalAlpha = 1;
  }
  // Wormholes: a dark mouth with two turning rings in its pair's colour; both mouths flash on a trip.
  const warps = state.warps ?? [];
  const flash = motion ? Math.max(0, 1 - (state.tick - (state.lastWarp ?? -9999)) / 20) : 0;
  warps.forEach((cell, i) => {
    const p = point(cell);
    const colour = WARP_COLOURS[i >> 1] ?? WARP_COLOURS[0];
    glow(ctx, colour, p.x, p.y, 11, 11, 0.45 + 0.4 * flash);
    ctx.fillStyle = "#05030C";
    ctx.beginPath();
    ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
    ctx.fill();
    const turn = motion ? state.tick * 0.08 * (i % 2 ? -1 : 1) : 0;
    dashedRing(ctx, p.x, p.y, 10, 18, turn, colour, 0.9);
    dashedRing(ctx, p.x, p.y, 6, 10, -turn * 1.6, "#FFFFFF", 0.55 + 0.45 * flash);
  });
  // The gold comet star: the star sprite on a gold glow, fading as it runs out, with a timer ring.
  const gold = state.gold ?? -1;
  if (gold >= 0) {
    const p = point(gold);
    const left = Math.max(0, (state.goldEnd ?? 0) - state.tick) / SNAKE_GOLD_LIFE;
    const blink = motion && left < 0.3 ? (Math.floor(state.tick / 6) % 2 ? 0.45 : 1) : 1;
    glow(ctx, GOLD, p.x, p.y, 12, 12, (0.4 + 0.5 * left) * blink);
    ctx.globalAlpha = (0.45 + 0.55 * left) * blink;
    // A gold pixel diamond filling the cell behind the star, so it never reads as an ordinary star.
    ctx.fillStyle = "#E39A10";
    for (let d = 0; d < 10; d += 2) ctx.fillRect(Math.round(p.x) - 10 + d, Math.round(p.y) - 1 - d, 20 - 2 * d, 2 + 2 * d);
    ctx.fillStyle = GOLD;
    for (let d = 2; d < 10; d += 2) ctx.fillRect(Math.round(p.x) - 10 + d, Math.round(p.y) - 1 - d + 2, 20 - 2 * d, 2 * d - 2);
    const sprite = stamp("star");
    if (sprite) ctx.drawImage(sprite, Math.round(p.x - SNAKE_CELL / 2), Math.round(p.y - SNAKE_CELL / 2), SNAKE_CELL, SNAKE_CELL);
    ctx.fillStyle = GOLD;
    const dots = 16;
    for (let i = 0; i < Math.ceil(dots * left); i++) {
      const a = -Math.PI / 2 + (i / dots) * Math.PI * 2;
      ctx.fillRect(Math.round(p.x + Math.cos(a) * 10) - 1, Math.round(p.y + Math.sin(a) * 10) - 1, 2, 2);
    }
    ctx.globalAlpha = 1;
  }
}
