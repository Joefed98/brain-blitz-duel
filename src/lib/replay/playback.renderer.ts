/**
 * Replay playback drawing (display only): each replayable game drawn from a
 * replayed sim state with its own live renderer — the same art (and shared
 * success effects) the player saw — at the stored round's world size. Mirrors
 * the "demo" presentation of revealRenderers.ts, but takes the state from the
 * replay timeline instead of re-running the round for every frame. Never
 * imported by a sim or the server.
 */
import type { PuzzleData } from "@/lib/duel/types";
import { ARCADE_REVEAL_RENDERERS, revealWorldH } from "@/lib/arcade/revealRenderers";

import { hoverArtGame } from "@/lib/arcade/hover.renderer";
import { skylineArtGame } from "@/lib/arcade/skyline.renderer";
import { binTossArtGame } from "@/lib/arcade/binTossArt.renderer";
import { drawBullseye } from "@/lib/arcade/bullseye.renderer";
import { matchupArtGame } from "@/lib/arcade/matchup.renderer";
import { breakerArtGameFor } from "@/lib/arcade/breaker.renderer";
import { pinballArtGameForAny } from "@/lib/arcade/pinball4.renderer";
import { drawMinesweeper } from "@/lib/arcade/minesweeper.renderer";
import { drawMahjong } from "@/lib/arcade/mahjong.renderer";
import { homerunArtGame } from "@/lib/arcade/homerun.renderer";
import { freekickArtGame } from "@/lib/arcade/freekick.renderer";
import { racingArtGame } from "@/lib/arcade/racing.renderer";
import { freecellArt } from "@/lib/arcade/cards/freecell.renderer";
import { tripeaksArt } from "@/lib/arcade/cards/tripeaks.renderer";
import { pokerSquaresArt } from "@/lib/arcade/cards/pokerSquares.renderer";
import { fiveHandsArt } from "@/lib/arcade/cards/fiveHands.renderer";
import { drawMinigolf } from "@/lib/arcade/minigolf.renderer";
import { drawPool } from "@/lib/arcade/pool.renderer";
import { drawCurling } from "@/lib/arcade/curling.renderer";
import { blockfallArt } from "@/lib/arcade/blockfall.renderer";
import { alleyRollArt } from "@/lib/arcade/alleyroll.renderer";
import { rallyArtGame } from "@/lib/arcade/rally.renderer";
import { sliceArtGame } from "@/lib/arcade/slice.renderer";
import { bubbleArtGame } from "@/lib/arcade/bubble.renderer";
import { beatArtGame } from "@/lib/arcade/beat.renderer";
import { snakeArtGame } from "@/lib/arcade/snake.renderer";
import { crossArtGame } from "@/lib/arcade/cross.renderer";
import { wavefrontArtGame } from "@/lib/arcade/wavefront.renderer";
import { flipArtGame } from "@/lib/arcade/flipArt.renderer";
import { junctionArtGame } from "@/lib/arcade/junction.renderer";
import { inkBridgeArtGame } from "@/lib/arcade/inkBridge.renderer";
import { burstArtGameFor } from "@/lib/arcade/burst.renderer";
import { orbitArtGame, orbitRev3ArtGame } from "@/lib/arcade/orbit.renderer";
import { orbitCameraObserve } from "@/lib/arcade/orbitCamera";
import { orbitRewardObserve } from "@/lib/arcade/orbitRewards.renderer";
import { swingArtGame } from "@/lib/arcade/swing.renderer";
import { drawSnipArt } from "@/lib/arcade/snip.renderer";
import { snipCamera, snipWorldH, SNIP_CONFIG, type SnipState } from "@/lib/arcade/snip";
import { tiltArtGame } from "@/lib/arcade/tiltArt.renderer";
import { btArtDraw } from "@/lib/arcade/ballTrackArt.renderer";
import { whackArtGame } from "@/lib/arcade/whack.renderer";
import { clayArtGameFor } from "@/lib/arcade/clayShoot.renderer";
import { drawTenDrop } from "@/lib/arcade/tenDrop.renderer";
import { wordfallArtGame } from "@/lib/arcade/wordfall.renderer";
import { clashVariantOf } from "@/lib/arcade/colourClash";
import { colourClashArtGameFor } from "@/lib/arcade/colourClash.renderer";
import { canvasRatio } from "@/lib/battery";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Size = { width: number; height: number };
type Draw = (ctx: CanvasRenderingContext2D, state: any, size: Size) => void;

const rev = (p: PuzzleData, key: string): number | undefined => {
  const value = (p as unknown as Record<string, unknown>)[key];
  return typeof value === "number" ? value : undefined;
};

/** A drawer for one stored round; holds presentation-only memory (a camera). */
export interface PlaybackDrawer {
  worldW: number;
  worldH: number;
  accent: string;
  /** Draws `state` into a worldW × worldH context. `jumped` resets eased cameras. */
  draw: (ctx: CanvasRenderingContext2D, state: any, jumped: boolean) => void;
}

const SIMPLE: Record<string, (p: PuzzleData) => Draw> = {
  hover: () => hoverArtGame.draw as Draw,
  skyline: () => skylineArtGame.draw as Draw,
  bintoss: () => binTossArtGame.draw as Draw,
  bullseye: () => drawBullseye as Draw,
  matchup: () => matchupArtGame.draw as Draw,
  breaker: (p) => breakerArtGameFor(rev(p, "brkRev")).draw as Draw,
  pinball: (p) => pinballArtGameForAny(rev(p, "pinRev")).draw as Draw,
  minesweeper: () => drawMinesweeper as Draw,
  mahjong: () => drawMahjong as Draw,
  homerun: () => homerunArtGame.draw as Draw,
  freekick: () => freekickArtGame.draw as Draw,
  racing: () => racingArtGame.draw as Draw,
  freecell: () => freecellArt.draw as Draw,
  tripeaks: () => tripeaksArt.draw as Draw,
  pokersquares: () => pokerSquaresArt.draw as Draw,
  fivehands: () => fiveHandsArt.draw as Draw,
  curling: () => ((ctx, s) => drawCurling(ctx, s, null)) as Draw,
  blockfall: () => blockfallArt.draw as Draw,
  alleyroll: () => alleyRollArt.draw as Draw,
  pool: () => ((ctx, s) => drawPool(ctx, s, null)) as Draw,
  minigolf: () => ((ctx, s) => drawMinigolf(ctx, s, null)) as Draw,
  rally: () => rallyArtGame.draw as Draw,
  slice: () => sliceArtGame.draw as Draw,
  bubble: () => bubbleArtGame.draw as Draw,
  beat: () => beatArtGame.draw as Draw,
  snake: () => snakeArtGame.draw as Draw,
  cross: () => crossArtGame.draw as Draw,
  wavefront: () => wavefrontArtGame.draw as Draw,
  flip: () => flipArtGame.draw as Draw,
  junction: () => junctionArtGame.draw as Draw,
  inkbridge: () => inkBridgeArtGame.draw as Draw,
  burst: (p) => burstArtGameFor(rev(p, "burstRev")).draw as Draw,
  swing: () => swingArtGame.draw as Draw,
  tilt: () => tiltArtGame.draw as Draw,
  whack: () => whackArtGame.draw as Draw,
  clayshoot: (p) => clayArtGameFor(rev(p, "clayRev")).draw as Draw,
  // Number polish (#47): the live Tenfall board draws through drawTenDrop on the presentation clock.
  tendrop: () =>
    ((ctx, state, size) =>
      drawTenDrop(
        ctx,
        state,
        size,
        canvasRatio(),
        performance.now(),
      )) as Draw,
  wordfall: () => wordfallArtGame.draw as Draw,
  // Speed & Attention polish (#48): Mixed Signals draws on the sim's lane grid through its art game.
  stroop: (p) => colourClashArtGameFor(clashVariantOf(p as never)).draw as Draw,
};

export function makePlaybackDrawer(puzzle: PuzzleData): PlaybackDrawer | null {
  const reveal = ARCADE_REVEAL_RENDERERS[puzzle.type];
  if (!reveal) return null;
  const worldW = reveal.worldW;
  const worldH = revealWorldH(reveal, puzzle);
  const size = { width: worldW, height: worldH };
  const base = { worldW, worldH, accent: reveal.accent };
  if (puzzle.type === "snip") {
    let camera: number | null = null;
    return {
      ...base,
      draw: (ctx, state: SnipState, jumped) => {
        const centred = state.sx / 256 - SNIP_CONFIG.viewW / 2;
        camera = snipCamera(
          state,
          jumped || camera === null ? centred : camera,
          jumped || camera === null ? 1 : 1 / 30,
        );
        drawSnipArt(
          ctx,
          state,
          { width: SNIP_CONFIG.viewW, height: snipWorldH(state) },
          undefined,
          camera,
        );
      },
    };
  }
  if (puzzle.type === "orbit") {
    return {
      ...base,
      draw: (ctx, state) => {
        if ((state as { rev?: number }).rev === 3) {
          orbitCameraObserve(state);
          orbitRewardObserve(state);
          orbitRev3ArtGame.draw(ctx, state, size);
        } else orbitArtGame.draw(ctx, state, size);
      },
    };
  }
  if (puzzle.type === "balltrack") {
    const course = (puzzle as unknown as { course: Parameters<typeof btArtDraw>[1] }).course;
    return { ...base, draw: (ctx, state) => btArtDraw(ctx, course, state) };
  }
  const draw = SIMPLE[puzzle.type]?.(puzzle);
  if (!draw) return null;
  return { ...base, draw: (ctx, state) => draw(ctx, state, size) };
}
