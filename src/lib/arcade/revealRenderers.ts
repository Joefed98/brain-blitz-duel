/**
 * Per-game drawing config for the shared ArcadeReveal backdrop: how to rebuild
 * the run's final tick from the stored seed + stored input log, how to draw it
 * with the game's own renderer, and (where known) where the run ended. This is
 * visual only — the score, lines, tiles and axis come from round_results.
 */
import type { PuzzleData } from "@/lib/duel/types";

import { hoverArtGame as hoverGame, hoverRevealGame } from "./hover.renderer";
import { skylineArtGame as skylineGame, skylineRevealGame } from "./skyline.renderer";
import { binTossArtGame as binTossGame } from "./binTossArt.renderer";
import { drawBullseye } from "./bullseye.renderer";
import { matchupArtGame as matchupGame } from "./matchup.renderer";
import { breakerArtGame as breakerGame } from "./breaker.renderer";
import { rallyArtGame as rallyGame, rallyRevealGame } from "./rally.renderer";
import { sliceGame } from "./slice";
import { sliceArtGame } from "./slice.renderer";
import { bubbleArtGame as bubbleGame } from "./bubble.renderer";
import { beatArtGame as beatGame } from "./beat.renderer";
import { SNAKE_WORLD_H, SNAKE_WORLD_W } from "./snake";
import { snakeArtGame as snakeGame } from "./snake.renderer";
import { crossArtGame as crossGame, crossRevealGame } from "./cross.renderer";
import { WAV_SHIP_Y } from "./wavefront";
import { wavefrontArtGame as wavefrontGame } from "./wavefront.renderer";
import { flipArtGame as flipGame } from "./flipArt.renderer";
import { junctionArtGame as junctionGame, junctionRevealGame } from "./junction.renderer";
import { inkBridgeArtGame as inkBridgeGame } from "./inkBridge.renderer";
import { BURST_FLOOR_Y } from "./burst";
import { burstArtGame as burstGame } from "./burst.renderer";
import { orbitArtGame as orbitGame, orbitArtGameFor } from "./orbit.renderer";
import { swingArtGame as swingGame } from "./swing.renderer";
import { drawSnipArt as drawSnip } from "./snip.renderer";
import { snipCamera, SNIP_CONFIG, SNIP_H, type SnipState } from "./snip";
import { tiltArtGame as tiltGame } from "./tiltArt.renderer";
import { btArtDraw } from "./ballTrackArt.renderer";
import { BT_H, BT_W, type BtState } from "./ballTrack";
import { whackArtGame as whackGame } from "./whack.renderer";
import { clayGameFor, CLAY_H, CLAY_W } from "./clayShoot";
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
import { clashVariantOf } from "@/lib/arcade/colourClash";

export interface ArcadeRevealRenderer {
  /** The game's own accent colour for tiles and the track. */
  accent: string;
  worldW: number;
  worldH: number;
  /** Draws the final tick into a worldW × worldH context. */
  drawFinal: (ctx: CanvasRenderingContext2D, puzzle: PuzzleData, answer: string, presentation?: "reveal" | "demo") => { x: number; y: number } | null;
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
  revealGame: Drawable<S> = game,
): ArcadeRevealRenderer {
  return {
    accent,
    worldW,
    worldH,
    drawFinal: (ctx, puzzle, answer, presentation = "reveal") => {
      const { state } = replay(puzzle, answer);
      (presentation === "demo" ? game : revealGame).draw(ctx, state, { width: worldW, height: worldH });
      return focus ? focus(state) : null;
    },
  };
}

const seedOf = (puzzle: PuzzleData): number => ("seed" in puzzle ? Number(puzzle.seed) : 1);

export const ARCADE_REVEAL_RENDERERS: Record<string, ArcadeRevealRenderer> = {
  hover: simple("#2ED3B7", 390, 560, hoverGame, (p, a) => replayHoverRun(seedOf(p), a), undefined, hoverRevealGame),
  skyline: simple(GOLD, 390, 560, skylineGame, (p, a) => replaySkylineRun(seedOf(p), a), undefined, skylineRevealGame),
  bintoss: simple("#2ED3B7", 390, 560, binTossGame, (p, a) => replayBinTossRun(seedOf(p), a, p.type === "bintoss" ? p.binRev : undefined)),
  bullseye: simple(GOLD, 390, 560, { draw: drawBullseye }, (p, a) =>
    replayBullseyeRun(seedOf(p), a, p.type === "bullseye" ? p.winds : []),
  ),
  matchup: simple(GOLD, 390, 560, matchupGame, (p, a) => replayMatchupRun(seedOf(p), a)),
  breaker: simple(GOLD, 390, 620, breakerGame, (p, a) => replayBreakerRun(seedOf(p), a)),
  rally: simple("#4D8CFF", 390, 620, rallyGame, (p, a) => replayRallyRun(seedOf(p), a), undefined, rallyRevealGame),
  slice: simple("#C9CED6", 390, 620, sliceArtGame, (p, a) => replaySliceRun(seedOf(p), a)),
  bubble: simple(GOLD, 390, 620, bubbleGame, (p, a) => replayBubbleRun(seedOf(p), a)),
  beat: simple(GOLD, 390, 620, beatGame, (p, a) => replayBeatRun(seedOf(p), a)),
  snake: simple("#2ED3B7", SNAKE_WORLD_W, SNAKE_WORLD_H, snakeGame, (p, a) => replaySnakeRun(seedOf(p), a)),
  cross: simple("#2ED3B7", 390, 580, crossGame, (p, a) => replayCrossRun(seedOf(p), a), undefined, crossRevealGame),
  wavefront: simple(
    "#A78BFA",
    390,
    620,
    wavefrontGame,
    (p, a) => replayWavefrontRun(seedOf(p), a),
    (s) => ({ x: s.shipX, y: WAV_SHIP_Y }),
  ),
  flip: simple("#FF4D5E", 390, 620, flipGame, (p, a) => replayFlipRun(seedOf(p), a)),
  junction: simple("#22C55E", 390, 620, junctionGame, (p, a) => replayJunctionRun(seedOf(p), a), undefined, junctionRevealGame),
  inkbridge: simple("#2ED3B7", 390, 620, inkBridgeGame, (p, a) => replayInkBridgeRun(seedOf(p), a, p.type === "inkbridge" ? p.inkRev : undefined)),
  burst: simple("#2ED3B7", 390, BURST_FLOOR_Y, burstGame, (p, a) => replayBurstRun(seedOf(p), a)),
  orbit: {
    accent: GOLD,
    worldW: 390,
    worldH: 620,
    drawFinal: (ctx, puzzle, answer) => {
      const { state } = replayOrbitRun(seedOf(puzzle), answer, puzzle.type === "orbit" ? puzzle.orbitRev : undefined, puzzle.type === "orbit" ? puzzle.planets : undefined);
      // Dispatches on the replayed state's own rev field (rev3 draws via the
      // camera-scrolled renderer; rev1/2 stay byte-identical) rather than
      // puzzle data, so this keeps working once rev3 reaches the server.
      orbitArtGameFor(state).draw(ctx, state, { width: 390, height: 620 });
      return (state as { rev?: number }).rev === 3 ? null : { x: state.x / FP, y: (state.y - state.camY) / FP };
    },
  },
  swing: simple(GOLD, 390, 620, swingGame, (p, a) => replaySwingRun(seedOf(p), a, p.type === "swing" ? p.swingRev : undefined)),
  snip: {
    accent: "#E84A7F",
    worldW: SNIP_CONFIG.viewW,
    worldH: SNIP_H,
    drawFinal: (ctx, puzzle, answer) => {
      const state = replaySnipRun(seedOf(puzzle), answer, puzzle.type === "snip" ? puzzle.snipRev : undefined).state as SnipState;
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
      btArtDraw(ctx, puzzle.course, state);
      return null;
    },
  },
  whack: simple(GOLD, 390, 560, whackGame, (p, a) => replayWhackRun(seedOf(p), a)),
  clayshoot: {
    accent: "#E8762C",
    worldW: CLAY_W,
    worldH: CLAY_H,
    drawFinal: (ctx, puzzle, answer) => {
      if (puzzle.type !== "clayshoot") return null;
      const state = replayClayRun(puzzle.seed, answer, puzzle.clayRev).state;
      clayGameFor(puzzle.clayRev).draw(ctx, state, { width: CLAY_W, height: CLAY_H });
      return null;
    },
  },
  tendrop: simple(GOLD, TD_W, TD_H, tenDropGame, (p, a) => replayTenDropRun(seedOf(p), a)),
  stroop: simple(GOLD, 390, 560, colourClashGame, (p, a) => replayColourClashRun(seedOf(p), a, p.type === "stroop" ? clashVariantOf(p) : 0)),
};
