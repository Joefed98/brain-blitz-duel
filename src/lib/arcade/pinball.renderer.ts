/**
 * Pinball art (Retro world). Render only: reads the sim state, never writes it.
 * Every solid thing is drawn on its collision shape (walls and targets as their
 * capsules, bumpers as their circles, flippers as their swept capsule at the
 * sim's angle), so what the player sees is what the ball hits. A bumper that was
 * just struck glows neon for a few ticks (from the sim's bumperAt), and the
 * border lights ripple out from it through the shared success layer.
 */
import { arcadeFx } from "./arcadeFx.renderer";
import { PINBALL_FX } from "./arcadeFxGames.renderer";
import { type ArcadeGame, type ArcadeInputEvent, type CanvasSize } from "./engine";
import {
  pinballGame,
  pinFlipAngle,
  PIN_BALLS,
  PIN_BALL_R,
  PIN_BUMPERS,
  PIN_BUMPER_R,
  PIN_FLIP_LEN,
  PIN_FLIP_PIVOTS,
  PIN_FLIP_R,
  PIN_GATE,
  PIN_LANE_POSTS,
  PIN_LANE_POST_BOTTOM,
  PIN_LANE_X,
  PIN_LEFT_WALL,
  PIN_MULT_MAX,
  PIN_ORBIT_INNER,
  PIN_SEGS,
  PIN_SLING,
  PIN_SPINNER_Y,
  PIN_TARGET,
  PIN_TARGET_HALF,
  PIN_TARGET_R,
  PIN_TARGET_XS,
  PIN_TARGET_Y,
  PIN_WORLD_H,
  PIN_WORLD_W,
  PIN_ARCH,
  PIN_LANE_INNER,
  PIN_LANE_OUTER,
  PIN_RUN_TICKS,
  type PinState,
} from "./pinball";
import { drawRetroTrail, retroBall, retroBloom, retroClock, retroScreen, retroText, retroTrail, RETRO_WHITE } from "./retro.renderer";

export const PIN_COLOURS = {
  wall: "#3DFFE0",
  panel: "#0B0620",
  bumper: "#FF4DFF",
  bumperCap: "#2A0A33",
  sling: "#FFD84A",
  target: "#FF8A3C",
  targetDown: "rgba(255,138,60,0.28)",
  laneOn: "#4BFF7A",
  laneOff: "rgba(75,255,122,0.18)",
  flipper: "#FFD84A",
  flipperCore: "#5A4510",
  spinner: "#F4FFF8",
  spinnerLit: "#FFD84A",
  ball: "#C9D6E8",
  hud: "#F4FFF8",
} as const;

/** How long a struck bumper or slingshot glows, in sim ticks. */
const GLOW_TICKS = 10;

/** Per-canvas spinner animation memory (presentation only). */
const spinMemo = new WeakMap<CanvasRenderingContext2D, { spins: number; at: number; turns: number; tick: number }>();

function capsule(ctx: CanvasRenderingContext2D, ax: number, ay: number, bx: number, by: number, r: number, colour: string, glow = 0): void {
  ctx.strokeStyle = colour;
  ctx.lineWidth = r * 2;
  ctx.lineCap = "round";
  if (glow > 0) {
    ctx.shadowColor = colour;
    ctx.shadowBlur = glow;
  }
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(bx, by);
  ctx.stroke();
  ctx.shadowBlur = 0;
}

function drawPanel(ctx: CanvasRenderingContext2D): void {
  // A faint playfield panel under the arch, inside the walls (decoration only).
  ctx.fillStyle = PIN_COLOURS.panel;
  ctx.beginPath();
  ctx.ellipse(PIN_ARCH.cx, PIN_ARCH.cy, PIN_ARCH.rx - 4, PIN_ARCH.ry - 4, 0, Math.PI, Math.PI * 2);
  ctx.lineTo(PIN_LANE_INNER - 4, PIN_ARCH.cy);
  ctx.lineTo(PIN_LANE_INNER - 4, PIN_WORLD_H);
  ctx.lineTo(PIN_LEFT_WALL + 4, PIN_WORLD_H);
  ctx.lineTo(PIN_LEFT_WALL + 4, PIN_ARCH.cy);
  ctx.closePath();
  ctx.fill();
  // Shooter lane floor stripe and arrows.
  ctx.fillStyle = "rgba(61,255,224,0.06)";
  ctx.fillRect(PIN_LANE_INNER + 3, 150, PIN_LANE_OUTER - PIN_LANE_INNER - 6, PIN_WORLD_H - 150);
}

function drawWorld(ctx: CanvasRenderingContext2D, state: PinState, key: CanvasRenderingContext2D): void {
  const bloom = retroBloom();
  const t = retroClock();
  drawPanel(ctx);

  // Lane lights under the guide posts.
  for (let lane = 0; lane < 3; lane++) {
    const x0 = PIN_LANE_POSTS[lane]!, x1 = PIN_LANE_POSTS[lane + 1]!;
    const lit = ((state.lanes >> lane) & 1) === 1;
    const cx = (x0 + x1) / 2;
    ctx.fillStyle = lit ? PIN_COLOURS.laneOn : PIN_COLOURS.laneOff;
    if (lit) {
      ctx.shadowColor = PIN_COLOURS.laneOn;
      ctx.shadowBlur = bloom;
    }
    ctx.beginPath();
    ctx.moveTo(cx, PIN_LANE_POST_BOTTOM + 8);
    ctx.lineTo(cx + 8, PIN_LANE_POST_BOTTOM + 20);
    ctx.lineTo(cx - 8, PIN_LANE_POST_BOTTOM + 20);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // Multiplier lights: one per step, lit up to the current multiplier.
  for (let m = 2; m <= PIN_MULT_MAX; m++) {
    const on = state.mult >= m;
    retroText(ctx, `x${m}`, PIN_MID_LIGHTS_X + (m - 2) * 28 - 42, 470, 9, on ? "#FFD84A" : "rgba(255,216,74,0.22)", "center", on ? 4 : 0);
  }

  // Static walls, slings, gate and targets: each on its own capsule.
  PIN_SEGS.forEach((seg) => {
    if (seg.kind === PIN_TARGET) return;
    if (seg.kind === PIN_SLING) {
      const age = state.tick - (state.slingAt[seg.id ?? 0] ?? -999);
      const glowing = age >= 0 && age < GLOW_TICKS;
      capsule(ctx, seg.a[0], seg.a[1], seg.b[0], seg.b[1], seg.r, glowing ? RETRO_WHITE : PIN_COLOURS.sling, glowing ? 14 : bloom * 0.6);
      return;
    }
    if (seg.kind === PIN_GATE) {
      capsule(ctx, seg.a[0], seg.a[1], seg.b[0], seg.b[1], seg.r, "rgba(61,255,224,0.55)");
      return;
    }
    capsule(ctx, seg.a[0], seg.a[1], seg.b[0], seg.b[1], seg.r, PIN_COLOURS.wall, bloom * 0.5);
  });

  // Drop targets: up = a solid capsule, down = a faint slot.
  PIN_TARGET_XS.forEach((x, i) => {
    const down = ((state.targets >> i) & 1) === 1;
    capsule(ctx, x - PIN_TARGET_HALF, PIN_TARGET_Y, x + PIN_TARGET_HALF, PIN_TARGET_Y, down ? 1 : PIN_TARGET_R, down ? PIN_COLOURS.targetDown : PIN_COLOURS.target, down ? 0 : bloom * 0.6);
  });

  // Spinner: a bar across the left orbit lane that keeps turning after the ball goes through.
  let memo = spinMemo.get(key);
  if (!memo || state.tick < memo.tick) memo = { spins: state.spins, at: t, turns: 0, tick: state.tick };
  if (state.spins > memo.spins) {
    memo.turns = Math.min(16, state.spins - memo.spins + memo.turns);
    memo.at = t;
  }
  memo.spins = state.spins;
  memo.tick = state.tick;
  spinMemo.set(key, memo);
  const spinAge = t - memo.at;
  const spinPhase = t === 0 ? 0 : Math.max(0, memo.turns * 90 - spinAge) / 90;
  const squash = Math.abs(Math.cos(spinPhase * Math.PI));
  const lit = state.tick < state.spinLit;
  const sx0 = PIN_LEFT_WALL + 4, sx1 = PIN_ORBIT_INNER - 4;
  ctx.fillStyle = lit ? PIN_COLOURS.spinnerLit : PIN_COLOURS.spinner;
  if (lit) {
    ctx.shadowColor = PIN_COLOURS.spinnerLit;
    ctx.shadowBlur = bloom;
  }
  ctx.fillRect(sx0, PIN_SPINNER_Y - 1 - 4 * squash, sx1 - sx0, 2 + 8 * squash);
  ctx.shadowBlur = 0;

  // Pop bumpers: a ring that flares neon when struck, a dark cap and a pixel star.
  PIN_BUMPERS.forEach(([bx, by], i) => {
    const age = state.tick - (state.bumperAt[i] ?? -999);
    const hot = age >= 0 && age < GLOW_TICKS;
    const k = hot ? 1 - age / GLOW_TICKS : 0;
    ctx.fillStyle = hot ? `rgba(255,77,255,${(0.35 + 0.4 * k).toFixed(3)})` : PIN_COLOURS.bumperCap;
    ctx.beginPath();
    ctx.arc(bx, by, PIN_BUMPER_R - 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = hot ? RETRO_WHITE : PIN_COLOURS.bumper;
    ctx.lineWidth = 4;
    ctx.shadowColor = PIN_COLOURS.bumper;
    ctx.shadowBlur = hot ? 10 + 14 * k : bloom * 0.7;
    ctx.beginPath();
    ctx.arc(bx, by, PIN_BUMPER_R - 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = hot ? RETRO_WHITE : PIN_COLOURS.bumper;
    for (let a = 0; a < 4; a++) {
      const dx = a % 2 === 0 ? 0 : a === 1 ? 5 : -5;
      const dy = a % 2 === 1 ? 0 : a === 0 ? -5 : 5;
      ctx.fillRect(bx + dx - 2, by + dy - 2, 4, 4);
    }
    ctx.fillRect(bx - 2, by - 2, 4, 4);
  });

  // Flippers at the sim's angle, on their capsules.
  for (let side = 0; side < 2; side++) {
    const [pxp, pyp] = PIN_FLIP_PIVOTS[side]!;
    const a = (pinFlipAngle(side, state.flips[side] ?? 0) / 65536) * Math.PI * 2;
    const tx = pxp + Math.cos(a) * PIN_FLIP_LEN, ty = pyp + Math.sin(a) * PIN_FLIP_LEN;
    const held = ((state.held >> side) & 1) === 1;
    capsule(ctx, pxp, pyp, tx, ty, PIN_FLIP_R, PIN_COLOURS.flipper, held ? bloom + 4 : bloom * 0.5);
    capsule(ctx, pxp, pyp, tx, ty, PIN_FLIP_R - 3, PIN_COLOURS.flipperCore);
    ctx.fillStyle = PIN_COLOURS.flipper;
    ctx.fillRect(pxp - 2, pyp - 2, 4, 4);
  }

  // The ball (with a short trail while in play), or waiting in the shooter lane.
  const bx = state.x / 256, by = state.y / 256;
  if (state.live) drawRetroTrail(ctx, retroTrail(key, state.tick, "ball", bx, by, 6), PIN_BALL_R, PIN_COLOURS.ball);
  if (state.live || state.lost < PIN_BALLS) retroBall(ctx, bx, by, PIN_BALL_R, PIN_COLOURS.ball, RETRO_WHITE);
  if (!state.live && state.lost < PIN_BALLS && state.wait > 0) {
    const blink = t === 0 || Math.floor(t / 300) % 2 === 0;
    if (blink) retroText(ctx, "^", PIN_LANE_X, 600, 12, PIN_COLOURS.sling, "center");
  }

  // Thumb-zone hints at the bottom corners: each lights while its flipper is held.
  for (let side = 0; side < 2; side++) {
    const held = ((state.held >> side) & 1) === 1;
    retroText(ctx, side === 0 ? "< HOLD" : "HOLD >", side === 0 ? 16 : PIN_LANE_INNER - 6, PIN_WORLD_H - 18, 8, held ? PIN_COLOURS.flipper : "rgba(255,216,74,0.3)", side === 0 ? "left" : "right");
  }

  // HUD: score left, balls and multiplier right (above the arch).
  retroText(ctx, state.points.toLocaleString("en-GB"), 12, 8, 12, PIN_COLOURS.hud, "left", 4);
  const left = Math.max(0, PIN_BALLS - state.lost);
  retroText(ctx, `BALL ${Math.min(PIN_BALLS, state.launched || 1)}/${PIN_BALLS}`, PIN_WORLD_W - 12, 8, 10, PIN_COLOURS.hud, "right");
  for (let i = 0; i < left; i++) {
    ctx.fillStyle = PIN_COLOURS.ball;
    ctx.fillRect(PIN_WORLD_W - 18 - i * 10, 24, 6, 6);
  }
  if (state.lost >= PIN_BALLS && state.tick < PIN_RUN_TICKS) retroText(ctx, "GAME OVER", PIN_WORLD_W / 2 - 12, 420, 16, "#FF3B5C", "center", 6);
}

/** Centre of the multiplier lights row. */
const PIN_MID_LIGHTS_X = 181;

function draw(ctx: CanvasRenderingContext2D, state: PinState, size: CanvasSize): void {
  retroScreen(ctx, size, PIN_WORLD_W, PIN_WORLD_H, "fit", (c) => arcadeFx(c, PINBALL_FX, state, () => drawWorld(c, state, ctx)));
}

export const pinballArtGame: ArcadeGame<PinState, ArcadeInputEvent | null> = { ...pinballGame, draw };

/** The art game for a stored pinRev (one revision so far). */
export function pinballArtGameFor(_rev?: number | null): ArcadeGame<PinState, ArcadeInputEvent | null> {
  return pinballArtGame;
}
