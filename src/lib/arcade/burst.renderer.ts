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
  retroBurst,
  retroClock,
  retroEventAge,
  retroNeon,
  retroReadout,
  retroScreen,
  RETRO_RED,
  RETRO_WHITE,
} from "./retro.renderer";

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

function sprite(ctx: CanvasRenderingContext2D, rows: readonly string[], left: number, top: number, block: number, colour: string): void {
  ctx.fillStyle = colour;
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] === "X") ctx.fillRect(left + x * block, top + y * block, block, block);
    }
  });
}

function drawWorld(ctx: CanvasRenderingContext2D, state: BurstState, lifeFlash: number): void {
  const bloom = retroBloom();
  const tick = state.tick;
  const ceil = burstCeiling(state.wave);

  // Ceiling and side walls as neon; the ceiling flashes while a ball touches it.
  const touching = state.balls.some((b) => b.y / FP - BURST_RADIUS[b.size]! <= ceil + 2);
  pixelRect(ctx, 0, 0, BURST_WORLD_W, ceil, "rgba(180,156,255,0.05)");
  pixelRect(ctx, 0, ceil - 2, BURST_WORLD_W, 2, touching ? RETRO_WHITE : WALL, touching ? bloom * 2 : bloom);
  pixelRect(ctx, 0, ceil, 2, BURST_FLOOR_Y - ceil, `${WALL}88`);
  pixelRect(ctx, BURST_WORLD_W - 2, ceil, 2, BURST_FLOOR_Y - ceil, `${WALL}88`);
  pixelRect(ctx, 0, BURST_FLOOR_Y - 2, BURST_WORLD_W, 3, SHIELD, bloom);

  // Shots: thin green beams on the original shot lines.
  for (const shot of state.shots) {
    const x = shot.x / FP;
    const top = shot.top / FP;
    const bottom = shot.short ? top + BURST_SHORT_LEN : BURST_FLOOR_Y;
    pixelRect(ctx, x - 1, top, 2, bottom - top, BEAM, bloom);
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
    const r = BURST_RADIUS[ball.size]!;
    const side = r * 1.4;
    const block = side / 8;
    const colour = retroNeon(BURST_COLOURS[ball.size]!);
    ctx.shadowColor = colour;
    ctx.shadowBlur = bloom;
    sprite(ctx, SPRITES[ball.size]!, ball.x / FP - side / 2, ball.y / FP - (block * 7) / 2, block, colour);
    ctx.shadowBlur = 0;
  }

  if (tick - state.popTick < 18) {
    const colour = retroNeon(BURST_COLOURS[state.popSize] ?? "#FFFFFF");
    retroBurst(ctx, state.popX / FP, state.popY / FP, (tick - state.popTick) / 18, colour, BURST_RADIUS[state.popSize] ?? 16);
  }

  // Ship in the exact player box; flashes while invulnerable or just hit.
  const hide = state.invuln > 0 && Math.trunc(tick / 5) % 2 === 1;
  if (!hide) {
    const left = state.x / FP - PLAYER_HALF_W;
    const top = BURST_FLOOR_Y - PLAYER_H;
    const colour = lifeFlash > 0 ? RETRO_RED : SHIP;
    if (state.burst) {
      ctx.shadowColor = RETRO_WHITE;
      ctx.shadowBlur = bloom * 1.6;
    }
    sprite(ctx, SHIP_ROWS, left, top, 2, state.burst ? "#FFF2A8" : colour);
    ctx.shadowBlur = 0;
    pixelRect(ctx, left + 10, top + 8, 4, 2, "#000000");
  }
  if (state.shield) {
    // Flickering neon ring at the original shield ring.
    const t = retroClock();
    ctx.globalAlpha = t === 0 ? 0.85 : 0.6 + 0.35 * (Math.floor(t / 70) % 2);
    const cx = state.x / FP;
    const cy = BURST_FLOOR_Y - 18;
    ctx.fillStyle = SHIELD;
    for (let i = 0; i < 32; i++) {
      const a = (i / 32) * Math.PI * 2;
      ctx.fillRect(Math.round(cx + Math.cos(a) * 26 - 1), Math.round(cy + Math.sin(a) * 26 - 1), 3, 3);
    }
    ctx.globalAlpha = 1;
  }

  const score = burstGame.score(state);
  retroReadout(ctx, 14, 8, `WAVE ${Math.max(1, state.wave)} ${score}${state.burst ? " BURST" : ""}`, RETRO_WHITE);
  for (let i = 0; i < BURST_LIVES; i++) {
    sprite(ctx, ["..X..", ".XXX.", "XXXXX", "X.X.X"], BURST_WORLD_W - 100 + i * 16, 14, 2, i < state.lives ? SHIP : "rgba(255,216,74,0.2)");
  }
}

export const burstArtGame: ArcadeGame<BurstState, ArcadeInputEvent | null> = { ...burstGame, draw };
