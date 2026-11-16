/**
 * Orbit's rendered-look planets and the road to the sun (the Action overhaul, 15 Nov 2026; display only, no stamp; drawn
 * on the expansion's view, orbitRev 12–16). Concept A's look (docs/design/game-concepts/action.md "Orbit") made in
 * canvas: each planet is a sphere-shaded disc whose surface (banded gas, cratered rock or streaked ice, in the planet's
 * own seeded colour) turns slowly under a fixed light, with a thin lit limb on the sunward side. Nothing reaches past the
 * planet's collision circle (the bounds rule); the soft atmosphere outside it stays the glow layer's.
 *
 * Every surface is baked once per (planet look, radius) at twice the world's resolution and scrolled under a cached
 * shading disc: three drawImage calls a planet a frame. The turn is a function of the round tick (the same frame on every
 * device), and stands still under reduced motion.
 *
 * The setting: as the run climbs the course, the sun's warmth grows from the top of the view (orbitSunWarmth: 0 at the
 * start, 1 at planet 40), a low gradient that never washes over the play (minimal glow, no glare).
 */
import { arcadeReducedEffects } from "@/lib/fx/lowEnd";
import { ORBIT_TOTAL } from "./orbit";
import { ORBIT_PLANET_MAPS } from "./orbitPlanetMaps.data";

/** The look a planet is drawn with (orbit.renderer.ts planetLook). */
export interface OrbitPlanetLook {
  type: number;
  colour: string;
  ring: boolean;
  tilt: number;
  h: number;
}

/** Baked surfaces are this many times the world's resolution (crisp on 2× and 3× screens). */
const BAKE = 2;
/** The surface strip's width in planet radii: one full turn of the planet slides it this far. */
const STRIP_R = 4;

const surfaceCache = new Map<string, HTMLCanvasElement | null>();
const shadeCache = new Map<string, HTMLCanvasElement | null>();

function rgbOf(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
/** Mixes a #RRGGBB colour towards white (amt > 0) or black (amt < 0). */
function mix(hex: string, amt: number, alpha = 1): string {
  const [r, g, b] = rgbOf(hex);
  const to = amt > 0 ? 255 : 0;
  const k = Math.abs(amt);
  const ch = (v: number) => Math.round(v + (to - v) * k);
  return `rgba(${ch(r)},${ch(g)},${ch(b)},${alpha})`;
}
/** A small integer hash of the look's seed and a salt (0–2^32). */
function hh(h: number, salt: number): number {
  let x = Math.imul(h ^ Math.imul(salt + 0x9e37, 0x85ebca6b), 0xc2b2ae35) >>> 0;
  x ^= x >>> 15;
  return Math.imul(x, 0x27d4eb2f) >>> 0;
}
const unit = (h: number, salt: number) => hh(h, salt) / 4294967296;

function makeCanvas(w: number, h: number): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

/** Draws `fn` at x and again a strip-width either side, so features wrap seamlessly. */
function wrapped(W: number, x: number, fn: (x: number) => void): void {
  fn(x);
  fn(x - W);
  fn(x + W);
}

/**
 * The planet's surface strip: STRIP_R × r wide, 2r tall, in world units × BAKE, seamless left to right. Gas giants get
 * wavy bands and a storm eye; rocky worlds lowlands, ridges and rimmed craters; icy worlds pale plains, cracks and caps.
 */
function planetSurface(look: OrbitPlanetLook, r: number): HTMLCanvasElement | null {
  const key = `${look.h}:${look.type}:${look.colour}:${Math.round(r * 4)}`;
  if (surfaceCache.has(key)) return surfaceCache.get(key)!;
  const W = STRIP_R * r * BAKE;
  const H = 2 * r * BAKE;
  const canvas = makeCanvas(W, H);
  const c = canvas?.getContext("2d") ?? null;
  if (!canvas || !c) {
    surfaceCache.set(key, null);
    return null;
  }
  const R = r * BAKE;
  const base = look.type === 2 ? mix(look.colour, 0.3) : look.colour;
  c.fillStyle = base;
  c.fillRect(0, 0, W, H);
  if (look.type === 1) {
    // Gas giant: 9 bands of alternating light and dark, each a gentle wave seamless over the strip.
    const bands = 9;
    for (let b = 0; b < bands; b++) {
      const y0 = (b / bands) * H;
      const bh = H / bands;
      const dark = b % 2 === 1;
      c.fillStyle = dark ? mix(look.colour, -0.38, 0.55) : mix(look.colour, 0.42, 0.42);
      const amp = bh * (0.18 + unit(look.h, b) * 0.22);
      const waves = 1 + (hh(look.h, b + 20) % 3);
      c.beginPath();
      c.moveTo(0, y0);
      for (let k = 0; k <= 48; k++) {
        const x = (k / 48) * W;
        c.lineTo(x, y0 + Math.sin((k / 48) * Math.PI * 2 * waves + b) * amp);
      }
      for (let k = 48; k >= 0; k--) {
        const x = (k / 48) * W;
        c.lineTo(x, y0 + bh + Math.sin((k / 48) * Math.PI * 2 * waves + b + 1.3) * amp);
      }
      c.closePath();
      c.fill();
    }
    // Thin bright streaks along a few band edges.
    c.strokeStyle = mix(look.colour, 0.7, 0.25);
    c.lineWidth = Math.max(1, R * 0.03);
    for (let s = 0; s < 4; s++) {
      const y = (0.15 + unit(look.h, 40 + s) * 0.7) * H;
      c.beginPath();
      c.moveTo(0, y);
      for (let k = 0; k <= 32; k++) c.lineTo((k / 32) * W, y + Math.sin((k / 32) * Math.PI * 4 + s) * R * 0.04);
      c.stroke();
    }
    // A storm eye.
    const sx = unit(look.h, 60) * W;
    const sy = (0.55 + unit(look.h, 61) * 0.2) * H;
    wrapped(W, sx, (x) => {
      c.fillStyle = mix(look.colour, -0.45, 0.6);
      c.beginPath();
      c.ellipse(x, sy, R * 0.32, R * 0.15, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = mix(look.colour, 0.55, 0.6);
      c.beginPath();
      c.ellipse(x, sy, R * 0.18, R * 0.07, 0, 0, Math.PI * 2);
      c.fill();
    });
  } else if (look.type === 0) {
    // Rocky: dark lowlands, a few light ridges, then rimmed craters.
    for (let k = 0; k < 7; k++) {
      const x = unit(look.h, k) * W;
      const y = (0.12 + unit(look.h, k + 10) * 0.76) * H;
      const rw = R * (0.35 + unit(look.h, k + 20) * 0.45);
      wrapped(W, x, (xx) => {
        c.fillStyle = mix(look.colour, -0.42, 0.42);
        c.beginPath();
        c.ellipse(xx, y, rw, rw * 0.55, unit(look.h, k + 30) * Math.PI, 0, Math.PI * 2);
        c.fill();
      });
    }
    c.strokeStyle = mix(look.colour, 0.4, 0.3);
    c.lineWidth = Math.max(1, R * 0.035);
    for (let k = 0; k < 3; k++) {
      const x = unit(look.h, 50 + k) * W;
      const y = (0.2 + unit(look.h, 55 + k) * 0.6) * H;
      wrapped(W, x, (xx) => {
        c.beginPath();
        c.moveTo(xx - R * 0.5, y);
        c.quadraticCurveTo(xx, y - R * 0.18, xx + R * 0.55, y + R * 0.06);
        c.stroke();
      });
    }
    for (let k = 0; k < 11; k++) {
      const x = unit(look.h, 70 + k) * W;
      const y = (0.1 + unit(look.h, 90 + k) * 0.8) * H;
      const cr = R * (0.07 + unit(look.h, 110 + k) * 0.14);
      wrapped(W, x, (xx) => {
        c.fillStyle = "rgba(0,0,0,0.32)";
        c.beginPath();
        c.arc(xx, y, cr, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = "rgba(255,255,255,0.22)";
        c.lineWidth = Math.max(1, cr * 0.28);
        c.beginPath();
        c.arc(xx, y, cr, Math.PI * 0.95, Math.PI * 1.75);
        c.stroke();
      });
    }
  } else {
    // Icy: pale plains in the planet's tint, blue-white cracks, frost at both poles.
    c.strokeStyle = mix(look.colour, -0.25, 0.4);
    c.lineWidth = Math.max(1, R * 0.03);
    for (let k = 0; k < 9; k++) {
      const x = unit(look.h, k) * W;
      const y = (0.15 + unit(look.h, k + 10) * 0.7) * H;
      const len = R * (0.4 + unit(look.h, k + 20) * 0.6);
      const ang = (unit(look.h, k + 30) - 0.5) * 1.4;
      wrapped(W, x, (xx) => {
        c.beginPath();
        c.moveTo(xx, y);
        c.lineTo(xx + Math.cos(ang) * len * 0.5, y + Math.sin(ang) * len * 0.5 + R * 0.05);
        c.lineTo(xx + Math.cos(ang) * len, y + Math.sin(ang) * len);
        c.stroke();
      });
    }
    const cap = c.createLinearGradient(0, 0, 0, H);
    cap.addColorStop(0, "rgba(255,255,255,0.75)");
    cap.addColorStop(0.16, "rgba(255,255,255,0)");
    cap.addColorStop(0.84, "rgba(255,255,255,0)");
    cap.addColorStop(1, "rgba(255,255,255,0.6)");
    c.fillStyle = cap;
    c.fillRect(0, 0, W, H);
  }
  surfaceCache.set(key, canvas);
  return canvas;
}

/**
 * The sphere's shading for a disc of radius r (world units × BAKE): the lit upper left, a soft terminator, the night side
 * and a thin lit limb in the planet's colour, all inside the disc.
 */
function planetShade(colour: string, r: number): HTMLCanvasElement | null {
  const key = `${colour}:${Math.round(r * 4)}`;
  if (shadeCache.has(key)) return shadeCache.get(key)!;
  const R = r * BAKE;
  const canvas = makeCanvas(2 * R, 2 * R);
  const c = canvas?.getContext("2d") ?? null;
  if (!canvas || !c) {
    shadeCache.set(key, null);
    return null;
  }
  c.beginPath();
  c.arc(R, R, R, 0, Math.PI * 2);
  c.clip();
  // The day side's sheen and the night side.
  const shade = c.createRadialGradient(R * 0.62, R * 0.55, R * 0.08, R, R, R * 1.06);
  shade.addColorStop(0, "rgba(255,255,255,0.42)");
  shade.addColorStop(0.28, "rgba(255,255,255,0.08)");
  shade.addColorStop(0.55, "rgba(0,0,0,0.1)");
  shade.addColorStop(0.82, "rgba(0,0,0,0.58)");
  shade.addColorStop(1, "rgba(0,0,0,0.9)");
  c.fillStyle = shade;
  c.fillRect(0, 0, 2 * R, 2 * R);
  // Limb darkening all round, so the disc reads as a ball.
  const limb = c.createRadialGradient(R, R, R * 0.72, R, R, R);
  limb.addColorStop(0, "rgba(0,0,0,0)");
  limb.addColorStop(1, "rgba(0,0,0,0.35)");
  c.fillStyle = limb;
  c.fillRect(0, 0, 2 * R, 2 * R);
  // The lit limb: a thin crescent of the planet's own colour on the sunward edge.
  c.strokeStyle = mix(colour, 0.65, 0.7);
  c.lineWidth = Math.max(1.5, R * 0.07);
  c.beginPath();
  c.arc(R, R, R - c.lineWidth / 2, Math.PI * 0.82, Math.PI * 1.68);
  c.stroke();
  shadeCache.set(key, canvas);
  return canvas;
}

/** The planet's turn (0–1 of its strip) at this round time: slow, seeded per planet, still under reduced motion. */
export function orbitPlanetTurn(look: OrbitPlanetLook, t: number): number {
  // One turn in 40–80 s, left or right.
  const period = 40 + (hh(look.h, 7) % 41);
  const dir = hh(look.h, 8) & 1 ? 1 : -1;
  const f = (t / period) * dir;
  return f - Math.floor(f);
}

/**
 * A ringed planet's ring (stage 2): a band of three touching ringlets (bright inner, a darker middle reading as the gap, outer) across
 * the disc at its tilt, its far half faint, the near half casting a thin shadow on the globe below it. Drawn after the
 * planet; every stroke stays inside the collision circle (the outer ringlet's outer edge at 0.88 r).
 */
export function drawPlanetRing(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, look: OrbitPlanetLook): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(x, y);
  ctx.rotate(look.tilt);
  const ry = 0.3;
  const [cr, cg, cb] = rgbOf(look.colour);
  // The ring's ice: cream, faintly in the planet's colour.
  const tone = (k: number, a: number) => `rgba(${Math.round(236 + (cr - 236) * k)},${Math.round(226 + (cg - 226) * k)},${Math.round(204 + (cb - 204) * k)},${a})`;
  const lw = Math.max(0.8, r * 0.095);
  const ringlets: [number, number, number][] = [
    // [radius as a share of r, tint towards the planet's colour, alpha on the near half]: touching bands, a darker middle
    // one reading as the gap.
    [0.62, 0.1, 0.9],
    [0.72, 0.45, 0.5],
    [0.83, 0.2, 0.78],
  ];
  // The shadow the near half casts on the globe, just below it.
  ctx.strokeStyle = "rgba(0,0,0,0.32)";
  ctx.lineWidth = lw * 2.6;
  ctx.beginPath();
  ctx.ellipse(0, r * 0.11, r * 0.72, r * ry * 0.72, 0, 0.2, Math.PI - 0.2);
  ctx.stroke();
  // The sun is at the upper left: the ring is lit on that side and falls into the planet's shade on the other.
  const shade = ctx.createLinearGradient(-r, 0, r, 0);
  shade.addColorStop(0, "rgba(255,255,255,0.18)");
  shade.addColorStop(0.55, "rgba(0,0,0,0)");
  shade.addColorStop(1, "rgba(0,0,0,0.55)");
  for (const back of [true, false]) {
    for (const [k, tint, a] of ringlets) {
      for (const style of [tone(tint, back ? a * 0.28 : a), shade]) {
        ctx.strokeStyle = style;
        ctx.lineWidth = lw;
        ctx.beginPath();
        ctx.ellipse(0, 0, r * k, r * k * ry, 0, back ? Math.PI : 0, back ? Math.PI * 2 : Math.PI);
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

/**
 * Draws one planet disc of radius r at (x, y) with its surface turned to `turn` (0–1). Returns false when no canvas is
 * available (the caller then draws its flat fallback).
 */
export function drawRenderedPlanet(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, look: OrbitPlanetLook, turn: number): boolean {
  // The materials pass: a sphere projected from its surface map, once the map has loaded; the strip look until then.
  const sphere = planetSphereFrame(ctx, look, r, turn);
  if (sphere) {
    ctx.drawImage(sphere, x - r, y - r, 2 * r, 2 * r);
    return true;
  }
  return drawStripPlanet(ctx, x, y, r, look, turn);
}

/* ===================== Blender-rendered spheres (the stage-2 look pass, 15 Nov 2026) ===================== */
/*
 * Joe's stage-2 note: Blender-rendered planets with real surface detail, drawn at a good size, turning slowly, as in
 * concept A (banded gas giants and rocky worlds with atmosphere rims, a lit side and a shadow side). Each world's surface
 * is a procedural Blender material baked by Cycles into an equirectangular map (public/orbit/planets,
 * scripts/orbit-planets-blender.py): two banded gas giants, a marbled world and a cratered moon as tone maps tinted with
 * the planet's seeded colour, a rust desert, a volcanic world, an ocean world and two icy worlds in their own colours.
 * Rocks and ice ship a height map too. The renderer projects the map onto a sphere (bilinear), turns it with the round
 * clock, and lights it from one sun at the upper left: a soft terminator into a deep night side (never black), the
 * height map's relief (craters, canyons, ridges) catching that light, a crisp highlight on water and ice, and a thin
 * atmosphere rim inside the disc in the planet's own colour, so the world still matches its orbit line. Nothing is drawn
 * past the collision circle and there is no glow halo.
 *
 * Each frame is baked once at the canvas's own device scale (crisp at 2x and 3x and on the desktop column) from a
 * per-size table of the sphere's geometry, and kept in a small bounded cache: one drawImage a planet a frame.
 */
type MapName = keyof typeof ORBIT_PLANET_MAPS;
export interface OrbitMapPixels {
  w: number;
  h: number;
  data: Uint8ClampedArray;
}
type MapKey = MapName | `${MapName}-h`;
const mapStore = new Map<MapKey, OrbitMapPixels | "loading" | "failed">();
/** Frames a full turn (1.5° a frame: a point at the disc's centre steps about 2 device px at the largest size). */
export const SPHERE_FRAMES = 240;
/** Frames a turn on a slow device (lib/fx/lowEnd's reduced effects): half the bakes. */
export const SPHERE_FRAMES_LITE = 120;
/** The largest baked disc, in device px (a radius-28 planet on the 640-wide desktop column at 2x is 159; orbitRev 16's
 * radius-39 planet 222, stage 3, 15 Nov 2026). */
export const SPHERE_MAX_PX = 224;
/** Baked frames kept: the visible planets' current frames and a few spare. */
const SPHERE_CACHE_MAX = 48;
const sphereCache = new Map<string, HTMLCanvasElement>();

/** Hands the renderer a decoded map (`name`, or `name-h` for its height map): the review-frame tool and checks. */
export function setOrbitPlanetMap(name: MapKey, pixels: OrbitMapPixels): void {
  mapStore.set(name, pixels);
}

/**
 * Starts loading every planet map and height map (stage 2): called once when Orbit's game chunk loads in a browser
 * (src/puzzles/orbit.tsx), so the maps arrive during the intro and the first frame of play draws the Blender planets.
 * Does nothing outside a browser (a server render leaves the maps to the page).
 */
export function preloadOrbitPlanetMaps(): void {
  if (typeof window === "undefined" || typeof Image === "undefined" || typeof document === "undefined") return;
  for (const name of Object.keys(ORBIT_PLANET_MAPS) as MapName[]) {
    const m = ORBIT_PLANET_MAPS[name];
    loadMap(name, m.url);
    if (m.height) loadMap(`${name}-h`, m.height);
  }
}

function loadMap(key: MapKey, url: string): OrbitMapPixels | null {
  const got = mapStore.get(key);
  if (got && got !== "loading" && got !== "failed") return got;
  if (got) return null;
  if (typeof Image === "undefined" || typeof document === "undefined") {
    mapStore.set(key, "failed");
    return null;
  }
  mapStore.set(key, "loading");
  const img = new Image();
  img.decoding = "async";
  img.onload = () => {
    const c = document.createElement("canvas");
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const g = c.getContext("2d", { willReadFrequently: true });
    if (!g) return void mapStore.set(key, "failed");
    g.drawImage(img, 0, 0);
    mapStore.set(key, { w: c.width, h: c.height, data: g.getImageData(0, 0, c.width, c.height).data });
  };
  img.onerror = () => mapStore.set(key, "failed");
  img.src = url;
  return null;
}

/**
 * Which map a planet wears, chosen so its surface reads with its seeded colour (the colour stays the planet's identity:
 * its orbit line and atmosphere rim). Gas giants: one of two band patterns, tinted. Icy worlds: one of two icy maps in
 * their own blue-white (never tinted, so an icy world never turns pink; its rim carries the colour). Rocky worlds: red and
 * orange are a rust desert or (one in three) a volcanic world, brown a desert, blue an ocean world, green and pink a
 * marbled world, purple and yellow a cratered moon (the last two tinted).
 */
export function orbitPlanetMapFor(look: OrbitPlanetLook): MapName {
  if (look.type === 1) return (look.h >>> 5) & 1 ? "gas-a" : "gas-b";
  if (look.type === 2) return (look.h >>> 6) & 1 ? "ice-a" : "ice-b";
  switch (look.colour.toUpperCase()) {
    case "#FF4D4D":
    case "#FF8A3D":
      return look.h % 3 === 0 ? "lava" : "desert";
    case "#8B5A2B":
      return "desert";
    case "#4D8CFF":
      return "terran";
    case "#3DDC84":
    case "#FF6BD6":
      return "marble";
    default:
      return "moon";
  }
}

/** The canvas's world-to-device scale (its transform's x scale), or 2 where it can't be read. */
function deviceScale(ctx: CanvasRenderingContext2D): number {
  try {
    const m = ctx.getTransform();
    const s = Math.hypot(m.a, m.b);
    return Number.isFinite(s) && s > 0 ? s : 2;
  } catch {
    return 2;
  }
}

/** Reduced effects (a slow device or battery saver), read safely where there is no full document (tools, checks). */
function liteDevice(): boolean {
  try {
    return arcadeReducedEffects();
  } catch {
    return false;
  }
}

function planetSphereFrame(ctx: CanvasRenderingContext2D, look: OrbitPlanetLook, r: number, turn: number): HTMLCanvasElement | null {
  if (typeof document === "undefined" || r <= 0) return null;
  const name = orbitPlanetMapFor(look);
  const spec = ORBIT_PLANET_MAPS[name];
  const map = loadMap(name, spec.url);
  if (!map) return null;
  // The height map is optional: until it arrives (or if it fails) the surface draws without relief.
  const height = spec.height ? loadMap(`${name}-h`, spec.height) : null;
  const S = Math.max(4, Math.min(SPHERE_MAX_PX, Math.ceil(2 * r * deviceScale(ctx))));
  const frames = liteDevice() ? SPHERE_FRAMES_LITE : SPHERE_FRAMES;
  const frame = ((Math.floor(turn * frames) % frames) + frames) % frames;
  const key = `${look.h}:${look.colour}:${S}:${frames}:${frame}:${height ? 1 : 0}`;
  const hit = sphereCache.get(key);
  if (hit) {
    sphereCache.delete(key);
    sphereCache.set(key, hit);
    return hit;
  }
  const canvas = bakeSphere(map, height, name, look, S, frame / frames);
  if (!canvas) return null;
  sphereCache.set(key, canvas);
  if (sphereCache.size > SPHERE_CACHE_MAX) sphereCache.delete(sphereCache.keys().next().value!);
  return canvas;
}

/** The light: from the upper left and a little towards the viewer (screen y down). */
const LX = -0.56, LY = -0.6, LZ = 0.57;
const LN = Math.hypot(LX, LY, LZ);
const LIGHT = [LX / LN, LY / LN, LZ / LN] as const;
/** The half vector between the light and the viewer, for the highlight. */
const HN = Math.hypot(LIGHT[0], LIGHT[1], LIGHT[2] + 1);
const HALF = [LIGHT[0] / HN, LIGHT[1] / HN, (LIGHT[2] + 1) / HN] as const;

/**
 * The sphere's geometry for a disc of S device px at an axial tilt: per pixel its coverage (anti-aliased edge), the map
 * longitude (0–1, before the turn) and row, the light terms and, for the relief, how the light falls along the surface's
 * east and north directions. Kept per (S, tilt); the turn only shifts the longitude.
 */
interface SphereTable {
  n: number;
  idx: Int32Array;
  cover: Float32Array;
  u: Float32Array;
  v: Float32Array;
  dot: Float32Array;
  rim: Float32Array;
  ndh: Float32Array;
  eL: Float32Array;
  nL: Float32Array;
  invCos: Float32Array;
}
const tableCache = new Map<string, SphereTable>();

function sphereTable(S: number, tilt: number): SphereTable {
  const key = `${S}:${tilt.toFixed(4)}`;
  const hit = tableCache.get(key);
  if (hit) return hit;
  const R = S / 2;
  const ct = Math.cos(tilt), st = Math.sin(tilt);
  const cap = S * S;
  const idx = new Int32Array(cap), cover = new Float32Array(cap), u = new Float32Array(cap), v = new Float32Array(cap);
  const dot = new Float32Array(cap), rim = new Float32Array(cap), ndh = new Float32Array(cap);
  const eL = new Float32Array(cap), nL = new Float32Array(cap), invCos = new Float32Array(cap);
  let n = 0;
  for (let py = 0; py < S; py++) {
    for (let px = 0; px < S; px++) {
      const x = (px + 0.5 - R) / R;
      const y = (py + 0.5 - R) / R;
      const d2 = x * x + y * y;
      const c = Math.max(0, Math.min(1, (1 - Math.sqrt(d2)) * R + 0.5));
      if (c <= 0) continue;
      const z = Math.sqrt(Math.max(0, 1 - Math.min(1, d2)));
      // Into the planet's own frame (its axis leans by `tilt` in the screen plane).
      const tx = x * ct + y * st;
      const ty = -x * st + y * ct;
      const lon = Math.atan2(tx, z);
      const lat = Math.asin(Math.max(-1, Math.min(1, ty)));
      const cl = Math.cos(lat);
      // East (increasing longitude) and north (decreasing ty, the map's row 0) on the surface, in the planet's frame.
      const ex = Math.cos(lon), ez = -Math.sin(lon);
      const nx = Math.sin(lon) * ty, ny = -cl, nz = Math.cos(lon) * ty;
      // Back to screen space (the inverse of the tilt above).
      const esx = ex * ct, esy = ex * st;
      const nsx = nx * ct - ny * st, nsy = nx * st + ny * ct;
      const dt = x * LIGHT[0] + y * LIGHT[1] + z * LIGHT[2];
      idx[n] = py * S + px;
      cover[n] = c;
      u[n] = lon / (Math.PI * 2);
      v[n] = lat / Math.PI + 0.5;
      dot[n] = dt;
      // The rim: a thin band just inside the edge, lit on the day side, a fainter back-lit edge on the night side.
      rim[n] = Math.pow(1 - z, 3.2) * Math.max(0, Math.min(1, dt + 0.5)) + Math.pow(1 - z, 6) * 0.25;
      ndh[n] = Math.max(0, x * HALF[0] + y * HALF[1] + z * HALF[2]);
      eL[n] = esx * LIGHT[0] + esy * LIGHT[1] + ez * LIGHT[2];
      nL[n] = nsx * LIGHT[0] + nsy * LIGHT[1] + nz * LIGHT[2];
      invCos[n] = 1 / Math.max(0.2, cl);
      n++;
    }
  }
  const t: SphereTable = { n, idx, cover, u, v, dot, rim, ndh, eL, nL, invCos };
  tableCache.set(key, t);
  if (tableCache.size > 24) tableCache.delete(tableCache.keys().next().value!);
  return t;
}

/** The tone maps' tint: the map's grey through a dark shade, the planet's colour, then a pale one. */
function toneRamp(colour: string, gas: boolean, desaturate: number): Float32Array {
  const [r0, g0, b0] = rgbOf(colour);
  // A rocky moon takes its colour as a dusting, not a coat of paint: towards its own grey by `desaturate`.
  const grey = 0.3 * r0 + 0.59 * g0 + 0.11 * b0;
  const cr = r0 + (grey - r0) * desaturate, cg = g0 + (grey - g0) * desaturate, cb = b0 + (grey - b0) * desaturate;
  const lut = new Float32Array(256 * 3);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let r: number, g: number, b: number;
    if (t < 0.5) {
      const k = t / 0.5;
      // The darks lean a little cooler, so belts read as depth rather than dirt.
      r = cr * (0.16 + 0.84 * k);
      g = cg * (0.16 + 0.84 * k);
      b = cb * (0.22 + 0.78 * k);
    } else {
      const k = (t - 0.5) / 0.5;
      // Gas giants' zones go towards cream, the rest towards a pale version of their colour.
      const w = gas ? 0.62 : 0.5;
      r = cr + ((gas ? 250 : 255) - cr) * k * w;
      g = cg + ((gas ? 240 : 255) - cg) * k * w;
      b = cb + ((gas ? 222 : 255) - cb) * k * w;
    }
    lut[i * 3] = r;
    lut[i * 3 + 1] = g;
    lut[i * 3 + 2] = b;
  }
  return lut;
}

/** The height map at (u, v), bilinear (longitude wraps, latitude clamps), 0–255. */
function heightAt(m: OrbitMapPixels, u: number, v: number): number {
  const fx = (u - Math.floor(u)) * m.w - 0.5;
  const fy = Math.min(m.h - 1, Math.max(0, v * m.h - 0.5));
  const x0 = Math.floor(fx), y0 = Math.floor(fy);
  const ax = fx - x0, ay = fy - y0;
  const xa = ((x0 % m.w) + m.w) % m.w, xb = (xa + 1) % m.w;
  const yb = Math.min(m.h - 1, y0 + 1);
  const d = m.data;
  const top = d[(y0 * m.w + xa) * 4]! * (1 - ax) + d[(y0 * m.w + xb) * 4]! * ax;
  const bot = d[(yb * m.w + xa) * 4]! * (1 - ax) + d[(yb * m.w + xb) * 4]! * ax;
  return top * (1 - ay) + bot * ay;
}

/**
 * The icy worlds' cold cast from the seeded colour: blue, green and purple seeds give a blue, teal or lilac ice; the warm
 * seeds (red, pink, orange, brown, yellow) keep the ice's own pale blue, so an icy world never turns pink or orange.
 */
export function orbitIceCast(colour: string): [number, number, number] | null {
  switch (colour.toUpperCase()) {
    case "#4D8CFF":
      return [150, 190, 255];
    case "#3DDC84":
      return [140, 230, 205];
    case "#B26BFF":
      return [190, 170, 255];
    default:
      return null;
  }
}

function bakeSphere(map: OrbitMapPixels, height: OrbitMapPixels | null, name: MapName, look: OrbitPlanetLook, S: number, turn: number): HTMLCanvasElement | null {
  const c = makeCanvas(S, S);
  const g = c?.getContext("2d") ?? null;
  if (!c || !g) return null;
  const T = sphereTable(S, look.tilt * 0.35);
  const img = g.createImageData(S, S);
  const out = img.data;
  const kind = ORBIT_PLANET_MAPS[name].kind;
  const gasy = name === "gas-a" || name === "gas-b";
  const icy = name === "ice-a" || name === "ice-b";
  const ocean = name === "terran";
  const lava = name === "lava";
  const ramp = kind === "tone" ? toneRamp(look.colour, gasy, name === "moon" ? 0.45 : 0) : null;
  const cast = icy ? orbitIceCast(look.colour) : null;
  const [cr, cg, cb] = rgbOf(look.colour);
  // The atmosphere rim's colour: the planet's own, lifted towards white (less on ice, whose surface keeps its own
  // colours, so the rim is what ties an icy world to its orbit line).
  const lift = icy ? 0.3 : 0.55;
  const ar = cr + (255 - cr) * lift, ag = cg + (255 - cg) * lift, ab = cb + (255 - cb) * (lift + 0.05);
  const rimK = gasy ? 0.75 : 0.9;
  const mw = map.w, mh = map.h, md = map.data;
  // Relief strength: how far the height map tilts the surface towards or away from the sun.
  const bumpK = name === "moon" ? 5 : name === "marble" ? 1.4 : ocean ? 3.2 : icy ? 2.2 : 4.2;
  for (let k = 0; k < T.n; k++) {
    let u = T.u[k]! + turn;
    u -= Math.floor(u);
    const v = T.v[k]!;
    // Bilinear sample of the colour map (longitude wraps, latitude clamps).
    const fx = u * mw - 0.5, fy = Math.min(mh - 1, Math.max(0, v * mh - 0.5));
    const x0 = Math.floor(fx), y0 = Math.floor(fy);
    const ax = fx - x0, ay = fy - y0;
    const xa = ((x0 % mw) + mw) % mw, xb = (xa + 1) % mw;
    const ya = y0, yb = Math.min(mh - 1, y0 + 1);
    const i00 = (ya * mw + xa) * 4, i10 = (ya * mw + xb) * 4, i01 = (yb * mw + xa) * 4, i11 = (yb * mw + xb) * 4;
    const w00 = (1 - ax) * (1 - ay), w10 = ax * (1 - ay), w01 = (1 - ax) * ay, w11 = ax * ay;
    let br: number, bg: number, bb: number;
    if (ramp) {
      const l = Math.round(md[i00]! * w00 + md[i10]! * w10 + md[i01]! * w01 + md[i11]! * w11);
      br = ramp[l * 3]!;
      bg = ramp[l * 3 + 1]!;
      bb = ramp[l * 3 + 2]!;
    } else {
      br = md[i00]! * w00 + md[i10]! * w10 + md[i01]! * w01 + md[i11]! * w11;
      bg = md[i00 + 1]! * w00 + md[i10 + 1]! * w10 + md[i01 + 1]! * w01 + md[i11 + 1]! * w11;
      bb = md[i00 + 2]! * w00 + md[i10 + 2]! * w10 + md[i01 + 2]! * w01 + md[i11 + 2]! * w11;
      if (cast) {
        // The cold cast: strongest in the cracks and frozen seas, the bright plains staying nearly white.
        const k = 0.25 + 0.55 * (1 - (br + bg + bb) / 765);
        br += (br * cast[0] / 255 - br) * k * 1.6;
        bg += (bg * cast[1] / 255 - bg) * k * 1.6;
        bb += (bb * cast[2] / 255 - bb) * k * 1.6;
      }
    }
    // The relief: the height map's slope east and north tilts the surface normal.
    let dot = T.dot[k]!;
    if (height) {
      const hw = height.w, hh = height.h;
      // Central differences of the bilinear height, a texel either side (smooth, no stair-steps at the terminator).
      const hu = 1 / hw, hv = 1 / hh;
      const e = heightAt(height, u + hu, v) - heightAt(height, u - hu, v);
      const nn = heightAt(height, u, v - hv) - heightAt(height, u, v + hv);
      // Slopes per unit angle: a map step is 2π / hw east (wider in angle towards the poles) and π / hh north.
      const se = (e / 255) * (hw / (4 * Math.PI)) * T.invCos[k]! * 0.02 * bumpK;
      const sn = (nn / 255) * (hh / (2 * Math.PI)) * 0.02 * bumpK;
      dot = dot - se * T.eL[k]! - sn * T.nL[k]!;
    }
    // Diffuse light with a soft terminator into a deep night side (never black).
    const lit = dot <= -0.1 ? 0 : dot >= 0.32 ? 1 : ((dot + 0.1) / 0.42) ** 1.5;
    const diffuse = 0.05 + 1.05 * lit * (0.5 + 0.5 * Math.max(0, dot));
    let rr = br * diffuse, gg = bg * diffuse, b2 = bb * diffuse;
    // Lava's fissures are hot: they keep a dull light of their own on the night side (inside the disc, never past it).
    if (lava) {
      const hot = Math.max(0, br - bg - 70) / 185;
      rr += br * hot * 0.5 * (1 - lit);
      gg += bg * hot * 0.35 * (1 - lit);
    }
    // The atmosphere rim: thin, in the planet's own colour, inside the edge.
    const rim = T.rim[k]! * rimK;
    rr += (ar - rr) * rim;
    gg += (ag - gg) * rim;
    b2 += (ab - b2) * rim;
    // The highlight: crisp on water and ice, a broad faint sheen on gas, almost none on rock.
    const ndh = T.ndh[k]!;
    const wet = ocean ? (bb > bg + 18 && bb > br + 30 ? 1 : 0.1) : icy ? 0.55 : 0;
    const spec = (wet ? Math.pow(ndh, 60) * 0.9 * wet : gasy ? Math.pow(ndh, 14) * 0.1 : Math.pow(ndh, 30) * 0.06) * lit;
    rr += (255 - rr) * spec;
    gg += (255 - gg) * spec;
    b2 += (255 - b2) * spec;
    const o = T.idx[k]! * 4;
    out[o] = rr;
    out[o + 1] = gg;
    out[o + 2] = b2;
    out[o + 3] = T.cover[k]! * 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}

/** The strip look (before the materials pass), kept while a map loads. */
function drawStripPlanet(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, look: OrbitPlanetLook, turn: number): boolean {
  const surface = planetSurface(look, r);
  const shade = planetShade(look.colour, r);
  if (!surface || !shade) return false;
  const W = STRIP_R * r;
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();
  // The planet's axis leans with its seeded tilt (a third of the ring's), so bands and caps sit at an angle.
  ctx.translate(x, y);
  ctx.rotate(look.tilt * 0.35);
  const sx = -r - turn * W;
  ctx.drawImage(surface, sx, -r, W, 2 * r);
  ctx.drawImage(surface, sx + W, -r, W, 2 * r);
  ctx.rotate(-look.tilt * 0.35);
  ctx.drawImage(shade, -r, -r, 2 * r, 2 * r);
  ctx.restore();
  return true;
}

/** The sun's warmth over the view, 0 at the start of the course and 1 at the last planet before the sun. */
export function orbitSunWarmth(best: number): number {
  return Math.max(0, Math.min(1, best / (ORBIT_TOTAL - 1)));
}

/** The warmth dome's strength (0–1 of its centre's) at view point (x, y): what drawSunWarmth paints there. */
/** The warmth dome's centre height and vertical radius (view px) at warmth k. */
function warmthDome(k: number, h: number): { cy: number; ry: number } {
  return { cy: -h * 0.08, ry: h * (0.32 + 0.38 * k) };
}

/** The warmth dome's strength (0–1 of its centre's) at view point (x, y): what drawSunWarmth paints there. */
export function orbitSunWarmthAt(best: number, x: number, y: number, w: number, h: number): number {
  const k = orbitSunWarmth(best);
  if (k <= 0) return 0;
  const { cy, ry } = warmthDome(k, h);
  const d = Math.hypot((x - w / 2) / (w / 2), (y - cy) / ry);
  return d >= 1 ? 0 : k * (1 - d);
}

/**
 * The setting: the sun's warmth rising from the top of the view as the course climbs (a low radial gradient, at most 0.26
 * strong, drawn over the starfield and under the play). Nothing at the start.
 */
export function drawSunWarmth(ctx: CanvasRenderingContext2D, best: number, w: number, h: number): void {
  const k = orbitSunWarmth(best);
  if (k <= 0) return;
  const { cy, ry } = warmthDome(k, h);
  // An ellipse hung from the top: as wide as the world (so it is 0 along both sides) and reaching (at most) two
  // thirds of the way down, so the warmth is 0 wherever the world meets the screen's fill (edge to edge).
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  g.addColorStop(0, `rgba(255,190,96,${(0.3 * k).toFixed(3)})`);
  g.addColorStop(0.5, `rgba(255,140,60,${(0.12 * k).toFixed(3)})`);
  g.addColorStop(1, "rgba(255,120,40,0)");
  ctx.save();
  ctx.translate(w / 2, cy);
  ctx.scale(w / 2, ry);
  ctx.fillStyle = g;
  ctx.fillRect(-1, -cy / ry, 2, 1 + cy / ry);
  ctx.restore();
}
