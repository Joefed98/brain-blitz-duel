/**
 * Racing's art (display only; never imported by the sim or the server). A classic pseudo-3D road: the circuit is a
 * list of segments (racingTrack), projected every frame from the car's distance with a chase camera behind it at
 * sunset. The road's curve offsets and hill heights accumulate segment by segment; the road surfaces are batched one
 * path per colour and drawn front to back with a crest clip; the roadside (trees, the grandstand and its catch fence,
 * braking boards, the tyre wall) is drawn back to front, scaled by distance. The sky, the sun's rays and two hill
 * layers are painted once per size on offscreen canvases (the hills scroll with the car's heading); the car is a
 * cached sprite. Ghost cars (other players, setRacingGhosts) are translucent copies with name tags.
 *
 * Bounds (rule 3): the camera follows the car sideways exactly, the curve offsets are zero at the car's own depth, and
 * the car is drawn exactly 2 × RACING_CAR_HALF wide at that depth, so its outer edge crosses the kerb's outer edge on
 * the tick the sim puts a wheel on the grass, and meets the tyre wall's face where the sim stops it.
 */
import { ARCADE_FX_DISPLAY_FONT } from "./arcadeFx.renderer";
import type { ArenaSceneView } from "./arenaScene.renderer";
import type { ArcadeGame, ArcadeInputEvent, CanvasSize } from "./engine";
import {
  racingGame,
  racingKmh,
  racingLap,
  racingSegAt,
  racingTrack,
  RACING_CAR_HALF,
  RACING_KERB_X,
  RACING_LAP_SEGS,
  RACING_LAPS,
  RACING_ROAD_X,
  RACING_RUN_TICKS,
  RACING_SEC_CHICANE,
  RACING_SEC_HAIRPIN,
  RACING_SECTORS,
  RACING_SEG,
  RACING_STICK_MAX,
  RACING_WALL_X,
  RACING_WORLD_H,
  RACING_WORLD_W,
  type RacingState,
  type RacingTrack,
} from "./racing";

export const RACING_ART_BG = "#1A1418";
const MONO = "'Duelz Mono', 'JetBrains Mono', ui-monospace, monospace";

/* ================================ Projection ================================ */

/** World units: a segment is SL long, the tarmac's half width RW. */
const SL = 200;
const RW = 1000;
/** Focal length (px per unit at depth 1), camera height, the car's depth from the camera, the horizon's y. */
const F = 300;
const CH = 1714;
const ZC = 1714;
const HORIZON = 270;
/** The car's contact line on screen (HORIZON + CH × F ÷ ZC). */
export const RACING_CAR_Y = HORIZON + (CH * F) / ZC;
const DRAW_SEGS = 150;
const K_CURVE = 1.4;
const HILL_K = 0.5;
/** Heading: radians per unit of curvature × segment; the sun's bearing. */
const K_ANG = Math.PI / 300;
const SUN_BEARING = 0.18;
const PX_PER_RAD = F;

const lat = (x: number) => (x / RACING_ROAD_X) * RW;
const KERB_W = lat(RACING_KERB_X);
const WALL_W = lat(RACING_WALL_X);
const CAR_HALF_W = lat(RACING_CAR_HALF);
/** The car's half width on screen at its depth. */
export const RACING_CAR_HALF_PX = (CAR_HALF_W * F) / ZC;
const WALL_H = 110;

/* ================================ Joystick (display) ================================ */

/** The joystick's resting centre and its throw (world px); the Stage maps the thumb with the same numbers. */
export const RACING_STICK_X = RACING_WORLD_W / 2;
export const RACING_STICK_Y = 652;
export const RACING_STICK_R = 46;
/** The thumb's touch area starts here (world y). */
export const RACING_STICK_TOP = 470;

let stickOrigin: { x: number; y: number } | null = null;
/** Display only: where the thumb went down (null when lifted), so the base is drawn under it. */
export function setRacingStick(origin: { x: number; y: number } | null): void {
  stickOrigin = origin;
}

/* ================================ Ghosts (display) ================================ */

export interface RacingGhostView {
  name: string;
  colour: string;
  /** Race distance and lateral position in the sim's units. */
  s: number;
  x: number;
}
let ghosts: readonly RacingGhostView[] = [];
/** Display only: the other players' cars to draw this frame. */
export function setRacingGhosts(list: readonly RacingGhostView[] | null | undefined): void {
  ghosts = list ?? [];
}

/* ================================ Offscreen helpers ================================ */

type Surface = HTMLCanvasElement | OffscreenCanvas;
function makeSurface(w: number, h: number): Surface | null {
  const W = Math.max(1, Math.ceil(w));
  const H = Math.max(1, Math.ceil(h));
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(W, H);
  if (typeof document !== "undefined") {
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    return c;
  }
  return null;
}
type Ctx2D = CanvasRenderingContext2D;
const ctxOf = (s: Surface) => s.getContext("2d") as unknown as Ctx2D | null;

/** A tiny deterministic hash for scenery placement (display only). */
function hash(n: number): number {
  let x = n | 0;
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

/* ================================ Sky and hills ================================ */

/** The sunset sky (no sun: the sun moves with the heading), painted into a w × h rect. */
export function paintRacingSky(ctx: Ctx2D, w: number, h: number, horizon = HORIZON): void {
  const g = ctx.createLinearGradient(0, 0, 0, horizon + 20);
  g.addColorStop(0, "#2C2F5E");
  g.addColorStop(0.28, "#6B4778");
  g.addColorStop(0.58, "#D9714F");
  g.addColorStop(0.84, "#F7A55C");
  g.addColorStop(1, "#FFD38A");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, Math.min(h, horizon + 20));
  // Thin warm clouds.
  ctx.save();
  ctx.globalAlpha = 0.35;
  for (let i = 0; i < 7; i++) {
    const y = horizon * (0.2 + 0.1 * i) + hash(i * 7 + 1) * 10;
    const x = hash(i * 13 + 3) * w;
    const len = 80 + hash(i * 5 + 2) * 160;
    const cg = ctx.createLinearGradient(x - len / 2, 0, x + len / 2, 0);
    cg.addColorStop(0, "rgba(255,190,140,0)");
    cg.addColorStop(0.5, i < 3 ? "rgba(200,120,150,0.8)" : "rgba(255,190,140,0.9)");
    cg.addColorStop(1, "rgba(255,190,140,0)");
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.ellipse(x, y, len / 2, 2.2 + hash(i) * 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** The sun, its rays and the haze round it, at (x, y). */
function paintSun(ctx: Ctx2D, x: number, y: number, r = 15): void {
  const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 9);
  glow.addColorStop(0, "rgba(255,240,200,0.95)");
  glow.addColorStop(0.12, "rgba(255,214,140,0.65)");
  glow.addColorStop(0.4, "rgba(255,160,90,0.18)");
  glow.addColorStop(1, "rgba(255,140,80,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(x - r * 9, y - r * 9, r * 18, r * 18);
  // Rays: soft wedges.
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = "#FFE3A8";
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + 0.13;
    const len = r * (6 + 4 * hash(i + 40));
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a - 0.05) * len, y + Math.sin(a - 0.05) * len);
    ctx.lineTo(x + Math.cos(a + 0.05) * len, y + Math.sin(a + 0.05) * len);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  ctx.fillStyle = "#FFF4D6";
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

/** A hill layer strip (repeating every `w`): ridge heights from a seeded sum of waves. */
function paintHillStrip(ctx: Ctx2D, w: number, h: number, seed: number, top: string, bottom: string, rim: string, amp: number, trees: boolean): void {
  const ridge = (x: number) => {
    const t = (x / w) * Math.PI * 2;
    return h - amp * (0.55 + 0.25 * Math.sin(t * 2 + seed) + 0.15 * Math.sin(t * 5 + seed * 3) + 0.06 * Math.sin(t * 11 + seed * 7));
  };
  const g = ctx.createLinearGradient(0, h - amp, 0, h);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let x = 0; x <= w; x += 4) ctx.lineTo(x, ridge(x));
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = rim;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= w; x += 4) (x === 0 ? ctx.moveTo : ctx.lineTo).call(ctx, x, ridge(x) + 0.5);
  ctx.stroke();
  if (trees) {
    ctx.fillStyle = bottom;
    for (let i = 0; i < w / 9; i++) {
      const x = hash(i * 31 + seed * 101) * w;
      const y = ridge(x);
      const s = 3 + hash(i * 17 + seed) * 5;
      ctx.beginPath();
      ctx.moveTo(x - s * 0.5, y + 2);
      ctx.lineTo(x, y - s * 1.6);
      ctx.lineTo(x + s * 0.5, y + 2);
      ctx.fill();
    }
  }
}

interface Layers {
  scale: number;
  sky: Surface | null;
  far: Surface | null;
  near: Surface | null;
  car: Surface | null;
  carBrake: Surface | null;
  trees: Surface[];
  stand: Surface | null;
}
let layers: Layers | null = null;
const HILL_W = Math.round(Math.PI * 2 * PX_PER_RAD);
const FAR_H = 70;
const NEAR_H = 58;
const CAR_SPRITE_W = 120;
const CAR_SPRITE_H = 76;
const TREE_W = 60;
const TREE_H = 120;
const STAND_W = 240;
const STAND_H = 120;

function layersFor(scale: number): Layers {
  const s = Math.max(1, Math.min(3, Math.round(scale * 2) / 2));
  if (layers && layers.scale === s) return layers;
  const surf = (w: number, h: number, paint: (c: Ctx2D) => void): Surface | null => {
    const out = makeSurface(w * s, h * s);
    const c = out ? ctxOf(out) : null;
    if (!out || !c) return null;
    c.scale(s, s);
    paint(c);
    return out;
  };
  layers = {
    scale: s,
    sky: surf(RACING_WORLD_W, HORIZON + 20, (c) => paintRacingSky(c, RACING_WORLD_W, RACING_WORLD_H)),
    far: surf(HILL_W, FAR_H, (c) => paintHillStrip(c, HILL_W, FAR_H, 3, "#8A5A7A", "#5E4466", "rgba(255,190,150,0.55)", 52, false)),
    near: surf(HILL_W, NEAR_H, (c) => paintHillStrip(c, HILL_W, NEAR_H, 11, "#4A3B48", "#2E2A30", "rgba(255,170,110,0.6)", 40, true)),
    car: surf(CAR_SPRITE_W, CAR_SPRITE_H, (c) => paintRacingCar(c, CAR_SPRITE_W / 2, CAR_SPRITE_H - 2, CAR_SPRITE_W, false)),
    carBrake: surf(CAR_SPRITE_W, CAR_SPRITE_H, (c) => paintRacingCar(c, CAR_SPRITE_W / 2, CAR_SPRITE_H - 2, CAR_SPRITE_W, true)),
    trees: [0, 1, 2].map((v) => surf(TREE_W, TREE_H, (c) => paintTree(c, TREE_W / 2, TREE_H, TREE_H, v))).filter((x): x is Surface => x !== null),
    stand: surf(STAND_W, STAND_H, (c) => paintStand(c, STAND_W, STAND_H)),
  };
  return layers;
}

/* ================================ Painters ================================ */

/** A roadside tree (silhouette with a warm rim from the low sun), its trunk's foot at (x, y). */
function paintTree(ctx: Ctx2D, x: number, y: number, h: number, variant: number): void {
  ctx.fillStyle = "#2B1E18";
  ctx.fillRect(x - h * 0.025, y - h * 0.3, h * 0.05, h * 0.3);
  const body = variant === 0 ? "#22301F" : variant === 1 ? "#283522" : "#1E2A20";
  const rim = "rgba(255,170,90,0.55)";
  if (variant === 2) {
    // A poplar.
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(x, y - h * 0.58, h * 0.14, h * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = rim;
    ctx.lineWidth = h * 0.02;
    ctx.beginPath();
    ctx.ellipse(x, y - h * 0.58, h * 0.14, h * 0.42, 0, -Math.PI * 0.45, Math.PI * 0.15);
    ctx.stroke();
    return;
  }
  ctx.fillStyle = body;
  const blobs = variant === 0 ? [[0, 0.55, 0.26], [-0.14, 0.45, 0.18], [0.15, 0.47, 0.19], [0, 0.75, 0.18]] : [[0, 0.5, 0.3], [-0.12, 0.66, 0.2], [0.12, 0.68, 0.2]];
  for (const [dx, dy, r] of blobs) {
    ctx.beginPath();
    ctx.arc(x + dx! * h, y - dy! * h, r! * h, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = rim;
  ctx.lineWidth = h * 0.018;
  const top = blobs[blobs.length - 1]!;
  ctx.beginPath();
  ctx.arc(x + top[0]! * h, y - top[1]! * h, top[2]! * h, -Math.PI * 0.6, Math.PI * 0.05);
  ctx.stroke();
}

/** A grandstand section with its roof and crowd (sunlit from the left). */
function paintStand(ctx: Ctx2D, w: number, h: number): void {
  // Structure.
  ctx.fillStyle = "#2C2A33";
  ctx.beginPath();
  ctx.moveTo(0, h);
  ctx.lineTo(0, h * 0.42);
  ctx.lineTo(w, h * 0.22);
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();
  // Tiers with the crowd.
  const rows = 7;
  for (let r = 0; r < rows; r++) {
    const y0 = h * (0.92 - r * 0.085);
    const tilt = (r / rows) * h * 0.2;
    ctx.fillStyle = r % 2 ? "#3A3842" : "#34323C";
    ctx.fillRect(0, y0 - h * 0.07 - tilt * 0.2, w, h * 0.07);
    for (let i = 0; i < w / 5; i++) {
      const hx = i * 5 + hash(r * 999 + i) * 3;
      const hue = hash(r * 77 + i * 3);
      ctx.fillStyle = hue < 0.2 ? "#E8C8A0" : hue < 0.4 ? "#C83A3A" : hue < 0.55 ? "#F2F0EA" : hue < 0.7 ? "#3C5A9A" : hue < 0.85 ? "#E0A040" : "#6A5A50";
      ctx.fillRect(hx, y0 - h * 0.062 - tilt * 0.2, 2.6, 3.2);
    }
  }
  // Roof and its sunlit edge.
  ctx.fillStyle = "#1C1B22";
  ctx.beginPath();
  ctx.moveTo(-4, h * 0.36);
  ctx.lineTo(w + 4, h * 0.14);
  ctx.lineTo(w + 4, h * 0.08);
  ctx.lineTo(-4, h * 0.3);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(255,190,120,0.7)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-4, h * 0.3);
  ctx.lineTo(w + 4, h * 0.08);
  ctx.stroke();
  // Columns.
  ctx.fillStyle = "#1C1B22";
  for (let i = 0; i < 4; i++) ctx.fillRect((i + 0.5) * (w / 4) - 1.5, h * 0.3 - i * h * 0.05, 3, h);
}

/**
 * The car from behind: a graphite GT with a gold stripe, sunset reflections, an LED tail-light bar, a rain light,
 * the diffuser and exhaust tips; its body exactly `w` wide, its tyres' contact line at `bottom`.
 */
export function paintRacingCar(ctx: Ctx2D, cx: number, bottom: number, w: number, braking: boolean, ghost?: string): void {
  const h = w * 0.6;
  const x0 = cx - w / 2;
  const top = bottom - h;
  ctx.save();
  // Shadow.
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.beginPath();
  ctx.ellipse(cx, bottom, w * 0.54, h * 0.07, 0, 0, Math.PI * 2);
  ctx.fill();
  // Tyres.
  ctx.fillStyle = "#0E0E10";
  const tw = w * 0.16;
  ctx.fillRect(x0 + w * 0.04, bottom - h * 0.3, tw, h * 0.3);
  ctx.fillRect(x0 + w * 0.96 - tw, bottom - h * 0.3, tw, h * 0.3);
  // Body (graphite) with a sunset reflection.
  const body = ctx.createLinearGradient(0, top, 0, bottom);
  if (ghost) {
    body.addColorStop(0, ghost);
    body.addColorStop(1, "#202028");
  } else {
    body.addColorStop(0, "#7A6670");
    body.addColorStop(0.18, "#55505A");
    body.addColorStop(0.5, "#3A3A42");
    body.addColorStop(1, "#1E1E24");
  }
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(x0, bottom - h * 0.24);
  ctx.lineTo(x0 + w * 0.02, bottom - h * 0.56);
  ctx.quadraticCurveTo(x0 + w * 0.06, bottom - h * 0.66, x0 + w * 0.2, bottom - h * 0.7);
  ctx.lineTo(x0 + w * 0.28, top + h * 0.06);
  ctx.quadraticCurveTo(cx, top - h * 0.04, x0 + w * 0.72, top + h * 0.06);
  ctx.lineTo(x0 + w * 0.8, bottom - h * 0.7);
  ctx.quadraticCurveTo(x0 + w * 0.94, bottom - h * 0.66, x0 + w * 0.98, bottom - h * 0.56);
  ctx.lineTo(x0 + w, bottom - h * 0.24);
  ctx.lineTo(x0 + w * 0.96, bottom - h * 0.12);
  ctx.lineTo(x0 + w * 0.04, bottom - h * 0.12);
  ctx.closePath();
  ctx.fill();
  // Rear window with the sky in it.
  const glass = ctx.createLinearGradient(0, top + h * 0.08, 0, bottom - h * 0.66);
  glass.addColorStop(0, "#F2A060");
  glass.addColorStop(0.5, "#6A4A6A");
  glass.addColorStop(1, "#141418");
  ctx.fillStyle = glass;
  ctx.beginPath();
  ctx.moveTo(x0 + w * 0.31, top + h * 0.1);
  ctx.quadraticCurveTo(cx, top + h * 0.03, x0 + w * 0.69, top + h * 0.1);
  ctx.lineTo(x0 + w * 0.75, bottom - h * 0.68);
  ctx.lineTo(x0 + w * 0.25, bottom - h * 0.68);
  ctx.closePath();
  ctx.fill();
  // Gold stripe over the roof and down the tail.
  if (!ghost) {
    ctx.fillStyle = "#E3B341";
    ctx.fillRect(cx - w * 0.035, top + h * 0.02, w * 0.07, h * 0.08);
    ctx.fillRect(cx - w * 0.035, bottom - h * 0.66, w * 0.07, h * 0.22);
  }
  // Wing.
  ctx.fillStyle = "#18181C";
  ctx.fillRect(x0 + w * 0.06, bottom - h * 0.76, w * 0.88, h * 0.05);
  ctx.fillRect(x0 + w * 0.2, bottom - h * 0.72, w * 0.03, h * 0.06);
  ctx.fillRect(x0 + w * 0.77, bottom - h * 0.72, w * 0.03, h * 0.06);
  ctx.fillStyle = "rgba(255,180,110,0.5)";
  ctx.fillRect(x0 + w * 0.06, bottom - h * 0.76, w * 0.88, h * 0.012);
  // LED tail-light bar.
  ctx.fillStyle = braking ? "#FF3B3B" : "#B3202A";
  ctx.fillRect(x0 + w * 0.08, bottom - h * 0.44, w * 0.84, h * 0.035);
  ctx.fillRect(x0 + w * 0.06, bottom - h * 0.48, w * 0.14, h * 0.08);
  ctx.fillRect(x0 + w * 0.8, bottom - h * 0.48, w * 0.14, h * 0.08);
  // Diffuser with fins, exhaust tips.
  ctx.fillStyle = "#0B0B0E";
  ctx.fillRect(x0 + w * 0.2, bottom - h * 0.24, w * 0.6, h * 0.14);
  ctx.fillStyle = "#2A2A30";
  for (let i = 1; i < 6; i++) ctx.fillRect(x0 + w * 0.2 + i * w * 0.1 - 0.6, bottom - h * 0.24, 1.2, h * 0.14);
  ctx.fillStyle = "#6C6A70";
  ctx.beginPath();
  ctx.arc(x0 + w * 0.34, bottom - h * 0.2, w * 0.03, 0, Math.PI * 2);
  ctx.arc(x0 + w * 0.66, bottom - h * 0.2, w * 0.03, 0, Math.PI * 2);
  ctx.fill();
  // Rain light (centre, under the bar).
  ctx.fillStyle = braking ? "#FF5050" : "#5A1A1E";
  ctx.fillRect(cx - w * 0.025, bottom - h * 0.34, w * 0.05, h * 0.06);
  ctx.restore();
}

/* ================================ The track's look ================================ */

interface Look {
  track: RacingTrack;
  kerb: Uint8Array;
  /** Gravel side per segment: bit 1 = left, bit 2 = right. */
  gravel: Uint8Array;
  skid: Uint8Array;
  /** Racing line centre (world units) per segment. */
  line: Float32Array;
  /** Heading at each segment's start (radians). */
  heading: Float32Array;
  /** Roadside sprites per segment. */
  sprites: { kind: number; x: number; v: number }[][];
}
const SPR_TREE = 0;
const SPR_STAND = 1;
const SPR_BOARD = 2;
const SPR_FENCE = 3;
let look: Look | null = null;

function lookFor(track: RacingTrack): Look {
  if (look && look.track === track) return look;
  const n = RACING_LAP_SEGS;
  const kerb = new Uint8Array(n);
  const gravel = new Uint8Array(n);
  const skid = new Uint8Array(n);
  const line = new Float32Array(n);
  const heading = new Float32Array(n);
  const sprites: { kind: number; x: number; v: number }[][] = Array.from({ length: n }, () => []);
  const at = (i: number) => ((i % n) + n) % n;
  const standFrom = n - 70;
  const standTo = 36;
  const inStand = (i: number) => i >= standFrom || i < standTo;
  for (const c of track.corners) {
    const outside = c.dir > 0 ? 1 : 2;
    for (let k = -8; k < c.len + 8; k++) kerb[at(c.start + k)] = 1;
    for (let k = -10; k < c.len + 22; k++) {
      const g = at(c.start + k);
      gravel[g] = gravel[g]! | (c.kind === RACING_SEC_CHICANE ? 3 : outside);
    }
    const zone = c.kind === RACING_SEC_HAIRPIN ? 30 : 22;
    for (let k = -zone; k < 0; k++) skid[at(c.start + k)] = 1;
    // Braking boards on the outside: 150, 100, 50.
    const side = c.dir > 0 ? -1 : 1;
    [24, 16, 8].forEach((d, j) => sprites[at(c.start - d)]!.push({ kind: SPR_BOARD, x: side * (KERB_W + 260), v: j }));
    // The racing line: outside on the approach, the apex inside, out again on the exit.
    const out = -c.dir * RW * 0.5;
    for (let k = -30; k < c.len + 30; k++) {
      let v: number;
      if (k < 0) v = out * ((k + 30) / 30);
      else if (k < c.len / 2) v = out + (-2 * out) * (k / (c.len / 2));
      else if (k < c.len) v = -out;
      else v = -out * (1 - (k - c.len) / 30);
      line[at(c.start + k)] = v;
    }
  }
  let h = 0;
  for (let i = 0; i < n; i++) {
    heading[i] = h;
    h += track.curve[i]! * K_ANG;
  }
  for (let i = 0; i < n; i++) {
    if (inStand(i)) {
      if (i % 6 === 0) sprites[i]!.push({ kind: SPR_STAND, x: WALL_W + 700, v: 0 });
      sprites[i]!.push({ kind: SPR_FENCE, x: WALL_W, v: 0 });
      if (hash(i + track.seed) < 0.4) sprites[i]!.push({ kind: SPR_TREE, x: -(WALL_W + 600 + hash(i * 3 + track.seed) * 2400), v: Math.floor(hash(i * 7) * 3) });
      continue;
    }
    for (const side of [-1, 1]) {
      const r = hash(i * 2 + (side > 0 ? 1 : 0) + track.seed * 7);
      if (r < 0.42) sprites[i]!.push({ kind: SPR_TREE, x: side * (WALL_W + 500 + hash(i * 5 + side + track.seed) * 2800), v: Math.floor(hash(i * 11 + side) * 3) });
    }
  }
  look = { track, kerb, gravel, skid, line, heading, sprites };
  return look;
}

/* ================================ Drawing ================================ */

interface Proj {
  x: number;
  y: number;
  w: number;
  scale: number;
}

const COL = {
  grassA: "#5D6A2E",
  grassB: "#566428",
  gravelA: "#C4A275",
  gravelB: "#BC9A6C",
  runoff: "#5A5A60",
  roadA: "#4B4A52",
  roadB: "#47464E",
  lineDark: "rgba(28,26,30,0.38)",
  kerbR: "#C8312C",
  kerbW: "#EDE7DF",
  edge: "#E9E4DA",
  skid: "rgba(18,16,18,0.32)",
};

function quad(path: Path2D, x1: number, y1: number, w1: number, x2: number, y2: number, w2: number, a1: number, b1: number, a2: number, b2: number): void {
  // From a1..b1 (in units of w1 about x1) on the near edge to a2..b2 on the far edge.
  path.moveTo(x1 + a1 * w1, y1);
  path.lineTo(x1 + b1 * w1, y1);
  path.lineTo(x2 + b2 * w2, y2);
  path.lineTo(x2 + a2 * w2, y2);
  path.closePath();
}

function chip(ctx: Ctx2D, x: number, y: number, text: string, align: "left" | "center" | "right" = "left", accent = false): number {
  ctx.font = `700 12px ${MONO}`;
  const w = Math.ceil(ctx.measureText(text).width) + 18;
  const left = align === "left" ? x : align === "right" ? x - w : x - w / 2;
  ctx.fillStyle = "rgba(10,10,14,0.62)";
  ctx.beginPath();
  ctx.roundRect(left, y, w, 24, 12);
  ctx.fill();
  ctx.strokeStyle = accent ? "rgba(242,199,92,0.8)" : "rgba(255,255,255,0.14)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = accent ? "#F2C75C" : "#F3F1EC";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, left + w / 2, y + 12.5);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  return w;
}

function timeText(ticks: number): string {
  const t = Math.max(0, ticks) / 60;
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s < 10 ? "0" : ""}${s.toFixed(1)}`;
}

/** The scene (sky, hills, road, roadside, ghosts, car) for a state, without the HUD. */
function drawWorld(ctx: Ctx2D, state: RacingState, L: Layers): void {
  const W = RACING_WORLD_W;
  const track = racingTrack(state.seed);
  const lk = lookFor(track);
  const n = RACING_LAP_SEGS;
  const carZ = (state.s / RACING_SEG) * SL;
  const camZ = carZ - ZC;
  const base = Math.floor(camZ / SL);
  const frac = camZ / SL - base;
  const segOf = (k: number) => ((k % n) + n) % n;
  const carSeg = racingSegAt(state.s);
  const carFrac = (state.s % RACING_SEG) / RACING_SEG;
  const heading = lk.heading[carSeg]! + track.curve[carSeg]! * K_ANG * carFrac;

  // Sky, sun, hills.
  if (L.sky) ctx.drawImage(L.sky, 0, 0, W, HORIZON + 20);
  else paintRacingSky(ctx, W, RACING_WORLD_H);
  let rel = SUN_BEARING - heading;
  rel = Math.atan2(Math.sin(rel), Math.cos(rel));
  const sunX = W / 2 + Math.tan(Math.max(-1.3, Math.min(1.3, rel))) * F;
  const sunY = HORIZON - 34;
  const sunOn = Math.abs(rel) < 1.1;
  if (sunOn) paintSun(ctx, sunX, sunY);
  const hillShift = (layer: Surface | null, h: number, k: number, y: number) => {
    if (!layer) return;
    let off = (-heading * PX_PER_RAD * k) % HILL_W;
    if (off > 0) off -= HILL_W;
    for (let x = off; x < W; x += HILL_W) ctx.drawImage(layer, x, y - h, HILL_W, h);
  };
  hillShift(L.far, FAR_H, 0.5, HORIZON + 2);
  hillShift(L.near, NEAR_H, 0.8, HORIZON + 4);
  // The far fields in the haze, under the road's farthest segment.
  const haze = ctx.createLinearGradient(0, HORIZON + 4, 0, HORIZON + 40);
  haze.addColorStop(0, "#8C7A58");
  haze.addColorStop(1, COL.grassA);
  ctx.fillStyle = haze;
  ctx.fillRect(0, HORIZON + 3, W, RACING_WORLD_H - HORIZON - 3);

  // Segment edges: curve offsets and hills, zero offset at the car's depth.
  const edges = DRAW_SEGS + 1;
  const ex = new Float64Array(edges);
  const ey = new Float64Array(edges);
  const ez = new Float64Array(edges);
  let x = 0;
  let dx = -track.curve[segOf(base)]! * K_CURVE * frac;
  for (let i = 0; i < edges; i++) {
    const k = base + i;
    ez[i] = k * SL - camZ;
    ex[i] = x;
    const seg = segOf(k);
    ey[i] = track.hill[seg]! * HILL_K;
    x += dx;
    dx += track.curve[seg]! * K_CURVE;
  }
  // The car's depth falls in edge interval j.
  const j = Math.min(edges - 2, Math.max(0, Math.floor((ZC + frac * SL) / SL)));
  const t = (ZC - ez[j]!) / (ez[j + 1]! - ez[j]!);
  const carOffset = ex[j]! + (ex[j + 1]! - ex[j]!) * t;
  const carY = ey[j]! + (ey[j + 1]! - ey[j]!) * t;
  const camX = (state.x / RACING_ROAD_X) * RW;
  const camY = carY + CH;
  const proj: Proj[] = [];
  const NEAR = 60;
  for (let i = 0; i < edges; i++) {
    let px = ex[i]!;
    let py = ey[i]!;
    let z = ez[i]!;
    if (z < NEAR && i + 1 < edges) {
      // Behind the near plane: the point on this segment at the near plane (straight lines stay straight).
      const f = (NEAR - z) / (ez[i + 1]! - z);
      px += (ex[i + 1]! - px) * f;
      py += (ey[i + 1]! - py) * f;
      z = NEAR;
    }
    z = Math.max(NEAR, z);
    const scale = F / z;
    proj.push({ x: W / 2 + (px - carOffset - camX) * scale, y: HORIZON + (camY - py) * scale, w: RW * scale, scale });
  }

  // Road surfaces, front to back with the crest clip, one path per colour.
  const P = {
    grassA: new Path2D(), grassB: new Path2D(), gravelA: new Path2D(), gravelB: new Path2D(), runoff: new Path2D(),
    roadA: new Path2D(), roadB: new Path2D(), line: new Path2D(), kerbR: new Path2D(), kerbW: new Path2D(), edge: new Path2D(),
    skid: new Path2D(), start: new Path2D(), startW: new Path2D(),
  };
  const clipY = new Float64Array(edges).fill(RACING_WORLD_H);
  let maxY = RACING_WORLD_H;
  const visible = new Uint8Array(edges);
  const kw = KERB_W / RW;
  const ww = WALL_W / RW;
  for (let i = 0; i < DRAW_SEGS; i++) {
    const q1 = proj[i]!;
    const p2 = proj[i + 1]!;
    clipY[i] = maxY;
    if (ez[i + 1]! <= NEAR || p2.y >= maxY) continue;
    // The near edge clipped to the crest (or the screen's bottom), along the segment's own lines: exact in screen space.
    const cf = q1.y > maxY ? (maxY - p2.y) / (q1.y - p2.y) : 1;
    const p1 = cf < 1 ? { x: p2.x + (q1.x - p2.x) * cf, y: maxY, w: p2.w + (q1.w - p2.w) * cf, scale: q1.scale } : q1;
    visible[i] = 1;
    const k = base + i;
    const seg = segOf(k);
    const y1 = Math.min(p1.y, maxY);
    const alt = Math.floor(k / 3) % 2 === 0;
    (alt ? P.grassA : P.grassB).rect(0, p2.y, W, y1 - p2.y + 1);
    const gv = lk.gravel[seg]!;
    const gp = alt ? P.gravelA : P.gravelB;
    // Gravel traps over the grass (each surface path holds non-overlapping quads only: nonzero fills, no holes).
    if (gv & 1) quad(gp, p1.x, y1, p1.w, p2.x, p2.y, p2.w, -ww, -kw, -ww, -kw);
    if (gv & 2) quad(gp, p1.x, y1, p1.w, p2.x, p2.y, p2.w, kw, ww, kw, ww);
    const kerbHere = lk.kerb[seg]!;
    if (kerbHere) {
      const kp = Math.floor(k / 2) % 2 === 0 ? P.kerbR : P.kerbW;
      quad(kp, p1.x, y1, p1.w, p2.x, p2.y, p2.w, -kw, -1, -kw, -1);
      quad(kp, p1.x, y1, p1.w, p2.x, p2.y, p2.w, 1, kw, 1, kw);
    } else {
      quad(P.runoff, p1.x, y1, p1.w, p2.x, p2.y, p2.w, -kw, -1, -kw, -1);
      quad(P.runoff, p1.x, y1, p1.w, p2.x, p2.y, p2.w, 1, kw, 1, kw);
    }
    quad(alt ? P.roadA : P.roadB, p1.x, y1, p1.w, p2.x, p2.y, p2.w, -1, 1, -1, 1);
    // White track-limit lines on the straights.
    if (!kerbHere) {
      quad(P.edge, p1.x, y1, p1.w, p2.x, p2.y, p2.w, -1, -0.97, -1, -0.97);
      quad(P.edge, p1.x, y1, p1.w, p2.x, p2.y, p2.w, 0.97, 1, 0.97, 1);
    }
    // The darker racing line.
    const l1 = lk.line[seg]! / RW;
    const l2 = lk.line[segOf(k + 1)]! / RW;
    quad(P.line, p1.x, y1, p1.w, p2.x, p2.y, p2.w, l1 - 0.28, l1 + 0.28, l2 - 0.28, l2 + 0.28);
    if (lk.skid[seg] && (k * 7) % 5 !== 0) {
      for (const o of [-0.42, -0.3, 0.3, 0.42]) quad(P.skid, p1.x, y1, p1.w, p2.x, p2.y, p2.w, l1 + o - 0.035, l1 + o + 0.035, l2 + o - 0.035, l2 + o + 0.035);
    }
    if (seg === 0) {
      // The start / finish line: a chequered band.
      for (let c = 0; c < 16; c++) {
        const a = -1 + c / 8;
        quad(c % 2 ? P.start : P.startW, p1.x, y1, p1.w, p2.x, p2.y, p2.w, a, a + 1 / 8, a, a + 1 / 8);
      }
    }
    maxY = p2.y;
  }
  const fill = (p: Path2D, c: string) => {
    ctx.fillStyle = c;
    ctx.fill(p);
  };
  fill(P.grassA, COL.grassA);
  fill(P.grassB, COL.grassB);
  fill(P.gravelA, COL.gravelA);
  fill(P.gravelB, COL.gravelB);
  fill(P.runoff, COL.runoff);
  fill(P.roadA, COL.roadA);
  fill(P.roadB, COL.roadB);
  fill(P.line, COL.lineDark);
  fill(P.skid, COL.skid);
  fill(P.kerbR, COL.kerbR);
  fill(P.kerbW, COL.kerbW);
  fill(P.edge, COL.edge);
  fill(P.start, "#18181C");
  fill(P.startW, "#F1EEE8");

  // Roadside, back to front: per segment its sprites, then its tyre walls (the trees stand behind them).
  const ghostAt = new Map<number, RacingGhostView[]>();
  for (const g of ghosts) {
    const z = ((g.s - state.s) / RACING_SEG) * SL + ZC;
    if (z < ZC * 0.55 || z > (DRAW_SEGS - 2) * SL) continue;
    const i = Math.floor((z + frac * SL) / SL);
    const list = ghostAt.get(i) ?? [];
    list.push(g);
    ghostAt.set(i, list);
  }
  for (let i = DRAW_SEGS - 1; i >= 0; i--) {
    if (!visible[i]) continue;
    const p1 = proj[i]!;
    const p2 = proj[i + 1]!;
    const seg = segOf(base + i);
    const clip = clipY[i]!;
    for (const sp of lk.sprites[seg]!) {
      const sx = p2.x + (sp.x / RW) * p2.w;
      const sc = p2.scale;
      if (sp.kind === SPR_TREE) {
        const img = L.trees[sp.v % Math.max(1, L.trees.length)];
        const h = (1100 + 500 * ((sp.v + seg) % 3)) * sc;
        const w = h * (TREE_W / TREE_H);
        if (sx + w / 2 < 0 || sx - w / 2 > W) continue;
        drawClipped(ctx, img ?? null, sx - w / 2, p2.y - h, w, h, clip);
      } else if (sp.kind === SPR_STAND) {
        const w = 2600 * sc;
        const h = 1300 * sc;
        if (sx > W || sx + w < 0) continue;
        drawClipped(ctx, L.stand, sx - w * 0.1, p2.y - h, w, h, clip);
      } else if (sp.kind === SPR_BOARD) {
        const w = 220 * sc;
        const h = 300 * sc;
        if (p2.y - h > clip) continue;
        ctx.fillStyle = "#1C1C22";
        ctx.fillRect(sx - w * 0.06, p2.y - h * 0.5, w * 0.12, h * 0.5);
        ctx.fillStyle = "#F2F0EA";
        ctx.fillRect(sx - w / 2, p2.y - h, w, h * 0.55);
        if (w > 9) {
          ctx.fillStyle = "#1A1A20";
          ctx.font = `800 ${Math.max(5, w * 0.36)}px ${ARCADE_FX_DISPLAY_FONT}`;
          ctx.textAlign = "center";
          ctx.fillText(["150", "100", "50"][sp.v]!, sx, p2.y - h * 0.58);
          ctx.textAlign = "left";
        }
      }
    }
    // Tyre walls: a band of stacked tyres with red and white belts, both sides.
    if (p2.y < clip) {
      const belt = (base + i) % 4;
      for (const side of [-1, 1]) {
        const xa = p1.x + side * ww * p1.w;
        const xb = p2.x + side * ww * p2.w;
        const ha = WALL_H * p1.scale;
        const hb = WALL_H * p2.scale;
        const ya = Math.min(p1.y, clip);
        ctx.fillStyle = belt % 2 === 0 ? "#1B1B1F" : "#242428";
        ctx.beginPath();
        ctx.moveTo(xa, ya);
        ctx.lineTo(xb, p2.y);
        ctx.lineTo(xb, p2.y - hb);
        ctx.lineTo(xa, ya - ha);
        ctx.closePath();
        ctx.fill();
        // The belt strapping the top row: red and white.
        ctx.fillStyle = belt < 2 ? "#B8322C" : "#E6E0D6";
        ctx.beginPath();
        ctx.moveTo(xa, ya - ha * 0.78);
        ctx.lineTo(xb, p2.y - hb * 0.78);
        ctx.lineTo(xb, p2.y - hb * 0.62);
        ctx.lineTo(xa, ya - ha * 0.62);
        ctx.closePath();
        ctx.fill();
      }
      // Catch fence over the wall by the grandstand.
      if (lk.sprites[seg]!.some((s) => s.kind === SPR_FENCE)) {
        const xa = p1.x + ww * p1.w;
        const xb = p2.x + ww * p2.w;
        ctx.strokeStyle = "rgba(200,200,210,0.35)";
        ctx.lineWidth = Math.max(0.5, 6 * p2.scale);
        ctx.beginPath();
        ctx.moveTo(xb, p2.y - WALL_H * p2.scale);
        ctx.lineTo(xb, p2.y - 700 * p2.scale);
        ctx.lineTo(xa, Math.min(p1.y, clip) - 700 * p1.scale);
        ctx.stroke();
        ctx.fillStyle = "rgba(190,190,200,0.12)";
        ctx.beginPath();
        ctx.moveTo(xb, p2.y - WALL_H * p2.scale);
        ctx.lineTo(xb, p2.y - 700 * p2.scale);
        ctx.lineTo(xa, Math.min(p1.y, clip) - 700 * p1.scale);
        ctx.lineTo(xa, Math.min(p1.y, clip) - WALL_H * p1.scale);
        ctx.closePath();
        ctx.fill();
      }
    }
    // Ghost cars in this segment.
    for (const g of ghostAt.get(i) ?? []) {
      const z = ((g.s - state.s) / RACING_SEG) * SL + ZC;
      const tt = Math.max(0, Math.min(1, (z - ez[i]!) / SL));
      const sc = F / z;
      const gx = W / 2 + (ex[i]! + (ex[i + 1]! - ex[i]!) * tt - carOffset - camX + (g.x / RACING_ROAD_X) * RW) * sc;
      const gy = HORIZON + (camY - (ey[i]! + (ey[i + 1]! - ey[i]!) * tt)) * sc;
      if (gy > clip + 2) continue;
      const gw = CAR_HALF_W * 2 * sc;
      ctx.save();
      ctx.globalAlpha = 0.42;
      paintRacingCar(ctx, gx, gy, gw, false, g.colour);
      ctx.restore();
      if (gw > 14) {
        ctx.font = `700 ${Math.max(8, Math.min(12, gw * 0.18))}px ${ARCADE_FX_DISPLAY_FONT}`;
        const label = g.name.slice(0, 12);
        const tw = ctx.measureText(label).width + 12;
        const ty = gy - gw * 0.72 - 14;
        ctx.fillStyle = "rgba(10,10,14,0.6)";
        ctx.beginPath();
        ctx.roundRect(gx - tw / 2, ty, tw, 15, 7.5);
        ctx.fill();
        ctx.fillStyle = g.colour;
        ctx.fillRect(gx - tw / 2 + 4, ty + 5, 4, 5);
        ctx.fillStyle = "#F3F1EC";
        ctx.textAlign = "center";
        ctx.fillText(label, gx + 3, ty + 11);
        ctx.textAlign = "left";
      }
    }
  }

  // The player's car: a little bounce at speed, tilted as it steers, brake lights on the brake.
  const speedShare = state.v / 3072;
  const bounce = state.off ? Math.sin(state.tick * 1.7) * 1.6 : Math.sin(state.tick * 0.9) * 0.4 * speedShare;
  const carW = RACING_CAR_HALF_PX * 2;
  const braking = state.pedal < 0;
  const sprite = braking ? L.carBrake : L.car;
  // Heat haze over the exhaust at speed.
  if (speedShare > 0.35) {
    ctx.save();
    ctx.globalAlpha = 0.07 + 0.08 * speedShare;
    ctx.strokeStyle = "#FFE6C0";
    ctx.lineWidth = 1.2;
    for (let k = 0; k < 3; k++) {
      const hx = W / 2 + (k - 1) * carW * 0.18;
      ctx.beginPath();
      for (let yy = 0; yy < 18; yy += 2) {
        const px = hx + Math.sin((state.tick + yy * 3 + k * 20) * 0.35) * 2;
        const py = RACING_CAR_Y - carW * 0.12 + 8 - yy;
        if (yy === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.save();
  ctx.translate(W / 2, RACING_CAR_Y + bounce);
  ctx.rotate((state.steer / RACING_STICK_MAX) * 0.025 * speedShare);
  if (sprite) {
    // The sprite's body spans CAR_SPRITE_W exactly, its contact line 2 px above its bottom.
    const s = carW / CAR_SPRITE_W;
    ctx.drawImage(sprite, -CAR_SPRITE_W * s / 2, -(CAR_SPRITE_H - 2) * s, CAR_SPRITE_W * s, CAR_SPRITE_H * s);
  } else paintRacingCar(ctx, 0, 0, carW, braking);
  ctx.restore();
  // Brake-light bloom (drawn here, not in the sprite, so it has no edge).
  if (braking) {
    const by = RACING_CAR_Y + bounce - carW * 0.6 * 0.44;
    const glow = ctx.createRadialGradient(W / 2, by, 0, W / 2, by, carW * 0.62);
    glow.addColorStop(0, "rgba(255,70,60,0.32)");
    glow.addColorStop(1, "rgba(255,70,60,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(W / 2 - carW * 0.62, by - carW * 0.62, carW * 1.24, carW * 1.24);
  }
  // Rain light blinking on the grass.
  if (state.off && Math.floor(state.tick / 8) % 2 === 0) {
    ctx.fillStyle = "rgba(255,80,80,0.9)";
    const h = carW * 0.6;
    ctx.fillRect(W / 2 - carW * 0.025, RACING_CAR_Y - h * 0.34 + bounce, carW * 0.05, h * 0.06);
  }

  // A light lens flare when facing the sun.
  if (sunOn) {
    const k = 1 - Math.abs(rel) / 1.1;
    const cx = W / 2;
    const cy = RACING_WORLD_H * 0.45;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const dots: [number, number, string][] = [[0.35, 9, "rgba(255,200,140,0.08)"], [0.7, 14, "rgba(255,150,120,0.05)"], [1.25, 6, "rgba(200,220,255,0.07)"], [1.6, 20, "rgba(255,190,130,0.035)"]];
    for (const [f, r, c] of dots) {
      ctx.globalAlpha = k;
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(sunX + (cx - sunX) * f, sunY + (cy - sunY) * f, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawClipped(ctx: Ctx2D, img: Surface | null, x: number, y: number, w: number, h: number, clip: number): void {
  if (!img || w < 0.5 || y >= clip) return;
  if (y + h <= clip) {
    ctx.drawImage(img, x, y, w, h);
    return;
  }
  const share = (clip - y) / h;
  ctx.drawImage(img, 0, 0, img.width, img.height * share, x, y, w, h * share);
}

/** The HUD: lap and time chips at the top, speed (left), the clean-sector bars (right) and the joystick. */
function drawHud(ctx: Ctx2D, state: RacingState): void {
  const W = RACING_WORLD_W;
  const lapW = chip(ctx, 12, 10, `LAP ${racingLap(state)}/${RACING_LAPS}`, "left", racingLap(state) === RACING_LAPS && state.tick > 0);
  void lapW;
  const done = state.finishTick > 0;
  chip(ctx, W - 12, 10, done ? timeText(state.finishTick) : timeText(Math.min(state.tick, RACING_RUN_TICKS)), "right", done);

  // Speed, bottom left.
  const y = RACING_STICK_Y;
  ctx.fillStyle = "rgba(10,10,14,0.5)";
  ctx.beginPath();
  ctx.roundRect(12, y - 30, 92, 54, 12);
  ctx.fill();
  ctx.fillStyle = "#F3F1EC";
  ctx.font = `700 28px ${MONO}`;
  ctx.textAlign = "right";
  ctx.fillText(String(racingKmh(state.v)), 84, y + 4);
  ctx.font = `700 10px ${MONO}`;
  ctx.fillStyle = "rgba(243,241,236,0.7)";
  ctx.fillText("KM/H", 92, y + 18);
  ctx.textAlign = "left";

  // Clean-sector bars, bottom right: gold when clean, dim red when touched, outline ahead.
  const bx = W - 104;
  ctx.fillStyle = "rgba(10,10,14,0.5)";
  ctx.beginPath();
  ctx.roundRect(bx, y - 30, 92, 54, 12);
  ctx.fill();
  for (let k = 0; k < RACING_SECTORS; k++) {
    const x = bx + 10 + k * 9.5;
    const top = y - 18;
    const h = 30;
    const clean = (state.cleanMask >> k) & 1;
    if (k < state.sector) ctx.fillStyle = clean ? "#F2C75C" : "rgba(220,80,70,0.55)";
    else if (k === state.sector) ctx.fillStyle = state.dirty ? "rgba(220,80,70,0.55)" : "rgba(243,241,236,0.55)";
    else ctx.fillStyle = "rgba(243,241,236,0.16)";
    ctx.fillRect(x, top, 6, h);
    if (k === RACING_SECTORS / 2 - 1) {
      ctx.fillStyle = "rgba(243,241,236,0.3)";
      ctx.fillRect(x + 7.5, top - 2, 1, h + 4);
    }
  }

  // The joystick: the base where the thumb went down (or its resting place), the knob from the held input.
  const o = stickOrigin ?? { x: RACING_STICK_X, y: RACING_STICK_Y };
  ctx.save();
  ctx.globalAlpha = stickOrigin ? 1 : 0.7;
  const base = ctx.createRadialGradient(o.x, o.y, 4, o.x, o.y, RACING_STICK_R + 8);
  base.addColorStop(0, "rgba(20,20,26,0.35)");
  base.addColorStop(1, "rgba(20,20,26,0.6)");
  ctx.fillStyle = base;
  ctx.beginPath();
  ctx.arc(o.x, o.y, RACING_STICK_R + 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(243,241,236,0.25)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.strokeStyle = "rgba(243,241,236,0.18)";
  ctx.beginPath();
  ctx.moveTo(o.x - RACING_STICK_R, o.y);
  ctx.lineTo(o.x + RACING_STICK_R, o.y);
  ctx.moveTo(o.x, o.y - RACING_STICK_R);
  ctx.lineTo(o.x, o.y + RACING_STICK_R);
  ctx.stroke();
  const kx = o.x + (state.steer / RACING_STICK_MAX) * RACING_STICK_R;
  const ky = o.y - (state.pedal / RACING_STICK_MAX) * RACING_STICK_R;
  const knob = ctx.createRadialGradient(kx - 5, ky - 6, 2, kx, ky, 20);
  knob.addColorStop(0, "#F7E3A6");
  knob.addColorStop(0.55, "#D9A93A");
  knob.addColorStop(1, "#8A6516");
  ctx.fillStyle = knob;
  ctx.beginPath();
  ctx.arc(kx, ky, 19, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawRacingArt(ctx: CanvasRenderingContext2D, state: RacingState, size: CanvasSize): void {
  const W = RACING_WORLD_W;
  const H = RACING_WORLD_H;
  ctx.save();
  if (size.width !== W || size.height !== H) ctx.scale(size.width / W, size.height / H);
  const t = typeof ctx.getTransform === "function" ? ctx.getTransform() : null;
  const L = layersFor(t ? Math.hypot(t.a, t.b) : 1);
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.clip();
  drawWorld(ctx, state, L);
  drawHud(ctx, state);
  ctx.restore();
}

export const racingArtGame: ArcadeGame<RacingState, ArcadeInputEvent | null> = { ...racingGame, draw: drawRacingArt };

/** The play screen's scenery beyond the world: the sky above, grass at the sides, dark tarmac below. */
export function racingScene(ctx: CanvasRenderingContext2D, view: ArenaSceneView): void {
  if (view.top < 0) {
    ctx.fillStyle = "#2C2F5E";
    ctx.fillRect(view.left, view.top, view.right - view.left, -view.top + 2);
  }
  if (view.left < 0 || view.right > view.worldW) {
    const g = ctx.createLinearGradient(0, 0, 0, view.worldH);
    g.addColorStop(0, "#2C2F5E");
    g.addColorStop(HORIZON / view.worldH, "#FFD38A");
    g.addColorStop(HORIZON / view.worldH + 0.02, "#4E5C28");
    g.addColorStop(1, "#3E4A20");
    ctx.fillStyle = g;
    if (view.left < 0) ctx.fillRect(view.left, 0, -view.left + 2, view.worldH);
    if (view.right > view.worldW) ctx.fillRect(view.worldW - 2, 0, view.right - view.worldW + 2, view.worldH);
  }
  if (view.bottom > view.worldH) {
    ctx.fillStyle = "#2E2D33";
    ctx.fillRect(view.left, view.worldH - 2, view.right - view.left, view.bottom - view.worldH + 2);
  }
}

/** The chase view on a seeded circuit at the race start (backdrop for the tile and intro still). */
export function paintRacingBackdrop(ctx: CanvasRenderingContext2D, w: number, h: number, seed = 7): void {
  ctx.save();
  ctx.scale(w / RACING_WORLD_W, h / RACING_WORLD_H);
  const state = { ...racingGame.init(seed), s: RACING_SEG * 10, v: 2400, tick: 300 };
  const L: Layers = { scale: 1, sky: null, far: null, near: null, car: null, carBrake: null, trees: [], stand: null };
  drawWorld(ctx, state, L);
  ctx.restore();
}

/** Tile icon: a square crop of the chase view (sunset, road, the car), at any size. */
export function paintRacingTile(ctx: CanvasRenderingContext2D, size: number): void {
  ctx.save();
  // Crop the world round the car: a 360 world px square from the sunset down to the car.
  const crop = 360;
  const s = size / crop;
  ctx.scale(s, s);
  ctx.translate(-(RACING_WORLD_W - crop) / 2, -(RACING_CAR_Y + 16 - crop));
  const state = { ...racingGame.init(11), s: RACING_SEG * 40, v: 2600, tick: 300 };
  const L = layersFor(Math.max(1, s * 2));
  drawWorld(ctx, state, L);
  ctx.restore();
}
