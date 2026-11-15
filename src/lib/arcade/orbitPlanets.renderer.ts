/**
 * Orbit's rendered-look planets and the road to the sun (the Action overhaul, 15 Nov 2026; display only, no stamp; drawn
 * on the expansion's view, orbitRev 12–15). Concept A's look (docs/design/game-concepts/action.md "Orbit") made in
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
 * Draws one planet disc of radius r at (x, y) with its surface turned to `turn` (0–1). Returns false when no canvas is
 * available (the caller then draws its flat fallback).
 */
export function drawRenderedPlanet(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, look: OrbitPlanetLook, turn: number): boolean {
  // The materials pass: a sphere projected from its surface map, once the map has loaded; the strip look until then.
  const sphere = planetSphereFrame(look, r, turn);
  if (sphere) {
    ctx.drawImage(sphere, x - r, y - r, 2 * r, 2 * r);
    return true;
  }
  return drawStripPlanet(ctx, x, y, r, look, turn);
}

/* ===================== The materials pass: projected spheres (15 Nov 2026) ===================== */
/*
 * Joe's materials note: premium materials need light on them. Each planet is a true sphere projected from one of six
 * surface maps (public/orbit/planets, scripts/orbit-planet-maps.py: two banded gas giants, two cratered rocks, an icy
 * world, an ocean world), tinted with its seeded colour (the ocean world keeps its own), lit by one sun from the upper
 * left with a soft terminator into a deep night side, a thin lit atmosphere rim inside the disc (no glow past it), and a
 * crisp specular highlight on water and ice (a broad, faint sheen on gas). Each rotation frame is baked once into a
 * small canvas (SPHERE_FRAMES a turn) and kept in a bounded cache; nothing is drawn past the collision circle.
 */
type MapName = keyof typeof ORBIT_PLANET_MAPS;
export interface OrbitMapPixels {
  w: number;
  h: number;
  data: Uint8ClampedArray;
}
const mapStore = new Map<MapName, OrbitMapPixels | "loading" | "failed">();
/** Frames a full turn (3° a frame). */
export const SPHERE_FRAMES = 120;
/** Baked at this many device px a world px (crisp on 2x screens). */
const SPHERE_BAKE = 2;
/** At most this many baked frames kept (about 8 MB at the largest planets). */
const SPHERE_CACHE_MAX = 180;
const sphereCache = new Map<string, HTMLCanvasElement>();

/** Hands the renderer a decoded map (the review-frame tool and checks, which run without an Image). */
export function setOrbitPlanetMap(name: MapName, pixels: OrbitMapPixels): void {
  mapStore.set(name, pixels);
}

function loadMap(name: MapName): OrbitMapPixels | null {
  const got = mapStore.get(name);
  if (got && got !== "loading" && got !== "failed") return got;
  if (got) return null;
  if (typeof Image === "undefined" || typeof document === "undefined") {
    mapStore.set(name, "failed");
    return null;
  }
  mapStore.set(name, "loading");
  const img = new Image();
  img.decoding = "async";
  img.onload = () => {
    const c = document.createElement("canvas");
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const g = c.getContext("2d", { willReadFrequently: true });
    if (!g) return void mapStore.set(name, "failed");
    g.drawImage(img, 0, 0);
    mapStore.set(name, { w: c.width, h: c.height, data: g.getImageData(0, 0, c.width, c.height).data });
  };
  img.onerror = () => mapStore.set(name, "failed");
  img.src = ORBIT_PLANET_MAPS[name];
  return null;
}

/** Which map a planet wears: gas giants one of two band patterns, rocky worlds two crater fields or (one in five) an ocean world. */
export function orbitPlanetMapFor(look: OrbitPlanetLook): MapName {
  if (look.type === 1) return (look.h >>> 5) & 1 ? "gas-a" : "gas-b";
  if (look.type === 2) return "ice";
  return look.h % 5 === 0 ? "ocean" : (look.h >>> 7) & 1 ? "rock-a" : "rock-b";
}

function planetSphereFrame(look: OrbitPlanetLook, r: number, turn: number): HTMLCanvasElement | null {
  if (typeof document === "undefined" || r <= 0) return null;
  const name = orbitPlanetMapFor(look);
  const map = loadMap(name);
  if (!map) return null;
  const frame = ((Math.floor(turn * SPHERE_FRAMES) % SPHERE_FRAMES) + SPHERE_FRAMES) % SPHERE_FRAMES;
  const key = `${look.h}:${look.colour}:${Math.round(r * 4)}:${frame}`;
  const hit = sphereCache.get(key);
  if (hit) {
    sphereCache.delete(key);
    sphereCache.set(key, hit);
    return hit;
  }
  const canvas = bakeSphere(map, name, look, r, frame / SPHERE_FRAMES);
  if (!canvas) return null;
  sphereCache.set(key, canvas);
  if (sphereCache.size > SPHERE_CACHE_MAX) sphereCache.delete(sphereCache.keys().next().value!);
  return canvas;
}

/** The light: from the upper left and a little towards the viewer. */
const LX = -0.56, LY = -0.6, LZ = 0.57;
const LN = Math.hypot(LX, LY, LZ);
const LIGHT = [LX / LN, LY / LN, LZ / LN] as const;
/** The half vector between the light and the viewer, for the specular highlight. */
const HN = Math.hypot(LIGHT[0], LIGHT[1], LIGHT[2] + 1);
const HALF = [LIGHT[0] / HN, LIGHT[1] / HN, (LIGHT[2] + 1) / HN] as const;

function bakeSphere(map: OrbitMapPixels, name: MapName, look: OrbitPlanetLook, r: number, turn: number): HTMLCanvasElement | null {
  const S = Math.max(4, Math.min(132, Math.ceil(2 * r * SPHERE_BAKE)));
  const c = makeCanvas(S, S);
  const g = c?.getContext("2d") ?? null;
  if (!c || !g) return null;
  const img = g.createImageData(S, S);
  const out = img.data;
  const R = S / 2;
  const [cr, cg, cb] = rgbOf(look.colour);
  const ocean = name === "ocean";
  const icy = name === "ice";
  const gasy = name === "gas-a" || name === "gas-b";
  const tilt = look.tilt * 0.35;
  const ct = Math.cos(tilt), st = Math.sin(tilt);
  const spin = turn * Math.PI * 2;
  // The atmosphere rim's colour: the planet's own, much lighter.
  const ar = cr + (255 - cr) * 0.7, ag = cg + (255 - cg) * 0.7, ab = cb + (255 - cb) * 0.75;
  for (let py = 0; py < S; py++) {
    for (let px = 0; px < S; px++) {
      const x = (px + 0.5 - R) / R;
      const y = (py + 0.5 - R) / R;
      const d2 = x * x + y * y;
      const cover = Math.max(0, Math.min(1, (1 - Math.sqrt(d2)) * R + 0.5));
      if (cover <= 0) continue;
      const z = Math.sqrt(Math.max(0, 1 - Math.min(1, d2)));
      const tx = x * ct + y * st;
      const ty = -x * st + y * ct;
      const lon = Math.atan2(tx, z) + spin;
      const lat = Math.asin(Math.max(-1, Math.min(1, ty)));
      let u = lon / (Math.PI * 2);
      u -= Math.floor(u);
      const mx = Math.min(map.w - 1, Math.floor(u * map.w));
      const my = Math.min(map.h - 1, Math.floor((lat / Math.PI + 0.5) * map.h));
      const i = (my * map.w + mx) * 4;
      let br: number, bg: number, bb: number;
      if (ocean) {
        br = map.data[i]!;
        bg = map.data[i + 1]!;
        bb = map.data[i + 2]!;
      } else {
        // The tint: a dark shade, the planet's colour, then a light shade, along the map's brightness.
        // The map's detail, with its contrast lifted so bands and craters read at the planets' small sizes.
        const t = Math.max(0, Math.min(1, 0.5 + (map.data[i]! / 255 - 0.5) * 1.6));
        if (t < 0.5) {
          const k = t / 0.5;
          br = cr * (0.22 + 0.78 * k);
          bg = cg * (0.22 + 0.78 * k);
          bb = cb * (0.28 + 0.72 * k);
        } else {
          const k = (t - 0.5) / 0.5;
          const w = icy ? 0.5 : 0.28;
          br = cr + (255 - cr) * k * w;
          bg = cg + (255 - cg) * k * w;
          bb = cb + (255 - cb) * k * w;
        }
      }
      // Diffuse light with a soft terminator into a deep (never black) night side.
      const dot = x * LIGHT[0] + y * LIGHT[1] + z * LIGHT[2];
      const lit = dot <= -0.12 ? 0 : dot >= 0.35 ? 1 : ((dot + 0.12) / 0.47) ** 1.4;
      const diffuse = 0.06 + 1.02 * lit * (0.55 + 0.45 * Math.max(0, dot));
      let rr = br * diffuse, gg = bg * diffuse, b2 = bb * diffuse;
      // The atmosphere rim: a thin lit band just inside the edge on the day side (no glow past the disc).
      // A fainter back-lit edge on the night side keeps the sphere's outline against black space.
      const rim = Math.pow(1 - z, 3) * Math.max(0, Math.min(1, dot + 0.45)) * (gasy ? 0.55 : 0.75) + Math.pow(1 - z, 5) * 0.22;
      rr += (ar - rr) * rim;
      gg += (ag - gg) * rim;
      b2 += (ab - b2) * rim;
      // A crisp specular highlight on water and ice, a broad faint sheen on gas and rock.
      const ndh = Math.max(0, x * HALF[0] + y * HALF[1] + z * HALF[2]);
      const water = ocean ? (map.data[i + 2]! > map.data[i + 1]! + 20 ? 1 : 0.15) : icy ? 0.6 : 0;
      const spec = water ? Math.pow(ndh, 46) * 0.85 * water : gasy ? Math.pow(ndh, 12) * 0.12 : Math.pow(ndh, 24) * 0.1;
      rr += (255 - rr) * spec;
      gg += (255 - gg) * spec;
      b2 += (255 - b2) * spec;
      const o = (py * S + px) * 4;
      out[o] = rr;
      out[o + 1] = gg;
      out[o + 2] = b2;
      out[o + 3] = cover * 255;
    }
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
