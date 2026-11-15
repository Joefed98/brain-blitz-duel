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
 * the tick the sim puts a wheel on the grass, and meets the tyre wall's face where the sim stops it. Since 31 Oct 2026
 * (Apex) the car shows its steering: as it yaws into a turn its flank comes into view on the outside (with the front
 * wheel at the far end, turned with the steer) and the rear face narrows by the same share, so the whole keeps exactly
 * the collision width.
 *
 * racingRev 2 adds the start: the car on its grid box at the line, a gantry of five red lights over the road coming on
 * one a second with a large 5-4-3-2-1, then all out and GO (display of racingLightsOn, the sim's own schedule).
 */
import { arcadeReducedEffects } from "@/lib/fx/lowEnd";
import { arcadeFx, ARCADE_FX_DISPLAY_FONT } from "./arcadeFx.renderer";
import { RACING_FX } from "./sportsFx.renderer";
import { drawRacingCarSprite } from "./racingCar.renderer";
import {
  SCENE_GROUND,
  SCENE_HAZE,
  RACING_SCENE_HARBOUR,
  RACING_SCENE_PARK,
  RACING_SCENE_RIDGE,
  paintHarbourFar,
  paintHarbourNear,
  paintHarbourProp,
  paintHarbourWater,
  paintRidgeFar,
  paintRidgeNear,
  paintRidgeProp,
  racingSceneOf,
} from "./racingScenery.renderer";
import {
  drawCornerFlash,
  drawFinish,
  drawParticles,
  drawSpeedLines,
  observeRacingFx,
  racingCornerEntry,
  racingDust,
  racingGrassDrop,
  racingKerbShake,
  racingSectorFlash,
  racingSparks,
} from "./racingFx.renderer";
import { lookKey, NO_LOOK, type GameLook } from "./skins/look";
import { skinReducedMotion, skinTime } from "./skins/motion.renderer";
import {
  carGoldSparkles,
  carPaintBody,
  carPaintMarks,
  NEON_NIGHT_BELTS,
  NEON_NIGHT_COL,
  NEON_NIGHT_HAZE,
  NEON_NIGHT_NEAR,
  NEON_NIGHT_TREE,
  neonNightChase,
  neonNightLayerKey,
  paintNeonNear,
  paintNeonTower,
  paintNeonCity,
  paintNeonNightSky,
  paintNeonNightStars,
  paintNeonStand,
  racingCarPaint,
} from "./skins/racing.skins";
import type { ArenaAmbient, ArenaSceneView } from "./arenaScene.renderer";
import type { ArcadeGame, ArcadeInputEvent, CanvasSize } from "./engine";
import {
  racingGame,
  racingGameFor,
  racingGoTick,
  racingKmh,
  racingLap,
  racingCornerAdvice,
  racingLightsOn,
  racingRaceTicks,
  racingSegAt,
  racingTrackOf,
  RACING_CAR_HALF,
  RACING_KERB_X,
  RACING_LAP_SEGS,
  RACING_LAPS,
  RACING_REV_2,
  RACING_REV_3,
  RACING_REV_4,
  RACING_CIRCUITS,
  racingCircuitOf,
  RACING_ROAD_X,
  RACING_RUN_TICKS,
  RACING_SEC_CHICANE,
  RACING_SEC_HAIRPIN,
  RACING_SECTORS,
  RACING_SEG,
  RACING_SIGN_SEGS,
  RACING_STICK_MAX,
  RACING_V2_GO,
  RACING_V2_LIGHT0,
  RACING_V2_LIGHT_GAP,
  RACING_V2_LIGHTS,
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
/**
 * 3 Nov 2026 (display only; Joe's audit): the horizon raised from row 270 to 185 and the camera lifted to match
 * (CH 1714 → 2200), so the car's contact line stays where it was (row 570) and the sky takes a quarter of the world
 * instead of about 40 %: more road shows ahead, and corners are seen earlier. The sim, the stick and its mapping are
 * unchanged.
 */
/**
 * 15 Nov 2026 (the Sports overhaul, display only): the chase camera moved closer and lower (ZC 1714 → 1270, CH 2200 →
 * 1600), so the car is drawn 1.35 times as large and its contact line sits a little higher (row 563, was 570). The sim,
 * the stick and its mapping are unchanged.
 */
const CH = 1600;
const ZC = 1270;
/** The sun's lens flare (off: the overhaul's look has no glare). */
const LENS_FLARE = false;
const HORIZON = 185;
/** Where the haze under the road reaches the near grass colour (COL.grassA), which it keeps below. */
const HAZE_END = HORIZON + 40;
/** Rows past HAZE_END where the gradient may still round a channel off grassA: grassA bands there are painted. */
const HAZE_MARGIN = 8;
/** Harbour Run's water band under the horizon (stage 2; ends well above HAZE_END, so the grass saving is unchanged). */
const WATER_H = 18;
/** Checks only (racing-render-check): false paints every grassA band as before, to prove the skip changes no pixel. */
let grassSkip = true;
export function setRacingGrassSkip(on: boolean): void {
  grassSkip = on;
}
/** The car's contact line on screen (HORIZON + CH × F ÷ ZC). */
export const RACING_CAR_Y = HORIZON + (CH * F) / ZC;
const DRAW_SEGS = 150;
const K_CURVE = 1.4;
/** Hills on screen, scaled with the camera height (0.5 at CH 2200; the overhaul's lower camera, 15 Nov 2026). */
const HILL_K = 0.36;
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

/** The car's turn on screen at full yaw (radians, about 5°): one shape angled into the turn (display). */
export const RACING_CAR_TURN_MAX = 0.087;
/**
 * The scale that keeps the car turned by `ang` exactly as wide as the collision width: its body box (the width × 0.6 of
 * it high) turned about its centre spans w·cos + h·sin across, so it is drawn smaller by that much (about 5 % at full yaw).
 */
export function racingCarTurnFit(ang: number): number {
  const a = Math.abs(ang);
  return 1 / (Math.cos(a) + 0.6 * Math.sin(a));
}

/* ================================ Joystick (display) ================================ */

/** The joystick's resting centre and its throw (world px); the Stage maps the thumb with the same numbers. */
export const RACING_STICK_X = RACING_WORLD_W / 2;
export const RACING_STICK_Y = RACING_WORLD_H - 68;
export const RACING_STICK_R = 46;
/**
 * racingRev 2 (Apex): more thumb travel for full lock (64 world px across, the throttle and brake keep 46 up and down);
 * the sim adds the dead zone, the expo and the smoothing (racingV2SteerTarget).
 */
export const RACING_V2_STEER_R = 64;
/** The steering throw for a revision (world px for full lock). */
export function racingSteerThrow(rev: number | null | undefined): number {
  return (rev ?? 1) >= RACING_REV_2 ? RACING_V2_STEER_R : RACING_STICK_R;
}
/** The thumb's touch area starts here (world y). */
export const RACING_STICK_TOP = RACING_WORLD_H - 250;
/** The knob's radius (world px; 19 before 3 Nov 2026). */
export const RACING_KNOB_R = 12;
/**
 * Where the joystick's ring may be drawn (3 Nov 2026, display only): its centre at least this low, so the ring and the
 * knob pushed to full throttle stay 4 px clear of the car's contact line (RACING_CAR_Y), and at most this high above the
 * world's bottom (the world ends above the home bar's strip), so the whole ring stays on the world.
 */
export const RACING_STICK_DRAW_MIN_Y = RACING_CAR_Y + 4 + RACING_STICK_R + RACING_KNOB_R;
export const RACING_STICK_DRAW_MAX_Y = RACING_WORLD_H - RACING_STICK_R - 6;
/** The joystick's drawn centre for the thumb's origin: its x as the thumb, its y held between the limits above. */
export function racingStickDrawAt(o: { x: number; y: number }): { x: number; y: number } {
  return { x: o.x, y: Math.max(RACING_STICK_DRAW_MIN_Y, Math.min(RACING_STICK_DRAW_MAX_Y, o.y)) };
}

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
  /** The ghost's own car paint (its owner's equipped `game-skin.apex.*`; wave 2 skins), or none. */
  skin?: string | null;
}
let ghosts: readonly RacingGhostView[] = [];
/** Display only: the other players' cars to draw this frame. */
export function setRacingGhosts(list: readonly RacingGhostView[] | null | undefined): void {
  ghosts = list ?? [];
}

/** At most this many ghost cars are drawn (31 Oct 2026, rooms of 16): the nearest to your own car. */
export const RACING_GHOSTS_SHOWN = 3;

/**
 * The ghosts to draw for a car at race distance `s`: the RACING_GHOSTS_SHOWN nearest along the track
 * (ahead or behind; ties by lateral distance from `x`, then name). Display only: never reaches the sim.
 */
export function nearestRacingGhosts<T extends RacingGhostView>(list: readonly T[], s: number, x = 0): T[] {
  return [...list]
    .sort((a, b) => Math.abs(a.s - s) - Math.abs(b.s - s) || Math.abs(a.x - x) - Math.abs(b.x - x) || a.name.localeCompare(b.name))
    .slice(0, RACING_GHOSTS_SHOWN);
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
  if (SK.world) {
    paintNeonNightSky(ctx, w, h, horizon);
    return;
  }
  const g = ctx.createLinearGradient(0, 0, 0, horizon + 20);
  // Dusk (the Sports overhaul, 15 Nov 2026): deep violet overhead through rose to a gold horizon.
  g.addColorStop(0, "#241C40");
  g.addColorStop(0.3, "#4E3260");
  g.addColorStop(0.58, "#A4566C");
  g.addColorStop(0.8, "#E28456");
  g.addColorStop(0.93, "#F9B36E");
  g.addColorStop(1, "#FFD89A");
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
  // Rays: soft wedges (off since the Sports overhaul: no glare).
  ctx.save();
  ctx.globalAlpha = SUN_RAYS ? 0.12 : 0;
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
  const disc = ctx.createRadialGradient(x, y - r * 0.2, 0, x, y, r);
  disc.addColorStop(0, "#FFFBEA");
  disc.addColorStop(0.7, "#FFF0C8");
  disc.addColorStop(1, "#FFD99A");
  ctx.fillStyle = disc;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}
/** The sun's rays (off: the overhaul's sun is a soft disc and halo, no glare). */
const SUN_RAYS = false;

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
/**
 * Cached sprite layers by scale. The world and the view beyond it (racingAmbient) draw at different scales on the same
 * frame, so a single cached scale would rebuild every layer twice a frame; a few scales are kept.
 */
const layerCache = new Map<number | string, Layers>();
const HILL_W = Math.round(Math.PI * 2 * PX_PER_RAD);
const FAR_H = 70;
const NEAR_H = 58;
const CAR_SPRITE_W = 120;
const CAR_SPRITE_H = 76;
const TREE_W = 60;
const TREE_H = 120;
const STAND_W = 240;
const STAND_H = 120;

function layersFor(scale: number, scene: number = RACING_SCENE_PARK): Layers {
  const s = Math.max(1, Math.min(3, Math.round(scale * 2) / 2));
  const key = lookKey(SK) + (SK.world ? neonNightLayerKey() : "");
  // The circuit's own scenery (stage 2): the Neon Night keeps its one look on every circuit.
  const sc = SK.world ? RACING_SCENE_PARK : scene;
  const cacheKey = key || sc ? `${s}|${key}|${sc}` : s;
  const hit = layerCache.get(cacheKey);
  if (hit) return hit;
  const surf = (w: number, h: number, paint: (c: Ctx2D) => void): Surface | null => {
    const out = makeSurface(w * s, h * s);
    const c = out ? ctxOf(out) : null;
    if (!out || !c) return null;
    c.scale(s, s);
    paint(c);
    return out;
  };
  const layers: Layers = {
    scale: s,
    sky: surf(RACING_WORLD_W, HORIZON + 20, (c) => paintRacingSky(c, RACING_WORLD_W, RACING_WORLD_H)),
    far: surf(HILL_W, FAR_H, (c) =>
      SK.world
        ? paintNeonCity(c, HILL_W, FAR_H)
        : sc === RACING_SCENE_HARBOUR
          ? paintHarbourFar(c, HILL_W, FAR_H)
          : sc === RACING_SCENE_RIDGE
            ? paintRidgeFar(c, HILL_W, FAR_H)
            : paintHillStrip(c, HILL_W, FAR_H, 3, "#A56A80", "#7E5774", "rgba(255,200,160,0.7)", 52, false),
    ),
    near: surf(HILL_W, NEAR_H, (c) =>
      SK.world
        ? paintNeonNear(c, HILL_W, NEAR_H) || paintHillStrip(c, HILL_W, NEAR_H, 11, NEON_NIGHT_NEAR.top, NEON_NIGHT_NEAR.bottom, NEON_NIGHT_NEAR.rim, 40, false)
        : sc === RACING_SCENE_HARBOUR
          ? paintHarbourNear(c, HILL_W, NEAR_H)
          : sc === RACING_SCENE_RIDGE
            ? paintRidgeNear(c, HILL_W, NEAR_H)
            : paintHillStrip(c, HILL_W, NEAR_H, 11, "#3A2A3A", "#1C171D", "rgba(255,160,95,0.75)", 40, true),
    ),
    car: surf(CAR_SPRITE_W, CAR_SPRITE_H, (c) => paintRacingCar(c, CAR_SPRITE_W / 2, CAR_SPRITE_H - 2, CAR_SPRITE_W, false)),
    carBrake: surf(CAR_SPRITE_W, CAR_SPRITE_H, (c) => paintRacingCar(c, CAR_SPRITE_W / 2, CAR_SPRITE_H - 2, CAR_SPRITE_W, true)),
    trees: [0, 1, 2]
      .map((v) =>
        surf(TREE_W, TREE_H, (c) =>
          !SK.world && sc === RACING_SCENE_HARBOUR
            ? paintHarbourProp(c, TREE_W / 2, TREE_H, TREE_H, v)
            : !SK.world && sc === RACING_SCENE_RIDGE
              ? paintRidgeProp(c, TREE_W / 2, TREE_H, TREE_H, v)
              : paintTree(c, TREE_W / 2, TREE_H, TREE_H, v),
        ),
      )
      .filter((x): x is Surface => x !== null),
    stand: surf(STAND_W, STAND_H, (c) => (SK.world ? paintNeonStand(c, STAND_W, STAND_H) : paintStand(c, STAND_W, STAND_H))),
  };
  if (layerCache.size >= 4) layerCache.delete(layerCache.keys().next().value!);
  layerCache.set(cacheKey, layers);
  return layers;
}

/* ================================ Painters ================================ */

/** A roadside tree (silhouette with a warm rim from the low sun), its trunk's foot at (x, y). */
function paintTree(ctx: Ctx2D, x: number, y: number, h: number, variant: number): void {
  if (SK.world && paintNeonTower(ctx as CanvasRenderingContext2D, x, y, h, variant)) return;
  ctx.fillStyle = SK.world ? NEON_NIGHT_TREE.trunk : "#2B1E18";
  ctx.fillRect(x - h * 0.025, y - h * 0.3, h * 0.05, h * 0.3);
  const body = SK.world ? NEON_NIGHT_TREE.body : variant === 0 ? "#18221A" : variant === 1 ? "#1C261C" : "#141D17";
  const rim = SK.world ? NEON_NIGHT_TREE.rim : "rgba(255,165,85,0.8)";
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
export function paintRacingCar(ctx: Ctx2D, cx: number, bottom: number, w: number, braking: boolean, ghost?: string, ghostSkin?: string | null): void {
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
  // Body (graphite) with a sunset reflection; the player's own car in its paint (wave 2 skins; ghosts never).
  // A ghost wears its own owner's paint (never the viewer's); the player's car the viewer's equipped one.
  const paint = ghost ? racingCarPaint({ skin: ghostSkin ?? null, world: null }) : racingCarPaint(SK);
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
  ctx.fillStyle = paint ? carPaintBody(ctx, paint, x0, top, w, bottom) : body;
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
  if (paint) carPaintMarks(ctx, paint, cx, top, w, h, bottom, skinTime());
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
  if (!ghost && !paint) {
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
  if (paint === "gold" && !ghost) carGoldSparkles(ctx, cx, top, w, h, skinTime());
  ctx.restore();
}

/** The asphalt grain's tile (world px). */
const GRAIN = 48;
let grainTile: { pattern: CanvasPattern; ctx: Ctx2D } | null = null;
/** A fine aggregate grain (light and dark specks, hashed, so every frame and device draws the same), as a pattern. */
function asphaltGrain(ctx: Ctx2D): CanvasPattern | null {
  if (grainTile && grainTile.ctx === ctx) return grainTile.pattern;
  const s = makeSurface(GRAIN, GRAIN);
  if (!s) return null;
  const g = s.getContext("2d") as unknown as Ctx2D;
  for (let i = 0; i < 260; i++) {
    const x = hash(i * 3 + 1) * GRAIN;
    const y = hash(i * 3 + 2) * GRAIN;
    const light = hash(i * 3 + 3) > 0.55;
    g.fillStyle = light ? "rgba(255,240,225,0.10)" : "rgba(0,0,0,0.16)";
    g.fillRect(x, y, light ? 1 : 1.5, light ? 1 : 1);
  }
  const pattern = ctx.createPattern(s as unknown as CanvasImageSource, "repeat");
  if (!pattern) return null;
  grainTile = { pattern, ctx };
  return pattern;
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
  /** The heading smoothed over a long window (the sun's frame). */
  smooth: Float32Array;
}
const SPR_TREE = 0;
const SPR_STAND = 1;
const SPR_BOARD = 2;
const SPR_FENCE = 3;
/** racingRev 3's advisory corner speed sign (`v` = the speed in km/h). */
const SPR_SIGN = 4;
/** A marshal post behind the wall at a corner's entry (stage 2, trackside detail). */
const SPR_MARSHAL = 5;
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
    // Kerbs a little before and after each curve (stage 2: the kerbs read again at dusk).
    for (let k = -12; k < c.len + 12; k++) kerb[at(c.start + k)] = 1;
    for (let k = -10; k < c.len + 22; k++) {
      const g = at(c.start + k);
      gravel[g] = gravel[g]! | (c.kind === RACING_SEC_CHICANE ? 3 : outside);
    }
    const zone = c.kind === RACING_SEC_HAIRPIN ? 30 : 22;
    for (let k = -zone; k < 0; k++) skid[at(c.start + k)] = 1;
    // Braking boards on the outside: 150, 100, 50.
    const side = c.dir > 0 ? -1 : 1;
    [24, 16, 8].forEach((d, j) => sprites[at(c.start - d)]!.push({ kind: SPR_BOARD, x: side * (KERB_W + 260), v: j }));
    // racingRev 3: the corner's advisory speed on the same side, before the boards (drawn on racingRev 3 only).
    const sign = racingCornerAdvice(track).find((a) => a.corner === c);
    if (sign) sprites[at(c.start - RACING_SIGN_SEGS)]!.push({ kind: SPR_SIGN, x: side * (KERB_W + 420), v: sign.kmh });
    // Trackside (stage 2): a marshal post behind the wall at the entry, a catch fence along the outside, and at a
    // hairpin a grandstand piece looking down on it.
    sprites[at(c.start - 3)]!.push({ kind: SPR_MARSHAL, x: side * (WALL_W + 260), v: 0 });
    for (let k = -6; k < c.len + 6; k++) sprites[at(c.start + k)]!.push({ kind: SPR_FENCE, x: side * WALL_W, v: 0 });
    if (c.kind === RACING_SEC_HAIRPIN) for (let k = -12; k < c.len; k += 6) sprites[at(c.start + k)]!.push({ kind: SPR_STAND, x: side * (WALL_W + 700), v: 0 });
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
  // The sun's frame (the Sports overhaul, 15 Nov 2026, display only): the heading averaged over 140 segments either way
  // (the lap continued past its ends), so through a corner the sun swings with the hills and on a straight it settles
  // ahead of the car again (the circuits are pseudo-3D: their heading drifts over a lap, so a fixed sun would hide).
  const total = h;
  const SMOOTH = 140;
  const smooth = new Float32Array(n);
  const H = (j: number) => heading[at(j)]! + Math.floor(j / n) * total;
  let acc = 0;
  for (let j = -SMOOTH; j <= SMOOTH; j++) acc += H(j);
  for (let i = 0; i < n; i++) {
    smooth[i] = acc / (2 * SMOOTH + 1);
    acc += H(i + SMOOTH + 1) - H(i - SMOOTH);
  }
  look = { track, kerb, gravel, skid, line, heading, smooth, sprites };
  return look;
}

/**
 * The trackside a circuit draws (checks only; stage 2): which segments carry kerbs and, per corner, what stands at it
 * (the marshal post, the catch fence on the outside, the braking boards and the speed sign).
 */
export function racingTrackDetail(track: RacingTrack): {
  kerb: Uint8Array;
  corners: { start: number; len: number; marshal: boolean; fenceOutside: boolean; boards: number; sign: boolean }[];
} {
  const lk = lookFor(track);
  const n = RACING_LAP_SEGS;
  const at = (i: number) => ((i % n) + n) % n;
  return {
    kerb: lk.kerb,
    corners: track.corners.map((c) => {
      const side = c.dir > 0 ? -1 : 1;
      const near = (from: number, to: number, kind: number) => {
        let count = 0;
        for (let k = from; k < to; k++) count += lk.sprites[at(c.start + k)]!.filter((s) => s.kind === kind && Math.sign(s.x) === side).length;
        return count;
      };
      return {
        start: c.start,
        len: c.len,
        marshal: near(-6, 0, SPR_MARSHAL) > 0,
        fenceOutside: near(0, c.len, SPR_FENCE) >= c.len,
        boards: near(-30, 0, SPR_BOARD),
        sign: near(-RACING_SIGN_SEGS - 1, 0, SPR_SIGN) > 0,
      };
    }),
  };
}

/* ================================ Drawing ================================ */

interface Proj {
  x: number;
  y: number;
  w: number;
  scale: number;
}

/** The default circuit at dusk (the Sports overhaul, 15 Nov 2026: darker ground and asphalt under the low sun). */
/** The ground's colours: Sunset Park's dusk palette (each circuit's own in SCENE_GROUND, racingScenery.renderer.ts). */
const COL_DAY = SCENE_GROUND[RACING_SCENE_PARK]!;

/**
 * The look this draw uses (wave 2 skins; src/lib/arcade/skins/look.ts): set for the length of the public draw calls,
 * the default otherwise. SK.world swaps the day palette for the Neon Night's; SK.skin paints the player's own car.
 */
let SK: GameLook = NO_LOOK;
let COL: typeof COL_DAY = COL_DAY;
function useLook(look: GameLook): void {
  SK = look;
  COL = look.world ? NEON_NIGHT_COL : COL_DAY;
}

function quad(path: Path2D, x1: number, y1: number, w1: number, x2: number, y2: number, w2: number, a1: number, b1: number, a2: number, b2: number): void {
  // From a1..b1 (in units of w1 about x1) on the near edge to a2..b2 on the far edge.
  path.moveTo(x1 + a1 * w1, y1);
  path.lineTo(x1 + b1 * w1, y1);
  path.lineTo(x2 + b2 * w2, y2);
  path.lineTo(x2 + a2 * w2, y2);
  path.closePath();
}

/** The HUD chip's height and type (the Sports overhaul, 15 Nov 2026: 30 px at 16 px, was 24 at 12). */
const CHIP_H = 30;
function chip(ctx: Ctx2D, x: number, y: number, text: string, align: "left" | "center" | "right" = "left", accent = false): number {
  ctx.font = `800 16px ${MONO}`;
  const w = Math.ceil(ctx.measureText(text).width) + 22;
  const left = align === "left" ? x : align === "right" ? x - w : x - w / 2;
  ctx.fillStyle = "rgba(10,10,14,0.7)";
  ctx.beginPath();
  ctx.roundRect(left, y, w, CHIP_H, CHIP_H / 2);
  ctx.fill();
  ctx.strokeStyle = accent ? "rgba(242,199,92,0.8)" : "rgba(255,255,255,0.14)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = accent ? "#F2C75C" : "#F3F1EC";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, left + w / 2, y + CHIP_H / 2 + 1);
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

/** The area drawWorld paints (world units): the world itself, or the play screen round it (racingAmbient). */
interface Bounds {
  x0: number;
  x1: number;
  y1: number;
  /** The view beyond the world: no car, flare or heat haze (the world canvas covers them). */
  beyond: boolean;
  /**
   * The top of the area that needs paint (world units; 0 = all of it). Beyond the world with no side strips only the
   * strip under it does, so the sky, the hills and every segment whose near edge lies above it are skipped (their
   * pixels would all be clipped away; this keeps the layer's cost to the strip it paints).
   */
  y0?: number;
}
const WORLD_BOUNDS: Bounds = { x0: 0, x1: RACING_WORLD_W, y1: RACING_WORLD_H, beyond: false };

/** The scene (sky, hills, road, roadside, ghosts, car) for a state, without the HUD. */
function drawWorld(ctx: Ctx2D, state: RacingState, L: Layers, B: Bounds = WORLD_BOUNDS): void {
  const W = RACING_WORLD_W;
  const track = racingTrackOf(state);
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

  // The circuit's own ground (stage 2): its grass under the same road palette; the Neon Night keeps its own.
  const scene = SK.world ? RACING_SCENE_PARK : racingSceneOf(state);
  if (!SK.world) COL = SCENE_GROUND[scene]!;
  const y0 = B.y0 ?? 0;
  const high = y0 <= HORIZON + 20;
  // Sky, sun, hills (beyond the world, the sky's layer mirrored on either side, so its clouds run on).
  if (!high) {
    // Only the strip under the world needs paint: none of the sky or hills reaches it.
  } else if (L.sky) {
    ctx.drawImage(L.sky, 0, 0, W, HORIZON + 20);
    if (B.beyond)
      for (const at of [0, 2 * W]) {
        ctx.save();
        ctx.translate(at, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(L.sky, 0, 0, W, HORIZON + 20);
        ctx.restore();
      }
  } else paintRacingSky(ctx, W, RACING_WORLD_H);
  // The low sun ahead (the Sports overhaul): bearing taken against the smoothed heading, so it sits just off centre on
  // the straights and swings out through the corners; on the horizon, half behind the tree line. The Neon Night has none.
  const smoothHere = lk.smooth[carSeg]! + (lk.smooth[(carSeg + 1) % n]! - lk.smooth[carSeg]!) * carFrac;
  let rel = SUN_BEARING * 0.4 - 0.5 * (heading - smoothHere);
  rel = Math.atan2(Math.sin(rel), Math.cos(rel));
  const sunX = W / 2 + Math.tan(Math.max(-1.3, Math.min(1.3, rel))) * F;
  const sunY = HORIZON - 30;
  const sunOn = Math.abs(rel) < 1.1;
  if (SK.world) {
    if (high) paintNeonNightStars(ctx, W, HORIZON, skinTime());
  }
  const hillShift = (layer: Surface | null, h: number, k: number, y: number) => {
    if (!layer) return;
    let off = (-heading * PX_PER_RAD * k) % HILL_W;
    if (off > 0) off -= HILL_W;
    while (off > B.x0) off -= HILL_W;
    for (let x = off; x < B.x1; x += HILL_W) ctx.drawImage(layer, x, y - h, HILL_W, h);
  };
  if (high) {
    hillShift(L.far, FAR_H, 0.5, HORIZON + 2);
    // The sun between the far hills and the near tree line: low ahead, its foot behind the trees.
    if (!SK.world && sunOn) paintSun(ctx, sunX, sunY, 22);
    hillShift(L.near, NEAR_H, 0.8, HORIZON + 4);
  }
  // The far fields in the haze, under the road's farthest segment.
  const haze = ctx.createLinearGradient(0, HORIZON + 4, 0, HAZE_END);
  haze.addColorStop(0, SK.world ? NEON_NIGHT_HAZE : SCENE_HAZE[scene]!);
  haze.addColorStop(1, COL.grassA);
  ctx.fillStyle = haze;
  ctx.fillRect(B.x0, HORIZON + 3, B.x1 - B.x0, B.y1 - HORIZON - 3);
  // Harbour Run: the water on the horizon with the low sun's path on it, above where the haze reaches the grass (the
  // road's far end draws over it).
  const harbour = !SK.world && scene === RACING_SCENE_HARBOUR;
  if (high && harbour) paintHarbourWater(ctx, B.x0, B.x1, HORIZON + 3, HORIZON + WATER_H + 2, sunOn ? sunX : null);

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
    skid: new Path2D(), start: new Path2D(), startW: new Path2D(), dash: new Path2D(),
  };
  const clipY = new Float64Array(edges).fill(B.y1);
  let maxY = B.y1;
  const visible = new Uint8Array(edges);
  const kw = KERB_W / RW;
  const ww = WALL_W / RW;
  // The Neon Night's kerbs chase (0 by default, and at rest under Reduce Motion).
  const chase = SK.world ? neonNightChase(skinTime()) : 0;
  for (let i = 0; i < DRAW_SEGS; i++) {
    const q1 = proj[i]!;
    const p2 = proj[i + 1]!;
    clipY[i] = maxY;
    if (ez[i + 1]! <= NEAR || p2.y >= maxY) continue;
    // The near edge clipped to the crest (or the screen's bottom), along the segment's own lines: exact in screen space.
    const cf = q1.y > maxY ? (maxY - p2.y) / (q1.y - p2.y) : 1;
    const p1 = cf < 1 ? { x: p2.x + (q1.x - p2.x) * cf, y: maxY, w: p2.w + (q1.w - p2.w) * cf, scale: q1.scale } : q1;
    if (Math.min(p1.y, maxY) < y0) {
      // Wholly above the area that needs paint: its surfaces, sprites and walls all stand above its near edge.
      maxY = p2.y;
      continue;
    }
    visible[i] = 1;
    const k = base + i;
    const seg = segOf(k);
    const y1 = Math.min(p1.y, maxY);
    const alt = Math.floor(k / 3) % 2 === 0;
    // The near grass's band, but not where the haze fill under the road is already exactly grassA (from HAZE_END +
    // HAZE_MARGIN down): grassA over grassA changes no pixel. Skipped a whole three-segment group at a time, so every
    // edge of the grassA area stays under a grassB band painted after it, exactly as when the group was part of one
    // filled union (1 Nov 2026; racing-render-check proves every pixel the same on frames across whole races).
    // Harbour Run's grass starts below the water on the horizon (stage 2); above HAZE_END, so the saving is untouched.
    const gTop = harbour ? Math.max(p2.y, HORIZON + WATER_H) : p2.y;
    if (y1 - gTop + 1 <= 0) {
      // Wholly in the water band: no grass.
    } else if (!alt) P.grassB.rect(B.x0, gTop, B.x1 - B.x0, y1 - gTop + 1);
    else {
      const far = i + (Math.floor(k / 3) * 3 + 2 - k);
      const groupTop = far + 1 < edges ? proj[far + 1]!.y : -Infinity;
      if (!(grassSkip && groupTop >= HAZE_END + HAZE_MARGIN && ez[far + 1]! > NEAR)) P.grassA.rect(B.x0, gTop, B.x1 - B.x0, y1 - gTop + 1);
    }
    const gv = lk.gravel[seg]!;
    const gp = alt ? P.gravelA : P.gravelB;
    // Gravel traps over the grass (each surface path holds non-overlapping quads only: nonzero fills, no holes).
    if (gv & 1) quad(gp, p1.x, y1, p1.w, p2.x, p2.y, p2.w, -ww, -kw, -ww, -kw);
    if (gv & 2) quad(gp, p1.x, y1, p1.w, p2.x, p2.y, p2.w, kw, ww, kw, ww);
    const kerbHere = lk.kerb[seg]!;
    if (kerbHere) {
      const kp = Math.floor((k + chase) / 2) % 2 === 0 ? P.kerbR : P.kerbW;
      quad(kp, p1.x, y1, p1.w, p2.x, p2.y, p2.w, -kw, -1, -kw, -1);
      quad(kp, p1.x, y1, p1.w, p2.x, p2.y, p2.w, 1, kw, 1, kw);
    } else {
      quad(P.runoff, p1.x, y1, p1.w, p2.x, p2.y, p2.w, -kw, -1, -kw, -1);
      quad(P.runoff, p1.x, y1, p1.w, p2.x, p2.y, p2.w, 1, kw, 1, kw);
    }
    quad(alt ? P.roadA : P.roadB, p1.x, y1, p1.w, p2.x, p2.y, p2.w, -1, 1, -1, 1);
    // White track-limit lines on the straights, and (stage 2) the dashed centre marking between them.
    if (!kerbHere) {
      quad(P.edge, p1.x, y1, p1.w, p2.x, p2.y, p2.w, -1, -0.97, -1, -0.97);
      quad(P.edge, p1.x, y1, p1.w, p2.x, p2.y, p2.w, 0.97, 1, 0.97, 1);
      if (k % 3 === 0) quad(P.dash, p1.x, y1, p1.w, p2.x, p2.y, p2.w, -0.012, 0.012, -0.012, 0.012);
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
  fill(P.dash, SK.world ? COL.edge : "rgba(238,233,223,0.55)");
  fill(P.start, "#18181C");
  fill(P.startW, "#F1EEE8");
  if (!SK.world) {
    // The Sports overhaul (15 Nov 2026, display only): the asphalt's grain, flowing past with the car (its offset follows
    // the distance), and the low sun's warm light across the ground from its side of the sky (no glare: under the
    // roadside, the car and every number).
    const grain = asphaltGrain(ctx);
    if (grain) {
      const off = ((state.s / RACING_SEG) * 9) % GRAIN;
      for (const road of [P.roadA, P.roadB, P.runoff]) {
        ctx.save();
        ctx.clip(road);
        ctx.translate(0, off);
        ctx.fillStyle = grain;
        ctx.fillRect(B.x0, HORIZON - GRAIN, B.x1 - B.x0, B.y1 - HORIZON + 2 * GRAIN);
        ctx.restore();
      }
    }
    const lx = Math.max(-W, Math.min(2 * W, sunX));
    // The asphalt's sheen towards the low sun: a warm band from the sun's place on the horizon fanning down the road,
    // brightest far ahead, gone before the car (on the tarmac only: the paths it clips to are the road's).
    if (sunOn) {
      const reach = (RACING_CAR_Y - HORIZON) * 0.95;
      const sheen = ctx.createLinearGradient(0, HORIZON, 0, HORIZON + reach);
      sheen.addColorStop(0, "rgba(255,196,140,0.42)");
      sheen.addColorStop(0.35, "rgba(255,170,115,0.2)");
      sheen.addColorStop(1, "rgba(255,150,100,0)");
      for (const road of [P.roadA, P.roadB]) {
        ctx.save();
        ctx.clip(road);
        ctx.fillStyle = sheen;
        ctx.beginPath();
        ctx.moveTo(lx - 10, HORIZON);
        ctx.lineTo(lx + 10, HORIZON);
        ctx.lineTo(lx + (W / 2 - lx) * 0.6 + W * 0.32, HORIZON + reach);
        ctx.lineTo(lx + (W / 2 - lx) * 0.6 - W * 0.32, HORIZON + reach);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }
    const warm = ctx.createRadialGradient(lx, HORIZON, 0, lx, HORIZON, W * 1.5);
    warm.addColorStop(0, "rgba(255,150,80,0.26)");
    warm.addColorStop(0.45, "rgba(255,120,70,0.1)");
    warm.addColorStop(1, "rgba(255,120,70,0)");
    ctx.fillStyle = warm;
    ctx.fillRect(B.x0, HORIZON + 3, B.x1 - B.x0, B.y1 - HORIZON - 3);
  }

  // Roadside, back to front: per segment its sprites, then its tyre walls (the trees stand behind them).
  const ghostAt = new Map<number, RacingGhostView[]>();
  for (const g of nearestRacingGhosts(ghosts, state.s, state.x)) {
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
        // Harbour Run's quay is sparser than the park (half its containers and lamps).
        if (harbour && (seg + sp.v) % 2) continue;
        const img = L.trees[sp.v % Math.max(1, L.trees.length)];
        const h = (1100 + 500 * ((sp.v + seg) % 3)) * sc;
        const w = h * (TREE_W / TREE_H);
        if (sx + w / 2 < B.x0 || sx - w / 2 > B.x1) continue;
        // Beyond the world: a tree wholly inside the world's box is under its canvas.
        if (B.beyond && sx - w / 2 >= 0 && sx + w / 2 <= W && p2.y <= RACING_WORLD_H) continue;
        drawClipped(ctx, img ?? null, sx - w / 2, p2.y - h, w, h, clip);
      } else if (sp.kind === SPR_STAND) {
        const w = 2600 * sc;
        const h = 1300 * sc;
        const left = sp.x < 0 ? sx - w * 0.9 : sx - w * 0.1;
        if (left > B.x1 || left + w < B.x0) continue;
        if (B.beyond && left >= 0 && left + w <= W && p2.y <= RACING_WORLD_H) continue;
        // On the right its front edge at the post, on the left mirrored (stage 2: stands by the hairpins either side).
        drawClipped(ctx, L.stand, sp.x < 0 ? sx - w * 0.9 : sx - w * 0.1, p2.y - h, w, h, clip);
      } else if (sp.kind === SPR_SIGN) {
        if (state.rev >= RACING_REV_3) drawSpeedSign(ctx, sx, p2.y, sc, sp.v, clip);
      } else if (sp.kind === SPR_MARSHAL) {
        drawMarshalPost(ctx, sx, p2.y, sc, clip, sp.x < 0 ? -1 : 1);
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
        ctx.fillStyle = SK.world ? NEON_NIGHT_BELTS[belt < 2 ? 0 : 1] : belt < 2 ? "#B8322C" : "#E6E0D6";
        ctx.beginPath();
        ctx.moveTo(xa, ya - ha * 0.78);
        ctx.lineTo(xb, p2.y - hb * 0.78);
        ctx.lineTo(xb, p2.y - hb * 0.62);
        ctx.lineTo(xa, ya - ha * 0.62);
        ctx.closePath();
        ctx.fill();
      }
      // Catch fence over the wall by the grandstand.
      for (const fence of lk.sprites[seg]!) {
        if (fence.kind !== SPR_FENCE) continue;
        const fs = fence.x < 0 ? -1 : 1;
        const xa = p1.x + fs * ww * p1.w;
        const xb = p2.x + fs * ww * p2.w;
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
      // The rendered car in the ghost's colour (or its owner's paint); the painted one until the images arrive.
      const gPaint = racingCarPaint({ skin: g.skin ?? null, world: null });
      if (!drawRacingCarSprite(ctx, { cx: gx, contactY: gy, width: gw, yawDeg: 0, braking: false, paint: gPaint, ghost: gPaint ? null : g.colour }))
        paintRacingCar(ctx, gx, gy, gw, false, g.colour, g.skin);
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

  // racingRev 2's start: the grid box under the car and the lights gantry over the road ahead (road furniture, so it
  // recedes as the car leaves; the start straight is level and straight, so a straight projection is exact).
  if (state.rev >= RACING_REV_2 && state.s < RACING_SEG * 40) drawStart(ctx, state, camX);
  if (B.beyond) return;

  // The player's car: a little bounce at speed, tilted as it steers, brake lights on the brake.
  const speedShare = state.v / 3072;
  const bounce = state.off ? Math.sin(state.tick * 1.7) * 1.6 : Math.sin(state.tick * 0.9) * 0.4 * speedShare;
  const carW = RACING_CAR_HALF_PX * 2;
  const braking = state.pedal < 0;
  // Molten Gold's shine moves, so its car is painted each frame (the sprite is its still, under Reduce Motion).
  const sprite = SK.skin && racingCarPaint(SK) === "gold" && !skinReducedMotion() ? null : braking ? L.carBrake : L.car;
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
  // The steer the front wheels hold (racingRev 2's smoothed wheel; the stick itself on racingRev 1) and the yaw it gives
  // the body: more with speed, a little even at a crawl so the wheels read on the grid.
  const steerShare = (state.rev >= RACING_REV_2 ? state.wheel : state.steer) / RACING_STICK_MAX;
  const yaw = Math.max(-1, Math.min(1, steerShare * (0.35 + 0.65 * Math.min(1, speedShare * 1.6))));
  // The car's long shadow towards the camera, cast by the low sun ahead (display only, on the ground under the car;
  // the Neon Night has no sun).
  if (!SK.world) {
    const len = carW * 1.15;
    const lean = Math.max(-0.5, Math.min(0.5, (W / 2 - sunX) / W)) * carW * 0.8;
    const top = RACING_CAR_Y + bounce - carW * 0.05;
    const sh = ctx.createLinearGradient(0, top, 0, top + len);
    sh.addColorStop(0, "rgba(8,6,10,0.5)");
    sh.addColorStop(1, "rgba(8,6,10,0)");
    ctx.fillStyle = sh;
    ctx.beginPath();
    ctx.moveTo(W / 2 - carW * 0.46, top);
    ctx.lineTo(W / 2 + carW * 0.46, top);
    ctx.lineTo(W / 2 + carW * 0.4 + lean, top + len);
    ctx.lineTo(W / 2 - carW * 0.4 + lean, top + len);
    ctx.closePath();
    ctx.fill();
  }
  // The rendered car (the Sports overhaul, 15 Nov 2026): the yaw's own frame, exactly the collision width, its lowest
  // pixel on the contact line; the painted car below until its images arrive (and in checks without images).
  const rendered = drawRacingCarSprite(ctx, {
    cx: W / 2,
    contactY: RACING_CAR_Y + bounce,
    width: carW,
    yawDeg: (yaw * RACING_CAR_TURN_MAX * 180) / Math.PI,
    braking,
    paint: racingCarPaint(SK),
  });
  if (!rendered) {
  ctx.save();
  // Yaw (3 Nov 2026, every revision): the car is one shape turned slightly into the turn about its centre, never
  // reshaped, so it stays symmetrical; scaled so the turned body's width stays the collision width (rule 3) and lifted
  // so its lowest corner stays on the contact line.
  const h = carW * 0.6;
  const ang = yaw * RACING_CAR_TURN_MAX;
  const fit = racingCarTurnFit(ang);
  ctx.translate(W / 2, RACING_CAR_Y + bounce - fit * ((h / 2) * Math.cos(ang) + (carW / 2) * Math.abs(Math.sin(ang))));
  ctx.rotate(ang);
  ctx.scale(fit, fit);
  ctx.translate(0, h / 2);
  if (sprite) {
    // The sprite's body spans CAR_SPRITE_W exactly, its contact line 2 px above its bottom.
    const s = carW / CAR_SPRITE_W;
    ctx.drawImage(sprite, -CAR_SPRITE_W * s / 2, -(CAR_SPRITE_H - 2) * s, CAR_SPRITE_W * s, CAR_SPRITE_H * s);
  } else paintRacingCar(ctx, 0, 0, carW, braking);
  ctx.restore();
  }
  // Brake-light bloom on the painted car only (drawn here, not in the sprite, so it has no edge); the rendered car's
  // lights are its own.
  if (braking && !rendered) {
    const by = RACING_CAR_Y + bounce - carW * 0.6 * 0.44;
    const glow = ctx.createRadialGradient(W / 2, by, 0, W / 2, by, carW * 0.62);
    glow.addColorStop(0, "rgba(255,70,60,0.32)");
    glow.addColorStop(1, "rgba(255,70,60,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(W / 2 - carW * 0.62, by - carW * 0.62, carW * 1.24, carW * 1.24);
  }
  // Rain light blinking on the grass.
  if (!rendered && state.off && Math.floor(state.tick / 8) % 2 === 0) {
    ctx.fillStyle = "rgba(255,80,80,0.9)";
    const h = carW * 0.6;
    ctx.fillRect(W / 2 - carW * 0.025, RACING_CAR_Y - h * 0.34 + bounce, carW * 0.05, h * 0.06);
  }

  // A light lens flare when facing the sun (off since the Sports overhaul, 15 Nov 2026: no glare).
  if (sunOn && LENS_FLARE) {
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

/** racingRev 2: the gantry's place (race distance) and its beam's height and posts' place (world units). */
const GANTRY_S = 6 * RACING_SEG;
const GANTRY_H = 1500;
const GANTRY_POST = 1.18;

/** A point on the level start straight to the screen: race distance `sd`, lateral `lx` (RW units), height `hy`. */
function startPoint(state: RacingState, camX: number, sd: number, lx: number, hy = 0): { x: number; y: number; k: number } | null {
  const z = ((sd - state.s) / RACING_SEG) * SL + ZC;
  if (z < 80) return null;
  const k = F / z;
  return { x: RACING_WORLD_W / 2 + (lx - camX) * k, y: HORIZON + (CH - hy) * k, k };
}

/** racingRev 2's start (display): the car's grid box and the five-light gantry over the road (lit by racingLightsOn). */
function drawStart(ctx: Ctx2D, state: RacingState, camX: number): void {
  // The grid box: a white bracket round the car's spot, behind the line.
  const box = (sd0: number, sd1: number, l0: number, l1: number) => {
    const a = startPoint(state, camX, sd0, l0);
    const b = startPoint(state, camX, sd0, l1);
    const c = startPoint(state, camX, sd1, l1);
    const d = startPoint(state, camX, sd1, l0);
    if (!a || !b || !c || !d) return;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y);
    ctx.lineTo(d.x, d.y);
    ctx.closePath();
    ctx.fill();
  };
  ctx.fillStyle = "rgba(240,236,228,0.85)";
  const half = lat(RACING_CAR_HALF) + 90;
  const back = -RACING_SEG * 0.9;
  box(back, -RACING_SEG * 0.02, -half - 24, -half);
  box(back, -RACING_SEG * 0.02, half, half + 24);
  box(-RACING_SEG * 0.08, -RACING_SEG * 0.02, -half - 24, -half + 160);
  box(-RACING_SEG * 0.08, -RACING_SEG * 0.02, half - 160, half + 24);
  // The gantry: two posts beside the track and a beam over it with five light pods.
  const L = startPoint(state, camX, GANTRY_S, -GANTRY_POST * RW);
  const R = startPoint(state, camX, GANTRY_S, GANTRY_POST * RW);
  if (!L || !R) return;
  const k = L.k;
  const beamY = L.y - GANTRY_H * k;
  const beamH = 150 * k;
  ctx.fillStyle = "#222228";
  ctx.fillRect(L.x - 22 * k, beamY, 44 * k, L.y - beamY);
  ctx.fillRect(R.x - 22 * k, beamY, 44 * k, R.y - beamY);
  ctx.fillStyle = "#17171C";
  ctx.fillRect(L.x - 30 * k, beamY - beamH * 0.2, R.x - L.x + 60 * k, beamH * 0.55);
  const lit = racingLightsOn(state.rev, state.tick);
  const podW = 230 * k;
  const podH = 520 * k;
  for (let i = 0; i < RACING_V2_LIGHTS; i++) {
    const cx = L.x + ((R.x - L.x) * (i + 1)) / (RACING_V2_LIGHTS + 1);
    const top = beamY + beamH * 0.1;
    ctx.fillStyle = "#0C0C10";
    ctx.beginPath();
    ctx.roundRect(cx - podW / 2, top, podW, podH, podW * 0.18);
    ctx.fill();
    for (let r = 0; r < 2; r++) {
      const ly = top + podH * (0.3 + r * 0.42);
      const on = i < lit;
      if (on) {
        const glow = ctx.createRadialGradient(cx, ly, 0, cx, ly, podW * 1.3);
        glow.addColorStop(0, "rgba(255,40,30,0.55)");
        glow.addColorStop(1, "rgba(255,40,30,0)");
        ctx.fillStyle = glow;
        ctx.fillRect(cx - podW * 1.3, ly - podW * 1.3, podW * 2.6, podW * 2.6);
      }
      ctx.fillStyle = on ? "#FF2A1E" : "#2A1416";
      ctx.beginPath();
      ctx.arc(cx, ly, podW * 0.34, 0, Math.PI * 2);
      ctx.fill();
      if (on) {
        ctx.fillStyle = "rgba(255,210,190,0.85)";
        ctx.beginPath();
        ctx.arc(cx - podW * 0.08, ly - podW * 0.08, podW * 0.1, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

/**
 * racingRev 2's countdown over the scene (display): a large 5-4-3-2-1 as each light comes on (a short pop), then GO
 * as they go out, fading over the first second of the race.
 */
function drawCountdown(ctx: Ctx2D, state: RacingState): void {
  if (state.rev < RACING_REV_2) return;
  const lit = racingLightsOn(state.rev, state.tick);
  const W = RACING_WORLD_W;
  const y = 196;
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (lit > 0) {
    const since = state.tick - (RACING_V2_LIGHT0 + (lit - 1) * RACING_V2_LIGHT_GAP);
    const pop = 1 + 0.35 * Math.max(0, 1 - since / 12);
    ctx.translate(W / 2, y);
    ctx.scale(pop, pop);
    ctx.font = `800 108px ${ARCADE_FX_DISPLAY_FONT}`;
    ctx.lineWidth = 8;
    ctx.strokeStyle = "rgba(20,8,10,0.75)";
    ctx.strokeText(String(RACING_V2_LIGHTS + 1 - lit), 0, 0);
    ctx.shadowColor = "rgba(255,40,30,0.9)";
    ctx.shadowBlur = 24;
    ctx.fillStyle = "#FFF4EC";
    ctx.fillText(String(RACING_V2_LIGHTS + 1 - lit), 0, 0);
  } else if (state.tick >= RACING_V2_GO && state.tick < RACING_V2_GO + 60) {
    const t = (state.tick - RACING_V2_GO) / 60;
    ctx.globalAlpha = Math.max(0, 1 - t * t);
    ctx.translate(W / 2, y);
    const sc = 1 + 0.25 * t;
    ctx.scale(sc, sc);
    ctx.font = `800 96px ${ARCADE_FX_DISPLAY_FONT}`;
    ctx.lineWidth = 8;
    ctx.strokeStyle = "rgba(10,10,14,0.7)";
    ctx.strokeText("GO", 0, 0);
    ctx.shadowColor = "rgba(242,199,92,0.9)";
    ctx.shadowBlur = 26;
    ctx.fillStyle = "#F7D77A";
    ctx.fillText("GO", 0, 0);
  }
  ctx.restore();
}

/**
 * A marshal post (stage 2, trackside detail; display only): a small orange hut on legs behind the wall at a corner's
 * entry, its window lit and the low sun on its side, a flag pole beside it; scaled with distance, clipped at the crest.
 */
function drawMarshalPost(ctx: Ctx2D, sx: number, groundY: number, sc: number, clip: number, side: number): void {
  const w = 300 * sc;
  const h = 420 * sc;
  if (groundY - h > clip || w < 1.5) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(sx - w, groundY - h * 1.6, w * 2, Math.max(0, clip - (groundY - h * 1.6)));
  ctx.clip();
  ctx.fillStyle = "#1C1B21";
  ctx.fillRect(sx - w * 0.42, groundY - h * 0.4, w * 0.06, h * 0.4);
  ctx.fillRect(sx + w * 0.36, groundY - h * 0.4, w * 0.06, h * 0.4);
  // The hut: orange, darker on the side away from the sun.
  ctx.fillStyle = "#C2561E";
  ctx.fillRect(sx - w / 2, groundY - h, w, h * 0.62);
  ctx.fillStyle = "rgba(40,16,10,0.35)";
  ctx.fillRect(side > 0 ? sx : sx - w / 2, groundY - h, w / 2, h * 0.62);
  ctx.fillStyle = "#26232A";
  ctx.fillRect(sx - w * 0.56, groundY - h * 1.06, w * 1.12, h * 0.08);
  // The lit window.
  ctx.fillStyle = "#FFD58E";
  ctx.fillRect(sx - w * 0.3, groundY - h * 0.88, w * 0.6, h * 0.2);
  // The flag pole and a yellow flag.
  ctx.fillStyle = "#2A272E";
  ctx.fillRect(sx - side * w * 0.66, groundY - h * 1.5, Math.max(0.5, w * 0.03), h * 1.5);
  ctx.fillStyle = "#E8C33A";
  ctx.fillRect(sx - side * w * 0.66 - (side > 0 ? 0 : w * 0.28), groundY - h * 1.5, w * 0.28, h * 0.18);
  ctx.restore();
}

/**
 * racingRev 3's advisory corner speed sign (display): a round white sign with a red ring and the corner's speed in
 * km/h on a dark post, standing on the outside of the corner before the braking boards, scaled with distance.
 */
function drawSpeedSign(ctx: Ctx2D, sx: number, groundY: number, sc: number, kmh: number, clip: number): void {
  const d = 540 * sc;
  const postH = 360 * sc;
  if (groundY - postH - d > clip || d < 1) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(sx - d, groundY - postH - d * 1.1, d * 2, Math.max(0, clip - (groundY - postH - d * 1.1)));
  ctx.clip();
  ctx.fillStyle = "#1C1C22";
  ctx.fillRect(sx - d * 0.05, groundY - postH, d * 0.1, postH);
  const cy = groundY - postH - d / 2;
  ctx.fillStyle = "#C8312C";
  ctx.beginPath();
  ctx.arc(sx, cy, d / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#F7F5EF";
  ctx.beginPath();
  ctx.arc(sx, cy, d * 0.38, 0, Math.PI * 2);
  ctx.fill();
  if (d > 8) {
    ctx.fillStyle = "#16161B";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `800 ${Math.max(4, d * 0.34)}px ${ARCADE_FX_DISPLAY_FONT}`;
    ctx.fillText(String(kmh), sx, cy + d * 0.02);
    if (d > 26) {
      ctx.font = `700 ${d * 0.1}px ${MONO}`;
      ctx.fillStyle = "rgba(22,22,27,0.7)";
      ctx.fillText("KM/H", sx, cy + d * 0.25);
    }
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";
  }
  ctx.restore();
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
  // The race clock (from lights out on racingRev 2).
  const go = racingGoTick(state.rev);
  chip(ctx, W - 12, 10, done ? timeText(state.finishTick - go) : timeText(Math.min(racingRaceTicks(state), RACING_RUN_TICKS)), "right", done);
  // racingRev 4: the circuit's name on the grid and for two seconds after lights out.
  if (state.rev >= RACING_REV_4 && state.tick < go + 120) chip(ctx, W / 2, 48, RACING_CIRCUITS[racingCircuitOf(state.seed)]!.name.toUpperCase(), "center", true);

  // Speed, bottom left.
  const y = RACING_STICK_Y;
  ctx.fillStyle = "rgba(10,10,14,0.62)";
  ctx.beginPath();
  ctx.roundRect(12, y - 30, 92, 54, 12);
  ctx.fill();
  // On the grass the speedo reads red and shows how much has been lost since leaving the tarmac (stage 2).
  const drop = racingGrassDrop(state);
  ctx.fillStyle = state.off ? "#FF6B5E" : "#F3F1EC";
  ctx.font = `800 34px ${MONO}`;
  ctx.textAlign = "right";
  ctx.fillText(String(racingKmh(state.v)), 94, y + 6);
  if (drop > 0) {
    ctx.fillStyle = "rgba(10,10,14,0.62)";
    ctx.beginPath();
    ctx.roundRect(12, y - 54, 72, 20, 8);
    ctx.fill();
    ctx.fillStyle = "#FF6B5E";
    ctx.font = `800 13px ${MONO}`;
    ctx.textAlign = "left";
    ctx.fillText(`▼ ${drop}`, 22, y - 39);
    ctx.textAlign = "right";
  }
  ctx.font = `800 11px ${MONO}`;
  ctx.fillStyle = "rgba(243,241,236,0.78)";
  ctx.fillText("KM/H", 94, y + 20);
  ctx.textAlign = "left";

  // Clean-sector bars, bottom right: gold when clean, dim red when touched, outline ahead.
  const bx = W - 104;
  ctx.fillStyle = "rgba(10,10,14,0.5)";
  ctx.beginPath();
  ctx.roundRect(bx, y - 30, 92, 54, 12);
  ctx.fill();
  // A clean sector just completed (stage 2): its bar flashes white and gold as the car crosses into the next.
  const flash = racingSectorFlash(state);
  for (let k = 0; k < RACING_SECTORS; k++) {
    const x = bx + 10 + k * 9.5;
    const top = y - 18;
    const h = 30;
    const clean = (state.cleanMask >> k) & 1;
    if (k === flash) ctx.fillStyle = skinReducedMotion() || Math.floor(state.tick / 5) % 2 ? "#FFFFFF" : "#F2C75C";
    else if (k < state.sector) ctx.fillStyle = clean ? "#F2C75C" : "rgba(220,80,70,0.55)";
    else if (k === state.sector) ctx.fillStyle = state.dirty ? "rgba(220,80,70,0.55)" : "rgba(243,241,236,0.55)";
    else ctx.fillStyle = "rgba(243,241,236,0.16)";
    ctx.fillRect(x, top, 6, h);
    if (k === RACING_SECTORS / 2 - 1) {
      ctx.fillStyle = "rgba(243,241,236,0.3)";
      ctx.fillRect(x + 7.5, top - 2, 1, h + 4);
    }
  }

  // The joystick (3 Nov 2026, display only, every revision): a faint ring and a small gold knob, drawn where the thumb
  // went down (or at its resting place) but never higher than just below the car, so neither covers the car or the
  // road ahead; the thumb's mapping is unchanged (the knob shows the held input).
  const o = racingStickDrawAt(stickOrigin ?? { x: RACING_STICK_X, y: RACING_STICK_Y });
  const throwX = racingSteerThrow(state.rev);
  ctx.save();
  ctx.globalAlpha = stickOrigin ? 1 : 0.75;
  ctx.fillStyle = "rgba(20,20,26,0.12)";
  ctx.strokeStyle = "rgba(243,241,236,0.28)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(o.x, o.y, throwX, RACING_STICK_R, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = "rgba(243,241,236,0.12)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(o.x - throwX, o.y);
  ctx.lineTo(o.x + throwX, o.y);
  ctx.moveTo(o.x, o.y - RACING_STICK_R);
  ctx.lineTo(o.x, o.y + RACING_STICK_R);
  ctx.stroke();
  const kx = o.x + (state.steer / RACING_STICK_MAX) * throwX;
  const ky = o.y - (state.pedal / RACING_STICK_MAX) * RACING_STICK_R;
  const knob = ctx.createRadialGradient(kx - 3, ky - 4, 1, kx, ky, RACING_KNOB_R);
  knob.addColorStop(0, "#F7E3A6");
  knob.addColorStop(0.55, "#D9A93A");
  knob.addColorStop(1, "#8A6516");
  ctx.globalAlpha *= 0.92;
  ctx.fillStyle = knob;
  ctx.beginPath();
  ctx.arc(kx, ky, RACING_KNOB_R, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** The play screen's frame, under the shared success and miss effects (sportsFx.renderer.ts). */
export function drawRacingArt(ctx: CanvasRenderingContext2D, state: RacingState, size: CanvasSize, look: GameLook = NO_LOOK): void {
  useLook(look);
  try {
    arcadeFx(ctx, RACING_FX, state, () => drawRacingWorld(ctx, state, size), size);
  } finally {
    useLook(NO_LOOK);
  }
}

/** The look the view beyond the world draws in: the last play frame's (display only). */
let beyondLook: GameLook = NO_LOOK;

/** The play screen's frame: the world, and the view beyond it on the screen's fill (racingAmbient). */
export function drawRacingPlay(ctx: CanvasRenderingContext2D, state: RacingState, size: CanvasSize, look: GameLook = NO_LOOK): void {
  drawRacingArt(ctx, state, size, look);
  beyondLook = look;
  repaintBeyond(state);
}

function drawRacingWorld(ctx: CanvasRenderingContext2D, state: RacingState, size: CanvasSize): void {
  const W = RACING_WORLD_W;
  const H = RACING_WORLD_H;
  ctx.save();
  if (size.width !== W || size.height !== H) ctx.scale(size.width / W, size.height / H);
  const t = typeof ctx.getTransform === "function" ? ctx.getTransform() : null;
  const L = layersFor(t ? Math.hypot(t.a, t.b) : 1, racingSceneOf(state));
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.clip();
  // Stage 2's effects (racingFx.renderer.ts, display only): the view (the world, the car and what the car throws up)
  // shakes on the kerb; the HUD and the controls never move.
  const fx = observeRacingFx(ctx, state);
  const shake = racingKerbShake(state);
  const carW = RACING_CAR_HALF_PX * 2;
  ctx.save();
  if (shake.dx || shake.dy) ctx.translate(shake.dx, shake.dy);
  drawWorld(ctx, state, L);
  drawParticles(ctx, W / 2, RACING_CAR_Y, racingDust(state, carW), "dust");
  drawParticles(ctx, W / 2, RACING_CAR_Y, racingSparks(state, carW), "spark");
  drawSpeedLines(ctx, state, W, HORIZON, RACING_STICK_TOP);
  ctx.restore();
  drawCountdown(ctx, state);
  drawHud(ctx, state);
  const entry = racingCornerEntry(state, fx.entryAt);
  if (entry) drawCornerFlash(ctx, entry, W / 2, 70, ARCADE_FX_DISPLAY_FONT);
  drawFinish(ctx, state, fx.finishedMs, W, 50, ARCADE_FX_DISPLAY_FONT, fx.laps);
  ctx.restore();
}

export const racingArtGame: ArcadeGame<RacingState, ArcadeInputEvent | null> = { ...racingGame, draw: drawRacingArt };

/**
 * The play screen's scenery beyond the world (31 Oct 2026, Apex: no dead strip, no bare side strips). The static
 * scene is only the first paint and the reduced-motion fallback: the sky, the hills and the fields at the sides and the
 * tarmac below. Over it, racingAmbient paints the world's own view carried on past its edges (the road, its edge lines
 * and kerbs, the grass, trees, tyre walls and grandstands) every frame the world draws.
 */
export function racingScene(ctx: CanvasRenderingContext2D, view: ArenaSceneView): void {
  racingSceneLooked(ctx, view, NO_LOOK);
}

/** The scene in a look (wave 2 skins): the live stage's, the player's own. */
export function racingSceneFor(look: GameLook): (ctx: CanvasRenderingContext2D, view: ArenaSceneView) => void {
  return look.world ? (ctx, view) => racingSceneLooked(ctx, view, look) : racingScene;
}

function racingSceneLooked(ctx: CanvasRenderingContext2D, view: ArenaSceneView, look: GameLook): void {
  useLook(look);
  try {
    paintRacingScene(ctx, view);
  } finally {
    useLook(NO_LOOK);
  }
}

function paintRacingScene(ctx: CanvasRenderingContext2D, view: ArenaSceneView): void {
  const H = view.worldH;
  if (SK.world) {
    const x0 = view.left;
    const w = view.right - view.left;
    ctx.fillStyle = "#05040F";
    ctx.fillRect(x0, view.top, w, Math.max(0, -view.top) + 2);
    ctx.save();
    ctx.translate(x0, 0);
    paintNeonNightSky(ctx, w, H, HORIZON);
    ctx.restore();
    ctx.fillStyle = COL.grassA;
    ctx.fillRect(x0, HORIZON + 3, w, H - HORIZON - 3);
    if (view.bottom > H) {
      ctx.fillStyle = COL.roadA;
      ctx.fillRect(x0, H - 1, w, view.bottom - H + 1);
    }
    return;
  }
  const x0 = view.left;
  const w = view.right - view.left;
  const sky = ctx.createLinearGradient(0, 0, 0, HORIZON + 20);
  sky.addColorStop(0, "#2C2F5E");
  sky.addColorStop(0.28, "#6B4778");
  sky.addColorStop(0.58, "#D9714F");
  sky.addColorStop(0.84, "#F7A55C");
  sky.addColorStop(1, "#FFD38A");
  ctx.fillStyle = "#2C2F5E";
  ctx.fillRect(x0, view.top, w, Math.max(0, -view.top) + 2);
  ctx.fillStyle = sky;
  ctx.fillRect(x0, 0, w, HORIZON + 20);
  ctx.fillStyle = COL.grassA;
  ctx.fillRect(x0, HORIZON + 3, w, H - HORIZON - 3);
  if (view.bottom > H) {
    ctx.fillStyle = COL.roadA;
    ctx.fillRect(x0, H - 1, w, view.bottom - H + 1);
  }
}

/**
 * Apex on the computer layout (1 Nov 2026, display only): set by the racing stage while its play screen is on the
 * desktop layout, where its world is capped (desktopModes.ts maxWorldWidth) and the scenery beside it is the static
 * backdrop (racingScene), never the moving view carried on past the world: repainting that across a large screen
 * cost Apex its 60 fps. Never set on a phone or tablet, which draw exactly as before.
 */
let largeScreen = false;
export function setRacingLargeScreen(on: boolean): void {
  largeScreen = on;
}

/** The ambient layer the play screen hands racingAmbient, kept so the world's own frames repaint it (display only). */
let beyond: { ctx: CanvasRenderingContext2D; m: DOMMatrix; view: ArenaSceneView; clipTop: number } | null = null;
let beyondState: RacingState | null = null;
let lastBeyond: RacingState | null = null;

function paintBeyond(ctx: CanvasRenderingContext2D, view: ArenaSceneView, state: RacingState): void {
  useLook(beyondLook);
  try {
    paintBeyondLooked(ctx, view, state);
  } finally {
    useLook(NO_LOOK);
  }
}

function paintBeyondLooked(ctx: CanvasRenderingContext2D, view: ArenaSceneView, state: RacingState): void {
  const L = layersFor(Math.max(1, view.scale * 2), racingSceneOf(state));
  // Only round the world (its own canvas covers the rest): the area outside its box, a 1-unit overlap at the seam.
  ctx.save();
  ctx.beginPath();
  if (view.left < 1) ctx.rect(view.left, view.top, 1 - view.left, view.bottom - view.top);
  if (view.right > RACING_WORLD_W - 1) ctx.rect(RACING_WORLD_W - 1, view.top, view.right - RACING_WORLD_W + 1, view.bottom - view.top);
  if (view.bottom > RACING_WORLD_H - 1) ctx.rect(view.left, RACING_WORLD_H - 1, view.right - view.left, view.bottom - RACING_WORLD_H + 1);
  if (view.top < 1) ctx.rect(view.left, view.top, view.right - view.left, 1 - view.top);
  ctx.clip();
  const sides = view.left < 1 || view.right > RACING_WORLD_W - 1 || view.top < 1;
  drawWorld(ctx, state, L, { x0: view.left, x1: view.right, y1: view.bottom, beyond: true, y0: sides ? 0 : RACING_WORLD_H - 1 });
  ctx.restore();
}

/**
 * Apex's moving fill (display only; ArcadeArenaSlot's ambient, under the world canvas): the world's own view carried
 * on out to the screen's edges and bottom, so the road, its lines, the grass and the trackside run on past the world's
 * box with no seam. The slot calls it at most every 50 ms (once, under reduced motion or reduced effects); the world's
 * frames (drawRacingPlay) repaint the same layer every frame they draw, so it never lags the world. It is the world's
 * own view, not a decorative fill, so it moves exactly when the world does (under reduced motion too).
 */
export const racingAmbient: ArenaAmbient = {
  region: "all",
  draw(ctx, view) {
    beyond = { ctx, m: ctx.getTransform(), view, clipTop: Math.max(view.top, view.boxTop ?? 0) };
    lastBeyond = null;
    if (beyondState && !largeScreen) paintBeyond(ctx, view, beyondState);
    else racingSceneLooked(ctx, view, beyondLook);
  },
};

/** The world's frame repaints the layer beyond it with the same state (play screen only, while the layer is shown). */
function repaintBeyond(state: RacingState): void {
  beyondState = state;
  const b = beyond;
  if (!b || largeScreen) return;
  const canvas = b.ctx.canvas as HTMLCanvasElement;
  if (!canvas.isConnected) {
    beyond = null;
    beyondState = null;
    return;
  }
  const ctx = b.ctx;
  // Skip a frame that shows nothing new (the world is redrawn every display frame; the sim moves at 60 Hz).
  if (state === lastBeyond) return;
  // A slow device in reduced effects (lib/fx/lowEnd.ts) repaints it on every other sim tick.
  // A screen larger than any phone (the computer layout, 31 Oct 2026: 1920×1080 is 5× a phone's area, and the faded
  // view beyond the world cost Apex its 60 fps there) steps it less often; every phone (at most 430×932) is unchanged.
  const big = (b.view.right - b.view.left) * (b.view.bottom - b.view.top) * b.view.scale * b.view.scale > 500_000;
  if (arcadeReducedEffects() && state.tick % 2 === 1 && lastBeyond && state.tick - lastBeyond.tick < 2) return;
  // A large screen's faded side view: every third sim tick (20 Hz), the world itself every frame.
  if (big && lastBeyond && state.tick - lastBeyond.tick < 3 && state.tick >= lastBeyond.tick) return;
  lastBeyond = state;
  // No clear: the view paints every pixel round the world (sky, hills, fields, road) from the box's top down.
  ctx.save();
  ctx.setTransform(b.m);
  ctx.beginPath();
  ctx.rect(b.view.left, b.clipTop, b.view.right - b.view.left, b.view.bottom - b.clipTop);
  ctx.clip();
  paintBeyond(ctx, b.view, state);
  ctx.restore();
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

/**
 * The intro's still (the Sports overhaul, 15 Nov 2026): racingRev 4's chase view on Sunset Park with the rendered car
 * (the painted one until its images arrive; the stage repaints it once they have).
 */
export function paintRacingIntro(ctx: CanvasRenderingContext2D, size: number): void {
  ctx.save();
  const crop = 360;
  const s = size / crop;
  ctx.scale(s, s);
  ctx.translate(-(RACING_WORLD_W - crop) / 2, -(RACING_CAR_Y + 16 - crop));
  const state = { ...racingGameFor(RACING_REV_4).init(RACING_CIRCUITS.length * 7), s: RACING_SEG * 40, v: 2600, tick: 600 };
  const L = layersFor(Math.max(1, s * 2), racingSceneOf(state));
  drawWorld(ctx, state, L);
  ctx.restore();
}

/** The player's car alone in a look (checks: a paint stays inside the default car's outline). */
export function paintRacingCarIn(look: GameLook, ctx: Ctx2D, cx: number, bottom: number, w: number, braking: boolean): void {
  useLook(look);
  try {
    paintRacingCar(ctx, cx, bottom, w, braking);
  } finally {
    useLook(NO_LOOK);
  }
}
