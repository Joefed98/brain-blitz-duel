/**
 * Apex's car paints and world theme (wave 2, E1; docs/art/wave-2/items/game-skin/apex--*.html,
 * items/world-theme/apex--neon-night.html). Display only: a paint recolours the player's own car inside the
 * default car's outline (the ghosts of other players keep their default look), and the Neon Night recolours the
 * circuit (the road, kerbs, grass, walls, trackside and sky) on exactly the default's geometry.
 *
 * Animated (Legendaries): Molten Gold's shine sweeps across the car and its sparkles twinkle; the Neon Night's kerbs
 * chase in cyan and pink and its stars twinkle. All of it reads skinTime(), which stands still under Reduce Motion.
 */
import type { ContrastPair, GameLook } from "./look";

export type CarPaint = "stripes" | "gold" | "neon";

export function racingCarPaint(look: GameLook): CarPaint | null {
  switch (look.skin) {
    case "game-skin.apex.racing-stripes":
      return "stripes";
    case "game-skin.apex.molten-gold":
      return "gold";
    case "game-skin.apex.neon-paint":
      return "neon";
  }
  return null;
}

/** The Neon Night's surface colours (the same keys as the renderer's day palette). */
export const NEON_NIGHT_COL = {
  grassA: "#0B0818",
  grassB: "#0E0A1E",
  gravelA: "#1C1530",
  gravelB: "#19132B",
  runoff: "#120E22",
  roadA: "#1A1528",
  roadB: "#18132A",
  lineDark: "rgba(4,2,10,0.38)",
  kerbR: "#FF3DCB",
  kerbW: "#22E4FF",
  edge: "#B8B8C8",
  skid: "rgba(2,0,8,0.32)",
};
/** The haze over the far fields: night violet to the grass. */
export const NEON_NIGHT_HAZE = "#160A30";

const hash = (n: number): number => {
  let x = n | 0;
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
};

/** The night sky (the source's #05040F → #160A30). */
export function paintNeonNightSky(ctx: CanvasRenderingContext2D, w: number, h: number, horizon: number): void {
  const g = ctx.createLinearGradient(0, 0, 0, horizon + 20);
  g.addColorStop(0, "#05040F");
  g.addColorStop(1, "#160A30");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, Math.min(h, horizon + 20));
}

/** The stars, drawn each frame over the sky: four-point sparkles twinkling (0.25 ↔ 1, 2.6 s), still at rest. */
export function paintNeonNightStars(ctx: CanvasRenderingContext2D, w: number, horizon: number, t: number): void {
  ctx.save();
  ctx.fillStyle = "#FFFFFF";
  for (let i = 0; i < 14; i++) {
    const x = hash(i * 31 + 7) * w;
    const y = 6 + hash(i * 17 + 3) * (horizon - 40);
    const phase = [0, 0.9, 1.7][i % 3]!;
    // The source's lgTw: opacity 0.25 at 0 % and 100 %, 1 at 50 %; its still frame (Reduce Motion) is full.
    ctx.globalAlpha = t === 0 ? 1 : 0.625 - 0.375 * Math.cos((((t + phase) % 2.6) / 2.6) * Math.PI * 2);
    const s = i % 4 === 0 ? 3 : 1.6;
    ctx.beginPath();
    ctx.moveTo(x, y - s);
    ctx.lineTo(x + s * 0.3, y - s * 0.3);
    ctx.lineTo(x + s, y);
    ctx.lineTo(x + s * 0.3, y + s * 0.3);
    ctx.lineTo(x, y + s);
    ctx.lineTo(x - s * 0.3, y + s * 0.3);
    ctx.lineTo(x - s, y);
    ctx.lineTo(x - s * 0.3, y - s * 0.3);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/** The neon city on the far strip: dark towers with lit windows in pink, cyan and gold, a pink horizon line. */
export function paintNeonCity(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  let x = 0;
  let i = 0;
  while (x < w) {
    const bw = 18 + Math.floor(hash(i * 3 + 1) * 4) * 6;
    const bh = h * (0.3 + hash(i * 5 + 2) * 0.65);
    ctx.fillStyle = "#0C0820";
    ctx.fillRect(x, h - bh, bw, bh);
    for (let wy = h - bh + 5; wy < h - 4; wy += 9)
      for (let wx = x + 3; wx < x + bw - 3; wx += 8) {
        const k = hash(Math.round(wx * 13 + wy * 7));
        if (k < 0.55) continue;
        ctx.fillStyle = k < 0.7 ? "#FF3DCB" : k < 0.85 ? "#22E4FF" : "#F2C14E";
        ctx.globalAlpha = 0.8;
        ctx.fillRect(wx, wy, 3, 3);
        ctx.globalAlpha = 1;
      }
    x += bw + 2;
    i++;
  }
  ctx.fillStyle = "#FF3DCB";
  ctx.fillRect(0, h - 1.2, w, 1.2);
}

/** Near hills under the Neon Night: a dark band with a faint cyan rim (the renderer's own hill painter's arguments). */
export const NEON_NIGHT_NEAR = { top: "#0E0A20", bottom: "#07050F", rim: "rgba(34,228,255,0.35)" } as const;

/** A tree under the Neon Night: the default's shapes, dark, with a cyan rim. */
export const NEON_NIGHT_TREE = { trunk: "#0A0716", body: "#0C0820", rim: "rgba(34,228,255,0.45)" } as const;

/** The grandstand under the Neon Night: dark tiers, a dim crowd, a pink roof edge and gold lights along it. */
export function paintNeonStand(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.fillStyle = "#0C0820";
  ctx.beginPath();
  ctx.moveTo(0, h);
  ctx.lineTo(0, h * 0.42);
  ctx.lineTo(w, h * 0.22);
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();
  for (let r = 0; r < 7; r++) {
    const y0 = h * (0.92 - r * 0.085);
    const tilt = (r / 7) * h * 0.2;
    ctx.fillStyle = r % 2 ? "#141028" : "#110D22";
    ctx.fillRect(0, y0 - h * 0.07 - tilt * 0.2, w, h * 0.07);
    for (let i = 0; i < w / 5; i++) {
      const k = hash(r * 77 + i * 3);
      ctx.fillStyle = k < 0.15 ? "#FF3DCB" : k < 0.3 ? "#22E4FF" : "#2A2440";
      ctx.globalAlpha = k < 0.3 ? 0.6 : 1;
      ctx.fillRect(i * 5 + hash(r * 999 + i) * 3, y0 - h * 0.062 - tilt * 0.2, 2.6, 3.2);
      ctx.globalAlpha = 1;
    }
  }
  ctx.fillStyle = "#07050F";
  ctx.beginPath();
  ctx.moveTo(-4, h * 0.36);
  ctx.lineTo(w + 4, h * 0.14);
  ctx.lineTo(w + 4, h * 0.08);
  ctx.lineTo(-4, h * 0.3);
  ctx.closePath();
  ctx.fill();
  ctx.save();
  ctx.shadowColor = "#FF3DCB";
  ctx.shadowBlur = 4;
  ctx.strokeStyle = "#FF3DCB";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-4, h * 0.3);
  ctx.lineTo(w + 4, h * 0.08);
  ctx.stroke();
  ctx.restore();
  // The grandstand lights: gold lamps on the roof edge.
  ctx.save();
  ctx.shadowColor = "#F2C14E";
  ctx.shadowBlur = 5;
  ctx.fillStyle = "#F2C14E";
  for (let i = 0; i < 4; i++) {
    const x = (i + 0.5) * (w / 4);
    const y = h * 0.3 - (x / w) * h * 0.22 - 3;
    ctx.beginPath();
    ctx.arc(x, y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.fillStyle = "#07050F";
  for (let i = 0; i < 4; i++) ctx.fillRect((i + 0.5) * (w / 4) - 1.5, h * 0.3 - i * h * 0.05, 3, h);
}

/** Tyre wall belts under the Neon Night (red and white become pink and cyan). */
export const NEON_NIGHT_BELTS = ["#FF3DCB", "#22E4FF"] as const;

/** The kerbs' chase: how many segments the pattern has moved (the source's 1.4 s loop of 28 dash units). */
export function neonNightChase(t: number): number {
  return Math.floor((t / 1.4) * 4) % 4;
}

/* ================================ The car ================================ */

/**
 * The body's fill for a paint (in place of the graphite gradient), between the car's top and bottom y. Returns the
 * fill, and paints the paint's own marks after the body (stripes, the gold shine, the neon edge) through `marks`.
 */
export function carPaintBody(ctx: CanvasRenderingContext2D, paint: CarPaint, x0: number, top: number, w: number, bottom: number): string | CanvasGradient {
  if (paint === "stripes") return "#2050D8";
  if (paint === "neon") return "#0A0820";
  const g = ctx.createLinearGradient(x0, top, x0 + w, bottom);
  g.addColorStop(0, "#FFF3C4");
  g.addColorStop(0.35, "#F2C14E");
  g.addColorStop(0.7, "#C8902A");
  g.addColorStop(1, "#FFE08A");
  return g;
}

/**
 * A paint's marks over the body (the body path is the current path): Racing Stripes' two white stripes, the Neon
 * paint's pink edge and cyan stripe, Molten Gold's sweep (t: skinTime(); still under Reduce Motion) and highlight line.
 */
export function carPaintMarks(ctx: CanvasRenderingContext2D, paint: CarPaint, cx: number, top: number, w: number, h: number, bottom: number, t: number): void {
  ctx.save();
  ctx.clip();
  if (paint === "stripes") {
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(cx - w * 0.115, top, w * 0.07, h);
    ctx.fillRect(cx + w * 0.045, top, w * 0.07, h);
  } else if (paint === "neon") {
    ctx.fillStyle = "#22E4FF";
    ctx.fillRect(cx - w * 0.045, top, w * 0.09, h);
  } else {
    ctx.strokeStyle = "rgba(255,243,196,0.7)";
    ctx.lineWidth = Math.max(0.6, w * 0.015);
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.36, bottom - h * 0.6);
    ctx.quadraticCurveTo(cx - w * 0.2, bottom - h * 0.4, cx - w * 0.12, bottom - h * 0.3);
    ctx.stroke();
    // The sweep: the source's 3.5 s pass (0 → 60 % across, then rest), a soft white band turned 20°.
    const p = (t % 3.5) / 3.5;
    const across = t === 0 ? 0.35 : Math.min(1, p / 0.6);
    const sx = cx - w * 0.7 + across * w * 1.4;
    const g = ctx.createLinearGradient(sx - w * 0.09, 0, sx + w * 0.09, 0);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(0.5, "rgba(255,255,255,0.85)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.translate(sx, (top + bottom) / 2);
    ctx.rotate((20 * Math.PI) / 180);
    ctx.fillRect(-w * 0.09, -h, w * 0.18, h * 2);
  }
  ctx.restore();
  if (paint === "neon") {
    // The pink edge and its glow inside the body's outline (the stroke clipped to the body, so nothing grows the car).
    ctx.save();
    ctx.clip();
    ctx.shadowColor = "#FF3DCB";
    ctx.shadowBlur = Math.min(6, w * 0.05);
    ctx.strokeStyle = "#FF3DCB";
    ctx.lineWidth = Math.max(1.6, w * 0.04);
    ctx.stroke();
    ctx.restore();
  }
}

/** Molten Gold's sparkles round the car (four-point stars twinkling; still under Reduce Motion), inside its width. */
export function carGoldSparkles(ctx: CanvasRenderingContext2D, cx: number, top: number, w: number, h: number, t: number): void {
  ctx.save();
  ctx.fillStyle = "#FFF3C4";
  // Inside the car's own box (the default car's outline), never beyond it.
  const spots: [number, number, number][] = [[-0.4, 0.14, 0], [0.4, 0.16, 0.9], [-0.36, 0.8, 1.7], [0.34, 0.84, 0], [0.02, 0.14, 0.9]];
  for (const [dx, dy, phase] of spots) {
    ctx.globalAlpha = t === 0 ? 1 : 0.625 - 0.375 * Math.cos((((t + phase) % 2.6) / 2.6) * Math.PI * 2);
    const x = cx + dx * w;
    const y = top + dy * h;
    const s = Math.max(1, w * 0.04);
    ctx.beginPath();
    ctx.moveTo(x, y - s);
    ctx.lineTo(x + s * 0.3, y - s * 0.3);
    ctx.lineTo(x + s, y);
    ctx.lineTo(x + s * 0.3, y + s * 0.3);
    ctx.lineTo(x, y + s);
    ctx.lineTo(x - s * 0.3, y + s * 0.3);
    ctx.lineTo(x - s, y);
    ctx.lineTo(x - s * 0.3, y - s * 0.3);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/** What each Apex look must keep visible: your car on the road. */
export function racingContrast(look: GameLook): ContrastPair[] {
  const paint = racingCarPaint(look);
  const colours = paint === "stripes" ? ["#2050D8", "#FFFFFF"] : paint === "gold" ? ["#F2C14E", "#FFF3C4"] : paint === "neon" ? ["#FF3DCB", "#22E4FF"] : ["#7A6670", "#E3B341", "#B3202A"];
  const backgrounds = look.world ? [NEON_NIGHT_COL.roadA, NEON_NIGHT_COL.roadB] : ["#4B4A52", "#47464E"];
  return [{ object: "car", colours, backgrounds }];
}
