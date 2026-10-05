/** Lava-tube artwork only. Never mutates the simulation or changes its geometry. */
import type { CanvasSize } from "./engine";
import {
  flipGame, flipWarpAt, FLIP_ARC_TICKS, FLIP_CEIL_Y, FLIP_FLOOR_Y,
  FLIP_GAP, FLIP_RED, FLIP_SPIKE, FLIP_WORLD_H, FLIP_WORLD_W,
  type FlipState,
} from "./flip";
import { drawFlipHazard, flipSurfaceLine } from "./flip.renderer";
import { artHash, reducedMotion } from "./art.renderer";

const FP = 256;
const RUNNER_X = 90;
const SPIKE_HEIGHT = 22;
const OVERHANG_DEPTH = 34;
/** Canvas-only material tokens shared by every part of this renderer. */
const MATERIAL = {
  wash: "rgba(8,7,10,0.76)", tunnel: "#0B0C10", basalt: "#17171C",
  nearRock: "#202027", farRock: "#101116", seam: "#303039",
  lava: "#FF4A24", hot: "#FFAA46", core: "#E73720", obsidian: "#090A0D",
  robot: "#AEB5BA", armour: "#59636D", visor: "#1B2229",
  lamp: "#FFE4A1", dust: "rgba(161,153,147,0.22)",
};
type Surface = (x: number) => number;

function runnerY(side: number, flipT: number): number {
  const target = side === 0 ? FLIP_FLOOR_Y - 14 : FLIP_CEIL_Y + 14;
  if (flipT <= 0) return target;
  const from = side === 0 ? FLIP_CEIL_Y + 14 : FLIP_FLOOR_Y - 14;
  const f = 1 - Math.min(FLIP_ARC_TICKS, flipT) / FLIP_ARC_TICKS;
  return from + (target - from) * f * f * (3 - 2 * f);
}

/** Reverse sampling closes curved regions without a diagonal across the band. */
function reverseLine(ctx: CanvasRenderingContext2D, at: Surface, a: number, b: number): void {
  ctx.lineTo(b, at(b));
  for (let x = Math.floor(b / 3) * 3; x > a; x -= 3) ctx.lineTo(x, at(x));
  ctx.lineTo(a, at(a));
}
function bandPath(ctx: CanvasRenderingContext2D, ceilAt: Surface, floorAt: Surface): void {
  ctx.beginPath();
  flipSurfaceLine(ctx, ceilAt, 0, FLIP_WORLD_W);
  reverseLine(ctx, floorAt, 0, FLIP_WORLD_W);
  ctx.closePath();
}
/** Background decoration and rail glow are clipped to rock, never the tunnel. */
function rockPath(ctx: CanvasRenderingContext2D, side: number, at: Surface): void {
  const edge = side === 0 ? FLIP_WORLD_H : 0;
  ctx.beginPath();
  ctx.moveTo(0, edge);
  ctx.lineTo(FLIP_WORLD_W, edge);
  reverseLine(ctx, at, 0, FLIP_WORLD_W);
  ctx.closePath();
}

function drawCave(ctx: CanvasRenderingContext2D, state: FlipState, side: number, at: Surface, still: boolean): void {
  const cam = state.x / FP;
  const time = still ? 0 : state.tick / 60;
  const outward = side === 0 ? 1 : -1;
  ctx.save();
  rockPath(ctx, side, at);
  ctx.clip();
  ctx.fillStyle = MATERIAL.basalt;
  ctx.fillRect(0, 0, FLIP_WORLD_W, FLIP_WORLD_H);
  // Three staggered layers; spatial hashes keep openings and facets repeatable.
  for (let layer = 0; layer < 3; layer++) {
    const par = still ? 0 : cam * (0.12 + layer * 0.12);
    const stride = 70 + layer * 28;
    const start = Math.floor(par / stride) - 1;
    for (let k = start; k < start + 9; k++) {
      const hash = artHash(k, side * 41 + layer * 137);
      const x = k * stride - par;
      const y = at(x) + outward * (24 + layer * 40 + hash % 28);
      ctx.fillStyle = layer === 0 ? MATERIAL.farRock : MATERIAL.nearRock;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + stride * 0.35, y - outward * (8 + hash % 18));
      ctx.lineTo(x + stride, y + outward * 12);
      ctx.lineTo(x + stride * 0.85, y + outward * 100);
      ctx.lineTo(x - 12, y + outward * 85);
      ctx.closePath();
      ctx.fill();
      if (layer === 1 && hash % 5 === 0) {
        const glow = ctx.createRadialGradient(x + 30, y, 1, x + 30, y, 42);
        glow.addColorStop(0, "rgba(255,76,29,0.25)");
        glow.addColorStop(1, "rgba(255,76,29,0)");
        ctx.fillStyle = glow;
        ctx.fillRect(x - 12, y - 42, 84, 84);
      }
    }
  }
  // Basalt fractures in the near wall.
  ctx.strokeStyle = MATERIAL.seam;
  ctx.lineWidth = 0.8;
  const scroll = still ? 0 : cam * 0.65;
  const first = Math.floor(scroll / 38) - 1;
  for (let k = first; k < first + 13; k++) {
    const h = artHash(k, side + 908);
    const x = k * 38 - scroll;
    const y = at(x) + outward * (10 + h % 70);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 12, y + outward * 18);
    ctx.lineTo(x + 8, y + outward * 37);
    ctx.lineTo(x + 24, y + outward * 57);
    ctx.stroke();
  }
  // Spouts sit only between all obstacle spans, and erupt away from the band.
  for (let k = Math.floor(cam / 115) - 1; k < Math.floor(cam / 115) + 5; k++) {
    const h = artHash(k, side + 411);
    if (h % 3 !== 0) continue;
    const worldX = k * 115 + h % 40;
    const x = RUNNER_X + worldX - cam;
    if (x < -12 || x > FLIP_WORLD_W + 12) continue;
    if (state.segs.some(seg => worldX * FP >= seg.x0 - 16 * FP && worldX * FP <= seg.x1 + 16 * FP)) continue;
    const phase = still ? 0.35 : ((state.tick + h % 150) % 150) / 150;
    const height = 8 + Math.sin(phase * Math.PI) * 24;
    const y = at(x) + outward * 4;
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = MATERIAL.lava;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 4, y);
    ctx.quadraticCurveTo(x - 8, y + outward * height, x + 3, y + outward * (height - 6));
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // Low-contrast particles behind the action; reduced motion fixes their phase.
  for (let k = 0; k < 16; k++) {
    const h = artHash(k, side + 702);
    const x = h % FLIP_WORLD_W + (still ? 0 : Math.sin(time * 0.4 + k) * 5);
    const age = still ? h % 120 : (state.tick + h % 120) % 120;
    const offset = 12 + ((h >>> 7) % 90) + age * 0.3;
    const y = at(x) + outward * offset;
    ctx.fillStyle = k % 3 === 0 ? "rgba(255,112,48,0.35)" : MATERIAL.dust;
    ctx.fillRect(x, y, k % 3 === 0 ? 1.5 : 1, 1.5);
    if (side === 1 && k % 4 === 0) {
      ctx.fillStyle = "rgba(255,92,37,0.3)";
      ctx.beginPath();
      ctx.ellipse(x + 8, at(x + 8) - 58 + age * 0.3, 1, 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** Jagged obsidian joins the rail continuously; all hot cores are silhouette-clipped. */
function drawRockObstacle(ctx: CanvasRenderingContext2D, a: number, b: number, inward: number, at: Surface,
  maxH: number, seed: number, pulse: number): void {
  if (b - a <= 1) return;
  ctx.save();
  // Exact curve-following envelope, not a mid-point-height rectangle.
  ctx.beginPath();
  flipSurfaceLine(ctx, at, a, b);
  reverseLine(ctx, x => at(x) + inward * maxH, a, b);
  ctx.closePath();
  ctx.clip();
  const count = Math.max(2, Math.round((b - a) / 13));
  const slot = (b - a) / count;
  for (let k = 0; k < count; k++) {
    const h = artHash(seed, k);
    const x0 = a + slot * k;
    const x1 = x0 + slot;
    const tip = x0 + slot * (0.28 + (h % 40) / 100);
    const height = maxH * (0.65 + ((h >>> 6) % 36) / 100);
    const profile = (x: number) => height * Math.max(0, x <= tip ? (x - x0) / (tip - x0) : (x1 - x) / (x1 - tip));
    ctx.save();
    ctx.beginPath();
    // Base extends into rock, then is envelope-clipped, with no flat base stroke.
    flipSurfaceLine(ctx, x => at(x) - inward * 3, x0, x1);
    reverseLine(ctx, x => at(x) + inward * profile(x), x0, x1);
    ctx.closePath();
    ctx.clip();
    ctx.fillStyle = MATERIAL.obsidian;
    ctx.fillRect(x0, Math.min(at(x0), at(x1)) - maxH, slot, Math.abs(at(x0) - at(x1)) + maxH * 2);
    const core = ctx.createLinearGradient(0, at(tip), 0, at(tip) + inward * height);
    core.addColorStop(0, MATERIAL.core);
    core.addColorStop(1, MATERIAL.hot);
    ctx.strokeStyle = core;
    ctx.globalAlpha = 0.6 + pulse * 0.35;
    ctx.lineWidth = 1.5 + (h % 2);
    ctx.beginPath();
    ctx.moveTo(tip - slot * 0.12, at(tip) + inward * 2);
    ctx.lineTo(tip + slot * 0.1, at(tip) + inward * height * 0.4);
    ctx.lineTo(tip, at(tip) + inward * height * 0.86);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

function drawRobot(ctx: CanvasRenderingContext2D, state: FlipState, y: number, still: boolean): void {
  const dead = state.ended === 2;
  const progress = state.flipT > 0 ? 1 - state.flipT / FLIP_ARC_TICKS : 1;
  const upright = state.side === 0 ? 0 : Math.PI;
  const angle = !still && state.flipT > 0 ? upright + (state.side === 0 ? -1 : 1) * Math.PI * (1 - progress) : upright;
  ctx.save();
  // Clip before rotation so tumbling limbs never enlarge the 24 × 28 runner.
  ctx.beginPath();
  ctx.rect(RUNNER_X - 12, y - 14, 24, 28);
  ctx.clip();
  ctx.translate(RUNNER_X, y);
  ctx.rotate(angle);
  ctx.fillStyle = dead ? FLIP_RED : MATERIAL.armour;
  ctx.beginPath();
  ctx.roundRect(-6, -3, 12, 12, 2);
  ctx.fill();
  ctx.fillStyle = MATERIAL.robot;
  ctx.beginPath();
  ctx.roundRect(-7, -12, 14, 9, 2);
  ctx.fill();
  ctx.fillStyle = MATERIAL.visor;
  ctx.fillRect(-4, -10, 8, 3);
  ctx.fillStyle = MATERIAL.lamp;
  ctx.fillRect(5, -9, 2, 3);
  ctx.fillStyle = MATERIAL.core;
  ctx.fillRect(-2, 0, 4, 3);
  const stride = still || state.flipT > 0 ? 0 : Math.sin(state.tick * 0.5) * 2;
  ctx.fillStyle = MATERIAL.robot;
  ctx.fillRect(-8, 1, 2, 6);
  ctx.fillRect(6, 1, 2, 6);
  ctx.fillRect(-5 + stride, 9, 4, 4);
  ctx.fillRect(1 - stride, 9, 4, 4);
  ctx.restore();
}

export function drawFlipArt(ctx: CanvasRenderingContext2D, state: FlipState, size: CanvasSize): void {
  const still = reducedMotion();
  const pulse = still ? 0.5 : 0.5 + 0.5 * Math.sin(state.tick / 10);
  const scale = Math.min(size.width / FLIP_WORLD_W, size.height / FLIP_WORLD_H);
  ctx.save();
  ctx.clearRect(0, 0, size.width, size.height);
  ctx.fillStyle = MATERIAL.wash;
  ctx.fillRect(0, 0, size.width, size.height);
  ctx.translate((size.width - FLIP_WORLD_W * scale) / 2, (size.height - FLIP_WORLD_H * scale) / 2);
  ctx.scale(scale, scale);
  ctx.beginPath();
  ctx.rect(0, 0, FLIP_WORLD_W, FLIP_WORLD_H);
  ctx.clip();
  const toScreen = (wx: number) => RUNNER_X + (wx - state.x) / FP;
  const toWorld = (x: number) => state.x + (x - RUNNER_X) * FP;
  const floorAt = (x: number) => FLIP_FLOOR_Y + flipWarpAt(state, 0, toWorld(x));
  const ceilAt = (x: number) => FLIP_CEIL_Y + flipWarpAt(state, 1, toWorld(x));
  drawCave(ctx, state, 0, floorAt, still);
  drawCave(ctx, state, 1, ceilAt, still);
  bandPath(ctx, ceilAt, floorAt);
  ctx.fillStyle = MATERIAL.tunnel;
  ctx.fill();

  for (const [side, at] of [[0, floorAt], [1, ceilAt]] as const) {
    const rail = () => {
      ctx.beginPath();
      let from = 0;
      for (let i = Math.max(0, state.cursor - 1); i < state.segs.length; i++) {
        const seg = state.segs[i];
        if (!seg) continue;
        const a = toScreen(seg.x0);
        if (a > FLIP_WORLD_W) break;
        if (seg.side !== side || seg.kind !== FLIP_GAP) continue;
        flipSurfaceLine(ctx, at, from, Math.max(from, a));
        from = Math.max(from, toScreen(seg.x1));
      }
      flipSurfaceLine(ctx, at, from, FLIP_WORLD_W);
    };
    ctx.save();
    rockPath(ctx, side, at);
    ctx.clip();
    rail();
    ctx.strokeStyle = "rgba(255,69,24,0.1)";
    ctx.lineWidth = 26;
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,76,24,0.2)";
    ctx.lineWidth = 12;
    ctx.stroke();
    ctx.restore();
    rail();
    ctx.strokeStyle = MATERIAL.lava;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = MATERIAL.hot;
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }

  const y = runnerY(state.side, state.flipT) + state.warpY;
  // Headlamp and tiny flip sparks are non-colliding light, behind solid objects.
  ctx.save();
  bandPath(ctx, ceilAt, floorAt);
  ctx.clip();
  const light = ctx.createLinearGradient(RUNNER_X + 7, 0, RUNNER_X + 110, 0);
  light.addColorStop(0, "rgba(255,224,151,0.13)");
  light.addColorStop(1, "rgba(255,224,151,0)");
  ctx.fillStyle = light;
  ctx.beginPath();
  ctx.moveTo(RUNNER_X + 7, y - (state.side === 0 ? 8 : -8));
  for (let x = RUNNER_X + 16; x <= RUNNER_X + 110; x += 6) {
    ctx.lineTo(x, y + (floorAt(x) - floorAt(RUNNER_X)) - (x - RUNNER_X) * 0.22);
  }
  for (let x = RUNNER_X + 110; x >= RUNNER_X + 16; x -= 6) {
    ctx.lineTo(x, y + (floorAt(x) - floorAt(RUNNER_X)) + (x - RUNNER_X) * 0.22);
  }
  ctx.closePath();
  ctx.fill();
  if (!still && state.flipT > 0 && state.ended === 0) {
    for (let k = 1; k <= 6; k++) {
      ctx.globalAlpha = 0.45 * (1 - k / 7);
      ctx.fillStyle = MATERIAL.hot;
      const previousY = runnerY(state.side, Math.min(FLIP_ARC_TICKS, state.flipT + k)) + state.warpY;
      ctx.fillRect(RUNNER_X - 7 - k * 3, previousY + (k % 3 - 1) * 2, 1.3, 1.3);
    }
  }
  ctx.restore();
  for (let i = Math.max(0, state.cursor - 1); i < state.segs.length; i++) {
    const seg = state.segs[i];
    if (!seg) continue;
    const a = toScreen(seg.x0);
    const b = toScreen(seg.x1);
    if (a > FLIP_WORLD_W) break;
    if (b < 0) continue;
    const inward = seg.side === 0 ? -1 : 1;
    const at = seg.side === 0 ? floorAt : ceilAt;
    if (seg.kind === FLIP_GAP) drawFlipHazard(ctx, "gap", a, b, inward, at, MATERIAL.lava);
    else drawRockObstacle(ctx, a, b, inward, at, seg.kind === FLIP_SPIKE ? SPIKE_HEIGHT : OVERHANG_DEPTH, seg.x0 ^ state.warpFloor, pulse);
  }
  drawRobot(ctx, state, y, still);
  ctx.restore();
}

/** Play, intro demo and stored-run reveal share this renderer. */
export const flipArtGame = { ...flipGame, draw: drawFlipArt };
