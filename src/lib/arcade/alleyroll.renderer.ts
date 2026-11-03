/**
 * Ringer's art and projection (display only; the sim is alleyroll.ts). The world is 414 × 800, a funfair roll-ball
 * alley seen from the player's end: a striped awning and a row of warm bulbs across the top, the board's raised cups
 * under them (a flat 10 ring round a tower of 20, 30, 40 and 50, the two 100 pockets in the top corners and, from
 * alleyRollRev 2, the gold cup gliding along its track at the top), the ramp's lip, then the polished wooden lane in
 * perspective between gold-trimmed rails down to the release line, where the waiting ball sits; the balls still to roll
 * are a row of dots at the bottom with the roll streak beside them.
 *
 * Two projections, one for the lane (perspective toward the ramp) and one for the board (tilted toward the player, its
 * heights lifted on screen by Z_SCALE); every cup, pocket, rail and the ball are drawn at the sim's own sizes and
 * heights through them, so what is drawn is what catches (the gold cup's rim is its catch radius plus the ball's: it
 * takes a ball that drops inside whole). Rev 1's rounds draw their own board (concentric flat rings, its pockets) in
 * the same alley. There is no aiming arrow.
 */
import type { ArcadeGame, ArcadeInputEvent, CanvasSize } from "./engine";
import { arcadeFx, type ArcadeFxSpec } from "./arcadeFx.renderer";
import type { ArenaSceneView } from "./arenaScene.renderer";
import { fillAbove, fillBelow, fillGradient, fillSides } from "./arenaFills.renderer";
import {
  ALLEYROLL_REV_RINGER, AR2_CORE_FULL, AR2_CUPS, AR2_GOLD_H, AR2_GOLD_POINTS, AR2_GOLD_RIM, AR2_GOLD_Y, AR2_POCKETS, AR2_POCKET_R, AR2_STREAK_AT,
  AR_BALLS, AR_BALL_R, AR_BOARD_D, AR_BOARD_HALF, AR_CORE_FULL, AR_FLY, AR_LANE_HALF, AR_POCKETS, AR_POCKET_POINTS, AR_POCKET_R, AR_RAMP_Y, AR_RINGS,
  AR_RING_CX, AR_RING_CY, AR_ROLL, AR_SHOW, AR_SHOW_TICKS, AR_STREAK_AT, AR_WAIT, alleyRollGameFor, arGoldX256, arInitV2, arScored, type ArCup, type ArState,
} from "./alleyroll";
import { AR_NEAR_SCALE, AR_SWIPE_CX, AR_SWIPE_WORLD_W } from "./alleyrollSwipe";

export const AR_WORLD_W = AR_SWIPE_WORLD_W;
export const AR_WORLD_H = 800;
export const AR_BG = "#22090E";
const CX = AR_SWIPE_CX;
const FONT = "'Archivo', system-ui, sans-serif";

/* Palette: a warm funfair evening. */
const MAROON = "#3A121A";
const MAROON_DEEP = "#22090E";
const PANEL = "#5C1B27";
const PANEL_DEEP = "#43131D";
const CREAM = "#F4E6C6";
const CREAM_SHADE = "#CDB68A";
const CREAM_DARK = "#9C855C";
const CUP_HOLE = "#2C0D12";
const GOLD = "#F6C445";
const GOLD_DEEP = "#B98316";
const AWNING_RED = "#E2563B";
const AWNING_CREAM = "#F5EEDF";
const BALL_BLUE = "#3E73E0";

/* The lane's projection: lane y 0 (the release line) at screen y LANE_NEAR, the ramp at LANE_FAR. */
export const AR_LANE_NEAR = 712;
export const AR_LANE_FAR = 430;
const NEAR_SCALE = AR_NEAR_SCALE;
const DEPTH_K = AR_RAMP_Y / (NEAR_SCALE - 1); // the ramp's scale is 1.0 px a unit
const sOf = (y: number) => 1 / (1 + y / DEPTH_K);
const S_FAR = sOf(AR_RAMP_Y);

export function arLaneScreen(x: number, y: number): { x: number; y: number; k: number } {
  const s = sOf(y);
  const t = (1 - s) / (1 - S_FAR);
  return { x: CX + x * NEAR_SCALE * s, y: AR_LANE_NEAR - (AR_LANE_NEAR - AR_LANE_FAR) * t, k: NEAR_SCALE * s };
}

/* The board's projection: board y 0 (the ramp's lip) at BOARD_NEAR, tilted toward the player (YK screen px a board
   px deep), heights lifted by Z_SCALE screen px a board px. */
export const AR_BOARD_NEAR = 412;
const BOARD_YK = 0.6;
const Z_SCALE = 5;
export const AR_BOARD_FAR = AR_BOARD_NEAR - AR_BOARD_D * BOARD_YK;
const boardK = (y: number) => 1.08 - (0.2 * y) / AR_BOARD_D;

export function arBoardScreen(x: number, y: number, z = 0): { x: number; y: number; k: number } {
  const k = boardK(y);
  return { x: CX + x * k, y: AR_BOARD_NEAR - y * BOARD_YK - z * Z_SCALE, k };
}

/** The lane x a screen x on the release line stands for (the stage's slide). */
export function arReleaseFromScreen(x: number): number {
  return (x - CX) / NEAR_SCALE;
}

export interface ArView {
  /** The waiting ball's release point (lane units), set where the swipe starts. */
  release: number;
}

export function arNewView(): ArView {
  return { release: 0 };
}

/** A board's targets as the renderer draws them: rev 2's raised cups, or rev 1's concentric flat rings. */
interface ArBoardLook {
  cups: readonly ArCup[];
  pockets: readonly { x: number; y: number }[];
  pocketR: number;
  gold: boolean;
}

const REV1_LOOK: ArBoardLook = {
  cups: [...AR_RINGS].map((r) => ({ points: r.points, cx: AR_RING_CX, cy: AR_RING_CY, r: r.r, h: 0 })),
  pockets: AR_POCKETS,
  pocketR: AR_POCKET_R,
  gold: false,
};
const RINGER_LOOK: ArBoardLook = { cups: AR2_CUPS, pockets: AR2_POCKETS, pocketR: AR2_POCKET_R, gold: true };
const lookOf = (s: Pick<ArState, "rev">) => (s.rev >= ALLEYROLL_REV_RINGER ? RINGER_LOOK : REV1_LOOK);

function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number): void {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.5, rx), Math.max(0.5, ry), 0, 0, Math.PI * 2);
}

/** Where a ball came down (its points decide the height it rests at). */
function restPoint(s: ArState, b: { x: number; y: number; points: number }): { x: number; y: number; k: number } {
  const look = lookOf(s);
  const h = b.points === AR2_GOLD_POINTS ? AR2_GOLD_H : look.cups.find((c) => c.points === b.points)?.h ?? 0;
  return arBoardScreen(b.x, b.y, h);
}

/** The shared success layer: each ball's points where it came down, pockets and gold cups, the core filled. */
export const ALLEYROLL_FX: ArcadeFxSpec<ArState> = {
  game: "alleyroll",
  world: "fairground",
  width: AR_WORLD_W,
  height: AR_WORLD_H,
  shake: false,
  events: [
    {
      kind: "pop",
      count: (s) => arScored(s).filter((b) => b.points > 0).length,
      at: (s) => {
        const b = arScored(s).at(-1);
        return b ? restPoint(s, b) : null;
      },
      label: (s) => {
        const b = arScored(s).at(-1);
        return b ? (b.points >= AR_POCKET_POINTS ? `${b.points}!` : `+${b.points}`) : null;
      },
    },
    {
      kind: "streak",
      count: (s) => arScored(s).filter((b) => b.points >= AR_POCKET_POINTS).length,
      label: (s) => (arScored(s).at(-1)?.points === AR2_GOLD_POINTS ? "GOLD CUP!" : "POCKET!"),
      neon: true,
    },
    {
      kind: "final",
      count: (s) => (arScored(s).reduce((t, b) => t + b.points, 0) >= (s.rev >= ALLEYROLL_REV_RINGER ? AR2_CORE_FULL : AR_CORE_FULL) ? 1 : 0),
      label: () => "FULL POINTS!",
    },
  ],
  misses: [{ count: (s) => arScored(s).filter((b) => b.points === 0).length, at: (s) => { const b = arScored(s).at(-1); return b ? arBoardScreen(b.x, b.y) : null; } }],
};

export function drawAlleyRoll(ctx: CanvasRenderingContext2D, state: ArState, size: CanvasSize, view?: ArView): void {
  arcadeFx(ctx, ALLEYROLL_FX, state, () => drawAlleyRollWorld(ctx, state, size, view), size);
}

/* ================================ The alley ================================ */

/** The striped awning (scalloped), the fascia and the row of warm bulbs. */
function drawAwning(ctx: CanvasRenderingContext2D, tick: number): void {
  const stripes = 10;
  const w = AR_WORLD_W / stripes;
  const top = 0;
  const bottom = 56;
  ctx.fillStyle = MAROON_DEEP;
  ctx.fillRect(0, 0, AR_WORLD_W, 100);
  for (let i = 0; i < stripes; i++) {
    const x = i * w;
    const g = ctx.createLinearGradient(0, top, 0, bottom);
    const base = i % 2 === 0 ? AWNING_RED : AWNING_CREAM;
    g.addColorStop(0, i % 2 === 0 ? "#B83A26" : "#D9CFBA");
    g.addColorStop(0.35, base);
    g.addColorStop(1, base);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x + w, top);
    ctx.lineTo(x + w, bottom - 8);
    ctx.quadraticCurveTo(x + w / 2, bottom + 8, x, bottom - 8);
    ctx.closePath();
    ctx.fill();
  }
  // A soft shadow under the scallops.
  const sh = ctx.createLinearGradient(0, bottom - 4, 0, bottom + 18);
  sh.addColorStop(0, "rgba(0,0,0,0.35)");
  sh.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = sh;
  ctx.fillRect(0, bottom - 4, AR_WORLD_W, 22);
  // The bulb row: warm bulbs on a dark rail, a slow chase of brighter ones.
  ctx.fillStyle = "#170609";
  ctx.fillRect(0, 70, AR_WORLD_W, 22);
  const bulbs = 13;
  for (let i = 0; i < bulbs; i++) {
    const x = (i + 0.5) * (AR_WORLD_W / bulbs);
    const lit = (i + Math.floor(tick / 15)) % 3 === 0;
    const glow = ctx.createRadialGradient(x, 81, 1, x, 81, lit ? 16 : 11);
    glow.addColorStop(0, lit ? "rgba(255,226,140,0.75)" : "rgba(255,200,110,0.45)");
    glow.addColorStop(1, "rgba(255,200,110,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(x - 18, 63, 36, 36);
    ellipse(ctx, x, 81, 5, 5);
    ctx.fillStyle = lit ? "#FFF2C4" : "#F7CF7A";
    ctx.fill();
    ctx.strokeStyle = "#8A5A1E";
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

/** The side walls: dark panels with tan slats, converging on the board. */
function drawWalls(ctx: CanvasRenderingContext2D): void {
  const g = ctx.createLinearGradient(0, 92, 0, AR_WORLD_H);
  g.addColorStop(0, "#2E0E15");
  g.addColorStop(1, "#3E151D");
  ctx.fillStyle = g;
  ctx.fillRect(0, 92, AR_WORLD_W, AR_WORLD_H - 92);
  // Slats on each wall, lower ones larger (nearer).
  for (const side of [-1, 1]) {
    for (let i = 0; i < 9; i++) {
      const t = i / 8;
      const y = 300 + t * 420;
      const h = 12 + t * 10;
      const inner = arLaneScreen(side * (AR_LANE_HALF + 18), Math.max(0, AR_RAMP_Y * (1 - t * 1.05))).x;
      const x0 = side < 0 ? 6 : inner + 4;
      const x1 = side < 0 ? inner - 4 : AR_WORLD_W - 6;
      if (x1 - x0 < 8) continue;
      ctx.fillStyle = "#8C5E31";
      ctx.globalAlpha = 0.55 + 0.35 * t;
      ctx.beginPath();
      const slant = side < 0 ? -8 : 8;
      ctx.moveTo(x0, y + (side < 0 ? 0 : slant));
      ctx.lineTo(x1, y + (side < 0 ? slant : 0));
      ctx.lineTo(x1, y + h + (side < 0 ? slant : 0));
      ctx.lineTo(x0, y + h + (side < 0 ? 0 : slant));
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

/* ================================ The board ================================ */

/**
 * A raised cup: its wall from the tier it stands in (`floor`, the next lower cup's rim height) up to its own rim, the
 * rim, and the dark opening (or a flat ring at height 0).
 */
function drawCup(ctx: CanvasRenderingContext2D, cup: ArCup, floor: number, lit: boolean, label: boolean): void {
  const top = arBoardScreen(cup.cx, cup.cy, cup.h);
  const base = arBoardScreen(cup.cx, cup.cy, floor);
  const rx = cup.r * top.k;
  const ry = cup.r * BOARD_YK;
  if (cup.h > 0) {
    // The wall's front: the lower half-ellipse at the base joined to the rim's.
    const wall = ctx.createLinearGradient(base.x - rx, 0, base.x + rx, 0);
    wall.addColorStop(0, CREAM_DARK);
    wall.addColorStop(0.45, CREAM);
    wall.addColorStop(1, CREAM_SHADE);
    ctx.fillStyle = wall;
    ctx.beginPath();
    ctx.ellipse(base.x, base.y, rx, ry, 0, 0, Math.PI);
    ctx.lineTo(top.x - rx, top.y);
    ctx.ellipse(top.x, top.y, rx, ry, 0, Math.PI, 0, true);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(80,40,20,0.35)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  // The opening.
  ellipse(ctx, top.x, top.y, rx, ry);
  const hole = ctx.createRadialGradient(top.x, top.y - ry * 0.4, 1, top.x, top.y, Math.max(rx, 1));
  hole.addColorStop(0, cup.h > 0 ? "#4A1A1F" : "#5A1F28");
  hole.addColorStop(1, CUP_HOLE);
  ctx.fillStyle = cup.h > 0 ? hole : "rgba(30,8,12,0.55)";
  ctx.fill();
  // The rim (lit while the ball that fell in shows).
  ctx.strokeStyle = lit ? "#FFF6DA" : CREAM;
  ctx.lineWidth = Math.max(2, 4.5 * top.k);
  if (lit) {
    ctx.shadowColor = "#FFE08A";
    ctx.shadowBlur = 16;
  }
  ellipse(ctx, top.x, top.y, rx, ry);
  ctx.stroke();
  ctx.shadowBlur = 0;
  if (label) drawCupLabel(ctx, cup);
}

/** A cup's number, just right of its rim's front, outlined so it reads over the tiers. */
function drawCupLabel(ctx: CanvasRenderingContext2D, cup: ArCup): void {
  const top = arBoardScreen(cup.cx, cup.cy, cup.h);
  const rx = cup.r * top.k;
  const ry = cup.r * BOARD_YK;
  ctx.font = `800 ${cup.points >= 50 ? 13 : 12}px ${FONT}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const x = top.x + rx * 0.82 + 6;
  const y = top.y + ry * 0.62;
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(40,8,14,0.9)";
  ctx.strokeText(String(cup.points), x, y);
  ctx.fillStyle = CREAM;
  ctx.fillText(String(cup.points), x, y);
}

function drawPocket(ctx: CanvasRenderingContext2D, p: { x: number; y: number }, r: number, lit: boolean): void {
  const q = arBoardScreen(p.x, p.y);
  const rx = r * q.k;
  const ry = r * BOARD_YK;
  // A raised cream ring sunk into the corner.
  ellipse(ctx, q.x, q.y + 2, rx + 5, ry + 4);
  ctx.fillStyle = CREAM_DARK;
  ctx.fill();
  ellipse(ctx, q.x, q.y, rx + 5, ry + 4);
  ctx.fillStyle = CREAM;
  ctx.fill();
  ellipse(ctx, q.x, q.y, rx, ry);
  ctx.fillStyle = CUP_HOLE;
  ctx.fill();
  if (lit) {
    ctx.strokeStyle = "#FFF6DA";
    ctx.lineWidth = 3;
    ctx.shadowColor = "#FFE08A";
    ctx.shadowBlur = 18;
    ellipse(ctx, q.x, q.y, rx + 3, ry + 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
  ctx.fillStyle = CREAM;
  ctx.font = `800 12px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("100", q.x, q.y + ry + 14);
}

/** The gold cup at its place on the round clock, its track and its label. */
function drawGold(ctx: CanvasRenderingContext2D, state: ArState, lit: boolean): void {
  const amp = state.ga ?? 0;
  const a = arBoardScreen(-amp, AR2_GOLD_Y, AR2_GOLD_H);
  const b = arBoardScreen(amp, AR2_GOLD_Y, AR2_GOLD_H);
  ctx.strokeStyle = "rgba(246,196,69,0.75)";
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.moveTo(a.x - 18, a.y);
  ctx.lineTo(b.x + 18, b.y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = GOLD;
  ctx.font = `800 11px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("GOLD CUP 150 · MOVING", CX, a.y - 34);

  const x = arGoldX256(state, state.tick) / 256;
  const top = arBoardScreen(x, AR2_GOLD_Y, AR2_GOLD_H);
  const base = arBoardScreen(x, AR2_GOLD_Y, 0);
  const rx = AR2_GOLD_RIM * top.k;
  const ry = AR2_GOLD_RIM * BOARD_YK;
  // A halo, then the cup: a gold wall up to its rim, the opening.
  const halo = ctx.createRadialGradient(top.x, top.y, 2, top.x, top.y, rx * 2.4);
  halo.addColorStop(0, lit ? "rgba(255,226,120,0.6)" : "rgba(255,210,90,0.32)");
  halo.addColorStop(1, "rgba(255,210,90,0)");
  ctx.fillStyle = halo;
  ctx.fillRect(top.x - rx * 2.5, top.y - rx * 2.5, rx * 5, rx * 5);
  const wall = ctx.createLinearGradient(base.x - rx, 0, base.x + rx, 0);
  wall.addColorStop(0, GOLD_DEEP);
  wall.addColorStop(0.45, "#FFE38A");
  wall.addColorStop(1, "#D9A12A");
  ctx.fillStyle = wall;
  ctx.beginPath();
  ctx.ellipse(base.x, base.y, rx, ry, 0, 0, Math.PI);
  ctx.lineTo(top.x - rx, top.y);
  ctx.ellipse(top.x, top.y, rx, ry, 0, Math.PI, 0, true);
  ctx.closePath();
  ctx.fill();
  ellipse(ctx, top.x, top.y, rx, ry);
  ctx.fillStyle = "#5A3A08";
  ctx.fill();
  ctx.strokeStyle = lit ? "#FFF8D8" : GOLD;
  ctx.lineWidth = 3;
  ctx.stroke();
}

function drawBoard(ctx: CanvasRenderingContext2D, state: ArState): void {
  const look = lookOf(state);
  // The backboard above the board's far edge and the board itself, a tilted panel with a gold trim.
  const tl = arBoardScreen(-AR_BOARD_HALF, AR_BOARD_D);
  const tr = arBoardScreen(AR_BOARD_HALF, AR_BOARD_D);
  const br = arBoardScreen(AR_BOARD_HALF, 0);
  const bl = arBoardScreen(-AR_BOARD_HALF, 0);
  const back = ctx.createLinearGradient(0, tl.y - 110, 0, tl.y);
  back.addColorStop(0, PANEL_DEEP);
  back.addColorStop(1, PANEL);
  ctx.fillStyle = back;
  ctx.fillRect(tl.x, tl.y - 110, tr.x - tl.x, 110);
  ctx.strokeStyle = "rgba(246,196,69,0.35)";
  ctx.lineWidth = 2;
  ctx.strokeRect(tl.x, tl.y - 110, tr.x - tl.x, 110);
  const g = ctx.createLinearGradient(0, tl.y, 0, bl.y);
  g.addColorStop(0, "#6A2230");
  g.addColorStop(1, "#7E2B38");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(tl.x, tl.y);
  ctx.lineTo(tr.x, tr.y);
  ctx.lineTo(br.x, br.y);
  ctx.lineTo(bl.x, bl.y);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = GOLD_DEEP;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Which target the last ball fell in stays lit while it shows.
  const last = arScored(state).at(-1);
  const lit = state.phase === AR_SHOW || (state.phase === AR_WAIT && state.balls.length > 0) ? last?.points ?? -1 : -1;
  const pulse = state.phase === AR_SHOW && Math.floor(((state.tick - state.phaseTick) / AR_SHOW_TICKS) * 6) % 2 === 0;

  // Gold first (it is at the back), then the pockets, then the stack from the flat ring up.
  if (look.gold) drawGold(ctx, state, lit === AR2_GOLD_POINTS && pulse);
  for (const p of look.pockets) drawPocket(ctx, p, look.pocketR, lit === AR_POCKET_POINTS && pulse && !!last && Math.sign(last.x) === Math.sign(p.x));
  const stack = [...look.cups].sort((p, q) => p.h - q.h || q.r - p.r);
  stack.forEach((cup, i) => drawCup(ctx, cup, i > 0 ? Math.min(cup.h, stack[i - 1]!.h) : 0, lit === cup.points && pulse, false));
  for (const cup of stack) drawCupLabel(ctx, cup);
}

/* ================================ The lane ================================ */

function drawLane(ctx: CanvasRenderingContext2D): void {
  const fl = arLaneScreen(-AR_LANE_HALF, AR_RAMP_Y);
  const fr = arLaneScreen(AR_LANE_HALF, AR_RAMP_Y);
  const nl = arLaneScreen(-AR_LANE_HALF, -50);
  const nr = arLaneScreen(AR_LANE_HALF, -50);
  // Polished planks running up the lane, lit warmly from the board end.
  const g = ctx.createLinearGradient(0, fl.y, 0, nl.y);
  g.addColorStop(0, "#9D5B26");
  g.addColorStop(0.5, "#C27A3A");
  g.addColorStop(1, "#B36C30");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(fl.x, fl.y);
  ctx.lineTo(fr.x, fr.y);
  ctx.lineTo(nr.x, nr.y);
  ctx.lineTo(nl.x, nl.y);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(92,44,14,0.35)";
  ctx.lineWidth = 1;
  for (let k = 1; k < 9; k++) {
    const x = -AR_LANE_HALF + (k * 2 * AR_LANE_HALF) / 9;
    const a = arLaneScreen(x, AR_RAMP_Y);
    const b = arLaneScreen(x, -50);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  // A sheen down the middle of the polish.
  const sheen = ctx.createLinearGradient(nl.x, 0, nr.x, 0);
  sheen.addColorStop(0, "rgba(255,230,190,0)");
  sheen.addColorStop(0.5, "rgba(255,230,190,0.16)");
  sheen.addColorStop(1, "rgba(255,230,190,0)");
  ctx.fillStyle = sheen;
  ctx.beginPath();
  ctx.moveTo(fl.x, fl.y);
  ctx.lineTo(fr.x, fr.y);
  ctx.lineTo(nr.x, nr.y);
  ctx.lineTo(nl.x, nl.y);
  ctx.closePath();
  ctx.fill();
  // The rails: dark wood with a gold trim at the sim's walls.
  for (const side of [-1, 1]) {
    const a = arLaneScreen(side * AR_LANE_HALF, AR_RAMP_Y);
    const b = arLaneScreen(side * AR_LANE_HALF, -50);
    ctx.fillStyle = "#2A0D12";
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(a.x + side * 10, a.y);
    ctx.lineTo(b.x + side * 16, b.y);
    ctx.lineTo(b.x, b.y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  // The ramp: a short lighter lip at the lane's far end, up to the board.
  const lipL = arBoardScreen(-AR_LANE_HALF, 0);
  const lipR = arBoardScreen(AR_LANE_HALF, 0);
  const ramp = ctx.createLinearGradient(0, lipL.y, 0, fl.y);
  ramp.addColorStop(0, "#E8C890");
  ramp.addColorStop(1, "#C9A266");
  ctx.fillStyle = ramp;
  ctx.beginPath();
  ctx.moveTo(fl.x, fl.y);
  ctx.lineTo(fr.x, fr.y);
  ctx.lineTo(lipR.x, lipR.y);
  ctx.lineTo(lipL.x, lipL.y);
  ctx.closePath();
  ctx.fill();
}

function drawBall(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, shadow: { x: number; y: number } | null): void {
  if (shadow) {
    ellipse(ctx, shadow.x, shadow.y, r * 1.05, r * 0.42);
    ctx.fillStyle = "rgba(20,4,6,0.38)";
    ctx.fill();
  }
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  g.addColorStop(0, "#B9D0FF");
  g.addColorStop(0.35, BALL_BLUE);
  g.addColorStop(1, "#1C3A8A");
  ctx.fillStyle = g;
  ellipse(ctx, x, y, r, r);
  ctx.fill();
  ellipse(ctx, x - r * 0.38, y - r * 0.42, r * 0.22, r * 0.16);
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.fill();
}

/** The roll streak as it stands: balls in a row scoring 30 or more (40 on rev 1). */
function currentStreak(state: ArState): number {
  const at = state.rev >= ALLEYROLL_REV_RINGER ? AR2_STREAK_AT : AR_STREAK_AT;
  const done = arScored(state);
  let n = 0;
  for (let i = done.length - 1; i >= 0 && done[i]!.points >= at; i--) n++;
  return n;
}

/** The bottom strip: balls left as dots (blue still to roll), and the roll streak's chip. */
function drawHud(ctx: CanvasRenderingContext2D, state: ArState): void {
  const y = AR_WORLD_H - 26;
  ctx.fillStyle = "rgba(14,3,6,0.72)";
  ctx.fillRect(0, y - 20, AR_WORLD_W, 46);
  const rolled = state.balls.length;
  for (let i = 0; i < AR_BALLS; i++) {
    ellipse(ctx, 24 + i * 19, y, 6.5, 6.5);
    ctx.fillStyle = i < rolled ? "#5A4048" : BALL_BLUE;
    ctx.fill();
  }
  const streak = currentStreak(state);
  const text = `Roll streak ×${streak}`;
  ctx.font = `700 13px ${FONT}`;
  const w = ctx.measureText(text).width + 24;
  const x0 = AR_WORLD_W - 12 - w;
  ctx.beginPath();
  ctx.roundRect(x0, y - 13, w, 26, 13);
  ctx.fillStyle = "rgba(40,10,16,0.9)";
  ctx.fill();
  ctx.strokeStyle = streak >= 2 ? GOLD : "rgba(246,196,69,0.45)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = streak >= 2 ? GOLD : "rgba(246,214,140,0.75)";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x0 + w / 2, y + 1);
}

function drawAlleyRollWorld(ctx: CanvasRenderingContext2D, state: ArState, size: CanvasSize, view?: ArView): void {
  ctx.save();
  ctx.scale(size.width / AR_WORLD_W, size.height / AR_WORLD_H);
  ctx.fillStyle = MAROON;
  ctx.fillRect(0, 0, AR_WORLD_W, AR_WORLD_H);
  drawWalls(ctx);
  // A warm glow over the board from the bulbs.
  const glow = ctx.createRadialGradient(CX, 260, 30, CX, 260, 280);
  glow.addColorStop(0, "rgba(255,190,110,0.18)");
  glow.addColorStop(1, "rgba(255,190,110,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 92, AR_WORLD_W, 400);
  drawBoard(ctx, state);
  drawLane(ctx);
  drawAwning(ctx, state.tick);

  // The ball: rolling on the lane, flying over the board, resting where it fell, or waiting at the release line.
  const px = state.x / 256;
  const py = state.y / 256;
  if (state.phase === AR_ROLL) {
    const p = arLaneScreen(px, py);
    drawBall(ctx, p.x, p.y - AR_BALL_R * p.k, AR_BALL_R * p.k, { x: p.x, y: p.y });
  } else if (state.phase === AR_FLY) {
    const ground = arBoardScreen(px, py);
    const air = arBoardScreen(px, py, state.z / 256);
    drawBall(ctx, air.x, air.y - AR_BALL_R * air.k, AR_BALL_R * air.k, { x: ground.x, y: ground.y });
  } else if (state.phase === AR_SHOW) {
    const last = state.balls.at(-1);
    if (last && state.tick - state.phaseTick < 12) {
      const p = restPoint(state, last);
      const k = 1 - (state.tick - state.phaseTick) / 12;
      drawBall(ctx, p.x, p.y - AR_BALL_R * p.k * 0.4 * k, AR_BALL_R * p.k * (0.4 + 0.6 * k), null);
    }
  } else if (state.ended === 0 && state.balls.length < AR_BALLS) {
    const p = arLaneScreen(view?.release ?? 0, 0);
    drawBall(ctx, p.x, p.y - AR_BALL_R * p.k, AR_BALL_R * p.k, { x: p.x, y: p.y });
  }
  drawHud(ctx, state);
  ctx.restore();
}

/** The alley carried out to the screen's edges (display only, painted once per size). */
export function alleyRollScene(ctx: CanvasRenderingContext2D, view: ArenaSceneView): void {
  const above = fillAbove(view);
  if (above) fillGradient(ctx, above, above.y, above.y + above.h, [[0, "#14050A"], [1, MAROON_DEEP]]);
  for (const side of fillSides(view)) {
    fillGradient(ctx, side, side.y, side.y + side.h, [[0, MAROON_DEEP], [0.12, "#2E0E15"], [1, "#3E151D"]]);
    // The awning's fascia runs on beside it, a shade darker.
    const top = Math.max(side.y, 0);
    const bottom = Math.min(side.y + side.h, 92);
    if (bottom > top) fillGradient(ctx, { x: side.x, y: top, w: side.w, h: bottom - top }, 0, 92, [[0, "#7A2A20"], [1, "#2A0B10"]]);
  }
  const below = fillBelow(view);
  if (below) fillGradient(ctx, below, below.y, below.y + below.h, [[0, "#1A060B"], [1, "#0E0306"]]);
}

export function alleyRollArtGame(view?: ArView, rev: number = ALLEYROLL_REV_RINGER): ArcadeGame<ArState, ArcadeInputEvent | null> {
  return { ...alleyRollGameFor(rev), draw: (ctx, state, size) => drawAlleyRoll(ctx, state, size, view) };
}

export const alleyRollArt = alleyRollArtGame();

/** The intro still's and the tile's state: a Ringer board at tick `tick` (the gold cup's path from seed 1). */
export function ringerStill(tick: number): ArState {
  return { ...arInitV2(1), tick, acted: 1 };
}
