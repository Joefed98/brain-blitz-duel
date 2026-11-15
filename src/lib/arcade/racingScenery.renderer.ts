/**
 * Apex's scenery for each circuit (the Sports overhaul, stage 2, 15 Nov 2026; display only): racingRev 4's three named
 * circuits each get their own world round the same road (Joe: "harbour for Harbour Run, hills for Ridge Loop"), chosen
 * from the seed by racingCircuitOf. Nothing here touches the sim: the track, its collision and every hit area are the
 * same for every scene; the scene only picks the palette of the ground, the horizon's two strips and the roadside props.
 *
 *  - 0, Sunset Park: the parkland (racingRev 1–3 and the Sunset seeds): rose hills, a dark tree line, roadside trees.
 *  - 1, Harbour Run: the harbour: a headland with a lighthouse and gantry cranes far off, moored boats' masts and
 *    warehouses along the quay, water on the horizon carrying the low sun's reflection, containers and quay lamps by
 *    the road.
 *  - 2, Ridge Loop: the hills: layered blue-violet ridges with a summit, a pine ridge with rock faces, pines and
 *    boulders by the road.
 *
 * All painted (no images: the game stays at its 285 KB), at dusk: dark silhouettes rim-lit by the low sun, no glare.
 */
import type { RacingState } from "./racing";
import { RACING_REV_4, racingCircuitOf } from "./racing";

type Ctx2D = CanvasRenderingContext2D;

export const RACING_SCENE_PARK = 0;
export const RACING_SCENE_HARBOUR = 1;
export const RACING_SCENE_RIDGE = 2;

/** The scenery a state draws: racingRev 4's circuit, else the parkland (racingRev 1–3 keep their look). */
export function racingSceneOf(state: Pick<RacingState, "seed" | "rev">): number {
  return state.rev >= RACING_REV_4 ? racingCircuitOf(state.seed) : RACING_SCENE_PARK;
}

/** The ground's colours (the road's own are shared); the shape of COL_DAY. */
export interface GroundPalette {
  grassA: string;
  grassB: string;
  gravelA: string;
  gravelB: string;
  runoff: string;
  roadA: string;
  roadB: string;
  lineDark: string;
  kerbR: string;
  kerbW: string;
  edge: string;
  skid: string;
}

/**
 * The dusk palette (stage 2): kerbs, gravel, run-off and lines lifted back to read against the asphalt (stage 1's dusk
 * had sunk them into it); the road a touch lighter so its grain and markings show; each scene its own grass.
 */
const ROAD = {
  gravelA: "#C59F70",
  gravelB: "#BA9465",
  runoff: "#57555C",
  roadA: "#403F46",
  roadB: "#3C3B42",
  lineDark: "rgba(24,22,26,0.36)",
  kerbR: "#D63A2F",
  kerbW: "#F2EDE4",
  edge: "#EEE9DF",
  skid: "rgba(18,16,18,0.3)",
};
export const SCENE_GROUND: readonly GroundPalette[] = [
  { grassA: "#4E5A2A", grassB: "#475326", ...ROAD },
  { grassA: "#46553C", grassB: "#404E36", ...ROAD },
  { grassA: "#3F4F2C", grassB: "#394827", ...ROAD },
];

/** The haze over the far ground for each scene (warm at the horizon), ending in its grassA. */
export const SCENE_HAZE: readonly string[] = ["#B2805E", "#A77E72", "#9C7A6E"];

function hash(n: number): number {
  let x = Math.imul(n | 0, 0x9e3779b1) ^ 0x5bd1e995;
  x = Math.imul(x ^ (x >>> 15), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

function ridgeAt(x: number, w: number, h: number, amp: number, seed: number): number {
  const t = (x / w) * Math.PI * 2;
  return h - amp * (0.55 + 0.25 * Math.sin(t * 2 + seed) + 0.15 * Math.sin(t * 5 + seed * 3) + 0.06 * Math.sin(t * 11 + seed * 7));
}

function fillRidge(ctx: Ctx2D, w: number, h: number, amp: number, seed: number, top: string, bottom: string, rim: string | null): void {
  const g = ctx.createLinearGradient(0, h - amp, 0, h);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let x = 0; x <= w; x += 4) ctx.lineTo(x, ridgeAt(x, w, h, amp, seed));
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();
  if (rim) {
    ctx.strokeStyle = rim;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= w; x += 4) (x === 0 ? ctx.moveTo : ctx.lineTo).call(ctx, x, ridgeAt(x, w, h, amp, seed) + 0.5);
    ctx.stroke();
  }
}

/* ============================== The harbour ============================== */

/** The far strip: a low headland, a lighthouse on its point and gantry cranes over the docks, hazy rose-violet. */
export function paintHarbourFar(ctx: Ctx2D, w: number, h: number): void {
  fillRidge(ctx, w, h, 16, 5, "#9C6A82", "#7A5672", "rgba(255,200,160,0.55)");
  const ink = "#6A4C66";
  // Gantry cranes in three yards (repeating round the strip, as the hills do): an A-frame on legs, its boom out over
  // the water, the low sun on its top edge.
  for (const yard of [0.02, 0.13, 0.24, 0.36, 0.47, 0.58, 0.69, 0.8, 0.91]) {
    for (let k = 0; k < 2; k++) {
      const x = w * yard + k * 34;
      const top = h - 46 + k * 5;
      ctx.fillStyle = ink;
      ctx.beginPath();
      ctx.moveTo(x - 7, h);
      ctx.lineTo(x - 3, top + 8);
      ctx.lineTo(x + 3, top + 8);
      ctx.lineTo(x + 7, h);
      ctx.lineTo(x + 5, h);
      ctx.lineTo(x + 1.5, top + 12);
      ctx.lineTo(x - 1.5, top + 12);
      ctx.lineTo(x - 5, h);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(x - 6, top + 6, 30, 3);
      ctx.fillRect(x - 14, top + 6, 8, 2);
      ctx.fillRect(x - 1, top, 2, 6);
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x + 24, top + 6);
      ctx.lineTo(x + 23, top + 7);
      ctx.lineTo(x, top + 1.5);
      ctx.fill();
      ctx.fillStyle = "rgba(255,190,140,0.55)";
      ctx.fillRect(x - 6, top + 6, 30, 0.8);
    }
  }
  // Lighthouses on the headland's points, their lamp lit.
  for (const at of [0.27, 0.9]) {
    const x = w * at;
    const base = ridgeAt(x, w, h, 16, 5);
    ctx.fillStyle = "#E8DCD0";
    ctx.beginPath();
    ctx.moveTo(x - 3.2, base);
    ctx.lineTo(x - 2, base - 24);
    ctx.lineTo(x + 2, base - 24);
    ctx.lineTo(x + 3.2, base);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#B83A34";
    ctx.fillRect(x - 2.6, base - 16, 5.2, 3.2);
    ctx.fillRect(x - 2.2, base - 26, 4.4, 2.2);
    ctx.fillStyle = "#FFE3A0";
    ctx.fillRect(x - 1.6, base - 29, 3.2, 3);
    ctx.fillStyle = "rgba(255,226,160,0.25)";
    ctx.beginPath();
    ctx.arc(x, base - 27.5, 5, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** The near strip: the quay's warehouses with lit windows and the moored boats' hulls and masts, dark, rim-lit. */
export function paintHarbourNear(ctx: Ctx2D, w: number, h: number): void {
  const dark = "#1E1820";
  let x = 0;
  let i = 0;
  while (x < w) {
    const r = hash(i * 13 + 7);
    if (r < 0.45) {
      // A warehouse: a long shed with a sawtooth or pitched roof.
      const bw = 40 + hash(i * 3) * 50;
      const bh = 16 + hash(i * 5) * 14;
      ctx.fillStyle = dark;
      ctx.fillRect(x, h - bh, bw, bh);
      ctx.beginPath();
      const teeth = Math.max(2, Math.round(bw / 14));
      for (let k = 0; k < teeth; k++) {
        const a = x + (k * bw) / teeth;
        ctx.moveTo(a, h - bh);
        ctx.lineTo(a + bw / teeth, h - bh - 5);
        ctx.lineTo(a + bw / teeth, h - bh);
      }
      ctx.fill();
      ctx.strokeStyle = "rgba(255,165,95,0.7)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, h - bh + 0.5);
      ctx.lineTo(x + bw, h - bh + 0.5);
      ctx.stroke();
      // A few lit windows.
      for (let k = 0; k < bw / 9; k++) {
        if (hash(i * 31 + k) < 0.35) {
          ctx.fillStyle = "rgba(255,206,130,0.85)";
          ctx.fillRect(x + 3 + k * 9, h - bh * 0.6, 3, 2);
        }
      }
      x += bw + 6;
    } else {
      // Moored boats: hulls on the water line, masts and a cabin.
      // Moored boats: one or two, each its own size, hull on the water line, a cabin and a mast (a fishing boat's
      // boom on some), a warm rim on the gunwale.
      const n = 1 + Math.floor(hash(i * 7) * 2);
      let bx = x;
      for (let k = 0; k < n; k++) {
        const len = 22 + hash(i * 5 + k) * 18;
        const mast = 18 + hash(i + k * 3) * 22;
        ctx.fillStyle = dark;
        ctx.beginPath();
        ctx.moveTo(bx, h - 8);
        ctx.lineTo(bx + len, h - 9);
        ctx.lineTo(bx + len - 4, h - 1);
        ctx.lineTo(bx + 3, h - 1);
        ctx.closePath();
        ctx.fill();
        ctx.fillRect(bx + len * 0.3, h - 14, len * 0.3, 6);
        ctx.fillRect(bx + len * 0.5, h - 8 - mast, 1.2, mast);
        if (hash(i * 9 + k) < 0.5) {
          ctx.beginPath();
          ctx.moveTo(bx + len * 0.5, h - 8 - mast * 0.8);
          ctx.lineTo(bx + len * 0.95, h - 10);
          ctx.lineWidth = 0.8;
          ctx.strokeStyle = dark;
          ctx.stroke();
        }
        ctx.strokeStyle = "rgba(255,170,100,0.6)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(bx, h - 7.5);
        ctx.lineTo(bx + len, h - 8.5);
        ctx.stroke();
        bx += len + 8;
      }
      x = bx + 14;
    }
    i++;
  }
}

/**
 * The water on the horizon (Harbour Run): a band of dusk water between the far shore and the near ground, with the low
 * sun's reflection breaking into ripples straight below it. Drawn over the haze, above the road's far end.
 */
export function paintHarbourWater(ctx: Ctx2D, x0: number, x1: number, top: number, bottom: number, sunX: number | null): void {
  const g = ctx.createLinearGradient(0, top, 0, bottom);
  g.addColorStop(0, "#6A5478");
  g.addColorStop(0.55, "#3E3656");
  g.addColorStop(1, "rgba(52,48,70,0.4)");
  ctx.fillStyle = g;
  ctx.fillRect(x0, top, x1 - x0, bottom - top);
  // Long soft ripples.
  ctx.fillStyle = "rgba(255,200,170,0.12)";
  for (let k = 0; k < 6; k++) ctx.fillRect(x0, top + 2 + k * 2.4, x1 - x0, 0.6);
  if (sunX !== null) {
    // The sun's path on the water: broken gold dashes, narrow at the shore, wider towards us.
    for (let k = 0; k < 9; k++) {
      const y = top + 1 + k * ((bottom - top - 3) / 9);
      const half = 4 + k * 2.2;
      ctx.fillStyle = `rgba(255,${228 - k * 7},${168 - k * 8},${0.92 - k * 0.07})`;
      ctx.fillRect(sunX - half + (k % 2) * 3, y, half * 2 - (k % 2) * 6, 1.4);
    }
  }
}

/** A roadside prop for the harbour (foot at (x, y), `h` its sprite's height): containers, a quay lamp, a bollard pile. */
export function paintHarbourProp(ctx: Ctx2D, x: number, y: number, h: number, variant: number): void {
  if (variant === 1) {
    // A quay lamp: a tall post with a warm lamp.
    ctx.fillStyle = "#1E1B22";
    ctx.fillRect(x - h * 0.012, y - h * 0.8, h * 0.024, h * 0.8);
    ctx.fillRect(x - h * 0.012, y - h * 0.8, h * 0.12, h * 0.016);
    ctx.fillStyle = "#FFD99A";
    ctx.fillRect(x + h * 0.08, y - h * 0.79, h * 0.05, h * 0.02);
    const glow = ctx.createRadialGradient(x + h * 0.1, y - h * 0.775, 0, x + h * 0.1, y - h * 0.775, h * 0.08);
    glow.addColorStop(0, "rgba(255,210,140,0.45)");
    glow.addColorStop(1, "rgba(255,210,140,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(x, y - h * 0.86, h * 0.2, h * 0.16);
    return;
  }
  // Containers, stacked two or three high, in dusk-dimmed liveries with a warm top edge.
  const colours = [["#7A2E2A", "#5E2421"], ["#2C4C6A", "#223A52"], ["#8A6A2C", "#6A5122"], ["#3C5A3A", "#2E462C"]];
  const rows = variant === 0 ? 2 : 3;
  const cw = h * 0.46;
  const ch = h * 0.14;
  for (let r = 0; r < rows; r++) {
    const [face, shade] = colours[(variant * 3 + r) % colours.length]!;
    const cx = x - cw / 2 + (r % 2) * h * 0.03;
    const cy = y - (r + 1) * ch;
    ctx.fillStyle = face!;
    ctx.fillRect(cx, cy, cw, ch);
    ctx.fillStyle = shade!;
    for (let k = 1; k < 8; k++) ctx.fillRect(cx + (k * cw) / 8, cy + ch * 0.1, Math.max(0.6, h * 0.004), ch * 0.8);
    ctx.fillStyle = "rgba(255,180,110,0.55)";
    ctx.fillRect(cx, cy, cw, Math.max(0.6, ch * 0.08));
  }
}

/* ============================== The hills ============================== */

/** The far strip: two layered ridges, the higher one with a summit, blue-violet into the haze. */
export function paintRidgeFar(ctx: Ctx2D, w: number, h: number): void {
  fillRidge(ctx, w, h, 62, 2, "#7C6688", "#685878", "rgba(255,205,170,0.6)");
  // The summit: a sharper peak at two places round the strip, with a lit snow-less rock crown.
  for (const at of [0.18, 0.62]) {
    const x = w * at;
    ctx.fillStyle = "#6E5C80";
    ctx.beginPath();
    ctx.moveTo(x - 46, h - 30);
    ctx.lineTo(x - 8, h - 66);
    ctx.lineTo(x, h - 70);
    ctx.lineTo(x + 10, h - 63);
    ctx.lineTo(x + 52, h - 28);
    ctx.lineTo(x + 52, h);
    ctx.lineTo(x - 46, h);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(255,200,160,0.65)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - 46, h - 30);
    ctx.lineTo(x - 8, h - 66);
    ctx.lineTo(x, h - 70);
    ctx.stroke();
  }
  fillRidge(ctx, w, h, 34, 9, "#5E4B66", "#4E3F58", "rgba(255,180,140,0.45)");
}

/** The near strip: a pine ridge with grey rock faces, dark and rim-lit. */
export function paintRidgeNear(ctx: Ctx2D, w: number, h: number): void {
  fillRidge(ctx, w, h, 46, 13, "#2E2634", "#17141A", "rgba(255,160,95,0.7)");
  // Rock faces: pale wedges on the slope.
  for (let i = 0; i < w / 120; i++) {
    const x = hash(i * 19 + 3) * w;
    const y = ridgeAt(x, w, h, 46, 13) + 6;
    ctx.fillStyle = "rgba(120,104,120,0.55)";
    ctx.beginPath();
    ctx.moveTo(x - 10, y + 12);
    ctx.lineTo(x - 2, y);
    ctx.lineTo(x + 8, y + 4);
    ctx.lineTo(x + 12, y + 14);
    ctx.closePath();
    ctx.fill();
  }
  // Pines along the crest.
  ctx.fillStyle = "#141117";
  for (let i = 0; i < w / 6; i++) {
    const x = hash(i * 31 + 13 * 101) * w;
    const y = ridgeAt(x, w, h, 46, 13);
    const s = 3 + hash(i * 17 + 13) * 5;
    ctx.beginPath();
    ctx.moveTo(x - s * 0.45, y + 2);
    ctx.lineTo(x, y - s * 2);
    ctx.lineTo(x + s * 0.45, y + 2);
    ctx.fill();
  }
}

/** A roadside prop for the hills (foot at (x, y)): a pine, a tall pine, or a boulder. */
export function paintRidgeProp(ctx: Ctx2D, x: number, y: number, h: number, variant: number): void {
  if (variant === 2) {
    // A boulder with a warm lit face.
    ctx.fillStyle = "#3A3540";
    ctx.beginPath();
    ctx.moveTo(x - h * 0.3, y);
    ctx.lineTo(x - h * 0.24, y - h * 0.22);
    ctx.lineTo(x - h * 0.02, y - h * 0.3);
    ctx.lineTo(x + h * 0.26, y - h * 0.18);
    ctx.lineTo(x + h * 0.32, y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(255,170,110,0.35)";
    ctx.beginPath();
    ctx.moveTo(x - h * 0.24, y - h * 0.22);
    ctx.lineTo(x - h * 0.02, y - h * 0.3);
    ctx.lineTo(x + h * 0.02, y - h * 0.16);
    ctx.closePath();
    ctx.fill();
    return;
  }
  const tall = variant === 1 ? 1 : 0.8;
  ctx.fillStyle = "#2B1E18";
  ctx.fillRect(x - h * 0.02, y - h * 0.16, h * 0.04, h * 0.16);
  const body = variant === 1 ? "#121A15" : "#16201A";
  ctx.fillStyle = body;
  for (let k = 0; k < 4; k++) {
    const top = y - h * (0.12 + k * 0.18) * tall - h * 0.3 * tall;
    const half = h * (0.2 - k * 0.04);
    ctx.beginPath();
    ctx.moveTo(x - half, y - h * (0.12 + k * 0.18) * tall);
    ctx.lineTo(x, top);
    ctx.lineTo(x + half, y - h * (0.12 + k * 0.18) * tall);
    ctx.closePath();
    ctx.fill();
  }
  ctx.strokeStyle = "rgba(255,165,85,0.75)";
  ctx.lineWidth = h * 0.016;
  ctx.beginPath();
  ctx.moveTo(x, y - h * 0.9 * tall);
  ctx.lineTo(x + h * 0.12, y - h * 0.62 * tall);
  ctx.stroke();
}
