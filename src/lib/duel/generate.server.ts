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
import { dealOperatorGaps, generateOperatorLevel, type OperatorLevelSettings } from "./operatorGaps.server";
import { dealLogic2 } from "./logicOverhaul2";
import { dealWordNov7 } from "./wordNov7";
import { dealGameReviewNov15 } from "./gameReviewNov15";
import { dealPatternNov15 } from "./patternNov15";
import { withPipesTwoWayPar } from "./depth4/pipesTaps";
import { dealWordOverhaul } from "./wordOverhaul.server";
import { dealAttentionOverhaul } from "./attentionOverhaul";
import { dealSpeedOverhaul } from "./speedOverhaul";
import { activeDealPins, dealPinned, withDealOptions, type DealOptions } from "./dealEra";
import { dealPartialCredit } from "./partialCredit";
import { dealNotesFree } from "./notesFree";
import { dealLogicOverhaul1 } from "./logicOverhaul1";
import { dealNumberOverhaul } from "./numberOverhaul";
import { topsyPlainRoutes } from "./topsy.server";
import { withTopsyV8Limits } from "./topsy";
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
import { generateBalanceLevel } from "./balanceLevels.server";
import { dealTargetExpert, generateTargetLevel, type TargetLevelSettings } from "./targetLevels.server";
import type { BalanceLevelSettings } from "./balanceLevels";
import { generateLightsOut, generatePipes, generateSudoku, withPipesOneLayout } from "./logic.server";
import { generateFlow } from "./flow.server";
import { generateIceSlide } from "./slide.server";
import { generatePush } from "./push.server";
import { generateLaser } from "./laser.server";
import { generateTower } from "./tower.server";
import { levelSettings, towerSettingsFor, type SudokuLevel, type SafeLevel, type NonoLevel, type FloodLevel, type TubesLevel } from "./logicLevels";
import { dealFloodLevel, dealSafeLevel, dealSudokuLevel, dealTubesLevel } from "./logicLevelBanks.server";
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
import { dealSpeedLevel } from "./speedLevels.server";
import { generateNonogram, generateNonogramLevel } from "./nonogram.server";
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
import { dealMeasure, stampMeasureLevel } from "./measureLevels.server";
import { generateNumlineLevel, type NumlineLevelSettings } from "./numlineLevels.server";
import { generateCheckout, generateCheckoutLevel } from "./checkout.server";
import { generateNumline } from "./numline.server";
import { generateFences } from "./fences.server";
import { generateFillomino } from "./fillomino.server";
import { generateBridges } from "./bridges.server";
import { dealLogicLevel } from "./logicLevelDeal.server";
import { generateKakuro, generateKakuroLevel } from "./kakuro.server";
import { CHECKOUT_NORMAL, CHECKOUT_REV_LEVELS, KAKURO_NORMAL, KAKURO_REV_LEVELS, checkoutLevelsPinned, kakuroLevelsPinned, type CheckoutLevelSettings, type KakuroLevelSettings } from "./numberLevels";
import { randomBelow } from "./random";
import { saltSeed } from "./seededRng";
import { NORMAL, stampLevel, type Level } from "@/lib/levels/levels";
import { gameLevelSettings, resolveLevel } from "@/lib/levels/gameLevels";
import { dealWordLevel } from "./wordLevels.server";
import { dealAttentionLevel } from "./attentionLevels.server";

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
  /**
   * The level asked for (src/lib/levels/; Normal when left out). The deal resolves it against the game's own levels
   * (gameLevels.ts `resolveLevel`: a level the game doesn't offer is Normal), hands the resolved level to the game's
   * generator through this field, and stamps it on the puzzle (`level`, only when it isn't Normal).
   */
  level?: Level | undefined;
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
  // Notes never count as mistakes (15 Nov 2026, notesFree.ts): Mosaic, Tents, Lamplighter, Loopline and Island Link.
  { name: "notesFree", deal: dealNotesFree },
  // The game review fixes (15 Nov 2026, gameReviewNov15.ts): Brimful measureRev 4 (out of moves ends only that puzzle).
  { name: "gameReviewNov15", deal: dealGameReviewNov15 },
  // The Logic overhaul, session 1 (15 Nov 2026, logicOverhaul1.ts): Polypotions tubesRev 3 (Undo gives the pour back).
  { name: "logicOverhaul1", deal: dealLogicOverhaul1 },
  // The Logic overhaul, session 2 (15 Nov 2026, logicOverhaul2.ts): Trail's per-undo cost and Regions' stroke rule.
  { name: "logic2", deal: dealLogic2 },
  // The Number overhaul (15 Nov 2026, numberOverhaul.ts): Counterweight, Operator, Checkout and Kakuro one stamp up.
  { name: "numberOverhaul", deal: dealNumberOverhaul },
  // The Pattern overhaul (15 Nov 2026, patternNov15.ts): the eight Pattern games' agreed changes, one stamp up each.
  // Pipeline pipesRev 5: par counted both ways (depth4/pipesTaps.ts), and a Normal board with two layouts dealt again
  // (logic.server.ts withPipesOneLayout). Topsy-Turvy gravityRev 8: tilt limits from each
  // board's fewest tilts (topsy.ts withTopsyV8Limits).
  { name: "patternNov15", deal: (p) => dealPatternNov15(p, (q) => (q.type === "pipes" ? withPipesTwoWayPar(withPipesOneLayout(q)) : q.type === "gravity" ? withTopsyV8Limits(q) : q)) },
  // The Word overhaul (15 Nov 2026, wordOverhaul.ts): Nucleus, Slider, Lookout, Roundabout and Cryptogrid one stamp up.
  { name: "wordOverhaul", deal: dealWordOverhaul },
  // The Attention overhaul (15 Nov 2026, attentionOverhaul.ts): Double Take, Tally and Matchmaker one stamp up.
  { name: "attentionOverhaul", deal: dealAttentionOverhaul },
  // The Speed overhaul (15 Nov 2026, speedOverhaul.ts): Tenfall tenRev 6 (resets cost on a finish), Pull! clayRev 10
  // (a wider quick-hit window).
  { name: "speedOverhaul", deal: dealSpeedOverhaul },
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

function dealLive(type: PuzzleType, requested: GenerateContext): PuzzleData {
  // Levels (phase 2 step 4): the level the game is played at; Normal deals exactly as before levels (no field).
  const level = resolveLevel(type, requested.level);
  const context: GenerateContext = level === NORMAL ? withoutLevel(requested) : { ...requested, level };
  return stampLevel(dealAtLevel(type, context), level);
}

function withoutLevel(context: GenerateContext): GenerateContext {
  // Callers have passed things that aren't objects (a check passes a string): those are handed on exactly as before.
  if (typeof context !== "object" || context === null || !("level" in context)) return context;
  const { level: _level, ...rest } = context;
  return rest;
}

function dealAtLevel(type: PuzzleType, context: GenerateContext): PuzzleData {
  // The seven games with a 13 Oct 2026 limit or count-range revision carry their own stamp (moveLimits.ts).
  const made = stampMoveLimits(generateUnstamped(type, context));
  // Number puzzles to 200 (numberDepth.ts) carry depthRev 1 on puzzleScoreRev 3.
  const stamped = stampNumberDepth({ ...(made as object), speedPar: SPEED_PAR_VERSION, puzzleScoreRev: dealtPuzzleScoreRev() } as unknown as PuzzleData);
  // The layers move stamps up on today's score revision only.
  if (puzzleScoreRevOf(stamped) !== PUZZLE_SCORE_REV_DEALT) return stamped;
  const layered = DEAL_LAYERS.reduce((puzzle, layer) => layer.deal(puzzle), stamped);
  // Brimful's level boards (measureLevels.server.ts): measureRev 5 and the level's move limits, after today's layers.
  const measured = type === "measure" ? stampMeasureLevel(layered, context.level) : layered;
  // The Attention games' levels (stage 3 of the overhaul) re-deal their board on the level's levers, after every layer;
  // a context without a level (Normal) is never touched.
  return context.level && context.level !== NORMAL ? dealAttentionLevel(measured, context.level) : measured;
}

function generateUnstamped(type: PuzzleType, context: GenerateContext): PuzzleData {
  // The Speed overhaul's levels (stage 3, 15 Nov 2026): Easy, Hard and Expert deals of the six Speed games; Normal
  // (no level) falls through to today's deal.
  const speedLevel = dealSpeedLevel(type, context.level);
  if (speedLevel) return speedLevel;
  // The D5 remodels are dealt live (Topsy-Turvy's old bank stays for its checks and stored rounds; checks written
  // for the previous versions pin the old deal, d5Remodels.ts).
  // Topsy-Turvy's difficulty levels (16 Nov 2026, topsy.server.ts generateTopsyLevel): a level beyond Normal deals from
  // its proved bank by the bank seed; Normal (no level) is today's deal.
  if (type === "gravity" && dealsD5Remodels()) return context.level ? generateTopsy(undefined, context.level, context.bankSeed) : generateTopsy();
  if (type === "tiles" && dealsD5Remodels()) return generateJumbledDealt();
  // Depth batch 4 (docs/depth/d4-pattern.md): eight Pattern / Logic games deal their 200-point stamp.
  const depth = dealDepth4(type, context);
  if (depth) return depth;
  // Polypotions' levels (the Logic overhaul, logicLevels.ts) come from their own proved banks, before today's bank.
  if (type === "tubes") {
    const lv = levelSettings<TubesLevel>("tubes", context.level);
    if (lv) return dealTubesLevel(lv, context.level!, context.bankSeed);
  }
  // The Logic overhaul's levels (logicLevels.ts): built live, kept only when a person could solve them (logicLevelDeal).
  const logicBoard = dealLogicLevel(type, context.level, () => gameSeed(type, context));
  if (logicBoard) return logicBoard;
  if (context.bankSeed !== undefined && isBankedType(type))
    return drawBankedPuzzle(type, context.bankSeed, context.recentBankKeys);
  // The Word overhaul's levels (stage 3, 15 Nov 2026): a Word game asked at a level beyond Normal is built by its own
  // level deal (wordLevels.server.ts); Normal never reaches it.
  if (context.level && context.level !== NORMAL) {
    const atLevel = dealWordLevel(type, context.level as Exclude<Level, "normal">, context);
    if (atLevel) return atLevel;
  }
  if (type === "stroop") return generateColourClash();
  // Nucleus and Forage carry their scoring-targets stamp (18 Oct 2026; scoring.ts WORDSMITH_V1_CURVE, WORDHUNT_V1_CURVE).
  // Word depth (25 Oct 2026): Nucleus deals wordsmithRev 3 (the curve to 200 and the pangram bonus).
  // The puzzle top-up (26 Oct 2026): wordsmithRev 4, rev 3's curve a little steeper above 45 points.
  if (type === "wordsmith") return { ...generateWordsmith(), wordsmithRev: dealtDepthRev(dealtTopupRev(WORDSMITH_REV_TOPUP, WORDSMITH_REV_DEPTH), WORDSMITH_REV_TARGET) };
  // Forage wordHuntRev 3 (word depth, 25 Oct 2026; wordHunt.ts): the 6×6 board with its golden tile.
  if (type === "wordhunt") return dealtDepthRev(WORDHUNT_REV_DEPTH, WORDHUNT_REV_TARGET) >= WORDHUNT_REV_DEPTH ? generateWordHuntDepth() : { ...generateWordHunt(), wordHuntRev: WORDHUNT_REV_TARGET };
  if (type === "unblock") return generateUnblock(context.unblockRow, context.level, context.bankSeed);
  if (type === "blockparty") return generateBlockParty();
  // Word depth (25 Oct 2026): Interlock tileGridRev 1 scores to 200 (depth/tilegrid.server.ts); the board is unchanged.
  if (type === "tilegrid") return stampTileGridRev(generateTileGrid());
  if (type === "wordslide") return generateWordSlide();
  // Counterweight's levels (balanceLevels.ts, 15 Nov 2026): today's game is Hard; Normal, Easy and Expert balanceRev 5.
  if (type === "balance") return dealBalanceLevel(context.level);
  if (type === "lightsout") return generateLightsOut();
  if (type === "pipes") return generatePipes();
  if (type === "sudoku") {
    const lv = levelSettings<SudokuLevel>("sudoku", context.level);
    return lv ? dealSudokuLevel(lv, context.level!, context.bankSeed) : generateSudoku();
  }
  if (type === "flow") return generateFlow();
  if (type === "iceslide") return generateIceSlide();
  if (type === "push") return generatePush();
  if (type === "laser") return generateLaser();
  if (type === "tower") return generateTower(towerSettingsFor(context.level));
  if (type === "maze") return generateMaze();
  if (type === "tubes") return generateTubes();
  if (type === "safe") {
    const lv = levelSettings<SafeLevel>("safe", context.level);
    return lv ? dealSafeLevel(lv, context.level!, context.bankSeed) : generateSafe();
  }
  if (type === "bomb") return generateBomb();
  if (type === "gravity") return generateGravity();
  if (type === "chain") return generateChain();
  if (type === "nonogram") {
    const lv = levelSettings<NonoLevel>("nonogram", context.level);
    return lv ? generateNonogramLevel(lv) : generateNonogram();
  }
  if (type === "pairmatch") return generatePairMatch();
  if (type === "flood") {
    const lv = levelSettings<FloodLevel>("flood", context.level);
    return lv ? dealFloodLevel(lv, context.level!, context.bankSeed) : generateFlood();
  }
  if (type === "tiles") return generateTiles();
  if (type === "rings") return generateRings();
  if (type === "hover") return generateHover();
  if (type === "swerve") return generateSwerve();
  if (type === "skyline") return generateSkyline(context.level);
  if (type === "bintoss") return generateBinToss();
  if (type === "bullseye") return generateBullseye();
  if (type === "matchup") return generateMatchup();
  if (type === "snake") return generateSnake();
  if (type === "cross") return generateCross();
  if (type === "dual") return generateDual();
  if (type === "ricochet") return generateRicochet();
  if (type === "breaker") return generateBreaker();
  if (type === "pinball") return generatePinball();
  if (type === "minesweeper") return generateMinesweeper(context.level);
  if (type === "mahjong") return generateMahjong(context.level);
  if (type === "homerun") return generateHomerun(context.level);
  if (type === "freekick") return generateFreekick(context.level);
  if (type === "racing") return generateRacing(context.level);
  if (type === "freecell") return generateFreecell(context.level);
  if (type === "tripeaks") return generateTripeaks(context.level);
  if (type === "pokersquares") return generatePokerSquares();
  if (type === "fivehands") return generateFiveHands(context.level);
  if (type === "pyramid") return generatePyramid();
  if (type === "golfsol") return generateGolfSol();
  if (type === "muggins") return generateMuggins();
  // golfRev 3 reads the level the deal asks for (the difficulty framework's context.level; absent on main: Normal).
  if (type === "minigolf") return generateMinigolf((context as { level?: unknown }).level);
  if (type === "pool") return generatePool();
  // Curl Champ's levels (the Sports overhaul): Easy, Hard and Expert deal from their own proved banks; Normal as before.
  if (type === "curling") return generateCurling(context.level);
  if (type === "blockfall") return generateBlockfall(context.level);
  if (type === "alleyroll") return generateAlleyRoll();
  if (type === "rally") return generateRally();
  if (type === "steady") return generateSteady();
  if (type === "slice") return generateSlice();
  if (type === "bubble") return generateBubble();
  if (type === "beat") return generateBeat(context.level);
  if (type === "whack") return generateWhack();
  if (type === "tendrop") return generateTenDrop();
  if (type === "wordfall") return generateWordfall();
  if (type === "clayshoot") return generateClayShoot();
  if (type === "wavefront") return generateWavefront();
  if (type === "bastion") return generateBastion(context.level);
  if (type === "rooftop") return generateRooftop();
  if (type === "flip") return generateFlip(context.level);
  if (type === "junction") return generateJunction();
  if (type === "inkbridge") return generateInkBridge(context.level);
  if (type === "burst") return generateBurst();
  if (type === "orbit") return generateOrbit(context.level);
  if (type === "swing") return generateSwing(context.level);
  if (type === "snip") return generateSnip();
  if (type === "tilt") return generateTilt(context.level);
  if (type === "hotfloor") return generateHotFloor();
  if (type === "tents") return generateTents();
  if (type === "shikaku") return generateShikaku();
  if (type === "lightup") return generateLightUp();
  if (type === "balltrack") return generateBallTrack(context.level);
  // Levels (stage 3 of the Number overhaul): Integer Pyramid's level banks, Operator's level equations; Normal as before.
  if (type === "numpyramid") return generateNumberPyramid(context.level);
  if (type === "equation" && context.level) {
    const settings = gameLevelSettings<OperatorLevelSettings>("equation", context.level);
    if (settings) return generateOperatorLevel(settings);
  }
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
  // Brimful's levels (measureLevels.ts, 15 Nov 2026): today's game is Hard; Normal, Easy and Expert measureRev 5.
  if (type === "measure") return dealMeasure(gameSeed(type, context), context.level);
  // Checkout's and Kakuro's levels (numberLevels.ts, 15 Nov 2026): today's game is Hard; Normal, Easy and Expert new.
  if (type === "checkout") return dealCheckoutLevel(gameSeed(type, context), context.level);
  // Ballpark's levels (numlineLevels.server.ts, 15 Nov 2026): Normal is today's game; Easy, Hard and Expert their own lines.
  if (type === "numline") {
    const lines = context.level ? gameLevelSettings<NumlineLevelSettings>("numline", context.level) : null;
    return lines ? generateNumlineLevel(gameSeed(type, context), lines) : generateNumline(gameSeed(type, context));
  }
  // New grid puzzles (1 Nov 2026): built from the room seed (salted by type), each proved unique by its solver.
  if (type === "fences") return generateFences(gameSeed(type, context));
  if (type === "fillomino") return generateFillomino(gameSeed(type, context));
  if (type === "bridges") return generateBridges(gameSeed(type, context));
  if (type === "kakuro") return dealKakuroLevel(gameSeed(type, context), context.level);
  // Exact's levels (targetLevels.server.ts, 15 Nov 2026): Normal is today's deal below.
  if (type === "target" && context.level) {
    // Expert deals from its proved bank (Joe, 16 Nov 2026: no live search of up to 3 s; targetExpertBank.server.ts).
    if (context.level === "expert" && gameLevelSettings<TargetLevelSettings>("target", "expert")) return dealTargetExpert();
    const settings = gameLevelSettings<TargetLevelSettings>("target", context.level);
    if (settings) return generateTargetLevel(settings);
  }

  return puzzleDef(type).generate();
}

/**
 * Counterweight (balanceLevels.ts): Hard is today's deal exactly; Normal, Easy and Expert the balanceRev 5 deals. The
 * check-only pin `preBalanceLevels` (or any older era pinned) deals today's game at Normal, as rooms did before levels.
 */
function dealBalanceLevel(level: Level | undefined): PuzzleData {
  // Any era pinned is from before this change, so it deals today's game at Normal too (as Brimful's levels do).
  if (!level && (dealPinned("preBalanceLevels") || activeDealPins().length > 0)) return generateBalance();
  return generateBalanceLevel(level ? (gameLevelSettings("balance", level) as BalanceLevelSettings | null) : null);
}

/**
 * Checkout and Kakuro (numberLevels.ts): Hard is today's deal exactly; Normal, Easy and Expert the levels' deals
 * (checkoutRev 4, kakuroRev 3). The check-only pins (or any older era pinned) deal today's game at Normal.
 */
function dealCheckoutLevel(seed: number, level: Level | undefined): PuzzleData {
  if (!level && checkoutLevelsPinned()) return generateCheckout(seed);
  const settings = level ? gameLevelSettings<CheckoutLevelSettings>("checkout", level) : CHECKOUT_NORMAL;
  if (!settings || settings.today) return generateCheckout(seed);
  return generateCheckoutLevel(seed, settings, CHECKOUT_REV_LEVELS);
}

function dealKakuroLevel(seed: number, level: Level | undefined): PuzzleData {
  if (!level && kakuroLevelsPinned()) return generateKakuro(seed);
  const settings = level ? gameLevelSettings<KakuroLevelSettings>("kakuro", level) : KAKURO_NORMAL;
  if (!settings || settings.today) return generateKakuro(seed);
  return generateKakuroLevel(seed, settings, KAKURO_REV_LEVELS);
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
      ...(options.level && options.level !== NORMAL ? { level: options.level } : {}),
    }),
  };
}

/** What the round engine deals a set of rounds from (B6, docs/round-engine/plan.md). */
export interface RoundDealContext {
  /** The room's seed: it picks every banked board and seeds the seeded generators. */
  seed: number;
  unblockRow?: UnblockBankRow | null | undefined;
  recentBankKeys?: ReadonlySet<string> | undefined;
  /** The room's level (rooms and tournaments; the Daily, challenges and rated matches leave it out: Normal). */
  level?: Level | undefined;
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
        ...(context.level && context.level !== NORMAL ? { level: context.level } : {}),
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
