import {
  checkPatternAnswer,
  decodePatternAnswers,
  patternAttributeLabel,
  patternMistakes,
} from "./pattern";
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
  type StroopItem,
} from "./types";
import { BOMB_TIME_MS, SAFE_DIALS, SAFE_TIME_MS, TUBES_COLOURS, TUBES_TIME_MS } from "./types";
import {
  CHAIN_LENGTH,
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
} from "./types";

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
  rings: RINGS_TIME_MS,
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
            : puzzle.type === "equation" || puzzle.type === "chaincalc"
              ? 45_000
              : puzzle.type === "symscan"
                ? 20_000
                : puzzle.type === "countup"
                  ? 15_000
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

function equationAnswer(result: RoundResultRow): string | null {
  const answer = rawAnswer(result);
  return answer ? joinOperators(answer.split(",")) : null;
}

function symbolScanSummary(result: RoundResultRow, puzzle: PuzzleData): BuiltDetail {
  if (puzzle.type !== "symscan") return { summary: "No answer", detail: [] };
  const selected = new Set((result.answer ?? "").split(",").map(Number).filter(Number.isFinite));
  const found = puzzle.targets.filter((target) => selected.has(target)).length;
  const wrong = [...selected].filter((index) => !puzzle.targets.includes(index)).length;
  return {
    summary: `${found} / ${puzzle.targets.length} targets · ${seconds(elapsedMs(result, puzzle))}`,
    detail: wrong > 0 ? [`${wrong} wrong selection${wrong === 1 ? "" : "s"}`] : [],
  };
}

function equationSummary(result: RoundResultRow, puzzle: PuzzleData): BuiltDetail {
  const answer = equationAnswer(result);
  return {
    summary: `${answer ?? "No answer"} · ${seconds(elapsedMs(result, puzzle))}`,
    detail: [],
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

function expectedStroop(item: StroopItem): string {
  return item.instruction === "ink" ? item.ink : item.word;
}

function stroopSummary(result: RoundResultRow, puzzle: PuzzleData): BuiltDetail {
  const count = result.correct_count ?? 0;
  const taps = (result.answer ?? "").split(",").filter(Boolean);
  const detail =
    puzzle.type === "stroop"
      ? puzzle.items.map((item, index) => {
          const picked = taps[index] ?? "No answer";
          const expected = expectedStroop(item);
          return `${index + 1}. TAP THE ${item.instruction.toUpperCase()} · ${item.word} in ${item.ink} · ${picked === expected ? "✓" : `✗ ${picked}`}`;
        })
      : [];
  return { summary: `${count} / ${STROOP_ITEMS} · ${seconds(elapsedMs(result, puzzle))}`, detail };
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
    summary: `${points} points · ${words.length} words`,
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

/** "18 points · 9 words", with the words themselves in the expanded detail. */
const wordHuntSummary: SummaryBuilder = (result, puzzle) => {
  if (puzzle.type !== "wordhunt") return { summary: "—", detail: [] };
  const words = (result.answer ?? "")
    .split(",")
    .map((word) => word.trim().toUpperCase())
    .filter((word) => word.length > 0);
  const points = words.reduce((sum, word) => sum + wordHuntPoints(word), 0);
  return {
    summary: `${points} points · ${words.length} words`,
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
    summary: `${joined} / ${FLOW_PAIRS} pairs`,
    detail: [`${filled} / ${FLOW_CELLS} squares filled`],
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
      detail: ["Every action was in the right order"],
    };
  }
  return {
    summary: exploded
      ? `Exploded · ${prefix} / ${puzzle.stepCount}`
      : `${prefix} / ${puzzle.stepCount}`,
    detail: [`${prefix} correct opening step${prefix === 1 ? "" : "s"}`],
  };
};

function ordinalTry(value: number): string {
  return value === 1 ? "1st" : value === 2 ? "2nd" : value === 3 ? "3rd" : `${value}th`;
}

const gravitySummary: SummaryBuilder = (result, puzzle) => {
  if (puzzle.type !== "gravity") return { summary: "—", detail: [] };
  const tilts = Number(result.extra?.["tilts"] ?? 0);
  const min = Number(result.extra?.["minMoves"] ?? puzzle.minMoves ?? 0);
  const onTarget = Number(result.extra?.["onTarget"] ?? 0);
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
    detail: [onTarget === 1 ? "One ball on its target" : `${tilts} tilts made`],
  };
};

const chainSummary: SummaryBuilder = (result, puzzle) => {
  if (puzzle.type !== "chain") return { summary: "—", detail: [] };
  const correct = Number(result.extra?.["correct"] ?? 0);
  const errors = Number(result.extra?.["errors"] ?? 0);
  return {
    summary: `${correct} / ${CHAIN_LENGTH} · ${errors} error${errors === 1 ? "" : "s"} · ${seconds(
      elapsedMs(result, puzzle),
    )}`,
    detail: [result.is_correct ? "Chain complete" : "Chain unfinished"],
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
  countup: rawSingle,
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
};

function joinOperators(values: string[]): string {
  return values.map((value) => (value === "-" ? "−" : value)).join(" ");
}

export const CORRECT_ANSWERS: Record<PuzzleType, AnswerBuilder> = {
  wordsmith: () => null,
  groups: () => "Four groups of four",
  ladder: (p) => (p.type === "ladder" ? (p.shortestPath ?? []).join(" → ") : null),
  target: (p) => (p.type === "target" ? String(p.target) : null),
  numseq: () => null,
  sequence: (p) => (p.type === "sequence" ? p.tiles.join(" → ") : null),
  reverse: (p) =>
    p.type === "reverse"
      ? (p.answerOrder ?? [...p.tiles].reverse()).map((i) => p.tiles[i] ?? i + 1).join(" → ")
      : null,
  reaction: () => null,
  equation: (p) => (p.type === "equation" ? joinOperators(p.operators) : null),
  stroop: () => null,
  spatial: (p) => (p.type === "spatial" ? `Cells ${p.tiles.map((i) => i + 1).join(", ")}` : null),
  gonogo: () => null,
  patcomp: (p) => (p.type === "patcomp" ? "See the three grids" : null),
  symscan: (p) => (p.type === "symscan" ? `${p.targets.length} arrows` : null),
  spin: () => null,
  numhunt: () => null,
  spotdiff: (p) => (p.type === "spotdiff" ? `${(p.differences ?? []).length} differences` : null),
  chaincalc: (p) => (p.type === "chaincalc" ? String(p.answer) : null),
  wordmatch: () => null,
  pctsprint: () => null,
  numclimb: (p) => (p.type === "numclimb" ? (p.answerDigits ?? p.digits) : null),
  stopwatch: () => null,
  countup: (p) => (p.type === "countup" ? String(p.count) : null),
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
  rings: (p) => (p.type === "rings" && p.minMoves ? `${p.minMoves} turns` : null),
};
