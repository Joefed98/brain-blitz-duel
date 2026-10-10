import { successHud, successFrame, SUCCESS_ACCENTS } from "./success.renderer";
/** Eat and Grow's cached Retro Arcade meteor. Presentation only. */
import {
  snakeGame, snakeCol, snakeRow, SNAKE_BOARD_H, SNAKE_BOARD_W,
  SNAKE_BOARD_X, SNAKE_BOARD_Y, SNAKE_CELL, SNAKE_COLS, SNAKE_ROWS,
  SNAKE_WORLD_H, SNAKE_WORLD_W, type SnakeState,
} from "./snake";
import type { ArcadeGame, ArcadeInputEvent, CanvasSize } from "./engine";
import { reducedMotion } from "./art.renderer";
import { artCanvas, artContext, type ArtCanvas } from "./cache.renderer";
import { retroClock, retroScreen, retroText, RETRO_BLACK, RETRO_RED, RETRO_WHITE } from "./retro.renderer";
import { FX_PARTICLE_LIMIT } from "../fx/limits";

// Meteor-only art roles; the grid and pellet retain their Retro palette.
const ACCENT = "#FF8A28";
const FLAMES = ["#FF9D32", "#FF7824", "#F44C20", "#D92C21", "#982328", "#66646C"];
const RIMS = ["#B74419", "#AB3519", "#95261B", "#791E22", "#5D2027", "#46444D"];
const HOT = "#FFF4D2";
const ROCK = "#29282D";
const ROCK_FLECK = "#77747B";
const SMOKE = "#85818B";
const PICKUP_TAILS=["#FF6545","#FFD84A","#3DFFE0"] as const;
const PELLET = "#FFD84A";
const EYE = RETRO_BLACK;
const SPRITE_RATIO = 2;
const EAT_MS = 260;
const DEATH_MS = 650;
const TAIL_SPARKS = 6;
const LEVELS = 6;
const stamps = new Map<string, ArtCanvas>();
let grid: ArtCanvas | null = null;

type Memory = { tick: number; rng: number; eaten: number; pellet: number; dead: boolean; eatAt: number; eatCell: number; deathAt: number };
const memories = new WeakMap<CanvasRenderingContext2D, Memory>();
const point = (cell: number) => ({ x: SNAKE_BOARD_X + snakeCol(cell) * SNAKE_CELL + SNAKE_CELL / 2, y: SNAKE_BOARD_Y + snakeRow(cell) * SNAKE_CELL + SNAKE_CELL / 2 });
const direction = (dir: number) => ({ x: dir === 1 ? 1 : dir === 3 ? -1 : 0, y: dir === 2 ? 1 : dir === 0 ? -1 : 0 });

/** Fixed DPR-2 sprites: only cache creation draws pixel planes and pays for blur. */
function stamp(kind: "bead" | "head" | "star", level = 0, dir = 0, tail = 0): ArtCanvas | null {
  const id = `${kind}:${level}:${kind === "head" ? dir : 0}:${tail}`;
  const old = stamps.get(id);
  if (old) return old;
  const canvas = artCanvas(SNAKE_CELL * SPRITE_RATIO, SNAKE_CELL * SPRITE_RATIO);
  const c = canvas && artContext(canvas);
  if (!canvas || !c) return null;
  c.scale(SPRITE_RATIO, SPRITE_RATIO);
  c.imageSmoothingEnabled = false;
  const middle = SNAKE_CELL / 2;
  if (kind === "star") {
    c.fillStyle = PELLET;
    c.shadowColor = PELLET;
    c.shadowBlur = 3;
    // Four pointed pixel star; no soft/gradient geometry.
    c.fillRect(middle - 1, middle - 6, 2, 12);
    c.fillRect(middle - 6, middle - 1, 12, 2);
    c.fillRect(middle - 3, middle - 3, 6, 6);
    c.shadowBlur = 0;
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
    c.shadowBlur = 3;
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
  // Canvas itself clips every glow to the full-cell envelope.
  stamps.set(id, canvas);
  return canvas;
}

function blit(ctx: CanvasRenderingContext2D, sprite: ArtCanvas | null, x: number, y: number, fallback = ACCENT): void {
  if (sprite) ctx.drawImage(sprite, Math.round(x - SNAKE_CELL / 2), Math.round(y - SNAKE_CELL / 2), SNAKE_CELL, SNAKE_CELL);
  else { ctx.fillStyle = fallback; ctx.fillRect(x - 9, y - 9, 18, 18); }
}

function drawGrid(ctx: CanvasRenderingContext2D): void {
  if (!grid) {
    const canvas = artCanvas(SNAKE_BOARD_W * SPRITE_RATIO, SNAKE_BOARD_H * SPRITE_RATIO);
    const c = canvas && artContext(canvas);
    if (canvas && c) {
      c.scale(SPRITE_RATIO, SPRITE_RATIO);
      c.fillStyle = "rgba(75,255,122,0.07)";
      for (let col = 0; col <= SNAKE_COLS; col++) c.fillRect(col * SNAKE_CELL, 0, 1, SNAKE_BOARD_H);
      for (let row = 0; row <= SNAKE_ROWS; row++) c.fillRect(0, row * SNAKE_CELL, SNAKE_BOARD_W, 1);
      c.strokeStyle = "rgba(75,255,122,0.35)";
      c.lineWidth = 1;
      c.strokeRect(0.5, 0.5, SNAKE_BOARD_W - 1, SNAKE_BOARD_H - 1);
      grid = canvas;
    }
  }
  if (grid) ctx.drawImage(grid, SNAKE_BOARD_X, SNAKE_BOARD_Y, SNAKE_BOARD_W, SNAKE_BOARD_H);
}

function memory(key: CanvasRenderingContext2D, state: SnakeState, now: number): Memory {
  let memo = memories.get(key);
  if (!memo || state.tick < memo.tick || (state.tick === 0 && state.rng !== memo.rng) || state.eaten < memo.eaten) {
    memo = { tick: state.tick, rng: state.rng, eaten: state.eaten, pellet: state.pellet, dead: state.dead, eatAt: -Infinity, eatCell: -1, deathAt: state.dead ? now : -Infinity };
  }
  if (state.eaten > memo.eaten) { memo.eatAt = now; memo.eatCell = memo.pellet; }
  if (state.dead && !memo.dead) memo.deathAt = now;
  memo.tick = state.tick; memo.rng = state.rng; memo.eaten = state.eaten; memo.pellet = state.pellet; memo.dead = state.dead;
  memories.set(key, memo);
  return memo;
}

function eyes(ctx: CanvasRenderingContext2D, x: number, y: number, dir: number): void {
  const d = direction(dir);
  ctx.fillStyle = EYE;
  for (const side of [-1, 1]) ctx.fillRect(x + d.x * 6 - d.y * side * 5 - 1, y + d.y * 6 + d.x * side * 5 - 1, 2, 2);
}

function drawWorld(ctx: CanvasRenderingContext2D, state: SnakeState, key: CanvasRenderingContext2D): void {
  const now = typeof performance === "undefined" ? 0 : performance.now();
  const motion = !reducedMotion();
  const memo = memory(key, state, now);
  const age = now - memo.eatAt;
  const deathAge = now - memo.deathAt;
  drawGrid(ctx);
  // Body decoration cannot spill beyond the playable grid.
  ctx.save();
  ctx.beginPath(); ctx.rect(SNAKE_BOARD_X, SNAKE_BOARD_Y, SNAKE_BOARD_W, SNAKE_BOARD_H); ctx.clip();
  const pellet = point(state.pellet);
  blit(ctx, stamp("star"), pellet.x, pellet.y, PELLET);
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
  }
  const rewardPoint=memo.eatCell>=0?point(memo.eatCell):point(state.body[0]??0);
  successFrame(ctx,{id:'snake',tick:state.tick,count:state.eaten,colour:ACCENT,width:SNAKE_WORLD_W,height:SNAKE_WORLD_H,point:{...rewardPoint,shape:'spark'},hud:{x:14,y:22,text:`PELLETS ${state.eaten}`}});
  ctx.restore();
  // Same 1UP readout, without a per-frame text blur.
  const on = Math.floor(retroClock() / 500) % 2 === 0;
  retroText(ctx, "1UP", 14, 10, 8, on ? RETRO_RED : "rgba(255,59,92,0.35)");
  successHud(ctx,'snake',state.tick,14,22,()=>{retroText(ctx, `PELLETS ${state.eaten}`, 14, 22, 10, RETRO_WHITE);});
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

function draw(ctx: CanvasRenderingContext2D, state: SnakeState, size: CanvasSize): void {
  retroScreen(ctx, size, SNAKE_WORLD_W, SNAKE_WORLD_H, "fit", c => drawWorld(c, state, ctx));
}
export const snakeArtGame: ArcadeGame<SnakeState, ArcadeInputEvent | null> = { ...snakeGame, draw };
