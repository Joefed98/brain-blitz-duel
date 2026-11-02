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
import { binTossIsExpand, BINTOSS_V7_WORLD_H, BINTOSS_V7_WORLD_W } from "./binToss";
import { matchupArtGame as matchupGame } from "./matchup.renderer";
import { matchupWorldHFor } from "./matchup";
import { breakerArtGameFor } from "./breaker.renderer";
import { breakerWorldHFor, breakerWorldWFor } from "./breaker";
import { rallyWorldHFor, rallyWorldWFor } from "./rally";
import { BULLSEYE_V8_WORLD_H, bullseyeTallRev } from "./bullseye";
/** A stored round's world height in the reveal's 390-wide box: the 420-wide expansion court (brkRev 9) scales down whole. */
const in390 = (w: number, h: number) => (w === 390 ? h : Math.round((h * 390) / w));
import { drawPinballAny, pinballWorldHFor } from "./pinball4.renderer";
import { PIN_WORLD_H, PIN_WORLD_W } from "./pinball";
import { rallyArtGame as rallyGame, rallyRevealGame } from "./rally.renderer";
import { sliceGame, sliceWorldHFor, SLICE_REV_BIG, SLICE_REV_EXPAND, SLICE_REV_STANDARD, SLICE_V9_H, SLICE_V9_W } from "./slice";
import { sliceArtGame } from "./slice.renderer";
import { bubbleArtGame as bubbleGame } from "./bubble.renderer";
import { bubbleWorldHFor } from "./bubble";
import { beatArtGame as beatGame } from "./beat.renderer";
import { beatWorldHFor } from "./beat";
import { SNAKE_WORLD_H, SNAKE_WORLD_W, snakeWorldHForRev } from "./snake";
import { hoverWorldHFor } from "./hover";
import { inkWorldHFor } from "./inkBridge";
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
import { orbitArtGame as orbitGame, orbitArtGameFor, orbitDrawHFor, orbitRev3ArtGame } from "./orbit.renderer";
import { decodeOrbitRun } from "@/lib/duel/orbit";
import { checkInputEvents } from "./engine";
import { ORBIT_REV3, ORBIT_REV4, ORBIT_REV_BAND, ORBIT_REV_SWEPT, ORBIT_REV_TALL, ORBIT_REV_TARGET, ORBIT_REV_STRICT, ORBIT_REV_TUNED, ORBIT_REV_XP, orbitXpRev } from "./orbit";
import { decodeOrbitHoles, decodeRev3Planets, initRev3From, initRev4From, initSweptFrom, initTallFrom, initTargetFrom, initStrictFrom, initTunedFrom, orbitStartForPuzzle, orbitWorldHFor, orbitWorldWFor, ORBIT_REV3_WORLD_W, type OrbitRev3State } from "./orbitRev3";
import { swingArtGame as swingGame } from "./swing.renderer";
import { drawSnipArt as drawSnip } from "./snip.renderer";
import { snipCamera, snipWorldH, snipWorldHFor, SNIP_CONFIG, SNIP_H, type SnipState } from "./snip";
import { tiltArtGame as tiltGame } from "./tiltArt.renderer";
import { btArtDraw } from "./ballTrackArt.renderer";
import { ballTrackWorldHFor, BT_H, BT_W, type BtState } from "./ballTrack";
import { swingRevealHFor } from "./swing";
import { flipWorldHFor } from "./flip";
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
import { replayHomerunRun } from "@/lib/duel/homerun";
import { replayFreekickRun } from "@/lib/duel/freekick";
import { replayRacingRun } from "@/lib/duel/racing";
import { homerunArtGame } from "./homerun.renderer";
import { freekickArtGame } from "./freekick.renderer";
import { racingArtGame } from "./racing.renderer";
import { HOMERUN_WORLD_H, HOMERUN_WORLD_W } from "./homerun";
import { FREEKICK_WORLD_H, FREEKICK_WORLD_W } from "./freekick";
import { RACING_WORLD_H, RACING_WORLD_W } from "./racing";
import { replayBinTossRun } from "@/lib/duel/binToss";
import { replayBullseyeRun } from "@/lib/duel/bullseye";
import { replayMatchupRun } from "@/lib/duel/matchup";
import { replayBreakerRun } from "@/lib/duel/breaker";
import { replayPinballRun } from "@/lib/duel/pinball";
import { replayMinesweeperRun } from "@/lib/duel/minesweeper";
import { replayMahjongRun } from "@/lib/duel/mahjong";
import { drawMinesweeper } from "./minesweeper.renderer";
import { drawMahjong } from "./mahjong.renderer";
import { MINES_WORLD_H, MINES_WORLD_W } from "./minesweeper";
import { MAHJONG_WORLD_H, MAHJONG_WORLD_W } from "./mahjong";
import { replayFiveHandsRun, replayFreecellRun, replayPokerSquaresRun, replayTripeaksRun } from "@/lib/duel/cards";
import { freecellArt, FC_WORLD_H, FC_WORLD_W } from "./cards/freecell.renderer";
import { tripeaksArt, TP_WORLD_H, TP_WORLD_W } from "./cards/tripeaks.renderer";
import { pokerSquaresArt, PS_WORLD_H, PS_WORLD_W } from "./cards/pokerSquares.renderer";
import { fiveHandsArt, FH_WORLD_H, FH_WORLD_W } from "./cards/fiveHands.renderer";
import { replayMinigolfRun } from "@/lib/duel/minigolf";
import { replayPoolRun } from "@/lib/duel/pool";
import { replayCurlingRun } from "@/lib/duel/curling";
import { replayBlockfallRun } from "@/lib/duel/blockfall";
import { replayAlleyRollRun } from "@/lib/duel/alleyroll";
import { blockfallArt, BF_WORLD_H, BF_WORLD_W } from "./blockfall.renderer";
import { alleyRollArt, AR_WORLD_H, AR_WORLD_W } from "./alleyroll.renderer";
import { drawCurling } from "./curling.renderer";
import { CURLING_H, CURLING_W, curlingWorldHFor, type CurlingState } from "./curling";
import { drawPool } from "./pool.renderer";
import { POOL_H, POOL_W, type PoolState } from "./pool";
import { drawMinigolf } from "./minigolf.renderer";
import { MINIGOLF_H, MINIGOLF_W, type MinigolfState } from "./minigolf";
import { replayRallyRun } from "@/lib/duel/rally";
import { replaySliceRun } from "@/lib/duel/slice";
import { replayBubbleRun } from "@/lib/duel/bubble";
import { replayBeatRun } from "@/lib/duel/beat";
import { replaySnakeRun } from "@/lib/duel/snake";
import { replayCrossRun } from "@/lib/duel/cross";
import { crossWorldHFor } from "./cross";
import { replayWavefrontRun } from "@/lib/duel/wavefront";
import { replayFlipRun } from "@/lib/duel/flip";
import { replayJunctionRun } from "@/lib/duel/junction";
import { replayInkBridgeRun } from "@/lib/duel/inkBridge";
import { replayBurstRun } from "@/lib/duel/burst";
import { replayOrbitRun } from "@/lib/duel/orbit";
import { replaySwingRun } from "@/lib/duel/swing";
import { replaySnipRun } from "@/lib/duel/snip";
import { replayTiltRun } from "@/lib/duel/tilt";
import { tiltWorldHFor } from "./tilt";
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
  // The Sports group (30 Oct 2026): each game's final frame at world size.
  homerun: simple(GOLD, HOMERUN_WORLD_W, HOMERUN_WORLD_H, homerunArtGame, (p, a) => replayHomerunRun(seedOf(p), a, p.type === "homerun" ? p.homerunRev : undefined)),
  freekick: simple(GOLD, FREEKICK_WORLD_W, FREEKICK_WORLD_H, freekickArtGame, (p, a) => replayFreekickRun(seedOf(p), a, p.type === "freekick" ? p.freekickRev : undefined)),
  racing: simple(GOLD, RACING_WORLD_W, RACING_WORLD_H, racingArtGame, (p, a) => replayRacingRun(seedOf(p), a, p.type === "racing" ? p.racingRev : undefined)),
  // Cards & Board: the final table, drawn by the game's own art.
  freecell: simple(GOLD, FC_WORLD_W, FC_WORLD_H, freecellArt, (p, a) => replayFreecellRun(seedOf(p), a, p.type === "freecell" ? p.freecellRev : undefined)),
  tripeaks: simple(GOLD, TP_WORLD_W, TP_WORLD_H, tripeaksArt, (p, a) => replayTripeaksRun(seedOf(p), a)),
  pokersquares: simple(GOLD, PS_WORLD_W, PS_WORLD_H, pokerSquaresArt, (p, a) => replayPokerSquaresRun(seedOf(p), a, p.type === "pokersquares" ? p.pokerSquaresRev : undefined)),
  fivehands: simple(GOLD, FH_WORLD_W, FH_WORLD_H, fiveHandsArt, (p, a) => replayFiveHandsRun(seedOf(p), a, p.type === "fivehands" ? p.fiveHandsRev : undefined)),
  blockfall: simple(GOLD, BF_WORLD_W, BF_WORLD_H, blockfallArt, (p, a) => replayBlockfallRun(seedOf(p), a, p.type === "blockfall" ? p.blockfallRev : undefined)),
  alleyroll: simple(GOLD, AR_WORLD_W, AR_WORLD_H, alleyRollArt, (p, a) => replayAlleyRollRun(seedOf(p), a, p.type === "alleyroll" ? p.alleyRollRev : undefined)),
  hover: simple("#2ED3B7", 390, 560, hoverGame, (p, a) => replayHoverRun(seedOf(p), a, p.type === "hover" ? p.hoverRev : undefined), undefined, hoverRevealGame, (p) => hoverWorldHFor(p.type === "hover" ? p.hoverRev : undefined)),
  skyline: simple(GOLD, 390, 560, skylineGame, (p, a) => replaySkylineRun(seedOf(p), a, p.type === "skyline" ? p.skylineRev : undefined), undefined, skylineRevealGame, (p) => skylineWorldHFor(p.type === "skyline" ? p.skylineRev : undefined)),
  // binRev 7: the wider fairground (430 × 728) drawn at 390 wide, so 660 tall.
  bintoss: simple("#2ED3B7", 390, 560, binTossGame, (p, a) => replayBinTossRun(seedOf(p), a, p.type === "bintoss" ? p.binRev : undefined), undefined, undefined,
    (p) => (p.type === "bintoss" && binTossIsExpand(p.binRev) ? Math.round((390 * BINTOSS_V7_WORLD_H) / BINTOSS_V7_WORLD_W) : 560)),
  bullseye: simple(GOLD, 390, 560, { draw: drawBullseye }, (p, a) =>
    replayBullseyeRun(seedOf(p), a, p.type === "bullseye" ? p.winds : [], p.type === "bullseye" ? p.bullRev : undefined),
    // bullRev 8 (expansion E9) and 9 (the scoring standard): the taller range.
    undefined, undefined, (p) => (p.type === "bullseye" && bullseyeTallRev(p.bullRev) ? BULLSEYE_V8_WORLD_H : 560),
  ),
  matchup: simple(GOLD, 390, 560, matchupGame, (p, a) => replayMatchupRun(seedOf(p), a, p.type === "matchup" ? p.matchupRev : undefined), undefined, undefined, (p) => matchupWorldHFor(p.type === "matchup" ? p.matchupRev : undefined)),
  breaker: {
    accent: GOLD,
    worldW: 390,
    worldH: 620,
    heightFor: (p) => in390(breakerWorldWFor(p.type === "breaker" ? p.brkRev : undefined), breakerWorldHFor(p.type === "breaker" ? p.brkRev : undefined)),
    drawFinal: (ctx, p, a) => {
      const rev = p.type === "breaker" ? p.brkRev : undefined;
      breakerArtGameFor(rev).draw(ctx, replayBreakerRun(seedOf(p), a, rev).state, { width: 390, height: in390(breakerWorldWFor(rev), breakerWorldHFor(rev)) });
      return null;
    },
  },
  // pinRev 4 (E4) draws its own taller table (drawPinballAny reads the state's revision).
  // The Sports group (30 Oct 2026): each final state drawn by its own art, without the aim.
  minigolf: simple("#7FD58A", MINIGOLF_W, MINIGOLF_H, { draw: (ctx, s: MinigolfState) => drawMinigolf(ctx, s, null) }, (p, a) => replayMinigolfRun(seedOf(p), a, p.type === "minigolf" ? p.pars : undefined, p.type === "minigolf" ? p.golfRev : undefined)),
  // curlRev 2 draws a shorter world (390 × 540; display only).
  curling: simple("#E8C35A", CURLING_W, CURLING_H, { draw: (ctx, s: CurlingState) => drawCurling(ctx, s, null) }, (p, a) => replayCurlingRun(seedOf(p), a, p.type === "curling" ? p.curlRev : undefined), undefined, undefined, (p) => curlingWorldHFor(p.type === "curling" ? p.curlRev : undefined)),
  pool: simple("#3FA672", POOL_W, POOL_H, { draw: (ctx, s: PoolState) => drawPool(ctx, s, null) }, (p, a) => replayPoolRun(seedOf(p), a, p.type === "pool" ? p.poolRev : undefined)),
  pinball: simple("#FF4DFF", PIN_WORLD_W, PIN_WORLD_H, { draw: drawPinballAny }, (p, a) => replayPinballRun(seedOf(p), a, p.type === "pinball" ? p.pinRev : undefined), undefined, undefined, (p) => pinballWorldHFor(p.type === "pinball" ? p.pinRev : undefined)),
  // Cards & Board (30 Oct 2026): the final board as the run left it.
  minesweeper: simple("#F2C75C", MINES_WORLD_W, MINES_WORLD_H, { draw: drawMinesweeper }, (p, a) => replayMinesweeperRun(seedOf(p), a, p.type === "minesweeper" ? p.minesRev : undefined)),
  mahjong: simple("#F2C75C", MAHJONG_WORLD_W, MAHJONG_WORLD_H, { draw: drawMahjong }, (p, a) => replayMahjongRun(seedOf(p), a, p.type === "mahjong" ? p.mahjongRev : undefined)),
  rally: simple("#4D8CFF", 390, 620, rallyGame, (p, a) => replayRallyRun(seedOf(p), a, p.type === "rally" ? p.rallyRev : undefined), undefined, rallyRevealGame, (p) => in390(rallyWorldWFor(p.type === "rally" ? p.rallyRev : undefined), rallyWorldHFor(p.type === "rally" ? p.rallyRev : undefined))),
  slice: simple("#C9CED6", 390, 620, sliceArtGame, (p, a) => replaySliceRun(seedOf(p), a, p.type === "slice" ? p.sliceRev : undefined), undefined, undefined, (p) => (p.type === "slice" && (p.sliceRev === SLICE_REV_EXPAND || p.sliceRev === SLICE_REV_BIG || p.sliceRev === SLICE_REV_STANDARD) ? Math.round((390 * SLICE_V9_H) / SLICE_V9_W) : sliceWorldHFor(p.type === "slice" ? p.sliceRev : undefined))),
  bubble: simple(GOLD, 390, 620, bubbleGame, (p, a) => replayBubbleRun(seedOf(p), a, p.type === "bubble" ? p.bubbleRev : undefined), undefined, undefined, (p) => bubbleWorldHFor(p.type === "bubble" ? p.bubbleRev : undefined)),
  beat: simple(GOLD, 390, 620, beatGame, (p, a) => replayBeatRun(seedOf(p), a, p.type === "beat" ? p.beatRev : undefined), undefined, undefined, (p) => beatWorldHFor(p.type === "beat" ? p.beatRev : undefined)),
  snake: simple("#2ED3B7", SNAKE_WORLD_W, SNAKE_WORLD_H, snakeGame, (p, a) => replaySnakeRun(seedOf(p), a, p.type === "snake" ? p.snakeRev : undefined), undefined, undefined, (p) => snakeWorldHForRev(p.type === "snake" ? p.snakeRev : undefined)),
  cross: simple("#2ED3B7", 390, 580, crossGame, (p, a) => replayCrossRun(seedOf(p), a, p.type === "cross" ? p.crossRev : undefined), undefined, crossRevealGame, (p) => crossWorldHFor(p.type === "cross" ? p.crossRev : undefined)),
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
  // flipRev 8 (the expansion): the 730 px cave.
  flip: simple("#FF4D5E", 390, 620, flipGame, (p, a) => replayFlipRun(seedOf(p), a, p.type === "flip" ? p.flipRev : undefined), undefined, undefined, (p) => flipWorldHFor(p.type === "flip" ? p.flipRev : undefined)),
  junction: simple("#22C55E", 390, 620, junctionGame, (p, a) => replayJunctionRun(seedOf(p), a, p.type === "junction" ? p.junctionRev : undefined), undefined, junctionRevealGame),
  inkbridge: simple("#2ED3B7", 390, 620, inkBridgeGame, (p, a) => replayInkBridgeRun(seedOf(p), a, p.type === "inkbridge" ? p.inkRev : undefined), undefined, inkBridgeGame, (p) => inkWorldHFor(p.type === "inkbridge" ? p.inkRev : undefined)),
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
    // orbitRev 8: the taller view; orbitRev 12: the wider 450 × 782 view, drawn into the 390-wide box at its own aspect.
    heightFor: (puzzle) => {
      const rev = puzzle.type === "orbit" ? puzzle.orbitRev : undefined;
      // orbitRev 12 is drawn taller than its framed view (orbitDrawHFor, display only).
      return in390(orbitWorldWFor(rev), orbitDrawHFor(rev));
    },
    drawFinal: (ctx, puzzle, answer) => {
      const { state } = replayOrbitRun(seedOf(puzzle), answer, puzzle.type === "orbit" ? puzzle.orbitRev : undefined, puzzle.type === "orbit" ? puzzle.planets : undefined, puzzle.type === "orbit" ? puzzle.holes : undefined, puzzle.type === "orbit" ? puzzle.extras : undefined);
      const xpStart = puzzle.type === "orbit" && orbitXpRev(puzzle.orbitRev) ? orbitStartForPuzzle(puzzle) : null;
      if (xpStart) {
        // Visual reconstruction through the art sim (camera and effects observe every tick), as below.
        const run = decodeOrbitRun(answer);
        const checked = checkInputEvents(run.events, orbitRev3ArtGame.runTicks, orbitRev3ArtGame.inputRanges ?? []);
        const events = new Map(checked.events.map((event) => [event.t, event]));
        let visual: OrbitRev3State = xpStart();
        for (let tick = 1; tick <= state.tick; tick++) visual = orbitRev3ArtGame.step(visual, events.get(tick) ?? null);
        orbitRev3ArtGame.draw(ctx, visual, { width: 390, height: in390(orbitWorldWFor(ORBIT_REV_XP), orbitDrawHFor(ORBIT_REV_XP)) });
        return null;
      }
      if (puzzle.type === "orbit" && (puzzle.orbitRev === ORBIT_REV3 || puzzle.orbitRev === ORBIT_REV4 || puzzle.orbitRev === ORBIT_REV_BAND || puzzle.orbitRev === ORBIT_REV_TUNED || puzzle.orbitRev === ORBIT_REV_SWEPT || puzzle.orbitRev === ORBIT_REV_TALL || puzzle.orbitRev === ORBIT_REV_TARGET || puzzle.orbitRev === ORBIT_REV_STRICT) && puzzle.planets) {
        // Visual reconstruction only: scoring above still uses the original replay.
        const run = decodeOrbitRun(answer);
        const checked = checkInputEvents(run.events, orbitRev3ArtGame.runTicks, orbitRev3ArtGame.inputRanges ?? []);
        const events = new Map(checked.events.map(event => [event.t, event]));
        let visual: OrbitRev3State =
          puzzle.orbitRev === ORBIT_REV_STRICT
            ? initStrictFrom(decodeRev3Planets(puzzle.planets), ORBIT_REV3_WORLD_W, decodeOrbitHoles(puzzle.holes ?? []))
            : puzzle.orbitRev === ORBIT_REV_TARGET
            ? initTargetFrom(decodeRev3Planets(puzzle.planets), ORBIT_REV3_WORLD_W, decodeOrbitHoles(puzzle.holes ?? []))
            : puzzle.orbitRev === ORBIT_REV_TALL
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
  swing: simple(GOLD, 390, 620, swingGame, (p, a) => replaySwingRun(seedOf(p), a, p.type === "swing" ? p.swingRev : undefined), undefined, undefined, (p) => swingRevealHFor(p.type === "swing" ? p.swingRev : undefined)),
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
  // tiltRev 8: the taller world (the art draws the expansion's camera from the state).
  tilt: simple("#2EC4B6", 440, 470, tiltGame, (p, a) => replayTiltRun(seedOf(p), a, p.type === "tilt" ? p.tiltRev : undefined), undefined, tiltGame, (p) => tiltWorldHFor(p.type === "tilt" ? p.tiltRev : undefined)),
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
  whack: simple(GOLD, 390, 560, whackGame, (p, a) => replayWhackRun(seedOf(p), a, p.type === "whack" ? p.whackRev : undefined)),
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
  // tenRev 4 (gold tiles) rides in the start state, so the final board shows its gold tiles.
  tendrop: simple(GOLD, TD_W, TD_H, { draw: drawTenDropArt }, (p, a) => replayTenDropRun(seedOf(p), a, p.type === "tendrop" ? p.tenRev : undefined)),
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
