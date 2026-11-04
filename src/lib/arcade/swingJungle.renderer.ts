/**
 * Grappler's prehistoric jungle canopy (3 Nov 2026, Joe's audit; display only, swingRev 17, the revision rooms deal).
 * The same course, rules and timings as the cave it replaces, every shape on the sim's own geometry:
 *  - the canopy is the solid mass above the sim's ceiling line (leaves and branches, its underside on the line);
 *  - the river is the sim's floor line (a miss drops you in): its surface rides the line within 1.5 px;
 *  - grab points (the sim's anchors) are knotted vine loops at the anchor, hanging from the canopy, with a soft glow;
 *    a sliding hook is a swinging vine: its vine hangs from above the middle of its travel and its loop is drawn where
 *    the sim has the hook this tick, its path a faint dotted arc;
 *  - ledges are tree platforms (planks whose top is the landing line, a trunk down into the river);
 *  - a squeeze's roof is a hanging trunk and root mass and its floor a mossy boulder stack, exactly over the sim's two
 *    rectangles;
 *  - speed gates are two bamboo posts above and below the sim's opening;
 *  - the chasing dragon is a pterodactyl (its jaws on the catch line);
 *  - the dark ledge sections are deep canopy shade (swing.renderer.ts's drawDark, in green-black).
 * Behind it all: a layered backdrop (a green haze, distant tree crowns at slow parallax, mid trunks, light shafts),
 * none of which collides. Render only: never writes the state.
 */
import type { SwingGate, SwingLedge, SwingSlider, SwingState } from "./swing";
import { swingAnchorAt, swingHookLit, SWING_GATE_HALF_W, SWING_LEDGE_THICK } from "./swing";
import { artHash } from "./art.renderer";

const FP = 256;
const COL = 40 * FP;

export const JUNGLE = {
  gold: "#F2C75C",
  leafDark: "#0B2416",
  leaf: "#1C4A2A",
  leafLight: "#3F8A3E",
  leafLit: "#8FD15A",
  bark: "#4A3322",
  barkDark: "#2A1C12",
  barkLight: "#7A5638",
  vine: "#5E8F33",
  vineDark: "#2F5419",
  vineLight: "#A7DB6A",
  moss: "#4D7A2E",
  rock: "#5B5E52",
  rockDark: "#2E302A",
  water: "#2F9FB0",
  waterDeep: "#0B3A4A",
  foam: "#D8F6F2",
  /** The deep-shade veil (drawDark / the ledge-run dim in the jungle). */
  shade: "2,10,6",
} as const;

function lerpAt(arr: readonly number[], x: number): number {
  const i = Math.max(0, Math.min(arr.length - 2, Math.trunc(x / COL)));
  const f = x - i * COL;
  return arr[i]! + Math.trunc(((arr[i + 1]! - arr[i]!) * f) / COL);
}

/** The backdrop: haze, distant crowns, mid trunks and light shafts (no collision; slow parallax on the camera). */
export function drawJungleBackdrop(ctx: CanvasRenderingContext2D, cam: number, W: number, H: number, t: number, lite: boolean): void {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#0E2A1C");
  sky.addColorStop(0.45, "#1B4A35");
  sky.addColorStop(0.8, "#24604A");
  sky.addColorStop(1, "#173E36");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  if (!lite) {
    // Light shafts from the canopy's gaps, slanting down to the right, fixed to a slow parallax.
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let k = -1; k < 5; k++) {
      const base = k * 150 - ((cam * 0.08) % 150);
      const h = artHash(Math.floor((cam * 0.08) / 150) + k, 313);
      const w = 30 + (h % 40);
      const a = 0.05 + ((h >>> 5) % 5) * 0.012 + 0.01 * Math.sin(t * 0.6 + k);
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, `rgba(220,255,170,${a})`);
      g.addColorStop(1, "rgba(220,255,170,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(base, 0);
      ctx.lineTo(base + w, 0);
      ctx.lineTo(base + w + 160, H);
      ctx.lineTo(base + 120, H);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
  // Distant tree crowns, two layers: rounded canopies on thin trunks.
  const layers = lite ? ([[0.2, H * 0.52, "#1E5440", 70]] as const) : ([[0.12, H * 0.46, "#1E5440", 80], [0.25, H * 0.58, "#173F2F", 62]] as const);
  for (const [par, base, colour, step] of layers) {
    ctx.fillStyle = colour;
    const off = (cam * par) % step;
    const k0 = Math.floor((cam * par) / step);
    for (let k = -1; k <= W / step + 2; k++) {
      const h = artHash(k0 + k, step);
      const x = k * step - off + (h % 20);
      const top = base + (h >>> 4) % 60 - 30;
      ctx.fillRect(x - 3, top, 6, H - top);
      const r = 26 + (h >>> 9) % 18;
      ctx.beginPath();
      ctx.arc(x, top, r, 0, Math.PI * 2);
      ctx.arc(x - r * 0.7, top + r * 0.35, r * 0.7, 0, Math.PI * 2);
      ctx.arc(x + r * 0.75, top + r * 0.3, r * 0.65, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Mid trunks (parallax 0.5): tall, dark, a lit edge, a few hanging lianas.
  if (!lite) {
    const step = 170;
    const off = (cam * 0.5) % step;
    const k0 = Math.floor((cam * 0.5) / step);
    for (let k = -1; k <= W / step + 1; k++) {
      const h = artHash(k0 + k, 977);
      const x = k * step - off + (h % 60);
      const w = 16 + (h >>> 6) % 14;
      const g = ctx.createLinearGradient(x, 0, x + w, 0);
      g.addColorStop(0, "#1A2E1C");
      g.addColorStop(0.3, "#2C4026");
      g.addColorStop(1, "#0F1E12");
      ctx.fillStyle = g;
      ctx.fillRect(x, 0, w, H);
      ctx.strokeStyle = "rgba(40,80,40,0.7)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      const lx = x + w + 6;
      ctx.moveTo(lx, 0);
      ctx.quadraticCurveTo(lx + 10, H * 0.3, lx - 2, H * 0.45 + (h % 80));
      ctx.stroke();
    }
  }
}

/** The canopy: the mass above the sim's ceiling line, its underside exactly on the line, fringed with leaves inside it. */
export function drawJungleCanopy(ctx: CanvasRenderingContext2D, state: SwingState, first: number, last: number, sx: (x: number) => number, W: number, t: number, lite: boolean): void {
  const ceil = state.ceil;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(sx(first * COL), -4);
  for (let i = first; i <= last; i++) ctx.lineTo(sx(i * COL), ceil[i]! / FP);
  ctx.lineTo(sx(last * COL), -4);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, 0, 0, 260);
  g.addColorStop(0, "#06160D");
  g.addColorStop(1, JUNGLE.leaf);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.clip();
  // Leaf clumps inside the mass, brightest along the underside; branches through them.
  const c0 = Math.floor((state.camX / FP) / 22) - 1;
  for (let k = c0; k < c0 + W / 22 + 3; k++) {
    const wx = k * 22;
    const px = wx - state.camX / FP;
    const cy = lerpAt(ceil, wx * FP) / FP;
    for (let row = 0; row < 3; row++) {
      const h = artHash(k, 41 + row);
      const r = 12 + (h % 8) - row * 2;
      const y = cy - 6 - row * 22 - (h >>> 4) % 8;
      ctx.fillStyle = row === 0 ? JUNGLE.leafLight : row === 1 ? JUNGLE.leaf : "#123620";
      ctx.beginPath();
      ctx.ellipse(px + ((h >>> 8) % 10) - 5, y, r, r * 0.7, ((h >>> 3) % 7) * 0.3, 0, Math.PI * 2);
      ctx.fill();
      if (row === 0 && !lite) {
        ctx.fillStyle = "rgba(170,230,110,0.35)";
        ctx.beginPath();
        ctx.ellipse(px - 3, y - 3, r * 0.45, r * 0.25, -0.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.strokeStyle = JUNGLE.barkDark;
  ctx.lineWidth = 5;
  for (let k = Math.floor(state.camX / FP / 140) - 1; k < Math.floor(state.camX / FP / 140) + W / 140 + 2; k++) {
    const h = artHash(k, 71);
    const x0 = k * 140 - state.camX / FP;
    const y0 = lerpAt(ceil, Math.max(0, k * 140 * FP)) / FP - 30 - (h % 20);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(x0 + 60, y0 + 8 - (h >>> 4) % 16, x0 + 140, y0 - 6);
    ctx.stroke();
  }
  ctx.restore();
  // Leaf tips hanging just under the line? No: the underside stays exactly on the sim's line (a soft lit rim only).
  ctx.strokeStyle = "rgba(160,225,100,0.55)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = first; i <= last; i++) {
    const x = sx(i * COL);
    const y = ceil[i]! / FP;
    if (i === first) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  void t;
}

/** The river: its surface on the sim's floor line (waves within 1.5 px), deep teal below, foam and glints. */
export function drawJungleRiver(ctx: CanvasRenderingContext2D, state: SwingState, cam: number, W: number, H: number, t: number, still: boolean, lite: boolean): void {
  const wave = (wx: number) => (still ? 0 : Math.sin(wx * 0.05 + t * 1.4) * 1.1 + Math.sin(wx * 0.13 - t) * 0.35);
  const surface: Array<[number, number]> = [];
  for (let px = -4; px <= W + 4; px += 6) surface.push([px, lerpAt(state.floor, Math.round((px + cam) * FP)) / FP + wave(px + cam)]);
  const top = Math.min(...surface.map((p) => p[1]));
  ctx.beginPath();
  ctx.moveTo(-4, H);
  for (const [px, py] of surface) ctx.lineTo(px, py);
  ctx.lineTo(W + 4, H);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, top, 0, H);
  g.addColorStop(0, JUNGLE.water);
  g.addColorStop(0.25, "#1C6F80");
  g.addColorStop(1, JUNGLE.waterDeep);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  ctx.clip();
  // Current streaks flowing left (the river runs against the swing).
  ctx.strokeStyle = "rgba(200,245,240,0.22)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let k = Math.floor(cam / 50) - 1; k < Math.floor(cam / 50) + W / 50 + 2; k++) {
    const h = artHash(k, 211);
    const flow = still ? 0 : (t * 30) % 50;
    const px = k * 50 - cam - flow + (h % 30);
    const py = lerpAt(state.floor, Math.round((k * 50) * FP)) / FP + 10 + (h >>> 5) % 40;
    ctx.moveTo(px, py);
    ctx.lineTo(px + 12 + (h >>> 3) % 14, py);
  }
  ctx.stroke();
  // Reeds and lily pads at the surface (inside the water's own shape).
  if (!lite) for (let k = Math.floor(cam / 80) - 1; k < Math.floor(cam / 80) + W / 80 + 2; k++) {
    const h = artHash(k, 505);
    if (h % 3) continue;
    const wx = k * 80 + (h % 50);
    const px = wx - cam;
    const py = lerpAt(state.floor, Math.round(wx * FP)) / FP + wave(wx) + 3;
    ctx.fillStyle = "#2F7A3A";
    ctx.beginPath();
    ctx.ellipse(px, py, 9, 2.6, 0, 0.3, Math.PI * 2 - 0.3);
    ctx.lineTo(px, py);
    ctx.fill();
  }
  ctx.restore();
  ctx.strokeStyle = JUNGLE.foam;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  surface.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
  ctx.stroke();
  if (!lite) {
    ctx.strokeStyle = "rgba(216,246,242,0.25)";
    ctx.lineWidth = 5;
    ctx.stroke();
  }
}

/** A squeeze: the roof a hanging trunk with roots, the floor a mossy boulder stack, each exactly its sim rectangle. */
export function drawJungleSqueeze(ctx: CanvasRenderingContext2D, x0: number, x1: number, y0: number, y1: number, roof: boolean, seed: number): void {
  const w = x1 - x0;
  if (roof) {
    const g = ctx.createLinearGradient(x0, 0, x1, 0);
    g.addColorStop(0, JUNGLE.barkLight);
    g.addColorStop(0.45, JUNGLE.bark);
    g.addColorStop(1, JUNGLE.barkDark);
    ctx.fillStyle = g;
    ctx.fillRect(x0, y0, w, y1 - y0);
    ctx.strokeStyle = "rgba(20,12,6,0.6)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let n = 1; n < 5; n++) {
      const x = x0 + (w * n) / 5 + ((artHash(seed, n) % 7) - 3);
      ctx.moveTo(x, y0);
      ctx.lineTo(x + ((artHash(seed, n + 9) % 5) - 2), y1 - 3);
    }
    ctx.stroke();
    // Its bottom edge: a lit rim exactly on the opening.
    ctx.fillStyle = "rgba(200,240,140,0.8)";
    ctx.fillRect(x0, y1 - 2, w, 2);
  } else {
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, JUNGLE.rock);
    g.addColorStop(1, JUNGLE.rockDark);
    ctx.fillStyle = g;
    ctx.fillRect(x0, y0, w, y1 - y0);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, y0, w, y1 - y0);
    ctx.clip();
    ctx.strokeStyle = "rgba(0,0,0,0.4)";
    ctx.lineWidth = 1;
    for (let n = 0; n < 6; n++) {
      const h = artHash(seed, 30 + n);
      ctx.beginPath();
      ctx.ellipse(x0 + (h % 100) / 100 * w, y0 + 14 + n * 22, 12 + (h >>> 7) % 10, 9, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = JUNGLE.moss;
    ctx.fillRect(x0, y0, w, 5);
    ctx.restore();
    ctx.fillStyle = "rgba(200,240,140,0.8)";
    ctx.fillRect(x0, y0, w, 2);
  }
}

/** A tree platform: planks with their top on the sim's landing line, a trunk under it down to the river. */
export function drawJunglePlatform(ctx: CanvasRenderingContext2D, l: SwingLedge, x: number, floorY: number, kind: number, reached: boolean, tick: number, still: boolean): void {
  const half = l.half / FP;
  const top = l.top / FP;
  const thick = SWING_LEDGE_THICK / FP;
  const left = x - half;
  // The trunk, behind the planks, down into the water.
  const tw = Math.min(18, half * 0.5);
  const g = ctx.createLinearGradient(x - tw / 2, 0, x + tw / 2, 0);
  g.addColorStop(0, JUNGLE.barkLight);
  g.addColorStop(1, JUNGLE.barkDark);
  ctx.fillStyle = g;
  ctx.fillRect(x - tw / 2, top + thick - 1, tw, Math.max(0, floorY - top - thick + 4));
  // Planks.
  const p = ctx.createLinearGradient(0, top, 0, top + thick);
  p.addColorStop(0, "#A47A4C");
  p.addColorStop(1, "#5A3D24");
  ctx.fillStyle = p;
  ctx.beginPath();
  ctx.roundRect(left, top, half * 2, thick, 3);
  ctx.fill();
  ctx.strokeStyle = "rgba(40,24,12,0.7)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let n = 1; n < Math.floor(half / 9); n++) {
    const px = left + n * 18;
    if (px >= left + half * 2 - 2) break;
    ctx.moveTo(px, top + 1);
    ctx.lineTo(px, top + thick - 1);
  }
  ctx.stroke();
  // Moss along the top; gold once landed on.
  ctx.fillStyle = reached ? JUNGLE.gold : JUNGLE.leafLit;
  ctx.fillRect(left, top, half * 2, reached ? 2.5 : 2);
  if (kind === 0) {
    ctx.fillStyle = JUNGLE.gold;
    ctx.beginPath();
    ctx.moveTo(x - 5, top + 2);
    ctx.lineTo(x + 4, top + thick / 2 + 0.5);
    ctx.lineTo(x - 5, top + thick - 1);
    ctx.closePath();
    ctx.fill();
  } else if (kind === 2) {
    const pole = left + half * 2 - 6;
    ctx.strokeStyle = JUNGLE.barkLight;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pole, top);
    ctx.lineTo(pole, top - 28);
    ctx.stroke();
    const wave = still ? 0 : Math.sin(tick * 0.15) * 2;
    ctx.fillStyle = JUNGLE.gold;
    ctx.beginPath();
    ctx.moveTo(pole, top - 28);
    ctx.quadraticCurveTo(pole - 8, top - 25 + wave, pole - 16, top - 23 + wave);
    ctx.lineTo(pole, top - 17);
    ctx.closePath();
    ctx.fill();
  }
}

/** A speed gate: bamboo posts over and under the sim's opening, a glowing band between (gold once lit). */
export function drawJungleGate(ctx: CanvasRenderingContext2D, g: SwingGate, x: number, lit: boolean, i: number, tick: number, still: boolean, lite: boolean): void {
  const y0 = g.y0 / FP;
  const y1 = g.y1 / FP;
  const half = SWING_GATE_HALF_W / FP;
  if (!lite) {
    const band = ctx.createLinearGradient(x - 16, 0, x + 16, 0);
    band.addColorStop(0, "rgba(200,255,120,0)");
    band.addColorStop(0.5, lit ? "rgba(255,214,90,0.45)" : `rgba(190,255,140,${0.14 + (still ? 0 : 0.05 * Math.sin(tick * 0.12 + i))})`);
    band.addColorStop(1, "rgba(200,255,120,0)");
    ctx.fillStyle = band;
    ctx.fillRect(x - 16, y0, 32, y1 - y0);
  }
  ctx.strokeStyle = lit ? "#FFE08A" : "rgba(200,255,160,0.6)";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 6]);
  ctx.beginPath();
  ctx.moveTo(x, y0);
  ctx.lineTo(x, y1);
  ctx.stroke();
  ctx.setLineDash([]);
  for (const [top, bottom, cap] of [[y0 - 38, y0, y0], [y1, y1 + 38, y1]] as const) {
    const s = ctx.createLinearGradient(x - half, 0, x + half, 0);
    s.addColorStop(0, "#B9C46A");
    s.addColorStop(0.5, "#7E8E3A");
    s.addColorStop(1, "#4E5A22");
    ctx.fillStyle = s;
    ctx.fillRect(x - half, top, half * 2, bottom - top);
    ctx.fillStyle = "#3C4718";
    for (let y = top + 9; y < bottom - 2; y += 12) ctx.fillRect(x - half, y, half * 2, 2);
    ctx.fillStyle = lit ? JUNGLE.gold : "#D9C77A";
    ctx.fillRect(x - half - 1, cap - 1.5, half * 2 + 2, 3);
  }
}

/** Each swinging vine's path: a faint dotted arc from one end of its travel to the other (not drawn in the shade). */
export function drawJungleVinePaths(ctx: CanvasRenderingContext2D, state: SwingState, sx: (x: number) => number, W: number): void {
  (state.sliders ?? []).forEach((sl: SwingSlider, n) => {
    if (state.dark && !swingHookLit(state, sl.i)) return;
    const x0 = sx(sl.x - sl.amp);
    const x1 = sx(sl.x + sl.amp);
    if (x1 < -20 || x0 > W + 20) return;
    const y = state.anchors[sl.i]!.y / FP;
    const stopped = ((state.slideLock ?? 0) & (1 << n)) !== 0;
    ctx.save();
    ctx.globalAlpha = stopped ? 0.35 : 0.8;
    ctx.strokeStyle = "rgba(190,240,140,0.55)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([2, 5]);
    ctx.beginPath();
    // A shallow arc through both ends of the travel, its lowest point at the middle (the vine's swing).
    ctx.moveTo(x0, y);
    ctx.quadraticCurveTo((x0 + x1) / 2, y + 8, x1, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  });
}

/**
 * The grab points: a vine from the canopy down to each anchor (a swinging vine's from above its travel's middle) and
 * a knotted loop at the anchor with a soft glow; the hook grabbed gets a gold flash. The loop is drawn where the sim
 * has the hook this tick (swingAnchorAt), and nothing is drawn for a hook in the shade (swingHookLit).
 */
export function drawJungleGrabPoints(ctx: CanvasRenderingContext2D, state: SwingState, sx: (x: number) => number, W: number, t: number, still: boolean, lite: boolean): void {
  const slider = new Map((state.sliders ?? []).map((sl) => [sl.i, sl] as const));
  state.anchors.forEach((home, i) => {
    const a = state.slide ? swingAnchorAt(state, i, state.tick) : home;
    const x = sx(a.x);
    if (x < -30 || x > W + 30 || (state.dark && !swingHookLit(state, i))) return;
    const y = a.y / FP;
    const sl = slider.get(i);
    const topX = sl ? sx(sl.x) : x + (still ? 0 : Math.sin(t * 0.8 + i) * 1.5);
    const topY = lerpAt(state.ceil, sl ? sl.x : a.x) / FP;
    const held = i === state.rope;
    // The vine (behind the loop): a soft curve with leaves along it.
    ctx.strokeStyle = JUNGLE.vineDark;
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.quadraticCurveTo((topX + x) / 2 + 4, (topY + y) / 2, x, y - 11);
    ctx.stroke();
    ctx.strokeStyle = JUNGLE.vine;
    ctx.lineWidth = 2;
    ctx.stroke();
    const len = Math.hypot(x - topX, y - topY);
    for (let k = 1; k < Math.min(6, len / 22); k++) {
      const f = k / Math.min(6, len / 22);
      const lx = topX + (x - topX) * f;
      const ly = topY + (y - 11 - topY) * f;
      ctx.fillStyle = k % 2 ? JUNGLE.leafLight : JUNGLE.vine;
      ctx.beginPath();
      ctx.ellipse(lx + (k % 2 ? 4 : -4), ly, 4.5, 2, k % 2 ? 0.6 : -0.6, 0, Math.PI * 2);
      ctx.fill();
    }
    // The glow and the knotted loop at the anchor.
    const flash = held && state.tick - state.grabTick < 12;
    if (!lite) {
      const pulse = still ? 0 : 0.08 * Math.sin(t * 3 + i);
      const g = ctx.createRadialGradient(x, y, 3, x, y, 28);
      g.addColorStop(0, `rgba(255,236,140,${(flash ? 0.8 : 0.6) + pulse})`);
      g.addColorStop(0.5, `rgba(220,255,130,${0.22 + pulse / 2})`);
      g.addColorStop(1, "rgba(220,255,130,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, 28, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.lineWidth = flash ? 6 : 5.5;
    ctx.strokeStyle = flash ? JUNGLE.gold : "#2E4A16";
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = flash ? 3.4 : 3;
    ctx.strokeStyle = flash ? "#FFF2B0" : "#CDEB7A";
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.stroke();
    // The knot at the loop's top.
    ctx.fillStyle = flash ? JUNGLE.gold : "#F2C75C";
    ctx.beginPath();
    ctx.arc(x, y - 10, 4, 0, Math.PI * 2);
    ctx.fill();
  });
}

/** The vine the hero holds: taut from the anchor to the hands, dark core with a light twist. */
export function drawJungleRope(ctx: CanvasRenderingContext2D, ax: number, ay: number, hx: number, hy: number): void {
  ctx.lineCap = "round";
  ctx.strokeStyle = JUNGLE.vineDark;
  ctx.lineWidth = 5.5;
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(hx, hy);
  ctx.stroke();
  ctx.strokeStyle = JUNGLE.vineLight;
  ctx.lineWidth = 2.4;
  ctx.setLineDash([4, 4]);
  ctx.stroke();
  ctx.setLineDash([]);
}

/** The pterodactyl (the chase): wings beating, long crest and beak; its beak tip at (x + 34, y), the catch line. */
export function drawPterodactyl(ctx: CanvasRenderingContext2D, x: number, y: number, phase: number): void {
  const beat = Math.sin((phase * Math.PI) / 4);
  ctx.save();
  ctx.translate(x, y);
  ctx.lineJoin = "round";
  // Wings: leathery membranes on a long finger bone.
  for (const side of [-1, 1] as const) {
    ctx.fillStyle = side < 0 ? "#6A2E3A" : "#8C3E48";
    ctx.beginPath();
    ctx.moveTo(-6, 0);
    ctx.lineTo(-18, side * (14 + beat * 10) - 6);
    ctx.quadraticCurveTo(-4, side * (10 + beat * 6), 10, 2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#2A0E14";
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
  // Body and tail.
  ctx.fillStyle = "#A24C4E";
  ctx.beginPath();
  ctx.ellipse(0, 1, 13, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#2A0E14";
  ctx.lineWidth = 1.2;
  ctx.stroke();
  // Head: crest back, long beak forward to the catch line.
  ctx.fillStyle = "#B85A54";
  ctx.beginPath();
  ctx.moveTo(10, -3);
  ctx.lineTo(-2, -11);
  ctx.lineTo(14, -6);
  ctx.lineTo(34, 0);
  ctx.lineTo(14, 3);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#FFD93A";
  ctx.beginPath();
  ctx.arc(14, -3, 1.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
