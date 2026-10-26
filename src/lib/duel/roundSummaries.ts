import { PUZZLE_SCORE_REV, puzzleScoreRevOf } from "./puzzleScoreRev";
import { LAB_STARS } from "./depth/labyrinth";
import { solutionProgress } from "./progressFigures";
import { PUZZLE_SCORE_REV_BANDS } from "./puzzleScoreRev2";
import {
  SPOT_REV1_PER_SCENE,
  SPOT_REV1_SCENES,
  countUpStageTruth,
  parseSpotTaps,
  scanRev1StageResult,
  scanStageMatches,
  spotTwoResult,
  usesCountRev2,
  usesScanRev1,
  usesSpotRev1,
} from "./attentionRev";
import { chainRules } from "./chain";
import { tilesLayout } from "./tiles";
import { isTopsy, TOPSY_BALLS, TOPSY_BOARDS, TOPSY_STARS } from "./topsy";
import { isJumbledGradient, JUMBLED_MOVABLE } from "./jumbled";
import { equationTryLimit, splitCountSuffix } from "./moveLimits";
import { WORDHUNT_REV_CURVE, WORDSMITH_REV_CURVE } from "./scoring";
import { decodeSteps, madeDistance, replayTargetSteps } from "./target";
import { crossLine } from "@/lib/duel/crossLine";
import { BT_BALLS } from "@/lib/arcade/ballTrack";
import { WF_PAR } from "@/lib/arcade/wordfall";
import { CLAY_REV_BANDS } from "@/lib/arcade/clayShoot";
import { equationStageCorrect, parseCount, parseSelection, scanStageResult, splitStages } from "./stagedRounds";
import {
  EQUATION_TIME_MS,
  BLOCK_FREE_CELLS,
  BLOCK_TIME_MS,
  NUMHUNT_COUNT,
  ROUND_MS,
  SPOT_DIFFERENCES,
  SPOT_TIME_MS,
  TARGET_TIME_MS,
  UNBLOCK_TIME_MS,
  WORDHUNT_TIME_MS,
  wordHuntPoints,
  WORDSMITH_TIME_MS,
  wordsmithPoints,
  LIGHTS_TIME_MS,
  PIPES_CELLS,
  FLOW_CELLS,
  PIPES_TIME_MS,
  SUDOKU_TIME_MS,
  FLOW_TIME_MS,
  FLOW_PAIRS,
  SLIDE_TIME_MS,
  PUSH_TIME_MS,
  LASER_TIME_MS,
  MAZE_TIME_MS,
  TOWER_TIME_MS,
  type PlayerRoundDetail,
  type PuzzleData,
  type PuzzleType,
  type RoundResultRow,
} from "./types";
import { BOMB_TIME_MS, SAFE_DIALS, SAFE_TIME_MS, TUBES_COLOURS, TUBES_TIME_MS } from "./types";
import {
  CHAIN_TIME_MS,
  GRAV_TIME_MS,
  NONO_TIME_MS,
  PAIR_PAIRS,
  PAIR_TIME_MS,
  FLOOD_CELLS,
  FLOOD_TIME_MS,
  TILES_TIME_MS,
  RINGS_SEGMENTS,
  RINGS_TIME_MS,
  HOVER_TIME_MS,
  SWERVE_TIME_MS,
  SKYLINE_TIME_MS,
  BINTOSS_TIME_MS,
  BULLSEYE_TIME_MS,
  MATCHUP_TIME_MS,
  SNAKE_TIME_MS,
  CROSS_TIME_MS,
  DUAL_TIME_MS,
  RICO_TIME_MS,
  BREAKER_TIME_MS,
  RALLY_TIME_MS,
  STEADY_TIME_MS,
  SLICE_TIME_MS,
  BUBBLE_TIME_MS,
  BEAT_TIME_MS,
  WHACK_TIME_MS,
  TENDROP_TIME_MS,
  WORDFALL_TIME_MS,
  CLAYSHOOT_TIME_MS,
  TENTS_TIME_MS,
  SHIKAKU_TIME_MS,
  LIGHTUP_TIME_MS,
  BALLTRACK_TIME_MS,
  NUMPYRAMID_TIME_MS,
  TRAIL_TIME_MS,
  MEASURE_TIME_MS,
  CHECKOUT_TIME_MS,
  NUMLINE_TIME_MS,
  DIG_TIME_MS,
  WORDSEARCH_TIME_MS,
  LETTERWHEEL_TIME_MS,
  STRIKEOUT_TIME_MS,
  CODEWORD_TIME_MS,
  SWAPWORD_TIME_MS,
  WAVEFRONT_TIME_MS,
  BASTION_TIME_MS,
  ROOFTOP_TIME_MS,
  FLIP_TIME_MS,
  JUNCTION_TIME_MS,
  INKBRIDGE_TIME_MS,
  BURST_TIME_MS,
  ORBIT_TIME_MS,
  SWING_TIME_MS,
  SNIP_TIME_MS,
  TILT_TIME_MS,
  HOTFLOOR_TIME_MS,
  PINBALL_TIME_MS,
} from "./types";

import { TG_TIME_MS, tileGridResultLine } from "./tileGrid";
import { WS_TIME_MS } from "./wordSlide";
import { BAL_TIME_MS, balanceScaleCount } from "./balance";

type BuiltDetail = Omit<PlayerRoundDetail, "playerSlot">;
type SummaryBuilder = (result: RoundResultRow, puzzle: PuzzleData) => BuiltDetail;

/**
 * An unfinished round's progress toward the solution, as its credit counts it (progressFigures.ts),
 * for the seven games whose raw figure counted more than the score did; null keeps the old figure.
 */
function progressOf(result: RoundResultRow, puzzle: PuzzleData): BuiltDetail | null {
  const figure = solutionProgress(puzzle, result.answer ?? "", result.extra);
  return figure ? { summary: figure.text, detail: figure.cost ? [figure.cost] : [] } : null;
}
type AnswerBuilder = (puzzle: PuzzleData) => string | null;

/** Types added after the ladder below; their limits are looked up directly. */
const DIRECT_LIMITS: Partial<Record<PuzzleType, number>> = {
  pinball: PINBALL_TIME_MS,
  nonogram: NONO_TIME_MS,
  pairmatch: PAIR_TIME_MS,
  flood: FLOOD_TIME_MS,
  tiles: TILES_TIME_MS,
  tilegrid: TG_TIME_MS,
  balance: BAL_TIME_MS,
  wordslide: WS_TIME_MS,
  rings: RINGS_TIME_MS,
  hover: HOVER_TIME_MS,
  swerve: SWERVE_TIME_MS,
  skyline: SKYLINE_TIME_MS,
  bintoss: BINTOSS_TIME_MS,
  bullseye: BULLSEYE_TIME_MS,
  matchup: MATCHUP_TIME_MS,
  snake: SNAKE_TIME_MS,
  cross: CROSS_TIME_MS,
  dual: DUAL_TIME_MS,
  ricochet: RICO_TIME_MS,
  breaker: BREAKER_TIME_MS,
  rally: RALLY_TIME_MS,
  steady: STEADY_TIME_MS,
  slice: SLICE_TIME_MS,
  bubble: BUBBLE_TIME_MS,
  beat: BEAT_TIME_MS,
  whack: WHACK_TIME_MS,
  tendrop: TENDROP_TIME_MS,
  wordfall: WORDFALL_TIME_MS,
  clayshoot: CLAYSHOOT_TIME_MS,
  tents: TENTS_TIME_MS,
  shikaku: SHIKAKU_TIME_MS,
  lightup: LIGHTUP_TIME_MS,
  balltrack: BALLTRACK_TIME_MS,
  numpyramid: NUMPYRAMID_TIME_MS,
  trail: TRAIL_TIME_MS,
  measure: MEASURE_TIME_MS,
  checkout: CHECKOUT_TIME_MS,
  numline: NUMLINE_TIME_MS,
  dig: DIG_TIME_MS,
  wordsearch: WORDSEARCH_TIME_MS,
  letterwheel: LETTERWHEEL_TIME_MS,
  strikeout: STRIKEOUT_TIME_MS,
  codeword: CODEWORD_TIME_MS,
  swapword: SWAPWORD_TIME_MS,
  wavefront: WAVEFRONT_TIME_MS,
  bastion: BASTION_TIME_MS,
  rooftop: ROOFTOP_TIME_MS,
  flip: FLIP_TIME_MS,
  junction: JUNCTION_TIME_MS,
  inkbridge: INKBRIDGE_TIME_MS,
  burst: BURST_TIME_MS,
  orbit: ORBIT_TIME_MS,
  swing: SWING_TIME_MS,
  snip: SNIP_TIME_MS,
  tilt: TILT_TIME_MS,
  hotfloor: HOTFLOOR_TIME_MS,
};

/** The older types' limits (Tower and Bomb Defusal may carry their own). */
const LADDER_LIMITS: Partial<Record<PuzzleType, number>> = {
  target: TARGET_TIME_MS,
  equation: EQUATION_TIME_MS,
  symscan: 45_000,
  countup: 45_000,
  spotdiff: SPOT_TIME_MS,
  lightsout: LIGHTS_TIME_MS,
  pipes: PIPES_TIME_MS,
  sudoku: SUDOKU_TIME_MS,
  flow: FLOW_TIME_MS,
  iceslide: SLIDE_TIME_MS,
  push: PUSH_TIME_MS,
  laser: LASER_TIME_MS,
  maze: MAZE_TIME_MS,
  wordsmith: WORDSMITH_TIME_MS,
  wordhunt: WORDHUNT_TIME_MS,
  unblock: UNBLOCK_TIME_MS,
  blockparty: BLOCK_TIME_MS,
  tubes: TUBES_TIME_MS,
  safe: SAFE_TIME_MS,
  gravity: GRAV_TIME_MS,
  chain: CHAIN_TIME_MS,
};

function elapsedMs(result: RoundResultRow, puzzle: PuzzleData): number {
  // A puzzle that carries its own clock (Tower's five discs, Bomb v2, Counterweight balanceRev 2, Ballpark numlineRev 2, Double Take spotRev 1, Tally countRev 2) wins.
  const own = (puzzle as { timeLimitMs?: number }).timeLimitMs;
  if (typeof own === "number" && own > 0) return Math.max(0, own - result.ms_remaining);
  const direct = DIRECT_LIMITS[puzzle.type];
  if (direct) return Math.max(0, direct - result.ms_remaining);
  const limit =
    puzzle.type === "tower"
      ? (puzzle.timeLimitMs ?? TOWER_TIME_MS)
      : puzzle.type === "bomb"
        ? (puzzle.timeLimitMs ?? BOMB_TIME_MS)
        : (LADDER_LIMITS[puzzle.type] ?? ROUND_MS);
  return Math.max(0, limit - result.ms_remaining);
}

function seconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

function rawAnswer(result: RoundResultRow): string | null {
  const answer = result.answer?.trim();
  return answer ? answer : null;
}

function marked(result: RoundResultRow, answer: string): string {
  return result.is_correct ? answer : `✗ ${answer}`;
}

function optionAnswer(result: RoundResultRow): string | null {
  const value = Number.parseInt(result.answer ?? "", 10);
  return Number.isFinite(value) ? `Option ${value + 1}` : null;
}

function symbolScanSummary(result: RoundResultRow, puzzle: PuzzleData): BuiltDetail {
  if (puzzle.type !== "symscan") return { summary: "No answer", detail: [] };
  const parts = splitStages(result.answer);
  const results = usesScanRev1(puzzle)
    ? puzzle.stages.map((stage, i) => scanRev1StageResult(i, parseSelection(parts[i] ?? ""), scanStageMatches(stage)))
    : puzzle.stages.map((_, i) => scanStageResult(i, parseSelection(parts[i] ?? ""), puzzle.targets?.[i] ?? []));
  const perfect = results.filter((r) => r.perfect).length;
  return {
    summary: `${perfect} / 3 grids perfect · ${seconds(elapsedMs(result, puzzle))}`,
    detail: results.map((r, i) => `Grid ${i + 1}: ${r.found} / ${r.targets} found${r.wrong ? ` · ${r.wrong} wrong` : ""}`),
  };
}

function equationSummary(result: RoundResultRow, puzzle: PuzzleData): BuiltDetail {
  if (puzzle.type !== "equation") return { summary: "No answer", detail: [] };
  // equationRev 1: the answer ends "#t1,…" (tries per equation); an equation tried more often than
  // the limit does not count, exactly as the grader decides (grade.ts "equation").
  const tryLimit = equationTryLimit(puzzle);
  const { body, counts: tries } = tryLimit !== null ? splitCountSuffix(result.answer) : { body: result.answer, counts: [] };
  const parts = splitStages(body, puzzle.stages.length);
  const correct = puzzle.stages.map((st, i) =>
    equationStageCorrect(st.numbers, st.target, parts[i] ?? "") && (tryLimit === null || (tries[i] ?? 0) <= tryLimit));
  return {
    summary: `${correct.filter(Boolean).length} / ${puzzle.stages.length} equations · ${seconds(elapsedMs(result, puzzle))}`,
    detail: correct.map((ok, i) => {
      const overTries = tryLimit !== null && (tries[i] ?? 0) > tryLimit;
      return `Equation ${i + 1}: ${parts[i] ? joinOperators(parts[i]!.split(",")) : "skipped"} ${ok ? "✓" : "✗"}${overTries ? ` (over ${tryLimit} tries)` : ""}`;
    }),
  };
}

function countUpSummary(result: RoundResultRow, puzzle: PuzzleData): BuiltDetail {
  if (puzzle.type !== "countup") return { summary: "No answer", detail: [] };
  const trays = usesCountRev2(puzzle) ? puzzle.stages.length : 3;
  const parts = splitStages(result.answer, trays);
  const counts = usesCountRev2(puzzle) ? puzzle.stages.map(countUpStageTruth) : (puzzle.counts ?? []);
  const exact = counts.filter((c, i) => parseCount(parts[i] ?? "") === c).length;
  return {
    summary: `${exact} / ${trays} exact · ${seconds(elapsedMs(result, puzzle))}`,
    detail: counts.map((c, i) => `Count ${i + 1}: ${parts[i] || "—"} (answer ${c})`),
  };
}

function singleAnswer(
  display: (result: RoundResultRow, puzzle: PuzzleData) => string | null,
): SummaryBuilder {
  return (result, puzzle) => {
    const answer = display(result, puzzle);
    if (!answer)
      return { summary: `No answer · ${seconds(elapsedMs(result, puzzle))}`, detail: [] };
    const shown = marked(result, answer);
    return {
      summary: `${shown} · ${seconds(elapsedMs(result, puzzle))}`,
      detail: answer.length > 22 ? [shown] : [],
    };
  };
}

function stroopSummary(result: RoundResultRow, puzzle: PuzzleData): BuiltDetail {
  const count = result.correct_count ?? 0;
  const total = Number(result.extra?.["total"] ?? 36);
  const wrong = Number(result.extra?.["wrong"] ?? 0);
  return { summary: `${count} / ${total} · ${wrong} wrong`, detail: [] };
}

function spotDifferenceSummary(result: RoundResultRow, puzzle: PuzzleData): BuiltDetail {
  if (puzzle.type === "spotdiff" && usesSpotRev1(puzzle)) {
    const taps = parseSpotTaps(result.answer, SPOT_REV1_SCENES);
    const r = spotTwoResult(puzzle, result.answer);
    const total = SPOT_REV1_SCENES * SPOT_REV1_PER_SCENE;
    const found = r.found.reduce((a, b) => a + b, 0);
    const detail = (puzzle.differences ?? []).map((difference, index) => {
      const got = difference.cells.some((cell) => (taps[difference.scene ?? 0] ?? []).includes(cell));
      return `${index + 1}. Picture ${(difference.scene ?? 0) + 1}: ${difference.label} · ${got ? "✓" : "✗"}`;
    });
    // spotRev 2: the hidden seventh difference, never counted in the twelve (depth/doubleTake.ts).
    const bonus = puzzle.bonus;
    const hidden = bonus ? bonus.cells.some((cell) => (taps[bonus.scene ?? 0] ?? []).includes(cell)) : false;
    if (bonus) detail.push(`★ Picture ${(bonus.scene ?? 0) + 1} hidden: ${bonus.label} · ${hidden ? "✓" : "–"}`);
    const star = hidden ? " · ★" : "";
    return { summary: r.finished ? `${found} / ${total} · ${seconds(elapsedMs(result, puzzle))}${star}` : `${found} / ${total}${star}`, detail };
  }
  const count = result.correct_count ?? 0;
  const taps = (result.answer ?? "")
    .split(",")
    .map((value) => Number.parseInt(value, 10))
    .filter((value) => Number.isFinite(value));
  const detail =
    puzzle.type === "spotdiff"
      ? (puzzle.differences ?? []).map((difference, index) => {
          const got = difference.cells.some((cell) => taps.includes(cell));
          return `${index + 1}. ${difference.label} · ${got ? "✓" : "✗"}`;
        })
      : [];
  const summary =
    count >= SPOT_DIFFERENCES
      ? `${count} / ${SPOT_DIFFERENCES} · ${seconds(elapsedMs(result, puzzle))}`
      : `${count} / ${SPOT_DIFFERENCES}`;
  return { summary, detail };
}

function wordsmithSummary(result: RoundResultRow, puzzle: PuzzleData): BuiltDetail {
  const words = Array.isArray(result.extra?.["words"])
    ? result.extra["words"].filter((word): word is string => typeof word === "string")
    : [];
  const points = typeof result.extra?.["points"] === "number" ? result.extra["points"] : 0;
  if (words.length === 0) return { summary: "No words", detail: [] };
  return {
    // wordsmithRev 1 and later score word points on a curve (scoring.ts); only older rounds use 2.5 ×.
    summary:
      ((puzzle as { wordsmithRev?: number }).wordsmithRev ?? 0) >= WORDSMITH_REV_CURVE
        ? typeof result.extra?.["pangramBonus"] === "number" && result.extra["pangramBonus"] > 0
          ? `${points} word points + pangram ${result.extra["pangramBonus"]} → ${result.score} · ${words.length} words`
          : `${points} word points → ${result.score} · ${words.length} words`
        : `2.5 × ${points}, rounded down = ${result.score} · ${words.length} words`,
    detail: words.map((word) => `${word} (${wordsmithPoints(word)})`),
  };
}

function averageSummary(result: RoundResultRow): BuiltDetail {
  return { summary: `avg ${result.reaction_avg_ms ?? 0} ms`, detail: [] };
}

/** Bang On stores its average distance from the target in reaction_avg_ms: a miss, not a time. */
function stopwatchSummary(result: RoundResultRow): BuiltDetail {
  return { summary: `avg ${result.reaction_avg_ms ?? 0} ms off`, detail: [] };
}

function numberHuntSummary(result: RoundResultRow, puzzle: PuzzleData): BuiltDetail {
  // tapRev rounds store a tap log; the grader's count and finish time are in extra (grade.ts "numhunt").
  if (typeof result.extra?.["reached"] === "number") {
    const reached = result.extra["reached"] as number;
    const at = result.extra["finishedAtMs"];
    if (result.is_correct || reached >= NUMHUNT_COUNT) {
      const time = typeof at === "number" ? at : elapsedMs(result, puzzle);
      return { summary: `Finished · ${result.errors ?? 0} errors · ${seconds(time)}`, detail: [] };
    }
    return { summary: `Reached ${reached} of ${NUMHUNT_COUNT}`, detail: [] };
  }
  const [rawReached, , rawElapsed] = (result.answer ?? "").split(",");
  const reached = Math.max(0, Number.parseInt(rawReached ?? "0", 10) || 0);
  const errors = result.errors ?? 0;
  const elapsed = Number.parseInt(rawElapsed ?? "", 10);
  if (reached >= NUMHUNT_COUNT) {
    const time = Number.isFinite(elapsed) ? elapsed : elapsedMs(result, puzzle);
    return { summary: `Finished · ${errors} errors · ${seconds(time)}`, detail: [] };
  }
  return { summary: `Reached ${reached} of ${NUMHUNT_COUNT}`, detail: [] };
}

function targetSummary(result: RoundResultRow, puzzle: PuzzleData): BuiltDetail {
  if (puzzle.type !== "target") return { summary: "No answer", detail: [] };
  if (!rawAnswer(result)) return { summary: "No answer", detail: [] };
  const value = typeof result.extra?.["value"] === "number" ? result.extra["value"] : null;
  const steps = Array.isArray(result.extra?.["steps"])
    ? result.extra["steps"].filter((step): step is string => typeof step === "string")
    : [];
  if (value === null) return { summary: "No answer", detail: steps };
  if (puzzleScoreRevOf(puzzle) >= PUZZLE_SCORE_REV) {
    // Rev 1 scores the closest number the player made, never a starting tile (target.ts madeDistance).
    const made = madeDistance(puzzle.tiles, puzzle.target, replayTargetSteps(puzzle.tiles, puzzle.target, decodeSteps(result.answer ?? "")));
    if (!Number.isFinite(made)) return { summary: "No number made", detail: steps };
    return {
      summary: made === 0 ? `${puzzle.target} exact · ${Math.round(elapsedMs(result, puzzle) / 1000)}s` : `Closest made: ${made} away`,
      detail: steps,
    };
  }
  const away = Math.abs(value - puzzle.target);
  return {
    summary:
      away === 0
        ? `${value} exact · ${Math.round(elapsedMs(result, puzzle) / 1000)}s`
        : `${value} (${away} away)`,
    detail: steps,
  };
}

const rawSingle = singleAnswer((result) => rawAnswer(result));
const optionSingle = singleAnswer((result) => optionAnswer(result));

/** Raw word points and the resulting round score, with words in the expanded detail. */
const wordHuntSummary: SummaryBuilder = (result, puzzle) => {
  if (puzzle.type !== "wordhunt") return { summary: "—", detail: [] };
  const words = (result.answer ?? "")
    .split(",")
    .map((word) => word.trim().toUpperCase())
    .filter((word) => word.length > 0);
  const points = words.reduce((sum, word) => sum + wordHuntPoints(word), 0);
  // wordHuntRev 2: the share misses took off (stored by the grader), shown only when they cost something.
  const missCut = typeof result.extra?.["missCutPct"] === "number" ? result.extra["missCutPct"] : 0;
  // wordHuntRev 3 (word depth): the stored extras the long words and the golden tile added.
  if (((puzzle as { wordHuntRev?: number }).wordHuntRev ?? 0) >= 3) {
    const extras = Number(result.extra?.["extraPoints"] ?? 0);
    const gold = Array.isArray(result.extra?.["goldWords"]) ? (result.extra["goldWords"] as unknown[]).length : 0;
    return {
      summary: `${points} word points + ${extras} extra → ${result.score} · ${words.length} words${missCut > 0 ? ` · misses −${missCut}%` : ""}`,
      detail: [
        seconds(elapsedMs(result, puzzle)),
        `${gold} through the golden tile`,
        ...(words.length > 0 ? [words.join(" · ")] : ["No words"]),
      ],
    };
  }
  return {
    // wordHuntRev 1 and later score word points on a curve (scoring.ts); only older rounds use × 2.
    summary:
      ((puzzle as { wordHuntRev?: number }).wordHuntRev ?? 0) >= WORDHUNT_REV_CURVE
        ? `${points} word points → ${result.score} · ${words.length} words${missCut > 0 ? ` · misses −${missCut}%` : ""}`
        : `${points} points × 2 = ${result.score} · ${words.length} words`,
    detail: [
      seconds(elapsedMs(result, puzzle)),
      ...(words.length > 0 ? [words.join(" · ")] : ["No words"]),
    ],
  };
};

const unblockSummary: SummaryBuilder = (result, puzzle) => {
  if (puzzle.type !== "unblock") return { summary: "—", detail: [] };
  const extra = result.extra ?? {};
  const moves = Number(extra["moves"] ?? 0);
  const min = Number(extra["minMoves"] ?? puzzle.minMoves ?? 0);
  if (!result.is_correct) return { summary: "Not solved", detail: [`${moves} moves made`] };
  return {
    summary: `Solved · ${moves} moves (min ${min}) · ${seconds(elapsedMs(result, puzzle))}`,
    detail: [moves === min ? "Fewest moves possible" : `${moves - min} more than the minimum`],
  };
};

const blockPartySummary: SummaryBuilder = (result, puzzle) => {
  if (puzzle.type !== "blockparty") return { summary: "—", detail: [] };
  const covered = Number(result.extra?.["covered"] ?? 0);
  if (!result.is_correct) {
    const progress = progressOf(result, puzzle);
    if (progress) return progress;
    return {
      summary: `${covered} / ${BLOCK_FREE_CELLS}`,
      detail: [`${covered} of ${BLOCK_FREE_CELLS} squares covered`],
    };
  }
  return {
    summary: `Solved · ${seconds(elapsedMs(result, puzzle))}`,
    detail: ["Every free square covered"],
  };
};

const balanceSummary: SummaryBuilder = (result, puzzle) => {
  // With per-scale verdicts stored (extra.scales) the grader credits every balanced scale in any
  // order (correct_count); extra.solved is only the leading run.
  const solved = Number(
    Array.isArray(result.extra?.["scales"]) && result.correct_count !== null
      ? result.correct_count
      : result.extra?.["solved"] ?? result.correct_count ?? 0,
  );
  // balanceRev 2 deals four scales; stored rounds three.
  const total = puzzle.type === "balance" ? balanceScaleCount(puzzle) : 3;
  return {
    summary: solved === total ? `${total} / ${total} · ${seconds(elapsedMs(result, puzzle))}` : `${solved} / ${total}`,
    detail: [],
  };
};

const tileGridSummary: SummaryBuilder = (result) => {
  const placed = Number(result.extra?.["placed"] ?? result.correct_count ?? 0);
  const valid = Boolean(result.extra?.["valid"] ?? result.is_correct);
  const wordTiles = result.extra?.["wordTiles"];
  // A finish is all fifteen in a valid grid; a shorter grid says what counted (display only).
  return {
    summary: tileGridResultLine({ placed, valid, wordTiles: typeof wordTiles === "number" ? wordTiles : null }).text,
    detail: [],
  };
};

const wordSlideSummary: SummaryBuilder = (result, puzzle) => {
  const rows = Number(result.extra?.["rows"] ?? result.correct_count ?? 0);
  if (!result.is_correct) {
    const progress = progressOf(result, puzzle);
    if (progress) return progress;
  }
  return {
    summary: result.is_correct
      ? `Solved · 5 / 5 rows · ${seconds(elapsedMs(result, puzzle))}`
      : `${rows} / 5 rows`,
    detail: [],
  };
};

const lightsOutSummary: SummaryBuilder = (result, puzzle) => {
  if (puzzle.type !== "lightsout") return { summary: "—", detail: [] };
  const presses = Number(result.extra?.["presses"] ?? 0);
  const min = Number(result.extra?.["minPresses"] ?? puzzle.minPresses ?? 0);
  const startOn = Number(result.extra?.["lightsAtStart"] ?? 0);
  const left = Number(result.extra?.["lightsLeft"] ?? startOn);
  if (result.is_correct) {
    return {
      summary: `Solved · ${presses} presses (min ${min}) · ${seconds(elapsedMs(result, puzzle))}`,
      detail: [
        presses === min
          ? "Cleared in the fewest presses"
          : `${presses - min} more than the minimum`,
      ],
    };
  }
  return {
    summary: `Not solved · ${Math.max(0, startOn - left)} / ${startOn} off`,
    detail: [`${presses} press${presses === 1 ? "" : "es"} used`],
  };
};

const pipesSummary: SummaryBuilder = (result, puzzle) => {
  if (puzzle.type !== "pipes") return { summary: "—", detail: [] };
  const connected = Number(result.extra?.["connected"] ?? 0);
  if (result.is_correct) {
    return {
      summary: `Solved · ${seconds(elapsedMs(result, puzzle))}`,
      detail: ["Every pipe connected, no leaks"],
    };
  }
  return {
    summary: `${connected} / ${PIPES_CELLS} connected`,
    detail: [`${PIPES_CELLS - connected} tiles left off the network`],
  };
};

const sudokuSummary: SummaryBuilder = (result, puzzle) => {
  if (puzzle.type !== "sudoku") return { summary: "—", detail: [] };
  const correct = Number(result.extra?.["correct"] ?? 0);
  const total = Number(result.extra?.["total"] ?? puzzle.givens.filter((given) => !given).length);
  if (result.is_correct) {
    return {
      summary: `Solved · ${seconds(elapsedMs(result, puzzle))}`,
      detail: [`All ${total} cells filled correctly`],
    };
  }
  return {
    summary: `${correct} / ${total} cells`,
    detail: [`${total - correct} cells wrong or empty`],
  };
};

const flowSummary: SummaryBuilder = (result, puzzle) => {
  if (puzzle.type !== "flow") return { summary: "—", detail: [] };
  const joined = Number(result.extra?.["pairsJoined"] ?? 0);
  const filled = Number(result.extra?.["filled"] ?? 0);
  if (result.is_correct) {
    return {
      summary: `Solved · ${seconds(elapsedMs(result, puzzle))}`,
      detail: ["Every pair joined and every square filled"],
    };
  }
  const progress = progressOf(result, puzzle);
  if (progress) return progress;
  return {
    summary: `${joined} / ${puzzle.pairs.length || FLOW_PAIRS} pairs`,
    detail: [`${filled} / ${FLOW_CELLS - (puzzle.walls?.length ?? 0)} squares filled`],
  };
};

const slideSummary: SummaryBuilder = (result, puzzle) => {
  if (puzzle.type !== "iceslide") return { summary: "—", detail: [] };
  const moves = Number(result.extra?.["moves"] ?? 0);
  const min = Number(result.extra?.["minMoves"] ?? puzzle.minMoves ?? 0);
  if (result.is_correct) {
    return {
      summary: `Solved · ${moves} move${moves === 1 ? "" : "s"} (min ${min}) · ${seconds(elapsedMs(result, puzzle))}`,
      detail: [
        moves <= min
          ? "Reached the exit in the fewest moves"
          : `${moves - min} more than the minimum`,
      ],
    };
  }
  const away = result.extra?.["movesFromExit"];
  const distance = typeof away === "number" ? away : null;
  return {
    summary: "Not solved",
    detail: [
      distance === null
        ? `${moves} move${moves === 1 ? "" : "s"} made`
        : `${distance} move${distance === 1 ? "" : "s"} from the exit`,
    ],
  };
};

const pushSummary: SummaryBuilder = (result, puzzle) => {
  if (puzzle.type !== "push") return { summary: "—", detail: [] };
  const pushes = Number(result.extra?.["pushes"] ?? 0);
  const min = Number(result.extra?.["minPushes"] ?? puzzle.minPushes ?? 0);
  const crates = Number(result.extra?.["crates"] ?? puzzle.targets.length);
  const home = Number(result.extra?.["cratesHome"] ?? 0);
  if (result.is_correct) {
    return {
      summary: `Solved · ${pushes} push${pushes === 1 ? "" : "es"} (min ${min}) · ${seconds(elapsedMs(result, puzzle))}`,
      detail: [
        pushes <= min ? "Finished in the fewest pushes" : `${pushes - min} more than the minimum`,
      ],
    };
  }
  return {
    summary: `${home} / ${crates} crates home`,
    detail: [`${pushes} push${pushes === 1 ? "" : "es"} made`],
  };
};

const laserSummary: SummaryBuilder = (result, puzzle) => {
  if (puzzle.type !== "laser") return { summary: "—", detail: [] };
  const gems = Number(result.extra?.["gemsLit"] ?? 0);
  const fires = Math.max(1, Number(result.extra?.["fires"] ?? 1));
  const ordinal = fires === 1 ? "1st" : fires === 2 ? "2nd" : "3rd";
  if (result.is_correct) {
    return {
      summary: `${puzzle.gems.length} / ${puzzle.gems.length} gems · ${ordinal} shot · ${seconds(elapsedMs(result, puzzle))}`,
      detail: [`All ${puzzle.mirrors + (puzzle.splitterPieces ?? 0)} pieces in place`],
    };
  }
  if (gems >= 1) {
    const dark = puzzle.gems.length - gems;
    return {
      summary: `${gems} / ${puzzle.gems.length} gems`,
      detail: [
        result.extra?.["hitBomb"]
          ? "The last shot hit a bomb"
          : `${dark} gem${dark === 1 ? "" : "s"} left dark`,
      ],
    };
  }
  return {
    summary: "Missed",
    detail: [
      result.extra?.["hitBomb"]
        ? "The last shot hit a bomb"
        : `${Number(result.extra?.["mirrorsPlaced"] ?? 0)} / ${puzzle.mirrors} mirrors placed`,
    ],
  };
};

const towerSummary: SummaryBuilder = (result, puzzle) => {
  if (puzzle.type !== "tower") return { summary: "—", detail: [] };
  const moves = Number(result.extra?.["moves"] ?? 0);
  const min = Number(result.extra?.["minMoves"] ?? puzzle.minMoves);
  const home = Number(result.extra?.["discsHome"] ?? 0);
  if (result.is_correct) {
    return {
      summary: `Solved · ${moves} moves (min ${min}) · ${seconds(elapsedMs(result, puzzle))}`,
      detail: [moves <= min ? "Built in the fewest moves" : `${moves - min} more than the minimum`],
    };
  }
  return {
    summary: `${home} / ${puzzle.discs} discs`,
    detail: [`${moves} move${moves === 1 ? "" : "s"} made`],
  };
};

const mazeSummary: SummaryBuilder = (result, puzzle) => {
  if (puzzle.type !== "maze") return { summary: "—", detail: [] };
  const progress = Number(result.extra?.["progress"] ?? 0);
  // mazeRev 1 (depth/labyrinth.ts): the stars the trail took, and their stored points on a finish.
  const stars = Array.isArray(result.extra?.["stars"]) ? (result.extra!["stars"] as unknown[]).length : null;
  const starText = stars === null ? "" : ` · ★ ${stars}/${LAB_STARS}`;
  if (result.is_correct) {
    const bonus = Number(result.extra?.["starBonus"] ?? 0);
    return {
      summary: `Solved · ${seconds(elapsedMs(result, puzzle))}${starText}`,
      detail: [`${Number(result.extra?.["wasted"] ?? 0)} wasted squares`, ...(stars === null ? [] : [`${stars} of ${LAB_STARS} stars · +${bonus}`])],
    };
  }
  return { summary: `${progress}%${starText}`, detail: [`${progress}% of the way to the exit`, ...(stars ? ["Stars count only with a finish"] : [])] };
};

const tubesSummary: SummaryBuilder = (result, puzzle) => {
  if (puzzle.type !== "tubes") return { summary: "—", detail: [] };
  const moves = Number(result.extra?.["moves"] ?? 0);
  const min = Number(result.extra?.["minMoves"] ?? puzzle.minMoves ?? 0);
  const sorted = Number(result.extra?.["sorted"] ?? 0);
  if (result.is_correct) {
    return {
      summary: `Solved · ${moves} moves (min ${min}) · ${seconds(elapsedMs(result, puzzle))}`,
      detail: [
        moves <= min ? "Sorted in the fewest pours" : `${moves - min} more than the minimum`,
      ],
    };
  }
  return {
    summary: `${sorted} / ${TUBES_COLOURS} tubes`,
    detail: [`${moves} pour${moves === 1 ? "" : "s"} made`],
  };
};

const safeSummary: SummaryBuilder = (result, puzzle) => {
  if (puzzle.type !== "safe") return { summary: "—", detail: [] };
  const openedOn = Number(result.extra?.["openedOn"] ?? 0);
  const right = Number(result.extra?.["dialsRight"] ?? 0);
  if (result.is_correct) {
    return {
      summary: `Opened · ${ordinalTry(openedOn)} try · ${seconds(elapsedMs(result, puzzle))}`,
      detail: [openedOn === 1 ? "Opened first time" : `${openedOn} tries used`],
    };
  }
  return {
    summary: `Locked · ${right} / ${SAFE_DIALS} dials`,
    detail: [`${Number(result.extra?.["tries"] ?? 0)} tries used`],
  };
};

const bombSummary: SummaryBuilder = (result, puzzle) => {
  if (puzzle.type !== "bomb") return { summary: "—", detail: [] };
  const prefix = Number(result.extra?.["correctPrefix"] ?? 0);
  const exploded = Boolean(result.extra?.["exploded"]);
  if (result.is_correct) {
    return {
      summary: `Defused · ${seconds(elapsedMs(result, puzzle))}`,
      detail: ["Every required action, in an order the rules allow"],
    };
  }
  return {
    summary: exploded
      ? `Exploded · ${prefix} / ${puzzle.stepCount}`
      : `${prefix} / ${puzzle.stepCount}`,
    detail: [
      `${prefix} action${prefix === 1 ? "" : "s"} carried out correctly`,
      (puzzle.bombVersion ?? 1) >= 2
        ? puzzleScoreRevOf(puzzle) >= PUZZLE_SCORE_REV_BANDS
          ? "Correct steps before a strike count as progress (score bands)"
          : puzzleScoreRevOf(puzzle) >= PUZZLE_SCORE_REV
          ? `22 per correct step, five of six = 110`
          : `75 × ${prefix} ÷ ${puzzle.stepCount}, rounded`
        : `25 per correct step, up to 75`,
    ],
  };
};

function ordinalTry(value: number): string {
  return value === 1 ? "1st" : value === 2 ? "2nd" : value === 3 ? "3rd" : `${value}th`;
}

const gravitySummary: SummaryBuilder = (result, puzzle) => {
  if (puzzle.type !== "gravity") return { summary: "—", detail: [] };
  const tilts = Number(result.extra?.["tilts"] ?? 0);
  // gravityRev 3 (the remodel, topsy.ts): three boards, balls home and stars.
  if (isTopsy(puzzle)) {
    const cleared = Number(result.extra?.["cleared"] ?? 0);
    const home = Number(result.extra?.["home"] ?? 0);
    const stars = Number(result.extra?.["stars"] ?? 0);
    const out = Number(result.extra?.["outOfTilts"] ?? 0);
    return {
      summary: result.is_correct
        ? `Cleared · ${stars} / ${TOPSY_BOARDS * TOPSY_STARS} stars · ${seconds(elapsedMs(result, puzzle))}`
        : `${cleared} / ${TOPSY_BOARDS} boards · ${home} / ${TOPSY_BOARDS * TOPSY_BALLS} home`,
      detail: [`${tilts} tilts made${out ? ` · out of tilts on ${out} board${out === 1 ? "" : "s"}` : ""}`],
    };
  }
  const min = Number(result.extra?.["minMoves"] ?? puzzle.minMoves ?? 0);
  const locked = Number(result.extra?.["locked"] ?? 0);
  if (result.is_correct) {
    return {
      summary: `Solved · ${tilts} tilts (min ${min}) · ${seconds(elapsedMs(result, puzzle))}`,
      detail: [
        tilts <= min ? "Solved in the fewest tilts" : `${tilts - min} more than the minimum`,
      ],
    };
  }
  return {
    summary: "Not solved",
    detail: [`${locked} / 4 balls locked · ${tilts} tilts made`],
  };
};

const chainSummary: SummaryBuilder = (result, puzzle) => {
  if (puzzle.type !== "chain") return { summary: "—", detail: [] };
  const links = Number(result.extra?.["links"] ?? 0);
  const rules = chainRules(puzzle);
  const reason = String(result.extra?.["reason"] ?? "timer");
  const ending =
    reason === "complete"
      ? "Full chain"
      : reason === "wrong"
        ? `Broken at link ${links + 1} - wrong tap`
        : reason === "momentum"
          ? `Broken at link ${links + 1} - too slow`
          : "Time ran out";
  return {
    summary: `${links} / ${rules.length} links · ${seconds(elapsedMs(result, puzzle))}`,
    detail: [ending, puzzleScoreRevOf(puzzle) >= PUZZLE_SCORE_REV_BANDS && rules.bonus
      ? "Links count as progress; all of them is a finish, quicker for more (score bands)"
      : puzzleScoreRevOf(puzzle) >= PUZZLE_SCORE_REV && rules.bonus
      ? `110 × links ÷ ${rules.length - 1}, rounded down · all ${rules.length} links = 120 + up to 30 for speed (full with half the time left)`
      : `${rules.points} per link${rules.bonus ? ", rounded down" : ""} · ${rules.length} links = ${rules.length * rules.points}${rules.bonus ? ` + up to ${rules.bonus} for speed (full with half the time left)` : ""}`],
  };
};

const nonogramSummary: SummaryBuilder = (result, puzzle) => {
  if (puzzle.type !== "nonogram") return { summary: "—", detail: [] };
  const correct = Number(result.extra?.["correct"] ?? 0);
  const total = Number(result.extra?.["total"] ?? 0);
  const wrong = Number(result.extra?.["wrong"] ?? 0);
  return {
    summary: result.is_correct
      ? `Solved · ${seconds(elapsedMs(result, puzzle))}`
      : `${correct} / ${total} cells`,
    detail: wrong > 0 ? [`${wrong} cell${wrong === 1 ? "" : "s"} filled wrongly`] : [],
  };
};

const pairMatchSummary: SummaryBuilder = (result, puzzle) => {
  if (puzzle.type !== "pairmatch") return { summary: "—", detail: [] };
  const pairs = Number(result.extra?.["pairs"] ?? 0);
  const flips = Number(result.extra?.["flips"] ?? 0);
  return {
    summary: `${pairs} / ${PAIR_PAIRS} · ${flips} flips · ${seconds(elapsedMs(result, puzzle))}`,
    detail: [result.is_correct ? "Every pair found" : "Board unfinished"],
  };
};

const floodSummary: SummaryBuilder = (result, puzzle) => {
  if (puzzle.type !== "flood") return { summary: "—", detail: [] };
  const moves = Number(result.extra?.["moves"] ?? 0);
  const par = Number(result.extra?.["par"] ?? 0);
  const region = Number(result.extra?.["region"] ?? 0);
  return {
    summary: result.is_correct
      ? `Solved · ${moves} moves (par ${par}) · ${seconds(elapsedMs(result, puzzle))}`
      : `${region} / ${FLOOD_CELLS} cells`,
    detail: [result.is_correct && moves <= par ? "Flooded in par" : `${moves} moves made`],
  };
};

const tilesSummary: SummaryBuilder = (result, puzzle) => {
  if (puzzle.type !== "tiles") return { summary: "—", detail: [] };
  const moves = Number(result.extra?.["moves"] ?? 0);
  // tilesRev 3 (the remodel, jumbled.ts): the gradient, moves against par.
  if (isJumbledGradient(puzzle)) {
    const par = Number(result.extra?.["par"] ?? puzzle.par ?? 0);
    const inPlaceNow = Number(result.extra?.["inPlace"] ?? 0);
    // Unfinished: the progress its credit counts (progressFigures.ts: tiles put in place).
    const progress = result.is_correct ? null : progressOf(result, puzzle);
    if (progress) return { summary: progress.summary, detail: [...progress.detail, `${moves} moves made`] };
    return {
      summary: result.is_correct
        ? `Solved · ${moves} moves (par ${par}) · ${seconds(elapsedMs(result, puzzle))}`
        : `${inPlaceNow} / ${JUMBLED_MOVABLE} in place`,
      detail: [result.is_correct && moves <= par ? "At or under par" : `${moves} moves made`],
    };
  }
  const min = Number(result.extra?.["minMoves"] ?? puzzle.minMoves ?? 0);
  const inPlace = Number(result.extra?.["inPlace"] ?? 0);
  const progress = result.is_correct ? null : progressOf(result, puzzle);
  if (progress) return { summary: progress.summary, detail: [...progress.detail, `${moves} moves made`] };
  return {
    summary: result.is_correct
      ? `Solved · ${moves} moves${min ? ` (min ${min})` : ""} · ${seconds(elapsedMs(result, puzzle))}`
      : `${inPlace} / ${tilesLayout(puzzle).count} in place`,
    detail: [
      result.is_correct && min > 0 && moves <= min
        ? "Solved in the minimum"
        : `${moves} moves made`,
    ],
  };
};

const hoverSummary: SummaryBuilder = (result) => {
  const gates = Number(result.extra?.["gates"] ?? 0);
  const total = Number(result.extra?.["totalGates"] ?? 0);
  const survived = result.extra?.["survived"] === true;
  const ended = Number(result.extra?.["endedSeconds"] ?? 0);
  return {
    summary: survived
      ? `${gates} / ${total} · survived`
      : `${gates} / ${total} barriers · crashed at ${ended.toFixed(1)}s`,
    detail: [survived ? "Flew the whole run" : "Run ended early"],
  };
};

const swerveSummary: SummaryBuilder = (result) => {
  const coins = Number(result.extra?.["coins"] ?? 0);
  const total = Number(result.extra?.["totalCoins"] ?? 0);
  const survived = result.extra?.["survived"] === true;
  const ended = Number(result.extra?.["endedSeconds"] ?? 0);
  return {
    summary: survived
      ? `${coins} / ${total} coins · survived`
      : `${coins} / ${total} coins · crashed at ${ended.toFixed(1)}s`,
    detail: [survived ? "Drove the whole run" : "Run ended early"],
  };
};

const skylineSummary: SummaryBuilder = (result) => {
  const blocks = Number(result.extra?.["blocks"] ?? 0);
  const perfects = Number(result.extra?.["perfects"] ?? 0);
  const survived = result.extra?.["survived"] === true;
  const ended = Number(result.extra?.["endedSeconds"] ?? 0);
  return {
    summary: survived
      ? `${blocks} blocks · ${perfects} perfect · survived`
      : `${blocks} blocks · missed at ${ended.toFixed(1)}s`,
    detail: [
      `${perfects} perfect drop${perfects === 1 ? "" : "s"}`,
      ...(result.extra?.["skylineRev"] ? [`Best streak ${Number(result.extra?.["bestStreak"] ?? 0)} in a row`] : []),
      // skylineRev 7: the expansion's gold blocks and height milestones.
      ...(Number(result.extra?.["skylineRev"] ?? 0) >= 7 ? [`${Number(result.extra?.["golds"] ?? 0)} gold · ${Number(result.extra?.["milestones"] ?? 0)} milestones`] : []),
    ],
  };
};

const binTossSummary: SummaryBuilder = (result) => {
  const baskets = Number(result.extra?.["baskets"] ?? 0);
  const total = Number(result.extra?.["throws"] ?? 10);
  return {
    summary: `${baskets} / ${total} in`,
    detail: [baskets >= total ? "Every throw in" : `${total - baskets} missed`],
  };
};

const matchupSummary: SummaryBuilder = (result) => {
  const raw = Number(result.extra?.["raw"] ?? 0);
  const swaps = Number(result.extra?.["swaps"] ?? 0);
  const bestLine = Number(result.extra?.["bestLine"] ?? 0);
  const reshuffles = Number(result.extra?.["reshuffles"] ?? 0);
  return {
    summary: `${raw.toLocaleString("en-GB")} pts → ${result.score} · ${swaps} swaps · best line ${bestLine || "-"}`,
    detail: [
      `${swaps} scoring swap${swaps === 1 ? "" : "s"}`,
      ...(reshuffles > 0 ? [`${reshuffles} reshuffled`] : []),
    ],
  };
};

const bullseyeSummary: SummaryBuilder = (result) => {
  const inner = Number(result.extra?.["inner"] ?? 0);
  return {
    summary: `${result.score} · ${inner} in the gold/red`,
    detail: [`${Number(result.extra?.["total"] ?? 0)} ring points`],
  };
};

const snakeSummary: SummaryBuilder = (result) => {
  const pellets = Number(result.extra?.["pellets"] ?? 0);
  const survived = result.extra?.["survived"] === true;
  const ended = Number(result.extra?.["endedSeconds"] ?? 0);
  return {
    summary: survived
      ? `${pellets} star${pellets === 1 ? "" : "s"} · survived`
      : result.extra?.["rockHit"] === true
        ? `${pellets} star${pellets === 1 ? "" : "s"} · hit a rock at ${ended.toFixed(1)}s`
        : `${pellets} star${pellets === 1 ? "" : "s"} · crashed at ${ended.toFixed(1)}s`,
    detail: [survived ? "Lasted the whole minute" : "Run ended early"],
  };
};

const crossSummary: SummaryBuilder = (result) => {
  const crossings = Number(result.extra?.["crossings"] ?? 0);
  const lost = Number(result.extra?.["livesLost"] ?? 0);
  const lanes = Number(result.extra?.["lanes"] ?? 0);
  return {
    summary: crossLine({ crossings, livesLost: lost }),
    detail: [`${lanes} lane${lanes === 1 ? "" : "s"} crossed in total`],
  };
};

const dualSummary: SummaryBuilder = (result) => {
  const passed = Number(result.extra?.["passed"] ?? 0);
  const survived = result.extra?.["survived"] === true;
  const side = Number(result.extra?.["crashedSide"] ?? -1);
  const ended = Number(result.extra?.["endedSeconds"] ?? 0);
  return {
    summary: survived
      ? `Survived 60.0s · ${passed} passed`
      : `Survived ${ended.toFixed(1)}s · ${passed} passed (${side === 0 ? "left" : "right"} crashed)`,
    detail: [survived ? "Both runners lasted the minute" : "One runner hit a spike"],
  };
};

const ricoSummary: SummaryBuilder = (result) => {
  const metres = Math.trunc(Number(result.extra?.["heightPx"] ?? 0) / 40);
  const survived = result.extra?.["survived"] === true;
  const spiked = result.extra?.["spiked"] === true;
  const ended = Number(result.extra?.["endedSeconds"] ?? 0);
  return {
    summary: survived
      ? `${metres.toLocaleString("en-GB")} m climbed · ${result.score} points · survived`
      : `${metres.toLocaleString("en-GB")} m climbed · ${result.score} points · ${spiked ? "hit a spike" : "slid down"} at ${ended.toFixed(1)}s`,
    detail: [`${Number(result.extra?.["leaps"] ?? 0)} leaps`],
  };
};

const breakerSummary: SummaryBuilder = (result) => {
  const hits = Number(result.extra?.["hits"] ?? 0);
  const left = Number(result.extra?.["bricksLeft"] ?? 0);
  const powerUps = Number(result.extra?.["powerUps"] ?? 0);
  const cleared = result.extra?.["cleared"] === true;
  const ended = Number(result.extra?.["endedSeconds"] ?? 0);
  return {
    summary: cleared
      ? `Cleared at ${ended.toFixed(1)}s`
      : `${Number(result.extra?.["destroyed"] ?? 80 - left)} / ${Number(result.extra?.["wall"] ?? 80)} bricks · ${hits} hits · ${powerUps} power-up${powerUps === 1 ? "" : "s"}`,
    // brkRev 9: the skill points too.
    detail: [`${Number(result.extra?.["losses"] ?? 0)} relaunches`, ...(result.extra?.["wall"] !== undefined ? [`${Number(result.extra?.["goldBroken"] ?? 0)} gold · combo ${Number(result.extra?.["comboPts"] ?? 0)} · skill +${Number(result.extra?.["skill"] ?? 0)}`] : [])],
  };
};

const pinballSummary: SummaryBuilder = (result) => {
  const n = (key: string) => Number(result.extra?.[key] ?? 0);
  const left = n("ballsLeft");
  return {
    summary: `${n("points").toLocaleString("en-GB")} table points · ${n("bumps")} bumper hits · ${n("drops")} targets`,
    detail: [
      `Multiplier ×${Math.max(1, n("mult"))}`,
      // pinRev 4 (the expansion): ramps, multiball, jackpots and skill shots.
      ...(n("pinRev") >= 4 ? [`${n("ramps")} ramps · ${n("multiballs")} multiball · ${n("jackpots")} jackpots · ${n("skills")} skill shots`] : []),
      left > 0 ? `Clock ran out with ${left} ball${left === 1 ? "" : "s"} left` : "All three balls drained",
    ],
  };
};

const rallySummary: SummaryBuilder = (result, puzzle) => {
  const hits = Number(result.extra?.["hits"] ?? 0);
  const goldHits = Number(result.extra?.["goldHits"] ?? 0);
  const targetHits = Number(result.extra?.["targetHits"] ?? 0);
  const survived = result.extra?.["survived"] === true;
  const ended = Number(result.extra?.["endedSeconds"] ?? 0);
  // What each scored by the round's own revision: unstamped 2.5 a gold hit; rallyRev 2 adds 3 a pad; rallyRev 3+ goes through the band curve (the help gives its values), so only the counts.
  const rev = puzzle.type === "rally" ? (puzzle.rallyRev ?? 0) : 0;
  const pads = `${targetHits} pink pad${targetHits === 1 ? "" : "s"}`;
  const gold =
    rev >= 3
      ? `${goldHits} gold hit${goldHits === 1 ? "" : "s"} · ${pads}`
      : rev === 2
        ? `${goldHits} gold hit${goldHits === 1 ? "" : "s"} (2.5 each, rounded down) · ${pads} (3 each)`
        : `${goldHits} gold hit${goldHits === 1 ? "" : "s"} (2.5 each, rounded down)`;
  return {
    summary: survived
      ? `${gold} · ${hits} blue returns · survived`
      : `${gold} · ${hits} blue returns · lost at ${ended.toFixed(1)}s`,
    detail: [survived ? "Kept the rally alive" : "Lost the ball"],
  };
};

const steadySummary: SummaryBuilder = (result) => {
  const metres = Number(result.extra?.["metres"] ?? 0);
  const touches = Number(result.extra?.["touches"] ?? 0);
  const clean = result.extra?.["clean"] === true;
  return {
    summary: `${metres} m · ${touches} touch${touches === 1 ? "" : "es"}`,
    detail: [clean ? "No touches" : `${touches} touch${touches === 1 ? "" : "es"} (−5 each)`],
  };
};

const sliceSummary: SummaryBuilder = (result) => {
  const slices = Number(result.extra?.["slices"] ?? 0);
  const total = Number(result.extra?.["totalDiscs"] ?? 0);
  const chillies = Number(result.extra?.["bombsHit"] ?? 0);
  return {
    summary: `Sliced ${slices} / ${total} · best combo ×${Number(result.extra?.["bestMult"] ?? 1)}`,
    detail: [`${chillies} ${chillies === 1 ? "chilli" : "chillies"} cut`],
  };
};

const bubbleSummary: SummaryBuilder = (result) => {
  const popped = Number(result.extra?.["popped"] ?? 0);
  const dropped = Number(result.extra?.["dropped"] ?? 0);
  const cleared = result.extra?.["cleared"] === true;
  const ended = Number(result.extra?.["endedSeconds"] ?? 0);
  return {
    summary: cleared
      ? `Cleared at ${ended.toFixed(1)}s`
      : `${Number(result.extra?.["bubblesLeft"] ?? 0)} bubbles left · popped ${popped} · dropped ${dropped}`,
    detail: [`${Number(result.extra?.["shots"] ?? 0)} shots`],
  };
};

const beatSummary: SummaryBuilder = (result) => {
  const hits = Number(result.extra?.["hits"] ?? 0);
  const notes = Number(result.extra?.["noteCount"] ?? 0);
  const perfect = Number(result.extra?.["perfect"] ?? 0);
  const misses = Number(result.extra?.["misses"] ?? 0);
  return {
    summary: `${hits} / ${notes} · ${perfect} perfect · ${misses} miss${misses === 1 ? "" : "es"}`,
    detail: [`best combo ${Number(result.extra?.["maxCombo"] ?? 0)}`],
  };
};

const whackSummary: SummaryBuilder = (result, puzzle) => {
  const hits = Number(result.extra?.["hits"] ?? 0);
  const wrong = Number(result.extra?.["wrong"] ?? 0);
  const total = Number(result.extra?.["totalTargets"] ?? 0);
  const empty = Number(result.extra?.["empty"] ?? 0);
  const bombs = Number(result.extra?.["bombs"] ?? 0);
  return {
    summary: `Hits ${hits} / ${total} · Wrong ${wrong} · Hedgehogs ${bombs} · Empty ${empty}`,
    // whackRev 1 lifts that score on the scoring-target curve, so the old formula is shown only for older rounds.
    detail: (puzzle as { whackRev?: number }).whackRev
      ? []
      : ["135 × share hit · −3 per wrong hat · −5 per hedgehog · −3 per empty tap · +15 for every target"],
  };
};

const tenDropSummary: SummaryBuilder = (result) => {
  const cleared = Number(result.extra?.["cleared"] ?? 0);
  const resets = Number(result.extra?.["resets"] ?? 0);
  // tenRev 4: tens made by the gold tile.
  const gold = result.extra?.["goldTens"];
  return {
    summary: `${cleared} / 10 targets`,
    detail: [`${resets} reset${resets === 1 ? "" : "s"}`, ...(typeof gold === "number" ? [`${gold} gold ten${gold === 1 ? "" : "s"}`] : [])],
  };
};

const wordfallSummary: SummaryBuilder = (result) => {
  const points = Number(result.extra?.["points"] ?? 0);
  const par = Number(result.extra?.["par"] ?? WF_PAR);
  const words = Number(result.extra?.["words"] ?? 0);
  const best = Array.isArray(result.extra?.["best"]) ? (result.extra["best"] as unknown[]).map(String) : [];
  const overflow = result.extra?.["overflow"] === true;
  return {
    summary: `${words} word${words === 1 ? "" : "s"} · ${points} / ${par} points`,
    detail: [
      ...(best.length ? [`Best: ${best.slice(0, 3).join(", ")}`] : []),
      ...(overflow ? ["A column overflowed"] : []),
    ],
  };
};

const clayShootSummary: SummaryBuilder = (result, puzzle) => {
  const hits = Number(result.extra?.["hits"] ?? 0);
  const total = Number(result.extra?.["total"] ?? 25);
  const orange = Number(result.extra?.["orangeHits"] ?? 0);
  const gold = Number(result.extra?.["goldHits"] ?? 0);
  const birds = Number(result.extra?.["birdHits"] ?? 0);
  const birdTotal = Number(result.extra?.["birdTotal"] ?? 0);
  const shots = Number(result.extra?.["shots"] ?? 0);
  // clayRev 4+: the stored empty-shot cost, so a full house below 150 is explained.
  const empty = Number(result.extra?.["emptyShots"] ?? 0);
  const emptyCost = Number(result.extra?.["emptyShotCost"] ?? 0);
  // clayRev 7 (score bands): the total goes through a curve, so bird and empty-shot costs are not score points.
  const unit = puzzle.type === "clayshoot" && (puzzle.clayRev ?? 0) >= CLAY_REV_BANDS ? " from the total" : "";
  return {
    summary: `${hits} / ${total} clays`,
    detail: [`${orange} orange · ${gold} gold · ${shots} shot${shots === 1 ? "" : "s"}${birdTotal > 0 ? ` · ${birds} bird${birds === 1 ? "" : "s"} hit (−${birds * 10}${unit})` : ""}${emptyCost > 0 ? ` · ${empty} empty shot${empty === 1 ? "" : "s"} (−${emptyCost}${unit})` : ""}`],
  };
};

const wavefrontSummary: SummaryBuilder = (result) => {
  const wave = Number(result.extra?.["wave"] ?? 1);
  const shapes = Number(result.extra?.["shapesDown"] ?? 0);
  const saucers = Number(result.extra?.["saucers"] ?? 0);
  const survived = result.extra?.["survived"] !== false;
  const ended = Number(result.extra?.["endedSeconds"] ?? 0);
  const head = `Wave ${wave} · ${shapes} ship${shapes === 1 ? "" : "s"} · ${saucers} saucer${saucers === 1 ? "" : "s"}`;
  // wavRev 2: the run ends early when the boss goes down.
  const bossDown = Number(result.extra?.["bossKilled"] ?? 0) > 0;
  return {
    summary: bossDown
      ? `Boss destroyed at ${ended.toFixed(1)}s · ${shapes} ships`
      : survived ? `${head} · survived` : `${head} · destroyed at ${ended.toFixed(1)}s`,
    detail: [
      `${Number(result.extra?.["wavesCleared"] ?? 0)} waves cleared · ${Number(result.extra?.["armourHits"] ?? 0)} armour hits`,
    ],
  };
};

const bastionSummary: SummaryBuilder = (result) => {
  const destroyed = Number(result.extra?.["destroyed"] ?? 0);
  const health = Number(result.extra?.["health"] ?? 0);
  const survived = result.extra?.["survived"] !== false;
  const ended = Number(result.extra?.["endedSeconds"] ?? 0);
  const head = `${destroyed} destroyed · base ${health} / 5`;
  return {
    summary: survived ? `${head} · survived` : `${head} · base fell at ${ended.toFixed(1)}s`,
    detail: ["Same waves for everyone"],
  };
};

const rooftopSummary: SummaryBuilder = (result) => {
  const survived = result.extra?.["survived"] !== false;
  const ended = Number(result.extra?.["survivedSeconds"] ?? result.extra?.["endedSeconds"] ?? 0);
  return {
    summary: survived ? "Survived the minute" : `Survived ${ended.toFixed(1)}s`,
    detail: ["Same course for everyone"],
  };
};

const flipSummary: SummaryBuilder = (result) => {
  const survived = result.extra?.["survived"] !== false;
  const ended = Number(result.extra?.["survivedSeconds"] ?? 0);
  return {
    summary: survived ? "Survived the minute" : `Survived ${ended.toFixed(1)}s`,
    detail: ["Same corridor for everyone"],
  };
};

const junctionSummary: SummaryBuilder = (result) => {
  const cleared = Number(result.extra?.["cleared"] ?? 0);
  const gaveUp = Number(result.extra?.["gaveUp"] ?? 0);
  const survived = result.extra?.["survived"] !== false;
  const ended = Number(result.extra?.["survivedSeconds"] ?? 0);
  const head = `${cleared} cleared · ${gaveUp} drove off`;
  const through = Number(result.extra?.["ambThrough"] ?? 0);
  const stopped = Number(result.extra?.["ambStopped"] ?? 0);
  return {
    summary: survived ? `${head} · survived` : `${head} · crash at ${ended.toFixed(1)}s`,
    detail: [
      `Ambulances: ${through} through · ${stopped} stopped`,
      ...(result.extra?.["junctionRev"] ? [`${Number(result.extra?.["busCleared"] ?? 0)} buses · ${Number(result.extra?.["diagCleared"] ?? 0)} from the new roads`] : []),
    ],
  };
};

const inkBridgeSummary: SummaryBuilder = (result, puzzle) => {
  const levels = Number(result.extra?.["levels"] ?? 0);
  const total = Number(result.extra?.["total"] ?? 10);
  const rev = puzzle.type === "inkbridge" ? puzzle.inkRev : undefined;
  const current = levels < total ? levels + 1 : total;
  let phase = "";
  if (rev === 3 && levels < total) {
    phase = current <= 4 ? " (Standard)" : current <= 8 ? " (Moving Pot)" : " (Live)";
  }
  return {
    summary: levels >= total ? `All ${total} · ${result.score}` : `Level ${current}${phase} · ${result.score} points`,
    detail: ["Same levels for everyone"],
  };
};

const orbitSummary: SummaryBuilder = (result) => {
  const passed = Number(result.extra?.["passed"] ?? result.extra?.["captured"] ?? 0);
  const total = Number(result.extra?.["total"] ?? 0);
  const survived = result.extra?.["survived"] !== false;
  const ended = Number(result.extra?.["survivedSeconds"] ?? 0);
  const left = Number(result.extra?.["secondsLeft"] ?? 0);
  const head = `${passed} / ${total} planets`;
  if (result.extra?.["finished"] === true)
    return { summary: `${passed} / ${total} · finished with ${left.toFixed(1)}s left`, detail: ["Same planets for everyone"] };
  return {
    summary: survived ? `${head} · survived` : `${head} · lost at ${ended.toFixed(1)}s`,
    detail: ["Same planets for everyone"],
  };
};

const snipSummary: SummaryBuilder = (result) => {
  const eaten = Number(result.extra?.["eaten"] ?? 0);
  const stars = Number(result.extra?.["stars"] ?? 0);
  const levels = Number(result.extra?.["levels"] ?? 0);
  return {
    summary: `${eaten} apple${eaten === 1 ? "" : "s"} · ${stars} lea${stars === 1 ? "f" : "ves"} · ${result.score ?? 0}`,
    detail: [`${levels} level${levels === 1 ? "" : "s"} played`],
  };
};

const swingSummary: SummaryBuilder = (result) => {
  const metres = Number(result.extra?.["metres"] ?? 0);
  const survived = result.extra?.["survived"] !== false;
  const ended = Number(result.extra?.["survivedSeconds"] ?? 0);
  return {
    summary: survived ? `${metres} m · survived · ${result.score ?? 0}` : `${metres} m · fell at ${ended.toFixed(1)}s · ${result.score ?? 0}`,
    detail: ["Same cavern for everyone"],
  };
};

const tiltSummary: SummaryBuilder = (result) => {
  const mazes = Number(result.extra?.["mazes"] ?? 0);
  const survived = result.extra?.["survived"] !== false;
  const ended = Number(result.extra?.["survivedSeconds"] ?? 0);
  const head = `${mazes} ${mazes === 1 ? "maze" : "mazes"} completed`;
  return {
    summary:
      mazes >= 4
        ? `4 / 4 mazes · ${Number(result.extra?.["secondsLeft"] ?? 0).toFixed(1)}s left`
        : survived
          ? `${head} · survived`
          : `${head} · ${result.extra?.["caught"] === true ? "caught by the red ball" : "dark hole"} at ${ended.toFixed(1)}s`,
    detail: result.extra?.["tiltRev"]
      ? [`${Number(result.extra?.["stars"] ?? 0)} / ${Number(result.extra?.["totalStars"] ?? 0)} stars`, "Same mazes for everyone"]
      : ["Same mazes for everyone"],
  };
};

const hotFloorSummary: SummaryBuilder = (result) => {
  const stages = Number(result.extra?.["stages"] ?? 0);
  const livesLost = Number(result.extra?.["livesLost"] ?? 0);
  const completed = Number(result.extra?.["completedSeconds"] ?? 0);
  return {
    summary: stages >= 10 ? `10 stages · ${completed.toFixed(1)}s` : `${stages} stages · ${livesLost} ${livesLost === 1 ? "life" : "lives"} lost`,
    detail: ["Same floor for everyone"],
  };
};

const burstSummary: SummaryBuilder = (result) => {
  const wave = Math.max(1, Number(result.extra?.["wave"] ?? 1));
  const hits = Number(result.extra?.["hits"] ?? 0);
  const lost = Number(result.extra?.["livesLost"] ?? 0);
  return {
    summary: `Wave ${wave} · ${hits} popped · ${lost} ${lost === 1 ? "life" : "lives"} lost · ${result.score}`,
    detail: ["Same waves for everyone"],
  };
};

const shikakuSummary: SummaryBuilder = (result, puzzle) => {
  if (result.is_correct) return { summary: `Solved · ${seconds(elapsedMs(result, puzzle))}`, detail: [] };
  const progress = progressOf(result, puzzle);
  if (progress) return progress;
  return { summary: `${Number(result.extra?.["covered"] ?? 0)} / ${puzzle.type === "shikaku" ? puzzle.size * puzzle.size : 81} covered`, detail: [] };
};

const lightUpSummary: SummaryBuilder = (result, puzzle) => {
  if (result.is_correct) return { summary: `Solved · ${seconds(elapsedMs(result, puzzle))}`, detail: [] };
  const progress = progressOf(result, puzzle);
  if (progress) return progress;
  const lit = Number(result.extra?.["lit"] ?? 0);
  const whites = Number(result.extra?.["whites"] ?? 0);
  const clashing = Number(result.extra?.["clashing"] ?? 0);
  return {
    summary: `${lit} / ${whites} lit`,
    detail: clashing ? [`${clashing} bulb${clashing === 1 ? "" : "s"} shining on another`] : [],
  };
};

const ballTrackSummary: SummaryBuilder = (result) => {
  const home = Number(result.extra?.["home"] ?? 0);
  const speed = Number(result.extra?.["speed"] ?? 0);
  const tail = speed ? ` · +${speed} speed` : "";
  return { summary: `${home} / ${BT_BALLS} home${tail}`, detail: ["Same track for everyone"] };
};

const numberPyramidSummary: SummaryBuilder = (result, puzzle) => {
  const completed = Number(result.extra?.["completed"] ?? 0);
  if (result.is_correct) return { summary: `4 / 4 complete · ${seconds(elapsedMs(result, puzzle))}`, detail: [] };
  return { summary: `${completed} / 4 pyramids complete`, detail: [] };
};

const measureSummary: SummaryBuilder = (result, puzzle) => {
  const solved = Number(result.extra?.["solved"] ?? 0);
  const boards = (result.extra?.["boards"] as { solved: boolean; moves: number; minMoves: number }[] | undefined) ?? [];
  const detail = boards.flatMap((b, i) => (b.solved ? [`Puzzle ${i + 1}: ${b.moves} moves (fewest ${b.minMoves})`] : []));
  if (result.is_correct) return { summary: `4 / 4 solved · ${seconds(elapsedMs(result, puzzle))}`, detail };
  return { summary: `${solved} / 4 solved`, detail };
};

const checkoutSummary: SummaryBuilder = (result, puzzle) => {
  const solved = Number(result.extra?.["solved"] ?? 0);
  const fewest = Number(result.extra?.["fewest"] ?? 0);
  const detail = solved ? [`${fewest} in the fewest darts`] : [];
  if (result.is_correct) return { summary: `5 / 5 checked out · ${seconds(elapsedMs(result, puzzle))}`, detail };
  return { summary: `${solved} / 5 checked out`, detail };
};

const numlineSummary: SummaryBuilder = (result) => {
  const placed = Number(result.extra?.["placed"] ?? 0);
  const close = Number(result.extra?.["withinFull"] ?? 0);
  // numlineRev 2 counts "close" within 1 %; stored rounds within 2 %.
  const within = Number(result.extra?.["numlineRev"] ?? 1) >= 2 ? "1%" : "2%";
  return { summary: `${placed} / 15 placed · ${close} within ${within}`, detail: [] };
};

const trailSummary: SummaryBuilder = (result) => {
  const correctTiles = Number(result.extra?.["correctTiles"] ?? (result.is_correct ? 26 : 0));
  return { summary: `${correctTiles} / 26 tiles correct`, detail: [] };
};

const digSummary: SummaryBuilder = (result) => {
  const collected = Number(result.extra?.["collected"] ?? 0);
  const targets = (result.extra?.["targets"] as number[] | undefined) ?? [];
  const total = targets.reduce((a, b) => a + b, 0);
  const dug = Number(result.extra?.["dug"] ?? 0);
  const min = Number(result.extra?.["minDigs"] ?? 0);
  const detail = [`${dug} digs (min ${min})`];
  const toxic = Number(result.extra?.["toxic"] ?? 0);
  if (toxic) detail.push(`${toxic} toxic`);
  return { summary: result.is_correct ? `Drained · ${collected} / ${total}` : `${collected} / ${total} clean`, detail };
};

const wordSearchSummary: SummaryBuilder = (result) => {
  const found = Number(result.extra?.["found"] ?? 0);
  const total = Number(result.extra?.["total"] ?? 6);
  // wordSearchRev 3 (word depth): the hidden bonus word.
  const bonus = result.extra?.["bonusFound"] === true;
  return { summary: `${found} / ${total} found${bonus ? " · bonus word" : ""}`, detail: [] };
};

const letterWheelSummary: SummaryBuilder = (result) => {
  const slots = Number(result.extra?.["slots"] ?? 0);
  const total = Number(result.extra?.["total"] ?? 0);
  // wheelRev 1 rounds store their misses (traces that were not words); older rounds have none.
  const misses = Number(result.extra?.["misses"] ?? 0);
  // wheelRev 2 (word depth): bonus words in the jar.
  const jar = Number(result.extra?.["bonusWords"] ?? 0);
  return { summary: `${slots} / ${total} words${misses > 0 ? ` · ${misses} miss${misses === 1 ? "" : "es"}` : ""}${jar > 0 ? ` · ${jar} in the jar` : ""}`, detail: [] };
};

const strikeoutSummary: SummaryBuilder = (result) => {
  const solved = Number(result.extra?.["solvedRows"] ?? 0);
  const strikes = Number(result.extra?.["strikes"] ?? 0);
  return { summary: `${solved} / 5 words · ${strikes} strike${strikes === 1 ? "" : "s"}`, detail: [] };
};

const codewordSummary: SummaryBuilder = (result) => {
  if (result.extra?.["solved"] === true) return { summary: "Cracked", detail: [] };
  const correct = Number(result.extra?.["correct"] ?? 0);
  const hidden = Number(result.extra?.["hidden"] ?? 0);
  return { summary: `${correct} / ${hidden} letters`, detail: [] };
};

const swapwordSummary: SummaryBuilder = (result, puzzle) => {
  const swaps = Number(result.extra?.["swaps"] ?? 0);
  if (result.extra?.["solved"] === true) {
    return { summary: `Solved · ${swaps} swaps (min ${Number(result.extra?.["minSwaps"] ?? 0)})`, detail: [] };
  }
  const progress = progressOf(result, puzzle);
  if (progress) return progress;
  return { summary: `${Number(result.extra?.["placed"] ?? 0)} tiles placed`, detail: [] };
};

const tentsSummary: SummaryBuilder = (result, puzzle) => {
  if (puzzle.type !== "tents") return { summary: "—", detail: [] };
  const correct = Number(result.extra?.["correct"] ?? 0);
  const wrong = Number(result.extra?.["wrong"] ?? 0);
  const trees = Number(result.extra?.["trees"] ?? puzzle.trees.length);
  const points = result.score ?? 0;
  if (correct === trees && wrong === 0) {
    return { summary: `${correct} / ${trees} · ${points}`, detail: [] };
  }
  return {
    summary: `${correct} / ${trees} tents · ${points}`,
    detail: wrong ? [`${wrong} tent${wrong === 1 ? "" : "s"} in the wrong place`] : [],
  };
};

const ringsSummary: SummaryBuilder = (result, puzzle) => {
  if (puzzle.type !== "rings") return { summary: "—", detail: [] };
  const moves = Number(result.extra?.["moves"] ?? 0);
  const min = Number(result.extra?.["minMoves"] ?? puzzle.minMoves ?? 0);
  const aligned = Number(result.extra?.["aligned"] ?? 0);
  return {
    summary: result.is_correct
      ? `Solved · ${moves} turns${min ? ` (min ${min})` : ""} · ${seconds(elapsedMs(result, puzzle))}`
      : `${aligned} / ${RINGS_SEGMENTS} spokes`,
    detail: [
      result.is_correct && min > 0 && moves <= min
        ? "Solved in the minimum"
        : `${moves} turns made`,
    ],
  };
};

export const ROUND_SUMMARIES: Record<PuzzleType, SummaryBuilder> = {
  wordsmith: wordsmithSummary,
  tilegrid: tileGridSummary,
  balance: balanceSummary,
  wordslide: wordSlideSummary,
  target: targetSummary,
  reaction: averageSummary,
  equation: equationSummary,
  stroop: stroopSummary,
  symscan: symbolScanSummary,
  numhunt: numberHuntSummary,
  spotdiff: spotDifferenceSummary,
  stopwatch: stopwatchSummary,
  countup: countUpSummary,
  wordhunt: wordHuntSummary,
  unblock: unblockSummary,
  blockparty: blockPartySummary,
  lightsout: lightsOutSummary,
  pipes: pipesSummary,
  sudoku: sudokuSummary,
  flow: flowSummary,
  iceslide: slideSummary,
  push: pushSummary,
  laser: laserSummary,
  tower: towerSummary,
  maze: mazeSummary,
  tubes: tubesSummary,
  safe: safeSummary,
  bomb: bombSummary,
  gravity: gravitySummary,
  chain: chainSummary,
  nonogram: nonogramSummary,
  pairmatch: pairMatchSummary,
  flood: floodSummary,
  tiles: tilesSummary,
  rings: ringsSummary,
  hover: hoverSummary,
  swerve: swerveSummary,
  skyline: skylineSummary,
  bintoss: binTossSummary,
  bullseye: bullseyeSummary,
  matchup: matchupSummary,
  snake: snakeSummary,
  cross: crossSummary,
  dual: dualSummary,
  ricochet: ricoSummary,
  breaker: breakerSummary,
  pinball: pinballSummary,
  rally: rallySummary,
  steady: steadySummary,
  slice: sliceSummary,
  bubble: bubbleSummary,
  beat: beatSummary,
  whack: whackSummary,
  tendrop: tenDropSummary,
  wordfall: wordfallSummary,
  clayshoot: clayShootSummary,
  wavefront: wavefrontSummary,
  bastion: bastionSummary,
  rooftop: rooftopSummary,
  flip: flipSummary,
  junction: junctionSummary,
  inkbridge: inkBridgeSummary,
  burst: burstSummary,
  orbit: orbitSummary,
  swing: swingSummary,
  snip: snipSummary,
  tilt: tiltSummary,
  hotfloor: hotFloorSummary,
  tents: tentsSummary,
  shikaku: shikakuSummary,
  lightup: lightUpSummary,
  balltrack: ballTrackSummary,
  numpyramid: numberPyramidSummary,
  trail: trailSummary,
  measure: measureSummary,
  checkout: checkoutSummary,
  numline: numlineSummary,
  dig: digSummary,
  wordsearch: wordSearchSummary,
  letterwheel: letterWheelSummary,
  strikeout: strikeoutSummary,
  codeword: codewordSummary,
  swapword: swapwordSummary,
};

function joinOperators(values: string[]): string {
  return values.map((value) => (value === "-" ? "−" : value)).join(" ");
}

export const CORRECT_ANSWERS: Record<PuzzleType, AnswerBuilder> = {
  wordsmith: () => null,
  tilegrid: () => null,
  balance: () => null,
  wordslide: (p) => (p.type === "wordslide" && p.words ? p.words.join(" · ") : null),
  target: (p) => (p.type === "target" ? String(p.target) : null),
  reaction: () => null,
  equation: (p) => (p.type === "equation" && p.operators ? p.operators.map((ops) => joinOperators(ops)).join(" · ") : null),
  stroop: () => null,
  symscan: (p) => (p.type === "symscan" && p.targets ? p.targets.map((t) => t.length).join(" · ") + " arrows" : null),
  numhunt: () => null,
  spotdiff: (p) => (p.type === "spotdiff" ? `${(p.differences ?? []).length} differences` : null),
  stopwatch: () => null,
  countup: (p) => (p.type === "countup" && p.counts ? p.counts.join(" · ") : null),
  wordhunt: () => null,
  unblock: (p) => (p.type === "unblock" && p.minMoves ? `${p.minMoves} moves` : null),
  blockparty: () => null,
  lightsout: (p) => (p.type === "lightsout" && p.minPresses ? `${p.minPresses} presses` : null),
  pipes: () => null,
  sudoku: () => null,
  flow: () => null,
  iceslide: (p) => (p.type === "iceslide" && p.minMoves ? `${p.minMoves} moves` : null),
  push: (p) => (p.type === "push" && p.minPushes ? `${p.minPushes} pushes` : null),
  laser: () => null,
  tower: (p) => (p.type === "tower" ? `${p.minMoves} moves` : null),
  maze: () => null,
  tubes: (p) => (p.type === "tubes" && p.minMoves ? `${p.minMoves} pours` : null),
  safe: (p) => (p.type === "safe" && p.combination ? p.combination.join("") : null),
  bomb: () => null,
  gravity: (p) => (p.type === "gravity" && p.minMoves ? `${p.minMoves} tilts` : null),
  chain: () => null,
  nonogram: () => "The picture",
  pairmatch: (p) => (p.type === "pairmatch" ? `${PAIR_PAIRS} pairs` : null),
  flood: (p) => (p.type === "flood" ? `par ${p.par}` : null),
  tiles: (p) => (p.type === "tiles" && p.minMoves ? `${p.minMoves} moves` : null),
  hover: () => null,
  swerve: () => null,
  skyline: () => null,
  bintoss: () => null,
  bullseye: () => null,
  matchup: () => null,
  snake: () => null,
  cross: () => null,
  dual: () => null,
  ricochet: () => null,
  breaker: () => null,
  pinball: () => null,
  rally: () => null,
  steady: () => null,
  slice: () => null,
  bubble: () => null,
  beat: () => null,
  whack: () => null,
  tendrop: () => null,
  wordfall: () => null,
  clayshoot: () => null,
  wavefront: () => null,
  bastion: () => null,
  rooftop: () => null,
  flip: () => null,
  junction: () => null,
  inkbridge: () => null,
  burst: () => null,
  orbit: () => null,
  swing: () => null,
  snip: () => null,
  tilt: () => null,
  hotfloor: () => null,
  tents: () => null,
  shikaku: () => null,
  lightup: () => null,
  balltrack: () => null,
  numpyramid: () => null,
  trail: () => null,
  measure: (p) => (p.type === "measure" && p.minMoves ? `${p.minMoves.join(" · ")} moves` : null),
  checkout: (p) => (p.type === "checkout" && p.minDarts ? `${p.minDarts.join(" · ")} darts` : null),
  numline: () => null,
  dig: () => null,
  wordsearch: () => null,
  letterwheel: () => null,
  strikeout: () => null,
  codeword: () => null,
  swapword: () => null,

  rings: (p) => (p.type === "rings" && p.minMoves ? `${p.minMoves} turns` : null),
};
