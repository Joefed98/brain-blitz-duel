import { BINTOSS_NEXT_DELAY } from "./binToss";
import { successHud, successFrame, SUCCESS_ACCENTS } from "./success.renderer";
import type { ArcadeGame, ArcadeInputEvent, CanvasSize } from "./engine";
import {
  BINTOSS_BALL_R, BINTOSS_FLOOR_Y, BINTOSS_FLY, BINTOSS_MISS_COLOUR,
  BINTOSS_RIM_Y, BINTOSS_SLIDE_FROM, BINTOSS_THROWS, BINTOSS_WAIT, BINTOSS_WIND_MAX,
  BINTOSS_WORLD_H, BINTOSS_WORLD_W, BINTOSS_BIN_COLOUR,
  binTossCentreAt, binTossGame, binTossHalf, binTossPath, type BinTossGhost, type BinTossLandingPresentation, type BinTossState,
} from "./binToss";
import { reducedMotion } from "./art.renderer";
import { FAIR_TEXT, fairChangeAge, fairPennant, fairScreen, fairTransform } from "./fairground.renderer";

const px = (v: number) => v / 256;
export const BINTOSS_RUBBER = "#A72B32";
const SEAM = "#4A0F0B";
const TIN_LIGHT = "#ACB0B3";
const TIN_MID = "#959A9E";
const TIN_DARK = "#787E83";
const AIM_INK = "#453C53";
const AIM_WHITE = "#FFFFFF";
const FLOOR = px(BINTOSS_FLOOR_Y);

export function drawRubberBall(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, spin: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(spin);
  ctx.fillStyle = BINTOSS_RUBBER;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.clip();
  ctx.strokeStyle = SEAM;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-r, -r * 0.2);
  ctx.quadraticCurveTo(0, r * 0.7, r, -r * 0.2);
  ctx.stroke();
  ctx.restore();
}

function drawBucket(ctx: CanvasRenderingContext2D, centre: number, half: number, lean: number, trolley: boolean): void {
  const top = px(BINTOSS_RIM_Y);
  const h = FLOOR - top;
  ctx.save();
  if (trolley) {
    ctx.fillStyle = "#3A2A1E";
    ctx.fillRect(centre - half - 3, FLOOR, half * 2 + 6, 4);
    ctx.fillStyle = "#1C1612";
    for (const wx of [centre - half + 6, centre + half - 6]) {
      ctx.beginPath();
      ctx.arc(wx, FLOOR + 8, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = TIN_MID;
    for (const wx of [centre - half + 6, centre + half - 6]) {
      ctx.beginPath();
      ctx.arc(wx, FLOOR + 8, 1.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.translate(centre + lean, FLOOR);
  const body = new Path2D();
  body.moveTo(-half, -h);
  body.lineTo(-half + 4, 0);
  body.lineTo(half - 4, 0);
  body.lineTo(half, -h);
  body.closePath();
  const g = ctx.createLinearGradient(-half, 0, half, 0);
  g.addColorStop(0, TIN_DARK);
  g.addColorStop(0.35, TIN_LIGHT);
  g.addColorStop(0.6, TIN_MID);
  g.addColorStop(1, TIN_DARK);
  ctx.fillStyle = g;
  ctx.fill(body);
  ctx.save();
  ctx.clip(body);
  ctx.strokeStyle = "rgba(40, 44, 52, 0.3)";
  ctx.lineWidth = 1.5;
  for (const f of [0.22, 0.5, 0.78]) {
    ctx.beginPath();
    ctx.moveTo(-half, -h * (1 - f));
    ctx.lineTo(half, -h * (1 - f));
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(255, 255, 255, 0.14)";
  ctx.lineWidth = 1;
  for (const f of [0.22, 0.5, 0.78]) {
    ctx.beginPath();
    ctx.moveTo(-half, -h * (1 - f) + 1.5);
    ctx.lineTo(half, -h * (1 - f) + 1.5);
    ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = TIN_DARK;
  ctx.lineWidth = 1;
  ctx.stroke(body);
  ctx.fillStyle = "#1A1D24";
  ctx.beginPath();
  ctx.ellipse(0, -h, half - 1, 3.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = TIN_LIGHT;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, -h, half - 1, 3.2, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawWind(ctx: CanvasRenderingContext2D, wind: number): void {
  const centreX = BINTOSS_WORLD_W / 2;
  const y = 84;
  const strength = Math.abs(wind);
  ctx.save();
  ctx.strokeStyle = wind === 0 ? "#F7F7F855" : BINTOSS_BIN_COLOUR;
  ctx.lineWidth = 2.8;
  if (wind !== 0) {
    const dir = wind < 0 ? -1 : 1;
    ctx.beginPath();
    ctx.moveTo(centreX - 36.4 * dir, y);
    ctx.lineTo(centreX + 36.4 * dir, y);
    ctx.lineTo(centreX + 25.2 * dir, y - 8.4);
    ctx.moveTo(centreX + 36.4 * dir, y);
    ctx.lineTo(centreX + 25.2 * dir, y + 8.4);
    ctx.stroke();
  }
  for (let bar = 0; bar < BINTOSS_WIND_MAX; bar++) {
    ctx.fillStyle = bar < strength ? BINTOSS_BIN_COLOUR : "#F7F7F833";
    ctx.fillRect(centreX - 26 + bar * 11, y + 10, 8, 4);
  }
  ctx.font = "600 18.2px 'JetBrains Mono', ui-monospace, monospace";
  ctx.fillStyle = FAIR_TEXT;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(wind === 0 ? "no wind" : `${wind < 0 ? "←" : "→"} ${strength}`, centreX, y - 19);
  ctx.restore();
  fairPennant(ctx, BINTOSS_WORLD_W - 30, 10, wind, BINTOSS_WIND_MAX);
}

const trails = new WeakMap<CanvasRenderingContext2D, { tick: number; points: { x: number; y: number }[] }>();
function drawTrail(ctx: CanvasRenderingContext2D, state: BinTossState): void {
  if (state.phase !== BINTOSS_FLY || reducedMotion()) return;
  let memo = trails.get(ctx);
  if (!memo || state.tick < memo.tick) memo = { tick: state.tick, points: [] };
  memo.tick = state.tick;
  const last = memo.points[memo.points.length - 1];
  if (!last || last.x !== state.x || last.y !== state.y) memo.points.push({ x: state.x, y: state.y });
  while (memo.points.length > 6) memo.points.shift();
  trails.set(ctx, memo);

  ctx.save();
  ctx.fillStyle = BINTOSS_RUBBER;
  const n = memo.points.length;
  for (let i = 0; i < n - 1; i++) {
    const p = memo.points[i]!;
    const k = (i + 1) / n;
    ctx.globalAlpha = 0.28 * k;
    ctx.beginPath();
    ctx.arc(px(p.x), px(p.y), px(BINTOSS_BALL_R) * (0.5 + 0.5 * k), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function draw(ctx: CanvasRenderingContext2D, state: BinTossState, size: CanvasSize): void {
  const basketAge = fairChangeAge(ctx, "bintoss-baskets", state.baskets);
  const resolvedAge = fairChangeAge(ctx, "bintoss-resolved", state.resolved);
  fairScreen(ctx, size, BINTOSS_WORLD_W, BINTOSS_WORLD_H, FLOOR, () => {
    const index = Math.min(state.throwIndex, BINTOSS_THROWS - 1);
    const centre = px(binTossCentreAt(state, index, state.tick));
    const half = px(binTossHalf(index, state.rev));
    const since = state.tick - state.wobbleTick;
    let lean = state.wobbleTick > 0 && since >= 0 && since < 24 ? (since % 8 < 4 ? 2 : -2) : 0;
    if (!reducedMotion() && basketAge < 500) lean = Math.sin(basketAge / 45) * 2 * (1 - basketAge / 500);
    drawBucket(ctx, centre, half, lean, index >= BINTOSS_SLIDE_FROM);

    const caughtIndex=Math.max(0,state.throwIndex-1);
    successFrame(ctx,{id:'bintoss',tick:state.tick,count:state.baskets,eventTick:state.results.at(-1)===1?state.readyTick-BINTOSS_NEXT_DELAY:0,misses:state.resolved-state.baskets,colour:SUCCESS_ACCENTS.gold,width:BINTOSS_WORLD_W,height:BINTOSS_WORLD_H,point:{x:px(binTossCentreAt(state,caughtIndex,state.tick)),y:px(BINTOSS_RIM_Y),shape:'spark'},hud:{x:12,y:12,text:`Throw ${Math.min(BINTOSS_THROWS,state.throwIndex+1)} / ${BINTOSS_THROWS} · ${state.baskets} in`}});
    if (state.throwIndex < BINTOSS_THROWS) drawWind(ctx, state.winds[state.throwIndex] ?? 0);
    if (state.resolved < BINTOSS_THROWS) {
      drawTrail(ctx, state);
      const r = px(BINTOSS_BALL_R);
      let y = px(state.y);
      const missed = state.phase === BINTOSS_WAIT && state.results[state.results.length - 1] === 0;
      if (missed && !reducedMotion() && resolvedAge < 420 && y >= FLOOR - r - 2) {
        const u = resolvedAge / 420;
        y -= Math.abs(Math.sin(u * Math.PI * 2)) * 10 * (1 - u);
      }
      drawRubberBall(ctx, px(state.x), y, r, ((state.tick * 11) % 360) * (Math.PI / 180));
    }

    ctx.font = "600 19.5px 'JetBrains Mono', ui-monospace, monospace";
    ctx.fillStyle = FAIR_TEXT;
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    const shown = Math.min(BINTOSS_THROWS, state.throwIndex + 1);
  successHud(ctx,'bintoss',state.tick,12,12,()=>{ctx.fillText(`Throw ${shown} / ${BINTOSS_THROWS} · ${state.baskets} in`, 12, 12);});
    for (let i = 0; i < BINTOSS_THROWS; i++) {
      const result = state.results[i];
      ctx.fillStyle = result === 1 ? "#F5B82E" : result === 0 ? BINTOSS_MISS_COLOUR : "#F7F7F844";
      ctx.beginPath();
      ctx.arc(20 + i * 16, BINTOSS_WORLD_H - 16, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [0.3, 0.52]);
}

export function binTossArtAim(ctx: CanvasRenderingContext2D, size: CanvasSize, aim: BinTossGhost, cancelled = false): void {
  const points = binTossPath(aim.vx, aim.vy, 0, false);
  const first = points[0];
  if (!first) return;
  const { scale, offsetX, offsetY } = fairTransform(size, BINTOSS_WORLD_W, BINTOSS_WORLD_H);
  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);
  ctx.strokeStyle = AIM_INK;
  ctx.globalAlpha = cancelled ? 0.28 : 1;
  ctx.lineCap = "round";
  ctx.lineWidth = 3.5;
  ctx.setLineDash([0.1, 8]);
  ctx.beginPath();
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < points.length; i++) {
    const point = points[i];
    if (point) ctx.lineTo(point.x, point.y);
  }
  ctx.stroke();
  ctx.strokeStyle = AIM_WHITE;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

export function binTossArtLanding(
  ctx: CanvasRenderingContext2D,
  size: CanvasSize,
  landing: BinTossLandingPresentation,
): void {
  const { scale, offsetX, offsetY } = fairTransform(size, BINTOSS_WORLD_W, BINTOSS_WORLD_H);
  const p = Math.max(0, Math.min(1, landing.progress));
  const centre = px(landing.binCentre);
  const half = px(binTossHalf(landing.binIndex, landing.rev));
  const rim = px(BINTOSS_RIM_Y);
  const radius = px(BINTOSS_BALL_R);
  let x = centre;
  let y = rim + radius;
  if (p < 0.48) {
    const local = p / 0.48;
    x = centre + half * 0.42 * local;
    y = rim + radius + (FLOOR - rim - radius * 2) * local;
  } else if (p < 0.76) {
    const local = (p - 0.48) / 0.28;
    x = centre + half * 0.42 * (1 - local * 1.55);
    y = FLOOR - radius - Math.sin(local * Math.PI) * 12;
  } else {
    const local = (p - 0.76) / 0.24;
    x = centre - half * 0.23 + half * 0.1 * local;
    y = FLOOR - radius;
  }
  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);
  ctx.beginPath();
  ctx.moveTo(centre - half, rim);
  ctx.lineTo(centre - half + 4, FLOOR);
  ctx.lineTo(centre + half - 4, FLOOR);
  ctx.lineTo(centre + half, rim);
  ctx.closePath();
  ctx.rect(centre - half, rim - 40, half * 2, 40);
  ctx.clip();
  ctx.globalAlpha = y - radius > rim ? 0.55 : 1;
  drawRubberBall(ctx, x, y, radius, p * Math.PI * 3);
  ctx.restore();
}

export const binTossArtGame: ArcadeGame<BinTossState, ArcadeInputEvent | null> = { ...binTossGame, draw };
