/**
 * Server-only puzzle building and grading. Types whose content needs the
 * dictionary or a solver (Wordsmith, Word Hunt, Unblock, Block Party) are
 * handled here, so nothing answer-shaped is ever reachable from a client bundle.
 */

import { SPEED_PAR_VERSION, puzzleUsesSpeedPar, withSpeedCurve } from "./speedPar";
import { generateBlockParty } from "./blockParty.server";
import { generateGroups } from "./groups.server";
import { gradeSubmission, type Graded, type SubmitExtra } from "./grade";
import { newRoomSeed, pickRoundOrder, type RoundSelectionOptions } from "./selection";
import { drawBankedPuzzle, isBankedType } from "./puzzleBank.server";
import { puzzleDef } from "./registry";
import { TOTAL_ROUNDS, type GoNoGoItem, type PuzzleData, type PuzzleType } from "./types";
import { generateUnblock, type UnblockBankRow } from "./unblock.server";
import { generateWordHunt, gradeWordHunt } from "./wordHunt.server";
import { generateWordsmith, gradeWordsmith } from "./wordsmith.server";
import { generateWordLadder } from "./wordLadder.server";
import { generateTileGrid } from "./tileGrid.server";
import { generateWordSlide } from "./wordSlide.server";
import { generateBalance, generateSumHunt } from "./numberRounds.server";
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
import { generateChain } from "./chain.server";
import { generateIntruder } from "./intruder.server";
import { generateNonogram } from "./nonogram.server";
import { generatePairMatch } from "./pairmatch.server";
import { generateFlood } from "./flood.server";
import { generateStroke } from "./stroke.server";
import { generateTiles } from "./tiles.server";
import { generateRings } from "./rings.server";
import { generateHover } from "./hover.server";
import {
  generateBinToss,
  generateBullseye,
  generateMatchup,
  generateCross,
  generateDual,
  generateRicochet,
  generateBreaker,
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
  generateSortRush,
  generateFlip,
  generateParry,
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
import { generateMeasure } from "./measure.server";
import { generateCheckout } from "./checkout.server";
import { generateNumline } from "./numline.server";
import { randomBelow } from "./random";
import { saltSeed } from "./seededRng";

import { buildGoNoGo } from "@/puzzles/goNoGo";
import { buildWordMatch } from "@/puzzles/wordMatch";

/** Room-level context a generator may need beyond its own randomness. */
export interface GenerateContext {
  /** The opening item of the host's previous Go / No-Go run, if there was one. */
  previousGoNoGoFirst?: GoNoGoItem | null;
  /** A pre-drawn Unblock bank row, so building a room never runs a solver. */
  unblockRow?: UnblockBankRow | null;
  /** Word Match prompts from the host's last ten tournaments. */
  recentWordMatchWords?: string[];
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

/** Every new puzzle is stamped with the speed-par scoring version; stored rounds without it keep the legacy curve. */
export function generatePuzzle(type: PuzzleType, context: GenerateContext = {}): PuzzleData {
  const made = generateUnstamped(type, context);
  return { ...(made as object), speedPar: SPEED_PAR_VERSION } as unknown as PuzzleData;
}

function generateUnstamped(type: PuzzleType, context: GenerateContext): PuzzleData {
  if (context.bankSeed !== undefined && isBankedType(type))
    return drawBankedPuzzle(type, context.bankSeed, context.recentBankKeys);
  if (type === "stroop") return generateColourClash();
  if (type === "gonogo") return buildGoNoGo(context.previousGoNoGoFirst ?? null);
  if (type === "wordmatch") return buildWordMatch(context.recentWordMatchWords ?? []);
  if (type === "wordsmith") return generateWordsmith();
  if (type === "wordhunt") return generateWordHunt();
  if (type === "unblock") return generateUnblock(context.unblockRow);
  if (type === "blockparty") return generateBlockParty();
  if (type === "groups") return generateGroups();
  if (type === "ladder") return generateWordLadder();
  if (type === "tilegrid") return generateTileGrid();
  if (type === "wordslide") return generateWordSlide();
  if (type === "sumhunt") return generateSumHunt();
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
  if (type === "intruder") return generateIntruder();
  if (type === "nonogram") return generateNonogram();
  if (type === "pairmatch") return generatePairMatch();
  if (type === "flood") return generateFlood();
  if (type === "stroke") return generateStroke();
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
  if (type === "sortrush") return generateSortRush();
  if (type === "flip") return generateFlip();
  if (type === "parry") return generateParry();
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
  if (type === "letterwheel") return generateLetterWheel();
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
    puzzles: roundOrder.map((type) =>
      generatePuzzle(type, {
        previousGoNoGoFirst: options.previousGoNoGoFirst ?? null,
        unblockRow: options.unblockRow ?? null,
        recentWordMatchWords: options.recentWordMatchWords ?? [],
        bankSeed: seed,
        recentBankKeys: options.recentBankKeys,
      }),
    ),
  };
}

/**
 * The single place an answer is checked and scored. `receivedMsRemaining` is the
 * server's own time left when a room answer arrived (tap logs are held to it).
 */
export function gradeAnswer(
  puzzle: PuzzleData,
  answer: string,
  msRemaining: number,
  extra?: SubmitExtra,
  receivedMsRemaining?: number,
): Graded {
  return withSpeedCurve(puzzleUsesSpeedPar(puzzle), () => {
    if (puzzle.type === "wordsmith") return gradeWordsmith(puzzle, answer, msRemaining);
    if (puzzle.type === "wordhunt") return gradeWordHunt(puzzle, answer, msRemaining);
    return gradeSubmission(puzzle, answer, msRemaining, extra, receivedMsRemaining);
  });
}
