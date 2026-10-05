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
  body.addColorStop(0, shade(colour, -0.45));
  body.addColorStop(0.55, colour);
  body.addColorStop(1, shade(colour, 0.3));
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
  // Cockpit highlight.
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.beginPath();
  ctx.ellipse(cx, y + s * (kind === 1 ? 0.55 : 0.6), s * 0.1, s * 0.07, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawArmourHull(ctx: CanvasRenderingContext2D, state: WavState, a: WavArmour): void {
  const box = wavShapeBox(state, a.row * WAV_COLS_OF(a) + a.col);
  const w = (a.w - 1) * PITCH_X + WAV_CELL;
  const h = (a.h - 1) * PITCH_Y + WAV_CELL;
  // Under-hull (shown where plates have been knocked off).
  ctx.beginPath();
  ctx.roundRect(box.x, box.y, w, h, 6);
  ctx.fillStyle = "#2A2F3A";
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
      ctx.strokeStyle = "rgba(255,140,80,0.7)";
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
    g.addColorStop(0, "#C9D0DB");
    g.addColorStop(1, "#7C8596");
    ctx.fillStyle = g;
    ctx.fillRect(px + 1, py + 1, pw - 2, ph - 2);
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(px + 2, py + 2, 1.5, 1.5);
    ctx.fillRect(px + pw - 3.5, py + 2, 1.5, 1.5);
  }
}
const WAV_COLS_OF = (_a: WavArmour) => 6;

function drawFighter(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number, moving: boolean, recoil: number, t: number): void {
  const top = cy - h / 2;
  const bottom = cy + h / 2;
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
  g.addColorStop(0, "#FFE4A0");
  g.addColorStop(1, "#C98A1C");
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
  for (const b of state.bursts) {
    const age = state.tick - b.t;
    if (age > 24) continue;
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
      for (let k = 0; k < 9; k++) {
        const a = (k / 9) * Math.PI * 2 + (artHash(b.t, k) % 100) / 80;
        const d = 3 + age * (1.1 + (artHash(k, b.t) % 6) / 10);
        ctx.fillRect(b.x + Math.cos(a) * d - 1.5, b.y + Math.sin(a) * d - 1.5, 3, 3);
      }
    }
  }
  ctx.globalAlpha = 1;
}

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

  state.shapes.forEach((code, i) => {
    if (code === 0 || code === WAV_ARMOUR_CODE) return;
    const box = wavShapeBox(state, i);
    const kind = Math.trunc((code - 1) / 3);
    const colour = WAV_COLOURS[(code - 1) % 3] ?? WAV_COLOURS[0]!;
    drawHull(ctx, kind, colour, box.x, box.y, WAV_CELL, t);
  });
  if (state.armour) drawArmourHull(ctx, state, state.armour);

  if (state.drop && state.drop.wait === 0) {
    const dx = state.drop.x / FP;
    const dy = state.drop.y / FP;
    ctx.shadowColor = WAV_PURPLE;
    ctx.shadowBlur = still ? 0 : 8;
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
    const bx = b.x / FP;
    const by = b.y / FP;
    if (b.p) {
      // Piercing laser: bright beam on the bolt's box, with a fading tail.
      const w = WAV_BOLT_W + 2;
      const tail = ctx.createLinearGradient(0, by + WAV_BOLT_H, 0, by + WAV_BOLT_H + 40);
      tail.addColorStop(0, "rgba(200,180,255,0.45)");
      tail.addColorStop(1, "rgba(200,180,255,0)");
      ctx.fillStyle = tail;
      ctx.fillRect(bx - 1, by + WAV_BOLT_H, 2, 40);
      ctx.fillStyle = "rgba(167,139,250,0.45)";
      ctx.fillRect(bx - w / 2 - 2, by - 6, w + 4, WAV_BOLT_H + 6);
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(bx - w / 2 + 1, by - 6, w - 2, WAV_BOLT_H + 6);
    } else {
      ctx.fillStyle = "rgba(245,184,46,0.35)";
      ctx.fillRect(bx - WAV_BOLT_W / 2 - 1, by - 1, WAV_BOLT_W + 2, WAV_BOLT_H + 2);
      ctx.fillStyle = "#FFE8A8";
      ctx.fillRect(bx - WAV_BOLT_W / 2, by, WAV_BOLT_W, WAV_BOLT_H);
    }
  }
  for (const b of state.reds) {
    const bx = b.x / FP;
    const by = b.y / FP;
    ctx.fillStyle = "rgba(240,82,79,0.35)";
    ctx.fillRect(bx - WAV_BOLT_W / 2 - 1.5, by - 1, WAV_BOLT_W + 3, WAV_BOLT_H + 2);
    ctx.fillStyle = WAV_RED;
    ctx.fillRect(bx - WAV_BOLT_W / 2, by, WAV_BOLT_W, WAV_BOLT_H);
    ctx.fillStyle = "#FFD0C8";
    ctx.fillRect(bx - 0.75, by + 2, 1.5, WAV_BOLT_H - 4);
  }

  drawBursts(ctx, state, [...WAV_COLOURS, WAV_PURPLE, "#9AA3B2"], still);

  const moving = !still && Math.abs(state.aimX - state.shipX) > 1 && state.ended === 0;
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
