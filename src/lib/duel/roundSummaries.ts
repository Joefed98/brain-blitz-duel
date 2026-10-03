import { crossLine } from "@/lib/duel/crossLine";
import {
  checkPatternAnswer,
  decodePatternAnswers,
  patternAttributeLabel,
  patternMistakes,
} from "./pattern";
import { equationStageCorrect, parseCount, parseSelection, scanStageResult, splitStages } from "./stagedRounds";
import {
  BLOCK_FREE_CELLS,
  BLOCK_TIME_MS,
  GONOGO_ITEMS,
  GONOGO_RUN_MS,
  NUMHUNT_COUNT,
  NUMSEQ_ITEMS,
  PCTSPRINT_ITEMS,
  PCTSPRINT_TIME_MS,
  PATCOMP_TIME_MS,
  ROUND_MS,
  SPOT_DIFFERENCES,
  SPOT_TIME_MS,
  STROOP_ITEMS,
  TARGET_TIME_MS,
  UNBLOCK_TIME_MS,
  WORDHUNT_TIME_MS,
  wordHuntPoints,
  WORDSMITH_TIME_MS,
  wordsmithPoints,
  WORDMATCH_ITEMS,
  WORDMATCH_TIME_MS,
  WORD_LADDER_TIME_MS,
  NUMBER_CLIMB_TIME_MS,
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
  type GoNoGoItem,
  type PlayerRoundDetail,
  type PuzzleData,
  type PuzzleType,
  type RoundResultRow,
  MIRMATCH_ITEMS,
  MIRMATCH_TIME_MS,
  SPIN_ITEMS,
  SPIN_TIME_MS,
} from "./types";
import { BOMB_TIME_MS, SAFE_DIALS, SAFE_TIME_MS, TUBES_COLOURS, TUBES_TIME_MS } from "./types";
import {
  CHAIN_TIME_MS,
  GRAV_TIME_MS,
  INTRUDER_BOARDS,
  INTRUDER_TIME_MS,
  NONO_TIME_MS,
  PAIR_PAIRS,
  PAIR_TIME_MS,
  FLOOD_CELLS,
  FLOOD_TIME_MS,
  STROKE_TIME_MS,
  TILES_COUNT,
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
  CLAYSHOOT_TIME_MS,
  TENTS_TIME_MS,
  SHIKAKU_TIME_MS,
  LIGHTUP_TIME_MS,
  BALLTRACK_TIME_MS,
  NUMPYRAMID_TIME_MS,
  TRAIL_TIME_MS,
  DIG_TIME_MS,
  WORDSEARCH_TIME_MS,
  LETTERWHEEL_TIME_MS,
  WAVEFRONT_TIME_MS,
  BASTION_TIME_MS,
  ROOFTOP_TIME_MS,
  SORTRUSH_TIME_MS,
  FLIP_TIME_MS,
  PARRY_TIME_MS,
  JUNCTION_TIME_MS,
  INKBRIDGE_TIME_MS,
  BURST_TIME_MS,
  ORBIT_TIME_MS,
  SWING_TIME_MS,
  SNIP_TIME_MS,
  TILT_TIME_MS,
  HOTFLOOR_TIME_MS,
} from "./types";

import { TG_TILES, TG_TIME_MS } from "./tileGrid";
import { WS_TIME_MS } from "./wordSlide";
import { SH_TIME_MS, SH_STAGES } from "./sumHunt";
import { BAL_SCALES, BAL_TIME_MS } from "./balance";

type BuiltDetail = Omit<PlayerRoundDetail, "playerSlot">;
type SummaryBuilder = (result: RoundResultRow, puzzle: PuzzleData) => BuiltDetail;
type AnswerBuilder = (puzzle: PuzzleData) => string | null;

/** Types added after the ladder below; their limits are looked up directly. */
const DIRECT_LIMITS: Partial<Record<PuzzleType, number>> = {
  nonogram: NONO_TIME_MS,
  pairmatch: PAIR_TIME_MS,
  flood: FLOOD_TIME_MS,
  stroke: STROKE_TIME_MS,
  tiles: TILES_TIME_MS,
  tilegrid: TG_TIME_MS,
  sumhunt: SH_TIME_MS,
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
  clayshoot: CLAYSHOOT_TIME_MS,
  tents: TENTS_TIME_MS,
  shikaku: SHIKAKU_TIME_MS,
  lightup: LIGHTUP_TIME_MS,
  balltrack: BALLTRACK_TIME_MS,
  numpyramid: NUMPYRAMID_TIME_MS,
  trail: TRAIL_TIME_MS,
  dig: DIG_TIME_MS,
  wordsearch: WORDSEARCH_TIME_MS,
  letterwheel: LETTERWHEEL_TIME_MS,
  wavefront: WAVEFRONT_TIME_MS,
  bastion: BASTION_TIME_MS,
  rooftop: ROOFTOP_TIME_MS,
  sortrush: SORTRUSH_TIME_MS,
  flip: FLIP_TIME_MS,
  parry: PARRY_TIME_MS,
  junction: JUNCTION_TIME_MS,
  inkbridge: INKBRIDGE_TIME_MS,
  burst: BURST_TIME_MS,
  orbit: ORBIT_TIME_MS,
  swing: SWING_TIME_MS,
  snip: SNIP_TIME_MS,
  tilt: TILT_TIME_MS,
  hotfloor: HOTFLOOR_TIME_MS,
};

function elapsedMs(result: RoundResultRow, puzzle: PuzzleData): number {
  const direct = DIRECT_LIMITS[puzzle.type];
  if (direct) return Math.max(0, direct - result.ms_remaining);
  const limit =
    puzzle.type === "wordmatch"
      ? WORDMATCH_TIME_MS
      : puzzle.type === "pctsprint"
        ? PCTSPRINT_TIME_MS
        : puzzle.type === "patcomp"
          ? PATCOMP_TIME_MS
          : puzzle.type === "target"
            ? TARGET_TIME_MS
            : puzzle.type === "equation"
              ? 60_000
              : puzzle.type === "chaincalc"
              ? 45_000
              : puzzle.type === "symscan"
                ? 45_000
                : puzzle.type === "countup"
                  ? 45_000
                  : puzzle.type === "numseq"
                    ? 30_000
                    : puzzle.type === "mirmatch"
                      ? MIRMATCH_TIME_MS
                      : puzzle.type === "spin"
                        ? SPIN_TIME_MS
                        : puzzle.type === "spotdiff"
                          ? SPOT_TIME_MS
                          : puzzle.type === "groups"
                            ? 90_000
                            : puzzle.type === "ladder"
                              ? WORD_LADDER_TIME_MS
                              : puzzle.type === "numclimb"
                                ? NUMBER_CLIMB_TIME_MS
                                : puzzle.type === "lightsout"
                                  ? LIGHTS_TIME_MS
                                  : puzzle.type === "pipes"
                                    ? PIPES_TIME_MS
                                    : puzzle.type === "sudoku"
                                      ? SUDOKU_TIME_MS
                                      : puzzle.type === "flow"
                                        ? FLOW_TIME_MS
                                        : puzzle.type === "iceslide"
                                          ? SLIDE_TIME_MS
                                          : puzzle.type === "push"
                                            ? PUSH_TIME_MS
                                            : puzzle.type === "laser"
                                              ? LASER_TIME_MS
                                              : puzzle.type === "maze"
                                                ? MAZE_TIME_MS
                                                : puzzle.type === "tower"
                                                  ? (puzzle.timeLimitMs ?? TOWER_TIME_MS)
                                                  : puzzle.type === "wordsmith"
                                                    ? WORDSMITH_TIME_MS
                                                    : puzzle.type === "wordhunt"
                                                      ? WORDHUNT_TIME_MS
                                                      : puzzle.type === "unblock"
                                                        ? UNBLOCK_TIME_MS
                                                        : puzzle.type === "blockparty"
                                                          ? BLOCK_TIME_MS
                                                          : puzzle.type === "tubes"
                                                            ? TUBES_TIME_MS
                                                            : puzzle.type === "safe"
                                                              ? SAFE_TIME_MS
                                                              : puzzle.type === "bomb"
                                                                ? BOMB_TIME_MS
                                                                : puzzle.type === "gravity"
                                                                  ? GRAV_TIME_MS
                                                                  : puzzle.type === "chain"
                                                                    ? CHAIN_TIME_MS
                                                                    : puzzle.type === "intruder"
                                                                      ? INTRUDER_TIME_MS
                                                                      : ROUND_MS;
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

function cellsAnswer(result: RoundResultRow): string | null {
  const cells = (result.answer ?? "")
    .split(",")
    .map((value) => Number.parseInt(value, 10))
    .filter(Number.isFinite)
    .map((value) => value + 1);
  return cells.length ? `Cells ${cells.join(", ")}` : null;
}

function sequenceAnswer(result: RoundResultRow, puzzle: PuzzleData): string | null {
  if (puzzle.type !== "sequence" && puzzle.type !== "reverse") return rawAnswer(result);
  const indices = (result.answer ?? "")
    .split(",")
    .map((value) => Number.parseInt(value, 10))
    .filter(Number.isFinite);
  if (!indices.length) return null;
  return indices.map((index) => puzzle.tiles[index] ?? index + 1).join(" → ");
}

function symbolScanSummary(result: RoundResultRow, puzzle: PuzzleData): BuiltDetail {
  if (puzzle.type !== "symscan") return { summary: "No answer", detail: [] };
  const parts = splitStages(result.answer);
  const results = puzzle.stages.map((_, i) => scanStageResult(i, parseSelection(parts[i] ?? ""), puzzle.targets?.[i] ?? []));
  const perfect = results.filter((r) => r.perfect).length;
  return {
    summary: `${perfect} / 3 grids perfect · ${seconds(elapsedMs(result, puzzle))}`,
    detail: results.map((r, i) => `Grid ${i + 1}: ${r.found} / ${r.targets} found${r.wrong ? ` · ${r.wrong} wrong` : ""}`),
  };
}

function equationSummary(result: RoundResultRow, puzzle: PuzzleData): BuiltDetail {
  if (puzzle.type !== "equation") return { summary: "No answer", detail: [] };
  const parts = splitStages(result.answer);
  const correct = puzzle.stages.map((st, i) => equationStageCorrect(st.numbers, st.target, parts[i] ?? ""));
  return {
    summary: `${correct.filter(Boolean).length} / 3 equations · ${seconds(elapsedMs(result, puzzle))}`,
    detail: correct.map((ok, i) => `Equation ${i + 1}: ${parts[i] ? joinOperators(parts[i]!.split(",")) : "skipped"} ${ok ? "✓" : "✗"}`),
  };
}

function countUpSummary(result: RoundResultRow, puzzle: PuzzleData): BuiltDetail {
  if (puzzle.type !== "countup") return { summary: "No answer", detail: [] };
  const parts = splitStages(result.answer);
  const counts = puzzle.counts ?? [];
  const exact = counts.filter((c, i) => parseCount(parts[i] ?? "") === c).length;
  return {
    summary: `${exact} / 3 exact · ${seconds(elapsedMs(result, puzzle))}`,
    detail: counts.map((c, i) => `Count ${i + 1}: ${parts[i] || "—"} (answer ${c})`),
  };
}

function chainCalculationSummary(result: RoundResultRow, puzzle: PuzzleData): BuiltDetail {
  const answer = rawAnswer(result);
  return {
    summary: `${answer ?? "No answer"} · ${seconds(elapsedMs(result, puzzle))}`,
    detail: [],
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

function wordMatchSummary(result: RoundResultRow, puzzle: PuzzleData): BuiltDetail {
  const count = result.correct_count ?? 0;
  const picks = (result.answer ?? "").split(",").map((value) => Number.parseInt(value, 10));
  const detail =
    puzzle.type === "wordmatch"
      ? puzzle.items.map((item, index) => {
          const chosen = item.options[picks[index] ?? -1] ?? "No answer";
          const expected = item.options[puzzle.answers?.[index] ?? -1] ?? "—";
          return `${index + 1}. ${item.prompt} · ${chosen === expected ? `✓ ${chosen}` : `✗ ${chosen} · ${expected}`}`;
        })
      : [];
  return {
    summary: `${count} / ${WORDMATCH_ITEMS} · ${seconds(elapsedMs(result, puzzle))}`,
    detail,
  };
}

function percentSprintSummary(result: RoundResultRow, puzzle: PuzzleData): BuiltDetail {
  const count = result.correct_count ?? 0;
  const picks = (result.answer ?? "").split(",").map((value) => Number.parseInt(value, 10));
  const detail =
    puzzle.type === "pctsprint"
      ? puzzle.items.map((item, index) => {
          const chosen = item.options[picks[index] ?? -1] ?? "No answer";
          const expected = item.options[puzzle.answers?.[index] ?? -1] ?? "—";
          return `${index + 1}. ${item.question} · ${chosen === expected ? `✓ ${chosen}` : `✗ ${chosen} · ${expected}`}`;
        })
      : [];
  return {
    summary: `${count} / ${PCTSPRINT_ITEMS} · ${seconds(elapsedMs(result, puzzle))}`,
    detail,
  };
}

function numberSequenceSummary(result: RoundResultRow, puzzle: PuzzleData): BuiltDetail {
  const count = result.correct_count ?? 0;
  const picks = (result.answer ?? "").split(",").map((value) => Number.parseInt(value, 10));
  const detail =
    puzzle.type === "numseq"
      ? puzzle.items.map((item, index) => {
          const chosen = item.options[picks[index] ?? -1] ?? "No answer";
          const expected = item.options[puzzle.answers?.[index] ?? -1] ?? "—";
          return `${index + 1}. ${item.numbers.join(", ")}, ? · ${chosen === expected ? `✓ ${chosen}` : `✗ ${chosen} · ${expected}`} (${item.rule})`;
        })
      : [];
  return {
    summary: `${count} / ${NUMSEQ_ITEMS} · ${seconds(elapsedMs(result, puzzle))}`,
    detail,
  };
}

const MIRROR_WRONG: Record<string, string> = {
  otherAxis: "flip across the other line",
  rotation: "turned, not flipped",
  swap: "colours swapped",
};

function mirrorSummary(result: RoundResultRow, puzzle: PuzzleData): BuiltDetail {
  const count = result.correct_count ?? 0;
  const picks = (result.answer ?? "").split(",").map((value) => Number.parseInt(value, 10));
  const detail =
    puzzle.type === "mirmatch"
      ? puzzle.items.map((item, index) => {
          const answer = puzzle.answers?.[index];
          const mine = picks[index];
          const line = `${index + 1}. Flip ${item.axis === "vertical" ? "left/right" : "up/down"}`;
          if (mine === undefined || Number.isNaN(mine)) return `${line} · ✗ No answer`;
          if (mine === answer) return `${line} · ✓`;
          const kind = puzzle.kinds?.[index]?.[mine];
          return `${line} · ✗ ${kind ? (MIRROR_WRONG[kind] ?? "wrong shape") : "wrong shape"}`;
        })
      : [];
  return {
    summary: `${count} / ${MIRMATCH_ITEMS} · ${seconds(elapsedMs(result, puzzle))}`,
    detail,
  };
}

const SPIN_TEXT: Record<string, string> = {
  cw: "90° clockwise",
  half: "180°",
  ccw: "90° anticlockwise",
  flip: "flipped",
};

function spinSummary(result: RoundResultRow, puzzle: PuzzleData): BuiltDetail {
  const count = result.correct_count ?? 0;
  const picks = (result.answer ?? "").split(",").filter(Boolean);
  const detail =
    puzzle.type === "spin"
      ? puzzle.items.map((_item, index) => {
          const answer = puzzle.answers?.[index];
          const mine = picks[index];
          const expected = answer ? (SPIN_TEXT[answer] ?? answer) : "—";
          if (!mine) return `${index + 1}. ${expected} · ✗ No answer`;
          return mine === answer
            ? `${index + 1}. ${expected} · ✓`
            : `${index + 1}. ${expected} · ✗ ${SPIN_TEXT[mine] ?? mine}`;
        })
      : [];
  return { summary: `${count} / ${SPIN_ITEMS} · ${seconds(elapsedMs(result, puzzle))}`, detail };
}

function patternSummary(result: RoundResultRow, puzzle: PuzzleData): BuiltDetail {
  if (puzzle.type !== "patcomp") return { summary: "—", detail: [] };
  const answers = decodePatternAnswers(result.answer);
  const count = puzzle.puzzles.filter((item, index) =>
    checkPatternAnswer(answers[index] ?? "", item),
  ).length;
  const detail = puzzle.puzzles.map((item, index) => {
    const answer = answers[index] ?? "";
    if (checkPatternAnswer(answer, item)) return `${index + 1}. ✓`;
    const wrong = patternMistakes(item, answer).map(patternAttributeLabel);
    return `${index + 1}. ✗ ${wrong.length ? `${wrong.join(", ")} wrong` : "Skipped"}`;
  });
  return {
    summary: count === 3 ? `3 / 3 · ${seconds(elapsedMs(result, puzzle))}` : `${count} / 3 correct`,
    detail,
  };
}

function spotDifferenceSummary(result: RoundResultRow, puzzle: PuzzleData): BuiltDetail {
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

function describeGoNoGo(item: GoNoGoItem): string {
  return item.target ? "gold circle" : `${item.colour.toLowerCase()} ${item.shape}`;
}

function goNoGoSummary(result: RoundResultRow, puzzle: PuzzleData): BuiltDetail {
  const count = result.correct_count ?? 0;
  const taps = (result.answer ?? "").split(",");
  const detail =
    puzzle.type === "gonogo"
      ? puzzle.items.map((item, index) => {
          const tapped = taps[index] !== undefined && taps[index] !== "-" && taps[index] !== "";
          const ok = item.target ? tapped : !tapped;
          return `${index + 1}. ${describeGoNoGo(item)} · ${ok ? "✓" : "✗"}`;
        })
      : [];
  return { summary: `${count} / ${GONOGO_ITEMS} · ${seconds(GONOGO_RUN_MS)}`, detail };
}

function wordsmithSummary(result: RoundResultRow): BuiltDetail {
  const words = Array.isArray(result.extra?.["words"])
    ? result.extra["words"].filter((word): word is string => typeof word === "string")
    : [];
  const points = typeof result.extra?.["points"] === "number" ? result.extra["points"] : 0;
  if (words.length === 0) return { summary: "No words", detail: [] };
  return {
    summary: `floor(2.5 × ${points}) = ${result.score} · ${words.length} words`,
    detail: words.map((word) => `${word} (${wordsmithPoints(word)})`),
  };
}

function averageSummary(result: RoundResultRow): BuiltDetail {
  return { summary: `avg ${result.reaction_avg_ms ?? 0} ms`, detail: [] };
}

function numberHuntSummary(result: RoundResultRow, puzzle: PuzzleData): BuiltDetail {
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
const cellsSingle = singleAnswer((result) => cellsAnswer(result));
const sequenceSingle = singleAnswer(sequenceAnswer);

/** Raw word points and the resulting round score, with words in the expanded detail. */
const wordHuntSummary: SummaryBuilder = (result, puzzle) => {
  if (puzzle.type !== "wordhunt") return { summary: "—", detail: [] };
  const words = (result.answer ?? "")
    .split(",")
    .map((word) => word.trim().toUpperCase())
    .filter((word) => word.length > 0);
  const points = words.reduce((sum, word) => sum + wordHuntPoints(word), 0);
  return {
    summary: `${points} points × 3 = ${result.score} · ${words.length} words`,
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

const groupsSummary: SummaryBuilder = (result, puzzle) => {
  if (puzzle.type !== "groups") return { summary: "—", detail: [] };
  const found = Math.max(0, Math.min(4, Number(result.extra?.["foundGroups"] ?? 0)));
  if (found === 4)
    return {
      summary: `4 / 4 groups · ${seconds(elapsedMs(result, puzzle))}`,
      detail: (puzzle.groups ?? []).map((group) => `${group.theme}: ${group.words.join(", ")}`),
    };
  return {
    summary: `${found} / 4 groups`,
    detail: (puzzle.groups ?? []).map((group) => `${group.theme}: ${group.words.join(", ")}`),
  };
};

const sumHuntSummary: SummaryBuilder = (result, puzzle) => {
  const stage = Number(result.extra?.["stage"] ?? 1);
  return { summary: stage > SH_STAGES ? `Cleared the grid · ${seconds(elapsedMs(result, puzzle))}` : `Stage ${stage} of ${SH_STAGES}`, detail: [] };
};

const balanceSummary: SummaryBuilder = (result, puzzle) => {
  const solved = Number(result.extra?.["solved"] ?? result.correct_count ?? 0);
  return {
    summary: solved === BAL_SCALES ? `3 / 3 · ${seconds(elapsedMs(result, puzzle))}` : `${solved} / 3`,
    detail: [],
  };
};

const tileGridSummary: SummaryBuilder = (result) => {
  const placed = Number(result.extra?.["placed"] ?? result.correct_count ?? 0);
  const valid = Boolean(result.extra?.["valid"] ?? result.is_correct);
  return {
    summary: valid ? `${placed} / ${TG_TILES} tiles · valid` : `${placed} / ${TG_TILES} · invalid at the timer`,
    detail: [],
  };
};

const wordSlideSummary: SummaryBuilder = (result, puzzle) => {
  const moves = Number(result.extra?.["moves"] ?? 0);
  const par = Number(result.extra?.["par"] ?? (puzzle.type === "wordslide" ? puzzle.par : 0));
  const rows = Number(result.extra?.["rows"] ?? result.correct_count ?? 0);
  return {
    summary: result.is_correct
      ? `Solved · ${moves} moves (par ${par}) · ${seconds(elapsedMs(result, puzzle))}`
      : `${rows} / 5 rows`,
    detail: [],
  };
};

const ladderSummary: SummaryBuilder = (result, puzzle) => {
  if (puzzle.type !== "ladder" || !result.is_correct) return { summary: "Not solved", detail: [] };
  const rungs = (result.answer ?? "").split(",").filter(Boolean);
  return {
    summary: `Solved · ${rungs.length + 1} rungs · ${seconds(elapsedMs(result, puzzle))}`,
    detail: [[puzzle.startWord, ...rungs].join(" → ")],
  };
};

const numberClimbSummary: SummaryBuilder = (result, puzzle) => {
  if (puzzle.type !== "numclimb") return { summary: "—", detail: [] };
  const span = Math.max(0, Math.min(12, Number(result.extra?.["span"] ?? 0)));
  return {
    summary: `Span ${span}${span === 12 ? " ✓" : ""} / 12 · ${seconds(elapsedMs(result, puzzle))}`,
    detail: result.answer ? [`Typed ${result.answer}`] : [],
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
    summary: `Not solved · ${startOn - left} / ${startOn} off`,
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
      detail: [`All ${puzzle.mirrors} mirrors in place`],
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
  if (result.is_correct) {
    return {
      summary: `Solved · ${seconds(elapsedMs(result, puzzle))}`,
      detail: [`${Number(result.extra?.["wasted"] ?? 0)} wasted squares`],
    };
  }
  return { summary: `${progress}%`, detail: [`${progress}% of the way to the exit`] };
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
    detail: [`${prefix} action${prefix === 1 ? "" : "s"} carried out correctly`],
  };
};

function ordinalTry(value: number): string {
  return value === 1 ? "1st" : value === 2 ? "2nd" : value === 3 ? "3rd" : `${value}th`;
}

const gravitySummary: SummaryBuilder = (result, puzzle) => {
  if (puzzle.type !== "gravity") return { summary: "—", detail: [] };
  const tilts = Number(result.extra?.["tilts"] ?? 0);
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
  const correct = Number(result.extra?.["correct"] ?? 0);
  const errors = Number(result.extra?.["errors"] ?? 0);
  return {
    summary: `${correct} links · ${errors} error${errors === 1 ? "" : "s"} · ${seconds(
      elapsedMs(result, puzzle),
    )}`,
    detail: [`${Number(result.extra?.["completed"] ?? 0)} complete sets`],
  };
};

const intruderSummary: SummaryBuilder = (result, puzzle) => {
  if (puzzle.type !== "intruder") return { summary: "—", detail: [] };
  const correct = Number(result.extra?.["correct"] ?? 0);
  return {
    summary: `${correct} / ${INTRUDER_BOARDS} · ${seconds(elapsedMs(result, puzzle))}`,
    detail: [
      result.extra?.["allFirstTry"] ? "Every grid found first time" : "A second look was needed",
    ],
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

const strokeSummary: SummaryBuilder = (result, puzzle) => {
  if (puzzle.type !== "stroke") return { summary: "—", detail: [] };
  const solvedOn = Number(result.extra?.["solvedOn"] ?? 0);
  const best = Number(result.extra?.["best"] ?? 0);
  const total = Number(result.extra?.["total"] ?? puzzle.edges.length);
  const ordinal = solvedOn === 1 ? "1st" : solvedOn === 2 ? "2nd" : `${solvedOn}th`;
  return {
    summary: result.is_correct
      ? `Solved · ${ordinal} try · ${seconds(elapsedMs(result, puzzle))}`
      : `${best} / ${total} lines`,
    detail: [`${Number(result.extra?.["attempts"] ?? 0)} attempts`],
  };
};

const tilesSummary: SummaryBuilder = (result, puzzle) => {
  if (puzzle.type !== "tiles") return { summary: "—", detail: [] };
  const moves = Number(result.extra?.["moves"] ?? 0);
  const min = Number(result.extra?.["minMoves"] ?? puzzle.minMoves ?? 0);
  const inPlace = Number(result.extra?.["inPlace"] ?? 0);
  return {
    summary: result.is_correct
      ? `Solved · ${moves} moves${min ? ` (min ${min})` : ""} · ${seconds(elapsedMs(result, puzzle))}`
      : `${inPlace} / ${TILES_COUNT} in place`,
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
      : `${gates} / ${total} gates · crashed at ${ended.toFixed(1)}s`,
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
    detail: [`${perfects} perfect drop${perfects === 1 ? "" : "s"}`],
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
    summary: `${raw.toLocaleString("en-GB")} pts → ${result.score} · ${swaps} swaps · best line ${bestLine || "—"}`,
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
      ? `${pellets} pellets · survived`
      : `${pellets} pellets · crashed at ${ended.toFixed(1)}s`,
    detail: [survived ? "Lasted the whole minute" : "Run ended early"],
  };
};

const crossSummary: SummaryBuilder = (result) => {
  const crossings = Number(result.extra?.["crossings"] ?? 0);
  const clean = Number(result.extra?.["clean"] ?? 0);
  const lost = Number(result.extra?.["livesLost"] ?? 0);
  const lanes = Number(result.extra?.["lanes"] ?? 0);
  return {
    summary: crossLine({ crossings, clean, livesLost: lost }),
    detail: [`${lanes} lane${lanes === 1 ? "" : "s"} into the last crossing`],
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
      : `${Number(result.extra?.["destroyed"] ?? 72 - left)} / 72 bricks · ${hits} hits · ${powerUps} power-up${powerUps === 1 ? "" : "s"}`,
    detail: [`${Number(result.extra?.["losses"] ?? 0)} relaunches`],
  };
};

const rallySummary: SummaryBuilder = (result) => {
  const hits = Number(result.extra?.["hits"] ?? 0);
  const goldHits = Number(result.extra?.["goldHits"] ?? 0);
  const survived = result.extra?.["survived"] === true;
  const ended = Number(result.extra?.["endedSeconds"] ?? 0);
  const gold = `${goldHits} gold hit${goldHits === 1 ? "" : "s"}`;
  return {
    summary: survived
      ? `${gold} (3 each) · ${hits} blue returns · survived`
      : `${gold} (3 each) · ${hits} blue returns · lost at ${ended.toFixed(1)}s`,
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
  const bombs = Number(result.extra?.["bombsHit"] ?? 0);
  return {
    summary: `Sliced ${slices} / ${total} · best combo ×${Number(result.extra?.["bestMult"] ?? 1)}`,
    detail: [`${bombs} bomb${bombs === 1 ? "" : "s"} hit`],
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

const whackSummary: SummaryBuilder = (result) => {
  const hits = Number(result.extra?.["hits"] ?? 0);
  const wrong = Number(result.extra?.["wrong"] ?? 0);
  const total = Number(result.extra?.["totalTargets"] ?? 0);
  return {
    summary: `Hits ${hits} / ${total} · Wrong ${wrong}`,
    detail: ["135 × share hit · −5 per wrong tap · +15 for all clean"],
  };
};

const tenDropSummary: SummaryBuilder = (result) => {
  const cleared = Number(result.extra?.["cleared"] ?? 0);
  const resets = Number(result.extra?.["resets"] ?? 0);
  return {
    summary: `${cleared} / 10 targets`,
    detail: [`${resets} reset${resets === 1 ? "" : "s"}`],
  };
};

const clayShootSummary: SummaryBuilder = (result) => {
  const hits = Number(result.extra?.["hits"] ?? 0);
  const total = Number(result.extra?.["total"] ?? 25);
  const orange = Number(result.extra?.["orangeHits"] ?? 0);
  const gold = Number(result.extra?.["goldHits"] ?? 0);
  const shots = Number(result.extra?.["shots"] ?? 0);
  return {
    summary: `${hits} / ${total} clays`,
    detail: [`${orange} orange · ${gold} gold · ${shots} shot${shots === 1 ? "" : "s"}`],
  };
};

const wavefrontSummary: SummaryBuilder = (result) => {
  const wave = Number(result.extra?.["wave"] ?? 1);
  const shapes = Number(result.extra?.["shapesDown"] ?? 0);
  const saucers = Number(result.extra?.["saucers"] ?? 0);
  const survived = result.extra?.["survived"] !== false;
  const ended = Number(result.extra?.["endedSeconds"] ?? 0);
  const head = `Wave ${wave} · ${shapes} shape${shapes === 1 ? "" : "s"} · ${saucers} saucer${saucers === 1 ? "" : "s"}`;
  return {
    summary: survived ? `${head} · survived` : `${head} · destroyed at ${ended.toFixed(1)}s`,
    detail: [`${Number(result.extra?.["wavesCleared"] ?? 0)} waves cleared`],
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

const sortRushSummary: SummaryBuilder = (result) => {
  const sorted = Number(result.extra?.["sorted"] ?? 0);
  const total = Number(result.extra?.["total"] ?? 0);
  const wrong = Number(result.extra?.["wrong"] ?? 0);
  const survived = result.extra?.["survived"] !== false;
  const ended = Number(result.extra?.["survivedSeconds"] ?? 0);
  const head = `${sorted} / ${total} sorted · ${wrong} wrong`;
  return {
    summary: survived ? `${head} · survived` : `${head} · missed at ${ended.toFixed(1)}s`,
    detail: ["Same shapes for everyone"],
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

const parrySummary: SummaryBuilder = (result) => {
  const deflected = Number(result.extra?.["deflected"] ?? 0);
  const total = Number(result.extra?.["total"] ?? 0);
  const hits = Number(result.extra?.["hits"] ?? 0);
  const survived = result.extra?.["survived"] !== false;
  const ended = Number(result.extra?.["survivedSeconds"] ?? 0);
  void total;
  return {
    summary: `${deflected} deflected · ${hits} ${hits === 1 ? "life" : "lives"} lost · ${result.score ?? 0}`,
    detail: ["Same arrows for everyone"],
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
    detail: [`Ambulances: ${through} through · ${stopped} stopped`],
  };
};

const inkBridgeSummary: SummaryBuilder = (result) => {
  const levels = Number(result.extra?.["levels"] ?? 0);
  const total = Number(result.extra?.["total"] ?? 10);
  return {
    summary: levels >= total ? `All ${total} · ${result.score}` : `Level ${levels} · ${result.score} points`,
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
    summary: `${eaten} sweet${eaten === 1 ? "" : "s"} · ${stars}★ · ${result.score ?? 0}`,
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
    summary: survived ? `${head} · survived` : `${head} · pit at ${ended.toFixed(1)}s`,
    detail: ["Same mazes for everyone"],
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
  return { summary: `${Number(result.extra?.["covered"] ?? 0)} / ${puzzle.type === "shikaku" ? puzzle.size * puzzle.size : 81} covered`, detail: [] };
};

const lightUpSummary: SummaryBuilder = (result, puzzle) => {
  if (result.is_correct) return { summary: `Solved · ${seconds(elapsedMs(result, puzzle))}`, detail: [] };
  const lit = Number(result.extra?.["lit"] ?? 0);
  const whites = Number(result.extra?.["whites"] ?? 0);
  const clashing = Number(result.extra?.["clashing"] ?? 0);
  return {
    summary: `${lit} / ${whites} lit`,
    detail: clashing ? [`${clashing} bulb${clashing === 1 ? "" : "s"} shining on another`] : [],
  };
};

const ballTrackSummary: SummaryBuilder = (result, puzzle) => {
  const home = Number(result.extra?.["home"] ?? 0);
  return { summary: `${home} / 8 home`, detail: ["Same puzzle for everyone"] };
};

const numberPyramidSummary: SummaryBuilder = (result, puzzle) => {
  const completed = Number(result.extra?.["completed"] ?? 0);
  if (result.is_correct) return { summary: `4 / 4 complete · ${seconds(elapsedMs(result, puzzle))}`, detail: [] };
  return { summary: `${completed} / 4 pyramids complete`, detail: [] };
};

const trailSummary: SummaryBuilder = (result, puzzle) => {
  const prefix = Number(result.extra?.["prefix"] ?? 0);
  if (result.is_correct) return { summary: `Complete · ${seconds(elapsedMs(result, puzzle))}`, detail: [] };
  return { summary: `${prefix} / 36 steps correct`, detail: [] };
};

const digSummary: SummaryBuilder = (result) => {
  const collected = Number(result.extra?.["collected"] ?? 0);
  const pool = Number(result.extra?.["pool"] ?? 0);
  const lost = Number(result.extra?.["lost"] ?? 0);
  return { summary: `${collected} / ${pool} drained`, detail: lost ? [`${lost} lost`] : [] };
};

const wordSearchSummary: SummaryBuilder = (result) => {
  const found = Number(result.extra?.["found"] ?? 0);
  const total = Number(result.extra?.["total"] ?? 6);
  return { summary: `${found} / ${total} found`, detail: [] };
};

const letterWheelSummary: SummaryBuilder = (result) => {
  const slots = Number(result.extra?.["slots"] ?? 0);
  const total = Number(result.extra?.["total"] ?? 0);
  return { summary: `${slots} / ${total} words`, detail: [] };
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
  groups: groupsSummary,
  ladder: ladderSummary,
  tilegrid: tileGridSummary,
  sumhunt: sumHuntSummary,
  balance: balanceSummary,
  wordslide: wordSlideSummary,
  target: targetSummary,
  numseq: numberSequenceSummary,
  sequence: sequenceSingle,
  reverse: sequenceSingle,
  reaction: averageSummary,
  equation: equationSummary,
  stroop: stroopSummary,
  spatial: cellsSingle,
  gonogo: goNoGoSummary,
  patcomp: patternSummary,
  symscan: symbolScanSummary,
  spin: spinSummary,
  numhunt: numberHuntSummary,
  spotdiff: spotDifferenceSummary,
  chaincalc: chainCalculationSummary,
  wordmatch: wordMatchSummary,
  pctsprint: percentSprintSummary,
  numclimb: numberClimbSummary,
  stopwatch: averageSummary,
  countup: countUpSummary,
  mirmatch: mirrorSummary,
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
  intruder: intruderSummary,
  nonogram: nonogramSummary,
  pairmatch: pairMatchSummary,
  flood: floodSummary,
  stroke: strokeSummary,
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
  rally: rallySummary,
  steady: steadySummary,
  slice: sliceSummary,
  bubble: bubbleSummary,
  beat: beatSummary,
  whack: whackSummary,
  tendrop: tenDropSummary,
  clayshoot: clayShootSummary,
  wavefront: wavefrontSummary,
  bastion: bastionSummary,
  rooftop: rooftopSummary,
  sortrush: sortRushSummary,
  flip: flipSummary,
  parry: parrySummary,
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
  dig: digSummary,
  wordsearch: wordSearchSummary,
  letterwheel: letterWheelSummary,
};

function joinOperators(values: string[]): string {
  return values.map((value) => (value === "-" ? "−" : value)).join(" ");
}

export const CORRECT_ANSWERS: Record<PuzzleType, AnswerBuilder> = {
  wordsmith: () => null,
  groups: () => "Four groups of four",
  tilegrid: () => null,
  sumhunt: () => null,
  balance: () => null,
  wordslide: (p) => (p.type === "wordslide" && p.words ? p.words.join(" · ") : null),
  ladder: (p) => (p.type === "ladder" ? (p.shortestPath ?? []).join(" → ") : null),
  target: (p) => (p.type === "target" ? String(p.target) : null),
  numseq: () => null,
  sequence: (p) => (p.type === "sequence" ? p.tiles.join(" → ") : null),
  reverse: (p) =>
    p.type === "reverse"
      ? (p.answerOrder ?? [...p.tiles].reverse()).map((i) => p.tiles[i] ?? i + 1).join(" → ")
      : null,
  reaction: () => null,
  equation: (p) => (p.type === "equation" && p.operators ? p.operators.map((ops) => joinOperators(ops)).join(" · ") : null),
  stroop: () => null,
  spatial: (p) => (p.type === "spatial" ? `Cells ${p.tiles.map((i) => i + 1).join(", ")}` : null),
  gonogo: () => null,
  patcomp: (p) => (p.type === "patcomp" ? "See the three grids" : null),
  symscan: (p) => (p.type === "symscan" && p.targets ? p.targets.map((t) => t.length).join(" · ") + " arrows" : null),
  spin: () => null,
  numhunt: () => null,
  spotdiff: (p) => (p.type === "spotdiff" ? `${(p.differences ?? []).length} differences` : null),
  chaincalc: (p) => (p.type === "chaincalc" ? String(p.answer) : null),
  wordmatch: () => null,
  pctsprint: () => null,
  numclimb: (p) => (p.type === "numclimb" ? (p.answerDigits ?? p.digits) : null),
  stopwatch: () => null,
  countup: (p) => (p.type === "countup" && p.counts ? p.counts.join(" · ") : null),
  mirmatch: () => null,
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
  intruder: () => null,
  nonogram: () => "The picture",
  pairmatch: (p) => (p.type === "pairmatch" ? `${PAIR_PAIRS} pairs` : null),
  flood: (p) => (p.type === "flood" ? `par ${p.par}` : null),
  stroke: (p) => (p.type === "stroke" ? `${p.edges.length} lines, one stroke` : null),
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
  rally: () => null,
  steady: () => null,
  slice: () => null,
  bubble: () => null,
  beat: () => null,
  whack: () => null,
  tendrop: () => null,
  clayshoot: () => null,
  wavefront: () => null,
  bastion: () => null,
  rooftop: () => null,
  sortrush: () => null,
  flip: () => null,
  parry: () => null,
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
  dig: () => null,
  wordsearch: () => null,
  letterwheel: () => null,

  rings: (p) => (p.type === "rings" && p.minMoves ? `${p.minMoves} turns` : null),
};
