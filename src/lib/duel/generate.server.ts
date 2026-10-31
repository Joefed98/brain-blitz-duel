/**
 * Server-only puzzle building and grading. Types whose content needs the
 * dictionary or a solver (Wordsmith, Word Hunt, Unblock, Block Party) are
 * handled here, so nothing answer-shaped is ever reachable from a client bundle.
 */

import { generateCurling, generateMinigolf, generatePool } from "./sports.server";
import { SPEED_PAR_VERSION, puzzleUsesSpeedPar, withSpeedCurve } from "./speedPar";
import { PUZZLE_SCORE_REV_DEALT, dealtPuzzleScoreRev, puzzleScoreRevOf, storedScoreParts } from "./puzzleScoreRev";
import { PUZZLE_SCORE_REV_BANDS, rev2Applies, rev2Grade, rev2ResultOf } from "./puzzleScoreRev2";
import { PUZZLE_SCORE_REV_HELPER, rev3Applies, rev3Efficiency, rev3Finish, rev3Unfinished } from "./puzzleScoreRev3";
import { rev3EfficiencyOverride, rev3Progress } from "./puzzleProgress";
import { gradeDepth200 } from "./depth200.server";
import { stampNumberDepth } from "./numberDepth.server";
import { puzzleTimeLimitMs } from "./registry";
import { WORDHUNT_REV_TARGET, WORDSMITH_REV_DEPTH, WORDSMITH_REV_TARGET, WORDSMITH_REV_TOPUP } from "./scoring";
import { dealtTopupRev } from "./depthTopup";
import { dealStandard, usesStandard } from "./standard/stamps";
import { dealPuzzleNotes } from "./puzzleNotes";
import { varyTallyTray } from "@/puzzles/countUp";
import { gradeStandard } from "./standard/grade.server";
import { splitTimeline } from "./standard/timeline";
import { stampMoveLimits } from "./moveLimits.server";
import { stampTieRev } from "./tieBreak";
import { dealDepth4 } from "./depth4/deal.server";
import { dealtDepthRev } from "./wordDepth";
import { stampTileGridRev } from "./tileGrid";
import { STRIKEOUT_REV4, STRIKEOUT_REV5, STRIKEOUT_REV_TOPUP } from "./strikeout";
import { generateBlockParty } from "./blockParty.server";
import { gradeSubmission, latestTapMs, type Graded, type SubmitExtra } from "./grade";
import { newRoomSeed, pickRoundOrder, type RoundSelectionOptions } from "./selection";
import { drawBankedPuzzle, isBankedType } from "./puzzleBank.server";
import { puzzleDef } from "./registry";
import { TOTAL_ROUNDS, type PuzzleData, type PuzzleType } from "./types";
import { generateUnblock, type UnblockBankRow } from "./unblock.server";
import { generateWordHunt, generateWordHuntDepth, gradeWordHunt } from "./wordHunt.server";
import { WORDHUNT_REV_DEPTH } from "./wordHunt";
import { generateWordsmith, gradeWordsmith } from "./wordsmith.server";
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
 * Every new puzzle is stamped with the speed-par scoring version and the puzzle
 * score shape (puzzleScoreRev.ts); stored rounds without them keep the legacy
 * curve and shape.
 */
export function generatePuzzle(type: PuzzleType, context: GenerateContext = {}): PuzzleData {
  // The seven games with a 13 Oct 2026 limit or count-range revision carry their own stamp (moveLimits.ts).
  const made = stampMoveLimits(generateUnstamped(type, context));
  // Number puzzles to 200 (numberDepth.ts) carry depthRev 1 on puzzleScoreRev 3.
  const stamped = stampNumberDepth({ ...(made as object), speedPar: SPEED_PAR_VERSION, puzzleScoreRev: dealtPuzzleScoreRev() } as unknown as PuzzleData);
  // The scoring standard (standard/stamps.ts): the game's live stamp moves up by one, on today's score revision only.
  if (puzzleScoreRevOf(stamped) !== PUZZLE_SCORE_REV_DEALT) return stamped;
  // Joe's puzzle notes (28 Oct 2026, puzzleNotes.ts): Slider and Tally one stamp above the standard's.
  return dealPuzzleNotes(dealStandard(stamped), (p) => (p.type === "countup" ? varyTallyTray(p) : p));
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
  if (type === "minigolf") return generateMinigolf();
  if (type === "pool") return generatePool();
  if (type === "curling") return generateCurling();
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

  return puzzleDef(type).generate();
}

/**
 * Brimful, Checkout and Ballpark build from one seed: the room seed (salted by
 * type) in rooms and practice, so a room's puzzle follows from its seed; a
 * fresh draw otherwise (fixed under withSeededRandom for intro examples).
 */
function gameSeed(type: PuzzleType, context: GenerateContext): number {
  return context.bankSeed !== undefined ? saltSeed(context.bankSeed, type) : randomBelow(0x7fff_ffff);
}

/** Generated ONCE per room so every player receives identical puzzles. */
export function buildRoomPuzzles(options: RoundSelectionOptions & GenerateContext = {}): {
  roundOrder: PuzzleType[];
  puzzles: PuzzleData[];
} {
  // The room seed orders the categories and picks every banked board.
  const seed = options.seed ?? newRoomSeed();
  const roundOrder = pickRoundOrder({ ...options, seed });
  return {
    roundOrder,
    // Every room puzzle carries the tie-break stamp (tieBreak.ts), so a room's
    // rounds are all on the new tie-break clock or, for older rooms, none are.
    puzzles: roundOrder.map((type) =>
      stampTieRev(
        generatePuzzle(type, {
          unblockRow: options.unblockRow ?? null,
          bankSeed: seed,
          recentBankKeys: options.recentBankKeys,
        }),
      ),
    ),
  };
}

/**
 * The single place an answer is checked and scored. `receivedMsRemaining` is the
 * server's own time left when a room answer arrived (tap logs are held to it).
 */
export function gradeAnswer(
  puzzle: PuzzleData,
  sent: string,
  msRemaining: number,
  extra?: SubmitExtra,
  receivedMsRemaining?: number,
): Graded {
  // On a standard stamp the phone appends a draft timeline (standard/timeline.ts): graded and stored without it.
  const std = usesStandard(puzzle);
  const { body: answer, timeline } = std ? splitTimeline(sent) : { body: sent, timeline: null };
  const graded = withSpeedCurve(puzzleUsesSpeedPar(puzzle), () => {
    if (puzzle.type === "wordsmith") return gradeWordsmith(puzzle, answer, msRemaining);
    if (puzzle.type === "wordhunt") return gradeWordHunt(puzzle, answer, msRemaining);
    return gradeSubmission(puzzle, answer, msRemaining, extra, receivedMsRemaining);
  });
  let todayGrade: Graded | null = null;
  const today = () => (todayGrade ??= gradeToday(puzzle, answer, graded, receivedMsRemaining));
  const depthOrToday = () => gradeDepth200({ puzzle, answer, graded, today, receivedMsRemaining }) ?? today();
  // Depth to 200 (depth200.server.ts, the one depth path): a puzzle stamped with its game's depth revision scores to
  // 200 through that game's grader (from the game's own grade or today's); every other puzzle keeps today's grade.
  // The scoring standard (standard/grade.server.ts): a puzzle on its game's standard stamp scores on the one shape.
  if (std) return gradeStandard({ puzzle, answer, timeline, graded, today, receivedMsRemaining }) ?? depthOrToday();
  return depthOrToday();
}

/** Today's grade before any depth revision: puzzleScoreRev 3's helper or rev 2's knots over the game's own grade. */
function gradeToday(puzzle: PuzzleData, answer: string, graded: Graded, receivedMsRemaining?: number): Graded {
  const rev = puzzleScoreRevOf(puzzle);
  // puzzleScoreRev 3 (the shared helper, puzzleScoreRev3.ts): finish puzzles score progress, time and mistakes.
  if (rev >= PUZZLE_SCORE_REV_HELPER && rev3Applies(puzzle.type)) return withRev3(puzzle, answer, graded, receivedMsRemaining);
  // puzzleScoreRev 2 (score bands, puzzleScoreRev2.ts): the rev-1 grade above, mapped through the game's knots.
  return rev >= PUZZLE_SCORE_REV_BANDS && rev2Applies(puzzle.type) ? withRev2(puzzle, graded) : graded;
}

/**
 * A rev-1 grade turned into the rev-3 score: a finish is 120 + speed (cut by the game's mistakes), an unfinished
 * round 110 × progress ÷ the game's one-short progress (puzzleProgress.ts). The breakdown adds up to the score.
 */
function withRev3(puzzle: PuzzleData, answer: string, graded: Graded, receivedMsRemaining?: number): Graded {
  const limit = puzzleTimeLimitMs(puzzle);
  const parts1 = storedScoreParts(graded.extra);
  const finished = graded.isCorrect && (parts1 === null || parts1.kind === "finish");
  const r = finished
    ? rev3Finish(puzzle.type, graded.storedMs, limit, rev3EfficiencyOverride(puzzle, graded.extra) ?? rev3Efficiency(parts1, graded.storedMs, limit))
    : rev3Unfinished(
        puzzle.type,
        rev3Progress({ puzzle, answer, extra: graded.extra, latestMs: latestTapMs(limit, receivedMsRemaining) }) ??
          Math.max(0, parts1 ? parts1.base : graded.score) / 110,
      );
  const shares = finished ? { time: r.time, efficiency: r.efficiency } : { progressShare: r.progress };
  return { ...graded, isCorrect: finished, score: r.score, extra: { ...(graded.extra ?? {}), parts: r.parts, rev1Score: graded.score, ...shares } };
}

/** A rev-1 grade turned into the rev-2 score; the breakdown stored for the reveal adds up to it. */
function withRev2(puzzle: PuzzleData, graded: Graded): Graded {
  const limit = puzzleTimeLimitMs(puzzle);
  const parts1 = storedScoreParts(graded.extra);
  const ms = graded.isCorrect ? graded.storedMs : 0;
  const { score, parts } = rev2Grade(puzzle, graded.score, parts1, ms, limit);
  const result = Math.round(rev2ResultOf(puzzle.type, graded.score, parts1, ms, limit).result * 10) / 10;
  return { ...graded, score, extra: { ...(graded.extra ?? {}), parts, rev1Score: graded.score, result } };
}
