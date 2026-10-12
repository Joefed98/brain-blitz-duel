import { successHud, successFrame, SUCCESS_ACCENTS } from "./success.renderer";
import { drawArtSprite } from "./sprites.renderer";
import { arcadeFx } from "./arcadeFx.renderer";
import { BREAKER_FX } from "./arcadeFxGames.renderer";
import {
  breakerGame,
  breakerGameFor,
  brkDestroyed,
  brkRowOffset,
  BRK_FIRE_TICKS,
  BRK_POWER_FIRE,
  BRK_REV,
  BRK_ROWS,
  BRK_SLIDE_AMP,
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
import { artCanvas, artContext, type ArtCanvas } from "./cache.renderer";
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

const PADDLE = "#FFD84A";
const LASER = "#B4FF9A";
const RAINBOW = [
  "#FF3B5C", // Red
  "#FF8A3C", // Orange
  "#FFD84A", // Gold
  "#B4FF9A", // Lime
  "#3DFFE0", // Cyan
  "#5CD0FF", // Blue
  "#C59CFF", // Violet
];
/** brkRev 2 Fireball: flame orange. */
const FIRE = "#FF6A2B";
const powerColour = (power: number): string =>
  power === BRK_POWER_LASER ? LASER : power === BRK_POWER_FIRE ? FIRE : BRK_POWER_COLOURS[power] ?? PADDLE;
/** Capsule text says what it holds: ×2 balls, ×5 (×3 on brkRev 2) shots, L laser; the Fireball draws a flame. */
function capsuleLabel(state: BrkState, kind: number): string {
  if (kind === BRK_POWER_MULTI) return "x2";
  if (kind === BRK_POWER_SPAM) return state.rev === BRK_REV ? "x3" : "x5";
  return "L";
}
/** A small pixel flame centred on (cx, cy), inside a 10 × 10 box. */
function pixelFlame(ctx: CanvasRenderingContext2D, cx: number, cy: number, colour: string): void {
  const rows = ["..X..", ".XX..", ".XXX.", "XXXX.", "XX.XX", ".XXX."];
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) if (row[x] === "X") pixelRect(ctx, cx - 5 + x * 2, cy - 6 + y * 2, 2, 2, colour);
  });
}
const BURST_MS = 320;

const memo = new WeakMap<CanvasRenderingContext2D, { tick: number; bricks: number[]; deaths: { index: number; at: number }[] }>();

/** Cache for brick sprites: keyed by color + power + HP taken. */
const brickCache = new Map<string, ArtCanvas>();
function getBrickSprite(colour: string, power: number, taken: number, bloom: number): ArtCanvas | undefined {
  const key = `${colour}-${power}-${taken}-${bloom > 0}`;
  const cached = brickCache.get(key);
  if (cached) return cached;
  const canvas = artCanvas(BRK_BRICK_W, BRK_BRICK_H);
  const ctx = canvas && (artContext(canvas) as CanvasRenderingContext2D | null);
  if (!canvas || !ctx) return undefined;

  if (power >= 0) {
    // Dark brick, metal outline, white pixel star.
    pixelRect(ctx, 1, 0, BRK_BRICK_W - 2, BRK_BRICK_H, "#101018");
    pixelRect(ctx, 1, 0, BRK_BRICK_W - 2, 2, colour, bloom);
    pixelRect(ctx, 1, BRK_BRICK_H - 2, BRK_BRICK_W - 2, 2, colour);
    pixelRect(ctx, 1, 0, 2, BRK_BRICK_H, colour);
    pixelRect(ctx, BRK_BRICK_W - 3, 0, 2, BRK_BRICK_H, colour);
    pixelStar(ctx, BRK_BRICK_W / 2, BRK_BRICK_H / 2);
  } else {
    // Neon brick with bevel highlights.
    pixelRect(ctx, 1, 0, BRK_BRICK_W - 2, BRK_BRICK_H, colour, bloom);
    // Bevel: lighter top/left, darker bottom/right.
    pixelRect(ctx, 1, 0, BRK_BRICK_W - 2, 2, "rgba(255,255,255,0.35)");
    pixelRect(ctx, 1, 0, 2, BRK_BRICK_H, "rgba(255,255,255,0.35)");
    pixelRect(ctx, 1, BRK_BRICK_H - 2, BRK_BRICK_W - 2, 2, "rgba(0,0,0,0.35)");
    pixelRect(ctx, BRK_BRICK_W - 3, 0, 2, BRK_BRICK_H, "rgba(0,0,0,0.35)");
    // Pixel cracks per hit taken.
    for (let c = 0; c < taken; c++) {
      const cx = 10 + c * 16;
      pixelRect(ctx, cx, 4, 2, 4, "#000000");
      pixelRect(ctx, cx + 2, 8, 2, 4, "#000000");
      pixelRect(ctx, cx, 12, 2, 4, "#000000");
    }
  }
  brickCache.set(key, canvas);
  return canvas;
}

function draw(ctx: CanvasRenderingContext2D, state: BrkState, size: CanvasSize): void {
  retroScreen(ctx, size, BRK_WORLD_W, BRK_WORLD_H, "stretch", (c) => arcadeFx(c, BREAKER_FX, state, () => drawWorld(c, state, ctx)));
}

/** A brick's top-left in world px; brkRev 2 sliding rows carry their sim offset at the drawn tick. */
function brickXY(index: number, state?: BrkState) {
  const row = Math.trunc(index / BRK_COLS);
  return {
    x: BRK_WALL_X + (index % BRK_COLS) * BRK_BRICK_W + (state ? brkRowOffset(state, row, state.tick) : 0),
    y: BRK_WALL_Y + row * BRK_ROW_PITCH,
  };
}

function brickColour(state: BrkState, index: number, left: number): string {
  const power = (state.gold[index] ?? 0) - 1;
  if (power >= 0) return powerColour(power);
  const row = Math.trunc(index / BRK_COLS);
  return RAINBOW[row % RAINBOW.length] ?? PADDLE;
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
  // Previous HP remains available until hit effects have observed it.
  memo.set(key, m);

  const wallColour = "#2A4A7A";
  pixelRect(ctx, BRK_WALL - 2, BRK_HUD_H + BRK_WALL - 2, BRK_WORLD_W - 2 * BRK_WALL + 4, 2, wallColour);
  pixelRect(ctx, BRK_WALL - 2, BRK_HUD_H + BRK_WALL - 2, 2, BRK_WORLD_H, wallColour);
  pixelRect(ctx, BRK_WORLD_W - BRK_WALL, BRK_HUD_H + BRK_WALL - 2, 2, BRK_WORLD_H, wallColour);

  // brkRev 2: a faint rail under each sliding row, end stops at its full sweep; bricks clip at the walls.
  for (const row of state.slide ?? []) {
    const y = BRK_WALL_Y + row * BRK_ROW_PITCH + BRK_BRICK_H + 1;
    pixelRect(ctx, BRK_WALL, y, BRK_WORLD_W - 2 * BRK_WALL, 2, "rgba(255,255,255,0.12)");
    for (const x of [BRK_WALL_X - BRK_SLIDE_AMP, BRK_WORLD_W - BRK_WALL_X + BRK_SLIDE_AMP - 2])
      if (x >= BRK_WALL && x <= BRK_WORLD_W - BRK_WALL - 2) pixelRect(ctx, x, y - 2, 2, 4, "rgba(255,255,255,0.3)");
  }
  ctx.save();
  if (state.slide) {
    ctx.beginPath();
    ctx.rect(BRK_WALL, BRK_HUD_H + BRK_WALL, BRK_WORLD_W - 2 * BRK_WALL, BRK_WORLD_H);
    ctx.clip();
  }
  state.bricks.forEach((left, index) => {
    if (left <= 0) return;
    const { x, y } = brickXY(index, state);
    const power = (state.gold[index] ?? 0) - 1;
    const colour = brickColour(state, index, left);
    const taken = (state.maxHp[index] ?? 1) - left;
    const b = power >= 0 ? bloom : (left === 1 ? bloom * 0.6 : 0);
    const sprite = getBrickSprite(colour, power, taken, b);
    if (sprite) {
      ctx.drawImage(sprite, x, y);
    }
    if (power === BRK_POWER_FIRE) pixelFlame(ctx, x + BRK_BRICK_W / 2, y + BRK_BRICK_H / 2 + 1, FIRE);
  });
  ctx.restore();

  for (const d of m.deaths) {
    const { x, y } = brickXY(d.index, state);
    const colour = brickColour(state, d.index, state.maxHp[d.index] ?? 1);
    retroBurst(ctx, x + BRK_BRICK_W / 2, y + BRK_BRICK_H / 2, (now - d.at) / BURST_MS, colour, 16);
  }

  if (state.beam > 0 && state.beamTop !== undefined) {
    // brkRev 2: a single beam from the paddle centre up to the last brick it struck.
    const x = state.beamX ?? state.paddleX;
    const top = state.beamTop;
    for (const dx of [-5, 0, 5]) pixelRect(ctx, x + dx - 1, top, 2, BRK_PADDLE_Y - top, LASER, bloom);
  } else if (state.beam > 0) {
    const col = brkPaddleColumn(state.paddleX);
    const left = BRK_WALL_X + col * BRK_BRICK_W + 6;
    const width = BRK_BRICK_W - 12;
    for (const f of [0.2, 0.5, 0.8]) {
      pixelRect(ctx, left + width * f - 1, BRK_WALL_Y, 2, BRK_PADDLE_Y - BRK_WALL_Y, LASER, bloom);
    }
  }

  for (const capsule of state.capsules) {
    const colour = powerColour(capsule.kind);
    const cx = px(capsule.x);
    const cy = px(capsule.y);
    pixelRect(ctx, cx - BRK_CAPSULE_W / 2, cy - BRK_CAPSULE_H / 2, BRK_CAPSULE_W, BRK_CAPSULE_H, colour, bloom);
    if (capsule.kind === BRK_POWER_FIRE) {
      // Fireball capsule: dark-red body, flame on it, pulsing rim.
      pixelRect(ctx, cx - BRK_CAPSULE_W / 2 + 2, cy - BRK_CAPSULE_H / 2 + 2, BRK_CAPSULE_W - 4, BRK_CAPSULE_H - 4, "#5A1206");
      pixelFlame(ctx, cx, cy + 1, "#FFD84A");
      continue;
    }
    retroText(ctx, capsuleLabel(state, capsule.kind), cx, cy - 3, 7, "#000000", "center");
  }

  const changed=state.bricks.findIndex((hp,i)=>hp<(m.bricks[i]??hp));
  const hitPoint=changed>=0?brickXY(changed):brickXY(m.deaths.at(-1)?.index??0);
  const reward=successFrame(ctx,{id:'breaker',tick:state.tick,count:state.hits,misses:state.losses,colour:PADDLE,width:BRK_WORLD_W,height:BRK_WORLD_H,point:{x:hitPoint.x+BRK_BRICK_W/2,y:hitPoint.y+BRK_BRICK_H/2,shape:'pixel'},hud:{x:14,y:26,text:`BRICKS ${brkDestroyed(state)}/${BRK_BRICKS}`}});
  if(reward.chain>=10){ctx.save();ctx.globalAlpha=.3;ctx.strokeStyle=PADDLE;ctx.lineWidth=3;ctx.strokeRect(state.paddleX-BRK_PADDLE_W/2-2,BRK_PADDLE_Y-2,BRK_PADDLE_W+4,BRK_PADDLE_H+4);ctx.restore();}
  // Art pilot (Retro): the paddle sprite fills the collision rectangle; code art when absent.
  if (!drawArtSprite(ctx, "retro", "paddle", state.paddleX - BRK_PADDLE_W / 2, BRK_PADDLE_Y, BRK_PADDLE_W, BRK_PADDLE_H)) retroPaddle(ctx, state.paddleX - BRK_PADDLE_W / 2, BRK_PADDLE_Y, BRK_PADDLE_W, BRK_PADDLE_H, PADDLE, "#5A4510", bloom);

  state.balls.forEach((ball, i) => {
    const bx = px(ball.x);
    const by = px(ball.y);
    const burning = (state.fire ?? 0) > 0 && state.pause === 0;
    const colour = state.pause > 0 ? "rgba(255,216,74,0.45)" : burning ? FIRE : ball.spam === 1 ? PADDLE : "#BFF6FF";
    if (state.pause === 0) drawRetroTrail(ctx, retroTrail(key, state.tick, `b${i}`, bx, by, 6), BRK_BALL_R, colour);
    retroBall(ctx, bx, by, BRK_BALL_R, colour, state.pause > 0 ? colour : RETRO_WHITE);
  });

  m.bricks = state.bricks.slice();
  if (state.held > 0) {
    const laser = state.held === BRK_POWER_LASER + 1;
    retroText(
      ctx,
      laser ? "TAP TO FIRE LASER" : `TAP TO FIRE x${state.charges}`,
      BRK_WORLD_W / 2,
      BRK_PADDLE_Y + BRK_PADDLE_H + 16,
      15,
      laser ? LASER : powerColour(BRK_POWER_SPAM),
      "center",
    );
  }

  successHud(ctx,'breaker',state.tick,14,26,()=>{retroReadout(ctx, 14, 8, `BRICKS ${brkDestroyed(state)}/${BRK_BRICKS}`, RETRO_WHITE);});
  if ((state.fire ?? 0) > 0) {
    const fire = state.fire ?? 0;
    retroText(ctx, `FIREBALL ${Math.ceil(fire / 60)}`, BRK_WORLD_W - 14, 10, 12, FIRE, "right");
    // The bar empties over the Fireball's 5 s.
    pixelRect(ctx, BRK_WORLD_W - 110, 26, Math.round((96 * fire) / BRK_FIRE_TICKS), 3, FIRE);
  }
  if (state.pause > 0) retroText(ctx, "RELAUNCHING", BRK_WORLD_W / 2, BRK_PADDLE_Y - 40, 16, PADDLE, "center");
}

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
const breakerArtGameV2: ArcadeGame<BrkState, ArcadeInputEvent | null> = { ...breakerGameFor(BRK_REV), draw };
/** The art game for a stored brkRev; one cached object per revision. */
export function breakerArtGameFor(rev?: number | null): ArcadeGame<BrkState, ArcadeInputEvent | null> {
  return rev === BRK_REV ? breakerArtGameV2 : breakerArtGame;
}
