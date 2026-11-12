/**
 * Crazy Golf's skins and world theme (wave 2, E1; docs/art/wave-2/items/game-skin/crazy-golf--*.html,
 * items/world-theme/crazy-golf--neon-course.html). Display only: the ball skins paint inside the ball's draw radius,
 * and the Neon Course redraws the same hole (every rail, hazard, cup and windmill where the default puts it) in
 * black-light colours: glowing green edges, a neon windmill that turns with the sim's own sails, a pulsing cup.
 */
import type { ArenaSceneView } from "../arenaScene.renderer";
import { px } from "../engine";
import { MG_CUP_R, MINIGOLF_H, MINIGOLF_W, type MgHole } from "../minigolf";
import type { BallArt } from "./ballArt";
import { BALL_ART_COLOURS } from "./ballArt";
import { type ContrastPair, type GameLook } from "./look";
import { skinTime } from "./motion.renderer";

const BALLS: Readonly<Record<string, BallArt>> = {
  "game-skin.crazy-golf.watermelon": "watermelon",
  "game-skin.crazy-golf.disco": "disco",
  "game-skin.crazy-golf.neon-glow": "neon-glow",
  "game-skin.crazy-golf.plasma": "plasma",
};

export function minigolfBallArt(look: GameLook): BallArt | null {
  return (look.skin && BALLS[look.skin]) || null;
}

/** The Neon Course's colours (the source's). */
export const NEON_COURSE = {
  bg: "#06041A",
  speck: "#9D7BFF",
  turf: "#062A1E",
  edge: "#3DFF9A",
  pink: "#FF3DCB",
  cyan: "#22E4FF",
  gold: "#F2C14E",
  ball: "#E8FFFF",
  /** The windmill: dark sails with gold slats, a cyan arm and feet. */
  sail: "#1A1440",
  millLine: "#F2C14E",
  millArm: "#22E4FF",
} as const;

function hash(n: number): number {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

function polyPath(ctx: CanvasRenderingContext2D, poly: readonly number[]): void {
  ctx.beginPath();
  for (let i = 0; i < poly.length; i += 2) {
    const x = px(poly[i]!);
    const y = px(poly[i + 1]!);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function specks(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, salt: number): void {
  ctx.fillStyle = NEON_COURSE.speck;
  ctx.globalAlpha = 0.5;
  const n = Math.round(((x1 - x0) * (y1 - y0)) / 3900);
  for (let i = 0; i < n; i++) {
    ctx.beginPath();
    ctx.arc(x0 + hash(i * 7 + salt) * (x1 - x0), y0 + hash(i * 13 + 5 + salt) * (y1 - y0), 1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export interface NeonHoleParts {
  floor: () => void;
  slopes: () => void;
  pieces: () => void;
}

/** The whole static hole under the Neon Course (cached per hole like the default). */
export function neonCourseHole(ctx: CanvasRenderingContext2D, h: MgHole, parts: NeonHoleParts): void {
  ctx.fillStyle = NEON_COURSE.bg;
  ctx.fillRect(0, 0, MINIGOLF_W, MINIGOLF_H);
  specks(ctx, 0, 0, MINIGOLF_W, MINIGOLF_H, h.index * 31);
  // The turf with its faint vertical lines.
  ctx.save();
  polyPath(ctx, h.poly);
  ctx.clip();
  ctx.fillStyle = NEON_COURSE.turf;
  ctx.fillRect(h.box.x - 4, h.box.y - 4, h.box.w + 8, h.box.h + 8);
  ctx.strokeStyle = "rgba(61,255,154,0.12)";
  ctx.lineWidth = 0.6;
  for (let x = Math.floor(h.box.x / 22) * 22; x < h.box.x + h.box.w + 4; x += 22) {
    ctx.beginPath();
    ctx.moveTo(x, h.box.y - 4);
    ctx.lineTo(x, h.box.y + h.box.h + 4);
    ctx.stroke();
  }
  ctx.restore();
  parts.slopes();
  // The ramps keep their chevrons, sunk into the night turf.
  ctx.save();
  polyPath(ctx, h.poly);
  ctx.clip();
  ctx.fillStyle = "rgba(4,20,22,0.62)";
  for (const sl of h.slopes) ctx.fillRect(px(sl.x0), px(sl.y0), px(sl.x1) - px(sl.x0), px(sl.y1) - px(sl.y0));
  ctx.restore();
  parts.floor();
  // The tee: a green outline.
  const tx = px(h.tee.x);
  const ty = px(h.tee.y);
  ctx.strokeStyle = "rgba(61,255,154,0.5)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(tx - 18, ty - 12, 36, 24, 5);
  ctx.stroke();
  // The cup's hole (its pulsing ring is drawn each frame, neonCourseCup).
  ctx.fillStyle = "#000000";
  ctx.beginPath();
  ctx.arc(px(h.cup.x), px(h.cup.y), MG_CUP_R, 0, Math.PI * 2);
  ctx.fill();
  // The edges: glowing green on the rails' own line.
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.shadowColor = NEON_COURSE.edge;
  ctx.shadowBlur = 6;
  polyPath(ctx, h.poly);
  ctx.strokeStyle = NEON_COURSE.edge;
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.restore();
  // Hazards: their own art, each outlined in pink neon on its edge.
  parts.pieces();
  ctx.save();
  ctx.strokeStyle = NEON_COURSE.pink;
  ctx.lineWidth = 1.5;
  ctx.shadowColor = NEON_COURSE.pink;
  ctx.shadowBlur = 4;
  for (const c of [...h.rocks, ...h.planters]) {
    ctx.beginPath();
    ctx.arc(px(c.x), px(c.y), Math.max(1, px(c.r) - 0.75), 0, Math.PI * 2);
    ctx.stroke();
  }
  for (const l of h.logs) {
    const ax = px(l.ax);
    const ay = px(l.ay);
    const bx = px(l.bx);
    const by = px(l.by);
    const r = px(l.r) - 0.75;
    const a = Math.atan2(by - ay, bx - ax);
    ctx.beginPath();
    ctx.arc(ax, ay, r, a + Math.PI / 2, a + (Math.PI * 3) / 2);
    ctx.arc(bx, by, r, a - Math.PI / 2, a + Math.PI / 2);
    ctx.closePath();
    ctx.stroke();
  }
  ctx.restore();
}

/** The cup's ring, each frame: cyan, pulsing (still under Reduce Motion: the source's resting glow). */
export function neonCourseCup(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  const t = skinTime();
  const pulse = t === 0 ? 1 : 0.875 + 0.125 * Math.cos((t / 2.4) * Math.PI * 2);
  ctx.save();
  ctx.globalAlpha = pulse;
  ctx.shadowColor = NEON_COURSE.cyan;
  ctx.shadowBlur = 6;
  ctx.strokeStyle = NEON_COURSE.cyan;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, MG_CUP_R - 1, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/** The pink neon flag on a white pin (the cup's flag, where the default puts it). */
export function neonCourseFlag(ctx: CanvasRenderingContext2D, x: number, y: number, tick: number): void {
  ctx.strokeStyle = "#FFFFFF";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + 3, y - 22);
  ctx.stroke();
  const wave = Math.sin(tick / 9) * 1.5;
  ctx.fillStyle = NEON_COURSE.pink;
  ctx.beginPath();
  ctx.moveTo(x + 3, y - 22);
  ctx.quadraticCurveTo(x + 10, y - 22 + wave, x + 16, y - 19 + wave);
  ctx.lineTo(x + 3, y - 14);
  ctx.closePath();
  ctx.fill();
}

/** The night beyond the course: deep violet with faint specks. */
export function neonCourseScene(ctx: CanvasRenderingContext2D, view: ArenaSceneView): void {
  const { left, top, right, bottom } = view;
  ctx.fillStyle = NEON_COURSE.bg;
  ctx.fillRect(left, top, right - left, bottom - top);
  specks(ctx, left, top, right, bottom, 977);
}

/** What each Crazy Golf look must keep visible: the ball on the turf. */
export function minigolfContrast(look: GameLook): ContrastPair[] {
  const art = minigolfBallArt(look);
  const colours = art ? [...BALL_ART_COLOURS[art], "#06080F"] : look.world ? [NEON_COURSE.ball] : ["#FFFFFF", "#E4E7EA"];
  const backgrounds = look.world ? [NEON_COURSE.turf] : ["#2F7A3A", "#2A6F35"];
  return [{ object: "ball", colours, backgrounds }];
}
