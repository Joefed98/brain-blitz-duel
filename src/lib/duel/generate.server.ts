/**
 * Server-only puzzle building and grading. Types whose content needs the
 * dictionary or a solver (Wordsmith, Word Hunt, Unblock, Block Party) are
 * handled here, so nothing answer-shaped is ever reachable from a client bundle.
 */

import { generateAlleyRoll, generateCurling, generateMinigolf, generatePool } from "./sports.server";
import { generateBlockfall } from "./arcade.server";
import { SPEED_PAR_VERSION } from "./speedPar";
import { PUZZLE_SCORE_REV_DEALT, dealtPuzzleScoreRev, puzzleScoreRevOf } from "./puzzleScoreRev";
import { stampNumberDepth } from "./numberDepth.server";
import { WORDHUNT_REV_TARGET, WORDSMITH_REV_DEPTH, WORDSMITH_REV_TARGET, WORDSMITH_REV_TOPUP } from "./scoring";
import { dealtTopupRev } from "./depthTopup";
import { dealStandard } from "./standard/stamps";
import { dealPuzzleNotes } from "./puzzleNotes";
import { dealParMoves } from "./parMoves";
import { dealPipesPlaced } from "./speedPipesNov7";
import { dealOperatorGaps } from "./operatorGaps.server";
import { dealWordNov7 } from "./wordNov7";
import { withDealOptions, type DealOptions } from "./dealEra";
import { dealPartialCredit } from "./partialCredit";
import { topsyPlainRoutes } from "./topsy.server";
import { varyTallyTray } from "@/puzzles/countUp";
import { stampMoveLimits } from "./moveLimits.server";
import { stampTieRev } from "./tieBreak";
import { dealDepth4 } from "./depth4/deal.server";
import { dealtDepthRev } from "./wordDepth";
import { stampTileGridRev } from "./tileGrid";
import { STRIKEOUT_REV4, STRIKEOUT_REV5, STRIKEOUT_REV_TOPUP } from "./strikeout";
import { generateBlockParty } from "./blockParty.server";
import { newRoomSeed, pickRoundOrder, type RoundSelectionOptions } from "./selection";
import { drawBankedPuzzle, isBankedType } from "./puzzleBank.server";
import { puzzleDef } from "./registry";
import { TOTAL_ROUNDS, type PuzzleData, type PuzzleType } from "./types";
import { generateUnblock, type UnblockBankRow } from "./unblock.server";
import { generateWordHunt, generateWordHuntDepth } from "./wordHunt.server";
import { WORDHUNT_REV_DEPTH } from "./wordHunt";
import { generateWordsmith } from "./wordsmith.server";
import { generateTileGrid } from "./tileGrid.server";
import { generateWordSlide } from "./wordSlide.server";
import { generateBalance } from "./numberRounds.server";
import { generateLightsOut, generatePipes, generateSudoku } from "./logic.server";
import { generateFlow } from "./flow.server";
import { generateIceSlide } from "./slide.server";
import { generatePush } from "./push.server";
import { generateLaser } from "./laser.server";
import { generateTower } from "./tower.server";
import { generateMaze } from "./maze.server";
import { generateTubes } from "./tubes.server";
import { generateSafe } from "./safe.server";
import { generateBomb } from "./bomb.server";
import { generateGravity } from "./gravity.server";
import { generateTiles } from "./tiles.server";
import { dealsD5Remodels } from "./d5Remodels";
import { generateTopsy } from "./topsy.server";
import { generateJumbledDealt } from "./jumbled.server";
import { generateChain } from "./chain.server";
import { generateNonogram } from "./nonogram.server";
import { generatePairMatch } from "./pairmatch.server";
import { generateFlood } from "./flood.server";
import { generateRings } from "./rings.server";
import { generateHover } from "./hover.server";
import { generateFreekick, generateHomerun, generateRacing } from "./sports.server";
import {
  generateBinToss,
  generateBullseye,
  generateMatchup,
  generateMinesweeper,
  generateMahjong,
  generateCross,
  generateDual,
  generateRicochet,
  generateBreaker,
  generatePinball,
  generateFreecell,
  generateTripeaks,
  generatePokerSquares,
  generateFiveHands,
  generatePyramid,
  generateGolfSol,
  generateMuggins,
  generateRally,
  generateSteady,
  generateSlice,
  generateBubble,
  generateBeat,
  generateSkyline,
  generateSnake,
  generateSwerve,
  generateWhack,
  generateTenDrop,
  generateWordfall,
  generateClayShoot,
  generateWavefront,
  generateBastion,
  generateRooftop,
  generateFlip,
  generateJunction,
  generateInkBridge,
  generateBurst,
  generateOrbit,
  generateSwing,
  generateSnip,
  generateTilt,
  generateHotFloor,
  generateColourClash,
} from "./arcade.server";
import { generateTents } from "./tents.server";
import { generateShikaku } from "./shikaku.server";
import { generateLightUp } from "./lightUp.server";
import { generateBallTrack } from "./ballTrack.server";
import { generateNumberPyramid } from "./numberPyramid.server";
import { generateTrail } from "./trail.server";
import { generateDig } from "./dig.server";
import { generateWordSearch } from "./wordSearch.server";
import { generateLetterWheel } from "./letterWheel.server";
import { generateStrikeout } from "./strikeout.server";
import { generateCodeword } from "./codeword.server";
import { generateSwapword } from "./swapword.server";
import { wordGameSeed } from "./wordSeed.server";
import { generateMeasure } from "./measure.server";
import { generateCheckout } from "./checkout.server";
import { generateNumline } from "./numline.server";
import { generateFences } from "./fences.server";
import { generateFillomino } from "./fillomino.server";
import { generateBridges } from "./bridges.server";
import { generateKakuro } from "./kakuro.server";
import { randomBelow } from "./random";
import { saltSeed } from "./seededRng";

/** Room-level context a generator may need beyond its own randomness. */
export interface GenerateContext {
  /** A pre-drawn Unblock bank row, so building a room never runs a solver. */
  unblockRow?: UnblockBankRow | null;
  /**
   * Draw the six slow puzzle types (see puzzleBank.server.ts) from their
   * precomputed bank with this seed instead of generating live. Room start
   * passes the room seed; practice passes a fresh one. Omitted: live generation
   * (the fixed intro examples and the checks rely on that).
   */
  bankSeed?: number;
  /** Public identities (`bankKey`) of banked boards the host played recently. */
  recentBankKeys?: ReadonlySet<string> | undefined;
}

/**
 * The deal's layers after the base stamps, in the order they apply (B4, docs/audit-nov-2026/architecture.md): each
 * moves a game's live stamp up for one change and keeps its own code for the older stamps; a check that pins one of
 * them (dealEra.ts) gets the deal from before that change. Only puzzles on today's score revision reach them.
 */
export const DEAL_LAYERS: readonly { name: string; deal: (puzzle: PuzzleData) => PuzzleData }[] = [
  // The scoring standard (standard/stamps.ts): the game's live stamp moves up by one.
  { name: "standard", deal: dealStandard },
  // The Speed / Pipeline fix (7 Nov 2026, speedPipesNov7.ts): Pipeline's placed-tile credit.
  { name: "pipesPlaced", deal: dealPipesPlaced },
  // Joe's puzzle notes (28 Oct 2026, puzzleNotes.ts): Slider and Tally one stamp above the standard's.
  { name: "puzzleNotes", deal: (p) => dealPuzzleNotes(p, (q) => (q.type === "countup" ? varyTallyTray(q) : q)) },
  // The puzzle batch of 3 Nov 2026 (parMoves.ts): Labyrinth, Topsy-Turvy and Skid one stamp above the standard's,
  // their collectibles gone.
  { name: "parMoves", deal: (p) => dealParMoves(p, (q) => (q.type === "gravity" ? topsyPlainRoutes(q) : q)) },
  // Puzzle polish (3 Nov 2026, operatorGaps.ts): Operator's sign, number and mixed gaps one stamp above the standard's.
  { name: "operatorGaps", deal: dealOperatorGaps },
  // Partial-credit fixes (7 Nov 2026, partialCredit.ts): Blackout, Hanoi, Polypotions, Gridlock, Turntable, Exact and
  // Gradient one stamp above the one dealt before.
  { name: "partialCredit", deal: dealPartialCredit },
  // The Word scoring fix (7 Nov 2026, wordNov7.ts): Interlock, Slider and Lookout one stamp above (Slider above the notes).
  { name: "wordNov7", deal: dealWordNov7 },
];

/**
 * The one place a game's deal is decided. Every new puzzle is stamped with the speed-par scoring version and the
 * puzzle score shape (puzzleScoreRev.ts), then passes through DEAL_LAYERS; stored rounds without the stamps keep the
 * legacy curve and shape. With nothing pinned (dealEra.ts `activeDealPins`), its version stamps are the game's dealt
 * signature (dealSignature.ts `dealtSignature`). `options` deals an older era for this call only (checks and tools),
 * restoring the eras after.
 */
export function generatePuzzle(type: PuzzleType, context: GenerateContext = {}, options?: DealOptions): PuzzleData {
  return withDealOptions(options, () => dealLive(type, context));
}

function dealLive(type: PuzzleType, context: GenerateContext): PuzzleData {
  // The seven games with a 13 Oct 2026 limit or count-range revision carry their own stamp (moveLimits.ts).
  const made = stampMoveLimits(generateUnstamped(type, context));
  // Number puzzles to 200 (numberDepth.ts) carry depthRev 1 on puzzleScoreRev 3.
  const stamped = stampNumberDepth({ ...(made as object), speedPar: SPEED_PAR_VERSION, puzzleScoreRev: dealtPuzzleScoreRev() } as unknown as PuzzleData);
  // The layers move stamps up on today's score revision only.
  if (puzzleScoreRevOf(stamped) !== PUZZLE_SCORE_REV_DEALT) return stamped;
  return DEAL_LAYERS.reduce((puzzle, layer) => layer.deal(puzzle), stamped);
}

function generateUnstamped(type: PuzzleType, context: GenerateContext): PuzzleData {
  // The D5 remodels are dealt live (Topsy-Turvy's old bank stays for its checks and stored rounds; checks written
  // for the previous versions pin the old deal, d5Remodels.ts).
  if (type === "gravity" && dealsD5Remodels()) return generateTopsy();
  if (type === "tiles" && dealsD5Remodels()) return generateJumbledDealt();
  // Depth batch 4 (docs/depth/d4-pattern.md): eight Pattern / Logic games deal their 200-point stamp.
  const depth = dealDepth4(type, context);
  if (depth) return depth;
  if (context.bankSeed !== undefined && isBankedType(type))
    return drawBankedPuzzle(type, context.bankSeed, context.recentBankKeys);
  if (type === "stroop") return generateColourClash();
  // Nucleus and Forage carry their scoring-targets stamp (18 Oct 2026; scoring.ts WORDSMITH_V1_CURVE, WORDHUNT_V1_CURVE).
  // Word depth (25 Oct 2026): Nucleus deals wordsmithRev 3 (the curve to 200 and the pangram bonus).
  // The puzzle top-up (26 Oct 2026): wordsmithRev 4, rev 3's curve a little steeper above 45 points.
  if (type === "wordsmith") return { ...generateWordsmith(), wordsmithRev: dealtDepthRev(dealtTopupRev(WORDSMITH_REV_TOPUP, WORDSMITH_REV_DEPTH), WORDSMITH_REV_TARGET) };
  // Forage wordHuntRev 3 (word depth, 25 Oct 2026; wordHunt.ts): the 6×6 board with its golden tile.
  if (type === "wordhunt") return dealtDepthRev(WORDHUNT_REV_DEPTH, WORDHUNT_REV_TARGET) >= WORDHUNT_REV_DEPTH ? generateWordHuntDepth() : { ...generateWordHunt(), wordHuntRev: WORDHUNT_REV_TARGET };
  if (type === "unblock") return generateUnblock(context.unblockRow);
  if (type === "blockparty") return generateBlockParty();
  // Word depth (25 Oct 2026): Interlock tileGridRev 1 scores to 200 (depth/tilegrid.server.ts); the board is unchanged.
  if (type === "tilegrid") return stampTileGridRev(generateTileGrid());
  if (type === "wordslide") return generateWordSlide();
  if (type === "balance") return generateBalance();
  if (type === "lightsout") return generateLightsOut();
  if (type === "pipes") return generatePipes();
  if (type === "sudoku") return generateSudoku();
  if (type === "flow") return generateFlow();
  if (type === "iceslide") return generateIceSlide();
  if (type === "push") return generatePush();
  if (type === "laser") return generateLaser();
  if (type === "tower") return generateTower();
  if (type === "maze") return generateMaze();
  if (type === "tubes") return generateTubes();
  if (type === "safe") return generateSafe();
  if (type === "bomb") return generateBomb();
  if (type === "gravity") return generateGravity();
  if (type === "chain") return generateChain();
  if (type === "nonogram") return generateNonogram();
  if (type === "pairmatch") return generatePairMatch();
  if (type === "flood") return generateFlood();
  if (type === "tiles") return generateTiles();
  if (type === "rings") return generateRings();
  if (type === "hover") return generateHover();
  if (type === "swerve") return generateSwerve();
  if (type === "skyline") return generateSkyline();
  if (type === "bintoss") return generateBinToss();
  if (type === "bullseye") return generateBullseye();
  if (type === "matchup") return generateMatchup();
  if (type === "snake") return generateSnake();
  if (type === "cross") return generateCross();
  if (type === "dual") return generateDual();
  if (type === "ricochet") return generateRicochet();
  if (type === "breaker") return generateBreaker();
  if (type === "pinball") return generatePinball();
  if (type === "minesweeper") return generateMinesweeper();
  if (type === "mahjong") return generateMahjong();
  if (type === "homerun") return generateHomerun();
  if (type === "freekick") return generateFreekick();
  if (type === "racing") return generateRacing();
  if (type === "freecell") return generateFreecell();
  if (type === "tripeaks") return generateTripeaks();
  if (type === "pokersquares") return generatePokerSquares();
  if (type === "fivehands") return generateFiveHands();
  if (type === "pyramid") return generatePyramid();
  if (type === "golfsol") return generateGolfSol();
  if (type === "muggins") return generateMuggins();
  if (type === "minigolf") return generateMinigolf();
  if (type === "pool") return generatePool();
  if (type === "curling") return generateCurling();
  if (type === "blockfall") return generateBlockfall();
  if (type === "alleyroll") return generateAlleyRoll();
  if (type === "rally") return generateRally();
  if (type === "steady") return generateSteady();
  if (type === "slice") return generateSlice();
  if (type === "bubble") return generateBubble();
  if (type === "beat") return generateBeat();
  if (type === "whack") return generateWhack();
  if (type === "tendrop") return generateTenDrop();
  if (type === "wordfall") return generateWordfall();
  if (type === "clayshoot") return generateClayShoot();
  if (type === "wavefront") return generateWavefront();
  if (type === "bastion") return generateBastion();
  if (type === "rooftop") return generateRooftop();
  if (type === "flip") return generateFlip();
  if (type === "junction") return generateJunction();
  if (type === "inkbridge") return generateInkBridge();
  if (type === "burst") return generateBurst();
  if (type === "orbit") return generateOrbit();
  if (type === "swing") return generateSwing();
  if (type === "snip") return generateSnip();
  if (type === "tilt") return generateTilt();
  if (type === "hotfloor") return generateHotFloor();
  if (type === "tents") return generateTents();
  if (type === "shikaku") return generateShikaku();
  if (type === "lightup") return generateLightUp();
  if (type === "balltrack") return generateBallTrack();
  if (type === "numpyramid") return generateNumberPyramid();
  if (type === "trail") return generateTrail();
  if (type === "dig") return generateDig();
  if (type === "wordsearch") return generateWordSearch();
  // wheelRev 1: room-seeded draw from the 11–14 word bank.
  if (type === "letterwheel") return generateLetterWheel(wordGameSeed(type, context.bankSeed));
  // Room-seeded: every player in a room gets the same board from the room seed.
  // Word depth (25 Oct 2026): Strikeout rev 5 = rev 4's draw and rules, scored to 200 (depth/strikeout.server.ts).
  if (type === "strikeout") return generateStrikeout(wordGameSeed(type, context.bankSeed), dealtDepthRev(dealtTopupRev(STRIKEOUT_REV_TOPUP, STRIKEOUT_REV5), STRIKEOUT_REV4));
  if (type === "codeword") return generateCodeword(wordGameSeed(type, context.bankSeed));
  if (type === "swapword") return generateSwapword(wordGameSeed(type, context.bankSeed));
  if (type === "measure") return generateMeasure(gameSeed(type, context));
  if (type === "checkout") return generateCheckout(gameSeed(type, context));
  if (type === "numline") return generateNumline(gameSeed(type, context));
  // New grid puzzles (1 Nov 2026): built from the room seed (salted by type), each proved unique by its solver.
  if (type === "fences") return generateFences(gameSeed(type, context));
  if (type === "fillomino") return generateFillomino(gameSeed(type, context));
  if (type === "bridges") return generateBridges(gameSeed(type, context));
  if (type === "kakuro") return generateKakuro(gameSeed(type, context));

  return puzzleDef(type).generate();
}

/**
 * Brimful, Checkout, Ballpark, Fences, Fillomino, Bridges and Kakuro build from one seed: the room seed (salted by
 * type) in rooms and practice, so a room's puzzle follows from its seed; a
 * fresh draw otherwise (fixed under withSeededRandom for intro examples).
 */
function gameSeed(type: PuzzleType, context: GenerateContext): number {
  return context.bankSeed !== undefined ? saltSeed(context.bankSeed, type) : randomBelow(0x7fff_ffff);
}

/** Generated ONCE per room so every player receives identical puzzles. */
export function buildRoomPuzzles(
  options: RoundSelectionOptions & GenerateContext & {
    /** A room saved with settings: its rounds as dealt from them (roomDeal.ts) on this seed. */
    roundOrder?: readonly PuzzleType[] | undefined;
  } = {},
): {
  roundOrder: PuzzleType[];
  puzzles: PuzzleData[];
} {
  // The room seed orders the categories and picks every banked board.
  const seed = options.seed ?? newRoomSeed();
  const roundOrder = options.roundOrder ? [...options.roundOrder] : pickRoundOrder({ ...options, seed });
  return {
    roundOrder,
    // Every room puzzle carries the tie-break stamp (tieBreak.ts), so a room's
    // rounds are all on the new tie-break clock or, for older rooms, none are.
    puzzles: dealRounds(roundOrder, {
      seed,
      unblockRow: options.unblockRow ?? null,
      recentBankKeys: options.recentBankKeys,
    }),
  };
}

/** What the round engine deals a set of rounds from (B6, docs/round-engine/plan.md). */
export interface RoundDealContext {
  /** The room's seed: it picks every banked board and seeds the seeded generators. */
  seed: number;
  unblockRow?: UnblockBankRow | null | undefined;
  recentBankKeys?: ReadonlySet<string> | undefined;
}

/**
 * The round engine's deal (B6): a set of rounds of these types on one seed, each through the one deal decider
 * (`generatePuzzle`) and stamped with the tie-break (tieBreak.ts). Rooms (buildRoomPuzzles), the Daily (dealDaily) and
 * friend challenges (dealChallenge) each pick their own order and deal it here; src/lib/round/deal.server.ts
 * re-exports it. round-engine-parity-check proves it deals what the three loops it replaced dealt.
 */
export function dealRounds(order: readonly PuzzleType[], context: RoundDealContext): PuzzleData[] {
  return order.map((type) =>
    stampTieRev(
      generatePuzzle(type, {
        unblockRow: context.unblockRow ?? null,
        bankSeed: context.seed,
        recentBankKeys: context.recentBankKeys,
      }),
    ),
  );
}

/** The round engine's single deal (B6): one round of a type, with no tie-break stamp (practice). */
export function dealOne(type: PuzzleType, context: GenerateContext): PuzzleData {
  return generatePuzzle(type, context);
}

// Grading lives in gradeAnswer.server.ts (Speed fix 7), so the first answer never loads the generators below.
export { gradeAnswer, standardParts } from "./gradeAnswer.server";
