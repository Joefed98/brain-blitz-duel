/** Breaker in the Retro Arcade world. Render only; the sim and its bounds are untouched. */
import {
  breakerGame,
  brkDestroyed,
  brkPaddleColumn,
  BRK_BALL_R,
  BRK_BRICK_H,
  BRK_BRICK_W,
  BRK_BRICKS,
  BRK_CAPSULE_H,
  BRK_CAPSULE_W,
  BRK_COLS,
  BRK_HUD_H,
  BRK_PADDLE_H,
  BRK_PADDLE_W,
  BRK_PADDLE_Y,
  BRK_POWER_COLOURS,
  BRK_POWER_LASER,
  BRK_POWER_MULTI,
  BRK_POWER_SPAM,
  BRK_ROW_PITCH,
  BRK_WALL,
  BRK_WALL_X,
  BRK_WALL_Y,
  BRK_WORLD_H,
  BRK_WORLD_W,
  type BrkState,
} from "./breaker";
import { px, type ArcadeGame, type ArcadeInputEvent, type CanvasSize } from "./engine";
import {
  drawRetroTrail,
  pixelRect,
  pixelShape,
  retroBall,
  retroBloom,
  retroBurst,
  retroPaddle,
  retroReadout,
  retroScreen,
  retroText,
  retroTrail,
  RETRO_WHITE,
} from "./retro.renderer";

/** Neon brick shades by hits left: lighter = fewer hits. */
const BRICK_NEON = ["#9FE8FF", "#3DA8FF", "#1F5FD6"] as const;
const PADDLE = "#FFD84A";
const LASER = "#FF4DE1";
const BURST_MS = 320;

const memo = new WeakMap<CanvasRenderingContext2D, { tick: number; bricks: number[]; deaths: { index: number; at: number }[] }>();

function draw(ctx: CanvasRenderingContext2D, state: BrkState, size: CanvasSize): void {
  // Stretch, as the original draw, so the drag maps to the same paddle x.
  retroScreen(ctx, size, BRK_WORLD_W, BRK_WORLD_H, "stretch", (c) => drawWorld(c, state, ctx));
}

function brickXY(index: number) {
  return {
    x: BRK_WALL_X + (index % BRK_COLS) * BRK_BRICK_W,
    y: BRK_WALL_Y + Math.trunc(index / BRK_COLS) * BRK_ROW_PITCH,
  };
}

function brickColour(state: BrkState, index: number, left: number): string {
  const power = (state.gold[index] ?? 0) - 1;
  if (power >= 0) return BRK_POWER_COLOURS[power] ?? PADDLE;
  return BRICK_NEON[Math.max(0, left - 1)] ?? BRICK_NEON[0];
}

function drawWorld(ctx: CanvasRenderingContext2D, state: BrkState, key: CanvasRenderingContext2D): void {
  const now = typeof performance === "undefined" ? 0 : performance.now();
  const bloom = retroBloom();
  let m = memo.get(key);
  if (!m || state.tick < m.tick) m = { tick: state.tick, bricks: state.bricks.slice(), deaths: [] };
  for (let i = 0; i < BRK_BRICKS; i++) {
    if ((m.bricks[i] ?? 0) > 0 && (state.bricks[i] ?? 0) <= 0) m.deaths.push({ index: i, at: now });
  }
  m.deaths = m.deaths.filter((d) => now - d.at < BURST_MS);
  m.tick = state.tick;
  m.bricks = state.bricks.slice();
  memo.set(key, m);

  // Walls as neon rails, on the original wall line.
  const wallColour = "#2A4A7A";
  pixelRect(ctx, BRK_WALL - 2, BRK_HUD_H + BRK_WALL - 2, BRK_WORLD_W - 2 * BRK_WALL + 4, 2, wallColour);
  pixelRect(ctx, BRK_WALL - 2, BRK_HUD_H + BRK_WALL - 2, 2, BRK_WORLD_H, wallColour);
  pixelRect(ctx, BRK_WORLD_W - BRK_WALL, BRK_HUD_H + BRK_WALL - 2, 2, BRK_WORLD_H, wallColour);

  state.bricks.forEach((left, index) => {
    if (left <= 0) return;
    const { x, y } = brickXY(index);
    const power = (state.gold[index] ?? 0) - 1;
    const colour = brickColour(state, index, left);
    if (power >= 0) {
      // Dark brick, metal outline, white pixel star.
      pixelRect(ctx, x + 1, y, BRK_BRICK_W - 2, BRK_BRICK_H, "#101018");
      pixelRect(ctx, x + 1, y, BRK_BRICK_W - 2, 2, colour, bloom);
      pixelRect(ctx, x + 1, y + BRK_BRICK_H - 2, BRK_BRICK_W - 2, 2, colour);
      pixelRect(ctx, x + 1, y, 2, BRK_BRICK_H, colour);
      pixelRect(ctx, x + BRK_BRICK_W - 3, y, 2, BRK_BRICK_H, colour);
      pixelStar(ctx, x + BRK_BRICK_W / 2, y + BRK_BRICK_H / 2);
      return;
    }
    pixelRect(ctx, x + 1, y, BRK_BRICK_W - 2, BRK_BRICK_H, colour, left === 1 ? bloom * 0.6 : 0);
    pixelRect(ctx, x + 1, y, BRK_BRICK_W - 2, 2, "rgba(255,255,255,0.35)");
    pixelRect(ctx, x + 1, y + BRK_BRICK_H - 2, BRK_BRICK_W - 2, 2, "rgba(0,0,0,0.35)");
    // Pixel cracks per hit taken.
    const taken = (state.maxHp[index] ?? 1) - left;
    for (let c = 0; c < taken; c++) {
      const cx = x + 10 + c * 16;
      pixelRect(ctx, cx, y + 4, 2, 4, "#000000");
      pixelRect(ctx, cx + 2, y + 8, 2, 4, "#000000");
      pixelRect(ctx, cx, y + 12, 2, 4, "#000000");
    }
  });

  for (const d of m.deaths) {
    const { x, y } = brickXY(d.index);
    const colour = brickColour(state, d.index, state.maxHp[d.index] ?? 1);
    retroBurst(ctx, x + BRK_BRICK_W / 2, y + BRK_BRICK_H / 2, (now - d.at) / BURST_MS, colour, 16);
  }

  if (state.beam > 0) {
    // Thin vertical neon lines inside the original beam column.
    const col = brkPaddleColumn(state.paddleX);
    const left = BRK_WALL_X + col * BRK_BRICK_W + 6;
    const width = BRK_BRICK_W - 12;
    for (const f of [0.2, 0.5, 0.8]) {
      pixelRect(ctx, left + width * f - 1, BRK_WALL_Y, 2, BRK_PADDLE_Y - BRK_WALL_Y, LASER, bloom);
    }
  }

  for (const capsule of state.capsules) {
    const colour = BRK_POWER_COLOURS[capsule.kind] ?? PADDLE;
    const cx = px(capsule.x);
    const cy = px(capsule.y);
    pixelRect(ctx, cx - BRK_CAPSULE_W / 2, cy - BRK_CAPSULE_H / 2, BRK_CAPSULE_W, BRK_CAPSULE_H, colour, bloom);
    retroText(
      ctx,
      capsule.kind === BRK_POWER_MULTI ? "2" : capsule.kind === BRK_POWER_SPAM ? "5" : "L",
      cx,
      cy - 3,
      6,
      "#000000",
      "center",
    );
  }

  retroPaddle(ctx, state.paddleX - BRK_PADDLE_W / 2, BRK_PADDLE_Y, BRK_PADDLE_W, BRK_PADDLE_H, PADDLE, "#5A4510", bloom);

  state.balls.forEach((ball, i) => {
    const bx = px(ball.x);
    const by = px(ball.y);
    const colour = state.pause > 0 ? "rgba(255,216,74,0.45)" : ball.spam === 1 ? PADDLE : "#BFF6FF";
    if (state.pause === 0) drawRetroTrail(ctx, retroTrail(key, state.tick, `b${i}`, bx, by), BRK_BALL_R, colour);
    retroBall(ctx, bx, by, BRK_BALL_R, colour, state.pause > 0 ? colour : RETRO_WHITE);
  });

  if (state.held > 0) {
    const laser = state.held === BRK_POWER_LASER + 1;
    retroText(
      ctx,
      laser ? "TAP TO FIRE LASER" : `TAP TO FIRE x${state.charges}`,
      BRK_WORLD_W / 2,
      BRK_PADDLE_Y + BRK_PADDLE_H + 14,
      9,
      laser ? BRK_POWER_COLOURS[2] : BRK_POWER_COLOURS[1],
      "center",
    );
  }

  retroReadout(ctx, 14, 8, `BRICKS ${brkDestroyed(state)}/${BRK_BRICKS}`, RETRO_WHITE);
  if (state.pause > 0) retroText(ctx, "RELAUNCHING", BRK_WORLD_W / 2, BRK_PADDLE_Y - 40, 10, PADDLE, "center");
}

/** A white five-point star in 2 px blocks, inside the brick. */
function pixelStar(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
  const r = 7;
  const pts: [number, number][] = [];
  for (let p = 0; p < 10; p++) {
    const rad = p % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + (p * Math.PI) / 5;
    pts.push([Math.cos(a) * rad, Math.sin(a) * rad]);
  }
  pixelShape(ctx, cx, cy, r, 2, (dx, dy) => (inside(pts, dx, dy) ? "#FFFFFF" : null));
}

function inside(poly: [number, number][], x: number, y: number): boolean {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]!;
    const [xj, yj] = poly[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

export const breakerArtGame: ArcadeGame<BrkState, ArcadeInputEvent | null> = { ...breakerGame, draw };
