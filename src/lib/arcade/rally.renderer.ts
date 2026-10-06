/** Rally in the Retro Arcade world. Render only; the sim and its bounds are untouched. */
import {
  rallyGame,
  rallyPaddleW,
  rallyTotalHits,
  RALLY_BALL_R,
  RALLY_GOLD_POINTS,
  RALLY_HUD_H,
  RALLY_PADDLE_H,
  RALLY_PADDLE_Y,
  RALLY_WALL,
  RALLY_WORLD_H,
  RALLY_WORLD_W,
  type RallyState,
} from "./rally";
import { px, type ArcadeGame, type ArcadeInputEvent, type CanvasSize } from "./engine";
import {
  drawRetroTrail,
  pixelRect,
  retroBall,
  retroBloom,
  retroPaddle,
  retroReadout,
  retroScreen,
  retroText,
  retroTrail,
  RETRO_WHITE,
} from "./retro.renderer";

const COURT = "#1F6F8B";
const PADDLE = "#3DFFE0";
const BALL = "#5CD0FF";
const GOLD = "#FFD84A";

function draw(ctx: CanvasRenderingContext2D, state: RallyState, size: CanvasSize): void {
  retroScreen(ctx, size, RALLY_WORLD_W, RALLY_WORLD_H, "stretch", (c) => drawWorld(c, state, ctx));
}
function drawReveal(ctx: CanvasRenderingContext2D, state: RallyState, size: CanvasSize): void {
  retroScreen(ctx, size, RALLY_WORLD_W, RALLY_WORLD_H, "stretch", (c) => drawWorld(c, state, ctx, false));
}

function drawWorld(ctx: CanvasRenderingContext2D, state: RallyState, key: CanvasRenderingContext2D, crashIndicator = true): void {
  const bloom = retroBloom();
  // Neon court: walls on the original wall lines, a dashed centre line.
  const top = RALLY_HUD_H + RALLY_WALL;
  pixelRect(ctx, RALLY_WALL - 2, top - 2, RALLY_WORLD_W - 2 * RALLY_WALL + 4, 2, COURT, bloom * 0.5);
  pixelRect(ctx, RALLY_WALL - 2, top - 2, 2, RALLY_WORLD_H, COURT, bloom * 0.5);
  pixelRect(ctx, RALLY_WORLD_W - RALLY_WALL, top - 2, 2, RALLY_WORLD_H, COURT, bloom * 0.5);
  const mid = Math.round((top + RALLY_PADDLE_Y) / 2);
  for (let x = RALLY_WALL + 6; x < RALLY_WORLD_W - RALLY_WALL - 6; x += 16) pixelRect(ctx, x, mid - 1, 8, 2, `${COURT}AA`);

  // The trapezium narrows with the sim's shrinking width.
  const width = rallyPaddleW(rallyTotalHits(state));
  retroPaddle(ctx, state.paddleX - width / 2, RALLY_PADDLE_Y, width, RALLY_PADDLE_H, PADDLE, "#0E4A44", bloom);

  state.golds.forEach((ball, i) => {
    const x = px(ball.x);
    const y = px(ball.y);
    drawRetroTrail(ctx, retroTrail(key, state.tick, `g${i}`, x, y), RALLY_BALL_R, GOLD);
    retroBall(ctx, x, y, RALLY_BALL_R, GOLD, GOLD);
  });

  const bx = px(state.x);
  const by = px(state.y);
  if (!state.dead) drawRetroTrail(ctx, retroTrail(key, state.tick, "main", bx, by), RALLY_BALL_R, BALL);
  retroBall(ctx, bx, by, RALLY_BALL_R, state.dead && crashIndicator ? "#FF3B5C" : BALL);

  retroReadout(ctx, 14, 8, `RALLY ${state.hits}`, RETRO_WHITE);
  retroText(ctx, `GOLD ${state.goldHits} ${Math.floor(RALLY_GOLD_POINTS * state.goldHits)}PTS`, RALLY_WORLD_W - 14, 20, 10, GOLD, "right");

  if (state.dead && crashIndicator) {
    ctx.fillStyle = "rgba(255,59,92,0.2)";
    ctx.fillRect(0, 0, RALLY_WORLD_W, RALLY_WORLD_H);
  }
}

export const rallyArtGame: ArcadeGame<RallyState, ArcadeInputEvent | null> = { ...rallyGame, draw };
export const rallyRevealGame = { draw: drawReveal };
