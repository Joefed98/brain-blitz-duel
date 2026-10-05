/** Burst in the Retro Arcade world. Render only; the sim and its bounds are untouched. */
import {
  burstCeiling,
  burstGame,
  BURST_COLOURS,
  BURST_FLOOR_Y,
  BURST_LIVES,
  BURST_RADIUS,
  BURST_SHORT_LEN,
  BURST_WORLD_W,
  type BurstState,
} from "./burst";
import type { ArcadeGame, ArcadeInputEvent, CanvasSize } from "./engine";
import {
  pixelRect,
  retroBloom,
  retroClock,
  retroEventAge,
  retroNeon,
  retroText,
  retroScreen,
  RETRO_RED,
  RETRO_WHITE,
} from "./retro.renderer";

import { artCanvas, artContext, type ArtCanvas } from "./cache.renderer";
import { reducedMotion } from "./art.renderer";
import { FX_PARTICLE_LIMIT } from "@/lib/fx/limits";

export const BURST_FX_ENEMY_THRESHOLD = 24;
export const BURST_FX_SHOT_THRESHOLD = 8;
const FP = 256;
/** Mirrors of private sim geometry (player box and icon half-size). */
const PLAYER_HALF_W = 12;
const PLAYER_H = 36;
const ICON_HALF = 8;
const BEAM = "#4BFF7A";
const WALL = "#B49CFF";
const SHIP = "#FFD84A";
const SHIELD = "#3DFFE0";

/** Invader sprites, 8 × 7, one per ball size. */
const SPRITES: readonly string[][] = [
  ["..X..X..", "...XX...", "..XXXX..", ".XX..XX.", "XXXXXXXX", "X.XXXX.X", "..X..X.."],
  ["...XX...", "..XXXX..", ".XXXXXX.", "XX.XX.XX", "XXXXXXXX", "..X..X..", ".X.XX.X."],
  ["..XXXX..", ".XXXXXX.", "XX.XX.XX", "XXXXXXXX", ".XX..XX.", "X......X", ".X....X."],
  ["X.XXXX.X", "XXXXXXXX", "XX.XX.XX", "XXXXXXXX", ".X.XX.X.", "X......X", "........"],
];

/** Pixel ship, 12 × 18 blocks of 2 px = exactly the 24 × 36 player box. */
const SHIP_ROWS = [
  ".....XX.....",
  ".....XX.....",
  "....XXXX....",
  "....XXXX....",
  "....X..X....",
  "...XX..XX...",
  "...XXXXXX...",
  "...XXXXXX...",
  "..XXXXXXXX..",
  "..XXXXXXXX..",
  ".XXX.XX.XXX.",
  ".XXXXXXXXXX.",
  "XXXXXXXXXXXX",
  "XXXXXXXXXXXX",
  "XX.XXXXXX.XX",
  "XX..XXXX..XX",
  "X...X..X...X",
  "....X..X....",
];

const lifeMemo = new WeakMap<CanvasRenderingContext2D, { tick: number; lives: number }>();

function draw(ctx: CanvasRenderingContext2D, state: BurstState, size: CanvasSize): void {
  const m = lifeMemo.get(ctx);
  const lost = !!m && state.tick >= m.tick && state.lives < m.lives;
  lifeMemo.set(ctx, { tick: state.tick, lives: state.lives });
  const age = retroEventAge(ctx, "life", lost);
  const flash = age < 400 ? 1 - age / 400 : 0;
  retroScreen(ctx, size, BURST_WORLD_W, BURST_FLOOR_Y, "fit", (c) => drawWorld(c, state, flash), flash);
}

type Stamp = { layer: ArtCanvas; width: number; height: number; pad: number };
// Finite art variants only: 4 invaders, ship colours, icons, walls, beam types and shield.
const stamps = new Map<string, Stamp>();
function cachedArt(key: string, width: number, height: number, colour: string, glow: number,
  paint: (ctx: CanvasRenderingContext2D) => void): Stamp | null {
  const old = stamps.get(key);
  if (old) return old;
  const pad = glow ? 16 : 0;
  const layer = artCanvas(Math.ceil((width + pad * 2) * 2), Math.ceil((height + pad * 2) * 2));
  const c = layer && artContext(layer);
  if (!layer || !c) return null;
  c.scale(2, 2); c.translate(pad, pad);
  // Blur is paid once at cache creation, never on the live draw context.
  c.shadowColor = colour; c.shadowBlur = glow;
  paint(c as CanvasRenderingContext2D);
  const stamp = { layer, width, height, pad };
  stamps.set(key, stamp);
  return stamp;
}
function blit(ctx: CanvasRenderingContext2D, stamp: Stamp, left: number, top: number, width = stamp.width, height = stamp.height): void {
  ctx.drawImage(stamp.layer, left - stamp.pad, top - stamp.pad, width + stamp.pad * 2, height + stamp.pad * 2);
}
function plainSprite(ctx: CanvasRenderingContext2D, rows: readonly string[], left: number, top: number, block: number, colour: string): void {
  ctx.fillStyle = colour;
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) if (row[x] === "X") ctx.fillRect(left + x * block, top + y * block, block, block);
  });
}
function sprite(ctx: CanvasRenderingContext2D, rows: readonly string[], left: number, top: number, block: number, colour: string, glow = 0): void {
  const width = (rows[0]?.length ?? 0) * block, height = rows.length * block;
  const stamp = cachedArt(`${rows.join("/")}:${block}:${colour}:${glow}`, width, height, colour, glow,
    c => plainSprite(c, rows, 0, 0, block, colour));
  if (stamp) blit(ctx, stamp, left, top);
  else plainSprite(ctx, rows, left, top, block, colour);
}
function glowRect(ctx: CanvasRenderingContext2D, left: number, top: number, width: number, height: number, colour: string, key: string, vertical = false): void {
  // Long beam glow uses a fixed-size shaft; its hard core remains one exact rect.
  const w = vertical ? 2 : BURST_WORLD_W, h = vertical ? BURST_SHORT_LEN : 2;
  const stamp = cachedArt(key, w, h, colour, 8, c => { c.fillStyle = colour; c.fillRect(0, 0, w, h); });
  if (stamp) {
    const pad = stamp.pad;
    ctx.globalAlpha = Math.min(1, retroBloom() / 9);
    if (vertical && height === BURST_SHORT_LEN) {
      blit(ctx, stamp, left, top);
    } else if (vertical) {
      // Slice the shaft and end caps separately: stretching never lengthens the caps.
      ctx.drawImage(stamp.layer, 0, pad * 2, stamp.layer.width, h * 2, left - pad, top, w + pad * 2, height);
      ctx.drawImage(stamp.layer, 0, 0, stamp.layer.width, pad * 2, left - pad, top - pad, w + pad * 2, pad);
      ctx.drawImage(stamp.layer, 0, (pad + h) * 2, stamp.layer.width, pad * 2, left - pad, top + height, w + pad * 2, pad);
    } else blit(ctx, stamp, left, top, width, height);
    ctx.globalAlpha = 1;
  }
  pixelRect(ctx, left, top, width, height, colour);
}
type Pop = { tick: number; x: number; y: number; colour: string; spread: number };
const popMemo = new WeakMap<CanvasRenderingContext2D, { tick: number; seen: number; pops: Pop[] }>();
function particles(ctx: CanvasRenderingContext2D, state: BurstState): void {
  let memo = popMemo.get(ctx);
  if (!memo || state.tick < memo.tick) memo = { tick: state.tick, seen: -100, pops: [] };
  memo.tick = state.tick;
  memo.pops = memo.pops.filter(p => state.tick - p.tick < 18);
  if (state.popTick !== memo.seen) {
    memo.seen = state.popTick;
    if (state.tick - state.popTick >= 0 && state.tick - state.popTick < 18 &&
      state.balls.length <= BURST_FX_ENEMY_THRESHOLD && state.shots.length <= BURST_FX_SHOT_THRESHOLD &&
      memo.pops.length * 8 + 8 <= FX_PARTICLE_LIMIT) {
      memo.pops.push({ tick: state.popTick, x: state.popX / FP, y: state.popY / FP,
        colour: retroNeon(BURST_COLOURS[state.popSize] ?? RETRO_WHITE), spread: BURST_RADIUS[state.popSize] ?? 16 });
    }
  }
  popMemo.set(ctx, memo);
  for (const pop of memo.pops) {
    const age = reducedMotion() ? 0 : (state.tick - pop.tick) / 18;
    ctx.globalAlpha = 1 - age;
    for (let i = 0; i < 8; i++) {
      const angle = i * Math.PI / 4 + 0.35, distance = pop.spread * age + 2;
      pixelRect(ctx, pop.x + Math.cos(angle) * distance - 2, pop.y + Math.sin(angle) * distance - 2, 4, 4, pop.colour);
    }
  }
  ctx.globalAlpha = 1;
}

function drawWorld(ctx: CanvasRenderingContext2D, state: BurstState, lifeFlash: number): void {
  const tick = state.tick;
  const ceil = burstCeiling(state.wave);

  // Ceiling and side walls as neon; the ceiling flashes while a ball touches it.
  const touching = state.balls.some((b) => b.y / FP - (BURST_RADIUS[b.size] ?? 8) <= ceil + 2);
  pixelRect(ctx, 0, 0, BURST_WORLD_W, ceil, "rgba(180,156,255,0.05)");
  glowRect(ctx, 0, ceil - 2, BURST_WORLD_W, 2, touching ? RETRO_WHITE : WALL, touching ? "ceiling-flash" : "ceiling");
  pixelRect(ctx, 0, ceil, 2, BURST_FLOOR_Y - ceil, `${WALL}88`);
  pixelRect(ctx, BURST_WORLD_W - 2, ceil, 2, BURST_FLOOR_Y - ceil, `${WALL}88`);
  glowRect(ctx, 0, BURST_FLOOR_Y - 2, BURST_WORLD_W, 3, SHIELD, "floor");

  // Shots: thin green beams on the original shot lines.
  for (const shot of state.shots) {
    const x = shot.x / FP;
    const top = shot.top / FP;
    const bottom = shot.short ? top + BURST_SHORT_LEN : BURST_FLOOR_Y;
    if (bottom > top) glowRect(ctx, x - 1, top, 2, bottom - top, BEAM, shot.short ? "beam-short" : "beam-long", true);
  }

  // Power-up icons inside their 16 × 16 boxes.
  for (const icon of state.icons) {
    const x = icon.x / FP;
    const y = icon.y / FP;
    if (icon.kind === 1) {
      sprite(ctx, ["..XXXX..", ".X....X.", "X..XX..X", "X.X..X.X", "X..XX..X", ".X....X.", "..XXXX.."], x - ICON_HALF, y - 7, 2, SHIELD);
    } else {
      sprite(ctx, ["...XX...", "..XXXX..", ".XXXXXX.", "XXXXXXXX", ".XXXXXX.", "..XXXX..", "...XX..."], x - ICON_HALF, y - 7, 2, SHIP);
    }
  }

  // Invaders: each sprite fits the square inscribed in the sim's circle.
  for (const ball of state.balls) {
    const r = BURST_RADIUS[ball.size] ?? 8;
    const side = r * 1.4;
    const block = side / 8;
    const colour = retroNeon(BURST_COLOURS[ball.size] ?? RETRO_WHITE);
    const rows = SPRITES[ball.size];
    if (rows) sprite(ctx, rows, ball.x / FP - side / 2, ball.y / FP - (block * 7) / 2, block, colour, 8);
  }
  particles(ctx, state);

  // Ship in the exact player box; flashes while invulnerable or just hit.
  const hide = state.invuln > 0 && Math.trunc(tick / 5) % 2 === 1;
  if (!hide) {
    const left = state.x / FP - PLAYER_HALF_W;
    const top = BURST_FLOOR_Y - PLAYER_H;
    const colour = lifeFlash > 0 ? RETRO_RED : SHIP;
    sprite(ctx, SHIP_ROWS, left, top, 2, lifeFlash > 0 ? RETRO_RED : state.burst ? "#FFF2A8" : colour, state.burst ? 12 : 0);
    pixelRect(ctx, left + 10, top + 8, 4, 2, "#000000");
  }
  if (state.shield) {
    // Flickering neon ring at the original shield ring.
    const t = retroClock();
    ctx.globalAlpha = t === 0 ? 0.85 : 0.6 + 0.35 * (Math.floor(t / 70) % 2);
    const cx = state.x / FP;
    const cy = BURST_FLOOR_Y - 18;
    const paint = (c: CanvasRenderingContext2D) => {
      c.fillStyle = SHIELD;
      for (let i = 0; i < 32; i++) {
        const a = i / 32 * Math.PI * 2;
        c.fillRect(Math.round(28 + Math.cos(a) * 26 - 1), Math.round(28 + Math.sin(a) * 26 - 1), 3, 3);
      }
    };
    const shield = cachedArt("shield", 56, 56, SHIELD, 0, paint);
    if (shield) blit(ctx, shield, cx - 28, cy - 28);
    else { ctx.save(); ctx.translate(cx - 28, cy - 28); paint(ctx); ctx.restore(); }
    ctx.globalAlpha = 1;
  }

  const score = burstGame.score(state);
  const on = Math.floor(retroClock() / 500) % 2 === 0;
  retroText(ctx, "1UP", 14, 8, 8, on ? RETRO_RED : "rgba(255,59,92,0.35)");
  retroText(ctx, `WAVE ${Math.max(1, state.wave)} ${score}${state.burst ? " BURST" : ""}`, 14, 20, 10, RETRO_WHITE);
  for (let i = 0; i < BURST_LIVES; i++) {
    sprite(ctx, ["..X..", ".XXX.", "XXXXX", "X.X.X"], BURST_WORLD_W - 100 + i * 16, 14, 2, i < state.lives ? SHIP : "rgba(255,216,74,0.2)");
  }
}

export const burstArtGame: ArcadeGame<BurstState, ArcadeInputEvent | null> = { ...burstGame, draw };
