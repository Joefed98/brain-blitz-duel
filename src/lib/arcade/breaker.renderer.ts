import { successHud, successFrame, SUCCESS_ACCENTS } from "./success.renderer";
import { drawArtSprite } from "./sprites.renderer";
import { reducedMotion } from "./art.renderer";
import { arcadeReducedEffects } from "@/lib/fx/lowEnd";
import { arcadeFx } from "./arcadeFx.renderer";
import { breakerFxFor } from "./arcadeFxGames.renderer";
import {
  breakerGame,
  breakerGameFor,
  brkDestroyed,
  brkRowOffset,
  brkFireTicks,
  BRK_REV_TUNED,
  BRK_REV_TUNEF,
  BRK_POWER_FIRE,
  BRK_REV,
  BRK_REV_BAND,
  BRK_ROWS,
  BRK_SLIDE_AMP,
  brkPaddleColumn,
  BRK_BALL_R,
  BRK_BRICK_H,
  BRK_BRICK_W,
  BRK_BRICKS,
  BRK_CAPSULE_H,
  BRK_CAPSULE_W,
  BRK_HUD_H,
  BRK_PADDLE_H,
  BRK_PADDLE_W,
  brkPaddleY,
  brkWorldH,
  BRK_POWER_COLOURS,
  BRK_POWER_LASER,
  BRK_POWER_MULTI,
  BRK_POWER_SPAM,
  BRK_ROW_PITCH,
  BRK_WALL,
  BRK_WALL_X,
  BRK_WALL_Y,
  BRK_REV_TALL, BRK_REV_TARGET, BRK_REV_STRICT,
  BRK_WORLD_W,
  BRK_REV_DEEP,
  BRK_REV_PHONE,
  BRK_V9_SKILL_MAX,
  brkCols,
  brkIsGold,
  brkSkillPaid,
  brkWallSize,
  brkWallXOf,
  brkWorldW,
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
import { addShatter, backdrop, clearPops, blob, drawPops, glow, linear, pixelStars } from "./polishA1.renderer";

export const PADDLE = "#FFD84A";
const LASER = "#B4FF9A";
export const RAINBOW = [
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

/** Draws a 2 px pixel-art pattern (X white, o the brick's colour) centred on the 44 × 20 brick. */
function pixelPattern(ctx: CanvasRenderingContext2D, rows: readonly string[], colour: string): void {
  const w = (rows[0]?.length ?? 0) * 2;
  const h = rows.length * 2;
  const x0 = Math.round((BRK_BRICK_W - w) / 2);
  const y0 = Math.round((BRK_BRICK_H - h) / 2);
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === "X") pixelRect(ctx, x0 + x * 2, y0 + y * 2, 2, 2, "#FFFFFF");
      else if (ch === "o") pixelRect(ctx, x0 + x * 2, y0 + y * 2, 2, 2, colour);
    }
  });
}
/** Two balls flying apart: the double-ball brick. */
const SYMBOL_MULTI = [
  "..XXX.......XXX..",
  ".XXXXX.....XXXXX.",
  "XXXXXXX...XXXXXXX",
  "XXXXXXX...XXXXXXX",
  "XXXXXXX...XXXXXXX",
  ".XXXXX.....XXXXX.",
  "..XXX.......XXX..",
] as const;
/** Three small balls rising on their trails: the ×3 (×5 on the original board) shots brick. */
const SYMBOL_SPAM = [
  ".XX....XX....XX.",
  "XXXX..XXXX..XXXX",
  "XXXX..XXXX..XXXX",
  ".XX....XX....XX.",
  ".oo....oo....oo.",
  "................",
  ".oo....oo....oo.",
] as const;
/** A beam (white core, green edges) rising from an emitter: the laser brick. */
const SYMBOL_LASER = [
  "..o.X.o..",
  "...oXo...",
  "...oXo...",
  "...oXo...",
  "...oXo...",
  "..XXXXX..",
  ".XXXXXXX.",
] as const;
/** The symbol for a power-up brick; false (the star stays) for the Fireball, which draws its flame over it. */
function powerSymbol(ctx: CanvasRenderingContext2D, power: number, colour: string): boolean {
  if (power === BRK_POWER_MULTI) pixelPattern(ctx, SYMBOL_MULTI, colour);
  else if (power === BRK_POWER_SPAM) pixelPattern(ctx, SYMBOL_SPAM, colour);
  else if (power === BRK_POWER_LASER) pixelPattern(ctx, SYMBOL_LASER, colour);
  else return false;
  return true;
}

const memo = new WeakMap<CanvasRenderingContext2D, { tick: number; bricks: number[]; deaths: { index: number; at: number }[] }>();

/** Cache for brick sprites: keyed by color + power + HP taken. */
const brickCache = new Map<string, ArtCanvas>();
export function getBrickSprite(colour: string, power: number, taken: number, bloom: number, symbol = false): ArtCanvas | undefined {
  const key = `${colour}-${power}-${taken}-${bloom > 0}-${symbol}`;
  const cached = brickCache.get(key);
  if (cached) return cached;
  const canvas = artCanvas(BRK_BRICK_W, BRK_BRICK_H);
  const ctx = canvas && (artContext(canvas) as CanvasRenderingContext2D | null);
  if (!canvas || !ctx) return undefined;
  paintBrick(ctx, colour, power, taken, bloom, symbol);
  brickCache.set(key, canvas);
  return canvas;
}

/**
 * A brick's art at (0, 0), BRK_BRICK_W × BRK_BRICK_H (the sprite above; the game icon paints it at its real size).
 * `symbol` (phone notes, 27 Oct 2026, display only): a power-up brick shows what it does instead of the plain star
 * (two balls for double-ball, three rising shots for ×3, a beam for the laser; the Fireball keeps its star and flame).
 * The game icon leaves it off, so its art is unchanged.
 */
export function paintBrick(ctx: CanvasRenderingContext2D, colour: string, power: number, taken: number, bloom: number, symbol = false): void {
  if (power >= 0) {
    // Dark brick, metal outline, white pixel star.
    pixelRect(ctx, 1, 0, BRK_BRICK_W - 2, BRK_BRICK_H, "#101018");
    pixelRect(ctx, 1, 0, BRK_BRICK_W - 2, 2, colour, bloom);
    pixelRect(ctx, 1, BRK_BRICK_H - 2, BRK_BRICK_W - 2, 2, colour);
    pixelRect(ctx, 1, 0, 2, BRK_BRICK_H, colour);
    pixelRect(ctx, BRK_BRICK_W - 3, 0, 2, BRK_BRICK_H, colour);
    if (!symbol || !powerSymbol(ctx, power, colour)) pixelStar(ctx, BRK_BRICK_W / 2, BRK_BRICK_H / 2);
  } else {
    // Neon brick with bevel highlights.
    pixelRect(ctx, 1, 0, BRK_BRICK_W - 2, BRK_BRICK_H, colour, bloom);
    // Polish A1: shaded in 2 px bands, light at the top and dark at the bottom, over the bevel.
    pixelRect(ctx, 1, 2, BRK_BRICK_W - 2, 4, "rgba(255,255,255,0.16)");
    pixelRect(ctx, 1, BRK_BRICK_H - 8, BRK_BRICK_W - 2, 2, "rgba(0,0,0,0.1)");
    pixelRect(ctx, 1, BRK_BRICK_H - 6, BRK_BRICK_W - 2, 2, "rgba(0,0,0,0.2)");
    pixelRect(ctx, 1, BRK_BRICK_H - 4, BRK_BRICK_W - 2, 2, "rgba(0,0,0,0.28)");
    // Bevel: lighter top/left, darker bottom/right.
    pixelRect(ctx, 1, 0, BRK_BRICK_W - 2, 2, "rgba(255,255,255,0.5)");
    pixelRect(ctx, 1, 0, 2, BRK_BRICK_H, "rgba(255,255,255,0.35)");
    pixelRect(ctx, 1, BRK_BRICK_H - 2, BRK_BRICK_W - 2, 2, "rgba(0,0,0,0.45)");
    pixelRect(ctx, BRK_BRICK_W - 3, 0, 2, BRK_BRICK_H, "rgba(0,0,0,0.35)");
    pixelRect(ctx, 5, 2, 6, 2, "rgba(255,255,255,0.7)");
    // Pixel cracks per hit taken.
    for (let c = 0; c < taken; c++) {
      const cx = 10 + c * 16;
      pixelRect(ctx, cx, 4, 2, 4, "#000000");
      pixelRect(ctx, cx + 2, 8, 2, 4, "#000000");
      pixelRect(ctx, cx, 12, 2, 4, "#000000");
    }
  }
}

function draw(ctx: CanvasRenderingContext2D, state: BrkState, size: CanvasSize): void {
  retroScreen(ctx, size, brkWorldW(state), brkWorldH(state), "stretch", (c) => arcadeFx(c, breakerFxFor(state), state, () => drawWorld(c, state, ctx)));
}

/** brkRev 9: gold bricks in the batch's metal gold (Polish A1 palette). */
const GOLD = "#FFD84A";
const GOLD_DEEP = "#B8860B";

/** A brick's top-left in world px; brkRev 2 sliding rows carry their sim offset at the drawn tick (`slide`). */
function brickXY(index: number, state: BrkState, slide = true) {
  const cols = brkCols(state);
  const row = Math.trunc(index / cols);
  return {
    x: brkWallXOf(state) + (index % cols) * BRK_BRICK_W + (slide ? brkRowOffset(state, row, state.tick) : 0),
    y: BRK_WALL_Y + row * BRK_ROW_PITCH,
  };
}


function brickColour(state: BrkState, index: number, left: number): string {
  if (brkIsGold(state, index)) return GOLD;
  const power = (state.gold[index] ?? 0) - 1;
  if (power >= 0) return powerColour(power);
  const row = Math.trunc(index / brkCols(state));
  return RAINBOW[row % RAINBOW.length] ?? PADDLE;
}

function drawWorld(ctx: CanvasRenderingContext2D, state: BrkState, key: CanvasRenderingContext2D): void {
  const now = typeof performance === "undefined" ? 0 : performance.now();
  const bloom = retroBloom();
  // brkRev 6: the taller court's height and paddle line (the original 620 / 548 otherwise).
  const BRK_WORLD_H = brkWorldH(state);
  const BRK_PADDLE_Y = brkPaddleY(state);
  // brkRev 9: the wider court and its bigger wall (390 and 80 otherwise).
  const BRK_WORLD_W = brkWorldW(state);
  const BRK_BRICKS = state.bricks.length;
  let m = memo.get(key);
  if (!m || state.tick < m.tick) {
    m = { tick: state.tick, bricks: state.bricks.slice(), deaths: [] };
    clearPops(key);
  }
  for (let i = 0; i < BRK_BRICKS; i++) {
    if ((m.bricks[i] ?? 0) > 0 && (state.bricks[i] ?? 0) <= 0) {
      m.deaths.push({ index: i, at: now });
      // Polish A1: a pixel shatter in the brick's colour and a "+10" where it broke (presentation only).
      const { x, y } = brickXY(i, state);
      const colour = brickColour(state, i, state.maxHp[i] ?? 1);
      const gild = brkIsGold(state, i);
      addShatter(key, x + BRK_BRICK_W / 2, y + BRK_BRICK_H / 2, gild ? [GOLD, RETRO_WHITE, "#FFF3B0", GOLD_DEEP] : [colour, RETRO_WHITE, colour, "#000000"], gild ? 16 : 10, gild ? 34 : 26);
      // Phone notes (27 Oct 2026, every revision, display only): no "+10" / "+10 ×2" / "GOLD +10" points pop here any
      // more; the shatter, burst, banners and sounds are unchanged.
    }
  }
  m.deaths = m.deaths.filter((d) => now - d.at < BURST_MS);
  m.tick = state.tick;
  // Previous HP remains available until hit effects have observed it.
  memo.set(key, m);
  backdrop(ctx, "breaker-navy", BRK_WORLD_W, BRK_WORLD_H, (c) => paintNavy(c, BRK_WORLD_H, BRK_WORLD_W));

  // The walls are real (the ball bounces off them): a soft edge, not a bright frame (17 Oct 2026, display only).
  const wallColour = "rgba(42,74,122,0.42)";
  pixelRect(ctx, BRK_WALL - 2, BRK_HUD_H + BRK_WALL - 2, BRK_WORLD_W - 2 * BRK_WALL + 4, 2, wallColour);
  pixelRect(ctx, BRK_WALL - 2, BRK_HUD_H + BRK_WALL - 2, 2, BRK_WORLD_H, wallColour);
  pixelRect(ctx, BRK_WORLD_W - BRK_WALL, BRK_HUD_H + BRK_WALL - 2, 2, BRK_WORLD_H, wallColour);

  // brkRev 2: a faint rail under each sliding row, end stops at its full sweep; bricks clip at the walls.
  for (const row of state.slide ?? []) {
    const y = BRK_WALL_Y + row * BRK_ROW_PITCH + BRK_BRICK_H + 1;
    pixelRect(ctx, BRK_WALL, y, BRK_WORLD_W - 2 * BRK_WALL, 2, "rgba(255,255,255,0.12)");
    for (const x of [brkWallXOf(state) - BRK_SLIDE_AMP, BRK_WORLD_W - brkWallXOf(state) + BRK_SLIDE_AMP - 2])
      if (x >= BRK_WALL && x <= BRK_WORLD_W - BRK_WALL - 2) pixelRect(ctx, x, y - 2, 2, 4, "rgba(255,255,255,0.3)");
  }
  ctx.save();
  if (state.slide) {
    ctx.beginPath();
    ctx.rect(BRK_WALL, BRK_HUD_H + BRK_WALL, BRK_WORLD_W - 2 * BRK_WALL, BRK_WORLD_H);
    ctx.clip();
  }
  // brkRev 9: gold bricks glint while a ball is on a direct line (it has touched nothing since the paddle).
  // brkRev 10: any hit counts, so there is no direct line to show; the gold brick shows its cracks instead.
  const glint = !!state.deep && !state.phone && state.pause === 0 && state.balls.some((b) => b.d === 1 && b.spam === 0) && (state.fire ?? 0) === 0;
  state.bricks.forEach((left, index) => {
    if (left <= 0) return;
    const { x, y } = brickXY(index, state);
    const power = (state.gold[index] ?? 0) - 1;
    const colour = brickColour(state, index, left);
    const taken = (state.maxHp[index] ?? 1) - left;
    const b = power >= 0 ? bloom : (left === 1 ? bloom * 0.6 : 0);
    if (brkIsGold(state, index)) {
      drawGoldBrick(ctx, x, y, glint, bloom, state.phone ? taken : 0);
      return;
    }
    const sprite = getBrickSprite(colour, power, taken, b, true);
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
  const hitPoint=changed>=0?brickXY(changed,state,false):brickXY(m.deaths.at(-1)?.index??0,state,false);
  const reward=successFrame(ctx,{id:'breaker',tick:state.tick,count:state.hits,misses:state.losses,colour:PADDLE,width:BRK_WORLD_W,height:BRK_WORLD_H,point:{x:hitPoint.x+BRK_BRICK_W/2,y:hitPoint.y+BRK_BRICK_H/2,shape:'pixel'},hud:{x:14,y:26,text:`BRICKS ${brkDestroyed(state)}/${brkWallSize(state)}`}});
  if(reward.chain>=10){ctx.save();ctx.globalAlpha=.3;ctx.strokeStyle=PADDLE;ctx.lineWidth=3;ctx.strokeRect(state.paddleX-BRK_PADDLE_W/2-2,BRK_PADDLE_Y-2,BRK_PADDLE_W+4,BRK_PADDLE_H+4);ctx.restore();}
  // Polish A1: the paddle's gold light.
  glow(ctx, PADDLE, state.paddleX, BRK_PADDLE_Y + BRK_PADDLE_H / 2, BRK_PADDLE_W / 2 + 18, 16, 0.42);
  // Art pilot (Retro): the paddle sprite fills the collision rectangle; code art when absent.
  if (!drawArtSprite(ctx, "retro", "paddle", state.paddleX - BRK_PADDLE_W / 2, BRK_PADDLE_Y, BRK_PADDLE_W, BRK_PADDLE_H)) retroPaddle(ctx, state.paddleX - BRK_PADDLE_W / 2, BRK_PADDLE_Y, BRK_PADDLE_W, BRK_PADDLE_H, PADDLE, "#5A4510", bloom);

  state.balls.forEach((ball, i) => {
    const bx = px(ball.x);
    const by = px(ball.y);
    const burning = (state.fire ?? 0) > 0 && state.pause === 0;
    const colour = state.pause > 0 ? "rgba(255,216,74,0.45)" : burning ? FIRE : ball.spam === 1 ? PADDLE : "#BFF6FF";
    if (state.pause === 0) drawRetroTrail(ctx, retroTrail(key, state.tick, `b${i}`, bx, by, 6), BRK_BALL_R, colour);
    if (state.pause === 0) glow(ctx, burning ? FIRE : ball.spam === 1 ? PADDLE : "#9FEFFF", bx, by, BRK_BALL_R + 9, BRK_BALL_R + 9, 0.5);
    retroBall(ctx, bx, by, BRK_BALL_R, colour, state.pause > 0 ? colour : RETRO_WHITE);
  });

  m.bricks = state.bricks.slice();
  drawPops(ctx, key, BRK_WORLD_W);
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

  successHud(ctx,'breaker',state.tick,14,26,()=>{retroReadout(ctx, 14, 8, `BRICKS ${brkDestroyed(state)}/${brkWallSize(state)}`, RETRO_WHITE);});
  if ((state.fire ?? 0) > 0) {
    const fire = state.fire ?? 0;
    retroText(ctx, `FIREBALL ${Math.ceil(fire / 60)}`, BRK_WORLD_W - 14, 10, 12, FIRE, "right");
    // The bar empties over the Fireball's length (5 s; 3.5 s from brkRev 4; 2.5 s from brkRev 5).
    pixelRect(ctx, BRK_WORLD_W - 110, 26, Math.round((96 * fire) / brkFireTicks(state)), 3, FIRE);
  }
  if (state.pause > 0) retroText(ctx, "RELAUNCHING", BRK_WORLD_W / 2, BRK_PADDLE_Y - 40, 16, PADDLE, "center");
  if (state.deep) drawDeepHud(ctx, state, key);
}

/**
 * brkRev 9: a gold brick, 44 × 20 at (x, y), exactly its collision box: a dark bronze case with a gold frame,
 * a pixel gold ingot and two sparkles (the Polish A1 metal gold), a soft gold light, and a white glint that
 * sweeps it while a ball is on a direct line (presentation clock; reduced motion keeps the still shine).
 */
function drawGoldBrick(ctx: CanvasRenderingContext2D, x: number, y: number, glint: boolean, bloom: number, taken = 0): void {
  // A dark bronze case (so it never reads as a plain yellow brick), a gold ingot set in it, sparkles.
  pixelRect(ctx, x + 1, y, BRK_BRICK_W - 2, BRK_BRICK_H, "#2A1A00");
  pixelRect(ctx, x + 1, y, BRK_BRICK_W - 2, 2, GOLD, bloom);
  pixelRect(ctx, x + 1, y + BRK_BRICK_H - 2, BRK_BRICK_W - 2, 2, GOLD_DEEP);
  pixelRect(ctx, x + 1, y, 2, BRK_BRICK_H, GOLD);
  pixelRect(ctx, x + BRK_BRICK_W - 3, y, 2, BRK_BRICK_H, GOLD_DEEP);
  // The ingot: a trapezoid in bright gold with a lit top edge.
  pixelRect(ctx, x + 14, y + 5, 16, 2, "#FFF3B0");
  pixelRect(ctx, x + 12, y + 7, 20, 4, GOLD);
  pixelRect(ctx, x + 10, y + 11, 24, 4, "#E9B830");
  pixelRect(ctx, x + 10, y + 15, 24, 1, GOLD_DEEP);
  // Two fixed sparkles at the corners.
  for (const [sx, sy] of [[6, 4], [37, 13]] as const) {
    pixelRect(ctx, x + sx, y + sy - 2, 2, 6, "#FFF3B0");
    pixelRect(ctx, x + sx - 2, y + sy, 6, 2, "#FFF3B0");
  }
  if (glint && !reducedMotion() && !arcadeReducedEffects()) {
    const t = (typeof performance === "undefined" ? 0 : performance.now()) / 900;
    const gx = Math.floor((t % 1) * (BRK_BRICK_W + 12)) - 6;
    if (gx > 2 && gx < BRK_BRICK_W - 6) {
      pixelRect(ctx, x + gx, y + 2, 2, BRK_BRICK_H - 4, "rgba(255,255,255,0.75)");
      pixelRect(ctx, x + gx + 2, y + 4, 2, BRK_BRICK_H - 8, "rgba(255,255,255,0.4)");
    }
  }
  // brkRev 10: a dark pixel crack for each hit taken (of BRK_V10_GOLD_HITS), across the ingot.
  for (let c = 0; c < taken; c++) {
    const cx = x + 9 + c * 8;
    pixelRect(ctx, cx, y + 4, 2, 4, "#000000");
    pixelRect(ctx, cx + 2, y + 8, 2, 4, "#000000");
    pixelRect(ctx, cx, y + 12, 2, 4, "#000000");
  }
  glow(ctx, GOLD, x + BRK_BRICK_W / 2, y + BRK_BRICK_H / 2, BRK_BRICK_W * 0.75, BRK_BRICK_H, glint ? 0.45 : 0.18);
}

/** brkRev 9's HUD: the skill points (top right). */
const clinkMemo = new WeakMap<CanvasRenderingContext2D, { clinks: number; at: number; tick: number }>();
function drawDeepHud(ctx: CanvasRenderingContext2D, state: BrkState, key: CanvasRenderingContext2D): void {
  const W = brkWorldW(state);
  const skill = brkSkillPaid(state);
  // Right of the BRICKS readout, under the Fireball line and its bar.
  retroText(ctx, `SKILL ${skill}/${BRK_V9_SKILL_MAX}`, W - 14, 31, 11, skill >= BRK_V9_SKILL_MAX ? RETRO_WHITE : GOLD, "right");
  // The combo is no longer written above the paddle (Joe's phone notes, 28 Oct 2026): the chain still scores as before.
  // A ball bounced off gold (not a direct hit, or a Fireball, laser or ×3 shot): a short white ring on the presentation clock.
  const now = typeof performance === "undefined" ? 0 : performance.now();
  let memo2 = clinkMemo.get(key);
  if (!memo2 || state.tick < memo2.tick) memo2 = { clinks: state.clinks ?? 0, at: -1e9, tick: state.tick };
  if ((state.clinks ?? 0) > memo2.clinks) memo2.at = now;
  memo2.clinks = state.clinks ?? 0;
  memo2.tick = state.tick;
  clinkMemo.set(key, memo2);
  const age = now - memo2.at;
  if (age < 220 && !reducedMotion()) {
    for (let i = 0; i < state.bricks.length; i++) {
      if (!brkIsGold(state, i) || (state.bricks[i] ?? 0) <= 0) continue;
      const { x, y } = brickXY(i, state);
      ctx.save();
      ctx.globalAlpha = 0.6 * (1 - age / 220);
      ctx.strokeStyle = RETRO_WHITE;
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y - 1, BRK_BRICK_W, BRK_BRICK_H + 2);
      ctx.restore();
    }
  }
}

/**
 * Polish A1: Breaker's navy night, painted once per court height (backdrop): a navy gradient with
 * pixel stars and a soft glow along the walls; black at the court's bottom, where the screen fill's
 * pixel floor takes over.
 */
function paintNavy(c: CanvasRenderingContext2D, worldH: number, W = BRK_WORLD_W): void {
  c.fillStyle = linear(c, 0, 0, 0, worldH, [[0, "#071433"], [0.45, "#060F28"], [0.85, "#030817"], [1, "#010206"]]);
  c.fillRect(0, 0, W, worldH);
  blob(c, W * 0.5, worldH * 0.2, W * 0.7, "#1C3C8C", 0.3, 0.8);
  blob(c, W * 0.15, worldH * 0.6, W * 0.4, "#3A2A8C", 0.14, 1.4);
  pixelStars(c, BRK_WALL, BRK_HUD_H + BRK_WALL, W - 2 * BRK_WALL, worldH * 0.8, 110, 4242, ["#FFFFFF", "#BFD4FF", "#E6D8FF"], 0.75);
  // The frame: a soft blue light just inside the walls and the ceiling.
  const top = BRK_HUD_H + BRK_WALL;
  for (const [x, y, w, h, x0, y0, x1, y1] of [
    [BRK_WALL, top, W - 2 * BRK_WALL, 14, 0, top, 0, top + 14],
    [BRK_WALL, top, 14, worldH - top, BRK_WALL, 0, BRK_WALL + 14, 0],
    [W - BRK_WALL - 14, top, 14, worldH - top, W - BRK_WALL, 0, W - BRK_WALL - 14, 0],
  ] as const) {
    c.fillStyle = linear(c, x0, y0, x1, y1, [[0, "rgba(92,160,255,0.22)"], [1, "rgba(92,160,255,0)"]]);
    c.fillRect(x, y, w, h);
  }
  c.fillStyle = linear(c, 0, worldH - 40, 0, worldH, [[0, "rgba(0,0,0,0)"], [1, "rgba(0,0,0,0.9)"]]);
  c.fillRect(0, worldH - 40, W, 40);
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
const breakerArtGameBand: ArcadeGame<BrkState, ArcadeInputEvent | null> = { ...breakerGameFor(BRK_REV_BAND), draw };
const breakerArtGameTuned: ArcadeGame<BrkState, ArcadeInputEvent | null> = { ...breakerGameFor(BRK_REV_TUNED), draw };
const breakerArtGameTunef: ArcadeGame<BrkState, ArcadeInputEvent | null> = { ...breakerGameFor(BRK_REV_TUNEF), draw };
const breakerArtGameTall: ArcadeGame<BrkState, ArcadeInputEvent | null> = { ...breakerGameFor(BRK_REV_TALL), draw };
const breakerArtGameTarget: ArcadeGame<BrkState, ArcadeInputEvent | null> = { ...breakerGameFor(BRK_REV_TARGET), draw };
const breakerArtGameStrict: ArcadeGame<BrkState, ArcadeInputEvent | null> = { ...breakerGameFor(BRK_REV_STRICT), draw };
const breakerArtGameDeep: ArcadeGame<BrkState, ArcadeInputEvent | null> = { ...breakerGameFor(BRK_REV_DEEP), draw };
const breakerArtGamePhone: ArcadeGame<BrkState, ArcadeInputEvent | null> = { ...breakerGameFor(BRK_REV_PHONE), draw };
/** The art game for a stored brkRev; one cached object per revision. */
export function breakerArtGameFor(rev?: number | null): ArcadeGame<BrkState, ArcadeInputEvent | null> {
  if (rev === BRK_REV_PHONE) return breakerArtGamePhone;
  if (rev === BRK_REV_DEEP) return breakerArtGameDeep;
  if (rev === BRK_REV_STRICT) return breakerArtGameStrict;
  if (rev === BRK_REV_TARGET) return breakerArtGameTarget;
  if (rev === BRK_REV_TALL) return breakerArtGameTall;
  if (rev === BRK_REV_TUNEF) return breakerArtGameTunef;
  if (rev === BRK_REV_TUNED) return breakerArtGameTuned;
  if (rev === BRK_REV_BAND) return breakerArtGameBand;
  return rev === BRK_REV ? breakerArtGameV2 : breakerArtGame;
}
