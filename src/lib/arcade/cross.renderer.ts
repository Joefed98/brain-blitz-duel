import { successHud, successFrame, SUCCESS_ACCENTS } from "./success.renderer";
import { drawArtSprite } from "./sprites.renderer";
import { arcadeFx } from "./arcadeFx.renderer";
import { CROSS_FX } from "./arcadeFxGames.renderer";
/**
 * Cross art pass. Render only: reads CrossState and never mutates it. Vehicles
 * fill exactly their collision boxes; the walker stays inside the sim's 16 px
 * half-width player disc.
 */
import { px, type CanvasSize } from "./engine";
import {
  crossColumnCentreFp,
  crossCourse,
  crossGame,
  crossLaneCentre,
  crossLaneTop,
  crossPaused,
  CROSS_BG,
  CROSS_BLOCK,
  CROSS_BLOCK_COLOURS,
  CROSS_BOARD_W,
  CROSS_BOARD_X,
  CROSS_HOP_TICKS,
  CROSS_HUD_H,
  CROSS_KERB_H,
  CROSS_LANE_H,
  CROSS_LANES,
  CROSS_LANES_Y,
  CROSS_LIVES,
  CROSS_PAUSE_TICKS,
  CROSS_PLAYER,
  CROSS_PLAYER_R,
  CROSS_WORLD_H,
  CROSS_WORLD_W,
  type CrossState,
} from "./cross";
import { artHash, reducedMotion } from "./art.renderer";

function mod(value: number, m: number): number {
  const r = value % m;
  return r < 0 ? r + m : r;
}

/** Render-side memory per run (keyed by the run's course list) for facing, steps and effects. */
interface Memory {
  tick: number;
  lane: number;
  col: number;
  hop: number;
  facing: number; // 0 up, 1 down, 2 left, 3 right
  steps: number;
  hitTick: number;
  hitX: number;
  hitY: number;
  clean: number;
  pulseTick: number;
  lastX: number;
  lastY: number;
}
const memories = new WeakMap<object, Memory>();

function remember(state: CrossState, x: number, y: number): Memory {
  let m = memories.get(state.courses);
  if (!m || state.tick < m.tick) {
    m = { tick: state.tick, lane: state.lane, col: state.col, hop: state.hop, facing: 0, steps: 0,
      hitTick: state.hitTick, hitX: x, hitY: y, clean: state.clean, pulseTick: -100, lastX: x, lastY: y };
    memories.set(state.courses, m);
  }
  if (state.tick !== m.tick) {
    if (state.col !== m.col) {
      m.facing = state.col < m.col ? 2 : 3;
      m.steps += 1;
    }
    if (state.hop > 0 && m.hop === 0) {
      m.facing = state.hopDir > 0 ? 0 : 1;
      m.steps += 1;
    }
    if (state.hitTick !== m.hitTick) {
      m.hitTick = state.hitTick;
      m.hitX = state.dead ? x : m.lastX;
      m.hitY = state.dead ? y : m.lastY;
    }
    if (state.clean > m.clean) m.pulseTick = state.tick;
    m.clean = state.clean;
    m.tick = state.tick;
    m.lane = state.lane;
    m.col = state.col;
    m.hop = state.hop;
  }
  m.lastX = x;
  m.lastY = y;
  return m;
}

const patterns = new WeakMap<CanvasRenderingContext2D, { asphalt: CanvasPattern | null; paving: CanvasPattern | null }>();

function texture(ctx: CanvasRenderingContext2D) {
  let found = patterns.get(ctx);
  if (found) return found;
  const make = (paint: (c: CanvasRenderingContext2D) => void) => {
    if (typeof document === "undefined") return null;
    const tile = document.createElement("canvas");
    tile.width = 64;
    tile.height = 64;
    const c = tile.getContext("2d");
    if (!c) return null;
    paint(c);
    return ctx.createPattern(tile, "repeat");
  };
  found = {
    asphalt: make((c) => {
      c.fillStyle = "#121218";
      c.fillRect(0, 0, 64, 64);
      for (let k = 0; k < 160; k++) {
        const h = artHash(k, 3);
        c.fillStyle = h % 2 ? "rgba(255,255,255,0.045)" : "rgba(0,0,0,0.35)";
        c.fillRect(h % 64, (h >>> 6) % 64, 1 + ((h >>> 12) % 2), 1);
      }
    }),
    paving: make((c) => {
      c.fillStyle = "#3A3A44";
      c.fillRect(0, 0, 64, 64);
      c.strokeStyle = "rgba(0,0,0,0.35)";
      c.lineWidth = 1;
      for (let y = 0; y <= 64; y += 16) {
        c.beginPath();
        c.moveTo(0, y + 0.5);
        c.lineTo(64, y + 0.5);
        c.stroke();
        for (let x = (y / 16) % 2 ? 0 : 16; x < 64; x += 32) {
          c.beginPath();
          c.moveTo(x + 0.5, y);
          c.lineTo(x + 0.5, y + 16);
          c.stroke();
        }
      }
      c.fillStyle = "rgba(255,255,255,0.04)";
      c.fillRect(0, 0, 64, 2);
    }),
  };
  patterns.set(ctx, found);
  return found;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.max(0, Math.min(r, w / 2, h / 2)));
}

/** A car or lorry filling exactly its collision box (shared by the Real World games). */
export function drawVehicle(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, dir: number, colour: string, lorry: boolean, beams = true): void {
  // Art pilot (Real World): side-on vehicle sprites fill the vehicle's lane box, mirrored for leftward traffic.
  if (drawArtSprite(ctx, "realworld", lorry ? "lorry" : "car", x, y, w, h, { flipX: dir < 0 })) return;
  const front = dir > 0 ? x + w : x;
  const back = dir > 0 ? x : x + w;
  const body = ctx.createLinearGradient(0, y, 0, y + h);
  body.addColorStop(0, colour);
  body.addColorStop(1, "rgba(0,0,0,0.0)");
  if (lorry) {
    const cab = Math.min(26, w * 0.28);
    const gap = 3;
    ctx.fillStyle = colour;
    roundRect(ctx, dir > 0 ? x : x + cab + gap, y, w - cab - gap, h, 4);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    for (let k = 1; k < 4; k++) {
      const tx = (dir > 0 ? x : x + cab + gap) + ((w - cab - gap) * k) / 4;
      ctx.fillRect(tx - 0.5, y + 3, 1, h - 6);
    }
    ctx.fillStyle = colour;
    roundRect(ctx, dir > 0 ? x + w - cab : x, y + 2, cab, h - 4, 6);
    ctx.fill();
    ctx.fillStyle = "rgba(11, 11, 15, 0.55)";
    ctx.fillRect(dir > 0 ? x + w - cab * 0.55 : x + cab * 0.2, y + 6, cab * 0.35, h - 12);
  } else {
    ctx.fillStyle = colour;
    roundRect(ctx, x, y, w, h, Math.min(12, h / 2));
    ctx.fill();
    // Roof panel and shading.
    ctx.fillStyle = "rgba(255,255,255,0.14)";
    roundRect(ctx, x + w * 0.3, y + 6, w * 0.4, h - 12, 5);
    ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.fillRect(x + 4, y + h - 5, w - 8, 3);
    ctx.fillStyle = "rgba(11, 11, 15, 0.55)";
    const ws = Math.min(14, w * 0.18);
    ctx.fillRect(dir > 0 ? x + w * 0.62 : x + w * 0.38 - ws, y + 5, ws, h - 10);
    ctx.fillRect(dir > 0 ? x + w * 0.18 : x + w * 0.82 - ws * 0.7, y + 6, ws * 0.7, h - 12);
  }
  ctx.fillStyle = "#FFFFFF";
  const hx = front - dir * 4;
  ctx.beginPath();
  ctx.arc(hx, y + 6, 2.6, 0, Math.PI * 2);
  ctx.arc(hx, y + h - 6, 2.6, 0, Math.PI * 2);
  ctx.fill();
  if (beams) {
  ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
  ctx.beginPath();
  ctx.moveTo(front, y + 2);
  ctx.lineTo(front + dir * 18, y - 2);
  ctx.lineTo(front + dir * 18, y + h + 2);
  ctx.lineTo(front, y + h - 2);
  ctx.closePath();
  ctx.fill();
  }
  ctx.fillStyle = "#FF3B3B";
  const tx = back + dir * 2;
  ctx.fillRect(tx - 1.5, y + 3, 3, 5);
  ctx.fillRect(tx - 1.5, y + h - 8, 3, 5);
  ctx.fillStyle = "rgba(255,59,59,0.25)";
  ctx.fillRect(tx - dir * 4 - 2, y + 2, 4, 7);
  ctx.fillRect(tx - dir * 4 - 2, y + h - 9, 4, 7);
}

/** Gold stick figure inside the player disc (radius 16), facing the last move. */
function drawWalker(ctx: CanvasRenderingContext2D, x: number, y: number, facing: number, stride: number, angle: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const side = facing === 2 ? -1 : facing === 3 ? 1 : 0;
  ctx.strokeStyle = CROSS_PLAYER;
  ctx.fillStyle = CROSS_PLAYER;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = 3;
  // Head.
  ctx.beginPath();
  ctx.arc(side * 1.5, -9, 4, 0, Math.PI * 2);
  ctx.fill();
  if (facing === 1) {
    ctx.fillStyle = "#0B0B0F";
    ctx.fillRect(side * 1.5 - 2, -10, 1.3, 1.3);
    ctx.fillRect(side * 1.5 + 0.7, -10, 1.3, 1.3);
  }
  // Body and arms.
  ctx.beginPath();
  ctx.moveTo(0, -5);
  ctx.lineTo(0, 4);
  ctx.moveTo(0, -2);
  ctx.lineTo(-6 + side * 2 - stride * 3, 2);
  ctx.moveTo(0, -2);
  ctx.lineTo(6 + side * 2 + stride * 3, 2);
  // Legs: alternate on each step.
  ctx.moveTo(0, 4);
  ctx.lineTo(-4 + side * 2 + stride * 4, 13);
  ctx.moveTo(0, 4);
  ctx.lineTo(4 + side * 2 - stride * 4, 13);
  ctx.stroke();
  ctx.strokeStyle = "rgba(210, 238, 240, 0.8)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

/** The game's drawing through the shared success layer (presentation only). */
export function drawCrossArt(ctx: CanvasRenderingContext2D, state: CrossState, size: CanvasSize, crashIndicator = true): void {
  arcadeFx(ctx, CROSS_FX, state, () => drawCrossArtWorld(ctx, state, size, crashIndicator), size);
}

function drawCrossArtWorld(ctx: CanvasRenderingContext2D, state: CrossState, size: CanvasSize, crashIndicator = true): void {
  const still = reducedMotion();
  const scale = Math.min(size.width / CROSS_WORLD_W, size.height / CROSS_WORLD_H);
  const offsetX = (size.width - CROSS_WORLD_W * scale) / 2;
  const offsetY = (size.height - CROSS_WORLD_H * scale) / 2;
  const rel = state.tick - state.crossStart;
  const course = crossCourse(state);
  const tex = texture(ctx);

  ctx.save();
  ctx.fillStyle = CROSS_BG;
  ctx.fillRect(0, 0, size.width, size.height);
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  const from = crossLaneCentre(state.lane);
  const to = crossLaneCentre(state.lane + state.hopDir);
  const done = state.hop > 0 ? (CROSS_HOP_TICKS - state.hop) / CROSS_HOP_TICKS : 0;
  const cy = state.hop > 0 ? from + (to - from) * done : from;
  const cx = px(crossColumnCentreFp(state.col));
  const memory = remember(state, cx, cy);

  // Pavement strips: start (bottom) and finish (top).
  const pavement = (top: number, finish: boolean) => {
    ctx.fillStyle = tex.paving ?? "#3A3A44";
    ctx.fillRect(CROSS_BOARD_X, top, CROSS_BOARD_W, CROSS_KERB_H);
    ctx.fillStyle = "#8A8F99";
    ctx.fillRect(CROSS_BOARD_X, finish ? top + CROSS_KERB_H - 3 : top, CROSS_BOARD_W, 3);
    if (finish) {
      const age = state.tick - memory.pulseTick;
      if (age >= 0 && age < 45) {
        const p = age / 45;
        ctx.fillStyle = `rgba(245,184,46,${(still ? 0.35 : 0.5 * Math.sin(p * Math.PI * 3) ** 2) * (1 - p)})`;
        ctx.fillRect(CROSS_BOARD_X, top, CROSS_BOARD_W, CROSS_KERB_H);
      }
    }
  };
  pavement(CROSS_HUD_H, true);
  pavement(CROSS_LANES_Y + CROSS_LANES * CROSS_LANE_H, false);

  for (let lane = 1; lane <= CROSS_LANES; lane++) {
    const top = crossLaneTop(lane);
    ctx.fillStyle = tex.asphalt ?? "#121218";
    ctx.fillRect(CROSS_BOARD_X, top, CROSS_BOARD_W, CROSS_LANE_H);
    // Faint dashed lane marking on the upper edge.
    if (lane < CROSS_LANES) {
      ctx.fillStyle = "rgba(220,224,232,0.22)";
      for (let x = CROSS_BOARD_X + 6; x < CROSS_BOARD_X + CROSS_BOARD_W; x += 34)
        ctx.fillRect(x, top - 1, Math.min(16, CROSS_BOARD_X + CROSS_BOARD_W - x), 2);
    }
    const laneDef = course.lanes[lane - 1];
    if (!laneDef) continue;
    const start = mod(laneDef.dir * laneDef.speed * rel + laneDef.phase, laneDef.period);
    const count = Math.ceil((CROSS_BOARD_W * 256) / laneDef.period) + 2;
    const speeds = course.lanes.map((l) => l.speed).sort((a, b) => a - b);
    const lorry = laneDef.speed >= (speeds[Math.floor((speeds.length * 2) / 3)] ?? Infinity);
    for (let index = -1; index <= count; index++) {
      const x = px(start + index * laneDef.period);
      const colour = CROSS_BLOCK_COLOURS[(lane + index + 8) % CROSS_BLOCK_COLOURS.length] ?? CROSS_BLOCK;
      drawVehicle(ctx, x, top + 7, px(laneDef.blockW), CROSS_LANE_H - 14, laneDef.dir, colour, lorry);
    }
  }
  // Solid edge lines at the kerbs.
  ctx.fillStyle = "rgba(245,245,245,0.35)";
  ctx.fillRect(CROSS_BOARD_X, CROSS_LANES_Y, CROSS_BOARD_W, 1.5);
  ctx.fillRect(CROSS_BOARD_X, CROSS_LANES_Y + CROSS_LANES * CROSS_LANE_H - 1.5, CROSS_BOARD_W, 1.5);

  ctx.fillStyle = CROSS_BG;
  ctx.fillRect(0, CROSS_HUD_H, CROSS_BOARD_X, CROSS_WORLD_H - CROSS_HUD_H);
  ctx.fillRect(CROSS_BOARD_X + CROSS_BOARD_W, CROSS_HUD_H, CROSS_WORLD_W - CROSS_BOARD_X - CROSS_BOARD_W, CROSS_WORLD_H - CROSS_HUD_H);

  // Tumbling figure where the hit happened.
  const hitAge = state.tick - state.hitTick;
  const tumbling = state.hitTick > 0 && (state.dead || hitAge < 40);
  if (tumbling) {
    const p = Math.min(1, hitAge / 40);
    const flash = Math.floor(hitAge / 4) % 2 === 0;
    ctx.globalAlpha = state.dead ? 1 : 1 - p;
    if (flash && crashIndicator) {
      ctx.fillStyle = "rgba(255,77,77,0.55)";
      ctx.beginPath();
      ctx.arc(memory.hitX, memory.hitY, CROSS_PLAYER_R, 0, Math.PI * 2);
      ctx.fill();
    }
    drawWalker(ctx, memory.hitX, memory.hitY, memory.facing, 0, still ? 0 : Math.min(1, p * 1.5) * Math.PI * 1.5);
    ctx.globalAlpha = 1;
  }
  if (!state.dead) {
    // Stride: legs swap on each step, swing mid-hop.
    const parity = memory.steps % 2 ? 1 : -1;
    const stride = still ? parity * 0.6 : parity * (state.hop > 0 ? Math.sin(done * Math.PI) : 0.6);
    ctx.globalAlpha = state.ghost && Math.floor(state.tick / 6) % 2 === 0 ? 0.45 : 1;
    drawWalker(ctx, cx, cy, memory.facing, stride, 0);
    ctx.globalAlpha = 1;
  }

  for (let i = 0; i < CROSS_LIVES; i++) {
    ctx.fillStyle = i < state.lives ? CROSS_PLAYER : "rgba(255,255,255,0.18)";
    ctx.beginPath();
    ctx.arc(CROSS_WORLD_W - 22 - i * 18, 18, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.font = "600 16px 'JetBrains Mono', ui-monospace, monospace";
  ctx.fillStyle = "#F7F7F8";
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  successHud(ctx,'cross',state.tick,14,10,()=>ctx.fillText(`Crossings ${state.crossings}`,14,10));

  successFrame(ctx,{id:'cross',tick:state.tick,count:state.crossings,misses:CROSS_LIVES-state.lives,colour:CROSS_PLAYER,width:CROSS_WORLD_W,height:CROSS_WORLD_H,point:{x:cx,y:CROSS_HUD_H+CROSS_KERB_H/2,shape:'line',radius:24,label:'+1'},hud:{x:14,y:10,text:`Crossings ${state.crossings}`}});
  if (hitAge < 20 && !state.dead && crashIndicator) {
    ctx.fillStyle = `rgba(255, 77, 77, ${0.25 * (1 - hitAge / 20)})`;
    ctx.fillRect(0, 0, CROSS_WORLD_W, CROSS_WORLD_H);
  }
  if (crossPaused(state) && hitAge >= CROSS_PAUSE_TICKS) {
    ctx.fillStyle = "rgba(11, 11, 15, 0.55)";
    ctx.fillRect(CROSS_BOARD_X, CROSS_WORLD_H / 2 - 30, CROSS_BOARD_W, 60);
    ctx.fillStyle = CROSS_PLAYER;
    ctx.font = "700 24px 'JetBrains Mono', ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`Crossing ${state.crossings + 1}`, CROSS_WORLD_W / 2, CROSS_WORLD_H / 2);
  }
  if (state.dead && crashIndicator) {
    ctx.fillStyle = "rgba(255, 77, 77, 0.22)";
    ctx.fillRect(0, 0, CROSS_WORLD_W, CROSS_WORLD_H);
  }
  ctx.restore();
}

/** The sim with the art renderer swapped in; step/score are the sim's own. */
export const crossArtGame = { ...crossGame, draw: drawCrossArt };
export const crossRevealGame = { draw: (ctx: CanvasRenderingContext2D, state: CrossState, size: CanvasSize) => drawCrossArt(ctx, state, size, false) };
