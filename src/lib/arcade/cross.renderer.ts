import { successHud, successFrame, SUCCESS_ACCENTS } from "./success.renderer";
import { drawArtSprite } from "./sprites.renderer";
import { arcadeFx } from "./arcadeFx.renderer";
import { CROSS_FX } from "./arcadeFxGames.renderer";
import { drawHero, heroPose, type HeroPose } from "./hero.renderer";
/**
 * Cross art pass. Render only: reads CrossState and never mutates it. Vehicles
 * fill exactly their collision boxes; the walker's arms reach about 13.75 px
 * either side, inside the original 16 px half-width disc and within 1 px of
 * crossRev 5's 13 px one.
 */
import { px, type CanvasSize } from "./engine";
import {
  crossColumnCentreFp,
  crossCourse,
  CROSS_COL_W,
  CROSS_COLS,
  CROSS_KIND_CYCLE,
  CROSS_KIND_ROADWORKS,
  type CrossLane,
  crossGame,
  crossGameFor,
  crossLaneCentre,
  crossLaneTop,
  crossPaused,
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
  crossPlayerR,
  CROSS_WORLD_H,
  CROSS_WORLD_W,
  type CrossState,
} from "./cross";
import { artHash, reducedMotion } from "./art.renderer";
import { artCanvas, artContext, type ArtCanvas } from "./cache.renderer";
import { sceneBelow, sceneSides, type ArenaSceneView } from "./arenaScene.renderer";

// Real World daylight palette (the values of realworld.renderer's REAL_*; not imported, because
// realworld.renderer re-exports drawVehicle from this module).
const REAL_ASPHALT = "#555B64";
const REAL_GRASS = "#86BF63";
const REAL_GRASS_DARK = "#6FA851";
const REAL_INK = "#1E2630";
const REAL_KERB = "#C9CDD3";

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
      c.fillStyle = REAL_ASPHALT;
      c.fillRect(0, 0, 64, 64);
      for (let k = 0; k < 220; k++) {
        const h = artHash(k, 3);
        c.fillStyle = h % 3 === 0 ? "rgba(255,255,255,0.09)" : "rgba(20,24,30,0.22)";
        c.fillRect(h % 64, (h >>> 6) % 64, 1 + ((h >>> 12) % 2), 1);
      }
    }),
    paving: make((c) => {
      c.fillStyle = "#BCC1C8";
      c.fillRect(0, 0, 64, 64);
      for (let k = 0; k < 8; k++) {
        c.fillStyle = k % 2 ? "rgba(255,255,255,0.12)" : "rgba(60,66,76,0.08)";
        c.fillRect((k % 4) * 16, Math.floor(k / 4) * 32 + (k % 2) * 16, 16, 16);
      }
      c.strokeStyle = "rgba(70,76,88,0.45)";
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
      c.fillStyle = "rgba(255,255,255,0.18)";
      c.fillRect(0, 0, 64, 1);
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

/** A side-on cyclist filling exactly its collision box: thin frame, two wheels, hi-vis rider. */
function drawRider(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, dir: number, jersey: string): void {
  const wheelR = Math.min(w * 0.22, h * 0.2);
  const groundY = y + h - wheelR;
  const rear = dir > 0 ? x + wheelR : x + w - wheelR;
  const front = dir > 0 ? x + w - wheelR : x + wheelR;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  // Wheels: dark tyres with light rims.
  for (const cx of [rear, front]) {
    ctx.strokeStyle = "#0B0B0F";
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.arc(cx, groundY, wheelR - 1.3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "#D7DCE3";
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  // Frame: seat post, top tube, fork.
  const seatX = rear + dir * wheelR * 0.9;
  const barX = front - dir * wheelR * 0.35;
  const frameY = groundY - wheelR * 1.1;
  ctx.strokeStyle = "#2ED3B7";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(rear, groundY);
  ctx.lineTo(seatX, frameY);
  ctx.lineTo(barX, frameY);
  ctx.lineTo(front, groundY);
  ctx.moveTo(seatX, frameY);
  ctx.lineTo((rear + front) / 2, groundY);
  ctx.lineTo(barX, frameY);
  ctx.stroke();
  // Rider: leaning torso, arm to the bars, helmet.
  const hipY = frameY - 2;
  const shoulderX = seatX + dir * (w * 0.32);
  const shoulderY = y + h * 0.3;
  ctx.strokeStyle = jersey;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(seatX, hipY);
  ctx.lineTo(shoulderX, shoulderY);
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(shoulderX, shoulderY);
  ctx.lineTo(barX, frameY - 2);
  ctx.moveTo(seatX, hipY);
  ctx.lineTo((rear + front) / 2 + dir * 2, groundY - 2);
  ctx.stroke();
  ctx.fillStyle = jersey;
  ctx.beginPath();
  ctx.arc(shoulderX + dir * 3, y + Math.max(4, h * 0.14), Math.max(3.5, h * 0.12), 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(front - dir * 1 - 1.5, frameY - 3, 3, 3);
  ctx.restore();
}

const RIDER_COLOURS = ["#C6F432", "#FF8A3C", "#F080AB", "#7FD8FF"] as const;

/** Green cycle lane: tinted surface, solid edge lines and painted bike symbols. */
function drawCycleLane(ctx: CanvasRenderingContext2D, top: number): void {
  ctx.fillStyle = "rgba(46, 160, 96, 0.42)";
  ctx.fillRect(CROSS_BOARD_X, top, CROSS_BOARD_W, CROSS_LANE_H);
  ctx.fillStyle = "rgba(250,250,250,0.85)";
  ctx.fillRect(CROSS_BOARD_X, top + 2, CROSS_BOARD_W, 2);
  ctx.fillRect(CROSS_BOARD_X, top + CROSS_LANE_H - 4, CROSS_BOARD_W, 2);
  ctx.strokeStyle = "rgba(250,250,250,0.5)";
  ctx.lineWidth = 1.5;
  for (let x = CROSS_BOARD_X + 40; x < CROSS_BOARD_X + CROSS_BOARD_W - 20; x += 120) {
    const cy = top + CROSS_LANE_H / 2 + 4;
    ctx.beginPath();
    ctx.arc(x - 8, cy, 5, 0, Math.PI * 2);
    ctx.arc(x + 8 + 5, cy, 5, 0, Math.PI * 2);
    ctx.moveTo(x - 8, cy);
    ctx.lineTo(x - 2, cy - 8);
    ctx.lineTo(x + 6, cy - 8);
    ctx.lineTo(x + 13, cy);
    ctx.stroke();
  }
}

/** Closed lane: hatched surface, striped barriers over each closed run, a cone on every closed column. */
function drawRoadworks(ctx: CanvasRenderingContext2D, top: number, lane: CrossLane): void {
  const closed = new Set(lane.closed ?? []);
  ctx.save();
  ctx.beginPath();
  ctx.rect(CROSS_BOARD_X, top, CROSS_BOARD_W, CROSS_LANE_H);
  ctx.clip();
  ctx.fillStyle = "rgba(255,170,40,0.12)";
  ctx.fillRect(CROSS_BOARD_X, top, CROSS_BOARD_W, CROSS_LANE_H);
  ctx.restore();
  const centre = (col: number) => px(crossColumnCentreFp(col));
  // A closed column means the walker's centre cannot stand there: barrier edges sit
  // 10 px past the last closed centre, so the walker's disc just touches them.
  const edge = CROSS_COL_W / 2 - 3;
  for (let col = 0; col < CROSS_COLS; col++) {
    if (!closed.has(col) || closed.has(col - 1)) continue;
    let end = col;
    while (closed.has(end + 1)) end += 1;
    const x0 = col === 0 ? CROSS_BOARD_X : centre(col) - edge;
    const x1 = end === CROSS_COLS - 1 ? CROSS_BOARD_X + CROSS_BOARD_W : centre(end) + edge;
    const by = top + CROSS_LANE_H / 2 - 7;
    if (!drawArtSprite(ctx, "realworld", "barrier", x0, by, x1 - x0, 14)) {
      ctx.save();
      roundRect(ctx, x0, by, x1 - x0, 14, 3);
      ctx.clip();
      ctx.fillStyle = "#F7F7F8";
      ctx.fillRect(x0, by, x1 - x0, 14);
      ctx.fillStyle = "#E5383B";
      for (let sx = x0 - 14; sx < x1; sx += 14) {
        ctx.beginPath();
        ctx.moveTo(sx, by + 14);
        ctx.lineTo(sx + 7, by);
        ctx.lineTo(sx + 14, by);
        ctx.lineTo(sx + 7, by + 14);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
    for (let c = col; c <= end; c++) {
      const cx = centre(c);
      const base = top + CROSS_LANE_H - 7;
      if (drawArtSprite(ctx, "realworld", "cone", cx - 8, base - 20, 16, 20)) continue;
      ctx.fillStyle = "#FF7A1A";
      ctx.beginPath();
      ctx.moveTo(cx - 7, base);
      ctx.lineTo(cx - 2, base - 19);
      ctx.lineTo(cx + 2, base - 19);
      ctx.lineTo(cx + 7, base);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(cx - 4.5, base - 10, 9, 3);
      ctx.fillStyle = "#3A3A44";
      ctx.fillRect(cx - 8, base - 1, 16, 2);
    }
  }
}

/** Jaywalk's hero pose (the stick figure's joints, 4 px head, 3 px stick), refilled every draw. */
const walkerHero = Object.assign(heroPose(), { headR: 4, stick: 3 });
/** The tumbling figure's own pose, so its cape never eases the live walker's. */
const tumbleHero = Object.assign(heroPose(), { headR: 4, stick: 3 });

/**
 * The Joulz hero on drawWalker's joints (same head, torso, arms, legs and stride), inside
 * the player disc. `speed` (0 … 1) lifts the cape away from the last move; facing up
 * shows the back of the mask, so no eye slits.
 */
export function drawWalkerHero(ctx: CanvasRenderingContext2D, x: number, y: number, facing: number, stride: number, angle: number, speed: number, gentle: boolean, pose: HeroPose = walkerHero): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const side = facing === 2 ? -1 : facing === 3 ? 1 : 0;
  const h = pose;
  h.headX = side * 1.5; h.headY = -9;
  h.neckX = 0; h.neckY = -5;
  h.hipX = 0; h.hipY = 4;
  h.shoulderX = 0; h.shoulderY = -2;
  h.handAX = -6 + side * 2 - stride * 3; h.handAY = 2;
  h.handBX = 6 + side * 2 + stride * 3; h.handBY = 2;
  h.footAX = -4 + side * 2 + stride * 4; h.footAY = 13;
  h.footBX = 4 + side * 2 - stride * 4; h.footBY = 13;
  h.moveX = side;
  h.moveY = facing === 0 ? -1 : facing === 1 ? 1 : 0;
  h.speed = speed;
  h.face = facing === 0 ? NaN : side;
  h.gentle = gentle;
  drawHero(ctx, h);
  ctx.restore();
}

/**
 * Gold stick figure inside the player disc (radius 16), facing the last move. The game draws
 * drawWalkerHero since the Joulz hero (23 Oct 2026); this stays for the Jaywalk game icon.
 */
export function drawWalker(ctx: CanvasRenderingContext2D, x: number, y: number, facing: number, stride: number, angle: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const side = facing === 2 ? -1 : facing === 3 ? 1 : 0;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  // Dark outline under the whole figure so it reads on paving and asphalt alike (inside the 16 px disc).
  const limbs = () => {
    ctx.beginPath();
    ctx.moveTo(0, -5);
    ctx.lineTo(0, 4);
    ctx.moveTo(0, -2);
    ctx.lineTo(-6 + side * 2 - stride * 3, 2);
    ctx.moveTo(0, -2);
    ctx.lineTo(6 + side * 2 + stride * 3, 2);
    ctx.moveTo(0, 4);
    ctx.lineTo(-4 + side * 2 + stride * 4, 13);
    ctx.moveTo(0, 4);
    ctx.lineTo(4 + side * 2 - stride * 4, 13);
  };
  ctx.strokeStyle = REAL_INK;
  ctx.fillStyle = REAL_INK;
  ctx.lineWidth = 5.5;
  limbs();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(side * 1.5, -9, 5.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = CROSS_PLAYER;
  ctx.fillStyle = CROSS_PLAYER;
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

/* ------------------------------ Cached road layer ------------------------------ */

const roadLayers = new WeakMap<object, { key: string; canvas: ArtCanvas | null }>();

/** Grass with mown stripes and blades, over the given world rectangle. */
function paintGrass(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  const g = c.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, REAL_GRASS);
  g.addColorStop(1, REAL_GRASS_DARK);
  c.fillStyle = g;
  c.fillRect(x, y, w, h);
  c.fillStyle = "rgba(255,255,255,0.05)";
  for (let sx = x; sx < x + w; sx += 36) c.fillRect(sx, y, 18, h);
  c.save();
  c.beginPath();
  c.rect(x, y, w, h);
  c.clip();
  c.lineWidth = 1;
  for (let k = 0; k < Math.ceil((w * h) / 60); k++) {
    const r = artHash(k, 41);
    const bx = x + (r % 1000) / 1000 * w;
    const by = y + ((r >>> 10) % 1000) / 1000 * h;
    c.strokeStyle = r % 3 ? "rgba(40,90,30,0.35)" : "rgba(210,240,170,0.35)";
    c.beginPath();
    c.moveTo(bx, by);
    c.lineTo(bx + ((r >>> 20) % 3) - 1, by - 3);
    c.stroke();
  }
  c.restore();
}

/** The static scene for one crossing, in world units. */
function paintRoad(c: CanvasRenderingContext2D, course: ReturnType<typeof crossCourse>, tex: ReturnType<typeof texture>): void {
  paintGrass(c, 0, 0, CROSS_WORLD_W, CROSS_WORLD_H);
  // Pavements: paving slabs with a kerb stone along the road edge.
  const pavement = (top: number, finish: boolean) => {
    c.fillStyle = tex.paving ?? "#BCC1C8";
    c.fillRect(CROSS_BOARD_X, top, CROSS_BOARD_W, CROSS_KERB_H);
    const kerbY = finish ? top + CROSS_KERB_H - 5 : top;
    c.fillStyle = REAL_KERB;
    c.fillRect(CROSS_BOARD_X, kerbY, CROSS_BOARD_W, 5);
    c.fillStyle = "rgba(255,255,255,0.45)";
    c.fillRect(CROSS_BOARD_X, kerbY, CROSS_BOARD_W, 1);
    c.fillStyle = "rgba(60,66,76,0.35)";
    for (let x = CROSS_BOARD_X + CROSS_COL_W; x < CROSS_BOARD_X + CROSS_BOARD_W; x += CROSS_COL_W * 2) c.fillRect(x, kerbY, 1, 5);
    c.fillStyle = "rgba(30,38,48,0.4)";
    c.fillRect(CROSS_BOARD_X, finish ? kerbY + 4 : kerbY + 4, CROSS_BOARD_W, 1);
    // Grass edge shadow onto the pavement's outer side.
    c.fillStyle = "rgba(30,50,20,0.18)";
    c.fillRect(CROSS_BOARD_X, finish ? top : top + CROSS_KERB_H - 2, CROSS_BOARD_W, 2);
  };
  pavement(CROSS_HUD_H, true);
  pavement(CROSS_LANES_Y + CROSS_LANES * CROSS_LANE_H, false);

  for (let lane = 1; lane <= CROSS_LANES; lane++) {
    const top = crossLaneTop(lane);
    c.fillStyle = tex.asphalt ?? REAL_ASPHALT;
    c.fillRect(CROSS_BOARD_X, top, CROSS_BOARD_W, CROSS_LANE_H);
    // Wheel tracks: two faint darker bands where the tyres run.
    c.fillStyle = "rgba(20,24,30,0.1)";
    c.fillRect(CROSS_BOARD_X, top + 10, CROSS_BOARD_W, 6);
    c.fillRect(CROSS_BOARD_X, top + CROSS_LANE_H - 16, CROSS_BOARD_W, 6);
    // Patch repairs and cracks, fixed per lane.
    for (let k = 0; k < 2; k++) {
      const r = artHash(lane, k + 7);
      const x = CROSS_BOARD_X + (r % (CROSS_BOARD_W - 40));
      c.fillStyle = "rgba(30,34,40,0.08)";
      c.fillRect(x, top + 6 + ((r >>> 9) % 20), 22 + ((r >>> 14) % 18), 12);
    }
    // Dashed lane marking on the upper edge.
    if (lane < CROSS_LANES) {
      c.fillStyle = "rgba(244,246,248,0.8)";
      for (let x = CROSS_BOARD_X + 6; x < CROSS_BOARD_X + CROSS_BOARD_W; x += 34)
        c.fillRect(x, top - 1, Math.min(16, CROSS_BOARD_X + CROSS_BOARD_W - x), 2);
    }
    const laneDef = course.lanes[lane - 1];
    if (!laneDef) continue;
    if (laneDef.kind === CROSS_KIND_ROADWORKS) drawRoadworks(c, top, laneDef);
    else if (laneDef.kind === CROSS_KIND_CYCLE) drawCycleLane(c, top);
  }
  // Solid edge lines at the kerbs.
  c.fillStyle = "rgba(250,250,250,0.85)";
  c.fillRect(CROSS_BOARD_X, CROSS_LANES_Y + 1, CROSS_BOARD_W, 2);
  c.fillRect(CROSS_BOARD_X, CROSS_LANES_Y + CROSS_LANES * CROSS_LANE_H - 3, CROSS_BOARD_W, 2);
}

/** Draws the crossing's cached scene (or paints it directly where no offscreen canvas exists); returns the layer. */
function roadLayer(ctx: CanvasRenderingContext2D, course: ReturnType<typeof crossCourse>, tex: ReturnType<typeof texture>): ArtCanvas | null {
  const t = typeof ctx.getTransform === "function" ? ctx.getTransform() : null;
  const k = t ? Math.max(0.1, Math.hypot(t.a, t.b)) : 1;
  const pw = Math.max(1, Math.round(CROSS_WORLD_W * k));
  const ph = Math.max(1, Math.round(CROSS_WORLD_H * k));
  const key = `${pw}x${ph}|${tex.asphalt ? 1 : 0}`;
  let found = roadLayers.get(course);
  if (!found || found.key !== key) {
    const canvas = artCanvas(pw, ph);
    const c = canvas ? artContext(canvas) : null;
    if (canvas && c) {
      c.scale(pw / CROSS_WORLD_W, ph / CROSS_WORLD_H);
      paintRoad(c as CanvasRenderingContext2D, course, texture(c as CanvasRenderingContext2D));
    }
    found = { key, canvas: canvas && c ? canvas : null };
    roadLayers.set(course, found);
  }
  if (found.canvas) ctx.drawImage(found.canvas as CanvasImageSource, 0, 0, CROSS_WORLD_W, CROSS_WORLD_H);
  else paintRoad(ctx, course, tex);
  return found.canvas;
}

/** The game's drawing through the shared success layer (presentation only). */
export function drawCrossArt(ctx: CanvasRenderingContext2D, state: CrossState, size: CanvasSize, crashIndicator = true, pavedFoot = false): void {
  arcadeFx(ctx, CROSS_FX, state, () => drawCrossArtWorld(ctx, state, size, crashIndicator, pavedFoot), size);
}

function drawCrossArtWorld(ctx: CanvasRenderingContext2D, state: CrossState, size: CanvasSize, crashIndicator = true, pavedFoot = false): void {
  const still = reducedMotion();
  const scale = Math.min(size.width / CROSS_WORLD_W, size.height / CROSS_WORLD_H);
  const offsetX = (size.width - CROSS_WORLD_W * scale) / 2;
  const offsetY = (size.height - CROSS_WORLD_H * scale) / 2;
  const rel = state.tick - state.crossStart;
  const course = crossCourse(state);
  const tex = texture(ctx);

  ctx.save();
  ctx.fillStyle = REAL_GRASS_DARK;
  ctx.fillRect(0, 0, size.width, size.height);
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  const from = crossLaneCentre(state.lane);
  const to = crossLaneCentre(state.lane + state.hopDir);
  const done = state.hop > 0 ? (CROSS_HOP_TICKS - state.hop) / CROSS_HOP_TICKS : 0;
  const cy = state.hop > 0 ? from + (to - from) * done : from;
  const cx = px(crossColumnCentreFp(state.col));
  const memory = remember(state, cx, cy);

  // Verges, pavements, road surface, markings and roadworks: one cached layer per crossing.
  const layer = roadLayer(ctx, course, tex);
  // The play screen's arena scene (crossArenaScene) widens the start pavement downwards: the
  // grass strip under it is paved too, so pavement runs on unbroken past the world's edge.
  if (pavedFoot) {
    const foot = CROSS_LANES_Y + CROSS_LANES * CROSS_LANE_H + CROSS_KERB_H - 2;
    ctx.fillStyle = tex.paving ?? "#BCC1C8";
    ctx.fillRect(CROSS_BOARD_X, foot, CROSS_BOARD_W, CROSS_WORLD_H - foot);
  }
  // Finish pavement pulse after a clean crossing.
  const age = state.tick - memory.pulseTick;
  if (age >= 0 && age < 45) {
    const p = age / 45;
    ctx.fillStyle = `rgba(245,184,46,${(still ? 0.35 : 0.5 * Math.sin(p * Math.PI * 3) ** 2) * (1 - p)})`;
    ctx.fillRect(CROSS_BOARD_X, CROSS_HUD_H, CROSS_BOARD_W, CROSS_KERB_H);
  }

  for (let lane = 1; lane <= CROSS_LANES; lane++) {
    const top = crossLaneTop(lane);
    const laneDef = course.lanes[lane - 1];
    if (!laneDef || laneDef.kind === CROSS_KIND_ROADWORKS) continue;
    const cycle = laneDef.kind === CROSS_KIND_CYCLE;
    const start = mod(laneDef.dir * laneDef.speed * rel + laneDef.phase, laneDef.period);
    const count = Math.ceil((CROSS_BOARD_W * 256) / laneDef.period) + 2;
    // Lorries: the fastest third of this crossing's car lanes (cyclist lanes and roadworks excluded).
    const speeds = course.lanes.filter((l) => !l.kind).map((l) => l.speed).sort((a, b) => a - b);
    const lorry = laneDef.speed >= (speeds[Math.floor((speeds.length * 2) / 3)] ?? Infinity);
    for (let index = -1; index <= count; index++) {
      const x = px(start + index * laneDef.period);
      if (cycle) {
        // crossRev 3 lanes hold a few riders at uneven offsets within one long period.
        const offsets = laneDef.offsets ?? [0];
        offsets.forEach((offset, k) => {
          const rx = px(start + index * laneDef.period + offset);
          if (rx > CROSS_BOARD_X + CROSS_BOARD_W || rx + px(laneDef.blockW) < CROSS_BOARD_X) return;
          const jersey = RIDER_COLOURS[(lane + index * 3 + k + 8) % RIDER_COLOURS.length] ?? RIDER_COLOURS[0];
          drawRider(ctx, rx, top + 7, px(laneDef.blockW), CROSS_LANE_H - 14, laneDef.dir, jersey);
        });
        continue;
      }
      const colour = CROSS_BLOCK_COLOURS[(lane + index + 8) % CROSS_BLOCK_COLOURS.length] ?? CROSS_BLOCK;
      // Daylight: no headlight beams, so nothing drawn reaches past the collision box.
      drawVehicle(ctx, x, top + 7, px(laneDef.blockW), CROSS_LANE_H - 14, laneDef.dir, colour, lorry, false);
    }
  }

  // Verges either side of the board, over any vehicle overhanging the road ends.
  const sideW = CROSS_BOARD_X;
  const sideH = CROSS_WORLD_H - CROSS_HUD_H;
  for (const x of [0, CROSS_BOARD_X + CROSS_BOARD_W]) {
    if (layer) {
      const k = layer.width / CROSS_WORLD_W;
      ctx.drawImage(layer as CanvasImageSource, x * k, CROSS_HUD_H * k, sideW * k, sideH * k, x, CROSS_HUD_H, sideW, sideH);
    } else {
      ctx.fillStyle = REAL_GRASS;
      ctx.fillRect(x, CROSS_HUD_H, sideW, sideH);
    }
  }

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
      ctx.arc(memory.hitX, memory.hitY, crossPlayerR(state), 0, Math.PI * 2);
      ctx.fill();
    }
    drawWalkerHero(ctx, memory.hitX, memory.hitY, memory.facing, 0, still ? 0 : Math.min(1, p * 1.5) * Math.PI * 1.5, 0, still, tumbleHero);
    ctx.globalAlpha = 1;
  }
  if (!state.dead) {
    // Stride: legs swap on each step, swing mid-hop.
    const parity = memory.steps % 2 ? 1 : -1;
    const stride = still ? parity * 0.6 : parity * (state.hop > 0 ? Math.sin(done * Math.PI) : 0.6);
    ctx.globalAlpha = state.ghost && Math.floor(state.tick / 6) % 2 === 0 ? 0.45 : 1;
    drawWalkerHero(ctx, cx, cy, memory.facing, stride, 0, state.hop > 0 ? 0.7 : 0, still);
    ctx.globalAlpha = 1;
  }

  for (let i = 0; i < CROSS_LIVES; i++) {
    ctx.fillStyle = i < state.lives ? CROSS_PLAYER : "rgba(20,40,20,0.28)";
    ctx.beginPath();
    ctx.arc(CROSS_WORLD_W - 22 - i * 18, 18, 6, 0, Math.PI * 2);
    ctx.fill();
    if (i < state.lives) {
      ctx.strokeStyle = REAL_INK;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }
  ctx.font = "600 16px 'JetBrains Mono', ui-monospace, monospace";
  ctx.fillStyle = "#FFFFFF";
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.strokeStyle = REAL_INK;
  ctx.lineWidth = 3.5;
  ctx.lineJoin = "round";
  successHud(ctx,'cross',state.tick,14,10,()=>{ctx.strokeText(`Crossings ${state.crossings}`,14,10);ctx.fillText(`Crossings ${state.crossings}`,14,10);});

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
/** The art game for a stored puzzle.crossRev (play, demos and reveals). */
const crossArtGames = new Map<number, typeof crossArtGame>();
/** One cached object per revision (stages reset the run when `game` changes identity). */
export function crossArtGameFor(rev?: number | null): typeof crossArtGame {
  const key = rev ?? 0;
  let game = crossArtGames.get(key);
  if (!game) crossArtGames.set(key, (game = { ...crossGameFor(rev), draw: drawCrossArt }));
  return game;
}
export const crossRevealGame = { draw: (ctx: CanvasRenderingContext2D, state: CrossState, size: CanvasSize) => drawCrossArt(ctx, state, size, false) };

/**
 * Arena scene (15 Oct 2026, display only; arenaScene.renderer.ts): a wider start pavement.
 * Below the world the same paving (the same slab pattern, anchored to the world) runs on
 * between the same grass verges, down to a grass strip along the arena box's bottom. The
 * play screen's stage draws the world with `pavedFoot`, so the pavement is unbroken. The
 * lanes, kerbs and the walker's start are unchanged; nothing here moves or takes a touch.
 */
export function crossArenaScene(ctx: CanvasRenderingContext2D, view: ArenaSceneView): void {
  const tex = texture(ctx);
  for (const side of sceneSides(view)) paintGrass(ctx, side.x, side.y, side.w, side.h);
  const below = sceneBelow(view);
  if (!below) return;
  paintGrass(ctx, below.x, below.y, below.w, below.h);
  const verge = Math.min(14, below.h);
  const paved = below.h - verge;
  if (paved > 0) {
    ctx.fillStyle = tex.paving ?? "#BCC1C8";
    ctx.fillRect(CROSS_BOARD_X, below.y, CROSS_BOARD_W, paved);
    // The paving's outer edge: a low edging stone, then the grass edge's shadow.
    ctx.fillStyle = REAL_KERB;
    ctx.fillRect(CROSS_BOARD_X, below.y + paved - 3, CROSS_BOARD_W, 3);
    ctx.fillStyle = "rgba(30,38,48,0.35)";
    ctx.fillRect(CROSS_BOARD_X, below.y + paved - 1, CROSS_BOARD_W, 1);
    ctx.fillStyle = "rgba(30,50,20,0.18)";
    ctx.fillRect(CROSS_BOARD_X - 2, below.y, 2, paved);
    ctx.fillRect(CROSS_BOARD_X + CROSS_BOARD_W, below.y, 2, paved);
  }
}
