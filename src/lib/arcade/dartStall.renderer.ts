/**
 * Flightpath's darts stall (3 Nov 2026, display only; Joe's audit: Flightpath shared Swish's Ferris wheel, tents and
 * bunting). Inside a funfair darts stall: a striped awning with a string of bulbs, a plank back wall in deep red with
 * prize shelves either side (plush bears, ducks and stars in seeded colours), two spotlights pooling on the wall
 * behind the boards, and the stall's counter across the bottom. Painted in the play view's own px (390 wide, the view's
 * height), over any rectangle, so the play screen's scenery beyond the box carries on with no seam. Nothing collides.
 */
import { artHash } from "./art.renderer";

export interface ViewRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const WALL = "#4A1E26";
const WALL_DARK = "#2E1117";
const PLANK_LINE = "rgba(18,6,8,0.45)";
const SHELF = "#8A5A34";
const SHELF_LIGHT = "#C08A55";
const AWNING_RED = "#C9343C";
const AWNING_CREAM = "#F1E6D2";
const PRIZE = ["#F28AB2", "#6EC7F2", "#F5C64A", "#9B7CF2", "#64D39A", "#F2915C"];

function bulb(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, colour: string): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * 3.4);
  g.addColorStop(0, colour);
  g.addColorStop(0.35, `${colour}55`);
  g.addColorStop(1, `${colour}00`);
  ctx.fillStyle = g;
  ctx.fillRect(x - r * 3.4, y - r * 3.4, r * 6.8, r * 6.8);
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.beginPath();
  ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.35, 0, Math.PI * 2);
  ctx.fill();
}

/** A plush bear sitting on a shelf (its feet at y). */
function bear(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, colour: string): void {
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.ellipse(x, y - 9 * s, 9 * s, 10 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y - 24 * s, 7.5 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x - 6 * s, y - 30 * s, 3 * s, 0, Math.PI * 2);
  ctx.arc(x + 6 * s, y - 30 * s, 3 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.beginPath();
  ctx.ellipse(x, y - 21.5 * s, 3.4 * s, 2.6 * s, 0, 0, Math.PI * 2);
  ctx.ellipse(x, y - 8 * s, 5 * s, 6 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1A0E10";
  ctx.beginPath();
  ctx.arc(x - 2.6 * s, y - 25 * s, 1 * s, 0, Math.PI * 2);
  ctx.arc(x + 2.6 * s, y - 25 * s, 1 * s, 0, Math.PI * 2);
  ctx.fill();
}

/** A rubber duck (its base at y). */
function duck(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, colour: string): void {
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.ellipse(x, y - 6 * s, 10 * s, 6.5 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x - 4 * s, y - 15 * s, 5.5 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#F28A2C";
  ctx.beginPath();
  ctx.moveTo(x - 9 * s, y - 15 * s);
  ctx.lineTo(x - 14 * s, y - 13.5 * s);
  ctx.lineTo(x - 9 * s, y - 12.5 * s);
  ctx.fill();
  ctx.fillStyle = "#1A0E10";
  ctx.beginPath();
  ctx.arc(x - 5.5 * s, y - 16.5 * s, 0.9 * s, 0, Math.PI * 2);
  ctx.fill();
}

/** A stuffed star (centre at y − 10 s). */
function star(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, colour: string): void {
  ctx.fillStyle = colour;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = (i % 2 ? 5 : 11) * s;
    const px = x + Math.cos(a) * r;
    const py = y - 11 * s + Math.sin(a) * r;
    if (i) ctx.lineTo(px, py);
    else ctx.moveTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

/** One shelf of prizes across [x0, x1] at y (the shelf's top), seeded by `salt`. */
function shelf(ctx: CanvasRenderingContext2D, x0: number, x1: number, y: number, salt: number): void {
  for (let x = x0 + 12, i = 0; x < x1 - 8; i++) {
    const h = artHash(i, salt);
    const kind = h % 3;
    const colour = PRIZE[(h >>> 4) % PRIZE.length]!;
    const s = 0.85 + ((h >>> 9) % 4) * 0.08;
    if (kind === 0) bear(ctx, x, y, s, colour);
    else if (kind === 1) duck(ctx, x, y, s, colour);
    else star(ctx, x, y, s, colour);
    x += 22 * s + 4;
  }
  ctx.fillStyle = SHELF;
  ctx.fillRect(x0, y, x1 - x0, 6);
  ctx.fillStyle = SHELF_LIGHT;
  ctx.fillRect(x0, y, x1 - x0, 1.5);
  ctx.fillStyle = "rgba(10,4,6,0.45)";
  ctx.fillRect(x0, y + 6, x1 - x0, 4);
}

/**
 * The stall over `r` (view px): `counterY` is the counter's top edge (the counter runs from there down), `awningH` the
 * awning's depth at the top of the view.
 */
export function paintDartStall(ctx: CanvasRenderingContext2D, r: ViewRect, counterY: number, awningH = 34): void {
  const w = r.x1 - r.x0;
  // The back wall: deep red planks, darker towards the corners.
  const wall = ctx.createLinearGradient(0, r.y0, 0, counterY);
  wall.addColorStop(0, WALL_DARK);
  wall.addColorStop(0.5, WALL);
  wall.addColorStop(1, WALL_DARK);
  ctx.fillStyle = wall;
  ctx.fillRect(r.x0, r.y0, w, counterY - r.y0);
  ctx.fillStyle = PLANK_LINE;
  for (let x = Math.floor(r.x0 / 30) * 30; x < r.x1; x += 30) ctx.fillRect(x, r.y0, 1.2, counterY - r.y0);
  for (let i = 0; i < 40; i++) {
    const h = artHash(i, 3301);
    ctx.fillStyle = "rgba(255,210,190,0.04)";
    ctx.fillRect(Math.floor(((h >>> 4) % 1000) / 1000 * w / 30) * 30 + r.x0 + 1.2, r.y0 + ((h >>> 14) % 1000) / 1000 * (counterY - r.y0), 28.8, 2 + (h % 30));
  }
  // The two spotlights' pools on the wall behind the boards.
  for (const sx of [120, 270]) {
    const pool = ctx.createRadialGradient(sx, 300, 10, sx, 300, 260);
    pool.addColorStop(0, "rgba(255,214,160,0.24)");
    pool.addColorStop(0.5, "rgba(255,170,120,0.08)");
    pool.addColorStop(1, "rgba(255,170,120,0)");
    ctx.fillStyle = pool;
    ctx.fillRect(sx - 260, 40, 520, 520);
  }
  // Prize shelves down both sides.
  for (const [x0, x1] of [[r.x0 - 40, 70], [320, r.x1 + 40]] as const) {
    for (let k = 0; k < 6; k++) {
      const y = 150 + k * 110;
      if (y > counterY - 40) break;
      shelf(ctx, x0, x1, y, 211 + k * 17 + (x0 < 0 ? 0 : 101));
    }
  }
  // Prizes hung on hooks along the top, under the awning (sides only, clear of the boards' middle).
  for (let i = 0; i < 8; i++) {
    const x = i < 4 ? 14 + i * 18 : 320 + (i - 4) * 18;
    const h = artHash(i, 977);
    ctx.strokeStyle = "rgba(240,220,190,0.5)";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(x, awningH);
    ctx.lineTo(x, awningH + 18);
    ctx.stroke();
    star(ctx, x, awningH + 40, 0.75, PRIZE[(h >>> 3) % PRIZE.length]!);
  }
  // The awning: red and cream stripes with a scalloped hem and a string of bulbs.
  const stripe = 22;
  for (let x = Math.floor(r.x0 / stripe) * stripe, i = 0; x < r.x1; x += stripe, i++) {
    ctx.fillStyle = (Math.floor(x / stripe) & 1) ? AWNING_CREAM : AWNING_RED;
    ctx.fillRect(x, r.y0, stripe, awningH - 6 - r.y0);
    ctx.beginPath();
    ctx.ellipse(x + stripe / 2, awningH - 6, stripe / 2, 6, 0, 0, Math.PI);
    ctx.fill();
  }
  const shade = ctx.createLinearGradient(0, r.y0, 0, awningH);
  shade.addColorStop(0, "rgba(20,6,8,0.35)");
  shade.addColorStop(1, "rgba(20,6,8,0)");
  ctx.fillStyle = shade;
  ctx.fillRect(r.x0, r.y0, w, awningH - r.y0);
  for (let x = Math.floor(r.x0 / 26) * 26 + 13; x < r.x1; x += 26) bulb(ctx, x, awningH + 2, 2.2, Math.floor(x / 26) % 3 === 1 ? "#FF8FB8" : "#FFD27A");
  // The counter: a varnished top lit from above, a striped front panel below.
  const top = counterY;
  ctx.fillStyle = "#9B6A3E";
  ctx.fillRect(r.x0, top, w, 10);
  ctx.fillStyle = "rgba(255,230,190,0.5)";
  ctx.fillRect(r.x0, top, w, 1.5);
  ctx.fillStyle = "#5A3A20";
  ctx.fillRect(r.x0, top + 10, w, 3);
  const panelTop = top + 13;
  if (r.y1 > panelTop) {
    for (let x = Math.floor(r.x0 / 30) * 30; x < r.x1; x += 30) {
      ctx.fillStyle = (Math.floor(x / 30) & 1) ? "#E9DCC4" : "#B8303A";
      ctx.fillRect(x, panelTop, 30, r.y1 - panelTop);
    }
    const g = ctx.createLinearGradient(0, panelTop, 0, panelTop + 140);
    g.addColorStop(0, "rgba(16,6,4,0.35)");
    g.addColorStop(1, "rgba(16,6,4,0.7)");
    ctx.fillStyle = g;
    ctx.fillRect(r.x0, panelTop, w, r.y1 - panelTop);
  }
}
