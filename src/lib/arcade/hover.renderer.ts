import { successHud, successFrame } from "./success.renderer";
import { arcadeFx } from "./arcadeFx.renderer";
import { HOVER_FX } from "./arcadeFxGames.renderer";
import { reducedMotion } from './art.renderer';
/** Hover in the Retro Arcade world. Render only; the sim and its bounds are untouched. */
import {
  hoverGame,
  hoverGapTop,
  hoverScroll,
  hoverStarY,
  pillarX,
  HOVER_MOVE_AMP,
  HOVER_STAR_R,
  HOVER_DISC_R,
  HOVER_DISC_X,
  HOVER_IMPULSE,
  HOVER_PILLAR_W,
  HOVER_SCROLL_MAX,
  HOVER_SCROLL_START,
  HOVER_WORLD_H,
  HOVER_WORLD_W,
  type HoverState,
} from "./hover";
import type { ArcadeGame, CanvasSize } from "./engine";
import { artCanvas, artContext, type ArtCanvas } from "./cache.renderer";
import {
  pixelRect,
  pixelShape,
  retroBloom,
  retroClock,
  retroReadout,
  retroScreen,
  retroText,
  RETRO_RED,
  RETRO_WHITE,
} from "./retro.renderer";

const FP = 256;
const px = (v: number) => v / FP;
const BARRIER_CYCLES = ["#FF4DFF", "#3DFFE0", "#FFD84A", "#4BFF7A", "#FF9A3C", "#B49CFF"];
const SAUCER = "#FFD84A";
const SAUCER_DARK = "#B8901C";
const DOME = "#5CD0FF";
const barrierCache = new Map<string, ArtCanvas>();

/** Two finite, full-height raster columns; cropped without scaling to each collision box. */
function barrierSprite(w: number, colour: string): ArtCanvas | null {
  const cached = barrierCache.get(colour);
  if (cached) return cached;
  const layer = artCanvas(w * 2, HOVER_WORLD_H * 2);
  const c = layer && artContext(layer);
  if (!layer || !c) return null;
  c.scale(2, 2);
  c.fillStyle = colour; c.fillRect(0, 0, w, HOVER_WORLD_H);
  c.fillStyle = "rgba(0,0,0,0.72)"; c.fillRect(0, 0, w, HOVER_WORLD_H);
  // One baked glow pass, clipped by the raster's exact rectangular footprint.
  c.shadowColor = colour; c.shadowBlur = 3;
  for (let y = 0; y < HOVER_WORLD_H; y += 12) {
    c.fillStyle = colour; c.fillRect(0, y, w, 11);
  }
  c.shadowBlur = 0;
  for (let y = 0; y < HOVER_WORLD_H; y += 12) {
    c.fillStyle = Math.floor(y / 12) % 2 ? "rgba(0,0,0,0.38)" : "rgba(0,0,0,0.22)"; c.fillRect(0, y, w, 11);
    c.fillStyle = "rgba(255,255,255,0.55)"; c.fillRect(2, y + 2, w - 4, 1);
    c.fillStyle = "rgba(0,0,0,0.45)"; c.fillRect(w / 2, y + 3, 1, 7);
  }
  barrierCache.set(colour, layer);
  return layer;
}

function draw(ctx: CanvasRenderingContext2D, state: HoverState, size: CanvasSize): void {
  retroScreen(ctx, size, HOVER_WORLD_W, HOVER_WORLD_H, "fit", (c) => arcadeFx(c, HOVER_FX, state, () => drawWorld(c, state)));
}
function drawReveal(ctx: CanvasRenderingContext2D, state: HoverState, size: CanvasSize): void {
  retroScreen(ctx, size, HOVER_WORLD_W, HOVER_WORLD_H, "fit", (c) => arcadeFx(c, HOVER_FX, state, () => drawWorld(c, state, false)));
}

function drawWorld(ctx: CanvasRenderingContext2D, state: HoverState, crashIndicator = true): void {
  const bloom = retroBloom();
  const discLeft = HOVER_DISC_X - HOVER_DISC_R;
  const width = px(HOVER_PILLAR_W);

  state.pillars.forEach((pillar, index) => {
    const left = px(pillarX(pillar, state.distance));
    if (left > HOVER_WORLD_W || left + width < 0) return;
    const colour = BARRIER_CYCLES[Math.floor(index / 7) % 6] ?? "#FF4DFF";
    // After crossing, scroll speed is constant until the next gate. Recover
    // the pass age from distance, even on a fresh reveal or a skipped frame.
    const passedBy = px(state.distance - (pillar.x0 + HOVER_PILLAR_W - discLeft));
    const duration = reducedMotion() ? 9 : 18;
    const age = passedBy / px(hoverScroll(index + 1));
    const flash = index < state.gates && age >= 0 && age < duration ? 1 - age / duration : 0;
    const top = px(hoverGapTop(pillar, state.tick));
    const bottom = top + px(pillar.gapH);
    drawPipe(ctx, left, 0, width, top, colour, bloom, flash, "bottom");
    if (pillar.gap2Top !== undefined) {
      // hoverRev 2 two-gap barrier: a middle block between the upper and lower gaps.
      const top2 = px(pillar.gap2Top);
      const bottom2 = top2 + px(pillar.gap2H ?? 0);
      drawPipe(ctx, left, bottom, width, top2 - bottom, colour, bloom, flash, "both");
      drawPipe(ctx, left, bottom2, width, HOVER_WORLD_H - bottom2, colour, bloom, flash, "top");
      drawForkArrows(ctx, left + width / 2 - 3, bottom, top2);
    } else drawPipe(ctx, left, bottom, width, HOVER_WORLD_H - bottom, colour, bloom, flash, "top");
    if (pillar.movePhase !== undefined) drawSlideRail(ctx, left, width, pillar, state.tick);
    drawStar(ctx, state, pillar, index, left + width / 2);
  });

  // Ordinary passes are rewarded by the barrier itself, not a saucer trace.
  // Feed only each five-gate milestone to the shared burst/edge/HUD reward.
  const reward=successFrame(ctx,{id:'hover',tick:state.tick,count:Math.floor(state.gates/5),every:1,colour:BARRIER_CYCLES[Math.floor(Math.max(0,state.gates-1)/7)%6]??SAUCER,width:HOVER_WORLD_W,height:HOVER_WORLD_H,point:{x:px(HOVER_DISC_X),y:px(state.y),shape:'spark',radius:20},hud:{x:10,y:28,text:`BARRIERS ${state.gates}/${state.totalGates}`}});
  const latest = state.pillars[state.gates - 1];
  const colourAge = latest ? px(state.distance - (latest.x0 + HOVER_PILLAR_W - discLeft)) / px(hoverScroll(state.gates)) : Infinity;
  if(!reducedMotion()&&state.gates>0&&state.gates%7===0&&colourAge<20){ctx.save();ctx.globalAlpha=.22*(1-colourAge/20);ctx.strokeStyle=BARRIER_CYCLES[Math.floor(state.gates/7)%6]??SAUCER;ctx.lineWidth=1;ctx.strokeRect(4,4,HOVER_WORLD_W-8,HOVER_WORLD_H-8);ctx.restore();}
  drawSaucer(ctx, state, crashIndicator);
  successHud(ctx,'hover',state.tick,10,28,()=>{retroReadout(ctx, 10, 10, `BARRIERS ${state.gates}/${state.totalGates}`, RETRO_WHITE);});
  if ((state.totalStars ?? 0) > 0) retroText(ctx, `STARS ${state.stars ?? 0}/${state.totalStars}`, 10, 46, 14, STAR_GOLD, "left", 4);

  if (state.crashed && crashIndicator) {
    ctx.fillStyle = "rgba(255,59,92,0.2)";
    ctx.fillRect(0, 0, HOVER_WORLD_W, HOVER_WORLD_H);
  }
}

const STAR_GOLD = "#FFD84A";

/** A gold star (hoverRev 2) drawn in 2 px blocks inside its collection circle; gone once taken. */
function drawStar(ctx: CanvasRenderingContext2D, state: HoverState, pillar: HoverState["pillars"][number], index: number, cx: number): void {
  const starY = hoverStarY(pillar, state.tick);
  if (starY === null || state.starsTaken?.includes(index)) return;
  const r = px(HOVER_STAR_R);
  const cy = px(starY);
  const twinkle = reducedMotion() ? 0 : Math.floor(retroClock() / 180) % 4;
  pixelShape(ctx, cx, cy, r, 2, (dx, dy) => {
    // A four-point pixel star: a plus with a filled core.
    const ax = Math.abs(dx), ay = Math.abs(dy);
    if (ax * ax + ay * ay > r * r) return null;
    if (ax <= 2 && ay <= 2) return RETRO_WHITE;
    if (ax <= 2.5 || ay <= 2.5 || ax + ay <= r * 0.8) return STAR_GOLD;
    return null;
  });
  if (twinkle === 0) pixelRect(ctx, cx + r - 1, cy - r - 1, 2, 2, RETRO_WHITE);
}

/**
 * Moving barrier (hoverRev 2): white rail marks inside the barrier at the two
 * ends of its gap's slide, and arrows on the lips pointing the way it moves.
 * Everything sits on the solid barrier, inside its collision rectangle.
 */
function drawSlideRail(ctx: CanvasRenderingContext2D, left: number, width: number, pillar: HoverState["pillars"][number], tick: number): void {
  const base = px(pillar.gapTop);
  const gap = px(pillar.gapH);
  const amp = px(HOVER_MOVE_AMP);
  const top = px(hoverGapTop(pillar, tick));
  ctx.globalAlpha = 0.8;
  for (const y of [base - amp - 2, base + gap + amp]) {
    for (let x = 2; x < width - 2; x += 4) pixelRect(ctx, left + x, Math.round(y), 2, 2, RETRO_WHITE);
  }
  const rising = hoverGapTop(pillar, tick + 1) < hoverGapTop(pillar, tick);
  const cx = left + width / 2;
  for (const lip of [top - 6, top + gap + 2]) {
    const y = Math.round(lip);
    pixelRect(ctx, cx - 1, rising ? y : y + 2, 2, 2, RETRO_WHITE);
    pixelRect(ctx, cx - 3, rising ? y + 2 : y, 6, 2, RETRO_WHITE);
  }
  ctx.globalAlpha = 1;
}

/** Two-gap barrier (hoverRev 2): white chevrons on the middle block pointing to both gaps. */
function drawForkArrows(ctx: CanvasRenderingContext2D, x: number, wallTop: number, wallBottom: number): void {
  if (wallBottom - wallTop < 24) return;
  const colour = RETRO_WHITE;
  ctx.globalAlpha = 0.7;
  const mid = (wallTop + wallBottom) / 2;
  for (const dir of [-1, 1]) {
    const y = mid + dir * 6;
    pixelRect(ctx, x + 2, Math.round(y), 2, 2, colour);
    pixelRect(ctx, x, Math.round(y + dir * 2), 2, 2, colour);
    pixelRect(ctx, x + 4, Math.round(y + dir * 2), 2, 2, colour);
  }
  ctx.globalAlpha = 1;
}

/** Stacked energy blocks fill the exact pillar rectangle, without a cap or lip. */
function drawPipe(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  colour: string,
  bloom: number,
  flash: number,
  capAt: "top" | "bottom" | "both",
): void {
  if (h <= 0) return;
  const stamp = barrierSprite(w, colour);
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  if (stamp) ctx.drawImage(stamp, 0, 0, w * 2, h * 2, x, y, w, h);
  else {
    pixelRect(ctx, x, y, w, h, "#39114F");
    for (let row = 0; row < h; row += 12)
      pixelRect(ctx, x, y + row, w, Math.min(11, h - row), colour);
  }
  // A thin jagged energy trace remains inside the flat facing block edge.
  for (const end of capAt === "both" ? (["top", "bottom"] as const) : [capAt]) {
    const edge = end === "bottom" ? y + h - 1 : y;
    pixelRect(ctx, x, edge, w, 1, colour);
    for (let column = 2; column < w; column += 6)
      pixelRect(ctx, x + column, end === "bottom" ? edge - 1 : edge + 1, Math.min(3, w - column), 1, RETRO_WHITE);
  }
  if (flash > 0) {
    ctx.globalAlpha = flash * 0.34;
    pixelRect(ctx, x, y, w, h, colour);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

/** Saucer drawn in 2 px blocks, every block inside the sim's disc. */
function drawSaucer(ctx: CanvasRenderingContext2D, state: HoverState, crashIndicator: boolean): void {
  const cx = px(HOVER_DISC_X);
  const cy = px(state.y);
  const r = px(HOVER_DISC_R);
  // Thruster puff for a few ticks after a tap; background decoration under the saucer.
  const sinceTap = Math.round((state.vy - HOVER_IMPULSE) / 90);
  if (!state.crashed && sinceTap >= 0 && sinceTap < 8) {
    ctx.globalAlpha = 0.6 * (1 - sinceTap / 8);
    pixelRect(ctx, cx - 4, cy + r * 0.5 + sinceTap, 8, 4, "#FF9A3C", 6);
    pixelRect(ctx, cx - 2, cy + r * 0.5 + sinceTap + 4, 4, 3, "#FFE08A");
    ctx.globalAlpha = 1;
  }
  const t = retroClock();
  const blink = Math.floor(t / 160) % 3;
  const body = state.crashed && crashIndicator ? RETRO_RED : SAUCER;
  pixelShape(ctx, cx, cy, r, 2, (dx, dy) => {
    if (dx * dx + dy * dy > r * r) return null;
    // Dome above the hull.
    const domeY = dy + r * 0.1;
    if (domeY < 0 && dx * dx + domeY * domeY <= (r * 0.5) ** 2) return state.crashed && crashIndicator ? RETRO_RED : DOME;
    // Flat hull ellipse.
    const ey = (dy - r * 0.2) / (r * 0.38);
    const ex = dx / r;
    if (ex * ex + ey * ey > 1) return null;
    if (ey > 0.35) {
      const slot = Math.floor((dx + r) / 4);
      return slot % 3 === blink ? RETRO_WHITE : SAUCER_DARK;
    }
    return body;
  });
}

export const hoverArtGame: ArcadeGame<HoverState> = { ...hoverGame, draw };
/** Preserve the actual final state and live death art, but omit the reveal's red indicator. */
export const hoverRevealGame = { draw: drawReveal };
