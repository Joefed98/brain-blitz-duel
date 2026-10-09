/**
 * Swing art pass. Render only: reads SwingState and never mutates it. The lava
 * surface is the sim's floor line, stalactites use the sim's spike polygon and
 * the figure stays inside the sim's 10 px body radius.
 */
import type { CanvasSize } from "./engine";
import {
  swingGame,
  swingMetres,
  SWING_FINISH_M,
  SWING_GOLD,
  SWING_WORLD_H,
  SWING_WORLD_W,
  type SwingState,
} from "./swing";
import { artHash, reducedMotion } from "./art.renderer";

/* Mirrors of private sim constants, used only to place art on the same geometry. */
const FP = 256;
const COL = 40 * FP;
const START_X = 3000 * FP;
const METRE = 40 * FP;
const SPIKE_HALF = 16;
const SPIKE_DEPTH = 56;

function lerpAt(arr: readonly number[], x: number): number {
  const i = Math.max(0, Math.min(arr.length - 2, Math.trunc(x / COL)));
  const f = x - i * COL;
  return arr[i]! + Math.trunc(((arr[i + 1]! - arr[i]!) * f) / COL);
}

export function drawSwingArt(ctx: CanvasRenderingContext2D, state: SwingState, size: CanvasSize): void {
  const still = reducedMotion();
  const t = still ? 0 : state.tick / 60;
  const scale = Math.min(size.width / SWING_WORLD_W, size.height / SWING_WORLD_H);
  const ox = (size.width - SWING_WORLD_W * scale) / 2;
  const oy = (size.height - SWING_WORLD_H * scale) / 2;
  ctx.save();
  ctx.clearRect(0, 0, size.width, size.height);
  ctx.translate(ox, oy);
  ctx.scale(scale, scale);
  ctx.beginPath();
  ctx.rect(0, 0, SWING_WORLD_W, SWING_WORLD_H);
  ctx.clip();
  const cam = state.camX / FP;
  const sx = (x: number) => x / FP - cam;
  const first = Math.max(0, Math.min(state.ceil.length - 2, Math.trunc(state.camX / COL) - 1));
  const last = Math.min(state.ceil.length - 1, first + 12);
  const ceilingAt = (x: number) => lerpAt(state.ceil, Math.round((x + cam) * FP)) / FP;
  // All cave scenery stays below the authoritative ceiling, not the screen edge.
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(sx(first * COL), ceilingAt(sx(first * COL)));
  for (let i = first + 1; i <= last; i++) ctx.lineTo(sx(i * COL), ceilingAt(sx(i * COL)));
  ctx.lineTo(sx(last * COL), SWING_WORLD_H);
  ctx.lineTo(sx(first * COL), SWING_WORLD_H);
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = "#08060A";
  ctx.fillRect(0, 0, SWING_WORLD_W, SWING_WORLD_H);

  // Cavern back wall: faint distant rock, slow parallax.
  ctx.fillStyle = "#120C10";
  ctx.beginPath();
  ctx.moveTo(0, SWING_WORLD_H);
  for (let x = -20; x <= SWING_WORLD_W + 20; x += 30) {
    const h = artHash(Math.floor((x + cam * 0.3) / 30));
    ctx.lineTo(x - ((cam * 0.3) % 30), 330 + (h % 70));
  }
  ctx.lineTo(SWING_WORLD_W, SWING_WORLD_H);
  ctx.fill();

  // Lava light cast up onto nearby rock.
  const lavaTop = Math.min(...state.floor.slice(first, last + 1)) / FP;
  const cast = ctx.createLinearGradient(0, lavaTop - 160, 0, lavaTop + 10);
  cast.addColorStop(0, "rgba(255,90,30,0)");
  cast.addColorStop(1, `rgba(255,90,30,${0.26 + (still ? 0 : 0.04 * Math.sin(t * 1.7))})`);
  ctx.fillStyle = cast;
  ctx.fillRect(0, lavaTop - 160, SWING_WORLD_W, 170);

  // Narrow rock band begins at the sim's ceiling line and faces down into the cave.
  ctx.beginPath();
  ctx.moveTo(sx(first * COL), ceilingAt(sx(first * COL)));
  for (let i = first + 1; i <= last; i++) ctx.lineTo(sx(i * COL), ceilingAt(sx(i * COL)));
  for (let i = last; i >= first; i--) ctx.lineTo(sx(i * COL), ceilingAt(sx(i * COL)) + 5);
  ctx.closePath();
  const rock = ctx.createLinearGradient(0, 0, 0, 110);
  rock.addColorStop(0, "#0E0B0E");
  rock.addColorStop(1, "#2A2024");
  ctx.fillStyle = rock;
  ctx.fill();
  ctx.strokeStyle = "rgba(255,170,120,0.22)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = first; i <= last; i++) {
    const x = sx(i * COL);
    const y = state.ceil[i]! / FP;
    if (i === first) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Stalactites: the sim's spike polygon in dark rock, some dripping lava.
  for (const s of state.spikes) {
    const x = sx(s.x);
    if (x < -40 || x > SWING_WORLD_W + 40) continue;
    const top = s.top / FP;
    // Intersection of cave ceiling and the unchanged full-width hazard envelope.
    ctx.save();
    ctx.beginPath();
    ctx.rect(Math.max(0, x - SPIKE_HALF), Math.max(0, top),
      Math.max(0, Math.min(SWING_WORLD_W, x + SPIKE_HALF) - Math.max(0, x - SPIKE_HALF)),
      Math.max(0, Math.min(SWING_WORLD_H, top + SPIKE_DEPTH) - Math.max(0, top)));
    ctx.clip();
    ctx.beginPath();
    ctx.moveTo(x - SPIKE_HALF, Math.max(top, ceilingAt(x - SPIKE_HALF)));
    ctx.lineTo(x - 8, Math.max(0, top + SPIKE_DEPTH));
    ctx.lineTo(x, Math.max(0, top + 24));
    ctx.lineTo(x + 8, Math.max(0, top + SPIKE_DEPTH));
    ctx.lineTo(x + SPIKE_HALF, Math.max(top, ceilingAt(x + SPIKE_HALF)));
    for (let px = x + SPIKE_HALF; px >= x - SPIKE_HALF; px -= 4) ctx.lineTo(px, Math.max(top, ceilingAt(px)));
    ctx.closePath();
    // Clip the rim to the sim's full-width, top-to-lowest-tip hazard zone.
    ctx.save();
    ctx.clip();
    const g = ctx.createLinearGradient(x - SPIKE_HALF, 0, x + SPIKE_HALF, 0);
    g.addColorStop(0, "#3A2C30");
    g.addColorStop(0.5, "#241A1E");
    g.addColorStop(1, "#140E11");
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,120,60,0.55)";
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();
    ctx.restore();
    const h = artHash(s.x);
    if (h % 3 === 0) {
      // Glowing lava seam on the tips, and a falling drip.
      for (const tip of [x - 8, x + 8]) {
        ctx.fillStyle = "#FF7A2A";
        ctx.beginPath();
        ctx.arc(tip, top + SPIKE_DEPTH - 1.5, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
      if (!still) {
        const cycle = ((state.tick + (h % 90)) % 90) / 90;
        const tip = (h >>> 3) % 2 ? x - 8 : x + 8;
        ctx.globalAlpha = 1 - cycle;
        ctx.fillStyle = "#FFB040";
        ctx.beginPath();
        ctx.arc(tip, top + SPIKE_DEPTH + cycle * 40, 1.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }

  // Distance posts every 100 m; 500 m is a gold gate.
  for (let m = 100; m <= SWING_FINISH_M; m += 100) {
    const x = sx(START_X + m * METRE);
    if (x < -30 || x > SWING_WORLD_W + 30) continue;
    const floorY = lerpAt(state.floor, START_X + m * METRE) / FP;
    const ceilY = lerpAt(state.ceil, START_X + m * METRE) / FP;
    if (m === SWING_FINISH_M) {
      const glow = ctx.createLinearGradient(x - 14, 0, x + 14, 0);
      glow.addColorStop(0, "rgba(245,184,46,0)");
      glow.addColorStop(0.5, "rgba(245,184,46,0.28)");
      glow.addColorStop(1, "rgba(245,184,46,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(x - 14, ceilY, 28, floorY - ceilY);
      ctx.strokeStyle = SWING_GOLD;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x - 10, floorY);
      ctx.lineTo(x - 10, ceilY);
      ctx.moveTo(x + 10, floorY);
      ctx.lineTo(x + 10, ceilY);
      ctx.stroke();
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(x, ceilY);
      ctx.lineTo(x, floorY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = SWING_GOLD;
      ctx.font = "700 13px 'JetBrains Mono', ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillText(`${m} m`, x, ceilY + 18);
    } else {
      ctx.strokeStyle = "rgba(255,255,255,0.18)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, floorY - 4);
      ctx.lineTo(x, floorY - 70);
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.font = "600 11px 'JetBrains Mono', ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillText(`${m} m`, x, floorY - 76);
    }
  }

  // Lava: surface on the sim floor line (waves within 1.5 px), crust at the edges.
  const wave = (wx: number) => (still ? 0 : Math.sin(wx * 0.045 + t * 1.2) * 1.2 + Math.sin(wx * 0.11 - t * 0.8) * 0.3);
  const surface: Array<[number, number]> = [];
  for (let px = -4; px <= SWING_WORLD_W + 4; px += 6) {
    surface.push([px, lerpAt(state.floor, Math.round((px + cam) * FP)) / FP + wave(px + cam)]);
  }
  ctx.beginPath();
  ctx.moveTo(-4, SWING_WORLD_H);
  for (const [px, py] of surface) ctx.lineTo(px, py);
  ctx.lineTo(SWING_WORLD_W + 4, SWING_WORLD_H);
  ctx.closePath();
  const lava = ctx.createLinearGradient(0, lavaTop, 0, SWING_WORLD_H);
  lava.addColorStop(0, "#FFB23A");
  lava.addColorStop(0.15, "#FF5A1F");
  lava.addColorStop(0.6, "#B3200F");
  lava.addColorStop(1, "#4A0B08");
  ctx.fillStyle = lava;
  ctx.fill();
  // Slow molten swirls inside.
  ctx.save();
  ctx.clip();
  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = "#FFE08A";
  ctx.lineWidth = 2;
  for (let k = 0; k < 3; k++) {
    ctx.beginPath();
    for (let px = 0; px <= SWING_WORLD_W; px += 10) {
      const y = lavaTop + 14 + k * 16 + Math.sin((px + cam) * 0.03 + t * (0.5 + k * 0.2) + k) * 4;
      if (px === 0) ctx.moveTo(px, y);
      else ctx.lineTo(px, y);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // Dark crust at the screen edges of the pool.
  for (const [x0, x1] of [[0, 40], [SWING_WORLD_W, SWING_WORLD_W - 40]] as const) {
    const crust = ctx.createLinearGradient(x0, 0, x1, 0);
    crust.addColorStop(0, "rgba(20,8,6,0.85)");
    crust.addColorStop(1, "rgba(20,8,6,0)");
    ctx.fillStyle = crust;
    ctx.fillRect(Math.min(x0, x1), lavaTop - 4, 40, SWING_WORLD_H);
  }
  // Floating crust plates.
  for (let k = Math.floor(cam / 90) - 1; k < Math.floor(cam / 90) + 6; k++) {
    const h = artHash(k, 77);
    if (h % 3) continue;
    const wx = k * 90 + (h % 60);
    const px = wx - cam;
    const py = lerpAt(state.floor, Math.round(wx * FP)) / FP + wave(wx) + 3;
    ctx.fillStyle = "rgba(40,14,10,0.75)";
    ctx.beginPath();
    ctx.ellipse(px, py + 1, 8 + (h >>> 4) % 8, 2.2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  // Glowing surface line.
  ctx.strokeStyle = "#FFD27A";
  ctx.lineWidth = 1.5;
  ctx.shadowColor = "rgba(255,140,40,0.9)";
  ctx.shadowBlur = 8;
  ctx.beginPath();
  surface.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Embers rising.
  if (!still) {
    for (let k = 0; k < 18; k++) {
      const h = artHash(k, 991);
      const life = 120 + (h % 80);
      const age = (state.tick + (h % life)) % life;
      const wx = Math.floor(cam / 400) * 400 + ((h >>> 5) % 520) - 60;
      const px = wx - cam + Math.sin(age * 0.05 + k) * 6;
      const base = lerpAt(state.floor, Math.round((px + cam) * FP)) / FP;
      const py = base - age * 0.9;
      ctx.globalAlpha = Math.max(0, 1 - age / life) * 0.8;
      ctx.fillStyle = k % 2 ? "#FFB040" : "#FF6A2A";
      ctx.fillRect(px, py, 1.6, 1.6);
    }
    ctx.globalAlpha = 1;
  }

  // Anchors: iron rings bolted in the rock.
  state.anchors.forEach((a, i) => {
    const x = sx(a.x);
    if (x < -20 || x > SWING_WORLD_W + 20) return;
    const flash = i === state.rope && state.tick - state.grabTick < 12;
    ctx.strokeStyle = flash ? SWING_GOLD : "#C9A25A";
    ctx.lineWidth = flash ? 4 : 2.5;
    ctx.beginPath();
    ctx.arc(x, a.y / FP, flash ? 8 : 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.beginPath();
    ctx.arc(x - 2, a.y / FP - 3, 1.2, 0, Math.PI * 2);
    ctx.fill();
  });

  const fx = sx(state.x);
  const fy = state.y / FP;
  let armX = -0.6;
  let armY = 0.8;
  if (state.rope >= 0) {
    const a = state.anchors[state.rope]!;
    const ax = sx(a.x);
    const ay = a.y / FP;
    // Thin textured rope: dark core with a twisted light dash.
    ctx.lineCap = "round";
    ctx.strokeStyle = "#6B4A2A";
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(fx, fy - 6);
    ctx.stroke();
    ctx.strokeStyle = "#D8B27A";
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
    const d = Math.hypot(ax - fx, ay - fy) || 1;
    armX = (ax - fx) / d;
    armY = (ay - fy) / d;
  } else {
    const d = Math.hypot(state.vx, state.vy) || 1;
    armX = -state.vx / d;
    armY = -state.vy / d;
  }

  const dead = state.ended === 2;
  // Figure inside the 10 px body radius: head, torso, arms to the rope, legs.
  const body = dead ? "#FF4D5E" : "#253541";
  ctx.strokeStyle = body;
  ctx.lineCap = "round";
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(fx, fy - 3);
  ctx.lineTo(fx + armX * 8, fy - 3 + armY * 8);
  ctx.moveTo(fx, fy - 3);
  ctx.lineTo(fx + armX * 7 + armY * 2, fy - 3 + armY * 7 - armX * 2);
  ctx.moveTo(fx, fy - 3);
  ctx.lineTo(fx, fy + 3);
  ctx.moveTo(fx, fy + 3);
  ctx.lineTo(fx - 3, fy + 9);
  ctx.moveTo(fx, fy + 3);
  ctx.lineTo(fx + 3, fy + 9);
  ctx.stroke();
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(fx, fy - 6.5, 3.4, 0, Math.PI * 2);
  ctx.fill();
  // Original hood/headband details stay inside the existing body footprint.
  ctx.strokeStyle="#86A5B3";ctx.lineWidth=.65;ctx.beginPath();ctx.arc(fx,fy-6.5,3.1,0,Math.PI*2);ctx.stroke();
  ctx.fillStyle="#D2EEF0";ctx.fillRect(fx-2.5,fy-7,5,1.5);
  ctx.fillStyle="#EB6BB3";ctx.fillRect(fx-3,fy-9,6,1.2);
  ctx.strokeStyle="#EB6BB3";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(fx-2.5,fy-8);ctx.lineTo(fx-7,fy-5);ctx.moveTo(fx-2.5,fy-8);ctx.lineTo(fx-5.5,fy-2);ctx.stroke();

  ctx.restore();
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "600 16px 'JetBrains Mono', ui-monospace, monospace";
  ctx.textAlign = "left";
  ctx.fillText(`${Math.min(SWING_FINISH_M, swingMetres(state))} / ${SWING_FINISH_M} m`, 14, 26);
  ctx.restore();
}

/** The sim with the art renderer swapped in; step/score are the sim's own. */
export const swingArtGame = { ...swingGame, draw: drawSwingArt };
