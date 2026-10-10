import { successFrame, SUCCESS_ACCENTS } from "./success.renderer";
/**
 * Wavefront art pass. Render only: reads WavState and never mutates it. Hulls
 * fill each shape's 28 px hit cell, armour fills its block, the saucer stays
 * inside its hit box and the fighter inside the ship's 40 x 24 box.
 */
import type { CanvasSize } from "./engine";
import {
  drawStars,
  wavefrontGame,
  wavShapeBox,
  WAV_ARMOUR_CODE,
  WAV_BOLT_H,
  WAV_BOLT_W,
  WAV_CELL,
  WAV_COLOURS,
  WAV_COLS,
  WAV_DRAG_ZONE_TOP,
  WAV_DROP_R,
  WAV_FIRE_EVERY,
  WAV_GOLD,
  WAV_LIVES,
  WAV_PURPLE,
  WAV_RED,
  WAV_SAUCER_R,
  WAV_SHIP_H,
  WAV_SHIP_W,
  WAV_SHIP_Y,
  WAV_WORLD_H,
  WAV_WORLD_W,
  type WavArmour,
  type WavState,
} from "./wavefront";
import { artHash, reducedMotion } from "./art.renderer";

/* Mirrors of private sim constants, used only to place art on the same geometry. */
const FP = 256;
const PITCH_X = 44;
const PITCH_Y = 36;
const SAUCER_Y = 62;

function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(amount < 0 ? c * (1 + amount) : c + (255 - c) * amount)));
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

/** One enemy hull filling the cell box (x, y, s x s); nose points down at the player. */
function drawHull(ctx: CanvasRenderingContext2D, kind: number, colour: string, x: number, y: number, s: number, t: number): void {
  const cx = x + s / 2;
  const body = ctx.createLinearGradient(x, y, x, y + s);
  body.addColorStop(0, shade(colour, -0.15));
  body.addColorStop(0.55, colour);
  body.addColorStop(1, colour);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, s, s);
  ctx.clip();
  ctx.fillStyle = body;
  ctx.strokeStyle = shade(colour, -0.6);
  ctx.lineWidth = 1;
  ctx.beginPath();
  if (kind === 0) {
    // Interceptor: round core with swept wings, full width.
    ctx.moveTo(x, y + s * 0.35);
    ctx.lineTo(x + s * 0.25, y + s * 0.2);
    ctx.arc(cx, y + s * 0.5, s * 0.3, -Math.PI * 0.85, -Math.PI * 0.15);
    ctx.lineTo(x + s * 0.75, y + s * 0.2);
    ctx.lineTo(x + s, y + s * 0.35);
    ctx.lineTo(x + s * 0.78, y + s * 0.72);
    ctx.arc(cx, y + s * 0.5, s * 0.3, Math.PI * 0.15, Math.PI * 0.85);
    ctx.lineTo(x + s * 0.22, y + s * 0.72);
    ctx.closePath();
  } else if (kind === 1) {
    // Dart: arrowhead with tail fins.
    ctx.moveTo(cx, y + s);
    ctx.lineTo(x + s, y + s * 0.15);
    ctx.lineTo(x + s * 0.68, y + s * 0.3);
    ctx.lineTo(cx, y);
    ctx.lineTo(x + s * 0.32, y + s * 0.3);
    ctx.lineTo(x, y + s * 0.15);
    ctx.closePath();
  } else {
    // Cruiser: heavy hexagonal hull with side pods.
    ctx.moveTo(x + s * 0.3, y);
    ctx.lineTo(x + s * 0.7, y);
    ctx.lineTo(x + s, y + s * 0.3);
    ctx.lineTo(x + s, y + s * 0.7);
    ctx.lineTo(x + s * 0.7, y + s);
    ctx.lineTo(x + s * 0.3, y + s);
    ctx.lineTo(x, y + s * 0.7);
    ctx.lineTo(x, y + s * 0.3);
    ctx.closePath();
  }
  ctx.fill();
  ctx.stroke();
  if (kind === 2) {
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.moveTo(x + s * 0.2, y + s * 0.5);
    ctx.lineTo(x + s * 0.8, y + s * 0.5);
    ctx.stroke();
  }
  // Engine glow at the rear (top), inside the box.
  const pulse = 0.6 + 0.4 * Math.sin(t * 9 + x * 0.1);
  ctx.fillStyle = `rgba(255,200,120,${0.55 * pulse})`;
  ctx.beginPath();
  ctx.ellipse(cx, y + s * 0.12, s * 0.12, s * 0.08, 0, 0, Math.PI * 2);
  ctx.fill();
  // Dark cockpit, no white highlight.
  ctx.fillStyle = shade(colour, -0.65);
  ctx.beginPath();
  ctx.ellipse(cx, y + s * (kind === 1 ? 0.55 : 0.6), s * 0.1, s * 0.07, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawArmourHull(ctx: CanvasRenderingContext2D, state: WavState, a: WavArmour): void {
  const box = wavShapeBox(state, a.row * WAV_COLS + a.col);
  const w = (a.w - 1) * PITCH_X + WAV_CELL;
  const h = (a.h - 1) * PITCH_Y + WAV_CELL;
  ctx.save();
  ctx.beginPath();
  ctx.rect(box.x, box.y, w, h);
  ctx.clip();
  // Silver spaceship silhouette; the dark frame shows through missing plates.
  const cx = box.x + w / 2;
  ctx.beginPath();
  ctx.moveTo(cx, box.y + h);
  ctx.lineTo(cx + w * 0.18, box.y + h * 0.72);
  ctx.lineTo(box.x + w, box.y + h * 0.85);
  ctx.lineTo(box.x + w, box.y + h * 0.24);
  ctx.lineTo(cx + w * 0.2, box.y + h * 0.38);
  ctx.lineTo(cx + w * 0.12, box.y);
  ctx.lineTo(cx - w * 0.12, box.y);
  ctx.lineTo(cx - w * 0.2, box.y + h * 0.38);
  ctx.lineTo(box.x, box.y + h * 0.24);
  ctx.lineTo(box.x, box.y + h * 0.85);
  ctx.lineTo(cx - w * 0.18, box.y + h * 0.72);
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = "#454B54";
  ctx.fill();
  ctx.strokeStyle = "#D8DDE5";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // One plate per hit point; each hit removes the next plate in a fixed order.
  const cols = Math.ceil(a.maxHp / 2);
  const pw = (w - 6) / cols;
  const ph = (h - 6) / 2;
  const order = Array.from({ length: a.maxHp }, (_, k) => k).sort((p, q) => artHash(p, a.maxHp) - artHash(q, a.maxHp));
  const gone = new Set(order.slice(0, a.maxHp - a.hp));
  for (let k = 0; k < a.maxHp; k++) {
    const px = box.x + 3 + (k % cols) * pw;
    const py = box.y + 3 + Math.trunc(k / cols) * ph;
    if (gone.has(k)) {
      // Exposed frame with a crack.
      ctx.strokeStyle = "#242830";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(px + pw * 0.2, py + ph * 0.2);
      ctx.lineTo(px + pw * 0.5, py + ph * 0.55);
      ctx.lineTo(px + pw * 0.4, py + ph * 0.8);
      ctx.moveTo(px + pw * 0.5, py + ph * 0.55);
      ctx.lineTo(px + pw * 0.8, py + ph * 0.6);
      ctx.stroke();
      continue;
    }
    const g = ctx.createLinearGradient(px, py, px, py + ph);
    g.addColorStop(0, "#D2D5DA");
    g.addColorStop(0.5, "#AEB3BC");
    g.addColorStop(1, "#777E89");
    ctx.fillStyle = g;
    ctx.fillRect(px + 1, py + 1, pw - 2, ph - 2);
    ctx.strokeStyle = "#353B45";
    ctx.lineWidth = 1;
    ctx.strokeRect(px + 1.5, py + 1.5, pw - 3, ph - 3);
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(px + 2, py + 2, 1.5, 1.5);
    ctx.fillRect(px + pw - 3.5, py + 2, 1.5, 1.5);
  }
  ctx.restore();
}

function drawFighter(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number, moving: boolean, recoil: number, t: number): void {
  const top = cy - h / 2;
  const bottom = cy + h / 2;
  ctx.save();
  ctx.beginPath();
  ctx.rect(cx - w / 2, top, w, h);
  ctx.clip();
  if (moving) {
    const flick = 0.75 + 0.25 * Math.sin(t * 30);
    const fire = ctx.createLinearGradient(0, bottom - 4, 0, bottom + 6 * flick);
    fire.addColorStop(0, "rgba(255,230,160,0.95)");
    fire.addColorStop(1, "rgba(255,90,40,0)");
    ctx.fillStyle = fire;
    ctx.beginPath();
    ctx.moveTo(cx - 4, bottom - 4);
    ctx.lineTo(cx, bottom + 6 * flick);
    ctx.lineTo(cx + 4, bottom - 4);
    ctx.fill();
  }
  // Wings to the full 40 px width, nose at the box top.
  const g = ctx.createLinearGradient(0, top, 0, bottom);
  g.addColorStop(0, "#FFF3D0");
  g.addColorStop(1, "#E6A830");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(cx, top);
  ctx.lineTo(cx + 5, top + h * 0.4);
  ctx.lineTo(cx + w / 2, bottom - 3);
  ctx.lineTo(cx + w / 2, bottom);
  ctx.lineTo(cx + 6, bottom - 3);
  ctx.lineTo(cx - 6, bottom - 3);
  ctx.lineTo(cx - w / 2, bottom);
  ctx.lineTo(cx - w / 2, bottom - 3);
  ctx.lineTo(cx - 5, top + h * 0.4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = WAV_GOLD;
  ctx.fillRect(cx - w / 2, bottom - 7, 2.5, 7);
  ctx.fillRect(cx + w / 2 - 2.5, bottom - 7, 2.5, 7);
  ctx.fillStyle = "#4D8CFF";
  ctx.beginPath();
  ctx.ellipse(cx, top + h * 0.45, 2.4, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  if (recoil > 0) {
    ctx.globalAlpha = recoil;
    const flash = ctx.createRadialGradient(cx, top, 0, cx, top, 9);
    flash.addColorStop(0, "rgba(255,255,255,1)");
    flash.addColorStop(1, "rgba(255,210,100,0)");
    ctx.fillStyle = flash;
    ctx.beginPath();
    ctx.arc(cx, top, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

/** All three beam styles stay inside the sim's identical 4 × 12 projectile box. */
export function drawWavefrontBeam(ctx: CanvasRenderingContext2D, x: number, y: number, kind: "player" | "enemy" | "piercing"): void {
  const piercing = kind === "piercing";
  const w = Math.min(WAV_BOLT_W, piercing ? 3 : 2);
  const h = Math.min(WAV_BOLT_H, piercing ? 12 : 8);
  if (kind === "player") {
    ctx.fillStyle = "rgba(61, 220, 132, 0.3)";
    ctx.fillRect(x - w / 2 - 2, y - 2, w + 4, h + 4);
  }
  if (kind === "player") {
    ctx.fillStyle = "rgba(61, 220, 132, 0.35)";
    ctx.fillRect(x - w / 2 - 2, y - 2, w + 4, h + 4);
  }
  ctx.fillStyle = piercing ? WAV_PURPLE : kind === "enemy" ? WAV_RED : "#3DDC84";
  ctx.fillRect(x - w / 2, y, w, h);
}

function drawSaucer(ctx: CanvasRenderingContext2D, x: number, t: number): void {
  const y = SAUCER_Y;
  const rx = WAV_SAUCER_R + 2;
  // Dome.
  const dome = ctx.createRadialGradient(x - 2, y - 7, 1, x, y - 4, 7);
  dome.addColorStop(0, "rgba(255,255,255,0.95)");
  dome.addColorStop(1, "rgba(167,139,250,0.35)");
  ctx.fillStyle = dome;
  ctx.beginPath();
  ctx.ellipse(x, y - 3, 6, 7, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  // Disc.
  const disc = ctx.createLinearGradient(0, y - 4, 0, y + 5);
  disc.addColorStop(0, "#D9CCFF");
  disc.addColorStop(1, "#5B3FB8");
  ctx.fillStyle = disc;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  // Rotating light ring.
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + t * 3;
    const lit = Math.sin(a) > 0;
    ctx.fillStyle = lit ? (k % 2 ? "#FFE600" : "#FF6BD6") : "rgba(255,255,255,0.25)";
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * (rx - 2), y + Math.sin(a) * 2 + 1, 1.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBursts(ctx: CanvasRenderingContext2D, state: WavState, palette: string[], still: boolean): void {
  let budget=16;
  for (const b of state.bursts) {
    const age = state.tick - b.t;
    if (age >= (still?10:24)) continue;
    const p = age / 24;
    const colour = palette[b.c] ?? "#FFFFFF";
    ctx.globalAlpha = 1 - p;
    ctx.strokeStyle = colour;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(b.x, b.y, 4 + p * 18, 0, Math.PI * 2);
    ctx.stroke();
    if (!still) {
      ctx.fillStyle = "#FFFFFF";
      ctx.beginPath();
      ctx.arc(b.x, b.y, Math.max(0, 6 * (1 - p * 2)), 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = colour;
      for (let k = 0; k < 4 && budget>0; k++,budget--) {
        const a = (k / 9) * Math.PI * 2 + (artHash(b.t, k) % 100) / 80;
        const d = 3 + age * (1.1 + (artHash(k, b.t) % 6) / 10);
        ctx.fillRect(b.x + Math.cos(a) * d - 1.5, b.y + Math.sin(a) * d - 1.5, 3, 3);
      }
    }
  }
  ctx.globalAlpha = 1;
}

/** Render-side memory of recent ship movement, for the engine flame only. */
const motion = { tick: -1, shipX: 0, movedTick: -100 };

export function drawWavefrontArt(ctx: CanvasRenderingContext2D, state: WavState, size: CanvasSize): void {
  const still = reducedMotion();
  const t = still ? 0 : state.tick / 60;
  const scale = Math.min(size.width / WAV_WORLD_W, size.height / WAV_WORLD_H);
  const ox = (size.width - WAV_WORLD_W * scale) / 2;
  const oy = (size.height - WAV_WORLD_H * scale) / 2;
  ctx.save();
  ctx.fillStyle = "#07070C";
  ctx.fillRect(0, 0, size.width, size.height);
  ctx.translate(ox, oy);
  ctx.scale(scale, scale);
  drawStars(ctx, WAV_WORLD_W, WAV_WORLD_H, 91);

  const latest=state.bursts.at(-1);
  successFrame(ctx,{id:'wavefront-hit',tick:state.tick,count:state.shapesDown+state.armourHits,eventTick:latest?.t,misses:WAV_LIVES-state.lives,colour:WAV_GOLD,width:WAV_WORLD_W,height:WAV_WORLD_H,point:{x:latest?.x??state.shipX,y:latest?.y??WAV_SHIP_Y,shape:'pixel'},hud:{x:14,y:14,text:`Wave ${state.wave}`}});
  const clear=successFrame(ctx,{id:'wavefront-clear',tick:state.tick,count:state.wavesCleared,colour:WAV_PURPLE,width:WAV_WORLD_W,height:WAV_WORLD_H,point:{x:WAV_WORLD_W/2,y:80,shape:'spark'}});
  if(!still&&clear.age<24){ctx.save();ctx.globalAlpha=.35*(1-clear.age/24);ctx.strokeStyle=SUCCESS_ACCENTS.white;ctx.lineWidth=1;ctx.beginPath();for(let i=0;i<12;i++){const x=15+(i*73)%360,y=60+(i*47)%450;ctx.moveTo(x,y);ctx.lineTo(x+(x-195)*.08,y+10+clear.age*.7);}ctx.stroke();ctx.restore();}
  state.shapes.forEach((code, i) => {
    if (code === 0 || code === WAV_ARMOUR_CODE) return;
    const box = wavShapeBox(state, i);
    const kind = Math.trunc((code - 1) / 3);
    const colour = WAV_COLOURS[(code - 1) % 3] ?? WAV_GOLD;
    drawHull(ctx, kind, colour, box.x, box.y, WAV_CELL, t);
  });
  if (state.armour) drawArmourHull(ctx, state, state.armour);

  if (state.drop && state.drop.wait === 0) {
    const dx = state.drop.x / FP;
    const dy = state.drop.y / FP;
    ctx.shadowBlur = 0;
    ctx.fillStyle = WAV_PURPLE;
    ctx.beginPath();
    ctx.moveTo(dx, dy - WAV_DROP_R);
    ctx.lineTo(dx + WAV_DROP_R, dy);
    ctx.lineTo(dx, dy + WAV_DROP_R);
    ctx.lineTo(dx - WAV_DROP_R, dy);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#F7F7F8";
    ctx.fillRect(dx - 1, dy - 5, 2, 10);
  }

  if (state.saucerDir !== 0) drawSaucer(ctx, state.saucerX / FP, t);

  for (const b of state.bolts) {
    drawWavefrontBeam(ctx, b.x / FP, b.y / FP, b.p ? "piercing" : "player");
  }
  for (const b of state.reds) {
    drawWavefrontBeam(ctx, b.x / FP, b.y / FP, "enemy");
  }

  drawBursts(ctx, state, [...WAV_COLOURS, WAV_PURPLE, "#9AA3B2"], still);

  if (state.tick < motion.tick) motion.movedTick = -100;
  if (state.tick !== motion.tick && state.shipX !== motion.shipX) motion.movedTick = state.tick;
  motion.tick = state.tick;
  motion.shipX = state.shipX;
  const moving = !still && state.tick - motion.movedTick < 8 && state.ended === 0;
  const recoil = state.fireIn > WAV_FIRE_EVERY - 5 ? (state.fireIn - (WAV_FIRE_EVERY - 5)) / 5 : 0;
  const flashing = state.invuln > 0 && state.tick % 8 < 4;
  if (state.ended === 2) {
    ctx.globalAlpha = 0.4;
    drawFighter(ctx, state.shipX, WAV_SHIP_Y, WAV_SHIP_W, WAV_SHIP_H, false, 0, t);
    ctx.globalAlpha = 1;
  } else if (!flashing) drawFighter(ctx, state.shipX, WAV_SHIP_Y, WAV_SHIP_W, WAV_SHIP_H, moving, recoil, t);

  ctx.strokeStyle = "rgba(245,184,46,0.12)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(8, WAV_DRAG_ZONE_TOP);
  ctx.lineTo(WAV_WORLD_W - 8, WAV_DRAG_ZONE_TOP);
  ctx.stroke();

  ctx.font = "600 16px 'JetBrains Mono', ui-monospace, monospace";
  ctx.fillStyle = "#F7F7F8";
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.fillText(`Wave ${state.wave} · ${wavefrontGame.score(state)}`, 14, 14);
  if (state.pierce > 0) {
    ctx.fillStyle = WAV_PURPLE;
    ctx.fillText(`Laser ×${state.pierce}`, 14, 34);
  }
  for (let i = 0; i < WAV_LIVES; i++) {
    ctx.globalAlpha = i < state.lives ? 1 : 0.2;
    drawFighter(ctx, WAV_WORLD_W - 24 - i * 26, 22, 18, 11, false, 0, 0);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

/** The sim with the art renderer swapped in; step/score are the sim's own. */
export const wavefrontArtGame = { ...wavefrontGame, draw: drawWavefrontArt };
