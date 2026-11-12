/**
 * The round-ball skins (wave 2, E1): Crazy Golf's four golf balls and Top Bins' three footballs, drawn line for line
 * from their sources (docs/art/wave-2/items/game-skin/crazy-golf--*.html, top-bins--*.html). Every source draws its
 * ball in a 72 × 72 box at (36, 36) with radius 30, clipped to the circle, then a soft highlight and a dark rim; this
 * paints the same in that frame, scaled so the 30 units are the game's own draw radius, so the skin never draws
 * outside the ball (sizes and hit areas are the default's).
 */

export type BallArt = "watermelon" | "disco" | "neon-glow" | "plasma" | "comet" | "retro-leather" | "neon-football";

/** Disco's 9 × 9 mirror tiles (column by column, x 4…68, y 4…68, 7 units each), indices into DISCO_TILES. */
const DISCO_MAP = "442355221121002423355050501514020143550515333504401230425521200324523444253001133";
const DISCO_TILES = ["#6F7C99", "#9FE8FF", "#B5C6DD", "#D3DCEF", "#FF8FD6", "#FFFFFF"];

function line(ctx: CanvasRenderingContext2D, pts: readonly number[], colour: string, width: number, alpha = 1): void {
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = colour;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(pts[0]! - 36, pts[1]! - 36);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i]! - 36, pts[i + 1]! - 36);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/** The football's pentagon (the art's `M36 14 l12 9 -5 14 h-14 l-5 -14z`), in the art frame. */
function pentagon(ctx: CanvasRenderingContext2D): void {
  ctx.beginPath();
  ctx.moveTo(0, -22);
  ctx.lineTo(12, -13);
  ctx.lineTo(7, 1);
  ctx.lineTo(-7, 1);
  ctx.lineTo(-12, -13);
  ctx.closePath();
}

function body(ctx: CanvasRenderingContext2D, art: BallArt): void {
  ctx.lineCap = "butt";
  switch (art) {
    case "watermelon": {
      ctx.fillStyle = "#3DB04B";
      ctx.fillRect(-36, -36, 72, 72);
      for (const x of [14, 30, 46, 62]) {
        ctx.strokeStyle = "#1B6B2A";
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(x - 36, -36);
        ctx.quadraticCurveTo(x + 10 - 36, 0, x - 36, 36);
        ctx.stroke();
      }
      break;
    }
    case "disco": {
      ctx.fillStyle = "#8F9BBF";
      ctx.fillRect(-36, -36, 72, 72);
      ctx.strokeStyle = "#3A3F4F";
      ctx.lineWidth = 0.6;
      for (let i = 0; i < 81; i++) {
        const x = 4 + Math.floor(i / 9) * 8 - 36;
        const y = 4 + (i % 9) * 8 - 36;
        ctx.fillStyle = DISCO_TILES[Number(DISCO_MAP[i])]!;
        ctx.fillRect(x, y, 7, 7);
        ctx.strokeRect(x, y, 7, 7);
      }
      break;
    }
    case "neon-glow": {
      ctx.fillStyle = "#E8FFFF";
      ctx.fillRect(-36, -36, 72, 72);
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = "#22E4FF";
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(0, 0, 30, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#7FF0FF";
      for (let gx = 14; gx <= 59; gx += 9)
        for (let gy = 14; gy <= 59; gy += 9) {
          ctx.beginPath();
          ctx.arc(gx - 36, gy - 36, 1.6, 0, Math.PI * 2);
          ctx.fill();
        }
      ctx.globalAlpha = 1;
      break;
    }
    case "plasma": {
      ctx.fillStyle = "#2A0B5E";
      ctx.fillRect(-36, -36, 72, 72);
      ctx.fillStyle = "#FF8FD6";
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, Math.PI * 2);
      ctx.fill();
      for (const [x, y] of [[63, 44], [41, 64], [14, 53], [11, 24], [36, 8], [58, 18]] as const) line(ctx, [36, 36, x, y], "#FF3DCB", 2, 0.9);
      break;
    }
    case "comet": {
      ctx.fillStyle = "#1B1F33";
      ctx.fillRect(-36, -36, 72, 72);
      ctx.fillStyle = "#E2C07A";
      pentagon(ctx);
      ctx.fill();
      ctx.lineCap = "round";
      for (const pts of [[20, 46, 30, 37], [52, 46, 42, 37], [36, 52, 36, 66]]) line(ctx, pts, "#E2C07A", 3.5);
      break;
    }
    case "retro-leather": {
      ctx.fillStyle = "#8A4A20";
      ctx.fillRect(-36, -36, 72, 72);
      ctx.strokeStyle = "#5A2E10";
      ctx.lineWidth = 1.5;
      for (const y of [20, 36, 52]) {
        ctx.beginPath();
        ctx.moveTo(-36, y - 36);
        ctx.quadraticCurveTo(0, y + 8 - 36, 36, y - 36);
        ctx.stroke();
      }
      ctx.fillStyle = "#B8733A";
      ctx.beginPath();
      ctx.roundRect(30 - 36, 16 - 36, 12, 26, 2);
      ctx.fill();
      for (const y of [20, 25, 30, 35]) line(ctx, [31, y, 41, y], "#F5E6C8", 1.5);
      break;
    }
    case "neon-football": {
      ctx.fillStyle = "#0A0820";
      ctx.fillRect(-36, -36, 72, 72);
      ctx.strokeStyle = "#22E4FF";
      ctx.lineWidth = 2.5;
      pentagon(ctx);
      ctx.stroke();
      ctx.lineCap = "round";
      for (const pts of [[20, 46, 30, 37], [52, 46, 42, 37], [36, 52, 36, 66], [8, 30, 24, 23], [64, 30, 48, 23]]) line(ctx, pts, "#FF3DCB", 2.5);
      break;
    }
  }
}

/** The glow colour the source's drop-shadow uses (drawn as a soft ring just inside the ball), or null. */
const GLOW: Partial<Record<BallArt, string>> = { "neon-glow": "#22E4FF", plasma: "#FF3DCB", "neon-football": "#22E4FF" };

/**
 * One skinned ball centred at (x, y) with draw radius r, turned by `spin` (radians; the football's roll, 0 for the
 * golf ball). Everything stays inside r.
 */
export function paintBallArt(ctx: CanvasRenderingContext2D, art: BallArt, x: number, y: number, r: number, spin = 0): void {
  const k = r / 30;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, 30, 0, Math.PI * 2);
  ctx.clip();
  ctx.save();
  if (spin) ctx.rotate(spin);
  body(ctx, art);
  ctx.restore();
  ctx.restore();
  // The highlight (radial, centre 0.35 / 0.3 of the 72 box, radius 0.7 of it): white 0.55 → 0 by halfway.
  const hx = 0.35 * 72 - 36;
  const hy = 0.3 * 72 - 36;
  const g = ctx.createRadialGradient(hx, hy, 0, hx, hy, 0.7 * 72);
  g.addColorStop(0, "rgba(255,255,255,0.55)");
  g.addColorStop(0.5, "rgba(255,255,255,0)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 30, 0, Math.PI * 2);
  ctx.fill();
  const glow = GLOW[art];
  if (glow) {
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = glow;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, 28, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // The rim: the source's 2-unit dark stroke on the circle, kept inside it, never thinner than half a pixel.
  const lw = Math.max(2, 0.5 / k);
  ctx.strokeStyle = "#06080F";
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.arc(0, 0, 30 - lw / 2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/** The colours each ball art is drawn in (its body and markings), for the contrast check. */
export const BALL_ART_COLOURS: Readonly<Record<BallArt, readonly string[]>> = {
  watermelon: ["#3DB04B", "#1B6B2A"],
  disco: ["#8F9BBF", "#FFFFFF", "#D3DCEF", "#9FE8FF", "#FF8FD6"],
  "neon-glow": ["#E8FFFF", "#22E4FF"],
  plasma: ["#2A0B5E", "#FF8FD6", "#FF3DCB"],
  comet: ["#1B1F33", "#E2C07A"],
  "retro-leather": ["#8A4A20", "#B8733A", "#F5E6C8"],
  "neon-football": ["#0A0820", "#22E4FF", "#FF3DCB"],
};
