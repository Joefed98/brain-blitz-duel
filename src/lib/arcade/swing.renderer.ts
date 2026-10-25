import { successHud, successFrame, SUCCESS_ACCENTS } from "./success.renderer";
import { drawArtSprite } from "./sprites.renderer";
import { arcadeFx } from "./arcadeFx.renderer";
import { swingFxFor } from "./arcadeFxGames.renderer";
/**
 * Swing art pass. Render only: reads SwingState and never mutates it. The lava
 * surface is the sim's floor line, stalactites use the sim's spike polygon and
 * the figure stays inside the sim's 10 px body radius.
 */
import type { CanvasSize } from "./engine";
import {
  swingGame,
  swingGameFor,
  swingJetAt,
  swingMetres,
  SWING_CHASE_REACH,
  SWING_FINISH_M,
  SWING_JET_BUBBLE,
  SWING_JET_ERUPT,
  SWING_JET_HALF_W,
  SWING_REV,
  SWING_REV_BAND,
  SWING_ROCK_HALF_H,
  SWING_ROCK_HALF_W,
  SWING_ROCK_WARN,
  SWING_ROCK_WARN_V6,
  SWING_REV_TUNED,
  SWING_REV_TUNEC,
  SWING_REV_SPREAD,
  SWING_REV_TALL, SWING_REV_TARGET, SWING_REV_STRICT,
  SWING_STAR_R,
  swingStarTotal,
  SWING_GOLD,
  swingWorldH,
  SWING_WORLD_W,
  type SwingState,
} from "./swing";
import { artHash, reducedMotion } from "./art.renderer";
import { arcadeReducedEffects } from "@/lib/fx/lowEnd";
import { drawHero, heroPose } from "./hero.renderer";
import { ANG_PER_RAD } from "./trig";

/** Grappler's hero pose (stick figure joints, 3.4 px head, 2.4 px stick), refilled every frame. */
const grapplerHero = Object.assign(heroPose(), { headR: 3.4, stick: 2.4 });
/** The sim's angle units per radian on a rope (swing.ts's SUB × ANG_PER_RAD): om / ROPE_RAD is radians a tick. */
const ROPE_RAD = 16 * ANG_PER_RAD;
import { drawGrapplerDragon } from "./grapplerDragon.renderer";
import { drawGrapplerDragonV3 } from "./grapplerDragonV3.renderer";

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

/** The game's drawing through the shared success layer (presentation only). */
export function drawSwingArt(ctx: CanvasRenderingContext2D, state: SwingState, size: CanvasSize): void {
  arcadeFx(ctx, swingFxFor(state), state, () => drawSwingArtWorld(ctx, state, size), size);
}

function drawSwingArtWorld(ctx: CanvasRenderingContext2D, state: SwingState, size: CanvasSize): void {
  // swingRev 9: the taller cavern (its lava 110 px lower); 620 on every earlier revision.
  const SWING_WORLD_H = swingWorldH(state);
  const deep = SWING_WORLD_H - 620;
  const still = reducedMotion();
  // Reduced effects (lib/fx/lowEnd.ts, slow devices only): no distant parallax rock, lava light,
  // molten swirls, floating crust or soft surface glow. Nothing that collides or scores is skipped.
  const lite = arcadeReducedEffects();
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
  // Polish G: the solid rock above the ceiling line (the sim's boundary), shaded and faceted.
  drawRockMass(ctx, state, first, last, sx);
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

  // Cavern back wall: a deep warm haze, then two layers of distant rock at slow parallax.
  const haze = ctx.createLinearGradient(0, 80, 0, SWING_WORLD_H);
  haze.addColorStop(0, "#0A070B");
  haze.addColorStop(0.6, "#160B0C");
  haze.addColorStop(1, "#2A0D08");
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, SWING_WORLD_W, SWING_WORLD_H);
  // Polish A4 (25 Oct 2026, display only): a far ceiling of stalactites at slow parallax, behind
  // everything and darker than any hazard, so it reads as distance (the near ceiling's own spikes are the sim's).
  if (!lite) drawFarStalactites(ctx, cam, SWING_WORLD_W);
  // The distant rock keeps its height above the lava.
  for (const [par, base, span, colour, step] of lite ? [] : ([[0.15, 250 + deep, 90, "#160D10", 46], [0.3, 330 + deep, 70, "#21131A", 30]] as const)) {
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.moveTo(-20, SWING_WORLD_H);
    const off = (cam * par) % step;
    const k0 = Math.floor((cam * par) / step);
    for (let k = -1; k <= SWING_WORLD_W / step + 2; k++) {
      const h = artHash(k0 + k, step);
      ctx.lineTo(k * step - off, base + (h % span));
    }
    ctx.lineTo(SWING_WORLD_W + 20, SWING_WORLD_H);
    ctx.closePath();
    ctx.fill();
    // Polish A4: the layer's face warms towards the lava below it, and its ridge catches an orange rim light.
    ctx.save();
    ctx.clip();
    const face = ctx.createLinearGradient(0, base, 0, SWING_WORLD_H);
    face.addColorStop(0, "rgba(255,110,50,0)");
    face.addColorStop(1, `rgba(255,96,40,${par > 0.2 ? 0.2 : 0.12})`);
    ctx.fillStyle = face;
    ctx.fillRect(0, base, SWING_WORLD_W, SWING_WORLD_H - base);
    ctx.restore();
    ctx.strokeStyle = par > 0.2 ? "rgba(255,138,70,0.34)" : "rgba(255,120,70,0.2)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  // Lava light cast up onto nearby rock.
  const lavaTop = Math.min(...state.floor.slice(first, last + 1)) / FP;
  if (!lite) {
    // Polish A4: a taller, warmer glow over the lower cave, breathing slowly with the lava.
    const cast = ctx.createLinearGradient(0, lavaTop - 260, 0, lavaTop + 10);
    cast.addColorStop(0, "rgba(255,90,30,0)");
    cast.addColorStop(0.55, `rgba(255,100,36,${0.1 + (still ? 0 : 0.02 * Math.sin(t * 1.7))})`);
    cast.addColorStop(1, `rgba(255,96,30,${0.34 + (still ? 0 : 0.05 * Math.sin(t * 1.7))})`);
    ctx.fillStyle = cast;
    ctx.fillRect(0, lavaTop - 260, SWING_WORLD_W, SWING_WORLD_H - lavaTop + 260);
  }

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
    g.addColorStop(0, "#54404A");
    g.addColorStop(0.35, "#33262B");
    g.addColorStop(0.7, "#1E1519");
    g.addColorStop(1, "#110B0E");
    ctx.fillStyle = g;
    ctx.fill();
    // Lava light from below warms the tips; a lit ridge runs down each point (inside the polygon).
    const warm = ctx.createLinearGradient(0, top + SPIKE_DEPTH - 22, 0, top + SPIKE_DEPTH);
    warm.addColorStop(0, "rgba(255,110,40,0)");
    warm.addColorStop(1, "rgba(255,110,40,0.35)");
    ctx.fillStyle = warm;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,214,170,0.28)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - 13, Math.max(top, ceilingAt(x - 13)) + 4);
    ctx.lineTo(x - 8.5, top + SPIKE_DEPTH - 4);
    ctx.moveTo(x + 2, top + 18);
    ctx.lineTo(x + 6.5, top + SPIKE_DEPTH - 8);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,120,60,0.6)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x - SPIKE_HALF, Math.max(top, ceilingAt(x - SPIKE_HALF)));
    ctx.lineTo(x - 8, Math.max(0, top + SPIKE_DEPTH));
    ctx.lineTo(x, Math.max(0, top + 24));
    ctx.lineTo(x + 8, Math.max(0, top + SPIKE_DEPTH));
    ctx.lineTo(x + SPIKE_HALF, Math.max(top, ceilingAt(x + SPIKE_HALF)));
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

  for (const [i, dragon] of (state.dragons ?? []).entries()) {
    const x = sx(dragon.x);
    if (x < -30 || x > SWING_WORLD_W + 30) continue;
    const phase = still ? 0 : Math.floor(state.tick / 8) + i * 2;
    if (dragon.hw > 20 * FP) drawGrapplerDragonV3(ctx, x, dragon.y / FP, phase);
    else drawGrapplerDragon(ctx, x, dragon.y / FP, phase);
  }

  // swingRev 4: loose stalactites. Hanging, they look cracked; warning, they shake and throw a
  // shadow on the lava below; falling, the rock fills its 18 × 32 hit box.
  for (const r of state.rocks ?? []) {
    if (r.phase === 3) continue;
    const x = sx(r.x);
    if (x < -30 || x > SWING_WORLD_W + 30) continue;
    const hw = SWING_ROCK_HALF_W / FP;
    const hh = SWING_ROCK_HALF_H / FP;
    const floorY = lerpAt(state.floor, r.x) / FP;
    let cy = r.phase === 2 ? r.y / FP : r.top / FP + hh;
    let shake = 0;
    if (r.phase === 1 && !still) shake = Math.sin(state.tick * 2.3) * 1.5;
    const warnTicks = state.tuned ? SWING_ROCK_WARN_V6 : SWING_ROCK_WARN;
    if (r.phase === 1 && state.tuned) {
      // swingRev 6: no warning line; grit and chips crumble off the stalactite, more as the drop nears.
      drawCrumble(ctx, x, r.top / FP + hh * 2, floorY, r.t / warnTicks, r.t, r.x, still);
    }
    if (r.phase >= 1 && state.tuned) {
      const k = r.phase === 1 ? r.t / warnTicks : 1;
      ctx.fillStyle = `rgba(0,0,0,${0.25 + 0.35 * k})`;
      ctx.beginPath();
      ctx.ellipse(x, floorY - 2, hw * (0.6 + 0.8 * k), 3 + 2 * k, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (r.phase >= 1) {
      // Shadow on the lava: grows and darkens as the drop nears.
      const k = r.phase === 1 ? r.t / warnTicks : 1;
      ctx.fillStyle = `rgba(0,0,0,${0.35 + 0.35 * k})`;
      ctx.beginPath();
      ctx.ellipse(x, floorY - 2, hw * (0.6 + 0.8 * k), 3 + 2 * k, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(255,77,94,${0.4 + 0.4 * k})`;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 5]);
      ctx.beginPath();
      ctx.moveTo(x, cy + hh + 2);
      ctx.lineTo(x, floorY - 6);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (r.phase === 2 && !still) {
      ctx.fillStyle = "rgba(255,200,160,0.18)";
      ctx.fillRect(x - hw + 3, cy - hh - 18, hw * 2 - 6, 18);
    }
    cy = Math.round(cy);
    const left = x - hw + shake;
    const stone = ctx.createLinearGradient(left, 0, left + hw * 2, 0);
    stone.addColorStop(0, r.phase === 0 ? "#6A565C" : "#8A6E74");
    stone.addColorStop(0.55, r.phase === 0 ? "#45363A" : "#62494F");
    stone.addColorStop(1, r.phase === 0 ? "#2A1F23" : "#3E2C31");
    ctx.fillStyle = stone;
    ctx.strokeStyle = r.phase === 0 ? "rgba(255,170,120,0.45)" : "#FF4D5E";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(left, cy - hh);
    ctx.lineTo(left + hw * 2, cy - hh);
    ctx.lineTo(left + hw * 1.4, cy + hh * 0.3);
    ctx.lineTo(left + hw, cy + hh);
    ctx.lineTo(left + hw * 0.6, cy + hh * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "rgba(0,0,0,0.6)";
    ctx.beginPath();
    ctx.moveTo(left + hw * 0.7, cy - hh + 3);
    ctx.lineTo(left + hw * 1.1, cy - hh * 0.2);
    ctx.lineTo(left + hw * 0.9, cy + hh * 0.2);
    ctx.stroke();
  }

  // swingRev 4: the chasing dragon, its jaws on the catch line.
  if ((state.chaseX ?? 0) !== 0) {
    const x = sx((state.chaseX ?? 0) + SWING_CHASE_REACH - 32 * FP);
    if (x > -40 && x < SWING_WORLD_W + 40) drawGrapplerDragonV3(ctx, x, (state.chaseY ?? 0) / FP, still ? 0 : Math.floor(state.tick / 6));
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
  if (!lite) for (let k = 0; k < 3; k++) {
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
  // Polish A4: a bright highlight flowing along under the surface.
  if (!lite) {
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = "rgba(255,214,120,0.22)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let px = -4; px <= SWING_WORLD_W + 4; px += 8) {
      const flow = still ? 0 : t * 22;
      const y = lerpAt(state.floor, Math.round((px + cam) * FP)) / FP + wave(px + cam) + 7 + Math.sin((px + cam - flow) * 0.06) * 2.2;
      if (px === -4) ctx.moveTo(px, y);
      else ctx.lineTo(px, y);
    }
    ctx.stroke();
    ctx.globalCompositeOperation = "source-over";
  }
  // Floating crust plates, each with a glowing molten edge.
  if (!lite) for (let k = Math.floor(cam / 90) - 1; k < Math.floor(cam / 90) + 6; k++) {
    const h = artHash(k, 77);
    if (h % 3) continue;
    const wx = k * 90 + (h % 60);
    const px = wx - cam;
    const py = lerpAt(state.floor, Math.round(wx * FP)) / FP + wave(wx) + 3;
    const rx = 8 + (h >>> 4) % 8;
    ctx.fillStyle = "rgba(255,170,70,0.55)";
    ctx.beginPath();
    ctx.ellipse(px, py + 1, rx + 1.6, 3.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(40,14,10,0.85)";
    ctx.beginPath();
    ctx.ellipse(px, py + 1, rx, 2.2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Polish A4: bubbles swelling and popping on the surface, each on its own seeded beat.
  if (!lite && !still) for (let k = Math.floor(cam / 60) - 1; k < Math.floor(cam / 60) + 8; k++) {
    const h = artHash(k, 131);
    if (h % 2) continue;
    const life = 70 + (h % 50);
    const age = (state.tick + ((h >>> 6) % life)) % life;
    const wx = k * 60 + ((h >>> 3) % 50);
    const px = wx - cam;
    const py = lerpAt(state.floor, Math.round(wx * FP)) / FP + wave(wx) + 4;
    const grow = age / life;
    if (grow < 0.85) {
      const r = 1 + grow * 3.2;
      ctx.fillStyle = "rgba(120,24,10,0.6)";
      ctx.beginPath();
      ctx.arc(px, py, r, Math.PI, 0);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,226,150,0.85)";
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.arc(px, py, r, Math.PI * 1.05, Math.PI * 1.6);
      ctx.stroke();
    } else {
      const pop = (grow - 0.85) / 0.15;
      ctx.strokeStyle = `rgba(255,214,130,${(1 - pop) * 0.8})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(px, py, 4 + pop * 5, 1.4 + pop, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.restore();
  // Glowing surface line.
  // Polish G: the glow is two soft strokes above the surface (no shadowBlur), then the bright line.
  if (!lite) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, SWING_WORLD_W, SWING_WORLD_H);
    ctx.moveTo(-4, SWING_WORLD_H);
    for (const [px, py] of surface) ctx.lineTo(px, py);
    ctx.lineTo(SWING_WORLD_W + 4, SWING_WORLD_H);
    ctx.closePath();
    ctx.clip("evenodd");
    ctx.beginPath();
    surface.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
    ctx.lineJoin = "round";
    ctx.strokeStyle = "rgba(255,120,40,0.16)";
    ctx.lineWidth = 14;
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,150,60,0.3)";
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.restore();
  }
  ctx.strokeStyle = "#FFD27A";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  surface.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
  ctx.stroke();
  // Bright ripple glints riding the surface.
  ctx.strokeStyle = "rgba(255,240,190,0.7)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let k = Math.floor(cam / 70) - 1; k < Math.floor(cam / 70) + 7; k++) {
    const h = artHash(k, 59);
    const wx = k * 70 + (h % 40) + (still ? 0 : Math.sin(t * 0.9 + k) * 6);
    const px = wx - cam;
    const py = lerpAt(state.floor, Math.round(wx * FP)) / FP + wave(wx) + 5 + (h >>> 7) % 10;
    ctx.moveTo(px, py);
    ctx.lineTo(px + 6 + (h >>> 3) % 8, py);
  }
  ctx.stroke();

  // swingRev 4 lava jets: bubbles on the surface during the warning, then a molten column
  // as tall and as wide as the sim's jet.
  for (const jet of state.jets ?? []) {
    const x = sx(jet.x);
    if (x < -30 || x > SWING_WORLD_W + 30) continue;
    const floorY = lerpAt(state.floor, jet.x) / FP;
    const { h, bubbling } = swingJetAt(jet, state.tick);
    const half = SWING_JET_HALF_W / FP;
    if (bubbling) {
      const c = (state.tick + jet.phase) % jet.period;
      const k = (c - (jet.period - SWING_JET_ERUPT - SWING_JET_BUBBLE)) / SWING_JET_BUBBLE;
      ctx.fillStyle = "rgba(255,220,140,0.9)";
      for (let b = 0; b < 4; b++) {
        const age = still ? 0.5 : ((state.tick * 0.07 + b * 0.27) % 1);
        ctx.globalAlpha = (1 - age) * (0.5 + 0.5 * k);
        ctx.beginPath();
        ctx.arc(x + (b - 1.5) * 6, floorY - 2 - age * 10 * k, 1.5 + 2 * k, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.strokeStyle = `rgba(255,120,40,${0.3 + 0.5 * k})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(x, floorY, half, 3, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (h > 0) {
      const top = floorY - h / FP;
      const g = ctx.createLinearGradient(0, top, 0, floorY);
      g.addColorStop(0, "#FFE08A");
      g.addColorStop(0.3, "#FF8A2A");
      g.addColorStop(1, "#C3260F");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x - half, floorY);
      ctx.lineTo(x - half + 2, top + 6);
      ctx.quadraticCurveTo(x, top - 4, x + half - 2, top + 6);
      ctx.lineTo(x + half, floorY);
      ctx.closePath();
      ctx.fill();
    }
  }

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
      const fade = Math.max(0, 1 - age / life);
      // Polish A4: each ember carries a soft glow (skipped with reduced effects).
      if (!lite) {
        ctx.globalAlpha = fade * 0.35;
        ctx.fillStyle = "#FF7A2A";
        ctx.beginPath();
        ctx.arc(px + 0.8, py + 0.8, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = fade * 0.9;
      ctx.fillStyle = k % 2 ? "#FFC860" : "#FF6A2A";
      ctx.fillRect(px, py, 1.6, 1.6);
    }
    ctx.globalAlpha = 1;
  }

  // swingRev 6: star pickups, taken by touching them.
  const spotsTaken = new Set(state.starSpots ? (state.starsTaken ?? []) : []);
  (state.starSpots ?? []).forEach(([wx, wy], i) => {
    if (spotsTaken.has(i)) return;
    const x = sx(wx);
    if (x < -20 || x > SWING_WORLD_W + 20) return;
    drawCoin(ctx, x, wy / FP, SWING_STAR_R / FP, still ? 0 : state.tick + i * 17, lite);
  });

  // Anchors: iron rings bolted in the rock.
  const starAt = new Set(state.starAnchors ?? []);
  const taken = new Set(state.starsTaken ?? []);
  state.anchors.forEach((a, i) => {
    const x = sx(a.x);
    if (x < -20 || x > SWING_WORLD_W + 20) return;
    // swingRev 4: a gold star around each star anchor until it is taken.
    if (starAt.has(i) && !taken.has(i)) drawCoin(ctx, x, a.y / FP, 11, still ? 0 : state.tick, lite);
    const flash = i === state.rope && state.tick - state.grabTick < 12;
    // Art pilot (Cave & Lava): anchor sprite at the ring's size; the gold grab flash stays code-drawn.
    if (!flash && drawArtSprite(ctx, "cavelava", "anchor", x - 6, a.y / FP - 6, 12, 12)) return;
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

  const anchor=state.anchors[state.rope];
  if(anchor)successFrame(ctx,{id:'swing',tick:state.tick,count:Math.max(0,state.rope),eventTick:state.grabTick,colour:SWING_GOLD,width:SWING_WORLD_W,height:SWING_WORLD_H,point:{x:sx(anchor.x),y:anchor.y/FP,shape:'spark'}});
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

  // The Joulz hero on the stick figure's joints, inside the 10 px body radius: head, torso, arms to the rope, legs.
  const dead = state.ended === 2;
  const hero = grapplerHero;
  hero.headX = fx; hero.headY = fy - 6.5;
  hero.neckX = fx; hero.neckY = fy - 3;
  hero.hipX = fx; hero.hipY = fy + 3;
  hero.shoulderX = fx; hero.shoulderY = fy - 3;
  hero.handAX = fx + armX * 8; hero.handAY = fy - 3 + armY * 8;
  hero.handBX = fx + armX * 7 + armY * 2; hero.handBY = fy - 3 + armY * 7 - armX * 2;
  hero.footAX = fx - 3; hero.footAY = fy + 9;
  hero.footBX = fx + 3; hero.footBY = fy + 9;
  // Velocity in px a tick: on a rope the sim keeps only the angular rate, so the swing's is its tangent.
  let vx = state.vx / FP;
  let vy = state.vy / FP;
  if (state.rope >= 0) {
    const a = state.anchors[state.rope]!;
    const turn = state.om / ROPE_RAD;
    vx = (fy - a.y / FP) * turn;
    vy = -(fx - sx(a.x)) * turn;
  }
  const speed = Math.hypot(vx, vy);
  hero.moveX = vx;
  hero.moveY = vy;
  hero.speed = Math.min(1, speed / 8);
  hero.face = speed > 0 ? vx / speed : 0;
  hero.core = dead ? "#FF4D5E" : null;
  hero.gentle = still;
  drawHero(ctx, hero);

  // swingRev 4 edge warnings: the dragon behind (off the left edge) and a shadow ahead (off the right).
  if (state.rev === SWING_REV && state.ended === 0) {
    const chase = state.chaseX ?? 0;
    if (chase !== 0) {
      const behind = Math.max(0, Math.trunc((state.x - chase - SWING_CHASE_REACH) / (40 * FP)));
      if (sx(chase + SWING_CHASE_REACH) < 0) {
        ctx.fillStyle = behind < 4 ? "#FF4D5E" : "#FF7884";
        ctx.beginPath();
        ctx.moveTo(4, state.y / FP);
        ctx.lineTo(16, state.y / FP - 9);
        ctx.lineTo(16, state.y / FP + 9);
        ctx.closePath();
        ctx.fill();
        // The distance label grows as the dragon closes in (display only, every revision).
        const k = swingDragonLabelScale(behind);
        if (k > 0) {
          const px = Math.round(SWING_DRAGON_LABEL_PX * k * 10) / 10;
          const ty = Math.max(px + 4, Math.min(SWING_WORLD_H - 6, state.y / FP + px * 0.36));
          ctx.font = `800 ${px}px 'JetBrains Mono', ui-monospace, monospace`;
          ctx.textAlign = "left";
          ctx.lineJoin = "round";
          ctx.lineWidth = Math.max(2, px * 0.22);
          ctx.strokeStyle = "rgba(7,7,13,0.85)";
          ctx.strokeText(`DRAGON ${behind} m`, 20, ty);
          ctx.fillText(`DRAGON ${behind} m`, 20, ty);
        }
      }
    }
    for (const r of state.rocks ?? []) {
      if (r.phase !== 1 || sx(r.x) <= SWING_WORLD_W - 4) continue;
      const y = lerpAt(state.floor, r.x) / FP - 18;
      ctx.fillStyle = "#FF4D5E";
      ctx.beginPath();
      ctx.moveTo(SWING_WORLD_W - 4, y);
      ctx.lineTo(SWING_WORLD_W - 16, y - 8);
      ctx.lineTo(SWING_WORLD_W - 16, y + 8);
      ctx.closePath();
      ctx.fill();
      ctx.font = "800 12px 'JetBrains Mono', ui-monospace, monospace";
      ctx.textAlign = "right";
      ctx.fillText("!", SWING_WORLD_W - 18, y + 4);
    }
  }

  ctx.restore();
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "600 16px 'JetBrains Mono', ui-monospace, monospace";
  ctx.textAlign = "left";
  successHud(ctx,'swing',state.tick,14,26,()=>ctx.fillText(`${Math.min(SWING_FINISH_M,swingMetres(state))} / ${SWING_FINISH_M} m`,14,26));
  if (state.rev === SWING_REV) {
    ctx.fillStyle = SWING_GOLD;
    ctx.textAlign = "right";
    const label = `${state.stars ?? 0} / ${swingStarTotal(state)}`;
    ctx.fillText(label, SWING_WORLD_W - 14, 26);
    drawCoin(ctx, SWING_WORLD_W - 22 - ctx.measureText(label).width, 20, 8, 0, true);
    ctx.textAlign = "left";
  }
  ctx.restore();
}

/**
 * swingRev 6 stalactite warning: chips and grit break off the stalactite's tip
 * and fall to the lava, a few at first and a shower just before it drops (k
 * 0 → 1). Positions are a closed form of the warning tick; presentation only.
 */
function drawCrumble(ctx: CanvasRenderingContext2D, x: number, tipY: number, floorY: number, k: number, t: number, seed: number, still: boolean): void {
  const count = 3 + Math.floor(k * 10);
  ctx.save();
  for (let n = 0; n < count; n++) {
    const h = artHash(seed, n + 1) / 4294967296;
    // Each chip leaves every 30 ticks or so on its own beat, falling under gravity.
    const life = 30;
    const age = still ? 6 + n * 3 : (t + Math.floor(h * life)) % life;
    const fall = 0.12 * age * age;
    const cy = tipY + fall;
    if (cy > floorY - 4) continue;
    const cx = x + (artHash(seed, n + 50) / 4294967296 - 0.5) * 12 + (artHash(seed, n + 90) / 4294967296 - 0.5) * age * 0.3;
    const size = n % 3 === 0 ? 4 : 2.4;
    ctx.globalAlpha = 0.9 - age / (life * 1.6);
    ctx.fillStyle = n % 3 === 0 ? "#6A5258" : "#B89A8E";
    ctx.fillRect(cx - size / 2, cy - size / 2, size, size);
  }
  ctx.restore();
}

/**
 * Polish A4 (25 Oct 2026, display only): a pickup is a glowing gold coin (radius r, the pickup's own
 * radius) with a small raised star on its face, slowly catching the light. The glow round it is
 * light, not a body; with reduced effects (`flat`) only the coin is drawn.
 */
function drawCoin(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, tick: number, flat: boolean): void {
  ctx.save();
  if (!flat) {
    const glow = ctx.createRadialGradient(cx, cy, r * 0.6, cx, cy, r * 2.1);
    glow.addColorStop(0, `rgba(255,214,90,${0.38 + 0.12 * Math.sin(tick * 0.09)})`);
    glow.addColorStop(1, "rgba(255,180,60,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 2.1, 0, Math.PI * 2);
    ctx.fill();
  }
  // Rim, then the face a little inside it.
  const rim = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  rim.addColorStop(0, "#FFE9A0");
  rim.addColorStop(0.5, "#E8A520");
  rim.addColorStop(1, "#8A5A10");
  ctx.fillStyle = rim;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  const face = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.1, cx, cy, r * 0.8);
  face.addColorStop(0, "#FFF2A8");
  face.addColorStop(0.6, "#FFD84A");
  face.addColorStop(1, "#E3A124");
  ctx.fillStyle = face;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.78, 0, Math.PI * 2);
  ctx.fill();
  // The raised star: a dark under-edge, then the gold star.
  const star = (dy: number) => {
    ctx.beginPath();
    for (let p = 0; p < 10; p++) {
      const rad = p % 2 === 0 ? r * 0.52 : r * 0.23;
      const a = -Math.PI / 2 + (p * Math.PI) / 5;
      if (p === 0) ctx.moveTo(cx + Math.cos(a) * rad, cy + dy + Math.sin(a) * rad);
      else ctx.lineTo(cx + Math.cos(a) * rad, cy + dy + Math.sin(a) * rad);
    }
    ctx.closePath();
  };
  ctx.fillStyle = "rgba(138,90,16,0.75)";
  star(Math.max(0.6, r * 0.07));
  ctx.fill();
  ctx.fillStyle = "#FFF6C8";
  star(0);
  ctx.fill();
  // A glint that slides across the face now and then.
  const sweep = ((tick % 150) / 150) * 3 - 1;
  if (sweep > -0.8 && sweep < 0.8) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.78, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.beginPath();
    ctx.moveTo(cx + sweep * r - r * 0.2, cy - r);
    ctx.lineTo(cx + sweep * r + r * 0.05, cy - r);
    ctx.lineTo(cx + sweep * r - r * 0.25, cy + r);
    ctx.lineTo(cx + sweep * r - r * 0.5, cy + r);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.beginPath();
  ctx.arc(cx - r * 0.42, cy - r * 0.42, Math.max(0.7, r * 0.1), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Polish A4: the far ceiling, a dark band with hanging stalactites at a slow parallax behind the
 * cave (between the back wall and the near rock). Scenery only: nothing in it collides.
 */
function drawFarStalactites(ctx: CanvasRenderingContext2D, cam: number, width: number): void {
  const par = 0.22;
  const step = 22;
  const off = (cam * par) % step;
  const k0 = Math.floor((cam * par) / step);
  const roof = (k: number) => 100 + (artHash(k0 + k, 401) % 26);
  ctx.save();
  ctx.fillStyle = "rgba(62,36,40,0.4)";
  ctx.beginPath();
  ctx.moveTo(-step, 0);
  for (let k = -1; k <= width / step + 2; k++) {
    const x = k * step - off;
    const h = artHash(k0 + k, 313);
    const y = roof(k);
    ctx.lineTo(x, y);
    // About two in three joints carry a stalactite of seeded length.
    if (h % 3) {
      const len = 8 + (h >>> 4) % 20;
      const w = 4 + (h >>> 9) % 5;
      ctx.lineTo(x + step * 0.5 - w, y + 2);
      ctx.lineTo(x + step * 0.5, y + len);
      ctx.lineTo(x + step * 0.5 + w, y + 2);
    }
  }
  ctx.lineTo(width + step * 2, 0);
  ctx.closePath();
  ctx.fill();
  // Lava light catches the stalactites' tips faintly from far below.
  const warm = ctx.createLinearGradient(0, 110, 0, 150);
  warm.addColorStop(0, "rgba(255,110,50,0)");
  warm.addColorStop(1, "rgba(255,110,50,0.22)");
  ctx.clip();
  ctx.fillStyle = warm;
  ctx.fillRect(0, 100, width, 60);
  ctx.restore();
}

/**
 * Polish G: the solid rock above the ceiling line, which the sim never lets
 * the player into: a dark gradient with hashed facets anchored to the course,
 * a lit lip along the ceiling line. Drawn before the cave so nothing hides.
 */
function drawRockMass(ctx: CanvasRenderingContext2D, state: SwingState, first: number, last: number, sx: (x: number) => number): void {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(sx(first * COL), -2);
  for (let i = first; i <= last; i++) ctx.lineTo(sx(i * COL), state.ceil[i]! / FP);
  ctx.lineTo(sx(last * COL), -2);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, 0, 0, 110);
  g.addColorStop(0, "#0C090B");
  g.addColorStop(1, "#241A1D");
  ctx.fillStyle = g;
  ctx.fill();
  ctx.clip();
  // Facets: each course column gets a lighter and a darker plane.
  for (let i = first; i < last; i++) {
    const h = artHash(i, 211);
    const x0 = sx(i * COL), x1 = sx((i + 1) * COL);
    const y0 = state.ceil[i]! / FP, y1 = state.ceil[i + 1]! / FP;
    const up = 14 + (h % 26);
    ctx.fillStyle = h % 3 === 0 ? "rgba(255,200,170,0.05)" : "rgba(0,0,0,0.22)";
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x0 + (x1 - x0) * (0.3 + ((h >>> 5) % 40) / 100), Math.min(y0, y1) - up);
    ctx.lineTo(x1, y1);
    ctx.closePath();
    ctx.fill();
    if (h % 5 === 0) {
      ctx.fillStyle = "rgba(255,150,90,0.25)";
      ctx.fillRect(x0 + (h >>> 8) % 30, Math.min(y0, y1) - 10 - (h >>> 11) % 20, 1.5, 1.5);
    }
  }
  ctx.restore();
  // Warm lit lip just above the ceiling line.
  ctx.strokeStyle = "rgba(255,150,100,0.14)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  for (let i = first; i <= last; i++) {
    const y = state.ceil[i]! / FP - 2;
    if (i === first) ctx.moveTo(sx(i * COL), y);
    else ctx.lineTo(sx(i * COL), y);
  }
  ctx.stroke();
}

/** The "DRAGON N m" label's full size (world px), reached at 10 m or closer. */
export const SWING_DRAGON_LABEL_PX = 16;
/**
 * The label's size as a share of full size for the dragon `metres` behind:
 * 1 at 10 m or closer, easing smoothly down to 0.55 at 40 m, 0.55 from 40 to
 * 50 m, and 0 (hidden) beyond 50 m. Never larger further away.
 */
export function swingDragonLabelScale(metres: number): number {
  if (metres > 50) return 0;
  if (metres >= 40) return 0.55;
  if (metres <= 10) return 1;
  const t = (metres - 10) / 30;
  return 1 - 0.45 * t * t * (3 - 2 * t);
}

/** The sim with the art renderer swapped in; step/score are the sim's own. */
export const swingArtGame ={ ...swingGame, draw: drawSwingArt };
const dragonArtGameV2 = { ...swingGameFor(2), draw: drawSwingArt };
const dragonArtGameV3 = { ...swingGameFor(3), draw: drawSwingArt };
const chaseArtGameV4 = { ...swingGameFor(SWING_REV), draw: drawSwingArt };
const bandArtGameV5 = { ...swingGameFor(SWING_REV_BAND), draw: drawSwingArt };
const tunedArtGameV6 = { ...swingGameFor(SWING_REV_TUNED), draw: drawSwingArt };
const tunecArtGameV7 = { ...swingGameFor(SWING_REV_TUNEC), draw: drawSwingArt };
const spreadArtGameV8 = { ...swingGameFor(SWING_REV_SPREAD), draw: drawSwingArt };
const tallArtGameV9 = { ...swingGameFor(SWING_REV_TALL), draw: drawSwingArt };
const tallArtGameV9Target = { ...swingGameFor(SWING_REV_TARGET), draw: drawSwingArt };
const tallArtGameV9Strict = { ...swingGameFor(SWING_REV_STRICT), draw: drawSwingArt };
export function swingArtGameFor(rev?: number): typeof swingArtGame {
  if (rev === SWING_REV_STRICT) return tallArtGameV9Strict;
  if (rev === SWING_REV_TARGET) return tallArtGameV9Target;
  if (rev === SWING_REV_TALL) return tallArtGameV9;
  if (rev === SWING_REV_SPREAD) return spreadArtGameV8;
  if (rev === SWING_REV_TUNEC) return tunecArtGameV7;
  if (rev === SWING_REV_TUNED) return tunedArtGameV6;
  if (rev === SWING_REV_BAND) return bandArtGameV5;
  if (rev === SWING_REV) return chaseArtGameV4;
  if (rev === 3) return dragonArtGameV3;
  if (rev === 2) return dragonArtGameV2;
  return swingArtGame;
}
