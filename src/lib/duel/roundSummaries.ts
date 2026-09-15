import {
  BLOCK_FREE_CELLS,
  BLOCK_TIME_MS,
  GONOGO_ITEMS,
  GONOGO_RUN_MS,
  NUMHUNT_COUNT,
  PCTSPRINT_ITEMS,
  PCTSPRINT_TIME_MS,
  ROUND_MS,
  STROOP_ITEMS,
  TARGET_TIME_MS,
  UNBLOCK_TIME_MS,
  WORDHUNT_TIME_MS,
  wordHuntPoints,
  WORDSMITH_TIME_MS,
  wordsmithPoints,
  WORDMATCH_ITEMS,
  WORDMATCH_TIME_MS,
  type GoNoGoItem,
  type PlayerRoundDetail,
  type PuzzleData,
  type PuzzleType,
  type RoundResultRow,
  type StroopItem,
} from "./types";

type BuiltDetail = Omit<PlayerRoundDetail, "playerSlot">;
type SummaryBuilder = (result: RoundResultRow, puzzle: PuzzleData) => BuiltDetail;
type AnswerBuilder = (puzzle: PuzzleData) => string | null;

function elapsedMs(result: RoundResultRow, puzzle: PuzzleData): number {
  const limit =
    puzzle.type === "wordmatch"
      ? WORDMATCH_TIME_MS
    : puzzle.type === "pctsprint"
      ? PCTSPRINT_TIME_MS
    : puzzle.type === "target"
      ? TARGET_TIME_MS
      : puzzle.type === "wordsmith"
        ? WORDSMITH_TIME_MS
        : puzzle.type === "wordhunt"
          ? WORDHUNT_TIME_MS
          : puzzle.type === "unblock"
            ? UNBLOCK_TIME_MS
            : puzzle.type === "blockparty"
              ? BLOCK_TIME_MS
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

function singleAnswer(display: (result: RoundResultRow, puzzle: PuzzleData) => string | null): SummaryBuilder {
  return (result, puzzle) => {
    const answer = display(result, puzzle);
    if (!answer) return { summary: `No answer · ${seconds(elapsedMs(result, puzzle))}`, detail: [] };
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
  const detail = puzzle.type === "stroop"
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
  const detail = puzzle.type === "wordmatch"
    ? puzzle.items.map((item, index) => {
        const chosen = item.options[picks[index] ?? -1] ?? "No answer";
        const expected = item.options[puzzle.answers?.[index] ?? -1] ?? "—";
        return `${index + 1}. ${item.prompt} · ${chosen === expected ? `✓ ${chosen}` : `✗ ${chosen} · ${expected}`}`;
      })
    : [];
  return { summary: `${count} / ${WORDMATCH_ITEMS} · ${seconds(elapsedMs(result, puzzle))}`, detail };
}

function percentSprintSummary(result: RoundResultRow, puzzle: PuzzleData): BuiltDetail {
  const count = result.correct_count ?? 0;
  const picks = (result.answer ?? "").split(",").map((value) => Number.parseInt(value, 10));
  const detail = puzzle.type === "pctsprint"
    ? puzzle.items.map((item, index) => {
        const chosen = item.options[picks[index] ?? -1] ?? "No answer";
        const expected = item.options[puzzle.answers?.[index] ?? -1] ?? "—";
        return `${index + 1}. ${item.question} · ${chosen === expected ? `✓ ${chosen}` : `✗ ${chosen} · ${expected}`}`;
      })
    : [];
  return { summary: `${count} / ${PCTSPRINT_ITEMS} · ${seconds(elapsedMs(result, puzzle))}`, detail };
}

function describeGoNoGo(item: GoNoGoItem): string {
  return item.target ? "gold circle" : `${item.colour.toLowerCase()} ${item.shape}`;
}

function goNoGoSummary(result: RoundResultRow, puzzle: PuzzleData): BuiltDetail {
  const count = result.correct_count ?? 0;
  const taps = (result.answer ?? "").split(",");
  const detail = puzzle.type === "gonogo"
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
    summary: `${words.length} words · ${points} pts`,
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
    summary: away === 0 ? `${value} exact · ${Math.round(elapsedMs(result, puzzle) / 1000)}s` : `${value} (${away} away)`,
    detail: steps,
  };
}

const rawSingle = singleAnswer((result) => rawAnswer(result));
const optionSingle = singleAnswer((result) => optionAnswer(result));
const cellsSingle = singleAnswer((result) => cellsAnswer(result));
const sequenceSingle = singleAnswer(sequenceAnswer);

/** "9 words · 18 pts", with the words themselves in the expanded detail. */
const wordHuntSummary: SummaryBuilder = (result, puzzle) => {
  if (puzzle.type !== "wordhunt") return { summary: "—", detail: [] };
  const words = (result.answer ?? "")
    .split(",")
    .map((word) => word.trim().toUpperCase())
    .filter((word) => word.length > 0);
  const points = words.reduce((sum, word) => sum + wordHuntPoints(word), 0);
  const par = puzzle.par ?? 0;
  return {
    summary: `${words.length} words · ${points} pts`,
    detail: [
      ...(par > 0 ? [`Par ${par} · ${seconds(elapsedMs(result, puzzle))}`] : []),
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

export const ROUND_SUMMARIES: Record<PuzzleType, SummaryBuilder> = {
  wordsmith: wordsmithSummary,
  oddword: rawSingle,
  target: targetSummary,
  numseq: rawSingle,
  sequence: sequenceSingle,
  reverse: sequenceSingle,
  reaction: averageSummary,
  missing: rawSingle,
  equation: singleAnswer((result) => equationAnswer(result)),
  stroop: stroopSummary,
  spatial: cellsSingle,
  gonogo: goNoGoSummary,
  patcomp: optionSingle,
  symscan: cellsSingle,
  rotmatch: optionSingle,
  numhunt: numberHuntSummary,
  oddshape: optionSingle,
  chaincalc: rawSingle,
  wordmatch: wordMatchSummary,
  pctsprint: rawSingle,
  numspan: rawSingle,
  stopwatch: averageSummary,
  countup: rawSingle,
  mirmatch: optionSingle,
  wordhunt: wordHuntSummary,
  unblock: unblockSummary,
  blockparty: blockPartySummary,
};

function joinOperators(values: string[]): string {
  return values.map((value) => value === "-" ? "−" : value).join(" then ");
}

export const CORRECT_ANSWERS: Record<PuzzleType, AnswerBuilder> = {
  wordsmith: () => null,
  oddword: (p) => p.type === "oddword" ? p.odd : null,
  target: (p) => p.type === "target" ? String(p.target) : null,
  numseq: (p) => p.type === "numseq" ? String(p.answer) : null,
  sequence: (p) => p.type === "sequence" ? p.tiles.join(" → ") : null,
  reverse: (p) => p.type === "reverse" ? (p.answerOrder ?? [...p.tiles].reverse()).map((i) => p.tiles[i] ?? i + 1).join(" → ") : null,
  reaction: () => null,
  missing: (p) => p.type === "missing" ? p.word : null,
  equation: (p) => p.type === "equation" ? joinOperators(p.operators) : null,
  stroop: () => null,
  spatial: (p) => p.type === "spatial" ? `Cells ${p.tiles.map((i) => i + 1).join(", ")}` : null,
  gonogo: () => null,
  patcomp: (p) => p.type === "patcomp" ? `Option ${p.correctIndex + 1}` : null,
  symscan: (p) => p.type === "symscan" ? `${p.targets.length} arrows` : null,
  rotmatch: (p) => p.type === "rotmatch" ? `Option ${p.correctIndex + 1}` : null,
  numhunt: () => null,
  oddshape: (p) => p.type === "oddshape" ? `Cell ${p.oddIndex + 1}` : null,
  chaincalc: (p) => p.type === "chaincalc" ? String(p.answer) : null,
  wordmatch: () => null,
  pctsprint: (p) => p.type === "pctsprint" ? String(p.answer) : null,
  numspan: (p) => p.type === "numspan" ? p.digits : null,
  stopwatch: () => null,
  countup: (p) => p.type === "countup" ? String(p.count) : null,
  mirmatch: (p) => p.type === "mirmatch" && p.correctIndex !== undefined ? `Option ${p.correctIndex + 1}` : null,
  wordhunt: () => null,
  unblock: (p) => p.type === "unblock" && p.minMoves ? `${p.minMoves} moves` : null,
  blockparty: () => null,
};