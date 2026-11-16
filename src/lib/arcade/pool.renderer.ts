/**
 * Cue Ball's art (`pool`; display only; never imported by the sim or the server): a full-width table under three overhead
 * lamps, walnut rails with grain and mother-of-pearl sights, chrome-capped corner pockets with angled jaws and
 * half-round middle pockets with a chrome plate, the baulk line (no D), a blue chalk cube on the rail; spots 1–7 and
 * stripes 9–15 in their standard colours with numbers, the black and the cue ball, each shaded with a lamp's highlight.
 *
 * The table (everything that never moves) is painted once per canvas scale to an offscreen layer and blitted; ball
 * faces are cached per id and scale. The aim preview (the line to the ghost ball, the object ball's line and the cue
 * ball's path) is a cheap geometric guess for the player, never the sim.
 *
 * poolRev 2 (31 Oct 2026): the cue lies behind the cue ball while aiming (drawn back by the pull), the power meter is a
 * framed bar of segmented bands green → yellow → orange → red with tick marks and the cue inside it, and a potted ball
 * rolls into the pocket's mouth and drops away (shrinking and darkening into the hole, from the sim's drop tick).
 */
import type { ArenaSceneView } from "./arenaScene.renderer";
import { artHash, reducedMotion } from "./art.renderer";
import { arcadeReducedEffects } from "@/lib/fx/lowEnd";
import {
  POOL_FX_FLASH_TICKS,
  POOL_FX_FOUL_TICKS,
  POOL_FX_PUFF_TICKS,
  POOL_FX_SHIVER_TICKS,
  POOL_FX_THRUST_TICKS,
  poolContactPoint,
  poolFlight,
  poolFoulLabel,
  poolInRack,
  poolJawHit,
  poolPocketOf,
  poolSideBend,
  poolStrikePoint,
} from "./poolFx";
import { lookKey, NO_LOOK, type GameLook } from "./skins/look";
import { SPORTS_SPRITES, sportsSprite } from "./sportsSprites";
import { paintPoolSkinBall, paintNeonTable, drawNeonCue, poolBallKind, POOL_NEON_SCENE } from "./skins/pool.skins";
import {
  poolSecondsLeft,
  poolSetName,
  poolShownId,
  POOL_SET_SPOTS,
  POOL_BALL_R,
  POOL_BAULK_Y,
  POOL_BLACK,
  POOL_CB,
  POOL_CL,
  POOL_CR,
  POOL_CT,
  POOL_CUE,
  POOL_H,
  POOL_JAWS,
  POOL_MID_Y,
  POOL_POCKETS,
  POOL_RAIL,
  POOL_SPOTS,
  POOL_W,
  type PoolBall,
  type PoolPreview,
  type PoolState,
} from "./pool";

export const POOL_BG = "#07070A";
/** The deep green felt (concept C, the Sports overhaul): the bed's centre and edges, and the cushions' nose. */
export const POOL_CLOTH = "#1B6342";
export const POOL_CLOTH_EDGE = "#14523A";
const CLOTH = POOL_CLOTH;
const CLOTH_EDGE = POOL_CLOTH_EDGE;
const CLOTH_DEEP = "#0C3524";
const FONT = "'Archivo', system-ui, sans-serif";

/** Standard ball colours, 1–7 (9–15 repeat them on stripes); 8 is the black. */
export const POOL_BALL_COLOURS: Record<number, string> = {
  1: "#F2C230",
  2: "#1F4FBF",
  3: "#D22B2B",
  4: "#5B2A86",
  5: "#E8752A",
  6: "#1E7A3E",
  7: "#7A1F2A",
  8: "#111114",
};
export const poolBallColour = (id: number): string => (id === POOL_CUE ? "#F4F1E8" : POOL_BALL_COLOURS[id > 8 ? id - 8 : id] ?? "#888");

/** What the player is lining up (display only). */
export interface PoolAim {
  dx: number;
  dy: number;
  /**
   * What the level's preview shows (stage 3 of the Sports overhaul; display only): "long" (Easy) the object ball's path
   * to the cushion and a longer cue-ball line, "short" (Hard) a shorter object-ball line, "ghost" (Expert) the ghost
   * ball and the line to it only. Absent or "normal": today's preview, unchanged.
   */
  preview?: PoolPreview;
  /** 0…1, the pull on the meter. */
  power: number;
  /** The spin dot: x side (right +), y top (+) or back (−), each −100…100. */
  spinX: number;
  spinY: number;
}

const px = (u: number) => u / 256;
const R = POOL_BALL_R;
/**
 * A table ball's drawn radius (3 Nov 2026, display only): 1.5 px over the sim's POOL_BALL_R, inside the bounds
 * rule's 2 px, so the balls read larger without moving any hitbox (no stamp; collisions are POOL_BALL_R).
 */
export const POOL_BALL_DRAW_R = POOL_BALL_R + 1.5;

/* ============================== Cached layers ============================== */

function offscreen(w: number, h: number): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

let tableCache: { scale: number; key: string; canvas: HTMLCanvasElement } | null = null;

/**
 * The look this draw uses (wave 2 skins; src/lib/arcade/skins/look.ts): set by drawPool / drawPoolHud / poolScene for
 * the length of the call, the default otherwise. Display only.
 */
let L: GameLook = NO_LOOK;
const ballCache = new Map<string, HTMLCanvasElement>();

/** The device pixels per world px the context draws at. */
function scaleOf(ctx: CanvasRenderingContext2D): number {
  const t = typeof ctx.getTransform === "function" ? ctx.getTransform() : null;
  return t ? Math.max(0.5, Math.min(4, Math.hypot(t.a, t.b))) : 1;
}

/**
 * The parlour floor round the table (concept C, the Sports overhaul; display only): a warm walnut herringbone parquet
 * under a soft window light from the top left, painted in world px so the world's own margins and the play screen's
 * scene fill (poolScene) are one continuous floor, with no border between them.
 */
export function paintPoolParquet(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, x1 - x0, y1 - y0);
  ctx.clip();
  ctx.fillStyle = "#1B110A";
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  // Herringbone: 36 × 9 px blocks at 45°, each a slightly different warm brown, laid round the world's centre.
  const BL = 36;
  const BW = 9;
  ctx.save();
  ctx.translate(POOL_W / 2, POOL_H / 2);
  ctx.rotate(Math.PI / 4);
  const far = Math.max(Math.abs(x0 - POOL_W / 2), Math.abs(x1 - POOL_W / 2)) + Math.max(Math.abs(y0 - POOL_H / 2), Math.abs(y1 - POOL_H / 2));
  const n = Math.ceil(far / BL) + 2;
  for (let i = -n; i <= n; i++) {
    for (let j = -n; j <= n; j++) {
      const h = artHash((i + 500) * 977 + (j + 500), 211);
      const lift = (h % 9) - 4;
      const r = 62 + lift * 3;
      const g = 38 + lift * 2;
      const b = 22 + lift;
      const cx = i * BL;
      const cy = j * BL;
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(cx + 0.5, cy + 0.5, BL - 1, BW - 1);
      ctx.fillStyle = `rgb(${r - 6},${g - 4},${b - 3})`;
      ctx.fillRect(cx + 0.5, cy + BW + 0.5, BW - 1, BL - BW - 1);
      ctx.fillRect(cx + BW + 0.5, cy + BW + 0.5, BL - BW - 1, BW - 1);
      ctx.fillStyle = `rgb(${r - 3},${g - 2},${b - 2})`;
      ctx.fillRect(cx + BW + 0.5, cy + 2 * BW + 0.5, BL - BW - 1, BL - 2 * BW - 1);
    }
  }
  ctx.restore();
  // The room's light: a warm window glow from the top left, the far corners falling into shade (no glare).
  const lx = POOL_W * 0.25;
  const ly = POOL_H * 0.2;
  const glow = ctx.createRadialGradient(lx, ly, 40, lx, ly, Math.max(POOL_W, POOL_H) * 1.1);
  glow.addColorStop(0, "rgba(255,214,160,0.16)");
  glow.addColorStop(0.5, "rgba(255,214,160,0.04)");
  glow.addColorStop(1, "rgba(0,0,0,0.38)");
  ctx.fillStyle = glow;
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  ctx.fillStyle = "rgba(8,5,3,0.35)";
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  ctx.restore();
}

/** Brass, lit from the top left (the corner castings, the middle plates, the sights). */
function brass(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number): CanvasGradient {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, "#F3D9A0");
  g.addColorStop(0.35, "#C99A4E");
  g.addColorStop(0.65, "#8E6427");
  g.addColorStop(1, "#5E3F15");
  return g;
}

/**
 * The table (concept C, the Sports overhaul, 15 Nov 2026; display only): carved walnut rails with a raised bead and a
 * sunk channel, brass corner castings and middle plates, brass sights, a deep green felt under a soft window light,
 * leather-lined pockets, on a parquet floor. Every rail, cushion, jaw and pocket is where it always was (today's shapes).
 */
function paintTable(ctx: CanvasRenderingContext2D): void {
  if (L.world) {
    paintNeonTable(ctx, roundRect);
    return;
  }
  const rl = POOL_CL - POOL_RAIL;
  const rr = POOL_CR + POOL_RAIL;
  const rt = POOL_CT - POOL_RAIL;
  const rb = POOL_CB + POOL_RAIL;
  // The parlour floor under the whole world (the scene fill carries it on past the world's edges).
  paintPoolParquet(ctx, 0, 0, POOL_W, POOL_H);
  // The table's shadow on the floor, thrown down and right by the window light.
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  roundRect(ctx, rl + 2, rt + 6, rr - rl + 2, rb - rt + 2, 18);
  ctx.fill();
  // The rendered table (Blender, public/sports/pool/table.webp: lacquered walnut, brass, felt under the lamp, built
  // from the sim's own rails and pockets), with the chalk marks, jaws and chalk cube painted over it as below.
  const rendered = sportsSprite("pool", "table");
  if (rendered) {
    ctx.drawImage(rendered, 0, 0, POOL_W, POOL_H);
    paintTableMarks(ctx);
    return;
  }
  // Carved walnut rails: a deep warm body, darker away from the window.
  const wood = ctx.createLinearGradient(rl, rt, rr, rb);
  wood.addColorStop(0, "#5A3118");
  wood.addColorStop(0.45, "#3E2010");
  wood.addColorStop(1, "#2A1508");
  ctx.fillStyle = wood;
  roundRect(ctx, rl, rt, rr - rl, rb - rt, 16);
  ctx.fill();
  ctx.save();
  roundRect(ctx, rl, rt, rr - rl, rb - rt, 16);
  ctx.clip();
  // Grain runs along each rail: across the ends, down the long sides.
  const grain = (x0: number, y0: number, x1: number, y1: number, along: "x" | "y", salt: number) => {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, y0, x1 - x0, y1 - y0);
    ctx.clip();
    for (let i = 0; i < 34; i++) {
      const h = artHash(i, salt);
      ctx.strokeStyle = `rgba(${h % 3 ? "18,8,2" : "150,92,48"},${0.1 + ((h >> 4) % 10) / 100})`;
      ctx.lineWidth = 0.5 + ((h >> 8) % 3) * 0.3;
      ctx.beginPath();
      const f = ((h >> 3) % 1000) / 1000;
      const wob = 1 + ((h >> 12) % 3);
      if (along === "x") {
        const y = y0 + f * (y1 - y0);
        ctx.moveTo(x0, y);
        ctx.bezierCurveTo(x0 + (x1 - x0) * 0.33, y + wob, x0 + (x1 - x0) * 0.66, y - wob, x1, y);
      } else {
        const x = x0 + f * (x1 - x0);
        ctx.moveTo(x, y0);
        ctx.bezierCurveTo(x + wob, y0 + (y1 - y0) * 0.33, x - wob, y0 + (y1 - y0) * 0.66, x, y1);
      }
      ctx.stroke();
    }
    ctx.restore();
  };
  grain(rl, rt, rr, POOL_CT, "x", 71);
  grain(rl, POOL_CB, rr, rb, "x", 72);
  grain(rl, POOL_CT, POOL_CL, POOL_CB, "y", 73);
  grain(POOL_CR, POOL_CT, rr, POOL_CB, "y", 74);
  // The carving: a raised bead round the outside (lit top left) and a sunk channel part way across the rail.
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(255,206,150,0.16)";
  roundRect(ctx, rl + 2, rt + 2, rr - rl - 4, rb - rt - 4, 14);
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(0,0,0,0.55)";
  roundRect(ctx, rl + 4.5, rt + 4.5, rr - rl - 9, rb - rt - 9, 12);
  ctx.stroke();
  ctx.strokeStyle = "rgba(0,0,0,0.42)";
  ctx.lineWidth = 1.4;
  roundRect(ctx, rl + 9, rt + 9, rr - rl - 18, rb - rt - 18, 9);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,206,150,0.1)";
  ctx.lineWidth = 0.8;
  roundRect(ctx, rl + 10.2, rt + 10.2, rr - rl - 20.4, rb - rt - 20.4, 8);
  ctx.stroke();
  // A soft lacquer sheen along the top rail (no glare: a low, wide fall-off).
  const sheen = ctx.createLinearGradient(0, rt, 0, rt + 20);
  sheen.addColorStop(0, "rgba(255,214,170,0.12)");
  sheen.addColorStop(1, "rgba(255,214,170,0)");
  ctx.fillStyle = sheen;
  ctx.fillRect(rl, rt, rr - rl, 20);
  ctx.restore();
  // The cushions' rubber nose (a darker cloth band), then the deep green bed.
  ctx.fillStyle = CLOTH_DEEP;
  ctx.fillRect(POOL_CL - 6, POOL_CT - 6, POOL_CR - POOL_CL + 12, POOL_CB - POOL_CT + 12);
  const bed = ctx.createLinearGradient(0, POOL_CT, 0, POOL_CB);
  bed.addColorStop(0, CLOTH_EDGE);
  bed.addColorStop(0.5, CLOTH);
  bed.addColorStop(1, CLOTH_EDGE);
  ctx.fillStyle = bed;
  ctx.fillRect(POOL_CL, POOL_CT, POOL_CR - POOL_CL, POOL_CB - POOL_CT);
  ctx.save();
  ctx.beginPath();
  ctx.rect(POOL_CL, POOL_CT, POOL_CR - POOL_CL, POOL_CB - POOL_CT);
  ctx.clip();
  // Cloth nap: a fine, even weave.
  for (let i = 0; i < 1400; i++) {
    const h = artHash(i, 13);
    ctx.fillStyle = h % 2 ? "rgba(255,255,255,0.022)" : "rgba(0,0,0,0.05)";
    ctx.fillRect(POOL_CL + (h % (POOL_CR - POOL_CL)), POOL_CT + ((h >> 9) % (POOL_CB - POOL_CT)), 1, 1);
  }
  // The window's light across the cloth from the top left, falling off to the far corner: warm, low, no hot spot.
  const lx = POOL_CL + (POOL_CR - POOL_CL) * 0.28;
  const ly = POOL_CT + (POOL_CB - POOL_CT) * 0.3;
  const light = ctx.createRadialGradient(lx, ly, 20, lx, ly, 520);
  light.addColorStop(0, "rgba(255,232,190,0.12)");
  light.addColorStop(0.5, "rgba(255,232,190,0.04)");
  light.addColorStop(1, "rgba(0,0,0,0.16)");
  ctx.fillStyle = light;
  ctx.fillRect(POOL_CL, POOL_CT, POOL_CR - POOL_CL, POOL_CB - POOL_CT);
  // The cushions throw a narrow shade onto the cloth.
  const edge = ctx.createLinearGradient(POOL_CL, 0, POOL_CR, 0);
  edge.addColorStop(0, "rgba(0,0,0,0.3)");
  edge.addColorStop(0.06, "rgba(0,0,0,0)");
  edge.addColorStop(0.94, "rgba(0,0,0,0)");
  edge.addColorStop(1, "rgba(0,0,0,0.3)");
  ctx.fillStyle = edge;
  ctx.fillRect(POOL_CL, POOL_CT, POOL_CR - POOL_CL, POOL_CB - POOL_CT);
  const ends = ctx.createLinearGradient(0, POOL_CT, 0, POOL_CB);
  ends.addColorStop(0, "rgba(0,0,0,0.26)");
  ends.addColorStop(0.035, "rgba(0,0,0,0)");
  ends.addColorStop(0.965, "rgba(0,0,0,0)");
  ends.addColorStop(1, "rgba(0,0,0,0.26)");
  ctx.fillStyle = ends;
  ctx.fillRect(POOL_CL, POOL_CT, POOL_CR - POOL_CL, POOL_CB - POOL_CT);
  // The baulk line (no D) and the black's spot, chalk-faint.
  ctx.strokeStyle = "rgba(240,236,220,0.3)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(POOL_CL, POOL_BAULK_Y);
  ctx.lineTo(POOL_CR, POOL_BAULK_Y);
  ctx.stroke();
  ctx.fillStyle = "rgba(240,236,220,0.35)";
  ctx.beginPath();
  ctx.arc((POOL_CL + POOL_CR) / 2, POOL_CT + (POOL_CB - POOL_CT) * 0.22, 1.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // Cushion lips: a light bevel on the cloth side.
  ctx.strokeStyle = "rgba(150,220,175,0.16)";
  ctx.lineWidth = 1;
  ctx.strokeRect(POOL_CL + 0.5, POOL_CT + 0.5, POOL_CR - POOL_CL - 1, POOL_CB - POOL_CT - 1);
  // Pockets (today's shapes): brass corner castings and brass middle plates, leather-lined holes.
  for (const p of POOL_POCKETS) {
    const x = px(p.x);
    const y = px(p.y);
    const r = px(p.r);
    if (p.corner) {
      const sx = x < POOL_W / 2 ? -1 : 1;
      const sy = y < POOL_MID_Y ? -1 : 1;
      // The casting round the outside of the corner (on the rails only, never over the cloth).
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, POOL_W, POOL_H);
      ctx.rect(POOL_CL - 6, POOL_CT - 6, POOL_CR - POOL_CL + 12, POOL_CB - POOL_CT + 12);
      ctx.clip("evenodd");
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.beginPath();
      ctx.arc(x + sx * 2 + 1, y + sy * 2 + 2, r + 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = brass(ctx, x - 22, y - 22, x + 22, y + 22);
      ctx.beginPath();
      ctx.arc(x + sx * 2, y + sy * 2, r + 7, 0, Math.PI * 2);
      ctx.fill();
      // The casting's engraved ring and three studs.
      ctx.strokeStyle = "rgba(60,36,8,0.55)";
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.arc(x + sx * 2, y + sy * 2, r + 4.2, 0, Math.PI * 2);
      ctx.stroke();
      for (const a of [0.25, 0.5, 0.75]) {
        const ang = Math.atan2(sy, sx) + (a - 0.5) * 1.9;
        ctx.fillStyle = "#FBE7B8";
        ctx.beginPath();
        ctx.arc(x + sx * 2 + Math.cos(ang) * (r + 5.6) - 0.3, y + sy * 2 + Math.sin(ang) * (r + 5.6) - 0.3, 1.1, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    } else {
      const sx = x < POOL_W / 2 ? -1 : 1;
      const plateX = x + sx * 2 - (sx > 0 ? 0 : 12);
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.fillRect(plateX + 1, y - 20, 12, 42);
      ctx.fillStyle = brass(ctx, x, y - 21, x + sx * 6, y + 21);
      ctx.fillRect(plateX, y - 21, 12, 42);
      ctx.strokeStyle = "rgba(60,36,8,0.5)";
      ctx.lineWidth = 0.8;
      ctx.strokeRect(plateX + 2, y - 19, 8, 38);
    }
    // The hole: black at the bottom, the leather lining's brown at the mouth.
    const hole = ctx.createRadialGradient(x, y, 1, x, y, r + 1);
    hole.addColorStop(0, "#000");
    hole.addColorStop(0.66, "#060403");
    hole.addColorStop(0.9, "#2A170C");
    hole.addColorStop(1, "#3E2414");
    ctx.fillStyle = hole;
    ctx.beginPath();
    if (p.corner) ctx.arc(x, y, r, 0, Math.PI * 2);
    else {
      const sx = x < POOL_W / 2 ? -1 : 1;
      ctx.arc(x, y, r, sx < 0 ? Math.PI / 2 : -Math.PI / 2, sx < 0 ? Math.PI * 1.5 : Math.PI / 2);
      ctx.lineTo(x, y - r);
    }
    ctx.fill();
  }
  // The jaws: the cushions' rubber noses angled into each pocket.
  ctx.strokeStyle = "#0A3020";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  for (const j of POOL_JAWS) {
    ctx.beginPath();
    ctx.moveTo(px(j.ax), px(j.ay));
    ctx.lineTo(px(j.bx), px(j.by));
    ctx.stroke();
  }
  // Brass sights: three a side between pockets on the long rails, three on each end.
  const sight = (x: number, y: number) => {
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.arc(x + 0.5, y + 0.7, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = brass(ctx, x - 2, y - 2, x + 2, y + 2);
    ctx.beginPath();
    ctx.arc(x, y, 2.2, 0, Math.PI * 2);
    ctx.fill();
  };
  const half = (POOL_CB - POOL_CT) / 2;
  for (const k of [1, 2, 3]) {
    for (const y of [POOL_CT + (half * k) / 4, POOL_MID_Y + (half * k) / 4]) {
      sight(POOL_CL - POOL_RAIL / 2 - 2, y);
      sight(POOL_CR + POOL_RAIL / 2 + 2, y);
    }
    const x = POOL_CL + ((POOL_CR - POOL_CL) * k) / 4;
    sight(x, POOL_CT - POOL_RAIL / 2 - 2);
    sight(x, POOL_CB + POOL_RAIL / 2 + 2);
  }
  // The blue chalk cube on the bottom-right rail.
  const cx = POOL_CR - 40;
  const cy = POOL_CB + POOL_RAIL / 2 + 1;
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.fillRect(cx - 4, cy - 2, 10, 9);
  ctx.fillStyle = "#2E6FD8";
  ctx.fillRect(cx - 5, cy - 5, 10, 10);
  ctx.fillStyle = "#5C95F0";
  ctx.fillRect(cx - 5, cy - 5, 10, 3);
  ctx.fillStyle = "#1B4FA6";
  ctx.fillRect(cx - 2, cy - 2, 4, 4);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** The marks painted over the rendered table: the baulk line, the black's spot, the jaws and the chalk cube. */
function paintTableMarks(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.strokeStyle = "rgba(240,236,220,0.3)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(POOL_CL, POOL_BAULK_Y);
  ctx.lineTo(POOL_CR, POOL_BAULK_Y);
  ctx.stroke();
  ctx.fillStyle = "rgba(240,236,220,0.35)";
  ctx.beginPath();
  ctx.arc((POOL_CL + POOL_CR) / 2, POOL_CT + (POOL_CB - POOL_CT) * 0.22, 1.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#0A3020";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  for (const j of POOL_JAWS) {
    ctx.beginPath();
    ctx.moveTo(px(j.ax), px(j.ay));
    ctx.lineTo(px(j.bx), px(j.by));
    ctx.stroke();
  }
  const cx = POOL_CR - 40;
  const cy = POOL_CB + POOL_RAIL / 2 + 1;
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.fillRect(cx - 4, cy - 2, 10, 9);
  ctx.fillStyle = "#2E6FD8";
  ctx.fillRect(cx - 5, cy - 5, 10, 10);
  ctx.fillStyle = "#5C95F0";
  ctx.fillRect(cx - 5, cy - 5, 10, 3);
  ctx.fillStyle = "#1B4FA6";
  ctx.fillRect(cx - 2, cy - 2, 4, 4);
  ctx.restore();
}

function drawTable(ctx: CanvasRenderingContext2D): void {
  const scale = scaleOf(ctx);
  // Repainted once when the rendered table arrives (sportsSprite answers null until then; the painted table meanwhile).
  const key = `${L.world ?? ""}|${L.world ? 0 : sportsSprite("pool", "table") ? 1 : 0}`;
  if (!tableCache || Math.abs(tableCache.scale - scale) > 0.01 || tableCache.key !== key) {
    const c = offscreen(POOL_W * scale, POOL_H * scale);
    if (!c) {
      paintTable(ctx);
      return;
    }
    const cc = c.getContext("2d")!;
    cc.scale(scale, scale);
    paintTable(cc);
    tableCache = { scale, key, canvas: c };
  }
  ctx.drawImage(tableCache.canvas, 0, 0, POOL_W, POOL_H);
}

/* ================================= Balls ================================= */

function paintBall(ctx: CanvasRenderingContext2D, id: number, x: number, y: number, r: number): void {
  const skinned = poolBallKind(L, id);
  if (skinned) {
    paintPoolSkinBall(ctx, skinned, id, x, y, r, numberTurn, !!L.world);
    return;
  }
  const colour = poolBallColour(id);
  const stripe = id >= 9;
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();
  // 3 Nov 2026 (display only; Joe's audit): spots and stripes told apart at a glance, the set being the
  // game's rule since poolRev 4. A spot is the solid colour with a small white spot; a stripe the colour
  // with a broad, clean white band through its middle (the number sits in the band).
  ctx.fillStyle = id === POOL_CUE ? "#F4F1E8" : colour;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  if (stripe) {
    ctx.fillStyle = "#FBFAF5";
    ctx.fillRect(x - r, y - r * 0.36, r * 2, r * 0.72);
  }
  if (id !== POOL_CUE) {
    const spotR = stripe ? r * 0.3 : r * 0.36;
    if (!stripe) {
      ctx.fillStyle = "#FBFAF5";
      ctx.beginPath();
      ctx.arc(x, y, spotR, 0, Math.PI * 2);
      ctx.fill();
    }
    // The number only where it can be read (the HUD's small rack balls show the pattern alone).
    if (r >= 7) {
      ctx.fillStyle = "#111";
      ctx.font = `800 ${Math.max(4, r * (stripe ? 0.6 : 0.5))}px ${FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      if (numberTurn) {
        // Cue Ball's turned desktop table: the number turned back to read upright on screen.
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(numberTurn);
        ctx.fillText(String(id), r * 0.04, 0);
        ctx.restore();
      } else ctx.fillText(String(id), x, y + r * 0.04);
    }
  }
  // Shading from the window light (top left; the Sports overhaul's rendered look): a soft core light, the body
  // falling into shade towards the bottom right, the felt's green bounced into the lower rim, a sharp window
  // highlight and a faint secondary glint. All inside the ball's radius.
  const shade = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r * 1.05);
  shade.addColorStop(0, "rgba(255,248,236,0.34)");
  shade.addColorStop(0.35, "rgba(255,248,236,0.05)");
  shade.addColorStop(0.75, "rgba(0,0,0,0.2)");
  shade.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = shade;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  const bounce = ctx.createRadialGradient(x + r * 0.45, y + r * 0.6, 0, x + r * 0.45, y + r * 0.6, r * 0.75);
  bounce.addColorStop(0, "rgba(60,150,100,0.28)");
  bounce.addColorStop(1, "rgba(60,150,100,0)");
  ctx.fillStyle = bounce;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.fillStyle = "rgba(255,252,244,0.92)";
  ctx.beginPath();
  ctx.ellipse(x - r * 0.38, y - r * 0.42, r * 0.22, r * 0.15, -0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,252,244,0.35)";
  ctx.beginPath();
  ctx.arc(x + r * 0.42, y + r * 0.36, r * 0.07, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** A ball (with its contact shadow) at any radius, in the default look: the reveal's run summary (display only). */
export function drawPoolBallAt(ctx: CanvasRenderingContext2D, id: number, x: number, y: number, r: number): void {
  drawBall(ctx, id, x, y, r);
}

function drawBall(ctx: CanvasRenderingContext2D, id: number, x: number, y: number, r = POOL_BALL_DRAW_R): void {
  // Contact shadow.
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(x + 1.6, y + 2.2, r * 1.02, r * 0.92, 0, 0, Math.PI * 2);
  ctx.fill();
  drawBallSprite(ctx, id, x, y, r);
}

/** A ball's face at (x, y) and radius `drawR`, from the sprite cached at radius `r` (no shadow). */
function drawBallSprite(ctx: CanvasRenderingContext2D, id: number, x: number, y: number, drawR: number, r = drawR): void {
  const k = drawR / r;
  const scale = scaleOf(ctx);
  const lk = lookKey(L);
  const key = `${lk ? `${lk}#` : ""}${id}:${r}:${scale.toFixed(2)}`;
  let sprite = ballCache.get(key);
  if (!sprite) {
    const size = (r * 2 + 2) * scale;
    const c = offscreen(size, size);
    if (!c) {
      paintBall(ctx, id, x, y, drawR);
      return;
    }
    const cc = c.getContext("2d")!;
    cc.scale(scale, scale);
    paintBall(cc, id, r + 1, r + 1, r);
    if (ballCache.size > 200) ballCache.clear();
    ballCache.set(key, c);
    sprite = c;
  }
  const h = (r + 1) * k;
  ctx.drawImage(sprite, x - h, y - h, h * 2, h * 2);
}

/* ================================ Aim ================================ */

/** Where the aim's line first meets a ball (ghost ball centre) or a cushion. Geometry only. */
function aimHit(balls: readonly PoolBall[], cx: number, cy: number, ux: number, uy: number): { x: number; y: number; ball: PoolBall | null } {
  let best = Infinity;
  let ball: PoolBall | null = null;
  const D = 2 * R;
  for (const b of balls) {
    if (b.down || b.id === POOL_CUE) continue;
    const bx = px(b.x) - cx;
    const by = px(b.y) - cy;
    const along = bx * ux + by * uy;
    if (along <= 0) continue;
    const perp2 = bx * bx + by * by - along * along;
    if (perp2 > D * D) continue;
    const t = along - Math.sqrt(D * D - perp2);
    if (t < best) {
      best = t;
      ball = b;
    }
  }
  // The cushion line the cue ball's centre would meet.
  const tx = ux > 0 ? (POOL_CR - R - cx) / ux : ux < 0 ? (POOL_CL + R - cx) / ux : Infinity;
  const ty = uy > 0 ? (POOL_CB - R - cy) / uy : uy < 0 ? (POOL_CT + R - cy) / uy : Infinity;
  const wall = Math.min(tx, ty);
  if (wall < best) return { x: cx + ux * wall, y: cy + uy * wall, ball: null };
  return { x: cx + ux * best, y: cy + uy * best, ball };
}

function drawAim(ctx: CanvasRenderingContext2D, s: PoolState, aim: PoolAim): void {
  const cue = s.balls.find((b) => b.id === POOL_CUE && !b.down);
  if (!cue) return;
  const l = Math.hypot(aim.dx, aim.dy);
  if (l < 1e-6) return;
  const ux = aim.dx / l;
  const uy = aim.dy / l;
  const cx = px(cue.x);
  const cy = px(cue.y);
  const hit = aimHit(s.balls, cx, cy, ux, uy);
  const side = poolAimSide(aim, s.rev);
  ctx.save();
  ctx.lineCap = "round";
  // The dotted line to the ghost ball.
  ctx.setLineDash([2, 5]);
  ctx.strokeStyle = "rgba(255,255,255,0.75)";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(cx + ux * (R + 2), cy + uy * (R + 2));
  ctx.lineTo(hit.x, hit.y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(hit.x, hit.y, R, 0, Math.PI * 2);
  ctx.stroke();
  const reach = 30 + 70 * Math.max(0.2, aim.power);
  const preview = aim.preview ?? "normal";
  // Expert: the ghost ball and the line to it, nothing past the contact.
  if (preview === "ghost") {
    ctx.restore();
    return;
  }
  if (hit.ball) {
    const bx = px(hit.ball.x);
    const by = px(hit.ball.y);
    const nx = (bx - hit.x) / (2 * R);
    const ny = (by - hit.y) / (2 * R);
    // The object ball's line (along the line of centres), short; Easy runs it on to the cushion it heads for, Hard
    // shows less of it.
    const objLen = preview === "long" ? poolCushionBounce(bx, by, nx, ny).d : reach * (preview === "short" ? POOL_SHORT_OBJECT : 0.6);
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(bx + nx * R, by + ny * R);
    ctx.lineTo(bx + nx * (R + Math.max(0, objLen - R)), by + ny * (R + Math.max(0, objLen - R)));
    ctx.stroke();
    // The cue ball's path: the tangent line, bent by follow or draw.
    const dot = ux * nx + uy * ny;
    let tx = ux - dot * nx;
    let ty = uy - dot * ny;
    // poolRev 3's follow and draw are 1.75× poolRev 2's, so its preview bends 1.75× as far.
    const tb = (aim.spinY / 50) * (s.rev >= 3 ? 1.75 : 1);
    tx += (tb * 0.2) * ux;
    ty += (tb * 0.2) * uy;
    const tl = Math.hypot(tx, ty);
    if (tl > 0.02) {
      ctx.strokeStyle = "rgba(255,255,255,0.32)";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(hit.x, hit.y);
      const cueLen = reach * (preview === "long" ? 1 : 0.5);
      ctx.lineTo(hit.x + (tx / tl) * cueLen, hit.y + (ty / tl) * cueLen);
      ctx.stroke();
      ctx.setLineDash([]);
      // Side spin (stage 2): the cue ball runs on to its first cushion and bends there as the sim bends it.
      if (side !== 0) drawSideBend(ctx, hit.x, hit.y, tx / tl, ty / tl, side, s.rev, reach);
    }
  } else if (side !== 0) {
    // Off the cushion with side: the bounce bent by the spin, as the sim bends it.
    drawSideBend(ctx, cx, cy, ux, uy, side, s.rev, reach, true);
  } else {
    // Off the cushion: a faint reflected line.
    const vertical = Math.abs(hit.x - (POOL_CL + R)) < 0.5 || Math.abs(hit.x - (POOL_CR - R)) < 0.5;
    const rx = vertical ? -ux : ux;
    const ry = vertical ? uy : -uy;
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(hit.x, hit.y);
    ctx.lineTo(hit.x + rx * reach * 0.5, hit.y + ry * reach * 0.5);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();
}

/** The aim's side spin in the sim's own units (poolRev 2+: the dot's x, −100…100; poolRev 1: −2…2). */
export function poolAimSide(aim: Pick<PoolAim, "spinX">, rev: number): number {
  const x = Math.max(-100, Math.min(100, Math.round(aim.spinX)));
  return rev >= 2 ? x : Math.round(x / 50);
}

/** Where a path from (x, y) along (ux, uy) meets a cushion line (world px), and the plain reflected direction there. */
export function poolCushionBounce(x: number, y: number, ux: number, uy: number): { x: number; y: number; rx: number; ry: number; d: number } {
  const tx = ux > 0 ? (POOL_CR - R - x) / ux : ux < 0 ? (POOL_CL + R - x) / ux : Infinity;
  const ty = uy > 0 ? (POOL_CB - R - y) / uy : uy < 0 ? (POOL_CT + R - y) / uy : Infinity;
  const d = Math.min(tx, ty);
  return { x: x + ux * d, y: y + uy * d, rx: tx <= ty ? -ux : ux, ry: tx <= ty ? uy : -uy, d };
}

/**
 * The preview's spun bounce (stage 2): the run on to the first cushion, then the reflected line turned by the side spin
 * exactly as the sim turns the cue ball's velocity there (poolSideBend), in the cue's gold. `fromCue`: the line to the
 * cushion is the aim's own (already drawn).
 */
function drawSideBend(ctx: CanvasRenderingContext2D, x: number, y: number, ux: number, uy: number, side: number, rev: number, reach: number, fromCue = false): void {
  const b = poolCushionBounce(x, y, ux, uy);
  if (!Number.isFinite(b.d) || b.d > 260) return;
  const bent = poolSideBend(b.rx, b.ry, side, rev);
  const bl = Math.hypot(bent.vx, bent.vy) || 1;
  ctx.setLineDash([3, 4]);
  if (!fromCue) {
    ctx.strokeStyle = "rgba(255,255,255,0.22)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(242,199,92,0.8)";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(b.x, b.y);
  ctx.lineTo(b.x + (bent.vx / bl) * reach * 0.55, b.y + (bent.vy / bl) * reach * 0.55);
  ctx.stroke();
  ctx.setLineDash([]);
}

/* ================================ The cue ================================ */

/** The cue's length (world px) and how far back a full pull draws it from the ball. */
const CUE_LEN = 300;
/** Hard's object-ball line: this share of the reach (today's Normal shows 0.6 of it). */
export const POOL_SHORT_OBJECT = 0.25;
const CUE_PULL = 46;

/**
 * The cue stick behind the cue ball, along the aim (ux, uy) and drawn back by the pull: the blue chalked tip, a white
 * ferrule, the maple shaft, a gold joint ring and the dark wrapped butt, over its own soft shadow on the cloth.
 */
function drawCueStick(ctx: CanvasRenderingContext2D, cx: number, cy: number, ux: number, uy: number, pull: number): void {
  const gap = R + 3 + CUE_PULL * Math.max(0, Math.min(1, pull));
  const tipX = cx - ux * gap;
  const tipY = cy - uy * gap;
  const angle = Math.atan2(-uy, -ux);
  if (L.world) {
    drawNeonCue(ctx, tipX, tipY, angle, CUE_LEN);
    return;
  }
  ctx.save();
  // The shadow, offset away from the lamps.
  ctx.save();
  ctx.translate(tipX + 3, tipY + 4);
  ctx.rotate(angle);
  ctx.fillStyle = "rgba(0,0,0,0.32)";
  ctx.beginPath();
  ctx.moveTo(0, -1.8);
  ctx.lineTo(CUE_LEN, -4.6);
  ctx.lineTo(CUE_LEN, 4.6);
  ctx.lineTo(0, 1.8);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.translate(tipX, tipY);
  ctx.rotate(angle);
  // Butt (dark wood with a wrap), joint ring, maple shaft, ferrule and tip; x runs from the tip back.
  const half = (x: number) => 1.8 + (2.8 * x) / CUE_LEN;
  const body = (x0: number, x1: number, fill: string | CanvasGradient) => {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(x0, -half(x0));
    ctx.lineTo(x1, -half(x1));
    ctx.lineTo(x1, half(x1));
    ctx.lineTo(x0, half(x0));
    ctx.closePath();
    ctx.fill();
  };
  const maple = ctx.createLinearGradient(0, -3, 0, 3);
  maple.addColorStop(0, "#F7EBD2");
  maple.addColorStop(0.5, "#E6D1A8");
  maple.addColorStop(1, "#BFA67A");
  body(4, CUE_LEN * 0.55, maple);
  body(CUE_LEN * 0.55, CUE_LEN * 0.55 + 3, "#E3B341");
  const butt = ctx.createLinearGradient(0, -5, 0, 5);
  butt.addColorStop(0, "#5A2E16");
  butt.addColorStop(0.5, "#2B140A");
  butt.addColorStop(1, "#130905");
  body(CUE_LEN * 0.55 + 3, CUE_LEN * 0.78, butt);
  body(CUE_LEN * 0.78, CUE_LEN, "#16161A");
  // Wrap lines on the grip.
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 0.6;
  for (let x = CUE_LEN * 0.8; x < CUE_LEN - 4; x += 4) {
    ctx.beginPath();
    ctx.moveTo(x, -half(x));
    ctx.lineTo(x + 1.5, half(x));
    ctx.stroke();
  }
  // Ferrule and the chalked tip.
  body(1.2, 4, "#F8F8F6");
  body(0, 1.2, "#2E6FD8");
  // A highlight down the shaft.
  ctx.strokeStyle = "rgba(255,255,255,0.45)";
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(6, -0.8);
  ctx.lineTo(CUE_LEN * 0.54, -1.9);
  ctx.stroke();
  ctx.restore();
}

/* ============================ The Captain's arm ============================ */

/** How faint the black is drawn while it is locked (the Sports overhaul). */
export const POOL_BLACK_LOCKED_ALPHA = 0.5;
/** Where the Captain's hand grips the cue, from its tip (world px), and the arm's length from the hand to the shoulder. */
export const POOL_ARM_GRIP = Math.round(CUE_LEN * 0.85);
export const POOL_ARM_LEN = 104;
/** The arm leaves the cue backwards, turned this far (radians) to the cue's right, as a player's grip arm does. */
export const POOL_ARM_TURN = 0.48;
/** The arm sprite's size and anchors (render_sports.py): the hand (where the cue sits) and the shoulder, in image px. */
const ARM = SPORTS_SPRITES.pool.arm as unknown as { w: number; h: number; hand: [number, number]; shoulder: [number, number] };

/**
 * Where the Captain's arm sits for a cue ball at (cx, cy), the aim (ux, uy) and the pull (display only, world px):
 * the hand on the cue's butt (moving with the pull) and the shoulder behind it, the arm's direction and its scale.
 */
export function poolArmPlacement(cx: number, cy: number, ux: number, uy: number, pull: number): { hx: number; hy: number; sx: number; sy: number; angle: number; k: number; halfW: number } {
  const gap = R + 3 + CUE_PULL * Math.max(0, Math.min(1, pull));
  const hx = cx - ux * (gap + POOL_ARM_GRIP);
  const hy = cy - uy * (gap + POOL_ARM_GRIP);
  const back = Math.atan2(-uy, -ux) + POOL_ARM_TURN;
  const sx = hx + Math.cos(back) * POOL_ARM_LEN;
  const sy = hy + Math.sin(back) * POOL_ARM_LEN;
  const a = ARM;
  const len = Math.hypot(a.shoulder[0] - a.hand[0], a.shoulder[1] - a.hand[1]);
  const k = POOL_ARM_LEN / len;
  return { hx, hy, sx, sy, angle: back, k, halfW: (a.h * k) / 2 };
}

/**
 * Captain Joulz's arm from above (the Sports overhaul; Blender render public/sports/pool/arm.webp, his skin's set):
 * the gold-gauntleted hand closed round the cue's butt, the arm leaving behind and to the side, drawn back with the
 * pull. Always ~250 px behind the cue ball, so never over the ball, the aim, the ghost ball or the target. Nothing is
 * drawn until the image has loaded.
 */
function drawCaptainArm(ctx: CanvasRenderingContext2D, cx: number, cy: number, ux: number, uy: number, pull: number): void {
  const img = sportsSprite("pool", "arm", true);
  if (!img) return;
  const a = ARM;
  const p = poolArmPlacement(cx, cy, ux, uy, pull);
  const spriteAngle = Math.atan2(a.shoulder[1] - a.hand[1], a.shoulder[0] - a.hand[0]);
  ctx.save();
  // A soft shadow on the cloth, offset away from the window light.
  ctx.strokeStyle = "rgba(0,0,0,0.28)";
  ctx.lineCap = "round";
  ctx.lineWidth = p.halfW * 1.3;
  ctx.beginPath();
  ctx.moveTo(p.hx + 3, p.hy + 4);
  ctx.lineTo(p.sx + 3, p.sy + 4);
  ctx.stroke();
  ctx.translate(p.hx, p.hy);
  ctx.rotate(p.angle - spriteAngle);
  ctx.scale(p.k, p.k);
  ctx.drawImage(img, -a.hand[0], -a.hand[1], a.w, a.h);
  ctx.restore();
}

/* ============================ Potted balls ============================ */

/** A potted ball's drop: this many ticks rolling into the mouth, shrinking and darkening into the hole. */
const DROP_TICKS = 18;
/** The roll into the mouth runs this much faster than the drop: the ball reaches the mouth at 1 / DROP_ROLL of it. */
const DROP_ROLL = 1.8;
/** The drop's tick (from the sim's `downAt`) the ball reaches the pocket's mouth: the pocket sound starts here. */
export const POOL_DROP_MOUTH_TICKS = Math.ceil(DROP_TICKS / DROP_ROLL);

/** The pocket a ball dropped into: the nearest one to where it went down. */
function pocketOf(b: PoolBall): { x: number; y: number; r: number } {
  let best = POOL_POCKETS[0]!;
  let bestD = Infinity;
  for (const p of POOL_POCKETS) {
    const d = (p.x - b.x) * (p.x - b.x) + (p.y - b.y) * (p.y - b.y);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return { x: px(best.x), y: px(best.y), r: px(best.r) };
}

/** Balls dropping (poolRev 2's drop tick): each rolls on into its pocket and sinks, drawn under the pocket's shade. */
function drawDropping(ctx: CanvasRenderingContext2D, s: PoolState): void {
  for (const b of s.balls) {
    if (!b.down || b.downAt === undefined) continue;
    const age = s.tick - b.downAt;
    if (age < 0 || age >= DROP_TICKS) continue;
    const t = age / DROP_TICKS;
    const p = pocketOf(b);
    const roll = Math.min(1, t * DROP_ROLL);
    const ease = 1 - (1 - roll) * (1 - roll);
    const x = px(b.x) + (p.x - px(b.x)) * ease;
    const y = px(b.y) + (p.y - px(b.y)) * ease;
    const r = POOL_BALL_DRAW_R * (1 - 0.55 * t);
    ctx.save();
    // Keep the sinking ball inside the hole once it reaches the mouth (it falls below the cloth, not over the rail).
    if (roll >= 1) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r + 1, 0, Math.PI * 2);
      ctx.clip();
    }
    ctx.globalAlpha = 1 - 0.35 * t;
    drawBallSprite(ctx, poolShownId(b.id, s.set ?? POOL_SET_SPOTS), x, y, r, POOL_BALL_DRAW_R);
    ctx.globalAlpha = 1;
    ctx.fillStyle = `rgba(0,0,0,${(0.85 * t).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(x, y, r + 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

/* ============================ Stage-2 effects ============================ */
/*
 * The Sports overhaul's effects (phase 2 step 4; display only): each read off the sim's own state by poolFx.ts, so a
 * replay, a reveal or a live run draws them alike; nothing here writes to a state. Under reduced motion every transient
 * flourish (the thrust, the puff, the flash, the shiver, the flight, the pop) is left out and the state is drawn still;
 * reduced effects and the battery saver draw them lighter (fewer particles).
 */

/** No moving flourishes (prefers-reduced-motion): the state change still shows, drawn still. */
function stillFx(): boolean {
  return reducedMotion();
}
/** Fewer particles (a slow phone, the battery saver). */
function liteFx(): boolean {
  return arcadeReducedEffects();
}

/**
 * Jaw rattles seen (display only): the ball, the tick, the run and the point on the jaw it struck (a rattle shivers for
 * POOL_FX_SHIVER_TICKS). Read off the sim each drawn frame by poolRattleNow.
 */
let rattle: { seed: number; shots: number; tick: number; id: number; jx: number; jy: number } | null = null;

/** The rattle showing on this state (its ball, age and jaw point), or null. Notes a new one when this tick has one. */
export function poolRattleNow(s: PoolState): { id: number; age: number; jx: number; jy: number } | null {
  const hit = poolJawHit(s);
  if (hit) rattle = { seed: s.seed, shots: s.shots, tick: s.tick, id: hit.id, jx: hit.x, jy: hit.y };
  if (!rattle || rattle.seed !== s.seed || rattle.shots !== s.shots) return null;
  const age = s.tick - rattle.tick;
  if (age < 0 || age >= POOL_FX_SHIVER_TICKS) return null;
  return { id: rattle.id, age, jx: rattle.jx, jy: rattle.jy };
}

/**
 * The ball shivering after a jaw rattle, and its offset (world px) this frame; 0, 0 otherwise. The shiver runs along the
 * jaw's normal (towards and away from the jaw), 2.6 px each way at first, alternating every 2 ticks and easing to 2 px,
 * so it reads at phone size (a 16 px ball); the sim's position is untouched.
 */
export function poolShiver(s: PoolState, id: number): { dx: number; dy: number } {
  if (stillFx()) return { dx: 0, dy: 0 };
  const r = poolRattleNow(s);
  if (!r || r.id !== id) return { dx: 0, dy: 0 };
  const b = s.balls.find((x) => x.id === id);
  if (!b) return { dx: 0, dy: 0 };
  let nx = px(b.x) - r.jx;
  let ny = px(b.y) - r.jy;
  const len = Math.hypot(nx, ny) || 1;
  nx /= len;
  ny /= len;
  const fall = 1 - r.age / POOL_FX_SHIVER_TICKS;
  const amp = (2 + 0.6 * fall) * ((r.age >> 1) % 2 === 0 ? 1 : -1);
  return { dx: nx * amp, dy: ny * amp };
}

/** Two short arcs at the jaw a ball rattled off, opening towards the ball and fading (reduced effects: one). */
function drawRattleMarks(ctx: CanvasRenderingContext2D, s: PoolState): void {
  if (stillFx()) return;
  const r = poolRattleNow(s);
  if (!r) return;
  const b = s.balls.find((x) => x.id === r.id);
  if (!b) return;
  const dir = Math.atan2(px(b.y) - r.jy, px(b.x) - r.jx);
  const fade = 1 - r.age / POOL_FX_SHIVER_TICKS;
  const grow = Math.min(1, (r.age + 2) / 6);
  ctx.save();
  ctx.strokeStyle = "#FFEFC2";
  ctx.lineCap = "round";
  ctx.lineWidth = 1.8;
  for (let k = 0; k < (liteFx() ? 1 : 2); k++) {
    ctx.globalAlpha = 0.9 * fade * (k === 0 ? 1 : 0.7);
    ctx.beginPath();
    ctx.arc(r.jx, r.jy, (5 + 4.5 * k) * grow + 1.5, dir - 0.8, dir + 0.8);
    ctx.stroke();
  }
  ctx.restore();
}

/** The cue's thrust through the ball at the strike, and the chalk puff off its tip. */
function drawStrike(ctx: CanvasRenderingContext2D, s: PoolState): void {
  if (stillFx()) return;
  const st = poolStrikePoint(s);
  if (!st) return;
  if (st.age < POOL_FX_THRUST_TICKS) {
    // The tip runs on through where the ball sat (6 px of follow-through), then the cue fades away.
    const t = st.age / POOL_FX_THRUST_TICKS;
    const through = 6 * Math.min(1, t * 2.4);
    ctx.save();
    ctx.globalAlpha = t < 0.5 ? 1 : 1 - (t - 0.5) * 2;
    drawCueStick(ctx, st.x + st.ux * through, st.y + st.uy * through, st.ux, st.uy, 0);
    drawCaptainArm(ctx, st.x + st.ux * through, st.y + st.uy * through, st.ux, st.uy, 0);
    ctx.restore();
  }
  // The chalk puff: a few pale blue motes off the tip, drifting back and fading.
  const n = liteFx() ? 2 : 6;
  const t = st.age / POOL_FX_PUFF_TICKS;
  const tipX = st.x - st.ux * (R + 2);
  const tipY = st.y - st.uy * (R + 2);
  ctx.save();
  for (let i = 0; i < n; i++) {
    const h = artHash(s.shots * 31 + i, s.seed);
    const a = Math.atan2(-st.uy, -st.ux) + (((h & 255) / 255) - 0.5) * 2.2;
    const d = 2 + (6 + ((h >> 8) & 7)) * t;
    ctx.globalAlpha = 0.55 * (1 - t);
    ctx.fillStyle = i % 2 ? "#CFE2FF" : "#7FA8E6";
    ctx.beginPath();
    ctx.arc(tipX + Math.cos(a) * d, tipY + Math.sin(a) * d, 1.1 + 1.4 * t, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Where two balls meet (the Sports overhaul, readable at phone size): a crisp burst of six white-gold rays (long and short
 * in turn) and a thin gold ring opening from the contact point, with both balls' rims catching the light for the first two
 * thirds; strokes only (no glow or gradient, so nothing washes across the felt or the numbers), gone in
 * POOL_FX_FLASH_TICKS. Reduced effects: the ring alone. Reduced motion: nothing.
 */
function drawContactFlash(ctx: CanvasRenderingContext2D, s: PoolState): void {
  if (stillFx()) return;
  const c = poolContactPoint(s);
  if (!c) return;
  const t = c.age / POOL_FX_FLASH_TICKS;
  const fade = 1 - t;
  const out = 1 - (1 - t) * (1 - t);
  ctx.save();
  ctx.lineCap = "round";
  if (!liteFx() && t < 0.67) {
    ctx.globalAlpha = 0.8 * (1 - t / 0.67);
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 1.2;
    for (const id of [c.a, c.b]) {
      const b = s.balls.find((x) => x.id === id && !x.down);
      if (!b) continue;
      // The rim on the side facing the contact.
      const face = Math.atan2(c.y - px(b.y), c.x - px(b.x));
      ctx.beginPath();
      ctx.arc(px(b.x), px(b.y), POOL_BALL_DRAW_R + 0.3, face - 1.1, face + 1.1);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 0.85 * fade;
  ctx.strokeStyle = "#FFD982";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(c.x, c.y, 2.5 + 6.5 * out, 0, Math.PI * 2);
  ctx.stroke();
  if (!liteFx()) {
    ctx.strokeStyle = "#FFF8E6";
    ctx.lineWidth = 1.6;
    ctx.globalAlpha = 0.95 * fade;
    for (let k = 0; k < 6; k++) {
      const a = (k * Math.PI) / 3 + 0.3;
      const reach = (k % 2 === 0 ? 11 : 7.5) * (0.55 + 0.45 * out);
      const inner = 2 + 3 * out;
      ctx.beginPath();
      ctx.moveTo(c.x + Math.cos(a) * inner, c.y + Math.sin(a) * inner);
      ctx.lineTo(c.x + Math.cos(a) * reach, c.y + Math.sin(a) * reach);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** How much of a foul's moment is left showing (1 → 0 over its last quarter), or 0 with none. */
function foulFade(s: PoolState): number {
  const lab = poolFoulLabel(s);
  if (!lab) return 0;
  const t = lab.age / POOL_FX_FOUL_TICKS;
  return t < 0.75 ? 1 : 1 - (t - 0.75) / 0.25;
}

/** A foul's red glow round the cue ball, drawn under the ball (a ring from its edge out 6 px). */
function drawFoulGlow(ctx: CanvasRenderingContext2D, s: PoolState, cx: number, cy: number): void {
  const fade = foulFade(s);
  if (fade <= 0) return;
  ctx.save();
  ctx.globalAlpha = fade;
  const g = ctx.createRadialGradient(cx, cy, POOL_BALL_DRAW_R - 0.5, cx, cy, POOL_BALL_DRAW_R + 6);
  g.addColorStop(0, "rgba(232,56,64,0.6)");
  g.addColorStop(1, "rgba(232,56,64,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, POOL_BALL_DRAW_R + 6, 0, Math.PI * 2);
  ctx.arc(cx, cy, POOL_BALL_DRAW_R - 0.5, 0, Math.PI * 2, true);
  ctx.fill();
  ctx.restore();
}

/** A foul: the cue ball ringed in red and "FOUL −10" beside it, inside the table (the glow is drawFoulGlow, under it). */
function drawFoul(ctx: CanvasRenderingContext2D, s: PoolState): void {
  const lab = poolFoulLabel(s);
  if (!lab) return;
  const cue = s.balls.find((b) => b.id === POOL_CUE && !b.down);
  if (!cue) return;
  const fade = foulFade(s);
  const cx = px(cue.x);
  const cy = px(cue.y);
  ctx.save();
  ctx.globalAlpha = fade;
  ctx.strokeStyle = "rgba(255,92,96,0.95)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, POOL_BALL_DRAW_R + 1.5, 0, Math.PI * 2);
  ctx.stroke();
  // The label: a red pill beside the ball (it rises 4 px as it arrives, still under reduced motion).
  const rise = stillFx() ? 0 : 4 * Math.max(0, 1 - lab.age / 8);
  ctx.font = `800 12px ${FONT}`;
  const w = Math.ceil(ctx.measureText(lab.text).width) + 16;
  const h = 20;
  ctx.fillStyle = "rgba(120,20,24,0.94)";
  roundRect(ctx, lab.x - w / 2, lab.y - h / 2 + rise, w, h, h / 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,140,140,0.7)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = "#FFF1F0";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(lab.text, lab.x, lab.y + rise + 0.5);
  ctx.restore();
}

/** Potted balls of the player's set flying up to their rack slot after the drop (an arc, growing to the rack's size). */
function drawFlights(ctx: CanvasRenderingContext2D, s: PoolState): void {
  if (stillFx()) return;
  const set = s.set ?? POOL_SET_SPOTS;
  for (const b of s.balls) {
    const f = poolFlight(s, b);
    if (f === null) continue;
    const from = poolPocketOf(b);
    const to = poolRackSlot(ctx, s, b.id);
    const e = 1 - (1 - f) * (1 - f);
    // A gentle arc, as high as a third of the trip (at most 40 px), never above the screen's top.
    const lift = Math.min(40, Math.hypot(to.x - from.x, to.y - from.y) / 3);
    const x = from.x + (to.x - from.x) * e;
    const y = Math.max(8, from.y + (to.y - from.y) * e - Math.sin(f * Math.PI) * lift);
    const r = 4 + (7 - 4) * e;
    ctx.save();
    ctx.globalAlpha = Math.min(1, f * 4);
    drawBall(ctx, poolShownId(b.id, set), x, y, r);
    ctx.restore();
  }
}

/** The streak chip's pop: the tick the run last grew (display only), so the count swells as it changes. */
let streakSeen: { seed: number; streak: number; tick: number } | null = null;
function streakPop(s: PoolState): number {
  if (!streakSeen || streakSeen.seed !== s.seed || s.streak < streakSeen.streak || s.tick < streakSeen.tick) streakSeen = { seed: s.seed, streak: s.streak, tick: -999 };
  if (s.streak > streakSeen.streak) streakSeen = { seed: s.seed, streak: s.streak, tick: s.tick };
  if (stillFx()) return 1;
  const age = s.tick - streakSeen.tick;
  return age >= 0 && age < 14 ? 1 + 0.22 * Math.sin((age / 14) * Math.PI) : 1;
}

/* ================================= HUD ================================= */

/** The HUD's chip height and type (the Sports overhaul: bigger and legible, 13 px Archivo 800 on a 26 px chip). */
export const POOL_HUD_CHIP_H = 26;
const HUD_FONT = `800 13px ${FONT}`;

/** A chip's width for its label at the HUD's type. */
function chipW(ctx: CanvasRenderingContext2D, label: string): number {
  ctx.font = HUD_FONT;
  return Math.ceil(ctx.measureText(label).width) + 22;
}

function chip(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, label: string, tone: "plain" | "gold" | "red" = "plain"): void {
  const h = POOL_HUD_CHIP_H;
  ctx.fillStyle = tone === "red" ? "rgba(120,20,24,0.9)" : "rgba(12,9,6,0.86)";
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fill();
  ctx.strokeStyle = tone === "gold" ? "rgba(242,199,92,0.85)" : tone === "red" ? "rgba(255,120,120,0.65)" : "rgba(255,236,210,0.16)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = tone === "gold" ? "#F2C75C" : "#F3F1EC";
  ctx.font = HUD_FONT;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x + w / 2, y + h / 2 + 0.5);
}

/**
 * The black's rule on the table (the Sports overhaul; display only, from the sim's own counters): while fewer than
 * seven of the player's set are down the black is "not yet", dimmed with a small lock; once the seven are down it is
 * the next ball ("NOW THE BLACK" in the HUD, a thin gold ring on the ball). Never once the black is down.
 */
export type PoolBlackStatus = "locked" | "open" | "down" | "early";

export function poolBlackStatus(s: Pick<PoolState, "spotsDown" | "black">): PoolBlackStatus {
  if (s.black === 1) return "down";
  if (s.black === 2) return "early";
  return s.spotsDown >= POOL_SPOTS ? "open" : "locked";
}

/** The lock badge beside a dimmed black: a small padlock on a dark disc, up and right of the ball (inside 16 px). */
function drawBlackLock(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  const bx = x + POOL_BALL_DRAW_R * 0.85;
  const by = y - POOL_BALL_DRAW_R * 0.85;
  ctx.save();
  ctx.fillStyle = "rgba(12,9,6,0.9)";
  ctx.beginPath();
  ctx.arc(bx, by, 6.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(242,199,92,0.9)";
  ctx.lineWidth = 1;
  ctx.stroke();
  // The padlock: a shackle and a body.
  ctx.strokeStyle = "#F2C75C";
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.arc(bx, by - 0.8, 1.9, Math.PI, 0);
  ctx.stroke();
  ctx.fillStyle = "#F2C75C";
  ctx.fillRect(bx - 2.8, by - 0.8, 5.6, 4);
  ctx.restore();
}

/** The open black's thin gold ring (no glow): the next ball to pot. */
function drawBlackOpen(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.save();
  ctx.strokeStyle = "rgba(242,199,92,0.95)";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(x, y, POOL_BALL_DRAW_R + 2.2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/** The HUD rack's geometry: its label width, step and width (world px). */
function rackLayout(ctx: CanvasRenderingContext2D, s: PoolState): { lw: number; step: number; rackW: number } {
  const named = s.rev >= 4;
  ctx.font = HUD_FONT;
  const lw = named ? Math.ceil(ctx.measureText(poolSetName(s.set ?? POOL_SET_SPOTS).toUpperCase()).width) + 12 : 0;
  const step = 18;
  return { lw, step, rackW: 7 * step + 12 + lw };
}

/** Where ball `id` (1…7) sits in the HUD rack (world px): a flight's landing spot. */
export function poolRackSlot(ctx: CanvasRenderingContext2D, s: PoolState, id: number): { x: number; y: number } {
  const { lw, step } = rackLayout(ctx, s);
  return { x: 8 + lw + 6 + step / 2 + (id - 1) * step, y: 4 + POOL_HUD_CHIP_H / 2 };
}

function drawHud(ctx: CanvasRenderingContext2D, s: PoolState): void {
  const y = 4;
  const h = POOL_HUD_CHIP_H;
  // The rack: the player's seven, lit once potted. poolRev 4 names the set (SPOTS or STRIPES) inside the pill, in gold.
  const set = s.set ?? POOL_SET_SPOTS;
  const named = s.rev >= 4;
  const label = poolSetName(set).toUpperCase();
  const { lw, step, rackW } = rackLayout(ctx, s);
  ctx.font = HUD_FONT;
  ctx.fillStyle = "rgba(12,9,6,0.86)";
  roundRect(ctx, 8, y, rackW, h, h / 2);
  ctx.fill();
  ctx.strokeStyle = named ? "rgba(242,199,92,0.85)" : "rgba(255,236,210,0.16)";
  ctx.lineWidth = 1;
  ctx.stroke();
  if (named) {
    ctx.fillStyle = "#F2C75C";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(label, 8 + 11, y + h / 2 + 0.5);
  }
  for (let id = 1; id <= POOL_SPOTS; id++) {
    // Lit once the potted ball has flown up to its slot (stage 2); at once where nothing flies (reduced motion, the
    // desktop's upright HUD strip, poolRev 1).
    const ball = s.balls.find((b) => b.id === id);
    const down = ball?.down === 1 && (hudStrip || stillFx() || poolInRack(s, ball));
    ctx.globalAlpha = down ? 1 : 0.3;
    drawBall(ctx, poolShownId(id, set), 8 + lw + 6 + step / 2 + (id - 1) * step, y + h / 2, 7);
    ctx.globalAlpha = 1;
  }
  let x = 8 + rackW + 6;
  const room = (w: number) => x + w <= POOL_W - 8;
  const status = poolBlackStatus(s);
  if (status === "open") {
    const w = chipW(ctx, "NOW THE BLACK");
    if (room(w)) {
      chip(ctx, x, y, w, "NOW THE BLACK", "gold");
      x += w + 6;
    }
  }
  const pop = streakPop(s);
  if (s.streak >= 2) {
    const text = `${s.streak} IN A ROW`;
    const w = chipW(ctx, text);
    if (room(w)) {
      // The count swells as the run grows (stage 2), about the chip's own centre, beside the rack.
      ctx.save();
      if (pop !== 1) {
        ctx.translate(x + w / 2, y + h / 2);
        ctx.scale(pop, pop);
        ctx.translate(-(x + w / 2), -(y + h / 2));
      }
      chip(ctx, x, y, w, text, "gold");
      ctx.restore();
      x += w + 6;
    }
  }
  if (s.fouls > 0) {
    const text = `FOULS ${s.fouls}`;
    const w = chipW(ctx, text);
    if (room(w)) {
      chip(ctx, x, y, w, text, s.tick - s.foulTick < 60 ? "red" : "plain");
      x += w + 6;
    }
  }
  if (s.scratches > 0 && s.tick - s.scratchTick < 120) {
    const w = chipW(ctx, "−5 S");
    chip(ctx, POOL_W - 8 - w, y, w, "−5 S", "red");
  }
  void poolSecondsLeft;
}


/* ================================ Public ================================ */

/**
 * The desktop rotate mode (31 Oct 2026, display only): the table is drawn into a rotor turned a quarter turn
 * clockwise, so ball numbers are turned back by this (and the HUD chips drawn upright on their own strip,
 * drawPoolHud). 0 on every other screen.
 */
let numberTurn = 0;

/** The HUD chips alone, in world px, for the upright strip beside a turned table (ArcadeCanvasStage `hud`). */
export function drawPoolHud(ctx: CanvasRenderingContext2D, s: PoolState, look: GameLook = NO_LOOK): void {
  L = look;
  hudStrip = true;
  try {
    drawHud(ctx, s);
  } finally {
    L = NO_LOOK;
    hudStrip = false;
  }
}

/** True while the HUD is drawn on the turned table's upright strip (no flights land there: the rack lights at once). */
let hudStrip = false;

/**
 * The table, the balls, the aim preview (while aiming) and the HUD chips, in world px. `turned` (the desktop
 * rotate mode): ball numbers drawn turned back to read upright, and no HUD chips (drawn upright on their strip).
 */
export function drawPool(ctx: CanvasRenderingContext2D, s: PoolState, aim: PoolAim | null, turned = false, look: GameLook = NO_LOOK): void {
  L = look;
  try {
    drawPoolLooked(ctx, s, aim, turned);
  } finally {
    L = NO_LOOK;
    numberTurn = 0;
  }
}

function drawPoolLooked(ctx: CanvasRenderingContext2D, s: PoolState, aim: PoolAim | null, turned: boolean): void {
  numberTurn = turned ? -Math.PI / 2 : 0;
  ctx.fillStyle = POOL_BG;
  ctx.fillRect(0, 0, POOL_W, POOL_H);
  drawTable(ctx);
  // A pot lights its pocket briefly.
  if (s.potTick > 0 && s.tick - s.potTick < 24) {
    const a = 1 - (s.tick - s.potTick) / 24;
    for (const p of POOL_POCKETS) {
      const near = s.balls.some((b) => b.down && b.id !== POOL_CUE && Math.hypot(b.x - p.x, b.y - p.y) < p.r * 1.2);
      if (!near) continue;
      const g = ctx.createRadialGradient(px(p.x), px(p.y), 2, px(p.x), px(p.y), 30);
      g.addColorStop(0, `rgba(255,236,170,${0.55 * a})`);
      g.addColorStop(1, "rgba(255,236,170,0)");
      ctx.fillStyle = g;
      ctx.fillRect(px(p.x) - 30, px(p.y) - 30, 60, 60);
    }
  }
  drawDropping(ctx, s);
  const set = s.set ?? POOL_SET_SPOTS;
  const blackStatus = poolBlackStatus(s);
  for (const b of s.balls) {
    if (b.down || b.id === POOL_CUE) continue;
    // A ball off a pocket's jaw shivers for a moment (stage 2; drawn only, the sim's position is untouched).
    const sh = poolShiver(s, b.id);
    const bx = px(b.x) + sh.dx;
    const by = px(b.y) + sh.dy;
    // The black's rule on the table (the Sports overhaul): dimmed with a lock until the seven are down, then ringed.
    if (b.id === POOL_BLACK && blackStatus === "locked") {
      ctx.save();
      ctx.globalAlpha = POOL_BLACK_LOCKED_ALPHA;
      drawBall(ctx, poolShownId(b.id, set), bx, by);
      ctx.restore();
      drawBlackLock(ctx, bx, by);
      continue;
    }
    drawBall(ctx, poolShownId(b.id, set), bx, by);
    if (b.id === POOL_BLACK && blackStatus === "open") drawBlackOpen(ctx, bx, by);
  }
  const cue = s.balls.find((b) => b.id === POOL_CUE && !b.down);
  const aiming = aim && s.phase === 0 && !s.over;
  if (aiming) drawAim(ctx, s, aim);
  // The strike (stage 2): the cue's thrust through the ball and the chalk puff, under the moving cue ball.
  if (!aiming) drawStrike(ctx, s);
  if (cue) {
    const sh = poolShiver(s, POOL_CUE);
    drawFoulGlow(ctx, s, px(cue.x) + sh.dx, px(cue.y) + sh.dy);
    drawBall(ctx, POOL_CUE, px(cue.x) + sh.dx, px(cue.y) + sh.dy);
  }
  drawContactFlash(ctx, s);
  drawRattleMarks(ctx, s);
  drawFoul(ctx, s);
  if (aiming && cue) {
    const l = Math.hypot(aim.dx, aim.dy);
    if (l > 1e-6) {
      drawCueStick(ctx, px(cue.x), px(cue.y), aim.dx / l, aim.dy / l, aim.power);
      drawCaptainArm(ctx, px(cue.x), px(cue.y), aim.dx / l, aim.dy / l, aim.power);
    }
  }
  if (!turned) {
    drawHud(ctx, s);
    // Potted balls fly up into the rack (stage 2), over the HUD so they land in their slot.
    drawFlights(ctx, s);
  }
  // poolRev 4: the deal's set, shown big over the table until the first shot (never on the turned desktop table: its
  // HUD strip names the set upright).
  if (!turned && s.rev >= 4) drawSetBanner(ctx, s);
  numberTurn = 0;
  void POOL_BLACK;
}

/** poolRev 4's opening banner: YOU'RE STRIPES (or SPOTS) and your seven, until the first shot or 4 s, then a fade. */
export const POOL_SET_BANNER_TICKS = 240;
function drawSetBanner(ctx: CanvasRenderingContext2D, s: PoolState): void {
  if (s.shots > 0 && s.phase !== 0) return;
  const age = s.shots > 0 ? POOL_SET_BANNER_TICKS : s.tick;
  if (age >= POOL_SET_BANNER_TICKS) return;
  const a = age < 200 ? 1 : (POOL_SET_BANNER_TICKS - age) / 40;
  const set = s.set ?? POOL_SET_SPOTS;
  const cx = POOL_W / 2;
  const cy = 300;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = "rgba(8,10,14,0.86)";
  roundRect(ctx, cx - 132, cy - 44, 264, 88, 16);
  ctx.fill();
  ctx.strokeStyle = "rgba(242,199,92,0.85)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = "#F2C75C";
  ctx.font = `800 22px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`YOU’RE ${poolSetName(set).toUpperCase()}`, cx, cy - 18);
  for (let id = 1; id <= POOL_SPOTS; id++) drawBall(ctx, poolShownId(id, set), cx - 3 * 22 + (id - 1) * 22, cy + 18, 8);
  ctx.restore();
}

/** The room round the table on the play screen: the parlour's parquet floor (display only). */
export function poolScene(ctx: CanvasRenderingContext2D, view: ArenaSceneView): void {
  paintPoolScene(ctx, view, NO_LOOK);
}

/** The scene in a look (wave 2 skins): the live stage's, the player's own. */
export function poolSceneFor(look: GameLook): (ctx: CanvasRenderingContext2D, view: ArenaSceneView) => void {
  return look.world ? (ctx, view) => paintPoolScene(ctx, view, look) : poolScene;
}

function paintPoolScene(ctx: CanvasRenderingContext2D, view: ArenaSceneView, look: GameLook): void {
  const w = view.right - view.left;
  const h = view.bottom - view.top;
  if (look.world) {
    POOL_NEON_SCENE(ctx, view);
    return;
  }
  // The parlour floor (concept C): the same parquet as the world's own margins, in world px, so they meet with no seam.
  paintPoolParquet(ctx, view.left, view.top, view.left + w, view.top + h);
}

/* ============================== The power meter ============================== */

/** The meter's bands, soft to full: green, yellow, orange, red. */
const BANDS: readonly [number, number, number][] = [
  [63, 178, 90],
  [143, 201, 62],
  [233, 210, 58],
  [239, 165, 44],
  [232, 105, 42],
  [216, 50, 46],
];
/** The meter's segments. */
const SEGMENTS = 20;

/** The band colour at f (0 soft … 1 full), blended between the stops. */
function bandColour(f: number, alpha: number): string {
  const x = Math.max(0, Math.min(1, f)) * (BANDS.length - 1);
  const i = Math.min(BANDS.length - 2, Math.floor(x));
  const t = x - i;
  const a = BANDS[i]!;
  const b = BANDS[i + 1]!;
  const c = (k: number) => Math.round(a[k]! + (b[k]! - a[k]!) * t);
  return `rgba(${c(0)},${c(1)},${c(2)},${alpha})`;
}

/**
 * The power meter (CSS px, its own canvas), after the classic pool games' meter: a framed bar of segmented bands from
 * green (soft, on the right) through yellow and orange to red (full, on the left), tick marks above and below, and the
 * cue lying inside it. `pull` (0…1) draws the cue back to the left; every segment its tip has passed lights up.
 */
export function drawPoolPowerPanel(ctx: CanvasRenderingContext2D, w: number, h: number, pull: number, _spin?: unknown): void {
  ctx.clearRect(0, 0, w, h);
  const p = Math.max(0, Math.min(1, pull));
  // The frame (concept C, the Sports overhaul): a dark walnut body inside a brass rim.
  const rim = ctx.createLinearGradient(0, 0, 0, h);
  rim.addColorStop(0, "#E9C98A");
  rim.addColorStop(0.5, "#8E6427");
  rim.addColorStop(1, "#C99A4E");
  ctx.fillStyle = rim;
  roundRect(ctx, 0, 0, w, h, 14);
  ctx.fill();
  const bodyFill = ctx.createLinearGradient(0, 2, 0, h - 2);
  bodyFill.addColorStop(0, "#3A2010");
  bodyFill.addColorStop(1, "#1A0D05");
  ctx.fillStyle = bodyFill;
  roundRect(ctx, 2, 2, w - 4, h - 4, 12);
  ctx.fill();
  // The track.
  const left = 12;
  const right = w - 12;
  const trackW = Math.max(10, right - left);
  const top = Math.round(h * 0.27);
  const bh = Math.max(12, Math.round(h * 0.46));
  ctx.fillStyle = "#050507";
  roundRect(ctx, left - 2, top - 2, trackW + 4, bh + 4, 6);
  ctx.fill();
  // Segments: index 0 at the right (soft) to SEGMENTS − 1 at the left (full).
  const seg = trackW / SEGMENTS;
  const lit = Math.ceil(p * SEGMENTS - 1e-6);
  for (let k = 0; k < SEGMENTS; k++) {
    const x = right - (k + 1) * seg;
    const on = k < lit;
    ctx.fillStyle = bandColour(k / (SEGMENTS - 1), on ? 1 : 0.2);
    ctx.fillRect(x + 1, top, seg - 2, bh);
    if (on) {
      ctx.fillStyle = "rgba(255,255,255,0.22)";
      ctx.fillRect(x + 1, top, seg - 2, bh * 0.4);
    }
  }
  // Glass over the track.
  const glass = ctx.createLinearGradient(0, top, 0, top + bh);
  glass.addColorStop(0, "rgba(255,255,255,0.10)");
  glass.addColorStop(0.5, "rgba(255,255,255,0)");
  glass.addColorStop(1, "rgba(0,0,0,0.25)");
  ctx.fillStyle = glass;
  ctx.fillRect(left, top, trackW, bh);
  // Tick marks above and below: one a segment, longer every fifth.
  ctx.strokeStyle = "rgba(243,241,236,0.45)";
  ctx.lineWidth = 1;
  for (let k = 0; k <= SEGMENTS; k++) {
    const x = Math.round(right - k * seg) + 0.5;
    const len = k % 5 === 0 ? 6 : 3;
    ctx.beginPath();
    ctx.moveTo(x, top - 4 - len);
    ctx.lineTo(x, top - 4);
    ctx.moveTo(x, top + bh + 4);
    ctx.lineTo(x, top + bh + 4 + len);
    ctx.stroke();
  }
  // The cue inside the track: tip at the right end drawn back by the pull, the shaft running off the left.
  ctx.save();
  ctx.beginPath();
  ctx.rect(left, top, trackW, bh);
  ctx.clip();
  const cy = top + bh / 2;
  const tip = right - 2 - p * (trackW - 8);
  const len = Math.max(w, 260);
  const half = (x: number) => 2.2 + ((tip - x) / len) * 3.4;
  const body = (x0: number, x1: number, fill: string | CanvasGradient) => {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(x0, cy - half(x0));
    ctx.lineTo(x1, cy - half(x1));
    ctx.lineTo(x1, cy + half(x1));
    ctx.lineTo(x0, cy + half(x0));
    ctx.closePath();
    ctx.fill();
  };
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(tip - len, cy + 2, len, 4);
  const maple = ctx.createLinearGradient(0, cy - 4, 0, cy + 4);
  maple.addColorStop(0, "#F7EBD2");
  maple.addColorStop(0.5, "#E6D1A8");
  maple.addColorStop(1, "#B39B70");
  body(tip - 4, tip - len * 0.5, maple);
  body(tip - len * 0.5, tip - len * 0.5 - 3, "#E3B341");
  const butt = ctx.createLinearGradient(0, cy - 5, 0, cy + 5);
  butt.addColorStop(0, "#5A2E16");
  butt.addColorStop(1, "#1A0C06");
  body(tip - len * 0.5 - 3, tip - len, butt);
  body(tip - 1.4, tip - 4, "#F8F8F6");
  body(tip, tip - 1.4, "#2E6FD8");
  ctx.strokeStyle = "rgba(255,255,255,0.45)";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(tip - 6, cy - 1);
  ctx.lineTo(tip - len * 0.48, cy - 2.6);
  ctx.stroke();
  ctx.restore();
}
