import { reducedMotion } from "./art.renderer";
import { arcadeFx } from "./arcadeFx.renderer";
import { RALLY_FX } from "./arcadeFxGames.renderer";
import { successHud, successFrame, SUCCESS_ACCENTS } from "./success.renderer";
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
  retroScreen(ctx, size, RALLY_WORLD_W, RALLY_WORLD_H, "stretch", (c) => arcadeFx(c, RALLY_FX, state, () => drawWorld(c, state, ctx)));
}
function drawReveal(ctx: CanvasRenderingContext2D, state: RallyState, size: CanvasSize): void {
  retroScreen(ctx, size, RALLY_WORLD_W, RALLY_WORLD_H, "stretch", (c) => arcadeFx(c, RALLY_FX, state, () => drawWorld(c, state, ctx, false)));
}

function drawWorld(ctx: CanvasRenderingContext2D, state: RallyState, key: CanvasRenderingContext2D, crashIndicator = true): void {
  const reward=successFrame(ctx,{id:'rally',tick:state.tick,count:rallyTotalHits(state),every:10,colour:GOLD,width:RALLY_WORLD_W,height:RALLY_WORLD_H,point:{x:px(state.x),y:RALLY_PADDLE_Y-4,shape:'spark'},hud:{x:14,y:26,text:`RALLY ${state.hits}`}});
  const heat=reward.chain>=20?SUCCESS_ACCENTS.orange:reward.chain>=10?GOLD:RETRO_WHITE;
  const bloom = retroBloom();
  const top = RALLY_HUD_H + RALLY_WALL;
  pixelRect(ctx, RALLY_WALL - 2, top - 2, RALLY_WORLD_W - 2 * RALLY_WALL + 4, 2, !reducedMotion()&&reward.milestoneAge<30?GOLD:COURT, bloom * 0.5);
  pixelRect(ctx, RALLY_WALL - 2, top - 2, 2, RALLY_WORLD_H, !reducedMotion()&&reward.milestoneAge<30?GOLD:COURT, bloom * 0.5);
  pixelRect(ctx, RALLY_WORLD_W - RALLY_WALL, top - 2, 2, RALLY_WORLD_H, !reducedMotion()&&reward.milestoneAge<30?GOLD:COURT, bloom * 0.5);
  const mid = Math.round((top + RALLY_PADDLE_Y) / 2);
  for (let x = RALLY_WALL + 6; x < RALLY_WORLD_W - RALLY_WALL - 6; x += 16) pixelRect(ctx, x, mid - 1, 8, 2, `${COURT}AA`);

  const width = rallyPaddleW(rallyTotalHits(state));
  retroPaddle(ctx, state.paddleX - width / 2, RALLY_PADDLE_Y, width, RALLY_PADDLE_H, PADDLE, "#0E4A44", bloom);

  state.golds.forEach((ball, i) => {
    const x = px(ball.x);
    const y = px(ball.y);
    drawRetroTrail(ctx, retroTrail(key, state.tick, `g${i}`, x, y, 6), RALLY_BALL_R, GOLD);
    retroBall(ctx, x, y, RALLY_BALL_R, GOLD, GOLD);
  });

  const bx = px(state.x);
  const by = px(state.y);
  if (!state.dead) drawRetroTrail(ctx, retroTrail(key, state.tick, "main", bx, by, 6), RALLY_BALL_R, heat);
  retroBall(ctx, bx, by, RALLY_BALL_R, state.dead && crashIndicator ? "#FF3B5C" : heat);

  successHud(ctx,'rally',state.tick,14,26,()=>{retroReadout(ctx, 14, 8, `RALLY ${state.hits}`, RETRO_WHITE);});
  retroText(ctx, `GOLD ${state.goldHits} ${Math.floor(RALLY_GOLD_POINTS * state.goldHits)}PTS`, RALLY_WORLD_W - 14, 20, 15, GOLD, "right");

  if (state.dead && crashIndicator) {
    ctx.fillStyle = "rgba(255,59,92,0.2)";
    ctx.fillRect(0, 0, RALLY_WORLD_W, RALLY_WORLD_H);
  }
}

export const rallyArtGame: ArcadeGame<RallyState, ArcadeInputEvent | null> = { ...rallyGame, draw };
export const rallyRevealGame = { draw: drawReveal };
