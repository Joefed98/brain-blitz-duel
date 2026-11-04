import { successFrame, SUCCESS_ACCENTS } from "./success.renderer";
import { arcadeFx } from "./arcadeFx.renderer";
import { BULLSEYE_FX, BULLSEYE_FX_V8 } from "./arcadeFxGames.renderer";
/**
 * Bullseye in the Fairground world: painted wooden board on a hay bale,
 * throwing darts, chalk aim line. Render only; reads state, never writes it.
 * Rings use the sim's exact geometry and values; darts land at exact sim points.
 */
import type { CanvasSize } from "./engine";
import {
  BULLSEYE_ARROWS, BULLSEYE_BOW_X, BULLSEYE_BOW_Y, BULLSEYE_CX, BULLSEYE_CY,
  BULLSEYE_DRIFT_FROM, BULLSEYE_FLIGHT_TICKS, BULLSEYE_GOLD, BULLSEYE_OUTER_R, BULLSEYE_RINGS,
  BULLSEYE_RING_STEP, BULLSEYE_TEXT, BULLSEYE_WIND_MAX, BULLSEYE_WORLD_H, BULLSEYE_WORLD_W,
  BULLSEYE_BALLOON_R, BULLSEYE_INNER_BULL_DIV, BULLSEYE_REV, BULLSEYE_TUNE,
  bullseyeBalloonPos, bullseyeBalloonValue, bullseyeRingValues, bullseyeScalePct, bullseyeTargetDx, type BullseyeState,
  BULLSEYE_EXPAND, BULLSEYE_V8_LIFT, BULLSEYE_V8_DEAD_DIV, bullseyeDeadEach, bullseyeBoard, bullseyeDxOf, bullseyeIsBull,
} from "./bullseye";
import { flightpathColour, flightpathInk } from "./flightpathPalette.renderer";
import { reducedMotion } from "./art.renderer";
import { artCanvas, artContext, type ArtCanvas } from "./cache.renderer";
import {
  FAIR_CHALK, FAIR_WOOD, FAIR_WOOD_DARK, fairArenaScene, fairChangeAge, fairClock, fairScreen, fairTransform,
} from "./fairground.renderer";
import type { ArenaSceneView } from "./arenaScene.renderer";
import { deviceLayer } from "./cache.renderer";
import { paintDartStall } from "./dartStall.renderer";
import { sportsChip, sportsChipRow } from "./sportsHud.renderer";

/** The counter line: below the resting dart's flights. */
const COUNTER_Y = 546;
const DART_TIP_Y = BULLSEYE_BOW_Y - 26;
const FLIGHT_COLOURS = ["#D9363E", "#2ED3B7", "#F5B82E", "#3B82F6", "#A78BFA"];

/**
 * A throwing dart, tip at (x, y) pointing up; `wobble` swings the flights. Phone-test notes (27 Oct 2026): matte
 * black with a thin light edge, so it reads on the light rings, the dusk sky and the counter alike; the dart's own
 * colour is the stripe down each flight. The tip is still exactly (x, y), the point the sim scores.
 */
export function drawDart(
  ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, colour: string, wobble = 0,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  const body = () => {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(1.3, 8);
    ctx.lineTo(2.2, 8);
    ctx.lineTo(2.2, 17);
    ctx.lineTo(0.9, 17);
    ctx.lineTo(0.9, 22);
    ctx.lineTo(-0.9, 22);
    ctx.lineTo(-0.9, 17);
    ctx.lineTo(-2.2, 17);
    ctx.lineTo(-2.2, 8);
    ctx.lineTo(-1.3, 8);
    ctx.closePath();
  };
  const flight = (side: number) => {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(5.5 * side, 4);
    ctx.lineTo(5 * side, 10);
    ctx.lineTo(0, 8);
    ctx.closePath();
  };
  // A light edge first (under the fill), then the black body.
  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(255, 248, 235, 0.9)";
  ctx.lineWidth = 1.6;
  body();
  ctx.stroke();
  ctx.save();
  ctx.translate(0, 21);
  ctx.transform(1, 0, wobble, 1, 0, 0);
  for (const side of [-1, 1]) {
    flight(side);
    ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = "#0B0B0F";
  body();
  ctx.fill();
  // A faint sheen down the barrel's left and a few knurl lines.
  ctx.fillStyle = "rgba(255,255,255,0.22)";
  ctx.fillRect(-1.6, 8.5, 0.6, 8);
  ctx.fillStyle = "rgba(255,255,255,0.1)";
  for (let k = 10; k < 17; k += 2) ctx.fillRect(-2.2, k, 4.4, 0.6);
  // Black flights, with the dart's own colour as a stripe down each.
  ctx.translate(0, 21);
  ctx.transform(1, 0, wobble, 1, 0, 0);
  for (const side of [-1, 1]) {
    ctx.fillStyle = "#16171B";
    flight(side);
    ctx.fill();
    ctx.strokeStyle = colour;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(1 * side, 2.2);
    ctx.lineTo(3.6 * side, 7.6);
    ctx.stroke();
  }
  ctx.restore();
}

/** Rev 2: the inner bull, the sim's exact disc, gold with a white spark. */
function drawInnerBull(ctx: CanvasRenderingContext2D, scalePct: number, dx: number, cy = BULLSEYE_CY): void {
  const r = (BULLSEYE_OUTER_R * scalePct) / (100 * BULLSEYE_INNER_BULL_DIV);
  ctx.save();
  ctx.fillStyle = "#FFF4C2";
  ctx.beginPath();
  ctx.arc(BULLSEYE_CX + dx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#B8860B";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

/** bullRev 8: the dead-centre ring, a quarter of the bull's radius, a white hairline (drawn exactly at its scoring edge). */
function drawDeadCentre(ctx: CanvasRenderingContext2D, scalePct: number, dx: number, cy: number): void {
  const r = (BULLSEYE_OUTER_R * scalePct) / (100 * BULLSEYE_V8_DEAD_DIV);
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.95)";
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.arc(BULLSEYE_CX + dx, cy, r - 0.6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#B8860B";
  ctx.beginPath();
  ctx.arc(BULLSEYE_CX + dx, cy, 1.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

const BALLOON_COLOURS = ["#E8384F", "#3B82F6", "#22C55E", "#A855F7"];
/** bullRev 4: balloon colour by value, +1 green, +2 blue, +3 purple. */
const VALUE_BALLOON_COLOURS: Readonly<Record<number, string>> = { 1: "#22C55E", 2: "#3B82F6", 3: "#A855F7" };

function balloonColour(state: BullseyeState, arrow: number): string {
  if (state.tune === BULLSEYE_TUNE) return VALUE_BALLOON_COLOURS[bullseyeBalloonValue(state, arrow)] ?? "#22C55E";
  return BALLOON_COLOURS[arrow % BALLOON_COLOURS.length]!;
}

/** Rev 2 / bullRev 4: a fairground balloon whose body is exactly the sim's pop circle. */
function drawBalloon(ctx: CanvasRenderingContext2D, x: number, y: number, colour: string, label = "12"): void {
  const r = BULLSEYE_BALLOON_R;
  ctx.save();
  // A short tied string below the knot (2 px: within the bounds rule).
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.moveTo(x - 2, y + r + 2);
  ctx.lineTo(x + 2, y + r + 2);
  ctx.lineTo(x, y + r - 1);
  ctx.closePath();
  ctx.fill();
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, 1, x, y, r);
  g.addColorStop(0, "#FFFFFF");
  g.addColorStop(0.18, colour);
  g.addColorStop(1, colour);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  // Shaded far edge and a soft gloss streak (inside the circle).
  const edge = ctx.createRadialGradient(x - r * 0.2, y - r * 0.25, r * 0.4, x, y, r);
  edge.addColorStop(0, "rgba(0,0,0,0)");
  edge.addColorStop(1, "rgba(0,0,0,0.28)");
  ctx.fillStyle = edge;
  ctx.fill();
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = Math.max(1, r * 0.12);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(x, y, r * 0.7, Math.PI * 1.15, Math.PI * 1.4);
  ctx.stroke();
  ctx.restore();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  // A white rim (inside the 2 px bounds rule) keeps it readable over any ring colour.
  ctx.strokeStyle = label === "12" ? "rgba(0, 0, 0, 0.35)" : "#FFFFFF";
  ctx.lineWidth = label === "12" ? 1 : 1.5;
  ctx.stroke();
  ctx.font = label === "12" ? "700 9px 'JetBrains Mono', ui-monospace, monospace" : "800 11px 'JetBrains Mono', ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (label !== "12") {
    ctx.strokeStyle = "rgba(0, 0, 0, 0.55)";
    ctx.lineWidth = 2.5;
    ctx.lineJoin = "round";
    ctx.strokeText(label, x, y + 1);
  }
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText(label, x, y + 1);
  ctx.restore();
}

/** Rev 2: rubber shreds flying out from a popped balloon. Presentation clock only. */
function drawBalloonPop(ctx: CanvasRenderingContext2D, x: number, y: number, colour: string, age: number): void {
  if (age > 420) return;
  const u = age / 420;
  ctx.save();
  ctx.globalAlpha = 1 - u;
  ctx.fillStyle = colour;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.3;
    const d = BULLSEYE_BALLOON_R * (0.6 + u * 1.8);
    ctx.fillRect(x + Math.cos(a) * d - 2, y + Math.sin(a) * d - 1.5, 4, 3);
  }
  ctx.strokeStyle = "#FFFFFF";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, BULLSEYE_BALLOON_R * (1 + u), 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

const boardSprites = new Map<string, ArtCanvas | null>();

/**
 * The board on its hay bale with the lamp glow behind it, cached per size,
 * ring values and device scale and blitted at the drifted centre (the sprite
 * is painted at the same world size, so every ring keeps its sim radius).
 */
function drawBoard(ctx: CanvasRenderingContext2D, scalePct: number, dx: number, values: readonly number[], drifting: boolean, cy = BULLSEYE_CY, post = 0): void {
  const outer = (BULLSEYE_OUTER_R * scalePct) / 100;
  const cx = BULLSEYE_CX + dx;
  ctx.save();
  // bullRev 8: the board stands on a wooden post down to the counter (further boards on longer, thinner posts).
  if (post > 0) drawPost(ctx, cx, cy + outer + 26, post, scalePct);
  // Rail behind the counter for the drifting target.
  if (drifting) {
    const railY = cy + outer + 30;
    ctx.fillStyle = "#2A2E36";
    ctx.fillRect(BULLSEYE_CX - 170, railY, 340, 4);
    ctx.fillStyle = "#555C68";
    ctx.fillRect(BULLSEYE_CX - 170, railY, 340, 1);
    for (const wx of [cx - 24, cx + 24]) {
      ctx.fillStyle = "#15171B";
      ctx.beginPath();
      ctx.arc(wx, railY, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
  const half = Math.ceil(outer * 1.9);
  const t = typeof ctx.getTransform === "function" ? ctx.getTransform() : null;
  const k = t ? Math.max(0.1, Math.hypot(t.a, t.b)) : 1;
  const px = Math.max(1, Math.round(half * 2 * k));
  const id = `${scalePct}|${values.join(",")}|${px}`;
  let sprite = boardSprites.get(id);
  if (sprite === undefined) {
    if (boardSprites.size >= 12) boardSprites.clear();
    const canvas = artCanvas(px, px);
    const c = canvas ? artContext(canvas) : null;
    if (canvas && c) {
      c.scale(px / (half * 2), px / (half * 2));
      paintBoard(c as CanvasRenderingContext2D, half, half, scalePct, values);
    }
    sprite = canvas && c ? canvas : null;
    boardSprites.set(id, sprite);
  }
  if (sprite) ctx.drawImage(sprite as CanvasImageSource, cx - half, cy - half, half * 2, half * 2);
  else paintBoard(ctx, cx, cy, scalePct, values);
  // Ring values are drawn live, never cached, so they always use the loaded web font.
  ctx.save();
  ctx.font = "700 9px 'JetBrains Mono', ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let index = 0; index < BULLSEYE_RINGS; index++) {
    const o = (BULLSEYE_RING_STEP * (index + 1) * scalePct) / 100;
    const inner = index === 0 ? 0 : (BULLSEYE_RING_STEP * index * scalePct) / 100;
    const value = values[index] ?? 0;
    ctx.fillStyle = flightpathInk(value);
    ctx.fillText(String(value), cx, cy - Math.max(8, (o + inner) / 2));
  }
  ctx.restore();
}

/** bullRev 8: a wooden post from under the hay bale down to the counter line; scenery behind the board. */
function drawPost(ctx: CanvasRenderingContext2D, x: number, top: number, bottom: number, scalePct: number): void {
  if (bottom <= top) return;
  const w = Math.max(4, (9 * scalePct) / 100);
  const wood = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
  wood.addColorStop(0, "#B07A47");
  wood.addColorStop(0.45, FAIR_WOOD);
  wood.addColorStop(1, FAIR_WOOD_DARK);
  ctx.fillStyle = wood;
  ctx.fillRect(x - w / 2, top, w, bottom - top);
  // A darker band where the post meets the bale and a soft shade fading down it (dusk, further back).
  ctx.fillStyle = "rgba(20,10,4,0.45)";
  ctx.fillRect(x - w / 2, top, w, 3);
  const haze = ctx.createLinearGradient(0, top, 0, bottom);
  haze.addColorStop(0, "rgba(13,24,56,0)");
  haze.addColorStop(1, `rgba(13,24,56,${(0.55 * (110 - scalePct)) / 100})`);
  ctx.fillStyle = haze;
  ctx.fillRect(x - w / 2, top, w, bottom - top);
}

export function paintBoard(ctx: CanvasRenderingContext2D, cx: number, cy: number, scalePct: number, values: readonly number[]): void {
  const outer = (BULLSEYE_OUTER_R * scalePct) / 100;
  ctx.save();
  // A warm stall lamp lighting the wall behind the board (background only).
  const spot = ctx.createRadialGradient(cx, cy, outer * 0.6, cx, cy, outer * 1.9);
  spot.addColorStop(0, "rgba(255,214,140,0.3)");
  spot.addColorStop(0.5, "rgba(255,190,110,0.16)");
  spot.addColorStop(1, "rgba(255,214,140,0)");
  ctx.fillStyle = spot;
  ctx.fillRect(cx - outer * 1.9, cy - outer * 1.9, outer * 3.8, outer * 3.8);
  // Hay bale under the board: lit top, loose straw, two twine bands and a shaded base.
  const bw = outer * 2.1;
  const bTop = cy + outer * 0.35;
  const bBot = cy + outer + 26;
  const bh = bBot - bTop;
  const hay = ctx.createLinearGradient(0, bTop, 0, bBot);
  hay.addColorStop(0, "#DDB85C");
  hay.addColorStop(0.55, "#C9A24A");
  hay.addColorStop(1, "#A9853A");
  ctx.fillStyle = hay;
  ctx.fillRect(cx - bw / 2, bTop, bw, bh);
  // Polish A3: rounded, shaded ends and layered straw (dark under-straw, gold, then lit strands).
  const ends = ctx.createLinearGradient(cx - bw / 2, 0, cx + bw / 2, 0);
  ends.addColorStop(0, "rgba(90,60,15,0.4)");
  ends.addColorStop(0.12, "rgba(90,60,15,0)");
  ends.addColorStop(0.88, "rgba(90,60,15,0)");
  ends.addColorStop(1, "rgba(90,60,15,0.45)");
  ctx.fillStyle = ends;
  ctx.fillRect(cx - bw / 2, bTop, bw, bh);
  ctx.lineWidth = 1;
  const straw = (count: number, seed: number, colour: string, len: number, width: number) => {
    ctx.beginPath();
    for (let i = 0; i < count; i++) {
      const sx = cx - bw / 2 + 2 + ((i * seed) % Math.max(1, bw - 12));
      const sy = bTop + 2 + ((i * (seed + 14)) % Math.max(1, bh - 5));
      const l = len + (i % 5) * 1.5;
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + l, sy + 2 - (i % 4) * 0.9);
    }
    ctx.strokeStyle = colour;
    ctx.lineWidth = width;
    ctx.stroke();
  };
  straw(60, 37, "rgba(110, 76, 24, 0.5)", 6, 1);
  straw(46, 41, "rgba(176, 132, 52, 0.6)", 7, 0.9);
  straw(36, 53, "rgba(255, 236, 170, 0.5)", 6, 0.8);
  // Loose strands standing up along the lit top.
  ctx.beginPath();
  for (let i = 0; i < 18; i++) {
    const sx = cx - bw / 2 + 4 + ((i * 47) % Math.max(1, bw - 8));
    ctx.moveTo(sx, bTop + 1);
    ctx.lineTo(sx + (i % 3) * 1.5 - 1.5, bTop - 2.5 - (i % 4));
  }
  ctx.strokeStyle = "rgba(230, 196, 110, 0.75)";
  ctx.lineWidth = 0.8;
  ctx.stroke();
  ctx.fillStyle = "rgba(255, 240, 190, 0.35)";
  ctx.fillRect(cx - bw / 2, bTop, bw, 1.5);
  ctx.fillStyle = "rgba(70, 45, 10, 0.3)";
  ctx.fillRect(cx - bw / 2, bBot - 3, bw, 3);
  for (const tx of [cx - bw / 2 + bw * 0.22, cx + bw / 2 - bw * 0.22 - 3]) {
    ctx.fillStyle = "#6E4A1E";
    ctx.fillRect(tx, bTop, 3, bh);
    ctx.fillStyle = "rgba(255, 220, 160, 0.35)";
    ctx.fillRect(tx, bTop, 1, bh);
    ctx.fillStyle = "rgba(40, 24, 6, 0.35)";
    ctx.fillRect(tx + 3, bTop, 1, bh);
  }
  // Wooden board: a 2 px wood rim beyond the outer ring.
  ctx.fillStyle = FAIR_WOOD;
  ctx.beginPath();
  ctx.arc(cx, cy, outer + 2, 0, Math.PI * 2);
  ctx.fill();
  // Polish A3: the rim bevelled, lit above and shaded below.
  const bevel = ctx.createLinearGradient(0, cy - outer - 2, 0, cy + outer + 2);
  bevel.addColorStop(0, "#D9A267");
  bevel.addColorStop(0.5, FAIR_WOOD);
  bevel.addColorStop(1, "#3A2210");
  ctx.strokeStyle = bevel;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(cx, cy, outer + 1.1, 0, Math.PI * 2);
  ctx.stroke();
  // Painted rings, exact sim radii, in their value colours.
  for (let ring = BULLSEYE_RINGS; ring >= 1; ring--) {
    const radius = (BULLSEYE_RING_STEP * ring * scalePct) / 100;
    const value = values[ring - 1] ?? 0;
    ctx.fillStyle = flightpathColour(value);
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "rgba(30, 18, 10, 0.75)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  // Wood grain through the paint.
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, outer + 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.strokeStyle = FAIR_WOOD_DARK;
  ctx.globalAlpha = 0.06;
  ctx.lineWidth = 1;
  for (let gy = cy - outer; gy < cy + outer; gy += 9) {
    ctx.beginPath();
    ctx.moveTo(cx - outer - 2, gy);
    ctx.bezierCurveTo(cx - outer / 3, gy + 3, cx + outer / 3, gy - 3, cx + outer + 2, gy + 1);
    ctx.stroke();
  }
  // Lamp light from the upper left and a worn, shaded edge (all inside the rim).
  ctx.globalAlpha = 1;
  const lamp = ctx.createRadialGradient(cx - outer * 0.4, cy - outer * 0.45, outer * 0.1, cx, cy, outer + 2);
  lamp.addColorStop(0, "rgba(255,248,225,0.2)");
  lamp.addColorStop(0.55, "rgba(255,248,225,0)");
  lamp.addColorStop(0.88, "rgba(20,10,4,0)");
  lamp.addColorStop(1, "rgba(20,10,4,0.32)");
  ctx.fillStyle = lamp;
  ctx.fillRect(cx - outer - 2, cy - outer - 2, outer * 2 + 4, outer * 2 + 4);
  // Polish A3: a glossy varnish sheen across the upper left.
  ctx.save();
  ctx.translate(cx - outer * 0.32, cy - outer * 0.42);
  ctx.rotate(-0.6);
  const sheen = ctx.createLinearGradient(0, -outer * 0.3, 0, outer * 0.3);
  sheen.addColorStop(0, "rgba(255,255,255,0)");
  sheen.addColorStop(0.5, "rgba(255,255,255,0.28)");
  sheen.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = sheen;
  ctx.beginPath();
  ctx.ellipse(0, 0, outer * 0.75, outer * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.restore();
  // Wire between rings: a fine lit line just inside each dark ring edge.
  ctx.strokeStyle = "rgba(255, 245, 225, 0.5)";
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  for (let ring = 1; ring <= BULLSEYE_RINGS; ring++) {
    const radius = (BULLSEYE_RING_STEP * ring * scalePct) / 100 - 1;
    ctx.moveTo(cx + radius, cy);
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  }
  ctx.stroke();
  ctx.restore();
}

/**
 * The wind (phone-test notes, 27 Oct 2026; look only): a small flag on a pole above the range, flying the way the
 * wind blows and waving harder the stronger it is, with the strength on it. No wind: the flag hangs limp with a 0.
 * Static under reduced motion (fairClock is 0). Replaces the arrow, the "→ n" line and the canopy pennant.
 */
export const BULLSEYE_FLAG_W = 40;
export const BULLSEYE_FLAG_H = 24;
export function drawWindFlag(ctx: CanvasRenderingContext2D, x: number, y: number, wind: number): void {
  const t = fairClock();
  const strength = Math.min(1, Math.abs(wind) / BULLSEYE_WIND_MAX);
  const dir = wind < 0 ? -1 : 1;
  const poleTop = y - 30;
  const poleBottom = y + 8;
  ctx.save();
  // Pole and finial.
  ctx.strokeStyle = "#EDE3CF";
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x, poleTop);
  ctx.lineTo(x, poleBottom);
  ctx.stroke();
  ctx.fillStyle = BULLSEYE_GOLD;
  ctx.beginPath();
  ctx.arc(x, poleTop - 1, 2.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.translate(x, poleTop + 1);
  if (wind === 0) {
    // Limp: a narrow cloth hanging down the pole.
    ctx.fillStyle = "#8A8FA0";
    ctx.beginPath();
    ctx.moveTo(1, 0);
    ctx.lineTo(11, 2);
    ctx.lineTo(9, 30);
    ctx.lineTo(1, 30);
    ctx.closePath();
    ctx.fill();
    ctx.font = "800 12px 'JetBrains Mono', ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#0B0B0F";
    ctx.fillText("0", 5.5, 15);
    ctx.restore();
    return;
  }
  ctx.scale(dir, 1);
  const w = BULLSEYE_FLAG_W;
  const h = BULLSEYE_FLAG_H;
  // The cloth's edges ripple along its length: amplitude and speed rise with the wind, fixed to the pole.
  const amp = 1 + 2.2 * strength;
  const phase = t === 0 ? 0 : t / (190 - 70 * strength);
  const wave = (u: number) => Math.sin(u * Math.PI * 2 - phase) * amp * u;
  // Droops a little in a light wind.
  const sag = (1 - strength) * 6;
  const steps = 10;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  for (let i = 1; i <= steps; i++) {
    const u = i / steps;
    ctx.lineTo(w * u, wave(u) + sag * u);
  }
  for (let i = steps; i >= 0; i--) {
    const u = i / steps;
    ctx.lineTo(w * u - (i === steps ? 4 : 0), h + wave(u) + sag * u);
  }
  ctx.closePath();
  const cloth = ctx.createLinearGradient(0, 0, w, 0);
  cloth.addColorStop(0, "#E9A923");
  cloth.addColorStop(1, "#FFD46A");
  ctx.fillStyle = cloth;
  ctx.fill();
  ctx.strokeStyle = "rgba(60, 36, 4, 0.7)";
  ctx.lineWidth = 1;
  ctx.stroke();
  // The strength, upright whichever way the flag flies.
  const mid = 0.55;
  const tx = w * mid;
  const ty = h / 2 + wave(mid) + sag * mid;
  ctx.scale(dir, 1);
  ctx.font = "800 16px 'JetBrains Mono', ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#0B0B0F";
  ctx.fillText(String(Math.abs(wind)), tx * dir, ty + 1);
  ctx.restore();
}

function drawWind(ctx: CanvasRenderingContext2D, wind: number, top = 0): void {
  // The flag's pole stands just off centre so the flag flies over the range's middle whichever way it points.
  drawWindFlag(ctx, BULLSEYE_WORLD_W / 2 - (wind < 0 ? -1 : 1) * (BULLSEYE_FLAG_W / 2), 84 + top, wind);
}

/** The world a state draws in: bullRev 8's taller range (lift px above the original top), else 390 × 560. */
export function bullseyeWorldOf(state: Pick<BullseyeState, "expand">): { w: number; h: number; lift: number } {
  const lift = state.expand === BULLSEYE_EXPAND ? BULLSEYE_V8_LIFT : 0;
  return { w: BULLSEYE_WORLD_W, h: BULLSEYE_WORLD_H + lift, lift };
}

/** bullRev 8: the one HUD line, "Dart n/10 · streak s · dead-centre d", gold while a streak runs; it pulses when either rises. */
function drawExpandHud(ctx: CanvasRenderingContext2D, state: BullseyeState, top: number, age: number): void {
  const n = state.streak ?? 0;
  const dart = Math.min(BULLSEYE_ARROWS, state.arrowIndex + 1);
  const text = `Dart ${dart}/${BULLSEYE_ARROWS} · streak ${n} · dead-centre ${state.dead ?? 0}`;
  ctx.save();
  ctx.font = "700 14px 'JetBrains Mono', ui-monospace, monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  const pulse = !reducedMotion() && age < 600 ? 1 + 0.08 * Math.sin((age / 600) * Math.PI) : 1;
  ctx.translate(12, top + 12);
  ctx.scale(pulse, pulse);
  ctx.fillStyle = "rgba(11,11,15,0.6)";
  const w = ctx.measureText(text).width + 16;
  ctx.beginPath();
  ctx.roundRect?.(-6, -5, w, 25, 8);
  ctx.fill();
  ctx.fillStyle = n >= 2 ? BULLSEYE_GOLD : BULLSEYE_TEXT;
  ctx.fillText(text, 2, 0);
  ctx.restore();
}

/** A landed dart's size (was 0.45; larger and black since the phone-test notes so it shows on the board). */
const BULLSEYE_LANDED_DART = 0.6;
const flightColour = (arrow: number) => FLIGHT_COLOURS[arrow % FLIGHT_COLOURS.length]!;

/** How long a landed dart's own board stays up (presentation clock) before the next dart's board is shown. */
export const BULLSEYE_LAND_HOLD_MS = 700;

/**
 * What a frame shows (phone-test notes, 27 Oct 2026; display only): which dart's board, its drift, and where the
 * landed dart's tip is drawn. A dart is scored against its own board where that board is when it lands
 * (`hit.x − hit.tdx` on the board's own centre and size), so it is drawn there: on its own board, riding that board's
 * drift (`hit.x − hit.tdx + dx` now). Before this, the next dart's board (another distance, height and size on
 * bullRev 8) replaced it the moment the dart landed while the dart stayed at its old screen point, so the dart
 * looked to sit in a ring it hadn't scored, and on a drifting board it slid off its ring. Now the landed board holds
 * for BULLSEYE_LAND_HOLD_MS (the last dart's for good), then the next board shows with no old dart on it.
 */
export function bullseyeView(state: BullseyeState, landAge: number): { arrow: number; dx: number; dart: { x: number; y: number } | null } {
  const expand = state.expand === BULLSEYE_EXPAND;
  const dxOf = (arrow: number) => (expand ? bullseyeDxOf(state, arrow, state.tick) : bullseyeTargetDx(arrow, state.tick, state.driftPhase, state.driftDir));
  const last = state.hits[state.hits.length - 1];
  if (state.flightTick > 0) {
    const arrow = Math.max(0, state.arrowIndex - 1);
    return { arrow, dx: dxOf(arrow), dart: null };
  }
  const next = Math.min(state.arrowIndex, BULLSEYE_ARROWS - 1);
  if (last && (last.arrow === next || landAge < BULLSEYE_LAND_HOLD_MS)) {
    const dx = dxOf(last.arrow);
    return { arrow: last.arrow, dx, dart: { x: last.x - last.tdx + dx, y: last.y } };
  }
  return { arrow: next, dx: dxOf(next), dart: null };
}

/**
 * Flightpath's play view on bullRev 8+ (3 Nov 2026, display only; Joe's audit): inside a funfair darts stall, the
 * range drawn FP_VIEW_K times larger with less empty wall round the post. The stage's box is 390 × FP_VIEW_H; the
 * range's px (bullRev 8's taller world, the lift included) are zoomed FP_VIEW_K about its centre line, world row FP_AY
 * at view row FP_VY, and panned sideways only as far as keeps a drifting board whole on screen (`flightpathPan`). A
 * throw is a drag, measured at the view's own scale (as before the zoom), so it lands where it always did; the sim,
 * the rings and every collision are unchanged. Earlier revisions draw the fairground as before.
 */
export const FP_VIEW_H = 800;
export const FP_VIEW_K = 1.15;
const FP_AY = 80;
const FP_VY = 52;
/** The counter's top edge in the view: just under where the resting dart's flights end. */
const FP_COUNTER_Y = FP_VY + (BULLSEYE_BOW_Y + BULLSEYE_V8_LIFT + 12 - FP_AY) * FP_VIEW_K;
/** The sideways pan (range px) that keeps the board on show whole: 0 unless a drifting board would touch an edge. */
export function flightpathPan(state: BullseyeState, landAge = Infinity): number {
  const v = bullseyeView(state, landAge);
  const board = bullseyeBoard(state, v.arrow);
  const r = (BULLSEYE_OUTER_R * board.scalePct) / 100 + 6;
  const bx = BULLSEYE_CX + v.dx;
  const half = BULLSEYE_WORLD_W / 2 / FP_VIEW_K;
  const left = BULLSEYE_CX - half;
  const right = BULLSEYE_CX + half;
  if (bx - r < left) return bx - r - left;
  if (bx + r > right) return bx + r - right;
  return 0;
}
/** The range's px (lift included) to the view's, panned by `pan`. */
function fpZoom(ctx: CanvasRenderingContext2D, pan: number): void {
  ctx.translate(BULLSEYE_CX, FP_VY);
  ctx.scale(FP_VIEW_K, FP_VIEW_K);
  ctx.translate(-BULLSEYE_CX - pan, -FP_AY);
}
/** The canvas transform of the view (390 × FP_VIEW_H, fitted and centred). */
export function flightpathFrame(size: CanvasSize): { scale: number; offsetX: number; offsetY: number } {
  return fairTransform(size, BULLSEYE_WORLD_W, FP_VIEW_H);
}

/**
 * The frame's map from the range's sim px (the lift not yet added) to canvas px: canvas = (o + p × a) on each axis.
 * The stall's zoom and pan on bullRev 8+, the fairground's fit before (checks read it to find what a point is drawn on).
 */
export function bullseyeCanvasMap(state: BullseyeState, size: CanvasSize, landAge = Infinity): { a: number; ox: number; oy: number } {
  const world = bullseyeWorldOf(state);
  if (world.lift > 0) {
    const f = flightpathFrame(size);
    const pan = flightpathPan(state, landAge);
    const a = f.scale * FP_VIEW_K;
    return { a, ox: f.offsetX + f.scale * (BULLSEYE_CX - (BULLSEYE_CX + pan) * FP_VIEW_K), oy: f.offsetY + f.scale * (FP_VY + (world.lift - FP_AY) * FP_VIEW_K) };
  }
  const f = fairTransform(size, world.w, world.h);
  return { a: f.scale, ox: f.offsetX, oy: f.offsetY + world.lift * f.scale };
}

/** The stall (static, one device layer per size) over the view rectangle `r`. */
function stallLayer(ctx: CanvasRenderingContext2D, r: { x0: number; y0: number; x1: number; y1: number }): void {
  deviceLayer(ctx, `dart-stall:${r.x0.toFixed(1)},${r.y0.toFixed(1)},${r.x1.toFixed(1)},${r.y1.toFixed(1)}`, (c) => paintDartStall(c, r, FP_COUNTER_Y));
}

export function drawBullseye(ctx: CanvasRenderingContext2D, state: BullseyeState, size: CanvasSize): void {
  const landAge = fairChangeAge(ctx, "bullseye-landed", state.flightTick === 0 ? state.hits.length : -1);
  const view = bullseyeView(state, landAge);
  const shown = view.arrow;
  // bullRev 8: the taller range, drawn `lift` px down so every sim coordinate keeps its place on the range.
  const world = bullseyeWorldOf(state);
  const expand = world.lift > 0;
  const streakAge = expand ? fairChangeAge(ctx, "bullseye-streak", (state.streak ?? 0) * 100 + (state.dead ?? 0)) : Infinity;
  const screen = expand ? stallScreen(state, landAge) : fairScreen;
  screen(ctx, size, world.w, world.h, COUNTER_Y + world.lift, () => { if (expand) ctx.translate(0, world.lift); arcadeFx(ctx, expand ? BULLSEYE_FX_V8 : BULLSEYE_FX, state, () => {
    const board = bullseyeBoard(state, shown);
    const dx = view.dx;
    drawBoard(ctx, board.scalePct, dx, bullseyeRingValues(state, shown), shown >= BULLSEYE_DRIFT_FROM, board.cy, expand ? COUNTER_Y : 0);
    if (state.rev === BULLSEYE_REV && bullseyeRingValues(state, shown)[0] === 10) drawInnerBull(ctx, board.scalePct, dx, board.cy);
    if (expand && bullseyeRingValues(state, shown)[0] === 10) drawDeadCentre(ctx, board.scalePct, dx, board.cy);

    const last = state.hits[state.hits.length - 1];
    // Rev 2 / bullRev 4: this dart's balloon floats until the dart lands; a popped one bursts.
    const tuned = state.tune === BULLSEYE_TUNE;
    const balloonAt = bullseyeBalloonPos(state, shown, state.tick);
    const popped = last?.pop === 1 && last.arrow === shown;
    if (balloonAt && !(popped && state.flightTick === 0)) {
      drawBalloon(ctx, balloonAt.x, balloonAt.y, balloonColour(state, shown), tuned ? `+${bullseyeBalloonValue(state, shown)}` : "12");
    }
    if (last?.pop === 1 && state.flightTick === 0 && !reducedMotion()) {
      drawBalloonPop(ctx, last.x, last.y, balloonColour(state, last.arrow), landAge);
    }
    if (last && view.dart) {
      // Stuck in at its scored point on its own board (bullseyeView); flights wobble once on landing.
      const at = view.dart;
      const wobble = !reducedMotion() && landAge < 450
        ? Math.sin(landAge / 30) * 0.35 * (1 - landAge / 450) : 0;
      // Rev 2: a dart that popped a balloon is gone with it. bullRev 4: it carries on into the board.
      if (last.pop !== 1 || tuned) drawDart(ctx, at.x, at.y, BULLSEYE_LANDED_DART, flightColour(last.arrow), wobble);
      if (landAge < 500) {
        const u = landAge / 500;
        const pop = reducedMotion() ? 1 : 1 + 0.2 * Math.sin(Math.min(1, u * 4) * Math.PI);
        ctx.save();
        ctx.translate(at.x, at.y - 14 - (reducedMotion() ? 0 : u * 8));
        ctx.scale(pop, pop);
        ctx.globalAlpha = u < 0.3 ? 1 : (1 - u) / 0.7;
        ctx.fillStyle = BULLSEYE_GOLD;
        ctx.font = "700 20px 'JetBrains Mono', ui-monospace, monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        // bullRev 4: the ring's points at the dart, and the balloon's own +n beside them in its colour.
        const bal = last.bal ?? 0;
        // A dark edge keeps the gold figure readable over the light rings.
        ctx.strokeStyle = "rgba(11,11,15,0.85)";
        ctx.lineWidth = 3.5;
        ctx.lineJoin = "round";
        ctx.strokeText(String(last.value - bal), 0, 0);
        ctx.fillText(String(last.value - bal), 0, 0);
        // bullRev 8: a streak bull's own streak points, "×n +k", under the ring's points.
        if (last.sk && last.sk >= 2) {
          ctx.font = "800 13px 'JetBrains Mono', ui-monospace, monospace";
          ctx.textBaseline = "top";
          ctx.strokeStyle = "rgba(11,11,15,0.8)";
          ctx.lineWidth = 3;
          ctx.lineJoin = "round";
          const t = last.skp ? `×${last.sk} +${last.skp}` : `×${last.sk}`;
          ctx.strokeText(t, 0, 4);
          ctx.fillText(t, 0, 4);
          ctx.font = "700 20px 'JetBrains Mono', ui-monospace, monospace";
          ctx.textBaseline = "bottom";
        }
        // bullRev 8: a dead-centre dart's extra, above the ring's points.
        if (last.dc) {
          ctx.font = "800 13px 'JetBrains Mono', ui-monospace, monospace";
          ctx.fillStyle = "#FFFFFF";
          ctx.strokeStyle = "rgba(11,11,15,0.8)";
          ctx.lineWidth = 3;
          ctx.lineJoin = "round";
          // bullRev 9 (the scoring standard): 2 a dart; bullRev 8: 7.
          const t = `DEAD CENTRE +${bullseyeDeadEach(state)}`;
          ctx.strokeText(t, 0, bal > 0 ? -44 : -30);
          ctx.fillText(t, 0, bal > 0 ? -44 : -30);
          ctx.font = "700 20px 'JetBrains Mono', ui-monospace, monospace";
          ctx.fillStyle = BULLSEYE_GOLD;
        }
        if (bal > 0) {
          ctx.font = "800 16px 'JetBrains Mono', ui-monospace, monospace";
          ctx.fillStyle = balloonColour(state, last.arrow);
          ctx.strokeStyle = "#FFFFFF";
          ctx.lineWidth = 3;
          ctx.lineJoin = "round";
          ctx.strokeText(`+${bal}`, 0, -20);
          ctx.fillText(`+${bal}`, 0, -20);
        }
        ctx.restore();
      }
    }
    const isBull=(h:{ring:number;value:number;bal?:number})=>expand?bullseyeIsBull(h):h.ring===0&&h.value-(h.bal??0)>=10;
    if (expand) {
      ctx.save();
      ctx.translate(0, -world.lift);
    }
    successFrame(ctx,{id:'bullseye',tick:state.tick,count:state.flightTick===0?state.hits.filter(isBull).length:Math.max(0,state.hits.filter(isBull).length-(last&&isBull(last)?1:0)),enabled:state.flightTick===0&&!!last&&isBull(last),colour:BULLSEYE_GOLD,width:world.w,height:world.h,point:{x:view.dart?.x??last?.x??BULLSEYE_CX,y:(view.dart?.y??last?.y??BULLSEYE_CY)+world.lift,shape:'spark'}});
    if (expand) ctx.restore();
    if (last && state.flightTick > 0) {
      const progress = (BULLSEYE_FLIGHT_TICKS - state.flightTick) / BULLSEYE_FLIGHT_TICKS;
      const x = BULLSEYE_BOW_X + (last.x - BULLSEYE_BOW_X) * progress;
      const y = DART_TIP_Y + (last.y - DART_TIP_Y) * progress;
      if (!reducedMotion()) {
        const back = Math.max(0, progress - 0.25);
        ctx.save();
        ctx.strokeStyle = FAIR_CHALK;
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(BULLSEYE_BOW_X + (last.x - BULLSEYE_BOW_X) * back, DART_TIP_Y + (last.y - DART_TIP_Y) * back + 10);
        ctx.lineTo(x, y + 10 * (1 - 0.55 * progress));
        ctx.stroke();
        ctx.restore();
      }
      drawDart(ctx, x, y, 1.2 - (1.2 - BULLSEYE_LANDED_DART) * progress, flightColour(last.arrow));
    }
    if (state.arrowIndex < BULLSEYE_ARROWS && !expand) drawWind(ctx, state.winds[state.arrowIndex] ?? 0, -world.lift);
    if (state.arrowIndex < BULLSEYE_ARROWS && state.flightTick === 0) {
      drawDart(ctx, BULLSEYE_BOW_X, DART_TIP_Y, 1.2, flightColour(state.arrowIndex));
    }
    ctx.font = "600 19.5px 'JetBrains Mono', ui-monospace, monospace";
    ctx.fillStyle = BULLSEYE_TEXT;
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    const shownArrow = Math.min(BULLSEYE_ARROWS, state.arrowIndex + 1);
    if (!expand) ctx.fillText(`Dart ${shownArrow} / ${BULLSEYE_ARROWS} · ${state.total} pts`, 12, 12 - world.lift);
  }); }, [0.08, 0.3]);
  if (expand) drawStallHud(ctx, state, size, streakAge);
}

/**
 * The stall's screen (bullRev 8+): the same signature as fairScreen, so the draw picks either. The stall over the whole
 * canvas in view px, then the range (drawWorld) under the zoom and its pan.
 */
function stallScreen(state: BullseyeState, landAge: number) {
  return (ctx: CanvasRenderingContext2D, size: CanvasSize, _w: number, _h: number, _counter: number, drawWorld: () => void, _tents?: readonly number[]): void => {
    const f = flightpathFrame(size);
    ctx.save();
    ctx.translate(f.offsetX, f.offsetY);
    ctx.scale(f.scale, f.scale);
    stallLayer(ctx, { x0: -f.offsetX / f.scale, y0: -f.offsetY / f.scale, x1: (size.width - f.offsetX) / f.scale, y1: (size.height - f.offsetY) / f.scale });
    // The range behind the counter: the post and darts stop at its top edge.
    ctx.save();
    ctx.beginPath();
    ctx.rect(-f.offsetX / f.scale - 1, -f.offsetY / f.scale - 1, size.width / f.scale + 2, FP_COUNTER_Y + f.offsetY / f.scale + 1);
    ctx.clip();
    fpZoom(ctx, flightpathPan(state, landAge));
    drawWorld();
    ctx.restore();
    ctx.restore();
  };
}

/**
 * The stall's HUD (bullRev 8+), in view px: Sports pill chips along the top (the dart count first, the streak gold
 * while it runs, the dead-centre count), and the wind flag hanging from the awning's right end.
 */
function drawStallHud(ctx: CanvasRenderingContext2D, state: BullseyeState, size: CanvasSize, age: number): void {
  const f = flightpathFrame(size);
  ctx.save();
  ctx.translate(f.offsetX, f.offsetY);
  ctx.scale(f.scale, f.scale);
  const n = state.streak ?? 0;
  const dart = Math.min(BULLSEYE_ARROWS, state.arrowIndex + 1);
  const pulse = !reducedMotion() && age < 600 ? 1 + 0.08 * Math.sin((age / 600) * Math.PI) : 1;
  ctx.save();
  ctx.translate(10, 10);
  ctx.scale(pulse, pulse);
  ctx.translate(-10, -10);
  const x = sportsChipRow(ctx, 10, 10, [
    { label: "DART", value: `${dart}/${BULLSEYE_ARROWS}` },
    { label: "STREAK", value: String(n), accent: n >= 2 },
  ]);
  sportsChip(ctx, x, 10, "CENTRE", String(state.dead ?? 0), (state.dead ?? 0) > 0);
  ctx.restore();
  if (state.arrowIndex < BULLSEYE_ARROWS) drawWindFlag(ctx, BULLSEYE_WORLD_W - 46, 76, state.winds[state.arrowIndex] ?? 0);
  ctx.restore();
}

/** Chalk aim line from the dart to the predicted landing point. Render only. */
export function bullseyeArtAim(ctx: CanvasRenderingContext2D, size: CanvasSize, landing: { x: number; y: number }, lift = 0, state?: BullseyeState): void {
  const stall = !!state && state.expand === BULLSEYE_EXPAND;
  const { scale, offsetX, offsetY } = stall ? flightpathFrame(size) : fairTransform(size, BULLSEYE_WORLD_W, BULLSEYE_WORLD_H + lift);
  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);
  if (stall) fpZoom(ctx, flightpathPan(state));
  ctx.translate(0, lift);
  ctx.strokeStyle = FAIR_CHALK;
  ctx.globalAlpha = 0.42;
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.moveTo(BULLSEYE_BOW_X, DART_TIP_Y);
  ctx.lineTo(landing.x, landing.y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.arc(landing.x, landing.y, 8, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/** Arena scene (15 Oct 2026, display only): the stall's sky, counter and floor beyond the world. */
export function bullseyeArenaScene(ctx: CanvasRenderingContext2D, view: ArenaSceneView): void {
  fairArenaScene(ctx, view, COUNTER_Y);
}

/** bullRev 8's arena scene: the counter line sits lift px lower in the taller world. */
export function bullseyeArenaSceneV8(ctx: CanvasRenderingContext2D, view: ArenaSceneView): void {
  // The darts stall (3 Nov 2026) carried on beyond the box, in the view's own px.
  paintDartStall(ctx, { x0: view.left - 2, y0: view.top - 2, x1: view.right + 2, y1: view.bottom + 2 }, FP_COUNTER_Y);
}
