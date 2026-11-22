import { successHud, successFrame, SUCCESS_ACCENTS } from "./success.renderer";
import { countUp, fxCrack, fxFlash, fxSparks, retroEndAge, retroFx, retroPayoffBanner, type RetroFx } from "./retroFx.renderer";
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
  BRK_REV_STD,
  BRK_REV_CLEAR,
  brkAllDestroyed,
  brkGoldDealt,
  BRK_V9_SKILL_MAX,
  brkCols,
  brkIsGold,
  brkSkillPaid,
  brkWallSize,
  brkWallXOf,
  brkWorldW,
  type BrkState,
  breakerStdParts,
  brkPaddleWOf,
} from "./breaker";
import { px, type ArcadeGame, type ArcadeInputEvent, type CanvasSize } from "./engine";
import { artCanvas, artContext, type ArtCanvas } from "./cache.renderer";
import {
  drawRetroTrail,
  pixelRect,
  pixelShape,
  retroBall,
  retroMix,
  retroBloom,
  retroBurst,
  retroPaddle,
  retroHud,
  type RetroHudItem,
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
      else if (ch === "f") pixelRect(ctx, x0 + x * 2, y0 + y * 2, 2, 2, FIRE);
      else if (ch === "y") pixelRect(ctx, x0 + x * 2, y0 + y * 2, 2, 2, "#FFD84A");
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
/**
 * A burning ball streaking left, its flames trailing behind (white-hot core, gold, then fire): the Fireball brick's own
 * symbol (the Retro overhaul, 15 Nov 2026, Joe: "the Fireball needs its own"; it used to keep the plain star with a
 * flame over it).
 */
const SYMBOL_FIRE = [
  "........ff.yy....",
  "....ff.fyyyXXX...",
  "..ffffyyyXXXXXX..",
  "ffffyyyyXXXXXXX..",
  "..ffffyyyXXXXXX..",
  "....ff.fyyyXXX...",
  "........ff.yy....",
] as const;
/** The symbol for a power-up brick (every power has one since the Retro overhaul). */
function powerSymbol(ctx: CanvasRenderingContext2D, power: number, colour: string): boolean {
  if (power === BRK_POWER_MULTI) pixelPattern(ctx, SYMBOL_MULTI, colour);
  else if (power === BRK_POWER_SPAM) pixelPattern(ctx, SYMBOL_SPAM, colour);
  else if (power === BRK_POWER_LASER) pixelPattern(ctx, SYMBOL_LASER, colour);
  else if (power === BRK_POWER_FIRE) pixelPattern(ctx, SYMBOL_FIRE, colour);
  else return false;
  return true;
}

/**
 * A falling capsule's icon (the Retro overhaul, 15 Nov 2026): the brick's symbol in 1 px blocks, dark on the capsule's
 * colour, inside its 16 × 10 pill (it used to print 7 px letters, under the Retro 11 px text floor).
 */
const CAPSULE_ICONS: Record<number, readonly string[]> = {
  [BRK_POWER_MULTI]: ["..XX....XX..", ".XXXX..XXXX.", ".XXXX..XXXX.", "..XX....XX.."],
  [BRK_POWER_SPAM]: [".XX..XX..XX.", ".XX..XX..XX.", "............", ".X...X...X..", ".X...X...X.."],
  [BRK_POWER_LASER]: [".....XX.....", ".....XX.....", ".....XX.....", "...XXXXXX...", "..XXXXXXXX.."],
  [BRK_POWER_FIRE]: ["......yXX...", "..f.yyXXXX..", "ffyyyXXXXX..", "..f.yyXXXX..", "......yXX..."],
};
function drawCapsuleIcon(ctx: CanvasRenderingContext2D, kind: number, cx: number, cy: number): void {
  const rows = CAPSULE_ICONS[kind];
  if (!rows) return;
  const x0 = Math.round(cx - rows[0]!.length / 2);
  const y0 = Math.round(cy - rows.length / 2);
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === ".") continue;
      ctx.fillStyle = ch === "X" ? (kind === BRK_POWER_FIRE ? "#FFFFFF" : "#0A0A12") : ch === "y" ? "#FFD84A" : "#FF6A2A";
      ctx.fillRect(x0 + x, y0 + y, 1, 1);
    }
  });
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
    // Dark brick, an outline in its power's colour, the symbol (the polish plan's C1.2: the old flat brick, Joe, 20 Nov 2026).
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
      // Stage 2 of the Retro overhaul: every revision's gold brick shows its cracks deepening hit by hit.
      drawGoldBrick(ctx, x, y, glint, bloom, taken);
      return;
    }
    const sprite = getBrickSprite(colour, power, taken, b, true);
    if (sprite) {
      ctx.drawImage(sprite, x, y);
    }
    // Stage 2: a tough brick hit but not broken shows a crack, deeper for each hit taken (its state at a glance).
    if (taken > 0 && power < 0) fxCrack(ctx, x + 2, y + 2, BRK_BRICK_W - 4, BRK_BRICK_H - 4, taken, index * 7 + 3, "rgba(0,0,0,0.55)");
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
      // Fireball capsule: a dark-red body under the burning ball.
      pixelRect(ctx, cx - BRK_CAPSULE_W / 2 + 2, cy - BRK_CAPSULE_H / 2 + 2, BRK_CAPSULE_W - 4, BRK_CAPSULE_H - 4, "#5A1206");
    }
    // A highlight along the pill's top edge (the lit-material pass), then its icon.
    pixelRect(ctx, cx - BRK_CAPSULE_W / 2 + 2, cy - BRK_CAPSULE_H / 2, BRK_CAPSULE_W - 4, 1, "rgba(255,255,255,0.55)");
    drawCapsuleIcon(ctx, capsule.kind, cx, cy);
  }

  const changed=state.bricks.findIndex((hp,i)=>hp<(m.bricks[i]??hp));
  const hitPoint=changed>=0?brickXY(changed,state,false):brickXY(m.deaths.at(-1)?.index??0,state,false);
  const reward=successFrame(ctx,{id:'breaker',tick:state.tick,count:state.hits,misses:state.losses,colour:PADDLE,width:BRK_WORLD_W,height:BRK_WORLD_H,point:{x:hitPoint.x+BRK_BRICK_W/2,y:hitPoint.y+BRK_BRICK_H/2,shape:'pixel'},hud:{x:14,y:26,text:brkHudBricks(state)}});
  if(reward.chain>=10){ctx.save();ctx.globalAlpha=.3;ctx.strokeStyle=PADDLE;ctx.lineWidth=3;ctx.strokeRect(state.paddleX-brkPaddleWOf(state)/2-2,BRK_PADDLE_Y-2,brkPaddleWOf(state)+4,BRK_PADDLE_H+4);ctx.restore();}
  // Polish A1: the paddle's gold light.
  glow(ctx, PADDLE, state.paddleX, BRK_PADDLE_Y + BRK_PADDLE_H / 2, brkPaddleWOf(state) / 2 + 18, 16, 0.42);
  // Art pilot (Retro): the paddle sprite fills the collision rectangle; code art when absent.
  // Stage 2: the paddle dips 2 px as a ball comes off it (breakerEffects logs the hit), back over 6 ticks.
  const fx = breakerEffects(ctx, state, m.bricks, BRK_PADDLE_Y);
  const dipped = fx.latest("paddle", 6);
  const dip = dipped && !fx.still ? Math.round(2 * (1 - dipped.age)) : 0;
  if (!drawArtSprite(ctx, "retro", "paddle", state.paddleX - brkPaddleWOf(state) / 2, BRK_PADDLE_Y + dip, brkPaddleWOf(state), BRK_PADDLE_H)) retroPaddle(ctx, state.paddleX - brkPaddleWOf(state) / 2, BRK_PADDLE_Y + dip, brkPaddleWOf(state), BRK_PADDLE_H, PADDLE, "#5A4510", bloom);
  drawBreakerEffects(ctx, fx, state, BRK_PADDLE_Y);

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

  // One Retro HUD (3 Nov 2026): bricks top left, the gold bricks (or brkRev 9's skill) and a live Fireball's
  // seconds top right. No "1UP" (it overlapped BRICKS).
  const fire = state.fire ?? 0;
  retroHud(
    ctx,
    brkWorldW(state),
    { text: brkHudBricks(state) },
    [state.deep ? brkDeepHudItem(state) : null, fire > 0 ? { text: `FIREBALL ${Math.ceil(fire / 60)}`, colour: FIRE } : null],
    { wrapMain: (draw) => successHud(ctx, "breaker", state.tick, 12, 8, draw) },
  );
  // Stage 2: the relaunch counts down on the paddle (3, 2, 1).
  if (state.pause > 0) {
    retroText(ctx, "RELAUNCH", BRK_WORLD_W / 2, BRK_PADDLE_Y - 64, 14, PADDLE, "center");
    retroText(ctx, String(Math.max(1, Math.ceil(state.pause / 60))), state.paddleX, BRK_PADDLE_Y - 36, 24, RETRO_WHITE, "center", 4);
  }
  if (state.deep) drawDeepHud(ctx, state, key);
  // Stage 3 of the Retro overhaul: the wall cleared (the shared layer says WALL CLEARED!), TIME BONUS and the time left turning into speed points (the
  // round-end payoff, on the presentation clock while the stage holds the submit; display only). brkRev 11+ only (the
  // standard's speed part); older clears show the banner alone.
  const clearAge = retroEndAge(key, "breaker-clear", state.cleared, state.tick);
  if (clearAge !== null) {
    const speed = state.std ? breakerStdParts(state).speed : 0;
    retroPayoffBanner(ctx, brkWorldW(state), BRK_PADDLE_Y * 0.56, "TIME BONUS", speed > 0 ? `SPEED +${countUp(speed, clearAge)}` : "", clearAge);
    if (!reducedMotion()) {
      const fx = retroFx(ctx, "breaker-clear", state.tick);
      fxSparks(fx, ctx, brkWorldW(state) / 2, BRK_PADDLE_Y * 0.42, Math.min(0.99, clearAge / 900), GOLD, { n: 16, spread: 90, seed: 7 });
    }
  }
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

/** The HUD's bricks readout: the wall (brkRev 9–10: of 105), or every brick, gold included, on brkRev 11 (of 108, what its core counts). */
function brkHudBricks(state: BrkState): string {
  if (state.std) return `BRICKS ${brkAllDestroyed(state)}/${state.bricks.length}`;
  return `BRICKS ${brkDestroyed(state)}/${brkWallSize(state)}`;
}

/** The HUD's top-right count: brkRev 11's gold bricks broken, brkRev 9–10's skill points. */
function brkDeepHudItem(state: BrkState): RetroHudItem {
  if (state.std) {
    const dealt = brkGoldDealt(state);
    const broken = Math.min(dealt, state.goldBroken ?? 0);
    return { text: `GOLD ${broken}/${dealt}`, colour: broken >= dealt ? RETRO_WHITE : GOLD };
  }
  const skill = brkSkillPaid(state);
  return { text: `SKILL ${skill}/${BRK_V9_SKILL_MAX}`, colour: skill >= BRK_V9_SKILL_MAX ? RETRO_WHITE : GOLD };
}

/** brkRev 9's HUD: the skill points (top right); brkRev 11's gold bricks broken (its skill pay is gone). */
const clinkMemo = new WeakMap<CanvasRenderingContext2D, { clinks: number; at: number; tick: number }>();
function drawDeepHud(ctx: CanvasRenderingContext2D, state: BrkState, key: CanvasRenderingContext2D): void {
  // The gold (or skill) count is drawn by the shared Retro HUD (brkDeepHudItem).
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
const breakerArtGameStd: ArcadeGame<BrkState, ArcadeInputEvent | null> = { ...breakerGameFor(BRK_REV_STD), draw };
/** brkRev 12 (the Retro overhaul): the 9-row wall, drawn by the same art. */
const breakerArtGameClear: ArcadeGame<BrkState, ArcadeInputEvent | null> = { ...breakerGameFor(BRK_REV_CLEAR), draw };
/** The art game for a stored brkRev; one cached object per revision. */
export function breakerArtGameFor(rev?: number | null): ArcadeGame<BrkState, ArcadeInputEvent | null> {
  if (rev === BRK_REV_CLEAR) return breakerArtGameClear;
  if (rev === BRK_REV_STD) return breakerArtGameStd;
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

/**
 * Breaker's in-world moments (the Retro overhaul, stage 2; display only, retroFx.renderer.ts): logs a paddle hit (a ball
 * near the paddle turning from falling to rising), each brick hit that didn't break it, and a caught power-up (with the
 * kind of the capsule that was lowest a frame before). Read before the frame's brick memory moves on.
 */
function breakerEffects(ctx: CanvasRenderingContext2D, state: BrkState, before: readonly number[], paddleY: number) {
  const fx = retroFx(ctx, "breaker", state.tick);
  state.balls.forEach((ball, i) => {
    const vy = fx.get(`vy${i}`, ball.vy);
    if (vy > 0 && ball.vy < 0 && ball.y > (paddleY - 40) * 256) fx.log("paddle", { x: ball.x / 256, y: paddleY, n: i });
    fx.set(`vy${i}`, ball.vy);
  });
  for (let i = 0; i < state.bricks.length; i++) {
    const was = before[i] ?? 0;
    const now = state.bricks[i] ?? 0;
    if (now > 0 && now < was) {
      const { x, y } = brickXY(i, state);
      fx.log(brkIsGold(state, i) ? "gold" : "hit", { x, y, n: i });
    }
  }
  fx.rise("caught", state.powerUps, () => ({ x: state.paddleX, y: paddleY, n: fx.get("lowKind", BRK_POWER_MULTI) }));
  let lowest = -1;
  let lowY = -Infinity;
  for (const c of state.capsules) if (c.y > lowY) { lowY = c.y; lowest = c.kind; }
  if (lowest >= 0) fx.set("lowKind", lowest);
  return fx;
}

function drawBreakerEffects(ctx: CanvasRenderingContext2D, fx: RetroFx, state: BrkState, paddleY: number): void {
  // A tough brick's white flash and a gold brick's brighter one with sparks.
  fx.each("hit", 8, (e, age) => {
    const { x, y } = brickXY(e.n, state);
    fxFlash(ctx, x + 1, y, BRK_BRICK_W - 2, BRK_BRICK_H, age, "#FFFFFF", 0.7);
  });
  fx.each("gold", 14, (e, age) => {
    const { x, y } = brickXY(e.n, state);
    fxFlash(ctx, x + 1, y, BRK_BRICK_W - 2, BRK_BRICK_H, age, "#FFF4C2", 0.8);
    fxSparks(fx, ctx, x + BRK_BRICK_W / 2, y + BRK_BRICK_H, age, GOLD, { n: 6, spread: 12, seed: e.n });
  });
  // A paddle hit: a short spark where the ball struck.
  fx.each("paddle", 10, (e, age) => fxSparks(fx, ctx, e.x, paddleY, age, PADDLE, { n: 5, spread: 9, seed: e.tick, up: true }));
  // A caught power-up pops up over the paddle as its icon, twice size, rising and fading.
  fx.each("caught", 40, (e, age) => {
    const lift = fx.still ? 20 : 14 + 26 * age;
    ctx.save();
    ctx.globalAlpha = age < 0.7 ? 1 : 1 - (age - 0.7) / 0.3;
    ctx.translate(Math.round(state.paddleX), Math.round(paddleY - lift));
    ctx.scale(2, 2);
    pixelRect(ctx, -BRK_CAPSULE_W / 2, -BRK_CAPSULE_H / 2, BRK_CAPSULE_W, BRK_CAPSULE_H, powerColour(e.n));
    drawCapsuleIcon(ctx, e.n, 0, 0);
    ctx.restore();
  });
}
