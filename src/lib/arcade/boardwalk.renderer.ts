/**
 * Swish's seaside boardwalk at dusk (3 Nov 2026, display only; Joe's audit: Swish shared Flightpath's Ferris wheel,
 * tents and bunting, so the two read as one game). Never imported by the sim or the server; nothing here collides.
 *
 * The static scene (painted once per size into a device layer): the dusk sky with a few stars and warm cloud streaks,
 * the sun going down into the sea, a dark headland with a lighthouse on the left, the pier running out to sea on the
 * right with its pavilion and a string of lights (and their reflections), the sea's swell and the sun's path on it,
 * the boardwalk's white railing behind the buckets, two lamp posts, and the planked deck from the floor line down to
 * the screen's bottom in perspective. Painted in Swish's binRev 7+ world px (the floor at `floor`), over any rectangle,
 * so the play screen's scenery beyond the world (`boardwalkArenaScene`) carries the same scene on with no seam.
 */
import { artHash, reducedMotion } from "./art.renderer";
import { deviceLayer } from "./cache.renderer";

export interface WorldRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** The sea's horizon sits this far above the floor line; the railing's top rail this far. */
export const BOARDWALK_HORIZON_UP = 178;
const RAIL_TOP_UP = 46;
const RAIL_MID_UP = 24;

const SKY: readonly (readonly [number, string])[] = [
  [0, "#070B24"],
  [0.35, "#18204E"],
  [0.62, "#47306A"],
  [0.82, "#A24C64"],
  [0.94, "#EE8048"],
  [1, "#FFC07A"],
];

function skyGradient(ctx: CanvasRenderingContext2D, top: number, horizon: number): CanvasGradient {
  const g = ctx.createLinearGradient(0, top, 0, horizon);
  for (const [at, c] of SKY) g.addColorStop(at, c);
  return g;
}

function glowBulb(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, colour: string, halo = 3.4): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * halo);
  g.addColorStop(0, colour);
  g.addColorStop(0.35, `${colour}55`);
  g.addColorStop(1, `${colour}00`);
  ctx.fillStyle = g;
  ctx.fillRect(x - r * halo, y - r * halo, r * halo * 2, r * halo * 2);
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

/** The whole static scene over `r` (world px). */
export function paintBoardwalk(ctx: CanvasRenderingContext2D, r: WorldRect, floor: number): void {
  const horizon = floor - BOARDWALK_HORIZON_UP;
  const w = r.x1 - r.x0;
  const skyTop = Math.min(r.y0, floor - 760);
  // Sky.
  ctx.fillStyle = skyGradient(ctx, skyTop, horizon);
  ctx.fillRect(r.x0, r.y0, w, Math.max(0, horizon - r.y0));
  // Stars, fading towards the sunset.
  for (let i = 0; i < 120; i++) {
    const h = artHash(i, 4513);
    const x = r.x0 + ((h >>> 4) % 10007) / 10007 * w;
    const y = skyTop + ((h >>> 16) % 9973) / 9973 * (horizon - skyTop) * 0.62;
    if (y < r.y0) continue;
    const fade = Math.max(0, 1 - (y - skyTop) / ((horizon - skyTop) * 0.64));
    ctx.globalAlpha = (0.2 + (h % 5) * 0.12) * fade;
    ctx.fillStyle = h % 4 === 0 ? "#CFE0FF" : "#F4EDE0";
    const d = h % 9 === 0 ? 1.7 : 1;
    ctx.fillRect(x, y, d, d);
  }
  ctx.globalAlpha = 1;
  // The moon, high on the right, with a soft halo; a few gulls gliding below it (static).
  const mx = 340;
  const my = floor - 560;
  if (my + 60 > r.y0) {
    const halo = ctx.createRadialGradient(mx, my, 8, mx, my, 90);
    halo.addColorStop(0, "rgba(220,228,255,0.22)");
    halo.addColorStop(1, "rgba(220,228,255,0)");
    ctx.fillStyle = halo;
    ctx.fillRect(mx - 90, my - 90, 180, 180);
    ctx.fillStyle = "#EEF0FA";
    ctx.beginPath();
    ctx.arc(mx, my, 17, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(170,178,210,0.45)";
    for (const [dx, dy, rr] of [[-5, -4, 4], [6, 3, 3], [-2, 8, 2.5]] as const) {
      ctx.beginPath();
      ctx.arc(mx + dx, my + dy, rr, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.strokeStyle = "rgba(20,16,40,0.75)";
  ctx.lineCap = "round";
  for (let i = 0; i < 5; i++) {
    const h = artHash(i, 6043);
    const gx = 70 + ((h >>> 4) % 300);
    const gy = floor - 300 - ((h >>> 12) % 200);
    const s = 4 + (h % 4);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(gx - s, gy - s * 0.3);
    ctx.quadraticCurveTo(gx - s * 0.5, gy - s * 0.7, gx, gy);
    ctx.quadraticCurveTo(gx + s * 0.5, gy - s * 0.7, gx + s, gy - s * 0.3);
    ctx.stroke();
  }
  // Warm cloud streaks low in the sky.
  for (let i = 0; i < 9; i++) {
    const h = artHash(i, 977);
    const y = horizon - 20 - (h % 150);
    const x = r.x0 + ((h >>> 8) % 1000) / 1000 * w;
    const len = 70 + ((h >>> 18) % 140);
    const g = ctx.createLinearGradient(x - len / 2, 0, x + len / 2, 0);
    g.addColorStop(0, "rgba(255,170,130,0)");
    g.addColorStop(0.5, y > horizon - 70 ? "rgba(255,186,130,0.55)" : "rgba(190,110,150,0.45)");
    g.addColorStop(1, "rgba(255,170,130,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, y, len / 2, 2 + (h % 3), 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // The sun, half down into the sea, and its bloom.
  const sunX = 150;
  const bloom = ctx.createRadialGradient(sunX, horizon, 4, sunX, horizon, 230);
  bloom.addColorStop(0, "rgba(255,214,150,0.65)");
  bloom.addColorStop(0.3, "rgba(255,150,90,0.25)");
  bloom.addColorStop(1, "rgba(255,120,90,0)");
  ctx.fillStyle = bloom;
  ctx.fillRect(r.x0, horizon - 230, w, 230);
  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x0, r.y0, w, horizon - r.y0);
  ctx.clip();
  const sun = ctx.createRadialGradient(sunX, horizon - 6, 2, sunX, horizon, 30);
  sun.addColorStop(0, "#FFF4D0");
  sun.addColorStop(0.6, "#FFC877");
  sun.addColorStop(1, "#FF9A55");
  ctx.fillStyle = sun;
  ctx.beginPath();
  ctx.arc(sunX, horizon + 4, 28, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // The headland and its lighthouse (left).
  ctx.fillStyle = "#1B1330";
  ctx.beginPath();
  ctx.moveTo(r.x0 - 10, horizon + 1);
  ctx.lineTo(r.x0 - 10, horizon - 26);
  ctx.quadraticCurveTo(20, horizon - 40, 58, horizon - 30);
  ctx.quadraticCurveTo(84, horizon - 22, 104, horizon - 6);
  ctx.lineTo(118, horizon + 1);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#EDE4D6";
  ctx.fillRect(40, horizon - 62, 6, 30);
  ctx.fillStyle = "#C8434A";
  ctx.fillRect(40, horizon - 52, 6, 4);
  ctx.fillRect(40, horizon - 42, 6, 4);
  ctx.fillStyle = "#2A1F3C";
  ctx.fillRect(38.5, horizon - 66, 9, 4);
  glowBulb(ctx, 43, horizon - 69, 2.2, "#FFE6A0", 5);
  const beam = ctx.createLinearGradient(43, 0, 130, 0);
  beam.addColorStop(0, "rgba(255,236,170,0.22)");
  beam.addColorStop(1, "rgba(255,236,170,0)");
  ctx.fillStyle = beam;
  ctx.beginPath();
  ctx.moveTo(45, horizon - 70);
  ctx.lineTo(135, horizon - 84);
  ctx.lineTo(135, horizon - 60);
  ctx.closePath();
  ctx.fill();
  // The sea: a deep blue under the sky's glow, then darker towards the boardwalk.
  const sea = ctx.createLinearGradient(0, horizon, 0, floor);
  sea.addColorStop(0, "#5B4A7A");
  sea.addColorStop(0.12, "#33386A");
  sea.addColorStop(1, "#141B3A");
  ctx.fillStyle = sea;
  ctx.fillRect(r.x0, horizon, w, floor - horizon);
  // The sun's path on the water: broken gold dashes, wider nearer.
  for (let i = 0; i < 46; i++) {
    const h = artHash(i, 31);
    const u = (i + 0.5) / 46;
    const y = horizon + 2 + u * u * (floor - horizon - 10);
    const half = 4 + u * 30;
    const x = sunX + (((h >>> 6) % 1000) / 1000 - 0.5) * half * 1.6;
    ctx.globalAlpha = 0.55 * (1 - u * 0.6);
    ctx.fillStyle = h % 3 === 0 ? "#FFE2A8" : "#FFB16E";
    ctx.fillRect(x - half * 0.4, y, half * (0.4 + ((h >>> 3) % 5) / 8), 1 + u * 1.2);
  }
  ctx.globalAlpha = 1;
  // Swell: soft lighter lines across the water.
  for (let i = 0; i < 60; i++) {
    const h = artHash(i, 7717);
    const u = ((h >>> 4) % 1000) / 1000;
    const y = horizon + 4 + u * u * (floor - horizon - 6);
    const x = r.x0 + ((h >>> 14) % 1000) / 1000 * w;
    const len = 6 + u * 34;
    ctx.globalAlpha = 0.12 + 0.1 * (1 - u);
    ctx.fillStyle = "#A9B8E8";
    ctx.fillRect(x, y, len, 1);
  }
  ctx.globalAlpha = 1;
  // The pier (right): piles into the water, the deck, a pavilion with domes, a string of lights and their reflections.
  const deckY = horizon + 22;
  const pierX0 = 238;
  ctx.fillStyle = "#211832";
  for (let x = pierX0 + 6; x < r.x1 + 40; x += 15) ctx.fillRect(x, deckY, 2.2, 22);
  ctx.fillStyle = "#2A1F3E";
  ctx.fillRect(pierX0, deckY - 3, r.x1 + 40 - pierX0, 5);
  ctx.fillStyle = "#1B1330";
  ctx.fillRect(pierX0 + 2, deckY - 11, r.x1 + 40 - pierX0, 1.2);
  for (let x = pierX0 + 4; x < r.x1 + 40; x += 9) ctx.fillRect(x, deckY - 11, 1, 8);
  // The pavilion.
  const pv = 318;
  ctx.fillStyle = "#2A1F3E";
  ctx.fillRect(pv - 34, deckY - 38, 68, 35);
  ctx.beginPath();
  ctx.arc(pv, deckY - 38, 16, Math.PI, 0);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(pv - 30, deckY - 38, 7, Math.PI, 0);
  ctx.arc(pv + 30, deckY - 38, 7, Math.PI, 0);
  ctx.fill();
  ctx.fillRect(pv - 0.8, deckY - 64, 1.6, 12);
  ctx.fillStyle = "rgba(255,206,130,0.75)";
  for (let i = 0; i < 6; i++) ctx.fillRect(pv - 28 + i * 10, deckY - 28, 5, 8);
  // The lights: a sagging string between posts, warm and pink bulbs, each reflected in the water.
  const bulbs: { x: number; y: number; c: string }[] = [];
  for (let x = pierX0 + 2, i = 0; x < r.x1 + 30; x += 12, i++) {
    const seg = ((x - pierX0) % 48) / 48;
    const y = deckY - 16 + Math.sin(seg * Math.PI) * 3;
    bulbs.push({ x, y, c: i % 3 === 1 ? "#FF8FB8" : "#FFD27A" });
  }
  ctx.strokeStyle = "rgba(20,12,24,0.7)";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  bulbs.forEach((b, i) => (i ? ctx.lineTo(b.x, b.y) : ctx.moveTo(b.x, b.y)));
  ctx.stroke();
  for (const b of bulbs) {
    glowBulb(ctx, b.x, b.y, 1.5, b.c, 3.6);
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = b.c;
    ctx.fillRect(b.x - 1, deckY + 24, 2, 14);
    ctx.globalAlpha = 1;
  }
  // The railing behind the buckets: posts, top and middle rails and balusters, lit warm from the lamps.
  const railTop = floor - RAIL_TOP_UP;
  const railMid = floor - RAIL_MID_UP;
  ctx.fillStyle = "rgba(10,8,20,0.35)";
  ctx.fillRect(r.x0, railTop + 2, w, floor - railTop - 2);
  ctx.fillStyle = "#C9BCA8";
  for (let x = Math.floor(r.x0 / 9) * 9 + 4; x < r.x1; x += 9) ctx.fillRect(x, railTop + 4, 2, floor - railTop - 4);
  ctx.fillStyle = "#E9DFCC";
  for (let x = Math.floor(r.x0 / 54) * 54 + 20; x < r.x1; x += 54) {
    ctx.fillRect(x - 3, railTop - 6, 6, floor - railTop + 6);
    ctx.fillStyle = "#F4EDE0";
    ctx.fillRect(x - 4, railTop - 9, 8, 3);
    ctx.fillStyle = "#E9DFCC";
  }
  ctx.fillStyle = "#EFE6D4";
  ctx.fillRect(r.x0, railTop, w, 5);
  ctx.fillStyle = "#DCD0BC";
  ctx.fillRect(r.x0, railMid, w, 3);
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.fillRect(r.x0, railTop, w, 1);
  // Two lamp posts on the railing, their globes lit, pools of light on the deck below.
  for (const lx of [12, 418]) {
    const top = floor - 196;
    ctx.fillStyle = "#171222";
    ctx.fillRect(lx - 2.5, top + 8, 5, floor - top - 8);
    ctx.fillRect(lx - 6, floor - 10, 12, 10);
    ctx.fillRect(lx - 12, top + 8, 24, 3);
    glowBulb(ctx, lx - 9, top + 4, 5, "#FFE2A0", 6);
    glowBulb(ctx, lx + 9, top + 4, 5, "#FFE2A0", 6);
  }
  // The deck: planks running out from the railing in perspective (towards the sun's vanishing point), the floor's lip.
  const deckBottom = Math.max(r.y1, floor + 1);
  const deck = ctx.createLinearGradient(0, floor, 0, floor + 220);
  deck.addColorStop(0, "#7E5A3E");
  deck.addColorStop(1, "#4A321F");
  ctx.fillStyle = deck;
  ctx.fillRect(r.x0, floor, w, deckBottom - floor);
  const vx = 215;
  const k = (y: number) => (y - horizon) / (floor - horizon);
  for (let i = -40; i <= 40; i++) {
    const xf = vx + i * 26;
    const a = { x: vx + (xf - vx) * k(floor), y: floor };
    const b = { x: vx + (xf - vx) * k(deckBottom), y: deckBottom };
    if (Math.max(a.x, b.x) < r.x0 - 40 || Math.min(a.x, b.x) > r.x1 + 40) continue;
    const b2 = { x: vx + (xf + 26 - vx) * k(deckBottom), y: deckBottom };
    const a2 = { x: vx + (xf + 26 - vx) * k(floor), y: floor };
    if ((i & 1) === 0) {
      ctx.fillStyle = "rgba(255,226,180,0.05)";
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(a2.x, a2.y);
      ctx.lineTo(b2.x, b2.y);
      ctx.lineTo(b.x, b.y);
      ctx.closePath();
      ctx.fill();
    }
    ctx.strokeStyle = "rgba(34,20,10,0.55)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  // Cross joints: a stagger of short butt joints, closer together towards the railing.
  ctx.fillStyle = "rgba(34,20,10,0.4)";
  for (let j = 0; j < 14; j++) {
    const y = floor + 6 + j * j * 1.9;
    if (y > deckBottom) break;
    for (let i = -40; i <= 40; i++) {
      if (((i + j) & 3) !== 0) continue;
      const xa = vx + (i * 26) * k(y);
      if (xa < r.x0 - 30 || xa > r.x1 + 30) continue;
      ctx.fillRect(xa, y, 26 * k(y), 1);
    }
  }
  // Lamp light pooled on the planks, and the lip along the floor line.
  for (const lx of [12, 418]) {
    const pool = ctx.createRadialGradient(lx, floor + 30, 4, lx, floor + 30, 120);
    pool.addColorStop(0, "rgba(255,206,140,0.28)");
    pool.addColorStop(1, "rgba(255,206,140,0)");
    ctx.fillStyle = pool;
    ctx.fillRect(lx - 120, floor, 240, Math.min(deckBottom - floor, 160));
  }
  ctx.fillStyle = "#B88C60";
  ctx.fillRect(r.x0, floor, w, 2.5);
  ctx.fillStyle = "rgba(255,236,200,0.4)";
  ctx.fillRect(r.x0, floor, w, 1);
  const shade = ctx.createLinearGradient(0, floor + 2, 0, floor + 14);
  shade.addColorStop(0, "rgba(20,10,4,0.4)");
  shade.addColorStop(1, "rgba(20,10,4,0)");
  ctx.fillStyle = shade;
  ctx.fillRect(r.x0, floor + 2, w, 12);
  // The deck darkening far below the world (the scenery under the box).
  if (deckBottom > floor + 200) {
    const g = ctx.createLinearGradient(0, floor + 200, 0, deckBottom);
    g.addColorStop(0, "rgba(10,6,3,0)");
    g.addColorStop(1, "rgba(10,6,3,0.4)");
    ctx.fillStyle = g;
    ctx.fillRect(r.x0, floor + 200, w, deckBottom - floor - 200);
  }
}

/** The pier lights' twinkle, drawn over the static scene each frame (still under reduced motion). */
export function boardwalkTwinkle(ctx: CanvasRenderingContext2D, floor: number, now: number): void {
  if (reducedMotion()) return;
  const deckY = floor - BOARDWALK_HORIZON_UP + 22;
  ctx.save();
  for (let x = 240, i = 0; x < 440; x += 12, i++) {
    const glow = 0.5 + 0.5 * Math.sin(now / 700 + i * 1.9);
    if (glow < 0.75) continue;
    const seg = ((x - 238) % 48) / 48;
    const y = deckY - 16 + Math.sin(seg * Math.PI) * 3;
    ctx.globalAlpha = (glow - 0.75) * 1.6;
    ctx.fillStyle = "#FFF1C8";
    ctx.beginPath();
    ctx.arc(x, y, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** The static scene through a device layer: painted once per canvas size and transform, then blitted. */
export function boardwalkLayer(ctx: CanvasRenderingContext2D, key: string, r: WorldRect, floor: number): void {
  deviceLayer(ctx, `boardwalk:${key}:${r.x0.toFixed(1)},${r.y0.toFixed(1)},${r.x1.toFixed(1)},${r.y1.toFixed(1)}:${floor}`, (c) => paintBoardwalk(c, r, floor));
}
