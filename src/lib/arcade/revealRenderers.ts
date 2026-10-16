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
import { breakerArtGameFor } from "./breaker.renderer";
import { breakerWorldHFor } from "./breaker";
import { rallyWorldHFor } from "./rally";
import { pinballArtGameFor } from "./pinball.renderer";
import { PIN_WORLD_H, PIN_WORLD_W } from "./pinball";
import { rallyArtGame as rallyGame, rallyRevealGame } from "./rally.renderer";
import { sliceGame, sliceWorldHFor } from "./slice";
import { sliceArtGame } from "./slice.renderer";
import { bubbleArtGame as bubbleGame } from "./bubble.renderer";
import { bubbleWorldHFor } from "./bubble";
import { beatArtGame as beatGame } from "./beat.renderer";
import { beatWorldHFor } from "./beat";
import { SNAKE_WORLD_H, SNAKE_WORLD_W, snakeWorldHForRev } from "./snake";
import { hoverWorldHFor } from "./hover";
import { skylineWorldHFor } from "./skyline";
import { snakeArtGame as snakeGame } from "./snake.renderer";
import { crossArtGame as crossGame, crossRevealGame } from "./cross.renderer";
import { wavShipY, wavefrontWorldHFor } from "./wavefront";
import { wavefrontArtGame as wavefrontGame } from "./wavefront.renderer";
import { flipArtGame as flipGame } from "./flipArt.renderer";
import { junctionArtGame as junctionGame, junctionRevealGame } from "./junction.renderer";
import { inkBridgeArtGame as inkBridgeGame } from "./inkBridge.renderer";
import { BURST_FLOOR_Y, burstWorldHFor } from "./burst";
import { burstArtGameFor } from "./burst.renderer";
import { orbitArtGame as orbitGame, orbitArtGameFor, orbitRev3ArtGame } from "./orbit.renderer";
import { decodeOrbitRun } from "@/lib/duel/orbit";
import { checkInputEvents } from "./engine";
import { ORBIT_REV3, ORBIT_REV4, ORBIT_REV_BAND, ORBIT_REV_SWEPT, ORBIT_REV_TALL, ORBIT_REV_TUNED } from "./orbit";
import { decodeOrbitHoles, decodeRev3Planets, initRev3From, initRev4From, initSweptFrom, initTallFrom, initTunedFrom, orbitWorldHFor, ORBIT_REV3_WORLD_W, type OrbitRev3State } from "./orbitRev3";
import { swingArtGame as swingGame } from "./swing.renderer";
import { drawSnipArt as drawSnip } from "./snip.renderer";
import { snipCamera, snipWorldH, snipWorldHFor, SNIP_CONFIG, SNIP_H, type SnipState } from "./snip";
import { tiltArtGame as tiltGame } from "./tiltArt.renderer";
import { btArtDraw } from "./ballTrackArt.renderer";
import { ballTrackWorldHFor, BT_H, BT_W, type BtState } from "./ballTrack";
import { swingWorldHFor } from "./swing";
import { whackArtGame as whackGame } from "./whack.renderer";
import { CLAY_H, CLAY_W, clayWorldHFor } from "./clayShoot";
import { clayArtGameFor } from './clayShoot.renderer';
import { TD_H, TD_W, type TenDropState } from "./tenDrop";
import { drawTenDrop } from "./tenDrop.renderer";
import { wfWorldHFor, wordfallGameFor, WF_H, WF_W } from "./wordfall";
import { wordfallArtGameFor } from "./wordfall.renderer";
import { loadWordfallDict, wordfallDictReady } from "./wordfallDict";
import { CLASH_WORLD_H, CLASH_WORLD_W, clashWorldHFor } from "./colourClash";
import { colourClashArtGameFor } from "./colourClash.renderer";

import { replayHoverRun } from "@/lib/duel/hover";
import { replaySkylineRun } from "@/lib/duel/skyline";
import { replayBinTossRun } from "@/lib/duel/binToss";
import { replayBullseyeRun } from "@/lib/duel/bullseye";
import { replayMatchupRun } from "@/lib/duel/matchup";
import { replayBreakerRun } from "@/lib/duel/breaker";
import { replayPinballRun } from "@/lib/duel/pinball";
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
import { replayWordfallRun } from "@/lib/duel/wordfall";
import { replayColourClashRun } from "@/lib/duel/colourClash";
import { clashVariantOf } from "@/lib/arcade/colourClash";

export interface ArcadeRevealRenderer {
  /** The game's own accent colour for tiles and the track. */
  accent: string;
  worldW: number;
  worldH: number;
  /** Tuning E: the world height of this stored round when it differs by revision (taller worlds); else worldH. */
  heightFor?: (puzzle: PuzzleData) => number;
  /** Draws the final tick into a worldW × revealWorldH(renderer, puzzle) context. */
  drawFinal: (ctx: CanvasRenderingContext2D, puzzle: PuzzleData, answer: string, presentation?: "reveal" | "demo") => { x: number; y: number } | null;
}

/** The world height a stored round's reveal and demo draw at (Tuning E's taller worlds by revision). */
export function revealWorldH(renderer: ArcadeRevealRenderer, puzzle: PuzzleData | null | undefined): number {
  return puzzle && renderer.heightFor ? renderer.heightFor(puzzle) : renderer.worldH;
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
  heightFor?: (puzzle: PuzzleData) => number,
): ArcadeRevealRenderer {
  return {
    accent,
    worldW,
    worldH,
    ...(heightFor ? { heightFor } : {}),
    drawFinal: (ctx, puzzle, answer, presentation = "reveal") => {
      const { state } = replay(puzzle, answer);
      (presentation === "demo" ? game : revealGame).draw(ctx, state, { width: worldW, height: heightFor ? heightFor(puzzle) : worldH });
      return focus ? focus(state) : null;
    },
  };
}

/**
 * Tenfall's play art at world size: drawTenDrop paints in CSS px on a canvas of
 * `ratio` device px each, so the ratio is the context's current uniform scale
 * (the reveal's devicePixelRatio, or the demo's dpr × fit scale).
 */
function drawTenDropArt(ctx: CanvasRenderingContext2D, state: TenDropState, size: { width: number; height: number }): void {
  const ratio = typeof ctx.getTransform === "function" ? ctx.getTransform().a || 1 : 1;
  drawTenDrop(ctx, state, size, ratio, typeof performance !== "undefined" ? performance.now() : 0);
}

const seedOf = (puzzle: PuzzleData): number => ("seed" in puzzle ? Number(puzzle.seed) : 1);

export const ARCADE_REVEAL_RENDERERS: Record<string, ArcadeRevealRenderer> = {
  hover: simple("#2ED3B7", 390, 560, hoverGame, (p, a) => replayHoverRun(seedOf(p), a, p.type === "hover" ? p.hoverRev : undefined), undefined, hoverRevealGame, (p) => hoverWorldHFor(p.type === "hover" ? p.hoverRev : undefined)),
  skyline: simple(GOLD, 390, 560, skylineGame, (p, a) => replaySkylineRun(seedOf(p), a, p.type === "skyline" ? p.skylineRev : undefined), undefined, skylineRevealGame, (p) => skylineWorldHFor(p.type === "skyline" ? p.skylineRev : undefined)),
  bintoss: simple("#2ED3B7", 390, 560, binTossGame, (p, a) => replayBinTossRun(seedOf(p), a, p.type === "bintoss" ? p.binRev : undefined)),
  bullseye: simple(GOLD, 390, 560, { draw: drawBullseye }, (p, a) =>
    replayBullseyeRun(seedOf(p), a, p.type === "bullseye" ? p.winds : [], p.type === "bullseye" ? p.bullRev : undefined),
  ),
  matchup: simple(GOLD, 390, 560, matchupGame, (p, a) => replayMatchupRun(seedOf(p), a, p.type === "matchup" ? p.matchupRev : undefined)),
  breaker: {
    accent: GOLD,
    worldW: 390,
    worldH: 620,
    heightFor: (p) => breakerWorldHFor(p.type === "breaker" ? p.brkRev : undefined),
    drawFinal: (ctx, p, a) => {
      const rev = p.type === "breaker" ? p.brkRev : undefined;
      breakerArtGameFor(rev).draw(ctx, replayBreakerRun(seedOf(p), a, rev).state, { width: 390, height: breakerWorldHFor(rev) });
      return null;
    },
  },
  pinball: simple("#FF4DFF", PIN_WORLD_W, PIN_WORLD_H, pinballArtGameFor(1), (p, a) => replayPinballRun(seedOf(p), a, p.type === "pinball" ? p.pinRev : undefined)),
  rally: simple("#4D8CFF", 390, 620, rallyGame, (p, a) => replayRallyRun(seedOf(p), a, p.type === "rally" ? p.rallyRev : undefined), undefined, rallyRevealGame, (p) => rallyWorldHFor(p.type === "rally" ? p.rallyRev : undefined)),
  slice: simple("#C9CED6", 390, 620, sliceArtGame, (p, a) => replaySliceRun(seedOf(p), a, p.type === "slice" ? p.sliceRev : undefined), undefined, undefined, (p) => sliceWorldHFor(p.type === "slice" ? p.sliceRev : undefined)),
  bubble: simple(GOLD, 390, 620, bubbleGame, (p, a) => replayBubbleRun(seedOf(p), a, p.type === "bubble" ? p.bubbleRev : undefined), undefined, undefined, (p) => bubbleWorldHFor(p.type === "bubble" ? p.bubbleRev : undefined)),
  beat: simple(GOLD, 390, 620, beatGame, (p, a) => replayBeatRun(seedOf(p), a, p.type === "beat" ? p.beatRev : undefined), undefined, undefined, (p) => beatWorldHFor(p.type === "beat" ? p.beatRev : undefined)),
  snake: simple("#2ED3B7", SNAKE_WORLD_W, SNAKE_WORLD_H, snakeGame, (p, a) => replaySnakeRun(seedOf(p), a, p.type === "snake" ? p.snakeRev : undefined), undefined, undefined, (p) => snakeWorldHForRev(p.type === "snake" ? p.snakeRev : undefined)),
  cross: simple("#2ED3B7", 390, 580, crossGame, (p, a) => replayCrossRun(seedOf(p), a, p.type === "cross" ? p.crossRev : undefined), undefined, crossRevealGame),
  wavefront: simple(
    "#A78BFA",
    390,
    620,
    wavefrontGame,
    (p, a) => replayWavefrontRun(seedOf(p), a, p.type === "wavefront" ? p.wavRev : undefined),
    (s) => ({ x: s.shipX, y: wavShipY(s) }),
    undefined,
    (p) => wavefrontWorldHFor(p.type === "wavefront" ? p.wavRev : undefined),
  ),
  flip: simple("#FF4D5E", 390, 620, flipGame, (p, a) => replayFlipRun(seedOf(p), a, p.type === "flip" ? p.flipRev : undefined)),
  junction: simple("#22C55E", 390, 620, junctionGame, (p, a) => replayJunctionRun(seedOf(p), a, p.type === "junction" ? p.junctionRev : undefined), undefined, junctionRevealGame),
  inkbridge: simple("#2ED3B7", 390, 620, inkBridgeGame, (p, a) => replayInkBridgeRun(seedOf(p), a, p.type === "inkbridge" ? p.inkRev : undefined)),
  burst: {
    accent: "#2ED3B7",
    worldW: 390,
    worldH: BURST_FLOOR_Y,
    heightFor: (p) => burstWorldHFor(p.type === "burst" ? p.burstRev : undefined),
    drawFinal: (ctx, p, a) => {
      const rev = p.type === "burst" ? p.burstRev : undefined;
      burstArtGameFor(rev).draw(ctx, replayBurstRun(seedOf(p), a, rev).state, { width: 390, height: burstWorldHFor(rev) });
      return null;
    },
  },
  orbit: {
    accent: GOLD,
    worldW: 390,
    worldH: 620,
    // orbitRev 8: the taller view.
    heightFor: (puzzle) => orbitWorldHFor(puzzle.type === "orbit" ? puzzle.orbitRev : undefined),
    drawFinal: (ctx, puzzle, answer) => {
      const { state } = replayOrbitRun(seedOf(puzzle), answer, puzzle.type === "orbit" ? puzzle.orbitRev : undefined, puzzle.type === "orbit" ? puzzle.planets : undefined, puzzle.type === "orbit" ? puzzle.holes : undefined);
      if (puzzle.type === "orbit" && (puzzle.orbitRev === ORBIT_REV3 || puzzle.orbitRev === ORBIT_REV4 || puzzle.orbitRev === ORBIT_REV_BAND || puzzle.orbitRev === ORBIT_REV_TUNED || puzzle.orbitRev === ORBIT_REV_SWEPT || puzzle.orbitRev === ORBIT_REV_TALL) && puzzle.planets) {
        // Visual reconstruction only: scoring above still uses the original replay.
        const run = decodeOrbitRun(answer);
        const checked = checkInputEvents(run.events, orbitRev3ArtGame.runTicks, orbitRev3ArtGame.inputRanges ?? []);
        const events = new Map(checked.events.map(event => [event.t, event]));
        let visual: OrbitRev3State =
          puzzle.orbitRev === ORBIT_REV_TALL
            ? initTallFrom(decodeRev3Planets(puzzle.planets), ORBIT_REV3_WORLD_W, decodeOrbitHoles(puzzle.holes ?? []))
            : puzzle.orbitRev === ORBIT_REV_SWEPT
            ? initSweptFrom(decodeRev3Planets(puzzle.planets), ORBIT_REV3_WORLD_W, decodeOrbitHoles(puzzle.holes ?? []))
            : puzzle.orbitRev === ORBIT_REV_TUNED
            ? initTunedFrom(decodeRev3Planets(puzzle.planets), ORBIT_REV3_WORLD_W, decodeOrbitHoles(puzzle.holes ?? []))
            : puzzle.orbitRev === ORBIT_REV4 || puzzle.orbitRev === ORBIT_REV_BAND
            ? initRev4From(decodeRev3Planets(puzzle.planets), ORBIT_REV3_WORLD_W, decodeOrbitHoles(puzzle.holes ?? []))
            : initRev3From(decodeRev3Planets(puzzle.planets), ORBIT_REV3_WORLD_W);
        for (let tick = 1; tick <= state.tick; tick++) visual = orbitRev3ArtGame.step(visual, events.get(tick) ?? null);
        orbitRev3ArtGame.draw(ctx, visual, { width: 390, height: orbitWorldHFor(puzzle.orbitRev) });
        return null;
      }
      // Dispatches on the replayed state's own rev field (rev3 draws via the
      // camera-scrolled renderer; rev1/2 stay byte-identical) rather than
      // puzzle data, so this keeps working once rev3 reaches the server.
      orbitArtGameFor(state).draw(ctx, state, { width: 390, height: 620 });
      return (state as { rev?: number }).rev === 3 ? null : { x: state.x / FP, y: (state.y - state.camY) / FP };
    },
  },
  swing: simple(GOLD, 390, 620, swingGame, (p, a) => replaySwingRun(seedOf(p), a, p.type === "swing" ? p.swingRev : undefined), undefined, undefined, (p) => swingWorldHFor(p.type === "swing" ? p.swingRev : undefined)),
  snip: {
    accent: "#E84A7F",
    worldW: SNIP_CONFIG.viewW,
    worldH: SNIP_H,
    heightFor: (puzzle) => snipWorldHFor(puzzle.type === "snip" ? puzzle.snipRev : undefined),
    drawFinal: (ctx, puzzle, answer) => {
      const state = replaySnipRun(seedOf(puzzle), answer, puzzle.type === "snip" ? puzzle.snipRev : undefined).state as SnipState;
      const camera = snipCamera(state, state.sx / FP - SNIP_CONFIG.viewW / 2, 1);
      drawSnip(ctx, state, { width: SNIP_CONFIG.viewW, height: snipWorldH(state) }, undefined, camera);
      return null;
    },
  },
  tilt: simple("#2EC4B6", 440, 470, tiltGame, (p, a) => replayTiltRun(seedOf(p), a, p.type === "tilt" ? p.tiltRev : undefined)),
  balltrack: {
    accent: GOLD,
    worldW: BT_W,
    worldH: BT_H,
    // btRev 4: the taller board.
    heightFor: (puzzle) => ballTrackWorldHFor(puzzle.type === "balltrack" ? puzzle.btRev : undefined),
    drawFinal: (ctx, puzzle, answer) => {
      if (puzzle.type !== "balltrack") return null;
      const state = replayBallTrackRun(puzzle.course, puzzle.seed, answer, puzzle.btRev).state as BtState;
      btArtDraw(ctx, puzzle.course, state);
      return null;
    },
  },
  whack: simple(GOLD, 390, 560, whackGame, (p, a) => replayWhackRun(seedOf(p), a)),
  clayshoot: {
    accent: "#E8762C",
    worldW: CLAY_W,
    worldH: CLAY_H,
    // clayRev 6: the taller sky.
    heightFor: (puzzle) => clayWorldHFor(puzzle.type === "clayshoot" ? puzzle.clayRev : undefined),
    drawFinal: (ctx, puzzle, answer) => {
      if (puzzle.type !== "clayshoot") return null;
      const state = replayClayRun(puzzle.seed, answer, puzzle.clayRev).state;
      clayArtGameFor(puzzle.clayRev).draw(ctx, state, { width: CLAY_W, height: clayWorldHFor(puzzle.clayRev) });
      return null;
    },
  },
  // Tenfall's polished board (tenDrop.renderer.ts), as in play; it draws in device px from the context's scale.
  tendrop: simple(GOLD, TD_W, TD_H, { draw: drawTenDropArt }, (p, a) => replayTenDropRun(seedOf(p), a)),
  wordfall: {
    accent: "#D4A84A",
    worldW: WF_W,
    worldH: WF_H,
    // wordfallRev 2 adds the Enter box under the well (a taller world).
    heightFor: (puzzle) => wfWorldHFor(puzzle.type === "wordfall" ? puzzle.wordfallRev : undefined),
    drawFinal: (ctx, puzzle, answer) => {
      if (puzzle.type !== "wordfall") return null;
      const rev = puzzle.wordfallRev;
      // The final well needs the word list; without it (a cold reload) draw the start well and fetch it.
      const state = wordfallDictReady()
        ? replayWordfallRun(puzzle.seed, answer, rev).state
        : (void loadWordfallDict().catch(() => undefined), wordfallGameFor(rev).init(puzzle.seed));
      wordfallArtGameFor(rev).draw(ctx, state, { width: WF_W, height: wfWorldHFor(rev) });
      return null;
    },
  },
  // Mixed Signals' polished lane board (colourClash.renderer.ts), as in play.
  stroop: {
    accent: GOLD,
    worldW: CLASH_WORLD_W,
    worldH: CLASH_WORLD_H,
    // clashRev 5: the taller board.
    heightFor: (p) => clashWorldHFor(p.type === "stroop" ? clashVariantOf(p) : 0),
    drawFinal: (ctx, p, a) => {
      const variant = p.type === "stroop" ? clashVariantOf(p) : 0;
      colourClashArtGameFor(variant).draw(ctx, replayColourClashRun(seedOf(p), a, variant).state, { width: CLASH_WORLD_W, height: clashWorldHFor(variant) });
      return null;
    },
  },
};
