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
  CROSS_X_COINS_PER_RUN,
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
  crossFlowNext,
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
import { retroHud, retroText, RETRO_WHITE, type RetroHudItem } from "./retro.renderer";
import {
  COMET_COLOURS,
  FREIGHT_HULLS,
  SHIP_HULLS,
  SPACE_VOID,
  SPACE_VOID_DEEP,
  drawAstronaut,
  drawComet,
  drawDebris,
  drawFreighter,
  drawHelmetIcon,
  drawSpaceShip,
  paintDockingPlatform,
  paintFreightLane,
  paintPlasmaLane,
  paintSpaceLane,
  paintSpaceVoid,
  paintStationDeck,
} from "./spacewalk.renderer";

/** crossRev 9: the plain paving stone of the world's foot (the slab pattern's own face colour). */
const CROSS_X_FOOT_PAVING = "#5A5F69";

// The evening palette (Joe's phone notes, 27 Oct 2026; display only): a darker road, dim grass, hedges and
// paving, a blue dusk wash and warm lamp pools on the verges. Was Real World daylight (realworld.renderer's
// REAL_* values; not imported, because realworld.renderer re-exports drawVehicle from this module).
export const REAL_ASPHALT = "#25292F";
const REAL_GRASS = "#2F4B31";
const REAL_GRASS_DARK = "#223825";
const REAL_INK = "#1E2630";
const REAL_KERB = "#7A7F88";
/** The paving slabs' face colour. */
const CROSS_PAVING = "#5F646E";
/** The dusk wash over the cached scene (not the traffic, the walker or the HUD). */
const CROSS_DUSK = "rgba(16,22,58,0.22)";

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
  /** crossRev 9: the tick the island was banked (its flag lights), and the coin count seen. */
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
        c.fillStyle = h % 3 === 0 ? "rgba(255,255,255,0.05)" : "rgba(8,10,14,0.3)";
        c.fillRect(h % 64, (h >>> 6) % 64, 1 + ((h >>> 12) % 2), 1);
      }
    }),
    paving: make((c) => {
      c.fillStyle = CROSS_PAVING;
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

/* ------------------------------ crossRev 9: buses, motorbikes, coins, the island ------------------------------ */

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

/**
 * The HUD's top-right counts (one Retro HUD, 3 Nov 2026). crossRev 11: the no-stop streak, "NO-STOP x n" for the
 * no-stop crossings in a row the crossing under way makes if it carries on as it is going (gold from x2, when it
 * pays), grey "NO-STOP -" once this crossing has stopped on the deck or the platform, or been hit. crossRev 9–10:
 * the coins taken of the run's twenty, then the streak multiplier the crossing under way pays (from x2).
 */
function crossHudSide(state: CrossState): RetroHudItem[] {
  if (!state.wide) return [];
  if (state.flow) {
    const next = crossFlowNext(state);
    return [{ text: next > 0 ? `NO-STOP x${next}` : "NO-STOP -", colour: next >= 2 ? CROSS_PLAYER : next === 1 ? RETRO_WHITE : "rgba(255,255,255,0.5)" }];
  }
  const out: RetroHudItem[] = [{ text: `COINS ${state.coinTotal ?? 0}/${CROSS_X_COINS_PER_RUN}`, colour: "#FFD84A" }];
  const mult = crossNextMultiplier(state);
  if (mult >= 2) out.push({ text: `STREAK x${mult}`, colour: CROSS_PLAYER });
  return out;
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
    c.fillStyle = r % 3 ? "rgba(220,226,255,0.28)" : "rgba(255,226,92,0.3)";
    c.fillRect(fx, fy, 2, 2);
    c.fillStyle = "rgba(240,180,40,0.3)";
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
    c.strokeStyle = r % 3 ? "rgba(10,30,12,0.4)" : "rgba(150,190,150,0.16)";
    c.beginPath();
    c.moveTo(bx, by);
    c.lineTo(bx + ((r >>> 20) % 3) - 1, by - 3);
    c.stroke();
  }
  c.restore();
}

/**
 * The static scene for one crossing, in world units. Since 3 Nov 2026 (Spacewalk, display only) open space at
 * the sides, station decks for the kerbs and pavements, dark space lanes with beacon dots between them, plasma
 * lanes for the comet (cyclist and motorbike) lanes, an amber freight lane and the docking platform; the debris
 * in closed columns is drawn live (drawDebris). The old road painters stay for the tile and icon art.
 */
function paintRoad(c: CanvasRenderingContext2D, course: ReturnType<typeof crossCourse>, _tex: ReturnType<typeof texture>, g: CrossGeom): void {
  paintSpaceVoid(c, 0, 0, CROSS_WORLD_W, g.worldH);
  paintStationDeck(c, CROSS_BOARD_X, CROSS_HUD_H, CROSS_BOARD_W, g.goalH, "bottom");
  paintStationDeck(c, CROSS_BOARD_X, crossStartTop(g), CROSS_BOARD_W, g.startH, "top");
  for (let lane = 1; lane <= g.rows; lane++) {
    const top = crossLaneTop(lane, g);
    const laneDef = course.lanes[lane - 1];
    if (laneDef?.kind === CROSS_KIND_ISLAND) {
      paintDockingPlatform(c, CROSS_BOARD_X, top, CROSS_BOARD_W, g.laneH);
      continue;
    }
    const beacons = lane > 1 && course.lanes[lane - 2]?.kind !== CROSS_KIND_ISLAND;
    paintSpaceLane(c, CROSS_BOARD_X, top, CROSS_BOARD_W, g.laneH, lane, beacons);
    if (!laneDef) continue;
    if (laneDef.kind === CROSS_KIND_CYCLE || laneDef.kind === CROSS_KIND_MOTO) paintPlasmaLane(c, CROSS_BOARD_X, top, CROSS_BOARD_W, g.laneH);
    else if (laneDef.kind === CROSS_KIND_BUS) paintFreightLane(c, CROSS_BOARD_X, top, CROSS_BOARD_W, g.laneH);
    else if (laneDef.kind === CROSS_KIND_ROADWORKS) {
      c.fillStyle = "rgba(255,194,58,0.08)";
      c.fillRect(CROSS_BOARD_X, top, CROSS_BOARD_W, g.laneH);
    }
  }
  // The board's side rails: thin cyan lines between the lanes and open space.
  c.fillStyle = "rgba(61,255,224,0.35)";
  c.fillRect(CROSS_BOARD_X - 1, CROSS_HUD_H, 1, g.worldH - CROSS_HUD_H);
  c.fillRect(CROSS_BOARD_X + CROSS_BOARD_W, CROSS_HUD_H, 1, g.worldH - CROSS_HUD_H);
}

/** The closed columns' span on a roadworks lane (as drawRoadworks: the barrier edges 10 px past the last closed centre). */
function debrisSpans(lane: CrossLane): [number, number][] {
  const closed = new Set(lane.closed ?? []);
  const centre = (col: number) => px(crossColumnCentreFp(col));
  const edge = CROSS_COL_W / 2 - 3;
  const out: [number, number][] = [];
  for (let col = 0; col < CROSS_COLS; col++) {
    if (!closed.has(col) || closed.has(col - 1)) continue;
    let end = col;
    while (closed.has(end + 1)) end += 1;
    out.push([col === 0 ? CROSS_BOARD_X : centre(col) - edge, end === CROSS_COLS - 1 ? CROSS_BOARD_X + CROSS_BOARD_W : centre(end) + edge]);
  }
  return out;
}

/**
 * The evening (Joe's phone notes, 27 Oct 2026; display only, in the cached scene): a blue dusk wash over the
 * whole crossing, then soft warm pools from street lamps on both verges, every 150 px, faint on the road's
 * edge. Light only: nothing here is solid or near a lane's middle, and the traffic is drawn over it.
 */
function paintEvening(c: CanvasRenderingContext2D, g: CrossGeom): void {
  c.fillStyle = CROSS_DUSK;
  c.fillRect(0, 0, CROSS_WORLD_W, g.worldH);
  // The pools end above the start pavement's foot, which the play screen repaints (pavedFoot) and runs on below.
  const foot = crossStartTop(g) + g.startH - 2;
  for (let k = 0, y = CROSS_HUD_H + 60; y + 40 + 70 < foot; k++, y += 150) {
    for (const x of [CROSS_BOARD_X / 2, CROSS_WORLD_W - CROSS_BOARD_X / 2]) {
      const ly = y + (k % 2 ? 40 : 0) * (x < CROSS_WORLD_W / 2 ? 1 : -1);
      const pool = c.createRadialGradient(x, ly, 2, x, ly, 70);
      pool.addColorStop(0, "rgba(255,196,120,0.2)");
      pool.addColorStop(0.45, "rgba(255,180,100,0.07)");
      pool.addColorStop(1, "rgba(255,180,100,0)");
      c.fillStyle = pool;
      c.fillRect(x - 70, ly - 70, 140, 140);
      // The lamp head on the verge.
      c.fillStyle = "rgba(255,226,170,0.85)";
      c.beginPath();
      c.arc(x, ly, 2, 0, Math.PI * 2);
      c.fill();
    }
  }
}

/**
 * crossRev 9's checkpoint island: a grass strip between kerb stones in the polished grass of the
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

/** crossRev 9 bus lane: a faint red-tinted surface between two solid white edge lines (no text: the layer is cached). */
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
  c.fillStyle = "#1C3420";
  c.fillRect(x, y, w, h);
  for (let k = 0, by = y; by < y + h; k++, by += 7) {
    const r = artHash(k, x > 0 ? 91 : 89);
    c.fillStyle = r % 2 ? "#264528" : "#234126";
    c.beginPath();
    c.ellipse(x + w / 2, by + 3, w * 0.7, 4.5, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "rgba(170,210,170,0.12)";
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
  ctx.fillStyle = SPACE_VOID_DEEP;
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
    // Spacewalk: the start deck runs on unbroken under the world (crossArenaScene carries it on below).
    const foot = crossStartTop(g) + g.startH - 2;
    paintStationDeck(ctx, CROSS_BOARD_X, foot, CROSS_BOARD_W, worldH - foot, "none");
  }
  // Debris drifting in the closed columns (display only, inside the closed span).
  const clock = still ? 0 : typeof performance === "undefined" ? 0 : performance.now();
  course.lanes.forEach((laneDef, i) => {
    if (laneDef.kind !== CROSS_KIND_ROADWORKS) return;
    const top = crossLaneTop(i + 1, g);
    debrisSpans(laneDef).forEach(([x0, x1], k) => drawDebris(ctx, x0, x1, top + g.laneH / 2, (i + 1) * 13 + k, clock));
  });
  // Finish pavement pulse after a clean crossing.
  const age = state.tick - memory.pulseTick;
  if (age >= 0 && age < 45) {
    const p = age / 45;
    ctx.fillStyle = `rgba(245,184,46,${(still ? 0.35 : 0.5 * Math.sin(p * Math.PI * 3) ** 2) * (1 - p)})`;
    ctx.fillRect(CROSS_BOARD_X, CROSS_HUD_H, CROSS_BOARD_W, g.goalH);
  }
  // crossRev 9: the island's checkpoint flag (gold once banked, with a short glow when it is) and
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
        // crossRev 3 lanes (and crossRev 9 motorbikes) hold a few riders at uneven offsets within one long period.
        const offsets = laneDef.offsets ?? [0];
        offsets.forEach((offset, k) => {
          const rx = px(start + index * laneDef.period + offset);
          const rw = px(laneDef.blockW);
          if (rx > CROSS_BOARD_X + CROSS_BOARD_W || rx + rw < CROSS_BOARD_X) return;
          // Spacewalk: motorbikes and bikes are fast comets on the plasma lanes.
          const palette = COMET_COLOURS[(lane + index * 3 + k + 8) % COMET_COLOURS.length] ?? COMET_COLOURS[0];
          drawComet(ctx, rx, vy, rw, vh, laneDef.dir, palette);
        });
        continue;
      }
      const vw = px(laneDef.blockW);
      if (x > CROSS_BOARD_X + CROSS_BOARD_W || x + vw < CROSS_BOARD_X) continue;
      if (bus) {
        // Buses are long slow cargo freighters.
        drawFreighter(ctx, x, vy, vw, vh, laneDef.dir, FREIGHT_HULLS[(lane + index + 8) % FREIGHT_HULLS.length] ?? FREIGHT_HULLS[0], clock);
        continue;
      }
      // Cars (and lorries, the fastest third) are small ships; lorries take the brighter hulls.
      const hull = SHIP_HULLS[(lane + index + 8 + (lorry ? 3 : 0)) % SHIP_HULLS.length] ?? SHIP_HULLS[0];
      drawSpaceShip(ctx, x, vy, vw, vh, laneDef.dir, hull, clock);
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
      ctx.fillStyle = SPACE_VOID;
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
    drawAstronaut(ctx, memory.hitX, memory.hitY, crossPlayerR(state), memory.facing, 0, still ? 0 : Math.min(1, p * 1.5) * Math.PI * 1.5, false);
    ctx.globalAlpha = 1;
  }
  if (!state.dead) {
    // Stride: legs swap on each step, swing mid-hop.
    const parity = memory.steps % 2 ? 1 : -1;
    const stride = still ? parity * 0.6 : parity * (state.hop > 0 ? Math.sin(done * Math.PI) : 0.6);
    ctx.globalAlpha = state.ghost && Math.floor(state.tick / 6) % 2 === 0 ? 0.45 : 1;
    drawAstronaut(ctx, cx, cy, crossPlayerR(state), memory.facing, stride, 0, !fxLite);
    ctx.globalAlpha = 1;
  }

  // One Retro HUD (3 Nov 2026): crossings top left with the lives (helmets) under them; top right the no-stop
  // streak (crossRev 11) or the coins and the multiplier (crossRev 9–10).
  retroHud(ctx, CROSS_WORLD_W, { text: `CROSSINGS ${state.crossings}` }, crossHudSide(state), {
    top: 6,
    wrapMain: (draw) => successHud(ctx, "cross", state.tick, 12, 6, draw),
  });
  for (let i = 0; i < CROSS_LIVES; i++) drawHelmetIcon(ctx, 18 + i * 14, 28, i < state.lives);
  successFrame(ctx,{id:'cross',tick:state.tick,count:state.crossings,misses:CROSS_LIVES-state.lives,colour:CROSS_PLAYER,width:CROSS_WORLD_W,height:worldH,point:{x:cx,y:CROSS_HUD_H+g.goalH/2,shape:'line',radius:24,label:'+1'},hud:{x:14,y:10,text:`Crossings ${state.crossings}`}});
  if (hitAge < 20 && !state.dead && crashIndicator) {
    ctx.fillStyle = `rgba(255, 77, 77, ${0.25 * (1 - hitAge / 20)})`;
    ctx.fillRect(0, 0, CROSS_WORLD_W, worldH);
  }
  if (crossPaused(state) && hitAge >= CROSS_PAUSE_TICKS) {
    ctx.fillStyle = "rgba(11, 11, 15, 0.55)";
    ctx.fillRect(CROSS_BOARD_X, worldH / 2 - 30, CROSS_BOARD_W, 60);
    retroText(ctx, `CROSSING ${state.crossings + 1}`, CROSS_WORLD_W / 2, worldH / 2 - 8, 16, CROSS_PLAYER, "center", 4);
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
  // Spacewalk (3 Nov 2026): open space at the sides; below the world the start deck runs on to the box's bottom.
  for (const side of sceneSides(view)) paintSpaceVoid(ctx, side.x, side.y, side.w, side.h, 29);
  const below = sceneBelow(view);
  if (!below) return;
  paintSpaceVoid(ctx, below.x, below.y, below.w, below.h, 31);
  paintStationDeck(ctx, CROSS_BOARD_X, below.y, CROSS_BOARD_W, below.h, "none");
  ctx.fillStyle = "rgba(61,255,224,0.35)";
  ctx.fillRect(CROSS_BOARD_X - 1, below.y, 1, below.h);
  ctx.fillRect(CROSS_BOARD_X + CROSS_BOARD_W, below.y, 1, below.h);
}
