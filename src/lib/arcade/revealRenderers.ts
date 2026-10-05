/**
 * Per-game drawing config for the shared ArcadeReveal backdrop: how to rebuild
 * the run's final tick from the stored seed + stored input log, how to draw it
 * with the game's own renderer, and (where known) where the run ended. This is
 * visual only — the score, lines, tiles and axis come from round_results.
 */
import type { PuzzleData } from "@/lib/duel/types";

import { hoverArtGame as hoverGame } from "./hover.renderer";
import { skylineGame } from "./skyline";
import { binTossGame } from "./binToss";
import { drawBullseye } from "./bullseye.renderer";
import { matchupArtGame as matchupGame } from "./matchup.renderer";
import { breakerGame } from "./breaker";
import { rallyGame } from "./rally";
import { sliceGame } from "./slice";
import { bubbleGame } from "./bubble";
import { beatArtGame as beatGame } from "./beat.renderer";
import { SNAKE_WORLD_H, SNAKE_WORLD_W } from "./snake";
import { snakeArtGame as snakeGame } from "./snake.renderer";
import { crossArtGame as crossGame } from "./cross.renderer";
import { WAV_SHIP_Y } from "./wavefront";
import { wavefrontArtGame as wavefrontGame } from "./wavefront.renderer";
import { flipArtGame as flipGame } from "./flipArt.renderer";
import { junctionGame } from "./junction";
import { inkBridgeGame } from "./inkBridge";
import { burstGame, BURST_FLOOR_Y } from "./burst";
import { orbitArtGame as orbitGame } from "./orbit.renderer";
import { swingArtGame as swingGame } from "./swing.renderer";
import { drawSnip, snipCamera, SNIP_CONFIG, SNIP_H, type SnipState } from "./snip";
import { tiltGame } from "./tilt";
import { btDraw, BT_H, BT_W, type BtState } from "./ballTrack";
import { whackGame } from "./whack";
import { clayGame, CLAY_H, CLAY_W } from "./clayShoot";
import { tenDropGame, TD_H, TD_W } from "./tenDrop";
import { colourClashGame } from "./colourClash";

import { replayHoverRun } from "@/lib/duel/hover";
import { replaySkylineRun } from "@/lib/duel/skyline";
import { replayBinTossRun } from "@/lib/duel/binToss";
import { replayBullseyeRun } from "@/lib/duel/bullseye";
import { replayMatchupRun } from "@/lib/duel/matchup";
import { replayBreakerRun } from "@/lib/duel/breaker";
import { replayRallyRun } from "@/lib/duel/rally";
import { replaySliceRun } from "@/lib/duel/slice";
import { replayBubbleRun } from "@/lib/duel/bubble";
import { replayBeatRun } from "@/lib/duel/beat";
import { replaySnakeRun } from "@/lib/duel/snake";
import { replayCrossRun } from "@/lib/duel/cross";
import { replayWavefrontRun } from "@/lib/duel/wavefront";
import { replayFlipRun } from "@/lib/duel/flip";
import { replayJunctionRun } from "@/lib/duel/junction";
import { replayInkBridgeRun } from "@/lib/duel/inkBridge";
import { replayBurstRun } from "@/lib/duel/burst";
import { replayOrbitRun } from "@/lib/duel/orbit";
import { replaySwingRun } from "@/lib/duel/swing";
import { replaySnipRun } from "@/lib/duel/snip";
import { replayTiltRun } from "@/lib/duel/tilt";
import { replayBallTrackRun } from "@/lib/duel/ballTrack";
import { replayWhackRun } from "@/lib/duel/whack";
import { replayClayRun } from "@/lib/duel/clayShoot";
import { replayTenDropRun } from "@/lib/duel/tenDrop";
import { replayColourClashRun } from "@/lib/duel/colourClash";

export interface ArcadeRevealRenderer {
  /** The game's own accent colour for tiles and the track. */
  accent: string;
  worldW: number;
  worldH: number;
  /** Draws the final tick into a worldW × worldH context. */
  drawFinal: (ctx: CanvasRenderingContext2D, puzzle: PuzzleData, answer: string) => { x: number; y: number } | null;
}

const GOLD = "#F5B82E";
const FP = 256;

interface Drawable<S> {
  draw: (ctx: CanvasRenderingContext2D, state: S, size: { width: number; height: number }) => void;
}

/** A game drawn by its own `draw` at world size from the replayed final state. */
function simple<S>(
  accent: string,
  worldW: number,
  worldH: number,
  game: Drawable<S>,
  replay: (puzzle: PuzzleData, answer: string) => { state: S },
  focus?: (state: S) => { x: number; y: number } | null,
): ArcadeRevealRenderer {
  return {
    accent,
    worldW,
    worldH,
    drawFinal: (ctx, puzzle, answer) => {
      const { state } = replay(puzzle, answer);
      game.draw(ctx, state, { width: worldW, height: worldH });
      return focus ? focus(state) : null;
    },
  };
}

const seedOf = (puzzle: PuzzleData): number => ("seed" in puzzle ? Number(puzzle.seed) : 1);

export const ARCADE_REVEAL_RENDERERS: Record<string, ArcadeRevealRenderer> = {
  hover: simple("#2ED3B7", 390, 560, hoverGame, (p, a) => replayHoverRun(seedOf(p), a)),
  skyline: simple(GOLD, 390, 560, skylineGame, (p, a) => replaySkylineRun(seedOf(p), a)),
  bintoss: simple("#2ED3B7", 390, 560, binTossGame, (p, a) => replayBinTossRun(seedOf(p), a)),
  bullseye: simple(GOLD, 390, 560, { draw: drawBullseye }, (p, a) =>
    replayBullseyeRun(seedOf(p), a, p.type === "bullseye" ? p.winds : []),
  ),
  matchup: simple(GOLD, 390, 560, matchupGame, (p, a) => replayMatchupRun(seedOf(p), a)),
  breaker: simple(GOLD, 390, 620, breakerGame, (p, a) => replayBreakerRun(seedOf(p), a)),
  rally: simple("#4D8CFF", 390, 620, rallyGame, (p, a) => replayRallyRun(seedOf(p), a)),
  slice: simple("#C9CED6", 390, 620, sliceGame, (p, a) => replaySliceRun(seedOf(p), a)),
  bubble: simple(GOLD, 390, 620, bubbleGame, (p, a) => replayBubbleRun(seedOf(p), a)),
  beat: simple(GOLD, 390, 620, beatGame, (p, a) => replayBeatRun(seedOf(p), a)),
  snake: simple("#2ED3B7", SNAKE_WORLD_W, SNAKE_WORLD_H, snakeGame, (p, a) => replaySnakeRun(seedOf(p), a)),
  cross: simple("#2ED3B7", 390, 580, crossGame, (p, a) => replayCrossRun(seedOf(p), a)),
  wavefront: simple(
    "#A78BFA",
    390,
    620,
    wavefrontGame,
    (p, a) => replayWavefrontRun(seedOf(p), a),
    (s) => ({ x: s.shipX, y: WAV_SHIP_Y }),
  ),
  flip: simple("#FF4D5E", 390, 620, flipGame, (p, a) => replayFlipRun(seedOf(p), a)),
  junction: simple("#22C55E", 390, 620, junctionGame, (p, a) => replayJunctionRun(seedOf(p), a)),
  inkbridge: simple("#2ED3B7", 390, 620, inkBridgeGame, (p, a) => replayInkBridgeRun(seedOf(p), a)),
  burst: simple("#2ED3B7", 390, BURST_FLOOR_Y, burstGame, (p, a) => replayBurstRun(seedOf(p), a)),
  orbit: simple(
    GOLD,
    390,
    620,
    orbitGame,
    (p, a) => replayOrbitRun(seedOf(p), a),
    (s) => ({ x: s.x / FP, y: (s.y - s.camY) / FP }),
  ),
  swing: simple(GOLD, 390, 620, swingGame, (p, a) => replaySwingRun(seedOf(p), a)),
  snip: {
    accent: "#E84A7F",
    worldW: SNIP_CONFIG.viewW,
    worldH: SNIP_H,
    drawFinal: (ctx, puzzle, answer) => {
      const state = replaySnipRun(seedOf(puzzle), answer).state as SnipState;
      const camera = snipCamera(state, state.sx / FP - SNIP_CONFIG.viewW / 2, 1);
      drawSnip(ctx, state, { width: SNIP_CONFIG.viewW, height: SNIP_H }, undefined, camera);
      return null;
    },
  },
  tilt: simple("#2EC4B6", 440, 470, tiltGame, (p, a) => replayTiltRun(seedOf(p), a)),
  balltrack: {
    accent: GOLD,
    worldW: BT_W,
    worldH: BT_H,
    drawFinal: (ctx, puzzle, answer) => {
      if (puzzle.type !== "balltrack") return null;
      const state = replayBallTrackRun(puzzle.course, puzzle.seed, answer).state as BtState;
      btDraw(ctx, puzzle.course, state);
      return null;
    },
  },
  whack: simple(GOLD, 390, 560, whackGame, (p, a) => replayWhackRun(seedOf(p), a)),
  clayshoot: simple("#E8762C", CLAY_W, CLAY_H, clayGame, (p, a) => replayClayRun(seedOf(p), a)),
  tendrop: simple(GOLD, TD_W, TD_H, tenDropGame, (p, a) => replayTenDropRun(seedOf(p), a)),
  stroop: simple(GOLD, 390, 560, colourClashGame, (p, a) => replayColourClashRun(seedOf(p), a)),
};
