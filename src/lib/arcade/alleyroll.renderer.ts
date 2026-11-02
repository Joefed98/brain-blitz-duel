/**
 * Alley Roll's art and projection (display only; the sim is alleyroll.ts). The world is 414 × 800, seen from the
 * player's end of a warm arcade alley: a scoreboard of lit digits at the top, the tilted target board with its lit
 * rings and the two 100 pockets, the ramp's lip, then the wooden lane in perspective down to the release strip at the
 * bottom, where the waiting ball sits. Two projections, one for the lane (perspective toward the ramp) and one for the
 * board (tilted toward the player, so its rings read large); the rings, pockets, rails and ball are drawn at the sim's
 * own sizes through them. A ball in the air is drawn lifted above its shadow. While a swipe is drawn the stage passes
 * a short preview arrow (`ArView.aim`).
 */
import type { ArcadeGame, ArcadeInputEvent, CanvasSize } from "./engine";
import { arcadeFx, type ArcadeFxSpec } from "./arcadeFx.renderer";
import type { ArenaSceneView } from "./arenaScene.renderer";
import { fillAbove, fillBelow, fillGradient, fillSides } from "./arenaFills.renderer";
import {
  AR_BALLS, AR_BALL_R, AR_BOARD_D, AR_BOARD_HALF, AR_CORE_FULL, AR_FLY, AR_LANE_HALF, AR_POCKETS, AR_POCKET_POINTS, AR_POCKET_R, AR_RAMP_Y, AR_RINGS,
  AR_RING_CX, AR_RING_CY, AR_ROLL, AR_SHOW, AR_SHOW_TICKS, AR_WAIT, alleyRollGame, arScored, arTotals, type ArState,
} from "./alleyroll";

export const AR_WORLD_W = 414;
export const AR_WORLD_H = 800;
export const AR_BG = "#1A0F08";
const CX = AR_WORLD_W / 2;
const FONT = "'Archivo', system-ui, sans-serif";

/* The lane's projection: lane y 0 (the release line) at screen y LANE_NEAR, the ramp at LANE_FAR. */
export const AR_LANE_NEAR = 742;
export const AR_LANE_FAR = 404;
const NEAR_SCALE = 1.55;
const DEPTH_K = (AR_RAMP_Y * 1) / (NEAR_SCALE / 1.0 - 1); // the ramp's scale is 1.0 px a unit
const sOf = (y: number) => 1 / (1 + y / DEPTH_K);
const S_FAR = sOf(AR_RAMP_Y);

export function arLaneScreen(x: number, y: number): { x: number; y: number; k: number } {
  const s = sOf(y);
  const t = (1 - s) / (1 - S_FAR);
  return { x: CX + x * NEAR_SCALE * s, y: AR_LANE_NEAR - (AR_LANE_NEAR - AR_LANE_FAR) * t, k: NEAR_SCALE * s };
}

/* The board's projection: board y 0 (the ramp's lip) at BOARD_NEAR, the back at BOARD_FAR, tilted toward the player. */
export const AR_BOARD_NEAR = 386;
export const AR_BOARD_FAR = 116;
const BOARD_YK = (AR_BOARD_NEAR - AR_BOARD_FAR) / AR_BOARD_D;
const boardK = (y: number) => 1.08 - (0.2 * y) / AR_BOARD_D;

export function arBoardScreen(x: number, y: number, z = 0): { x: number; y: number; k: number } {
  const k = boardK(y);
  return { x: CX + x * k, y: AR_BOARD_NEAR - y * BOARD_YK - z * 0.9, k };
}

/** The release line's screen y (where the waiting ball sits) and lane x from a screen x. */
export function arReleaseFromScreen(x: number): number {
  return (x - CX) / NEAR_SCALE;
}

export interface ArView {
  /** The waiting ball's release point (lane units), set by the slide. */
  release: number;
  /** The swipe being drawn: its direction (lane across ÷ up) and power 0…1, or null. */
  aim: { slope: number; power: number } | null;
}

export function arNewView(): ArView {
  return { release: 0, aim: null };
}

const RING_LIGHT: Record<number, string> = { 10: "#FFB347", 20: "#FF8A3D", 30: "#FF5E7A", 40: "#FF4FD8", 50: "#FFE15A" };

function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number): void {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.5, rx), Math.max(0.5, ry), 0, 0, Math.PI * 2);
}

/** The shared success layer: a pop with each ball's points where it came down, the core filled at the end. */
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
        return b ? arBoardScreen(b.x, b.y) : null;
      },
      label: (s) => {
        const b = arScored(s).at(-1);
        return b ? (b.points === AR_POCKET_POINTS ? "100!" : `+${b.points}`) : null;
      },
    },
    { kind: "streak", count: (s) => arTotals(s).pockets, label: () => "POCKET!", neon: true },
    { kind: "final", count: (s) => (arTotals(s).rings >= AR_CORE_FULL ? 1 : 0), label: () => "FULL POINTS!" },
  ],
  misses: [{ count: (s) => arScored(s).filter((b) => b.points === 0).length, at: (s) => { const b = arScored(s).at(-1); return b ? arBoardScreen(b.x, b.y) : null; } }],
};

export function drawAlleyRoll(ctx: CanvasRenderingContext2D, state: ArState, size: CanvasSize, view?: ArView): void {
  arcadeFx(ctx, ALLEYROLL_FX, state, () => drawAlleyRollWorld(ctx, state, size, view), size);
}

function drawScoreboard(ctx: CanvasRenderingContext2D, state: ArState): void {
  const t = arTotals(state);
  // A wooden cabinet top with a dark glass panel of warm lit digits.
  const wood = ctx.createLinearGradient(0, 0, 0, 96);
  wood.addColorStop(0, "#5A3418");
  wood.addColorStop(1, "#3A200E");
  ctx.fillStyle = wood;
  ctx.fillRect(0, 0, AR_WORLD_W, 96);
  ctx.fillStyle = "#120A06";
  ctx.beginPath();
  ctx.roundRect(14, 12, AR_WORLD_W - 28, 70, 10);
  ctx.fill();
  ctx.strokeStyle = "#C88A3A";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(255,214,150,0.75)";
  ctx.font = `700 11px ${FONT}`;
  ctx.fillText("SCORE", CX, 26);
  ctx.fillText("BALL", 70, 26);
  ctx.fillText("POCKETS", AR_WORLD_W - 70, 26);
  ctx.shadowColor = "#FF9A3C";
  ctx.shadowBlur = 10;
  ctx.fillStyle = "#FFD27A";
  ctx.font = `800 34px ${FONT}`;
  ctx.fillText(String(t.rings).padStart(3, "0"), CX, 56);
  ctx.font = `800 24px ${FONT}`;
  const ball = Math.min(AR_BALLS, state.balls.length + (state.phase === AR_WAIT && state.ended === 0 ? 1 : 0));
  ctx.fillText(`${Math.max(1, ball)}/${AR_BALLS}`, 70, 56);
  ctx.fillText(String(t.pockets), AR_WORLD_W - 70, 56);
  ctx.shadowBlur = 0;
}

function drawBoard(ctx: CanvasRenderingContext2D, state: ArState): void {
  // The board: a tilted wooden face with a darker inset and the back wall's rail.
  const tl = arBoardScreen(-AR_BOARD_HALF, AR_BOARD_D);
  const tr = arBoardScreen(AR_BOARD_HALF, AR_BOARD_D);
  const br = arBoardScreen(AR_BOARD_HALF, 0);
  const bl = arBoardScreen(-AR_BOARD_HALF, 0);
  const g = ctx.createLinearGradient(0, tl.y, 0, bl.y);
  g.addColorStop(0, "#3B2312");
  g.addColorStop(1, "#6B3F1E");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(tl.x, tl.y);
  ctx.lineTo(tr.x, tr.y);
  ctx.lineTo(br.x, br.y);
  ctx.lineTo(bl.x, bl.y);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#D9A04E";
  ctx.lineWidth = 3;
  ctx.stroke();

  // Which ring the last ball fell in stays lit until the next ball rolls.
  const last = arScored(state).at(-1);
  const lit = state.phase === AR_SHOW || (state.phase === AR_WAIT && state.balls.length > 0) ? last?.points ?? -1 : -1;
  const pulse = state.phase === AR_SHOW ? 0.5 + 0.5 * Math.cos(((state.tick - state.phaseTick) / AR_SHOW_TICKS) * Math.PI * 6) : 0;

  const c = arBoardScreen(AR_RING_CX, AR_RING_CY);
  for (let i = AR_RINGS.length - 1; i >= 0; i--) {
    const ring = AR_RINGS[i]!;
    const rx = ring.r * c.k;
    const ry = ring.r * BOARD_YK;
    ellipse(ctx, c.x, c.y, rx, ry);
    ctx.fillStyle = i % 2 === 0 ? "#26150A" : "#1C0F07";
    ctx.fill();
    const on = lit === ring.points;
    ctx.strokeStyle = RING_LIGHT[ring.points]!;
    ctx.globalAlpha = on ? 0.7 + 0.3 * pulse : 0.75;
    ctx.lineWidth = on ? 4 : 2.5;
    ctx.shadowColor = RING_LIGHT[ring.points]!;
    ctx.shadowBlur = on ? 18 : 6;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }
  // Ring numbers along the ring tops.
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `800 11px ${FONT}`;
  for (let i = 1; i < AR_RINGS.length; i++) {
    const r = (AR_RINGS[i - 1]!.r + AR_RINGS[i]!.r) / 2;
    ctx.fillStyle = RING_LIGHT[AR_RINGS[i]!.points]!;
    ctx.fillText(String(AR_RINGS[i]!.points), c.x, c.y + r * BOARD_YK);
  }
  ctx.fillStyle = RING_LIGHT[50]!;
  ellipse(ctx, c.x, c.y, AR_RINGS[0]!.r * c.k * 0.62, AR_RINGS[0]!.r * BOARD_YK * 0.62);
  ctx.globalAlpha = 0.25;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = RING_LIGHT[50]!;
  ctx.font = `900 12px ${FONT}`;
  ctx.fillText("50", c.x, c.y + 1);

  // The two 100 pockets in the top corners.
  for (const p of AR_POCKETS) {
    const q = arBoardScreen(p.x, p.y);
    ellipse(ctx, q.x, q.y, AR_POCKET_R * q.k, AR_POCKET_R * BOARD_YK);
    ctx.fillStyle = "#0A0503";
    ctx.fill();
    const on = lit === AR_POCKET_POINTS && last && Math.sign(last.x) === Math.sign(p.x);
    ctx.strokeStyle = "#7CF7FF";
    ctx.lineWidth = on ? 3.5 : 2;
    ctx.shadowColor = "#7CF7FF";
    ctx.shadowBlur = on ? 18 : 8;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#BFFBFF";
    ctx.font = `800 10px ${FONT}`;
    ctx.fillText("100", q.x, q.y - AR_POCKET_R * BOARD_YK - 9);
  }
}

function drawLane(ctx: CanvasRenderingContext2D): void {
  const fl = arLaneScreen(-AR_LANE_HALF, AR_RAMP_Y);
  const fr = arLaneScreen(AR_LANE_HALF, AR_RAMP_Y);
  const nl = arLaneScreen(-AR_LANE_HALF, -30);
  const nr = arLaneScreen(AR_LANE_HALF, -30);
  // Planks: warm maple in long strips running up the lane.
  const g = ctx.createLinearGradient(0, fl.y, 0, nl.y);
  g.addColorStop(0, "#9B6430");
  g.addColorStop(1, "#D29A55");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(fl.x, fl.y);
  ctx.lineTo(fr.x, fr.y);
  ctx.lineTo(nr.x, nr.y);
  ctx.lineTo(nl.x, nl.y);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(90,48,18,0.35)";
  ctx.lineWidth = 1;
  for (let k = 1; k < 10; k++) {
    const x = -AR_LANE_HALF + (k * 2 * AR_LANE_HALF) / 10;
    const a = arLaneScreen(x, AR_RAMP_Y);
    const b = arLaneScreen(x, -30);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  // Aiming arrows on the lane.
  ctx.fillStyle = "rgba(120,40,10,0.45)";
  for (const x of [-60, -30, 0, 30, 60]) {
    const p = arLaneScreen(x, 200);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - 8 * p.k);
    ctx.lineTo(p.x + 5 * p.k, p.y + 4 * p.k);
    ctx.lineTo(p.x - 5 * p.k, p.y + 4 * p.k);
    ctx.fill();
  }
  // The rails: brass caps on dark wood, at the sim's walls.
  for (const side of [-1, 1]) {
    const a = arLaneScreen(side * AR_LANE_HALF, AR_RAMP_Y);
    const b = arLaneScreen(side * AR_LANE_HALF, -30);
    ctx.strokeStyle = "#3A1E0C";
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(a.x + side * 4, a.y);
    ctx.lineTo(b.x + side * 6, b.y);
    ctx.stroke();
    ctx.strokeStyle = "#E3B15C";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  // The ramp: a short raised lip at the lane's far end.
  ctx.fillStyle = "#4A2810";
  ctx.beginPath();
  ctx.moveTo(fl.x, fl.y);
  ctx.lineTo(fr.x, fr.y);
  ctx.lineTo(fr.x + 6, fr.y - 14);
  ctx.lineTo(fl.x - 6, fl.y - 14);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#F2C75C";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(fl.x - 6, fl.y - 14);
  ctx.lineTo(fr.x + 6, fr.y - 14);
  ctx.stroke();
  // The release strip.
  const r0 = arLaneScreen(-AR_LANE_HALF, 0);
  const r1 = arLaneScreen(AR_LANE_HALF, 0);
  ctx.strokeStyle = "rgba(255,240,200,0.5)";
  ctx.setLineDash([6, 5]);
  ctx.beginPath();
  ctx.moveTo(r0.x, r0.y + 12);
  ctx.lineTo(r1.x, r1.y + 12);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawBall(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, shadow: { x: number; y: number } | null): void {
  if (shadow) {
    ellipse(ctx, shadow.x, shadow.y, r * 1.05, r * 0.45);
    ctx.fillStyle = "rgba(20,8,2,0.4)";
    ctx.fill();
  }
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  g.addColorStop(0, "#FFF4E2");
  g.addColorStop(0.45, "#E2C9A2");
  g.addColorStop(1, "#7A5634");
  ctx.fillStyle = g;
  ellipse(ctx, x, y, r, r);
  ctx.fill();
}

function drawAlleyRollWorld(ctx: CanvasRenderingContext2D, state: ArState, size: CanvasSize, view?: ArView): void {
  ctx.save();
  ctx.scale(size.width / AR_WORLD_W, size.height / AR_WORLD_H);
  // The alley: a warm dark room, a glow behind the board.
  const bg = ctx.createLinearGradient(0, 0, 0, AR_WORLD_H);
  bg.addColorStop(0, "#22130A");
  bg.addColorStop(0.5, "#2C180B");
  bg.addColorStop(1, AR_BG);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, AR_WORLD_W, AR_WORLD_H);
  const glow = ctx.createRadialGradient(CX, 250, 20, CX, 250, 260);
  glow.addColorStop(0, "rgba(255,170,80,0.22)");
  glow.addColorStop(1, "rgba(255,170,80,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 96, AR_WORLD_W, 420);

  drawScoreboard(ctx, state);
  drawBoard(ctx, state);
  drawLane(ctx);

  // The ball: rolling on the lane, flying over the board, or waiting at the release strip.
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
    if (last && state.tick - state.phaseTick < 10) {
      const p = arBoardScreen(last.x, last.y);
      const k = 1 - (state.tick - state.phaseTick) / 10;
      drawBall(ctx, p.x, p.y - AR_BALL_R * p.k * 0.5, AR_BALL_R * p.k * k, null);
    }
  } else if (state.ended === 0 && state.balls.length < AR_BALLS) {
    const rel = view?.release ?? 0;
    const p = arLaneScreen(rel, 0);
    drawBall(ctx, p.x, p.y - AR_BALL_R * p.k, AR_BALL_R * p.k, { x: p.x, y: p.y });
    if (view?.aim) {
      // The preview arrow: a short line up the lane from the ball, longer with more power.
      const len = 70 + 130 * view.aim.power;
      const end = arLaneScreen(rel + view.aim.slope * len, len);
      ctx.strokeStyle = "rgba(255,226,140,0.9)";
      ctx.lineWidth = 4;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - AR_BALL_R * p.k * 2);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
      const ang = Math.atan2(end.y - (p.y - AR_BALL_R * p.k * 2), end.x - p.x);
      ctx.fillStyle = "rgba(255,226,140,0.95)";
      ctx.beginPath();
      ctx.moveTo(end.x + Math.cos(ang) * 10, end.y + Math.sin(ang) * 10);
      ctx.lineTo(end.x + Math.cos(ang + 2.4) * 10, end.y + Math.sin(ang + 2.4) * 10);
      ctx.lineTo(end.x + Math.cos(ang - 2.4) * 10, end.y + Math.sin(ang - 2.4) * 10);
      ctx.fill();
    }
  }
  // Balls still to roll, in the return tray at the bottom.
  const left = AR_BALLS - state.balls.length - (state.phase === AR_WAIT && state.ended === 0 ? 1 : 0);
  for (let i = 0; i < Math.max(0, left); i++) drawBall(ctx, CX - (Math.max(0, left) - 1) * 9 + i * 18, AR_WORLD_H - 14, 7, null);
  ctx.restore();
}

/** The alley's warm dark room carried out to the screen's edges (display only, painted once per size). */
export function alleyRollScene(ctx: CanvasRenderingContext2D, view: ArenaSceneView): void {
  const above = fillAbove(view);
  if (above) fillGradient(ctx, above, above.y, above.y + above.h, [[0, "#1A0E06"], [1, "#4E2D14"]]);
  for (const side of fillSides(view)) {
    fillGradient(ctx, side, side.y, side.y + side.h, [[0, "#2C180B"], [0.5, "#2A170A"], [1, AR_BG]]);
    // The scoreboard's wooden cabinet top runs on beside it, a shade darker.
    const top = Math.max(side.y, 0);
    const bottom = Math.min(side.y + side.h, 96);
    if (bottom > top) fillGradient(ctx, { x: side.x, y: top, w: side.w, h: bottom - top }, 0, 96, [[0, "#4E2D14"], [1, "#331C0C"]]);
  }
  const below = fillBelow(view);
  if (below) fillGradient(ctx, below, below.y, below.y + below.h, [[0, AR_BG], [1, "#120A05"]]);
}

export function alleyRollArtGame(view?: ArView): ArcadeGame<ArState, ArcadeInputEvent | null> {
  return { ...alleyRollGame, draw: (ctx, state, size) => drawAlleyRoll(ctx, state, size, view) };
}

export const alleyRollArt = alleyRollArtGame();
