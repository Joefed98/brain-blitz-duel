import { successHud, successFrame, SUCCESS_ACCENTS } from "./success.renderer";
import { drawArtSprite } from "./sprites.renderer";
import { arcadeFx } from "./arcadeFx.renderer";
import { crossFxFor } from "./arcadeFxGames.renderer";
import { drawHero, heroPose, type HeroPose } from "./hero.renderer";
/**
 * Cross art pass. Render only: reads CrossState and never mutates it. Vehicles
 * fill exactly their collision boxes; the walker's arms reach about 13.75 px
 * either side, inside the original 16 px half-width disc and within 1 px of
 * crossRev 5's 13 px one.
 */
import { px, type CanvasSize } from "./engine";
import {
  CROSS_WORLD_H,
  crossColumnCentreFp,
  crossCourse,
  CROSS_COL_W,
  CROSS_COLS,
  CROSS_KIND_CYCLE,
  CROSS_KIND_ROADWORKS,
  CROSS_KIND_ISLAND,
  CROSS_KIND_BUS,
  CROSS_KIND_MOTO,
  crossGeomOf,
  crossNextMultiplier,
  crossStartTop,
  type CrossGeom,
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
  CROSS_LIVES,
  CROSS_PAUSE_TICKS,
  CROSS_PLAYER,
  crossPlayerR,
  CROSS_WORLD_W,
  type CrossState,
} from "./cross";
import { artHash, reducedMotion } from "./art.renderer";
import { artCanvas, artContext, type ArtCanvas } from "./cache.renderer";
import { arcadeReducedEffects } from "../fx/lowEnd";
import { sceneBelow, sceneSides, type ArenaSceneView } from "./arenaScene.renderer";

/** crossRev 8: the plain paving stone of the world's foot (the slab pattern's own face colour). */
const CROSS_X_FOOT_PAVING = "#B5B9C0";

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
  /** crossRev 8: the tick the island was banked (its flag lights), and the coin count seen. */
  bankTick: number;
  banked: number;
}
const memories = new WeakMap<object, Memory>();

function remember(state: CrossState, x: number, y: number): Memory {
  let m = memories.get(state.courses);
  if (!m || state.tick < m.tick) {
    m = { tick: state.tick, lane: state.lane, col: state.col, hop: state.hop, facing: 0, steps: 0,
      hitTick: state.hitTick, hitX: x, hitY: y, clean: state.clean, pulseTick: -100, lastX: x, lastY: y,
      bankTick: -100, banked: state.banked ?? 0 };
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
    if ((state.banked ?? 0) > m.banked) m.bankTick = state.tick;
    m.banked = state.banked ?? 0;
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
      // Polish A2: each slab subtly shaded, lit on its top-left edge and a touch darker to the bottom right.
      for (let y = 0; y < 64; y += 16) {
        for (let x = (y / 16) % 2 ? -16 : 0; x < 64; x += 32) {
          const g = c.createLinearGradient(x, y, x + 32, y + 16);
          g.addColorStop(0, "rgba(255,255,255,0.08)");
          g.addColorStop(1, "rgba(40,46,56,0.07)");
          c.fillStyle = g;
          c.fillRect(x, y, 32, 16);
          c.fillStyle = "rgba(255,255,255,0.16)";
          c.fillRect(x + 1, y + 1, 30, 1);
        }
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
function drawCycleLane(ctx: CanvasRenderingContext2D, top: number, laneH: number): void {
  ctx.fillStyle = "rgba(46, 160, 96, 0.42)";
  ctx.fillRect(CROSS_BOARD_X, top, CROSS_BOARD_W, laneH);
  ctx.fillStyle = "rgba(250,250,250,0.85)";
  ctx.fillRect(CROSS_BOARD_X, top + 2, CROSS_BOARD_W, 2);
  ctx.fillRect(CROSS_BOARD_X, top + laneH - 4, CROSS_BOARD_W, 2);
  ctx.strokeStyle = "rgba(250,250,250,0.5)";
  ctx.lineWidth = 1.5;
  for (let x = CROSS_BOARD_X + 40; x < CROSS_BOARD_X + CROSS_BOARD_W - 20; x += 120) {
    const cy = top + laneH / 2 + 4;
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
function drawRoadworks(ctx: CanvasRenderingContext2D, top: number, lane: CrossLane, laneH: number): void {
  const closed = new Set(lane.closed ?? []);
  ctx.save();
  ctx.beginPath();
  ctx.rect(CROSS_BOARD_X, top, CROSS_BOARD_W, laneH);
  ctx.clip();
  ctx.fillStyle = "rgba(255,170,40,0.12)";
  ctx.fillRect(CROSS_BOARD_X, top, CROSS_BOARD_W, laneH);
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
    const by = top + laneH / 2 - 7;
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
      const base = top + laneH - Math.round(laneH * 7 / 52);
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

/* ------------------------------ Polish A2: vehicle light ------------------------------ */

let sheenSprite: ArtCanvas | null | undefined;
let lampSprite: ArtCanvas | null | undefined;
function sheen(): ArtCanvas | null {
  if (sheenSprite !== undefined) return sheenSprite;
  const layer = artCanvas(32, 32);
  const c = layer && artContext(layer);
  if (layer && c) {
    const g = c.createLinearGradient(0, 0, 0, 32);
    g.addColorStop(0, "rgba(255,255,255,0.34)");
    g.addColorStop(0.5, "rgba(255,255,255,0.08)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = g;
    c.fillRect(0, 0, 32, 32);
  }
  sheenSprite = layer && c ? layer : null;
  return sheenSprite;
}
function lamp(): ArtCanvas | null {
  if (lampSprite !== undefined) return lampSprite;
  const layer = artCanvas(32, 32);
  const c = layer && artContext(layer);
  if (layer && c) {
    const g = c.createRadialGradient(16, 16, 1, 16, 16, 16);
    g.addColorStop(0, "rgba(255,248,214,0.9)");
    g.addColorStop(0.4, "rgba(255,240,180,0.35)");
    g.addColorStop(1, "rgba(255,240,180,0)");
    c.fillStyle = g;
    c.fillRect(0, 0, 32, 32);
  }
  lampSprite = layer && c ? layer : null;
  return lampSprite;
}
/** A sheen over the vehicle's upper half (inside its box) and a headlight glow at each front corner. */
function vehicleLight(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, dir: number, single = false): void {
  const s = sheen();
  if (s && !single) {
    ctx.save();
    roundRect(ctx, x, y, w, h, Math.min(12, h / 2));
    ctx.clip();
    ctx.drawImage(s as CanvasImageSource, x, y, w, h * 0.55);
    ctx.restore();
  }
  const l = lamp();
  if (!l) return;
  const fx = dir > 0 ? x + w - 3 : x + 3;
  // A motorbike has one headlamp, low on its front fork.
  if (single) {
    ctx.drawImage(l as CanvasImageSource, fx - 6, y + h * 0.62 - 6, 12, 12);
    return;
  }
  for (const ly of [y + 6, y + h - 6]) ctx.drawImage(l as CanvasImageSource, fx - 7, ly - 7, 14, 14);
}

/* ------------------------------ crossRev 8: buses, motorbikes, coins, the island ------------------------------ */

const BUS_COLOURS = ["#D7322B", "#2F6FD6", "#2A9D6A"] as const;
const MOTO_COLOURS = ["#F25C54", "#2ED3B7", "#FF8A3C", "#4F9CF9"] as const;

/**
 * A long bus filling exactly its collision box (seen from the side, like the cars): a rounded
 * body, a row of dark windows with a cream band under them, the driver's windscreen at the front,
 * a destination blind, doors and two wheel arches, white headlights and red tail lights.
 */
export function drawBus(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, dir: number, colour: string): void {
  const front = dir > 0 ? x + w : x;
  const back = dir > 0 ? x : x + w;
  ctx.fillStyle = colour;
  roundRect(ctx, x, y, w, h, 6);
  ctx.fill();
  // Roof light band and a darker skirt.
  ctx.fillStyle = "rgba(255,255,255,0.16)";
  ctx.fillRect(x + 4, y + 2, w - 8, 2);
  ctx.fillStyle = "rgba(0,0,0,0.2)";
  ctx.fillRect(x + 3, y + h - 5, w - 6, 3);
  // Cream band under the windows.
  ctx.fillStyle = "rgba(255,244,214,0.7)";
  ctx.fillRect(x + 4, y + h * 0.62, w - 8, 2);
  // Passenger windows: a row of dark panes.
  const winTop = y + h * 0.18;
  const winH = h * 0.38;
  const pane = 15;
  ctx.fillStyle = "rgba(11,11,15,0.58)";
  for (let k = 0; ; k++) {
    const px0 = dir > 0 ? x + 10 + k * (pane + 3) : x + w - 10 - (k + 1) * (pane + 3) + 3;
    if (dir > 0 ? px0 + pane > x + w - 26 : px0 < x + 26) break;
    ctx.fillRect(px0, winTop, pane, winH);
  }
  // The driver's windscreen, wider and lower at the front, and the destination blind above it.
  ctx.fillStyle = "rgba(11,11,15,0.62)";
  ctx.fillRect(dir > 0 ? x + w - 20 : x + 4, winTop - 1, 16, winH + 4);
  ctx.fillStyle = "#FFD45C";
  ctx.fillRect(dir > 0 ? x + w - 19 : x + 5, y + 2.5, 14, 3);
  // Doors: two glazed doors (behind the driver and in the middle), each split down its centre.
  for (const at of [dir > 0 ? x + w - 36 : x + 24, x + w / 2 - 6]) {
    const dx = Math.round(at);
    ctx.fillStyle = "rgba(11,11,15,0.5)";
    ctx.fillRect(dx, winTop, 12, y + h - 5 - winTop);
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.fillRect(dx + 5.5, winTop, 1, y + h - 5 - winTop);
  }
  // Wheel arches (inside the box).
  ctx.fillStyle = "#14171C";
  for (const at of [x + w * 0.18, x + w * 0.8]) {
    ctx.beginPath();
    ctx.arc(at, y + h - 1, Math.min(6, h * 0.2), Math.PI, 0);
    ctx.fill();
  }
  // Lights: white at the front, red at the back.
  ctx.fillStyle = "#FFFFFF";
  const hx = front - dir * 3;
  ctx.beginPath();
  ctx.arc(hx, y + 6, 2.4, 0, Math.PI * 2);
  ctx.arc(hx, y + h - 7, 2.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#FF3B3B";
  const tx = back + dir * 2;
  ctx.fillRect(tx - 1.5, y + 3, 3, 5);
  ctx.fillRect(tx - 1.5, y + h - 9, 3, 5);
}

/**
 * A motorbike and rider filling exactly their collision box (side-on, like the cyclists): two
 * chunky wheels, a coloured tank and fairing, an exhaust, and a leaning rider in a gold-visored helmet.
 */
export function drawMotorbike(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, dir: number, colour: string): void {
  const wheelR = Math.min(w * 0.2, h * 0.2);
  const groundY = y + h - wheelR;
  const rear = dir > 0 ? x + wheelR : x + w - wheelR;
  const front = dir > 0 ? x + w - wheelR : x + wheelR;
  const mid = (rear + front) / 2;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const cx of [rear, front]) {
    ctx.fillStyle = "#101216";
    ctx.beginPath();
    ctx.arc(cx, groundY, wheelR, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#AEB6C2";
    ctx.beginPath();
    ctx.arc(cx, groundY, wheelR * 0.42, 0, Math.PI * 2);
    ctx.fill();
  }
  // Exhaust along the back, then the body: tank and fairing in the bike's colour.
  ctx.strokeStyle = "#C9CED6";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(mid, groundY - 1);
  ctx.lineTo(rear - dir * wheelR * 0.6, groundY - 3);
  ctx.stroke();
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.moveTo(rear + dir * wheelR * 0.4, groundY - wheelR * 1.1);
  ctx.lineTo(mid + dir * wheelR * 0.6, groundY - wheelR * 1.9);
  ctx.lineTo(front - dir * wheelR * 0.1, groundY - wheelR * 1.5);
  ctx.lineTo(front - dir * wheelR * 0.6, groundY - wheelR * 0.4);
  ctx.lineTo(mid - dir * wheelR * 0.4, groundY - wheelR * 0.3);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.fillRect(Math.min(mid, mid + dir * wheelR * 0.8), groundY - wheelR * 1.75, wheelR * 0.8, 1.5);
  // The rider: leaning torso to the bars, a leg on the peg, and a dark helmet with a gold visor.
  const hipX = mid - dir * wheelR * 0.5;
  const hipY = groundY - wheelR * 1.9;
  const shoulderX = mid + dir * wheelR * 0.9;
  const shoulderY = y + h * 0.3;
  ctx.strokeStyle = "#20242C";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(hipX, hipY);
  ctx.lineTo(shoulderX, shoulderY);
  ctx.stroke();
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(shoulderX, shoulderY);
  ctx.lineTo(front - dir * wheelR * 0.5, groundY - wheelR * 1.6);
  ctx.moveTo(hipX, hipY);
  ctx.lineTo(mid, groundY - wheelR * 0.6);
  ctx.stroke();
  const headR = Math.max(3.5, h * 0.13);
  const headX = shoulderX + dir * 2;
  const headY = Math.max(y + headR, shoulderY - headR - 1);
  ctx.fillStyle = "#16181D";
  ctx.beginPath();
  ctx.arc(headX, headY, headR, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#F5B82E";
  ctx.fillRect(dir > 0 ? headX : headX - headR, headY - 1, headR, 2);
  ctx.restore();
}

let coinSprite: ArtCanvas | null | undefined;
let coinGlowSprite: ArtCanvas | null | undefined;
/** The gold coin, painted once (rim, face, embossed bolt and a highlight) at 4× for crisp scaling. */
function coinArt(): ArtCanvas | null {
  if (coinSprite !== undefined) return coinSprite;
  const S = 64;
  const layer = artCanvas(S, S);
  const c = layer && artContext(layer);
  if (layer && c) {
    const r = S / 2 - 2;
    const rim = c.createLinearGradient(0, 0, S, S);
    rim.addColorStop(0, "#FFE58A");
    rim.addColorStop(0.5, "#E0A526");
    rim.addColorStop(1, "#9C6B12");
    c.fillStyle = rim;
    c.beginPath();
    c.arc(S / 2, S / 2, r, 0, Math.PI * 2);
    c.fill();
    const face = c.createRadialGradient(S * 0.4, S * 0.38, 2, S / 2, S / 2, r * 0.8);
    face.addColorStop(0, "#FFF2B8");
    face.addColorStop(0.55, "#F5C443");
    face.addColorStop(1, "#D99A1E");
    c.fillStyle = face;
    c.beginPath();
    c.arc(S / 2, S / 2, r * 0.78, 0, Math.PI * 2);
    c.fill();
    // An embossed bolt (the Joulz mark), dark edge then light face.
    const bolt = (dx: number, dy: number, colour: string) => {
      c.fillStyle = colour;
      c.beginPath();
      c.moveTo(S * 0.56 + dx, S * 0.22 + dy);
      c.lineTo(S * 0.36 + dx, S * 0.54 + dy);
      c.lineTo(S * 0.5 + dx, S * 0.54 + dy);
      c.lineTo(S * 0.44 + dx, S * 0.8 + dy);
      c.lineTo(S * 0.66 + dx, S * 0.44 + dy);
      c.lineTo(S * 0.52 + dx, S * 0.44 + dy);
      c.closePath();
      c.fill();
    };
    bolt(1.5, 1.5, "rgba(140,92,10,0.75)");
    bolt(0, 0, "#FFF6CF");
    c.fillStyle = "rgba(255,255,255,0.55)";
    c.beginPath();
    c.ellipse(S * 0.36, S * 0.3, S * 0.12, S * 0.06, -0.6, 0, Math.PI * 2);
    c.fill();
  }
  coinSprite = layer && c ? layer : null;
  return coinSprite;
}
/** A soft warm glow behind a coin, painted once. */
function coinGlow(): ArtCanvas | null {
  if (coinGlowSprite !== undefined) return coinGlowSprite;
  const layer = artCanvas(48, 48);
  const c = layer && artContext(layer);
  if (layer && c) {
    const g = c.createRadialGradient(24, 24, 4, 24, 24, 24);
    g.addColorStop(0, "rgba(255,214,92,0.55)");
    g.addColorStop(0.5, "rgba(255,200,60,0.2)");
    g.addColorStop(1, "rgba(255,200,60,0)");
    c.fillStyle = g;
    c.fillRect(0, 0, 48, 48);
  }
  coinGlowSprite = layer && c ? layer : null;
  return coinGlowSprite;
}
const CROSS_COIN_R = 8;
/** One coin (8 px radius) at a cell's centre; `shine` 0…119 sweeps a glint across it now and then. */
function drawCoin(ctx: CanvasRenderingContext2D, x: number, y: number, lite: boolean, shine: number): void {
  const glow = lite ? null : coinGlow();
  if (glow) ctx.drawImage(glow as CanvasImageSource, x - 16, y - 16, 32, 32);
  const art = coinArt();
  if (art) ctx.drawImage(art as CanvasImageSource, x - CROSS_COIN_R, y - CROSS_COIN_R, CROSS_COIN_R * 2, CROSS_COIN_R * 2);
  else {
    ctx.fillStyle = "#F5C443";
    ctx.beginPath();
    ctx.arc(x, y, CROSS_COIN_R, 0, Math.PI * 2);
    ctx.fill();
  }
  if (!lite && shine < 14) {
    const t = shine / 14;
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, CROSS_COIN_R - 1, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.translate(x - CROSS_COIN_R + t * CROSS_COIN_R * 2, y);
    ctx.rotate(0.5);
    ctx.fillRect(-1.5, -CROSS_COIN_R * 1.5, 3, CROSS_COIN_R * 3);
    ctx.restore();
  }
}

/** The island's checkpoint flag at its right end: grey until banked, then gold with a brief glow. */
function drawIslandFlag(ctx: CanvasRenderingContext2D, top: number, h: number, banked: boolean, age: number, still: boolean, lite: boolean): void {
  const poleX = CROSS_BOARD_X + CROSS_BOARD_W - 5;
  const base = top + h - 6;
  const tip = top + 6;
  ctx.fillStyle = "#E6E8EC";
  ctx.fillRect(poleX - 0.75, tip, 1.5, base - tip);
  const wave = still ? 0 : Math.sin(age / 6) * 1.2;
  ctx.fillStyle = banked ? CROSS_PLAYER : "rgba(230,232,236,0.85)";
  ctx.beginPath();
  ctx.moveTo(poleX - 0.75, tip);
  ctx.lineTo(poleX - 14, tip + 5.5 + wave);
  ctx.lineTo(poleX - 0.75, tip + 12);
  ctx.closePath();
  ctx.fill();
  if (banked && !lite && age >= 0 && age < 40) {
    const glow = coinGlow();
    if (glow) {
      ctx.globalAlpha = 1 - age / 40;
      ctx.drawImage(glow as CanvasImageSource, poleX - 22, tip - 12, 32, 32);
      ctx.globalAlpha = 1;
    }
  }
}

/** crossRev 8 HUD, after the crossings pill: the coin count, then the streak multiplier the crossing under way pays (from ×2). */
function drawExpandHud(ctx: CanvasRenderingContext2D, state: CrossState, x: number, lite: boolean): void {
  ctx.font = "600 16px 'JetBrains Mono', ui-monospace, monospace";
  const count = String(state.coinTotal ?? 0);
  const coinW = 30 + Math.ceil(ctx.measureText(count).width) + 8;
  hudPill(ctx, x, 4, coinW, 28);
  drawCoin(ctx, x + 15, 18, lite, 999);
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.lineJoin = "round";
  ctx.strokeStyle = REAL_INK;
  ctx.lineWidth = 3.5;
  ctx.fillStyle = "#FFFFFF";
  ctx.strokeText(count, x + 28, 10);
  ctx.fillText(count, x + 28, 10);
  const mult = crossNextMultiplier(state);
  if (mult < 2) return;
  const label = `×${mult}`;
  const mx = x + coinW + 6;
  const mw = Math.ceil(ctx.measureText(label).width) + 18;
  hudPill(ctx, mx, 4, mw, 28);
  ctx.strokeText(label, mx + 9, 10);
  ctx.fillStyle = CROSS_PLAYER;
  ctx.fillText(label, mx + 9, 10);
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
  // Polish A2: soft clover patches and a scatter of tiny daisies and buttercups (seeded, world-anchored).
  c.save();
  c.beginPath();
  c.rect(x, y, w, h);
  c.clip();
  for (let k = 0; k < Math.ceil((w * h) / 900); k++) {
    const r = artHash(k, 59);
    c.fillStyle = r % 2 ? "rgba(40,95,30,0.12)" : "rgba(200,240,150,0.1)";
    c.beginPath();
    c.ellipse(x + ((r % 1000) / 1000) * w, y + (((r >>> 10) % 1000) / 1000) * h, 7 + (r % 5), 3 + ((r >>> 4) % 2), 0, 0, Math.PI * 2);
    c.fill();
  }
  for (let k = 0; k < Math.ceil((w * h) / 500); k++) {
    const r = artHash(k, 73);
    const fx = Math.round(x + ((r % 1000) / 1000) * w);
    const fy = Math.round(y + (((r >>> 10) % 1000) / 1000) * h);
    c.fillStyle = r % 3 ? "rgba(255,255,255,0.75)" : "rgba(255,226,92,0.85)";
    c.fillRect(fx, fy, 2, 2);
    c.fillStyle = "rgba(240,180,40,0.8)";
    if (r % 3) c.fillRect(fx + 0.5, fy + 0.5, 1, 1);
  }
  c.restore();
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
function paintRoad(c: CanvasRenderingContext2D, course: ReturnType<typeof crossCourse>, tex: ReturnType<typeof texture>, g: CrossGeom): void {
  paintGrass(c, 0, 0, CROSS_WORLD_W, g.worldH);
  const lanesY = CROSS_HUD_H + g.goalH;
  // Pavements: paving slabs with a kerb stone along the road edge.
  const pavement = (top: number, finish: boolean) => {
    const height = finish ? g.goalH : g.startH;
    c.fillStyle = tex.paving ?? "#BCC1C8";
    c.fillRect(CROSS_BOARD_X, top, CROSS_BOARD_W, height);
    const kerbY = finish ? top + height - 5 : top;
    c.fillStyle = REAL_KERB;
    c.fillRect(CROSS_BOARD_X, kerbY, CROSS_BOARD_W, 5);
    c.fillStyle = "rgba(255,255,255,0.45)";
    c.fillRect(CROSS_BOARD_X, kerbY, CROSS_BOARD_W, 1);
    c.fillStyle = "rgba(60,66,76,0.35)";
    for (let x = CROSS_BOARD_X + CROSS_COL_W; x < CROSS_BOARD_X + CROSS_BOARD_W; x += CROSS_COL_W * 2) c.fillRect(x, kerbY, 1, 5);
    c.fillStyle = "rgba(30,38,48,0.4)";
    c.fillRect(CROSS_BOARD_X, finish ? kerbY + 4 : kerbY + 4, CROSS_BOARD_W, 1);
    // Polish A2: the kerb stones lit along their road-side face, each stone slightly shaded.
    for (let x = CROSS_BOARD_X; x < CROSS_BOARD_X + CROSS_BOARD_W; x += CROSS_COL_W) {
      const g = c.createLinearGradient(x, 0, x + CROSS_COL_W, 0);
      g.addColorStop(0, "rgba(255,255,255,0.18)");
      g.addColorStop(1, "rgba(60,66,76,0.12)");
      c.fillStyle = g;
      c.fillRect(x, kerbY, Math.min(CROSS_COL_W, CROSS_BOARD_X + CROSS_BOARD_W - x), 4);
    }
    c.fillStyle = "rgba(255,255,255,0.7)";
    c.fillRect(CROSS_BOARD_X, finish ? kerbY + 3 : kerbY, CROSS_BOARD_W, 1);
    // Grass edge shadow onto the pavement's outer side.
    c.fillStyle = "rgba(30,50,20,0.18)";
    c.fillRect(CROSS_BOARD_X, finish ? top : top + height - 2, CROSS_BOARD_W, 2);
  };
  pavement(CROSS_HUD_H, true);
  pavement(crossStartTop(g), false);

  for (let lane = 1; lane <= g.rows; lane++) {
    const top = crossLaneTop(lane, g);
    const laneDef = course.lanes[lane - 1];
    if (laneDef?.kind === CROSS_KIND_ISLAND) {
      paintIsland(c, top, g.laneH);
      continue;
    }
    c.fillStyle = tex.asphalt ?? REAL_ASPHALT;
    c.fillRect(CROSS_BOARD_X, top, CROSS_BOARD_W, g.laneH);
    // Wheel tracks: two faint darker bands where the tyres run.
    c.fillStyle = "rgba(20,24,30,0.1)";
    const track = Math.round((g.laneH * 10) / 52);
    c.fillRect(CROSS_BOARD_X, top + track, CROSS_BOARD_W, 6);
    c.fillRect(CROSS_BOARD_X, top + g.laneH - track - 6, CROSS_BOARD_W, 6);
    // Patch repairs and cracks, fixed per lane.
    for (let k = 0; k < 2; k++) {
      const r = artHash(lane, k + 7);
      const x = CROSS_BOARD_X + (r % (CROSS_BOARD_W - 40));
      c.fillStyle = "rgba(30,34,40,0.08)";
      c.fillRect(x, top + 6 + ((r >>> 9) % (g.laneH - 32)), 22 + ((r >>> 14) % 18), 12);
    }
    // Dashed lane marking on the upper edge (Polish A2: snapped to the layer's own pixels, so crisp);
    // none against the island, which has its own kerbs.
    if (lane < g.rows && course.lanes[lane]?.kind !== CROSS_KIND_ISLAND) {
      const k = c.getTransform ? c.getTransform().d || 1 : 1;
      const y0 = Math.round((top - 1) * k) / k;
      const dh = Math.max(1, Math.round(2 * k)) / k;
      c.fillStyle = "rgba(248,250,252,0.9)";
      for (let x = CROSS_BOARD_X + 6; x < CROSS_BOARD_X + CROSS_BOARD_W; x += 34) {
        const x0 = Math.round(x * k) / k;
        const x1 = Math.round(Math.min(x + 16, CROSS_BOARD_X + CROSS_BOARD_W) * k) / k;
        c.fillRect(x0, y0, x1 - x0, dh);
      }
    }
    if (!laneDef) continue;
    if (laneDef.kind === CROSS_KIND_ROADWORKS) drawRoadworks(c, top, laneDef, g.laneH);
    else if (laneDef.kind === CROSS_KIND_CYCLE) drawCycleLane(c, top, g.laneH);
    else if (laneDef.kind === CROSS_KIND_BUS) drawBusLane(c, top, g.laneH);
  }
  // Solid edge lines at the kerbs.
  c.fillStyle = "rgba(250,250,250,0.85)";
  c.fillRect(CROSS_BOARD_X, lanesY + 1, CROSS_BOARD_W, 2);
  c.fillRect(CROSS_BOARD_X, crossStartTop(g) - 3, CROSS_BOARD_W, 2);
  // Polish A2: low hedges along both verges, from the HUD band down (background only; no lane reaches them).
  for (const x of [0, CROSS_BOARD_X + CROSS_BOARD_W]) paintHedge(c, x, CROSS_HUD_H, CROSS_BOARD_X, g.worldH - CROSS_HUD_H);
}

/**
 * crossRev 8's checkpoint island: a grass strip between kerb stones in the polished grass of the
 * verges (mown stripes, clover, tiny daisies and buttercups), with a low trimmed hedge at each end
 * (outside every column the walker stands on) and white edge lines on the road either side.
 */
function paintIsland(c: CanvasRenderingContext2D, top: number, h: number): void {
  paintGrass(c, CROSS_BOARD_X, top, CROSS_BOARD_W, h);
  for (const [y, lit] of [[top, true], [top + h - 4, false]] as const) {
    c.fillStyle = REAL_KERB;
    c.fillRect(CROSS_BOARD_X, y, CROSS_BOARD_W, 4);
    c.fillStyle = lit ? "rgba(255,255,255,0.6)" : "rgba(30,38,48,0.35)";
    c.fillRect(CROSS_BOARD_X, lit ? y : y + 3, CROSS_BOARD_W, 1);
    c.fillStyle = "rgba(60,66,76,0.3)";
    for (let x = CROSS_BOARD_X + CROSS_COL_W; x < CROSS_BOARD_X + CROSS_BOARD_W; x += CROSS_COL_W * 2) c.fillRect(x, y, 1, 4);
  }
  // A soft shadow under the upper kerb onto the grass.
  c.fillStyle = "rgba(30,50,20,0.2)";
  c.fillRect(CROSS_BOARD_X, top + 4, CROSS_BOARD_W, 2);
  // Low hedges at both ends, clear of the outer columns (column 0's centre is 26 px in).
  const hedgeW = 9;
  paintHedge(c, CROSS_BOARD_X, top + 6, hedgeW, h - 12);
  paintHedge(c, CROSS_BOARD_X + CROSS_BOARD_W - hedgeW, top + 6, hedgeW, h - 12);
  // Edge lines on the road above and below the island.
  c.fillStyle = "rgba(250,250,250,0.85)";
  c.fillRect(CROSS_BOARD_X, top - 3, CROSS_BOARD_W, 2);
  c.fillRect(CROSS_BOARD_X, top + h + 1, CROSS_BOARD_W, 2);
}

/** crossRev 8 bus lane: a faint red-tinted surface between two solid white edge lines (no text: the layer is cached). */
function drawBusLane(c: CanvasRenderingContext2D, top: number, laneH: number): void {
  c.fillStyle = "rgba(196, 52, 46, 0.18)";
  c.fillRect(CROSS_BOARD_X, top, CROSS_BOARD_W, laneH);
  c.fillStyle = "rgba(250,250,250,0.8)";
  c.fillRect(CROSS_BOARD_X, top + 1, CROSS_BOARD_W, 2);
  c.fillRect(CROSS_BOARD_X, top + laneH - 3, CROSS_BOARD_W, 2);
}

/** A trimmed hedge filling a narrow verge: dark leafy body, lighter rounded tops, a few highlights. */
function paintHedge(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  if (w <= 1) return;
  c.save();
  c.beginPath();
  c.rect(x, y, w, h);
  c.clip();
  c.fillStyle = "#3F7A35";
  c.fillRect(x, y, w, h);
  for (let k = 0, by = y; by < y + h; k++, by += 7) {
    const r = artHash(k, x > 0 ? 91 : 89);
    c.fillStyle = r % 2 ? "#4E8E40" : "#4A8A3C";
    c.beginPath();
    c.ellipse(x + w / 2, by + 3, w * 0.7, 4.5, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "rgba(190,235,140,0.35)";
    c.fillRect(x + 1 + (r % 3), by + 1, 2, 1);
  }
  c.fillStyle = "rgba(20,40,15,0.25)";
  c.fillRect(x > 0 ? x : x + w - 1, y, 1, h);
  c.restore();
}

/** Draws the crossing's cached scene (or paints it directly where no offscreen canvas exists); returns the layer. */
function roadLayer(ctx: CanvasRenderingContext2D, course: ReturnType<typeof crossCourse>, tex: ReturnType<typeof texture>, g: CrossGeom): ArtCanvas | null {
  const t = typeof ctx.getTransform === "function" ? ctx.getTransform() : null;
  const k = t ? Math.max(0.1, Math.hypot(t.a, t.b)) : 1;
  const pw = Math.max(1, Math.round(CROSS_WORLD_W * k));
  const ph = Math.max(1, Math.round(g.worldH * k));
  const key = `${pw}x${ph}|${tex.asphalt ? 1 : 0}`;
  let found = roadLayers.get(course);
  if (!found || found.key !== key) {
    const canvas = artCanvas(pw, ph);
    const c = canvas ? artContext(canvas) : null;
    if (canvas && c) {
      c.scale(pw / CROSS_WORLD_W, ph / g.worldH);
      paintRoad(c as CanvasRenderingContext2D, course, texture(c as CanvasRenderingContext2D), g);
    }
    found = { key, canvas: canvas && c ? canvas : null };
    roadLayers.set(course, found);
  }
  if (found.canvas) ctx.drawImage(found.canvas as CanvasImageSource, 0, 0, CROSS_WORLD_W, g.worldH);
  else paintRoad(ctx, course, tex, g);
  return found.canvas;
}

/** The game's drawing through the shared success layer (presentation only). */
export function drawCrossArt(ctx: CanvasRenderingContext2D, state: CrossState, size: CanvasSize, crashIndicator = true, pavedFoot = false): void {
  arcadeFx(ctx, crossFxFor(state), state, () => drawCrossArtWorld(ctx, state, size, crashIndicator, pavedFoot), size);
}

function drawCrossArtWorld(ctx: CanvasRenderingContext2D, state: CrossState, size: CanvasSize, crashIndicator = true, pavedFoot = false): void {
  const still = reducedMotion();
  const g = crossGeomOf(state);
  const worldH = g.worldH;
  const scale = Math.min(size.width / CROSS_WORLD_W, size.height / worldH);
  const offsetX = (size.width - CROSS_WORLD_W * scale) / 2;
  const offsetY = (size.height - worldH * scale) / 2;
  const rel = state.tick - state.crossStart;
  const course = crossCourse(state);
  const tex = texture(ctx);
  const fxLite = arcadeReducedEffects();

  ctx.save();
  ctx.fillStyle = REAL_GRASS_DARK;
  ctx.fillRect(0, 0, size.width, size.height);
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  const from = crossLaneCentre(state.lane, g);
  const to = crossLaneCentre(state.lane + state.hopDir, g);
  const done = state.hop > 0 ? (CROSS_HOP_TICKS - state.hop) / CROSS_HOP_TICKS : 0;
  const cy = state.hop > 0 ? from + (to - from) * done : from;
  const cx = px(crossColumnCentreFp(state.col));
  const memory = remember(state, cx, cy);

  // Verges, pavements, road surface, markings and roadworks: one cached layer per crossing.
  const layer = roadLayer(ctx, course, tex, g);
  // The play screen's arena scene (crossArenaScene) widens the start pavement downwards: the
  // grass strip under it is paved too, so pavement runs on unbroken past the world's edge.
  if (pavedFoot) {
    const foot = crossStartTop(g) + g.startH - 2;
    // crossRev 8's world ends 7 px under a slab joint: its foot is the paving's plain stone, so no
    // joint lines the world's bottom edge (the scene below carries the slabs on).
    ctx.fillStyle = g.island ? CROSS_X_FOOT_PAVING : (tex.paving ?? "#BCC1C8");
    ctx.fillRect(CROSS_BOARD_X, foot, CROSS_BOARD_W, worldH - foot);
  }
  // Finish pavement pulse after a clean crossing.
  const age = state.tick - memory.pulseTick;
  if (age >= 0 && age < 45) {
    const p = age / 45;
    ctx.fillStyle = `rgba(245,184,46,${(still ? 0.35 : 0.5 * Math.sin(p * Math.PI * 3) ** 2) * (1 - p)})`;
    ctx.fillRect(CROSS_BOARD_X, CROSS_HUD_H, CROSS_BOARD_W, g.goalH);
  }
  // crossRev 8: the island's checkpoint flag (gold once banked, with a short glow when it is) and
  // this crossing's uncollected coins, under the traffic.
  if (g.island) {
    const top = crossLaneTop(g.island, g);
    drawIslandFlag(ctx, top, g.laneH, !!state.banked, state.tick - memory.bankTick, still, fxLite);
  }
  if (course.coins) {
    const bob = still ? 0 : Math.sin(state.tick / 9) * 1.2;
    course.coins.forEach((cell, i) => {
      if ((state.coins ?? 0) & (1 << i)) return;
      const lane = cell >> 4;
      const x = px(crossColumnCentreFp(cell & 15));
      const y = crossLaneTop(lane, g) + g.laneH / 2;
      drawCoin(ctx, x, y + bob, fxLite, still ? 0 : (state.tick + i * 23) % 120);
    });
  }

  for (let lane = 1; lane <= g.rows; lane++) {
    const top = crossLaneTop(lane, g);
    const laneDef = course.lanes[lane - 1];
    if (!laneDef || laneDef.kind === CROSS_KIND_ROADWORKS || laneDef.kind === CROSS_KIND_ISLAND) continue;
    const cycle = laneDef.kind === CROSS_KIND_CYCLE;
    const moto = laneDef.kind === CROSS_KIND_MOTO;
    const bus = laneDef.kind === CROSS_KIND_BUS;
    const vy = top + g.inset;
    const vh = g.laneH - 2 * g.inset;
    const start = mod(laneDef.dir * laneDef.speed * rel + laneDef.phase, laneDef.period);
    const count = Math.ceil((CROSS_BOARD_W * 256) / laneDef.period) + 2;
    // Lorries: the fastest third of this crossing's car lanes (cyclist lanes and roadworks excluded).
    const speeds = course.lanes.filter((l) => !l.kind).map((l) => l.speed).sort((a, b) => a - b);
    const lorry = laneDef.speed >= (speeds[Math.floor((speeds.length * 2) / 3)] ?? Infinity);
    for (let index = -1; index <= count; index++) {
      const x = px(start + index * laneDef.period);
      if (cycle || moto) {
        // crossRev 3 lanes (and crossRev 8 motorbikes) hold a few riders at uneven offsets within one long period.
        const offsets = laneDef.offsets ?? [0];
        offsets.forEach((offset, k) => {
          const rx = px(start + index * laneDef.period + offset);
          const rw = px(laneDef.blockW);
          if (rx > CROSS_BOARD_X + CROSS_BOARD_W || rx + rw < CROSS_BOARD_X) return;
          if (moto) {
            if (!fxLite) {
              ctx.fillStyle = "rgba(10,14,20,0.26)";
              roundRect(ctx, rx + 2, vy + vh * 0.55 + 2, rw, vh * 0.45, vh * 0.2);
              ctx.fill();
            }
            drawMotorbike(ctx, rx, vy, rw, vh, laneDef.dir, MOTO_COLOURS[(lane + index * 3 + k + 8) % MOTO_COLOURS.length] ?? MOTO_COLOURS[0]);
            if (!fxLite) vehicleLight(ctx, rx, vy, rw, vh, laneDef.dir, true);
            return;
          }
          const jersey = RIDER_COLOURS[(lane + index * 3 + k + 8) % RIDER_COLOURS.length] ?? RIDER_COLOURS[0];
          drawRider(ctx, rx, vy, rw, vh, laneDef.dir, jersey);
        });
        continue;
      }
      const colour = CROSS_BLOCK_COLOURS[(lane + index + 8) % CROSS_BLOCK_COLOURS.length] ?? CROSS_BLOCK;
      const vw = px(laneDef.blockW);
      if (x > CROSS_BOARD_X + CROSS_BOARD_W || x + vw < CROSS_BOARD_X) continue;
      // Polish A2: a soft shadow on the road under the vehicle (2 px down and right), then the vehicle,
      // then a light sheen on its upper half and two small headlight glows at its front.
      if (!fxLite) {
        ctx.fillStyle = "rgba(10,14,20,0.28)";
        roundRect(ctx, x + 2, vy + 2, vw, vh, Math.min(bus ? 6 : 12, vh / 2));
        ctx.fill();
      }
      if (bus) {
        drawBus(ctx, x, vy, vw, vh, laneDef.dir, BUS_COLOURS[(lane + index + 8) % BUS_COLOURS.length] ?? BUS_COLOURS[0]);
        if (!fxLite) vehicleLight(ctx, x, vy, vw, vh, laneDef.dir);
        continue;
      }
      // Daylight: no headlight beams, so nothing drawn reaches past the collision box.
      drawVehicle(ctx, x, vy, vw, vh, laneDef.dir, colour, lorry, false);
      if (!fxLite) vehicleLight(ctx, x, vy, vw, vh, laneDef.dir);
    }
  }

  // Verges either side of the board, over any vehicle overhanging the road ends.
  const sideW = CROSS_BOARD_X;
  const sideH = worldH - CROSS_HUD_H;
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

  // Polish A2: the HUD on soft dark pills (the count and the lives).
  ctx.font = "600 16px 'JetBrains Mono', ui-monospace, monospace";
  const crossingsW = Math.ceil(ctx.measureText(`Crossings ${state.crossings}`).width) + 18;
  hudPill(ctx, 6, 4, crossingsW, 28);
  if (state.wide) drawExpandHud(ctx, state, 6 + crossingsW + 6, fxLite);
  hudPill(ctx, CROSS_WORLD_W - 22 - (CROSS_LIVES - 1) * 18 - 14, 4, (CROSS_LIVES - 1) * 18 + 28, 28);
  for (let i = 0; i < CROSS_LIVES; i++) {
    ctx.fillStyle = i < state.lives ? CROSS_PLAYER : "rgba(255,255,255,0.22)";
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

  successFrame(ctx,{id:'cross',tick:state.tick,count:state.crossings,misses:CROSS_LIVES-state.lives,colour:CROSS_PLAYER,width:CROSS_WORLD_W,height:worldH,point:{x:cx,y:CROSS_HUD_H+g.goalH/2,shape:'line',radius:24,label:'+1'},hud:{x:14,y:10,text:`Crossings ${state.crossings}`}});
  if (hitAge < 20 && !state.dead && crashIndicator) {
    ctx.fillStyle = `rgba(255, 77, 77, ${0.25 * (1 - hitAge / 20)})`;
    ctx.fillRect(0, 0, CROSS_WORLD_W, worldH);
  }
  if (crossPaused(state) && hitAge >= CROSS_PAUSE_TICKS) {
    ctx.fillStyle = "rgba(11, 11, 15, 0.55)";
    ctx.fillRect(CROSS_BOARD_X, worldH / 2 - 30, CROSS_BOARD_W, 60);
    ctx.fillStyle = CROSS_PLAYER;
    ctx.font = "700 24px 'JetBrains Mono', ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`Crossing ${state.crossings + 1}`, CROSS_WORLD_W / 2, worldH / 2);
  }
  if (state.dead && crashIndicator) {
    ctx.fillStyle = "rgba(255, 77, 77, 0.22)";
    ctx.fillRect(0, 0, CROSS_WORLD_W, worldH);
  }
  ctx.restore();
}

function hudPill(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = "rgba(14,20,28,0.42)";
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 1;
  roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, h / 2);
  ctx.stroke();
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
  // crossRev 8's world fills the screen: the short strip below is all pavement, no grass verge.
  const verge = view.worldH > CROSS_WORLD_H && below.h < 40 ? 0 : Math.min(14, below.h);
  const paved = below.h - verge;
  if (paved > 0) {
    ctx.fillStyle = tex.paving ?? "#BCC1C8";
    ctx.fillRect(CROSS_BOARD_X, below.y, CROSS_BOARD_W, paved);
    // The paving's outer edge: a low edging stone, then the grass edge's shadow.
    if (verge > 0) {
    ctx.fillStyle = REAL_KERB;
    ctx.fillRect(CROSS_BOARD_X, below.y + paved - 3, CROSS_BOARD_W, 3);
    ctx.fillStyle = "rgba(30,38,48,0.35)";
    ctx.fillRect(CROSS_BOARD_X, below.y + paved - 1, CROSS_BOARD_W, 1);
    }
    ctx.fillStyle = "rgba(30,50,20,0.18)";
    ctx.fillRect(CROSS_BOARD_X - 2, below.y, 2, paved);
    ctx.fillRect(CROSS_BOARD_X + CROSS_BOARD_W, below.y, 2, paved);
  }
}
